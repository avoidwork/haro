import assert from "node:assert";
import {describe, it, beforeEach} from "node:test";
import {Haro} from "../../src/haro.js";

describe("Properties", () => {
	let store;

	beforeEach(() => {
		store = new Haro();
	});

	it("should have correct size property", () => {
		assert.strictEqual(store.size, 0);
		store.set({id: "user1", name: "John"});
		assert.strictEqual(store.size, 1);
	});

	it("should have correct registry property", () => {
		assert.deepStrictEqual(store.registry, []);
		store.set({id: "user1", name: "John"});
		assert.deepStrictEqual(store.registry, ["user1"]);
	});

	it("should update registry when records are added/removed", () => {
		store.set({id: "user1", name: "John"});
		store.set({id: "user2", name: "Jane"});
		assert.strictEqual(store.registry.length, 2);

		store.delete("user1");
		assert.strictEqual(store.registry.length, 1);
		assert.strictEqual(store.registry[0], "user2");
	});
});
