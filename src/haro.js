import {randomUUID as uuid} from "crypto";
import {
	STRING_COMMA,
	STRING_DEL,
	STRING_DOUBLE_AND,
	STRING_DOUBLE_PIPE,
	STRING_FUNCTION,
	STRING_ID,
	STRING_INDEXES,
	STRING_INVALID_FIELD,
	STRING_INVALID_FUNCTION,
	STRING_INVALID_TYPE,
	STRING_OBJECT,
	STRING_PIPE,
	STRING_RECORD_NOT_FOUND,
	STRING_RECORDS,
	STRING_REGISTRY,
	STRING_SET,
	STRING_SIZE,
	STRING_STRING,
	STRING_NUMBER
} from "./constants.js";

/**
 * Haro is a modern immutable DataStore for collections of records with indexing,
 * versioning, and batch operations support. Records retrieved from the store are
 * always frozen (immutable) to prevent external mutation of internal state.
 * @class
 * @example
 * const store = new Haro({
 *   index: ['name', 'age'],
 *   key: 'id',
 *   versioning: true
 * });
 *
 * store.set({name: 'John', age: 30});
 * const results = store.find({name: 'John'});
 */
export class Haro {
	/**
	 * Creates a new Haro instance with specified configuration
	 * @param {Object} [config={}] - Configuration object for the store
	 * @param {string} [config.delimiter='|'] - Delimiter for composite indexes (default: '|')
	 * @param {string} [config.id] - Unique identifier for this instance (auto-generated if not provided)
	 * @param {string[]} [config.index=[]] - Array of field names to create indexes for
	 * @param {string} [config.key='id'] - Primary key field name used for record identification
	 * @param {boolean} [config.versioning=false] - Enable versioning to track record changes
	 * @constructor
	 * @example
	 * const store = new Haro({
	 *   index: ['name', 'email', 'name|department'],
	 *   key: 'userId',
	 *   versioning: true
	 * });
	 */
	constructor ({delimiter = STRING_PIPE, id, index = [], key = STRING_ID, versioning = false} = {}) {
		this.data = new Map();
		this.delimiter = delimiter;
		this.id = id ?? uuid();
		this.index = Array.isArray(index) ? [...index] : [];
		this.indexes = new Map();
		this.key = key;
		this.versioning = versioning;
		this.versions = versioning ? new Map() : null;
		this._registry = [];

		Object.defineProperty(this, STRING_REGISTRY, {enumerable: true, get: () => [...this._registry]});
		Object.defineProperty(this, STRING_SIZE, {enumerable: true, get: () => this.data.size});

		this._buildIndexes();
	}

	/**
	 * Creates a deep clone of the given value using structuredClone or JSON fallback
	 * @param {*} value - Value to clone
	 * @returns {*} Deep clone of the value
	 * @private
	 */
	_clone(value) {
		try {
			return structuredClone(value);
		} catch {
			return JSON.parse(JSON.stringify(value));
		}
	}

	/**
	 * Recursively freezes a value and all its nested properties
	 * @param {*} value - Value to freeze
	 * @returns {*} Frozen value
	 * @private
	 */
	_freeze(value) {
		if (value === null || value === undefined) return value;
		if (Array.isArray(value)) {
			return Object.freeze(value.map(i => this._freeze(i)));
		}
		if (typeof value === STRING_OBJECT && value !== null) {
			const frozen = {};
			for (const k of Object.keys(value)) {
				frozen[k] = this._freeze(value[k]);
			}
			return Object.freeze(frozen);
		}
		return value;
	}

	/**
	 * Adds entries to indexes for a record
	 * @param {string} key - Key of the record
	 * @param {Object} data - Record data
	 * @param {string[]} [indices] - Specific indexes to update, or all if not specified
	 * @private
	 */
	_setIndex(key, data, indices) {
		const toIndex = indices ?? this.index;
		for (const field of toIndex) {
			let idx = this.indexes.get(field);
			if (!idx) {
				idx = new Map();
				this.indexes.set(field, idx);
			}

			if (field.includes(this.delimiter)) {
				for (const compositeKey of this._compositeKeys(field, data)) {
					let set = idx.get(compositeKey);
					if (!set) {
						set = new Set();
						idx.set(compositeKey, set);
					}
					set.add(key);
				}
			} else {
				const values = data[field];
				const normalized = Array.isArray(values) ? values : [values];
				for (const v of normalized) {
					if (v != null) {
						let set = idx.get(v);
						if (!set) {
							set = new Set();
							idx.set(v, set);
						}
						set.add(key);
					}
				}
			}
		}
	}

	/**
	 * Removes entries from indexes for a deleted record
	 * @param {string} key - Key of the record
	 * @param {Object} data - Record data
	 * @private
	 */
	_deleteIndex(key, data) {
		for (const field of this.index) {
			const idx = this.indexes.get(field);
			if (!idx) continue;

			if (field.includes(this.delimiter)) {
				for (const compositeKey of this._compositeKeys(field, data)) {
					const set = idx.get(compositeKey);
					if (set) {
						set.delete(key);
						if (set.size === 0) idx.delete(compositeKey);
					}
				}
			} else {
				const values = data[field];
				const normalized = Array.isArray(values) ? values : [values];
				for (const v of normalized) {
					if (v != null) {
						const set = idx.get(v);
						if (set) {
							set.delete(key);
							if (set.size === 0) idx.delete(v);
						}
					}
				}
			}
		}
	}

	/**
	 * Generates composite index keys from record data
	 * @param {string} field - Composite index field name (e.g., 'name|department')
	 * @param {Object} data - Record data to extract values from
	 * @returns {string[]} Array of generated composite keys
	 * @private
	 */
	_compositeKeys(field, data) {
		const fields = field.split(this.delimiter);
		const result = [""];
		for (const f of fields) {
			const values = data[f];
			const normalized = Array.isArray(values) ? values : [values];
			const newResult = [];
			for (const r of result) {
				for (const v of normalized) {
					if (v != null) {
						newResult.push(r ? `${r}${this.delimiter}${v}` : v);
					}
				}
			}
			result.length = 0;
			result.push(...newResult);
		}
		return result;
	}

	/**
	 * Builds all indexes from existing data
	 * @private
	 */
	_buildIndexes() {
		for (const field of this.index) {
			this.indexes.set(field, new Map());
		}
		for (const [key, data] of this.data) {
			this._setIndex(key, data);
		}
	}

	/**
	 * Performs batch operations on multiple records
	 * @param {Object[]} records - Array of records to process
	 * @param {string} [type='set'] - Type of operation: 'set' for upsert, 'del' for delete
	 * @returns {Object[]} Array of results from the batch operation
	 * @example
	 * const results = store.batch([
	 *   {id: 1, name: 'John'},
	 *   {id: 2, name: 'Jane'}
	 * ], 'set');
	 */
	batch (records, type = STRING_SET) {
		if (!Array.isArray(records)) return [];
		if (type === STRING_DEL) {
			return records.map(r => this.delete(r[this.key] ?? r));
		}
		return records.map(r => this.set(r));
	}

	/**
	 * Removes all records, indexes, and versions from the store
	 * @returns {Haro} This instance for method chaining
	 * @example
	 * store.clear();
	 * console.log(store.size); // 0
	 */
	clear () {
		this.data.clear();
		for (const idx of this.indexes.values()) {
			idx.clear();
		}
		if (this.versions) this.versions.clear();
		this._registry = [];
		return this;
	}

	/**
	 * Deletes a record from the store and removes it from all indexes
	 * @param {string} key - Key of record to delete
	 * @returns {Haro} This instance for method chaining
	 * @throws {Error} Throws error if record with the specified key is not found
	 * @example
	 * store.delete('user123');
	 */
	delete (key) {
		if (!this.data.has(key)) {
			throw new Error(STRING_RECORD_NOT_FOUND);
		}
		const record = this.data.get(key);
		this._deleteIndex(key, record);
		this.data.delete(key);
		const idx = this._registry.indexOf(key);
		if (idx !== -1) this._registry.splice(idx, 1);
		if (this.versions) this.versions.delete(key);
		return this;
	}

	/**
	 * Exports complete store data or indexes for persistence or debugging
	 * @param {string} [type='records'] - Type of data to export: 'records' or 'indexes'
	 * @returns {Array} Array of [key, value] pairs for records, or serialized index structure
	 * @example
	 * const records = store.dump('records');
	 * const indexes = store.dump('indexes');
	 */
	dump (type = STRING_RECORDS) {
		if (type === STRING_RECORDS) {
			return Array.from(this.data.entries());
		}
		return Array.from(this.indexes).map(([k, v]) => [k, Array.from(v).map(([kk, vv]) => [kk, Array.from(vv)])]);
	}

	/**
	 * Returns an iterator of [key, value] pairs for each record in the store
	 * @returns {Iterator} Iterator of [key, value] pairs
	 * @example
	 * for (const [key, value] of store.entries()) {
	 *   console.log(key, value);
	 * }
	 */
	entries () {
		return this.data.entries();
	}

	/**
	 * Finds records matching the specified criteria using indexes for optimal performance
	 * @param {Object} [where={}] - Object with field-value pairs to match against
	 * @returns {Object[]} Array of matching frozen records
	 * @example
	 * const users = store.find({department: 'engineering', active: true});
	 * const admins = store.find({role: 'admin'});
	 */
	find (where = {}) {
		const keys = Object.keys(where).sort();
		if (keys.length === 0) return [];

		const key = keys.join(this.delimiter);
		const idx = this.indexes.get(key);

		if (idx) {
			const searchKeys = [];
			for (const k of keys) {
				searchKeys.push(where[k]);
			}
			const compositeKey = searchKeys.join(this.delimiter);
			const set = idx.get(compositeKey);
			if (set) {
				return Array.from(set).map(k => this._freeze(this.data.get(k)));
			}
		}

		let candidateKeys = null;
		for (const k of keys) {
			const idx = this.indexes.get(k);
			if (!idx) continue;
			const set = idx.get(where[k]);
			if (!set) return [];
			if (candidateKeys === null) {
				candidateKeys = new Set(set);
			} else {
				candidateKeys = new Set([...candidateKeys].filter(key => set.has(key)));
			}
			if (candidateKeys.size === 0) return [];
		}

		if (candidateKeys === null) return [];
		return Array.from(candidateKeys).map(k => this._freeze(this.data.get(k)));
	}

	/**
	 * Filters records using a predicate function
	 * @param {Function} fn - Predicate function to test each record (record, key)
	 * @returns {Object[]} Array of records that pass the predicate test (frozen)
	 * @throws {Error} Throws error if fn is not a function
	 * @example
	 * const adults = store.filter(record => record.age >= 18);
	 */
	filter (fn) {
		if (typeof fn !== STRING_FUNCTION) {
			throw new Error(STRING_INVALID_FUNCTION);
		}
		const results = [];
		for (const [key, record] of this.data) {
			if (fn(record, key)) {
				results.push(this._freeze(record));
			}
		}
		return results;
	}

	/**
	 * Executes a function for each record in the store
	 * @param {Function} fn - Function to execute for each record (record, key)
	 * @param {Object} [ctx] - Context object to use as 'this' when executing the function
	 * @returns {Haro} This instance for method chaining
	 * @example
	 * store.forEach((record, key) => {
	 *   console.log(`${key}: ${record.name}`);
	 * });
	 */
	forEach (fn, ctx) {
		for (const [key, record] of this.data) {
			fn.call(ctx, this._freeze(record), key);
		}
		return this;
	}

	/**
	 * Retrieves a record by its key
	 * @param {string} key - Key of record to retrieve
	 * @returns {Object|null} The frozen record if found, null if not found
	 * @example
	 * const user = store.get('user123');
	 */
	get (key) {
		const record = this.data.get(key);
		return record ? this._freeze(record) : null;
	}

	/**
	 * Checks if a record with the specified key exists in the store
	 * @param {string} key - Key to check for existence
	 * @returns {boolean} True if record exists, false otherwise
	 * @example
	 * if (store.has('user123')) {
	 *   console.log('User exists');
	 * }
	 */
	has (key) {
		return this.data.has(key);
	}

	/**
	 * Returns an iterator of all keys in the store
	 * @returns {Iterator<string>} Iterator of record keys
	 * @example
	 * for (const key of store.keys()) {
	 *   console.log(key);
	 * }
	 */
	keys () {
		return this.data.keys();
	}

	/**
	 * Returns a limited subset of records with offset support for pagination
	 * @param {number} [offset=0] - Number of records to skip from the beginning
	 * @param {number} [max=0] - Maximum number of records to return (0 = all remaining)
	 * @returns {Object[]} Array of frozen records within the specified range
	 * @example
	 * const page1 = store.limit(0, 10);   // First 10 records
	 * const page2 = store.limit(10, 10);  // Next 10 records
	 */
	limit (offset = 0, max = 0) {
		const end = offset + max;
		const keys = this._registry.slice(offset, max > 0 ? end : undefined);
		return keys.map(k => this._freeze(this.data.get(k)));
	}

	/**
	 * Transforms all records using a mapping function
	 * @param {Function} fn - Function to transform each record (record, key)
	 * @returns {Array} Array of transformed results
	 * @throws {Error} Throws error if fn is not a function
	 * @example
	 * const names = store.map(record => record.name);
	 * const summaries = store.map(record => ({id: record.id, name: record.name}));
	 */
	map (fn) {
		if (typeof fn !== STRING_FUNCTION) {
			throw new Error(STRING_INVALID_FUNCTION);
		}
		const results = [];
		for (const [key, record] of this.data) {
			results.push(fn(this._freeze(record), key));
		}
		return results;
	}

	/**
	 * Merges two values together with support for arrays and objects
	 * @param {*} a - First value (target)
	 * @param {*} b - Second value (source)
	 * @param {boolean} [override=false] - Whether to override arrays instead of concatenating
	 * @returns {*} Merged result
	 * @example
	 * const merged = store.merge({a: 1}, {b: 2}); // {a: 1, b: 2}
	 * const arrays = store.merge([1, 2], [3, 4]); // [1, 2, 3, 4]
	 */
	merge (a, b, override = false) {
		if (Array.isArray(a) && Array.isArray(b)) {
			return override ? b : a.concat(b);
		}
		if (typeof a === STRING_OBJECT && a !== null && typeof b === STRING_OBJECT && b !== null) {
			const result = this._clone(a);
			for (const k of Object.keys(b)) {
				result[k] = this.merge(result[k], b[k], override);
			}
			return result;
		}
		return b;
	}

	/**
	 * Replaces all store data or indexes with new data
	 * @param {Array} data - Data to replace with (format depends on type)
	 * @param {string} [type='records'] - Type of data: 'records' or 'indexes'
	 * @returns {boolean} True if operation succeeded
	 * @throws {Error} Throws error if type is invalid
	 * @example
	 * const records = [['key1', {name: 'John'}], ['key2', {name: 'Jane'}]];
	 * store.override(records, 'records');
	 */
	override (data, type = STRING_RECORDS) {
		if (type === STRING_INDEXES) {
			this.indexes = new Map(data.map(([k, v]) => [k, new Map(v.map(([kk, vv]) => [kk, new Set(vv)]))]));
		} else if (type === STRING_RECORDS) {
			this.data = new Map(data);
			this._registry = data.map(([k]) => k);
			this._buildIndexes();
		} else {
			throw new Error(STRING_INVALID_TYPE);
		}
		return true;
	}

	/**
	 * Reduces all records to a single value using a reducer function
	 * @param {Function} fn - Reducer function (accumulator, record, key)
	 * @param {*} [accumulator] - Initial accumulator value
	 * @returns {*} Final reduced value
	 * @example
	 * const totalAge = store.reduce((sum, record) => sum + record.age, 0);
	 * const names = store.reduce((acc, record) => acc.concat(record.name), []);
	 */
	reduce (fn, accumulator) {
		let acc = accumulator;
		for (const [key, record] of this.data) {
			acc = fn(acc, this._freeze(record), key);
		}
		return acc;
	}

	/**
	 * Rebuilds indexes for a specific field or all fields
	 * @param {string} [field] - Specific index field to rebuild, or all if not specified
	 * @returns {Haro} This instance for method chaining
	 * @example
	 * store.reindex(); // Rebuild all indexes
	 * store.reindex('name'); // Rebuild only name index
	 */
	reindex (field) {
		if (field) {
			if (!this.index.includes(field)) {
				this.index.push(field);
			}
			this.indexes.set(field, new Map());
			for (const [key, data] of this.data) {
				this._setIndex(key, data, [field]);
			}
		} else {
			this._buildIndexes();
		}
		return this;
	}

	/**
	 * Searches for records containing a value across specified indexes
	 * @param {*} value - Value to search for (string, function, or RegExp)
	 * @param {string|string[]} [field] - Index(es) to search in, or all if not specified
	 * @returns {Object[]} Array of matching frozen records
	 * @example
	 * const results = store.search('john'); // Search all indexes
	 * const nameResults = store.search('john', 'name'); // Search only name index
	 * const regexResults = store.search(/^admin/, 'role'); // Regex search
	 */
	search (value, field) {
		if (value == null) return [];
		const fn = typeof value === STRING_FUNCTION;
		const rgex = value != null && typeof value.test === STRING_FUNCTION;
		const indices = field ? (Array.isArray(field) ? field : [field]) : this.index;

		const result = new Set();
		for (const i of indices) {
			const idx = this.indexes.get(i);
			if (!idx) continue;

			for (const [k, set] of idx) {
				let match = false;
				if (fn) {
					match = value(k, i);
				} else if (rgex) {
					match = value.test(Array.isArray(k) ? k.join(STRING_COMMA) : k);
				} else {
					match = k === value;
				}

				if (match) {
					for (const recordKey of set) {
						if ( this.data.has(recordKey)) {
							result.add(recordKey);
						}
					}
				}
			}
		}

		return Array.from(result).map(k => this._freeze(this.data.get(k)));
	}

	/**
	 * Sets or updates a record in the store with automatic indexing
	 * @param {Object} data - Record data to set (must include key field unless using auto-generated key)
	 * @returns {Object} The stored frozen record
	 * @example
	 * const user = store.set({name: 'John', age: 30});
	 * const updated = store.set({id: 'user123', age: 31}); // Update existing
	 */
	set (data) {
		const key = data[this.key] ?? uuid();
		const merged = {...data, [this.key]: key};

		if (this.data.has(key)) {
			const existing = this.data.get(key);
			this._deleteIndex(key, existing);
			if (this.versioning) {
				let versions = this.versions.get(key);
				if (!versions) {
					versions = new Set();
					this.versions.set(key, versions);
				}
				versions.add(this._freeze(existing));
			}
			this.data.set(key, this.merge(existing, merged));
		} else {
			this.data.set(key, merged);
			this._registry.push(key);
			if (this.versioning) {
				this.versions.set(key, new Set());
			}
		}

		this._setIndex(key, this.data.get(key));
		return this._freeze(this.data.get(key));
	}

	/**
	 * Sorts all records using a comparator function
	 * @param {Function} fn - Comparator function for sorting (a, b) => number
	 * @returns {Object[]} Sorted array of frozen records
	 * @example
	 * const sorted = store.sort((a, b) => a.age - b.age);
	 * const names = store.sort((a, b) => a.name.localeCompare(b.name));
	 */
	sort (fn) {
		const records = Array.from(this.data.values()).map(r => this._freeze(r));
		return records.sort(fn);
	}

	/**
	 * Sorts records by a specific indexed field in ascending order
	 * @param {string} field - Index field name to sort by
	 * @returns {Object[]} Array of frozen records sorted by the specified field
	 * @throws {Error} Throws error if field is empty or falsy
	 * @example
	 * const byAge = store.sortBy('age');
	 * const byName = store.sortBy('name');
	 */
	sortBy (field) {
		if (!field) throw new Error(STRING_INVALID_FIELD);
		if (!this.indexes.has(field)) {
			this.reindex(field);
		}
		const idx = this.indexes.get(field);
		const results = [];
		const sortedKeys = Array.from(idx.keys()).sort((a, b) => {
			if (typeof a === STRING_STRING && typeof b === STRING_STRING) return a.localeCompare(b);
			if (typeof a === STRING_NUMBER && typeof b === STRING_NUMBER) return a - b;
			return String(a).localeCompare(String(b));
		});
		for (const k of sortedKeys) {
			for (const recordKey of idx.get(k)) {
				results.push(this._freeze(this.data.get(recordKey)));
			}
		}
		return results;
	}

	/**
	 * Converts all store data to a plain array of frozen records
	 * @returns {Object[]} Array containing all frozen records in the store
	 * @example
	 * const allRecords = store.toArray();
	 * console.log(`Store contains ${allRecords.length} records`);
	 */
	toArray () {
		return Array.from(this.data.values()).map(r => this._freeze(r));
	}

	/**
	 * Returns an iterator of all values in the store
	 * @returns {Iterator} Iterator of frozen record values
	 * @example
	 * for (const record of store.values()) {
	 *   console.log(record.name);
	 * }
	 */
	values () {
		const self = this;
		return (function* () {
			for (const record of self.data.values()) {
				yield self._freeze(record);
			}
		})();
	}

	/**
	 * Internal helper method for predicate matching with support for arrays and regex
	 * @param {Object} record - Record to test against predicate
	 * @param {Object} predicate - Predicate object with field-value pairs
	 * @param {string} op - Operator for array matching ('||' for OR, '&&' for AND)
	 * @returns {boolean} True if record matches predicate criteria
	 * @private
	 */
	_matchesPredicate(record, predicate, op) {
		for (const key of Object.keys(predicate)) {
			const pred = predicate[key];
			const val = record[key];

			if (Array.isArray(pred)) {
				if (Array.isArray(val)) {
					if (op === STRING_DOUBLE_AND) {
						if (!pred.every(p => val.includes(p))) return false;
					} else {
						if (!pred.some(p => val.includes(p))) return false;
					}
				} else {
					if (op === STRING_DOUBLE_AND) {
						if (!pred.some(p => val === p)) return false;
					} else {
						if (!pred.some(p => val === p)) return false;
					}
				}
			} else if (pred instanceof RegExp) {
				if (Array.isArray(val)) {
					if (op === STRING_DOUBLE_AND) {
						if (!val.every(v => pred.test(v))) return false;
					} else {
						if (!val.some(v => pred.test(v))) return false;
					}
				} else {
					if (!pred.test(val)) return false;
				}
			} else if (Array.isArray(val)) {
				if (!val.includes(pred)) return false;
			} else {
				if (val !== pred) return false;
			}
		}
		return true;
	}

	/**
	 * Filters records using predicate logic supporting AND/OR operations on arrays
	 * @param {Object} [predicate={}] - Object with field-value pairs for filtering
	 * @param {string} [op='||'] - Operator for array matching ('||' for OR, '&&' for AND)
	 * @returns {Object[]} Array of matching frozen records
	 * @example
	 * // Find records with tags containing 'admin' OR 'user'
	 * const users = store.where({tags: ['admin', 'user']}, '||');
	 *
	 * // Find records with ALL specified tags
	 * const powerUsers = store.where({tags: ['admin', 'power']}, '&&');
	 *
	 * // Regex matching
	 * const emails = store.where({email: /^admin@/});
	 */
	where (predicate = {}, op = STRING_DOUBLE_PIPE) {
		const indexedFields = this.index.filter(f => f in predicate);
		const indexedFieldsInIndex = indexedFields.filter(f => this.indexes.has(f));

		if (indexedFieldsInIndex.length > 0) {
			let candidateKeys = new Set();
			let first = true;

			for (const field of indexedFieldsInIndex) {
				const pred = predicate[field];
				const idx = this.indexes.get(field);
				const matchingKeys = new Set();

				if (Array.isArray(pred)) {
					for (const p of pred) {
						const set = idx.get(p);
						if (set) {
							for (const k of set) matchingKeys.add(k);
						}
					}
				} else {
					const set = idx.get(pred);
					if (set) {
						for (const k of set) matchingKeys.add(k);
					}
				}

				if (first) {
					candidateKeys = matchingKeys;
					first = false;
				} else {
					candidateKeys = new Set([...candidateKeys].filter(k => matchingKeys.has(k)));
				}
			}

			const results = [];
			for (const k of candidateKeys) {
				const record = this.data.get(k);
				if (record && this._matchesPredicate(record, predicate, op)) {
					results.push(this._freeze(record));
				}
			}
			return results;
		}

		return this.filter(r => this._matchesPredicate(r, predicate, op));
	}
}

/**
 * Factory function to create a new Haro instance with optional initial data
 * @param {Object[]|null} [data=null] - Initial data to populate the store
 * @param {Object} [config={}] - Configuration object passed to Haro constructor
 * @returns {Haro} New Haro instance configured and optionally populated
 * @example
 * const store = haro([
 *   {id: 1, name: 'John', age: 30},
 *   {id: 2, name: 'Jane', age: 25}
 * ], {
 *   index: ['name', 'age'],
 *   versioning: true
 * });
 */
export function haro (data = null, config = {}) {
	const store = new Haro(config);
	if (Array.isArray(data)) {
		data.forEach(r => store.set(r));
	}
	return store;
}
