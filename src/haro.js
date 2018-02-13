	class Haro {
		constructor ({config = {}, debounce = 0, delimiter = "|", id = uuid(), index = [], key = "", logging = true, patch = false, pattern = "\\s*|\\t*", source = "", versioning = false} = {}) {
			this.adapters = {};
			this.data = new Map();
			this.debounce = debounce;
			this.debounced = new Map();
			this.delimiter = delimiter;
			this.config = {
				method: "get",
				credentials: "include",
				headers: {
					accept: "application/json",
					"content-type": "application/json"
				}
			};
			this.id = id;
			this.index = index;
			this.indexes = new Map();
			this.key = key;
			this.logging = logging;
			this.patch = patch;
			this.pattern = pattern;
			this.source = source;
			this.total = 0;
			this.uri = "";
			this.worker = null;
			this.versions = new Map();
			this.versioning = versioning;

			Object.defineProperty(this, "registry", {
				enumerable: true,
				get: () => Array.from(this.data.keys())
			});

			if (Object.keys(config).length > 1) {
				this.config = merge(this.config, config);
			}
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

		beforeRequest () {}

		beforeSet () {}

		beforeSync () {}

		clear () {
			this.beforeClear();
			this.total = 0;
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

		crawl (arg) {
			let result = clone(arg);

			each((this.source || "").split("."), i => {
				result = result[i];
			});

			return result || arg;
		}

		del (key, batch = false, lazyLoad = false, retry = false) {
			const og = this.get(key, true);

			return new Promise((resolve, reject) => {
				if (og) {
					this.beforeDelete(key, batch, lazyLoad, retry);
					delIndex(this.index, this.indexes, this.delimiter, key, og, this.pattern);
					this.data.delete(key);
					--this.total;
					resolve(key);
				} else {
					reject(new Error("Record not found"));
				}
			}).then(arg => {
				this.ondelete(arg, batch, retry, lazyLoad);

				if (this.versioning) {
					this.versions.delete(key);
				}

				if (!lazyLoad) {
					this.storage("remove", key).then(success => {
						if (success) {
							this.log(`Deleted ${key} from persistent storage`);
						}
					}, e => this.log(`Error deleting ${key} from persistent storage: ${e.message || e.stack || e}`, "error"));

					if (!batch && !retry && this.uri) {
						if (this.debounced.has(key)) {
							clearTimeout(this.debounced.get(key));
						}

						this.debounced.set(key, setTimeout(async () => {
							this.debounced.delete(key);

							try {
								await this.transmit(key, null, og, false, "delete");
							} catch (err) {
								this.log(err.stack || err.message || err, "error");

								try {
									await this.set(key, og, true, true);
									this.log(`Reverted ${key}`);
								} catch (e) {
									this.log(`Failed to revert ${key}`);
								}
							}
						}, this.debounce));
					}
				}

				return arg;
			}, e => {
				this.onerror("delete", e);
				throw e;
			});
		}

		dump (type = "records") {
			return type === "records" ? this.toArray(null, false) : this.transform(this.indexes);
		}

		entries () {
			return this.data.entries();
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
			const result = [];

			this.forEach((value, key) => {
				if (fn(value, key) === true) {
					result.push(this.get(key, raw));
				}
			}, this);

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

			if (other.total > 0) {
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

		async load (type = "mongo", key = undefined) {
			const batch = key === undefined,
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

		async override (data, type = "records", fn = undefined) {
			const result = true;

			if (type === "indexes") {
				this.indexes = this.transform(data, fn);
			} else if (type === "records") {
				this.data.clear();
				this.indexes.clear();
				each(data, datum => this.data.set(this.key ? datum[this.key] : uuid() || uuid(), datum));
				this.total = this.data.size;
			} else {
				throw new Error("Invalid type");
			}

			return result;
		}

		register (key, fn) {
			adapter[key] = fn;

			return this;
		}

		reindex (index) {
			const indices = index ? [index] : this.index;

			if (index && this.index.indexOf(index) === -1) {
				this.index.push(index);
			}

			each(indices, i => this.indexes.set(i, new Map()));
			this.forEach((data, key) => each(indices, i => setIndex(this.index, this.indexes, this.delimiter, key, data, i, this.pattern)));

			return this;
		}

		async request (input, config = {}) {
			return new Promise(async (resolve, reject) => {
				const cfg = merge(clone(this.config), config),
					ref = [input, cfg],
					headers = {};

				cfg.method = cfg.method.toUpperCase();

				if (cfg.method === "DELETE") {
					delete cfg.body;
				}

				this.beforeRequest(...ref);

				try {
					const res = await fetch(input, cfg),
						ok = res.ok,
						status = res.status;

					if (res.headers._headers) {
						each(Object.keys(res.headers._headers), i => {
							headers[i] = res.headers._headers[i].join(", ");
						});
					} else {
						for (const pair of res.headers.entries()) {
							headers[pair[0]] = pair[1];
						}
					}

					const arg = await res[(headers["content-type"] || "").indexOf("application/json") > -1 ? "json" : "text"](),
						next = ok ? resolve : reject;

					next(this.list(this.onrequest(arg, status, headers), status, headers));
				} catch (e) {
					reject(this.list(e.message, 0, {}));
				}
			});
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
				method, og;

			return new Promise(resolve => {
				if (key === undefined || key === null) {
					key = this.key && x[this.key] !== undefined ? x[this.key] : uuid();
				}

				this.beforeSet(key, data, batch, override, lazyLoad, retry);

				if (!this.data.has(key)) {
					++this.total;
					method = "post";

					if (this.versioning) {
						this.versions.set(key, new Set());
					}
				} else {
					og = this.get(key, true);
					delIndex(this.index, this.indexes, this.delimiter, key, og, this.pattern);
					method = "put";

					if (this.versioning) {
						this.versions.get(key).add(Object.freeze(clone(og)));
					}

					if (override === false) {
						x = merge(clone(og), x);
					}
				}

				this.data.set(key, x);
				setIndex(this.index, this.indexes, this.delimiter, key, x, null, this.pattern);
				resolve(this.get(key));
			}).then(arg => {
				this.onset(arg, batch, retry, lazyLoad);

				if (!lazyLoad) {
					this.storage("set", key, x).then(success => {
						if (success) {
							this.log(`Saved ${key} to persistent storage`);
						}
					}, e => this.log(`Error saving ${key} to persistent storage: ${e.message || e.stack || e}`, "error"));

					if (!batch && !retry && this.uri) {
						if (this.debounced.has(key)) {
							clearTimeout(this.debounced.get(key));
						}

						this.debounced.set(key, setTimeout(async () => {
							this.debounced.delete(key);

							try {
								await this.transmit(key, x, og, override, method);

								if (og) {
									try {
										await this.set(key, og, batch, true, lazyLoad, true);
										this.log(`Reverted ${key}`);
									} catch (e) {
										this.log(`Failed to revert ${key}`);
									}
								} else {
									try {
										await this.del(key, true);
										this.log(`Reverted ${key}`);
									} catch (e) {
										this.log(`Failed to revert ${key}`);
									}
								}
							} catch (e) {
								this.log(e.stack || e.message || e, "error");
							}
						}, this.debounce));
					}
				}

				return arg;
			}, e => {
				this.onerror("set", e);
				throw e;
			});
		}

		async setUri (uri, clear = false) {
			this.uri = uri;

			return this.uri !== "" ? await this.sync(clear) : [];
		}

		sort (fn, frozen = true) {
			return frozen ? Object.freeze(this.limit(0, this.total, true).sort(fn).map(i => Object.freeze(i))) : this.limit(0, this.total, true).sort(fn);
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
				const deferreds = Object.keys(this.adapters).map(async i => await this.cmd.apply(this, [i, ...args]));

				if (deferreds.length > 0) {
					await Promise.all(deferreds);
					result = true;
				} else {
					result = false;
				}
			} catch (e) {
				this.log(e.stack || e.message || e, "error");
				throw e;
			}

			return result;
		}

		async sync (clear = false) {
			let result;

			this.beforeSync(this.uri, clear);

			try {
				const arg = await this.request(this.uri),
					data = this.source ? this.crawl(arg[0]) : arg[0];

				this.patch = (arg[2].Allow || arg[2].allow || "").includes("PATCH");

				if (clear) {
					this.clear();
				}

				result = await this.batch(data, "set");
				this.onsync(result);
			} catch (e) {
				this.onerror("sync", e[0] || e);
				throw e[0] || e;
			}

			return result;
		}

		toArray (data, frozen = true) {
			let result;

			if (data) {
				result = data.map(i => frozen ? i[1] : clone(i[1]));
			} else {
				result = this.limit(0, this.total, true);

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

		async transmit (key, data, og, override = false, method = "post") {
			const uri = concatURI(this.uri, data ? key : null);

			let body, result;

			if (this.patch) {
				if (data === void 0) {
					body = [{op: "remove", path: "/", value: key}];
				} else if (og === void 0) {
					body = [{op: "add", path: "/", value: data}];
				} else if (override) {
					body = [{op: "replace", path: "/", value: data}];
				} else {
					body = createPatch(og, data, this.key);
				}

				try {
					result = await this.request(uri, {method: "patch", body: JSON.stringify(body, null, 0)});
				} catch (e) {
					if (e[1] === 405) {
						this.patch = false;
						result = await this.request(!data ? concatURI(this.uri, key) : uri, {
							method: method,
							body: JSON.stringify(data, null, 0)
						});
					} else {
						throw e;
					}
				}
			} else {
				result = await this.request(uri, {method: method, body: JSON.stringify(data, null, 0)});
			}

			return result;
		}

		async unload (type = "mongo", key = undefined) {
			const id = key !== undefined ? key : this.id;
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
	}
