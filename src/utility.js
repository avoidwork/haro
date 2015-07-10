function clone (arg) {
	return JSON.parse(JSON.stringify(arg));
}

function concatURI (left, right) {
	return left.replace(regex.querystring, "").replace(regex.endslash, "") + (right ? "/" + right : "");
}

function deferred () {
	let promise, resolver, rejecter;

	promise = new Promise(function (resolve, reject) {
		resolver = resolve;
		rejecter = reject;
	});

	return {resolve: resolver, reject: rejecter, promise: promise};
}

function keyIndex (key, data, delimiter) {
	let keys = key.split(delimiter).sort(),
		result;

	if (keys.length > 1) {
		result = keys.map(function (i) {
			return String(data[i]).replace(/\.|-|\s*|\t*/g, "").toLowerCase();
		}).join(delimiter);
	} else {
		result = data[key];
	}

	return result;
}

function delIndex (index, indexes, delimiter, key, data) {
	index.forEach(function (i) {
		let idx = indexes.get(i),
			value = keyIndex(i, data, delimiter),
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
	let c = clone(a),
		d = clone(b);

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

function setIndex (index, indexes, delimiter, key, data, indice) {
	if (!indice) {
		index.forEach(function (i) {
			setIndexValue(indexes.get(i), keyIndex(i, data, delimiter), key);
		});
	} else {
		setIndexValue(indexes.get(indice), keyIndex(indice, data, delimiter), key);
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
