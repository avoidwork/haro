class Haro {
	constructor (data, config = {}) {
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
		this.index = [];
		this.indexes = new Map();
		this.patch = false;
		this.registry = [];
		this.key = "";
		this.source = "";
		this.total = 0;
		this.uri = "";
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

	batch (args, type) {
		let defer = deferred(),
			del = type === "del",
			data, fn, hash;

		function next () {
			Promise.all(args.map(fn)).then(function (arg) {
				defer.resolve(arg);
			}, function (e) {
				defer.reject(e);
			});
		}

		if (del) {
			fn = i => {
				return this.del(i, true);
			};
		} else {
			fn = i => {
				return this.set(null, i, true, true);
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
				this.request(this.uri, {
					method: "patch",
					body: JSON.stringify(data)
				}).then(function () {
					next();
				}, function (e) {
					defer.reject(e);
				});
			} else {
				defer.resolve();
			}
		} else {
			next();
		}

		return defer.promise;
	}

	clear () {
		this.total = 0;
		this.registry = [];
		this.data.clear();
		this.indexes.clear();
		this.versions.clear();

		return this.reindex();
	}

	del (key, batch = false) {
		let defer = deferred(),
			next;

		next = () => {
			let index = this.registry.indexOf(key);

			if (index > -1) {
				if (index === 0) {
					this.registry.shift();
				} else if (index === (this.registry.length - 1)) {
					this.registry.pop();
				} else {
					this.registry.splice(index, 1);
				}

				delIndex(this.index, this.indexes, this.delimiter, key, this.data.get(key));
				this.data.delete(key);
				--this.total;

				if (this.versioning) {
					this.versions.delete(key);
				}
			}

			defer.resolve();
		};

		if (this.data.has(key)) {
			if (!batch && this.uri) {
				if (this.patch) {
					this.request(concatURI(this.uri, null), {
						method: "patch",
						body: JSON.stringify([{op: "remove", path: "/" + key}])
					}).then(next, function (e) {
						defer.reject(e[0] || e);
					});
				} else {
					this.request(concatURI(this.uri, key), {
						method: "delete"
					}).then(next, function (e) {
						defer.reject(e[0] || e);
					});
				}
			} else {
				next();
			}
		} else {
			defer.reject(new Error("Record not found"));
		}

		return defer.promise;
	}

	entries () {
		return this.data.entries();
	}

	find (where) {
		let key = Object.keys(where).sort().join(this.delimiter),
			value = keyIndex(key, where, this.delimiter),
			result = [];

		if (this.indexes.has(key)) {
			(this.indexes.get(key).get(value) || new Set()).forEach(i => {
				result.push(this.get(i));
			});
		}

		return tuple.apply(tuple, result);
	}

	filter (fn) {
		let result = [];

		this.forEach(function (value, key) {
			if (fn(value, key) === true) {
				result.push(tuple(key, value));
			}
		});

		return tuple.apply(tuple, result);
	}

	forEach (fn, ctx) {
		this.data.forEach(function (value, key) {
			fn(clone(value), clone(key));
		}, ctx);

		return this;
	}

	get (key) {
		let output;

		if (this.data.has(key)) {
			output = tuple(key, this.data.get(key));
		}

		return output;
	}

	keys () {
		return this.data.keys();
	}

	limit (offset = 0, max) {
		let loffset = offset,
			lmax = max,
			list = [],
			i, k, nth;

		if (lmax === undefined) {
			lmax = loffset;
			loffset = 0;
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

	map (fn) {
		let result = [];

		this.forEach(function (value, key) {
			result.push(fn(value, key));
		});

		return tuple.apply(tuple, result);
	}

	reindex (index) {
		if (!index) {
			this.indexes.clear();
			this.index.forEach(i => {
				this.indexes.set(i, new Map());
			});
			this.forEach((data, key) => {
				this.index.forEach(i => {
					setIndex(this.index, this.indexes, this.delimiter, key, data, i);
				});
			});
		} else {
			this.indexes.set(index, new Map());
			this.forEach((data, key) => {
				setIndex(this.index, this.indexes, this.delimiter, key, data, index);
			});
		}

		return this;
	}

	request (input, config = {}) {
		let defer = deferred(),
			cfg = merge(this.config, config);

		cfg.method = cfg.method.toUpperCase();

		fetch(input, cfg).then(function (res) {
			let status = res.status,
				headers;

			if (res.headers._headers) {
				headers = {};
				Object.keys(res.headers._headers).forEach(function (i) {
					headers[i] = res.headers._headers[i].join(", ");
				});
			} else {
				headers = toObjekt(res.headers);
			}

			res[res.headers.get("content-type").indexOf("application/json") > -1 ? "json" : "text"]().then(function (arg) {
				defer[status < 200 || status >= 400 ? "reject" : "resolve"](tuple(arg, status, headers));
			}, function (e) {
				defer.reject(tuple(e.message, status, headers));
			});
		}, function (e) {
			defer.reject(tuple(e.message, 0, {}));
		});

		return defer.promise;
	}

	search (value, index) {
		let indexes = index ? (this.index.indexOf(index) > -1 ? [index] : []) : this.index,
			result = [],
			fn = typeof value === "function",
			rgex = value instanceof RegExp,
			seen = new Set();

		if (value) {
			indexes.forEach(i => {
				let idx = this.indexes.get(i);

				if (idx) {
					idx.forEach((lset, lkey) => {
						if ((fn && value(lkey)) || (rgex && value.test(lkey)) || (lkey === value)) {
							lset.forEach(key => {
								if (!seen.has(key)) {
									seen.add(key);
									result.push(this.get(key));
								}
							});
						}
					});
				}
			});
		}

		return tuple.apply(tuple, result);
	}

	set (key, data, batch = false, override = false) {
		let defer = deferred(),
			method = "post",
			ldata = clone(data),
			lkey = key;

		let next = () => {
			let ogdata;

			if (method === "post") {
				this.registry[this.total] = lkey;
				++this.total;

				if (this.versioning) {
					this.versions.set(lkey, new Set());
				}
			} else {
				ogdata = this.data.get(lkey);

				if (this.versioning) {
					this.versions.get(lkey).add(tuple(ogdata));
				}

				delIndex(this.index, this.indexes, this.delimiter, lkey, ogdata);
			}

			this.data.set(lkey, ldata);
			setIndex(this.index, this.indexes, this.delimiter, lkey, ldata);
			defer.resolve(this.get(lkey));
		};

		if (lkey === undefined || lkey === null) {
			lkey = this.key ? (ldata[this.key] || uuid()) : uuid() || uuid();
		} else if (this.data.has(lkey)) {
			method = "put";

			if (!override) {
				ldata = merge(this.get(lkey)[1], ldata);
			}
		}

		if (!batch && this.uri) {
			if (this.patch) {
				this.request(concatURI(this.uri, null), {
					method: "patch",
					body: JSON.stringify([{op: method === "post" ? "add" : "replace", path: "/" + lkey, value: ldata}])
				}).then(next, function (e) {
					defer.reject(e[0] || e);
				});
			} else {
				this.request(concatURI(this.uri, lkey), {
					method: method,
					body: JSON.stringify(ldata)
				}).then(next, function (e) {
					defer.reject(e[0] || e);
				});
			}
		} else {
			next();
		}

		return defer.promise;
	}

	setUri (uri, clear = false) {
		let defer = deferred();

		this.uri = uri;

		if (this.uri) {
			this.sync(clear).then(function (arg) {
				defer.resolve(arg);
			}, function (e) {
				defer.reject(e);
			});
		} else {
			defer.resolve([]);
		}

		return defer.promise;
	}

	sort (fn) {
		return this.toArray().sort(fn);
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

	sync (clear = false) {
		let defer = deferred();

		this.request(this.uri).then(arg => {
			let data = arg[0];

			this.patch = (arg[2].Allow || arg[2].allow || "").indexOf("PATCH") > -1;

			if (this.source) {
				try {
					this.source.split(".").forEach(function (i) {
						data = data[i];
					});
				} catch (e) {
					return defer.reject(e);
				}
			}

			if (clear) {
				this.clear();
			}

			this.batch(data, "set").then(function (records) {
				defer.resolve(records);
			}, function (e) {
				defer.reject(e);
			});
		}, function (e) {
			defer.reject(e[0] || e);
		});

		return defer.promise;
	}

	toArray () {
		let result = [];

		this.forEach(function (value) {
			result.push(value);
		});

		return result;
	}

	toObject () {
		return toObjekt(this);
	}

	values () {
		return this.data.values();
	}
}
