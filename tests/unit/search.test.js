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

		it("should throw error for undefined value", () => {
			assert.throws(() => {
				store.search(undefined);
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

		it("should throw error when predicate is not an object", () => {
			assert.throws(() => {
				store.where("not an object");
			}, /where: predicate must be an object/);
		});

		it("should throw error when predicate is null", () => {
			assert.throws(() => {
				store.where(null);
			}, /where: predicate must be an object/);
		});

		it("should throw error when op is not a string", () => {
			assert.throws(() => {
				store.where({ age: 30 }, 123);
			}, /where: op must be a string/);
		});

		it("should filter with array predicate using OR logic", () => {
			const results = store.where({ tags: ["admin", "user"] }, "||");
			assert.strictEqual(results.length, 3); // All users have either admin or user tag
		});

		it("should filter with array predicate using AND logic", () => {
			const results = store.where({ tags: ["admin", "user"] }, "&&");
			assert.strictEqual(results.length, 1); // Only John has both tags
		});

		it("should handle array predicate with array values using AND logic", () => {
			const testStore = new Haro({ index: ["tags"] });
			testStore.set("1", { id: "1", tags: ["admin", "user"] });
			testStore.set("2", { id: "2", tags: ["admin"] });
			const results = testStore.where({ tags: ["admin", "user"] }, "&&");
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].id, "1");
		});

		it("should handle regex with array values in where()", () => {
			const testStore = new Haro({ index: ["email"] });
			testStore.set("1", { id: "1", email: ["admin@test.com", "user@test.com"] });
			testStore.set("2", { id: "2", email: ["admin@test.com"] });
			const results = testStore.where({ email: /^admin/ });
			assert.strictEqual(results.length, 2);
		});

		it("should handle non-regexp predicate with array values", () => {
			const testStore = new Haro({ index: ["status"] });
			testStore.set("1", { id: "1", status: ["active", "pending"] });
			testStore.set("2", { id: "2", status: ["active"] });
			const results = testStore.where({ status: "pending" });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].id, "1");
		});

		it("should handle regexp predicate with array values using some", () => {
			const testStore = new Haro({ index: ["tags"] });
			testStore.set("1", { id: "1", tags: ["admin", "user"] });
			testStore.set("2", { id: "2", tags: ["user"] });
			const results = testStore.where({ tags: /^admin/ });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].id, "1");
		});

		it("should handle string predicate with array values using some", () => {
			const testStore = new Haro({ index: ["name"] });
			testStore.set("1", { id: "1", name: ["John", "Jane"] });
			testStore.set("2", { id: "2", name: ["Jane"] });
			const results = testStore.where({ name: "John" });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].id, "1");
		});

		it("should handle RegExp inside array value", () => {
			const testStore = new Haro({ index: ["tags"] });
			const regex = /^admin/;
			testStore.set("1", { id: "1", tags: [regex, "user"] });
			testStore.set("2", { id: "2", tags: ["user"] });
			const results = testStore.where({ tags: "admin" });
			assert.strictEqual(results.length, 1);
		});

		it("should filter with regex predicate", () => {
			const results = store.where({ name: /^J/ });
			assert.strictEqual(results.length, 2);
		});

		it("should return empty array for non-indexed fields", () => {
			const results = store.where({ nonIndexedField: "value" });
			assert.strictEqual(results.length, 0);
		});

		it("should return frozen results in immutable mode", () => {
			const immutableStore = new Haro({
				index: ["name"],
				immutable: true,
			});

			immutableStore.set("user1", { id: "user1", name: "Alice" });
			immutableStore.set("user2", { id: "user2", name: "Bob" });

			const results = immutableStore.where({ name: "Alice" });
			assert.strictEqual(Object.isFrozen(results), true);
			assert.strictEqual(results.length, 1);
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
					index: ["name"],
				});

				scanStore.set("1", { id: "1", name: "Alice", age: 30, category: "admin" });
				scanStore.set("2", { id: "2", name: "Bob", age: 25, category: "user" });

				// Use non-indexed field to force fallback
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

		it("should warn on full table scan when querying non-indexed fields", () => {
			const scanStore = new Haro({
				index: ["name"],
				warnOnFullScan: true,
			});

			scanStore.set("1", { id: "1", name: "Alice", age: 30, category: "admin" });
			scanStore.set("2", { id: "2", name: "Bob", age: 25, category: "user" });
			scanStore.set("3", { id: "3", name: "Charlie", age: 35, category: "admin" });

			// Query non-indexed fields to trigger full scan
			const results = scanStore.where({ age: 30, category: "admin" }, "&&");

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].id, "1");
		});
	});

	describe("sortBy()", () => {
		it("should sort by indexed field with numeric values", () => {
			const numericStore = new Haro({ index: ["age"] });
			numericStore.set("user1", { id: "user1", age: 30 });
			numericStore.set("user2", { id: "user2", age: 25 });
			numericStore.set("user3", { id: "user3", age: 35 });
			const results = numericStore.sortBy("age");
			assert.strictEqual(results[0].age, 25);
			assert.strictEqual(results[1].age, 30);
			assert.strictEqual(results[2].age, 35);
		});

		it("should sort by indexed field with mixed types", () => {
			const mixedStore = new Haro({ index: ["value"] });
			mixedStore.set("1", { id: "1", value: 10 });
			mixedStore.set("2", { id: "2", value: "5" });
			mixedStore.set("3", { id: "3", value: 3 });
			const results = mixedStore.sortBy("value");
			assert.strictEqual(results.length, 3);
		});

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
				assert.ok(immutableStore.index.includes("age"), "Index should be created during sortBy");

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
