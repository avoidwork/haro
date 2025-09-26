import { TransactionError } from "./errors.js";
import { LockTypes } from "./constants.js";
import { Transaction } from "./transaction-individual.js";
import { LockManager } from "./lock-manager.js";
import { TransactionStatistics } from "./transaction-statistics.js";
import { DeadlockDetector } from "./deadlock-detector.js";
import { IsolationValidator } from "./isolation-validator.js";

/**
 * Refactored transaction manager for coordinating multiple transactions
 * Delegates complex operations to specialized classes
 */
export class TransactionManager {
	constructor () {
		// Active transactions
		this.transactions = new Map();

		// Lock manager for concurrency control
		this.lockManager = new LockManager();

		// Global transaction counter
		this.transactionCounter = 0;

		// Specialized components
		this.statistics = new TransactionStatistics();
		this.deadlockDetector = new DeadlockDetector(this.lockManager);
		this.isolationValidator = new IsolationValidator();
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
		this.statistics.incrementTotal();
		this.statistics.incrementActive();

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

			// Perform isolation level checks using specialized validator
			this.isolationValidator.validateIsolation(transaction, this.transactions);

			// Commit the transaction
			transaction.commit(context);

			// Update statistics
			this.statistics.incrementCommitted();
			this.statistics.decrementActive();
			this.statistics.updateDurationStats(transaction);

			return transaction;
		} catch (error) {
			// Auto-abort on failure
			this.abort(transactionId, error.message);
			throw error;
		/* c8 ignore next */ } finally {
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
		this.statistics.incrementAborted();
		this.statistics.decrementActive();
		this.statistics.updateDurationStats(transaction);

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
			// Special case: maxAge of 0 means clean ALL completed transactions
			if (transaction.endTime && (maxAge === 0 || transaction.endTime.getTime() < cutoffTime)) {
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
	 * Check for deadlocks using specialized detector
	 * @param {Object} [options={}] - Detection options
	 * @returns {Object} Deadlock detection results
	 */
	detectDeadlocks (options = {}) {
		const activeTransactions = this.getActiveTransactions();

		return this.deadlockDetector.detectDeadlocks(activeTransactions, options);
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		const activeCount = this.getActiveTransactions().length;
		const lockStats = this.lockManager.getStats();

		return this.statistics.getStats(lockStats, activeCount, this.transactionCounter);
	}

	/**
	 * Reset all statistics
	 */
	resetStats () {
		this.statistics.reset();
	}

	/**
	 * Get access to specialized components for advanced usage
	 * @returns {Object} Specialized components
	 */
	getComponents () {
		return {
			statistics: this.statistics,
			deadlockDetector: this.deadlockDetector,
			isolationValidator: this.isolationValidator,
			lockManager: this.lockManager
		};
	}

	/**
	 * Validate isolation for a specific transaction (for testing/debugging)
	 * @param {string} transactionId - Transaction ID to validate
	 * @throws {TransactionError} If validation fails
	 */
	validateTransactionIsolation (transactionId) {
		const transaction = this.transactions.get(transactionId);
		if (!transaction) {
			throw new TransactionError(`Transaction ${transactionId} not found`, transactionId, "validate");
		}

		this.isolationValidator.validateIsolation(transaction, this.transactions);
	}

	/**
	 * Force deadlock detection and return results
	 * @param {Object} [options={}] - Detection options
	 * @returns {Object} Deadlock detection results
	 */
	checkForDeadlocks (options = {}) {
		return this.detectDeadlocks(options);
	}

	/**
	 * Get detailed transaction information for debugging
	 * @param {string} transactionId - Transaction ID
	 * @returns {Object|null} Detailed transaction info or null if not found
	 */
	getTransactionDetails (transactionId) {
		const transaction = this.transactions.get(transactionId);
		if (!transaction) {
			return null;
		}

		return {
			...transaction.getStats(),
			lockInfo: this.lockManager.getStats().recordsLocked.filter(
				lock => lock.holders.includes(transactionId)
			)
		};
	}

	/**
	 * Get system health information
	 * @returns {Object} System health metrics
	 */
	getSystemHealth () {
		const stats = this.getStats();
		const deadlockResults = this.detectDeadlocks();

		return {
			activeTransactions: stats.activeTransactions,
			totalTransactions: stats.totalTransactions,
			commitRate: stats.totalTransactions > 0 ? stats.committedTransactions / stats.totalTransactions : 0,
			averageDuration: stats.averageDuration,
			hasDeadlocks: deadlockResults.deadlocks.length > 0,
			suspectedDeadlocks: deadlockResults.suspectedDeadlocks.length,
			timeoutVictims: deadlockResults.timeoutVictims.length,
			totalLocks: stats.lockStats.totalLocks,
			lockUtilization: stats.lockStats.totalLocks > 0 ? stats.lockStats.uniqueHolders / stats.lockStats.totalLocks : 0
		};
	}
}
