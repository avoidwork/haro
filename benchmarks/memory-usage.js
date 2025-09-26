import { performance } from "node:perf_hooks";
import { haro } from "../dist/haro.js";
import { generateIndexTestData } from "./index-operations.js";

/**
 * Gets current memory usage information
 * @returns {Object} Memory usage information
 */
function getMemoryUsage () {
	const memUsage = process.memoryUsage();

	return {
		rss: memUsage.rss / 1024 / 1024, // MB
		heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
		heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
		external: memUsage.external / 1024 / 1024, // MB
		arrayBuffers: memUsage.arrayBuffers / 1024 / 1024 // MB
	};
}

/**
 * Forces garbage collection if possible
 */
function forceGC () {
	if (global.gc) {
		global.gc();
	}
}

/**
 * Measures memory usage of a function
 * @param {Function} fn - Function to measure
 * @param {string} description - Description of the test
 * @returns {Object} Memory usage results
 */
function measureMemory (fn, description) {
	forceGC();
	const startMemory = getMemoryUsage();

	const startTime = performance.now();
	const result = fn();
	const endTime = performance.now();

	forceGC();
	const endMemory = getMemoryUsage();

	return {
		description,
		executionTime: endTime - startTime,
		memoryBefore: startMemory,
		memoryAfter: endMemory,
		memoryDelta: {
			rss: endMemory.rss - startMemory.rss,
			heapUsed: endMemory.heapUsed - startMemory.heapUsed,
			heapTotal: endMemory.heapTotal - startMemory.heapTotal,
			external: endMemory.external - startMemory.external,
			arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
		},
		result
	};
}

/**
 * Benchmarks memory usage during store creation
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of memory benchmark results
 */
function benchmarkCreationMemory (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Test basic store creation
		const basicCreationResult = measureMemory(() => {
			return haro(testData);
		}, `Basic store creation (${size} records)`);
		results.push(basicCreationResult);

		// Test store creation with indexes
		const indexedCreationResult = measureMemory(() => {
			return haro(testData, {
				index: ["category", "status", "priority", "region", "userId"]
			});
		}, `Indexed store creation (${size} records)`);
		results.push(indexedCreationResult);

		// Test store creation with complex indexes
		const complexIndexCreationResult = measureMemory(() => {
			return haro(testData, {
				index: [
					"category", "status", "priority", "region", "userId",
					"category|status", "region|priority", "userId|category",
					"category|status|priority"
				]
			});
		}, `Complex indexed store creation (${size} records)`);
		results.push(complexIndexCreationResult);

		// Test store creation with versioning
		const versioningCreationResult = measureMemory(() => {
			return haro(testData, {
				versioning: true,
				index: ["category", "status"]
			});
		}, `Versioning store creation (${size} records)`);
		results.push(versioningCreationResult);
	});

	return results;
}

/**
 * Benchmarks memory usage during data operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of memory benchmark results
 */
function benchmarkOperationMemory (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Test SET operations memory usage
		const setOperationResult = measureMemory(() => {
			const store = haro();
			for (let i = 0; i < Math.min(size, 1000); i++) {
				store.set(i, testData[i]);
			}

			return store;
		}, `SET operations memory (${Math.min(size, 1000)} records)`);
		results.push(setOperationResult);

		// Test BATCH operations memory usage
		const batchOperationResult = measureMemory(() => {
			const store = haro();
			store.batch(testData, "set");

			return store;
		}, `BATCH operations memory (${size} records)`);
		results.push(batchOperationResult);

		// Test DELETE operations memory usage
		const deleteOperationResult = measureMemory(() => {
			const store = haro(testData);
			const keys = Array.from(store.keys());
			for (let i = 0; i < Math.min(keys.length, 100); i++) {
				try {
					store.delete(keys[i]);
				} catch (e) { // eslint-disable-line no-unused-vars
					// Record might already be deleted
				}
			}

			return store;
		}, `DELETE operations memory (${Math.min(size, 100)} deletions)`);
		results.push(deleteOperationResult);

		// Test CLEAR operations memory usage
		const clearOperationResult = measureMemory(() => {
			const store = haro(testData);
			store.clear();

			return store;
		}, `CLEAR operations memory (${size} records)`);
		results.push(clearOperationResult);
	});

	return results;
}

/**
 * Benchmarks memory usage during query operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of memory benchmark results
 */
function benchmarkQueryMemory (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);
		const store = haro(testData, {
			index: ["category", "status", "priority", "category|status"]
		});

		// Test FIND operations memory usage
		const findOperationResult = measureMemory(() => {
			const results = []; // eslint-disable-line no-shadow
			for (let i = 0; i < 100; i++) {
				results.push(store.find({ category: "A" }));
			}

			return results;
		}, `FIND operations memory (${size} records, 100 queries)`);
		results.push(findOperationResult);

		// Test FILTER operations memory usage
		const filterOperationResult = measureMemory(() => {
			const results = []; // eslint-disable-line no-shadow
			for (let i = 0; i < 10; i++) {
				results.push(store.filter(record => record.category === "A" && record.status === "active"));
			}

			return results;
		}, `FILTER operations memory (${size} records, 10 queries)`);
		results.push(filterOperationResult);

		// Test SEARCH operations memory usage
		const searchOperationResult = measureMemory(() => {
			const results = []; // eslint-disable-line no-shadow
			for (let i = 0; i < 50; i++) {
				results.push(store.search("A", "category"));
			}

			return results;
		}, `SEARCH operations memory (${size} records, 50 queries)`);
		results.push(searchOperationResult);

		// Test MAP operations memory usage
		const mapOperationResult = measureMemory(() => {
			return store.map(record => ({
				id: record.id,
				category: record.category,
				status: record.status
			}));
		}, `MAP operations memory (${size} records)`);
		results.push(mapOperationResult);
	});

	return results;
}

/**
 * Benchmarks memory usage during index operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of memory benchmark results
 */
function benchmarkIndexMemory (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Test index creation memory usage
		const indexCreationResult = measureMemory(() => {
			const store = haro(testData);
			store.reindex("category");
			store.reindex("status");
			store.reindex("priority");

			return store;
		}, `Index creation memory (${size} records)`);
		results.push(indexCreationResult);

		// Test composite index creation memory usage
		const compositeIndexResult = measureMemory(() => {
			const store = haro(testData);
			store.reindex("category|status");
			store.reindex("region|priority");

			return store;
		}, `Composite index memory (${size} records)`);
		results.push(compositeIndexResult);

		// Test index dump memory usage
		const indexDumpResult = measureMemory(() => {
			const store = haro(testData, {
				index: ["category", "status", "priority", "category|status"]
			});

			return store.dump("indexes");
		}, `Index dump memory (${size} records)`);
		results.push(indexDumpResult);

		// Test index override memory usage
		const indexOverrideResult = measureMemory(() => {
			const store = haro(testData, {
				index: ["category", "status", "priority"]
			});
			const indexData = store.dump("indexes");
			const newStore = haro();
			newStore.override(indexData, "indexes");

			return newStore;
		}, `Index override memory (${size} records)`);
		results.push(indexOverrideResult);
	});

	return results;
}

/**
 * Benchmarks memory usage with versioning enabled
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of memory benchmark results
 */
function benchmarkVersioningMemory (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Test versioning store creation
		const versioningCreationResult = measureMemory(() => {
			return haro(testData, { versioning: true });
		}, `Versioning store creation (${size} records)`);
		results.push(versioningCreationResult);

		// Test versioning with updates
		const versioningUpdatesResult = measureMemory(() => {
			const store = haro(testData, { versioning: true });

			// Update records multiple times to create versions
			for (let i = 0; i < Math.min(size, 100); i++) {
				for (let version = 0; version < 5; version++) {
					store.set(i, {
						...testData[i],
						version: version,
						updated: new Date()
					});
				}
			}

			return store;
		}, `Versioning with updates (${Math.min(size, 100)} records, 5 versions each)`);
		results.push(versioningUpdatesResult);
	});

	return results;
}

/**
 * Benchmarks memory usage under stress conditions
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of memory benchmark results
 */
function benchmarkStressMemory (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Test rapid creation and destruction
		const rapidCycleResult = measureMemory(() => {
			const stores = [];
			for (let i = 0; i < 10; i++) {
				stores.push(haro(testData.slice(0, size / 10)));
			}

			// Clear all stores
			stores.forEach(store => store.clear());

			return stores;
		}, `Rapid store cycles (${size} records)`);
		results.push(rapidCycleResult);

		// Test memory with large result sets
		const largeResultSetResult = measureMemory(() => {
			const store = haro(testData, { index: ["category"] });
			const results = []; // eslint-disable-line no-shadow

			// Create multiple large result sets
			for (let i = 0; i < 5; i++) {
				results.push(store.toArray());
				results.push(store.dump("records"));
				results.push(store.dump("indexes"));
			}

			return results;
		}, `Large result sets (${size} records)`);
		results.push(largeResultSetResult);
	});

	return results;
}

/**
 * Analyzes memory growth over time
 * @param {number} dataSize - Size of test data
 * @returns {Object} Memory growth analysis
 */
function analyzeMemoryGrowth (dataSize) {
	const testData = generateIndexTestData(dataSize);
	const memorySnapshots = [];

	// Initial memory
	forceGC();
	memorySnapshots.push({
		operation: "Initial",
		memory: getMemoryUsage()
	});

	// Create store
	const store = haro();
	forceGC();
	memorySnapshots.push({
		operation: "Store created",
		memory: getMemoryUsage()
	});

	// Add data in batches
	const batchSize = Math.floor(dataSize / 10);
	for (let i = 0; i < 10; i++) {
		const batch = testData.slice(i * batchSize, (i + 1) * batchSize);
		store.batch(batch, "set");

		forceGC();
		memorySnapshots.push({
			operation: `Batch ${i + 1} added`,
			memory: getMemoryUsage()
		});
	}

	// Add indexes
	store.reindex("category");
	store.reindex("status");
	store.reindex("priority");

	forceGC();
	memorySnapshots.push({
		operation: "Indexes added",
		memory: getMemoryUsage()
	});

	// Perform queries
	for (let i = 0; i < 100; i++) {
		store.find({ category: "A" });
		store.filter(record => record.status === "active");
	}

	forceGC();
	memorySnapshots.push({
		operation: "After queries",
		memory: getMemoryUsage()
	});

	// Clear store
	store.clear();

	forceGC();
	memorySnapshots.push({
		operation: "After clear",
		memory: getMemoryUsage()
	});

	return {
		dataSize,
		snapshots: memorySnapshots,
		maxHeapUsed: Math.max(...memorySnapshots.map(s => s.memory.heapUsed)),
		totalGrowth: memorySnapshots[memorySnapshots.length - 1].memory.heapUsed - memorySnapshots[0].memory.heapUsed
	};
}

/**
 * Prints memory benchmark results
 * @param {Array} results - Array of memory benchmark results
 */
function printMemoryResults (results) {
	console.log("\n=== MEMORY USAGE BENCHMARK RESULTS ===\n");

	console.log("Operation".padEnd(50) + "Execution Time".padEnd(16) + "Heap Delta (MB)".padEnd(16) + "RSS Delta (MB)");
	console.log("-".repeat(98));

	results.forEach(result => {
		const name = result.description.padEnd(50);
		const execTime = result.executionTime.toFixed(2).padEnd(16);
		const heapDelta = result.memoryDelta.heapUsed.toFixed(2).padEnd(16);
		const rssDelta = result.memoryDelta.rss.toFixed(2);

		console.log(name + execTime + heapDelta + rssDelta);
	});

	console.log("\n");
}

/**
 * Prints memory growth analysis
 * @param {Object} analysis - Memory growth analysis results
 */
function printMemoryGrowthAnalysis (analysis) {
	console.log("\n=== MEMORY GROWTH ANALYSIS ===\n");
	console.log(`Data Size: ${analysis.dataSize} records`);
	console.log(`Max Heap Used: ${analysis.maxHeapUsed.toFixed(2)} MB`);
	console.log(`Total Growth: ${analysis.totalGrowth.toFixed(2)} MB`);
	console.log("\nMemory Snapshots:");

	analysis.snapshots.forEach((snapshot, index) => {
		const operation = snapshot.operation.padEnd(20);
		const heapUsed = snapshot.memory.heapUsed.toFixed(2).padEnd(10);
		const rss = snapshot.memory.rss.toFixed(2).padEnd(10);
		const delta = index > 0 ?
			(snapshot.memory.heapUsed - analysis.snapshots[index - 1].memory.heapUsed).toFixed(2) :
			"0.00";

		console.log(`${operation} | Heap: ${heapUsed} MB | RSS: ${rss} MB | Delta: ${delta} MB`);
	});

	console.log("\n");
}

/**
 * Main function to run all memory benchmarks
 */
function runMemoryBenchmarks () {
	console.log("💾 Running Memory Usage Benchmarks...\n");

	const dataSizes = [1000, 10000, 25000];
	const allResults = [];

	console.log("Testing creation memory usage...");
	allResults.push(...benchmarkCreationMemory(dataSizes));

	console.log("Testing operation memory usage...");
	allResults.push(...benchmarkOperationMemory(dataSizes));

	console.log("Testing query memory usage...");
	allResults.push(...benchmarkQueryMemory(dataSizes));

	console.log("Testing index memory usage...");
	allResults.push(...benchmarkIndexMemory(dataSizes));

	console.log("Testing versioning memory usage...");
	allResults.push(...benchmarkVersioningMemory(dataSizes));

	console.log("Testing stress memory usage...");
	allResults.push(...benchmarkStressMemory(dataSizes));

	printMemoryResults(allResults);

	console.log("Analyzing memory growth...");
	const growthAnalysis = analyzeMemoryGrowth(10000);
	printMemoryGrowthAnalysis(growthAnalysis);

	return { results: allResults, growthAnalysis };
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runMemoryBenchmarks();
}

export { runMemoryBenchmarks, getMemoryUsage, analyzeMemoryGrowth };
