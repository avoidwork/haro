import assert from "node:assert";
import { describe, it, beforeEach } from "mocha";
import { CRUDManager } from "../../src/crud-manager.js";
import { ValidationError, RecordNotFoundError, HaroError } from "../../src/errors.js";
import { Record, RecordFactory } from "../../src/record.js";

/**
 * Mock StorageManager for testing
 */
class MockStorageManager {
	constructor() {
		this.data = new Map();
	}

	get(key) {
		return this.data.get(key);
	}

	set(key, value) {
		this.data.set(key, value);
		return this;
	}

	has(key) {
		return this.data.has(key);
	}

	delete(key) {
		return this.data.delete(key);
	}

	clear() {
		this.data.clear();
	}

	size() {
		return this.data.size;
	}
}

/**
 * Mock IndexManager for testing
 */
class MockIndexManager {
	constructor() {
		this.indexes = new Map();
		this.addRecordCalls = [];
		this.removeRecordCalls = [];
	}

	addRecord(key, data) {
		this.addRecordCalls.push({ key, data });
	}

	removeRecord(key, data) {
		this.removeRecordCalls.push({ key, data });
	}

	clear() {
		this.addRecordCalls = [];
		this.removeRecordCalls = [];
	}
}

/**
 * Mock VersionManager for testing
 */
class MockVersionManager {
	constructor() {
		this.versions = new Map();
		this.addVersionCalls = [];
		this.disableVersioningCalls = [];
	}

	addVersion(key, data) {
		this.addVersionCalls.push({ key, data });
		if (!this.versions.has(key)) {
			this.versions.set(key, { versions: [] });
		}
		this.versions.get(key).versions.push(data);
	}

	getHistory(key) {
		return this.versions.get(key);
	}

	disableVersioning(key) {
		this.disableVersioningCalls.push({ key });
		this.versions.delete(key);
	}

	clear() {
		this.addVersionCalls = [];
		this.disableVersioningCalls = [];
		this.versions.clear();
	}
}

/**
 * Mock Schema for testing
 */
class MockSchema {
	constructor(shouldValidate = true) {
		this.shouldValidate = shouldValidate;
		this.validateCalls = [];
	}

	validate(data) {
		this.validateCalls.push(data);
		if (!this.shouldValidate) {
			throw new ValidationError("Schema validation failed", "test", data);
		}
	}

	clear() {
		this.validateCalls = [];
	}
}

/**
 * Tests for CRUDManager class
 */
describe("CRUDManager", () => {
	let crudManager;
	let mockStorageManager;
	let mockIndexManager;
	let mockVersionManager;
	let mockSchema;
	let config;

	beforeEach(() => {
		mockStorageManager = new MockStorageManager();
		mockIndexManager = new MockIndexManager();
		mockVersionManager = new MockVersionManager();
		mockSchema = new MockSchema();
		
		config = {
			key: "id",
			id: "test-store",
			schema: mockSchema
		};

		crudManager = new CRUDManager({
			storageManager: mockStorageManager,
			indexManager: mockIndexManager,
			versionManager: mockVersionManager,
			config
		});
	});

	describe("Constructor", () => {
		/**
		 * Test basic constructor functionality
		 */
		it("should create a CRUDManager with all dependencies", () => {
			assert.strictEqual(crudManager.storageManager, mockStorageManager);
			assert.strictEqual(crudManager.indexManager, mockIndexManager);
			assert.strictEqual(crudManager.versionManager, mockVersionManager);
			assert.strictEqual(crudManager.config, config);
		});

		/**
		 * Test constructor without version manager
		 */
		it("should create a CRUDManager without version manager", () => {
			const crudManagerNoVersion = new CRUDManager({
				storageManager: mockStorageManager,
				indexManager: mockIndexManager,
				config
			});

			assert.strictEqual(crudManagerNoVersion.versionManager, null);
		});

		/**
		 * Test constructor with explicit null version manager
		 */
		it("should handle explicit null version manager", () => {
			const crudManagerExplicitNull = new CRUDManager({
				storageManager: mockStorageManager,
				indexManager: mockIndexManager,
				versionManager: null,
				config
			});

			assert.strictEqual(crudManagerExplicitNull.versionManager, null);
		});
	});

	describe("set method", () => {
		/**
		 * Test setting a new record with provided key
		 */
		it("should set a new record with provided key", () => {
			const key = "user1";
			const data = { name: "John", email: "john@example.com" };
			
			const result = crudManager.set(key, data);

			// Verify record was created correctly
			assert.ok(result instanceof Record);
			assert.strictEqual(result.key, key);
			assert.strictEqual(result.get("name"), "John");
			assert.strictEqual(result.get("email"), "john@example.com");
			assert.strictEqual(result.get("id"), key);

			// Verify storage was updated with new format
			const storedRecord = mockStorageManager.get(key);
			assert.deepStrictEqual(storedRecord, { 
				data: { ...data, id: key }, 
				metadata: {} 
			});

			// Verify index was updated
			assert.strictEqual(mockIndexManager.addRecordCalls.length, 1);
			assert.strictEqual(mockIndexManager.addRecordCalls[0].key, key);

			// Verify schema validation was called
			assert.strictEqual(mockSchema.validateCalls.length, 1);
		});

		/**
		 * Test setting a record with auto-generated key (null key)
		 */
		it("should auto-generate key when key is null", () => {
			const data = { name: "Jane", email: "jane@example.com" };
			
			const result = crudManager.set(null, data);

			// Verify record was created with generated key
			assert.ok(result instanceof Record);
			assert.ok(result.key);
			assert.strictEqual(result.get("name"), "Jane");
			assert.strictEqual(result.get("id"), result.key);

			// Verify storage was updated
			assert.ok(mockStorageManager.has(result.key));
		});

		/**
		 * Test setting a record with key from data
		 */
		it("should use key from data when key is null and data contains key field", () => {
			const data = { id: "existing-id", name: "Bob", email: "bob@example.com" };
			
			const result = crudManager.set(null, data);

			assert.strictEqual(result.key, "existing-id");
			assert.strictEqual(result.get("id"), "existing-id");
		});

		/**
		 * Test updating existing record without override
		 */
		it("should merge with existing record when override is false", () => {
			const key = "user1";
			const initialData = { name: "John", age: 30, email: "john@example.com" };
			const updateData = { name: "John Updated", location: "NYC" };
			
			// Set initial record
			crudManager.set(key, initialData);
			mockVersionManager.clear();
			mockIndexManager.clear();
			
			// Update record
			const result = crudManager.set(key, updateData, { override: false });

			// Verify merged data
			assert.strictEqual(result.get("name"), "John Updated");
			assert.strictEqual(result.get("age"), 30); // Preserved from original
			assert.strictEqual(result.get("email"), "john@example.com"); // Preserved
			assert.strictEqual(result.get("location"), "NYC"); // New field

			// Verify versioning was called
			assert.strictEqual(mockVersionManager.addVersionCalls.length, 1);

			// Verify old record was removed from index and new one added
			assert.strictEqual(mockIndexManager.removeRecordCalls.length, 1);
			assert.strictEqual(mockIndexManager.addRecordCalls.length, 1);
		});

		/**
		 * Test updating existing record with override
		 */
		it("should replace existing record when override is true", () => {
			const key = "user1";
			const initialData = { name: "John", age: 30, email: "john@example.com" };
			const updateData = { name: "John Updated", location: "NYC" };
			
			// Set initial record
			crudManager.set(key, initialData);
			mockVersionManager.clear();
			mockIndexManager.clear();
			
			// Update record with override
			const result = crudManager.set(key, updateData, { override: true });

			// Verify replaced data
			assert.strictEqual(result.get("name"), "John Updated");
			assert.strictEqual(result.get("age"), undefined); // Not preserved
			assert.strictEqual(result.get("email"), undefined); // Not preserved
			assert.strictEqual(result.get("location"), "NYC");

			// Verify versioning was called
			assert.strictEqual(mockVersionManager.addVersionCalls.length, 1);
		});

		/**
		 * Test setting record without validation
		 */
		it("should skip validation when validate option is false", () => {
			const key = "user1";
			const data = { name: "John" };
			
			const result = crudManager.set(key, data, { validate: false });

			assert.ok(result instanceof Record);
			assert.strictEqual(mockSchema.validateCalls.length, 0);
		});

		/**
		 * Test setting record without schema
		 */
		it("should work without schema configured", () => {
			const configNoSchema = { ...config, schema: null };
			const crudManagerNoSchema = new CRUDManager({
				storageManager: mockStorageManager,
				indexManager: mockIndexManager,
				versionManager: mockVersionManager,
				config: configNoSchema
			});

			const key = "user1";
			const data = { name: "John" };
			
			const result = crudManagerNoSchema.set(key, data);

			assert.ok(result instanceof Record);
			assert.strictEqual(result.key, key);
		});

		/**
		 * Test setting record without version manager
		 */
		it("should work without version manager", () => {
			const crudManagerNoVersion = new CRUDManager({
				storageManager: mockStorageManager,
				indexManager: mockIndexManager,
				config
			});

			const key = "user1";
			const data = { name: "John" };
			
			// Set initial record
			crudManagerNoVersion.set(key, data);
			
			// Update record - should not throw
			const result = crudManagerNoVersion.set(key, { name: "John Updated" });

			assert.ok(result instanceof Record);
			assert.strictEqual(result.get("name"), "John Updated");
		});

		/**
		 * Test validation error handling
		 */
		it("should throw ValidationError when schema validation fails", () => {
			const failingSchema = new MockSchema(false);
			const configWithFailingSchema = { ...config, schema: failingSchema };
			const crudManagerWithFailingSchema = new CRUDManager({
				storageManager: mockStorageManager,
				indexManager: mockIndexManager,
				versionManager: mockVersionManager,
				config: configWithFailingSchema
			});

			const key = "user1";
			const data = { name: "John" };

			assert.throws(() => {
				crudManagerWithFailingSchema.set(key, data);
			}, ValidationError);
		});

		/**
		 * Test HaroError passthrough
		 */
		it("should pass through HaroError instances", () => {
			// Mock storageManager.set to throw HaroError
			const originalSet = mockStorageManager.set;
			mockStorageManager.set = () => {
				throw new ValidationError("Test HaroError", "field", "value");
			};

			const key = "user1";
			const data = { name: "John" };

			assert.throws(() => {
				crudManager.set(key, data);
			}, ValidationError);

			// Restore original method
			mockStorageManager.set = originalSet;
		});

		/**
		 * Test generic error wrapping
		 */
		it("should let non-HaroError bubble up", () => {
			// Mock storageManager.set to throw generic error
			const originalSet = mockStorageManager.set;
			mockStorageManager.set = () => {
				throw new Error("Generic error");
			};

			const key = "user1";
			const data = { name: "John" };

			assert.throws(() => {
				crudManager.set(key, data);
			}, (error) => {
				return error instanceof Error && 
				       error.message === "Generic error";
			});

			// Restore original method
			mockStorageManager.set = originalSet;
		});
	});

	describe("get method", () => {
		/**
		 * Test getting existing record
		 */
		it("should return record when it exists", () => {
			const key = "user1";
			const data = { name: "John", email: "john@example.com" };
			
			// Set up data
			mockStorageManager.set(key, data);
			
			const result = crudManager.get(key);

			assert.ok(result instanceof Record);
			assert.strictEqual(result.key, key);
			assert.strictEqual(result.get("name"), "John");
			assert.strictEqual(result.get("email"), "john@example.com");
		});

		/**
		 * Test getting non-existent record
		 */
		it("should return null when record does not exist", () => {
			const result = crudManager.get("non-existent");

			assert.strictEqual(result, null);
		});

		/**
		 * Test getting record with version information
		 */
		it("should include version information when requested", () => {
			const key = "user1";
			const data = { name: "John", email: "john@example.com" };
			
			// Set up data and version history
			mockStorageManager.set(key, data);
			mockVersionManager.addVersion(key, { name: "Old John" });
			
			const result = crudManager.get(key, { includeVersions: true });

			assert.ok(result instanceof Record);
			assert.ok(result.metadata.versions);
			assert.strictEqual(result.metadata.versions.length, 1);
			assert.deepStrictEqual(result.metadata.versions[0], { name: "Old John" });
		});

		/**
		 * Test getting record without version information
		 */
		it("should not include version information by default", () => {
			const key = "user1";
			const data = { name: "John", email: "john@example.com" };
			
			// Set up data and version history
			mockStorageManager.set(key, data);
			mockVersionManager.addVersion(key, { name: "Old John" });
			
			const result = crudManager.get(key);

			assert.ok(result instanceof Record);
			assert.strictEqual(result.metadata.versions, undefined);
		});

		/**
		 * Test getting record with version request but no version manager
		 */
		it("should work without version manager even when versions requested", () => {
			const crudManagerNoVersion = new CRUDManager({
				storageManager: mockStorageManager,
				indexManager: mockIndexManager,
				config
			});

			const key = "user1";
			const data = { name: "John", email: "john@example.com" };
			
			mockStorageManager.set(key, data);
			
			const result = crudManagerNoVersion.get(key, { includeVersions: true });

			assert.ok(result instanceof Record);
			assert.strictEqual(result.metadata.versions, undefined);
		});

		/**
		 * Test getting record with version request but no history
		 */
		it("should work when version manager exists but no history available", () => {
			const key = "user1";
			const data = { name: "John", email: "john@example.com" };
			
			mockStorageManager.set(key, data);
			
			const result = crudManager.get(key, { includeVersions: true });

			assert.ok(result instanceof Record);
			assert.strictEqual(result.metadata.versions, undefined);
		});
	});

	describe("delete method", () => {
		/**
		 * Test deleting existing record
		 */
		it("should delete existing record successfully", () => {
			const key = "user1";
			const data = { name: "John", email: "john@example.com" };
			
			// Set up data
			mockStorageManager.set(key, data);
			
			const result = crudManager.delete(key);

			assert.strictEqual(result, true);
			assert.strictEqual(mockStorageManager.has(key), false);
			
			// Verify index cleanup
			assert.strictEqual(mockIndexManager.removeRecordCalls.length, 1);
			assert.strictEqual(mockIndexManager.removeRecordCalls[0].key, key);
			
			// Verify version cleanup
			assert.strictEqual(mockVersionManager.disableVersioningCalls.length, 1);
			assert.strictEqual(mockVersionManager.disableVersioningCalls[0].key, key);
		});

		/**
		 * Test deleting non-existent record
		 */
		it("should throw RecordNotFoundError for non-existent record", () => {
			assert.throws(() => {
				crudManager.delete("non-existent");
			}, (error) => {
				return error instanceof RecordNotFoundError &&
				       error.context.key === "non-existent" &&
				       error.context.storeName === "test-store";
			});
		});

		/**
		 * Test deleting record without version manager
		 */
		it("should work without version manager", () => {
			const crudManagerNoVersion = new CRUDManager({
				storageManager: mockStorageManager,
				indexManager: mockIndexManager,
				config
			});

			const key = "user1";
			const data = { name: "John", email: "john@example.com" };
			
			mockStorageManager.set(key, data);
			
			const result = crudManagerNoVersion.delete(key);

			assert.strictEqual(result, true);
			assert.strictEqual(mockStorageManager.has(key), false);
		});
	});

	describe("has method", () => {
		/**
		 * Test checking existence of existing record
		 */
		it("should return true for existing record", () => {
			const key = "user1";
			const data = { name: "John" };
			
			mockStorageManager.set(key, data);
			
			const result = crudManager.has(key);

			assert.strictEqual(result, true);
		});

		/**
		 * Test checking existence of non-existent record
		 */
		it("should return false for non-existent record", () => {
			const result = crudManager.has("non-existent");

			assert.strictEqual(result, false);
		});
	});

	describe("_mergeRecords method", () => {
		/**
		 * Test merging two objects
		 */
		it("should merge two objects correctly", () => {
			const existing = { name: "John", age: 30, address: { city: "NYC" } };
			const updates = { name: "John Updated", email: "john@example.com", address: { state: "NY" } };
			
			const result = crudManager._mergeRecords(existing, updates);

			assert.strictEqual(result.name, "John Updated");
			assert.strictEqual(result.age, 30);
			assert.strictEqual(result.email, "john@example.com");
			assert.strictEqual(result.address.city, "NYC");
			assert.strictEqual(result.address.state, "NY");
		});

		/**
		 * Test merging nested objects
		 */
		it("should merge nested objects recursively", () => {
			const existing = { 
				profile: { 
					personal: { name: "John", age: 30 },
					contact: { email: "john@old.com" }
				}
			};
			const updates = { 
				profile: { 
					personal: { name: "John Updated" },
					contact: { phone: "123-456-7890" }
				}
			};
			
			const result = crudManager._mergeRecords(existing, updates);

			assert.strictEqual(result.profile.personal.name, "John Updated");
			assert.strictEqual(result.profile.personal.age, 30);
			assert.strictEqual(result.profile.contact.email, "john@old.com");
			assert.strictEqual(result.profile.contact.phone, "123-456-7890");
		});

		/**
		 * Test merging arrays
		 */
		it("should concatenate arrays", () => {
			const existing = [1, 2, 3];
			const updates = [4, 5, 6];
			
			const result = crudManager._mergeRecords(existing, updates);

			assert.deepStrictEqual(result, [1, 2, 3, 4, 5, 6]);
		});

		/**
		 * Test overriding with primitive values
		 */
		it("should override with primitive values", () => {
			const existing = 42;
			const updates = 100;
			
			const result = crudManager._mergeRecords(existing, updates);

			assert.strictEqual(result, 100);
		});

		/**
		 * Test merging object with null values
		 */
		it("should handle null values correctly", () => {
			const existing = { name: "John", age: 30 };
			const updates = { name: "Jane", age: null };
			
			const result = crudManager._mergeRecords(existing, updates);

			assert.strictEqual(result.name, "Jane");
			assert.strictEqual(result.age, null);
		});

		/**
		 * Test merging with array properties in objects
		 */
		it("should replace array properties rather than merge", () => {
			const existing = { 
				name: "John", 
				tags: ["old", "existing"],
				nested: { arr: [1, 2] }
			};
			const updates = { 
				tags: ["new", "updated"],
				nested: { arr: [3, 4] }
			};
			
			const result = crudManager._mergeRecords(existing, updates);

			assert.deepStrictEqual(result.tags, ["new", "updated"]);
			assert.deepStrictEqual(result.nested.arr, [3, 4]);
		});

		/**
		 * Test merging with mixed types
		 */
		it("should handle mixed type scenarios", () => {
			const existing = { value: { nested: "object" } };
			const updates = { value: "primitive" };
			
			const result = crudManager._mergeRecords(existing, updates);

			assert.strictEqual(result.value, "primitive");
		});

		/**
		 * Test complex nested merge scenario
		 */
		it("should handle complex nested merge scenarios", () => {
			const existing = {
				user: {
					profile: {
						personal: { name: "John", age: 30 },
						preferences: { theme: "dark", notifications: true }
					},
					settings: {
						privacy: "public",
						language: "en"
					}
				},
				metadata: {
					created: "2023-01-01",
					tags: ["user", "active"]
				}
			};

			const updates = {
				user: {
					profile: {
						personal: { name: "John Updated", location: "NYC" },
						preferences: { theme: "light" }
					},
					settings: {
						privacy: "private"
					}
				},
				metadata: {
					updated: "2023-12-01",
					tags: ["user", "premium"]
				}
			};

			const result = crudManager._mergeRecords(existing, updates);

			// Test deeply nested merges
			assert.strictEqual(result.user.profile.personal.name, "John Updated");
			assert.strictEqual(result.user.profile.personal.age, 30); // Preserved
			assert.strictEqual(result.user.profile.personal.location, "NYC"); // Added
			
			assert.strictEqual(result.user.profile.preferences.theme, "light"); // Updated
			assert.strictEqual(result.user.profile.preferences.notifications, true); // Preserved
			
			assert.strictEqual(result.user.settings.privacy, "private"); // Updated
			assert.strictEqual(result.user.settings.language, "en"); // Preserved
			
			// Test array replacement
			assert.deepStrictEqual(result.metadata.tags, ["user", "premium"]);
			
			// Test simple properties
			assert.strictEqual(result.metadata.created, "2023-01-01"); // Preserved
			assert.strictEqual(result.metadata.updated, "2023-12-01"); // Added
		});
	});
});
