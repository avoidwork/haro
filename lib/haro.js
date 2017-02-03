/**
 * Harō is a modern immutable DataStore
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2017
 * @license BSD-3-Clause
 * @version 3.1.8
 */
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

(function (global) {
	var server = typeof process !== "undefined" && typeof process.nextTick === "function";
	var Promise = global.Promise;
	var Map = global.Map;
	var Set = global.Set;
	var fetch = global.fetch || require("node-fetch");
	var Blob = global.Blob || require("Blob");
	var Worker = global.Worker || require("tiny-worker");
	var r = [8, 9, "a", "b"];
	var regex = {
		querystring: /\?.*/,
		endslash: /\/$/
	};
	var webWorker = typeof Blob !== "undefined" && typeof Worker !== "undefined";
	var webWorkerError = "Web Worker not supported";
	var adapter = {};

	function deferred() {
		var promise = void 0,
		    resolver = void 0,
		    rejecter = void 0;

		promise = new Promise(function (resolve, reject) {
			resolver = resolve;
			rejecter = reject;
		});

		return { resolve: resolver, reject: rejecter, promise: promise };
	}

	function has(a, b) {
		return b in a;
	}

	function each(arg, fn) {
		var exit = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

		var nth = arg.length;

		var i = -1;

		if (exit) {
			while (++i < nth) {
				if (fn(arg[i], i) === false) {
					break;
				}
			}
		} else {
			while (++i < nth) {
				fn(arg[i], i);
			}
		}
	}

	function cast(input) {
		var result = void 0;

		switch (true) {
			case input instanceof Map:
				result = {};
				input.forEach(function (value, key) {
					result[key] = cast(value);
				});
				break;
			case input instanceof Set:
				result = [];
				input.forEach(function (i) {
					result.push(cast(i));
				});
				break;
			case Array.isArray(input):
				result = new Set();
				each(input, function (i) {
					result.add(cast(i));
				});
				break;
			case input instanceof Object:
				result = new Map();
				each(Object.keys(input), function (i) {
					result.set(i, cast(input[i]));
				});
				break;
			default:
				result = input;
		}

		return result;
	}

	function blob(arg) {
		var obj = void 0;

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
		return JSON.parse(JSON.stringify(arg, null, 0));
	}

	function concatURI(left, right) {
		return left.replace(regex.querystring, "").replace(regex.endslash, "") + (right ? "/" + right : "");
	}

	function keyIndex(key, data, delimiter, pattern) {
		var result = void 0;

		if (key.indexOf(delimiter) > -1) {
			result = key.split(delimiter).sort(function (a, b) {
				return a.localeCompare(b);
			}).map(function (i) {
				return data[i].toString().replace(new RegExp(pattern, "g"), "").toLowerCase();
			}).join(delimiter);
		} else {
			result = data[key];
		}

		return result;
	}

	function delIndex(index, indexes, delimiter, key, data, pattern) {
		index.forEach(function (i) {
			var idx = indexes.get(i),
			    value = keyIndex(i, data, delimiter, pattern);

			var o = void 0;

			if (idx.has(value)) {
				o = idx.get(value);
				o.delete(key);

				if (o.size === 0) {
					o = null;
					idx.delete(value);
				}
			}
		});
	}

	function createIndexes(records, indexes, key, delimiter, pattern) {
		var result = {};

		each(indexes, function (i) {
			result[i] = {};
		});

		each(records, function (i) {
			var lkey = i[key];

			if (lkey !== undefined) {
				indexes.forEach(function (index) {
					var lindex = keyIndex(index, i, delimiter, pattern);

					if (!has(result[index], lindex)) {
						result[index][lindex] = [];
					}

					result[index][lindex].push(lkey);
				});
			}
		});

		return result;
	}

	function iterate(obj, fn) {
		if (obj instanceof Object) {
			each(Object.keys(obj), function (i) {
				fn.call(obj, obj[i], i);
			});
		} else {
			each(obj, fn);
		}
	}

	function merge(a, b) {
		if (a instanceof Object && b instanceof Object) {
			each(Object.keys(b), function (i) {
				if (a[i] instanceof Object && b[i] instanceof Object) {
					a[i] = merge(a[i], b[i]);
				} else if (Array.isArray(a[i]) && Array.isArray(b[i])) {
					a[i] = a[i].concat(b[i]);
				} else {
					a[i] = b[i];
				}
			});
		} else if (Array.isArray(a) && Array.isArray(b)) {
			a = a.concat(b);
		} else {
			a = b;
		}

		return a;
	}

	function joinData(id, a, b, key, on) {
		var type = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : "inner";

		var result = [];

		var error = false,
		    errorMsg = "More than one record found on ";

		function join(left, right, ids) {
			var include = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
			var reverse = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;

			var keys = Object.keys(right[0]),
			    fn = !reverse ? function (x, i) {
				return x[on] === i[key];
			} : function (x, i) {
				return x[key] === i[on];
			};

			each(left, function (i) {
				var comp = {},
				    c = right.filter(function (x) {
					return fn(x, i);
				});

				var valid = true;

				if (c.length > 1) {
					error = true;
					errorMsg += i[on];
					valid = false;
				} else if (c.length === 1) {
					each([i, c[0]], function (x, idx) {
						return iterate(x, function (v, k) {
							comp[ids[idx] + "_" + k] = v;
						});
					});
				} else if (include) {
					iterate(i, function (v, k) {
						comp[ids[0] + "_" + k] = v;
					});

					each(keys, function (k) {
						comp[ids[1] + "_" + k] = null;
					});
				}

				if (valid && Object.keys(comp).length > 0) {
					result.push(comp);
				}

				return valid;
			}, true);
		}

		if (type === "inner") {
			join(a, b, id);
		}

		if (type === "left") {
			join(a, b, id, true);
		}

		if (type === "right") {
			join(b, a, clone(id).reverse(), true, true);
		}

		return !error ? result : errorMsg;
	}

	function onmessage(ev) {
		var data = JSON.parse(ev.data),
		    cmd = data.cmd;

		var result = void 0;

		if (cmd === "index") {
			result = createIndexes(data.records, data.index, data.key, data.delimiter, data.pattern);
		}

		if (cmd === "join") {
			result = joinData(data.ids, data.records[0], data.records[1], data.key, data.on, data.type);
		}

		postMessage(JSON.stringify(result));
	}

	function patch() {
		var ogdata = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
		var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
		var key = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "";
		var overwrite = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

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
		return ((Math.random() + 1) * 0x10000 | 0).toString(16).substring(1);
	}

	function setIndexValue(index, key, value) {
		if (!index.has(key)) {
			index.set(key, new Set());
		}

		index.get(key).add(value);
	}

	function setIndex(index, indexes, delimiter, key, data, indice, pattern) {
		each(!indice ? index : [indice], function (i) {
			var lidx = keyIndex(i, data, delimiter, pattern);

			if (lidx !== undefined && lidx !== null) {
				setIndexValue(indexes.get(i), lidx, key);
			}
		});
	}

	function toObjekt(arg) {
		var frozen = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

		var result = {};

		arg.forEach(function (value, key) {
			var obj = value;

			if (frozen) {
				Object.freeze(obj);
			}

			result[clone(key)] = obj;
		});

		if (frozen) {
			Object.freeze(result);
		}

		return result;
	}

	function uuid() {
		return s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s();
	}

	var Haro = function () {
		function Haro(data) {
			var _this = this;

			var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

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
			this.worker = null;
			this.versions = new Map();
			this.versioning = true;

			each(Object.keys(config), function (i) {
				_this[i] = merge(_this[i], config[i]);
			});

			this.reindex();

			if (data) {
				this.batch(data, "set");
			}
		}

		_createClass(Haro, [{
			key: "batch",
			value: function batch(args) {
				var _this2 = this;

				var type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "set";
				var lload = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

				var defer = deferred(),
				    fn = type === "del" ? function (i) {
					return _this2.del(i, true);
				} : function (i) {
					return _this2.set(null, i, true, true, lload);
				};

				Promise.all(args.map(fn)).then(defer.resolve, defer.reject);

				return defer.promise.then(function (arg) {
					_this2.onbatch(type, arg);

					if (_this2.logging) {
						console.log("Batch inserted data into", _this2.id);
					}

					return arg;
				}, function (e) {
					_this2.onerror("batch", e);
					throw e;
				});
			}
		}, {
			key: "clear",
			value: function clear() {
				this.total = 0;
				this.registry.length = 0;
				this.data.clear();
				this.indexes.clear();
				this.versions.clear();
				this.reindex().onclear();

				if (this.logging) {
					console.log("Cleared", this.id);
				}

				return this;
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
			key: "crawl",
			value: function crawl(arg) {
				var result = clone(arg);

				each((this.source || "").split("."), function (i) {
					result = result[i];
				});

				return result || arg;
			}
		}, {
			key: "del",
			value: function del(key) {
				var _this3 = this;

				var batch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

				var defer = deferred(),
				    og = this.get(key, true);

				var index = void 0;

				if (og) {
					index = this.registry.indexOf(key);

					if (index === 0) {
						this.registry.shift();
					} else if (index === this.registry.length - 1) {
						this.registry.pop();
					} else {
						this.registry.splice(index, 1);
					}

					delIndex(this.index, this.indexes, this.delimiter, key, og, this.pattern);
					this.data.delete(key);
					--this.total;

					defer.resolve(key);
				} else {
					defer.reject(new Error("Record not found"));
				}

				return defer.promise.then(function (arg) {
					_this3.ondelete(arg);

					if (_this3.versioning) {
						_this3.versions.delete(key);
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

					if (_this3.uri && !batch) {
						_this3.transmit(key, null, og, false, "delete").catch(function (err) {
							if (_this3.logging) {
								console.error(err.stack || err.message || err);
							}

							_this3.set(key, og, true, true).then(function () {
								if (_this3.logging) {
									console.log("Reverted", key);
								}
							}).catch(function () {
								if (_this3.logging) {
									console.log("Failed to revert", key);
								}
							});
						});
					}

					return arg;
				}, function (e) {
					_this3.onerror("delete", e);
					throw e;
				});
			}
		}, {
			key: "dump",
			value: function dump() {
				var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "records";

				return type === "records" ? this.toArray(null, false) : this.transform(this.indexes);
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

				var raw = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

				var key = Object.keys(where).sort().join(this.delimiter),
				    value = keyIndex(key, where, this.delimiter),
				    result = [];

				if (this.indexes.has(key)) {
					(this.indexes.get(key).get(value) || new Set()).forEach(function (i) {
						return result.push(_this4.get(i, raw));
					});
				}

				return raw ? result : this.list.apply(this, result);
			}
		}, {
			key: "filter",
			value: function filter(fn) {
				var _this5 = this;

				var raw = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

				var result = [];

				var lfn = void 0;

				if (!raw) {
					lfn = function lfn(value, key) {
						if (fn(value, key) === true) {
							result.push(_this5.list(key, value));
						}
					};
				} else {
					lfn = function lfn(value, key) {
						if (fn(value, key) === true) {
							result.push(value);
						}
					};
				}

				this.forEach(lfn);

				return raw ? result : this.list.apply(this, result);
			}
		}, {
			key: "forEach",
			value: function forEach(fn, ctx) {
				this.data.forEach(function (value, key) {
					return fn(clone(value), clone(key));
				}, ctx);

				return this;
			}
		}, {
			key: "get",
			value: function get(key) {
				var raw = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

				var result = clone(this.data.get(key) || null);

				return result && !raw ? this.list(key, result) : result;
			}
		}, {
			key: "has",
			value: function has(key) {
				return this.data.has(key);
			}
		}, {
			key: "join",
			value: function join(other) {
				var on = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.key;
				var type = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "inner";
				var where = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

				var defer = deferred();

				var promise = void 0;

				if (other.total > 0) {
					if (where.length > 0) {
						promise = this.offload([[this.id, other.id], this.find(where[0], true), !where[1] ? other.toArray(null, true) : other.find(where[1], true), this.key, on, type], "join");
					} else {
						promise = this.offload([[this.id, other.id], this.toArray(null, true), other.toArray(null, true), this.key, on, type], "join");
					}

					promise.then(function (arg) {
						if (typeof arg === "string") {
							defer.reject(new Error(arg));
						} else {
							defer.resolve(arg);
						}
					}, defer.reject);
				} else {
					defer.resolve([]);
				}

				return defer.promise;
			}
		}, {
			key: "keys",
			value: function keys() {
				return this.data.keys();
			}
		}, {
			key: "limit",
			value: function limit() {
				var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

				var _this6 = this;

				var max = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
				var raw = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

				var result = this.registry.slice(offset, offset + max).map(function (i) {
					return _this6.get(i, raw);
				});

				return raw ? result : this.list.apply(this, _toConsumableArray(result));
			}
		}, {
			key: "list",
			value: function list() {
				for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
					args[_key2] = arguments[_key2];
				}

				return Object.freeze(args.map(function (i) {
					return Object.freeze(i);
				}));
			}
		}, {
			key: "load",
			value: function load() {
				var _this7 = this;

				var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "mongo";
				var key = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

				var batch = key === undefined,
				    id = !batch ? key : this.id;

				if (batch) {
					this.clear();
				}

				return this.cmd(type, "get", key).then(function (arg) {
					if (_this7.logging) {
						console.log("Loaded", id, "from", type, "persistent storage");
					}

					return batch ? _this7.batch(arg, "set", true) : _this7.set(key, arg, true, true, true);
				}, function (e) {
					if (_this7.logging) {
						console.error("Error loading", id, "from", type, "persistent storage:", e.message || e.stack || e);
					}

					throw e;
				});
			}
		}, {
			key: "map",
			value: function map(fn) {
				var raw = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

				var result = [];

				this.forEach(function (value, key) {
					return result.push(fn(value, key));
				});

				return raw ? result : this.list.apply(this, result);
			}
		}, {
			key: "offload",
			value: function offload(data) {
				var cmd = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "index";
				var index = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.index;

				var defer = deferred();

				var payload = void 0,
				    obj = void 0;

				if (this.worker) {
					obj = this.useWorker(defer);

					if (obj) {
						if (cmd === "index") {
							payload = {
								cmd: cmd,
								index: index,
								records: data,
								key: this.key,
								delimiter: this.delimiter,
								pattern: this.pattern
							};
						}

						if (cmd === "join") {
							payload = {
								cmd: cmd,
								ids: data[0],
								records: [data[1], data[2]],
								key: data[3],
								on: data[4],
								type: data[5]
							};
						}

						obj.postMessage(JSON.stringify(payload, null, 0));
					}
				} else {
					defer.reject(new Error(webWorkerError));
				}

				return defer.promise;
			}
		}, {
			key: "onbatch",
			value: function onbatch() {}
		}, {
			key: "onclear",
			value: function onclear() {}
		}, {
			key: "ondelete",
			value: function ondelete() {}
		}, {
			key: "onerror",
			value: function onerror() {}
		}, {
			key: "onrequest",
			value: function onrequest(arg) {
				return arg;
			}
		}, {
			key: "onset",
			value: function onset() {}
		}, {
			key: "onsync",
			value: function onsync() {}
		}, {
			key: "override",
			value: function override(data) {
				var _this8 = this;

				var type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "records";
				var fn = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : undefined;

				var defer = deferred();

				if (type === "indexes") {
					this.indexes = this.transform(data, fn);
					defer.resolve(true);
				} else if (type === "records") {
					this.data.clear();
					this.indexes.clear();
					this.registry.length = 0;

					each(data, function (datum) {
						var key = _this8.key ? datum[_this8.key] : uuid() || uuid();

						_this8.data.set(key, datum);
						_this8.registry.push(key);
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

				return this;
			}
		}, {
			key: "reindex",
			value: function reindex(index) {
				var _this9 = this;

				if (!index) {
					this.indexes.clear();
					this.index.forEach(function (i) {
						return _this9.indexes.set(i, new Map());
					});
					this.forEach(function (data, key) {
						return _this9.index.forEach(function (i) {
							return setIndex(_this9.index, _this9.indexes, _this9.delimiter, key, data, i, _this9.pattern);
						});
					});
				} else {
					if (this.index.indexOf(index) === -1) {
						this.index.push(index);
					}

					this.indexes.set(index, new Map());
					this.forEach(function (data, key) {
						return setIndex(_this9.index, _this9.indexes, _this9.delimiter, key, data, index, _this9.pattern);
					});
				}

				return this;
			}
		}, {
			key: "request",
			value: function request(input) {
				var _this10 = this;

				var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

				var defer = deferred(),
				    cfg = merge(clone(this.config), config);

				cfg.method = cfg.method.toUpperCase();

				if (cfg.method === "DELETE") {
					delete cfg.body;
				}

				fetch(input, cfg).then(function (res) {
					var status = res.status,
					    headers = {};

					if (res.headers._headers) {
						each(Object.keys(res.headers._headers), function (i) {
							headers[i] = res.headers._headers[i].join(", ");
						});
					} else {
						var _iteratorNormalCompletion = true;
						var _didIteratorError = false;
						var _iteratorError = undefined;

						try {
							for (var _iterator = res.headers.entries()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
								var pair = _step.value;

								headers[pair[0]] = pair[1];
							}
						} catch (err) {
							_didIteratorError = true;
							_iteratorError = err;
						} finally {
							try {
								if (!_iteratorNormalCompletion && _iterator.return) {
									_iterator.return();
								}
							} finally {
								if (_didIteratorError) {
									throw _iteratorError;
								}
							}
						}
					}

					res[(headers["content-type"] || "").indexOf("application/json") > -1 ? "json" : "text"]().then(function (arg) {
						defer[status < 200 || status >= 400 ? "reject" : "resolve"](_this10.list(_this10.onrequest(arg, status, headers), status, headers));
					}, function (e) {
						return defer.reject(_this10.list(e.message, status, headers));
					});
				}, function (e) {
					return defer.reject(_this10.list(e.message, 0, {}));
				});

				return defer.promise;
			}
		}, {
			key: "save",
			value: function save() {
				var _this11 = this;

				var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "mongo";

				return this.cmd(type, "set").then(function (arg) {
					if (_this11.logging) {
						console.log("Saved", _this11.id, "to", type, "persistent storage");
					}

					return arg;
				}, function (e) {
					if (_this11.logging) {
						console.error("Error saving ", _this11.id, "to", type, "persistent storage:", e.message || e.stack || e);
					}

					throw e;
				});
			}
		}, {
			key: "search",
			value: function search(value, index) {
				var _this12 = this;

				var raw = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

				var result = [],
				    fn = typeof value === "function",
				    rgex = value && typeof value.test === "function",
				    seen = new Set();

				if (value) {
					each(index ? Array.isArray(index) ? index : [index] : this.index, function (i) {
						var idx = _this12.indexes.get(i);

						if (idx) {
							idx.forEach(function (lset, lkey) {
								switch (true) {
									case fn && value(lkey, i):
									case rgex && value.test(Array.isArray(lkey) ? lkey.join(", ") : lkey):
									case lkey === value:
										lset.forEach(function (key) {
											if (!seen.has(key)) {
												seen.add(key);
												result.push(_this12.get(key, raw));
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

				return raw ? result : this.list.apply(this, result);
			}
		}, {
			key: "set",
			value: function set(key, data) {
				var batch = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

				var _this13 = this;

				var override = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
				var lload = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;

				var defer = deferred();

				var x = clone(data),
				    method = void 0,
				    og = void 0;

				if (key === undefined || key === null) {
					key = this.key && x[this.key] !== undefined ? x[this.key] : uuid();
				}

				if (!this.data.has(key)) {
					this.registry[this.total] = key;
					++this.total;
					method = "post";

					if (this.versioning) {
						this.versions.set(key, new Set());
					}
				} else {
					og = this.get(key, true);
					delIndex(this.index, this.indexes, this.delimiter, key, og, this.pattern);
					method = "put";

					if (this.versioning) {
						this.versions.get(key).add(Object.freeze(clone(og)));
					}

					if (!override) {
						x = merge(clone(og), x);
					}
				}

				this.data.set(key, x);
				setIndex(this.index, this.indexes, this.delimiter, key, x, null, this.pattern);
				defer.resolve(this.get(key));

				return defer.promise.then(function (arg) {
					_this13.onset(arg);

					if (!batch && _this13.uri) {
						_this13.transmit(key, x, og, override, method).catch(function (e) {
							if (_this13.logging) {
								console.error(e.stack || e.message || e);
							}

							if (og) {
								_this13.set(key, og, true, true).then(function () {
									if (_this13.logging) {
										console.log("Reverted", key);
									}
								}).catch(function () {
									if (_this13.logging) {
										console.log("Failed to revert", key);
									}
								});
							} else {
								_this13.del(key, true).then(function () {
									if (_this13.logging) {
										console.log("Reverted", key);
									}
								}).catch(function () {
									if (_this13.logging) {
										console.log("Failed to revert", key);
									}
								});
							}
						});
					}

					if (!lload) {
						_this13.storage("set", key, x).then(function (success) {
							if (success && _this13.logging) {
								console.log("Saved", key, "to persistent storage");
							}
						}, function (e) {
							if (_this13.logging) {
								console.error("Error saving", key, "to persistent storage:", e.message || e.stack || e);
							}
						});
					}

					return arg;
				}, function (e) {
					_this13.onerror("set", e);
					throw e;
				});
			}
		}, {
			key: "setUri",
			value: function setUri(uri) {
				var clear = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

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
				var frozen = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

				return frozen ? Object.freeze(this.limit(0, this.total, true).sort(fn).map(function (i) {
					return Object.freeze(i);
				})) : this.limit(0, this.total, true).sort(fn);
			}
		}, {
			key: "sortBy",
			value: function sortBy(index) {
				var _this14 = this;

				var raw = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

				var result = [],
				    keys = [];

				var lindex = void 0;

				if (!this.indexes.has(index)) {
					this.reindex(index);
				}

				lindex = this.indexes.get(index);
				lindex.forEach(function (idx, key) {
					return keys.push(key);
				});
				each(keys.sort(), function (i) {
					return lindex.get(i).forEach(function (key) {
						return result.push(_this14.get(key, raw));
					});
				});

				return raw ? result : this.list.apply(this, result);
			}
		}, {
			key: "storage",
			value: function storage() {
				var _this15 = this;

				for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
					args[_key3] = arguments[_key3];
				}

				var defer = deferred(),
				    deferreds = Object.keys(this.adapters).map(function (i) {
					return _this15.cmd.apply(_this15, [i].concat(args));
				});

				if (deferreds.length > 0) {
					Promise.all(deferreds).then(function () {
						return defer.resolve(true);
					}, defer.reject);
				} else {
					defer.resolve(false);
				}

				return defer.promise;
			}
		}, {
			key: "sync",
			value: function sync() {
				var _this16 = this;

				var clear = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

				var defer = deferred();

				var valid = true;

				this.request(this.uri).then(function (arg) {
					var data = void 0;

					_this16.patch = (arg[2].Allow || arg[2].allow || "").indexOf("PATCH") > -1;

					try {
						data = _this16.source ? _this16.crawl(arg[0]) : arg[0];
					} catch (e) {
						valid = false;
						defer.reject(e);
					}

					if (valid) {
						if (clear) {
							_this16.clear();
						}

						_this16.batch(data, "set").then(defer.resolve, defer.reject);
					}
				}, function (e) {
					defer.reject(e[0] || e);
				});

				return defer.promise.then(function (arg) {
					_this16.onsync(arg);

					return arg;
				}, function (e) {
					_this16.onerror("sync", e);

					throw e;
				});
			}
		}, {
			key: "toArray",
			value: function toArray(data) {
				var frozen = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

				var result = void 0;

				if (data) {
					result = data.map(function (i) {
						return frozen ? i[1] : clone(i[1]);
					});
				} else {
					result = this.limit(0, this.total, true);

					if (frozen) {
						each(result, function (i) {
							return Object.freeze(i);
						});
					}
				}

				return frozen ? Object.freeze(result) : result;
			}
		}, {
			key: "toObject",
			value: function toObject(data) {
				var frozen = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

				var result = !data ? toObjekt(this, frozen) : data.reduce(function (a, b) {
					var obj = clone(b[1]);

					if (frozen) {
						Object.freeze(obj);
					}

					a[b[0]] = obj;

					return a;
				}, {});

				return frozen ? Object.freeze(result) : result;
			}
		}, {
			key: "transform",
			value: function transform(input, fn) {
				return typeof fn === "function" ? fn(input) : cast(input);
			}
		}, {
			key: "transmit",
			value: function transmit(key, data, og) {
				var _this17 = this;

				var override = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
				var method = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : "post";

				var defer = deferred(),
				    uri = concatURI(this.uri, data ? key : null);

				var body = void 0;

				if (this.patch) {
					if (!data) {
						body = [{ op: "remove", path: "/", value: key }];
					} else if (!og) {
						body = [{ op: "add", path: "/", value: data }];
					} else if (override) {
						body = [{ op: "replace", path: "/", value: data }];
					} else {
						body = patch(og, data, this.key);
					}

					this.request(uri, { method: "patch", body: JSON.stringify(body, null, 0) }).then(defer.resolve, function (e) {
						if (e[1] === 405) {
							_this17.patch = false;
							_this17.request(!data ? concatURI(_this17.uri, key) : uri, { method: method, body: JSON.stringify(data, null, 0) }).then(defer.resolve, defer.reject);
						} else {
							defer.reject(e);
						}
					});
				} else {
					this.request(uri, { method: method, body: JSON.stringify(data, null, 0) }).then(defer.resolve, defer.reject);
				}

				return defer.promise;
			}
		}, {
			key: "unload",
			value: function unload() {
				var _this18 = this;

				var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "mongo";
				var key = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

				var id = key !== undefined ? key : this.id;

				return this.cmd(type, "remove", key).then(function (arg) {
					if (_this18.logging) {
						console.log("Unloaded", id, "from", type, "persistent storage");
					}

					return arg;
				}, function (e) {
					if (_this18.logging) {
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
		}, {
			key: "useWorker",
			value: function useWorker(defer) {
				var obj = void 0;

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
		}]);

		return Haro;
	}();

	function factory() {
		var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
		var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
		var indexes = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

		var obj = new Haro(data, config, indexes),
		    functions = void 0;

		if (webWorker) {
			functions = [cast.toString(), clone.toString(), createIndexes.toString(), each.toString(), has.toString(), iterate.toString(), joinData.toString(), keyIndex.toString(), setIndexValue.toString(), setIndex.toString(), (!server ? "" : "self.") + "onmessage = " + onmessage.toString() + ";"];

			try {
				obj.worker = !server ? global.URL.createObjectURL(blob(functions.join("\n"))) : new Function(functions.join("\n"));
			} catch (e) {
				obj.worker = null;
			}
		}

		return obj;
	}

	factory.transform = cast;
	factory.version = "3.1.8";

	// Node, AMD & window supported
	if (typeof exports !== "undefined") {
		module.exports = factory;
	} else if (typeof define === "function" && define.amd) {
		define(function () {
			return factory;
		});
	} else {
		global.haro = factory;
	}
})(typeof window !== "undefined" ? window : global);
