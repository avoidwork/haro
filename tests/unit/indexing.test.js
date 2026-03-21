import assert from "node:assert";
import {describe, it, beforeEach} from "node:test";
import {Haro} from "../../src/haro.js";

describe("Indexing", () => {
	let indexedStore;

	beforeEach(() => {
		indexedStore = new Haro({
			index: ["name", "age", "department"]
		});
	});

	describe("find()", () => {
		beforeEach(() => {
			indexedStore.set({id: "user1", name: "John", age: 30, department: "IT"});
			indexedStore.set({id: "user2", name: "Jane", age: 25, department: "HR"});
			indexedStore.set({id: "user3", name: "Bob", age: 30, department: "IT"});
		});

		it("should find records by single field", () => {
			const results = indexedStore.find({name: "John"});
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
		});

		it("should find records by multiple fields", () => {
			const results = indexedStore.find({age: 30, department: "IT"});
			assert.strictEqual(results.length, 2);
		});

		it("should return empty array when no matches found", () => {
			const results = indexedStore.find({name: "NonExistent"});
			assert.strictEqual(results.length, 0);
		});

		it("should find records using partial key of composite index", () => {
			const results = indexedStore.find({name: "John"});
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
		});

		it("should find records using partial key of composite index with multiple matches", () => {
			const results = indexedStore.find({department: "IT"});
			assert.strictEqual(results.length, 2);
			assert.strictEqual(results[0].department, "IT");
			assert.strictEqual(results[1].department, "IT");
		});

		it("should return frozen results", () => {
			const store = new Haro({index: ["name"]});
			store.set({id: "user1", name: "John"});
			const results = store.find({name: "John"});

			assert.strictEqual(results.length, 1);
			assert.ok(Object.isFrozen(results[0]), "Records should be frozen");
		});
	});

	describe("reindex()", () => {
		it("should rebuild all indexes", () => {
			indexedStore.set({id: "user1", name: "John", age: 30});
			indexedStore.indexes.clear();

			indexedStore.reindex();
			const results = indexedStore.find({name: "John"});
			assert.strictEqual(results.length, 1);
		});

		it("should add new index field", () => {
			indexedStore.set({id: "user1", name: "John", email: "john@example.com"});
			indexedStore.reindex("email");

			const results = indexedStore.find({email: "john@example.com"});
			assert.strictEqual(results.length, 1);
			assert.strictEqual(indexedStore.index.includes("email"), true);
		});
	});
});
