/**
 * haro
 *
 * @copyright 2025 Jason Mulligan <jason.mulligan@avoidwork.com>
 * @license BSD-3-Clause
 * @version 17.0.0
 */
(function(g,f){typeof exports==='object'&&typeof module!=='undefined'?f(exports,require('crypto')):typeof define==='function'&&define.amd?define(['exports','crypto'],f):(g=typeof globalThis!=='undefined'?globalThis:g||self,f(g.haro={},g.crypto));})(this,(function(exports,crypto){'use strict';/**
 * Base error class for all Haro errors
 */
class HaroError extends Error {
	/**
	 * @param {string} message - Error message
	 * @param {string} [code] - Error code for programmatic handling
	 * @param {*} [context] - Additional context about the error
	 */
	constructor (message, code, context) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
		this.context = context;
		this.timestamp = new Date().toISOString();

		// Ensure proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Convert error to JSON for serialization
	 * @returns {Object} Serializable error object
	 */
	toJSON () {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			context: this.context,
			timestamp: this.timestamp,
			stack: this.stack
		};
	}
}

/**
 * Validation errors for invalid data or configuration
 */
class ValidationError extends HaroError {
	constructor (message, field, value) {
		super(message, "VALIDATION_ERROR", { field, value });
	}
}

/**
 * Record not found errors
 */
class RecordNotFoundError extends HaroError {
	constructor (key, storeName) {
		super(`Record with key '${key}' not found${storeName ? ` in store '${storeName}'` : ""}`, "RECORD_NOT_FOUND", { key, storeName });
	}
}

/**
 * Index-related errors
 */
class IndexError extends HaroError {
	constructor (message, indexName, operation) {
		super(message, "INDEX_ERROR", { indexName, operation });
	}
}

/**
 * Configuration errors
 */
class ConfigurationError extends HaroError {
	constructor (message, configKey, configValue) {
		super(message, "CONFIGURATION_ERROR", { configKey, configValue });
	}
}

/**
 * Query errors for invalid queries or operations
 */
class QueryError extends HaroError {
	constructor (message, query, operation) {
		super(message, "QUERY_ERROR", { query, operation });
	}
}

/**
 * Transaction errors
 */
class TransactionError extends HaroError {
	constructor (message, transactionId, operation) {
		super(message, "TRANSACTION_ERROR", { transactionId, operation });
	}
}

/**
 * Type constraint errors
 */
class TypeConstraintError extends HaroError {
	constructor (message, expected, actual, field) {
		super(message, "TYPE_CONSTRAINT_ERROR", { expected, actual, field });
	}
}

/**
 * Concurrency errors for multi-threaded access
 */
class ConcurrencyError extends HaroError {
	constructor (message, resource, operation) {
		super(message, "CONCURRENCY_ERROR", { resource, operation });
	}
}

/**
 * Error recovery utilities
 */
class ErrorRecovery {
	/**
	 * Determine if an error is recoverable
	 * @param {Error} error - Error to analyze
	 * @returns {boolean} True if error is recoverable
	 */
	static isRecoverable (error) {
		if (!(error instanceof HaroError)) {
			return false;
		}

		const recoverableCodes = [
			"RECORD_NOT_FOUND",
			"VALIDATION_ERROR",
			"QUERY_ERROR",
			"TYPE_CONSTRAINT_ERROR"
		];

		return recoverableCodes.includes(error.code);
	}

	/**
	 * Get suggested recovery actions for an error
	 * @param {HaroError} error - Error to get recovery actions for
	 * @returns {string[]} Array of suggested recovery actions
	 */
	static getRecoveryActions (error) {
		if (!(error instanceof HaroError)) {
			return ["Check error details and retry"];
		}

		switch (error.code) {
			case "RECORD_NOT_FOUND":
				return [
					"Verify the record key is correct",
					"Check if record was deleted",
					"Use has() method to check existence before get()"
				];

			case "VALIDATION_ERROR":
				return [
					"Check data types match expected schema",
					"Verify required fields are present",
					"Validate field constraints"
				];

			case "INDEX_ERROR":
				return [
					"Verify index exists before querying",
					"Check index configuration",
					"Try reindexing the affected field"
				];

			case "CONFIGURATION_ERROR":
				return [
					"Review configuration parameters",
					"Check for typos in configuration keys",
					"Refer to documentation for valid options"
				];

			case "QUERY_ERROR":
				return [
					"Verify query syntax is correct",
					"Check if indexed fields are being used",
					"Simplify complex queries"
				];

			case "TRANSACTION_ERROR":
				return [
					"Retry the transaction",
					"Check for concurrent modifications",
					"Reduce transaction scope"
				];

			case "TYPE_CONSTRAINT_ERROR":
				return [
					"Check data types match schema",
					"Convert data to expected type",
					"Update type constraints if needed"
				];

			default:
				return ["Check error details and retry"];
		}
	}

	/**
	 * Create a recovery strategy for an error
	 * @param {HaroError} error - Error to create strategy for
	 * @returns {Object} Recovery strategy object
	 */
	static createRecoveryStrategy (error) {
		return {
			error,
			isRecoverable: this.isRecoverable(error),
			actions: this.getRecoveryActions(error),
			retryable: ["CONCURRENCY_ERROR", "TRANSACTION_ERROR"].includes(error.code),
			backoffMs: error.code === "CONCURRENCY_ERROR" ? 100 : 0
		};
	}
}/**
 * Data type definitions and type detection utilities
 */

/**
 * Type definitions for validation
 */
const DataTypes = {
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
 * Type detection utilities
 */
class TypeDetector {
	/**
	 * Get the type of a value
	 * @param {*} value - Value to check
	 * @returns {string} Type string
	 */
	static getValueType (value) {
		if (value === null) return "null";
		if (Array.isArray(value)) return DataTypes.ARRAY;
		if (value instanceof Date) return DataTypes.DATE;

		const basicType = typeof value;

		// Special type detection
		if (basicType === "string") {
			if (TypeDetector.isUUID(value)) return DataTypes.UUID;
			if (TypeDetector.isEmail(value)) return DataTypes.EMAIL;
			if (TypeDetector.isURL(value)) return DataTypes.URL;
		}

		return basicType;
	}

	/**
	 * Check if actual type matches expected type
	 * @param {string} actualType - Actual type
	 * @param {string} expectedType - Expected type
	 * @returns {boolean} True if types match
	 */
	static isTypeMatch (actualType, expectedType) {
		if (actualType === expectedType) return true;

		// Special cases
		if (expectedType === DataTypes.STRING) {
			return ["string", DataTypes.UUID, DataTypes.EMAIL, DataTypes.URL].includes(actualType);
		}

		return false;
	}

	/**
	 * Check if string is a RFC 4122 compliant UUID (versions 1-5)
	 * @param {string} value - String to check
	 * @returns {boolean} True if valid RFC 4122 UUID format (versions 1, 2, 3, 4, or 5)
	 */
	static isUUID (value) {
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

		return uuidRegex.test(value);
	}

	/**
	 * Check if string is an email
	 * @param {string} value - String to check
	 * @returns {boolean} True if email format
	 */
	static isEmail (value) {
		// WHATWG HTML5 compliant email validation pattern
		const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

		return emailRegex.test(value);
	}

	/**
	 * Check if string is a URL
	 * @param {string} value - String to check
	 * @returns {boolean} True if URL format
	 */
	static isURL (value) {
		try {
			const url = new URL(value);

			return Boolean(url);
		} catch {
			return false;
		}
	}
}/**
 * Field constraint definitions for individual field validation
 */
class FieldConstraint {
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
}/**
 * Schema definition for record validation
 */
class Schema {
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
		if (!record || typeof record !== "object" || Array.isArray(record)) {
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
}/**
 * Configuration validator for Haro options
 */
class ConfigValidator {
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
}/**
 * Utility functions for creating common field constraints
 */
const Constraints = {
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
};// Common values

// Transaction states
const TRANSACTION_STATE_PENDING = "pending";
const TRANSACTION_STATE_ACTIVE = "active";
const TRANSACTION_STATE_COMMITTED = "committed";
const TRANSACTION_STATE_ABORTED = "aborted";

// Lock types
const LOCK_TYPE_SHARED = "shared";
const LOCK_TYPE_EXCLUSIVE = "exclusive";

// Isolation levels
const ISOLATION_READ_UNCOMMITTED = 0;
const ISOLATION_READ_COMMITTED = 1;
const ISOLATION_REPEATABLE_READ = 2;
const ISOLATION_SERIALIZABLE = 3;

// Operation types for transaction log
const OPERATION_TYPE_SET = "set";
const OPERATION_TYPE_DELETE = "delete";

// Object wrappers for backward compatibility
const TransactionStates = {
	PENDING: TRANSACTION_STATE_PENDING,
	ACTIVE: TRANSACTION_STATE_ACTIVE,
	COMMITTED: TRANSACTION_STATE_COMMITTED,
	ABORTED: TRANSACTION_STATE_ABORTED
};

const OperationTypes = {
	SET: OPERATION_TYPE_SET,
	DELETE: OPERATION_TYPE_DELETE};

const IsolationLevels = {
	READ_UNCOMMITTED: ISOLATION_READ_UNCOMMITTED,
	READ_COMMITTED: ISOLATION_READ_COMMITTED,
	REPEATABLE_READ: ISOLATION_REPEATABLE_READ,
	SERIALIZABLE: ISOLATION_SERIALIZABLE
};

const LockTypes = {
	SHARED: LOCK_TYPE_SHARED,
	EXCLUSIVE: LOCK_TYPE_EXCLUSIVE
};/**
 * Standardized record wrapper that provides consistent interface
 */
class Record {
	/**
	 * @param {string} key - Record key
	 * @param {Object} data - Record data
	 * @param {Object} [metadata={}] - Additional metadata
	 */
	constructor (key, data, metadata = {}) {
		this._key = key;
		this._data = data;
		this._metadata = {
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			version: 1,
			...metadata
		};

		// Make the record immutable to prevent accidental modifications
		Object.freeze(this);
	}

	/**
	 * Get the record key
	 * @returns {string} Record key
	 */
	get key () {
		return this._key;
	}

	/**
	 * Get the record data
	 * @returns {Object} Record data (frozen copy)
	 */
	get data () {
		return Object.freeze({ ...this._data });
	}

	/**
	 * Get record metadata
	 * @returns {Object} Metadata object
	 */
	get metadata () {
		return Object.freeze({ ...this._metadata });
	}

	/**
	 * Get a specific field value
	 * @param {string} fieldName - Name of the field
	 * @returns {*} Field value
	 */
	get (fieldName) {
		return this._data[fieldName];
	}

	/**
	 * Check if record has a specific field
	 * @param {string} fieldName - Name of the field
	 * @returns {boolean} True if field exists
	 */
	has (fieldName) {
		return fieldName in this._data;
	}

	/**
	 * Get all field names
	 * @returns {string[]} Array of field names
	 */
	getFields () {
		return Object.keys(this._data);
	}

	/**
	 * Create a new record with updated data (immutable update)
	 * @param {Object} updates - Data updates to apply
	 * @param {Object} [metadataUpdates={}] - Metadata updates
	 * @returns {Record} New record instance with updates
	 */
	update (updates, metadataUpdates = {}) {
		const newData = { ...this._data, ...updates };
		const newMetadata = {
			...this._metadata,
			...metadataUpdates,
			updatedAt: new Date().toISOString(),
			version: this._metadata.version + 1
		};

		return new Record(this._key, newData, newMetadata);
	}

	/**
	 * Convert record to plain object
	 * @param {boolean} [includeMetadata=false] - Whether to include metadata
	 * @returns {Object} Plain object representation
	 */
	toObject (includeMetadata = false) {
		const result = { ...this._data };

		if (includeMetadata) {
			result._metadata = this._metadata;
		}

		return result;
	}

	/**
	 * Convert record to JSON string
	 * @param {boolean} [includeMetadata=false] - Whether to include metadata
	 * @returns {string} JSON string representation
	 */
	toJSON (includeMetadata = false) {
		return JSON.stringify(this.toObject(includeMetadata));
	}

	/**
	 * Compare this record with another record
	 * @param {Record} other - Other record to compare
	 * @returns {boolean} True if records are equal
	 */
	equals (other) {
		if (!(other instanceof Record)) return false;
		if (this._key !== other._key) return false;

		return JSON.stringify(this._data) === JSON.stringify(other._data);
	}

	/**
	 * Create a deep clone of this record
	 * @returns {Record} Cloned record
	 */
	clone () {
		return new Record(this._key, structuredClone(this._data), structuredClone(this._metadata));
	}

	/**
	 * Get the size of the record data (for memory analysis)
	 * @returns {number} Estimated size in bytes
	 */
	getSize () {
		return JSON.stringify(this._data).length * 2; // Rough estimate (UTF-16)
	}

	/**
	 * Check if record matches a predicate
	 * @param {Function|Object} predicate - Function or object to match against
	 * @returns {boolean} True if record matches
	 */
	matches (predicate) {
		if (typeof predicate === "function") {
			return predicate(this._data, this._key, this);
		}

		if (typeof predicate === "object" && predicate !== null) {
			return Object.entries(predicate).every(([field, value]) => {
				const recordValue = this._data[field];

				if (value instanceof RegExp) {
					return value.test(recordValue);
				}

				if (Array.isArray(value)) {
					return Array.isArray(recordValue) ?
						value.some(v => recordValue.includes(v)) :
						value.includes(recordValue);
				}

				return recordValue === value;
			});
		}

		return false;
	}

	/**
	 * Get a string representation of the record
	 * @returns {string} String representation
	 */
	toString () {
		return `Record(${this._key}: ${JSON.stringify(this._data)})`;
	}

	/**
	 * Symbol for iteration (makes record iterable)
	 * @returns {Iterator} Iterator over [fieldName, value] pairs
	 */
	* [Symbol.iterator] () {
		for (const [field, value] of Object.entries(this._data)) {
			yield [field, value];
		}
	}
}

/**
 * Collection of records with utilities for batch operations
 */
class RecordCollection {
	/**
	 * @param {Record[]} [records=[]] - Initial records
	 */
	constructor (records = []) {
		this._records = [...records];
		Object.freeze(this);
	}

	/**
	 * Get the number of records
	 * @returns {number} Number of records
	 */
	get length () {
		return this._records.length;
	}

	/**
	 * Get record at specific index
	 * @param {number} index - Index to retrieve
	 * @returns {Record|undefined} Record at index
	 */
	at (index) {
		return this._records[index];
	}

	/**
	 * Get first record
	 * @returns {Record|undefined} First record
	 */
	first () {
		return this._records[0];
	}

	/**
	 * Get last record
	 * @returns {Record|undefined} Last record
	 */
	last () {
		return this._records[this._records.length - 1];
	}

	/**
	 * Filter records by predicate
	 * @param {Function} predicate - Filter function
	 * @returns {RecordCollection} New collection with filtered records
	 */
	filter (predicate) {
		return new RecordCollection(this._records.filter(predicate));
	}

	/**
	 * Map records to new values
	 * @param {Function} mapper - Mapping function
	 * @returns {Array} Array of mapped values
	 */
	map (mapper) {
		return this._records.map(mapper);
	}

	/**
	 * Find first record matching predicate
	 * @param {Function} predicate - Search predicate
	 * @returns {Record|undefined} First matching record
	 */
	find (predicate) {
		return this._records.find(predicate);
	}

	/**
	 * Check if any record matches predicate
	 * @param {Function} predicate - Test predicate
	 * @returns {boolean} True if any record matches
	 */
	some (predicate) {
		return this._records.some(predicate);
	}

	/**
	 * Check if all records match predicate
	 * @param {Function} predicate - Test predicate
	 * @returns {boolean} True if all records match
	 */
	every (predicate) {
		return this._records.every(predicate);
	}

	/**
	 * Sort records by comparator
	 * @param {Function} comparator - Sort function
	 * @returns {RecordCollection} New sorted collection
	 */
	sort (comparator) {
		return new RecordCollection([...this._records].sort(comparator));
	}

	/**
	 * Get a slice of records
	 * @param {number} [start=0] - Start index
	 * @param {number} [end] - End index
	 * @returns {RecordCollection} New collection with sliced records
	 */
	slice (start = 0, end) {
		return new RecordCollection(this._records.slice(start, end));
	}

	/**
	 * Reduce records to a single value
	 * @param {Function} reducer - Reducer function
	 * @param {*} [initialValue] - Initial value
	 * @returns {*} Reduced value
	 */
	reduce (reducer, initialValue) {
		return this._records.reduce(reducer, initialValue);
	}

	/**
	 * Convert to array of records
	 * @returns {Record[]} Array of records
	 */
	toArray () {
		return [...this._records];
	}

	/**
	 * Convert to array of plain objects
	 * @param {boolean} [includeMetadata=false] - Whether to include metadata
	 * @returns {Object[]} Array of plain objects
	 */
	toObjects (includeMetadata = false) {
		return this._records.map(record => record.toObject(includeMetadata));
	}

	/**
	 * Get records as key-value pairs
	 * @returns {Array<[string, Object]>} Array of [key, data] pairs
	 */
	toPairs () {
		return this._records.map(record => [record.key, record.data]);
	}

	/**
	 * Group records by field value
	 * @param {string|Function} keySelector - Field name or function to get grouping key
	 * @returns {Map<string, RecordCollection>} Map of grouped records
	 */
	groupBy (keySelector) {
		const groups = new Map();
		const getKey = typeof keySelector === "function" ?
			keySelector :
			record => record.get(keySelector);

		for (const record of this._records) {
			const key = getKey(record);
			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key).push(record);
		}

		// Convert arrays to RecordCollections
		for (const [key, records] of groups) {
			groups.set(key, new RecordCollection(records));
		}

		return groups;
	}

	/**
	 * Get unique records (by key)
	 * @returns {RecordCollection} Collection with unique records
	 */
	unique () {
		const seen = new Set();
		const unique = [];

		for (const record of this._records) {
			if (!seen.has(record.key)) {
				seen.add(record.key);
				unique.push(record);
			}
		}

		return new RecordCollection(unique);
	}

	/**
	 * Iterate over records
	 * @param {Function} callback - Callback function
	 * @returns {void}
	 */
	forEach (callback) {
		this._records.forEach(callback);
	}

	/**
	 * Symbol for iteration (makes collection iterable)
	 * @returns {Iterator} Iterator over records
	 */
	* [Symbol.iterator] () {
		for (const record of this._records) {
			yield record;
		}
	}

	/**
	 * Get string representation
	 * @returns {string} String representation
	 */
	toString () {
		return `RecordCollection(${this._records.length} records)`;
	}
}

/**
 * Factory functions for creating records and collections
 */
const RecordFactory = {
	/**
	 * Create a record from raw data
	 * @param {string} key - Record key
	 * @param {Object} data - Record data
	 * @param {Object} [metadata={}] - Additional metadata
	 * @returns {Record} New record instance
	 */
	create (key, data, metadata = {}) {
		return new Record(key, data, metadata);
	},

	/**
	 * Create a record from a plain object (key extracted from data)
	 * @param {Object} data - Data object containing key field
	 * @param {string} [keyField='id'] - Name of the key field
	 * @param {Object} [metadata={}] - Additional metadata
	 * @returns {Record} New record instance
	 */
	fromObject (data, keyField = "id", metadata = {}) {
		const key = data[keyField];
		if (!key) {
			throw new Error(`Key field '${keyField}' not found in data`);
		}

		return new Record(key, data, metadata);
	},

	/**
	 * Create a collection from an array of records or data objects
	 * @param {Array<Record|Object>} items - Items to create collection from
	 * @param {string} [keyField='id'] - Key field name for objects
	 * @returns {RecordCollection} New record collection
	 */
	createCollection (items, keyField = "id") {
		const records = items.map(item => {
			if (item instanceof Record) {
				return item;
			}

			return this.fromObject(item, keyField);
		});

		return new RecordCollection(records);
	},

	/**
	 * Create an empty collection
	 * @returns {RecordCollection} Empty record collection
	 */
	emptyCollection () {
		return new RecordCollection();
	}
};/**
 * Types of indexes supported
 */
const IndexTypes = {
	SINGLE: "single",
	COMPOSITE: "composite",
	ARRAY: "array",
	PARTIAL: "partial"
};

/**
 * Index definition with metadata
 */
class IndexDefinition {
	/**
	 * @param {string} name - Index name
	 * @param {string[]} fields - Field names to index
	 * @param {Object} [options={}] - Index options
	 * @param {string} [options.type=IndexTypes.SINGLE] - Index type
	 * @param {boolean} [options.unique=false] - Whether values should be unique
	 * @param {Function} [options.filter] - Filter function for partial indexes
	 * @param {Function} [options.transform] - Transform function for index values
	 * @param {string} [options.delimiter='|'] - Delimiter for composite indexes
	 */
	constructor (name, fields, {
		type = IndexTypes.SINGLE,
		unique = false,
		filter,
		transform,
		delimiter = "|"
	} = {}) {
		this.name = name;
		this.fields = Array.isArray(fields) ? fields : [fields];
		this.type = this._determineType(this.fields, type);
		this.unique = unique;
		this.filter = filter;
		this.transform = transform;
		this.delimiter = delimiter;
		this.createdAt = new Date();
		this.stats = {
			totalKeys: 0,
			totalEntries: 0,
			memoryUsage: 0,
			lastUpdated: new Date()
		};
	}

	/**
	 * Determine index type based on fields
	 * @param {string[]} fields - Field names
	 * @param {string} suggestedType - Suggested type
	 * @returns {string} Determined index type
	 * @private
	 */
	_determineType (fields, suggestedType) {
		if (suggestedType === IndexTypes.PARTIAL) {
			return IndexTypes.PARTIAL;
		}

		if (fields.length > 1) {
			return IndexTypes.COMPOSITE;
		}

		return IndexTypes.SINGLE;
	}

	/**
	 * Generate index keys for a record
	 * @param {Object} record - Record data
	 * @returns {string[]} Array of index keys
	 */
	generateKeys (record) {
		// Apply filter for partial indexes
		if (this.filter && !this.filter(record)) {
			return [];
		}

		const keys = this._extractKeys(record);

		// Apply transform if specified
		if (this.transform) {
			return keys.map(key => this.transform(key, record));
		}

		return keys;
	}

	/**
	 * Extract raw keys from record
	 * @param {Object} record - Record data
	 * @returns {string[]} Array of raw keys
	 * @private
	 */
	_extractKeys (record) {
		if (this.type === IndexTypes.COMPOSITE) {
			return this._generateCompositeKeys(record);
		}

		const field = this.fields[0];
		const value = record[field];

		if (value === undefined || value === null) {
			return [];
		}

		// Handle array fields
		if (Array.isArray(value)) {
			return value.map(v => String(v));
		}

		return [String(value)];
	}

	/**
	 * Generate composite keys
	 * @param {Object} record - Record data
	 * @returns {string[]} Array of composite keys
	 * @private
	 */
	_generateCompositeKeys (record) {
		let keys = [""];

		for (const field of this.fields.sort()) {
			const value = record[field];
			if (value === undefined || value === null) {
				return []; // Skip records with missing composite fields
			}

			const values = Array.isArray(value) ? value : [value];
			const newKeys = [];

			for (const existingKey of keys) {
				for (const val of values) {
					const newKey = existingKey === "" ?
						String(val) :
						`${existingKey}${this.delimiter}${String(val)}`;
					newKeys.push(newKey);
				}
			}

			keys = newKeys;
		}

		return keys;
	}

	/**
	 * Update statistics
	 * @param {number} keyCount - Number of keys
	 * @param {number} entryCount - Number of entries
	 * @param {number} memoryDelta - Memory change in bytes
	 */
	updateStats (keyCount, entryCount, memoryDelta) {
		this.stats.totalKeys = keyCount;
		this.stats.totalEntries = entryCount;
		this.stats.memoryUsage += memoryDelta;
		this.stats.lastUpdated = new Date();
	}
}

/**
 * Memory-efficient index storage with reference counting
 */
class IndexStorage {
	constructor () {
		// Map<indexKey, Set<recordKey>>
		this._storage = new Map();
		// Track reference counts for memory management
		this._refCounts = new Map();
	}

	/**
	 * Add a record to index
	 * @param {string} indexKey - Index key
	 * @param {string} recordKey - Record key
	 */
	add (indexKey, recordKey) {
		if (!this._storage.has(indexKey)) {
			this._storage.set(indexKey, new Set());
			this._refCounts.set(indexKey, 0);
		}

		const recordSet = this._storage.get(indexKey);
		if (!recordSet.has(recordKey)) {
			recordSet.add(recordKey);
			this._refCounts.set(indexKey, this._refCounts.get(indexKey) + 1);
		}
	}

	/**
	 * Remove a record from index
	 * @param {string} indexKey - Index key
	 * @param {string} recordKey - Record key
	 * @returns {boolean} True if record was removed
	 */
	remove (indexKey, recordKey) {
		const recordSet = this._storage.get(indexKey);
		if (!recordSet) {
			return false;
		}

		const removed = recordSet.delete(recordKey);
		if (removed) {
			const newCount = this._refCounts.get(indexKey) - 1;
			if (newCount === 0) {
				// Clean up empty index keys
				this._storage.delete(indexKey);
				this._refCounts.delete(indexKey);
			} else {
				this._refCounts.set(indexKey, newCount);
			}
		}

		return removed;
	}

	/**
	 * Get records for index key
	 * @param {string} indexKey - Index key
	 * @returns {Set<string>} Set of record keys
	 */
	get (indexKey) {
		return this._storage.get(indexKey) || new Set();
	}

	/**
	 * Check if index key exists
	 * @param {string} indexKey - Index key
	 * @returns {boolean} True if key exists
	 */
	has (indexKey) {
		return this._storage.has(indexKey);
	}

	/**
	 * Get all index keys
	 * @returns {string[]} Array of index keys
	 */
	keys () {
		return Array.from(this._storage.keys());
	}

	/**
	 * Get index statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		let totalEntries = 0;
		for (const recordSet of this._storage.values()) {
			totalEntries += recordSet.size;
		}

		return {
			totalKeys: this._storage.size,
			totalEntries,
			memoryUsage: this._estimateMemoryUsage()
		};
	}

	/**
	 * Clear all index data
	 */
	clear () {
		this._storage.clear();
		this._refCounts.clear();
	}

	/**
	 * Estimate memory usage in bytes
	 * @returns {number} Estimated memory usage
	 * @private
	 */
	_estimateMemoryUsage () {
		let size = 0;

		for (const [key, recordSet] of this._storage) {
			// Estimate key size (string)
			size += key.length * 2;

			// Estimate Set overhead + record keys
			size += 64; // Set object overhead
			for (const recordKey of recordSet) {
				size += recordKey.length * 2;
			}
		}

		return size;
	}
}

/**
 * Index manager that handles multiple indexes efficiently
 */
class IndexManager {
	/**
	 * @param {string} [delimiter='|'] - Default delimiter for composite indexes
	 */
	constructor (delimiter = "|") {
		this.delimiter = delimiter;
		// Map<indexName, IndexDefinition>
		this._definitions = new Map();
		// Map<indexName, IndexStorage>
		this._indexes = new Map();
		// Performance tracking
		this._stats = {
			totalOperations: 0,
			totalTime: 0,
			lastOptimized: new Date()
		};
	}

	/**
	 * Create a new index
	 * @param {string} name - Index name
	 * @param {string|string[]} fields - Field name(s) to index
	 * @param {Object} [options={}] - Index options
	 * @returns {IndexManager} This instance for chaining
	 * @throws {IndexError} If index already exists or configuration is invalid
	 */
	createIndex (name, fields, options = {}) {
		if (this._definitions.has(name)) {
			throw new IndexError(`Index '${name}' already exists`, name, "create");
		}

		const definition = new IndexDefinition(name, fields, {
			delimiter: this.delimiter,
			...options
		});

		this._definitions.set(name, definition);
		this._indexes.set(name, new IndexStorage());

		return this;
	}

	/**
	 * Drop an index
	 * @param {string} name - Index name
	 * @returns {IndexManager} This instance for chaining
	 * @throws {IndexError} If index doesn't exist
	 */
	dropIndex (name) {
		if (!this._definitions.has(name)) {
			throw new IndexError(`Index '${name}' does not exist`, name, "drop");
		}

		this._definitions.delete(name);
		this._indexes.delete(name);

		return this;
	}

	/**
	 * Check if index exists
	 * @param {string} name - Index name
	 * @returns {boolean} True if index exists
	 */
	hasIndex (name) {
		return this._definitions.has(name);
	}

	/**
	 * Get index definition
	 * @param {string} name - Index name
	 * @returns {IndexDefinition|undefined} Index definition
	 */
	getIndexDefinition (name) {
		return this._definitions.get(name);
	}

	/**
	 * List all indexes
	 * @returns {string[]} Array of index names
	 */
	listIndexes () {
		return Array.from(this._definitions.keys());
	}

	/**
	 * Add a record to all applicable indexes
	 * @param {string} recordKey - Record key
	 * @param {Object} recordData - Record data
	 * @throws {IndexError} If unique constraint is violated
	 */
	addRecord (recordKey, recordData) {
		const startTime = Date.now();

		for (const [indexName, definition] of this._definitions) {
			const storage = this._indexes.get(indexName);
			const indexKeys = definition.generateKeys(recordData);

			for (const indexKey of indexKeys) {
				// Check unique constraint
				if (definition.unique && storage.has(indexKey)) {
					const existingRecords = storage.get(indexKey);
					if (existingRecords.size > 0 && !existingRecords.has(recordKey)) {
						throw new IndexError(
							`Unique constraint violation on index '${indexName}' for value '${indexKey}'`,
							indexName,
							"add"
						);
					}
				}

				storage.add(indexKey, recordKey);
			}

			// Update statistics
			const stats = storage.getStats();
			definition.updateStats(stats.totalKeys, stats.totalEntries, 0);
		}

		this._updatePerformanceStats(Date.now() - startTime);
	}

	/**
	 * Remove a record from all indexes
	 * @param {string} recordKey - Record key
	 * @param {Object} recordData - Record data
	 */
	removeRecord (recordKey, recordData) {
		const startTime = Date.now();

		for (const [indexName, definition] of this._definitions) {
			const storage = this._indexes.get(indexName);
			const indexKeys = definition.generateKeys(recordData);

			for (const indexKey of indexKeys) {
				storage.remove(indexKey, recordKey);
			}

			// Update statistics
			const stats = storage.getStats();
			definition.updateStats(stats.totalKeys, stats.totalEntries, 0);
		}

		this._updatePerformanceStats(Date.now() - startTime);
	}

	/**
	 * Update a record in indexes (remove old, add new)
	 * @param {string} recordKey - Record key
	 * @param {Object} oldData - Old record data
	 * @param {Object} newData - New record data
	 */
	updateRecord (recordKey, oldData, newData) {
		this.removeRecord(recordKey, oldData);
		this.addRecord(recordKey, newData);
	}

	/**
	 * Find records using index
	 * @param {string} indexName - Index name
	 * @param {string} indexKey - Index key to search for
	 * @returns {Set<string>} Set of record keys
	 * @throws {IndexError} If index doesn't exist
	 */
	findByIndex (indexName, indexKey) {
		const storage = this._indexes.get(indexName);
		if (!storage) {
			throw new IndexError(`Index '${indexName}' does not exist`, indexName, "query");
		}

		return new Set(storage.get(indexKey));
	}

	/**
	 * Find records using multiple criteria (intersection)
	 * @param {Object} criteria - Object with index names as keys and search values as values
	 * @returns {Set<string>} Set of record keys that match all criteria
	 */
	findByCriteria (criteria) {
		const indexNames = Object.keys(criteria);
		if (indexNames.length === 0) {
			return new Set();
		}

		let result = null;

		for (const indexName of indexNames) {
			const indexKey = String(criteria[indexName]);
			const records = this.findByIndex(indexName, indexKey);

			if (result === null) {
				result = records;
			} else {
				// Intersection
				result = new Set([...result].filter(key => records.has(key)));
			}

			// Early termination if no matches
			if (result.size === 0) {
				break;
			}
		}

		return result;
	}

	/**
	 * Get optimal index for query fields
	 * @param {string[]} fields - Fields being queried
	 * @returns {string|null} Best index name or null if no suitable index
	 */
	getOptimalIndex (fields) {
		const sortedFields = [...fields].sort();

		// Look for exact match first
		for (const [name, definition] of this._definitions) {
			const indexFields = [...definition.fields].sort();
			if (JSON.stringify(indexFields) === JSON.stringify(sortedFields)) {
				return name;
			}
		}

		// Look for index that covers all fields
		for (const [name, definition] of this._definitions) {
			if (fields.every(field => definition.fields.includes(field))) {
				return name;
			}
		}

		// Look for index that covers some fields (prefer single field indexes)
		const candidates = [];
		for (const [name, definition] of this._definitions) {
			const coverage = fields.filter(field => definition.fields.includes(field)).length;
			if (coverage > 0) {
				candidates.push({ name, coverage, fields: definition.fields.length });
			}
		}

		if (candidates.length > 0) {
			// Sort by coverage (descending) then by field count (ascending)
			candidates.sort((a, b) => {
				if (a.coverage !== b.coverage) {
					return b.coverage - a.coverage;
				}

				return a.fields - b.fields;
			});

			return candidates[0].name;
		}

		return null;
	}

	/**
	 * Rebuild all indexes from scratch
	 * @param {Map<string, Object>} records - All records to reindex
	 */
	rebuild (records) {
		// Clear all indexes
		for (const storage of this._indexes.values()) {
			storage.clear();
		}

		// Rebuild from records
		for (const [recordKey, recordData] of records) {
			this.addRecord(recordKey, recordData);
		}

		this._stats.lastOptimized = new Date();
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		const indexStats = {};
		let totalMemory = 0;

		for (const [name, definition] of this._definitions) {
			const storage = this._indexes.get(name);
			const stats = storage.getStats();
			indexStats[name] = {
				...definition.stats,
				...stats,
				type: definition.type,
				fields: definition.fields
			};
			totalMemory += stats.memoryUsage;
		}

		return {
			indexes: indexStats,
			totalIndexes: this._definitions.size,
			totalMemoryUsage: totalMemory,
			performance: {
				...this._stats,
				averageOperationTime: this._stats.totalOperations > 0 ?
					this._stats.totalTime / this._stats.totalOperations :
					0
			}
		};
	}

	/**
	 * Clear all indexes
	 */
	clear () {
		for (const storage of this._indexes.values()) {
			storage.clear();
		}
	}

	/**
	 * Update performance statistics
	 * @param {number} operationTime - Time taken for operation in ms
	 * @private
	 */
	_updatePerformanceStats (operationTime) {
		this._stats.totalOperations++;
		this._stats.totalTime += operationTime;
	}
}/**
 * Version retention policies
 */
const RetentionPolicies = {
	COUNT: "count",
	TIME: "time",
	SIZE: "size",
	NONE: "none"
};

/**
 * Version entry with metadata
 */
class VersionEntry {
	/**
	 * @param {Object} data - Version data
	 * @param {Object} [metadata={}] - Version metadata
	 */
	constructor (data, metadata = {}) {
		this.data = Object.freeze(structuredClone(data));
		this.timestamp = new Date();
		this.size = this._calculateSize(data);
		this.metadata = Object.freeze({
			operation: "update",
			...metadata
		});

		Object.freeze(this);
	}

	/**
	 * Calculate estimated size of version data
	 * @param {Object} data - Data to measure
	 * @returns {number} Size in bytes
	 * @private
	 */
	_calculateSize (data) {
		try {
			return JSON.stringify(data).length * 2; // UTF-16 estimate
		} catch {
			return 1024; // Fallback estimate
		}
	}

	/**
	 * Check if version is older than specified time
	 * @param {number} maxAge - Maximum age in milliseconds
	 * @returns {boolean} True if version is older
	 */
	isOlderThan (maxAge) {
		return Date.now() - this.timestamp.getTime() > maxAge;
	}

	/**
	 * Get age of version in milliseconds
	 * @returns {number} Age in milliseconds
	 */
	getAge () {
		return Date.now() - this.timestamp.getTime();
	}

	/**
	 * Convert to plain object for serialization
	 * @returns {Object} Plain object representation
	 */
	toObject () {
		return {
			data: this.data,
			timestamp: this.timestamp.toISOString(),
			size: this.size,
			metadata: this.metadata
		};
	}
}

/**
 * Version history for a single record
 */
class VersionHistory {
	/**
	 * @param {string} recordKey - Record key
	 * @param {Object} [policy={}] - Retention policy
	 */
	constructor (recordKey, policy = {}) {
		this.recordKey = recordKey;
		this.policy = policy;
		this.versions = [];
		this.totalSize = 0;
		this.createdAt = new Date();
		this.lastAccessed = new Date();
	}

	/**
	 * Add a new version
	 * @param {Object} data - Version data
	 * @param {Object} [metadata={}] - Version metadata
	 * @returns {VersionEntry} Created version entry
	 */
	addVersion (data, metadata = {}) {
		const version = new VersionEntry(data, metadata);
		this.versions.push(version);
		this.totalSize += version.size;
		this.lastAccessed = new Date();

		// Apply retention policy
		this._applyRetentionPolicy();

		return version;
	}

	/**
	 * Get version by index (0 = oldest, -1 = newest)
	 * @param {number} index - Version index
	 * @returns {VersionEntry|undefined} Version entry
	 */
	getVersion (index) {
		this.lastAccessed = new Date();

		if (index < 0) {
			return this.versions[this.versions.length + index];
		}

		return this.versions[index];
	}

	/**
	 * Get latest version
	 * @returns {VersionEntry|undefined} Latest version
	 */
	getLatest () {
		return this.getVersion(-1);
	}

	/**
	 * Get oldest version
	 * @returns {VersionEntry|undefined} Oldest version
	 */
	getOldest () {
		return this.getVersion(0);
	}

	/**
	 * Get all versions within time range
	 * @param {Date} [start] - Start time (inclusive)
	 * @param {Date} [end] - End time (inclusive)
	 * @returns {VersionEntry[]} Array of versions in range
	 */
	getVersionsInRange (start, end) {
		this.lastAccessed = new Date();

		return this.versions.filter(version => {
			const timestamp = version.timestamp;
			const afterStart = !start || timestamp >= start;
			const beforeEnd = !end || timestamp <= end;

			return afterStart && beforeEnd;
		});
	}

	/**
	 * Get number of versions
	 * @returns {number} Version count
	 */
	getCount () {
		return this.versions.length;
	}

	/**
	 * Get total size of all versions
	 * @returns {number} Total size in bytes
	 */
	getTotalSize () {
		return this.totalSize;
	}

	/**
	 * Clear all versions
	 * @returns {number} Number of versions cleared
	 */
	clear () {
		const count = this.versions.length;
		this.versions = [];
		this.totalSize = 0;

		return count;
	}

	/**
	 * Remove versions older than specified age
	 * @param {number} maxAge - Maximum age in milliseconds
	 * @returns {number} Number of versions removed
	 */
	removeOlderThan (maxAge) {
		const oldCount = this.versions.length;
		const cutoffTime = Date.now() - maxAge;

		this.versions = this.versions.filter(version => {
			const keep = version.timestamp.getTime() >= cutoffTime;
			if (!keep) {
				this.totalSize -= version.size;
			}

			return keep;
		});

		return oldCount - this.versions.length;
	}

	/**
	 * Apply retention policy to limit versions
	 * @private
	 */
	_applyRetentionPolicy () {
		if (!this.policy || this.policy.type === RetentionPolicies.NONE) {
			return 0;
		}

		let removed = 0;

		switch (this.policy.type) {
			case RetentionPolicies.COUNT:
				removed = this._applyCountPolicy();
				break;
			case RetentionPolicies.TIME:
				removed = this._applyTimePolicy();
				break;
			case RetentionPolicies.SIZE:
				removed = this._applySizePolicy();
				break;
			default:
				removed = 0;
				break;
		}

		return removed;
	}

	/**
	 * Apply count-based retention policy
	 * @returns {number} Number of versions removed
	 * @private
	 */
	_applyCountPolicy () {
		const maxCount = this.policy.maxCount || 10;
		if (this.versions.length <= maxCount) {
			return 0;
		}

		const removeCount = this.versions.length - maxCount;
		const removed = this.versions.splice(0, removeCount);

		for (const version of removed) {
			this.totalSize -= version.size;
		}

		return removed.length;
	}

	/**
	 * Apply time-based retention policy
	 * @returns {number} Number of versions removed
	 * @private
	 */
	_applyTimePolicy () {
		const maxAge = this.policy.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 days default

		return this.removeOlderThan(maxAge);
	}

	/**
	 * Apply size-based retention policy
	 * @returns {number} Number of versions removed
	 * @private
	 */
	_applySizePolicy () {
		const maxSize = this.policy.maxSize || 10 * 1024 * 1024; // 10MB default
		if (this.totalSize <= maxSize) {
			return 0;
		}

		let removed = 0;
		while (this.totalSize > maxSize && this.versions.length > 1) {
			const version = this.versions.shift();
			this.totalSize -= version.size;
			removed++;
		}

		return removed;
	}

	/**
	 * Get statistics for this version history
	 * @returns {Object} Statistics object
	 */
	getStats () {
		return {
			recordKey: this.recordKey,
			versionCount: this.versions.length,
			totalSize: this.totalSize,
			averageSize: this.versions.length > 0 ? this.totalSize / this.versions.length : 0,
			oldestVersion: this.versions.length > 0 ? this.versions[0].timestamp : null,
			newestVersion: this.versions.length > 0 ? this.versions[this.versions.length - 1].timestamp : null,
			createdAt: this.createdAt,
			lastAccessed: this.lastAccessed,
			policy: this.policy
		};
	}
}

/**
 * Version manager for handling versioning across all records
 */
class VersionManager {
	/**
	 * @param {Object} [globalPolicy={}] - Global retention policy
	 */
	constructor (globalPolicy = {}) {
		this.globalPolicy = this._validatePolicy(globalPolicy);
		// Map<recordKey, VersionHistory>
		this.histories = new Map();
		this.stats = {
			totalHistories: 0,
			totalVersions: 0,
			totalSize: 0,
			lastCleanup: new Date(),
			cleanupCount: 0
		};
	}

	/**
	 * Enable versioning for a record
	 * @param {string} recordKey - Record key
	 * @param {Object} [policy] - Custom retention policy for this record
	 * @returns {VersionHistory} Created version history
	 */
	enableVersioning (recordKey, policy) {
		if (this.histories.has(recordKey)) {
			return this.histories.get(recordKey);
		}

		const effectivePolicy = policy || this.globalPolicy;
		const history = new VersionHistory(recordKey, effectivePolicy);
		this.histories.set(recordKey, history);
		this.stats.totalHistories++;

		return history;
	}

	/**
	 * Disable versioning for a record
	 * @param {string} recordKey - Record key
	 * @returns {boolean} True if versioning was disabled
	 */
	disableVersioning (recordKey) {
		const history = this.histories.get(recordKey);
		if (!history) {
			return false;
		}

		this.stats.totalVersions -= history.getCount();
		this.stats.totalSize -= history.getTotalSize();
		this.stats.totalHistories--;

		return this.histories.delete(recordKey);
	}

	/**
	 * Add a version for a record
	 * @param {string} recordKey - Record key
	 * @param {Object} data - Version data
	 * @param {Object} [metadata={}] - Version metadata
	 * @returns {VersionEntry} Created version entry
	 * @throws {VersionError} If versioning is not enabled for record
	 */
	addVersion (recordKey, data, metadata = {}) {
		let history = this.histories.get(recordKey);
		if (!history) {
			// Auto-enable versioning with global policy
			history = this.enableVersioning(recordKey);
		}

		const oldCount = history.getCount();
		const oldSize = history.getTotalSize();

		const version = history.addVersion(data, metadata);

		// Update global stats
		this.stats.totalVersions += history.getCount() - oldCount;
		this.stats.totalSize += history.getTotalSize() - oldSize;

		return version;
	}

	/**
	 * Get version history for a record
	 * @param {string} recordKey - Record key
	 * @returns {VersionHistory|undefined} Version history
	 */
	getHistory (recordKey) {
		return this.histories.get(recordKey);
	}

	/**
	 * Get specific version of a record
	 * @param {string} recordKey - Record key
	 * @param {number} versionIndex - Version index
	 * @returns {VersionEntry|undefined} Version entry
	 */
	getVersion (recordKey, versionIndex) {
		const history = this.histories.get(recordKey);

		return history ? history.getVersion(versionIndex) : undefined;
	}

	/**
	 * Get latest version of a record
	 * @param {string} recordKey - Record key
	 * @returns {VersionEntry|undefined} Latest version
	 */
	getLatestVersion (recordKey) {
		const history = this.histories.get(recordKey);

		return history ? history.getLatest() : undefined;
	}

	/**
	 * Check if versioning is enabled for a record
	 * @param {string} recordKey - Record key
	 * @returns {boolean} True if versioning is enabled
	 */
	isVersioningEnabled (recordKey) {
		return this.histories.has(recordKey);
	}

	/**
	 * Clean up versions based on retention policies
	 * @param {Object} [options={}] - Cleanup options
	 * @param {boolean} [options.force=false] - Force cleanup even if not needed
	 * @param {string[]} [options.recordKeys] - Specific records to clean up
	 * @returns {Object} Cleanup results
	 */
	cleanup (options = {}) {
		const { recordKeys } = options;
		const results = {
			historiesProcessed: 0,
			versionsRemoved: 0,
			sizeFreed: 0,
			startTime: new Date()
		};

		const keysToProcess = recordKeys || Array.from(this.histories.keys());

		for (const recordKey of keysToProcess) {
			const history = this.histories.get(recordKey);
			if (history) {
				const oldCount = history.getCount();
				const oldSize = history.getTotalSize();

				// Apply retention policy
				history._applyRetentionPolicy();

				const newCount = history.getCount();
				const newSize = history.getTotalSize();

				results.historiesProcessed++;
				results.versionsRemoved += oldCount - newCount;
				results.sizeFreed += oldSize - newSize;

				// Remove empty histories
				if (newCount === 0) {
					this.histories.delete(recordKey);
					this.stats.totalHistories--;
				}
			}
		}

		// Update global stats
		this.stats.totalVersions -= results.versionsRemoved;
		this.stats.totalSize -= results.sizeFreed;
		this.stats.lastCleanup = new Date();
		this.stats.cleanupCount++;

		results.endTime = new Date();
		results.duration = results.endTime.getTime() - results.startTime.getTime();

		return results;
	}

	/**
	 * Set global retention policy
	 * @param {Object} policy - Retention policy
	 * @returns {VersionManager} This instance for chaining
	 */
	setGlobalPolicy (policy) {
		this.globalPolicy = this._validatePolicy(policy);

		return this;
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		// Recalculate stats from histories
		let totalVersions = 0;
		let totalSize = 0;
		const historyStats = [];

		for (const history of this.histories.values()) {
			const stats = history.getStats();
			historyStats.push(stats);
			totalVersions += stats.versionCount;
			totalSize += stats.totalSize;
		}

		return {
			...this.stats,
			totalHistories: this.histories.size,
			totalVersions,
			totalSize,
			averageVersionsPerRecord: this.histories.size > 0 ? totalVersions / this.histories.size : 0,
			averageSizePerRecord: this.histories.size > 0 ? totalSize / this.histories.size : 0,
			globalPolicy: this.globalPolicy,
			histories: historyStats
		};
	}

	/**
	 * Export version data for backup
	 * @param {string[]} [recordKeys] - Specific records to export
	 * @returns {Object} Exportable version data
	 */
	export (recordKeys) {
		const keysToExport = recordKeys || Array.from(this.histories.keys());
		const exportData = {
			globalPolicy: this.globalPolicy,
			histories: {},
			exportedAt: new Date().toISOString()
		};

		for (const recordKey of keysToExport) {
			const history = this.histories.get(recordKey);
			if (history) {
				exportData.histories[recordKey] = {
					policy: history.policy,
					versions: history.versions.map(v => v.toObject()),
					createdAt: history.createdAt.toISOString(),
					lastAccessed: history.lastAccessed.toISOString()
				};
			}
		}

		return exportData;
	}

	/**
	 * Import version data from backup
	 * @param {Object} exportData - Exported version data
	 * @param {Object} [options={}] - Import options
	 * @param {boolean} [options.merge=false] - Whether to merge with existing data
	 * @returns {Object} Import results
	 */
	import (exportData, options = {}) {
		const { merge = false } = options;
		const results = {
			historiesImported: 0,
			versionsImported: 0,
			errors: []
		};

		if (!merge) {
			this.histories.clear();
		}

		if (exportData.globalPolicy) {
			this.globalPolicy = this._validatePolicy(exportData.globalPolicy);
		}

		for (const [recordKey, historyData] of Object.entries(exportData.histories)) {
			try {
				const history = new VersionHistory(recordKey, historyData.policy);
				history.createdAt = new Date(historyData.createdAt);
				history.lastAccessed = new Date(historyData.lastAccessed);

				for (const versionData of historyData.versions) {
					const version = new VersionEntry(versionData.data, versionData.metadata);
					// Restore original timestamp
					Object.defineProperty(version, "timestamp", {
						value: new Date(versionData.timestamp),
						writable: false
					});
					history.versions.push(version);
					history.totalSize += version.size;
					results.versionsImported++;
				}

				this.histories.set(recordKey, history);
				results.historiesImported++;
			} catch (error) {
				results.errors.push({
					recordKey,
					error: error.message
				});
			}
		}

		// Update stats
		this._updateStats();

		return results;
	}

	/**
	 * Clear all version data
	 * @returns {Object} Clear results
	 */
	clear () {
		const results = {
			historiesCleared: this.histories.size,
			versionsCleared: this.stats.totalVersions,
			sizeFreed: this.stats.totalSize
		};

		this.histories.clear();
		this.stats = {
			totalHistories: 0,
			totalVersions: 0,
			totalSize: 0,
			lastCleanup: new Date(),
			cleanupCount: this.stats.cleanupCount
		};

		return results;
	}

	/**
	 * Validate retention policy
	 * @param {Object} policy - Policy to validate
	 * @returns {Object} Validated policy
	 * @throws {ConfigurationError} If policy is invalid
	 * @private
	 */
	_validatePolicy (policy) {
		if (!policy || typeof policy !== "object") {
			return { type: RetentionPolicies.NONE };
		}

		const validTypes = Object.values(RetentionPolicies);
		if (policy.type && !validTypes.includes(policy.type)) {
			throw new ConfigurationError(`Invalid retention policy type: ${policy.type}`, "retentionPolicy.type", policy.type);
		}

		const validated = { ...policy };

		if (validated.type === RetentionPolicies.COUNT && validated.maxCount !== undefined) {
			if (typeof validated.maxCount !== "number" || validated.maxCount < 1) {
				throw new ConfigurationError("maxCount must be a positive number", "retentionPolicy.maxCount", validated.maxCount);
			}
		}

		if (validated.type === RetentionPolicies.TIME && validated.maxAge !== undefined) {
			if (typeof validated.maxAge !== "number" || validated.maxAge < 1) {
				throw new ConfigurationError("maxAge must be a positive number", "retentionPolicy.maxAge", validated.maxAge);
			}
		}

		if (validated.type === RetentionPolicies.SIZE && validated.maxSize !== undefined) {
			if (typeof validated.maxSize !== "number" || validated.maxSize < 1) {
				throw new ConfigurationError("maxSize must be a positive number", "retentionPolicy.maxSize", validated.maxSize);
			}
		}

		return validated;
	}

	/**
	 * Update global statistics
	 * @private
	 */
	_updateStats () {
		let totalVersions = 0;
		let totalSize = 0;

		for (const history of this.histories.values()) {
			totalVersions += history.getCount();
			totalSize += history.getTotalSize();
		}

		this.stats.totalHistories = this.histories.size;
		this.stats.totalVersions = totalVersions;
		this.stats.totalSize = totalSize;
	}
}/**
 * Transaction operation entry
 */
class TransactionOperation {
	/**
	 * @param {string} type - Operation type
	 * @param {string} key - Record key
	 * @param {*} [oldValue] - Previous value (for rollback)
	 * @param {*} [newValue] - New value
	 * @param {Object} [metadata={}] - Additional metadata
	 */
	constructor (type, key, oldValue, newValue, metadata = {}) {
		this.id = crypto.randomUUID();
		this.type = type;
		this.key = key;
		this.oldValue = oldValue;
		this.newValue = newValue;
		this.metadata = metadata;
		this.timestamp = new Date();

		Object.freeze(this);
	}

	/**
	 * Create rollback operation
	 * @returns {TransactionOperation} Rollback operation
	 */
	createRollback () {
		switch (this.type) {
			case OperationTypes.SET:
				return this.oldValue === undefined ?
					new TransactionOperation(OperationTypes.DELETE, this.key, this.newValue, undefined) :
					new TransactionOperation(OperationTypes.SET, this.key, this.newValue, this.oldValue);

			case OperationTypes.DELETE:
				return new TransactionOperation(OperationTypes.SET, this.key, undefined, this.oldValue);

			default:
				throw new TransactionError(`Cannot create rollback for operation type: ${this.type}`, null, "rollback");
		}
	}
}/**
 * Transaction implementation with ACID properties
 */
class Transaction {
	/**
	 * @param {string} [id] - Transaction ID (auto-generated if not provided)
	 * @param {Object} [options={}] - Transaction options
	 * @param {number} [options.isolationLevel=IsolationLevels.READ_COMMITTED] - Isolation level
	 * @param {number} [options.timeout=60000] - Transaction timeout in milliseconds
	 * @param {boolean} [options.readOnly=false] - Whether transaction is read-only
	 */
	constructor (id = crypto.randomUUID(), options = {}) {
		this.id = id;
		this.state = TransactionStates.PENDING;
		this.isolationLevel = options.isolationLevel || IsolationLevels.READ_COMMITTED;
		this.timeout = options.timeout || 60000;
		this.readOnly = options.readOnly || false;
		this.startTime = null;
		this.endTime = null;

		// Operation log for rollback
		this.operations = [];

		// Read set for isolation (record keys read during transaction)
		this.readSet = new Set();

		// Write set for isolation (record keys written during transaction)
		this.writeSet = new Set();

		// Snapshot for repeatable read isolation
		this.snapshot = new Map();

		// Validation callback for custom constraints
		this.validationCallback = null;

		// Abort reason (set when transaction is aborted)
		this.abortReason = null;

		Object.seal(this);
	}

	/**
	 * Begin the transaction
	 * @returns {Transaction} This transaction for chaining
	 * @throws {TransactionError} If transaction is already active
	 */
	begin () {
		if (this.state !== TransactionStates.PENDING) {
			throw new TransactionError(
				`Cannot begin transaction in state: ${this.state}`,
				this.id,
				"begin"
			);
		}

		this.state = TransactionStates.ACTIVE;
		this.startTime = new Date();

		return this;
	}

	/**
	 * Add an operation to the transaction log
	 * @param {string} type - Operation type
	 * @param {string} key - Record key
	 * @param {*} [oldValue] - Previous value
	 * @param {*} [newValue] - New value
	 * @param {Object} [metadata={}] - Additional metadata
	 * @returns {TransactionOperation} Created operation
	 * @throws {TransactionError} If transaction is not active or is read-only
	 */
	addOperation (type, key, oldValue, newValue, metadata = {}) {
		this._checkActive();

		if (this.readOnly && type !== "read") {
			throw new TransactionError(
				"Cannot perform write operations in read-only transaction",
				this.id,
				"write"
			);
		}

		// Check timeout
		if (this._isTimedOut()) {
			throw new TransactionError(
				"Transaction has timed out",
				this.id,
				"timeout"
			);
		}

		const operation = new TransactionOperation(type, key, oldValue, newValue, metadata);
		this.operations.push(operation);

		// Track read and write sets
		if (type === "read") {
			this.readSet.add(key);
		} else {
			this.writeSet.add(key);
		}

		return operation;
	}

	/**
	 * Set validation callback for custom constraints
	 * @param {Function} callback - Validation function
	 * @returns {Transaction} This transaction for chaining
	 */
	setValidation (callback) {
		this.validationCallback = callback;

		return this;
	}

	/**
	 * Validate transaction before commit
	 * @param {Object} [context] - Validation context
	 * @returns {boolean} True if validation passes
	 * @throws {TransactionError} If validation fails
	 */
	validate (context = {}) {
		if (this.validationCallback) {
			const result = this.validationCallback(this, context);
			if (result !== true) {
				const message = typeof result === "string" ? result : "Transaction validation failed";
				throw new TransactionError(message, this.id, "validation");
			}
		}

		return true;
	}

	/**
	 * Commit the transaction
	 * @param {Object} [context] - Commit context
	 * @returns {Transaction} This transaction for chaining
	 * @throws {TransactionError} If commit fails
	 */
	commit (context = {}) {
		this._checkActive();

		try {
			// Validate before commit
			this.validate(context);

			this.state = TransactionStates.COMMITTED;
			this.endTime = new Date();

			return this;
		} catch (error) {
			// Auto-abort on commit failure
			this.abort();
			throw error;
		}
	}

	/**
	 * Abort the transaction
	 * @param {string} [reason] - Reason for abort
	 * @returns {Transaction} This transaction for chaining
	 */
	abort (reason = "User abort") {
		if (this.state === TransactionStates.ABORTED || this.state === TransactionStates.COMMITTED) {
			return this;
		}

		this.state = TransactionStates.ABORTED;
		this.endTime = new Date();
		this.abortReason = reason;

		return this;
	}

	/**
	 * Get rollback operations (in reverse order)
	 * @returns {TransactionOperation[]} Array of rollback operations
	 */
	getRollbackOperations () {
		return this.operations
			.slice()
			.reverse()
			.filter(op => op.type !== "read") // Filter out read operations
			.map(op => op.createRollback())
			.filter(op => op !== null);
	}

	/**
	 * Check if transaction is active
	 * @returns {boolean} True if transaction is active
	 */
	isActive () {
		return this.state === TransactionStates.ACTIVE;
	}

	/**
	 * Check if transaction is committed
	 * @returns {boolean} True if transaction is committed
	 */
	isCommitted () {
		return this.state === TransactionStates.COMMITTED;
	}

	/**
	 * Check if transaction is aborted
	 * @returns {boolean} True if transaction is aborted
	 */
	isAborted () {
		return this.state === TransactionStates.ABORTED;
	}

	/**
	 * Get transaction duration
	 * @returns {number|null} Duration in milliseconds, null if not completed
	 */
	getDuration () {
		if (!this.startTime) return null;
		const endTime = this.endTime || new Date();

		return endTime.getTime() - this.startTime.getTime();
	}

	/**
	 * Get transaction statistics
	 * @returns {Object} Transaction statistics
	 */
	getStats () {
		return {
			id: this.id,
			state: this.state,
			isolationLevel: this.isolationLevel,
			readOnly: this.readOnly,
			startTime: this.startTime,
			endTime: this.endTime,
			duration: this.getDuration(),
			operationCount: this.operations.length,
			readSetSize: this.readSet.size,
			writeSetSize: this.writeSet.size,
			snapshotSize: this.snapshot.size,
			abortReason: this.abortReason,
			timedOut: this._isTimedOut()
		};
	}

	/**
	 * Export transaction for debugging/logging
	 * @returns {Object} Exportable transaction data
	 */
	export () {
		return {
			...this.getStats(),
			operations: this.operations.map(op => ({
				id: op.id,
				type: op.type,
				key: op.key,
				timestamp: op.timestamp,
				metadata: op.metadata
			})),
			readSet: Array.from(this.readSet),
			writeSet: Array.from(this.writeSet)
		};
	}

	/**
	 * Check if transaction is active and throw if not
	 * @throws {TransactionError} If transaction is not active
	 * @private
	 */
	_checkActive () {
		if (this.state !== TransactionStates.ACTIVE) {
			throw new TransactionError(
				`Transaction is not active (current state: ${this.state})`,
				this.id,
				"state"
			);
		}
	}

	/**
	 * Check if transaction has timed out
	 * @returns {boolean} True if timed out
	 * @private
	 */
	_isTimedOut () {
		if (!this.startTime) return false;

		return Date.now() - this.startTime.getTime() > this.timeout;
	}
}/**
 * Lock manager for controlling concurrent access
 */
class LockManager {
	constructor () {
		// Map<recordKey, {type: string, holders: Set<transactionId>, waiters: Array}>
		this.locks = new Map();
		this.lockTimeout = 30000; // 30 seconds default
	}

	/**
	 * Acquire a lock on a record
	 * @param {string} transactionId - Transaction ID
	 * @param {string} recordKey - Record key to lock
	 * @param {string} lockType - Type of lock (shared/exclusive)
	 * @param {number} [timeout] - Lock timeout in milliseconds
	 * @returns {Promise<boolean>} True if lock acquired
	 * @throws {ConcurrencyError} If lock cannot be acquired
	 */
	async acquireLock (transactionId, recordKey, lockType, timeout = this.lockTimeout) {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			if (this._tryAcquireLock(transactionId, recordKey, lockType)) {
				return true;
			}

			// Wait a bit before retrying
			await new Promise(resolve => setTimeout(resolve, 10));
		}

		throw new ConcurrencyError(
			`Failed to acquire ${lockType} lock on record '${recordKey}' within timeout`,
			recordKey,
			"lock"
		);
	}

	/**
	 * Try to acquire lock immediately
	 * @param {string} transactionId - Transaction ID
	 * @param {string} recordKey - Record key
	 * @param {string} lockType - Lock type
	 * @returns {boolean} True if lock acquired
	 * @private
	 */
	_tryAcquireLock (transactionId, recordKey, lockType) {
		const existingLock = this.locks.get(recordKey);

		if (!existingLock) {
			// No existing lock, create new one
			this.locks.set(recordKey, {
				type: lockType,
				holders: new Set([transactionId]),
				waiters: []
			});

			return true;
		}

		// Check if already holding the lock
		if (existingLock.holders.has(transactionId)) {
			// Check for lock upgrade
			if (existingLock.type === LockTypes.SHARED && lockType === LockTypes.EXCLUSIVE) {
				// Can upgrade if we're the only holder
				if (existingLock.holders.size === 1) {
					existingLock.type = LockTypes.EXCLUSIVE;

					return true;
				}

				return false; // Cannot upgrade with other holders
			}

			return true; // Already have compatible lock
		}

		// Check compatibility
		if (lockType === LockTypes.SHARED && existingLock.type === LockTypes.SHARED) {
			// Shared locks are compatible
			existingLock.holders.add(transactionId);

			return true;
		}

		// Exclusive locks or mixed locks are not compatible
		return false;
	}

	/**
	 * Release a lock
	 * @param {string} transactionId - Transaction ID
	 * @param {string} recordKey - Record key
	 * @returns {boolean} True if lock was released
	 */
	releaseLock (transactionId, recordKey) {
		const lock = this.locks.get(recordKey);
		if (!lock || !lock.holders.has(transactionId)) {
			return false;
		}

		lock.holders.delete(transactionId);

		// If no more holders, remove the lock
		if (lock.holders.size === 0) {
			this.locks.delete(recordKey);
		}

		return true;
	}

	/**
	 * Release all locks held by a transaction
	 * @param {string} transactionId - Transaction ID
	 * @returns {number} Number of locks released
	 */
	releaseAllLocks (transactionId) {
		let released = 0;

		for (const [recordKey, lock] of this.locks) {
			if (lock.holders.has(transactionId)) {
				lock.holders.delete(transactionId);
				released++;

				// If no more holders, remove the lock
				if (lock.holders.size === 0) {
					this.locks.delete(recordKey);
				}
			}
		}

		return released;
	}

	/**
	 * Check if transaction holds any locks
	 * @param {string} transactionId - Transaction ID
	 * @returns {boolean} True if transaction holds locks
	 */
	holdsLocks (transactionId) {
		for (const lock of this.locks.values()) {
			if (lock.holders.has(transactionId)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get lock statistics
	 * @returns {Object} Lock statistics
	 */
	getStats () {
		const stats = {
			totalLocks: this.locks.size,
			sharedLocks: 0,
			exclusiveLocks: 0,
			lockHolders: new Set(),
			recordsLocked: []
		};

		for (const [recordKey, lock] of this.locks) {
			if (lock.type === LockTypes.SHARED) {
				stats.sharedLocks++;
			} else {
				stats.exclusiveLocks++;
			}

			for (const holder of lock.holders) {
				stats.lockHolders.add(holder);
			}

			stats.recordsLocked.push({
				recordKey,
				type: lock.type,
				holders: Array.from(lock.holders)
			});
		}

		stats.uniqueHolders = stats.lockHolders.size;

		return stats;
	}
}/**
 * Transaction statistics manager for tracking metrics and performance
 */
class TransactionStatistics {
	constructor () {
		this.stats = {
			totalTransactions: 0,
			committedTransactions: 0,
			abortedTransactions: 0,
			activeTransactions: 0,
			averageDuration: 0,
			totalDuration: 0
		};
	}

	/**
	 * Increment total transaction count
	 */
	incrementTotal () {
		this.stats.totalTransactions++;
	}

	/**
	 * Increment committed transaction count
	 */
	incrementCommitted () {
		this.stats.committedTransactions++;
	}

	/**
	 * Increment aborted transaction count
	 */
	incrementAborted () {
		this.stats.abortedTransactions++;
	}

	/**
	 * Increment active transaction count
	 */
	incrementActive () {
		this.stats.activeTransactions++;
	}

	/**
	 * Decrement active transaction count
	 */
	decrementActive () {
		this.stats.activeTransactions--;
	}

	/**
	 * Update duration statistics based on completed transaction
	 * @param {Transaction} transaction - Completed transaction
	 */
	updateDurationStats (transaction) {
		const duration = transaction.getDuration();
		if (duration !== null) {
			this.stats.totalDuration += duration;
			const completedTransactions = this.stats.committedTransactions + this.stats.abortedTransactions;
			this.stats.averageDuration = this.stats.totalDuration / completedTransactions;
		}
	}

	/**
	 * Get comprehensive statistics
	 * @param {Object} lockStats - Lock manager statistics
	 * @param {number} activeCount - Current active transaction count
	 * @param {number} transactionCounter - Global transaction counter
	 * @returns {Object} Complete statistics object
	 */
	getStats (lockStats, activeCount, transactionCounter) {
		return {
			...this.stats,
			activeTransactions: activeCount,
			lockStats,
			transactionCounter
		};
	}

	/**
	 * Reset all statistics to zero
	 */
	reset () {
		this.stats = {
			totalTransactions: 0,
			committedTransactions: 0,
			abortedTransactions: 0,
			activeTransactions: 0,
			averageDuration: 0,
			totalDuration: 0
		};
	}

	/**
	 * Get raw statistics object (for internal use)
	 * @returns {Object} Raw stats object
	 */
	getRawStats () {
		return { ...this.stats };
	}
}/**
 * Analyzer for detecting relationships between transaction keys
 * Handles hierarchical, semantic, pattern, temporal, and functional relationships
 */
class KeyRelationshipAnalyzer {
	/**
	 * Creates a new KeyRelationshipAnalyzer instance
	 * Initializes caches for pattern and semantic analysis
	 */
	constructor () {
		// Pattern cache for performance
		this.patternCache = new Map();
		this.semanticCache = new Map();
	}

	/**
	 * Check if two keys are related through various relationship types
	 * @param {string} key1 - First key
	 * @param {string} key2 - Second key
	 * @returns {boolean} True if keys are related
	 */
	areKeysRelated (key1, key2) {
		// Direct match - always related
		if (key1 === key2) {
			return true;
		}

		// Check for hierarchical relationships
		if (this._hasHierarchicalKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for semantic relationships
		if (this._hasSemanticKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for pattern-based relationships
		if (this._hasPatternBasedKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for composite key relationships
		if (this._hasCompositeKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for temporal relationships
		if (this._hasTemporalKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for index-based relationships
		if (this._hasIndexKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for collection relationships
		if (this._hasCollectionKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for functional dependencies
		if (this._hasFunctionalDependency(key1, key2)) {
			return true;
		}

		return false;
	}

	/**
	 * Check if a key falls within the range that could affect a snapshot
	 * @param {Transaction} transaction - Transaction with snapshot
	 * @param {string} operationKey - Key from other transaction's operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if operation key could affect snapshot
	 */
	isKeyInSnapshotRange (transaction, operationKey, snapshotKey, expectedValue) {
		// Direct key match - always affects snapshot
		if (operationKey === snapshotKey) {
			return true;
		}

		// Check for explicit range metadata stored with the snapshot
		if (this._hasExplicitRangeMetadata(transaction, snapshotKey)) {
			return this._checkExplicitRange(transaction, operationKey, snapshotKey);
		}

		// Infer range from snapshot key patterns
		if (this._isPatternBasedSnapshot(snapshotKey)) {
			return this._checkPatternBasedRange(operationKey, snapshotKey);
		}

		// Check for hierarchical key relationships
		if (this._hasHierarchicalRelationship(operationKey, snapshotKey)) {
			return this._checkHierarchicalRange(operationKey, snapshotKey, expectedValue);
		}

		// Check for index-based range queries
		if (this._isIndexBasedSnapshot(transaction, snapshotKey)) {
			return this._checkIndexBasedRange(transaction, operationKey, snapshotKey);
		}

		// Check for semantic key relationships
		if (this._hasSemanticRelationship(operationKey, snapshotKey)) {
			return this._checkSemanticRange(operationKey, snapshotKey);
		}

		// Check for temporal range relationships
		if (this._isTemporalSnapshot(snapshotKey)) {
			return this._checkTemporalRange(operationKey, snapshotKey);
		}

		// Check for composite key range relationships
		if (this._isCompositeKeySnapshot(snapshotKey)) {
			return this._checkCompositeKeyRange(operationKey, snapshotKey);
		}

		return false;
	}

	/**
	 * Check if a key matches a range specification
	 * @param {string} key - Key to check
	 * @param {Object} range - Range specification
	 * @returns {boolean} True if key is in range
	 */
	keyMatchesRange (key, range) {
		if (range.min !== undefined && range.max !== undefined) {
			return key >= range.min && key <= range.max;
		}

		if (range.prefix !== undefined) {
			return key.startsWith(range.prefix);
		}

		if (range.pattern !== undefined) {
			try {
				const regex = new RegExp(range.pattern);

				return regex.test(key);
			} catch {
				return false;
			}
		}

		return false;
	}

	/**
	 * Check if key matches a query specification
	 * @param {string} key - Key to check
	 * @param {Object} queryInfo - Query specification
	 * @returns {boolean} True if key matches query
	 */
	keyMatchesQuery (key, queryInfo) {
		if (queryInfo.type === "range") {
			return this.keyMatchesRange(key, queryInfo);
		}

		if (queryInfo.type === "prefix") {
			return key.startsWith(queryInfo.prefix || "");
		}

		if (queryInfo.type === "pattern") {
			try {
				const regex = new RegExp(queryInfo.pattern || "");

				return regex.test(key);
			} catch {
				return false;
			}
		}

		if (queryInfo.type === "in") {
			return Array.isArray(queryInfo.values) && queryInfo.values.includes(key);
		}

		return false;
	}

	/**
	 * Check if key matches an index range
	 * @param {string} key - Key to check
	 * @param {Object} indexRange - Index range specification
	 * @returns {boolean} True if key matches index range
	 */
	keyMatchesIndexRange (key, indexRange) {
		if (indexRange.fields && Array.isArray(indexRange.fields)) {
			for (const field of indexRange.fields) {
				if (key.includes(field)) {
					return true;
				}
			}
		}

		if (indexRange.values) {
			return this.keyMatchesRange(key, indexRange.values);
		}

		return false;
	}

	/**
	 * Check if two keys have a hierarchical relationship
	 * Analyzes parent-child, sibling, and ancestor-descendant relationships
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have hierarchical relationship
	 * @private
	 */
	_hasHierarchicalKeyRelationship (key1, key2) {
		const separators = [":", "/", ".", "_", "-"];

		for (const sep of separators) {
			if (key1.includes(sep) && key2.includes(sep)) {
				const parts1 = key1.split(sep);
				const parts2 = key2.split(sep);

				if (this._isParentChildRelationship(parts1, parts2) ||
					this._isSiblingRelationship(parts1, parts2) ||
					this._isAncestorDescendantRelationship(parts1, parts2)) {
					return true;
				}
			}
		}

		return key1.startsWith(key2) || key2.startsWith(key1);
	}

	/**
	 * Check if operation key and snapshot key have hierarchical relationship for snapshot range
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @returns {boolean} True if keys have hierarchical relationship
	 * @private
	 */
	_hasHierarchicalRelationship (operationKey, snapshotKey) {
		const separators = [":", "/", ".", "_", "-"];

		for (const sep of separators) {
			if (operationKey.includes(sep) && snapshotKey.includes(sep)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if operation key falls within hierarchical range of snapshot key
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if operation key is in hierarchical range
	 * @private
	 */
	_checkHierarchicalRange (operationKey, snapshotKey, expectedValue) {
		const separators = [":", "/", ".", "_", "-"];

		for (const sep of separators) {
			if (operationKey.includes(sep) && snapshotKey.includes(sep)) {
				const opParts = operationKey.split(sep);
				const snapParts = snapshotKey.split(sep);

				if (this._isParentChildRelationship(opParts, snapParts) ||
					this._isSiblingRelationship(opParts, snapParts) ||
					this._isCollectionMembership(opParts, snapParts, expectedValue)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check if two key parts arrays have a parent-child relationship
	 * @param {string[]} opParts - Parts from operation key
	 * @param {string[]} snapParts - Parts from snapshot key
	 * @returns {boolean} True if there's a parent-child relationship
	 * @private
	 */
	_isParentChildRelationship (opParts, snapParts) {
		if (opParts.length > snapParts.length) {
			for (let i = 0; i < snapParts.length; i++) {
				if (opParts[i] !== snapParts[i]) {
					return false;
				}
			}

			return true;
		}

		if (snapParts.length > opParts.length) {
			for (let i = 0; i < opParts.length; i++) {
				if (opParts[i] !== snapParts[i]) {
					return false;
				}
			}

			return true;
		}

		return false;
	}

	/**
	 * Check if two key parts arrays have a sibling relationship
	 * @param {string[]} opParts - Parts from operation key
	 * @param {string[]} snapParts - Parts from snapshot key
	 * @returns {boolean} True if there's a sibling relationship
	 * @private
	 */
	_isSiblingRelationship (opParts, snapParts) {
		if (opParts.length === snapParts.length && opParts.length > 1) {
			for (let i = 0; i < opParts.length - 1; i++) {
				if (opParts[i] !== snapParts[i]) {
					return false;
				}
			}

			return opParts[opParts.length - 1] !== snapParts[snapParts.length - 1];
		}

		return false;
	}

	/**
	 * Check if two key parts arrays have an ancestor-descendant relationship
	 * @param {string[]} parts1 - Parts from first key
	 * @param {string[]} parts2 - Parts from second key
	 * @returns {boolean} True if there's an ancestor-descendant relationship
	 * @private
	 */
	_isAncestorDescendantRelationship (parts1, parts2) {
		const shorter = parts1.length < parts2.length ? parts1 : parts2;
		const longer = parts1.length < parts2.length ? parts2 : parts1;

		if (shorter.length < longer.length) {
			for (let i = 0; i < shorter.length; i++) {
				if (shorter[i] !== longer[i]) {
					return false;
				}
			}

			return true;
		}

		return false;
	}

	/**
	 * Check if operation key parts indicate collection membership relative to snapshot
	 * @param {string[]} opParts - Parts from operation key
	 * @param {string[]} snapParts - Parts from snapshot key
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if operation key is collection member
	 * @private
	 */
	_isCollectionMembership (opParts, snapParts, expectedValue) {
		if (Array.isArray(expectedValue) ||
			expectedValue && typeof expectedValue === "object" && expectedValue.length !== undefined) {
			return this._isParentChildRelationship(opParts, snapParts) ||
				this._isSiblingRelationship(opParts, snapParts);
		}

		return false;
	}

	/**
	 * Check if two keys have semantic relationship based on their content meaning
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have semantic relationship
	 * @private
	 */
	_hasSemanticKeyRelationship (key1, key2) {
		const semantics1 = this._extractSemanticIdentifiers(key1);
		const semantics2 = this._extractSemanticIdentifiers(key2);

		for (const sem1 of semantics1) {
			for (const sem2 of semantics2) {
				if (this._areSemanticallySimilar(sem1, sem2)) {
					return true;
				}
			}
		}

		return this._hasEntityRelationship(semantics1, semantics2);
	}

	/**
	 * Check if operation key and snapshot key have semantic relationship for snapshot range
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @returns {boolean} True if keys have semantic relationship
	 * @private
	 */
	_hasSemanticRelationship (operationKey, snapshotKey) {
		const semanticPrefixes = [
			"user", "account", "profile", "session",
			"order", "product", "cart", "payment",
			"post", "comment", "thread", "message",
			"document", "file", "folder", "workspace"
		];

		for (const prefix of semanticPrefixes) {
			if (operationKey.toLowerCase().includes(prefix) &&
				snapshotKey.toLowerCase().includes(prefix)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if operation key falls within semantic range of snapshot key
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @returns {boolean} True if operation key is in semantic range
	 * @private
	 */
	_checkSemanticRange (operationKey, snapshotKey) {
		const opSemantics = this._extractSemanticIdentifiers(operationKey);
		const snapSemantics = this._extractSemanticIdentifiers(snapshotKey);

		for (const opSemantic of opSemantics) {
			for (const snapSemantic of snapSemantics) {
				if (this._areSemanticallySimilar(opSemantic, snapSemantic)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Extract semantic identifiers from a key string using pattern matching
	 * @param {string} key - Key to extract semantic identifiers from
	 * @returns {string[]} Array of semantic identifiers found in the key
	 * @private
	 */
	_extractSemanticIdentifiers (key) {
		const cacheKey = `semantic:${key}`;
		if (this.semanticCache.has(cacheKey)) {
			return this.semanticCache.get(cacheKey);
		}

		const identifiers = [];
		const patterns = [
			/(\w+):(\w+)/g, // entity:id
			/(\w+)_(\w+)/g, // entity_id
			/([a-z]+)([A-Z]\w+)/g // entityId (camelCase)
		];

		for (const pattern of patterns) {
			let match;
			while ((match = pattern.exec(key)) !== null) {
				identifiers.push(match[1].toLowerCase());
				if (match[2]) {
					identifiers.push(match[2].toLowerCase());
				}
			}
		}

		this.semanticCache.set(cacheKey, identifiers);

		return identifiers;
	}

	/**
	 * Check if two semantic identifiers are similar
	 * Handles singular/plural forms and semantic equivalence
	 * @param {string} id1 - First identifier
	 * @param {string} id2 - Second identifier
	 * @returns {boolean} True if identifiers are semantically similar
	 * @private
	 */
	_areSemanticallySimilar (id1, id2) {
		if (id1 === id2) {
			return true;
		}

		const singularPlural = [
			["user", "users"], ["account", "accounts"], ["profile", "profiles"],
			["order", "orders"], ["product", "products"], ["item", "items"],
			["post", "posts"], ["comment", "comments"], ["message", "messages"],
			["file", "files"], ["document", "documents"], ["folder", "folders"]
		];

		for (const [singular, plural] of singularPlural) {
			if (id1 === singular && id2 === plural ||
				id1 === plural && id2 === singular) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if two semantic identifier arrays have entity relationships
	 * @param {string[]} semantics1 - Semantic identifiers from first key
	 * @param {string[]} semantics2 - Semantic identifiers from second key
	 * @returns {boolean} True if entities have defined relationships
	 * @private
	 */
	_hasEntityRelationship (semantics1, semantics2) {
		const entityRelations = [
			["user", "profile"], ["user", "account"], ["user", "session"],
			["profile", "account"], ["account", "session"],
			["user", "order"], ["user", "cart"], ["user", "payment"],
			["order", "product"], ["order", "payment"], ["cart", "product"],
			["user", "post"], ["user", "comment"], ["user", "message"],
			["post", "comment"], ["thread", "message"], ["document", "file"],
			["user", "workspace"], ["workspace", "document"], ["workspace", "folder"],
			["folder", "file"], ["document", "file"]
		];

		for (const [entity1, entity2] of entityRelations) {
			const hasEntity1InBoth = semantics1.includes(entity1) && semantics2.includes(entity2);
			const hasEntity2InBoth = semantics1.includes(entity2) && semantics2.includes(entity1);

			if (hasEntity1InBoth || hasEntity2InBoth) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if two keys have pattern-based relationship
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have pattern-based relationship
	 * @private
	 */
	_hasPatternBasedKeyRelationship (key1, key2) {
		if (this._isPatternBasedSnapshot(key1)) {
			return this._checkPatternBasedRange(key2, key1);
		}

		if (this._isPatternBasedSnapshot(key2)) {
			return this._checkPatternBasedRange(key1, key2);
		}

		return this._haveSimilarPatterns(key1, key2);
	}

	/**
	 * Check if a snapshot key contains pattern-based wildcards or indicators
	 * @param {string} snapshotKey - Key from snapshot to check
	 * @returns {boolean} True if key contains pattern-based elements
	 * @private
	 */
	_isPatternBasedSnapshot (snapshotKey) {
		return snapshotKey.includes("*") ||
			snapshotKey.includes("?") ||
			snapshotKey.includes("[") ||
			snapshotKey.includes("{") ||
			snapshotKey.endsWith("_range") ||
			snapshotKey.endsWith("_pattern");
	}

	/**
	 * Check if operation key matches a pattern-based snapshot key range
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Pattern-based snapshot key
	 * @returns {boolean} True if operation key matches pattern
	 * @private
	 */
	_checkPatternBasedRange (operationKey, snapshotKey) {
		if (snapshotKey.includes("*")) {
			const pattern = snapshotKey.replace(/\*/g, ".*");
			try {
				const regex = new RegExp(`^${pattern}$`);

				return regex.test(operationKey);
			} catch {
				const prefix = snapshotKey.split("*")[0];

				return operationKey.startsWith(prefix);
			}
		}

		if (snapshotKey.includes("?")) {
			const pattern = snapshotKey.replace(/\?/g, ".");
			try {
				const regex = new RegExp(`^${pattern}$`);

				return regex.test(operationKey);
			} catch {
				return false;
			}
		}

		if (snapshotKey.includes("[")) {
			try {
				const regex = new RegExp(`^${snapshotKey}$`);

				return regex.test(operationKey);
			} catch {
				return false;
			}
		}

		if (snapshotKey.includes("{") && snapshotKey.includes("}")) {
			const beforeBrace = snapshotKey.substring(0, snapshotKey.indexOf("{"));
			const afterBrace = snapshotKey.substring(snapshotKey.indexOf("}") + 1);
			const choices = snapshotKey.substring(
				snapshotKey.indexOf("{") + 1,
				snapshotKey.indexOf("}")
			).split(",");

			for (const choice of choices) {
				const fullPattern = beforeBrace + choice.trim() + afterBrace;
				if (operationKey === fullPattern || operationKey.startsWith(fullPattern)) {
					return true;
				}
			}
		}

		if (snapshotKey.endsWith("_range") || snapshotKey.endsWith("_pattern")) {
			const baseKey = snapshotKey.replace(/_range$|_pattern$/, "");

			return operationKey.startsWith(baseKey);
		}

		return false;
	}

	/**
	 * Check if two keys have similar structural patterns
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have similar patterns
	 * @private
	 */
	_haveSimilarPatterns (key1, key2) {
		const pattern1 = this._extractKeyPattern(key1);
		const pattern2 = this._extractKeyPattern(key2);

		return this._patternsAreSimilar(pattern1, pattern2);
	}

	/**
	 * Extract structural pattern from a key by normalizing variable components
	 * @param {string} key - Key to extract pattern from
	 * @returns {string} Normalized pattern string
	 * @private
	 */
	_extractKeyPattern (key) {
		const cacheKey = `pattern:${key}`;
		if (this.patternCache.has(cacheKey)) {
			return this.patternCache.get(cacheKey);
		}

		const pattern = key
			.replace(/\d+/g, "#") // Numbers become #
			.replace(/[a-f0-9]{8,}/g, "&") // Hashes/UUIDs become &
			.replace(/\w{1,3}(?=:|_|-)/g, "@"); // Short prefixes become @

		this.patternCache.set(cacheKey, pattern);

		return pattern;
	}

	/**
	 * Check if two patterns are similar based on similarity threshold
	 * @param {string} pattern1 - First pattern to compare
	 * @param {string} pattern2 - Second pattern to compare
	 * @returns {boolean} True if patterns are similar (>70% similarity)
	 * @private
	 */
	_patternsAreSimilar (pattern1, pattern2) {
		if (pattern1 === pattern2) {
			return true;
		}

		const similarity = this._calculatePatternSimilarity(pattern1, pattern2);

		return similarity > 0.7;
	}

	/**
	 * Calculate similarity score between two patterns using Levenshtein distance
	 * @param {string} pattern1 - First pattern
	 * @param {string} pattern2 - Second pattern
	 * @returns {number} Similarity score between 0 and 1
	 * @private
	 */
	_calculatePatternSimilarity (pattern1, pattern2) {
		const len1 = pattern1.length;
		const len2 = pattern2.length;
		const maxLen = Math.max(len1, len2);

		if (maxLen === 0) return 1;

		const distance = this._levenshteinDistance(pattern1, pattern2);

		return 1 - distance / maxLen;
	}

	/**
	 * Calculate Levenshtein distance between two strings
	 * @param {string} str1 - First string
	 * @param {string} str2 - Second string
	 * @returns {number} Edit distance between strings
	 * @private
	 */
	_levenshteinDistance (str1, str2) {
		const matrix = [];

		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i];
		}

		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j;
		}

		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1, // substitution
						matrix[i][j - 1] + 1, // insertion
						matrix[i - 1][j] + 1 // deletion
					);
				}
			}
		}

		return matrix[str2.length][str1.length];
	}

	/**
	 * Check if two keys have temporal relationship based on time-related components
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have temporal relationship
	 * @private
	 */
	_hasTemporalKeyRelationship (key1, key2) {
		if (this._isTemporalSnapshot(key1) && this._isTemporalSnapshot(key2)) {
			const temporal1 = this._extractTemporalComponents(key1);
			const temporal2 = this._extractTemporalComponents(key2);

			return this._haveTemporalOverlap(temporal1, temporal2);
		}

		return false;
	}

	/**
	 * Check if a snapshot key contains temporal/time-related keywords
	 * @param {string} snapshotKey - Key from snapshot to check
	 * @returns {boolean} True if key contains temporal indicators
	 * @private
	 */
	_isTemporalSnapshot (snapshotKey) {
		const temporalKeywords = [
			"timestamp", "time", "date", "created", "updated", "modified",
			"datetime", "ts", "epoch", "iso", "utc", "log", "event", "history"
		];

		return temporalKeywords.some(keyword =>
			snapshotKey.toLowerCase().includes(keyword)
		);
	}

	/**
	 * Check if operation key falls within temporal range of snapshot key
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Temporal snapshot key
	 * @returns {boolean} True if operation key is in temporal range
	 * @private
	 */
	_checkTemporalRange (operationKey, snapshotKey) {
		if (this._isTemporalSnapshot(operationKey)) {
			const opTemporal = this._extractTemporalComponents(operationKey);
			const snapTemporal = this._extractTemporalComponents(snapshotKey);

			return this._haveTemporalOverlap(opTemporal, snapTemporal);
		}

		return false;
	}

	/**
	 * Extract temporal components from a key using regex patterns
	 * @param {string} key - Key to extract temporal components from
	 * @returns {Object} Object with temporal component flags
	 * @private
	 */
	_extractTemporalComponents (key) {
		const components = {
			hasDate: false,
			hasTime: false,
			hasTimestamp: false,
			hasEpoch: false
		};

		if ((/\d{4}-\d{2}-\d{2}/).test(key)) components.hasDate = true;
		if ((/\d{2}:\d{2}:\d{2}/).test(key)) components.hasTime = true;
		if ((/\d{13}/).test(key)) components.hasTimestamp = true;
		if ((/\d{10}/).test(key)) components.hasEpoch = true;

		return components;
	}

	/**
	 * Check if two temporal component objects have overlapping temporal elements
	 * @param {Object} opTemporal - Temporal components from operation key
	 * @param {Object} snapTemporal - Temporal components from snapshot key
	 * @returns {boolean} True if temporal components overlap
	 * @private
	 */
	_haveTemporalOverlap (opTemporal, snapTemporal) {
		return opTemporal.hasDate && snapTemporal.hasDate ||
			opTemporal.hasTime && snapTemporal.hasTime ||
			opTemporal.hasTimestamp && snapTemporal.hasTimestamp ||
			opTemporal.hasEpoch && snapTemporal.hasEpoch;
	}

	/**
	 * Check if two keys have composite key relationship
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have composite key relationship
	 * @private
	 */
	_hasCompositeKeyRelationship (key1, key2) {
		return this._checkCompositeKeyRange(key1, key2) ||
			this._checkCompositeKeyRange(key2, key1);
	}

	/**
	 * Check if a snapshot key represents a composite key structure
	 * @param {string} snapshotKey - Key from snapshot to check
	 * @returns {boolean} True if key is composite key structure
	 * @private
	 */
	_isCompositeKeySnapshot (snapshotKey) {
		return snapshotKey.includes(":") ||
			snapshotKey.includes("#") ||
			snapshotKey.includes("|") ||
			snapshotKey.includes("@") ||
			snapshotKey.split("_").length > 2 ||
			snapshotKey.split("-").length > 2;
	}

	/**
	 * Check if operation key falls within composite key range of snapshot key
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Composite snapshot key
	 * @returns {boolean} True if operation key is in composite key range
	 * @private
	 */
	_checkCompositeKeyRange (operationKey, snapshotKey) {
		const separators = [":", "#", "|", "@", "_", "-"];

		for (const sep of separators) {
			if (operationKey.includes(sep) && snapshotKey.includes(sep)) {
				const opParts = operationKey.split(sep);
				const snapParts = snapshotKey.split(sep);

				if (this._hasCompositeKeyOverlap(opParts, snapParts)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check if operation key parts overlap with snapshot key parts in composite key
	 * @param {string[]} opParts - Parts from operation key
	 * @param {string[]} snapParts - Parts from snapshot key
	 * @returns {boolean} True if key parts have composite overlap
	 * @private
	 */
	_hasCompositeKeyOverlap (opParts, snapParts) {
		const minLength = Math.min(opParts.length, snapParts.length);

		for (let i = 1; i <= minLength; i++) {
			let allMatch = true;
			for (let j = 0; j < i; j++) {
				if (opParts[j] !== snapParts[j]) {
					allMatch = false;
					break;
				}
			}
			if (allMatch) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if two keys have index-based relationship
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have index relationship
	 * @private
	 */
	_hasIndexKeyRelationship (key1, key2) {
		const isIndex1 = this._isIndexKey(key1);
		const isIndex2 = this._isIndexKey(key2);

		if (isIndex1 || isIndex2) {
			const base1 = this._extractBaseKeyFromIndex(key1);
			const base2 = this._extractBaseKeyFromIndex(key2);

			return base1 === base2 ||
				key1.startsWith(base2) ||
				key2.startsWith(base1) ||
				base1.startsWith(base2) ||
				base2.startsWith(base1);
		}

		return false;
	}

	/**
	 * Check if a key represents an index key structure
	 * @param {string} key - Key to check
	 * @returns {boolean} True if key is an index key
	 * @private
	 */
	_isIndexKey (key) {
		return key.includes("_index") ||
			key.includes("_idx") ||
			key.startsWith("idx_") ||
			key.includes("_key") ||
			key.includes("_lookup");
	}

	/**
	 * Extract base key from an index key by removing index-specific suffixes
	 * @param {string} indexKey - Index key to extract base from
	 * @returns {string} Base key without index identifiers
	 * @private
	 */
	_extractBaseKeyFromIndex (indexKey) {
		return indexKey
			.replace(/_index.*$/, "")
			.replace(/_idx.*$/, "")
			.replace(/^idx_/, "")
			.replace(/_key.*$/, "")
			.replace(/_lookup.*$/, "");
	}

	/**
	 * Check if a snapshot key represents an index-based query
	 * @param {Transaction} transaction - Transaction containing snapshot
	 * @param {string} snapshotKey - Key from snapshot to check
	 * @returns {boolean} True if snapshot is index-based
	 * @private
	 */
	_isIndexBasedSnapshot (transaction, snapshotKey) {
		return snapshotKey.includes("_index") ||
			snapshotKey.includes("_idx") ||
			snapshotKey.startsWith("idx_") ||
			transaction.snapshot.has(`${snapshotKey}:index_range`);
	}

	/**
	 * Check if operation key falls within index-based range of snapshot key
	 * @param {Transaction} transaction - Transaction containing snapshot
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Index-based snapshot key
	 * @returns {boolean} True if operation key is in index range
	 * @private
	 */
	_checkIndexBasedRange (transaction, operationKey, snapshotKey) {
		const indexRange = transaction.snapshot.get(`${snapshotKey}:index_range`);
		if (indexRange) {
			return this.keyMatchesIndexRange(operationKey, indexRange);
		}

		if (snapshotKey.includes("_index") || snapshotKey.includes("_idx")) {
			const baseKey = snapshotKey.replace(/_index.*$|_idx.*$/, "");

			return operationKey.startsWith(baseKey);
		}

		return false;
	}

	/**
	 * Check if two keys have collection-based relationship
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have collection relationship
	 * @private
	 */
	_hasCollectionKeyRelationship (key1, key2) {
		const isCollection1 = this._isCollectionKey(key1);
		const isCollection2 = this._isCollectionKey(key2);

		if (isCollection1 || isCollection2) {
			const base1 = this._extractCollectionBase(key1);
			const base2 = this._extractCollectionBase(key2);

			return base1 === base2 ||
				key1.startsWith(base2) ||
				key2.startsWith(base1);
		}

		return false;
	}

	/**
	 * Check if a key represents a collection structure
	 * @param {string} key - Key to check
	 * @returns {boolean} True if key is a collection key
	 * @private
	 */
	_isCollectionKey (key) {
		const collectionIndicators = [
			"_list", "_array", "_set", "_collection",
			"_items", "_elements", "_members", "_entries"
		];

		return collectionIndicators.some(indicator => key.includes(indicator));
	}

	/**
	 * Extract base key from a collection key by removing collection-specific suffixes
	 * @param {string} collectionKey - Collection key to extract base from
	 * @returns {string} Base key without collection identifiers
	 * @private
	 */
	_extractCollectionBase (collectionKey) {
		const indicators = ["_list", "_array", "_set", "_collection", "_items", "_elements", "_members", "_entries"];

		for (const indicator of indicators) {
			if (collectionKey.includes(indicator)) {
				return collectionKey.replace(indicator, "");
			}
		}

		return collectionKey;
	}

	/**
	 * Check if two keys have functional dependency relationship
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have functional dependency
	 * @private
	 */
	_hasFunctionalDependency (key1, key2) {
		const dependencies = [
			["user_id", "user_email"], ["user_id", "user_profile"],
			["account_id", "user_id"], ["session_id", "user_id"],
			["order_id", "user_id"], ["order_id", "order_total"],
			["payment_id", "order_id"], ["shipping_id", "order_id"],
			["post_id", "user_id"], ["comment_id", "post_id"],
			["message_id", "thread_id"], ["file_id", "folder_id"],
			["document_id", "workspace_id"], ["task_id", "project_id"]
		];

		const norm1 = this._normalizeKeyForDependency(key1);
		const norm2 = this._normalizeKeyForDependency(key2);

		for (const [dep1, dep2] of dependencies) {
			if (norm1.includes(dep1) && norm2.includes(dep2) ||
				norm1.includes(dep2) && norm2.includes(dep1)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Normalize a key for functional dependency comparison by converting to standard format
	 * @param {string} key - Key to normalize
	 * @returns {string} Normalized key in lowercase with underscores
	 * @private
	 */
	_normalizeKeyForDependency (key) {
		return key.toLowerCase()
			.replace(/[:\-/.]/g, "_")
			.replace(/([a-z])([A-Z])/g, "$1_$2")
			.toLowerCase();
	}

	/**
	 * Check if transaction snapshot has explicit range metadata for a key
	 * @param {Transaction} transaction - Transaction containing snapshot
	 * @param {string} snapshotKey - Key from snapshot to check
	 * @returns {boolean} True if explicit range metadata exists
	 * @private
	 */
	_hasExplicitRangeMetadata (transaction, snapshotKey) {
		return transaction.snapshot.has(`${snapshotKey}:range`) ||
			transaction.snapshot.has(`${snapshotKey}:query`) ||
			transaction.snapshot.has(`${snapshotKey}:predicate`);
	}

	/**
	 * Check if operation key matches explicit range metadata for snapshot key
	 * @param {Transaction} transaction - Transaction containing snapshot
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Key from snapshot with explicit range
	 * @returns {boolean} True if operation key matches explicit range
	 * @private
	 */
	_checkExplicitRange (transaction, operationKey, snapshotKey) {
		const rangeInfo = transaction.snapshot.get(`${snapshotKey}:range`);
		if (rangeInfo && typeof rangeInfo === "object") {
			return this.keyMatchesRange(operationKey, rangeInfo);
		}

		const queryInfo = transaction.snapshot.get(`${snapshotKey}:query`);
		if (queryInfo) {
			return this.keyMatchesQuery(operationKey, queryInfo);
		}

		const predicateInfo = transaction.snapshot.get(`${snapshotKey}:predicate`);
		if (predicateInfo && typeof predicateInfo === "function") {
			try {
				return predicateInfo(operationKey);
			} catch {
				return false;
			}
		}

		return false;
	}

	/**
	 * Clear internal caches
	 */
	clearCaches () {
		this.patternCache.clear();
		this.semanticCache.clear();
	}
}/**
 * Deadlock detector using multiple detection strategies
 */
class DeadlockDetector {
	constructor (lockManager) {
		this.lockManager = lockManager;
		this.keyAnalyzer = new KeyRelationshipAnalyzer();
	}

	/**
	 * Check for deadlocks using multiple detection strategies
	 * @param {Transaction[]} activeTransactions - Active transactions
	 * @param {Object} [options={}] - Detection options
	 * @returns {Object} Deadlock detection results
	 */
	detectDeadlocks (activeTransactions, options = {}) {
		const opts = {
			useLockGraph: true,
			useResourceGraph: true,
			useTimeoutDetection: true,
			timeoutThreshold: 10000,
			...options
		};

		const results = {
			deadlocks: [],
			suspectedDeadlocks: [],
			timeoutVictims: [],
			waitForGraph: null,
			resourceGraph: null
		};

		if (activeTransactions.length < 2) {
			return results;
		}

		// 1. Lock-based wait-for graph deadlock detection
		if (opts.useLockGraph) {
			const lockDeadlocks = this._detectLockBasedDeadlocks(activeTransactions);
			results.deadlocks.push(...lockDeadlocks.cycles);
			results.waitForGraph = lockDeadlocks.graph;
		}

		// 2. Resource allocation graph deadlock detection
		if (opts.useResourceGraph) {
			const resourceDeadlocks = this._detectResourceDeadlocks(activeTransactions);
			results.deadlocks.push(...resourceDeadlocks.cycles);
			results.resourceGraph = resourceDeadlocks.graph;
		}

		// 3. Isolation-level based deadlock detection
		const isolationDeadlocks = this._detectIsolationDeadlocks(activeTransactions);
		results.suspectedDeadlocks.push(...isolationDeadlocks);

		// 4. Timeout-based deadlock detection (fallback)
		if (opts.useTimeoutDetection) {
			const timeoutVictims = this._detectTimeoutVictims(activeTransactions, opts.timeoutThreshold);
			results.timeoutVictims.push(...timeoutVictims);
		}

		// Remove duplicates and merge results
		results.deadlocks = this._deduplicateDeadlocks(results.deadlocks);

		return results;
	}

	/**
	 * Detect deadlocks using lock-based wait-for graph
	 * @param {Transaction[]} activeTransactions - Active transactions
	 * @returns {Object} Lock-based deadlock detection results
	 * @private
	 */
	_detectLockBasedDeadlocks (activeTransactions) {
		const waitForGraph = this._buildLockWaitForGraph(activeTransactions);
		const cycles = this._detectCyclesInGraph(waitForGraph);

		return {
			graph: waitForGraph,
			cycles: cycles.map(cycle => ({
				type: "lock",
				transactions: cycle,
				resources: this._getResourcesInvolvedInCycle(cycle, activeTransactions)
			}))
		};
	}

	/**
	 * Build wait-for graph based on lock dependencies
	 * @param {Transaction[]} transactions - Active transactions
	 * @returns {Map<string, Set<string>>} Wait-for graph
	 * @private
	 */
	_buildLockWaitForGraph (transactions) {
		const graph = new Map();
		const lockStats = this.lockManager.getStats();

		// Initialize graph nodes
		for (const tx of transactions) {
			graph.set(tx.id, new Set());
		}

		// Build edges based on lock conflicts
		for (const lockInfo of lockStats.recordsLocked) {
			const { recordKey, holders } = lockInfo;

			// Find transactions waiting for this lock
			const waitingTransactions = this._findTransactionsWaitingForLock(recordKey, transactions);

			// Create edges from waiting transactions to lock holders
			for (const waitingTx of waitingTransactions) {
				for (const holderId of holders) {
					if (waitingTx !== holderId && graph.has(waitingTx) && graph.has(holderId)) {
						graph.get(waitingTx).add(holderId);
					}
				}
			}
		}

		return graph;
	}

	/**
	 * Find transactions that are waiting for a specific lock
	 * @param {string} recordKey - Record key
	 * @param {Transaction[]} transactions - All transactions to check
	 * @returns {string[]} Transaction IDs waiting for the lock
	 * @private
	 */
	_findTransactionsWaitingForLock (recordKey, transactions) {
		const waiting = [];

		for (const tx of transactions) {
			const hasOperationOnKey = tx.writeSet.has(recordKey) || tx.readSet.has(recordKey);
			const holdsLock = this.lockManager.holdsLocks(tx.id);

			if (hasOperationOnKey && !holdsLock) {
				waiting.push(tx.id);
			}
		}

		return waiting;
	}

	/**
	 * Detect deadlocks using resource allocation graph
	 * @param {Transaction[]} activeTransactions - Active transactions
	 * @returns {Object} Resource-based deadlock detection results
	 * @private
	 */
	_detectResourceDeadlocks (activeTransactions) {
		const resourceGraph = this._buildResourceAllocationGraph(activeTransactions);
		const cycles = this._detectCyclesInResourceGraph(resourceGraph);

		return {
			graph: resourceGraph,
			cycles: cycles.map(cycle => ({
				type: "resource",
				transactions: cycle.transactions,
				resources: cycle.resources
			}))
		};
	}

	/**
	 * Build resource allocation graph
	 * @param {Transaction[]} transactions - Active transactions
	 * @returns {Object} Resource allocation graph
	 * @private
	 */
	_buildResourceAllocationGraph (transactions) {
		const graph = {
			transactions: new Map(), // tx -> Set<resources>
			resources: new Map(), // resource -> Set<tx>
			waiting: new Map() // tx -> Set<resources waiting for>
		};

		// Initialize
		for (const tx of transactions) {
			graph.transactions.set(tx.id, new Set());
			graph.waiting.set(tx.id, new Set());
		}

		// Build allocation and waiting relationships
		const lockStats = this.lockManager.getStats();

		for (const lockInfo of lockStats.recordsLocked) {
			const { recordKey, holders } = lockInfo;

			if (!graph.resources.has(recordKey)) {
				graph.resources.set(recordKey, new Set());
			}

			// Record allocations
			for (const holderId of holders) {
				if (graph.transactions.has(holderId)) {
					graph.transactions.get(holderId).add(recordKey);
					graph.resources.get(recordKey).add(holderId);
				}
			}

			// Record waiting relationships
			const waitingTx = this._findTransactionsWaitingForLock(recordKey, transactions);
			for (const txId of waitingTx) {
				if (graph.waiting.has(txId)) {
					graph.waiting.get(txId).add(recordKey);
				}
			}
		}

		return graph;
	}

	/**
	 * Detect cycles in a wait-for graph
	 * @param {Map<string, Set<string>>} graph - Wait-for graph
	 * @returns {string[][]} Array of cycles (each cycle is array of transaction IDs)
	 * @private
	 */
	_detectCyclesInGraph (graph) {
		const visited = new Set();
		const recursionStack = new Set();
		const cycles = [];

		const dfs = (node, path) => {
			if (recursionStack.has(node)) {
				// Found a cycle
				const cycleStart = path.indexOf(node);
				const cycle = path.slice(cycleStart);
				cycles.push([...cycle, node]);

				return;
			}

			if (visited.has(node)) {
				return;
			}

			visited.add(node);
			recursionStack.add(node);
			path.push(node);

			const neighbors = graph.get(node) || new Set();
			for (const neighbor of neighbors) {
				dfs(neighbor, [...path]);
			}

			recursionStack.delete(node);
		};

		// Start DFS from each unvisited node
		for (const node of graph.keys()) {
			if (!visited.has(node)) {
				dfs(node, []);
			}
		}

		return cycles;
	}

	/**
	 * Detect cycles in resource allocation graph
	 * @param {Object} resourceGraph - Resource allocation graph
	 * @returns {Object[]} Array of resource-based cycles
	 * @private
	 */
	_detectCyclesInResourceGraph (resourceGraph) {
		const cycles = [];

		// Convert resource graph to wait-for graph
		const waitForGraph = new Map();

		for (const [txId] of resourceGraph.transactions) {
			waitForGraph.set(txId, new Set());
		}

		// Build wait-for relationships
		for (const [waitingTx, wantedResources] of resourceGraph.waiting) {
			for (const resource of wantedResources) {
				const holders = resourceGraph.resources.get(resource) || new Set();
				for (const holdingTx of holders) {
					if (waitingTx !== holdingTx) {
						waitForGraph.get(waitingTx).add(holdingTx);
					}
				}
			}
		}

		// Detect cycles in the converted graph
		const graphCycles = this._detectCyclesInGraph(waitForGraph);

		// Convert back to resource cycles
		for (const cycle of graphCycles) {
			const resources = this._getResourcesInvolvedInCycle(cycle,
				Array.from(resourceGraph.transactions.keys()).map(id => ({ id })));
			cycles.push({
				transactions: cycle,
				resources: Array.from(resources)
			});
		}

		return cycles;
	}

	/**
	 * Get resources involved in a deadlock cycle
	 * @param {string[]} cycle - Array of transaction IDs in cycle
	 * @param {Transaction[]|Object[]} transactions - Transaction objects or objects with id
	 * @returns {Set<string>} Set of resource keys involved
	 * @private
	 */
	_getResourcesInvolvedInCycle (cycle, transactions) {
		const resources = new Set();

		for (const txId of cycle) {
			const tx = transactions.find(t => t.id === txId);
			if (tx && tx.writeSet && tx.readSet) {
				for (const key of tx.writeSet) {
					resources.add(key);
				}
				for (const key of tx.readSet) {
					resources.add(key);
				}
			}
		}

		return resources;
	}

	/**
	 * Detect isolation-level based deadlocks
	 * @param {Transaction[]} activeTransactions - Active transactions
	 * @returns {Object[]} Array of suspected isolation deadlocks
	 * @private
	 */
	_detectIsolationDeadlocks (activeTransactions) {
		const suspectedDeadlocks = [];

		for (let i = 0; i < activeTransactions.length; i++) {
			for (let j = i + 1; j < activeTransactions.length; j++) {
				const tx1 = activeTransactions[i];
				const tx2 = activeTransactions[j];

				if (this._hasIsolationConflict(tx1, tx2)) {
					suspectedDeadlocks.push({
						type: "isolation",
						transactions: [tx1.id, tx2.id],
						conflict: this._getIsolationConflictType(tx1, tx2)
					});
				}
			}
		}

		return suspectedDeadlocks;
	}

	/**
	 * Check if two transactions have isolation conflicts
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @returns {boolean} True if isolation conflict exists
	 * @private
	 */
	_hasIsolationConflict (tx1, tx2) {
		if (tx1.isolationLevel >= IsolationLevels.REPEATABLE_READ ||
			tx2.isolationLevel >= IsolationLevels.REPEATABLE_READ) {

			const tx1ReadsWhatTx2Writes = this._readsOtherWrites(tx1, tx2);
			const tx2ReadsWhatTx1Writes = this._readsOtherWrites(tx2, tx1);

			return tx1ReadsWhatTx2Writes || tx2ReadsWhatTx1Writes;
		}

		return false;
	}

	/**
	 * Get the type of isolation conflict between transactions
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @returns {string} Conflict type description
	 * @private
	 */
	_getIsolationConflictType (tx1, tx2) {
		if (this._readsOtherWrites(tx1, tx2) && this._readsOtherWrites(tx2, tx1)) {
			return "bidirectional-dependency";
		} else if (this._readsOtherWrites(tx1, tx2)) {
			return "tx1-depends-on-tx2";
		} else if (this._readsOtherWrites(tx2, tx1)) {
			return "tx2-depends-on-tx1";
		}

		return "unknown";
	}

	/**
	 * Check if one transaction reads what another writes
	 * @param {Transaction} reader - Reading transaction
	 * @param {Transaction} writer - Writing transaction
	 * @returns {boolean} True if dependency exists
	 * @private
	 */
	_readsOtherWrites (reader, writer) {
		for (const readKey of reader.readSet) {
			if (writer.writeSet.has(readKey)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Detect timeout-based deadlock victims
	 * @param {Transaction[]} activeTransactions - Active transactions
	 * @param {number} timeoutThreshold - Timeout threshold in milliseconds
	 * @returns {string[]} Transaction IDs that have timed out
	 * @private
	 */
	_detectTimeoutVictims (activeTransactions, timeoutThreshold) {
		const victims = [];

		for (const transaction of activeTransactions) {
			const duration = transaction.getDuration();
			if (duration !== null && duration > timeoutThreshold) {
				victims.push(transaction.id);
			}
		}

		return victims;
	}

	/**
	 * Remove duplicate deadlocks from results
	 * @param {Object[]} deadlocks - Array of deadlock objects
	 * @returns {Object[]} Deduplicated deadlocks
	 * @private
	 */
	_deduplicateDeadlocks (deadlocks) {
		const seen = new Set();
		const unique = [];

		for (const deadlock of deadlocks) {
			const signature = this._createDeadlockSignature(deadlock);

			if (!seen.has(signature)) {
				seen.add(signature);
				unique.push(deadlock);
			}
		}

		return unique;
	}

	/**
	 * Create a normalized signature for a deadlock
	 * @param {Object} deadlock - Deadlock object
	 * @returns {string} Normalized signature
	 * @private
	 */
	_createDeadlockSignature (deadlock) {
		const sortedTransactions = [...deadlock.transactions].sort();
		const sortedResources = deadlock.resources ? [...deadlock.resources].sort() : [];

		return `${deadlock.type}:${sortedTransactions.join(",")}:${sortedResources.join(",")}`;
	}
}/**
 * Validator for transaction isolation levels and conflict detection
 */
class IsolationValidator {
	constructor () {
		this.keyAnalyzer = new KeyRelationshipAnalyzer();
	}

	/**
	 * Validate isolation level requirements for a transaction
	 * @param {Transaction} transaction - Transaction to validate
	 * @param {Map<string, Transaction>} allTransactions - All active transactions
	 * @throws {TransactionError} If isolation violation detected
	 */
	validateIsolation (transaction, allTransactions) {
		switch (transaction.isolationLevel) {
			case IsolationLevels.READ_UNCOMMITTED:
				// No validation needed - allows dirty reads
				break;

			case IsolationLevels.READ_COMMITTED:
				this._validateReadCommitted(transaction, allTransactions);
				break;

			case IsolationLevels.REPEATABLE_READ:
				this._validateRepeatableRead(transaction, allTransactions);
				break;

			case IsolationLevels.SERIALIZABLE:
				this._validateSerializable(transaction, allTransactions);
				break;

			default:
				throw new TransactionError(
					`Unknown isolation level: ${transaction.isolationLevel}`,
					transaction.id,
					"isolation"
				);
		}
	}

	/**
	 * Validate READ_COMMITTED isolation level
	 * @param {Transaction} transaction - Transaction to validate
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @throws {TransactionError} If isolation violation detected
	 * @private
	 */
	_validateReadCommitted (transaction, allTransactions) {
		for (const writeKey of transaction.writeSet) {
			const conflictingTransactions = this._findConflictingWrites(transaction.id, writeKey, allTransactions);
			if (conflictingTransactions.length > 0) {
				throw new TransactionError(
					`Write conflict detected on key '${writeKey}' with transactions: ${conflictingTransactions.join(", ")}`,
					transaction.id,
					"write-conflict"
				);
			}
		}
	}

	/**
	 * Validate REPEATABLE_READ isolation level
	 * @param {Transaction} transaction - Transaction to validate
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @throws {TransactionError} If isolation violation detected
	 * @private
	 */
	_validateRepeatableRead (transaction, allTransactions) {
		// First validate READ_COMMITTED requirements
		this._validateReadCommitted(transaction, allTransactions);

		// Check for repeatable read violations
		for (const readKey of transaction.readSet) {
			if (this._hasReadSetConflict(transaction, readKey, allTransactions)) {
				throw new TransactionError(
					`Repeatable read violation: key '${readKey}' was modified by another transaction`,
					transaction.id,
					"repeatable-read-violation"
				);
			}
		}

		// Check for phantom reads in range queries
		if (transaction.snapshot.size > 0) {
			for (const [snapshotKey, snapshotValue] of transaction.snapshot) {
				if (this._hasSnapshotConflict(transaction, snapshotKey, snapshotValue, allTransactions)) {
					throw new TransactionError(
						`Phantom read detected: snapshot inconsistency for key '${snapshotKey}'`,
						transaction.id,
						"phantom-read"
					);
				}
			}
		}
	}

	/**
	 * Validate SERIALIZABLE isolation level
	 * @param {Transaction} transaction - Transaction to validate
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @throws {TransactionError} If isolation violation detected
	 * @private
	 */
	_validateSerializable (transaction, allTransactions) {
		// First validate REPEATABLE_READ requirements
		this._validateRepeatableRead(transaction, allTransactions);

		// Check for read-write conflicts
		for (const readKey of transaction.readSet) {
			const conflictingWrites = this._findConflictingWritesToRead(transaction, readKey, allTransactions);
			if (conflictingWrites.length > 0) {
				throw new TransactionError(
					`Serialization conflict: key '${readKey}' was written by concurrent transactions: ${conflictingWrites.join(", ")}`,
					transaction.id,
					"serialization-conflict"
				);
			}
		}

		// Check for write-read conflicts
		for (const writeKey of transaction.writeSet) {
			const conflictingReads = this._findConflictingReadsToWrite(transaction, writeKey, allTransactions);
			if (conflictingReads.length > 0) {
				throw new TransactionError(
					`Serialization conflict: key '${writeKey}' was read by concurrent transactions: ${conflictingReads.join(", ")}`,
					transaction.id,
					"serialization-conflict"
				);
			}
		}
	}

	/**
	 * Find transactions that have conflicting writes to the same key
	 * @param {string} excludeTransactionId - Transaction ID to exclude from search
	 * @param {string} key - Key to check for conflicts
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {string[]} Array of conflicting transaction IDs
	 * @private
	 */
	_findConflictingWrites (excludeTransactionId, key, allTransactions) {
		const conflicting = [];

		for (const [txId, transaction] of allTransactions) {
			if (txId !== excludeTransactionId &&
				transaction.isActive() &&
				transaction.writeSet.has(key)) {
				conflicting.push(txId);
			}
		}

		return conflicting;
	}

	/**
	 * Find transactions that wrote to a key this transaction read
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Key that was read
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {string[]} Array of conflicting transaction IDs
	 * @private
	 */
	_findConflictingWritesToRead (transaction, key, allTransactions) {
		const conflicting = [];

		for (const [txId, otherTx] of allTransactions) {
			if (txId !== transaction.id &&
				otherTx.isActive() &&
				otherTx.writeSet.has(key) &&
				this._transactionsOverlap(transaction, otherTx)) {
				conflicting.push(txId);
			}
		}

		return conflicting;
	}

	/**
	 * Find transactions that read a key this transaction wrote
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Key that was written
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {string[]} Array of conflicting transaction IDs
	 * @private
	 */
	_findConflictingReadsToWrite (transaction, key, allTransactions) {
		const conflicting = [];

		for (const [txId, otherTx] of allTransactions) {
			if (txId !== transaction.id &&
				otherTx.isActive() &&
				otherTx.readSet.has(key) &&
				this._transactionsOverlap(transaction, otherTx)) {
				conflicting.push(txId);
			}
		}

		return conflicting;
	}

	/**
	 * Check if a read key has conflicts with other transactions
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Key that was read
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {boolean} True if conflict detected
	 * @private
	 */
	_hasReadSetConflict (transaction, key, allTransactions) {
		for (const [txId, otherTx] of allTransactions) {
			if (txId !== transaction.id &&
				otherTx.isCommitted() &&
				otherTx.writeSet.has(key) &&
				otherTx.startTime > transaction.startTime &&
				otherTx.endTime < new Date()) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if snapshot has conflicts indicating phantom reads
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Snapshot key
	 * @param {*} expectedValue - Expected value from snapshot
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {boolean} True if conflict detected
	 * @private
	 */
	_hasSnapshotConflict (transaction, key, expectedValue, allTransactions) {
		// Check if any other transaction modified this specific key
		if (this._hasReadSetConflict(transaction, key, allTransactions)) {
			return true;
		}

		// Check for phantom reads in range-based operations
		for (const [txId, otherTx] of allTransactions) {
			if (txId !== transaction.id && this._transactionsOverlap(transaction, otherTx)) {
				if (this._hasPhantomConflict(transaction, otherTx, key, expectedValue)) {
					return true;
				}
			}
		}

		// Check for serialization anomalies specific to snapshots
		if (this._hasSerializationAnomalyInSnapshot(transaction, key, allTransactions)) {
			return true;
		}

		return false;
	}

	/**
	 * Check if another transaction creates phantom reads for this transaction's snapshot
	 * @param {Transaction} transaction - Transaction with snapshot
	 * @param {Transaction} otherTransaction - Other concurrent transaction
	 * @param {string} key - Snapshot key
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if phantom conflict detected
	 * @private
	 */
	_hasPhantomConflict (transaction, otherTransaction, key, expectedValue) {
		for (const operation of otherTransaction.operations) {
			if (operation.type !== "read") {
				if (operation.key === key) {
					return true;
				}

				if (this.keyAnalyzer.isKeyInSnapshotRange(transaction, operation.key, key, expectedValue)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check for serialization anomalies in snapshot data
	 * @param {Transaction} transaction - Transaction with snapshot
	 * @param {string} key - Snapshot key
	 * @param {Map<string, Transaction>} allTransactions - All transactions
	 * @returns {boolean} True if serialization anomaly detected
	 * @private
	 */
	_hasSerializationAnomalyInSnapshot (transaction, key, allTransactions) {
		for (const [txId, otherTx] of allTransactions) {
			if (txId !== transaction.id &&
				otherTx.isActive() &&
				this._transactionsOverlap(transaction, otherTx)) {

				if (this._hasWriteSkewAnomaly(transaction, otherTx, key)) {
					return true;
				}

				if (this._hasDependencyCycle(transaction, otherTx)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check for write-skew anomalies between transactions
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @param {string} key - Key being checked
	 * @returns {boolean} True if write-skew detected
	 * @private
	 */
	_hasWriteSkewAnomaly (tx1, tx2, key) {
		const tx1ReadsRelated = this._hasRelatedReads(tx1, key);
		const tx2ReadsRelated = this._hasRelatedReads(tx2, key);

		if (!tx1ReadsRelated || !tx2ReadsRelated) {
			return false;
		}

		const tx1Writes = Array.from(tx1.writeSet);
		const tx2Writes = Array.from(tx2.writeSet);
		const hasOverlappingWrites = tx1Writes.some(k => tx2Writes.includes(k));

		if (hasOverlappingWrites) {
			return false;
		}

		return tx1Writes.length > 0 && tx2Writes.length > 0;
	}

	/**
	 * Check if transaction has reads related to a key
	 * @param {Transaction} transaction - Transaction to check
	 * @param {string} key - Reference key
	 * @returns {boolean} True if has related reads
	 * @private
	 */
	_hasRelatedReads (transaction, key) {
		for (const readKey of transaction.readSet) {
			if (this.keyAnalyzer.areKeysRelated(readKey, key)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check for dependency cycles between transactions
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @returns {boolean} True if dependency cycle detected
	 * @private
	 */
	_hasDependencyCycle (tx1, tx2) {
		const tx1ReadsTx2Writes = this._readsOtherWrites(tx1, tx2);
		const tx2ReadsTx1Writes = this._readsOtherWrites(tx2, tx1);

		return tx1ReadsTx2Writes && tx2ReadsTx1Writes;
	}

	/**
	 * Check if one transaction reads what another writes
	 * @param {Transaction} reader - Reading transaction
	 * @param {Transaction} writer - Writing transaction
	 * @returns {boolean} True if dependency exists
	 * @private
	 */
	_readsOtherWrites (reader, writer) {
		for (const readKey of reader.readSet) {
			if (writer.writeSet.has(readKey)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if two transactions have overlapping execution periods
	 * @param {Transaction} tx1 - First transaction
	 * @param {Transaction} tx2 - Second transaction
	 * @returns {boolean} True if transactions overlap in time
	 * @private
	 */
	_transactionsOverlap (tx1, tx2) {
		if (!tx1.startTime || !tx2.startTime) {
			return false;
		}

		const tx1Start = tx1.startTime.getTime();
		const tx1End = tx1.endTime ? tx1.endTime.getTime() : Date.now();
		const tx2Start = tx2.startTime.getTime();
		const tx2End = tx2.endTime ? tx2.endTime.getTime() : Date.now();

		return tx1Start < tx2End && tx2Start < tx1End;
	}
}/**
 * Refactored transaction manager for coordinating multiple transactions
 * Delegates complex operations to specialized classes
 */
class TransactionManager {
	constructor () {
		// Active transactions
		this.transactions = new Map();

		// Lock manager for concurrency control
		this.lockManager = new LockManager();

		// Global transaction counter
		this.transactionCounter = 0;

		// Specialized components
		this.statistics = new TransactionStatistics();
		this.deadlockDetector = new DeadlockDetector(this.lockManager);
		this.isolationValidator = new IsolationValidator();
	}

	/**
	 * Begin a new transaction
	 * @param {Object} [options={}] - Transaction options
	 * @returns {Transaction} New transaction instance
	 */
	begin (options = {}) {
		const transaction = new Transaction(undefined, options);
		transaction.begin();

		this.transactions.set(transaction.id, transaction);
		this.transactionCounter++;
		this.statistics.incrementTotal();
		this.statistics.incrementActive();

		return transaction;
	}

	/**
	 * Get transaction by ID
	 * @param {string} transactionId - Transaction ID
	 * @returns {Transaction|undefined} Transaction instance
	 */
	getTransaction (transactionId) {
		return this.transactions.get(transactionId);
	}

	/**
	 * Commit a transaction
	 * @param {string} transactionId - Transaction ID
	 * @param {Object} [context] - Commit context
	 * @returns {Transaction} Committed transaction
	 * @throws {TransactionError} If transaction not found or commit fails
	 */
	async commit (transactionId, context = {}) {
		const transaction = this.transactions.get(transactionId);
		if (!transaction) {
			throw new TransactionError(`Transaction ${transactionId} not found`, transactionId, "commit");
		}

		try {
			// Acquire locks for all writes
			for (const key of transaction.writeSet) {
				await this.lockManager.acquireLock(transactionId, key, LockTypes.EXCLUSIVE);
			}

			// Perform isolation level checks using specialized validator
			this.isolationValidator.validateIsolation(transaction, this.transactions);

			// Commit the transaction
			transaction.commit(context);

			// Update statistics
			this.statistics.incrementCommitted();
			this.statistics.decrementActive();
			this.statistics.updateDurationStats(transaction);

			return transaction;
		} catch (error) {
			// Auto-abort on failure
			this.abort(transactionId, error.message);
			throw error;
		/* c8 ignore next */ } finally {
			// Always release locks
			this.lockManager.releaseAllLocks(transactionId);
		}
	}

	/**
	 * Abort a transaction
	 * @param {string} transactionId - Transaction ID
	 * @param {string} [reason] - Reason for abort
	 * @returns {Transaction} Aborted transaction
	 * @throws {TransactionError} If transaction not found
	 */
	abort (transactionId, reason = "Manual abort") {
		const transaction = this.transactions.get(transactionId);
		if (!transaction) {
			throw new TransactionError(`Transaction ${transactionId} not found`, transactionId, "abort");
		}

		transaction.abort(reason);

		// Release all locks
		this.lockManager.releaseAllLocks(transactionId);

		// Update statistics
		this.statistics.incrementAborted();
		this.statistics.decrementActive();
		this.statistics.updateDurationStats(transaction);

		return transaction;
	}

	/**
	 * Clean up completed transactions
	 * @param {number} [maxAge=3600000] - Maximum age in milliseconds (default: 1 hour)
	 * @returns {number} Number of transactions cleaned up
	 */
	cleanup (maxAge = 3600000) {
		const cutoffTime = Date.now() - maxAge;
		let cleaned = 0;

		for (const [id, transaction] of this.transactions) {
			// Special case: maxAge of 0 means clean ALL completed transactions
			if (transaction.endTime && (maxAge === 0 || transaction.endTime.getTime() < cutoffTime)) {
				this.transactions.delete(id);
				cleaned++;
			}
		}

		return cleaned;
	}

	/**
	 * Get all active transactions
	 * @returns {Transaction[]} Array of active transactions
	 */
	getActiveTransactions () {
		return Array.from(this.transactions.values()).filter(t => t.isActive());
	}

	/**
	 * Check for deadlocks using specialized detector
	 * @param {Object} [options={}] - Detection options
	 * @returns {Object} Deadlock detection results
	 */
	detectDeadlocks (options = {}) {
		const activeTransactions = this.getActiveTransactions();

		return this.deadlockDetector.detectDeadlocks(activeTransactions, options);
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		const activeCount = this.getActiveTransactions().length;
		const lockStats = this.lockManager.getStats();

		return this.statistics.getStats(lockStats, activeCount, this.transactionCounter);
	}

	/**
	 * Reset all statistics
	 */
	resetStats () {
		this.statistics.reset();
	}

	/**
	 * Get access to specialized components for advanced usage
	 * @returns {Object} Specialized components
	 */
	getComponents () {
		return {
			statistics: this.statistics,
			deadlockDetector: this.deadlockDetector,
			isolationValidator: this.isolationValidator,
			lockManager: this.lockManager
		};
	}

	/**
	 * Validate isolation for a specific transaction (for testing/debugging)
	 * @param {string} transactionId - Transaction ID to validate
	 * @throws {TransactionError} If validation fails
	 */
	validateTransactionIsolation (transactionId) {
		const transaction = this.transactions.get(transactionId);
		if (!transaction) {
			throw new TransactionError(`Transaction ${transactionId} not found`, transactionId, "validate");
		}

		this.isolationValidator.validateIsolation(transaction, this.transactions);
	}

	/**
	 * Force deadlock detection and return results
	 * @param {Object} [options={}] - Detection options
	 * @returns {Object} Deadlock detection results
	 */
	checkForDeadlocks (options = {}) {
		return this.detectDeadlocks(options);
	}

	/**
	 * Get detailed transaction information for debugging
	 * @param {string} transactionId - Transaction ID
	 * @returns {Object|null} Detailed transaction info or null if not found
	 */
	getTransactionDetails (transactionId) {
		const transaction = this.transactions.get(transactionId);
		if (!transaction) {
			return null;
		}

		return {
			...transaction.getStats(),
			lockInfo: this.lockManager.getStats().recordsLocked.filter(
				lock => lock.holders.includes(transactionId)
			)
		};
	}

	/**
	 * Get system health information
	 * @returns {Object} System health metrics
	 */
	getSystemHealth () {
		const stats = this.getStats();
		const deadlockResults = this.detectDeadlocks();

		return {
			activeTransactions: stats.activeTransactions,
			totalTransactions: stats.totalTransactions,
			commitRate: stats.totalTransactions > 0 ? stats.committedTransactions / stats.totalTransactions : 0,
			averageDuration: stats.averageDuration,
			hasDeadlocks: deadlockResults.deadlocks.length > 0,
			suspectedDeadlocks: deadlockResults.suspectedDeadlocks.length,
			timeoutVictims: deadlockResults.timeoutVictims.length,
			totalLocks: stats.lockStats.totalLocks,
			lockUtilization: stats.lockStats.totalLocks > 0 ? stats.lockStats.uniqueHolders / stats.lockStats.totalLocks : 0
		};
	}
}/**
 * Query operation types
 */
const QueryTypes = {
	FIND: "find",
	FILTER: "filter",
	SEARCH: "search",
	WHERE: "where",
	SORT: "sort",
	LIMIT: "limit",
	AGGREGATE: "aggregate"
};

/**
 * Cost estimation factors
 */
const CostFactors = {
	INDEX_LOOKUP: 1,
	FULL_SCAN: 100,
	FILTER_EVALUATION: 10,
	SORT_OPERATION: 50,
	MEMORY_ACCESS: 1,
	COMPARISON: 2,
	REGEX_MATCH: 20
};

/**
 * Query execution plan step
 */
class QueryPlanStep {
	/**
	 * @param {string} operation - Operation type
	 * @param {Object} [options={}] - Operation options
	 * @param {number} [estimatedCost=0] - Estimated cost of this step
	 * @param {number} [estimatedRows=0] - Estimated number of rows processed
	 */
	constructor (operation, options = {}, estimatedCost = 0, estimatedRows = 0) {
		this.operation = operation;
		this.options = options;
		this.estimatedCost = estimatedCost;
		this.estimatedRows = estimatedRows;
		this.actualCost = null;
		this.actualRows = null;
		this.startTime = null;
		this.endTime = null;
	}

	/**
	 * Start execution timing
	 */
	startExecution () {
		this.startTime = Date.now();
	}

	/**
	 * End execution timing
	 * @param {number} actualRows - Actual number of rows processed
	 */
	endExecution (actualRows) {
		this.endTime = Date.now();
		this.actualCost = this.endTime - this.startTime;
		this.actualRows = actualRows;
	}

	/**
	 * Get execution statistics
	 * @returns {Object} Execution statistics
	 */
	getStats () {
		return {
			operation: this.operation,
			options: this.options,
			estimatedCost: this.estimatedCost,
			estimatedRows: this.estimatedRows,
			actualCost: this.actualCost,
			actualRows: this.actualRows,
			costAccuracy: this.actualCost && this.estimatedCost ?
				Math.abs(this.actualCost - this.estimatedCost) / this.estimatedCost :
				null,
			rowAccuracy: this.actualRows !== null && this.estimatedRows ?
				Math.abs(this.actualRows - this.estimatedRows) / this.estimatedRows :
				null
		};
	}
}

/**
 * Query execution plan
 */
class QueryPlan {
	/**
	 * @param {string} queryId - Unique query identifier
	 * @param {Object} originalQuery - Original query object
	 */
	constructor (queryId, originalQuery) {
		this.queryId = queryId;
		this.originalQuery = originalQuery;
		this.steps = [];
		this.totalEstimatedCost = 0;
		this.totalEstimatedRows = 0;
		this.totalActualCost = null;
		this.totalActualRows = null;
		this.createdAt = new Date();
		this.executedAt = null;
		this.completedAt = null;
	}

	/**
	 * Add a step to the execution plan
	 * @param {QueryPlanStep} step - Query plan step
	 * @returns {QueryPlan} This plan for chaining
	 */
	addStep (step) {
		this.steps.push(step);
		this.totalEstimatedCost += step.estimatedCost;

		return this;
	}

	/**
	 * Start plan execution
	 */
	startExecution () {
		this.executedAt = new Date();
	}

	/**
	 * Complete plan execution
	 * @param {number} actualRows - Final number of rows returned
	 */
	completeExecution (actualRows) {
		this.completedAt = new Date();
		this.totalActualRows = actualRows;
		this.totalActualCost = this.completedAt.getTime() - (this.executedAt?.getTime() || this.createdAt.getTime());
	}

	/**
	 * Get execution statistics
	 * @returns {Object} Execution statistics
	 */
	getStats () {
		return {
			queryId: this.queryId,
			originalQuery: this.originalQuery,
			stepCount: this.steps.length,
			totalEstimatedCost: this.totalEstimatedCost,
			totalEstimatedRows: this.totalEstimatedRows,
			totalActualCost: this.totalActualCost,
			totalActualRows: this.totalActualRows,
			createdAt: this.createdAt,
			executedAt: this.executedAt,
			completedAt: this.completedAt,
			steps: this.steps.map(step => step.getStats()),
			efficiency: this.totalActualCost && this.totalEstimatedCost ?
				this.totalEstimatedCost / this.totalActualCost :
				null
		};
	}

	/**
	 * Export plan for debugging
	 * @returns {Object} Exportable plan data
	 */
	export () {
		return {
			...this.getStats(),
			explanation: this._generateExplanation()
		};
	}

	/**
	 * Generate human-readable explanation of the plan
	 * @returns {string[]} Array of explanation lines
	 * @private
	 */
	_generateExplanation () {
		const explanation = [];

		explanation.push(`Query Plan for: ${JSON.stringify(this.originalQuery)}`);
		explanation.push(`Estimated cost: ${this.totalEstimatedCost}, rows: ${this.totalEstimatedRows}`);

		if (this.totalActualCost !== null) {
			explanation.push(`Actual cost: ${this.totalActualCost}, rows: ${this.totalActualRows}`);
		}

		explanation.push("");
		explanation.push("Execution steps:");

		this.steps.forEach((step, index) => {
			const stats = step.getStats();
			explanation.push(`${index + 1}. ${stats.operation} (cost: ${stats.estimatedCost}, rows: ${stats.estimatedRows})`);

			if (stats.actualCost !== null) {
				explanation.push(`   Actual: cost: ${stats.actualCost}, rows: ${stats.actualRows}`);
			}
		});

		return explanation;
	}
}

/**
 * Statistics about data distribution for cost estimation
 */
class DataStatistics {
	constructor () {
		this.totalRecords = 0;
		this.indexStatistics = new Map(); // Map<indexName, {cardinality, selectivity, histogram}>
		this.fieldStatistics = new Map(); // Map<fieldName, {nullCount, uniqueValues, dataType, avgLength}>
		this.lastUpdated = new Date();
	}

	/**
	 * Update statistics from current data
	 * @param {Map} records - Current record data
	 * @param {Map} indexes - Current index data
	 */
	update (records, indexes) {
		this.totalRecords = records.size;
		this.lastUpdated = new Date();

		// Update field statistics
		this._updateFieldStatistics(records);

		// Update index statistics
		this._updateIndexStatistics(indexes);
	}

	/**
	 * Get selectivity estimate for a field value
	 * @param {string} fieldName - Field name
	 * @returns {number} Selectivity estimate (0-1)
	 */
	getSelectivity (fieldName) {
		const fieldStats = this.fieldStatistics.get(fieldName);
		if (!fieldStats) {
			return 0.1; // Default selectivity
		}

		// Simple selectivity estimation
		return 1 / (fieldStats.uniqueValues || 1);
	}

	/**
	 * Get cardinality estimate for an index
	 * @param {string} indexName - Index name
	 * @returns {number} Cardinality estimate
	 */
	getIndexCardinality (indexName) {
		const indexStats = this.indexStatistics.get(indexName);

		return indexStats ? indexStats.cardinality : this.totalRecords;
	}

	/**
	 * Update field statistics
	 * @param {Map} records - Record data
	 * @private
	 */
	_updateFieldStatistics (records) {
		const fieldData = new Map();

		// Collect field data
		for (const record of records.values()) {
			for (const [fieldName, value] of Object.entries(record)) {
				if (!fieldData.has(fieldName)) {
					fieldData.set(fieldName, {
						values: new Set(),
						nullCount: 0,
						totalLength: 0,
						count: 0
					});
				}

				const data = fieldData.get(fieldName);
				data.count++;

				if (value === null || value === undefined) {
					data.nullCount++;
				} else {
					data.values.add(value);
					if (typeof value === "string") {
						data.totalLength += value.length;
					}
				}
			}
		}

		// Convert to statistics
		for (const [fieldName, data] of fieldData) {
			this.fieldStatistics.set(fieldName, {
				uniqueValues: data.values.size,
				nullCount: data.nullCount,
				dataType: this._inferDataType(data.values),
				avgLength: data.totalLength / data.count || 0,
				cardinality: data.values.size / this.totalRecords
			});
		}
	}

	/**
	 * Update index statistics
	 * @param {Map} indexes - Index data
	 * @private
	 */
	_updateIndexStatistics (indexes) {
		for (const [indexName, indexStorage] of indexes) {
			const stats = indexStorage.getStats();
			this.indexStatistics.set(indexName, {
				cardinality: stats.totalKeys,
				selectivity: stats.totalKeys / this.totalRecords || 1,
				avgEntriesPerKey: stats.totalEntries / stats.totalKeys || 1,
				memoryUsage: stats.memoryUsage
			});
		}
	}

	/**
	 * Infer data type from values
	 * @param {Set} values - Set of values
	 * @returns {string} Inferred data type
	 * @private
	 */
	_inferDataType (values) {
		const sample = Array.from(values).slice(0, 10);
		const types = new Set(sample.map(v => typeof v));

		if (types.size === 1) {
			return types.values().next().value;
		}

		return "mixed";
	}
}

/**
 * Query optimizer that creates efficient execution plans
 */
class QueryOptimizer {
	/**
	 * @param {Object} [options={}] - Optimizer options
	 * @param {boolean} [options.collectStatistics=true] - Whether to collect query statistics
	 * @param {number} [options.statisticsUpdateInterval=1000] - How often to update statistics (queries)
	 */
	constructor (options = {}) {
		this.options = {
			collectStatistics: true,
			statisticsUpdateInterval: 1000,
			...options
		};

		this.statistics = new DataStatistics();
		this.queryCounter = 0;
		this.planCache = new Map();
		this.executionHistory = [];
		this.maxHistorySize = 1000;
		this.cacheHits = 0;
		this.totalCacheRequests = 0;

		// Cost model adjustments based on learning
		this.costAdjustments = new Map([
			["INDEX_LOOKUP", 1.0],
			["FULL_SCAN", 1.0],
			["FILTER_EVALUATION", 1.0],
			["SORT_OPERATION", 1.0],
			["MEMORY_ACCESS", 1.0],
			["COMPARISON", 1.0],
			["REGEX_MATCH", 1.0]
		]);
		this.lastCostModelUpdate = new Date();
	}

	/**
	 * Create an optimized query plan
	 * @param {Object} query - Query object
	 * @param {Object} context - Query context (available indexes, etc.)
	 * @returns {QueryPlan} Optimized query plan
	 */
	createPlan (query, context) {
		const queryId = `query_${++this.queryCounter}`;
		const plan = new QueryPlan(queryId, query);

		// Track cache request
		this.totalCacheRequests++;

		// Check plan cache first
		const cacheKey = this._generateCacheKey(query);
		const cachedPlan = this.planCache.get(cacheKey);
		if (cachedPlan && this._isCacheValid(cachedPlan)) {
			// Cache hit
			this.cacheHits++;

			return this._copyPlan(cachedPlan, queryId);
		}

		// Cache miss - create optimized plan
		this._buildOptimizedPlan(plan, query, context);

		// Cache the plan
		this.planCache.set(cacheKey, plan);

		return plan;
	}

	/**
	 * Update statistics with current data
	 * @param {Map} records - Current records
	 * @param {Map} indexes - Current indexes
	 */
	updateStatistics (records, indexes) {
		this.statistics.update(records, indexes);
	}

	/**
	 * Record plan execution for learning
	 * @param {QueryPlan} plan - Executed plan
	 */
	recordExecution (plan) {
		if (!this.options.collectStatistics) return;

		this.executionHistory.push(plan.getStats());

		// Limit history size
		if (this.executionHistory.length > this.maxHistorySize) {
			this.executionHistory.shift();
		}

		// Periodically update statistics
		if (this.queryCounter % this.options.statisticsUpdateInterval === 0) {
			this._updateCostModel();
		}
	}

	/**
	 * Get optimal execution strategy for a query
	 * @param {Object} query - Query object
	 * @param {Object} context - Available indexes and options
	 * @returns {Object} Execution strategy
	 */
	getOptimalStrategy (query, context) {
		const strategies = this._generateStrategies(query, context);

		// Estimate costs for each strategy
		const costedStrategies = strategies.map(strategy => ({
			...strategy,
			estimatedCost: this._estimateStrategyCost(strategy)
		}));

		// Sort by estimated cost
		costedStrategies.sort((a, b) => a.estimatedCost - b.estimatedCost);

		return costedStrategies[0] || { type: "full_scan", estimatedCost: this._getAdjustedCostFactor("FULL_SCAN") * this.statistics.totalRecords };
	}

	/**
	 * Get optimizer statistics
	 * @returns {Object} Optimizer statistics
	 */
	getStats () {
		return {
			queryCounter: this.queryCounter,
			planCacheSize: this.planCache.size,
			executionHistorySize: this.executionHistory.length,
			dataStatistics: {
				totalRecords: this.statistics.totalRecords,
				lastUpdated: this.statistics.lastUpdated,
				indexCount: this.statistics.indexStatistics.size,
				fieldCount: this.statistics.fieldStatistics.size
			},
			averageQueryCost: this._calculateAverageQueryCost(),
			cacheHitRate: this._calculateCacheHitRate(),
			cacheStatistics: {
				totalRequests: this.totalCacheRequests,
				hits: this.cacheHits,
				misses: this.totalCacheRequests - this.cacheHits,
				hitRate: this._calculateCacheHitRate()
			},
			costModel: {
				adjustments: Object.fromEntries(this.costAdjustments),
				lastUpdated: this.lastCostModelUpdate
			}
		};
	}

	/**
	 * Clear optimizer caches and history
	 */
	clear () {
		this.planCache.clear();
		this.executionHistory = [];
		this.queryCounter = 0;
		this.cacheHits = 0;
		this.totalCacheRequests = 0;

		// Reset cost adjustments to default values
		this.costAdjustments.clear();
		this.costAdjustments.set("INDEX_LOOKUP", 1.0);
		this.costAdjustments.set("FULL_SCAN", 1.0);
		this.costAdjustments.set("FILTER_EVALUATION", 1.0);
		this.costAdjustments.set("SORT_OPERATION", 1.0);
		this.costAdjustments.set("MEMORY_ACCESS", 1.0);
		this.costAdjustments.set("COMPARISON", 1.0);
		this.costAdjustments.set("REGEX_MATCH", 1.0);
		this.lastCostModelUpdate = new Date();
	}

	/**
	 * Build optimized execution plan
	 * @param {QueryPlan} plan - Plan to build
	 * @param {Object} query - Query object
	 * @param {Object} context - Query context
	 * @private
	 */
	_buildOptimizedPlan (plan, query, context) {
		const strategy = this.getOptimalStrategy(query, context);

		switch (strategy.type) {
			case "index_lookup":
				this._addIndexLookupSteps(plan, strategy);
				break;
			case "filtered_scan":
				this._addFilteredScanSteps(plan, query, strategy);
				break;
			case "full_scan":
				this._addFullScanSteps(plan);
				break;
			default:
				this._addFullScanSteps(plan);
		}

		// Add post-processing steps
		this._addPostProcessingSteps(plan, query);
	}

	/**
	 * Add index lookup steps to plan
	 * @param {QueryPlan} plan - Query plan
	 * @param {Object} strategy - Execution strategy
	 * @private
	 */
	_addIndexLookupSteps (plan, strategy) {
		const step = new QueryPlanStep(
			"index_lookup",
			{
				indexName: strategy.indexName,
				lookupKey: strategy.lookupKey
			},
			this._getAdjustedCostFactor("INDEX_LOOKUP"),
			this._estimateIndexLookupRows(strategy.indexName)
		);

		plan.addStep(step);
	}

	/**
	 * Add filtered scan steps to plan
	 * @param {QueryPlan} plan - Query plan
	 * @param {Object} query - Query object
	 * @param {Object} strategy - Execution strategy
	 * @private
	 */
	_addFilteredScanSteps (plan, query, strategy) {
		// First, index lookup for partial filtering
		if (strategy.indexName) {
			this._addIndexLookupSteps(plan, strategy);
		}

		// Then, filter remaining records
		const filterStep = new QueryPlanStep(
			"filter",
			{ predicate: query.filter || query.where },
			this._getAdjustedCostFactor("FILTER_EVALUATION") * this.statistics.totalRecords,
			this.statistics.totalRecords * 0.1 // Assume 10% selectivity
		);

		plan.addStep(filterStep);
	}

	/**
	 * Add full scan steps to plan
	 * @param {QueryPlan} plan - Query plan
	 * @private
	 */
	_addFullScanSteps (plan) {
		const step = new QueryPlanStep(
			"full_scan",
			{ scanType: "sequential" },
			this._getAdjustedCostFactor("FULL_SCAN") * this.statistics.totalRecords,
			this.statistics.totalRecords
		);

		plan.addStep(step);
	}

	/**
	 * Add post-processing steps (sort, limit, etc.)
	 * @param {QueryPlan} plan - Query plan
	 * @param {Object} query - Query object
	 * @private
	 */
	_addPostProcessingSteps (plan, query) {
		// Add sort step if needed
		if (query.sort || query.sortBy) {
			const sortStep = new QueryPlanStep(
				"sort",
				{ sortField: query.sortBy, sortFunction: query.sort },
				this._getAdjustedCostFactor("SORT_OPERATION") * plan.totalEstimatedRows,
				plan.totalEstimatedRows
			);
			plan.addStep(sortStep);
		}

		// Add limit step if needed
		if (query.limit) {
			const limitStep = new QueryPlanStep(
				"limit",
				{ offset: query.offset || 0, max: query.limit },
				this._getAdjustedCostFactor("MEMORY_ACCESS"),
				Math.min(query.limit, plan.totalEstimatedRows)
			);
			plan.addStep(limitStep);
		}
	}

	/**
	 * Generate possible execution strategies
	 * @param {Object} query - Query object
	 * @param {Object} context - Available indexes and options
	 * @returns {Array} Array of possible strategies
	 * @private
	 */
	_generateStrategies (query, context) {
		const strategies = [];

		// Strategy 1: Full scan (always available)
		strategies.push({ type: "full_scan" });

		// Strategy 2: Index-based lookup
		if (query.find && context.indexManager) {
			const fields = Object.keys(query.find);
			const optimalIndex = context.indexManager.getOptimalIndex(fields);

			if (optimalIndex) {
				strategies.push({
					type: "index_lookup",
					indexName: optimalIndex,
					lookupKey: this._generateLookupKey(query.find, fields)
				});
			}
		}

		// Strategy 3: Filtered scan with partial index
		if ((query.filter || query.where) && context.indexManager) {
			const availableIndexes = context.indexManager.listIndexes();

			for (const indexName of availableIndexes) {
				strategies.push({
					type: "filtered_scan",
					indexName,
					partialFilter: true
				});
			}
		}

		return strategies;
	}

	/**
	 * Estimate cost of an execution strategy
	 * @param {Object} strategy - Execution strategy
	 * @returns {number} Estimated cost
	 * @private
	 */
	_estimateStrategyCost (strategy) {
		switch (strategy.type) {
			case "index_lookup":
				return this._getAdjustedCostFactor("INDEX_LOOKUP") +
					this._estimateIndexLookupRows(strategy.indexName, strategy.lookupKey) * this._getAdjustedCostFactor("MEMORY_ACCESS");

			case "filtered_scan": {
				const indexCost = strategy.indexName ? this._getAdjustedCostFactor("INDEX_LOOKUP") : 0;
				const filterCost = this._getAdjustedCostFactor("FILTER_EVALUATION") * this.statistics.totalRecords;

				return indexCost + filterCost;
			}

			case "full_scan":
				return this._getAdjustedCostFactor("FULL_SCAN") * this.statistics.totalRecords;

			default:
				return Number.MAX_SAFE_INTEGER;
		}
	}

	/**
	 * Get cost factor adjusted by learned performance data
	 * @param {string} factorName - Name of the cost factor
	 * @returns {number} Adjusted cost factor
	 * @private
	 */
	_getAdjustedCostFactor (factorName) {
		const baseCost = CostFactors[factorName] || 1;
		const adjustment = this.costAdjustments.get(factorName) || 1.0;

		return baseCost * adjustment;
	}

	/**
	 * Estimate number of rows returned by index lookup
	 * @param {string} indexName - Index name
	 * @returns {number} Estimated row count
	 * @private
	 */
	_estimateIndexLookupRows (indexName) {
		const indexStats = this.statistics.indexStatistics.get(indexName);
		if (!indexStats) {
			return this.statistics.totalRecords * 0.1; // Default 10%
		}

		return Math.max(1, this.statistics.totalRecords / indexStats.cardinality);
	}

	/**
	 * Generate cache key for query
	 * @param {Object} query - Query object
	 * @returns {string} Cache key
	 * @private
	 */
	_generateCacheKey (query) {
		return JSON.stringify(query);
	}

	/**
	 * Check if cached plan is still valid
	 * @param {QueryPlan} cachedPlan - Cached plan
	 * @returns {boolean} True if cache is valid
	 * @private
	 */
	_isCacheValid (cachedPlan) {
		// Simple cache invalidation based on time
		const maxAge = 5 * 60 * 1000; // 5 minutes

		return Date.now() - cachedPlan.createdAt.getTime() < maxAge;
	}

	/**
	 * Copy a cached plan with new ID
	 * @param {QueryPlan} originalPlan - Original plan
	 * @param {string} newQueryId - New query ID
	 * @returns {QueryPlan} Copied plan
	 * @private
	 */
	_copyPlan (originalPlan, newQueryId) {
		const newPlan = new QueryPlan(newQueryId, originalPlan.originalQuery);

		for (const step of originalPlan.steps) {
			const newStep = new QueryPlanStep(
				step.operation,
				step.options,
				step.estimatedCost,
				step.estimatedRows
			);
			newPlan.addStep(newStep);
		}

		return newPlan;
	}

	/**
	 * Generate lookup key from query criteria
	 * @param {Object} criteria - Query criteria
	 * @param {string[]} fields - Field names
	 * @returns {string} Lookup key
	 * @private
	 */
	_generateLookupKey (criteria, fields) {
		return fields.sort().map(field => String(criteria[field])).join("|");
	}

	/**
	 * Update cost model based on execution history
	 * @private
	 */
	_updateCostModel () {
		if (this.executionHistory.length < 10) {
			return; // Need sufficient data for meaningful analysis
		}

		this.lastCostModelUpdate = new Date();

		// Analyze each operation type separately
		const operationStats = this._analyzeOperationPerformance();

		// Update cost adjustments based on performance analysis
		for (const [operation, stats] of operationStats) {
			if (stats.sampleSize >= 3) { // Only process operations with sufficient data
				const currentAdjustment = this.costAdjustments.get(operation) || 1.0;
				let newAdjustment = currentAdjustment;

				// Calculate performance ratio (actual vs estimated)
				const performanceRatio = stats.avgActualCost / stats.avgEstimatedCost;

				if (stats.consistency > 0.7) { // Only adjust if performance is consistent
					// Gradually adjust towards the observed performance
					const learningRate = 0.1; // Conservative learning rate
					newAdjustment = currentAdjustment * (1 + learningRate * (performanceRatio - 1));

					// Clamp adjustments to reasonable bounds
					newAdjustment = Math.max(0.1, Math.min(10.0, newAdjustment));

					this.costAdjustments.set(operation, newAdjustment);
				}
			}
		}

		// Clear old execution history to prevent memory bloat
		if (this.executionHistory.length > this.maxHistorySize * 0.8) {
			this.executionHistory = this.executionHistory.slice(-Math.floor(this.maxHistorySize * 0.6));
		}
	}

	/**
	 * Analyze operation performance from execution history
	 * @returns {Map} Map of operation -> performance statistics
	 * @private
	 */
	_analyzeOperationPerformance () {
		const operationStats = new Map();

		// Process each execution in history
		for (const execution of this.executionHistory) {
			if (execution.steps && Array.isArray(execution.steps)) {
				// Analyze each step in the execution
				for (const step of execution.steps) {
					if (step.operation && step.actualCost !== null && step.estimatedCost !== 0) {
						const operation = this._mapOperationToCostFactor(step.operation);
						if (operation) {
							if (!operationStats.has(operation)) {
								operationStats.set(operation, {
									sampleSize: 0,
									totalActualCost: 0,
									totalEstimatedCost: 0,
									costs: [],
									estimatedCosts: []
								});
							}

							const stats = operationStats.get(operation);
							stats.sampleSize++;
							stats.totalActualCost += step.actualCost;
							stats.totalEstimatedCost += step.estimatedCost;
							stats.costs.push(step.actualCost);
							stats.estimatedCosts.push(step.estimatedCost);
						}
					}
				}
			}
		}

		// Calculate derived statistics
		for (const [, stats] of operationStats) {
			stats.avgActualCost = stats.totalActualCost / stats.sampleSize;
			stats.avgEstimatedCost = stats.totalEstimatedCost / stats.sampleSize;

			// Calculate consistency (inverse of coefficient of variation)
			const variance = this._calculateVariance(stats.costs, stats.avgActualCost);
			const stdDev = Math.sqrt(variance);
			const coefficientOfVariation = stdDev / stats.avgActualCost;
			stats.consistency = Math.max(0, 1 - coefficientOfVariation);

			// Calculate accuracy (how close estimates were to actual)
			const accuracyScores = stats.costs.map((actual, i) => {
				const estimated = stats.estimatedCosts[i];

				return 1 - Math.abs(actual - estimated) / Math.max(actual, estimated);
			});
			stats.accuracy = accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length;
		}

		return operationStats;
	}

	/**
	 * Map step operation to cost factor name
	 * @param {string} operation - Operation name from step
	 * @returns {string|null} Cost factor name
	 * @private
	 */
	_mapOperationToCostFactor (operation) {
		const mapping = {
			"index_lookup": "INDEX_LOOKUP",
			"full_scan": "FULL_SCAN",
			"filter": "FILTER_EVALUATION",
			"sort": "SORT_OPERATION",
			"limit": "MEMORY_ACCESS",
			"regex": "REGEX_MATCH"
		};

		return mapping[operation] || null;
	}

	/**
	 * Calculate variance of a set of values
	 * @param {number[]} values - Array of values
	 * @param {number} mean - Mean of the values
	 * @returns {number} Variance
	 * @private
	 */
	_calculateVariance (values, mean) {
		if (values.length <= 1) return 0;

		const squaredDifferences = values.map(value => Math.pow(value - mean, 2));

		return squaredDifferences.reduce((sum, diff) => sum + diff, 0) / (values.length - 1);
	}

	/**
	 * Calculate average query cost from history
	 * @returns {number} Average query cost
	 * @private
	 */
	_calculateAverageQueryCost () {
		if (this.executionHistory.length === 0) return 0;

		const totalCost = this.executionHistory.reduce((sum, plan) => sum + (plan.totalActualCost || 0), 0);

		return totalCost / this.executionHistory.length;
	}

	/**
	 * Calculate cache hit rate
	 * @returns {number} Cache hit rate (0-1)
	 * @private
	 */
	_calculateCacheHitRate () {
		if (this.totalCacheRequests === 0) return 0;

		return this.cacheHits / this.totalCacheRequests;
	}
}/**
 * Deep immutability implementation with structural sharing
 */
class ImmutableStore {
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
}/**
 * Streaming support for large datasets
 */
class DataStream {
	/**
	 * @param {Iterator} iterator - Data iterator
	 * @param {Object} [options={}] - Stream options
	 */
	constructor (iterator, options = {}) {
		this.iterator = iterator;
		this.options = {
			batchSize: 1000,
			bufferSize: 10000,
			...options
		};
		this.buffer = [];
		this.ended = false;
		this.position = 0;
	}

	/**
	 * Read next batch of records
	 * @param {number} [size] - Batch size
	 * @returns {Promise<Record[]>} Array of records
	 */
	async read (size = this.options.batchSize) {
		const batch = [];

		while (batch.length < size && !this.ended) {
			const { value, done } = this.iterator.next();

			if (done) {
				this.ended = true;
				break;
			}

			batch.push(value);
			this.position++;
		}

		return batch;
	}

	/**
	 * Read all remaining records
	 * @returns {Promise<Record[]>} All records
	 */
	async readAll () {
		const records = [];

		while (!this.ended) {
			const batch = await this.read();
			records.push(...batch);
		}

		return records;
	}

	/**
	 * Apply transformation to stream
	 * @param {Function} transform - Transform function
	 * @returns {DataStream} New transformed stream
	 */
	map (transform) {
		const transformedIterator = {
			next: () => {
				const { value, done } = this.iterator.next();

				return done ? { done: true } : { value: transform(value), done: false };
			}
		};

		return new DataStream(transformedIterator, this.options);
	}

	/**
	 * Filter stream records
	 * @param {Function} predicate - Filter predicate
	 * @returns {DataStream} New filtered stream
	 */
	filter (predicate) {
		const filteredIterator = {
			next: () => {
				while (true) {
					const { value, done } = this.iterator.next();
					if (done) return { done: true };
					if (predicate(value)) return { value, done: false };
				}
			}
		};

		return new DataStream(filteredIterator, this.options);
	}

	/**
	 * Take limited number of records
	 * @param {number} limit - Maximum records
	 * @returns {DataStream} New limited stream
	 */
	take (limit) {
		let count = 0;
		const limitedIterator = {
			next: () => {
				if (count >= limit) return { done: true };
				const { value, done } = this.iterator.next();
				if (done) return { done: true };
				count++;

				return { value, done: false };
			}
		};

		return new DataStream(limitedIterator, this.options);
	}

	/**
	 * Get stream statistics
	 * @returns {Object} Stream statistics
	 */
	getStats () {
		return {
			position: this.position,
			ended: this.ended,
			bufferSize: this.buffer.length,
			options: this.options
		};
	}
}/**
 * Manages storage operations with support for both mutable and immutable stores
 */
class StorageManager {
	/**
	 * @param {Object} config - Storage configuration
	 */
	constructor (config = {}) {
		this.config = {
			immutable: false,
			...config
		};

		// Initialize storage based on configuration
		if (this.config.immutable) {
			this._store = new ImmutableStore();
		} else {
			this._store = new Map();
		}
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
		if (this.config.immutable) {
			this._store = this._store.set(key, data);
		} else {
			this._store.set(key, data);
		}

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
	 * Get all storage entries
	 * @returns {Array<[string, Object]>} Array of [key, value] pairs
	 */
	entries () {
		if (this.config.immutable) {
			return this._store.entries();
		}

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
		if (this.config.immutable) {
			this._store = new ImmutableStore();
		} else {
			this._store.clear();
		}
	}

	/**
	 * Get underlying store (for compatibility)
	 * @returns {Map|ImmutableStore} The underlying store
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
}/**
 * Manages CRUD operations with validation and error handling
 */
class CRUDManager {
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
	 * @throws {ValidationError} If data validation fails
	 */
	set (key, data = {}, options = {}) {
		try {
			const {
				override = false,
				validate = true
			} = options;

			// Generate key if not provided
			if (key === null) {
				key = data[this.config.key] ?? crypto.randomUUID();
			}

			// Ensure key is in data
			const recordData = { ...data, [this.config.key]: key };

			// Validate against schema if configured
			if (validate && this.config.schema) {
				this.config.schema.validate(recordData);
			}

			// Get existing record for merging and versioning
			const existingRecord = this.storageManager.has(key) ? this.storageManager.get(key) : null;
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

			// Create record wrapper
			const record = RecordFactory.create(key, finalData);

			return record;

		} catch (error) {
			if (error instanceof HaroError) {
				throw error;
			}
			throw new ValidationError(`Failed to set record: ${error.message}`, "record", data);
		}
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

		const record = RecordFactory.create(key, recordData);

		// Add version information if requested
		if (includeVersions && this.versionManager) {
			const history = this.versionManager.getHistory(key);
			if (history) {
				const metadata = { versions: history.versions };

				return RecordFactory.create(key, recordData, metadata);
			}
		}

		return record;
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
}/**
 * Manages complex querying operations and criteria matching
 */
class QueryManager {
	/**
	 * @param {Object} dependencies - Required dependencies
	 * @param {StorageManager} dependencies.storageManager - Storage manager
	 * @param {IndexManager} dependencies.indexManager - Index manager
	 * @param {QueryOptimizer} [dependencies.queryOptimizer] - Query optimizer
	 */
	constructor ({ storageManager, indexManager, queryOptimizer = null }) {
		this.storageManager = storageManager;
		this.indexManager = indexManager;
		this.queryOptimizer = queryOptimizer;
	}

	/**
	 * Find records using optimized queries
	 * @param {Object} [criteria={}] - Search criteria
	 * @param {Object} [options={}] - Query options
	 * @returns {RecordCollection} Collection of matching records
	 */
	find (criteria = {}, options = {}) {
		const {
			limit,
			offset = 0
		} = options;

		try {
			// Create query plan if optimizer is available
			let plan = null;
			if (this.queryOptimizer) {
				const query = { find: criteria, limit, offset };
				const context = { indexManager: this.indexManager };
				plan = this.queryOptimizer.createPlan(query, context);
				plan.startExecution();
			}

			// Use index if available
			const fields = Object.keys(criteria);
			const optimalIndex = this.indexManager.getOptimalIndex(fields);

			let recordKeys;
			if (optimalIndex) {
				recordKeys = this.indexManager.findByCriteria(criteria);
			} else {
				// Fallback to full scan
				recordKeys = new Set(this.storageManager.keys());
			}

			// Convert to records and filter
			const records = [];
			for (const key of recordKeys) {
				const recordData = this.storageManager.get(key);
				if (this._matchesCriteria(recordData, criteria)) {
					records.push(RecordFactory.create(key, recordData));
				}
			}

			// Apply pagination
			const start = offset;
			const end = limit ? start + limit : records.length;
			const paginatedRecords = records.slice(start, end);

			if (plan) {
				plan.completeExecution(paginatedRecords.length);
				this.queryOptimizer.recordExecution(plan);
			}

			return new RecordCollection(paginatedRecords);

		} catch (error) {
			throw new QueryError(`Find operation failed: ${error.message}`, criteria, "find");
		}
	}

	/**
	 * Advanced filtering with predicate logic
	 * @param {Function|Object} predicate - Filter predicate
	 * @param {Object} [options={}] - Filter options
	 * @returns {RecordCollection} Filtered records
	 */
	where (predicate, options = {}) {
		try {
			if (typeof predicate === "function") {
				return this._filterByFunction(predicate, options);
			}

			if (typeof predicate === "object" && predicate !== null) {
				return this._filterByObject(predicate, options);
			}

			throw new QueryError("Predicate must be a function or object", predicate, "where");

		} catch (error) {
			throw new QueryError(`Where operation failed: ${error.message}`, predicate, "where");
		}
	}

	/**
	 * Check if record matches criteria
	 * @param {Object} record - Record to check
	 * @param {Object} criteria - Criteria object
	 * @returns {boolean} True if matches
	 * @private
	 */
	_matchesCriteria (record, criteria) {
		for (const [field, value] of Object.entries(criteria)) {
			const recordValue = record[field];

			if (value instanceof RegExp) {
				if (!value.test(recordValue)) return false;
			} else if (Array.isArray(value)) {
				if (Array.isArray(recordValue)) {
					if (!value.some(v => recordValue.includes(v))) return false;
				} else if (!value.includes(recordValue)) return false;
			} else if (recordValue !== value) return false;
		}

		return true;
	}

	/**
	 * Filter by function predicate
	 * @param {Function} predicate - Filter function
	 * @param {Object} options - Filter options
	 * @returns {RecordCollection} Filtered records
	 * @private
	 */
	_filterByFunction (predicate, options) {
		const { limit, offset = 0 } = options;
		const records = [];

		let count = 0;
		for (const [key, recordData] of this.storageManager.entries()) {
			const record = RecordFactory.create(key, recordData);
			if (predicate(record)) {
				if (count >= offset) {
					records.push(record);
					if (limit && records.length >= limit) {
						break;
					}
				}
				count++;
			}
		}

		return new RecordCollection(records);
	}

	/**
	 * Filter by object predicate
	 * @param {Object} predicate - Filter object
	 * @param {Object} options - Filter options
	 * @returns {RecordCollection} Filtered records
	 * @private
	 */
	_filterByObject (predicate, options) {
		return this.find(predicate, options);
	}
}/**
 * Manages batch operations with transaction support
 */
class BatchManager {
	/**
	 * @param {Object} dependencies - Required dependencies
	 * @param {CRUDManager} dependencies.crudManager - CRUD manager
	 * @param {TransactionManager} [dependencies.transactionManager] - Transaction manager
	 * @param {LifecycleManager} dependencies.lifecycleManager - Lifecycle manager
	 */
	constructor ({ crudManager, transactionManager = null, lifecycleManager }) {
		this.crudManager = crudManager;
		this.transactionManager = transactionManager;
		this.lifecycleManager = lifecycleManager;
	}

	/**
	 * Batch operations with transaction support
	 * @param {Array} operations - Array of operations or records
	 * @param {string} [type='set'] - Operation type
	 * @param {Object} [options={}] - Batch options
	 * @returns {Promise<Array>|Array} Array of results (Promise when using transactions)
	 */
	batch (operations, type = "set", options = {}) {
		const {
			transaction = null,
			atomic = false
		} = options;

		try {
			// Use transaction for atomic operations
			if (atomic || transaction) {
				return this._executeBatchInTransaction(operations, type, transaction);
			}

			// Execute operations individually
			const results = [];
			for (const operation of operations) {
				try {
					let result;
					if (type === "set") {
						result = this.crudManager.set(null, operation, { batch: true });
					} else if (type === "del") {
						this.crudManager.delete(operation, { batch: true });
						result = true;
					}
					results.push(result);
				} catch (error) {
					results.push(error);
				}
			}

			// Trigger batch lifecycle hook
			this.lifecycleManager.onbatch(results, type);

			return results;

		} catch (error) {
			throw new QueryError(`Batch operation failed: ${error.message}`, operations, "batch");
		}
	}

	/**
	 * Execute batch in transaction
	 * @param {Array} operations - Operations to execute
	 * @param {string} type - Operation type
	 * @param {Transaction} [transaction] - Existing transaction
	 * @returns {Promise<Array>} Operation results
	 * @private
	 */
	async _executeBatchInTransaction (operations, type, transaction) {
		if (!this.transactionManager) {
			throw new TransactionError("Transaction manager not available for atomic batch operations");
		}

		const ownTransaction = !transaction;
		if (ownTransaction) {
			transaction = this.transactionManager.begin();
		}

		try {
			const results = [];
			for (const operation of operations) {
				if (type === "set") {
					const result = this._executeSetInTransaction(null, operation, transaction);
					results.push(result);
				} else if (type === "del") {
					this._executeDeleteInTransaction(operation, transaction);
					results.push(true);
				}
			}

			if (ownTransaction) {
				await this.transactionManager.commit(transaction.id);
			}

			return results;
		} catch (error) {
			if (ownTransaction) {
				this.transactionManager.abort(transaction.id, error.message);
			}
			throw error;
		}
	}

	/**
	 * Execute set operation in transaction
	 * @param {string|null} key - Record key
	 * @param {Object} data - Record data
	 * @param {Transaction} transaction - Transaction instance
	 * @returns {Record} Created record
	 * @private
	 */
	_executeSetInTransaction (key, data, transaction) {
		// Add operation to transaction log
		const oldValue = key ? this.crudManager.storageManager.get(key) : null;
		transaction.addOperation("set", key, oldValue, data);

		// Execute operation
		return this.crudManager.set(key, data, { batch: true });
	}

	/**
	 * Execute delete operation in transaction
	 * @param {string} key - Record key
	 * @param {Transaction} transaction - Transaction instance
	 * @private
	 */
	_executeDeleteInTransaction (key, transaction) {
		// Add operation to transaction log
		const oldValue = this.crudManager.storageManager.get(key);
		transaction.addOperation("delete", key, oldValue);

		// Execute operation
		this.crudManager.delete(key, { batch: true });
	}
}/**
 * Manages streaming operations for large datasets
 */
class StreamManager {
	/**
	 * @param {Object} dependencies - Required dependencies
	 * @param {StorageManager} dependencies.storageManager - Storage manager
	 */
	constructor ({ storageManager }) {
		this.storageManager = storageManager;
	}

	/**
	 * Create a data stream for large datasets
	 * @param {Object} [options={}] - Stream options
	 * @returns {DataStream} Data stream instance
	 */
	stream (options = {}) {
		const entries = this.storageManager.entries();
		let index = 0;

		const iterator = {
			next: () => {
				if (index < entries.length) {
					return { value: entries[index++], done: false };
				}

				return { done: true };
			}
		};

		return new DataStream(iterator, options);
	}

	/**
	 * Create a filtered stream
	 * @param {Function|Object} predicate - Filter predicate
	 * @param {Object} [options={}] - Stream options
	 * @returns {DataStream} Filtered stream
	 */
	streamWhere (predicate, options = {}) {
		const iterator = this._createFilteredIterator(predicate);

		return new DataStream(iterator, options);
	}

	/**
	 * Create a transformed stream
	 * @param {Function} transform - Transform function
	 * @param {Object} [options={}] - Stream options
	 * @returns {DataStream} Transformed stream
	 */
	streamMap (transform, options = {}) {
		const iterator = this._createTransformIterator(transform);

		return new DataStream(iterator, options);
	}

	/**
	 * Create a limited stream
	 * @param {number} limit - Maximum number of records
	 * @param {Object} [options={}] - Stream options
	 * @returns {DataStream} Limited stream
	 */
	streamTake (limit, options = {}) {
		const iterator = this._createLimitedIterator(limit);

		return new DataStream(iterator, options);
	}

	/**
	 * Create iterator for filtered data
	 * @param {Function|Object} predicate - Filter predicate
	 * @returns {Iterator} Filtered iterator
	 * @private
	 */
	_createFilteredIterator (predicate) {
		const entries = this.storageManager.entries();
		let index = 0;

		return {
			next: () => {
				while (index < entries.length) {
					const [key, value] = entries[index++];

					if (typeof predicate === "function") {
						if (predicate({ key, ...value })) {
							return { value: [key, value], done: false };
						}
					} else if (typeof predicate === "object") {
						if (this._matchesCriteria(value, predicate)) {
							return { value: [key, value], done: false };
						}
					}
				}

				return { done: true };
			}
		};
	}

	/**
	 * Create iterator for transformed data
	 * @param {Function} transform - Transform function
	 * @returns {Iterator} Transform iterator
	 * @private
	 */
	_createTransformIterator (transform) {
		const entries = this.storageManager.entries();
		let index = 0;

		return {
			next: () => {
				if (index < entries.length) {
					const [key, value] = entries[index++];
					const transformed = transform({ key, ...value });

					return { value: [key, transformed], done: false };
				}

				return { done: true };
			}
		};
	}

	/**
	 * Create iterator for limited data
	 * @param {number} limit - Record limit
	 * @returns {Iterator} Limited iterator
	 * @private
	 */
	_createLimitedIterator (limit) {
		const entries = this.storageManager.entries();
		let index = 0;

		return {
			next: () => {
				if (index < limit && index < entries.length) {
					const entry = entries[index++];

					return { value: entry, done: false };
				}

				return { done: true };
			}
		};
	}

	/**
	 * Check if record matches criteria
	 * @param {Object} record - Record to check
	 * @param {Object} criteria - Criteria object
	 * @returns {boolean} True if matches
	 * @private
	 */
	_matchesCriteria (record, criteria) {
		for (const [field, value] of Object.entries(criteria)) {
			const recordValue = record[field];

			if (value instanceof RegExp) {
				if (!value.test(recordValue)) return false;
			} else if (Array.isArray(value)) {
				if (Array.isArray(recordValue)) {
					if (!value.some(v => recordValue.includes(v))) return false;
				} else if (!value.includes(recordValue)) return false;
			} else if (recordValue !== value) return false;
		}

		return true;
	}
}/**
 * Manages statistics gathering and memory usage estimation
 */
class StatisticsManager {
	/**
	 * @param {Object} dependencies - Required dependencies
	 * @param {StorageManager} dependencies.storageManager - Storage manager
	 * @param {IndexManager} dependencies.indexManager - Index manager
	 * @param {VersionManager} [dependencies.versionManager] - Version manager
	 * @param {TransactionManager} [dependencies.transactionManager] - Transaction manager
	 * @param {QueryOptimizer} [dependencies.queryOptimizer] - Query optimizer
	 * @param {Object} dependencies.config - Configuration
	 */
	constructor ({
		storageManager,
		indexManager,
		versionManager = null,
		transactionManager = null,
		queryOptimizer = null,
		config
	}) {
		this.storageManager = storageManager;
		this.indexManager = indexManager;
		this.versionManager = versionManager;
		this.transactionManager = transactionManager;
		this.queryOptimizer = queryOptimizer;
		this.config = config;
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		const stats = {
			records: this.storageManager.size,
			configuration: this.config,
			indexes: this.indexManager.getStats(),
			memory: this._estimateMemoryUsage()
		};

		if (this.versionManager) {
			stats.versions = this.versionManager.getStats();
		}

		if (this.transactionManager) {
			stats.transactions = this.transactionManager.getStats();
		}

		if (this.queryOptimizer) {
			stats.queries = this.queryOptimizer.getStats();
		}

		return stats;
	}

	/**
	 * Get storage statistics
	 * @returns {Object} Storage statistics
	 */
	getStorageStats () {
		return {
			size: this.storageManager.size,
			memoryUsage: this.storageManager.estimateMemoryUsage(),
			type: this.config.immutable ? "immutable" : "mutable"
		};
	}

	/**
	 * Get index statistics
	 * @returns {Object} Index statistics
	 */
	getIndexStats () {
		return this.indexManager.getStats();
	}

	/**
	 * Get version statistics
	 * @returns {Object|null} Version statistics
	 */
	getVersionStats () {
		return this.versionManager ? this.versionManager.getStats() : null;
	}

	/**
	 * Get transaction statistics
	 * @returns {Object|null} Transaction statistics
	 */
	getTransactionStats () {
		return this.transactionManager ? this.transactionManager.getStats() : null;
	}

	/**
	 * Get query optimization statistics
	 * @returns {Object|null} Query statistics
	 */
	getQueryStats () {
		return this.queryOptimizer ? this.queryOptimizer.getStats() : null;
	}

	/**
	 * Get performance metrics
	 * @returns {Object} Performance metrics
	 */
	getPerformanceMetrics () {
		const stats = this.getStats();

		return {
			recordsPerIndex: stats.records / Math.max(1, Object.keys(stats.indexes).length),
			memoryPerRecord: stats.memory.total / Math.max(1, stats.records),
			indexEfficiency: this._calculateIndexEfficiency(stats),
			overheadRatio: stats.memory.overhead / Math.max(1, stats.memory.data)
		};
	}

	/**
	 * Estimate memory usage
	 * @returns {Object} Memory usage statistics
	 * @private
	 */
	_estimateMemoryUsage () {
		const dataSize = this.storageManager.estimateMemoryUsage();
		const indexSize = this.indexManager.getStats().totalMemoryUsage || 0;
		const versionSize = this.versionManager ? this.versionManager.getStats().totalSize : 0;

		return {
			total: dataSize + indexSize + versionSize,
			data: dataSize,
			indexes: indexSize,
			versions: versionSize,
			overhead: indexSize + versionSize
		};
	}

	/**
	 * Calculate index efficiency
	 * @param {Object} stats - Statistics object
	 * @returns {number} Efficiency percentage
	 * @private
	 */
	_calculateIndexEfficiency (stats) {
		if (!stats.indexes || !stats.queries) {
			return 0;
		}

		const totalQueries = stats.queries.totalExecutions || 1;
		const indexedQueries = stats.queries.indexedExecutions || 0;

		return indexedQueries / totalQueries * 100;
	}

	/**
	 * Generate performance report
	 * @returns {Object} Performance report
	 */
	generateReport () {
		const stats = this.getStats();
		const performance = this.getPerformanceMetrics();

		return {
			summary: {
				totalRecords: stats.records,
				totalMemory: stats.memory.total,
				activeIndexes: Object.keys(stats.indexes).length,
				versioning: !!this.versionManager,
				transactions: !!this.transactionManager,
				optimization: !!this.queryOptimizer
			},
			performance,
			breakdown: {
				storage: this.getStorageStats(),
				indexes: this.getIndexStats(),
				versions: this.getVersionStats(),
				transactions: this.getTransactionStats(),
				queries: this.getQueryStats()
			},
			recommendations: this._generateRecommendations(stats, performance)
		};
	}

	/**
	 * Generate performance recommendations
	 * @param {Object} stats - Statistics object
	 * @param {Object} performance - Performance metrics
	 * @returns {Array} Array of recommendations
	 * @private
	 */
	_generateRecommendations (stats, performance) {
		const recommendations = [];

		if (performance.indexEfficiency < 50) {
			recommendations.push("Consider adding more indexes for frequently queried fields");
		}

		if (performance.overheadRatio > 2) {
			recommendations.push("High memory overhead detected - consider optimizing indexes or version retention");
		}

		if (stats.records > 10000 && !this.queryOptimizer) {
			recommendations.push("Enable query optimization for better performance with large datasets");
		}

		if (stats.memory.versions > stats.memory.data) {
			recommendations.push("Version storage is larger than data - consider adjusting retention policy");
		}

		return recommendations;
	}
}/**
 * Manages lifecycle hooks and events
 */
class LifecycleManager {
	/**
	 * @param {Object} [hooks={}] - Custom lifecycle hooks
	 */
	constructor (hooks = {}) {
		// Default no-op hooks
		this.hooks = {
			beforeSet: () => {},
			onset: () => {},
			beforeDelete: () => {},
			ondelete: () => {},
			beforeClear: () => {},
			onclear: () => {},
			onbatch: () => {},
			...hooks
		};
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
		this.hooks[event] = () => {};
	}

	/**
	 * Execute a lifecycle hook
	 * @param {string} event - Event name
	 * @param {...*} args - Arguments to pass to hook
	 * @returns {*} Hook result
	 */
	executeHook (event, ...args) {
		if (this.hooks[event]) {
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
}/**
 * Haro class with all design flaws addressed and enterprise features added
 */
class Haro {
	/**
	 * @param {Array|Object} [data] - Initial data or configuration
	 * @param {Object} [config={}] - Configuration options
	 */
	constructor (data = null, config = {}) {
		// Set defaults first
		const defaults = {
			delimiter: "|",
			id: crypto.randomUUID(),
			immutable: false,
			index: [],
			key: "id",
			versioning: false,
			schema: null,
			retentionPolicy: { type: RetentionPolicies.NONE },
			enableTransactions: false,
			enableOptimization: true
		};

		// Handle parameter overloading and merge with defaults
		let userConfig;
		if (Array.isArray(data) || data === null) {
			userConfig = ConfigValidator.validate(config);
			this.initialData = data;
		} else {
			userConfig = ConfigValidator.validate(data);
			this.initialData = null;
		}

		// Merge defaults with user configuration (user config takes precedence)
		this.config = { ...defaults, ...userConfig };

		// Initialize core managers
		this.storageManager = new StorageManager({ immutable: this.config.immutable });
		this.indexManager = new IndexManager(this.config.delimiter);
		this.versionManager = this.config.versioning ?
			new VersionManager(this.config.retentionPolicy) :
			null;
		this.transactionManager = this.config.enableTransactions ?
			new TransactionManager() :
			null;
		this.queryOptimizer = this.config.enableOptimization ?
			new QueryOptimizer() :
			null;

		// Initialize lifecycle manager
		this.lifecycleManager = new LifecycleManager();

		// Initialize specialized managers
		this.crudManager = new CRUDManager({
			storageManager: this.storageManager,
			indexManager: this.indexManager,
			versionManager: this.versionManager,
			config: this.config
		});

		this.queryManager = new QueryManager({
			storageManager: this.storageManager,
			indexManager: this.indexManager,
			queryOptimizer: this.queryOptimizer
		});

		this.batchManager = new BatchManager({
			crudManager: this.crudManager,
			transactionManager: this.transactionManager,
			lifecycleManager: this.lifecycleManager
		});

		this.streamManager = new StreamManager({
			storageManager: this.storageManager
		});

		this.statisticsManager = new StatisticsManager({
			storageManager: this.storageManager,
			indexManager: this.indexManager,
			versionManager: this.versionManager,
			transactionManager: this.transactionManager,
			queryOptimizer: this.queryOptimizer,
			config: this.config
		});

		// Create indexes
		for (const indexField of this.config.index) {
			this.indexManager.createIndex(indexField, indexField);
		}

		// Properties for backward compatibility
		Object.defineProperty(this, "data", {
			get: () => this.storageManager.getStore(),
			enumerable: true
		});

		Object.defineProperty(this, "size", {
			get: () => this.storageManager.size,
			enumerable: true
		});

		Object.defineProperty(this, "registry", {
			get: () => this.storageManager.keys(),
			enumerable: true
		});

		// Initialize with data if provided
		if (this.initialData && Array.isArray(this.initialData)) {
			this.batch(this.initialData);
		}
	}

	/**
	 * Set or update a record with comprehensive validation and error handling
	 * @param {string|null} key - Record key or null for auto-generation
	 * @param {Object} [data={}] - Record data
	 * @param {Object} [options={}] - Operation options
	 * @returns {Record} Created/updated record
	 * @throws {ValidationError} If data validation fails
	 */
	set (key, data = {}, options = {}) {
		const {
			batch = false,
			transaction = null
		} = options;

		// Execute in transaction if provided
		if (transaction) {
			return this._executeInTransaction(transaction, "set", key, data, options);
		}

		// Trigger lifecycle hook
		this.lifecycleManager.beforeSet(key, data, options);

		// Delegate to CRUD manager
		const record = this.crudManager.set(key, data, options);

		// Trigger lifecycle hook
		if (!batch) {
			this.lifecycleManager.onset(record, options);
		}

		return record;
	}

	/**
	 * Get a record by key with consistent return format
	 * @param {string} key - Record key
	 * @param {Object} [options={}] - Get options
	 * @returns {Record|null} Record instance or null if not found
	 */
	get (key, options = {}) {
		const { transaction = null } = options;

		// Execute in transaction if provided
		if (transaction) {
			return this._executeInTransaction(transaction, "get", key, options);
		}

		// Delegate to CRUD manager
		return this.crudManager.get(key, options);
	}

	/**
	 * Delete a record with proper cleanup
	 * @param {string} key - Record key
	 * @param {Object} [options={}] - Delete options
	 * @returns {boolean} True if deleted successfully
	 * @throws {RecordNotFoundError} If record not found
	 */
	delete (key, options = {}) {
		const {
			batch = false,
			transaction = null
		} = options;

		// Execute in transaction if provided
		if (transaction) {
			return this._executeInTransaction(transaction, "delete", key, options);
		}

		// Lifecycle hook
		this.lifecycleManager.beforeDelete(key, batch);

		// Delegate to CRUD manager
		const result = this.crudManager.delete(key, options);

		// Lifecycle hook
		if (!batch) {
			this.lifecycleManager.ondelete(key);
		}

		return result;
	}

	/**
	 * Check if record exists
	 * @param {string} key - Record key
	 * @returns {boolean} True if record exists
	 */
	has (key) {
		return this.crudManager.has(key);
	}

	/**
	 * Find records using optimized queries
	 * @param {Object} [criteria={}] - Search criteria
	 * @param {Object} [options={}] - Query options
	 * @returns {RecordCollection} Collection of matching records
	 */
	find (criteria = {}, options = {}) {
		const { transaction = null } = options;

		// Execute in transaction if provided
		if (transaction) {
			return this._executeInTransaction(transaction, "find", criteria, options);
		}

		// Delegate to query manager
		return this.queryManager.find(criteria, options);
	}

	/**
	 * Advanced filtering with predicate logic
	 * @param {Function|Object} predicate - Filter predicate
	 * @param {Object} [options={}] - Filter options
	 * @returns {RecordCollection} Filtered records
	 */
	where (predicate, options = {}) {
		// Delegate to query manager
		return this.queryManager.where(predicate, options);
	}

	/**
	 * Batch operations with transaction support
	 * @param {Array} operations - Array of operations or records
	 * @param {string} [type='set'] - Operation type
	 * @param {Object} [options={}] - Batch options
	 * @returns {Promise<Array>|Array} Array of results (Promise when using transactions)
	 */
	batch (operations, type = "set", options = {}) {
		// Delegate to batch manager
		return this.batchManager.batch(operations, type, options);
	}

	/**
	 * Begin a new transaction
	 * @param {Object} [options={}] - Transaction options
	 * @returns {Transaction} New transaction
	 * @throws {ConfigurationError} If transactions not enabled
	 */
	beginTransaction (options = {}) {
		if (!this.transactionManager) {
			throw new ConfigurationError("Transactions not enabled", "enableTransactions", false);
		}

		return this.transactionManager.begin(options);
	}

	/**
	 * Commit a transaction
	 * @param {string|Transaction} transaction - Transaction ID or instance
	 * @returns {Transaction} Committed transaction
	 */
	async commitTransaction (transaction) {
		if (!this.transactionManager) {
			throw new ConfigurationError("Transactions not enabled", "enableTransactions", false);
		}

		const transactionId = typeof transaction === "string" ? transaction : transaction.id;

		return await this.transactionManager.commit(transactionId);
	}

	/**
	 * Abort a transaction
	 * @param {string|Transaction} transaction - Transaction ID or instance
	 * @param {string} [reason] - Abort reason
	 * @returns {Transaction} Aborted transaction
	 */
	abortTransaction (transaction, reason) {
		if (!this.transactionManager) {
			throw new ConfigurationError("Transactions not enabled", "enableTransactions", false);
		}

		const transactionId = typeof transaction === "string" ? transaction : transaction.id;

		return this.transactionManager.abort(transactionId, reason);
	}

	/**
	 * Create a data stream for large datasets
	 * @param {Object} [options={}] - Stream options
	 * @returns {DataStream} Data stream instance
	 */
	stream (options = {}) {
		// Delegate to stream manager
		return this.streamManager.stream(options);
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		// Delegate to statistics manager
		return this.statisticsManager.getStats();
	}

	/**
	 * Clear all data and reset state
	 * @param {Object} [options={}] - Clear options
	 */
	clear (options = {}) {
		const {
			preserveIndexes = false,
			preserveVersions = false
		} = options;

		// Lifecycle hook
		this.lifecycleManager.beforeClear();

		// Clear storage
		this.storageManager.clear();

		// Clear indexes
		if (!preserveIndexes) {
			this.indexManager.clear();
		}

		// Clear versions
		if (!preserveVersions && this.versionManager) {
			this.versionManager.clear();
		}

		// Clear query cache
		if (this.queryOptimizer) {
			this.queryOptimizer.clear();
		}

		// Lifecycle hook
		this.lifecycleManager.onclear();
	}

	// Lifecycle hooks (backward compatibility - delegate to lifecycle manager)
	beforeSet (key, data, options) {
		return this.lifecycleManager.beforeSet(key, data, options);
	}
	onset (record, options) {
		return this.lifecycleManager.onset(record, options);
	}
	beforeDelete (key, batch) {
		return this.lifecycleManager.beforeDelete(key, batch);
	}
	ondelete (key) {
		return this.lifecycleManager.ondelete(key);
	}
	beforeClear () {
		return this.lifecycleManager.beforeClear();
	}
	onclear () {
		return this.lifecycleManager.onclear();
	}
	onbatch (results, type) {
		return this.lifecycleManager.onbatch(results, type);
	}


	/**
	 * Execute operation in transaction
	 * @param {Transaction} transaction - Transaction instance
	 * @param {string} operation - Operation type
	 * @param {...*} args - Operation arguments
	 * @returns {*} Operation result
	 * @private
	 */
	_executeInTransaction (transaction, operation, ...args) {
		// Handle different operation parameter patterns
		switch (operation) {
			case "set": {
				const [key, data, options = {}] = args;
				const oldValue = this.storageManager.get(key);

				transaction.addOperation(operation, key, oldValue, data);

				return this.set(key, data, { ...options, transaction: null });
			}
			case "get": {
				const [key, options = {}] = args;

				transaction.addOperation("read", key);

				return this.get(key, { ...options, transaction: null });
			}
			case "delete": {
				const [key, options = {}] = args;
				const oldValue = this.storageManager.get(key);

				transaction.addOperation(operation, key, oldValue);

				return this.delete(key, { ...options, transaction: null });
			}
			case "find": {
				const [criteria, options = {}] = args;

				transaction.addOperation("read", "find_operation", null, criteria);

				return this.find(criteria, { ...options, transaction: null });
			}
			default:
				throw new TransactionError(`Unknown operation: ${operation}`, transaction.id, operation);
		}
	}

}

/**
 * Factory function for creating Haro instances
 * @param {Array|Object} [data] - Initial data or configuration
 * @param {Object} [config={}] - Configuration options
 * @returns {Haro} New Haro instance
 */
function haro (data = null, config = {}) {
	return new Haro(data, config);
}exports.Constraints=Constraints;exports.DataStream=DataStream;exports.DataTypes=DataTypes;exports.ErrorRecovery=ErrorRecovery;exports.FieldConstraint=FieldConstraint;exports.Haro=Haro;exports.ImmutableStore=ImmutableStore;exports.IndexTypes=IndexTypes;exports.IsolationLevels=IsolationLevels;exports.QueryTypes=QueryTypes;exports.Record=Record;exports.RecordCollection=RecordCollection;exports.RecordFactory=RecordFactory;exports.RetentionPolicies=RetentionPolicies;exports.Schema=Schema;exports.default=Haro;exports.haro=haro;Object.defineProperty(exports,'__esModule',{value:true});}));