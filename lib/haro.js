/**
 * Harō is a modern immutable DataStore using Maps, Sets, Promises, & Tuples
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2015
 * @license BSD-3-Clause
 * @link http://haro.rocks
 * @version 1.7.0
 */
"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

(function (global) {
	var server = typeof process !== "undefined" && typeof process.nextTick === "function";
	var Promise = !server ? global.Promise : require("es6-promise").Promise;
	var Map = !server ? global.Map : require("es6-map");
	var Set = !server ? global.Set : require("es6-set");
	var fetch = !server ? global.fetch : require("node-fetch");
	var deferred = !server ? global.deferred : require("tiny-defer");
	var tuple = !server ? global.tuple : require("tiny-tuple");
	var r = [8, 9, "a", "b"];
	var regex = {
		querystring: /\?.*/,
		endslash: /\/$/
	};
	var webWorker = typeof Blob !== "undefined" && typeof Worker !== "undefined";
	var adapter = {};

	function _transform(input) {
		var result = undefined;

		switch (true) {
			case input instanceof Map:
				result = {};
				input.forEach(function (value, key) {
					result[key] = _transform(value);
				});
				break;
			case input instanceof Set:
				result = [];
				input.forEach(function (i) {
					result.push(_transform(i));
				});
				break;
			case input instanceof Array:
				result = new Set();
				input.forEach(function (i) {
					result.add(_transform(i));
				});
				break;
			case input instanceof Object:
				result = new Map();
				Object.keys(input).forEach(function (i) {
					result.set(i, _transform(input[i]));
				});
				break;
			default:
				result = input;
		}

		return result;
	}

	function blob(arg) {
		var obj = undefined;

		try {
			obj = new Blob([arg], { type: "application/javascript" });
		} catch (e) {
			if (!global.BlobBuilder) {
				global.BlobBuilder = global.MSBlobBuilder || global.WebKitBlobBuilder || global.MozBlobBuilder;
			}

			obj = new global.BlobBuilder().append(arg).getBlob();
		}

		return obj;
	}

	function clone(arg) {
		return JSON.parse(JSON.stringify(arg));
	}

	function concatURI(left, right) {
		return left.replace(regex.querystring, "").replace(regex.endslash, "") + (right ? "/" + right : "");
	}

	function keyIndex(key, data, delimiter, pattern) {
		var keys = key.split(delimiter).sort(),
		    result = undefined;

		if (keys.length > 1) {
			result = keys.map(function (i) {
				return String(data[i]).replace(new RegExp(pattern, "g"), "").toLowerCase();
			}).join(delimiter);
		} else {
			result = data[key];
		}

		return result;
	}

	function delIndex(index, indexes, delimiter, key, data, pattern) {
		index.forEach(function (i) {
			var idx = indexes.get(i),
			    value = keyIndex(i, data, delimiter, pattern),
			    o = undefined;

			if (idx.has(value)) {
				o = idx.get(value);
				o["delete"](key);

				if (o.size === 0) {
					idx["delete"](value);
				}
			}
		});
	}

	function createIndexes(args, indexes, key, delimiter, pattern) {
		var result = new Map();

		indexes.forEach(function (i) {
			result.add(i, new Map());
		});

		args.forEach(function (i) {
			if (i[key] !== undefined) {
				setIndex(indexes, result, delimiter, i[key], i, undefined, pattern);
			}
		});

		return _transform(result);
	}

	function iterate(obj, fn) {
		if (obj instanceof Object) {
			Object.keys(obj).forEach(function (i) {
				fn.call(obj, obj[i], i);
			});
		} else {
			obj.forEach(fn);
		}
	}

	function merge(a, b) {
		var c = a !== undefined ? clone(a) : a,
		    d = b !== undefined ? clone(b) : b;

		if (c instanceof Object && d instanceof Object) {
			Object.keys(d).forEach(function (i) {
				if (c[i] instanceof Object && d[i] instanceof Object) {
					c[i] = merge(c[i], d[i]);
				} else if (c[i] instanceof Array && d[i] instanceof Array) {
					c[i] = c[i].concat(d[i]);
				} else {
					c[i] = d[i];
				}
			});
		} else if (c instanceof Array && d instanceof Array) {
			c = c.concat(d);
		} else {
			c = d;
		}

		return c;
	}

	function patch() {
		var ogdata = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
		var data = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
		var key = arguments.length <= 2 || arguments[2] === undefined ? "" : arguments[2];
		var overwrite = arguments.length <= 3 || arguments[3] === undefined ? false : arguments[3];

		var result = [];

		if (overwrite) {
			iterate(ogdata, function (v, k) {
				if (k !== key && data[k] === undefined) {
					result.push({ op: "remove", path: "/" + k });
				}
			});
		}

		iterate(data, function (v, k) {
			if (k !== key && ogdata[k] === undefined) {
				result.push({ op: "add", path: "/" + k, value: v });
			} else if (JSON.stringify(ogdata[k]) !== JSON.stringify(v)) {
				result.push({ op: "replace", path: "/" + k, value: v });
			}
		});

		return result;
	}

	function s() {
		return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1);
	}

	function setIndexValue(index, key, value) {
		if (!index.has(key)) {
			index.set(key, new Set());
		}

		index.get(key).add(value);
	}

	function setIndex(index, indexes, delimiter, key, data, indice, pattern) {
		if (!indice) {
			index.forEach(function (i) {
				setIndexValue(indexes.get(i), keyIndex(i, data, delimiter, pattern), key);
			});
		} else {
			setIndexValue(indexes.get(indice), keyIndex(indice, data, delimiter, pattern), key);
		}
	}

	function toObjekt(arg) {
		var result = {};

		arg.forEach(function (value, key) {
			result[key] = value;
		});

		return result;
	}

	function uuid() {
		return s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s();
	}

	var Haro = (function () {
		function Haro(data) {
			var _this = this;

			var config = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

			_classCallCheck(this, Haro);

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
			this.worker = undefined;
			this.versions = new Map();
			this.versioning = true;

			Object.keys(config).forEach(function (i) {
				_this[i] = merge(_this[i], config[i]);
			});

			this.reindex();

			if (data) {
				this.batch(data, "set");
			}
		}

		_createClass(Haro, [{
			key: "batch",
			value: function batch(args, type) {
				var _this2 = this;

				var lload = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

				var defer = deferred(),
				    del = type === "del",
				    data = undefined,
				    fn = undefined,
				    hash = undefined;

				function next() {
					Promise.all(args.map(fn)).then(defer.resolve, defer.reject);
				}

				if (del) {
					fn = function (i) {
						return _this2.del(i, true);
					};
				} else {
					fn = function (i) {
						return _this2.set(null, i, true, true, lload);
					};
				}

				if (this.patch) {
					if (del) {
						data = patch(this.toArray().map(function (i) {
							return i[_this2.key];
						}), args, this.key, true);
					} else {
						data = [];
						hash = {};
						args.forEach(function (i) {
							var key = i[_this2.key];

							if (key) {
								hash[key] = i;
							} else {
								data.push({ op: "add", path: "/", value: i });
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
		}, {
			key: "clear",
			value: function clear() {
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
		}, {
			key: "cmd",
			value: function cmd(type) {
				var defer = deferred();

				if (!this.adapters[type] || !adapter[type]) {
					defer.reject(new Error(type + " not configured for persistent storage"));
				} else {
					for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
						args[_key - 1] = arguments[_key];
					}

					adapter[type].apply(this, [this].concat(args)).then(defer.resolve, defer.reject);
				}

				return defer.promise;
			}
		}, {
			key: "del",
			value: function del(key) {
				var _this3 = this;

				var batch = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

				var defer = deferred(),
				    next = undefined;

				next = function () {
					var index = _this3.registry.indexOf(key);

					if (index > -1) {
						if (index === 0) {
							_this3.registry.shift();
						} else if (index === _this3.registry.length - 1) {
							_this3.registry.pop();
						} else {
							_this3.registry.splice(index, 1);
						}

						delIndex(_this3.index, _this3.indexes, _this3.delimiter, key, _this3.data.get(key), _this3.pattern);
						_this3.data["delete"](key);
						--_this3.total;

						if (_this3.versioning) {
							_this3.versions["delete"](key);
						}

						_this3.storage("remove", key).then(function (success) {
							if (success && _this3.logging) {
								console.log("Deleted", key, "from persistent storage");
							}
						}, function (e) {
							if (_this3.logging) {
								console.error("Error deleting", key, "from persistent storage:", e.message || e.stack || e);
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
								body: JSON.stringify([{ op: "remove", path: "/" + key }])
							}).then(next, function (e) {
								if (e[1] === 405) {
									_this3.patch = false;
									_this3.request(concatURI(_this3.uri, key), {
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
		}, {
			key: "dump",
			value: function dump() {
				var type = arguments.length <= 0 || arguments[0] === undefined ? "records" : arguments[0];

				var result = undefined;

				if (type === "records") {
					result = this.toArray(null, false);
				} else {
					result = this.transform(this.indexes);
				}

				return result;
			}
		}, {
			key: "entries",
			value: function entries() {
				return this.data.entries();
			}
		}, {
			key: "find",
			value: function find(where) {
				var _this4 = this;

				var key = Object.keys(where).sort().join(this.delimiter),
				    value = keyIndex(key, where, this.delimiter),
				    result = [];

				if (this.indexes.has(key)) {
					(this.indexes.get(key).get(value) || new Set()).forEach(function (i) {
						result.push(_this4.get(i));
					});
				}

				return tuple.apply(tuple, result);
			}
		}, {
			key: "filter",
			value: function filter(fn) {
				var result = [];

				this.forEach(function (value, key) {
					if (fn(value, key) === true) {
						result.push(tuple(key, value));
					}
				});

				return tuple.apply(tuple, result);
			}
		}, {
			key: "forEach",
			value: function forEach(fn, ctx) {
				this.data.forEach(function (value, key) {
					fn(clone(value), clone(key));
				}, ctx);

				return this;
			}
		}, {
			key: "get",
			value: function get(key) {
				var output = undefined;

				if (this.data.has(key)) {
					output = tuple(key, this.data.get(key));
				}

				return output;
			}
		}, {
			key: "has",
			value: function has(key) {
				return this.data.has(key);
			}
		}, {
			key: "keys",
			value: function keys() {
				return this.data.keys();
			}
		}, {
			key: "limit",
			value: function limit(max) {
				var offset = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

				var lmax = max,
				    loffset = offset,
				    list = [],
				    i = undefined,
				    k = undefined,
				    nth = undefined;

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
		}, {
			key: "load",
			value: function load() {
				var _this5 = this;

				var type = arguments.length <= 0 || arguments[0] === undefined ? "mongo" : arguments[0];
				var key = arguments.length <= 1 || arguments[1] === undefined ? undefined : arguments[1];

				var batch = key === undefined,
				    id = !batch ? key : this.id;

				if (batch) {
					this.clear();
				}

				return this.cmd(type, "get", key).then(function (arg) {
					if (_this5.logging) {
						console.log("Loaded", id, "from", type, "persistent storage");
					}

					return batch ? _this5.batch(arg, "set", true) : _this5.set(key, arg, true, true, true);
				}, function (e) {
					if (_this5.logging) {
						console.error("Error loading", id, "from", type, "persistent storage:", e.message || e.stack || e);
					}

					throw e;
				});
			}
		}, {
			key: "map",
			value: function map(fn) {
				var result = [];

				this.forEach(function (value, key) {
					result.push(fn(value, key));
				});

				return tuple.apply(tuple, result);
			}
		}, {
			key: "override",
			value: function override(data) {
				var _this6 = this;

				var type = arguments.length <= 1 || arguments[1] === undefined ? "records" : arguments[1];
				var fn = arguments.length <= 2 || arguments[2] === undefined ? undefined : arguments[2];

				var defer = deferred();

				if (type === "indexes") {
					this.indexes = this.transform(data, fn);
					defer.resolve(true);
				} else if (type === "records") {
					this.data = new Map();
					this.registry = [];
					data.forEach(function (datum) {
						var key = datum[_this6.key] || uuid();

						_this6.data.set(key, datum);
						_this6.registry.push(key);
					});
					this.total = this.data.size;
					defer.resolve(true);
				} else {
					defer.reject(new Error("Invalid type"));
				}

				return defer.promise;
			}
		}, {
			key: "register",
			value: function register(key, fn) {
				adapter[key] = fn;
			}
		}, {
			key: "reindex",
			value: function reindex(index) {
				var _this7 = this;

				if (!index) {
					this.indexes.clear();
					this.index.forEach(function (i) {
						_this7.indexes.set(i, new Map());
					});
					this.forEach(function (data, key) {
						_this7.index.forEach(function (i) {
							setIndex(_this7.index, _this7.indexes, _this7.delimiter, key, data, i, _this7.pattern);
						});
					});
				} else {
					this.indexes.set(index, new Map());
					this.forEach(function (data, key) {
						setIndex(_this7.index, _this7.indexes, _this7.delimiter, key, data, index, _this7.pattern);
					});
				}

				return this;
			}
		}, {
			key: "request",
			value: function request(input) {
				var config = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

				var defer = deferred(),
				    cfg = merge(this.config, config);

				cfg.method = cfg.method.toUpperCase();

				fetch(input, cfg).then(function (res) {
					var status = res.status,
					    headers = undefined;

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
		}, {
			key: "save",
			value: function save() {
				var _this8 = this;

				var type = arguments.length <= 0 || arguments[0] === undefined ? "mongo" : arguments[0];

				return this.cmd(type, "set").then(function (arg) {
					if (_this8.logging) {
						console.log("Saved", _this8.id, "to", type, "persistent storage");
					}

					return arg;
				}, function (e) {
					if (_this8.logging) {
						console.error("Error saving ", _this8.id, "to", type, "persistent storage:", e.message || e.stack || e);
					}

					throw e;
				});
			}
		}, {
			key: "search",
			value: function search(value, index) {
				var _this9 = this;

				var result = [],
				    fn = typeof value === "function",
				    rgex = value && typeof value.test === "function",
				    seen = new Set(),
				    lindex = undefined,
				    indexes = undefined;

				if (value) {
					lindex = clone(index || this.index);

					if (lindex instanceof Array) {
						indexes = lindex;
					} else if (typeof lindex === "string") {
						indexes = [lindex];
					}

					indexes.forEach(function (i) {
						var idx = _this9.indexes.get(i);

						if (idx) {
							idx.forEach(function (lset, lkey) {
								switch (true) {
									case fn && value(lkey, i):
									case rgex && value.test(lkey):
									case lkey === value:
										lset.forEach(function (key) {
											if (!seen.has(key)) {
												seen.add(key);
												result.push(_this9.get(key));
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
		}, {
			key: "set",
			value: function set(key, data) {
				var batch = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

				var _this10 = this;

				var override = arguments.length <= 3 || arguments[3] === undefined ? false : arguments[3];
				var lload = arguments.length <= 4 || arguments[4] === undefined ? false : arguments[4];

				var defer = deferred(),
				    method = "post",
				    ldata = clone(data),
				    lkey = key,
				    body = undefined,
				    ogdata = undefined,
				    luri = undefined;

				var next = function next(arg) {
					var xdata = arg ? arg[0] : {};

					if (lkey === null) {
						if (_this10.key) {
							if (_this10.source) {
								_this10.source.split(".").forEach(function (i) {
									xdata = xdata[i] || {};
								});
							}

							lkey = xdata[_this10.key] || ldata[_this10.key] || uuid();
						} else {
							lkey = uuid();
						}
					}

					if (method === "post") {
						_this10.registry[_this10.total] = lkey;
						++_this10.total;

						if (_this10.versioning) {
							_this10.versions.set(lkey, new Set());
						}
					} else {
						if (_this10.versioning) {
							_this10.versions.get(lkey).add(tuple(ogdata));
						}

						delIndex(_this10.index, _this10.indexes, _this10.delimiter, lkey, ogdata, _this10.pattern);
					}

					_this10.data.set(lkey, ldata);
					setIndex(_this10.index, _this10.indexes, _this10.delimiter, lkey, ldata, null, _this10.pattern);
					defer.resolve(_this10.get(lkey));

					if (!lload) {
						_this10.storage("set", lkey, ldata).then(function (success) {
							if (success && _this10.logging) {
								console.log("Saved", lkey, "to persistent storage");
							}
						}, function (e) {
							if (_this10.logging) {
								console.error("Error saving", lkey, "to persistent storage:", e.message || e.stack || e);
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
							body = [{ op: "add", path: "/", value: ldata }];
						} else if (override) {
							body = [{ op: "replace", path: "/", value: ldata }];
						} else {
							body = patch(ogdata, ldata, this.key);
						}

						this.request(luri, {
							method: "patch",
							body: JSON.stringify(body)
						}).then(next, function (e) {
							if (e[1] === 405) {
								_this10.patch = false;
								_this10.request(luri, {
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
		}, {
			key: "setUri",
			value: function setUri(uri) {
				var clear = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

				var defer = deferred();

				this.uri = uri;

				if (this.uri) {
					this.sync(clear).then(defer.resolve, defer.reject);
				} else {
					defer.resolve([]);
				}

				return defer.promise;
			}
		}, {
			key: "sort",
			value: function sort(fn) {
				var frozen = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];

				var result = undefined;

				if (frozen) {
					result = Object.freeze(this.toArray(null, false).sort(fn).map(function (i) {
						return Object.freeze(i);
					}));
				} else {
					result = this.toArray(null, false).sort(fn);
				}

				return result;
			}
		}, {
			key: "sortBy",
			value: function sortBy(index) {
				var _this11 = this;

				var result = [],
				    keys = [],
				    lindex = undefined;

				if (!this.indexes.has(index)) {
					this.index.push(index);
					this.reindex(index);
				}

				lindex = this.indexes.get(index);
				lindex.forEach(function (idx, key) {
					keys.push(key);
				});

				keys.sort().forEach(function (i) {
					lindex.get(i).forEach(function (key) {
						result.push(_this11.get(key));
					});
				});

				return tuple.apply(tuple, result);
			}
		}, {
			key: "storage",
			value: function storage() {
				var _this12 = this;

				for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
					args[_key2] = arguments[_key2];
				}

				var defer = deferred(),
				    deferreds = [];

				Object.keys(this.adapters).forEach(function (i) {
					deferreds.push(_this12.cmd.apply(_this12, [i].concat(args)));
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
		}, {
			key: "sync",
			value: function sync() {
				var _this13 = this;

				var clear = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

				var defer = deferred();

				this.request(this.uri).then(function (arg) {
					var data = arg[0];

					_this13.patch = (arg[2].Allow || arg[2].allow || "").indexOf("PATCH") > -1;

					if (_this13.source) {
						try {
							_this13.source.split(".").forEach(function (i) {
								data = data[i];
							});
						} catch (e) {
							return defer.reject(e);
						}
					}

					if (clear) {
						_this13.clear();
					}

					_this13.batch(data, "set").then(defer.resolve, defer.reject);
				}, function (e) {
					defer.reject(e[0] || e);
				});

				return defer.promise;
			}
		}, {
			key: "toArray",
			value: function toArray(data) {
				var frozen = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];

				var key = this.key,
				    fn = undefined,
				    result = undefined;

				if (data) {
					fn = (function () {
						if (key) {
							return function (a, b) {
								var obj = clone(b[1]);

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
					fn = (function () {
						if (key) {
							return function (val, id) {
								var obj = clone(val);

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
		}, {
			key: "toObject",
			value: function toObject(data) {
				var frozen = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];

				var func = undefined;

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
		}, {
			key: "transform",
			value: function transform(input, fn) {
				return typeof fn === "function" ? fn(input) : _transform(input);
			}
		}, {
			key: "unload",
			value: function unload() {
				var _this14 = this;

				var type = arguments.length <= 0 || arguments[0] === undefined ? "mongo" : arguments[0];
				var key = arguments.length <= 1 || arguments[1] === undefined ? undefined : arguments[1];

				var id = key !== undefined ? key : this.id;

				return this.cmd(type, "remove", key).then(function (arg) {
					if (_this14.logging) {
						console.log("Unloaded", id, "from", type, "persistent storage");
					}

					return arg;
				}, function (e) {
					if (_this14.logging) {
						console.error("Error unloading", id, "from", type, "persistent storage:", e.message || e.stack || e);
					}

					throw e;
				});
			}
		}, {
			key: "unregister",
			value: function unregister(key) {
				delete adapter[key];
			}
		}, {
			key: "values",
			value: function values() {
				return this.data.values();
			}
		}]);

		return Haro;
	})();

	function factory() {
		var data = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
		var config = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
		var indexes = arguments.length <= 2 || arguments[2] === undefined ? [] : arguments[2];

		var obj = new Haro(data, config, indexes),
		    functions = undefined;

		if (webWorker) {
			functions = [clone.toString(), createIndexes.toString(), keyIndex.toString(), iterate.toString(), merge.toString(), setIndexValue.toString(), setIndex.toString(), _transform.toString()];

			try {
				obj.worker = global.URL.createObjectURL(blob(functions.join("\n")));
			} catch (e) {
				obj.worker = null;
			}
		}

		return obj;
	}

	factory.transform = _transform;
	factory.version = "1.7.0";

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
})(typeof global !== "undefined" ? global : window);
