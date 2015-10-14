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
		result = keys.map(function (i) {
			return String(data[i]).replace(new RegExp(pattern, "g"), "").toLowerCase();
		}).join(delimiter);
	} else {
		result = data[key];
	}

	return result;
}

function delIndex (index, indexes, delimiter, key, data, pattern) {
	index.forEach(function (i) {
		let idx = indexes.get(i),
			value = keyIndex(i, data, delimiter, pattern),
			o;

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
	let result = {};

	indexes.forEach(function (i) {
		result[i] = {};
	});

	records.forEach(function (i) {
		let lkey = i[key];

		if (lkey !== undefined) {
			indexes.forEach(function (index) {
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
		Object.keys(obj).forEach(function (i) {
			fn.call(obj, obj[i], i);
		});
	} else {
		obj.forEach(fn);
	}
}

function merge (a, b) {
	let c = a !== undefined ? clone(a) : a,
		d = b !== undefined ? clone(b) : b;

	if ((c instanceof Object) && (d instanceof Object)) {
		Object.keys(d).forEach(function (i) {
			if ((c[i] instanceof Object) && (d[i] instanceof Object)) {
				c[i] = merge(c[i], d[i]);
			} else if ((c[i] instanceof Array) && (d[i] instanceof Array)) {
				c[i] = c[i].concat(d[i]);
			} else {
				c[i] = d[i];
			}
		});
	} else if ((c instanceof Array) && (d instanceof Array)) {
		c = c.concat(d);
	} else {
		c = d;
	}

	return c;
}

function onmessage (ev) {
	let data = JSON.parse(ev.data),
		cmd = data.cmd,
		result;

	if (cmd === "index") {
		result = createIndexes(data.records, data.index, data.key, data.delimiter, data.pattern);
	}

	if (cmd === "join") {
		result = joinData(data.records[0], data.records[1], data.key, data.on, data.type);
	}

	postMessage(JSON.stringify(result));
}

function joinData (a, b, key, on, type = "inner") {
	let error = false,
		errorMsg, result;

	if (type === "inner") {
		result = [];

		each(a, function (i) {
			let c = b.filter(function (x) {
				return x[on] === i[key];
			});

			if (c.length > 1) {
				error = true;
				errorMsg = "More than one record found on " + i[on];
				return false;
			} else if (c.length === 1) {
				result.push(merge(i, c[0]));
			}
		});
	}

	if (type === "outer") {
		result = [];
	}

	if (type === "left") {
		result = [];
	}

	if (type === "right") {
		result = [];
	}

	return !error ? result : errorMsg;
}

function patch (ogdata = {}, data = {}, key = "", overwrite = false) {
	let result = [];

	if (overwrite) {
		iterate(ogdata, function (v, k) {
			if (k !== key && data[k] === undefined) {
				result.push({op: "remove", path: "/" + k});
			}
		});
	}

	iterate(data, function (v, k) {
		if (k !== key && ogdata[k] === undefined) {
			result.push({op: "add", path: "/" + k, value: v});
		} else if (JSON.stringify(ogdata[k]) !== JSON.stringify(v)) {
			result.push({op: "replace", path: "/" + k, value: v});
		}
	});

	return result;
}

function s () {
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

function setIndexValue (index, key, value) {
	if (!index.has(key)) {
		index.set(key, new Set());
	}

	index.get(key).add(value);
}

function setIndex (index, indexes, delimiter, key, data, indice, pattern) {
	if (!indice) {
		index.forEach(function (i) {
			setIndexValue(indexes.get(i), keyIndex(i, data, delimiter, pattern), key);
		});
	} else {
		setIndexValue(indexes.get(indice), keyIndex(indice, data, delimiter, pattern), key);
	}
}

function toObjekt (arg) {
	let result = {};

	arg.forEach(function (value, key) {
		result[key] = value;
	});

	return result;
}

function uuid () {
	return (s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s());
}
