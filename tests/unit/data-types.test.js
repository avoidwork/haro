import assert from "node:assert";
import { describe, it } from "mocha";
import { DataTypes, TypeDetector } from "../../src/data-types.js";

/**
 * Tests for data type definitions and type detection utilities
 */
describe("DataTypes", () => {
	/**
	 * Test that all expected constants are defined
	 */
	it("should have all expected data type constants", () => {
		assert.strictEqual(DataTypes.STRING, "string");
		assert.strictEqual(DataTypes.NUMBER, "number");
		assert.strictEqual(DataTypes.BOOLEAN, "boolean");
		assert.strictEqual(DataTypes.OBJECT, "object");
		assert.strictEqual(DataTypes.ARRAY, "array");
		assert.strictEqual(DataTypes.DATE, "date");
		assert.strictEqual(DataTypes.UUID, "uuid");
		assert.strictEqual(DataTypes.EMAIL, "email");
		assert.strictEqual(DataTypes.URL, "url");
		assert.strictEqual(DataTypes.ANY, "any");
	});

	/**
	 * Test that DataTypes is an object with expected structure
	 */
	it("should be a properly structured constants object", () => {
		assert.strictEqual(typeof DataTypes, "object");
		assert.ok(DataTypes !== null);
		
		// Verify it has expected number of properties
		const expectedProperties = ["STRING", "NUMBER", "BOOLEAN", "OBJECT", "ARRAY", "DATE", "UUID", "EMAIL", "URL", "ANY"];
		const actualProperties = Object.keys(DataTypes);
		
		assert.strictEqual(actualProperties.length, expectedProperties.length);
		expectedProperties.forEach(prop => {
			assert.ok(actualProperties.includes(prop), `Missing property: ${prop}`);
		});
	});
});

describe("TypeDetector", () => {
	describe("getValueType", () => {
		/**
		 * Test null value detection
		 */
		it("should detect null values", () => {
			assert.strictEqual(TypeDetector.getValueType(null), "null");
		});

		/**
		 * Test array detection
		 */
		it("should detect arrays", () => {
			assert.strictEqual(TypeDetector.getValueType([]), DataTypes.ARRAY);
			assert.strictEqual(TypeDetector.getValueType([1, 2, 3]), DataTypes.ARRAY);
			assert.strictEqual(TypeDetector.getValueType(["a", "b"]), DataTypes.ARRAY);
			assert.strictEqual(TypeDetector.getValueType([{}]), DataTypes.ARRAY);
		});

		/**
		 * Test Date object detection
		 */
		it("should detect Date objects", () => {
			assert.strictEqual(TypeDetector.getValueType(new Date()), DataTypes.DATE);
			assert.strictEqual(TypeDetector.getValueType(new Date("2023-01-01")), DataTypes.DATE);
			assert.strictEqual(TypeDetector.getValueType(new Date(0)), DataTypes.DATE);
		});

		/**
		 * Test basic type detection
		 */
		it("should detect basic types", () => {
			// Numbers
			assert.strictEqual(TypeDetector.getValueType(42), "number");
			assert.strictEqual(TypeDetector.getValueType(3.14), "number");
			assert.strictEqual(TypeDetector.getValueType(0), "number");
			assert.strictEqual(TypeDetector.getValueType(-1), "number");
			assert.strictEqual(TypeDetector.getValueType(NaN), "number");
			assert.strictEqual(TypeDetector.getValueType(Infinity), "number");

			// Booleans
			assert.strictEqual(TypeDetector.getValueType(true), "boolean");
			assert.strictEqual(TypeDetector.getValueType(false), "boolean");

			// Objects
			assert.strictEqual(TypeDetector.getValueType({}), "object");
			assert.strictEqual(TypeDetector.getValueType({ key: "value" }), "object");

			// Functions
			assert.strictEqual(TypeDetector.getValueType(() => {}), "function");
			assert.strictEqual(TypeDetector.getValueType(function() {}), "function");

			// Undefined
			assert.strictEqual(TypeDetector.getValueType(undefined), "undefined");

			// Symbols
			assert.strictEqual(TypeDetector.getValueType(Symbol("test")), "symbol");

			// BigInt
			assert.strictEqual(TypeDetector.getValueType(BigInt(123)), "bigint");
		});

		/**
		 * Test UUID string detection
		 */
		it("should detect UUID strings", () => {
			const validUUIDs = [
				"550e8400-e29b-41d4-a716-446655440000",
				"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
				"6ba7b811-9dad-21d1-80b4-00c04fd430c8",
				"01234567-89ab-41ef-8123-456789abcdef",
				"FFFFFFFF-FFFF-4FFF-8FFF-FFFFFFFFFFFF"
			];

			validUUIDs.forEach(uuid => {
				assert.strictEqual(TypeDetector.getValueType(uuid), DataTypes.UUID, 
					`Should detect ${uuid} as UUID`);
			});
		});

		/**
		 * Test email string detection
		 */
		it("should detect email strings", () => {
			const validEmails = [
				"test@example.com",
				"user.name@domain.co.uk",
				"test+tag@gmail.com",
				"user123@test-domain.org",
				"a@b.co"
			];

			validEmails.forEach(email => {
				assert.strictEqual(TypeDetector.getValueType(email), DataTypes.EMAIL,
					`Should detect ${email} as email`);
			});
		});

		/**
		 * Test URL string detection
		 */
		it("should detect URL strings", () => {
			const validURLs = [
				"https://www.example.com",
				"http://localhost:3000",
				"ftp://files.example.com",
				"https://api.example.com/v1/users",
				"http://192.168.1.1:8080/path"
			];

			validURLs.forEach(url => {
				assert.strictEqual(TypeDetector.getValueType(url), DataTypes.URL,
					`Should detect ${url} as URL`);
			});
		});

		/**
		 * Test regular string detection (non-special strings)
		 */
		it("should detect regular strings that don't match special patterns", () => {
			const regularStrings = [
				"hello world",
				"123",
				"not-an-email",
				"almost-uuid-but-not",
				"definitely.not.url",
				"",
				"   ",
				"special@characters!",
				"550e8400-e29b-41d4-a716" // incomplete UUID
			];

			regularStrings.forEach(str => {
				assert.strictEqual(TypeDetector.getValueType(str), "string",
					`Should detect "${str}" as regular string`);
			});
		});
	});

	describe("isTypeMatch", () => {
		/**
		 * Test exact type matches
		 */
		it("should match exact types", () => {
			assert.strictEqual(TypeDetector.isTypeMatch("string", "string"), true);
			assert.strictEqual(TypeDetector.isTypeMatch("number", "number"), true);
			assert.strictEqual(TypeDetector.isTypeMatch("boolean", "boolean"), true);
			assert.strictEqual(TypeDetector.isTypeMatch("object", "object"), true);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.ARRAY, DataTypes.ARRAY), true);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.DATE, DataTypes.DATE), true);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.UUID, DataTypes.UUID), true);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.EMAIL, DataTypes.EMAIL), true);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.URL, DataTypes.URL), true);
		});

		/**
		 * Test string type special cases
		 */
		it("should match special string types with STRING", () => {
			// When expected type is STRING, these special types should match
			assert.strictEqual(TypeDetector.isTypeMatch("string", DataTypes.STRING), true);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.UUID, DataTypes.STRING), true);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.EMAIL, DataTypes.STRING), true);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.URL, DataTypes.STRING), true);
		});

		/**
		 * Test non-matching types
		 */
		it("should not match different types", () => {
			assert.strictEqual(TypeDetector.isTypeMatch("number", "string"), false);
			assert.strictEqual(TypeDetector.isTypeMatch("boolean", "number"), false);
			assert.strictEqual(TypeDetector.isTypeMatch("object", "array"), false);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.DATE, DataTypes.STRING), false);
			assert.strictEqual(TypeDetector.isTypeMatch("null", "string"), false);
			assert.strictEqual(TypeDetector.isTypeMatch("undefined", "object"), false);
		});

		/**
		 * Test special string types don't match with other expected types
		 */
		it("should not match special string types with non-string expected types", () => {
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.UUID, "number"), false);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.EMAIL, "boolean"), false);
			assert.strictEqual(TypeDetector.isTypeMatch(DataTypes.URL, "object"), false);
			assert.strictEqual(TypeDetector.isTypeMatch("string", "number"), false);
		});
	});

	describe("isUUID", () => {
		/**
		 * Test valid UUID formats
		 */
		it("should validate correct UUID formats", () => {
			const validUUIDs = [
				"550e8400-e29b-41d4-a716-446655440000", // Version 4
				"6ba7b810-9dad-11d1-80b4-00c04fd430c8", // Version 1
				"6ba7b811-9dad-21d1-80b4-00c04fd430c8", // Version 2
				"6ba7b812-9dad-31d1-80b4-00c04fd430c8", // Version 3
				"6ba7b813-9dad-41d1-80b4-00c04fd430c8", // Version 4
				"6ba7b814-9dad-51d1-80b4-00c04fd430c8", // Version 5
				"01234567-89ab-41ef-8123-456789abcdef", // Lowercase with valid version
				"FFFFFFFF-FFFF-4FFF-8FFF-FFFFFFFFFFFF", // Uppercase with valid version
				"00000000-0000-1000-8000-000000000000"  // All zeros with valid version
			];

			validUUIDs.forEach(uuid => {
				assert.strictEqual(TypeDetector.isUUID(uuid), true,
					`Should validate ${uuid} as valid UUID`);
			});
		});

		/**
		 * Test invalid UUID formats
		 */
		it("should reject invalid UUID formats", () => {
			const invalidUUIDs = [
				"550e8400-e29b-41d4-a716",              // Too short
				"550e8400-e29b-41d4-a716-446655440000-extra", // Too long
				"550e8400-e29b-41d4-a716-44665544000g", // Invalid character
				"550e8400-e29b-41d4-a716_446655440000", // Wrong separator
				"550e8400e29b41d4a716446655440000",     // No separators
				"550e8400-e29b-41d4-a716-44665544000",  // Missing character
				"550e8400-e29b-61d4-a716-446655440000", // Invalid version (6)
				"550e8400-e29b-01d4-a716-446655440000", // Invalid version (0)
				"550e8400-e29b-41d4-0716-446655440000", // Invalid variant
				"",                                      // Empty string
				"not-a-uuid",                           // Random string
				"550e8400-e29b-41d4-a716-44665544000Z", // Invalid character at end
				"g50e8400-e29b-41d4-a716-446655440000"  // Invalid character at start
			];

			invalidUUIDs.forEach(uuid => {
				assert.strictEqual(TypeDetector.isUUID(uuid), false,
					`Should reject ${uuid} as invalid UUID`);
			});
		});
	});

	describe("isEmail", () => {
		/**
		 * Test valid email formats
		 */
		it("should validate correct email formats", () => {
			const validEmails = [
				"test@example.com",
				"user.name@domain.co.uk",
				"test+tag@gmail.com",
				"user123@test-domain.org",
				"a@b.co",
				"firstname.lastname@domain.com",
				"email@subdomain.example.com",
				"firstname.o'lastname@example.com",
				"email@domain-one.example.com",
				"user_name@domain.com",
				"user-name@domain.com",
				"test.email.with+symbol@example.com"
			];

			validEmails.forEach(email => {
				assert.strictEqual(TypeDetector.isEmail(email), true,
					`Should validate ${email} as valid email`);
			});
		});

		/**
		 * Test invalid email formats
		 */
		it("should reject invalid email formats", () => {
			const invalidEmails = [
				"plainaddress",                    // No @ symbol
				"@missingdomain.com",             // Missing local part
				"missing-domain@.com",            // Missing domain
				"spaces @domain.com",             // Spaces in local part
				"domain@spaces .com",             // Spaces in domain
				"domain@double..dot.com",         // Double dots in domain
				"domain@" + "a".repeat(100) + ".com",        // Too long domain
				"",                               // Empty string
				"incomplete@",                    // Incomplete
				"@incomplete",                    // Incomplete
				"no-at-sign.com",                // No @ sign
				"multiple@at@signs.com",         // Multiple @ signs
				"domain@trailing.dot.",          // Trailing dot in domain
				"email@-domain.com",             // Domain starting with hyphen
				"email@domain-.com"              // Domain ending with hyphen
			];

			invalidEmails.forEach(email => {
				assert.strictEqual(TypeDetector.isEmail(email), false,
					`Should reject ${email} as invalid email`);
			});
		});
	});

	describe("isURL", () => {
		/**
		 * Test valid URL formats
		 */
		it("should validate correct URL formats", () => {
			const validURLs = [
				"https://www.example.com",
				"http://localhost:3000",
				"ftp://files.example.com",
				"https://api.example.com/v1/users",
				"http://192.168.1.1:8080/path",
				"https://subdomain.example.org/path/to/resource?param=value#section",
				"http://example.com",
				"https://example.com/",
				"https://example.com:443/secure",
				"http://user:pass@example.com/path",
				"file://localhost/path/to/file",
				"mailto:user@example.com",
				"ws://websocket.example.com",
				"wss://secure.websocket.example.com"
			];

			validURLs.forEach(url => {
				assert.strictEqual(TypeDetector.isURL(url), true,
					`Should validate ${url} as valid URL`);
			});
		});

		/**
		 * Test invalid URL formats
		 */
		it("should reject invalid URL formats", () => {
			const invalidURLs = [
				"not-a-url",                     // Plain text
				"http://",                       // Incomplete URL
				"://missing-protocol.com",       // Missing protocol
				"",                              // Empty string
				"just-text",                     // No protocol
				"www.example.com",               // Missing protocol
				"http://spaces in url.com",      // Spaces in URL
				"http://[invalid-brackets.com",  // Invalid brackets
				"http://exam ple.com",           // Space in domain
				"http://",                       // Just protocol
				"ftp://"                         // Just protocol with different scheme
			];

			invalidURLs.forEach(url => {
				assert.strictEqual(TypeDetector.isURL(url), false,
					`Should reject ${url} as invalid URL`);
			});
		});

		/**
		 * Test error handling in URL validation
		 */
		it("should handle URL constructor errors gracefully", () => {
			// Test with values that would cause URL constructor to throw
			const problematicValues = [
				"",                             // Empty string
				"   ",                          // Only whitespace
				"\n\t\r",                       // Only control characters
				"not-a-url-at-all",            // Plain invalid text
				"://incomplete"                 // Malformed protocol
			];

			problematicValues.forEach(value => {
				// Should not throw an error, should return false
				assert.doesNotThrow(() => {
					const result = TypeDetector.isURL(value);
					assert.strictEqual(result, false, `Should return false for problematic value: ${JSON.stringify(value)}`);
				}, `Should not throw for problematic value: ${JSON.stringify(value)}`);
			});
		});
	});
});
