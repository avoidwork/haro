import { performance } from "node:perf_hooks";
import { haro } from "../dist/haro.js";

/**
 * Generates test data for utility operation benchmarking
 * @param {number} size - Number of records to generate
 * @returns {Array} Array of test records with complex nested structures
 */
function generateUtilityTestData (size) {
	const data = [];
	for (let i = 0; i < size; i++) {
		data.push({
			id: i,
			name: `User ${i}`,
			email: `user${i}@example.com`,
			age: Math.floor(Math.random() * 50) + 18,
			tags: [`tag${i % 10}`, `category${i % 5}`, `type${i % 3}`],
			metadata: {
				created: new Date(),
				score: Math.random() * 100,
				level: Math.floor(Math.random() * 10),
				preferences: {
					theme: i % 2 === 0 ? "dark" : "light",
					notifications: Math.random() > 0.5,
					settings: {
						privacy: Math.random() > 0.3,
						analytics: Math.random() > 0.7
					}
				}
			},
			history: Array.from({ length: Math.min(i % 20 + 1, 10) }, (_, j) => ({
				action: `action_${j}`,
				timestamp: new Date(Date.now() - j * 1000 * 60),
				data: { value: Math.random() * 1000 }
			}))
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
 * Benchmarks clone operations on various data structures
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkCloneOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateUtilityTestData(size);
		const store = haro(testData);

		// Clone simple objects
		const simpleObject = { id: 1, name: "test", age: 30 };
		const cloneSimpleResult = benchmark(`Clone simple object (${size} iterations)`, () => {
			store.clone(simpleObject);
		});
		results.push(cloneSimpleResult);

		// Clone complex nested objects
		const complexObject = testData[0];
		const cloneComplexResult = benchmark(`Clone complex object (${size} iterations)`, () => {
			store.clone(complexObject);
		});
		results.push(cloneComplexResult);

		// Clone arrays
		const arrayData = testData.slice(0, Math.min(100, size));
		const cloneArrayResult = benchmark(`Clone array (${arrayData.length} items, ${Math.min(100, size)} iterations)`, () => {
			store.clone(arrayData);
		}, Math.min(100, size));
		results.push(cloneArrayResult);
	});

	return results;
}

/**
 * Benchmarks merge operations with different data structures
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkMergeOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const store = haro();

		// Merge simple objects
		const base = { id: 1, name: "John", age: 30 };
		const update = { age: 31, email: "john@example.com" };
		const mergeSimpleResult = benchmark(`Merge simple objects (${size} iterations)`, () => {
			store.merge(store.clone(base), update);
		});
		results.push(mergeSimpleResult);

		// Merge complex nested objects
		const complexBase = {
			id: 1,
			profile: { name: "John", age: 30 },
			settings: { theme: "dark", notifications: true },
			tags: ["user", "admin"]
		};
		const complexUpdate = {
			profile: { age: 31, location: "NYC" },
			settings: { privacy: true },
			tags: ["power-user"]
		};
		const mergeComplexResult = benchmark(`Merge complex objects (${size} iterations)`, () => {
			store.merge(store.clone(complexBase), complexUpdate);
		});
		results.push(mergeComplexResult);

		// Merge arrays
		const array1 = Array.from({ length: 10 }, (_, i) => i);
		const array2 = Array.from({ length: 10 }, (_, i) => i + 10);
		const mergeArrayResult = benchmark(`Merge arrays (${size} iterations)`, () => {
			store.merge(store.clone(array1), array2);
		});
		results.push(mergeArrayResult);

		// Merge with override
		const mergeOverrideResult = benchmark(`Merge with override (${size} iterations)`, () => {
			store.merge(store.clone(array1), array2, true);
		});
		results.push(mergeOverrideResult);
	});

	return results;
}

/**
 * Benchmarks freeze operations on various data structures
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkFreezeOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateUtilityTestData(size);
		const store = haro();

		// Freeze single objects
		const singleObject = testData[0];
		const freezeSingleResult = benchmark(`Freeze single object (${size} iterations)`, () => {
			store.freeze(singleObject);
		});
		results.push(freezeSingleResult);

		// Freeze multiple objects
		const multipleObjects = testData.slice(0, Math.min(10, size));
		const freezeMultipleResult = benchmark(`Freeze multiple objects (${multipleObjects.length} objects, ${Math.min(100, size)} iterations)`, () => {
			store.freeze(...multipleObjects);
		}, Math.min(100, size));
		results.push(freezeMultipleResult);

		// Freeze nested structures
		const nestedStructure = {
			data: testData.slice(0, Math.min(50, size)),
			metadata: { count: size, timestamp: new Date() }
		};
		const freezeNestedResult = benchmark(`Freeze nested structure (${Math.min(10, size)} iterations)`, () => {
			store.freeze(nestedStructure);
		}, Math.min(10, size));
		results.push(freezeNestedResult);
	});

	return results;
}

/**
 * Benchmarks forEach operations with different callback complexities
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkForEachOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateUtilityTestData(size);
		const store = haro(testData);

		// Simple forEach operation
		const forEachSimpleResult = benchmark(`forEach simple operation (${size} records)`, () => {
			let count = 0; // eslint-disable-line no-unused-vars
			store.forEach(() => { count++; });
		}, 1);
		results.push(forEachSimpleResult);

		// Complex forEach operation
		const aggregated = {};
		const forEachComplexResult = benchmark(`forEach complex operation (${size} records)`, () => {
			store.forEach(record => {
				const dept = record.metadata?.preferences?.theme || "unknown";
				aggregated[dept] = (aggregated[dept] || 0) + 1;
			});
		}, 1);
		results.push(forEachComplexResult);

		// forEach with context
		const context = { processed: 0, errors: 0 };
		const forEachContextResult = benchmark(`forEach with context (${size} records)`, () => {
			store.forEach(function (record) {
				try {
					if (record.age > 0) {
						this.processed++;
					}
				} catch (e) { // eslint-disable-line no-unused-vars
					this.errors++;
				}
			}, context);
		}, 1);
		results.push(forEachContextResult);
	});

	return results;
}

/**
 * Benchmarks UUID generation performance
 * @param {Array} iterations - Array of iteration counts to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkUuidOperations (iterations) {
	const results = [];
	const store = haro();

	iterations.forEach(count => {
		// UUID generation
		const uuidResult = benchmark(`UUID generation (${count} iterations)`, () => {
			store.uuid();
		}, count);
		results.push(uuidResult);

		// UUID uniqueness test (collect UUIDs and check for duplicates)
		const uuids = new Set();
		const uniquenessStart = performance.now();
		for (let i = 0; i < count; i++) {
			uuids.add(store.uuid());
		}
		const uniquenessEnd = performance.now();
		const uniquenessResult = {
			name: `UUID uniqueness test (${count} UUIDs)`,
			iterations: count,
			totalTime: uniquenessEnd - uniquenessStart,
			avgTime: (uniquenessEnd - uniquenessStart) / count,
			opsPerSecond: Math.floor(count / ((uniquenessEnd - uniquenessStart) / 1000)),
			duplicates: count - uuids.size,
			uniqueRatio: (uuids.size / count * 100).toFixed(2) + "%"
		};
		results.push(uniquenessResult);
	});

	return results;
}

/**
 * Prints formatted benchmark results
 * @param {Array} results - Array of benchmark results
 */
function printResults (results) {
	console.log("\n" + "=".repeat(80));
	console.log("UTILITY OPERATIONS BENCHMARK RESULTS");
	console.log("=".repeat(80));

	results.forEach(result => {
		const opsIndicator = result.opsPerSecond > 10000 ? "✅" :
			result.opsPerSecond > 1000 ? "🟡" :
				result.opsPerSecond > 100 ? "🟠" : "🔴";

		console.log(`${opsIndicator} ${result.name}`);
		console.log(`   ${result.opsPerSecond.toLocaleString()} ops/sec | ${result.totalTime.toFixed(2)}ms total | ${result.avgTime.toFixed(4)}ms avg`);

		if (result.duplicates !== undefined) {
			console.log(`   Duplicates: ${result.duplicates} | Unique ratio: ${result.uniqueRatio}`);
		}
		console.log("");
	});
}

/**
 * Runs all utility operation benchmarks
 * @returns {Array} Array of all benchmark results
 */
function runUtilityOperationsBenchmarks () {
	console.log("Starting Utility Operations Benchmarks...\n");

	const dataSizes = [100, 1000, 5000];
	const uuidIterations = [1000, 10000, 50000];
	let allResults = [];

	console.log("Testing clone operations...");
	allResults.push(...benchmarkCloneOperations(dataSizes));

	console.log("Testing merge operations...");
	allResults.push(...benchmarkMergeOperations(dataSizes));

	console.log("Testing freeze operations...");
	allResults.push(...benchmarkFreezeOperations(dataSizes));

	console.log("Testing forEach operations...");
	allResults.push(...benchmarkForEachOperations(dataSizes));

	console.log("Testing UUID operations...");
	allResults.push(...benchmarkUuidOperations(uuidIterations));

	printResults(allResults);

	console.log("Utility Operations Benchmarks completed.\n");

	return allResults;
}

// Export for use in main benchmark runner
export { runUtilityOperationsBenchmarks };

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runUtilityOperationsBenchmarks();
}
