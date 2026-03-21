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
	STRING_RECORDS,
	STRING_REGISTRY,
	STRING_SET,
	STRING_SIZE,
	STRING_STRING,
	STRING_NUMBER
} from "./constants.js";

export class Haro {
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

	_clone(value) {
		try {
			return structuredClone(value);
		} catch {
			return JSON.parse(JSON.stringify(value));
		}
	}

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

	_buildIndexes() {
		for (const field of this.index) {
			this.indexes.set(field, new Map());
		}
		for (const [key, data] of this.data) {
			this._setIndex(key, data);
		}
	}

	batch (records, type = STRING_SET) {
		if (!Array.isArray(records)) return [];
		if (type === STRING_DEL) {
			return records.map(r => this.delete(r[this.key] ?? r));
		}
		return records.map(r => this.set(r));
	}

	clear () {
		this.data.clear();
		for (const idx of this.indexes.values()) {
			idx.clear();
		}
		if (this.versions) this.versions.clear();
		this._registry = [];
		return this;
	}

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

	dump (type = STRING_RECORDS) {
		if (type === STRING_RECORDS) {
			return Array.from(this.data.entries());
		}
		return Array.from(this.indexes).map(([k, v]) => [k, Array.from(v).map(([kk, vv]) => [kk, Array.from(vv)])]);
	}

	entries () {
		return this.data.entries();
	}

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

	forEach (fn, ctx) {
		for (const [key, record] of this.data) {
			fn.call(ctx, this._freeze(record), key);
		}
		return this;
	}

	get (key) {
		const record = this.data.get(key);
		return record ? this._freeze(record) : null;
	}

	has (key) {
		return this.data.has(key);
	}

	keys () {
		return this.data.keys();
	}

	limit (offset = 0, max = 0) {
		const end = offset + max;
		const keys = this._registry.slice(offset, max > 0 ? end : undefined);
		return keys.map(k => this._freeze(this.data.get(k)));
	}

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

	reduce (fn, accumulator) {
		let acc = accumulator;
		for (const [key, record] of this.data) {
			acc = fn(acc, this._freeze(record), key);
		}
		return acc;
	}

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
						if (this.data.has(recordKey)) {
							result.add(recordKey);
						}
					}
				}
			}
		}

		return Array.from(result).map(k => this._freeze(this.data.get(k)));
	}

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

	sort (fn) {
		const records = Array.from(this.data.values()).map(r => this._freeze(r));
		return records.sort(fn);
	}

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

	toArray () {
		return Array.from(this.data.values()).map(r => this._freeze(r));
	}

	values () {
		const self = this;
		return (function* () {
			for (const record of self.data.values()) {
				yield self._freeze(record);
			}
		})();
	}

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

export function haro (data = null, config = {}) {
	const store = new Haro(config);
	if (Array.isArray(data)) {
		data.forEach(r => store.set(r));
	}
	return store;
}
