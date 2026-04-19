import { Bench } from "tinybench";
import { haro } from "../dist/haro.js";

/**
 * Creates a benchmark suite for basic CRUD operations
 * @param {number} size - Number of records to test
 * @returns {Bench} Configured benchmark suite
 */
function createBasicOperationsBench(size = 10000) {
	const bench = new Bench({ time: 500 });
	const testData = Array.from({ length: size }, (_, i) => ({
		id: i,
		name: `test${i}`,
		category: "A",
	}));
	const store = haro(testData);

	bench
		.add(`store.set() ${size} records`, () => {
			const newStore = haro();
			for (let i = 0; i < size; i++) {
				newStore.set(i, testData[i]);
			}
		})
		.add(`store.get() ${size} records`, () => {
			for (let i = 0; i < size; i++) {
				store.get(i);
			}
		})
		.add(`store.has() ${size} keys`, () => {
			for (let i = 0; i < size; i++) {
				store.has(i);
			}
		})
		.add(`store.delete() ${size} records`, () => {
			const deleteStore = haro(testData);
			for (let i = 0; i < size; i++) {
				deleteStore.delete(i);
			}
		});

	return bench;
}

/**
 * Creates a benchmark suite for search and filter operations
 * @param {number} size - Number of records to test
 * @returns {Bench} Configured benchmark suite
 */
function createSearchFilterBench(size = 10000) {
	const bench = new Bench({ time: 500 });
	const testData = Array.from({ length: size }, (_, i) => ({
		id: i,
		name: `User ${i}`,
		department: i % 5 === 0 ? "Engineering" : "Marketing",
		skills: ["JavaScript", "Python"],
		city: "New York",
		active: true,
		tags: [`tag${i % 10}`],
		age: 25 + (i % 30),
		salary: 50000 + (i % 100000),
	}));

	const store = haro(testData, {
		index: ["department", "skills", "city", "active", "tags", "age", "salary"],
		warnOnFullScan: false,
	});

	bench
		.add(`FIND by indexed field (${size} records)`, () => {
			store.find({ department: "Engineering" });
		})
		.add(`WHERE by indexed field (${size} records)`, () => {
			store.where({ department: "Engineering" });
		})
		.add(`SEARCH in index (${size} records)`, () => {
			store.search("Engineering", "department");
		})
		.add(`FILTER all records (${size} records)`, () => {
			store.filter((record) => record.active === true);
		});

	return bench;
}

/**
 * Creates a benchmark suite for index operations
 * @param {number} size - Number of records to test
 * @returns {Bench} Configured benchmark suite
 */
function createIndexOperationsBench(size = 10000) {
	const bench = new Bench({ time: 500 });
	const testData = Array.from({ length: size }, (_, i) => ({
		id: i,
		category: i % 5 === 0 ? "A" : "B",
		status: "active",
		priority: "high",
		region: "north",
		userId: Math.floor(i / 10),
		timestamp: new Date(),
		score: Math.floor(Math.random() * 1000),
		tags: [`tag${i % 20}`],
	}));

	bench
		.add(`CREATE indexes (${size} records)`, () => {
			const store = haro(testData, {
				index: ["category", "status", "priority", "region", "userId"],
			});
			return store;
		})
		.add(`FIND with index (${size} records)`, () => {
			const store = haro(testData, { index: ["category"] });
			store.find({ category: "A" });
		})
		.add(`REINDEX single field (${size} records)`, () => {
			const store = haro(testData, { index: ["category"] });
			store.reindex("status");
		});

	return bench;
}

/**
 * Creates a benchmark suite for utility operations
 * @param {number} size - Number of records to test
 * @returns {Bench} Configured benchmark suite
 */
function createUtilityOperationsBench(size = 1000) {
	const bench = new Bench({ time: 500 });
	const store = haro();
	const testData = { id: 1, name: "test", tags: ["a", "b", "c"] };

	bench
		.add(`toArray() (${size} iterations)`, () => {
			for (let i = 0; i < size; i++) {
				store.toArray();
			}
		})
		.add(`entries() (${size} iterations)`, () => {
			for (let i = 0; i < size; i++) {
				Array.from(store.entries());
			}
		})
		.add(`keys() (${size} iterations)`, () => {
			for (let i = 0; i < size; i++) {
				Array.from(store.keys());
			}
		})
		.add(`values() (${size} iterations)`, () => {
			for (let i = 0; i < size; i++) {
				Array.from(store.values());
			}
		});

	return bench;
}

/**
 * Creates a benchmark suite for pagination operations
 * @param {number} size - Number of records to test
 * @returns {Bench} Configured benchmark suite
 */
function createPaginationBench(size = 10000) {
	const bench = new Bench({ time: 500 });
	const testData = Array.from({ length: size }, (_, i) => ({
		id: i,
		name: `Item ${i}`,
		category: `cat${i % 10}`,
	}));
	const store = haro(testData);

	bench
		.add(`LIMIT 10 (${size} records)`, () => {
			store.limit(0, 10);
		})
		.add(`LIMIT 50 (${size} records)`, () => {
			store.limit(0, 50);
		})
		.add(`LIMIT 100 (${size} records)`, () => {
			store.limit(0, 100);
		})
		.add(`LIMIT with offset (${size} records)`, () => {
			store.limit(500, 50);
		});

	return bench;
}

/**
 * Creates a benchmark suite for persistence operations
 * @param {number} size - Number of records to test
 * @returns {Bench} Configured benchmark suite
 */
function createPersistenceBench(size = 5000) {
	const bench = new Bench({ time: 500 });
	const testData = Array.from({ length: size }, (_, i) => ({
		id: i,
		name: `Record ${i}`,
		department: `Dept${i % 10}`,
		location: `Loc${i % 5}`,
		active: true,
	}));
	const store = haro(testData, { index: ["department", "location", "active"] });

	bench
		.add(`DUMP records (${size} records)`, () => {
			store.dump("records");
		})
		.add(`DUMP indexes (${size} records)`, () => {
			store.dump("indexes");
		})
		.add(`OVERRIDE records (${size} records)`, () => {
			const dump = store.dump("records");
			const newStore = haro();
			newStore.override(dump, "records");
		});

	return bench;
}

/**
 * Runs all benchmark suites and displays results
 * @param {Object} options - Benchmark options
 * @returns {Promise<Object>} All benchmark results
 */
async function runAllBenchmarks(options = {}) {
	const {
		includeBasic = true,
		includeSearch = true,
		includeIndex = true,
		includeUtilities = true,
		includePagination = true,
		includePersistence = true,
		verbose = true,
	} = options;

	const results = {};
	const sizes = {
		basic: 10000,
		search: 10000,
		index: 10000,
		utility: 1000,
		pagination: 10000,
		persistence: 5000,
	};

	console.log("🚀 Starting Haro Benchmark Suite (tinybench)...\n");
	console.log(`Node.js: ${process.version}\n`);

	try {
		if (includeBasic) {
			if (verbose) console.log("⏳ Running basic operations...");
			const bench = createBasicOperationsBench(sizes.basic);
			await bench.run();
			results.basicOps = bench;
			if (verbose) {
				console.log("\n📊 BASIC OPERATIONS:");
				console.table(bench.table());
			}
		}

		if (includeSearch) {
			if (verbose) console.log("⏳ Running search/filter operations...");
			const bench = createSearchFilterBench(sizes.search);
			await bench.run();
			results.searchFilter = bench;
			if (verbose) {
				console.log("\n📊 SEARCH & FILTER:");
				console.table(bench.table());
			}
		}

		if (includeIndex) {
			if (verbose) console.log("⏳ Running index operations...");
			const bench = createIndexOperationsBench(sizes.index);
			await bench.run();
			results.indexOps = bench;
			if (verbose) {
				console.log("\n📊 INDEX OPERATIONS:");
				console.table(bench.table());
			}
		}

		if (includeUtilities) {
			if (verbose) console.log("⏳ Running utility operations...");
			const bench = createUtilityOperationsBench(sizes.utility);
			await bench.run();
			results.utilities = bench;
			if (verbose) {
				console.log("\n📊 UTILITY OPERATIONS:");
				console.table(bench.table());
			}
		}

		if (includePagination) {
			if (verbose) console.log("⏳ Running pagination operations...");
			const bench = createPaginationBench(sizes.pagination);
			await bench.run();
			results.pagination = bench;
			if (verbose) {
				console.log("\n📊 PAGINATION:");
				console.table(bench.table());
			}
		}

		if (includePersistence) {
			if (verbose) console.log("⏳ Running persistence operations...");
			const bench = createPersistenceBench(sizes.persistence);
			await bench.run();
			results.persistence = bench;
			if (verbose) {
				console.log("\n📊 PERSISTENCE:");
				console.table(bench.table());
			}
		}

		console.log("\n" + "=".repeat(80));
		console.log("🏁 BENCHMARK COMPLETE");
		console.log("=".repeat(80) + "\n");

		return results;
	} catch (error) {
		console.error("❌ Benchmark suite failed:", error);
		throw error;
	}
}

/**
 * CLI argument parser
 * @returns {Object} Parsed CLI options
 */
function parseCliArguments() {
	const args = process.argv.slice(2);
	const options = {
		includeBasic: true,
		includeSearch: true,
		includeIndex: true,
		includeUtilities: true,
		includePagination: true,
		includePersistence: true,
		verbose: true,
	};

	const runOnlyCategory = (category) => {
		Object.keys(options).forEach((key) => {
			if (key.startsWith("include") && key !== category) {
				options[key] = false;
			}
		});
	};

	args.forEach((arg) => {
		switch (arg) {
			case "--basic-only":
				runOnlyCategory("includeBasic");
				break;
			case "--search-only":
				runOnlyCategory("includeSearch");
				break;
			case "--index-only":
				runOnlyCategory("includeIndex");
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
			case "--core-only":
				options.includeUtilities = false;
				options.includePagination = false;
				options.includePersistence = false;
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
			case "--no-utilities":
				options.includeUtilities = false;
				break;
			case "--no-pagination":
				options.includePagination = false;
				break;
			case "--no-persistence":
				options.includePersistence = false;
				break;
			case "--quiet":
				options.verbose = false;
				break;
			case "--help":
				console.log(`
Haro Benchmark Suite v17.0.0 (tinybench)

Usage: node benchmarks/index.js [options]

SINGLE CATEGORY OPTIONS:
  --basic-only           Run only basic CRUD operations benchmarks
  --search-only          Run only search and filter benchmarks  
  --index-only           Run only index operations benchmarks
  --utilities-only       Run only utility operations benchmarks
  --pagination-only      Run only pagination benchmarks
  --persistence-only     Run only persistence benchmarks

CATEGORY GROUP OPTIONS:
  --core-only            Run only core benchmarks (basic, search, index)

EXCLUSION OPTIONS:
  --no-basic             Exclude basic operations benchmarks
  --no-search            Exclude search and filter benchmarks
  --no-index             Exclude index operations benchmarks  
  --no-utilities         Exclude utility operations benchmarks
  --no-pagination        Exclude pagination benchmarks
  --no-persistence       Exclude persistence benchmarks

OUTPUT OPTIONS:
  --quiet                Suppress verbose output
  --help                 Show this help message

Examples:
  node benchmarks/index.js                    # Run all benchmarks
  node benchmarks/index.js --basic-only       # Run basic operations only
  node benchmarks/index.js --core-only        # Run core benchmarks only
  node benchmarks/index.js --quiet            # Run all benchmarks quietly
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
	runAllBenchmarks(options).catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
}

export { runAllBenchmarks };
