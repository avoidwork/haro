import {randomUUID as uuid} from "crypto";
import {
	INT_0,
	STRING_COMMA,
	STRING_DEL,
	STRING_DOUBLE_PIPE,
	STRING_EMPTY,
	STRING_FUNCTION,
	STRING_INDEXES,
	STRING_INVALID_FIELD,
	STRING_INVALID_FUNCTION,
	STRING_INVALID_TYPE,
	STRING_PIPE,
	STRING_RECORD_NOT_FOUND,
	STRING_RECORDS,
	STRING_REGISTRY,
	STRING_SET,
	STRING_SIZE
} from "./constants.js";

/**
 * Haro is a modern immutable DataStore for collections of records with indexing,
 * versioning, and batch operations support. It provides a Map-like interface
 * with advanced querying capabilities through indexes.
 * @class
 * @example
 * const store = new Haro({
 *   index: ['name', 'age'],
 *   key: 'id',
 *   versioning: true
 * });
 *
 * store.set(null, {name: 'John', age: 30});
 * const results = store.find({name: 'John'});
 */
export class Haro {
	/**
	 * Creates a new Haro instance with specified configuration
	 * @param {Object} [config={}] - Configuration object for the store
	 * @param {string} [config.delimiter=STRING_PIPE] - Delimiter for composite indexes (default: '|')
	 * @param {string} [config.id] - Unique identifier for this instance (auto-generated if not provided)
	 * @param {string[]} [config.index=[]] - Array of field names to create indexes for
	 * @param {string} [config.key="id"] - Primary key field name used for record identification
	 * @param {boolean} [config.versioning=false] - Enable versioning to track record changes
	 * @param {boolean} [config.immutable=false] - Return frozen/immutable objects for data safety
	 * @constructor
	 * @example
	 * const store = new Haro({
	 *   index: ['name', 'email', 'name|department'],
	 *   key: 'userId',
	 *   versioning: true,
	 *   immutable: true
	 * });
	 */
	constructor ({delimiter = STRING_PIPE, id = this.uuid(), index = [], key = "id", versioning = false, immutable = false} = {}) {
		this.data = new Map();
		this.delimiter = delimiter;
		this.id = id;
		this.index = Array.isArray(index) ? [...index] : [];
		this.indexes = new Map();
		this.immutable = immutable;
		this.key = key;
		this.versions = new Map();
		this.versioning = versioning;
		Object.defineProperty(this, STRING_REGISTRY, {
			enumerable: true,
			get: () => Array.from(this.data.keys())
		});
		Object.defineProperty(this, STRING_SIZE, {
			enumerable: true,
			get: () => this.data.size
		});

		return this.reindex();
	}

	/**
	 * Performs batch operations on multiple records for efficient bulk processing
	 * @param {Array<Object>} args - Array of records to process
	 * @param {string} [type=STRING_SET] - Type of operation: 'set' for upsert, 'del' for delete
	 * @returns {Array} Array of results from the batch operation
	 * @example
	 * const results = store.batch([
	 *   {id: 1, name: 'John'},
	 *   {id: 2, name: 'Jane'}
	 * ], 'set');
	 */
	batch (args, type = STRING_SET) {
		const fn = type === STRING_DEL ? i => this.del(i, true) : i => this.set(null, i, true, true);

		return this.onbatch(this.beforeBatch(args, type).map(fn), type);
	}

	/**
	 * Lifecycle hook executed before batch operations for custom preprocessing
	 * @param {Array} arg - Arguments passed to batch operation
	 * @param {string} [type=STRING_EMPTY] - Type of batch operation ('set' or 'del')
	 * @returns {Array} Modified arguments (override this method to implement custom logic)
	 */
	beforeBatch (arg, type = STRING_EMPTY) { // eslint-disable-line no-unused-vars
		return arg;
	}

	/**
	 * Lifecycle hook executed before clear operation for custom preprocessing
	 * Override this method in subclasses to implement custom logic
	 * @example
	 * class MyStore extends Haro {
	 *   beforeClear() {
	 *     this.backup = this.toArray();
	 *   }
	 * }
	 */
	beforeClear () {
		// Hook for custom logic before clear; override in subclass if needed
	}

	/**
	 * Lifecycle hook executed before delete operation for custom preprocessing
	 * @param {string} [key=STRING_EMPTY] - Key of record to delete
	 * @param {boolean} [batch=false] - Whether this is part of a batch operation
	 * @returns {Array<string|boolean>} Array containing [key, batch] for further processing
	 */
	beforeDelete (key = STRING_EMPTY, batch = false) {
		return [key, batch];
	}

	/**
	 * Lifecycle hook executed before set operation for custom preprocessing
	 * @param {string} [key=STRING_EMPTY] - Key of record to set
	 * @param {Object} data - Record data being set
	 * @param {boolean} [batch=false] - Whether this is part of a batch operation
	 * @param {boolean} [override=false] - Whether to override existing data
	 * @returns {Array<string|boolean>} Array containing [key, batch] for further processing
	 */
	beforeSet (key = STRING_EMPTY, data, batch = false, override = false) { // eslint-disable-line no-unused-vars
		return [key, batch];
	}

	/**
	 * Removes all records, indexes, and versions from the store
	 * @returns {Haro} This instance for method chaining
	 * @example
	 * store.clear();
	 * console.log(store.size); // 0
	 */
	clear () {
		this.beforeClear();
		this.data.clear();
		this.indexes.clear();
		this.versions.clear();
		this.reindex().onclear();

		return this;
	}

	/**
	 * Creates a deep clone of the given value, handling objects, arrays, and primitives
	 * @param {*} arg - Value to clone (any type)
	 * @returns {*} Deep clone of the argument
	 * @example
	 * const original = {name: 'John', tags: ['user', 'admin']};
	 * const cloned = store.clone(original);
	 * cloned.tags.push('new'); // original.tags is unchanged
	 */
	clone (arg) {
		return structuredClone(arg);
	}

	/**
	 * Deletes a record from the store and removes it from all indexes
	 * @param {string} [key=STRING_EMPTY] - Key of record to delete
	 * @param {boolean} [batch=false] - Whether this is part of a batch operation
	 * @throws {Error} Throws error if record with the specified key is not found
	 * @example
	 * store.del('user123');
	 * // Throws error if 'user123' doesn't exist
	 */
	del (key = STRING_EMPTY, batch = false) {
		if (!this.data.has(key)) {
			throw new Error(STRING_RECORD_NOT_FOUND);
		}
		const og = this.get(key, true);
		this.beforeDelete(key, batch);
		this.delIndex(this.index, this.indexes, this.delimiter, key, og);
		this.data.delete(key);
		this.ondelete(key, batch);
		if (this.versioning) {
			this.versions.delete(key);
		}
	}

	/**
	 * Internal method to remove entries from indexes for a deleted record
	 * @param {string[]} index - Array of index field names
	 * @param {Map<string, Map<*, Set<string>>>} indexes - Map of index structures
	 * @param {string} delimiter - Delimiter for composite indexes
	 * @param {string} key - Key of record being deleted
	 * @param {Object} data - Data of record being deleted
	 * @private
	 */
	delIndex (index, indexes, delimiter, key, data) {
		index.forEach(i => {
			const idx = indexes.get(i);
			if (!idx) return;
			const values = i.includes(delimiter) ?
				this.indexKeys(i, delimiter, data) :
				Array.isArray(data[i]) ? data[i] : [data[i]];
			this.each(values, value => {
				if (idx.has(value)) {
					const o = idx.get(value);
					o.delete(key);
					if (o.size === INT_0) {
						idx.delete(value);
					}
				}
			});
		});
	}

	/**
	 * Exports complete store data or indexes for persistence or debugging
	 * @param {string} [type=STRING_RECORDS] - Type of data to export: 'records' or 'indexes'
	 * @returns {Array} Array of [key, value] pairs for records, or serialized index structure
	 * @example
	 * const records = store.dump('records');
	 * const indexes = store.dump('indexes');
	 */
	dump (type = STRING_RECORDS) {
		let result;
		if (type === STRING_RECORDS) {
			result = Array.from(this.entries());
		} else {
			result = Array.from(this.indexes).map(i => {
				i[1] = Array.from(i[1]).map(ii => {
					ii[1] = Array.from(ii[1]);

					return ii;
				});

				return i;
			});
		}

		return result;
	}

	/**
	 * Utility method to iterate over an array with a callback function
	 * @param {Array} [arr=[]] - Array to iterate over
	 * @param {Function} fn - Function to call for each element (element, index)
	 * @returns {Array} The original array for method chaining
	 * @example
	 * store.each([1, 2, 3], (item, index) => console.log(item, index));
	 */
	each (arr = [], fn) {
		const len = arr.length;
		for (let i = 0; i < len; i++) {
			fn(arr[i], i);
		}

		return arr;
	}

	/**
	 * Returns an iterator of [key, value] pairs for each record in the store
	 * @returns {Iterator<Array>} Iterator of [key, value] pairs
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
	 * @returns {Array<Object>} Array of matching records (frozen if immutable mode)
	 * @example
	 * const users = store.find({department: 'engineering', active: true});
	 * const admins = store.find({role: 'admin'});
	 */
	find (where = {}, raw = false) {
		const key = Object.keys(where).sort((a, b) => a.localeCompare(b)).join(this.delimiter);
		const index = this.indexes.get(key) ?? new Map();
		let result = [];
		if (index.size > 0) {
			const keys = this.indexKeys(key, this.delimiter, where);
			result = Array.from(keys.reduce((a, v) => {
				if (index.has(v)) {
					index.get(v).forEach(k => a.add(k));
				}

				return a;
			}, new Set())).map(i => this.get(i, raw));
		}
		if (!raw && this.immutable) {
			result = Object.freeze(result);
		}

		return result;
	}

	/**
	 * Filters records using a predicate function, similar to Array.filter
	 * @param {Function} fn - Predicate function to test each record (record, key, store)
	 * @returns {Array<Object>} Array of records that pass the predicate test
	 * @throws {Error} Throws error if fn is not a function
	 * @example
	 * const adults = store.filter(record => record.age >= 18);
	 * const recent = store.filter(record => record.created > Date.now() - 86400000);
	 */
	filter (fn, raw = false) {
		if (typeof fn !== STRING_FUNCTION) {
			throw new Error(STRING_INVALID_FUNCTION);
		}
		const x = this.immutable ? (k, v) => Object.freeze([k, Object.freeze(v)]) : (k, v) => v;
		let result = this.reduce((a, v, k, ctx) => {
			if (fn.call(ctx, v)) {
				a.push(x(k, v));
			}

			return a;
		}, []);
		if (!raw) {
			result = result.map(i => this.list(i));

			if (this.immutable) {
				result = Object.freeze(result);
			}
		}

		return result;
	}

	/**
	 * Executes a function for each record in the store, similar to Array.forEach
	 * @param {Function} fn - Function to execute for each record (value, key)
	 * @param {*} [ctx] - Context object to use as 'this' when executing the function
	 * @returns {Haro} This instance for method chaining
	 * @example
	 * store.forEach((record, key) => {
	 *   console.log(`${key}: ${record.name}`);
	 * });
	 */
	forEach (fn, ctx) {
		this.data.forEach((value, key) => {
			fn(this.clone(value), key); // Only clone value, key is primitive
		}, ctx ?? this.data);

		return this;
	}

	/**
	 * Creates a frozen array from the given arguments for immutable data handling
	 * @param {...*} args - Arguments to freeze into an array
	 * @returns {Array} Frozen array containing frozen arguments
	 * @example
	 * const frozen = store.freeze(obj1, obj2, obj3);
	 * // Returns Object.freeze([Object.freeze(obj1), Object.freeze(obj2), Object.freeze(obj3)])
	 */
	freeze (...args) {
		return Object.freeze(args.map(i => Object.freeze(i)));
	}

	/**
	 * Retrieves a record by its key
	 * @param {string} key - Key of record to retrieve
	 * @param {boolean} [raw=false] - Whether to return raw data (true) or processed/frozen data (false)
	 * @returns {Object|null} The record if found, null if not found
	 * @example
	 * const user = store.get('user123');
	 * const rawUser = store.get('user123', true);
	 */
	get (key, raw = false) {
		let result = this.data.get(key) ?? null;
		if (result !== null && !raw) {
			result = this.list(result);
			if (this.immutable) {
				result = Object.freeze(result);
			}
		}

		return result;
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
	 * Generates index keys for composite indexes from data values
	 * @param {string} [arg=STRING_EMPTY] - Composite index field names joined by delimiter
	 * @param {string} [delimiter=STRING_PIPE] - Delimiter used in composite index
	 * @param {Object} [data={}] - Data object to extract field values from
	 * @returns {string[]} Array of generated index keys
	 * @example
	 * // For index 'name|department' with data {name: 'John', department: 'IT'}
	 * const keys = store.indexKeys('name|department', '|', data);
	 * // Returns ['John|IT']
	 */
	indexKeys (arg = STRING_EMPTY, delimiter = STRING_PIPE, data = {}) {
		const fields = arg.split(delimiter).sort((a, b) => a.localeCompare(b));
		const fieldsLen = fields.length;
		let result = [""];
		for (let i = 0; i < fieldsLen; i++) {
			const field = fields[i];
			const values = Array.isArray(data[field]) ? data[field] : [data[field]];
			const newResult = [];
			const resultLen = result.length;
			const valuesLen = values.length;
			for (let j = 0; j < resultLen; j++) {
				for (let k = 0; k < valuesLen; k++) {
					const newKey = i === 0 ? values[k] : `${result[j]}${delimiter}${values[k]}`;
					newResult.push(newKey);
				}
			}
			result = newResult;
		}

		return result;
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
	 * @param {number} [offset=INT_0] - Number of records to skip from the beginning
	 * @param {number} [max=INT_0] - Maximum number of records to return
	 * @returns {Array<Object>} Array of records within the specified range
	 * @example
	 * const page1 = store.limit(0, 10);   // First 10 records
	 * const page2 = store.limit(10, 10);  // Next 10 records
	 */
	limit (offset = INT_0, max = INT_0, raw = false) {
		let result = this.registry.slice(offset, offset + max).map(i => this.get(i, raw));
		if (!raw && this.immutable) {
			result = Object.freeze(result);
		}

		return result;
	}

	/**
	 * Converts a record into a [key, value] pair array format
	 * @param {Object} arg - Record object to convert to list format
	 * @returns {Array<*>} Array containing [key, record] where key is extracted from record's key field
	 * @example
	 * const record = {id: 'user123', name: 'John', age: 30};
	 * const pair = store.list(record); // ['user123', {id: 'user123', name: 'John', age: 30}]
	 */
	list (arg) {
		const result = [arg[this.key], arg];

		return this.immutable ? this.freeze(...result) : result;
	}

	/**
	 * Transforms all records using a mapping function, similar to Array.map
	 * @param {Function} fn - Function to transform each record (record, key)
	 * @returns {Array} Array of transformed results
	 * @throws {Error} Throws error if fn is not a function
	 * @example
	 * const names = store.map(record => record.name);
	 * const summaries = store.map(record => ({id: record.id, name: record.name}));
	 */
	map (fn, raw = false) {
		if (typeof fn !== STRING_FUNCTION) {
			throw new Error(STRING_INVALID_FUNCTION);
		}
		let result = [];
		this.forEach((value, key) => result.push(fn(value, key)));
		if (!raw) {
			result = result.map(i => this.list(i));
			if (this.immutable) {
				result = Object.freeze(result);
			}
		}

		return result;
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
			a = override ? b : a.concat(b);
		} else if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
			this.each(Object.keys(b), i => {
				a[i] = this.merge(a[i], b[i], override);
			});
		} else {
			a = b;
		}

		return a;
	}

	/**
	 * Lifecycle hook executed after batch operations for custom postprocessing
	 * @param {Array} arg - Result of batch operation
	 * @param {string} [type=STRING_EMPTY] - Type of batch operation that was performed
	 * @returns {Array} Modified result (override this method to implement custom logic)
	 */
	onbatch (arg, type = STRING_EMPTY) { // eslint-disable-line no-unused-vars
		return arg;
	}

	/**
	 * Lifecycle hook executed after clear operation for custom postprocessing
	 * Override this method in subclasses to implement custom logic
	 * @example
	 * class MyStore extends Haro {
	 *   onclear() {
	 *     console.log('Store cleared');
	 *   }
	 * }
	 */
	onclear () {
		// Hook for custom logic after clear; override in subclass if needed
	}

	/**
	 * Lifecycle hook executed after delete operation for custom postprocessing
	 * @param {string} [key=STRING_EMPTY] - Key of deleted record
	 * @param {boolean} [batch=false] - Whether this was part of a batch operation
	 * @returns {Array<string|boolean>} Array containing [key, batch] for further processing
	 */
	ondelete (key = STRING_EMPTY, batch = false) {
		return [key, batch];
	}

	/**
	 * Lifecycle hook executed after override operation for custom postprocessing
	 * @param {string} [type=STRING_EMPTY] - Type of override operation that was performed
	 * @returns {string} The type parameter for further processing
	 */
	onoverride (type = STRING_EMPTY) {
		return type;
	}

	/**
	 * Lifecycle hook executed after set operation for custom postprocessing
	 * @param {Object} [arg={}] - Record that was set
	 * @param {boolean} [batch=false] - Whether this was part of a batch operation
	 * @returns {Array<Object|boolean>} Array containing [record, batch] for further processing
	 */
	onset (arg = {}, batch = false) {
		return [arg, batch];
	}

	/**
	 * Replaces all store data or indexes with new data for bulk operations
	 * @param {Array} data - Data to replace with (format depends on type)
	 * @param {string} [type=STRING_RECORDS] - Type of data: 'records' or 'indexes'
	 * @returns {boolean} True if operation succeeded
	 * @throws {Error} Throws error if type is invalid
	 * @example
	 * const records = [['key1', {name: 'John'}], ['key2', {name: 'Jane'}]];
	 * store.override(records, 'records');
	 */
	override (data, type = STRING_RECORDS) {
		const result = true;
		if (type === STRING_INDEXES) {
			this.indexes = new Map(data.map(i => [i[0], new Map(i[1].map(ii => [ii[0], new Set(ii[1])]))]));
		} else if (type === STRING_RECORDS) {
			this.indexes.clear();
			this.data = new Map(data);
		} else {
			throw new Error(STRING_INVALID_TYPE);
		}
		this.onoverride(type);

		return result;
	}

	/**
	 * Reduces all records to a single value using a reducer function
	 * @param {Function} fn - Reducer function (accumulator, value, key, store)
	 * @param {*} [accumulator] - Initial accumulator value
	 * @returns {*} Final reduced value
	 * @example
	 * const totalAge = store.reduce((sum, record) => sum + record.age, 0);
	 * const names = store.reduce((acc, record) => acc.concat(record.name), []);
	 */
	reduce (fn, accumulator) {
		let a = accumulator ?? this.data.keys().next().value;
		this.forEach((v, k) => {
			a = fn(a, v, k, this);
		}, this);

		return a;
	}

	/**
	 * Rebuilds indexes for specified fields or all fields for data consistency
	 * @param {string|string[]} [index] - Specific index field(s) to rebuild, or all if not specified
	 * @returns {Haro} This instance for method chaining
	 * @example
	 * store.reindex(); // Rebuild all indexes
	 * store.reindex('name'); // Rebuild only name index
	 * store.reindex(['name', 'email']); // Rebuild name and email indexes
	 */
	reindex (index) {
		const indices = index ? [index] : this.index;
		if (index && this.index.includes(index) === false) {
			this.index.push(index);
		}
		this.each(indices, i => this.indexes.set(i, new Map()));
		this.forEach((data, key) => this.each(indices, i => this.setIndex(this.index, this.indexes, this.delimiter, key, data, i)));

		return this;
	}

	/**
	 * Searches for records containing a value across specified indexes
	 * @param {*} value - Value to search for (string, function, or RegExp)
	 * @param {string|string[]} [index] - Index(es) to search in, or all if not specified
	 * @returns {Array<Object>} Array of matching records
	 * @example
	 * const results = store.search('john'); // Search all indexes
	 * const nameResults = store.search('john', 'name'); // Search only name index
	 * const regexResults = store.search(/^admin/, 'role'); // Regex search
	 */
	search (value, index, raw = false) {
		const result = new Set(); // Use Set for unique keys
		const fn = typeof value === STRING_FUNCTION;
		const rgex = value && typeof value.test === STRING_FUNCTION;
		if (!value) return this.immutable ? this.freeze() : [];
		const indices = index ? Array.isArray(index) ? index : [index] : this.index;
		for (const i of indices) {
			const idx = this.indexes.get(i);
			if (idx) {
				for (const [lkey, lset] of idx) {
					let match = false;

					if (fn) {
						match = value(lkey, i);
					} else if (rgex) {
						match = value.test(Array.isArray(lkey) ? lkey.join(STRING_COMMA) : lkey);
					} else {
						match = lkey === value;
					}

					if (match) {
						for (const key of lset) {
							if (this.data.has(key)) {
								result.add(key);
							}
						}
					}
				}
			}
		}
		let records = Array.from(result).map(key => this.get(key, raw));
		if (!raw && this.immutable) {
			records = Object.freeze(records);
		}

		return records;
	}

	/**
	 * Sets or updates a record in the store with automatic indexing
	 * @param {string|null} [key=null] - Key for the record, or null to use record's key field
	 * @param {Object} [data={}] - Record data to set
	 * @param {boolean} [batch=false] - Whether this is part of a batch operation
	 * @param {boolean} [override=false] - Whether to override existing data instead of merging
	 * @returns {Object} The stored record (frozen if immutable mode)
	 * @example
	 * const user = store.set(null, {name: 'John', age: 30}); // Auto-generate key
	 * const updated = store.set('user123', {age: 31}); // Update existing record
	 */
	set (key = null, data = {}, batch = false, override = false) {
		if (key === null) {
			key = data[this.key] ?? this.uuid();
		}
		let x = {...data, [this.key]: key};
		this.beforeSet(key, x, batch, override);
		if (!this.data.has(key)) {
			if (this.versioning) {
				this.versions.set(key, new Set());
			}
		} else {
			const og = this.get(key, true);
			this.delIndex(this.index, this.indexes, this.delimiter, key, og);
			if (this.versioning) {
				this.versions.get(key).add(Object.freeze(this.clone(og)));
			}
			if (!override) {
				x = this.merge(this.clone(og), x);
			}
		}
		this.data.set(key, x);
		this.setIndex(this.index, this.indexes, this.delimiter, key, x, null);
		const result = this.get(key);
		this.onset(result, batch);

		return result;
	}

	/**
	 * Internal method to add entries to indexes for a record
	 * @param {string[]} index - Array of index field names
	 * @param {Map<string, Map<*, Set<string>>>} indexes - Map of index structures
	 * @param {string} delimiter - Delimiter for composite indexes
	 * @param {string} key - Key of record being indexed
	 * @param {Object} data - Data of record being indexed
	 * @param {string|null} indice - Specific index to update, or null for all
	 * @private
	 */
	setIndex (index, indexes, delimiter, key, data, indice) {
		this.each(indice === null ? index : [indice], i => {
			let lindex = indexes.get(i);
			if (!lindex) {
				lindex = new Map();
				indexes.set(i, lindex);
			}
			if (i.includes(delimiter)) {
				this.each(this.indexKeys(i, delimiter, data), c => {
					if (!lindex.has(c)) {
						lindex.set(c, new Set());
					}
					lindex.get(c).add(key);
				});
			} else {
				this.each(Array.isArray(data[i]) ? data[i] : [data[i]], d => {
					if (!lindex.has(d)) {
						lindex.set(d, new Set());
					}
					lindex.get(d).add(key);
				});
			}
		});
	}

	/**
	 * Sorts all records using a comparator function
	 * @param {Function} fn - Comparator function for sorting (a, b) => number
	 * @param {boolean} [frozen=false] - Whether to return frozen records
	 * @returns {Array<Object>} Sorted array of records
	 * @example
	 * const sorted = store.sort((a, b) => a.age - b.age); // Sort by age
	 * const names = store.sort((a, b) => a.name.localeCompare(b.name)); // Sort by name
	 */
	sort (fn, frozen = false) {
		const dataSize = this.data.size;
		let result = this.limit(INT_0, dataSize, true).sort(fn);
		if (frozen) {
			result = this.freeze(...result);
		}

		return result;
	}

	/**
	 * Sorts records by a specific indexed field in ascending order
	 * @param {string} [index=STRING_EMPTY] - Index field name to sort by
	 * @returns {Array<Object>} Array of records sorted by the specified field
	 * @throws {Error} Throws error if index field is empty or invalid
	 * @example
	 * const byAge = store.sortBy('age');
	 * const byName = store.sortBy('name');
	 */
	sortBy (index = STRING_EMPTY, raw = false) {
		if (index === STRING_EMPTY) {
			throw new Error(STRING_INVALID_FIELD);
		}
		let result = [];
		const keys = [];
		if (this.indexes.has(index) === false) {
			this.reindex(index);
		}
		const lindex = this.indexes.get(index);
		lindex.forEach((idx, key) => keys.push(key));
		this.each(keys.sort(), i => lindex.get(i).forEach(key => result.push(this.get(key, raw))));
		if (this.immutable) {
			result = Object.freeze(result);
		}

		return result;
	}

	/**
	 * Converts all store data to a plain array of records
	 * @returns {Array<Object>} Array containing all records in the store
	 * @example
	 * const allRecords = store.toArray();
	 * console.log(`Store contains ${allRecords.length} records`);
	 */
	toArray () {
		const result = Array.from(this.data.values());
		if (this.immutable) {
			this.each(result, i => Object.freeze(i));
			Object.freeze(result);
		}

		return result;
	}

	/**
	 * Generates a RFC4122 v4 UUID for record identification
	 * @returns {string} UUID string in standard format
	 * @example
	 * const id = store.uuid(); // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
	 */
	uuid () {
		return uuid();
	}

	/**
	 * Returns an iterator of all values in the store
	 * @returns {Iterator<Object>} Iterator of record values
	 * @example
	 * for (const record of store.values()) {
	 *   console.log(record.name);
	 * }
	 */
	values () {
		return this.data.values();
	}

	/**
	 * Internal helper method for predicate matching with support for arrays and regex
	 * @param {Object} record - Record to test against predicate
	 * @param {Object} predicate - Predicate object with field-value pairs
	 * @param {string} op - Operator for array matching ('||' for OR, '&&' for AND)
	 * @returns {boolean} True if record matches predicate criteria
	 * @private
	 */
	matchesPredicate (record, predicate, op) {
		const keys = Object.keys(predicate);

		return keys.every(key => {
			const pred = predicate[key];
			const val = record[key];
			if (Array.isArray(pred)) {
				if (Array.isArray(val)) {
					return op === "&&" ? pred.every(p => val.includes(p)) : pred.some(p => val.includes(p));
				} else {
					return op === "&&" ? pred.every(p => val === p) : pred.some(p => val === p);
				}
			} else if (pred instanceof RegExp) {
				if (Array.isArray(val)) {
					return op === "&&" ? val.every(v => pred.test(v)) : val.some(v => pred.test(v));
				} else {
					return pred.test(val);
				}
			} else if (Array.isArray(val)) {
				return val.includes(pred);
			} else {
				return val === pred;
			}
		});
	}

	/**
	 * Advanced filtering with predicate logic supporting AND/OR operations on arrays
	 * @param {Object} [predicate={}] - Object with field-value pairs for filtering
	 * @param {string} [op=STRING_DOUBLE_PIPE] - Operator for array matching ('||' for OR, '&&' for AND)
	 * @returns {Array<Object>} Array of records matching the predicate criteria
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
		const keys = this.index.filter(i => i in predicate);
		if (keys.length === 0) return [];

		// Try to use indexes for better performance
		const indexedKeys = keys.filter(k => this.indexes.has(k));
		if (indexedKeys.length > 0) {
			// Use index-based filtering for better performance
			let candidateKeys = new Set();
			let first = true;
			for (const key of indexedKeys) {
				const pred = predicate[key];
				const idx = this.indexes.get(key);
				const matchingKeys = new Set();
				if (Array.isArray(pred)) {
					for (const p of pred) {
						if (idx.has(p)) {
							for (const k of idx.get(p)) {
								matchingKeys.add(k);
							}
						}
					}
				} else if (idx.has(pred)) {
					for (const k of idx.get(pred)) {
						matchingKeys.add(k);
					}
				}
				if (first) {
					candidateKeys = matchingKeys;
					first = false;
				} else {
					// AND operation across different fields
					candidateKeys = new Set([...candidateKeys].filter(k => matchingKeys.has(k)));
				}
			}
			// Filter candidates with full predicate logic
			const results = [];
			for (const key of candidateKeys) {
				const record = this.get(key, true);
				if (this.matchesPredicate(record, predicate, op)) {
					results.push(this.immutable ? this.get(key) : record);
				}
			}

			return this.immutable ? this.freeze(...results) : results;
		}

		// Fallback to full scan if no indexes available
		return this.filter(a => this.matchesPredicate(a, predicate, op));
	}

}

/**
 * Factory function to create a new Haro instance with optional initial data
 * @param {Array<Object>|null} [data=null] - Initial data to populate the store
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
	const obj = new Haro(config);

	if (Array.isArray(data)) {
		obj.batch(data, STRING_SET);
	}

	return obj;
}
