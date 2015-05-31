/**
 * Harō is modern DataStore that can be wired to an API
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2015 
 * @license BSD-3-Clause
 * @link https://github.com/avoidwork/haro
 * @version 1.0.4
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
		    pResolve = undefined,
		    pReject = undefined;

		promise = new Promise(function (resolve, reject) {
			pResolve = resolve;
			pReject = reject;
		});

		return { resolve: pResolve, reject: pReject, promise: promise };
	}

	function merge(a, b) {
		var c = clone(a),
		    d = clone(b);

		Object.keys(d).forEach(function (i) {
			c[i] = d[i];
		});

		return c;
	}

	function uuid() {
		var r = [8, 9, "a", "b"];

		function s() {
			return ((1 + Math.random()) * 65536 | 0).toString(16).substring(1);
		}

		return s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s();
	}

	var Haro = (function () {
		function Haro(data) {
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
			this.registry = [];
			this.key = "";
			this.source = "";
			this.total = 0;
			this.uri = "";
			this.versions = new Map();

			if (data) {
				this.batch(data, "set");
			}
		}

		_createClass(Haro, [{
			key: "batch",
			value: function batch(args, type) {
				var _this = this;

				var defer = deferred(),
				    promises = [];

				if (type === "del") {
					args.forEach(function (i) {
						promises.push(_this.del(i, true));
					});
				} else {
					args.forEach(function (i) {
						promises.push(_this.set(null, i, true));
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
				this.total = 0;
				this.registry = [];
				this.data.clear();
				this.versions.clear();

				return this;
			}
		}, {
			key: "del",
			value: function del(key) {
				var _this2 = this;

				var batch = arguments[1] === undefined ? false : arguments[1];

				var defer = deferred(),
				    index = undefined;

				var next = function next() {
					index = _this2.registry.indexOf(key);

					if (index > -1) {
						if (index === 0) {
							_this2.registry.shift();
						} else if (index === _this2.registry.length - 1) {
							_this2.registry.pop();
						} else {
							_this2.registry.splice(index, 1);
						}

						_this2.data["delete"](key);
						_this2.versions["delete"](key);
						--_this2.total;
					}

					defer.resolve();
				};

				if (this.data.has(key)) {
					if (!batch && this.uri) {
						this.request(this.uri.replace(/\?.*/, "") + "/" + key, { method: "delete" }).then(next, function (e) {
							defer.reject(e);
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
			key: "request",
			value: function request(input) {
				var config = arguments[1] === undefined ? {} : arguments[1];

				var cfg = merge(this.config, config);

				return fetch(input, cfg).then(function (res) {
					return res[cfg.headers.accept === "application/json" ? "json" : "text"]();
				}, function (e) {
					throw e;
				});
			}
		}, {
			key: "set",
			value: function set(key, data) {
				var _this3 = this;

				var batch = arguments[2] === undefined ? false : arguments[2];
				var override = arguments[3] === undefined ? false : arguments[3];

				var defer = deferred(),
				    method = "post",
				    ldata = clone(data),
				    next = undefined;

				next = function () {
					if (method === "post") {
						++_this3.total;
						_this3.registry.push(key);
						_this3.versions.set(key, new Set());
					} else {
						_this3.versions.get(key).add(tuple(_this3.data.get(key)));
					}

					_this3.data.set(key, ldata);
					defer.resolve(_this3.get(key));
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
						defer.reject(e);
					});
				} else {
					next();
				}

				return defer.promise;
			}
		}, {
			key: "setUri",
			value: function setUri(uri) {
				var _this4 = this;

				var defer = deferred();

				this.uri = uri;

				if (this.uri) {
					this.request(this.uri).then(function (arg) {
						var data = arg;

						if (_this4.source) {
							try {
								_this4.source.split(".").forEach(function (i) {
									data = data[i];
								});
							} catch (e) {
								return defer.reject(e);
							}
						}

						_this4.batch(data, "set").then(function (records) {
							defer.resolve(records);
						}, function (e) {
							defer.reject(e);
						});
					}, function (e) {
						defer.reject(e);
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

		return new Haro(data, config);
	}

	factory.version = "1.0.4";

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