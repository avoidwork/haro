import { IsolationLevels } from "./constants.js";
import { KeyRelationshipAnalyzer } from "./key-relationship-analyzer.js";

/**
 * Deadlock detector using multiple detection strategies
 */
export class DeadlockDetector {
	constructor (lockManager) {
		this.lockManager = lockManager;
		this.keyAnalyzer = new KeyRelationshipAnalyzer();
	}

	/**
	 * Check for deadlocks using multiple detection strategies
	 * @param {Transaction[]} activeTransactions - Active transactions
	 * @param {Object} [options={}] - Detection options
	 * @returns {Object} Deadlock detection results
	 */
	detectDeadlocks (activeTransactions, options = {}) {
		const opts = {
			useLockGraph: true,
			useResourceGraph: true,
			useTimeoutDetection: true,
			timeoutThreshold: 10000,
			...options
		};

		const results = {
			deadlocks: [],
			suspectedDeadlocks: [],
			timeoutVictims: [],
			waitForGraph: null,
			resourceGraph: null
		};

		if (activeTransactions.length < 2) {
			return results;
		}

		// 1. Lock-based wait-for graph deadlock detection
		if (opts.useLockGraph) {
			const lockDeadlocks = this._detectLockBasedDeadlocks(activeTransactions);
			results.deadlocks.push(...lockDeadlocks.cycles);
			results.waitForGraph = lockDeadlocks.graph;
		}

		// 2. Resource allocation graph deadlock detection
		if (opts.useResourceGraph) {
			const resourceDeadlocks = this._detectResourceDeadlocks(activeTransactions);
			results.deadlocks.push(...resourceDeadlocks.cycles);
			results.resourceGraph = resourceDeadlocks.graph;
		}

		// 3. Isolation-level based deadlock detection
		const isolationDeadlocks = this._detectIsolationDeadlocks(activeTransactions);
		results.suspectedDeadlocks.push(...isolationDeadlocks);

		// 4. Timeout-based deadlock detection (fallback)
		if (opts.useTimeoutDetection) {
			const timeoutVictims = this._detectTimeoutVictims(activeTransactions, opts.timeoutThreshold);
			results.timeoutVictims.push(...timeoutVictims);
		}

		// Remove duplicates and merge results
		results.deadlocks = this._deduplicateDeadlocks(results.deadlocks);

		return results;
	}

	/**
	 * Detect deadlocks using lock-based wait-for graph
	 * @param {Transaction[]} activeTransactions - Active transactions
	 * @returns {Object} Lock-based deadlock detection results
	 * @private
	 */
	_detectLockBasedDeadlocks (activeTransactions) {
		const waitForGraph = this._buildLockWaitForGraph(activeTransactions);
		const cycles = this._detectCyclesInGraph(waitForGraph);

		return {
			graph: waitForGraph,
			cycles: cycles.map(cycle => ({
				type: "lock",
				transactions: cycle,
				resources: this._getResourcesInvolvedInCycle(cycle, activeTransactions)
			}))
		};
	}

	/**
	 * Build wait-for graph based on lock dependencies
	 * @param {Transaction[]} transactions - Active transactions
	 * @returns {Map<string, Set<string>>} Wait-for graph
	 * @private
	 */
	_buildLockWaitForGraph (transactions) {
		const graph = new Map();
		const lockStats = this.lockManager.getStats();

		// Initialize graph nodes
		for (const tx of transactions) {
			graph.set(tx.id, new Set());
		}

		// Build edges based on lock conflicts
		for (const lockInfo of lockStats.recordsLocked) {
			const { recordKey, holders } = lockInfo;

			// Find transactions waiting for this lock
			const waitingTransactions = this._findTransactionsWaitingForLock(recordKey, transactions);

			// Create edges from waiting transactions to lock holders
			for (const waitingTx of waitingTransactions) {
				for (const holderId of holders) {
					if (waitingTx !== holderId && graph.has(waitingTx) && graph.has(holderId)) {
						graph.get(waitingTx).add(holderId);
					}
				}
			}
		}

		return graph;
	}

	/**
	 * Find transactions that are waiting for a specific lock
	 * @param {string} recordKey - Record key
	 * @param {Transaction[]} transactions - All transactions to check
	 * @returns {string[]} Transaction IDs waiting for the lock
	 * @private
	 */
	_findTransactionsWaitingForLock (recordKey, transactions) {
		const waiting = [];

		for (const tx of transactions) {
			const hasOperationOnKey = tx.writeSet.has(recordKey) || tx.readSet.has(recordKey);
			const holdsLock = this.lockManager.holdsLocks(tx.id);

			if (hasOperationOnKey && !holdsLock) {
				waiting.push(tx.id);
			}
		}

		return waiting;
	}

	/**
	 * Detect deadlocks using resource allocation graph
	 * @param {Transaction[]} activeTransactions - Active transactions
	 * @returns {Object} Resource-based deadlock detection results
	 * @private
	 */
	_detectResourceDeadlocks (activeTransactions) {
		const resourceGraph = this._buildResourceAllocationGraph(activeTransactions);
		const cycles = this._detectCyclesInResourceGraph(resourceGraph);

		return {
			graph: resourceGraph,
			cycles: cycles.map(cycle => ({
				type: "resource",
				transactions: cycle.transactions,
				resources: cycle.resources
			}))
		};
	}

	/**
	 * Build resource allocation graph
	 * @param {Transaction[]} transactions - Active transactions
	 * @returns {Object} Resource allocation graph
	 * @private
	 */
	_buildResourceAllocationGraph (transactions) {
		const graph = {
			transactions: new Map(), // tx -> Set<resources>
			resources: new Map(), // resource -> Set<tx>
			waiting: new Map() // tx -> Set<resources waiting for>
		};

		// Initialize
		for (const tx of transactions) {
			graph.transactions.set(tx.id, new Set());
			graph.waiting.set(tx.id, new Set());
		}

		// Build allocation and waiting relationships
		const lockStats = this.lockManager.getStats();

		for (const lockInfo of lockStats.recordsLocked) {
			const { recordKey, holders } = lockInfo;

			if (!graph.resources.has(recordKey)) {
				graph.resources.set(recordKey, new Set());
			}

			// Record allocations
			for (const holderId of holders) {
				if (graph.transactions.has(holderId)) {
					graph.transactions.get(holderId).add(recordKey);
					graph.resources.get(recordKey).add(holderId);
				}
			}

			// Record waiting relationships
			const waitingTx = this._findTransactionsWaitingForLock(recordKey, transactions);
			for (const txId of waitingTx) {
				if (graph.waiting.has(txId)) {
					graph.waiting.get(txId).add(recordKey);
				}
			}
		}

		return graph;
	}

	/**
	 * Detect cycles in a wait-for graph
	 * @param {Map<string, Set<string>>} graph - Wait-for graph
	 * @returns {string[][]} Array of cycles (each cycle is array of transaction IDs)
	 * @private
	 */
	_detectCyclesInGraph (graph) {
		const visited = new Set();
		const recursionStack = new Set();
		const cycles = [];

		const dfs = (node, path) => {
			if (recursionStack.has(node)) {
				// Found a cycle
				const cycleStart = path.indexOf(node);
				const cycle = path.slice(cycleStart);
				cycles.push([...cycle, node]);

				return;
			}

			if (visited.has(node)) {
				return;
			}

			visited.add(node);
			recursionStack.add(node);
			path.push(node);

			const neighbors = graph.get(node) || new Set();
			for (const neighbor of neighbors) {
				dfs(neighbor, [...path]);
			}

			recursionStack.delete(node);
		};

		// Start DFS from each unvisited node
		for (const node of graph.keys()) {
			if (!visited.has(node)) {
				dfs(node, []);
			}
		}

		return cycles;
	}

	/**
	 * Detect cycles in resource allocation graph
	 * @param {Object} resourceGraph - Resource allocation graph
	 * @returns {Object[]} Array of resource-based cycles
	 * @private
	 */
	_detectCyclesInResourceGraph (resourceGraph) {
		const cycles = [];

		// Convert resource graph to wait-for graph
		const waitForGraph = new Map();

		for (const [txId] of resourceGraph.transactions) {
			waitForGraph.set(txId, new Set());
		}

		// Build wait-for relationships
		for (const [waitingTx, wantedResources] of resourceGraph.waiting) {
			for (const resource of wantedResources) {
				const holders = resourceGraph.resources.get(resource) || new Set();
				for (const holdingTx of holders) {
					if (waitingTx !== holdingTx) {
						waitForGraph.get(waitingTx).add(holdingTx);
					}
				}
			}
		}

		// Detect cycles in the converted graph
		const graphCycles = this._detectCyclesInGraph(waitForGraph);

		// Convert back to resource cycles
		for (const cycle of graphCycles) {
			const resources = this._getResourcesInvolvedInCycle(cycle,
				Array.from(resourceGraph.transactions.keys()).map(id => ({ id })));
			cycles.push({
				transactions: cycle,
				resources: Array.from(resources)
			});
		}

		return cycles;
	}

	/**
	 * Get resources involved in a deadlock cycle
	 * @param {string[]} cycle - Array of transaction IDs in cycle
	 * @param {Transaction[]|Object[]} transactions - Transaction objects or objects with id
	 * @returns {Set<string>} Set of resource keys involved
	 * @private
	 */
	_getResourcesInvolvedInCycle (cycle, transactions) {
		const resources = new Set();

		for (const txId of cycle) {
			const tx = transactions.find(t => t.id === txId);
			if (tx && tx.writeSet && tx.readSet) {
				for (const key of tx.writeSet) {
					resources.add(key);
				}
				for (const key of tx.readSet) {
					resources.add(key);
				}
			}
		}

		return resources;
	}

	/**
	 * Detect isolation-level based deadlocks
	 * @param {Transaction[]} activeTransactions - Active transactions
	 * @returns {Object[]} Array of suspected isolation deadlocks
	 * @private
	 */
	_detectIsolationDeadlocks (activeTransactions) {
		const suspectedDeadlocks = [];

		for (let i = 0; i < activeTransactions.length; i++) {
			for (let j = i + 1; j < activeTransactions.length; j++) {
				const tx1 = activeTransactions[i];
				const tx2 = activeTransactions[j];

				if (this._hasIsolationConflict(tx1, tx2)) {
					suspectedDeadlocks.push({
						type: "isolation",
						transactions: [tx1.id, tx2.id],
						conflict: this._getIsolationConflictType(tx1, tx2)
					});
				}
			}
		}

		return suspectedDeadlocks;
	}

	/**
	 * Check if two transactions have isolation conflicts
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @returns {boolean} True if isolation conflict exists
	 * @private
	 */
	_hasIsolationConflict (tx1, tx2) {
		if (tx1.isolationLevel >= IsolationLevels.REPEATABLE_READ ||
			tx2.isolationLevel >= IsolationLevels.REPEATABLE_READ) {

			const tx1ReadsWhatTx2Writes = this._readsOtherWrites(tx1, tx2);
			const tx2ReadsWhatTx1Writes = this._readsOtherWrites(tx2, tx1);

			return tx1ReadsWhatTx2Writes || tx2ReadsWhatTx1Writes;
		}

		return false;
	}

	/**
	 * Get the type of isolation conflict between transactions
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @returns {string} Conflict type description
	 * @private
	 */
	_getIsolationConflictType (tx1, tx2) {
		if (this._readsOtherWrites(tx1, tx2) && this._readsOtherWrites(tx2, tx1)) {
			return "bidirectional-dependency";
		} else if (this._readsOtherWrites(tx1, tx2)) {
			return "tx1-depends-on-tx2";
		} else if (this._readsOtherWrites(tx2, tx1)) {
			return "tx2-depends-on-tx1";
		}

		return "unknown";
	}

	/**
	 * Check if one transaction reads what another writes
	 * @param {Transaction} reader - Reading transaction
	 * @param {Transaction} writer - Writing transaction
	 * @returns {boolean} True if dependency exists
	 * @private
	 */
	_readsOtherWrites (reader, writer) {
		for (const readKey of reader.readSet) {
			if (writer.writeSet.has(readKey)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Detect timeout-based deadlock victims
	 * @param {Transaction[]} activeTransactions - Active transactions
	 * @param {number} timeoutThreshold - Timeout threshold in milliseconds
	 * @returns {string[]} Transaction IDs that have timed out
	 * @private
	 */
	_detectTimeoutVictims (activeTransactions, timeoutThreshold) {
		const victims = [];

		for (const transaction of activeTransactions) {
			const duration = transaction.getDuration();
			if (duration !== null && duration > timeoutThreshold) {
				victims.push(transaction.id);
			}
		}

		return victims;
	}

	/**
	 * Remove duplicate deadlocks from results
	 * @param {Object[]} deadlocks - Array of deadlock objects
	 * @returns {Object[]} Deduplicated deadlocks
	 * @private
	 */
	_deduplicateDeadlocks (deadlocks) {
		const seen = new Set();
		const unique = [];

		for (const deadlock of deadlocks) {
			const signature = this._createDeadlockSignature(deadlock);

			if (!seen.has(signature)) {
				seen.add(signature);
				unique.push(deadlock);
			}
		}

		return unique;
	}

	/**
	 * Create a normalized signature for a deadlock
	 * @param {Object} deadlock - Deadlock object
	 * @returns {string} Normalized signature
	 * @private
	 */
	_createDeadlockSignature (deadlock) {
		const sortedTransactions = [...deadlock.transactions].sort();
		const sortedResources = deadlock.resources ? [...deadlock.resources].sort() : [];

		return `${deadlock.type}:${sortedTransactions.join(",")}:${sortedResources.join(",")}`;
	}
}
