import { ConfigurationError } from "./errors.js";

/**
 * Version retention policies
 */
export const RetentionPolicies = {
	COUNT: "count",
	TIME: "time",
	SIZE: "size",
	NONE: "none"
};

/**
 * Version entry with metadata
 */
export class VersionEntry {
	/**
	 * @param {Object} data - Version data
	 * @param {Object} [metadata={}] - Version metadata
	 */
	constructor (data, metadata = {}) {
		this.data = Object.freeze(structuredClone(data));
		this.timestamp = new Date();
		this.size = this._calculateSize(data);
		this.metadata = Object.freeze({
			operation: "update",
			...metadata
		});

		Object.freeze(this);
	}

	/**
	 * Calculate estimated size of version data
	 * @param {Object} data - Data to measure
	 * @returns {number} Size in bytes
	 * @private
	 */
	_calculateSize (data) {
		try {
			return JSON.stringify(data).length * 2; // UTF-16 estimate
		} catch {
			return 1024; // Fallback estimate
		}
	}

	/**
	 * Check if version is older than specified time
	 * @param {number} maxAge - Maximum age in milliseconds
	 * @returns {boolean} True if version is older
	 */
	isOlderThan (maxAge) {
		return Date.now() - this.timestamp.getTime() > maxAge;
	}

	/**
	 * Get age of version in milliseconds
	 * @returns {number} Age in milliseconds
	 */
	getAge () {
		return Date.now() - this.timestamp.getTime();
	}

	/**
	 * Convert to plain object for serialization
	 * @returns {Object} Plain object representation
	 */
	toObject () {
		return {
			data: this.data,
			timestamp: this.timestamp.toISOString(),
			size: this.size,
			metadata: this.metadata
		};
	}
}

/**
 * Version history for a single record
 */
export class VersionHistory {
	/**
	 * @param {string} recordKey - Record key
	 * @param {Object} [policy={}] - Retention policy
	 */
	constructor (recordKey, policy = {}) {
		this.recordKey = recordKey;
		this.policy = policy;
		this.versions = [];
		this.totalSize = 0;
		this.createdAt = new Date();
		this.lastAccessed = new Date();
	}

	/**
	 * Add a new version
	 * @param {Object} data - Version data
	 * @param {Object} [metadata={}] - Version metadata
	 * @returns {VersionEntry} Created version entry
	 */
	addVersion (data, metadata = {}) {
		const version = new VersionEntry(data, metadata);
		this.versions.push(version);
		this.totalSize += version.size;
		this.lastAccessed = new Date();

		// Apply retention policy
		this._applyRetentionPolicy();

		return version;
	}

	/**
	 * Get version by index (0 = oldest, -1 = newest)
	 * @param {number} index - Version index
	 * @returns {VersionEntry|undefined} Version entry
	 */
	getVersion (index) {
		this.lastAccessed = new Date();

		if (index < 0) {
			return this.versions[this.versions.length + index];
		}

		return this.versions[index];
	}

	/**
	 * Get latest version
	 * @returns {VersionEntry|undefined} Latest version
	 */
	getLatest () {
		return this.getVersion(-1);
	}

	/**
	 * Get oldest version
	 * @returns {VersionEntry|undefined} Oldest version
	 */
	getOldest () {
		return this.getVersion(0);
	}

	/**
	 * Get all versions within time range
	 * @param {Date} [start] - Start time (inclusive)
	 * @param {Date} [end] - End time (inclusive)
	 * @returns {VersionEntry[]} Array of versions in range
	 */
	getVersionsInRange (start, end) {
		this.lastAccessed = new Date();

		return this.versions.filter(version => {
			const timestamp = version.timestamp;
			const afterStart = !start || timestamp >= start;
			const beforeEnd = !end || timestamp <= end;

			return afterStart && beforeEnd;
		});
	}

	/**
	 * Get number of versions
	 * @returns {number} Version count
	 */
	getCount () {
		return this.versions.length;
	}

	/**
	 * Get total size of all versions
	 * @returns {number} Total size in bytes
	 */
	getTotalSize () {
		return this.totalSize;
	}

	/**
	 * Clear all versions
	 * @returns {number} Number of versions cleared
	 */
	clear () {
		const count = this.versions.length;
		this.versions = [];
		this.totalSize = 0;

		return count;
	}

	/**
	 * Remove versions older than specified age
	 * @param {number} maxAge - Maximum age in milliseconds
	 * @returns {number} Number of versions removed
	 */
	removeOlderThan (maxAge) {
		const oldCount = this.versions.length;
		const cutoffTime = Date.now() - maxAge;

		this.versions = this.versions.filter(version => {
			const keep = version.timestamp.getTime() >= cutoffTime;
			if (!keep) {
				this.totalSize -= version.size;
			}

			return keep;
		});

		return oldCount - this.versions.length;
	}

	/**
	 * Apply retention policy to limit versions
	 * @private
	 */
	_applyRetentionPolicy () {
		if (!this.policy || this.policy.type === RetentionPolicies.NONE) {
			return;
		}

		let removed = 0;

		switch (this.policy.type) {
			case RetentionPolicies.COUNT:
				removed = this._applyCountPolicy();
				break;
			case RetentionPolicies.TIME:
				removed = this._applyTimePolicy();
				break;
			case RetentionPolicies.SIZE:
				removed = this._applySizePolicy();
				break;
		}

		return removed;
	}

	/**
	 * Apply count-based retention policy
	 * @returns {number} Number of versions removed
	 * @private
	 */
	_applyCountPolicy () {
		const maxCount = this.policy.maxCount || 10;
		if (this.versions.length <= maxCount) {
			return 0;
		}

		const removeCount = this.versions.length - maxCount;
		const removed = this.versions.splice(0, removeCount);

		for (const version of removed) {
			this.totalSize -= version.size;
		}

		return removed.length;
	}

	/**
	 * Apply time-based retention policy
	 * @returns {number} Number of versions removed
	 * @private
	 */
	_applyTimePolicy () {
		const maxAge = this.policy.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 days default

		return this.removeOlderThan(maxAge);
	}

	/**
	 * Apply size-based retention policy
	 * @returns {number} Number of versions removed
	 * @private
	 */
	_applySizePolicy () {
		const maxSize = this.policy.maxSize || 10 * 1024 * 1024; // 10MB default
		if (this.totalSize <= maxSize) {
			return 0;
		}

		let removed = 0;
		while (this.totalSize > maxSize && this.versions.length > 1) {
			const version = this.versions.shift();
			this.totalSize -= version.size;
			removed++;
		}

		return removed;
	}

	/**
	 * Get statistics for this version history
	 * @returns {Object} Statistics object
	 */
	getStats () {
		return {
			recordKey: this.recordKey,
			versionCount: this.versions.length,
			totalSize: this.totalSize,
			averageSize: this.versions.length > 0 ? this.totalSize / this.versions.length : 0,
			oldestVersion: this.versions.length > 0 ? this.versions[0].timestamp : null,
			newestVersion: this.versions.length > 0 ? this.versions[this.versions.length - 1].timestamp : null,
			createdAt: this.createdAt,
			lastAccessed: this.lastAccessed,
			policy: this.policy
		};
	}
}

/**
 * Version manager for handling versioning across all records
 */
export class VersionManager {
	/**
	 * @param {Object} [globalPolicy={}] - Global retention policy
	 */
	constructor (globalPolicy = {}) {
		this.globalPolicy = this._validatePolicy(globalPolicy);
		// Map<recordKey, VersionHistory>
		this.histories = new Map();
		this.stats = {
			totalHistories: 0,
			totalVersions: 0,
			totalSize: 0,
			lastCleanup: new Date(),
			cleanupCount: 0
		};
	}

	/**
	 * Enable versioning for a record
	 * @param {string} recordKey - Record key
	 * @param {Object} [policy] - Custom retention policy for this record
	 * @returns {VersionHistory} Created version history
	 */
	enableVersioning (recordKey, policy) {
		if (this.histories.has(recordKey)) {
			return this.histories.get(recordKey);
		}

		const effectivePolicy = policy || this.globalPolicy;
		const history = new VersionHistory(recordKey, effectivePolicy);
		this.histories.set(recordKey, history);
		this.stats.totalHistories++;

		return history;
	}

	/**
	 * Disable versioning for a record
	 * @param {string} recordKey - Record key
	 * @returns {boolean} True if versioning was disabled
	 */
	disableVersioning (recordKey) {
		const history = this.histories.get(recordKey);
		if (!history) {
			return false;
		}

		this.stats.totalVersions -= history.getCount();
		this.stats.totalSize -= history.getTotalSize();
		this.stats.totalHistories--;

		return this.histories.delete(recordKey);
	}

	/**
	 * Add a version for a record
	 * @param {string} recordKey - Record key
	 * @param {Object} data - Version data
	 * @param {Object} [metadata={}] - Version metadata
	 * @returns {VersionEntry} Created version entry
	 * @throws {VersionError} If versioning is not enabled for record
	 */
	addVersion (recordKey, data, metadata = {}) {
		let history = this.histories.get(recordKey);
		if (!history) {
			// Auto-enable versioning with global policy
			history = this.enableVersioning(recordKey);
		}

		const oldCount = history.getCount();
		const oldSize = history.getTotalSize();

		const version = history.addVersion(data, metadata);

		// Update global stats
		this.stats.totalVersions += history.getCount() - oldCount;
		this.stats.totalSize += history.getTotalSize() - oldSize;

		return version;
	}

	/**
	 * Get version history for a record
	 * @param {string} recordKey - Record key
	 * @returns {VersionHistory|undefined} Version history
	 */
	getHistory (recordKey) {
		return this.histories.get(recordKey);
	}

	/**
	 * Get specific version of a record
	 * @param {string} recordKey - Record key
	 * @param {number} versionIndex - Version index
	 * @returns {VersionEntry|undefined} Version entry
	 */
	getVersion (recordKey, versionIndex) {
		const history = this.histories.get(recordKey);

		return history ? history.getVersion(versionIndex) : undefined;
	}

	/**
	 * Get latest version of a record
	 * @param {string} recordKey - Record key
	 * @returns {VersionEntry|undefined} Latest version
	 */
	getLatestVersion (recordKey) {
		const history = this.histories.get(recordKey);

		return history ? history.getLatest() : undefined;
	}

	/**
	 * Check if versioning is enabled for a record
	 * @param {string} recordKey - Record key
	 * @returns {boolean} True if versioning is enabled
	 */
	isVersioningEnabled (recordKey) {
		return this.histories.has(recordKey);
	}

	/**
	 * Clean up versions based on retention policies
	 * @param {Object} [options={}] - Cleanup options
	 * @param {boolean} [options.force=false] - Force cleanup even if not needed
	 * @param {string[]} [options.recordKeys] - Specific records to clean up
	 * @returns {Object} Cleanup results
	 */
	cleanup (options = {}) {
		const { force = false, recordKeys } = options;
		const results = {
			historiesProcessed: 0,
			versionsRemoved: 0,
			sizeFreed: 0,
			startTime: new Date()
		};

		const keysToProcess = recordKeys || Array.from(this.histories.keys());

		for (const recordKey of keysToProcess) {
			const history = this.histories.get(recordKey);
			if (!history) continue;

			const oldCount = history.getCount();
			const oldSize = history.getTotalSize();

			// Apply retention policy
			const removed = history._applyRetentionPolicy();

			const newCount = history.getCount();
			const newSize = history.getTotalSize();

			results.historiesProcessed++;
			results.versionsRemoved += oldCount - newCount;
			results.sizeFreed += oldSize - newSize;

			// Remove empty histories
			if (newCount === 0) {
				this.histories.delete(recordKey);
				this.stats.totalHistories--;
			}
		}

		// Update global stats
		this.stats.totalVersions -= results.versionsRemoved;
		this.stats.totalSize -= results.sizeFreed;
		this.stats.lastCleanup = new Date();
		this.stats.cleanupCount++;

		results.endTime = new Date();
		results.duration = results.endTime.getTime() - results.startTime.getTime();

		return results;
	}

	/**
	 * Set global retention policy
	 * @param {Object} policy - Retention policy
	 * @returns {VersionManager} This instance for chaining
	 */
	setGlobalPolicy (policy) {
		this.globalPolicy = this._validatePolicy(policy);

		return this;
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		// Recalculate stats from histories
		let totalVersions = 0;
		let totalSize = 0;
		const historyStats = [];

		for (const history of this.histories.values()) {
			const stats = history.getStats();
			historyStats.push(stats);
			totalVersions += stats.versionCount;
			totalSize += stats.totalSize;
		}

		return {
			...this.stats,
			totalHistories: this.histories.size,
			totalVersions,
			totalSize,
			averageVersionsPerRecord: this.histories.size > 0 ? totalVersions / this.histories.size : 0,
			averageSizePerRecord: this.histories.size > 0 ? totalSize / this.histories.size : 0,
			globalPolicy: this.globalPolicy,
			histories: historyStats
		};
	}

	/**
	 * Export version data for backup
	 * @param {string[]} [recordKeys] - Specific records to export
	 * @returns {Object} Exportable version data
	 */
	export (recordKeys) {
		const keysToExport = recordKeys || Array.from(this.histories.keys());
		const exportData = {
			globalPolicy: this.globalPolicy,
			histories: {},
			exportedAt: new Date().toISOString()
		};

		for (const recordKey of keysToExport) {
			const history = this.histories.get(recordKey);
			if (history) {
				exportData.histories[recordKey] = {
					policy: history.policy,
					versions: history.versions.map(v => v.toObject()),
					createdAt: history.createdAt.toISOString(),
					lastAccessed: history.lastAccessed.toISOString()
				};
			}
		}

		return exportData;
	}

	/**
	 * Import version data from backup
	 * @param {Object} exportData - Exported version data
	 * @param {Object} [options={}] - Import options
	 * @param {boolean} [options.merge=false] - Whether to merge with existing data
	 * @returns {Object} Import results
	 */
	import (exportData, options = {}) {
		const { merge = false } = options;
		const results = {
			historiesImported: 0,
			versionsImported: 0,
			errors: []
		};

		if (!merge) {
			this.histories.clear();
		}

		if (exportData.globalPolicy) {
			this.globalPolicy = this._validatePolicy(exportData.globalPolicy);
		}

		for (const [recordKey, historyData] of Object.entries(exportData.histories)) {
			try {
				const history = new VersionHistory(recordKey, historyData.policy);
				history.createdAt = new Date(historyData.createdAt);
				history.lastAccessed = new Date(historyData.lastAccessed);

				for (const versionData of historyData.versions) {
					const version = new VersionEntry(versionData.data, versionData.metadata);
					// Restore original timestamp
					Object.defineProperty(version, "timestamp", {
						value: new Date(versionData.timestamp),
						writable: false
					});
					history.versions.push(version);
					history.totalSize += version.size;
					results.versionsImported++;
				}

				this.histories.set(recordKey, history);
				results.historiesImported++;
			} catch (error) {
				results.errors.push({
					recordKey,
					error: error.message
				});
			}
		}

		// Update stats
		this._updateStats();

		return results;
	}

	/**
	 * Clear all version data
	 * @returns {Object} Clear results
	 */
	clear () {
		const results = {
			historiesCleared: this.histories.size,
			versionsCleared: this.stats.totalVersions,
			sizeFreed: this.stats.totalSize
		};

		this.histories.clear();
		this.stats = {
			totalHistories: 0,
			totalVersions: 0,
			totalSize: 0,
			lastCleanup: new Date(),
			cleanupCount: this.stats.cleanupCount
		};

		return results;
	}

	/**
	 * Validate retention policy
	 * @param {Object} policy - Policy to validate
	 * @returns {Object} Validated policy
	 * @throws {ConfigurationError} If policy is invalid
	 * @private
	 */
	_validatePolicy (policy) {
		if (!policy || typeof policy !== "object") {
			return { type: RetentionPolicies.NONE };
		}

		const validTypes = Object.values(RetentionPolicies);
		if (policy.type && !validTypes.includes(policy.type)) {
			throw new ConfigurationError(`Invalid retention policy type: ${policy.type}`, "retentionPolicy.type", policy.type);
		}

		const validated = { ...policy };

		if (validated.type === RetentionPolicies.COUNT && validated.maxCount !== undefined) {
			if (typeof validated.maxCount !== "number" || validated.maxCount < 1) {
				throw new ConfigurationError("maxCount must be a positive number", "retentionPolicy.maxCount", validated.maxCount);
			}
		}

		if (validated.type === RetentionPolicies.TIME && validated.maxAge !== undefined) {
			if (typeof validated.maxAge !== "number" || validated.maxAge < 1) {
				throw new ConfigurationError("maxAge must be a positive number", "retentionPolicy.maxAge", validated.maxAge);
			}
		}

		if (validated.type === RetentionPolicies.SIZE && validated.maxSize !== undefined) {
			if (typeof validated.maxSize !== "number" || validated.maxSize < 1) {
				throw new ConfigurationError("maxSize must be a positive number", "retentionPolicy.maxSize", validated.maxSize);
			}
		}

		return validated;
	}

	/**
	 * Update global statistics
	 * @private
	 */
	_updateStats () {
		let totalVersions = 0;
		let totalSize = 0;

		for (const history of this.histories.values()) {
			totalVersions += history.getCount();
			totalSize += history.getTotalSize();
		}

		this.stats.totalHistories = this.histories.size;
		this.stats.totalVersions = totalVersions;
		this.stats.totalSize = totalSize;
	}
}
