# Haro

[![npm version](https://badge.fury.io/js/haro.svg)](https://badge.fury.io/js/haro)
[![Node.js Version](https://img.shields.io/node/v/haro.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![Build Status](https://github.com/avoidwork/haro/actions/workflows/ci.yml/badge.svg)](https://github.com/avoidwork/haro/actions)

A fast, flexible immutable DataStore for collections of records with indexing, versioning, and advanced querying capabilities. Provides a Map-like interface with powerful search and filtering features.

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

## Usage

### Factory Function

```javascript
import { haro } from 'haro';
const store = haro(data, config);
```

### Class Constructor

```javascript
import { Haro } from 'haro';

// Create a store with indexes and versioning
const store = new Haro({
  index: ['name', 'email', 'department'],
  key: 'id',
  versioning: true,
  immutable: true
});

// Create store with initial data
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

  beforeSet(key, data, batch, override) {
    // Validate email format
    if (data.email && !this.isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }
  }

  onset(record, batch) {
    console.log(`User ${record.name} was added/updated`);
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

## Parameters

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
**Array** - Fields to index for faster searches. Supports composite indexes using delimiter.

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
**Boolean** - Enable MVCC-style versioning to track record changes (default: `false`)

```javascript
const store = haro(null, { versioning: true });
```

### Parameter Validation

The constructor validates configuration and provides helpful error messages:

```javascript
// Invalid index configuration will provide clear feedback
try {
  const store = new Haro({ index: 'name' }); // Should be array
} catch (error) {
  console.error(error.message); // Clear validation error
}

// Missing required configuration
try {
  const store = haro([{id: 1}], { key: 'nonexistent' });
} catch (error) {
  console.error('Key field validation error');
}
```

## Interoperability

### Array Methods Compatibility

Haro provides Array-like methods for familiar data manipulation:

```javascript
import { haro } from 'haro';

const store = haro([
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: 3, name: 'Charlie', age: 35 }
]);

// Use familiar Array methods
const adults = store.filter(record => record.age >= 30);
const names = store.map(record => record.name);
const totalAge = store.reduce((sum, record) => sum + record.age, 0);

store.forEach((record, key) => {
  console.log(`${key}: ${record.name} (${record.age})`);
});
```

### Event-Driven Architecture

Compatible with event-driven patterns through lifecycle hooks:

```javascript
class EventedStore extends Haro {
  constructor(eventEmitter, config) {
    super(config);
    this.events = eventEmitter;
  }

  onset(record, batch) {
    this.events.emit('record:created', record);
  }

  ondelete(key, batch) {
    this.events.emit('record:deleted', key);
  }
}
```

## Testing

Haro maintains comprehensive test coverage across all features with **148 passing tests**:

```
--------------|---------|----------|---------|---------|-------------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s       
--------------|---------|----------|---------|---------|-------------------------
All files     |     100 |    96.95 |     100 |     100 |                         
 constants.js |     100 |      100 |     100 |     100 |                         
 haro.js      |     100 |    96.94 |     100 |     100 | 205-208,667,678,972-976 
--------------|---------|----------|---------|---------|-------------------------
```

### Test Organization

The test suite is organized into focused areas:

- **Basic CRUD Operations** - Core data manipulation (set, get, delete, clear)
- **Indexing** - Index creation, composite indexes, and reindexing
- **Searching & Filtering** - find(), where(), search(), filter(), and sortBy() methods
- **Immutable Mode** - Data freezing and immutability guarantees
- **Versioning** - MVCC-style record versioning
- **Lifecycle Hooks** - beforeSet, onset, ondelete, etc.
- **Utility Methods** - clone(), merge(), limit(), map(), reduce(), etc.
- **Error Handling** - Validation and error scenarios
- **Factory Function** - haro() factory with various initialization patterns

### Running Tests

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run performance benchmarks
npm run benchmark
```

## Benchmarks

Haro includes comprehensive benchmark suites for performance analysis and comparison with other data store solutions.

### Latest Performance Results

**Overall Performance Summary:**
- **Total Tests**: 572 tests across 9 categories
- **Total Runtime**: 1.6 minutes
- **Best Performance**: HAS operation (20,815,120 ops/second on 1,000 records)
- **Memory Efficiency**: Highly efficient with minimal overhead for typical workloads

### Benchmark Categories

#### Basic Operations
- **SET operations**: Record creation, updates, overwrites
- **GET operations**: Single record retrieval, cache hits/misses
- **DELETE operations**: Record removal and index cleanup
- **BATCH operations**: Bulk insert/update/delete performance

**Performance Highlights:**
- SET operations: Up to 3.2M ops/sec for typical workloads
- GET operations: Up to 20M ops/sec with index lookups
- DELETE operations: Efficient cleanup with index maintenance
- BATCH operations: Optimized for bulk data manipulation

#### Search & Query Operations
- **INDEX queries**: Using find() with indexed fields
- **FILTER operations**: Predicate-based filtering
- **SEARCH operations**: Text and regex searching
- **WHERE clauses**: Complex query conditions

**Performance Highlights:**
- Indexed FIND queries: Up to 64,594 ops/sec (1,000 records)
- FILTER operations: Up to 46,255 ops/sec
- Complex queries: Maintains good performance with multiple conditions
- Memory-efficient query processing

#### Advanced Features
- **VERSION tracking**: Performance impact of versioning
- **IMMUTABLE mode**: Object freezing overhead
- **COMPOSITE indexes**: Multi-field index performance
- **Memory usage**: Efficient memory consumption patterns
- **Utility operations**: clone, merge, freeze, forEach performance
- **Pagination**: Limit-based result pagination
- **Persistence**: Data dump/restore operations

### Running Benchmarks

```bash
# Run all benchmarks
node benchmarks/index.js

# Run specific benchmark categories
node benchmarks/index.js --basic-only        # Basic CRUD operations
node benchmarks/index.js --search-only       # Search and query operations
node benchmarks/index.js --index-only        # Index operations
node benchmarks/index.js --memory-only       # Memory usage analysis
node benchmarks/index.js --comparison-only   # vs native structures
node benchmarks/index.js --utilities-only    # Utility operations
node benchmarks/index.js --pagination-only   # Pagination performance
node benchmarks/index.js --persistence-only  # Persistence operations
node benchmarks/index.js --immutable-only    # Immutable vs mutable

# Run with memory analysis
node --expose-gc benchmarks/memory-usage.js
```

### Performance Comparison with Native Structures

**Storage Operations:**
- Haro vs Map: Comparable performance for basic operations
- Haro vs Array: Slower for simple operations, faster for complex queries
- Haro vs Object: Trade-off between features and raw performance

**Query Operations:**
- Haro FIND (indexed): 64,594 ops/sec vs Array filter: 189,293 ops/sec
- Haro provides advanced query capabilities not available in native structures
- Memory overhead justified by feature richness

### Memory Efficiency

**Memory Usage Comparison (50,000 records):**
- Haro: 13.98 MB
- Map: 3.52 MB
- Object: 1.27 MB
- Array: 0.38 MB

**Memory Analysis:**
- Reasonable overhead for feature set provided
- Efficient index storage and maintenance
- Garbage collection friendly

### Performance Tips

For optimal performance:

1. **Use indexes wisely** - Index fields you'll query frequently
2. **Choose appropriate key strategy** - Shorter keys perform better
3. **Batch operations** - Use batch() for multiple changes
4. **Consider immutable mode cost** - Only enable if needed for data safety
5. **Minimize version history** - Disable versioning if not required
6. **Use pagination** - Implement limit() for large result sets
7. **Leverage utility methods** - Use built-in clone, merge, freeze for safety

### Performance Indicators

* ✅ **Indexed queries** significantly outperform filters (64k vs 46k ops/sec)
* ✅ **Batch operations** provide excellent bulk performance
* ✅ **Get operations** consistently outperform set operations
* ✅ **Memory usage** remains stable under load
* ✅ **Utility operations** perform well (clone: 1.6M ops/sec)

### Immutable vs Mutable Mode

**Performance Impact:**
- Creation: Minimal difference (1.27x faster mutable)
- Read operations: Comparable performance
- Write operations: Slight advantage to mutable mode
- Transformation operations: Significant performance cost in immutable mode

**Recommendations:**
- Use immutable mode for data safety in multi-consumer environments
- Use mutable mode for high-frequency write operations
- Consider the trade-off between safety and performance

See `benchmarks/README.md` for complete documentation and advanced usage.

## API Reference

### Properties

#### data
`{Map}` - Internal Map of records, indexed by key

```javascript
const store = haro();
console.log(store.data.size); // 0
```

#### delimiter
`{String}` - The delimiter used for composite indexes

```javascript
const store = haro(null, { delimiter: '|' });
console.log(store.delimiter); // '|'
```

#### id
`{String}` - Unique identifier for this store instance

```javascript
const store = haro(null, { id: 'my-store' });
console.log(store.id); // 'my-store'
```

#### immutable
`{Boolean}` - Whether the store returns immutable objects

```javascript
const store = haro(null, { immutable: true });
console.log(store.immutable); // true
```

#### index
`{Array}` - Array of indexed field names

```javascript
const store = haro(null, { index: ['name', 'email'] });
console.log(store.index); // ['name', 'email']
```

#### indexes
`{Map}` - Map of indexes containing Sets of record keys

```javascript
const store = haro();
console.log(store.indexes); // Map(0) {}
```

#### key
`{String}` - The primary key field name

```javascript
const store = haro(null, { key: 'userId' });
console.log(store.key); // 'userId'
```

#### registry
`{Array}` - Array of all record keys (read-only property)

```javascript
const store = haro();
store.set('key1', { name: 'Alice' });
console.log(store.registry); // ['key1']
```

#### size
`{Number}` - Number of records in the store (read-only property)

```javascript
const store = haro();
console.log(store.size); // 0
```

#### versions
`{Map}` - Map of version history (when versioning is enabled)

```javascript
const store = haro(null, { versioning: true });
console.log(store.versions); // Map(0) {}
```

#### versioning
`{Boolean}` - Whether versioning is enabled

```javascript
const store = haro(null, { versioning: true });
console.log(store.versioning); // true
```

### Methods

#### batch(array, type)

Performs batch operations on multiple records for efficient bulk processing.

**Parameters:**
- `array` `{Array}` - Array of records to process
- `type` `{String}` - Operation type: `'set'` or `'del'` (default: `'set'`)

**Returns:** `{Array}` Array of results from the batch operation

```javascript
const results = store.batch([
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 28 }
], 'set');

// Delete multiple records
store.batch(['key1', 'key2'], 'del');
```

**See also:** set(), delete()

#### clear()

Removes all records, indexes, and versions from the store.

**Returns:** `{Haro}` Store instance for chaining

```javascript
store.clear();
console.log(store.size); // 0
```

**See also:** delete()

#### clone(arg)

Creates a deep clone of the given value, handling objects, arrays, and primitives.

**Parameters:**
- `arg` `{*}` - Value to clone (any type)

**Returns:** `{*}` Deep clone of the argument

```javascript
const original = { name: 'John', tags: ['user', 'admin'] };
const cloned = store.clone(original);
cloned.tags.push('new'); // original.tags is unchanged
```

#### delete(key, batch)

Deletes a record from the store and removes it from all indexes.

**Parameters:**
- `key` `{String}` - Key of record to delete
- `batch` `{Boolean}` - Whether this is part of a batch operation (default: `false`)

**Returns:** `{undefined}`

**Throws:** `{Error}` If record with the specified key is not found

```javascript
store.delete('user123');
```

**See also:** has(), clear(), batch()

#### dump(type)

Exports complete store data or indexes for persistence or debugging.

**Parameters:**
- `type` `{String}` - Type of data to export: `'records'` or `'indexes'` (default: `'records'`)

**Returns:** `{Array}` Array of [key, value] pairs or serialized index structure

```javascript
const records = store.dump('records');
const indexes = store.dump('indexes');
// Use for persistence or backup
fs.writeFileSync('backup.json', JSON.stringify(records));
```

**See also:** override()

#### each(array, fn)

Utility method to iterate over an array with a callback function.

**Parameters:**
- `array` `{Array}` - Array to iterate over
- `fn` `{Function}` - Function to call for each element

**Returns:** `{Array}` The original array for method chaining

```javascript
store.each([1, 2, 3], (item, index) => {
  console.log(`Item ${index}: ${item}`);
});
```

#### entries()

Returns an iterator of [key, value] pairs for each record in the store.

**Returns:** `{Iterator}` Iterator of [key, value] pairs

```javascript
for (const [key, value] of store.entries()) {
  console.log(`${key}:`, value);
}
```

**See also:** keys(), values()

#### filter(fn, raw)

Filters records using a predicate function, similar to Array.filter.

**Parameters:**
- `fn` `{Function}` - Predicate function to test each record
- `raw` `{Boolean}` - Whether to return raw data (default: `false`)

**Returns:** `{Array}` Array of records that pass the predicate test

**Throws:** `{Error}` If fn is not a function

```javascript
const adults = store.filter(record => record.age >= 18);
const recentUsers = store.filter(record => 
  record.created > Date.now() - 86400000
);
```

**See also:** find(), where(), map()

#### find(where, raw)

Finds records matching the specified criteria using indexes for optimal performance.

**Parameters:**
- `where` `{Object}` - Object with field-value pairs to match
- `raw` `{Boolean}` - Whether to return raw data (default: `false`)

**Returns:** `{Array}` Array of matching records

```javascript
const engineers = store.find({ department: 'Engineering' });
const activeUsers = store.find({ status: 'active', role: 'user' });
```

**See also:** where(), search(), filter()

#### forEach(fn, ctx)

Executes a function for each record in the store, similar to Array.forEach.

**Parameters:**
- `fn` `{Function}` - Function to execute for each record
- `ctx` `{*}` - Context object to use as 'this' (default: store instance)

**Returns:** `{Haro}` Store instance for chaining

```javascript
store.forEach((record, key) => {
  console.log(`${key}: ${record.name}`);
});
```

**See also:** map(), filter()

#### freeze(...args)

Creates a frozen array from the given arguments for immutable data handling.

**Parameters:**
- `...args` `{*}` - Arguments to freeze into an array

**Returns:** `{Array}` Frozen array containing frozen arguments

```javascript
const frozen = store.freeze(obj1, obj2, obj3);
// Returns Object.freeze([Object.freeze(obj1), ...])
```

#### get(key, raw)

Retrieves a record by its key.

**Parameters:**
- `key` `{String}` - Key of record to retrieve
- `raw` `{Boolean}` - Whether to return raw data (default: `false`)

**Returns:** `{Object|null}` The record if found, null if not found

```javascript
const user = store.get('user123');
const rawUser = store.get('user123', true);
```

**See also:** has(), set()

#### has(key)

Checks if a record with the specified key exists in the store.

**Parameters:**
- `key` `{String}` - Key to check for existence

**Returns:** `{Boolean}` True if record exists, false otherwise

```javascript
if (store.has('user123')) {
  console.log('User exists');
}
```

**See also:** get(), delete()

#### keys()

Returns an iterator of all keys in the store.

**Returns:** `{Iterator}` Iterator of record keys

```javascript
for (const key of store.keys()) {
  console.log('Key:', key);
}
```

**See also:** values(), entries()

#### limit(offset, max, raw)

Returns a limited subset of records with offset support for pagination.

**Parameters:**
- `offset` `{Number}` - Number of records to skip (default: `0`)
- `max` `{Number}` - Maximum number of records to return (default: `0`)
- `raw` `{Boolean}` - Whether to return raw data (default: `false`)

**Returns:** `{Array}` Array of records within the specified range

```javascript
const page1 = store.limit(0, 10);   // First 10 records
const page2 = store.limit(10, 10);  // Next 10 records
const page3 = store.limit(20, 10);  // Records 21-30
```

**See also:** toArray(), sort()

#### map(fn, raw)

Transforms all records using a mapping function, similar to Array.map.

**Parameters:**
- `fn` `{Function}` - Function to transform each record
- `raw` `{Boolean}` - Whether to return raw data (default: `false`)

**Returns:** `{Array}` Array of transformed results

**Throws:** `{Error}` If fn is not a function

```javascript
const names = store.map(record => record.name);
const summaries = store.map(record => ({
  id: record.id,
  name: record.name,
  email: record.email
}));
```

**See also:** filter(), forEach()

#### merge(a, b, override)

Merges two values together with support for arrays and objects.

**Parameters:**
- `a` `{*}` - First value (target)
- `b` `{*}` - Second value (source)
- `override` `{Boolean}` - Whether to override arrays instead of concatenating (default: `false`)

**Returns:** `{*}` Merged result

```javascript
const merged = store.merge({a: 1}, {b: 2}); // {a: 1, b: 2}
const arrays = store.merge([1, 2], [3, 4]); // [1, 2, 3, 4]
const overridden = store.merge([1, 2], [3, 4], true); // [3, 4]
```

#### override(data, type)

Replaces all store data or indexes with new data for bulk operations.

**Parameters:**
- `data` `{Array}` - Data to replace with
- `type` `{String}` - Type of data: `'records'` or `'indexes'` (default: `'records'`)

**Returns:** `{Boolean}` True if operation succeeded

**Throws:** `{Error}` If type is invalid

```javascript
const backup = store.dump('records');
// Later restore from backup
store.override(backup, 'records');
```

**See also:** dump(), clear()

#### reduce(fn, accumulator)

Reduces all records to a single value using a reducer function.

**Parameters:**
- `fn` `{Function}` - Reducer function (accumulator, value, key, store)
- `accumulator` `{*}` - Initial accumulator value (default: `[]`)

**Returns:** `{*}` Final reduced value

```javascript
const totalAge = store.reduce((sum, record) => sum + record.age, 0);
const emailList = store.reduce((emails, record) => {
  emails.push(record.email);
  return emails;
}, []);
```

**See also:** map(), filter()

#### reindex(index)

Rebuilds indexes for specified fields or all fields for data consistency.

**Parameters:**
- `index` `{String|Array}` - Specific index field(s) to rebuild (optional)

**Returns:** `{Haro}` Store instance for chaining

```javascript
store.reindex(); // Rebuild all indexes
store.reindex('name'); // Rebuild only name index
store.reindex(['name', 'email']); // Rebuild specific indexes
```

#### search(value, index, raw)

Searches for records containing a value across specified indexes.

**Parameters:**
- `value` `{Function|RegExp|*}` - Value to search for
- `index` `{String|Array}` - Index(es) to search in (optional)
- `raw` `{Boolean}` - Whether to return raw data (default: `false`)

**Returns:** `{Array}` Array of matching records

```javascript
// Function search
const results = store.search(key => key.includes('admin'));

// Regex search on specific index
const nameResults = store.search(/^john/i, 'name');

// Value search across all indexes
const emailResults = store.search('gmail.com', 'email');
```

**See also:** find(), where(), filter()

#### set(key, data, batch, override)

Sets or updates a record in the store with automatic indexing.

**Parameters:**
- `key` `{String|null}` - Key for the record, or null to use record's key field
- `data` `{Object}` - Record data to set (default: `{}`)
- `batch` `{Boolean}` - Whether this is part of a batch operation (default: `false`)
- `override` `{Boolean}` - Whether to override existing data instead of merging (default: `false`)

**Returns:** `{Object}` The stored record

```javascript
// Auto-generate key
const user = store.set(null, { name: 'John', age: 30 });

// Update existing record (merges by default)
const updated = store.set('user123', { age: 31 });

// Replace existing record completely
const replaced = store.set('user123', { name: 'Jane' }, false, true);
```

**See also:** get(), batch(), merge()

#### sort(fn, frozen)

Sorts all records using a comparator function.

**Parameters:**
- `fn` `{Function}` - Comparator function for sorting (a, b) => number
- `frozen` `{Boolean}` - Whether to return frozen records (default: `false`)

**Returns:** `{Array}` Sorted array of records

```javascript
const byAge = store.sort((a, b) => a.age - b.age);
const byName = store.sort((a, b) => a.name.localeCompare(b.name));
const frozen = store.sort((a, b) => a.created - b.created, true);
```

**See also:** sortBy(), limit()

#### sortBy(index, raw)

Sorts records by a specific indexed field in ascending order.

**Parameters:**
- `index` `{String}` - Index field name to sort by
- `raw` `{Boolean}` - Whether to return raw data (default: `false`)

**Returns:** `{Array}` Array of records sorted by the specified field

**Throws:** `{Error}` If index field is empty or invalid

```javascript
const byAge = store.sortBy('age');
const byName = store.sortBy('name');
const rawByDate = store.sortBy('created', true);
```

**See also:** sort(), find()

#### toArray()

Converts all store data to a plain array of records.

**Returns:** `{Array}` Array containing all records in the store

```javascript
const allRecords = store.toArray();
console.log(`Store contains ${allRecords.length} records`);
```

**See also:** limit(), sort()

#### uuid()

Generates a RFC4122 v4 UUID for record identification.

**Returns:** `{String}` UUID string in standard format

```javascript
const id = store.uuid(); // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

#### values()

Returns an iterator of all values in the store.

**Returns:** `{Iterator}` Iterator of record values

```javascript
for (const record of store.values()) {
  console.log(record.name);
}
```

**See also:** keys(), entries()

#### where(predicate, op)

Advanced filtering with predicate logic supporting AND/OR operations on arrays.

**Parameters:**
- `predicate` `{Object}` - Object with field-value pairs for filtering
- `op` `{String}` - Operator for array matching: `'||'` for OR, `'&&'` for AND (default: `'||'`)

**Returns:** `{Array}` Array of records matching the predicate criteria

```javascript
// Find records with tags containing 'admin' OR 'user'
const users = store.where({ tags: ['admin', 'user'] }, '||');

// Find records with ALL specified tags
const powerUsers = store.where({ tags: ['admin', 'power'] }, '&&');

// Regex matching
const companyEmails = store.where({ email: /^[^@]+@company\.com$/ });

// Array field matching
const multiDeptUsers = store.where({ departments: ['IT', 'HR'] });
```

**See also:** find(), filter(), search()

## Lifecycle Hooks

Override these methods in subclasses for custom behavior:

### beforeBatch(args, type)
Executed before batch operations for preprocessing.

### beforeClear()
Executed before clear operation for cleanup preparation.

### beforeDelete(key, batch)
Executed before delete operation for validation or logging.

### beforeSet(key, data, batch, override)
Executed before set operation for data validation or transformation.

### onbatch(results, type)
Executed after batch operations for postprocessing.

### onclear()
Executed after clear operation for cleanup tasks.

### ondelete(key, batch)
Executed after delete operation for logging or notifications.

### onset(record, batch)
Executed after set operation for indexing or event emission.

## Examples

### User Management System

```javascript
import { haro } from 'haro';

const users = haro(null, {
  index: ['email', 'department', 'role', 'department|role'],
  key: 'id',
  versioning: true,
  immutable: true
});

// Add users with batch operation
users.batch([
  { 
    id: 'u1', 
    email: 'alice@company.com', 
    name: 'Alice Johnson',
    department: 'Engineering',
    role: 'Senior Developer',
    active: true
  },
  { 
    id: 'u2', 
    email: 'bob@company.com', 
    name: 'Bob Smith',
    department: 'Engineering', 
    role: 'Team Lead',
    active: true
  },
  { 
    id: 'u3', 
    email: 'carol@company.com', 
    name: 'Carol Davis',
    department: 'Marketing',
    role: 'Manager',
    active: false
  }
], 'set');

// Find by department
const engineers = users.find({ department: 'Engineering' });

// Complex queries with where()
const activeEngineers = users.where({ 
  department: 'Engineering', 
  active: true 
}, '&&');

// Search across multiple fields
const managers = users.search(/manager|lead/i, ['role']);

// Pagination for large datasets
const page1 = users.limit(0, 10);
const page2 = users.limit(10, 10);

// Update user with version tracking
const updated = users.set('u1', { role: 'Principal Developer' });
console.log(users.versions.get('u1')); // Previous versions
```

### E-commerce Product Catalog

```javascript
import { Haro } from 'haro';

class ProductCatalog extends Haro {
  constructor() {
    super({
      index: ['category', 'brand', 'price', 'tags', 'category|brand'],
      key: 'sku',
      versioning: true
    });
  }

  beforeSet(key, data, batch, override) {
    // Validate required fields
    if (!data.name || !data.price || !data.category) {
      throw new Error('Missing required product fields');
    }
    
    // Normalize price
    if (typeof data.price === 'string') {
      data.price = parseFloat(data.price);
    }
    
    // Auto-generate SKU if not provided
    if (!data.sku && !key) {
      data.sku = this.generateSKU(data);
    }
  }

  onset(record, batch) {
    console.log(`Product ${record.name} (${record.sku}) updated`);
  }

  generateSKU(product) {
    const prefix = product.category.substring(0, 3).toUpperCase();
    const suffix = Date.now().toString().slice(-6);
    return `${prefix}-${suffix}`;
  }

  // Custom business methods
  findByPriceRange(min, max) {
    return this.filter(product => 
      product.price >= min && product.price <= max
    );
  }

  searchProducts(query) {
    // Search across multiple fields
    const lowerQuery = query.toLowerCase();
    return this.filter(product =>
      product.name.toLowerCase().includes(lowerQuery) ||
      product.description.toLowerCase().includes(lowerQuery) ||
      product.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getRecommendations(sku, limit = 5) {
    const product = this.get(sku);
    if (!product) return [];

    // Find similar products by category and brand
    return this.find({ 
      category: product.category,
      brand: product.brand 
    })
    .filter(p => p.sku !== sku)
    .slice(0, limit);
  }
}

const catalog = new ProductCatalog();

// Add products
catalog.batch([
  {
    sku: 'LAP-001',
    name: 'MacBook Pro 16"',
    category: 'Laptops',
    brand: 'Apple',
    price: 2499.99,
    tags: ['professional', 'high-performance', 'creative'],
    description: 'Powerful laptop for professionals'
  },
  {
    sku: 'LAP-002', 
    name: 'ThinkPad X1 Carbon',
    category: 'Laptops',
    brand: 'Lenovo',
    price: 1899.99,
    tags: ['business', 'lightweight', 'durable'],
    description: 'Business laptop with excellent build quality'
  }
], 'set');

// Business queries
const laptops = catalog.find({ category: 'Laptops' });
const affordable = catalog.findByPriceRange(1000, 2000);
const searchResults = catalog.searchProducts('professional');
const recommendations = catalog.getRecommendations('LAP-001');
```

### Real-time Analytics Dashboard

```javascript
import { haro } from 'haro';

// Event tracking store
const events = haro(null, {
  index: ['type', 'userId', 'timestamp', 'type|userId'],
  key: 'id',
  immutable: false // Allow mutations for performance
});

// Session tracking store  
const sessions = haro(null, {
  index: ['userId', 'status', 'lastActivity'],
  key: 'sessionId',
  versioning: true
});

// Analytics functions
function trackEvent(type, userId, data = {}) {
  return events.set(null, {
    id: events.uuid(),
    type,
    userId,
    timestamp: Date.now(),
    data,
    ...data
  });
}

function getActiveUsers(minutes = 5) {
  const threshold = Date.now() - (minutes * 60 * 1000);
  return sessions.filter(session => 
    session.status === 'active' && 
    session.lastActivity > threshold
  );
}

function getUserActivity(userId, hours = 24) {
  const since = Date.now() - (hours * 60 * 60 * 1000);
  return events.find({ userId })
    .filter(event => event.timestamp > since)
    .sort((a, b) => b.timestamp - a.timestamp);
}

function getEventStats(timeframe = 'hour') {
  const now = Date.now();
  const intervals = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000
  };
  
  const since = now - intervals[timeframe];
  const recentEvents = events.filter(event => event.timestamp > since);
  
  return recentEvents.reduce((stats, event) => {
    stats[event.type] = (stats[event.type] || 0) + 1;
    return stats;
  }, {});
}

// Usage
trackEvent('page_view', 'user123', { page: '/dashboard' });
trackEvent('click', 'user123', { element: 'nav-menu' });
trackEvent('search', 'user456', { query: 'analytics' });

console.log('Active users:', getActiveUsers().length);
console.log('User activity:', getUserActivity('user123'));
console.log('Event stats:', getEventStats('hour'));
```

### Configuration Management

```javascript
import { Haro } from 'haro';

class ConfigStore extends Haro {
  constructor() {
    super({
      index: ['environment', 'service', 'type', 'environment|service'],
      key: 'key',
      versioning: true,
      immutable: true
    });
    
    this.loadDefaults();
  }

  loadDefaults() {
    this.batch([
      { key: 'db.host', value: 'localhost', environment: 'dev', type: 'database' },
      { key: 'db.port', value: 5432, environment: 'dev', type: 'database' },
      { key: 'api.timeout', value: 30000, environment: 'dev', type: 'api' },
      { key: 'db.host', value: 'prod-db.example.com', environment: 'prod', type: 'database' },
      { key: 'db.port', value: 5432, environment: 'prod', type: 'database' },
      { key: 'api.timeout', value: 10000, environment: 'prod', type: 'api' }
    ], 'set');
  }

  getConfig(key, environment = 'dev') {
    const configs = this.find({ key, environment });
    return configs.length > 0 ? configs[0].value : null;
  }

  getEnvironmentConfig(environment) {
    return this.find({ environment }).reduce((config, item) => {
      config[item.key] = item.value;
      return config;
    }, {});
  }

  updateConfig(key, value, environment = 'dev') {
    const existing = this.find({ key, environment })[0];
    if (existing) {
      return this.set(key, { ...existing, value });
    } else {
      return this.set(key, { key, value, environment, type: 'custom' });
    }
  }

  getDatabaseConfig(environment = 'dev') {
    return this.find({ environment, type: 'database' });
  }
}

const config = new ConfigStore();

// Get specific config
console.log(config.getConfig('db.host', 'prod')); // 'prod-db.example.com'

// Get all configs for environment
const devConfig = config.getEnvironmentConfig('dev');

// Update configuration
config.updateConfig('api.timeout', 45000, 'dev');

// Get configuration history
console.log(config.versions.get('api.timeout'));
```

## Performance

Haro is optimized for:
- **Fast indexing**: O(1) lookups on indexed fields
- **Efficient searches**: Regex and function-based filtering with index acceleration  
- **Memory efficiency**: Minimal overhead with optional immutability
- **Batch operations**: Optimized bulk inserts and updates
- **Version tracking**: Efficient MVCC-style versioning when enabled

### Performance Characteristics

| Operation | Indexed | Non-Indexed | Notes |
|-----------|---------|-------------|-------|
| `find()` | O(1) | O(n) | Use indexes for best performance |
| `get()` | O(1) | O(1) | Direct key lookup |
| `set()` | O(1) | O(1) | Includes index updates |
| `delete()` | O(1) | O(1) | Includes index cleanup |
| `filter()` | O(n) | O(n) | Full scan with predicate |
| `search()` | O(k) | O(n) | k = matching index entries |

## License

Copyright (c) 2025 Jason Mulligan  
Licensed under the BSD-3-Clause license.
