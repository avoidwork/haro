import { FieldConstraint } from "./field-constraint.js";
import { DataTypes } from "./data-types.js";

/**
 * Utility functions for creating common field constraints
 */
export const Constraints = {
	/**
	 * Create a required string field
	 * @param {Object} [options={}] - Additional constraint options
	 * @returns {FieldConstraint} String constraint
	 */
	requiredString(options = {}) {
		return new FieldConstraint({ type: DataTypes.STRING, required: true, ...options });
	},

	/**
	 * Create an optional string field
	 * @param {Object} [options={}] - Additional constraint options
	 * @returns {FieldConstraint} String constraint
	 */
	optionalString(options = {}) {
		return new FieldConstraint({ type: DataTypes.STRING, required: false, ...options });
	},

	/**
	 * Create a required number field
	 * @param {Object} [options={}] - Additional constraint options
	 * @returns {FieldConstraint} Number constraint
	 */
	requiredNumber(options = {}) {
		return new FieldConstraint({ type: DataTypes.NUMBER, required: true, ...options });
	},

	/**
	 * Create an optional number field
	 * @param {Object} [options={}] - Additional constraint options
	 * @returns {FieldConstraint} Number constraint
	 */
	optionalNumber(options = {}) {
		return new FieldConstraint({ type: DataTypes.NUMBER, required: false, ...options });
	},

	/**
	 * Create a UUID field
	 * @param {boolean} [required=true] - Whether field is required
	 * @returns {FieldConstraint} UUID constraint
	 */
	uuid(required = true) {
		return new FieldConstraint({ type: DataTypes.UUID, required });
	},

	/**
	 * Create an email field
	 * @param {boolean} [required=true] - Whether field is required
	 * @returns {FieldConstraint} Email constraint
	 */
	email(required = true) {
		return new FieldConstraint({ type: DataTypes.EMAIL, required });
	},

	/**
	 * Create an enum field
	 * @param {Array} values - Allowed values
	 * @param {boolean} [required=true] - Whether field is required
	 * @returns {FieldConstraint} Enum constraint
	 */
	enum(values, required = true) {
		return new FieldConstraint({ enum: values, required });
	},

	/**
	 * Create a date field
	 * @param {boolean} [required=true] - Whether field is required
	 * @returns {FieldConstraint} Date constraint
	 */
	date(required = true) {
		return new FieldConstraint({ type: DataTypes.DATE, required });
	}
};
