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
		result = keys.map(i => {
			return String(data[i]).replace(new RegExp(pattern, "g"), "").toLowerCase();
		}).join(delimiter);
	} else {
		result = data[key];
	}

	return result;
}

function delIndex (index, indexes, delimiter, key, data, pattern) {
	index.forEach(i => {
		let idx = indexes.get(i),
			value = keyIndex(i, data, delimiter, pattern),
			o;

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
	let result = {};

	indexes.forEach(i => {
		result[i] = {};
	});

	records.forEach(i => {
		let lkey = i[key];

		if (lkey !== undefined) {
			indexes.forEach(index => {
				let lindex = keyIndex(index, i, delimiter, pattern);

				if (result[index][lindex] === undefined) {
					result[index][lindex] = [];
				}

				result[index][lindex].push(lkey);
			});
		}
	});

	return result;
}

function each (arg, fn) {
	let i = -1,
		nth = arg.length;

	while (++i < nth) {
		if (fn(arg[i]) === false) {
			break;
		}
	}
}

function iterate (obj, fn) {
	if (obj instanceof Object) {
		Object.keys(obj).forEach(i => {
			fn.call(obj, obj[i], i);
		});
	} else {
		obj.forEach(fn);
	}
}

function merge (a, b) {
	if (a instanceof Object && b instanceof Object) {
		Object.keys(b).forEach(i => {
			if (a[i] instanceof Object && b[i] instanceof Object) {
				a[i] = merge(a[i], b[i]);
			} else if (a[i] instanceof Array && b[i] instanceof Array) {
				a[i] = a[i].concat(b[i]);
			} else {
				a[i] = b[i];
			}
		});
	} else if (a instanceof Array && b instanceof Array) {
		a = a.concat(b);
	} else {
		a = b;
	}

	return a;
}

function joinData (id, a, b, key, on, type = "inner") {
	let error = false,
		result = [],
		errorMsg;

	function join (left, right, ids, include = false, reverse = false) {
		let keys = Object.keys(right[0]),
			fn;

		fn = !reverse ? (x, i) => {
			return x[on] === i[key];
		} : (x, i) => {
			return x[key] === i[on];
		};

		each(left, i => {
			let comp = {},
				c;

			c = right.filter(x => {
				return fn(x, i);
			});

			if (c.length > 1) {
				error = true;
				errorMsg = "More than one record found on " + i[on];
				return false;
			} else if (c.length === 1) {
				[i, c[0]].forEach((x, idx) => {
					iterate(x, (v, k) => {
						comp[ids[idx] + "_" + k] = v;
					});
				});
			} else if (include) {
				iterate(i, (v, k) => {
					comp[ids[0] + "_" + k] = v;
				});

				keys.forEach(k => {
					comp[ids[1] + "_" + k] = null;
				});
			}

			if (Object.keys(comp).length > 0) {
				result.push(comp);
			}
		});
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
	let data = JSON.parse(ev.data),
		cmd = data.cmd,
		result;

	if (cmd === "index") {
		result = createIndexes(data.records, data.index, data.key, data.delimiter, data.pattern);
	}

	if (cmd === "join") {
		result = joinData(data.ids, data.records[0], data.records[1], data.key, data.on, data.type);
	}

	postMessage(JSON.stringify(result));
}

function patch (ogdata = {}, data = {}, key = "", overwrite = false) {
	let result = [];

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
	let idx;

	if (!indice) {
		index.forEach(i => {
			let lidx = keyIndex(i, data, delimiter, pattern);

			if (lidx !== undefined && lidx !== null) {
				setIndexValue(indexes.get(i), lidx, key);
			}
		});
	} else {
		idx = keyIndex(indice, data, delimiter, pattern);

		if (idx !== undefined && idx !== null) {
			setIndexValue(indexes.get(indice), idx, key);
		}
	}
}

function toObjekt (arg) {
	let result = {};

	arg.forEach((value, key) => {
		result[key] = value;
	});

	return result;
}

function uuid () {
	return s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s();
}
