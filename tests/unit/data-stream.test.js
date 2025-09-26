import assert from "node:assert";
import { describe, it } from "mocha";
import { DataStream } from "../../src/data-stream.js";

/**
 * Helper function to create an array-based iterator
 * @param {Array} items - Items to iterate over
 * @returns {Object} Iterator object
 */
function createArrayIterator(items) {
	let index = 0;

	return {
		next() {
			if (index >= items.length) {
				return { done: true };
			}
			return { value: items[index++], done: false };
		}
	};
}

/**
 * Helper function to create an empty iterator
 * @returns {Object} Empty iterator object
 */
function createEmptyIterator() {
	return {
		next() {
			return { done: true };
		}
	};
}

/**
 * Helper function to create an infinite iterator (for testing limits)
 * @param {Function} generator - Function to generate values
 * @returns {Object} Iterator object
 */
function createInfiniteIterator(generator = (i) => i) {
	let index = 0;

	return {
		next() {
			return { value: generator(index++), done: false };
		}
	};
}

/**
 * Tests for DataStream class
 */
describe("DataStream", () => {
	describe("Constructor", () => {
		/**
		 * Test basic constructor with iterator
		 */
		it("should create stream with iterator and default options", () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			assert.strictEqual(stream.iterator, iterator);
			assert.strictEqual(stream.options.batchSize, 1000);
			assert.strictEqual(stream.options.bufferSize, 10000);
			assert.deepStrictEqual(stream.buffer, []);
			assert.strictEqual(stream.ended, false);
			assert.strictEqual(stream.position, 0);
		});

		/**
		 * Test constructor with custom options
		 */
		it("should create stream with custom options", () => {
			const iterator = createArrayIterator([1, 2, 3]);
			const options = {
				batchSize: 50,
				bufferSize: 500,
				customOption: "test"
			};
			const stream = new DataStream(iterator, options);

			assert.strictEqual(stream.options.batchSize, 50);
			assert.strictEqual(stream.options.bufferSize, 500);
			assert.strictEqual(stream.options.customOption, "test");
		});

		/**
		 * Test constructor with partial options override
		 */
		it("should merge custom options with defaults", () => {
			const iterator = createArrayIterator([1, 2, 3]);
			const options = { batchSize: 200 };
			const stream = new DataStream(iterator, options);

			assert.strictEqual(stream.options.batchSize, 200);
			assert.strictEqual(stream.options.bufferSize, 10000); // Default value
		});

		/**
		 * Test constructor initializes state correctly
		 */
		it("should initialize stream state correctly", () => {
			const iterator = createArrayIterator([1, 2, 3]);
			const stream = new DataStream(iterator);

			assert.ok(Array.isArray(stream.buffer));
			assert.strictEqual(stream.buffer.length, 0);
			assert.strictEqual(stream.ended, false);
			assert.strictEqual(stream.position, 0);
		});
	});

	describe("read()", () => {
		/**
		 * Test reading with default batch size
		 */
		it("should read records with default batch size", async () => {
			const items = Array.from({ length: 2000 }, (_, i) => ({ id: i, value: `item${i}` }));
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			const batch = await stream.read();

			assert.strictEqual(batch.length, 1000); // Default batch size
			assert.deepStrictEqual(batch[0], { id: 0, value: "item0" });
			assert.deepStrictEqual(batch[999], { id: 999, value: "item999" });
			assert.strictEqual(stream.position, 1000);
			assert.strictEqual(stream.ended, false);
		});

		/**
		 * Test reading with custom batch size
		 */
		it("should read records with custom batch size", async () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			const batch = await stream.read(3);

			assert.strictEqual(batch.length, 3);
			assert.deepStrictEqual(batch, [1, 2, 3]);
			assert.strictEqual(stream.position, 3);
		});

		/**
		 * Test reading from empty iterator
		 */
		it("should return empty batch from empty iterator", async () => {
			const iterator = createEmptyIterator();
			const stream = new DataStream(iterator);

			const batch = await stream.read();

			assert.deepStrictEqual(batch, []);
			assert.strictEqual(stream.ended, true);
			assert.strictEqual(stream.position, 0);
		});

		/**
		 * Test reading when stream is already ended
		 */
		it("should return empty batch when stream is ended", async () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			// Read all items first
			await stream.read(5);
			assert.strictEqual(stream.ended, true);

			// Try to read again
			const batch = await stream.read();
			assert.deepStrictEqual(batch, []);
		});

		/**
		 * Test reading less than requested when iterator ends
		 */
		it("should return fewer records when iterator ends mid-batch", async () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			const batch = await stream.read(5);

			assert.strictEqual(batch.length, 3);
			assert.deepStrictEqual(batch, [1, 2, 3]);
			assert.strictEqual(stream.ended, true);
			assert.strictEqual(stream.position, 3);
		});

		/**
		 * Test multiple consecutive reads
		 */
		it("should handle multiple consecutive reads", async () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			const batch1 = await stream.read(3);
			const batch2 = await stream.read(4);
			const batch3 = await stream.read(5);

			assert.deepStrictEqual(batch1, [1, 2, 3]);
			assert.deepStrictEqual(batch2, [4, 5, 6, 7]);
			assert.deepStrictEqual(batch3, [8, 9, 10]);
			assert.strictEqual(stream.position, 10);
			assert.strictEqual(stream.ended, true);
		});

		/**
		 * Test reading with zero size
		 */
		it("should return empty batch for zero size", async () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			const batch = await stream.read(0);

			assert.deepStrictEqual(batch, []);
			assert.strictEqual(stream.position, 0);
			assert.strictEqual(stream.ended, false);
		});
	});

	describe("readAll()", () => {
		/**
		 * Test reading all records from stream
		 */
		it("should read all records from stream", async () => {
			const items = [1, 2, 3, 4, 5];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator, { batchSize: 2 });

			const allRecords = await stream.readAll();

			assert.deepStrictEqual(allRecords, [1, 2, 3, 4, 5]);
			assert.strictEqual(stream.ended, true);
			assert.strictEqual(stream.position, 5);
		});

		/**
		 * Test reading all from empty iterator
		 */
		it("should return empty array from empty iterator", async () => {
			const iterator = createEmptyIterator();
			const stream = new DataStream(iterator);

			const allRecords = await stream.readAll();

			assert.deepStrictEqual(allRecords, []);
			assert.strictEqual(stream.ended, true);
		});

		/**
		 * Test reading all with custom batch size
		 */
		it("should read all records with custom batch size", async () => {
			const items = Array.from({ length: 100 }, (_, i) => i);
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator, { batchSize: 7 });

			const allRecords = await stream.readAll();

			assert.strictEqual(allRecords.length, 100);
			assert.deepStrictEqual(allRecords, items);
			assert.strictEqual(stream.ended, true);
		});

		/**
		 * Test readAll after partial read
		 */
		it("should read remaining records after partial read", async () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator, { batchSize: 3 });

			const firstBatch = await stream.read();
			const remaining = await stream.readAll();

			assert.deepStrictEqual(firstBatch, [1, 2, 3]);
			assert.deepStrictEqual(remaining, [4, 5, 6, 7, 8]);
		});

		/**
		 * Test readAll when stream is already ended
		 */
		it("should return empty array when stream is already ended", async () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			await stream.readAll(); // Read everything first
			const result = await stream.readAll(); // Try again

			assert.deepStrictEqual(result, []);
		});
	});

	describe("map()", () => {
		/**
		 * Test basic transformation with map
		 */
		it("should transform stream data with map function", async () => {
			const items = [1, 2, 3, 4, 5];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const transformedStream = stream.map(x => x * 2);

			const result = await transformedStream.readAll();

			assert.deepStrictEqual(result, [2, 4, 6, 8, 10]);
		});

		/**
		 * Test map with object transformation
		 */
		it("should transform objects with map function", async () => {
			const items = [
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
				{ id: 3, name: "Charlie" }
			];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const transformedStream = stream.map(user => ({ ...user, active: true }));

			const result = await transformedStream.readAll();

			assert.strictEqual(result.length, 3);
			assert.deepStrictEqual(result[0], { id: 1, name: "Alice", active: true });
			assert.deepStrictEqual(result[1], { id: 2, name: "Bob", active: true });
			assert.deepStrictEqual(result[2], { id: 3, name: "Charlie", active: true });
		});

		/**
		 * Test map returns new DataStream instance
		 */
		it("should return new DataStream instance", () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const transformedStream = stream.map(x => x * 2);

			assert.ok(transformedStream instanceof DataStream);
			assert.notStrictEqual(transformedStream, stream);
			assert.deepStrictEqual(transformedStream.options, stream.options);
		});

		/**
		 * Test map with empty stream
		 */
		it("should handle empty stream", async () => {
			const iterator = createEmptyIterator();
			const stream = new DataStream(iterator);
			const transformedStream = stream.map(x => x * 2);

			const result = await transformedStream.readAll();

			assert.deepStrictEqual(result, []);
		});

		/**
		 * Test chained map transformations
		 */
		it("should support chained map transformations", async () => {
			const items = [1, 2, 3, 4];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const transformedStream = stream
				.map(x => x * 2)
				.map(x => x + 1)
				.map(x => `item${x}`);

			const result = await transformedStream.readAll();

			assert.deepStrictEqual(result, ["item3", "item5", "item7", "item9"]);
		});

		/**
		 * Test map preserves options
		 */
		it("should preserve options in transformed stream", () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const options = { batchSize: 50, bufferSize: 500 };
			const stream = new DataStream(iterator, options);
			const transformedStream = stream.map(x => x * 2);

			assert.deepStrictEqual(transformedStream.options, options);
		});
	});

	describe("filter()", () => {
		/**
		 * Test basic filtering
		 */
		it("should filter stream data with predicate function", async () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const filteredStream = stream.filter(x => x % 2 === 0);

			const result = await filteredStream.readAll();

			assert.deepStrictEqual(result, [2, 4, 6, 8, 10]);
		});

		/**
		 * Test filter with object predicate
		 */
		it("should filter objects with predicate function", async () => {
			const items = [
				{ id: 1, age: 25, active: true },
				{ id: 2, age: 17, active: false },
				{ id: 3, age: 30, active: true },
				{ id: 4, age: 16, active: true }
			];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const filteredStream = stream.filter(user => user.age >= 18 && user.active);

			const result = await filteredStream.readAll();

			assert.strictEqual(result.length, 2);
			assert.strictEqual(result[0].id, 1);
			assert.strictEqual(result[1].id, 3);
		});

		/**
		 * Test filter returns new DataStream instance
		 */
		it("should return new DataStream instance", () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const filteredStream = stream.filter(x => x > 1);

			assert.ok(filteredStream instanceof DataStream);
			assert.notStrictEqual(filteredStream, stream);
			assert.deepStrictEqual(filteredStream.options, stream.options);
		});

		/**
		 * Test filter with no matches
		 */
		it("should return empty result when no items match", async () => {
			const items = [1, 2, 3, 4, 5];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const filteredStream = stream.filter(x => x > 10);

			const result = await filteredStream.readAll();

			assert.deepStrictEqual(result, []);
		});

		/**
		 * Test filter with empty stream
		 */
		it("should handle empty stream", async () => {
			const iterator = createEmptyIterator();
			const stream = new DataStream(iterator);
			const filteredStream = stream.filter(x => x > 0);

			const result = await filteredStream.readAll();

			assert.deepStrictEqual(result, []);
		});

		/**
		 * Test filter all items match
		 */
		it("should return all items when all match predicate", async () => {
			const items = [2, 4, 6, 8];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const filteredStream = stream.filter(x => x % 2 === 0);

			const result = await filteredStream.readAll();

			assert.deepStrictEqual(result, [2, 4, 6, 8]);
		});

		/**
		 * Test chained filters
		 */
		it("should support chained filters", async () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const filteredStream = stream
				.filter(x => x % 2 === 0) // Even numbers: [2, 4, 6, 8, 10, 12]
				.filter(x => x > 5); // Greater than 5: [6, 8, 10, 12]

			const result = await filteredStream.readAll();

			assert.deepStrictEqual(result, [6, 8, 10, 12]);
		});

		/**
		 * Test filter preserves options
		 */
		it("should preserve options in filtered stream", () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const options = { batchSize: 50, bufferSize: 500 };
			const stream = new DataStream(iterator, options);
			const filteredStream = stream.filter(x => x > 1);

			assert.deepStrictEqual(filteredStream.options, options);
		});
	});

	describe("take()", () => {
		/**
		 * Test basic take functionality
		 */
		it("should limit stream to specified number of records", async () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const limitedStream = stream.take(5);

			const result = await limitedStream.readAll();

			assert.deepStrictEqual(result, [1, 2, 3, 4, 5]);
		});

		/**
		 * Test take with zero limit
		 */
		it("should return empty result for zero limit", async () => {
			const items = [1, 2, 3, 4, 5];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const limitedStream = stream.take(0);

			const result = await limitedStream.readAll();

			assert.deepStrictEqual(result, []);
		});

		/**
		 * Test take returns new DataStream instance
		 */
		it("should return new DataStream instance", () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const limitedStream = stream.take(2);

			assert.ok(limitedStream instanceof DataStream);
			assert.notStrictEqual(limitedStream, stream);
			assert.deepStrictEqual(limitedStream.options, stream.options);
		});

		/**
		 * Test take with limit larger than available records
		 */
		it("should return all available records when limit exceeds stream size", async () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const limitedStream = stream.take(10);

			const result = await limitedStream.readAll();

			assert.deepStrictEqual(result, [1, 2, 3]);
		});

		/**
		 * Test take with empty stream
		 */
		it("should handle empty stream", async () => {
			const iterator = createEmptyIterator();
			const stream = new DataStream(iterator);
			const limitedStream = stream.take(5);

			const result = await limitedStream.readAll();

			assert.deepStrictEqual(result, []);
		});

		/**
		 * Test take with infinite stream
		 */
		it("should limit infinite stream", async () => {
			const iterator = createInfiniteIterator(i => i + 1);
			const stream = new DataStream(iterator);
			const limitedStream = stream.take(3);

			const result = await limitedStream.readAll();

			assert.deepStrictEqual(result, [1, 2, 3]);
		});

		/**
		 * Test chained take operations
		 */
		it("should support chained take operations", async () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const limitedStream = stream.take(7).take(3);

			const result = await limitedStream.readAll();

			assert.deepStrictEqual(result, [1, 2, 3]);
		});

		/**
		 * Test take combined with other operations
		 */
		it("should work with map and filter operations", async () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const transformedStream = stream
				.filter(x => x % 2 === 0) // [2, 4, 6, 8, 10]
				.map(x => x * 2) // [4, 8, 12, 16, 20]
				.take(3); // [4, 8, 12]

			const result = await transformedStream.readAll();

			assert.deepStrictEqual(result, [4, 8, 12]);
		});

		/**
		 * Test take preserves options
		 */
		it("should preserve options in limited stream", () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const options = { batchSize: 50, bufferSize: 500 };
			const stream = new DataStream(iterator, options);
			const limitedStream = stream.take(2);

			assert.deepStrictEqual(limitedStream.options, options);
		});
	});

	describe("getStats()", () => {
		/**
		 * Test initial statistics
		 */
		it("should return correct initial statistics", () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const options = { batchSize: 50, bufferSize: 500 };
			const stream = new DataStream(iterator, options);

			const stats = stream.getStats();

			assert.strictEqual(stats.position, 0);
			assert.strictEqual(stats.ended, false);
			assert.strictEqual(stats.bufferSize, 0);
			assert.deepStrictEqual(stats.options, options);
		});

		/**
		 * Test statistics after reading
		 */
		it("should return updated statistics after reading", async () => {
			const items = [1, 2, 3, 4, 5];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			await stream.read(3);
			const stats = stream.getStats();

			assert.strictEqual(stats.position, 3);
			assert.strictEqual(stats.ended, false);
			assert.strictEqual(stats.bufferSize, 0);
		});

		/**
		 * Test statistics when stream is ended
		 */
		it("should return correct statistics when stream is ended", async () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			await stream.readAll();
			const stats = stream.getStats();

			assert.strictEqual(stats.position, 3);
			assert.strictEqual(stats.ended, true);
			assert.strictEqual(stats.bufferSize, 0);
		});

		/**
		 * Test statistics with empty stream
		 */
		it("should return correct statistics for empty stream", async () => {
			const iterator = createEmptyIterator();
			const stream = new DataStream(iterator);

			await stream.read();
			const stats = stream.getStats();

			assert.strictEqual(stats.position, 0);
			assert.strictEqual(stats.ended, true);
			assert.strictEqual(stats.bufferSize, 0);
		});

		/**
		 * Test statistics with custom options
		 */
		it("should include custom options in statistics", () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const options = {
				batchSize: 25,
				bufferSize: 200,
				customProperty: "test",
				nested: { value: 42 }
			};
			const stream = new DataStream(iterator, options);

			const stats = stream.getStats();

			assert.deepStrictEqual(stats.options, options);
			assert.strictEqual(stats.options.customProperty, "test");
			assert.strictEqual(stats.options.nested.value, 42);
		});

		/**
		 * Test statistics return object structure
		 */
		it("should return object with required properties", () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			const stats = stream.getStats();

			assert.ok(typeof stats === "object");
			assert.ok(stats.hasOwnProperty("position"));
			assert.ok(stats.hasOwnProperty("ended"));
			assert.ok(stats.hasOwnProperty("bufferSize"));
			assert.ok(stats.hasOwnProperty("options"));
			assert.ok(typeof stats.position === "number");
			assert.ok(typeof stats.ended === "boolean");
			assert.ok(typeof stats.bufferSize === "number");
			assert.ok(typeof stats.options === "object");
		});
	});

	describe("Integration Tests", () => {
		/**
		 * Test complex stream pipeline
		 */
		it("should support complex stream operations pipeline", async () => {
			const users = [
				{ id: 1, name: "Alice", age: 25, role: "admin", active: true },
				{ id: 2, name: "Bob", age: 17, role: "user", active: false },
				{ id: 3, name: "Charlie", age: 30, role: "user", active: true },
				{ id: 4, name: "Diana", age: 28, role: "admin", active: true },
				{ id: 5, name: "Eve", age: 22, role: "user", active: true },
				{ id: 6, name: "Frank", age: 35, role: "admin", active: false }
			];
			const iterator = createArrayIterator(users);
			const stream = new DataStream(iterator, { batchSize: 2 });

			const result = await stream
				.filter(user => user.active && user.age >= 18) // Active adults
				.map(user => ({ ...user, displayName: `${user.name} (${user.role})` })) // Add display name
				.filter(user => user.role === "admin" || user.age < 30) // Admins or young users
				.take(3) // Limit to 3 results
				.readAll();

			assert.strictEqual(result.length, 3);
			assert.strictEqual(result[0].name, "Alice");
			assert.strictEqual(result[0].displayName, "Alice (admin)");
			assert.strictEqual(result[1].name, "Diana");
			assert.strictEqual(result[1].displayName, "Diana (admin)");
			assert.strictEqual(result[2].name, "Eve");
			assert.strictEqual(result[2].displayName, "Eve (user)");
		});

		/**
		 * Test stream with batched reading
		 */
		it("should handle batched reading correctly", async () => {
			const items = Array.from({ length: 100 }, (_, i) => ({ id: i, value: i * 2 }));
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator, { batchSize: 10 });

			const allBatches = [];
			let batch;
			do {
				batch = await stream.read();
				if (batch.length > 0) {
					allBatches.push(batch);
				}
			} while (batch.length > 0);

			assert.strictEqual(allBatches.length, 10); // 100 items / 10 per batch
			assert.strictEqual(allBatches[0].length, 10);
			assert.strictEqual(allBatches[9].length, 10);
			
			// Verify all items are present
			const allItems = allBatches.flat();
			assert.strictEqual(allItems.length, 100);
			assert.strictEqual(allItems[0].id, 0);
			assert.strictEqual(allItems[99].id, 99);
		});

		/**
		 * Test stream statistics tracking throughout operations
		 */
		it("should track statistics correctly throughout operations", async () => {
			const items = Array.from({ length: 50 }, (_, i) => i + 1);
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator, { batchSize: 5 });

			// Initial stats
			let stats = stream.getStats();
			assert.strictEqual(stats.position, 0);
			assert.strictEqual(stats.ended, false);

			// Read some data
			await stream.read(15);
			stats = stream.getStats();
			assert.strictEqual(stats.position, 15);
			assert.strictEqual(stats.ended, false);

			// Read more data
			await stream.read(20);
			stats = stream.getStats();
			assert.strictEqual(stats.position, 35);
			assert.strictEqual(stats.ended, false);

			// Read remaining data
			await stream.readAll();
			stats = stream.getStats();
			assert.strictEqual(stats.position, 50);
			assert.strictEqual(stats.ended, true);
		});

		/**
		 * Test stream operations preserve original iterator independence
		 */
		it("should maintain independence between original and transformed streams", async () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const iterator1 = createArrayIterator(items);
			const iterator2 = createArrayIterator(items);
			
			const stream1 = new DataStream(iterator1);
			const stream2 = new DataStream(iterator2);
			const mappedStream = stream2.map(x => x * 2);

			// Read from original stream
			const original = await stream1.readAll();
			
			// Read from mapped stream
			const mapped = await mappedStream.readAll();

			assert.deepStrictEqual(original, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
			assert.deepStrictEqual(mapped, [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
		});
	});

	describe("Edge Cases and Error Conditions", () => {
		/**
		 * Test stream with very large batch size
		 */
		it("should handle very large batch sizes", async () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			const batch = await stream.read(Number.MAX_SAFE_INTEGER);

			assert.deepStrictEqual(batch, [1, 2, 3]);
			assert.strictEqual(stream.ended, true);
		});

		/**
		 * Test stream with negative batch size
		 */
		it("should handle negative batch size gracefully", async () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			const batch = await stream.read(-5);

			assert.deepStrictEqual(batch, []);
			assert.strictEqual(stream.ended, false);
		});

		/**
		 * Test stream with fractional batch size
		 */
		it("should handle fractional batch size", async () => {
			const items = [1, 2, 3, 4, 5];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);

			const batch = await stream.read(2.7);

			assert.strictEqual(batch.length, 3); // Fractional numbers allow up to the next integer
			assert.deepStrictEqual(batch, [1, 2, 3]);
		});

		/**
		 * Test iterator that throws errors
		 */
		it("should propagate iterator errors", async () => {
			const errorIterator = {
				next() {
					throw new Error("Iterator error");
				}
			};
			const stream = new DataStream(errorIterator);

			await assert.rejects(async () => {
				await stream.read();
			}, Error, "Iterator error");
		});

		/**
		 * Test iterator with invalid return values
		 */
		it("should handle iterator with missing done property", async () => {
			const badIterator = {
				callCount: 0,
				next() {
					this.callCount++;
					if (this.callCount === 1) {
						return { value: "test" }; // Missing done property
					}
					return { done: true };
				}
			};
			const stream = new DataStream(badIterator);

			const batch = await stream.read(1);

			assert.deepStrictEqual(batch, ["test"]);
		});

		/**
		 * Test transform function that throws errors
		 */
		it("should propagate map transform errors", async () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const mappedStream = stream.map(() => {
				throw new Error("Transform error");
			});

			await assert.rejects(async () => {
				await mappedStream.read(1);
			}, Error, "Transform error");
		});

		/**
		 * Test filter predicate that throws errors
		 */
		it("should propagate filter predicate errors", async () => {
			const items = [1, 2, 3];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const filteredStream = stream.filter(() => {
				throw new Error("Filter error");
			});

			await assert.rejects(async () => {
				await filteredStream.read(1);
			}, Error, "Filter error");
		});

		/**
		 * Test take with negative limit
		 */
		it("should handle negative take limit", async () => {
			const items = [1, 2, 3, 4, 5];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const limitedStream = stream.take(-3);

			const result = await limitedStream.readAll();

			assert.deepStrictEqual(result, []);
		});

		/**
		 * Test take with fractional limit
		 */
		it("should handle fractional take limit", async () => {
			const items = [1, 2, 3, 4, 5];
			const iterator = createArrayIterator(items);
			const stream = new DataStream(iterator);
			const limitedStream = stream.take(2.8);

			const result = await limitedStream.readAll();

			assert.deepStrictEqual(result, [1, 2, 3]); // Fractional numbers allow up to the next integer
		});
	});
});
