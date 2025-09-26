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
	 * Check for deadlocks (simplified detection)
	 * @returns {string[]} Array of transaction IDs involved in potential deadlocks
	 */
	detectDeadlocks () {
		// Simplified deadlock detection - in a real implementation,
		// you would build a wait-for graph and detect cycles
		const deadlocked = [];
		const activeTransactions = this.getActiveTransactions();

		// Look for transactions that have been waiting too long
		const longWaitThreshold = 10000; // 10 seconds

		for (const transaction of activeTransactions) {
			if (transaction.getDuration() > longWaitThreshold) {
				deadlocked.push(transaction.id);
			}
		}

		return deadlocked;
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
		// Isolation validation would be implemented here
		// For now, we'll keep it simple
		if (transaction.isolationLevel >= IsolationLevels.REPEATABLE_READ) {
			// Check if any records in read set have been modified
			// This would require tracking global version numbers
		}
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
