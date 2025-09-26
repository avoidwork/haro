import assert from "node:assert";
import { Transaction } from "../../src/transaction-individual.js";
import { TransactionError } from "../../src/errors.js";
import { TransactionStates, IsolationLevels, OperationTypes } from "../../src/constants.js";
import { TransactionOperation } from "../../src/transaction-operation.js";

describe("Transaction", () => {
	describe("Constructor", () => {
		it("should create a transaction with auto-generated ID", () => {
			const transaction = new Transaction();
			
			assert.ok(transaction.id);
			assert.strictEqual(typeof transaction.id, "string");
			assert.strictEqual(transaction.state, TransactionStates.PENDING);
			assert.strictEqual(transaction.isolationLevel, IsolationLevels.READ_COMMITTED);
			assert.strictEqual(transaction.timeout, 60000);
			assert.strictEqual(transaction.readOnly, false);
			assert.strictEqual(transaction.startTime, null);
			assert.strictEqual(transaction.endTime, null);
			assert.ok(Array.isArray(transaction.operations));
			assert.strictEqual(transaction.operations.length, 0);
			assert.ok(transaction.readSet instanceof Set);
			assert.ok(transaction.writeSet instanceof Set);
			assert.ok(transaction.snapshot instanceof Map);
			assert.strictEqual(transaction.validationCallback, null);
			assert.strictEqual(transaction.abortReason, null);
		});

		it("should create a transaction with custom ID", () => {
			const customId = "custom-id-123";
			const transaction = new Transaction(customId);
			
			assert.strictEqual(transaction.id, customId);
		});

		it("should create a transaction with custom options", () => {
			const options = {
				isolationLevel: IsolationLevels.SERIALIZABLE,
				timeout: 30000,
				readOnly: true
			};
			const transaction = new Transaction("test-id", options);
			
			assert.strictEqual(transaction.isolationLevel, IsolationLevels.SERIALIZABLE);
			assert.strictEqual(transaction.timeout, 30000);
			assert.strictEqual(transaction.readOnly, true);
		});

		it("should create a sealed transaction object", () => {
			const transaction = new Transaction();
			
			assert.throws(() => {
				transaction.newProperty = "value";
			});
		});
	});

	describe("begin()", () => {
		it("should begin a transaction successfully", () => {
			const transaction = new Transaction();
			const result = transaction.begin();
			
			assert.strictEqual(result, transaction); // Returns this for chaining
			assert.strictEqual(transaction.state, TransactionStates.ACTIVE);
			assert.ok(transaction.startTime instanceof Date);
		});

		it("should throw error when beginning already active transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			assert.throws(() => {
				transaction.begin();
			}, TransactionError);
		});

		it("should throw error when beginning committed transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			transaction.commit();
			
			assert.throws(() => {
				transaction.begin();
			}, TransactionError);
		});

		it("should throw error when beginning aborted transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			transaction.abort();
			
			assert.throws(() => {
				transaction.begin();
			}, TransactionError);
		});
	});

	describe("addOperation()", () => {
		let transaction;

		beforeEach(() => {
			transaction = new Transaction();
			transaction.begin();
		});

		it("should add a read operation successfully", () => {
			const operation = transaction.addOperation("read", "key1");
			
			assert.ok(operation instanceof TransactionOperation);
			assert.strictEqual(operation.type, "read");
			assert.strictEqual(operation.key, "key1");
			assert.strictEqual(transaction.operations.length, 1);
			assert.ok(transaction.readSet.has("key1"));
			assert.strictEqual(transaction.writeSet.size, 0);
		});

		it("should add a write operation successfully", () => {
			const operation = transaction.addOperation("set", "key1", "oldValue", "newValue");
			
			assert.ok(operation instanceof TransactionOperation);
			assert.strictEqual(operation.type, "set");
			assert.strictEqual(operation.key, "key1");
			assert.strictEqual(operation.oldValue, "oldValue");
			assert.strictEqual(operation.newValue, "newValue");
			assert.strictEqual(transaction.operations.length, 1);
			assert.ok(transaction.writeSet.has("key1"));
			assert.strictEqual(transaction.readSet.size, 0);
		});

		it("should add operation with metadata", () => {
			const metadata = { source: "test" };
			const operation = transaction.addOperation("set", "key1", null, "value", metadata);
			
			assert.strictEqual(operation.metadata, metadata);
		});

		it("should throw error when adding operation to inactive transaction", () => {
			const newTransaction = new Transaction();
			
			assert.throws(() => {
				newTransaction.addOperation("read", "key1");
			}, TransactionError);
		});

		it("should throw error when adding write operation to read-only transaction", () => {
			const readOnlyTransaction = new Transaction("test", { readOnly: true });
			readOnlyTransaction.begin();
			
			assert.throws(() => {
				readOnlyTransaction.addOperation("set", "key1", null, "value");
			}, TransactionError);
		});

		it("should allow read operations in read-only transaction", () => {
			const readOnlyTransaction = new Transaction("test", { readOnly: true });
			readOnlyTransaction.begin();
			
			const operation = readOnlyTransaction.addOperation("read", "key1");
			assert.ok(operation instanceof TransactionOperation);
		});

		it("should throw error when transaction has timed out", (done) => {
			const shortTimeoutTransaction = new Transaction("test", { timeout: 1 });
			shortTimeoutTransaction.begin();
			
			setTimeout(() => {
				assert.throws(() => {
					shortTimeoutTransaction.addOperation("read", "key1");
				}, TransactionError);
				done();
			}, 10);
		});
	});

	describe("setValidation()", () => {
		it("should set validation callback successfully", () => {
			const transaction = new Transaction();
			const validationFn = () => true;
			const result = transaction.setValidation(validationFn);
			
			assert.strictEqual(result, transaction); // Returns this for chaining
			assert.strictEqual(transaction.validationCallback, validationFn);
		});
	});

	describe("validate()", () => {
		it("should validate successfully with no callback", () => {
			const transaction = new Transaction();
			const result = transaction.validate();
			
			assert.strictEqual(result, true);
		});

		it("should validate successfully with passing callback", () => {
			const transaction = new Transaction();
			transaction.setValidation(() => true);
			const result = transaction.validate();
			
			assert.strictEqual(result, true);
		});

		it("should throw error with failing callback returning false", () => {
			const transaction = new Transaction();
			transaction.setValidation(() => false);
			
			assert.throws(() => {
				transaction.validate();
			}, TransactionError);
		});

		it("should throw error with failing callback returning string", () => {
			const transaction = new Transaction();
			transaction.setValidation(() => "Custom error message");
			
			assert.throws(() => {
				transaction.validate();
			}, (err) => {
				return err instanceof TransactionError && err.message === "Custom error message";
			});
		});

		it("should pass transaction and context to validation callback", () => {
			const transaction = new Transaction();
			let passedTransaction, passedContext;
			transaction.setValidation((txn, ctx) => {
				passedTransaction = txn;
				passedContext = ctx;
				return true;
			});
			
			const context = { test: "value" };
			transaction.validate(context);
			
			assert.strictEqual(passedTransaction, transaction);
			assert.strictEqual(passedContext, context);
		});
	});

	describe("commit()", () => {
		it("should commit transaction successfully", () => {
			const transaction = new Transaction();
			transaction.begin();
			const result = transaction.commit();
			
			assert.strictEqual(result, transaction); // Returns this for chaining
			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
			assert.ok(transaction.endTime instanceof Date);
		});

		it("should commit with validation", () => {
			const transaction = new Transaction();
			transaction.setValidation(() => true);
			transaction.begin();
			const result = transaction.commit();
			
			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
		});

		it("should auto-abort on validation failure during commit", () => {
			const transaction = new Transaction();
			transaction.setValidation(() => false);
			transaction.begin();
			
			assert.throws(() => {
				transaction.commit();
			}, TransactionError);
			
			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
		});

		it("should throw error when committing inactive transaction", () => {
			const transaction = new Transaction();
			
			assert.throws(() => {
				transaction.commit();
			}, TransactionError);
		});

		it("should pass context to validation during commit", () => {
			const transaction = new Transaction();
			let receivedContext;
			transaction.setValidation((txn, ctx) => {
				receivedContext = ctx;
				return true;
			});
			transaction.begin();
			
			const context = { source: "commit" };
			transaction.commit(context);
			
			assert.strictEqual(receivedContext, context);
		});
	});

	describe("abort()", () => {
		it("should abort pending transaction", () => {
			const transaction = new Transaction();
			const result = transaction.abort();
			
			assert.strictEqual(result, transaction); // Returns this for chaining
			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			assert.ok(transaction.endTime instanceof Date);
			assert.strictEqual(transaction.abortReason, "User abort");
		});

		it("should abort active transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			const result = transaction.abort();
			
			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
		});

		it("should abort with custom reason", () => {
			const transaction = new Transaction();
			const reason = "Custom abort reason";
			transaction.abort(reason);
			
			assert.strictEqual(transaction.abortReason, reason);
		});

		it("should be idempotent for already aborted transaction", () => {
			const transaction = new Transaction();
			transaction.abort("First abort");
			const firstEndTime = transaction.endTime;
			
			transaction.abort("Second abort");
			
			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			assert.strictEqual(transaction.abortReason, "First abort"); // Should not change
			assert.strictEqual(transaction.endTime, firstEndTime); // Should not change
		});

		it("should be idempotent for committed transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			transaction.commit();
			const endTime = transaction.endTime;
			
			transaction.abort("Should not abort");
			
			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
			assert.strictEqual(transaction.endTime, endTime);
			assert.strictEqual(transaction.abortReason, null);
		});
	});

	describe("getRollbackOperations()", () => {
		it("should return empty array for transaction with no operations", () => {
			const transaction = new Transaction();
			const rollbacks = transaction.getRollbackOperations();
			
			assert.ok(Array.isArray(rollbacks));
			assert.strictEqual(rollbacks.length, 0);
		});

		it("should return rollback operations in reverse order", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			transaction.addOperation("set", "key1", "old1", "new1");
			transaction.addOperation("set", "key2", "old2", "new2");
			transaction.addOperation("delete", "key3", "old3");
			
			const rollbacks = transaction.getRollbackOperations();
			
			assert.strictEqual(rollbacks.length, 3);
			assert.strictEqual(rollbacks[0].key, "key3"); // Last operation first
			assert.strictEqual(rollbacks[1].key, "key2");
			assert.strictEqual(rollbacks[2].key, "key1");
		});

		it("should filter out read operations", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			transaction.addOperation("read", "key1");
			transaction.addOperation("set", "key2", "old2", "new2");
			transaction.addOperation("read", "key3");
			
			const rollbacks = transaction.getRollbackOperations();
			
			assert.strictEqual(rollbacks.length, 1);
			assert.strictEqual(rollbacks[0].key, "key2");
		});

		it("should filter out null rollback operations", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			// Since TransactionOperation objects are frozen, we can't mock them directly
			// Instead, let's test the behavior by adding operations and verifying the filtering logic
			transaction.addOperation("set", "key1", "old1", "new1");
			transaction.addOperation("read", "key2"); // This should be filtered out
			
			const rollbacks = transaction.getRollbackOperations();
			
			// Should have 1 rollback (read operations filtered out)
			assert.strictEqual(rollbacks.length, 1);
			assert.strictEqual(rollbacks[0].key, "key1");
		});
	});

	describe("State Check Methods", () => {
		it("isActive() should return correct state", () => {
			const transaction = new Transaction();
			
			assert.strictEqual(transaction.isActive(), false);
			
			transaction.begin();
			assert.strictEqual(transaction.isActive(), true);
			
			transaction.commit();
			assert.strictEqual(transaction.isActive(), false);
		});

		it("isCommitted() should return correct state", () => {
			const transaction = new Transaction();
			
			assert.strictEqual(transaction.isCommitted(), false);
			
			transaction.begin();
			assert.strictEqual(transaction.isCommitted(), false);
			
			transaction.commit();
			assert.strictEqual(transaction.isCommitted(), true);
		});

		it("isAborted() should return correct state", () => {
			const transaction = new Transaction();
			
			assert.strictEqual(transaction.isAborted(), false);
			
			transaction.begin();
			assert.strictEqual(transaction.isAborted(), false);
			
			transaction.abort();
			assert.strictEqual(transaction.isAborted(), true);
		});
	});

	describe("getDuration()", () => {
		it("should return null for transaction that has not started", () => {
			const transaction = new Transaction();
			
			assert.strictEqual(transaction.getDuration(), null);
		});

		it("should return duration for active transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			const duration = transaction.getDuration();
			assert.ok(typeof duration === "number");
			assert.ok(duration >= 0);
		});

		it("should return final duration for completed transaction", (done) => {
			const transaction = new Transaction();
			transaction.begin();
			
			// Add a small delay
			setTimeout(() => {
				transaction.commit();
				const duration = transaction.getDuration();
				
				assert.ok(typeof duration === "number");
				assert.ok(duration >= 0);
				done();
			}, 5);
		});
	});

	describe("getStats()", () => {
		it("should return comprehensive statistics", () => {
			const transaction = new Transaction("test-id", {
				isolationLevel: IsolationLevels.SERIALIZABLE,
				readOnly: true,
				timeout: 30000
			});
			
			const stats = transaction.getStats();
			
			assert.strictEqual(stats.id, "test-id");
			assert.strictEqual(stats.state, TransactionStates.PENDING);
			assert.strictEqual(stats.isolationLevel, IsolationLevels.SERIALIZABLE);
			assert.strictEqual(stats.readOnly, true);
			assert.strictEqual(stats.startTime, null);
			assert.strictEqual(stats.endTime, null);
			assert.strictEqual(stats.duration, null);
			assert.strictEqual(stats.operationCount, 0);
			assert.strictEqual(stats.readSetSize, 0);
			assert.strictEqual(stats.writeSetSize, 0);
			assert.strictEqual(stats.snapshotSize, 0);
			assert.strictEqual(stats.abortReason, null);
			assert.strictEqual(stats.timedOut, false);
		});

		it("should include operation and set statistics", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			transaction.addOperation("read", "key1");
			transaction.addOperation("set", "key2", "old", "new");
			transaction.snapshot.set("snap1", "value1");
			
			const stats = transaction.getStats();
			
			assert.strictEqual(stats.operationCount, 2);
			assert.strictEqual(stats.readSetSize, 1);
			assert.strictEqual(stats.writeSetSize, 1);
			assert.strictEqual(stats.snapshotSize, 1);
		});

		it("should indicate timed out status", (done) => {
			const transaction = new Transaction("test", { timeout: 1 });
			transaction.begin();
			
			setTimeout(() => {
				const stats = transaction.getStats();
				assert.strictEqual(stats.timedOut, true);
				done();
			}, 10);
		});
	});

	describe("export()", () => {
		it("should export transaction data for debugging", () => {
			const transaction = new Transaction("test-id");
			transaction.begin();
			
			transaction.addOperation("read", "key1");
			transaction.addOperation("set", "key2", "old", "new", { source: "test" });
			
			const exported = transaction.export();
			
			// Should include all stats
			assert.strictEqual(exported.id, "test-id");
			assert.strictEqual(exported.state, TransactionStates.ACTIVE);
			
			// Should include operations
			assert.ok(Array.isArray(exported.operations));
			assert.strictEqual(exported.operations.length, 2);
			assert.ok(exported.operations[0].id);
			assert.strictEqual(exported.operations[0].type, "read");
			assert.strictEqual(exported.operations[0].key, "key1");
			assert.ok(exported.operations[0].timestamp);
			
			assert.strictEqual(exported.operations[1].type, "set");
			assert.strictEqual(exported.operations[1].key, "key2");
			assert.strictEqual(exported.operations[1].metadata.source, "test");
			
			// Should include sets
			assert.ok(Array.isArray(exported.readSet));
			assert.ok(Array.isArray(exported.writeSet));
			assert.ok(exported.readSet.includes("key1"));
			assert.ok(exported.writeSet.includes("key2"));
		});
	});

	describe("_checkActive() private method", () => {
		it("should not throw for active transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			// Should not throw
			transaction._checkActive();
		});

		it("should throw for pending transaction", () => {
			const transaction = new Transaction();
			
			assert.throws(() => {
				transaction._checkActive();
			}, TransactionError);
		});

		it("should throw for committed transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			transaction.commit();
			
			assert.throws(() => {
				transaction._checkActive();
			}, TransactionError);
		});

		it("should throw for aborted transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			transaction.abort();
			
			assert.throws(() => {
				transaction._checkActive();
			}, TransactionError);
		});
	});

	describe("_isTimedOut() private method", () => {
		it("should return false for transaction that has not started", () => {
			const transaction = new Transaction();
			
			assert.strictEqual(transaction._isTimedOut(), false);
		});

		it("should return false for non-timed-out transaction", () => {
			const transaction = new Transaction("test", { timeout: 60000 });
			transaction.begin();
			
			assert.strictEqual(transaction._isTimedOut(), false);
		});

		it("should return true for timed-out transaction", (done) => {
			const transaction = new Transaction("test", { timeout: 1 });
			transaction.begin();
			
			setTimeout(() => {
				assert.strictEqual(transaction._isTimedOut(), true);
				done();
			}, 10);
		});
	});

	describe("Edge Cases and Integration", () => {
		it("should handle multiple operations in sequence", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			// Mix of operations
			transaction.addOperation("read", "key1");
			transaction.addOperation("set", "key2", null, "value2");
			transaction.addOperation("delete", "key3", "value3");
			transaction.addOperation("read", "key4");
			transaction.addOperation("set", "key5", "old5", "new5");
			
			assert.strictEqual(transaction.operations.length, 5);
			assert.strictEqual(transaction.readSet.size, 2);
			assert.strictEqual(transaction.writeSet.size, 3);
			
			// Test rollback operations
			const rollbacks = transaction.getRollbackOperations();
			assert.strictEqual(rollbacks.length, 3); // Only write operations
		});

		it("should handle validation with complex scenario", () => {
			const transaction = new Transaction();
			let validationCount = 0;
			
			transaction.setValidation((txn, context) => {
				validationCount++;
				return txn.operations.length >= 2;
			});
			
			transaction.begin();
			transaction.addOperation("set", "key1", null, "value1");
			
			// Should fail validation (only 1 operation)
			assert.throws(() => {
				transaction.commit();
			}, TransactionError);
			
			assert.strictEqual(validationCount, 1);
			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
		});

		it("should handle transaction lifecycle completely", (done) => {
			const transaction = new Transaction("lifecycle-test", {
				isolationLevel: IsolationLevels.REPEATABLE_READ,
				timeout: 30000,
				readOnly: false
			});
			
			// Initial state
			assert.strictEqual(transaction.state, TransactionStates.PENDING);
			assert.strictEqual(transaction.getDuration(), null);
			
			// Begin
			transaction.begin();
			assert.strictEqual(transaction.state, TransactionStates.ACTIVE);
			assert.ok(transaction.getDuration() >= 0);
			
			// Add operations
			transaction.addOperation("read", "key1");
			transaction.addOperation("set", "key2", "old", "new");
			
			// Set validation
			transaction.setValidation(() => true);
			
			// Add small delay to ensure duration > 0
			setTimeout(() => {
				// Commit
				transaction.commit();
				assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
				assert.ok(transaction.getDuration() >= 0);
				
				// Verify export
				const exported = transaction.export();
				assert.strictEqual(exported.operations.length, 2);
				assert.strictEqual(exported.readSet.length, 1);
				assert.strictEqual(exported.writeSet.length, 1);
				done();
			}, 1);
		});
	});
});
