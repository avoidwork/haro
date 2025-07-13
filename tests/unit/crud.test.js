import assert from "node:assert";
import {describe, it, beforeEach} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Basic CRUD Operations", () => {
	let store;

	beforeEach(() => {
		store = new Haro();
	});

	describe("set()", () => {
		it("should set a record with auto-generated key", () => {
			const data = {name: "John", age: 30};
			const result = store.set(null, data);

			assert.strictEqual(typeof result[0], "string");
			assert.strictEqual(result[1].name, "John");
			assert.strictEqual(result[1].age, 30);
			assert.strictEqual(store.size, 1);
		});

		it("should set a record with specific key", () => {
			const data = {id: "user123", name: "John", age: 30};
			const result = store.set("user123", data);

			assert.strictEqual(result[0], "user123");
			assert.strictEqual(result[1].name, "John");
			assert.strictEqual(result[1].age, 30);
		});

		it("should use record key field when key is null", () => {
			const data = {id: "user456", name: "Jane", age: 25};
			const result = store.set(null, data);

			assert.strictEqual(result[0], "user456");
			assert.strictEqual(result[1].name, "Jane");
		});

		it("should merge with existing record by default", () => {
			store.set("user1", {id: "user1", name: "John", age: 30});
			const result = store.set("user1", {age: 31, city: "NYC"});

			assert.strictEqual(result[1].name, "John");
			assert.strictEqual(result[1].age, 31);
			assert.strictEqual(result[1].city, "NYC");
		});

		it("should override existing record when override is true", () => {
			store.set("user1", {id: "user1", name: "John", age: 30});
			const result = store.set("user1", {id: "user1", age: 31}, false, true);

			assert.strictEqual(result[1].name, undefined);
			assert.strictEqual(result[1].age, 31);
		});
	});

	describe("get()", () => {
		beforeEach(() => {
			store.set("user1", {id: "user1", name: "John", age: 30});
		});

		it("should retrieve existing record", () => {
			const result = store.get("user1");
			assert.strictEqual(result[0], "user1");
			assert.strictEqual(result[1].name, "John");
		});

		it("should return null for non-existent record", () => {
			const result = store.get("nonexistent");
			assert.strictEqual(result, null);
		});

		it("should return raw data when raw=true", () => {
			const result = store.get("user1", true);
			assert.strictEqual(result.name, "John");
			assert.strictEqual(result.age, 30);
		});

		it("should return frozen data in immutable mode", () => {
			const immutableStore = new Haro({immutable: true});
			immutableStore.set("user1", {id: "user1", name: "John"});
			const result = immutableStore.get("user1");

			assert.strictEqual(Object.isFrozen(result), true);
			assert.strictEqual(Object.isFrozen(result[1]), true);
		});
	});

	describe("has()", () => {
		beforeEach(() => {
			store.set("user1", {id: "user1", name: "John"});
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
			store.set("user1", {id: "user1", name: "John"});
			store.set("user2", {id: "user2", name: "Jane"});
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
			indexedStore.set("user1", {id: "user1", name: "John"});
			indexedStore.delete("user1");

			const results = indexedStore.find({name: "John"});
			assert.strictEqual(results.length, 0);
		});
	});

	describe("clear()", () => {
		beforeEach(() => {
			store.set("user1", {id: "user1", name: "John"});
			store.set("user2", {id: "user2", name: "Jane"});
		});

		it("should remove all records", () => {
			store.clear();
			assert.strictEqual(store.size, 0);
			assert.deepStrictEqual(store.registry, []);
		});

		it("should clear all indexes", () => {
			const indexedStore = new Haro({index: ["name"]});
			indexedStore.set("user1", {id: "user1", name: "John"});
			indexedStore.clear();

			const results = indexedStore.find({name: "John"});
			assert.strictEqual(results.length, 0);
		});

		it("should clear versions when versioning is enabled", () => {
			const versionedStore = new Haro({versioning: true});
			versionedStore.set("user1", {id: "user1", name: "John"});
			versionedStore.set("user1", {id: "user1", name: "John Updated"});
			versionedStore.clear();

			assert.strictEqual(versionedStore.versions.size, 0);
		});
	});
});
