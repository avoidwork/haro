	class Haro {
		constructor ({config = {}, debounce = 0, delimiter = "|", id = uuid(), index = [], key = "", logging = true, patch = false, pattern = "\\s*|\\t*", source = "", versioning = false} = {}) {
			this.adapters = new Map();
			this.data = new Map();
			this.debounce = debounce;
			this.debounced = new Map();
			this.delimiter = delimiter;
			this.config = {
				method: "get",
				credentials: false,
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
				get: function () {
					return Array.from(this.data.keys());
				}
			});

			if (Object.keys(config).length > 1) {
				this.config = merge(this.config, config);
			}
		}

		batch (args, type = "set", lazyLoad = false) {
			const defer = deferred(),
				fn = type === "del" ? i => this.del(i, true, lazyLoad) : i => this.set(null, i, true, true, lazyLoad);

			this.beforeBatch(args, type);
			Promise.all(args.map(fn)).then(defer.resolve, defer.reject);

			return defer.promise.then(arg => {
				this.onbatch(type, arg);

				if (this.logging) {
					console.log("Batch successful on", this.id);
				}

				return arg;
			}, e => {
				this.onerror("batch", e);

				if (this.logging) {
					console.log("Batch failure on", this.id);
				}

				throw e;
			});
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

			if (this.logging) {
				console.log("Cleared", this.id);
			}

			return this;
		}

		cmd (type, ...args) {
			const defer = deferred();

			if (!this.adapters.has(type)) {
				defer.reject(new Error(type + " not configured for persistent storage"));
			} else {
				this.adapters.get(type).apply(this, [this, ...args]).then(defer.resolve, defer.reject);
			}

			return defer.promise;
		}

		crawl (arg) {
			let result = clone(arg);

			each((this.source || "").split("."), i => {
				result = result[i];
			});

			return result || arg;
		}

		del (key, batch = false, lazyLoad = false, retry = false) {
			const defer = deferred(),
				og = this.get(key, true);

			if (og) {
				this.beforeDelete(key, batch, lazyLoad, retry);
				delIndex(this.index, this.indexes, this.delimiter, key, og, this.pattern);
				this.data.delete(key);
				--this.total;
				defer.resolve(key);
			} else {
				defer.reject(new Error("Record not found"));
			}

			return defer.promise.then(arg => {
				this.ondelete(arg, batch, retry, lazyLoad);

				if (this.versioning) {
					this.versions.delete(key);
				}

				if (!lazyLoad) {
					this.storage("remove", key).then(success => {
						if (success && this.logging) {
							console.log("Deleted", key, "from persistent storage");
						}
					}, e => {
						if (this.logging) {
							console.error("Error deleting", key, "from persistent storage:", e.message || e.stack || e);
						}
					});

					if (!batch && !retry && this.uri) {
						if (this.debounced.has(key)) {
							clearTimeout(this.debounced.get(key));
						}

						this.debounced.set(key, setTimeout(() => {
							this.debounced.delete(key);
							this.transmit(key, null, og, false, "delete").catch(err => {
								if (this.logging) {
									console.error(err.stack || err.message || err);
								}

								this.set(key, og, true, true).then(() => {
									if (this.logging) {
										console.log("Reverted", key);
									}
								}).catch(() => {
									if (this.logging) {
										console.log("Failed to revert", key);
									}
								});
							});
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

		join (other, on, type = "inner", where = []) {
			const defer = deferred();

			let promise;

			if (other.total > 0) {
				if (where.length > 0) {
					promise = this.offload([[this.id, other.id], this.find(where[0], true), !where[1] ? other.toArray(null, true) : other.find(where[1], true), this.key, on || this.key, type], "join");
				} else {
					promise = this.offload([[this.id, other.id], this.toArray(null, true), other.toArray(null, true), this.key, on || this.key, type], "join");
				}

				promise.then(arg => {
					if (typeof arg === "string") {
						defer.reject(new Error(arg));
					} else {
						defer.resolve(arg);
					}
				}, defer.reject);
			} else {
				defer.resolve([]);
			}

			return defer.promise;
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

		load (type = "mongo", key = undefined) {
			const batch = key === undefined,
				id = !batch ? key : this.id;

			if (batch) {
				this.clear();
			}

			return this.cmd(type, "get", key).then(arg => {
				if (this.logging) {
					console.log("Loaded", id, "from", type, "persistent storage");
				}

				return batch ? this.batch(arg, "set", true) : this.set(key, arg, true, true, true);
			}, e => {
				if (this.logging) {
					console.error("Error loading", id, "from", type, "persistent storage:", e.message || e.stack || e);
				}

				throw e;
			});
		}

		map (fn, raw = false) {
			const result = [];

			this.forEach((value, key) => result.push(fn(value, key)));

			return raw ? result : this.list(...result);
		}

		offload (data, cmd = "index", index = this.index) {
			const defer = deferred();

			let payload, obj;

			if (this.worker) {
				obj = this.useWorker(defer);

				if (obj) {
					if (cmd === "index") {
						payload = {
							cmd: cmd,
							index: index,
							records: data,
							key: this.key,
							delimiter: this.delimiter,
							pattern: this.pattern
						};
					}

					if (cmd === "join") {
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
				}
			} else {
				defer.reject(new Error(webWorkerError));
			}

			return defer.promise;
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

		override (data, type = "records", fn = undefined) {
			const defer = deferred();

			if (type === "indexes") {
				this.indexes = this.transform(data, fn);
				defer.resolve(true);
			} else if (type === "records") {
				this.data.clear();
				this.indexes.clear();

				each(data, datum => {
					const key = this.key ? datum[this.key] : uuid() || uuid();

					this.data.set(key, datum);
				});

				this.total = this.data.size;
				defer.resolve(true);
			} else {
				defer.reject(new Error("Invalid type"));
			}

			return defer.promise;
		}

		register (key, fn) {
			this.adapters.set(key, fn);

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

		request (input, config = {}) {
			const defer = deferred(),
				cfg = merge(clone(this.config), config),
				ref = [input, cfg];

			cfg.method = cfg.method.toUpperCase();

			if (cfg.method === "DELETE") {
				delete cfg.body;
			}

			this.beforeRequest(...ref);

			fetch(input, cfg).then(res => {
				const status = res.status,
					headers = {};

				if (res.headers._headers) {
					each(Object.keys(res.headers._headers), i => {
						headers[i] = res.headers._headers[i].join(", ");
					});
				} else {
					for (const pair of res.headers.entries()) {
						headers[pair[0]] = pair[1];
					}
				}

				res[(headers["content-type"] || "").indexOf("application/json") > -1 ? "json" : "text"]().then(arg => {
					defer[status < 200 || status >= 400 ? "reject" : "resolve"](this.list(this.onrequest(arg, status, headers), status, headers));
				}, e => defer.reject(this.list(e.message, status, headers)));
			}, e => defer.reject(this.list(e.message, 0, {})));

			return defer.promise;
		}

		save (type = "mongo") {
			return this.cmd(type, "set").then(arg => {
				if (this.logging) {
					console.log("Saved", this.id, "to", type, "persistent storage");
				}

				return arg;
			}, e => {
				if (this.logging) {
					console.error("Error saving ", this.id, "to", type, "persistent storage:", e.message || e.stack || e);
				}

				throw e;
			});
		}

		search (value, index, raw = false) {
			const result = [],
				fn = typeof value === "function",
				rgex = value && typeof value.test === "function",
				seen = new Set();

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
										if (!seen.has(key)) {
											seen.add(key);
											result.push(this.get(key, raw));
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

			return raw ? result : this.list(...result);
		}

		set (key, data, batch = false, override = false, lazyLoad = false, retry = false) {
			const defer = deferred();

			let x = clone(data),
				method, og;

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

				if (!override) {
					x = merge(clone(og), x);
				}
			}

			this.data.set(key, x);
			setIndex(this.index, this.indexes, this.delimiter, key, x, null, this.pattern);
			defer.resolve(this.get(key));

			return defer.promise.then(arg => {
				this.onset(arg, batch, retry, lazyLoad);


				if (!lazyLoad) {
					this.storage("set", key, x).then(success => {
						if (success && this.logging) {
							console.log("Saved", key, "to persistent storage");
						}
					}, e => {
						if (this.logging) {
							console.error("Error saving", key, "to persistent storage:", e.message || e.stack || e);
						}
					});

					if (!batch && !retry && this.uri) {
						if (this.debounced.has(key)) {
							clearTimeout(this.debounced.get(key));
						}

						this.debounced.set(key, setTimeout(() => {
							this.debounced.delete(key);
							this.transmit(key, x, og, override, method).catch(e => {
								if (this.logging) {
									console.error(e.stack || e.message || e);
								}

								if (og) {
									this.set(key, og, batch, true, lazyLoad, true).then(() => {
										if (this.logging) {
											console.log("Reverted", key);
										}
									}).catch(() => {
										if (this.logging) {
											console.log("Failed to revert", key);
										}
									});
								} else {
									this.del(key, true).then(() => {
										if (this.logging) {
											console.log("Reverted", key);
										}
									}).catch(() => {
										if (this.logging) {
											console.log("Failed to revert", key);
										}
									});
								}
							});
						}, this.debounce));
					}
				}

				return arg;
			}, e => {
				this.onerror("set", e);
				throw e;
			});
		}

		setUri (uri, clear = false) {
			const defer = deferred();

			this.uri = uri;

			if (this.uri) {
				this.sync(clear).then(defer.resolve, defer.reject);
			} else {
				defer.resolve([]);
			}

			return defer.promise;
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

		storage (...args) {
			const defer = deferred(),
				deferreds = Array.from(this.adapters.keys()).map(i => this.cmd.apply(this, [i, ...args]));

			if (deferreds.length > 0) {
				Promise.all(deferreds).then(() => defer.resolve(true), defer.reject);
			} else {
				defer.resolve(false);
			}

			return defer.promise;
		}

		sync (clear = false) {
			const defer = deferred();

			let valid = true;

			this.beforeSync(this.uri, clear);
			this.request(this.uri).then(arg => {
				let data;

				this.patch = (arg[2].Allow || arg[2].allow || "").indexOf("PATCH") > -1;

				try {
					data = this.source ? this.crawl(arg[0]) : arg[0];
				} catch (e) {
					valid = false;
					defer.reject(e);
				}

				if (valid) {
					if (clear) {
						this.clear();
					}

					this.batch(data, "set").then(defer.resolve, defer.reject);
				}
			}, e => {
				defer.reject(e[0] || e);
			});

			return defer.promise.then(arg => {
				this.onsync(arg);

				return arg;
			}, e => {
				this.onerror("sync", e);

				throw e;
			});
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

		transmit (key, data, og, override = false, method = "post") {
			const defer = deferred(),
				uri = concatURI(this.uri, data ? key : null);

			let body;

			if (this.patch) {
				if (!data) {
					body = [{op: "remove", path: "/", value: key}];
				} else if (!og) {
					body = [{op: "add", path: "/", value: data}];
				} else if (override) {
					body = [{op: "replace", path: "/", value: data}];
				} else {
					body = createPatch(og, data, this.key);
				}

				this.request(uri, {method: "patch", body: JSON.stringify(body, null, 0)}).then(defer.resolve, e => {
					if (e[1] === 405) {
						this.patch = false;
						this.request(!data ? concatURI(this.uri, key) : uri, {method: method, body: JSON.stringify(data, null, 0)}).then(defer.resolve, defer.reject);
					} else {
						defer.reject(e);
					}
				});
			} else {
				this.request(uri, {method: method, body: JSON.stringify(data, null, 0)}).then(defer.resolve, defer.reject);
			}

			return defer.promise;
		}

		unload (type = "mongo", key = undefined) {
			const id = key !== undefined ? key : this.id;

			return this.cmd(type, "remove", key).then(arg => {
				if (this.logging) {
					console.log("Unloaded", id, "from", type, "persistent storage");
				}

				return arg;
			}, e => {
				if (this.logging) {
					console.error("Error unloading", id, "from", type, "persistent storage:", e.message || e.stack || e);
				}

				throw e;
			});
		}

		unregister (key) {
			if (this.adapters.has(key)) {
				this.adapters.delete(key);
			}
		}

		values () {
			return this.data.values();
		}

		useWorker (defer) {
			let obj;

			if (this.worker) {
				obj = new Worker(this.worker);

				obj.onerror = err => {
					defer.reject(err);
					obj.terminate();
				};

				obj.onmessage = ev => {
					defer.resolve(JSON.parse(ev.data));
					obj.terminate();
				};
			} else {
				defer.reject(new Error(webWorkerError));
			}

			return obj;
		}
	}
