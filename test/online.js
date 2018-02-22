const path = require("path"),
	haro = require(path.join(__dirname, "..", "lib", "haro")),
	data = require(path.join(__dirname, "data.json"));

process.env.NODE_NO_WARNINGS = 1;

require("tenso")({
	security: {
		csrf: false
	},
	logging: {
		enabled: false
	},
	routes: {
		get: {
			"/": ["data"],
			"/data(/)?.*": (req, res) => res.send(data)
		},
		put: {
			"/data(/)?.*": (req, res) => res.send(req.body)
		},
		post: {
			"/data(/)?.*": (req, res) => res.send(req.body, 201)
		},
		"delete": {
			"/data(/)?.*": (req, res) => res.send({success: true})
		}
	}
});

exports.setUri = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", source: "data", logging: false, versioning: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(7);
		test.equal(this.store.total, 0, "Should be '0'");
		test.equal(this.store.size, 0, "Should be '0'");
		test.equal(this.store.data.size, 0, "Should be '0'");
		this.store.setUri("http://localhost:8000/data?page_size=10").then(function (args) {
			test.equal(args.length, 6, "Should be '6'");
			test.equal(self.store.total, 6, "Should be '6'");
			test.equal(self.store.size, 6, "Should be '6'");
			test.equal(self.store.data.size, 6, "Should be '6'");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["create (wired)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", source: "data", logging: false, versioning: false});
		this.record = JSON.parse(JSON.stringify(data[0]));
		this.record.id = "8385ac94-0ebf-4a83-a6ba-25b54ce343be";
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(1);
		this.store.setUri("http://localhost:8000/data/?page_size=10").then(function () {
			return self.store.set(null, self.record);
		}, function (e) {
			throw e;
		}).then(function (arg) {
			test.equal(arg[0], self.record.id, "Should be a match");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["delete (wired)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", source: "data", logging: false, versioning: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(5);
		this.store.setUri("http://localhost:8000/data/?page_size=10").then(function (args) {
			test.equal(self.store.total, 6, "Should be a match");
			test.equal(self.store.size, 6, "Should be a match");

			return self.store.del(args[0][0]);
		}, function (e) {
			throw e;
		}).then(function () {
			test.equal(self.store.total, self.store.data.size, "Should be a match");
			test.equal(self.store.size, self.store.data.size, "Should be a match");
			test.equal(self.store.data.size, 5, "Should be a match");
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["update (wired / overwrite)"] = {
	setUp: function (done) {
		this.store = haro(null, {key: "guid", source: "data", logging: false, versioning: false});
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(1);
		this.store.setUri("http://localhost:8000/data?page_size=10").then(function (args) {
			return self.store.set(args[0][0], {blah: true}, false, true);
		}, function (e) {
			throw e;
		}).then(function (arg) {
			test.equal(Object.keys(arg[1]).length, 1, "Should be a match");
			test.done();
		}, function () {
			test.done();
		});
	}
};
