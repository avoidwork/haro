/**
 * Harō is modern DataStore that can be wired to an API
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2015 
 * @license BSD-3-Clause
 * @link http://haro.rocks
 * @version 1.1.0
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

	function clone(arg) {
		return JSON.parse(JSON.stringify(arg));
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

	function merge(a, b) {
		var c = clone(a),
		    d = clone(b);

		Object.keys(d).forEach(function (i) {
			c[i] = d[i];
		});

		return c;
	}

	var r = [8, 9, "a", "b"];

	function s() {
		return ((1 + Math.random()) * 65536 | 0).toString(16).substring(1);
	}

	function uuid() {
		return s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s();
	}

	var Haro = (function () {
		function Haro(data) {
			var _this = this;

			var config = arguments[1] === undefined ? {} : arguments[1];
			var indexes = arguments[2] === undefined ? [] : arguments[2];

			_classCallCheck(this, Haro);

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

			this.index.forEach(function (i) {
				_this.indexes.set(i, new Map());
			});

			Object.keys(config).forEach(function (i) {
				_this[i] = merge(_this[i], config[i]);
			});

			if (data) {
				this.batch(data, "set");
			}
		}

		_createClass(Haro, [{
			key: "batch",
			value: function batch(args, type) {
				var _this2 = this;

				var defer = deferred(),
				    promises = [];

				if (type === "del") {
					args.forEach(function (i) {
						promises.push(_this2.del(i, true));
					});
				} else {
					args.forEach(function (i) {
						promises.push(_this2.set(null, i, true));
					});
				}

				Promise.all(promises).then(function (arg) {
					defer.resolve(arg);
				}, function (e) {
					defer.reject(e);
				});

				return defer.promise;
			}
		}, {
			key: "clear",
			value: function clear() {
				var _this3 = this;

				this.total = 0;
				this.registry = [];
				this.data.clear();
				this.indexes.clear();
				this.versions.clear();

				this.index.forEach(function (i) {
					_this3.indexes.set(i, new Map());
				});

				return this;
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

						_this4.removeIndex(key);
						_this4.data["delete"](key);
						_this4.versions["delete"](key);
						--_this4.total;
					}

					defer.resolve();
				};

				if (this.data.has(key)) {
					if (!batch && this.uri) {
						this.request(this.uri.replace(/\?.*/, "") + "/" + key, { method: "delete" }).then(next, function (e) {
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
		}, {
			key: "entries",
			value: function entries() {
				return this.data.entries();
			}
		}, {
			key: "filter",
			value: function filter(fn) {
				var result = [];

				this.forEach(function (value, key) {
					if (fn(clone(value), clone(key)) === true) {
						result.push(tuple(key, value));
					}
				});

				return tuple.apply(tuple, result);
			}
		}, {
			key: "forEach",
			value: function forEach(fn, ctx) {
				return this.data.forEach(fn, ctx);
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
			value: function limit() {
				var start = arguments[0] === undefined ? 0 : arguments[0];
				var offset = arguments[1] === undefined ? 0 : arguments[1];

				var i = start,
				    nth = start + offset,
				    list = [],
				    k = undefined;

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
					result.push(tuple(key, fn(clone(value), clone(key))));
				});

				return tuple.apply(tuple, result);
			}
		}, {
			key: "request",
			value: function request(input) {
				var config = arguments[1] === undefined ? {} : arguments[1];

				var cfg = merge(this.config, config);

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
		}, {
			key: "set",
			value: function set(key, data) {
				var _this5 = this;

				var batch = arguments[2] === undefined ? false : arguments[2];
				var override = arguments[3] === undefined ? false : arguments[3];

				var defer = deferred(),
				    method = "post",
				    ldata = clone(data);

				var next = function next() {
					if (method === "post") {
						++_this5.total;
						_this5.registry.push(key);
						_this5.versions.set(key, new Set());
					} else {
						_this5.versions.get(key).add(tuple(_this5.data.get(key)));
					}

					_this5.data.set(key, ldata);
					// @todo deal with updates by removing existing set values - somehow
					_this5.setIndex(key, ldata);
					defer.resolve(_this5.get(key));
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
					this.request(this.uri.replace(/\?.*/, "") + "/" + key, { method: method, body: JSON.stringify(ldata) }).then(next, function (e) {
						defer.reject(e[0] || e);
					});
				} else {
					next();
				}

				return defer.promise;
			}
		}, {
			key: "setIndex",
			value: function setIndex(key, data) {
				var _this6 = this;

				var delimiter = "|";

				this.index.forEach(function (i) {
					var keys = i.split(delimiter),
					    values = "",
					    index = _this6.indexes.get(i);

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
		}, {
			key: "setUri",
			value: function setUri(uri) {
				var _this7 = this;

				var defer = deferred();

				this.uri = uri;

				if (this.uri) {
					this.request(this.uri).then(function (arg) {
						var data = arg[0];

						if (_this7.source) {
							try {
								_this7.source.split(".").forEach(function (i) {
									data = data[i];
								});
							} catch (e) {
								return defer.reject(e);
							}
						}

						_this7.batch(data, "set").then(function (records) {
							defer.resolve(records);
						}, function (e) {
							defer.reject(e);
						});
					}, function (e) {
						defer.reject(e[0] || e);
					});
				} else {
					defer.resolve();
				}

				return defer.promise;
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
})(typeof global !== "undefined" ? global : window);
