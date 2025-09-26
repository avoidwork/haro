import { ValidationError, TypeConstraintError, ConfigurationError } from "./errors.js";

/**
 * Type definitions for validation
 */
export const DataTypes = {
	STRING: "string",
	NUMBER: "number",
	BOOLEAN: "boolean",
	OBJECT: "object",
	ARRAY: "array",
	DATE: "date",
	UUID: "uuid",
	EMAIL: "email",
	URL: "url",
	ANY: "any"
};

/**
 * Field constraint definitions
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
	constructor ({
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
	validate (value, fieldName = "field") {
		// Handle undefined values
		if (value === undefined || value === null) {
			if (this.required) {
				throw new ValidationError(`Field '${fieldName}' is required`, fieldName, value);
			}

			return this.default !== undefined ? this.default : value;
		}

		// Type validation
		const actualType = this._getValueType(value);
		if (this.type !== DataTypes.ANY && !this._isTypeMatch(actualType, this.type)) {
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

	/**
	 * Get the type of a value
	 * @param {*} value - Value to check
	 * @returns {string} Type string
	 * @private
	 */
	_getValueType (value) {
		if (value === null) return "null";
		if (Array.isArray(value)) return DataTypes.ARRAY;
		if (value instanceof Date) return DataTypes.DATE;

		const basicType = typeof value;

		// Special type detection
		if (basicType === "string") {
			if (this._isUUID(value)) return DataTypes.UUID;
			if (this._isEmail(value)) return DataTypes.EMAIL;
			if (this._isURL(value)) return DataTypes.URL;
		}

		return basicType;
	}

	/**
	 * Check if actual type matches expected type
	 * @param {string} actualType - Actual type
	 * @param {string} expectedType - Expected type
	 * @returns {boolean} True if types match
	 * @private
	 */
	_isTypeMatch (actualType, expectedType) {
		if (actualType === expectedType) return true;

		// Special cases
		if (expectedType === DataTypes.STRING) {
			return ["string", DataTypes.UUID, DataTypes.EMAIL, DataTypes.URL].includes(actualType);
		}

		return false;
	}

	/**
	 * Check if string is a UUID
	 * @param {string} value - String to check
	 * @returns {boolean} True if UUID format
	 * @private
	 */
	_isUUID (value) {
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

		return uuidRegex.test(value);
	}

	/**
	 * Check if string is an email
	 * @param {string} value - String to check
	 * @returns {boolean} True if email format
	 * @private
	 */
	_isEmail (value) {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

		return emailRegex.test(value);
	}

	/**
	 * Check if string is a URL
	 * @param {string} value - String to check
	 * @returns {boolean} True if URL format
	 * @private
	 */
	_isURL (value) {
		try {
			const url = new URL(value);

			return Boolean(url);
		} catch {
			return false;
		}
	}
}

/**
 * Schema definition for record validation
 */
export class Schema {
	/**
	 * @param {Object<string, FieldConstraint>} fields - Field constraints
	 * @param {Object} [options={}] - Schema options
	 * @param {boolean} [options.strict=false] - Whether to allow additional fields
	 * @param {boolean} [options.stripUnknown=false] - Whether to remove unknown fields
	 */
	constructor (fields = {}, { strict = false, stripUnknown = false } = {}) {
		this.fields = fields;
		this.strict = strict;
		this.stripUnknown = stripUnknown;
	}

	/**
	 * Validate a record against this schema
	 * @param {Object} record - Record to validate
	 * @returns {Object} Validated/normalized record
	 * @throws {ValidationError} If validation fails
	 */
	validate (record) {
		if (!record || typeof record !== "object") {
			throw new ValidationError("Record must be an object", "record", record);
		}

		const validated = {};
		const fieldNames = Object.keys(this.fields);
		const recordKeys = Object.keys(record);

		// Validate known fields
		for (const fieldName of fieldNames) {
			const constraint = this.fields[fieldName];
			const value = record[fieldName];
			validated[fieldName] = constraint.validate(value, fieldName);
		}

		// Handle unknown fields
		const unknownFields = recordKeys.filter(key => !fieldNames.includes(key));
		if (unknownFields.length > 0) {
			if (this.strict) {
				throw new ValidationError(`Unknown fields not allowed: ${unknownFields.join(", ")}`, "record", record);
			} else if (!this.stripUnknown) {
				// Copy unknown fields as-is
				for (const fieldName of unknownFields) {
					validated[fieldName] = record[fieldName];
				}
			}
		}

		return validated;
	}

	/**
	 * Add a field constraint to the schema
	 * @param {string} fieldName - Name of the field
	 * @param {FieldConstraint} constraint - Field constraint
	 * @returns {Schema} This schema for chaining
	 */
	addField (fieldName, constraint) {
		this.fields[fieldName] = constraint;

		return this;
	}

	/**
	 * Remove a field constraint from the schema
	 * @param {string} fieldName - Name of the field
	 * @returns {Schema} This schema for chaining
	 */
	removeField (fieldName) {
		delete this.fields[fieldName];

		return this;
	}
}

/**
 * Configuration validator for Haro options
 */
export class ConfigValidator {
	/**
	 * Validate Haro configuration
	 * @param {Object} config - Configuration to validate
	 * @returns {Object} Validated configuration
	 * @throws {ConfigurationError} If configuration is invalid
	 */
	static validate (config = {}) {
		const validated = { ...config };

		// Validate delimiter
		if (validated.delimiter !== undefined) {
			if (typeof validated.delimiter !== "string" || validated.delimiter.length === 0) {
				throw new ConfigurationError("Delimiter must be a non-empty string", "delimiter", validated.delimiter);
			}
		}

		// Validate id
		if (validated.id !== undefined && typeof validated.id !== "string") {
			throw new ConfigurationError("ID must be a string", "id", validated.id);
		}

		// Validate immutable
		if (validated.immutable !== undefined && typeof validated.immutable !== "boolean") {
			throw new ConfigurationError("Immutable must be a boolean", "immutable", validated.immutable);
		}

		// Validate index
		if (validated.index !== undefined) {
			if (!Array.isArray(validated.index)) {
				throw new ConfigurationError("Index must be an array", "index", validated.index);
			}
			for (const indexField of validated.index) {
				if (typeof indexField !== "string") {
					throw new ConfigurationError("Index field names must be strings", "index", indexField);
				}
			}
		}

		// Validate key
		if (validated.key !== undefined && typeof validated.key !== "string") {
			throw new ConfigurationError("Key field must be a string", "key", validated.key);
		}

		// Validate versioning
		if (validated.versioning !== undefined && typeof validated.versioning !== "boolean") {
			throw new ConfigurationError("Versioning must be a boolean", "versioning", validated.versioning);
		}

		// Validate schema
		if (validated.schema !== undefined && !(validated.schema instanceof Schema)) {
			throw new ConfigurationError("Schema must be an instance of Schema class", "schema", validated.schema);
		}

		return validated;
	}
}

/**
 * Utility functions for creating common field constraints
 */
export const Constraints = {
	/**
	 * Create a required string field
	 * @param {Object} [options={}] - Additional constraint options
	 * @returns {FieldConstraint} String constraint
	 */
	requiredString (options = {}) {
		return new FieldConstraint({ type: DataTypes.STRING, required: true, ...options });
	},

	/**
	 * Create an optional string field
	 * @param {Object} [options={}] - Additional constraint options
	 * @returns {FieldConstraint} String constraint
	 */
	optionalString (options = {}) {
		return new FieldConstraint({ type: DataTypes.STRING, required: false, ...options });
	},

	/**
	 * Create a required number field
	 * @param {Object} [options={}] - Additional constraint options
	 * @returns {FieldConstraint} Number constraint
	 */
	requiredNumber (options = {}) {
		return new FieldConstraint({ type: DataTypes.NUMBER, required: true, ...options });
	},

	/**
	 * Create an optional number field
	 * @param {Object} [options={}] - Additional constraint options
	 * @returns {FieldConstraint} Number constraint
	 */
	optionalNumber (options = {}) {
		return new FieldConstraint({ type: DataTypes.NUMBER, required: false, ...options });
	},

	/**
	 * Create a UUID field
	 * @param {boolean} [required=true] - Whether field is required
	 * @returns {FieldConstraint} UUID constraint
	 */
	uuid (required = true) {
		return new FieldConstraint({ type: DataTypes.UUID, required });
	},

	/**
	 * Create an email field
	 * @param {boolean} [required=true] - Whether field is required
	 * @returns {FieldConstraint} Email constraint
	 */
	email (required = true) {
		return new FieldConstraint({ type: DataTypes.EMAIL, required });
	},

	/**
	 * Create an enum field
	 * @param {Array} values - Allowed values
	 * @param {boolean} [required=true] - Whether field is required
	 * @returns {FieldConstraint} Enum constraint
	 */
	enum (values, required = true) {
		return new FieldConstraint({ enum: values, required });
	},

	/**
	 * Create a date field
	 * @param {boolean} [required=true] - Whether field is required
	 * @returns {FieldConstraint} Date constraint
	 */
	date (required = true) {
		return new FieldConstraint({ type: DataTypes.DATE, required });
	}
};
