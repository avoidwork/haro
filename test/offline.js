const path = require("path"),
	haro = require(path.join(__dirname, "..", "lib", "haro.es6")),
	data = require(path.join(__dirname, "data.json"));

exports.empty = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		test.expect(2);
		test.equal(this.store.total, 0, "Should be '0'");
		test.equal(this.store.data.size, 0, "Should be '0'");
		test.done();
	}
};

exports.create = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(4);
		test.equal(this.store.total, 0, "Should be '0'");
		test.equal(this.store.data.size, 0, "Should be '0'");
		this.store.set(null, data[0]).then(function () {
			test.equal(self.store.total, 1, "Should be '1'");
			test.equal(self.store.data.size, 1, "Should be '1'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["create (batch)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(14);
		test.equal(this.store.total, 0, "Should be '0'");
		test.equal(this.store.data.size, 0, "Should be '0'");
		test.equal(this.store.loading, false, "Should be 'false'");
		this.store.batch(data, "set").then(function () {
			test.equal(self.store.loading, false, "Should be 'false'");
			test.equal(self.store.total, 6, "Should be '6'");
			test.equal(self.store.data.size, 6, "Should be '6'");
			test.equal(self.store.registry.length, 6, "Should be '6'");
			test.equal(self.store.limit(0, 2)[1][0], self.store.get(self.store.registry[1])[0], "Should be a match");
			test.equal(self.store.limit(2, 4)[1][0], self.store.get(self.store.registry[3])[0], "Should be a match");
			test.equal(self.store.limit(5, 10).length, 1, "Should be '1'");
			test.equal(self.store.filter(function (i) {
				return (/decker/i).test(i.name);
			}).length, 1, "Should be '1'");
			test.equal(self.store.map(function (i) {
				i.name = "John Doe";

				return i;
			}).length, 6, "Should be '6'");
			test.equal(self.store.map(function (i) {
				i.name = "John Doe";

				return i;
			})[0].name, "John Doe", "Should be a match");
			test.done();
		}, function () {
			test.done();
		});
		test.equal(this.store.loading, true, "Should be 'true'");
	}
};

exports["update (batch)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(14);
		test.equal(this.store.total, 0, "Should be '0'");
		test.equal(this.store.data.size, 0, "Should be '0'");
		this.store.batch(data, "set").then(function () {
			test.equal(self.store.total, 6, "Should be '6'");
			test.equal(self.store.data.size, 6, "Should be '6'");
			test.equal(self.store.registry.length, 6, "Should be '6'");

			return self.store.batch(data, "set");
		}, function (e) {
			throw e;
		}).then(function () {
			test.equal(self.store.total, 6, "Should be '6'");
			test.equal(self.store.data.size, 6, "Should be '6'");
			test.equal(self.store.registry.length, 6, "Should be '6'");
			test.equal(self.store.limit(0, 2)[1][0], self.store.get(self.store.registry[1])[0], "Should be a match");
			test.equal(self.store.limit(2, 4)[1][0], self.store.get(self.store.registry[3])[0], "Should be a match");
			test.equal(self.store.limit(5, 10).length, 1, "Should be '1'");
			test.equal(self.store.filter(function (i) {
				return (/decker/i).test(i.name);
			}).length, 1, "Should be '1'");
			test.equal(self.store.map(function (i) {
				i.name = "John Doe";

				return i;
			}).length, 6, "Should be '6'");
			test.equal(self.store.map(function (i) {
				i.name = "John Doe";

				return i;
			})[0].name, "John Doe", "Should be a match");
			test.done();
		}, function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["read (valid)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(4);
		this.store.set(null, data[0]).then(function (arg) {
			var record = self.store.get(arg[0]);

			test.equal(self.store.total, 1, "Should be '1'");
			test.equal(self.store.data.size, 1, "Should be '1'");
			test.equal(Object.keys(record[1]).length, 19, "Should be a '19'");
			test.equal(record[1].name, "Decker Merrill", "Should be a match");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["read (invalid)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.set(null, data[0]).then(function () {
			test.equal(self.store.total, 1, "Should be '1'");
			test.equal(self.store.data.size, 1, "Should be '1'");
			test.equal(self.store.get("abc"), undefined, "Should be 'undefined'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["read (raw/immutable)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(1);
		this.store.set(null, data[0]).then(function (arg) {
			self.store.get(arg[0], true).guid += "a";
			test.equal(self.store.get(arg[0])[1].guid, arg[0], "Should match");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["read (indexed)"] = {
	setUp: function (done) {
		this.store = haro(null, {index: ["name", "age", "age|gender"], logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(11);
		this.store.batch(data, "set").then(function (args) {
			test.equal(self.store.find({name: "Decker Merrill"}).length, 1, "Should be '1'");
			test.equal(self.store.find({age: 20}).length, 2, "Should be '2'");
			test.equal(self.store.indexes.get("age").get(20).size, 2, "Should be '2'");
			test.equal(self.store.find({age: 20, gender: "male"}).length, 1, "Should be '1'");
			test.equal(self.store.find({gender: "male", age: 20}).length, 1, "Should be '1'");
			test.equal(self.store.find({age: 50}).length, 0, "Should be '0'");
			test.equal(self.store.find({agez: 1}).length, 0, "Should be '0'");
			test.equal(self.store.limit(0, 3)[2][1].guid, "f34d994b-24eb-4553-adf7-8f61e7ef8741", "Should be 'f34d994b-24eb-4553-adf7-8f61e7ef8741'");

			return args;
		}, function (e) {
			throw e;
		}).then(function () {
			return self.store.del(self.store.find({age: 20, gender: "male"})[0][0]);
		}, function (e) {
			throw e;
		}).then(function () {
			test.equal(self.store.find({age: 20, gender: "male"}).length, 0, "Should be '0'");
			test.equal(self.store.indexes.get("age").get(20).size, 1, "Should be '1'");
			test.equal(self.store.limit(0, 3)[2][1].guid, "a94c8560-7bfd-42ec-a759-cbd5899b33c0", "Should be 'a94c8560-7bfd-42ec-a759-cbd5899b33c0'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["read (toArray)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(4);
		this.store.batch(data, "set").then(function () {
			test.equal(self.store.toArray().length, 6, "Should be '6'");
			test.equal(self.store.toArray(self.store.limit(0, 5)).length, 5, "Should be '5'");
			test.equal(Object.isFrozen(self.store.toArray(undefined)), true, "Should be 'true'");
			test.equal(Object.isFrozen(self.store.toArray(undefined, false)), false, "Should be 'false'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["read (toObject)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(4);
		this.store.batch(data, "set").then(function () {
			test.equal(self.store.toObject()["2a30000f-92dc-405c-b1e0-7c416d766b39"].isActive, false, "Should be 'false'");
			test.equal(self.store.toObject(self.store.limit(0, 5))["2a30000f-92dc-405c-b1e0-7c416d766b39"].isActive, false, "Should be 'false'");
			test.equal(Object.isFrozen(self.store.toObject()), true, "Should be 'true'");
			test.equal(Object.isFrozen(self.store.toObject(undefined, false)), false, "Should be 'false'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["read (sort)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(1);
		this.store.batch(data, "set").then(function () {
			// Sorting age descending
			return self.store.sort(function (a, b) {
				return a.age > b.age ? -1 : a.age === b.age ? 0 : 1;
			});
		}, function (e) {
			throw e;
		}).then(function (arg) {
			test.equal(arg[0].guid, "a94c8560-7bfd-42ec-a759-cbd5899b33c0", "Should be 'a94c8560-7bfd-42ec-a759-cbd5899b33c0'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["read (sortBy)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(1);
		this.store.batch(data, "set").then(function () {
			test.equal(self.store.sortBy("company")[0][1].company, "Coash", "Should be 'Coash'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["read (search - un-indexed)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this,
			regex = new RegExp(".*de.*", "i");

		test.expect(1);
		this.store.batch(data, "set").then(function () {
			var result = self.store.search(regex, "name");

			test.equal(result.length, 0, "Should be '0'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["read (search - indexed)"] = {
	setUp: function (done) {
		this.store = haro(null, {index: ["name", "age", "tags"], logging: false});
		done();
	},
	test: function (test) {
		var self = this,
			regex = new RegExp(".*de.*", "i");

		test.expect(6);
		this.store.batch(data, "set").then(function () {
			var result1 = self.store.search(regex);
			var result2 = self.store.search(20, "age");
			var result3 = self.store.search(/velit/, "tags");

			test.equal(result1.length, 2, "Should be '2'");
			test.equal(result1[0][1].name, "Decker Merrill", "Should be 'Decker Merrill'");
			test.equal(result2.length, 2, "Should be '2'");
			test.equal(result2[0][1].name, "Decker Merrill", "Should be 'Decker Merrill'");
			test.equal(result3.length, 1, "Should be '1'");
			test.equal(result3[0][1].name, "Decker Merrill", "Should be 'Decker Merrill'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["read (inner join)"] = {
	setUp: function (done) {
		this.store1 = haro([{id: "abc", name: "jason", age: 35}, {id: "def", name: "jen", age: 31}], {id: "users", key: "id", index: ["name", "age"], logging: false});
		this.store2 = haro([{id: "ghi", user: "abc", value: 40}], {id: "values", key: "id", index: ["user", "value"], logging: false});
		done();
	},
	test: function (test) {
		test.expect(2);
		this.store1.join(this.store2, "user", "inner").then(function (result) {
			test.equal(result.length, 1, "Should be '1'");
			test.equal(result[0].users_id, "abc", "Should be 'abc'");
			test.done();
		}, function (e) {
			console.error(e);
			test.done();
		});
	}
};

exports["read (inner join - where)"] = {
	setUp: function (done) {
		this.store1 = haro([{id: "abc", name: "jason", age: 35}, {id: "def", name: "jen", age: 31}], {id: "users", key: "id", index: ["name", "age"], logging: false});
		this.store2 = haro([{id: "ghi", user: "abc", value: 40}], {id: "values", key: "id", index: ["user", "value"], logging: false});
		done();
	},
	test: function (test) {
		test.expect(1);
		this.store1.join(this.store2, "user", "inner", [{age: 31}]).then(function (result) {
			test.equal(result.length, 0, "Should be '0'");
			test.done();
		}, function (e) {
			console.error(e);
			test.done();
		});
	}
};

exports["read (left join)"] = {
	setUp: function (done) {
		this.store1 = haro([{id: "abc", name: "jason", age: 35}, {id: "def", name: "jen", age: 31}], {id: "users", key: "id", index: ["name", "age"], logging: false});
		this.store2 = haro([{id: "ghi", user: "abc", value: 40}], {id: "values", key: "id", index: ["user", "value"], logging: false});
		done();
	},
	test: function (test) {
		test.expect(4);
		this.store1.join(this.store2, "user", "left").then(function (result) {
			test.equal(result.length, 2, "Should be '2'");
			test.equal(result[0].users_id, "abc", "Should be 'abc'");
			test.equal(result[1].users_id, "def", "Should be 'def'");
			test.equal(result[1].values_value, null, "Should be 'null'");
			test.done();
		}, function (e) {
			console.error(e);
			test.done();
		});
	}
};

exports["read (right join)"] = {
	setUp: function (done) {
		this.store1 = haro([{id: "abc", name: "jason", age: 35}, {id: "def", name: "jen", age: 31}], {id: "users", key: "id", index: ["name", "age"], logging: false});
		this.store2 = haro([{id: "ghi", user: "abc", value: 40}], {id: "values", key: "id", index: ["user", "value"], logging: false});
		done();
	},
	test: function (test) {
		test.expect(2);
		this.store1.join(this.store2, "user", "right").then(function (result) {
			test.equal(result.length, 1, "Should be '1'");
			test.equal(result[0].users_id, "abc", "Should be 'abc'");
			test.done();
		}, function (e) {
			console.error(e);
			test.done();
		});
	}
};

exports.update = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.set(null, data[0]).then(function (arg) {
			test.equal(arg[1].name, "Decker Merrill", "Should be a match");

			return arg;
		}).then(function (arg) {
			return self.store.set(arg[0], {name: "John Doe"});
		}, function (e) {
			throw e;
		}).then(function (arg) {
			test.equal(arg[1].name, "John Doe", "Should be a match");
			test.equal(self.store.versions.get(arg[0]).size, 1, "Should be a '1'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports.delete = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.set(null, data[0]).then(function (arg) {
			test.equal(arg[1].name, "Decker Merrill", "Should be a match");

			return arg;
		}).then(function (arg) {
			return self.store.del(arg[0]);
		}, function (e) {
			throw e;
		}).then(function () {
			test.equal(self.store.total, 0, "Should be '0'");
			test.equal(self.store.data.size, 0, "Should be '0'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["delete (batch)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.batch(data, "set").then(function (arg) {
			test.equal(arg[0][1].name, "Decker Merrill", "Should be a match");

			return arg;
		}).then(function (arg) {
			return self.store.batch([arg[0][0], arg[2][0]], "del");
		}, function (e) {
			throw e;
		}).then(function () {
			test.equal(self.store.total, 4, "Should be '4'");
			test.equal(self.store.data.size, 4, "Should be '4'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["dump (indexes)"] = {
	setUp: function (done) {
		this.store = haro(null, {index: ["name", "age", "age|gender"], logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(2);
		this.store.batch(data, "set").then(function () {
			var ldata = self.store.dump("indexes");

			test.equal(Object.keys(ldata).length, 3, "Should be a match");
			test.equal(Object.isFrozen(ldata), false, "Should be 'false'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["dump (records)"] = {
	setUp: function (done) {
		this.store = haro(null, {index: ["name", "age", "age|gender"], logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(2);
		this.store.batch(data, "set").then(function () {
			var ldata = self.store.dump();

			test.equal(ldata.length, data.length, "Should be a match");
			test.equal(Object.isFrozen(ldata), false, "Should be 'false'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["offload (indexes)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", index: ["name", "age"], logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.offload(data).then(function (args) {
			test.equal(Object.keys(args).length, self.store.index.length, "Should be a match");
			test.equal(Object.keys(args.name).length, 6, "Should be '6'");
			test.equal(args.age["20"].length, 2, "Should be '2'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["override (indexes)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		this.indexes = {
			name: {
				"Decker Merrill": ["cfbfe5d1-451d-47b1-96c4-8e8e83fe9cfd"],
				"Waters Yates": ["cbaa7d2f-b098-4347-9437-e1f879c9232a"],
				"Elnora Durham": ["1adf114d-f0ab-4a29-9d28-47cd4a627127"],
				"Krista Adkins": ["c5849290-afa2-4a33-a23f-64253f0d9ad9"],
				"Mcneil Weiss": ["eccdbfd9-223f-4a85-a791-4567fecbeb44"],
				"Leann Sosa": ["47ce98a7-3c4c-4175-9a9a-f32af8392065"]
			},
			age: {
				"20": ["cfbfe5d1-451d-47b1-96c4-8e8e83fe9cfd",
					"47ce98a7-3c4c-4175-9a9a-f32af8392065"],
				"24": ["cbaa7d2f-b098-4347-9437-e1f879c9232a",
					"eccdbfd9-223f-4a85-a791-4567fecbeb44"],
				"26": ["1adf114d-f0ab-4a29-9d28-47cd4a627127"],
				"29": ["c5849290-afa2-4a33-a23f-64253f0d9ad9"]
			},
			"age|gender": {
				"20|male": ["cfbfe5d1-451d-47b1-96c4-8e8e83fe9cfd"],
				"24|male": ["cbaa7d2f-b098-4347-9437-e1f879c9232a",
					"eccdbfd9-223f-4a85-a791-4567fecbeb44"],
				"26|female": ["1adf114d-f0ab-4a29-9d28-47cd4a627127"],
				"29|female": ["c5849290-afa2-4a33-a23f-64253f0d9ad9"],
				"20|female": ["47ce98a7-3c4c-4175-9a9a-f32af8392065"]
			}
		};
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(6);
		test.equal(self.store.indexes.size, 0, "Should be a '0'");
		this.store.batch(data, "set").then(function () {
			return self.store.override(self.indexes, "indexes");
		}, function (e) {
			throw e;
		}).then(function () {
			test.equal(self.store.indexes.size, 3, "Should be a '3'");
			test.equal(self.store.indexes.get("name").size, 6, "Should be a '6'");
			test.equal(self.store.indexes.get("age").size, 4, "Should be a '4'");
			test.equal(self.store.indexes.get("age").get("20").size, 2, "Should be a '2'");
			test.equal(self.store.indexes.get("age|gender").size, 5, "Should be a '5'");
			test.done();
		}, function (e) {
			throw e;
		});
	}
};

exports["override (records)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", logging: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.override(data, "records").then(function () {
			test.equal(self.store.total, 6, "Should be a '6'");
			test.equal(self.store.registry.length, 6, "Should be a '6'");
			test.equal(self.store.data.size, 6, "Should be a '6'");
			test.done();
		}, function () {
			test.done();
		});
	}
};
