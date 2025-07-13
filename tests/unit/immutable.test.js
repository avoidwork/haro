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

	describe("find() method with immutable mode", () => {
		it("should return frozen array when immutable=true", () => {
			const store = new Haro({
				index: ["name"],
				immutable: true
			});

			store.set("1", {id: "1", name: "Alice", age: 30});
			store.set("2", {id: "2", name: "Bob", age: 25});

			const results = store.find({name: "Alice"});
			assert.ok(Object.isFrozen(results), "Results array should be frozen in immutable mode");
			assert.equal(results.length, 1);
			// Results are [key, record] pairs when not using raw=true
			assert.equal(results[0][1].name, "Alice");
		});

		it("should return frozen array with raw=false explicitly", () => {
			const store = new Haro({
				index: ["category"],
				immutable: true
			});

			store.set("item1", {id: "item1", category: "books", title: "Book 1"});
			store.set("item2", {id: "item2", category: "books", title: "Book 2"});

			// Call find with explicit false for raw parameter to ensure !raw is true
			const results = store.find({category: "books"}, false);

			// Verify the array is frozen
			assert.ok(Object.isFrozen(results), "Results array must be frozen");
			assert.equal(results.length, 2);
		});

		it("should test both raw conditions for branch coverage", () => {
			const store = new Haro({
				index: ["type"],
				immutable: true
			});

			store.set("1", {id: "1", type: "test"});

			// Test raw=false with immutable=true (should freeze)
			const frozenResults = store.find({type: "test"}, false);
			assert.ok(Object.isFrozen(frozenResults), "Should be frozen when raw=false and immutable=true");

			// Test raw=true with immutable=true (should NOT freeze)
			const unfrozenResults = store.find({type: "test"}, true);
			assert.ok(!Object.isFrozen(unfrozenResults), "Should NOT be frozen when raw=true");
		});
	});

	describe("limit() method with immutable mode", () => {
		it("should return frozen array when immutable=true", () => {
			const store = new Haro({
				immutable: true
			});

			store.set("1", {id: "1", name: "Alice", age: 30});
			store.set("2", {id: "2", name: "Bob", age: 25});
			store.set("3", {id: "3", name: "Charlie", age: 35});

			// Call limit() to trigger the immutable mode lines
			const results = store.limit(0, 2);
			assert.ok(Object.isFrozen(results), "Results should be frozen in immutable mode");
			assert.equal(results.length, 2, "Should return limited results");
		});
	});

	describe("map() method with immutable mode", () => {
		it("should return frozen array when immutable=true", () => {
			const store = new Haro({
				immutable: true
			});

			store.set("1", {id: "1", name: "Alice", age: 30});
			store.set("2", {id: "2", name: "Bob", age: 25});

			// Call map() without raw flag to trigger immutable mode lines
			const results = store.map(record => ({...record, processed: true}));
			assert.ok(Object.isFrozen(results), "Results should be frozen in immutable mode");
			assert.equal(results.length, 2, "Should return mapped results");
		});
	});
});
