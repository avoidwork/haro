function clone (arg) {
	return JSON.parse(JSON.stringify(arg));
}

function deferred () {
	let promise, resolver, rejecter;

	promise = new Promise(function (resolve, reject) {
		resolver = resolve;
		rejecter = reject;
	});

	return {resolve: resolver, reject: rejecter, promise: promise};
}

function merge (a, b) {
	let c = clone(a),
		d = clone(b);

	if (typeof c === "object") {
		Object.keys(d).forEach(function (i) {
			c[i] = d[i];
		});
	} else {
		c = d;
	}

	return c;
}

let r = [8, 9, "a", "b"];

function s () {
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

function uuid () {
	return (s() + s() + "-" + s() + "-4" + s().substr(0, 3) + "-" + r[Math.floor(Math.random() * 4)] + s().substr(0, 3) + "-" + s() + s() + s());
}