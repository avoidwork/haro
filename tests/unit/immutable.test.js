import assert from "node:assert";
import {describe, it, beforeEach} from "node:test";
import {Haro} from "../../src/haro.js";

describe("Immutable Mode", () => {
	let store;

	beforeEach(() => {
		store = new Haro({index: ["name"]});
	});

	it("should return frozen objects from get()", () => {
		store.set({id: "user1", name: "John"});
		const result = store.get("user1");

		assert.strictEqual(Object.isFrozen(result), true);
		assert.strictEqual(result.name, "John");
	});

	it("should return frozen objects from find()", () => {
		store.set({id: "user1", name: "John"});
		const results = store.find({name: "John"});

		assert.strictEqual(results.length, 1);
		assert.strictEqual(Object.isFrozen(results[0]), true);
	});

	it("should return frozen objects from toArray()", () => {
		store.set({id: "user1", name: "John"});
		const results = store.toArray();

		assert.strictEqual(results.length, 1);
		assert.strictEqual(Object.isFrozen(results[0]), true);
	});

	describe("find() method", () => {
		it("should return frozen records", () => {
			const indexedStore = new Haro({index: ["name"]});

			indexedStore.set({id: "1", name: "Alice", age: 30});
			indexedStore.set({id: "2", name: "Bob", age: 25});

			const results = indexedStore.find({name: "Alice"});
			assert.equal(results.length, 1);
			assert.ok(Object.isFrozen(results[0]), "Records should be frozen");
			assert.equal(results[0].name, "Alice");
		});
	});

	describe("limit() method", () => {
		it("should return frozen records", () => {
			store.set({id: "1", name: "Alice", age: 30});
			store.set({id: "2", name: "Bob", age: 25});
			store.set({id: "3", name: "Charlie", age: 35});

			const results = store.limit(0, 2);
			assert.equal(results.length, 2);
			assert.ok(Object.isFrozen(results[0]), "Records should be frozen");
		});
	});

	describe("map() method", () => {
		it("should return transformed array", () => {
			store.set({id: "1", name: "Alice", age: 30});
			store.set({id: "2", name: "Bob", age: 25});

			const results = store.map(record => ({...record, processed: true}));
			assert.equal(results.length, 2);
			assert.equal(results[0].processed, true);
		});
	});
});
