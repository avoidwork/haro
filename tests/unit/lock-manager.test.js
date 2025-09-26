import assert from "assert";
import { LockManager } from "../../src/lock-manager.js";
import { ConcurrencyError } from "../../src/errors.js";
import { LockTypes } from "../../src/constants.js";

describe("LockManager", () => {
	let lockManager;

	beforeEach(() => {
		lockManager = new LockManager();
	});

	describe("constructor", () => {
		it("should initialize with empty locks map", () => {
			assert.strictEqual(lockManager.locks.size, 0);
		});

		it("should set default lock timeout to 30000ms", () => {
			assert.strictEqual(lockManager.lockTimeout, 30000);
		});
	});

	describe("acquireLock", () => {
		it("should acquire shared lock on empty record", async () => {
			const result = await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			assert.strictEqual(result, true);
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.type, LockTypes.SHARED);
			assert.strictEqual(lock.holders.size, 1);
			assert.strictEqual(lock.holders.has("tx1"), true);
		});

		it("should acquire exclusive lock on empty record", async () => {
			const result = await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);
			assert.strictEqual(result, true);
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.type, LockTypes.EXCLUSIVE);
			assert.strictEqual(lock.holders.size, 1);
			assert.strictEqual(lock.holders.has("tx1"), true);
		});

		it("should allow multiple shared locks on same record", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			const result = await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);
			
			assert.strictEqual(result, true);
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.type, LockTypes.SHARED);
			assert.strictEqual(lock.holders.size, 2);
			assert.strictEqual(lock.holders.has("tx1"), true);
			assert.strictEqual(lock.holders.has("tx2"), true);
		});

		it("should return true when transaction already holds compatible lock", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			const result = await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			
			assert.strictEqual(result, true);
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.holders.size, 1);
		});

		it("should upgrade shared lock to exclusive when transaction is only holder", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			const result = await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);
			
			assert.strictEqual(result, true);
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.type, LockTypes.EXCLUSIVE);
			assert.strictEqual(lock.holders.size, 1);
			assert.strictEqual(lock.holders.has("tx1"), true);
		});

		it("should timeout when exclusive lock blocks shared lock", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);
			
			const startTime = Date.now();
			try {
				await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED, 100);
				assert.fail("Should have thrown ConcurrencyError");
			} catch (error) {
				const duration = Date.now() - startTime;
				assert(error instanceof ConcurrencyError);
				assert(duration >= 100);
				assert(error.message.includes("Failed to acquire shared lock"));
				assert.strictEqual(error.context.resource, "record1");
				assert.strictEqual(error.context.operation, "lock");
			}
		});

		it("should timeout when shared lock blocks exclusive lock", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			
			try {
				await lockManager.acquireLock("tx2", "record1", LockTypes.EXCLUSIVE, 100);
				assert.fail("Should have thrown ConcurrencyError");
			} catch (error) {
				assert(error instanceof ConcurrencyError);
				assert(error.message.includes("Failed to acquire exclusive lock"));
			}
		});

		it("should timeout when upgrade blocked by other shared holders", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);
			
			try {
				await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE, 100);
				assert.fail("Should have thrown ConcurrencyError");
			} catch (error) {
				assert(error instanceof ConcurrencyError);
				assert(error.message.includes("Failed to acquire exclusive lock"));
			}
		});

		it("should use custom timeout parameter", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);
			
			const startTime = Date.now();
			try {
				await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED, 50);
				assert.fail("Should have thrown ConcurrencyError");
			} catch (error) {
				const duration = Date.now() - startTime;
				assert(duration >= 50 && duration < 100);
			}
		});
	});

	describe("releaseLock", () => {
		it("should release shared lock successfully", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			
			const result = lockManager.releaseLock("tx1", "record1");
			assert.strictEqual(result, true);
			assert.strictEqual(lockManager.locks.has("record1"), false);
		});

		it("should release exclusive lock successfully", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);
			
			const result = lockManager.releaseLock("tx1", "record1");
			assert.strictEqual(result, true);
			assert.strictEqual(lockManager.locks.has("record1"), false);
		});

		it("should preserve lock when multiple holders exist", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);
			
			const result = lockManager.releaseLock("tx1", "record1");
			assert.strictEqual(result, true);
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.holders.size, 1);
			assert.strictEqual(lock.holders.has("tx2"), true);
		});

		it("should return false when lock does not exist", () => {
			const result = lockManager.releaseLock("tx1", "nonexistent");
			assert.strictEqual(result, false);
		});

		it("should return false when transaction does not hold lock", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			
			const result = lockManager.releaseLock("tx2", "record1");
			assert.strictEqual(result, false);
			
			// Lock should still exist
			assert.strictEqual(lockManager.locks.has("record1"), true);
		});
	});

	describe("releaseAllLocks", () => {
		it("should release all locks held by transaction", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx1", "record2", LockTypes.EXCLUSIVE);
			await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);
			
			const result = lockManager.releaseAllLocks("tx1");
			assert.strictEqual(result, 2);
			
			// record1 should still exist (tx2 holds it)
			assert.strictEqual(lockManager.locks.has("record1"), true);
			const lock1 = lockManager.locks.get("record1");
			assert.strictEqual(lock1.holders.size, 1);
			assert.strictEqual(lock1.holders.has("tx2"), true);
			
			// record2 should be removed (only tx1 held it)
			assert.strictEqual(lockManager.locks.has("record2"), false);
		});

		it("should return 0 when transaction holds no locks", () => {
			const result = lockManager.releaseAllLocks("tx1");
			assert.strictEqual(result, 0);
		});

		it("should handle empty lock manager", () => {
			const result = lockManager.releaseAllLocks("tx1");
			assert.strictEqual(result, 0);
		});
	});

	describe("holdsLocks", () => {
		it("should return true when transaction holds locks", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			
			const result = lockManager.holdsLocks("tx1");
			assert.strictEqual(result, true);
		});

		it("should return false when transaction holds no locks", () => {
			const result = lockManager.holdsLocks("tx1");
			assert.strictEqual(result, false);
		});

		it("should return false after releasing all locks", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			lockManager.releaseAllLocks("tx1");
			
			const result = lockManager.holdsLocks("tx1");
			assert.strictEqual(result, false);
		});

		it("should distinguish between different transactions", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			
			assert.strictEqual(lockManager.holdsLocks("tx1"), true);
			assert.strictEqual(lockManager.holdsLocks("tx2"), false);
		});
	});

	describe("getStats", () => {
		it("should return empty stats for new lock manager", () => {
			const stats = lockManager.getStats();
			
			assert.strictEqual(stats.totalLocks, 0);
			assert.strictEqual(stats.sharedLocks, 0);
			assert.strictEqual(stats.exclusiveLocks, 0);
			assert.strictEqual(stats.uniqueHolders, 0);
			assert.strictEqual(stats.lockHolders.size, 0);
			assert.strictEqual(stats.recordsLocked.length, 0);
		});

		it("should count shared locks correctly", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx2", "record2", LockTypes.SHARED);
			
			const stats = lockManager.getStats();
			
			assert.strictEqual(stats.totalLocks, 2);
			assert.strictEqual(stats.sharedLocks, 2);
			assert.strictEqual(stats.exclusiveLocks, 0);
			assert.strictEqual(stats.uniqueHolders, 2);
		});

		it("should count exclusive locks correctly", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);
			await lockManager.acquireLock("tx2", "record2", LockTypes.EXCLUSIVE);
			
			const stats = lockManager.getStats();
			
			assert.strictEqual(stats.totalLocks, 2);
			assert.strictEqual(stats.sharedLocks, 0);
			assert.strictEqual(stats.exclusiveLocks, 2);
			assert.strictEqual(stats.uniqueHolders, 2);
		});

		it("should count mixed lock types correctly", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx3", "record2", LockTypes.EXCLUSIVE);
			
			const stats = lockManager.getStats();
			
			assert.strictEqual(stats.totalLocks, 2);
			assert.strictEqual(stats.sharedLocks, 1);
			assert.strictEqual(stats.exclusiveLocks, 1);
			assert.strictEqual(stats.uniqueHolders, 3);
			assert.strictEqual(stats.lockHolders.size, 3);
		});

		it("should include detailed record information", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx3", "record2", LockTypes.EXCLUSIVE);
			
			const stats = lockManager.getStats();
			
			assert.strictEqual(stats.recordsLocked.length, 2);
			
			const record1Lock = stats.recordsLocked.find(r => r.recordKey === "record1");
			assert.strictEqual(record1Lock.type, LockTypes.SHARED);
			assert.strictEqual(record1Lock.holders.length, 2);
			assert(record1Lock.holders.includes("tx1"));
			assert(record1Lock.holders.includes("tx2"));
			
			const record2Lock = stats.recordsLocked.find(r => r.recordKey === "record2");
			assert.strictEqual(record2Lock.type, LockTypes.EXCLUSIVE);
			assert.strictEqual(record2Lock.holders.length, 1);
			assert(record2Lock.holders.includes("tx3"));
		});

		it("should count unique holders correctly with multiple locks per transaction", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx1", "record2", LockTypes.EXCLUSIVE);
			await lockManager.acquireLock("tx2", "record3", LockTypes.SHARED);
			
			const stats = lockManager.getStats();
			
			assert.strictEqual(stats.totalLocks, 3);
			assert.strictEqual(stats.uniqueHolders, 2);
			assert.strictEqual(stats.lockHolders.size, 2);
			assert(stats.lockHolders.has("tx1"));
			assert(stats.lockHolders.has("tx2"));
		});
	});

	describe("edge cases and error conditions", () => {
		it("should handle rapid lock acquisition attempts", async () => {
			const promises = [];
			for (let i = 0; i < 5; i++) {
				promises.push(lockManager.acquireLock(`tx${i}`, "record1", LockTypes.SHARED));
			}
			
			const results = await Promise.all(promises);
			results.forEach(result => assert.strictEqual(result, true));
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.holders.size, 5);
		});

		it("should handle acquiring same lock type multiple times", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.holders.size, 1);
			assert.strictEqual(lock.holders.has("tx1"), true);
		});

		it("should handle very short timeout values", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.EXCLUSIVE);
			
			const startTime = Date.now();
			try {
				await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED, 1);
				assert.fail("Should have thrown ConcurrencyError");
			} catch (error) {
				const duration = Date.now() - startTime;
				assert(error instanceof ConcurrencyError);
				// Should timeout quickly
				assert(duration < 50);
			}
		});

		it("should handle releasing non-existent record gracefully", () => {
			const result = lockManager.releaseLock("tx1", "nonexistent");
			assert.strictEqual(result, false);
		});

		it("should preserve lock structure integrity during concurrent operations", async () => {
			await lockManager.acquireLock("tx1", "record1", LockTypes.SHARED);
			await lockManager.acquireLock("tx2", "record1", LockTypes.SHARED);
			
			// Release one holder
			lockManager.releaseLock("tx1", "record1");
			
			// Verify structure is still valid
			const lock = lockManager.locks.get("record1");
			assert.strictEqual(lock.type, LockTypes.SHARED);
			assert.strictEqual(lock.holders.size, 1);
			assert.strictEqual(lock.holders.has("tx2"), true);
			assert.strictEqual(lock.holders.has("tx1"), false);
		});
	});
});
