import assert from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { haro } from "../../src/haro.js";
import { PredicateStrategy, ValueMatcher } from "../../src/query-strategy.js";
import { STRING_DOUBLE_AND, STRING_DOUBLE_PIPE } from "../../src/constants.js";

describe("ValueMatcher", () => {
	it("should match exact values", () => {
		assert.strictEqual(ValueMatcher.match("hello", "hello"), true);
		assert.strictEqual(ValueMatcher.match("hello", "world"), false);
	});

	it("should match numeric values", () => {
		assert.strictEqual(ValueMatcher.match(42, 42), true);
		assert.strictEqual(ValueMatcher.match(42, 43), false);
	});

	it("should match RegExp against value", () => {
		assert.strictEqual(ValueMatcher.match("hello", /^hel/), true);
		assert.strictEqual(ValueMatcher.match("hello", /xyz/), false);
	});

	it("should test value RegExp against predicate", () => {
		assert.strictEqual(ValueMatcher.match(/^hel/, "hello"), true);
		assert.strictEqual(ValueMatcher.match(/xyz/, "hello"), false);
	});

	it("should handle undefined values", () => {
		assert.strictEqual(ValueMatcher.match(undefined, undefined), true);
		assert.strictEqual(ValueMatcher.match(undefined, null), false);
	});
});

describe("PredicateStrategy", () => {
	describe("OR mode", () => {
		let strategy;

		beforeEach(() => {
			strategy = PredicateStrategy.of(STRING_DOUBLE_PIPE);
		});

		it("should match all fields with simple values", () => {
			const record = { name: "John", age: 30 };
			const predicate = { name: "John" };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				true,
			);
		});

		it("should return false when field does not match", () => {
			const record = { name: "John", age: 30 };
			const predicate = { name: "Jane" };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				false,
			);
		});

		it("should match all fields in AND across fields (OR within)", () => {
			const record = { name: "John", role: "admin" };
			const predicate = { name: "John", role: "guest" };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				false,
			);
		});

		it("should handle array predicates with OR logic", () => {
			const record = { name: "John" };
			const predicate = { name: ["Jane", "Bob", "John"] };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				true, // "John" is in the array
			);
		});

		it("should handle array predicate with no match", () => {
			const record = { name: "Jane" };
			const predicate = { name: ["Bob", "Alice"] };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				false,
			);
		});

		it("should handle array-valued fields with OR logic", () => {
			const record = { tags: ["admin", "user"] };
			const predicate = { tags: "moderator" };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				false,
			);
		});

		it("should handle RegExp in predicates", () => {
			const record = { email: "john@example.com" };
			const predicate = { email: /^john@/ };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				true,
			);
		});
	});

	describe("AND mode", () => {
		let strategy;

		beforeEach(() => {
			strategy = PredicateStrategy.of(STRING_DOUBLE_AND);
		});

		it("should match all fields", () => {
			const record = { name: "John", role: "admin" };
			const predicate = { name: "John", role: "admin" };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				true,
			);
		});

		it("should return false when one field fails", () => {
			const record = { name: "John", role: "admin" };
			const predicate = { name: "John", role: "guest" };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				false,
			);
		});

		it("should handle array predicates with AND logic", () => {
			const record = { tags: ["admin"] };
			const predicate = { tags: ["admin", "user"] };
			// AND means all predicates must be present
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				false, // "user" not in record.tags
			);
		});

		it("should handle array predicates with AND when all present", () => {
			const record = { tags: ["admin", "user"] };
			const predicate = { tags: ["admin", "user"] };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				true, // both present
			);
		});

		it("should handle array-valued fields with AND logic when predicates present", () => {
			const record = { roles: ["admin", "user"] };
			const predicate = { roles: ["admin", "user"] };
			// AND means all predicate values must be in the record's array
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				true,
			);
		});

		it("should fail AND logic when predicate value missing from array field", () => {
			const record = { roles: ["admin"] };
			const predicate = { roles: ["admin", "user"] };
			assert.strictEqual(
				strategy.matches(record, predicate, (r, k) => r[k]),
				false,
			);
		});
	});

	describe("nested values", () => {
		it("should handle dot notation paths", () => {
			const record = { profile: { name: "John" } };
			const predicate = { "profile.name": "John" };
			const getNested = (o, p) => {
				const parts = p.split(".");
				let val = o;
				for (const part of parts) {
					if (val === undefined || val === null) return undefined;
					val = val[part];
				}
				return val;
			};
			const strategy = PredicateStrategy.of(STRING_DOUBLE_PIPE);
			assert.strictEqual(strategy.matches(record, predicate, getNested), true);
		});
	});
});

describe("PredicateStrategy integration with Haro", () => {
	let store;

	beforeEach(() => {
		store = haro(null, { index: ["name", "role", "profile.city"] });
		store.set("1", { name: "John", role: "admin" });
		store.set("2", { name: "Jane", role: "guest" });
		store.set("3", { name: "Bob", role: "admin" });
	});

	it("should work with where() OR operator", async () => {
		const results = await store.where({ role: "admin" }, "||");
		assert.strictEqual(results.length, 2);
		assert.ok(results.some((r) => r.name === "John"));
		assert.ok(results.some((r) => r.name === "Bob"));
	});

	it("should work with where() AND operator", async () => {
		const results = await store.where({ name: "John", role: "admin" }, "&&");
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].name, "John");
	});

	it("should return empty array for no matches", async () => {
		const results = await store.where({ name: "NonExistent" }, "||");
		assert.strictEqual(results.length, 0);
	});
});
