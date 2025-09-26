import { ValidationError } from "./errors.js";

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
