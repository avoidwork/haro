import { TransactionError, ConcurrencyError } from "./errors.js";
import { randomUUID as uuid } from "crypto";

/**
 * Transaction states
 */
export const TransactionStates = {
	PENDING: "pending",
	ACTIVE: "active",
	COMMITTED: "committed",
	ABORTED: "aborted"
};

/**
 * Operation types for transaction log
 */
export const OperationTypes = {
	SET: "set",
	DELETE: "delete",
	BATCH: "batch"
};

/**
 * Transaction operation entry
 */
export class TransactionOperation {
	/**
	 * @param {string} type - Operation type
	 * @param {string} key - Record key
	 * @param {*} [oldValue] - Previous value (for rollback)
	 * @param {*} [newValue] - New value
	 * @param {Object} [metadata={}] - Additional metadata
	 */
	constructor (type, key, oldValue, newValue, metadata = {}) {
		this.id = uuid();
		this.type = type;
		this.key = key;
		this.oldValue = oldValue;
		this.newValue = newValue;
		this.metadata = metadata;
		this.timestamp = new Date();

		Object.freeze(this);
	}

	/**
	 * Create rollback operation
	 * @returns {TransactionOperation} Rollback operation
	 */
	createRollback () {
		switch (this.type) {
			case OperationTypes.SET:
				return this.oldValue === undefined ?
					new TransactionOperation(OperationTypes.DELETE, this.key, this.newValue, undefined) :
					new TransactionOperation(OperationTypes.SET, this.key, this.newValue, this.oldValue);

			case OperationTypes.DELETE:
				return new TransactionOperation(OperationTypes.SET, this.key, undefined, this.oldValue);

			default:
				throw new TransactionError(`Cannot create rollback for operation type: ${this.type}`, null, "rollback");
		}
	}
}

/**
 * Transaction isolation levels
 */
export const IsolationLevels = {
	READ_UNCOMMITTED: 0,
	READ_COMMITTED: 1,
	REPEATABLE_READ: 2,
	SERIALIZABLE: 3
};

/**
 * Lock types for concurrency control
 */
export const LockTypes = {
	SHARED: "shared",
	EXCLUSIVE: "exclusive"
};

/**
 * Lock manager for controlling concurrent access
 */
export class LockManager {
	constructor () {
		// Map<recordKey, {type: string, holders: Set<transactionId>, waiters: Array}>
		this.locks = new Map();
		this.lockTimeout = 30000; // 30 seconds default
	}

	/**
	 * Acquire a lock on a record
	 * @param {string} transactionId - Transaction ID
	 * @param {string} recordKey - Record key to lock
	 * @param {string} lockType - Type of lock (shared/exclusive)
	 * @param {number} [timeout] - Lock timeout in milliseconds
	 * @returns {Promise<boolean>} True if lock acquired
	 * @throws {ConcurrencyError} If lock cannot be acquired
	 */
	async acquireLock (transactionId, recordKey, lockType, timeout = this.lockTimeout) {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			if (this._tryAcquireLock(transactionId, recordKey, lockType)) {
				return true;
			}

			// Wait a bit before retrying
			await new Promise(resolve => setTimeout(resolve, 10));
		}

		throw new ConcurrencyError(
			`Failed to acquire ${lockType} lock on record '${recordKey}' within timeout`,
			recordKey,
			"lock"
		);
	}

	/**
	 * Try to acquire lock immediately
	 * @param {string} transactionId - Transaction ID
	 * @param {string} recordKey - Record key
	 * @param {string} lockType - Lock type
	 * @returns {boolean} True if lock acquired
	 * @private
	 */
	_tryAcquireLock (transactionId, recordKey, lockType) {
		const existingLock = this.locks.get(recordKey);

		if (!existingLock) {
			// No existing lock, create new one
			this.locks.set(recordKey, {
				type: lockType,
				holders: new Set([transactionId]),
				waiters: []
			});

			return true;
		}

		// Check if already holding the lock
		if (existingLock.holders.has(transactionId)) {
			// Check for lock upgrade
			if (existingLock.type === LockTypes.SHARED && lockType === LockTypes.EXCLUSIVE) {
				// Can upgrade if we're the only holder
				if (existingLock.holders.size === 1) {
					existingLock.type = LockTypes.EXCLUSIVE;

					return true;
				}

				return false; // Cannot upgrade with other holders
			}

			return true; // Already have compatible lock
		}

		// Check compatibility
		if (lockType === LockTypes.SHARED && existingLock.type === LockTypes.SHARED) {
			// Shared locks are compatible
			existingLock.holders.add(transactionId);

			return true;
		}

		// Exclusive locks or mixed locks are not compatible
		return false;
	}

	/**
	 * Release a lock
	 * @param {string} transactionId - Transaction ID
	 * @param {string} recordKey - Record key
	 * @returns {boolean} True if lock was released
	 */
	releaseLock (transactionId, recordKey) {
		const lock = this.locks.get(recordKey);
		if (!lock || !lock.holders.has(transactionId)) {
			return false;
		}

		lock.holders.delete(transactionId);

		// If no more holders, remove the lock
		if (lock.holders.size === 0) {
			this.locks.delete(recordKey);
		}

		return true;
	}

	/**
	 * Release all locks held by a transaction
	 * @param {string} transactionId - Transaction ID
	 * @returns {number} Number of locks released
	 */
	releaseAllLocks (transactionId) {
		let released = 0;

		for (const [recordKey, lock] of this.locks) {
			if (lock.holders.has(transactionId)) {
				lock.holders.delete(transactionId);
				released++;

				// If no more holders, remove the lock
				if (lock.holders.size === 0) {
					this.locks.delete(recordKey);
				}
			}
		}

		return released;
	}

	/**
	 * Check if transaction holds any locks
	 * @param {string} transactionId - Transaction ID
	 * @returns {boolean} True if transaction holds locks
	 */
	holdsLocks (transactionId) {
		for (const lock of this.locks.values()) {
			if (lock.holders.has(transactionId)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get lock statistics
	 * @returns {Object} Lock statistics
	 */
	getStats () {
		const stats = {
			totalLocks: this.locks.size,
			sharedLocks: 0,
			exclusiveLocks: 0,
			lockHolders: new Set(),
			recordsLocked: []
		};

		for (const [recordKey, lock] of this.locks) {
			if (lock.type === LockTypes.SHARED) {
				stats.sharedLocks++;
			} else {
				stats.exclusiveLocks++;
			}

			for (const holder of lock.holders) {
				stats.lockHolders.add(holder);
			}

			stats.recordsLocked.push({
				recordKey,
				type: lock.type,
				holders: Array.from(lock.holders)
			});
		}

		stats.uniqueHolders = stats.lockHolders.size;

		return stats;
	}
}

/**
 * Transaction implementation with ACID properties
 */
export class Transaction {
	/**
	 * @param {string} [id] - Transaction ID (auto-generated if not provided)
	 * @param {Object} [options={}] - Transaction options
	 * @param {number} [options.isolationLevel=IsolationLevels.READ_COMMITTED] - Isolation level
	 * @param {number} [options.timeout=60000] - Transaction timeout in milliseconds
	 * @param {boolean} [options.readOnly=false] - Whether transaction is read-only
	 */
	constructor (id = uuid(), options = {}) {
		this.id = id;
		this.state = TransactionStates.PENDING;
		this.isolationLevel = options.isolationLevel || IsolationLevels.READ_COMMITTED;
		this.timeout = options.timeout || 60000;
		this.readOnly = options.readOnly || false;
		this.startTime = null;
		this.endTime = null;

		// Operation log for rollback
		this.operations = [];

		// Read set for isolation (record keys read during transaction)
		this.readSet = new Set();

		// Write set for isolation (record keys written during transaction)
		this.writeSet = new Set();

		// Snapshot for repeatable read isolation
		this.snapshot = new Map();

		// Validation callback for custom constraints
		this.validationCallback = null;

		// Abort reason (set when transaction is aborted)
		this.abortReason = null;

		Object.seal(this);
	}

	/**
	 * Begin the transaction
	 * @returns {Transaction} This transaction for chaining
	 * @throws {TransactionError} If transaction is already active
	 */
	begin () {
		if (this.state !== TransactionStates.PENDING) {
			throw new TransactionError(
				`Cannot begin transaction in state: ${this.state}`,
				this.id,
				"begin"
			);
		}

		this.state = TransactionStates.ACTIVE;
		this.startTime = new Date();

		return this;
	}

	/**
	 * Add an operation to the transaction log
	 * @param {string} type - Operation type
	 * @param {string} key - Record key
	 * @param {*} [oldValue] - Previous value
	 * @param {*} [newValue] - New value
	 * @param {Object} [metadata={}] - Additional metadata
	 * @returns {TransactionOperation} Created operation
	 * @throws {TransactionError} If transaction is not active or is read-only
	 */
	addOperation (type, key, oldValue, newValue, metadata = {}) {
		this._checkActive();

		if (this.readOnly && type !== "read") {
			throw new TransactionError(
				"Cannot perform write operations in read-only transaction",
				this.id,
				"write"
			);
		}

		// Check timeout
		if (this._isTimedOut()) {
			throw new TransactionError(
				"Transaction has timed out",
				this.id,
				"timeout"
			);
		}

		const operation = new TransactionOperation(type, key, oldValue, newValue, metadata);
		this.operations.push(operation);

		// Track read and write sets
		if (type === "read") {
			this.readSet.add(key);
		} else {
			this.writeSet.add(key);
		}

		return operation;
	}

	/**
	 * Set validation callback for custom constraints
	 * @param {Function} callback - Validation function
	 * @returns {Transaction} This transaction for chaining
	 */
	setValidation (callback) {
		this.validationCallback = callback;

		return this;
	}

	/**
	 * Validate transaction before commit
	 * @param {Object} [context] - Validation context
	 * @returns {boolean} True if validation passes
	 * @throws {TransactionError} If validation fails
	 */
	validate (context = {}) {
		if (this.validationCallback) {
			const result = this.validationCallback(this, context);
			if (result !== true) {
				const message = typeof result === "string" ? result : "Transaction validation failed";
				throw new TransactionError(message, this.id, "validation");
			}
		}

		return true;
	}

	/**
	 * Commit the transaction
	 * @param {Object} [context] - Commit context
	 * @returns {Transaction} This transaction for chaining
	 * @throws {TransactionError} If commit fails
	 */
	commit (context = {}) {
		this._checkActive();

		try {
			// Validate before commit
			this.validate(context);

			this.state = TransactionStates.COMMITTED;
			this.endTime = new Date();

			return this;
		} catch (error) {
			// Auto-abort on commit failure
			this.abort();
			throw error;
		}
	}

	/**
	 * Abort the transaction
	 * @param {string} [reason] - Reason for abort
	 * @returns {Transaction} This transaction for chaining
	 */
	abort (reason = "User abort") {
		if (this.state === TransactionStates.ABORTED || this.state === TransactionStates.COMMITTED) {
			return this;
		}

		this.state = TransactionStates.ABORTED;
		this.endTime = new Date();
		this.abortReason = reason;

		return this;
	}

	/**
	 * Get rollback operations (in reverse order)
	 * @returns {TransactionOperation[]} Array of rollback operations
	 */
	getRollbackOperations () {
		return this.operations
			.slice()
			.reverse()
			.filter(op => op.type !== "read") // Filter out read operations
			.map(op => op.createRollback())
			.filter(op => op !== null);
	}

	/**
	 * Check if transaction is active
	 * @returns {boolean} True if transaction is active
	 */
	isActive () {
		return this.state === TransactionStates.ACTIVE;
	}

	/**
	 * Check if transaction is committed
	 * @returns {boolean} True if transaction is committed
	 */
	isCommitted () {
		return this.state === TransactionStates.COMMITTED;
	}

	/**
	 * Check if transaction is aborted
	 * @returns {boolean} True if transaction is aborted
	 */
	isAborted () {
		return this.state === TransactionStates.ABORTED;
	}

	/**
	 * Get transaction duration
	 * @returns {number|null} Duration in milliseconds, null if not completed
	 */
	getDuration () {
		if (!this.startTime) return null;
		const endTime = this.endTime || new Date();

		return endTime.getTime() - this.startTime.getTime();
	}

	/**
	 * Get transaction statistics
	 * @returns {Object} Transaction statistics
	 */
	getStats () {
		return {
			id: this.id,
			state: this.state,
			isolationLevel: this.isolationLevel,
			readOnly: this.readOnly,
			startTime: this.startTime,
			endTime: this.endTime,
			duration: this.getDuration(),
			operationCount: this.operations.length,
			readSetSize: this.readSet.size,
			writeSetSize: this.writeSet.size,
			snapshotSize: this.snapshot.size,
			abortReason: this.abortReason,
			timedOut: this._isTimedOut()
		};
	}

	/**
	 * Export transaction for debugging/logging
	 * @returns {Object} Exportable transaction data
	 */
	export () {
		return {
			...this.getStats(),
			operations: this.operations.map(op => ({
				id: op.id,
				type: op.type,
				key: op.key,
				timestamp: op.timestamp,
				metadata: op.metadata
			})),
			readSet: Array.from(this.readSet),
			writeSet: Array.from(this.writeSet)
		};
	}

	/**
	 * Check if transaction is active and throw if not
	 * @throws {TransactionError} If transaction is not active
	 * @private
	 */
	_checkActive () {
		if (this.state !== TransactionStates.ACTIVE) {
			throw new TransactionError(
				`Transaction is not active (current state: ${this.state})`,
				this.id,
				"state"
			);
		}
	}

	/**
	 * Check if transaction has timed out
	 * @returns {boolean} True if timed out
	 * @private
	 */
	_isTimedOut () {
		if (!this.startTime) return false;

		return Date.now() - this.startTime.getTime() > this.timeout;
	}
}

/**
 * Transaction manager for coordinating multiple transactions
 */
export class TransactionManager {
	constructor () {
		// Active transactions
		this.transactions = new Map();

		// Lock manager for concurrency control
		this.lockManager = new LockManager();

		// Global transaction counter
		this.transactionCounter = 0;

		// Statistics
		this.stats = {
			totalTransactions: 0,
			committedTransactions: 0,
			abortedTransactions: 0,
			activeTransactions: 0,
			averageDuration: 0,
			totalDuration: 0
		};
	}

	/**
	 * Begin a new transaction
	 * @param {Object} [options={}] - Transaction options
	 * @returns {Transaction} New transaction instance
	 */
	begin (options = {}) {
		const transaction = new Transaction(undefined, options);
		transaction.begin();

		this.transactions.set(transaction.id, transaction);
		this.transactionCounter++;
		this.stats.totalTransactions++;
		this.stats.activeTransactions++;

		return transaction;
	}

	/**
	 * Get transaction by ID
	 * @param {string} transactionId - Transaction ID
	 * @returns {Transaction|undefined} Transaction instance
	 */
	getTransaction (transactionId) {
		return this.transactions.get(transactionId);
	}

	/**
	 * Commit a transaction
	 * @param {string} transactionId - Transaction ID
	 * @param {Object} [context] - Commit context
	 * @returns {Transaction} Committed transaction
	 * @throws {TransactionError} If transaction not found or commit fails
	 */
	async commit (transactionId, context = {}) {
		const transaction = this.transactions.get(transactionId);
		if (!transaction) {
			throw new TransactionError(`Transaction ${transactionId} not found`, transactionId, "commit");
		}

		try {
			// Acquire locks for all writes
			for (const key of transaction.writeSet) {
				await this.lockManager.acquireLock(transactionId, key, LockTypes.EXCLUSIVE);
			}

			// Perform isolation level checks
			this._validateIsolation(transaction);

			// Commit the transaction
			transaction.commit(context);

			// Update statistics
			this.stats.committedTransactions++;
			this.stats.activeTransactions--;
			this._updateDurationStats(transaction);

			return transaction;
		} catch (error) {
			// Auto-abort on failure
			this.abort(transactionId, error.message);
			throw error;
		} finally {
			// Always release locks
			this.lockManager.releaseAllLocks(transactionId);
		}
	}

	/**
	 * Abort a transaction
	 * @param {string} transactionId - Transaction ID
	 * @param {string} [reason] - Reason for abort
	 * @returns {Transaction} Aborted transaction
	 * @throws {TransactionError} If transaction not found
	 */
	abort (transactionId, reason = "Manual abort") {
		const transaction = this.transactions.get(transactionId);
		if (!transaction) {
			throw new TransactionError(`Transaction ${transactionId} not found`, transactionId, "abort");
		}

		transaction.abort(reason);

		// Release all locks
		this.lockManager.releaseAllLocks(transactionId);

		// Update statistics
		this.stats.abortedTransactions++;
		this.stats.activeTransactions--;
		this._updateDurationStats(transaction);

		return transaction;
	}

	/**
	 * Clean up completed transactions
	 * @param {number} [maxAge=3600000] - Maximum age in milliseconds (default: 1 hour)
	 * @returns {number} Number of transactions cleaned up
	 */
	cleanup (maxAge = 3600000) {
		const cutoffTime = Date.now() - maxAge;
		let cleaned = 0;

		for (const [id, transaction] of this.transactions) {
			if (transaction.endTime && transaction.endTime.getTime() < cutoffTime) {
				this.transactions.delete(id);
				cleaned++;
			}
		}

		return cleaned;
	}

	/**
	 * Get all active transactions
	 * @returns {Transaction[]} Array of active transactions
	 */
	getActiveTransactions () {
		return Array.from(this.transactions.values()).filter(t => t.isActive());
	}

	/**
	 * Check for deadlocks using multiple detection strategies
	 * @param {Object} [options={}] - Detection options
	 * @param {boolean} [options.useLockGraph=true] - Use lock-based wait-for graph
	 * @param {boolean} [options.useResourceGraph=true] - Use resource allocation graph
	 * @param {boolean} [options.useTimeoutDetection=true] - Use timeout-based detection
	 * @param {number} [options.timeoutThreshold=10000] - Timeout threshold in ms
	 * @returns {Object} Deadlock detection results
	 */
	detectDeadlocks (options = {}) {
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

		const activeTransactions = this.getActiveTransactions();
		if (activeTransactions.length < 2) {
			return results; // Need at least 2 transactions for deadlock
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
				resources: this._getResourcesInvolvedInCycle(cycle)
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
			const { recordKey, type: lockType, holders } = lockInfo;

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
			// Check if transaction has operations on this key but doesn't hold the lock
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
		const visited = new Set();

		// Convert resource graph to wait-for graph
		const waitForGraph = new Map();

		for (const [txId] of resourceGraph.transactions) {
			waitForGraph.set(txId, new Set());
		}

		// Build wait-for relationships: tx1 waits for tx2 if
		// tx1 wants resource R and tx2 holds resource R
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
			const resources = this._getResourcesInvolvedInCycle(cycle);
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
	 * @returns {Set<string>} Set of resource keys involved
	 * @private
	 */
	_getResourcesInvolvedInCycle (cycle) {
		const resources = new Set();

		for (const txId of cycle) {
			const tx = this.transactions.get(txId);
			if (tx) {
				// Add all resources this transaction is working with
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

		// Look for transactions with conflicting isolation requirements
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
		// Check for read-write conflicts at different isolation levels
		if (tx1.isolationLevel >= IsolationLevels.REPEATABLE_READ ||
			tx2.isolationLevel >= IsolationLevels.REPEATABLE_READ) {

			// Check for overlapping read/write sets
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
			// Create a normalized signature for the deadlock
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

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		return {
			...this.stats,
			activeTransactions: this.getActiveTransactions().length,
			lockStats: this.lockManager.getStats(),
			transactionCounter: this.transactionCounter
		};
	}

	/**
	 * Validate isolation level requirements
	 * @param {Transaction} transaction - Transaction to validate
	 * @throws {TransactionError} If isolation violation detected
	 * @private
	 */
	_validateIsolation (transaction) {
		switch (transaction.isolationLevel) {
			case IsolationLevels.READ_UNCOMMITTED:
				// No validation needed - allows dirty reads
				break;

			case IsolationLevels.READ_COMMITTED:
				this._validateReadCommitted(transaction);
				break;

			case IsolationLevels.REPEATABLE_READ:
				this._validateRepeatableRead(transaction);
				break;

			case IsolationLevels.SERIALIZABLE:
				this._validateSerializable(transaction);
				break;

			default:
				throw new TransactionError(
					`Unknown isolation level: ${transaction.isolationLevel}`,
					transaction.id,
					"isolation"
				);
		}
	}

	/**
	 * Validate READ_COMMITTED isolation level
	 * Ensures transaction only reads committed data
	 * @param {Transaction} transaction - Transaction to validate
	 * @throws {TransactionError} If isolation violation detected
	 * @private
	 */
	_validateReadCommitted (transaction) {
		// For READ_COMMITTED, we need to ensure that any data read during
		// the transaction was committed at the time of reading
		// Since we don't track uncommitted changes in this implementation,
		// this is automatically satisfied

		// Check for write-write conflicts
		for (const writeKey of transaction.writeSet) {
			const conflictingTransactions = this._findConflictingWrites(transaction.id, writeKey);
			if (conflictingTransactions.length > 0) {
				throw new TransactionError(
					`Write conflict detected on key '${writeKey}' with transactions: ${conflictingTransactions.join(", ")}`,
					transaction.id,
					"write-conflict"
				);
			}
		}
	}

	/**
	 * Validate REPEATABLE_READ isolation level
	 * Ensures transaction sees consistent snapshot of data
	 * @param {Transaction} transaction - Transaction to validate
	 * @throws {TransactionError} If isolation violation detected
	 * @private
	 */
	_validateRepeatableRead (transaction) {
		// First validate READ_COMMITTED requirements
		this._validateReadCommitted(transaction);

		// For REPEATABLE_READ, ensure that any records read during the transaction
		// haven't been modified by other committed transactions since the read
		for (const readKey of transaction.readSet) {
			if (this._hasReadSetConflict(transaction, readKey)) {
				throw new TransactionError(
					`Repeatable read violation: key '${readKey}' was modified by another transaction`,
					transaction.id,
					"repeatable-read-violation"
				);
			}
		}

		// Check for phantom reads in range queries (simplified check)
		if (transaction.snapshot.size > 0) {
			for (const [snapshotKey, snapshotValue] of transaction.snapshot) {
				if (this._hasSnapshotConflict(transaction, snapshotKey, snapshotValue)) {
					throw new TransactionError(
						`Phantom read detected: snapshot inconsistency for key '${snapshotKey}'`,
						transaction.id,
						"phantom-read"
					);
				}
			}
		}
	}

	/**
	 * Validate SERIALIZABLE isolation level
	 * Ensures complete transaction isolation
	 * @param {Transaction} transaction - Transaction to validate
	 * @throws {TransactionError} If isolation violation detected
	 * @private
	 */
	_validateSerializable (transaction) {
		// First validate REPEATABLE_READ requirements
		this._validateRepeatableRead(transaction);

		// For SERIALIZABLE, we need to detect any potential serialization conflicts
		// This includes read-write conflicts where this transaction read something
		// that another concurrent transaction modified

		// Check for read-write conflicts
		for (const readKey of transaction.readSet) {
			const conflictingWrites = this._findConflictingWritesToRead(transaction, readKey);
			if (conflictingWrites.length > 0) {
				throw new TransactionError(
					`Serialization conflict: key '${readKey}' was written by concurrent transactions: ${conflictingWrites.join(", ")}`,
					transaction.id,
					"serialization-conflict"
				);
			}
		}

		// Check for write-read conflicts where this transaction wrote something
		// that another concurrent transaction read
		for (const writeKey of transaction.writeSet) {
			const conflictingReads = this._findConflictingReadsToWrite(transaction, writeKey);
			if (conflictingReads.length > 0) {
				throw new TransactionError(
					`Serialization conflict: key '${writeKey}' was read by concurrent transactions: ${conflictingReads.join(", ")}`,
					transaction.id,
					"serialization-conflict"
				);
			}
		}
	}

	/**
	 * Find transactions that have conflicting writes to the same key
	 * @param {string} excludeTransactionId - Transaction ID to exclude from search
	 * @param {string} key - Key to check for conflicts
	 * @returns {string[]} Array of conflicting transaction IDs
	 * @private
	 */
	_findConflictingWrites (excludeTransactionId, key) {
		const conflicting = [];

		for (const [txId, transaction] of this.transactions) {
			if (txId !== excludeTransactionId &&
				transaction.isActive() &&
				transaction.writeSet.has(key)) {
				conflicting.push(txId);
			}
		}

		return conflicting;
	}

	/**
	 * Check if a read key has conflicts with other transactions
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Key that was read
	 * @returns {boolean} True if conflict detected
	 * @private
	 */
	_hasReadSetConflict (transaction, key) {
		// Check if any other transaction that started after this one
		// and committed before this commit attempt has modified this key
		for (const [txId, otherTx] of this.transactions) {
			if (txId !== transaction.id &&
				otherTx.isCommitted() &&
				otherTx.writeSet.has(key) &&
				otherTx.startTime > transaction.startTime &&
				otherTx.endTime < new Date()) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if snapshot has conflicts indicating phantom reads
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Snapshot key
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if conflict detected
	 * @private
	 */
	_hasSnapshotConflict (transaction, key, expectedValue) {
		// Check for phantom reads by detecting if the snapshot is inconsistent
		// with what other concurrent transactions have done

		// 1. Check if any other transaction modified this specific key
		if (this._hasReadSetConflict(transaction, key)) {
			return true;
		}

		// 2. Check for phantom reads in range-based operations
		// Look for transactions that might have added/removed records that would
		// affect the snapshot consistency
		for (const [txId, otherTx] of this.transactions) {
			if (txId === transaction.id || !this._transactionsOverlap(transaction, otherTx)) {
				continue;
			}

			// Check if other transaction has operations that could create phantom reads
			if (this._hasPhantomConflict(transaction, otherTx, key, expectedValue)) {
				return true;
			}
		}

		// 3. Check for serialization anomalies specific to snapshots
		// This detects cases where the snapshot assumption is violated by
		// concurrent transaction effects
		if (this._hasSerializationAnomalyInSnapshot(transaction, key, expectedValue)) {
			return true;
		}

		return false;
	}

	/**
	 * Check if another transaction creates phantom reads for this transaction's snapshot
	 * @param {Transaction} transaction - Transaction with snapshot
	 * @param {Transaction} otherTransaction - Other concurrent transaction
	 * @param {string} key - Snapshot key
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if phantom conflict detected
	 * @private
	 */
	_hasPhantomConflict (transaction, otherTransaction, key, expectedValue) {
		// Check if the other transaction has operations that could affect
		// the snapshot's validity through phantom reads

		for (const operation of otherTransaction.operations) {
			// Skip read operations as they don't create phantoms
			if (operation.type === "read") {
				continue;
			}

			// Check for direct key conflicts
			if (operation.key === key) {
				// Direct modification of snapshot key by concurrent transaction
				return true;
			}

			// Check for range-based phantom conflicts
			// This is a simplified check - in a real implementation you would
			// need to understand the query predicates that created the snapshot
			if (this._isKeyInSnapshotRange(transaction, operation.key, key, expectedValue)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if a key falls within the range that could affect a snapshot
	 * @param {Transaction} transaction - Transaction with snapshot
	 * @param {string} operationKey - Key from other transaction's operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if operation key could affect snapshot
	 * @private
	 */
	_isKeyInSnapshotRange (transaction, operationKey, snapshotKey, expectedValue) {
		// Simplified range check for phantom read detection
		// In a real implementation, this would use actual query predicates
		// and index ranges that were used to create the snapshot

		// Check if this is a range-based snapshot (indicated by special metadata)
		if (transaction.snapshot.has(`${snapshotKey}:range`)) {
			// Get range information from snapshot metadata
			const rangeInfo = transaction.snapshot.get(`${snapshotKey}:range`);
			if (rangeInfo && typeof rangeInfo === "object") {
				return this._keyMatchesRange(operationKey, rangeInfo);
			}
		}

		// For non-range snapshots, check for prefix-based conflicts
		// This handles cases where snapshot keys represent collections or patterns
		if (snapshotKey.includes("*") || snapshotKey.includes(":")) {
			const pattern = snapshotKey.replace("*", "");

			return operationKey.startsWith(pattern);
		}

		// Default: only direct key matches affect snapshot
		return operationKey === snapshotKey;
	}

	/**
	 * Check if a key matches a range specification
	 * @param {string} key - Key to check
	 * @param {Object} range - Range specification
	 * @returns {boolean} True if key is in range
	 * @private
	 */
	_keyMatchesRange (key, range) {
		// Handle different types of range specifications
		if (range.min !== undefined && range.max !== undefined) {
			// Numeric or lexicographic range
			return key >= range.min && key <= range.max;
		}

		if (range.prefix !== undefined) {
			// Prefix-based range
			return key.startsWith(range.prefix);
		}

		if (range.pattern !== undefined) {
			// Pattern-based range (simplified regex-like matching)
			try {
				const regex = new RegExp(range.pattern);

				return regex.test(key);
			} catch {
				// Fallback for invalid patterns
				return false;
			}
		}

		// Default: no match
		return false;
	}

	/**
	 * Check for serialization anomalies in snapshot data
	 * @param {Transaction} transaction - Transaction with snapshot
	 * @param {string} key - Snapshot key
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if serialization anomaly detected
	 * @private
	 */
	_hasSerializationAnomalyInSnapshot (transaction, key, expectedValue) {
		// Check for serialization anomalies that violate snapshot isolation
		// This includes detecting when the snapshot assumption leads to
		// non-serializable execution

		// Look for write-skew anomalies where two transactions read overlapping
		// data and write to disjoint sets, but their combined effect violates
		// the snapshot assumption
		for (const [txId, otherTx] of this.transactions) {
			if (txId === transaction.id ||
				!otherTx.isActive() ||
				!this._transactionsOverlap(transaction, otherTx)) {
				continue;
			}

			// Check for write-skew: both transactions read similar data
			// but write to different keys
			if (this._hasWriteSkewAnomaly(transaction, otherTx, key, expectedValue)) {
				return true;
			}

			// Check for read-write dependency cycles that violate
			// snapshot isolation guarantees
			if (this._hasDependencyCycle(transaction, otherTx, key)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check for write-skew anomalies between transactions
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @param {string} key - Key being checked
	 * @param {*} expectedValue - Expected value
	 * @returns {boolean} True if write-skew detected
	 * @private
	 */
	_hasWriteSkewAnomaly (tx1, tx2, key, expectedValue) {
		// Write-skew occurs when:
		// 1. Both transactions read overlapping data
		// 2. Both transactions write to disjoint sets
		// 3. The combined writes violate constraints that depend on the read data

		// Check if both transactions have read operations on related keys
		const tx1ReadsRelated = this._hasRelatedReads(tx1, key);
		const tx2ReadsRelated = this._hasRelatedReads(tx2, key);

		if (!tx1ReadsRelated || !tx2ReadsRelated) {
			return false;
		}

		// Check if they write to disjoint sets
		const tx1Writes = Array.from(tx1.writeSet);
		const tx2Writes = Array.from(tx2.writeSet);
		const hasOverlappingWrites = tx1Writes.some(k => tx2Writes.includes(k));

		if (hasOverlappingWrites) {
			return false; // Not write-skew if they write to same keys
		}

		// Simplified check: if both have writes and read related data,
		// consider it a potential write-skew scenario
		return tx1Writes.length > 0 && tx2Writes.length > 0;
	}

	/**
	 * Check if transaction has reads related to a key
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Reference key
	 * @returns {boolean} True if has related reads
	 * @private
	 */
	_hasRelatedReads (transaction, key) {
		// Check if transaction has read operations on keys related to the given key
		for (const readKey of transaction.readSet) {
			if (this._areKeysRelated(readKey, key)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if two keys are related (for dependency analysis)
	 * @param {string} key1 - First key
	 * @param {string} key2 - Second key
	 * @returns {boolean} True if keys are related
	 * @private
	 */
	_areKeysRelated (key1, key2) {
		// Simplified relationship check
		// In a real implementation, this would understand data relationships

		// Direct match
		if (key1 === key2) {
			return true;
		}

		// Prefix relationship (e.g., "user:123" and "user:123:profile")
		if (key1.startsWith(key2) || key2.startsWith(key1)) {
			return true;
		}

		// Same entity type (e.g., "user:123" and "user:456")
		const type1 = key1.split(":")[0];
		const type2 = key2.split(":")[0];
		if (type1 === type2) {
			return true;
		}

		return false;
	}

	/**
	 * Check for dependency cycles between transactions
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @param {string} key - Key being checked
	 * @returns {boolean} True if dependency cycle detected
	 * @private
	 */
	_hasDependencyCycle (tx1, tx2, key) {
		// Check for read-write dependency cycles that could violate
		// snapshot isolation

		// tx1 reads what tx2 writes AND tx2 reads what tx1 writes
		const tx1ReadsTx2Writes = this._readsOtherWrites(tx1, tx2);
		const tx2ReadsTx1Writes = this._readsOtherWrites(tx2, tx1);

		return tx1ReadsTx2Writes && tx2ReadsTx1Writes;
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
	 * Find transactions that wrote to a key this transaction read
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Key that was read
	 * @returns {string[]} Array of conflicting transaction IDs
	 * @private
	 */
	_findConflictingWritesToRead (transaction, key) {
		const conflicting = [];

		for (const [txId, otherTx] of this.transactions) {
			if (txId !== transaction.id &&
				otherTx.isActive() &&
				otherTx.writeSet.has(key) &&
				this._transactionsOverlap(transaction, otherTx)) {
				conflicting.push(txId);
			}
		}

		return conflicting;
	}

	/**
	 * Find transactions that read a key this transaction wrote
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Key that was written
	 * @returns {string[]} Array of conflicting transaction IDs
	 * @private
	 */
	_findConflictingReadsToWrite (transaction, key) {
		const conflicting = [];

		for (const [txId, otherTx] of this.transactions) {
			if (txId !== transaction.id &&
				otherTx.isActive() &&
				otherTx.readSet.has(key) &&
				this._transactionsOverlap(transaction, otherTx)) {
				conflicting.push(txId);
			}
		}

		return conflicting;
	}

	/**
	 * Check if two transactions have overlapping execution periods
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @returns {boolean} True if transactions overlap in time
	 * @private
	 */
	_transactionsOverlap (tx1, tx2) {
		if (!tx1.startTime || !tx2.startTime) {
			return false;
		}

		const tx1Start = tx1.startTime.getTime();
		const tx1End = tx1.endTime ? tx1.endTime.getTime() : Date.now();
		const tx2Start = tx2.startTime.getTime();
		const tx2End = tx2.endTime ? tx2.endTime.getTime() : Date.now();

		// Two transactions overlap if one starts before the other ends
		return tx1Start < tx2End && tx2Start < tx1End;
	}

	/**
	 * Update duration statistics
	 * @param {Transaction} transaction - Completed transaction
	 * @private
	 */
	_updateDurationStats (transaction) {
		const duration = transaction.getDuration();
		if (duration !== null) {
			this.stats.totalDuration += duration;
			const completedTransactions = this.stats.committedTransactions + this.stats.abortedTransactions;
			this.stats.averageDuration = this.stats.totalDuration / completedTransactions;
		}
	}
}
