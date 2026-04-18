# Haro API Reference

## Overview

Haro is a modern immutable DataStore for collections of records with indexing, versioning, and batch operations support. It provides a Map-like interface with advanced querying capabilities through indexes.

## Table of Contents

- [Haro Class](#haro-class)
  - [Constructor](#constructorconfig)
  - [Properties](#properties)
- [Core Methods](#core-methods)
  - [set()](#setkey-data-batch-override)
  - [get()](#getkey)
  - [delete()](#deletekey-batch)
  - [has()](#haskey)
  - [clear()](#clear)
- [Query Methods](#query-methods)
  - [find()](#findwhere)
  - [where()](#wherepredicate-op)
  - [search()](#searchvalue-index)
  - [filter()](#filterfn)
  - [sortBy()](#sortbyindex)
  - [sort()](#sortfn-frozen)
  - [limit()](#limitoffset-max)
- [Batch Operations](#batch-operations)
  - [batch()](#batchargs-type)
  - [override()](#overridedata-type)
- [Iteration Methods](#iteration-methods)
  - [entries()](#entries)
  - [keys()](#keys)
  - [values()](#values)
  - [forEach()](#foreachfn-ctx)
  - [map()](#mapfn)
- [Utility Methods](#utility-methods)
  - [clone()](#clonearg)
  - [freeze()](#freezeargs)
  - [merge()](#mergea-b-override)
- [Index Management](#index-management)
  - [reindex()](#reindexindex)
- [Export Methods](#export-methods)
  - [dump()](#dumptype)
  - [toArray()](#toarray)
- [Properties](#properties)
  - [registry](#registry)
  - [size](#size)
- [Factory Function](#factory-function)
  - [haro()](#harodata-config)

---

## Haro Class

### Constructor(config)

Creates a new Haro instance with specified configuration.

**Parameters:**
- `config` (Object, optional): Configuration object
  - `delimiter` (string): Delimiter for composite indexes (default: `'|'`)
  - `id` (string): Unique identifier for this instance (auto-generated if not provided)
  - `immutable` (boolean): Return frozen/immutable objects for data safety (default: `false`)
  - `index` (string[]): Array of field names to create indexes for (default: `[]`)
  - `key` (string): Primary key field name used for record identification (default: `'id'`)
  - `versioning` (boolean): Enable versioning to track record changes (default: `false`)
  - `warnOnFullScan` (boolean): Enable warnings for full table scan queries (default: `true`)

**Example:**
```javascript
const store = new Haro({
  index: ['name', 'email', 'name|department'],
  key: 'userId',
  versioning: true,
  immutable: true
});
```

---

## Core Methods

### set(key, data, batch, override)

Sets or updates a record in the store with automatic indexing.

**Parameters:**
- `key` (string|null): Key for the record, or null to use record's key field
- `data` (Object): Record data to set
- `batch` (boolean): Whether this is part of a batch operation (default: `false`)
- `override` (boolean): Whether to override existing data instead of merging (default: `false`)

**Returns:** Object - The stored record (frozen if immutable mode)

**Throws:** Error if key is not a string/number or data is not an object

**Example:**
```javascript
// Auto-generate key
const user = store.set(null, {name: 'John', age: 30});

// Update existing record
const updated = store.set('user123', {age: 31});
```

---

### get(key)

Retrieves a record by its key.

**Parameters:**
- `key` (string): Key of record to retrieve

**Returns:** Object|null - The record if found, null if not found

**Throws:** Error if key is not a string or number

**Example:**
```javascript
const user = store.get('user123');
```

---

### delete(key, batch)

Deletes a record from the store and removes it from all indexes.

**Parameters:**
- `key` (string): Key of record to delete
- `batch` (boolean): Whether this is part of a batch operation (default: `false`)

**Returns:** void

**Throws:** Error if record with the specified key is not found

**Example:**
```javascript
store.delete('user123');
// Throws error if 'user123' doesn't exist
```

---

### has(key)

Checks if a record with the specified key exists in the store.

**Parameters:**
- `key` (string): Key to check for existence

**Returns:** boolean - True if record exists, false otherwise

**Example:**
```javascript
if (store.has('user123')) {
  console.log('User exists');
}
```

---

### clear()

Removes all records, indexes, and versions from the store.

**Returns:** Haro - This instance for method chaining

**Example:**
```javascript
store.clear();
console.log(store.size); // 0
```

---

## Query Methods

### find(where)

Finds records matching the specified criteria using indexes for optimal performance.

**Parameters:**
- `where` (Object): Object with field-value pairs to match against

**Returns:** Array<Object> - Array of matching records (frozen if immutable mode)

**Throws:** Error if where is not an object

**Example:**
```javascript
const users = store.find({department: 'engineering', active: true});
const admins = store.find({role: 'admin'});
```

---

### where(predicate, op)

Advanced filtering with predicate logic supporting AND/OR operations on arrays.

**Parameters:**
- `predicate` (Object): Object with field-value pairs for filtering
- `op` (string): Operator for array matching (`'||'` for OR, `'&&'` for AND) (default: `'||'`)

**Returns:** Array<Object> - Array of records matching the predicate criteria

**Throws:** Error if predicate is not an object or op is not a string

**Example:**
```javascript
// Find records with tags containing 'admin' OR 'user'
const users = store.where({tags: ['admin', 'user']}, '||');

// Find records with ALL specified tags
const powerUsers = store.where({tags: ['admin', 'power']}, '&&');

// Regex matching
const emails = store.where({email: /^admin@/});
```

---

### search(value, index)

Searches for records containing a value across specified indexes.

**Parameters:**
- `value` (*): Value to search for (string, function, or RegExp)
- `index` (string|string[]): Index(es) to search in, or all if not specified

**Returns:** Array<Object> - Array of matching records

**Throws:** Error if value is null or undefined

**Example:**
```javascript
const results = store.search('john'); // Search all indexes
const nameResults = store.search('john', 'name'); // Search only name index
const regexResults = store.search(/^admin/, 'role'); // Regex search
```

---

### filter(fn)

Filters records using a predicate function, similar to Array.filter.

**Parameters:**
- `fn` (Function): Predicate function to test each record (record, key, store)

**Returns:** Array<Object> - Array of records that pass the predicate test

**Throws:** Error if fn is not a function

**Example:**
```javascript
const adults = store.filter(record => record.age >= 18);
const recent = store.filter(record => record.created > Date.now() - 86400000);
```

---

### sortBy(index)

Sorts records by a specific indexed field in ascending order.

**Parameters:**
- `index` (string): Index field name to sort by

**Returns:** Array<Object> - Array of records sorted by the specified field

**Throws:** Error if index field is empty

**Example:**
```javascript
const byAge = store.sortBy('age');
const byName = store.sortBy('name');
```

---

### sort(fn, frozen)

Sorts all records using a comparator function.

**Parameters:**
- `fn` (Function): Comparator function for sorting (a, b) => number
- `frozen` (boolean): Whether to return frozen records (default: `false`)

**Returns:** Array<Object> - Sorted array of records

**Throws:** Error if fn is not a function

**Example:**
```javascript
const sorted = store.sort((a, b) => a.age - b.age); // Sort by age
const names = store.sort((a, b) => a.name.localeCompare(b.name)); // Sort by name
```

---

### limit(offset, max)

Returns a limited subset of records with offset support for pagination.

**Parameters:**
- `offset` (number): Number of records to skip from the beginning (default: `0`)
- `max` (number): Maximum number of records to return (default: `0`)

**Returns:** Array<Object> - Array of records within the specified range

**Throws:** Error if offset or max is not a number

**Example:**
```javascript
const page1 = store.limit(0, 10);   // First 10 records
const page2 = store.limit(10, 10);  // Next 10 records
```

---

## Batch Operations

### batch(args, type)

Performs batch operations on multiple records for efficient bulk processing.

**Parameters:**
- `args` (Array<Object>): Array of records to process
- `type` (string): Type of operation: 'set' for upsert, 'del' for delete (default: `'set'`)

**Returns:** Array<Object> - Array of results from the batch operation

**Throws:** Error if individual operations fail during batch processing

**Example:**
```javascript
const results = store.batch([
  {id: 1, name: 'John'},
  {id: 2, name: 'Jane'}
], 'set');
```

---

### override(data, type)

Replaces all store data or indexes with new data for bulk operations.

**Parameters:**
- `data` (Array<Array>): Data to replace with (format depends on type)
- `type` (string): Type of data: 'records' or 'indexes' (default: `'records'`)

**Returns:** boolean - True if operation succeeded

**Throws:** Error if type is invalid

**Example:**
```javascript
const records = [['key1', {name: 'John'}], ['key2', {name: 'Jane'}]];
store.override(records, 'records');
```

---

## Iteration Methods

### entries()

Returns an iterator of [key, value] pairs for each record in the store.

**Returns:** Iterator<Array<string|Object>> - Iterator of [key, value] pairs

**Example:**
```javascript
for (const [key, value] of store.entries()) {
  console.log(key, value);
}
```

---

### keys()

Returns an iterator of all keys in the store.

**Returns:** Iterator<string> - Iterator of record keys

**Example:**
```javascript
for (const key of store.keys()) {
  console.log(key);
}
```

---

### values()

Returns an iterator of all values in the store.

**Returns:** Iterator<Object> - Iterator of record values

**Example:**
```javascript
for (const record of store.values()) {
  console.log(record.name);
}
```

---

### forEach(fn, ctx)

Executes a function for each record in the store, similar to Array.forEach.

**Parameters:**
- `fn` (Function): Function to execute for each record (value, key)
- `ctx` (*): Context object to use as 'this' when executing the function

**Returns:** Haro - This instance for method chaining

**Example:**
```javascript
store.forEach((record, key) => {
  console.log(`${key}: ${record.name}`);
});
```

---

### map(fn)

Transforms all records using a mapping function, similar to Array.map.

**Parameters:**
- `fn` (Function): Function to transform each record (record, key)

**Returns:** Array<*> - Array of transformed results

**Throws:** Error if fn is not a function

**Example:**
```javascript
const names = store.map(record => record.name);
const summaries = store.map(record => ({id: record.id, name: record.name}));
```

---

## Utility Methods

### clone(arg)

Creates a deep clone of the given value, handling objects, arrays, and primitives.

**Parameters:**
- `arg` (*): Value to clone (any type)

**Returns:** * - Deep clone of the argument

**Example:**
```javascript
const original = {name: 'John', tags: ['user', 'admin']};
const cloned = store.clone(original);
cloned.tags.push('new'); // original.tags is unchanged
```

---

### freeze(...args)

Creates a frozen array from the given arguments for immutable data handling.

**Parameters:**
- `args` (...*): Arguments to freeze into an array

**Returns:** Array<*> - Frozen array containing frozen arguments

**Example:**
```javascript
const frozen = store.freeze(obj1, obj2, obj3);
// Returns Object.freeze([Object.freeze(obj1), Object.freeze(obj2), Object.freeze(obj3)])
```

---

### merge(a, b, override)

Merges two values together with support for arrays and objects.

**Parameters:**
- `a` (*): First value (target)
- `b` (*): Second value (source)
- `override` (boolean): Whether to override arrays instead of concatenating (default: `false`)

**Returns:** * - Merged result

**Example:**
```javascript
const merged = store.merge({a: 1}, {b: 2}); // {a: 1, b: 2}
const arrays = store.merge([1, 2], [3, 4]); // [1, 2, 3, 4]
```

---

## Index Management

### reindex(index)

Rebuilds indexes for specified fields or all fields for data consistency.

**Parameters:**
- `index` (string|string[]): Specific index field(s) to rebuild, or all if not specified

**Returns:** Haro - This instance for method chaining

**Example:**
```javascript
store.reindex(); // Rebuild all indexes
store.reindex('name'); // Rebuild only name index
store.reindex(['name', 'email']); // Rebuild name and email indexes
```

---

## Export Methods

### dump(type)

Exports complete store data or indexes for persistence or debugging.

**Parameters:**
- `type` (string): Type of data to export: 'records' or 'indexes' (default: `'records'`)

**Returns:** Array<Array> - Array of [key, value] pairs for records, or serialized index structure

**Example:**
```javascript
const records = store.dump('records');
const indexes = store.dump('indexes');
```

---

### toArray()

Converts all store data to a plain array of records.

**Returns:** Array<Object> - Array containing all records in the store

**Example:**
```javascript
const allRecords = store.toArray();
console.log(`Store contains ${allRecords.length} records`);
```

---

## Properties

### registry

Array of all keys in the store (read-only).

**Type:** Array<string>

**Example:**
```javascript
console.log(store.registry); // ['key1', 'key2', 'key3']
```

---

### size

Number of records in the store (read-only).

**Type:** number

**Example:**
```javascript
console.log(store.size); // 3
```

---

## Factory Function

### haro(data, config)

Factory function to create a new Haro instance with optional initial data.

**Parameters:**
- `data` (Array<Object>|null): Initial data to populate the store (default: `null`)
- `config` (Object): Configuration object passed to Haro constructor (default: `{}`)

**Returns:** Haro - New Haro instance configured and optionally populated

**Example:**
```javascript
const store = haro([
  {id: 1, name: 'John', age: 30},
  {id: 2, name: 'Jane', age: 25}
], {
  index: ['name', 'age'],
  versioning: true
});
```

---

*For detailed implementation patterns and best practices, refer to the [Technical Documentation](TECHNICAL_DOCUMENTATION.md) and [Code Style Guide](CODE_STYLE_GUIDE.md).*
