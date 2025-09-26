import { strict as assert } from "assert";
import { ConfigValidator } from "../../src/config-validator.js";
import { ConfigurationError } from "../../src/errors.js";
import { Schema } from "../../src/schema.js";

describe("ConfigValidator", () => {
	describe("validate()", () => {
		describe("Valid configurations", () => {
			it("should validate empty config", () => {
				const result = ConfigValidator.validate();
				assert.deepStrictEqual(result, {});
			});

			it("should validate empty config object", () => {
				const result = ConfigValidator.validate({});
				assert.deepStrictEqual(result, {});
			});

			it("should validate config with valid delimiter", () => {
				const config = { delimiter: "," };
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should validate config with valid id", () => {
				const config = { id: "test-id" };
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should validate config with immutable true", () => {
				const config = { immutable: true };
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should validate config with immutable false", () => {
				const config = { immutable: false };
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should validate config with valid index array", () => {
				const config = { index: ["field1", "field2"] };
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should validate config with empty index array", () => {
				const config = { index: [] };
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should validate config with valid key", () => {
				const config = { key: "id" };
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should validate config with versioning true", () => {
				const config = { versioning: true };
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should validate config with versioning false", () => {
				const config = { versioning: false };
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should validate config with valid schema", () => {
				const schema = new Schema();
				const config = { schema };
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should validate config with all valid properties", () => {
				const schema = new Schema();
				const config = {
					delimiter: "|",
					id: "test-id",
					immutable: true,
					index: ["name", "email"],
					key: "id",
					versioning: false,
					schema
				};
				const result = ConfigValidator.validate(config);
				assert.deepStrictEqual(result, config);
			});

			it("should return a copy of the config (not modify original)", () => {
				const config = { id: "test" };
				const result = ConfigValidator.validate(config);
				assert.notStrictEqual(result, config);
				assert.deepStrictEqual(result, config);
			});
		});

		describe("Invalid delimiter", () => {
			it("should throw error for empty string delimiter", () => {
				assert.throws(
					() => ConfigValidator.validate({ delimiter: "" }),
					{
						name: "ConfigurationError",
						message: "Delimiter must be a non-empty string"
					}
				);
			});

			it("should throw error for number delimiter", () => {
				assert.throws(
					() => ConfigValidator.validate({ delimiter: 123 }),
					{
						name: "ConfigurationError",
						message: "Delimiter must be a non-empty string"
					}
				);
			});

			it("should throw error for boolean delimiter", () => {
				assert.throws(
					() => ConfigValidator.validate({ delimiter: true }),
					{
						name: "ConfigurationError",
						message: "Delimiter must be a non-empty string"
					}
				);
			});

			it("should throw error for object delimiter", () => {
				assert.throws(
					() => ConfigValidator.validate({ delimiter: {} }),
					{
						name: "ConfigurationError",
						message: "Delimiter must be a non-empty string"
					}
				);
			});

			it("should throw error for array delimiter", () => {
				assert.throws(
					() => ConfigValidator.validate({ delimiter: [] }),
					{
						name: "ConfigurationError",
						message: "Delimiter must be a non-empty string"
					}
				);
			});

			it("should throw error for null delimiter", () => {
				assert.throws(
					() => ConfigValidator.validate({ delimiter: null }),
					{
						name: "ConfigurationError",
						message: "Delimiter must be a non-empty string"
					}
				);
			});
		});

		describe("Invalid id", () => {
			it("should throw error for number id", () => {
				assert.throws(
					() => ConfigValidator.validate({ id: 123 }),
					{
						name: "ConfigurationError",
						message: "ID must be a string"
					}
				);
			});

			it("should throw error for boolean id", () => {
				assert.throws(
					() => ConfigValidator.validate({ id: true }),
					{
						name: "ConfigurationError",
						message: "ID must be a string"
					}
				);
			});

			it("should throw error for object id", () => {
				assert.throws(
					() => ConfigValidator.validate({ id: {} }),
					{
						name: "ConfigurationError",
						message: "ID must be a string"
					}
				);
			});

			it("should throw error for array id", () => {
				assert.throws(
					() => ConfigValidator.validate({ id: [] }),
					{
						name: "ConfigurationError",
						message: "ID must be a string"
					}
				);
			});

			it("should throw error for null id", () => {
				assert.throws(
					() => ConfigValidator.validate({ id: null }),
					{
						name: "ConfigurationError",
						message: "ID must be a string"
					}
				);
			});
		});

		describe("Invalid immutable", () => {
			it("should throw error for string immutable", () => {
				assert.throws(
					() => ConfigValidator.validate({ immutable: "true" }),
					{
						name: "ConfigurationError",
						message: "Immutable must be a boolean"
					}
				);
			});

			it("should throw error for number immutable", () => {
				assert.throws(
					() => ConfigValidator.validate({ immutable: 1 }),
					{
						name: "ConfigurationError",
						message: "Immutable must be a boolean"
					}
				);
			});

			it("should throw error for object immutable", () => {
				assert.throws(
					() => ConfigValidator.validate({ immutable: {} }),
					{
						name: "ConfigurationError",
						message: "Immutable must be a boolean"
					}
				);
			});

			it("should throw error for array immutable", () => {
				assert.throws(
					() => ConfigValidator.validate({ immutable: [] }),
					{
						name: "ConfigurationError",
						message: "Immutable must be a boolean"
					}
				);
			});

			it("should throw error for null immutable", () => {
				assert.throws(
					() => ConfigValidator.validate({ immutable: null }),
					{
						name: "ConfigurationError",
						message: "Immutable must be a boolean"
					}
				);
			});
		});

		describe("Invalid index", () => {
			it("should throw error for string index", () => {
				assert.throws(
					() => ConfigValidator.validate({ index: "field" }),
					{
						name: "ConfigurationError",
						message: "Index must be an array"
					}
				);
			});

			it("should throw error for number index", () => {
				assert.throws(
					() => ConfigValidator.validate({ index: 123 }),
					{
						name: "ConfigurationError",
						message: "Index must be an array"
					}
				);
			});

			it("should throw error for boolean index", () => {
				assert.throws(
					() => ConfigValidator.validate({ index: true }),
					{
						name: "ConfigurationError",
						message: "Index must be an array"
					}
				);
			});

			it("should throw error for object index", () => {
				assert.throws(
					() => ConfigValidator.validate({ index: {} }),
					{
						name: "ConfigurationError",
						message: "Index must be an array"
					}
				);
			});

			it("should throw error for null index", () => {
				assert.throws(
					() => ConfigValidator.validate({ index: null }),
					{
						name: "ConfigurationError",
						message: "Index must be an array"
					}
				);
			});

			it("should throw error for array with non-string elements", () => {
				assert.throws(
					() => ConfigValidator.validate({ index: ["field1", 123] }),
					{
						name: "ConfigurationError",
						message: "Index field names must be strings"
					}
				);
			});

			it("should throw error for array with boolean elements", () => {
				assert.throws(
					() => ConfigValidator.validate({ index: [true, "field1"] }),
					{
						name: "ConfigurationError",
						message: "Index field names must be strings"
					}
				);
			});

			it("should throw error for array with object elements", () => {
				assert.throws(
					() => ConfigValidator.validate({ index: ["field1", {}] }),
					{
						name: "ConfigurationError",
						message: "Index field names must be strings"
					}
				);
			});

			it("should throw error for array with null elements", () => {
				assert.throws(
					() => ConfigValidator.validate({ index: ["field1", null] }),
					{
						name: "ConfigurationError",
						message: "Index field names must be strings"
					}
				);
			});
		});

		describe("Invalid key", () => {
			it("should throw error for number key", () => {
				assert.throws(
					() => ConfigValidator.validate({ key: 123 }),
					{
						name: "ConfigurationError",
						message: "Key field must be a string"
					}
				);
			});

			it("should throw error for boolean key", () => {
				assert.throws(
					() => ConfigValidator.validate({ key: true }),
					{
						name: "ConfigurationError",
						message: "Key field must be a string"
					}
				);
			});

			it("should throw error for object key", () => {
				assert.throws(
					() => ConfigValidator.validate({ key: {} }),
					{
						name: "ConfigurationError",
						message: "Key field must be a string"
					}
				);
			});

			it("should throw error for array key", () => {
				assert.throws(
					() => ConfigValidator.validate({ key: [] }),
					{
						name: "ConfigurationError",
						message: "Key field must be a string"
					}
				);
			});

			it("should throw error for null key", () => {
				assert.throws(
					() => ConfigValidator.validate({ key: null }),
					{
						name: "ConfigurationError",
						message: "Key field must be a string"
					}
				);
			});
		});

		describe("Invalid versioning", () => {
			it("should throw error for string versioning", () => {
				assert.throws(
					() => ConfigValidator.validate({ versioning: "true" }),
					{
						name: "ConfigurationError",
						message: "Versioning must be a boolean"
					}
				);
			});

			it("should throw error for number versioning", () => {
				assert.throws(
					() => ConfigValidator.validate({ versioning: 1 }),
					{
						name: "ConfigurationError",
						message: "Versioning must be a boolean"
					}
				);
			});

			it("should throw error for object versioning", () => {
				assert.throws(
					() => ConfigValidator.validate({ versioning: {} }),
					{
						name: "ConfigurationError",
						message: "Versioning must be a boolean"
					}
				);
			});

			it("should throw error for array versioning", () => {
				assert.throws(
					() => ConfigValidator.validate({ versioning: [] }),
					{
						name: "ConfigurationError",
						message: "Versioning must be a boolean"
					}
				);
			});

			it("should throw error for null versioning", () => {
				assert.throws(
					() => ConfigValidator.validate({ versioning: null }),
					{
						name: "ConfigurationError",
						message: "Versioning must be a boolean"
					}
				);
			});
		});

		describe("Invalid schema", () => {
			it("should throw error for string schema", () => {
				assert.throws(
					() => ConfigValidator.validate({ schema: "schema" }),
					{
						name: "ConfigurationError",
						message: "Schema must be an instance of Schema class"
					}
				);
			});

			it("should throw error for number schema", () => {
				assert.throws(
					() => ConfigValidator.validate({ schema: 123 }),
					{
						name: "ConfigurationError",
						message: "Schema must be an instance of Schema class"
					}
				);
			});

			it("should throw error for boolean schema", () => {
				assert.throws(
					() => ConfigValidator.validate({ schema: true }),
					{
						name: "ConfigurationError",
						message: "Schema must be an instance of Schema class"
					}
				);
			});

			it("should throw error for plain object schema", () => {
				assert.throws(
					() => ConfigValidator.validate({ schema: {} }),
					{
						name: "ConfigurationError",
						message: "Schema must be an instance of Schema class"
					}
				);
			});

			it("should throw error for array schema", () => {
				assert.throws(
					() => ConfigValidator.validate({ schema: [] }),
					{
						name: "ConfigurationError",
						message: "Schema must be an instance of Schema class"
					}
				);
			});

			it("should throw error for null schema", () => {
				assert.throws(
					() => ConfigValidator.validate({ schema: null }),
					{
						name: "ConfigurationError",
						message: "Schema must be an instance of Schema class"
					}
				);
			});
		});

		describe("Error properties", () => {
			it("should include configKey and configValue in ConfigurationError for delimiter", () => {
				try {
					ConfigValidator.validate({ delimiter: 123 });
					assert.fail("Should have thrown");
				} catch (error) {
					assert.strictEqual(error.name, "ConfigurationError");
					assert.strictEqual(error.code, "CONFIGURATION_ERROR");
					assert.strictEqual(error.context.configKey, "delimiter");
					assert.strictEqual(error.context.configValue, 123);
				}
			});

			it("should include configKey and configValue in ConfigurationError for index field", () => {
				try {
					ConfigValidator.validate({ index: ["valid", 123] });
					assert.fail("Should have thrown");
				} catch (error) {
					assert.strictEqual(error.name, "ConfigurationError");
					assert.strictEqual(error.code, "CONFIGURATION_ERROR");
					assert.strictEqual(error.context.configKey, "index");
					assert.strictEqual(error.context.configValue, 123);
				}
			});
		});
	});
});
