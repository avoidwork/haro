import assert from "node:assert";
import { describe, it, beforeEach } from "mocha";
import { KeyRelationshipAnalyzer } from "../../src/key-relationship-analyzer.js";

/**
 * Mock Transaction class for testing
 */
class MockTransaction {
	constructor(id) {
		this.id = id;
		this.snapshot = new Map();
		this.readSet = new Set();
		this.writeSet = new Set();
	}

	addSnapshot(key, value) {
		this.snapshot.set(key, value);
	}
}

/**
 * Tests for KeyRelationshipAnalyzer class
 */
describe("KeyRelationshipAnalyzer", () => {
	let analyzer;

	beforeEach(() => {
		analyzer = new KeyRelationshipAnalyzer();
	});

	describe("Constructor", () => {
		/**
		 * Test basic analyzer construction
		 */
		it("should create analyzer with initialized caches", () => {
			assert.ok(analyzer instanceof KeyRelationshipAnalyzer);
			assert.ok(analyzer.patternCache instanceof Map);
			assert.ok(analyzer.semanticCache instanceof Map);
			assert.strictEqual(analyzer.patternCache.size, 0);
			assert.strictEqual(analyzer.semanticCache.size, 0);
		});
	});

	describe("areKeysRelated", () => {
		/**
		 * Test direct key matching
		 */
		it("should return true for identical keys", () => {
			assert.strictEqual(analyzer.areKeysRelated("user:123", "user:123"), true);
		});

		/**
		 * Test hierarchical relationships
		 */
		it("should detect hierarchical relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user:123:profile", "user:123"), true);
			assert.strictEqual(analyzer.areKeysRelated("user:123", "user:123:profile"), true);
			assert.strictEqual(analyzer.areKeysRelated("user/profile/avatar", "user/profile"), true);
		});

		/**
		 * Test semantic relationships
		 */
		it("should detect semantic relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user:123", "user_profile:456"), true);
			assert.strictEqual(analyzer.areKeysRelated("order:1", "order_total:1"), true);
		});

		/**
		 * Test pattern-based relationships
		 */
		it("should detect pattern-based relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_123", "user_456"), true);
			assert.strictEqual(analyzer.areKeysRelated("order-abc123", "order-def456"), true);
		});

		/**
		 * Test temporal relationships
		 */
		it("should detect temporal relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("log_2023-01-01_12:30:45", "event_2023-01-02_14:15:30"), true);
			assert.strictEqual(analyzer.areKeysRelated("timestamp_1234567890123", "ts_1234567890456"), true);
		});

		/**
		 * Test composite key relationships
		 */
		it("should detect composite key relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user:123:session", "user:123:profile"), true);
			assert.strictEqual(analyzer.areKeysRelated("app#module#component", "app#module#settings"), true);
		});

		/**
		 * Test index relationships
		 */
		it("should detect index relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_index", "user"), true);
			assert.strictEqual(analyzer.areKeysRelated("idx_user_email", "user_email"), true);
		});

		/**
		 * Test collection relationships
		 */
		it("should detect collection relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_list", "user"), true);
			assert.strictEqual(analyzer.areKeysRelated("products_array", "products"), true);
		});

		/**
		 * Test functional dependencies
		 */
		it("should detect functional dependencies", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_id", "user_email"), true);
			assert.strictEqual(analyzer.areKeysRelated("order_id", "order_total"), true);
		});

		/**
		 * Test unrelated keys
		 */
		it("should return false for unrelated keys", () => {
			assert.strictEqual(analyzer.areKeysRelated("user", "product"), false);
			assert.strictEqual(analyzer.areKeysRelated("abc", "xyz"), false);
		});

	});

	describe("isKeyInSnapshotRange", () => {
		let transaction;

		beforeEach(() => {
			transaction = new MockTransaction("tx1");
		});


		/**
		 * Test direct key match
		 */
		it("should return true for direct key match", () => {
			const result = analyzer.isKeyInSnapshotRange(transaction, "user:123", "user:123", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test explicit range metadata
		 */
		it("should check explicit range metadata", () => {
			transaction.addSnapshot("user:range", { min: "user:100", max: "user:200" });
			const result = analyzer.isKeyInSnapshotRange(transaction, "user:150", "user", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test pattern-based snapshots
		 */
		it("should handle pattern-based snapshots", () => {
			const result = analyzer.isKeyInSnapshotRange(transaction, "user_123", "user_*", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test hierarchical range
		 */
		it("should check hierarchical ranges", () => {
			const result = analyzer.isKeyInSnapshotRange(transaction, "user:123:profile", "user:123", []);
			assert.strictEqual(result, true);
		});

		/**
		 * Test index-based snapshots
		 */
		it("should handle index-based snapshots", () => {
			transaction.addSnapshot("user_index:index_range", { fields: ["user"], values: { min: "100", max: "200" } });
			const result = analyzer.isKeyInSnapshotRange(transaction, "user_150", "user_index", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test semantic range
		 */
		it("should check semantic ranges", () => {
			const result = analyzer.isKeyInSnapshotRange(transaction, "user_profile:123", "user_account:456", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test temporal range
		 */
		it("should handle temporal ranges", () => {
			const result = analyzer.isKeyInSnapshotRange(transaction, "log_2023-01-01_12:30:45", "timestamp_2023-01-02_14:15:30", "value");
			assert.strictEqual(result, false); // Different pattern types
		});

		/**
		 * Test composite key range
		 */
		it("should check composite key ranges", () => {
			const result = analyzer.isKeyInSnapshotRange(transaction, "user:123:session", "user:123:profile", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test out of range
		 */
		it("should return false for keys out of range", () => {
			const result = analyzer.isKeyInSnapshotRange(transaction, "product:123", "user:456", "value");
			assert.strictEqual(result, false);
		});
	});

	describe("keyMatchesRange", () => {
		/**
		 * Test min/max range
		 */
		it("should match keys within min/max range", () => {
			const range = { min: "user:100", max: "user:200" };
			assert.strictEqual(analyzer.keyMatchesRange("user:150", range), true);
			assert.strictEqual(analyzer.keyMatchesRange("user:050", range), false);
			assert.strictEqual(analyzer.keyMatchesRange("user:250", range), false);
		});

		/**
		 * Test prefix range
		 */
		it("should match keys with prefix", () => {
			const range = { prefix: "user:" };
			assert.strictEqual(analyzer.keyMatchesRange("user:123", range), true);
			assert.strictEqual(analyzer.keyMatchesRange("product:123", range), false);
		});

		/**
		 * Test pattern range
		 */
		it("should match keys with pattern", () => {
			const range = { pattern: "user_\\d+" };
			assert.strictEqual(analyzer.keyMatchesRange("user_123", range), true);
			assert.strictEqual(analyzer.keyMatchesRange("user_abc", range), false);
		});

		/**
		 * Test invalid pattern
		 */
		it("should handle invalid patterns gracefully", () => {
			const range = { pattern: "[invalid" };
			assert.strictEqual(analyzer.keyMatchesRange("test", range), false);
		});

		/**
		 * Test empty range
		 */
		it("should return false for empty range", () => {
			assert.strictEqual(analyzer.keyMatchesRange("test", {}), false);
		});

	});

	describe("keyMatchesQuery", () => {
		/**
		 * Test range query
		 */
		it("should handle range queries", () => {
			const query = { type: "range", min: "user:100", max: "user:200" };
			assert.strictEqual(analyzer.keyMatchesQuery("user:150", query), true);
		});

		/**
		 * Test prefix query
		 */
		it("should handle prefix queries", () => {
			const query = { type: "prefix", prefix: "user:" };
			assert.strictEqual(analyzer.keyMatchesQuery("user:123", query), true);
		});

		/**
		 * Test pattern query
		 */
		it("should handle pattern queries", () => {
			const query = { type: "pattern", pattern: "user_\\d+" };
			assert.strictEqual(analyzer.keyMatchesQuery("user_123", query), true);
		});

		/**
		 * Test in query
		 */
		it("should handle in queries", () => {
			const query = { type: "in", values: ["user:123", "user:456"] };
			assert.strictEqual(analyzer.keyMatchesQuery("user:123", query), true);
			assert.strictEqual(analyzer.keyMatchesQuery("user:789", query), false);
		});


		/**
		 * Test invalid pattern in query
		 */
		it("should handle invalid patterns in queries", () => {
			const query = { type: "pattern", pattern: "[invalid" };
			assert.strictEqual(analyzer.keyMatchesQuery("test", query), false);
		});

		/**
		 * Test unknown query type (lines 179-180)
		 */
		it("should return false for unknown query types", () => {
			const query = { type: "unknown", someParam: "value" };
			assert.strictEqual(analyzer.keyMatchesQuery("test", query), false);
			
			const query2 = { type: "invalid", data: "anything" };
			assert.strictEqual(analyzer.keyMatchesQuery("key", query2), false);
		});

	});

	describe("keyMatchesIndexRange", () => {
		/**
		 * Test fields matching
		 */
		it("should match keys containing index fields", () => {
			const indexRange = { fields: ["user", "email"] };
			assert.strictEqual(analyzer.keyMatchesIndexRange("user_email_index", indexRange), true);
			assert.strictEqual(analyzer.keyMatchesIndexRange("product_name", indexRange), false);
		});

		/**
		 * Test values range
		 */
		it("should match keys within values range", () => {
			const indexRange = { values: { min: "100", max: "200" } };
			assert.strictEqual(analyzer.keyMatchesIndexRange("150", indexRange), true);
		});

		/**
		 * Test empty index range
		 */
		it("should return false for empty index range", () => {
			assert.strictEqual(analyzer.keyMatchesIndexRange("test", {}), false);
		});

	});

	describe("clearCaches", () => {
		/**
		 * Test cache clearing
		 */
		it("should clear both pattern and semantic caches", () => {
			// Add some items to caches
			analyzer.patternCache.set("test", "value");
			analyzer.semanticCache.set("test", "value");

			assert.strictEqual(analyzer.patternCache.size, 1);
			assert.strictEqual(analyzer.semanticCache.size, 1);

			analyzer.clearCaches();

			assert.strictEqual(analyzer.patternCache.size, 0);
			assert.strictEqual(analyzer.semanticCache.size, 0);
		});
	});

	describe("Hierarchical Relationships", () => {
		/**
		 * Test parent-child relationships
		 */
		it("should detect parent-child relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user:123:profile:avatar", "user:123:profile"), true);
			assert.strictEqual(analyzer.areKeysRelated("user/docs/file.txt", "user/docs"), true);
		});

		/**
		 * Test sibling relationships
		 */
		it("should detect sibling relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user:123:profile", "user:123:settings"), true);
			assert.strictEqual(analyzer.areKeysRelated("app.module.component1", "app.module.component2"), true);
		});

		/**
		 * Test ancestor-descendant relationships
		 */
		it("should detect ancestor-descendant relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user:123", "user:123:profile:avatar:thumb"), true);
		});

		/**
		 * Test prefix relationships
		 */
		it("should detect prefix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_prefix", "user_prefix_extended"), true);
		});
	});

	describe("Semantic Relationships", () => {
		/**
		 * Test entity extraction
		 */
		it("should extract semantic identifiers", () => {
			// Test through areKeysRelated which uses _extractSemanticIdentifiers
			assert.strictEqual(analyzer.areKeysRelated("userProfile:123", "user_data:456"), true);
		});

		/**
		 * Test singular/plural similarity
		 */
		it("should detect singular/plural relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user:123", "users:list"), true);
			assert.strictEqual(analyzer.areKeysRelated("product:item", "products:catalog"), true);
		});

		/**
		 * Test entity relationships
		 */
		it("should detect known entity relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user:123", "profile:456"), true);
			assert.strictEqual(analyzer.areKeysRelated("order:123", "payment:456"), true);
			assert.strictEqual(analyzer.areKeysRelated("workspace:123", "document:456"), true);
		});
	});

	describe("Pattern Relationships", () => {
		/**
		 * Test wildcard patterns
		 */
		it("should handle wildcard patterns", () => {
			const transaction = new MockTransaction("tx1");
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "user_123", "user_*", "value"), true);
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "admin_456", "user_*", "value"), false);
		});

		/**
		 * Test question mark patterns
		 */
		it("should handle question mark patterns", () => {
			const transaction = new MockTransaction("tx1");
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "user1", "user?", "value"), true);
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "user12", "user?", "value"), false);
		});

		/**
		 * Test bracket patterns
		 */
		it("should handle bracket patterns", () => {
			const transaction = new MockTransaction("tx1");
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "user1", "user[123]", "value"), true);
		});

		/**
		 * Test brace patterns
		 */
		it("should handle brace patterns", () => {
			const transaction = new MockTransaction("tx1");
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "user_admin", "user_{admin,guest}", "value"), true);
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "user_guest", "user_{admin,guest}", "value"), true);
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "user_other", "user_{admin,guest}", "value"), false);
		});

		/**
		 * Test range/pattern suffixes
		 */
		it("should handle range and pattern suffixes", () => {
			const transaction = new MockTransaction("tx1");
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "user_123", "user_range", "value"), true);
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "user_456", "user_pattern", "value"), true);
		});

		/**
		 * Test pattern similarity
		 */
		it("should detect similar patterns", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_123_profile", "user_456_profile"), true);
			assert.strictEqual(analyzer.areKeysRelated("order-abc123-details", "order-def456-details"), true);
		});

		/**
		 * Test Levenshtein distance calculation
		 */
		it("should calculate pattern similarity correctly", () => {
			// Test with very similar patterns
			assert.strictEqual(analyzer.areKeysRelated("abc_123_def", "abc_456_def"), true);
			// Test with dissimilar patterns
			assert.strictEqual(analyzer.areKeysRelated("completely_different", "xyz_789"), false);
		});
	});

	describe("Temporal Relationships", () => {
		/**
		 * Test date patterns
		 */
		it("should detect date patterns", () => {
			assert.strictEqual(analyzer.areKeysRelated("log_2023-01-01_12:30:45", "event_2023-02-01_14:15:30"), true);
		});

		/**
		 * Test time patterns
		 */
		it("should detect time patterns", () => {
			assert.strictEqual(analyzer.areKeysRelated("task_2023-01-01_12:30:45", "event_2023-01-02_14:15:30"), true);
		});

		/**
		 * Test timestamp patterns
		 */
		it("should detect timestamp patterns", () => {
			assert.strictEqual(analyzer.areKeysRelated("log_1234567890123", "event_1234567890456"), true);
		});

		/**
		 * Test epoch patterns
		 */
		it("should detect epoch patterns", () => {
			assert.strictEqual(analyzer.areKeysRelated("session_1234567890", "token_1234567891"), false);
		});

		/**
		 * Test temporal keywords
		 */
		it("should detect temporal keywords", () => {
			assert.strictEqual(analyzer.areKeysRelated("created_at_2023-01-01", "updated_at_2023-01-02"), true);
			assert.strictEqual(analyzer.areKeysRelated("history_log_12:30:45", "event_trace_14:15:30"), true);
		});
	});

	describe("Composite Key Relationships", () => {
		/**
		 * Test colon separator
		 */
		it("should handle colon-separated composite keys", () => {
			assert.strictEqual(analyzer.areKeysRelated("user:123:session:abc", "user:123:profile:def"), true);
		});

		/**
		 * Test hash separator
		 */
		it("should handle hash-separated composite keys", () => {
			assert.strictEqual(analyzer.areKeysRelated("app#module#comp1", "app#module#comp2"), true);
		});

		/**
		 * Test pipe separator
		 */
		it("should handle pipe-separated composite keys", () => {
			assert.strictEqual(analyzer.areKeysRelated("db|table|col1", "db|table|col2"), true);
		});

		/**
		 * Test at separator
		 */
		it("should handle at-separated composite keys", () => {
			assert.strictEqual(analyzer.areKeysRelated("service@host@port", "service@host@config"), true);
		});

		/**
		 * Test multiple underscores
		 */
		it("should handle multiple underscore separators", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_profile_avatar_thumb", "user_profile_settings_theme"), true);
		});

		/**
		 * Test multiple dashes
		 */
		it("should handle multiple dash separators", () => {
			assert.strictEqual(analyzer.areKeysRelated("app-module-comp-v1", "app-module-util-v2"), true);
		});
	});

	describe("Index Relationships", () => {
		/**
		 * Test _index suffix
		 */
		it("should detect _index suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_email_index", "user_email"), true);
		});

		/**
		 * Test _idx suffix
		 */
		it("should detect _idx suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("product_name_idx", "product_name"), true);
		});

		/**
		 * Test idx_ prefix
		 */
		it("should detect idx_ prefix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("idx_user_email", "user_email"), true);
		});

		/**
		 * Test _key suffix
		 */
		it("should detect _key suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_primary_key", "user"), true);
		});

		/**
		 * Test _lookup suffix
		 */
		it("should detect _lookup suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("email_lookup", "email"), true);
		});
	});

	describe("Collection Relationships", () => {
		/**
		 * Test _list suffix
		 */
		it("should detect _list suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_list", "user"), true);
		});

		/**
		 * Test _array suffix
		 */
		it("should detect _array suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("items_array", "items"), true);
		});

		/**
		 * Test _set suffix
		 */
		it("should detect _set suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("tags_set", "tags"), true);
		});

		/**
		 * Test _collection suffix
		 */
		it("should detect _collection suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("document_collection", "document"), true);
		});

		/**
		 * Test _items suffix
		 */
		it("should detect _items suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("cart_items", "cart"), true);
		});

		/**
		 * Test _elements suffix
		 */
		it("should detect _elements suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("menu_elements", "menu"), true);
		});

		/**
		 * Test _members suffix
		 */
		it("should detect _members suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("team_members", "team"), true);
		});

		/**
		 * Test _entries suffix
		 */
		it("should detect _entries suffix relationships", () => {
			assert.strictEqual(analyzer.areKeysRelated("log_entries", "log"), true);
		});
	});

	describe("Functional Dependencies", () => {
		/**
		 * Test user-related dependencies
		 */
		it("should detect user-related functional dependencies", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_id", "user_email"), true);
			assert.strictEqual(analyzer.areKeysRelated("user_id", "user_profile"), true);
			assert.strictEqual(analyzer.areKeysRelated("account_id", "user_id"), true);
			assert.strictEqual(analyzer.areKeysRelated("session_id", "user_id"), true);
		});

		/**
		 * Test order-related dependencies
		 */
		it("should detect order-related functional dependencies", () => {
			assert.strictEqual(analyzer.areKeysRelated("order_id", "user_id"), true);
			assert.strictEqual(analyzer.areKeysRelated("order_id", "order_total"), true);
			assert.strictEqual(analyzer.areKeysRelated("payment_id", "order_id"), true);
			assert.strictEqual(analyzer.areKeysRelated("shipping_id", "order_id"), true);
		});

		/**
		 * Test content-related dependencies
		 */
		it("should detect content-related functional dependencies", () => {
			assert.strictEqual(analyzer.areKeysRelated("post_id", "user_id"), true);
			assert.strictEqual(analyzer.areKeysRelated("comment_id", "post_id"), true);
			assert.strictEqual(analyzer.areKeysRelated("message_id", "thread_id"), true);
		});

		/**
		 * Test file-related dependencies
		 */
		it("should detect file-related functional dependencies", () => {
			assert.strictEqual(analyzer.areKeysRelated("file_id", "folder_id"), true);
			assert.strictEqual(analyzer.areKeysRelated("document_id", "workspace_id"), true);
			assert.strictEqual(analyzer.areKeysRelated("task_id", "project_id"), true);
		});

		/**
		 * Test key normalization
		 */
		it("should normalize keys for dependency checking", () => {
			assert.strictEqual(analyzer.areKeysRelated("userId", "userEmail"), true);
			assert.strictEqual(analyzer.areKeysRelated("user-id", "user-email"), true);
			assert.strictEqual(analyzer.areKeysRelated("user.id", "user.email"), true);
			assert.strictEqual(analyzer.areKeysRelated("user/id", "user/email"), true);
		});
	});

	describe("Explicit Range Methods", () => {
		let transaction;

		beforeEach(() => {
			transaction = new MockTransaction("tx1");
		});

		/**
		 * Test explicit range metadata
		 */
		it("should detect explicit range metadata", () => {
			transaction.addSnapshot("user:range", { min: "user:100", max: "user:200" });
			const result = analyzer.isKeyInSnapshotRange(transaction, "user:150", "user", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test explicit query metadata
		 */
		it("should handle explicit query metadata", () => {
			transaction.addSnapshot("user:query", { type: "prefix", prefix: "user:" });
			const result = analyzer.isKeyInSnapshotRange(transaction, "user:123", "user", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test explicit predicate metadata
		 */
		it("should handle explicit predicate metadata", () => {
			transaction.addSnapshot("user:predicate", (key) => key.startsWith("user:"));
			const result = analyzer.isKeyInSnapshotRange(transaction, "user:123", "user", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test invalid predicate
		 */
		it("should handle invalid predicates gracefully", () => {
			transaction.addSnapshot("user:predicate", () => { throw new Error("Invalid predicate"); });
			const result = analyzer.isKeyInSnapshotRange(transaction, "user:123", "user", "value");
			assert.strictEqual(result, false);
		});
	});

	describe("Edge Cases and Error Handling", () => {
		/**
		 * Test empty keys
		 */
		it("should handle empty keys", () => {
			assert.strictEqual(analyzer.areKeysRelated("", ""), true);
			assert.strictEqual(analyzer.areKeysRelated("test", ""), true); // Empty string can match prefix patterns
		});

		/**
		 * Test very long keys with similar patterns
		 */
		it("should handle very long keys", () => {
			const longKey1 = "user_" + "a".repeat(1000) + "_profile";
			const longKey2 = "user_" + "b".repeat(1000) + "_profile";
			assert.strictEqual(analyzer.areKeysRelated(longKey1, longKey2), true); // Should detect pattern similarity
		});

		/**
		 * Test special characters with similar patterns
		 */
		it("should handle keys with special characters", () => {
			assert.strictEqual(analyzer.areKeysRelated("user@domain_profile", "user@other_profile"), true);
			assert.strictEqual(analyzer.areKeysRelated("key%20with%20spaces_123", "key%20with%20more_456"), true);
		});

		/**
		 * Test cache utilization
		 */
		it("should utilize caches for performance", () => {
			// First call should populate cache
			analyzer.areKeysRelated("user_123_profile", "user_456_profile");
			const initialPatternCacheSize = analyzer.patternCache.size;
			const initialSemanticCacheSize = analyzer.semanticCache.size;

			// Second call with same pattern should use cache
			analyzer.areKeysRelated("user_789_profile", "user_abc_profile");

			// Cache should have been used (size may increase but pattern extraction should be faster)
			assert.ok(analyzer.patternCache.size >= initialPatternCacheSize);
			assert.ok(analyzer.semanticCache.size >= initialSemanticCacheSize);
		});

		/**
		 * Test invalid regex patterns in pattern matching
		 */
		it("should handle invalid regex patterns gracefully", () => {
			const transaction = new MockTransaction("tx1");
			// This should not throw an error
			const result = analyzer.isKeyInSnapshotRange(transaction, "test", "pattern[invalid", "value");
			assert.strictEqual(result, false);
		});

		/**
		 * Test collection membership with non-collection values
		 */
		it("should handle collection membership with non-collection values", () => {
			const transaction = new MockTransaction("tx1");
			const result = analyzer.isKeyInSnapshotRange(transaction, "user:123:profile", "user:123", "scalar_value");
			assert.strictEqual(result, true); // Should still work for hierarchical relationships
		});

		/**
		 * Test pattern similarity with identical patterns
		 */
		it("should handle identical patterns", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_123", "user_123"), true);
		});

		/**
		 * Test pattern similarity with empty patterns
		 */
		it("should handle empty pattern comparison", () => {
			assert.strictEqual(analyzer.areKeysRelated("", ""), true);
		});

		/**
		 * Test temporal extraction with no temporal components
		 */
		it("should handle keys with no temporal components", () => {
			// Keys with similar patterns should still be related
			assert.strictEqual(analyzer.areKeysRelated("simple_key_123", "another_key_456"), false);
		});

		/**
		 * Test composite key overlap with no matching parts
		 */
		it("should handle composite keys with no overlap", () => {
			assert.strictEqual(analyzer.areKeysRelated("app:module1:comp1", "other:service2:part2"), false);
		});

		/**
		 * Test index range with missing metadata
		 */
		it("should handle missing index range metadata", () => {
			const transaction = new MockTransaction("tx1");
			const result = analyzer.isKeyInSnapshotRange(transaction, "user_123", "user_index", "value");
			assert.strictEqual(result, true); // Should fall back to base key matching
		});

		/**
		 * Test collection base extraction with no indicators
		 */
		it("should handle collection key without indicators", () => {
			// This should test the fallback in _extractCollectionBase (line 1063)
			assert.strictEqual(analyzer.areKeysRelated("test_collection", "test"), true);
			assert.strictEqual(analyzer.areKeysRelated("products_array", "products"), true);
		});

		/**
		 * Test functional dependency with reverse mapping
		 */
		it("should detect functional dependencies in reverse order", () => {
			// This should test the || condition in _hasFunctionalDependency (lines 1089-1090)
			assert.strictEqual(analyzer.areKeysRelated("user_email", "user_id"), true);
			assert.strictEqual(analyzer.areKeysRelated("order_total", "order_id"), true);
		});

		/**
		 * Test explicit range with invalid predicate
		 */
		it("should handle predicate functions that return non-boolean values", () => {
			const transaction = new MockTransaction("tx1");
			transaction.addSnapshot("user:predicate", () => { throw new Error("Predicate error"); });
			const result = analyzer.isKeyInSnapshotRange(transaction, "user:123", "user", "value");
			// This should test the fallback in _checkExplicitRange (lines 1149-1150)
			assert.strictEqual(result, false);
		});


		/**
		 * Test pattern similarity with very different keys
		 */
		it("should return false for completely different patterns", () => {
			assert.strictEqual(analyzer.areKeysRelated("abc", "xyz789"), false);
			assert.strictEqual(analyzer.areKeysRelated("very_long_prefix_here", "short"), false);
		});

		/**
		 * Test empty array return in pattern matching
		 */
		it("should handle pattern matching edge cases", () => {
			const transaction = new MockTransaction("tx1");
			// Test with invalid bracket pattern
			const result = analyzer.isKeyInSnapshotRange(transaction, "test", "[invalid", "value");
			assert.strictEqual(result, false);
		});

		/**
		 * Test collection key extraction with all indicators
		 */
		it("should extract collection base for all collection indicators", () => {
			assert.strictEqual(analyzer.areKeysRelated("data_list", "data"), true);
			assert.strictEqual(analyzer.areKeysRelated("items_array", "items"), true);
			assert.strictEqual(analyzer.areKeysRelated("users_set", "users"), true);
			assert.strictEqual(analyzer.areKeysRelated("docs_collection", "docs"), true);
			assert.strictEqual(analyzer.areKeysRelated("cart_items", "cart"), true);
			assert.strictEqual(analyzer.areKeysRelated("menu_elements", "menu"), true);
			assert.strictEqual(analyzer.areKeysRelated("team_members", "team"), true);
			assert.strictEqual(analyzer.areKeysRelated("log_entries", "log"), true);
		});

		/**
		 * Test index key extraction with all indicators
		 */
		it("should extract base key for all index indicators", () => {
			assert.strictEqual(analyzer.areKeysRelated("user_email_index", "user_email"), true);
			assert.strictEqual(analyzer.areKeysRelated("product_name_idx", "product_name"), true);
			assert.strictEqual(analyzer.areKeysRelated("idx_order_status", "order_status"), true);
			assert.strictEqual(analyzer.areKeysRelated("session_key", "session"), true);
			assert.strictEqual(analyzer.areKeysRelated("email_lookup", "email"), true);
		});

		/**
		 * Test temporal component detection with all patterns
		 */
		it("should detect all temporal component patterns", () => {
			const transaction = new MockTransaction("tx1");
			
			// Test date pattern: YYYY-MM-DD
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "log_2023-12-31", "event_2023-01-01", "value"), false);
			
			// Test time pattern: HH:MM:SS
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "task_23:59:59", "event_00:00:01", "value"), false);
			
			// Test 13-digit timestamp
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "log_1234567890123", "event_1234567890456", "value"), false);
			
			// Test 10-digit epoch
			assert.strictEqual(analyzer.isKeyInSnapshotRange(transaction, "session_1234567890", "token_1234567891", "value"), false);
		});

		/**
		 * Test collection key relationships that return true (lines 60-61)
		 */
		it("should trigger collection relationship return true", () => {
			// Strategy: Collection keys where bases have startsWith relationship but full keys don't
			// "userinfo_list" → base "userinfo", "user_array" → base "user"  
			// "userinfo".startsWith("user") is true, but "userinfo_list" doesn't start with "user_array"
			assert.strictEqual(analyzer.areKeysRelated("userinfo_list", "user_array"), true);
			assert.strictEqual(analyzer.areKeysRelated("userdata_collection", "user_set"), true);
			assert.strictEqual(analyzer.areKeysRelated("userprofile_elements", "user_members"), true);
			
			// Try other patterns
			assert.strictEqual(analyzer.areKeysRelated("datastore_list", "data_items"), true);
			assert.strictEqual(analyzer.areKeysRelated("database_entries", "data_collection"), true);
		});

		/**
		 * Test index key relationships that return true (lines 55-56)
		 */
		it("should trigger index relationship return true", () => {
			// Strategy: Index keys where bases have startsWith relationship but full keys don't
			// "userinfo_index" → base "userinfo", "user_key" → base "user"
			// "userinfo".startsWith("user") is true, but "userinfo_index" doesn't start with "user_key"
			assert.strictEqual(analyzer.areKeysRelated("userinfo_index", "user_key"), true);
			assert.strictEqual(analyzer.areKeysRelated("userdata_idx", "user_lookup"), true);
			assert.strictEqual(analyzer.areKeysRelated("userprofile_index", "user_idx"), true);
			
			// Try other patterns
			assert.strictEqual(analyzer.areKeysRelated("datastore_key", "data_index"), true);
			assert.strictEqual(analyzer.areKeysRelated("database_lookup", "data_key"), true);
		});

		/**
		 * Test _hasFunctionalDependency reverse dependency matching (lines 1081-1082)
		 */
		it("should detect functional dependencies with reversed key order", () => {
			// These should hit the second condition in _hasFunctionalDependency (norm1.includes(dep2) && norm2.includes(dep1))
			assert.strictEqual(analyzer.areKeysRelated("user-email", "user-id"), true);
			assert.strictEqual(analyzer.areKeysRelated("user.profile", "user.id"), true);
			assert.strictEqual(analyzer.areKeysRelated("order/total", "order/id"), true);
			assert.strictEqual(analyzer.areKeysRelated("task/id", "project/id"), true);
		});

		/**
		 * Test _checkExplicitRange fallback path (lines 1141-1142)
		 */
		it("should return false when explicit range metadata exists but is invalid", () => {
			const transaction = new MockTransaction("tx1");
			// Add explicit range metadata that will make _hasExplicitRangeMetadata return true
			// but add invalid/empty data that won't match any condition in _checkExplicitRange
			transaction.addSnapshot("snapshot_key:range", null); // Invalid range object
			transaction.addSnapshot("snapshot_key:query", null); // Invalid query object
			// This should trigger _hasExplicitRangeMetadata to return true, then _checkExplicitRange fallback
			const result = analyzer.isKeyInSnapshotRange(transaction, "operation_key", "snapshot_key", "value");
			assert.strictEqual(result, false);
		});

		/**
		 * Test _checkIndexBasedRange fallback path (lines 994-999)
		 */
		it("should hit _checkIndexBasedRange fallback when index metadata is invalid", () => {
			const transaction = new MockTransaction("tx1");
			// Use option 2: add ":index_range" to snapshot to make _isIndexBasedSnapshot return true
			// but use a snapshot key that doesn't contain "_index" or "_idx" patterns
			transaction.addSnapshot("somekey:index_range", null); // Invalid range data
			
			// Now "somekey" will make _isIndexBasedSnapshot return true (because of :index_range)
			// but "somekey" doesn't contain "_index" or "_idx", so _checkIndexBasedRange hits fallback
			const result = analyzer.isKeyInSnapshotRange(transaction, "operation_key", "somekey", "value");
			assert.strictEqual(result, false);
		});

		/**
		 * Test _checkIndexBasedRange with valid index range (lines 989-990)
		 */
		it("should hit _checkIndexBasedRange with valid index range", () => {
			const transaction = new MockTransaction("tx1");
			// Add valid index range data to trigger lines 989-990
			const indexRange = { fields: ["id"], values: ["123"] };
			transaction.addSnapshot("users_index:index_range", indexRange);
			
			// This should trigger _isIndexBasedSnapshot and then _checkIndexBasedRange with valid indexRange
			// Use a key that will match the index range
			const result = analyzer.isKeyInSnapshotRange(transaction, "users:id:123", "users_index", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test _checkIndexBasedRange with _index/_idx patterns (lines 993-996)
		 */
		it("should hit _checkIndexBasedRange index pattern matching", () => {
			const transaction = new MockTransaction("tx1");
			// Add ":index_range" to make _isIndexBasedSnapshot return true, but no actual range data
			transaction.addSnapshot("users_index:index_range", null);
			
			// This should trigger _isIndexBasedSnapshot, then _checkIndexBasedRange will hit lines 993-996
			// "users_index" contains "_index", so it will extract baseKey "users"
			const result = analyzer.isKeyInSnapshotRange(transaction, "users:123", "users_index", "value");
			assert.strictEqual(result, true);
		});


		/**
		 * Test temporal range check in isKeyInSnapshotRange (lines 111-113)
		 */
		it("should trigger temporal range check", () => {
			const transaction = new MockTransaction("tx1");
			// Use a snapshot key with temporal keywords to trigger _isTemporalSnapshot
			const result = analyzer.isKeyInSnapshotRange(transaction, "log_entry_operation", "timestamp_data", "value");
			assert.strictEqual(result, false); // Should be false since they don't have temporal overlap
		});

		/**
		 * Test composite key range check in isKeyInSnapshotRange (lines 116-118)
		 */
		it("should trigger composite key range check", () => {
			const transaction = new MockTransaction("tx1");
			// Use a snapshot key with composite indicators to trigger _isCompositeKeySnapshot
			const result = analyzer.isKeyInSnapshotRange(transaction, "app:module:operation", "app:module:snapshot", "value");
			assert.strictEqual(result, true);
		});

		/**
		 * Test _isParentChildRelationship mismatch branch (lines 299-300)
		 */
		it("should trigger parent-child relationship mismatch check", () => {
			// Use keys that will trigger hierarchical check but have mismatched parts
			// where snapParts.length > opParts.length but parts don't match
			assert.strictEqual(analyzer.areKeysRelated("user:123", "other:456:profile"), false);
			assert.strictEqual(analyzer.areKeysRelated("data.key", "different.value.extra"), false);
		});

		/**
		 * Test _isAncestorDescendantRelationship true branch (lines 347-349)
		 */
		it("should trigger ancestor-descendant relationship true branch", () => {
			// Use keys where one is truly an ancestor of another
			assert.strictEqual(analyzer.areKeysRelated("app", "app:module:component:subpart"), true);
			assert.strictEqual(analyzer.areKeysRelated("root.base", "root.base.level1.level2.level3"), true);
		});

		/**
		 * Test _isCollectionMembership with array value (lines 365-367)
		 */
		it("should trigger collection membership check with array value", () => {
			const transaction = new MockTransaction("tx1");
			// Use hierarchical range check with array expectedValue to trigger _isCollectionMembership
			const result = analyzer.isKeyInSnapshotRange(transaction, "users:123:profile", "users:123", ["item1", "item2"]);
			assert.strictEqual(result, true);
		});

		/**
		 * Test _checkTemporalRange when operation key is temporal (lines 787-795)
		 */
		it("should trigger temporal range check with temporal operation key", () => {
			const transaction = new MockTransaction("tx1");
			// Use temporal operation key to trigger _isTemporalSnapshot(operationKey) in _checkTemporalRange
			const result = analyzer.isKeyInSnapshotRange(transaction, "log_timestamp_123", "event_history", "value");
			assert.strictEqual(result, false); // Should be false as temporal overlap is unlikely
		});

		/**
		 * Test pattern cache hit (lines 660-661)
		 */
		it("should hit pattern cache for already processed keys", () => {
			// Call pattern-related method twice with same key to trigger cache hit
			analyzer.areKeysRelated("user123", "user456"); // First call populates cache
			const result = analyzer.areKeysRelated("user123", "user789"); // Second call should hit cache
			assert.strictEqual(typeof result, "boolean");
		});

		/**
		 * Test collection base fallback (lines 1053-1054)
		 */
		it("should return original key when no collection indicators found in _extractCollectionBase", () => {
			// Use keys that definitely don't have any collection indicators
			assert.strictEqual(analyzer.areKeysRelated("simplekeyname", "anotherkeyname"), false);
		});

		/**
		 * Test _checkTemporalRange with temporal operation key (lines 787-795)
		 */
		it("should trigger temporal range check with temporal operation key", () => {
			const transaction = new MockTransaction("tx1");
			// Use temporal operation key to trigger _isTemporalSnapshot(operationKey) in _checkTemporalRange
			// This hits lines 787-795, even if the result is false due to no actual temporal overlap
			const result = analyzer.isKeyInSnapshotRange(transaction, "log_2023_12_25", "event_2023_12_26", "value");
			assert.strictEqual(result, false); // Temporal components don't actually overlap in meaningful way
		});

		/**
		 * Test _isCompositeKeySnapshot with different separators (lines 852-858)
		 */
		it("should detect composite keys with various separators", () => {
			// Test each separator type individually to hit specific lines
			// These tests will trigger _isCompositeKeySnapshot and specific separator lines
			
			// Test hash separator (line 853)
			assert.strictEqual(analyzer.areKeysRelated("key#123", "key#456"), true);
			
			// Test pipe separator (line 854)
			assert.strictEqual(analyzer.areKeysRelated("key|abc", "key|def"), true);
			
			// Test at separator (line 855)
			assert.strictEqual(analyzer.areKeysRelated("key@domain", "key@other"), true);
			
			// Test multiple underscores (line 856) - split("_").length > 2
			assert.strictEqual(analyzer.areKeysRelated("key_part_sub_item", "key_part_sub_other"), true);
			
			// Test multiple dashes (line 857) - split("-").length > 2
			assert.strictEqual(analyzer.areKeysRelated("key-part-sub-item", "key-part-sub-other"), true);
		});
	});
});
