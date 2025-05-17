# Haro

**A simple, fast, and flexible way to organize and search your data.**

Need a simple way to keep track of information—like contacts, lists, or notes? Haro helps you organize, find, and update your data quickly, whether you’re using it in a website, an app, or just on your computer. It’s like having a super-organized digital assistant for your information.

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

## Testing

Haro has 100% code coverage with its tests.

```console
----------|---------|----------|---------|---------|------------------------------------------------------------------------------------------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s                                                                                    
----------|---------|----------|---------|---------|------------------------------------------------------------------------------------------------------
All files |    99.6 |    77.83 |     100 |     100 |                                                                                                      
 haro.cjs |    99.6 |    77.83 |     100 |     100 | 49-79,85-115,136,171-183,200,236,250,286-306,324,351-352,357-359,373-376,378-381,437,479,486,490-500 
----------|---------|----------|---------|---------|------------------------------------------------------------------------------------------------------
```

## Usage
The named export is `haro`, and the named Class exported is `Haro`.

### ES Module
```javascript
import {haro} from 'haro';
```

### CommonJS / node.js
```javascript
const {haro} = require('haro');
```
### Function parameters
Haro takes two optional arguments, the first is an `Array` of records to set asynchronously, & the second is a 
configuration descriptor.

```javascript
const storeDefaults = haro();
const storeRecords = haro([{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}]);
const storeCustom = haro(null, {key: 'id'});
```

## Examples

### Example 1: Manage a Contact List
```javascript
import { haro } from 'haro';

// Create a store with indexes for name and age
const contacts = haro(null, { index: ['name', 'age'] });

// Add contacts
contacts.batch([
  { name: 'John Doe', age: 30 },
  { name: 'Jane Doe', age: 28 }
], 'set');

// Find a contact by age
console.log(contacts.find({ age: 28 })); // → [[$uuid, { name: 'Jane Doe', age: 28 }]]

// Search contacts by name (case-insensitive)
console.log(contacts.search(/^ja/i, 'name')); // → [[$uuid, { name: 'Jane Doe', age: 28 }]]

// Search contacts younger than 30
console.log(contacts.search(age => age < 30, 'age')); // → [[$uuid, { name: 'Jane Doe', age: 28 }]]
```

### Example 2: Track Task Status
```javascript
import { haro } from 'haro';

// Create a store for tasks, indexed by status
const tasks = haro(null, { index: ['status'] });

tasks.batch([
  { title: 'Buy groceries', status: 'pending' },
  { title: 'Write report', status: 'done' }
], 'set');

// Find all pending tasks
console.log(tasks.find({ status: 'pending' })); // → [[$uuid, { title: 'Buy groceries', status: 'pending' }]]
```

### Example 3: See Change History (Versioning)
```javascript
import { haro } from 'haro';

// Enable versioning
const store = haro(null, { versioning: true });

// Add and update a record
let rec = store.set(null, { note: 'Initial' });
rec = store.set(rec[0], { note: 'Updated' });

// See all versions of the record
store.versions.get(rec[0]).forEach(([data]) => console.log(data));
// Output:
// { note: 'Initial' }
// { note: 'Updated' }
```

These examples show how Haro can help you manage contacts, tasks, and keep a history of changes with just a few lines of code.

## Benchmarked
A benchmark is included in the repository, and is useful for gauging how haro will perform on different hardware, & software.

```
time to batch insert data: 6.7825 ms
datastore record count: 1000
name indexes: 1000

testing time to 'find()' a record (first one is cold):
0.063375ms
0.004583ms
0.002417ms
0.003459ms
0.001916ms

testing time to 'search(regex, index)' for a record (first one is cold):
0.147792ms
0.051209ms
0.050958ms
0.051125ms
0.052166ms

time to override data: 0.361709 ms
testing time to 'search(regex, index)' on overridden data for a record (first one is cold):
0.053083ms
0.051916ms
0.027459ms
0.0275ms
0.032292ms
```

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
const store = haro(null, {index: ['name', 'age']}),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set')
console.log(store.search(function (age) {
  return age < 30;
}, 'age')); // [[$uuid, {name: 'Jane Doe', age: 28}]]
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
const store = haro(null, {index: ['name', 'age']}),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set')
console.log(store.sortBy('age')); // [[$uuid, {name: 'Jane Doe', age: 28}], [$uuid, {name: 'John Doe', age: 30}]]
```

### toArray([frozen=true])
_Array_

Returns an Array of the DataStore.

Example of casting to an `Array`:
```javascript
const store = haro(),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set')
console.log(store.toArray()); // [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}]
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

## License
Copyright (c) 2025 Jason Mulligan
Licensed under the BSD-3 license
