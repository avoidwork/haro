# Haro

[![npm version](https://img.shields.io/npm/v/haro.svg)](https://www.npmjs.com/package/haro)
[![License: BSD-3](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](./LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/avoidwork/haro/ci.yml?branch=main)](https://github.com/avoidwork/haro/actions)

**A simple, fast, and flexible way to organize and search your data.**

---

Need a simple way to keep track of information—like contacts, lists, or notes? Haro helps you organize, find, and update your data quickly, whether you’re using it in a website, an app, or just on your computer. It’s like having a super-organized digital assistant for your information.

## Table of Contents
- [Features](#key-features)
- [Installation](#installation)
- [Usage](#usage)
- [Examples](#examples)
- [API](#api)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)
- [Changelog](#changelog)
- [Support](#support)

## Key Features
- **Easy to use**: Works out of the box, no complicated setup.
- **Very fast**: Quickly finds and updates your information.
- **Keeps a history**: Remembers changes, so you can see what something looked like before.
- **Flexible**: Use it for any type of data—contacts, tasks, notes, and more.
- **Works anywhere**: Use it in your website, app, or server.

## How Does It Work?
Imagine you have a box of index cards, each with information about a person or thing. Haro helps you sort, search, and update those cards instantly. If you make a change, Haro remembers the old version too. You can ask Haro questions like “Who is named Jane?” or “Show me everyone under 30.”

## Who Is This For?
- Anyone who needs to keep track of information in an organized way.
- People building websites or apps who want an easy way to manage data.
- Developers looking for a fast, reliable data storage solution.

## Installation

Install with npm:

```sh
npm install haro
```

Or with yarn:

```sh
yarn add haro
```

## Usage

Haro is available as both an ES module and CommonJS module.

### Import (ESM)
```javascript
import { haro } from 'haro';
```

### Require (CommonJS)
```javascript
const { haro } = require('haro');
```

### Creating a Store
Haro takes two optional arguments: an array of records to set asynchronously, and a configuration object.

```javascript
const storeDefaults = haro();
const storeRecords = haro([
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 28 }
]);
const storeCustom = haro(null, { key: 'id' });
```

## Examples

### Example 1: Manage a Contact List
```javascript
import { haro } from 'haro';

// Create a store with indexes for name and email
const contacts = haro(null, { index: ['name', 'email'] });

// Add realistic contacts
contacts.batch([
  { name: 'Alice Johnson', email: 'alice.j@example.com', company: 'Acme Corp', phone: '555-1234' },
  { name: 'Carlos Rivera', email: 'carlos.r@example.com', company: 'Rivera Designs', phone: '555-5678' },
  { name: 'Priya Patel', email: 'priya.p@example.com', company: 'InnovateX', phone: '555-8765' }
], 'set');

// Find a contact by email
console.log(contacts.find({ email: 'carlos.r@example.com' }));
// → [[$uuid, { name: 'Carlos Rivera', email: 'carlos.r@example.com', company: 'Rivera Designs', phone: '555-5678' }]]

// Search contacts by company
console.log(contacts.search(/^acme/i, 'company'));
// → [[$uuid, { name: 'Alice Johnson', email: 'alice.j@example.com', company: 'Acme Corp', phone: '555-1234' }]]

// Search contacts with phone numbers ending in '78'
console.log(contacts.search(phone => phone.endsWith('78'), 'phone'));
// → [[$uuid, { name: 'Carlos Rivera', ... }]]
```

### Example 2: Track Project Tasks
```javascript
import { haro } from 'haro';

// Create a store for project tasks, indexed by status and assignee
const tasks = haro(null, { index: ['status', 'assignee'] });

tasks.batch([
  { title: 'Design homepage', status: 'in progress', assignee: 'Alice', due: '2025-05-20' },
  { title: 'Fix login bug', status: 'open', assignee: 'Carlos', due: '2025-05-18' },
  { title: 'Deploy to production', status: 'done', assignee: 'Priya', due: '2025-05-15' }
], 'set');

// Find all open tasks
console.log(tasks.find({ status: 'open' }));
// → [[$uuid, { title: 'Fix login bug', status: 'open', assignee: 'Carlos', due: '2025-05-18' }]]

// Search tasks assigned to Alice
console.log(tasks.search('Alice', 'assignee'));
// → [[$uuid, { title: 'Design homepage', ... }]]
```

### Example 3: Track Order Status Changes (Versioning)
```javascript
import { haro } from 'haro';

// Enable versioning for order tracking
const orders = haro(null, { versioning: true });

// Add a new order and update its status
let rec = orders.set(null, { id: 1001, customer: 'Priya Patel', status: 'processing' });
rec = orders.set(rec[0], { id: 1001, customer: 'Priya Patel', status: 'shipped' });
rec = orders.set(rec[0], { id: 1001, customer: 'Priya Patel', status: 'delivered' });

// See all status changes for the order
orders.versions.get(rec[0]).forEach(([data]) => console.log(data));
// Output:
// { id: 1001, customer: 'Priya Patel', status: 'processing' }
// { id: 1001, customer: 'Priya Patel', status: 'shipped' }
// { id: 1001, customer: 'Priya Patel', status: 'delivered' }
```
// { note: 'Initial' }
// { note: 'Updated' }
```

These examples show how Haro can help you manage contacts, tasks, and keep a history of changes with just a few lines of code.

## Configuration
### beforeBatch
_Function_

Event listener for before a batch operation, receives `type`, `data`.

### beforeClear
_Function_

Event listener for before clearing the data store.

### beforeDelete
_Function_

Event listener for before a record is deleted, receives `key`, `batch`.

### beforeSet
_Function_

Event listener for before a record is set, receives `key`, `data`.

### index
_Array_

Array of values to index. Composite indexes are supported, by using the default delimiter (`this.delimiter`).
Non-matches within composites result in blank values.

Example of fields/properties to index:
```javascript
const store = haro(null, {index: ['field1', 'field2', 'field1|field2|field3']});
```

### key
_String_

Optional `Object` key to utilize as `Map` key, defaults to a version 4 `UUID` if not specified, or found.

Example of specifying the primary key:
```javascript
const store = haro(null, {key: 'field'});
```

### logging
_Boolean_

Logs persistent storage messages to `console`, default is `true`.

### onbatch
_Function_

Event listener for a batch operation, receives two arguments ['type', `Array`].

### onclear
_Function_

Event listener for clearing the data store.

### ondelete
_Function_

Event listener for when a record is deleted, receives the record key.

### onoverride
_Function_

Event listener for when the data store changes entire data set, receives a `String` naming what changed (`indexes` or `records`).

### onset
_Function_

Event listener for when a record is set, receives an `Array`.

### versioning
_Boolean_

Enable/disable MVCC style versioning of records, default is `false`. Versions are stored in `Sets` for easy iteration.

Example of enabling versioning:
```javascript
const store = haro(null, {versioning: true});
```

## Properties
### data
_Map_

`Map` of records, updated by `del()` & `set()`.

### indexes
_Map_

Map of indexes, which are Sets containing Map keys.

### registry
_Array_

Array representing the order of `this.data`.

### size
_Number_

Number of records in the DataStore.

### versions
_Map_

`Map` of `Sets` of records, updated by `set()`.

## API
### batch(array, type)
_Array_

The first argument must be an `Array`, and the second argument must be `del` or `set`.

```javascript
const haro = require('haro'),
    store = haro(null, {key: 'id', index: ['name']}),
    nth = 100,
    data = [];

let i = -1;

while (++i < nth) {
  data.push({id: i, name: 'John Doe' + i});
}

// records is an Array of Arrays
const records = store.batch(data, 'set');
```

### clear()
_self_

Removes all key/value pairs from the DataStore.

Example of clearing a DataStore:
```javascript
const store = haro();

// Data is added

store.clear();
```

### del(key)
_Undefined_

Deletes the record.

Example of deleting a record:
```javascript
const store = haro(),
  rec = store.set(null, {abc: true});

store.del(rec[0]);
console.log(store.size); // 0
```

### dump(type="records")
_Array_ or _Object_

Returns the records or indexes of the DataStore as mutable `Array` or `Object`, for the intention of reuse/persistent storage without relying on an adapter which would break up the data set.

```javascript
const store = haro();

// Data is loaded

const records = store.dump();
const indexes = store.dump('indexes');

// Save records & indexes
```

### entries()
_MapIterator_

Returns a new `Iterator` object that contains an array of `[key, value]` for each element in the `Map` object in
insertion order.

Example of deleting a record:
```javascript
const store = haro();
let item, iterator;

// Data is added

iterator = store.entries();
item = iterator.next();

do {
  console.log(item.value);
  item = iterator.next();
} while (!item.done);
```

### filter(callbackFn[, raw=false])
_Array_

Returns an `Array` of double `Arrays` with the shape `[key, value]` for records which returned `true` to
`callbackFn(value, key)`.

Example of filtering a DataStore:
```javascript
const store = haro();

// Data is added

store.filter(function (value) {
  return value.something === true;
});
```

### find(where[, raw=false])
_Array_

Returns an `Array` of double `Arrays` with found by indexed values matching the `where`.

Example of finding a record(s) with an identity match:
```javascript
const store = haro(null, {index: ['field1']});

// Data is added

store.find({field1: 'some value'});
```

### forEach(callbackFn[, thisArg])
_Undefined_

Calls `callbackFn` once for each key-value pair present in the `Map` object, in insertion order. If a `thisArg`
parameter is provided to `forEach`, it will be used as the `this` value for each callback.

Example of deleting a record:
```javascript
const store = haro();

store.set(null, {abc: true});
store.forEach(function (value, key) {
  console.log(key);
});
```

### get(key[, raw=false])
_Array_

Gets the record as a double `Array` with the shape `[key, value]`.

Example of getting a record with a known primary key value:
```javascript
const store = haro();

// Data is added

store.get('keyValue');
```

### has(key)
_Boolean_

Returns a `Boolean` indicating if the data store contains `key`.

Example of checking for a record with a known primary key value:
```javascript
const store = haro();

// Data is added

store.has('keyValue'); // true or false
```

### keys()
_MapIterator_

Returns a new `Iterator` object that contains the keys for each element in the `Map` object in insertion order.`

Example of getting an iterator, and logging the results:
```javascript
const store = haro();
let item, iterator;

// Data is added

iterator = store.keys();
item = iterator.next();

do {
  console.log(item.value);
  item = iterator.next();
} while (!item.done);
```

### limit(offset=0, max=0, raw=false)
_Array_

Returns an `Array` of double `Arrays` with the shape `[key, value]` for the corresponding range of records.

Example of paginating a data set:
```javascript
const store = haro();

let ds1, ds2;

// Data is added

console.log(store.size);  // >10
ds1 = store.limit(0, 10);  // [0-9]
ds2 = store.limit(10, 10); // [10-19]

console.log(ds1.length === ds2.length); // true
console.log(JSON.stringify(ds1[0][1]) === JSON.stringify(ds2[0][1])); // false
```

### map(callbackFn, raw=false)
_Array_

Returns an `Array` of the returns of `callbackFn(value, key)`. If `raw` is `true` an `Array` is returned.

Example of mapping a DataStore:
```javascript
const store = haro();

// Data is added

store.map(function (value) {
  return value.property;
});
```

### override(data[, type="records", fn])
_Boolean_

This is meant to be used in a paired override of the indexes & records, such that
you can avoid the `Promise` based code path of a `batch()` insert or `load()`. Accepts an optional third parameter to perform the
transformation to simplify cross domain issues.

Example of overriding a DataStore:
```javascript
const store = haro();

store.override({'field': {'value': ['pk']}}, "indexes");
```

### reduce(accumulator, value[, key, ctx=this, raw=false])
_Array_

Runs an `Array.reduce()` inspired function against the data store (`Map`).

Example of filtering a DataStore:
```javascript
const store = haro();

// Data is added

store.reduce(function (accumulator, value, key) {
  accumulator[key] = value;

  return accumulator;
}, {});
```


### reindex([index])
_Haro_

Re-indexes the DataStore, to be called if changing the value of `index`.

Example of mapping a DataStore:
```javascript
const store = haro();

// Data is added

// Creating a late index
store.reindex('field3');

// Recreating indexes, this should only happen if the store is out of sync caused by developer code.
store.reindex();
```

### search(arg[, index=this.index, raw=false])
_Array_

Returns an `Array` of double `Arrays` with the shape `[key, value]` of records found matching `arg`.
If `arg` is a `Function` (parameters are `value` & `index`) a match is made if the result is `true`, if `arg` is a `RegExp` the field value must `.test()`
as `true`, else the value must be an identity match. The `index` parameter can be a `String` or `Array` of `Strings`;
if not supplied it defaults to `this.index`.

Indexed `Arrays` which are tested with a `RegExp` will be treated as a comma delimited `String`, e.g. `['hockey', 'football']` becomes `'hockey, football'` for the `RegExp`.

Example of searching with a predicate function:
```javascript
const store = haro(null, {index: ['department', 'salary']}),
  employees = [
    { name: 'Alice Johnson', department: 'Engineering', salary: 120000 },
    { name: 'Carlos Rivera', department: 'Design', salary: 95000 },
    { name: 'Priya Patel', department: 'Engineering', salary: 130000 }
  ];

store.batch(employees, 'set');
// Find all employees in Engineering making over $125,000
console.log(store.search((salary, department) => department === 'Engineering' && salary > 125000, ['salary', 'department']));
// → [[$uuid, { name: 'Priya Patel', department: 'Engineering', salary: 130000 }]]
```

### set(key, data, batch=false, override=false)
_Object_

Record in the DataStore. If `key` is `false` a version 4 `UUID` will be
generated.

If `override` is `true`, the existing record will be replaced instead of amended.

Example of creating a record:
```javascript
const store = haro(null, {key: 'id'}),
  record = store.set(null, {id: 1, name: 'John Doe'});

console.log(record); // [1, {id: 1, name: 'Jane Doe'}]
```

### sort(callbackFn, [frozen = true])
_Array_

Returns an Array of the DataStore, sorted by `callbackFn`.

Example of sorting like an `Array`:
```javascript
const store = haro(null, {index: ['name', 'age']}),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set')
console.log(store.sort((a, b) => a < b ? -1 : (a > b ? 1 : 0))); // [{name: 'Jane Doe', age: 28}, {name: 'John Doe', age: 30}]
```

### sortBy(index[, raw=false])
_Array_

Returns an `Array` of double `Arrays` with the shape `[key, value]` of records sorted by an index.

Example of sorting by an index:
```javascript
const store = haro(null, {index: ['priority', 'due']}),
  tickets = [
    { title: 'Fix bug #42', priority: 2, due: '2025-05-18' },
    { title: 'Release v2.0', priority: 1, due: '2025-05-20' },
    { title: 'Update docs', priority: 3, due: '2025-05-22' }
  ];

store.batch(tickets, 'set');
console.log(store.sortBy('priority'));
// → Sorted by priority ascending
```

### toArray([frozen=true])
_Array_

Returns an Array of the DataStore.

Example of casting to an `Array`:
```javascript
const store = haro(),
  notes = [
    { title: 'Call Alice', content: 'Discuss Q2 roadmap.' },
    { title: 'Email Carlos', content: 'Send project update.' }
  ];

store.batch(notes, 'set');
console.log(store.toArray());
// → [
//   { title: 'Call Alice', content: 'Discuss Q2 roadmap.' },
//   { title: 'Email Carlos', content: 'Send project update.' }
// ]
```

### values()
_MapIterator_

Returns a new `Iterator` object that contains the values for each element in the `Map` object in insertion order.

Example of iterating the values:
```javascript
const store = haro(),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set')

const iterator = store.values();
let item = iterator.next();

while (!item.done) {
  console.log(item.value);
  item = iterator.next();
};
```

### where(predicate[, raw=false, op="||"])
_Array_

Ideal for when dealing with a composite index which contains an `Array` of values, which would make matching on a single value impossible when using `find()`.

```javascript
const store = haro(null, {key: 'guid', index: ['name', 'name|age', 'age']}),
   data = [{guid: 'abc', name: 'John Doe', age: 30}, {guid: 'def', name: 'Jane Doe', age: 28}];

store.batch(data, 'set');
console.log(store.where({name: 'John Doe', age: 30})); // [{guid: 'abc', name: 'John Doe', age: 30}]
```

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/avoidwork/haro/issues) or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a pull request

## Support

For questions, suggestions, or support, please open an issue on [GitHub](https://github.com/avoidwork/haro/issues), or contact the maintainer.

## License

This project is licensed under the BSD-3 license - see the [LICENSE](./LICENSE) file for details.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes and version history.
