import assert from "node:assert";
import { Haro, haro } from "../../dist/haro.js";

/**
 * Unit tests for Haro DataStore
 */
describe("Haro DataStore", function () {
	let store;

	beforeEach(function () {
		store = new Haro();
	});

	describe("Constructor", function () {
		it("should create instance with default values", function () {
			assert.strictEqual(store.delimiter, "|");
			assert.strictEqual(store.key, "id");
			assert.strictEqual(store.versioning, false);
			assert.strictEqual(store.size, 0);
			assert.ok(Array.isArray(store.index));
			assert.ok(Array.isArray(store.registry));
		});

		it("should create instance with custom configuration", function () {
			const customStore = new Haro({
				delimiter: "::",
				key: "uid",
				versioning: true,
				index: ["name", "age"]
			});

			assert.strictEqual(customStore.delimiter, "::");
			assert.strictEqual(customStore.key, "uid");
			assert.strictEqual(customStore.versioning, true);
			assert.deepStrictEqual(customStore.index, ["name", "age"]);
		});

		it("should generate unique id for each instance", function () {
			const store1 = new Haro();
			const store2 = new Haro();

			assert.notStrictEqual(store1.id, store2.id);
		});
	});

	describe("CRUD Operations", function () {
		describe("set()", function () {
			it("should add new record with auto-generated key", function () {
				const result = store.set(null, { name: "John", age: 30 });

				assert.strictEqual(result.length, 2);
				assert.ok(result[0]); // key
				assert.strictEqual(result[1].name, "John");
				assert.strictEqual(result[1].age, 30);
				assert.strictEqual(store.size, 1);
			});

			it("should add new record with specified key", function () {
				const result = store.set("user1", { name: "John", age: 30 });

				assert.strictEqual(result[0], "user1");
				assert.strictEqual(result[1].name, "John");
				assert.strictEqual(result[1].age, 30);
				assert.strictEqual(store.size, 1);
			});

			it("should update existing record by merging data", function () {
				store.set("user1", { name: "John", age: 30 });
				const result = store.set("user1", { age: 31, city: "NYC" });

				assert.strictEqual(result[1].name, "John");
				assert.strictEqual(result[1].age, 31);
				assert.strictEqual(result[1].city, "NYC");
				assert.strictEqual(store.size, 1);
			});

			it("should override existing record when override is true", function () {
				store.set("user1", { name: "John", age: 30 });
				const result = store.set("user1", { age: 31 }, false, true);

				assert.strictEqual(result[1].name, undefined);
				assert.strictEqual(result[1].age, 31);
				assert.strictEqual(store.size, 1);
			});

			it("should use record key property if available", function () {
				const result = store.set(null, { id: "user1", name: "John" });

				assert.strictEqual(result[0], "user1");
				assert.strictEqual(result[1].id, "user1");
				assert.strictEqual(result[1].name, "John");
			});
		});

		describe("get()", function () {
			beforeEach(function () {
				store.set("user1", { name: "John", age: 30 });
			});

			it("should retrieve existing record", function () {
				const result = store.get("user1");

				assert.strictEqual(result.length, 2);
				assert.strictEqual(result[0], "user1");
				assert.strictEqual(result[1].name, "John");
				assert.strictEqual(result[1].age, 30);
			});

			it("should return raw data when raw=true", function () {
				const result = store.get("user1", true);

				assert.strictEqual(result.name, "John");
				assert.strictEqual(result.age, 30);
				assert.strictEqual(result.id, "user1");
			});

			it("should return null for non-existent record", function () {
				const result = store.get("nonexistent");

				assert.strictEqual(result.length, 2);
				assert.strictEqual(result[0], "nonexistent");
				assert.strictEqual(result[1], null);
			});
		});

		describe("has()", function () {
			beforeEach(function () {
				store.set("user1", { name: "John", age: 30 });
			});

			it("should return true for existing record", function () {
				assert.strictEqual(store.has("user1"), true);
			});

			it("should return false for non-existent record", function () {
				assert.strictEqual(store.has("nonexistent"), false);
			});
		});

		describe("del()", function () {
			beforeEach(function () {
				store.set("user1", { name: "John", age: 30 });
			});

			it("should delete existing record", function () {
				store.del("user1");

				assert.strictEqual(store.size, 0);
				assert.strictEqual(store.has("user1"), false);
			});

			it("should throw error for non-existent record", function () {
				assert.throws(() => {
					store.del("nonexistent");
				}, /Record not found/);
			});
		});

		describe("clear()", function () {
			beforeEach(function () {
				store.set("user1", { name: "John", age: 30 });
				store.set("user2", { name: "Jane", age: 25 });
			});

			it("should clear all records", function () {
				store.clear();

				assert.strictEqual(store.size, 0);
				assert.strictEqual(store.has("user1"), false);
				assert.strictEqual(store.has("user2"), false);
			});
		});
	});

	describe("Batch Operations", function () {
		it("should batch set multiple records", function () {
			const data = [
				{ name: "John", age: 30 },
				{ name: "Jane", age: 25 },
				{ name: "Bob", age: 35 }
			];

			const results = store.batch(data);

			assert.strictEqual(results.length, 3);
			assert.strictEqual(store.size, 3);
		});

		it("should batch delete multiple records", function () {
			store.set("user1", { name: "John", age: 30 });
			store.set("user2", { name: "Jane", age: 25 });
			store.set("user3", { name: "Bob", age: 35 });

			store.batch(["user1", "user3"], "del");

			assert.strictEqual(store.size, 1);
			assert.strictEqual(store.has("user1"), false);
			assert.strictEqual(store.has("user2"), true);
			assert.strictEqual(store.has("user3"), false);
		});
	});

	describe("Indexing", function () {
		beforeEach(function () {
			store = new Haro({ index: ["name", "age", "name|age"] });
			store.set("user1", { name: "John", age: 30 });
			store.set("user2", { name: "Jane", age: 25 });
			store.set("user3", { name: "Bob", age: 30 });
		});

		it("should create indexes for specified fields", function () {
			assert.ok(store.indexes.has("name"));
			assert.ok(store.indexes.has("age"));
		});

		it("should create composite indexes with delimiter", function () {
			assert.ok(store.indexes.has("name|age"));
		});

		it("should reindex when new field is added", function () {
			store.reindex("city");

			assert.ok(store.indexes.has("city"));
			assert.ok(store.index.includes("city"));
		});

		it("should find records by indexed field", function () {
			const results = store.find({ name: "John" });

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].name, "John");
		});

		it("should find multiple records by indexed field", function () {
			const results = store.find({ age: 30 });

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Bob"));
		});

		it.skip("should find records by composite index", function () {
			// Create a custom store with a composite index
			const compositeStore = new Haro({ index: ["name", "age", "name|age"] });
			compositeStore.set("user1", { name: "John", age: 30 });
			compositeStore.set("user2", { name: "Jane", age: 25 });
			compositeStore.set("user3", { name: "Bob", age: 30 });

			const results = compositeStore.find({ name: "John", age: 30 });

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].name, "John");
		});

		it("should return empty array for non-matching find", function () {
			const results = store.find({ name: "NonExistent" });

			assert.strictEqual(results.length, 0);
		});

		it("should clean up empty index entries on delete", function () {
			// Create a store with unique values for each record
			const indexStore = new Haro({ index: ["uniqueField"] });
			indexStore.set("user1", { uniqueField: "unique1" });
			indexStore.set("user2", { uniqueField: "unique2" });

			// Verify index exists
			assert.ok(indexStore.indexes.get("uniqueField").has("unique1"));
			assert.ok(indexStore.indexes.get("uniqueField").has("unique2"));

			// Delete a record
			indexStore.del("user1");

			// Verify the index entry was cleaned up
			assert.ok(!indexStore.indexes.get("uniqueField").has("unique1"));
			assert.ok(indexStore.indexes.get("uniqueField").has("unique2"));
		});

		it("should handle complex delimiter-based indexing", function () {
			// Create a store with a complex delimiter index
			const complexStore = new Haro({ index: ["category|subcategory"] });
			complexStore.set("item1", { category: "electronics", subcategory: "laptop" });
			complexStore.set("item2", { category: "electronics", subcategory: "phone" });
			complexStore.set("item3", { category: "books", subcategory: "fiction" });

			// Test that the delimiter index was created
			assert.ok(complexStore.indexes.has("category|subcategory"));

			// Find items by delimiter index
			const results = complexStore.find({ category: "electronics", subcategory: "laptop" });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].category, "electronics");
			assert.strictEqual(results[0][1].subcategory, "laptop");
		});
	});

	describe("Searching", function () {
		beforeEach(function () {
			store = new Haro({ index: ["name", "age", "tags"] });
			store.set("user1", { name: "John", age: 30, tags: ["developer", "javascript"] });
			store.set("user2", { name: "Jane", age: 25, tags: ["designer", "css"] });
			store.set("user3", { name: "Bob", age: 30, tags: ["developer", "python"] });
		});

		it("should search by exact value", function () {
			const results = store.search("John");

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].name, "John");
		});

		it("should search by regex pattern", function () {
			const results = store.search(/^J/);

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Jane"));
		});

		it("should search by function", function () {
			const results = store.search(value => value > 25, "age");

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Bob"));
		});

		it("should search in specific index", function () {
			const results = store.search("developer", "tags");

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Bob"));
		});

		it("should return raw results when raw=true", function () {
			const results = store.search("John", null, true);

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
			assert.strictEqual(results[0].age, 30);
		});
	});

	describe("Filtering", function () {
		beforeEach(function () {
			store.set("user1", { name: "John", age: 30, active: true });
			store.set("user2", { name: "Jane", age: 25, active: false });
			store.set("user3", { name: "Bob", age: 35, active: true });
		});

		it("should filter records by predicate function", function () {
			const results = store.filter(record => record.age > 25);

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Bob"));
		});

		it("should filter records by active status", function () {
			const results = store.filter(record => record.active);

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Bob"));
		});

		it("should return raw results when raw=true", function () {
			const results = store.filter(record => record.age > 25, true);

			assert.strictEqual(results.length, 2);
			assert.strictEqual(typeof results[0], "object");
			assert.ok(results.some(r => r.name === "John"));
		});

		it("should throw error for invalid function", function () {
			assert.throws(() => {
				store.filter("not a function");
			}, /Invalid function/);
		});
	});

	describe("Where Queries", function () {
		beforeEach(function () {
			store = new Haro({ index: ["name", "age", "tags", "active"] });
			store.set("user1", { name: "John", age: 30, tags: ["developer", "javascript"], active: true });
			store.set("user2", { name: "Jane", age: 25, tags: ["designer", "css"], active: false });
			store.set("user3", { name: "Bob", age: 30, tags: ["developer", "python"], active: true });
		});

		it("should query by single field", function () {
			const results = store.where({ name: "John" });

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].name, "John");
		});

		it("should query by multiple fields (AND)", function () {
			const results = store.where({ age: 30, active: true });

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Bob"));
		});

		it("should query by array values with OR operator", function () {
			const results = store.where({ tags: ["developer", "designer"] }, false, "||");

			assert.strictEqual(results.length, 3);
		});

		it("should query by array values with AND operator", function () {
			const results = store.where({ tags: ["developer", "javascript"] }, false, "&&");

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].name, "John");
		});

		it("should query by regex pattern", function () {
			const results = store.where({ name: /^J/ });

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Jane"));
		});

		it("should return empty array for non-indexed fields", function () {
			const results = store.where({ nonIndexedField: "value" });

			assert.strictEqual(results.length, 0);
		});

		it("should query non-array field with array predicate using AND", function () {
			const results = store.where({ name: ["John", "Bob"] }, false, "&&");

			assert.strictEqual(results.length, 0);
		});

		it("should query non-array field with array predicate using OR", function () {
			const results = store.where({ name: ["John", "Bob"] }, false, "||");

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Bob"));
		});

		it.skip("should query array field with regex using AND", function () {
			const results = store.where({ tags: /developer/ }, false, "&&");

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Bob"));
		});

		it("should query array field with regex using OR", function () {
			const results = store.where({ tags: /css/ }, false, "||");

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0][1].name, "Jane");
		});

		it("should query array field with single value predicate", function () {
			const results = store.where({ tags: "developer" });

			assert.strictEqual(results.length, 2);
			assert.ok(results.some(r => r[1].name === "John"));
			assert.ok(results.some(r => r[1].name === "Bob"));
		});
	});

	describe("Utility Methods", function () {
		beforeEach(function () {
			store.set("user1", { name: "John", age: 30 });
			store.set("user2", { name: "Jane", age: 25 });
			store.set("user3", { name: "Bob", age: 35 });
		});

		describe("forEach()", function () {
			it("should iterate over all records", function () {
				const names = [];
				store.forEach(value => {
					names.push(value.name);
				});

				assert.strictEqual(names.length, 3);
				assert.ok(names.includes("John"));
				assert.ok(names.includes("Jane"));
				assert.ok(names.includes("Bob"));
			});
		});

		describe("UUID Generation", function () {
			it("should generate UUIDs consistently", function () {
				const uuid1 = store.uuid();
				const uuid2 = store.uuid();

				assert.notStrictEqual(uuid1, uuid2);
				assert.ok(typeof uuid1 === "string");
				assert.ok(typeof uuid2 === "string");
				assert.ok(uuid1.length > 0);
				assert.ok(uuid2.length > 0);
			});
		});

		describe("map()", function () {
			it("should transform all records", function () {
				const names = store.map(record => record.name);

				assert.strictEqual(names.length, 3);
				assert.ok(names.includes("John"));
				assert.ok(names.includes("Jane"));
				assert.ok(names.includes("Bob"));
			});

			it("should return raw results when raw=true", function () {
				const names = store.map(record => record.name, true);

				assert.strictEqual(names.length, 3);
				assert.ok(names.includes("John"));
				assert.ok(names.includes("Jane"));
				assert.ok(names.includes("Bob"));
			});

			it("should throw error for invalid function", function () {
				assert.throws(() => {
					store.map("not a function");
				}, /Invalid function/);
			});
		});

		describe("reduce()", function () {
			it("should reduce all records to single value", function () {
				const totalAge = store.reduce((sum, record) => sum + record.age, 0);

				assert.strictEqual(totalAge, 90);
			});

			it("should use first key as initial value when no accumulator provided", function () {
				const result = store.reduce(acc => acc);

				assert.ok(typeof result === "string");
			});
		});

		describe("sort()", function () {
			it("should sort records by comparator function", function () {
				const sorted = store.sort((a, b) => a.age - b.age);

				assert.strictEqual(sorted.length, 3);
				assert.strictEqual(sorted[0].age, 25);
				assert.strictEqual(sorted[1].age, 30);
				assert.strictEqual(sorted[2].age, 35);
			});

			it("should return mutable array when frozen=false", function () {
				const sorted = store.sort((a, b) => a.age - b.age, false);

				assert.strictEqual(sorted.length, 3);
				assert.strictEqual(Object.isFrozen(sorted), false);
			});
		});

		describe("sortBy()", function () {
			beforeEach(function () {
				store = new Haro({ index: ["name", "age"] });
				store.set("user1", { name: "John", age: 30 });
				store.set("user2", { name: "Jane", age: 25 });
				store.set("user3", { name: "Bob", age: 35 });
			});

			it("should sort by indexed field", function () {
				const sorted = store.sortBy("name");

				assert.strictEqual(sorted.length, 3);
				assert.strictEqual(sorted[0][1].name, "Bob");
				assert.strictEqual(sorted[1][1].name, "Jane");
				assert.strictEqual(sorted[2][1].name, "John");
			});

			it("should throw error for invalid field", function () {
				assert.throws(() => {
					store.sortBy("");
				}, /Invalid field/);
			});

			it("should auto-index field if not indexed", function () {
			// Create a store without the field indexed
				const sortStore = new Haro({ index: ["name"] });
				sortStore.set("user1", { name: "John", age: 30 });
				sortStore.set("user2", { name: "Jane", age: 25 });
				sortStore.set("user3", { name: "Bob", age: 35 });

				// Verify age is not indexed initially
				assert.ok(!sortStore.indexes.has("age"));

				// Use sortBy which should auto-index
				const sorted = sortStore.sortBy("age");

				// Verify age is now indexed
				assert.ok(sortStore.indexes.has("age"));
				assert.ok(sortStore.index.includes("age"));

				assert.strictEqual(sorted.length, 3);
				assert.strictEqual(sorted[0][1].age, 25);
				assert.strictEqual(sorted[1][1].age, 30);
				assert.strictEqual(sorted[2][1].age, 35);
			});
		});

		describe("limit()", function () {
			it("should limit records from offset", function () {
				const limited = store.limit(1, 2);

				assert.strictEqual(limited.length, 2);
			});

			it("should handle offset beyond data size", function () {
				const limited = store.limit(10, 5);

				assert.strictEqual(limited.length, 0);
			});
		});

		describe("toArray()", function () {
			it("should convert to array of records", function () {
				const array = store.toArray();

				assert.ok(Array.isArray(array));
				assert.strictEqual(array.length, 3);
				assert.strictEqual(Object.isFrozen(array), true);
			});

			it("should return mutable array when frozen=false", function () {
				const array = store.toArray(false);

				assert.ok(Array.isArray(array));
				assert.strictEqual(array.length, 3);
				assert.strictEqual(Object.isFrozen(array), false);
			});
		});

		describe("dump()", function () {
			it("should dump all records", function () {
				const dump = store.dump();

				assert.ok(Array.isArray(dump));
				assert.strictEqual(dump.length, 3);
			});

			it("should dump indexes", function () {
				const indexedStore = new Haro({ index: ["name"] });
				indexedStore.set("user1", { name: "John" });

				const dump = indexedStore.dump("indexes");

				assert.ok(Array.isArray(dump));
				assert.ok(dump.length > 0);
			});
		});

		describe("keys(), values(), entries()", function () {
			it("should return iterators", function () {
				const keys = Array.from(store.keys());
				const values = Array.from(store.values());
				const entries = Array.from(store.entries());

				assert.strictEqual(keys.length, 3);
				assert.strictEqual(values.length, 3);
				assert.strictEqual(entries.length, 3);
			});
		});

		describe("clone()", function () {
			it("should create deep copy of object", function () {
				const obj = { name: "John", nested: { age: 30 } };
				const cloned = store.clone(obj);

				assert.deepStrictEqual(cloned, obj);
				assert.notStrictEqual(cloned, obj);
				assert.notStrictEqual(cloned.nested, obj.nested);
			});
		});

		describe("merge()", function () {
			it("should merge objects", function () {
				const a = { name: "John", age: 30 };
				const b = { age: 31, city: "NYC" };
				const merged = store.merge(a, b);

				assert.strictEqual(merged.name, "John");
				assert.strictEqual(merged.age, 31);
				assert.strictEqual(merged.city, "NYC");
			});

			it("should merge arrays", function () {
				const a = [1, 2];
				const b = [3, 4];
				const merged = store.merge(a, b);

				assert.deepStrictEqual(merged, [1, 2, 3, 4]);
			});

			it("should override when override=true", function () {
				const a = [1, 2];
				const b = [3, 4];
				const merged = store.merge(a, b, true);

				assert.deepStrictEqual(merged, [3, 4]);
			});
		});

		describe("uuid()", function () {
			it("should generate unique identifiers", function () {
				const uuid1 = store.uuid();
				const uuid2 = store.uuid();

				assert.notStrictEqual(uuid1, uuid2);
				assert.ok(typeof uuid1 === "string");
				assert.ok(typeof uuid2 === "string");
			});
		});
	});

	describe("Versioning", function () {
		beforeEach(function () {
			store = new Haro({ versioning: true });
		});

		it("should track versions when versioning is enabled", function () {
			store.set("user1", { name: "John", age: 30 });
			store.set("user1", { name: "John", age: 31 });

			assert.ok(store.versions.has("user1"));
			assert.strictEqual(store.versions.get("user1").size, 1);
		});

		it("should clear versions when record is deleted", function () {
			store.set("user1", { name: "John", age: 30 });
			store.set("user1", { name: "John", age: 31 });
			store.del("user1");

			assert.strictEqual(store.versions.has("user1"), false);
		});
	});

	describe("Override", function () {
		beforeEach(function () {
			store.set("user1", { name: "John", age: 30 });
			store.set("user2", { name: "Jane", age: 25 });
		});

		it("should override records data", function () {
			const newData = [["user3", { name: "Bob", age: 35 }]];
			store.override(newData);

			assert.strictEqual(store.size, 1);
			assert.strictEqual(store.has("user1"), false);
			assert.strictEqual(store.has("user2"), false);
			assert.strictEqual(store.has("user3"), true);
		});

		it("should override indexes data", function () {
			const indexedStore = new Haro({ index: ["name"] });
			indexedStore.set("user1", { name: "John" });

			const newIndexes = [["name", [["Bob", ["user3"]]]]];
			indexedStore.override(newIndexes, "indexes");

			assert.ok(indexedStore.indexes.has("name"));
		});

		it("should throw error for invalid type", function () {
			assert.throws(() => {
				store.override([], "invalid");
			}, /Invalid type/);
		});
	});
});

describe("Hook Methods", function () {
	it("should call beforeClear hook", function () {
		let hookCalled = false;
		const customStore = new Haro();
		customStore.beforeClear = function () {
			hookCalled = true;
		};

		customStore.set("test", { value: 1 });
		customStore.clear();

		assert.ok(hookCalled);
	});

	it("should call onclear hook", function () {
		let hookCalled = false;
		const customStore = new Haro();
		customStore.onclear = function () {
			hookCalled = true;
		};

		customStore.set("test", { value: 1 });
		customStore.clear();

		assert.ok(hookCalled);
	});

	it("should call beforeBatch hook", function () {
		let hookCalled = false;
		const customStore = new Haro();
		customStore.beforeBatch = function (arg) {
			hookCalled = true;

			return arg;
		};

		customStore.batch([{ name: "John" }]);

		assert.ok(hookCalled);
	});

	it("should call onbatch hook", function () {
		let hookCalled = false;
		const customStore = new Haro();
		customStore.onbatch = function (arg) {
			hookCalled = true;

			return arg;
		};

		customStore.batch([{ name: "John" }]);

		assert.ok(hookCalled);
	});

	it("should call beforeDelete hook", function () {
		let hookCalled = false;
		const customStore = new Haro();
		customStore.beforeDelete = function (key, batch) {
			hookCalled = true;

			return [key, batch];
		};

		customStore.set("test", { value: 1 });
		customStore.del("test");

		assert.ok(hookCalled);
	});

	it("should call ondelete hook", function () {
		let hookCalled = false;
		const customStore = new Haro();
		customStore.ondelete = function (key, batch) {
			hookCalled = true;

			return [key, batch];
		};

		customStore.set("test", { value: 1 });
		customStore.del("test");

		assert.ok(hookCalled);
	});

	it("should call beforeSet hook", function () {
		let hookCalled = false;
		const customStore = new Haro();
		customStore.beforeSet = function (key, data, batch) {
			hookCalled = true;

			return [key, batch];
		};

		customStore.set("test", { value: 1 });

		assert.ok(hookCalled);
	});

	it("should call onset hook", function () {
		let hookCalled = false;
		const customStore = new Haro();
		customStore.onset = function (arg, batch) {
			hookCalled = true;

			return [arg, batch];
		};

		customStore.set("test", { value: 1 });

		assert.ok(hookCalled);
	});

	it("should call onoverride hook", function () {
		let hookCalled = false;
		const customStore = new Haro();
		customStore.onoverride = function (type) {
			hookCalled = true;

			return type;
		};

		customStore.set("test", { value: 1 });
		customStore.override([["test2", { value: 2 }]]);

		assert.ok(hookCalled);
	});
});

describe("haro factory function", function () {
	it("should create Haro instance", function () {
		const store = haro();

		assert.ok(store instanceof Haro);
	});

	it("should create Haro instance with config", function () {
		const store = haro(null, { key: "uid" });

		assert.ok(store instanceof Haro);
		assert.strictEqual(store.key, "uid");
	});

	it("should batch load data if array provided", function () {
		const data = [
			{ name: "John", age: 30 },
			{ name: "Jane", age: 25 }
		];
		const store = haro(data);

		assert.ok(store instanceof Haro);
		assert.strictEqual(store.size, 2);
	});
});
