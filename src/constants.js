// String constants - Single characters and symbols
export const STRING_COMMA = ",";
export const STRING_DOT = ".";
export const STRING_EMPTY = "";
export const STRING_PIPE = "|";
export const STRING_DOUBLE_PIPE = "||";
export const STRING_DOUBLE_AND = "&&";

// String constants - Operation and type names
export const STRING_DEL = "del";
export const STRING_FUNCTION = "function";
export const STRING_ID = "id";
export const STRING_INDEX = "index";
export const STRING_INDEXES = "indexes";
export const STRING_KEY = "key";
export const STRING_OBJECT = "object";
export const STRING_RECORDS = "records";
export const STRING_REGISTRY = "registry";
export const STRING_SET = "set";
export const STRING_SIZE = "size";
export const STRING_STRING = "string";
export const STRING_NUMBER = "number";

// String constants - Error messages
export const STRING_INVALID_FIELD = "Invalid field";
export const STRING_INVALID_FUNCTION = "Invalid function";
export const STRING_INVALID_TYPE = "Invalid type";
export const STRING_RECORD_NOT_FOUND = "Record not found";

// Integer constants
export const INT_0 = 0;
export const INT_1 = 1;
export const INT_2 = 2;
export const INT_256 = 256;

// Number constants
export const CACHE_SIZE_DEFAULT = 1000;

// String constants - Cache and hashing
export const STRING_CACHE_DOMAIN_SEARCH = "search";
export const STRING_CACHE_DOMAIN_WHERE = "where";
export const STRING_HASH_ALGORITHM = "SHA-256";
export const STRING_HEX_PAD = "0";
export const STRING_UNDERSCORE = "_";

// String constants - Security (prototype pollution protection)
export const STRING_PROTO = "__proto__";
export const STRING_CONSTRUCTOR = "constructor";
export const STRING_PROTOTYPE = "prototype";

// String constants - Error messages
export const STRING_ERROR_BATCH_SETMANY = "setMany: cannot call setMany within a batch operation";
export const STRING_ERROR_BATCH_DELETEMANY =
	"deleteMany: cannot call deleteMany within a batch operation";
export const STRING_ERROR_DELETE_KEY_TYPE = "delete: key must be a string or number";
export const STRING_ERROR_FIND_WHERE_TYPE = "find: where must be an object";
export const STRING_ERROR_LIMIT_OFFSET_TYPE = "limit: offset must be a number";
export const STRING_ERROR_LIMIT_MAX_TYPE = "limit: max must be a number";
export const STRING_ERROR_SEARCH_VALUE = "search: value cannot be null or undefined";
export const STRING_ERROR_SET_KEY_TYPE = "set: key must be a string or number";
export const STRING_ERROR_SET_DATA_TYPE = "set: data must be an object";
export const STRING_ERROR_SORT_FN_TYPE = "sort: fn must be a function";
export const STRING_ERROR_WHERE_OP_TYPE = "where: op must be a string";
export const STRING_ERROR_WHERE_PREDICATE_TYPE = "where: predicate must be an object";

// String constants - Property names
export const PROP_DELIMITER = "delimiter";
export const PROP_ID = "id";
export const PROP_IMMUTABLE = "immutable";
export const PROP_INDEX = "index";
export const PROP_KEY = "key";
export const PROP_VERSIONING = "versioning";
export const PROP_VERSIONS = "versions";
export const PROP_WARN_ON_FULL_SCAN = "warnOnFullScan";
