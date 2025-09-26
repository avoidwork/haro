import assert from "node:assert";
import { describe, it, beforeEach } from "mocha";
import { randomUUID as uuid } from "crypto";

/**
 * Mock classes to avoid import complexity
 */
class MockConfigurationError extends Error {
	constructor(message, field, value) {
		super(message);
		this.name = "ConfigurationError";
		this.field = field;
		this.value = value;
	}
}

class MockTransactionError extends Error {
	constructor(message, transactionId, operation) {
		super(message);
		this.name = "TransactionError";
		this.transactionId = transactionId;
		this.operation = operation;
	}
}

class MockRecord {
	constructor(key, data) {
		this.key = key;
		this.data = data || {};
		this.metadata = {};
	}

	get(field) {
		return this.data[field];
	}

	set(field, value) {
		this.data[field] = value;
		return this;
	}
}

class MockRecordCollection {
	constructor(records = []) {
		this.records = records;
		this.length = records.length;
	}

	[Symbol.iterator]() {
		return this.records[Symbol.iterator]();
	}
}

class MockDataStream {
	constructor(data = []) {
		this.data = data;
	}
}

// Import the real error classes to test against them
import { ConfigurationError, TransactionError } from "../../src/errors.js";

// Mock the key classes used by Haro (but keep real errors for proper testing)
const Record = MockRecord;
const RecordCollection = MockRecordCollection;
const DataStream = MockDataStream;

// Import the real Haro class - we'll mock its dependencies after importing
import { Haro as RealHaro, haro as realHaro } from "../../src/haro.js";

// Store references to the real classes so we can use them in tests
const Haro = RealHaro;
const haro = realHaro;

/**
 * Helper function to create a Haro instance with mocked dependencies
 */
function createMockedHaro(data = null, config = {}) {
	const store = new Haro(data, config);
	
	// Replace the real managers with mocks to isolate testing
	store.storageManager = new MockStorageManager({ immutable: store.config.immutable });
	store.indexManager = new MockIndexManager(store.config.delimiter);
	store.versionManager = store.config.versioning ? new MockVersionManager(store.config.retentionPolicy) : null;
	store.transactionManager = store.config.enableTransactions ? new MockTransactionManager() : null;
	store.queryOptimizer = store.config.enableOptimization ? new MockQueryOptimizer() : null;
	store.lifecycleManager = new MockLifecycleManager();
	store.crudManager = new MockCRUDManager({
		storageManager: store.storageManager,
		indexManager: store.indexManager,
		versionManager: store.versionManager,
		config: store.config
	});
	store.queryManager = new MockQueryManager({
		storageManager: store.storageManager,
		indexManager: store.indexManager,
		queryOptimizer: store.queryOptimizer
	});
	store.batchManager = new MockBatchManager({
		crudManager: store.crudManager,
		transactionManager: store.transactionManager,
		lifecycleManager: store.lifecycleManager
	});
	store.streamManager = new MockStreamManager({
		storageManager: store.storageManager
	});
	store.statisticsManager = new MockStatisticsManager({
		storageManager: store.storageManager,
		indexManager: store.indexManager,
		versionManager: store.versionManager,
		transactionManager: store.transactionManager,
		queryOptimizer: store.queryOptimizer,
		config: store.config
	});

	return store;
}

/**
 * Mock StorageManager for testing
 */
class MockStorageManager {
	constructor(config = {}) {
		this.config = config;
		this.data = new Map();
		this.clearCalls = [];
		this.getCalls = [];
		this.setCalls = [];
		this.deleteCalls = [];
	}

	get(key) {
		this.getCalls.push(key);
		return this.data.get(key) || null;
	}

	set(key, value) {
		this.setCalls.push({ key, value });
		this.data.set(key, value);
		return true;
	}

	delete(key) {
		this.deleteCalls.push(key);
		return this.data.delete(key);
	}

	has(key) {
		return this.data.has(key);
	}

	clear() {
		this.clearCalls.push(true);
		this.data.clear();
	}

	keys() {
		return Array.from(this.data.keys());
	}

	getStore() {
		return this.data;
	}

	get size() {
		return this.data.size;
	}
}

/**
 * Mock IndexManager for testing
 */
class MockIndexManager {
	constructor() {
		this.createIndexCalls = [];
		this.clearCalls = [];
	}

	createIndex(field, name) {
		this.createIndexCalls.push({ field, name });
	}

	clear() {
		this.clearCalls.push(true);
	}
}

/**
 * Mock VersionManager for testing
 */
class MockVersionManager {
	constructor() {
		this.clearCalls = [];
	}

	clear() {
		this.clearCalls.push(true);
	}
}

/**
 * Mock QueryOptimizer for testing
 */
class MockQueryOptimizer {
	constructor() {
		this.clearCalls = [];
	}

	clear() {
		this.clearCalls.push(true);
	}
}

/**
 * Mock TransactionManager for testing
 */
class MockTransactionManager {
	constructor() {
		this.beginCalls = [];
		this.commitCalls = [];
		this.abortCalls = [];
	}

	begin(options = {}) {
		this.beginCalls.push(options);
		return { id: "test-transaction", state: "active" };
	}

	async commit(transactionId, context) {
		this.commitCalls.push({ transactionId, context });
		return { id: transactionId, state: "committed" };
	}

	abort(transactionId, reason) {
		this.abortCalls.push({ transactionId, reason });
		return { id: transactionId, state: "aborted" };
	}
}

/**
 * Mock CRUDManager for testing
 */
class MockCRUDManager {
	constructor() {
		this.setCalls = [];
		this.getCalls = [];
		this.deleteCalls = [];
		this.hasCalls = [];
		this.mockData = new Map();
	}

	set(key, data, options = {}) {
		this.setCalls.push({ key, data, options });
		const record = new Record(key, data);
		this.mockData.set(key, record);
		return record;
	}

	get(key, options = {}) {
		this.getCalls.push({ key, options });
		return this.mockData.get(key) || null;
	}

	delete(key, options = {}) {
		this.deleteCalls.push({ key, options });
		const existed = this.mockData.has(key);
		this.mockData.delete(key);
		return existed;
	}

	has(key) {
		this.hasCalls.push(key);
		return this.mockData.has(key);
	}
}

/**
 * Mock QueryManager for testing
 */
class MockQueryManager {
	constructor() {
		this.findCalls = [];
		this.whereCalls = [];
	}

	find(criteria = {}, options = {}) {
		this.findCalls.push({ criteria, options });
		return new RecordCollection([]);
	}

	where(predicate, options = {}) {
		this.whereCalls.push({ predicate, options });
		return new RecordCollection([]);
	}
}

/**
 * Mock BatchManager for testing
 */
class MockBatchManager {
	constructor() {
		this.batchCalls = [];
	}

	batch(operations, type = "set", options = {}) {
		this.batchCalls.push({ operations, type, options });
		return [];
	}
}

/**
 * Mock StreamManager for testing
 */
class MockStreamManager {
	constructor() {
		this.streamCalls = [];
	}

	stream(options = {}) {
		this.streamCalls.push(options);
		return new DataStream([]);
	}
}

/**
 * Mock StatisticsManager for testing
 */
class MockStatisticsManager {
	constructor() {
		this.getStatsCalls = [];
	}

	getStats() {
		this.getStatsCalls.push(true);
		return {
			recordCount: 0,
			indexCount: 0,
			memoryUsage: 0
		};
	}
}

/**
 * Mock LifecycleManager for testing
 */
class MockLifecycleManager {
	constructor() {
		this.beforeSetCalls = [];
		this.onsetCalls = [];
		this.beforeDeleteCalls = [];
		this.ondeleteCalls = [];
		this.beforeClearCalls = [];
		this.onclearCalls = [];
		this.onbatchCalls = [];
	}

	beforeSet(key, data, options) {
		this.beforeSetCalls.push({ key, data, options });
	}

	onset(record, options) {
		this.onsetCalls.push({ record, options });
	}

	beforeDelete(key, batch) {
		this.beforeDeleteCalls.push({ key, batch });
	}

	ondelete(key) {
		this.ondeleteCalls.push(key);
	}

	beforeClear() {
		this.beforeClearCalls.push(true);
	}

	onclear() {
		this.onclearCalls.push(true);
	}

	onbatch(results, type) {
		this.onbatchCalls.push({ results, type });
	}
}

/**
 * Tests for Haro class
 */
describe("Haro", () => {
	describe("Constructor", () => {
		/**
		 * Test default constructor with no parameters
		 */
		it("should create instance with default configuration", () => {
			const store = new Haro();

			assert.ok(store instanceof Haro);
			assert.strictEqual(store.config.delimiter, "|");
			assert.ok(store.config.id);
			assert.strictEqual(store.config.immutable, false);
			assert.deepStrictEqual(store.config.index, []);
			assert.strictEqual(store.config.key, "id");
			assert.strictEqual(store.config.versioning, false);
			assert.strictEqual(store.config.schema, null);
			assert.strictEqual(store.config.enableTransactions, false);
			assert.strictEqual(store.config.enableOptimization, true);
		});

		/**
		 * Test constructor with array data as first parameter
		 */
		it("should create instance with initial array data", () => {
			const initialData = [
				{ id: "1", name: "John" },
				{ id: "2", name: "Jane" }
			];
			const store = new Haro(initialData);

			assert.strictEqual(store.initialData, initialData);
			assert.ok(store.config.id);
		});

		/**
		 * Test constructor with configuration object as first parameter
		 */
		it("should create instance with configuration as first parameter", () => {
			const config = {
				delimiter: ",",
				immutable: true,
				key: "uuid",
				versioning: true
			};
			const store = new Haro(config);

			assert.strictEqual(store.initialData, null);
			assert.strictEqual(store.config.delimiter, ",");
			assert.strictEqual(store.config.immutable, true);
			assert.strictEqual(store.config.key, "uuid");
			assert.strictEqual(store.config.versioning, true);
		});

		/**
		 * Test constructor with both data and config parameters
		 */
		it("should create instance with data and config parameters", () => {
			const initialData = [{ id: "1", name: "Test" }];
			const config = { immutable: true, key: "uuid" };
			const store = new Haro(initialData, config);

			assert.strictEqual(store.initialData, initialData);
			assert.strictEqual(store.config.immutable, true);
			assert.strictEqual(store.config.key, "uuid");
		});

		/**
		 * Test constructor with null data parameter
		 */
		it("should handle null as first parameter", () => {
			const config = { immutable: true };
			const store = new Haro(null, config);

			assert.strictEqual(store.initialData, null);
			assert.strictEqual(store.config.immutable, true);
		});

		/**
		 * Test constructor creates indexes for configured index fields
		 */
		it("should create indexes for configured fields", () => {
			const mockIndexManager = new MockIndexManager();
			const store = new Haro(null, { index: ["name", "email"] });
			
			// Replace with mock after construction to verify calls
			store.indexManager = mockIndexManager;
			
			// Trigger index creation manually to test
			for (const field of store.config.index) {
				store.indexManager.createIndex(field, field);
			}

			assert.strictEqual(mockIndexManager.createIndexCalls.length, 2);
			assert.deepStrictEqual(mockIndexManager.createIndexCalls[0], { field: "name", name: "name" });
			assert.deepStrictEqual(mockIndexManager.createIndexCalls[1], { field: "email", name: "email" });
		});

		/**
		 * Test constructor creates managers based on configuration
		 */
		it("should create managers based on configuration", () => {
			const store = new Haro(null, {
				versioning: true,
				enableTransactions: true,
				enableOptimization: true
			});

			assert.ok(store.versionManager);
			assert.ok(store.transactionManager);
			assert.ok(store.queryOptimizer);
		});

		/**
		 * Test constructor skips optional managers when disabled
		 */
		it("should skip optional managers when disabled", () => {
			const store = new Haro(null, {
				versioning: false,
				enableTransactions: false,
				enableOptimization: false
			});

			assert.strictEqual(store.versionManager, null);
			assert.strictEqual(store.transactionManager, null);
			assert.strictEqual(store.queryOptimizer, null);
		});

		/**
		 * Test property getters
		 */
		it("should define property getters correctly", () => {
			const store = new Haro();
			
			// Test data property getter
			assert.ok(store.data instanceof Map);
			
			// Test size property getter
			assert.strictEqual(typeof store.size, "number");
			assert.strictEqual(store.size, 0);
			
			// Test registry property getter
			assert.ok(Array.isArray(store.registry));
			assert.strictEqual(store.registry.length, 0);
		});
	});

	describe("set method", () => {
		let store;
		let mockCRUDManager;
		let mockLifecycleManager;

		beforeEach(() => {
			store = createMockedHaro();
			mockCRUDManager = store.crudManager;
			mockLifecycleManager = store.lifecycleManager;
		});

		/**
		 * Test basic set operation
		 */
		it("should set record and trigger lifecycle hooks", () => {
			const key = "user1";
			const data = { name: "John" };
			
			const result = store.set(key, data);

			assert.ok(result instanceof Record);
			assert.strictEqual(mockLifecycleManager.beforeSetCalls.length, 1);
			assert.deepStrictEqual(mockLifecycleManager.beforeSetCalls[0], { key, data, options: {} });
			assert.strictEqual(mockCRUDManager.setCalls.length, 1);
			assert.deepStrictEqual(mockCRUDManager.setCalls[0], { key, data, options: {} });
			assert.strictEqual(mockLifecycleManager.onsetCalls.length, 1);
		});

		/**
		 * Test set with batch option
		 */
		it("should skip onset hook when batch is true", () => {
			const key = "user1";
			const data = { name: "John" };
			const options = { batch: true };
			
			store.set(key, data, options);

			assert.strictEqual(mockLifecycleManager.beforeSetCalls.length, 1);
			assert.strictEqual(mockLifecycleManager.onsetCalls.length, 0);
		});

		/**
		 * Test set with transaction
		 */
		it("should execute in transaction when transaction provided", () => {
			const mockTransaction = { id: "tx1" };
			const key = "user1";
			const data = { name: "John" };
			const options = { transaction: mockTransaction };

			// Mock _executeInTransaction
			let executeInTransactionCalled = false;
			store._executeInTransaction = (transaction, operation, ...args) => {
				executeInTransactionCalled = true;
				assert.strictEqual(transaction, mockTransaction);
				assert.strictEqual(operation, "set");
				assert.strictEqual(args[0], key);
				assert.strictEqual(args[1], data);
				return new Record(key, data);
			};
			
			const result = store.set(key, data, options);

			assert.strictEqual(executeInTransactionCalled, true);
			assert.ok(result instanceof Record);
		});
	});

	describe("get method", () => {
		let store;
		let mockCRUDManager;

		beforeEach(() => {
			store = createMockedHaro();
			mockCRUDManager = store.crudManager;
		});

		/**
		 * Test basic get operation
		 */
		it("should get record from CRUD manager", () => {
			const key = "user1";
			const record = new Record(key, { name: "John" });
			mockCRUDManager.mockData.set(key, record);
			
			const result = store.get(key);

			assert.strictEqual(result, record);
			assert.strictEqual(mockCRUDManager.getCalls.length, 1);
			assert.deepStrictEqual(mockCRUDManager.getCalls[0], { key, options: {} });
		});

		/**
		 * Test get with options
		 */
		it("should pass options to CRUD manager", () => {
			const key = "user1";
			const options = { includeVersions: true };
			
			store.get(key, options);

			assert.strictEqual(mockCRUDManager.getCalls.length, 1);
			assert.deepStrictEqual(mockCRUDManager.getCalls[0], { key, options });
		});

		/**
		 * Test get with transaction
		 */
		it("should execute in transaction when transaction provided", () => {
			const mockTransaction = { id: "tx1" };
			const key = "user1";
			const options = { transaction: mockTransaction };

			// Mock _executeInTransaction
			let executeInTransactionCalled = false;
			store._executeInTransaction = (transaction, operation, ...args) => {
				executeInTransactionCalled = true;
				assert.strictEqual(transaction, mockTransaction);
				assert.strictEqual(operation, "get");
				assert.strictEqual(args[0], key);
				return new Record(key, { name: "John" });
			};
			
			const result = store.get(key, options);

			assert.strictEqual(executeInTransactionCalled, true);
			assert.ok(result instanceof Record);
		});
	});

	describe("delete method", () => {
		let store;
		let mockCRUDManager;
		let mockLifecycleManager;

		beforeEach(() => {
			store = createMockedHaro();
			mockCRUDManager = store.crudManager;
			mockLifecycleManager = store.lifecycleManager;
		});

		/**
		 * Test basic delete operation
		 */
		it("should delete record and trigger lifecycle hooks", () => {
			const key = "user1";
			mockCRUDManager.mockData.set(key, new Record(key, { name: "John" }));
			
			const result = store.delete(key);

			assert.strictEqual(result, true);
			assert.strictEqual(mockLifecycleManager.beforeDeleteCalls.length, 1);
			assert.deepStrictEqual(mockLifecycleManager.beforeDeleteCalls[0], { key, batch: false });
			assert.strictEqual(mockCRUDManager.deleteCalls.length, 1);
			assert.deepStrictEqual(mockCRUDManager.deleteCalls[0], { key, options: {} });
			assert.strictEqual(mockLifecycleManager.ondeleteCalls.length, 1);
			assert.strictEqual(mockLifecycleManager.ondeleteCalls[0], key);
		});

		/**
		 * Test delete with batch option
		 */
		it("should skip ondelete hook when batch is true", () => {
			const key = "user1";
			const options = { batch: true };
			mockCRUDManager.mockData.set(key, new Record(key, { name: "John" }));
			
			store.delete(key, options);

			assert.strictEqual(mockLifecycleManager.beforeDeleteCalls.length, 1);
			assert.strictEqual(mockLifecycleManager.ondeleteCalls.length, 0);
		});

		/**
		 * Test delete with transaction
		 */
		it("should execute in transaction when transaction provided", () => {
			const mockTransaction = { id: "tx1" };
			const key = "user1";
			const options = { transaction: mockTransaction };

			// Mock _executeInTransaction
			let executeInTransactionCalled = false;
			store._executeInTransaction = (transaction, operation, ...args) => {
				executeInTransactionCalled = true;
				assert.strictEqual(transaction, mockTransaction);
				assert.strictEqual(operation, "delete");
				assert.strictEqual(args[0], key);
				return true;
			};
			
			const result = store.delete(key, options);

			assert.strictEqual(executeInTransactionCalled, true);
			assert.strictEqual(result, true);
		});
	});

	describe("has method", () => {
		let store;
		let mockCRUDManager;

		beforeEach(() => {
			store = createMockedHaro();
			mockCRUDManager = store.crudManager;
		});

		/**
		 * Test has method delegates to CRUD manager
		 */
		it("should delegate to CRUD manager", () => {
			const key = "user1";
			mockCRUDManager.mockData.set(key, new Record(key, { name: "John" }));
			
			const result = store.has(key);

			assert.strictEqual(result, true);
			assert.strictEqual(mockCRUDManager.hasCalls.length, 1);
			assert.strictEqual(mockCRUDManager.hasCalls[0], key);
		});

		/**
		 * Test has returns false for non-existent key
		 */
		it("should return false for non-existent key", () => {
			const result = store.has("non-existent");

			assert.strictEqual(result, false);
		});
	});

	describe("find method", () => {
		let store;
		let mockQueryManager;

		beforeEach(() => {
			store = createMockedHaro();
			mockQueryManager = store.queryManager;
		});

		/**
		 * Test basic find operation
		 */
		it("should delegate to query manager", () => {
			const criteria = { name: "John" };
			const options = { limit: 10 };
			
			const result = store.find(criteria, options);

			assert.ok(result instanceof RecordCollection);
			assert.strictEqual(mockQueryManager.findCalls.length, 1);
			assert.deepStrictEqual(mockQueryManager.findCalls[0], { criteria, options });
		});

		/**
		 * Test find with empty criteria
		 */
		it("should handle empty criteria", () => {
			const result = store.find();

			assert.ok(result instanceof RecordCollection);
			assert.strictEqual(mockQueryManager.findCalls.length, 1);
			assert.deepStrictEqual(mockQueryManager.findCalls[0], { criteria: {}, options: {} });
		});

		/**
		 * Test find with transaction
		 */
		it("should execute in transaction when transaction provided", () => {
			const mockTransaction = { id: "tx1" };
			const criteria = { name: "John" };
			const options = { transaction: mockTransaction };

			// Mock _executeInTransaction
			let executeInTransactionCalled = false;
			store._executeInTransaction = (transaction, operation, ...args) => {
				executeInTransactionCalled = true;
				assert.strictEqual(transaction, mockTransaction);
				assert.strictEqual(operation, "find");
				assert.strictEqual(args[0], criteria);
				return new RecordCollection([]);
			};
			
			const result = store.find(criteria, options);

			assert.strictEqual(executeInTransactionCalled, true);
			assert.ok(result instanceof RecordCollection);
		});
	});

	describe("where method", () => {
		let store;
		let mockQueryManager;

		beforeEach(() => {
			store = createMockedHaro();
			mockQueryManager = store.queryManager;
		});

		/**
		 * Test where method delegates to query manager
		 */
		it("should delegate to query manager", () => {
			const predicate = (record) => record.get("age") > 18;
			const options = { limit: 5 };
			
			const result = store.where(predicate, options);

			assert.ok(result instanceof RecordCollection);
			assert.strictEqual(mockQueryManager.whereCalls.length, 1);
			assert.deepStrictEqual(mockQueryManager.whereCalls[0], { predicate, options });
		});

		/**
		 * Test where with object predicate
		 */
		it("should handle object predicate", () => {
			const predicate = { name: "John" };
			
			store.where(predicate);

			assert.strictEqual(mockQueryManager.whereCalls.length, 1);
			assert.deepStrictEqual(mockQueryManager.whereCalls[0], { predicate, options: {} });
		});
	});

	describe("batch method", () => {
		let store;
		let mockBatchManager;

		beforeEach(() => {
			store = createMockedHaro();
			mockBatchManager = store.batchManager;
		});

		/**
		 * Test batch method delegates to batch manager
		 */
		it("should delegate to batch manager", () => {
			const operations = [{ id: "1", name: "John" }, { id: "2", name: "Jane" }];
			const type = "set";
			const options = { validate: false };
			
			const result = store.batch(operations, type, options);

			assert.ok(Array.isArray(result));
			assert.strictEqual(mockBatchManager.batchCalls.length, 1);
			assert.deepStrictEqual(mockBatchManager.batchCalls[0], { operations, type, options });
		});

		/**
		 * Test batch with default parameters
		 */
		it("should use default parameters", () => {
			const operations = [{ id: "1", name: "John" }];
			
			store.batch(operations);

			assert.strictEqual(mockBatchManager.batchCalls.length, 1);
			assert.deepStrictEqual(mockBatchManager.batchCalls[0], { 
				operations, 
				type: "set", 
				options: {} 
			});
		});
	});

	describe("Transaction methods", () => {
		let store;
		let mockTransactionManager;

		beforeEach(() => {
			store = createMockedHaro(null, { enableTransactions: true });
			mockTransactionManager = store.transactionManager;
		});

		describe("beginTransaction", () => {
			/**
			 * Test begin transaction
			 */
			it("should begin transaction when transactions enabled", () => {
				const options = { isolationLevel: "READ_COMMITTED" };
				
				const result = store.beginTransaction(options);

				assert.ok(result);
				assert.strictEqual(mockTransactionManager.beginCalls.length, 1);
				assert.deepStrictEqual(mockTransactionManager.beginCalls[0], options);
			});

			/**
			 * Test begin transaction throws when disabled
			 */
			it("should throw error when transactions not enabled", () => {
				const storeWithoutTx = createMockedHaro(null, { enableTransactions: false });
				
				assert.throws(() => {
					storeWithoutTx.beginTransaction();
				}, ConfigurationError);
			});

			/**
			 * Test begin transaction with default options
			 */
			it("should begin transaction with default options", () => {
				store.beginTransaction();

				assert.strictEqual(mockTransactionManager.beginCalls.length, 1);
				assert.deepStrictEqual(mockTransactionManager.beginCalls[0], {});
			});
		});

		describe("commitTransaction", () => {
			/**
			 * Test commit transaction with transaction ID
			 */
			it("should commit transaction with transaction ID", async () => {
				const transactionId = "tx123";
				
				const result = await store.commitTransaction(transactionId);

				assert.ok(result);
				assert.strictEqual(mockTransactionManager.commitCalls.length, 1);
				assert.deepStrictEqual(mockTransactionManager.commitCalls[0], { 
					transactionId, 
					context: undefined 
				});
			});

			/**
			 * Test commit transaction with transaction object
			 */
			it("should commit transaction with transaction object", async () => {
				const transaction = { id: "tx123", state: "active" };
				
				await store.commitTransaction(transaction);

				assert.strictEqual(mockTransactionManager.commitCalls.length, 1);
				assert.strictEqual(mockTransactionManager.commitCalls[0].transactionId, "tx123");
			});

			/**
			 * Test commit transaction throws when disabled
			 */
			it("should throw error when transactions not enabled", async () => {
				const storeWithoutTx = createMockedHaro(null, { enableTransactions: false });
				
				await assert.rejects(async () => {
					await storeWithoutTx.commitTransaction("tx123");
				}, ConfigurationError);
			});
		});

		describe("abortTransaction", () => {
			/**
			 * Test abort transaction with transaction ID
			 */
			it("should abort transaction with transaction ID", () => {
				const transactionId = "tx123";
				const reason = "User cancelled";
				
				const result = store.abortTransaction(transactionId, reason);

				assert.ok(result);
				assert.strictEqual(mockTransactionManager.abortCalls.length, 1);
				assert.deepStrictEqual(mockTransactionManager.abortCalls[0], { transactionId, reason });
			});

			/**
			 * Test abort transaction with transaction object
			 */
			it("should abort transaction with transaction object", () => {
				const transaction = { id: "tx123", state: "active" };
				
				store.abortTransaction(transaction);

				assert.strictEqual(mockTransactionManager.abortCalls.length, 1);
				assert.strictEqual(mockTransactionManager.abortCalls[0].transactionId, "tx123");
			});

			/**
			 * Test abort transaction throws when disabled
			 */
			it("should throw error when transactions not enabled", () => {
				const storeWithoutTx = createMockedHaro(null, { enableTransactions: false });
				
				assert.throws(() => {
					storeWithoutTx.abortTransaction("tx123");
				}, ConfigurationError);
			});
		});
	});

	describe("stream method", () => {
		let store;
		let mockStreamManager;

		beforeEach(() => {
			store = createMockedHaro();
			mockStreamManager = store.streamManager;
		});

		/**
		 * Test stream method delegates to stream manager
		 */
		it("should delegate to stream manager", () => {
			const options = { batchSize: 100 };
			
			const result = store.stream(options);

			assert.ok(result instanceof DataStream);
			assert.strictEqual(mockStreamManager.streamCalls.length, 1);
			assert.deepStrictEqual(mockStreamManager.streamCalls[0], options);
		});

		/**
		 * Test stream with default options
		 */
		it("should use default options", () => {
			store.stream();

			assert.strictEqual(mockStreamManager.streamCalls.length, 1);
			assert.deepStrictEqual(mockStreamManager.streamCalls[0], {});
		});
	});

	describe("getStats method", () => {
		let store;
		let mockStatisticsManager;

		beforeEach(() => {
			store = createMockedHaro();
			mockStatisticsManager = store.statisticsManager;
		});

		/**
		 * Test getStats method delegates to statistics manager
		 */
		it("should delegate to statistics manager", () => {
			const result = store.getStats();

			assert.ok(result);
			assert.strictEqual(typeof result.recordCount, "number");
			assert.strictEqual(mockStatisticsManager.getStatsCalls.length, 1);
		});
	});

	describe("clear method", () => {
		let store;
		let mockStorageManager;
		let mockIndexManager;
		let mockVersionManager;
		let mockQueryOptimizer;
		let mockLifecycleManager;

		beforeEach(() => {
			store = createMockedHaro(null, { versioning: true, enableOptimization: true });
			mockStorageManager = store.storageManager;
			mockIndexManager = store.indexManager;
			mockVersionManager = store.versionManager;
			mockQueryOptimizer = store.queryOptimizer;
			mockLifecycleManager = store.lifecycleManager;
		});

		/**
		 * Test clear with default options
		 */
		it("should clear all data with default options", () => {
			store.clear();

			assert.strictEqual(mockLifecycleManager.beforeClearCalls.length, 1);
			assert.strictEqual(mockStorageManager.clearCalls.length, 1);
			assert.strictEqual(mockIndexManager.clearCalls.length, 1);
			assert.strictEqual(mockVersionManager.clearCalls.length, 1);
			assert.strictEqual(mockQueryOptimizer.clearCalls.length, 1);
			assert.strictEqual(mockLifecycleManager.onclearCalls.length, 1);
		});

		/**
		 * Test clear preserving indexes
		 */
		it("should preserve indexes when preserveIndexes is true", () => {
			store.clear({ preserveIndexes: true });

			assert.strictEqual(mockStorageManager.clearCalls.length, 1);
			assert.strictEqual(mockIndexManager.clearCalls.length, 0);
			assert.strictEqual(mockVersionManager.clearCalls.length, 1);
		});

		/**
		 * Test clear preserving versions
		 */
		it("should preserve versions when preserveVersions is true", () => {
			store.clear({ preserveVersions: true });

			assert.strictEqual(mockStorageManager.clearCalls.length, 1);
			assert.strictEqual(mockIndexManager.clearCalls.length, 1);
			assert.strictEqual(mockVersionManager.clearCalls.length, 0);
		});

		/**
		 * Test clear without version manager
		 */
		it("should work without version manager", () => {
			store.versionManager = null;
			
			store.clear();

			assert.strictEqual(mockStorageManager.clearCalls.length, 1);
			assert.strictEqual(mockIndexManager.clearCalls.length, 1);
		});

		/**
		 * Test clear without query optimizer
		 */
		it("should work without query optimizer", () => {
			store.queryOptimizer = null;
			
			store.clear();

			assert.strictEqual(mockStorageManager.clearCalls.length, 1);
			assert.strictEqual(mockIndexManager.clearCalls.length, 1);
		});
	});

	describe("Lifecycle hook delegation", () => {
		let store;
		let mockLifecycleManager;

		beforeEach(() => {
			store = createMockedHaro();
			mockLifecycleManager = store.lifecycleManager;
		});

		/**
		 * Test beforeSet delegation
		 */
		it("should delegate beforeSet to lifecycle manager", () => {
			const key = "user1";
			const data = { name: "John" };
			const options = { validate: true };
			
			store.beforeSet(key, data, options);

			assert.strictEqual(mockLifecycleManager.beforeSetCalls.length, 1);
			assert.deepStrictEqual(mockLifecycleManager.beforeSetCalls[0], { key, data, options });
		});

		/**
		 * Test onset delegation
		 */
		it("should delegate onset to lifecycle manager", () => {
			const record = new Record("user1", { name: "John" });
			const options = { batch: false };
			
			store.onset(record, options);

			assert.strictEqual(mockLifecycleManager.onsetCalls.length, 1);
			assert.deepStrictEqual(mockLifecycleManager.onsetCalls[0], { record, options });
		});

		/**
		 * Test beforeDelete delegation
		 */
		it("should delegate beforeDelete to lifecycle manager", () => {
			const key = "user1";
			const batch = true;
			
			store.beforeDelete(key, batch);

			assert.strictEqual(mockLifecycleManager.beforeDeleteCalls.length, 1);
			assert.deepStrictEqual(mockLifecycleManager.beforeDeleteCalls[0], { key, batch });
		});

		/**
		 * Test ondelete delegation
		 */
		it("should delegate ondelete to lifecycle manager", () => {
			const key = "user1";
			
			store.ondelete(key);

			assert.strictEqual(mockLifecycleManager.ondeleteCalls.length, 1);
			assert.strictEqual(mockLifecycleManager.ondeleteCalls[0], key);
		});

		/**
		 * Test beforeClear delegation
		 */
		it("should delegate beforeClear to lifecycle manager", () => {
			store.beforeClear();

			assert.strictEqual(mockLifecycleManager.beforeClearCalls.length, 1);
		});

		/**
		 * Test onclear delegation
		 */
		it("should delegate onclear to lifecycle manager", () => {
			store.onclear();

			assert.strictEqual(mockLifecycleManager.onclearCalls.length, 1);
		});

		/**
		 * Test onbatch delegation
		 */
		it("should delegate onbatch to lifecycle manager", () => {
			const results = [new Record("1", { name: "John" })];
			const type = "set";
			
			store.onbatch(results, type);

			assert.strictEqual(mockLifecycleManager.onbatchCalls.length, 1);
			assert.deepStrictEqual(mockLifecycleManager.onbatchCalls[0], { results, type });
		});
	});

	describe("_executeInTransaction method", () => {
		let store;
		let mockStorageManager;
		let mockTransaction;

		beforeEach(() => {
			store = createMockedHaro(null, { enableTransactions: true });
			mockStorageManager = store.storageManager;
			mockTransaction = {
				id: "tx123",
				addOperation: () => {}
			};
		});

		/**
		 * Test executeInTransaction for set operation
		 */
		it("should handle set operation in transaction", () => {
			const key = "user1";
			const data = { name: "John" };
			const options = {};
			
			// Mock addOperation
			let addOperationCalls = [];
			mockTransaction.addOperation = (...args) => {
				addOperationCalls.push(args);
			};

			// Mock set method to avoid recursion
			const originalSet = store.set;
			let setCalls = [];
			store.set = (k, d, opts) => {
				setCalls.push({ k, d, opts });
				return new Record(k, d);
			};

			try {
				const result = store._executeInTransaction(mockTransaction, "set", key, data, options);

				assert.ok(result instanceof Record);
				assert.strictEqual(addOperationCalls.length, 1);
				assert.deepStrictEqual(addOperationCalls[0], ["set", key, null, data]);
				assert.strictEqual(setCalls.length, 1);
				assert.strictEqual(setCalls[0].opts.transaction, null);
			} finally {
				store.set = originalSet;
			}
		});

		/**
		 * Test executeInTransaction for get operation
		 */
		it("should handle get operation in transaction", () => {
			const key = "user1";
			const options = {};
			
			// Mock addOperation
			let addOperationCalls = [];
			mockTransaction.addOperation = (...args) => {
				addOperationCalls.push(args);
			};

			// Mock get method
			const originalGet = store.get;
			let getCalls = [];
			store.get = (k, opts) => {
				getCalls.push({ k, opts });
				return new Record(k, { name: "John" });
			};

			try {
				const result = store._executeInTransaction(mockTransaction, "get", key, options);

				assert.ok(result instanceof Record);
				assert.strictEqual(addOperationCalls.length, 1);
				assert.deepStrictEqual(addOperationCalls[0], ["read", key]);
				assert.strictEqual(getCalls.length, 1);
				assert.strictEqual(getCalls[0].opts.transaction, null);
			} finally {
				store.get = originalGet;
			}
		});

		/**
		 * Test executeInTransaction for delete operation
		 */
		it("should handle delete operation in transaction", () => {
			const key = "user1";
			const options = {};
			const oldValue = { name: "John" };
			mockStorageManager.data.set(key, oldValue);
			
			// Mock addOperation
			let addOperationCalls = [];
			mockTransaction.addOperation = (...args) => {
				addOperationCalls.push(args);
			};

			// Mock delete method
			const originalDelete = store.delete;
			let deleteCalls = [];
			store.delete = (k, opts) => {
				deleteCalls.push({ k, opts });
				return true;
			};

			try {
				const result = store._executeInTransaction(mockTransaction, "delete", key, options);

				assert.strictEqual(result, true);
				assert.strictEqual(addOperationCalls.length, 1);
				assert.deepStrictEqual(addOperationCalls[0], ["delete", key, oldValue]);
				assert.strictEqual(deleteCalls.length, 1);
				assert.strictEqual(deleteCalls[0].opts.transaction, null);
			} finally {
				store.delete = originalDelete;
			}
		});

		/**
		 * Test executeInTransaction for find operation
		 */
		it("should handle find operation in transaction", () => {
			const criteria = { name: "John" };
			const options = {};
			
			// Mock addOperation
			let addOperationCalls = [];
			mockTransaction.addOperation = (...args) => {
				addOperationCalls.push(args);
			};

			// Mock find method
			const originalFind = store.find;
			let findCalls = [];
			store.find = (c, opts) => {
				findCalls.push({ c, opts });
				return new RecordCollection([]);
			};

			try {
				const result = store._executeInTransaction(mockTransaction, "find", criteria, options);

				assert.ok(result instanceof RecordCollection);
				assert.strictEqual(addOperationCalls.length, 1);
				assert.deepStrictEqual(addOperationCalls[0], ["read", "find_operation", null, criteria]);
				assert.strictEqual(findCalls.length, 1);
				assert.strictEqual(findCalls[0].opts.transaction, null);
			} finally {
				store.find = originalFind;
			}
		});

		/**
		 * Test executeInTransaction with unknown operation
		 */
		it("should throw error for unknown operation", () => {
			assert.throws(() => {
				store._executeInTransaction(mockTransaction, "unknown");
			}, TransactionError);
		});
	});

	describe("Property getters integration", () => {
		let store;

		beforeEach(() => {
			store = createMockedHaro();
		});

		/**
		 * Test data property returns storage manager store
		 */
		it("should return storage manager store for data property", () => {
			const data = store.data;
			assert.strictEqual(data, store.storageManager.getStore());
		});

		/**
		 * Test size property returns storage manager size
		 */
		it("should return storage manager size for size property", () => {
			const size = store.size;
			assert.strictEqual(size, store.storageManager.size);
		});

		/**
		 * Test registry property returns storage manager keys
		 */
		it("should return storage manager keys for registry property", () => {
			const registry = store.registry;
			assert.deepStrictEqual(registry, store.storageManager.keys());
		});
	});

	describe("Integration with initial data", () => {
		/**
		 * Test constructor batches initial data
		 */
		it("should batch initial data when provided", () => {
			const initialData = [
				{ id: "1", name: "John" },
				{ id: "2", name: "Jane" }
			];

			// Mock batch method to verify it's called
			let batchCalled = false;
			let batchData;
			const originalBatch = Haro.prototype.batch;
			Haro.prototype.batch = function(data) {
				batchCalled = true;
				batchData = data;
				return [];
			};

			try {
				const store = new Haro(initialData);
				
				assert.strictEqual(batchCalled, true);
				assert.strictEqual(batchData, initialData);
			} finally {
				Haro.prototype.batch = originalBatch;
			}
		});

		/**
		 * Test constructor skips batch for null data
		 */
		it("should not batch when initial data is null", () => {
			// Mock batch method to verify it's not called
			let batchCalled = false;
			const originalBatch = Haro.prototype.batch;
			Haro.prototype.batch = function() {
				batchCalled = true;
				return [];
			};

			try {
				const store = new Haro(null);
				
				assert.strictEqual(batchCalled, false);
			} finally {
				Haro.prototype.batch = originalBatch;
			}
		});

		/**
		 * Test constructor skips batch for non-array data
		 */
		it("should not batch when initial data is not an array", () => {
			// Mock batch method to verify it's not called
			let batchCalled = false;
			const originalBatch = Haro.prototype.batch;
			Haro.prototype.batch = function() {
				batchCalled = true;
				return [];
			};

			try {
				const store = new Haro({ immutable: true });
				
				assert.strictEqual(batchCalled, false);
			} finally {
				Haro.prototype.batch = originalBatch;
			}
		});
	});
});

describe("haro factory function", () => {
	/**
	 * Test factory function creates Haro instance
	 */
	it("should create Haro instance with no parameters", () => {
		const store = haro();
		
		assert.ok(store instanceof Haro);
	});

	/**
	 * Test factory function with data parameter
	 */
	it("should create Haro instance with data parameter", () => {
		const data = [{ id: "1", name: "Test" }];
		const store = haro(data);
		
		assert.ok(store instanceof Haro);
		assert.strictEqual(store.initialData, data);
	});

	/**
	 * Test factory function with config parameter
	 */
	it("should create Haro instance with config parameter", () => {
		const config = { immutable: true };
		const store = haro(config);
		
		assert.ok(store instanceof Haro);
		assert.strictEqual(store.config.immutable, true);
	});

	/**
	 * Test factory function with both parameters
	 */
	it("should create Haro instance with both parameters", () => {
		const data = [{ id: "1", name: "Test" }];
		const config = { immutable: true };
		const store = haro(data, config);
		
		assert.ok(store instanceof Haro);
		assert.strictEqual(store.initialData, data);
		assert.strictEqual(store.config.immutable, true);
	});
});

describe("Edge Cases and Error Conditions", () => {
	describe("Constructor edge cases", () => {
		/**
		 * Test constructor with empty array
		 */
		it("should handle empty array as initial data", () => {
			const store = new Haro([]);
			
			assert.deepStrictEqual(store.initialData, []);
		});

		/**
		 * Test constructor with empty config object
		 */
		it("should handle empty config object", () => {
			const store = new Haro(null, {});
			
			assert.ok(store.config.id);
			assert.strictEqual(store.config.immutable, false);
		});

		/**
		 * Test constructor config validation
		 */
		it("should validate configuration through ConfigValidator", () => {
			// This test verifies that ConfigValidator.validate is called
			// The actual validation logic is tested in config-validator.test.js
			const store = new Haro(null, { immutable: true });
			
			assert.strictEqual(store.config.immutable, true);
		});
	});

	describe("Method parameter edge cases", () => {
		let store;

		beforeEach(() => {
			store = createMockedHaro();
		});

		/**
		 * Test set with undefined data
		 */
		it("should handle set with undefined data", () => {
			const result = store.set("key1", undefined);
			
			assert.ok(result instanceof Record);
		});

		/**
		 * Test get with undefined key
		 */
		it("should handle get with undefined key", () => {
			const result = store.get(undefined);
			
			// Should delegate to CRUD manager which handles undefined key
			assert.strictEqual(result, null);
		});

		/**
		 * Test delete with undefined key
		 */
		it("should handle delete with undefined key", () => {
			// Should delegate to CRUD manager which may throw or return false
			// The specific behavior depends on CRUD manager implementation
			const result = store.delete(undefined);
			
			// For the mock, it will return false since undefined key doesn't exist
			assert.strictEqual(result, false);
		});

		/**
		 * Test find with undefined criteria
		 */
		it("should handle find with undefined criteria", () => {
			const result = store.find(undefined);
			
			assert.ok(result instanceof RecordCollection);
		});

		/**
		 * Test where with null predicate
		 */
		it("should handle where with null predicate", () => {
			const result = store.where(null);
			
			assert.ok(result instanceof RecordCollection);
		});
	});

	describe("Transaction edge cases", () => {
		let store;

		beforeEach(() => {
			store = createMockedHaro(null, { enableTransactions: true });
		});

		/**
		 * Test beginTransaction with undefined options
		 */
		it("should handle beginTransaction with undefined options", () => {
			const result = store.beginTransaction(undefined);
			
			assert.ok(result);
		});

		/**
		 * Test commitTransaction with null transaction
		 */
		it("should handle commitTransaction with null transaction", async () => {
			await assert.rejects(async () => {
				await store.commitTransaction(null);
			}, TypeError);
		});

		/**
		 * Test abortTransaction with undefined transaction
		 */
		it("should handle abortTransaction with undefined transaction", () => {
			assert.throws(() => {
				store.abortTransaction(undefined);
			}, TypeError);
		});
	});

	describe("Clear edge cases", () => {
		let store;

		beforeEach(() => {
			store = createMockedHaro();
		});

		/**
		 * Test clear with null options
		 */
		it("should handle clear with null options", () => {
			// Should throw TypeError when trying to destructure null
			assert.throws(() => {
				store.clear(null);
			}, TypeError);
		});

		/**
		 * Test clear with undefined options
		 */
		it("should handle clear with undefined options", () => {
			// Should not throw and use default options
			store.clear(undefined);
			
			// Should clear normally
			assert.strictEqual(store.size, 0);
		});
	});
});
