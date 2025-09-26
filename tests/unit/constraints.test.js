import assert from "node:assert";
import { Constraints } from "../../src/constraints.js";
import { FieldConstraint } from "../../src/field-constraint.js";
import { DataTypes } from "../../src/data-types.js";

describe("Constraints", () => {
	describe("requiredString()", () => {
		it("should create required string constraint with defaults", () => {
			const constraint = Constraints.requiredString();

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.STRING);
			assert.strictEqual(constraint.required, true);
		});

		it("should create required string constraint with options", () => {
			const options = {
				min: 5,
				max: 20,
				pattern: /^[a-z]+$/,
				default: "default"
			};
			const constraint = Constraints.requiredString(options);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.STRING);
			assert.strictEqual(constraint.required, true);
			assert.strictEqual(constraint.min, 5);
			assert.strictEqual(constraint.max, 20);
			assert.strictEqual(constraint.pattern, options.pattern);
			assert.strictEqual(constraint.default, "default");
		});

		it("should merge options with defaults correctly", () => {
			const options = {
				required: false, // This will override the function default
				type: DataTypes.NUMBER // This will override the function default
			};
			const constraint = Constraints.requiredString(options);

			// Options override the function defaults due to spread operator order
			assert.strictEqual(constraint.type, DataTypes.NUMBER);
			assert.strictEqual(constraint.required, false);
		});
	});

	describe("optionalString()", () => {
		it("should create optional string constraint with defaults", () => {
			const constraint = Constraints.optionalString();

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.STRING);
			assert.strictEqual(constraint.required, false);
		});

		it("should create optional string constraint with options", () => {
			const options = {
				min: 3,
				max: 15,
				pattern: /^[A-Z]+$/,
				default: "optional"
			};
			const constraint = Constraints.optionalString(options);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.STRING);
			assert.strictEqual(constraint.required, false);
			assert.strictEqual(constraint.min, 3);
			assert.strictEqual(constraint.max, 15);
			assert.strictEqual(constraint.pattern, options.pattern);
			assert.strictEqual(constraint.default, "optional");
		});

		it("should merge options with defaults correctly", () => {
			const options = {
				required: true, // This will override the function default
				type: DataTypes.NUMBER // This will override the function default
			};
			const constraint = Constraints.optionalString(options);

			// Options override the function defaults due to spread operator order
			assert.strictEqual(constraint.type, DataTypes.NUMBER);
			assert.strictEqual(constraint.required, true);
		});
	});

	describe("requiredNumber()", () => {
		it("should create required number constraint with defaults", () => {
			const constraint = Constraints.requiredNumber();

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.NUMBER);
			assert.strictEqual(constraint.required, true);
		});

		it("should create required number constraint with options", () => {
			const options = {
				min: 0,
				max: 100,
				default: 42,
				validator: (value) => value >= 0
			};
			const constraint = Constraints.requiredNumber(options);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.NUMBER);
			assert.strictEqual(constraint.required, true);
			assert.strictEqual(constraint.min, 0);
			assert.strictEqual(constraint.max, 100);
			assert.strictEqual(constraint.default, 42);
			assert.strictEqual(constraint.validator, options.validator);
		});

		it("should merge options with defaults correctly", () => {
			const options = {
				required: false, // This will override the function default
				type: DataTypes.STRING // This will override the function default
			};
			const constraint = Constraints.requiredNumber(options);

			// Options override the function defaults due to spread operator order
			assert.strictEqual(constraint.type, DataTypes.STRING);
			assert.strictEqual(constraint.required, false);
		});
	});

	describe("optionalNumber()", () => {
		it("should create optional number constraint with defaults", () => {
			const constraint = Constraints.optionalNumber();

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.NUMBER);
			assert.strictEqual(constraint.required, false);
		});

		it("should create optional number constraint with options", () => {
			const options = {
				min: -10,
				max: 10,
				default: 0,
				validator: (value) => Number.isInteger(value)
			};
			const constraint = Constraints.optionalNumber(options);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.NUMBER);
			assert.strictEqual(constraint.required, false);
			assert.strictEqual(constraint.min, -10);
			assert.strictEqual(constraint.max, 10);
			assert.strictEqual(constraint.default, 0);
			assert.strictEqual(constraint.validator, options.validator);
		});

		it("should merge options with defaults correctly", () => {
			const options = {
				required: true, // This will override the function default
				type: DataTypes.STRING // This will override the function default
			};
			const constraint = Constraints.optionalNumber(options);

			// Options override the function defaults due to spread operator order
			assert.strictEqual(constraint.type, DataTypes.STRING);
			assert.strictEqual(constraint.required, true);
		});
	});

	describe("uuid()", () => {
		it("should create required UUID constraint by default", () => {
			const constraint = Constraints.uuid();

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.UUID);
			assert.strictEqual(constraint.required, true);
		});

		it("should create required UUID constraint when explicitly set to true", () => {
			const constraint = Constraints.uuid(true);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.UUID);
			assert.strictEqual(constraint.required, true);
		});

		it("should create optional UUID constraint when set to false", () => {
			const constraint = Constraints.uuid(false);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.UUID);
			assert.strictEqual(constraint.required, false);
		});
	});

	describe("email()", () => {
		it("should create required email constraint by default", () => {
			const constraint = Constraints.email();

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.EMAIL);
			assert.strictEqual(constraint.required, true);
		});

		it("should create required email constraint when explicitly set to true", () => {
			const constraint = Constraints.email(true);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.EMAIL);
			assert.strictEqual(constraint.required, true);
		});

		it("should create optional email constraint when set to false", () => {
			const constraint = Constraints.email(false);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.EMAIL);
			assert.strictEqual(constraint.required, false);
		});
	});

	describe("enum()", () => {
		it("should create required enum constraint by default", () => {
			const values = ["red", "green", "blue"];
			const constraint = Constraints.enum(values);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.enum, values);
			assert.strictEqual(constraint.required, true);
		});

		it("should create required enum constraint when explicitly set to true", () => {
			const values = ["small", "medium", "large"];
			const constraint = Constraints.enum(values, true);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.enum, values);
			assert.strictEqual(constraint.required, true);
		});

		it("should create optional enum constraint when set to false", () => {
			const values = ["active", "inactive", "pending"];
			const constraint = Constraints.enum(values, false);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.enum, values);
			assert.strictEqual(constraint.required, false);
		});

		it("should work with number enums", () => {
			const values = [1, 2, 3, 4, 5];
			const constraint = Constraints.enum(values);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.enum, values);
			assert.strictEqual(constraint.required, true);
		});

		it("should work with mixed type enums", () => {
			const values = ["text", 123, true];
			const constraint = Constraints.enum(values, false);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.enum, values);
			assert.strictEqual(constraint.required, false);
		});

		it("should work with empty enum array", () => {
			const values = [];
			const constraint = Constraints.enum(values);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.enum, values);
			assert.strictEqual(constraint.required, true);
		});
	});

	describe("date()", () => {
		it("should create required date constraint by default", () => {
			const constraint = Constraints.date();

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.DATE);
			assert.strictEqual(constraint.required, true);
		});

		it("should create required date constraint when explicitly set to true", () => {
			const constraint = Constraints.date(true);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.DATE);
			assert.strictEqual(constraint.required, true);
		});

		it("should create optional date constraint when set to false", () => {
			const constraint = Constraints.date(false);

			assert(constraint instanceof FieldConstraint);
			assert.strictEqual(constraint.type, DataTypes.DATE);
			assert.strictEqual(constraint.required, false);
		});
	});

	describe("functional usage", () => {
		it("should create working constraints that can validate data", () => {
			const stringConstraint = Constraints.requiredString({ min: 3 });
			const numberConstraint = Constraints.optionalNumber({ max: 100 });
			const emailConstraint = Constraints.email();
			const enumConstraint = Constraints.enum(["A", "B", "C"]);

			// These should not throw errors
			assert.strictEqual(stringConstraint.validate("hello", "testField"), "hello");
			assert.strictEqual(numberConstraint.validate(50, "testField"), 50);
			assert.strictEqual(emailConstraint.validate("test@example.com", "testField"), "test@example.com");
			assert.strictEqual(enumConstraint.validate("A", "testField"), "A");
		});

		it("should preserve all other FieldConstraint properties", () => {
			const constraint = Constraints.requiredString();

			// Check that all expected FieldConstraint properties exist
			assert("type" in constraint);
			assert("required" in constraint);
			assert("default" in constraint);
			assert("validator" in constraint);
			assert("min" in constraint);
			assert("max" in constraint);
			assert("enum" in constraint);
			assert("pattern" in constraint);
			assert("validate" in constraint);
			assert(typeof constraint.validate === "function");
		});
	});
});
