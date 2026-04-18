# Haro API Reference

## Overview

Haro is an immutable DataStore with indexing, versioning, and batch operations. Provides a Map-like interface with advanced querying capabilities.

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
  - [setMany()](#setmanyrecords)
  - [deleteMany()](#deletemanykeys)
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

Creates a new Haro instance.

**Parameters:**
- `config` (Object): Configuration object
  - `delimiter` (string): Delimiter for composite indexes (default: `'|'`)
  - `id` (string): Unique instance identifier (auto-generated)
  - `immutable` (boolean): Return frozen objects (default: `false`)
  - `index` (string[]): Fields to index (default: `[]`)
  - `key` (string): Primary key field name (default: `'id'`)
  - `versioning` (boolean): Enable versioning (default: `false`)
  - `warnOnFullScan` (boolean): Warn on full table scans (default: `true`)

**Example:**
```javascript
const store = new Haro({ index: ['name', 'email'], key: 'userId', versioning: true });
```

---

## Core Methods

### set(key, data, batch, override)

Sets or updates a record with automatic indexing.

**Parameters:**
- `key` (string|null): Record key, or null for auto-generate
- `data` (Object): Record data
- `batch` (boolean): Batch operation flag (default: `false`)
- `override` (boolean): Override instead of merge (default: `false`)

**Returns:** Object - Stored record

**Example:**
```javascript
store.set(null, {name: 'John'});
store.set('user123', {age: 31});
```

---

### get(key)

Retrieves a record by key.

**Parameters:**
- `key` (string): Record key

**Returns:** Object|null - Record or null

**Example:**
```javascript
store.get('user123');
```

---

### delete(key, batch)

Deletes a record and removes it from all indexes.

**Parameters:**
- `key` (string): Key to delete
- `batch` (boolean): Batch operation flag (default: `false`)

**Throws:** Error if key not found

**Example:**
```javascript
store.delete('user123');
```

---

### has(key)

Checks if a record exists.

**Parameters:**
- `key` (string): Record key

**Returns:** boolean - True if exists

**Example:**
```javascript
store.has('user123');
```

---

### clear()

Removes all records, indexes, and versions.

**Returns:** Haro - This instance

**Example:**
```javascript
store.clear();
```

---

## Query Methods

### find(where)

Finds records matching criteria using indexes.

**Parameters:**
- `where` (Object): Field-value pairs to match

**Returns:** Array<Object> - Matching records

**Example:**
```javascript
store.find({department: 'engineering', active: true});
```

---

### where(predicate, op)

Filters records with predicate logic supporting AND/OR on arrays.

**Parameters:**
- `predicate` (Object): Field-value pairs
- `op` (string): Operator: '||' (OR) or '&&' (AND) (default: `'||'`)

**Returns:** Array<Object> - Matching records

**Example:**
```javascript
store.where({tags: ['admin', 'user']}, '||');
store.where({email: /^admin@/});
```

---

### search(value, index)

Searches for records containing a value.

**Parameters:**
- `value` (*): Search value (string, function, or RegExp)
- `index` (string|string[]): Index(es) to search, or all

**Returns:** Array<Object> - Matching records

**Example:**
```javascript
store.search('john');
store.search(/^admin/, 'role');
```

---

### filter(fn)

Filters records using a predicate function.

**Parameters:**
- `fn` (Function): Predicate function (record, key, store)

**Returns:** Array<Object> - Filtered records

**Throws:** Error if fn is not a function

**Example:**
```javascript
store.filter(record => record.age >= 18);
```

---

### sortBy(index)

Sorts records by an indexed field.

**Parameters:**
- `index` (string): Field to sort by

**Returns:** Array<Object> - Sorted records

**Throws:** Error if index is empty

**Example:**
```javascript
store.sortBy('age');
```

---

### sort(fn, frozen)

Sorts records using a comparator function.

**Parameters:**
- `fn` (Function): Comparator (a, b) => number
- `frozen` (boolean): Return frozen records (default: `false`)

**Returns:** Array<Object> - Sorted records

**Throws:** Error if fn is not a function

**Example:**
```javascript
store.sort((a, b) => a.age - b.age);
```

---

### limit(offset, max)

Returns a limited subset of records.

**Parameters:**
- `offset` (number): Records to skip (default: `0`)
- `max` (number): Max records to return (default: `0`)

**Returns:** Array<Object> - Records

**Example:**
```javascript
store.limit(0, 10);
```

---

## Batch Operations

### setMany(records)

Inserts or updates multiple records.

**Parameters:**
- `records` (Array<Object>): Records to insert or update

**Returns:** Array<Object> - Stored records

**Example:**
```javascript
store.setMany([{id: 1, name: 'John'}, {id: 2, name: 'Jane'}]);
```

---

### deleteMany(keys)

Deletes multiple records.

**Parameters:**
- `keys` (Array<string|number>): Keys to delete

**Returns:** Array<void>

**Example:**
```javascript
store.deleteMany(['key1', 'key2']);
```

---

### override(data, type)

Replaces store data or indexes.

**Parameters:**
- `data` (Array<Array>): Data to replace
- `type` (string): Type: 'records' or 'indexes' (default: `'records'`)

**Returns:** boolean - Success

**Throws:** Error if type is invalid

**Example:**
```javascript
store.override([['key1', {name: 'John'}]], 'records');
```

---

## Iteration Methods

### entries()

Returns an iterator of [key, value] pairs.

**Returns:** Iterator<Array<string|Object>> - Key-value pairs

**Example:**
```javascript
for (const [key, value] of store.entries()) { }
```

---

### keys()

Returns an iterator of all keys.

**Returns:** Iterator<string> - Keys

**Example:**
```javascript
for (const key of store.keys()) { }
```

---

### values()

Returns an iterator of all values.

**Returns:** Iterator<Object> - Values

**Example:**
```javascript
for (const record of store.values()) { }
```

---

### forEach(fn, ctx)

Executes a function for each record.

**Parameters:**
- `fn` (Function): Function (value, key)
- `ctx` (*): Context for fn

**Returns:** Haro - This instance

**Example:**
```javascript
store.forEach((record, key) => console.log(key, record));
```

---

### map(fn)

Transforms records using a mapping function.

**Parameters:**
- `fn` (Function): Transform function (record, key)

**Returns:** Array<*> - Transformed results

**Throws:** Error if fn is not a function

**Example:**
```javascript
store.map(record => record.name);
```

---

## Utility Methods

### clone(arg)

Creates a deep clone of a value.

**Parameters:**
- `arg` (*): Value to clone

**Returns:** * - Deep clone

**Example:**
```javascript
store.clone({name: 'John', tags: ['user']});
```

---

### freeze(...args)

Creates a frozen array from arguments.

**Parameters:**
- `args` (...*): Arguments to freeze

**Returns:** Array<*> - Frozen array

**Example:**
```javascript
store.freeze(obj1, obj2);
```

---

### merge(a, b, override)

Merges two values.

**Parameters:**
- `a` (*): Target value
- `b` (*): Source value
- `override` (boolean): Override arrays (default: `false`)

**Returns:** * - Merged result

**Example:**
```javascript
store.merge({a: 1}, {b: 2});
```

---

## Index Management

### reindex(index)

Rebuilds indexes.

**Parameters:**
- `index` (string|string[]): Field(s) to rebuild, or all

**Returns:** Haro - This instance

**Example:**
```javascript
store.reindex();
store.reindex('name');
```

---

## Export Methods

### dump(type)

Exports store data or indexes.

**Parameters:**
- `type` (string): Export type: 'records' or 'indexes' (default: `'records'`)

**Returns:** Array<Array> - Exported data

**Example:**
```javascript
store.dump('records');
```

---

### toArray()

Converts store data to an array.

**Returns:** Array<Object> - All records

**Example:**
```javascript
store.toArray();
```

---

## Properties

### registry

Array of all keys in the store (read-only).

**Type:** Array<string>

**Example:**
```javascript
console.log(store.registry);
```

---

### size

Number of records in the store (read-only).

**Type:** number

**Example:**
```javascript
console.log(store.size);
```

---

## Factory Function

### haro(data, config)

Factory function to create a Haro instance.

**Parameters:**
- `data` (Array<Object>|null): Initial data (default: `null`)
- `config` (Object): Configuration (default: `{}`)

**Returns:** Haro - New Haro instance

**Example:**
```javascript
const store = haro([{id: 1, name: 'John'}], {index: ['name']});
```

---

*Generated from src/haro.js*
