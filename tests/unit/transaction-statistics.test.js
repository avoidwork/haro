import assert from "node:assert";
import { describe, it } from "mocha";
import { TransactionStatistics } from "../../src/transaction-statistics.js";

/**
 * Mock Transaction class for testing purposes
 */
class MockTransaction {
	/**
	 * Create a mock transaction
	 * @param {number|null} duration - Duration to return, or null
	 */
	constructor(duration) {
		this.duration = duration;
	}

	/**
	 * Get transaction duration
	 * @returns {number|null} Duration or null
	 */
	getDuration() {
		return this.duration;
	}
}

/**
 * Tests for TransactionStatistics class
 */
describe("TransactionStatistics", () => {
	describe("Constructor", () => {
		/**
		 * Test that constructor initializes stats object correctly
		 */
		it("should initialize with default stats", () => {
			const stats = new TransactionStatistics();

			assert.deepStrictEqual(stats.stats, {
				totalTransactions: 0,
				committedTransactions: 0,
				abortedTransactions: 0,
				activeTransactions: 0,
				averageDuration: 0,
				totalDuration: 0
			});
		});

		/**
		 * Test that stats object is properly structured
		 */
		it("should have all required stats properties", () => {
			const stats = new TransactionStatistics();

			assert.ok(stats.stats.hasOwnProperty("totalTransactions"));
			assert.ok(stats.stats.hasOwnProperty("committedTransactions"));
			assert.ok(stats.stats.hasOwnProperty("abortedTransactions"));
			assert.ok(stats.stats.hasOwnProperty("activeTransactions"));
			assert.ok(stats.stats.hasOwnProperty("averageDuration"));
			assert.ok(stats.stats.hasOwnProperty("totalDuration"));
		});
	});

	describe("incrementTotal()", () => {
		/**
		 * Test incrementing total transaction count
		 */
		it("should increment total transactions", () => {
			const stats = new TransactionStatistics();

			assert.strictEqual(stats.stats.totalTransactions, 0);
			
			stats.incrementTotal();
			assert.strictEqual(stats.stats.totalTransactions, 1);
			
			stats.incrementTotal();
			assert.strictEqual(stats.stats.totalTransactions, 2);
		});

		/**
		 * Test multiple increments
		 */
		it("should handle multiple increments correctly", () => {
			const stats = new TransactionStatistics();

			for (let i = 1; i <= 10; i++) {
				stats.incrementTotal();
				assert.strictEqual(stats.stats.totalTransactions, i);
			}
		});
	});

	describe("incrementCommitted()", () => {
		/**
		 * Test incrementing committed transaction count
		 */
		it("should increment committed transactions", () => {
			const stats = new TransactionStatistics();

			assert.strictEqual(stats.stats.committedTransactions, 0);
			
			stats.incrementCommitted();
			assert.strictEqual(stats.stats.committedTransactions, 1);
			
			stats.incrementCommitted();
			assert.strictEqual(stats.stats.committedTransactions, 2);
		});

		/**
		 * Test that other stats remain unchanged
		 */
		it("should not affect other stats", () => {
			const stats = new TransactionStatistics();

			stats.incrementCommitted();

			assert.strictEqual(stats.stats.totalTransactions, 0);
			assert.strictEqual(stats.stats.abortedTransactions, 0);
			assert.strictEqual(stats.stats.activeTransactions, 0);
		});
	});

	describe("incrementAborted()", () => {
		/**
		 * Test incrementing aborted transaction count
		 */
		it("should increment aborted transactions", () => {
			const stats = new TransactionStatistics();

			assert.strictEqual(stats.stats.abortedTransactions, 0);
			
			stats.incrementAborted();
			assert.strictEqual(stats.stats.abortedTransactions, 1);
			
			stats.incrementAborted();
			assert.strictEqual(stats.stats.abortedTransactions, 2);
		});

		/**
		 * Test that other stats remain unchanged
		 */
		it("should not affect other stats", () => {
			const stats = new TransactionStatistics();

			stats.incrementAborted();

			assert.strictEqual(stats.stats.totalTransactions, 0);
			assert.strictEqual(stats.stats.committedTransactions, 0);
			assert.strictEqual(stats.stats.activeTransactions, 0);
		});
	});

	describe("incrementActive()", () => {
		/**
		 * Test incrementing active transaction count
		 */
		it("should increment active transactions", () => {
			const stats = new TransactionStatistics();

			assert.strictEqual(stats.stats.activeTransactions, 0);
			
			stats.incrementActive();
			assert.strictEqual(stats.stats.activeTransactions, 1);
			
			stats.incrementActive();
			assert.strictEqual(stats.stats.activeTransactions, 2);
		});

		/**
		 * Test that other stats remain unchanged
		 */
		it("should not affect other stats", () => {
			const stats = new TransactionStatistics();

			stats.incrementActive();

			assert.strictEqual(stats.stats.totalTransactions, 0);
			assert.strictEqual(stats.stats.committedTransactions, 0);
			assert.strictEqual(stats.stats.abortedTransactions, 0);
		});
	});

	describe("decrementActive()", () => {
		/**
		 * Test decrementing active transaction count
		 */
		it("should decrement active transactions", () => {
			const stats = new TransactionStatistics();

			// First increment to have something to decrement
			stats.incrementActive();
			stats.incrementActive();
			assert.strictEqual(stats.stats.activeTransactions, 2);
			
			stats.decrementActive();
			assert.strictEqual(stats.stats.activeTransactions, 1);
			
			stats.decrementActive();
			assert.strictEqual(stats.stats.activeTransactions, 0);
		});

		/**
		 * Test decrementing below zero
		 */
		it("should allow negative active transactions", () => {
			const stats = new TransactionStatistics();

			stats.decrementActive();
			assert.strictEqual(stats.stats.activeTransactions, -1);
			
			stats.decrementActive();
			assert.strictEqual(stats.stats.activeTransactions, -2);
		});

		/**
		 * Test that other stats remain unchanged
		 */
		it("should not affect other stats", () => {
			const stats = new TransactionStatistics();

			stats.decrementActive();

			assert.strictEqual(stats.stats.totalTransactions, 0);
			assert.strictEqual(stats.stats.committedTransactions, 0);
			assert.strictEqual(stats.stats.abortedTransactions, 0);
		});
	});

	describe("updateDurationStats()", () => {
		/**
		 * Test updating duration stats with valid transaction
		 */
		it("should update duration stats for valid transaction", () => {
			const stats = new TransactionStatistics();
			const transaction = new MockTransaction(1000);

			// First, increment committed to have completed transactions
			stats.incrementCommitted();
			stats.updateDurationStats(transaction);

			assert.strictEqual(stats.stats.totalDuration, 1000);
			assert.strictEqual(stats.stats.averageDuration, 1000);
		});

		/**
		 * Test updating duration stats with multiple transactions
		 */
		it("should calculate correct average duration with multiple transactions", () => {
			const stats = new TransactionStatistics();

			// Add some committed and aborted transactions
			stats.incrementCommitted();
			stats.incrementCommitted();
			stats.incrementAborted();

			const transaction1 = new MockTransaction(1000);
			const transaction2 = new MockTransaction(2000);
			const transaction3 = new MockTransaction(3000);

			stats.updateDurationStats(transaction1);
			assert.strictEqual(stats.stats.totalDuration, 1000);
			assert.strictEqual(stats.stats.averageDuration, 1000 / 3); // 3 completed transactions

			stats.updateDurationStats(transaction2);
			assert.strictEqual(stats.stats.totalDuration, 3000);
			assert.strictEqual(stats.stats.averageDuration, 3000 / 3);

			stats.updateDurationStats(transaction3);
			assert.strictEqual(stats.stats.totalDuration, 6000);
			assert.strictEqual(stats.stats.averageDuration, 6000 / 3);
		});

		/**
		 * Test that null duration transactions are ignored
		 */
		it("should ignore transactions with null duration", () => {
			const stats = new TransactionStatistics();
			const transaction = new MockTransaction(null);

			stats.incrementCommitted();
			stats.updateDurationStats(transaction);

			assert.strictEqual(stats.stats.totalDuration, 0);
			assert.strictEqual(stats.stats.averageDuration, 0);
		});

		/**
		 * Test mixed null and valid durations
		 */
		it("should handle mixed null and valid durations correctly", () => {
			const stats = new TransactionStatistics();

			stats.incrementCommitted();
			stats.incrementCommitted();

			const validTransaction = new MockTransaction(2000);
			const nullTransaction = new MockTransaction(null);

			stats.updateDurationStats(validTransaction);
			assert.strictEqual(stats.stats.totalDuration, 2000);
			assert.strictEqual(stats.stats.averageDuration, 2000 / 2); // 2 completed transactions

			stats.updateDurationStats(nullTransaction);
			assert.strictEqual(stats.stats.totalDuration, 2000); // Should remain the same
			assert.strictEqual(stats.stats.averageDuration, 2000 / 2); // Should remain the same
		});

		/**
		 * Test division by zero scenario (no completed transactions)
		 */
		it("should handle division by zero when no completed transactions", () => {
			const stats = new TransactionStatistics();
			const transaction = new MockTransaction(1000);

			// No completed transactions yet
			stats.updateDurationStats(transaction);

			assert.strictEqual(stats.stats.totalDuration, 1000);
			assert.strictEqual(stats.stats.averageDuration, Infinity); // Should be Infinity due to division by zero
		});
	});

	describe("getStats()", () => {
		/**
		 * Test getting comprehensive stats
		 */
		it("should return comprehensive stats with all parameters", () => {
			const stats = new TransactionStatistics();
			const lockStats = { 
				totalLocks: 5, 
				activeLocks: 2,
				lockTimeouts: 1
			};
			const activeCount = 3;
			const transactionCounter = 100;

			// Modify some internal stats
			stats.incrementTotal();
			stats.incrementCommitted();
			stats.incrementAborted();

			const result = stats.getStats(lockStats, activeCount, transactionCounter);

			assert.strictEqual(result.totalTransactions, 1);
			assert.strictEqual(result.committedTransactions, 1);
			assert.strictEqual(result.abortedTransactions, 1);
			assert.strictEqual(result.activeTransactions, activeCount); // Should use parameter, not internal
			assert.strictEqual(result.averageDuration, 0);
			assert.strictEqual(result.totalDuration, 0);
			assert.deepStrictEqual(result.lockStats, lockStats);
			assert.strictEqual(result.transactionCounter, transactionCounter);
		});

		/**
		 * Test that activeTransactions comes from parameter, not internal stats
		 */
		it("should use activeCount parameter instead of internal activeTransactions", () => {
			const stats = new TransactionStatistics();

			// Set internal active transactions to different value
			stats.incrementActive();
			stats.incrementActive();
			assert.strictEqual(stats.stats.activeTransactions, 2);

			const result = stats.getStats({}, 5, 0);

			assert.strictEqual(result.activeTransactions, 5); // Should use parameter
		});

		/**
		 * Test with empty/null parameters
		 */
		it("should handle empty or null parameters", () => {
			const stats = new TransactionStatistics();

			const result1 = stats.getStats(null, 0, 0);
			assert.strictEqual(result1.lockStats, null);
			assert.strictEqual(result1.activeTransactions, 0);
			assert.strictEqual(result1.transactionCounter, 0);

			const result2 = stats.getStats(undefined, undefined, undefined);
			assert.strictEqual(result2.lockStats, undefined);
			assert.strictEqual(result2.activeTransactions, undefined);
			assert.strictEqual(result2.transactionCounter, undefined);
		});

		/**
		 * Test that returned object is a new object (not referencing internal stats)
		 */
		it("should return a new object that doesn't reference internal stats", () => {
			const stats = new TransactionStatistics();
			const result = stats.getStats({}, 0, 0);

			// Modify returned object
			result.totalTransactions = 999;

			// Internal stats should remain unchanged
			assert.strictEqual(stats.stats.totalTransactions, 0);
		});
	});

	describe("reset()", () => {
		/**
		 * Test resetting all stats to zero
		 */
		it("should reset all stats to zero", () => {
			const stats = new TransactionStatistics();

			// Set some values
			stats.incrementTotal();
			stats.incrementCommitted();
			stats.incrementAborted();
			stats.incrementActive();
			
			// Simulate duration update
			stats.stats.totalDuration = 5000;
			stats.stats.averageDuration = 2500;

			// Verify stats are not zero
			assert.notStrictEqual(stats.stats.totalTransactions, 0);
			assert.notStrictEqual(stats.stats.committedTransactions, 0);
			assert.notStrictEqual(stats.stats.abortedTransactions, 0);
			assert.notStrictEqual(stats.stats.activeTransactions, 0);
			assert.notStrictEqual(stats.stats.totalDuration, 0);
			assert.notStrictEqual(stats.stats.averageDuration, 0);

			// Reset
			stats.reset();

			// Verify all stats are back to zero
			assert.deepStrictEqual(stats.stats, {
				totalTransactions: 0,
				committedTransactions: 0,
				abortedTransactions: 0,
				activeTransactions: 0,
				averageDuration: 0,
				totalDuration: 0
			});
		});

		/**
		 * Test that reset creates a new stats object
		 */
		it("should create a new stats object on reset", () => {
			const stats = new TransactionStatistics();
			const originalStats = stats.stats;

			stats.reset();

			assert.notStrictEqual(stats.stats, originalStats);
		});

		/**
		 * Test multiple resets
		 */
		it("should handle multiple resets correctly", () => {
			const stats = new TransactionStatistics();

			stats.incrementTotal();
			stats.reset();
			assert.strictEqual(stats.stats.totalTransactions, 0);

			stats.incrementCommitted();
			stats.reset();
			assert.strictEqual(stats.stats.committedTransactions, 0);

			stats.incrementAborted();
			stats.reset();
			assert.strictEqual(stats.stats.abortedTransactions, 0);
		});
	});

	describe("getRawStats()", () => {
		/**
		 * Test getting copy of raw stats
		 */
		it("should return a copy of the raw stats", () => {
			const stats = new TransactionStatistics();

			// Modify some stats
			stats.incrementTotal();
			stats.incrementCommitted();
			stats.incrementActive();

			const rawStats = stats.getRawStats();

			assert.deepStrictEqual(rawStats, {
				totalTransactions: 1,
				committedTransactions: 1,
				abortedTransactions: 0,
				activeTransactions: 1,
				averageDuration: 0,
				totalDuration: 0
			});
		});

		/**
		 * Test that returned object is a copy, not a reference
		 */
		it("should return a copy, not a reference to internal stats", () => {
			const stats = new TransactionStatistics();
			const rawStats = stats.getRawStats();

			// Modify the returned copy
			rawStats.totalTransactions = 999;

			// Internal stats should remain unchanged
			assert.strictEqual(stats.stats.totalTransactions, 0);
		});

		/**
		 * Test that modifications to internal stats don't affect previously returned copies
		 */
		it("should not affect previously returned copies when internal stats change", () => {
			const stats = new TransactionStatistics();
			const firstCopy = stats.getRawStats();

			// Modify internal stats
			stats.incrementTotal();
			stats.incrementCommitted();

			// First copy should remain unchanged
			assert.deepStrictEqual(firstCopy, {
				totalTransactions: 0,
				committedTransactions: 0,
				abortedTransactions: 0,
				activeTransactions: 0,
				averageDuration: 0,
				totalDuration: 0
			});

			// New copy should reflect changes
			const secondCopy = stats.getRawStats();
			assert.strictEqual(secondCopy.totalTransactions, 1);
			assert.strictEqual(secondCopy.committedTransactions, 1);
		});
	});

	describe("Edge Cases and Integration", () => {
		/**
		 * Test complex scenario with all operations
		 */
		it("should handle complex scenario with all operations correctly", () => {
			const stats = new TransactionStatistics();

			// Simulate a complex transaction lifecycle
			stats.incrementTotal();
			stats.incrementTotal();
			stats.incrementTotal();
			stats.incrementActive();
			stats.incrementActive();

			// Complete some transactions
			stats.incrementCommitted();
			stats.decrementActive();
			const transaction1 = new MockTransaction(1500);
			stats.updateDurationStats(transaction1);

			stats.incrementAborted();
			stats.decrementActive();
			const transaction2 = new MockTransaction(800);
			stats.updateDurationStats(transaction2);

			// Get comprehensive stats
			const lockStats = { totalLocks: 10 };
			const result = stats.getStats(lockStats, 0, 150);

			assert.strictEqual(result.totalTransactions, 3);
			assert.strictEqual(result.committedTransactions, 1);
			assert.strictEqual(result.abortedTransactions, 1);
			assert.strictEqual(result.activeTransactions, 0);
			assert.strictEqual(result.totalDuration, 2300);
			assert.strictEqual(result.averageDuration, 2300 / 2); // 2 completed transactions
			assert.deepStrictEqual(result.lockStats, lockStats);
			assert.strictEqual(result.transactionCounter, 150);

			// Test reset
			stats.reset();
			assert.deepStrictEqual(stats.getRawStats(), {
				totalTransactions: 0,
				committedTransactions: 0,
				abortedTransactions: 0,
				activeTransactions: 0,
				averageDuration: 0,
				totalDuration: 0
			});
		});

		/**
		 * Test with very large numbers
		 */
		it("should handle large numbers correctly", () => {
			const stats = new TransactionStatistics();

			// Add many transactions
			for (let i = 0; i < 1000000; i++) {
				stats.incrementTotal();
			}

			for (let i = 0; i < 500000; i++) {
				stats.incrementCommitted();
			}

			for (let i = 0; i < 400000; i++) {
				stats.incrementAborted();
			}

			// Test large duration values
			const transaction = new MockTransaction(Number.MAX_SAFE_INTEGER / 2);
			stats.updateDurationStats(transaction);

			assert.strictEqual(stats.stats.totalTransactions, 1000000);
			assert.strictEqual(stats.stats.committedTransactions, 500000);
			assert.strictEqual(stats.stats.abortedTransactions, 400000);
			assert.strictEqual(stats.stats.totalDuration, Number.MAX_SAFE_INTEGER / 2);
		});

		/**
		 * Test precision with floating point durations
		 */
		it("should handle floating point durations correctly", () => {
			const stats = new TransactionStatistics();

			stats.incrementCommitted();
			stats.incrementCommitted();

			const transaction1 = new MockTransaction(100.5);
			const transaction2 = new MockTransaction(200.7);

			stats.updateDurationStats(transaction1);
			stats.updateDurationStats(transaction2);

			assert.strictEqual(stats.stats.totalDuration, 301.2);
			assert.strictEqual(stats.stats.averageDuration, 301.2 / 2);
		});

		/**
		 * Test concurrent-like scenario simulation
		 */
		it("should maintain consistency in concurrent-like scenario", () => {
			const stats = new TransactionStatistics();

			// Simulate rapid operations that might happen in concurrent scenarios
			for (let i = 0; i < 100; i++) {
				stats.incrementTotal();
				stats.incrementActive();
			}

			for (let i = 0; i < 60; i++) {
				stats.incrementCommitted();
				stats.decrementActive();
			}

			for (let i = 0; i < 40; i++) {
				stats.incrementAborted();
				stats.decrementActive();
			}

			assert.strictEqual(stats.stats.totalTransactions, 100);
			assert.strictEqual(stats.stats.committedTransactions, 60);
			assert.strictEqual(stats.stats.abortedTransactions, 40);
			assert.strictEqual(stats.stats.activeTransactions, 0);
		});
	});
});
