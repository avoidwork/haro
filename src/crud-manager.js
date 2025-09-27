import { randomUUID as uuid } from "crypto";
import { RecordNotFoundError } from "./errors.js";
import { Record } from "./record.js";

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
	 * @param {boolean} [dependencies.freeze=false] - Whether to freeze Records
	 */
	constructor ({ storageManager, indexManager, versionManager = null, config, freeze = false }) {
		this.storageManager = storageManager;
		this.indexManager = indexManager;
		this.versionManager = versionManager;
		this.config = config;
		this.freeze = freeze;
	}

	/**
	 * Set or update a record with comprehensive validation and error handling
	 * @param {string|null} key - Record key or null for auto-generation
	 * @param {Object} [data={}] - Record data
	 * @param {Boolean} override - Overrides the record instead of merging
	 * @returns {Record} Created/updated record
	 */
	set (key, data = {}, override = false) {
		// Generate key if not provided
		if (key === null) {
			key = data[this.config.key] ?? uuid();
		}

		let recordData;
		if (data[this.config.key] === key) {
			recordData = data;
		} else {
			// Create new object only when necessary, but don't mutate original
			recordData = Object.assign({}, data, { [this.config.key]: key });
		}

		// Validate against schema if configured
		if (this.config.schema) {
			this.config.schema.validate(recordData);
		}

		const existingRecord = this.storageManager.get(key);
		let finalData = recordData;
		let metadata = {};

		// Extract existing data and metadata if record exists
		let existingData = null;
		if (existingRecord) {
			existingData = existingRecord.data;
			metadata = existingRecord.metadata;
		}

		// Handle merging vs override
		if (existingData && !override) {
			finalData = this._mergeRecords(existingData, recordData);
		}

		// Create the Record instance that will be stored
		const record = new Record(key, finalData, metadata, this.freeze);

		// Store version if versioning enabled
		if (this.versionManager && existingData) {
			this.versionManager.addVersion(key, existingData);
		}

		// Update indexes (indexes work with record data)
		if (existingData) {
			this.indexManager.removeRecord(key, existingData);
		}
		this.indexManager.addRecord(key, record.data);

		// Store the Record directly - no more data/metadata separation!
		this.storageManager.set(key, record);

		return record;
	}

	/**
	 * Get a record by key with consistent return format
	 * @param {string} key - Record key
	 * @returns {Record|null} Record instance or null if not found
	 */
	get (key) {
		const record = this.storageManager.get(key);

		if (!record) {
			return null;
		}

		// If no version manager, return the stored Record directly
		if (!this.versionManager) {
			return record;
		}

		// Only create new Record if we need to add version information
		const history = this.versionManager.getHistory(key);
		if (history) {
			const metadata = Object.assign({}, record.metadata, { versions: history.versions });

			return new Record(key, record.data, metadata, this.freeze);
		}

		return record;
	}

	/**
	 * Delete a record with proper cleanup
	 * @param {string} key - Record key
	 * @returns {boolean} True if deleted successfully
	 * @throws {RecordNotFoundError} If record not found
	 */
	delete (key) {
		if (!this.storageManager.has(key)) {
			throw new RecordNotFoundError(key, this.config.id);
		}

		const record = this.storageManager.get(key);

		// Remove from indexes (use record data)
		this.indexManager.removeRecord(key, record.data);

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
