import { performance } from "node:perf_hooks";
import { haro } from "../dist/haro.js";
import { generateIndexTestData } from "./index-operations.js";

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
 * Benchmarks basic storage operations comparison
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkStorageComparison (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Haro storage
		const haroSetResult = benchmark(`Haro SET (${size} records)`, () => {
			const store = haro();
			testData.forEach(record => store.set(record.id, record));
		}, 10);
		results.push(haroSetResult);

		// Native Map storage
		const mapSetResult = benchmark(`Map SET (${size} records)`, () => {
			const map = new Map();
			testData.forEach(record => map.set(record.id, record));
		}, 10);
		results.push(mapSetResult);

		// Native Object storage
		const objectSetResult = benchmark(`Object SET (${size} records)`, () => {
			const obj = {};
			testData.forEach(record => obj[record.id] = record); // eslint-disable-line no-return-assign
		}, 10);
		results.push(objectSetResult);

		// Array storage
		const arraySetResult = benchmark(`Array PUSH (${size} records)`, () => {
			const arr = [];
			testData.forEach(record => arr.push(record));
		}, 10);
		results.push(arraySetResult);
	});

	return results;
}

/**
 * Benchmarks retrieval operations comparison
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkRetrievalComparison (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Prepare data structures
		const haroStore = haro(testData);
		const mapStore = new Map();
		const objectStore = {};
		const arrayStore = [];

		testData.forEach(record => {
			mapStore.set(record.id, record);
			objectStore[record.id] = record;
			arrayStore.push(record);
		});

		// Haro retrieval
		const haroGetResult = benchmark(`Haro GET (${size} records)`, () => {
			const id = Math.floor(Math.random() * size);
			haroStore.get(id);
		});
		results.push(haroGetResult);

		// Map retrieval
		const mapGetResult = benchmark(`Map GET (${size} records)`, () => {
			const id = Math.floor(Math.random() * size);
			mapStore.get(id);
		});
		results.push(mapGetResult);

		// Object retrieval
		const objectGetResult = benchmark(`Object GET (${size} records)`, () => {
			const id = Math.floor(Math.random() * size);
			objectStore[id]; // eslint-disable-line no-unused-expressions
		});
		results.push(objectGetResult);

		// Array retrieval (by index)
		const arrayGetResult = benchmark(`Array GET (${size} records)`, () => {
			const index = Math.floor(Math.random() * size);
			arrayStore[index]; // eslint-disable-line no-unused-expressions
		});
		results.push(arrayGetResult);

		// Array find (by property)
		const arrayFindResult = benchmark(`Array FIND (${size} records)`, () => {
			const id = Math.floor(Math.random() * size);
			arrayStore.find(record => record.id === id);
		});
		results.push(arrayFindResult);
	});

	return results;
}

/**
 * Benchmarks query operations comparison
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkQueryComparison (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Prepare data structures
		const haroStore = haro(testData, { index: ["category", "status"] });
		const arrayStore = [...testData];

		// Haro indexed query
		const haroQueryResult = benchmark(`Haro FIND indexed (${size} records)`, () => {
			haroStore.find({ category: "A" });
		});
		results.push(haroQueryResult);

		// Haro filter query
		const haroFilterResult = benchmark(`Haro FILTER (${size} records)`, () => {
			haroStore.filter(record => record.category === "A");
		});
		results.push(haroFilterResult);

		// Array filter query
		const arrayFilterResult = benchmark(`Array FILTER (${size} records)`, () => {
			arrayStore.filter(record => record.category === "A");
		});
		results.push(arrayFilterResult);

		// Complex query comparison
		const haroComplexResult = benchmark(`Haro COMPLEX query (${size} records)`, () => {
			haroStore.filter(record =>
				record.category === "A" &&
        record.status === "active" &&
        record.priority === "high"
			);
		});
		results.push(haroComplexResult);

		const arrayComplexResult = benchmark(`Array COMPLEX query (${size} records)`, () => {
			arrayStore.filter(record =>
				record.category === "A" &&
        record.status === "active" &&
        record.priority === "high"
			);
		});
		results.push(arrayComplexResult);
	});

	return results;
}

/**
 * Benchmarks deletion operations comparison
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkDeletionComparison (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Haro deletion
		const haroDeleteResult = benchmark(`Haro DELETE (${size} records)`, () => {
			const store = haro(testData);
			const keys = Array.from(store.keys());
			for (let i = 0; i < Math.min(100, keys.length); i++) {
				try {
					store.delete(keys[i]);
				} catch (e) { // eslint-disable-line no-unused-vars
					// Record might already be deleted
				}
			}
		}, 10);
		results.push(haroDeleteResult);

		// Map deletion
		const mapDeleteResult = benchmark(`Map DELETE (${size} records)`, () => {
			const map = new Map();
			testData.forEach(record => map.set(record.id, record));
			const keys = Array.from(map.keys());
			for (let i = 0; i < Math.min(100, keys.length); i++) {
				map.delete(keys[i]);
			}
		}, 10);
		results.push(mapDeleteResult);

		// Object deletion
		const objectDeleteResult = benchmark(`Object DELETE (${size} records)`, () => {
			const obj = {};
			testData.forEach(record => obj[record.id] = record); // eslint-disable-line no-return-assign
			const keys = Object.keys(obj);
			for (let i = 0; i < Math.min(100, keys.length); i++) {
				delete obj[keys[i]];
			}
		}, 10);
		results.push(objectDeleteResult);

		// Array splice deletion
		const arrayDeleteResult = benchmark(`Array SPLICE (${size} records)`, () => {
			const arr = [...testData];
			for (let i = 0; i < Math.min(100, arr.length); i++) {
				arr.splice(0, 1);
			}
		}, 10);
		results.push(arrayDeleteResult);
	});

	return results;
}

/**
 * Benchmarks aggregation operations comparison
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkAggregationComparison (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Prepare data structures
		const haroStore = haro(testData);
		const arrayStore = [...testData];

		// Haro map operation
		const haroMapResult = benchmark(`Haro MAP (${size} records)`, () => {
			haroStore.map(record => record.category);
		});
		results.push(haroMapResult);

		// Array map operation
		const arrayMapResult = benchmark(`Array MAP (${size} records)`, () => {
			arrayStore.map(record => record.category);
		});
		results.push(arrayMapResult);

		// Haro reduce operation
		const haroReduceResult = benchmark(`Haro REDUCE (${size} records)`, () => {
			haroStore.reduce((acc, record) => {
				acc[record.category] = (acc[record.category] || 0) + 1;

				return acc;
			}, {});
		});
		results.push(haroReduceResult);

		// Array reduce operation
		const arrayReduceResult = benchmark(`Array REDUCE (${size} records)`, () => {
			arrayStore.reduce((acc, record) => {
				acc[record.category] = (acc[record.category] || 0) + 1;

				return acc;
			}, {});
		});
		results.push(arrayReduceResult);

		// Haro forEach operation
		const haroForEachResult = benchmark(`Haro FOREACH (${size} records)`, () => {
			let count = 0;
			haroStore.forEach(() => count++);
		});
		results.push(haroForEachResult);

		// Array forEach operation
		const arrayForEachResult = benchmark(`Array FOREACH (${size} records)`, () => {
			let count = 0;
			arrayStore.forEach(() => count++);
		});
		results.push(arrayForEachResult);
	});

	return results;
}

/**
 * Benchmarks sorting operations comparison
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkSortingComparison (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Prepare data structures
		const haroStore = haro(testData, { index: ["category", "score"] });
		const arrayStore = [...testData];

		// Haro sort operation
		const haroSortResult = benchmark(`Haro SORT (${size} records)`, () => {
			haroStore.sort((a, b) => a.score - b.score);
		}, 10);
		results.push(haroSortResult);

		// Array sort operation
		const arraySortResult = benchmark(`Array SORT (${size} records)`, () => {
			[...arrayStore].sort((a, b) => a.score - b.score);
		}, 10);
		results.push(arraySortResult);

		// Haro sortBy operation (indexed)
		const haroSortByResult = benchmark(`Haro SORTBY indexed (${size} records)`, () => {
			haroStore.sortBy("score");
		}, 10);
		results.push(haroSortByResult);

		// Complex sort comparison
		const haroComplexSortResult = benchmark(`Haro COMPLEX sort (${size} records)`, () => {
			haroStore.sort((a, b) => {
				if (a.category !== b.category) {
					return a.category.localeCompare(b.category);
				}

				return b.score - a.score;
			});
		}, 10);
		results.push(haroComplexSortResult);

		const arrayComplexSortResult = benchmark(`Array COMPLEX sort (${size} records)`, () => {
			[...arrayStore].sort((a, b) => {
				if (a.category !== b.category) {
					return a.category.localeCompare(b.category);
				}

				return b.score - a.score;
			});
		}, 10);
		results.push(arrayComplexSortResult);
	});

	return results;
}

/**
 * Benchmarks memory efficiency comparison
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of memory comparison results
 */
function benchmarkMemoryComparison (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Measure memory usage for each data structure
		const measurements = [];

		// Haro memory usage
		const haroMemStart = process.memoryUsage().heapUsed;
		const haroStore = haro(testData); // eslint-disable-line no-unused-vars
		const haroMemEnd = process.memoryUsage().heapUsed;
		measurements.push({
			name: `Haro memory (${size} records)`,
			memoryUsed: (haroMemEnd - haroMemStart) / 1024 / 1024 // MB
		});

		// Map memory usage
		const mapMemStart = process.memoryUsage().heapUsed;
		const mapStore = new Map();
		testData.forEach(record => mapStore.set(record.id, record));
		const mapMemEnd = process.memoryUsage().heapUsed;
		measurements.push({
			name: `Map memory (${size} records)`,
			memoryUsed: (mapMemEnd - mapMemStart) / 1024 / 1024 // MB
		});

		// Object memory usage
		const objMemStart = process.memoryUsage().heapUsed;
		const objStore = {};
		testData.forEach(record => objStore[record.id] = record); // eslint-disable-line no-return-assign
		const objMemEnd = process.memoryUsage().heapUsed;
		measurements.push({
			name: `Object memory (${size} records)`,
			memoryUsed: (objMemEnd - objMemStart) / 1024 / 1024 // MB
		});

		// Array memory usage
		const arrMemStart = process.memoryUsage().heapUsed;
		const arrStore = [...testData]; // eslint-disable-line no-unused-vars
		const arrMemEnd = process.memoryUsage().heapUsed;
		measurements.push({
			name: `Array memory (${size} records)`,
			memoryUsed: (arrMemEnd - arrMemStart) / 1024 / 1024 // MB
		});

		results.push(...measurements);
	});

	return results;
}

/**
 * Benchmarks advanced features unique to Haro
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkAdvancedFeatures (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateIndexTestData(size);

		// Haro advanced features
		const haroAdvancedResult = benchmark(`Haro ADVANCED features (${size} records)`, () => {
			const store = haro(testData, {
				index: ["category", "status", "category|status"],
				versioning: true
			});

			// Use advanced features
			store.find({ category: "A", status: "active" });
			store.search(/^A/, "category");
			store.where({ category: ["A", "B"] });
			store.sortBy("category");
			store.limit(10, 20);

			return store;
		}, 10);
		results.push(haroAdvancedResult);

		// Simulate similar operations with native structures
		const nativeAdvancedResult = benchmark(`Native ADVANCED simulation (${size} records)`, () => {
			const store = [...testData];

			// Category index simulation
			const categoryIndex = new Map();
			store.forEach(record => {
				if (!categoryIndex.has(record.category)) {
					categoryIndex.set(record.category, []);
				}
				categoryIndex.get(record.category).push(record);
			});

			// Find simulation
			const found = store.filter(record => record.category === "A" && record.status === "active");

			// Search simulation
			const searched = store.filter(record => (/^A/).test(record.category));

			// Where simulation
			const where = store.filter(record => ["A", "B"].includes(record.category));

			// Sort simulation
			const sorted = [...store].sort((a, b) => a.category.localeCompare(b.category));

			// Limit simulation
			const limited = sorted.slice(10, 30);

			return { found, searched, where, sorted, limited };
		}, 10);
		results.push(nativeAdvancedResult);
	});

	return results;
}

/**
 * Prints comparison results in a formatted table
 * @param {Array} results - Array of benchmark results
 * @param {string} title - Title for the results section
 */
function printResults (results, title) {
	console.log(`\n=== ${title} ===\n`);

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
 * Prints memory comparison results
 * @param {Array} results - Array of memory measurements
 */
function printMemoryResults (results) {
	console.log("\n=== MEMORY USAGE COMPARISON ===\n");

	console.log("Data Structure".padEnd(40) + "Memory Used (MB)");
	console.log("-".repeat(60));

	results.forEach(result => {
		const name = result.name.padEnd(40);
		const memoryUsed = result.memoryUsed.toFixed(2);

		console.log(name + memoryUsed);
	});

	console.log("\n");
}

/**
 * Main function to run all comparison benchmarks
 */
function runComparisonBenchmarks () {
	console.log("⚡ Running Haro vs Native Structures Comparison...\n");

	const dataSizes = [1000, 10000, 50000];

	console.log("Testing storage operations...");
	const storageResults = benchmarkStorageComparison(dataSizes);
	printResults(storageResults, "STORAGE OPERATIONS COMPARISON");

	console.log("Testing retrieval operations...");
	const retrievalResults = benchmarkRetrievalComparison(dataSizes);
	printResults(retrievalResults, "RETRIEVAL OPERATIONS COMPARISON");

	console.log("Testing query operations...");
	const queryResults = benchmarkQueryComparison(dataSizes);
	printResults(queryResults, "QUERY OPERATIONS COMPARISON");

	console.log("Testing deletion operations...");
	const deletionResults = benchmarkDeletionComparison(dataSizes);
	printResults(deletionResults, "DELETION OPERATIONS COMPARISON");

	console.log("Testing aggregation operations...");
	const aggregationResults = benchmarkAggregationComparison(dataSizes);
	printResults(aggregationResults, "AGGREGATION OPERATIONS COMPARISON");

	console.log("Testing sorting operations...");
	const sortingResults = benchmarkSortingComparison(dataSizes);
	printResults(sortingResults, "SORTING OPERATIONS COMPARISON");

	console.log("Testing advanced features...");
	const advancedResults = benchmarkAdvancedFeatures(dataSizes);
	printResults(advancedResults, "ADVANCED FEATURES COMPARISON");

	console.log("Testing memory usage...");
	const memoryResults = benchmarkMemoryComparison(dataSizes);
	printMemoryResults(memoryResults);

	const allResults = [
		...storageResults,
		...retrievalResults,
		...queryResults,
		...deletionResults,
		...aggregationResults,
		...sortingResults,
		...advancedResults
	];

	return { allResults, memoryResults };
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runComparisonBenchmarks();
}

export { runComparisonBenchmarks };
