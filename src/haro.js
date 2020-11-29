"use strict";

const r = [8, 9, "a", "b"];

function clone (arg) {
	return JSON.parse(JSON.stringify(arg, null, 0));
}

function each (arr, fn) {
	for (const item of arr.entries()) {
		fn(item[1], item[0]);
	}

	return arr;
}

function indexKeys (arg = "", delimiter = "|", data = {}) {
	return arg.split(delimiter).reduce((a, li, lidx) => {
		const result = [];

		(Array.isArray(data[li]) ? data[li] : [data[li]]).forEach(lli => lidx === 0 ? result.push(lli) : a.forEach(x => result.push(`${x}${delimiter}${lli}`)));

		return result;
	}, []);
}

function delIndex (index, indexes, delimiter, key, data) {
	index.forEach(i => {
		const idx = indexes.get(i);

		each(i.includes(delimiter) ? indexKeys(i, delimiter, data) : Array.isArray(data[i]) ? data[i] : [data[i]], value => {
			if (idx.has(value)) {
				const o = idx.get(value);

				o.delete(key);

				if (o.size === 0) {
					idx.delete(value);
				}
			}
		});
	});
}

function merge (a, b) {
	if (a instanceof Object && b instanceof Object) {
		each(Object.keys(b), i => {
			if (a[i] instanceof Object && b[i] instanceof Object) {
				a[i] = merge(a[i], b[i]);
			} else if (Array.isArray(a[i]) && Array.isArray(b[i])) {
				a[i] = a[i].concat(b[i]);
			} else {
				a[i] = b[i];
			}
		});
	} else if (Array.isArray(a) && Array.isArray(b)) {
		a = a.concat(b);
	} else {
		a = b;
	}

	return a;
}

function s () {
	return ((Math.random() + 1) * 0x10000 | 0).toString(16).substring(1);
}

function setIndex (index, indexes, delimiter, key, data, indice) {
	each(indice === null ? index : [indice], i => {
		const lindex = indexes.get(i);

		if (i.includes(delimiter)) {
			each(indexKeys(i, delimiter, data), c => {
				if (lindex.has(c) === false) {
					lindex.set(c, new Set());
				}

				lindex.get(c).add(key);
			});
		} else {
			each(Array.isArray(data[i]) ? data[i] : [data[i]], d => {
				if (lindex.has(d) === false) {
					lindex.set(d, new Set());
				}

				lindex.get(d).add(key);
			});
		}
	});
}

function uuid () {
	return s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s();
}

class Haro {
	constructor ({delimiter = "|", id = uuid(), index = [], key = "", versioning = false} = {}) {
		this.data = new Map();
		this.delimiter = delimiter;
		this.id = id;
		this.index = index;
		this.indexes = new Map();
		this.key = key;
		this.size = 0;
		this.versions = new Map();
		this.versioning = versioning;

		Object.defineProperty(this, "registry", {
			enumerable: true,
			get: () => Array.from(this.data.keys())
		});

		return this.reindex();
	}

	async batch (args, type = "set", lazyLoad = false) {
		let result;

		try {
			const fn = type === "del" ? i => this.del(i, true, lazyLoad) : i => this.set(null, i, true, true, lazyLoad);

			result = await Promise.all(this.beforeBatch(args, type).map(fn));
			result = this.onbatch(result, type);
		} catch (e) {
			this.onerror("batch", e);
			throw e;
		}

		return result;
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
		this.size = 0;
		this.data.clear();
		this.indexes.clear();
		this.versions.clear();
		this.reindex().onclear();

		return this;
	}

	del (key, batch = false, lazyLoad = false, retry = false) {
		if (this.has(key) === false) {
			throw new Error("Record not found");
		}

		const og = this.get(key, true);

		this.beforeDelete(key, batch, lazyLoad, retry);
		delIndex(this.index, this.indexes, this.delimiter, key, og);
		this.data.delete(key);
		--this.size;
		this.ondelete(key, batch, retry, lazyLoad);

		if (this.versioning) {
			this.versions.delete(key);
		}
	}

	dump (type = "records") {
		let result;

		if (type === "records") {
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

	limit (offset = 0, max = 0, raw = false) {
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

	onerror () {
	}

	onset () {
	}

	async override (data, type = "records") {
		const result = true;

		if (type === "indexes") {
			this.indexes = new Map(data.map(i => [i[0], new Map(i[1].map(ii => [ii[0], new Set(ii[1])]))]));
		} else if (type === "records") {
			this.indexes.clear();
			this.data = new Map(data);
			this.size = this.data.size;
		} else {
			throw new Error("Invalid type");
		}

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
			fn = typeof value === "function",
			rgex = value && typeof value.test === "function";

		if (value) {
			each(index ? Array.isArray(index) ? index : [index] : this.index, i => {
				let idx = this.indexes.get(i);

				if (idx) {
					idx.forEach((lset, lkey) => {
						switch (true) {
							case fn && value(lkey, i):
							case rgex && value.test(Array.isArray(lkey) ? lkey.join(", ") : lkey):
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

	async set (key, data, batch = false, override = false, lazyLoad = false, retry = false) {
		let x = clone(data),
			og, result;

		if (key === void 0 || key === null) {
			key = this.key && x[this.key] !== void 0 ? x[this.key] : uuid();
		}

		this.beforeSet(key, data, batch, override, lazyLoad, retry);

		if (this.has(key) === false) {
			++this.size;

			if (this.versioning) {
				this.versions.set(key, new Set());
			}
		} else {
			og = this.get(key, true);
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
		result = this.get(key);
		this.onset(result, batch, retry, lazyLoad);

		return result;
	}

	sort (fn, frozen = true) {
		return frozen ? Object.freeze(this.limit(0, this.size, true).sort(fn).map(i => Object.freeze(i))) : this.limit(0, this.size, true).sort(fn);
	}

	sortBy (index, raw = false) {
		const result = [],
			keys = [];

		let lindex;

		if (this.indexes.has(index) === false) {
			this.reindex(index);
		}

		lindex = this.indexes.get(index);
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

	where (predicate, raw = false, op = "||") {
		const keys = this.index.filter(i => i in predicate);

		return keys.length > 0 ? this.filter(new Function("a", `return (${keys.map(i => {
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
		obj.batch(data, "set");
	}

	return obj;
}
