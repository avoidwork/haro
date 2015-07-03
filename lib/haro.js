/**
 * Harō is a modern immutable DataStore using Maps, Sets, Promises, & Tuples
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2015
 * @license BSD-3-Clause
 * @link http://haro.rocks
 * @version 1.3.2
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
	var regex = {
		querystring: /\?.*/,
		endslash: /\/$/
	};

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

	function iterate(obj, fn) {
		if (obj instanceof Object) {
			Object.keys(obj).forEach(function (i) {
				fn.call(obj, obj[i], i);
			});
		} else {
			obj.forEach(fn);
		}
	}

	function keyIndex(key, data, delimiter) {
		var keys = key.split(delimiter).sort(),
		    result = undefined;

		if (keys.length > 1) {
			result = keys.map(function (i) {
				return String(data[i]);
			}).join(delimiter);
		} else {
			result = data[key];
		}

		return result;
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

		var _this = this;

		var data = arguments[1] === undefined ? {} : arguments[1];
		var overwrite = arguments[2] === undefined ? false : arguments[2];

		var result = [];

		if (overwrite) {
			iterate(ogdata, function (value, key) {
				if (key !== _this.key && data[key] === undefined) {
					result.push({ op: "remove", path: "/" + key });
				}
			});
		}

		iterate(data, function (value, key) {
			if (key !== _this.key && ogdata[key] === undefined) {
				result.push({ op: "add", path: "/" + key, value: value });
			} else if (JSON.stringify(ogdata[key]) !== JSON.stringify(value)) {
				result.push({ op: "replace", path: "/" + key, value: value });
			}
		});

		return result;
	}

	var r = [8, 9, "a", "b"];

	function s() {
		return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1);
	}

	function uuid() {
		return s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s();
	}

	var Haro = (function () {
		function Haro(data) {
			var _this2 = this;

			var config = arguments[1] === undefined ? {} : arguments[1];

			_classCallCheck(this, Haro);

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

			Object.keys(config).forEach(function (i) {
				_this2[i] = merge(_this2[i], config[i]);
			});

			this.reindex();

			if (data) {
				this.batch(data, "set");
			}
		}

		_createClass(Haro, [{
			key: "batch",
			value: function batch(args, type) {
				var _this3 = this;

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
						return _this3.del(i, true);
					};
				} else {
					fn = function (i) {
						return _this3.set(null, i, true, true);
					};
				}

				if (this.patch) {
					if (del) {
						data = patch(this.toArray().map(function (i) {
							return i[_this3.key];
						}), args, true);
					} else {
						data = [];
						hash = {};
						args.forEach(function (i) {
							var key = i[_this3.key];

							if (key) {
								hash[key] = i;
							} else {
								data.push({ op: "add", path: "/", value: i });
							}
						});
						data = data.concat(patch(this.toObject(), hash, true));
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
		}, {
			key: "clear",
			value: function clear() {
				this.total = 0;
				this.registry = [];
				this.data.clear();
				this.indexes.clear();
				this.versions.clear();

				return this.reindex();
			}
		}, {
			key: "del",
			value: function del(key) {
				var _this4 = this;

				var batch = arguments[1] === undefined ? false : arguments[1];

				var defer = deferred();

				var next = function next() {
					var index = _this4.registry.indexOf(key);

					if (index > -1) {
						if (index === 0) {
							_this4.registry.shift();
						} else if (index === _this4.registry.length - 1) {
							_this4.registry.pop();
						} else {
							_this4.registry.splice(index, 1);
						}

						_this4.delIndex(key, _this4.data.get(key));
						_this4.data["delete"](key);
						--_this4.total;

						if (_this4.versioning) {
							_this4.versions["delete"](key);
						}
					}

					defer.resolve();
				};

				if (this.data.has(key)) {
					if (!batch && this.uri) {
						if (this.patch) {
							// @todo implement this!
							this.request(concatURI(this.uri, null), {
								method: "patch",
								body: null
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
		}, {
			key: "delIndex",
			value: function delIndex(key, data) {
				var _this5 = this;

				this.index.forEach(function (i) {
					var idx = _this5.indexes.get(i),
					    value = keyIndex(i, data, _this5.delimiter);

					if (idx.has(value)) {
						idx.get(value)["delete"](key);
					}
				});
			}
		}, {
			key: "entries",
			value: function entries() {
				return this.data.entries();
			}
		}, {
			key: "find",
			value: function find(where) {
				var _this6 = this;

				var key = Object.keys(where).sort().join(this.delimiter),
				    value = keyIndex(key, where, this.delimiter),
				    result = [];

				if (this.indexes.has(key)) {
					(this.indexes.get(key).get(value) || new Set()).forEach(function (i) {
						result.push(_this6.get(i));
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
			key: "keys",
			value: function keys() {
				return this.data.keys();
			}
		}, {
			key: "limit",
			value: function limit(offset, max) {
				if (offset === undefined) offset = 0;

				var loffset = offset,
				    lmax = max,
				    list = [],
				    i = undefined,
				    k = undefined,
				    nth = undefined;

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
			key: "reindex",
			value: function reindex(index) {
				var _this7 = this;

				if (!index) {
					this.indexes.clear();
					this.index.forEach(function (i) {
						_this7.indexes.set(i, new Map());
						_this7.forEach(function (data, key) {
							_this7.setIndex(key, data, i);
						});
					});
				} else {
					this.indexes.set(index, new Map());
					this.forEach(function (data, key) {
						_this7.setIndex(key, data, index);
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

				fetch(input, cfg).then(function (res) {
					var status = res.status;

					res[res.headers.get("content-type").indexOf("application/json") > -1 ? "json" : "text"]().then(function (arg) {
						defer[status < 200 || status >= 400 ? "reject" : "resolve"](tuple(arg, status, res.headers));
					}, function (e) {
						defer.reject(tuple(e.message, status, res.headers));
					});
				}, function (e) {
					defer.reject(tuple(e.message, 0, null));
				});

				return defer.promise;
			}
		}, {
			key: "search",
			value: function search(value, index) {
				var _this8 = this;

				var indexes = index ? this.index.indexOf(index) > -1 ? [index] : [] : this.index,
				    result = [],
				    fn = typeof value === "function",
				    rgex = value instanceof RegExp,
				    seen = new Set();

				if (value) {
					indexes.forEach(function (i) {
						var idx = _this8.indexes.get(i);

						if (idx) {
							idx.forEach(function (lset, lkey) {
								if (fn && value(lkey) || rgex && value.test(lkey) || lkey === value) {
									lset.forEach(function (key) {
										if (!seen.has(key)) {
											seen.add(key);
											result.push(_this8.get(key));
										}
									});
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
				    lkey = key;

				var next = function next() {
					var ogdata = undefined;

					if (method === "post") {
						_this9.registry[_this9.total] = lkey;
						++_this9.total;

						if (_this9.versioning) {
							_this9.versions.set(lkey, new Set());
						}
					} else {
						ogdata = _this9.data.get(lkey);

						if (_this9.versioning) {
							_this9.versions.get(lkey).add(tuple(ogdata));
						}

						_this9.delIndex(lkey, ogdata);
					}

					_this9.data.set(lkey, ldata);
					_this9.setIndex(lkey, ldata);
					defer.resolve(_this9.get(lkey));
				};

				if (lkey === undefined || lkey === null) {
					lkey = this.key ? ldata[this.key] || uuid() : uuid() || uuid();
				} else if (this.data.has(lkey)) {
					method = "put";

					if (!override) {
						ldata = merge(this.get(lkey)[1], ldata);
					}
				}

				if (!batch && this.uri) {
					if (this.patch) {
						// @todo implement this!
						this.request(concatURI(this.uri, null), {
							method: "patch",
							body: JSON.stringify(ldata)
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
		}, {
			key: "setIndex",
			value: function setIndex(key, data, index) {
				var _this10 = this;

				if (!index) {
					this.index.forEach(function (i) {
						_this10.setIndexValue(_this10.indexes.get(i), keyIndex(i, data, _this10.delimiter), key);
					});
				} else {
					this.setIndexValue(this.indexes.get(index), keyIndex(index, data, this.delimiter), key);
				}

				return this;
			}
		}, {
			key: "setIndexValue",
			value: function setIndexValue(index, key, value) {
				if (!index.has(key)) {
					index.set(key, new Set());
				}

				index.get(key).add(value);
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
			key: "sync",
			value: function sync() {
				var _this12 = this;

				var clear = arguments[0] === undefined ? false : arguments[0];

				var defer = deferred();

				this.request(this.uri).then(function (arg) {
					var data = arg[0];

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
				var result = {};

				this.forEach(function (value, key) {
					result[key] = value;
				});

				return result;
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

	factory.version = "1.3.2";

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
