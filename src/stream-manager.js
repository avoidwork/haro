import { DataStream } from "./data-stream.js";

/**
 * Manages streaming operations for large datasets
 */
export class StreamManager {
	/**
	 * @param {Object} dependencies - Required dependencies
	 * @param {StorageManager} dependencies.storageManager - Storage manager
	 */
	constructor ({ storageManager }) {
		this.storageManager = storageManager;
	}

	/**
	 * Create a data stream for large datasets
	 * @param {Object} [options={}] - Stream options
	 * @returns {DataStream} Data stream instance
	 */
	stream (options = {}) {
		const entries = this.storageManager.entries();
		let index = 0;

		const iterator = {
			next: () => {
				if (index < entries.length) {
					return { value: entries[index++], done: false };
				}

				return { done: true };
			}
		};

		return new DataStream(iterator, options);
	}

	/**
	 * Create a filtered stream
	 * @param {Function|Object} predicate - Filter predicate
	 * @param {Object} [options={}] - Stream options
	 * @returns {DataStream} Filtered stream
	 */
	streamWhere (predicate, options = {}) {
		const iterator = this._createFilteredIterator(predicate);

		return new DataStream(iterator, options);
	}

	/**
	 * Create a transformed stream
	 * @param {Function} transform - Transform function
	 * @param {Object} [options={}] - Stream options
	 * @returns {DataStream} Transformed stream
	 */
	streamMap (transform, options = {}) {
		const iterator = this._createTransformIterator(transform);

		return new DataStream(iterator, options);
	}

	/**
	 * Create a limited stream
	 * @param {number} limit - Maximum number of records
	 * @param {Object} [options={}] - Stream options
	 * @returns {DataStream} Limited stream
	 */
	streamTake (limit, options = {}) {
		const iterator = this._createLimitedIterator(limit);

		return new DataStream(iterator, options);
	}

	/**
	 * Create iterator for filtered data
	 * @param {Function|Object} predicate - Filter predicate
	 * @returns {Iterator} Filtered iterator
	 * @private
	 */
	_createFilteredIterator (predicate) {
		const entries = this.storageManager.entries();
		let index = 0;

		return {
			next: () => {
				while (index < entries.length) {
					const [key, value] = entries[index++];

					if (typeof predicate === "function") {
						if (predicate({ key, ...value })) {
							return { value: [key, value], done: false };
						}
					} else if (typeof predicate === "object") {
						if (this._matchesCriteria(value, predicate)) {
							return { value: [key, value], done: false };
						}
					}
				}

				return { done: true };
			}
		};
	}

	/**
	 * Create iterator for transformed data
	 * @param {Function} transform - Transform function
	 * @returns {Iterator} Transform iterator
	 * @private
	 */
	_createTransformIterator (transform) {
		const entries = this.storageManager.entries();
		let index = 0;

		return {
			next: () => {
				if (index < entries.length) {
					const [key, value] = entries[index++];
					const transformed = transform({ key, ...value });

					return { value: [key, transformed], done: false };
				}

				return { done: true };
			}
		};
	}

	/**
	 * Create iterator for limited data
	 * @param {number} limit - Record limit
	 * @returns {Iterator} Limited iterator
	 * @private
	 */
	_createLimitedIterator (limit) {
		const entries = this.storageManager.entries();
		let index = 0;

		return {
			next: () => {
				if (index < limit && index < entries.length) {
					const entry = entries[index++];

					return { value: entry, done: false };
				}

				return { done: true };
			}
		};
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
}
