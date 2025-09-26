/**
 * Deep immutability implementation with structural sharing
 */
export class ImmutableStore {
	/**
	 * @param {Map} [data] - Initial data
	 */
	constructor (data = new Map()) {
		this._data = new Map(data);
		this._frozenViews = new WeakMap();
		Object.freeze(this);
	}

	/**
	 * Get a deeply frozen view of the data
	 * @param {string} key - Record key
	 * @returns {Object|null} Frozen record or null
	 */
	get (key) {
		const record = this._data.get(key);
		if (!record) return null;

		// Check if we already have a frozen view
		if (this._frozenViews.has(record)) {
			return this._frozenViews.get(record);
		}

		// Create deeply frozen view
		const frozen = this._deepFreeze(structuredClone(record));
		this._frozenViews.set(record, frozen);

		return frozen;
	}

	/**
	 * Create new store with updated record (structural sharing)
	 * @param {string} key - Record key
	 * @param {Object} record - Record data
	 * @returns {ImmutableStore} New store instance
	 */
	set (key, record) {
		const newData = new Map(this._data);
		newData.set(key, record);

		return new ImmutableStore(newData);
	}

	/**
	 * Create new store without record
	 * @param {string} key - Record key to remove
	 * @returns {ImmutableStore} New store instance
	 */
	delete (key) {
		const newData = new Map(this._data);
		newData.delete(key);

		return new ImmutableStore(newData);
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
	 * Get store size
	 * @returns {number} Number of records
	 */
	get size () {
		return this._data.size;
	}

	/**
	 * Get all entries
	 * @returns {Array<[string, Object]>} Array of [key, value] pairs
	 */
	entries () {
		return Array.from(this._data.entries());
	}

	/**
	 * Deep freeze an object
	 * @param {*} obj - Object to freeze
	 * @returns {*} Frozen object
	 * @private
	 */
	_deepFreeze (obj) {
		if (obj === null || typeof obj !== "object") {
			return obj;
		}

		if (Array.isArray(obj)) {
			obj.forEach(item => this._deepFreeze(item));
		} else {
			Object.values(obj).forEach(value => this._deepFreeze(value));
		}

		return Object.freeze(obj);
	}
}
