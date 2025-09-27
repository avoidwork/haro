import { ValidationError } from "./errors.js";

/**
 * Manages lifecycle hooks and events
 */
export class LifecycleManager {
	/**
	 * @param {Object} [hooks={}] - Custom lifecycle hooks
	 */
	constructor (hooks = {}) {
		// Only store actually registered hooks, no default no-ops
		this.hooks = { ...hooks };
	}

	/**
	 * Register a lifecycle hook
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler
	 */
	registerHook (event, handler) {
		if (typeof handler !== "function") {
			throw new ValidationError(`Hook handler for '${event}' must be a function`, "handler", handler);
		}
		this.hooks[event] = handler;
	}

	/**
	 * Unregister a lifecycle hook
	 * @param {string} event - Event name
	 */
	unregisterHook (event) {
		delete this.hooks[event];
	}

	/**
	 * Check if a hook is registered
	 * @param {string} event - Event name
	 * @returns {boolean} True if hook exists
	 */
	hasActiveHook (event) {
		return event in this.hooks;
	}

	/**
	 * Execute a lifecycle hook
	 * @param {string} event - Event name
	 * @param {...*} args - Arguments to pass to hook
	 * @returns {*} Hook result
	 */
	executeHook (event, ...args) {
		if (this.hasActiveHook(event)) {
			return this.hooks[event](...args);
		}

		return undefined;
	}

	/**
	 * Before set hook
	 * @param {string} key - Record key
	 * @param {Object} data - Record data
	 * @param {Object} options - Operation options
	 */
	beforeSet (key, data, options) {
		return this.executeHook("beforeSet", key, data, options);
	}

	/**
	 * On set hook
	 * @param {Record} record - Created/updated record
	 * @param {Object} options - Operation options
	 */
	onset (record, options) {
		return this.executeHook("onset", record, options);
	}

	/**
	 * Before delete hook
	 * @param {string} key - Record key
	 * @param {boolean} batch - Is batch operation
	 */
	beforeDelete (key, batch) {
		return this.executeHook("beforeDelete", key, batch);
	}

	/**
	 * On delete hook
	 * @param {string} key - Deleted record key
	 */
	ondelete (key) {
		return this.executeHook("ondelete", key);
	}

	/**
	 * Before clear hook
	 */
	beforeClear () {
		return this.executeHook("beforeClear");
	}

	/**
	 * On clear hook
	 */
	onclear () {
		return this.executeHook("onclear");
	}

	/**
	 * On batch hook
	 * @param {Array} results - Batch operation results
	 * @param {string} type - Operation type
	 */
	onbatch (results, type) {
		return this.executeHook("onbatch", results, type);
	}

	/**
	 * Get all registered hooks
	 * @returns {Object} Hooks object
	 */
	getHooks () {
		return { ...this.hooks };
	}

	/**
	 * Check if hook is registered
	 * @param {string} event - Event name
	 * @returns {boolean} True if hook exists
	 */
	hasHook (event) {
		return event in this.hooks && typeof this.hooks[event] === "function";
	}

	/**
	 * Clear all hooks (reset to no-ops)
	 */
	clearHooks () {
		for (const event in this.hooks) {
			this.hooks[event] = () => {};
		}
	}
}
