import assert from "node:assert";
import {haro} from "../dist/haro.cjs";
import {readFile} from 'node:fs/promises';

const fileUrl = new URL("./data.json", import.meta.url);
const data = JSON.parse(await readFile(fileUrl, "utf8"));
const odata = data.map(i => [i.guid, i]);

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
		store.set(null, data[0]);
		assert.strictEqual(store.size, 1);
		assert.strictEqual(store.data.size, 1);
		store.clear();
	});

	it("should have a matching size (batch)", function () {
		store.batch(data, "set");
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

describe("Read", function () {
	const store = haro(null, {
		key: "guid",
		index: ["name", "age", "age|gender", "company", "name", "tags", "company|tags"],
		logging: false
	});

	it("should return an array (tuple) by default", function () {
		const arg = store.set(null, data[0]),
			record = store.get(arg[0]);

		assert.strictEqual(store.size, 1);
		assert.strictEqual(store.data.size, 1);
		assert.strictEqual(Object.keys(record[1]).length, 19);
		assert.strictEqual(record[1].name, "Decker Merrill");
		store.clear();
	});

	it("should return a record when specified", function () {
		const arg = store.set(null, data[0]),
			record = store.get(arg[0], true);

		assert.strictEqual(store.size, 1);
		assert.strictEqual(store.data.size, 1);
		assert.strictEqual(Object.keys(record).length, 19);
		assert.strictEqual(record.name, "Decker Merrill");
		store.clear();
	});

	it("should return 'null' for invalid 'key'", function () {
		assert.strictEqual(store.get("abc") instanceof Array, true);
		assert.strictEqual(store.get("abc")[0], "abc");
		assert.strictEqual(store.get("abc")[1], null);
		assert.strictEqual(store.get("abc", true), null);
	});

	it("should return immutable records", function () {
		const arg = store.set(null, data[0]);

		store.get(arg[0], true).guid += "a";
		assert.strictEqual(store.get(arg[0])[1].guid, arg[0]);
		store.clear();
	});

	it("should be able to return records via index", function () {
		store.batch(data, "set");
		assert.strictEqual(store.find({name: "Decker Merrill"}).length, 1);
		assert.strictEqual(store.find({age: 20}).length, 2);
		assert.strictEqual(store.indexes.get("age").get(20).size, 2);
		assert.strictEqual(store.find({age: 20, gender: "male"}).length, 1);
		assert.strictEqual(store.find({gender: "male", age: 20}).length, 1);
		assert.strictEqual(store.find({age: 50}).length, 0);
		assert.strictEqual(store.find({agez: 1}).length, 0);
		assert.strictEqual(store.limit(0, 3)[2][1].guid, "f34d994b-24eb-4553-adf7-8f61e7ef8741");
		store.del(store.find({age: 20, gender: "male"})[0][0]);
		assert.strictEqual(store.find({age: 20, gender: "male"}).length, 0);
		assert.strictEqual(store.indexes.get("age").get(20).size, 1);
		assert.strictEqual(store.limit(0, 3)[2][1].guid, "a94c8560-7bfd-42ec-a759-cbd5899b33c0");
		store.clear();
	});

	it("should support 'toArray()'", function () {
		store.batch(data, "set");
		assert.strictEqual(store.toArray().length, 6);
		assert.strictEqual(Object.isFrozen(store.toArray()), true);
		assert.strictEqual(Object.isFrozen(store.toArray(false)), false);
		store.clear();
	});

	it("should be sortable via index", function () {
		store.batch(data, "set");

		// Sorting age descending
		const arg = store.sort(function (a, b) {
			return a.age > b.age ? -1 : a.age === b.age ? 0 : 1;
		});

		assert.strictEqual(arg[0].guid, "a94c8560-7bfd-42ec-a759-cbd5899b33c0");
	});

	it("should be able to create indexes while sorting", function () {
		store.batch(data, "set");
		assert.strictEqual(store.sortBy("company")[0][1].company, "Coash");
		store.clear();
	});

	it("should return an empty array when searching when not indexed", function () {
		store.batch(data, "set");
		assert.strictEqual(store.search(new RegExp(".*de.*", "i"), "x").length, 0);
		store.clear();
	});

	it("should return an array when searching an index", function () {
		store.batch(data, "set");

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

	it("should return an array when dumping indexes", function () {
		store.batch(data, "set");

		const ldata = store.dump("indexes");

		assert.strictEqual(Object.keys(ldata).length, 6);
		assert.strictEqual(Object.isFrozen(ldata), false);
		store.clear();
	});

	it("should return an array when dumping records", function () {
		store.batch(data, "set");

		const ldata = store.dump();

		assert.strictEqual(Object.keys(ldata).length, data.length);
		assert.strictEqual(Object.isFrozen(ldata), false);
		store.clear();
	});

	it("should return array of records where attributes match predicate", function () {
		store.batch(data, "set");
		assert.strictEqual(store.where({company: "Insectus", tags: "occaecat"}).length, 1);
		assert.strictEqual(store.where({company: "Insectus", tags: ["sunt", "aaaa"]}, false, "&&").length, 0);
		assert.strictEqual(store.where({company: /insectus/i, tags: "occaecat"}).length, 1);
		assert.strictEqual(store.where({tags: ["sunt", "veniam"]}, false, "&&").length, 1);
		assert.strictEqual(store.where({company: "Insectus", tags: "aaaaa"}).length, 0, "Should be '0'");
		assert.strictEqual(store.where({}).length, 0, "Should be '0'");
	});
});

describe("Update", function () {
	const store = haro(null, {key: "guid", logging: false, versioning: true});

	it("should have a matching size (single)", function () {
		let arg = store.set(null, data[0]);

		assert.strictEqual(arg[1].name, "Decker Merrill");
		arg = store.set(arg[0], {name: "John Doe"});
		assert.strictEqual(arg[1].name, "John Doe");
		assert.strictEqual(store.versions.get(arg[0]).size, 1);
		store.clear();
	});

	it("should have a matching size (batch)", function () {
		store.batch(data, "set");
		assert.strictEqual(store.size, 6);
		assert.strictEqual(store.data.size, 6);
		assert.strictEqual(store.registry.length, 6);
		store.batch(data, "set");
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

	it("should be support overriding indexes", function () {
		store.batch(data, "set");
		store.override([
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
			]]
		], "indexes");

		assert.strictEqual(store.indexes.size, 3);
		assert.strictEqual(store.indexes.get("name").size, 6);
		assert.strictEqual(store.indexes.get("age").size, 4);
		assert.strictEqual(store.indexes.get("age").get(20).size, 2);
		assert.strictEqual(store.indexes.get("age|gender").size, 5);
	});

	it("should be support overriding records", function () {
		store.override(odata, "records");
		assert.strictEqual(store.size, 6);
		assert.strictEqual(store.registry.length, 6);
		assert.strictEqual(store.data.size, 6);
		assert.strictEqual(store.data.get(store.registry[0], true).guid, data[0].guid);
	});
});

describe("Delete", function () {
	const store = haro(null, {key: "guid", logging: false, versioning: true});

	it("should throw an error deleting an invalid key", function () {
		assert.throws(() => store.del("invalid"), Error);
	});

	it("should have a matching size (single)", function () {
		const arg = store.set(null, data[0]);

		assert.strictEqual(arg[1].name, "Decker Merrill");
		store.del(arg[0]);
		assert.strictEqual(store.size, 0);
		assert.strictEqual(store.data.size, 0);
		store.clear();
	});

	it("should have a matching size (batch)", function () {
		const arg = store.batch(data, "set");

		assert.strictEqual(arg[0][1].name, "Decker Merrill");
		store.batch([arg[0][0], arg[2][0]], "del");
		assert.strictEqual(store.size, 4);
		assert.strictEqual(store.data.size, 4);
	});
});

describe("Filter", function () {
	const store = haro(null, {key: "guid", logging: false});

	it("should throw an error when not providing the function", function () {
		assert.throws(() => store.filter(undefined, true), Error);
	});

	it("should filter to a record (single)", function () {
		store.set(null, data[0]);
		assert.strictEqual(store.filter((arg) => arg.name === "Decker Merrill", true)[0].name, "Decker Merrill");
		assert.strictEqual(store.filter((arg) => arg.name === "Decker Merrill", false)[0][1].name, "Decker Merrill");
	});
});

describe("Has", function () {
	const store = haro(null, {key: "guid", logging: false});

	it("return a boolean", function () {
		store.set(null, data[0]);
		assert.strictEqual(store.has("abc"), false);
		assert.strictEqual(store.has(Array.from(store.keys())[0]), true);
	});
});

describe("Map", function () {
	const store = haro(null, {key: "guid", logging: false});

	it("should throw an error when not providing the function", function () {
		assert.throws(() => store.map(undefined, true), Error);
	});

	it("should map the records", function () {
		store.set(null, data[0]);
		assert.strictEqual(store.map(arg => arg.name, true)[0], "Decker Merrill");
	});
});
