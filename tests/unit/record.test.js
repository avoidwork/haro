import assert from "node:assert";
import { describe, it } from "mocha";
import { Record, RecordCollection, RecordFactory } from "../../src/record.js";

/**
 * Tests for Record class and related utilities
 */
describe("Record", () => {
	describe("Constructor", () => {
		/**
		 * Test basic record construction
		 */
		it("should create a record with key and data", () => {
			const key = "user1";
			const data = { name: "John", age: 30 };
			const record = new Record(key, data);

			assert.strictEqual(record.key, key);
			assert.deepStrictEqual(record.data, data);
			assert.ok(record.metadata);
			assert.ok(record.metadata.createdAt);
			assert.ok(record.metadata.updatedAt);
			assert.strictEqual(record.metadata.version, 1);
		});

		/**
		 * Test record construction with metadata
		 */
		it("should create a record with custom metadata", () => {
			const key = "user1";
			const data = { name: "John" };
			const metadata = { author: "system", tags: ["test"] };
			const record = new Record(key, data, metadata);

			assert.strictEqual(record.metadata.author, "system");
			assert.deepStrictEqual(record.metadata.tags, ["test"]);
			assert.strictEqual(record.metadata.version, 1);
			assert.ok(record.metadata.createdAt);
			assert.ok(record.metadata.updatedAt);
		});

		/**
		 * Test record immutability
		 */
		it("should create immutable records", () => {
			const record = new Record("test", { name: "John" });

			assert.throws(() => {
				record._key = "changed";
			}, TypeError);

			assert.throws(() => {
				record.newProperty = "value";
			}, TypeError);
		});

		/**
		 * Test metadata timestamps are valid ISO strings
		 */
		it("should have valid ISO timestamp metadata", () => {
			const record = new Record("test", { data: "value" });
			const createdAt = new Date(record.metadata.createdAt);
			const updatedAt = new Date(record.metadata.updatedAt);

			assert.ok(!isNaN(createdAt.getTime()));
			assert.ok(!isNaN(updatedAt.getTime()));
			assert.strictEqual(record.metadata.createdAt, createdAt.toISOString());
			assert.strictEqual(record.metadata.updatedAt, updatedAt.toISOString());
		});
	});

	describe("Getters", () => {
		/**
		 * Test key getter
		 */
		it("should return the correct key", () => {
			const key = "testKey";
			const record = new Record(key, {});

			assert.strictEqual(record.key, key);
		});

		/**
		 * Test data getter returns frozen copy
		 */
		it("should return frozen copy of data", () => {
			const data = { name: "John", items: [1, 2, 3] };
			const record = new Record("test", data);
			const retrievedData = record.data;

			assert.deepStrictEqual(retrievedData, data);
			assert.ok(Object.isFrozen(retrievedData));
			assert.notStrictEqual(retrievedData, data); // Should be a copy
		});

		/**
		 * Test metadata getter returns frozen copy
		 */
		it("should return frozen copy of metadata", () => {
			const record = new Record("test", {}, { custom: "value" });
			const metadata = record.metadata;

			assert.ok(Object.isFrozen(metadata));
			assert.strictEqual(metadata.custom, "value");
			assert.ok(metadata.createdAt);
			assert.ok(metadata.updatedAt);
			assert.strictEqual(metadata.version, 1);
		});
	});

	describe("get()", () => {
		/**
		 * Test getting existing field
		 */
		it("should return field value when field exists", () => {
			const record = new Record("test", { name: "John", age: 30 });

			assert.strictEqual(record.get("name"), "John");
			assert.strictEqual(record.get("age"), 30);
		});

		/**
		 * Test getting non-existing field
		 */
		it("should return undefined when field does not exist", () => {
			const record = new Record("test", { name: "John" });

			assert.strictEqual(record.get("nonexistent"), undefined);
		});

		/**
		 * Test getting nested object properties
		 */
		it("should return nested object field values", () => {
			const record = new Record("test", { 
				user: { name: "John", details: { age: 30 } } 
			});

			assert.deepStrictEqual(record.get("user"), { name: "John", details: { age: 30 } });
		});
	});

	describe("has()", () => {
		/**
		 * Test checking existing field
		 */
		it("should return true for existing fields", () => {
			const record = new Record("test", { name: "John", age: 30, active: false });

			assert.strictEqual(record.has("name"), true);
			assert.strictEqual(record.has("age"), true);
			assert.strictEqual(record.has("active"), true);
		});

		/**
		 * Test checking non-existing field
		 */
		it("should return false for non-existing fields", () => {
			const record = new Record("test", { name: "John" });

			assert.strictEqual(record.has("age"), false);
			assert.strictEqual(record.has("nonexistent"), false);
		});

		/**
		 * Test checking field with undefined value
		 */
		it("should return true for fields with undefined values", () => {
			const record = new Record("test", { name: undefined });

			assert.strictEqual(record.has("name"), true);
		});
	});

	describe("getFields()", () => {
		/**
		 * Test getting all field names
		 */
		it("should return all field names", () => {
			const data = { name: "John", age: 30, active: true };
			const record = new Record("test", data);
			const fields = record.getFields();

			assert.deepStrictEqual(fields.sort(), ["active", "age", "name"]);
		});

		/**
		 * Test empty data object
		 */
		it("should return empty array for empty data", () => {
			const record = new Record("test", {});
			const fields = record.getFields();

			assert.deepStrictEqual(fields, []);
		});
	});

	describe("update()", () => {
		/**
		 * Test basic update
		 */
		it("should create new record with updated data", () => {
			const original = new Record("test", { name: "John", age: 30 });
			const updated = original.update({ age: 31 });

			assert.notStrictEqual(updated, original);
			assert.strictEqual(updated.key, original.key);
			assert.strictEqual(updated.get("name"), "John");
			assert.strictEqual(updated.get("age"), 31);
			assert.strictEqual(updated.metadata.version, 2);
		});

		/**
		 * Test update with new fields
		 */
		it("should add new fields in update", () => {
			const original = new Record("test", { name: "John" });
			const updated = original.update({ age: 30, city: "NYC" });

			assert.strictEqual(updated.get("name"), "John");
			assert.strictEqual(updated.get("age"), 30);
			assert.strictEqual(updated.get("city"), "NYC");
		});

		/**
		 * Test update with metadata changes
		 */
		it("should update metadata when provided", () => {
			const original = new Record("test", { name: "John" }, { author: "user1" });
			const updated = original.update({ age: 30 }, { author: "user2", tags: ["updated"] });

			assert.strictEqual(updated.metadata.author, "user2");
			assert.deepStrictEqual(updated.metadata.tags, ["updated"]);
			assert.strictEqual(updated.metadata.version, 2);
			
			// updatedAt should be a valid timestamp greater than or equal to original
			const originalTime = new Date(original.metadata.updatedAt).getTime();
			const updatedTime = new Date(updated.metadata.updatedAt).getTime();
			assert.ok(updatedTime >= originalTime);
		});

		/**
		 * Test original record remains unchanged
		 */
		it("should not modify original record", () => {
			const original = new Record("test", { name: "John", age: 30 });
			const originalAge = original.get("age");
			const originalVersion = original.metadata.version;

			original.update({ age: 31 });

			assert.strictEqual(original.get("age"), originalAge);
			assert.strictEqual(original.metadata.version, originalVersion);
		});
	});

	describe("toObject()", () => {
		/**
		 * Test basic object conversion
		 */
		it("should convert to plain object without metadata", () => {
			const data = { name: "John", age: 30 };
			const record = new Record("test", data);
			const obj = record.toObject();

			assert.deepStrictEqual(obj, data);
			assert.ok(!obj._metadata);
		});

		/**
		 * Test object conversion with metadata
		 */
		it("should include metadata when requested", () => {
			const data = { name: "John" };
			const record = new Record("test", data, { author: "system" });
			const obj = record.toObject(true);

			assert.deepStrictEqual(obj.name, "John");
			assert.ok(obj._metadata);
			assert.strictEqual(obj._metadata.author, "system");
			assert.strictEqual(obj._metadata.version, 1);
		});
	});

	describe("toJSON()", () => {
		/**
		 * Test JSON conversion without metadata
		 */
		it("should convert to JSON string without metadata", () => {
			const data = { name: "John", age: 30 };
			const record = new Record("test", data);
			const json = record.toJSON();
			const parsed = JSON.parse(json);

			assert.deepStrictEqual(parsed, data);
			assert.ok(!parsed._metadata);
		});

		/**
		 * Test JSON conversion with metadata
		 */
		it("should convert to JSON string with metadata when requested", () => {
			const data = { name: "John" };
			const record = new Record("test", data);
			const json = record.toJSON(true);
			const parsed = JSON.parse(json);

			assert.strictEqual(parsed.name, "John");
			assert.ok(parsed._metadata);
			assert.strictEqual(parsed._metadata.version, 1);
		});
	});

	describe("equals()", () => {
		/**
		 * Test equality with same data
		 */
		it("should return true for records with same key and data", () => {
			const record1 = new Record("test", { name: "John", age: 30 });
			const record2 = new Record("test", { name: "John", age: 30 });

			assert.strictEqual(record1.equals(record2), true);
		});

		/**
		 * Test inequality with different keys
		 */
		it("should return false for records with different keys", () => {
			const record1 = new Record("test1", { name: "John" });
			const record2 = new Record("test2", { name: "John" });

			assert.strictEqual(record1.equals(record2), false);
		});

		/**
		 * Test inequality with different data
		 */
		it("should return false for records with different data", () => {
			const record1 = new Record("test", { name: "John", age: 30 });
			const record2 = new Record("test", { name: "John", age: 31 });

			assert.strictEqual(record1.equals(record2), false);
		});

		/**
		 * Test with non-Record objects
		 */
		it("should return false for non-Record objects", () => {
			const record = new Record("test", { name: "John" });

			assert.strictEqual(record.equals(null), false);
			assert.strictEqual(record.equals({}), false);
			assert.strictEqual(record.equals("string"), false);
		});
	});

	describe("clone()", () => {
		/**
		 * Test basic cloning
		 */
		it("should create a deep clone of the record", () => {
			const original = new Record("test", { 
				name: "John", 
				items: [1, 2, 3],
				meta: { key: "value" }
			});
			const cloned = original.clone();

			assert.notStrictEqual(cloned, original);
			assert.strictEqual(cloned.key, original.key);
			assert.deepStrictEqual(cloned.data, original.data);
			assert.deepStrictEqual(cloned.metadata, original.metadata);
		});

		/**
		 * Test clone independence
		 */
		it("should create independent copies", () => {
			const original = new Record("test", { items: [1, 2, 3] });
			const cloned = original.clone();

			// Verify they are independent instances
			assert.notStrictEqual(cloned._data, original._data);
			assert.notStrictEqual(cloned._metadata, original._metadata);
		});
	});

	describe("getSize()", () => {
		/**
		 * Test size calculation
		 */
		it("should estimate record size", () => {
			const record = new Record("test", { name: "John" });
			const size = record.getSize();

			assert.ok(typeof size === "number");
			assert.ok(size > 0);
		});

		/**
		 * Test larger records have larger size
		 */
		it("should return larger size for larger records", () => {
			const small = new Record("test", { name: "A" });
			const large = new Record("test", { 
				name: "John",
				description: "A very long description with lots of text",
				items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			});

			assert.ok(large.getSize() > small.getSize());
		});
	});

	describe("matches()", () => {
		/**
		 * Test function predicate matching
		 */
		it("should match using function predicate", () => {
			const record = new Record("test", { name: "John", age: 30 });
			
			const matchesName = record.matches((data) => data.name === "John");
			const matchesAge = record.matches((data) => data.age > 25);
			const noMatch = record.matches((data) => data.name === "Jane");

			assert.strictEqual(matchesName, true);
			assert.strictEqual(matchesAge, true);
			assert.strictEqual(noMatch, false);
		});

		/**
		 * Test function predicate with key and record parameters
		 */
		it("should pass data, key, and record to function predicate", () => {
			const record = new Record("user123", { name: "John" });
			
			const result = record.matches((data, key, rec) => {
				assert.deepStrictEqual(data, { name: "John" });
				assert.strictEqual(key, "user123");
				assert.strictEqual(rec, record);
				return true;
			});

			assert.strictEqual(result, true);
		});

		/**
		 * Test object predicate matching
		 */
		it("should match using object predicate", () => {
			const record = new Record("test", { name: "John", age: 30, active: true });
			
			assert.strictEqual(record.matches({ name: "John" }), true);
			assert.strictEqual(record.matches({ name: "John", age: 30 }), true);
			assert.strictEqual(record.matches({ name: "Jane" }), false);
			assert.strictEqual(record.matches({ age: 25 }), false);
		});

		/**
		 * Test regex matching in object predicate
		 */
		it("should match using regex in object predicate", () => {
			const record = new Record("test", { name: "John", email: "john@example.com" });
			
			assert.strictEqual(record.matches({ name: /^Jo/ }), true);
			assert.strictEqual(record.matches({ email: /@example\.com$/ }), true);
			assert.strictEqual(record.matches({ name: /^Jane/ }), false);
		});

		/**
		 * Test array matching in object predicate
		 */
		it("should match using arrays in object predicate", () => {
			const record1 = new Record("test1", { tags: ["red", "blue"] });
			const record2 = new Record("test2", { category: "tech" });
			
			// Array field contains any of the values
			assert.strictEqual(record1.matches({ tags: ["red", "green"] }), true);
			assert.strictEqual(record1.matches({ tags: ["yellow"] }), false);
			
			// Non-array field is in the array
			assert.strictEqual(record2.matches({ category: ["tech", "science"] }), true);
			assert.strictEqual(record2.matches({ category: ["art", "music"] }), false);
		});

		/**
		 * Test invalid predicate types
		 */
		it("should return false for invalid predicate types", () => {
			const record = new Record("test", { name: "John" });
			
			assert.strictEqual(record.matches(null), false);
			assert.strictEqual(record.matches(undefined), false);
			assert.strictEqual(record.matches("string"), false);
			assert.strictEqual(record.matches(123), false);
		});
	});

	describe("toString()", () => {
		/**
		 * Test string representation
		 */
		it("should return proper string representation", () => {
			const record = new Record("user123", { name: "John", age: 30 });
			const str = record.toString();

			assert.ok(str.includes("Record"));
			assert.ok(str.includes("user123"));
			assert.ok(str.includes("John"));
			assert.ok(str.includes("30"));
		});
	});

	describe("Iterator", () => {
		/**
		 * Test record iteration
		 */
		it("should be iterable over field-value pairs", () => {
			const data = { name: "John", age: 30, active: true };
			const record = new Record("test", data);
			const pairs = Array.from(record);

			assert.strictEqual(pairs.length, 3);
			assert.ok(pairs.some(([field, value]) => field === "name" && value === "John"));
			assert.ok(pairs.some(([field, value]) => field === "age" && value === 30));
			assert.ok(pairs.some(([field, value]) => field === "active" && value === true));
		});

		/**
		 * Test iteration with for...of
		 */
		it("should work with for...of loops", () => {
			const record = new Record("test", { a: 1, b: 2 });
			const result = {};

			for (const [field, value] of record) {
				result[field] = value;
			}

			assert.deepStrictEqual(result, { a: 1, b: 2 });
		});
	});
});

/**
 * Tests for RecordCollection class
 */
describe("RecordCollection", () => {
	const createTestRecords = () => [
		new Record("user1", { name: "John", age: 30, role: "admin" }),
		new Record("user2", { name: "Jane", age: 25, role: "user" }),
		new Record("user3", { name: "Bob", age: 35, role: "user" })
	];

	describe("Constructor", () => {
		/**
		 * Test empty collection construction
		 */
		it("should create empty collection by default", () => {
			const collection = new RecordCollection();

			assert.strictEqual(collection.length, 0);
		});

		/**
		 * Test collection construction with records
		 */
		it("should create collection with provided records", () => {
			const records = createTestRecords();
			const collection = new RecordCollection(records);

			assert.strictEqual(collection.length, 3);
			assert.strictEqual(collection.at(0), records[0]);
		});

		/**
		 * Test collection immutability
		 */
		it("should create immutable collections", () => {
			const collection = new RecordCollection();

			assert.throws(() => {
				collection.newProperty = "value";
			}, TypeError);
		});
	});

	describe("Basic Access", () => {
		/**
		 * Test length property
		 */
		it("should return correct length", () => {
			const empty = new RecordCollection();
			const withRecords = new RecordCollection(createTestRecords());

			assert.strictEqual(empty.length, 0);
			assert.strictEqual(withRecords.length, 3);
		});

		/**
		 * Test at() method
		 */
		it("should return record at specific index", () => {
			const records = createTestRecords();
			const collection = new RecordCollection(records);

			assert.strictEqual(collection.at(0), records[0]);
			assert.strictEqual(collection.at(1), records[1]);
			assert.strictEqual(collection.at(2), records[2]);
			assert.strictEqual(collection.at(5), undefined);
			assert.strictEqual(collection.at(-1), undefined);
		});

		/**
		 * Test first() method
		 */
		it("should return first record", () => {
			const empty = new RecordCollection();
			const withRecords = new RecordCollection(createTestRecords());

			assert.strictEqual(empty.first(), undefined);
			assert.strictEqual(withRecords.first().key, "user1");
		});

		/**
		 * Test last() method
		 */
		it("should return last record", () => {
			const empty = new RecordCollection();
			const withRecords = new RecordCollection(createTestRecords());

			assert.strictEqual(empty.last(), undefined);
			assert.strictEqual(withRecords.last().key, "user3");
		});
	});

	describe("Functional Methods", () => {
		/**
		 * Test filter() method
		 */
		it("should filter records correctly", () => {
			const collection = new RecordCollection(createTestRecords());
			const admins = collection.filter(record => record.get("role") === "admin");
			const adults = collection.filter(record => record.get("age") >= 30);

			assert.strictEqual(admins.length, 1);
			assert.strictEqual(admins.first().key, "user1");
			assert.strictEqual(adults.length, 2);
			assert.ok(adults instanceof RecordCollection);
		});

		/**
		 * Test map() method
		 */
		it("should map records to values", () => {
			const collection = new RecordCollection(createTestRecords());
			const names = collection.map(record => record.get("name"));
			const keys = collection.map(record => record.key);

			assert.deepStrictEqual(names, ["John", "Jane", "Bob"]);
			assert.deepStrictEqual(keys, ["user1", "user2", "user3"]);
		});

		/**
		 * Test find() method
		 */
		it("should find first matching record", () => {
			const collection = new RecordCollection(createTestRecords());
			const jane = collection.find(record => record.get("name") === "Jane");
			const adult = collection.find(record => record.get("age") >= 30);
			const missing = collection.find(record => record.get("name") === "Unknown");

			assert.strictEqual(jane.key, "user2");
			assert.strictEqual(adult.key, "user1");
			assert.strictEqual(missing, undefined);
		});

		/**
		 * Test some() method
		 */
		it("should check if some records match predicate", () => {
			const collection = new RecordCollection(createTestRecords());

			assert.strictEqual(collection.some(record => record.get("age") > 30), true);
			assert.strictEqual(collection.some(record => record.get("role") === "admin"), true);
			assert.strictEqual(collection.some(record => record.get("age") > 50), false);
		});

		/**
		 * Test every() method
		 */
		it("should check if all records match predicate", () => {
			const collection = new RecordCollection(createTestRecords());

			assert.strictEqual(collection.every(record => record.get("age") > 20), true);
			assert.strictEqual(collection.every(record => record.get("role") === "user"), false);
			assert.strictEqual(collection.every(record => typeof record.get("name") === "string"), true);
		});

		/**
		 * Test sort() method
		 */
		it("should sort records correctly", () => {
			const collection = new RecordCollection(createTestRecords());
			const byAge = collection.sort((a, b) => a.get("age") - b.get("age"));
			const byName = collection.sort((a, b) => a.get("name").localeCompare(b.get("name")));

			assert.strictEqual(byAge.at(0).key, "user2"); // Jane, 25
			assert.strictEqual(byAge.at(1).key, "user1"); // John, 30
			assert.strictEqual(byAge.at(2).key, "user3"); // Bob, 35

			assert.strictEqual(byName.at(0).get("name"), "Bob");
			assert.strictEqual(byName.at(1).get("name"), "Jane");
			assert.strictEqual(byName.at(2).get("name"), "John");
			assert.ok(byAge instanceof RecordCollection);
		});

		/**
		 * Test slice() method
		 */
		it("should slice records correctly", () => {
			const collection = new RecordCollection(createTestRecords());
			const first2 = collection.slice(0, 2);
			const last2 = collection.slice(1);
			const middle = collection.slice(1, 2);

			assert.strictEqual(first2.length, 2);
			assert.strictEqual(first2.at(0).key, "user1");
			assert.strictEqual(first2.at(1).key, "user2");

			assert.strictEqual(last2.length, 2);
			assert.strictEqual(last2.at(0).key, "user2");
			assert.strictEqual(last2.at(1).key, "user3");

			assert.strictEqual(middle.length, 1);
			assert.strictEqual(middle.at(0).key, "user2");
			assert.ok(first2 instanceof RecordCollection);
		});

		/**
		 * Test reduce() method
		 */
		it("should reduce records to single value", () => {
			const collection = new RecordCollection(createTestRecords());
			const totalAge = collection.reduce((sum, record) => sum + record.get("age"), 0);
			const allNames = collection.reduce((names, record) => {
				names.push(record.get("name"));
				return names;
			}, []);

			assert.strictEqual(totalAge, 90); // 30 + 25 + 35
			assert.deepStrictEqual(allNames, ["John", "Jane", "Bob"]);
		});
	});

	describe("Conversion Methods", () => {
		/**
		 * Test toArray() method
		 */
		it("should convert to array of records", () => {
			const records = createTestRecords();
			const collection = new RecordCollection(records);
			const array = collection.toArray();

			assert.ok(Array.isArray(array));
			assert.strictEqual(array.length, 3);
			assert.strictEqual(array[0], records[0]);
			assert.notStrictEqual(array, records); // Should be a copy
		});

		/**
		 * Test toObjects() method without metadata
		 */
		it("should convert to array of plain objects", () => {
			const collection = new RecordCollection(createTestRecords());
			const objects = collection.toObjects();

			assert.ok(Array.isArray(objects));
			assert.strictEqual(objects.length, 3);
			assert.deepStrictEqual(objects[0], { name: "John", age: 30, role: "admin" });
			assert.ok(!objects[0]._metadata);
		});

		/**
		 * Test toObjects() method with metadata
		 */
		it("should convert to array of objects with metadata when requested", () => {
			const collection = new RecordCollection(createTestRecords());
			const objects = collection.toObjects(true);

			assert.strictEqual(objects.length, 3);
			assert.ok(objects[0]._metadata);
			assert.strictEqual(objects[0]._metadata.version, 1);
		});

		/**
		 * Test toPairs() method
		 */
		it("should convert to key-value pairs", () => {
			const collection = new RecordCollection(createTestRecords());
			const pairs = collection.toPairs();

			assert.ok(Array.isArray(pairs));
			assert.strictEqual(pairs.length, 3);
			assert.deepStrictEqual(pairs[0], ["user1", { name: "John", age: 30, role: "admin" }]);
			assert.deepStrictEqual(pairs[1], ["user2", { name: "Jane", age: 25, role: "user" }]);
		});
	});

	describe("Utility Methods", () => {
		/**
		 * Test groupBy() with field name
		 */
		it("should group by field name", () => {
			const collection = new RecordCollection(createTestRecords());
			const groups = collection.groupBy("role");

			assert.ok(groups instanceof Map);
			assert.strictEqual(groups.size, 2);
			assert.strictEqual(groups.get("admin").length, 1);
			assert.strictEqual(groups.get("user").length, 2);
			assert.ok(groups.get("admin") instanceof RecordCollection);
		});

		/**
		 * Test groupBy() with function
		 */
		it("should group by function", () => {
			const collection = new RecordCollection(createTestRecords());
			const groups = collection.groupBy(record => record.get("age") >= 30 ? "senior" : "junior");

			assert.strictEqual(groups.size, 2);
			assert.strictEqual(groups.get("senior").length, 2);
			assert.strictEqual(groups.get("junior").length, 1);
		});

		/**
		 * Test unique() method
		 */
		it("should return unique records by key", () => {
			const records = [
				...createTestRecords(),
				new Record("user1", { name: "John2", age: 31 }) // Duplicate key
			];
			const collection = new RecordCollection(records);
			const unique = collection.unique();

			assert.strictEqual(unique.length, 3);
			assert.strictEqual(unique.find(r => r.key === "user1").get("name"), "John"); // First occurrence
			assert.ok(unique instanceof RecordCollection);
		});

		/**
		 * Test forEach() method
		 */
		it("should iterate with forEach", () => {
			const collection = new RecordCollection(createTestRecords());
			const visited = [];

			collection.forEach((record, index) => {
				visited.push({ key: record.key, index });
			});

			assert.strictEqual(visited.length, 3);
			assert.strictEqual(visited[0].key, "user1");
			assert.strictEqual(visited[0].index, 0);
		});
	});

	describe("Iterator", () => {
		/**
		 * Test collection iteration
		 */
		it("should be iterable over records", () => {
			const collection = new RecordCollection(createTestRecords());
			const keys = [];

			for (const record of collection) {
				keys.push(record.key);
			}

			assert.deepStrictEqual(keys, ["user1", "user2", "user3"]);
		});

		/**
		 * Test with Array.from()
		 */
		it("should work with Array.from", () => {
			const collection = new RecordCollection(createTestRecords());
			const array = Array.from(collection);

			assert.strictEqual(array.length, 3);
			assert.ok(array.every(item => item instanceof Record));
		});
	});

	describe("toString()", () => {
		/**
		 * Test string representation
		 */
		it("should return proper string representation", () => {
			const collection = new RecordCollection(createTestRecords());
			const str = collection.toString();

			assert.ok(str.includes("RecordCollection"));
			assert.ok(str.includes("3 records"));
		});

		/**
		 * Test empty collection string
		 */
		it("should handle empty collection string representation", () => {
			const collection = new RecordCollection();
			const str = collection.toString();

			assert.ok(str.includes("RecordCollection"));
			assert.ok(str.includes("0 records"));
		});
	});
});

/**
 * Tests for RecordFactory
 */
describe("RecordFactory", () => {
	describe("create()", () => {
		/**
		 * Test basic record creation
		 */
		it("should create a record with key and data", () => {
			const record = RecordFactory.create("user1", { name: "John", age: 30 });

			assert.ok(record instanceof Record);
			assert.strictEqual(record.key, "user1");
			assert.strictEqual(record.get("name"), "John");
			assert.strictEqual(record.get("age"), 30);
		});

		/**
		 * Test record creation with metadata
		 */
		it("should create a record with metadata", () => {
			const metadata = { author: "system", tags: ["test"] };
			const record = RecordFactory.create("test", { name: "Test" }, metadata);

			assert.strictEqual(record.metadata.author, "system");
			assert.deepStrictEqual(record.metadata.tags, ["test"]);
			assert.strictEqual(record.metadata.version, 1);
		});
	});

	describe("fromObject()", () => {
		/**
		 * Test creating record from object with default key field
		 */
		it("should create record from object with default key field", () => {
			const data = { id: "user1", name: "John", age: 30 };
			const record = RecordFactory.fromObject(data);

			assert.ok(record instanceof Record);
			assert.strictEqual(record.key, "user1");
			assert.strictEqual(record.get("id"), "user1");
			assert.strictEqual(record.get("name"), "John");
			assert.strictEqual(record.get("age"), 30);
		});

		/**
		 * Test creating record from object with custom key field
		 */
		it("should create record from object with custom key field", () => {
			const data = { username: "john_doe", name: "John", age: 30 };
			const record = RecordFactory.fromObject(data, "username");

			assert.strictEqual(record.key, "john_doe");
			assert.strictEqual(record.get("username"), "john_doe");
			assert.strictEqual(record.get("name"), "John");
		});

		/**
		 * Test creating record with metadata
		 */
		it("should create record with metadata", () => {
			const data = { id: "user1", name: "John" };
			const metadata = { source: "import" };
			const record = RecordFactory.fromObject(data, "id", metadata);

			assert.strictEqual(record.metadata.source, "import");
			assert.strictEqual(record.metadata.version, 1);
		});

		/**
		 * Test error when key field is missing
		 */
		it("should throw error when key field is missing", () => {
			const data = { name: "John", age: 30 };

			assert.throws(() => {
				RecordFactory.fromObject(data);
			}, Error, "Key field 'id' not found in data");
		});

		/**
		 * Test error when custom key field is missing
		 */
		it("should throw error when custom key field is missing", () => {
			const data = { id: "user1", name: "John" };

			assert.throws(() => {
				RecordFactory.fromObject(data, "username");
			}, Error, "Key field 'username' not found in data");
		});

		/**
		 * Test with undefined or null key value
		 */
		it("should throw error when key field has falsy value", () => {
			const dataWithNull = { id: null, name: "John" };
			const dataWithUndefined = { id: undefined, name: "John" };
			const dataWithEmptyString = { id: "", name: "John" };

			assert.throws(() => {
				RecordFactory.fromObject(dataWithNull);
			}, Error);

			assert.throws(() => {
				RecordFactory.fromObject(dataWithUndefined);
			}, Error);

			assert.throws(() => {
				RecordFactory.fromObject(dataWithEmptyString);
			}, Error);
		});

		/**
		 * Test with numeric key
		 */
		it("should handle numeric key values", () => {
			const data = { id: 123, name: "John" };
			const record = RecordFactory.fromObject(data);

			assert.strictEqual(record.key, 123);
			assert.strictEqual(record.get("id"), 123);
		});
	});

	describe("createCollection()", () => {
		/**
		 * Test creating collection from Record instances
		 */
		it("should create collection from Record instances", () => {
			const records = [
				new Record("user1", { name: "John" }),
				new Record("user2", { name: "Jane" })
			];
			const collection = RecordFactory.createCollection(records);

			assert.ok(collection instanceof RecordCollection);
			assert.strictEqual(collection.length, 2);
			assert.strictEqual(collection.at(0).key, "user1");
			assert.strictEqual(collection.at(1).key, "user2");
		});

		/**
		 * Test creating collection from plain objects with default key field
		 */
		it("should create collection from plain objects with default key field", () => {
			const data = [
				{ id: "user1", name: "John", age: 30 },
				{ id: "user2", name: "Jane", age: 25 }
			];
			const collection = RecordFactory.createCollection(data);

			assert.ok(collection instanceof RecordCollection);
			assert.strictEqual(collection.length, 2);
			assert.strictEqual(collection.at(0).key, "user1");
			assert.strictEqual(collection.at(1).key, "user2");
		});

		/**
		 * Test creating collection from plain objects with custom key field
		 */
		it("should create collection from plain objects with custom key field", () => {
			const data = [
				{ username: "john_doe", name: "John" },
				{ username: "jane_doe", name: "Jane" }
			];
			const collection = RecordFactory.createCollection(data, "username");

			assert.strictEqual(collection.length, 2);
			assert.strictEqual(collection.at(0).key, "john_doe");
			assert.strictEqual(collection.at(1).key, "jane_doe");
		});

		/**
		 * Test creating collection from mixed Record and object items
		 */
		it("should create collection from mixed Record and object items", () => {
			const items = [
				new Record("user1", { name: "John" }),
				{ id: "user2", name: "Jane", age: 25 }
			];
			const collection = RecordFactory.createCollection(items);

			assert.strictEqual(collection.length, 2);
			assert.strictEqual(collection.at(0).key, "user1");
			assert.strictEqual(collection.at(1).key, "user2");
			assert.ok(collection.at(0) instanceof Record);
			assert.ok(collection.at(1) instanceof Record);
		});

		/**
		 * Test creating collection from empty array
		 */
		it("should create empty collection from empty array", () => {
			const collection = RecordFactory.createCollection([]);

			assert.ok(collection instanceof RecordCollection);
			assert.strictEqual(collection.length, 0);
		});

		/**
		 * Test error handling for objects without key field
		 */
		it("should throw error when objects missing key field", () => {
			const data = [
				{ id: "user1", name: "John" },
				{ name: "Jane", age: 25 } // Missing id
			];

			assert.throws(() => {
				RecordFactory.createCollection(data);
			}, Error);
		});
	});

	describe("emptyCollection()", () => {
		/**
		 * Test creating empty collection
		 */
		it("should create empty collection", () => {
			const collection = RecordFactory.emptyCollection();

			assert.ok(collection instanceof RecordCollection);
			assert.strictEqual(collection.length, 0);
		});

		/**
		 * Test multiple empty collections are independent
		 */
		it("should create independent empty collections", () => {
			const collection1 = RecordFactory.emptyCollection();
			const collection2 = RecordFactory.emptyCollection();

			assert.notStrictEqual(collection1, collection2);
			assert.strictEqual(collection1.length, collection2.length);
		});
	});

	describe("Error Handling", () => {
		/**
		 * Test comprehensive error scenarios
		 */
		it("should handle various error scenarios gracefully", () => {
			// Missing key in fromObject
			assert.throws(() => {
				RecordFactory.fromObject({ name: "John" });
			}, Error);

			// Custom key field missing
			assert.throws(() => {
				RecordFactory.fromObject({ id: "test" }, "customId");
			}, Error);

			// Collection creation with missing keys
			assert.throws(() => {
				RecordFactory.createCollection([{ name: "John" }]);
			}, Error);

			// Collection creation with custom key field missing
			assert.throws(() => {
				RecordFactory.createCollection([{ id: "test" }], "customId");
			}, Error);
		});
	});

	describe("Integration Tests", () => {
		/**
		 * Test end-to-end factory usage
		 */
		it("should support complete workflow", () => {
			// Create individual records
			const record1 = RecordFactory.create("user1", { name: "John" });
			const record2 = RecordFactory.fromObject({ id: "user2", name: "Jane" });

			// Create collection from mixed sources
			const collection = RecordFactory.createCollection([
				record1,
				{ id: "user3", name: "Bob", age: 35 }
			]);

			// Verify everything works together
			assert.strictEqual(collection.length, 2);
			assert.strictEqual(collection.at(0).key, "user1");
			assert.strictEqual(collection.at(1).key, "user3");

			// Test collection methods work
			const names = collection.map(r => r.get("name"));
			assert.deepStrictEqual(names, ["John", "Bob"]);
		});

		/**
		 * Test factory methods preserve Record functionality
		 */
		it("should create fully functional Records", () => {
			const record = RecordFactory.fromObject({ 
				id: "test", 
				name: "John", 
				tags: ["admin", "user"] 
			});

			// Test all Record methods work
			assert.strictEqual(record.has("name"), true);
			assert.strictEqual(record.get("name"), "John");
			assert.deepStrictEqual(record.getFields().sort(), ["id", "name", "tags"]);

			// Test update works
			const updated = record.update({ age: 30 });
			assert.strictEqual(updated.get("age"), 30);
			assert.strictEqual(updated.metadata.version, 2);

			// Test matching works
			assert.strictEqual(record.matches({ name: "John" }), true);
			assert.strictEqual(record.matches(r => r.name === "John"), true);

			// Test conversion works
			const obj = record.toObject();
			assert.deepStrictEqual(obj, { id: "test", name: "John", tags: ["admin", "user"] });
		});
	});
});
