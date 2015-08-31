"use strict";

(function (global) {
const server = typeof process !== "undefined" && typeof process.nextTick === "function";
const Map = !server ? global.Map : require("es6-map");
const Set = !server ? global.Set : require("es6-set");
const fetch = !server ? global.fetch : require("node-fetch");
const deferred = !server ? global.deferred : require("tiny-defer");
const tuple = !server ? global.tuple : require("tiny-tuple");
const r = [8, 9, "a", "b"];
const regex = {
	querystring: /\?.*/,
	endslash: /\/$/
};
let adapter = {};

if (!server && !global.Promise) {
	fetch.Promise = require("es6-promise").Promise;
}
