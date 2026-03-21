import assert from "node:assert";
import {describe, it, beforeEach} from "node:test";
import {Haro} from "../../src/haro.js";

describe("Basic CRUD Operations", () => {
	let store;

	beforeEach(() => {
		store = new Haro();
	});

	describe("set()", () => {
		it("should set a record with auto-generated key", () => {
			const data = {name: "John", age: 30};
			const result = store.set(data);

			assert.strictEqual(typeof result.id, "string");
			assert.strictEqual(result.name, "John");
			assert.strictEqual(result.age, 30);
			assert.strictEqual(store.size, 1);
		});

		it("should set a record with specific key", () => {
			const data = {id: "user123", name: "John", age: 30};
			const result = store.set(data);

			assert.strictEqual(result.id, "user123");
			assert.strictEqual(result.name, "John");
			assert.strictEqual(result.age, 30);
		});

		it("should merge with existing record by default", () => {
			store.set({id: "user1", name: "John", age: 30});
			const result = store.set({id: "user1", age: 31, city: "NYC"});

			assert.strictEqual(result.name, "John");
			assert.strictEqual(result.age, 31);
			assert.strictEqual(result.city, "NYC");
		});
	});

	describe("get()", () => {
		beforeEach(() => {
			store.set({id: "user1", name: "John", age: 30});
		});

		it("should retrieve existing record", () => {
			const result = store.get("user1");
			assert.strictEqual(result.id, "user1");
			assert.strictEqual(result.name, "John");
		});

		it("should return null for non-existent record", () => {
			const result = store.get("nonexistent");
			assert.strictEqual(result, null);
		});

		it("should return frozen data", () => {
			const result = store.get("user1");
			assert.strictEqual(Object.isFrozen(result), true);
		});
	});

	describe("has()", () => {
		beforeEach(() => {
			store.set({id: "user1", name: "John"});
		});

		it("should return true for existing record", () => {
			assert.strictEqual(store.has("user1"), true);
		});

		it("should return false for non-existent record", () => {
			assert.strictEqual(store.has("nonexistent"), false);
		});
	});

	describe("delete()", () => {
		beforeEach(() => {
			store.set({id: "user1", name: "John"});
			store.set({id: "user2", name: "Jane"});
		});

		it("should delete existing record", () => {
			store.delete("user1");
			assert.strictEqual(store.has("user1"), false);
			assert.strictEqual(store.size, 1);
		});

		it("should throw error when deleting non-existent record", () => {
			assert.throws(() => {
				store.delete("nonexistent");
			}, /Record not found/);
		});

		it("should remove record from indexes", () => {
			const indexedStore = new Haro({index: ["name"]});
			indexedStore.set({id: "user1", name: "John"});
			indexedStore.delete("user1");

			const results = indexedStore.find({name: "John"});
			assert.strictEqual(results.length, 0);
		});
	});

	describe("clear()", () => {
		beforeEach(() => {
			store.set({id: "user1", name: "John"});
			store.set({id: "user2", name: "Jane"});
		});

		it("should remove all records", () => {
			store.clear();
			assert.strictEqual(store.size, 0);
			assert.deepStrictEqual(store.registry, []);
		});

		it("should clear all indexes", () => {
			const indexedStore = new Haro({index: ["name"]});
			indexedStore.set({id: "user1", name: "John"});
			indexedStore.clear();

			const results = indexedStore.find({name: "John"});
			assert.strictEqual(results.length, 0);
		});

		it("should clear versions when versioning is enabled", () => {
			const versionedStore = new Haro({versioning: true});
			versionedStore.set({id: "user1", name: "John"});
			versionedStore.set({id: "user1", name: "John Updated"});
			versionedStore.clear();

			assert.strictEqual(versionedStore.versions.size, 0);
		});
	});
});
