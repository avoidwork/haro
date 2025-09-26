import { ConfigurationError } from "./errors.js";
import { Schema } from "./schema.js";

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
