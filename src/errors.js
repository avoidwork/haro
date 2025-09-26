/**
 * Base error class for all Haro errors
 */
export class HaroError extends Error {
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
export class ValidationError extends HaroError {
	constructor (message, field, value) {
		super(message, "VALIDATION_ERROR", { field, value });
	}
}

/**
 * Record not found errors
 */
export class RecordNotFoundError extends HaroError {
	constructor (key, storeName) {
		super(`Record with key '${key}' not found${storeName ? ` in store '${storeName}'` : ""}`, "RECORD_NOT_FOUND", { key, storeName });
	}
}

/**
 * Index-related errors
 */
export class IndexError extends HaroError {
	constructor (message, indexName, operation) {
		super(message, "INDEX_ERROR", { indexName, operation });
	}
}

/**
 * Configuration errors
 */
export class ConfigurationError extends HaroError {
	constructor (message, configKey, configValue) {
		super(message, "CONFIGURATION_ERROR", { configKey, configValue });
	}
}

/**
 * Query errors for invalid queries or operations
 */
export class QueryError extends HaroError {
	constructor (message, query, operation) {
		super(message, "QUERY_ERROR", { query, operation });
	}
}

/**
 * Transaction errors
 */
export class TransactionError extends HaroError {
	constructor (message, transactionId, operation) {
		super(message, "TRANSACTION_ERROR", { transactionId, operation });
	}
}

/**
 * Version management errors
 */
export class VersionError extends HaroError {
	constructor (message, key, version) {
		super(message, "VERSION_ERROR", { key, version });
	}
}

/**
 * Type constraint errors
 */
export class TypeConstraintError extends HaroError {
	constructor (message, expected, actual, field) {
		super(message, "TYPE_CONSTRAINT_ERROR", { expected, actual, field });
	}
}

/**
 * Concurrency errors for multi-threaded access
 */
export class ConcurrencyError extends HaroError {
	constructor (message, resource, operation) {
		super(message, "CONCURRENCY_ERROR", { resource, operation });
	}
}

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
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
}
