/**
 * Harō is a modern immutable DataStore
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2019
 * @license BSD-3-Clause
 * @version 4.6.3
 */
"use strict";

(function (global) {
	const node = typeof process !== "undefined" && typeof process.nextTick === "function",
		Promise = global.Promise,
		Map = global.Map,
		Set = global.Set,
		fetch = global.fetch || (node ? require("node-fetch") : void 0),
		Blob = global.Blob,
		Worker = global.Worker || (node ? require("tiny-worker") : void 0),
		r = [8, 9, "a", "b"],
		regex = {
			querystring: /\?.*/,
			endslash: /\/$/,
			json: /^application\/json/
		},
		webWorker = typeof Worker !== "undefined",
		webWorkerError = "Web Worker not supported",
		adapter = {};

	function has (a, b) {
		return b in a;
	}

	function each (arr, fn) {
		for (const item of arr.entries()) {
			fn(item[1], item[0]);
		}

		return arr;
	}

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
				result = Array.from(input);
				break;
			case Array.isArray(input):
				result = new Set(input);
				break;
			case input instanceof Object:
				result = new Map(Object.keys(input).map(i => [i, cast(input[i])]));
				break;
			default:
				result = input;
		}

		return result;
	}

	function blob (arg) {
		return new Blob([arg], {type: "application/javascript"});
	}

	function clone (arg) {
		return JSON.parse(JSON.stringify(arg, null, 0));
	}

	function concatURI (left, right) {
		return left.replace(regex.querystring, "").replace(regex.endslash, "") + (right ? "/" + right : "");
	}

	function keyIndex (key, data, delimiter, pattern) {
		let result;

		if (key.includes(delimiter)) {
			result = key.split(delimiter).sort((a, b) => a.localeCompare(b)).map(i => (data[i] !== void 0 ? data[i] : "").toString().replace(new RegExp(pattern, "g"), "").toLowerCase()).join(delimiter);
		} else {
			result = data[key];
		}

		return result;
	}

	function delIndex (index, indexes, delimiter, key, data, pattern) {
		index.forEach(i => {
			const idx = indexes.get(i),
				value = keyIndex(i, data, delimiter, pattern);

			if (idx.has(value)) {
				const o = idx.get(value);

				o.delete(key);

				if (o.size === 0) {
					idx.delete(value);
				}
			}
		});
	}

	function createIndexes (records, indexes, key, delimiter, pattern) {
		const result = {};

		each(indexes, i => {
			result[i] = {};
		});

		each(records, i => {
			const lkey = i[key];

			if (lkey !== void 0) {
				indexes.forEach(index => {
					const lindex = keyIndex(index, i, delimiter, pattern);

					if (!has(result[index], lindex)) {
						result[index][lindex] = [];
					}

					result[index][lindex].push(lkey);
				});
			}
		});

		return result;
	}

	function iterate (obj, fn) {
		if (obj instanceof Object) {
			each(Object.keys(obj), i => fn.call(obj, obj[i], i));
		} else {
			each(obj, fn);
		}
	}

	function merge (a, b) {
		if (a instanceof Object && b instanceof Object) {
			each(Object.keys(b), i => {
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

	function joinData (id, a, b, key, on, type = "inner") {
		const result = [];
		let errorMsg = "More than one record found on ";

		let error = false;

		function join (left, right, ids, include = false, reverse = false) {
			const keys = Object.keys(right[0]),
				fn = !reverse ? (x, i) => x[on] === i[key] : (x, i) => x[key] === i[on];

			each(left, i => {
				const comp = {},
					c = right.filter(x => fn(x, i));

				let valid = true;

				if (c.length > 1) {
					error = true;
					errorMsg += i[on];
					valid = false;
				} else if (c.length === 1) {
					each([i, c[0]], (x, idx) => iterate(x, (v, k) => {
						comp[ids[idx] + "_" + k] = v;
					}));
				} else if (include) {
					iterate(i, (v, k) => {
						comp[ids[0] + "_" + k] = v;
					});

					each(keys, k => {
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

	function onmessage (ev) {
		const data = JSON.parse(ev.data),
			cmd = data.cmd;

		let result;

		if (cmd === "index") {
			result = createIndexes(data.records, data.index, data.key, data.delimiter, data.pattern);
		}

		if (cmd === "join") {
			result = joinData(data.ids, data.records[0], data.records[1], data.key, data.on, data.type);
		}

		postMessage(JSON.stringify(result));
	}

	function createPatch (ogdata = {}, data = {}, key = "", overwrite = false) {
		const result = [];

		if (overwrite) {
			iterate(ogdata, (v, k) => {
				if (k !== key && data[k] === void 0) {
					result.push({op: "remove", path: "/" + k});
				}
			});
		}

		iterate(data, (v, k) => {
			if (k !== key && ogdata[k] === void 0) {
				result.push({op: "add", path: "/" + k, value: v});
			} else if (JSON.stringify(ogdata[k]) !== JSON.stringify(v)) {
				result.push({op: "replace", path: "/" + k, value: v});
			}
		});

		return result;
	}

	function s () {
		return ((Math.random() + 1) * 0x10000 | 0).toString(16).substring(1);
	}

	function setIndex (index, indexes, delimiter, key, data, indice, pattern) {
		each(!indice ? index : [indice], i => {
			const lindex = indexes.get(i);

			if (Array.isArray(data[i]) && !i.includes(delimiter)) {
				each(data[i], d => {
					if (!lindex.has(d)) {
						lindex.set(d, new Set());
					}

					lindex.get(d).add(key);
				});
			} else {
				const lidx = keyIndex(i, data, delimiter, pattern);

				if (lidx !== void 0 && lidx !== null) {
					if (!lindex.has(lidx)) {
						lindex.set(lidx, new Set());
					}

					lindex.get(lidx).add(key);
				}
			}
		});
	}

	function toObjekt (arg, frozen = true) {
		const result = {};

		arg.forEach((value, key) => {
			const obj = value;

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

	function uuid () {
		return s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s();
	}

	const functions = [
		cast.toString(),
		clone.toString(),
		createIndexes.toString(),
		each.toString(),
		has.toString(),
		iterate.toString(),
		joinData.toString(),
		keyIndex.toString(),
		setIndex.toString(),
		(node === false ? "" : "self.") + "onmessage = " + onmessage.toString() + ";"
	].join("\n");

	class Haro {
		constructor ({adapters = {}, config = {}, debounce = 0, delimiter = "|", id = uuid(), index = [], key = "", logging = true, patch = false, pattern = "\\s*|\\t*", source = "", versioning = false} = {}) {
			this.adapters = adapters;
			this.data = new Map();
			this.debounce = debounce;
			this.debounced = new Map();
			this.delimiter = delimiter;
			this.config = {
				method: "get",
				credentials: "include",
				headers: {
					accept: "application/json",
					"content-type": "application/json"
				}
			};
			this.id = id;
			this.index = index;
			this.indexes = new Map();
			this.key = key;
			this.logging = logging;
			this.patch = patch;
			this.pattern = pattern;
			this.source = source;
			this.size = this.total = 0;
			this.uri = "";
			this.worker = null;
			this.versions = new Map();
			this.versioning = versioning;

			Object.defineProperty(this, "registry", {
				enumerable: true,
				get: () => Array.from(this.data.keys())
			});

			if (Object.keys(config).length > 1) {
				this.config = merge(this.config, config);
			}

			return this.reindex();
		}

		async batch (args, type = "set", lazyLoad = false) {
			let result;

			this.beforeBatch(args, type);

			try {
				const fn = type === "del" ? i => this.del(i, true, lazyLoad) : i => this.set(null, i, true, true, lazyLoad);

				result = await Promise.all(args.map(fn));
				this.onbatch(type, result);
				this.log(`Batch successful on ${this.id}`);
			} catch (e) {
				this.onerror("batch", e);
				this.log(`Batch failure on ${this.id}`);
				throw e;
			}

			return result;
		}

		beforeBatch () {}

		beforeClear () {}

		beforeDelete () {}

		beforeRequest () {}

		beforeSet () {}

		beforeSync () {}

		clear () {
			this.beforeClear();
			this.size = this.total = 0;
			this.data.clear();
			this.indexes.clear();
			this.versions.clear();
			this.reindex().onclear();
			this.log(`Cleared ${this.id}`);

			return this;
		}

		async cmd (type, ...args) {
			if (this.adapters[type] === void 0 || adapter[type] === void 0) {
				throw new Error(`${type} not configured for persistent storage`);
			}

			return await adapter[type].apply(this, [this, ...args]);
		}

		crawl (arg) {
			let result = clone(arg);

			each((this.source || "").split("."), i => {
				result = result[i];
			});

			return result || arg;
		}

		del (key, batch = false, lazyLoad = false, retry = false) {
			if (this.has(key) === false) {
				throw new Error("Record not found");
			}

			const og = this.get(key, true);

			return this.exec(async () => {
				this.beforeDelete(key, batch, lazyLoad, retry);
				delIndex(this.index, this.indexes, this.delimiter, key, og, this.pattern);
				this.data.delete(key);
				--this.total;
				this.size = this.total;
			}, async () => {
				this.ondelete(key, batch, retry, lazyLoad);

				if (this.versioning) {
					this.versions.delete(key);
				}

				if (!lazyLoad) {
					this.storage("remove", key).then(success => {
						if (success) {
							this.log(`Deleted ${key} from persistent storage`);
						}
					}, e => this.log(`Error deleting ${key} from persistent storage: ${e.message || e.stack || e}`, "error"));

					if (!batch && !retry && this.uri) {
						if (this.debounced.has(key)) {
							clearTimeout(this.debounced.get(key));
						}

						this.debounced.set(key, setTimeout(async () => {
							this.debounced.delete(key);

							try {
								await this.transmit(key, null, og, false, "delete");
							} catch (err) {
								this.log(err.stack || err.message || err, "error");

								try {
									await this.set(key, og, true, true);
									this.log(`Reverted ${key}`);
								} catch (e) {
									this.log(`Failed to revert ${key}`);
								}
							}
						}, this.debounce));
					}
				}
			}, err => {
				this.onerror("delete", err);
				throw err;
			});
		}

		dump (type = "records") {
			return type === "records" ? this.toArray(null, false) : this.transform(this.indexes);
		}

		entries () {
			return this.data.entries();
		}

		async exec (first, second, handler) {
			let result;

			try {
				const arg = await first();
				result = await second(arg);
			} catch (err) {
				handler(err);
			}

			return result;
		}

		find (where, raw = false) {
			const key = Object.keys(where).sort((a, b) => a.localeCompare(b)).join(this.delimiter),
				value = keyIndex(key, where, this.delimiter, this.pattern),
				result = [];

			if (this.indexes.has(key)) {
				(this.indexes.get(key).get(value) || new Set()).forEach(i => result.push(this.get(i, raw)));
			}

			return raw ? result : this.list(...result);
		}

		filter (fn, raw = false) {
			const result = this.reduce((a, v, k, ctx) => {
				if (fn.call(ctx, v)) {
					a.push(this.get(k, raw));
				}

				return a;
			}, []);

			return raw ? result : this.list(...result);
		}

		forEach (fn, ctx) {
			this.data.forEach((value, key) => fn(clone(value), clone(key)), ctx || this.data);

			return this;
		}

		get (key, raw = false) {
			const result = clone(this.data.get(key) || null);

			return result && !raw ? this.list(key, result) : result;
		}

		has (key, map) {
			return (map || this.data).has(key);
		}

		async join (other, on, type = "inner", where = []) {
			let result;

			if (other.total > 0) {
				if (where.length > 0) {
					result = await this.offload([[this.id, other.id], this.find(where[0], true), !where[1] ? other.toArray(null, true) : other.find(where[1], true), this.key, on || this.key, type], "join");
				} else {
					result = await this.offload([[this.id, other.id], this.toArray(null, true), other.toArray(null, true), this.key, on || this.key, type], "join");
				}

				if (typeof arg === "string") {
					throw new Error(result);
				}
			} else {
				result = [];
			}

			return result;
		}

		keys () {
			return this.data.keys();
		}

		limit (offset = 0, max = 0, raw = false) {
			const result = this.registry.slice(offset, offset + max).map(i => this.get(i, raw));

			return raw ? result : this.list(...result);
		}

		list (...args) {
			return Object.freeze(args.map(i => Object.freeze(i)));
		}

		async load (type = "mongo", key = void 0) {
			const batch = key === void 0,
				id = !batch ? key : this.id;
			let result;

			if (batch) {
				this.clear();
			}

			try {
				const data = await this.cmd(type, "get", key);

				result = batch ? this.batch(data, "set", true) : this.set(key, data, true, true, true);
				this.log(`Loaded ${id} from ${type} persistent storage`);
			} catch (e) {
				this.log(`Error loading ${id} from ${type} persistent storage: ${e.message || e.stack || e}`, "error");
				throw e;
			}

			return result;
		}

		log (arg = "", type = "log") {
			if (this.logging) {
				console[type](`haro: ${arg}`);
			}
		}

		map (fn, raw = false) {
			const result = [];

			this.forEach((value, key) => result.push(fn(value, key)));

			return raw ? result : this.list(...result);
		}

		async offload (data, cmd = "index", index = this.index) {
			return new Promise((resolve, reject) => {
				if (this.worker) {
					const obj = this.useWorker(resolve, reject);
					let payload;

					if (cmd === "index") {
						payload = {
							cmd: cmd,
							index: index,
							records: data,
							key: this.key,
							delimiter: this.delimiter,
							pattern: this.pattern
						};
					} else if (cmd === "join") {
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
				} else {
					reject(new Error(webWorkerError));
				}
			});
		}

		onbatch () {}

		onclear () {}

		ondelete () {}

		onerror () {}

		onrequest (arg) {
			return arg;
		}

		onset () {}

		onsync () {}

		async override (data, type = "records", fn = void 0) {
			const result = true;

			if (type === "indexes") {
				this.indexes = this.transform(data, fn);
			} else if (type === "records") {
				const key = this.key !== "" ? arg => arg[this.key] || uuid() : () => uuid();
				this.indexes.clear();
				this.data = new Map(data.map(datum => [key(datum), datum]));
				this.size = this.total = this.data.size;
			} else {
				throw new Error("Invalid type");
			}

			return result;
		}

		reduce (fn, accumulator, raw = false) {
			let a = accumulator || this.data.keys().next().value;

			this.forEach((v, k) => {
				a = fn(a, v, k, this, raw);
			}, this);

			return a;
		}

		register (key, fn) {
			adapter[key] = fn;

			return this;
		}

		reindex (index) {
			const indices = index ? [index] : this.index;

			if (index && this.index.includes(index) === false) {
				this.index.push(index);
			}

			each(indices, i => this.indexes.set(i, new Map()));
			this.forEach((data, key) => each(indices, i => setIndex(this.index, this.indexes, this.delimiter, key, data, i, this.pattern)));

			return this;
		}

		async request (input, config = {}) {
			return new Promise(async (resolve, reject) => {
				const cfg = merge(clone(this.config), config),
					ref = [input, cfg],
					headers = {};

				cfg.method = cfg.method.toUpperCase();

				if (cfg.method === "DELETE") {
					delete cfg.body;
				}

				this.beforeRequest(...ref);

				try {
					const res = await fetch(input, cfg),
						ok = res.ok,
						status = res.status;

					if (res.headers._headers) {
						each(Object.keys(res.headers._headers), i => {
							headers[i] = res.headers._headers[i].join(", ");
						});
					} else {
						for (const pair of res.headers.entries()) {
							headers[pair[0]] = pair[1];
						}
					}

					const arg = await res[regex.json.test(headers["content-type"] || "") ? "json" : "text"](),
						next = ok ? resolve : reject;

					next(this.list(this.onrequest(arg, status, headers), status, headers));
				} catch (e) {
					reject(this.list(e.message, 0, {}));
				}
			});
		}

		async save (type = "mongo") {
			let result;

			try {
				result = await this.cmd(type, "set");
				this.log(`Saved ${this.id} to ${type} persistent storage`);
			} catch (e) {
				this.log(`Error saving ${this.id} to ${type} persistent storage: ${e.message || e.stack || e}`, "error");
				throw e;
			}

			return result;
		}

		search (value, index, raw = false) {
			const result = new Map(),
				fn = typeof value === "function",
				rgex = value && typeof value.test === "function";

			if (value) {
				each(index ? Array.isArray(index) ? index : [index] : this.index, i => {
					let idx = this.indexes.get(i);

					if (idx) {
						idx.forEach((lset, lkey) => {
							switch (true) {
								case fn && value(lkey, i):
								case rgex && value.test(Array.isArray(lkey) ? lkey.join(", ") : lkey):
								case lkey === value:
									lset.forEach(key => {
										if (!result.has(key) && this.has(key)) {
											result.set(key, this.get(key, raw));
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

			return raw ? Array.from(result.values()) : this.list(...Array.from(result.values()));
		}

		async set (key, data, batch = false, override = false, lazyLoad = false, retry = false) {
			let x = clone(data),
				method, og;

			return this.exec(async () => {
				if (key === void 0 || key === null) {
					key = this.key && x[this.key] !== void 0 ? x[this.key] : uuid();
				}

				this.beforeSet(key, data, batch, override, lazyLoad, retry);

				if (!this.data.has(key)) {
					++this.total;
					this.size = this.total;
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

					if (override === false) {
						x = merge(clone(og), x);
					}
				}

				this.data.set(key, x);
				setIndex(this.index, this.indexes, this.delimiter, key, x, null, this.pattern);

				return this.get(key);
			}, async arg => {
				this.onset(arg, batch, retry, lazyLoad);

				if (!lazyLoad) {
					this.storage("set", key, x).then(success => {
						if (success) {
							this.log(`Saved ${key} to persistent storage`);
						}
					}, e => this.log(`Error saving ${key} to persistent storage: ${e.message || e.stack || e}`, "error"));

					if (!batch && !retry && this.uri) {
						if (this.debounced.has(key)) {
							clearTimeout(this.debounced.get(key));
						}

						this.debounced.set(key, setTimeout(async () => {
							this.debounced.delete(key);

							try {
								await this.transmit(key, x, og, override, method);

								if (og) {
									try {
										await this.set(key, og, batch, true, lazyLoad, true);
										this.log(`Reverted ${key}`);
									} catch (e) {
										this.log(`Failed to revert ${key}`);
									}
								} else {
									try {
										await this.del(key, true);
										this.log(`Reverted ${key}`);
									} catch (e) {
										this.log(`Failed to revert ${key}`);
									}
								}
							} catch (e) {
								this.log(e.stack || e.message || e, "error");
							}
						}, this.debounce));
					}
				}

				return arg;
			}, err => {
				this.onerror("set", err);
				throw err;
			});
		}

		async setUri (uri, clear = false) {
			this.uri = uri;

			return this.uri !== "" ? await this.sync(clear) : [];
		}

		sort (fn, frozen = true) {
			return frozen ? Object.freeze(this.limit(0, this.total, true).sort(fn).map(i => Object.freeze(i))) : this.limit(0, this.total, true).sort(fn);
		}

		sortBy (index, raw = false) {
			const result = [],
				keys = [];

			let lindex;

			if (!this.indexes.has(index)) {
				this.reindex(index);
			}

			lindex = this.indexes.get(index);
			lindex.forEach((idx, key) => keys.push(key));
			each(keys.sort(), i => lindex.get(i).forEach(key => result.push(this.get(key, raw))));

			return raw ? result : this.list(...result);
		}

		async storage (...args) {
			let result;

			try {
				const deferreds = Object.keys(this.adapters).map(async i => await this.cmd.apply(this, [i, ...args]));

				if (deferreds.length > 0) {
					await Promise.all(deferreds);
					result = true;
				} else {
					result = false;
				}
			} catch (e) {
				this.log(e.stack || e.message || e, "error");
				throw e;
			}

			return result;
		}

		async sync (clear = false) {
			let result;

			this.beforeSync(this.uri, clear);

			try {
				const arg = await this.request(this.uri),
					data = this.source ? this.crawl(arg[0]) : arg[0];

				this.patch = (arg[2].Allow || arg[2].allow || "").includes("PATCH");

				if (clear) {
					this.clear();
				}

				result = await this.batch(data, "set");
				this.onsync(result);
			} catch (e) {
				this.onerror("sync", e[0] || e);
				throw e[0] || e;
			}

			return result;
		}

		toArray (data, frozen = true) {
			let result;

			if (data) {
				result = data.map(i => frozen ? i[1] : clone(i[1]));
			} else {
				result = this.limit(0, this.total, true);

				if (frozen) {
					each(result, i => Object.freeze(i));
				}
			}

			return frozen ? Object.freeze(result) : result;
		}

		toObject (data, frozen = true) {
			const result = !data ? toObjekt(this, frozen) : data.reduce((a, b) => {
				const obj = clone(b[1]);

				if (frozen) {
					Object.freeze(obj);
				}

				a[b[0]] = obj;

				return a;
			}, {});

			return frozen ? Object.freeze(result) : result;
		}

		transform (input, fn) {
			return typeof fn === "function" ? fn(input) : cast(input);
		}

		async transmit (key, data, og, override = false, method = "post") {
			const uri = concatURI(this.uri, data ? key : null);

			let body, result;

			if (this.patch) {
				if (data === void 0) {
					body = [{op: "remove", path: "/", value: key}];
				} else if (og === void 0) {
					body = [{op: "add", path: "/", value: data}];
				} else if (override) {
					body = [{op: "replace", path: "/", value: data}];
				} else {
					body = createPatch(og, data, this.key);
				}

				try {
					result = await this.request(uri, {method: "patch", headers: {"content-type": "application/json-patch+json"}, body: JSON.stringify(body, null, 0)});
				} catch (e) {
					if (e[1] === 405) {
						this.patch = false;
						result = await this.request(!data ? concatURI(this.uri, key) : uri, {
							method: method,
							headers: {"content-type": "application/json"},
							body: JSON.stringify(data, null, 0)
						});
					} else {
						throw e;
					}
				}
			} else {
				result = await this.request(uri, {method: method, headers: {"content-type": "application/json"}, body: JSON.stringify(data, null, 0)});
			}

			return result;
		}

		async unload (type = "mongo", key = void 0) {
			const id = key !== void 0 ? key : this.id;
			let result;

			try {
				result = await this.cmd(type, "remove", key);
				this.log(`Unloaded ${id} from ${type} persistent storage`);
			} catch (e) {
				this.log(`Error unloading ${id} from ${type} persistent storage: ${e.message || e.stack || e}`, "error");
				throw e;
			}

			return result;
		}

		unregister (key) {
			delete adapter[key];
		}

		values () {
			return this.data.values();
		}

		useWorker (resolve, reject) {
			let obj;

			if (this.worker) {
				obj = new Worker(this.worker);

				obj.onerror = err => {
					reject(err);
					obj.terminate();
				};

				obj.onmessage = ev => {
					resolve(JSON.parse(ev.data));
					obj.terminate();
				};
			} else {
				reject(new Error(webWorkerError));
			}

			return obj;
		}

		where (predicate, raw = false, inner = false) {
			const keys = this.index.filter(i => i in predicate);

			return keys.length > 0 ? this.filter(new Function("a", `return (${keys.map(i => {
				let result;

				if (Array.isArray(predicate[i])) {
					result = `Array.isArray(a['${i}']) ? ${predicate[i].map(arg => `a['${i}'].includes(${typeof arg === "string" ? `'${arg}'` : arg})`).join(` ${inner === true ? "&&" : "||"} `)} : a['${i}'] === '${predicate[i].join(",")}'`;
				} else if (predicate[i] instanceof RegExp) {
					result = `Array.isArray(a['${i}']) ? a['${i}'].filter(i => ${predicate[i]}.test(a['${i}'])).length > 0 : ${predicate[i]}.test(a['${i}'])`;
				} else {
					const arg = typeof predicate[i] === "string" ? `'${predicate[i]}'` : predicate[i];

					result = `Array.isArray(a['${i}']) ? a['${i}'].includes(${arg}) : a['${i}'] === ${arg}`;
				}

				return result;
			}).join(") && (")});`), raw) : [];
		}
	}

	function factory (data = null, config = {}) {
		const obj = new Haro(config);

		if (webWorker) {
			obj.worker = node === false ? global.URL.createObjectURL(blob(functions)) : new Function(functions);
		}

		if (Array.isArray(data)) {
			obj.batch(data, "set");
		}

		return obj;
	}

	factory.transform = cast;
	factory.version = "4.6.3";

	// Node, AMD & window supported
	if (typeof exports !== "undefined") {
		module.exports = factory;
	} else if (typeof define === "function" && define.amd !== void 0) {
		define(() => factory);
	} else {
		global.haro = factory;
	}
}(typeof window !== "undefined" ? window : global));
