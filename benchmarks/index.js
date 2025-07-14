import { runBasicOperationsBenchmarks } from "./basic-operations.js";
import { runSearchFilterBenchmarks } from "./search-filter.js";
import { runIndexOperationsBenchmarks } from "./index-operations.js";
import { runMemoryBenchmarks } from "./memory-usage.js";
import { runComparisonBenchmarks } from "./comparison.js";
import { runUtilityOperationsBenchmarks } from "./utility-operations.js";
import { runPaginationBenchmarks } from "./pagination.js";
import { runPersistenceBenchmarks } from "./persistence.js";
import { runImmutableComparisonBenchmarks } from "./immutable-comparison.js";

/**
 * Formats duration in milliseconds to human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDuration (ms) {
	if (ms < 1000) {
		return `${ms.toFixed(0)}ms`;
	} else if (ms < 60000) {
		return `${(ms / 1000).toFixed(1)}s`;
	} else {
		return `${(ms / 60000).toFixed(1)}m`;
	}
}

/**
 * Generates a summary report of all benchmark results
 * @param {Object} results - All benchmark results
 * @returns {Object} Summary report
 */
function generateSummaryReport (results) {
	const { basicOps, searchFilter, indexOps, memory, comparison, utilities, pagination, persistence, immutableComparison } = results;

	const summary = {
		totalTests: 0,
		totalTime: 0,
		categories: {},
		performance: {
			fastest: { name: "", opsPerSecond: 0 },
			slowest: { name: "", opsPerSecond: Infinity },
			mostMemoryEfficient: { name: "", memoryUsed: Infinity },
			leastMemoryEfficient: { name: "", memoryUsed: 0 }
		},
		recommendations: []
	};

	// Process basic operations
	if (basicOps && basicOps.length > 0) {
		summary.categories.basicOperations = {
			testCount: basicOps.length,
			totalTime: basicOps.reduce((sum, test) => sum + test.totalTime, 0),
			avgOpsPerSecond: basicOps.reduce((sum, test) => sum + test.opsPerSecond, 0) / basicOps.length
		};

		// Find fastest and slowest operations
		basicOps.forEach(test => {
			if (test.opsPerSecond > summary.performance.fastest.opsPerSecond) {
				summary.performance.fastest = { name: test.name, opsPerSecond: test.opsPerSecond };
			}
			if (test.opsPerSecond < summary.performance.slowest.opsPerSecond) {
				summary.performance.slowest = { name: test.name, opsPerSecond: test.opsPerSecond };
			}
		});
	}

	// Process search and filter operations
	if (searchFilter && searchFilter.length > 0) {
		summary.categories.searchFilter = {
			testCount: searchFilter.length,
			totalTime: searchFilter.reduce((sum, test) => sum + test.totalTime, 0),
			avgOpsPerSecond: searchFilter.reduce((sum, test) => sum + test.opsPerSecond, 0) / searchFilter.length
		};
	}

	// Process index operations
	if (indexOps && indexOps.length > 0) {
		summary.categories.indexOperations = {
			testCount: indexOps.length,
			totalTime: indexOps.reduce((sum, test) => sum + test.totalTime, 0),
			avgOpsPerSecond: indexOps.reduce((sum, test) => sum + test.opsPerSecond, 0) / indexOps.length
		};
	}

	// Process memory results
	if (memory && memory.results && memory.results.length > 0) {
		summary.categories.memoryUsage = {
			testCount: memory.results.length,
			totalTime: memory.results.reduce((sum, test) => sum + test.executionTime, 0),
			avgHeapDelta: memory.results.reduce((sum, test) => sum + test.memoryDelta.heapUsed, 0) / memory.results.length
		};

		// Find memory efficiency
		memory.results.forEach(test => {
			if (test.memoryDelta.heapUsed < summary.performance.mostMemoryEfficient.memoryUsed) {
				summary.performance.mostMemoryEfficient = {
					name: test.description,
					memoryUsed: test.memoryDelta.heapUsed
				};
			}
			if (test.memoryDelta.heapUsed > summary.performance.leastMemoryEfficient.memoryUsed) {
				summary.performance.leastMemoryEfficient = {
					name: test.description,
					memoryUsed: test.memoryDelta.heapUsed
				};
			}
		});
	}

	// Process comparison results
	if (comparison && comparison.allResults && comparison.allResults.length > 0) {
		summary.categories.comparison = {
			testCount: comparison.allResults.length,
			totalTime: comparison.allResults.reduce((sum, test) => sum + test.totalTime, 0),
			avgOpsPerSecond: comparison.allResults.reduce((sum, test) => sum + test.opsPerSecond, 0) / comparison.allResults.length
		};
	}

	// Process utility operations
	if (utilities && utilities.length > 0) {
		summary.categories.utilityOperations = {
			testCount: utilities.length,
			totalTime: utilities.reduce((sum, test) => sum + test.totalTime, 0),
			avgOpsPerSecond: utilities.reduce((sum, test) => sum + test.opsPerSecond, 0) / utilities.length
		};
	}

	// Process pagination results
	if (pagination && pagination.length > 0) {
		summary.categories.pagination = {
			testCount: pagination.length,
			totalTime: pagination.reduce((sum, test) => sum + test.totalTime, 0),
			avgOpsPerSecond: pagination.reduce((sum, test) => sum + test.opsPerSecond, 0) / pagination.length
		};
	}

	// Process persistence results
	if (persistence && persistence.length > 0) {
		summary.categories.persistence = {
			testCount: persistence.length,
			totalTime: persistence.reduce((sum, test) => sum + test.totalTime, 0),
			avgOpsPerSecond: persistence.filter(test => test.opsPerSecond > 0).reduce((sum, test) => sum + test.opsPerSecond, 0) / persistence.filter(test => test.opsPerSecond > 0).length || 0
		};
	}

	// Process immutable comparison results
	if (immutableComparison && immutableComparison.length > 0) {
		summary.categories.immutableComparison = {
			testCount: immutableComparison.length,
			totalTime: immutableComparison.reduce((sum, test) => sum + test.totalTime, 0),
			avgOpsPerSecond: immutableComparison.filter(test => test.opsPerSecond > 0).reduce((sum, test) => sum + test.opsPerSecond, 0) / immutableComparison.filter(test => test.opsPerSecond > 0).length || 0
		};
	}

	// Calculate totals
	summary.totalTests = Object.values(summary.categories).reduce((sum, cat) => sum + cat.testCount, 0);
	summary.totalTime = Object.values(summary.categories).reduce((sum, cat) => sum + cat.totalTime, 0);

	// Generate recommendations
	if (summary.categories.basicOperations && summary.categories.basicOperations.avgOpsPerSecond > 10000) {
		summary.recommendations.push("✅ Basic operations performance is excellent for most use cases");
	}

	if (summary.categories.indexOperations && summary.categories.searchFilter) {
		const indexAvg = summary.categories.indexOperations.avgOpsPerSecond;
		const searchAvg = summary.categories.searchFilter.avgOpsPerSecond;
		if (indexAvg > searchAvg * 2) {
			summary.recommendations.push("💡 Consider using indexed queries (find) instead of filters for better performance");
		}
	}

	if (summary.categories.memoryUsage && summary.categories.memoryUsage.avgHeapDelta < 10) {
		summary.recommendations.push("✅ Memory usage is efficient for typical workloads");
	} else if (summary.categories.memoryUsage && summary.categories.memoryUsage.avgHeapDelta > 50) {
		summary.recommendations.push("⚠️ Consider optimizing memory usage for large datasets");
	}

	if (summary.categories.comparison) {
		summary.recommendations.push("📊 Review comparison results to understand trade-offs vs native structures");
	}

	if (summary.categories.utilityOperations && summary.categories.utilityOperations.avgOpsPerSecond > 1000) {
		summary.recommendations.push("✅ Utility operations (clone, merge, freeze) perform well");
	}

	if (summary.categories.pagination && summary.categories.pagination.avgOpsPerSecond > 100) {
		summary.recommendations.push("✅ Pagination performance is suitable for typical UI requirements");
	}

	if (summary.categories.persistence) {
		summary.recommendations.push("💾 Persistence operations available for data serialization needs");
	}

	if (summary.categories.immutableComparison) {
		summary.recommendations.push("🔒 Review immutable vs mutable comparison for data safety vs performance trade-offs");
	}

	return summary;
}

/**
 * Prints the summary report
 * @param {Object} summary - Summary report object
 */
function printSummaryReport (summary) {
	console.log("\n" + "=".repeat(80));
	console.log("🎯 HARO BENCHMARK SUMMARY REPORT");
	console.log("=".repeat(80));

	console.log("\n📊 OVERVIEW:");
	console.log(`   Total Tests: ${summary.totalTests}`);
	console.log(`   Total Time: ${formatDuration(summary.totalTime)}`);
	console.log(`   Categories: ${Object.keys(summary.categories).length}`);

	console.log("\n🏆 PERFORMANCE HIGHLIGHTS:");
	console.log(`   Fastest Operation: ${summary.performance.fastest.name}`);
	console.log(`   └── ${summary.performance.fastest.opsPerSecond.toLocaleString()} ops/second`);
	console.log(`   Slowest Operation: ${summary.performance.slowest.name}`);
	console.log(`   └── ${summary.performance.slowest.opsPerSecond.toLocaleString()} ops/second`);

	if (summary.performance.mostMemoryEfficient.memoryUsed !== Infinity) {
		console.log("\n💾 MEMORY EFFICIENCY:");
		console.log(`   Most Efficient: ${summary.performance.mostMemoryEfficient.name}`);
		console.log(`   └── ${summary.performance.mostMemoryEfficient.memoryUsed.toFixed(2)} MB`);
		console.log(`   Least Efficient: ${summary.performance.leastMemoryEfficient.name}`);
		console.log(`   └── ${summary.performance.leastMemoryEfficient.memoryUsed.toFixed(2)} MB`);
	}

	console.log("\n📋 CATEGORY BREAKDOWN:");
	Object.entries(summary.categories).forEach(([category, stats]) => {
		console.log(`   ${category}:`);
		console.log(`   ├── Tests: ${stats.testCount}`);
		console.log(`   ├── Time: ${formatDuration(stats.totalTime)}`);
		if (stats.avgOpsPerSecond) {
			console.log(`   └── Avg Performance: ${stats.avgOpsPerSecond.toFixed(0)} ops/second`);
		} else if (stats.avgHeapDelta) {
			console.log(`   └── Avg Memory: ${stats.avgHeapDelta.toFixed(2)} MB`);
		}
	});

	if (summary.recommendations.length > 0) {
		console.log("\n💡 RECOMMENDATIONS:");
		summary.recommendations.forEach(rec => {
			console.log(`   ${rec}`);
		});
	}

	console.log("\n" + "=".repeat(80));
	console.log("🏁 BENCHMARK COMPLETE");
	console.log("=".repeat(80) + "\n");
}

/**
 * Main function to run all benchmarks
 * @param {Object} options - Benchmark options
 * @returns {Object} All benchmark results
 */
async function runAllBenchmarks (options = {}) {
	const {
		includeBasic = true,
		includeSearch = true,
		includeIndex = true,
		includeMemory = true,
		includeComparison = true,
		includeUtilities = true,
		includePagination = true,
		includePersistence = true,
		includeImmutableComparison = true,
		verbose = true
	} = options;

	const results = {};
	const startTime = Date.now();

	console.log("🚀 Starting Haro Benchmark Suite...\n");
	console.log("📋 Benchmark Configuration:");
	console.log(`   Node.js Version: ${process.version}`);
	console.log(`   Platform: ${process.platform}`);
	console.log(`   Architecture: ${process.arch}`);
	console.log(`   Memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB available\n`);

	try {
		// Run basic operations benchmarks
		if (includeBasic) {
			if (verbose) console.log("⏳ Running basic operations benchmarks...");
			results.basicOps = runBasicOperationsBenchmarks();
			if (verbose) console.log("✅ Basic operations benchmarks completed\n");
		}

		// Run search and filter benchmarks
		if (includeSearch) {
			if (verbose) console.log("⏳ Running search and filter benchmarks...");
			results.searchFilter = runSearchFilterBenchmarks();
			if (verbose) console.log("✅ Search and filter benchmarks completed\n");
		}

		// Run index operations benchmarks
		if (includeIndex) {
			if (verbose) console.log("⏳ Running index operations benchmarks...");
			results.indexOps = runIndexOperationsBenchmarks();
			if (verbose) console.log("✅ Index operations benchmarks completed\n");
		}

		// Run memory benchmarks
		if (includeMemory) {
			if (verbose) console.log("⏳ Running memory usage benchmarks...");
			results.memory = runMemoryBenchmarks();
			if (verbose) console.log("✅ Memory usage benchmarks completed\n");
		}

		// Run comparison benchmarks
		if (includeComparison) {
			if (verbose) console.log("⏳ Running comparison benchmarks...");
			results.comparison = runComparisonBenchmarks();
			if (verbose) console.log("✅ Comparison benchmarks completed\n");
		}

		// Run utility operations benchmarks
		if (includeUtilities) {
			if (verbose) console.log("⏳ Running utility operations benchmarks...");
			results.utilities = runUtilityOperationsBenchmarks();
			if (verbose) console.log("✅ Utility operations benchmarks completed\n");
		}

		// Run pagination benchmarks
		if (includePagination) {
			if (verbose) console.log("⏳ Running pagination benchmarks...");
			results.pagination = runPaginationBenchmarks();
			if (verbose) console.log("✅ Pagination benchmarks completed\n");
		}

		// Run persistence benchmarks
		if (includePersistence) {
			if (verbose) console.log("⏳ Running persistence benchmarks...");
			results.persistence = runPersistenceBenchmarks();
			if (verbose) console.log("✅ Persistence benchmarks completed\n");
		}

		// Run immutable vs mutable comparison benchmarks
		if (includeImmutableComparison) {
			if (verbose) console.log("⏳ Running immutable vs mutable comparison benchmarks...");
			results.immutableComparison = runImmutableComparisonBenchmarks();
			if (verbose) console.log("✅ Immutable vs mutable comparison benchmarks completed\n");
		}

		const endTime = Date.now();
		const totalDuration = endTime - startTime;

		// Generate and print summary
		const summary = generateSummaryReport(results);
		summary.totalDuration = totalDuration;

		if (verbose) {
			printSummaryReport(summary);
		}

		return { results, summary };

	} catch (error) {
		console.error("❌ Benchmark suite failed:", error);
		throw error;
	}
}

/**
 * CLI argument parser
 * @returns {Object} Parsed CLI options
 */
function parseCliArguments () {
	const args = process.argv.slice(2);
	const options = {
		includeBasic: true,
		includeSearch: true,
		includeIndex: true,
		includeMemory: true,
		includeComparison: true,
		includeUtilities: true,
		includePagination: true,
		includePersistence: true,
		includeImmutableComparison: true,
		verbose: true
	};

	// Helper function to disable all categories except the specified one
	const runOnlyCategory = category => {
		Object.keys(options).forEach(key => {
			if (key.startsWith("include") && key !== category) {
				options[key] = false;
			}
		});
	};

	args.forEach(arg => {
		switch (arg) { // eslint-disable-line default-case
			case "--basic-only":
				runOnlyCategory("includeBasic");
				break;
			case "--search-only":
				runOnlyCategory("includeSearch");
				break;
			case "--index-only":
				runOnlyCategory("includeIndex");
				break;
			case "--memory-only":
				runOnlyCategory("includeMemory");
				break;
			case "--comparison-only":
				runOnlyCategory("includeComparison");
				break;
			case "--utilities-only":
				runOnlyCategory("includeUtilities");
				break;
			case "--pagination-only":
				runOnlyCategory("includePagination");
				break;
			case "--persistence-only":
				runOnlyCategory("includePersistence");
				break;
			case "--immutable-only":
				runOnlyCategory("includeImmutableComparison");
				break;
			case "--core-only":
				// Run only core benchmarks (basic, search, index)
				options.includeMemory = false;
				options.includeComparison = false;
				options.includeUtilities = false;
				options.includePagination = false;
				options.includePersistence = false;
				options.includeImmutableComparison = false;
				break;
			case "--advanced-only":
				// Run only advanced benchmarks
				options.includeBasic = false;
				options.includeSearch = false;
				options.includeIndex = false;
				break;
			case "--no-basic":
				options.includeBasic = false;
				break;
			case "--no-search":
				options.includeSearch = false;
				break;
			case "--no-index":
				options.includeIndex = false;
				break;
			case "--no-memory":
				options.includeMemory = false;
				break;
			case "--no-comparison":
				options.includeComparison = false;
				break;
			case "--no-utilities":
				options.includeUtilities = false;
				break;
			case "--no-pagination":
				options.includePagination = false;
				break;
			case "--no-persistence":
				options.includePersistence = false;
				break;
			case "--no-immutable":
				options.includeImmutableComparison = false;
				break;
			case "--quiet":
				options.verbose = false;
				break;
			case "--help":
				console.log(`
Haro Benchmark Suite v16.0.0

Usage: node benchmarks/index.js [options]

SINGLE CATEGORY OPTIONS:
  --basic-only           Run only basic CRUD operations benchmarks
  --search-only          Run only search and filter benchmarks  
  --index-only           Run only index operations benchmarks
  --memory-only          Run only memory usage benchmarks
  --comparison-only      Run only vs native structures benchmarks
  --utilities-only       Run only utility operations benchmarks (clone, merge, freeze, etc.)
  --pagination-only      Run only pagination/limit benchmarks
  --persistence-only     Run only dump/override persistence benchmarks
  --immutable-only       Run only immutable vs mutable comparison benchmarks

CATEGORY GROUP OPTIONS:
  --core-only            Run only core benchmarks (basic, search, index)
  --advanced-only        Run only advanced benchmarks (memory, comparison, utilities, etc.)

EXCLUSION OPTIONS:
  --no-basic             Exclude basic operations benchmarks
  --no-search            Exclude search and filter benchmarks
  --no-index             Exclude index operations benchmarks  
  --no-memory            Exclude memory usage benchmarks
  --no-comparison        Exclude comparison benchmarks
  --no-utilities         Exclude utility operations benchmarks
  --no-pagination        Exclude pagination benchmarks
  --no-persistence       Exclude persistence benchmarks
  --no-immutable         Exclude immutable vs mutable benchmarks

OUTPUT OPTIONS:
  --quiet                Suppress verbose output
  --help                 Show this help message

BENCHMARK CATEGORIES:
  Basic Operations       CRUD operations (set, get, delete, batch)
  Search & Filter        Query operations (find, filter, search, where)
  Index Operations       Indexing performance and benefits
  Memory Usage           Memory consumption and efficiency analysis
  Comparison             Performance vs native JavaScript structures
  Utility Operations     Helper methods (clone, merge, freeze, forEach, uuid)
  Pagination             Limit-based pagination performance
  Persistence            Dump/override operations for data serialization
  Immutable Comparison   Performance comparison between mutable and immutable modes

Examples:
  node benchmarks/index.js                    # Run all benchmarks
  node benchmarks/index.js --basic-only       # Run basic operations only
  node benchmarks/index.js --core-only        # Run core benchmarks only
  node benchmarks/index.js --no-memory        # Run all except memory benchmarks
  node benchmarks/index.js --quiet            # Run all benchmarks quietly
  node benchmarks/index.js --utilities-only   # Test utility methods only
        `);
				process.exit(0);
				break;
		}
	});

	return options;
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const options = parseCliArguments();
	runAllBenchmarks(options).catch(error => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
}

export { runAllBenchmarks, generateSummaryReport };
