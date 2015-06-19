# haro
Harō is a modern immutable DataStore that can be wired to an API. It is a
partially persistent data structure, by maintaining version sets of records in `versions`.

[![build status](https://secure.travis-ci.org/avoidwork/haro.svg)](http://travis-ci.org/avoidwork/haro)

### Example
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

### Configuration
**config**
_Object_

Default settings for `fetch()`.

**key**
_String_

Optional `Object` key to utilize as `Map` key, defaults to a version 4 `UUID` if not specified, or found

**source**
_String_

Optional `Object` key to retrieve data from API responses, see `setUri()`

### Properties
**data**
_Map_

`Map` of records, updated by `del()` & `set()`

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

**request( input, config )**
_Promise_

Returns a `Promise` for a `fetch()` with a double `Tuple` [`body`, `status`] as the `resolve()` argument.

**set( key, data, batch=false )**
_Promise_

Returns a `Promise` for setting/amending a record in the DataStore, if `key` is `false` a version 4 `UUID` will be generated.

**setUri( uri )**
_Promise_

Returns a `Promise` for wiring the DataStore to an API, with the retrieved record set as the `resolve()` argument.

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
