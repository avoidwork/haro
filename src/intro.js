"use strict";

(function (global) {
const server = typeof process !== "undefined" && typeof process.nextTick === "function";
const Promise = !server ? global.Promise : require("es6-promise").Promise;
const Map = !server ? global.Map : require("es6-map");
const Set = !server ? global.Set : require("es6-set");
const fetch = !server ? global.fetch : require("node-fetch");
const tuple = !server ? global.tuple : require("tiny-tuple");
const r = [8, 9, "a", "b"];
const regex = {
	querystring: /\?.*/,
	endslash: /\/$/
};
let adapter = {};
