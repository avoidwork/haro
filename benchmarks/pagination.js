import { performance } from "node:perf_hooks";
import { haro } from "../dist/haro.js";

/**
 * Generates test data for pagination benchmarking
 * @param {number} size - Number of records to generate
 * @returns {Array} Array of test records optimized for pagination testing
 */
function generatePaginationTestData (size) {
	const data = [];
	const categories = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
	const statuses = ["active", "inactive", "pending", "archived"];

	for (let i = 0; i < size; i++) {
		data.push({
			id: i,
			name: `Item ${i}`,
			category: categories[i % categories.length],
			status: statuses[i % statuses.length],
			priority: Math.floor(Math.random() * 5) + 1,
			score: Math.floor(Math.random() * 1000),
			timestamp: new Date(2024, 0, 1, 0, 0, 0, i * 1000),
			description: `Description for item ${i}`,
			tags: [`tag${i % 20}`, `group${i % 10}`],
			metadata: {
				level: Math.floor(i / 100),
				region: `Region ${i % 5}`,
				department: `Dept ${i % 15}`
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
 * Benchmarks basic limit operations with different page sizes
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkBasicLimitOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generatePaginationTestData(size);
		const store = haro(testData);

		// Small page sizes
		const smallPageResult = benchmark(`LIMIT small page (10 items from ${size} records)`, () => {
			store.limit(0, 10);
		});
		results.push(smallPageResult);

		// Medium page sizes
		const mediumPageResult = benchmark(`LIMIT medium page (50 items from ${size} records)`, () => {
			store.limit(0, 50);
		});
		results.push(mediumPageResult);

		// Large page sizes
		const largePageResult = benchmark(`LIMIT large page (100 items from ${size} records)`, () => {
			store.limit(0, 100);
		});
		results.push(largePageResult);

		// Very large page sizes
		const veryLargePageResult = benchmark(`LIMIT very large page (1000 items from ${size} records)`, () => {
			store.limit(0, Math.min(1000, size));
		});
		results.push(veryLargePageResult);
	});

	return results;
}

/**
 * Benchmarks offset-based pagination patterns
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkOffsetPagination (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generatePaginationTestData(size);
		const store = haro(testData);
		const pageSize = 20;

		// First page (offset 0)
		const firstPageResult = benchmark(`LIMIT first page (offset 0, ${pageSize} items)`, () => {
			store.limit(0, pageSize);
		});
		results.push(firstPageResult);

		// Middle page
		const middleOffset = Math.floor(size / 2);
		const middlePageResult = benchmark(`LIMIT middle page (offset ${middleOffset}, ${pageSize} items)`, () => {
			store.limit(middleOffset, pageSize);
		});
		results.push(middlePageResult);

		// Near end page
		const nearEndOffset = Math.max(0, size - pageSize * 2);
		const nearEndPageResult = benchmark(`LIMIT near end page (offset ${nearEndOffset}, ${pageSize} items)`, () => {
			store.limit(nearEndOffset, pageSize);
		});
		results.push(nearEndPageResult);

		// Last page (potentially partial)
		const lastOffset = Math.max(0, size - pageSize);
		const lastPageResult = benchmark(`LIMIT last page (offset ${lastOffset}, ${pageSize} items)`, () => {
			store.limit(lastOffset, pageSize);
		});
		results.push(lastPageResult);

		// Beyond data bounds (should return empty)
		const beyondBoundsResult = benchmark(`LIMIT beyond bounds (offset ${size + 100}, ${pageSize} items)`, () => {
			store.limit(size + 100, pageSize);
		});
		results.push(beyondBoundsResult);
	});

	return results;
}

/**
 * Benchmarks pagination with different page sizes to find optimal sizes
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkPageSizeOptimization (dataSizes) {
	const results = [];
	const pageSizes = [1, 5, 10, 20, 50, 100, 200, 500, 1000];

	dataSizes.forEach(size => {
		const testData = generatePaginationTestData(size);
		const store = haro(testData);

		pageSizes.forEach(pageSize => {
			if (pageSize <= size) {
				const pageSizeResult = benchmark(`LIMIT page size ${pageSize} (${size} total records)`, () => {
					store.limit(0, pageSize);
				});
				results.push(pageSizeResult);
			}
		});
	});

	return results;
}

/**
 * Benchmarks pagination with raw vs processed data
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkPaginationModes (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generatePaginationTestData(size);

		// Test with immutable store
		const immutableStore = haro(testData, { immutable: true });
		const immutableResult = benchmark(`LIMIT immutable mode (50 items from ${size} records)`, () => {
			immutableStore.limit(0, 50);
		}, 10);
		results.push(immutableResult);

		// Test with mutable store
		const mutableStore = haro(testData, { immutable: false });
		const mutableResult = benchmark(`LIMIT mutable mode (50 items from ${size} records)`, () => {
			mutableStore.limit(0, 50);
		}, 10);
		results.push(mutableResult);

		// Test with default options
		const defaultResult = benchmark(`LIMIT default options (50 items from ${size} records)`, () => {
			mutableStore.limit(0, 50);
		}, 10);
		results.push(defaultResult);

		// Test with transaction option
		const transactionResult = benchmark(`LIMIT with transaction (50 items from ${size} records)`, () => {
			mutableStore.limit(0, 50, {});
		}, 10);
		results.push(transactionResult);
	});

	return results;
}

/**
 * Benchmarks sequential pagination patterns (like browsing through pages)
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkSequentialPagination (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generatePaginationTestData(size);
		const store = haro(testData);
		const pageSize = 25;
		const totalPages = Math.ceil(size / pageSize);

		// Simulate browsing through first 10 pages
		const pagesToTest = Math.min(10, totalPages);
		const sequentialResult = benchmark(`LIMIT sequential pagination (${pagesToTest} pages, ${pageSize} items each)`, () => {
			for (let page = 0; page < pagesToTest; page++) {
				const offset = page * pageSize;
				store.limit(offset, pageSize);
			}
		}, 1);
		results.push(sequentialResult);

		// Simulate random page access pattern
		const randomPagesResult = benchmark(`LIMIT random page access (10 random pages, ${pageSize} items each)`, () => {
			for (let i = 0; i < 10; i++) {
				const randomPage = Math.floor(Math.random() * totalPages);
				const offset = randomPage * pageSize;
				store.limit(offset, pageSize);
			}
		}, 1);
		results.push(randomPagesResult);
	});

	return results;
}

/**
 * Benchmarks pagination combined with other operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkPaginationWithOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generatePaginationTestData(size);
		const store = haro(testData, {
			index: ["category", "status", "priority"]
		});

		// Pagination after filtering
		const paginateAfterFilterResult = benchmark(`LIMIT after filter (${size} records)`, () => {
			const filtered = store.filter(record => record.priority > 3);
			// Simulate pagination on filtered results by taking first 20

			return filtered.slice(0, 20);
		});
		results.push(paginateAfterFilterResult);

		// Pagination after find operation
		const paginateAfterFindResult = benchmark(`LIMIT after find (${size} records)`, () => {
			const found = store.find({ category: "A" });
			// Simulate pagination on found results by taking first 20

			return found.slice(0, 20);
		});
		results.push(paginateAfterFindResult);

		// Combined operations: find + sort + paginate simulation
		const combinedOperationsResult = benchmark(`Combined find + sort + limit (${size} records)`, () => {
			const found = store.find({ status: "active" });
			const sorted = found.sort((a, b) => b.score - a.score);

			return sorted.slice(0, 20); // Simulate limit
		});
		results.push(combinedOperationsResult);
	});

	return results;
}

/**
 * Tests pagination memory efficiency
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkPaginationMemory (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generatePaginationTestData(size);
		const store = haro(testData);

		// Memory usage pattern: get full dataset vs paginated chunks
		if (global.gc) {
			global.gc();
		}
		const memBefore = process.memoryUsage().heapUsed;

		// Test getting all data at once
		const allDataStart = performance.now();
		const allData = store.toArray(); // eslint-disable-line no-unused-vars
		const allDataEnd = performance.now();

		if (global.gc) {
			global.gc();
		}
		const memAfterAll = process.memoryUsage().heapUsed;

		// Test getting data in small chunks
		const chunkSize = 100;
		const chunksStart = performance.now();
		const chunks = [];
		for (let offset = 0; offset < size; offset += chunkSize) {
			chunks.push(store.limit(offset, chunkSize));
		}
		const chunksEnd = performance.now();

		if (global.gc) {
			global.gc();
		}
		const memAfterChunks = process.memoryUsage().heapUsed;

		results.push({
			name: `Memory comparison: all vs chunked (${size} records)`,
			totalTime: allDataEnd - allDataStart + (chunksEnd - chunksStart),
			allDataTime: allDataEnd - allDataStart,
			chunkedTime: chunksEnd - chunksStart,
			memoryAllData: (memAfterAll - memBefore) / 1024 / 1024, // MB
			memoryChunked: (memAfterChunks - memAfterAll) / 1024 / 1024, // MB
			iterations: 1,
			opsPerSecond: Math.floor(1000 / (allDataEnd - allDataStart + (chunksEnd - chunksStart)))
		});
	});

	return results;
}

/**
 * Prints formatted benchmark results
 * @param {Array} results - Array of benchmark results
 */
function printResults (results) {
	console.log("\n" + "=".repeat(80));
	console.log("PAGINATION BENCHMARK RESULTS");
	console.log("=".repeat(80));

	results.forEach(result => {
		const opsIndicator = result.opsPerSecond > 1000 ? "✅" :
			result.opsPerSecond > 100 ? "🟡" :
				result.opsPerSecond > 10 ? "🟠" : "🔴";

		console.log(`${opsIndicator} ${result.name}`);
		console.log(`   ${result.opsPerSecond.toLocaleString()} ops/sec | ${result.totalTime.toFixed(2)}ms total | ${result.avgTime?.toFixed(4) || "N/A"}ms avg`);

		// Special formatting for memory results
		if (result.memoryAllData !== undefined) {
			console.log(`   All data: ${result.allDataTime.toFixed(2)}ms, ${result.memoryAllData.toFixed(2)}MB`);
			console.log(`   Chunked: ${result.chunkedTime.toFixed(2)}ms, ${result.memoryChunked.toFixed(2)}MB`);
		}
		console.log("");
	});
}

/**
 * Runs all pagination benchmarks
 * @returns {Array} Array of all benchmark results
 */
function runPaginationBenchmarks () {
	console.log("Starting Pagination Benchmarks...\n");

	const dataSizes = [100, 500, 1000];
	let allResults = [];

	console.log("Testing basic limit operations...");
	allResults.push(...benchmarkBasicLimitOperations(dataSizes));

	console.log("Testing offset pagination...");
	allResults.push(...benchmarkOffsetPagination(dataSizes));

	console.log("Testing page size optimization...");
	allResults.push(...benchmarkPageSizeOptimization([10000])); // Test with medium size only

	console.log("Testing pagination modes...");
	allResults.push(...benchmarkPaginationModes(dataSizes));

	console.log("Testing sequential pagination...");
	allResults.push(...benchmarkSequentialPagination(dataSizes));

	console.log("Testing pagination with operations...");
	allResults.push(...benchmarkPaginationWithOperations(dataSizes));

	console.log("Testing pagination memory efficiency...");
	allResults.push(...benchmarkPaginationMemory([1000, 10000])); // Smaller sizes for memory tests

	printResults(allResults);

	console.log("Pagination Benchmarks completed.\n");

	return allResults;
}

// Export for use in main benchmark runner
export { runPaginationBenchmarks };

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runPaginationBenchmarks();
}
