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
	 * Get all record keys (backwards compatibility)
	 * @returns {Array<string>} Array of record keys
	 */
	keys () {
		return this.storageManager.keys();
	}

	/**
	 * Get all record values (backwards compatibility)
	 * @returns {Array<Object>} Array of record values
	 */
	values () {
		return this.storageManager.values();
	}

	/**
	 * Get all record entries as [key, value] pairs (backwards compatibility)
	 * @returns {Array<[string, Object]>} Array of [key, value] pairs
	 */
	entries () {
		return this.storageManager.entries();
	}

	/**
	 * Convert store to array (backwards compatibility)
	 * @returns {Array<Object>} Array of all records
	 */
	toArray () {
		return this.values();
	}

	/**
	 * Filter records using a predicate (backwards compatibility)
	 * @param {Function} predicate - Filter predicate
	 * @returns {Array<Object>} Filtered records
	 */
	filter (predicate) {
		return this.values().filter(predicate);
	}

	/**
	 * Search records (backwards compatibility)
	 * @param {*} value - Search value
	 * @param {string|Array<string>} [fields] - Fields to search
	 * @returns {Array<Object>} Matching records
	 */
	search (value, fields, raw = false) {
		// Function-based search (full scan)
		if (typeof value === "function") {
			return this.filter(value);
		}

		// If no fields specified, search all available indexes
		if (!fields) {
			const availableIndexes = this.indexManager.listIndexes();
			if (availableIndexes.length === 0) {
				// No indexes, full scan
				return this._fullScanSearch(value);
			}
			fields = availableIndexes;
		}

		const fieldArray = Array.isArray(fields) ? fields : [fields];
		const matchingKeys = new Set();

		// Try to use indexes for each field
		for (const field of fieldArray) {
			if (this.indexManager.hasIndex(field)) {
				// Use index-based search
				const indexKeys = this._searchIndex(field, value);
				indexKeys.forEach(key => matchingKeys.add(key));
			} else {
				// Fallback to field-based search for non-indexed fields
				const records = this.values();
				records.forEach(record => {
					const fieldValue = this._getFieldValue(record, field);
					if (this._matchesValue(fieldValue, value)) {
						matchingKeys.add(record[this.config.key]);
					}
				});
			}
		}

		// Convert keys to records
		const results = [];
		for (const key of matchingKeys) {
			const record = this.storageManager.get(key);
			if (record) {
				results.push(raw ? record : record);
			}
		}

		return results;
	}

	/**
	 * Search within a specific index
	 * @param {string} indexName - Index name
	 * @param {*} value - Search value
	 * @returns {Set<string>} Set of matching record keys
	 * @private
	 */
	_searchIndex (indexName, value) {
		const matchingKeys = new Set();

		try {
			// Get all index entries for this field
			const indexStorage = this.indexManager._indexes.get(indexName);
			if (!indexStorage) {
				return matchingKeys;
			}

			// Search through index keys
			for (const [indexKey, recordKeys] of indexStorage._data.entries()) {
				if (this._matchesValue(indexKey, value)) {
					recordKeys.forEach(key => matchingKeys.add(key));
				}
			}
		} catch {
			// Fallback to empty set on error
		}

		return matchingKeys;
	}

	/**
	 * Perform full scan search when no indexes available
	 * @param {*} value - Search value
	 * @returns {Array<Object>} Matching records
	 * @private
	 */
	_fullScanSearch (value) {
		const records = this.values();

		return records.filter(record => {
			return this._searchInRecord(record, value);
		});
	}

	/**
	 * Search within a record for a value
	 * @param {Object} record - Record to search
	 * @param {*} value - Value to search for
	 * @returns {boolean} True if found
	 * @private
	 */
	_searchInRecord (record, value) {
		for (const fieldValue of Object.values(record)) {
			if (this._matchesValue(fieldValue, value)) {
				return true;
			}

			// Search in nested objects and arrays
			if (typeof fieldValue === "object" && fieldValue !== null) {
				if (Array.isArray(fieldValue)) {
					if (fieldValue.some(item => this._matchesValue(item, value))) {
						return true;
					}
				} else if (this._searchInRecord(fieldValue, value)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Get field value from record (supports nested fields)
	 * @param {Object} record - Record object
	 * @param {string} field - Field path (e.g., "user.name")
	 * @returns {*} Field value
	 * @private
	 */
	_getFieldValue (record, field) {
		const parts = field.split(".");
		let value = record;

		for (const part of parts) {
			if (value && typeof value === "object") {
				value = value[part];
			} else {
				return undefined;
			}
		}

		return value;
	}

	/**
	 * Check if a value matches the search criteria
	 * @param {*} fieldValue - Field value to test
	 * @param {*} searchValue - Search value
	 * @returns {boolean} True if matches
	 * @private
	 */
	_matchesValue (fieldValue, searchValue) {
		if (searchValue instanceof RegExp) {
			return searchValue.test(String(fieldValue));
		}

		if (typeof searchValue === "string") {
			return String(fieldValue).toLowerCase().includes(searchValue.toLowerCase());
		}

		return fieldValue === searchValue;
	}

	/**
	 * Map over records (backwards compatibility)
	 * @param {Function} mapper - Mapping function
	 * @returns {Array} Mapped results
	 */
	map (mapper) {
		return this.values().map(mapper);
	}

	/**
	 * Reduce records (backwards compatibility)
	 * @param {Function} reducer - Reducer function
	 * @param {*} [initialValue] - Initial value
	 * @returns {*} Reduced result
	 */
	reduce (reducer, initialValue) {
		const values = this.values();

		return arguments.length > 1 ? values.reduce(reducer, initialValue) : values.reduce(reducer);
	}

	/**
	 * Iterate over records (backwards compatibility)
	 * @param {Function} callback - Callback function
	 */
	forEach (callback) {
		this.values().forEach(callback);
	}

	/**
	 * Sort records (backwards compatibility)
	 * @param {Function} [compareFn] - Compare function
	 * @returns {Array<Object>} Sorted records
	 */
	sort (compareFn) {
		return this.values().sort(compareFn);
	}

	/**
	 * Sort records by field (backwards compatibility)
	 * @param {string} field - Field to sort by
	 * @param {boolean} [ascending=true] - Sort direction
	 * @returns {Array<Object>} Sorted records
	 */
	sortBy (field, ascending = true) {
		return this.sort((a, b) => {
			const aVal = a[field];
			const bVal = b[field];
			if (aVal < bVal) return ascending ? -1 : 1;
			if (aVal > bVal) return ascending ? 1 : -1;

			return 0;
		});
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

	/**
	 * Get a limited subset of records with pagination support
	 * @param {number} [offset=0] - Number of records to skip
	 * @param {number} [max=0] - Maximum number of records to return (0 = all)
	 * @returns {Array<Object>} Array of records within the specified range
	 */
	limit (offset = 0, max = 0) {
		// Get keys first (much more efficient than getting all values)
		const keys = this.keys();
		const start = Math.max(0, offset);
		const end = max > 0 ? start + max : keys.length;

		// Get only the subset of keys we need
		const limitedKeys = keys.slice(start, end);

		// Batch retrieve only the records we need
		const results = [];
		for (const key of limitedKeys) {
			results.push(this.storageManager.get(key));
		}

		return results;
	}

	/**
	 * Rebuild indexes for specified fields or all fields
	 * @param {string|Array<string>} [fields] - Specific fields to reindex (optional)
	 * @returns {Haro} Store instance for chaining
	 */
	reindex (fields) {
		if (fields) {
			// For specific fields, we need to rebuild all indexes
			// that contain those fields (IndexManager doesn't support partial rebuild)
			this.indexManager.rebuild(this.entries());
		} else {
			// Rebuild all indexes
			this.indexManager.rebuild(this.entries());
		}

		return this;
	}

	/**
	 * Export store data or indexes for persistence
	 * @param {string} [type='records'] - Type of data to export: 'records' or 'indexes'
	 * @returns {Array} Array of [key, value] pairs or serialized index structure
	 */
	dump (type = "records") {
		if (type === "indexes") {
			// Export index definitions and statistics
			const indexData = {};
			const indexNames = this.indexManager.listIndexes();

			for (const name of indexNames) {
				const definition = this.indexManager.getIndexDefinition(name);
				indexData[name] = {
					fields: definition.fields,
					type: definition.type,
					delimiter: definition.delimiter,
					unique: definition.unique
				};
			}

			return indexData;
		}

		// Default to records
		return this.entries();
	}

	/**
	 * Import and restore data from a dump
	 * @param {Array} data - Data to import (from dump)
	 * @param {string} [type='records'] - Type of data: 'records' or 'indexes'
	 * @returns {boolean} True if operation succeeded
	 */
	override (data, type = "records") {
		try {
			if (type === "indexes") {
				// Recreate indexes from definitions
				this.indexManager.clear();

				for (const [name, definition] of Object.entries(data)) {
					this.indexManager.createIndex(name, definition.fields, {
						type: definition.type,
						delimiter: definition.delimiter,
						unique: definition.unique
					});
				}

				// Rebuild indexes with current data
				this.reindex();
			} else {
				// Clear existing data
				this.clear();

				// Import records
				for (const [key, value] of data) {
					this.set(key, value, true); // Use batch mode
				}
			}

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Generate a RFC4122 v4 UUID
	 * @returns {string} UUID string
	 */
	uuid () {
		return uuid();
	}

	/**
	 * Deep clone utility function
	 * @param {*} obj - Object to clone
	 * @returns {*} Cloned object
	 */
	clone (obj) {
		if (obj === null || typeof obj !== "object") {
			return obj;
		}

		if (obj instanceof Date) {
			return new Date(obj.getTime());
		}

		if (obj instanceof RegExp) {
			return new RegExp(obj);
		}

		if (Array.isArray(obj)) {
			return obj.map(item => this.clone(item));
		}

		const cloned = {};
		for (const [key, value] of Object.entries(obj)) {
			cloned[key] = this.clone(value);
		}

		return cloned;
	}

	/**
	 * Merge multiple objects into one
	 * @param {Object} target - Target object
	 * @param {...Object} sources - Source objects to merge
	 * @param {boolean} [deep=true] - Whether to perform deep merge
	 * @returns {Object} Merged object
	 */
	merge (target, ...sources) {
		if (!target || typeof target !== "object") {
			return target;
		}

		const result = this.clone(target);

		for (const source of sources) {
			if (source && typeof source === "object") {
				for (const [key, value] of Object.entries(source)) {
					if (typeof value === "object" && value !== null && !Array.isArray(value) &&
						typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key])) {
						result[key] = this.merge(result[key], value);
					} else {
						result[key] = this.clone(value);
					}
				}
			}
		}

		return result;
	}

	/**
	 * Freeze objects for immutability
	 * @param {...Object} objects - Objects to freeze
	 * @returns {Object|Array} Frozen object(s)
	 */
	freeze (...objects) {
		const freeze = obj => {
			if (obj === null || typeof obj !== "object") {
				return obj;
			}

			if (Array.isArray(obj)) {
				obj.forEach(item => freeze(item));
			} else {
				Object.values(obj).forEach(value => freeze(value));
			}

			return Object.freeze(obj);
		};

		if (objects.length === 1) {
			return freeze(objects[0]);
		}

		return objects.map(obj => freeze(obj));
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
