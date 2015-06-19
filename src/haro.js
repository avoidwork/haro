class Haro {
	constructor (data, config={}, indexes=[]) {
		this.data = new Map();
		this.config = {
			method: "get",
			credentials: false,
			headers: {
				accept: "application/json",
				"content-type": "application/json"
			}
		};
		this.index = clone(indexes);
		this.indexes = new Map();
		this.registry = [];
		this.key = "";
		this.source = "";
		this.total = 0;
		this.uri = "";
		this.versions = new Map();

		this.index.forEach(i => {
			this.indexes.set(i, new Map());
		});

		Object.keys(config).forEach(i => {
			this[i] = merge(this[i], config[i]);
		});

		if (data) {
			this.batch(data, "set");
		}
	}

	batch (args, type) {
		let defer = deferred(),
			promises = [];

		if (type === "del") {
			args.forEach(i => {
				promises.push(this.del(i, true));
			});
		} else {
			args.forEach(i => {
				promises.push(this.set(null, i, true));
			});
		}

		Promise.all(promises).then(function (arg) {
			defer.resolve(arg);
		}, function (e) {
			defer.reject(e);
		});

		return defer.promise;
	}

	clear () {
		this.total = 0;
		this.registry = [];
		this.data.clear();
		this.indexes.clear();
		this.versions.clear();

		this.index.forEach(i => {
			this.indexes.set(i, new Map());
		});

		return this;
	}

	del (key, batch = false) {
		let defer = deferred();

		let next = () => {
			let index = this.registry.indexOf(key);

			if (index > -1) {
				if (index === 0) {
					this.registry.shift();
				} else if (index === ( this.registry.length - 1 )) {
					this.registry.pop();
				} else {
					this.registry.splice(index, 1);
				}

				this.removeIndex(key);
				this.data.delete(key);
				this.versions.delete(key);
				--this.total;
			}

			defer.resolve();
		};

		if (this.data.has(key)) {
			if (!batch && this.uri) {
				this.request(this.uri.replace(/\?.*/, "") + "/" + key, {method: "delete"}).then(next, function (e) {
					defer.reject(e[0] || e);
				});
			} else {
				next()
			}
		} else {
			defer.reject(new Error("Record not found"));
		}

		return defer.promise;
	}

	entries () {
		return this.data.entries();
	}

	filter (fn) {
		let result = [];

		this.forEach(function (value, key) {
			if (fn(clone(value), clone(key)) === true) {
				result.push(tuple(key, value));
			}
		});

		return tuple.apply(tuple, result);
	}

	forEach (fn, ctx) {
		return this.data.forEach(fn, ctx);
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

	limit (start = 0, offset = 0) {
		let i = start,
			nth = start + offset,
			list = [],
			k;

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
			result.push(tuple(key, fn(clone(value), clone(key))));
		});

		return tuple.apply(tuple, result);
	}

	request (input, config = {}) {
		let cfg = merge(this.config, config);

		return fetch(input, cfg).then(function (res) {
			return res[res.headers.get("content-type").indexOf("application/json") > -1 ? "json" : "text"]().then(function (arg) {
				if (res.status === 0 || res.status >= 400) {
					throw tuple(arg, res.status);
				}

				return tuple(arg, res.status);
			}, function (e) {
				throw tuple(e.message, res.status);
			});
		}, function (e) {
			throw tuple(e.message, 0);
		});
	}

	set (key, data, batch=false, override=false) {
		let defer = deferred(),
			method = "post",
			ldata = clone(data);

		let next = () => {
			if (method === "post") {
				++this.total;
				this.registry.push(key);
				this.versions.set(key, new Set());
			} else {
				this.versions.get(key).add(tuple(this.data.get(key)));
			}

			this.data.set(key, ldata);
			// @todo deal with updates by removing existing set values - somehow
			this.setIndex(key, ldata);
			defer.resolve(this.get(key));
		};

		if (key === undefined || key === null) {
			key = this.key ? ldata[this.key] : uuid() || uuid();
		} else if (this.data.has(key)) {
			method = "put";

			if (!override) {
				ldata = merge(this.get(key)[1], ldata);
			}
		}

		if (!batch && this.uri) {
			this.request(this.uri.replace(/\?.*/, "") + "/" + key, {method: method, body: JSON.stringify(ldata)}).then(next, function (e) {
				defer.reject(e[0] || e);
			});
		} else {
			next();
		}

		return defer.promise;
	}

	setIndex (key, data) {
		let delimiter = "|";

		this.index.forEach(i => {
			let keys = i.split(delimiter),
				values = "",
				index = this.indexes.get(i);

			keys.forEach(function (k, kdx) {
				values += (kdx > 0 ? delimiter : "") + data[k];
			});

			if (!index.has(values)) {
				index.set(values, new Set());
			}

			index.get(values).add(key);
		});

		return this;
	}

	setUri (uri) {
		let defer = deferred();

		this.uri = uri;

		if (this.uri) {
			this.request(this.uri).then(arg => {
				let data = arg[0];

				if (this.source) {
					try {
						this.source.split(".").forEach(function (i) {
							data = data[i];
						});
					} catch (e) {
						return defer.reject(e);
					}
				}

				this.batch(data, "set").then(function (records) {
					defer.resolve(records);
				}, function (e) {
					defer.reject(e);
				});
			}, function (e) {
				defer.reject(e[0] || e);
			})
		} else {
			defer.resolve();
		}

		return defer.promise;
	}

	values () {
		return this.data.values();
	}
}
