import assert from "node:assert";
import {describe, it, beforeEach} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Error Handling", () => {
	let store;

	beforeEach(() => {
		store = new Haro();
	});

	it("should handle invalid function in filter", () => {
		assert.throws(() => {
			store.filter(123);
		}, /Invalid function/);
	});

	it("should handle invalid function in map", () => {
		assert.throws(() => {
			store.map("not a function");
		}, /Invalid function/);
	});

	it("should handle invalid field in sortBy", () => {
		assert.throws(() => {
			store.sortBy("");
		}, /Invalid field/);
	});

	it("should handle invalid type in override", () => {
		assert.throws(() => {
			store.override([], "invalid");
		}, /Invalid type/);
	});

	it("should handle record not found in delete", () => {
		assert.throws(() => {
			store.delete("nonexistent");
		}, /Record not found/);
	});
});
