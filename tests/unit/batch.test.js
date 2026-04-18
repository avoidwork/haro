import assert from "node:assert";
import { describe, it } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Batch Operations", () => {
	describe("isBatching getter", () => {
		it("should return false when not batching", () => {
			const store = new Haro();
			assert.strictEqual(store.isBatching, false);
		});

		it("should return true during setMany operation", () => {
			const store = new Haro();
			assert.strictEqual(store.isBatching, false);
			store.setMany([{ id: "1", name: "Test" }]);
			assert.strictEqual(store.isBatching, false);
		});

		it("should return true during deleteMany operation", () => {
			const store = new Haro();
			store.set("1", { id: "1", name: "Test" });
			store.deleteMany(["1"]);
			assert.strictEqual(store.isBatching, false);
		});
	});

	describe("setMany()", () => {
		it("should set multiple records", () => {
			const store = new Haro();
			const data = [
				{ id: "user1", name: "John", age: 30 },
				{ id: "user2", name: "Jane", age: 25 },
			];
			const results = store.setMany(data);

			assert.strictEqual(results.length, 2);
			assert.strictEqual(store.size, 2);
			assert.strictEqual(store.has("user1"), true);
			assert.strictEqual(store.has("user2"), true);
		});

		it("should update existing records", () => {
			const store = new Haro({ key: "id" });
			store.set("user1", { id: "user1", name: "John" });

			const results = store.setMany([{ id: "user1", name: "John Updated" }]);

			assert.strictEqual(results.length, 1);
			assert.strictEqual(store.get("user1").name, "John Updated");
		});

		it("should skip indexing during batch and reindex after", () => {
			const store = new Haro({ index: ["name"] });
			const data = [
				{ id: "user1", name: "John", age: 30 },
				{ id: "user2", name: "Jane", age: 25 },
			];

			store.setMany(data);

			assert.strictEqual(store.size, 2);
			const johnResults = store.find({ name: "John" });
			assert.strictEqual(johnResults.length, 1);
			assert.strictEqual(johnResults[0].age, 30);
		});

		it("should skip versioning during batch", () => {
			const store = new Haro({ key: "id", versioning: true });
			store.set("user1", { id: "user1", name: "John" });

			store.setMany([
				{ id: "user1", name: "Jane" },
				{ id: "user1", name: "Bob" },
			]);

			const versions = store.versions.get("user1");
			assert.strictEqual(versions.size, 0);
			assert.strictEqual(store.get("user1").name, "Bob");
		});

		it("should have isBatching flag set during operation", () => {
			const store = new Haro();
			store.set("user1", { id: "user1", name: "John" });

			assert.strictEqual(store.isBatching, false);
			store.setMany([{ id: "user1", name: "Jane" }]);
			assert.strictEqual(store.isBatching, false);
		});
	});

	describe("deleteMany()", () => {
		it("should delete multiple records", () => {
			const store = new Haro();
			store.set("user1", { id: "user1", name: "John" });
			store.set("user2", { id: "user2", name: "Jane" });

			const results = store.deleteMany(["user1", "user2"]);

			assert.strictEqual(results.length, 2);
			assert.strictEqual(store.size, 0);
		});

		it("should throw error if key doesn't exist", () => {
			const store = new Haro();
			assert.throws(() => {
				store.deleteMany(["nonexistent"]);
			});
		});

		it("should skip indexing during batch", () => {
			const store = new Haro({ index: ["name"] });
			store.set("user1", { id: "user1", name: "John" });
			store.set("user2", { id: "user2", name: "Jane" });

			store.deleteMany(["user1", "user2"]);

			assert.strictEqual(store.size, 0);
			const results = store.find({ name: "John" });
			assert.strictEqual(results.length, 0);
		});

		it("should skip versioning during batch update", () => {
			const store = new Haro({ key: "id", versioning: true });
			store.set("user1", { id: "user1", name: "John" });

			store.setMany([
				{ id: "user1", name: "Jane" },
				{ id: "user1", name: "Bob" },
			]);

			const versions = store.versions.get("user1");
			assert.strictEqual(versions.size, 0);
			assert.strictEqual(store.get("user1").name, "Bob");
		});

		it("should have isBatching flag set during operation", () => {
			const store = new Haro({ key: "id", versioning: true });
			store.set("user1", { id: "user1", name: "John" });
			let batchingDuringOperation = false;

			store.deleteMany(["user1"]);

			assert.strictEqual(batchingDuringOperation, false);
		});
	});
});
