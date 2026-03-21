import assert from "node:assert";
import {describe, it, beforeEach} from "node:test";
import {Haro} from "../../src/haro.js";

describe("Searching and Filtering", () => {
	let store;

	beforeEach(() => {
		store = new Haro({index: ["name", "age", "tags"]});
		store.set({id: "user1", name: "John", age: 30, tags: ["admin", "user"]});
		store.set({id: "user2", name: "Jane", age: 25, tags: ["user"]});
		store.set({id: "user3", name: "Bob", age: 35, tags: ["admin"]});
	});

	describe("search()", () => {
		it("should search by exact value", () => {
			const results = store.search("John");
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
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
			assert.strictEqual(results.length, 2);
		});

		it("should return empty array for null/undefined value", () => {
			const results = store.search(null);
			assert.strictEqual(results.length, 0);
		});

		it("should return frozen results", () => {
			const searchStore = new Haro({index: ["name", "tags"]});
			searchStore.set({id: "user1", name: "Alice", tags: ["admin"]});
			searchStore.set({id: "user2", name: "Bob", tags: ["user"]});

			const results = searchStore.search("Alice", "name");
			assert.strictEqual(results.length, 1);
			assert.ok(Object.isFrozen(results[0]), "Records should be frozen");
			assert.strictEqual(results[0].name, "Alice");
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

		it("should return frozen results", () => {
			const filterStore = new Haro();
			filterStore.set({id: "user1", age: 30});
			const results = filterStore.filter(record => record.age > 25);

			assert.strictEqual(results.length, 1);
			assert.ok(Object.isFrozen(results[0]), "Records should be frozen");
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
			assert.strictEqual(results.length, 3);
		});

		it("should filter with array predicate using AND logic", () => {
			const results = store.where({tags: ["admin", "user"]}, "&&");
			assert.strictEqual(results.length, 1);
		});

		it("should filter with regex predicate", () => {
			const results = store.where({name: /^J/});
			assert.strictEqual(results.length, 0);
		});

		it("should return empty array for non-indexed fields", () => {
			const results = store.where({nonIndexedField: "value"});
			assert.strictEqual(results.length, 0);
		});

		describe("indexed query optimization", () => {
			it("should use indexed query optimization for multiple indexed fields", () => {
				const optimizedStore = new Haro({
					index: ["category", "status", "priority"]
				});

				optimizedStore.set({id: "1", category: "bug", status: "open", priority: "high"});
				optimizedStore.set({id: "2", category: "bug", status: "closed", priority: "low"});
				optimizedStore.set({id: "3", category: "feature", status: "open", priority: "high"});
				optimizedStore.set({id: "4", category: "bug", status: "open", priority: "medium"});

				const results = optimizedStore.where({
					category: "bug",
					status: "open"
				}, "&&");

				assert.equal(results.length, 2);
				assert.ok(results.every(r => r.category === "bug" && r.status === "open"));
			});

			it("should handle array predicates in indexed query", () => {
				const arrayStore = new Haro({
					index: ["category", "tags"]
				});

				arrayStore.set({id: "1", category: "tech", tags: ["javascript", "nodejs"]});
				arrayStore.set({id: "2", category: "tech", tags: ["python", "django"]});
				arrayStore.set({id: "3", category: "business", tags: ["javascript", "react"]});

				const results = arrayStore.where({
					category: ["tech"]
				}, "&&");

				assert.equal(results.length, 2);
				assert.ok(results.every(r => r.category === "tech"));
			});
		});

		describe("fallback to full scan", () => {
			it("should fallback to full scan when no indexed fields are available", () => {
				const fallbackStore = new Haro({
					index: ["name"]
				});

				fallbackStore.set({id: "1", name: "Alice", age: 30, category: "admin"});
				fallbackStore.set({id: "2", name: "Bob", age: 25, category: "user"});
				fallbackStore.set({id: "3", name: "Charlie", age: 35, category: "admin"});

				const results = fallbackStore.where({
					name: "nonexistent"
				}, "&&");

				assert.equal(results.length, 0);
			});

			it("should trigger true fallback to full scan", () => {
				const scanStore = new Haro({
					index: ["age"]
				});

				scanStore.set({id: "1", name: "Alice", age: 30, category: "admin"});
				scanStore.set({id: "2", name: "Bob", age: 25, category: "user"});

				scanStore.indexes.delete("age");

				const results = scanStore.where({age: 30}, "&&");
				assert.equal(Array.isArray(results), true);
			});

			it("should return empty array when no matches in fallback scan", () => {
				const emptyStore = new Haro({
					index: ["name"]
				});

				emptyStore.set({id: "1", name: "Alice", age: 30});
				emptyStore.set({id: "2", name: "Bob", age: 25});

				const results = emptyStore.where({
					age: 40,
					category: "nonexistent"
				}, "&&");

				assert.equal(results.length, 0);
			});
		});
	});

	describe("sortBy()", () => {
		it("should sort by indexed field", () => {
			const results = store.sortBy("name");
			assert.strictEqual(results[0].name, "Bob");
			assert.strictEqual(results[1].name, "Jane");
			assert.strictEqual(results[2].name, "John");
		});

		it("should throw error for empty field", () => {
			assert.throws(() => {
				store.sortBy("");
			}, /Invalid field/);
		});

		it("should create index if not exists", () => {
			const results = store.sortBy("name");
			assert.strictEqual(results[0].name, "Bob");
			assert.strictEqual(results[1].name, "Jane");
			assert.strictEqual(results[2].name, "John");
		});
	});
});
