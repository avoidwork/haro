import assert from "node:assert";
import {describe, it, beforeEach} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Indexing", () => {
	let indexedStore;

	beforeEach(() => {
		indexedStore = new Haro({
			index: ["name", "age", "department", "name|department", "age|department", "department|name"]
		});
	});

	describe("find()", () => {
		beforeEach(() => {
			indexedStore.set("user1", {id: "user1", name: "John", age: 30, department: "IT"});
			indexedStore.set("user2", {id: "user2", name: "Jane", age: 25, department: "HR"});
			indexedStore.set("user3", {id: "user3", name: "Bob", age: 30, department: "IT"});
		});

		it("should find records by single field", () => {
			const results = indexedStore.find({name: "John"});
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].name, "John");
		});

		it("should find records by multiple fields", () => {
			const results = indexedStore.find({age: 30, department: "IT"});
			assert.strictEqual(results.length, 2);
		});

		it("should find records using composite index", () => {
			const results = indexedStore.find({name: "John", department: "IT"});
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].name, "John");
		});

		it("should find records using composite index with out-of-order predicates", () => {
			// Fields are sorted alphabetically, so both orderings should work
			const results1 = indexedStore.find({name: "John", department: "IT"});
			const results2 = indexedStore.find({department: "IT", name: "John"});

			assert.strictEqual(results1.length, 1);
			assert.strictEqual(results2.length, 1);
			assert.strictEqual(results1[0][1].name, "John");
			assert.strictEqual(results2[0][1].name, "John");

			// Should find the same record
			assert.strictEqual(results1[0][0], results2[0][0]);
		});

		it("should work with three-field composite index regardless of predicate order", () => {
			// Add a store with a three-field composite index
			const tripleStore = new Haro({
				index: ["name", "age", "department", "age|department|name"]
			});

			tripleStore.set("user1", {id: "user1", name: "John", age: 30, department: "IT"});
			tripleStore.set("user2", {id: "user2", name: "Jane", age: 25, department: "HR"});

			// All these should find the same record because keys are sorted alphabetically
			const results1 = tripleStore.find({name: "John", age: 30, department: "IT"});
			const results2 = tripleStore.find({department: "IT", name: "John", age: 30});
			const results3 = tripleStore.find({age: 30, department: "IT", name: "John"});

			assert.strictEqual(results1.length, 1);
			assert.strictEqual(results2.length, 1);
			assert.strictEqual(results3.length, 1);

			// All should find the same record
			assert.strictEqual(results1[0][0], results2[0][0]);
			assert.strictEqual(results2[0][0], results3[0][0]);
			assert.strictEqual(results1[0][1].name, "John");
		});

		it("should return empty array when no matches found", () => {
			const results = indexedStore.find({name: "NonExistent"});
			assert.strictEqual(results.length, 0);
		});

		it("should return frozen results in immutable mode", () => {
			const immutableStore = new Haro({
				index: ["name"],
				immutable: true
			});
			immutableStore.set("user1", {id: "user1", name: "John"});
			const results = immutableStore.find({name: "John"});

			assert.strictEqual(Object.isFrozen(results), true);
		});
	});

	describe("setIndex()", () => {
		it("should create new index when it doesn't exist", () => {
			const store = new Haro({
				index: ["name"]
			});

			// Add data first
			store.set("1", {name: "Alice", age: 30});

			// Now manually call setIndex to trigger index creation for new field
			store.setIndex("1", {category: "admin"}, "category");

			// Verify the new index was created
			assert.ok(store.indexes.has("category"), "New index should be created");
			const categoryIndex = store.indexes.get("category");
			assert.ok(categoryIndex.has("admin"), "Index should contain the value");
			assert.ok(categoryIndex.get("admin").has("1"), "Index should map value to key");
		});

		it("should handle array values in index creation", () => {
			const store = new Haro({
				index: ["tags"]
			});

			// This will trigger the index creation path for array values
			store.set("1", {name: "Alice", tags: ["developer", "admin"]});

			const tagsIndex = store.indexes.get("tags");
			assert.ok(tagsIndex.has("developer"), "Index should contain array element");
			assert.ok(tagsIndex.has("admin"), "Index should contain array element");
		});
	});

	describe("reindex()", () => {
		it("should rebuild all indexes", () => {
			indexedStore.set("user1", {id: "user1", name: "John", age: 30});
			indexedStore.indexes.clear(); // Simulate corrupted indexes

			indexedStore.reindex();
			const results = indexedStore.find({name: "John"});
			assert.strictEqual(results.length, 1);
		});

		it("should add new index field", () => {
			indexedStore.set("user1", {id: "user1", name: "John", email: "john@example.com"});
			indexedStore.reindex("email");

			const results = indexedStore.find({email: "john@example.com"});
			assert.strictEqual(results.length, 1);
			assert.strictEqual(indexedStore.index.includes("email"), true);
		});
	});

	describe("indexKeys()", () => {
		it("should generate keys for composite index", () => {
			const data = {name: "John", department: "IT"};
			const keys = indexedStore.indexKeys("name|department", "|", data);
			assert.deepStrictEqual(keys, ["IT|John"]);
		});

		it("should handle array values in composite index", () => {
			const data = {name: "John", tags: ["admin", "user"]};
			const keys = indexedStore.indexKeys("name|tags", "|", data);
			assert.deepStrictEqual(keys, ["John|admin", "John|user"]);
		});

		it("should handle empty field values", () => {
			const data = {name: "John", department: undefined};
			const keys = indexedStore.indexKeys("name|department", "|", data);
			assert.deepStrictEqual(keys, ["undefined|John"]);
		});

		it("should sort composite index fields alphabetically", () => {
			const data = {name: "John", department: "IT"};

			// Both should produce the same keys because fields are sorted alphabetically
			const keys1 = indexedStore.indexKeys("name|department", "|", data);
			const keys2 = indexedStore.indexKeys("department|name", "|", data);

			assert.deepStrictEqual(keys1, ["IT|John"]);
			assert.deepStrictEqual(keys2, ["IT|John"]);
		});
	});
});
