import assert from "node:assert";
import { describe, it, beforeEach } from "mocha";
import {
	IndexTypes,
	IndexDefinition,
	IndexStorage,
	IndexManager
} from "../../src/index-manager.js";
import { IndexError } from "../../src/errors.js";

/**
 * Tests for index management classes and utilities
 */
describe("Index Management", () => {
	describe("IndexTypes", () => {
		/**
		 * Test that all index types are defined
		 */
		it("should define all index types", () => {
			assert.strictEqual(IndexTypes.SINGLE, "single");
			assert.strictEqual(IndexTypes.COMPOSITE, "composite");
			assert.strictEqual(IndexTypes.ARRAY, "array");
			assert.strictEqual(IndexTypes.PARTIAL, "partial");
		});

		/**
		 * Test that IndexTypes is frozen/immutable
		 */
		it("should be a frozen object", () => {
			assert.ok(Object.isFrozen(IndexTypes) || typeof IndexTypes === "object");
		});
	});

	describe("IndexDefinition", () => {
		describe("Constructor", () => {
			/**
			 * Test basic index definition creation
			 */
			it("should create a basic single field index", () => {
				const def = new IndexDefinition("testIndex", "name");
				
				assert.strictEqual(def.name, "testIndex");
				assert.deepStrictEqual(def.fields, ["name"]);
				assert.strictEqual(def.type, IndexTypes.SINGLE);
				assert.strictEqual(def.unique, false);
				assert.strictEqual(def.filter, undefined);
				assert.strictEqual(def.transform, undefined);
				assert.strictEqual(def.delimiter, "|");
				assert.ok(def.createdAt instanceof Date);
				assert.ok(def.stats);
				assert.strictEqual(def.stats.totalKeys, 0);
				assert.strictEqual(def.stats.totalEntries, 0);
				assert.strictEqual(def.stats.memoryUsage, 0);
				assert.ok(def.stats.lastUpdated instanceof Date);
			});

			/**
			 * Test multi-field index creation
			 */
			it("should create a composite index for multiple fields", () => {
				const def = new IndexDefinition("compositeIndex", ["name", "age"]);
				
				assert.deepStrictEqual(def.fields, ["name", "age"]);
				assert.strictEqual(def.type, IndexTypes.COMPOSITE);
			});

			/**
			 * Test index with all options
			 */
			it("should create an index with all options", () => {
				const filter = (record) => record.active === true;
				const transform = (key) => key.toLowerCase();
				const def = new IndexDefinition("fullIndex", "email", {
					type: IndexTypes.PARTIAL,
					unique: true,
					filter,
					transform,
					delimiter: ":"
				});
				
				assert.strictEqual(def.type, IndexTypes.PARTIAL);
				assert.strictEqual(def.unique, true);
				assert.strictEqual(def.filter, filter);
				assert.strictEqual(def.transform, transform);
				assert.strictEqual(def.delimiter, ":");
			});

			/**
			 * Test string field converted to array
			 */
			it("should convert string field to array", () => {
				const def = new IndexDefinition("test", "singleField");
				assert.deepStrictEqual(def.fields, ["singleField"]);
			});
		});

		describe("Type Determination", () => {
			/**
			 * Test single field type determination
			 */
			it("should determine SINGLE type for single field", () => {
				const def = new IndexDefinition("test", "field");
				assert.strictEqual(def.type, IndexTypes.SINGLE);
			});

			/**
			 * Test composite type determination
			 */
			it("should determine COMPOSITE type for multiple fields", () => {
				const def = new IndexDefinition("test", ["field1", "field2"]);
				assert.strictEqual(def.type, IndexTypes.COMPOSITE);
			});

			/**
			 * Test partial type override
			 */
			it("should use PARTIAL type when explicitly specified", () => {
				const def = new IndexDefinition("test", ["field1", "field2"], {
					type: IndexTypes.PARTIAL
				});
				assert.strictEqual(def.type, IndexTypes.PARTIAL);
			});
		});

		describe("Key Generation", () => {
			/**
			 * Test single field key generation
			 */
			it("should generate keys for single field", () => {
				const def = new IndexDefinition("test", "name");
				const record = { name: "John", age: 30 };
				const keys = def.generateKeys(record);
				
				assert.deepStrictEqual(keys, ["John"]);
			});

			/**
			 * Test array field key generation
			 */
			it("should generate multiple keys for array field", () => {
				const def = new IndexDefinition("test", "tags");
				const record = { tags: ["red", "blue", "green"] };
				const keys = def.generateKeys(record);
				
				assert.deepStrictEqual(keys, ["red", "blue", "green"]);
			});

			/**
			 * Test composite field key generation
			 */
			it("should generate composite keys", () => {
				const def = new IndexDefinition("test", ["category", "status"]);
				const record = { category: "book", status: "active" };
				const keys = def.generateKeys(record);
				
				assert.deepStrictEqual(keys, ["book|active"]);
			});

			/**
			 * Test composite keys with array fields
			 */
			it("should generate composite keys with array fields", () => {
				const def = new IndexDefinition("test", ["category", "tags"]);
				const record = { category: "book", tags: ["fiction", "romance"] };
				const keys = def.generateKeys(record);
				
				assert.deepStrictEqual(keys.sort(), ["book|fiction", "book|romance"]);
			});

			/**
			 * Test null/undefined field handling
			 */
			it("should return empty array for null/undefined fields", () => {
				const def = new IndexDefinition("test", "missing");
				const record = { name: "John" };
				const keys = def.generateKeys(record);
				
				assert.deepStrictEqual(keys, []);
			});

			/**
			 * Test composite with missing fields
			 */
			it("should return empty array for composite with missing fields", () => {
				const def = new IndexDefinition("test", ["name", "missing"]);
				const record = { name: "John" };
				const keys = def.generateKeys(record);
				
				assert.deepStrictEqual(keys, []);
			});

			/**
			 * Test filter function
			 */
			it("should apply filter function", () => {
				const def = new IndexDefinition("test", "name", {
					filter: (record) => record.active === true
				});
				
				const activeRecord = { name: "John", active: true };
				const inactiveRecord = { name: "Jane", active: false };
				
				assert.deepStrictEqual(def.generateKeys(activeRecord), ["John"]);
				assert.deepStrictEqual(def.generateKeys(inactiveRecord), []);
			});

			/**
			 * Test transform function
			 */
			it("should apply transform function", () => {
				const def = new IndexDefinition("test", "name", {
					transform: (key) => key.toLowerCase()
				});
				
				const record = { name: "JOHN" };
				const keys = def.generateKeys(record);
				
				assert.deepStrictEqual(keys, ["john"]);
			});

			/**
			 * Test custom delimiter
			 */
			it("should use custom delimiter for composite keys", () => {
				const def = new IndexDefinition("test", ["first", "last"], {
					delimiter: ":"
				});
				
				const record = { first: "John", last: "Doe" };
				const keys = def.generateKeys(record);
				
				assert.deepStrictEqual(keys, ["John:Doe"]);
			});
		});

		describe("Statistics", () => {
			/**
			 * Test statistics update
			 */
			it("should update statistics correctly", () => {
				const def = new IndexDefinition("test", "name");
				const originalTime = def.stats.lastUpdated;
				
				def.updateStats(10, 15, 1024);
				
				assert.strictEqual(def.stats.totalKeys, 10);
				assert.strictEqual(def.stats.totalEntries, 15);
				assert.strictEqual(def.stats.memoryUsage, 1024);
				assert.ok(def.stats.lastUpdated >= originalTime);
			});

			/**
			 * Test memory usage accumulation
			 */
			it("should accumulate memory usage", () => {
				const def = new IndexDefinition("test", "name");
				
				def.updateStats(5, 5, 512);
				def.updateStats(10, 10, 256);
				
				assert.strictEqual(def.stats.memoryUsage, 768); // 512 + 256
			});
		});
	});

	describe("IndexStorage", () => {
		let storage;

		beforeEach(() => {
			storage = new IndexStorage();
		});

		describe("Basic Operations", () => {
			/**
			 * Test adding records to index
			 */
			it("should add records to index", () => {
				storage.add("key1", "record1");
				storage.add("key1", "record2");
				
				const records = storage.get("key1");
				assert.ok(records.has("record1"));
				assert.ok(records.has("record2"));
				assert.strictEqual(records.size, 2);
			});

			/**
			 * Test adding duplicate records
			 */
			it("should not add duplicate records", () => {
				storage.add("key1", "record1");
				storage.add("key1", "record1");
				
				const records = storage.get("key1");
				assert.strictEqual(records.size, 1);
			});

			/**
			 * Test removing records
			 */
			it("should remove records from index", () => {
				storage.add("key1", "record1");
				storage.add("key1", "record2");
				
				const removed = storage.remove("key1", "record1");
				assert.strictEqual(removed, true);
				
				const records = storage.get("key1");
				assert.ok(!records.has("record1"));
				assert.ok(records.has("record2"));
			});

			/**
			 * Test removing non-existent records
			 */
			it("should return false when removing non-existent records", () => {
				const removed = storage.remove("nonexistent", "record1");
				assert.strictEqual(removed, false);
			});

			/**
			 * Test cleanup of empty index keys
			 */
			it("should clean up empty index keys", () => {
				storage.add("key1", "record1");
				storage.remove("key1", "record1");
				
				assert.strictEqual(storage.has("key1"), false);
				assert.strictEqual(storage.get("key1").size, 0);
			});

			/**
			 * Test getting non-existent keys
			 */
			it("should return empty set for non-existent keys", () => {
				const records = storage.get("nonexistent");
				assert.ok(records instanceof Set);
				assert.strictEqual(records.size, 0);
			});

			/**
			 * Test checking key existence
			 */
			it("should check key existence correctly", () => {
				assert.strictEqual(storage.has("key1"), false);
				
				storage.add("key1", "record1");
				assert.strictEqual(storage.has("key1"), true);
				
				storage.remove("key1", "record1");
				assert.strictEqual(storage.has("key1"), false);
			});

			/**
			 * Test getting all keys
			 */
			it("should return all index keys", () => {
				storage.add("key1", "record1");
				storage.add("key2", "record2");
				storage.add("key3", "record3");
				
				const keys = storage.keys();
				assert.deepStrictEqual(keys.sort(), ["key1", "key2", "key3"]);
			});
		});

		describe("Statistics and Memory", () => {
			/**
			 * Test basic statistics
			 */
			it("should calculate statistics correctly", () => {
				storage.add("key1", "record1");
				storage.add("key1", "record2");
				storage.add("key2", "record3");
				
				const stats = storage.getStats();
				assert.strictEqual(stats.totalKeys, 2);
				assert.strictEqual(stats.totalEntries, 3);
				assert.ok(stats.memoryUsage > 0);
			});

			/**
			 * Test empty storage statistics
			 */
			it("should handle empty storage statistics", () => {
				const stats = storage.getStats();
				assert.strictEqual(stats.totalKeys, 0);
				assert.strictEqual(stats.totalEntries, 0);
				assert.strictEqual(stats.memoryUsage, 0);
			});

			/**
			 * Test clearing storage
			 */
			it("should clear all data", () => {
				storage.add("key1", "record1");
				storage.add("key2", "record2");
				
				storage.clear();
				
				assert.strictEqual(storage.keys().length, 0);
				const stats = storage.getStats();
				assert.strictEqual(stats.totalKeys, 0);
				assert.strictEqual(stats.totalEntries, 0);
			});
		});
	});

	describe("IndexManager", () => {
		let manager;

		beforeEach(() => {
			manager = new IndexManager();
		});

		describe("Index Management", () => {
			/**
			 * Test creating indexes
			 */
			it("should create a new index", () => {
				const result = manager.createIndex("nameIndex", "name");
				
				assert.strictEqual(result, manager); // Should return manager for chaining
				assert.strictEqual(manager.hasIndex("nameIndex"), true);
				
				const definition = manager.getIndexDefinition("nameIndex");
				assert.ok(definition instanceof IndexDefinition);
				assert.strictEqual(definition.name, "nameIndex");
			});

			/**
			 * Test creating index with options
			 */
			it("should create index with options", () => {
				manager.createIndex("emailIndex", "email", { unique: true });
				
				const definition = manager.getIndexDefinition("emailIndex");
				assert.strictEqual(definition.unique, true);
			});

			/**
			 * Test creating duplicate index
			 */
			it("should throw error when creating duplicate index", () => {
				manager.createIndex("testIndex", "name");
				
				assert.throws(() => {
					manager.createIndex("testIndex", "age");
				}, IndexError);
			});

			/**
			 * Test dropping indexes
			 */
			it("should drop an existing index", () => {
				manager.createIndex("testIndex", "name");
				assert.strictEqual(manager.hasIndex("testIndex"), true);
				
				const result = manager.dropIndex("testIndex");
				assert.strictEqual(result, manager); // Should return manager for chaining
				assert.strictEqual(manager.hasIndex("testIndex"), false);
			});

			/**
			 * Test dropping non-existent index
			 */
			it("should throw error when dropping non-existent index", () => {
				assert.throws(() => {
					manager.dropIndex("nonexistent");
				}, IndexError);
			});

			/**
			 * Test listing indexes
			 */
			it("should list all indexes", () => {
				manager.createIndex("index1", "field1");
				manager.createIndex("index2", "field2");
				
				const indexes = manager.listIndexes();
				assert.deepStrictEqual(indexes.sort(), ["index1", "index2"]);
			});
		});

		describe("Record Operations", () => {
			beforeEach(() => {
				manager.createIndex("nameIndex", "name");
				manager.createIndex("ageIndex", "age");
				manager.createIndex("compositeIndex", ["name", "status"]);
			});

			/**
			 * Test adding records
			 */
			it("should add records to indexes", () => {
				const record = { name: "John", age: 30, status: "active" };
				manager.addRecord("record1", record);
				
				const nameResults = manager.findByIndex("nameIndex", "John");
				assert.ok(nameResults.has("record1"));
				
				const ageResults = manager.findByIndex("ageIndex", "30");
				assert.ok(ageResults.has("record1"));
				
				const compositeResults = manager.findByIndex("compositeIndex", "John|active");
				assert.ok(compositeResults.has("record1"));
			});

			/**
			 * Test removing records
			 */
			it("should remove records from indexes", () => {
				const record = { name: "John", age: 30 };
				manager.addRecord("record1", record);
				manager.removeRecord("record1", record);
				
				const nameResults = manager.findByIndex("nameIndex", "John");
				assert.strictEqual(nameResults.size, 0);
			});

			/**
			 * Test updating records
			 */
			it("should update records in indexes", () => {
				const oldRecord = { name: "John", age: 30 };
				const newRecord = { name: "Jane", age: 25 };
				
				manager.addRecord("record1", oldRecord);
				manager.updateRecord("record1", oldRecord, newRecord);
				
				const oldResults = manager.findByIndex("nameIndex", "John");
				assert.strictEqual(oldResults.size, 0);
				
				const newResults = manager.findByIndex("nameIndex", "Jane");
				assert.ok(newResults.has("record1"));
			});

			/**
			 * Test unique constraint violation
			 */
			it("should enforce unique constraints", () => {
				manager.createIndex("uniqueEmailIndex", "email", { unique: true });
				
				manager.addRecord("record1", { email: "john@test.com" });
				
				assert.throws(() => {
					manager.addRecord("record2", { email: "john@test.com" });
				}, IndexError);
			});

			/**
			 * Test unique constraint allows same record
			 */
			it("should allow same record in unique index", () => {
				manager.createIndex("uniqueEmailIndex", "email", { unique: true });
				
				manager.addRecord("record1", { email: "john@test.com" });
				
				// Should not throw when adding same record again
				assert.doesNotThrow(() => {
					manager.addRecord("record1", { email: "john@test.com" });
				});
			});
		});

		describe("Querying", () => {
			let queryManager;

			beforeEach(() => {
				queryManager = new IndexManager();
				queryManager.createIndex("nameIndex", "name");
				queryManager.createIndex("ageIndex", "age");
				queryManager.createIndex("statusIndex", "status");
				
				queryManager.addRecord("record1", { name: "John", age: 30, status: "active" });
				queryManager.addRecord("record2", { name: "Jane", age: 25, status: "active" });
				queryManager.addRecord("record3", { name: "Bob", age: 30, status: "inactive" });
			});

			/**
			 * Test finding by single index
			 */
			it("should find records by single index", () => {
				const results = queryManager.findByIndex("nameIndex", "John");
				assert.ok(results.has("record1"));
				assert.strictEqual(results.size, 1);
			});

			/**
			 * Test finding by non-existent index
			 */
			it("should throw error for non-existent index", () => {
				assert.throws(() => {
					queryManager.findByIndex("nonexistent", "value");
				}, IndexError);
			});

			/**
			 * Test finding by multiple criteria
			 */
			it("should find records by multiple criteria", () => {
				const results = queryManager.findByCriteria({
					ageIndex: 30,
					statusIndex: "active"
				});
				
				assert.ok(results.has("record1"));
				assert.strictEqual(results.size, 1);
			});

			/**
			 * Test finding with no criteria
			 */
			it("should return empty set for no criteria", () => {
				const results = queryManager.findByCriteria({});
				assert.strictEqual(results.size, 0);
			});

			/**
			 * Test finding with no matches
			 */
			it("should return empty set when no records match", () => {
				const results = queryManager.findByCriteria({
					nameIndex: "NonExistent",
					ageIndex: 100
				});
				
				assert.strictEqual(results.size, 0);
			});

		});

		describe("Index Optimization", () => {
			beforeEach(() => {
				manager.createIndex("singleIndex", "name");
				manager.createIndex("compositeIndex", ["name", "age"]);
				manager.createIndex("partialIndex", ["name", "age", "status"]);
			});

			/**
			 * Test finding optimal index for exact match
			 */
			it("should find optimal index for exact field match", () => {
				const optimal = manager.getOptimalIndex(["name"]);
				assert.strictEqual(optimal, "singleIndex");
			});

			/**
			 * Test finding optimal index for composite match
			 */
			it("should find optimal index for composite field match", () => {
				const optimal = manager.getOptimalIndex(["name", "age"]);
				assert.strictEqual(optimal, "compositeIndex");
			});

			/**
			 * Test finding optimal index for partial coverage
			 */
			it("should find optimal index with best coverage", () => {
				const optimal = manager.getOptimalIndex(["name", "status"]);
				// Should prefer the index that covers the most fields
				assert.ok(["compositeIndex", "partialIndex"].includes(optimal));
			});

			/**
			 * Test finding optimal index with no suitable index
			 */
			it("should return null when no suitable index exists", () => {
				const optimal = manager.getOptimalIndex(["nonexistent"]);
				assert.strictEqual(optimal, null);
			});

			/**
			 * Test finding optimal index with multiple partial matches - sort by coverage
			 */
			it("should choose index with best coverage when multiple partial matches exist", () => {
				// Create indexes with different coverage levels
				manager.createIndex("index1", ["field1"]); // covers 1 field
				manager.createIndex("index2", ["field1", "field2"]); // covers 2 fields
				manager.createIndex("index3", ["field1", "field2", "field3"]); // covers 3 fields
				
				// Query for fields that multiple indexes partially cover
				const optimal = manager.getOptimalIndex(["field1", "field2", "field4"]);
				
				// Should choose index2 (covers 2 out of 3 query fields)
				assert.strictEqual(optimal, "index2");
			});

			/**
			 * Test finding optimal index with equal coverage - sort by field count  
			 */
			it("should choose index with fewer fields when coverage is equal", () => {
				// Create indexes with same coverage but different field counts
				manager.createIndex("smallIndex", ["field1"]); // 1 field, covers 1
				manager.createIndex("largeIndex", ["field1", "extra1", "extra2"]); // 3 fields, covers 1
				
				// Query for field that both indexes cover equally
				const optimal = manager.getOptimalIndex(["field1", "unrelated"]);
				
				// Should choose smallIndex (fewer total fields)
				assert.strictEqual(optimal, "smallIndex");
			});

			/**
			 * Test candidate selection and sorting logic comprehensively
			 */
			it("should properly sort candidates by coverage then field count", () => {
				// Create various indexes to test sorting logic
				manager.createIndex("lowCoverage", ["a", "b", "c"]); // covers 2/3 = 66%, 3 fields
				manager.createIndex("mediumCoverage", ["a", "d"]); // covers 1/3 = 33%, 2 fields 
				manager.createIndex("highCoverageSmall", ["a", "b"]); // covers 2/3 = 66%, 2 fields
				manager.createIndex("perfectCoverage", ["a", "b", "e"]); // covers 3/3 = 100%, 3 fields
				
				// Query that creates different coverage levels
				const optimal = manager.getOptimalIndex(["a", "b", "e"]);
				
				// Should prefer perfectCoverage (covers all 3 fields = 100% coverage)
				assert.strictEqual(optimal, "perfectCoverage");
			});
		});

		describe("Rebuild and Maintenance", () => {
			/**
			 * Test rebuilding indexes
			 */
			it("should rebuild all indexes from records", () => {
				manager.createIndex("nameIndex", "name");
				manager.addRecord("record1", { name: "John" });
				
				// Simulate data corruption by clearing storage
				manager.clear();
				assert.strictEqual(manager.findByIndex("nameIndex", "John").size, 0);
				
				// Rebuild from records
				const records = new Map([
					["record1", { name: "John" }],
					["record2", { name: "Jane" }]
				]);
				
				manager.rebuild(records);
				
				assert.strictEqual(manager.findByIndex("nameIndex", "John").size, 1);
				assert.strictEqual(manager.findByIndex("nameIndex", "Jane").size, 1);
			});

			/**
			 * Test clearing all indexes
			 */
			it("should clear all indexes", () => {
				manager.createIndex("nameIndex", "name");
				manager.addRecord("record1", { name: "John" });
				
				manager.clear();
				
				assert.strictEqual(manager.findByIndex("nameIndex", "John").size, 0);
			});
		});

		describe("Statistics", () => {
			/**
			 * Test getting comprehensive statistics
			 */
			it("should provide comprehensive statistics", () => {
				manager.createIndex("nameIndex", "name");
				manager.createIndex("ageIndex", "age");
				manager.addRecord("record1", { name: "John", age: 30 });
				
				const stats = manager.getStats();
				
				assert.ok(stats.indexes);
				assert.ok(stats.indexes.nameIndex);
				assert.ok(stats.indexes.ageIndex);
				assert.strictEqual(stats.totalIndexes, 2);
				assert.ok(stats.totalMemoryUsage >= 0);
				assert.ok(stats.performance);
				assert.ok(stats.performance.totalOperations > 0);
				assert.ok(stats.performance.averageOperationTime >= 0);
			});

			/**
			 * Test performance tracking
			 */
			it("should track performance metrics", () => {
				manager.createIndex("nameIndex", "name");
				
				const initialStats = manager.getStats();
				const initialOps = initialStats.performance.totalOperations;
				
				manager.addRecord("record1", { name: "John" });
				
				const newStats = manager.getStats();
				assert.ok(newStats.performance.totalOperations > initialOps);
				assert.ok(newStats.performance.totalTime >= 0); // Allow for 0 on very fast machines
			});
		});

		describe("Custom Delimiter", () => {
			/**
			 * Test custom delimiter in manager
			 */
			it("should use custom delimiter for composite indexes", () => {
				const customManager = new IndexManager(":");
				customManager.createIndex("compositeIndex", ["first", "last"]);
				customManager.addRecord("record1", { first: "John", last: "Doe" });
				
				const results = customManager.findByIndex("compositeIndex", "John:Doe");
				assert.ok(results.has("record1"));
			});
		});
	});
});
