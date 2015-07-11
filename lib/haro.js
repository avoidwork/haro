/**
 * Harō is a modern immutable DataStore using Maps, Sets, Promises, & Tuples
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2015
 * @license BSD-3-Clause
 * @link http://haro.rocks
 * @version 1.4.8
 */
"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

(function (global) {
	var Promise = global.Promise || require("es6-promise").Promise;
	var Map = global.Map || require("es6-map");
	var Set = global.Set || require("es6-set");
	var fetch = global.fetch || require("node-fetch");
	var tuple = global.tuple || require("tiny-tuple");
	var r = [8, 9, "a", "b"];
	var regex = {
		querystring: /\?.*/,
		endslash: /\/$/
	};
	var adapter = {};

	function clone(arg) {
		return JSON.parse(JSON.stringify(arg));
	}

	function concatURI(left, right) {
		return left.replace(regex.querystring, "").replace(regex.endslash, "") + (right ? "/" + right : "");
	}

	function deferred() {
		var promise = undefined,
		    resolver = undefined,
		    rejecter = undefined;

		promise = new Promise(function (resolve, reject) {
			resolver = resolve;
			rejecter = reject;
		});

		return { resolve: resolver, reject: rejecter, promise: promise };
	}

	function keyIndex(key, data, delimiter) {
		var keys = key.split(delimiter).sort(),
		    result = undefined;

		if (keys.length > 1) {
			result = keys.map(function (i) {
				return String(data[i]).replace(/\.|-|\s*|\t*/g, "").toLowerCase();
			}).join(delimiter);
		} else {
			result = data[key];
		}

		return result;
	}

	function delIndex(index, indexes, delimiter, key, data) {
		index.forEach(function (i) {
			var idx = indexes.get(i),
			    value = keyIndex(i, data, delimiter),
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
		var c = clone(a),
		    d = clone(b);

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
		var ogdata = arguments[0] === undefined ? {} : arguments[0];
		var data = arguments[1] === undefined ? {} : arguments[1];
		var key = arguments[2] === undefined ? "" : arguments[2];
		var overwrite = arguments[3] === undefined ? false : arguments[3];

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

	function setIndex(index, indexes, delimiter, key, data, indice) {
		if (!indice) {
			index.forEach(function (i) {
				setIndexValue(indexes.get(i), keyIndex(i, data, delimiter), key);
			});
		} else {
			setIndexValue(indexes.get(indice), keyIndex(indice, data, delimiter), key);
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

			var config = arguments[1] === undefined ? {} : arguments[1];

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
			this.registry = [];
			this.source = "";
			this.total = 0;
			this.uri = "";
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

				var defer = deferred(),
				    del = type === "del",
				    data = undefined,
				    fn = undefined,
				    hash = undefined;

				function next() {
					Promise.all(args.map(fn)).then(function (arg) {
						defer.resolve(arg);
					}, function (e) {
						defer.reject(e);
					});
				}

				if (del) {
					fn = function (i) {
						return _this2.del(i, true);
					};
				} else {
					fn = function (i) {
						return _this2.set(null, i, true, true);
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

					adapter[type].apply(this, [this].concat(args)).then(function (arg) {
						defer.resolve(arg);
					}, function (e) {
						defer.reject(e);
					});
				}

				return defer.promise;
			}
		}, {
			key: "del",
			value: function del(key) {
				var _this3 = this;

				var batch = arguments[1] === undefined ? false : arguments[1];

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

						delIndex(_this3.index, _this3.indexes, _this3.delimiter, key, _this3.data.get(key));
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
									}).then(next, function (err) {
										defer.reject(err);
									});
								} else {
									defer.reject(e);
								}
							});
						} else {
							this.request(concatURI(this.uri, key), {
								method: "delete"
							}).then(next, function (e) {
								defer.reject(e);
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
				var offset = arguments[1] === undefined ? 0 : arguments[1];

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
			value: function load(type, key) {
				var _this5 = this;

				if (type === undefined) type = "mongo";

				var batch = key === undefined,
				    id = !batch ? key : this.id;

				if (batch) {
					this.clear();
				}

				return this.cmd(type, "get", key).then(function (arg) {
					if (_this5.logging) {
						console.log("Loaded", id, "from", type, "persistent storage");
					}

					return batch ? _this5.batch(arg, "set") : _this5.set(key, arg);
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
			key: "register",
			value: function register(key, fn) {
				adapter[key] = fn;
			}
		}, {
			key: "reindex",
			value: function reindex(index) {
				var _this6 = this;

				if (!index) {
					this.indexes.clear();
					this.index.forEach(function (i) {
						_this6.indexes.set(i, new Map());
					});
					this.forEach(function (data, key) {
						_this6.index.forEach(function (i) {
							setIndex(_this6.index, _this6.indexes, _this6.delimiter, key, data, i);
						});
					});
				} else {
					this.indexes.set(index, new Map());
					this.forEach(function (data, key) {
						setIndex(_this6.index, _this6.indexes, _this6.delimiter, key, data, index);
					});
				}

				return this;
			}
		}, {
			key: "request",
			value: function request(input) {
				var config = arguments[1] === undefined ? {} : arguments[1];

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
				var _this7 = this;

				var type = arguments[0] === undefined ? "mongo" : arguments[0];

				return this.cmd(type, "set").then(function (arg) {
					if (_this7.logging) {
						console.log("Saved", _this7.id, "to", type, "persistent storage");
					}

					return arg;
				}, function (e) {
					if (_this7.logging) {
						console.error("Error saving ", _this7.id, "to", type, "persistent storage:", e.message || e.stack || e);
					}

					throw e;
				});
			}
		}, {
			key: "search",
			value: function search(value, index) {
				var _this8 = this;

				var indexes = index ? this.index.indexOf(index) > -1 ? [index] : [] : this.index,
				    result = [],
				    fn = typeof value === "function",
				    rgex = typeof value.test === "function",
				    seen = new Set();

				if (value) {
					indexes.forEach(function (i) {
						var idx = _this8.indexes.get(i);

						if (idx) {
							idx.forEach(function (lset, lkey) {
								switch (true) {
									case fn && value(lkey):
									case rgex && value.test(lkey):
									case lkey === value:
										lset.forEach(function (key) {
											if (!seen.has(key)) {
												seen.add(key);
												result.push(_this8.get(key));
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
				var _this9 = this;

				var batch = arguments[2] === undefined ? false : arguments[2];
				var override = arguments[3] === undefined ? false : arguments[3];

				var defer = deferred(),
				    method = "post",
				    ldata = clone(data),
				    lkey = key,
				    body = undefined,
				    ogdata = undefined;

				var next = function next(arg) {
					var xdata = arg ? arg[0] : {};

					if (lkey === null) {
						if (_this9.key) {
							if (_this9.source) {
								_this9.source.split(".").forEach(function (i) {
									xdata = xdata[i] || {};
								});
							}

							lkey = xdata[_this9.key] || ldata[_this9.key] || uuid();
						} else {
							lkey = uuid();
						}
					}

					if (method === "post") {
						_this9.registry[_this9.total] = lkey;
						++_this9.total;

						if (_this9.versioning) {
							_this9.versions.set(lkey, new Set());
						}
					} else {
						if (_this9.versioning) {
							_this9.versions.get(lkey).add(tuple(ogdata));
						}

						delIndex(_this9.index, _this9.indexes, _this9.delimiter, lkey, ogdata);
					}

					_this9.data.set(lkey, ldata);
					setIndex(_this9.index, _this9.indexes, _this9.delimiter, lkey, ldata);
					defer.resolve(_this9.get(lkey));

					_this9.storage("set", lkey, ldata).then(function (success) {
						if (success && _this9.logging) {
							console.log("Saved", lkey, "to persistent storage");
						}
					}, function (e) {
						if (_this9.logging) {
							console.error("Error saving", lkey, "to persistent storage:", e.message || e.stack || e);
						}
					});
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
					if (this.patch) {
						if (method === "post") {
							body = [{ op: "add", path: "/", value: ldata }];
						} else if (override) {
							body = [{ op: "replace", path: "/", value: ldata }];
						} else {
							body = patch(ogdata, ldata, this.key);
						}

						this.request(concatURI(this.uri, lkey), {
							method: "patch",
							body: JSON.stringify(body)
						}).then(next, function (e) {
							if (e[1] === 405) {
								_this9.patch = false;
								_this9.request(concatURI(_this9.uri, lkey), {
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
						this.request(concatURI(this.uri, lkey), {
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
				var clear = arguments[1] === undefined ? false : arguments[1];

				var defer = deferred();

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
		}, {
			key: "sort",
			value: function sort(fn) {
				return this.toArray().sort(fn);
			}
		}, {
			key: "sortBy",
			value: function sortBy(index) {
				var _this10 = this;

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
						result.push(_this10.get(key));
					});
				});

				return tuple.apply(tuple, result);
			}
		}, {
			key: "storage",
			value: function storage() {
				var _this11 = this;

				for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
					args[_key2] = arguments[_key2];
				}

				var defer = deferred(),
				    deferreds = [];

				Object.keys(this.adapters).forEach(function (i) {
					deferreds.push(_this11.cmd.apply(_this11, [i].concat(args)));
				});

				if (deferreds.length > 0) {
					Promise.all(deferreds).then(function () {
						defer.resolve(true);
					}, function (e) {
						defer.reject(e);
					});
				} else {
					defer.resolve(false);
				}

				return defer.promise;
			}
		}, {
			key: "sync",
			value: function sync() {
				var _this12 = this;

				var clear = arguments[0] === undefined ? false : arguments[0];

				var defer = deferred();

				this.request(this.uri).then(function (arg) {
					var data = arg[0];

					_this12.patch = (arg[2].Allow || arg[2].allow || "").indexOf("PATCH") > -1;

					if (_this12.source) {
						try {
							_this12.source.split(".").forEach(function (i) {
								data = data[i];
							});
						} catch (e) {
							return defer.reject(e);
						}
					}

					if (clear) {
						_this12.clear();
					}

					_this12.batch(data, "set").then(function (records) {
						defer.resolve(records);
					}, function (e) {
						defer.reject(e);
					});
				}, function (e) {
					defer.reject(e[0] || e);
				});

				return defer.promise;
			}
		}, {
			key: "toArray",
			value: function toArray() {
				var result = [];

				this.forEach(function (value) {
					result.push(value);
				});

				return result;
			}
		}, {
			key: "toObject",
			value: function toObject() {
				return toObjekt(this);
			}
		}, {
			key: "unload",
			value: function unload(type, key) {
				var _this13 = this;

				if (type === undefined) type = "mongo";

				var id = key !== undefined ? key : this.id;

				return this.cmd(type, "remove", key).then(function (arg) {
					if (_this13.logging) {
						console.log("Unloaded", id, "from", type, "persistent storage");
					}

					return arg;
				}, function (e) {
					if (_this13.logging) {
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
		var data = arguments[0] === undefined ? null : arguments[0];
		var config = arguments[1] === undefined ? {} : arguments[1];
		var indexes = arguments[2] === undefined ? [] : arguments[2];

		return new Haro(data, config, indexes);
	}

	factory.version = "1.4.8";

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
