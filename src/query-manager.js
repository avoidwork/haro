import { QueryError } from "./errors.js";
import { RecordCollection, RecordFactory } from "./record.js";

/**
 * Manages complex querying operations and criteria matching
 */
export class QueryManager {
	/**
	 * @param {Object} dependencies - Required dependencies
	 * @param {StorageManager} dependencies.storageManager - Storage manager
	 * @param {IndexManager} dependencies.indexManager - Index manager
	 * @param {QueryOptimizer} [dependencies.queryOptimizer] - Query optimizer
	 */
	constructor ({ storageManager, indexManager, queryOptimizer = null }) {
		this.storageManager = storageManager;
		this.indexManager = indexManager;
		this.queryOptimizer = queryOptimizer;
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
			offset = 0
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

			// Use index if available
			const fields = Object.keys(criteria);
			const optimalIndex = this.indexManager.getOptimalIndex(fields);

			let recordKeys;
			if (optimalIndex) {
				recordKeys = this.indexManager.findByCriteria(criteria);
			} else {
				// Fallback to full scan
				recordKeys = new Set(this.storageManager.keys());
			}

			// Convert to records and filter
			const records = [];
			for (const key of recordKeys) {
				const recordData = this.storageManager.get(key);
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
		const { limit, offset = 0 } = options;
		const records = [];

		let count = 0;
		for (const [key, recordData] of this.storageManager.entries()) {
			// For backwards compatibility, pass plain objects to predicates
			if (predicate(recordData)) {
				if (count >= offset) {
					records.push(RecordFactory.create(key, recordData));
					if (limit && records.length >= limit) {
						break;
					}
				}
				count++;
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
	 * Search records by value in specified fields
	 * @param {*} value - Search value
	 * @param {string|Array<string>} [fields] - Fields to search
	 * @param {Object} [options={}] - Search options
	 * @returns {RecordCollection} Matching records
	 */
	search (value, fields, options = {}) {
		// Function-based search (delegate to where)
		if (typeof value === "function") {
			return this.where(value, options);
		}

		// If no fields specified, search all available indexes
		if (!fields) {
			const availableIndexes = this.indexManager.listIndexes();
			if (availableIndexes.length === 0) {
				// No indexes, full scan
				return this._fullScanSearch(value, options);
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
				const searchKeys = this._searchField(field, value);
				searchKeys.forEach(key => matchingKeys.add(key));
			}
		}

		// Convert keys to RecordCollection
		return this._keysToRecordCollection(matchingKeys);
	}

	/**
	 * Filter records using a predicate function
	 * @param {Function} predicate - Filter predicate
	 * @param {Object} [options={}] - Filter options
	 * @returns {RecordCollection} Filtered records
	 */
	filter (predicate, options = {}) {
		return this._filterByFunction(predicate, options);
	}

	/**
	 * Map over records and transform them
	 * @param {Function} mapper - Mapping function
	 * @param {Object} [options={}] - Map options
	 * @returns {Array} Mapped results
	 */
	map (mapper, options = {}) {
		const { limit, offset = 0 } = options;
		const results = [];
		let count = 0;

		for (const [, recordData] of this.storageManager.entries()) {
			if (count >= offset) {
				// For backwards compatibility, pass plain objects to mapper
				results.push(mapper(recordData));
				if (limit && results.length >= limit) {
					break;
				}
			}
			count++;
		}

		return results;
	}

	/**
	 * Reduce records to a single value
	 * @param {Function} reducer - Reducer function
	 * @param {*} initialValue - Initial value
	 * @param {Object} [options={}] - Reduce options
	 * @returns {*} Reduced value
	 */
	reduce (reducer, initialValue, options = {}) {
		const { limit, offset = 0 } = options;
		let accumulator = initialValue;
		let count = 0;
		let processedCount = 0;

		for (const [, recordData] of this.storageManager.entries()) {
			if (count >= offset) {
				// For backwards compatibility, pass plain objects to reducer
				accumulator = reducer(accumulator, recordData, processedCount);
				processedCount++;
				if (limit && processedCount >= limit) {
					break;
				}
			}
			count++;
		}

		return accumulator;
	}

	/**
	 * Execute a function for each record
	 * @param {Function} callback - Callback function
	 * @param {Object} [options={}] - Options
	 */
	forEach (callback, options = {}) {
		const { limit, offset = 0 } = options;
		let count = 0;
		let processedCount = 0;

		for (const [, recordData] of this.storageManager.entries()) {
			if (count >= offset) {
				// For backwards compatibility, pass plain objects to callback
				callback(recordData, processedCount);
				processedCount++;
				if (limit && processedCount >= limit) {
					break;
				}
			}
			count++;
		}
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
			// For exact matches, use IndexManager's findByIndex method
			if (typeof value === "string" && !value.includes("*") && !value.includes("?")) {
				const exactKeys = this.indexManager.findByIndex(indexName, value);
				exactKeys.forEach(key => matchingKeys.add(key));
			} else {
				// For partial matches, search through all index keys
				const indexStorage = this.indexManager._indexes.get(indexName);
				if (indexStorage) {
					for (const [indexKey, recordKeys] of indexStorage._storage.entries()) {
						if (this._matchesSearchValue(indexKey, value)) {
							recordKeys.forEach(key => matchingKeys.add(key));
						}
					}
				}
			}
		} catch {
			// Fallback to empty set on error
		}

		return matchingKeys;
	}

	/**
	 * Search within a specific field (non-indexed)
	 * @param {string} field - Field name
	 * @param {*} value - Search value
	 * @returns {Set<string>} Set of matching record keys
	 * @private
	 */
	_searchField (field, value) {
		const matchingKeys = new Set();

		for (const [key, recordData] of this.storageManager.entries()) {
			const fieldValue = this._getFieldValue(recordData, field);
			if (this._matchesSearchValue(fieldValue, value)) {
				matchingKeys.add(key);
			}
		}

		return matchingKeys;
	}

	/**
	 * Perform full scan search when no indexes available
	 * @param {*} value - Search value
	 * @param {Object} options - Search options
	 * @returns {RecordCollection} Matching records
	 * @private
	 */
	_fullScanSearch (value, options) {
		const records = [];
		const { limit, offset = 0 } = options;
		let count = 0;

		for (const [key, recordData] of this.storageManager.entries()) {
			if (this._searchInRecord(recordData, value)) {
				if (count >= offset) {
					records.push(RecordFactory.create(key, recordData));
					if (limit && records.length >= limit) {
						break;
					}
				}
				count++;
			}
		}

		return new RecordCollection(records);
	}

	/**
	 * Convert a set of keys to a RecordCollection
	 * @param {Set<string>|Array<string>} keys - Record keys
	 * @returns {RecordCollection} Collection of Record objects
	 * @private
	 */
	_keysToRecordCollection (keys) {
		const results = [];
		for (const key of keys) {
			const recordData = this.storageManager.get(key);
			if (recordData) {
				results.push(RecordFactory.create(key, recordData));
			}
		}

		return new RecordCollection(results);
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
	_matchesSearchValue (fieldValue, searchValue) {
		if (searchValue instanceof RegExp) {
			return searchValue.test(String(fieldValue));
		}

		if (typeof searchValue === "string") {
			return String(fieldValue).toLowerCase().includes(searchValue.toLowerCase());
		}

		return fieldValue === searchValue;
	}

	/**
	 * Search within a record for a value
	 * @param {Object} record - Record to search
	 * @param {*} value - Value to search for
	 * @returns {boolean} True if found
	 * @private
	 */
	_searchInRecord (record, value) {
		const searchString = String(value).toLowerCase();

		const searchObject = obj => {
			for (const val of Object.values(obj)) {
				if (val !== null && val !== undefined) {
					if (typeof val === "object") {
						if (Array.isArray(val)) {
							if (val.some(item => String(item).toLowerCase().includes(searchString))) {
								return true;
							}
						} else if (searchObject(val)) {
							return true;
						}
					} else if (String(val).toLowerCase().includes(searchString)) {
						return true;
					}
				}
			}

			return false;
		};

		return searchObject(record);
	}
}
