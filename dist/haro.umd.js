/**
 * haro
 *
 * @copyright 2025 Jason Mulligan <jason.mulligan@avoidwork.com>
 * @license BSD-3-Clause
 * @version 15.2.7
 */
(function(g,f){typeof exports==='object'&&typeof module!=='undefined'?f(exports,require('crypto')):typeof define==='function'&&define.amd?define(['exports','crypto'],f):(g=typeof globalThis!=='undefined'?globalThis:g||self,f(g.lru={},g.crypto));})(this,(function(exports,crypto){'use strict';// String constants - Single characters and symbols
const STRING_COMMA = ",";
const STRING_EMPTY = "";
const STRING_PIPE = "|";
const STRING_DOUBLE_PIPE = "||";

// String constants - Operation and type names
const STRING_DEL = "del";
const STRING_FUNCTION = "function";
const STRING_INDEXES = "indexes";
const STRING_RECORDS = "records";
const STRING_REGISTRY = "registry";
const STRING_SET = "set";
const STRING_SIZE = "size";

// String constants - Error messages
const STRING_INVALID_FIELD = "Invalid field";
const STRING_INVALID_FUNCTION = "Invalid function";
const STRING_INVALID_TYPE = "Invalid type";
const STRING_RECORD_NOT_FOUND = "Record not found";

// Integer constants
const INT_0 = 0;/**
 * Haro is a modern immutable DataStore for collections of records
 * @class
 */
class Haro {
	/**
	 * Creates a new Haro instance
	 * @param {Object} [config={}] - Configuration object
	 * @param {string} [config.delimiter=STRING_PIPE] - Delimiter for composite indexes
	 * @param {string} [config.id=this.uuid()] - Unique identifier for this instance
	 * @param {Array} [config.index=[]] - Array of field names to index
	 * @param {string} [config.key="id"] - Primary key field name
	 * @param {boolean} [config.versioning=false] - Enable versioning of records
	 * @constructor
	 */
	constructor ({delimiter = STRING_PIPE, id = this.uuid(), index = [], key = "id", versioning = false} = {}) {
		this.data = new Map();
		this.delimiter = delimiter;
		this.id = id;
		this.index = Array.isArray(index) ? [...index] : [];
		this.indexes = new Map();
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
	 * Performs batch operations on multiple records
	 * @param {Array} args - Array of records to process
	 * @param {string} [type=STRING_SET] - Type of operation (SET or DEL)
	 * @returns {Array} Array of results from the batch operation
	 */
	batch (args, type = STRING_SET) {
		const fn = type === STRING_DEL ? i => this.del(i, true) : i => this.set(null, i, true, true);

		return this.onbatch(this.beforeBatch(args, type).map(fn), type);
	}

	/**
	 * Hook for custom logic before batch operations
	 * @param {*} arg - Arguments passed to batch operation
	 * @param {string} [type=STRING_EMPTY] - Type of batch operation
	 * @returns {*} Modified arguments
	 */
	beforeBatch (arg, type = STRING_EMPTY) { // eslint-disable-line no-unused-vars
		return arg;
	}

	/**
	 * Hook for custom logic before clear operation
	 */
	beforeClear () {
		// Hook for custom logic before clear; override in subclass if needed
	}

	/**
	 * Hook for custom logic before delete operation
	 * @param {string} [key=STRING_EMPTY] - Key of record to delete
	 * @param {boolean} [batch=false] - Whether this is part of a batch operation
	 * @returns {Array} Array containing key and batch flag
	 */
	beforeDelete (key = STRING_EMPTY, batch = false) {
		return [key, batch];
	}

	/**
	 * Hook for custom logic before set operation
	 * @param {string} [key=STRING_EMPTY] - Key of record to set
	 * @param {boolean} [batch=false] - Whether this is part of a batch operation
	 * @returns {Array} Array containing key and batch flag
	 */
	beforeSet (key = STRING_EMPTY, batch = false) {
		return [key, batch];
	}

	/**
	 * Clears all data from the store
	 * @returns {Haro} This instance for method chaining
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
	 * Creates a deep clone of the given argument
	 * @param {*} arg - Value to clone
	 * @returns {*} Deep clone of the argument
	 */
	clone (arg) {
		return JSON.parse(JSON.stringify(arg));
	}

	/**
	 * Deletes a record from the store
	 * @param {string} [key=STRING_EMPTY] - Key of record to delete
	 * @param {boolean} [batch=false] - Whether this is part of a batch operation
	 * @throws {Error} Throws error if record not found
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
	 * Removes entries from indexes for a deleted record
	 * @param {Array} index - Array of index names
	 * @param {Map} indexes - Map of indexes
	 * @param {string} delimiter - Delimiter for composite indexes
	 * @param {string} key - Key of record being deleted
	 * @param {Object} data - Data of record being deleted
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
	 * Exports data or indexes from the store
	 * @param {string} [type=STRING_RECORDS] - Type of data to dump (RECORDS or INDEXES)
	 * @returns {Array} Array of records or indexes
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
	 * Utility method to iterate over an array
	 * @param {Array} [arr=[]] - Array to iterate over
	 * @param {Function} fn - Function to call for each element
	 * @returns {Array} The original array
	 */
	each (arr = [], fn) {
		for (const [idx, value] of arr.entries()) {
			fn(value, idx);
		}

		return arr;
	}

	/**
	 * Returns an iterator of [key, value] pairs for each element in the data
	 * @returns {Iterator} Iterator of entries
	 */
	entries () {
		return this.data.entries();
	}

	/**
	 * Finds records matching the given criteria using indexes
	 * @param {Object} [where={}] - Object with field-value pairs to match
	 * @param {boolean} [raw=false] - Whether to return raw data or frozen records
	 * @returns {Array} Array of matching records
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

		return raw ? result : this.list(...result);
	}

	/**
	 * Filters records using a predicate function
	 * @param {Function} fn - Predicate function to test each record
	 * @param {boolean} [raw=false] - Whether to return raw data or frozen records
	 * @returns {Array} Array of records that pass the predicate
	 * @throws {Error} Throws error if fn is not a function
	 */
	filter (fn, raw = false) {
		if (typeof fn !== STRING_FUNCTION) {
			throw new Error(STRING_INVALID_FUNCTION);
		}
		const x = raw ? (k, v) => v : (k, v) => Object.freeze([k, Object.freeze(v)]);
		const result = this.reduce((a, v, k, ctx) => {
			if (fn.call(ctx, v)) {
				a.push(x(k, v));
			}

			return a;
		}, []);

		return raw ? result : Object.freeze(result);
	}

	/**
	 * Executes a function for each record in the store
	 * @param {Function} fn - Function to execute for each record
	 * @param {*} [ctx] - Context to use as 'this' when executing the function
	 * @returns {Haro} This instance for method chaining
	 */
	forEach (fn, ctx) {
		this.data.forEach((value, key) => fn(this.clone(value), this.clone(key)), ctx ?? this.data);

		return this;
	}

	/**
	 * Gets a record by key
	 * @param {string} key - Key of record to retrieve
	 * @param {boolean} [raw=false] - Whether to return raw data or frozen record
	 * @returns {*} The record or null if not found
	 */
	get (key, raw = false) {
		const result = this.clone(this.data.get(key) ?? null);

		return raw ? result : this.list(key, result);
	}

	/**
	 * Checks if a key exists in the store
	 * @param {string} key - Key to check
	 * @returns {boolean} True if key exists, false otherwise
	 */
	has (key) {
		return this.data.has(key);
	}

	/**
	 * Generates index keys for composite indexes
	 * @param {string} [arg=STRING_EMPTY] - Composite index field names joined by delimiter
	 * @param {string} [delimiter=STRING_PIPE] - Delimiter used in composite index
	 * @param {Object} [data={}] - Data object to extract values from
	 * @returns {Array} Array of index keys
	 */
	indexKeys (arg = STRING_EMPTY, delimiter = STRING_PIPE, data = {}) {
		return arg.split(delimiter).reduce((a, li, lidx) => {
			const result = [];

			(Array.isArray(data[li]) ? data[li] : [data[li]]).forEach(lli => lidx === INT_0 ? result.push(lli) : a.forEach(x => result.push(`${x}${delimiter}${lli}`)));

			return result;
		}, []);
	}

	/**
	 * Returns an iterator of keys in the store
	 * @returns {Iterator} Iterator of keys
	 */
	keys () {
		return this.data.keys();
	}

	/**
	 * Returns a limited number of records with offset
	 * @param {number} [offset=INT_0] - Number of records to skip
	 * @param {number} [max=INT_0] - Maximum number of records to return
	 * @param {boolean} [raw=false] - Whether to return raw data or frozen records
	 * @returns {Array} Array of records
	 */
	limit (offset = INT_0, max = INT_0, raw = false) {
		const result = this.registry.slice(offset, offset + max).map(i => this.get(i, raw));

		return raw ? result : this.list(...result);
	}

	/**
	 * Creates a frozen array from the given arguments
	 * @param {...*} args - Arguments to freeze into an array
	 * @returns {Array} Frozen array of frozen arguments
	 */
	list (...args) {
		return Object.freeze(args.map(i => Object.freeze(i)));
	}

	/**
	 * Maps over all records in the store
	 * @param {Function} fn - Function to apply to each record
	 * @param {boolean} [raw=false] - Whether to return raw data or frozen records
	 * @returns {Array} Array of mapped results
	 * @throws {Error} Throws error if fn is not a function
	 */
	map (fn, raw = false) {
		if (typeof fn !== STRING_FUNCTION) {
			throw new Error(STRING_INVALID_FUNCTION);
		}

		const result = [];

		this.forEach((value, key) => result.push(fn(value, key)));

		return raw ? result : this.list(...result);
	}

	/**
	 * Merges two values together
	 * @param {*} a - First value
	 * @param {*} b - Second value
	 * @param {boolean} [override=false] - Whether to override arrays instead of concatenating
	 * @returns {*} Merged result
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
	 * Hook for custom logic after batch operations
	 * @param {*} arg - Result of batch operation
	 * @param {string} [type=STRING_EMPTY] - Type of batch operation
	 * @returns {*} Modified result
	 */
	onbatch (arg, type = STRING_EMPTY) { // eslint-disable-line no-unused-vars
		return arg;
	}

	/**
	 * Hook for custom logic after clear operation
	 */
	onclear () {
		// Hook for custom logic after clear; override in subclass if needed
	}

	/**
	 * Hook for custom logic after delete operation
	 * @param {string} [key=STRING_EMPTY] - Key of deleted record
	 * @param {boolean} [batch=false] - Whether this was part of a batch operation
	 * @returns {Array} Array containing key and batch flag
	 */
	ondelete (key = STRING_EMPTY, batch = false) {
		return [key, batch];
	}

	/**
	 * Hook for custom logic after override operation
	 * @param {string} [type=STRING_EMPTY] - Type of override operation
	 * @returns {string} The type parameter
	 */
	onoverride (type = STRING_EMPTY) {
		return type;
	}

	/**
	 * Hook for custom logic after set operation
	 * @param {Object} [arg={}] - Record that was set
	 * @param {boolean} [batch=false] - Whether this was part of a batch operation
	 * @returns {Array} Array containing record and batch flag
	 */
	onset (arg = {}, batch = false) {
		return [arg, batch];
	}

	/**
	 * Replaces all data or indexes in the store
	 * @param {Array} data - Data to replace with
	 * @param {string} [type=STRING_RECORDS] - Type of data (RECORDS or INDEXES)
	 * @returns {boolean} True if operation succeeded
	 * @throws {Error} Throws error if type is invalid
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
	 * Reduces all records to a single value
	 * @param {Function} fn - Reducer function
	 * @param {*} [accumulator] - Initial accumulator value
	 * @param {boolean} [raw=false] - Whether to work with raw data
	 * @returns {*} Reduced result
	 */
	reduce (fn, accumulator, raw = false) {
		let a = accumulator ?? this.data.keys().next().value;

		this.forEach((v, k) => {
			a = fn(a, v, k, this, raw);
		}, this);

		return a;
	}

	/**
	 * Rebuilds indexes for specified fields
	 * @param {string|Array} [index] - Index field(s) to rebuild, or all if not specified
	 * @returns {Haro} This instance for method chaining
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
	 * Searches for records matching a value across indexes
	 * @param {*} value - Value to search for (string, function, or regex)
	 * @param {string|Array} [index] - Index(es) to search in, or all if not specified
	 * @param {boolean} [raw=false] - Whether to return raw data or frozen records
	 * @returns {Array} Array of matching records
	 */
	search (value, index, raw = false) {
		const result = new Map(),
			fn = typeof value === STRING_FUNCTION,
			rgex = value && typeof value.test === STRING_FUNCTION;

		if (value) {
			this.each(index ? Array.isArray(index) ? index : [index] : this.index, i => {
				let idx = this.indexes.get(i);

				if (idx) {
					idx.forEach((lset, lkey) => {
						switch (true) {
							case fn && value(lkey, i):
							case rgex && value.test(Array.isArray(lkey) ? lkey.join(STRING_COMMA) : lkey):
							case lkey === value:
								lset.forEach(key => {
									if (result.has(key) === false && this.data.has(key)) {
										result.set(key, this.get(key, raw));
									}
								});
								break;
						}
					});
				}
			});
		}

		return raw ? Array.from(result.values()) : this.list(...Array.from(result.values()));
	}

	/**
	 * Sets a record in the store
	 * @param {string|null} [key=null] - Key for the record, or null to use record's key field
	 * @param {Object} [data={}] - Data to set
	 * @param {boolean} [batch=false] - Whether this is part of a batch operation
	 * @param {boolean} [override=false] - Whether to override existing data instead of merging
	 * @returns {Array} Frozen array containing the key and record
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
	 * Adds entries to indexes for a record
	 * @param {Array} index - Array of index names
	 * @param {Map} indexes - Map of indexes
	 * @param {string} delimiter - Delimiter for composite indexes
	 * @param {string} key - Key of record being indexed
	 * @param {Object} data - Data of record being indexed
	 * @param {string|null} indice - Specific index to update, or null for all
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
	 * @param {Function} fn - Comparator function for sorting
	 * @param {boolean} [frozen=true] - Whether to return frozen records
	 * @returns {Array} Sorted array of records
	 */
	sort (fn, frozen = true) {
		return frozen ? Object.freeze(this.limit(INT_0, this.data.size, true).sort(fn).map(i => Object.freeze(i))) : this.limit(INT_0, this.data.size, true).sort(fn);
	}

	/**
	 * Sorts records by a specific indexed field
	 * @param {string} [index=STRING_EMPTY] - Index field to sort by
	 * @param {boolean} [raw=false] - Whether to return raw data or frozen records
	 * @returns {Array} Array of records sorted by the index field
	 * @throws {Error} Throws error if index field is empty
	 */
	sortBy (index = STRING_EMPTY, raw = false) {
		if (index === STRING_EMPTY) {
			throw new Error(STRING_INVALID_FIELD);
		}

		const result = [],
			keys = [];

		if (this.indexes.has(index) === false) {
			this.reindex(index);
		}

		const lindex = this.indexes.get(index);

		lindex.forEach((idx, key) => keys.push(key));
		this.each(keys.sort(), i => lindex.get(i).forEach(key => result.push(this.get(key, raw))));

		return raw ? result : this.list(...result);
	}

	/**
	 * Converts the store data to an array
	 * @param {boolean} [frozen=true] - Whether to return frozen records
	 * @returns {Array} Array of all records
	 */
	toArray (frozen = true) {
		const result = Array.from(this.data.values());

		if (frozen) {
			this.each(result, i => Object.freeze(i));
			Object.freeze(result);
		}

		return result;
	}

	/**
	 * Generates a UUID
	 * @returns {string} UUID string
	 */
	uuid () {
		return crypto.randomUUID();
	}

	/**
	 * Returns an iterator of values in the store
	 * @returns {Iterator} Iterator of values
	 */
	values () {
		return this.data.values();
	}

	/**
	 * Filters records using predicate logic with support for AND/OR operations
	 * @param {Object} [predicate={}] - Object with field-value pairs for filtering
	 * @param {boolean} [raw=false] - Whether to return raw data or frozen records
	 * @param {string} [op=STRING_DOUBLE_PIPE] - Operator for array matching ('||' for OR, '&&' for AND)
	 * @returns {Array} Array of records matching the predicate
	 */
	where (predicate = {}, raw = false, op = STRING_DOUBLE_PIPE) {
		const keys = this.index.filter(i => i in predicate);

		if (keys.length === 0) return [];

		// Supported operators: '||' (OR), '&&' (AND)
		// Always AND across fields (all keys must match for a record)
		return this.filter(a => {
			const matches = keys.map(i => {
				const pred = predicate[i];
				const val = a[i];
				if (Array.isArray(pred)) {
					if (Array.isArray(val)) {
						if (op === "&&") {
							return pred.every(p => val.includes(p));
						} else {
							return pred.some(p => val.includes(p));
						}
					} else if (op === "&&") {
						return pred.every(p => val === p);
					} else {
						return pred.some(p => val === p);
					}
				} else if (pred instanceof RegExp) {
					if (Array.isArray(val)) {
						if (op === "&&") {
							return val.every(v => pred.test(v));
						} else {
							return val.some(v => pred.test(v));
						}
					} else {
						return pred.test(val);
					}
				} else if (Array.isArray(val)) {
					return val.includes(pred);
				} else {
					return val === pred;
				}
			});
			const isMatch = matches.every(Boolean);

			return isMatch;
		}, raw);
	}

}

/**
 * Factory function to create a new Haro instance
 * @param {Array|null} [data=null] - Initial data to populate the store
 * @param {Object} [config={}] - Configuration object passed to Haro constructor
 * @returns {Haro} New Haro instance
 */
function haro (data = null, config = {}) {
	const obj = new Haro(config);

	if (Array.isArray(data)) {
		obj.batch(data, STRING_SET);
	}

	return obj;
}exports.Haro=Haro;exports.haro=haro;}));