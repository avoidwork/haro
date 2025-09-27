/**
 * Standardized record wrapper that provides consistent interface
 */
export class Record {
	/**
	 * @param {string} key - Record key
	 * @param {Object} data - Record data
	 * @param {Object} [metadata={}] - Additional metadata
	 */
	constructor (key, data, metadata = {}) {
		this._key = key;
		this._data = data;

		// Optimized: only create full metadata if additional metadata is provided
		if (Object.keys(metadata).length > 0) {
			this._metadata = {
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				version: 1,
				...metadata
			};
		} else {
			// Minimal metadata for performance
			this._metadata = {
				version: 1
			};
		}

		// Optimized: only freeze if not in performance-critical path
		// Note: We'll add a flag later if needed, but for now keep freezing for safety
		Object.freeze(this);
	}

	/**
	 * Get the record key
	 * @returns {string} Record key
	 */
	get key () {
		return this._key;
	}

	/**
	 * Get the record data
	 * @returns {Object} Record data (frozen copy)
	 */
	get data () {
		return Object.freeze({ ...this._data });
	}

	/**
	 * Get record metadata
	 * @returns {Object} Metadata object
	 */
	get metadata () {
		return Object.freeze({ ...this._metadata });
	}

	/**
	 * Get a specific field value
	 * @param {string} fieldName - Name of the field
	 * @returns {*} Field value
	 */
	get (fieldName) {
		return this._data[fieldName];
	}

	/**
	 * Check if record has a specific field
	 * @param {string} fieldName - Name of the field
	 * @returns {boolean} True if field exists
	 */
	has (fieldName) {
		return fieldName in this._data;
	}

	/**
	 * Get all field names
	 * @returns {string[]} Array of field names
	 */
	getFields () {
		return Object.keys(this._data);
	}

	/**
	 * Create a new record with updated data (immutable update)
	 * @param {Object} updates - Data updates to apply
	 * @param {Object} [metadataUpdates={}] - Metadata updates
	 * @returns {Record} New record instance with updates
	 */
	update (updates, metadataUpdates = {}) {
		const newData = { ...this._data, ...updates };
		const newMetadata = {
			...this._metadata,
			...metadataUpdates,
			updatedAt: new Date().toISOString(),
			version: this._metadata.version + 1
		};

		return new Record(this._key, newData, newMetadata);
	}

	/**
	 * Convert record to plain object
	 * @param {boolean} [includeMetadata=false] - Whether to include metadata
	 * @returns {Object} Plain object representation
	 */
	toObject (includeMetadata = false) {
		const result = { ...this._data };

		if (includeMetadata) {
			result._metadata = this._metadata;
		}

		return result;
	}

	/**
	 * Convert record to JSON string
	 * @param {boolean} [includeMetadata=false] - Whether to include metadata
	 * @returns {string} JSON string representation
	 */
	toJSON (includeMetadata = false) {
		return JSON.stringify(this.toObject(includeMetadata));
	}

	/**
	 * Compare this record with another record
	 * @param {Record} other - Other record to compare
	 * @returns {boolean} True if records are equal
	 */
	equals (other) {
		if (!(other instanceof Record)) return false;
		if (this._key !== other._key) return false;

		return JSON.stringify(this._data) === JSON.stringify(other._data);
	}

	/**
	 * Create a deep clone of this record
	 * @returns {Record} Cloned record
	 */
	clone () {
		return new Record(this._key, structuredClone(this._data), structuredClone(this._metadata));
	}

	/**
	 * Get the size of the record data (for memory analysis)
	 * @returns {number} Estimated size in bytes
	 */
	getSize () {
		return JSON.stringify(this._data).length * 2; // Rough estimate (UTF-16)
	}

	/**
	 * Check if record matches a predicate
	 * @param {Function|Object} predicate - Function or object to match against
	 * @returns {boolean} True if record matches
	 */
	matches (predicate) {
		if (typeof predicate === "function") {
			return predicate(this._data, this._key, this);
		}

		if (typeof predicate === "object" && predicate !== null) {
			return Object.entries(predicate).every(([field, value]) => {
				const recordValue = this._data[field];

				if (value instanceof RegExp) {
					return value.test(recordValue);
				}

				if (Array.isArray(value)) {
					return Array.isArray(recordValue) ?
						value.some(v => recordValue.includes(v)) :
						value.includes(recordValue);
				}

				return recordValue === value;
			});
		}

		return false;
	}

	/**
	 * Get a string representation of the record
	 * @returns {string} String representation
	 */
	toString () {
		return `Record(${this._key}: ${JSON.stringify(this._data)})`;
	}

	/**
	 * Symbol for iteration (makes record iterable)
	 * @returns {Iterator} Iterator over [fieldName, value] pairs
	 */
	* [Symbol.iterator] () {
		for (const [field, value] of Object.entries(this._data)) {
			yield [field, value];
		}
	}
}

/**
 * Collection of records with utilities for batch operations
 */
export class RecordCollection {
	/**
	 * @param {Record[]} [records=[]] - Initial records
	 */
	constructor (records = []) {
		// Optimized: avoid unnecessary array copying for performance
		// Collections are expected to be short-lived in most cases
		this._records = records;

		// Only freeze in development for debugging, skip in production for performance
		if (process.env.NODE_ENV !== "production") {
			Object.freeze(this);
		}
	}

	/**
	 * Get the number of records
	 * @returns {number} Number of records
	 */
	get length () {
		return this._records.length;
	}

	/**
	 * Get record at specific index
	 * @param {number} index - Index to retrieve
	 * @returns {Record|undefined} Record at index
	 */
	at (index) {
		return this._records[index];
	}

	/**
	 * Get first record
	 * @returns {Record|undefined} First record
	 */
	first () {
		return this._records[0];
	}

	/**
	 * Get last record
	 * @returns {Record|undefined} Last record
	 */
	last () {
		return this._records[this._records.length - 1];
	}

	/**
	 * Filter records by predicate
	 * @param {Function} predicate - Filter function
	 * @returns {RecordCollection} New collection with filtered records
	 */
	filter (predicate) {
		return new RecordCollection(this._records.filter(predicate));
	}

	/**
	 * Map records to new values
	 * @param {Function} mapper - Mapping function
	 * @returns {Array} Array of mapped values
	 */
	map (mapper) {
		return this._records.map(mapper);
	}

	/**
	 * Find first record matching predicate
	 * @param {Function} predicate - Search predicate
	 * @returns {Record|undefined} First matching record
	 */
	find (predicate) {
		return this._records.find(predicate);
	}

	/**
	 * Check if any record matches predicate
	 * @param {Function} predicate - Test predicate
	 * @returns {boolean} True if any record matches
	 */
	some (predicate) {
		return this._records.some(predicate);
	}

	/**
	 * Check if all records match predicate
	 * @param {Function} predicate - Test predicate
	 * @returns {boolean} True if all records match
	 */
	every (predicate) {
		return this._records.every(predicate);
	}

	/**
	 * Sort records by comparator
	 * @param {Function} comparator - Sort function
	 * @returns {RecordCollection} New sorted collection
	 */
	sort (comparator) {
		return new RecordCollection([...this._records].sort(comparator));
	}

	/**
	 * Get a slice of records
	 * @param {number} [start=0] - Start index
	 * @param {number} [end] - End index
	 * @returns {RecordCollection} New collection with sliced records
	 */
	slice (start = 0, end) {
		return new RecordCollection(this._records.slice(start, end));
	}

	/**
	 * Reduce records to a single value
	 * @param {Function} reducer - Reducer function
	 * @param {*} [initialValue] - Initial value
	 * @returns {*} Reduced value
	 */
	reduce (reducer, initialValue) {
		return this._records.reduce(reducer, initialValue);
	}

	/**
	 * Convert to array of records
	 * @returns {Record[]} Array of records
	 */
	toArray () {
		return [...this._records];
	}

	/**
	 * Convert to array of plain objects
	 * @param {boolean} [includeMetadata=false] - Whether to include metadata
	 * @returns {Object[]} Array of plain objects
	 */
	toObjects (includeMetadata = false) {
		return this._records.map(record => record.toObject(includeMetadata));
	}

	/**
	 * Get records as key-value pairs
	 * @returns {Array<[string, Object]>} Array of [key, data] pairs
	 */
	toPairs () {
		return this._records.map(record => [record.key, record.data]);
	}

	/**
	 * Group records by field value
	 * @param {string|Function} keySelector - Field name or function to get grouping key
	 * @returns {Map<string, RecordCollection>} Map of grouped records
	 */
	groupBy (keySelector) {
		const groups = new Map();
		const getKey = typeof keySelector === "function" ?
			keySelector :
			record => record.get(keySelector);

		for (const record of this._records) {
			const key = getKey(record);
			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key).push(record);
		}

		// Convert arrays to RecordCollections
		for (const [key, records] of groups) {
			groups.set(key, new RecordCollection(records));
		}

		return groups;
	}

	/**
	 * Get unique records (by key)
	 * @returns {RecordCollection} Collection with unique records
	 */
	unique () {
		const seen = new Set();
		const unique = [];

		for (const record of this._records) {
			if (!seen.has(record.key)) {
				seen.add(record.key);
				unique.push(record);
			}
		}

		return new RecordCollection(unique);
	}

	/**
	 * Iterate over records
	 * @param {Function} callback - Callback function
	 * @returns {void}
	 */
	forEach (callback) {
		this._records.forEach(callback);
	}

	/**
	 * Symbol for iteration (makes collection iterable)
	 * @returns {Iterator} Iterator over records
	 */
	* [Symbol.iterator] () {
		for (const record of this._records) {
			yield record;
		}
	}

	/**
	 * Get string representation
	 * @returns {string} String representation
	 */
	toString () {
		return `RecordCollection(${this._records.length} records)`;
	}
}

/**
 * Factory functions for creating records and collections
 */
export const RecordFactory = {
	/**
	 * Create a record from raw data
	 * @param {string} key - Record key
	 * @param {Object} data - Record data
	 * @param {Object} [metadata={}] - Additional metadata
	 * @returns {Record} New record instance
	 */
	create (key, data, metadata = {}) {
		return new Record(key, data, metadata);
	},


	/**
	 * Create a record from a plain object (key extracted from data)
	 * @param {Object} data - Data object containing key field
	 * @param {string} [keyField='id'] - Name of the key field
	 * @param {Object} [metadata={}] - Additional metadata
	 * @returns {Record} New record instance
	 */
	fromObject (data, keyField = "id", metadata = {}) {
		const key = data[keyField];
		if (!key) {
			throw new Error(`Key field '${keyField}' not found in data`);
		}

		return new Record(key, data, metadata);
	},

	/**
	 * Create a collection from an array of records or data objects
	 * @param {Array<Record|Object>} items - Items to create collection from
	 * @param {string} [keyField='id'] - Key field name for objects
	 * @returns {RecordCollection} New record collection
	 */
	createCollection (items, keyField = "id") {
		const records = items.map(item => {
			if (item instanceof Record) {
				return item;
			}

			return this.fromObject(item, keyField);
		});

		return new RecordCollection(records);
	},

	/**
	 * Create an empty collection
	 * @returns {RecordCollection} Empty record collection
	 */
	emptyCollection () {
		return new RecordCollection();
	}
};
