import assert from "node:assert";
import {describe, it} from "node:test";
import {Haro} from "../../src/haro.js";

describe("Batch Operations", () => {
	describe("batch()", () => {
		it("should batch set multiple records", () => {
			const batchStore = new Haro();

			const data = [
				{id: "user1", name: "John", age: 30},
				{id: "user2", name: "Jane", age: 25}
			];
			const results = batchStore.batch(data, "set");

			assert.strictEqual(results.length, 2);
			assert.strictEqual(batchStore.size, 2);
			assert.strictEqual(batchStore.has("user1"), true);
			assert.strictEqual(batchStore.has("user2"), true);
		});

		it("should batch delete multiple records", () => {
			const batchStore = new Haro();

			batchStore.set({id: "user1", name: "John"});
			batchStore.set({id: "user2", name: "Jane"});

			const results = batchStore.batch(["user1", "user2"], "del");

			assert.strictEqual(results.length, 2);
			assert.strictEqual(batchStore.size, 0);
		});

		it("should default to set operation", () => {
			const batchStore = new Haro();

			const data = [{id: "user1", name: "John"}];
			const results = batchStore.batch(data);

			assert.strictEqual(results.length, 1);
			assert.strictEqual(batchStore.size, 1);
		});
	});
});
