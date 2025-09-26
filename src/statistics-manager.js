/**
 * Manages statistics gathering and memory usage estimation
 */
export class StatisticsManager {
	/**
	 * @param {Object} dependencies - Required dependencies
	 * @param {StorageManager} dependencies.storageManager - Storage manager
	 * @param {IndexManager} dependencies.indexManager - Index manager
	 * @param {VersionManager} [dependencies.versionManager] - Version manager
	 * @param {TransactionManager} [dependencies.transactionManager] - Transaction manager
	 * @param {QueryOptimizer} [dependencies.queryOptimizer] - Query optimizer
	 * @param {Object} dependencies.config - Configuration
	 */
	constructor ({
		storageManager,
		indexManager,
		versionManager = null,
		transactionManager = null,
		queryOptimizer = null,
		config
	}) {
		this.storageManager = storageManager;
		this.indexManager = indexManager;
		this.versionManager = versionManager;
		this.transactionManager = transactionManager;
		this.queryOptimizer = queryOptimizer;
		this.config = config;
	}

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Statistics object
	 */
	getStats () {
		const stats = {
			records: this.storageManager.size,
			configuration: this.config,
			indexes: this.indexManager.getStats(),
			memory: this._estimateMemoryUsage()
		};

		if (this.versionManager) {
			stats.versions = this.versionManager.getStats();
		}

		if (this.transactionManager) {
			stats.transactions = this.transactionManager.getStats();
		}

		if (this.queryOptimizer) {
			stats.queries = this.queryOptimizer.getStats();
		}

		return stats;
	}

	/**
	 * Get storage statistics
	 * @returns {Object} Storage statistics
	 */
	getStorageStats () {
		return {
			size: this.storageManager.size,
			memoryUsage: this.storageManager.estimateMemoryUsage(),
			type: this.config.immutable ? "immutable" : "mutable"
		};
	}

	/**
	 * Get index statistics
	 * @returns {Object} Index statistics
	 */
	getIndexStats () {
		return this.indexManager.getStats();
	}

	/**
	 * Get version statistics
	 * @returns {Object|null} Version statistics
	 */
	getVersionStats () {
		return this.versionManager ? this.versionManager.getStats() : null;
	}

	/**
	 * Get transaction statistics
	 * @returns {Object|null} Transaction statistics
	 */
	getTransactionStats () {
		return this.transactionManager ? this.transactionManager.getStats() : null;
	}

	/**
	 * Get query optimization statistics
	 * @returns {Object|null} Query statistics
	 */
	getQueryStats () {
		return this.queryOptimizer ? this.queryOptimizer.getStats() : null;
	}

	/**
	 * Get performance metrics
	 * @returns {Object} Performance metrics
	 */
	getPerformanceMetrics () {
		const stats = this.getStats();

		return {
			recordsPerIndex: stats.records / Math.max(1, Object.keys(stats.indexes || {}).length),
			memoryPerRecord: stats.memory.total / Math.max(1, stats.records),
			indexEfficiency: this._calculateIndexEfficiency(stats),
			overheadRatio: stats.memory.overhead / Math.max(1, stats.memory.data)
		};
	}

	/**
	 * Estimate memory usage
	 * @returns {Object} Memory usage statistics
	 * @private
	 */
	_estimateMemoryUsage () {
		const dataSize = this.storageManager.estimateMemoryUsage();
		const indexSize = this.indexManager.getStats().totalMemoryUsage || 0;
		const versionSize = this.versionManager ? this.versionManager.getStats().totalSize : 0;

		return {
			total: dataSize + indexSize + versionSize,
			data: dataSize,
			indexes: indexSize,
			versions: versionSize,
			overhead: indexSize + versionSize
		};
	}

	/**
	 * Calculate index efficiency
	 * @param {Object} stats - Statistics object
	 * @returns {number} Efficiency percentage
	 * @private
	 */
	_calculateIndexEfficiency (stats) {
		if (!stats.indexes || !stats.queries) {
			return 0;
		}

		const totalQueries = stats.queries.totalExecutions || 1;
		const indexedQueries = stats.queries.indexedExecutions || 0;

		return indexedQueries / totalQueries * 100;
	}

	/**
	 * Generate performance report
	 * @returns {Object} Performance report
	 */
	generateReport () {
		const stats = this.getStats();
		const performance = this.getPerformanceMetrics();

		return {
			summary: {
				totalRecords: stats.records,
				totalMemory: stats.memory.total,
				activeIndexes: Object.keys(stats.indexes || {}).length,
				versioning: !!this.versionManager,
				transactions: !!this.transactionManager,
				optimization: !!this.queryOptimizer
			},
			performance,
			breakdown: {
				storage: this.getStorageStats(),
				indexes: this.getIndexStats(),
				versions: this.getVersionStats(),
				transactions: this.getTransactionStats(),
				queries: this.getQueryStats()
			},
			recommendations: this._generateRecommendations(stats, performance)
		};
	}

	/**
	 * Generate performance recommendations
	 * @param {Object} stats - Statistics object
	 * @param {Object} performance - Performance metrics
	 * @returns {Array} Array of recommendations
	 * @private
	 */
	_generateRecommendations (stats, performance) {
		const recommendations = [];

		if (performance.indexEfficiency < 50) {
			recommendations.push("Consider adding more indexes for frequently queried fields");
		}

		if (performance.overheadRatio > 2) {
			recommendations.push("High memory overhead detected - consider optimizing indexes or version retention");
		}

		if (stats.records > 10000 && !this.queryOptimizer) {
			recommendations.push("Enable query optimization for better performance with large datasets");
		}

		if (stats.memory.versions > stats.memory.data) {
			recommendations.push("Version storage is larger than data - consider adjusting retention policy");
		}

		return recommendations;
	}
}
