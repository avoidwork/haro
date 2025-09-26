import assert from "node:assert";
import { describe, it } from "mocha";
import { TransactionOperation } from "../../src/transaction-operation.js";
import { TransactionError } from "../../src/errors.js";
import { OperationTypes } from "../../src/constants.js";

/**
 * Tests for TransactionOperation class
 */
describe("TransactionOperation", () => {
	describe("Constructor", () => {
		/**
		 * Test basic transaction operation construction
		 */
		it("should create a transaction operation with type and key", () => {
			const type = OperationTypes.SET;
			const key = "user1";
			const operation = new TransactionOperation(type, key);

			assert.strictEqual(operation.type, type);
			assert.strictEqual(operation.key, key);
			assert.strictEqual(operation.oldValue, undefined);
			assert.strictEqual(operation.newValue, undefined);
			assert.deepStrictEqual(operation.metadata, {});
			assert.ok(operation.id);
			assert.ok(operation.timestamp instanceof Date);
		});

		/**
		 * Test transaction operation construction with all parameters
		 */
		it("should create a transaction operation with all parameters", () => {
			const type = OperationTypes.SET;
			const key = "user1";
			const oldValue = { name: "John", age: 30 };
			const newValue = { name: "John", age: 31 };
			const metadata = { author: "system", reason: "update" };
			const operation = new TransactionOperation(type, key, oldValue, newValue, metadata);

			assert.strictEqual(operation.type, type);
			assert.strictEqual(operation.key, key);
			assert.deepStrictEqual(operation.oldValue, oldValue);
			assert.deepStrictEqual(operation.newValue, newValue);
			assert.deepStrictEqual(operation.metadata, metadata);
		});

		/**
		 * Test transaction operation construction with DELETE type
		 */
		it("should create a DELETE transaction operation", () => {
			const type = OperationTypes.DELETE;
			const key = "user1";
			const oldValue = { name: "John", age: 30 };
			const operation = new TransactionOperation(type, key, oldValue);

			assert.strictEqual(operation.type, type);
			assert.strictEqual(operation.key, key);
			assert.deepStrictEqual(operation.oldValue, oldValue);
			assert.strictEqual(operation.newValue, undefined);
		});

		/**
		 * Test default metadata is empty object
		 */
		it("should default metadata to empty object", () => {
			const operation = new TransactionOperation(OperationTypes.SET, "test");

			assert.deepStrictEqual(operation.metadata, {});
			assert.notStrictEqual(operation.metadata, {}); // Should be a new object
		});

		/**
		 * Test operation gets unique ID
		 */
		it("should generate unique IDs for different operations", () => {
			const operation1 = new TransactionOperation(OperationTypes.SET, "key1");
			const operation2 = new TransactionOperation(OperationTypes.SET, "key2");

			assert.ok(operation1.id);
			assert.ok(operation2.id);
			assert.notStrictEqual(operation1.id, operation2.id);
			assert.ok(typeof operation1.id === "string");
		});

		/**
		 * Test operation timestamp is valid
		 */
		it("should create valid timestamp", () => {
			const before = new Date();
			const operation = new TransactionOperation(OperationTypes.SET, "test");
			const after = new Date();

			assert.ok(operation.timestamp instanceof Date);
			assert.ok(operation.timestamp >= before);
			assert.ok(operation.timestamp <= after);
		});

		/**
		 * Test operation is immutable
		 */
		it("should create immutable operation objects", () => {
			const operation = new TransactionOperation(OperationTypes.SET, "test");

			assert.throws(() => {
				operation.type = "modified";
			}, TypeError);

			assert.throws(() => {
				operation.key = "modified";
			}, TypeError);

			assert.throws(() => {
				operation.newProperty = "value";
			}, TypeError);
		});

		/**
		 * Test operation with null values
		 */
		it("should handle null values correctly", () => {
			const operation = new TransactionOperation(OperationTypes.SET, "test", null, null);

			assert.strictEqual(operation.oldValue, null);
			assert.strictEqual(operation.newValue, null);
		});

		/**
		 * Test operation with complex data types
		 */
		it("should handle complex data types", () => {
			const oldValue = {
				user: { name: "John", profile: { age: 30, tags: ["admin"] } },
				items: [1, 2, 3],
				date: new Date()
			};
			const newValue = new Map([["key", "value"]]);
			const operation = new TransactionOperation(OperationTypes.SET, "complex", oldValue, newValue);

			assert.deepStrictEqual(operation.oldValue, oldValue);
			assert.strictEqual(operation.newValue, newValue);
		});
	});

	describe("createRollback()", () => {
		/**
		 * Test rollback for SET operation with previous value
		 */
		it("should create rollback for SET operation with previous value", () => {
			const originalOp = new TransactionOperation(
				OperationTypes.SET,
				"user1",
				{ name: "John", age: 30 },
				{ name: "John", age: 31 }
			);

			const rollback = originalOp.createRollback();

			assert.strictEqual(rollback.type, OperationTypes.SET);
			assert.strictEqual(rollback.key, "user1");
			assert.deepStrictEqual(rollback.oldValue, { name: "John", age: 31 });
			assert.deepStrictEqual(rollback.newValue, { name: "John", age: 30 });
			assert.notStrictEqual(rollback.id, originalOp.id);
		});

		/**
		 * Test rollback for SET operation without previous value (insertion)
		 */
		it("should create rollback for SET operation without previous value", () => {
			const originalOp = new TransactionOperation(
				OperationTypes.SET,
				"user1",
				undefined,
				{ name: "John", age: 30 }
			);

			const rollback = originalOp.createRollback();

			assert.strictEqual(rollback.type, OperationTypes.DELETE);
			assert.strictEqual(rollback.key, "user1");
			assert.deepStrictEqual(rollback.oldValue, { name: "John", age: 30 });
			assert.strictEqual(rollback.newValue, undefined);
		});

		/**
		 * Test rollback for DELETE operation
		 */
		it("should create rollback for DELETE operation", () => {
			const originalOp = new TransactionOperation(
				OperationTypes.DELETE,
				"user1",
				{ name: "John", age: 30 },
				undefined
			);

			const rollback = originalOp.createRollback();

			assert.strictEqual(rollback.type, OperationTypes.SET);
			assert.strictEqual(rollback.key, "user1");
			assert.strictEqual(rollback.oldValue, undefined);
			assert.deepStrictEqual(rollback.newValue, { name: "John", age: 30 });
		});

		/**
		 * Test rollback for SET operation with null oldValue
		 */
		it("should handle null oldValue in SET operation", () => {
			const originalOp = new TransactionOperation(
				OperationTypes.SET,
				"user1",
				null,
				{ name: "John" }
			);

			const rollback = originalOp.createRollback();

			assert.strictEqual(rollback.type, OperationTypes.SET);
			assert.strictEqual(rollback.key, "user1");
			assert.deepStrictEqual(rollback.oldValue, { name: "John" });
			assert.strictEqual(rollback.newValue, null);
		});

		/**
		 * Test rollback preserves key and generates new ID
		 */
		it("should preserve key and generate new ID for rollback", () => {
			const originalOp = new TransactionOperation(OperationTypes.SET, "test", "old", "new");
			const rollback = originalOp.createRollback();

			assert.strictEqual(rollback.key, originalOp.key);
			assert.notStrictEqual(rollback.id, originalOp.id);
			assert.ok(rollback.id);
			assert.ok(rollback.timestamp instanceof Date);
		});

		/**
		 * Test rollback for complex data types
		 */
		it("should handle complex data types in rollback", () => {
			const oldValue = { user: { name: "John" }, items: [1, 2, 3] };
			const newValue = { user: { name: "Jane" }, items: [4, 5, 6] };
			const originalOp = new TransactionOperation(OperationTypes.SET, "complex", oldValue, newValue);

			const rollback = originalOp.createRollback();

			assert.strictEqual(rollback.type, OperationTypes.SET);
			assert.deepStrictEqual(rollback.oldValue, newValue);
			assert.deepStrictEqual(rollback.newValue, oldValue);
		});

		/**
		 * Test error for unsupported operation type
		 */
		it("should throw error for unsupported operation type", () => {
			const invalidOp = new TransactionOperation("INVALID_TYPE", "key", "old", "new");

			assert.throws(() => {
				invalidOp.createRollback();
			}, TransactionError);

			try {
				invalidOp.createRollback();
			} catch (error) {
				assert.ok(error instanceof TransactionError);
				assert.ok(error.message.includes("Cannot create rollback for operation type"));
				assert.ok(error.message.includes("INVALID_TYPE"));
				assert.strictEqual(error.context.transactionId, null);
				assert.strictEqual(error.context.operation, "rollback");
			}
		});

		/**
		 * Test rollback operations are also immutable
		 */
		it("should create immutable rollback operations", () => {
			const originalOp = new TransactionOperation(OperationTypes.SET, "test", "old", "new");
			const rollback = originalOp.createRollback();

			assert.throws(() => {
				rollback.type = "modified";
			}, TypeError);

			assert.throws(() => {
				rollback.key = "modified";
			}, TypeError);
		});
	});

	describe("Edge Cases", () => {
		/**
		 * Test operation with empty string key
		 */
		it("should handle empty string key", () => {
			const operation = new TransactionOperation(OperationTypes.SET, "", "old", "new");

			assert.strictEqual(operation.key, "");
			assert.strictEqual(operation.type, OperationTypes.SET);
		});

		/**
		 * Test operation with numeric key
		 */
		it("should handle numeric key", () => {
			const operation = new TransactionOperation(OperationTypes.SET, 123, "old", "new");

			assert.strictEqual(operation.key, 123);
		});

		/**
		 * Test operation with boolean values
		 */
		it("should handle boolean values", () => {
			const operation = new TransactionOperation(OperationTypes.SET, "bool", false, true);

			assert.strictEqual(operation.oldValue, false);
			assert.strictEqual(operation.newValue, true);

			const rollback = operation.createRollback();
			assert.strictEqual(rollback.oldValue, true);
			assert.strictEqual(rollback.newValue, false);
		});

		/**
		 * Test operation with zero values
		 */
		it("should handle zero values", () => {
			const operation = new TransactionOperation(OperationTypes.SET, "zero", 1, 0);

			assert.strictEqual(operation.oldValue, 1);
			assert.strictEqual(operation.newValue, 0);

			const rollback = operation.createRollback();
			assert.strictEqual(rollback.oldValue, 0);
			assert.strictEqual(rollback.newValue, 1);
		});

		/**
		 * Test operation with function values
		 */
		it("should handle function values", () => {
			const oldFunc = () => "old";
			const newFunc = () => "new";
			const operation = new TransactionOperation(OperationTypes.SET, "func", oldFunc, newFunc);

			assert.strictEqual(operation.oldValue, oldFunc);
			assert.strictEqual(operation.newValue, newFunc);
		});

		/**
		 * Test operation with deeply nested objects
		 */
		it("should handle deeply nested objects", () => {
			const deepObject = {
				level1: {
					level2: {
						level3: {
							value: "deep"
						}
					}
				}
			};
			const operation = new TransactionOperation(OperationTypes.SET, "deep", undefined, deepObject);

			assert.deepStrictEqual(operation.newValue, deepObject);

			const rollback = operation.createRollback();
			assert.strictEqual(rollback.type, OperationTypes.DELETE);
			assert.deepStrictEqual(rollback.oldValue, deepObject);
		});
	});

	describe("Integration with Constants", () => {
		/**
		 * Test all valid operation types
		 */
		it("should work with all OperationTypes constants", () => {
			// Test SET operation
			const setOp = new TransactionOperation(OperationTypes.SET, "key", "old", "new");
			assert.strictEqual(setOp.type, OperationTypes.SET);
			assert.doesNotThrow(() => setOp.createRollback());

			// Test DELETE operation
			const deleteOp = new TransactionOperation(OperationTypes.DELETE, "key", "old");
			assert.strictEqual(deleteOp.type, OperationTypes.DELETE);
			assert.doesNotThrow(() => deleteOp.createRollback());

			// Test BATCH operation (should throw on rollback)
			const batchOp = new TransactionOperation(OperationTypes.BATCH, "key");
			assert.strictEqual(batchOp.type, OperationTypes.BATCH);
			assert.throws(() => batchOp.createRollback(), TransactionError);
		});
	});

	describe("Metadata Handling", () => {
		/**
		 * Test metadata preservation
		 */
		it("should preserve metadata reference", () => {
			const metadata = { source: "test", priority: 1 };
			const operation = new TransactionOperation(OperationTypes.SET, "test", "old", "new", metadata);

			assert.deepStrictEqual(operation.metadata, metadata);
			assert.strictEqual(operation.metadata, metadata); // Should be the same reference
		});

		/**
		 * Test metadata with complex objects
		 */
		it("should handle complex metadata objects", () => {
			const metadata = {
				timestamp: new Date(),
				user: { id: 123, name: "John" },
				tags: ["important", "user-action"],
				config: { retries: 3, timeout: 5000 }
			};
			const operation = new TransactionOperation(OperationTypes.SET, "test", "old", "new", metadata);

			assert.deepStrictEqual(operation.metadata, metadata);
		});

		/**
		 * Test rollback doesn't inherit original metadata
		 */
		it("should not inherit metadata in rollback operations", () => {
			const metadata = { important: "data" };
			const operation = new TransactionOperation(OperationTypes.SET, "test", "old", "new", metadata);
			const rollback = operation.createRollback();

			assert.deepStrictEqual(operation.metadata, metadata);
			assert.deepStrictEqual(rollback.metadata, {}); // Rollback gets default empty metadata
		});
	});
});
