import { IndexError } from "./errors.js";

/**
 * Types of indexes supported
 */
export const IndexTypes = {
	SINGLE: "single",
	COMPOSITE: "composite",
	ARRAY: "array",
	PARTIAL: "partial"
};

/**
 * Index definition with metadata
 */
export class IndexDefinition {
	/**
	 * @param {string} name - Index name
	 * @param {string[]} fields - Field names to index
	 * @param {Object} [options={}] - Index options
	 * @param {string} [options.type=IndexTypes.SINGLE] - Index type
	 * @param {boolean} [options.unique=false] - Whether values should be unique
	 * @param {Function} [options.filter] - Filter function for partial indexes
	 * @param {Function} [options.transform] - Transform function for index values
	 * @param {string} [options.delimiter='|'] - Delimiter for composite indexes
	 */
	constructor (name, fields, {
		type = IndexTypes.SINGLE,
		unique = false,
		filter,
		transform,
		delimiter = "|"
	} = {}) {
		this.name = name;
		this.fields = Array.isArray(fields) ? fields : [fields];
		this.type = this._determineType(this.fields, type);
		this.unique = unique;
		this.filter = filter;
		this.transform = transform;
		this.delimiter = delimiter;
		this.createdAt = new Date();
		this.stats = {
			totalKeys: 0,
			totalEntries: 0,
			memoryUsage: 0,
			lastUpdated: new Date()
		};
	}

	/**
	 * Determine index type based on fields
	 * @param {string[]} fields - Field names
	 * @param {string} suggestedType - Suggested type
	 * @returns {string} Determined index type
	 * @private
	 */
	_determineType (fields, suggestedType) {
		if (suggestedType === IndexTypes.PARTIAL) {
			return IndexTypes.PARTIAL;
		}

		if (fields.length > 1) {
			return IndexTypes.COMPOSITE;
		}

		return IndexTypes.SINGLE;
	}

	/**
	 * Generate index keys for a record
	 * @param {Object} record - Record data
	 * @returns {string[]} Array of index keys
	 */
	generateKeys (record) {
		// Apply filter for partial indexes
		if (this.filter && !this.filter(record)) {
			return [];
		}

		const keys = this._extractKeys(record);

		// Apply transform if specified
		if (this.transform) {
			return keys.map(key => this.transform(key, record));
		}

		return keys;
	}

	/**
	 * Extract raw keys from record
	 * @param {Object} record - Record data
	 * @returns {string[]} Array of raw keys
	 * @private
	 */
	_extractKeys (record) {
		if (this.type === IndexTypes.COMPOSITE) {
			return this._generateCompositeKeys(record);
		}

		const field = this.fields[0];
		const value = record[field];

		if (value === undefined || value === null) {
			return [];
		}

		// Handle array fields
		if (Array.isArray(value)) {
			return value.map(v => String(v));
		}

		return [String(value)];
	}

	/**
	 * Generate composite keys
	 * @param {Object} record - Record data
	 * @returns {string[]} Array of composite keys
	 * @private
	 */
	_generateCompositeKeys (record) {
		let keys = [""];

		for (const field of this.fields.sort()) {
			const value = record[field];
			if (value === undefined || value === null) {
				return []; // Skip records with missing composite fields
			}

			const values = Array.isArray(value) ? value : [value];
			const newKeys = [];

			for (const existingKey of keys) {
				for (const val of values) {
					const newKey = existingKey === "" ?
						String(val) :
						`${existingKey}${this.delimiter}${String(val)}`;
					newKeys.push(newKey);
				}
			}

			keys = newKeys;
		}

		return keys;
	}

	/**
	 * Update statistics
	 * @param {number} keyCount - Number of keys
	 * @param {number} entryCount - Number of entries
	 * @param {number} memoryDelta - Memory change in bytes
	 */
	updateStats (keyCount, entryCount, memoryDelta) {
		this.stats.totalKeys = keyCount;
		this.stats.totalEntries = entryCount;
		this.stats.memoryUsage += memoryDelta;
		this.stats.lastUpdated = new Date();
	}
}

/**
 * Memory-efficient index storage with reference counting
 */
export class IndexStorage {
	constructor () {
		// Map<indexKey, Set<recordKey>>
		this._storage = new Map();
		// Track reference counts for memory management
		this._refCounts = new Map();
	}

	/**
	 * Add a record to index
	 * @param {string} indexKey - Index key
	 * @param {string} recordKey - Record key
	 */
	add (indexKey, recordKey) {
		if (!this._storage.has(indexKey)) {
			this._storage.set(indexKey, new Set());
			this._refCounts.set(indexKey, 0);
		}

		const recordSet = this._storage.get(indexKey);
		if (!recordSet.has(recordKey)) {
			recordSet.add(recordKey);
			this._refCounts.set(indexKey, this._refCounts.get(indexKey) + 1);
		}
	}

	/**
	 * Remove a record from index
	 * @param {string} indexKey - Index key
	 * @param {string} recordKey - Record key
	 * @returns {boolean} True if record was removed
	 */
	remove (indexKey, recordKey) {
		const recordSet = this._storage.get(indexKey);
		if (!recordSet) {
			return false;
		}

		const removed = recordSet.delete(recordKey);
		if (removed) {
			const newCount = this._refCounts.get(indexKey) - 1;
			if (newCount === 0) {
				// Clean up empty index keys
				this._storage.delete(indexKey);
				this._refCounts.delete(indexKey);
			} else {
				this._refCounts.set(indexKey, newCount);
			}
		}

		return removed;
	}

	/**
	 * Get records for index key
	 * @param {string} indexKey - Index key
	 * @returns {Set<string>} Set of record keys
	 */
	get (indexKey) {
		return this._storage.get(indexKey) || new Set();
	}

	/**
	 * Check if index key exists
	 * @param {string} indexKey - Index key
	 * @returns {boolean} True if key exists
	 */
	has (indexKey) {
		return this._storage.has(indexKey);
	}

	/**
	 * Get all index keys
	 * @returns {string[]} Array of index keys
	 */
	keys () {
		return Array.from(this._storage.keys());
	}

	/**
	 * Get index statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		let totalEntries = 0;
		for (const recordSet of this._storage.values()) {
			totalEntries += recordSet.size;
		}

		return {
			totalKeys: this._storage.size,
			totalEntries,
			memoryUsage: this._estimateMemoryUsage()
		};
	}

	/**
	 * Clear all index data
	 */
	clear () {
		this._storage.clear();
		this._refCounts.clear();
	}

	/**
	 * Estimate memory usage in bytes
	 * @returns {number} Estimated memory usage
	 * @private
	 */
	_estimateMemoryUsage () {
		let size = 0;

		for (const [key, recordSet] of this._storage) {
			// Estimate key size (string)
			size += key.length * 2;

			// Estimate Set overhead + record keys
			size += 64; // Set object overhead
			for (const recordKey of recordSet) {
				size += recordKey.length * 2;
			}
		}

		return size;
	}
}

/**
 * Index manager that handles multiple indexes efficiently
 */
export class IndexManager {
	/**
	 * @param {string} [delimiter='|'] - Default delimiter for composite indexes
	 */
	constructor (delimiter = "|") {
		this.delimiter = delimiter;
		// Map<indexName, IndexDefinition>
		this._definitions = new Map();
		// Map<indexName, IndexStorage>
		this._indexes = new Map();
		// Performance tracking
		this._stats = {
			totalOperations: 0,
			totalTime: 0,
			lastOptimized: new Date()
		};
	}

	/**
	 * Create a new index
	 * @param {string} name - Index name
	 * @param {string|string[]} fields - Field name(s) to index
	 * @param {Object} [options={}] - Index options
	 * @returns {IndexManager} This instance for chaining
	 * @throws {IndexError} If index already exists or configuration is invalid
	 */
	createIndex (name, fields, options = {}) {
		if (this._definitions.has(name)) {
			throw new IndexError(`Index '${name}' already exists`, name, "create");
		}

		const definition = new IndexDefinition(name, fields, {
			delimiter: this.delimiter,
			...options
		});

		this._definitions.set(name, definition);
		this._indexes.set(name, new IndexStorage());

		return this;
	}

	/**
	 * Drop an index
	 * @param {string} name - Index name
	 * @returns {IndexManager} This instance for chaining
	 * @throws {IndexError} If index doesn't exist
	 */
	dropIndex (name) {
		if (!this._definitions.has(name)) {
			throw new IndexError(`Index '${name}' does not exist`, name, "drop");
		}

		this._definitions.delete(name);
		this._indexes.delete(name);

		return this;
	}

	/**
	 * Check if index exists
	 * @param {string} name - Index name
	 * @returns {boolean} True if index exists
	 */
	hasIndex (name) {
		return this._definitions.has(name);
	}

	/**
	 * Get index definition
	 * @param {string} name - Index name
	 * @returns {IndexDefinition|undefined} Index definition
	 */
	getIndexDefinition (name) {
		return this._definitions.get(name);
	}

	/**
	 * List all indexes
	 * @returns {string[]} Array of index names
	 */
	listIndexes () {
		return Array.from(this._definitions.keys());
	}

	/**
	 * Add a record to all applicable indexes
	 * @param {string} recordKey - Record key
	 * @param {Object} recordData - Record data
	 * @throws {IndexError} If unique constraint is violated
	 */
	addRecord (recordKey, recordData) {
		const startTime = Date.now();

		for (const [indexName, definition] of this._definitions) {
			const storage = this._indexes.get(indexName);
			const indexKeys = definition.generateKeys(recordData);

			for (const indexKey of indexKeys) {
				// Check unique constraint
				if (definition.unique && storage.has(indexKey)) {
					const existingRecords = storage.get(indexKey);
					if (existingRecords.size > 0 && !existingRecords.has(recordKey)) {
						throw new IndexError(
							`Unique constraint violation on index '${indexName}' for value '${indexKey}'`,
							indexName,
							"add"
						);
					}
				}

				storage.add(indexKey, recordKey);
			}

			// Update statistics
			const stats = storage.getStats();
			definition.updateStats(stats.totalKeys, stats.totalEntries, 0);
		}

		this._updatePerformanceStats(Date.now() - startTime);
	}

	/**
	 * Remove a record from all indexes
	 * @param {string} recordKey - Record key
	 * @param {Object} recordData - Record data
	 */
	removeRecord (recordKey, recordData) {
		const startTime = Date.now();

		for (const [indexName, definition] of this._definitions) {
			const storage = this._indexes.get(indexName);
			const indexKeys = definition.generateKeys(recordData);

			for (const indexKey of indexKeys) {
				storage.remove(indexKey, recordKey);
			}

			// Update statistics
			const stats = storage.getStats();
			definition.updateStats(stats.totalKeys, stats.totalEntries, 0);
		}

		this._updatePerformanceStats(Date.now() - startTime);
	}

	/**
	 * Update a record in indexes (remove old, add new)
	 * @param {string} recordKey - Record key
	 * @param {Object} oldData - Old record data
	 * @param {Object} newData - New record data
	 */
	updateRecord (recordKey, oldData, newData) {
		this.removeRecord(recordKey, oldData);
		this.addRecord(recordKey, newData);
	}

	/**
	 * Find records using index
	 * @param {string} indexName - Index name
	 * @param {string} indexKey - Index key to search for
	 * @returns {Set<string>} Set of record keys
	 * @throws {IndexError} If index doesn't exist
	 */
	findByIndex (indexName, indexKey) {
		const storage = this._indexes.get(indexName);
		if (!storage) {
			throw new IndexError(`Index '${indexName}' does not exist`, indexName, "query");
		}

		return new Set(storage.get(indexKey));
	}

	/**
	 * Find records using multiple criteria (intersection)
	 * @param {Object} criteria - Object with index names as keys and search values as values
	 * @returns {Set<string>} Set of record keys that match all criteria
	 */
	findByCriteria (criteria) {
		const indexNames = Object.keys(criteria);
		if (indexNames.length === 0) {
			return new Set();
		}

		let result = null;

		for (const indexName of indexNames) {
			const indexKey = String(criteria[indexName]);
			const records = this.findByIndex(indexName, indexKey);

			if (result === null) {
				result = records;
			} else {
				// Intersection
				result = new Set([...result].filter(key => records.has(key)));
			}

			// Early termination if no matches
			if (result.size === 0) {
				break;
			}
		}

		return result || new Set();
	}

	/**
	 * Get optimal index for query fields
	 * @param {string[]} fields - Fields being queried
	 * @returns {string|null} Best index name or null if no suitable index
	 */
	getOptimalIndex (fields) {
		const sortedFields = [...fields].sort();

		// Look for exact match first
		for (const [name, definition] of this._definitions) {
			const indexFields = [...definition.fields].sort();
			if (JSON.stringify(indexFields) === JSON.stringify(sortedFields)) {
				return name;
			}
		}

		// Look for index that covers all fields
		for (const [name, definition] of this._definitions) {
			if (fields.every(field => definition.fields.includes(field))) {
				return name;
			}
		}

		// Look for index that covers some fields (prefer single field indexes)
		const candidates = [];
		for (const [name, definition] of this._definitions) {
			const coverage = fields.filter(field => definition.fields.includes(field)).length;
			if (coverage > 0) {
				candidates.push({ name, coverage, fields: definition.fields.length });
			}
		}

		if (candidates.length > 0) {
			// Sort by coverage (descending) then by field count (ascending)
			candidates.sort((a, b) => {
				if (a.coverage !== b.coverage) {
					return b.coverage - a.coverage;
				}

				return a.fields - b.fields;
			});

			return candidates[0].name;
		}

		return null;
	}

	/**
	 * Rebuild all indexes from scratch
	 * @param {Map<string, Object>} records - All records to reindex
	 */
	rebuild (records) {
		// Clear all indexes
		for (const storage of this._indexes.values()) {
			storage.clear();
		}

		// Rebuild from records
		for (const [recordKey, recordData] of records) {
			this.addRecord(recordKey, recordData);
		}

		this._stats.lastOptimized = new Date();
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		const indexStats = {};
		let totalMemory = 0;

		for (const [name, definition] of this._definitions) {
			const storage = this._indexes.get(name);
			const stats = storage.getStats();
			indexStats[name] = {
				...definition.stats,
				...stats,
				type: definition.type,
				fields: definition.fields
			};
			totalMemory += stats.memoryUsage;
		}

		return {
			indexes: indexStats,
			totalIndexes: this._definitions.size,
			totalMemoryUsage: totalMemory,
			performance: {
				...this._stats,
				averageOperationTime: this._stats.totalOperations > 0 ?
					this._stats.totalTime / this._stats.totalOperations :
					0
			}
		};
	}

	/**
	 * Clear all indexes
	 */
	clear () {
		for (const storage of this._indexes.values()) {
			storage.clear();
		}
	}

	/**
	 * Update performance statistics
	 * @param {number} operationTime - Time taken for operation in ms
	 * @private
	 */
	_updatePerformanceStats (operationTime) {
		this._stats.totalOperations++;
		this._stats.totalTime += operationTime;
	}
}
