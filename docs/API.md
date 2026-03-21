# Haro API Reference

## Table of Contents

- [Constructor](#constructor)
- [Properties](#properties)
- [Methods](#methods)
  - [Data Operations](#data-operations)
  - [Querying](#querying)
  - [Lifecycle Hooks](#lifecycle-hooks)
  - [Utility Methods](#utility-methods)
- [Factory Function](#factory-function)

---

## Constructor

### `new Haro(config?)`

Creates a new Haro instance with optional configuration.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `config.delimiter` | `string` | `'\|'` | Delimiter for composite indexes |
| `config.id` | `string` | auto-generated | Unique identifier for this instance |
| `config.immutable` | `boolean` | `false` | Return frozen/immutable objects |
| `config.index` | `string[]` | `[]` | Array of field names to index |
| `config.key` | `string` | `'id'` | Primary key field name |
| `config.versioning` | `boolean` | `false` | Enable versioning to track changes |

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

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `size` | `number` | Number of records in the store (read-only) |
| `registry` | `string[]` | Array of all record keys (read-only) |

---

## Methods

### Data Operations

#### `set(key?, data, batch?, override?)`

Sets or updates a record in the store with automatic indexing.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | `string \| null` | `null` | Key for the record, or null to use record's key field |
| `data` | `object` | `{}` | Record data to set |
| `batch` | `boolean` | `false` | Whether this is part of a batch operation |
| `override` | `boolean` | `false` | Whether to override existing data instead of merging |

**Returns:** `object` - The stored record (frozen if immutable mode)

**Example:**

```javascript
const user = store.set(null, {name: 'John', age: 30}); // Auto-generate key
const updated = store.set('user123', {age: 31}); // Update existing record
```

---

#### `get(key, raw?)`

Retrieves a record by its key.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | `string` | required | Key of record to retrieve |
| `raw` | `boolean` | `false` | Whether to return raw data without processing |

**Returns:** `object | null` - The record if found, null if not found

**Example:**

```javascript
const user = store.get('user123');
const rawUser = store.get('user123', true);
```

---

#### `delete(key, batch?)`

Deletes a record from the store and removes it from all indexes.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | `string` | required | Key of record to delete |
| `batch` | `boolean` | `false` | Whether this is part of a batch operation |

**Throws:** `Error` if record is not found

**Example:**

```javascript
store.delete('user123');
```

---

#### `has(key)`

Checks if a record with the specified key exists.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Key to check for existence |

**Returns:** `boolean` - True if record exists, false otherwise

**Example:**

```javascript
if (store.has('user123')) {
  console.log('User exists');
}
```

---

#### `clear()`

Removes all records, indexes, and versions from the store.

**Returns:** `Haro` - This instance for method chaining

**Example:**

```javascript
store.clear();
console.log(store.size); // 0
```

---

#### `batch(args, type?)`

Performs batch operations on multiple records.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `args` | `object[]` | required | Array of records to process |
| `type` | `string` | `'set'` | Type of operation: `'set'` for upsert, `'del'` for delete |

**Returns:** `object[]` - Array of results from the batch operation

**Example:**

```javascript
const results = store.batch([
  {id: 1, name: 'John'},
  {id: 2, name: 'Jane'}
], 'set');
```

---

#### `override(data, type?)`

Replaces all store data or indexes with new data.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | `Array<Array>` | required | Data to replace with |
| `type` | `string` | `'records'` | Type of data: `'records'` or `'indexes'` |

**Returns:** `boolean` - True if operation succeeded

**Throws:** `Error` if type is invalid

**Example:**

```javascript
const records = [['key1', {name: 'John'}], ['key2', {name: 'Jane}']];
store.override(records, 'records');
```

---

#### `dump(type?)`

Exports complete store data or indexes.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `string` | `'records'` | Type of data to export: `'records'` or `'indexes'` |

**Returns:** `Array<Array>` - Array of [key, value] pairs or serialized index structure

**Example:**

```javascript
const records = store.dump('records');
const indexes = store.dump('indexes');
```

---

### Querying

#### `find(where?, raw?)`

Finds records matching criteria using indexes.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `where` | `object` | `{}` | Object with field-value pairs to match against |
| `raw` | `boolean` | `false` | Whether to return raw data without processing |

**Returns:** `object[]` - Array of matching records

**Example:**

```javascript
const users = store.find({department: 'engineering', active: true});
const admins = store.find({role: 'admin'});
```

---

#### `search(value, index?, raw?)`

Searches for records containing a value across specified indexes.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `*` | required | Value to search for (string, function, or RegExp) |
| `index` | `string \| string[]` | all indexes | Index(es) to search in |
| `raw` | `boolean` | `false` | Whether to return raw data without processing |

**Returns:** `object[]` - Array of matching records

**Example:**

```javascript
const results = store.search('john'); // Search all indexes
const nameResults = store.search('john', 'name'); // Search only name index
const regexResults = store.search(/^admin/, 'role'); // Regex search
```

---

#### `where(predicate?, op?)`

Advanced filtering with predicate logic supporting AND/OR operations.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `predicate` | `object` | `{}` | Object with field-value pairs for filtering |
| `op` | `string` | `'\|\|'` | Operator for array matching: `'\|\|'` (OR) or `'&&'` (AND) |

**Returns:** `object[]` - Array of records matching the predicate

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

#### `filter(fn, raw?)`

Filters records using a predicate function, similar to Array.filter.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fn` | `function` | Predicate function (record, key, store) |
| `raw` | `boolean` | Whether to return raw data |

**Returns:** `object[]` - Array of records that pass the test

**Throws:** `Error` if fn is not a function

**Example:**

```javascript
const adults = store.filter(record => record.age >= 18);
const recent = store.filter(record => record.created > Date.now() - 86400000);
```

---

#### `map(fn, raw?)`

Transforms all records using a mapping function.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fn` | `function` | Function to transform each record (record, key) |
| `raw` | `boolean` | Whether to return raw data |

**Returns:** `Array<*>` - Array of transformed results

**Throws:** `Error` if fn is not a function

**Example:**

```javascript
const names = store.map(record => record.name);
const summaries = store.map(record => ({id: record.id, name: record.name}));
```

---

#### `reduce(fn, accumulator?)`

Reduces all records to a single value.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fn` | `function` | required | Reducer function (accumulator, value, key, store) |
| `accumulator` | `*` | `[]` | Initial accumulator value |

**Returns:** `*` - Final reduced value

**Example:**

```javascript
const totalAge = store.reduce((sum, record) => sum + record.age, 0);
const names = store.reduce((acc, record) => acc.concat(record.name), []);
```

---

#### `limit(offset?, max?, raw?)`

Returns a limited subset of records with offset support.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `offset` | `number` | `0` | Number of records to skip |
| `max` | `number` | `0` | Maximum number of records to return |
| `raw` | `boolean` | `false` | Whether to return raw data |

**Returns:** `object[]` - Array of records within the specified range

**Example:**

```javascript
const page1 = store.limit(0, 10);   // First 10 records
const page2 = store.limit(10, 10);  // Next 10 records
```

---

#### `sort(fn, frozen?)`

Sorts all records using a comparator function.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fn` | `function` | required | Comparator function (a, b) => number |
| `frozen` | `boolean` | `false` | Whether to return frozen records |

**Returns:** `object[]` - Sorted array of records

**Example:**

```javascript
const sorted = store.sort((a, b) => a.age - b.age);
const names = store.sort((a, b) => a.name.localeCompare(b.name));
```

---

#### `sortBy(index?, raw?)`

Sorts records by a specific indexed field.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `index` | `string` | `''` | Index field name to sort by |
| `raw` | `boolean` | `false` | Whether to return raw data |

**Returns:** `object[]` - Records sorted by the specified field

**Throws:** `Error` if index field is empty or invalid

**Example:**

```javascript
const byAge = store.sortBy('age');
const byName = store.sortBy('name');
```

---

### Iteration

#### `forEach(fn, ctx?)`

Executes a function for each record.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fn` | `function` | required | Function to execute (value, key) |
| `ctx` | `*` | `this` | Context object for 'this' |

**Returns:** `Haro` - This instance for method chaining

**Example:**

```javascript
store.forEach((record, key) => {
  console.log(`${key}: ${record.name}`);
});
```

---

#### `entries()`

Returns an iterator of [key, value] pairs.

**Returns:** `Iterator<Array>` - Iterator of [key, value] pairs

**Example:**

```javascript
for (const [key, value] of store.entries()) {
  console.log(key, value);
}
```

---

#### `keys()`

Returns an iterator of all keys.

**Returns:** `Iterator<string>` - Iterator of record keys

**Example:**

```javascript
for (const key of store.keys()) {
  console.log(key);
}
```

---

#### `values()`

Returns an iterator of all values.

**Returns:** `Iterator<object>` - Iterator of record values

**Example:**

```javascript
for (const record of store.values()) {
  console.log(record.name);
}
```

---

#### `toArray()`

Converts all store data to a plain array.

**Returns:** `object[]` - Array containing all records

**Example:**

```javascript
const allRecords = store.toArray();
console.log(`Store contains ${allRecords.length} records`);
```

---

### Lifecycle Hooks

#### Before Hooks

| Method | Parameters | Description |
|--------|------------|-------------|
| `beforeBatch(arg, type?)` | `arg`, `type` | Executed before batch operations |
| `beforeClear()` | - | Executed before clear operation |
| `beforeDelete(key?, batch?)` | `key`, `batch` | Executed before delete operation |
| `beforeSet(key?, data?, batch?, override?)` | `key`, `data`, `batch`, `override` | Executed before set operation |

#### After Hooks

| Method | Parameters | Description |
|--------|------------|-------------|
| `onbatch(arg, type?)` | `arg`, `type` | Executed after batch operations |
| `onclear()` | - | Executed after clear operation |
| `ondelete(key?, batch?)` | `key`, `batch` | Executed after delete operation |
| `onset(arg?, batch?)` | `arg`, `batch` | Executed after set operation |
| `onoverride(type?)` | `type` | Executed after override operation |

**Example:**

```javascript
class MyStore extends Haro {
  beforeSet(key, data) {
    console.log(`Setting record: ${key}`);
  }
  
  ondelete(key) {
    console.log(`Deleted record: ${key}`);
  }
}
```

---

### Utility Methods

#### `clone(arg)`

Creates a deep clone of a value.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `arg` | `*` | Value to clone |

**Returns:** `*` - Deep clone of the argument

**Example:**

```javascript
const original = {name: 'John', tags: ['user', 'admin']};
const cloned = store.clone(original);
cloned.tags.push('new'); // original.tags is unchanged
```

---

#### `merge(a, b, override?)`

Merges two values together.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `a` | `*` | required | First value (target) |
| `b` | `*` | required | Second value (source) |
| `override` | `boolean` | `false` | Whether to override arrays |

**Returns:** `*` - Merged result

**Example:**

```javascript
const merged = store.merge({a: 1}, {b: 2}); // {a: 1, b: 2}
const arrays = store.merge([1, 2], [3, 4]); // [1, 2, 3, 4]
```

---

#### `freeze(...args)`

Creates a frozen array from arguments.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `...args` | `*` | Arguments to freeze |

**Returns:** `Array<*>` - Frozen array containing frozen arguments

**Example:**

```javascript
const frozen = store.freeze(obj1, obj2, obj3);
```

---

#### `each(arr, fn)`

Iterates over an array with a callback.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `arr` | `Array` | Array to iterate over |
| `fn` | `function` | Function to call for each element |

**Returns:** `Array` - The original array

**Example:**

```javascript
store.each([1, 2, 3], (item, index) => console.log(item, index));
```

---

#### `list(arg)`

Converts a record to [key, value] pair format.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `arg` | `object` | Record object to convert |

**Returns:** `Array` - Array containing [key, record]

**Example:**

```javascript
const record = {id: 'user123', name: 'John', age: 30};
const pair = store.list(record); // ['user123', {id: 'user123', name: 'John', age: 30}]
```

---

#### `indexKeys(arg?, delimiter?, data?)`

Generates index keys for composite indexes.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `arg` | `string` | `''` | Composite index field names joined by delimiter |
| `delimiter` | `string` | `'\|'` | Delimiter used in composite index |
| `data` | `object` | `{}` | Data object to extract field values from |

**Returns:** `string[]` - Array of generated index keys

**Example:**

```javascript
const keys = store.indexKeys('name|department', '|', {name: 'John', department: 'IT'});
// Returns ['John|IT']
```

---

#### `reindex(index?)`

Rebuilds indexes for specified fields.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `index` | `string \| string[]` | all | Specific index field(s) to rebuild |

**Returns:** `Haro` - This instance for method chaining

**Example:**

```javascript
store.reindex(); // Rebuild all indexes
store.reindex('name'); // Rebuild only name index
store.reindex(['name', 'email']); // Rebuild name and email indexes
```

---

#### `uuid()`

Generates a RFC4122 v4 UUID.

**Returns:** `string` - UUID string

**Example:**

```javascript
const id = store.uuid(); // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

---

#### `sortKeys(a, b)`

Comparator function for sorting keys with type-aware comparison.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `a` | `*` | First value to compare |
| `b` | `*` | Second value to compare |

**Returns:** `number` - Negative if a < b, positive if a > b, zero if equal

**Example:**

```javascript
const keys = ['name', 'age', 'email'];
keys.sort(store.sortKeys); // Alphabetical sort
```

---

## Factory Function

### `haro(data?, config?)`

Creates a new Haro instance with optional initial data.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | `object[] \| null` | `null` | Initial data to populate the store |
| `config` | `object` | `{}` | Configuration object passed to Haro constructor |

**Returns:** `Haro` - New Haro instance configured and optionally populated

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

## Type Constants

The following string constants are exported from the library:

- `'|'` - Delimiter for composite indexes
- `'id'` - Default primary key field name
- `'records'` - Export type for records
- `'indexes'` - Export type for indexes
- `'set'` - Batch operation type for upsert
- `'del'` - Batch operation type for delete