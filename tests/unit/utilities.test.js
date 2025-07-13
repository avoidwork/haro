import assert from "node:assert";
import {describe, it, beforeEach} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Utility Methods", () => {
	let store;

	beforeEach(() => {
		store = new Haro();
	});

	describe("clone()", () => {
		it("should create deep clone of object", () => {
			const original = {name: "John", tags: ["admin", "user"]};
			const cloned = store.clone(original);

			cloned.tags.push("new");
			assert.strictEqual(original.tags.length, 2);
			assert.strictEqual(cloned.tags.length, 3);
		});

		it("should clone primitives", () => {
			assert.strictEqual(store.clone("string"), "string");
			assert.strictEqual(store.clone(123), 123);
			assert.strictEqual(store.clone(true), true);
		});
	});

	describe("each()", () => {
		it("should iterate over array with callback", () => {
			const items = ["a", "b", "c"];
			const results = [];

			store.each(items, (item, index) => {
				results.push(`${index}:${item}`);
			});

			assert.deepStrictEqual(results, ["0:a", "1:b", "2:c"]);
		});

		it("should handle empty array", () => {
			const results = [];
			store.each([], () => results.push("called"));
			assert.strictEqual(results.length, 0);
		});
	});

	describe("forEach()", () => {
		beforeEach(() => {
			store.set("user1", {id: "user1", name: "John"});
			store.set("user2", {id: "user2", name: "Jane"});
		});

		it("should iterate over all records", () => {
			const results = [];
			store.forEach((value, key) => {
				results.push(`${key}:${value.name}`);
			});

			assert.strictEqual(results.length, 2);
			assert.strictEqual(results.includes("user1:John"), true);
			assert.strictEqual(results.includes("user2:Jane"), true);
		});
	});

	describe("map()", () => {
		beforeEach(() => {
			store.set("user1", {id: "user1", name: "John", age: 30});
			store.set("user2", {id: "user2", name: "Jane", age: 25});
		});

		it("should transform all records", () => {
			const results = store.map(record => record.name);
			assert.strictEqual(results.length, 2);
			assert.strictEqual(results[0][1], "John");
			assert.strictEqual(results[1][1], "Jane");
		});

		it("should throw error for non-function mapper", () => {
			assert.throws(() => {
				store.map("not a function");
			}, /Invalid function/);
		});
	});

	describe("reduce()", () => {
		beforeEach(() => {
			store.set("user1", {id: "user1", age: 30});
			store.set("user2", {id: "user2", age: 25});
		});

		it("should reduce all records to single value", () => {
			const totalAge = store.reduce((sum, record) => sum + record.age, 0);
			assert.strictEqual(totalAge, 55);
		});

		it("should use default accumulator", () => {
			const names = store.reduce((acc, record) => {
				acc.push(record.id);

				return acc;
			});
			assert.deepStrictEqual(names, ["user1", "user2"]);
		});
	});

	describe("merge()", () => {
		it("should merge objects", () => {
			const a = {x: 1, y: 2};
			const b = {y: 3, z: 4};
			const result = store.merge(a, b);

			assert.deepStrictEqual(result, {x: 1, y: 3, z: 4});
		});

		it("should concatenate arrays", () => {
			const a = [1, 2];
			const b = [3, 4];
			const result = store.merge(a, b);

			assert.deepStrictEqual(result, [1, 2, 3, 4]);
		});

		it("should override arrays when override is true", () => {
			const a = [1, 2];
			const b = [3, 4];
			const result = store.merge(a, b, true);

			assert.deepStrictEqual(result, [3, 4]);
		});

		it("should replace primitives", () => {
			const result = store.merge("old", "new");
			assert.strictEqual(result, "new");
		});
	});

	describe("uuid()", () => {
		it("should generate valid UUID", () => {
			const id = store.uuid();
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			assert.strictEqual(uuidRegex.test(id), true);
		});

		it("should generate unique UUIDs", () => {
			const id1 = store.uuid();
			const id2 = store.uuid();
			assert.notStrictEqual(id1, id2);
		});
	});

	describe("freeze()", () => {
		it("should freeze multiple arguments", () => {
			const obj1 = {a: 1};
			const obj2 = {b: 2};
			const result = store.freeze(obj1, obj2);

			assert.strictEqual(Object.isFrozen(result), true);
			assert.strictEqual(Object.isFrozen(result[0]), true);
			assert.strictEqual(Object.isFrozen(result[1]), true);
		});
	});

	describe("list()", () => {
		it("should convert record to [key, value] format", () => {
			const record = {id: "user1", name: "John"};
			const result = store.list(record);

			assert.deepStrictEqual(result, ["user1", record]);
		});

		it("should freeze result in immutable mode", () => {
			const immutableStore = new Haro({immutable: true});
			const record = {id: "user1", name: "John"};
			const result = immutableStore.list(record);

			assert.strictEqual(Object.isFrozen(result), true);
		});
	});

	describe("limit()", () => {
		beforeEach(() => {
			for (let i = 0; i < 10; i++) {
				store.set(`user${i}`, {id: `user${i}`, name: `User${i}`});
			}
		});

		it("should return limited subset of records", () => {
			const results = store.limit(0, 5);
			assert.strictEqual(results.length, 5);
		});

		it("should support offset", () => {
			const results = store.limit(5, 3);
			assert.strictEqual(results.length, 3);
			assert.strictEqual(results[0][0], "user5");
		});

		it("should handle offset beyond data size", () => {
			const results = store.limit(20, 5);
			assert.strictEqual(results.length, 0);
		});
	});

	describe("sort()", () => {
		beforeEach(() => {
			store.set("user1", {id: "user1", name: "Charlie", age: 30});
			store.set("user2", {id: "user2", name: "Alice", age: 25});
			store.set("user3", {id: "user3", name: "Bob", age: 35});
		});

		it("should sort records with comparator function", () => {
			const results = store.sort((a, b) => a.name.localeCompare(b.name));
			assert.strictEqual(results[0].name, "Alice");
			assert.strictEqual(results[1].name, "Bob");
			assert.strictEqual(results[2].name, "Charlie");
		});

		it("should return frozen results when frozen=true", () => {
			const results = store.sort((a, b) => a.age - b.age, true);
			assert.strictEqual(Object.isFrozen(results), true);
		});
	});

	describe("toArray()", () => {
		beforeEach(() => {
			store.set("user1", {id: "user1", name: "John"});
			store.set("user2", {id: "user2", name: "Jane"});
		});

		it("should convert store to array", () => {
			const results = store.toArray();
			assert.strictEqual(results.length, 2);
			assert.strictEqual(results[0].name, "John");
			assert.strictEqual(results[1].name, "Jane");
		});

		it("should return frozen array in immutable mode", () => {
			const immutableStore = new Haro({immutable: true});
			immutableStore.set("user1", {id: "user1", name: "John"});
			const results = immutableStore.toArray();

			assert.strictEqual(Object.isFrozen(results), true);
			assert.strictEqual(Object.isFrozen(results[0]), true);
		});
	});

	describe("entries(), keys(), values()", () => {
		beforeEach(() => {
			store.set("user1", {id: "user1", name: "John"});
			store.set("user2", {id: "user2", name: "Jane"});
		});

		it("should return entries iterator", () => {
			const entries = Array.from(store.entries());
			assert.strictEqual(entries.length, 2);
			assert.strictEqual(entries[0][0], "user1");
			assert.strictEqual(entries[0][1].name, "John");
		});

		it("should return keys iterator", () => {
			const keys = Array.from(store.keys());
			assert.strictEqual(keys.length, 2);
			assert.strictEqual(keys.includes("user1"), true);
			assert.strictEqual(keys.includes("user2"), true);
		});

		it("should return values iterator", () => {
			const values = Array.from(store.values());
			assert.strictEqual(values.length, 2);
			assert.strictEqual(values[0].name, "John");
			assert.strictEqual(values[1].name, "Jane");
		});
	});
});
