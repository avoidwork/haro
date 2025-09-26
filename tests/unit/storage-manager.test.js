/**
 * Unit tests for StorageManager
 */
import assert from "node:assert";
import { describe, it, beforeEach } from "mocha";
import { StorageManager } from "../../src/storage-manager.js";
import { ImmutableStore } from "../../src/immutable-store.js";

describe("StorageManager", () => {
	describe("constructor", () => {
		it("should create mutable store by default", () => {
			const manager = new StorageManager();
			
			assert.strictEqual(manager.config.immutable, false);
			assert.ok(manager._store instanceof Map);
			assert.strictEqual(manager.size, 0);
		});

		it("should create mutable store with explicit config", () => {
			const manager = new StorageManager({ immutable: false });
			
			assert.strictEqual(manager.config.immutable, false);
			assert.ok(manager._store instanceof Map);
		});

		it("should create immutable store when configured", () => {
			const manager = new StorageManager({ immutable: true });
			
			assert.strictEqual(manager.config.immutable, true);
			assert.ok(manager._store instanceof ImmutableStore);
		});

		it("should merge config with defaults", () => {
			const manager = new StorageManager({ 
				immutable: true,
				customProperty: "test"
			});
			
			assert.strictEqual(manager.config.immutable, true);
			assert.strictEqual(manager.config.customProperty, "test");
		});

		it("should handle empty config object", () => {
			const manager = new StorageManager({});
			
			assert.strictEqual(manager.config.immutable, false);
			assert.ok(manager._store instanceof Map);
		});
	});

	describe("mutable store operations", () => {
		let manager;

		beforeEach(() => {
			manager = new StorageManager({ immutable: false });
		});

		describe("get", () => {
			it("should return null for non-existing key", () => {
				const result = manager.get("nonexistent");
				assert.strictEqual(result, null);
			});

			it("should return record for existing key", () => {
				const data = { name: "test", value: 42 };
				manager.set("key1", data);
				
				const result = manager.get("key1");
				assert.deepStrictEqual(result, data);
			});

			it("should return null for undefined value from store", () => {
				// Directly set undefined in the underlying Map
				manager._store.set("key1", undefined);
				
				const result = manager.get("key1");
				assert.strictEqual(result, null);
			});
		});

		describe("set", () => {
			it("should store record and return true", () => {
				const data = { name: "test", value: 42 };
				const result = manager.set("key1", data);
				
				assert.strictEqual(result, true);
				assert.deepStrictEqual(manager.get("key1"), data);
				assert.strictEqual(manager.size, 1);
			});

			it("should update existing record", () => {
				manager.set("key1", { name: "original" });
				const result = manager.set("key1", { name: "updated" });
				
				assert.strictEqual(result, true);
				assert.deepStrictEqual(manager.get("key1"), { name: "updated" });
				assert.strictEqual(manager.size, 1);
			});

			it("should handle complex nested objects", () => {
				const data = {
					name: "test",
					nested: {
						array: [1, 2, { deep: true }],
						object: { prop: "value" }
					}
				};
				
				manager.set("key1", data);
				assert.deepStrictEqual(manager.get("key1"), data);
			});

			it("should handle null values", () => {
				manager.set("key1", null);
				assert.strictEqual(manager.get("key1"), null);
			});
		});

		describe("delete", () => {
			it("should remove existing record and return true", () => {
				manager.set("key1", { name: "test" });
				const result = manager.delete("key1");
				
				assert.strictEqual(result, true);
				assert.strictEqual(manager.get("key1"), null);
				assert.strictEqual(manager.size, 0);
			});

			it("should handle deleting non-existing key", () => {
				const result = manager.delete("nonexistent");
				
				assert.strictEqual(result, true);
				assert.strictEqual(manager.size, 0);
			});

			it("should not affect other records", () => {
				manager.set("key1", { name: "test1" });
				manager.set("key2", { name: "test2" });
				
				manager.delete("key1");
				
				assert.strictEqual(manager.get("key1"), null);
				assert.deepStrictEqual(manager.get("key2"), { name: "test2" });
				assert.strictEqual(manager.size, 1);
			});
		});

		describe("has", () => {
			it("should return true for existing key", () => {
				manager.set("key1", { name: "test" });
				assert.strictEqual(manager.has("key1"), true);
			});

			it("should return false for non-existing key", () => {
				assert.strictEqual(manager.has("nonexistent"), false);
			});

			it("should return false for deleted key", () => {
				manager.set("key1", { name: "test" });
				manager.delete("key1");
				assert.strictEqual(manager.has("key1"), false);
			});
		});

		describe("keys", () => {
			it("should return empty array for empty store", () => {
				const keys = manager.keys();
				assert.ok(Array.isArray(keys));
				assert.strictEqual(keys.length, 0);
			});

			it("should return all keys as array", () => {
				manager.set("key1", { name: "test1" });
				manager.set("key2", { name: "test2" });
				manager.set("key3", { name: "test3" });
				
				const keys = manager.keys();
				assert.ok(Array.isArray(keys));
				assert.strictEqual(keys.length, 3);
				assert.deepStrictEqual(keys.sort(), ["key1", "key2", "key3"]);
			});

			it("should return new array each time", () => {
				manager.set("key1", { name: "test" });
				
				const keys1 = manager.keys();
				const keys2 = manager.keys();
				
				assert.notStrictEqual(keys1, keys2);
				assert.deepStrictEqual(keys1, keys2);
			});
		});

		describe("entries", () => {
			it("should return empty array for empty store", () => {
				const entries = manager.entries();
				assert.ok(Array.isArray(entries));
				assert.strictEqual(entries.length, 0);
			});

			it("should return all entries as array of [key, value] pairs", () => {
				const data1 = { name: "test1" };
				const data2 = { name: "test2" };
				
				manager.set("key1", data1);
				manager.set("key2", data2);
				
				const entries = manager.entries();
				assert.ok(Array.isArray(entries));
				assert.strictEqual(entries.length, 2);
				
				// Check structure
				entries.forEach(entry => {
					assert.ok(Array.isArray(entry));
					assert.strictEqual(entry.length, 2);
				});
				
				// Convert to Map for easier comparison
				const entriesMap = new Map(entries);
				assert.deepStrictEqual(entriesMap.get("key1"), data1);
				assert.deepStrictEqual(entriesMap.get("key2"), data2);
			});

			it("should return new array each time", () => {
				manager.set("key1", { name: "test" });
				
				const entries1 = manager.entries();
				const entries2 = manager.entries();
				
				assert.notStrictEqual(entries1, entries2);
				assert.deepStrictEqual(entries1, entries2);
			});
		});

		describe("size", () => {
			it("should return 0 for empty store", () => {
				assert.strictEqual(manager.size, 0);
			});

			it("should return correct size after adding records", () => {
				manager.set("key1", { name: "test1" });
				assert.strictEqual(manager.size, 1);
				
				manager.set("key2", { name: "test2" });
				assert.strictEqual(manager.size, 2);
			});

			it("should update size after deleting records", () => {
				manager.set("key1", { name: "test1" });
				manager.set("key2", { name: "test2" });
				assert.strictEqual(manager.size, 2);
				
				manager.delete("key1");
				assert.strictEqual(manager.size, 1);
			});

			it("should not change size when updating existing record", () => {
				manager.set("key1", { name: "original" });
				assert.strictEqual(manager.size, 1);
				
				manager.set("key1", { name: "updated" });
				assert.strictEqual(manager.size, 1);
			});
		});

		describe("clear", () => {
			it("should remove all records from empty store", () => {
				manager.clear();
				assert.strictEqual(manager.size, 0);
			});

			it("should remove all records from populated store", () => {
				manager.set("key1", { name: "test1" });
				manager.set("key2", { name: "test2" });
				assert.strictEqual(manager.size, 2);
				
				manager.clear();
				
				assert.strictEqual(manager.size, 0);
				assert.strictEqual(manager.get("key1"), null);
				assert.strictEqual(manager.get("key2"), null);
				assert.strictEqual(manager.has("key1"), false);
				assert.strictEqual(manager.has("key2"), false);
			});

			it("should allow adding new records after clear", () => {
				manager.set("key1", { name: "test1" });
				manager.clear();
				
				manager.set("key2", { name: "test2" });
				assert.strictEqual(manager.size, 1);
				assert.deepStrictEqual(manager.get("key2"), { name: "test2" });
			});
		});

		describe("getStore", () => {
			it("should return underlying Map instance", () => {
				const store = manager.getStore();
				assert.ok(store instanceof Map);
				assert.strictEqual(store, manager._store);
			});

			it("should return store with current data", () => {
				manager.set("key1", { name: "test" });
				
				const store = manager.getStore();
				assert.ok(store.has("key1"));
				assert.deepStrictEqual(store.get("key1"), { name: "test" });
			});
		});
	});

	describe("immutable store operations", () => {
		let manager;

		beforeEach(() => {
			manager = new StorageManager({ immutable: true });
		});

		describe("get", () => {
			it("should return null for non-existing key", () => {
				const result = manager.get("nonexistent");
				assert.strictEqual(result, null);
			});

			it("should return frozen record for existing key", () => {
				const data = { name: "test", value: 42 };
				manager.set("key1", data);
				
				const result = manager.get("key1");
				assert.deepStrictEqual(result, data);
				assert.ok(Object.isFrozen(result));
			});
		});

		describe("set", () => {
			it("should create new store instance and return true", () => {
				const originalStore = manager._store;
				const data = { name: "test", value: 42 };
				
				const result = manager.set("key1", data);
				
				assert.strictEqual(result, true);
				assert.notStrictEqual(manager._store, originalStore);
				assert.deepStrictEqual(manager.get("key1"), data);
				assert.strictEqual(manager.size, 1);
			});

			it("should update existing record with new store instance", () => {
				manager.set("key1", { name: "original" });
				const intermediateStore = manager._store;
				
				const result = manager.set("key1", { name: "updated" });
				
				assert.strictEqual(result, true);
				assert.notStrictEqual(manager._store, intermediateStore);
				assert.deepStrictEqual(manager.get("key1"), { name: "updated" });
			});
		});

		describe("delete", () => {
			it("should create new store instance and return true", () => {
				manager.set("key1", { name: "test" });
				const originalStore = manager._store;
				
				const result = manager.delete("key1");
				
				assert.strictEqual(result, true);
				assert.notStrictEqual(manager._store, originalStore);
				assert.strictEqual(manager.get("key1"), null);
				assert.strictEqual(manager.size, 0);
			});

			it("should handle deleting non-existing key", () => {
				const originalStore = manager._store;
				const result = manager.delete("nonexistent");
				
				assert.strictEqual(result, true);
				assert.notStrictEqual(manager._store, originalStore);
				assert.strictEqual(manager.size, 0);
			});
		});

		describe("has", () => {
			it("should return true for existing key", () => {
				manager.set("key1", { name: "test" });
				assert.strictEqual(manager.has("key1"), true);
			});

			it("should return false for non-existing key", () => {
				assert.strictEqual(manager.has("nonexistent"), false);
			});
		});

		describe("keys", () => {
			it("should return empty array for empty store", () => {
				const keys = manager.keys();
				assert.ok(Array.isArray(keys));
				assert.strictEqual(keys.length, 0);
			});

			it("should return all keys as array", () => {
				manager.set("key1", { name: "test1" });
				manager.set("key2", { name: "test2" });
				
				const keys = manager.keys();
				assert.ok(Array.isArray(keys));
				assert.strictEqual(keys.length, 2);
				assert.deepStrictEqual(keys.sort(), ["key1", "key2"]);
			});
		});

		describe("entries", () => {
			it("should return empty array for empty store", () => {
				const entries = manager.entries();
				assert.ok(Array.isArray(entries));
				assert.strictEqual(entries.length, 0);
			});

			it("should return all entries as array of [key, value] pairs", () => {
				const data1 = { name: "test1" };
				const data2 = { name: "test2" };
				
				manager.set("key1", data1);
				manager.set("key2", data2);
				
				const entries = manager.entries();
				assert.ok(Array.isArray(entries));
				assert.strictEqual(entries.length, 2);
				
				// Convert to Map for easier comparison
				const entriesMap = new Map(entries);
				assert.deepStrictEqual(entriesMap.get("key1"), data1);
				assert.deepStrictEqual(entriesMap.get("key2"), data2);
			});
		});

		describe("size", () => {
			it("should return 0 for empty store", () => {
				assert.strictEqual(manager.size, 0);
			});

			it("should return correct size after operations", () => {
				manager.set("key1", { name: "test1" });
				assert.strictEqual(manager.size, 1);
				
				manager.set("key2", { name: "test2" });
				assert.strictEqual(manager.size, 2);
				
				manager.delete("key1");
				assert.strictEqual(manager.size, 1);
			});
		});

		describe("clear", () => {
			it("should create new empty ImmutableStore instance", () => {
				manager.set("key1", { name: "test1" });
				manager.set("key2", { name: "test2" });
				const originalStore = manager._store;
				
				manager.clear();
				
				assert.notStrictEqual(manager._store, originalStore);
				assert.ok(manager._store instanceof ImmutableStore);
				assert.strictEqual(manager.size, 0);
				assert.strictEqual(manager.get("key1"), null);
				assert.strictEqual(manager.get("key2"), null);
			});

			it("should allow adding records after clear", () => {
				manager.set("key1", { name: "test1" });
				manager.clear();
				
				manager.set("key2", { name: "test2" });
				assert.strictEqual(manager.size, 1);
				assert.deepStrictEqual(manager.get("key2"), { name: "test2" });
			});
		});

		describe("getStore", () => {
			it("should return underlying ImmutableStore instance", () => {
				const store = manager.getStore();
				assert.ok(store instanceof ImmutableStore);
				assert.strictEqual(store, manager._store);
			});

			it("should return store with current data", () => {
				manager.set("key1", { name: "test" });
				
				const store = manager.getStore();
				assert.ok(store.has("key1"));
				assert.deepStrictEqual(store.get("key1"), { name: "test" });
			});
		});
	});

	describe("estimateMemoryUsage", () => {
		it("should return 0 for empty store", () => {
			const manager = new StorageManager();
			assert.strictEqual(manager.estimateMemoryUsage(), 0);
		});

		it("should calculate memory usage for mutable store", () => {
			const manager = new StorageManager();
			manager.set("key1", { name: "test" });
			
			const usage = manager.estimateMemoryUsage();
			assert.ok(usage > 0);
			assert.ok(typeof usage === "number");
		});

		it("should calculate memory usage for immutable store", () => {
			const manager = new StorageManager({ immutable: true });
			manager.set("key1", { name: "test" });
			
			const usage = manager.estimateMemoryUsage();
			assert.ok(usage > 0);
			assert.ok(typeof usage === "number");
		});

		it("should increase with more data", () => {
			const manager = new StorageManager();
			
			const usage1 = manager.estimateMemoryUsage();
			
			manager.set("key1", { name: "test" });
			const usage2 = manager.estimateMemoryUsage();
			
			manager.set("key2", { name: "another test", data: [1, 2, 3] });
			const usage3 = manager.estimateMemoryUsage();
			
			assert.ok(usage2 > usage1);
			assert.ok(usage3 > usage2);
		});

		it("should handle complex nested objects", () => {
			const manager = new StorageManager();
			manager.set("complex", {
				name: "complex object",
				nested: {
					array: [1, 2, { deep: true }],
					object: { prop: "value" },
					nullValue: null,
					undefinedValue: undefined
				},
				list: ["item1", "item2", "item3"]
			});
			
			const usage = manager.estimateMemoryUsage();
			assert.ok(usage > 0);
			assert.ok(typeof usage === "number");
		});

		it("should handle objects with circular references gracefully", () => {
			const manager = new StorageManager();
			const obj = { name: "test" };
			obj.self = obj; // Create circular reference
			
			// Set the circular object
			manager.set("circular", obj);
			
			// JSON.stringify will throw for circular references, which is expected
			assert.throws(() => {
				manager.estimateMemoryUsage();
			}, /Converting circular structure to JSON/);
		});

		it("should handle special values", () => {
			const manager = new StorageManager();
			manager.set("special", {
				nullValue: null,
				undefinedValue: undefined,
				emptyString: "",
				emptyArray: [],
				emptyObject: {},
				number: 42,
				boolean: true,
				date: new Date().toISOString()
			});
			
			const usage = manager.estimateMemoryUsage();
			assert.ok(usage > 0);
			assert.ok(typeof usage === "number");
		});
	});

	describe("integration scenarios", () => {
		it("should handle switching between immutable and mutable modes", () => {
			// Start with mutable
			const mutableManager = new StorageManager({ immutable: false });
			mutableManager.set("key1", { name: "test" });
			
			// Create immutable with same data
			const immutableManager = new StorageManager({ immutable: true });
			immutableManager.set("key1", { name: "test" });
			
			// Both should behave consistently for read operations
			assert.deepStrictEqual(mutableManager.get("key1"), immutableManager.get("key1"));
			assert.strictEqual(mutableManager.has("key1"), immutableManager.has("key1"));
			assert.strictEqual(mutableManager.size, immutableManager.size);
		});

		it("should handle large numbers of operations", () => {
			const manager = new StorageManager();
			
			// Add many records
			for (let i = 0; i < 100; i++) {
				manager.set(`key${i}`, { index: i, name: `test${i}` });
			}
			
			assert.strictEqual(manager.size, 100);
			assert.strictEqual(manager.keys().length, 100);
			assert.strictEqual(manager.entries().length, 100);
			
			// Delete half
			for (let i = 0; i < 50; i++) {
				manager.delete(`key${i}`);
			}
			
			assert.strictEqual(manager.size, 50);
			
			// Check remaining data
			for (let i = 50; i < 100; i++) {
				assert.ok(manager.has(`key${i}`));
				assert.deepStrictEqual(manager.get(`key${i}`), { index: i, name: `test${i}` });
			}
		});

		it("should maintain consistency across all operations", () => {
			const manager = new StorageManager();
			
			// Test sequence of operations
			manager.set("key1", { name: "first" });
			assert.strictEqual(manager.size, 1);
			assert.ok(manager.has("key1"));
			
			manager.set("key2", { name: "second" });
			assert.strictEqual(manager.size, 2);
			assert.deepStrictEqual(manager.keys().sort(), ["key1", "key2"]);
			
			manager.set("key1", { name: "updated" }); // Update existing
			assert.strictEqual(manager.size, 2); // Size shouldn't change
			assert.strictEqual(manager.get("key1").name, "updated");
			
			manager.delete("key2");
			assert.strictEqual(manager.size, 1);
			assert.ok(!manager.has("key2"));
			assert.strictEqual(manager.get("key2"), null);
			
			manager.clear();
			assert.strictEqual(manager.size, 0);
			assert.strictEqual(manager.keys().length, 0);
			assert.strictEqual(manager.entries().length, 0);
		});
	});
});
