import { performance } from "node:perf_hooks";
import { haro } from "../dist/haro.js";

/**
 * Generates test data with structured fields for search benchmarking
 * @param {number} size - Number of records to generate
 * @returns {Array} Array of test records with searchable fields
 */
function generateSearchTestData (size) {
	const data = [];
	const departments = ["Engineering", "Marketing", "Sales", "HR", "Finance"];
	const skills = ["JavaScript", "Python", "Java", "React", "Node.js", "SQL", "Docker", "AWS"];
	const cities = ["New York", "San Francisco", "Boston", "Austin", "Seattle"];

	for (let i = 0; i < size; i++) {
		data.push({
			id: i,
			name: `User ${i}`,
			email: `user${i}@example.com`,
			age: Math.floor(Math.random() * 50) + 18,
			department: departments[i % departments.length],
			skills: [
				skills[i % skills.length],
				skills[(i + 1) % skills.length],
				skills[(i + 2) % skills.length]
			],
			city: cities[i % cities.length],
			active: Math.random() > 0.3,
			salary: Math.floor(Math.random() * 100000) + 50000,
			joinDate: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)),
			tags: [`tag${i % 10}`, `category${i % 5}`],
			metadata: {
				created: new Date(),
				score: Math.random() * 100,
				level: Math.floor(Math.random() * 10),
				region: `Region ${i % 3}`
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
 * Benchmarks FIND operations using indexes
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkFindOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateSearchTestData(size);
		const store = haro(testData, {
			index: ["department", "age", "city", "active", "department|active", "city|department"]
		});

		// Simple find operations
		const findDeptResult = benchmark(`FIND by department (${size} records)`, () => {
			store.find({ department: "Engineering" });
		});
		results.push(findDeptResult);

		const findActiveResult = benchmark(`FIND by active status (${size} records)`, () => {
			store.find({ active: true });
		});
		results.push(findActiveResult);

		// Composite find operations
		const findCompositeResult = benchmark(`FIND by department+active (${size} records)`, () => {
			store.find({ department: "Engineering", active: true });
		});
		results.push(findCompositeResult);

		const findCityDeptResult = benchmark(`FIND by city+department (${size} records)`, () => {
			store.find({ city: "New York", department: "Engineering" });
		});
		results.push(findCityDeptResult);
	});

	return results;
}

/**
 * Benchmarks FILTER operations using predicates
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkFilterOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateSearchTestData(size);
		const store = haro(testData);

		// Simple filter operations
		const filterAgeResult = benchmark(`FILTER by age range (${size} records)`, () => {
			store.filter(record => record.age >= 25 && record.age <= 35);
		});
		results.push(filterAgeResult);

		const filterSalaryResult = benchmark(`FILTER by salary range (${size} records)`, () => {
			store.filter(record => record.salary > 75000);
		});
		results.push(filterSalaryResult);

		// Complex filter operations
		const filterComplexResult = benchmark(`FILTER complex condition (${size} records)`, () => {
			store.filter(record =>
				record.active &&
        record.age > 30 &&
        record.department === "Engineering" &&
        record.skills.includes("JavaScript")
			);
		});
		results.push(filterComplexResult);

		// Array filter operations
		const filterArrayResult = benchmark(`FILTER by array contains (${size} records)`, () => {
			store.filter(record => record.skills.includes("React"));
		});
		results.push(filterArrayResult);
	});

	return results;
}

/**
 * Benchmarks SEARCH operations using different value types
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkSearchOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateSearchTestData(size);
		const store = haro(testData, {
			index: ["department", "skills", "city", "name", "tags"]
		});

		// String search operations
		const searchStringResult = benchmark(`SEARCH by string value (${size} records)`, () => {
			store.search("Engineering", "department");
		});
		results.push(searchStringResult);

		// Regex search operations
		const searchRegexResult = benchmark(`SEARCH by regex (${size} records)`, () => {
			store.search(/^User [0-9]+$/, "name");
		});
		results.push(searchRegexResult);

		// Function search operations
		const searchFunctionResult = benchmark(`SEARCH by function (${size} records)`, () => {
			store.search((value, index) => {
				if (index === "department") {
					return value.startsWith("Eng");
				}

				return false;
			});
		});
		results.push(searchFunctionResult);

		// Multiple index search
		const searchMultipleResult = benchmark(`SEARCH multiple indexes (${size} records)`, () => {
			store.search("tag1", ["tags", "skills"]);
		});
		results.push(searchMultipleResult);
	});

	return results;
}

/**
 * Benchmarks WHERE operations with different operators
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkWhereOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateSearchTestData(size);
		const store = haro(testData, {
			index: ["department", "skills", "city", "active", "tags"]
		});

		// Simple where operations
		const whereDeptResult = benchmark(`WHERE by department (${size} records)`, () => {
			store.where({ department: "Engineering" });
		});
		results.push(whereDeptResult);

		// Array where operations with OR
		const whereArrayOrResult = benchmark(`WHERE array OR operation (${size} records)`, () => {
			store.where({
				skills: ["JavaScript", "Python"]
			}, false, "||");
		});
		results.push(whereArrayOrResult);

		// Array where operations with AND
		const whereArrayAndResult = benchmark(`WHERE array AND operation (${size} records)`, () => {
			store.where({
				skills: ["JavaScript", "React"]
			}, false, "&&");
		});
		results.push(whereArrayAndResult);

		// Regex where operations
		const whereRegexResult = benchmark(`WHERE with regex (${size} records)`, () => {
			store.where({
				department: /^Eng/
			});
		});
		results.push(whereRegexResult);

		// Complex where operations
		const whereComplexResult = benchmark(`WHERE complex conditions (${size} records)`, () => {
			store.where({
				department: "Engineering",
				active: true,
				skills: ["JavaScript"]
			});
		});
		results.push(whereComplexResult);
	});

	return results;
}

/**
 * Benchmarks MAP and REDUCE operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkMapReduceOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateSearchTestData(size);
		const store = haro(testData);

		// Map operations
		const mapResult = benchmark(`MAP transformation (${size} records)`, () => {
			store.map(record => ({
				id: record.id,
				name: record.name,
				department: record.department
			}));
		});
		results.push(mapResult);

		// Reduce operations
		const reduceResult = benchmark(`REDUCE aggregation (${size} records)`, () => {
			store.reduce((acc, record) => {
				acc[record.department] = (acc[record.department] || 0) + 1;

				return acc;
			}, {});
		});
		results.push(reduceResult);

		// ForEach operations
		const forEachResult = benchmark(`FOREACH iteration (${size} records)`, () => {
			let count = 0; // eslint-disable-line no-unused-vars
			store.forEach(() => {
				count++;
			});
		});
		results.push(forEachResult);
	});

	return results;
}

/**
 * Benchmarks SORT operations
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkSortOperations (dataSizes) {
	const results = [];

	dataSizes.forEach(size => {
		const testData = generateSearchTestData(size);
		const store = haro(testData, {
			index: ["age", "salary", "name", "department"]
		});

		// Sort operations
		const sortResult = benchmark(`SORT by age (${size} records)`, () => {
			store.sort((a, b) => a.age - b.age);
		});
		results.push(sortResult);

		// SortBy operations
		const sortByResult = benchmark(`SORT BY indexed field (${size} records)`, () => {
			store.sortBy("age");
		});
		results.push(sortByResult);

		// Complex sort operations
		const complexSortResult = benchmark(`SORT complex comparison (${size} records)`, () => {
			store.sort((a, b) => {
				if (a.department !== b.department) {
					return a.department.localeCompare(b.department);
				}

				return b.salary - a.salary;
			});
		});
		results.push(complexSortResult);
	});

	return results;
}

/**
 * Prints benchmark results in a formatted table
 * @param {Array} results - Array of benchmark results
 */
function printResults (results) {
	console.log("\n=== SEARCH & FILTER BENCHMARK RESULTS ===\n");

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
 * Main function to run all search and filter benchmarks
 */
function runSearchFilterBenchmarks () {
	console.log("🔍 Running Search & Filter Benchmarks...\n");

	const dataSizes = [1000, 10000, 50000];
	const allResults = [];

	console.log("Testing FIND operations...");
	allResults.push(...benchmarkFindOperations(dataSizes));

	console.log("Testing FILTER operations...");
	allResults.push(...benchmarkFilterOperations(dataSizes));

	console.log("Testing SEARCH operations...");
	allResults.push(...benchmarkSearchOperations(dataSizes));

	console.log("Testing WHERE operations...");
	allResults.push(...benchmarkWhereOperations(dataSizes));

	console.log("Testing MAP/REDUCE operations...");
	allResults.push(...benchmarkMapReduceOperations(dataSizes));

	console.log("Testing SORT operations...");
	allResults.push(...benchmarkSortOperations(dataSizes));

	printResults(allResults);

	return allResults;
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runSearchFilterBenchmarks();
}

export { runSearchFilterBenchmarks, generateSearchTestData };
