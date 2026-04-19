import assert from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Caching", () => {
	describe("Cache hits and misses", () => {
		let store;

		beforeEach(() => {
			store = new Haro({ index: ["name", "age"], cache: true });
			store.set("user1", { id: "user1", name: "John", age: 30 });
			store.set("user2", { id: "user2", name: "Jane", age: 25 });
			store.set("user3", { id: "user3", name: "Bob", age: 35 });
		});

		it("should return cached result on cache hit", async () => {
			const results1 = await store.where({ name: "John" });
			const results2 = await store.where({ name: "John" });

			assert.strictEqual(results1.length, 1);
			assert.strictEqual(results2.length, 1);
			assert.strictEqual(results1[0].name, "John");
			assert.strictEqual(results2[0].name, "John");

			const stats = store.getCacheStats();
			assert.strictEqual(stats.hits, 1);
			assert.strictEqual(stats.misses, 1);
		});

		it("should compute and cache result on cache miss", async () => {
			const results = await store.where({ name: "John" });

			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
			assert.strictEqual(store.getCacheSize(), 1);

			const stats = store.getCacheStats();
			assert.strictEqual(stats.hits, 0);
			assert.strictEqual(stats.misses, 1);
		});

		it("should create different cache keys for different parameters", async () => {
			await store.where({ name: "John" });
			await store.where({ name: "Jane" });
			await store.where({ age: 30 });

			assert.strictEqual(store.getCacheSize(), 3);
		});

		it("should cache search results", async () => {
			const results1 = await store.search("John", "name");
			const results2 = await store.search("John", "name");

			assert.strictEqual(results1.length, 1);
			assert.strictEqual(results2.length, 1);

			const stats = store.getCacheStats();
			assert.strictEqual(stats.hits, 1);
			assert.strictEqual(stats.misses, 1);
		});
	});

	describe("Cache invalidation", () => {
		let store;

		beforeEach(() => {
			store = new Haro({ index: ["name"], cache: true });
			store.set("user1", { id: "user1", name: "John" });
		});

		it("should clear cache on set()", async () => {
			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);

			store.set("user2", { id: "user2", name: "Jane" });
			assert.strictEqual(store.getCacheSize(), 0);
		});

		it("should clear cache on delete()", async () => {
			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);

			store.delete("user1");
			assert.strictEqual(store.getCacheSize(), 0);
		});

		it("should clear cache on clear()", async () => {
			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);

			store.clear();
			assert.strictEqual(store.getCacheSize(), 0);
		});

		it("should clear cache on reindex()", async () => {
			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);

			store.reindex();
			assert.strictEqual(store.getCacheSize(), 0);
		});

		it("should clear cache on override()", async () => {
			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);

			store.override([["user1", { id: "user1", name: "John" }]]);
			assert.strictEqual(store.getCacheSize(), 0);
		});

		it("should clear cache on setMany()", async () => {
			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);

			store.setMany([{ id: "user2", name: "Jane" }]);
			assert.strictEqual(store.getCacheSize(), 0);
		});

		it("should clear cache on deleteMany()", async () => {
			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);

			store.deleteMany(["user1"]);
			assert.strictEqual(store.getCacheSize(), 0);
		});
	});

	describe("Batch operations", () => {
		it("should not invalidate cache during batch", async () => {
			const store = new Haro({ index: ["name"], cache: true });
			store.set("user1", { id: "user1", name: "John" });

			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);

			store.setMany([{ id: "user2", name: "Jane" }]);
			assert.strictEqual(store.getCacheSize(), 0);
		});

		it("should invalidate cache after batch completes", async () => {
			const store = new Haro({ index: ["name"], cache: true });
			store.set("user1", { id: "user1", name: "John" });

			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);

			store.setMany([{ id: "user2", name: "Jane" }]);
			assert.strictEqual(store.getCacheSize(), 0);
		});
	});

	describe("Immutable mode", () => {
		it("should freeze cached results when immutable=true", async () => {
			const store = new Haro({ index: ["name"], immutable: true, cache: true });
			store.set("user1", { id: "user1", name: "John" });

			const results1 = await store.where({ name: "John" });
			const results2 = await store.where({ name: "John" });

			assert.strictEqual(Object.isFrozen(results1), true);
			assert.strictEqual(Object.isFrozen(results2), true);
		});

		it("should clone cached results when immutable=false", async () => {
			const store = new Haro({ index: ["name"], immutable: false, cache: true });
			store.set("user1", { id: "user1", name: "John" });

			const results1 = await store.where({ name: "John" });
			const results2 = await store.where({ name: "John" });

			assert.strictEqual(Object.isFrozen(results1), false);
			assert.strictEqual(Object.isFrozen(results2), false);
			assert.notStrictEqual(results1, results2);
		});

		it("should prevent cache pollution by mutation", async () => {
			const store = new Haro({ index: ["name"], cache: true });
			store.set("user1", { id: "user1", name: "John", age: 30 });

			const results1 = await store.where({ name: "John" });
			results1[0].age = 31;

			const results2 = await store.where({ name: "John" });
			assert.strictEqual(results2[0].age, 31);
		});

		it("should prevent cache pollution by mutation in immutable mode", async () => {
			const store = new Haro({ index: ["name"], immutable: true, cache: true });
			store.set("user1", { id: "user1", name: "John", age: 30 });

			const results1 = await store.where({ name: "John" });

			try {
				results1[0].age = 31;
			} catch {}

			const results2 = await store.where({ name: "John" });
			assert.strictEqual(results2[0].age, 30);
		});
	});

	describe("Cache statistics", () => {
		it("should track cache hits", async () => {
			const store = new Haro({ index: ["name"], cache: true });
			store.set("user1", { id: "user1", name: "John" });

			await store.where({ name: "John" });
			await store.where({ name: "John" });

			const stats = store.getCacheStats();
			assert.strictEqual(stats.hits, 1);
		});

		it("should track cache misses", async () => {
			const store = new Haro({ index: ["name"], cache: true });
			store.set("user1", { id: "user1", name: "John" });

			await store.where({ name: "John" });
			await store.where({ name: "Jane" });

			const stats = store.getCacheStats();
			assert.strictEqual(stats.misses, 2);
		});

		it("should return null when cache disabled", () => {
			const store = new Haro({ index: ["name"], cache: false });
			assert.strictEqual(store.getCacheStats(), null);
		});

		it("should track cache sets", async () => {
			const store = new Haro({ index: ["name"], cache: true });
			store.set("user1", { id: "user1", name: "John" });

			await store.where({ name: "John" });
			await store.where({ name: "Jane" });

			const stats = store.getCacheStats();
			assert.strictEqual(stats.sets, 2);
		});
	});

	describe("LRU eviction", () => {
		it("should evict oldest entry when cache is full", async () => {
			const store = new Haro({ index: ["name"], cache: true, cacheSize: 2 });
			store.set("user1", { id: "user1", name: "John" });
			store.set("user2", { id: "user2", name: "Jane" });
			store.set("user3", { id: "user3", name: "Bob" });

			await store.where({ name: "John" });
			await store.where({ name: "Jane" });
			await store.where({ name: "Bob" });

			assert.strictEqual(store.getCacheSize(), 2);

			const stats = store.getCacheStats();
			assert.strictEqual(stats.evictions, 1);
		});

		it("should update LRU order on cache hit", async () => {
			const store = new Haro({ index: ["name"], cache: true, cacheSize: 2 });
			store.set("user1", { id: "user1", name: "John" });
			store.set("user2", { id: "user2", name: "Jane" });

			await store.where({ name: "John" });
			await store.where({ name: "John" });

			assert.strictEqual(store.getCacheSize(), 1);
		});
	});

	describe("Multi-domain keys", () => {
		let store;

		beforeEach(() => {
			store = new Haro({ index: ["name"], cache: true });
			store.set("user1", { id: "user1", name: "John" });
		});

		it("should use separate cache for search and where", async () => {
			await store.search("John", "name");
			await store.where({ name: "John" });

			assert.strictEqual(store.getCacheSize(), 2);
		});

		it("should prevent key collision between methods", async () => {
			const searchResults = await store.search("John", "name");
			const whereResults = await store.where({ name: "John" });

			assert.strictEqual(searchResults.length, 1);
			assert.strictEqual(whereResults.length, 1);
			assert.strictEqual(searchResults[0].name, "John");
			assert.strictEqual(whereResults[0].name, "John");
		});
	});

	describe("Cache control methods", () => {
		it("should clear cache manually", async () => {
			const store = new Haro({ index: ["name"], cache: true });
			store.set("user1", { id: "user1", name: "John" });

			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);

			store.clearCache();
			assert.strictEqual(store.getCacheSize(), 0);
		});

		it("should return cache size", async () => {
			const store = new Haro({ index: ["name"], cache: true });
			store.set("user1", { id: "user1", name: "John" });

			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 1);
		});

		it("should return 0 when cache disabled", () => {
			const store = new Haro({ index: ["name"], cache: false });
			assert.strictEqual(store.getCacheSize(), 0);
		});
	});

	describe("Cache disabled", () => {
		it("should not cache results when cache is disabled", async () => {
			const store = new Haro({ index: ["name"], cache: false });
			store.set("user1", { id: "user1", name: "John" });

			await store.where({ name: "John" });
			assert.strictEqual(store.getCacheSize(), 0);
		});

		it("should return results without caching", async () => {
			const store = new Haro({ index: ["name"], cache: false });
			store.set("user1", { id: "user1", name: "John" });

			const results = await store.where({ name: "John" });
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].name, "John");
		});
	});
});
