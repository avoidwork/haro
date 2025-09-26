import assert from "node:assert";
import { LifecycleManager } from "../../src/lifecycle-manager.js";
import { ValidationError } from "../../src/errors.js";

describe("LifecycleManager", () => {
	let lifecycleManager;

	describe("constructor", () => {
		it("should create instance with default hooks", () => {
			lifecycleManager = new LifecycleManager();

			// Verify all default hooks exist and are functions
			assert.strictEqual(typeof lifecycleManager.hooks.beforeSet, "function");
			assert.strictEqual(typeof lifecycleManager.hooks.onset, "function");
			assert.strictEqual(typeof lifecycleManager.hooks.beforeDelete, "function");
			assert.strictEqual(typeof lifecycleManager.hooks.ondelete, "function");
			assert.strictEqual(typeof lifecycleManager.hooks.beforeClear, "function");
			assert.strictEqual(typeof lifecycleManager.hooks.onclear, "function");
			assert.strictEqual(typeof lifecycleManager.hooks.onbatch, "function");

			// Verify default hooks are no-ops (return undefined)
			assert.strictEqual(lifecycleManager.hooks.beforeSet(), undefined);
			assert.strictEqual(lifecycleManager.hooks.onset(), undefined);
		});

		it("should create instance with custom hooks", () => {
			const customHooks = {
				beforeSet: (key, data) => `beforeSet: ${key}`,
				onset: (record) => `onset: ${record.id}`,
				customHook: () => "custom"
			};

			lifecycleManager = new LifecycleManager(customHooks);

			// Verify custom hooks are applied
			assert.strictEqual(lifecycleManager.hooks.beforeSet("test", {}), "beforeSet: test");
			assert.strictEqual(lifecycleManager.hooks.onset({ id: "123" }), "onset: 123");
			assert.strictEqual(lifecycleManager.hooks.customHook(), "custom");

			// Verify default hooks still exist for non-overridden ones
			assert.strictEqual(typeof lifecycleManager.hooks.ondelete, "function");
			assert.strictEqual(lifecycleManager.hooks.ondelete(), undefined);
		});

		it("should handle empty hooks object", () => {
			lifecycleManager = new LifecycleManager({});

			// All default hooks should still exist
			assert.strictEqual(typeof lifecycleManager.hooks.beforeSet, "function");
			assert.strictEqual(typeof lifecycleManager.hooks.onset, "function");
		});

		it("should handle null hooks parameter", () => {
			lifecycleManager = new LifecycleManager(null);

			// Should use default hooks
			assert.strictEqual(typeof lifecycleManager.hooks.beforeSet, "function");
			assert.strictEqual(lifecycleManager.hooks.beforeSet(), undefined);
		});
	});

	describe("registerHook", () => {
		beforeEach(() => {
			lifecycleManager = new LifecycleManager();
		});

		it("should register a valid function hook", () => {
			const mockHandler = (data) => `processed: ${data}`;

			lifecycleManager.registerHook("testEvent", mockHandler);

			assert.strictEqual(lifecycleManager.hooks.testEvent, mockHandler);
			assert.strictEqual(lifecycleManager.hooks.testEvent("test"), "processed: test");
		});

		it("should replace existing hook", () => {
			const firstHandler = () => "first";
			const secondHandler = () => "second";

			lifecycleManager.registerHook("testEvent", firstHandler);
			assert.strictEqual(lifecycleManager.hooks.testEvent(), "first");

			lifecycleManager.registerHook("testEvent", secondHandler);
			assert.strictEqual(lifecycleManager.hooks.testEvent(), "second");
		});

		it("should throw ValidationError when handler is not a function", () => {
			assert.throws(() => {
				lifecycleManager.registerHook("testEvent", "not a function");
			}, ValidationError);

			const error = (() => {
				try {
					lifecycleManager.registerHook("testEvent", "not a function");
				} catch (err) {
					return err;
				}
			})();

			assert.strictEqual(error.message, "Hook handler for 'testEvent' must be a function");
			assert.strictEqual(error.code, "VALIDATION_ERROR");
			assert.strictEqual(error.context.field, "handler");
			assert.strictEqual(error.context.value, "not a function");
		});

		it("should throw ValidationError when handler is null", () => {
			assert.throws(() => {
				lifecycleManager.registerHook("testEvent", null);
			}, ValidationError);
		});

		it("should throw ValidationError when handler is undefined", () => {
			assert.throws(() => {
				lifecycleManager.registerHook("testEvent", undefined);
			}, ValidationError);
		});

		it("should throw ValidationError when handler is an object", () => {
			assert.throws(() => {
				lifecycleManager.registerHook("testEvent", {});
			}, ValidationError);
		});
	});

	describe("unregisterHook", () => {
		beforeEach(() => {
			lifecycleManager = new LifecycleManager();
		});

		it("should unregister existing hook", () => {
			const mockHandler = () => "test result";
			lifecycleManager.registerHook("testEvent", mockHandler);

			// Verify hook is registered
			assert.strictEqual(lifecycleManager.hooks.testEvent(), "test result");

			lifecycleManager.unregisterHook("testEvent");

			// Hook should now be a no-op
			assert.strictEqual(typeof lifecycleManager.hooks.testEvent, "function");
			assert.strictEqual(lifecycleManager.hooks.testEvent(), undefined);
		});

		it("should handle unregistering non-existing hook", () => {
			// Should not throw error
			lifecycleManager.unregisterHook("nonExistingEvent");

			assert.strictEqual(typeof lifecycleManager.hooks.nonExistingEvent, "function");
			assert.strictEqual(lifecycleManager.hooks.nonExistingEvent(), undefined);
		});

		it("should unregister default hooks", () => {
			// beforeSet is a default hook
			assert.strictEqual(typeof lifecycleManager.hooks.beforeSet, "function");

			lifecycleManager.unregisterHook("beforeSet");

			assert.strictEqual(typeof lifecycleManager.hooks.beforeSet, "function");
			assert.strictEqual(lifecycleManager.hooks.beforeSet(), undefined);
		});
	});

	describe("executeHook", () => {
		beforeEach(() => {
			lifecycleManager = new LifecycleManager();
		});

		it("should execute existing hook with arguments", () => {
			const mockHandler = (arg1, arg2, arg3) => `${arg1}-${arg2}-${arg3}`;
			lifecycleManager.registerHook("testEvent", mockHandler);

			const result = lifecycleManager.executeHook("testEvent", "a", "b", "c");

			assert.strictEqual(result, "a-b-c");
		});

		it("should return undefined for non-existing hook", () => {
			const result = lifecycleManager.executeHook("nonExistingEvent", "arg1", "arg2");

			assert.strictEqual(result, undefined);
		});

		it("should execute hook with no arguments", () => {
			const mockHandler = () => "no args";
			lifecycleManager.registerHook("testEvent", mockHandler);

			const result = lifecycleManager.executeHook("testEvent");

			assert.strictEqual(result, "no args");
		});

		it("should execute hook that returns complex data", () => {
			const mockHandler = (data) => ({ processed: true, original: data });
			lifecycleManager.registerHook("testEvent", mockHandler);

			const result = lifecycleManager.executeHook("testEvent", { id: 1, name: "test" });

			assert.deepStrictEqual(result, { processed: true, original: { id: 1, name: "test" } });
		});

		it("should execute hook that throws error", () => {
			const mockHandler = () => {
				throw new Error("Hook error");
			};
			lifecycleManager.registerHook("testEvent", mockHandler);

			assert.throws(() => {
				lifecycleManager.executeHook("testEvent");
			}, /Hook error/);
		});
	});

	describe("specific hook methods", () => {
		beforeEach(() => {
			lifecycleManager = new LifecycleManager();
		});

		it("should call beforeSet hook with correct parameters", () => {
			let capturedArgs = null;
			const mockHandler = (...args) => {
				capturedArgs = args;
				return "beforeSet result";
			};
			lifecycleManager.registerHook("beforeSet", mockHandler);

			const result = lifecycleManager.beforeSet("testKey", { data: "test" }, { option: true });

			assert.deepStrictEqual(capturedArgs, ["testKey", { data: "test" }, { option: true }]);
			assert.strictEqual(result, "beforeSet result");
		});

		it("should call onset hook with correct parameters", () => {
			let capturedArgs = null;
			const mockHandler = (...args) => {
				capturedArgs = args;
				return "onset result";
			};
			lifecycleManager.registerHook("onset", mockHandler);

			const record = { id: "123", name: "test" };
			const options = { validate: true };
			const result = lifecycleManager.onset(record, options);

			assert.deepStrictEqual(capturedArgs, [record, options]);
			assert.strictEqual(result, "onset result");
		});

		it("should call beforeDelete hook with correct parameters", () => {
			let capturedArgs = null;
			const mockHandler = (...args) => {
				capturedArgs = args;
				return "beforeDelete result";
			};
			lifecycleManager.registerHook("beforeDelete", mockHandler);

			const result = lifecycleManager.beforeDelete("testKey", true);

			assert.deepStrictEqual(capturedArgs, ["testKey", true]);
			assert.strictEqual(result, "beforeDelete result");
		});

		it("should call ondelete hook with correct parameters", () => {
			let capturedArgs = null;
			const mockHandler = (...args) => {
				capturedArgs = args;
				return "ondelete result";
			};
			lifecycleManager.registerHook("ondelete", mockHandler);

			const result = lifecycleManager.ondelete("deletedKey");

			assert.deepStrictEqual(capturedArgs, ["deletedKey"]);
			assert.strictEqual(result, "ondelete result");
		});

		it("should call beforeClear hook with no parameters", () => {
			let capturedArgs = null;
			const mockHandler = (...args) => {
				capturedArgs = args;
				return "beforeClear result";
			};
			lifecycleManager.registerHook("beforeClear", mockHandler);

			const result = lifecycleManager.beforeClear();

			assert.deepStrictEqual(capturedArgs, []);
			assert.strictEqual(result, "beforeClear result");
		});

		it("should call onclear hook with no parameters", () => {
			let capturedArgs = null;
			const mockHandler = (...args) => {
				capturedArgs = args;
				return "onclear result";
			};
			lifecycleManager.registerHook("onclear", mockHandler);

			const result = lifecycleManager.onclear();

			assert.deepStrictEqual(capturedArgs, []);
			assert.strictEqual(result, "onclear result");
		});

		it("should call onbatch hook with correct parameters", () => {
			let capturedArgs = null;
			const mockHandler = (...args) => {
				capturedArgs = args;
				return "onbatch result";
			};
			lifecycleManager.registerHook("onbatch", mockHandler);

			const results = [{ id: 1 }, { id: 2 }];
			const type = "set";
			const result = lifecycleManager.onbatch(results, type);

			assert.deepStrictEqual(capturedArgs, [results, type]);
			assert.strictEqual(result, "onbatch result");
		});
	});

	describe("getHooks", () => {
		beforeEach(() => {
			lifecycleManager = new LifecycleManager();
		});

		it("should return a copy of hooks object", () => {
			const hooks = lifecycleManager.getHooks();

			// Should be a different object (copy)
			assert.notStrictEqual(hooks, lifecycleManager.hooks);

			// Should have same properties
			assert.strictEqual(typeof hooks.beforeSet, "function");
			assert.strictEqual(typeof hooks.onset, "function");
			assert.strictEqual(typeof hooks.beforeDelete, "function");
			assert.strictEqual(typeof hooks.ondelete, "function");
			assert.strictEqual(typeof hooks.beforeClear, "function");
			assert.strictEqual(typeof hooks.onclear, "function");
			assert.strictEqual(typeof hooks.onbatch, "function");
		});

		it("should not affect original hooks when modifying returned object", () => {
			const hooks = lifecycleManager.getHooks();
			hooks.beforeSet = () => "modified";

			// Original should be unchanged
			assert.strictEqual(lifecycleManager.hooks.beforeSet(), undefined);
		});

		it("should include custom hooks", () => {
			lifecycleManager.registerHook("customHook", () => "custom");

			const hooks = lifecycleManager.getHooks();

			assert.strictEqual(typeof hooks.customHook, "function");
			assert.strictEqual(hooks.customHook(), "custom");
		});
	});

	describe("hasHook", () => {
		beforeEach(() => {
			lifecycleManager = new LifecycleManager();
		});

		it("should return true for existing hooks", () => {
			assert.strictEqual(lifecycleManager.hasHook("beforeSet"), true);
			assert.strictEqual(lifecycleManager.hasHook("onset"), true);
			assert.strictEqual(lifecycleManager.hasHook("beforeDelete"), true);
			assert.strictEqual(lifecycleManager.hasHook("ondelete"), true);
			assert.strictEqual(lifecycleManager.hasHook("beforeClear"), true);
			assert.strictEqual(lifecycleManager.hasHook("onclear"), true);
			assert.strictEqual(lifecycleManager.hasHook("onbatch"), true);
		});

		it("should return false for non-existing hooks", () => {
			assert.strictEqual(lifecycleManager.hasHook("nonExistingHook"), false);
			assert.strictEqual(lifecycleManager.hasHook("invalidEvent"), false);
		});

		it("should return true for registered custom hooks", () => {
			lifecycleManager.registerHook("customEvent", () => "test");

			assert.strictEqual(lifecycleManager.hasHook("customEvent"), true);
		});

		it("should return false for hooks that are not functions", () => {
			// Directly assign a non-function value to test this edge case
			lifecycleManager.hooks.brokenHook = "not a function";

			assert.strictEqual(lifecycleManager.hasHook("brokenHook"), false);
		});

		it("should return false for undefined hooks", () => {
			// Directly assign undefined to test this edge case
			lifecycleManager.hooks.undefinedHook = undefined;

			assert.strictEqual(lifecycleManager.hasHook("undefinedHook"), false);
		});

		it("should return false for null hooks", () => {
			// Directly assign null to test this edge case
			lifecycleManager.hooks.nullHook = null;

			assert.strictEqual(lifecycleManager.hasHook("nullHook"), false);
		});
	});

	describe("clearHooks", () => {
		beforeEach(() => {
			lifecycleManager = new LifecycleManager();
		});

		it("should reset all hooks to no-ops", () => {
			// Register custom hooks
			lifecycleManager.registerHook("beforeSet", () => "custom beforeSet");
			lifecycleManager.registerHook("customHook", () => "custom hook");

			// Verify they work
			assert.strictEqual(lifecycleManager.hooks.beforeSet(), "custom beforeSet");
			assert.strictEqual(lifecycleManager.hooks.customHook(), "custom hook");

			lifecycleManager.clearHooks();

			// All hooks should now be no-ops
			assert.strictEqual(lifecycleManager.hooks.beforeSet(), undefined);
			assert.strictEqual(lifecycleManager.hooks.onset(), undefined);
			assert.strictEqual(lifecycleManager.hooks.beforeDelete(), undefined);
			assert.strictEqual(lifecycleManager.hooks.ondelete(), undefined);
			assert.strictEqual(lifecycleManager.hooks.beforeClear(), undefined);
			assert.strictEqual(lifecycleManager.hooks.onclear(), undefined);
			assert.strictEqual(lifecycleManager.hooks.onbatch(), undefined);
			assert.strictEqual(lifecycleManager.hooks.customHook(), undefined);

			// All should still be functions
			assert.strictEqual(typeof lifecycleManager.hooks.beforeSet, "function");
			assert.strictEqual(typeof lifecycleManager.hooks.customHook, "function");
		});

		it("should work with empty hooks object", () => {
			lifecycleManager = new LifecycleManager({});

			// Should not throw error
			lifecycleManager.clearHooks();

			// Default hooks should be no-ops
			assert.strictEqual(lifecycleManager.hooks.beforeSet(), undefined);
		});
	});

	describe("default hook execution", () => {
		beforeEach(() => {
			lifecycleManager = new LifecycleManager();
		});

		it("should execute default no-op hooks without error", () => {
			// Test all default hooks to ensure 100% function coverage
			assert.strictEqual(lifecycleManager.beforeSet("key", {}, {}), undefined);
			assert.strictEqual(lifecycleManager.onset({}, {}), undefined);
			assert.strictEqual(lifecycleManager.beforeDelete("key", false), undefined);
			assert.strictEqual(lifecycleManager.ondelete("key"), undefined);
			assert.strictEqual(lifecycleManager.beforeClear(), undefined);
			assert.strictEqual(lifecycleManager.onclear(), undefined);
			assert.strictEqual(lifecycleManager.onbatch([], "set"), undefined);
		});

		it("should execute default hooks directly via hooks object", () => {
			// Directly call the default no-op functions to ensure they're covered
			assert.strictEqual(lifecycleManager.hooks.beforeSet(), undefined);
			assert.strictEqual(lifecycleManager.hooks.onset(), undefined);
			assert.strictEqual(lifecycleManager.hooks.beforeDelete(), undefined);
			assert.strictEqual(lifecycleManager.hooks.ondelete(), undefined);
			assert.strictEqual(lifecycleManager.hooks.beforeClear(), undefined);
			assert.strictEqual(lifecycleManager.hooks.onclear(), undefined);
			assert.strictEqual(lifecycleManager.hooks.onbatch(), undefined);
		});
	});

	describe("edge cases and integration", () => {
		beforeEach(() => {
			lifecycleManager = new LifecycleManager();
		});

		it("should handle executeHook with many arguments", () => {
			const mockHandler = (...args) => args.length;
			lifecycleManager.registerHook("testEvent", mockHandler);

			const result = lifecycleManager.executeHook("testEvent", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

			assert.strictEqual(result, 10);
		});

		it("should handle hooks that modify their arguments", () => {
			const mockHandler = (data) => {
				data.modified = true;
				return data;
			};
			lifecycleManager.registerHook("testEvent", mockHandler);

			const inputData = { id: 1, name: "test" };
			const result = lifecycleManager.executeHook("testEvent", inputData);

			assert.strictEqual(result.modified, true);
			assert.strictEqual(inputData.modified, true); // Original object was modified
		});

		it("should handle hooks that return null", () => {
			const mockHandler = () => null;
			lifecycleManager.registerHook("testEvent", mockHandler);

			const result = lifecycleManager.executeHook("testEvent");

			assert.strictEqual(result, null);
		});

		it("should handle hooks that return false", () => {
			const mockHandler = () => false;
			lifecycleManager.registerHook("testEvent", mockHandler);

			const result = lifecycleManager.executeHook("testEvent");

			assert.strictEqual(result, false);
		});

		it("should handle synchronous hook execution", () => {
			let executionOrder = [];
			
			lifecycleManager.registerHook("beforeSet", () => {
				executionOrder.push("beforeSet");
				return "beforeSet";
			});
			
			lifecycleManager.registerHook("onset", () => {
				executionOrder.push("onset");
				return "onset";
			});

			lifecycleManager.beforeSet("key", {}, {});
			lifecycleManager.onset({}, {});

			assert.deepStrictEqual(executionOrder, ["beforeSet", "onset"]);
		});
	});
});
