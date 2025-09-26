import { ValidationError, TypeConstraintError } from "./errors.js";
import { DataTypes, TypeDetector } from "./data-types.js";

/**
 * Field constraint definitions for individual field validation
 */
export class FieldConstraint {
	/**
	 * @param {Object} options - Constraint options
	 * @param {string} options.type - Data type requirement
	 * @param {boolean} [options.required=false] - Whether field is required
	 * @param {*} [options.default] - Default value if not provided
	 * @param {Function} [options.validator] - Custom validation function
	 * @param {*} [options.min] - Minimum value (for numbers/strings/arrays)
	 * @param {*} [options.max] - Maximum value (for numbers/strings/arrays)
	 * @param {Array} [options.enum] - Allowed values
	 * @param {RegExp} [options.pattern] - Pattern for string validation
	 */
	constructor({
		type = DataTypes.ANY,
		required = false,
		default: defaultValue,
		validator,
		min,
		max,
		enum: enumValues,
		pattern
	} = {}) {
		this.type = type;
		this.required = required;
		this.default = defaultValue;
		this.validator = validator;
		this.min = min;
		this.max = max;
		this.enum = enumValues;
		this.pattern = pattern;
	}

	/**
	 * Validate a value against this constraint
	 * @param {*} value - Value to validate
	 * @param {string} fieldName - Name of the field being validated
	 * @returns {*} Validated/normalized value
	 * @throws {ValidationError} If validation fails
	 */
	validate(value, fieldName = "field") {
		// Handle undefined values
		if (value === undefined || value === null) {
			if (this.required) {
				throw new ValidationError(`Field '${fieldName}' is required`, fieldName, value);
			}

			return this.default !== undefined ? this.default : value;
		}

		// Type validation
		const actualType = TypeDetector.getValueType(value);
		if (this.type !== DataTypes.ANY && !TypeDetector.isTypeMatch(actualType, this.type)) {
			throw new TypeConstraintError(
				`Field '${fieldName}' expected type '${this.type}' but got '${actualType}'`,
				this.type,
				actualType,
				fieldName
			);
		}

		// Range validation
		if (this.min !== undefined && value < this.min) {
			throw new ValidationError(`Field '${fieldName}' value ${value} is below minimum ${this.min}`, fieldName, value);
		}
		if (this.max !== undefined && value > this.max) {
			throw new ValidationError(`Field '${fieldName}' value ${value} exceeds maximum ${this.max}`, fieldName, value);
		}

		// Length validation for strings and arrays
		if ((typeof value === "string" || Array.isArray(value)) && value.length !== undefined) {
			if (this.min !== undefined && value.length < this.min) {
				throw new ValidationError(`Field '${fieldName}' length ${value.length} is below minimum ${this.min}`, fieldName, value);
			}
			if (this.max !== undefined && value.length > this.max) {
				throw new ValidationError(`Field '${fieldName}' length ${value.length} exceeds maximum ${this.max}`, fieldName, value);
			}
		}

		// Enum validation
		if (this.enum && !this.enum.includes(value)) {
			throw new ValidationError(`Field '${fieldName}' value '${value}' is not in allowed values: ${this.enum.join(", ")}`, fieldName, value);
		}

		// Pattern validation
		if (this.pattern && typeof value === "string" && !this.pattern.test(value)) {
			throw new ValidationError(`Field '${fieldName}' value '${value}' does not match required pattern`, fieldName, value);
		}

		// Custom validation
		if (this.validator && typeof this.validator === "function") {
			const customResult = this.validator(value, fieldName);
			if (customResult !== true && customResult !== undefined) {
				const message = typeof customResult === "string" ? customResult : `Custom validation failed for field '${fieldName}'`;
				throw new ValidationError(message, fieldName, value);
			}
		}

		return value;
	}
}
