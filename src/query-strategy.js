import { STRING_DOUBLE_AND } from "./constants.js";

/**
 * Low-level value matcher for predicate matching.
 * @class
 */
export class ValueMatcher {
	/**
	 * Matches a single value against a predicate.
	 * @param {*} val - Value to test
	 * @param {*} pred - Predicate value or RegExp
	 * @returns {boolean} Whether value matches predicate
	 */
	static match(val, pred) {
		if (pred instanceof RegExp) return pred.test(val);
		if (val instanceof RegExp) return val.test(pred);
		return val === pred;
	}
}

/**
 * Predicate strategy for matching records against field predicates.
 * Supports AND (every) and OR (some) logic for array predicates.
 * @class
 */
export class PredicateStrategy {
	/**
	 * Creates a predicate strategy.
	 * @param {string} op - Operator: '||' (OR) or '&&' (AND)
	 */
	constructor(op) {
		this.op = op;
	}

	/**
	 * Factory method to create a strategy instance.
	 * @param {string} op - Operator: '||' (OR) or '&&' (AND)
	 * @returns {PredicateStrategy}
	 */
	static of(op) {
		return new PredicateStrategy(op);
	}

	/**
	 * Checks if a record matches a predicate object.
	 * @param {Object} record - Record to test
	 * @param {Object} predicate - Field-value predicate map
	 * @param {Function} getNestedValue - Function to retrieve nested values (record, path) => value
	 * @returns {boolean} Whether record matches all predicate fields
	 */
	matches(record, predicate, getNestedValue) {
		return Object.keys(predicate).every((key) => {
			return this.#matchField(record, key, predicate[key], getNestedValue);
		});
	}

	/**
	 * Matches a single field's predicate against a record value.
	 * @param {Object} record - Record containing the value
	 * @param {string} key - Field path
	 * @param {*} pred - Predicate for the field (value, array of values, or RegExp)
	 * @param {Function} getNestedValue - Function to retrieve nested values
	 * @returns {boolean} Whether the field matches the predicate
	 */
	#matchField(record, key, pred, getNestedValue) {
		const val = getNestedValue(record, key);

		// Array predicate matching against record value
		if (Array.isArray(pred)) {
			if (Array.isArray(val)) {
				return this.#matchArrayPred(pred, (p) => val.includes(p));
			}
			return this.#matchArrayPred(pred, (p) => val === p);
		}

		// Record field is an array, check if any element matches
		if (Array.isArray(val)) {
			return val.some((v) => ValueMatcher.match(v, pred));
		}

		return ValueMatcher.match(val, pred);
	}

	/**
	 * Applies the strategy's operator to an array of predicates.
	 * @param {Array} preds - Array of predicates
	 * @param {Function} fn - Matcher function (pred) => boolean
	 * @returns {boolean} Result of AND/OR evaluation
	 */
	#matchArrayPred(preds, fn) {
		return this.op === STRING_DOUBLE_AND ? preds.every(fn) : preds.some(fn);
	}
}
