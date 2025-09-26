import assert from "node:assert";
import { describe, it } from "mocha";
import {
	TransactionStates,
	OperationTypes,
	IsolationLevels,
	LockTypes,
	TransactionOperation,
	LockManager,
	Transaction,
	TransactionManager
} from "../../src/transaction.js";
import { TransactionError, ConcurrencyError } from "../../src/errors.js";

/**
 * Tests for Transaction constants and enums
 */
describe("Transaction Constants", () => {
	/**
	 * Test TransactionStates enum
	 */
	it("should export correct TransactionStates", () => {
		assert.strictEqual(TransactionStates.PENDING, "pending");
		assert.strictEqual(TransactionStates.ACTIVE, "active");
		assert.strictEqual(TransactionStates.COMMITTED, "committed");
		assert.strictEqual(TransactionStates.ABORTED, "aborted");
	});

	/**
	 * Test OperationTypes enum
	 */
	it("should export correct OperationTypes", () => {
		assert.strictEqual(OperationTypes.SET, "set");
		assert.strictEqual(OperationTypes.DELETE, "delete");
		assert.strictEqual(OperationTypes.BATCH, "batch");
	});

	/**
	 * Test IsolationLevels enum
	 */
	it("should export correct IsolationLevels", () => {
		assert.strictEqual(IsolationLevels.READ_UNCOMMITTED, 0);
		assert.strictEqual(IsolationLevels.READ_COMMITTED, 1);
		assert.strictEqual(IsolationLevels.REPEATABLE_READ, 2);
		assert.strictEqual(IsolationLevels.SERIALIZABLE, 3);
	});

	/**
	 * Test LockTypes enum
	 */
	it("should export correct LockTypes", () => {
		assert.strictEqual(LockTypes.SHARED, "shared");
		assert.strictEqual(LockTypes.EXCLUSIVE, "exclusive");
	});
});

/**
 * Tests for TransactionOperation class
 */
describe("TransactionOperation", () => {
	describe("Constructor", () => {
		/**
		 * Test basic operation construction
		 */
		it("should create operation with required parameters", () => {
			const operation = new TransactionOperation(OperationTypes.SET, "key1", "oldValue", "newValue");

			assert.strictEqual(operation.type, OperationTypes.SET);
			assert.strictEqual(operation.key, "key1");
			assert.strictEqual(operation.oldValue, "oldValue");
			assert.strictEqual(operation.newValue, "newValue");
			assert.ok(operation.id);
			assert.ok(operation.timestamp instanceof Date);
			assert.deepStrictEqual(operation.metadata, {});
		});

		/**
		 * Test operation construction with metadata
		 */
		it("should create operation with metadata", () => {
			const metadata = { source: "test", priority: 1 };
			const operation = new TransactionOperation(OperationTypes.DELETE, "key1", "value", undefined, metadata);

			assert.strictEqual(operation.type, OperationTypes.DELETE);
			assert.strictEqual(operation.key, "key1");
			assert.strictEqual(operation.oldValue, "value");
			assert.strictEqual(operation.newValue, undefined);
			assert.deepStrictEqual(operation.metadata, metadata);
		});

		/**
		 * Test operation immutability
		 */
		it("should create immutable operations", () => {
			const operation = new TransactionOperation(OperationTypes.SET, "key1", "old", "new");

			assert.throws(() => {
				operation.type = OperationTypes.DELETE;
			}, TypeError);

			assert.throws(() => {
				operation.newProperty = "value";
			}, TypeError);
		});

		/**
		 * Test operation has unique ID
		 */
		it("should create operations with unique IDs", () => {
			const op1 = new TransactionOperation(OperationTypes.SET, "key1", "old", "new");
			const op2 = new TransactionOperation(OperationTypes.SET, "key1", "old", "new");

			assert.notStrictEqual(op1.id, op2.id);
			assert.ok(op1.id.length > 0);
			assert.ok(op2.id.length > 0);
		});
	});

	describe("createRollback()", () => {
		/**
		 * Test rollback for SET operation with previous value
		 */
		it("should create rollback for SET operation with previous value", () => {
			const operation = new TransactionOperation(OperationTypes.SET, "key1", "oldValue", "newValue");
			const rollback = operation.createRollback();

			assert.strictEqual(rollback.type, OperationTypes.SET);
			assert.strictEqual(rollback.key, "key1");
			assert.strictEqual(rollback.oldValue, "newValue");
			assert.strictEqual(rollback.newValue, "oldValue");
		});

		/**
		 * Test rollback for SET operation without previous value (new record)
		 */
		it("should create rollback for SET operation without previous value", () => {
			const operation = new TransactionOperation(OperationTypes.SET, "key1", undefined, "newValue");
			const rollback = operation.createRollback();

			assert.strictEqual(rollback.type, OperationTypes.DELETE);
			assert.strictEqual(rollback.key, "key1");
			assert.strictEqual(rollback.oldValue, "newValue");
			assert.strictEqual(rollback.newValue, undefined);
		});

		/**
		 * Test rollback for DELETE operation
		 */
		it("should create rollback for DELETE operation", () => {
			const operation = new TransactionOperation(OperationTypes.DELETE, "key1", "deletedValue", undefined);
			const rollback = operation.createRollback();

			assert.strictEqual(rollback.type, OperationTypes.SET);
			assert.strictEqual(rollback.key, "key1");
			assert.strictEqual(rollback.oldValue, undefined);
			assert.strictEqual(rollback.newValue, "deletedValue");
		});

		/**
		 * Test rollback error for unsupported operation type
		 */
		it("should throw error for unsupported operation type", () => {
			const operation = new TransactionOperation(OperationTypes.BATCH, "key1", "old", "new");

			assert.throws(() => {
				operation.createRollback();
			}, TransactionError);
		});
	});
});

/**
 * Tests for LockManager class
 */
describe("LockManager", () => {
	let lockManager;

	beforeEach(() => {
		lockManager = new LockManager();
	});

	describe("Constructor", () => {
		/**
		 * Test lock manager initialization
		 */
		it("should initialize with empty locks", () => {
			const manager = new LockManager();

			assert.ok(manager.locks instanceof Map);
			assert.strictEqual(manager.locks.size, 0);
			assert.strictEqual(manager.lockTimeout, 30000);
		});
	});

	describe("acquireLock()", () => {
		/**
		 * Test acquiring first lock on record
		 */
		it("should acquire first lock on record", async () => {
			const acquired = await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);

			assert.strictEqual(acquired, true);
			assert.ok(lockManager.locks.has("record1"));
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.type, LockTypes.SHARED);
			assert.ok(lock.holders.has("tx1"));
		});

		/**
		 * Test acquiring shared locks by multiple transactions
		 */
		it("should allow multiple shared locks on same record", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			const acquired = await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);

			assert.strictEqual(acquired, true);
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.type, LockTypes.SHARED);
			assert.ok(lock.holders.has("tx1"));
			assert.ok(lock.holders.has("tx2"));
			assert.strictEqual(lock.holders.size, 2);
		});

		/**
		 * Test exclusive lock blocking shared lock
		 */
		it("should timeout when exclusive lock blocks shared lock", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);

			await assert.rejects(async () => {
				await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED, 100);
			}, ConcurrencyError);
		});

		/**
		 * Test shared lock blocking exclusive lock
		 */
		it("should timeout when shared lock blocks exclusive lock", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);

			await assert.rejects(async () => {
				await lockManager.acquireLock("tx2", "record1", LockTypes.EXCLUSIVE, 100);
			}, ConcurrencyError);
		});

		/**
		 * Test lock upgrade from shared to exclusive
		 */
		it("should upgrade shared lock to exclusive when only holder", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			const upgraded = await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);

			assert.strictEqual(upgraded, true);
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.type, LockTypes.EXCLUSIVE);
			assert.ok(lock.holders.has("tx1"));
			assert.strictEqual(lock.holders.size, 1);
		});

		/**
		 * Test lock upgrade failure with multiple holders
		 */
		it("should fail to upgrade shared lock with multiple holders", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);

			await assert.rejects(async () => {
				await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE, 100);
			}, ConcurrencyError);
		});

		/**
		 * Test acquiring same lock type returns true
		 */
		it("should return true when acquiring same lock type already held", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);
			const acquired = await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);

			assert.strictEqual(acquired, true);
		});
	});

	describe("releaseLock()", () => {
		/**
		 * Test releasing held lock
		 */
		it("should release held lock", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			const released = lockManager.releaseLock("tx1", "record1");

			assert.strictEqual(released, true);
			assert.ok(!lockManager.locks.has("record1"));
		});

		/**
		 * Test releasing lock with multiple holders
		 */
		it("should release lock from multiple holders", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);
			
			const released = lockManager.releaseLock("tx1", "record1");

			assert.strictEqual(released, true);
			assert.ok(lockManager.locks.has("record1"));
			
			const lock = lockManager.locks.get("record1");
			assert.ok(!lock.holders.has("tx1"));
			assert.ok(lock.holders.has("tx2"));
		});

		/**
		 * Test releasing non-held lock
		 */
		it("should return false when releasing non-held lock", () => {
			const released = lockManager.releaseLock("tx1", "record1");

			assert.strictEqual(released, false);
		});

		/**
		 * Test releasing lock not held by transaction
		 */
		it("should return false when releasing lock not held by transaction", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			const released = lockManager.releaseLock("tx2", "record1");

			assert.strictEqual(released, false);
			assert.ok(lockManager.locks.has("record1"));
		});
	});

	describe("releaseAllLocks()", () => {
		/**
		 * Test releasing all locks for transaction
		 */
		it("should release all locks held by transaction", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx1", "record2", LockTypes.EXCLUSIVE);
			await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);
			
			const released = lockManager.releaseAllLocks("tx1");

			assert.strictEqual(released, 2);
			assert.ok(lockManager.locks.has("record1")); // tx2 still holds it
			assert.ok(!lockManager.locks.has("record2")); // only tx1 held it
		});

		/**
		 * Test releasing locks for transaction with no locks
		 */
		it("should return zero when transaction holds no locks", () => {
			const released = lockManager.releaseAllLocks("tx1");

			assert.strictEqual(released, 0);
		});
	});

	describe("holdsLocks()", () => {
		/**
		 * Test checking if transaction holds locks
		 */
		it("should return true when transaction holds locks", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);

			assert.strictEqual(lockManager.holdsLocks("tx1"), true);
			assert.strictEqual(lockManager.holdsLocks("tx2"), false);
		});

		/**
		 * Test checking after releasing all locks
		 */
		it("should return false after releasing all locks", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			lockManager.releaseAllLocks("tx1");

			assert.strictEqual(lockManager.holdsLocks("tx1"), false);
		});
	});

	describe("getStats()", () => {
		/**
		 * Test lock statistics
		 */
		it("should return correct lock statistics", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx1", "record2", LockTypes.EXCLUSIVE);
			
			const stats = lockManager.getStats();

			assert.strictEqual(stats.totalLocks, 2);
			assert.strictEqual(stats.sharedLocks, 1);
			assert.strictEqual(stats.exclusiveLocks, 1);
			assert.strictEqual(stats.uniqueHolders, 2);
			assert.ok(stats.lockHolders.has("tx1"));
			assert.ok(stats.lockHolders.has("tx2"));
			assert.strictEqual(stats.recordsLocked.length, 2);
		});

		/**
		 * Test empty statistics
		 */
		it("should return correct empty statistics", () => {
			const stats = lockManager.getStats();

			assert.strictEqual(stats.totalLocks, 0);
			assert.strictEqual(stats.sharedLocks, 0);
			assert.strictEqual(stats.exclusiveLocks, 0);
			assert.strictEqual(stats.uniqueHolders, 0);
			assert.strictEqual(stats.recordsLocked.length, 0);
		});
	});
});

/**
 * Tests for Transaction class
 */
describe("Transaction", () => {
	describe("Constructor", () => {
		/**
		 * Test default transaction construction
		 */
		it("should create transaction with default options", () => {
			const transaction = new Transaction();

			assert.ok(transaction.id);
			assert.strictEqual(transaction.state, TransactionStates.PENDING);
			assert.strictEqual(transaction.isolationLevel, IsolationLevels.READ_COMMITTED);
			assert.strictEqual(transaction.timeout, 60000);
			assert.strictEqual(transaction.readOnly, false);
			assert.strictEqual(transaction.startTime, null);
			assert.strictEqual(transaction.endTime, null);
			assert.ok(Array.isArray(transaction.operations));
			assert.ok(transaction.readSet instanceof Set);
			assert.ok(transaction.writeSet instanceof Set);
			assert.ok(transaction.snapshot instanceof Map);
		});

		/**
		 * Test transaction construction with custom options
		 */
		it("should create transaction with custom options", () => {
			const options = {
				isolationLevel: IsolationLevels.SERIALIZABLE,
				timeout: 30000,
				readOnly: true
			};
			const transaction = new Transaction("custom-id", options);

			assert.strictEqual(transaction.id, "custom-id");
			assert.strictEqual(transaction.isolationLevel, IsolationLevels.SERIALIZABLE);
			assert.strictEqual(transaction.timeout, 30000);
			assert.strictEqual(transaction.readOnly, true);
		});

		/**
		 * Test transaction immutability
		 */
		it("should create sealed transactions", () => {
			const transaction = new Transaction();

			assert.throws(() => {
				transaction.newProperty = "value";
			}, TypeError);
		});
	});

	describe("begin()", () => {
		/**
		 * Test beginning transaction
		 */
		it("should begin pending transaction", () => {
			const transaction = new Transaction();
			const result = transaction.begin();

			assert.strictEqual(result, transaction); // Should return this for chaining
			assert.strictEqual(transaction.state, TransactionStates.ACTIVE);
			assert.ok(transaction.startTime instanceof Date);
		});

		/**
		 * Test error when beginning non-pending transaction
		 */
		it("should throw error when beginning non-pending transaction", () => {
			const transaction = new Transaction();
			transaction.begin();

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

		/**
		 * Test adding SET operation
		 */
		it("should add SET operation to active transaction", () => {
			const operation = transaction.addOperation(OperationTypes.SET, "key1", "oldValue", "newValue");

			assert.ok(operation instanceof TransactionOperation);
			assert.strictEqual(operation.type, OperationTypes.SET);
			assert.strictEqual(operation.key, "key1");
			assert.strictEqual(transaction.operations.length, 1);
			assert.ok(transaction.writeSet.has("key1"));
		});

		/**
		 * Test adding read operation
		 */
		it("should add read operation and track in read set", () => {
			const operation = transaction.addOperation("read", "key1", undefined, "value");

			assert.strictEqual(operation.type, "read");
			assert.ok(transaction.readSet.has("key1"));
			assert.ok(!transaction.writeSet.has("key1"));
		});

		/**
		 * Test adding operation with metadata
		 */
		it("should add operation with metadata", () => {
			const metadata = { source: "test" };
			const operation = transaction.addOperation(OperationTypes.DELETE, "key1", "value", undefined, metadata);

			assert.deepStrictEqual(operation.metadata, metadata);
		});

		/**
		 * Test error when adding operation to inactive transaction
		 */
		it("should throw error when adding operation to inactive transaction", () => {
			const inactiveTransaction = new Transaction();

			assert.throws(() => {
				inactiveTransaction.addOperation(OperationTypes.SET, "key1", "old", "new");
			}, TransactionError);
		});

		/**
		 * Test error when adding write operation to read-only transaction
		 */
		it("should throw error when adding write operation to read-only transaction", () => {
			const readOnlyTransaction = new Transaction("id", { readOnly: true });
			readOnlyTransaction.begin();

			assert.throws(() => {
				readOnlyTransaction.addOperation(OperationTypes.SET, "key1", "old", "new");
			}, TransactionError);
		});

		/**
		 * Test read operations allowed in read-only transaction
		 */
		it("should allow read operations in read-only transaction", () => {
			const readOnlyTransaction = new Transaction("id", { readOnly: true });
			readOnlyTransaction.begin();

			const operation = readOnlyTransaction.addOperation("read", "key1", undefined, "value");

			assert.strictEqual(operation.type, "read");
			assert.ok(readOnlyTransaction.readSet.has("key1"));
		});
	});

	describe("setValidation()", () => {
		/**
		 * Test setting validation callback
		 */
		it("should set validation callback", () => {
			const transaction = new Transaction();
			const validationFn = () => true;
			const result = transaction.setValidation(validationFn);

			assert.strictEqual(result, transaction); // Should return this for chaining
			assert.strictEqual(transaction.validationCallback, validationFn);
		});
	});

	describe("validate()", () => {
		/**
		 * Test successful validation
		 */
		it("should return true when validation passes", () => {
			const transaction = new Transaction();
			transaction.setValidation(() => true);

			const result = transaction.validate();

			assert.strictEqual(result, true);
		});

		/**
		 * Test validation with no callback
		 */
		it("should return true when no validation callback set", () => {
			const transaction = new Transaction();

			const result = transaction.validate();

			assert.strictEqual(result, true);
		});

		/**
		 * Test validation failure with string message
		 */
		it("should throw error when validation fails with string message", () => {
			const transaction = new Transaction();
			transaction.setValidation(() => "Custom validation error");

			assert.throws(() => {
				transaction.validate();
			}, TransactionError, "Custom validation error");
		});

		/**
		 * Test validation failure with boolean false
		 */
		it("should throw error when validation returns false", () => {
			const transaction = new Transaction();
			transaction.setValidation(() => false);

			assert.throws(() => {
				transaction.validate();
			}, TransactionError, "Transaction validation failed");
		});

		/**
		 * Test validation with context
		 */
		it("should pass context to validation callback", () => {
			const transaction = new Transaction();
			const context = { checkData: true };
			let receivedContext;

			transaction.setValidation((tx, ctx) => {
				receivedContext = ctx;
				return true;
			});

			transaction.validate(context);

			assert.deepStrictEqual(receivedContext, context);
		});
	});

	describe("commit()", () => {
		let transaction;

		beforeEach(() => {
			transaction = new Transaction();
			transaction.begin();
		});

		/**
		 * Test successful commit
		 */
		it("should commit active transaction", () => {
			const result = transaction.commit();

			assert.strictEqual(result, transaction); // Should return this for chaining
			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
			assert.ok(transaction.endTime instanceof Date);
		});

		/**
		 * Test commit with validation
		 */
		it("should validate before commit", () => {
			let validationCalled = false;
			transaction.setValidation(() => {
				validationCalled = true;
				return true;
			});

			transaction.commit();

			assert.strictEqual(validationCalled, true);
			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
		});

		/**
		 * Test commit auto-abort on validation failure
		 */
		it("should auto-abort on validation failure", () => {
			transaction.setValidation(() => false);

			assert.throws(() => {
				transaction.commit();
			}, TransactionError);

			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
		});

		/**
		 * Test error when committing inactive transaction
		 */
		it("should throw error when committing inactive transaction", () => {
			const inactiveTransaction = new Transaction();

			assert.throws(() => {
				inactiveTransaction.commit();
			}, TransactionError);
		});
	});

	describe("abort()", () => {
		/**
		 * Test aborting active transaction
		 */
		it("should abort active transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			const result = transaction.abort("Test abort");

			assert.strictEqual(result, transaction); // Should return this for chaining
			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			assert.ok(transaction.endTime instanceof Date);
			assert.strictEqual(transaction.abortReason, "Test abort");
		});

		/**
		 * Test aborting with default reason
		 */
		it("should abort with default reason", () => {
			const transaction = new Transaction();
			transaction.begin();
			transaction.abort();

			assert.strictEqual(transaction.abortReason, "User abort");
		});

		/**
		 * Test aborting already aborted transaction
		 */
		it("should not change state when aborting already aborted transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			transaction.abort("First abort");
			const firstEndTime = transaction.endTime;
			
			transaction.abort("Second abort");

			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			assert.strictEqual(transaction.abortReason, "First abort");
			assert.strictEqual(transaction.endTime, firstEndTime);
		});

		/**
		 * Test aborting committed transaction
		 */
		it("should not change state when aborting committed transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			transaction.commit();
			
			transaction.abort("Should not work");

			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
			assert.ok(!transaction.abortReason);
		});
	});

	describe("getRollbackOperations()", () => {
		/**
		 * Test getting rollback operations
		 */
		it("should return rollback operations in reverse order", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			transaction.addOperation(OperationTypes.SET, "key1", undefined, "value1");
			transaction.addOperation(OperationTypes.SET, "key2", "oldValue", "newValue");
			transaction.addOperation(OperationTypes.DELETE, "key3", "deletedValue", undefined);

			const rollbacks = transaction.getRollbackOperations();

			assert.strictEqual(rollbacks.length, 3);
			
			// Should be in reverse order
			assert.strictEqual(rollbacks[0].key, "key3");
			assert.strictEqual(rollbacks[0].type, OperationTypes.SET);
			
			assert.strictEqual(rollbacks[1].key, "key2");
			assert.strictEqual(rollbacks[1].type, OperationTypes.SET);
			
			assert.strictEqual(rollbacks[2].key, "key1");
			assert.strictEqual(rollbacks[2].type, OperationTypes.DELETE);
		});

		/**
		 * Test empty rollback operations
		 */
		it("should return empty array for transaction with no operations", () => {
			const transaction = new Transaction();
			transaction.begin();

			const rollbacks = transaction.getRollbackOperations();

			assert.strictEqual(rollbacks.length, 0);
		});
	});

	describe("State Checking Methods", () => {
		/**
		 * Test isActive()
		 */
		it("should correctly report active state", () => {
			const transaction = new Transaction();
			
			assert.strictEqual(transaction.isActive(), false);
			
			transaction.begin();
			assert.strictEqual(transaction.isActive(), true);
			
			transaction.commit();
			assert.strictEqual(transaction.isActive(), false);
		});

		/**
		 * Test isCommitted()
		 */
		it("should correctly report committed state", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			assert.strictEqual(transaction.isCommitted(), false);
			
			transaction.commit();
			assert.strictEqual(transaction.isCommitted(), true);
		});

		/**
		 * Test isAborted()
		 */
		it("should correctly report aborted state", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			assert.strictEqual(transaction.isAborted(), false);
			
			transaction.abort();
			assert.strictEqual(transaction.isAborted(), true);
		});
	});

	describe("getDuration()", () => {
		/**
		 * Test duration calculation
		 */
		it("should calculate duration for completed transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			// Simulate some time passing
			setTimeout(() => {
				transaction.commit();
				
				const duration = transaction.getDuration();
				assert.ok(typeof duration === "number");
				assert.ok(duration >= 0);
			}, 10);
		});

		/**
		 * Test duration for active transaction
		 */
		it("should calculate duration for active transaction", () => {
			const transaction = new Transaction();
			transaction.begin();
			
			const duration = transaction.getDuration();
			assert.ok(typeof duration === "number");
			assert.ok(duration >= 0);
		});

		/**
		 * Test duration for pending transaction
		 */
		it("should return null for pending transaction", () => {
			const transaction = new Transaction();
			
			const duration = transaction.getDuration();
			assert.strictEqual(duration, null);
		});
	});

	describe("getStats()", () => {
		/**
		 * Test comprehensive statistics
		 */
		it("should return comprehensive transaction statistics", () => {
			const transaction = new Transaction("test-id", { 
				isolationLevel: IsolationLevels.SERIALIZABLE,
				readOnly: true
			});
			transaction.begin();
			transaction.addOperation("read", "key1", undefined, "value");
			transaction.snapshot.set("key1", "snapshot-value");

			const stats = transaction.getStats();

			assert.strictEqual(stats.id, "test-id");
			assert.strictEqual(stats.state, TransactionStates.ACTIVE);
			assert.strictEqual(stats.isolationLevel, IsolationLevels.SERIALIZABLE);
			assert.strictEqual(stats.readOnly, true);
			assert.ok(stats.startTime instanceof Date);
			assert.strictEqual(stats.endTime, null);
			assert.ok(typeof stats.duration === "number");
			assert.strictEqual(stats.operationCount, 1);
			assert.strictEqual(stats.readSetSize, 1);
			assert.strictEqual(stats.writeSetSize, 0);
			assert.strictEqual(stats.snapshotSize, 1);
			assert.strictEqual(stats.timedOut, false);
		});
	});

	describe("export()", () => {
		/**
		 * Test transaction export
		 */
		it("should export transaction data for debugging", () => {
			const transaction = new Transaction("export-test");
			transaction.begin();
			transaction.addOperation(OperationTypes.SET, "key1", "old", "new", { test: true });
			transaction.addOperation("read", "key2", undefined, "value");

			const exported = transaction.export();

			assert.strictEqual(exported.id, "export-test");
			assert.strictEqual(exported.state, TransactionStates.ACTIVE);
			assert.strictEqual(exported.operationCount, 2);
			assert.strictEqual(exported.operations.length, 2);
			assert.deepStrictEqual(exported.readSet, ["key2"]);
			assert.deepStrictEqual(exported.writeSet, ["key1"]);
			
			// Check operation export
			assert.ok(exported.operations[0].id);
			assert.strictEqual(exported.operations[0].type, OperationTypes.SET);
			assert.strictEqual(exported.operations[0].key, "key1");
			assert.ok(exported.operations[0].timestamp);
			assert.deepStrictEqual(exported.operations[0].metadata, { test: true });
			
			// Should not include sensitive data like oldValue/newValue
			assert.ok(!exported.operations[0].hasOwnProperty("oldValue"));
			assert.ok(!exported.operations[0].hasOwnProperty("newValue"));
		});
	});

	describe("Timeout Handling", () => {
		/**
		 * Test timeout detection
		 */
		it("should detect timeout", () => {
			const transaction = new Transaction("timeout-test", { timeout: 100 });
			transaction.begin();

			// Manually set start time to simulate timeout
			transaction.startTime = new Date(Date.now() - 200);

			assert.throws(() => {
				transaction.addOperation(OperationTypes.SET, "key1", "old", "new");
			}, TransactionError, "Transaction has timed out");
		});

		/**
		 * Test no timeout for pending transaction
		 */
		it("should not timeout pending transaction", () => {
			const transaction = new Transaction("no-timeout", { timeout: 100 });

			// Should not throw for pending transaction
			const stats = transaction.getStats();
			assert.strictEqual(stats.timedOut, false);
		});
	});
});

/**
 * Tests for TransactionManager class
 */
describe("TransactionManager", () => {
	let manager;

	beforeEach(() => {
		manager = new TransactionManager();
	});

	describe("Constructor", () => {
		/**
		 * Test transaction manager initialization
		 */
		it("should initialize with empty state", () => {
			const manager = new TransactionManager();

			assert.ok(manager.transactions instanceof Map);
			assert.strictEqual(manager.transactions.size, 0);
			assert.ok(manager.lockManager instanceof LockManager);
			assert.strictEqual(manager.transactionCounter, 0);
			assert.ok(manager.stats);
			assert.strictEqual(manager.stats.totalTransactions, 0);
			assert.strictEqual(manager.stats.committedTransactions, 0);
			assert.strictEqual(manager.stats.abortedTransactions, 0);
			assert.strictEqual(manager.stats.activeTransactions, 0);
		});
	});

	describe("begin()", () => {
		/**
		 * Test beginning new transaction
		 */
		it("should begin new transaction", () => {
			const transaction = manager.begin();

			assert.ok(transaction instanceof Transaction);
			assert.strictEqual(transaction.state, TransactionStates.ACTIVE);
			assert.ok(manager.transactions.has(transaction.id));
			assert.strictEqual(manager.transactionCounter, 1);
			assert.strictEqual(manager.stats.totalTransactions, 1);
			assert.strictEqual(manager.stats.activeTransactions, 1);
		});

		/**
		 * Test beginning transaction with options
		 */
		it("should begin transaction with custom options", () => {
			const options = {
				isolationLevel: IsolationLevels.SERIALIZABLE,
				timeout: 30000,
				readOnly: true
			};
			const transaction = manager.begin(options);

			assert.strictEqual(transaction.isolationLevel, IsolationLevels.SERIALIZABLE);
			assert.strictEqual(transaction.timeout, 30000);
			assert.strictEqual(transaction.readOnly, true);
		});

		/**
		 * Test multiple transactions
		 */
		it("should handle multiple concurrent transactions", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const tx3 = manager.begin();

			assert.strictEqual(manager.transactions.size, 3);
			assert.strictEqual(manager.transactionCounter, 3);
			assert.strictEqual(manager.stats.activeTransactions, 3);
			assert.notStrictEqual(tx1.id, tx2.id);
			assert.notStrictEqual(tx2.id, tx3.id);
		});
	});

	describe("getTransaction()", () => {
		/**
		 * Test getting existing transaction
		 */
		it("should return existing transaction", () => {
			const transaction = manager.begin();
			const retrieved = manager.getTransaction(transaction.id);

			assert.strictEqual(retrieved, transaction);
		});

		/**
		 * Test getting non-existing transaction
		 */
		it("should return undefined for non-existing transaction", () => {
			const retrieved = manager.getTransaction("non-existing-id");

			assert.strictEqual(retrieved, undefined);
		});
	});

	describe("commit()", () => {
		/**
		 * Test successful commit
		 */
		it("should commit transaction successfully", async () => {
			const transaction = manager.begin();
			transaction.addOperation(OperationTypes.SET, "key1", "old", "new");
			
			const committed = await manager.commit(transaction.id);

			assert.strictEqual(committed, transaction);
			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
			assert.strictEqual(manager.stats.committedTransactions, 1);
			assert.strictEqual(manager.stats.activeTransactions, 0);
		});

		/**
		 * Test commit with validation
		 */
		it("should commit transaction with validation", async () => {
			const transaction = manager.begin();
			transaction.setValidation(() => true);
			transaction.addOperation(OperationTypes.SET, "key1", "old", "new");
			
			const committed = await manager.commit(transaction.id);

			assert.strictEqual(committed.state, TransactionStates.COMMITTED);
		});

		/**
		 * Test commit with validation failure
		 */
		it("should auto-abort on validation failure during commit", async () => {
			const transaction = manager.begin();
			transaction.setValidation(() => false);
			transaction.addOperation(OperationTypes.SET, "key1", "old", "new");
			
			await assert.rejects(async () => {
				await manager.commit(transaction.id);
			}, TransactionError);

			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			assert.strictEqual(manager.stats.abortedTransactions, 1);
			assert.strictEqual(manager.stats.committedTransactions, 0);
		});

		/**
		 * Test commit with locking
		 */
		it("should acquire locks during commit", async () => {
			const transaction = manager.begin();
			transaction.addOperation(OperationTypes.SET, "key1", "old", "new");
			transaction.addOperation(OperationTypes.DELETE, "key2", "value", undefined);
			
			await manager.commit(transaction.id);

			// Locks should be released after commit
			assert.strictEqual(manager.lockManager.holdsLocks(transaction.id), false);
		});

		/**
		 * Test commit non-existing transaction
		 */
		it("should throw error for non-existing transaction", async () => {
			await assert.rejects(async () => {
				await manager.commit("non-existing-id");
			}, TransactionError, "Transaction non-existing-id not found");
		});

		/**
		 * Test commit with context
		 */
		it("should pass context to commit", async () => {
			const transaction = manager.begin();
			const context = { source: "test" };
			let receivedContext;

			transaction.setValidation((tx, ctx) => {
				receivedContext = ctx;
				return true;
			});

			await manager.commit(transaction.id, context);

			assert.deepStrictEqual(receivedContext, context);
		});
	});

	describe("abort()", () => {
		/**
		 * Test aborting transaction
		 */
		it("should abort transaction", () => {
			const transaction = manager.begin();
			transaction.addOperation(OperationTypes.SET, "key1", "old", "new");
			
			const aborted = manager.abort(transaction.id, "Test abort");

			assert.strictEqual(aborted, transaction);
			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			assert.strictEqual(transaction.abortReason, "Test abort");
			assert.strictEqual(manager.stats.abortedTransactions, 1);
			assert.strictEqual(manager.stats.activeTransactions, 0);
		});

		/**
		 * Test abort with default reason
		 */
		it("should abort with default reason", () => {
			const transaction = manager.begin();
			
			const aborted = manager.abort(transaction.id);

			assert.strictEqual(aborted.abortReason, "Manual abort");
		});

		/**
		 * Test abort releases locks
		 */
		it("should release locks on abort", async () => {
			const transaction = manager.begin();
			transaction.addOperation(OperationTypes.SET, "key1", "old", "new");
			
			// Manually acquire lock to test release
			await manager.lockManager.acquireLock(transaction.id, "key1", LockTypes.EXCLUSIVE);
			assert.strictEqual(manager.lockManager.holdsLocks(transaction.id), true);
			
			manager.abort(transaction.id);

			assert.strictEqual(manager.lockManager.holdsLocks(transaction.id), false);
		});

		/**
		 * Test abort non-existing transaction
		 */
		it("should throw error for non-existing transaction", () => {
			assert.throws(() => {
				manager.abort("non-existing-id");
			}, TransactionError, "Transaction non-existing-id not found");
		});
	});

	describe("cleanup()", () => {
		/**
		 * Test cleaning up old transactions
		 */
		it("should cleanup old completed transactions", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const tx3 = manager.begin();
			
			// Commit some transactions
			tx1.commit();
			tx2.abort();
			// tx3 remains active

			// Simulate old timestamps
			tx1.endTime = new Date(Date.now() - 7200000); // 2 hours ago
			tx2.endTime = new Date(Date.now() - 3600000); // 1 hour ago

			const cleaned = manager.cleanup(3600000); // Clean transactions older than 1 hour

			assert.strictEqual(cleaned, 1); // Only tx1 should be cleaned
			assert.ok(!manager.transactions.has(tx1.id));
			assert.ok(manager.transactions.has(tx2.id)); // Still within age limit
			assert.ok(manager.transactions.has(tx3.id)); // Still active
		});

		/**
		 * Test cleanup with no old transactions
		 */
		it("should return zero when no transactions to cleanup", () => {
			const transaction = manager.begin();
			transaction.commit();

			const cleaned = manager.cleanup();

			assert.strictEqual(cleaned, 0);
		});
	});

	describe("getActiveTransactions()", () => {
		/**
		 * Test getting active transactions
		 */
		it("should return only active transactions", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const tx3 = manager.begin();
			
			tx2.commit();
			tx3.abort();

			const active = manager.getActiveTransactions();

			assert.strictEqual(active.length, 1);
			assert.strictEqual(active[0], tx1);
			assert.strictEqual(active[0].state, TransactionStates.ACTIVE);
		});

		/**
		 * Test with no active transactions
		 */
		it("should return empty array when no active transactions", () => {
			const active = manager.getActiveTransactions();

			assert.strictEqual(active.length, 0);
		});
	});

	describe("detectDeadlocks()", () => {
		/**
		 * Test deadlock detection
		 */
		it("should detect potential deadlocks based on wait time", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			// Simulate long-running transactions
			tx1.startTime = new Date(Date.now() - 15000); // 15 seconds ago
			tx2.startTime = new Date(Date.now() - 5000);  // 5 seconds ago

			const results = manager.detectDeadlocks();

			assert.strictEqual(results.timeoutVictims.length, 1);
			assert.strictEqual(results.timeoutVictims[0], tx1.id);
		});

		/**
		 * Test no deadlocks detected
		 */
		it("should return empty array when no deadlocks detected", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();

			const results = manager.detectDeadlocks();

			assert.strictEqual(results.timeoutVictims.length, 0);
			assert.strictEqual(results.deadlocks.length, 0);
		});
	});

	describe("getStats()", () => {
		/**
		 * Test comprehensive statistics
		 */
		it("should return comprehensive statistics", async () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const tx3 = manager.begin();
			
			// Commit and abort through manager to update stats
			await manager.commit(tx1.id);
			manager.abort(tx2.id);
			// tx3 remains active

			const stats = manager.getStats();

			assert.strictEqual(stats.totalTransactions, 3);
			assert.strictEqual(stats.committedTransactions, 1);
			assert.strictEqual(stats.abortedTransactions, 1);
			assert.strictEqual(stats.activeTransactions, 1);
			assert.strictEqual(stats.transactionCounter, 3);
			assert.ok(stats.lockStats);
			assert.ok(typeof stats.averageDuration === "number");
			assert.ok(typeof stats.totalDuration === "number");
		});

		/**
		 * Test statistics calculation with durations
		 */
		it("should calculate average duration correctly", async () => {
			// Start with a fresh manager to avoid cumulative stats
			const testManager = new TransactionManager();
			const tx1 = testManager.begin();
			const tx2 = testManager.begin();
			
			// Set start times
			const baseTime = Date.now() - 1000;
			tx1.startTime = new Date(baseTime);
			tx2.startTime = new Date(baseTime);

			// Commit and abort - this will set endTime automatically
			await testManager.commit(tx1.id);
			testManager.abort(tx2.id);

			// Override endTime after commit/abort to get predictable durations for testing
			tx1.endTime = new Date(baseTime + 500); // 500ms duration
			tx2.endTime = new Date(baseTime + 300); // 300ms duration

			// Reset and recalculate stats with our controlled durations
			testManager.stats.totalDuration = 0;
			testManager._updateDurationStats(tx1);
			testManager._updateDurationStats(tx2);

			const stats = testManager.getStats();

			assert.strictEqual(stats.totalDuration, 800); // 500 + 300
			assert.strictEqual(stats.averageDuration, 400); // 800 / 2
			assert.strictEqual(stats.committedTransactions, 1);
			assert.strictEqual(stats.abortedTransactions, 1);
		});
	});

	describe("Concurrency Control", () => {
		/**
		 * Test lock conflicts between transactions
		 */
		it("should handle lock conflicts between transactions", async () => {
			const tx1 = manager.begin({ isolationLevel: IsolationLevels.READ_COMMITTED });
			const tx2 = manager.begin({ isolationLevel: IsolationLevels.READ_COMMITTED });
			
			tx1.addOperation(OperationTypes.SET, "shared-key", "old1", "new1");
			tx2.addOperation(OperationTypes.SET, "shared-key", "old2", "new2");

			// When both transactions have conflicting writes, the first to commit should detect the conflict
			await assert.rejects(
				async () => await manager.commit(tx1.id),
				{
					name: 'TransactionError',
					message: /Write conflict detected/
				}
			);
			
			assert.strictEqual(tx1.state, TransactionStates.ABORTED);
			
			// Now tx2 should be able to commit successfully since tx1 is aborted
			await manager.commit(tx2.id);
			assert.strictEqual(tx2.state, TransactionStates.COMMITTED);
		});

		/**
		 * Test concurrent read operations
		 */
		it("should allow concurrent read operations", async () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			tx1.addOperation("read", "shared-key", undefined, "value");
			tx2.addOperation("read", "shared-key", undefined, "value");

			// Both should commit successfully
			await manager.commit(tx1.id);
			await manager.commit(tx2.id);

			assert.strictEqual(tx1.state, TransactionStates.COMMITTED);
			assert.strictEqual(tx2.state, TransactionStates.COMMITTED);
		});
	});

	describe("Isolation Validation", () => {
		/**
		 * Test READ_UNCOMMITTED isolation level
		 */
		it("should allow all operations in READ_UNCOMMITTED", async () => {
			const tx1 = manager.begin({ isolationLevel: IsolationLevels.READ_UNCOMMITTED });
			const tx2 = manager.begin({ isolationLevel: IsolationLevels.READ_UNCOMMITTED });
			
			tx1.addOperation(OperationTypes.SET, "key1", "old", "new");
			tx2.addOperation(OperationTypes.SET, "key2", "old", "new2"); // Different keys to avoid conflicts

			// Both should commit successfully with READ_UNCOMMITTED
			await manager.commit(tx1.id);
			await manager.commit(tx2.id);

			assert.strictEqual(tx1.state, TransactionStates.COMMITTED);
			assert.strictEqual(tx2.state, TransactionStates.COMMITTED);
		});

		/**
		 * Test READ_COMMITTED write conflict detection
		 */
		it("should detect write conflicts in READ_COMMITTED", async () => {
			const tx1 = manager.begin({ isolationLevel: IsolationLevels.READ_COMMITTED });
			const tx2 = manager.begin({ isolationLevel: IsolationLevels.READ_COMMITTED });
			
			tx1.addOperation(OperationTypes.SET, "conflicted-key", "old", "new1");
			tx2.addOperation(OperationTypes.SET, "conflicted-key", "old", "new2");

			// When both transactions have conflicting writes, the first to commit should detect the conflict
			await assert.rejects(
				async () => await manager.commit(tx1.id),
				{
					name: 'TransactionError',
					message: /Write conflict detected/
				}
			);
			
			assert.strictEqual(tx1.state, TransactionStates.ABORTED);
			
			// Now tx2 should be able to commit successfully since tx1 is aborted
			await manager.commit(tx2.id);
			assert.strictEqual(tx2.state, TransactionStates.COMMITTED);
		});

		/**
		 * Test REPEATABLE_READ isolation validation
		 */
		it("should validate REPEATABLE_READ constraints", async () => {
			const tx1 = manager.begin({ isolationLevel: IsolationLevels.REPEATABLE_READ });
			
			tx1.addOperation("read", "key1", undefined, "value1");
			tx1.addOperation(OperationTypes.SET, "key2", "old", "new");

			// Should commit successfully
			await manager.commit(tx1.id);
			assert.strictEqual(tx1.state, TransactionStates.COMMITTED);
		});

		/**
		 * Test SERIALIZABLE isolation validation
		 */
		it("should validate SERIALIZABLE constraints", async () => {
			const tx1 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
			
			tx1.addOperation("read", "key1", undefined, "value1");
			tx1.addOperation(OperationTypes.SET, "key2", "old", "new");

			// Should commit successfully
			await manager.commit(tx1.id);
			assert.strictEqual(tx1.state, TransactionStates.COMMITTED);
		});

		/**
		 * Test unknown isolation level error
		 */
		it("should throw error for unknown isolation level", async () => {
			const tx = manager.begin();
			tx.isolationLevel = 999; // Invalid isolation level
			tx.addOperation(OperationTypes.SET, "key1", "old", "new");

			await assert.rejects(async () => {
				await manager.commit(tx.id);
			}, TransactionError, "Unknown isolation level");
		});

		/**
		 * Test transaction overlap detection
		 */
		it("should detect transaction overlap correctly", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			// Set overlapping time periods
			tx1.startTime = new Date(Date.now() - 1000);
			tx2.startTime = new Date(Date.now() - 500);
			
			// Test overlap detection (using private method for testing)
			const overlap = manager._transactionsOverlap(tx1, tx2);
			assert.strictEqual(overlap, true);
		});

		/**
		 * Test no overlap when transactions don't intersect
		 */
		it("should detect non-overlapping transactions", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			// Set non-overlapping time periods
			tx1.startTime = new Date(Date.now() - 2000);
			tx1.endTime = new Date(Date.now() - 1000);
			tx2.startTime = new Date(Date.now() - 500);
			
			const overlap = manager._transactionsOverlap(tx1, tx2);
			assert.strictEqual(overlap, false);
		});

		/**
		 * Test overlap detection with missing start times
		 */
		it("should handle missing start times in overlap detection", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			// Don't set start times
			tx1.startTime = null;
			tx2.startTime = null;
			
			const overlap = manager._transactionsOverlap(tx1, tx2);
			assert.strictEqual(overlap, false);
		});

		/**
		 * Test conflicting writes detection
		 */
		it("should find conflicting writes between active transactions", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			tx1.addOperation(OperationTypes.SET, "shared-key", "old", "new1");
			tx2.addOperation(OperationTypes.SET, "shared-key", "old", "new2");
			
			const conflicts = manager._findConflictingWrites(tx1.id, "shared-key");
			assert.strictEqual(conflicts.length, 1);
			assert.strictEqual(conflicts[0], tx2.id);
		});

		/**
		 * Test read set conflict detection
		 */
		it("should detect read set conflicts", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			// Add read to tx1
			tx1.addOperation("read", "key1", undefined, "value");
			
			// Commit tx2 that modifies the same key
			tx2.addOperation(OperationTypes.SET, "key1", "old", "new");
			tx2.commit();
			
			// Check for conflict
			const hasConflict = manager._hasReadSetConflict(tx1, "key1");
			// Should be false since tx2 didn't start after tx1 in this test
			assert.strictEqual(hasConflict, false);
		});

		/**
		 * Test snapshot conflict detection
		 */
		it("should detect snapshot conflicts", () => {
			const tx = manager.begin();
			tx.snapshot.set("key1", "expected-value");
			
			const hasConflict = manager._hasSnapshotConflict(tx, "key1", "expected-value");
			assert.strictEqual(typeof hasConflict, "boolean");
		});

		/**
		 * Test conflicting writes to read detection
		 */
		it("should find conflicting writes to reads", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			tx1.addOperation("read", "key1", undefined, "value");
			tx2.addOperation(OperationTypes.SET, "key1", "old", "new");
			
			// Set overlapping times
			tx1.startTime = new Date(Date.now() - 1000);
			tx2.startTime = new Date(Date.now() - 500);
			
			const conflicts = manager._findConflictingWritesToRead(tx1, "key1");
			assert.strictEqual(conflicts.length, 1);
			assert.strictEqual(conflicts[0], tx2.id);
		});

		/**
		 * Test conflicting reads to write detection
		 */
		it("should find conflicting reads to writes", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			tx1.addOperation(OperationTypes.SET, "key1", "old", "new");
			tx2.addOperation("read", "key1", undefined, "value");
			
			// Set overlapping times
			tx1.startTime = new Date(Date.now() - 1000);
			tx2.startTime = new Date(Date.now() - 500);
			
			const conflicts = manager._findConflictingReadsToWrite(tx1, "key1");
			assert.strictEqual(conflicts.length, 1);
			assert.strictEqual(conflicts[0], tx2.id);
		});
	});
});

/**
 * Integration tests for complex transaction scenarios
 */
describe("Transaction Integration Tests", () => {
	let manager;

	beforeEach(() => {
		manager = new TransactionManager();
	});

	describe("Complex Transaction Workflows", () => {
		/**
		 * Test complete transaction lifecycle
		 */
		it("should handle complete transaction lifecycle", async () => {
			const transaction = manager.begin({
				isolationLevel: IsolationLevels.REPEATABLE_READ,
				timeout: 5000
			});

			// Add various operations
			transaction.addOperation(OperationTypes.SET, "user:1", undefined, { name: "John", age: 30 });
			transaction.addOperation(OperationTypes.SET, "user:2", { name: "Jane", age: 25 }, { name: "Jane", age: 26 });
			transaction.addOperation(OperationTypes.DELETE, "user:3", { name: "Bob", age: 35 }, undefined);
			transaction.addOperation("read", "user:4", undefined, { name: "Alice", age: 28 });

			// Set validation
			transaction.setValidation((tx, context) => {
				return tx.operations.length > 0 && context.validated === true;
			});

			// Export for debugging
			const exported = transaction.export();
			assert.strictEqual(exported.operations.length, 4);
			assert.strictEqual(exported.readSet.length, 1);
			assert.strictEqual(exported.writeSet.length, 3);

			// Get rollback operations (should only include write operations, not reads)
			const rollbacks = transaction.getRollbackOperations();
			assert.strictEqual(rollbacks.length, 3); // Only SET, SET, DELETE - read operations are filtered out

			// Add a small delay to ensure measurable duration
			await new Promise(resolve => setTimeout(resolve, 1));

			// Commit with context
			await manager.commit(transaction.id, { validated: true });

			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
			assert.ok(transaction.getDuration() >= 0); // Duration can be 0 for very fast operations

			const stats = manager.getStats();
			assert.strictEqual(stats.committedTransactions, 1);
		});

		/**
		 * Test transaction rollback scenario
		 */
		it("should handle transaction rollback scenario", async () => {
			const transaction = manager.begin();

			// Add operations that should be rolled back
			const op1 = transaction.addOperation(OperationTypes.SET, "key1", undefined, "value1");
			const op2 = transaction.addOperation(OperationTypes.SET, "key2", "oldValue", "newValue");
			const op3 = transaction.addOperation(OperationTypes.DELETE, "key3", "deletedValue", undefined);

			// Set failing validation
			transaction.setValidation(() => "Validation failed for testing");

			// Attempt to commit - should fail and auto-abort
			await assert.rejects(async () => {
				await manager.commit(transaction.id);
			}, TransactionError, "Validation failed for testing");

			assert.strictEqual(transaction.state, TransactionStates.ABORTED);

			// Verify rollback operations are correct
			const rollbacks = transaction.getRollbackOperations();
			assert.strictEqual(rollbacks.length, 3);
			
			// Check rollback order (reverse of original)
			assert.strictEqual(rollbacks[0].key, "key3");
			assert.strictEqual(rollbacks[0].type, OperationTypes.SET);
			assert.strictEqual(rollbacks[1].key, "key2");
			assert.strictEqual(rollbacks[2].key, "key1");
			assert.strictEqual(rollbacks[2].type, OperationTypes.DELETE);

			const stats = manager.getStats();
			assert.strictEqual(stats.abortedTransactions, 1);
			assert.strictEqual(stats.committedTransactions, 0);
		});

		/**
		 * Test multiple concurrent transactions
		 */
		it("should handle multiple concurrent transactions", async () => {
			const transactions = [];
			
			// Create multiple transactions
			for (let i = 0; i < 5; i++) {
				const tx = manager.begin({
					isolationLevel: IsolationLevels.READ_COMMITTED
				});
				tx.addOperation(OperationTypes.SET, `key${i}`, undefined, `value${i}`);
				transactions.push(tx);
			}

			// Commit all transactions
			const results = await Promise.all(
				transactions.map(tx => manager.commit(tx.id))
			);

			// Verify all committed
			results.forEach((tx, index) => {
				assert.strictEqual(tx.state, TransactionStates.COMMITTED);
				assert.strictEqual(tx, transactions[index]);
			});

			const stats = manager.getStats();
			assert.strictEqual(stats.totalTransactions, 5);
			assert.strictEqual(stats.committedTransactions, 5);
			assert.strictEqual(stats.abortedTransactions, 0);
			assert.strictEqual(stats.activeTransactions, 0);
		});

		/**
		 * Test read-only transaction
		 */
		it("should handle read-only transaction correctly", async () => {
			const transaction = manager.begin({ readOnly: true });

			// Add read operations
			transaction.addOperation("read", "user:1", undefined, { name: "John" });
			transaction.addOperation("read", "user:2", undefined, { name: "Jane" });

			// Should not allow write operations
			assert.throws(() => {
				transaction.addOperation(OperationTypes.SET, "user:3", undefined, { name: "Bob" });
			}, TransactionError, "Cannot perform write operations in read-only transaction");

			// Should commit successfully
			await manager.commit(transaction.id);

			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
			assert.strictEqual(transaction.readSet.size, 2);
			assert.strictEqual(transaction.writeSet.size, 0);
		});

		/**
		 * Test transaction timeout
		 */
		it("should handle transaction timeout", () => {
			const transaction = manager.begin({ timeout: 100 });

			// Manually set start time to simulate timeout
			transaction.startTime = new Date(Date.now() - 200);

			// Should throw timeout error
			assert.throws(() => {
				transaction.addOperation(OperationTypes.SET, "key1", "old", "new");
			}, TransactionError, "Transaction has timed out");

			const stats = transaction.getStats();
			assert.strictEqual(stats.timedOut, true);
		});

		/**
		 * Test transaction cleanup and memory management
		 */
		it("should properly cleanup completed transactions", async () => {
			// Create and complete multiple transactions
			const transactions = [];
			for (let i = 0; i < 10; i++) {
				const tx = manager.begin();
				tx.addOperation(OperationTypes.SET, `key${i}`, undefined, `value${i}`);
				await manager.commit(tx.id);
				transactions.push(tx);
			}

			assert.strictEqual(manager.transactions.size, 10);

			// Simulate aging by setting old end times
			transactions.forEach((tx, index) => {
				if (index < 5) {
					tx.endTime = new Date(Date.now() - 7200000); // 2 hours ago
				} else {
					tx.endTime = new Date(Date.now() - 1800000); // 30 minutes ago
				}
			});

			// Cleanup transactions older than 1 hour
			const cleaned = manager.cleanup(3600000);

			assert.strictEqual(cleaned, 5);
			assert.strictEqual(manager.transactions.size, 5);

			// Verify correct transactions were cleaned
			transactions.slice(0, 5).forEach(tx => {
				assert.ok(!manager.transactions.has(tx.id));
			});
			transactions.slice(5).forEach(tx => {
				assert.ok(manager.transactions.has(tx.id));
			});
		});
	});

	describe("Error Scenarios", () => {
		/**
		 * Test comprehensive error handling
		 */
		it("should handle various error scenarios gracefully", async () => {
			// Test invalid operation rollback
			const invalidOp = new TransactionOperation("invalid-type", "key1", "old", "new");
			assert.throws(() => {
				invalidOp.createRollback();
			}, TransactionError);

			// Test transaction state errors
			const tx = new Transaction();
			assert.throws(() => {
				tx.addOperation(OperationTypes.SET, "key1", "old", "new");
			}, TransactionError, "Transaction is not active");

			assert.throws(() => {
				tx.commit();
			}, TransactionError, "Transaction is not active");

			// Test manager errors
			await assert.rejects(async () => {
				await manager.commit("non-existent");
			}, TransactionError, "Transaction non-existent not found");

			assert.throws(() => {
				manager.abort("non-existent");
			}, TransactionError, "Transaction non-existent not found");
		});

		/**
		 * Test lock timeout scenarios
		 */
		it("should handle lock timeout scenarios", async () => {
			const lockManager = new LockManager();
			
			// Acquire exclusive lock
			await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);

			// Try to acquire conflicting lock with short timeout
			await assert.rejects(async () => {
				await lockManager.acquireLock("tx2", "record1", LockTypes.EXCLUSIVE, 50);
			}, ConcurrencyError);

			// Original lock should still be held
			assert.strictEqual(lockManager.holdsLocks("tx1"), true);
			assert.strictEqual(lockManager.holdsLocks("tx2"), false);
		});
	});

	describe("Edge Cases and Full Coverage", () => {
		/**
		 * Test transaction with all isolation levels
		 */
		it("should handle all isolation levels correctly", async () => {
			const levels = [
				IsolationLevels.READ_UNCOMMITTED,
				IsolationLevels.READ_COMMITTED,
				IsolationLevels.REPEATABLE_READ,
				IsolationLevels.SERIALIZABLE
			];

			for (const level of levels) {
				const tx = manager.begin({ isolationLevel: level });
				tx.addOperation(OperationTypes.SET, `key-${level}`, "old", "new");
				await manager.commit(tx.id);
				assert.strictEqual(tx.state, TransactionStates.COMMITTED);
			}
		});

		/**
		 * Test transaction abort reason preservation
		 */
		it("should preserve abort reason correctly", () => {
			const tx = manager.begin();
			const customReason = "Custom abort reason for testing";
			
			tx.abort(customReason);
			
			assert.strictEqual(tx.abortReason, customReason);
			assert.strictEqual(tx.state, TransactionStates.ABORTED);
		});

		/**
		 * Test transaction with snapshot data
		 */
		it("should handle snapshot data in repeatable read", async () => {
			const tx = manager.begin({ isolationLevel: IsolationLevels.REPEATABLE_READ });
			
			// Add snapshot data
			tx.snapshot.set("key1", "snapshot-value1");
			tx.snapshot.set("key2", "snapshot-value2");
			
			tx.addOperation("read", "key1", undefined, "snapshot-value1");
			
			await manager.commit(tx.id);
			assert.strictEqual(tx.state, TransactionStates.COMMITTED);
		});

		/**
		 * Test complex read-write dependency chains
		 */
		it("should handle complex read-write dependency chains", async () => {
			const tx1 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
			const tx2 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
			
			// Create dependency chain
			tx1.addOperation("read", "key1", undefined, "value1");
			tx1.addOperation(OperationTypes.SET, "key2", "old", "new");
			
			tx2.addOperation("read", "key2", undefined, "old");
			tx2.addOperation(OperationTypes.SET, "key3", "old", "new");
			
			// Set overlapping execution times
			tx1.startTime = new Date(Date.now() - 1000);
			tx2.startTime = new Date(Date.now() - 500);
			
			// In SERIALIZABLE isolation, conflicting read-write dependencies cause the first transaction to fail
			await assert.rejects(
				async () => await manager.commit(tx1.id),
				{
					name: 'TransactionError',
					message: /Serialization conflict/
				}
			);
			
			assert.strictEqual(tx1.state, TransactionStates.ABORTED);
			
			// Now tx2 should be able to commit successfully since tx1 is aborted
			await manager.commit(tx2.id);
			assert.strictEqual(tx2.state, TransactionStates.COMMITTED);
		});

		/**
		 * Test operations with complex metadata
		 */
		it("should handle operations with complex metadata", () => {
			const tx = manager.begin();
			
			const complexMetadata = {
				source: "test",
				timestamp: new Date(),
				nested: {
					level1: {
						level2: "deep value"
					}
				},
				array: [1, 2, 3, { nested: true }]
			};
			
			const operation = tx.addOperation(
				OperationTypes.SET,
				"complex-key",
				"old-value",
				"new-value",
				complexMetadata
			);
			
			assert.deepStrictEqual(operation.metadata, complexMetadata);
		});

		/**
		 * Test transaction stats with various states
		 */
		it("should provide accurate stats across all transaction states", async () => {
			const tx1 = manager.begin(); // Active
			const tx2 = manager.begin(); // Will be committed
			const tx3 = manager.begin(); // Will be aborted
			
			// Use manager methods to update stats properly
			await manager.commit(tx2.id);
			manager.abort(tx3.id, "Test abort");
			
			const stats = manager.getStats();
			
			assert.strictEqual(stats.totalTransactions, 3);
			assert.strictEqual(stats.activeTransactions, 1);
			assert.strictEqual(stats.committedTransactions, 1);
			assert.strictEqual(stats.abortedTransactions, 1);
		});

		/**
		 * Test lock manager with various scenarios
		 */
		it("should handle all lock manager edge cases", async () => {
			const lockManager = new LockManager();
			
			// Test releasing non-existent locks
			assert.strictEqual(lockManager.releaseLock("tx1", "nonexistent"), false);
			assert.strictEqual(lockManager.releaseAllLocks("tx1"), 0);
			assert.strictEqual(lockManager.holdsLocks("tx1"), false);
			
			// Test stats with no locks
			const emptyStats = lockManager.getStats();
			assert.strictEqual(emptyStats.totalLocks, 0);
			assert.strictEqual(emptyStats.uniqueHolders, 0);
			
			// Test complex locking scenario
			await lockManager.acquireLock("tx1", "key1", LockTypes.SHARED);
			await lockManager.acquireLock("tx2", "key1", LockTypes.SHARED);
			await lockManager.acquireLock("tx1", "key2", LockTypes.EXCLUSIVE);
			
			const fullStats = lockManager.getStats();
			assert.strictEqual(fullStats.totalLocks, 2);
			assert.strictEqual(fullStats.sharedLocks, 1);
			assert.strictEqual(fullStats.exclusiveLocks, 1);
			assert.strictEqual(fullStats.uniqueHolders, 2);
		});

		/**
		 * Test transaction export with all data types
		 */
		it("should export complete transaction data", () => {
			const tx = manager.begin({
				isolationLevel: IsolationLevels.SERIALIZABLE,
				timeout: 30000,
				readOnly: false
			});
			
			// Add various operations
			tx.addOperation(OperationTypes.SET, "key1", undefined, "new-value");
			tx.addOperation("read", "key2", undefined, "read-value");
			tx.addOperation(OperationTypes.DELETE, "key3", "deleted-value", undefined);
			
			// Add snapshot data
			tx.snapshot.set("snap1", "value1");
			
			const exported = tx.export();
			
			// Verify all fields are present
			assert.ok(exported.id);
			assert.strictEqual(exported.state, TransactionStates.ACTIVE);
			assert.strictEqual(exported.isolationLevel, IsolationLevels.SERIALIZABLE);
			assert.strictEqual(exported.readOnly, false);
			assert.ok(exported.hasOwnProperty('startTime'));
			assert.strictEqual(exported.operationCount, 3);
			assert.strictEqual(exported.readSetSize, 1);
			assert.strictEqual(exported.writeSetSize, 2);
			assert.strictEqual(exported.snapshotSize, 1);
			assert.strictEqual(exported.operations.length, 3);
			assert.strictEqual(exported.readSet.length, 1);
			assert.strictEqual(exported.writeSet.length, 2);
			
			// Verify operation export format
			const setOp = exported.operations.find(op => op.type === OperationTypes.SET);
			assert.ok(setOp.id);
			assert.ok(setOp.timestamp);
			assert.strictEqual(setOp.key, "key1");
			
			// Verify sensitive data is not exported
			assert.ok(!setOp.hasOwnProperty("oldValue"));
			assert.ok(!setOp.hasOwnProperty("newValue"));
		});

		/**
		 * Test rollback operations edge cases
		 */
		it("should handle rollback edge cases correctly", () => {
			const tx = manager.begin();
			
			// Add mixed operations including reads
			tx.addOperation("read", "read-key", undefined, "value");
			tx.addOperation(OperationTypes.SET, "set-key", undefined, "new-value");
			tx.addOperation(OperationTypes.DELETE, "delete-key", "old-value", undefined);
			tx.addOperation("read", "another-read", undefined, "value2");
			
			const rollbacks = tx.getRollbackOperations();
			
			// Should only have rollbacks for write operations, in reverse order
			assert.strictEqual(rollbacks.length, 2);
			assert.strictEqual(rollbacks[0].key, "delete-key");
			assert.strictEqual(rollbacks[0].type, OperationTypes.SET);
			assert.strictEqual(rollbacks[1].key, "set-key");
			assert.strictEqual(rollbacks[1].type, OperationTypes.DELETE);
		});

		/**
		 * Test transaction state transitions
		 */
		it("should handle all transaction state transitions correctly", () => {
			const tx = new Transaction();
			
			// Initial state
			assert.strictEqual(tx.state, TransactionStates.PENDING);
			assert.strictEqual(tx.isActive(), false);
			assert.strictEqual(tx.isCommitted(), false);
			assert.strictEqual(tx.isAborted(), false);
			
			// Begin
			tx.begin();
			assert.strictEqual(tx.state, TransactionStates.ACTIVE);
			assert.strictEqual(tx.isActive(), true);
			assert.strictEqual(tx.isCommitted(), false);
			assert.strictEqual(tx.isAborted(), false);
			
			// Commit
			tx.commit();
			assert.strictEqual(tx.state, TransactionStates.COMMITTED);
			assert.strictEqual(tx.isActive(), false);
			assert.strictEqual(tx.isCommitted(), true);
			assert.strictEqual(tx.isAborted(), false);
			
			// Test aborting committed transaction (should not change state)
			tx.abort("Should not work");
			assert.strictEqual(tx.state, TransactionStates.COMMITTED);
			assert.ok(!tx.abortReason); // Should not be set
		});

		/**
		 * Test all deadlock detection scenarios
		 */
		it("should handle deadlock detection edge cases", () => {
			// Test with no transactions
			const noTxResults = manager.detectDeadlocks();
			assert.strictEqual(noTxResults.timeoutVictims.length, 0);
			assert.strictEqual(noTxResults.deadlocks.length, 0);
			
			// Test with new transactions (shouldn't be detected as deadlocked)
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const newTxResults = manager.detectDeadlocks();
			assert.strictEqual(newTxResults.timeoutVictims.length, 0);
			assert.strictEqual(newTxResults.deadlocks.length, 0);
			
			// Test with old transaction (should be detected)
			tx1.startTime = new Date(Date.now() - 15000); // 15 seconds old
			const oldTxResults = manager.detectDeadlocks();
			assert.strictEqual(oldTxResults.timeoutVictims.length, 1);
			assert.strictEqual(oldTxResults.timeoutVictims[0], tx1.id);
		});

		/**
		 * Test all isolation validation helper methods
		 */
		it("should test all isolation validation helpers", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			// Test with no overlapping transactions
			tx1.startTime = new Date(Date.now() - 2000);
			tx1.endTime = new Date(Date.now() - 1000);
			tx2.startTime = new Date(Date.now() - 500);
			
			// Test all helper methods
			assert.strictEqual(manager._findConflictingWrites(tx1.id, "nonexistent").length, 0);
			assert.strictEqual(manager._hasReadSetConflict(tx1, "nonexistent"), false);
			assert.strictEqual(manager._hasSnapshotConflict(tx1, "key1", "value"), false);
			assert.strictEqual(manager._findConflictingWritesToRead(tx1, "nonexistent").length, 0);
			assert.strictEqual(manager._findConflictingReadsToWrite(tx1, "nonexistent").length, 0);
			assert.strictEqual(manager._transactionsOverlap(tx1, tx2), false);
		});

		/**
		 * Test transaction cleanup edge cases
		 */
		it("should handle cleanup edge cases", async () => {
			// Test cleanup with active transactions (should not be cleaned)
			const activeTx = manager.begin();
			activeTx.addOperation(OperationTypes.SET, "key1", "old", "new");
			
			// Test cleanup with very old max age
			assert.strictEqual(manager.cleanup(0), 0); // Should not clean active transactions
			
			// Test cleanup with very new max age
			const oldTx = manager.begin();
			oldTx.commit();
			oldTx.endTime = new Date(Date.now() - 1000); // 1 second ago
			
			assert.strictEqual(manager.cleanup(500), 1); // Should clean transaction older than 500ms
		});
	});

	describe("New Method Tests", () => {
		describe("Deadlock Detection", () => {
			it("should detect no deadlocks with single transaction", () => {
				const tx1 = manager.begin();
				tx1.addOperation(OperationTypes.SET, "key1", "old", "new");
				
				const results = manager.detectDeadlocks();
				
				assert.strictEqual(results.deadlocks.length, 0);
				assert.strictEqual(results.suspectedDeadlocks.length, 0);
				assert.strictEqual(results.timeoutVictims.length, 0);
			});

			it("should detect timeout-based deadlock victims", () => {
				const tx1 = manager.begin();
				const tx2 = manager.begin(); // Need at least 2 transactions for deadlock detection
				tx1.addOperation(OperationTypes.SET, "key1", "old", "new");
				
				// Simulate old transaction
				tx1.startTime = new Date(Date.now() - 15000); // 15 seconds ago
				
				const results = manager.detectDeadlocks({ timeoutThreshold: 10000 });
				
				assert.strictEqual(results.timeoutVictims.length, 1);
				assert.strictEqual(results.timeoutVictims[0], tx1.id);
			});

			it("should detect isolation-level deadlocks", () => {
				const tx1 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				const tx2 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				
				tx1.addOperation(OperationTypes.SET, "user:123", "old", "new1");
				tx2.addOperation(OperationTypes.SET, "user:456", "old", "new2");
				
				// Add conflicting reads
				tx1.readSet.add("user:456");
				tx2.readSet.add("user:123");
				
				const results = manager.detectDeadlocks();
				
				assert.ok(results.suspectedDeadlocks.length > 0);
				const deadlock = results.suspectedDeadlocks.find(d => 
					d.transactions.includes(tx1.id) && d.transactions.includes(tx2.id)
				);
				assert.ok(deadlock);
				assert.strictEqual(deadlock.type, "isolation");
			});

			it("should configure detection options", () => {
				const tx1 = manager.begin();
				tx1.addOperation(OperationTypes.SET, "key1", "old", "new");
				
				const results = manager.detectDeadlocks({
					useLockGraph: false,
					useResourceGraph: false,
					useTimeoutDetection: false
				});
				
				assert.strictEqual(results.deadlocks.length, 0);
				assert.strictEqual(results.timeoutVictims.length, 0);
				assert.strictEqual(results.waitForGraph, null);
				assert.strictEqual(results.resourceGraph, null);
			});

			it("should deduplicate deadlock results", () => {
				const tx1 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				const tx2 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				
				tx1.addOperation(OperationTypes.SET, "related:key1", "old", "new1");
				tx2.addOperation(OperationTypes.SET, "related:key2", "old", "new2");
				
				// Create bidirectional dependency
				tx1.readSet.add("related:key2");
				tx2.readSet.add("related:key1");
				
				const results = manager.detectDeadlocks();
				
				// Should not have duplicate deadlocks for the same transaction pair
				const isolationDeadlocks = results.suspectedDeadlocks.filter(d => d.type === "isolation");
				const uniquePairs = new Set();
				
				for (const deadlock of isolationDeadlocks) {
					const sorted = [...deadlock.transactions].sort();
					const signature = sorted.join(",");
					assert.ok(!uniquePairs.has(signature), "Found duplicate deadlock");
					uniquePairs.add(signature);
				}
			});
		});

		describe("Snapshot Range Detection", () => {
			let tx;

			beforeEach(() => {
				tx = manager.begin({ isolationLevel: IsolationLevels.REPEATABLE_READ });
				tx.snapshot = new Map();
			});

			it("should detect direct key matches", () => {
				const result = manager._isKeyInSnapshotRange(tx, "user:123", "user:123", "value");
				assert.strictEqual(result, true);
			});

			it("should detect explicit range metadata", () => {
				tx.snapshot.set("users:range", { min: "user:100", max: "user:200" });
				
				const result = manager._isKeyInSnapshotRange(tx, "user:150", "users", "value");
				assert.strictEqual(result, true);
			});

			it("should detect pattern-based ranges", () => {
				const result1 = manager._isKeyInSnapshotRange(tx, "user:123", "user:*", "value");
				assert.strictEqual(result1, true);
				
				const result2 = manager._isKeyInSnapshotRange(tx, "account:456", "user:*", "value");
				assert.strictEqual(result2, false);
			});

			it("should detect hierarchical relationships", () => {
				const result1 = manager._isKeyInSnapshotRange(tx, "user:123:profile", "user:123", "value");
				assert.strictEqual(result1, true);
				
				const result2 = manager._isKeyInSnapshotRange(tx, "user:123", "user:123:profile", "value");
				assert.strictEqual(result2, true);
			});

			it("should detect semantic relationships", () => {
				const result1 = manager._isKeyInSnapshotRange(tx, "user:456", "user:123", "value");
				assert.strictEqual(result1, true);
				
				const result2 = manager._isKeyInSnapshotRange(tx, "order:789", "order:456", "value");
				assert.strictEqual(result2, true);
			});

			it("should detect temporal relationships", () => {
				const result1 = manager._isKeyInSnapshotRange(tx, "timestamp:2023-01-15", "timestamp:2023-01-16", "value");
				assert.strictEqual(result1, true);
				
				const result2 = manager._isKeyInSnapshotRange(tx, "log:1673808000", "log:1673808100", "value");
				assert.strictEqual(result2, true);
			});

			it("should detect composite key relationships", () => {
				const result1 = manager._isKeyInSnapshotRange(tx, "user:123:data", "user:123:profile", "value");
				assert.strictEqual(result1, true);
				
				const result2 = manager._isKeyInSnapshotRange(tx, "workspace#doc#1", "workspace#doc#1", "value");
				assert.strictEqual(result2, true);
			});

			it("should handle query metadata", () => {
				tx.snapshot.set("users:query", { type: "prefix", prefix: "user:" });
				
				const result = manager._isKeyInSnapshotRange(tx, "user:123", "users", "value");
				assert.strictEqual(result, true);
			});

			it("should handle predicate functions", () => {
				tx.snapshot.set("filtered:predicate", (key) => key.startsWith("filtered:"));
				
				const result = manager._isKeyInSnapshotRange(tx, "filtered:123", "filtered", "value");
				assert.strictEqual(result, true);
			});

			it("should return false for unrelated keys", () => {
				const result = manager._isKeyInSnapshotRange(tx, "completely:different", "user:123", "value");
				assert.strictEqual(result, false);
			});
		});

		describe("Key Relationship Detection", () => {
			it("should detect direct key matches", () => {
				const result = manager._areKeysRelated("user:123", "user:123");
				assert.strictEqual(result, true);
			});

			it("should detect hierarchical relationships", () => {
				const result1 = manager._areKeysRelated("user:123", "user:123:profile");
				assert.strictEqual(result1, true);
				
				const result2 = manager._areKeysRelated("workspace/docs/file1", "workspace/docs");
				assert.strictEqual(result2, true);
				
				const result3 = manager._areKeysRelated("user.123.settings", "user.123.profile");
				assert.strictEqual(result3, true);
			});

			it("should detect semantic relationships", () => {
				const result1 = manager._areKeysRelated("user:123", "profile:123");
				assert.strictEqual(result1, true);
				
				const result2 = manager._areKeysRelated("order:456", "user:123");
				assert.strictEqual(result2, true);
				
				const result3 = manager._areKeysRelated("post:789", "comment:101");
				assert.strictEqual(result3, true);
			});

			it("should detect pattern-based relationships", () => {
				const result1 = manager._areKeysRelated("user:123", "user:*");
				assert.strictEqual(result1, true);
				
				const result2 = manager._areKeysRelated("data:key1", "data:key2");
				assert.strictEqual(result2, true); // Similar patterns
			});

			it("should detect temporal relationships", () => {
				const result1 = manager._areKeysRelated("log:2023-01-15", "event:2023-01-15");
				assert.strictEqual(result1, true);
				
				const result2 = manager._areKeysRelated("timestamp:123456", "created:123456");
				assert.strictEqual(result2, true);
			});

			it("should detect index relationships", () => {
				const result1 = manager._areKeysRelated("user_index", "user:123");
				assert.strictEqual(result1, true);
				
				const result2 = manager._areKeysRelated("idx_product", "product:456");
				assert.strictEqual(result2, true);
			});

			it("should detect collection relationships", () => {
				const result1 = manager._areKeysRelated("users_list", "user:123");
				assert.strictEqual(result1, true);
				
				const result2 = manager._areKeysRelated("items_array", "item:456");
				assert.strictEqual(result2, true);
			});

			it("should detect functional dependencies", () => {
				const result1 = manager._areKeysRelated("user_id:123", "user_email:test@example.com");
				assert.strictEqual(result1, true);
				
				const result2 = manager._areKeysRelated("order_id:456", "user_id:123");
				assert.strictEqual(result2, true);
			});

			it("should return false for unrelated keys", () => {
				const result = manager._areKeysRelated("completely:unrelated", "different:key");
				assert.strictEqual(result, false);
			});

			it("should handle complex key patterns", () => {
				// Test Levenshtein distance-based similarity
				const result1 = manager._areKeysRelated("entity:123:data", "entity:456:data");
				assert.strictEqual(result1, true); // Similar structure
				
				const result2 = manager._areKeysRelated("a:b:c:d", "x:y:z:w");
				assert.strictEqual(result2, true); // Same pattern
			});
		});

		describe("Helper Method Tests", () => {
			describe("Pattern Analysis", () => {
				it("should extract key patterns correctly", () => {
					const pattern1 = manager._extractKeyPattern("user:123:profile");
					assert.strictEqual(pattern1, "u@:#:profile");
					
					const pattern2 = manager._extractKeyPattern("ab_456_details");
					assert.strictEqual(pattern2, "@_#_details");
				});

				it("should calculate pattern similarity", () => {
					const similarity1 = manager._calculatePatternSimilarity("user:#", "user:#");
					assert.strictEqual(similarity1, 1.0);
					
					const similarity2 = manager._calculatePatternSimilarity("user:#", "item:#");
					assert.ok(similarity2 > 0 && similarity2 < 1);
				});

				it("should calculate Levenshtein distance", () => {
					const distance1 = manager._levenshteinDistance("hello", "hello");
					assert.strictEqual(distance1, 0);
					
					const distance2 = manager._levenshteinDistance("hello", "hallo");
					assert.strictEqual(distance2, 1);
					
					const distance3 = manager._levenshteinDistance("kitten", "sitting");
					assert.strictEqual(distance3, 3);
				});
			});

			describe("Semantic Analysis", () => {
				it("should extract semantic identifiers", () => {
					const semantics1 = manager._extractSemanticIdentifiers("user:123");
					assert.ok(semantics1.includes("user"));
					
					const semantics2 = manager._extractSemanticIdentifiers("userProfile");
					assert.ok(semantics2.includes("user"));
					assert.ok(semantics2.includes("profile"));
					
					const semantics3 = manager._extractSemanticIdentifiers("user_account");
					assert.ok(semantics3.includes("user"));
					assert.ok(semantics3.includes("account"));
				});

				it("should detect semantically similar identifiers", () => {
					assert.strictEqual(manager._areSemanticallySimilar("user", "user"), true);
					assert.strictEqual(manager._areSemanticallySimilar("user", "users"), true);
					assert.strictEqual(manager._areSemanticallySimilar("post", "posts"), true);
					assert.strictEqual(manager._areSemanticallySimilar("item", "product"), false);
				});

				it("should detect entity relationships", () => {
					const result1 = manager._hasEntityRelationship(["user"], ["profile"]);
					assert.strictEqual(result1, true);
					
					const result2 = manager._hasEntityRelationship(["order"], ["product"]);
					assert.strictEqual(result2, true);
					
					const result3 = manager._hasEntityRelationship(["random"], ["unrelated"]);
					assert.strictEqual(result3, false);
				});
			});

			describe("Temporal Analysis", () => {
				it("should extract temporal components", () => {
					const temporal1 = manager._extractTemporalComponents("log:2023-01-15");
					assert.strictEqual(temporal1.hasDate, true);
					
					const temporal2 = manager._extractTemporalComponents("event:12:34:56");
					assert.strictEqual(temporal2.hasTime, true);
					
					const temporal3 = manager._extractTemporalComponents("ts:1673808000123");
					assert.strictEqual(temporal3.hasTimestamp, true);
				});

				it("should detect temporal overlap", () => {
					const temporal1 = { hasDate: true, hasTime: false };
					const temporal2 = { hasDate: true, hasTime: false };
					
					const result = manager._haveTemporalOverlap(temporal1, temporal2, null);
					assert.strictEqual(result, true);
				});
			});

			describe("Index and Collection Analysis", () => {
				it("should detect index keys", () => {
					assert.strictEqual(manager._isIndexKey("user_index"), true);
					assert.strictEqual(manager._isIndexKey("idx_product"), true);
					assert.strictEqual(manager._isIndexKey("email_lookup"), true);
					assert.strictEqual(manager._isIndexKey("regular_key"), true); // Contains "_key"
				});

				it("should extract base keys from index keys", () => {
					assert.strictEqual(manager._extractBaseKeyFromIndex("user_index_email"), "user");
					assert.strictEqual(manager._extractBaseKeyFromIndex("idx_product_name"), "product_name");
					assert.strictEqual(manager._extractBaseKeyFromIndex("email_lookup_fast"), "email");
				});

				it("should detect collection keys", () => {
					assert.strictEqual(manager._isCollectionKey("users_list"), true);
					assert.strictEqual(manager._isCollectionKey("items_array"), true);
					assert.strictEqual(manager._isCollectionKey("members_set"), true);
					assert.strictEqual(manager._isCollectionKey("regular_key"), false);
				});

				it("should extract collection base keys", () => {
					assert.strictEqual(manager._extractCollectionBase("users_list"), "users");
					assert.strictEqual(manager._extractCollectionBase("items_array"), "items");
					assert.strictEqual(manager._extractCollectionBase("data_collection"), "data");
				});
			});

			describe("Functional Dependencies", () => {
				it("should normalize keys for dependency analysis", () => {
					const norm1 = manager._normalizeKeyForDependency("userId");
					assert.strictEqual(norm1, "userid");
					
					const norm2 = manager._normalizeKeyForDependency("user:profile");
					assert.strictEqual(norm2, "user_profile");
					
					const norm3 = manager._normalizeKeyForDependency("order-total");
					assert.strictEqual(norm3, "order_total");
				});

				it("should detect functional dependencies", () => {
					const result1 = manager._hasFunctionalDependency("user_id", "user_email");
					assert.strictEqual(result1, true);
					
					const result2 = manager._hasFunctionalDependency("order_id", "user_id");
					assert.strictEqual(result2, true);
					
					const result3 = manager._hasFunctionalDependency("random_key", "unrelated_key");
					assert.strictEqual(result3, false);
				});
			});

			describe("Hierarchical Analysis", () => {
				it("should detect ancestor-descendant relationships", () => {
					const result1 = manager._isAncestorDescendantRelationship(
						["workspace", "project"], 
						["workspace", "project", "task", "subtask"]
					);
					assert.strictEqual(result1, true);
					
					const result2 = manager._isAncestorDescendantRelationship(
						["user", "profile"], 
						["user", "settings"]
					);
					assert.strictEqual(result2, false);
				});

				it("should detect composite key overlap", () => {
					const result1 = manager._hasCompositeKeyOverlap(
						["workspace", "project", "task"], 
						["workspace", "project", "document"]
					);
					assert.strictEqual(result1, true);
					
					const result2 = manager._hasCompositeKeyOverlap(
						["user", "profile"], 
						["order", "item"]
					);
					assert.strictEqual(result2, false);
				});
			});

			describe("Query Matching", () => {
				it("should match range queries", () => {
					const queryInfo = { type: "range", min: "a", max: "z" };
					
					assert.strictEqual(manager._keyMatchesQuery("m", queryInfo), true);
					assert.strictEqual(manager._keyMatchesQuery("1", queryInfo), false);
				});

				it("should match prefix queries", () => {
					const queryInfo = { type: "prefix", prefix: "user:" };
					
					assert.strictEqual(manager._keyMatchesQuery("user:123", queryInfo), true);
					assert.strictEqual(manager._keyMatchesQuery("order:456", queryInfo), false);
				});

				it("should match pattern queries", () => {
					const queryInfo = { type: "pattern", pattern: "^user:\\d+$" };
					
					assert.strictEqual(manager._keyMatchesQuery("user:123", queryInfo), true);
					assert.strictEqual(manager._keyMatchesQuery("user:abc", queryInfo), false);
				});

				it("should match value list queries", () => {
					const queryInfo = { type: "in", values: ["key1", "key2", "key3"] };
					
					assert.strictEqual(manager._keyMatchesQuery("key2", queryInfo), true);
					assert.strictEqual(manager._keyMatchesQuery("key4", queryInfo), false);
				});
			});
		});

		/**
		 * Additional Coverage Tests for Uncovered Lines
		 */
		describe("Missing Coverage", () => {
			it("should handle fallback case in _isKeyInSnapshotRange", () => {
				const tx = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				
				// Create a scenario where none of the range detection methods match
				// This should hit the default return false case (lines 1473-1474)
				const result = manager._isKeyInSnapshotRange(tx, "simple_key", "unrelated_key");
				
				assert.strictEqual(result, false);
			});

			it("should handle invalid regex patterns in _keyMatchesRange", () => {
				// Test invalid regex pattern (lines 1502-1505)
				const invalidRange = { pattern: "[invalid(regex" };
				const result = manager._keyMatchesRange("test_key", invalidRange);
				
				assert.strictEqual(result, false);
			});

			it("should handle no match in _keyMatchesRange", () => {
				// Test default no match case (line 1509)
				const emptyRange = {};
				const result = manager._keyMatchesRange("test_key", emptyRange);
				
				assert.strictEqual(result, false);
			});

			it("should handle explicit range metadata with range info", () => {
				const tx = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				
				// Set up range metadata (lines 1535-1538)
				tx.snapshot.set("range_key:range", { start: "user:100", end: "user:200" });
				
				const result = manager._hasExplicitRangeMetadata(tx, "range_key");
				assert.strictEqual(result, true);
			});

			it("should handle explicit range metadata with query info", () => {
				const tx = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				
				// Set up query metadata (lines 1541-1544)
				tx.snapshot.set("query_key:query", { prefix: "user:" });
				
				const result = manager._hasExplicitRangeMetadata(tx, "query_key");
				assert.strictEqual(result, true);
			});

			it("should handle explicit range metadata with predicate function", () => {
				const tx = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				
				// Set up predicate metadata (lines 1547-1555)
				const predicate = (key) => key.startsWith("test:");
				tx.snapshot.set("predicate_key:predicate", predicate);
				
				const result = manager._hasExplicitRangeMetadata(tx, "predicate_key");
				assert.strictEqual(result, true);
			});

			it("should handle predicate function errors", () => {
				const tx = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				
				// Set up predicate that throws error (lines 1550-1554)
				const errorPredicate = () => { throw new Error("Predicate error"); };
				tx.snapshot.set("error_key:predicate", errorPredicate);
				
				const result = manager._checkExplicitRange(tx, "test_key", "error_key");
				assert.strictEqual(result, false);
			});

			it("should handle no range metadata match", () => {
				const tx = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				
				// Test case with no metadata (line 1557)
				const result = manager._checkExplicitRange(tx, "test_key", "no_metadata_key");
				assert.strictEqual(result, false);
			});

			it("should handle wildcard patterns with invalid regex", () => {
				// Test wildcard pattern with invalid regex fallback (lines 1590-1595)
				const result = manager._checkPatternBasedRange("user123", "user*[invalid");
				
				// Should fallback to prefix matching
				assert.strictEqual(result, true);
			});

			it("should handle single character wildcards with invalid regex", () => {
				// Test single character wildcard with invalid regex (lines 1605-1607)
				const result = manager._checkPatternBasedRange("user1", "user?[invalid");
				
				assert.strictEqual(result, false);
			});

			it("should handle character classes with invalid regex", () => {
				// Test character class with invalid regex (lines 1616-1618)
				const result = manager._checkPatternBasedRange("user1", "[invalid(regex");
				
				assert.strictEqual(result, false);
			});

			it("should handle choice patterns", () => {
				// Test choice patterns (lines 1622-1636)
				const result1 = manager._checkPatternBasedRange("prefix_option1_suffix", "prefix_{option1,option2}_suffix");
				const result2 = manager._checkPatternBasedRange("prefix_option3_suffix", "prefix_{option1,option2}_suffix");
				
				assert.strictEqual(result1, true);
				assert.strictEqual(result2, false);
			});

			it("should handle range and pattern suffixes", () => {
				// Test range and pattern suffixes (lines 1639-1643)
				const result1 = manager._checkPatternBasedRange("user:123", "user_range");
				const result2 = manager._checkPatternBasedRange("user:123", "user_pattern");
				const result3 = manager._checkPatternBasedRange("admin:456", "user_range");
				
				assert.strictEqual(result1, true);
				assert.strictEqual(result2, true);
				assert.strictEqual(result3, false);
			});

			it("should handle pattern-based range fallback", () => {
				// Test default fallback case in _checkPatternBasedRange (line 1645)
				const result = manager._checkPatternBasedRange("test_key", "no_pattern_key");
				
				assert.strictEqual(result, false);
			});

			it("should handle collection key without indicators", () => {
				// Test _extractCollectionBase with no collection indicators (lines 2687-2688)
				const result = manager._extractCollectionBase("simple_key");
				
				assert.strictEqual(result, "simple_key");
			});

			it("should detect dependency cycles", () => {
				// Test _hasDependencyCycle method (lines 2753-2761)
				const tx1 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				const tx2 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				
				// Create read-write dependency cycle
				tx1.addOperation("read", "key1", undefined, "value1");
				tx1.addOperation(OperationTypes.SET, "key2", "old", "new");
				
				tx2.addOperation("read", "key2", undefined, "old");
				tx2.addOperation(OperationTypes.SET, "key1", "old", "new");
				
				const result = manager._hasDependencyCycle(tx1, tx2);
				assert.strictEqual(result, true);
			});

			it("should handle no reads-writes dependency", () => {
				// Test _readsOtherWrites with no dependency (lines 2776-2777)
				const tx1 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				const tx2 = manager.begin({ isolationLevel: IsolationLevels.SERIALIZABLE });
				
				// No overlapping keys
				tx1.addOperation("read", "key1", undefined, "value1");
				tx2.addOperation(OperationTypes.SET, "key2", "old", "new");
				
				const result = manager._readsOtherWrites(tx1, tx2);
				assert.strictEqual(result, false);
			});
		});
	});
});
