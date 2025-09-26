/**
 * Transaction statistics manager for tracking metrics and performance
 */
export class TransactionStatistics {
	constructor () {
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
	 * Increment total transaction count
	 */
	incrementTotal () {
		this.stats.totalTransactions++;
	}

	/**
	 * Increment committed transaction count
	 */
	incrementCommitted () {
		this.stats.committedTransactions++;
	}

	/**
	 * Increment aborted transaction count
	 */
	incrementAborted () {
		this.stats.abortedTransactions++;
	}

	/**
	 * Increment active transaction count
	 */
	incrementActive () {
		this.stats.activeTransactions++;
	}

	/**
	 * Decrement active transaction count
	 */
	decrementActive () {
		this.stats.activeTransactions--;
	}

	/**
	 * Update duration statistics based on completed transaction
	 * @param {Transaction} transaction - Completed transaction
	 */
	updateDurationStats (transaction) {
		const duration = transaction.getDuration();
		if (duration !== null) {
			this.stats.totalDuration += duration;
			const completedTransactions = this.stats.committedTransactions + this.stats.abortedTransactions;
			this.stats.averageDuration = this.stats.totalDuration / completedTransactions;
		}
	}

	/**
	 * Get comprehensive statistics
	 * @param {Object} lockStats - Lock manager statistics
	 * @param {number} activeCount - Current active transaction count
	 * @param {number} transactionCounter - Global transaction counter
	 * @returns {Object} Complete statistics object
	 */
	getStats (lockStats, activeCount, transactionCounter) {
		return {
			...this.stats,
			activeTransactions: activeCount,
			lockStats,
			transactionCounter
		};
	}

	/**
	 * Reset all statistics to zero
	 */
	reset () {
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
	 * Get raw statistics object (for internal use)
	 * @returns {Object} Raw stats object
	 */
	getRawStats () {
		return { ...this.stats };
	}
}
