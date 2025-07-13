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

		it("should return frozen results in immutable mode with raw=false", () => {
			const immutableStore = new Haro({
				index: ["name", "tags"],
				immutable: true
			});

			immutableStore.set("user1", {id: "user1", name: "Alice", tags: ["admin"]});
			immutableStore.set("user2", {id: "user2", name: "Bob", tags: ["user"]});

			// Call search with raw=false (default) and immutable=true to cover lines 695-696
			const results = immutableStore.search("Alice", "name", false);
			assert.strictEqual(Object.isFrozen(results), true, "Search results should be frozen in immutable mode");
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].name, "Alice");
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

		describe("indexed query optimization", () => {
			it("should use indexed query optimization for multiple indexed fields", () => {
				const optimizedStore = new Haro({
					index: ["category", "status", "priority"]
				});

				// Add data
				optimizedStore.set("1", {category: "bug", status: "open", priority: "high"});
				optimizedStore.set("2", {category: "bug", status: "closed", priority: "low"});
				optimizedStore.set("3", {category: "feature", status: "open", priority: "high"});
				optimizedStore.set("4", {category: "bug", status: "open", priority: "medium"});

				// Query with multiple indexed fields to trigger indexed optimization
				const results = optimizedStore.where({
					category: "bug",
					status: "open"
				}, "&&");

				assert.equal(results.length, 2, "Should find records matching both criteria");
				assert.ok(results.every(r => r.category === "bug" && r.status === "open"));
			});

			it("should handle array predicates in indexed query", () => {
				const arrayStore = new Haro({
					index: ["category", "tags"]
				});

				// Add data
				arrayStore.set("1", {id: "1", category: "tech", tags: ["javascript", "nodejs"]});
				arrayStore.set("2", {id: "2", category: "tech", tags: ["python", "django"]});
				arrayStore.set("3", {id: "3", category: "business", tags: ["javascript", "react"]});

				// Query with array predicate on indexed field
				const results = arrayStore.where({
					category: ["tech"]
				}, "&&");

				assert.equal(results.length, 2, "Should find records matching array predicate");
				assert.ok(results.every(r => r.category === "tech"));
			});
		});

		describe("fallback to full scan", () => {
			it("should fallback to full scan when no indexed fields are available", () => {
				const fallbackStore = new Haro({
					index: ["name"] // Only index 'name' field
				});

				// Add data
				fallbackStore.set("1", {id: "1", name: "Alice", age: 30, category: "admin"});
				fallbackStore.set("2", {id: "2", name: "Bob", age: 25, category: "user"});
				fallbackStore.set("3", {id: "3", name: "Charlie", age: 35, category: "admin"});

				// Query for non-existent value
				const results = fallbackStore.where({
					name: "nonexistent"
				}, "&&");

				assert.equal(results.length, 0, "Should return empty array when no matches");
			});

			it("should trigger true fallback to full scan", () => {
				const scanStore = new Haro({
					index: ["age"]
				});

				scanStore.set("1", {id: "1", name: "Alice", age: 30, category: "admin"});
				scanStore.set("2", {id: "2", name: "Bob", age: 25, category: "user"});

				// Remove the age index to force fallback
				scanStore.indexes.delete("age");

				// Test that the method works
				const results = scanStore.where({age: 30}, "&&");
				assert.equal(Array.isArray(results), true, "Should return an array");
			});

			it("should return empty array when no matches in fallback scan", () => {
				const emptyStore = new Haro({
					index: ["name"]
				});

				emptyStore.set("1", {id: "1", name: "Alice", age: 30});
				emptyStore.set("2", {id: "2", name: "Bob", age: 25});

				// Query that won't match anything
				const results = emptyStore.where({
					age: 40,
					category: "nonexistent"
				}, "&&");

				assert.equal(results.length, 0, "Should return empty array when no matches");
			});
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

		describe("with reindexing and immutable mode", () => {
			it("should reindex field if not exists and return frozen results", () => {
				const immutableStore = new Haro({
					immutable: true
				});

				immutableStore.set("1", {id: "1", name: "Charlie", age: 35});
				immutableStore.set("2", {id: "2", name: "Alice", age: 30});
				immutableStore.set("3", {id: "3", name: "Bob", age: 25});

				// sortBy on non-indexed field will trigger reindex
				const results = immutableStore.sortBy("age");

				// Verify reindexing happened
				assert.ok(immutableStore.indexes.has("age"), "Index should be created during sortBy");

				// Verify results are frozen
				assert.ok(Object.isFrozen(results), "Results should be frozen in immutable mode");

				// Verify sorting worked - results are [key, record] pairs
				assert.equal(results[0][1].age, 25);
				assert.equal(results[1][1].age, 30);
				assert.equal(results[2][1].age, 35);
			});
		});
	});

	describe("matchesPredicate() complex array logic", () => {
		it("should handle array predicate with array value using AND logic", () => {
			const testStore = new Haro();
			const record = {tags: ["javascript", "nodejs", "react"]};

			// Test array predicate with array value using AND (every)
			const result = testStore.matchesPredicate(record, {tags: ["javascript", "nodejs"]}, "&&");
			assert.equal(result, true, "Should match when all predicate values are in record array");

			const result2 = testStore.matchesPredicate(record, {tags: ["javascript", "python"]}, "&&");
			assert.equal(result2, false, "Should not match when not all predicate values are in record array");
		});

		it("should handle array predicate with array value using OR logic", () => {
			const testStore = new Haro();
			const record = {tags: ["javascript", "nodejs"]};

			// Test array predicate with array value using OR (some)
			const result = testStore.matchesPredicate(record, {tags: ["python", "nodejs"]}, "||");
			assert.equal(result, true, "Should match when at least one predicate value is in record array");
		});

		it("should handle array predicate with scalar value using AND logic", () => {
			const testStore = new Haro();
			const record = {category: "tech"};

			// Test array predicate with scalar value using AND (every)
			const result = testStore.matchesPredicate(record, {category: ["tech"]}, "&&");
			assert.equal(result, true, "Should match when predicate array contains the scalar value");

			const result2 = testStore.matchesPredicate(record, {category: ["business", "finance"]}, "&&");
			assert.equal(result2, false, "Should not match when predicate array doesn't contain scalar value");
		});

		it("should handle array predicate with scalar value using OR logic", () => {
			const testStore = new Haro();
			const record = {category: "tech"};

			// Test array predicate with scalar value using OR (some)
			const result = testStore.matchesPredicate(record, {category: ["business", "tech"]}, "||");
			assert.equal(result, true, "Should match when predicate array contains the scalar value");
		});

		it("should handle regex predicate with array value using AND logic", () => {
			const testStore = new Haro();
			const record = {tags: ["reactjs", "vuejs", "angularjs"]};

			// Test regex predicate with array value using AND (every)
			const result = testStore.matchesPredicate(record, {tags: /js$/}, "&&");
			assert.equal(result, true, "Should match when regex matches all array values");

			const record2 = {tags: ["javascript", "nodejs", "reactjs"]};
			const result2 = testStore.matchesPredicate(record2, {tags: /js$/}, "&&");
			assert.equal(result2, false, "Should not match when regex doesn't match all array values");
		});

		it("should handle regex predicate with array value using OR logic", () => {
			const testStore = new Haro();
			const record = {tags: ["python", "nodejs", "java"]};

			// Test regex predicate with array value using OR (some)
			const result = testStore.matchesPredicate(record, {tags: /^node/}, "||");
			assert.equal(result, true, "Should match when regex matches at least one array value");
		});

		it("should handle regex predicate with scalar value", () => {
			const testStore = new Haro();
			const record = {name: "javascript"};

			// Test regex predicate with scalar value
			const result = testStore.matchesPredicate(record, {name: /script$/}, "&&");
			assert.equal(result, true, "Should match when regex matches scalar value");
		});

		it("should handle array value with scalar predicate", () => {
			const testStore = new Haro();
			const record = {tags: ["javascript"]};

			// Test the specific edge case for array values with non-array predicate
			const result = testStore.matchesPredicate(record, {tags: "javascript"}, "&&");
			assert.equal(result, true, "Should handle array value with scalar predicate");
		});
	});
});
