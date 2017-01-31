const path = require("path"),
    haro = require(path.join(__dirname, "lib", "haro.es6")),
    precise = require("precise"),
    nth = 15000,
    data = [];

let indexes;

let i = -1;

while (++i < nth) {
    data.push({id: i, name: "abba " + i});
}

function second () {
    const timer = precise().start(),
        store = haro(null, {key: "id", index: ["name"]}),
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
			    const record = store.search(/abba 12345/, "name");
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
        store = haro(null, {key: "id", index: ["name"]});

    store.batch(data, "set").then(function () {
        timer.stop();
        console.log("time to batch insert data: " + (timer.diff() / 1000000) + "ms");
        console.log("datastore record count: " + store.total);
        console.log("name indexes: " + store.indexes.get("name").size);
    }).then(function () {
        let i = -1,
            nth = 5;

        console.log("testing time to 'find()' a record (first one is cold):");
        indexes = store.dump("indexes");

        while (++i < nth) {
            (function () {
                const timer2 = precise().start();
				const record = store.find({name: "abba 12345"});
                timer2.stop();
                console.log((timer2.diff() / 1000000) + "ms");

	            if (!record) {
		            console.log("Couldn't find record");
	            }
            }());
        }
    }).then(function () {
        let i = -1,
            nth = 5;

        console.log("testing time to 'search(regex, index)' for a record (first one is cold):");

        while (++i < nth) {
            (function () {
                const timer2 = precise().start();
                const record = store.search(/abba 12345/, "name");
                timer2.stop();
                console.log((timer2.diff() / 1000000) + "ms");

	            if (!record) {
		            console.log("Couldn't find record");
	            }
            }());
        }

        second();
    });
}

first();

