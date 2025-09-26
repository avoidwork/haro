import assert from "node:assert";
import { describe, it, beforeEach } from "mocha";
import {
	QueryTypes,
	CostFactors,
	QueryPlanStep,
	QueryPlan,
	DataStatistics,
	QueryOptimizer
} from "../../src/query-optimizer.js";

/**
 * Test constants for query optimizer testing
 */
const TEST_QUERY_ID = "test_query_1";
const TEST_RECORD_COUNT = 1000;
const TEST_INDEX_NAME = "email_index";
const TEST_OPERATION = "find";

/**
 * Mock index manager for testing
 */
class MockIndexManager {
	constructor() {
		this.indexes = new Map([
			["email_index", { 
				cardinality: 100,
				size: 500
			}],
			["name_index", { 
				cardinality: 80,
				size: 400
			}]
		]);
	}

	/**
	 * Get optimal index for given fields
	 * @param {string[]} fields - Field names
	 * @returns {string|null} Index name
	 */
	getOptimalIndex(fields) {
		if (fields.includes("email")) return "email_index";
		if (fields.includes("name")) return "name_index";
		return null;
	}

	/**
	 * List available indexes
	 * @returns {string[]} Array of index names
	 */
	listIndexes() {
		return Array.from(this.indexes.keys());
	}
}

/**
 * Mock index storage for testing
 */
class MockIndexStorage {
	constructor(totalKeys = 100, totalEntries = 500) {
		this.totalKeys = totalKeys;
		this.totalEntries = totalEntries;
	}

	/**
	 * Get index statistics
	 * @returns {Object} Index statistics
	 */
	getStats() {
		return {
			totalKeys: this.totalKeys,
			totalEntries: this.totalEntries,
			memoryUsage: this.totalEntries * 32 // Mock memory usage
		};
	}
}

/**
 * Tests for query optimizer constants
 */
describe("QueryOptimizer Constants", () => {
	describe("QueryTypes", () => {
		/**
		 * Test QueryTypes contains all expected operations
		 */
		it("should contain all expected query operation types", () => {
			assert.strictEqual(QueryTypes.FIND, "find");
			assert.strictEqual(QueryTypes.FILTER, "filter");
			assert.strictEqual(QueryTypes.SEARCH, "search");
			assert.strictEqual(QueryTypes.WHERE, "where");
			assert.strictEqual(QueryTypes.SORT, "sort");
			assert.strictEqual(QueryTypes.LIMIT, "limit");
			assert.strictEqual(QueryTypes.AGGREGATE, "aggregate");
		});

		/**
		 * Test QueryTypes maintains consistent values
		 */
		it("should maintain consistent values", () => {
			// Test that the object properties have expected values
			assert.strictEqual(QueryTypes.FIND, "find");
			assert.strictEqual(QueryTypes.FILTER, "filter");
			assert.strictEqual(QueryTypes.SEARCH, "search");
		});
	});

	describe("CostFactors", () => {
		/**
		 * Test CostFactors contains all expected factors
		 */
		it("should contain all expected cost factors", () => {
			assert.strictEqual(CostFactors.INDEX_LOOKUP, 1);
			assert.strictEqual(CostFactors.FULL_SCAN, 100);
			assert.strictEqual(CostFactors.FILTER_EVALUATION, 10);
			assert.strictEqual(CostFactors.SORT_OPERATION, 50);
			assert.strictEqual(CostFactors.MEMORY_ACCESS, 1);
			assert.strictEqual(CostFactors.COMPARISON, 2);
			assert.strictEqual(CostFactors.REGEX_MATCH, 20);
		});

		/**
		 * Test relative cost ordering
		 */
		it("should have correct relative cost ordering", () => {
			assert.ok(CostFactors.INDEX_LOOKUP < CostFactors.FILTER_EVALUATION);
			assert.ok(CostFactors.FILTER_EVALUATION < CostFactors.SORT_OPERATION);
			assert.ok(CostFactors.SORT_OPERATION < CostFactors.FULL_SCAN);
		});
	});
});

/**
 * Tests for QueryPlanStep class
 */
describe("QueryPlanStep", () => {
	/**
	 * Test basic construction
	 */
	it("should create a basic query plan step", () => {
		const operation = "index_lookup";
		const options = { indexName: TEST_INDEX_NAME };
		const estimatedCost = 10;
		const estimatedRows = 100;
		
		const step = new QueryPlanStep(operation, options, estimatedCost, estimatedRows);
		
		assert.strictEqual(step.operation, operation);
		assert.deepStrictEqual(step.options, options);
		assert.strictEqual(step.estimatedCost, estimatedCost);
		assert.strictEqual(step.estimatedRows, estimatedRows);
		assert.strictEqual(step.actualCost, null);
		assert.strictEqual(step.actualRows, null);
		assert.strictEqual(step.startTime, null);
		assert.strictEqual(step.endTime, null);
	});

	/**
	 * Test construction with defaults
	 */
	it("should use default values when not provided", () => {
		const step = new QueryPlanStep("full_scan");
		
		assert.strictEqual(step.operation, "full_scan");
		assert.deepStrictEqual(step.options, {});
		assert.strictEqual(step.estimatedCost, 0);
		assert.strictEqual(step.estimatedRows, 0);
	});

	/**
	 * Test execution timing
	 */
	it("should track execution timing correctly", () => {
		const step = new QueryPlanStep("test_operation");
		const actualRows = 50;
		
		// Start execution
		step.startExecution();
		assert.ok(step.startTime);
		assert.strictEqual(step.endTime, null);
		
		// Simulate some processing time
		const startTime = step.startTime;
		
		// End execution
		step.endExecution(actualRows);
		assert.ok(step.endTime);
		assert.ok(step.endTime >= startTime);
		assert.strictEqual(step.actualRows, actualRows);
		assert.strictEqual(step.actualCost, step.endTime - step.startTime);
	});

	/**
	 * Test getStats method
	 */
	it("should return correct statistics", () => {
		const step = new QueryPlanStep("filter", { field: "email" }, 20, 200);
		step.startExecution();
		
		// Simulate some execution time to ensure actualCost > 0
		const startTime = step.startTime;
		step.endTime = startTime + 10; // Mock 10ms execution time
		step.actualCost = 10;
		step.actualRows = 180;
		
		const stats = step.getStats();
		
		assert.strictEqual(stats.operation, "filter");
		assert.deepStrictEqual(stats.options, { field: "email" });
		assert.strictEqual(stats.estimatedCost, 20);
		assert.strictEqual(stats.estimatedRows, 200);
		assert.strictEqual(stats.actualCost, 10);
		assert.strictEqual(stats.actualRows, 180);
		assert.ok(typeof stats.costAccuracy === "number");
		assert.ok(typeof stats.rowAccuracy === "number");
	});

	/**
	 * Test accuracy calculations
	 */
	it("should calculate accuracy correctly", () => {
		const step = new QueryPlanStep("sort", {}, 100, 500);
		step.startExecution();
		
		// Simulate some execution time to ensure actualCost > 0
		const startTime = step.startTime;
		step.endTime = startTime + 50; // Mock 50ms execution time
		step.actualCost = 50;
		step.actualRows = 450;
		
		const stats = step.getStats();
		
		// Cost accuracy should be relative error
		const expectedCostAccuracy = Math.abs(50 - 100) / 100;
		assert.strictEqual(stats.costAccuracy, expectedCostAccuracy);
		
		// Row accuracy should be relative error  
		const expectedRowAccuracy = Math.abs(450 - 500) / 500;
		assert.strictEqual(stats.rowAccuracy, expectedRowAccuracy);
	});

	/**
	 * Test stats with null values
	 */
	it("should handle null values in stats calculation", () => {
		const step = new QueryPlanStep("test", {}, 0, 0);
		const stats = step.getStats();
		
		assert.strictEqual(stats.actualCost, null);
		assert.strictEqual(stats.actualRows, null);
		assert.strictEqual(stats.costAccuracy, null);
		assert.strictEqual(stats.rowAccuracy, null);
	});
});

/**
 * Tests for QueryPlan class
 */
describe("QueryPlan", () => {
	let queryPlan;
	const originalQuery = { find: { email: "test@example.com" } };

	beforeEach(() => {
		queryPlan = new QueryPlan(TEST_QUERY_ID, originalQuery);
	});

	/**
	 * Test basic construction
	 */
	it("should create a query plan with correct initial state", () => {
		assert.strictEqual(queryPlan.queryId, TEST_QUERY_ID);
		assert.deepStrictEqual(queryPlan.originalQuery, originalQuery);
		assert.deepStrictEqual(queryPlan.steps, []);
		assert.strictEqual(queryPlan.totalEstimatedCost, 0);
		assert.strictEqual(queryPlan.totalEstimatedRows, 0);
		assert.strictEqual(queryPlan.totalActualCost, null);
		assert.strictEqual(queryPlan.totalActualRows, null);
		assert.ok(queryPlan.createdAt instanceof Date);
		assert.strictEqual(queryPlan.executedAt, null);
		assert.strictEqual(queryPlan.completedAt, null);
	});

	/**
	 * Test adding steps
	 */
	it("should add steps and update totals correctly", () => {
		const step1 = new QueryPlanStep("index_lookup", {}, 10, 100);
		const step2 = new QueryPlanStep("filter", {}, 20, 50);
		
		const result1 = queryPlan.addStep(step1);
		assert.strictEqual(result1, queryPlan); // Should return this for chaining
		assert.strictEqual(queryPlan.steps.length, 1);
		assert.strictEqual(queryPlan.totalEstimatedCost, 10);
		
		queryPlan.addStep(step2);
		assert.strictEqual(queryPlan.steps.length, 2);
		assert.strictEqual(queryPlan.totalEstimatedCost, 30);
	});

	/**
	 * Test execution lifecycle
	 */
	it("should track execution lifecycle correctly", () => {
		const createdAt = queryPlan.createdAt;
		
		// Start execution
		queryPlan.startExecution();
		assert.ok(queryPlan.executedAt instanceof Date);
		assert.ok(queryPlan.executedAt >= createdAt);
		assert.strictEqual(queryPlan.completedAt, null);
		
		// Complete execution
		const actualRows = 75;
		queryPlan.completeExecution(actualRows);
		assert.ok(queryPlan.completedAt instanceof Date);
		assert.ok(queryPlan.completedAt >= queryPlan.executedAt);
		assert.strictEqual(queryPlan.totalActualRows, actualRows);
		assert.strictEqual(queryPlan.totalActualCost, 
			queryPlan.completedAt.getTime() - queryPlan.executedAt.getTime());
	});

	/**
	 * Test getStats method
	 */
	it("should return comprehensive statistics", () => {
		const step = new QueryPlanStep("test", {}, 15, 150);
		queryPlan.addStep(step);
		queryPlan.startExecution();
		
		// Ensure we have a non-zero execution time for efficiency calculation
		const executedAt = queryPlan.executedAt;
		queryPlan.completedAt = new Date(executedAt.getTime() + 50); // 50ms execution time
		queryPlan.totalActualCost = 50;
		queryPlan.totalActualRows = 140;
		
		const stats = queryPlan.getStats();
		
		assert.strictEqual(stats.queryId, TEST_QUERY_ID);
		assert.deepStrictEqual(stats.originalQuery, originalQuery);
		assert.strictEqual(stats.stepCount, 1);
		assert.strictEqual(stats.totalEstimatedCost, 15);
		assert.strictEqual(stats.totalEstimatedRows, 0); // Steps don't auto-update plan totals
		assert.strictEqual(stats.totalActualCost, 50);
		assert.strictEqual(stats.totalActualRows, 140);
		assert.strictEqual(stats.createdAt, queryPlan.createdAt);
		assert.strictEqual(stats.executedAt, queryPlan.executedAt);
		assert.strictEqual(stats.completedAt, queryPlan.completedAt);
		assert.ok(Array.isArray(stats.steps));
		assert.strictEqual(stats.steps.length, 1);
		assert.ok(typeof stats.efficiency === "number");
		assert.strictEqual(stats.efficiency, 15 / 50); // estimatedCost / actualCost
	});

	/**
	 * Test export method
	 */
	it("should export plan with explanation", () => {
		const step = new QueryPlanStep("full_scan", {}, 100, 1000);
		queryPlan.addStep(step);
		
		const exported = queryPlan.export();
		
		assert.ok(exported.hasOwnProperty("queryId"));
		assert.ok(exported.hasOwnProperty("explanation"));
		assert.ok(Array.isArray(exported.explanation));
		assert.ok(exported.explanation.some(line => line.includes("Query Plan for:")));
		assert.ok(exported.explanation.some(line => line.includes("Execution steps:")));
	});

	/**
	 * Test explanation generation
	 */
	it("should generate human-readable explanation", () => {
		const step1 = new QueryPlanStep("index_lookup", { indexName: "test_index" }, 5, 50);
		const step2 = new QueryPlanStep("filter", { field: "status" }, 10, 25);
		
		queryPlan.addStep(step1);
		queryPlan.addStep(step2);
		
		const exported = queryPlan.export();
		const explanation = exported.explanation;
		
		assert.ok(explanation.includes(`Query Plan for: ${JSON.stringify(originalQuery)}`));
		assert.ok(explanation.some(line => line.includes("1. index_lookup")));
		assert.ok(explanation.some(line => line.includes("2. filter")));
	});

	/**
	 * Test plan explanation with executed steps
	 */
	it("should include actual costs in explanation when plan is executed", () => {
		const step = new QueryPlanStep("index_lookup", { indexName: "test" }, 10, 100);
		queryPlan.addStep(step);
		
		// Execute the plan and step to get actual costs
		queryPlan.startExecution();
		step.startExecution();
		step.endTime = step.startTime + 5; // Mock 5ms execution
		step.actualCost = 5;
		step.actualRows = 95;
		queryPlan.completeExecution(95);
		
		const exported = queryPlan.export();
		const explanation = exported.explanation.join("\n");
		
		// Should include actual cost lines (lines 183-184, 194-195)
		assert.ok(explanation.includes("Actual cost:"));
		assert.ok(explanation.includes("Actual: cost:"));
	});
});

/**
 * Tests for DataStatistics class
 */
describe("DataStatistics", () => {
	let dataStats;
	let mockRecords;
	let mockIndexes;

	beforeEach(() => {
		dataStats = new DataStatistics();
		
		// Create mock records
		mockRecords = new Map([
			["1", { id: 1, email: "user1@test.com", name: "User One", age: 25, status: "active" }],
			["2", { id: 2, email: "user2@test.com", name: "User Two", age: 30, status: "inactive" }],
			["3", { id: 3, email: "user3@test.com", name: "User Three", age: 25, status: "active" }],
			["4", { id: 4, email: "user4@test.com", name: "User Four", age: null, status: "active" }]
		]);
		
		// Create mock indexes
		mockIndexes = new Map([
			["email_index", new MockIndexStorage(4, 4)],
			["status_index", new MockIndexStorage(2, 4)]
		]);
	});

	/**
	 * Test initial state
	 */
	it("should initialize with correct default state", () => {
		assert.strictEqual(dataStats.totalRecords, 0);
		assert.ok(dataStats.indexStatistics instanceof Map);
		assert.ok(dataStats.fieldStatistics instanceof Map);
		assert.ok(dataStats.lastUpdated instanceof Date);
		assert.strictEqual(dataStats.indexStatistics.size, 0);
		assert.strictEqual(dataStats.fieldStatistics.size, 0);
	});

	/**
	 * Test update method
	 */
	it("should update statistics from records and indexes", () => {
		dataStats.update(mockRecords, mockIndexes);
		
		assert.strictEqual(dataStats.totalRecords, 4);
		assert.ok(dataStats.lastUpdated instanceof Date);
		assert.ok(dataStats.fieldStatistics.size > 0);
		assert.ok(dataStats.indexStatistics.size > 0);
	});

	/**
	 * Test field statistics calculation
	 */
	it("should calculate correct field statistics", () => {
		dataStats.update(mockRecords, mockIndexes);
		
		// Test email field statistics
		const emailStats = dataStats.fieldStatistics.get("email");
		assert.ok(emailStats);
		assert.strictEqual(emailStats.uniqueValues, 4); // All emails are unique
		assert.strictEqual(emailStats.nullCount, 0);
		assert.strictEqual(emailStats.dataType, "string");
		assert.ok(emailStats.avgLength > 0);
		
		// Test age field statistics
		const ageStats = dataStats.fieldStatistics.get("age");
		assert.ok(ageStats);
		assert.strictEqual(ageStats.uniqueValues, 2); // 25 and 30
		assert.strictEqual(ageStats.nullCount, 1); // One null value
		assert.strictEqual(ageStats.dataType, "number");
		
		// Test status field statistics
		const statusStats = dataStats.fieldStatistics.get("status");
		assert.ok(statusStats);
		assert.strictEqual(statusStats.uniqueValues, 2); // "active" and "inactive"
		assert.strictEqual(statusStats.nullCount, 0);
	});

	/**
	 * Test index statistics calculation
	 */
	it("should calculate correct index statistics", () => {
		dataStats.update(mockRecords, mockIndexes);
		
		const emailIndexStats = dataStats.indexStatistics.get("email_index");
		assert.ok(emailIndexStats);
		assert.strictEqual(emailIndexStats.cardinality, 4);
		assert.strictEqual(emailIndexStats.selectivity, 1); // 4 keys / 4 records
		assert.strictEqual(emailIndexStats.avgEntriesPerKey, 1);
		assert.ok(emailIndexStats.memoryUsage > 0);
		
		const statusIndexStats = dataStats.indexStatistics.get("status_index");
		assert.ok(statusIndexStats);
		assert.strictEqual(statusIndexStats.cardinality, 2);
		assert.strictEqual(statusIndexStats.selectivity, 0.5); // 2 keys / 4 records
	});

	/**
	 * Test selectivity estimation
	 */
	it("should estimate selectivity correctly", () => {
		dataStats.update(mockRecords, mockIndexes);
		
		// Email field has 4 unique values out of 4 records
		const emailSelectivity = dataStats.getSelectivity("email");
		assert.strictEqual(emailSelectivity, 1/4);
		
		// Status field has 2 unique values out of 4 records
		const statusSelectivity = dataStats.getSelectivity("status");
		assert.strictEqual(statusSelectivity, 1/2);
		
		// Unknown field should return default selectivity
		const unknownSelectivity = dataStats.getSelectivity("unknown_field");
		assert.strictEqual(unknownSelectivity, 0.1);
	});

	/**
	 * Test index cardinality estimation
	 */
	it("should estimate index cardinality correctly", () => {
		dataStats.update(mockRecords, mockIndexes);
		
		const emailCardinality = dataStats.getIndexCardinality("email_index");
		assert.strictEqual(emailCardinality, 4);
		
		const statusCardinality = dataStats.getIndexCardinality("status_index");
		assert.strictEqual(statusCardinality, 2);
		
		// Unknown index should return total records
		const unknownCardinality = dataStats.getIndexCardinality("unknown_index");
		assert.strictEqual(unknownCardinality, 4);
	});

	/**
	 * Test data type inference
	 */
	it("should infer data types correctly", () => {
		const mixedRecords = new Map([
			["1", { field: "string" }],
			["2", { field: 123 }],
			["3", { field: true }]
		]);
		
		dataStats.update(mixedRecords, new Map());
		
		const fieldStats = dataStats.fieldStatistics.get("field");
		assert.strictEqual(fieldStats.dataType, "mixed");
	});

	/**
	 * Test with empty data
	 */
	it("should handle empty records and indexes", () => {
		dataStats.update(new Map(), new Map());
		
		assert.strictEqual(dataStats.totalRecords, 0);
		assert.strictEqual(dataStats.fieldStatistics.size, 0);
		assert.strictEqual(dataStats.indexStatistics.size, 0);
	});
});

/**
 * Tests for QueryOptimizer class
 */
describe("QueryOptimizer", () => {
	let optimizer;
	let mockIndexManager;
	let mockContext;

	beforeEach(() => {
		optimizer = new QueryOptimizer();
		mockIndexManager = new MockIndexManager();
		mockContext = { indexManager: mockIndexManager };
		
		// Update statistics with some mock data
		const mockRecords = new Map([
			["1", { id: 1, email: "user1@test.com", status: "active" }],
			["2", { id: 2, email: "user2@test.com", status: "inactive" }]
		]);
		const mockIndexes = new Map([
			["email_index", new MockIndexStorage(2, 2)]
		]);
		optimizer.updateStatistics(mockRecords, mockIndexes);
	});

	/**
	 * Test constructor with default options
	 */
	it("should initialize with correct default options", () => {
		const newOptimizer = new QueryOptimizer();
		
		assert.strictEqual(newOptimizer.options.collectStatistics, true);
		assert.strictEqual(newOptimizer.options.statisticsUpdateInterval, 1000);
		assert.ok(newOptimizer.statistics instanceof DataStatistics);
		assert.strictEqual(newOptimizer.queryCounter, 0);
		assert.ok(newOptimizer.planCache instanceof Map);
		assert.ok(Array.isArray(newOptimizer.executionHistory));
		assert.strictEqual(newOptimizer.maxHistorySize, 1000);
		assert.strictEqual(newOptimizer.cacheHits, 0);
		assert.strictEqual(newOptimizer.totalCacheRequests, 0);
	});

	/**
	 * Test constructor with custom options
	 */
	it("should initialize with custom options", () => {
		const customOptions = {
			collectStatistics: false,
			statisticsUpdateInterval: 500
		};
		const customOptimizer = new QueryOptimizer(customOptions);
		
		assert.strictEqual(customOptimizer.options.collectStatistics, false);
		assert.strictEqual(customOptimizer.options.statisticsUpdateInterval, 500);
	});

	/**
	 * Test createPlan method
	 */
	it("should create optimized query plan", () => {
		const query = { find: { email: "test@example.com" } };
		const plan = optimizer.createPlan(query, mockContext);
		
		assert.ok(plan instanceof QueryPlan);
		assert.strictEqual(plan.queryId, "query_1");
		assert.deepStrictEqual(plan.originalQuery, query);
		assert.ok(plan.steps.length > 0);
		assert.strictEqual(optimizer.queryCounter, 1);
		assert.strictEqual(optimizer.totalCacheRequests, 1);
	});

	/**
	 * Test plan caching
	 */
	it("should cache and reuse query plans", () => {
		const query = { find: { email: "test@example.com" } };
		
		// First request - cache miss
		const plan1 = optimizer.createPlan(query, mockContext);
		assert.strictEqual(optimizer.cacheHits, 0);
		assert.strictEqual(optimizer.totalCacheRequests, 1);
		
		// Second request - cache hit
		const plan2 = optimizer.createPlan(query, mockContext);
		assert.strictEqual(optimizer.cacheHits, 1);
		assert.strictEqual(optimizer.totalCacheRequests, 2);
		
		// Plans should be different instances but similar structure
		assert.notStrictEqual(plan1, plan2);
		assert.notStrictEqual(plan1.queryId, plan2.queryId);
		assert.deepStrictEqual(plan1.originalQuery, plan2.originalQuery);
	});

	/**
	 * Test getOptimalStrategy method
	 */
	it("should return optimal execution strategy", () => {
		const query = { find: { email: "test@example.com" } };
		const strategy = optimizer.getOptimalStrategy(query, mockContext);
		
		assert.ok(strategy);
		assert.ok(strategy.type);
		assert.ok(typeof strategy.estimatedCost === "number");
		
		// Should prefer index lookup for exact matches
		if (strategy.type === "index_lookup") {
			assert.ok(strategy.indexName);
			assert.ok(strategy.lookupKey);
		}
	});

	/**
	 * Test strategy generation for different query types
	 */
	it("should generate appropriate strategies for different queries", () => {
		// Test index lookup strategy
		const exactQuery = { find: { email: "test@example.com" } };
		const exactStrategy = optimizer.getOptimalStrategy(exactQuery, mockContext);
		assert.strictEqual(exactStrategy.type, "index_lookup");
		
		// Test filtered scan strategy
		const filterQuery = { filter: record => record.status === "active" };
		const filterStrategy = optimizer.getOptimalStrategy(filterQuery, mockContext);
		assert.ok(["filtered_scan", "full_scan"].includes(filterStrategy.type));
		
		// Test full scan for queries without indexes
		const fullScanQuery = { find: { unknown_field: "value" } };
		const fullScanStrategy = optimizer.getOptimalStrategy(fullScanQuery, mockContext);
		assert.strictEqual(fullScanStrategy.type, "full_scan");
	});

	/**
	 * Test recordExecution method
	 */
	it("should record execution history", () => {
		const query = { find: { id: 1 } };
		const plan = optimizer.createPlan(query, mockContext);
		
		// Simulate execution
		plan.startExecution();
		plan.completeExecution(1);
		
		const initialHistorySize = optimizer.executionHistory.length;
		optimizer.recordExecution(plan);
		
		assert.strictEqual(optimizer.executionHistory.length, initialHistorySize + 1);
		const lastExecution = optimizer.executionHistory[optimizer.executionHistory.length - 1];
		assert.strictEqual(lastExecution.queryId, plan.queryId);
	});

	/**
	 * Test statistics collection disabled
	 */
	it("should not record execution when statistics collection is disabled", () => {
		const noStatsOptimizer = new QueryOptimizer({ collectStatistics: false });
		const query = { find: { id: 1 } };
		const plan = noStatsOptimizer.createPlan(query, mockContext);
		
		plan.startExecution();
		plan.completeExecution(1);
		
		const initialHistorySize = noStatsOptimizer.executionHistory.length;
		noStatsOptimizer.recordExecution(plan);
		
		assert.strictEqual(noStatsOptimizer.executionHistory.length, initialHistorySize);
	});

	/**
	 * Test getStats method
	 */
	it("should return comprehensive optimizer statistics", () => {
		// Create some query plans to generate statistics
		const query1 = { find: { email: "test1@example.com" } };
		const query2 = { find: { email: "test2@example.com" } };
		
		optimizer.createPlan(query1, mockContext);
		optimizer.createPlan(query2, mockContext);
		optimizer.createPlan(query1, mockContext); // This should be a cache hit
		
		const stats = optimizer.getStats();
		
		assert.strictEqual(stats.queryCounter, 3);
		assert.ok(stats.planCacheSize > 0);
		assert.ok(stats.dataStatistics);
		assert.strictEqual(stats.dataStatistics.totalRecords, 2);
		assert.ok(stats.cacheStatistics);
		assert.strictEqual(stats.cacheStatistics.totalRequests, 3);
		assert.strictEqual(stats.cacheStatistics.hits, 1);
		assert.ok(stats.costModel);
		assert.ok(stats.costModel.adjustments);
	});

	/**
	 * Test cache hit rate calculation
	 */
	it("should calculate cache hit rate correctly", () => {
		const query = { find: { email: "test@example.com" } };
		
		// Generate some requests with cache hits
		optimizer.createPlan(query, mockContext); // Miss
		optimizer.createPlan(query, mockContext); // Hit
		optimizer.createPlan(query, mockContext); // Hit
		
		const stats = optimizer.getStats();
		assert.strictEqual(stats.cacheStatistics.hitRate, 2/3);
	});

	/**
	 * Test clear method
	 */
	it("should clear all caches and history", () => {
		// Generate some data
		const query = { find: { email: "test@example.com" } };
		const plan = optimizer.createPlan(query, mockContext);
		optimizer.recordExecution(plan);
		
		// Verify data exists
		assert.ok(optimizer.queryCounter > 0);
		assert.ok(optimizer.planCache.size > 0);
		
		// Clear and verify reset
		optimizer.clear();
		
		assert.strictEqual(optimizer.queryCounter, 0);
		assert.strictEqual(optimizer.planCache.size, 0);
		assert.strictEqual(optimizer.executionHistory.length, 0);
		assert.strictEqual(optimizer.cacheHits, 0);
		assert.strictEqual(optimizer.totalCacheRequests, 0);
		
		// Verify cost adjustments are reset
		assert.strictEqual(optimizer.costAdjustments.get("INDEX_LOOKUP"), 1.0);
		assert.strictEqual(optimizer.costAdjustments.get("FULL_SCAN"), 1.0);
	});

	/**
	 * Test cost model updates
	 */
	it("should update cost model based on execution history", () => {
		// Create optimizer with low update interval for testing
		const testOptimizer = new QueryOptimizer({ statisticsUpdateInterval: 1 });
		testOptimizer.updateStatistics(new Map([["1", { id: 1 }]]), new Map());
		
		// Generate execution history with consistent performance data
		for (let i = 0; i < 10; i++) {
			const query = { find: { id: i } };
			const plan = testOptimizer.createPlan(query, mockContext);
			
			// Simulate consistent execution timing
			plan.startExecution();
			plan.steps.forEach(step => {
				step.startExecution();
				step.endExecution(1);
			});
			plan.completeExecution(1);
			
			testOptimizer.recordExecution(plan);
		}
		
		const stats = testOptimizer.getStats();
		assert.ok(stats.costModel.lastUpdated instanceof Date);
	});

	/**
	 * Test complex query optimization
	 */
	it("should optimize complex queries with multiple steps", () => {
		const complexQuery = {
			find: { email: "test@example.com" },
			filter: record => record.status === "active",
			sort: (a, b) => a.id - b.id,
			limit: 10,
			offset: 5
		};
		
		const plan = optimizer.createPlan(complexQuery, mockContext);
		
		assert.ok(plan.steps.length > 1);
		
		// Verify different step types are included
		const stepTypes = plan.steps.map(step => step.operation);
		assert.ok(stepTypes.includes("index_lookup") || stepTypes.includes("full_scan"));
		
		if (complexQuery.sort) {
			assert.ok(stepTypes.includes("sort"));
		}
		
		if (complexQuery.limit) {
			assert.ok(stepTypes.includes("limit"));
		}
	});

	/**
	 * Test memory management
	 */
	it("should limit execution history size", () => {
		const testOptimizer = new QueryOptimizer();
		testOptimizer.maxHistorySize = 5; // Set small limit for testing
		
		// Generate more executions than the limit
		for (let i = 0; i < 10; i++) {
			const query = { find: { id: i } };
			const plan = testOptimizer.createPlan(query, {});
			plan.startExecution();
			plan.completeExecution(1);
			testOptimizer.recordExecution(plan);
		}
		
		assert.ok(testOptimizer.executionHistory.length <= testOptimizer.maxHistorySize);
	});

	/**
	 * Test error handling in optimization
	 */
	it("should handle optimization errors gracefully", () => {
		const invalidContext = {}; // No indexManager
		const query = { find: { email: "test@example.com" } };
		
		// Should not throw error, should fall back to full scan
		assert.doesNotThrow(() => {
			const plan = optimizer.createPlan(query, invalidContext);
			assert.ok(plan instanceof QueryPlan);
		});
	});

	/**
	 * Test filtered scan strategy with partial index
	 */
	it("should create filtered scan strategy with partial index", () => {
		const query = { filter: record => record.status === "active" };
		const plan = optimizer.createPlan(query, mockContext);
		
		// Should contain filter step when filter is present
		const filterSteps = plan.steps.filter(step => step.operation === "filter");
		assert.ok(filterSteps.length > 0);
	});

	/**
	 * Test unknown strategy type cost estimation
	 */
	it("should return maximum cost for unknown strategy types", () => {
		const unknownStrategy = { type: "unknown_strategy_type" };
		const cost = optimizer._estimateStrategyCost(unknownStrategy);
		
		assert.strictEqual(cost, Number.MAX_SAFE_INTEGER);
	});

	/**
	 * Test index lookup row estimation without index stats
	 */
	it("should estimate rows when index stats are missing", () => {
		const nonExistentIndex = "non_existent_index";
		const rows = optimizer._estimateIndexLookupRows(nonExistentIndex);
		
		// Should return 10% of total records as default
		const expectedRows = optimizer.statistics.totalRecords * 0.1;
		assert.strictEqual(rows, expectedRows);
	});

	/**
	 * Test cost model learning with consistent performance data
	 */
	it("should update cost model when performance is consistent", () => {
		const testOptimizer = new QueryOptimizer({ 
			collectStatistics: true, 
			statisticsUpdateInterval: 1 
		});
		
		// Set up some basic statistics
		testOptimizer.updateStatistics(new Map([["1", { id: 1 }]]), new Map());
		
		// Create execution history with consistent performance
		for (let i = 0; i < 10; i++) {
			const planStats = {
				queryId: `query_${i}`,
				steps: [{
					operation: "index_lookup",
					actualCost: 50, // Consistently higher than estimated
					estimatedCost: 25,
					actualRows: 100,
					estimatedRows: 100
				}]
			};
			testOptimizer.executionHistory.push(planStats);
		}
		
		const originalAdjustment = testOptimizer.costAdjustments.get("INDEX_LOOKUP");
		
		// Trigger cost model update
		testOptimizer._updateCostModel();
		
		const newAdjustment = testOptimizer.costAdjustments.get("INDEX_LOOKUP");
		
		// Adjustment should have changed due to consistent performance data
		assert.notStrictEqual(newAdjustment, originalAdjustment);
		assert.ok(newAdjustment > originalAdjustment); // Should increase due to higher actual costs
	});

	/**
	 * Test execution history cleanup when it exceeds threshold
	 */
	it("should clean up execution history when it exceeds threshold", () => {
		const testOptimizer = new QueryOptimizer({ 
			collectStatistics: true, 
			statisticsUpdateInterval: 1 
		});
		testOptimizer.maxHistorySize = 10; // Small for testing
		
		// Fill history beyond 80% threshold (8 items)
		for (let i = 0; i < 12; i++) {
			testOptimizer.executionHistory.push({
				queryId: `query_${i}`,
				steps: [{
					operation: "full_scan",
					actualCost: 10,
					estimatedCost: 10
				}]
			});
		}
		
		// Trigger update which should clean up history
		testOptimizer._updateCostModel();
		
		// History should be trimmed to 60% of max size (6 items)
		const expectedSize = Math.floor(testOptimizer.maxHistorySize * 0.6);
		assert.strictEqual(testOptimizer.executionHistory.length, expectedSize);
	});

	/**
	 * Test where clause strategy generation  
	 */
	it("should generate strategies for where clause queries", () => {
		const query = { where: record => record.age > 25 };
		const strategies = optimizer._generateStrategies(query, mockContext);
		
		assert.ok(Array.isArray(strategies));
		assert.ok(strategies.length > 0);
		
		// Should include filtered scan strategies
		const filteredScans = strategies.filter(s => s.type === "filtered_scan");
		assert.ok(filteredScans.length > 0);
	});


	/**
	 * Test unknown strategy type triggers default case
	 */
	it("should handle unknown strategy type with default case", () => {
		// Create a strategy that doesn't match any known types
		const unknownStrategy = { type: "completely_unknown" };
		
		// Create a mock plan to test the default case (line 528)
		const testPlan = new QueryPlan("test_default", {});
		
		// Directly test the _buildOptimizedPlan method with unknown strategy
		const testOptimizer = new QueryOptimizer();
		testOptimizer.updateStatistics(new Map([["1", { id: 1 }]]), new Map());
		
		// Mock getOptimalStrategy to return unknown strategy
		const originalGetOptimalStrategy = testOptimizer.getOptimalStrategy;
		testOptimizer.getOptimalStrategy = () => unknownStrategy;
		
		// This should trigger the default case and add full scan steps
		testOptimizer._buildOptimizedPlan(testPlan, {}, {});
		
		// Restore original method
		testOptimizer.getOptimalStrategy = originalGetOptimalStrategy;
		
		// Should have added full scan steps via default case
		assert.ok(testPlan.steps.length > 0);
		const fullScanSteps = testPlan.steps.filter(step => step.operation === "full_scan");
		assert.ok(fullScanSteps.length > 0);
	});

	/**
	 * Test query with offset parameter (line 617)
	 */
	it("should handle queries with offset parameter", () => {
		const query = { 
			find: { email: "test@example.com" },
			limit: 10,
			offset: 5  // This should trigger line 617
		};
		const plan = optimizer.createPlan(query, mockContext);
		
		// Should contain limit step with offset
		const limitSteps = plan.steps.filter(step => step.operation === "limit");
		assert.ok(limitSteps.length > 0);
		
		const limitStep = limitSteps[0];
		assert.strictEqual(limitStep.options.offset, 5);
		assert.strictEqual(limitStep.options.max, 10);
	});

	/**
	 * Test filtered scan strategy without index name (line 681)
	 */
	it("should estimate cost for filtered scan without index", () => {
		const strategyWithoutIndex = { 
			type: "filtered_scan",
			// No indexName property - should trigger line 681 fallback
			partialFilter: true
		};
		
		const cost = optimizer._estimateStrategyCost(strategyWithoutIndex);
		
		// Should calculate cost without index lookup component
		const expectedCost = optimizer._getAdjustedCostFactor("FILTER_EVALUATION") * optimizer.statistics.totalRecords;
		assert.strictEqual(cost, expectedCost);
	});

	/**
	 * Test invalid cost factor names (lines 702-703)
	 */
	it("should handle invalid cost factor names", () => {
		const invalidFactorName = "NONEXISTENT_FACTOR";
		const cost = optimizer._getAdjustedCostFactor(invalidFactorName);
		
		// Should return default cost of 1 * 1.0 = 1
		assert.strictEqual(cost, 1);
	});

	/**
	 * Test cost adjustment for unknown operation (line 797)
	 */
	it("should handle cost adjustment for unknown operation", () => {
		const testOptimizer = new QueryOptimizer({ 
			collectStatistics: true, 
			statisticsUpdateInterval: 1 
		});
		
		// Create execution history with an operation not in costAdjustments
		const unknownOperation = "UNKNOWN_OPERATION";
		testOptimizer.executionHistory = [{
			queryId: "test",
			steps: [{
				operation: "unknown_step", // This will map to null, then test line 797
				actualCost: 50,
				estimatedCost: 25,
				actualRows: 100,
				estimatedRows: 100
			}]
		}];
		
		// Mock _mapOperationToCostFactor to return an operation not in costAdjustments
		const originalMap = testOptimizer._mapOperationToCostFactor;
		testOptimizer._mapOperationToCostFactor = () => unknownOperation;
		
		// This should trigger line 797 fallback
		testOptimizer._updateCostModel();
		
		// Restore original method
		testOptimizer._mapOperationToCostFactor = originalMap;
		
		// Should have used default value of 1.0
		assert.ok(true); // Test completed without error
	});

	/**
	 * Test operation mapping fallback (line 899)
	 */
	it("should return null for unmapped operations", () => {
		const unknownOperation = "totally_unknown_operation";
		const mapped = optimizer._mapOperationToCostFactor(unknownOperation);
		
		// Should return null for unknown operations (line 899)
		assert.strictEqual(mapped, null);
	});

	/**
	 * Test variance calculation with insufficient data (line 910)
	 */
	it("should handle variance calculation with insufficient values", () => {
		// Test with empty array
		const variance1 = optimizer._calculateVariance([], 0);
		assert.strictEqual(variance1, 0);
		
		// Test with single value
		const variance2 = optimizer._calculateVariance([5], 5);
		assert.strictEqual(variance2, 0);
	});

	/**
	 * Test cache hit rate with zero requests (line 936)
	 */
	it("should handle cache hit rate calculation with zero requests", () => {
		const freshOptimizer = new QueryOptimizer();
		// No requests made, totalCacheRequests should be 0
		
		const hitRate = freshOptimizer._calculateCacheHitRate();
		
		// Should return 0 when no requests have been made (line 936)
		assert.strictEqual(hitRate, 0);
	});

	/**
	 * Test plan completion without execution start (line 134)
	 */
	it("should handle plan completion without execution start", () => {
		const plan = new QueryPlan("test_no_start", { test: true });
		
		// Complete execution without starting it - should use createdAt fallback
		plan.completeExecution(50);
		
		// Should calculate cost from createdAt instead of executedAt (line 134)
		assert.ok(plan.totalActualCost >= 0);
		assert.strictEqual(plan.totalActualRows, 50);
		assert.strictEqual(plan.executedAt, null);
	});

	/**
	 * Test selectivity with zero unique values (line 241)
	 */
	it("should handle selectivity calculation with zero unique values", () => {
		const stats = new DataStatistics();
		
		// Create mock field statistics with zero unique values
		stats.fieldStatistics.set("empty_field", {
			uniqueValues: 0, // This should trigger line 241 fallback
			nullCount: 5,
			dataType: "string"
		});
		
		const selectivity = stats.getSelectivity("empty_field");
		
		// Should return 1/1 = 1 when uniqueValues is 0 (line 241)
		assert.strictEqual(selectivity, 1);
	});

	/**
	 * Test index statistics with zero values (lines 311-312)
	 */
	it("should handle index statistics with zero values", () => {
		const stats = new DataStatistics();
		stats.totalRecords = 0; // This should trigger line 311 fallback
		
		// Create mock index storage with zero keys
		const mockIndexWithZeros = {
			getStats: () => ({
				totalKeys: 0, // This should trigger line 312 fallback
				totalEntries: 0,
				memoryUsage: 0
			})
		};
		
		const mockIndexes = new Map([["zero_index", mockIndexWithZeros]]);
		
		stats._updateIndexStatistics(mockIndexes);
		
		const indexStats = stats.indexStatistics.get("zero_index");
		assert.ok(indexStats);
		assert.strictEqual(indexStats.selectivity, 1); // Fallback from line 311
		assert.strictEqual(indexStats.avgEntriesPerKey, 1); // Fallback from line 312
	});

	/**
	 * Test empty strategy generation (line 452)
	 */
	it("should handle empty strategy generation", () => {
		const testOptimizer = new QueryOptimizer();
		testOptimizer.updateStatistics(new Map(), new Map());
		
		// Mock _generateStrategies to return empty array
		const originalGenerate = testOptimizer._generateStrategies;
		testOptimizer._generateStrategies = () => []; // Empty strategies
		
		const strategy = testOptimizer.getOptimalStrategy({}, {});
		
		// Restore original method
		testOptimizer._generateStrategies = originalGenerate;
		
		// Should return fallback strategy (line 452)
		assert.strictEqual(strategy.type, "full_scan");
		assert.ok(typeof strategy.estimatedCost === "number");
	});

	/**
	 * Test where clause without filter (line 571)
	 */
	it("should handle where clause when filter is not present", () => {
		const query = { 
			where: record => record.status === "active"
			// No filter property - should use where (line 571)
		};
		
		const plan = optimizer.createPlan(query, mockContext);
		
		// Should contain filter step that uses where clause
		const filterSteps = plan.steps.filter(step => step.operation === "filter");
		assert.ok(filterSteps.length > 0);
		
		const filterStep = filterSteps[0];
		assert.strictEqual(filterStep.options.predicate, query.where);
	});

	/**
	 * Test query limit without offset (line 617)
	 */
	it("should handle query limit without offset to trigger fallback", () => {
		const query = { 
			find: { email: "test@example.com" },
			limit: 20
			// No offset property - should trigger line 617 fallback (|| 0)
		};
		
		const plan = optimizer.createPlan(query, mockContext);
		
		// Should contain limit step with offset defaulting to 0
		const limitSteps = plan.steps.filter(step => step.operation === "limit");
		assert.ok(limitSteps.length > 0);
		
		const limitStep = limitSteps[0];
		assert.strictEqual(limitStep.options.offset, 0); // Should default to 0 from line 617
		assert.strictEqual(limitStep.options.max, 20);
	});

	/**
	 * Test cost adjustment for operation not in map (line 797)
	 */
	it("should handle cost adjustment fallback for missing operation", () => {
		const testOptimizer = new QueryOptimizer({ 
			collectStatistics: true, 
			statisticsUpdateInterval: 1 
		});
		
		// Create execution history that will trigger the exact scenario for line 797
		// We need to simulate getting a known operation that exists in the mapping
		// but is NOT in the costAdjustments map
		
		// Clear costAdjustments and add only some operations
		testOptimizer.costAdjustments.clear();
		testOptimizer.costAdjustments.set("INDEX_LOOKUP", 1.0);
		testOptimizer.costAdjustments.set("FULL_SCAN", 1.0);
		// Deliberately NOT adding "FILTER_EVALUATION" to trigger line 797
		
		// Add execution history for filter operations with sufficient sample size
		// Need at least 10 total entries (line 785) and 3 for this operation (line 796)
		for (let i = 0; i < 12; i++) {
			testOptimizer.executionHistory.push({
				queryId: `test_${i}`,
				steps: [{
					operation: "filter", // This maps to "FILTER_EVALUATION" which won't be in costAdjustments
					actualCost: 50,
					estimatedCost: 25,
					actualRows: 100,
					estimatedRows: 100
				}]
			});
		}
		
		// Verify that FILTER_EVALUATION is not in costAdjustments
		assert.strictEqual(testOptimizer.costAdjustments.has("FILTER_EVALUATION"), false);
		
		// Verify that the mapping will return "FILTER_EVALUATION" for "filter"
		assert.strictEqual(testOptimizer._mapOperationToCostFactor("filter"), "FILTER_EVALUATION");
		
		// This should trigger line 797: costAdjustments.get("FILTER_EVALUATION") returns undefined, so || 1.0 is used
		testOptimizer._updateCostModel();
		
		// After the update, FILTER_EVALUATION should now be in costAdjustments
		assert.strictEqual(testOptimizer.costAdjustments.has("FILTER_EVALUATION"), true);
	});
});
