import assert from "node:assert";
import { describe, it } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Batch Operations", () => {
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
	});

	describe("batch() - deprecated", () => {
		it("should batch set multiple records", () => {
			const store = new Haro();
			const data = [
				{ id: "user1", name: "John", age: 30 },
				{ id: "user2", name: "Jane", age: 25 },
			];
			const results = store.batch(data, "set");

			assert.strictEqual(results.length, 2);
			assert.strictEqual(store.size, 2);
			assert.strictEqual(store.has("user1"), true);
			assert.strictEqual(store.has("user2"), true);
		});

		it("should batch delete multiple records", () => {
			const store = new Haro();
			store.set("user1", { id: "user1", name: "John" });
			store.set("user2", { id: "user2", name: "Jane" });

			const results = store.batch(["user1", "user2"], "del");

			assert.strictEqual(results.length, 2);
			assert.strictEqual(store.size, 0);
		});

		it("should default to set operation", () => {
			const store = new Haro();
			const data = [{ id: "user1", name: "John" }];
			const results = store.batch(data);

			assert.strictEqual(results.length, 1);
			assert.strictEqual(store.size, 1);
		});
	});
});
