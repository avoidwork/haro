class Haro {
	constructor (data, config = {}) {
		this.adapters = {};
		this.data = new Map();
		this.delimiter = "|";
		this.config = {
			method: "get",
			credentials: false,
			headers: {
				accept: "application/json",
				"content-type": "application/json"
			}
		};
		this.id = uuid();
		this.index = [];
		this.indexes = new Map();
		this.key = "";
		this.loading = false;
		this.logging = true;
		this.patch = false;
		this.pattern = "\\s*|\\t*";
		this.registry = [];
		this.source = "";
		this.total = 0;
		this.uri = "";
		this.worker = null;
		this.versions = new Map();
		this.versioning = true;

		Object.keys(config).forEach(i => {
			this[i] = merge(this[i], config[i]);
		});

		this.reindex();

		if (data) {
			this.batch(data, "set");
		}
	}

	batch (args, type, lload = false) {
		let defer = deferred(),
			del = type === "del",
			data, fn, hash;

		function next () {
			Promise.all(args.map(fn)).then(defer.resolve, defer.reject);
		}

		this.loading = true;

		if (del) {
			fn = i => {
				return this.del(i, true);
			};
		} else {
			fn = i => {
				return this.set(null, i, true, true, lload);
			};
		}

		if (this.patch) {
			if (del) {
				data = patch(this.toArray().map(i => {
					return i[this.key];
				}), args, this.key, true);
			} else {
				data = [];
				hash = {};
				args.forEach(i => {
					let key = i[this.key];

					if (key) {
						hash[key] = i;
					} else {
						data.push({op: "add", path: "/", value: i});
					}
				});
				data = data.concat(patch(this.toObject(), hash, this.key, true));
			}

			if (data.length > 0) {
				this.request(concatURI(this.uri, null), {
					method: "patch",
					body: JSON.stringify(data)
				}).then(() => {
					next();
				}, defer.reject);
			} else {
				defer.resolve();
			}
		} else {
			next();
		}

		return defer.promise.then(arg => {
			let larg = tuple.apply(tuple, arg);

			this.loading = false;
			this.onbatch(type, larg);

			if (this.logging) {
				console.log("Batch inserted data into", this.id);
			}

			return larg;
		}, e => {
			this.loading = false;
			this.onerror("batch", e);
			throw e;
		});
	}

	clear () {
		this.total = 0;
		this.registry.length = 0;
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
		let defer = deferred();

		if (!this.adapters[type] || !adapter[type]) {
			defer.reject(new Error(type + " not configured for persistent storage"));
		} else {
			adapter[type].apply(this, [this].concat(args)).then(defer.resolve, defer.reject);
		}

		return defer.promise;
	}

	del (key, batch = false) {
		let defer = deferred(),
			next;

		next = () => {
			let index = this.registry.indexOf(key);

			if (index > -1) {
				if (index === 0) {
					this.registry.shift();
				} else if (index === this.registry.length - 1) {
					this.registry.pop();
				} else {
					this.registry.splice(index, 1);
				}

				delIndex(this.index, this.indexes, this.delimiter, key, this.data.get(key), this.pattern);
				this.data.delete(key);
				--this.total;

				if (this.versioning) {
					this.versions.delete(key);
				}

				this.storage("remove", key).then(success => {
					if (success && this.logging) {
						console.log("Deleted", key, "from persistent storage");
					}
				}, e => {
					if (this.logging) {
						console.error("Error deleting", key, "from persistent storage:", e.message || e.stack || e);
					}
				});
			}

			defer.resolve(key);
		};

		if (this.data.has(key)) {
			if (!batch) {
				this.loading = true;
			}

			if (!batch && this.uri) {
				if (this.patch) {
					this.request(concatURI(this.uri, null), {
						method: "patch",
						body: JSON.stringify([{op: "remove", path: "/" + key}])
					}).then(next, e => {
						if (e[1] === 405) {
							this.patch = false;
							this.request(concatURI(this.uri, key), {
								method: "delete"
							}).then(next, defer.reject);
						} else {
							defer.reject(e);
						}
					});
				} else {
					this.request(concatURI(this.uri, key), {
						method: "delete"
					}).then(next, defer.reject);
				}
			} else {
				next();
			}
		} else {
			defer.reject(new Error("Record not found"));
		}

		return defer.promise.then(arg => {
			if (!batch) {
				this.loading = false;
			}

			this.ondelete(arg);

			return arg;
		}, e => {
			if (!batch) {
				this.loading = false;
			}

			this.onerror("delete", e);
			throw e;
		});
	}

	dump (type = "records") {
		let result;

		if (type === "records") {
			result = this.toArray(null, false);
		} else {
			result = this.transform(this.indexes);
		}

		return result;
	}

	entries () {
		return this.data.entries();
	}

	find (where, raw = false) {
		let key = Object.keys(where).sort().join(this.delimiter),
			value = keyIndex(key, where, this.delimiter),
			result = [];

		if (this.indexes.has(key)) {
			(this.indexes.get(key).get(value) || new Set()).forEach(i => {
				result.push(this.get(i, raw));
			});
		}

		return !raw ? tuple.apply(tuple, result) : clone(result);
	}

	filter (fn) {
		let result = [];

		this.forEach((value, key) => {
			if (fn(value, key) === true) {
				result.push(tuple(key, value));
			}
		});

		return tuple.apply(tuple, result);
	}

	forEach (fn, ctx) {
		this.data.forEach((value, key) => {
			fn(clone(value), clone(key));
		}, ctx);

		return this;
	}

	get (key, raw = false) {
		let output;

		if (this.data.has(key)) {
			output = !raw ? tuple(key, this.data.get(key)) : clone(this.data.get(key));
		}

		return output;
	}

	has (key) {
		return this.data.has(key);
	}

	join (other, on = this.key, type = "inner", where = []) {
		let defer = deferred(),
			promise;

		if (other.total > 0) {
			if (where.length > 0) {
				promise = this.offload([[this.id, other.id], this.find(where[0], true), !where[1] ? other.toArray(null, true) : other.find(where[1], true), this.key, on, type], "join");
			} else {
				promise = this.offload([[this.id, other.id], this.toArray(null, true), other.toArray(null, true), this.key, on, type], "join");
			}

			promise.then(result => {
				if (typeof result === "string") {
					defer.reject(new Error(result));
				} else {
					defer.resolve(result);
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

	limit (max, offset = 0) {
		let lmax = max,
			loffset = offset,
			list = [],
			i, k, nth;

		if (lmax === undefined) {
			lmax = -1;
		}

		i = loffset;
		nth = loffset + lmax;

		if (i < 0 || i >= nth) {
			throw new Error("Invalid range");
		}

		do {
			k = this.registry[i];

			if (k) {
				list.push(this.get(k));
			}
		} while (++i < nth);

		return tuple.apply(tuple, list);
	}

	load (type = "mongo", key = undefined) {
		let batch = key === undefined,
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

	map (fn) {
		let result = [];

		this.forEach((value, key) => {
			result.push(fn(value, key));
		});

		return tuple.apply(tuple, result);
	}

	offload (data, cmd = "index", index = this.index) {
		let defer = deferred(),
			payload, obj;

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

				obj.postMessage(JSON.stringify(payload));
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
	onset () {}
	onsync () {}

	override (data, type = "records", fn = undefined) {
		let defer = deferred();

		if (type === "indexes") {
			this.indexes = this.transform(data, fn);
			defer.resolve(true);
		} else if (type === "records") {
			this.data = new Map();
			this.registry = [];
			data.forEach(datum => {
				let key = datum[this.key] || uuid();

				this.data.set(key, datum);
				this.registry.push(key);
			});
			this.total = this.data.size;
			defer.resolve(true);
		} else {
			defer.reject(new Error("Invalid type"));
		}

		return defer.promise;
	}

	register (key, fn) {
		adapter[key] = fn;
	}

	reindex (index) {
		if (!index) {
			this.indexes.clear();
			this.index.forEach(i => {
				this.indexes.set(i, new Map());
			});
			this.forEach((data, key) => {
				this.index.forEach(i => {
					setIndex(this.index, this.indexes, this.delimiter, key, data, i, this.pattern);
				});
			});
		} else {
			this.indexes.set(index, new Map());
			this.forEach((data, key) => {
				setIndex(this.index, this.indexes, this.delimiter, key, data, index, this.pattern);
			});
		}

		return this;
	}

	request (input, config = {}) {
		let defer = deferred(),
			cfg = merge(this.config, config);

		cfg.method = cfg.method.toUpperCase();

		fetch(input, cfg).then(res => {
			let status = res.status,
				headers;

			if (res.headers._headers) {
				headers = {};
				Object.keys(res.headers._headers).forEach(i => {
					headers[i] = res.headers._headers[i].join(", ");
				});
			} else {
				headers = toObjekt(res.headers);
			}

			res[res.headers.get("content-type").indexOf("application/json") > -1 ? "json" : "text"]().then(arg => {
				defer[status < 200 || status >= 400 ? "reject" : "resolve"](tuple(arg, status, headers));
			}, e => {
				defer.reject(tuple(e.message, status, headers));
			});
		}, e => {
			defer.reject(tuple(e.message, 0, {}));
		});

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
		let result = [],
			fn = typeof value === "function",
			rgex = value && typeof value.test === "function",
			seen = new Set(),
			lindex, indexes;

		if (value) {
			lindex = clone(index || this.index);

			if (Array.isArray(lindex)) {
				indexes = lindex;
			} else if (typeof lindex === "string") {
				indexes = [lindex];
			}

			indexes.forEach(i => {
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

		return !raw ? tuple.apply(tuple, result) : clone(result);
	}

	set (key, data, batch = false, override = false, lload = false) {
		let defer = deferred(),
			method = "post",
			ldata = clone(data),
			lkey = key,
			body, ogdata, luri;

		let next = (arg) => {
			let xdata = arg ? arg[0] : {};

			if (lkey === null) {
				if (this.key) {
					if (this.source) {
						this.source.split(".").forEach(i => {
							xdata = xdata[i] || {};
						});
					}

					lkey = xdata[this.key] || ldata[this.key] || uuid();
				} else {
					lkey = uuid();
				}
			}

			if (method === "post") {
				this.registry[this.total] = lkey;
				++this.total;

				if (this.versioning) {
					this.versions.set(lkey, new Set());
				}
			} else {
				if (this.versioning) {
					this.versions.get(lkey).add(tuple(ogdata));
				}

				delIndex(this.index, this.indexes, this.delimiter, lkey, ogdata, this.pattern);
			}

			this.data.set(lkey, ldata);
			setIndex(this.index, this.indexes, this.delimiter, lkey, ldata, null, this.pattern);
			defer.resolve(this.get(lkey));

			if (!lload) {
				this.storage("set", lkey, ldata).then(success => {
					if (success && this.logging) {
						console.log("Saved", lkey, "to persistent storage");
					}
				}, e => {
					if (this.logging) {
						console.error("Error saving", lkey, "to persistent storage:", e.message || e.stack || e);
					}
				});
			}
		};

		if (lkey === undefined || lkey === null) {
			lkey = ldata[this.key] || null;
		}

		if (lkey && this.data.has(lkey)) {
			method = "put";
			ogdata = this.data.get(lkey);

			if (!override) {
				ldata = merge(ogdata, ldata);
			}
		}

		if (!batch) {
			this.loading = true;
		}

		if (!batch && this.uri) {
			luri = concatURI(this.uri, lkey);

			if (this.patch) {
				if (method === "post") {
					body = [{op: "add", path: "/", value: ldata}];
				} else if (override) {
					body = [{op: "replace", path: "/", value: ldata}];
				} else {
					body = patch(ogdata, ldata, this.key);
				}

				this.request(luri, {
					method: "patch",
					body: JSON.stringify(body)
				}).then(next, e => {
					if (e[1] === 405) {
						this.patch = false;
						this.request(luri, {
							method: method,
							body: JSON.stringify(ldata)
						}).then(next, defer.reject);
					} else {
						defer.reject(e);
					}
				});
			} else {
				this.request(luri, {
					method: method,
					body: JSON.stringify(ldata)
				}).then(next, defer.reject);
			}
		} else {
			next();
		}

		return defer.promise.then(arg => {
			if (!batch) {
				this.loading = false;
			}

			this.onset(arg);

			return arg;
		}, e => {
			if (!batch) {
				this.loading = false;
			}

			this.onerror("set", e);
			throw e;
		});
	}

	setUri (uri, clear = false) {
		let defer = deferred();

		this.uri = uri;

		if (this.uri) {
			this.sync(clear).then(defer.resolve, defer.reject);
		} else {
			defer.resolve([]);
		}

		return defer.promise;
	}

	sort (fn, frozen = true) {
		let result;

		if (frozen) {
			result = Object.freeze(this.toArray(null, false).sort(fn).map(i => {
				return Object.freeze(i);
			}));
		} else {
			result = this.toArray(null, false).sort(fn);
		}

		return result;
	}

	sortBy (index) {
		let result = [],
			keys = [],
			lindex;

		if (!this.indexes.has(index)) {
			this.index.push(index);
			this.reindex(index);
		}

		lindex = this.indexes.get(index);
		lindex.forEach((idx, key) => {
			keys.push(key);
		});

		keys.sort().forEach(i => {
			lindex.get(i).forEach(key => {
				result.push(this.get(key));
			});
		});

		return tuple.apply(tuple, result);
	}

	storage (...args) {
		let defer = deferred(),
			deferreds = [];

		Object.keys(this.adapters).forEach(i => {
			deferreds.push(this.cmd.apply(this, [i].concat(args)));
		});

		if (deferreds.length > 0) {
			Promise.all(deferreds).then(() => {
				defer.resolve(true);
			}, defer.reject);
		} else {
			defer.resolve(false);
		}

		return defer.promise;
	}

	sync (clear = false) {
		let defer = deferred();

		this.request(this.uri).then(arg => {
			let data = arg[0];

			this.patch = (arg[2].Allow || arg[2].allow || "").indexOf("PATCH") > -1;

			if (this.source) {
				try {
					this.source.split(".").forEach(i => {
						data = data[i];
					});
				} catch (e) {
					return defer.reject(e);
				}
			}

			if (clear) {
				this.clear();
			}

			this.batch(data, "set").then(defer.resolve, defer.reject);
		}, e => {
			defer.reject(e[0] || e);
		});

		return defer.promise.then(arg => {
			let larg = tuple.apply(tuple, arg);

			this.onsync(larg);

			return larg;
		}, e => {
			this.onerror("sync", e);
			throw e;
		});
	}

	toArray (data, frozen = true) {
		let key = this.key,
			fn, result;

		if (data) {
			fn = (() => {
				if (key) {
					return function (a, b) {
						let obj = clone(b[1]);

						if (obj[key] === undefined) {
							obj[key] = clone(b[0]);
						}

						a.push(obj);

						return a;
					};
				} else {
					return function (a, b) {
						a.push(clone(b[1]));

						return a;
					};
				}
			})();
			result = data.reduce(fn, []);
		} else {
			fn = (() => {
				if (key) {
					return function (val, id) {
						let obj = clone(val);

						if (obj[key] === undefined) {
							obj[key] = clone(id);
						}

						result.push(obj);
					};
				} else {
					return function (val) {
						result.push(clone(val));
					};
				}
			})();
			result = [];
			this.forEach(fn);
		}

		return frozen ? Object.freeze(result) : result;
	}

	toObject (data, frozen = true) {
		let func;

		if (frozen) {
			func = arg => {
				return arg;
			};
		} else {
			func = arg => {
				return clone(arg);
			};
		}

		return func(!data ? toObjekt(this) : data.reduce((a, b) => {
			a[b[0]] = b[1];

			return a;
		}, {}));
	}

	transform (input, fn) {
		return typeof fn === "function" ? fn(input) : cast(input);
	}

	unload (type = "mongo", key = undefined) {
		let id = key !== undefined ? key : this.id;

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
		delete adapter[key];
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
