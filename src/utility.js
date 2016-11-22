	function each (arg, fn, exit = false) {
		const nth = arg.length;

		let i = -1;

		if (exit) {
			while (++i < nth) {
				if (fn(arg[i], i, arg) === false) {
					break;
				}
			}
		} else {
			while (++i < nth) {
				fn(arg[i], i, arg);
			}
		}
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
				result = [];
				input.forEach(i => {
					result.push(cast(i));
				});
				break;
			case Array.isArray(input):
				result = new Set();
				each(input, i => {
					result.add(cast(i));
				});
				break;
			case input instanceof Object:
				result = new Map();
				each(Object.keys(input), i => {
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
		return JSON.parse(JSON.stringify(arg, null, 0));
	}

	function concatURI (left, right) {
		return left.replace(regex.querystring, "").replace(regex.endslash, "") + (right ? "/" + right : "");
	}

	function keyIndex (key, data, delimiter, pattern) {
		let result;

		if (key.indexOf(delimiter) > -1) {
			result = key.split(delimiter).sort((a, b) => {
				return a.localeCompare(b);
			}).map(i => {
				return data[i].toString().replace(new RegExp(pattern, "g"), "").toLowerCase();
			}).join(delimiter);
		} else {
			result = data[key];
		}

		return result;
	}

	function delIndex (index, indexes, delimiter, key, data, pattern) {
		index.forEach(i => {
			const idx = indexes.get(i),
				value = keyIndex(i, data, delimiter, pattern);

			let o;

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

	function createIndexes (records, indexes, key, delimiter, pattern) {
		const result = {};

		each(indexes, i => {
			result[i] = {};
		});

		each(records, i => {
			const lkey = i[key];

			if (lkey !== undefined) {
				indexes.forEach(index => {
					const lindex = keyIndex(index, i, delimiter, pattern);

					if (result[index][lindex] === undefined) {
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
			each(Object.keys(obj), i => {
				fn.call(obj, obj[i], i);
			});
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

		let error = false,
			errorMsg;

		function join (left, right, ids, include = false, reverse = false) {
			const keys = Object.keys(right[0]),
				fn = !reverse ? (x, i) => x[on] === i[key] : (x, i) => x[key] === i[on];

			each(left, i => {
				const comp = {},
					c = right.filter(x => fn(x, i));

				let valid = true;

				if (c.length > 1) {
					error = true;
					errorMsg = "More than one record found on " + i[on];
					valid = false;
				} else if (c.length === 1) {
					each([i, c[0]], (x, idx) => {
						iterate(x, (v, k) => {
							comp[ids[idx] + "_" + k] = v;
						});
					});
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

	function output (arg, raw = false) {
		return !raw ? tuple.apply(tuple, arg) : clone(arg);
	}

	function patch (ogdata = {}, data = {}, key = "", overwrite = false) {
		const result = [];

		if (overwrite) {
			iterate(ogdata, (v, k) => {
				if (k !== key && data[k] === undefined) {
					result.push({op: "remove", path: "/" + k});
				}
			});
		}

		iterate(data, (v, k) => {
			if (k !== key && ogdata[k] === undefined) {
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

	function setIndexValue (index, key, value) {
		if (!index.has(key)) {
			index.set(key, new Set());
		}

		index.get(key).add(value);
	}

	function setIndex (index, indexes, delimiter, key, data, indice, pattern) {
		each(!indice ? index : [indice], i => {
			let lidx = keyIndex(i, data, delimiter, pattern);

			if (lidx !== undefined && lidx !== null) {
				setIndexValue(indexes.get(i), lidx, key);
			}
		});
	}

	function toObjekt (arg, frozen = true) {
		const result = {};

		arg.forEach((value, key) => {
			const obj = clone(value);

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
