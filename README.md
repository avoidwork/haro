# Haro

[![npm version](https://badge.fury.io/js/haro.svg)](https://badge.fury.io/js/haro)
[![Node.js Version](https://img.shields.io/node/v/haro.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![Build Status](https://github.com/avoidwork/haro/actions/workflows/ci.yml/badge.svg)](https://github.com/avoidwork/haro/actions)

A fast, flexible data store for organizing and searching your data with automatic indexing, versioning, and event handling.

## Installation

```sh
npm install haro
```

## Usage

### Factory Function

```javascript
import { haro } from 'haro';

const store = haro(records, config);
```

### Basic Setup

```javascript
import { haro } from 'haro';

// Create empty store
const store = haro();

// Create store with records
const store = haro([
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 28 }
]);

// Create store with configuration
const store = haro(null, { 
  key: 'id',
  index: ['name', 'email'],
  versioning: true
});
```

## Configuration

### index
_Array_

Fields to index for faster searches. Supports composite indexes using delimiter (`|`).

```javascript
const store = haro(null, {
  index: ['name', 'email', 'name|department']
});
```

### key
_String_

Primary key field. Defaults to auto-generated UUID if not specified.

```javascript
const store = haro(null, { key: 'id' });
```

### versioning
_Boolean_

Enable MVCC-style versioning. Defaults to `false`.

```javascript
const store = haro(null, { versioning: true });
```

### Event Listeners

```javascript
const store = haro(null, {
  beforeSet: (key, data) => console.log('Before set:', key),
  onset: (record) => console.log('Record set:', record),
  ondelete: (key) => console.log('Record deleted:', key),
  onclear: () => console.log('Store cleared')
});
```

## Properties

### data
_Map_

Internal Map of records, indexed by key.

### indexes
_Map_

Map of indexes containing Sets of record keys.

### size
_Number_

Number of records in the store.

### versions
_Map_

Map of version history (when versioning is enabled).

## API Reference

### batch(array, type)

Batch operation for multiple records.

**Parameters:**
- `array` `{Array}` - Array of records
- `type` `{String}` - Operation type: `'set'` or `'del'`

**Returns:** `{Array}` Array of results

```javascript
const results = store.batch([
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 28 }
], 'set');
```

### clear()

Removes all records from the store.

**Returns:** `{Object}` Store instance

```javascript
store.clear();
```

### del(key)

Deletes a record by key.

**Parameters:**
- `key` `{String}` - Record key

**Returns:** `{undefined}`

```javascript
store.del('record-key');
```

### find(where[, raw=false])

Find records by indexed field values.

**Parameters:**
- `where` `{Object}` - Search criteria
- `raw` `{Boolean}` - Return raw values (default: false)

**Returns:** `{Array}` Array of `[key, value]` pairs

```javascript
const results = store.find({ status: 'active' });
```

### get(key[, raw=false])

Get a record by key.

**Parameters:**
- `key` `{String}` - Record key
- `raw` `{Boolean}` - Return raw value (default: false)

**Returns:** `{Array}` `[key, value]` pair or `undefined`

```javascript
const record = store.get('record-key');
```

### has(key)

Check if a record exists.

**Parameters:**
- `key` `{String}` - Record key

**Returns:** `{Boolean}` True if record exists

```javascript
if (store.has('record-key')) {
  // Record exists
}
```

### search(arg[, index, raw=false])

Search records using functions, regex, or values.

**Parameters:**
- `arg` `{Function|RegExp|*}` - Search criteria
- `index` `{String|Array}` - Index to search (optional)
- `raw` `{Boolean}` - Return raw values (default: false)

**Returns:** `{Array}` Array of matching records

```javascript
// Function search
const results = store.search(record => record.age > 25);

// Regex search
const results = store.search(/^john/i, 'name');

// Value search
const results = store.search('Engineering', 'department');
```

### set(key, data[, batch=false, override=false])

Set a record.

**Parameters:**
- `key` `{String|null}` - Record key (null for auto-generated)
- `data` `{Object}` - Record data
- `batch` `{Boolean}` - Batch operation flag (default: false)
- `override` `{Boolean}` - Replace existing record (default: false)

**Returns:** `{Array}` `[key, value]` pair

```javascript
const record = store.set(null, { name: 'Alice', age: 30 });
// → ['uuid-key', { name: 'Alice', age: 30 }]
```

### sortBy(index[, raw=false])

Sort records by indexed field.

**Parameters:**
- `index` `{String}` - Index name
- `raw` `{Boolean}` - Return raw values (default: false)

**Returns:** `{Array}` Sorted array of records

```javascript
const sorted = store.sortBy('name');
```

### where(predicate[, raw=false, op="||"])

Query with multiple conditions.

**Parameters:**
- `predicate` `{Object}` - Query conditions
- `raw` `{Boolean}` - Return raw values (default: false)
- `op` `{String}` - Logical operator: `"||"` or `"&&"` (default: "||")

**Returns:** `{Array}` Array of matching records

```javascript
const results = store.where({ 
  department: 'Engineering', 
  level: 'Senior' 
}, false, '&&');
```

## Examples

### Contact Management

```javascript
import { haro } from 'haro';

const contacts = haro(null, { 
  index: ['name', 'email', 'company']
});

// Add contacts
contacts.batch([
  { name: 'Alice Johnson', email: 'alice@acme.com', company: 'Acme Corp' },
  { name: 'Bob Smith', email: 'bob@acme.com', company: 'Acme Corp' }
], 'set');

// Find by email
const alice = contacts.find({ email: 'alice@acme.com' });

// Search by company
const acmeEmployees = contacts.search('Acme Corp', 'company');
```

### Task Tracking with Versioning

```javascript
import { haro } from 'haro';

const tasks = haro(null, { 
  key: 'id',
  index: ['status', 'assignee'],
  versioning: true
});

// Create and update task
let task = tasks.set('task-1', { 
  id: 'task-1',
  title: 'Fix bug',
  status: 'open',
  assignee: 'Alice'
});

// Update status
task = tasks.set('task-1', { 
  id: 'task-1',
  title: 'Fix bug',
  status: 'in-progress',
  assignee: 'Alice'
});

// View version history
const history = tasks.versions.get('task-1');
```

### Real-time Data Processing

```javascript
import { haro } from 'haro';

const metrics = haro(null, {
  index: ['timestamp', 'type'],
  onset: (record) => {
    // Auto-trigger analysis on new data
    if (record[1].type === 'error') {
      alertSystem.notify(record[1]);
    }
  }
});

// Stream data processing
metrics.set(null, {
  timestamp: Date.now(),
  type: 'error',
  message: 'Database connection failed'
});
```

## Performance

Haro is optimized for:
- **Fast indexing**: O(1) lookups on indexed fields
- **Efficient searches**: Regex and function-based filtering
- **Memory efficiency**: Minimal overhead for large datasets
- **Batch operations**: Optimized bulk inserts and updates

## License

Copyright (c) 2025 Jason Mulligan  
Licensed under the BSD-3-Clause license.
