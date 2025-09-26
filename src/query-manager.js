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
			const record = RecordFactory.create(key, recordData);
			if (predicate(record)) {
				if (count >= offset) {
					records.push(record);
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
}
