import assert from "node:assert";
import { FieldConstraint } from "../../src/field-constraint.js";
import { ValidationError, TypeConstraintError } from "../../src/errors.js";
import { DataTypes } from "../../src/data-types.js";

describe("FieldConstraint", () => {
	describe("constructor", () => {
		it("should create constraint with default options", () => {
			const constraint = new FieldConstraint();
			
			assert.strictEqual(constraint.type, DataTypes.ANY);
			assert.strictEqual(constraint.required, false);
			assert.strictEqual(constraint.default, undefined);
			assert.strictEqual(constraint.validator, undefined);
			assert.strictEqual(constraint.min, undefined);
			assert.strictEqual(constraint.max, undefined);
			assert.strictEqual(constraint.enum, undefined);
			assert.strictEqual(constraint.pattern, undefined);
		});

		it("should create constraint with all options", () => {
			const validator = (value) => true;
			const pattern = /test/;
			const enumValues = ["a", "b", "c"];
			
			const constraint = new FieldConstraint({
				type: DataTypes.STRING,
				required: true,
				default: "default value",
				validator,
				min: 5,
				max: 10,
				enum: enumValues,
				pattern
			});
			
			assert.strictEqual(constraint.type, DataTypes.STRING);
			assert.strictEqual(constraint.required, true);
			assert.strictEqual(constraint.default, "default value");
			assert.strictEqual(constraint.validator, validator);
			assert.strictEqual(constraint.min, 5);
			assert.strictEqual(constraint.max, 10);
			assert.strictEqual(constraint.enum, enumValues);
			assert.strictEqual(constraint.pattern, pattern);
		});

		it("should handle default value of zero", () => {
			const constraint = new FieldConstraint({ default: 0 });
			assert.strictEqual(constraint.default, 0);
		});

		it("should handle default value of false", () => {
			const constraint = new FieldConstraint({ default: false });
			assert.strictEqual(constraint.default, false);
		});

		it("should handle default value of empty string", () => {
			const constraint = new FieldConstraint({ default: "" });
			assert.strictEqual(constraint.default, "");
		});

		it("should handle default value of null", () => {
			const constraint = new FieldConstraint({ default: null });
			assert.strictEqual(constraint.default, null);
		});
	});

	describe("validate() - required field validation", () => {
		it("should throw ValidationError for undefined required field", () => {
			const constraint = new FieldConstraint({ required: true });
			
			assert.throws(
				() => constraint.validate(undefined, "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'testField' is required");
					assert.strictEqual(err.context.field, "testField");
					assert.strictEqual(err.context.value, undefined);
					return true;
				}
			);
		});

		it("should throw ValidationError for null required field", () => {
			const constraint = new FieldConstraint({ required: true });
			
			assert.throws(
				() => constraint.validate(null, "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'testField' is required");
					assert.strictEqual(err.context.field, "testField");
					assert.strictEqual(err.context.value, null);
					return true;
				}
			);
		});

		it("should use default field name 'field' when not provided", () => {
			const constraint = new FieldConstraint({ required: true });
			
			assert.throws(
				() => constraint.validate(undefined),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'field' is required");
					assert.strictEqual(err.context.field, "field");
					return true;
				}
			);
		});

		it("should accept valid value for required field", () => {
			const constraint = new FieldConstraint({ required: true });
			const result = constraint.validate("test", "testField");
			assert.strictEqual(result, "test");
		});
	});

	describe("validate() - default value handling", () => {
		it("should return default value for undefined value", () => {
			const constraint = new FieldConstraint({ default: "default" });
			const result = constraint.validate(undefined, "testField");
			assert.strictEqual(result, "default");
		});

		it("should return default value for null value", () => {
			const constraint = new FieldConstraint({ default: "default" });
			const result = constraint.validate(null, "testField");
			assert.strictEqual(result, "default");
		});

		it("should return undefined when no default is set and field is not required", () => {
			const constraint = new FieldConstraint();
			const result = constraint.validate(undefined, "testField");
			assert.strictEqual(result, undefined);
		});

		it("should return null when value is null and no default is set", () => {
			const constraint = new FieldConstraint();
			const result = constraint.validate(null, "testField");
			assert.strictEqual(result, null);
		});

		it("should return default value of 0", () => {
			const constraint = new FieldConstraint({ default: 0 });
			const result = constraint.validate(undefined, "testField");
			assert.strictEqual(result, 0);
		});

		it("should return default value of false", () => {
			const constraint = new FieldConstraint({ default: false });
			const result = constraint.validate(undefined, "testField");
			assert.strictEqual(result, false);
		});
	});

	describe("validate() - type validation", () => {
		it("should pass validation for ANY type", () => {
			const constraint = new FieldConstraint({ type: DataTypes.ANY });
			
			assert.strictEqual(constraint.validate("string"), "string");
			assert.strictEqual(constraint.validate(123), 123);
			assert.strictEqual(constraint.validate(true), true);
			assert.deepStrictEqual(constraint.validate([1, 2, 3]), [1, 2, 3]);
			assert.deepStrictEqual(constraint.validate({ a: 1 }), { a: 1 });
		});

		it("should pass validation for matching string type", () => {
			const constraint = new FieldConstraint({ type: DataTypes.STRING });
			const result = constraint.validate("test", "testField");
			assert.strictEqual(result, "test");
		});

		it("should pass validation for matching number type", () => {
			const constraint = new FieldConstraint({ type: DataTypes.NUMBER });
			const result = constraint.validate(123, "testField");
			assert.strictEqual(result, 123);
		});

		it("should pass validation for matching boolean type", () => {
			const constraint = new FieldConstraint({ type: DataTypes.BOOLEAN });
			const result = constraint.validate(true, "testField");
			assert.strictEqual(result, true);
		});

		it("should pass validation for matching array type", () => {
			const constraint = new FieldConstraint({ type: DataTypes.ARRAY });
			const value = [1, 2, 3];
			const result = constraint.validate(value, "testField");
			assert.deepStrictEqual(result, value);
		});

		it("should pass validation for matching object type", () => {
			const constraint = new FieldConstraint({ type: DataTypes.OBJECT });
			const value = { a: 1 };
			const result = constraint.validate(value, "testField");
			assert.deepStrictEqual(result, value);
		});

		it("should throw TypeConstraintError for mismatched type", () => {
			const constraint = new FieldConstraint({ type: DataTypes.STRING });
			
			assert.throws(
				() => constraint.validate(123, "testField"),
				(err) => {
					assert(err instanceof TypeConstraintError);
					assert.strictEqual(err.message, "Field 'testField' expected type 'string' but got 'number'");
					assert.strictEqual(err.context.expected, DataTypes.STRING);
					assert.strictEqual(err.context.actual, "number");
					assert.strictEqual(err.context.field, "testField");
					return true;
				}
			);
		});

		it("should accept UUID as string type", () => {
			const constraint = new FieldConstraint({ type: DataTypes.STRING });
			const uuid = "550e8400-e29b-41d4-a716-446655440000";
			const result = constraint.validate(uuid, "testField");
			assert.strictEqual(result, uuid);
		});

		it("should accept email as string type", () => {
			const constraint = new FieldConstraint({ type: DataTypes.STRING });
			const email = "test@example.com";
			const result = constraint.validate(email, "testField");
			assert.strictEqual(result, email);
		});

		it("should accept URL as string type", () => {
			const constraint = new FieldConstraint({ type: DataTypes.STRING });
			const url = "https://example.com";
			const result = constraint.validate(url, "testField");
			assert.strictEqual(result, url);
		});
	});

	describe("validate() - range validation", () => {
		it("should pass validation for number within range", () => {
			const constraint = new FieldConstraint({ min: 5, max: 10 });
			const result = constraint.validate(7, "testField");
			assert.strictEqual(result, 7);
		});

		it("should pass validation for number at minimum", () => {
			const constraint = new FieldConstraint({ min: 5 });
			const result = constraint.validate(5, "testField");
			assert.strictEqual(result, 5);
		});

		it("should pass validation for number at maximum", () => {
			const constraint = new FieldConstraint({ max: 10 });
			const result = constraint.validate(10, "testField");
			assert.strictEqual(result, 10);
		});

		it("should throw ValidationError for number below minimum", () => {
			const constraint = new FieldConstraint({ min: 5 });
			
			assert.throws(
				() => constraint.validate(3, "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'testField' value 3 is below minimum 5");
					assert.strictEqual(err.context.field, "testField");
					assert.strictEqual(err.context.value, 3);
					return true;
				}
			);
		});

		it("should throw ValidationError for number above maximum", () => {
			const constraint = new FieldConstraint({ max: 10 });
			
			assert.throws(
				() => constraint.validate(15, "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'testField' value 15 exceeds maximum 10");
					assert.strictEqual(err.context.field, "testField");
					assert.strictEqual(err.context.value, 15);
					return true;
				}
			);
		});

		it("should handle min and max validation with decimal numbers", () => {
			const constraint = new FieldConstraint({ min: 1.5, max: 2.5 });
			
			assert.strictEqual(constraint.validate(2.0, "testField"), 2.0);
			
			assert.throws(
				() => constraint.validate(1.0, "testField"),
				ValidationError
			);
			
			assert.throws(
				() => constraint.validate(3.0, "testField"),
				ValidationError
			);
		});
	});

	describe("validate() - length validation", () => {
		it("should pass validation for string within length range", () => {
			const constraint = new FieldConstraint({ min: 3, max: 10 });
			const result = constraint.validate("hello", "testField");
			assert.strictEqual(result, "hello");
		});

		it("should pass validation for array within length range", () => {
			const constraint = new FieldConstraint({ min: 2, max: 5 });
			const value = [1, 2, 3];
			const result = constraint.validate(value, "testField");
			assert.deepStrictEqual(result, value);
		});

		it("should throw ValidationError for string below minimum length", () => {
			const constraint = new FieldConstraint({ min: 5 });
			
			assert.throws(
				() => constraint.validate("hi", "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'testField' length 2 is below minimum 5");
					assert.strictEqual(err.context.field, "testField");
					assert.strictEqual(err.context.value, "hi");
					return true;
				}
			);
		});

		it("should throw ValidationError for string above maximum length", () => {
			const constraint = new FieldConstraint({ max: 5 });
			
			assert.throws(
				() => constraint.validate("this is too long", "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'testField' length 16 exceeds maximum 5");
					assert.strictEqual(err.context.field, "testField");
					assert.strictEqual(err.context.value, "this is too long");
					return true;
				}
			);
		});

		it("should throw ValidationError for array below minimum length", () => {
			const constraint = new FieldConstraint({ min: 3 });
			
			assert.throws(
				() => constraint.validate([1, 2], "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'testField' length 2 is below minimum 3");
					return true;
				}
			);
		});

		it("should throw ValidationError for array above maximum length", () => {
			const constraint = new FieldConstraint({ max: 2 });
			
			assert.throws(
				() => constraint.validate([1, 2, 3, 4], "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'testField' length 4 exceeds maximum 2");
					return true;
				}
			);
		});

		it("should handle empty string with minimum length", () => {
			const constraint = new FieldConstraint({ min: 1 });
			
			assert.throws(
				() => constraint.validate("", "testField"),
				ValidationError
			);
		});

		it("should handle empty array with minimum length", () => {
			const constraint = new FieldConstraint({ min: 1 });
			
			assert.throws(
				() => constraint.validate([], "testField"),
				ValidationError
			);
		});
	});

	describe("validate() - enum validation", () => {
		it("should pass validation for value in enum", () => {
			const constraint = new FieldConstraint({ enum: ["a", "b", "c"] });
			const result = constraint.validate("b", "testField");
			assert.strictEqual(result, "b");
		});

		it("should throw ValidationError for value not in enum", () => {
			const constraint = new FieldConstraint({ enum: ["a", "b", "c"] });
			
			assert.throws(
				() => constraint.validate("d", "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'testField' value 'd' is not in allowed values: a, b, c");
					assert.strictEqual(err.context.field, "testField");
					assert.strictEqual(err.context.value, "d");
					return true;
				}
			);
		});

		it("should handle enum with different data types", () => {
			const constraint = new FieldConstraint({ enum: [1, "two", true, null] });
			
			assert.strictEqual(constraint.validate(1, "testField"), 1);
			assert.strictEqual(constraint.validate("two", "testField"), "two");
			assert.strictEqual(constraint.validate(true, "testField"), true);
			assert.strictEqual(constraint.validate(null, "testField"), null);
			
			assert.throws(
				() => constraint.validate("three", "testField"),
				ValidationError
			);
		});

		it("should handle empty enum array", () => {
			const constraint = new FieldConstraint({ enum: [] });
			
			assert.throws(
				() => constraint.validate("anything", "testField"),
				ValidationError
			);
		});

		it("should skip enum validation when enum is not set", () => {
			const constraint = new FieldConstraint();
			const result = constraint.validate("any value", "testField");
			assert.strictEqual(result, "any value");
		});
	});

	describe("validate() - pattern validation", () => {
		it("should pass validation for string matching pattern", () => {
			const constraint = new FieldConstraint({ pattern: /^test/ });
			const result = constraint.validate("test123", "testField");
			assert.strictEqual(result, "test123");
		});

		it("should throw ValidationError for string not matching pattern", () => {
			const constraint = new FieldConstraint({ pattern: /^test/ });
			
			assert.throws(
				() => constraint.validate("abc123", "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'testField' value 'abc123' does not match required pattern");
					assert.strictEqual(err.context.field, "testField");
					assert.strictEqual(err.context.value, "abc123");
					return true;
				}
			);
		});

		it("should only apply pattern validation to strings", () => {
			const constraint = new FieldConstraint({ pattern: /^test/ });
			
			// Non-string values should pass (pattern validation skipped)
			assert.strictEqual(constraint.validate(123, "testField"), 123);
			assert.strictEqual(constraint.validate(true, "testField"), true);
			assert.deepStrictEqual(constraint.validate([1, 2, 3], "testField"), [1, 2, 3]);
		});

		it("should handle complex regex patterns", () => {
			const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			const constraint = new FieldConstraint({ pattern: emailPattern });
			
			assert.strictEqual(constraint.validate("test@example.com", "testField"), "test@example.com");
			
			assert.throws(
				() => constraint.validate("invalid-email", "testField"),
				ValidationError
			);
		});

		it("should skip pattern validation when pattern is not set", () => {
			const constraint = new FieldConstraint();
			const result = constraint.validate("any string", "testField");
			assert.strictEqual(result, "any string");
		});
	});

	describe("validate() - custom validator", () => {
		it("should pass validation when custom validator returns true", () => {
			const validator = (value) => value > 5;
			const constraint = new FieldConstraint({ validator });
			const result = constraint.validate(10, "testField");
			assert.strictEqual(result, 10);
		});

		it("should pass validation when custom validator returns undefined", () => {
			const validator = (value) => {
				// Validator that doesn't return anything (undefined)
				if (value < 0) {
					return false;
				}
			};
			const constraint = new FieldConstraint({ validator });
			const result = constraint.validate(5, "testField");
			assert.strictEqual(result, 5);
		});

		it("should throw ValidationError when custom validator returns false", () => {
			const validator = (value) => value > 5;
			const constraint = new FieldConstraint({ validator });
			
			assert.throws(
				() => constraint.validate(3, "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Custom validation failed for field 'testField'");
					assert.strictEqual(err.context.field, "testField");
					assert.strictEqual(err.context.value, 3);
					return true;
				}
			);
		});

		it("should throw ValidationError with custom message when validator returns string", () => {
			const validator = (value) => value > 5 ? true : "Value must be greater than 5";
			const constraint = new FieldConstraint({ validator });
			
			assert.throws(
				() => constraint.validate(3, "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Value must be greater than 5");
					assert.strictEqual(err.context.field, "testField");
					assert.strictEqual(err.context.value, 3);
					return true;
				}
			);
		});

		it("should receive field name in custom validator", () => {
			let receivedValue, receivedFieldName;
			const validator = (value, fieldName) => {
				receivedValue = value;
				receivedFieldName = fieldName;
				return true;
			};
			const constraint = new FieldConstraint({ validator });
			
			constraint.validate("test", "myField");
			
			assert.strictEqual(receivedValue, "test");
			assert.strictEqual(receivedFieldName, "myField");
		});

		it("should handle custom validator throwing error", () => {
			const validator = () => {
				throw new Error("Custom error");
			};
			const constraint = new FieldConstraint({ validator });
			
			assert.throws(
				() => constraint.validate("test", "testField"),
				(err) => {
					assert.strictEqual(err.message, "Custom error");
					return true;
				}
			);
		});

		it("should skip custom validation when validator is not a function", () => {
			const constraint = new FieldConstraint({ validator: "not a function" });
			const result = constraint.validate("test", "testField");
			assert.strictEqual(result, "test");
		});

		it("should skip custom validation when validator is not set", () => {
			const constraint = new FieldConstraint();
			const result = constraint.validate("test", "testField");
			assert.strictEqual(result, "test");
		});
	});

	describe("validate() - combined validations", () => {
		it("should pass all validations when value is valid", () => {
			const validator = (value) => value.includes("test");
			const constraint = new FieldConstraint({
				type: DataTypes.STRING,
				required: true,
				min: 5,
				max: 20,
				enum: ["test123", "testing", "tester"],
				pattern: /^test/,
				validator
			});
			
			const result = constraint.validate("test123", "testField");
			assert.strictEqual(result, "test123");
		});

		it("should fail on first validation error (type validation before others)", () => {
			const constraint = new FieldConstraint({
				type: DataTypes.STRING,
				min: 5,
				enum: ["test"],
				pattern: /^test/
			});
			
			assert.throws(
				() => constraint.validate(123, "testField"),
				TypeConstraintError
			);
		});

		it("should validate range before length for numbers", () => {
			const constraint = new FieldConstraint({
				min: 100,
				max: 200
			});
			
			// Number range validation should occur
			assert.throws(
				() => constraint.validate(50, "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert(err.message.includes("below minimum"));
					return true;
				}
			);
		});

		it("should validate enum after type and range/length", () => {
			const constraint = new FieldConstraint({
				type: DataTypes.STRING,
				min: 3,
				enum: ["test"]
			});
			
			// Should fail on enum validation, not length
			assert.throws(
				() => constraint.validate("abc", "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert(err.message.includes("not in allowed values"));
					return true;
				}
			);
		});

		it("should validate pattern after enum", () => {
			const constraint = new FieldConstraint({
				enum: ["abc123", "def456"],
				pattern: /^abc/
			});
			
			// Should pass enum but fail pattern
			assert.throws(
				() => constraint.validate("def456", "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert(err.message.includes("does not match required pattern"));
					return true;
				}
			);
		});

		it("should validate custom validator last", () => {
			const validator = () => "Custom validation failed";
			const constraint = new FieldConstraint({
				enum: ["test"],
				pattern: /^test/,
				validator
			});
			
			// Should pass enum and pattern but fail custom validator
			assert.throws(
				() => constraint.validate("test", "testField"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Custom validation failed");
					return true;
				}
			);
		});
	});

	describe("validate() - edge cases", () => {
		it("should handle NaN values", () => {
			const constraint = new FieldConstraint({ type: DataTypes.NUMBER });
			
			// NaN is of type number, so should pass type validation
			const result = constraint.validate(NaN, "testField");
			assert(Number.isNaN(result));
		});

		it("should handle Infinity values", () => {
			const constraint = new FieldConstraint({ 
				type: DataTypes.NUMBER,
				max: 1000
			});
			
			// Should fail max validation
			assert.throws(
				() => constraint.validate(Infinity, "testField"),
				ValidationError
			);
		});

		it("should handle Date objects", () => {
			const constraint = new FieldConstraint({ type: DataTypes.DATE });
			const date = new Date();
			const result = constraint.validate(date, "testField");
			assert.strictEqual(result, date);
		});

		it("should handle object with valueOf method for range validation", () => {
			const constraint = new FieldConstraint({ min: 5, max: 10 });
			const obj = {
				valueOf: () => 7,
				toString: () => "7"
			};
			
			const result = constraint.validate(obj, "testField");
			assert.strictEqual(result, obj);
		});

		it("should handle string numbers for range validation", () => {
			const constraint = new FieldConstraint({ min: 5, max: 10 });
			
			// String "7" should be compared as string, failing numeric range
			assert.throws(
				() => constraint.validate("7", "testField"),
				ValidationError
			);
		});

		it("should handle objects without length property", () => {
			const constraint = new FieldConstraint({ min: 2, max: 5 });
			const obj = { a: 1, b: 2 };
			
			// Object doesn't have length property, so length validation is skipped
			const result = constraint.validate(obj, "testField");
			assert.deepStrictEqual(result, obj);
		});

		it("should handle values with length property that's not a number", () => {
			const constraint = new FieldConstraint({ min: 2, max: 5 });
			const obj = { length: "not a number" };
			
			// Length validation should be skipped for non-numeric length
			const result = constraint.validate(obj, "testField");
			assert.deepStrictEqual(result, obj);
		});
	});
});
