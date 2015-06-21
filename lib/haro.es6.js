/**
 * Harō is modern DataStore that can be wired to an API
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2015 
 * @license BSD-3-Clause
 * @link http://haro.rocks
 * @version 1.1.0
 */
(function (global) {
const Promise = global.Promise || require("es6-promise").Promise;
const Map = global.Map || require("es6-map");
const Set = global.Set || require("es6-set");
const fetch = global.fetch || require("node-fetch");
const tuple = global.tuple || require("tiny-tuple");

function clone (arg) {
	return JSON.parse(JSON.stringify(arg));
}

function deferred () {
	let promise, resolver, rejecter;

	promise = new Promise(function (resolve, reject) {
		resolver = resolve;
		rejecter = reject;
	});

	return {resolve: resolver, reject: rejecter, promise: promise};
}

function merge (a, b) {
	let c = clone(a),
		d = clone(b);

	Object.keys(d).forEach(function (i) {
		c[i] = d[i];
	});

	return c;
}

let r = [8, 9, "a", "b"];

function s () {
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

function uuid () {
	return (s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s());
}

class Haro {
	constructor (data, config={}) {
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
		this.registry = [];
		this.key = "";
		this.source = "";
		this.total = 0;
		this.uri = "";
		this.versions = new Map();

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

		return this.reindex();
	}

	del (key, batch=false) {
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

				this.delIndex(key, this.data.get(key));
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

	delIndex (key, data) {
		this.index.forEach(i => {
			let idx = this.indexes.get(i),
				value = this.keyIndex(i, data);

			if (idx.has(value)) {
				idx.get(value).delete(key);
			}
		});
	}

	entries () {
		return this.data.entries();
	}

	find (where) {
		let key = Object.keys(where).sort().join(this.delimiter),
			value = this.keyIndex(key, where),
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

	keyIndex (key, data) {
		return key.split(this.delimiter).sort().map(function (i) {
			return String(data[i]);
		}).join(this.delimiter);
	}

	keys () {
		return this.data.keys();
	}

	limit (start=0, offset=0) {
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

	reindex (index) {
		if (!index) {
			this.indexes.clear();
			this.index.forEach(i => {
				this.indexes.set(i, new Map());
			});
		} else {
			this.indexes.set(index, new Map());
		}

		this.forEach((data, key) => {
			this.setIndex(key, data, index);
		});

		return this;
	}

	request (input, config={}) {
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
			let ogdata;

			if (method === "post") {
				++this.total;
				this.registry.push(key);
				this.versions.set(key, new Set());
			} else {
				ogdata = this.data.get(key);
				this.versions.get(key).add(tuple(ogdata));
				this.delIndex(key, ogdata);
			}

			this.data.set(key, ldata);
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

	setIndex (key, data, index) {
		if (!index) {
			this.index.forEach(i => {
				this.setIndexValue(this.indexes.get(i), this.keyIndex(i, data), key);
			});
		} else {
			this.setIndexValue(this.indexes.get(index), this.keyIndex(index, data), key);
		}

		return this;
	}

	setIndexValue (index, key, value) {
		if (!index.has(key)) {
			index.set(key, new Set());
		}

		index.get(key).add(value);
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

	toArray () {
		let result = [];

		this.forEach(function (data) {
			result.push(clone(data));
		});

		return result;
	}

	values () {
		return this.data.values();
	}
}

function factory (data=null, config={}, indexes=[]) {
	return new Haro(data, config, indexes);
}

factory.version = "1.1.0";

// Node, AMD & window supported
if (typeof exports !== "undefined") {
	module.exports = factory;
} else if (typeof define === "function") {
	define(function () {
		return factory;
	});
} else {
	global.haro = factory;
}
} )
( typeof global !== "undefined" ? global : window );
