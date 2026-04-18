import assert from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Lifecycle Hooks", () => {
	class TestStore extends Haro {
		constructor(config) {
			super(config);
			this.hooks = {
				beforeBatch: [],
				beforeClear: [],
				beforeDelete: [],
				beforeSet: [],
				onBatch: [],
				onClear: [],
				onDelete: [],
				onOverride: [],
				onSet: [],
			};
		}

		beforeBatch(args, type) {
			this.hooks.beforeBatch.push({ args, type });

			return args;
		}

		beforeClear() {
			this.hooks.beforeClear.push(true);

			return super.beforeClear();
		}

		beforeDelete(key, batch) {
			this.hooks.beforeDelete.push({ key, batch });

			return super.beforeDelete(key, batch);
		}

		beforeSet(key, data, batch, override) {
			this.hooks.beforeSet.push({ key, data, batch, override });

			return super.beforeSet(key, data, batch, override);
		}

		onBatch(result, type) {
			this.hooks.onBatch.push({ result, type });

			return super.onBatch(result, type);
		}

		onClear() {
			this.hooks.onClear.push(true);

			return super.onClear();
		}

		onDelete(key, batch) {
			this.hooks.onDelete.push({ key, batch });

			return super.onDelete(key, batch);
		}

		onOverride(type) {
			this.hooks.onOverride.push({ type });

			return super.onOverride(type);
		}

		onSet(result, batch) {
			this.hooks.onSet.push({ result, batch });

			return super.onSet(result, batch);
		}
	}

	let testStore;

	beforeEach(() => {
		testStore = new TestStore();
	});

	it("should call beforeSet and onSet hooks", () => {
		testStore.set("user1", { id: "user1", name: "John" });

		assert.strictEqual(testStore.hooks.beforeSet.length, 1);
		assert.strictEqual(testStore.hooks.onSet.length, 1);
		assert.strictEqual(testStore.hooks.beforeSet[0].key, "user1");
		assert.strictEqual(testStore.hooks.onSet[0].result.name, "John");
	});

	it("should call beforeDelete and onDelete hooks", () => {
		testStore.set("user1", { id: "user1", name: "John" });
		testStore.delete("user1");

		assert.strictEqual(testStore.hooks.beforeDelete.length, 1);
		assert.strictEqual(testStore.hooks.onDelete.length, 1);
		assert.strictEqual(testStore.hooks.beforeDelete[0].key, "user1");
	});

	it("should call beforeClear and onClear hooks", () => {
		testStore.set("user1", { id: "user1", name: "John" });
		testStore.clear();

		assert.strictEqual(testStore.hooks.beforeClear.length, 1);
		assert.strictEqual(testStore.hooks.onClear.length, 1);
	});

	it("should call beforeBatch and onBatch hooks", () => {
		const data = [{ id: "user1", name: "John" }];
		testStore.batch(data);

		assert.strictEqual(testStore.hooks.beforeBatch.length, 1);
		assert.strictEqual(testStore.hooks.onBatch.length, 1);
	});

	it("should call onOverride hook", () => {
		const data = [["user1", { id: "user1", name: "John" }]];
		testStore.override(data, "records");

		assert.strictEqual(testStore.hooks.onOverride.length, 1);
		assert.strictEqual(testStore.hooks.onOverride[0].type, "records");
	});
});
