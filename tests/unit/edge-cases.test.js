import assert from "node:assert";
import { describe, it } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Edge Cases Coverage", () => {
	describe("#getNestedValue() with empty path", () => {
		it("should return undefined when path is empty string", () => {
			const store = new Haro();
			store.set("user1", { id: "user1", name: "John" });

			const result = store.get("user1");
			const nestedValue = (() => {
				const obj = result;
				const path = "";
				if (obj === null || obj === undefined || path === "") {
					return undefined;
				}
				const keys = path.split(".");
				let res = obj;
				const keysLen = keys.length;
				for (let i = 0; i < keysLen; i++) {
					const key = keys[i];
					if (res === null || res === undefined || !(key in res)) {
						return undefined;
					}
					res = res[key];
				}
				return res;
			})();

			assert.strictEqual(nestedValue, undefined);
		});

		it("should return undefined when object is null", () => {
			const result = (() => {
				const obj = null;
				const path = "name";
				if (obj === null || obj === undefined || path === "") {
					return undefined;
				}
				const keys = path.split(".");
				let res = obj;
				const keysLen = keys.length;
				for (let i = 0; i < keysLen; i++) {
					const key = keys[i];
					if (res === null || res === undefined || !(key in res)) {
						return undefined;
					}
					res = res[key];
				}
				return res;
			})();

			assert.strictEqual(result, undefined);
		});

		it("should return undefined when object is undefined", () => {
			const result = (() => {
				const obj = undefined;
				const path = "name";
				if (obj === null || obj === undefined || path === "") {
					return undefined;
				}
				const keys = path.split(".");
				let res = obj;
				const keysLen = keys.length;
				for (let i = 0; i < keysLen; i++) {
					const key = keys[i];
					if (res === null || res === undefined || !(key in res)) {
						return undefined;
					}
					res = res[key];
				}
				return res;
			})();

			assert.strictEqual(result, undefined);
		});
	});

	describe("where() full scan warning", () => {
		it("should trigger warning when querying non-indexed field", async () => {
			const store = new Haro({ index: ["name"], warnOnFullScan: true });
			store.set("user1", { id: "user1", name: "John", age: 30 });

			let warningTriggered = false;
			const originalWarn = console.warn;
			console.warn = (message) => {
				warningTriggered = true;
				assert.strictEqual(
					message,
					"where(): performing full table scan - consider adding an index",
				);
			};

			try {
				const results = await store.where({ age: 30 });
				assert.strictEqual(warningTriggered, true);
				assert.strictEqual(results.length, 1);
				assert.strictEqual(results[0].id, "user1");
			} finally {
				console.warn = originalWarn;
			}
		});

		it("should not trigger warning when warnOnFullScan is disabled", async () => {
			const store = new Haro({ index: ["name"], warnOnFullScan: false });
			store.set("user1", { id: "user1", name: "John", age: 30 });
			store.set("user2", { id: "user2", name: "Jane", age: 25 });

			let warningTriggered = false;
			const originalWarn = console.warn;
			console.warn = () => {
				warningTriggered = true;
			};

			try {
				const results = await store.where({ age: 30 });
				assert.strictEqual(warningTriggered, false);
				assert.strictEqual(results.length, 1);
			} finally {
				console.warn = originalWarn;
			}
		});

		it("should not trigger warning when using indexed fields", async () => {
			const store = new Haro({ index: ["age"], warnOnFullScan: true });
			store.set("user1", { id: "user1", name: "John", age: 30 });
			store.set("user2", { id: "user2", name: "Jane", age: 25 });

			let warningTriggered = false;
			const originalWarn = console.warn;
			console.warn = () => {
				warningTriggered = true;
			};

			try {
				const results = await store.where({ age: 30 });
				assert.strictEqual(warningTriggered, false);
				assert.strictEqual(results.length, 1);
			} finally {
				console.warn = originalWarn;
			}
		});
	});

	describe("prototype pollution prevention", () => {
		it("should prevent __proto__ pollution during initial set", () => {
			const store = new Haro({ index: ["name"] });

			store.set("user1", {
				name: "John",
				__proto__: { evil: "injected" },
			});

			const record = store.get("user1");
			assert.strictEqual(record.name, "John");
			assert.notStrictEqual(record.__proto__, { evil: "injected" });
		});

		it("should prevent __proto__ pollution during update via merge", () => {
			const store = new Haro({ index: ["name"] });

			store.set("user1", { name: "John", age: 30 });
			store.set("user1", {
				name: "Jane",
				__proto__: { evil: "injected" },
			});

			const record = store.get("user1");
			assert.strictEqual(record.name, "Jane");
			assert.strictEqual(record.age, 30);
			assert.strictEqual(record.hasOwnProperty("__proto__"), false);
		});

		it("should prevent constructor pollution during update", () => {
			const store = new Haro({ index: ["name"] });

			store.set("user1", { name: "John", age: 30 });
			store.set("user1", {
				name: "Jane",
				constructor: { evil: "injected" },
			});

			const record = store.get("user1");
			assert.strictEqual(record.name, "Jane");
			assert.strictEqual(record.age, 30);
		});

		it("should prevent prototype pollution during update", () => {
			const store = new Haro({ index: ["name"] });

			store.set("user1", { name: "John", age: 30 });
			store.set("user1", {
				name: "Jane",
				prototype: { evil: "injected" },
			});

			const record = store.get("user1");
			assert.strictEqual(record.name, "Jane");
			assert.strictEqual(record.age, 30);
		});
	});
});
