import { randomUUID as uuid } from "crypto";
import { RecordNotFoundError } from "./errors.js";
import { RecordFactory } from "./record.js";

/**
 * Manages CRUD operations with validation and error handling
 */
export class CRUDManager {
	/**
	 * @param {Object} dependencies - Required dependencies
	 * @param {StorageManager} dependencies.storageManager - Storage manager
	 * @param {IndexManager} dependencies.indexManager - Index manager
	 * @param {VersionManager} [dependencies.versionManager] - Version manager
	 * @param {Object} dependencies.config - Configuration
	 */
	constructor ({ storageManager, indexManager, versionManager = null, config }) {
		this.storageManager = storageManager;
		this.indexManager = indexManager;
		this.versionManager = versionManager;
		this.config = config;
	}

	/**
	 * Set or update a record with comprehensive validation and error handling
	 * @param {string|null} key - Record key or null for auto-generation
	 * @param {Object} [data={}] - Record data
	 * @param {Object} [options={}] - Operation options
	 * @returns {Record} Created/updated record
	 */
	set (key, data = {}, options = {}) {
		const {
			override = false,
			validate = true
		} = options;

		// Generate key if not provided
		if (key === null) {
			key = data[this.config.key] ?? uuid();
		}

		// OPTIMIZATION: Only create new object when key needs to be added
		let recordData;
		if (data[this.config.key] === key) {
			recordData = data;
		} else {
			// Create new object only when necessary, but don't mutate original
			recordData = { ...data, [this.config.key]: key };
		}

		// Validate against schema if configured
		if (validate && this.config.schema) {
			this.config.schema.validate(recordData);
		}

		// OPTIMIZATION: Single storage lookup instead of has() + get()
		const existingRecord = this.storageManager.get(key);
		let finalData = recordData;

		// Handle merging vs override
		if (existingRecord && !override) {
			finalData = this._mergeRecords(existingRecord, recordData);
		}

		// Store version if versioning enabled
		if (this.versionManager && existingRecord) {
			this.versionManager.addVersion(key, existingRecord);
		}

		// Update indexes
		if (existingRecord) {
			this.indexManager.removeRecord(key, existingRecord);
		}
		this.indexManager.addRecord(key, finalData);

		// Store record
		this.storageManager.set(key, finalData);

		// OPTIMIZATION: Create record wrapper without expensive metadata by default
		const record = RecordFactory.create(key, finalData, {}, false);

		return record;
	}

	/**
	 * Get a record by key with consistent return format
	 * @param {string} key - Record key
	 * @param {Object} [options={}] - Get options
	 * @returns {Record|null} Record instance or null if not found
	 */
	get (key, options = {}) {
		const { includeVersions = false } = options;

		const recordData = this.storageManager.get(key);

		if (!recordData) {
			return null;
		}

		// Optimized: only create full Record with metadata if versioning is requested
		if (includeVersions && this.versionManager) {
			const history = this.versionManager.getHistory(key);
			if (history) {
				const metadata = { versions: history.versions };

				return RecordFactory.create(key, recordData, metadata);
			}
		}

		// Default: create Record without expensive metadata operations
		return RecordFactory.create(key, recordData);
	}

	/**
	 * Delete a record with proper cleanup
	 * @param {string} key - Record key
	 * @param {Object} [options={}] - Delete options
	 * @returns {boolean} True if deleted successfully
	 * @throws {RecordNotFoundError} If record not found
	 */
	delete (key) {
		if (!this.storageManager.has(key)) {
			throw new RecordNotFoundError(key, this.config.id);
		}

		const recordData = this.storageManager.get(key);

		// Remove from indexes
		this.indexManager.removeRecord(key, recordData);

		// Remove from store
		this.storageManager.delete(key);

		// Cleanup versions
		if (this.versionManager) {
			this.versionManager.disableVersioning(key);
		}

		return true;
	}

	/**
	 * Check if record exists
	 * @param {string} key - Record key
	 * @returns {boolean} True if record exists
	 */
	has (key) {
		return this.storageManager.has(key);
	}

	/**
	 * Merge two records
	 * @param {Object} existing - Existing record
	 * @param {Object} updates - Updates to apply
	 * @returns {Object} Merged record
	 * @private
	 */
	_mergeRecords (existing, updates) {
		if (Array.isArray(existing) && Array.isArray(updates)) {
			return [...existing, ...updates];
		}

		if (typeof existing === "object" && typeof updates === "object") {
			const merged = { ...existing };
			for (const [key, value] of Object.entries(updates)) {
				if (typeof value === "object" && value !== null && !Array.isArray(value) &&
					typeof existing[key] === "object" && existing[key] !== null && !Array.isArray(existing[key])) {
					merged[key] = this._mergeRecords(existing[key], value);
				} else {
					merged[key] = value;
				}
			}

			return merged;
		}

		return updates;
	}
}
