import assert from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Properties", () => {
	let store;

	beforeEach(() => {
		store = new Haro();
	});

	it("should have correct size property", () => {
		assert.strictEqual(store.size, 0);
		store.set("user1", { id: "user1", name: "John" });
		assert.strictEqual(store.size, 1);
	});

	it("should have correct registry property", () => {
		assert.deepStrictEqual(store.registry, []);
		store.set("user1", { id: "user1", name: "John" });
		assert.deepStrictEqual(store.registry, ["user1"]);
	});

	it("should update registry when records are added/removed", () => {
		store.set("user1", { id: "user1", name: "John" });
		store.set("user2", { id: "user2", name: "Jane" });
		assert.strictEqual(store.registry.length, 2);

		store.delete("user1");
		assert.strictEqual(store.registry.length, 1);
		assert.strictEqual(store.registry[0], "user2");
	});

	describe("limit()", () => {
		beforeEach(() => {
			store.set("user1", { id: "user1", name: "John" });
			store.set("user2", { id: "user2", name: "Jane" });
			store.set("user3", { id: "user3", name: "Bob" });
		});

		it("should return limited subset of records", () => {
			const results = store.limit(0, 2);
			assert.strictEqual(results.length, 2);
		});

		it("should throw error when offset is not a number", () => {
			assert.throws(() => {
				store.limit("0", 2);
			}, /limit: offset must be a number/);
		});

		it("should throw error when max is not a number", () => {
			assert.throws(() => {
				store.limit(0, "2");
			}, /limit: max must be a number/);
		});

		it("should support offset", () => {
			const results = store.limit(1, 2);
			assert.strictEqual(results.length, 2);
		});

		it("should handle offset beyond data size", () => {
			const results = store.limit(10, 2);
			assert.strictEqual(results.length, 0);
		});
	});
});
