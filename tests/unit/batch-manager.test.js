import assert from "node:assert";
import { BatchManager } from "../../src/batch-manager.js";
import { QueryError, TransactionError } from "../../src/errors.js";

/**
 * Mock CRUD Manager for testing
 */
class MockCRUDManager {
	constructor() {
		this.setResults = [];
		this.deleteResults = [];
		this.setCalls = [];
		this.deleteCalls = [];
		this.shouldThrowOnSet = false;
		this.shouldThrowOnDelete = false;
		this.storageManager = new MockStorageManager();
	}

	set(key, data, options = {}) {
		this.setCalls.push({ key, data, options });
		if (this.shouldThrowOnSet) {
			throw new Error("Mock set error");
		}
		const result = { id: key || `generated-${Date.now()}`, ...data };
		this.setResults.push(result);
		return result;
	}

	delete(key, options = {}) {
		this.deleteCalls.push({ key, options });
		if (this.shouldThrowOnDelete) {
			throw new Error("Mock delete error");
		}
		this.deleteResults.push(true);
		return true;
	}

	reset() {
		this.setResults = [];
		this.deleteResults = [];
		this.setCalls = [];
		this.deleteCalls = [];
		this.shouldThrowOnSet = false;
		this.shouldThrowOnDelete = false;
	}
}

/**
 * Mock Storage Manager for testing
 */
class MockStorageManager {
	constructor() {
		this.data = new Map();
	}

	get(key) {
		return this.data.get(key) || null;
	}

	set(key, value) {
		this.data.set(key, value);
	}

	delete(key) {
		return this.data.delete(key);
	}

	clear() {
		this.data.clear();
	}
}

/**
 * Mock Transaction for testing
 */
class MockTransaction {
	constructor(id) {
		this.id = id;
		this.operations = [];
	}

	addOperation(type, key, oldValue, newValue) {
		this.operations.push({ type, key, oldValue, newValue });
	}
}

/**
 * Mock Transaction Manager for testing
 */
class MockTransactionManager {
	constructor() {
		this.transactions = new Map();
		this.nextId = 1;
		this.beginCalls = [];
		this.commitCalls = [];
		this.abortCalls = [];
		this.shouldThrowOnBegin = false;
		this.shouldThrowOnCommit = false;
	}

	begin() {
		this.beginCalls.push(true);
		if (this.shouldThrowOnBegin) {
			throw new Error("Mock begin error");
		}
		const id = `tx-${this.nextId++}`;
		const transaction = new MockTransaction(id);
		this.transactions.set(id, transaction);
		return transaction;
	}

	commit(transactionId) {
		this.commitCalls.push(transactionId);
		if (this.shouldThrowOnCommit) {
			throw new Error("Mock commit error");
		}
		return true;
	}

	abort(transactionId, reason) {
		this.abortCalls.push({ transactionId, reason });
		return true;
	}

	getTransaction(id) {
		return this.transactions.get(id);
	}

	reset() {
		this.transactions.clear();
		this.nextId = 1;
		this.beginCalls = [];
		this.commitCalls = [];
		this.abortCalls = [];
		this.shouldThrowOnBegin = false;
		this.shouldThrowOnCommit = false;
	}
}

/**
 * Mock Lifecycle Manager for testing
 */
class MockLifecycleManager {
	constructor() {
		this.onbatchCalls = [];
	}

	onbatch(results, type) {
		this.onbatchCalls.push({ results, type });
	}

	reset() {
		this.onbatchCalls = [];
	}
}

describe("BatchManager", () => {
	let batchManager;
	let mockCrudManager;
	let mockTransactionManager;
	let mockLifecycleManager;

	beforeEach(() => {
		mockCrudManager = new MockCRUDManager();
		mockTransactionManager = new MockTransactionManager();
		mockLifecycleManager = new MockLifecycleManager();
	});

	describe("constructor", () => {
		it("should create instance with all dependencies", () => {
			batchManager = new BatchManager({
				crudManager: mockCrudManager,
				transactionManager: mockTransactionManager,
				lifecycleManager: mockLifecycleManager
			});

			assert.strictEqual(batchManager.crudManager, mockCrudManager);
			assert.strictEqual(batchManager.transactionManager, mockTransactionManager);
			assert.strictEqual(batchManager.lifecycleManager, mockLifecycleManager);
		});

		it("should create instance without transaction manager", () => {
			batchManager = new BatchManager({
				crudManager: mockCrudManager,
				lifecycleManager: mockLifecycleManager
			});

			assert.strictEqual(batchManager.crudManager, mockCrudManager);
			assert.strictEqual(batchManager.transactionManager, null);
			assert.strictEqual(batchManager.lifecycleManager, mockLifecycleManager);
		});

		it("should handle explicit null transaction manager", () => {
			batchManager = new BatchManager({
				crudManager: mockCrudManager,
				transactionManager: null,
				lifecycleManager: mockLifecycleManager
			});

			assert.strictEqual(batchManager.transactionManager, null);
		});
	});

	describe("batch - set operations", () => {
		beforeEach(() => {
			batchManager = new BatchManager({
				crudManager: mockCrudManager,
				transactionManager: mockTransactionManager,
				lifecycleManager: mockLifecycleManager
			});
		});

		it("should execute batch set operations successfully", () => {
			const operations = [
				{ name: "John", age: 30 },
				{ name: "Jane", age: 25 }
			];

			const results = batchManager.batch(operations, "set");

			assert.strictEqual(results.length, 2);
			assert.strictEqual(mockCrudManager.setCalls.length, 2);
			assert.strictEqual(mockCrudManager.setCalls[0].key, null);
			assert.deepStrictEqual(mockCrudManager.setCalls[0].data, operations[0]);
			assert.deepStrictEqual(mockCrudManager.setCalls[0].options, { batch: true });
			assert.strictEqual(mockLifecycleManager.onbatchCalls.length, 1);
			assert.strictEqual(mockLifecycleManager.onbatchCalls[0].type, "set");
		});

		it("should handle errors in individual set operations", () => {
			const operations = [
				{ name: "John", age: 30 },
				{ name: "Jane", age: 25 }
			];

			// Make the first operation fail
			let callCount = 0;
			const originalSet = mockCrudManager.set;
			mockCrudManager.set = (key, data, options) => {
				callCount++;
				if (callCount === 1) {
					throw new Error("Set operation failed");
				}
				return originalSet.call(mockCrudManager, key, data, options);
			};

			const results = batchManager.batch(operations, "set");

			assert.strictEqual(results.length, 2);
			assert(results[0] instanceof Error);
			assert.strictEqual(results[0].message, "Set operation failed");
			assert(results[1]);
			assert.strictEqual(mockLifecycleManager.onbatchCalls.length, 1);
		});

		it("should use default operation type 'set'", () => {
			const operations = [{ name: "John", age: 30 }];

			const results = batchManager.batch(operations);

			assert.strictEqual(results.length, 1);
			assert.strictEqual(mockCrudManager.setCalls.length, 1);
		});
	});

	describe("batch - delete operations", () => {
		beforeEach(() => {
			batchManager = new BatchManager({
				crudManager: mockCrudManager,
				transactionManager: mockTransactionManager,
				lifecycleManager: mockLifecycleManager
			});
		});

		it("should execute batch delete operations successfully", () => {
			const operations = ["key1", "key2", "key3"];

			const results = batchManager.batch(operations, "del");

			assert.strictEqual(results.length, 3);
			assert.strictEqual(mockCrudManager.deleteCalls.length, 3);
			assert.strictEqual(mockCrudManager.deleteCalls[0].key, "key1");
			assert.deepStrictEqual(mockCrudManager.deleteCalls[0].options, { batch: true });
			assert.strictEqual(results[0], true);
			assert.strictEqual(mockLifecycleManager.onbatchCalls.length, 1);
			assert.strictEqual(mockLifecycleManager.onbatchCalls[0].type, "del");
		});

		it("should handle errors in individual delete operations", () => {
			const operations = ["key1", "key2"];

			// Make the first operation fail
			let callCount = 0;
			const originalDelete = mockCrudManager.delete;
			mockCrudManager.delete = (key, options) => {
				callCount++;
				if (callCount === 1) {
					throw new Error("Delete operation failed");
				}
				return originalDelete.call(mockCrudManager, key, options);
			};

			const results = batchManager.batch(operations, "del");

			assert.strictEqual(results.length, 2);
			assert(results[0] instanceof Error);
			assert.strictEqual(results[0].message, "Delete operation failed");
			assert.strictEqual(results[1], true);
		});
	});

	describe("batch - atomic operations", () => {
		beforeEach(() => {
			batchManager = new BatchManager({
				crudManager: mockCrudManager,
				transactionManager: mockTransactionManager,
				lifecycleManager: mockLifecycleManager
			});
		});

		it("should execute atomic batch operations with new transaction", async () => {
			const operations = [
				{ name: "John", age: 30 },
				{ name: "Jane", age: 25 }
			];

			const results = await batchManager.batch(operations, "set", { atomic: true });

			assert.strictEqual(results.length, 2);
			assert.strictEqual(mockTransactionManager.beginCalls.length, 1);
			assert.strictEqual(mockTransactionManager.commitCalls.length, 1);
			assert.strictEqual(mockCrudManager.setCalls.length, 2);

			// Verify transaction operations were logged
			const transaction = mockTransactionManager.getTransaction(mockTransactionManager.commitCalls[0]);
			assert.strictEqual(transaction.operations.length, 2);
			assert.strictEqual(transaction.operations[0].type, "set");
		});

		it("should execute atomic batch operations with existing transaction", async () => {
			const existingTransaction = mockTransactionManager.begin();
			const operations = [{ name: "John", age: 30 }];

			const results = await batchManager.batch(operations, "set", { transaction: existingTransaction });

			assert.strictEqual(results.length, 1);
			// Should not create new transaction or commit existing one
			assert.strictEqual(mockTransactionManager.beginCalls.length, 1); // Only from setup
			assert.strictEqual(mockTransactionManager.commitCalls.length, 0);
			assert.strictEqual(existingTransaction.operations.length, 1);
		});

		it("should execute atomic delete operations", async () => {
			// Setup some data first
			mockCrudManager.storageManager.set("key1", { name: "John" });
			mockCrudManager.storageManager.set("key2", { name: "Jane" });

			const operations = ["key1", "key2"];

			const results = await batchManager.batch(operations, "del", { atomic: true });

			assert.strictEqual(results.length, 2);
			assert.strictEqual(results[0], true);
			assert.strictEqual(results[1], true);
			assert.strictEqual(mockTransactionManager.beginCalls.length, 1);
			assert.strictEqual(mockTransactionManager.commitCalls.length, 1);

			// Verify transaction operations were logged
			const transaction = mockTransactionManager.getTransaction(mockTransactionManager.commitCalls[0]);
			assert.strictEqual(transaction.operations.length, 2);
			assert.strictEqual(transaction.operations[0].type, "delete");
		});

		it("should abort transaction on error during atomic operations", async () => {
			const operations = [
				{ name: "John", age: 30 },
				{ name: "Jane", age: 25 }
			];

			// Make the second operation fail
			let callCount = 0;
			const originalSet = mockCrudManager.set;
			mockCrudManager.set = (key, data, options) => {
				callCount++;
				if (callCount === 2) {
					throw new Error("Set operation failed");
				}
				return originalSet.call(mockCrudManager, key, data, options);
			};

			await assert.rejects(async () => {
				await batchManager.batch(operations, "set", { atomic: true });
			}, /Set operation failed/);

			assert.strictEqual(mockTransactionManager.beginCalls.length, 1);
			assert.strictEqual(mockTransactionManager.commitCalls.length, 0);
			assert.strictEqual(mockTransactionManager.abortCalls.length, 1);
			assert.strictEqual(mockTransactionManager.abortCalls[0].reason, "Set operation failed");
		});

		it("should not abort external transaction on error", async () => {
			const existingTransaction = mockTransactionManager.begin();
			const operations = [{ name: "John", age: 30 }];

			// Make operation fail
			mockCrudManager.shouldThrowOnSet = true;

			await assert.rejects(async () => {
				await batchManager.batch(operations, "set", { transaction: existingTransaction });
			}, /Mock set error/);

			// Should not abort the external transaction
			assert.strictEqual(mockTransactionManager.abortCalls.length, 0);
		});
	});

	describe("batch - transaction manager requirements", () => {
		beforeEach(() => {
			batchManager = new BatchManager({
				crudManager: mockCrudManager,
				lifecycleManager: mockLifecycleManager
				// No transaction manager
			});
		});

		it("should throw error when atomic operation requested without transaction manager", async () => {
			const operations = [{ name: "John", age: 30 }];

			const promise = batchManager.batch(operations, "set", { atomic: true });
			
			await assert.rejects(async () => {
				await promise;
			}, (err) => {
				return err instanceof TransactionError && 
					   err.message.includes("Transaction manager not available for atomic batch operations");
			});
		});

		it("should throw error when transaction provided without transaction manager", async () => {
			const fakeTransaction = { id: "fake-tx" };
			const operations = [{ name: "John", age: 30 }];

			const promise = batchManager.batch(operations, "set", { transaction: fakeTransaction });
			
			await assert.rejects(async () => {
				await promise;
			}, (err) => {
				return err instanceof TransactionError && 
					   err.message.includes("Transaction manager not available for atomic batch operations");
			});
		});
	});

	describe("batch - error handling", () => {
		beforeEach(() => {
			batchManager = new BatchManager({
				crudManager: mockCrudManager,
				transactionManager: mockTransactionManager,
				lifecycleManager: mockLifecycleManager
			});
		});

		it("should wrap errors in QueryError for non-atomic operations", () => {
			// Make lifecycle manager throw an error
			mockLifecycleManager.onbatch = () => {
				throw new Error("Lifecycle error");
			};

			const operations = [{ name: "John", age: 30 }];

			assert.throws(() => {
				batchManager.batch(operations, "set");
			}, QueryError);

			const error = (() => {
				try {
					batchManager.batch(operations, "set");
				} catch (err) {
					return err;
				}
			})();

			assert(error.message.includes("Batch operation failed"));
			assert(error.message.includes("Lifecycle error"));
			assert.deepStrictEqual(error.context.query, operations);
			assert.strictEqual(error.context.operation, "batch");
		});

		it("should handle commit errors in atomic operations", async () => {
			mockTransactionManager.shouldThrowOnCommit = true;
			const operations = [{ name: "John", age: 30 }];

			await assert.rejects(async () => {
				await batchManager.batch(operations, "set", { atomic: true });
			}, /Mock commit error/);

			assert.strictEqual(mockTransactionManager.abortCalls.length, 1);
		});
	});

	describe("private methods", () => {
		beforeEach(() => {
			batchManager = new BatchManager({
				crudManager: mockCrudManager,
				transactionManager: mockTransactionManager,
				lifecycleManager: mockLifecycleManager
			});
		});

		it("should test _executeSetInTransaction through atomic operations", async () => {
			// Set up existing data to test old value retrieval
			mockCrudManager.storageManager.set("existing-key", { name: "Old John" });

			const operations = [{ name: "New John", age: 30 }];
			const transaction = mockTransactionManager.begin();

			// Call private method through public interface
			const results = await batchManager.batch(operations, "set", { transaction });

			assert.strictEqual(results.length, 1);
			assert.strictEqual(transaction.operations.length, 1);
			assert.strictEqual(transaction.operations[0].type, "set");
			assert.strictEqual(transaction.operations[0].key, null);
			assert.deepStrictEqual(transaction.operations[0].newValue, operations[0]);
		});

		it("should test _executeSetInTransaction with existing key to cover oldValue retrieval branch", () => {
			// Set up existing data
			const existingData = { name: "Old John", age: 25 };
			mockCrudManager.storageManager.set("existing-key", existingData);

			// Mock the private method call by directly testing the branch coverage
			// We'll create a scenario where the key is not null
			const transaction = mockTransactionManager.begin();
			
			// Manually call the private method to test the branch where key is truthy
			const result = batchManager._executeSetInTransaction("existing-key", { name: "Updated John", age: 30 }, transaction);

			// Verify the operation was logged with the correct old value
			assert.strictEqual(transaction.operations.length, 1);
			assert.strictEqual(transaction.operations[0].type, "set");
			assert.strictEqual(transaction.operations[0].key, "existing-key");
			assert.deepStrictEqual(transaction.operations[0].oldValue, existingData);
			assert.deepStrictEqual(transaction.operations[0].newValue, { name: "Updated John", age: 30 });

			// Verify the set operation was called
			assert.strictEqual(mockCrudManager.setCalls.length, 1);
			assert.strictEqual(mockCrudManager.setCalls[0].key, "existing-key");
			assert.deepStrictEqual(mockCrudManager.setCalls[0].data, { name: "Updated John", age: 30 });
		});

		it("should test _executeDeleteInTransaction through atomic operations", async () => {
			// Set up existing data
			mockCrudManager.storageManager.set("key1", { name: "John" });

			const operations = ["key1"];
			const transaction = mockTransactionManager.begin();

			// Call private method through public interface
			const results = await batchManager.batch(operations, "del", { transaction });

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0], true);
			assert.strictEqual(transaction.operations.length, 1);
			assert.strictEqual(transaction.operations[0].type, "delete");
			assert.strictEqual(transaction.operations[0].key, "key1");
			assert.deepStrictEqual(transaction.operations[0].oldValue, { name: "John" });
		});
	});

	describe("edge cases", () => {
		beforeEach(() => {
			batchManager = new BatchManager({
				crudManager: mockCrudManager,
				transactionManager: mockTransactionManager,
				lifecycleManager: mockLifecycleManager
			});
		});

		it("should handle empty operations array", () => {
			const results = batchManager.batch([], "set");

			assert.strictEqual(results.length, 0);
			assert.strictEqual(mockCrudManager.setCalls.length, 0);
			assert.strictEqual(mockLifecycleManager.onbatchCalls.length, 1);
		});

		it("should handle empty operations array with atomic option", async () => {
			const results = await batchManager.batch([], "set", { atomic: true });

			assert.strictEqual(results.length, 0);
			assert.strictEqual(mockTransactionManager.beginCalls.length, 1);
			assert.strictEqual(mockTransactionManager.commitCalls.length, 1);
		});

		it("should handle mixed success and error results correctly", () => {
			const operations = [
				{ name: "John", age: 30 },
				{ name: "Jane", age: 25 },
				{ name: "Bob", age: 35 }
			];

			// Make the middle operation fail
			let callCount = 0;
			const originalSet = mockCrudManager.set;
			mockCrudManager.set = (key, data, options) => {
				callCount++;
				if (callCount === 2) {
					throw new Error("Middle operation failed");
				}
				return originalSet.call(mockCrudManager, key, data, options);
			};

			const results = batchManager.batch(operations, "set");

			assert.strictEqual(results.length, 3);
			assert(results[0] && typeof results[0] === "object" && !(results[0] instanceof Error));
			assert(results[1] instanceof Error);
			assert.strictEqual(results[1].message, "Middle operation failed");
			assert(results[2] && typeof results[2] === "object" && !(results[2] instanceof Error));
		});
	});
});
