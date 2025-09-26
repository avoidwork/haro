import { performance } from "node:perf_hooks";
import { haro } from "../dist/haro.js";

/**
 * Generates test data with various indexable fields
 * @param {number} size - Number of records to generate
 * @returns {Array} Array of test records optimized for indexing
 */
function generateIndexTestData (size) {
	const data = [];
	const categories = ["A", "B", "C", "D", "E"];
	const statuses = ["active", "inactive", "pending", "suspended"];
	const priorities = ["low", "medium", "high", "urgent"];
	const regions = ["north", "south", "east", "west"];

	for (let i = 0; i < size; i++) {
		data.push({
			id: i,
			category: categories[i % categories.length],
			status: statuses[i % statuses.length],
			priority: priorities[i % priorities.length],
			region: regions[i % regions.length],
			userId: Math.floor(i / 10), // Creates groups of 10
			projectId: Math.floor(i / 100), // Creates groups of 100
			timestamp: new Date(2024, 0, 1, 0, 0, 0, i * 1000),
			score: Math.floor(Math.random() * 1000),
			tags: [
				`tag${i % 20}`,
				`category${i % 10}`,
				`type${i % 5}`
			],
			metadata: {
				level: Math.floor(Math.random() * 10),
				department: `Dept${i % 15}`,
				location: `Location${i % 25}`
			},
			flags: {
				isPublic: Math.random() > 0.5,
				isVerified: Math.random() > 0.3,
				isUrgent: Math.random() > 0.9
			}
		});
	}

	return data;
}

/**
 * Runs a benchmark test and returns timing information
 * @param {string} name - Name of the test
 * @param {Function} fn - Function to benchmark
 * @param {number} iterations - Number of iterations to run
 * @returns {Object} Benchmark results
 */
function benchmark (name, fn, iterations = 100) {
	const start = performance.now();
	for (let i = 0; i < iterations; i++) {
		fn();
	}
	const end = performance.now();
	const total = end - start;
	const avgTime = total / iterations;

	return {
		name,
		iterations,
		totalTime: total,
		avgTime,
		opsPerSecond: Math.floor(1000 / avgTime)
	};
}

/**
 * Benchmarks single field index creation and reindexing
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkSingleIndexOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Initial index creation during construction
		const initialIndexResult = benchmark(`CREATE initial indexes (${size} records)`, () => {
			const store = haro(testData, {
				index: ["category", "status", "priority", "region", "userId"]
			});

			return store;
		}, 10);
		results.push(initialIndexResult);

		// Reindex single field
		const store = haro(testData, { index: ["category"] });
		const reindexSingleResult = benchmark(`REINDEX single field (${size} records)`, () => {
			store.reindex("status");
		}, 10);
		results.push(reindexSingleResult);

		// Reindex all fields
		const reindexAllResult = benchmark(`REINDEX all fields (${size} records)`, () => {
			store.reindex();
		}, 5);
		results.push(reindexAllResult);
	});

	return results;
}

/**
 * Benchmarks composite index operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkCompositeIndexOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Create composite indexes
		const compositeIndexResult = benchmark(`CREATE composite indexes (${size} records)`, () => {
			const store = haro(testData, {
				index: [
					"category|status",
					"region|priority",
					"userId|projectId",
					"category|status|priority",
					"region|category|status"
				]
			});

			return store;
		}, 5);
		results.push(compositeIndexResult);

		// Query composite indexes
		const store = haro(testData, {
			index: ["category|status", "region|priority", "userId|projectId"]
		});

		const queryCompositeResult = benchmark(`QUERY composite index (${size} records)`, () => {
			store.find({ category: "A", status: "active" });
		});
		results.push(queryCompositeResult);

		const queryTripleCompositeResult = benchmark(`QUERY triple composite (${size} records)`, () => {
			store.find({ category: "A", status: "active", priority: "high" });
		});
		results.push(queryTripleCompositeResult);
	});

	return results;
}

/**
 * Benchmarks array field indexing
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkArrayIndexOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Create array field indexes
		const arrayIndexResult = benchmark(`CREATE array indexes (${size} records)`, () => {
			const store = haro(testData, {
				index: ["tags", "tags|category", "tags|status"]
			});

			return store;
		}, 5);
		results.push(arrayIndexResult);

		// Query array indexes
		const store = haro(testData, { index: ["tags"] });
		const queryArrayResult = benchmark(`QUERY array index (${size} records)`, () => {
			store.find({ tags: "tag1" });
		});
		results.push(queryArrayResult);

		// Search array indexes
		const searchArrayResult = benchmark(`SEARCH array index (${size} records)`, () => {
			store.search("tag1", "tags");
		});
		results.push(searchArrayResult);
	});

	return results;
}

/**
 * Benchmarks nested field indexing
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkNestedIndexOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Create nested field indexes (simulated with dot notation)
		const nestedIndexResult = benchmark(`CREATE nested indexes (${size} records)`, () => {
			const store = haro(testData, {
				index: ["metadata.level", "metadata.department", "flags.isPublic"]
			});

			return store;
		}, 5);
		results.push(nestedIndexResult);
	});

	return results;
}

/**
 * Benchmarks index performance under different data modification patterns
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkIndexModificationOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);
		const store = haro(testData, {
			index: ["category", "status", "priority", "category|status", "userId"]
		});

		// Benchmark SET operations with existing indexes
		const setWithIndexResult = benchmark(`SET with indexes (${size} records)`, () => {
			const randomId = Math.floor(Math.random() * size);
			store.set(randomId, {
				...testData[randomId],
				category: "Z",
				status: "updated",
				timestamp: new Date()
			});
		}, 100);
		results.push(setWithIndexResult);

		// Benchmark DELETE operations with existing indexes
		const deleteWithIndexResult = benchmark(`DELETE with indexes (${size} records)`, () => {
			const keys = Array.from(store.keys());
			if (keys.length > 0) {
				const randomKey = keys[Math.floor(Math.random() * keys.length)];
				try {
					store.delete(randomKey);
				} catch (e) { // eslint-disable-line no-unused-vars
					// Record might already be deleted
				}
			}
		}, 50);
		results.push(deleteWithIndexResult);

		// Benchmark BATCH operations with existing indexes
		const batchWithIndexResult = benchmark(`BATCH with indexes (${size} records)`, () => {
			const batchData = testData.slice(0, 10).map(item => ({
				...item,
				category: "BATCH",
				status: "batch_updated"
			}));
			store.batch(batchData, "set");
		}, 10);
		results.push(batchWithIndexResult);
	});

	return results;
}

/**
 * Benchmarks index memory usage and export/import operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkIndexMemoryOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);
		const store = haro(testData, {
			index: ["category", "status", "priority", "region", "userId", "category|status", "region|priority"]
		});

		// Benchmark index dump operations
		const dumpIndexResult = benchmark(`DUMP indexes (${size} records)`, () => {
			store.dump("indexes");
		}, 10);
		results.push(dumpIndexResult);

		// Benchmark index override operations
		const indexData = store.dump("indexes");
		const overrideIndexResult = benchmark(`OVERRIDE indexes (${size} records)`, () => {
			const newStore = haro();
			newStore.override(indexData, "indexes");
		}, 10);
		results.push(overrideIndexResult);

		// Benchmark index size measurement
		const indexSizeResult = benchmark(`INDEX size check (${size} records)`, () => {
			const indexes = store.indexes;
			let totalSize = 0;
			indexes.forEach(index => {
				index.forEach(set => {
					totalSize += set.size;
				});
			});

			return totalSize;
		}, 100);
		results.push(indexSizeResult);
	});

	return results;
}

/**
 * Benchmarks index performance comparison with and without indexes
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkIndexComparison (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Store without indexes
		const storeNoIndex = haro(testData);
		const filterNoIndexResult = benchmark(`FILTER no index (${size} records)`, () => {
			storeNoIndex.filter(record => record.category === "A");
		}, 10);
		results.push(filterNoIndexResult);

		// Store with indexes
		const storeWithIndex = haro(testData, { index: ["category"] });
		const findWithIndexResult = benchmark(`FIND with index (${size} records)`, () => {
			storeWithIndex.find({ category: "A" });
		}, 100);
		results.push(findWithIndexResult);

		// Complex query without indexes
		const complexFilterResult = benchmark(`COMPLEX filter no index (${size} records)`, () => {
			storeNoIndex.filter(record =>
				record.category === "A" &&
        record.status === "active" &&
        record.priority === "high"
			);
		}, 10);
		results.push(complexFilterResult);

		// Complex query with indexes
		const storeComplexIndex = haro(testData, { index: ["category", "status", "priority", "category|status|priority"] });
		const complexFindResult = benchmark(`COMPLEX find with index (${size} records)`, () => {
			storeComplexIndex.find({
				category: "A",
				status: "active",
				priority: "high"
			});
		}, 100);
		results.push(complexFindResult);
	});

	return results;
}

/**
 * Prints benchmark results in a formatted table
 * @param {Array} results - Array of benchmark results
 */
function printResults (results) {
	console.log("\n=== INDEX OPERATIONS BENCHMARK RESULTS ===\n");

	console.log("Operation".padEnd(40) + "Iterations".padEnd(12) + "Total Time (ms)".padEnd(18) + "Avg Time (ms)".padEnd(16) + "Ops/Second");
	console.log("-".repeat(98));

	results.forEach(result => {
		const name = result.name.padEnd(40);
		const iterations = result.iterations.toString().padEnd(12);
		const totalTime = result.totalTime.toFixed(2).padEnd(18);
		const avgTime = result.avgTime.toFixed(4).padEnd(16);
		const opsPerSecond = result.opsPerSecond.toLocaleString();

		console.log(name + iterations + totalTime + avgTime + opsPerSecond);
	});

	console.log("\n");
}

/**
 * Main function to run all index operations benchmarks
 */
function runIndexOperationsBenchmarks () {
	console.log("📊 Running Index Operations Benchmarks...\n");

	const dataSizes = [1000, 10000, 50000];
	const allResults = [];

	console.log("Testing single index operations...");
	allResults.push(...benchmarkSingleIndexOperations(dataSizes));

	console.log("Testing composite index operations...");
	allResults.push(...benchmarkCompositeIndexOperations(dataSizes));

	console.log("Testing array index operations...");
	allResults.push(...benchmarkArrayIndexOperations(dataSizes));

	console.log("Testing nested index operations...");
	allResults.push(...benchmarkNestedIndexOperations(dataSizes));

	console.log("Testing index modification operations...");
	allResults.push(...benchmarkIndexModificationOperations(dataSizes));

	console.log("Testing index memory operations...");
	allResults.push(...benchmarkIndexMemoryOperations(dataSizes));

	console.log("Testing index comparison...");
	allResults.push(...benchmarkIndexComparison(dataSizes));

	printResults(allResults);

	return allResults;
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runIndexOperationsBenchmarks();
}

export { runIndexOperationsBenchmarks, generateIndexTestData };
