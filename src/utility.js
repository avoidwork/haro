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

function iterate (obj, fn) {
	Object.keys(obj).forEach(function (i) {
		fn.call(obj, obj[i], i);
	});
}

function keyIndex (key, data, delimiter) {
	let keys = key.split(delimiter).sort(),
		result;

	if (keys.length > 1) {
		result = keys.map(function (i) {
			return String(data[i]);
		}).join(delimiter);
	} else {
		result = data[key];
	}

	return result;
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

function patch (data = {}, ogdata = {}, overwrite = false) {
	let result = [];

	if (overwrite) {
		iterate(ogdata, (value, key) => {
			if (key !== this.key && data[key] === undefined) {
				result.push({op: "remove", path: "/" + key});
			}
		});
	}

	iterate(data, (value, key) => {
		if (key !== this.key && ogdata[key] === undefined) {
			result.push({op: "add", path: "/" + key, value: value});
		} else if (JSON.stringify(ogdata[key]) !== JSON.stringify(value)) {
			result.push({op: "replace", path: "/" + key, value: value});
		}
	});

	return result;
}

const r = [8, 9, "a", "b"];

function s () {
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

function uuid () {
	return (s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s());
}
