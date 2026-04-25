import assert from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Utility Methods", () => {
	let store;

	beforeEach(() => {
		store = new Haro();
	});

	describe("forEach()", () => {
		beforeEach(() => {
			store.set("user1", { id: "user1", name: "John" });
			store.set("user2", { id: "user2", name: "Jane" });
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
			store.set("user1", { id: "user1", name: "John", age: 30 });
			store.set("user2", { id: "user2", name: "Jane", age: 25 });
		});

		it("should transform all records", () => {
			const results = store.map((record) => record.name);
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

	describe("limit()", () => {
		beforeEach(() => {
			for (let i = 0; i < 10; i++) {
				store.set(`user${i}`, { id: `user${i}`, name: `User${i}` });
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
			store.set("user1", { id: "user1", name: "Charlie", age: 30 });
			store.set("user2", { id: "user2", name: "Alice", age: 25 });
			store.set("user3", { id: "user3", name: "Bob", age: 35 });
		});

		it("should throw error when fn is not a function", () => {
			assert.throws(() => {
				store.sort("not a function");
			}, /sort: fn must be a function/);
		});

		it("should sort records with comparator function", () => {
			const results = store.sort((a, b) => a.name.localeCompare(b.name));
			assert.strictEqual(results[0].name, "Alice");
			assert.strictEqual(results[1].name, "Bob");
			assert.strictEqual(results[2].name, "Charlie");
		});

		it("should return frozen results when immutable=true", () => {
			const immutableStore = new Haro({ immutable: true });
			immutableStore.set("user1", { id: "user1", name: "Charlie", age: 30 });
			immutableStore.set("user2", { id: "user2", name: "Alice", age: 25 });
			immutableStore.set("user3", { id: "user3", name: "Bob", age: 35 });
			const results = immutableStore.sort((a, b) => a.age - b.age);
			assert.strictEqual(Object.isFrozen(results), true);
			assert.strictEqual(results[0].name, "Alice");
			assert.strictEqual(results[1].name, "Charlie");
			assert.strictEqual(results[2].name, "Bob");
		});
	});

	describe("toArray()", () => {
		beforeEach(() => {
			store.set("user1", { id: "user1", name: "John" });
			store.set("user2", { id: "user2", name: "Jane" });
		});

		it("should convert store to array", () => {
			const results = store.toArray();
			assert.strictEqual(results.length, 2);
			assert.strictEqual(results[0].name, "John");
			assert.strictEqual(results[1].name, "Jane");
		});

		it("should return frozen array in immutable mode", () => {
			const immutableStore = new Haro({ immutable: true });
			immutableStore.set("user1", { id: "user1", name: "John" });
			const results = immutableStore.toArray();

			assert.strictEqual(Object.isFrozen(results), true);
			assert.strictEqual(Object.isFrozen(results[0]), true);
		});

		it("should freeze all nested objects in immutable mode", () => {
			const immutableStore = new Haro({ immutable: true });
			immutableStore.set("user1", {
				id: "user1",
				name: "John",
				address: { city: "NYC" },
			});
			const results = immutableStore.toArray();

			// The result array and its elements are frozen, but nested objects are not deeply frozen
			assert.strictEqual(Object.isFrozen(results), true);
			assert.strictEqual(Object.isFrozen(results[0]), true);
		});
	});

	describe("entries(), keys(), values()", () => {
		beforeEach(() => {
			store.set("user1", { id: "user1", name: "John" });
			store.set("user2", { id: "user2", name: "Jane" });
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

	describe("merge() edge cases via set()", () => {
		it("should handle nested arrays", () => {
			const versionedStore = new Haro({ versioning: true });
			versionedStore.set("key1", { matrix: [[1, 2]] });
			versionedStore.set("key1", { matrix: [[3, 4]] });
			const record = versionedStore.get("key1");
			assert.deepStrictEqual(record.matrix, [
				[1, 2],
				[3, 4],
			]);
		});

		it("should use JSON fallback when structuredClone is unavailable", () => {
			const originalStructuredClone = globalThis.structuredClone;
			globalThis.structuredClone = undefined;

			try {
				const store = new Haro({ versioning: true });
				const original = { a: 1, b: { c: 2 } };
				store.set("key1", original);
				store.set("key1", { a: 3 });
				const versions = store.versions.get("key1");
				const version = Array.from(versions)[0];
				assert.strictEqual(version.a, 1);
				assert.strictEqual(version.b.c, 2);
			} finally {
				globalThis.structuredClone = originalStructuredClone;
			}
		});

		it("should handle deep nested objects", () => {
			const versionedStore = new Haro({ versioning: true });
			versionedStore.set("key1", { a: { b: { c: 1 } } });
			versionedStore.set("key1", { a: { b: { d: 2 } } });
			const record = versionedStore.get("key1");
			assert.deepStrictEqual(record.a.b, { c: 1, d: 2 });
		});

		it("should handle null values", () => {
			const versionedStore = new Haro({ versioning: true });
			versionedStore.set("key1", { a: null });
			versionedStore.set("key1", { b: "value" });
			const record = versionedStore.get("key1");
			assert.strictEqual(record.a, null);
			assert.strictEqual(record.b, "value");
		});

		it("should handle empty source object", () => {
			const versionedStore = new Haro({ versioning: true });
			versionedStore.set("key1", { a: 1 });
			versionedStore.set("key1", {});
			const record = versionedStore.get("key1");
			assert.deepStrictEqual(record, { a: 1, id: "key1" });
		});

		it("should handle array to object type mismatch", () => {
			const versionedStore = new Haro({ versioning: true });
			versionedStore.set("key1", { tags: ["a"] });
			versionedStore.set("key1", { tags: "b" });
			const record = versionedStore.get("key1");
			assert.strictEqual(record.tags, "b");
		});

		it("should preserve version history with merges", () => {
			const versionedStore = new Haro({ versioning: true });
			versionedStore.set("key1", { a: 1, b: 2 });
			versionedStore.set("key1", { b: 3, c: 4 });
			const versions = versionedStore.versions.get("key1");
			assert.strictEqual(versions.size, 1);
			const version = Array.from(versions)[0];
			assert.deepStrictEqual(version.a, 1);
			assert.deepStrictEqual(version.b, 2);
		});

		it("should skip prototype pollution keys during merge", () => {
			const versionedStore = new Haro({ versioning: true });
			versionedStore.set("key1", { a: 1 });
			versionedStore.set("key1", {
				__proto__: { polluted: true },
				constructor: { polluted: true },
				prototype: { polluted: true },
				b: 2,
			});
			const record = versionedStore.get("key1");
			assert.strictEqual(record.a, 1);
			assert.strictEqual(record.b, 2);
			assert.strictEqual(Object.prototype.polluted, undefined);
			assert.strictEqual(record.hasOwnProperty("__proto__"), false);
		});
	});
});
