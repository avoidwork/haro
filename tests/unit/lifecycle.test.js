import assert from "node:assert";
import {describe, it, beforeEach} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Lifecycle Hooks", () => {
	class TestStore extends Haro {
		constructor (config) {
			super(config);
			this.hooks = {
				beforeBatch: [],
				beforeClear: [],
				beforeDelete: [],
				beforeSet: [],
				onbatch: [],
				onclear: [],
				ondelete: [],
				onoverride: [],
				onset: []
			};
		}

		beforeBatch (args, type) {
			this.hooks.beforeBatch.push({args, type});

			return args;
		}

		beforeClear () {
			this.hooks.beforeClear.push(true);

			return super.beforeClear();
		}

		beforeDelete (key, batch) {
			this.hooks.beforeDelete.push({key, batch});

			return super.beforeDelete(key, batch);
		}

		beforeSet (key, data, batch, override) {
			this.hooks.beforeSet.push({key, data, batch, override});

			return super.beforeSet(key, data, batch, override);
		}

		onbatch (result, type) {
			this.hooks.onbatch.push({result, type});

			return super.onbatch(result, type);
		}

		onclear () {
			this.hooks.onclear.push(true);

			return super.onclear();
		}

		ondelete (key, batch) {
			this.hooks.ondelete.push({key, batch});

			return super.ondelete(key, batch);
		}

		onoverride (type) {
			this.hooks.onoverride.push({type});

			return super.onoverride(type);
		}

		onset (result, batch) {
			this.hooks.onset.push({result, batch});

			return super.onset(result, batch);
		}
	}

	let testStore;

	beforeEach(() => {
		testStore = new TestStore();
	});

	it("should call beforeSet and onset hooks", () => {
		testStore.set("user1", {id: "user1", name: "John"});

		assert.strictEqual(testStore.hooks.beforeSet.length, 1);
		assert.strictEqual(testStore.hooks.onset.length, 1);
		assert.strictEqual(testStore.hooks.beforeSet[0].key, "user1");
		assert.strictEqual(testStore.hooks.onset[0].result[1].name, "John");
	});

	it("should call beforeDelete and ondelete hooks", () => {
		testStore.set("user1", {id: "user1", name: "John"});
		testStore.delete("user1");

		assert.strictEqual(testStore.hooks.beforeDelete.length, 1);
		assert.strictEqual(testStore.hooks.ondelete.length, 1);
		assert.strictEqual(testStore.hooks.beforeDelete[0].key, "user1");
	});

	it("should call beforeClear and onclear hooks", () => {
		testStore.set("user1", {id: "user1", name: "John"});
		testStore.clear();

		assert.strictEqual(testStore.hooks.beforeClear.length, 1);
		assert.strictEqual(testStore.hooks.onclear.length, 1);
	});

	it("should call beforeBatch and onbatch hooks", () => {
		const data = [{id: "user1", name: "John"}];
		testStore.batch(data);

		assert.strictEqual(testStore.hooks.beforeBatch.length, 1);
		assert.strictEqual(testStore.hooks.onbatch.length, 1);
	});

	it("should call onoverride hook", () => {
		const data = [["user1", {id: "user1", name: "John"}]];
		testStore.override(data, "records");

		assert.strictEqual(testStore.hooks.onoverride.length, 1);
		assert.strictEqual(testStore.hooks.onoverride[0].type, "records");
	});
});
