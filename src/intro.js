"use strict";

(function (global) {
const Promise = global.Promise || require("es6-promise").Promise;
const Map = global.Map || require("es6-map");
const Set = global.Set || require("es6-set");
const fetch = global.fetch || require("node-fetch");
const tuple = global.tuple || require("tiny-tuple");
const r = [8, 9, "a", "b"];
const regex = {
	querystring: /\?.*/,
	endslash: /\/$/
};
const mongodb = typeof process !== "undefined" ? require("mongodb") : null;
