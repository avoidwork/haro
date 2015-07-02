/**
 * Harō is a modern immutable DataStore using Maps, Sets, Promises, & Tuples
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2015
 * @license BSD-3-Clause
 * @link http://haro.rocks
 * @version 1.2.1
 */
"use strict";

(function (global) {
const Promise = global.Promise || require("es6-promise").Promise;
const Map = global.Map || require("es6-map");
const Set = global.Set || require("es6-set");
const fetch = global.fetch || require("node-fetch");
const tuple = global.tuple || require("tiny-tuple");
const regex = {
	querystring: /\?.*/,
	endslash: /\/$/
};

function clone (arg) {
	return JSON.parse(JSON.stringify(arg));
}

function concatURI (left, right) {
	return left.replace(regex.querystring, "").replace(regex.endslash, "") + "/" + right;
}

function deferred () {
	let promise, resolver, rejecter;

	promise = new Promise(function (resolve, reject) {
		resolver = resolve;
		rejecter = reject;
	});

	return {resolve: resolver, reject: rejecter, promise: promise};
}

function keyIndex (key, data, delimiter) {
	let keys = key.split(delimiter).sort(),
		result;

	if (keys.length > 1) {
		result = keys.map(function (i) {
			return String(data[i]);
		}).join(delimiter);
	} else {
		result = data[key];
	}

	return result;
}

function merge (a, b) {
	let c = clone(a),
		d = clone(b);

	if ((c instanceof Object) && (d instanceof Object)) {
		Object.keys(d).forEach(function (i) {
			if ((c[i] instanceof Object) && (d[i] instanceof Object)) {
				c[i] = merge(c[i], d[i]);
			} else if ((c[i] instanceof Array) && (d[i] instanceof Array)) {
				c[i] = c[i].concat(d[i]);
			} else {
				c[i] = d[i];
			}
		});
	} else if ((c instanceof Array) && (d instanceof Array)) {
		c = c.concat(d);
	} else {
		c = d;
	}

	return c;
}

const r = [8, 9, "a", "b"];

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
			fn;

		if (type === "del") {
			fn = i => {
				return this.del(i, true);
			};
		} else {
			fn = i => {
				return this.set(null, i, true, true);
			};
		}

		Promise.all(args.map(fn)).then(function (arg) {
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
				} else if (index === (this.registry.length - 1)) {
					this.registry.pop();
				} else {
					this.registry.splice(index, 1);
				}

				this.delIndex(key, this.data.get(key));
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
				this.request(concatURI(this.uri, key), {method: "delete"}).then(next, function (e) {
					defer.reject(e[0] || e);
				});
			} else {
				next();
			}
		} else {
			defer.reject(new Error("Record not found"));
		}

		return defer.promise;
	}

	delIndex (key, data) {
		this.index.forEach(i => {
			let idx = this.indexes.get(i),
				value = keyIndex(i, data, this.delimiter);

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
			result.push(fn(value, key));
		});

		return tuple.apply(tuple, result);
	}

	reindex (index) {
		if (!index) {
			this.indexes.clear();
			this.index.forEach(i => {
				this.indexes.set(i, new Map());
				this.forEach((data, key) => {
					this.setIndex(key, data, i);
				});
			});
		} else {
			this.indexes.set(index, new Map());
			this.forEach((data, key) => {
				this.setIndex(key, data, index);
			});
		}

		return this;
	}

	request (input, config={}) {
		let defer = deferred(),
			cfg = merge(this.config, config);

		fetch(input, cfg).then(function (res) {
			let status = res.status;

			res[res.headers.get("content-type").indexOf("application/json") > -1 ? "json" : "text"]().then(function (arg) {
				defer[status < 200 || status >= 400 ? "reject" : "resolve"](tuple(arg, status));
			}, function (e) {
				defer.reject(tuple(e.message, status));
			});
		}, function (e) {
			defer.reject(tuple(e.message, 0));
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

	set (key, data, batch=false, override=false) {
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

				this.delIndex(lkey, ogdata);
			}

			this.data.set(lkey, ldata);
			this.setIndex(lkey, ldata);
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
			this.request(concatURI(this.uri, lkey), {method: method, body: JSON.stringify(ldata)}).then(next, function (e) {
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
				this.setIndexValue(this.indexes.get(i), keyIndex(i, data, this.delimiter), key);
			});
		} else {
			this.setIndexValue(this.indexes.get(index), keyIndex(index, data, this.delimiter), key);
		}

		return this;
	}

	setIndexValue (index, key, value) {
		if (!index.has(key)) {
			index.set(key, new Set());
		}

		index.get(key).add(value);
	}

	setUri (uri, clear=false) {
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

	sync (clear=false) {
		let defer = deferred();

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

	values () {
		return this.data.values();
	}
}

function factory (data=null, config={}, indexes=[]) {
	return new Haro(data, config, indexes);
}

factory.version = "1.2.1";

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
}(typeof global !== "undefined" ? global : window));
