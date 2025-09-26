import assert from "node:assert";
import { describe, it } from "mocha";
import {
	HaroError,
	ValidationError,
	RecordNotFoundError,
	IndexError,
	ConfigurationError,
	QueryError,
	TransactionError,
	VersionError,
	TypeConstraintError,
	ConcurrencyError,
	ErrorRecovery
} from "../../src/errors.js";

/**
 * Tests for error classes and error recovery utilities
 */
describe("Error Classes", () => {
	describe("HaroError", () => {
		/**
		 * Test basic error construction
		 */
		it("should create a basic error with message only", () => {
			const message = "Test error message";
			const error = new HaroError(message);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.name, "HaroError");
			assert.strictEqual(error.code, undefined);
			assert.strictEqual(error.context, undefined);
			assert.ok(error.timestamp);
			assert.ok(error instanceof Error);
			assert.ok(error instanceof HaroError);
		});

		/**
		 * Test error construction with code
		 */
		it("should create an error with message and code", () => {
			const message = "Test error with code";
			const code = "TEST_ERROR";
			const error = new HaroError(message, code);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.code, code);
			assert.strictEqual(error.name, "HaroError");
		});

		/**
		 * Test error construction with all parameters
		 */
		it("should create an error with message, code, and context", () => {
			const message = "Test error with context";
			const code = "TEST_ERROR";
			const context = { field: "test", value: 123 };
			const error = new HaroError(message, code, context);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.code, code);
			assert.deepStrictEqual(error.context, context);
		});

		/**
		 * Test timestamp is a valid ISO string
		 */
		it("should have a valid ISO timestamp", () => {
			const error = new HaroError("Test");
			const timestamp = new Date(error.timestamp);
			
			assert.ok(!isNaN(timestamp.getTime()));
			assert.strictEqual(error.timestamp, timestamp.toISOString());
		});

		/**
		 * Test stack trace is properly set
		 */
		it("should have a proper stack trace", () => {
			const error = new HaroError("Test stack trace");
			
			assert.ok(error.stack);
			assert.ok(error.stack.includes("HaroError"));
			assert.ok(error.stack.includes("Test stack trace"));
		});

		/**
		 * Test toJSON serialization
		 */
		it("should serialize to JSON properly", () => {
			const message = "Serializable error";
			const code = "SERIALIZE_TEST";
			const context = { key: "value", number: 42 };
			const error = new HaroError(message, code, context);
			
			const json = error.toJSON();
			
			assert.strictEqual(json.name, "HaroError");
			assert.strictEqual(json.message, message);
			assert.strictEqual(json.code, code);
			assert.deepStrictEqual(json.context, context);
			assert.strictEqual(json.timestamp, error.timestamp);
			assert.ok(json.stack);
		});

		/**
		 * Test JSON serialization works with JSON.stringify
		 */
		it("should work with JSON.stringify", () => {
			const error = new HaroError("Stringify test", "STRINGIFY_ERROR");
			const jsonString = JSON.stringify(error);
			const parsed = JSON.parse(jsonString);
			
			assert.strictEqual(parsed.name, "HaroError");
			assert.strictEqual(parsed.message, "Stringify test");
			assert.strictEqual(parsed.code, "STRINGIFY_ERROR");
		});
	});

	describe("ValidationError", () => {
		/**
		 * Test ValidationError construction
		 */
		it("should create a ValidationError with proper properties", () => {
			const message = "Invalid field value";
			const field = "email";
			const value = "invalid-email";
			const error = new ValidationError(message, field, value);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.name, "ValidationError");
			assert.strictEqual(error.code, "VALIDATION_ERROR");
			assert.deepStrictEqual(error.context, { field, value });
			assert.ok(error instanceof HaroError);
			assert.ok(error instanceof ValidationError);
		});

		/**
		 * Test ValidationError with undefined values
		 */
		it("should handle undefined field and value", () => {
			const error = new ValidationError("Validation failed");
			
			assert.strictEqual(error.context.field, undefined);
			assert.strictEqual(error.context.value, undefined);
		});
	});

	describe("RecordNotFoundError", () => {
		/**
		 * Test RecordNotFoundError with key only
		 */
		it("should create a RecordNotFoundError with key only", () => {
			const key = "user123";
			const error = new RecordNotFoundError(key);
			
			assert.strictEqual(error.message, `Record with key '${key}' not found`);
			assert.strictEqual(error.name, "RecordNotFoundError");
			assert.strictEqual(error.code, "RECORD_NOT_FOUND");
			assert.deepStrictEqual(error.context, { key, storeName: undefined });
		});

		/**
		 * Test RecordNotFoundError with key and store name
		 */
		it("should create a RecordNotFoundError with key and store name", () => {
			const key = "user123";
			const storeName = "users";
			const error = new RecordNotFoundError(key, storeName);
			
			assert.strictEqual(error.message, `Record with key '${key}' not found in store '${storeName}'`);
			assert.deepStrictEqual(error.context, { key, storeName });
		});
	});

	describe("IndexError", () => {
		/**
		 * Test IndexError construction
		 */
		it("should create an IndexError with proper properties", () => {
			const message = "Index not found";
			const indexName = "email_index";
			const operation = "query";
			const error = new IndexError(message, indexName, operation);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.name, "IndexError");
			assert.strictEqual(error.code, "INDEX_ERROR");
			assert.deepStrictEqual(error.context, { indexName, operation });
		});
	});

	describe("ConfigurationError", () => {
		/**
		 * Test ConfigurationError construction
		 */
		it("should create a ConfigurationError with proper properties", () => {
			const message = "Invalid configuration";
			const configKey = "maxSize";
			const configValue = -1;
			const error = new ConfigurationError(message, configKey, configValue);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.name, "ConfigurationError");
			assert.strictEqual(error.code, "CONFIGURATION_ERROR");
			assert.deepStrictEqual(error.context, { configKey, configValue });
		});
	});

	describe("QueryError", () => {
		/**
		 * Test QueryError construction
		 */
		it("should create a QueryError with proper properties", () => {
			const message = "Invalid query syntax";
			const query = { invalid: "query" };
			const operation = "find";
			const error = new QueryError(message, query, operation);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.name, "QueryError");
			assert.strictEqual(error.code, "QUERY_ERROR");
			assert.deepStrictEqual(error.context, { query, operation });
		});
	});

	describe("TransactionError", () => {
		/**
		 * Test TransactionError construction
		 */
		it("should create a TransactionError with proper properties", () => {
			const message = "Transaction failed";
			const transactionId = "tx123";
			const operation = "commit";
			const error = new TransactionError(message, transactionId, operation);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.name, "TransactionError");
			assert.strictEqual(error.code, "TRANSACTION_ERROR");
			assert.deepStrictEqual(error.context, { transactionId, operation });
		});
	});

	describe("VersionError", () => {
		/**
		 * Test VersionError construction
		 */
		it("should create a VersionError with proper properties", () => {
			const message = "Version conflict";
			const key = "record123";
			const version = 5;
			const error = new VersionError(message, key, version);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.name, "VersionError");
			assert.strictEqual(error.code, "VERSION_ERROR");
			assert.deepStrictEqual(error.context, { key, version });
		});
	});

	describe("TypeConstraintError", () => {
		/**
		 * Test TypeConstraintError construction
		 */
		it("should create a TypeConstraintError with proper properties", () => {
			const message = "Type mismatch";
			const expected = "string";
			const actual = "number";
			const field = "name";
			const error = new TypeConstraintError(message, expected, actual, field);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.name, "TypeConstraintError");
			assert.strictEqual(error.code, "TYPE_CONSTRAINT_ERROR");
			assert.deepStrictEqual(error.context, { expected, actual, field });
		});
	});

	describe("ConcurrencyError", () => {
		/**
		 * Test ConcurrencyError construction
		 */
		it("should create a ConcurrencyError with proper properties", () => {
			const message = "Concurrent access detected";
			const resource = "record123";
			const operation = "update";
			const error = new ConcurrencyError(message, resource, operation);
			
			assert.strictEqual(error.message, message);
			assert.strictEqual(error.name, "ConcurrencyError");
			assert.strictEqual(error.code, "CONCURRENCY_ERROR");
			assert.deepStrictEqual(error.context, { resource, operation });
		});
	});
});

describe("ErrorRecovery", () => {
	describe("isRecoverable", () => {
		/**
		 * Test recoverable error types
		 */
		it("should identify recoverable error types", () => {
			const recoverableErrors = [
				new RecordNotFoundError("test"),
				new ValidationError("test"),
				new QueryError("test"),
				new TypeConstraintError("test")
			];
			
			recoverableErrors.forEach(error => {
				assert.strictEqual(ErrorRecovery.isRecoverable(error), true, 
					`${error.constructor.name} should be recoverable`);
			});
		});

		/**
		 * Test non-recoverable error types
		 */
		it("should identify non-recoverable error types", () => {
			const nonRecoverableErrors = [
				new IndexError("test"),
				new ConfigurationError("test"),
				new TransactionError("test"),
				new VersionError("test"),
				new ConcurrencyError("test")
			];
			
			nonRecoverableErrors.forEach(error => {
				assert.strictEqual(ErrorRecovery.isRecoverable(error), false,
					`${error.constructor.name} should not be recoverable`);
			});
		});

		/**
		 * Test non-HaroError instances
		 */
		it("should return false for non-HaroError instances", () => {
			const standardError = new Error("Standard error");
			const customError = { code: "RECORD_NOT_FOUND" };
			
			assert.strictEqual(ErrorRecovery.isRecoverable(standardError), false);
			assert.strictEqual(ErrorRecovery.isRecoverable(customError), false);
		});
	});

	describe("getRecoveryActions", () => {
		/**
		 * Test recovery actions for RECORD_NOT_FOUND
		 */
		it("should return correct actions for RECORD_NOT_FOUND", () => {
			const error = new RecordNotFoundError("test");
			const actions = ErrorRecovery.getRecoveryActions(error);
			
			assert.ok(Array.isArray(actions));
			assert.ok(actions.some(action => action.includes("Verify the record key")));
			assert.ok(actions.some(action => action.includes("Check if record was deleted")));
			assert.ok(actions.some(action => action.includes("has() method")));
		});

		/**
		 * Test recovery actions for VALIDATION_ERROR
		 */
		it("should return correct actions for VALIDATION_ERROR", () => {
			const error = new ValidationError("test");
			const actions = ErrorRecovery.getRecoveryActions(error);
			
			assert.ok(actions.some(action => action.includes("data types")));
			assert.ok(actions.some(action => action.includes("required fields")));
			assert.ok(actions.some(action => action.includes("field constraints")));
		});

		/**
		 * Test recovery actions for INDEX_ERROR
		 */
		it("should return correct actions for INDEX_ERROR", () => {
			const error = new IndexError("test");
			const actions = ErrorRecovery.getRecoveryActions(error);
			
			assert.ok(actions.some(action => action.includes("index exists")));
			assert.ok(actions.some(action => action.includes("index configuration")));
			assert.ok(actions.some(action => action.includes("reindexing")));
		});

		/**
		 * Test recovery actions for CONFIGURATION_ERROR
		 */
		it("should return correct actions for CONFIGURATION_ERROR", () => {
			const error = new ConfigurationError("test");
			const actions = ErrorRecovery.getRecoveryActions(error);
			
			assert.ok(actions.some(action => action.includes("configuration parameters")));
			assert.ok(actions.some(action => action.includes("typos")));
			assert.ok(actions.some(action => action.includes("documentation")));
		});

		/**
		 * Test recovery actions for QUERY_ERROR
		 */
		it("should return correct actions for QUERY_ERROR", () => {
			const error = new QueryError("test");
			const actions = ErrorRecovery.getRecoveryActions(error);
			
			assert.ok(actions.some(action => action.includes("query syntax")));
			assert.ok(actions.some(action => action.includes("indexed fields")));
			assert.ok(actions.some(action => action.includes("Simplify")));
		});

		/**
		 * Test recovery actions for TRANSACTION_ERROR
		 */
		it("should return correct actions for TRANSACTION_ERROR", () => {
			const error = new TransactionError("test");
			const actions = ErrorRecovery.getRecoveryActions(error);
			
			assert.ok(actions.some(action => action.includes("Retry")));
			assert.ok(actions.some(action => action.includes("concurrent")));
			assert.ok(actions.some(action => action.includes("scope")));
		});

		/**
		 * Test recovery actions for TYPE_CONSTRAINT_ERROR
		 */
		it("should return correct actions for TYPE_CONSTRAINT_ERROR", () => {
			const error = new TypeConstraintError("test");
			const actions = ErrorRecovery.getRecoveryActions(error);
			
			assert.ok(actions.some(action => action.includes("data types")));
			assert.ok(actions.some(action => action.includes("Convert")));
			assert.ok(actions.some(action => action.includes("type constraints")));
		});

		/**
		 * Test recovery actions for unknown error
		 */
		it("should return default actions for unknown error codes", () => {
			const error = new HaroError("test", "UNKNOWN_ERROR");
			const actions = ErrorRecovery.getRecoveryActions(error);
			
			assert.deepStrictEqual(actions, ["Check error details and retry"]);
		});

		/**
		 * Test recovery actions for non-HaroError
		 */
		it("should return default actions for non-HaroError instances", () => {
			const error = new Error("Standard error");
			const actions = ErrorRecovery.getRecoveryActions(error);
			
			assert.deepStrictEqual(actions, ["Check error details and retry"]);
		});
	});

	describe("createRecoveryStrategy", () => {
		/**
		 * Test recovery strategy for recoverable error
		 */
		it("should create recovery strategy for recoverable error", () => {
			const error = new ValidationError("test validation error");
			const strategy = ErrorRecovery.createRecoveryStrategy(error);
			
			assert.strictEqual(strategy.error, error);
			assert.strictEqual(strategy.isRecoverable, true);
			assert.ok(Array.isArray(strategy.actions));
			assert.strictEqual(strategy.retryable, false);
			assert.strictEqual(strategy.backoffMs, 0);
		});

		/**
		 * Test recovery strategy for concurrency error
		 */
		it("should create recovery strategy for concurrency error with backoff", () => {
			const error = new ConcurrencyError("test concurrency error");
			const strategy = ErrorRecovery.createRecoveryStrategy(error);
			
			assert.strictEqual(strategy.error, error);
			assert.strictEqual(strategy.isRecoverable, false);
			assert.strictEqual(strategy.retryable, true);
			assert.strictEqual(strategy.backoffMs, 100);
		});

		/**
		 * Test recovery strategy for transaction error
		 */
		it("should create recovery strategy for transaction error", () => {
			const error = new TransactionError("test transaction error");
			const strategy = ErrorRecovery.createRecoveryStrategy(error);
			
			assert.strictEqual(strategy.error, error);
			assert.strictEqual(strategy.isRecoverable, false);
			assert.strictEqual(strategy.retryable, true);
			assert.strictEqual(strategy.backoffMs, 0);
		});

		/**
		 * Test recovery strategy for non-retryable error
		 */
		it("should create recovery strategy for non-retryable error", () => {
			const error = new IndexError("test index error");
			const strategy = ErrorRecovery.createRecoveryStrategy(error);
			
			assert.strictEqual(strategy.error, error);
			assert.strictEqual(strategy.isRecoverable, false);
			assert.strictEqual(strategy.retryable, false);
			assert.strictEqual(strategy.backoffMs, 0);
		});

		/**
		 * Test strategy contains all expected properties
		 */
		it("should contain all expected properties in strategy", () => {
			const error = new RecordNotFoundError("test");
			const strategy = ErrorRecovery.createRecoveryStrategy(error);
			
			assert.ok(strategy.hasOwnProperty("error"));
			assert.ok(strategy.hasOwnProperty("isRecoverable"));
			assert.ok(strategy.hasOwnProperty("actions"));
			assert.ok(strategy.hasOwnProperty("retryable"));
			assert.ok(strategy.hasOwnProperty("backoffMs"));
		});
	});
});
