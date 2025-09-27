/**
 * Manages storage operations with Map-based storage
 */
export class StorageManager {
	/**
	 * @param {Object} config - Storage configuration
	 */
	constructor (config = {}) {
		this.config = {
			immutable: false,
			...config
		};

		// Always use Map - immutability handled at Record level
		this._store = new Map();
	}

	/**
	 * Get a record from storage
	 * @param {string} key - Record key
	 * @returns {Object|null} Record data or null
	 */
	get (key) {
		return this._store.get(key) || null;
	}

	/**
	 * Set a record in storage
	 * @param {string} key - Record key
	 * @param {Object} data - Record data
	 * @returns {boolean} Success status
	 */
	set (key, data) {
		this._store.set(key, data);

		return true;
	}

	/**
	 * Delete a record from storage
	 * @param {string} key - Record key
	 * @returns {boolean} Success status
	 */
	delete (key) {
		if (this.config.immutable) {
			this._store = this._store.delete(key);
		} else {
			this._store.delete(key);
		}

		return true;
	}

	/**
	 * Check if record exists in storage
	 * @param {string} key - Record key
	 * @returns {boolean} True if exists
	 */
	has (key) {
		return this._store.has(key);
	}

	/**
	 * Get all storage keys
	 * @returns {string[]} Array of keys
	 */
	keys () {
		if (this.config.immutable) {
			return this._store.keys();
		}

		return Array.from(this._store.keys());
	}

	/**
	 * Get all storage values
	 * @returns {IterableIterator<Object>} Iterable of values
	 */
	values () {
		return this._store.values();
	}

	/**
	 * Get all storage entries
	 * @returns {Array<[string, Object]>} Array of [key, value] pairs
	 */
	entries () {
		return Array.from(this._store.entries());
	}

	/**
	 * Get storage size
	 * @returns {number} Number of records
	 */
	get size () {
		return this._store.size;
	}

	/**
	 * Clear all storage
	 */
	clear () {
		this._store.clear();
	}

	/**
	 * Override storage with bulk data (maximum performance)
	 * @param {Array<[string, Object]>} data - Array of [key, value] pairs
	 * @returns {boolean} Success status
	 */
	override (data) {
		try {
			// Direct Map construction from 2D array
			this._store = new Map(data);

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get underlying store (for compatibility)
	 * @returns {Map} The underlying store
	 */
	getStore () {
		return this._store;
	}

	/**
	 * Estimate storage memory usage
	 * @returns {number} Estimated bytes
	 */
	estimateMemoryUsage () {
		let dataSize = 0;
		for (const [key, value] of this.entries()) {
			dataSize += JSON.stringify({ key, value }).length * 2; // UTF-16 estimate
		}

		return dataSize;
	}
}
