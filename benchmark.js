const path = require("path"),
	haro = require(path.join(__dirname, "lib", "haro.es6")),
	precise = require("precise"),
	data = require(path.join(__dirname, "data.json"));

let indexes;

function second () {
	const timer = precise().start(),
		store = haro(null, {id: "test", key: "_id", index: ["name", "eyeColor", "age", "gender", "isActive"]}),
		deferreds = [];

	deferreds.push(store.override(data, "records"));
	deferreds.push(store.override(indexes, "indexes"));

	Promise.all(deferreds).then(function () {
		let i = -1,
			nth = 5;

		timer.stop();
		console.log("time to override data: " + (timer.diff() / 1000000) + "ms");
		console.log("testing time to 'search(regex, index)' on overridden data for a record (first one is cold):");

		while (++i < nth) {
			(function () {
				const timer2 = precise().start();
				const record = store.search(/Carly Conway/, "name");
				timer2.stop();
				console.log((timer2.diff() / 1000000) + "ms");

				if (!record) {
					console.log("Couldn't find record");
				}
			}());
		}
	});
}

function first () {
	const timer = precise().start(),
		store = haro(null, {id: "test", key: "_id", index: ["name", "eyeColor", "age", "gender", "isActive"]});

	store.batch(data, "set").then(function () {
		timer.stop();
		console.log("time to batch insert data: " + (timer.diff() / 1000000) + "ms");
		console.log("datastore record count: " + store.total);
		console.log("name indexes: " + store.indexes.get("name").size + "\n");
	}).then(function () {
		let i = -1,
			nth = 5;

		console.log("testing time to 'find()' a record (first one is cold):");
		indexes = store.dump("indexes");

		while (++i < nth) {
			(function () {
				const timer2 = precise().start();
				const record = store.find({name: "Muriel Osborne"});
				timer2.stop();
				console.log((timer2.diff() / 1000000) + "ms");

				if (!record) {
					console.log("Couldn't find record");
				}
			}());
		}

		console.log("");
	}).then(function () {
		let i = -1,
			nth = 5;

		console.log("testing time to 'search(regex, index)' for a record (first one is cold):");

		while (++i < nth) {
			(function () {
				const timer2 = precise().start();
				const record = store.search(/Lizzie Clayton/, "name");
				timer2.stop();
				console.log((timer2.diff() / 1000000) + "ms");

				if (!record) {
					console.log("Couldn't find record");
				}
			}());
		}

		console.log("");

		second();
	});
}

first();

