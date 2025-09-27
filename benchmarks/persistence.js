import { performance } from "node:perf_hooks";
import { haro } from "../dist/haro.js";

/**
 * Generates test data for persistence benchmarking
 * @param {number} size - Number of records to generate
 * @returns {Array} Array of test records optimized for persistence testing
 */
function generatePersistenceTestData (size) {
	const data = [];
	const departments = ["Engineering", "Marketing", "Sales", "HR", "Finance", "Operations"];
	const locations = ["NYC", "SF", "LA", "Chicago", "Boston", "Austin"];

	for (let i = 0; i < size; i++) {
		data.push({
			id: i,
			name: `Employee ${i}`,
			email: `employee${i}@company.com`,
			department: departments[i % departments.length],
			location: locations[i % locations.length],
			startDate: new Date(2020 + i % 4, i % 12, i % 28 + 1),
			salary: 50000 + i % 100000,
			active: Math.random() > 0.1,
			skills: Array.from({ length: Math.floor(Math.random() * 5) + 1 },
				(_, j) => `skill${(i + j) % 20}`),
			projects: Array.from({ length: Math.floor(i % 10) + 1 },
				(_, j) => ({ id: `proj${i}-${j}`, name: `Project ${i}-${j}` })),
			metadata: {
				created: new Date(),
				updated: new Date(),
				version: Math.floor(i / 1000) + 1,
				tags: [`tag${i % 15}`, `category${i % 8}`],
				preferences: {
					theme: i % 2 === 0 ? "dark" : "light",
					language: i % 3 === 0 ? "en" : i % 3 === 1 ? "es" : "fr",
					timezone: `UTC${i % 24 - 12}`
				}
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
function benchmark (name, fn, iterations = 10) {
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
 * Benchmarks dump operations for different data types
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkDumpOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generatePersistenceTestData(size);
		const store = haro(testData, {
			index: ["department", "location", "active", "skills", "department|location", "active|department"]
		});

		// Dump records
		const dumpRecordsResult = benchmark(`DUMP records (${size} records)`, () => {
			return store.dump("records");
		});
		results.push(dumpRecordsResult);

		// Dump indexes
		const dumpIndexesResult = benchmark(`DUMP indexes (${size} records)`, () => {
			return store.dump("indexes");
		});
		results.push(dumpIndexesResult);

		// Test dump data size and structure
		const recordsDump = store.dump("records");
		const indexesDump = store.dump("indexes");

		results.push({
			name: `DUMP data analysis (${size} records)`,
			iterations: 1,
			totalTime: 0,
			avgTime: 0,
			opsPerSecond: 0,
			recordsSize: recordsDump.length,
			indexesSize: indexesDump.length,
			recordsDataSize: JSON.stringify(recordsDump).length,
			indexesDataSize: JSON.stringify(indexesDump).length
		});
	});

	return results;
}

/**
 * Benchmarks override operations with different data formats
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkOverrideOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generatePersistenceTestData(size);
		const sourceStore = haro(testData, {
			index: ["department", "location", "active", "skills"]
		});

		// Get dump data for override testing
		const recordsDump = sourceStore.dump("records");
		const indexesDump = sourceStore.dump("indexes");

		// Override with records
		const overrideRecordsResult = benchmark(`OVERRIDE records (${size} records)`, () => {
			const targetStore = haro();
			targetStore.override(recordsDump, "records");

			return targetStore;
		});
		results.push(overrideRecordsResult);

		// Override with indexes
		const overrideIndexesResult = benchmark(`OVERRIDE indexes (${size} records)`, () => {
			const targetStore = haro(testData);
			targetStore.override(indexesDump, "indexes");

			return targetStore;
		});
		results.push(overrideIndexesResult);

		// Complete restoration (records + indexes)
		const completeRestoreResult = benchmark(`OVERRIDE complete restore (${size} records)`, () => {
			const targetStore = haro();
			targetStore.override(recordsDump, "records");
			targetStore.override(indexesDump, "indexes");

			return targetStore;
		});
		results.push(completeRestoreResult);

		// Validate restored data integrity
		const targetStore = haro();
		targetStore.override(recordsDump, "records");
		targetStore.override(indexesDump, "indexes");

		const integrityResult = {
			name: `OVERRIDE integrity check (${size} records)`,
			iterations: 1,
			totalTime: 0,
			avgTime: 0,
			opsPerSecond: 0,
			originalSize: sourceStore.size,
			restoredSize: targetStore.size,
			integrityMatch: sourceStore.size === targetStore.size,
			sampleRecordMatch: JSON.stringify(sourceStore.get(0)) === JSON.stringify(targetStore.get(0))
		};
		results.push(integrityResult);
	});

	return results;
}

/**
 * Benchmarks round-trip persistence (dump + override) operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkRoundTripPersistence (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generatePersistenceTestData(size);
		const sourceStore = haro(testData, {
			index: ["department", "location", "active", "skills", "department|location"],
			versioning: true
		});

		// Perform some operations to create versions
		for (let i = 0; i < Math.min(10, size); i++) {
			sourceStore.set(i.toString(), { ...testData[i], updated: new Date() });
		}

		// Round-trip with records only
		const roundTripRecordsResult = benchmark(`Round-trip records only (${size} records)`, () => {
			// Dump
			const dump = sourceStore.dump("records");
			// Restore
			const targetStore = haro();
			targetStore.override(dump, "records");

			return targetStore;
		});
		results.push(roundTripRecordsResult);

		// Round-trip with complete state (records + indexes)
		const roundTripCompleteResult = benchmark(`Round-trip complete state (${size} records)`, () => {
			// Dump both
			const recordsDump = sourceStore.dump("records");
			const indexesDump = sourceStore.dump("indexes");
			// Restore
			const targetStore = haro();
			targetStore.override(recordsDump, "records");
			targetStore.override(indexesDump, "indexes");

			return targetStore;
		});
		results.push(roundTripCompleteResult);

		// Test with different store configurations
		const roundTripConfigResult = benchmark(`Round-trip with config restore (${size} records)`, () => {
			const recordsDump = sourceStore.dump("records");
			const targetStore = haro(null, {
				index: ["department", "location", "active"],
				versioning: true,
				immutable: true
			});
			targetStore.override(recordsDump, "records");
			targetStore.reindex(); // Rebuild indexes with new config

			return targetStore;
		});
		results.push(roundTripConfigResult);
	});

	return results;
}

/**
 * Benchmarks persistence with memory efficiency
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkPersistenceMemory (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generatePersistenceTestData(size);

		if (global.gc) {
			global.gc();
		}
		const memBefore = process.memoryUsage().heapUsed;

		// Create store and measure memory
		const store = haro(testData, {
			index: ["department", "location", "active", "skills"]
		});

		if (global.gc) {
			global.gc();
		}
		const memAfterCreate = process.memoryUsage().heapUsed;

		// Dump and measure memory impact
		const dumpStart = performance.now();
		const recordsDump = store.dump("records");
		const indexesDump = store.dump("indexes");
		const dumpEnd = performance.now();

		if (global.gc) {
			global.gc();
		}
		const memAfterDump = process.memoryUsage().heapUsed;

		// Override and measure memory impact
		const overrideStart = performance.now();
		const newStore = haro();
		newStore.override(recordsDump, "records");
		newStore.override(indexesDump, "indexes");
		const overrideEnd = performance.now();

		if (global.gc) {
			global.gc();
		}
		const memAfterOverride = process.memoryUsage().heapUsed;

		// Cleanup dumps and measure memory recovery
		// (In real usage, dumps would be serialized and stored externally)
		const memAfterCleanup = process.memoryUsage().heapUsed;

		results.push({
			name: `Memory efficiency analysis (${size} records)`,
			iterations: 1,
			totalTime: dumpEnd - dumpStart + (overrideEnd - overrideStart),
			dumpTime: dumpEnd - dumpStart,
			overrideTime: overrideEnd - overrideStart,
			originalMemory: (memAfterCreate - memBefore) / 1024 / 1024, // MB
			dumpMemoryImpact: (memAfterDump - memAfterCreate) / 1024 / 1024, // MB
			overrideMemoryImpact: (memAfterOverride - memAfterDump) / 1024 / 1024, // MB
			finalMemory: (memAfterCleanup - memBefore) / 1024 / 1024, // MB
			opsPerSecond: Math.floor(1000 / (dumpEnd - dumpStart + (overrideEnd - overrideStart)))
		});
	});

	return results;
}

/**
 * Benchmarks persistence with large complex objects
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkComplexObjectPersistence (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		// Generate more complex test data
		const complexData = [];
		for (let i = 0; i < size; i++) {
			complexData.push({
				id: i,
				profile: {
					personal: {
						name: `User ${i}`,
						email: `user${i}@test.com`,
						birth: new Date(1990 + i % 30, i % 12, i % 28 + 1)
					},
					professional: {
						title: `Title ${i % 20}`,
						department: `Dept ${i % 10}`,
						experience: Array.from({ length: i % 5 + 1 }, (_, j) => ({
							company: `Company ${j}`,
							role: `Role ${j}`,
							duration: `${j + 1} years`
						}))
					}
				},
				activities: Array.from({ length: i % 50 + 1 }, (_, j) => ({
					id: `activity_${i}_${j}`,
					type: `type_${j % 10}`,
					timestamp: new Date(Date.now() - j * 86400000),
					data: {
						action: `action_${j}`,
						details: { value: Math.random() * 1000, category: `cat_${j % 5}` }
					}
				})),
				settings: {
					preferences: Object.fromEntries(
						Array.from({ length: 20 }, (_, j) => [`pref_${j}`, Math.random() > 0.5])
					),
					permissions: Array.from({ length: 10 }, (_, j) => `perm_${j}`)
				}
			});
		}

		const store = haro(complexData, {
			index: ["profile.professional.department", "settings.permissions"]
		});

		// Dump complex objects
		const dumpComplexResult = benchmark(`DUMP complex objects (${size} records)`, () => {
			return store.dump("records");
		});
		results.push(dumpComplexResult);

		// Override complex objects
		const dump = store.dump("records");
		const overrideComplexResult = benchmark(`OVERRIDE complex objects (${size} records)`, () => {
			const targetStore = haro();
			targetStore.override(dump, "records");

			return targetStore;
		});
		results.push(overrideComplexResult);

		// Analyze data complexity impact
		const dataComplexityResult = {
			name: `Complex object analysis (${size} records)`,
			iterations: 1,
			totalTime: 0,
			avgTime: 0,
			opsPerSecond: 0,
			averageObjectSize: JSON.stringify(complexData[0]).length,
			totalDataSize: JSON.stringify(dump).length,
			compressionRatio: JSON.stringify(dump).length / JSON.stringify(complexData).length
		};
		results.push(dataComplexityResult);
	});

	return results;
}

/**
 * Prints formatted benchmark results
 * @param {Array} results - Array of benchmark results
 */
function printResults (results) {
	console.log("\n" + "=".repeat(80));
	console.log("PERSISTENCE BENCHMARK RESULTS");
	console.log("=".repeat(80));

	results.forEach(result => {
		const opsIndicator = result.opsPerSecond > 100 ? "✅" :
			result.opsPerSecond > 10 ? "🟡" :
				result.opsPerSecond > 1 ? "🟠" : "🔴";

		if (result.opsPerSecond > 0) {
			console.log(`${opsIndicator} ${result.name}`);
			console.log(`   ${result.opsPerSecond.toLocaleString()} ops/sec | ${result.totalTime.toFixed(2)}ms total | ${result.avgTime?.toFixed(4) || "N/A"}ms avg`);
		} else {
			console.log(`📊 ${result.name}`);
		}

		// Special formatting for different result types
		if (result.recordsSize !== undefined) {
			console.log(`   Records: ${result.recordsSize} items, ${(result.recordsDataSize / 1024).toFixed(2)}KB`);
			console.log(`   Indexes: ${result.indexesSize} items, ${(result.indexesDataSize / 1024).toFixed(2)}KB`);
		}

		if (result.integrityMatch !== undefined) {
			console.log(`   Original: ${result.originalSize} | Restored: ${result.restoredSize}`);
			console.log(`   Integrity: ${result.integrityMatch ? "✅" : "❌"} | Sample match: ${result.sampleRecordMatch ? "✅" : "❌"}`);
		}

		if (result.originalMemory !== undefined) {
			console.log(`   Dump: ${result.dumpTime.toFixed(2)}ms | Override: ${result.overrideTime.toFixed(2)}ms`);
			console.log(`   Memory - Original: ${result.originalMemory.toFixed(2)}MB | Final: ${result.finalMemory.toFixed(2)}MB`);
			console.log(`   Memory Impact - Dump: ${result.dumpMemoryImpact.toFixed(2)}MB | Override: ${result.overrideMemoryImpact.toFixed(2)}MB`);
		}

		if (result.averageObjectSize !== undefined) {
			console.log(`   Avg object: ${result.averageObjectSize} bytes | Total: ${(result.totalDataSize / 1024).toFixed(2)}KB`);
			console.log(`   Compression ratio: ${(result.compressionRatio * 100).toFixed(1)}%`);
		}

		console.log("");
	});
}

/**
 * Runs all persistence benchmarks
 * @returns {Array} Array of all benchmark results
 */
function runPersistenceBenchmarks () {
	console.log("Starting Persistence Benchmarks...\n");

	const dataSizes = [1000, 10000, 50000];
	let allResults = [];

	console.log("Testing dump operations...");
	allResults.push(...benchmarkDumpOperations(dataSizes));

	console.log("Testing override operations...");
	allResults.push(...benchmarkOverrideOperations(dataSizes));

	console.log("Testing round-trip persistence...");
	allResults.push(...benchmarkRoundTripPersistence(dataSizes));

	console.log("Testing persistence memory efficiency...");
	allResults.push(...benchmarkPersistenceMemory([100, 1000])); // Smaller sizes for memory tests

	console.log("Testing complex object persistence...");
	allResults.push(...benchmarkComplexObjectPersistence([50, 500])); // Smaller sizes for complex data

	printResults(allResults);

	console.log("Persistence Benchmarks completed.\n");

	return allResults;
}

// Export for use in main benchmark runner
export { runPersistenceBenchmarks };

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runPersistenceBenchmarks();
}
