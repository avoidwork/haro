import assert from "node:assert";
import {describe, it, beforeEach} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Searching and Filtering", () => {
	let store;

	beforeEach(() => {
		store = new Haro({index: ["name", "age", "tags"]});
		store.set("user1", {id: "user1", name: "John", age: 30, tags: ["admin", "user"]});
		store.set("user2", {id: "user2", name: "Jane", age: 25, tags: ["user"]});
		store.set("user3", {id: "user3", name: "Bob", age: 35, tags: ["admin"]});
	});

	describe("search()", () => {
		it("should search by exact value", () => {
			const results = store.search("John");
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].name, "John");
		});

		it("should search in specific index", () => {
			const results = store.search("John", "name");
			assert.strictEqual(results.length, 1);
		});

		it("should search in multiple indexes", () => {
			const results = store.search("admin", ["tags"]);
			assert.strictEqual(results.length, 2);
		});

		it("should search with regex", () => {
			const results = store.search(/^J/, "name");
			assert.strictEqual(results.length, 2);
		});

		it("should search with function", () => {
			const results = store.search(value => value.includes("o"), "name");
			assert.strictEqual(results.length, 2); // John and Bob
		});

		it("should return empty array for null/undefined value", () => {
			const results = store.search(null);
			assert.strictEqual(results.length, 0);
		});
	});

	describe("filter()", () => {
		it("should filter records with predicate function", () => {
			const results = store.filter(record => record.age > 25);
			assert.strictEqual(results.length, 2);
		});

		it("should throw error for non-function predicate", () => {
			assert.throws(() => {
				store.filter("not a function");
			}, /Invalid function/);
		});

		it("should return frozen results in immutable mode", () => {
			const immutableStore = new Haro({immutable: true});
			immutableStore.set("user1", {id: "user1", age: 30});
			const results = immutableStore.filter(record => record.age > 25);

			assert.strictEqual(Object.isFrozen(results), true);
		});
	});

	describe("where()", () => {
		it("should filter with predicate object", () => {
			const results = store.where({age: 30});
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
		});

		it("should filter with array predicate using OR logic", () => {
			const results = store.where({tags: ["admin", "user"]}, "||");
			assert.strictEqual(results.length, 3); // All users have either admin or user tag
		});

		it("should filter with array predicate using AND logic", () => {
			const results = store.where({tags: ["admin", "user"]}, "&&");
			assert.strictEqual(results.length, 1); // Only John has both tags
		});

		it("should filter with regex predicate", () => {
			const results = store.where({name: /^J/});
			assert.strictEqual(results.length, 0);
		});

		it("should return empty array for non-indexed fields", () => {
			const results = store.where({nonIndexedField: "value"});
			assert.strictEqual(results.length, 0);
		});
	});

	describe("sortBy()", () => {
		it("should sort by indexed field", () => {
			const results = store.sortBy("name");
			assert.strictEqual(results[0][1].name, "Bob");
			assert.strictEqual(results[1][1].name, "Jane");
			assert.strictEqual(results[2][1].name, "John");
		});

		it("should throw error for empty field", () => {
			assert.throws(() => {
				store.sortBy("");
			}, /Invalid field/);
		});

		it("should create index if not exists", () => {
			const results = store.sortBy("name");
			assert.strictEqual(results[0][1].name, "Bob");
			assert.strictEqual(results[1][1].name, "Jane");
			assert.strictEqual(results[2][1].name, "John");
		});
	});
});
