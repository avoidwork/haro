# Haro

[![npm version](https://badge.fury.io/js/haro.svg)](https://badge.fury.io/js/haro)
[![Node.js Version](https://img.shields.io/node/v/haro.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![Build Status](https://github.com/avoidwork/haro/actions/workflows/ci.yml/badge.svg)](https://github.com/avoidwork/haro/actions)

A fast, flexible immutable DataStore for collections of records with indexing, versioning, and advanced querying capabilities.

## Table of Contents

- [Key Features](#key-features)
- [Why Choose Haro?](#why-choose-haro)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Factory Function](#factory-function)
  - [Class Constructor](#class-constructor)
  - [Class Inheritance](#class-inheritance)
- [Configuration Options](#configuration-options)
- [TypeScript Support](#typescript-support)
- [Real-World Examples](#real-world-examples)
- [Comparison with Alternatives](#comparison-with-alternatives)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [Benchmarks](#benchmarks)
- [Learn More](#learn-more)
- [Community](#community)
- [License](#license)

## Key Features

- **⚡ Blazing Fast**: O(1) indexed lookups - up to 500K ops/sec for instant data access
- **📚 Built-in Versioning**: Automatic change tracking without writing audit trail code
- **🔒 Immutable Mode**: Data safety with frozen objects - prevent accidental mutations
- **🔍 Advanced Querying**: Complex queries with `find()`, `where()`, `search()` - no manual filtering
- **🎯 Deep Indexing**: Query nested objects with dot notation (e.g., `user.profile.department`)
- **🗄️ LRU Caching**: Built-in cache for repeated queries with automatic invalidation
- **📦 Batch Operations**: Process thousands of records in milliseconds with `setMany()`/`deleteMany()`
- **🛠️ Zero Boilerplate**: No setup required - just instantiate and query
- **📝 TypeScript Ready**: Full type definitions included - no @types packages needed
- **🎯 Zero Dependencies**: Pure JavaScript, ~8KB gzipped - nothing extra to install

## Why Choose Haro?

### ⏱️ Save Development Time

- **No more manual indexing**: Define fields once, get instant O(1) lookups automatically
- **Built-in versioning**: Track changes without writing audit trail code
- **Zero boilerplate**: No setup, configuration, or initialization code needed
- **Instant queries**: Complex filtering with one-liners instead of loops and conditionals

### 🚀 Performance Benefits

- **500K+ ops/sec**: Blazing fast indexed lookups for real-time applications
- **Automatic optimization**: Indexes maintained automatically on every operation
- **Batch operations**: Process 10,000 records in milliseconds
- **Memory efficient**: Optimized data structures for minimal overhead

### 🛡️ Data Safety

- **Immutable mode**: Prevent accidental mutations with frozen objects
- **Type safety**: Full TypeScript support catches errors at compile time
- **Version history**: Roll back to previous states when needed
- **Validation**: Built-in checks prevent invalid data

## Installation

### npm

```sh
npm install haro
```

### yarn

```sh
yarn add haro
```

### pnpm

```sh
pnpm add haro
```

## Quick Start

```javascript
import { haro } from 'haro';

const store = haro([{ id: 1, name: 'Alice' }], { index: ['name'] });
console.log(store.find({ name: 'Alice' }));
```

## Usage

### Factory Function

```javascript
import { haro } from 'haro';
const store = haro(data, config);
```

### Class Constructor

```javascript
import { Haro } from 'haro';

const store = new Haro({
  index: ['name', 'email', 'department'],
  key: 'id',
  versioning: true,
  immutable: true
});

const users = new Haro([
  { name: 'Alice', email: 'alice@company.com', department: 'Engineering' },
  { name: 'Bob', email: 'bob@company.com', department: 'Sales' }
], {
  index: ['name', 'department'],
  versioning: true
});
```

### Class Inheritance

```javascript
import { Haro } from 'haro';

class UserStore extends Haro {
  constructor(config) {
    super({
      index: ['email', 'department', 'role'],
      key: 'id',
      versioning: true,
      ...config
    });
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

const store = new UserStore();
const user = store.set(null, { 
  name: 'John', 
  email: 'john@example.com' 
});
```

## Configuration Options

### cache

**Boolean** - Enable LRU caching for `search()` and `where()` methods (default: `false`)

```javascript
const store = haro(null, { cache: true });
```

### cacheSize

**Number** - Maximum number of cached query results (default: `1000`)

```javascript
const store = haro(null, { cache: true, cacheSize: 500 });
```

### delimiter

**String** - Delimiter for composite indexes (default: `'|'`)

```javascript
const store = haro(null, { delimiter: '::' });
```

### id

**String** - Unique identifier for this store instance. Auto-generated if not provided.

```javascript
const store = haro(null, { id: 'user-cache' });
```

### immutable

**Boolean** - Return frozen/immutable objects for data safety (default: `false`)

```javascript
const store = haro(null, { immutable: true });
```

### index

**Array** - Fields to index for faster searches. Supports composite indexes.

```javascript
const store = haro(null, {
  index: ['name', 'email', 'name|department', 'department|role']
});
```

### key

**String** - Primary key field name (default: `'id'`)

```javascript
const store = haro(null, { key: 'userId' });
```

### versioning

**Boolean** - Enable version history tracking (default: `false`)

```javascript
const store = haro(null, { versioning: true });
```

## TypeScript Support

TypeScript definitions are included - no separate installation needed.

```typescript
import { Haro } from 'haro';

const store = new Haro<{ name: string; age: number }>({
  index: ['name'],
  key: 'id'
});
```

## Real-World Examples

### ⚡ Instant Setup - Zero Boilerplate

```javascript
import { haro } from 'haro';

// One line to create indexed store
const users = haro(null, { index: ['email', 'name'] });

// Add data
users.set(null, { name: 'Alice', email: 'alice@example.com' });

// Instant lookup - O(1) performance
const user = users.find({ email: 'alice@example.com' });
```

**Time saved**: No manual index creation, no caching logic, no performance tuning.

### Indexing and Queries

```javascript
import { haro } from 'haro';

const products = haro(null, {
  index: ['category', 'brand', 'price', 'category|brand']
});

products.setMany([
  { sku: '1', name: 'Laptop', category: 'Electronics', brand: 'Apple', price: 2499 },
  { sku: '2', name: 'Phone', category: 'Electronics', brand: 'Apple', price: 999 },
  { sku: '3', name: 'Headphones', category: 'Electronics', brand: 'Sony', price: 299 }
]);

// Find by indexed field
const electronics = products.find({ category: 'Electronics' });

// Complex queries
const appleProducts = products.where({ 
  category: 'Electronics', 
  brand: 'Apple' 
}, '&&');

// Search with regex
const searchResults = products.search(/^Laptop$/, 'name');

// Filter with custom logic
const affordable = products.filter(p => p.price < 500);

// Sort and paginate
const sorted = products.sortBy('price');
const page1 = products.limit(0, 10);
```

### Deep Indexing (Nested Paths)

```javascript
import { haro } from 'haro';

const users = haro(null, {
  index: ['name', 'user.email', 'user.profile.department', 'user.email|user.profile.department']
});

users.setMany([
  { 
    id: '1', 
    name: 'Alice', 
    user: { 
      email: 'alice@company.com',
      profile: { department: 'Engineering' }
    } 
  },
  { 
    id: '2', 
    name: 'Bob', 
    user: { 
      email: 'bob@company.com',
      profile: { department: 'Sales' }
    } 
  }
]);

// Find by nested field
const alice = users.find({ 'user.email': 'alice@company.com' });

// Query by deeply nested field
const engineers = users.find({ 'user.profile.department': 'Engineering' });

// Composite index with nested fields
const aliceEng = users.find({
  'user.email': 'alice@company.com',
  'user.profile.department': 'Engineering'
});

// Works with where(), search(), and sortBy()
const results = await users.where({ 'user.profile.department': 'Engineering' });
const sorted = users.sortBy('user.profile.department');
```

### Versioning

```javascript
import { haro } from 'haro';

const config = haro(null, { versioning: true });

config.set('api.timeout', { value: 30000 });
config.set('api.timeout', { value: 45000 });
config.set('api.timeout', { value: 60000 });

// Access version history
const history = config.versions.get('api.timeout');
console.log(history); // [previous versions]
```

### Immutable Mode

```javascript
import { haro } from 'haro';

const store = haro(null, { immutable: true });

const user = store.set(null, { name: 'Alice', age: 30 });

// Attempting to modify will throw
try {
  user.age = 31; // TypeError: Cannot assign to read only property
} catch (error) {
  console.error(error.message);
}
```

### Caching

```javascript
import { haro } from 'haro';

const store = haro(null, { 
  index: ['name'],
  cache: true,
  cacheSize: 1000
});

store.set("user1", { id: "user1", name: "John" });

// First call - cache miss
const results1 = await store.where({ name: "John" });

// Second call - cache hit (much faster)
const results2 = await store.where({ name: "John" });

// Get cache statistics
console.log(store.getCacheStats()); // { hits: 1, misses: 1, sets: 1, ... }

// Clear cache manually
store.clearCache();
```

## Comparison with Alternatives

| Feature | Haro | Map | Object | lowdb | LokiJS |
|---------|------|-----|--------|-------|--------|
| **Indexing** | ✅ Multi-field | ❌ | ❌ | ⚠️ Limited | ✅ |
| **Versioning** | ✅ Built-in | ❌ | ❌ | ❌ | ⚠️ Plugins |
| **Immutable Mode** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Advanced Queries** | ✅ find/where/search | ❌ | ❌ | ⚠️ Basic | ✅ |
| **Batch Operations** | ✅ setMany/deleteMany | ❌ | ❌ | ⚠️ Manual | ✅ |
| **Persistence** | ❌ In-memory | ❌ | ❌ | ✅ JSON/Local | ✅ |
| **Performance (1k records)** | ⚡ Fast | ⚡ Fastest | ⚡ Fast | 🐌 Slower | ⚡ Fast |
| **Memory Overhead** | Medium | Low | Low | Medium | High |
| **TypeScript Support** | ✅ | ✅ | ✅ | ✅ | ⚠️ Community |
| **Bundle Size** | ~6KB gzipped | Native | Native | ~8KB | ~2.6MB |
| **Learning Curve** | Low | Low | Low | Low | Medium |

**Legend**: ✅ Yes | ❌ No | ⚠️ Limited/Optional

### When to Choose Each

- **Map**: Simple key-value storage, maximum performance
- **Object**: Basic data structures, JSON serialization
- **lowdb**: Persistent JSON file storage, simple queries
- **LokiJS**: Complex queries, large datasets, in-memory database needs
- **Haro**: Indexed queries, versioning, immutable data, moderate datasets

## API Reference

For complete API documentation with all methods and examples, see [API.md](https://github.com/avoidwork/haro/blob/master/docs/API.md).

**Quick Overview:**

- **Core Methods**: `set()`, `get()`, `delete()`, `has()`, `clear()`
- **Query Methods**: `find()`, `where()`, `search()`, `filter()`, `sortBy()`, `limit()`
- **Batch Operations**: `setMany()`, `deleteMany()`
- **Utility Methods**: `clone()`, `merge()`, `toArray()`, `dump()`, `override()`
- **Properties**: `size`, `registry`

## Troubleshooting

### Common Issues

#### "Cannot read property 'length' of undefined"

**Cause**: Passing invalid data to `find()` or `where()`.

**Solution**: Ensure query objects have valid field names that exist in your index.

```javascript
// ❌ Wrong
store.find(undefined);

// ✅ Correct
store.find({ name: 'Alice' });
```

#### Performance degradation with large datasets

**Cause**: Too many indexes or complex queries on large collections.

**Solution**: 
- Limit indexes to frequently queried fields
- Use `limit()` for pagination
- Consider batch operations for bulk updates

```javascript
// Optimize indexes
const store = haro(null, { 
  index: ['name', 'email'] // Only essential fields
});

// Use pagination
const results = store.limit(0, 100);
```

#### Version history growing unbounded

**Cause**: Versioning enabled with frequent updates.

**Solution**: Clear version history periodically or disable versioning if not needed.

```javascript
// Clear specific version history
store.versions.delete('key123');

// Clear all versions
store.versions.clear();

// Disable versioning if not needed
const store = haro(null, { versioning: false });
```

#### Immutable mode causing errors

**Cause**: Attempting to modify frozen objects.

**Solution**: Use `set()` to update records instead of direct mutation.

```javascript
// ❌ Wrong
const user = store.get('user123');
user.age = 31;

// ✅ Correct
store.set('user123', { age: 31 });
```

#### Index not being used for query

**Cause**: Querying non-indexed fields.

**Solution**: Add the field to the index configuration.

```javascript
const store = haro(null, { 
  index: ['name', 'email', 'department'] 
});
```

### Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Key field validation error" | Missing key field in data | Ensure key field exists in records |
| "Index must be an array" | Invalid index configuration | Pass array to `index` option |
| "Function required" | Invalid function parameter | Pass a function to `filter()` or `map()` |
| "Invalid index name" | Sorting by non-indexed field | Add field to index or use `sort()` |

### Getting Help

- Check [API.md](https://github.com/avoidwork/haro/blob/master/docs/API.md) for complete documentation
- Review [examples](https://github.com/avoidwork/haro/blob/master/docs/API.md#examples) in API docs
- Open an issue on [GitHub](https://github.com/avoidwork/haro/issues)

## Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run coverage

# Run performance benchmarks
npm run benchmark
```

See [CONTRIBUTING.md](https://github.com/avoidwork/haro/blob/master/.github/CONTRIBUTING.md) for detailed testing guidelines.

## Benchmarks

Haro includes comprehensive benchmark suites for performance analysis.

### Running Benchmarks

```bash
# Run all benchmarks
node benchmarks/index.js

# Run specific categories
node benchmarks/index.js --basic-only        # CRUD operations
node benchmarks/index.js --search-only       # Query operations
node benchmarks/index.js --index-only        # Index operations
node benchmarks/index.js --utilities-only    # Utility operations
node benchmarks/index.js --pagination-only   # Pagination benchmarks
node benchmarks/index.js --persistence-only  # Persistence benchmarks
node benchmarks/index.js --core-only         # Core benchmarks (basic, search, index)
node benchmarks/index.js --quiet             # Minimal output
```

### Performance Overview

Haro provides excellent performance for in-memory data operations:

- **Indexed lookups**: O(1) performance for find() operations
- **Batch operations**: Efficient bulk data processing
- **Memory efficiency**: Optimized data structures
- **Scalability**: Consistent performance across different data sizes

### Benchmark Results (5-run average)

| Operation | Latency (avg) | Throughput (ops/s) |
|-----------|---------------|-------------------|
| **Basic Operations** |
| set() 10000 records | 1507 ms | 747 ops/s |
| get() 10000 records | 35 ms | 29015 ops/s |
| has() 10000 keys | 2 ms | 495325 ops/s |
| delete() 10000 records | 2353 ms | 432 ops/s |
| **Search & Filter** |
| find() by indexed field 10000 records | 98 ms | 10299 ops/s |
| where() by indexed field 10000 records | 222 ms | 4516 ops/s |
| search() in index 10000 records | 116 ms | 8716 ops/s |
| filter() all records 10000 records | 115 ms | 8822 ops/s |
| **Index Operations** |
| haro() with indexes 10000 records | 10842 ms | 94 ops/s |
| find() with index 10000 records | 3996 ms | 267 ops/s |
| reindex() single field 10000 records | 5739 ms | 182 ops/s |
| **Utility Operations** |
| toArray() 1000 iterations | 21 ms | 47750 ops/s |
| entries() 1000 iterations | 92 ms | 10986 ops/s |
| keys() 1000 iterations | 17 ms | 59043 ops/s |
| values() 1000 iterations | 17 ms | 60553 ops/s |
| **Pagination** |
| limit() 10 10000 records | 15 ms | 69050 ops/s |
| limit() 50 10000 records | 16 ms | 65516 ops/s |
| limit() 100 10000 records | 17 ms | 61172 ops/s |
| limit() with offset 10000 records | 16 ms | 65522 ops/s |
| **Persistence** |
| dump() records 5000 records | 75 ms | 13583 ops/s |

See [`benchmarks/README.md`](https://github.com/avoidwork/haro/blob/master/benchmarks/README.md) for complete benchmark documentation and detailed results.

## Learn More

- [API Reference](https://github.com/avoidwork/haro/blob/master/docs/API.md) - Complete API documentation
- [Contributing Guide](https://github.com/avoidwork/haro/blob/master/.github/CONTRIBUTING.md) - How to contribute
- [Benchmarks](https://github.com/avoidwork/haro/blob/master/benchmarks/README.md) - Performance analysis
- [Changelog](https://github.com/avoidwork/haro/blob/master/CHANGELOG.md) - Version history
- [Security](https://github.com/avoidwork/haro/blob/master/SECURITY.md) - Security policy

## Community

- **Report Issues**: [GitHub Issues](https://github.com/avoidwork/haro/issues)

## License

Copyright (c) 2026 Jason Mulligan  
Licensed under the BSD-3-Clause license.
