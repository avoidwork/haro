import { QueryError, TransactionError } from "./errors.js";

/**
 * Manages batch operations with transaction support
 */
export class BatchManager {
	/**
	 * @param {Object} dependencies - Required dependencies
	 * @param {CRUDManager} dependencies.crudManager - CRUD manager
	 * @param {TransactionManager} [dependencies.transactionManager] - Transaction manager
	 * @param {LifecycleManager} dependencies.lifecycleManager - Lifecycle manager
	 */
	constructor ({ crudManager, transactionManager = null, lifecycleManager }) {
		this.crudManager = crudManager;
		this.transactionManager = transactionManager;
		this.lifecycleManager = lifecycleManager;
	}

	/**
	 * Batch operations with transaction support
	 * @param {Array} operations - Array of operations or records
	 * @param {string} [type='set'] - Operation type
	 * @param {Object} [options={}] - Batch options
	 * @returns {Promise<Array>|Array} Array of results (Promise when using transactions)
	 */
	batch (operations, type = "set", options = {}) {
		const {
			transaction = null,
			atomic = false
		} = options;

		try {
			// Use transaction for atomic operations
			if (atomic || transaction) {
				return this._executeBatchInTransaction(operations, type, transaction);
			}

			// Execute operations individually
			const results = [];
			for (const operation of operations) {
				try {
					let result;
					if (type === "set") {
						result = this.crudManager.set(null, operation, { batch: true });
					} else if (type === "del") {
						this.crudManager.delete(operation, { batch: true });
						result = true;
					}
					results.push(result);
				} catch (error) {
					results.push(error);
				}
			}

			// Trigger batch lifecycle hook
			this.lifecycleManager.onbatch(results, type);

			return results;

		} catch (error) {
			throw new QueryError(`Batch operation failed: ${error.message}`, operations, "batch");
		}
	}

	/**
	 * Execute batch in transaction
	 * @param {Array} operations - Operations to execute
	 * @param {string} type - Operation type
	 * @param {Transaction} [transaction] - Existing transaction
	 * @returns {Promise<Array>} Operation results
	 * @private
	 */
	async _executeBatchInTransaction (operations, type, transaction) {
		if (!this.transactionManager) {
			throw new TransactionError("Transaction manager not available for atomic batch operations");
		}

		const ownTransaction = !transaction;
		if (ownTransaction) {
			transaction = this.transactionManager.begin();
		}

		try {
			const results = [];
			for (const operation of operations) {
				if (type === "set") {
					const result = this._executeSetInTransaction(null, operation, transaction);
					results.push(result);
				} else if (type === "del") {
					this._executeDeleteInTransaction(operation, transaction);
					results.push(true);
				}
			}

			if (ownTransaction) {
				await this.transactionManager.commit(transaction.id);
			}

			return results;
		} catch (error) {
			if (ownTransaction) {
				this.transactionManager.abort(transaction.id, error.message);
			}
			throw error;
		}
	}

	/**
	 * Execute set operation in transaction
	 * @param {string|null} key - Record key
	 * @param {Object} data - Record data
	 * @param {Transaction} transaction - Transaction instance
	 * @returns {Record} Created record
	 * @private
	 */
	_executeSetInTransaction (key, data, transaction) {
		// Add operation to transaction log
		const oldValue = key ? this.crudManager.storageManager.get(key) : null;
		transaction.addOperation("set", key, oldValue, data);

		// Execute operation
		return this.crudManager.set(key, data, { batch: true });
	}

	/**
	 * Execute delete operation in transaction
	 * @param {string} key - Record key
	 * @param {Transaction} transaction - Transaction instance
	 * @private
	 */
	_executeDeleteInTransaction (key, transaction) {
		// Add operation to transaction log
		const oldValue = this.crudManager.storageManager.get(key);
		transaction.addOperation("delete", key, oldValue);

		// Execute operation
		this.crudManager.delete(key, { batch: true });
	}
}
