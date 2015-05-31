# haro
Harō is modern DataStore that can be wired to an API, & provides a simple feedback loop with `Promises`.

[![build status](https://secure.travis-ci.org/avoidwork/haro.svg)](http://travis-ci.org/avoidwork/haro)

### Example
```javascript
var store = haro();

console.log(store.total); // 0

store.set(null, {abc: true}).then(function (arg) {
  var id = arg[0];

  console.log(arg); // ["ae3b34bd-8725-43e6-98a8-bf783bae6d71", {abc: true}];
  console.log(store.total); // 1

  store.set(id, {abc: false}).then(function (arg) {
    console.log(arg); // ["ae3b34bd-8725-43e6-98a8-bf783bae6d71", {abc: false}];

    store.del(id).then(function () {
      console.log(store.total); // 0;
    });
  });
});
```

### Configuration
**config**
_Object_

Default settings for `fetch()`. You must manually enable `CORS` mode!

**key**
_String_

Optional `Object` key to utilize as `Map` key, defaults to a version 4 `UUID` if not specified, or found

**source**
_String_

Optional `Object` key to retrieve data from API responses, see `setUri()`

### Properties
**total**
_Number_

Total records in the DataStore

**uri**
_String_

URI of an API the DataStore is wired to, in a feedback loop (do not modify, use `setUri()`)

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

Returns returns a new Iterator object that contains an array of [key, value] for each element in the Map object in insertion order.

**forEach(fn[, thisArg])**
_Undefined_

Calls callbackFn once for each key-value pair present in the Map object, in insertion order. If a thisArg parameter is provided to forEach, it will be used as the this value for each callback.

**get( key )**
_Tuple_

Gets the record as a double `Tuple` with the shape `[key, data]`.

**keys()**
__Iterator__

Returns a new Iterator object that contains the keys for each element in the Map object in insertion order.Returns a new Iterator object that contains the keys for each element in the Map object in insertion order.

**limit( start, offset )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, data]` for the corresponding range of records.

**request( input, config )**
_Promise_

Returns a `Promise` for a `fetch()` with a coerced response body (JSON or text) as the `resolve()` argument.

**set( key, data, batch=false )**
_Promise_

Returns a `Promise` for setting/amending a record in the DataStore, if `key` is `false` a version 4 `UUID` will be generated.

**setUri( uri )**
_Promise_

Returns a `Promise` for wiring the DataStore to an API, with the retrieved record set as the `resolve()` argument.

**values()**
_Iterator_

Returns a new Iterator object that contains the values for each element in the Map object in insertion order.

### Requirements
- `Map`
- `Promise`
- `fetch()`
- `tuple()` see [tiny-tuple](https://github.com/avoidwork/tiny-tuple) for loading in a browser

## License
Copyright (c) 2015 Jason Mulligan
Licensed under the BSD-3 license
