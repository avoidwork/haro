	function clone (arg) {
		return JSON.parse(JSON.stringify(arg, null, 0));
	}

	function each (arr, fn) {
		for (const item of arr.entries()) {
			fn(item[1], item[0]);
		}

		return arr;
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
