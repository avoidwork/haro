import assert from "node:assert";
import { Schema } from "../../src/schema.js";
import { FieldConstraint } from "../../src/field-constraint.js";
import { ValidationError } from "../../src/errors.js";
import { DataTypes } from "../../src/data-types.js";

describe("Schema", () => {
	describe("constructor", () => {
		it("should create schema with default options", () => {
			const schema = new Schema();
			
			assert.deepStrictEqual(schema.fields, {});
			assert.strictEqual(schema.strict, false);
			assert.strictEqual(schema.stripUnknown, false);
		});

		it("should create schema with empty fields and default options", () => {
			const schema = new Schema({});
			
			assert.deepStrictEqual(schema.fields, {});
			assert.strictEqual(schema.strict, false);
			assert.strictEqual(schema.stripUnknown, false);
		});

		it("should create schema with provided fields", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER, min: 0 });
			const fields = {
				name: nameConstraint,
				age: ageConstraint
			};
			
			const schema = new Schema(fields);
			
			assert.strictEqual(schema.fields.name, nameConstraint);
			assert.strictEqual(schema.fields.age, ageConstraint);
			assert.strictEqual(schema.strict, false);
			assert.strictEqual(schema.stripUnknown, false);
		});

		it("should create schema with strict mode enabled", () => {
			const schema = new Schema({}, { strict: true });
			
			assert.deepStrictEqual(schema.fields, {});
			assert.strictEqual(schema.strict, true);
			assert.strictEqual(schema.stripUnknown, false);
		});

		it("should create schema with stripUnknown enabled", () => {
			const schema = new Schema({}, { stripUnknown: true });
			
			assert.deepStrictEqual(schema.fields, {});
			assert.strictEqual(schema.strict, false);
			assert.strictEqual(schema.stripUnknown, true);
		});

		it("should create schema with both strict and stripUnknown enabled", () => {
			const schema = new Schema({}, { strict: true, stripUnknown: true });
			
			assert.deepStrictEqual(schema.fields, {});
			assert.strictEqual(schema.strict, true);
			assert.strictEqual(schema.stripUnknown, true);
		});

		it("should create schema with fields and options", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const fields = { name: nameConstraint };
			const schema = new Schema(fields, { strict: true, stripUnknown: true });
			
			assert.strictEqual(schema.fields.name, nameConstraint);
			assert.strictEqual(schema.strict, true);
			assert.strictEqual(schema.stripUnknown, true);
		});

		it("should handle partial options object", () => {
			const schema = new Schema({}, { strict: true });
			
			assert.strictEqual(schema.strict, true);
			assert.strictEqual(schema.stripUnknown, false);
		});

		it("should handle partial options object with stripUnknown only", () => {
			const schema = new Schema({}, { stripUnknown: true });
			
			assert.strictEqual(schema.strict, false);
			assert.strictEqual(schema.stripUnknown, true);
		});
	});

	describe("validate() - input validation", () => {
		it("should throw ValidationError for null record", () => {
			const schema = new Schema();
			
			assert.throws(
				() => schema.validate(null),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Record must be an object");
					assert.strictEqual(err.context.field, "record");
					assert.strictEqual(err.context.value, null);
					return true;
				}
			);
		});

		it("should throw ValidationError for undefined record", () => {
			const schema = new Schema();
			
			assert.throws(
				() => schema.validate(undefined),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Record must be an object");
					assert.strictEqual(err.context.field, "record");
					assert.strictEqual(err.context.value, undefined);
					return true;
				}
			);
		});

		it("should throw ValidationError for non-object record (string)", () => {
			const schema = new Schema();
			
			assert.throws(
				() => schema.validate("not an object"),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Record must be an object");
					assert.strictEqual(err.context.field, "record");
					assert.strictEqual(err.context.value, "not an object");
					return true;
				}
			);
		});

		it("should throw ValidationError for non-object record (number)", () => {
			const schema = new Schema();
			
			assert.throws(
				() => schema.validate(123),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Record must be an object");
					assert.strictEqual(err.context.field, "record");
					assert.strictEqual(err.context.value, 123);
					return true;
				}
			);
		});

		it("should throw ValidationError for non-object record (boolean)", () => {
			const schema = new Schema();
			
			assert.throws(
				() => schema.validate(true),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Record must be an object");
					assert.strictEqual(err.context.field, "record");
					assert.strictEqual(err.context.value, true);
					return true;
				}
			);
		});

		it("should throw ValidationError for array (not an object)", () => {
			const schema = new Schema();
			
			assert.throws(
				() => schema.validate([1, 2, 3]),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Record must be an object");
					assert.strictEqual(err.context.field, "record");
					assert.deepStrictEqual(err.context.value, [1, 2, 3]);
					return true;
				}
			);
		});
	});

	describe("validate() - field validation", () => {
		it("should validate empty record with no field constraints", () => {
			const schema = new Schema();
			const result = schema.validate({});
			
			assert.deepStrictEqual(result, {});
		});

		it("should validate record with all required fields", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER, min: 0 });
			const schema = new Schema({
				name: nameConstraint,
				age: ageConstraint
			});
			
			const record = { name: "John", age: 25 };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { name: "John", age: 25 });
		});

		it("should apply field constraint validation", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const schema = new Schema({ name: nameConstraint });
			
			// Should throw error for missing required field
			assert.throws(
				() => schema.validate({}),
				ValidationError
			);
		});

		it("should apply default values from field constraints", () => {
			const statusConstraint = new FieldConstraint({ default: "active" });
			const schema = new Schema({ status: statusConstraint });
			
			const result = schema.validate({});
			
			assert.deepStrictEqual(result, { status: "active" });
		});

		it("should validate multiple fields with different constraints", () => {
			const emailConstraint = new FieldConstraint({ 
				type: DataTypes.STRING, 
				required: true,
				pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
			});
			const ageConstraint = new FieldConstraint({ 
				type: DataTypes.NUMBER,
				min: 18,
				max: 120
			});
			const roleConstraint = new FieldConstraint({
				enum: ["admin", "user", "guest"],
				default: "user"
			});
			
			const schema = new Schema({
				email: emailConstraint,
				age: ageConstraint,
				role: roleConstraint
			});
			
			const record = { email: "test@example.com", age: 25 };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, {
				email: "test@example.com",
				age: 25,
				role: "user"
			});
		});
	});

	describe("validate() - unknown field handling (non-strict, non-stripUnknown)", () => {
		it("should preserve unknown fields when not strict and not stripUnknown", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const schema = new Schema({ name: nameConstraint });
			
			const record = { name: "John", age: 25, city: "New York" };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, {
				name: "John",
				age: 25,
				city: "New York"
			});
		});

		it("should preserve unknown fields as-is without validation", () => {
			const schema = new Schema({});
			
			const record = { 
				randomField: "test",
				anotherField: 123,
				yetAnother: { nested: "object" },
				arrayField: [1, 2, 3]
			};
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, record);
		});

		it("should preserve known and unknown fields together", () => {
			const nameConstraint = new FieldConstraint({ required: true });
			const schema = new Schema({ name: nameConstraint });
			
			const record = {
				name: "John",
				unknownField1: "value1",
				unknownField2: 42,
				unknownField3: true
			};
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, record);
		});
	});

	describe("validate() - unknown field handling (strict mode)", () => {
		it("should throw ValidationError for unknown fields in strict mode", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const schema = new Schema({ name: nameConstraint }, { strict: true });
			
			const record = { name: "John", age: 25 };
			
			assert.throws(
				() => schema.validate(record),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Unknown fields not allowed: age");
					assert.strictEqual(err.context.field, "record");
					assert.deepStrictEqual(err.context.value, record);
					return true;
				}
			);
		});

		it("should throw ValidationError for multiple unknown fields in strict mode", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const schema = new Schema({ name: nameConstraint }, { strict: true });
			
			const record = { name: "John", age: 25, city: "New York", country: "USA" };
			
			assert.throws(
				() => schema.validate(record),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Unknown fields not allowed: age, city, country");
					assert.strictEqual(err.context.field, "record");
					assert.deepStrictEqual(err.context.value, record);
					return true;
				}
			);
		});

		it("should validate successfully when no unknown fields in strict mode", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER });
			const schema = new Schema({
				name: nameConstraint,
				age: ageConstraint
			}, { strict: true });
			
			const record = { name: "John", age: 25 };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { name: "John", age: 25 });
		});

		it("should validate successfully with only known fields subset in strict mode", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER });
			const schema = new Schema({
				name: nameConstraint,
				age: ageConstraint
			}, { strict: true });
			
			const record = { name: "John" };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { name: "John", age: undefined });
		});
	});

	describe("validate() - unknown field handling (stripUnknown mode)", () => {
		it("should remove unknown fields when stripUnknown is true", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const schema = new Schema({ name: nameConstraint }, { stripUnknown: true });
			
			const record = { name: "John", age: 25, city: "New York" };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { name: "John" });
		});

		it("should remove all unknown fields and keep only known fields", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER });
			const schema = new Schema({
				name: nameConstraint,
				age: ageConstraint
			}, { stripUnknown: true });
			
			const record = {
				name: "John",
				age: 25,
				city: "New York",
				country: "USA",
				randomField: "value"
			};
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { name: "John", age: 25 });
		});

		it("should handle stripUnknown with default values", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const statusConstraint = new FieldConstraint({ default: "active" });
			const schema = new Schema({
				name: nameConstraint,
				status: statusConstraint
			}, { stripUnknown: true });
			
			const record = { name: "John", unknownField: "should be removed" };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { name: "John", status: "active" });
		});

		it("should return only defaults when all fields are unknown and stripUnknown", () => {
			const statusConstraint = new FieldConstraint({ default: "active" });
			const countConstraint = new FieldConstraint({ default: 0 });
			const schema = new Schema({
				status: statusConstraint,
				count: countConstraint
			}, { stripUnknown: true });
			
			const record = { unknownField1: "value1", unknownField2: "value2" };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { status: "active", count: 0 });
		});
	});

	describe("validate() - unknown field handling (strict + stripUnknown)", () => {
		it("should throw error in strict mode even with stripUnknown enabled", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const schema = new Schema({ name: nameConstraint }, { strict: true, stripUnknown: true });
			
			const record = { name: "John", age: 25 };
			
			assert.throws(
				() => schema.validate(record),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Unknown fields not allowed: age");
					return true;
				}
			);
		});

		it("should validate successfully when no unknown fields with strict + stripUnknown", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const schema = new Schema({ name: nameConstraint }, { strict: true, stripUnknown: true });
			
			const record = { name: "John" };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { name: "John" });
		});
	});

	describe("addField()", () => {
		it("should add a field constraint to empty schema", () => {
			const schema = new Schema();
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			
			const result = schema.addField("name", nameConstraint);
			
			assert.strictEqual(result, schema); // Should return this for chaining
			assert.strictEqual(schema.fields.name, nameConstraint);
		});

		it("should add a field constraint to existing schema", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const schema = new Schema({ name: nameConstraint });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER, min: 0 });
			
			const result = schema.addField("age", ageConstraint);
			
			assert.strictEqual(result, schema);
			assert.strictEqual(schema.fields.name, nameConstraint);
			assert.strictEqual(schema.fields.age, ageConstraint);
		});

		it("should overwrite existing field constraint", () => {
			const oldConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const schema = new Schema({ name: oldConstraint });
			const newConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			
			const result = schema.addField("name", newConstraint);
			
			assert.strictEqual(result, schema);
			assert.strictEqual(schema.fields.name, newConstraint);
			assert.notStrictEqual(schema.fields.name, oldConstraint);
		});

		it("should allow method chaining", () => {
			const schema = new Schema();
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER });
			const emailConstraint = new FieldConstraint({ type: DataTypes.STRING });
			
			const result = schema
				.addField("name", nameConstraint)
				.addField("age", ageConstraint)
				.addField("email", emailConstraint);
			
			assert.strictEqual(result, schema);
			assert.strictEqual(schema.fields.name, nameConstraint);
			assert.strictEqual(schema.fields.age, ageConstraint);
			assert.strictEqual(schema.fields.email, emailConstraint);
		});

		it("should work with validation after adding fields", () => {
			const schema = new Schema();
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER, min: 0 });
			
			schema
				.addField("name", nameConstraint)
				.addField("age", ageConstraint);
			
			const record = { name: "John", age: 25 };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { name: "John", age: 25 });
		});
	});

	describe("removeField()", () => {
		it("should remove a field constraint", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER });
			const schema = new Schema({ name: nameConstraint, age: ageConstraint });
			
			const result = schema.removeField("age");
			
			assert.strictEqual(result, schema); // Should return this for chaining
			assert.strictEqual(schema.fields.name, nameConstraint);
			assert.strictEqual(schema.fields.age, undefined);
			assert.strictEqual(Object.hasOwnProperty.call(schema.fields, "age"), false);
		});

		it("should handle removing non-existent field gracefully", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const schema = new Schema({ name: nameConstraint });
			
			const result = schema.removeField("nonExistent");
			
			assert.strictEqual(result, schema);
			assert.strictEqual(schema.fields.name, nameConstraint);
			assert.strictEqual(schema.fields.nonExistent, undefined);
		});

		it("should allow method chaining", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER });
			const emailConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const schema = new Schema({
				name: nameConstraint,
				age: ageConstraint,
				email: emailConstraint
			});
			
			const result = schema
				.removeField("age")
				.removeField("email");
			
			assert.strictEqual(result, schema);
			assert.strictEqual(schema.fields.name, nameConstraint);
			assert.strictEqual(schema.fields.age, undefined);
			assert.strictEqual(schema.fields.email, undefined);
		});

		it("should work with validation after removing fields", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER, required: true });
			const schema = new Schema({ name: nameConstraint, age: ageConstraint });
			
			schema.removeField("age");
			
			// Should now pass validation without age field
			const record = { name: "John" };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { name: "John" });
		});

		it("should handle removing all fields", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER });
			const schema = new Schema({ name: nameConstraint, age: ageConstraint });
			
			schema
				.removeField("name")
				.removeField("age");
			
			assert.deepStrictEqual(schema.fields, {});
			
			// Should work with empty schema
			const result = schema.validate({ anyField: "anyValue" });
			assert.deepStrictEqual(result, { anyField: "anyValue" });
		});
	});

	describe("validate() - edge cases and complex scenarios", () => {
		it("should handle empty object validation", () => {
			const schema = new Schema();
			const result = schema.validate({});
			
			assert.deepStrictEqual(result, {});
		});

		it("should handle complex nested validation", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const configConstraint = new FieldConstraint({ type: DataTypes.OBJECT });
			const tagsConstraint = new FieldConstraint({ type: DataTypes.ARRAY });
			
			const schema = new Schema({
				name: nameConstraint,
				config: configConstraint,
				tags: tagsConstraint
			});
			
			const record = {
				name: "Test",
				config: { setting1: true, setting2: "value" },
				tags: ["tag1", "tag2"],
				extraField: "should be preserved"
			};
			
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, record);
		});

		it("should handle validation with only undefined/null values", () => {
			const optionalConstraint = new FieldConstraint({ default: "default" });
			const schema = new Schema({ optional: optionalConstraint });
			
			const record = { optional: null, extra: undefined };
			const result = schema.validate(record);
			
			assert.deepStrictEqual(result, { optional: "default", extra: undefined });
		});

		it("should preserve order of fields in result", () => {
			const field1Constraint = new FieldConstraint({ default: "value1" });
			const field2Constraint = new FieldConstraint({ default: "value2" });
			const field3Constraint = new FieldConstraint({ default: "value3" });
			
			const schema = new Schema({
				field3: field3Constraint,
				field1: field1Constraint,
				field2: field2Constraint
			});
			
			const record = { field2: "custom", unknown: "extra" };
			const result = schema.validate(record);
			
			// Known fields should be in schema definition order
			const keys = Object.keys(result);
			assert.strictEqual(keys[0], "field3");
			assert.strictEqual(keys[1], "field1");
			assert.strictEqual(keys[2], "field2");
			assert.strictEqual(keys[3], "unknown");
		});

		it("should handle schema with no field constraints but strict mode", () => {
			const schema = new Schema({}, { strict: true });
			
			assert.throws(
				() => schema.validate({ anyField: "value" }),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Unknown fields not allowed: anyField");
					return true;
				}
			);
		});

		it("should validate empty object in strict mode with no fields", () => {
			const schema = new Schema({}, { strict: true });
			const result = schema.validate({});
			
			assert.deepStrictEqual(result, {});
		});
	});

	describe("integration with FieldConstraint validation errors", () => {
		it("should propagate FieldConstraint validation errors", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const schema = new Schema({ name: nameConstraint });
			
			assert.throws(
				() => schema.validate({ name: undefined }),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'name' is required");
					assert.strictEqual(err.context.field, "name");
					return true;
				}
			);
		});

		it("should propagate multiple field validation errors appropriately", () => {
			const nameConstraint = new FieldConstraint({ type: DataTypes.STRING, required: true });
			const ageConstraint = new FieldConstraint({ type: DataTypes.NUMBER, min: 0 });
			const schema = new Schema({ name: nameConstraint, age: ageConstraint });
			
			// First error (name required) should be thrown
			assert.throws(
				() => schema.validate({ age: -5 }),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Field 'name' is required");
					return true;
				}
			);
		});

		it("should handle field constraint with custom validator", () => {
			const customValidator = (value) => value.length > 3 ? true : "Name must be longer than 3 characters";
			const nameConstraint = new FieldConstraint({ 
				type: DataTypes.STRING,
				validator: customValidator
			});
			const schema = new Schema({ name: nameConstraint });
			
			assert.throws(
				() => schema.validate({ name: "Jo" }),
				(err) => {
					assert(err instanceof ValidationError);
					assert.strictEqual(err.message, "Name must be longer than 3 characters");
					return true;
				}
			);
		});
	});
});
