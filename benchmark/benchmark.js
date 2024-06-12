import {haro} from "../dist/haro.cjs";
import {precise} from "precise";
import { readFile } from 'node:fs/promises';

const fileUrl = new URL("./data.json", import.meta.url);
const data = JSON.parse(await readFile(fileUrl, "utf8"));

let indexes;

function second () {
	const timer = precise().start(),
		store = haro(null, {id: "test", key: "_id", index: ["name", "eyeColor", "age", "gender", "isActive"]});
	let i, nth;

	store.override(data, "records");
	store.override(indexes, "indexes");

	i = -1;
	nth = 5;

	timer.stop();
	console.log(`time to override data: ${timer.diff() / 1000000} ms`);
	console.log("testing time to 'search(regex, index)' on overridden data for a record (first one is cold):");

	while (++i < nth) {
		const timer2 = precise().start(),
			record = store.search(/Carly Conway/, "name");

		timer2.stop();
		console.log(timer2.diff() / 1000000 + "ms");

		if (!record) {
			console.log("Couldn't find record");
		}
	}
}

function first () {
	const timer = precise().start(),
		store = haro(null, {id: "test", key: "_id", index: ["name", "eyeColor", "age", "gender", "isActive"]});
	let i, nth;

	store.batch(data, "set");
	timer.stop();
	console.log(`time to batch insert data: ${timer.diff() / 1000000} ms`);
	console.log(`datastore record count: ${store.size}`);
	console.log(`name indexes: ${store.indexes.get("name").size}\n`);

	i = -1;
	nth = 5;

	console.log("testing time to 'find()' a record (first one is cold):");
	indexes = store.dump("indexes");

	while (++i < nth) {
		const timer2 = precise().start(),
			record = store.find({name: "Muriel Osborne"});

		timer2.stop();
		console.log(timer2.diff() / 1000000 + "ms");

		if (!record) {
			console.log("Couldn't find record");
		}
	}

	console.log("");

	i = -1;
	nth = 5;

	console.log("testing time to 'search(regex, index)' for a record (first one is cold):");

	while (++i < nth) {
		const timer2 = precise().start(),
			record = store.search(/Lizzie Clayton/, "name");

		timer2.stop();
		console.log(timer2.diff() / 1000000 + "ms");

		if (!record) {
			console.log("Couldn't find record");
		}
	}

	console.log("");
	second();
}

first();
