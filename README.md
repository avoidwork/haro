# haro

[![build status](https://secure.travis-ci.org/avoidwork/haro.svg)](http://travis-ci.org/avoidwork/haro)

Harō is a modern immutable DataStore built with ES6 features, which can be wired to an API for a complete feedback loop.
It is un-opinionated, and offers a plug'n'play solution to modeling, searching, & managing data on the client, or server
(in RAM). It is a [partially persistent data structure](https://en.wikipedia.org/wiki/Persistent_data_structure), by maintaining version sets of records in `versions` ([MVCC](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)).

Synchronous commands return an `Array` instantly, while asynchronous commands return  `Promises` which will
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
- `Array.from()` & `Array.is()`
- `fetch()`

### How to use
Harō takes two optional arguments, the first is an `Array` of records to set asynchronously, & the second is a 
configuration descriptor.

```javascript
const storeDefaults = haro();
const storeRecords = haro([{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}]);
const storeCustom = haro(null, {key: 'id'});
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

function adapter (store, op, key, data) {
	return new Promise((resolve, reject) => {
		const record = key !== undefined,
			config = store.adapters.myAdapterName,
			prefix = config.prefix || store.id,
			lkey = prefix + (record ? "_" + key : ""),
			client = "Your driver instance";

		if (op === "get") {
			client.get(lkey, function (e, reply) {
				let result = JSON.parse(reply || null);

				if (e) {
					reject(e);
				} else if (result) {
					resolve(result);
				} else if (record) {
					reject(new Error("Record not found in myAdapterName"));
				} else {
					reject([]);
				}
			});
		} else if (op === "remove") {
			client.del(lkey, function (e) {
				if (e) {
					reject(e);
				} else {
					resolve(true);
				}
			});
		} else if (op === "set") {
			client.set(lkey, JSON.stringify(record ? data : store.toArray()), function (e) {
				if (e) {
					reject(e);
				} else {
					resolve(true);
				}
			});
		}
	});
}

module.exports = adapter;
```

### Examples
#### Piping Promises
```javascript
const store = haro();

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
const store = haro(null, {index: ['name', 'age']}),
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
const store = haro();

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
Please consider that `batch()`, & `set()` use `Promises` and incur time as a cost.

```
Batch successful on test
time to batch insert data: 58.500052ms
datastore record count: 1000
name indexes: 1000

testing time to 'find()' a record (first one is cold):
0.194559ms
0.030232ms
0.009265ms
0.006583ms
0.005852ms

testing time to 'search(regex, index)' for a record (first one is cold):
0.720213ms
0.160183ms
0.114591ms
0.110933ms
0.112396ms

time to override data: 5.041485ms
testing time to 'search(regex, index)' on overridden data for a record (first one is cold):
0.129219ms
0.113127ms
0.106789ms
0.105081ms
0.104594ms
```

### Configuration
**adapters**
_Object_

Object of {(storage): (connection string)} pairs. Collection/table name is the value of `this.id`.

Available adapters: _mongo_

Example of specifying MongoDB as persistent storage:
```javascript
const store = haro(null, {
  adapters: {
    mongo: "mongo://localhost/mine"
  }
});
```

**beforeBatch**
_Function_

Event listener for before a batch operation, receives `type`, `data`.

**beforeClear**
_Function_

Event listener for before clearing the data store.

**beforeDelete**
_Function_

Event listener for before a record is deleted, receives `key`, `batch`.

**beforeRequest**
_Function_

Event listener for transforming an API response, receives `uri`, `config`.

**beforeSet**
_Function_

Event listener for before a record is set, receives `key`, `data`.

**beforeSync**
_Function_

Event listener for synchronizing with an API, receives `uri`, `clear`.

**config**
_Object_

Default settings for `fetch()`.

Example of specifying a bearer token authorization header:
```javascript
const store = haro(null, {
  config: {
    headers: {
      authorization: 'Bearer abcdef'
    }
  }});
```

**debounce**
_Number_

Optional `Number` of milliseconds to debounce changes transmitted over the wire, defaults to `0`.

Example of specifying a 250ms debounce:
```javascript
const store = haro(null, {debounce: 250});
```

**index**
_Array_

Array of values to index. Composite indexes are supported, by using the default delimiter (`this.delimiter`).
Non-matches within composites result in blank values.

Example of fields/properties to index:
```javascript
const store = haro(null, {index: ['field1', 'field2', 'field1|field2|field3']});
```

**key**
_String_

Optional `Object` key to utilize as `Map` key, defaults to a version 4 `UUID` if not specified, or found.

Example of specifying the primary key:
```javascript
const store = haro(null, {key: 'field'});
```

**logging**
_Boolean_

Logs persistent storage messages to `console`, default is `true`.

**onbatch**
_Function_

Event listener for a batch operation, receives two arguments ['type', `Array`].

**onclear**
_Function_

Event listener for clearing the data store.

**ondelete**
_Function_

Event listener for when a record is deleted, receives the record key.

**onerror**
_Function_

Event listener for errors which occur during common operations, receives two arguments ['type', `Error`]

**onrequest**
_Function_

Event listener for transforming an API response, receives `body`, `status` & `headers`.

**onset**
_Function_

Event listener for when a record is set, receives an `Array`.

**onsync**
_Function_

Event listener for synchronizing with an API, receives an `Array` of `Arrays`.

**source**
_String_

Optional `Object` key to retrieve data from API responses, see `setUri()`.

Example of specifying the source of data:
```javascript
const store = haro(null, {source: 'data'});
```

**versioning**
_Boolean_

Enable/disable MVCC style versioning of records, default is `false`. Versions are stored in `Sets` for easy iteration.

Example of enabling versioning:
```javascript
const store = haro(null, {versioning: true});
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

**size**
_Number_

Total records in the DataStore.

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
**batch(array, type)**
_Promise_

The first argument must be an `Array`, and the second argument must be `del` or `set`. Batch operations with a DataStore
that is wired to an API with pagination enabled & `PATCH` support may create erroneous operations, such as `add` where
`replace` is appropriate; this will happen because the DataStore will not have the entire data set to generate it's
[JSONPatch](http://jsonpatchjs.com/) request.

```javascript
const haro = require('haro'),
    store = haro(null, {key: 'id', index: ['name']}),
    nth = 100,
    data = [];

let i = -1;

while (++i < nth) {
  data.push({id: i, name: 'John Doe' + i});
}

store.batch(data, 'set').then(function(records) {
  // records is an Array of Arrays
}, function (e) {
  console.error(e.stack);
});
```

**clear()**
_self_

Removes all key/value pairs from the DataStore.

Example of clearing a DataStore:
```javascript
const store = haro();

// Data is added

store.clear();
```

**del(key)**
_Promise_

Deletes the record.

Example of deleting a record:
```javascript
const store = haro();

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

**dump(type="records")**
_Array_ or _Object_

Returns the records or indexes of the DataStore as mutable `Array` or `Object`, for the intention of reuse/persistent storage without relying on an adapter which would break up the data set.

```javascript
const store = haro();

// Data is loaded

const records = store.dump();
const indexes = store.dump('indexes');

// Save records & indexes
```

**entries()**
_MapIterator_

Returns returns a new `Iterator` object that contains an array of `[key, value]` for each element in the `Map` object in
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

**filter(callbackFn[, raw=false])**
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

**find(where[, raw=false])**
_Array_

Returns an `Array` of double `Arrays` with found by indexed values matching the `where`.

Example of finding a record(s) with an identity match:
```javascript
const store = haro(null, {index: ['field1']});

// Data is added

store.find({field1: 'some value'});
```

**forEach(callbackFn[, thisArg])**
_Undefined_

Calls `callbackFn` once for each key-value pair present in the `Map` object, in insertion order. If a `thisArg`
parameter is provided to `forEach`, it will be used as the this value for each callback.

Example of deleting a record:
```javascript
const store = haro();

store.set(null, {abc: true}).then(function (rec) {
  store.forEach(function (value, key) {
    console.log(key);
  });
}, function (e) {
  console.error(e.stack);
});
```

**get(key[, raw=false])**
_Array_

Gets the record as a double `Array` with the shape `[key, value]`.

Example of getting a record with a known primary key value:
```javascript
const store = haro();

// Data is added

store.get('keyValue');
```

**has(key)**
_Boolean_

Returns a `Boolean` indicating if the data store contains `key`.

Example of checking for a record with a known primary key value:
```javascript
const store = haro();

// Data is added

store.has('keyValue'); // true or false
```

**join(other, on[, type="inner", where=[]])**
_Promise_

Joins `this` instance of `Haro` with another, on a field/property. Supports "inner", "left", & "right" JOINs. Resulting
composite records implement a `storeId_field` convention for fields/properties. The optional forth parameter is an Array
which can be used for WHERE clauses, similar to `find()`, `[store1, store2]`.

```javascript
const store1 = haro([{id: "abc", name: "jason", age: 35}, {id: "def", name: "jen", age: 31}], {id: 'users', key: 'id', index: ['name', 'age']});
const store2 = haro([{id: 'ghi', user: "abc", value: 40}], {id: 'values', key: 'id', index: ['user', 'value']});

// Join results
store1.join(store2, "user", "inner").then(function (records) {
  console.log(records);
  // [{"users_id":"abc","users_name":"jason","users_age":35,"values_id":"ghi","values_user":"abc","values_value":40}]
}, function (e) {
  console.error(e.stack || e.message || e);
});

store1.join(store2, "user", "inner", [{age: 31}]).then(function (records) {
  console.log(records);
  // []
}, function (e) {
  console.error(e.stack || e.message || e);
});

store1.join(store2, "user", "left").then(function (records) {
  console.log(records);
  // [{"users_id":"abc","users_name":"jason","users_age":35,"values_id":"ghi","values_user":"abc","values_value":40},
  //  {"users_id":"def","users_name":"jen","users_age":31,"values_id":null,"values_user":null,"values_value":null}]
}, function (e) {
  console.error(e.stack || e.message || e);
});

store1.join(store2, "user", "right").then(function (records) {
  console.log(records);
  // [{"values_id":"ghi","values_user":"abc","values_value":40,"users_id":"abc","users_name":"jason","users_age":35}]
}, function (e) {
  console.error(e.stack || e.message || e);
});

```

**keys()**
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

**limit(offset=0, max=0, raw=false)**
_Array_

Returns an `Array` of double `Arrays` with the shape `[key, value]` for the corresponding range of records.

Example of paginating a data set:
```javascript
const store = haro();

let ds1, ds2;

// Data is added

console.log(store.total);  // >10
ds1 = store.limit(0, 10);  // [0-9]
ds2 = store.limit(10, 10); // [10-19]

console.log(ds1.length === ds2.length); // true
console.log(JSON.stringify(ds1[0][1]) === JSON.stringify(ds2[0][1])); // false
```

**load([adapter="mongo", key])**
_Promise_

Loads the DataStore, or a record from a specific persistent storage & updates the DataStore. The DataStore will be cleared
prior to loading if `key` is omitted.

**map(callbackFn, raw=false)**
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

**offload(data[, cmd="index", index=this.index])**
_Promise_

Returns a `Promise` for an offloaded work load, such as preparing indexes in a `Worker`. This method is ideal for dealing
with large data sets which could block a UI thread. This method requires `Blob` & `Worker`.

Example of offloading index creation:
```javascript
const store = haro(null, {index: ['name', 'age'], key: 'guid'}),
    data = [{guid: 'abc', name: 'Jason Mulligan', age: 35}];

store.offload(data).then(function (args) {
  store.override(data);
  store.override(args, 'indexes');
}, function (e) {
  console.error(e);
});
```

**override(data[, type="records", fn])**
_Promise_

Returns a `Promise` for the new state. This is meant to be used in a paired override of the indexes & records, such that
you can avoid the `Promise` based code path of a `batch()` insert or `load()`. Accepts an optional third parameter to perform the
transformation to simplify cross domain issues.

Example of overriding a DataStore:
```javascript
const store = haro();

store.override({'field': {'value': ['pk']}}, "indexes").then(function () {
 // Indexes have been overridden, no records though! override as well?
}, function (e) {
  console.error(e.stack);
});
```

**reindex([index])**
_Haro_

Re-indexes the DataStore, to be called if changing the value of `index`.

Example of mapping a DataStore:
```javascript
const store = haro();

// Data is added

// Creating a late index
store.index('field3');

// Recreating indexes, this should only happen if the store is out of sync caused by developer code.
store.index();
```

**register(key, fn)**
_Haro_

Registers a persistent storage adapter.

Example of registering an adapter:
```javascript
const haro = require('haro'),
    store = haro(null, {
      adapters: {
        mongo: "mongo://localhost/mydb"
      }
    });

// Register the adapter
store.register('mongo', require('haro-mongo'));
```

**request(input, config)**
_Promise_

Returns a `Promise` for a `fetch()` with a triple `Array` [`body`, `status`, `headers`] as the `resolve()` & `reject()` argument.

Example of mapping a DataStore:
```javascript
const store = haro();

store.request('https://somedomain.com/api').then(function (arg) {
  console.log(arg); // [body, status, headers]
}, function (arg) {
  console.error(arg[0]);
});
```

**save([adapter])**
_Promise_

Saves the DataStore to persistent storage.

**search(arg[, index=this.index, raw=false])**
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

store.batch(data, 'set').then(function () {
 console.log(store.search(function (age) {
   return age < 30;
 }, 'age')); // [[$uuid, {name: 'Jane Doe', age: 28}]]
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**set(key, data, batch=false, override=false)**
_Promise_

Returns a `Promise` for setting/amending a record in the DataStore, if `key` is `false` a version 4 `UUID` will be
generated.

If `override` is `true`, the existing record will be replaced instead of amended.

Example of creating a record:
```javascript
const store = haro(null, {key: 'id'});

store.set(null, {id: 1, name: 'John Doe'}).then(function (record) {
  console.log(record); // [1, {id: 1, name: 'Jane Doe'}]
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**setUri(uri, clear=false)**
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
const store = haro(null, {key: 'id'});

store.setUri('https://api.somedomain.com').then(function (records) {
  console.log(records); // [[$id, {...}], ...]
}, function (arg) {
  console.error(arg[0]); // [body, statusCode]
});
```

Example of pagination, by specifying `clear`:
```javascript
const store = haro(null, {key: 'id'});

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

**sort(callbackFn, [frozen = true])**
_Array_

Returns an Array of the DataStore, sorted by `callbackFn`.

Example of sorting like an `Array`:
```javascript
const store = haro(null, {index: ['name', 'age']}),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function () {
  console.log(store.sort(function (a, b) {
    return a < b ? -1 : (a > b ? 1 : 0);
  })); // [{name: 'Jane Doe', age: 28}, {name: 'John Doe', age: 30}]
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**sortBy(index[, raw=false])**
_Array_

Returns an `Array` of double `Arrays` with the shape `[key, value]` of records sorted by an index.

Example of sorting by an index:
```javascript
const store = haro(null, {index: ['name', 'age']}),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function () {
  console.log(store.sortBy('age')); // [[$uuid, {name: 'Jane Doe', age: 28}], [$uuid, {name: 'John Doe', age: 30}]]
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**sync(clear=false)**
_Promise_

Synchronises the DataStore with an API collection. If `clear` is `true`, the DataStore will have `clear()` executed
prior to `batch()` upon a successful retrieval of data.

Example of sorting by an index:
```javascript
const store = haro(null, {key: 'id'});

let interval;

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

**toArray([data, freeze=true])**
_Array_

Returns an Array of the DataStore, or a subset.

Example of casting to an `Array`:
```javascript
const store = haro(),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function () {
  console.log(store.toArray()); // [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}]
  console.log(store.toArray(store.limit(1))); // [{name: 'John Doe', age: 30}]
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**toObject([data, freeze=true])**
_Object_

Returns an Object of the DataStore.

Example of casting to an `Object`:
```javascript
const store = haro(null, {key: 'guid'}),
   data = [{guid: 'abc', name: 'John Doe', age: 30}, {guid: 'def', name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function () {
  console.log(store.toObject()); // {abc: {guid: 'abc', name: 'John Doe', age: 30}, def: {guid: 'def', name: 'Jane Doe', age: 28}}
  console.log(store.toObject(store.limit(1))); // {abc: {guid: 'abc', name: 'John Doe', age: 30}}}
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**transform(input[, fn])**
_Mixed_

Transforms `Map` to `Object`, `Object` to `Map`, `Set` to `Array`, & `Array` to `Set`. Accepts an optional second parameter to perform the
transformation to simplify cross domain issues.

`haro.transform()` is exposed so that you can either duplicate it into the current context with `toString()` &
`new Function()`, or simply re-implement, for situations where you need to supply the transformation `Function`.

```javascript
const store = haro(null, {key: 'guid', index: ['name']}),
   data = [{guid: 'abc', name: 'John Doe', age: 30}, {guid: 'def', name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function () {
  console.log(store.transform(store.indexes)); // {age: {'28': ['def'], '30': ['abc']}, name: {'John Doe': ['abc'], 'Jane Doe': ['def']}}
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**unload([adapter=mongo, key])**
_Promise_

Unloads the DataStore, or a record from a specific persistent storage (delete).

**unregister(key)**
_Haro_

Un-registers a persistent storage adapter.

Example of unregistering an adapter:
```javascript
const haro = require('haro');

let store;

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
const store = haro(),
   data = [{name: 'John Doe', age: 30}, {name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function () {
  const iterator = store.values();
  let item = iterator.next();

  while (!item.done) {
    console.log(item.value);
    item = iterator.next();
  };
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

**where(predicate)**
_Array_

Performs a `find()` on the first key of `predicate`, and then a `filter()` on the remaining keys via a generated `Function`.

Ideal when dealing with a composite index which contains an `Array` of values, which would make matching on a single value impossible when using `find()`

```javascript
const store = haro(null, {key: 'guid', index: ['name']}),
   data = [{guid: 'abc', name: 'John Doe', age: 30}, {guid: 'def', name: 'Jane Doe', age: 28}];

store.batch(data, 'set').then(function () {
  console.log(store.where({name: 'John Doe', age: 30})); // [{guid: 'abc', name: 'John Doe', age: 30}]
}, function (e) {
  console.error(e.stack || e.message || e);
});
```

## License
Copyright (c) 2018 Jason Mulligan
Licensed under the BSD-3 license
