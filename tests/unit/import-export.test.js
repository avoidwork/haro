import assert from "node:assert";
import {describe, it, beforeEach} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Data Import/Export", () => {
	let store;

	beforeEach(() => {
		store = new Haro();
		store.set("user1", {id: "user1", name: "John"});
		store.set("user2", {id: "user2", name: "Jane"});
	});

	describe("dump()", () => {
		it("should dump records by default", () => {
			const data = store.dump();
			assert.strictEqual(data.length, 2);
			assert.strictEqual(data[0][0], "user1");
			assert.strictEqual(data[0][1].name, "John");
		});

		it("should dump records explicitly", () => {
			const data = store.dump("records");
			assert.strictEqual(data.length, 2);
		});

		it("should dump indexes", () => {
			const indexedStore = new Haro({index: ["name"]});
			indexedStore.set("user1", {id: "user1", name: "John"});
			const data = indexedStore.dump("indexes");

			assert.strictEqual(Array.isArray(data), true);
			assert.strictEqual(data.length, 1);
			assert.strictEqual(data[0][0], "name");
		});
	});

	describe("override()", () => {
		it("should override records", () => {
			const newData = [
				["user3", {id: "user3", name: "Bob"}],
				["user4", {id: "user4", name: "Alice"}]
			];
			const result = store.override(newData, "records");

			assert.strictEqual(result, true);
			assert.strictEqual(store.size, 2);
			assert.strictEqual(store.has("user1"), false);
			assert.strictEqual(store.has("user3"), true);
		});

		it("should override indexes", () => {
			const indexedStore = new Haro({index: ["name"]});
			const indexData = [
				["name", [["John", ["user1"]], ["Jane", ["user2"]]]]
			];
			const result = indexedStore.override(indexData, "indexes");

			assert.strictEqual(result, true);
			assert.strictEqual(indexedStore.indexes.size, 1);
		});

		it("should throw error for invalid type", () => {
			assert.throws(() => {
				store.override([], "invalid");
			}, /Invalid type/);
		});
	});
});
