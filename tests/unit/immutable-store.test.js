/**
 * Unit tests for ImmutableStore
 */
import assert from "node:assert";
import { describe, it, beforeEach } from "mocha";
import { ImmutableStore } from "../../src/immutable-store.js";

describe("ImmutableStore", () => {
	describe("constructor", () => {
		it("should create empty store when no data provided", () => {
			const store = new ImmutableStore();
			assert.strictEqual(store.size, 0);
			assert.deepStrictEqual(store.keys(), []);
		});

		it("should create store with initial data", () => {
			const initialData = new Map([
				["key1", { name: "test1" }],
				["key2", { name: "test2" }]
			]);
			const store = new ImmutableStore(initialData);
			
			assert.strictEqual(store.size, 2);
			assert.deepStrictEqual(store.keys().sort(), ["key1", "key2"]);
		});

		it("should freeze the store instance", () => {
			const store = new ImmutableStore();
			assert.ok(Object.isFrozen(store));
		});

		it("should create independent copy of initial data", () => {
			const initialData = new Map([["key1", { name: "test1" }]]);
			const store = new ImmutableStore(initialData);
			
			// Modify original data
			initialData.set("key2", { name: "test2" });
			
			// Store should not be affected
			assert.strictEqual(store.size, 1);
			assert.ok(!store.has("key2"));
		});
	});

	describe("get", () => {
		it("should return null for non-existing key", () => {
			const store = new ImmutableStore();
			assert.strictEqual(store.get("nonexistent"), null);
		});

		it("should return frozen record for existing key", () => {
			const store = new ImmutableStore(new Map([
				["key1", { name: "test", nested: { value: 42 } }]
			]));
			
			const result = store.get("key1");
			assert.ok(result !== null);
			assert.ok(Object.isFrozen(result));
			assert.ok(Object.isFrozen(result.nested));
		});

		it("should return same frozen view on subsequent calls (caching)", () => {
			const store = new ImmutableStore(new Map([
				["key1", { name: "test" }]
			]));
			
			const result1 = store.get("key1");
			const result2 = store.get("key1");
			
			// Should return the exact same frozen object
			assert.strictEqual(result1, result2);
		});

		it("should handle arrays in records", () => {
			const store = new ImmutableStore(new Map([
				["key1", { items: [1, 2, { nested: true }] }]
			]));
			
			const result = store.get("key1");
			assert.ok(Object.isFrozen(result));
			assert.ok(Object.isFrozen(result.items));
			assert.ok(Object.isFrozen(result.items[2]));
		});

		it("should handle null and primitive values in records", () => {
			const store = new ImmutableStore(new Map([
				["key1", { 
					nullValue: null, 
					stringValue: "test",
					numberValue: 42,
					booleanValue: true,
					undefinedValue: undefined
				}]
			]));
			
			const result = store.get("key1");
			assert.ok(Object.isFrozen(result));
			assert.strictEqual(result.nullValue, null);
			assert.strictEqual(result.stringValue, "test");
			assert.strictEqual(result.numberValue, 42);
			assert.strictEqual(result.booleanValue, true);
			assert.strictEqual(result.undefinedValue, undefined);
		});
	});

	describe("set", () => {
		it("should create new store with added record", () => {
			const originalStore = new ImmutableStore();
			const newStore = originalStore.set("key1", { name: "test" });
			
			// Original store unchanged
			assert.strictEqual(originalStore.size, 0);
			assert.ok(!originalStore.has("key1"));
			
			// New store has the record
			assert.strictEqual(newStore.size, 1);
			assert.ok(newStore.has("key1"));
			assert.strictEqual(newStore.get("key1").name, "test");
		});

		it("should create new store with updated record", () => {
			const originalStore = new ImmutableStore(new Map([
				["key1", { name: "original" }]
			]));
			const newStore = originalStore.set("key1", { name: "updated" });
			
			// Original store unchanged
			assert.strictEqual(originalStore.get("key1").name, "original");
			
			// New store has updated record
			assert.strictEqual(newStore.get("key1").name, "updated");
		});

		it("should maintain other records when setting new one", () => {
			const originalStore = new ImmutableStore(new Map([
				["key1", { name: "test1" }],
				["key2", { name: "test2" }]
			]));
			const newStore = originalStore.set("key3", { name: "test3" });
			
			assert.strictEqual(newStore.size, 3);
			assert.strictEqual(newStore.get("key1").name, "test1");
			assert.strictEqual(newStore.get("key2").name, "test2");
			assert.strictEqual(newStore.get("key3").name, "test3");
		});

		it("should return new ImmutableStore instance", () => {
			const originalStore = new ImmutableStore();
			const newStore = originalStore.set("key1", { name: "test" });
			
			assert.ok(newStore instanceof ImmutableStore);
			assert.notStrictEqual(originalStore, newStore);
		});
	});

	describe("delete", () => {
		it("should create new store without deleted record", () => {
			const originalStore = new ImmutableStore(new Map([
				["key1", { name: "test1" }],
				["key2", { name: "test2" }]
			]));
			const newStore = originalStore.delete("key1");
			
			// Original store unchanged
			assert.strictEqual(originalStore.size, 2);
			assert.ok(originalStore.has("key1"));
			
			// New store has record removed
			assert.strictEqual(newStore.size, 1);
			assert.ok(!newStore.has("key1"));
			assert.ok(newStore.has("key2"));
		});

		it("should handle deleting non-existing key", () => {
			const originalStore = new ImmutableStore(new Map([
				["key1", { name: "test1" }]
			]));
			const newStore = originalStore.delete("nonexistent");
			
			// Should create new store but size remains same
			assert.strictEqual(newStore.size, 1);
			assert.ok(newStore.has("key1"));
			assert.notStrictEqual(originalStore, newStore);
		});

		it("should return new ImmutableStore instance", () => {
			const originalStore = new ImmutableStore(new Map([
				["key1", { name: "test" }]
			]));
			const newStore = originalStore.delete("key1");
			
			assert.ok(newStore instanceof ImmutableStore);
			assert.notStrictEqual(originalStore, newStore);
		});
	});

	describe("has", () => {
		it("should return true for existing key", () => {
			const store = new ImmutableStore(new Map([
				["key1", { name: "test" }]
			]));
			
			assert.strictEqual(store.has("key1"), true);
		});

		it("should return false for non-existing key", () => {
			const store = new ImmutableStore(new Map([
				["key1", { name: "test" }]
			]));
			
			assert.strictEqual(store.has("nonexistent"), false);
		});

		it("should return false for empty store", () => {
			const store = new ImmutableStore();
			assert.strictEqual(store.has("anykey"), false);
		});
	});

	describe("keys", () => {
		it("should return empty array for empty store", () => {
			const store = new ImmutableStore();
			const keys = store.keys();
			
			assert.ok(Array.isArray(keys));
			assert.strictEqual(keys.length, 0);
		});

		it("should return all keys as array", () => {
			const store = new ImmutableStore(new Map([
				["key1", { name: "test1" }],
				["key2", { name: "test2" }],
				["key3", { name: "test3" }]
			]));
			const keys = store.keys();
			
			assert.ok(Array.isArray(keys));
			assert.strictEqual(keys.length, 3);
			assert.deepStrictEqual(keys.sort(), ["key1", "key2", "key3"]);
		});

		it("should return new array each time", () => {
			const store = new ImmutableStore(new Map([
				["key1", { name: "test1" }]
			]));
			const keys1 = store.keys();
			const keys2 = store.keys();
			
			assert.notStrictEqual(keys1, keys2);
			assert.deepStrictEqual(keys1, keys2);
		});
	});

	describe("size", () => {
		it("should return 0 for empty store", () => {
			const store = new ImmutableStore();
			assert.strictEqual(store.size, 0);
		});

		it("should return correct size for populated store", () => {
			const store = new ImmutableStore(new Map([
				["key1", { name: "test1" }],
				["key2", { name: "test2" }],
				["key3", { name: "test3" }]
			]));
			
			assert.strictEqual(store.size, 3);
		});

		it("should update size after operations", () => {
			let store = new ImmutableStore();
			assert.strictEqual(store.size, 0);
			
			store = store.set("key1", { name: "test" });
			assert.strictEqual(store.size, 1);
			
			store = store.delete("key1");
			assert.strictEqual(store.size, 0);
		});
	});

	describe("entries", () => {
		it("should return empty array for empty store", () => {
			const store = new ImmutableStore();
			const entries = store.entries();
			
			assert.ok(Array.isArray(entries));
			assert.strictEqual(entries.length, 0);
		});

		it("should return all entries as array of [key, value] pairs", () => {
			const data = new Map([
				["key1", { name: "test1" }],
				["key2", { name: "test2" }]
			]);
			const store = new ImmutableStore(data);
			const entries = store.entries();
			
			assert.ok(Array.isArray(entries));
			assert.strictEqual(entries.length, 2);
			
			// Check structure
			entries.forEach(entry => {
				assert.ok(Array.isArray(entry));
				assert.strictEqual(entry.length, 2);
			});
			
			// Convert to Map for easier comparison
			const entriesMap = new Map(entries);
			assert.deepStrictEqual(entriesMap.get("key1"), { name: "test1" });
			assert.deepStrictEqual(entriesMap.get("key2"), { name: "test2" });
		});

		it("should return new array each time", () => {
			const store = new ImmutableStore(new Map([
				["key1", { name: "test1" }]
			]));
			const entries1 = store.entries();
			const entries2 = store.entries();
			
			assert.notStrictEqual(entries1, entries2);
			assert.deepStrictEqual(entries1, entries2);
		});
	});

	describe("_deepFreeze", () => {
		let store;

		beforeEach(() => {
			store = new ImmutableStore();
		});

		it("should return primitive values unchanged", () => {
			assert.strictEqual(store._deepFreeze(42), 42);
			assert.strictEqual(store._deepFreeze("test"), "test");
			assert.strictEqual(store._deepFreeze(true), true);
			assert.strictEqual(store._deepFreeze(undefined), undefined);
		});

		it("should return null unchanged", () => {
			assert.strictEqual(store._deepFreeze(null), null);
		});

		it("should freeze simple objects", () => {
			const obj = { name: "test", value: 42 };
			const frozen = store._deepFreeze(obj);
			
			assert.strictEqual(frozen, obj); // Same reference
			assert.ok(Object.isFrozen(frozen));
		});

		it("should freeze nested objects deeply", () => {
			const obj = {
				name: "test",
				nested: {
					value: 42,
					deeper: {
						flag: true
					}
				}
			};
			const frozen = store._deepFreeze(obj);
			
			assert.ok(Object.isFrozen(frozen));
			assert.ok(Object.isFrozen(frozen.nested));
			assert.ok(Object.isFrozen(frozen.nested.deeper));
		});

		it("should freeze arrays and their elements", () => {
			const arr = [1, "test", { nested: true }];
			const frozen = store._deepFreeze(arr);
			
			assert.strictEqual(frozen, arr); // Same reference
			assert.ok(Object.isFrozen(frozen));
			assert.ok(Object.isFrozen(frozen[2]));
		});

		it("should handle arrays with nested arrays", () => {
			const arr = [1, [2, [3, { deep: true }]]];
			const frozen = store._deepFreeze(arr);
			
			assert.ok(Object.isFrozen(frozen));
			assert.ok(Object.isFrozen(frozen[1]));
			assert.ok(Object.isFrozen(frozen[1][1]));
			assert.ok(Object.isFrozen(frozen[1][1][1]));
		});

		it("should handle mixed object and array structures", () => {
			const obj = {
				items: [
					{ id: 1, tags: ["tag1", "tag2"] },
					{ id: 2, metadata: { type: "test" } }
				],
				config: {
					enabled: true,
					options: [1, 2, 3]
				}
			};
			const frozen = store._deepFreeze(obj);
			
			assert.ok(Object.isFrozen(frozen));
			assert.ok(Object.isFrozen(frozen.items));
			assert.ok(Object.isFrozen(frozen.items[0]));
			assert.ok(Object.isFrozen(frozen.items[0].tags));
			assert.ok(Object.isFrozen(frozen.items[1].metadata));
			assert.ok(Object.isFrozen(frozen.config));
			assert.ok(Object.isFrozen(frozen.config.options));
		});
	});

	describe("immutability properties", () => {
		it("should maintain structural sharing between stores", () => {
			const store1 = new ImmutableStore(new Map([
				["key1", { name: "test1" }],
				["key2", { name: "test2" }]
			]));
			
			const store2 = store1.set("key3", { name: "test3" });
			
			// Both stores should have their own data maps
			assert.notStrictEqual(store1._data, store2._data);
			
			// But they should share unchanged records
			assert.strictEqual(store1._data.get("key1"), store2._data.get("key1"));
			assert.strictEqual(store1._data.get("key2"), store2._data.get("key2"));
		});

		it("should prevent modification of returned frozen objects", () => {
			const store = new ImmutableStore(new Map([
				["key1", { name: "test", items: [1, 2, 3] }]
			]));
			
			const record = store.get("key1");
			
			// Should throw when trying to modify frozen object
			assert.throws(() => {
				record.name = "modified";
			}, TypeError);
			
			assert.throws(() => {
				record.items.push(4);
			}, TypeError);
		});

		it("should ensure store operations return new instances", () => {
			const store1 = new ImmutableStore();
			const store2 = store1.set("key1", { name: "test" });
			const store3 = store2.delete("key1");
			
			assert.notStrictEqual(store1, store2);
			assert.notStrictEqual(store2, store3);
			assert.notStrictEqual(store1, store3);
		});

		it("should maintain frozen views cache across store copies", () => {
			const initialData = new Map([["key1", { name: "test" }]]);
			const store1 = new ImmutableStore(initialData);
			const store2 = new ImmutableStore(initialData);
			
			// Each store should have its own frozen views cache
			const record1 = store1.get("key1");
			const record2 = store2.get("key1");
			
			// Should be different frozen objects
			assert.notStrictEqual(record1, record2);
			
			// But should have same data
			assert.deepStrictEqual(record1, record2);
		});
	});
});
