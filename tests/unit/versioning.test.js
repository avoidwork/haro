import assert from "node:assert";
import {describe, it, beforeEach} from "mocha";
import {Haro} from "../../src/haro.js";

describe("Versioning", () => {
	let versionedStore;

	beforeEach(() => {
		versionedStore = new Haro({versioning: true});
	});

	it("should create version when updating record", () => {
		versionedStore.set("user1", {id: "user1", name: "John", age: 30});
		versionedStore.set("user1", {id: "user1", name: "John", age: 31});

		const versions = versionedStore.versions.get("user1");
		assert.strictEqual(versions.size, 1);

		const version = Array.from(versions)[0];
		assert.strictEqual(version.age, 30);
		assert.strictEqual(Object.isFrozen(version), true);
	});

	it("should not create version for new record", () => {
		versionedStore.set("user1", {id: "user1", name: "John"});

		const versions = versionedStore.versions.get("user1");
		assert.strictEqual(versions.size, 0);
	});

	it("should delete versions when record is deleted", () => {
		versionedStore.set("user1", {id: "user1", name: "John"});
		versionedStore.set("user1", {id: "user1", name: "John Updated"});
		versionedStore.delete("user1");

		assert.strictEqual(versionedStore.versions.has("user1"), false);
	});
});
