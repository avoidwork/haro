import { TransactionError } from "./errors.js";
import { IsolationLevels } from "./constants.js";
import { KeyRelationshipAnalyzer } from "./key-relationship-analyzer.js";

/**
 * Validator for transaction isolation levels and conflict detection
 */
export class IsolationValidator {
	constructor () {
		this.keyAnalyzer = new KeyRelationshipAnalyzer();
	}

	/**
	 * Validate isolation level requirements for a transaction
	 * @param {Transaction} transaction - Transaction to validate
	 * @param {Map<string, Transaction>} allTransactions - All active transactions
	 * @throws {TransactionError} If isolation violation detected
	 */
	validateIsolation (transaction, allTransactions) {
		switch (transaction.isolationLevel) {
			case IsolationLevels.READ_UNCOMMITTED:
				// No validation needed - allows dirty reads
				break;

			case IsolationLevels.READ_COMMITTED:
				this._validateReadCommitted(transaction, allTransactions);
				break;

			case IsolationLevels.REPEATABLE_READ:
				this._validateRepeatableRead(transaction, allTransactions);
				break;

			case IsolationLevels.SERIALIZABLE:
				this._validateSerializable(transaction, allTransactions);
				break;

			default:
				throw new TransactionError(
					`Unknown isolation level: ${transaction.isolationLevel}`,
					transaction.id,
					"isolation"
				);
		}
	}

	/**
	 * Validate READ_COMMITTED isolation level
	 * @param {Transaction} transaction - Transaction to validate
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @throws {TransactionError} If isolation violation detected
	 * @private
	 */
	_validateReadCommitted (transaction, allTransactions) {
		for (const writeKey of transaction.writeSet) {
			const conflictingTransactions = this._findConflictingWrites(transaction.id, writeKey, allTransactions);
			if (conflictingTransactions.length > 0) {
				throw new TransactionError(
					`Write conflict detected on key '${writeKey}' with transactions: ${conflictingTransactions.join(", ")}`,
					transaction.id,
					"write-conflict"
				);
			}
		}
	}

	/**
	 * Validate REPEATABLE_READ isolation level
	 * @param {Transaction} transaction - Transaction to validate
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @throws {TransactionError} If isolation violation detected
	 * @private
	 */
	_validateRepeatableRead (transaction, allTransactions) {
		// First validate READ_COMMITTED requirements
		this._validateReadCommitted(transaction, allTransactions);

		// Check for repeatable read violations
		for (const readKey of transaction.readSet) {
			if (this._hasReadSetConflict(transaction, readKey, allTransactions)) {
				throw new TransactionError(
					`Repeatable read violation: key '${readKey}' was modified by another transaction`,
					transaction.id,
					"repeatable-read-violation"
				);
			}
		}

		// Check for phantom reads in range queries
		if (transaction.snapshot.size > 0) {
			for (const [snapshotKey, snapshotValue] of transaction.snapshot) {
				if (this._hasSnapshotConflict(transaction, snapshotKey, snapshotValue, allTransactions)) {
					throw new TransactionError(
						`Phantom read detected: snapshot inconsistency for key '${snapshotKey}'`,
						transaction.id,
						"phantom-read"
					);
				}
			}
		}
	}

	/**
	 * Validate SERIALIZABLE isolation level
	 * @param {Transaction} transaction - Transaction to validate
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @throws {TransactionError} If isolation violation detected
	 * @private
	 */
	_validateSerializable (transaction, allTransactions) {
		// First validate REPEATABLE_READ requirements
		this._validateRepeatableRead(transaction, allTransactions);

		// Check for read-write conflicts
		for (const readKey of transaction.readSet) {
			const conflictingWrites = this._findConflictingWritesToRead(transaction, readKey, allTransactions);
			if (conflictingWrites.length > 0) {
				throw new TransactionError(
					`Serialization conflict: key '${readKey}' was written by concurrent transactions: ${conflictingWrites.join(", ")}`,
					transaction.id,
					"serialization-conflict"
				);
			}
		}

		// Check for write-read conflicts
		for (const writeKey of transaction.writeSet) {
			const conflictingReads = this._findConflictingReadsToWrite(transaction, writeKey, allTransactions);
			if (conflictingReads.length > 0) {
				throw new TransactionError(
					`Serialization conflict: key '${writeKey}' was read by concurrent transactions: ${conflictingReads.join(", ")}`,
					transaction.id,
					"serialization-conflict"
				);
			}
		}
	}

	/**
	 * Find transactions that have conflicting writes to the same key
	 * @param {string} excludeTransactionId - Transaction ID to exclude from search
	 * @param {string} key - Key to check for conflicts
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {string[]} Array of conflicting transaction IDs
	 * @private
	 */
	_findConflictingWrites (excludeTransactionId, key, allTransactions) {
		const conflicting = [];

		for (const [txId, transaction] of allTransactions) {
			if (txId !== excludeTransactionId &&
				transaction.isActive() &&
				transaction.writeSet.has(key)) {
				conflicting.push(txId);
			}
		}

		return conflicting;
	}

	/**
	 * Find transactions that wrote to a key this transaction read
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Key that was read
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {string[]} Array of conflicting transaction IDs
	 * @private
	 */
	_findConflictingWritesToRead (transaction, key, allTransactions) {
		const conflicting = [];

		for (const [txId, otherTx] of allTransactions) {
			if (txId !== transaction.id &&
				otherTx.isActive() &&
				otherTx.writeSet.has(key) &&
				this._transactionsOverlap(transaction, otherTx)) {
				conflicting.push(txId);
			}
		}

		return conflicting;
	}

	/**
	 * Find transactions that read a key this transaction wrote
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Key that was written
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {string[]} Array of conflicting transaction IDs
	 * @private
	 */
	_findConflictingReadsToWrite (transaction, key, allTransactions) {
		const conflicting = [];

		for (const [txId, otherTx] of allTransactions) {
			if (txId !== transaction.id &&
				otherTx.isActive() &&
				otherTx.readSet.has(key) &&
				this._transactionsOverlap(transaction, otherTx)) {
				conflicting.push(txId);
			}
		}

		return conflicting;
	}

	/**
	 * Check if a read key has conflicts with other transactions
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Key that was read
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {boolean} True if conflict detected
	 * @private
	 */
	_hasReadSetConflict (transaction, key, allTransactions) {
		for (const [txId, otherTx] of allTransactions) {
			if (txId !== transaction.id &&
				otherTx.isCommitted() &&
				otherTx.writeSet.has(key) &&
				otherTx.startTime > transaction.startTime &&
				otherTx.endTime < new Date()) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if snapshot has conflicts indicating phantom reads
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Snapshot key
	 * @param {*} expectedValue - Expected value from snapshot
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {boolean} True if conflict detected
	 * @private
	 */
	_hasSnapshotConflict (transaction, key, expectedValue, allTransactions) {
		// Check if any other transaction modified this specific key
		if (this._hasReadSetConflict(transaction, key, allTransactions)) {
			return true;
		}

		// Check for phantom reads in range-based operations
		for (const [txId, otherTx] of allTransactions) {
			if (txId !== transaction.id && this._transactionsOverlap(transaction, otherTx)) {
				if (this._hasPhantomConflict(transaction, otherTx, key, expectedValue)) {
					return true;
				}
			}
		}

		// Check for serialization anomalies specific to snapshots
		if (this._hasSerializationAnomalyInSnapshot(transaction, key, allTransactions)) {
			return true;
		}

		return false;
	}

	/**
	 * Check if another transaction creates phantom reads for this transaction's snapshot
	 * @param {Transaction} transaction - Transaction with snapshot
	 * @param {Transaction} otherTransaction - Other concurrent transaction
	 * @param {string} key - Snapshot key
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if phantom conflict detected
	 * @private
	 */
	_hasPhantomConflict (transaction, otherTransaction, key, expectedValue) {
		for (const operation of otherTransaction.operations) {
			if (operation.type !== "read") {
				if (operation.key === key) {
					return true;
				}

				if (this.keyAnalyzer.isKeyInSnapshotRange(transaction, operation.key, key, expectedValue)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check for serialization anomalies in snapshot data
	 * @param {Transaction} transaction - Transaction with snapshot
	 * @param {string} key - Snapshot key
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {boolean} True if serialization anomaly detected
	 * @private
	 */
	_hasSerializationAnomalyInSnapshot (transaction, key, allTransactions) {
		for (const [txId, otherTx] of allTransactions) {
			if (txId !== transaction.id &&
				otherTx.isActive() &&
				this._transactionsOverlap(transaction, otherTx)) {

				if (this._hasWriteSkewAnomaly(transaction, otherTx, key)) {
					return true;
				}

				if (this._hasDependencyCycle(transaction, otherTx)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check for write-skew anomalies between transactions
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @param {string} key - Key being checked
	 * @returns {boolean} True if write-skew detected
	 * @private
	 */
	_hasWriteSkewAnomaly (tx1, tx2, key) {
		const tx1ReadsRelated = this._hasRelatedReads(tx1, key);
		const tx2ReadsRelated = this._hasRelatedReads(tx2, key);

		if (!tx1ReadsRelated || !tx2ReadsRelated) {
			return false;
		}

		const tx1Writes = Array.from(tx1.writeSet);
		const tx2Writes = Array.from(tx2.writeSet);
		const hasOverlappingWrites = tx1Writes.some(k => tx2Writes.includes(k));

		if (hasOverlappingWrites) {
			return false;
		}

		return tx1Writes.length > 0 && tx2Writes.length > 0;
	}

	/**
	 * Check if transaction has reads related to a key
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Reference key
	 * @returns {boolean} True if has related reads
	 * @private
	 */
	_hasRelatedReads (transaction, key) {
		for (const readKey of transaction.readSet) {
			if (this.keyAnalyzer.areKeysRelated(readKey, key)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check for dependency cycles between transactions
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @returns {boolean} True if dependency cycle detected
	 * @private
	 */
	_hasDependencyCycle (tx1, tx2) {
		const tx1ReadsTx2Writes = this._readsOtherWrites(tx1, tx2);
		const tx2ReadsTx1Writes = this._readsOtherWrites(tx2, tx1);

		return tx1ReadsTx2Writes && tx2ReadsTx1Writes;
	}

	/**
	 * Check if one transaction reads what another writes
	 * @param {Transaction} reader - Reading transaction
	 * @param {Transaction} writer - Writing transaction
	 * @returns {boolean} True if dependency exists
	 * @private
	 */
	_readsOtherWrites (reader, writer) {
		for (const readKey of reader.readSet) {
			if (writer.writeSet.has(readKey)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if two transactions have overlapping execution periods
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @returns {boolean} True if transactions overlap in time
	 * @private
	 */
	_transactionsOverlap (tx1, tx2) {
		if (!tx1.startTime || !tx2.startTime) {
			return false;
		}

		const tx1Start = tx1.startTime.getTime();
		const tx1End = tx1.endTime ? tx1.endTime.getTime() : Date.now();
		const tx2Start = tx2.startTime.getTime();
		const tx2End = tx2.endTime ? tx2.endTime.getTime() : Date.now();

		return tx1Start < tx2End && tx2Start < tx1End;
	}
}
