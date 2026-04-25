/**
 * haro
 *
 * @copyright 2026 Jason Mulligan <jason.mulligan@avoidwork.com>
 * @license BSD-3-Clause
 * @version 17.0.2
 */
'use strict';

var crypto$1 = require('crypto');
var tinyLru = require('tiny-lru');

// String constants - Single characters and symbols
const STRING_COMMA = ",";
const STRING_DOT = ".";
const STRING_EMPTY = "";
const STRING_PIPE = "|";
const STRING_DOUBLE_PIPE = "||";
const STRING_DOUBLE_AND = "&&";
const STRING_FUNCTION = "function";
const STRING_ID = "id";
const STRING_INDEXES = "indexes";
const STRING_OBJECT = "object";
const STRING_RECORDS = "records";
const STRING_REGISTRY = "registry";
const STRING_SIZE = "size";
const STRING_STRING = "string";
const STRING_NUMBER = "number";

// String constants - Error messages
const STRING_INVALID_FIELD = "Invalid field";
const STRING_INVALID_FUNCTION = "Invalid function";
const STRING_INVALID_TYPE = "Invalid type";
const STRING_RECORD_NOT_FOUND = "Record not found";

// Integer constants
const INT_0 = 0;
const INT_2 = 2;
const INT_256 = 256;

// Number constants
const CACHE_SIZE_DEFAULT = 1000;

// String constants - Cache and hashing
const STRING_CACHE_DOMAIN_SEARCH = "search";
const STRING_CACHE_DOMAIN_WHERE = "where";
const STRING_HASH_ALGORITHM = "SHA-256";
const STRING_HEX_PAD = "0";
const STRING_UNDERSCORE = "_";

// String constants - Security (prototype pollution protection)
const STRING_PROTO = "__proto__";
const STRING_CONSTRUCTOR = "constructor";
const STRING_PROTOTYPE = "prototype";

// String constants - Error messages
const STRING_ERROR_BATCH_SETMANY = "setMany: cannot call setMany within a batch operation";
const STRING_ERROR_BATCH_DELETEMANY =
	"deleteMany: cannot call deleteMany within a batch operation";
const STRING_ERROR_DELETE_KEY_TYPE = "delete: key must be a string or number";
const STRING_ERROR_FIND_WHERE_TYPE = "find: where must be an object";
const STRING_ERROR_LIMIT_OFFSET_TYPE = "limit: offset must be a number";
const STRING_ERROR_LIMIT_MAX_TYPE = "limit: max must be a number";
const STRING_ERROR_SEARCH_VALUE = "search: value cannot be null or undefined";
const STRING_ERROR_SET_KEY_TYPE = "set: key must be a string or number";
const STRING_ERROR_SET_DATA_TYPE = "set: data must be an object";
const STRING_ERROR_SORT_FN_TYPE = "sort: fn must be a function";
const STRING_ERROR_WHERE_OP_TYPE = "where: op must be a string";
const STRING_ERROR_WHERE_PREDICATE_TYPE = "where: predicate must be an object";

// String constants - Property names
const PROP_DELIMITER = "delimiter";
const PROP_ID = "id";
const PROP_IMMUTABLE = "immutable";
const PROP_INDEX = "index";
const PROP_KEY = "key";
const PROP_VERSIONING = "versioning";
const PROP_VERSIONS = "versions";
const PROP_WARN_ON_FULL_SCAN = "warnOnFullScan";

/**
 * Low-level value matcher for predicate matching.
 * @class
 */
class ValueMatcher {
	/**
	 * Matches a single value against a predicate.
	 * @param {*} val - Value to test
	 * @param {*} pred - Predicate value or RegExp
	 * @returns {boolean} Whether value matches predicate
	 */
	static match(val, pred) {
		if (pred instanceof RegExp) return pred.test(val);
		if (val instanceof RegExp) return val.test(pred);
		return val === pred;
	}
}

/**
 * Predicate strategy for matching records against field predicates.
 * Supports AND (every) and OR (some) logic for array predicates.
 * @class
 */
class PredicateStrategy {
	/**
	 * Creates a predicate strategy.
	 * @param {string} op - Operator: '||' (OR) or '&&' (AND)
	 */
	constructor(op) {
		this.op = op;
	}

	/**
	 * Factory method to create a strategy instance.
	 * @param {string} op - Operator: '||' (OR) or '&&' (AND)
	 * @returns {PredicateStrategy}
	 */
	static of(op) {
		return new PredicateStrategy(op);
	}

	/**
	 * Checks if a record matches a predicate object.
	 * @param {Object} record - Record to test
	 * @param {Object} predicate - Field-value predicate map
	 * @param {Function} getNestedValue - Function to retrieve nested values (record, path) => value
	 * @returns {boolean} Whether record matches all predicate fields
	 */
	matches(record, predicate, getNestedValue) {
		return Object.keys(predicate).every((key) => {
			return this.#matchField(record, key, predicate[key], getNestedValue);
		});
	}

	/**
	 * Matches a single field's predicate against a record value.
	 * @param {Object} record - Record containing the value
	 * @param {string} key - Field path
	 * @param {*} pred - Predicate for the field (value, array of values, or RegExp)
	 * @param {Function} getNestedValue - Function to retrieve nested values
	 * @returns {boolean} Whether the field matches the predicate
	 */
	#matchField(record, key, pred, getNestedValue) {
		const val = getNestedValue(record, key);

		// Array predicate matching against record value
		if (Array.isArray(pred)) {
			if (Array.isArray(val)) {
				return this.#matchArrayPred(pred, (p) => val.includes(p));
			}
			return this.#matchArrayPred(pred, (p) => val === p);
		}

		// Record field is an array, check if any element matches
		if (Array.isArray(val)) {
			return val.some((v) => ValueMatcher.match(v, pred));
		}

		return ValueMatcher.match(val, pred);
	}

	/**
	 * Applies the strategy's operator to an array of predicates.
	 * @param {Array} preds - Array of predicates
	 * @param {Function} fn - Matcher function (pred) => boolean
	 * @returns {boolean} Result of AND/OR evaluation
	 */
	#matchArrayPred(preds, fn) {
		return this.op === STRING_DOUBLE_AND ? preds.every(fn) : preds.some(fn);
	}
}

/**
 * Haro is an immutable DataStore with indexing, versioning, and batch operations.
 * Provides a Map-like interface with advanced querying capabilities.
 * @class
 * @example
 * const store = new Haro({ index: ['name'], key: 'id', versioning: true });
 * store.set(null, {name: 'John'});
 * const results = store.find({name: 'John'});
 */
class Haro {
	#cache;
	#cacheEnabled;
	#data;
	#delimiter;
	#id;
	#immutable;
	#index;
	#indexes;
	#key;
	#versions;
	#versioning;
	#warnOnFullScan;
	#inBatch = false;

	/**
	 * Creates a new Haro instance.
	 * @param {Object} [config={}] - Configuration object
	 * @param {string} [config.delimiter=STRING_PIPE] - Delimiter for composite indexes
	 * @param {string} [config.id] - Unique instance identifier (auto-generated)
	 * @param {boolean} [config.immutable=false] - Return frozen objects
	 * @param {string[]} [config.index=[]] - Fields to index
	 * @param {string} [config.key=STRING_ID] - Primary key field name
	 * @param {boolean} [config.versioning=false] - Enable versioning
	 * @param {boolean} [config.warnOnFullScan=true] - Warn on full table scans
	 * @constructor
	 * @example
	 * const store = new Haro({ index: ['name', 'email'], key: 'userId', versioning: true });
	 */
	constructor({
		cache = false,
		cacheSize = CACHE_SIZE_DEFAULT,
		delimiter = STRING_PIPE,
		id = crypto$1.randomUUID(),
		immutable = false,
		index = [],
		key = STRING_ID,
		versioning = false,
		warnOnFullScan = true,
	} = {}) {
		this.#data = new Map();
		this.#cacheEnabled = cache === true;
		this.#cache = cache === true ? tinyLru.lru(cacheSize) : null;
		this.#delimiter = delimiter;
		this.#id = id;
		this.#immutable = immutable;
		this.#index = Array.isArray(index) ? [...index] : [];
		this.#indexes = new Map();
		this.#key = key;
		this.#versions = new Map();
		this.#versioning = versioning;
		this.#warnOnFullScan = warnOnFullScan;
		this.#inBatch = false;
		Object.defineProperty(this, STRING_REGISTRY, {
			enumerable: true,
			get: () => Array.from(this.#data.keys()),
		});
		Object.defineProperty(this, STRING_SIZE, {
			enumerable: true,
			get: () => this.#data.size,
		});
		Object.defineProperty(this, PROP_KEY, {
			enumerable: true,
			get: () => this.#key,
		});
		Object.defineProperty(this, PROP_INDEX, {
			enumerable: true,
			get: () => [...this.#index],
		});
		Object.defineProperty(this, PROP_DELIMITER, {
			enumerable: true,
			get: () => this.#delimiter,
		});
		Object.defineProperty(this, PROP_IMMUTABLE, {
			enumerable: true,
			get: () => this.#immutable,
		});
		Object.defineProperty(this, PROP_VERSIONING, {
			enumerable: true,
			get: () => this.#versioning,
		});
		Object.defineProperty(this, PROP_WARN_ON_FULL_SCAN, {
			enumerable: true,
			get: () => this.#warnOnFullScan,
		});
		Object.defineProperty(this, PROP_VERSIONS, {
			enumerable: true,
			get: () => this.#versions,
		});
		Object.defineProperty(this, PROP_ID, {
			enumerable: true,
			get: () => this.#id,
		});
		this.reindex();
	}

	/**
	 * Inserts or updates multiple records.
	 * @param {Array<Object>} records - Records to insert or update
	 * @returns {Array<Object>} Stored records
	 * @example
	 * store.setMany([{id: 1, name: 'John'}, {id: 2, name: 'Jane'}]);
	 */
	setMany(records) {
		if (this.#inBatch) {
			throw new Error(STRING_ERROR_BATCH_SETMANY);
		}
		this.#inBatch = true;
		const results = records.map((i) => this.set(null, i, true));
		this.#inBatch = false;
		this.reindex();
		this.#invalidateCache();
		return results;
	}

	/**
	 * Deletes multiple records.
	 * @param {Array<string|number>} keys - Keys to delete
	 * @returns {Array<void>}
	 * @example
	 * store.deleteMany(['key1', 'key2']);
	 */
	deleteMany(keys) {
		if (this.#inBatch) {
			/* node:coverage ignore next */ throw new Error(STRING_ERROR_BATCH_DELETEMANY);
		}
		this.#inBatch = true;
		const results = keys.map((i) => this.delete(i));
		this.#inBatch = false;
		this.reindex();
		this.#invalidateCache();
		return results;
	}

	/**
	 * Returns true if currently in a batch operation.
	 * @returns {boolean} Batch operation status
	 */
	get isBatching() {
		return this.#inBatch;
	}

	/**
	 * Removes all records, indexes, and versions.
	 * @returns {Haro} This instance
	 * @example
	 * store.clear();
	 */
	clear() {
		this.#data.clear();
		this.#indexes.clear();
		this.#versions.clear();
		this.#invalidateCache();

		return this;
	}

	/**
	 * Creates a deep clone of a value.
	 * @param {*} arg - Value to clone
	 * @returns {*} Deep clone
	 */
	#clone(arg) {
		if (typeof structuredClone === STRING_FUNCTION) {
			return structuredClone(arg);
		}

		/* node:coverage ignore */ return JSON.parse(JSON.stringify(arg));
	}

	/**
	 * Freezes a result when immutable mode is enabled.
	 * @param {Array|Object} result - Value to freeze
	 * @returns {Array|Object} Frozen or unchanged result
	 */
	#freezeResult(result) {
		if (this.#immutable) {
			if (Array.isArray(result)) {
				for (let i = 0, len = result.length; i < len; i++) {
					Object.freeze(result[i]);
				}
				Object.freeze(result);
			} else {
				Object.freeze(result);
			}
		}
		return result;
	}

	/**
	 * Returns a cached result, cloned or frozen based on immutable mode.
	 * @param {*} cached - Cached value
	 * @returns {*} Cloned (non-immutable) or frozen (immutable) result
	 */
	#fromCache(cached) {
		return this.#immutable ? Object.freeze(cached) : this.#clone(cached);
	}

	/**
	 * Stores results in cache if enabled.
	 * @param {*} cacheKey - Cache key
	 * @param {Array} records - Result records to cache
	 */
	#toCache(cacheKey, records) {
		if (this.#cacheEnabled) {
			this.#cache.set(cacheKey, records);
		}
	}

	/**
	 * Deletes a record and removes it from all indexes.
	 * @param {string} [key=STRING_EMPTY] - Key to delete
	 * @throws {Error} If key not found
	 * @example
	 * store.delete('user123');
	 */
	delete(key = STRING_EMPTY) {
		if (typeof key !== STRING_STRING && typeof key !== STRING_NUMBER) {
			throw new Error(STRING_ERROR_DELETE_KEY_TYPE);
		}
		if (!this.#data.has(key)) {
			throw new Error(STRING_RECORD_NOT_FOUND);
		}
		const og = this.#data.get(key);
		if (!this.#inBatch) {
			this.#deleteIndex(key, og);
		}
		this.#data.delete(key);
		if (this.#versioning && !this.#inBatch) {
			this.#versions.delete(key);
		}
		this.#invalidateCache();
	}

	/**
	 * Generates a cache key using SHA-256 hash.
	 * @param {string} domain - Cache key prefix (e.g., 'search', 'where')
	 * @param {...*} args - Arguments to hash
	 * @returns {string} Cache key in format 'domain_HASH'
	 */
	async #getCacheKey(domain, ...args) {
		const data = JSON.stringify(args);
		const encoder = new TextEncoder();
		const hashBuffer = await crypto.subtle.digest(STRING_HASH_ALGORITHM, encoder.encode(data));
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map((b) => b.toString(16).padStart(INT_2, STRING_HEX_PAD)).join("");
		return `${domain}${STRING_UNDERSCORE}${hashHex}`;
	}

	/**
	 * Clears the cache.
	 * @returns {Haro} This instance
	 */
	clearCache() {
		if (this.#cacheEnabled) {
			this.#cache.clear();
		}
		return this;
	}

	/**
	 * Returns the current cache size.
	 * @returns {number} Number of entries in cache
	 */
	getCacheSize() {
		return this.#cacheEnabled ? this.#cache.size : 0;
	}

	/**
	 * Returns cache statistics.
	 * @returns {Object|null} Stats object with hits, misses, sets, deletes, evictions
	 */
	getCacheStats() {
		return this.#cacheEnabled ? this.#cache.stats() : null;
	}

	/**
	 * Invalidates the cache if enabled and not in batch mode.
	 * @returns {void}
	 */
	#invalidateCache() {
		if (this.#cacheEnabled && !this.#inBatch) {
			this.#cache.clear();
		}
	}

	/**
	 * Retrieves a value from a nested object using dot notation.
	 * @param {Object} obj - Object to traverse
	 * @param {string} path - Dot-notation path (e.g., 'user.address.city')
	 * @returns {*} Value at path, or undefined if path doesn't exist
	 */
	#getNestedValue(obj, path) {
		/* node:coverage ignore next 3 */
		if (obj === null || obj === undefined || path === STRING_EMPTY) {
			return undefined;
		}
		const keys = path.split(STRING_DOT);
		let result = obj;
		const keysLen = keys.length;
		for (let i = 0; i < keysLen; i++) {
			const key = keys[i];
			if (result === null || result === undefined || !(key in result)) {
				return undefined;
			}
			result = result[key];
		}
		return result;
	}

	/**
	 * Extracts index values for a field from a source object.
	 * Handles both composite indexes and scalar/array fields.
	 * @param {string} field - Field name or composite index path
	 * @param {Object} source - Source object
	 * @returns {Array} Array of index values
	 */
	#getIndexValues(field, source) {
		if (field.includes(this.#delimiter)) {
			return this.#getIndexKeysFrom(field, source, (f, s) => this.#getNestedValue(s, f));
		}
		const val = this.#getNestedValue(source, field);
		return Array.isArray(val) ? val : [val];
	}

	/**
	 * Removes a record from all indexes.
	 * @param {string} key - Record key
	 * @param {Object} data - Record data
	 * @returns {Haro} This instance
	 */
	#deleteIndex(key, data) {
		this.#index.forEach((i) => {
			const idx = this.#indexes.get(i);
			if (!idx) return;
			const values = this.#getIndexValues(i, data);
			const len = values.length;
			for (let j = 0; j < len; j++) {
				const value = values[j];
				if (idx.has(value)) {
					const o = idx.get(value);
					o.delete(key);
					if (o.size === INT_0) {
						idx.delete(value);
					}
				}
			}
		});

		return this;
	}

	/**
	 * Exports store data or indexes.
	 * @param {string} [type=STRING_RECORDS] - Export type: 'records' or 'indexes'
	 * @returns {Array<Array>} Exported data
	 * @example
	 * const records = store.dump('records');
	 */
	dump(type = STRING_RECORDS) {
		let result;
		if (type === STRING_RECORDS) {
			result = Array.from(this.entries());
		} else {
			result = Array.from(this.#indexes).map((i) => {
				i[1] = Array.from(i[1]).map((ii) => {
					ii[1] = Array.from(ii[1]);

					return ii;
				});

				return i;
			});
		}

		return result;
	}

	/**
	 * Generates index keys from source object using a value getter function.
	 * @param {string} arg - Composite index field names
	 * @param {string} delimiter - Field delimiter
	 * @param {Object} source - Source object (data or where clause)
	 * @param {Function} getValueFn - Function(field, source) => value
	 * @returns {string[]} Index keys
	 */
	#getIndexKeysFrom(arg, source, getValueFn) {
		const fields = arg.split(this.#delimiter).sort(this.#sortKeys);
		const result = [STRING_EMPTY];
		const fieldsLen = fields.length;
		for (let i = 0; i < fieldsLen; i++) {
			const field = fields[i];
			const fieldValue = getValueFn(field, source);
			const values = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
			const newResult = [];
			const resultLen = result.length;
			const valuesLen = values.length;
			for (let j = 0; j < resultLen; j++) {
				const existing = result[j];
				for (let k = 0; k < valuesLen; k++) {
					const value = values[k];
					const newKey = i === 0 ? value : `${existing}${this.#delimiter}${value}`;
					newResult.push(newKey);
				}
			}
			result.length = 0;
			result.push(...newResult);
		}
		return result;
	}

	/**
	 * Returns an iterator of [key, value] pairs.
	 * @returns {Iterator<Array<string|Object>>} Key-value pairs
	 * @example
	 * for (const [key, value] of store.entries()) { }
	 */
	entries() {
		return this.#data.entries();
	}

	/**
	 * Finds records matching criteria using indexes.
	 * @param {Object} [where={}] - Field-value pairs to match
	 * @returns {Array<Object>} Matching records
	 * @example
	 * store.find({department: 'engineering', active: true});
	 */
	find(where = {}) {
		if (typeof where !== STRING_OBJECT || where === null) {
			throw new Error(STRING_ERROR_FIND_WHERE_TYPE);
		}
		const whereKeys = Object.keys(where).sort(this.#sortKeys);
		const compositeKey = whereKeys.join(this.#delimiter);
		const result = new Set();

		const index = this.#indexes.get(compositeKey);
		if (index) {
			const keys = this.#getIndexKeysFrom(compositeKey, where, (f, s) =>
				f in s ? s[f] : this.#getNestedValue(s, f),
			);
			const keysLen = keys.length;
			for (let i = 0; i < keysLen; i++) {
				const v = keys[i];
				if (index.has(v)) {
					const keySet = index.get(v);
					for (const k of keySet) {
						result.add(k);
					}
				}
			}
		}

		return this.#freezeResult(Array.from(result, (i) => this.get(i)));
	}

	/**
	 * Filters records using a predicate function.
	 * @param {Function} fn - Predicate function (record, key, store)
	 * @returns {Array<Object>} Filtered records
	 * @throws {Error} If fn is not a function
	 * @example
	 * store.filter(record => record.age >= 18);
	 */
	filter(fn) {
		if (typeof fn !== STRING_FUNCTION) {
			throw new Error(STRING_INVALID_FUNCTION);
		}
		const result = [];
		this.#data.forEach((value, key) => {
			if (fn(value, key, this)) {
				result.push(value);
			}
		});
		return this.#freezeResult(result);
	}

	/**
	 * Executes a function for each record.
	 * @param {Function} fn - Function (value, key)
	 * @param {*} [ctx] - Context for fn
	 * @returns {Haro} This instance
	 * @example
	 * store.forEach((record, key) => console.log(key, record));
	 */
	forEach(fn, ctx = this) {
		this.#data.forEach((value, key) => {
			if (this.#immutable) {
				value = this.#clone(value);
			}
			fn.call(ctx, value, key);
		}, this);

		return this;
	}

	/**
	 * Retrieves a record by key.
	 * @param {string} key - Record key
	 * @returns {Object|null} Record or null
	 * @example
	 * store.get('user123');
	 */
	get(key) {
		const result = this.#data.get(key);
		if (result === undefined) {
			return null;
		}
		return this.#freezeResult(result);
	}

	/**
	 * Checks if a record exists.
	 * @param {string} key - Record key
	 * @returns {boolean} True if exists
	 * @example
	 * store.has('user123');
	 */
	has(key) {
		return this.#data.has(key);
	}

	/**
	 * Returns an iterator of all keys.
	 * @returns {Iterator<string>} Keys
	 * @example
	 * for (const key of store.keys()) { }
	 */
	keys() {
		return this.#data.keys();
	}

	/**
	 * Returns a limited subset of records.
	 * @param {number} [offset=INT_0] - Records to skip
	 * @param {number} [max=INT_0] - Max records to return
	 * @returns {Array<Object>} Records
	 * @example
	 * store.limit(0, 10);
	 */
	limit(offset = INT_0, max = INT_0) {
		if (typeof offset !== STRING_NUMBER) {
			throw new Error(STRING_ERROR_LIMIT_OFFSET_TYPE);
		}
		if (typeof max !== STRING_NUMBER) {
			throw new Error(STRING_ERROR_LIMIT_MAX_TYPE);
		}
		return this.#freezeResult(this.registry.slice(offset, offset + max).map((i) => this.get(i)));
	}

	/**
	 * Transforms records using a mapping function.
	 * @param {Function} fn - Transform function (record, key)
	 * @returns {Array<*>} Transformed results
	 * @throws {Error} If fn is not a function
	 * @example
	 * store.map(record => record.name);
	 */
	map(fn) {
		if (typeof fn !== STRING_FUNCTION) {
			throw new Error(STRING_INVALID_FUNCTION);
		}
		let result = [];
		this.forEach((value, key) => result.push(fn(value, key)));
		return this.#freezeResult(result);
	}

	/**
	 * Merges two values.
	 * @param {*} a - Target value
	 * @param {*} b - Source value
	 * @param {boolean} [override=false] - Override arrays
	 * @returns {*} Merged result
	 */
	#merge(a, b) {
		if (Array.isArray(a) && Array.isArray(b)) {
			a = a.concat(b);
		} else if (
			typeof a === STRING_OBJECT &&
			a !== null &&
			typeof b === STRING_OBJECT &&
			b !== null
		) {
			const keys = Object.keys(b);
			const keysLen = keys.length;
			for (let i = 0; i < keysLen; i++) {
				const key = keys[i];
				a[key] = this.#merge(a[key], b[key]);
			}
		} else {
			a = b;
		}

		return a;
	}

	/**
	 * Replaces store data or indexes.
	 * @param {Array<Array>} data - Data to replace
	 * @param {string} [type=STRING_RECORDS] - Type: 'records' or 'indexes'
	 * @returns {boolean} Success
	 * @throws {Error} If type is invalid
	 * @example
	 * store.override([['key1', {name: 'John'}]], 'records');
	 */
	override(data, type = STRING_RECORDS) {
		const result = true;
		if (type === STRING_INDEXES) {
			this.#indexes = new Map(
				data.map((i) => [i[0], new Map(i[1].map((ii) => [ii[0], new Set(ii[1])]))]),
			);
		} else if (type === STRING_RECORDS) {
			this.#indexes.clear();
			this.#data = new Map(data);
		} else {
			throw new Error(STRING_INVALID_TYPE);
		}
		this.#invalidateCache();

		return result;
	}

	/**
	 * Rebuilds indexes.
	 * @param {string|string[]} [index] - Field(s) to rebuild, or all
	 * @returns {Haro} This instance
	 * @example
	 * store.reindex();
	 * store.reindex('name');
	 */
	reindex(index) {
		const indices = index ? (Array.isArray(index) ? index : [index]) : this.#index;
		if (index && this.#index.includes(index) === false) {
			this.#index.push(index);
		}
		const indicesLen = indices.length;
		for (let i = 0; i < indicesLen; i++) {
			this.#indexes.set(indices[i], new Map());
		}
		this.forEach((data, key) => {
			for (let i = 0; i < indicesLen; i++) {
				this.#setIndex(key, data, indices[i]);
			}
		});
		this.#invalidateCache();

		return this;
	}

	/**
	 * Searches for records containing a value.
	 * @param {*} value - Search value (string, function, or RegExp)
	 * @param {string|string[]} [index] - Index(es) to search, or all
	 * @returns {Promise<Array<Object>>} Matching records
	 * @example
	 * store.search('john');
	 * store.search(/^admin/, 'role');
	 */
	async search(value, index) {
		if (value === null || value === undefined) {
			throw new Error(STRING_ERROR_SEARCH_VALUE);
		}

		let cacheKey;
		if (this.#cacheEnabled) {
			cacheKey = await this.#getCacheKey(STRING_CACHE_DOMAIN_SEARCH, value, index);
			const cached = this.#cache.get(cacheKey);
			if (cached !== undefined) {
				return this.#fromCache(cached);
			}
		}

		const result = new Set();
		const fn = typeof value === STRING_FUNCTION;
		const rgex = value && typeof value.test === STRING_FUNCTION;
		if (rgex && value.source.length > INT_256) {
			throw new Error(STRING_ERROR_SEARCH_VALUE);
		}
		const indices = index ? (Array.isArray(index) ? index : [index]) : this.#index;
		const indicesLen = indices.length;

		for (let i = 0; i < indicesLen; i++) {
			const idxName = indices[i];
			const idx = this.#indexes.get(idxName);
			if (!idx) continue;

			for (const [lkey, lset] of idx) {
				let match = false;

				if (fn) {
					match = value(lkey, idxName);
				} else if (rgex) {
					match = value.test(Array.isArray(lkey) ? lkey.join(STRING_COMMA) : lkey);
				} else {
					match = lkey === value;
				}

				if (match) {
					for (const key of lset) {
						if (this.#data.has(key)) {
							result.add(key);
						}
					}
				}
			}
		}
		const records = Array.from(result, (key) => this.get(key));

		this.#toCache(cacheKey, records);
		return this.#freezeResult(records);
	}

	/**
	 * Sets or updates a record with automatic indexing.
	 * @param {string|null} [key=null] - Record key, or null for auto-generate
	 * @param {Object} [data={}] - Record data
	 * @param {boolean} [override=false] - Override instead of merge
	 * @returns {Object} Stored record
	 * @example
	 * store.set(null, {name: 'John'});
	 * store.set('user123', {age: 31});
	 */
	set(key = null, data = {}, override = false) {
		if (key !== null && typeof key !== STRING_STRING && typeof key !== STRING_NUMBER) {
			throw new Error(STRING_ERROR_SET_KEY_TYPE);
		}
		if (typeof data !== STRING_OBJECT || data === null) {
			throw new Error(STRING_ERROR_SET_DATA_TYPE);
		}
		if (key === null) {
			key = data[this.#key] ?? crypto$1.randomUUID();
		}
		const pollutionProps = new Set([STRING_PROTO, STRING_CONSTRUCTOR, STRING_PROTOTYPE]);
		const safeData = Object.fromEntries(
			Object.entries(data).filter(([k]) => !pollutionProps.has(k)),
		);
		let x = { ...safeData, [this.#key]: key };
		if (!this.#data.has(key)) {
			if (this.#versioning && !this.#inBatch) {
				this.#versions.set(key, new Set());
			}
		} else {
			const og = this.#data.get(key);
			if (!this.#inBatch) {
				this.#deleteIndex(key, og);
				if (this.#versioning) {
					this.#versions.get(key).add(Object.freeze(this.#clone(og)));
				}
			}
			if (!this.#inBatch && !override) {
				x = this.#merge(this.#clone(og), x);
			}
		}
		this.#data.set(key, x);

		if (!this.#inBatch) {
			this.#setIndex(key, x, null);
		}

		const result = this.get(key);
		this.#invalidateCache();

		return result;
	}

	/**
	 * Adds a record to indexes.
	 * @param {string} key - Record key
	 * @param {Object} data - Record data
	 * @param {string|null} indice - Index to update, or null for all
	 * @returns {Haro} This instance
	 */
	#setIndex(key, data, indice) {
		const indices = indice === null ? this.#index : [indice];
		const indicesLen = indices.length;
		for (let i = 0; i < indicesLen; i++) {
			const field = indices[i];
			let idx = this.#indexes.get(field);
			if (!idx) {
				idx = new Map();
				this.#indexes.set(field, idx);
			}
			const values = this.#getIndexValues(field, data);
			const valuesLen = values.length;
			for (let j = 0; j < valuesLen; j++) {
				const value = values[j];
				if (!idx.has(value)) {
					idx.set(value, new Set());
				}
				idx.get(value).add(key);
			}
		}
		return this;
	}

	/**
	 * Sorts records using a comparator function.
	 * @param {Function} fn - Comparator (a, b) => number
	 * @param {boolean} [frozen=false] - Return frozen records
	 * @returns {Array<Object>} Sorted records
	 * @example
	 * store.sort((a, b) => a.age - b.age);
	 */
	sort(fn) {
		if (typeof fn !== STRING_FUNCTION) {
			throw new Error(STRING_ERROR_SORT_FN_TYPE);
		}
		const result = Array.from(this.#data.values())
			.map((v) => (this.#immutable ? this.#clone(v) : v))
			.sort(fn);
		return this.#freezeResult(result);
	}

	/**
	 * Sorts keys with type-aware comparison.
	 * @param {*} a - First value
	 * @param {*} b - Second value
	 * @returns {number} Comparison result
	 */
	#sortKeys(a, b) {
		// Handle string comparison
		if (typeof a === STRING_STRING && typeof b === STRING_STRING) {
			return a.localeCompare(b);
		}
		// Handle numeric comparison
		if (typeof a === STRING_NUMBER && typeof b === STRING_NUMBER) {
			return a - b;
		}

		// Handle mixed types or other types by converting to string
		return String(a).localeCompare(String(b));
	}

	/**
	 * Sorts records by an indexed field.
	 * @param {string} [index=STRING_EMPTY] - Field to sort by
	 * @returns {Array<Object>} Sorted records
	 * @throws {Error} If index is empty
	 * @example
	 * store.sortBy('age');
	 */
	sortBy(index = STRING_EMPTY) {
		if (index === STRING_EMPTY) {
			throw new Error(STRING_INVALID_FIELD);
		}
		const keys = [];
		if (this.#indexes.has(index) === false) {
			this.reindex(index);
		}
		const lindex = this.#indexes.get(index);
		lindex.forEach((idx, key) => keys.push(key));
		keys.sort(this.#sortKeys);
		const result = keys.flatMap((i) => {
			const inner = Array.from(lindex.get(i));
			const innerLen = inner.length;
			const mapped = Array.from({ length: innerLen }, (_, j) => this.get(inner[j]));
			return mapped;
		});

		return this.#freezeResult(result);
	}

	/**
	 * Converts store data to an array.
	 * @returns {Array<Object>} All records
	 * @example
	 * store.toArray();
	 */
	toArray() {
		const result = Array.from(this.#data.values());
		if (this.#immutable) {
			return this.#freezeResult(result);
		}

		return result;
	}

	/**
	 * Returns an iterator of all values.
	 * @returns {Iterator<Object>} Values
	 * @example
	 * for (const record of store.values()) { }
	 */
	values() {
		return this.#data.values();
	}

	/**
	 * Filters records with predicate logic supporting AND/OR on arrays.
	 * @param {Object} [predicate={}] - Field-value pairs
	 * @param {string} [op=STRING_DOUBLE_PIPE] - Operator: '||' (OR) or '&&' (AND)
	 * @returns {Promise<Array<Object>>} Matching records
	 * @example
	 * store.where({tags: ['admin', 'user']}, '||');
	 * store.where({email: /^admin@/});
	 */
	async where(predicate = {}, op = STRING_DOUBLE_PIPE) {
		if (typeof predicate !== STRING_OBJECT || predicate === null) {
			throw new Error(STRING_ERROR_WHERE_PREDICATE_TYPE);
		}
		if (typeof op !== STRING_STRING) {
			throw new Error(STRING_ERROR_WHERE_OP_TYPE);
		}

		let cacheKey;
		if (this.#cacheEnabled) {
			cacheKey = await this.#getCacheKey(STRING_CACHE_DOMAIN_WHERE, predicate, op);
			const cached = this.#cache.get(cacheKey);
			if (cached !== undefined) {
				return this.#fromCache(cached);
			}
		}

		const keys = this.#index.filter((i) => i in predicate);
		if (keys.length === 0) {
			if (this.#warnOnFullScan) {
				console.warn("where(): performing full table scan - consider adding an index");
			}
			const strategy = PredicateStrategy.of(op);
			return this.filter((a) =>
				strategy.matches(a, predicate, (r, k) => this.#getNestedValue(r, k)),
			);
		}

		// Try to use indexes for better performance
		const indexedKeys = keys.filter((k) => this.#indexes.has(k));
		if (indexedKeys.length > 0) {
			// Use index-based filtering for better performance
			let candidateKeys = new Set();
			let first = true;
			for (const key of indexedKeys) {
				const pred = predicate[key];
				const idx = this.#indexes.get(key);
				const matchingKeys = new Set();
				if (Array.isArray(pred)) {
					for (const p of pred) {
						if (idx.has(p)) {
							for (const k of idx.get(p)) {
								matchingKeys.add(k);
							}
						}
					}
				} else if (pred instanceof RegExp) {
					for (const [indexKey, keySet] of idx) {
						if (pred.test(indexKey)) {
							for (const k of keySet) {
								matchingKeys.add(k);
							}
						}
					}
				} else {
					// Direct value lookup - works for both flat and nested fields
					// Also check for RegExp keys that match the predicate
					for (const [indexKey, keySet] of idx) {
						if (indexKey instanceof RegExp) {
							if (indexKey.test(pred)) {
								for (const k of keySet) {
									matchingKeys.add(k);
								}
							}
						} else if (indexKey === pred) {
							for (const k of keySet) {
								matchingKeys.add(k);
							}
						}
					}
				}
				if (first) {
					candidateKeys = matchingKeys;
					first = false;
				} else {
					// AND operation across different fields
					candidateKeys = new Set([...candidateKeys].filter((k) => matchingKeys.has(k)));
				}
			}
			// Filter candidates with full predicate logic
			const strategy = PredicateStrategy.of(op);
			const results = [];
			for (const key of candidateKeys) {
				const record = this.get(key);
				if (strategy.matches(record, predicate, (r, k) => this.#getNestedValue(r, k))) {
					results.push(record);
				}
			}

			this.#toCache(cacheKey, results);
			return this.#freezeResult(results);
		}

		// Indexed keys matched but no candidates found - return empty array
		this.#toCache(cacheKey, []);
		return this.#freezeResult([]);
	}
}

/**
 * Factory function to create a Haro instance.
 * @param {Array<Object>|null} [data=null] - Initial data
 * @param {Object} [config={}] - Configuration
 * @returns {Haro} New Haro instance
 * @example
 * const store = haro([{id: 1, name: 'John'}], {index: ['name']});
 */
function haro(data = null, config = {}) {
	const obj = new Haro(config);

	if (Array.isArray(data)) {
		obj.setMany(data);
	}

	return obj;
}

exports.Haro = Haro;
exports.haro = haro;
