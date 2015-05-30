# haro
Harō is modern DataStore that can be wired to an API, & provides a simple feedback loop with `Promises`!

[![build status](https://secure.travis-ci.org/avoidwork/haro.svg)](http://travis-ci.org/avoidwork/haro)

### Example
```javascript
var store = haro();

store.set(null, {abc: true}).then(function (arg) {
  console.log(arg); // ["ae3b34bd-8725-43e6-98a8-bf783bae6d71", {abc: true}];
});
```

### Configuration
_config_
Object

Default settings for `fetch()`. You must manually enable `CORS` mode!

_key_
String

Optional `Object` key to utilize as `Map` key, defaults to a version 4 `UUID` if not specified, or found

_source_
String

Optional `Object` key to retrieve data from API responses, see `setUri()`

### Properties
_total_
Number

Total records in the DataStore

_uri_
String

URI of an API the DataStore is wired to, in a feedback loop (do not modify, use `setUri()`)

### API
_batch( array, type )_
Promise

The first argument must be an `Array`, and the second argument must be `del` or `set`

_del( key )_
Promise

Deletes the record

_get( key )_
Tuple

Gets the record as a double `Tuple` with the shape `[key, data]` 

_range( start, end )_
Tuple

Gets a `Tuple` of double `Tuples` with the shape `[key, data]` for the corresponding range of records

_request( input, config )_
Promise

Returns a `Promise` for a `fetch()` with a coerced response body (JSON or text) as the `resolve()` argument

_set( key, data, batch=false )_
Promise

Returns a `Promise` for setting/amending a record in the DataStore, if `key` is `false` a version 4 `UUID` will be generated

_setUri( uri )_
Promise

Returns a `Promise` for wiring the DataStore to an API, with the retrieved record set as the `resolve()` argument

### Requirements
- `Map`
- `Promise`
- `fetch()`
- `tuple()` see [tiny-tuple](https://github.com/avoidwork/tiny-tuple) for loading in a browser

## License
Copyright (c) 2015 Jason Mulligan
Licensed under the BSD-3 license
