# haro

[![Join the chat at https://gitter.im/avoidwork/haro](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/avoidwork/haro?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

[![build status](https://secure.travis-ci.org/avoidwork/haro.svg)](http://travis-ci.org/avoidwork/haro)

Harō is a modern immutable DataStore built with ES6 features, which can be wired to an API for a complete feedback loop.
It is un-opinionated, and offers a plug'n'play solution to modeling, searching, & managing data on the client, or server
(in RAM). It is a [partially persistent data structure](https://en.wikipedia.org/wiki/Persistent_data_structure), by maintaining version sets of records in `versions` ([MVCC](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)).

Synchronous commands return instantly (`Array` or `Tuple`), while asynchronous commands return  `Promises` which will
resolve or reject in the future. This allows you to build complex applications without worrying about managing async 
code.

Harō indexes have the following structure `Map (field/property) > Map (value) > Set (PKs)` which allow for quick & easy 
searching, as well as inspection. Indexes can be managed independently of `del()` & `set()` operations, for example you 
can lazily create new indexes via `reindex(field)`, or `sortBy(field)`.

### Requirements
Harō is built with ES6+ features, and requires polyfills for ES5 or earlier environments.

- `Map`
- `Set`
- `Promise`
- `fetch()`
- `deferred()` see [tiny-defer](https://github.com/avoidwork/tiny-defer) for loading in a browser
- `tuple()` see [tiny-tuple](https://github.com/avoidwork/tiny-tuple) for loading in a browser

### How to use
Harō takes two optional arguments, the first is an `Array` of records to set asynchronously, & the second is a 
configuration descriptor.

```javascript
var storeDefaults = haro();
var storeRecords = haro([{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}]);
var storeCustom = haro(null, {key: 'id'});
```

### Persistent Storage
Harō is an in RAM only DataStore, so state could be lost if your program unexpectedly restarted, or some kind of 
machine failure were to occur. To handle this serious problem, Harō affords a 1-n relationship with persistent storage 
adapters. You can register one or many adapters, and data updates will asynchronously persist to the various long term 
storage systems.

DataStore records will be stored separate of the DataStore snapshot itself (if you decide to leverage it), meaning you 
are responsible for doing a `load()` & `save()` at startup & shutdown. This is a manual process because it could be a 
time bottleneck in the middle of using your application. Loading an individual record will update the DataStore with 
value from persistent storage.

DataStore snapshots & individual records can be removed from persistent storage with `unload()`; it is not recommended 
to do this for an individual record, and to instead rely on `del()`, but it's afforded because it may be required.

#### Creating an Adapter
Adapters are simple in nature (can be isomorphic), and pretty easy to create! Follow the template below, fill in the 
gaps for your adapter as needed, such as handling multiple connection pools, etc.. The input parameters should not be 
mutated. The return must be a `Promise`.

```javascript
"use strict";

const deferred = require("tiny-defer");

function adapter (store, op, key, data) {
	let defer = deferred(),
		record = key !== undefined,
		config = store.adapters.myAdapterName,
		prefix = config.prefix || store.id,
		lkey = prefix + (record ? "_" + key : "")),
		client = "Your driver instance";

	if (op === "get") {
		client.get(lkey, function (e, reply) {
			let result = JSON.parse(reply || null);

			if (e) {
				defer.reject(e);
			} else if (result) {
				defer.resolve(result);
			} else if (record) {
				defer.reject(new Error("Record not found in myAdapterName"));
			} else {
				defer.reject([]);
			}
		});
	} else if (op === "remove") {
		client.del(lkey, function (e) {
			if (e) {
				defer.reject(e);
			} else {
				defer.resolve(true);
			}
		});
	} else if (op === "set") {
		client.set(lkey, JSON.stringify(record ? data : store.toArray()), function (e) {
			if (e) {
				defer.reject(e);
			} else {
				defer.resolve(true);
			}
		});
	}

	return defer.promise;
}

module.exports = adapter;
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
time to load data: 523.421068ms
datastore record count: 15000
name indexes: 15000
testing time to 'find()' a record (first one is cold):
0.31272ms
0.123786ms
0.051086ms
0.053974ms
0.045515ms
testing time to 'search(regex, index)' for a record (first one is cold):
2.676046ms
1.760155ms
2.087627ms
1.558766ms
1.568192ms
```

### Configuration
**adapters**
_Object_

Object of {(storage): (connection string)} pairs. Collection/table name is the value of `this.id`.

Available adapters: _mongo_

Example of specifying MongoDB as persistent storage:
```javascript
var store = haro(null, {
  adapters: {
    mongo: "mongo://localhost/mine"
  }
});
```

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

**logging**
_Boolean_

Logs persistent storage messages to `console`, default is `true`.

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

**patch**
_Boolean_

Set from the success handler of `sync()`, infers `PATCH` requests are supported by the API collection.

**registry**
_Array_

Array representing the order of `this.data`.

**total**
_Number_

Total records in the DataStore.

**uri**
_String_

API collection URI the DataStore is wired to, in a feedback loop (do not modify, use `setUri()`). Setting the value creates an implicit relationship with records, e.g. setting `/users` would imply a URI structure of `/users/{key}`. Trailing slashes may be stripped.

**versions**
_Map_

`Map` of `Sets` of records, updated by `set()`.

### API
**batch( array, type )**
_Promise_

The first argument must be an `Array`, and the second argument must be `del` or `set`. Batch operations with a DataStore 
that is wired to an API with pagination enabled & `PATCH` support may create erroneous operations, such as `add` where
`replace` is appropriate; this will happen because the DataStore will not have the entire data set to generate it's 
[JSONPatch](http://jsonpatchjs.com/) request.

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

Returns returns a new `Iterator` object that contains an array of `[key, value]` for each element in the `Map` object in 
insertion order.

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

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` for records which returned `true` to 
`callbackFn(value, key)`.

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

Calls `callbackFn` once for each key-value pair present in the `Map` object, in insertion order. If a `thisArg` 
parameter is provided to `forEach`, it will be used as the this value for each callback.

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

**limit( max, offset=0 )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` for the corresponding range of records.

Example of paginating a data set:
```javascript
var store = haro(), ds1, ds2;

// Data is added

console.log(store.total); // >10
ds1 = store.limit(10);     // [0-9]
ds2 = store.limit(10, 10); // [10-19]

console.log(ds1.length === ds2.length); // true
console.log(JSON.stringify(ds1[0][1]) === JSON.stringify(ds2[0][1])); // false
```

**load( [adapter=mongo, key] )**
_Promise_

Loads the DataStore, or a record from a specific persistent storage & updates the DataStore. The DataStore will be cleared 
prior to loading if `key` is omitted.

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

**register( key, fn )**
_Haro_

Registers a persistent storage adapter.

Example of registering an adapter:
```javascript
var haro = require('haro'),
    store;

// Configure a store to utilize the adapter
store = haro(null, {
  adapters: {
    mongo: "mongo://localhost/mydb"
  }
});

// Register the adapter
store.register('mongo', require('haro-mongo'));
```

**request( input, config )**
_Promise_

Returns a `Promise` for a `fetch()` with a triple `Tuple` [`body`, `status`, `headers`] as the `resolve()` & `reject()` argument.

Example of mapping a DataStore:
```javascript
var store = haro();

store.request('https://somedomain.com/api').then(function (arg) {
  console.log(arg); // [body, status, headers]
}, function (arg) {
  console.error(arg[0]);
});
```

**save( [adapter] )**
_Promise_

Saves the DataStore to persistent storage.

**search( arg[, index=this.index] )**
_Tuple_

Returns a `Tuple` of double `Tuples` with the shape `[key, value]` of records found matching `arg`.
If `arg` is a `Function` (parameters are `value` & `index`) a match is made if the result is `true`, if `arg` is a `RegExp` the field value must `.test()` 
as `true`, else the value must be an identity match. The `index` parameter can be a `String` or `Array` of `Strings`; 
if not supplied it defaults to `this.index`.

Example of searching with a predicate function:
```javascript
var store = haro(null, {index: ['name', 'age']}),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function (records) {
 console.log(store.search(function (age) {
   return age < 30;
 }, 'age')); // [[$uuid, {name: 'Jane Doe', age: 28}]]
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**set( key, data, batch=false, override=false )**
_Promise_

Returns a `Promise` for setting/amending a record in the DataStore, if `key` is `false` a version 4 `UUID` will be 
generated.

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

Pagination can be implemented by conditionally supplying `true` as the second argument. Doing so will `clear()` the 
DataStore prior to a batch insertion.

If `PATCH` requests are supported by the collection `batch()`, `del()` & `set()` will make `JSONPatch` requests. If a 
`405` / `Method not Allowed` response occurs from a `PATCH` request, the DataStore will fallback to the appropriate 
method & disable `PATCH` for subsequent requests.

Example setting the URI of the DataStore:
```javascript
var store = haro(null, {key: 'id'});

store.setUri('https://api.somedomain.com').then(function (records) {
  console.log(records); // [[$id, {...}], ...]
}, function (arg) {
  console.error(arg[0]); // [body, statusCode]
});
```

Example of pagination, by specifying `clear`:
```javascript
var store = haro(null, {key: 'id'});

store.setUri('https://api.somedomain.com?page=1').then(function (records) {
  console.log(records); // [[$id, {...}], ...]
}, function (arg) {
  console.log(arg[0]); // [body, statusCode]
});

// Later, based on user interaction, change the page
store.setUri('https://api.somedomain.com?page=2', true).then(function (records) {
  console.log(records); // [[$id, {...}], ...]
}, function (arg) {
  console.error(arg[0]); // [body, statusCode]
});
```

**sort( callbackFn, [frozen = true] )**
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
}, function (e) {
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
}, function (e) {
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
}, function (arg) {
  console.error(arg[0]); // [body, statusCode]
});

// Synchronizing the store every minute
interval = setInterval(function () {
  store.sync();
}, 60000);
```

**toArray( [data, freeze=true] )**
_Array_

Returns an Array of the DataStore, or a subset.

Example of casting to an `Array`:
```javascript
var store = haro(),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function (records) {
  console.log(store.toArray()); // [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}]
  console.log(store.toArray(store.limit(1))); // [{name: 'John Doe', age: 30}]
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**toObject( [data, freeze=true] )**
_Object_

Returns an Object of the DataStore.

Example of casting to an `Object`:
```javascript
var store = haro(null, {key: 'guid'}),
   data = [{guid: 'abc', name: 'John Doe', age: 30}, {guid: 'def', name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function (records) {
  console.log(store.toObject()); // {abc: {guid: 'abc', name: 'John Doe', age: 30}, def: {guid: 'def', name: 'Jane Doe', age: 28}}
  console.log(store.toObject(store.limit(1)); // {abc: {guid: 'abc', name: 'John Doe', age: 30}}}
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**unload( [adapter=mongo, key] )**
_Promise_

Unloads the DataStore, or a record from a specific persistent storage (delete).

**unregister( key )**
_Haro_

Un-registers a persistent storage adapter.

Example of unregistering an adapter:
```javascript
var haro = require('haro'),
    store;

// Register the adapter
haro.register('mongo', require('haro-mongo'));

// Configure a store to utilize the adapter
store = haro(null, {
  adapters: {
    mongo: "mongo://localhost/mydb"
  }
});

// Later...
store.unregister('haro');
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
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

## License
Copyright (c) 2015 Jason Mulligan
Licensed under the BSD-3 license
