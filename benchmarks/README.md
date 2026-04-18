# Haro Benchmark Suite

A comprehensive performance testing suite for the Haro immutable data store library. This benchmark suite tests various aspects of Haro's performance including basic operations, search/filter capabilities, indexing, memory usage, and comparisons with native JavaScript data structures.

## Overview

The benchmark suite consists of several modules that test different aspects of Haro's performance:

- **Basic Operations** - CRUD operations (Create, Read, Update, Delete)
- **Search & Filter** - Query performance with various patterns
- **Index Operations** - Indexing performance and benefits
- **Pagination** - Limit-based pagination performance
- **Persistence** - Dump/override operations for data serialization
- **Immutable Comparison** - Performance comparison between mutable and immutable modes

## Quick Start

### Run All Benchmarks

```bash
node benchmarks/index.js
```

### Run Specific Benchmark Categories

```bash
# Run only basic operations
node benchmarks/index.js --basic-only

# Run only search and filter benchmarks
node benchmarks/index.js --search-only

# Run only index operations
node benchmarks/index.js --index-only

# Run only memory usage benchmarks
node benchmarks/index.js --memory-only

# Run only comparison benchmarks
node benchmarks/index.js --comparison-only



# Run only pagination benchmarks
node benchmarks/index.js --pagination-only

# Run only persistence benchmarks
node benchmarks/index.js --persistence-only

# Run only immutable vs mutable comparison
node benchmarks/index.js --immutable-only

# Run only core benchmarks (basic, search, index)
node benchmarks/index.js --core-only

# Run only advanced benchmarks (memory, comparison, utilities, etc.)
node benchmarks/index.js --advanced-only

# Exclude specific benchmarks
node benchmarks/index.js --no-memory --no-persistence

# Run quietly (minimal output)
node benchmarks/index.js --quiet
```

### Run Individual Benchmark Files

```bash
# Basic operations
node benchmarks/basic-operations.js

# Search and filter operations
node benchmarks/search-filter.js

# Index operations
node benchmarks/index-operations.js

# Memory usage analysis
node benchmarks/memory-usage.js

# Performance comparisons
node benchmarks/comparison.js



# Pagination benchmarks
node benchmarks/pagination.js

# Persistence operations
node benchmarks/persistence.js

# Immutable vs mutable comparison
node benchmarks/immutable-comparison.js
```

## Benchmark Categories

### 1. Basic Operations (`basic-operations.js`)

Tests fundamental CRUD operations performance:

- **SET operations**: Individual and batch record creation
- **GET operations**: Record retrieval by key
- **DELETE operations**: Individual and batch record deletion
- **CLEAR operations**: Store clearing performance

**Data Sizes Tested**: 100, 1,000, 10,000, 50,000 records

**Key Metrics**:

- Operations per second
- Total execution time
- Average operation time

### 2. Search & Filter (`search-filter.js`)

Tests query performance with various patterns:

- **FIND operations**: Indexed field queries
- **FILTER operations**: Predicate-based filtering
- **SEARCH operations**: String, regex, and function-based search
- **WHERE operations**: Complex conditional queries with AND/OR
- **MAP/REDUCE operations**: Data transformation performance
- **SORT operations**: Sorting by different criteria

**Data Sizes Tested**: 1,000, 10,000, 50,000 records

**Key Features Tested**:

- Simple vs complex queries
- Indexed vs non-indexed queries
- Array field queries
- Regular expression matching
- Custom predicate functions

### 3. Index Operations (`index-operations.js`)

Tests indexing performance and benefits:

- **Index creation**: Single and composite index building
- **Index queries**: Performance of indexed vs non-indexed queries
- **Index modification**: Performance impact of updates/deletes
- **Index memory**: Memory overhead and export/import
- **Index comparison**: Performance benefits analysis

**Index Types Tested**:

- Single field indexes
- Composite indexes (multi-field)
- Array field indexes
- Nested field indexes

**Data Sizes Tested**: 1,000, 10,000, 50,000 records

### 4. Memory Usage (`memory-usage.js`)

Analyzes memory consumption patterns:

- **Creation memory**: Memory usage during store creation
- **Operation memory**: Memory impact of CRUD operations
- **Query memory**: Memory consumption during queries
- **Index memory**: Memory overhead of indexing
- **Versioning memory**: Memory impact of versioning
- **Stress memory**: Memory under high load conditions

**Special Features**:

- Memory growth analysis over time
- Garbage collection tracking
- Memory leak detection
- Memory efficiency recommendations

### 5. Comparison (`comparison.js`)

Compares Haro performance with native JavaScript structures:

- **vs Map**: Performance comparison with native Map
- **vs Object**: Performance comparison with plain objects
- **vs Array**: Performance comparison with native arrays
- **Advanced features**: Unique Haro capabilities vs manual implementation

**Operations Compared**:

- Storage operations
- Retrieval operations
- Query operations
- Deletion operations
- Aggregation operations
- Sorting operations
- Memory usage

### 6. Pagination (`pagination.js`)

Tests pagination and data limiting performance:

- **LIMIT operations**: Basic pagination with different page sizes
- **OFFSET operations**: Performance across different offset positions
- **PAGE SIZE optimization**: Finding optimal page sizes
- **SEQUENTIAL pagination**: Simulating real browsing patterns
- **COMBINED operations**: Pagination with filtering and sorting

**Data Sizes Tested**: 1,000, 10,000, 50,000 records

**Key Features Tested**:

- Small vs large page sizes
- First page vs middle vs last page performance
- Memory efficiency of chunked vs full data access
- Integration with query operations

### 7. Persistence (`persistence.js`)

Tests data serialization and restoration performance:

- **DUMP operations**: Exporting records and indexes
- **OVERRIDE operations**: Importing and restoring data
- **ROUND-TRIP operations**: Complete export/import cycles
- **COMPLEX objects**: Performance with nested data structures
- **MEMORY efficiency**: Memory usage during persistence operations

**Data Sizes Tested**: 100, 1,000, 5,000 records

**Key Features Tested**:

- Records vs indexes export/import
- Data integrity validation
- Memory impact of persistence operations
- Complex object serialization performance

### 8. Immutable Comparison (`immutable-comparison.js`)

Compares performance between immutable and mutable modes.

**Note**: This benchmark file exists but is not integrated into the main benchmark runner.

## Latest Benchmark Results

### Performance Summary (Last Updated: April 2026)

**Overall Test Results:**

- **Total Tests**: 24 tests across 6 categories
- **Total Runtime**: ~30 seconds
- **Test Environment**: Node.js v25.8.1 on Linux

**Performance Highlights:**

- **Fastest Operation**: HAS operation (494,071 ops/second on 10,000 keys)
- **Slowest Operation**: CREATE indexes (160 ops/second on 10,000 records)
- **Most Efficient**: DUMP indexes (45,891 ops/sec for 5,000 records)

### Category Performance Breakdown

#### Basic Operations

- **Tests**: 4 tests
- **Runtime**: ~2 seconds
- **Average Performance**: 131,678 ops/second
- **Key Findings**: Excellent performance for core CRUD operations

#### Search & Filter Operations

- **Tests**: 4 tests
- **Runtime**: ~2 seconds
- **Average Performance**: 9,059 ops/second
- **Key Findings**: Strong performance for indexed queries, good filter performance

#### Index Operations

- **Tests**: 3 tests
- **Runtime**: ~2 seconds
- **Average Performance**: 186 ops/second
- **Key Findings**: Efficient index creation and maintenance

#### Memory Usage

- **Tests**: Not implemented in current version
- **Runtime**: N/A
- **Average Memory**: N/A
- **Key Findings**: Memory benchmarks not available

#### Comparison with Native Structures

- **Tests**: Not implemented in current version
- **Runtime**: N/A
- **Average Performance**: N/A
- **Key Findings**: Comparison benchmarks not available

#### Pagination

- **Tests**: 4 tests
- **Runtime**: ~1 second
- **Average Performance**: 64,911 ops/second
- **Key Findings**: Efficient pagination suitable for UI requirements

#### Persistence

- **Tests**: 3 tests
- **Runtime**: ~1 second
- **Average Performance**: 20,954 ops/second
- **Key Findings**: Good performance for data serialization/deserialization

#### Immutable vs Mutable Comparison

- **Tests**: Not implemented in current version
- **Runtime**: N/A
- **Average Performance**: N/A
- **Key Findings**: Immutable comparison benchmarks not available

### Detailed Performance Results

#### Basic Operations Performance

- **SET operations**: 826 ops/sec (10,000 records)
- **GET operations**: 29,426 ops/sec (10,000 records)
- **DELETE operations**: 471 ops/sec (10,000 records)
- **HAS operations**: 494,071 ops/sec (10,000 keys)
- **CLEAR operations**: Not benchmarked
- **BATCH operations**: Not benchmarked

#### Query Operations Performance

- **FIND (indexed)**: 10,272 ops/sec (10,000 records)
- **FILTER operations**: 8,984 ops/sec (10,000 records)
- **SEARCH operations**: 8,839 ops/sec (10,000 records)
- **WHERE clauses**: 8,436 ops/sec (10,000 records)
- **SORT operations**: Not benchmarked

#### Comparison with Native Structures

- Not implemented in current benchmark suite

#### Memory Usage Analysis

- Not implemented in current benchmark suite

#### Pagination Performance

- **Small pages (10 items)**: 69,852 ops/sec (10,000 records)
- **Medium pages (50 items)**: 65,794 ops/sec (10,000 records)
- **Large pages (100 items)**: 61,308 ops/sec (10,000 records)
- **Sequential pagination**: Efficient for typical UI requirements

#### Immutable vs Mutable Performance

- Not implemented in current benchmark suite

### Performance Recommendations

Based on the latest benchmark results:

1. **✅ Basic operations perform well** - HAS is fastest at 494K ops/sec
2. **✅ Indexed queries are efficient** - FIND at 10K ops/sec for 10K records
3. **✅ Pagination is fast** - 69K ops/sec for small pages
4. **✅ Persistence is reasonable** - DUMP indexes at 45K ops/sec
5. **⚠️ Index creation is slow** - 160 ops/sec (consider one-time setup)

## Understanding Results

### Performance Metrics

- **Operations per Second**: Higher is better
- **Total Time**: Time to complete all iterations
- **Average Time**: Time per single operation
- **Memory Delta**: Memory usage change (MB)

### Performance Indicators

- **✅ Excellent**: > 100,000 ops/second
- **🟡 Good**: 10,000 - 100,000 ops/second
- **🟠 Moderate**: 1,000 - 10,000 ops/second
- **🔴 Slow**: < 1,000 ops/second

### Memory Indicators

- **✅ Efficient**: < 10 MB for typical operations
- **🟡 Moderate**: 10-50 MB
- **🟠 High**: 50-100 MB
- **🔴 Excessive**: > 100 MB

## Performance Analysis & Insights

### Key Performance Insights

Based on the latest benchmark results, here are the key insights:

#### Performance Strengths

1. **Excellent Basic Operations**: HAS achieves 494K ops/sec
2. **Fast Record Lookups**: GET at 29K ops/sec for 10K records
3. **Efficient Indexing**: FIND at 10K ops/sec for 10K records
4. **Fast Pagination**: 69K ops/sec for small pages
5. **Good Persistence**: DUMP indexes at 45K ops/sec

#### Performance Considerations

1. **Memory Overhead**: ~10x memory usage compared to native Arrays but justified by features
2. **Filter vs Find**: Array filters are ~4x faster than Haro filters, but Haro provides more features
3. **Immutable Mode Cost**: Transformation operations in immutable mode show significant performance impact
4. **Batch Operations**: Essential for bulk data manipulation at scale
5. **Complex Queries**: WHERE clauses maintain good performance even with multiple conditions

#### Scaling Characteristics

- **Small datasets (100-1K records)**: Excellent performance across all operations
- **Medium datasets (1K-10K records)**: Very good performance with minor degradation
- **Large datasets (10K-50K records)**: Good performance with more noticeable costs for complex operations
- **Memory scaling**: Linear growth with reasonable efficiency

### Performance Recommendations by Use Case

#### High-Performance Applications

- Use mutable mode for maximum performance
- Leverage indexed queries (find) over filters
- Implement batch operations for bulk changes
- Consider pagination for large result sets
- Monitor memory usage with large datasets

#### Data-Safe Applications

- Use immutable mode for data integrity
- Accept performance trade-offs for safety

- Enable versioning only when needed
- Consider persistence for backup/restore needs

#### Mixed Workloads

- Profile your specific use case
- Consider hybrid approaches (mutable for writes, immutable for reads)
- Use indexes strategically
- Implement proper pagination
- Monitor and optimize memory usage

## Advanced Usage

### Memory Profiling

For memory benchmarks, run with garbage collection enabled:

```bash
node --expose-gc benchmarks/memory-usage.js
```

### Custom Data Sizes

Modify the `dataSizes` array in each benchmark file to test different data volumes:

```javascript
// For basic operations and queries
const dataSizes = [100, 1000, 10000, 50000, 100000];

// For memory-intensive tests
const dataSizes = [100, 1000, 5000];

// For complex operations like persistence
const dataSizes = [50, 500, 2000];
```

### Performance Optimization

Based on the latest benchmark results, consider these optimizations:

1. **Use indexed queries** (`find()`) instead of filters for better performance (64K vs 46K ops/sec)
2. **Create composite indexes** for multi-field queries
3. **Use batch operations** for bulk data operations
4. **Enable versioning** only when needed (impacts performance)
5. **Consider memory limits** for large datasets (13.98MB for 50K records)
6. **Use immutable mode** strategically for data safety vs performance
7. **Implement pagination** for large result sets using `limit()` (616K ops/sec for small pages)

8. **Consider persistence** for data backup and restoration needs (114K ops/sec)
9. **Optimize WHERE queries** with proper indexing and operators

## Interpreting Results

### When to Use Haro

Haro is ideal when you need:

- **Complex queries** with multiple conditions (WHERE clauses: 60K ops/sec)
- **Indexed search** performance (FIND: 64K ops/sec)
- **Immutable data** with transformation capabilities
- **Versioning** and data history tracking
- **Advanced features** like regex search, array queries, pagination
- **Memory efficiency** is acceptable for feature richness

### When to Use Native Structures

Consider native structures when:

- **Simple key-value** operations dominate (Array filter: 189K ops/sec)
- **Memory efficiency** is critical (Array: 0.38MB vs Haro: 13.98MB for 50K records)
- **Maximum performance** for basic operations is needed
- **Minimal overhead** is required
- **No advanced querying** features needed

### Performance vs Feature Trade-offs

| Feature          | Performance Impact                     | Recommendation                             |
| ---------------- | -------------------------------------- | ------------------------------------------ |
| Indexing         | ✅ Significant improvement             | Always use for queried fields              |
| Immutable Mode   | 🟡 Mixed (read: good, transform: slow) | Use for data safety when needed            |
| Versioning       | 🟡 Moderate impact                     | Enable only when history tracking required |
| Batch Operations | ✅ Better for bulk operations          | Use for multiple changes                   |
| Pagination       | ✅ Efficient for large datasets        | Implement for UI performance               |
| Persistence      | 🟡 Good for data backup                | Use for serialization needs                |

## Contributing

To add new benchmarks:

1. Create a new benchmark file in the `benchmarks/` directory
2. Follow the existing pattern with JSDoc comments
3. Export a main function that runs the benchmarks
4. Add the benchmark to `index.js` if needed

### Benchmark Structure

```javascript
/**
 * Benchmark function description
 * @param {Array} dataSizes - Array of data sizes to test
 * @returns {Array} Array of benchmark results
 */
function benchmarkFeature(dataSizes) {
	const results = [];

	dataSizes.forEach((size) => {
		const result = benchmark("Test name", () => {
			// Test code here
		});
		results.push(result);
	});

	return results;
}
```

## System Requirements

- Node.js 16.7.0 or higher
- Minimum 4GB RAM for full benchmark suite
- Adequate disk space for test data generation

## Troubleshooting

### Common Issues

1. **Out of Memory**: Reduce data sizes or run individual benchmarks
2. **Slow Performance**: Ensure no other processes are competing for resources
3. **Inconsistent Results**: Run multiple times and average the results

### Performance Factors

Results may vary based on:

- System specifications (CPU, RAM)
- Node.js version
- Other running processes
- System load
- V8 engine optimizations

## License

This benchmark suite is part of the Haro project and follows the same license terms.
