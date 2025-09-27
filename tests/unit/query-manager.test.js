import assert from "assert";
import { QueryManager } from "../../src/query-manager.js";
import { QueryError } from "../../src/errors.js";
import { RecordCollection, RecordFactory, Record } from "../../src/record.js";

/**
 * Mock StorageManager for testing
 */
class MockStorageManager {
	constructor(data = new Map()) {
		this._data = data;
	}

	get(key) {
		return this._data.get(key);
	}

	keys() {
		return this._data.keys();
	}

	entries() {
		return this._data.entries();
	}

	set(key, value) {
		this._data.set(key, value);
	}

	has(key) {
		return this._data.has(key);
	}

	clear() {
		this._data.clear();
	}
}

/**
 * Mock IndexManager for testing
 */
class MockIndexManager {
	constructor() {
		this._optimalIndex = null;
		this._findByCriteriaResult = new Set();
	}

	getOptimalIndex(fields) {
		return this._optimalIndex;
	}

	findByCriteria(criteria) {
		return this._findByCriteriaResult;
	}

	// Test helpers
	setOptimalIndex(index) {
		this._optimalIndex = index;
	}

	setFindByCriteriaResult(result) {
		this._findByCriteriaResult = result;
	}
}

/**
 * Mock QueryOptimizer for testing
 */
class MockQueryOptimizer {
	constructor() {
		this._plan = null;
		this.recordExecutionCalled = false;
		this.recordExecutionPlan = null;
	}

	createPlan(query, context) {
		return this._plan || new MockQueryPlan();
	}

	recordExecution(plan) {
		this.recordExecutionCalled = true;
		this.recordExecutionPlan = plan;
	}

	// Test helper
	setPlan(plan) {
		this._plan = plan;
	}
}

/**
 * Mock QueryPlan for testing
 */
class MockQueryPlan {
	constructor() {
		this.startExecutionCalled = false;
		this.completeExecutionCalled = false;
		this.completeExecutionResultCount = null;
	}

	startExecution() {
		this.startExecutionCalled = true;
	}

	completeExecution(resultCount) {
		this.completeExecutionCalled = true;
		this.completeExecutionResultCount = resultCount;
	}
}

describe("QueryManager", () => {
	let storageManager;
	let indexManager;
	let queryOptimizer;
	let queryManager;

	beforeEach(() => {
		// Setup test data
		const testData = new Map([
			["user1", { id: "user1", name: "John", age: 30, tags: ["developer", "javascript"] }],
			["user2", { id: "user2", name: "Jane", age: 25, tags: ["designer", "css"] }],
			["user3", { id: "user3", name: "Bob", age: 35, tags: ["manager"] }],
			["user4", { id: "user4", name: "Alice", age: 28, tags: ["developer", "python"] }]
		]);

		storageManager = new MockStorageManager(testData);
		indexManager = new MockIndexManager();
		queryOptimizer = new MockQueryOptimizer();
	});

	describe("constructor", () => {
		it("should create QueryManager with required dependencies", () => {
			queryManager = new QueryManager({ storageManager, indexManager });

			assert.strictEqual(queryManager.storageManager, storageManager);
			assert.strictEqual(queryManager.indexManager, indexManager);
			assert.strictEqual(queryManager.queryOptimizer, null);
		});

		it("should create QueryManager with optional queryOptimizer", () => {
			queryManager = new QueryManager({ storageManager, indexManager, queryOptimizer });

			assert.strictEqual(queryManager.storageManager, storageManager);
			assert.strictEqual(queryManager.indexManager, indexManager);
			assert.strictEqual(queryManager.queryOptimizer, queryOptimizer);
		});
	});

	describe("find", () => {
		beforeEach(() => {
			queryManager = new QueryManager({ storageManager, indexManager, queryOptimizer });
		});

		it("should find all records with empty criteria", () => {
			const result = queryManager.find();

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 4);
		});

		it("should find records matching simple criteria", () => {
			const result = queryManager.find({ name: "John" });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result.first().data.name, "John");
		});

		it("should find records using optimal index when available", () => {
			indexManager.setOptimalIndex({ name: "test_index" });
			indexManager.setFindByCriteriaResult(new Set(["user1", "user2"]));

			const result = queryManager.find({ name: "John" });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result.first().data.name, "John");
		});

		it("should apply limit option", () => {
			const result = queryManager.find({}, { limit: 2 });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 2);
		});

		it("should apply offset option", () => {
			const result = queryManager.find({}, { offset: 2 });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 2);
		});

		it("should apply both limit and offset", () => {
			const result = queryManager.find({}, { limit: 2, offset: 1 });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 2);
		});

		it("should use query optimizer when available", () => {
			const mockPlan = new MockQueryPlan();
			queryOptimizer.setPlan(mockPlan);

			const result = queryManager.find({ name: "John" });

			assert(mockPlan.startExecutionCalled);
			assert(mockPlan.completeExecutionCalled);
			assert.strictEqual(mockPlan.completeExecutionResultCount, 1);
			assert(queryOptimizer.recordExecutionCalled);
			assert.strictEqual(queryOptimizer.recordExecutionPlan, mockPlan);
		});

		it("should work without query optimizer", () => {
			queryManager.queryOptimizer = null;

			const result = queryManager.find({ name: "John" });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 1);
		});

		it("should throw QueryError on storage error", () => {
			// Mock storage error
			const originalGet = storageManager.get;
			storageManager.get = () => {
				throw new Error("Storage error");
			};

			assert.throws(() => {
				queryManager.find({ name: "John" });
			}, QueryError);

			// Restore original method
			storageManager.get = originalGet;
		});
	});

	describe("where", () => {
		beforeEach(() => {
			queryManager = new QueryManager({ storageManager, indexManager });
		});

		it("should filter by function predicate", () => {
			const result = queryManager.where(record => record.age > 30);

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result.first().data.name, "Bob");
		});

		it("should filter by function predicate with limit", () => {
			const result = queryManager.where(record => record.age >= 25, { limit: 1 });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 1);
		});

		it("should filter by function predicate with offset", () => {
			const result = queryManager.where(record => record.age >= 25, { offset: 1 });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 3);
		});

		it("should filter by function predicate with both limit and offset", () => {
			const result = queryManager.where(record => record.age >= 25, { limit: 1, offset: 1 });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 1);
		});

		it("should filter by object predicate", () => {
			const result = queryManager.where({ name: "Jane" });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result.first().data.name, "Jane");
		});

		it("should throw error for invalid predicate type", () => {
			assert.throws(() => {
				queryManager.where("invalid");
			}, QueryError);
		});

		it("should throw error for null predicate", () => {
			assert.throws(() => {
				queryManager.where(null);
			}, QueryError);
		});

		it("should throw QueryError when function predicate throws", () => {
			assert.throws(() => {
				queryManager.where(() => {
					throw new Error("Predicate error");
				});
			}, QueryError);
		});
	});

	describe("_matchesCriteria", () => {
		beforeEach(() => {
			queryManager = new QueryManager({ storageManager, indexManager });
		});

		it("should match simple field criteria", () => {
			const record = { name: "John", age: 30 };
			const criteria = { name: "John" };

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, true);
		});

		it("should not match simple field criteria when values differ", () => {
			const record = { name: "John", age: 30 };
			const criteria = { name: "Jane" };

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, false);
		});

		it("should match multiple field criteria", () => {
			const record = { name: "John", age: 30 };
			const criteria = { name: "John", age: 30 };

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, true);
		});

		it("should not match when one field doesn't match", () => {
			const record = { name: "John", age: 30 };
			const criteria = { name: "John", age: 25 };

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, false);
		});

		it("should match RegExp criteria", () => {
			const record = { name: "John", email: "john@example.com" };
			const criteria = { email: /john@/ };

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, true);
		});

		it("should not match RegExp criteria when pattern doesn't match", () => {
			const record = { name: "John", email: "john@example.com" };
			const criteria = { email: /jane@/ };

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, false);
		});

		it("should match array criteria with record array value (some overlap)", () => {
			const record = { tags: ["developer", "javascript"] };
			const criteria = { tags: ["javascript", "python"] };

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, true);
		});

		it("should not match array criteria with record array value (no overlap)", () => {
			const record = { tags: ["developer", "javascript"] };
			const criteria = { tags: ["python", "ruby"] };

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, false);
		});

		it("should match array criteria with record scalar value (included)", () => {
			const record = { role: "developer" };
			const criteria = { role: ["developer", "designer"] };

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, true);
		});

		it("should not match array criteria with record scalar value (not included)", () => {
			const record = { role: "manager" };
			const criteria = { role: ["developer", "designer"] };

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, false);
		});

		it("should match empty criteria (always true)", () => {
			const record = { name: "John", age: 30 };
			const criteria = {};

			const result = queryManager._matchesCriteria(record, criteria);

			assert.strictEqual(result, true);
		});
	});

	describe("_filterByFunction", () => {
		beforeEach(() => {
			queryManager = new QueryManager({ storageManager, indexManager });
		});

		it("should filter records by function", () => {
			const result = queryManager._filterByFunction(record => record.age > 30, {});

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result.first().data.name, "Bob");
		});

		it("should return empty collection when no records match", () => {
			const result = queryManager._filterByFunction(record => record.age > 100, {});

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 0);
		});

		it("should apply limit option", () => {
			const result = queryManager._filterByFunction(
				record => record.age >= 25,
				{ limit: 2 }
			);

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 2);
		});

		it("should apply offset option", () => {
			const result = queryManager._filterByFunction(
				record => record.age >= 25,
				{ offset: 2 }
			);

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 2);
		});

		it("should apply both limit and offset", () => {
			const result = queryManager._filterByFunction(
				record => record.age >= 25,
				{ limit: 1, offset: 1 }
			);

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 1);
		});

		it("should handle function that always returns false", () => {
			const result = queryManager._filterByFunction(() => false, {});

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 0);
		});

		it("should handle function that always returns true", () => {
			const result = queryManager._filterByFunction(() => true, {});

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 4);
		});
	});

	describe("_filterByObject", () => {
		beforeEach(() => {
			queryManager = new QueryManager({ storageManager, indexManager });
		});

		it("should delegate to find method", () => {
			// Mock the find method to verify it's called
			let findCalled = false;
			let findCriteria = null;
			let findOptions = null;
			const originalFind = queryManager.find;
			queryManager.find = (criteria, options) => {
				findCalled = true;
				findCriteria = criteria;
				findOptions = options;
				return originalFind.call(queryManager, criteria, options);
			};

			const predicate = { name: "John" };
			const options = { limit: 10 };
			const result = queryManager._filterByObject(predicate, options);

			assert(findCalled);
			assert.strictEqual(findCriteria, predicate);
			assert.strictEqual(findOptions, options);
			assert(result instanceof RecordCollection);

			// Restore original method
			queryManager.find = originalFind;
		});
	});

	describe("error handling", () => {
		beforeEach(() => {
			queryManager = new QueryManager({ storageManager, indexManager, queryOptimizer });
		});

		it("should handle QueryOptimizer createPlan error in find", () => {
			queryOptimizer.createPlan = () => {
				throw new Error("Optimizer error");
			};

			assert.throws(() => {
				queryManager.find({ name: "John" });
			}, QueryError);
		});

		it("should handle IndexManager getOptimalIndex error in find", () => {
			indexManager.getOptimalIndex = () => {
				throw new Error("Index error");
			};

			assert.throws(() => {
				queryManager.find({ name: "John" });
			}, QueryError);
		});

		it("should handle StorageManager keys error in find", () => {
			storageManager.keys = () => {
				throw new Error("Storage keys error");
			};

			assert.throws(() => {
				queryManager.find({ name: "John" });
			}, QueryError);
		});

		it("should handle RecordFactory create error in find", () => {
			// Mock RecordFactory to throw error
			const originalCreate = RecordFactory.create;
			RecordFactory.create = () => {
				throw new Error("RecordFactory error");
			};

			assert.throws(() => {
				queryManager.find({ name: "John" });
			}, QueryError);

			// Restore original method
			RecordFactory.create = originalCreate;
		});

		it("should handle StorageManager entries error in _filterByFunction", () => {
			storageManager.entries = () => {
				throw new Error("Storage entries error");
			};

			assert.throws(() => {
				queryManager.where(record => true);
			}, QueryError);
		});
	});

	describe("edge cases", () => {
		beforeEach(() => {
			queryManager = new QueryManager({ storageManager, indexManager });
		});

		it("should handle empty storage", () => {
			storageManager.clear();

			const result = queryManager.find({ name: "John" });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 0);
		});

		it("should handle criteria with undefined values", () => {
			const result = queryManager.find({ name: undefined });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 0);
		});

		it("should handle offset greater than result count", () => {
			const result = queryManager.find({}, { offset: 100 });

			assert(result instanceof RecordCollection);
			assert.strictEqual(result.length, 0);
		});

		it("should handle limit of 0", () => {
			const result = queryManager.find({}, { limit: 0 });

			assert(result instanceof RecordCollection);
			// When limit is 0 (falsy), it's treated as no limit, so all records are returned
			assert.strictEqual(result.length, 4);
		});

		it("should handle negative offset", () => {
			const result = queryManager.find({}, { offset: -1 });

			assert(result instanceof RecordCollection);
			// Negative offset uses slice(-1, records.length) which returns the last element
			assert.strictEqual(result.length, 1);
		});

		it("should handle null record data from storage", () => {
			storageManager.set("null_record", null);

			const result = queryManager.find({});

			assert(result instanceof RecordCollection);
			// Null record with empty criteria still matches and creates a record
			assert.strictEqual(result.length, 5);
		});
	});
});
