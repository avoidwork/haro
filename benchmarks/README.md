# Haro Benchmark Suite

A comprehensive performance testing suite for the Haro immutable data store library. This benchmark suite tests various aspects of Haro's performance including basic operations, search/filter capabilities, indexing, memory usage, and comparisons with native JavaScript data structures.

## Overview

The benchmark suite consists of several modules that test different aspects of Haro's performance:

- **Basic Operations** - CRUD operations (Create, Read, Update, Delete)
- **Search & Filter** - Query performance with various patterns
- **Index Operations** - Indexing performance and benefits
- **Memory Usage** - Memory consumption patterns and efficiency
- **Comparison** - Performance vs native JavaScript structures
- **Utility Operations** - Helper methods (clone, merge, freeze, forEach, uuid)
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

# Run only utility operations benchmarks
node benchmarks/index.js --utilities-only

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

# Utility operations
node benchmarks/utility-operations.js

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
- **Utility operations**: `toArray()`, `keys()`, `values()`, `entries()`

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

### 6. Utility Operations (`utility-operations.js`)

Tests performance of helper and utility methods:

- **CLONE operations**: Deep cloning of objects and arrays
- **MERGE operations**: Object and array merging with different strategies
- **FREEZE operations**: Object freezing for immutability
- **forEach operations**: Iteration with different callback complexities
- **UUID operations**: UUID generation and uniqueness testing

**Data Sizes Tested**: 100, 1,000, 5,000 records

**Key Features Tested**:
- Simple vs complex object cloning
- Array vs object merging strategies
- Performance vs safety trade-offs
- UUID generation rates and uniqueness

### 7. Pagination (`pagination.js`)

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

### 8. Persistence (`persistence.js`)

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

### 9. Immutable Comparison (`immutable-comparison.js`)

Compares performance between immutable and mutable modes:

- **STORE CREATION**: Setup performance comparison
- **CRUD operations**: Create, Read, Update, Delete in both modes
- **QUERY operations**: Find, filter, search, where performance
- **TRANSFORMATION**: Map, reduce, sort, forEach comparison
- **MEMORY usage**: Memory consumption patterns
- **DATA SAFETY**: Mutation protection analysis

**Data Sizes Tested**: 100, 1,000, 5,000 records

**Key Features Tested**:
- Performance vs safety trade-offs
- Memory overhead of immutable mode
- Operation-specific performance differences
- Data protection effectiveness

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

Based on benchmark results, consider these optimizations:

1. **Use indexed queries** (`find()`) instead of filters for better performance
2. **Create composite indexes** for multi-field queries
3. **Use batch operations** for bulk data operations
4. **Enable versioning** only when needed
5. **Consider memory limits** for large datasets
6. **Use immutable mode** for data safety in multi-consumer environments
7. **Implement pagination** for large result sets using `limit()`
8. **Use utility methods** (clone, merge, freeze) for safe data manipulation
9. **Consider persistence** for data backup and restoration needs
10. **Optimize WHERE queries** with proper indexing and operators

## Interpreting Results

### When to Use Haro

Haro is ideal when you need:
- **Complex queries** with multiple conditions
- **Indexed search** performance
- **Immutable data** with transformation capabilities
- **Versioning** and data history
- **Advanced features** like regex search, array queries

### When to Use Native Structures

Consider native structures when:
- **Simple key-value** operations dominate
- **Memory efficiency** is critical
- **Maximum performance** for basic operations is needed
- **Minimal overhead** is required

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
  
  dataSizes.forEach(size => {
    const result = benchmark('Test name', () => {
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