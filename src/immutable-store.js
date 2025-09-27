/**
 * Deep immutability implementation with structural sharing
 */
export class ImmutableStore {
	/**
	 * @param {Map} [data] - Initial data
	 */
	constructor (data = new Map()) {
		this._data = new Map();
		// Freeze all initial data
		for (const [key, value] of data) {
			this._data.set(key, this._deepFreeze(value));
		}
		Object.freeze(this);
	}

	/**
	 * Get a frozen record
	 * @param {string} key - Record key
	 * @returns {Object|null} Frozen record or null
	 */
	get (key) {
		return this._data.get(key) || null;
	}

	/**
	 * Update record in store
	 * @param {string} key - Record key
	 * @param {Object} record - Record data
	 * @returns {ImmutableStore} This store instance
	 */
	set (key, record) {
		// Early return if setting same value
		if (this._data.get(key) === record) {
			return this;
		}

		this._data.set(key, this._deepFreeze(record));

		return this;
	}

	/**
	 * Remove record from store
	 * @param {string} key - Record key to remove
	 * @returns {ImmutableStore} This store instance
	 */
	delete (key) {
		// Early return if key doesn't exist
		if (!this._data.has(key)) {
			return this;
		}

		this._data.delete(key);

		return this;
	}

	/**
	 * Check if record exists
	 * @param {string} key - Record key
	 * @returns {boolean} True if exists
	 */
	has (key) {
		return this._data.has(key);
	}

	/**
	 * Get all keys
	 * @returns {string[]} Array of keys
	 */
	keys () {
		return Array.from(this._data.keys());
	}

	/**
	 * Get all values as frozen objects
	 * @returns {IterableIterator<Object>} Iterator of frozen values
	 */
	values () {
		return this._data.values();
	}

	/**
	 * Get store size
	 * @returns {number} Number of records
	 */
	get size () {
		return this._data.size;
	}

	/**
	 * Get all entries
	 * @returns {IterableIterator<[string, Object]>} Iterator of [key, value] pairs
	 */
	entries () {
		return this._data.entries();
	}

	/**
	 * Deep freeze an object (iterative implementation)
	 * @param {*} obj - Object to freeze
	 * @returns {*} Frozen object
	 * @private
	 */
	_deepFreeze (obj) {
		if (obj === null || typeof obj !== "object" || Object.isFrozen(obj)) {
			return obj;
		}

		const stack = [obj];
		const visited = new WeakSet();

		while (stack.length > 0) {
			const current = stack.pop();

			if (!visited.has(current) && !Object.isFrozen(current)) {
				visited.add(current);

				if (Array.isArray(current)) {
					for (const item of current) {
						if (item !== null && typeof item === "object" && !Object.isFrozen(item)) {
							stack.push(item);
						}
					}
				} else {
					for (const value of Object.values(current)) {
						if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
							stack.push(value);
						}
					}
				}

				Object.freeze(current);
			}
		}

		return obj;
	}
}
