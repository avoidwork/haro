import assert from "node:assert";
import { describe, it } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Deep Indexing", () => {
	describe("#getNestedValue()", () => {
		it("should return value for nested path", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "john@example.com" },
			});

			const record = store.get("user1");
			assert.strictEqual(record.user.email, "john@example.com");
		});

		it("should return undefined for non-existent path", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "john@example.com" },
			});

			const record = store.get("user1");
			assert.strictEqual(record.user.nonExistent, undefined);
		});

		it("should handle null values in path", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: null },
			});

			const results = store.find({ "user.email": null });
			assert.strictEqual(results.length, 1);
		});

		it("should handle empty path", () => {
			const store = new Haro();
			const result = store.find({});
			assert.strictEqual(result.length, 0);
		});

		it("should handle deeply nested paths", () => {
			const store = new Haro({ index: ["a.b.c.d.e"] });
			store.set("user1", {
				id: "user1",
				a: { b: { c: { d: { e: "deep" } } } },
			});

			const results = store.find({ "a.b.c.d.e": "deep" });
			assert.strictEqual(results.length, 1);
		});

		it("should handle arrays in path", () => {
			const store = new Haro({ index: ["tags"] });
			store.set("user1", {
				id: "user1",
				tags: ["admin", "user", "editor"],
			});

			const results = store.find({ tags: "admin" });
			assert.strictEqual(results.length, 1);
		});
	});

	describe("Basic nested field indexing", () => {
		it("should index and find by single nested field", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "john@example.com" },
			});

			const results = store.find({ "user.email": "john@example.com" });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].user.email, "john@example.com");
		});

		it("should find by deeply nested field", () => {
			const store = new Haro({ index: ["user.profile.department"] });
			store.set("user1", {
				id: "user1",
				user: { profile: { department: "IT" } },
			});
			store.set("user2", {
				id: "user2",
				user: { profile: { department: "IT" } },
			});

			const results = store.find({ "user.profile.department": "IT" });
			assert.strictEqual(results.length, 2);
		});

		it("should return empty array when no match", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "john@example.com" },
			});

			const results = store.find({ "user.email": "nonexistent@example.com" });
			assert.strictEqual(results.length, 0);
		});

		it("should handle multiple matches", () => {
			const store = new Haro({ index: ["user.address.city"] });
			store.set("user1", {
				id: "user1",
				user: { address: { city: "New York" } },
			});
			store.set("user2", {
				id: "user2",
				user: { address: { city: "New York" } },
			});

			const results = store.find({ "user.address.city": "New York" });
			assert.strictEqual(results.length, 2);
		});
	});

	describe("Composite indexes with dot notation", () => {
		it("should use composite index with nested fields", () => {
			const store = new Haro({
				index: ["user.email", "user.profile.department", "user.email|user.profile.department"],
			});
			store.set("user1", {
				id: "user1",
				user: {
					email: "john@example.com",
					profile: { department: "IT" },
				},
			});

			const results = store.find({
				"user.email": "john@example.com",
				"user.profile.department": "IT",
			});
			assert.strictEqual(results.length, 1);
		});

		it("should handle mixed flat and nested fields in composite index", () => {
			const store = new Haro({ index: ["status", "user.email", "status|user.email"] });
			store.set("user1", {
				id: "user1",
				status: "active",
				user: { email: "active@example.com" },
			});

			const results = store.find({
				status: "active",
				"user.email": "active@example.com",
			});
			assert.strictEqual(results.length, 1);
		});

		it("should return empty when composite has no match", () => {
			const store = new Haro({
				index: ["user.email", "user.profile.department", "user.email|user.profile.department"],
			});
			store.set("user1", {
				id: "user1",
				user: {
					email: "john@example.com",
					profile: { department: "IT" },
				},
			});

			const results = store.find({
				"user.email": "john@example.com",
				"user.profile.department": "HR",
			});
			assert.strictEqual(results.length, 0);
		});
	});

	describe("Array fields in nested paths", () => {
		it("should index nested array values", () => {
			const store = new Haro({ index: ["user.profile.skills"] });
			store.set("user1", {
				id: "user1",
				user: { profile: { skills: ["JavaScript", "Python"] } },
			});
			store.set("user2", {
				id: "user2",
				user: { profile: { skills: ["Java", "Python"] } },
			});

			const results = store.find({ "user.profile.skills": "Python" });
			assert.strictEqual(results.length, 2);
		});

		it("should find by specific array value", () => {
			const store = new Haro({ index: ["user.profile.skills"] });
			store.set("user1", {
				id: "user1",
				user: { profile: { skills: ["JavaScript", "Python"] } },
			});

			const results = store.find({ "user.profile.skills": "JavaScript" });
			assert.strictEqual(results.length, 1);
		});
	});

	describe("CRUD operations with nested indexes", () => {
		it("should create record with nested index", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "test@example.com" },
			});

			const results = store.find({ "user.email": "test@example.com" });
			assert.strictEqual(results.length, 1);
		});

		it("should update nested field and update index", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "old@example.com" },
			});

			store.set("user1", {
				user: { email: "new@example.com" },
			});

			const oldResults = store.find({ "user.email": "old@example.com" });
			assert.strictEqual(oldResults.length, 0);

			const newResults = store.find({ "user.email": "new@example.com" });
			assert.strictEqual(newResults.length, 1);
		});

		it("should delete record and remove from nested index", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "delete@example.com" },
			});

			store.delete("user1");

			const results = store.find({ "user.email": "delete@example.com" });
			assert.strictEqual(results.length, 0);
		});

		it("should handle batch operations with nested indexes", () => {
			const store = new Haro({ index: ["user.email"] });
			store.setMany([
				{ id: "user1", user: { email: "user1@example.com" } },
				{ id: "user2", user: { email: "user2@example.com" } },
			]);

			const results = store.find({ "user.email": "user1@example.com" });
			assert.strictEqual(results.length, 1);
		});
	});

	describe("Edge cases", () => {
		it("should handle undefined nested path", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "test@example.com" },
			});

			const results = store.find({ "user.nonexistent.field": "value" });
			assert.strictEqual(results.length, 0);
		});

		it("should handle non-existent nested path", () => {
			const store = new Haro({ index: ["user.profile.department.name"] });
			store.set("user1", {
				id: "user1",
				user: { email: "test@example.com" },
			});

			const results = store.find({ "user.profile.department.name": "IT" });
			assert.strictEqual(results.length, 0);
		});

		it("should handle special characters in field names", () => {
			const store = new Haro({ index: ["user-data.field-name"] });
			store.set("user1", {
				id: "user1",
				"user-data": { "field-name": "value" },
			});

			const results = store.find({ "user-data.field-name": "value" });
			assert.strictEqual(results.length, 1);
		});

		it("should handle empty string as value", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "" },
			});

			const results = store.find({ "user.email": "" });
			assert.strictEqual(results.length, 1);
		});

		it("should handle numeric keys in nested path", () => {
			const store = new Haro({ index: ["data.2024.value"] });
			store.set("user1", {
				id: "user1",
				data: { 2024: { value: "current" } },
			});

			const results = store.find({ "data.2024.value": "current" });
			assert.strictEqual(results.length, 1);
		});
	});

	describe("Integration with existing features", () => {
		it("should work with immutable mode", () => {
			const store = new Haro({
				index: ["user.email"],
				immutable: true,
			});
			store.set("user1", {
				id: "user1",
				user: { email: "test@example.com" },
			});

			const results = store.find({ "user.email": "test@example.com" });
			assert.strictEqual(Object.isFrozen(results), true);
		});

		it("should work with versioning", () => {
			const store = new Haro({
				index: ["user.email"],
				versioning: true,
			});
			store.set("user1", {
				id: "user1",
				user: { email: "old@example.com" },
			});
			store.set("user1", {
				user: { email: "new@example.com" },
			});

			const versions = store.versions.get("user1");
			assert.strictEqual(versions.size, 1);
		});

		it("should work with caching", async () => {
			const store = new Haro({
				index: ["user.email"],
				cache: true,
			});
			store.set("user1", {
				id: "user1",
				user: { email: "cached@example.com" },
			});

			const results = await store.where({ "user.email": "cached@example.com" });
			assert.strictEqual(results.length, 1);
		});

		it("should work with batch operations", () => {
			const store = new Haro({ index: ["user.profile.department"] });
			store.setMany([
				{
					id: "user1",
					user: { profile: { department: "IT" } },
				},
				{
					id: "user2",
					user: { profile: { department: "IT" } },
				},
			]);

			const results = store.find({ "user.profile.department": "IT" });
			assert.strictEqual(results.length, 2);
		});

		it("should clear nested indexes on clear", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "test@example.com" },
			});

			store.clear();

			const results = store.find({ "user.email": "test@example.com" });
			assert.strictEqual(results.length, 0);
		});

		it("should rebuild nested indexes on reindex", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "test@example.com" },
			});

			store.reindex();

			const results = store.find({ "user.email": "test@example.com" });
			assert.strictEqual(results.length, 1);
		});
	});

	describe("Nested path with multiple levels", () => {
		it("should handle 2-level nested path", () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "test@example.com" },
			});

			const results = store.find({ "user.email": "test@example.com" });
			assert.strictEqual(results.length, 1);
		});

		it("should handle 3-level nested path", () => {
			const store = new Haro({ index: ["user.profile.department"] });
			store.set("user1", {
				id: "user1",
				user: { profile: { department: "IT" } },
			});

			const results = store.find({ "user.profile.department": "IT" });
			assert.strictEqual(results.length, 1);
		});

		it("should handle 4-level nested path", () => {
			const store = new Haro({ index: ["a.b.c.d"] });
			store.set("user1", {
				id: "user1",
				a: { b: { c: { d: "deep" } } },
			});

			const results = store.find({ "a.b.c.d": "deep" });
			assert.strictEqual(results.length, 1);
		});

		it("should handle 5-level nested path", () => {
			const store = new Haro({ index: ["a.b.c.d.e"] });
			store.set("user1", {
				id: "user1",
				a: { b: { c: { d: { e: "value" } } } },
			});

			const results = store.find({ "a.b.c.d.e": "value" });
			assert.strictEqual(results.length, 1);
		});
	});

	describe("Mixed nested and flat indexes", () => {
		it("should query with both flat and nested fields", () => {
			const store = new Haro({ index: ["name", "user.email", "name|user.email"] });
			store.set("user1", {
				id: "user1",
				name: "John",
				user: { email: "john@example.com" },
			});

			const results = store.find({
				name: "John",
				"user.email": "john@example.com",
			});
			assert.strictEqual(results.length, 1);
		});
	});

	describe("Nested path in where() with operators", () => {
		it("should work with OR operator", async () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "user1@example.com" },
			});
			store.set("user2", {
				id: "user2",
				user: { email: "user2@example.com" },
			});

			const results = await store.where(
				{ "user.email": ["user1@example.com", "user2@example.com"] },
				"||",
			);
			assert.strictEqual(results.length, 2);
		});

		it("should work with AND operator", async () => {
			const store = new Haro({
				index: ["user.email", "user.profile.department", "user.email|user.profile.department"],
			});
			store.set("user1", {
				id: "user1",
				user: {
					email: "test@example.com",
					profile: { department: "IT" },
				},
			});

			const results = await store.where(
				{
					"user.email": "test@example.com",
					"user.profile.department": "IT",
				},
				"&&",
			);
			assert.strictEqual(results.length, 1);
		});
	});

	describe("Nested path in search()", () => {
		it("should search nested string value", async () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "search@example.com" },
			});

			const results = await store.search("search@example.com", "user.email");
			assert.strictEqual(results.length, 1);
		});

		it("should search nested value with regex", async () => {
			const store = new Haro({ index: ["user.email"] });
			store.set("user1", {
				id: "user1",
				user: { email: "admin@example.com" },
			});

			const results = await store.search(/admin/, "user.email");
			assert.strictEqual(results.length, 1);
		});
	});

	describe("Nested path in sortBy()", () => {
		it("should sort by nested field", () => {
			const store = new Haro({ index: ["user.profile.department"] });
			store.set("user1", {
				id: "user1",
				user: { profile: { department: "IT" } },
			});
			store.set("user2", {
				id: "user2",
				user: { profile: { department: "HR" } },
			});

			const results = store.sortBy("user.profile.department");
			assert.strictEqual(results.length, 2);
		});
	});
});
