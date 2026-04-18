# Haro

[![npm version](https://badge.fury.io/js/haro.svg)](https://badge.fury.io/js/haro)
[![Node.js Version](https://img.shields.io/node/v/haro.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![Build Status](https://github.com/avoidwork/haro/actions/workflows/ci.yml/badge.svg)](https://github.com/avoidwork/haro/actions)

A fast, flexible immutable DataStore for collections of records with indexing, versioning, and advanced querying capabilities.

## Table of Contents

- [Key Features](#key-features)
- [When to Use / When NOT to Use](#when-to-use--when-not-to-use)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Factory Function](#factory-function)
  - [Class Constructor](#class-constructor)
  - [Class Inheritance](#class-inheritance)
- [Configuration Options](#configuration-options)
- [TypeScript Support](#typescript-support)
- [Common Examples](#common-examples)
  - [Basic CRUD Operations](#basic-crud-operations)
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

- **Indexing**: Fast O(1) lookups on indexed fields with composite index support
- **Versioning**: Track history of record changes with automatic version management
- **Immutable Mode**: Return frozen objects for data safety in multi-consumer environments
- **Advanced Querying**: Support for `find()`, `where()`, `search()`, and `filter()` operations
- **Batch Operations**: Efficient bulk insert/update/delete with `setMany()` and `deleteMany()`
- **Flexible**: Works with plain objects, supports custom keys, and extensible via inheritance
- **TypeScript Ready**: Full TypeScript definitions included
- **Zero Dependencies**: Pure JavaScript with no external dependencies

## When to Use / When NOT to Use

### ✅ When to Use Haro

- **In-memory caching**: Fast indexed lookups with automatic index maintenance
- **Configuration management**: Version tracking for audit trails
- **Event tracking**: High-frequency writes with batch operation support
- **Data transformation**: Immutable mode ensures data integrity
- **Complex queries**: Need filtering, searching, and sorting capabilities
- **Real-time dashboards**: Efficient updates and queries on changing data

### ❌ When NOT to Use Haro

- **Persistent storage needed**: Haro is in-memory only (use lowdb, LokiJS, or a database)
- **Large datasets (>100k records)**: Performance degrades with very large collections
- **Simple key-value storage**: Use native `Map` or `Object` for basic needs
- **Server-side session storage**: Consider Redis or similar for distributed systems
- **Complex relational queries**: Use a proper database for joins and relationships
- **Browser storage**: Consider IndexedDB or localStorage for client-side persistence

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

## Common Examples

### Basic CRUD Operations

```javascript
import { haro } from 'haro';

const users = haro(null, { index: ['email'] });

// Create
const user = users.set(null, { 
  name: 'Alice', 
  email: 'alice@example.com' 
});

// Read
const found = users.get(user.id);
const exists = users.has(user.id);

// Update
users.set(user.id, { age: 30 });

// Delete
users.delete(user.id);

// Batch operations
users.setMany([
  { id: 1, name: 'Bob', email: 'bob@example.com' },
  { id: 2, name: 'Carol', email: 'carol@example.com' }
]);

users.deleteMany([1, 2]);
```

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
| **Bundle Size** | ~8KB | Native | Native | ~15KB | ~45KB |
| **Learning Curve** | Low | Low | Low | Low | Medium |

**Legend**: ✅ Yes | ❌ No | ⚠️ Limited/Optional

### When to Choose Each

- **Map**: Simple key-value storage, maximum performance
- **Object**: Basic data structures, JSON serialization
- **lowdb**: Persistent JSON file storage, simple queries
- **LokiJS**: Complex queries, large datasets, in-memory database needs
- **Haro**: Indexed queries, versioning, immutable data, moderate datasets

## API Reference

For complete API documentation, see [API.md](https://github.com/avoidwork/haro/blob/master/docs/API.md).

### Core Methods

#### set(key, data, batch, override)

Sets or updates a record with automatic indexing.

```javascript
const user = store.set(null, { name: 'John', age: 30 });
const updated = store.set('user123', { age: 31 });
```

#### get(key)

Retrieves a record by key.

```javascript
const user = store.get('user123');
```

#### delete(key, batch)

Deletes a record and removes it from all indexes.

```javascript
store.delete('user123');
```

#### has(key)

Checks if a record exists.

```javascript
if (store.has('user123')) {
  console.log('User exists');
}
```

#### clear()

Removes all records, indexes, and versions.

```javascript
store.clear();
```

### Query Methods

#### find(where)

Finds records matching criteria using indexes.

```javascript
const engineers = store.find({ department: 'Engineering' });
```

#### where(predicate, op)

Advanced filtering with AND/OR logic.

```javascript
const activeUsers = store.where({ 
  department: 'Engineering', 
  active: true 
}, '&&');
```

#### search(value, index)

Searches for records containing a value.

```javascript
const results = store.search(/^john/i, 'name');
```

#### filter(fn)

Filters records using a predicate function.

```javascript
const adults = store.filter(record => record.age >= 18);
```

#### sortBy(index)

Sorts records by an indexed field.

```javascript
const byAge = store.sortBy('age');
```

#### limit(offset, max)

Returns a limited subset for pagination.

```javascript
const page1 = store.limit(0, 10);
const page2 = store.limit(10, 10);
```

### Batch Operations

#### setMany(records)

Inserts or updates multiple records.

```javascript
const results = store.setMany([
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 28 }
]);
```

#### deleteMany(keys)

Deletes multiple records.

```javascript
store.deleteMany(['key1', 'key2', 'key3']);
```

### Utility Methods

#### clone(arg)

Creates a deep clone of a value.

```javascript
const cloned = store.clone({ name: 'John', tags: ['user'] });
```

#### merge(a, b, override)

Merges two values.

```javascript
const merged = store.merge({a: 1}, {b: 2});
```

#### toArray()

Converts all store data to an array.

```javascript
const allRecords = store.toArray();
```

#### dump(type)

Exports store data for persistence.

```javascript
const backup = store.dump('records');
```

#### override(data, type)

Replaces store data from backup.

```javascript
store.override(backup, 'records');
```

### Properties

#### size

Number of records in the store.

```javascript
console.log(store.size);
```

#### registry

Array of all record keys.

```javascript
console.log(store.registry);
```

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
