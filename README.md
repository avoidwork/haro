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
  - [Instant Setup - Zero Boilerplate](#instant-setup---zero-boilerplate)
  - [Indexing and Queries](#indexing-and-queries)
  - [Versioning](#versioning)
  - [Immutable Mode](#immutable-mode)
- [Comparison with Alternatives](#comparison-with-alternatives)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [Benchmarks](#benchmarks)
- [Learn More](#learn-more)
- [Community](#community)
- [License](#license)

## Key Features

- **⚡ Blazing Fast**: O(1) indexed lookups - up to 20M ops/sec for instant data access
- **📚 Built-in Versioning**: Automatic change tracking without writing audit trail code
- **🔒 Immutable Mode**: Data safety with frozen objects - prevent accidental mutations
- **🔍 Advanced Querying**: Complex queries with `find()`, `where()`, `search()` - no manual filtering
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

- **20M+ ops/sec**: Blazing fast indexed lookups for real-time applications
- **Automatic optimization**: Indexes maintained automatically on every operation
- **Batch operations**: Process 10,000 records in milliseconds
- **Memory efficient**: Optimized data structures for minimal overhead

### 🛡️ Data Safety

- **Immutable mode**: Prevent accidental mutations with frozen objects
- **Type safety**: Full TypeScript support catches errors at compile time
- **Version history**: Roll back to previous states when needed
- **Validation**: Built-in checks prevent invalid data

## Requirements

- Node.js >= 17.0.0

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
| **Bundle Size** | ~3KB gzipped | Native | Native | ~15KB | ~45KB |
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
node benchmarks/index.js --comparison-only   # vs native structures
```

### Performance Highlights

- **GET operations**: Up to 20M ops/sec with index lookups
- **Indexed FIND queries**: Up to 64,594 ops/sec (1,000 records)
- **SET operations**: Up to 3.2M ops/sec for typical workloads
- **Memory efficiency**: Highly efficient for typical workloads

See [`benchmarks/README.md`](https://github.com/avoidwork/haro/blob/master/benchmarks/README.md) for complete benchmark documentation.

## Learn More

- [API Reference](https://github.com/avoidwork/haro/blob/master/docs/API.md) - Complete API documentation
- [Contributing Guide](https://github.com/avoidwork/haro/blob/master/.github/CONTRIBUTING.md) - How to contribute
- [Benchmarks](https://github.com/avoidwork/haro/blob/master/benchmarks/README.md) - Performance analysis
- [Changelog](https://github.com/avoidwork/haro/blob/master/CHANGELOG.md) - Version history
- [Security](https://github.com/avoidwork/haro/blob/master/SECURITY.md) - Security policy
- [Discussions](https://github.com/avoidwork/haro/discussions) - Community discussions

## Community

- **GitHub Discussions**: [Join the conversation](https://github.com/avoidwork/haro/discussions)
- **Report Issues**: [GitHub Issues](https://github.com/avoidwork/haro/issues)
- **Twitter**: [@avoidwork](https://twitter.com/avoidwork)

## License

Copyright (c) 2026 Jason Mulligan  
Licensed under the BSD-3-Clause license.
