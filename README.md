# haro

[![build status](https://secure.travis-ci.org/avoidwork/haro.svg)](http://travis-ci.org/avoidwork/haro)

Harō is a modern immutable DataStore built with ES6 features, which can be wired to an API for a complete feedback loop.
It is un-opinionated, and offers a plug'n'play solution to modeling, searching, & managing data on the client, or server 
(in RAM). It is a [partially persistent data structure](https://en.wikipedia.org/wiki/Persistent_data_structure), by maintaining version sets of records in `versions` ([MVCC](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)).

Synchronous commands return instantly (`Array` or `Tuple`), while asynchronous commands return  `Promises` which will
resolve or reject in the future. This allows you to build complex applications without worrying about managing async code.

Harō indexes have the following structure `Map (field/property) > Map (value) > Set (PKs)` which allow for quick & easy searching, as well as inspection.
Indexes can be managed independently of `del()` & `set()` operations, for example you can lazily create new indexes via `reindex(field)`, or `sortBy(field)`.

### Examples
#### Piping Promises
```javascript
var store = haro();

console.log(store.total); // 0

store.set(null, {abc: true}).then(function (arg) {
  console.log(arg); // [$uuid, {abc: true}];
  console.log(store.total); // 1
  return store.set(arg[0], {abc: false});
}).then(function (arg) {
  console.log(arg); // [$uuid, {abc: false}];
  console.log(store.versions.get(arg[0]).size); // 1;
  return store.del(arg[0])
}).then(function () {
  console.log(store.total); // 0;
}).catch(function (e) {
  console.error(e.stack || e.message || e);
});
```

#### Indexes & Searching
```javascript
var store = haro(null, {index: ['name', 'age']}),
    data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function (records) {
  console.log(records[0]); // [$uuid, {name: 'John Doe', age: 30}]
  console.log(store.total); // 2
  console.log(store.find({age: 28})); // [[$uuid, {name: 'Jane Doe', age: 28}]]
  console.log(store.search(/^ja/i, 'name')); // [[$uuid, {name: 'Jane Doe', age: 28}]]
  console.log(store.search(function (age) { return age < 30; }, 'age')); // [[$uuid, {name: 'Jane Doe', age: 28}]]
}).catch(function (e) {
  console.error(e.stack || e.message || e);
});
```

#### MVCC versioning
```javascript
var store = haro();

store.set(null, {abc: true}).then(function (arg) {
  return store.set(arg[0], {abc: false});
}).then(function (arg) {
  return store.set(arg[0], {abc: true});
}).then(function (arg) {
  store.versions.get(arg[0]).forEach(function (i) { console.log(i[0]); }); // {abc: true}, {abc: false}
}).catch(function (e) {
  console.error(e.stack || e.message || e);
});
```

### Configuration
**config**
_Object_

Default settings for `fetch()`.

**index**
_Array_

Array of values to index

**key**
_String_

Optional `Object` key to utilize as `Map` key, defaults to a version 4 `UUID` if not specified, or found

**source**
_String_

Optional `Object` key to retrieve data from API responses, see `setUri()`

**versioning**
_Boolean_

Enable/disable MVCC style versioning of records, default is `true`. Versions are stored in `Sets` for easy iteration.

### Properties
**data**
_Map_

`Map` of records, updated by `del()` & `set()`

**indexes**
_Map_

Map of indexes, which are Sets containing Map keys.

**registry**
_Array_

Array representing the order of **data**

**total**
_Number_

Total records in the DataStore

**uri**
_String_

URI of an API the DataStore is wired to, in a feedback loop (do not modify, use `setUri()`)

**versions**
_Map_

`Map` of `Sets` of records, updated by `set()`

### API
**batch( array, type )**
_Promise_

The first argument must be an `Array`, and the second argument must be `del` or `set`.

**clear()**
_self_

Removes all key/value pairs from the DataStore.

**del( key )**
_Promise_

Deletes the record.

**entries()**
_MapIterator_

Returns returns a new `Iterator` object that contains an array of `[key, value]` for each element in the `Map` object in insertion order.

**filter( callbackFn )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` for records which returned `true` to `callbackFn(value, key)`.

**find( where )**
_Tuple_

Returns a `Tuple` of double `Tuples` with found by indexed values matching the `where`.

**forEach( callbackFn[, thisArg] )**
_Undefined_

Calls `callbackFn` once for each key-value pair present in the `Map` object, in insertion order. If a `thisArg` parameter is provided to `forEach`, it will be used as the this value for each callback.

**get( key )**
_Tuple_

Gets the record as a double `Tuple` with the shape `[key, value]`.

**keys()**
_MapIterator_

Returns a new `Iterator` object that contains the keys for each element in the `Map` object in insertion order.`

**limit( start, offset )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` for the corresponding range of records.

**map( callbackFn )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` of records with the returned `value` of `callbackFn(value, key)`.

**reindex( [index] )**
_Haro_

Re-indexes the DataStore, to be called if changing the value of `index`.


**request( input, config )**
_Promise_

Returns a `Promise` for a `fetch()` with a double `Tuple` [`body`, `status`] as the `resolve()` argument.

**search( arg, index )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` of records found matching `arg`.
If `arg` is a `Function` a match is made if the result is `true`, if `arg` is a `RegExp` the field value must `.test()` as `true`, else the value must be an equality match. 

**set( key, data, batch=false )**
_Promise_

Returns a `Promise` for setting/amending a record in the DataStore, if `key` is `false` a version 4 `UUID` will be generated.

**setUri( uri )**
_Promise_

Returns a `Promise` for wiring the DataStore to an API, with the retrieved record set as the `resolve()` argument.

**sort( callbackFn )**
_Array_

Returns an Array of the DataStore, sorted by `callbackFn`.

**sortBy( index )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` of records sorted by an index.

**toArray()**
_Array_

Returns an Array of the DataStore.

**values()**
_MapIterator_

Returns a new `Iterator` object that contains the values for each element in the `Map` object in insertion order.

### Requirements
- `Map`
- `Promise`
- `Set`
- `fetch()`
- `tuple()` see [tiny-tuple](https://github.com/avoidwork/tiny-tuple) for loading in a browser

## License
Copyright (c) 2015 Jason Mulligan
Licensed under the BSD-3 license
