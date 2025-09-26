// Common values
export const INT_0 = 0;
export const STRING_EMPTY = "";
export const STRING_PIPE = "|";
export const STRING_COMMA = ",";
export const STRING_ID = "id";

// Data types
export const STRING_STRING = "string";
export const STRING_NUMBER = "number";
export const STRING_BOOLEAN = "boolean";
export const STRING_OBJECT = "object";
export const STRING_FUNCTION = "function";

// Operations
export const STRING_SET = "set";
export const STRING_DEL = "del";
export const STRING_BATCH = "batch";
export const STRING_GET = "get";
export const STRING_FIND = "find";
export const STRING_DELETE = "delete";

// Data structures
export const STRING_RECORDS = "records";
export const STRING_INDEXES = "indexes";
export const STRING_VERSIONS = "versions";
export const STRING_REGISTRY = "registry";
export const STRING_SIZE = "size";

// Logical operators
export const STRING_DOUBLE_PIPE = "||";
export const STRING_DOUBLE_AND = "&&";

// Error messages
export const STRING_RECORD_NOT_FOUND = "Record not found";
export const STRING_INVALID_FUNCTION = "Invalid function";
export const STRING_INVALID_FIELD = "Invalid field";
export const STRING_INVALID_TYPE = "Invalid type";
export const STRING_INVALID_INDEX = "Invalid index";
export const STRING_INVALID_OPERATION = "Invalid operation";

// Configuration keys
export const CONFIG_DELIMITER = "delimiter";
export const CONFIG_ID = "id";
export const CONFIG_IMMUTABLE = "immutable";
export const CONFIG_INDEX = "index";
export const CONFIG_KEY = "key";
export const CONFIG_VERSIONING = "versioning";
export const CONFIG_SCHEMA = "schema";
export const CONFIG_RETENTION_POLICY = "retentionPolicy";
export const CONFIG_ENABLE_TRANSACTIONS = "enableTransactions";
export const CONFIG_ENABLE_OPTIMIZATION = "enableOptimization";

// Default values
export const DEFAULT_DELIMITER = STRING_PIPE;
export const DEFAULT_KEY = STRING_ID;
export const DEFAULT_IMMUTABLE = false;
export const DEFAULT_VERSIONING = false;
export const DEFAULT_INDEX = [];
export const DEFAULT_ENABLE_TRANSACTIONS = false;
export const DEFAULT_ENABLE_OPTIMIZATION = true;

// Performance thresholds
export const PERFORMANCE_INDEX_THRESHOLD = 1000;
export const PERFORMANCE_CACHE_SIZE = 100;
export const PERFORMANCE_BATCH_SIZE = 1000;
export const PERFORMANCE_STREAM_BUFFER_SIZE = 10000;

// Memory limits
export const MEMORY_VERSION_LIMIT = 10 * 1024 * 1024; // 10MB
export const MEMORY_CACHE_LIMIT = 50 * 1024 * 1024; // 50MB
export const MEMORY_INDEX_LIMIT = 100 * 1024 * 1024; // 100MB

// Time constants
export const TIME_TRANSACTION_TIMEOUT = 60 * 1000; // 60 seconds
export const TIME_LOCK_TIMEOUT = 30 * 1000; // 30 seconds
export const TIME_VERSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
export const TIME_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

// Query optimization constants
export const QUERY_FULL_SCAN_THRESHOLD = 10000;
export const QUERY_INDEX_SELECTIVITY_THRESHOLD = 0.1;
export const QUERY_PLAN_CACHE_SIZE = 1000;

// Validation patterns
export const PATTERN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PATTERN_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PATTERN_URL = /^https?:\/\/.+/;

// Error codes
export const ERROR_VALIDATION = "VALIDATION_ERROR";
export const ERROR_RECORD_NOT_FOUND = "RECORD_NOT_FOUND";
export const ERROR_INDEX = "INDEX_ERROR";
export const ERROR_CONFIGURATION = "CONFIGURATION_ERROR";
export const ERROR_QUERY = "QUERY_ERROR";
export const ERROR_TRANSACTION = "TRANSACTION_ERROR";
export const ERROR_VERSION = "VERSION_ERROR";
export const ERROR_TYPE_CONSTRAINT = "TYPE_CONSTRAINT_ERROR";
export const ERROR_CONCURRENCY = "CONCURRENCY_ERROR";

// Index types
export const INDEX_TYPE_SINGLE = "single";
export const INDEX_TYPE_COMPOSITE = "composite";
export const INDEX_TYPE_ARRAY = "array";
export const INDEX_TYPE_PARTIAL = "partial";

// Transaction states
export const TRANSACTION_STATE_PENDING = "pending";
export const TRANSACTION_STATE_ACTIVE = "active";
export const TRANSACTION_STATE_COMMITTED = "committed";
export const TRANSACTION_STATE_ABORTED = "aborted";

// Lock types
export const LOCK_TYPE_SHARED = "shared";
export const LOCK_TYPE_EXCLUSIVE = "exclusive";

// Isolation levels
export const ISOLATION_READ_UNCOMMITTED = 0;
export const ISOLATION_READ_COMMITTED = 1;
export const ISOLATION_REPEATABLE_READ = 2;
export const ISOLATION_SERIALIZABLE = 3;

// Query types
export const QUERY_TYPE_FIND = "find";
export const QUERY_TYPE_FILTER = "filter";
export const QUERY_TYPE_SEARCH = "search";
export const QUERY_TYPE_WHERE = "where";
export const QUERY_TYPE_SORT = "sort";
export const QUERY_TYPE_LIMIT = "limit";
export const QUERY_TYPE_AGGREGATE = "aggregate";

// Retention policy types
export const RETENTION_POLICY_COUNT = "count";
export const RETENTION_POLICY_TIME = "time";
export const RETENTION_POLICY_SIZE = "size";
export const RETENTION_POLICY_NONE = "none";

// Data types for validation
export const DATA_TYPE_STRING = "string";
export const DATA_TYPE_NUMBER = "number";
export const DATA_TYPE_BOOLEAN = "boolean";
export const DATA_TYPE_OBJECT = "object";
export const DATA_TYPE_ARRAY = "array";
export const DATA_TYPE_DATE = "date";
export const DATA_TYPE_UUID = "uuid";
export const DATA_TYPE_EMAIL = "email";
export const DATA_TYPE_URL = "url";
export const DATA_TYPE_ANY = "any";

// Cost factors for query optimization
export const COST_INDEX_LOOKUP = 1;
export const COST_FULL_SCAN = 100;
export const COST_FILTER_EVALUATION = 10;
export const COST_SORT_OPERATION = 50;
export const COST_MEMORY_ACCESS = 1;
export const COST_COMPARISON = 2;
export const COST_REGEX_MATCH = 20;
