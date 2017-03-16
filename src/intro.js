"use strict";

(function (global) {
	const node = typeof process !== "undefined" && typeof process.nextTick === "function",
		Promise = global.Promise,
		Map = global.Map,
		Set = global.Set,
		fetch = global.fetch || require("node-fetch"),
		Blob = global.Blob || require("Blob"),
		Worker = global.Worker || require("tiny-worker"),
		r = [8, 9, "a", "b"],
		regex = {
			querystring: /\?.*/,
			endslash: /\/$/
		},
		webWorker = typeof Blob !== "undefined" && typeof Worker !== "undefined",
		webWorkerError = "Web Worker not supported";

	let adapter = {};
