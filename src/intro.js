"use strict";

(function (global) {
const server = typeof process !== "undefined" && typeof process.nextTick === "function";
const Promise = global.Promise || require("es6-promise").Promise;
const Map = global.Map || require("es6-map");
const Set = global.Set || require("es6-set");
const fetch = global.fetch || require("node-fetch");
const deferred = global.deferred || require("tiny-defer");
const tuple = global.tuple || require("tiny-tuple");
const Blob = global.Blob || require("Blob");
const Worker = global.Worker || require("tiny-worker");
const r = [8, 9, "a", "b"];
const regex = {
	querystring: /\?.*/,
	endslash: /\/$/
};
const webWorker = typeof Blob !== "undefined" && typeof Worker !== "undefined";
const webWorkerError = "Web Worker not supported";
let adapter = {};
