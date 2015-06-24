var haro = require('./lib/haro'),
    precise = require('precise'),
    store = haro(null, {key: "id", index: ["name"]}),
    i = -1,
    nth = 15000,
    data = [],
    timer;

while (++i < nth) {
  data.push({id: i, name: "abba " + i});
}

timer = precise().start();
store.batch(data, "set").then(function() {
  timer.stop();
  console.log("time to load data: "+(timer.diff()/1000000)+"ms");
  console.log("datastore record count: " + store.total);
  console.log("name indexes: " + store.indexes.get("name").size);
}).then(function () {
  var i = -1,
      nth = 5;

  console.log("testing time to 'find()' a record (first one is cold):");

  while (++i < nth) {
    (function () {
  var timer2 = precise().start();
  var record = store.find({name: 'abba 12345'});
  timer2.stop();
  console.log((timer2.diff()/1000000)+"ms");
    }());
  }
}).then(function () {
  var i = -1,
      nth = 5;

  console.log("testing time to 'search(regex, index)' for a record (first one is cold):");

  while (++i < nth) {
    (function () {
  var timer2 = precise().start();
  var record = store.search(/abba 12345/, 'name');
  timer2.stop();
  console.log((timer2.diff()/1000000)+"ms");
    }());
  }
});

