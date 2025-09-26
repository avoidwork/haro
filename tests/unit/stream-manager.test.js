import assert from "node:assert";
import { describe, it, beforeEach } from "mocha";
import { StreamManager } from "../../src/stream-manager.js";
import { DataStream } from "../../src/data-stream.js";

/**
 * Mock StorageManager for testing
 */
class MockStorageManager {
	constructor(entries = []) {
		this._entries = entries;
	}

	entries() {
		// Return array like the real StorageManager does
		return [...this._entries];
	}

	setEntries(entries) {
		this._entries = entries;
	}
}

/**
 * Tests for StreamManager class
 */
describe("StreamManager", () => {
	let mockStorageManager;
	let streamManager;

	beforeEach(() => {
		mockStorageManager = new MockStorageManager();
		streamManager = new StreamManager({ storageManager: mockStorageManager });
	});

	describe("Constructor", () => {
		/**
		 * Test basic constructor with required dependencies
		 */
		it("should create StreamManager with storageManager dependency", () => {
			const manager = new StreamManager({ storageManager: mockStorageManager });

			assert.strictEqual(manager.storageManager, mockStorageManager);
		});

		/**
		 * Test constructor validates required dependencies
		 */
		it("should accept storageManager in dependencies object", () => {
			const customStorage = new MockStorageManager([["key1", { name: "test" }]]);
			const manager = new StreamManager({ storageManager: customStorage });

			assert.strictEqual(manager.storageManager, customStorage);
		});
	});

	describe("stream()", () => {
		/**
		 * Test basic stream creation with default options
		 */
		it("should create DataStream with default options", () => {
			const entries = [
				["key1", { name: "Alice", age: 25 }],
				["key2", { name: "Bob", age: 30 }]
			];
			mockStorageManager.setEntries(entries);

			const stream = streamManager.stream();

			assert.ok(stream instanceof DataStream);
			assert.strictEqual(stream.options.batchSize, 1000);
			assert.strictEqual(stream.options.bufferSize, 10000);
		});

		/**
		 * Test stream creation with custom options
		 */
		it("should create DataStream with custom options", () => {
			const entries = [["key1", { name: "test" }]];
			mockStorageManager.setEntries(entries);
			const options = { batchSize: 50, bufferSize: 500 };

			const stream = streamManager.stream(options);

			assert.ok(stream instanceof DataStream);
			assert.strictEqual(stream.options.batchSize, 50);
			assert.strictEqual(stream.options.bufferSize, 500);
		});

		/**
		 * Test stream with empty storage
		 */
		it("should create stream for empty storage", () => {
			mockStorageManager.setEntries([]);

			const stream = streamManager.stream();

			assert.ok(stream instanceof DataStream);
		});

		/**
		 * Test stream can read data from storage entries
		 */
		it("should create stream that can read storage entries", async () => {
			const entries = [
				["key1", { name: "Alice", age: 25 }],
				["key2", { name: "Bob", age: 30 }],
				["key3", { name: "Charlie", age: 35 }]
			];
			mockStorageManager.setEntries(entries);

			const stream = streamManager.stream();
			const data = await stream.readAll();

			assert.strictEqual(data.length, 3);
			assert.deepStrictEqual(data[0], ["key1", { name: "Alice", age: 25 }]);
			assert.deepStrictEqual(data[1], ["key2", { name: "Bob", age: 30 }]);
			assert.deepStrictEqual(data[2], ["key3", { name: "Charlie", age: 35 }]);
		});
	});

	describe("streamWhere()", () => {
		beforeEach(() => {
			const entries = [
				["user1", { name: "Alice", age: 25, active: true, tags: ["admin", "user"] }],
				["user2", { name: "Bob", age: 17, active: false, tags: ["user"] }],
				["user3", { name: "Charlie", age: 30, active: true, tags: ["moderator"] }],
				["user4", { name: "Diana", age: 28, active: true, tags: ["admin", "moderator"] }]
			];
			mockStorageManager.setEntries(entries);
		});

		/**
		 * Test filtering with function predicate
		 */
		it("should filter stream with function predicate", async () => {
			const predicate = ({ age, active }) => age >= 18 && active;
			const stream = streamManager.streamWhere(predicate);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 3);
			assert.strictEqual(data[0][0], "user1"); // Alice
			assert.strictEqual(data[1][0], "user3"); // Charlie
			assert.strictEqual(data[2][0], "user4"); // Diana
		});

		/**
		 * Test filtering with object criteria - direct value match
		 */
		it("should filter stream with object criteria for direct values", async () => {
			const criteria = { active: true, age: 25 };
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 1);
			assert.strictEqual(data[0][0], "user1"); // Only Alice matches
			assert.strictEqual(data[0][1].name, "Alice");
		});

		/**
		 * Test filtering with RegExp criteria
		 */
		it("should filter stream with RegExp criteria", async () => {
			const criteria = { name: /^A/ }; // Names starting with 'A'
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 1);
			assert.strictEqual(data[0][0], "user1");
			assert.strictEqual(data[0][1].name, "Alice");
		});

		/**
		 * Test filtering with array criteria - record has array value
		 */
		it("should filter stream with array criteria when record has array", async () => {
			const criteria = { tags: ["admin"] };
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 2);
			assert.strictEqual(data[0][0], "user1"); // Alice has admin tag
			assert.strictEqual(data[1][0], "user4"); // Diana has admin tag
		});

		/**
		 * Test filtering with array criteria - record has single value
		 */
		it("should filter stream with array criteria when record has single value", async () => {
			// Add a record with single tag value instead of array
			const entries = [
				["user1", { name: "Alice", role: "admin" }],
				["user2", { name: "Bob", role: "user" }],
				["user3", { name: "Charlie", role: "moderator" }]
			];
			mockStorageManager.setEntries(entries);

			const criteria = { role: ["admin", "moderator"] };
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 2);
			assert.strictEqual(data[0][1].name, "Alice");
			assert.strictEqual(data[1][1].name, "Charlie");
		});

		/**
		 * Test filtering with multiple criteria
		 */
		it("should filter stream with multiple criteria", async () => {
			const criteria = { active: true, age: 30 };
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 1);
			assert.strictEqual(data[0][1].name, "Charlie");
		});

		/**
		 * Test filtering with no matches
		 */
		it("should return empty stream when no records match", async () => {
			const criteria = { age: 100 };
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 0);
		});

		/**
		 * Test filtering with custom options
		 */
		it("should create filtered stream with custom options", () => {
			const predicate = ({ active }) => active;
			const options = { batchSize: 25 };
			const stream = streamManager.streamWhere(predicate, options);

			assert.ok(stream instanceof DataStream);
			assert.strictEqual(stream.options.batchSize, 25);
		});

		/**
		 * Test function predicate includes key in record
		 */
		it("should include key in record for function predicate", async () => {
			const predicate = ({ key }) => key === "user2";
			const stream = streamManager.streamWhere(predicate);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 1);
			assert.strictEqual(data[0][0], "user2");
			assert.strictEqual(data[0][1].name, "Bob");
		});
	});

	describe("streamMap()", () => {
		beforeEach(() => {
			const entries = [
				["user1", { name: "Alice", age: 25 }],
				["user2", { name: "Bob", age: 30 }],
				["user3", { name: "Charlie", age: 35 }]
			];
			mockStorageManager.setEntries(entries);
		});

		/**
		 * Test basic transformation
		 */
		it("should transform stream data with transform function", async () => {
			const transform = ({ name, age, key }) => ({ id: key, fullName: name, yearsOld: age });
			const stream = streamManager.streamMap(transform);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 3);
			assert.deepStrictEqual(data[0], ["user1", { id: "user1", fullName: "Alice", yearsOld: 25 }]);
			assert.deepStrictEqual(data[1], ["user2", { id: "user2", fullName: "Bob", yearsOld: 30 }]);
			assert.deepStrictEqual(data[2], ["user3", { id: "user3", fullName: "Charlie", yearsOld: 35 }]);
		});

		/**
		 * Test transformation with key access
		 */
		it("should provide key in transform function", async () => {
			const transform = ({ key, name }) => ({ recordKey: key, userName: name });
			const stream = streamManager.streamMap(transform);

			const data = await stream.readAll();

			assert.strictEqual(data[0][1].recordKey, "user1");
			assert.strictEqual(data[1][1].recordKey, "user2");
			assert.strictEqual(data[2][1].recordKey, "user3");
		});

		/**
		 * Test transformation with custom options
		 */
		it("should create transformed stream with custom options", () => {
			const transform = ({ name }) => ({ transformedName: name });
			const options = { batchSize: 10 };
			const stream = streamManager.streamMap(transform, options);

			assert.ok(stream instanceof DataStream);
			assert.strictEqual(stream.options.batchSize, 10);
		});

		/**
		 * Test transformation with empty storage
		 */
		it("should handle empty storage", async () => {
			mockStorageManager.setEntries([]);
			const transform = ({ name }) => ({ transformedName: name });
			const stream = streamManager.streamMap(transform);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 0);
		});

		/**
		 * Test complex transformation
		 */
		it("should handle complex transformations", async () => {
			const transform = ({ key, name, age }) => ({
				id: key.toUpperCase(),
				profile: {
					displayName: `${name} (${age}y)`,
					category: age >= 30 ? "senior" : "junior"
				},
				active: true
			});
			const stream = streamManager.streamMap(transform);

			const data = await stream.readAll();

			assert.strictEqual(data[0][1].id, "USER1");
			assert.strictEqual(data[0][1].profile.displayName, "Alice (25y)");
			assert.strictEqual(data[0][1].profile.category, "junior");
			assert.strictEqual(data[1][1].profile.category, "senior");
		});
	});

	describe("streamTake()", () => {
		beforeEach(() => {
			const entries = Array.from({ length: 10 }, (_, i) => [
				`key${i}`,
				{ id: i, name: `User${i}`, value: i * 10 }
			]);
			mockStorageManager.setEntries(entries);
		});

		/**
		 * Test basic limit functionality
		 */
		it("should limit stream to specified number of records", async () => {
			const stream = streamManager.streamTake(5);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 5);
			assert.strictEqual(data[0][0], "key0");
			assert.strictEqual(data[4][0], "key4");
		});

		/**
		 * Test limit larger than available records
		 */
		it("should return all records when limit exceeds storage size", async () => {
			const stream = streamManager.streamTake(20);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 10); // Only 10 records available
		});

		/**
		 * Test zero limit
		 */
		it("should return empty stream for zero limit", async () => {
			const stream = streamManager.streamTake(0);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 0);
		});

		/**
		 * Test negative limit
		 */
		it("should return empty stream for negative limit", async () => {
			const stream = streamManager.streamTake(-5);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 0);
		});

		/**
		 * Test take with custom options
		 */
		it("should create limited stream with custom options", () => {
			const options = { batchSize: 15 };
			const stream = streamManager.streamTake(3, options);

			assert.ok(stream instanceof DataStream);
			assert.strictEqual(stream.options.batchSize, 15);
		});

		/**
		 * Test take with empty storage
		 */
		it("should handle empty storage", async () => {
			mockStorageManager.setEntries([]);
			const stream = streamManager.streamTake(5);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 0);
		});

		/**
		 * Test take preserves original data structure
		 */
		it("should preserve original [key, value] structure", async () => {
			const stream = streamManager.streamTake(3);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 3);
			data.forEach((entry, index) => {
				assert.ok(Array.isArray(entry));
				assert.strictEqual(entry.length, 2);
				assert.strictEqual(entry[0], `key${index}`);
				assert.strictEqual(entry[1].id, index);
			});
		});
	});

	describe("_matchesCriteria() via streamWhere()", () => {
		/**
		 * Test RegExp matching that fails
		 */
		it("should handle RegExp criteria that don't match", async () => {
			const entries = [["key1", { name: "Alice", email: "alice@test.com" }]];
			mockStorageManager.setEntries(entries);

			const criteria = { email: /gmail\.com$/ };
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 0);
		});

		/**
		 * Test array criteria with record array that doesn't contain any values
		 */
		it("should handle array criteria with non-matching record arrays", async () => {
			const entries = [["key1", { tags: ["user", "basic"], roles: ["viewer"] }]];
			mockStorageManager.setEntries(entries);

			const criteria = { tags: ["admin", "moderator"] };
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 0);
		});

		/**
		 * Test direct value matching that fails
		 */
		it("should handle direct value criteria that don't match", async () => {
			const entries = [["key1", { status: "active", level: 5 }]];
			mockStorageManager.setEntries(entries);

			const criteria = { status: "inactive", level: 10 };
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 0);
		});

		/**
		 * Test mixed criteria types
		 */
		it("should handle mixed criteria types", async () => {
			const entries = [
				["key1", { name: "Alice", email: "alice@test.com", tags: ["admin"], level: 5 }],
				["key2", { name: "Bob", email: "bob@gmail.com", tags: ["user"], level: 3 }]
			];
			mockStorageManager.setEntries(entries);

			const criteria = {
				email: /@gmail\.com$/,        // RegExp
				tags: ["admin", "moderator"], // Array
				level: 3                      // Direct value
			};
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 0); // No record matches all criteria
		});

		/**
		 * Test criteria with undefined/null record values
		 */
		it("should handle undefined and null record values", async () => {
			const entries = [
				["key1", { name: "Alice", email: null, tags: undefined }],
				["key2", { name: "Bob", email: "bob@test.com" }] // missing tags
			];
			mockStorageManager.setEntries(entries);

			const criteria = { email: null };
			const stream = streamManager.streamWhere(criteria);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 1);
			assert.strictEqual(data[0][1].name, "Alice");
		});
	});

	describe("Integration and Edge Cases", () => {
		/**
		 * Test combining multiple stream operations
		 */
		it("should work with chained stream operations", async () => {
			const entries = [
				["user1", { name: "Alice", age: 25, active: true }],
				["user2", { name: "Bob", age: 17, active: false }],
				["user3", { name: "Charlie", age: 30, active: true }],
				["user4", { name: "Diana", age: 28, active: true }],
				["user5", { name: "Eve", age: 22, active: true }]
			];
			mockStorageManager.setEntries(entries);

			// Chain: filter adults -> transform -> limit
			const whereStream = streamManager.streamWhere(({ age, active }) => age >= 18 && active);
			const whereData = await whereStream.readAll();

			const mapStream = streamManager.streamMap(({ key, name, age }) => ({
				id: key,
				displayName: `${name} (${age})`
			}));
			const mapData = await mapStream.readAll();

			const takeStream = streamManager.streamTake(2);
			const takeData = await takeStream.readAll();

			// Verify filtering worked
			assert.strictEqual(whereData.length, 4); // Excludes Bob (17 years old)

			// Verify transformation worked
			assert.strictEqual(mapData.length, 5);
			assert.strictEqual(mapData[0][1].displayName, "Alice (25)");

			// Verify limiting worked
			assert.strictEqual(takeData.length, 2);
		});

		/**
		 * Test with complex nested record structures
		 */
		it("should handle complex nested record structures", async () => {
			const entries = [
				["doc1", {
					title: "Document 1",
					metadata: {
						author: { name: "Alice", email: "alice@test.com" },
						tags: ["important", "draft"],
						stats: { views: 100, likes: 15 }
					},
					content: { sections: 5, words: 1200 }
				}]
			];
			mockStorageManager.setEntries(entries);

			// Test function predicate with nested access
			const predicate = ({ metadata }) => metadata.stats.views > 50;
			const stream = streamManager.streamWhere(predicate);

			const data = await stream.readAll();

			assert.strictEqual(data.length, 1);
			assert.strictEqual(data[0][1].title, "Document 1");
		});

		/**
		 * Test with large number of records
		 */
		it("should handle large number of records efficiently", async () => {
			const entries = Array.from({ length: 1000 }, (_, i) => [
				`record${i}`,
				{ id: i, value: Math.random(), category: i % 3 === 0 ? "A" : "B" }
			]);
			mockStorageManager.setEntries(entries);

			const stream = streamManager.streamWhere({ category: "A" });
			const data = await stream.readAll();

			// Should have approximately 334 records (every 3rd record)
			assert.ok(data.length >= 333 && data.length <= 334);
			assert.ok(data.every(([, value]) => value.category === "A"));
		});

		/**
		 * Test empty entries handling in all stream methods
		 */
		it("should handle empty entries in all stream methods", async () => {
			mockStorageManager.setEntries([]);

			const basicStream = streamManager.stream();
			const whereStream = streamManager.streamWhere(() => true);
			const mapStream = streamManager.streamMap(x => x);
			const takeStream = streamManager.streamTake(10);

			const [basicData, whereData, mapData, takeData] = await Promise.all([
				basicStream.readAll(),
				whereStream.readAll(),
				mapStream.readAll(),
				takeStream.readAll()
			]);

			assert.strictEqual(basicData.length, 0);
			assert.strictEqual(whereData.length, 0);
			assert.strictEqual(mapData.length, 0);
			assert.strictEqual(takeData.length, 0);
		});

		/**
		 * Test that stream operations don't modify original storage
		 */
		it("should not modify original storage entries", async () => {
			const originalEntries = [
				["key1", { name: "Alice", age: 25 }],
				["key2", { name: "Bob", age: 30 }]
			];
			mockStorageManager.setEntries(originalEntries);

			// Create streams and read data
			const whereStream = streamManager.streamWhere(() => true);
			const mapStream = streamManager.streamMap(({ name }) => ({ modifiedName: name }));
			const takeStream = streamManager.streamTake(1);

			await Promise.all([
				whereStream.readAll(),
				mapStream.readAll(),
				takeStream.readAll()
			]);

			// Original storage should be unchanged
			const currentEntries = mockStorageManager.entries();
			assert.deepStrictEqual(currentEntries, originalEntries);
		});

		/**
		 * Test DataStream instances are properly created
		 */
		it("should return DataStream instances for all stream methods", () => {
			const entries = [["key1", { name: "test" }]];
			mockStorageManager.setEntries(entries);

			const basicStream = streamManager.stream();
			const whereStream = streamManager.streamWhere(() => true);
			const mapStream = streamManager.streamMap(x => x);
			const takeStream = streamManager.streamTake(5);

			assert.ok(basicStream instanceof DataStream);
			assert.ok(whereStream instanceof DataStream);
			assert.ok(mapStream instanceof DataStream);
			assert.ok(takeStream instanceof DataStream);
		});
	});
});
