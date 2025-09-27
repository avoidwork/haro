import { performance } from "node:perf_hooks";
import { haro } from "../dist/haro.js";

/**
 * Generates test data for benchmarking
 * @param {number} size - Number of records to generate
 * @returns {Array} Array of test records
 */
function generateTestData (size) {
	const data = [];
	for (let i = 0; i < size; i++) {
		data.push({
			id: i,
			name: `User ${i}`,
			email: `user${i}@example.com`,
			age: Math.floor(Math.random() * 50) + 18,
			department: `Dept ${i % 10}`,
			active: Math.random() > 0.5,
			tags: [`tag${i % 5}`, `tag${i % 3}`],
			metadata: {
				created: new Date(),
				score: Math.random() * 100,
				level: Math.floor(Math.random() * 10)
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
function benchmark (name, fn, iterations = 1000) {
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
 * Benchmarks basic SET operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkSetOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateTestData(size);
		const store = haro();

		// Individual set operations
		const setResult = benchmark(`SET (${size} records)`, () => {
			const record = testData[Math.floor(Math.random() * testData.length)];
			store.set(record.id, record);
		});
		results.push(setResult);

		// Batch set operations
		const batchStore = haro();
		const batchResult = benchmark(`BATCH SET (${size} records)`, () => {
			batchStore.batch(testData, "set");
		}, 1);
		results.push(batchResult);
	});

	return results;
}

/**
 * Benchmarks basic GET operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkGetOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateTestData(size);
		const store = haro(testData);

		// Random get operations
		const getResult = benchmark(`GET (${size} records)`, () => {
			const id = Math.floor(Math.random() * size);
			store.get(id);
		});
		results.push(getResult);

		// Has operations
		const hasResult = benchmark(`HAS (${size} records)`, () => {
			const id = Math.floor(Math.random() * size);
			store.has(id);
		});
		results.push(hasResult);
	});

	return results;
}

/**
 * Benchmarks DELETE operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkDeleteOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateTestData(size);

		// Individual delete operations
		const deleteStore = haro(testData);
		const deleteResult = benchmark(`DELETE (${size} records)`, () => {
			const keys = Array.from(deleteStore.keys());
			if (keys.length > 0) {
				const randomKey = keys[Math.floor(Math.random() * keys.length)];
				try {
					deleteStore.delete(randomKey);
				} catch (e) { // eslint-disable-line no-unused-vars
					// Record might already be deleted
				}
			}
		}, Math.min(100, size));
		results.push(deleteResult);

		// Clear operations
		const clearStore = haro(testData);
		const clearResult = benchmark(`CLEAR (${size} records)`, () => {
			clearStore.clear();
			clearStore.batch(testData, "set");
		}, 10);
		results.push(clearResult);
	});

	return results;
}

/**
 * Benchmarks utility operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkUtilityOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateTestData(size);
		const store = haro(testData);

		// ToArray operations
		const toArrayResult = benchmark(`toArray (${size} records)`, () => {
			store.toArray();
		}, 100);
		results.push(toArrayResult);

		// Keys operations
		const keysResult = benchmark(`keys (${size} records)`, () => {
			Array.from(store.keys());
		}, 100);
		results.push(keysResult);

		// Values operations
		const valuesResult = benchmark(`values (${size} records)`, () => {
			Array.from(store.values());
		}, 100);
		results.push(valuesResult);

		// Entries operations
		const entriesResult = benchmark(`entries (${size} records)`, () => {
			Array.from(store.entries());
		}, 100);
		results.push(entriesResult);
	});

	return results;
}

/**
 * Prints benchmark results in a formatted table
 * @param {Array} results - Array of benchmark results
 */
function printResults (results) {
	console.log("\n=== BASIC OPERATIONS BENCHMARK RESULTS ===\n");

	console.log("Operation".padEnd(30) + "Iterations".padEnd(12) + "Total Time (ms)".padEnd(18) + "Avg Time (ms)".padEnd(16) + "Ops/Second");
	console.log("-".repeat(88));

	results.forEach(result => {
		const name = result.name.padEnd(30);
		const iterations = result.iterations.toString().padEnd(12);
		const totalTime = result.totalTime.toFixed(2).padEnd(18);
		const avgTime = result.avgTime.toFixed(4).padEnd(16);
		const opsPerSecond = result.opsPerSecond.toLocaleString();

		console.log(name + iterations + totalTime + avgTime + opsPerSecond);
	});

	console.log("\n");
}

/**
 * Main function to run all basic operations benchmarks
 */
function runBasicOperationsBenchmarks () {
	console.log("🚀 Running Basic Operations Benchmarks...\n");

	const dataSizes = [1000, 10000, 50000];
	const allResults = [];

	console.log("Testing SET operations...");
	allResults.push(...benchmarkSetOperations(dataSizes));

	console.log("Testing GET operations...");
	allResults.push(...benchmarkGetOperations(dataSizes));

	console.log("Testing DELETE operations...");
	allResults.push(...benchmarkDeleteOperations(dataSizes));

	console.log("Testing utility operations...");
	allResults.push(...benchmarkUtilityOperations(dataSizes));

	printResults(allResults);

	return allResults;
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runBasicOperationsBenchmarks();
}

export { runBasicOperationsBenchmarks, generateTestData };
