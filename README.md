# haro

Haro is a modern immutable DataStore built with ES6 features. It is un-opinionated, and offers a "plug-and-play" solution to modeling, searching, & managing data on the client, or server
(in RAM). It is a [partially persistent data structure](https://en.wikipedia.org/wiki/Persistent_data_structure), by maintaining version sets of records in `versions` ([MVCC](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)).

All methods are synchronous.

Haro indexes have the following structure `Map (field/property) > Map (value) > Set (PKs)` which allow for quick & easy 
searching, as well as inspection. Indexes can be managed independently of `del()` & `set()` operations, for example you 
can lazily create new indexes via `reindex(field)`, or `sortBy(field)`.

## Testing

Haro has >90% code coverage with its tests.

```console
----------|---------|----------|---------|---------|---------------------------------------------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|---------------------------------------------------------
All files |   92.62 |    70.81 |   94.11 |   92.69 |                                                        
 haro.cjs |   92.62 |    70.81 |   94.11 |   92.69 | 85,87,92-95,192,203,251,281,327,349,396,433,440,463,491
----------|---------|----------|---------|---------|---------------------------------------------------------
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
### Indexes & Searching
```javascript
const store = haro(null, {index: ['name', 'age']}),
    data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

const records = store.batch(data, 'set');

console.log(records[0]); // [$uuid, {name: 'John Doe', age: 30}]
console.log(store.size); // 2
console.log(store.find({age: 28})); // [[$uuid, {name: 'Jane Doe', age: 28}]]
console.log(store.search(/^ja/i, 'name')); // [[$uuid, {name: 'Jane Doe', age: 28}]]
console.log(store.search(arg => age < 30, 'age')); // [[$uuid, {name: 'Jane Doe', age: 28}]]
```

### MVCC versioning
```javascript
const store = haro();
let arg;

arg = store.set(null, {abc: true});
arg = store.set(arg[0], {abc: false});
arg = store.set(arg[0], {abc: true});
store.versions.get(arg[0]).forEach(i => console.log(i[0])); // {abc: true}, {abc: false}
```

## Benchmarked
A benchmark is included in the repository, and is useful for gauging how haro will perform on different hardware, & software.

```
time to batch insert data: 21.356 ms
datastore record count: 1000
name indexes: 1000

testing time to 'find()' a record (first one is cold):
0.1156ms
0.0147ms
0.0137ms
0.0186ms
0.0141ms

testing time to 'search(regex, index)' for a record (first one is cold):
0.2372ms
0.1778ms
0.1101ms
0.1287ms
0.1109ms

time to override data: 0.5522 ms
testing time to 'search(regex, index)' on overridden data for a record (first one is cold):
0.0541ms
0.0502ms
0.0441ms
0.0497ms
0.0469ms
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
Copyright (c) 2024 Jason Mulligan
Licensed under the BSD-3 license
