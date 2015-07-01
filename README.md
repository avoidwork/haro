# haro

[![build status](https://secure.travis-ci.org/avoidwork/haro.svg)](http://travis-ci.org/avoidwork/haro)

Harō is a modern immutable DataStore built with ES6 features, which can be wired to an API for a complete feedback loop.
It is un-opinionated, and offers a plug'n'play solution to modeling, searching, & managing data on the client, or server 
(in RAM). It is a [partially persistent data structure](https://en.wikipedia.org/wiki/Persistent_data_structure), by maintaining version sets of records in `versions` ([MVCC](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)).

Synchronous commands return instantly (`Array` or `Tuple`), while asynchronous commands return  `Promises` which will
resolve or reject in the future. This allows you to build complex applications without worrying about managing async code.

Harō indexes have the following structure `Map (field/property) > Map (value) > Set (PKs)` which allow for quick & easy searching, as well as inspection.
Indexes can be managed independently of `del()` & `set()` operations, for example you can lazily create new indexes via `reindex(field)`, or `sortBy(field)`.

### How to use
Harō takes two optional arguments, the first is an `Array` of records to set asynchronously, & the second is a configuration descriptor.

```javascript
var storeDefaults = haro();
var storeRecords = haro([{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}]);
var storeCustom = haro(null, {key: 'id'});
```

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

### Benchmarked
A benchmark is included in the repository, and is useful for gauging how haro will perform on different hardware, & software.
Please consider that `batch()`, & `set()` use `Promises` and incur time as a cost. The following results are from an Apple
MacBook Air (Early 2014) / 8GB RAM / 512GB SSD / OS X Yosemite:

```
time to load data: 595.13794ms
datastore record count: 15000
name indexes: 15000
testing time to 'find()' a record (first one is cold):
0.333202ms
0.15953ms
0.091702ms
0.091607ms
0.077321ms
testing time to 'search(regex, index)' for a record (first one is cold):
2.22693ms
1.339148ms
1.59494ms
1.28051ms
1.191318ms
```

### Configuration
**config**
_Object_

Default settings for `fetch()`.

Example of specifying a bearer token authorization header:
```javascript
var store = haro(null, {
  config: {
    headers: {
      authorization: 'Bearer abcdef'
    }
  });
```

**index**
_Array_

Array of values to index. Composite indexes are supported, by using the default delimiter (`this.delimiter`).
Non-matches within composites result in blank values.

Example of fields/properties to index:
```javascript
var store = haro(null, {index: ['field1', 'field2', 'field1|field2|field3']);
```

**key**
_String_

Optional `Object` key to utilize as `Map` key, defaults to a version 4 `UUID` if not specified, or found.

Example of specifying the primary key:
```javascript
var store = haro(null, {key: 'field'});
```

**source**
_String_

Optional `Object` key to retrieve data from API responses, see `setUri()`.

Example of specifying the source of data:
```javascript
var store = haro(null, {source: 'data'});
```

**versioning**
_Boolean_

Enable/disable MVCC style versioning of records, default is `true`. Versions are stored in `Sets` for easy iteration.

Example of disabling versioning:
```javascript
var store = haro(null, {versioning: false});
```

### Properties
**data**
_Map_

`Map` of records, updated by `del()` & `set()`.

**indexes**
_Map_

Map of indexes, which are Sets containing Map keys.

**registry**
_Array_

Array representing the order of `this.data`.

**total**
_Number_

Total records in the DataStore.

**uri**
_String_

API collection URI the DataStore is wired to, in a feedback loop (do not modify, use `setUri()`). Setting the value creates an implicit relationship with records, e.g. setting `/users` would an implicit URI structure of `/users/{key}`

**versions**
_Map_

`Map` of `Sets` of records, updated by `set()`.

### API
**batch( array, type )**
_Promise_

The first argument must be an `Array`, and the second argument must be `del` or `set`.

```javascript
var haro = require('haro'),
    store = haro(null, {key: 'id', index: ['name']}),
    i = -1,
    nth = 100,
    data = [];

while (++i < nth) {
  data.push({id: i, name: 'John Doe' + i});
}

store.batch(data, 'set').then(function(records) {
  // records is a Tuple of Tuples
}, function (e) {
  console.error(e.stack);
});
```

**clear()**
_self_

Removes all key/value pairs from the DataStore.

Example of clearing a DataStore:
```javascript
var store = haro();

// Data is added

store.clear();
```

**del( key )**
_Promise_

Deletes the record.

Example of deleting a record:
```javascript
var store = haro();

store.set(null, {abc: true}).then(function (rec) {
  return store.del(rec[0]);
}, function (e) {
  throw e;
}).then(function () {
  console.log(store.total); // 0
}, function (e) {
  console.error(e.stack);
});
```

**entries()**
_MapIterator_

Returns returns a new `Iterator` object that contains an array of `[key, value]` for each element in the `Map` object in insertion order.

Example of deleting a record:
```javascript
var store = haro(),
    item, iterator;

// Data is added

iterator = store.entries();
item = iterator.next();

do {
  console.log(item.value);
  item = iterator.next();
} while (!item.done);
```

**filter( callbackFn )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` for records which returned `true` to `callbackFn(value, key)`.

Example of filtering a DataStore:
```javascript
var store = haro();

// Data is added

store.filter(function (value) {
  return value.something === true;
});
```

**find( where )**
_Tuple_

Returns a `Tuple` of double `Tuples` with found by indexed values matching the `where`.

Example of finding a record(s) with an identity match:
```javascript
var store = haro(null, {index: ['field1']});

// Data is added

store.find({field1: 'some value'});
```

**forEach( callbackFn[, thisArg] )**
_Undefined_

Calls `callbackFn` once for each key-value pair present in the `Map` object, in insertion order. If a `thisArg` parameter is provided to `forEach`, it will be used as the this value for each callback.

Example of deleting a record:
```javascript
var store = haro();

store.set(null, {abc: true}).then(function (rec) {
  store.forEach(function (value, key) {
    console.log(key);
  });
}, function (e) {
  console.error(e.stack);
});
```

**get( key )**
_Tuple_

Gets the record as a double `Tuple` with the shape `[key, value]`.

Example of getting a record with a known primary key value:
```javascript
var store = haro();

// Data is added

store.get('keyValue');
```

**keys()**
_MapIterator_

Returns a new `Iterator` object that contains the keys for each element in the `Map` object in insertion order.`

Example of getting an iterator, and logging the results:
```javascript
var store = haro(),
    item, iterator;

// Data is added

iterator = store.keys();
item = iterator.next();

do {
  console.log(item.value);
  item = iterator.next();
} while (!item.done);
```

**limit( start, offset )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` for the corresponding range of records.

Example of paginating a data set:
```javascript
var store = haro(), ds1, ds2;

// Data is added

console.log(store.total); // >10
ds1 = store.limit(10, 0);
ds2 = store.limit(10, 10);

console.log(ds1.length === ds2.length); // true
console.log(JSON.stringify(ds1[0][1]) === JSON.stringify(ds2[0][1])); // false
```

**map( callbackFn )**
_Tuple_

Returns a `Tuple` of the returns of `callbackFn(value, key)`.

Example of mapping a DataStore:
```javascript
var store = haro();

// Data is added

store.map(function (value) {
  return value.property;
});
```

**reindex( [index] )**
_Haro_

Re-indexes the DataStore, to be called if changing the value of `index`.

Example of mapping a DataStore:
```javascript
var store = haro();

// Data is added

// Creating a late index
store.index('field3');

// Recreating indexes, this should only happen if the store is out of sync caused by developer code.
store.index();
```


**request( input, config )**
_Promise_

Returns a `Promise` for a `fetch()` with a double `Tuple` [`body`, `status`] as the `resolve()` argument.

Example of mapping a DataStore:
```javascript
var store = haro();

store.request('https://somedomain.com/api').then(function (res) {
  console.log(res); // [body, status, headers]
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**search( arg, index )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` of records found matching `arg`.
If `arg` is a `Function` a match is made if the result is `true`, if `arg` is a `RegExp` the field value must `.test()` as `true`, else the value must be an equality match.

Example of searching with a predicate function:
```javascript
var store = haro(null, {index: ['name', 'age']}),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function (records) {
 console.log(store.search(function (age) {
   return age < 30;
 }, 'age')); // [[$uuid, {name: 'Jane Doe', age: 28}]]
}).catch(function (e) {
 console.error(e.stack || e.message || e);
});
```

**set( key, data, batch=false, override=false )**
_Promise_

Returns a `Promise` for setting/amending a record in the DataStore, if `key` is `false` a version 4 `UUID` will be generated.

If `override` is `true`, the existing record will be replaced instead of amended.

Example of creating a record:
```javascript
var store = haro(null, {key: 'id'});

store.set(null, {id: 1, name: 'John Doe'}).then(function (record) {
  console.log(record); // [1, {id: 1, name: 'Jane Doe'}]
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**setUri( uri, clear=false )**
_Promise_

Returns a `Promise` for wiring the DataStore to an API, with the retrieved record set as the `resolve()` argument. This
creates an implicit mapping of `$uri/{key}` for records.

Pagination can be implemented by conditionally supplying `true` as the second argument. Doing so will `clear()` the DataStore 
prior to a batch insertion.

Example setting the URI of the DataStore:
```javascript
var store = haro(null, {key: 'id'});

store.setUri('https://api.somedomain.com').then(function (records) {
 console.log(records); // [[$id, {...}], ...]
}).catch(function (e) {
 console.error(e.stack || e.message || e);
});

Example of pagination, by specifying `clear`:
```javascript
var store = haro(null, {key: 'id'});

store.setUri('https://api.somedomain.com?page=1').then(function (records) {
 console.log(records); // [[$id, {...}], ...]
}).catch(function (e) {
 console.error(e.stack || e.message || e);
});

// Later, based on user interaction, change the page
store.setUri('https://api.somedomain.com?page=2', true).then(function (records) {
 console.log(records); // [[$id, {...}], ...]
}).catch(function (e) {
 console.error(e.stack || e.message || e);
});
```

**sort( callbackFn )**
_Array_

Returns an Array of the DataStore, sorted by `callbackFn`.

Example of sorting like an `Array`:
```javascript
var store = haro(null, {index: ['name', 'age']}),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function (records) {
 console.log(store.sort(function (a, b) {
   return a < b ? -1 : (a > b ? 1 : 0);
 })); // [{name: 'Jane Doe', age: 28}, {name: 'John Doe', age: 30}]
}).catch(function (e) {
 console.error(e.stack || e.message || e);
});
```

**sortBy( index )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` of records sorted by an index.

Example of sorting by an index:
```javascript
var store = haro(null, {index: ['name', 'age']}),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function (records) {
 console.log(store.sortBy('age')); // [[$uuid, {name: 'Jane Doe', age: 28}], [$uuid, {name: 'John Doe', age: 30}]]
}).catch(function (e) {
 console.error(e.stack || e.message || e);
});
```

**sync( clear=false )**
_Promise_

Synchronises the DataStore with an API collection. If `clear` is `true`, the DataStore will have `clear()` executed
prior to `batch()` upon a successful retrieval of data.

Example of sorting by an index:
```javascript
var store = haro(null, {key: 'id'}),
    interval;

store.setUri('https://api.somedomain.com').then(function (records) {
 console.log(records); // [[$id, {...}], ...]
}).catch(function (e) {
 console.error(e.stack || e.message || e);
});

// Synchronizing the store every minute
interval = setInterval(function () {
  store.sync();
}, 60000);
```

**toArray()**
_Array_

Returns an Array of the DataStore.

Example of casting to an `Array`:
```javascript
var store = haro(),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function (records) {
 console.log(store.toArray()); // [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}]
}).catch(function (e) {
 console.error(e.stack || e.message || e);
});
```

**values()**
_MapIterator_

Returns a new `Iterator` object that contains the values for each element in the `Map` object in insertion order.

Example of iterating the values:
```javascript
var store = haro(),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function (records) {
 var iterator = store.values(),
     item = iterator.next();

 do {
   console.log(item.value);
   item = iterator.next();
 } while (!item.done);
}).catch(function (e) {
 console.error(e.stack || e.message || e);
});
```

### Requirements
- `Map`
- `Promise`
- `Set`
- `fetch()`
- `tuple()` see [tiny-tuple](https://github.com/avoidwork/tiny-tuple) for loading in a browser

## License
Copyright (c) 2015 Jason Mulligan
Licensed under the BSD-3 license
