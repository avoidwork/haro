import assert from "node:assert";
import {describe, it, beforeEach} from "node:test";
import {Haro} from "../../src/haro.js";

describe("Utility Methods", () => {
	let store;

	beforeEach(() => {
		store = new Haro();
	});

	describe("forEach()", () => {
		beforeEach(() => {
			store.set({id: "user1", name: "John"});
			store.set({id: "user2", name: "Jane"});
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
			store.set({id: "user1", name: "John", age: 30});
			store.set({id: "user2", name: "Jane", age: 25});
		});

		it("should transform all records", () => {
			const results = store.map(record => record.name);
			assert.strictEqual(results.length, 2);
			assert.strictEqual(results[0], "John");
			assert.strictEqual(results[1], "Jane");
		});

		it("should throw error for non-function mapper", () => {
			assert.throws(() => {
				store.map("not a function");
			}, /Invalid function/);
		});
	});

	describe("reduce()", () => {
		beforeEach(() => {
			store.set({id: "user1", age: 30});
			store.set({id: "user2", age: 25});
		});

		it("should reduce all records to single value", () => {
			const totalAge = store.reduce((sum, record) => sum + record.age, 0);
			assert.strictEqual(totalAge, 55);
		});

		it("should use default accumulator", () => {
			const names = store.reduce((acc, record) => {
				acc.push(record.id);

				return acc;
			}, []);
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

	describe("limit()", () => {
		beforeEach(() => {
			for (let i = 0; i < 10; i++) {
				store.set({id: `user${i}`, name: `User${i}`});
			}
		});

		it("should return limited subset of records", () => {
			const results = store.limit(0, 5);
			assert.strictEqual(results.length, 5);
		});

		it("should support offset", () => {
			const results = store.limit(5, 3);
			assert.strictEqual(results.length, 3);
			assert.strictEqual(results[0].id, "user5");
		});

		it("should handle offset beyond data size", () => {
			const results = store.limit(20, 5);
			assert.strictEqual(results.length, 0);
		});
	});

	describe("sort()", () => {
		beforeEach(() => {
			store.set({id: "user1", name: "Charlie", age: 30});
			store.set({id: "user2", name: "Alice", age: 25});
			store.set({id: "user3", name: "Bob", age: 35});
		});

		it("should sort records with comparator function", () => {
			const results = store.sort((a, b) => a.name.localeCompare(b.name));
			assert.strictEqual(results[0].name, "Alice");
			assert.strictEqual(results[1].name, "Bob");
			assert.strictEqual(results[2].name, "Charlie");
		});
	});

	describe("toArray()", () => {
		beforeEach(() => {
			store.set({id: "user1", name: "John"});
			store.set({id: "user2", name: "Jane"});
		});

		it("should convert store to array", () => {
			const results = store.toArray();
			assert.strictEqual(results.length, 2);
			assert.strictEqual(results[0].name, "John");
			assert.strictEqual(results[1].name, "Jane");
		});

		it("should return frozen records", () => {
			const frozenStore = new Haro();
			frozenStore.set({id: "user1", name: "John"});
			const results = frozenStore.toArray();

			assert.strictEqual(results.length, 1);
			assert.ok(Object.isFrozen(results[0]), "Records should be frozen");
		});
	});

	describe("entries(), keys(), values()", () => {
		beforeEach(() => {
			store.set({id: "user1", name: "John"});
			store.set({id: "user2", name: "Jane"});
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
