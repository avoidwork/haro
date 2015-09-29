/**
 * Harō is a modern immutable DataStore using Maps, Sets, Promises, & Tuples
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2015
 * @license BSD-3-Clause
 * @link http://haro.rocks
 * @version 1.7.2
 */
"use strict";

(function (global) {
const server = typeof process !== "undefined" && typeof process.nextTick === "function";
const Promise = !server ? global.Promise : require("es6-promise").Promise;
const Map = !server ? global.Map : require("es6-map");
const Set = !server ? global.Set : require("es6-set");
const fetch = !server ? global.fetch : require("node-fetch");
const deferred = !server ? global.deferred : require("tiny-defer");
const tuple = !server ? global.tuple : require("tiny-tuple");
const Blob = !server ? global.Blob : require("Blob");
const Worker = !server ? global.Worker : require("webworker-threads").Worker;
const r = [8, 9, "a", "b"];
const regex = {
	querystring: /\?.*/,
	endslash: /\/$/
};
const webWorker = typeof Blob !== "undefined" && typeof Worker !== "undefined";
const webWorkerError = "Web Worker not supported";
let adapter = {};

function cast (input) {
	let result;

	switch (true) {
		case input instanceof Map:
			result = {};
			input.forEach((value, key) => {
				result[key] = cast(value);
			});
			break;
		case input instanceof Set:
			result = [];
			input.forEach(i => {
				result.push(cast(i));
			});
			break;
		case input instanceof Array:
			result = new Set();
			input.forEach(i => {
				result.add(cast(i));
			});
			break;
		case input instanceof Object:
			result = new Map();
			Object.keys(input).forEach(i => {
				result.set(i, cast(input[i]));
			});
			break;
		default:
			result = input;
	}

	return result;
}

function blob (arg) {
	let obj;

	try {
		obj = new Blob([arg], {type: "application/javascript"});
	} catch (e) {
		if (!global.BlobBuilder) {
			global.BlobBuilder = global.MSBlobBuilder || global.WebKitBlobBuilder || global.MozBlobBuilder;
		}

		obj = new global.BlobBuilder().append(arg).getBlob();
	}

	return obj;
}

function clone (arg) {
	return JSON.parse(JSON.stringify(arg));
}

function concatURI (left, right) {
	return left.replace(regex.querystring, "").replace(regex.endslash, "") + (right ? "/" + right : "");
}

function keyIndex (key, data, delimiter, pattern) {
	let keys = key.split(delimiter).sort(),
		result;

	if (keys.length > 1) {
		result = keys.map(function (i) {
			return String(data[i]).replace(new RegExp(pattern, "g"), "").toLowerCase();
		}).join(delimiter);
	} else {
		result = data[key];
	}

	return result;
}

function delIndex (index, indexes, delimiter, key, data, pattern) {
	index.forEach(function (i) {
		let idx = indexes.get(i),
			value = keyIndex(i, data, delimiter, pattern),
			o;

		if (idx.has(value)) {
			o = idx.get(value);
			o.delete(key);

			if (o.size === 0) {
				idx.delete(value);
			}
		}
	});
}

function createIndexes (args, indexes, key, delimiter, pattern) {
	let result = new Map();

	indexes.forEach(function (i) {
		result.set(i, new Map());
	});

	args.forEach(function (i) {
		if (i[key] !== undefined) {
			setIndex(indexes, result, delimiter, i[key], i, undefined, pattern);
		}
	});

	return result;
}

function iterate (obj, fn) {
	if (obj instanceof Object) {
		Object.keys(obj).forEach(function (i) {
			fn.call(obj, obj[i], i);
		});
	} else {
		obj.forEach(fn);
	}
}

function merge (a, b) {
	let c = a !== undefined ? clone(a) : a,
		d = b !== undefined ? clone(b) : b;

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

function onmessage (ev) {
	let data = JSON.parse(ev.data),
		records = data.records,
		index = data.index,
		cmd = data.cmd,
		key = data.key,
		delimiter = data.delimiter,
		pattern = data.pattern,
		result;

	try {
		if (cmd === "index") {
			result = cast(createIndexes(records, index, key, delimiter, pattern));
		}
	} catch (e) {
		result = e.stack;
	}

	postMessage(JSON.stringify(result));

	if (server && typeof self !== "undefined") {
		self.close();
	}
}

function patch (ogdata = {}, data = {}, key = "", overwrite = false) {
	let result = [];

	if (overwrite) {
		iterate(ogdata, function (v, k) {
			if (k !== key && data[k] === undefined) {
				result.push({op: "remove", path: "/" + k});
			}
		});
	}

	iterate(data, function (v, k) {
		if (k !== key && ogdata[k] === undefined) {
			result.push({op: "add", path: "/" + k, value: v});
		} else if (JSON.stringify(ogdata[k]) !== JSON.stringify(v)) {
			result.push({op: "replace", path: "/" + k, value: v});
		}
	});

	return result;
}

function s () {
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

function setIndexValue (index, key, value) {
	if (!index.has(key)) {
		index.set(key, new Set());
	}

	index.get(key).add(value);
}

function setIndex (index, indexes, delimiter, key, data, indice, pattern) {
	if (!indice) {
		index.forEach(function (i) {
			setIndexValue(indexes.get(i), keyIndex(i, data, delimiter, pattern), key);
		});
	} else {
		setIndexValue(indexes.get(indice), keyIndex(indice, data, delimiter, pattern), key);
	}
}

function toObjekt (arg) {
	let result = {};

	arg.forEach(function (value, key) {
		result[key] = value;
	});

	return result;
}

function uuid () {
	return (s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s());
}

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
				}).then(function () {
					next();
				}, defer.reject);
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

		if (this.logging) {
			console.log("Cleared", this.id);
		}

		return this.reindex();
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
				} else if (index === (this.registry.length - 1)) {
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
						console.error("Error deleting", key, "from persistent storage:", (e.message || e.stack || e));
					}
				});
			}

			defer.resolve();
		};

		if (this.data.has(key)) {
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

		return defer.promise;
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

	has (key) {
		return this.data.has(key);
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
				console.error("Error loading", id, "from", type, "persistent storage:", (e.message || e.stack || e));
			}

			throw e;
		});
	}

	map (fn) {
		let result = [];

		this.forEach(function (value, key) {
			result.push(fn(value, key));
		});

		return tuple.apply(tuple, result);
	}

	offload (data, cmd = "index", index = this.index) {
		let defer = deferred(),
			obj;

		if (this.worker) {
			obj = this.useWorker(defer);

			if (obj) {
				obj.postMessage(JSON.stringify({
					cmd: cmd,
					index: index,
					records: data,
					key: this.key,
					delimiter: this.delimiter,
					pattern: this.pattern
				}));
			}
		} else {
			defer.reject(new Error(webWorkerError));
		}

		return defer.promise;
	}

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

	save (type = "mongo") {
		return this.cmd(type, "set").then(arg => {
			if (this.logging) {
				console.log("Saved", this.id, "to", type, "persistent storage");
			}

			return arg;
		}, e => {
			if (this.logging) {
				console.error("Error saving ", this.id, "to", type, "persistent storage:", (e.message || e.stack || e));
			}

			throw e;
		});
	}

	search (value, index) {
		let result = [],
			fn = typeof value === "function",
			rgex = value && typeof value.test === "function",
			seen = new Set(),
			lindex, indexes;

		if (value) {
			lindex = clone(index || this.index);

			if (lindex instanceof Array) {
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
							case rgex && value.test(lkey):
							case lkey === value:
								lset.forEach(key => {
									if (!seen.has(key)) {
										seen.add(key);
										result.push(this.get(key));
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

		return tuple.apply(tuple, result);
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
						this.source.split(".").forEach(function (i) {
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
						console.error("Error saving", lkey, "to persistent storage:", (e.message || e.stack || e));
					}
				});
			}
		};

		if (lkey === undefined || lkey === null) {
			lkey = null;
		} else if (this.data.has(lkey)) {
			method = "put";
			ogdata = this.data.get(lkey);

			if (!override) {
				ldata = merge(ogdata, ldata);
			}
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
						}).then(next, function (err) {
							defer.reject(err);
						});
					} else {
						defer.reject(e);
					}
				});
			} else {
				this.request(luri, {
					method: method,
					body: JSON.stringify(ldata)
				}).then(next, function (e) {
					defer.reject(e);
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
			this.sync(clear).then(defer.resolve, defer.reject);
		} else {
			defer.resolve([]);
		}

		return defer.promise;
	}

	sort (fn, frozen = true) {
		let result;

		if (frozen) {
			result = Object.freeze(this.toArray(null, false).sort(fn).map(function (i) {
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
			Promise.all(deferreds).then(function () {
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

			this.batch(data, "set").then(defer.resolve, defer.reject);
		}, function (e) {
			defer.reject(e[0] || e);
		});

		return defer.promise;
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
			func = function (arg) {
				return arg;
			};
		} else {
			func = function (arg) {
				return clone(arg);
			};
		}

		return func(!data ? toObjekt(this) : data.reduce(function (a, b) {
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
				console.error("Error unloading", id, "from", type, "persistent storage:", (e.message || e.stack || e));
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
			obj.onerror = function (err) {
				defer.reject(err);
				obj.terminate();
			};

			obj.onmessage = function (ev) {
				defer.resolve(JSON.parse(ev.data));
				obj.terminate();
			};
		} else {
			defer.reject(new Error(webWorkerError));
		}

		return obj;
	}
}

function factory (data = null, config = {}, indexes = []) {
	let obj = new Haro(data, config, indexes),
		functions;

	if (webWorker) {
		functions = [
			createIndexes.toString(),
			keyIndex.toString(),
			setIndexValue.toString(),
			setIndex.toString(),
			cast.toString(),
			(!server ? "" : "this.") + "onmessage = " + onmessage.toString() + ";"
		];

		try {
			obj.worker = !server ? global.URL.createObjectURL(blob(functions.join("\n"))) : new Function(functions.join("\n"));
		} catch (e) {
			obj.worker = null;
		}
	}

	return obj;
}

factory.transform = cast;
factory.version = "1.7.2";

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
