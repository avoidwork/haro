import assert from "node:assert";
import {describe, it} from "node:test";
import {Haro, haro} from "../../src/haro.js";

describe("haro factory function", () => {
	it("should create new Haro instance", () => {
		const store = haro();
		assert.strictEqual(store instanceof Haro, true);
	});

	it("should create instance with configuration", () => {
		const config = {key: "userId", index: ["name"]};
		const store = haro(null, config);
		assert.strictEqual(store.key, "userId");
		assert.deepStrictEqual(store.index, ["name"]);
	});

	it("should populate with initial data", () => {
		const data = [
			{id: "user1", name: "John"},
			{id: "user2", name: "Jane"}
		];

		const store = haro(data);

		assert.strictEqual(store.size, 2);
		assert.strictEqual(store.has("user1"), true);
		assert.strictEqual(store.has("user2"), true);
	});

	it("should handle null data", () => {
		const store = haro(null);
		assert.strictEqual(store.size, 0);
	});

	it("should combine initial data with configuration", () => {
		const data = [{id: "user1", name: "John", age: 30}];
		const config = {index: ["name", "age"]};

		const store = haro(data, config);

		assert.strictEqual(store.size, 1);
		assert.deepStrictEqual(store.index, ["name", "age"]);

		const results = store.find({name: "John"});
		assert.strictEqual(results.length, 1);
	});

	describe("with array data", () => {
		it("should populate store when data is an array", () => {
			const initialData = [
				{id: "1", name: "Alice", age: 30},
				{id: "2", name: "Bob", age: 25},
				{id: "3", name: "Charlie", age: 35}
			];

			const store = haro(initialData, {
				index: ["name"],
				key: "id"
			});

			assert.equal(store.size, 3, "Store should be populated with initial data");
			assert.ok(store.has("1"), "Should contain first record");
			assert.ok(store.has("2"), "Should contain second record");
			assert.ok(store.has("3"), "Should contain third record");

			const aliceResults = store.find({name: "Alice"});
			assert.equal(aliceResults.length, 1);
			assert.equal(aliceResults[0].age, 30);
		});

		it("should work with empty array data", () => {
			const store = haro([], {index: ["name"]});
			assert.equal(store.size, 0, "Store should be empty when initialized with empty array");
		});

		it("should work with null data (no array processing)", () => {
			const store = haro(null, {index: ["name"]});
			assert.equal(store.size, 0, "Store should be empty when initialized with null");
		});
	});
});
