import assert from "node:assert";
import {describe, it, beforeEach} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Properties", () => {
	let store;

	beforeEach(() => {
		store = new Haro();
	});

	it("should have correct size property", () => {
		assert.strictEqual(store.size, 0);
		store.set("user1", {id: "user1", name: "John"});
		assert.strictEqual(store.size, 1);
	});

	it("should have correct registry property", () => {
		assert.deepStrictEqual(store.registry, []);
		store.set("user1", {id: "user1", name: "John"});
		assert.deepStrictEqual(store.registry, ["user1"]);
	});

	it("should update registry when records are added/removed", () => {
		store.set("user1", {id: "user1", name: "John"});
		store.set("user2", {id: "user2", name: "Jane"});
		assert.strictEqual(store.registry.length, 2);

		store.delete("user1");
		assert.strictEqual(store.registry.length, 1);
		assert.strictEqual(store.registry[0], "user2");
	});
});
