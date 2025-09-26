/**
 * @fileoverview Improved Haro class with all design flaws addressed
 */

import { randomUUID as uuid } from "crypto";
import {
	HaroError,
	ValidationError,
	RecordNotFoundError,
	IndexError,
	ConfigurationError,
	TransactionError,
	QueryError,
	ErrorRecovery
} from "./errors.js";
import {
	DataTypes,
	FieldConstraint,
	Schema,
	ConfigValidator,
	Constraints
} from "./validation.js";
import { Record, RecordCollection, RecordFactory } from "./record.js";
import { IndexManager, IndexTypes } from "./index-manager.js";
import { VersionManager, RetentionPolicies } from "./version-manager.js";
import { TransactionManager, Transaction, IsolationLevels } from "./transaction.js";
import { QueryOptimizer, QueryTypes } from "./query-optimizer.js";

/**
 * Deep immutability implementation with structural sharing
 */
export class ImmutableStore {
	/**
	 * @param {Map} [data] - Initial data
	 */
	constructor (data = new Map()) {
		this._data = new Map(data);
		this._frozenViews = new WeakMap();
		Object.freeze(this);
	}

	/**
	 * Get a deeply frozen view of the data
	 * @param {string} key - Record key
	 * @returns {Object|null} Frozen record or null
	 */
	get (key) {
		const record = this._data.get(key);
		if (!record) return null;

		// Check if we already have a frozen view
		if (this._frozenViews.has(record)) {
			return this._frozenViews.get(record);
		}

		// Create deeply frozen view
		const frozen = this._deepFreeze(structuredClone(record));
		this._frozenViews.set(record, frozen);

		return frozen;
	}

	/**
	 * Create new store with updated record (structural sharing)
	 * @param {string} key - Record key
	 * @param {Object} record - Record data
	 * @returns {ImmutableStore} New store instance
	 */
	set (key, record) {
		const newData = new Map(this._data);
		newData.set(key, record);

		return new ImmutableStore(newData);
	}

	/**
	 * Create new store without record
	 * @param {string} key - Record key to remove
	 * @returns {ImmutableStore} New store instance
	 */
	delete (key) {
		const newData = new Map(this._data);
		newData.delete(key);

		return new ImmutableStore(newData);
	}

	/**
	 * Check if record exists
	 * @param {string} key - Record key
	 * @returns {boolean} True if exists
	 */
	has (key) {
		return this._data.has(key);
	}

	/**
	 * Get all keys
	 * @returns {string[]} Array of keys
	 */
	keys () {
		return Array.from(this._data.keys());
	}

	/**
	 * Get store size
	 * @returns {number} Number of records
	 */
	get size () {
		return this._data.size;
	}

	/**
	 * Get all entries
	 * @returns {Array<[string, Object]>} Array of [key, value] pairs
	 */
	entries () {
		return Array.from(this._data.entries());
	}

	/**
	 * Deep freeze an object
	 * @param {*} obj - Object to freeze
	 * @returns {*} Frozen object
	 * @private
	 */
	_deepFreeze (obj) {
		if (obj === null || typeof obj !== "object") {
			return obj;
		}

		if (Array.isArray(obj)) {
			obj.forEach(item => this._deepFreeze(item));
		} else {
			Object.values(obj).forEach(value => this._deepFreeze(value));
		}

		return Object.freeze(obj);
	}
}

/**
 * Streaming support for large datasets
 */
export class DataStream {
	/**
	 * @param {Iterator} iterator - Data iterator
	 * @param {Object} [options={}] - Stream options
	 */
	constructor (iterator, options = {}) {
		this.iterator = iterator;
		this.options = {
			batchSize: 1000,
			bufferSize: 10000,
			...options
		};
		this.buffer = [];
		this.ended = false;
		this.position = 0;
	}

	/**
	 * Read next batch of records
	 * @param {number} [size] - Batch size
	 * @returns {Promise<Record[]>} Array of records
	 */
	async read (size = this.options.batchSize) {
		const batch = [];

		while (batch.length < size && !this.ended) {
			const { value, done } = this.iterator.next();

			if (done) {
				this.ended = true;
				break;
			}

			batch.push(value);
			this.position++;
		}

		return batch;
	}

	/**
	 * Read all remaining records
	 * @returns {Promise<Record[]>} All records
	 */
	async readAll () {
		const records = [];

		while (!this.ended) {
			const batch = await this.read();
			records.push(...batch);
		}

		return records;
	}

	/**
	 * Apply transformation to stream
	 * @param {Function} transform - Transform function
	 * @returns {DataStream} New transformed stream
	 */
	map (transform) {
		const transformedIterator = {
			next: () => {
				const { value, done } = this.iterator.next();

				return done ? { done: true } : { value: transform(value), done: false };
			}
		};

		return new DataStream(transformedIterator, this.options);
	}

	/**
	 * Filter stream records
	 * @param {Function} predicate - Filter predicate
	 * @returns {DataStream} New filtered stream
	 */
	filter (predicate) {
		const filteredIterator = {
			next: () => {
				while (true) {
					const { value, done } = this.iterator.next();
					if (done) return { done: true };
					if (predicate(value)) return { value, done: false };
				}
			}
		};

		return new DataStream(filteredIterator, this.options);
	}

	/**
	 * Take limited number of records
	 * @param {number} limit - Maximum records
	 * @returns {DataStream} New limited stream
	 */
	take (limit) {
		let count = 0;
		const limitedIterator = {
			next: () => {
				if (count >= limit) return { done: true };
				const { value, done } = this.iterator.next();
				if (done) return { done: true };
				count++;

				return { value, done: false };
			}
		};

		return new DataStream(limitedIterator, this.options);
	}

	/**
	 * Get stream statistics
	 * @returns {Object} Stream statistics
	 */
	getStats () {
		return {
			position: this.position,
			ended: this.ended,
			bufferSize: this.buffer.length,
			options: this.options
		};
	}
}

/**
 * Haro class with all design flaws addressed and enterprise features added
 */
export class Haro {
	/**
	 * @param {Array|Object} [data] - Initial data or configuration
	 * @param {Object} [config={}] - Configuration options
	 */
	constructor (data = null, config = {}) {
		// Handle parameter overloading
		if (Array.isArray(data) || data === null) {
			this.config = ConfigValidator.validate(config);
			this.initialData = data;
		} else {
			this.config = ConfigValidator.validate(data);
			this.initialData = null;
		}

		// Set defaults
		this.config = {
			delimiter: "|",
			id: uuid(),
			immutable: false,
			index: [],
			key: "id",
			versioning: false,
			schema: null,
			retentionPolicy: { type: RetentionPolicies.NONE },
			enableTransactions: false,
			enableOptimization: true,
			...this.config
		};

		// Initialize storage
		if (this.config.immutable) {
			this._store = new ImmutableStore();
		} else {
			this._store = new Map();
		}

		// Initialize managers
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

		// Create indexes
		for (const indexField of this.config.index) {
			this.indexManager.createIndex(indexField, indexField);
		}

		// Properties for backward compatibility
		Object.defineProperty(this, "data", {
			get: () => this._store,
			enumerable: true
		});

		Object.defineProperty(this, "size", {
			get: () => this._store.size,
			enumerable: true
		});

		Object.defineProperty(this, "registry", {
			get: () => Array.from(this._store.keys()),
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
		try {
			const {
				batch = false,
				override = false,
				validate = true,
				transaction = null
			} = options;

			// Generate key if not provided
			if (key === null) {
				key = data[this.config.key] ?? uuid();
			}

			// Ensure key is in data
			const recordData = { ...data, [this.config.key]: key };

			// Validate against schema if configured
			if (validate && this.config.schema) {
				recordData = this.config.schema.validate(recordData);
			}

			// Execute in transaction if provided
			if (transaction) {
				return this._executeInTransaction(transaction, "set", key, recordData, { override });
			}

			// Get existing record for merging and versioning
			const existingRecord = this._store.has(key) ? this._store.get(key) : null;
			let finalData = recordData;

			// Handle merging vs override
			if (existingRecord && !override) {
				finalData = this._mergeRecords(existingRecord, recordData);
			}

			// Store version if versioning enabled
			if (this.versionManager && existingRecord) {
				this.versionManager.addVersion(key, existingRecord);
			}

			// Update indexes
			if (existingRecord) {
				this.indexManager.removeRecord(key, existingRecord);
			}
			this.indexManager.addRecord(key, finalData);

			// Store record
			if (this.config.immutable) {
				this._store = this._store.set(key, finalData);
			} else {
				this._store.set(key, finalData);
			}

			// Create record wrapper
			const record = RecordFactory.create(key, finalData);

			// Trigger lifecycle hook
			if (!batch) {
				this.onset(record);
			}

			return record;

		} catch (error) {
			if (error instanceof HaroError) {
				throw error;
			}
			throw new ValidationError(`Failed to set record: ${error.message}`, "record", data);
		}
	}

	/**
	 * Get a record by key with consistent return format
	 * @param {string} key - Record key
	 * @param {Object} [options={}] - Get options
	 * @returns {Record|null} Record instance or null if not found
	 */
	get (key, options = {}) {
		const {
			transaction = null,
			includeVersions = false
		} = options;

		// Execute in transaction if provided
		if (transaction) {
			return this._executeInTransaction(transaction, "get", key);
		}

		const recordData = this.config.immutable ?
			this._store.get(key) :
			this._store.get(key);

		if (!recordData) {
			return null;
		}

		const record = RecordFactory.create(key, recordData);

		// Add version information if requested
		if (includeVersions && this.versionManager) {
			const history = this.versionManager.getHistory(key);
			if (history) {
				const metadata = { versions: history.versions };

				return RecordFactory.create(key, recordData, metadata);
			}
		}

		return record;
	}

	/**
	 * Delete a record with proper cleanup
	 * @param {string} key - Record key
	 * @param {Object} [options={}] - Delete options
	 * @throws {RecordNotFoundError} If record not found
	 */
	delete (key, options = {}) {
		const {
			batch = false,
			transaction = null
		} = options;

		// Execute in transaction if provided
		if (transaction) {
			return this._executeInTransaction(transaction, "delete", key);
		}

		if (!this._store.has(key)) {
			throw new RecordNotFoundError(key, this.config.id);
		}

		const recordData = this._store.get(key);

		// Lifecycle hook
		this.beforeDelete(key, batch);

		// Remove from indexes
		this.indexManager.removeRecord(key, recordData);

		// Remove from store
		if (this.config.immutable) {
			this._store = this._store.delete(key);
		} else {
			this._store.delete(key);
		}

		// Cleanup versions
		if (this.versionManager) {
			this.versionManager.disableVersioning(key);
		}

		// Lifecycle hook
		if (!batch) {
			this.ondelete(key);
		}
	}

	/**
	 * Check if record exists
	 * @param {string} key - Record key
	 * @returns {boolean} True if record exists
	 */
	has (key) {
		return this._store.has(key);
	}

	/**
	 * Find records using optimized queries
	 * @param {Object} [criteria={}] - Search criteria
	 * @param {Object} [options={}] - Query options
	 * @returns {RecordCollection} Collection of matching records
	 */
	find (criteria = {}, options = {}) {
		const {
			limit,
			offset = 0,
			transaction = null
		} = options;

		try {
			// Create query plan if optimizer is available
			let plan = null;
			if (this.queryOptimizer) {
				const query = { find: criteria, limit, offset };
				const context = { indexManager: this.indexManager };
				plan = this.queryOptimizer.createPlan(query, context);
				plan.startExecution();
			}

			// Execute in transaction if provided
			if (transaction) {
				const results = this._executeInTransaction(transaction, "find", criteria, options);
				if (plan) {
					plan.completeExecution(results.length);
					this.queryOptimizer.recordExecution(plan);
				}

				return results;
			}

			// Use index if available
			const fields = Object.keys(criteria);
			const optimalIndex = this.indexManager.getOptimalIndex(fields);

			let recordKeys;
			if (optimalIndex) {
				recordKeys = this.indexManager.findByCriteria(criteria);
			} else {
				// Fallback to full scan
				recordKeys = new Set(this._store.keys());
			}

			// Convert to records and filter
			const records = [];
			for (const key of recordKeys) {
				const recordData = this._store.get(key);
				if (this._matchesCriteria(recordData, criteria)) {
					records.push(RecordFactory.create(key, recordData));
				}
			}

			// Apply pagination
			const start = offset;
			const end = limit ? start + limit : records.length;
			const paginatedRecords = records.slice(start, end);

			if (plan) {
				plan.completeExecution(paginatedRecords.length);
				this.queryOptimizer.recordExecution(plan);
			}

			return new RecordCollection(paginatedRecords);

		} catch (error) {
			throw new QueryError(`Find operation failed: ${error.message}`, criteria, "find");
		}
	}

	/**
	 * Advanced filtering with predicate logic
	 * @param {Function|Object} predicate - Filter predicate
	 * @param {Object} [options={}] - Filter options
	 * @returns {RecordCollection} Filtered records
	 */
	where (predicate, options = {}) {
		try {
			if (typeof predicate === "function") {
				return this._filterByFunction(predicate, options);
			}

			if (typeof predicate === "object" && predicate !== null) {
				return this._filterByObject(predicate, options);
			}

			throw new QueryError("Predicate must be a function or object", predicate, "where");

		} catch (error) {
			throw new QueryError(`Where operation failed: ${error.message}`, predicate, "where");
		}
	}

	/**
	 * Batch operations with transaction support
	 * @param {Array} operations - Array of operations or records
	 * @param {string} [type='set'] - Operation type
	 * @param {Object} [options={}] - Batch options
	 * @returns {Array} Array of results
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
						result = this.set(null, operation, { batch: true });
					} else if (type === "del") {
						this.delete(operation, { batch: true });
						result = true;
					}
					results.push(result);
				} catch (error) {
					results.push(error);
				}
			}

			// Trigger batch lifecycle hook
			this.onbatch(results, type);

			return results;

		} catch (error) {
			throw new QueryError(`Batch operation failed: ${error.message}`, operations, "batch");
		}
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
		const iterator = this._store.entries();

		return new DataStream(iterator, options);
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		const stats = {
			records: this._store.size,
			configuration: this.config,
			indexes: this.indexManager.getStats(),
			memory: this._estimateMemoryUsage()
		};

		if (this.versionManager) {
			stats.versions = this.versionManager.getStats();
		}

		if (this.transactionManager) {
			stats.transactions = this.transactionManager.getStats();
		}

		if (this.queryOptimizer) {
			stats.queries = this.queryOptimizer.getStats();
		}

		return stats;
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

		this.beforeClear();

		// Clear store
		if (this.config.immutable) {
			this._store = new ImmutableStore();
		} else {
			this._store.clear();
		}

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

		this.onclear();
	}

	// Lifecycle hooks (override in subclasses)
	beforeSet (key, data, options) {}
	onset (record) {}
	beforeDelete (key, batch) {}
	ondelete (key) {}
	beforeClear () {}
	onclear () {}
	onbatch (results, type) {}

	/**
	 * Merge two records
	 * @param {Object} existing - Existing record
	 * @param {Object} updates - Updates to apply
	 * @returns {Object} Merged record
	 * @private
	 */
	_mergeRecords (existing, updates) {
		if (Array.isArray(existing) && Array.isArray(updates)) {
			return [...existing, ...updates];
		}

		if (typeof existing === "object" && typeof updates === "object") {
			const merged = { ...existing };
			for (const [key, value] of Object.entries(updates)) {
				if (typeof value === "object" && value !== null && !Array.isArray(value) &&
					typeof existing[key] === "object" && existing[key] !== null && !Array.isArray(existing[key])) {
					merged[key] = this._mergeRecords(existing[key], value);
				} else {
					merged[key] = value;
				}
			}

			return merged;
		}

		return updates;
	}

	/**
	 * Check if record matches criteria
	 * @param {Object} record - Record to check
	 * @param {Object} criteria - Criteria object
	 * @returns {boolean} True if matches
	 * @private
	 */
	_matchesCriteria (record, criteria) {
		for (const [field, value] of Object.entries(criteria)) {
			const recordValue = record[field];

			if (value instanceof RegExp) {
				if (!value.test(recordValue)) return false;
			} else if (Array.isArray(value)) {
				if (Array.isArray(recordValue)) {
					if (!value.some(v => recordValue.includes(v))) return false;
				} else if (!value.includes(recordValue)) return false;
			} else if (recordValue !== value) return false;
		}

		return true;
	}

	/**
	 * Filter by function predicate
	 * @param {Function} predicate - Filter function
	 * @param {Object} options - Filter options
	 * @returns {RecordCollection} Filtered records
	 * @private
	 */
	_filterByFunction (predicate, options) {
		const records = [];

		for (const [key, recordData] of this._store.entries()) {
			const record = RecordFactory.create(key, recordData);
			if (predicate(record)) {
				records.push(record);
			}
		}

		return new RecordCollection(records);
	}

	/**
	 * Filter by object predicate
	 * @param {Object} predicate - Filter object
	 * @param {Object} options - Filter options
	 * @returns {RecordCollection} Filtered records
	 * @private
	 */
	_filterByObject (predicate, options) {
		return this.find(predicate, options);
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
		// Add operation to transaction log
		const [key, data] = args;
		const oldValue = this._store.get(key);

		transaction.addOperation(operation, key, oldValue, data);

		// Execute operation normally
		switch (operation) {
			case "set":
				return this.set(key, data, { transaction: null });
			case "get":
				transaction.addOperation("read", key);

				return this.get(key, { transaction: null });
			case "delete":
				this.delete(key, { transaction: null });

				return true;
			case "find":
				const criteria = key; // In this context, key is criteria
				const options = data; // In this context, data is options

				return this.find(criteria, { ...options, transaction: null });
			default:
				throw new TransactionError(`Unknown operation: ${operation}`, transaction.id, operation);
		}
	}

	/**
	 * Execute batch in transaction
	 * @param {Array} operations - Operations to execute
	 * @param {string} type - Operation type
	 * @param {Transaction} [transaction] - Existing transaction
	 * @returns {Array} Operation results
	 * @private
	 */
	_executeBatchInTransaction (operations, type, transaction) {
		const ownTransaction = !transaction;
		if (ownTransaction) {
			transaction = this.beginTransaction();
		}

		try {
			const results = [];
			for (const operation of operations) {
				if (type === "set") {
					const result = this.set(null, operation, { transaction, batch: true });
					results.push(result);
				} else if (type === "del") {
					this.delete(operation, { transaction, batch: true });
					results.push(true);
				}
			}

			if (ownTransaction) {
				this.commitTransaction(transaction);
			}

			return results;
		} catch (error) {
			if (ownTransaction) {
				this.abortTransaction(transaction, error.message);
			}
			throw error;
		}
	}

	/**
	 * Estimate memory usage
	 * @returns {Object} Memory usage statistics
	 * @private
	 */
	_estimateMemoryUsage () {
		let dataSize = 0;
		for (const [key, value] of this._store.entries()) {
			dataSize += JSON.stringify({ key, value }).length * 2; // UTF-16 estimate
		}

		const indexSize = this.indexManager.getStats().totalMemoryUsage || 0;
		const versionSize = this.versionManager ? this.versionManager.getStats().totalSize : 0;

		return {
			total: dataSize + indexSize + versionSize,
			data: dataSize,
			indexes: indexSize,
			versions: versionSize,
			overhead: indexSize + versionSize
		};
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
	ErrorRecovery
};

// Default export
export default Haro;
