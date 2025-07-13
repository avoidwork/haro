import assert from "node:assert";
import {describe, it, beforeEach} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Immutable Mode", () => {
	let immutableStore;

	beforeEach(() => {
		immutableStore = new Haro({immutable: true});
	});

	it("should return frozen objects from get()", () => {
		immutableStore.set("user1", {id: "user1", name: "John"});
		const result = immutableStore.get("user1");

		assert.strictEqual(Object.isFrozen(result), true);
		assert.strictEqual(Object.isFrozen(result[1]), true);
	});

	it("should return frozen arrays from find()", () => {
		immutableStore.set("user1", {id: "user1", name: "John"});
		const results = immutableStore.find({name: "John"});

		assert.strictEqual(Object.isFrozen(results), true);
	});

	it("should return frozen arrays from toArray()", () => {
		immutableStore.set("user1", {id: "user1", name: "John"});
		const results = immutableStore.toArray();

		assert.strictEqual(Object.isFrozen(results), true);
		assert.strictEqual(Object.isFrozen(results[0]), true);
	});
});
