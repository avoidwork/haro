	class Haro {
		constructor ({adapters = {}, debounce = 0, delimiter = "|", id = uuid(), index = [], key = "", logging = true, pattern = "\\s*|\\t*", versioning = false} = {}) {
			this.adapters = adapters;
			this.data = new Map();
			this.debounce = debounce;
			this.debounced = new Map();
			this.delimiter = delimiter;
			this.id = id;
			this.index = index;
			this.indexes = new Map();
			this.key = key;
			this.logging = logging;
			this.pattern = pattern;
			this.size = 0;
			this.worker = null;
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

			this.beforeBatch(args, type);

			try {
				const fn = type === "del" ? i => this.del(i, true, lazyLoad) : i => this.set(null, i, true, true, lazyLoad);

				result = await Promise.all(args.map(fn));
				this.onbatch(type, result);
				this.log(`Batch successful on ${this.id}`);
			} catch (e) {
				this.onerror("batch", e);
				this.log(`Batch failure on ${this.id}`);
				throw e;
			}

			return result;
		}

		beforeBatch () {}

		beforeClear () {}

		beforeDelete () {}

		beforeSet () {}

		clear () {
			this.beforeClear();
			this.size = 0;
			this.data.clear();
			this.indexes.clear();
			this.versions.clear();
			this.reindex().onclear();
			this.log(`Cleared ${this.id}`);

			return this;
		}

		async cmd (type, ...args) {
			if (this.adapters[type] === void 0 || adapter[type] === void 0) {
				throw new Error(`${type} not configured for persistent storage`);
			}

			return await adapter[type].apply(this, [this, ...args]);
		}

		del (key, batch = false, lazyLoad = false, retry = false) {
			if (this.has(key) === false) {
				throw new Error("Record not found");
			}

			const og = this.get(key, true);

			return this.exec(async () => {
				this.beforeDelete(key, batch, lazyLoad, retry);
				delIndex(this.index, this.indexes, this.delimiter, key, og, this.pattern);
				this.data.delete(key);
				--this.size;
			}, async () => {
				this.ondelete(key, batch, retry, lazyLoad);

				if (this.versioning) {
					this.versions.delete(key);
				}

				if (!lazyLoad) {
					this.storage("remove", key).then(success => {
						if (success) {
							this.log(`Deleted ${key} from persistent storage`);
						}
					}, e => this.log(`Error deleting ${key} from persistent storage: ${e.message || e.stack || e}`, "error"));
				}
			}, err => {
				this.onerror("delete", err);
				throw err;
			});
		}

		dump (type = "records") {
			const result = type === "records" ? Array.from(this.entries()) : Object.fromEntries(this.indexes);

			if (type === "indexes") {
				for (const key of Object.keys(result)) {
					result[key] = Object.fromEntries(result[key]);

					for (const lkey of Object.keys(result[key])) {
						result[key][lkey] = Array.from(result[key][lkey]);
					}
				}
			}

			return result;
		}

		entries () {
			return this.data.entries();
		}

		async exec (first, second, handler) {
			let result;

			try {
				const arg = await first();

				result = await second(arg);
			} catch (err) {
				handler(err);
			}

			return result;
		}

		find (where, raw = false) {
			const key = Object.keys(where).sort((a, b) => a.localeCompare(b)).join(this.delimiter),
				value = keyIndex(key, where, this.delimiter, this.pattern),
				result = [];

			if (this.indexes.has(key)) {
				(this.indexes.get(key).get(value) || new Set()).forEach(i => result.push(this.get(i, raw)));
			}

			return raw ? result : this.list(...result);
		}

		filter (fn, raw = false) {
			const result = this.reduce((a, v, k, ctx) => {
				if (fn.call(ctx, v)) {
					a.push(this.get(k, raw));
				}

				return a;
			}, []);

			return raw ? result : this.list(...result);
		}

		forEach (fn, ctx) {
			this.data.forEach((value, key) => fn(clone(value), clone(key)), ctx || this.data);

			return this;
		}

		get (key, raw = false) {
			const result = clone(this.data.get(key) || null);

			return result && !raw ? this.list(key, result) : result;
		}

		has (key, map) {
			return (map || this.data).has(key);
		}

		async join (other, on, type = "inner", where = []) {
			let result;

			if (other.size > 0) {
				if (where.length > 0) {
					result = await this.offload([[this.id, other.id], this.find(where[0], true), !where[1] ? other.toArray(null, true) : other.find(where[1], true), this.key, on || this.key, type], "join");
				} else {
					result = await this.offload([[this.id, other.id], this.toArray(null, true), other.toArray(null, true), this.key, on || this.key, type], "join");
				}

				if (typeof arg === "string") {
					throw new Error(result);
				}
			} else {
				result = [];
			}

			return result;
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

		async load (type = "mongo", key = void 0) {
			const batch = key === void 0,
				id = !batch ? key : this.id;
			let result;

			if (batch) {
				this.clear();
			}

			try {
				const data = await this.cmd(type, "get", key);

				result = batch ? this.batch(data, "set", true) : this.set(key, data, true, true, true);
				this.log(`Loaded ${id} from ${type} persistent storage`);
			} catch (e) {
				this.log(`Error loading ${id} from ${type} persistent storage: ${e.message || e.stack || e}`, "error");
				throw e;
			}

			return result;
		}

		log (arg = "", type = "log") {
			if (this.logging) {
				console[type](`haro: ${arg}`);
			}
		}

		map (fn, raw = false) {
			const result = [];

			this.forEach((value, key) => result.push(fn(value, key)));

			return raw ? result : this.list(...result);
		}

		async offload (data, cmd = "index", index = this.index) {
			return new Promise((resolve, reject) => {
				if (this.worker) {
					const obj = this.useWorker(resolve, reject);
					let payload;

					if (cmd === "index") {
						payload = {
							cmd: cmd,
							index: index,
							records: data,
							key: this.key,
							delimiter: this.delimiter,
							pattern: this.pattern
						};
					} else if (cmd === "join") {
						payload = {
							cmd: cmd,
							ids: data[0],
							records: [data[1], data[2]],
							key: data[3],
							on: data[4],
							type: data[5]
						};
					}

					obj.postMessage(JSON.stringify(payload, null, 0));
				} else {
					reject(new Error(webWorkerError));
				}
			});
		}

		onbatch () {}

		onclear () {}

		ondelete () {}

		onerror () {}

		onrequest (arg) {
			return arg;
		}

		onset () {}

		onsync () {}

		async override (data, type = "records") {
			const result = true;

			if (type === "indexes") {
				this.indexes = new Map(Object.keys(data).map(i => [i, new Map(Object.keys(data[i]).map(p => [p, new Set(data[i][p])]))]));
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

		register (key, fn) {
			adapter[key] = fn;

			return this;
		}

		reindex (index) {
			const indices = index ? [index] : this.index;

			if (index && this.index.includes(index) === false) {
				this.index.push(index);
			}

			each(indices, i => this.indexes.set(i, new Map()));
			this.forEach((data, key) => each(indices, i => setIndex(this.index, this.indexes, this.delimiter, key, data, i, this.pattern)));

			return this;
		}

		async save (type = "mongo") {
			let result;

			try {
				result = await this.cmd(type, "set");
				this.log(`Saved ${this.id} to ${type} persistent storage`);
			} catch (e) {
				this.log(`Error saving ${this.id} to ${type} persistent storage: ${e.message || e.stack || e}`, "error");
				throw e;
			}

			return result;
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
										if (!result.has(key) && this.has(key)) {
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
				og;

			return this.exec(async () => {
				if (key === void 0 || key === null) {
					key = this.key && x[this.key] !== void 0 ? x[this.key] : uuid();
				}

				this.beforeSet(key, data, batch, override, lazyLoad, retry);

				if (!this.data.has(key)) {
					++this.size;

					if (this.versioning) {
						this.versions.set(key, new Set());
					}
				} else {
					og = this.get(key, true);
					delIndex(this.index, this.indexes, this.delimiter, key, og, this.pattern);

					if (this.versioning) {
						this.versions.get(key).add(Object.freeze(clone(og)));
					}

					if (override === false) {
						x = merge(clone(og), x);
					}
				}

				this.data.set(key, x);
				setIndex(this.index, this.indexes, this.delimiter, key, x, null, this.pattern);

				return this.get(key);
			}, async arg => {
				this.onset(arg, batch, retry, lazyLoad);

				if (!lazyLoad) {
					this.storage("set", key, x).then(success => {
						if (success) {
							this.log(`Saved ${key} to persistent storage`);
						}
					}, e => this.log(`Error saving ${key} to persistent storage: ${e.message || e.stack || e}`, "error"));
				}

				return arg;
			}, err => {
				this.onerror("set", err);
				throw err;
			});
		}

		sort (fn, frozen = true) {
			return frozen ? Object.freeze(this.limit(0, this.size, true).sort(fn).map(i => Object.freeze(i))) : this.limit(0, this.size, true).sort(fn);
		}

		sortBy (index, raw = false) {
			const result = [],
				keys = [];

			let lindex;

			if (!this.indexes.has(index)) {
				this.reindex(index);
			}

			lindex = this.indexes.get(index);
			lindex.forEach((idx, key) => keys.push(key));
			each(keys.sort(), i => lindex.get(i).forEach(key => result.push(this.get(key, raw))));

			return raw ? result : this.list(...result);
		}

		async storage (...args) {
			let result;

			try {
				const promises = Object.keys(this.adapters).map(async i => await this.cmd.apply(this, [i, ...args]));

				if (promises.length > 0) {
					await Promise.all(promises);
					result = true;
				} else {
					result = false;
				}
			} catch (e) {
				this.log(e.stack || e.message || e, "error");
				result = false;
			}

			return result;
		}

		toArray (data, frozen = true) {
			let result;

			if (data) {
				result = data.map(i => frozen ? i[1] : clone(i[1]));
			} else {
				result = this.limit(0, this.size, true);

				if (frozen) {
					each(result, i => Object.freeze(i));
				}
			}

			return frozen ? Object.freeze(result) : result;
		}

		toObject (data, frozen = true) {
			const result = !data ? toObjekt(this, frozen) : data.reduce((a, b) => {
				const obj = clone(b[1]);

				if (frozen) {
					Object.freeze(obj);
				}

				a[b[0]] = obj;

				return a;
			}, {});

			return frozen ? Object.freeze(result) : result;
		}

		transform (input, fn) {
			return typeof fn === "function" ? fn(input) : cast(input);
		}

		async unload (type = "mongo", key = void 0) {
			const id = key !== void 0 ? key : this.id;
			let result;

			try {
				result = await this.cmd(type, "remove", key);
				this.log(`Unloaded ${id} from ${type} persistent storage`);
			} catch (e) {
				this.log(`Error unloading ${id} from ${type} persistent storage: ${e.message || e.stack || e}`, "error");
				throw e;
			}

			return result;
		}

		unregister (key) {
			delete adapter[key];
		}

		values () {
			return this.data.values();
		}

		useWorker (resolve, reject) {
			let obj;

			if (this.worker) {
				obj = new Worker(this.worker);

				obj.onerror = err => {
					reject(err);
					obj.terminate();
				};

				obj.onmessage = ev => {
					resolve(JSON.parse(ev.data));
					obj.terminate();
				};
			} else {
				reject(new Error(webWorkerError));
			}

			return obj;
		}

		where (predicate, raw = false, op = "||") {
			const keys = this.index.filter(i => i in predicate);

			return keys.length > 0 ? this.filter(new Function("a", `return (${keys.map(i => {
				let result;

				if (Array.isArray(predicate[i])) {
					result = `Array.isArray(a['${i}']) ? ${predicate[i].map(arg => `a['${i}'].includes(${typeof arg === "string" ? `'${arg}'` : arg})`).join(` ${op} `)} : a['${i}'] === '${predicate[i].join(",")}'`;
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
