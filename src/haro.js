import { randomUUID as uuid } from "crypto";
import {
	ConfigurationError,
	TransactionError,
	ErrorRecovery
} from "./errors.js";
import { DataTypes } from "./data-types.js";
import { FieldConstraint } from "./field-constraint.js";
import { Schema } from "./schema.js";
import { ConfigValidator } from "./config-validator.js";
import { Constraints } from "./constraints.js";
import { IsolationLevels } from "./constants.js";
import { Record, RecordCollection, RecordFactory } from "./record.js";
import { IndexManager, IndexTypes } from "./index-manager.js";
import { VersionManager, RetentionPolicies } from "./version-manager.js";
import { TransactionManager } from "./transaction-manager.js";
import { QueryOptimizer, QueryTypes } from "./query-optimizer.js";
import { ImmutableStore } from "./immutable-store.js";
import { DataStream } from "./data-stream.js";
import { StorageManager } from "./storage-manager.js";
import { CRUDManager } from "./crud-manager.js";
import { QueryManager } from "./query-manager.js";
import { BatchManager } from "./batch-manager.js";
import { StreamManager } from "./stream-manager.js";
import { StatisticsManager } from "./statistics-manager.js";
import { LifecycleManager } from "./lifecycle-manager.js";


/**
 * Haro class with all design flaws addressed and enterprise features added
 */
export class Haro {
	/**
	 * @param {Array|Object} [data] - Initial data or configuration
	 * @param {Object} [config={}] - Configuration options
	 */
	constructor (data = null, config = {}) {
		// Set defaults first
		const defaults = {
			delimiter: "|",
			id: uuid(),
			immutable: false,
			index: [],
			key: "id",
			versioning: false,
			schema: null,
			retentionPolicy: { type: RetentionPolicies.NONE },
			enableTransactions: false,
			enableOptimization: true
		};

		// Handle parameter overloading and merge with defaults
		let userConfig;
		if (Array.isArray(data) || data === null) {
			userConfig = ConfigValidator.validate(config);
			this.initialData = data;
		} else {
			userConfig = ConfigValidator.validate(data);
			this.initialData = null;
		}

		// Merge defaults with user configuration (user config takes precedence)
		this.config = { ...defaults, ...userConfig };

		// Initialize core managers
		this.storageManager = new StorageManager({ immutable: this.config.immutable });
		this.indexManager = new IndexManager(this.config.delimiter);
		this.versionManager = this.config.versioning ?
			new VersionManager(this.config.retentionPolicy) :
			null;
		this.transactionManager = this.config.enableTransactions ?
			new TransactionManager() :
			null;
		this.queryOptimizer = this.config.enableOptimization ?
			new QueryOptimizer() :
			null;

		// Initialize lifecycle manager
		this.lifecycleManager = new LifecycleManager();

		// Initialize specialized managers
		this.crudManager = new CRUDManager({
			storageManager: this.storageManager,
			indexManager: this.indexManager,
			versionManager: this.versionManager,
			config: this.config
		});

		this.queryManager = new QueryManager({
			storageManager: this.storageManager,
			indexManager: this.indexManager,
			queryOptimizer: this.queryOptimizer
		});

		this.batchManager = new BatchManager({
			crudManager: this.crudManager,
			transactionManager: this.transactionManager,
			lifecycleManager: this.lifecycleManager
		});

		this.streamManager = new StreamManager({
			storageManager: this.storageManager
		});

		this.statisticsManager = new StatisticsManager({
			storageManager: this.storageManager,
			indexManager: this.indexManager,
			versionManager: this.versionManager,
			transactionManager: this.transactionManager,
			queryOptimizer: this.queryOptimizer,
			config: this.config
		});

		// Create indexes
		for (const indexField of this.config.index) {
			this.indexManager.createIndex(indexField, indexField);
		}

		// Properties for backward compatibility
		Object.defineProperty(this, "data", {
			get: () => this.storageManager.getStore(),
			enumerable: true
		});

		Object.defineProperty(this, "size", {
			get: () => this.storageManager.size,
			enumerable: true
		});

		Object.defineProperty(this, "registry", {
			get: () => this.storageManager.keys(),
			enumerable: true
		});

		// Initialize with data if provided
		if (this.initialData && Array.isArray(this.initialData)) {
			this.batch(this.initialData);
		}
	}

	/**
	 * Set or update a record with comprehensive validation and error handling
	 * @param {string|null} key - Record key or null for auto-generation
	 * @param {Object} [data={}] - Record data
	 * @param {Object} [options={}] - Operation options
	 * @returns {Record} Created/updated record
	 * @throws {ValidationError} If data validation fails
	 */
	set (key, data = {}, options = {}) {
		const {
			batch = false,
			transaction = null
		} = options;

		// Execute in transaction if provided
		if (transaction) {
			return this._executeInTransaction(transaction, "set", key, data, options);
		}

		// Trigger lifecycle hook
		this.lifecycleManager.beforeSet(key, data, options);

		// Delegate to CRUD manager
		const record = this.crudManager.set(key, data, options);

		// Trigger lifecycle hook
		if (!batch) {
			this.lifecycleManager.onset(record, options);
		}

		return record;
	}

	/**
	 * Get a record by key with consistent return format
	 * @param {string} key - Record key
	 * @param {Object} [options={}] - Get options
	 * @returns {Record|null} Record instance or null if not found
	 */
	get (key, options = {}) {
		const { transaction = null } = options;

		// Execute in transaction if provided
		if (transaction) {
			return this._executeInTransaction(transaction, "get", key, options);
		}

		// Delegate to CRUD manager
		return this.crudManager.get(key, options);
	}

	/**
	 * Delete a record with proper cleanup
	 * @param {string} key - Record key
	 * @param {Object} [options={}] - Delete options
	 * @returns {boolean} True if deleted successfully
	 * @throws {RecordNotFoundError} If record not found
	 */
	delete (key, options = {}) {
		const {
			batch = false,
			transaction = null
		} = options;

		// Execute in transaction if provided
		if (transaction) {
			return this._executeInTransaction(transaction, "delete", key, options);
		}

		// Lifecycle hook
		this.lifecycleManager.beforeDelete(key, batch);

		// Delegate to CRUD manager
		const result = this.crudManager.delete(key, options);

		// Lifecycle hook
		if (!batch) {
			this.lifecycleManager.ondelete(key);
		}

		return result;
	}

	/**
	 * Check if record exists
	 * @param {string} key - Record key
	 * @returns {boolean} True if record exists
	 */
	has (key) {
		return this.crudManager.has(key);
	}

	/**
	 * Find records using optimized queries
	 * @param {Object} [criteria={}] - Search criteria
	 * @param {Object} [options={}] - Query options
	 * @returns {RecordCollection} Collection of matching records
	 */
	find (criteria = {}, options = {}) {
		const { transaction = null } = options;

		// Execute in transaction if provided
		if (transaction) {
			return this._executeInTransaction(transaction, "find", criteria, options);
		}

		// Delegate to query manager
		return this.queryManager.find(criteria, options);
	}

	/**
	 * Advanced filtering with predicate logic
	 * @param {Function|Object} predicate - Filter predicate
	 * @param {Object} [options={}] - Filter options
	 * @returns {RecordCollection} Filtered records
	 */
	where (predicate, options = {}) {
		// Delegate to query manager
		return this.queryManager.where(predicate, options);
	}

	/**
	 * Batch operations with transaction support
	 * @param {Array} operations - Array of operations or records
	 * @param {string} [type='set'] - Operation type
	 * @param {Object} [options={}] - Batch options
	 * @returns {Promise<Array>|Array} Array of results (Promise when using transactions)
	 */
	batch (operations, type = "set", options = {}) {
		// Delegate to batch manager
		return this.batchManager.batch(operations, type, options);
	}

	/**
	 * Begin a new transaction
	 * @param {Object} [options={}] - Transaction options
	 * @returns {Transaction} New transaction
	 * @throws {ConfigurationError} If transactions not enabled
	 */
	beginTransaction (options = {}) {
		if (!this.transactionManager) {
			throw new ConfigurationError("Transactions not enabled", "enableTransactions", false);
		}

		return this.transactionManager.begin(options);
	}

	/**
	 * Commit a transaction
	 * @param {string|Transaction} transaction - Transaction ID or instance
	 * @returns {Transaction} Committed transaction
	 */
	async commitTransaction (transaction) {
		if (!this.transactionManager) {
			throw new ConfigurationError("Transactions not enabled", "enableTransactions", false);
		}

		const transactionId = typeof transaction === "string" ? transaction : transaction.id;

		return await this.transactionManager.commit(transactionId);
	}

	/**
	 * Abort a transaction
	 * @param {string|Transaction} transaction - Transaction ID or instance
	 * @param {string} [reason] - Abort reason
	 * @returns {Transaction} Aborted transaction
	 */
	abortTransaction (transaction, reason) {
		if (!this.transactionManager) {
			throw new ConfigurationError("Transactions not enabled", "enableTransactions", false);
		}

		const transactionId = typeof transaction === "string" ? transaction : transaction.id;

		return this.transactionManager.abort(transactionId, reason);
	}

	/**
	 * Create a data stream for large datasets
	 * @param {Object} [options={}] - Stream options
	 * @returns {DataStream} Data stream instance
	 */
	stream (options = {}) {
		// Delegate to stream manager
		return this.streamManager.stream(options);
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		// Delegate to statistics manager
		return this.statisticsManager.getStats();
	}

	/**
	 * Clear all data and reset state
	 * @param {Object} [options={}] - Clear options
	 */
	clear (options = {}) {
		const {
			preserveIndexes = false,
			preserveVersions = false
		} = options;

		// Lifecycle hook
		this.lifecycleManager.beforeClear();

		// Clear storage
		this.storageManager.clear();

		// Clear indexes
		if (!preserveIndexes) {
			this.indexManager.clear();
		}

		// Clear versions
		if (!preserveVersions && this.versionManager) {
			this.versionManager.clear();
		}

		// Clear query cache
		if (this.queryOptimizer) {
			this.queryOptimizer.clear();
		}

		// Lifecycle hook
		this.lifecycleManager.onclear();
	}

	// Lifecycle hooks (backward compatibility - delegate to lifecycle manager)
	beforeSet (key, data, options) {
		return this.lifecycleManager.beforeSet(key, data, options);
	}
	onset (record, options) {
		return this.lifecycleManager.onset(record, options);
	}
	beforeDelete (key, batch) {
		return this.lifecycleManager.beforeDelete(key, batch);
	}
	ondelete (key) {
		return this.lifecycleManager.ondelete(key);
	}
	beforeClear () {
		return this.lifecycleManager.beforeClear();
	}
	onclear () {
		return this.lifecycleManager.onclear();
	}
	onbatch (results, type) {
		return this.lifecycleManager.onbatch(results, type);
	}


	/**
	 * Execute operation in transaction
	 * @param {Transaction} transaction - Transaction instance
	 * @param {string} operation - Operation type
	 * @param {...*} args - Operation arguments
	 * @returns {*} Operation result
	 * @private
	 */
	_executeInTransaction (transaction, operation, ...args) {
		// Handle different operation parameter patterns
		switch (operation) {
			case "set": {
				const [key, data, options = {}] = args;
				const oldValue = this.storageManager.get(key);

				transaction.addOperation(operation, key, oldValue, data);

				return this.set(key, data, { ...options, transaction: null });
			}
			case "get": {
				const [key, options = {}] = args;

				transaction.addOperation("read", key);

				return this.get(key, { ...options, transaction: null });
			}
			case "delete": {
				const [key, options = {}] = args;
				const oldValue = this.storageManager.get(key);

				transaction.addOperation(operation, key, oldValue);

				return this.delete(key, { ...options, transaction: null });
			}
			case "find": {
				const [criteria, options = {}] = args;

				transaction.addOperation("read", "find_operation", null, criteria);

				return this.find(criteria, { ...options, transaction: null });
			}
			default:
				throw new TransactionError(`Unknown operation: ${operation}`, transaction.id, operation);
		}
	}

}

/**
 * Factory function for creating Haro instances
 * @param {Array|Object} [data] - Initial data or configuration
 * @param {Object} [config={}] - Configuration options
 * @returns {Haro} New Haro instance
 */
export function haro (data = null, config = {}) {
	return new Haro(data, config);
}

// Export types and utilities
export {
	DataTypes,
	FieldConstraint,
	Schema,
	Constraints,
	Record,
	RecordCollection,
	RecordFactory,
	IndexTypes,
	RetentionPolicies,
	IsolationLevels,
	QueryTypes,
	ErrorRecovery,
	ImmutableStore,
	DataStream
};

// Default export
export default Haro;
