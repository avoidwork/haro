import assert from "node:assert";
import {describe, it} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Batch Operations", () => {
	describe("batch()", () => {
		it("should batch set multiple records", () => {
			// Create a store with beforeBatch that returns the arguments
			const batchStore = new class extends Haro {
				beforeBatch (args) {
					return args;
				}
				onbatch (result) {
					return result;
				}
			}();

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
			// Create a store with beforeBatch that returns the arguments
			const batchStore = new class extends Haro {
				beforeBatch (args) {
					return args;
				}
				onbatch (result) {
					return result;
				}
			}();

			batchStore.set("user1", {id: "user1", name: "John"});
			batchStore.set("user2", {id: "user2", name: "Jane"});

			const results = batchStore.batch(["user1", "user2"], "del");

			assert.strictEqual(results.length, 2);
			assert.strictEqual(batchStore.size, 0);
		});

		it("should default to set operation", () => {
			// Create a store with beforeBatch that returns the arguments
			const batchStore = new class extends Haro {
				beforeBatch (args) {
					return args;
				}
				onbatch (result) {
					return result;
				}
			}();

			const data = [{id: "user1", name: "John"}];
			const results = batchStore.batch(data);

			assert.strictEqual(results.length, 1);
			assert.strictEqual(batchStore.size, 1);
		});
	});
});
