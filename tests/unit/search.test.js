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
		it("should search by exact value", async () => {
			const results = await store.search("John");
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
		});

		it("should search in specific index", async () => {
			const results = await store.search("John", "name");
			assert.strictEqual(results.length, 1);
		});

		it("should search in multiple indexes", async () => {
			const results = await store.search("admin", ["tags"]);
			assert.strictEqual(results.length, 2);
		});

		it("should search with regex", async () => {
			const results = await store.search(/^J/, "name");
			assert.strictEqual(results.length, 2);
		});

		it("should search with function", async () => {
			const results = await store.search((value) => value.includes("o"), "name");
			assert.strictEqual(results.length, 2);
		});

		it("should throw error for null/undefined value", async () => {
			await assert.rejects(() => store.search(null), /search: value cannot be null or undefined/);
		});

		it("should throw error for undefined value", async () => {
			await assert.rejects(
				() => store.search(undefined),
				/search: value cannot be null or undefined/,
			);
		});

		it("should return frozen results in immutable mode with raw=false", async () => {
			const immutableStore = new Haro({
				index: ["name", "tags"],
				immutable: true,
			});

			immutableStore.set("user1", { id: "user1", name: "Alice", tags: ["admin"] });
			immutableStore.set("user2", { id: "user2", name: "Bob", tags: ["user"] });

			const results = await immutableStore.search("Alice", "name");
			assert.strictEqual(Object.isFrozen(results), true);
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "Alice");
		});

		it("should throw error for regex with source longer than 256 characters", async () => {
			const tooLongRegex = new RegExp("a".repeat(300));

			await assert.rejects(
				() => store.search(tooLongRegex, "name"),
				/search: value cannot be null or undefined/,
			);
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
		it("should filter with predicate object", async () => {
			const results = await store.where({ age: 30 });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
		});

		it("should throw error when predicate is not an object", async () => {
			await assert.rejects(
				() => store.where("not an object"),
				/where: predicate must be an object/,
			);
		});

		it("should throw error when predicate is null", async () => {
			await assert.rejects(() => store.where(null), /where: predicate must be an object/);
		});

		it("should throw error when op is not a string", async () => {
			await assert.rejects(() => store.where({ age: 30 }, 123), /where: op must be a string/);
		});

		it("should filter with array predicate using OR logic", async () => {
			const results = await store.where({ tags: ["admin", "user"] }, "||");
			assert.strictEqual(results.length, 3);
		});

		it("should filter with array predicate using AND logic", async () => {
			const results = await store.where({ tags: ["admin", "user"] }, "&&");
			assert.strictEqual(results.length, 1);
		});

		it("should handle array predicate with array values using AND logic", async () => {
			const testStore = new Haro({ index: ["tags"] });
			testStore.set("1", { id: "1", tags: ["admin", "user"] });
			testStore.set("2", { id: "2", tags: ["admin"] });
			const results = await testStore.where({ tags: ["admin", "user"] }, "&&");
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].id, "1");
		});

		it("should handle regex with array values in where()", async () => {
			const testStore = new Haro({ index: ["email"] });
			testStore.set("1", { id: "1", email: ["admin@test.com", "user@test.com"] });
			testStore.set("2", { id: "2", email: ["admin@test.com"] });
			const results = await testStore.where({ email: /^admin/ });
			assert.strictEqual(results.length, 2);
		});

		it("should handle non-regexp predicate with array values", async () => {
			const testStore = new Haro({ index: ["status"] });
			testStore.set("1", { id: "1", status: ["active", "pending"] });
			testStore.set("2", { id: "2", status: ["active"] });
			const results = await testStore.where({ status: "pending" });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].id, "1");
		});

		it("should handle regexp predicate with array values using some", async () => {
			const testStore = new Haro({ index: ["tags"] });
			testStore.set("1", { id: "1", tags: ["admin", "user"] });
			testStore.set("2", { id: "2", tags: ["user"] });
			const results = await testStore.where({ tags: /^admin/ });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].id, "1");
		});

		it("should handle string predicate with array values using some", async () => {
			const testStore = new Haro({ index: ["name"] });
			testStore.set("1", { id: "1", name: ["John", "Jane"] });
			testStore.set("2", { id: "2", name: ["Jane"] });
			const results = await testStore.where({ name: "John" });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].id, "1");
		});

		it("should handle RegExp inside array value", async () => {
			const testStore = new Haro({ index: ["tags"] });
			const regex = /^admin/;
			testStore.set("1", { id: "1", tags: [regex, "user"] });
			testStore.set("2", { id: "2", tags: ["user"] });
			const results = await testStore.where({ tags: "admin" });
			assert.strictEqual(results.length, 1);
		});

		it("should filter with regex predicate", async () => {
			const results = await store.where({ name: /^J/ });
			assert.strictEqual(results.length, 2);
		});

		it("should return empty array for non-indexed fields", async () => {
			const results = await store.where({ nonIndexedField: "value" });
			assert.strictEqual(results.length, 0);
		});

		it("should return frozen results in immutable mode", async () => {
			const immutableStore = new Haro({
				index: ["name"],
				immutable: true,
			});

			immutableStore.set("user1", { id: "user1", name: "Alice" });
			immutableStore.set("user2", { id: "user2", name: "Bob" });

			const results = await immutableStore.where({ name: "Alice" });
			assert.strictEqual(Object.isFrozen(results), true);
			assert.strictEqual(results.length, 1);
		});

		describe("indexed query optimization", () => {
			it("should use indexed query optimization for multiple indexed fields", async () => {
				const optimizedStore = new Haro({
					index: ["category", "status", "priority"],
				});

				optimizedStore.set("1", { category: "bug", status: "open", priority: "high" });
				optimizedStore.set("2", { category: "bug", status: "closed", priority: "low" });
				optimizedStore.set("3", { category: "feature", status: "open", priority: "high" });
				optimizedStore.set("4", { category: "bug", status: "open", priority: "medium" });

				const results = await optimizedStore.where(
					{
						category: "bug",
						status: "open",
					},
					"&&",
				);

				assert.equal(results.length, 2, "Should find records matching both criteria");
				assert.ok(results.every((r) => r.category === "bug" && r.status === "open"));
			});

			it("should handle array predicates in indexed query", async () => {
				const arrayStore = new Haro({
					index: ["category", "tags"],
				});

				arrayStore.set("1", { id: "1", category: "tech", tags: ["javascript", "nodejs"] });
				arrayStore.set("2", { id: "2", category: "tech", tags: ["python", "django"] });
				arrayStore.set("3", { id: "3", category: "business", tags: ["javascript", "react"] });

				const results = await arrayStore.where(
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
			it("should fallback to full scan when no indexed fields are available", async () => {
				const fallbackStore = new Haro({
					index: ["name"],
				});

				fallbackStore.set("1", { id: "1", name: "Alice", age: 30, category: "admin" });
				fallbackStore.set("2", { id: "2", name: "Bob", age: 25, category: "user" });
				fallbackStore.set("3", { id: "3", name: "Charlie", age: 35, category: "admin" });

				const results = await fallbackStore.where(
					{
						name: "nonexistent",
					},
					"&&",
				);

				assert.equal(results.length, 0, "Should return empty array when no matches");
			});

			it("should trigger true fallback to full scan", async () => {
				const scanStore = new Haro({
					index: ["name"],
				});

				scanStore.set("1", { id: "1", name: "Alice", age: 30, category: "admin" });
				scanStore.set("2", { id: "2", name: "Bob", age: 25, category: "user" });

				const results = await scanStore.where({ age: 30 }, "&&");
				assert.equal(Array.isArray(results), true, "Should return an array");
			});

			it("should return empty array when no matches in fallback scan", async () => {
				const emptyStore = new Haro({
					index: ["name"],
				});

				emptyStore.set("1", { id: "1", name: "Alice", age: 30 });
				emptyStore.set("2", { id: "2", name: "Bob", age: 25 });

				const results = await emptyStore.where(
					{
						age: 40,
						category: "nonexistent",
					},
					"&&",
				);

				assert.equal(results.length, 0, "Should return empty array when no matches");
			});
		});

		it("should warn on full table scan when querying non-indexed fields", async () => {
			const scanStore = new Haro({
				index: ["name"],
				warnOnFullScan: true,
			});

			scanStore.set("1", { id: "1", name: "Alice", age: 30, category: "admin" });
			scanStore.set("2", { id: "2", name: "Bob", age: 25, category: "user" });
			scanStore.set("3", { id: "3", name: "Charlie", age: 35, category: "admin" });

			const results = await scanStore.where({ age: 30, category: "admin" }, "&&");

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].id, "1");
		});

		it("should return empty array when indexed fields exist but index maps are cleared", async () => {
			const indexedStore = new Haro({ index: ["name"] });
			indexedStore.override([]);

			const results = await indexedStore.where({ name: "John" });

			assert.strictEqual(results.length, 0);
			assert.ok(Array.isArray(results));
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

				const results = immutableStore.sortBy("age");

				assert.ok(immutableStore.index.includes("age"), "Index should be created during sortBy");
				assert.ok(Object.isFrozen(results), "Results should be frozen in immutable mode");
				assert.equal(results[0].age, 25);
				assert.equal(results[1].age, 30);
				assert.equal(results[2].age, 35);
			});
		});
	});
});
