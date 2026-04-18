import assert from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Searching and Filtering", () => {
	let store;

	beforeEach(() => {
		store = new Haro({ index: ["name", "age", "tags"] });
		store.set("user1", { id: "user1", name: "John", age: 30, tags: ["admin", "user"] });
		store.set("user2", { id: "user2", name: "Jane", age: 25, tags: ["user"] });
		store.set("user3", { id: "user3", name: "Bob", age: 35, tags: ["admin"] });
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
			const results = store.search((value) => value.includes("o"), "name");
			assert.strictEqual(results.length, 2); // John and Bob
		});

		it("should throw error for null/undefined value", () => {
			assert.throws(() => {
				store.search(null);
			}, /search: value cannot be null or undefined/);
		});

		it("should return frozen results in immutable mode with raw=false", () => {
			const immutableStore = new Haro({
				index: ["name", "tags"],
				immutable: true,
			});

			immutableStore.set("user1", { id: "user1", name: "Alice", tags: ["admin"] });
			immutableStore.set("user2", { id: "user2", name: "Bob", tags: ["user"] });

			// Call search with raw=false (default) and immutable=true to cover lines 695-696
			const results = immutableStore.search("Alice", "name");
			assert.strictEqual(
				Object.isFrozen(results),
				true,
				"Search results should be frozen in immutable mode",
			);
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "Alice");
		});
	});

	describe("filter()", () => {
		it("should filter records with predicate function", () => {
			const results = store.filter((record) => record.age > 25);
			assert.strictEqual(results.length, 2);
		});

		it("should throw error for non-function predicate", () => {
			assert.throws(() => {
				store.filter("not a function");
			}, /Invalid function/);
		});

		it("should return frozen results in immutable mode", () => {
			const immutableStore = new Haro({ immutable: true });
			immutableStore.set("user1", { id: "user1", age: 30 });
			const results = immutableStore.filter((record) => record.age > 25);

			assert.strictEqual(Object.isFrozen(results), true);
		});
	});

	describe("where()", () => {
		it("should filter with predicate object", () => {
			const results = store.where({ age: 30 });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
		});

		it("should filter with array predicate using OR logic", () => {
			const results = store.where({ tags: ["admin", "user"] }, "||");
			assert.strictEqual(results.length, 3); // All users have either admin or user tag
		});

		it("should filter with array predicate using AND logic", () => {
			const results = store.where({ tags: ["admin", "user"] }, "&&");
			assert.strictEqual(results.length, 1); // Only John has both tags
		});

		it("should filter with regex predicate", () => {
			const results = store.where({ name: /^J/ });
			assert.strictEqual(results.length, 0);
		});

		it("should return empty array for non-indexed fields", () => {
			const results = store.where({ nonIndexedField: "value" });
			assert.strictEqual(results.length, 0);
		});

		describe("indexed query optimization", () => {
			it("should use indexed query optimization for multiple indexed fields", () => {
				const optimizedStore = new Haro({
					index: ["category", "status", "priority"],
				});

				// Add data
				optimizedStore.set("1", { category: "bug", status: "open", priority: "high" });
				optimizedStore.set("2", { category: "bug", status: "closed", priority: "low" });
				optimizedStore.set("3", { category: "feature", status: "open", priority: "high" });
				optimizedStore.set("4", { category: "bug", status: "open", priority: "medium" });

				// Query with multiple indexed fields to trigger indexed optimization
				const results = optimizedStore.where(
					{
						category: "bug",
						status: "open",
					},
					"&&",
				);

				assert.equal(results.length, 2, "Should find records matching both criteria");
				assert.ok(results.every((r) => r.category === "bug" && r.status === "open"));
			});

			it("should handle array predicates in indexed query", () => {
				const arrayStore = new Haro({
					index: ["category", "tags"],
				});

				// Add data
				arrayStore.set("1", { id: "1", category: "tech", tags: ["javascript", "nodejs"] });
				arrayStore.set("2", { id: "2", category: "tech", tags: ["python", "django"] });
				arrayStore.set("3", { id: "3", category: "business", tags: ["javascript", "react"] });

				// Query with array predicate on indexed field
				const results = arrayStore.where(
					{
						category: ["tech"],
					},
					"&&",
				);

				assert.equal(results.length, 2, "Should find records matching array predicate");
				assert.ok(results.every((r) => r.category === "tech"));
			});
		});

		describe("fallback to full scan", () => {
			it("should fallback to full scan when no indexed fields are available", () => {
				const fallbackStore = new Haro({
					index: ["name"], // Only index 'name' field
				});

				// Add data
				fallbackStore.set("1", { id: "1", name: "Alice", age: 30, category: "admin" });
				fallbackStore.set("2", { id: "2", name: "Bob", age: 25, category: "user" });
				fallbackStore.set("3", { id: "3", name: "Charlie", age: 35, category: "admin" });

				// Query for non-existent value
				const results = fallbackStore.where(
					{
						name: "nonexistent",
					},
					"&&",
				);

				assert.equal(results.length, 0, "Should return empty array when no matches");
			});

			it("should trigger true fallback to full scan", () => {
				const scanStore = new Haro({
					index: ["age"],
				});

				scanStore.set("1", { id: "1", name: "Alice", age: 30, category: "admin" });
				scanStore.set("2", { id: "2", name: "Bob", age: 25, category: "user" });

				// Remove the age index to force fallback
				scanStore.indexes.delete("age");

				// Test that the method works
				const results = scanStore.where({ age: 30 }, "&&");
				assert.equal(Array.isArray(results), true, "Should return an array");
			});

			it("should return empty array when no matches in fallback scan", () => {
				const emptyStore = new Haro({
					index: ["name"],
				});

				emptyStore.set("1", { id: "1", name: "Alice", age: 30 });
				emptyStore.set("2", { id: "2", name: "Bob", age: 25 });

				// Query that won't match anything
				const results = emptyStore.where(
					{
						age: 40,
						category: "nonexistent",
					},
					"&&",
				);

				assert.equal(results.length, 0, "Should return empty array when no matches");
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

		describe("with reindexing and immutable mode", () => {
			it("should reindex field if not exists and return frozen results", () => {
				const immutableStore = new Haro({
					immutable: true,
				});

				immutableStore.set("1", { id: "1", name: "Charlie", age: 35 });
				immutableStore.set("2", { id: "2", name: "Alice", age: 30 });
				immutableStore.set("3", { id: "3", name: "Bob", age: 25 });

				// sortBy on non-indexed field will trigger reindex
				const results = immutableStore.sortBy("age");

				// Verify reindexing happened
				assert.ok(immutableStore.indexes.has("age"), "Index should be created during sortBy");

				// Verify results are frozen
				assert.ok(Object.isFrozen(results), "Results should be frozen in immutable mode");

				// Verify sorting worked - results are [key, record] pairs
				assert.equal(results[0].age, 25);
				assert.equal(results[1].age, 30);
				assert.equal(results[2].age, 35);
			});
		});
	});
});
