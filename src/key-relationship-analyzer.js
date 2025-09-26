/**
 * Analyzer for detecting relationships between transaction keys
 * Handles hierarchical, semantic, pattern, temporal, and functional relationships
 */
export class KeyRelationshipAnalyzer {
	/**
	 * Creates a new KeyRelationshipAnalyzer instance
	 * Initializes caches for pattern and semantic analysis
	 */
	constructor () {
		// Pattern cache for performance
		this.patternCache = new Map();
		this.semanticCache = new Map();
	}

	/**
	 * Check if two keys are related through various relationship types
	 * @param {string} key1 - First key
	 * @param {string} key2 - Second key
	 * @returns {boolean} True if keys are related
	 */
	areKeysRelated (key1, key2) {
		// Direct match - always related
		if (key1 === key2) {
			return true;
		}

		// Check for hierarchical relationships
		if (this._hasHierarchicalKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for semantic relationships
		if (this._hasSemanticKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for pattern-based relationships
		if (this._hasPatternBasedKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for composite key relationships
		if (this._hasCompositeKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for temporal relationships
		if (this._hasTemporalKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for index-based relationships
		if (this._hasIndexKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for collection relationships
		if (this._hasCollectionKeyRelationship(key1, key2)) {
			return true;
		}

		// Check for functional dependencies
		if (this._hasFunctionalDependency(key1, key2)) {
			return true;
		}

		return false;
	}

	/**
	 * Check if a key falls within the range that could affect a snapshot
	 * @param {Transaction} transaction - Transaction with snapshot
	 * @param {string} operationKey - Key from other transaction's operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if operation key could affect snapshot
	 */
	isKeyInSnapshotRange (transaction, operationKey, snapshotKey, expectedValue) {
		// Direct key match - always affects snapshot
		if (operationKey === snapshotKey) {
			return true;
		}

		// Check for explicit range metadata stored with the snapshot
		if (this._hasExplicitRangeMetadata(transaction, snapshotKey)) {
			return this._checkExplicitRange(transaction, operationKey, snapshotKey);
		}

		// Infer range from snapshot key patterns
		if (this._isPatternBasedSnapshot(snapshotKey)) {
			return this._checkPatternBasedRange(operationKey, snapshotKey);
		}

		// Check for hierarchical key relationships
		if (this._hasHierarchicalRelationship(operationKey, snapshotKey)) {
			return this._checkHierarchicalRange(operationKey, snapshotKey, expectedValue);
		}

		// Check for index-based range queries
		if (this._isIndexBasedSnapshot(transaction, snapshotKey)) {
			return this._checkIndexBasedRange(transaction, operationKey, snapshotKey);
		}

		// Check for semantic key relationships
		if (this._hasSemanticRelationship(operationKey, snapshotKey)) {
			return this._checkSemanticRange(operationKey, snapshotKey);
		}

		// Check for temporal range relationships
		if (this._isTemporalSnapshot(snapshotKey)) {
			return this._checkTemporalRange(operationKey, snapshotKey);
		}

		// Check for composite key range relationships
		if (this._isCompositeKeySnapshot(snapshotKey)) {
			return this._checkCompositeKeyRange(operationKey, snapshotKey);
		}

		return false;
	}

	/**
	 * Check if a key matches a range specification
	 * @param {string} key - Key to check
	 * @param {Object} range - Range specification
	 * @returns {boolean} True if key is in range
	 */
	keyMatchesRange (key, range) {
		if (range.min !== undefined && range.max !== undefined) {
			return key >= range.min && key <= range.max;
		}

		if (range.prefix !== undefined) {
			return key.startsWith(range.prefix);
		}

		if (range.pattern !== undefined) {
			try {
				const regex = new RegExp(range.pattern);

				return regex.test(key);
			} catch {
				return false;
			}
		}

		return false;
	}

	/**
	 * Check if key matches a query specification
	 * @param {string} key - Key to check
	 * @param {Object} queryInfo - Query specification
	 * @returns {boolean} True if key matches query
	 */
	keyMatchesQuery (key, queryInfo) {
		if (queryInfo.type === "range") {
			return this.keyMatchesRange(key, queryInfo);
		}

		if (queryInfo.type === "prefix") {
			return key.startsWith(queryInfo.prefix || "");
		}

		if (queryInfo.type === "pattern") {
			try {
				const regex = new RegExp(queryInfo.pattern || "");

				return regex.test(key);
			} catch {
				return false;
			}
		}

		if (queryInfo.type === "in") {
			return Array.isArray(queryInfo.values) && queryInfo.values.includes(key);
		}

		return false;
	}

	/**
	 * Check if key matches an index range
	 * @param {string} key - Key to check
	 * @param {Object} indexRange - Index range specification
	 * @returns {boolean} True if key matches index range
	 */
	keyMatchesIndexRange (key, indexRange) {
		if (indexRange.fields && Array.isArray(indexRange.fields)) {
			for (const field of indexRange.fields) {
				if (key.includes(field)) {
					return true;
				}
			}
		}

		if (indexRange.values) {
			return this.keyMatchesRange(key, indexRange.values);
		}

		return false;
	}

	/**
	 * Check if two keys have a hierarchical relationship
	 * Analyzes parent-child, sibling, and ancestor-descendant relationships
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have hierarchical relationship
	 * @private
	 */
	_hasHierarchicalKeyRelationship (key1, key2) {
		const separators = [":", "/", ".", "_", "-"];

		for (const sep of separators) {
			if (key1.includes(sep) && key2.includes(sep)) {
				const parts1 = key1.split(sep);
				const parts2 = key2.split(sep);

				if (this._isParentChildRelationship(parts1, parts2) ||
					this._isSiblingRelationship(parts1, parts2) ||
					this._isAncestorDescendantRelationship(parts1, parts2)) {
					return true;
				}
			}
		}

		return key1.startsWith(key2) || key2.startsWith(key1);
	}

	/**
	 * Check if operation key and snapshot key have hierarchical relationship for snapshot range
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @returns {boolean} True if keys have hierarchical relationship
	 * @private
	 */
	_hasHierarchicalRelationship (operationKey, snapshotKey) {
		const separators = [":", "/", ".", "_", "-"];

		for (const sep of separators) {
			if (operationKey.includes(sep) && snapshotKey.includes(sep)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if operation key falls within hierarchical range of snapshot key
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if operation key is in hierarchical range
	 * @private
	 */
	_checkHierarchicalRange (operationKey, snapshotKey, expectedValue) {
		const separators = [":", "/", ".", "_", "-"];

		for (const sep of separators) {
			if (operationKey.includes(sep) && snapshotKey.includes(sep)) {
				const opParts = operationKey.split(sep);
				const snapParts = snapshotKey.split(sep);

				if (this._isParentChildRelationship(opParts, snapParts) ||
					this._isSiblingRelationship(opParts, snapParts) ||
					this._isCollectionMembership(opParts, snapParts, expectedValue)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check if two key parts arrays have a parent-child relationship
	 * @param {string[]} opParts - Parts from operation key
	 * @param {string[]} snapParts - Parts from snapshot key
	 * @returns {boolean} True if there's a parent-child relationship
	 * @private
	 */
	_isParentChildRelationship (opParts, snapParts) {
		if (opParts.length > snapParts.length) {
			for (let i = 0; i < snapParts.length; i++) {
				if (opParts[i] !== snapParts[i]) {
					return false;
				}
			}

			return true;
		}

		if (snapParts.length > opParts.length) {
			for (let i = 0; i < opParts.length; i++) {
				if (opParts[i] !== snapParts[i]) {
					return false;
				}
			}

			return true;
		}

		return false;
	}

	/**
	 * Check if two key parts arrays have a sibling relationship
	 * @param {string[]} opParts - Parts from operation key
	 * @param {string[]} snapParts - Parts from snapshot key
	 * @returns {boolean} True if there's a sibling relationship
	 * @private
	 */
	_isSiblingRelationship (opParts, snapParts) {
		if (opParts.length === snapParts.length && opParts.length > 1) {
			for (let i = 0; i < opParts.length - 1; i++) {
				if (opParts[i] !== snapParts[i]) {
					return false;
				}
			}

			return opParts[opParts.length - 1] !== snapParts[snapParts.length - 1];
		}

		return false;
	}

	/**
	 * Check if two key parts arrays have an ancestor-descendant relationship
	 * @param {string[]} parts1 - Parts from first key
	 * @param {string[]} parts2 - Parts from second key
	 * @returns {boolean} True if there's an ancestor-descendant relationship
	 * @private
	 */
	_isAncestorDescendantRelationship (parts1, parts2) {
		const shorter = parts1.length < parts2.length ? parts1 : parts2;
		const longer = parts1.length < parts2.length ? parts2 : parts1;

		if (shorter.length < longer.length) {
			for (let i = 0; i < shorter.length; i++) {
				if (shorter[i] !== longer[i]) {
					return false;
				}
			}

			return true;
		}

		return false;
	}

	/**
	 * Check if operation key parts indicate collection membership relative to snapshot
	 * @param {string[]} opParts - Parts from operation key
	 * @param {string[]} snapParts - Parts from snapshot key
	 * @param {*} expectedValue - Expected value from snapshot
	 * @returns {boolean} True if operation key is collection member
	 * @private
	 */
	_isCollectionMembership (opParts, snapParts, expectedValue) {
		if (Array.isArray(expectedValue) ||
			expectedValue && typeof expectedValue === "object" && expectedValue.length !== undefined) {
			return this._isParentChildRelationship(opParts, snapParts) ||
				this._isSiblingRelationship(opParts, snapParts);
		}

		return false;
	}

	/**
	 * Check if two keys have semantic relationship based on their content meaning
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have semantic relationship
	 * @private
	 */
	_hasSemanticKeyRelationship (key1, key2) {
		const semantics1 = this._extractSemanticIdentifiers(key1);
		const semantics2 = this._extractSemanticIdentifiers(key2);

		for (const sem1 of semantics1) {
			for (const sem2 of semantics2) {
				if (this._areSemanticallySimilar(sem1, sem2)) {
					return true;
				}
			}
		}

		return this._hasEntityRelationship(semantics1, semantics2);
	}

	/**
	 * Check if operation key and snapshot key have semantic relationship for snapshot range
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @returns {boolean} True if keys have semantic relationship
	 * @private
	 */
	_hasSemanticRelationship (operationKey, snapshotKey) {
		const semanticPrefixes = [
			"user", "account", "profile", "session",
			"order", "product", "cart", "payment",
			"post", "comment", "thread", "message",
			"document", "file", "folder", "workspace"
		];

		for (const prefix of semanticPrefixes) {
			if (operationKey.toLowerCase().includes(prefix) &&
				snapshotKey.toLowerCase().includes(prefix)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if operation key falls within semantic range of snapshot key
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Key from snapshot
	 * @returns {boolean} True if operation key is in semantic range
	 * @private
	 */
	_checkSemanticRange (operationKey, snapshotKey) {
		const opSemantics = this._extractSemanticIdentifiers(operationKey);
		const snapSemantics = this._extractSemanticIdentifiers(snapshotKey);

		for (const opSemantic of opSemantics) {
			for (const snapSemantic of snapSemantics) {
				if (this._areSemanticallySimilar(opSemantic, snapSemantic)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Extract semantic identifiers from a key string using pattern matching
	 * @param {string} key - Key to extract semantic identifiers from
	 * @returns {string[]} Array of semantic identifiers found in the key
	 * @private
	 */
	_extractSemanticIdentifiers (key) {
		const cacheKey = `semantic:${key}`;
		if (this.semanticCache.has(cacheKey)) {
			return this.semanticCache.get(cacheKey);
		}

		const identifiers = [];
		const patterns = [
			/(\w+):(\w+)/g, // entity:id
			/(\w+)_(\w+)/g, // entity_id
			/([a-z]+)([A-Z]\w+)/g // entityId (camelCase)
		];

		for (const pattern of patterns) {
			let match;
			while ((match = pattern.exec(key)) !== null) {
				identifiers.push(match[1].toLowerCase());
				if (match[2]) {
					identifiers.push(match[2].toLowerCase());
				}
			}
		}

		this.semanticCache.set(cacheKey, identifiers);

		return identifiers;
	}

	/**
	 * Check if two semantic identifiers are similar
	 * Handles singular/plural forms and semantic equivalence
	 * @param {string} id1 - First identifier
	 * @param {string} id2 - Second identifier
	 * @returns {boolean} True if identifiers are semantically similar
	 * @private
	 */
	_areSemanticallySimilar (id1, id2) {
		if (id1 === id2) {
			return true;
		}

		const singularPlural = [
			["user", "users"], ["account", "accounts"], ["profile", "profiles"],
			["order", "orders"], ["product", "products"], ["item", "items"],
			["post", "posts"], ["comment", "comments"], ["message", "messages"],
			["file", "files"], ["document", "documents"], ["folder", "folders"]
		];

		for (const [singular, plural] of singularPlural) {
			if (id1 === singular && id2 === plural ||
				id1 === plural && id2 === singular) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if two semantic identifier arrays have entity relationships
	 * @param {string[]} semantics1 - Semantic identifiers from first key
	 * @param {string[]} semantics2 - Semantic identifiers from second key
	 * @returns {boolean} True if entities have defined relationships
	 * @private
	 */
	_hasEntityRelationship (semantics1, semantics2) {
		const entityRelations = [
			["user", "profile"], ["user", "account"], ["user", "session"],
			["profile", "account"], ["account", "session"],
			["user", "order"], ["user", "cart"], ["user", "payment"],
			["order", "product"], ["order", "payment"], ["cart", "product"],
			["user", "post"], ["user", "comment"], ["user", "message"],
			["post", "comment"], ["thread", "message"], ["document", "file"],
			["user", "workspace"], ["workspace", "document"], ["workspace", "folder"],
			["folder", "file"], ["document", "file"]
		];

		for (const [entity1, entity2] of entityRelations) {
			const hasEntity1InBoth = semantics1.includes(entity1) && semantics2.includes(entity2);
			const hasEntity2InBoth = semantics1.includes(entity2) && semantics2.includes(entity1);

			if (hasEntity1InBoth || hasEntity2InBoth) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if two keys have pattern-based relationship
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have pattern-based relationship
	 * @private
	 */
	_hasPatternBasedKeyRelationship (key1, key2) {
		if (this._isPatternBasedSnapshot(key1)) {
			return this._checkPatternBasedRange(key2, key1);
		}

		if (this._isPatternBasedSnapshot(key2)) {
			return this._checkPatternBasedRange(key1, key2);
		}

		return this._haveSimilarPatterns(key1, key2);
	}

	/**
	 * Check if a snapshot key contains pattern-based wildcards or indicators
	 * @param {string} snapshotKey - Key from snapshot to check
	 * @returns {boolean} True if key contains pattern-based elements
	 * @private
	 */
	_isPatternBasedSnapshot (snapshotKey) {
		return snapshotKey.includes("*") ||
			snapshotKey.includes("?") ||
			snapshotKey.includes("[") ||
			snapshotKey.includes("{") ||
			snapshotKey.endsWith("_range") ||
			snapshotKey.endsWith("_pattern");
	}

	/**
	 * Check if operation key matches a pattern-based snapshot key range
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Pattern-based snapshot key
	 * @returns {boolean} True if operation key matches pattern
	 * @private
	 */
	_checkPatternBasedRange (operationKey, snapshotKey) {
		if (snapshotKey.includes("*")) {
			const pattern = snapshotKey.replace(/\*/g, ".*");
			try {
				const regex = new RegExp(`^${pattern}$`);

				return regex.test(operationKey);
			} catch {
				const prefix = snapshotKey.split("*")[0];

				return operationKey.startsWith(prefix);
			}
		}

		if (snapshotKey.includes("?")) {
			const pattern = snapshotKey.replace(/\?/g, ".");
			try {
				const regex = new RegExp(`^${pattern}$`);

				return regex.test(operationKey);
			} catch {
				return false;
			}
		}

		if (snapshotKey.includes("[")) {
			try {
				const regex = new RegExp(`^${snapshotKey}$`);

				return regex.test(operationKey);
			} catch {
				return false;
			}
		}

		if (snapshotKey.includes("{") && snapshotKey.includes("}")) {
			const beforeBrace = snapshotKey.substring(0, snapshotKey.indexOf("{"));
			const afterBrace = snapshotKey.substring(snapshotKey.indexOf("}") + 1);
			const choices = snapshotKey.substring(
				snapshotKey.indexOf("{") + 1,
				snapshotKey.indexOf("}")
			).split(",");

			for (const choice of choices) {
				const fullPattern = beforeBrace + choice.trim() + afterBrace;
				if (operationKey === fullPattern || operationKey.startsWith(fullPattern)) {
					return true;
				}
			}
		}

		if (snapshotKey.endsWith("_range") || snapshotKey.endsWith("_pattern")) {
			const baseKey = snapshotKey.replace(/_range$|_pattern$/, "");

			return operationKey.startsWith(baseKey);
		}

		return false;
	}

	/**
	 * Check if two keys have similar structural patterns
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have similar patterns
	 * @private
	 */
	_haveSimilarPatterns (key1, key2) {
		const pattern1 = this._extractKeyPattern(key1);
		const pattern2 = this._extractKeyPattern(key2);

		return this._patternsAreSimilar(pattern1, pattern2);
	}

	/**
	 * Extract structural pattern from a key by normalizing variable components
	 * @param {string} key - Key to extract pattern from
	 * @returns {string} Normalized pattern string
	 * @private
	 */
	_extractKeyPattern (key) {
		const cacheKey = `pattern:${key}`;
		if (this.patternCache.has(cacheKey)) {
			return this.patternCache.get(cacheKey);
		}

		const pattern = key
			.replace(/\d+/g, "#") // Numbers become #
			.replace(/[a-f0-9]{8,}/g, "&") // Hashes/UUIDs become &
			.replace(/\w{1,3}(?=:|_|-)/g, "@"); // Short prefixes become @

		this.patternCache.set(cacheKey, pattern);

		return pattern;
	}

	/**
	 * Check if two patterns are similar based on similarity threshold
	 * @param {string} pattern1 - First pattern to compare
	 * @param {string} pattern2 - Second pattern to compare
	 * @returns {boolean} True if patterns are similar (>70% similarity)
	 * @private
	 */
	_patternsAreSimilar (pattern1, pattern2) {
		if (pattern1 === pattern2) {
			return true;
		}

		const similarity = this._calculatePatternSimilarity(pattern1, pattern2);

		return similarity > 0.7;
	}

	/**
	 * Calculate similarity score between two patterns using Levenshtein distance
	 * @param {string} pattern1 - First pattern
	 * @param {string} pattern2 - Second pattern
	 * @returns {number} Similarity score between 0 and 1
	 * @private
	 */
	_calculatePatternSimilarity (pattern1, pattern2) {
		const len1 = pattern1.length;
		const len2 = pattern2.length;
		const maxLen = Math.max(len1, len2);

		if (maxLen === 0) return 1;

		const distance = this._levenshteinDistance(pattern1, pattern2);

		return 1 - distance / maxLen;
	}

	/**
	 * Calculate Levenshtein distance between two strings
	 * @param {string} str1 - First string
	 * @param {string} str2 - Second string
	 * @returns {number} Edit distance between strings
	 * @private
	 */
	_levenshteinDistance (str1, str2) {
		const matrix = [];

		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i];
		}

		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j;
		}

		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1, // substitution
						matrix[i][j - 1] + 1, // insertion
						matrix[i - 1][j] + 1 // deletion
					);
				}
			}
		}

		return matrix[str2.length][str1.length];
	}

	/**
	 * Check if two keys have temporal relationship based on time-related components
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have temporal relationship
	 * @private
	 */
	_hasTemporalKeyRelationship (key1, key2) {
		if (this._isTemporalSnapshot(key1) && this._isTemporalSnapshot(key2)) {
			const temporal1 = this._extractTemporalComponents(key1);
			const temporal2 = this._extractTemporalComponents(key2);

			return this._haveTemporalOverlap(temporal1, temporal2);
		}

		return false;
	}

	/**
	 * Check if a snapshot key contains temporal/time-related keywords
	 * @param {string} snapshotKey - Key from snapshot to check
	 * @returns {boolean} True if key contains temporal indicators
	 * @private
	 */
	_isTemporalSnapshot (snapshotKey) {
		const temporalKeywords = [
			"timestamp", "time", "date", "created", "updated", "modified",
			"datetime", "ts", "epoch", "iso", "utc", "log", "event", "history"
		];

		return temporalKeywords.some(keyword =>
			snapshotKey.toLowerCase().includes(keyword)
		);
	}

	/**
	 * Check if operation key falls within temporal range of snapshot key
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Temporal snapshot key
	 * @returns {boolean} True if operation key is in temporal range
	 * @private
	 */
	_checkTemporalRange (operationKey, snapshotKey) {
		if (this._isTemporalSnapshot(operationKey)) {
			const opTemporal = this._extractTemporalComponents(operationKey);
			const snapTemporal = this._extractTemporalComponents(snapshotKey);

			return this._haveTemporalOverlap(opTemporal, snapTemporal);
		}

		return false;
	}

	/**
	 * Extract temporal components from a key using regex patterns
	 * @param {string} key - Key to extract temporal components from
	 * @returns {Object} Object with temporal component flags
	 * @private
	 */
	_extractTemporalComponents (key) {
		const components = {
			hasDate: false,
			hasTime: false,
			hasTimestamp: false,
			hasEpoch: false
		};

		if ((/\d{4}-\d{2}-\d{2}/).test(key)) components.hasDate = true;
		if ((/\d{2}:\d{2}:\d{2}/).test(key)) components.hasTime = true;
		if ((/\d{13}/).test(key)) components.hasTimestamp = true;
		if ((/\d{10}/).test(key)) components.hasEpoch = true;

		return components;
	}

	/**
	 * Check if two temporal component objects have overlapping temporal elements
	 * @param {Object} opTemporal - Temporal components from operation key
	 * @param {Object} snapTemporal - Temporal components from snapshot key
	 * @returns {boolean} True if temporal components overlap
	 * @private
	 */
	_haveTemporalOverlap (opTemporal, snapTemporal) {
		return opTemporal.hasDate && snapTemporal.hasDate ||
			opTemporal.hasTime && snapTemporal.hasTime ||
			opTemporal.hasTimestamp && snapTemporal.hasTimestamp ||
			opTemporal.hasEpoch && snapTemporal.hasEpoch;
	}

	/**
	 * Check if two keys have composite key relationship
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have composite key relationship
	 * @private
	 */
	_hasCompositeKeyRelationship (key1, key2) {
		return this._checkCompositeKeyRange(key1, key2) ||
			this._checkCompositeKeyRange(key2, key1);
	}

	/**
	 * Check if a snapshot key represents a composite key structure
	 * @param {string} snapshotKey - Key from snapshot to check
	 * @returns {boolean} True if key is composite key structure
	 * @private
	 */
	_isCompositeKeySnapshot (snapshotKey) {
		return snapshotKey.includes(":") ||
			snapshotKey.includes("#") ||
			snapshotKey.includes("|") ||
			snapshotKey.includes("@") ||
			snapshotKey.split("_").length > 2 ||
			snapshotKey.split("-").length > 2;
	}

	/**
	 * Check if operation key falls within composite key range of snapshot key
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Composite snapshot key
	 * @returns {boolean} True if operation key is in composite key range
	 * @private
	 */
	_checkCompositeKeyRange (operationKey, snapshotKey) {
		const separators = [":", "#", "|", "@", "_", "-"];

		for (const sep of separators) {
			if (operationKey.includes(sep) && snapshotKey.includes(sep)) {
				const opParts = operationKey.split(sep);
				const snapParts = snapshotKey.split(sep);

				if (this._hasCompositeKeyOverlap(opParts, snapParts)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check if operation key parts overlap with snapshot key parts in composite key
	 * @param {string[]} opParts - Parts from operation key
	 * @param {string[]} snapParts - Parts from snapshot key
	 * @returns {boolean} True if key parts have composite overlap
	 * @private
	 */
	_hasCompositeKeyOverlap (opParts, snapParts) {
		const minLength = Math.min(opParts.length, snapParts.length);

		for (let i = 1; i <= minLength; i++) {
			let allMatch = true;
			for (let j = 0; j < i; j++) {
				if (opParts[j] !== snapParts[j]) {
					allMatch = false;
					break;
				}
			}
			if (allMatch) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if two keys have index-based relationship
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have index relationship
	 * @private
	 */
	_hasIndexKeyRelationship (key1, key2) {
		const isIndex1 = this._isIndexKey(key1);
		const isIndex2 = this._isIndexKey(key2);

		if (isIndex1 || isIndex2) {
			const base1 = this._extractBaseKeyFromIndex(key1);
			const base2 = this._extractBaseKeyFromIndex(key2);

			return base1 === base2 ||
				key1.startsWith(base2) ||
				key2.startsWith(base1) ||
				base1.startsWith(base2) ||
				base2.startsWith(base1);
		}

		return false;
	}

	/**
	 * Check if a key represents an index key structure
	 * @param {string} key - Key to check
	 * @returns {boolean} True if key is an index key
	 * @private
	 */
	_isIndexKey (key) {
		return key.includes("_index") ||
			key.includes("_idx") ||
			key.startsWith("idx_") ||
			key.includes("_key") ||
			key.includes("_lookup");
	}

	/**
	 * Extract base key from an index key by removing index-specific suffixes
	 * @param {string} indexKey - Index key to extract base from
	 * @returns {string} Base key without index identifiers
	 * @private
	 */
	_extractBaseKeyFromIndex (indexKey) {
		return indexKey
			.replace(/_index.*$/, "")
			.replace(/_idx.*$/, "")
			.replace(/^idx_/, "")
			.replace(/_key.*$/, "")
			.replace(/_lookup.*$/, "");
	}

	/**
	 * Check if a snapshot key represents an index-based query
	 * @param {Transaction} transaction - Transaction containing snapshot
	 * @param {string} snapshotKey - Key from snapshot to check
	 * @returns {boolean} True if snapshot is index-based
	 * @private
	 */
	_isIndexBasedSnapshot (transaction, snapshotKey) {
		return snapshotKey.includes("_index") ||
			snapshotKey.includes("_idx") ||
			snapshotKey.startsWith("idx_") ||
			transaction.snapshot.has(`${snapshotKey}:index_range`);
	}

	/**
	 * Check if operation key falls within index-based range of snapshot key
	 * @param {Transaction} transaction - Transaction containing snapshot
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Index-based snapshot key
	 * @returns {boolean} True if operation key is in index range
	 * @private
	 */
	_checkIndexBasedRange (transaction, operationKey, snapshotKey) {
		const indexRange = transaction.snapshot.get(`${snapshotKey}:index_range`);
		if (indexRange) {
			return this.keyMatchesIndexRange(operationKey, indexRange);
		}

		if (snapshotKey.includes("_index") || snapshotKey.includes("_idx")) {
			const baseKey = snapshotKey.replace(/_index.*$|_idx.*$/, "");

			return operationKey.startsWith(baseKey);
		}

		return false;
	}

	/**
	 * Check if two keys have collection-based relationship
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have collection relationship
	 * @private
	 */
	_hasCollectionKeyRelationship (key1, key2) {
		const isCollection1 = this._isCollectionKey(key1);
		const isCollection2 = this._isCollectionKey(key2);

		if (isCollection1 || isCollection2) {
			const base1 = this._extractCollectionBase(key1);
			const base2 = this._extractCollectionBase(key2);

			return base1 === base2 ||
				key1.startsWith(base2) ||
				key2.startsWith(base1);
		}

		return false;
	}

	/**
	 * Check if a key represents a collection structure
	 * @param {string} key - Key to check
	 * @returns {boolean} True if key is a collection key
	 * @private
	 */
	_isCollectionKey (key) {
		const collectionIndicators = [
			"_list", "_array", "_set", "_collection",
			"_items", "_elements", "_members", "_entries"
		];

		return collectionIndicators.some(indicator => key.includes(indicator));
	}

	/**
	 * Extract base key from a collection key by removing collection-specific suffixes
	 * @param {string} collectionKey - Collection key to extract base from
	 * @returns {string} Base key without collection identifiers
	 * @private
	 */
	_extractCollectionBase (collectionKey) {
		const indicators = ["_list", "_array", "_set", "_collection", "_items", "_elements", "_members", "_entries"];

		for (const indicator of indicators) {
			if (collectionKey.includes(indicator)) {
				return collectionKey.replace(indicator, "");
			}
		}

		return collectionKey;
	}

	/**
	 * Check if two keys have functional dependency relationship
	 * @param {string} key1 - First key to compare
	 * @param {string} key2 - Second key to compare
	 * @returns {boolean} True if keys have functional dependency
	 * @private
	 */
	_hasFunctionalDependency (key1, key2) {
		const dependencies = [
			["user_id", "user_email"], ["user_id", "user_profile"],
			["account_id", "user_id"], ["session_id", "user_id"],
			["order_id", "user_id"], ["order_id", "order_total"],
			["payment_id", "order_id"], ["shipping_id", "order_id"],
			["post_id", "user_id"], ["comment_id", "post_id"],
			["message_id", "thread_id"], ["file_id", "folder_id"],
			["document_id", "workspace_id"], ["task_id", "project_id"]
		];

		const norm1 = this._normalizeKeyForDependency(key1);
		const norm2 = this._normalizeKeyForDependency(key2);

		for (const [dep1, dep2] of dependencies) {
			if (norm1.includes(dep1) && norm2.includes(dep2) ||
				norm1.includes(dep2) && norm2.includes(dep1)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Normalize a key for functional dependency comparison by converting to standard format
	 * @param {string} key - Key to normalize
	 * @returns {string} Normalized key in lowercase with underscores
	 * @private
	 */
	_normalizeKeyForDependency (key) {
		return key.toLowerCase()
			.replace(/[:\-/.]/g, "_")
			.replace(/([a-z])([A-Z])/g, "$1_$2")
			.toLowerCase();
	}

	/**
	 * Check if transaction snapshot has explicit range metadata for a key
	 * @param {Transaction} transaction - Transaction containing snapshot
	 * @param {string} snapshotKey - Key from snapshot to check
	 * @returns {boolean} True if explicit range metadata exists
	 * @private
	 */
	_hasExplicitRangeMetadata (transaction, snapshotKey) {
		return transaction.snapshot.has(`${snapshotKey}:range`) ||
			transaction.snapshot.has(`${snapshotKey}:query`) ||
			transaction.snapshot.has(`${snapshotKey}:predicate`);
	}

	/**
	 * Check if operation key matches explicit range metadata for snapshot key
	 * @param {Transaction} transaction - Transaction containing snapshot
	 * @param {string} operationKey - Key from operation
	 * @param {string} snapshotKey - Key from snapshot with explicit range
	 * @returns {boolean} True if operation key matches explicit range
	 * @private
	 */
	_checkExplicitRange (transaction, operationKey, snapshotKey) {
		const rangeInfo = transaction.snapshot.get(`${snapshotKey}:range`);
		if (rangeInfo && typeof rangeInfo === "object") {
			return this.keyMatchesRange(operationKey, rangeInfo);
		}

		const queryInfo = transaction.snapshot.get(`${snapshotKey}:query`);
		if (queryInfo) {
			return this.keyMatchesQuery(operationKey, queryInfo);
		}

		const predicateInfo = transaction.snapshot.get(`${snapshotKey}:predicate`);
		if (predicateInfo && typeof predicateInfo === "function") {
			try {
				return predicateInfo(operationKey);
			} catch {
				return false;
			}
		}

		return false;
	}

	/**
	 * Clear internal caches
	 */
	clearCaches () {
		this.patternCache.clear();
		this.semanticCache.clear();
	}
}
