"use strict";

(function (global) {
	const node = typeof process !== "undefined" && typeof process.nextTick === "function",
		Promise = global.Promise,
		Map = global.Map,
		Set = global.Set,
		fetch = global.fetch || (node ? require("node-fetch") : void 0),
		Blob = global.Blob,
		Worker = global.Worker || (node ? require("tiny-worker") : void 0),
		r = [8, 9, "a", "b"],
		regex = {
			querystring: /\?.*/,
			endslash: /\/$/,
			json: /^application\/json/
		},
		webWorker = typeof Worker !== "undefined",
		webWorkerError = "Web Worker not supported",
		adapter = {};
