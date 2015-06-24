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
  console.log((timer.diff()/1000000)+"ms");
});

