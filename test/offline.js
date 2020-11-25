const path = require("path"),
	assert = require("assert"),
	{haro} = require(path.join(__dirname, "..", "dist", "haro.cjs.js")),
	data = require(path.join(__dirname, "data.json")),
	odata = data.map(i => [i.guid, i]);

describe("Starting state", function () {
	const store = haro(null, {key: "guid", logging: false});

	it("should be empty", function () {
		assert.strictEqual(store.size, 0);
		assert.strictEqual(store.data.size, 0);
	});
});

describe("Create", function () {
	const store = haro(null, {key: "guid", logging: false});

	it("should have a matching size (single)", function () {
		return store.set(null, data[0]).then(function () {
			assert.strictEqual(store.size, 1);
			assert.strictEqual(store.data.size, 1);
			store.clear();
		});
	});

	it("should have a matching size (batch)", function () {
		return store.batch(data, "set").then(function () {
			assert.strictEqual(store.size, 6);
			assert.strictEqual(store.data.size, 6);
			assert.strictEqual(store.registry.length, 6);
			assert.strictEqual(store.limit(0, 2)[1][0], store.get(store.registry[1])[0]);
			assert.strictEqual(store.limit(2, 4)[1][0], store.get(store.registry[3])[0]);
			assert.strictEqual(store.limit(5, 10).length, 1);
			assert.strictEqual(store.filter(function (i) {
				return (/decker/i).test(i.name);
			})[0].length, 2);
			assert.strictEqual(store.filter(function (i) {
				return (/decker/i).test(i.name);
			}, true).length, 1);
			assert.strictEqual(store.map(function (i) {
				i.name = "John Doe";

				return i;
			}).length, 6);
			assert.strictEqual(store.map(function (i) {
				i.name = "John Doe";

				return i;
			})[0].name, "John Doe");
		});
	});
});

describe("Read", function () {
	const store = haro(null, {key: "guid", index: ["name", "age", "age|gender", "company", "name", "tags", "company|tags"], logging: false});

	it("should return an array (tuple) by default", function () {
		return store.set(null, data[0]).then(function (arg) {
			const record = store.get(arg[0]);

			assert.strictEqual(store.size, 1);
			assert.strictEqual(store.data.size, 1);
			assert.strictEqual(Object.keys(record[1]).length, 19);
			assert.strictEqual(record[1].name, "Decker Merrill");
			store.clear();
		});
	});

	it("should return a record when specified", function () {
		return store.set(null, data[0]).then(function (arg) {
			const record = store.get(arg[0], true);

			assert.strictEqual(store.size, 1);
			assert.strictEqual(store.data.size, 1);
			assert.strictEqual(Object.keys(record).length, 19);
			assert.strictEqual(record.name, "Decker Merrill");
			store.clear();
		});
	});

	it("should return 'null' for invalid 'key'", function () {
		assert.strictEqual(store.get("abc") instanceof Array, true);
		assert.strictEqual(store.get("abc")[0], "abc");
		assert.strictEqual(store.get("abc")[1], null);
		assert.strictEqual(store.get("abc", true), null);
	});

	it("should return immutable records", function () {
		return store.set(null, data[0]).then(function (arg) {
			store.get(arg[0], true).guid += "a";
			assert.strictEqual(store.get(arg[0])[1].guid, arg[0]);
			store.clear();
		});
	});

	it("should be able to return records via index", function () {
		return store.batch(data, "set").then(function (args) {
			assert.strictEqual(store.find({name: "Decker Merrill"}).length, 1);
			assert.strictEqual(store.find({age: 20}).length, 2);
			assert.strictEqual(store.indexes.get("age").get(20).size, 2);
			assert.strictEqual(store.find({age: 20, gender: "male"}).length, 1);
			assert.strictEqual(store.find({gender: "male", age: 20}).length, 1);
			assert.strictEqual(store.find({age: 50}).length, 0);
			assert.strictEqual(store.find({agez: 1}).length, 0);
			assert.strictEqual(store.limit(0, 3)[2][1].guid, "f34d994b-24eb-4553-adf7-8f61e7ef8741");

			return args;
		}).then(function () {
			return store.del(store.find({age: 20, gender: "male"})[0][0]);
		}).then(function () {
			assert.strictEqual(store.find({age: 20, gender: "male"}).length, 0);
			assert.strictEqual(store.indexes.get("age").get(20).size, 1);
			assert.strictEqual(store.limit(0, 3)[2][1].guid, "a94c8560-7bfd-42ec-a759-cbd5899b33c0");
			store.clear();
		});
	});

	it("should support 'toArray()'", function () {
		return store.batch(data, "set").then(function () {
			assert.strictEqual(store.toArray().length, 6);
			assert.strictEqual(Object.isFrozen(store.toArray()), true);
			assert.strictEqual(Object.isFrozen(store.toArray(false)), false);
			store.clear();
		});
	});

	it("should be sortable via index", function () {
		return store.batch(data, "set").then(function () {
			// Sorting age descending
			return store.sort(function (a, b) {
				return a.age > b.age ? -1 : a.age === b.age ? 0 : 1;
			});
		}).then(function (arg) {
			assert.strictEqual(arg[0].guid, "a94c8560-7bfd-42ec-a759-cbd5899b33c0");
		});
	});

	it("should be able to create indexes while sorting", function () {
		return store.batch(data, "set").then(function () {
			assert.strictEqual(store.sortBy("company")[0][1].company, "Coash");
			store.clear();
		});
	});

	it("should return an empty array when searching when not indexed", function () {
		return store.batch(data, "set").then(function () {
			assert.strictEqual(store.search(new RegExp(".*de.*", "i"), "x").length, 0);
			store.clear();
		});
	});

	it("should return an array when searching an index", function () {
		return store.batch(data, "set").then(function () {
			const result1 = store.search(new RegExp(".*de.*", "i")),
				result2 = store.search(20, "age"),
				result3 = store.search(/velit/, "tags");

			assert.strictEqual(result1.length, 2);
			assert.strictEqual(result1[0][1].name, "Decker Merrill");
			assert.strictEqual(result2.length, 2);
			assert.strictEqual(result2[0][1].name, "Decker Merrill");
			assert.strictEqual(result3.length, 1);
			assert.strictEqual(result3[0][1].name, "Decker Merrill");
			store.clear();
		});
	});

	it("should return an array when dumping indexes", function () {
		return store.batch(data, "set").then(function () {
			const ldata = store.dump("indexes");

			assert.strictEqual(Object.keys(ldata).length, 6);
			assert.strictEqual(Object.isFrozen(ldata), false);
			store.clear();
		});
	});

	it("should return an array when dumping records", function () {
		return store.batch(data, "set").then(function () {
			const ldata = store.dump();

			assert.strictEqual(Object.keys(ldata).length, data.length);
			assert.strictEqual(Object.isFrozen(ldata), false);
			store.clear();
		});
	});

	it("should return array of records where attributes match predicate", function () {
		return store.batch(data, "set").then(function () {
			assert.strictEqual(store.where({company: "Insectus", tags: "occaecat"}).length, 1);
			assert.strictEqual(store.where({company: "Insectus", tags: ["sunt", "aaaa"]}, false, "&&").length, 0);
			assert.strictEqual(store.where({company: /insectus/i, tags: "occaecat"}).length, 1);
			assert.strictEqual(store.where({tags: ["sunt", "veniam"]}, false, "&&").length, 1);
			assert.strictEqual(store.where({company: "Insectus", tags: "aaaaa"}).length, 0, "Should be '0'");
			assert.strictEqual(store.where({}).length, 0, "Should be '0'");
		});
	});
});

describe("Update", function () {
	const store = haro(null, {key: "guid", logging: false, versioning: true});

	it("should have a matching size (single)", function () {
		return store.set(null, data[0]).then(function (arg) {
			assert.strictEqual(arg[1].name, "Decker Merrill");

			return arg;
		}).then(function (arg) {
			return store.set(arg[0], {name: "John Doe"});
		}).then(function (arg) {
			assert.strictEqual(arg[1].name, "John Doe");
			assert.strictEqual(store.versions.get(arg[0]).size, 1);
			store.clear();
		});
	});

	it("should have a matching size (batch)", function () {
		return store.batch(data, "set").then(function () {
			assert.strictEqual(store.size, 6);
			assert.strictEqual(store.data.size, 6);
			assert.strictEqual(store.registry.length, 6);

			return store.batch(data, "set");
		}).then(function () {
			assert.strictEqual(store.size, 6);
			assert.strictEqual(store.data.size, 6);
			assert.strictEqual(store.registry.length, 6);
			assert.strictEqual(store.limit(0, 2)[1][0], store.get(store.registry[1])[0]);
			assert.strictEqual(store.limit(2, 4)[1][0], store.get(store.registry[3])[0]);
			assert.strictEqual(store.limit(5, 10).length, 1);
			assert.strictEqual(store.filter(function (i) {
				return (/decker/i).test(i.name);
			}).length, 1);
			assert.strictEqual(store.map(function (i) {
				i.name = "John Doe";

				return i;
			}).length, 6);
			assert.strictEqual(store.map(function (i) {
				i.name = "John Doe";

				return i;
			})[0].name, "John Doe");
			store.clear();
		});
	});

	it("should be support overriding indexes", function () {
		return store.batch(data, "set").then(function () {
			return store.override([
				["name", [
					["Decker Merrill", ["cfbfe5d1-451d-47b1-96c4-8e8e83fe9cfd"]],
					["Waters Yates", ["cbaa7d2f-b098-4347-9437-e1f879c9232a"]],
					["Elnora Durham", ["1adf114d-f0ab-4a29-9d28-47cd4a627127"]],
					["Krista Adkins", ["c5849290-afa2-4a33-a23f-64253f0d9ad9"]],
					["Mcneil Weiss", ["eccdbfd9-223f-4a85-a791-4567fecbeb44"]],
					["Leann Sosa", ["47ce98a7-3c4c-4175-9a9a-f32af8392065"]]
				]],
				["age", [
					[20, ["cfbfe5d1-451d-47b1-96c4-8e8e83fe9cfd",
						"47ce98a7-3c4c-4175-9a9a-f32af8392065"]],
					[24, ["cbaa7d2f-b098-4347-9437-e1f879c9232a",
						"eccdbfd9-223f-4a85-a791-4567fecbeb44"]],
					[26, ["1adf114d-f0ab-4a29-9d28-47cd4a627127"]],
					[29, ["c5849290-afa2-4a33-a23f-64253f0d9ad9"]]
				]],
				["age|gender", [
					["20|male", ["cfbfe5d1-451d-47b1-96c4-8e8e83fe9cfd"]],
					["24|male", ["cbaa7d2f-b098-4347-9437-e1f879c9232a",
						"eccdbfd9-223f-4a85-a791-4567fecbeb44"]],
					["26|female", ["1adf114d-f0ab-4a29-9d28-47cd4a627127"]],
					["29|female", ["c5849290-afa2-4a33-a23f-64253f0d9ad9"]],
					["20|female", ["47ce98a7-3c4c-4175-9a9a-f32af8392065"]]
				]
				]], "indexes");
		}).then(function () {
			assert.strictEqual(store.indexes.size, 3);
			assert.strictEqual(store.indexes.get("name").size, 6);
			assert.strictEqual(store.indexes.get("age").size, 4);
			assert.strictEqual(store.indexes.get("age").get(20).size, 2);
			assert.strictEqual(store.indexes.get("age|gender").size, 5);
		});
	});

	it("should be support overriding records", function () {
		return store.override(odata, "records").then(function () {
			assert.strictEqual(store.size, 6);
			assert.strictEqual(store.registry.length, 6);
			assert.strictEqual(store.data.size, 6);
			assert.strictEqual(store.data.get(store.registry[0], true).guid, data[0].guid);
		});
	});
});

describe("Delete", function () {
	const store = haro(null, {key: "guid", logging: false});

	it("should have a matching size (single)", function () {
		return store.set(null, data[0]).then(function (arg) {
			assert.strictEqual(arg[1].name, "Decker Merrill");

			return arg;
		}).then(function (arg) {
			return store.del(arg[0]);
		}).then(function () {
			assert.strictEqual(store.size, 0);
			assert.strictEqual(store.data.size, 0);
			store.clear();
		});
	});

	it("should have a matching size (batch)", function () {
		return store.batch(data, "set").then(function (arg) {
			assert.strictEqual(arg[0][1].name, "Decker Merrill");

			return arg;
		}).then(function (arg) {
			return store.batch([arg[0][0], arg[2][0]], "del");
		}).then(function () {
			assert.strictEqual(store.size, 4);
			assert.strictEqual(store.data.size, 4);
		});
	});
});
