	function has (a, b) {
		return b in a;
	}

	function each (arg, fn, exit = false) {
		const nth = arg.length;

		let i = -1;

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
				result = new Set();
				each(input, i => result.add(cast(i)));
				break;
			case input instanceof Object:
				result = new Map();
				each(Object.keys(input), i => result.set(i, cast(input[i])));
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

		if (key.indexOf(delimiter) > -1) {
			result = key.split(delimiter).sort((a, b) => a.localeCompare(b)).map(i => data[i].toString().replace(new RegExp(pattern, "g"), "").toLowerCase()).join(delimiter);
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

	function joinData (id, a, b, key, on, type = "inner") {
		const result = [];

		let error = false,
			errorMsg = "More than one record found on ";

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

	function setIndex (index, indexes, delimiter, key, data, indice, pattern) {
		each(!indice ? index : [indice], i => {
			let lidx = keyIndex(i, data, delimiter, pattern),
				lindex;

			if (lidx !== undefined && lidx !== null) {
				lindex = indexes.get(i);

				if (!lindex.has(lidx)) {
					lindex.set(lidx, new Set());
				}

				lindex.get(lidx).add(key);
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
