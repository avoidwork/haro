var haro = require( "../lib/haro" ),
    data = require( "./data.json" ),
    tenso = require( "tenso" ),
	server;

server = tenso( {
	security: {
		csrf: false
	},
	logs: {
		level: "warn"
	},
	routes: {
		get: {
			"/data.*" : function ( req, res ) {
				res.respond( data );
			}
		},
		put: {
			"/data.*" : function ( req, res ) {
				res.respond( req.body );
			}
		},
		post: {
			"/data.*" : function ( req, res ) {
				res.respond( req.body, 201 );
			}
		},
		"delete": {
			"/data.*" : function ( req, res ) {
				res.respond( { success: true } );
			}
		}
	}
} );

exports["empty"] = {
	setUp: function (done) {
		this.store = haro();
		done();
	},
	test: function (test) {
		test.expect(2);
		test.equal(this.store.total, 0, "Should be '0'");
		test.equal(this.store.data.size, 0, "Should be '0'");
		test.done();
	}
};

exports["create"] = {
	setUp: function (done) {
		this.store = haro();
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(4);
		test.equal(this.store.total, 0, "Should be '0'");
		test.equal(this.store.data.size, 0, "Should be '0'");
		this.store.set(null, data[0]).then(function(arg) {
			test.equal(self.store.total, 1, "Should be '1'");
			test.equal(self.store.data.size, 1, "Should be '1'");
			test.done();
		}, function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["create (batch)"] = {
	setUp: function (done) {
		this.store = haro();
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(7);
		test.equal(this.store.total, 0, "Should be '0'");
		test.equal(this.store.data.size, 0, "Should be '0'");
		this.store.batch(data, "set").then(function() {
			test.equal(self.store.total, 6, "Should be '6'");
			test.equal(self.store.data.size, 6, "Should be '6'");
			test.equal(self.store.registry.length, 6, "Should be '6'");
			test.equal(self.store.limit(2, 1)[0][0], self.store.get(self.store.registry[2])[0], "Should be a match");
			test.equal(self.store.limit(2, 2)[1][0], self.store.get(self.store.registry[3])[0], "Should be a match");
			test.done();
		}, function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["read (valid)"] = {
	setUp: function (done) {
		this.store = haro();
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(4);
		this.store.set(null, data[0]).then(function(arg) {
			var record = self.store.get(arg[0]);

			test.equal(self.store.total, 1, "Should be '1'");
			test.equal(self.store.data.size, 1, "Should be '1'");
			test.equal(Object.keys(record[1]).length, 19, "Should be a '19'");
			test.equal(record[1].name, "Decker Merrill", "Should be a match");
			test.done();
		}, function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["read (invalid)"] = {
	setUp: function (done) {
		this.store = haro();
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.set(null, data[0]).then(function() {
			test.equal(self.store.total, 1, "Should be '1'");
			test.equal(self.store.data.size, 1, "Should be '1'");
			test.equal(self.store.get('abc'), undefined, "Should be 'undefined'");
			test.done();
		}, function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["update"] = {
	setUp: function (done) {
		this.store = haro();
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.set(null, data[0]).then(function(arg) {
			test.equal(arg[1].name, "Decker Merrill", "Should be a match");
			return arg;
		}).then(function (arg) {
			self.store.set(arg[0], {name: "John Doe"}).then(function (arg) {
				test.equal(arg[1].name, "John Doe", "Should be a match");
				test.equal(self.store.versions.get(arg[0]).size, 1, "Should be a '1'");
				test.done();
			}, function (e) {
				console.log(e.stack);
				test.done();
			});
		}).catch(function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["delete"] = {
	setUp: function (done) {
		this.store = haro();
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.set(null, data[0]).then(function(arg) {
			test.equal(arg[1].name, "Decker Merrill", "Should be a match");
			return arg;
		}).then(function (arg) {
			self.store.del(arg[0]).then(function () {
				test.equal(self.store.total, 0, "Should be '0'");
				test.equal(self.store.data.size, 0, "Should be '0'");
				test.done();
			}, function (e) {
				console.log(e.stack);
				test.done();
			});
		}).catch(function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["delete (batch)"] = {
	setUp: function (done) {
		this.store = haro();
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.batch(data, "set").then(function(arg) {
			test.equal(arg[0][1].name, "Decker Merrill", "Should be a match");
			return arg;
		}).then(function (arg) {
			self.store.batch([arg[0][0], arg[2][0]], "del").then(function () {
				test.equal(self.store.total, 4, "Should be '4'");
				test.equal(self.store.data.size, 4, "Should be '4'");
				test.done();
			}, function (e) {
				console.log(e.stack);
				test.done();
			});
		}).catch(function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["setUri"] = {
	setUp: function (done) {
		this.store = haro(null);
		this.store.source = "data.result";
		this.store.key = "guid";
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(5);
		test.equal(this.store.total, 0, "Should be '0'");
		test.equal(this.store.data.size, 0, "Should be '0'");
		this.store.setUri("http://localhost:8000/data?page_size=10").then(function(args) {
			test.equal(args.length, 6, "Should be '6'");
			test.equal(self.store.total, 6, "Should be '6'");
			test.equal(self.store.data.size, 6, "Should be '6'");
			test.done();
		}, function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["create (wired)"] = {
	setUp: function (done) {
		this.store = haro(null);
		this.store.source = "data.result";
		this.store.key = "guid";
		this.record = JSON.parse(JSON.stringify( data[0] ) );
		this.record.id = "8385ac94-0ebf-4a83-a6ba-25b54ce343be";
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(1);
		this.store.setUri("http://localhost:8000/data?page_size=10").then(function() {
			self.store.set(null, self.record).then(function (arg) {
				test.equal(arg[0], self.record.id, "Should be a match");
				test.done();
			}, function (e) {
				console.log(e.stack);
				test.done();
			});
		}, function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["delete (wired)"] = {
	setUp: function (done) {
		this.store = haro(null);
		this.store.source = "data.result";
		this.store.key = "guid";
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		this.store.setUri("http://localhost:8000/data?page_size=10").then(function(args) {
			test.equal(self.store.total, 6, "Should be a match");
			self.store.del(args[0][0]).then(function () {
				test.equal(self.store.total, self.store.data.size, "Should be a match");
				test.equal(self.store.data.size, 5, "Should be a match");
				test.done();
			}, function (e) {
				console.log(e.stack);
				test.done();
			});
		}, function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["update (wired / overwrite)"] = {
	setUp: function (done) {
		this.store = haro(null);
		this.store.source = "data.result";
		this.store.key = "guid";
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(1);
		this.store.setUri("http://localhost:8000/data?page_size=10").then(function(args) {
			var obj = args[0];

			self.store.set(obj[0], {blah: true}, false, true).then(function (arg) {
				test.equal(Object.keys(arg[1]).length, 1, "Should be a match");
				test.done();
			}, function (e) {
				console.log(e.stack);
				test.done();
			});
		}, function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};
