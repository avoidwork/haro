/**
 * Query operation types
 */
export const QueryTypes = {
	FIND: "find",
	FILTER: "filter",
	SEARCH: "search",
	WHERE: "where",
	SORT: "sort",
	LIMIT: "limit",
	AGGREGATE: "aggregate"
};

/**
 * Cost estimation factors
 */
export const CostFactors = {
	INDEX_LOOKUP: 1,
	FULL_SCAN: 100,
	FILTER_EVALUATION: 10,
	SORT_OPERATION: 50,
	MEMORY_ACCESS: 1,
	COMPARISON: 2,
	REGEX_MATCH: 20
};

/**
 * Query execution plan step
 */
export class QueryPlanStep {
	/**
	 * @param {string} operation - Operation type
	 * @param {Object} [options={}] - Operation options
	 * @param {number} [estimatedCost=0] - Estimated cost of this step
	 * @param {number} [estimatedRows=0] - Estimated number of rows processed
	 */
	constructor (operation, options = {}, estimatedCost = 0, estimatedRows = 0) {
		this.operation = operation;
		this.options = options;
		this.estimatedCost = estimatedCost;
		this.estimatedRows = estimatedRows;
		this.actualCost = null;
		this.actualRows = null;
		this.startTime = null;
		this.endTime = null;
	}

	/**
	 * Start execution timing
	 */
	startExecution () {
		this.startTime = Date.now();
	}

	/**
	 * End execution timing
	 * @param {number} actualRows - Actual number of rows processed
	 */
	endExecution (actualRows) {
		this.endTime = Date.now();
		this.actualCost = this.endTime - this.startTime;
		this.actualRows = actualRows;
	}

	/**
	 * Get execution statistics
	 * @returns {Object} Execution statistics
	 */
	getStats () {
		return {
			operation: this.operation,
			options: this.options,
			estimatedCost: this.estimatedCost,
			estimatedRows: this.estimatedRows,
			actualCost: this.actualCost,
			actualRows: this.actualRows,
			costAccuracy: this.actualCost && this.estimatedCost ?
				Math.abs(this.actualCost - this.estimatedCost) / this.estimatedCost :
				null,
			rowAccuracy: this.actualRows !== null && this.estimatedRows ?
				Math.abs(this.actualRows - this.estimatedRows) / this.estimatedRows :
				null
		};
	}
}

/**
 * Query execution plan
 */
export class QueryPlan {
	/**
	 * @param {string} queryId - Unique query identifier
	 * @param {Object} originalQuery - Original query object
	 */
	constructor (queryId, originalQuery) {
		this.queryId = queryId;
		this.originalQuery = originalQuery;
		this.steps = [];
		this.totalEstimatedCost = 0;
		this.totalEstimatedRows = 0;
		this.totalActualCost = null;
		this.totalActualRows = null;
		this.createdAt = new Date();
		this.executedAt = null;
		this.completedAt = null;
	}

	/**
	 * Add a step to the execution plan
	 * @param {QueryPlanStep} step - Query plan step
	 * @returns {QueryPlan} This plan for chaining
	 */
	addStep (step) {
		this.steps.push(step);
		this.totalEstimatedCost += step.estimatedCost;

		return this;
	}

	/**
	 * Start plan execution
	 */
	startExecution () {
		this.executedAt = new Date();
	}

	/**
	 * Complete plan execution
	 * @param {number} actualRows - Final number of rows returned
	 */
	completeExecution (actualRows) {
		this.completedAt = new Date();
		this.totalActualRows = actualRows;
		this.totalActualCost = this.completedAt.getTime() - (this.executedAt?.getTime() || this.createdAt.getTime());
	}

	/**
	 * Get execution statistics
	 * @returns {Object} Execution statistics
	 */
	getStats () {
		return {
			queryId: this.queryId,
			originalQuery: this.originalQuery,
			stepCount: this.steps.length,
			totalEstimatedCost: this.totalEstimatedCost,
			totalEstimatedRows: this.totalEstimatedRows,
			totalActualCost: this.totalActualCost,
			totalActualRows: this.totalActualRows,
			createdAt: this.createdAt,
			executedAt: this.executedAt,
			completedAt: this.completedAt,
			steps: this.steps.map(step => step.getStats()),
			efficiency: this.totalActualCost && this.totalEstimatedCost ?
				this.totalEstimatedCost / this.totalActualCost :
				null
		};
	}

	/**
	 * Export plan for debugging
	 * @returns {Object} Exportable plan data
	 */
	export () {
		return {
			...this.getStats(),
			explanation: this._generateExplanation()
		};
	}

	/**
	 * Generate human-readable explanation of the plan
	 * @returns {string[]} Array of explanation lines
	 * @private
	 */
	_generateExplanation () {
		const explanation = [];

		explanation.push(`Query Plan for: ${JSON.stringify(this.originalQuery)}`);
		explanation.push(`Estimated cost: ${this.totalEstimatedCost}, rows: ${this.totalEstimatedRows}`);

		if (this.totalActualCost !== null) {
			explanation.push(`Actual cost: ${this.totalActualCost}, rows: ${this.totalActualRows}`);
		}

		explanation.push("");
		explanation.push("Execution steps:");

		this.steps.forEach((step, index) => {
			const stats = step.getStats();
			explanation.push(`${index + 1}. ${stats.operation} (cost: ${stats.estimatedCost}, rows: ${stats.estimatedRows})`);

			if (stats.actualCost !== null) {
				explanation.push(`   Actual: cost: ${stats.actualCost}, rows: ${stats.actualRows}`);
			}
		});

		return explanation;
	}
}

/**
 * Statistics about data distribution for cost estimation
 */
export class DataStatistics {
	constructor () {
		this.totalRecords = 0;
		this.indexStatistics = new Map(); // Map<indexName, {cardinality, selectivity, histogram}>
		this.fieldStatistics = new Map(); // Map<fieldName, {nullCount, uniqueValues, dataType, avgLength}>
		this.lastUpdated = new Date();
	}

	/**
	 * Update statistics from current data
	 * @param {Map} records - Current record data
	 * @param {Map} indexes - Current index data
	 */
	update (records, indexes) {
		this.totalRecords = records.size;
		this.lastUpdated = new Date();

		// Update field statistics
		this._updateFieldStatistics(records);

		// Update index statistics
		this._updateIndexStatistics(indexes);
	}

	/**
	 * Get selectivity estimate for a field value
	 * @param {string} fieldName - Field name
	 * @param {*} value - Field value
	 * @returns {number} Selectivity estimate (0-1)
	 */
	getSelectivity (fieldName, value) {
		const fieldStats = this.fieldStatistics.get(fieldName);
		if (!fieldStats) {
			return 0.1; // Default selectivity
		}

		// Simple selectivity estimation
		return 1 / (fieldStats.uniqueValues || 1);
	}

	/**
	 * Get cardinality estimate for an index
	 * @param {string} indexName - Index name
	 * @returns {number} Cardinality estimate
	 */
	getIndexCardinality (indexName) {
		const indexStats = this.indexStatistics.get(indexName);

		return indexStats ? indexStats.cardinality : this.totalRecords;
	}

	/**
	 * Update field statistics
	 * @param {Map} records - Record data
	 * @private
	 */
	_updateFieldStatistics (records) {
		const fieldData = new Map();

		// Collect field data
		for (const record of records.values()) {
			for (const [fieldName, value] of Object.entries(record)) {
				if (!fieldData.has(fieldName)) {
					fieldData.set(fieldName, {
						values: new Set(),
						nullCount: 0,
						totalLength: 0,
						count: 0
					});
				}

				const data = fieldData.get(fieldName);
				data.count++;

				if (value === null || value === undefined) {
					data.nullCount++;
				} else {
					data.values.add(value);
					if (typeof value === "string") {
						data.totalLength += value.length;
					}
				}
			}
		}

		// Convert to statistics
		for (const [fieldName, data] of fieldData) {
			this.fieldStatistics.set(fieldName, {
				uniqueValues: data.values.size,
				nullCount: data.nullCount,
				dataType: this._inferDataType(data.values),
				avgLength: data.totalLength / data.count || 0,
				cardinality: data.values.size / this.totalRecords
			});
		}
	}

	/**
	 * Update index statistics
	 * @param {Map} indexes - Index data
	 * @private
	 */
	_updateIndexStatistics (indexes) {
		for (const [indexName, indexStorage] of indexes) {
			const stats = indexStorage.getStats();
			this.indexStatistics.set(indexName, {
				cardinality: stats.totalKeys,
				selectivity: stats.totalKeys / this.totalRecords || 1,
				avgEntriesPerKey: stats.totalEntries / stats.totalKeys || 1,
				memoryUsage: stats.memoryUsage
			});
		}
	}

	/**
	 * Infer data type from values
	 * @param {Set} values - Set of values
	 * @returns {string} Inferred data type
	 * @private
	 */
	_inferDataType (values) {
		const sample = Array.from(values).slice(0, 10);
		const types = new Set(sample.map(v => typeof v));

		if (types.size === 1) {
			return types.values().next().value;
		}

		return "mixed";
	}
}

/**
 * Query optimizer that creates efficient execution plans
 */
export class QueryOptimizer {
	/**
	 * @param {Object} [options={}] - Optimizer options
	 * @param {boolean} [options.collectStatistics=true] - Whether to collect query statistics
	 * @param {number} [options.statisticsUpdateInterval=1000] - How often to update statistics (queries)
	 */
	constructor (options = {}) {
		this.options = {
			collectStatistics: true,
			statisticsUpdateInterval: 1000,
			...options
		};

		this.statistics = new DataStatistics();
		this.queryCounter = 0;
		this.planCache = new Map();
		this.executionHistory = [];
		this.maxHistorySize = 1000;
	}

	/**
	 * Create an optimized query plan
	 * @param {Object} query - Query object
	 * @param {Object} context - Query context (available indexes, etc.)
	 * @returns {QueryPlan} Optimized query plan
	 */
	createPlan (query, context) {
		const queryId = `query_${++this.queryCounter}`;
		const plan = new QueryPlan(queryId, query);

		// Check plan cache first
		const cacheKey = this._generateCacheKey(query);
		const cachedPlan = this.planCache.get(cacheKey);
		if (cachedPlan && this._isCacheValid(cachedPlan)) {
			return this._copyPlan(cachedPlan, queryId);
		}

		// Create optimized plan
		this._buildOptimizedPlan(plan, query, context);

		// Cache the plan
		this.planCache.set(cacheKey, plan);

		return plan;
	}

	/**
	 * Update statistics with current data
	 * @param {Map} records - Current records
	 * @param {Map} indexes - Current indexes
	 */
	updateStatistics (records, indexes) {
		this.statistics.update(records, indexes);
	}

	/**
	 * Record plan execution for learning
	 * @param {QueryPlan} plan - Executed plan
	 */
	recordExecution (plan) {
		if (!this.options.collectStatistics) return;

		this.executionHistory.push(plan.getStats());

		// Limit history size
		if (this.executionHistory.length > this.maxHistorySize) {
			this.executionHistory.shift();
		}

		// Periodically update statistics
		if (this.queryCounter % this.options.statisticsUpdateInterval === 0) {
			this._updateCostModel();
		}
	}

	/**
	 * Get optimal execution strategy for a query
	 * @param {Object} query - Query object
	 * @param {Object} context - Available indexes and options
	 * @returns {Object} Execution strategy
	 */
	getOptimalStrategy (query, context) {
		const strategies = this._generateStrategies(query, context);

		// Estimate costs for each strategy
		const costedStrategies = strategies.map(strategy => ({
			...strategy,
			estimatedCost: this._estimateStrategyCost(strategy, context)
		}));

		// Sort by estimated cost
		costedStrategies.sort((a, b) => a.estimatedCost - b.estimatedCost);

		return costedStrategies[0] || { type: "full_scan", estimatedCost: CostFactors.FULL_SCAN * this.statistics.totalRecords };
	}

	/**
	 * Get optimizer statistics
	 * @returns {Object} Optimizer statistics
	 */
	getStats () {
		return {
			queryCounter: this.queryCounter,
			planCacheSize: this.planCache.size,
			executionHistorySize: this.executionHistory.length,
			dataStatistics: {
				totalRecords: this.statistics.totalRecords,
				lastUpdated: this.statistics.lastUpdated,
				indexCount: this.statistics.indexStatistics.size,
				fieldCount: this.statistics.fieldStatistics.size
			},
			averageQueryCost: this._calculateAverageQueryCost(),
			cacheHitRate: this._calculateCacheHitRate()
		};
	}

	/**
	 * Clear optimizer caches and history
	 */
	clear () {
		this.planCache.clear();
		this.executionHistory = [];
		this.queryCounter = 0;
	}

	/**
	 * Build optimized execution plan
	 * @param {QueryPlan} plan - Plan to build
	 * @param {Object} query - Query object
	 * @param {Object} context - Query context
	 * @private
	 */
	_buildOptimizedPlan (plan, query, context) {
		const strategy = this.getOptimalStrategy(query, context);

		switch (strategy.type) {
			case "index_lookup":
				this._addIndexLookupSteps(plan, query, strategy, context);
				break;
			case "filtered_scan":
				this._addFilteredScanSteps(plan, query, strategy, context);
				break;
			case "full_scan":
				this._addFullScanSteps(plan, query, context);
				break;
			default:
				this._addFullScanSteps(plan, query, context);
		}

		// Add post-processing steps
		this._addPostProcessingSteps(plan, query, context);
	}

	/**
	 * Add index lookup steps to plan
	 * @param {QueryPlan} plan - Query plan
	 * @param {Object} query - Query object
	 * @param {Object} strategy - Execution strategy
	 * @param {Object} context - Query context
	 * @private
	 */
	_addIndexLookupSteps (plan, query, strategy, context) {
		const step = new QueryPlanStep(
			"index_lookup",
			{
				indexName: strategy.indexName,
				lookupKey: strategy.lookupKey
			},
			CostFactors.INDEX_LOOKUP,
			this._estimateIndexLookupRows(strategy.indexName, strategy.lookupKey)
		);

		plan.addStep(step);
	}

	/**
	 * Add filtered scan steps to plan
	 * @param {QueryPlan} plan - Query plan
	 * @param {Object} query - Query object
	 * @param {Object} strategy - Execution strategy
	 * @param {Object} context - Query context
	 * @private
	 */
	_addFilteredScanSteps (plan, query, strategy, context) {
		// First, index lookup for partial filtering
		if (strategy.indexName) {
			this._addIndexLookupSteps(plan, query, strategy, context);
		}

		// Then, filter remaining records
		const filterStep = new QueryPlanStep(
			"filter",
			{ predicate: query.filter || query.where },
			CostFactors.FILTER_EVALUATION * this.statistics.totalRecords,
			this.statistics.totalRecords * 0.1 // Assume 10% selectivity
		);

		plan.addStep(filterStep);
	}

	/**
	 * Add full scan steps to plan
	 * @param {QueryPlan} plan - Query plan
	 * @param {Object} query - Query object
	 * @param {Object} context - Query context
	 * @private
	 */
	_addFullScanSteps (plan, query, context) {
		const step = new QueryPlanStep(
			"full_scan",
			{ scanType: "sequential" },
			CostFactors.FULL_SCAN * this.statistics.totalRecords,
			this.statistics.totalRecords
		);

		plan.addStep(step);
	}

	/**
	 * Add post-processing steps (sort, limit, etc.)
	 * @param {QueryPlan} plan - Query plan
	 * @param {Object} query - Query object
	 * @param {Object} context - Query context
	 * @private
	 */
	_addPostProcessingSteps (plan, query, context) {
		// Add sort step if needed
		if (query.sort || query.sortBy) {
			const sortStep = new QueryPlanStep(
				"sort",
				{ sortField: query.sortBy, sortFunction: query.sort },
				CostFactors.SORT_OPERATION * plan.totalEstimatedRows,
				plan.totalEstimatedRows
			);
			plan.addStep(sortStep);
		}

		// Add limit step if needed
		if (query.limit) {
			const limitStep = new QueryPlanStep(
				"limit",
				{ offset: query.offset || 0, max: query.limit },
				CostFactors.MEMORY_ACCESS,
				Math.min(query.limit, plan.totalEstimatedRows)
			);
			plan.addStep(limitStep);
		}
	}

	/**
	 * Generate possible execution strategies
	 * @param {Object} query - Query object
	 * @param {Object} context - Available indexes and options
	 * @returns {Array} Array of possible strategies
	 * @private
	 */
	_generateStrategies (query, context) {
		const strategies = [];

		// Strategy 1: Full scan (always available)
		strategies.push({ type: "full_scan" });

		// Strategy 2: Index-based lookup
		if (query.find && context.indexManager) {
			const fields = Object.keys(query.find);
			const optimalIndex = context.indexManager.getOptimalIndex(fields);

			if (optimalIndex) {
				strategies.push({
					type: "index_lookup",
					indexName: optimalIndex,
					lookupKey: this._generateLookupKey(query.find, fields)
				});
			}
		}

		// Strategy 3: Filtered scan with partial index
		if ((query.filter || query.where) && context.indexManager) {
			const availableIndexes = context.indexManager.listIndexes();

			for (const indexName of availableIndexes) {
				strategies.push({
					type: "filtered_scan",
					indexName,
					partialFilter: true
				});
			}
		}

		return strategies;
	}

	/**
	 * Estimate cost of an execution strategy
	 * @param {Object} strategy - Execution strategy
	 * @param {Object} context - Query context
	 * @returns {number} Estimated cost
	 * @private
	 */
	_estimateStrategyCost (strategy, context) {
		switch (strategy.type) {
			case "index_lookup":
				return CostFactors.INDEX_LOOKUP +
					   this._estimateIndexLookupRows(strategy.indexName, strategy.lookupKey) * CostFactors.MEMORY_ACCESS;

			case "filtered_scan":
				const indexCost = strategy.indexName ? CostFactors.INDEX_LOOKUP : 0;
				const filterCost = CostFactors.FILTER_EVALUATION * this.statistics.totalRecords;

				return indexCost + filterCost;

			case "full_scan":
				return CostFactors.FULL_SCAN * this.statistics.totalRecords;

			default:
				return Number.MAX_SAFE_INTEGER;
		}
	}

	/**
	 * Estimate number of rows returned by index lookup
	 * @param {string} indexName - Index name
	 * @param {string} lookupKey - Lookup key
	 * @returns {number} Estimated row count
	 * @private
	 */
	_estimateIndexLookupRows (indexName, lookupKey) {
		const indexStats = this.statistics.indexStatistics.get(indexName);
		if (!indexStats) {
			return this.statistics.totalRecords * 0.1; // Default 10%
		}

		return Math.max(1, this.statistics.totalRecords / indexStats.cardinality);
	}

	/**
	 * Generate cache key for query
	 * @param {Object} query - Query object
	 * @returns {string} Cache key
	 * @private
	 */
	_generateCacheKey (query) {
		return JSON.stringify(query);
	}

	/**
	 * Check if cached plan is still valid
	 * @param {QueryPlan} cachedPlan - Cached plan
	 * @returns {boolean} True if cache is valid
	 * @private
	 */
	_isCacheValid (cachedPlan) {
		// Simple cache invalidation based on time
		const maxAge = 5 * 60 * 1000; // 5 minutes

		return Date.now() - cachedPlan.createdAt.getTime() < maxAge;
	}

	/**
	 * Copy a cached plan with new ID
	 * @param {QueryPlan} originalPlan - Original plan
	 * @param {string} newQueryId - New query ID
	 * @returns {QueryPlan} Copied plan
	 * @private
	 */
	_copyPlan (originalPlan, newQueryId) {
		const newPlan = new QueryPlan(newQueryId, originalPlan.originalQuery);

		for (const step of originalPlan.steps) {
			const newStep = new QueryPlanStep(
				step.operation,
				step.options,
				step.estimatedCost,
				step.estimatedRows
			);
			newPlan.addStep(newStep);
		}

		return newPlan;
	}

	/**
	 * Generate lookup key from query criteria
	 * @param {Object} criteria - Query criteria
	 * @param {string[]} fields - Field names
	 * @returns {string} Lookup key
	 * @private
	 */
	_generateLookupKey (criteria, fields) {
		return fields.sort().map(field => String(criteria[field])).join("|");
	}

	/**
	 * Update cost model based on execution history
	 * @private
	 */
	_updateCostModel () {
		// Analyze execution history to improve cost estimates
		// This would use machine learning techniques in a real implementation
		// For now, we'll keep it simple
	}

	/**
	 * Calculate average query cost from history
	 * @returns {number} Average query cost
	 * @private
	 */
	_calculateAverageQueryCost () {
		if (this.executionHistory.length === 0) return 0;

		const totalCost = this.executionHistory.reduce((sum, plan) => sum + (plan.totalActualCost || 0), 0);

		return totalCost / this.executionHistory.length;
	}

	/**
	 * Calculate cache hit rate
	 * @returns {number} Cache hit rate (0-1)
	 * @private
	 */
	_calculateCacheHitRate () {
		// This would be tracked during plan creation in a real implementation
		return 0.5; // Placeholder
	}
}
