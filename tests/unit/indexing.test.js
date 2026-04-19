import assert from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Indexing", () => {
	let indexedStore;

	beforeEach(() => {
		indexedStore = new Haro({
			index: ["name", "age", "department", "name|department", "age|department", "department|name"],
		});
	});

	describe("find()", () => {
		beforeEach(() => {
			indexedStore.set("user1", { id: "user1", name: "John", age: 30, department: "IT" });
			indexedStore.set("user2", { id: "user2", name: "Jane", age: 25, department: "HR" });
			indexedStore.set("user3", { id: "user3", name: "Bob", age: 30, department: "IT" });
		});

		it("should throw error when where is not an object", () => {
			assert.throws(() => {
				indexedStore.find("not an object");
			}, /find: where must be an object/);
		});

		it("should throw error when where is null", () => {
			assert.throws(() => {
				indexedStore.find(null);
			}, /find: where must be an object/);
		});

		it("should find records by single field", () => {
			const results = indexedStore.find({ name: "John" });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
		});

		it("should find records by multiple fields", () => {
			const results = indexedStore.find({ age: 30, department: "IT" });
			assert.strictEqual(results.length, 2);
		});

		it("should find records using composite index", () => {
			const results = indexedStore.find({ name: "John", department: "IT" });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
		});

		it("should find records using composite index with out-of-order predicates", () => {
			// Fields are sorted alphabetically, so both orderings should work
			const results1 = indexedStore.find({ name: "John", department: "IT" });
			const results2 = indexedStore.find({ department: "IT", name: "John" });

			assert.strictEqual(results1.length, 1);
			assert.strictEqual(results2.length, 1);
			assert.strictEqual(results1[0].name, "John");
			assert.strictEqual(results2[0].name, "John");

			// Should find the same record id
			assert.strictEqual(results1[0].id, results2[0].id);
		});

		it("should work with three-field composite index regardless of predicate order", () => {
			// Add a store with a three-field composite index
			const tripleStore = new Haro({
				index: ["name", "age", "department", "age|department|name"],
			});

			tripleStore.set("user1", { id: "user1", name: "John", age: 30, department: "IT" });
			tripleStore.set("user2", { id: "user2", name: "Jane", age: 25, department: "HR" });

			// All these should find the same record because keys are sorted alphabetically
			const results1 = tripleStore.find({ name: "John", age: 30, department: "IT" });
			const results2 = tripleStore.find({ department: "IT", name: "John", age: 30 });
			const results3 = tripleStore.find({ age: 30, department: "IT", name: "John" });

			assert.strictEqual(results1.length, 1);
			assert.strictEqual(results2.length, 1);
			assert.strictEqual(results3.length, 1);

			// All should find the same record id
			assert.strictEqual(results1[0].id, results2[0].id);
			assert.strictEqual(results2[0].id, results3[0].id);
			assert.strictEqual(results1[0].name, "John");
		});

		it("should return empty array when no matches found", () => {
			const results = indexedStore.find({ name: "NonExistent" });
			assert.strictEqual(results.length, 0);
		});

		it("should return frozen results in immutable mode", () => {
			const immutableStore = new Haro({
				index: ["name"],
				immutable: true,
			});
			immutableStore.set("user1", { id: "user1", name: "John" });
			const results = immutableStore.find({ name: "John" });

			assert.strictEqual(Object.isFrozen(results), true);
		});
	});

	describe("reindex()", () => {
		it("should rebuild all indexes", () => {
			indexedStore.set("user1", { id: "user1", name: "John", age: 30 });
			indexedStore.clear();

			indexedStore.reindex();
			indexedStore.set("user1", { id: "user1", name: "John", age: 30 });
			const results = indexedStore.find({ name: "John" });
			assert.strictEqual(results.length, 1);
		});

		it("should add new index field", () => {
			indexedStore.set("user1", { id: "user1", name: "John", email: "john@example.com" });
			indexedStore.reindex("email");

			const results = indexedStore.find({ email: "john@example.com" });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(indexedStore.index.includes("email"), true);
		});
	});
});
