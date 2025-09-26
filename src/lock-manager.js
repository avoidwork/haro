import { ConcurrencyError } from "./errors.js";
import { LockTypes } from "./constants.js";

/**
 * Lock manager for controlling concurrent access
 */
export class LockManager {
	constructor () {
		// Map<recordKey, {type: string, holders: Set<transactionId>, waiters: Array}>
		this.locks = new Map();
		this.lockTimeout = 30000; // 30 seconds default
	}

	/**
	 * Acquire a lock on a record
	 * @param {string} transactionId - Transaction ID
	 * @param {string} recordKey - Record key to lock
	 * @param {string} lockType - Type of lock (shared/exclusive)
	 * @param {number} [timeout] - Lock timeout in milliseconds
	 * @returns {Promise<boolean>} True if lock acquired
	 * @throws {ConcurrencyError} If lock cannot be acquired
	 */
	async acquireLock (transactionId, recordKey, lockType, timeout = this.lockTimeout) {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			if (this._tryAcquireLock(transactionId, recordKey, lockType)) {
				return true;
			}

			// Wait a bit before retrying
			await new Promise(resolve => setTimeout(resolve, 10));
		}

		throw new ConcurrencyError(
			`Failed to acquire ${lockType} lock on record '${recordKey}' within timeout`,
			recordKey,
			"lock"
		);
	}

	/**
	 * Try to acquire lock immediately
	 * @param {string} transactionId - Transaction ID
	 * @param {string} recordKey - Record key
	 * @param {string} lockType - Lock type
	 * @returns {boolean} True if lock acquired
	 * @private
	 */
	_tryAcquireLock (transactionId, recordKey, lockType) {
		const existingLock = this.locks.get(recordKey);

		if (!existingLock) {
			// No existing lock, create new one
			this.locks.set(recordKey, {
				type: lockType,
				holders: new Set([transactionId]),
				waiters: []
			});

			return true;
		}

		// Check if already holding the lock
		if (existingLock.holders.has(transactionId)) {
			// Check for lock upgrade
			if (existingLock.type === LockTypes.SHARED && lockType === LockTypes.EXCLUSIVE) {
				// Can upgrade if we're the only holder
				if (existingLock.holders.size === 1) {
					existingLock.type = LockTypes.EXCLUSIVE;

					return true;
				}

				return false; // Cannot upgrade with other holders
			}

			return true; // Already have compatible lock
		}

		// Check compatibility
		if (lockType === LockTypes.SHARED && existingLock.type === LockTypes.SHARED) {
			// Shared locks are compatible
			existingLock.holders.add(transactionId);

			return true;
		}

		// Exclusive locks or mixed locks are not compatible
		return false;
	}

	/**
	 * Release a lock
	 * @param {string} transactionId - Transaction ID
	 * @param {string} recordKey - Record key
	 * @returns {boolean} True if lock was released
	 */
	releaseLock (transactionId, recordKey) {
		const lock = this.locks.get(recordKey);
		if (!lock || !lock.holders.has(transactionId)) {
			return false;
		}

		lock.holders.delete(transactionId);

		// If no more holders, remove the lock
		if (lock.holders.size === 0) {
			this.locks.delete(recordKey);
		}

		return true;
	}

	/**
	 * Release all locks held by a transaction
	 * @param {string} transactionId - Transaction ID
	 * @returns {number} Number of locks released
	 */
	releaseAllLocks (transactionId) {
		console.log(`DEBUG: releaseAllLocks called for transaction ${transactionId}`);
		let released = 0;

		for (const [recordKey, lock] of this.locks) {
			if (lock.holders.has(transactionId)) {
				lock.holders.delete(transactionId);
				released++;

				// If no more holders, remove the lock
				if (lock.holders.size === 0) {
					this.locks.delete(recordKey);
				}
			}
		}

		console.log(`DEBUG: releaseAllLocks released ${released} locks for transaction ${transactionId}`);
		return released;
	}

	/**
	 * Check if transaction holds any locks
	 * @param {string} transactionId - Transaction ID
	 * @returns {boolean} True if transaction holds locks
	 */
	holdsLocks (transactionId) {
		for (const lock of this.locks.values()) {
			if (lock.holders.has(transactionId)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get lock statistics
	 * @returns {Object} Lock statistics
	 */
	getStats () {
		const stats = {
			totalLocks: this.locks.size,
			sharedLocks: 0,
			exclusiveLocks: 0,
			lockHolders: new Set(),
			recordsLocked: []
		};

		for (const [recordKey, lock] of this.locks) {
			if (lock.type === LockTypes.SHARED) {
				stats.sharedLocks++;
			} else {
				stats.exclusiveLocks++;
			}

			for (const holder of lock.holders) {
				stats.lockHolders.add(holder);
			}

			stats.recordsLocked.push({
				recordKey,
				type: lock.type,
				holders: Array.from(lock.holders)
			});
		}

		stats.uniqueHolders = stats.lockHolders.size;

		return stats;
	}
}
