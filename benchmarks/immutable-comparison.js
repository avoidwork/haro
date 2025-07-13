import { performance } from "node:perf_hooks";
import { haro } from "../dist/haro.js";

/**
 * Generates test data for immutable vs mutable comparison benchmarking
 * @param {number} size - Number of records to generate
 * @returns {Array} Array of test records
 */
function generateComparisonTestData (size) {
	const data = [];
	for (let i = 0; i < size; i++) {
		data.push({
			id: i,
			name: `User ${i}`,
			email: `user${i}@example.com`,
			age: Math.floor(Math.random() * 50) + 18,
			department: `Dept ${i % 10}`,
			active: Math.random() > 0.2,
			tags: [`tag${i % 15}`, `category${i % 8}`, `type${i % 5}`],
			score: Math.random() * 100,
			metadata: {
				created: new Date(),
				level: Math.floor(Math.random() * 10),
				preferences: {
					theme: i % 2 === 0 ? "dark" : "light",
					notifications: Math.random() > 0.5,
					language: ["en", "es", "fr"][i % 3]
				}
			},
			history: Array.from({ length: Math.min(i % 10 + 1, 5) }, (_, j) => ({
				action: `action_${j}`,
				timestamp: new Date(Date.now() - j * 86400000),
				value: Math.random() * 1000
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
 * Benchmarks store creation and initial data loading
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkStoreCreation (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateComparisonTestData(size);

		// Mutable store creation
		const mutableCreationResult = benchmark(`Store creation MUTABLE (${size} records)`, () => {
			return haro(testData, { immutable: false, index: ["department", "active", "tags"] });
		}, 10);
		results.push(mutableCreationResult);

		// Immutable store creation
		const immutableCreationResult = benchmark(`Store creation IMMUTABLE (${size} records)`, () => {
			return haro(testData, { immutable: true, index: ["department", "active", "tags"] });
		}, 10);
		results.push(immutableCreationResult);

		// Performance comparison
		const performanceRatio = (mutableCreationResult.opsPerSecond / immutableCreationResult.opsPerSecond).toFixed(2);
		results.push({
			name: `Creation performance ratio (${size} records)`,
			iterations: 1,
			totalTime: 0,
			avgTime: 0,
			opsPerSecond: 0,
			mutableOps: mutableCreationResult.opsPerSecond,
			immutableOps: immutableCreationResult.opsPerSecond,
			ratio: `${performanceRatio}x faster (mutable)`,
			recommendation: parseFloat(performanceRatio) > 1.5 ? "Use mutable for creation-heavy workloads" : "Performance difference minimal"
		});
	});

	return results;
}

/**
 * Benchmarks basic CRUD operations in both modes
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkCrudOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateComparisonTestData(size);

		// Create stores
		const mutableStore = haro(testData, { immutable: false, index: ["department", "active"] });
		const immutableStore = haro(testData, { immutable: true, index: ["department", "active"] });

		// GET operations
		const mutableGetResult = benchmark(`GET operation MUTABLE (${size} records)`, () => {
			const randomId = Math.floor(Math.random() * size).toString();

			return mutableStore.get(randomId);
		});
		results.push(mutableGetResult);

		const immutableGetResult = benchmark(`GET operation IMMUTABLE (${size} records)`, () => {
			const randomId = Math.floor(Math.random() * size).toString();

			return immutableStore.get(randomId);
		});
		results.push(immutableGetResult);

		// SET operations
		const mutableSetResult = benchmark(`SET operation MUTABLE (${size} records)`, () => {
			const randomId = Math.floor(Math.random() * size).toString();

			return mutableStore.set(randomId, { ...testData[0], updated: Date.now() });
		});
		results.push(mutableSetResult);

		const immutableSetResult = benchmark(`SET operation IMMUTABLE (${size} records)`, () => {
			const randomId = Math.floor(Math.random() * size).toString();

			return immutableStore.set(randomId, { ...testData[0], updated: Date.now() });
		});
		results.push(immutableSetResult);

		// DELETE operations (using a subset to avoid depleting data)
		const deleteCount = Math.min(10, size);
		const mutableDeleteResult = benchmark(`DELETE operation MUTABLE (${deleteCount} deletes)`, () => {
			const randomId = Math.floor(Math.random() * (size - deleteCount)).toString();
			try {
				mutableStore.delete(randomId);
			} catch (e) { // eslint-disable-line no-unused-vars
				// Record might not exist
			}
		}, deleteCount);
		results.push(mutableDeleteResult);

		const immutableDeleteResult = benchmark(`DELETE operation IMMUTABLE (${deleteCount} deletes)`, () => {
			const randomId = Math.floor(Math.random() * (size - deleteCount)).toString();
			try {
				immutableStore.delete(randomId);
			} catch (e) { // eslint-disable-line no-unused-vars
				// Record might not exist
			}
		}, deleteCount);
		results.push(immutableDeleteResult);
	});

	return results;
}

/**
 * Benchmarks query operations in both modes
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkQueryOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateComparisonTestData(size);

		// Create stores with extensive indexing
		const mutableStore = haro(testData, {
			immutable: false,
			index: ["department", "active", "tags", "age", "department|active"]
		});
		const immutableStore = haro(testData, {
			immutable: true,
			index: ["department", "active", "tags", "age", "department|active"]
		});

		// FIND operations
		const mutableFindResult = benchmark(`FIND operation MUTABLE (${size} records)`, () => {
			return mutableStore.find({ department: "Dept 0" });
		});
		results.push(mutableFindResult);

		const immutableFindResult = benchmark(`FIND operation IMMUTABLE (${size} records)`, () => {
			return immutableStore.find({ department: "Dept 0" });
		});
		results.push(immutableFindResult);

		// FILTER operations
		const mutableFilterResult = benchmark(`FILTER operation MUTABLE (${size} records)`, () => {
			return mutableStore.filter(record => record.age > 30);
		});
		results.push(mutableFilterResult);

		const immutableFilterResult = benchmark(`FILTER operation IMMUTABLE (${size} records)`, () => {
			return immutableStore.filter(record => record.age > 30);
		});
		results.push(immutableFilterResult);

		// WHERE operations
		const mutableWhereResult = benchmark(`WHERE operation MUTABLE (${size} records)`, () => {
			return mutableStore.where({
				department: ["Dept 0", "Dept 1"],
				active: true
			});
		});
		results.push(mutableWhereResult);

		const immutableWhereResult = benchmark(`WHERE operation IMMUTABLE (${size} records)`, () => {
			return immutableStore.where({
				department: ["Dept 0", "Dept 1"],
				active: true
			});
		});
		results.push(immutableWhereResult);

		// SEARCH operations
		const mutableSearchResult = benchmark(`SEARCH operation MUTABLE (${size} records)`, () => {
			return mutableStore.search("tag0");
		});
		results.push(mutableSearchResult);

		const immutableSearchResult = benchmark(`SEARCH operation IMMUTABLE (${size} records)`, () => {
			return immutableStore.search("tag0");
		});
		results.push(immutableSearchResult);
	});

	return results;
}

/**
 * Benchmarks transformation operations in both modes
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkTransformationOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateComparisonTestData(size);

		// Create stores
		const mutableStore = haro(testData, { immutable: false });
		const immutableStore = haro(testData, { immutable: true });

		// MAP operations
		const mutableMapResult = benchmark(`MAP operation MUTABLE (${size} records)`, () => {
			return mutableStore.map(record => ({
				id: record.id,
				name: record.name,
				summary: `${record.name} - ${record.department}`
			}));
		});
		results.push(mutableMapResult);

		const immutableMapResult = benchmark(`MAP operation IMMUTABLE (${size} records)`, () => {
			return immutableStore.map(record => ({
				id: record.id,
				name: record.name,
				summary: `${record.name} - ${record.department}`
			}));
		});
		results.push(immutableMapResult);

		// REDUCE operations
		const mutableReduceResult = benchmark(`REDUCE operation MUTABLE (${size} records)`, () => {
			return mutableStore.reduce((acc, record) => {
				acc[record.department] = (acc[record.department] || 0) + 1;

				return acc;
			}, {});
		});
		results.push(mutableReduceResult);

		const immutableReduceResult = benchmark(`REDUCE operation IMMUTABLE (${size} records)`, () => {
			return immutableStore.reduce((acc, record) => {
				acc[record.department] = (acc[record.department] || 0) + 1;

				return acc;
			}, {});
		});
		results.push(immutableReduceResult);

		// SORT operations
		const mutableSortResult = benchmark(`SORT operation MUTABLE (${size} records)`, () => {
			return mutableStore.sort((a, b) => a.score - b.score);
		}, 10);
		results.push(mutableSortResult);

		const immutableSortResult = benchmark(`SORT operation IMMUTABLE (${size} records)`, () => {
			return immutableStore.sort((a, b) => a.score - b.score);
		}, 10);
		results.push(immutableSortResult);

		// forEach operations
		const mutableForEachResult = benchmark(`forEach operation MUTABLE (${size} records)`, () => {
			let count = 0;
			mutableStore.forEach(() => { count++; });

			return count;
		});
		results.push(mutableForEachResult);

		const immutableForEachResult = benchmark(`forEach operation IMMUTABLE (${size} records)`, () => {
			let count = 0;
			immutableStore.forEach(() => { count++; });

			return count;
		});
		results.push(immutableForEachResult);
	});

	return results;
}

/**
 * Benchmarks memory usage patterns between modes
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkMemoryUsage (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateComparisonTestData(size);

		// Test memory usage for mutable store
		if (global.gc) {
			global.gc();
		}
		const memBefore = process.memoryUsage().heapUsed;

		const mutableStore = haro(testData, { immutable: false, index: ["department", "active"] });

		if (global.gc) {
			global.gc();
		}
		const memAfterMutable = process.memoryUsage().heapUsed;

		// Test memory usage for immutable store
		const immutableStore = haro(testData, { immutable: true, index: ["department", "active"] });

		if (global.gc) {
			global.gc();
		}
		const memAfterImmutable = process.memoryUsage().heapUsed;

		// Test memory usage during operations
		const operationsStart = performance.now();

		// Perform some operations on mutable store
		for (let i = 0; i < Math.min(100, size); i++) {
			const result = mutableStore.find({ department: `Dept ${i % 10}` }); // eslint-disable-line no-unused-vars
			mutableStore.set(`temp_${i}`, { ...testData[0], temp: true });
		}

		if (global.gc) {
			global.gc();
		}
		const memAfterMutableOps = process.memoryUsage().heapUsed;

		// Perform same operations on immutable store
		for (let i = 0; i < Math.min(100, size); i++) {
			const result = immutableStore.find({ department: `Dept ${i % 10}` }); // eslint-disable-line no-unused-vars
			immutableStore.set(`temp_${i}`, { ...testData[0], temp: true });
		}

		if (global.gc) {
			global.gc();
		}
		const memAfterImmutableOps = process.memoryUsage().heapUsed;

		const operationsEnd = performance.now();

		results.push({
			name: `Memory usage comparison (${size} records)`,
			iterations: 1,
			totalTime: operationsEnd - operationsStart,
			avgTime: 0,
			opsPerSecond: Math.floor(200 / ((operationsEnd - operationsStart) / 1000)), // 200 ops total
			mutableStoreMemory: (memAfterMutable - memBefore) / 1024 / 1024, // MB
			immutableStoreMemory: (memAfterImmutable - memAfterMutable) / 1024 / 1024, // MB
			mutableOpsMemory: (memAfterMutableOps - memAfterMutable) / 1024 / 1024, // MB
			immutableOpsMemory: (memAfterImmutableOps - memAfterMutableOps) / 1024 / 1024, // MB
			totalMutableMemory: (memAfterMutableOps - memBefore) / 1024 / 1024, // MB
			totalImmutableMemory: (memAfterImmutableOps - memAfterMutable) / 1024 / 1024 // MB
		});
	});

	return results;
}

/**
 * Benchmarks data safety and mutation detection
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkDataSafety (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateComparisonTestData(Math.min(size, 100)); // Limit for safety tests

		// Create stores
		const mutableStore = haro(testData, { immutable: false });
		const immutableStore = haro(testData, { immutable: true });

		// Test mutation safety
		const mutableRecord = mutableStore.get(0);
		const immutableRecord = immutableStore.get(0);

		// Attempt to mutate records
		const mutationStart = performance.now();

		try {
			// This should work for mutable
			mutableRecord.name = "MUTATED";
			mutableRecord.tags.push("new-tag");
		} catch (e) { // eslint-disable-line no-unused-vars
			// Mutation failed
		}

		try {
			// This should fail for immutable
			immutableRecord.name = "MUTATED";
			immutableRecord.tags.push("new-tag");
		} catch (e) { // eslint-disable-line no-unused-vars
			// Expected failure for immutable
		}

		const mutationEnd = performance.now();

		// Check if mutations actually occurred
		const mutableRecordAfter = mutableStore.get(0);
		const immutableRecordAfter = immutableStore.get(0);

		results.push({
			name: `Data safety analysis (${testData.length} records)`,
			iterations: 1,
			totalTime: mutationEnd - mutationStart,
			avgTime: 0,
			opsPerSecond: 0,
			mutableMutated: mutableRecordAfter.name === "MUTATED",
			immutableMutated: immutableRecordAfter.name === "MUTATED",
			mutableProtected: mutableRecordAfter.name !== "MUTATED",
			immutableProtected: immutableRecordAfter.name !== "MUTATED",
			recommendation: "Use immutable mode for data safety in multi-consumer environments"
		});
	});

	return results;
}

/**
 * Generates performance recommendations based on benchmark results
 * @param {Array} results - All benchmark results
 * @returns {Object} Performance recommendations
 */
function generatePerformanceRecommendations (results) {
	const recommendations = {
		general: [],
		mutableAdvantages: [],
		immutableAdvantages: [],
		useCase: {}
	};

	// Analyze results to generate recommendations
	const mutableOps = results.filter(r => r.name.includes("MUTABLE")).map(r => r.opsPerSecond);
	const immutableOps = results.filter(r => r.name.includes("IMMUTABLE")).map(r => r.opsPerSecond);

	const avgMutablePerf = mutableOps.reduce((a, b) => a + b, 0) / mutableOps.length;
	const avgImmutablePerf = immutableOps.reduce((a, b) => a + b, 0) / immutableOps.length;

	if (avgMutablePerf > avgImmutablePerf * 1.2) {
		recommendations.general.push("Mutable mode shows significant performance advantages");
		recommendations.mutableAdvantages.push("Faster overall operations");
	} else if (avgImmutablePerf > avgMutablePerf * 1.2) {
		recommendations.general.push("Immutable mode shows competitive performance");
		recommendations.immutableAdvantages.push("Good performance with data safety");
	} else {
		recommendations.general.push("Performance difference is minimal between modes");
	}

	// Use case recommendations
	recommendations.useCase = {
		"High-frequency writes": "Consider mutable mode for better write performance",
		"Data safety critical": "Use immutable mode to prevent accidental mutations",
		"Multi-consumer reads": "Immutable mode provides safer concurrent access",
		"Memory constrained": "Mutable mode may use less memory",
		"Development/debugging": "Immutable mode helps catch mutation bugs early"
	};

	return recommendations;
}

/**
 * Prints formatted benchmark results with detailed analysis
 * @param {Array} results - Array of benchmark results
 */
function printResults (results) {
	console.log("\n" + "=".repeat(80));
	console.log("IMMUTABLE vs MUTABLE COMPARISON RESULTS");
	console.log("=".repeat(80));

	// Group results by operation type
	const groupedResults = {};
	results.forEach(result => {
		const operation = result.name.split(" ").slice(-2, -1)[0] || "Analysis";
		if (!groupedResults[operation]) {
			groupedResults[operation] = [];
		}
		groupedResults[operation].push(result);
	});

	Object.keys(groupedResults).forEach(operation => {
		console.log(`\n${operation.toUpperCase()} OPERATIONS:`);
		console.log("-".repeat(50));

		groupedResults[operation].forEach(result => {
			if (result.opsPerSecond > 0) {
				const opsIndicator = result.opsPerSecond > 1000 ? "✅" :
					result.opsPerSecond > 100 ? "🟡" :
						result.opsPerSecond > 10 ? "🟠" : "🔴";

				console.log(`${opsIndicator} ${result.name}`);
				console.log(`   ${result.opsPerSecond.toLocaleString()} ops/sec | ${result.totalTime.toFixed(2)}ms total`);
			} else {
				console.log(`📊 ${result.name}`);
			}

			// Special formatting for analysis results
			if (result.ratio) {
				console.log(`   Performance ratio: ${result.ratio}`);
				console.log(`   Recommendation: ${result.recommendation}`);
			}

			if (result.mutableStoreMemory !== undefined) {
				console.log(`   Memory - Mutable store: ${result.mutableStoreMemory.toFixed(2)}MB | Immutable store: ${result.immutableStoreMemory.toFixed(2)}MB`);
				console.log(`   Memory - Mutable ops: +${result.mutableOpsMemory.toFixed(2)}MB | Immutable ops: +${result.immutableOpsMemory.toFixed(2)}MB`);
			}

			if (result.mutableMutated !== undefined) {
				console.log(`   Mutable protection: ${result.mutableProtected ? "❌" : "✅"} | Immutable protection: ${result.immutableProtected ? "✅" : "❌"}`);
				console.log(`   ${result.recommendation}`);
			}

			console.log("");
		});
	});

	// Generate and display recommendations
	const recommendations = generatePerformanceRecommendations(results);
	console.log("\n" + "=".repeat(80));
	console.log("PERFORMANCE RECOMMENDATIONS");
	console.log("=".repeat(80));

	console.log("\nGeneral Findings:");
	recommendations.general.forEach(rec => console.log(`• ${rec}`));

	console.log("\nUse Case Recommendations:");
	Object.keys(recommendations.useCase).forEach(useCase => {
		console.log(`• ${useCase}: ${recommendations.useCase[useCase]}`);
	});

	console.log("");
}

/**
 * Runs all immutable vs mutable comparison benchmarks
 * @returns {Array} Array of all benchmark results
 */
function runImmutableComparisonBenchmarks () {
	console.log("Starting Immutable vs Mutable Comparison Benchmarks...\n");

	const dataSizes = [100, 1000, 5000];
	let allResults = [];

	console.log("Testing store creation...");
	allResults.push(...benchmarkStoreCreation(dataSizes));

	console.log("Testing CRUD operations...");
	allResults.push(...benchmarkCrudOperations(dataSizes));

	console.log("Testing query operations...");
	allResults.push(...benchmarkQueryOperations(dataSizes));

	console.log("Testing transformation operations...");
	allResults.push(...benchmarkTransformationOperations(dataSizes));

	console.log("Testing memory usage...");
	allResults.push(...benchmarkMemoryUsage([1000, 5000])); // Smaller sizes for memory tests

	console.log("Testing data safety...");
	allResults.push(...benchmarkDataSafety([100])); // Small size for safety tests

	printResults(allResults);

	console.log("Immutable vs Mutable Comparison Benchmarks completed.\n");

	return allResults;
}

// Export for use in main benchmark runner
export { runImmutableComparisonBenchmarks };

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runImmutableComparisonBenchmarks();
}
