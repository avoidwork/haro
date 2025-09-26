import assert from "node:assert";
import { describe, it, beforeEach } from "mocha";
import { IsolationValidator } from "../../src/isolation-validator.js";
import { TransactionError } from "../../src/errors.js";
import { IsolationLevels } from "../../src/constants.js";

/**
 * Mock Transaction class for testing
 */
class MockTransaction {
	constructor(id, isolationLevel = IsolationLevels.READ_COMMITTED) {
		this.id = id;
		this.isolationLevel = isolationLevel;
		this.readSet = new Set();
		this.writeSet = new Set();
		this.snapshot = new Map();
		this.operations = [];
		this.startTime = new Date();
		this.endTime = null;
		this.status = "active";
	}

	isActive() {
		return this.status === "active";
	}

	isCommitted() {
		return this.status === "committed";
	}

	addRead(key) {
		this.readSet.add(key);
		this.operations.push({ type: "read", key });
	}

	addWrite(key, value) {
		this.writeSet.add(key);
		this.operations.push({ type: "write", key, value });
	}

	addSnapshot(key, value) {
		this.snapshot.set(key, value);
	}

	commit() {
		this.status = "committed";
		this.endTime = new Date();
	}

	abort() {
		this.status = "aborted";
		this.endTime = new Date();
	}
}

describe("IsolationValidator", () => {
	let validator;

	beforeEach(() => {
		validator = new IsolationValidator();
	});

	describe("constructor", () => {
		it("should create instance with KeyRelationshipAnalyzer", () => {
			assert.ok(validator instanceof IsolationValidator);
			assert.ok(validator.keyAnalyzer);
		});
	});

	describe("validateIsolation", () => {
		it("should handle READ_UNCOMMITTED without validation", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.READ_UNCOMMITTED);
			const allTransactions = new Map([["tx1", transaction]]);

			// Should not throw for any scenario in READ_UNCOMMITTED
			assert.doesNotThrow(() => {
				validator.validateIsolation(transaction, allTransactions);
			});
		});

		it("should throw error for unknown isolation level", () => {
			const transaction = new MockTransaction("tx1", 999);
			const allTransactions = new Map([["tx1", transaction]]);

			assert.throws(() => {
				validator.validateIsolation(transaction, allTransactions);
			}, TransactionError);
		});

		it("should validate READ_COMMITTED isolation level", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.READ_COMMITTED);
			transaction.addWrite("key1");
			
			const conflictingTx = new MockTransaction("tx2", IsolationLevels.READ_COMMITTED);
			conflictingTx.addWrite("key1");
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", conflictingTx]
			]);

			assert.throws(() => {
				validator.validateIsolation(transaction, allTransactions);
			}, TransactionError);
		});

		it("should validate REPEATABLE_READ isolation level", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.REPEATABLE_READ);
			const allTransactions = new Map([["tx1", transaction]]);

			assert.doesNotThrow(() => {
				validator.validateIsolation(transaction, allTransactions);
			});
		});

		it("should validate SERIALIZABLE isolation level", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.SERIALIZABLE);
			const allTransactions = new Map([["tx1", transaction]]);

			assert.doesNotThrow(() => {
				validator.validateIsolation(transaction, allTransactions);
			});
		});
	});

	describe("_validateReadCommitted", () => {
		it("should detect write conflicts", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.READ_COMMITTED);
			transaction.addWrite("user:123");
			
			const conflictingTx = new MockTransaction("tx2", IsolationLevels.READ_COMMITTED);
			conflictingTx.addWrite("user:123");
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", conflictingTx]
			]);

			assert.throws(() => {
				validator._validateReadCommitted(transaction, allTransactions);
			}, {
				name: "TransactionError",
				message: /Write conflict detected on key 'user:123'/
			});
		});

		it("should pass when no write conflicts exist", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.READ_COMMITTED);
			transaction.addWrite("user:123");
			
			const otherTx = new MockTransaction("tx2", IsolationLevels.READ_COMMITTED);
			otherTx.addWrite("user:456");
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", otherTx]
			]);

			assert.doesNotThrow(() => {
				validator._validateReadCommitted(transaction, allTransactions);
			});
		});

		it("should ignore inactive transactions", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.READ_COMMITTED);
			transaction.addWrite("user:123");
			
			const inactiveTx = new MockTransaction("tx2", IsolationLevels.READ_COMMITTED);
			inactiveTx.addWrite("user:123");
			inactiveTx.status = "committed";
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", inactiveTx]
			]);

			assert.doesNotThrow(() => {
				validator._validateReadCommitted(transaction, allTransactions);
			});
		});
	});

	describe("_validateRepeatableRead", () => {
		it("should detect repeatable read violations", () => {
			// Use a fresh validator instance to avoid mocking interference
			const freshValidator = new IsolationValidator();
			
			const now = Date.now();
			const transaction = new MockTransaction("tx1", IsolationLevels.REPEATABLE_READ);
			transaction.startTime = new Date(now - 2000);
			transaction.addRead("user:123");
			// Don't add any writes to avoid write conflicts
			
			const conflictingTx = new MockTransaction("tx2", IsolationLevels.REPEATABLE_READ);
			conflictingTx.startTime = new Date(now - 1000); // Started after tx1
			conflictingTx.endTime = new Date(now - 500); // Ended well before now
			conflictingTx.addWrite("user:123"); // Only tx2 writes to the key
			conflictingTx.commit();
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", conflictingTx]
			]);

			console.log("DEBUG - transaction.readSet:", Array.from(transaction.readSet));
			console.log("DEBUG - conflictingTx.writeSet:", Array.from(conflictingTx.writeSet));
			console.log("DEBUG - conflictingTx.isCommitted():", conflictingTx.isCommitted());
			console.log("DEBUG - conflictingTx.startTime > transaction.startTime:", conflictingTx.startTime > transaction.startTime);
			console.log("DEBUG - conflictingTx.endTime < new Date():", conflictingTx.endTime < new Date());
			
			// Test the conflict detection directly
			const hasConflict = freshValidator._hasReadSetConflict(transaction, "user:123", allTransactions);
			console.log("DEBUG - hasConflict result:", hasConflict);

			assert.throws(() => {
				freshValidator._validateRepeatableRead(transaction, allTransactions);
			}, {
				name: "TransactionError",
				message: /Repeatable read violation: key 'user:123'/
			});
		});

		it("should detect phantom reads in snapshots", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.REPEATABLE_READ);
			transaction.startTime = new Date(Date.now() - 1000);
			transaction.addSnapshot("users:range", ["user:123", "user:456"]);
			
			// Mock KeyRelationshipAnalyzer to return true for snapshot range
			validator.keyAnalyzer.isKeyInSnapshotRange = () => true;
			
			const conflictingTx = new MockTransaction("tx2", IsolationLevels.REPEATABLE_READ);
			conflictingTx.startTime = new Date(Date.now() - 500);
			conflictingTx.addWrite("user:789");
			conflictingTx.operations = [{ type: "write", key: "user:789" }];
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", conflictingTx]
			]);

			assert.throws(() => {
				validator._validateRepeatableRead(transaction, allTransactions);
			}, {
				name: "TransactionError",
				message: /Phantom read detected/
			});
		});

		it("should pass when no violations exist", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.REPEATABLE_READ);
			transaction.addRead("user:123");
			
			const otherTx = new MockTransaction("tx2", IsolationLevels.REPEATABLE_READ);
			otherTx.addWrite("user:456");
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", otherTx]
			]);

			assert.doesNotThrow(() => {
				validator._validateRepeatableRead(transaction, allTransactions);
			});
		});
	});

	describe("_validateSerializable", () => {
		it("should detect read-write conflicts", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.SERIALIZABLE);
			transaction.startTime = new Date(Date.now() - 1000);
			transaction.addRead("user:123");
			
			const conflictingTx = new MockTransaction("tx2", IsolationLevels.SERIALIZABLE);
			conflictingTx.startTime = new Date(Date.now() - 500);
			conflictingTx.addWrite("user:123");
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", conflictingTx]
			]);

			assert.throws(() => {
				validator._validateSerializable(transaction, allTransactions);
			}, {
				name: "TransactionError",
				message: /Serialization conflict.*was written by concurrent transactions/
			});
		});

		it("should detect write-read conflicts", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.SERIALIZABLE);
			transaction.startTime = new Date(Date.now() - 1000);
			transaction.addWrite("user:123");
			
			const conflictingTx = new MockTransaction("tx2", IsolationLevels.SERIALIZABLE);
			conflictingTx.startTime = new Date(Date.now() - 500);
			conflictingTx.addRead("user:123");
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", conflictingTx]
			]);

			assert.throws(() => {
				validator._validateSerializable(transaction, allTransactions);
			}, {
				name: "TransactionError",
				message: /Serialization conflict.*was read by concurrent transactions/
			});
		});

		it("should pass when no serialization conflicts exist", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.SERIALIZABLE);
			transaction.addRead("user:123");
			transaction.addWrite("user:456");
			
			const otherTx = new MockTransaction("tx2", IsolationLevels.SERIALIZABLE);
			otherTx.addRead("user:789");
			otherTx.addWrite("user:999");
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", otherTx]
			]);

			assert.doesNotThrow(() => {
				validator._validateSerializable(transaction, allTransactions);
			});
		});
	});

	describe("_findConflictingWrites", () => {
		it("should find transactions writing to the same key", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.addWrite("user:123");
			
			const tx2 = new MockTransaction("tx2");
			tx2.addWrite("user:123");
			
			const tx3 = new MockTransaction("tx3");
			tx3.addWrite("user:456");
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2],
				["tx3", tx3]
			]);

			const conflicts = validator._findConflictingWrites("tx1", "user:123", allTransactions);
			assert.strictEqual(conflicts.length, 1);
			assert.strictEqual(conflicts[0], "tx2");
		});

		it("should exclude the requesting transaction", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.addWrite("user:123");
			
			const allTransactions = new Map([["tx1", tx1]]);

			const conflicts = validator._findConflictingWrites("tx1", "user:123", allTransactions);
			assert.strictEqual(conflicts.length, 0);
		});

		it("should ignore inactive transactions", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.addWrite("user:123");
			
			const tx2 = new MockTransaction("tx2");
			tx2.addWrite("user:123");
			tx2.status = "committed";
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2]
			]);

			const conflicts = validator._findConflictingWrites("tx1", "user:123", allTransactions);
			assert.strictEqual(conflicts.length, 0);
		});
	});

	describe("_findConflictingWritesToRead", () => {
		it("should find overlapping transactions that wrote to read key", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(Date.now() - 1000);
			tx1.addRead("user:123");
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(Date.now() - 500);
			tx2.addWrite("user:123");
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2]
			]);

			const conflicts = validator._findConflictingWritesToRead(tx1, "user:123", allTransactions);
			assert.strictEqual(conflicts.length, 1);
			assert.strictEqual(conflicts[0], "tx2");
		});

		it("should ignore non-overlapping transactions", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(Date.now() - 2000);
			tx1.endTime = new Date(Date.now() - 1500);
			tx1.addRead("user:123");
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(Date.now() - 1000);
			tx2.addWrite("user:123");
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2]
			]);

			const conflicts = validator._findConflictingWritesToRead(tx1, "user:123", allTransactions);
			assert.strictEqual(conflicts.length, 0);
		});
	});

	describe("_findConflictingReadsToWrite", () => {
		it("should find overlapping transactions that read written key", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(Date.now() - 1000);
			tx1.addWrite("user:123");
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(Date.now() - 500);
			tx2.addRead("user:123");
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2]
			]);

			const conflicts = validator._findConflictingReadsToWrite(tx1, "user:123", allTransactions);
			assert.strictEqual(conflicts.length, 1);
			assert.strictEqual(conflicts[0], "tx2");
		});
	});

	describe("_hasReadSetConflict", () => {
		it("should detect conflicts when another transaction modified read key", () => {
			// Use a fresh validator instance to avoid mocking interference
			const freshValidator = new IsolationValidator();
			
			const now = Date.now();
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(now - 2000);
			tx1.addRead("user:123");
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(now - 1000); // Started after tx1
			tx2.endTime = new Date(now - 500); // Ended well before now
			tx2.addWrite("user:123");
			tx2.commit();
			
			console.log("DEBUG _hasReadSetConflict - tx2.endTime:", tx2.endTime);
			console.log("DEBUG _hasReadSetConflict - new Date():", new Date());
			console.log("DEBUG _hasReadSetConflict - tx2.endTime < new Date():", tx2.endTime < new Date());
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2]
			]);

			const hasConflict = freshValidator._hasReadSetConflict(tx1, "user:123", allTransactions);
			console.log("DEBUG _hasReadSetConflict - result:", hasConflict);
			assert.strictEqual(hasConflict, true);
		});

		it("should not detect conflicts when no other transaction modified key", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.addRead("user:123");
			
			const tx2 = new MockTransaction("tx2");
			tx2.addWrite("user:456");
			tx2.commit();
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2]
			]);

			const hasConflict = validator._hasReadSetConflict(tx1, "user:123", allTransactions);
			assert.strictEqual(hasConflict, false);
		});
	});

	describe("_hasSnapshotConflict", () => {
		it("should detect phantom conflicts through key analyzer", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(Date.now() - 1000);
			tx1.addSnapshot("users:range", ["user:123"]);
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(Date.now() - 500);
			tx2.addWrite("user:456");
			tx2.operations = [{ type: "write", key: "user:456" }];
			
			// Mock key analyzer to detect phantom conflict
			validator.keyAnalyzer.isKeyInSnapshotRange = () => true;
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2]
			]);

			const hasConflict = validator._hasSnapshotConflict(tx1, "users:range", ["user:123"], allTransactions);
			assert.strictEqual(hasConflict, true);
		});

		it("should detect serialization anomalies", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(Date.now() - 1000);
			tx1.addSnapshot("summary", { count: 5 });
			tx1.addRead("account:123");
			tx1.addWrite("total:456");
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(Date.now() - 500);
			tx2.addRead("account:789");
			tx2.addWrite("total:999");
			
			// Mock key analyzer for related reads
			validator.keyAnalyzer.areKeysRelated = () => true;
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2]
			]);

			const hasConflict = validator._hasSnapshotConflict(tx1, "summary", { count: 5 }, allTransactions);
			assert.strictEqual(hasConflict, true);
		});
	});

	describe("_hasPhantomConflict", () => {
		it("should detect phantom conflict for direct key match", () => {
			const tx1 = new MockTransaction("tx1");
			const tx2 = new MockTransaction("tx2");
			tx2.operations = [{ type: "write", key: "user:123" }];

			const hasConflict = validator._hasPhantomConflict(tx1, tx2, "user:123", null);
			assert.strictEqual(hasConflict, true);
		});

		it("should detect phantom conflict through key analyzer", () => {
			const tx1 = new MockTransaction("tx1");
			const tx2 = new MockTransaction("tx2");
			tx2.operations = [{ type: "write", key: "user:456" }];

			// Mock key analyzer to detect range inclusion
			validator.keyAnalyzer.isKeyInSnapshotRange = () => true;

			const hasConflict = validator._hasPhantomConflict(tx1, tx2, "users:range", []);
			assert.strictEqual(hasConflict, true);
		});

		it("should ignore read operations", () => {
			const tx1 = new MockTransaction("tx1");
			const tx2 = new MockTransaction("tx2");
			tx2.operations = [{ type: "read", key: "user:123" }];

			const hasConflict = validator._hasPhantomConflict(tx1, tx2, "user:123", null);
			assert.strictEqual(hasConflict, false);
		});
	});

	describe("_hasSerializationAnomalyInSnapshot", () => {
		it("should detect write-skew anomaly", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(Date.now() - 1000);
			tx1.addRead("account:123");
			tx1.addWrite("total:456");
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(Date.now() - 500);
			tx2.addRead("account:789");
			tx2.addWrite("total:999");
			
			// Mock key analyzer for related reads
			validator.keyAnalyzer.areKeysRelated = () => true;
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2]
			]);

			const hasAnomaly = validator._hasSerializationAnomalyInSnapshot(tx1, "summary", allTransactions);
			assert.strictEqual(hasAnomaly, true);
		});

		it("should detect dependency cycles", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(Date.now() - 1000);
			tx1.addRead("key1");
			tx1.addWrite("key2");
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(Date.now() - 500);
			tx2.addRead("key2");
			tx2.addWrite("key1");
			
			const allTransactions = new Map([
				["tx1", tx1],
				["tx2", tx2]
			]);

			const hasAnomaly = validator._hasSerializationAnomalyInSnapshot(tx1, "summary", allTransactions);
			assert.strictEqual(hasAnomaly, true);
		});
	});

	describe("_hasWriteSkewAnomaly", () => {
		it("should detect write skew when both transactions have related reads and non-overlapping writes", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.addRead("account:123");
			tx1.addWrite("total:456");
			
			const tx2 = new MockTransaction("tx2");
			tx2.addRead("account:789");
			tx2.addWrite("total:999");
			
			// Mock key analyzer for related reads
			validator.keyAnalyzer.areKeysRelated = () => true;

			const hasSkew = validator._hasWriteSkewAnomaly(tx1, tx2, "summary");
			assert.strictEqual(hasSkew, true);
		});

		it("should not detect write skew when transactions have overlapping writes", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.addRead("account:123");
			tx1.addWrite("total:456");
			
			const tx2 = new MockTransaction("tx2");
			tx2.addRead("account:789");
			tx2.addWrite("total:456"); // Same write key
			
			// Mock key analyzer for related reads
			validator.keyAnalyzer.areKeysRelated = () => true;

			const hasSkew = validator._hasWriteSkewAnomaly(tx1, tx2, "summary");
			assert.strictEqual(hasSkew, false);
		});

		it("should not detect write skew when no related reads", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.addRead("account:123");
			tx1.addWrite("total:456");
			
			const tx2 = new MockTransaction("tx2");
			tx2.addRead("product:789");
			tx2.addWrite("inventory:999");
			
			// Mock key analyzer for unrelated reads
			validator.keyAnalyzer.areKeysRelated = () => false;

			const hasSkew = validator._hasWriteSkewAnomaly(tx1, tx2, "summary");
			assert.strictEqual(hasSkew, false);
		});
	});

	describe("_hasRelatedReads", () => {
		it("should detect related reads through key analyzer", () => {
			const tx = new MockTransaction("tx1");
			tx.addRead("user:123");
			tx.addRead("profile:456");
			
			// Mock key analyzer to return true for related keys
			validator.keyAnalyzer.areKeysRelated = () => true;

			const hasRelated = validator._hasRelatedReads(tx, "account:789");
			assert.strictEqual(hasRelated, true);
		});

		it("should not detect related reads when keys are unrelated", () => {
			const tx = new MockTransaction("tx1");
			tx.addRead("user:123");
			
			// Mock key analyzer to return false for unrelated keys
			validator.keyAnalyzer.areKeysRelated = () => false;

			const hasRelated = validator._hasRelatedReads(tx, "product:789");
			assert.strictEqual(hasRelated, false);
		});
	});

	describe("_hasDependencyCycle", () => {
		it("should detect bidirectional read-write dependencies", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.addRead("key1");
			tx1.addWrite("key2");
			
			const tx2 = new MockTransaction("tx2");
			tx2.addRead("key2");
			tx2.addWrite("key1");

			const hasCycle = validator._hasDependencyCycle(tx1, tx2);
			assert.strictEqual(hasCycle, true);
		});

		it("should not detect cycle with unidirectional dependency", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.addRead("key1");
			tx1.addWrite("key2");
			
			const tx2 = new MockTransaction("tx2");
			tx2.addRead("key3");
			tx2.addWrite("key1");

			const hasCycle = validator._hasDependencyCycle(tx1, tx2);
			assert.strictEqual(hasCycle, false);
		});
	});

	describe("_readsOtherWrites", () => {
		it("should detect when reader reads what writer writes", () => {
			const reader = new MockTransaction("reader");
			reader.addRead("key1");
			reader.addRead("key2");
			
			const writer = new MockTransaction("writer");
			writer.addWrite("key1");
			writer.addWrite("key3");

			const reads = validator._readsOtherWrites(reader, writer);
			assert.strictEqual(reads, true);
		});

		it("should not detect when no overlap", () => {
			const reader = new MockTransaction("reader");
			reader.addRead("key1");
			
			const writer = new MockTransaction("writer");
			writer.addWrite("key2");

			const reads = validator._readsOtherWrites(reader, writer);
			assert.strictEqual(reads, false);
		});
	});

	describe("_transactionsOverlap", () => {
		it("should detect overlapping transactions", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(Date.now() - 1000);
			tx1.endTime = new Date(Date.now() - 200);
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(Date.now() - 600);
			tx2.endTime = new Date();

			const overlap = validator._transactionsOverlap(tx1, tx2);
			assert.strictEqual(overlap, true);
		});

		it("should not detect overlap when transactions are sequential", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(Date.now() - 2000);
			tx1.endTime = new Date(Date.now() - 1000);
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(Date.now() - 900);
			tx2.endTime = new Date();

			const overlap = validator._transactionsOverlap(tx1, tx2);
			assert.strictEqual(overlap, false);
		});

		it("should handle ongoing transactions (no endTime)", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = new Date(Date.now() - 1000);
			// tx1.endTime is null (ongoing)
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date(Date.now() - 500);
			// tx2.endTime is null (ongoing)

			const overlap = validator._transactionsOverlap(tx1, tx2);
			assert.strictEqual(overlap, true);
		});

		it("should handle missing start times", () => {
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = null;
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = new Date();

			const overlap = validator._transactionsOverlap(tx1, tx2);
			assert.strictEqual(overlap, false);
		});
	});

	describe("error message validation", () => {
		it("should include transaction ID in error messages", () => {
			const transaction = new MockTransaction("test-tx-123", 999);
			const allTransactions = new Map([["test-tx-123", transaction]]);

			try {
				validator.validateIsolation(transaction, allTransactions);
				assert.fail("Should have thrown error");
			} catch (error) {
				assert.ok(error instanceof TransactionError);
				assert.ok(error.message.includes("999"));
				assert.strictEqual(error.context.transactionId, "test-tx-123");
				assert.strictEqual(error.context.operation, "isolation");
			}
		});

		it("should include conflicting transaction IDs in write conflict errors", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.READ_COMMITTED);
			transaction.addWrite("conflicted-key");
			
			const conflictingTx1 = new MockTransaction("conflict-tx-1");
			conflictingTx1.addWrite("conflicted-key");
			
			const conflictingTx2 = new MockTransaction("conflict-tx-2");
			conflictingTx2.addWrite("conflicted-key");
			
			const allTransactions = new Map([
				["tx1", transaction],
				["conflict-tx-1", conflictingTx1],
				["conflict-tx-2", conflictingTx2]
			]);

			try {
				validator.validateIsolation(transaction, allTransactions);
				assert.fail("Should have thrown error");
			} catch (error) {
				assert.ok(error.message.includes("conflict-tx-1"));
				assert.ok(error.message.includes("conflict-tx-2"));
				assert.ok(error.message.includes("conflicted-key"));
				assert.strictEqual(error.context.operation, "write-conflict");
			}
		});
	});

	describe("integration with KeyRelationshipAnalyzer", () => {
		it("should use key analyzer for phantom detection", () => {
			let isKeyInSnapshotRangeCalled = false;
			validator.keyAnalyzer.isKeyInSnapshotRange = (transaction, operationKey, snapshotKey, expectedValue) => {
				isKeyInSnapshotRangeCalled = true;
				return true;
			};

			const transaction = new MockTransaction("tx1", IsolationLevels.REPEATABLE_READ);
			transaction.startTime = new Date(Date.now() - 1000);
			transaction.addSnapshot("users:range", ["user:123"]);
			
			const conflictingTx = new MockTransaction("tx2");
			conflictingTx.startTime = new Date(Date.now() - 500);
			conflictingTx.operations = [{ type: "write", key: "user:456" }];
			
			const allTransactions = new Map([
				["tx1", transaction],
				["tx2", conflictingTx]
			]);

			try {
				validator.validateIsolation(transaction, allTransactions);
				assert.fail("Should have thrown error");
			} catch (error) {
				assert.ok(isKeyInSnapshotRangeCalled);
				assert.ok(error.message.includes("Phantom read detected"));
			}
		});

		it("should use key analyzer for related key detection", () => {
			let areKeysRelatedCalled = false;
			validator.keyAnalyzer.areKeysRelated = (key1, key2) => {
				areKeysRelatedCalled = true;
				return true;
			};

			const tx1 = new MockTransaction("tx1");
			tx1.addRead("user:123");
			tx1.addWrite("profile:456");
			
			const tx2 = new MockTransaction("tx2");
			tx2.addRead("account:789");
			tx2.addWrite("settings:999");
			
			// Test write skew detection which uses key analyzer
			const hasSkew = validator._hasWriteSkewAnomaly(tx1, tx2, "summary");
			
			assert.ok(areKeysRelatedCalled);
			assert.strictEqual(hasSkew, true);
		});
	});

	describe("edge cases", () => {
		it("should handle empty read and write sets", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.SERIALIZABLE);
			const allTransactions = new Map([["tx1", transaction]]);

			assert.doesNotThrow(() => {
				validator.validateIsolation(transaction, allTransactions);
			});
		});

		it("should handle single transaction scenario", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.SERIALIZABLE);
			transaction.addRead("key1");
			transaction.addWrite("key2");
			
			const allTransactions = new Map([["tx1", transaction]]);

			assert.doesNotThrow(() => {
				validator.validateIsolation(transaction, allTransactions);
			});
		});

		it("should handle transactions with same start time", () => {
			const startTime = new Date();
			
			const tx1 = new MockTransaction("tx1");
			tx1.startTime = startTime;
			tx1.endTime = new Date(startTime.getTime() + 1000);
			
			const tx2 = new MockTransaction("tx2");
			tx2.startTime = startTime;
			tx2.endTime = new Date(startTime.getTime() + 500);

			const overlap = validator._transactionsOverlap(tx1, tx2);
			assert.strictEqual(overlap, true);
		});

		it("should handle empty operations array", () => {
			const tx1 = new MockTransaction("tx1");
			const tx2 = new MockTransaction("tx2");
			tx2.operations = [];

			const hasConflict = validator._hasPhantomConflict(tx1, tx2, "key1", null);
			assert.strictEqual(hasConflict, false);
		});

		it("should handle transaction without snapshot", () => {
			const transaction = new MockTransaction("tx1", IsolationLevels.REPEATABLE_READ);
			transaction.snapshot = new Map(); // Empty snapshot
			
			const allTransactions = new Map([["tx1", transaction]]);

			assert.doesNotThrow(() => {
				validator.validateIsolation(transaction, allTransactions);
			});
		});
	});
});
