import {clone, delIndex, each, indexKeys, merge, setIndex, uuid} from "./utils.js";
import {
	INT_0,
	STRING_A,
	STRING_COMMA,
	STRING_DEL,
	STRING_DOUBLE_PIPE,
	STRING_EMPTY,
	STRING_FUNCTION,
	STRING_INDEXES,
	STRING_INVALID_FIELD,
	STRING_INVALID_TYPE,
	STRING_PIPE,
	STRING_RECORD_NOT_FOUND,
	STRING_RECORDS,
	STRING_REGISTRY,
	STRING_SET,
	STRING_SIZE
} from "./constants.js";

export class Haro {
	constructor ({delimiter = STRING_PIPE, id = uuid(), index = [], key = STRING_EMPTY, versioning = false} = {}) {
		this.data = new Map();
		this.delimiter = delimiter;
		this.id = id;
		this.index = index;
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

	batch (args, type = STRING_SET) {
		const fn = type === STRING_DEL ? i => this.del(i, true) : i => this.set(null, i, true, true);

		return this.onbatch(this.beforeBatch(args, type).map(fn), type);
	}

	beforeBatch (arg) {
		return arg;
	}

	beforeClear () {
	}

	beforeDelete () {
	}

	beforeSet () {
	}

	clear () {
		this.beforeClear();
		this.data.clear();
		this.indexes.clear();
		this.versions.clear();
		this.reindex().onclear();

		return this;
	}

	del (key, batch = false) {
		if (this.has(key) === false) {
			throw new Error(STRING_RECORD_NOT_FOUND);
		}

		const og = this.get(key, true);

		this.beforeDelete(key, batch);
		delIndex(this.index, this.indexes, this.delimiter, key, og);
		this.data.delete(key);
		this.ondelete(key, batch);

		if (this.versioning) {
			this.versions.delete(key);
		}
	}

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

	entries () {
		return this.data.entries();
	}

	find (where = {}, raw = false) {
		const key = Object.keys(where).sort((a, b) => a.localeCompare(b)).join(this.delimiter),
			index = this.indexes.get(key) || new Map();
		let result = [];

		if (index.size > 0) {
			const keys = indexKeys(key, this.delimiter, where);

			result = Array.from(keys.reduce((a, v) => {
				if (index.has(v)) {
					index.get(v).forEach(k => a.add(k));
				}

				return a;
			}, new Set())).map(i => this.get(i, raw));
		}

		return raw ? result : this.list(...result);
	}

	filter (fn = () => void 0, raw = false) {
		const x = raw ? (k, v) => v : (k, v) => Object.freeze([k, Object.freeze(v)]),
			result = this.reduce((a, v, k, ctx) => {
				if (fn.call(ctx, v)) {
					a.push(x(k, v));
				}

				return a;
			}, []);

		return raw ? result : Object.freeze(result);
	}

	forEach (fn, ctx) {
		this.data.forEach((value, key) => fn(clone(value), clone(key)), ctx || this.data);

		return this;
	}

	get (key, raw = false) {
		const result = clone(this.data.get(key) || null);

		return raw ? result : this.list(key, result);
	}

	has (key) {
		return this.data.has(key);
	}

	keys () {
		return this.data.keys();
	}

	limit (offset = INT_0, max = INT_0, raw = false) {
		const result = this.registry.slice(offset, offset + max).map(i => this.get(i, raw));

		return raw ? result : this.list(...result);
	}

	list (...args) {
		return Object.freeze(args.map(i => Object.freeze(i)));
	}

	map (fn, raw = false) {
		const result = [];

		this.forEach((value, key) => result.push(fn(value, key)));

		return raw ? result : this.list(...result);
	}

	onbatch (arg) {
		return arg;
	}

	onclear () {
	}

	ondelete () {
	}

	onoverride () {
	}

	onset () {
	}

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

	reduce (fn, accumulator, raw = false) {
		let a = accumulator || this.data.keys().next().value;

		this.forEach((v, k) => {
			a = fn(a, v, k, this, raw);
		}, this);

		return a;
	}

	reindex (index) {
		const indices = index ? [index] : this.index;

		if (index && this.index.includes(index) === false) {
			this.index.push(index);
		}

		each(indices, i => this.indexes.set(i, new Map()));
		this.forEach((data, key) => each(indices, i => setIndex(this.index, this.indexes, this.delimiter, key, data, i)));

		return this;
	}

	search (value, index, raw = false) {
		const result = new Map(),
			fn = typeof value === STRING_FUNCTION,
			rgex = value && typeof value.test === STRING_FUNCTION;

		if (value) {
			each(index ? Array.isArray(index) ? index : [index] : this.index, i => {
				let idx = this.indexes.get(i);

				if (idx) {
					idx.forEach((lset, lkey) => {
						switch (true) {
							case fn && value(lkey, i):
							case rgex && value.test(Array.isArray(lkey) ? lkey.join(STRING_COMMA) : lkey):
							case lkey === value:
								lset.forEach(key => {
									if (result.has(key) === false && this.has(key)) {
										result.set(key, this.get(key, raw));
									}
								});
								break;
							default:
								void 0;
						}
					});
				}
			});
		}

		return raw ? Array.from(result.values()) : this.list(...Array.from(result.values()));
	}

	set (key = null, data = {}, batch = false, override = false) {
		let x = clone(data);

		if (key === null) {
			if (this.key in x) {
				key = x[this.key];
			} else {
				x[this.key] = key = uuid();
			}
		}

		this.beforeSet(key, x, batch, override);

		if (this.has(key) === false) {
			if (this.versioning) {
				this.versions.set(key, new Set());
			}
		} else {
			let og = this.get(key, true);
			delIndex(this.index, this.indexes, this.delimiter, key, og);

			if (this.versioning) {
				this.versions.get(key).add(Object.freeze(clone(og)));
			}

			if (override === false) {
				x = merge(clone(og), x);
			}
		}

		this.data.set(key, x);
		setIndex(this.index, this.indexes, this.delimiter, key, x, null);
		let result = this.get(key);
		this.onset(result, batch);

		return result;
	}

	sort (fn, frozen = true) {
		return frozen ? Object.freeze(this.limit(INT_0, this.data.size, true).sort(fn).map(i => Object.freeze(i))) : this.limit(INT_0, this.data.size, true).sort(fn);
	}

	sortBy (index = STRING_EMPTY, raw = false) {
		if (index === STRING_EMPTY) {
			throw new Error(STRING_INVALID_FIELD)
		}

		const result = [],
			keys = [];

		if (this.indexes.has(index) === false) {
			this.reindex(index);
		}

		const lindex = this.indexes.get(index);

		lindex.forEach((idx, key) => keys.push(key));
		each(keys.sort(), i => lindex.get(i).forEach(key => result.push(this.get(key, raw))));

		return raw ? result : this.list(...result);
	}

	toArray (frozen = true) {
		const result = Array.from(this.data.values());

		if (frozen) {
			each(result, i => Object.freeze(i));
			Object.freeze(result);
		}

		return result;
	}

	values () {
		return this.data.values();
	}

	where (predicate = {}, raw = false, op = STRING_DOUBLE_PIPE) {
		const keys = this.index.filter(i => i in predicate);

		return keys.length > INT_0 ? this.filter(new Function(STRING_A, `return (${keys.map(i => {
			let result;

			if (Array.isArray(predicate[i])) {
				result = `Array.isArray(a['${i}']) ? ${predicate[i].map(arg => `a['${i}'].includes(${typeof arg === "string" ? `'${arg}'` : arg})`).join(` ${op} `)} : (${predicate[i].map(arg => `a['${i}'] === ${typeof arg === "string" ? `'${arg}'` : arg}`).join(` ${op} `)})`;
			} else if (predicate[i] instanceof RegExp) {
				result = `Array.isArray(a['${i}']) ? a['${i}'].filter(i => ${predicate[i]}.test(a['${i}'])).length > 0 : ${predicate[i]}.test(a['${i}'])`;
			} else {
				const arg = typeof predicate[i] === "string" ? `'${predicate[i]}'` : predicate[i];

				result = `Array.isArray(a['${i}']) ? a['${i}'].includes(${arg}) : a['${i}'] === ${arg}`;
			}

			return result;
		}).join(") && (")});`), raw) : [];
	}
}

export function haro (data = null, config = {}) {
	const obj = new Haro(config);

	if (Array.isArray(data)) {
		obj.batch(data, STRING_SET);
	}

	return obj;
}
