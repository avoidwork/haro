import assert from "node:assert";
import { TransactionManager } from "../../src/transaction-manager.js";
import { Transaction } from "../../src/transaction-individual.js";
import { TransactionError } from "../../src/errors.js";
import { LockTypes, TransactionStates, IsolationLevels } from "../../src/constants.js";
import { LockManager } from "../../src/lock-manager.js";
import { TransactionStatistics } from "../../src/transaction-statistics.js";
import { DeadlockDetector } from "../../src/deadlock-detector.js";
import { IsolationValidator } from "../../src/isolation-validator.js";

/**
 * Mock Transaction for testing isolation validation
 */
class MockTransaction {
	constructor(id, writeSet = new Set(), readSet = new Set()) {
		this.id = id;
		this.writeSet = writeSet;
		this.readSet = readSet;
		this.state = TransactionStates.ACTIVE;
		this.startTime = new Date();
		this.endTime = null;
		this.abortReason = null;
	}

	isActive() {
		return this.state === TransactionStates.ACTIVE;
	}

	getDuration() {
		if (!this.startTime) return null;
		const endTime = this.endTime || new Date();
		return endTime.getTime() - this.startTime.getTime();
	}

	commit() {
		this.state = TransactionStates.COMMITTED;
		this.endTime = new Date();
		return this;
	}

	abort(reason = "Test abort") {
		this.state = TransactionStates.ABORTED;
		this.endTime = new Date();
		this.abortReason = reason;
		return this;
	}

	getStats() {
		return {
			id: this.id,
			state: this.state,
			startTime: this.startTime,
			endTime: this.endTime,
			duration: this.getDuration(),
			operationCount: 0,
			readSetSize: this.readSet.size,
			writeSetSize: this.writeSet.size,
			snapshotSize: 0,
			abortReason: this.abortReason,
			timedOut: false
		};
	}
}

/**
 * Tests for TransactionManager class
 */
describe("TransactionManager", () => {
	describe("Constructor", () => {
		it("should initialize with correct default state", () => {
			const manager = new TransactionManager();

			assert.ok(manager.transactions instanceof Map);
			assert.strictEqual(manager.transactions.size, 0);
			assert.ok(manager.lockManager instanceof LockManager);
			assert.strictEqual(manager.transactionCounter, 0);
			assert.ok(manager.statistics instanceof TransactionStatistics);
			assert.ok(manager.deadlockDetector instanceof DeadlockDetector);
			assert.ok(manager.isolationValidator instanceof IsolationValidator);
		});

		it("should create specialized components with correct relationships", () => {
			const manager = new TransactionManager();
			const components = manager.getComponents();

			assert.strictEqual(components.statistics, manager.statistics);
			assert.strictEqual(components.deadlockDetector, manager.deadlockDetector);
			assert.strictEqual(components.isolationValidator, manager.isolationValidator);
			assert.strictEqual(components.lockManager, manager.lockManager);
		});
	});

	describe("begin()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should create a new transaction with default options", () => {
			const transaction = manager.begin();

			assert.ok(transaction instanceof Transaction);
			assert.ok(transaction.id);
			assert.strictEqual(transaction.state, TransactionStates.ACTIVE);
			assert.strictEqual(manager.transactions.size, 1);
			assert.strictEqual(manager.transactionCounter, 1);
			assert.ok(manager.transactions.has(transaction.id));
		});

		it("should create a transaction with custom options", () => {
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

		it("should increment statistics correctly", () => {
			const statsBefore = manager.getStats();
			
			manager.begin();
			
			const statsAfter = manager.getStats();
			assert.strictEqual(statsAfter.totalTransactions, statsBefore.totalTransactions + 1);
			assert.strictEqual(statsAfter.activeTransactions, statsBefore.activeTransactions + 1);
		});

		it("should handle multiple transactions", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const tx3 = manager.begin();

			assert.strictEqual(manager.transactions.size, 3);
			assert.strictEqual(manager.transactionCounter, 3);
			assert.notStrictEqual(tx1.id, tx2.id);
			assert.notStrictEqual(tx2.id, tx3.id);
		});
	});

	describe("getTransaction()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should return transaction by ID", () => {
			const transaction = manager.begin();
			const retrieved = manager.getTransaction(transaction.id);

			assert.strictEqual(retrieved, transaction);
		});

		it("should return undefined for non-existent transaction", () => {
			const retrieved = manager.getTransaction("non-existent-id");

			assert.strictEqual(retrieved, undefined);
		});

		it("should return correct transaction among multiple", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const tx3 = manager.begin();

			assert.strictEqual(manager.getTransaction(tx1.id), tx1);
			assert.strictEqual(manager.getTransaction(tx2.id), tx2);
			assert.strictEqual(manager.getTransaction(tx3.id), tx3);
		});
	});

	describe("commit()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should commit transaction successfully", async () => {
			const transaction = manager.begin();
			const result = await manager.commit(transaction.id);

			assert.strictEqual(result, transaction);
			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
		});

		it("should throw error for non-existent transaction", async () => {
			await assert.rejects(
				manager.commit("non-existent-id"),
				TransactionError
			);
		});

		it("should acquire locks for write set", async () => {
			const transaction = manager.begin();
			// Simulate write operations
			transaction.writeSet.add("key1");
			transaction.writeSet.add("key2");

			await manager.commit(transaction.id);

			// Verify transaction was committed (locks are released after commit)
			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
		});

		it("should update statistics on successful commit", async () => {
			const statsBefore = manager.getStats();
			const transaction = manager.begin();

			await manager.commit(transaction.id);

			const statsAfter = manager.getStats();
			assert.strictEqual(statsAfter.committedTransactions, statsBefore.committedTransactions + 1);
			assert.strictEqual(statsAfter.activeTransactions, statsBefore.activeTransactions);
		});

		it("should abort transaction on commit failure", async () => {
			const transaction = manager.begin();
			transaction.writeSet.add("key1");

			// Mock isolation validator to throw error
			manager.isolationValidator.validateIsolation = () => {
				throw new TransactionError("Validation failed", transaction.id, "commit");
			};

			await assert.rejects(
				manager.commit(transaction.id),
				TransactionError
			);

			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
		});

		it("should pass commit context to transaction", async () => {
			const transaction = manager.begin();
			const context = { source: "test" };

			// Mock transaction commit method by intercepting the call
			let capturedContext;
			const originalCommit = Transaction.prototype.commit;
			Transaction.prototype.commit = function(ctx) {
				capturedContext = ctx;
				return originalCommit.call(this, ctx);
			};

			try {
				await manager.commit(transaction.id, context);
				assert.strictEqual(capturedContext, context);
			} finally {
				// Restore original method
				Transaction.prototype.commit = originalCommit;
			}
		});

		it("should handle lock acquisition failure", async () => {
			const transaction = manager.begin();
			transaction.writeSet.add("key1");

			// Mock lock manager to throw error
			const originalAcquireLock = manager.lockManager.acquireLock;
			manager.lockManager.acquireLock = async () => {
				throw new Error("Lock acquisition failed");
			};

			try {
				await assert.rejects(
					manager.commit(transaction.id),
					Error
				);

				assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			} finally {
				// Restore original method
				manager.lockManager.acquireLock = originalAcquireLock;
			}
		});

		it("should release locks even when isolation validation fails", async () => {
			const transaction = manager.begin();
			transaction.writeSet.add("key1");

			// Mock isolation validator to throw error after locks are acquired
			const originalValidateIsolation = manager.isolationValidator.validateIsolation;
			let locksReleased = false;
			const originalReleaseAllLocks = manager.lockManager.releaseAllLocks;
			
			manager.isolationValidator.validateIsolation = () => {
				throw new TransactionError("Isolation validation failed", transaction.id, "commit");
			};
			
			manager.lockManager.releaseAllLocks = (txId) => {
				locksReleased = true;
				assert.strictEqual(txId, transaction.id);
				return originalReleaseAllLocks.call(manager.lockManager, txId);
			};

			try {
				await assert.rejects(
					manager.commit(transaction.id),
					TransactionError
				);

				// Verify that locks were released even though validation failed
				assert.strictEqual(locksReleased, true);
				assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			} finally {
				// Restore original methods
				manager.isolationValidator.validateIsolation = originalValidateIsolation;
				manager.lockManager.releaseAllLocks = originalReleaseAllLocks;
			}
		});

		it("should call releaseAllLocks in finally block even when abort throws", async () => {
			const transaction = manager.begin();
			transaction.writeSet.add("key1");

			// Mock lock manager to fail during commit
			const originalAcquireLock = manager.lockManager.acquireLock;
			let releaseCalledInFinally = false;
			const originalReleaseAllLocks = manager.lockManager.releaseAllLocks;
			
			// Mock abort to throw an error
			const originalAbort = manager.abort;
			manager.abort = () => {
				throw new Error("Abort failed");
			};
			
			manager.lockManager.acquireLock = async () => {
				throw new Error("Lock acquisition failed");
			};
			
			manager.lockManager.releaseAllLocks = (txId) => {
				releaseCalledInFinally = true;
				return originalReleaseAllLocks.call(manager.lockManager, txId);
			};

			try {
				await assert.rejects(
					manager.commit(transaction.id),
					Error
				);

				// Verify that locks were released in finally block even when abort throws
				assert.strictEqual(releaseCalledInFinally, true);
			} finally {
				// Restore original methods
				manager.lockManager.acquireLock = originalAcquireLock;
				manager.lockManager.releaseAllLocks = originalReleaseAllLocks;
				manager.abort = originalAbort;
			}
		});

		it("should call releaseAllLocks in finally block on successful commit", async () => {
			const transaction = manager.begin();
			transaction.writeSet.add("key1");

			// Mock release to verify it's called
			let releaseCalledInFinally = false;
			const originalReleaseAllLocks = manager.lockManager.releaseAllLocks;
			
			manager.lockManager.releaseAllLocks = (txId) => {
				releaseCalledInFinally = true;
				assert.strictEqual(txId, transaction.id);
				return originalReleaseAllLocks.call(manager.lockManager, txId);
			};

			try {
				await manager.commit(transaction.id);

				// Verify that locks were released in finally block on success
				assert.strictEqual(releaseCalledInFinally, true);
				assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
			} finally {
				// Restore original method
				manager.lockManager.releaseAllLocks = originalReleaseAllLocks;
			}
		});

		it("should execute finally block with async abort that throws", async () => {
			const transaction = manager.begin();
			transaction.writeSet.add("key1");
			
			// Mock abort to throw, but finally should still execute
			const originalAbort = manager.abort;
			manager.abort = () => {
				throw new Error("Abort also failed");
			};

			// Mock isolation validator to throw first
			const originalValidateIsolation = manager.isolationValidator.validateIsolation;
			manager.isolationValidator.validateIsolation = () => {
				throw new Error("Isolation validation failed");
			};

			let finallyExecuted = false;
			const originalReleaseAllLocks = manager.lockManager.releaseAllLocks;
			manager.lockManager.releaseAllLocks = (txId) => {
				finallyExecuted = true;
				return originalReleaseAllLocks.call(manager.lockManager, txId);
			};

			try {
				await assert.rejects(
					manager.commit(transaction.id),
					Error
				);

				// Verify finally block executed even when abort throws
				assert.strictEqual(finallyExecuted, true);
			} finally {
				// Restore original methods
				manager.abort = originalAbort;
				manager.isolationValidator.validateIsolation = originalValidateIsolation;
				manager.lockManager.releaseAllLocks = originalReleaseAllLocks;
			}
		});

		it("should handle transaction commit method throwing error", async () => {
			// Mock the Transaction prototype commit method before creating transaction
			const originalCommit = Transaction.prototype.commit;
			let transactionCommitCalled = false;
			
			Transaction.prototype.commit = function() {
				transactionCommitCalled = true;
				throw new Error("Transaction commit failed");
			};

			const transaction = manager.begin();
			transaction.writeSet.add("key1");

			let finallyExecuted = false;
			const originalReleaseAllLocks = manager.lockManager.releaseAllLocks;
			manager.lockManager.releaseAllLocks = (txId) => {
				finallyExecuted = true;
				return originalReleaseAllLocks.call(manager.lockManager, txId);
			};

			try {
				await assert.rejects(
					manager.commit(transaction.id),
					Error
				);

				// Verify commit was called and finally block executed
				assert.strictEqual(transactionCommitCalled, true);
				assert.strictEqual(finallyExecuted, true);
				assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			} finally {
				// Restore original methods
				Transaction.prototype.commit = originalCommit;
				manager.lockManager.releaseAllLocks = originalReleaseAllLocks;
			}
		});

		it("should commit transaction with empty writeSet bypassing lock acquisition", async () => {
			const transaction = manager.begin();
			// Don't add anything to writeSet - this bypasses the lock acquisition loop entirely
			
			let lockAcquisitionCalled = false;
			let finallyExecuted = false;
			
			const originalAcquireLock = manager.lockManager.acquireLock;
			const originalReleaseAllLocks = manager.lockManager.releaseAllLocks;
			
			manager.lockManager.acquireLock = async () => {
				lockAcquisitionCalled = true;
				return originalAcquireLock.apply(manager.lockManager, arguments);
			};
			
			manager.lockManager.releaseAllLocks = (txId) => {
				finallyExecuted = true;
				return originalReleaseAllLocks.call(manager.lockManager, txId);
			};

			try {
				const result = await manager.commit(transaction.id);

				// Verify no locks were acquired but finally block still executed
				assert.strictEqual(lockAcquisitionCalled, false);
				assert.strictEqual(finallyExecuted, true);
				assert.strictEqual(result, transaction);
				assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
			} finally {
				// Restore original methods
				manager.lockManager.acquireLock = originalAcquireLock;
				manager.lockManager.releaseAllLocks = originalReleaseAllLocks;
			}
		});

		it("should handle releaseAllLocks throwing error in finally block after successful commit", async () => {
			const transaction = manager.begin();
			transaction.writeSet.add("key1");

			const originalReleaseAllLocks = manager.lockManager.releaseAllLocks;
			let commitCompleted = false;
			let releaseAllLocksCalled = false;

			// Override commit to track when it completes successfully
			const originalCommit = Transaction.prototype.commit;
			Transaction.prototype.commit = function(context) {
				const result = originalCommit.call(this, context);
				commitCompleted = true;
				return result;
			};

			// Make releaseAllLocks throw AFTER commit succeeds
			manager.lockManager.releaseAllLocks = (txId) => {
				releaseAllLocksCalled = true;
				// Verify commit completed before finally block
				assert.strictEqual(commitCompleted, true);
				throw new Error("Failed to release locks in finally");
			};

			try {
				// The commit should succeed in try block, but finally should throw
				await assert.rejects(
					manager.commit(transaction.id),
					/Failed to release locks in finally/
				);

				// Verify the sequence: commit succeeded, then finally threw
				assert.strictEqual(commitCompleted, true);
				assert.strictEqual(releaseAllLocksCalled, true);
				assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
			} finally {
				// Restore original methods
				Transaction.prototype.commit = originalCommit;
				manager.lockManager.releaseAllLocks = originalReleaseAllLocks;
			}
		});

		it("should handle early return path without cleanup in finally block", async () => {
			// Create transaction and then manually delete it to simulate race condition
			const transaction = manager.begin();
			const txId = transaction.id;
			
			// Manually remove transaction to create an edge case
			manager.transactions.delete(txId);

			// This should throw "Transaction not found" before reaching finally block
			await assert.rejects(
				manager.commit(txId),
				/Transaction .* not found/
			);
		});

		it("should handle synchronous error in lockManager acquireLock", async () => {
			const transaction = manager.begin();
			transaction.writeSet.add("key1");

			const originalAcquireLock = manager.lockManager.acquireLock;
			
			// Make acquireLock throw synchronously (not async)
			manager.lockManager.acquireLock = () => {
				throw new Error("Synchronous lock error");
			};

			try {
				await assert.rejects(
					manager.commit(transaction.id),
					/Synchronous lock error/
				);
				
				// Transaction should be aborted
				assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			} finally {
				manager.lockManager.acquireLock = originalAcquireLock;
			}
		});

	});

	describe("abort()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should abort transaction successfully", () => {
			const transaction = manager.begin();
			const result = manager.abort(transaction.id);

			assert.strictEqual(result, transaction);
			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
		});

		it("should abort with custom reason", () => {
			const transaction = manager.begin();
			const reason = "Custom abort reason";
			
			manager.abort(transaction.id, reason);

			assert.strictEqual(transaction.abortReason, reason);
		});

		it("should abort with default reason", () => {
			const transaction = manager.begin();
			
			manager.abort(transaction.id);

			assert.strictEqual(transaction.abortReason, "Manual abort");
		});

		it("should throw error for non-existent transaction", () => {
			assert.throws(
				() => manager.abort("non-existent-id"),
				TransactionError
			);
		});

		it("should update statistics on abort", () => {
			const statsBefore = manager.getStats();
			const transaction = manager.begin();

			manager.abort(transaction.id);

			const statsAfter = manager.getStats();
			assert.strictEqual(statsAfter.abortedTransactions, statsBefore.abortedTransactions + 1);
			assert.strictEqual(statsAfter.activeTransactions, statsBefore.activeTransactions);
		});

		it("should release all locks on abort", () => {
			const transaction = manager.begin();
			transaction.writeSet.add("key1");
			transaction.writeSet.add("key2");

			// Mock lock manager to track release calls
			let releaseCalled = false;
			const originalRelease = manager.lockManager.releaseAllLocks;
			manager.lockManager.releaseAllLocks = (txId) => {
				releaseCalled = true;
				assert.strictEqual(txId, transaction.id);
				return originalRelease.call(manager.lockManager, txId);
			};

			manager.abort(transaction.id);

			assert.strictEqual(releaseCalled, true);
		});
	});

	describe("cleanup()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should return 0 when no transactions to clean", () => {
			const cleaned = manager.cleanup();

			assert.strictEqual(cleaned, 0);
		});

		it("should not clean active transactions", () => {
			manager.begin();
			manager.begin();
			
			const cleaned = manager.cleanup();

			assert.strictEqual(cleaned, 0);
			assert.strictEqual(manager.transactions.size, 2);
		});

		it("should clean old completed transactions", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();

			// Commit transactions and set old end times
			tx1.commit();
			tx2.commit();
			
			const oldTime = new Date(Date.now() - 7200000); // 2 hours ago
			tx1.endTime = oldTime;
			tx2.endTime = oldTime;

			const cleaned = manager.cleanup(3600000); // 1 hour max age

			assert.strictEqual(cleaned, 2);
			assert.strictEqual(manager.transactions.size, 0);
		});

		it("should not clean recent completed transactions", () => {
			const tx1 = manager.begin();
			tx1.commit();

			const cleaned = manager.cleanup(3600000); // 1 hour max age

			assert.strictEqual(cleaned, 0);
			assert.strictEqual(manager.transactions.size, 1);
		});

		it("should use custom max age", () => {
			const tx1 = manager.begin();
			tx1.commit();
			
			const oldTime = new Date(Date.now() - 500); // 500ms ago
			tx1.endTime = oldTime;

			const cleaned = manager.cleanup(100); // 100ms max age

			assert.strictEqual(cleaned, 1);
			assert.strictEqual(manager.transactions.size, 0);
		});

		it("should handle mix of active and completed transactions", () => {
			const tx1 = manager.begin(); // active
			const tx2 = manager.begin(); 
			const tx3 = manager.begin();

			tx2.commit();
			tx3.abort();

			// Set old end times for completed transactions
			const oldTime = new Date(Date.now() - 7200000);
			tx2.endTime = oldTime;
			tx3.endTime = oldTime;

			const cleaned = manager.cleanup(3600000);

			assert.strictEqual(cleaned, 2);
			assert.strictEqual(manager.transactions.size, 1);
			assert.ok(manager.transactions.has(tx1.id));
		});
	});

	describe("getActiveTransactions()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should return empty array when no transactions", () => {
			const active = manager.getActiveTransactions();

			assert.ok(Array.isArray(active));
			assert.strictEqual(active.length, 0);
		});

		it("should return only active transactions", () => {
			const tx1 = manager.begin(); // active
			const tx2 = manager.begin(); // will be committed
			const tx3 = manager.begin(); // will be aborted

			tx2.commit();
			tx3.abort();

			const active = manager.getActiveTransactions();

			assert.strictEqual(active.length, 1);
			assert.strictEqual(active[0], tx1);
		});

		it("should return all active transactions", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const tx3 = manager.begin();

			const active = manager.getActiveTransactions();

			assert.strictEqual(active.length, 3);
			assert.ok(active.includes(tx1));
			assert.ok(active.includes(tx2));
			assert.ok(active.includes(tx3));
		});
	});

	describe("detectDeadlocks() / checkForDeadlocks()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should detect no deadlocks with no transactions", () => {
			const result = manager.detectDeadlocks();

			assert.ok(result);
			assert.ok(Array.isArray(result.deadlocks));
			assert.strictEqual(result.deadlocks.length, 0);
		});

		it("should detect no deadlocks with single transaction", () => {
			manager.begin();
			
			const result = manager.detectDeadlocks();

			assert.strictEqual(result.deadlocks.length, 0);
		});

		it("should pass options to deadlock detector", () => {
			const options = { timeout: 5000 };
			let capturedOptions;

			const originalDetect = manager.deadlockDetector.detectDeadlocks;
			manager.deadlockDetector.detectDeadlocks = (transactions, opts) => {
				capturedOptions = opts;
				return originalDetect.call(manager.deadlockDetector, transactions, opts);
			};

			manager.detectDeadlocks(options);

			assert.strictEqual(capturedOptions, options);
		});

		it("should delegate to detectDeadlocks for checkForDeadlocks", () => {
			const options = { timeout: 1000 };
			
			// Mock detectDeadlocks to verify delegation
			let detectCalled = false;
			let passedOptions;
			manager.detectDeadlocks = (opts) => {
				detectCalled = true;
				passedOptions = opts;
				return { deadlocks: [], suspectedDeadlocks: [], timeoutVictims: [] };
			};

			const result = manager.checkForDeadlocks(options);

			assert.strictEqual(detectCalled, true);
			assert.strictEqual(passedOptions, options);
			assert.ok(result);
		});

		it("should work with active transactions", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			const result = manager.detectDeadlocks();

			assert.ok(result);
			assert.ok(Array.isArray(result.deadlocks));
		});
	});

	describe("getStats()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should return comprehensive statistics", () => {
			const stats = manager.getStats();

			assert.ok(stats);
			assert.strictEqual(typeof stats.totalTransactions, "number");
			assert.strictEqual(typeof stats.activeTransactions, "number");
			assert.strictEqual(typeof stats.committedTransactions, "number");
			assert.strictEqual(typeof stats.abortedTransactions, "number");
			assert.ok(stats.lockStats);
		});

		it("should include correct active transaction count", () => {
			manager.begin();
			manager.begin();
			const tx3 = manager.begin();
			tx3.commit();

			const stats = manager.getStats();

			assert.strictEqual(stats.activeTransactions, 2);
		});

		it("should include transaction counter", () => {
			manager.begin();
			manager.begin();
			manager.begin();

			const stats = manager.getStats();

			// The getStats method passes transactionCounter to statistics.getStats
			// We can verify this by checking that stats reflect the transactions created
			assert.strictEqual(stats.totalTransactions, 3);
		});

		it("should include lock manager statistics", () => {
			const stats = manager.getStats();

			assert.ok(stats.lockStats);
			assert.strictEqual(typeof stats.lockStats.totalLocks, "number");
		});
	});

	describe("resetStats()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should reset statistics", () => {
			// Create some transactions to generate stats
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			tx1.commit();
			tx2.abort();

			// Verify stats exist
			const statsBefore = manager.getStats();
			assert.ok(statsBefore.totalTransactions > 0);

			// Reset stats
			manager.resetStats();

			// Verify stats are reset (but counter and active transactions remain)
			const statsAfter = manager.getStats();
			assert.strictEqual(statsAfter.committedTransactions, 0);
			assert.strictEqual(statsAfter.abortedTransactions, 0);
		});

		it("should delegate to statistics.reset()", () => {
			let resetCalled = false;
			manager.statistics.reset = () => {
				resetCalled = true;
			};

			manager.resetStats();

			assert.strictEqual(resetCalled, true);
		});
	});

	describe("getComponents()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should return all specialized components", () => {
			const components = manager.getComponents();

			assert.ok(components);
			assert.strictEqual(components.statistics, manager.statistics);
			assert.strictEqual(components.deadlockDetector, manager.deadlockDetector);
			assert.strictEqual(components.isolationValidator, manager.isolationValidator);
			assert.strictEqual(components.lockManager, manager.lockManager);
		});

		it("should return consistent components on multiple calls", () => {
			const components1 = manager.getComponents();
			const components2 = manager.getComponents();

			assert.strictEqual(components1.statistics, components2.statistics);
			assert.strictEqual(components1.deadlockDetector, components2.deadlockDetector);
			assert.strictEqual(components1.isolationValidator, components2.isolationValidator);
			assert.strictEqual(components1.lockManager, components2.lockManager);
		});
	});

	describe("validateTransactionIsolation()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should validate isolation for existing transaction", () => {
			const transaction = manager.begin();

			// Should not throw
			manager.validateTransactionIsolation(transaction.id);
		});

		it("should throw error for non-existent transaction", () => {
			assert.throws(
				() => manager.validateTransactionIsolation("non-existent-id"),
				TransactionError
			);
		});

		it("should delegate to isolation validator", () => {
			const transaction = manager.begin();
			
			let validateCalled = false;
			let passedTransaction, passedTransactions;
			
			manager.isolationValidator.validateIsolation = (txn, txns) => {
				validateCalled = true;
				passedTransaction = txn;
				passedTransactions = txns;
			};

			manager.validateTransactionIsolation(transaction.id);

			assert.strictEqual(validateCalled, true);
			assert.strictEqual(passedTransaction, transaction);
			assert.strictEqual(passedTransactions, manager.transactions);
		});

		it("should propagate validation errors", () => {
			const transaction = manager.begin();
			
			manager.isolationValidator.validateIsolation = () => {
				throw new TransactionError("Isolation violation", transaction.id, "validate");
			};

			assert.throws(
				() => manager.validateTransactionIsolation(transaction.id),
				TransactionError
			);
		});
	});

	describe("getTransactionDetails()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should return null for non-existent transaction", () => {
			const details = manager.getTransactionDetails("non-existent-id");

			assert.strictEqual(details, null);
		});

		it("should return detailed information for existing transaction", () => {
			const transaction = manager.begin();
			const details = manager.getTransactionDetails(transaction.id);

			assert.ok(details);
			assert.strictEqual(details.id, transaction.id);
			assert.strictEqual(details.state, TransactionStates.ACTIVE);
			assert.ok(Array.isArray(details.lockInfo));
		});

		it("should include lock information", () => {
			const transaction = manager.begin();
			
			// Mock lock manager to return specific lock info
			manager.lockManager.getStats = () => ({
				totalLocks: 1,
				uniqueHolders: 1,
				recordsLocked: [
					{
						record: "key1",
						type: LockTypes.EXCLUSIVE,
						holders: [transaction.id]
					}
				]
			});

			const details = manager.getTransactionDetails(transaction.id);

			assert.ok(details.lockInfo);
			assert.strictEqual(details.lockInfo.length, 1);
			assert.strictEqual(details.lockInfo[0].record, "key1");
		});

		it("should filter lock info for specific transaction", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			// Mock lock manager with multiple locks
			manager.lockManager.getStats = () => ({
				totalLocks: 2,
				uniqueHolders: 2,
				recordsLocked: [
					{
						record: "key1",
						type: LockTypes.EXCLUSIVE,
						holders: [tx1.id]
					},
					{
						record: "key2",
						type: LockTypes.SHARED,
						holders: [tx2.id]
					}
				]
			});

			const details = manager.getTransactionDetails(tx1.id);

			assert.strictEqual(details.lockInfo.length, 1);
			assert.strictEqual(details.lockInfo[0].record, "key1");
		});
	});

	describe("getSystemHealth()", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should return comprehensive system health metrics", () => {
			const health = manager.getSystemHealth();

			assert.ok(health);
			assert.strictEqual(typeof health.activeTransactions, "number");
			assert.strictEqual(typeof health.totalTransactions, "number");
			assert.strictEqual(typeof health.commitRate, "number");
			assert.strictEqual(typeof health.averageDuration, "number");
			assert.strictEqual(typeof health.hasDeadlocks, "boolean");
			assert.strictEqual(typeof health.suspectedDeadlocks, "number");
			assert.strictEqual(typeof health.timeoutVictims, "number");
			assert.strictEqual(typeof health.totalLocks, "number");
			assert.strictEqual(typeof health.lockUtilization, "number");
		});

		it("should calculate correct commit rate with transactions", async () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const tx3 = manager.begin();
			
			// Need to use manager.commit/abort to update statistics
			await manager.commit(tx1.id);
			await manager.commit(tx2.id);
			manager.abort(tx3.id);

			const health = manager.getSystemHealth();

			// 2 committed out of 3 total = 2/3 ≈ 0.67
			assert.strictEqual(health.commitRate, 2/3);
		});

		it("should handle zero total transactions", () => {
			const health = manager.getSystemHealth();

			assert.strictEqual(health.commitRate, 0);
			assert.strictEqual(health.totalTransactions, 0);
		});

		it("should detect deadlocks in health check", () => {
			// Mock deadlock detection to return deadlocks
			manager.detectDeadlocks = () => ({
				deadlocks: [{ transactions: ["tx1", "tx2"] }],
				suspectedDeadlocks: [],
				timeoutVictims: []
			});

			const health = manager.getSystemHealth();

			assert.strictEqual(health.hasDeadlocks, true);
		});

		it("should calculate lock utilization", () => {
			// Mock lock manager stats
			manager.lockManager.getStats = () => ({
				totalLocks: 10,
				uniqueHolders: 5,
				recordsLocked: []
			});

			const health = manager.getSystemHealth();

			assert.strictEqual(health.lockUtilization, 0.5); // 5/10
		});

		it("should handle zero locks for lock utilization", () => {
			// Mock lock manager with no locks
			manager.lockManager.getStats = () => ({
				totalLocks: 0,
				uniqueHolders: 0,
				recordsLocked: []
			});

			const health = manager.getSystemHealth();

			assert.strictEqual(health.lockUtilization, 0);
		});
	});

	describe("Integration Tests", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should handle complete transaction lifecycle", async () => {
			// Begin transaction
			const transaction = manager.begin();
			assert.strictEqual(transaction.state, TransactionStates.ACTIVE);

			// Add some operations
			transaction.addOperation("set", "key1", null, "value1");
			transaction.addOperation("read", "key2");

			// Commit transaction
			await manager.commit(transaction.id);
			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);

			// Verify statistics
			const stats = manager.getStats();
			assert.strictEqual(stats.committedTransactions, 1);
			assert.strictEqual(stats.activeTransactions, 0);
		});

		it("should handle transaction abort scenario", () => {
			// Begin transaction
			const transaction = manager.begin();
			
			// Add operations
			transaction.addOperation("set", "key1", null, "value1");

			// Abort transaction
			manager.abort(transaction.id, "Test abort");
			assert.strictEqual(transaction.state, TransactionStates.ABORTED);
			assert.strictEqual(transaction.abortReason, "Test abort");

			// Verify statistics
			const stats = manager.getStats();
			assert.strictEqual(stats.abortedTransactions, 1);
			assert.strictEqual(stats.activeTransactions, 0);
		});

		it("should handle multiple concurrent transactions", async () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const tx3 = manager.begin();

			// Different outcomes for each
			await manager.commit(tx1.id);
			manager.abort(tx2.id);
			// tx3 remains active

			assert.strictEqual(tx1.state, TransactionStates.COMMITTED);
			assert.strictEqual(tx2.state, TransactionStates.ABORTED);
			assert.strictEqual(tx3.state, TransactionStates.ACTIVE);

			const activeTransactions = manager.getActiveTransactions();
			assert.strictEqual(activeTransactions.length, 1);
			assert.strictEqual(activeTransactions[0], tx3);
		});

		it("should maintain consistency across cleanup operations", () => {
			// Create and finish some transactions
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			const tx3 = manager.begin();

			tx1.commit();
			tx2.abort();
			// tx3 remains active

			// Set old end times
			const oldTime = new Date(Date.now() - 7200000);
			tx1.endTime = oldTime;
			tx2.endTime = oldTime;

			// Cleanup old transactions
			const cleaned = manager.cleanup(3600000);
			assert.strictEqual(cleaned, 2);

			// Verify state consistency
			assert.strictEqual(manager.transactions.size, 1);
			assert.ok(manager.transactions.has(tx3.id));

			const activeTransactions = manager.getActiveTransactions();
			assert.strictEqual(activeTransactions.length, 1);
			assert.strictEqual(activeTransactions[0], tx3);
		});

		it("should handle error propagation in commit process", async () => {
			const transaction = manager.begin();
			transaction.writeSet.add("key1");

			// Mock lock manager to always fail
			const originalAcquireLock = manager.lockManager.acquireLock;
			manager.lockManager.acquireLock = async () => {
				throw new Error("Lock acquisition failed");
			};

			try {
				await assert.rejects(
					manager.commit(transaction.id),
					Error
				);

				// Transaction should be aborted
				assert.strictEqual(transaction.state, TransactionStates.ABORTED);
				
				// Statistics should reflect the abort
				const stats = manager.getStats();
				assert.strictEqual(stats.abortedTransactions, 1);
			} finally {
				// Restore original method
				manager.lockManager.acquireLock = originalAcquireLock;
			}
		});
	});

	describe("Edge Cases", () => {
		let manager;

		beforeEach(() => {
			manager = new TransactionManager();
		});

		it("should handle begin() with empty options object", () => {
			const transaction = manager.begin({});
			
			assert.ok(transaction instanceof Transaction);
			assert.strictEqual(transaction.state, TransactionStates.ACTIVE);
		});

		it("should handle begin() with null options", () => {
			// TransactionManager.begin() passes options directly to Transaction constructor
			// If null is passed, Transaction constructor will fail
			// This test should verify that the manager handles this appropriately
			assert.throws(() => {
				manager.begin(null);
			}, TypeError);
		});

		it("should handle commit() with empty context", async () => {
			const transaction = manager.begin();
			
			await manager.commit(transaction.id, {});
			
			assert.strictEqual(transaction.state, TransactionStates.COMMITTED);
		});

		it("should handle cleanup() with zero maxAge", async () => {
			const tx1 = manager.begin();
			await manager.commit(tx1.id);
			
			// Add a small delay to ensure endTime is definitely in the past
			await new Promise(resolve => setTimeout(resolve, 1));
			
			// With maxAge 0, all completed transactions should be cleaned
			const cleaned = manager.cleanup(0);
			
			assert.strictEqual(cleaned, 1);
			assert.strictEqual(manager.transactions.size, 0);
		});

		it("should handle getTransactionDetails() with transaction having no locks", () => {
			const transaction = manager.begin();
			
			// Mock lock manager to return no locks for this transaction
			manager.lockManager.getStats = () => ({
				totalLocks: 0,
				uniqueHolders: 0,
				recordsLocked: []
			});

			const details = manager.getTransactionDetails(transaction.id);
			
			assert.ok(details);
			assert.strictEqual(details.lockInfo.length, 0);
		});

		it("should handle concurrent deadlock detection", () => {
			const tx1 = manager.begin();
			const tx2 = manager.begin();
			
			// Multiple deadlock detection calls should not interfere
			const result1 = manager.detectDeadlocks();
			const result2 = manager.checkForDeadlocks();
			
			assert.ok(result1);
			assert.ok(result2);
			assert.ok(Array.isArray(result1.deadlocks));
			assert.ok(Array.isArray(result2.deadlocks));
		});

		it("should handle transaction validation with empty transaction map", () => {
			const transaction = manager.begin();
			
			// Remove transaction from map but keep reference
			manager.transactions.clear();
			
			assert.throws(
				() => manager.validateTransactionIsolation(transaction.id),
				TransactionError
			);
		});
	});
});
