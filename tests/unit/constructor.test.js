import assert from "node:assert";
import { describe, it } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Constructor", () => {
	it("should create a new instance with default configuration", () => {
		const instance = new Haro();
		assert.strictEqual(instance.delimiter, "|");
		assert.strictEqual(instance.immutable, false);
		assert.deepStrictEqual(instance.index, []);
		assert.strictEqual(instance.key, "id");
		assert.strictEqual(instance.versioning, false);
		assert.strictEqual(instance.size, 0);
		assert.deepStrictEqual(instance.registry, []);
	});

	it("should create instance with custom configuration", () => {
		const config = {
			delimiter: "::",
			immutable: true,
			index: ["name", "email"],
			key: "userId",
			versioning: true,
		};
		const instance = new Haro(config);

		assert.strictEqual(instance.delimiter, "::");
		assert.strictEqual(instance.immutable, true);
		assert.deepStrictEqual(instance.index, ["name", "email"]);
		assert.strictEqual(instance.key, "userId");
		assert.strictEqual(instance.versioning, true);
	});

	it("should generate unique id when not provided", () => {
		const instance1 = new Haro();
		const instance2 = new Haro();
		assert.notStrictEqual(instance1.id, instance2.id);
	});

	it("should use provided id", () => {
		const customId = "custom-store-id";
		const instance = new Haro({ id: customId });
		assert.strictEqual(instance.id, customId);
	});

	it("should handle non-array index configuration", () => {
		const instance = new Haro({ index: "name" });
		assert.deepStrictEqual(instance.index, []);
	});

	it("should use JSON fallback when structuredClone is unavailable", () => {
		const originalStructuredClone = globalThis.structuredClone;
		globalThis.structuredClone = undefined;

		try {
			const instance = new Haro();
			const testObj = { a: 1, b: { c: 2 } };
			const cloned = instance.clone(testObj);
			assert.deepStrictEqual(cloned, testObj);
			assert.notStrictEqual(cloned, testObj);
		} finally {
			globalThis.structuredClone = originalStructuredClone;
		}
	});

	it("should reindex when initialize is called on uninitialized instance", () => {
		const instance = new Haro({ index: ["name"] });
		instance.initialized = false;
		const result = instance.initialize();
		assert.strictEqual(instance.initialized, true);
		assert.strictEqual(result, instance);
		assert.strictEqual(instance.indexes.has("name"), true);
	});
});
