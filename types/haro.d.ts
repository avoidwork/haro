/**
 * Configuration object for creating a Haro instance
 */
export interface HaroConfig {
  delimiter?: string;
  id?: string;
  immutable?: boolean;
  index?: string[];
  key?: string;
  versioning?: boolean;
}

/**
 * Haro is a modern immutable DataStore for collections of records with indexing,
 * versioning, and batch operations support. It provides a Map-like interface
 * with advanced querying capabilities through indexes.
 */
export class Haro {
  data: Map<string, any>;
  delimiter: string;
  id: string;
  immutable: boolean;
  index: string[];
  indexes: Map<string, Map<any, Set<string>>>;
  key: string;
  versions: Map<string, Set<any>>;
  versioning: boolean;
  readonly registry: string[];
  readonly size: number;

  /**
   * Creates a new Haro instance with specified configuration
   * @param config - Configuration object for the store
   */
  constructor(config?: HaroConfig);

  /**
   * Performs batch operations on multiple records for efficient bulk processing
   * @param args - Array of records to process
   * @param type - Type of operation: 'set' for upsert, 'del' for delete
   * @returns Array of results from the batch operation
   */
  batch(args: any[], type?: string): any[];

  /**
   * Lifecycle hook executed before batch operations for custom preprocessing
   * @param arg - Arguments passed to batch operation
   * @param type - Type of batch operation ('set' or 'del')
   * @returns The arguments array (possibly modified) to be processed
   */
  beforeBatch(arg: any, type?: string): any;

  /**
   * Lifecycle hook executed before clear operation for custom preprocessing
   */
  beforeClear(): void;

  /**
   * Lifecycle hook executed before delete operation for custom preprocessing
   * @param key - Key of record to delete
   * @param batch - Whether this is part of a batch operation
   */
  beforeDelete(key?: string, batch?: boolean): void;

  /**
   * Lifecycle hook executed before set operation for custom preprocessing
   * @param key - Key of record to set
   * @param data - Record data being set
   * @param batch - Whether this is part of a batch operation
   * @param override - Whether to override existing data
   */
  beforeSet(key?: string, data?: any, batch?: boolean, override?: boolean): void;

  /**
   * Removes all records, indexes, and versions from the store
   * @returns This instance for method chaining
   */
  clear(): Haro;

  /**
   * Creates a deep clone of the given value, handling objects, arrays, and primitives
   * @param arg - Value to clone (any type)
   * @returns Deep clone of the argument
   */
  clone(arg: any): any;

  /**
   * Deletes a record from the store and removes it from all indexes
   * @param key - Key of record to delete
   * @param batch - Whether this is part of a batch operation
   * @throws Throws error if record with the specified key is not found
   */
  delete(key?: string, batch?: boolean): void;

  /**
   * Internal method to remove entries from indexes for a deleted record
   * @param key - Key of record being deleted
   * @param data - Data of record being deleted
   * @returns This instance for method chaining
   */
  deleteIndex(key: string, data: any): Haro;

  /**
   * Exports complete store data or indexes for persistence or debugging
   * @param type - Type of data to export: 'records' or 'indexes'
   * @returns Array of [key, value] pairs for records, or serialized index structure
   */
  dump(type?: string): any[];

  /**
   * Utility method to iterate over an array with a callback function
   * @param arr - Array to iterate over
   * @param fn - Function to call for each element (element, index)
   * @returns The original array for method chaining
   */
  each(arr: any[], fn: (value: any, index: number) => void): any[];

  /**
   * Returns an iterator of [key, value] pairs for each record in the store
   * @returns Iterator of [key, value] pairs
   */
  entries(): IterableIterator<[string, any]>;

  /**
   * Finds records matching the specified criteria using indexes for optimal performance
   * @param where - Object with field-value pairs to match against
   * @param raw - Whether to return raw data without processing
   * @returns Array of matching records (frozen if immutable mode)
   */
  find(where?: Record<string, any>, raw?: boolean): any[];

  /**
   * Filters records using a predicate function, similar to Array.filter
   * @param fn - Predicate function to test each record (record, key, store)
   * @param raw - Whether to return raw data without processing
   * @returns Array of records that pass the predicate test
   */
  filter(fn: (value: any) => boolean, raw?: boolean): any[];

  /**
   * Executes a function for each record in the store, similar to Array.forEach
   * @param fn - Function to execute for each record (value, key)
   * @param ctx - Context object to use as 'this' when executing the function
   * @returns This instance for method chaining
   */
  forEach(fn: (value: any, key: string) => void, ctx?: any): Haro;

  /**
   * Creates a frozen array from the given arguments for immutable data handling
   * @param args - Arguments to freeze into an array
   * @returns Frozen array containing frozen arguments
   */
  freeze(...args: any[]): readonly any[];

  /**
   * Retrieves a record by its key
   * @param key - Key of record to retrieve
   * @param raw - Whether to return raw data (true) or processed/frozen data (false)
   * @returns The record if found, null if not found
   */
  get(key: string, raw?: boolean): any | null;

  /**
   * Checks if a record with the specified key exists in the store
   * @param key - Key to check for existence
   * @returns True if record exists, false otherwise
   */
  has(key: string): boolean;

  /**
   * Generates index keys for composite indexes from data values
   * @param arg - Composite index field names joined by delimiter
   * @param delimiter - Delimiter used in composite index
   * @param data - Data object to extract field values from
   * @returns Array of generated index keys
   */
  indexKeys(arg?: string, delimiter?: string, data?: Record<string, any>): string[];

  /**
   * Returns an iterator of all keys in the store
   * @returns Iterator of record keys
   */
  keys(): IterableIterator<string>;

  /**
   * Returns a limited subset of records with offset support for pagination
   * @param offset - Number of records to skip from the beginning
   * @param max - Maximum number of records to return
   * @param raw - Whether to return raw data without processing
   * @returns Array of records within the specified range
   */
  limit(offset?: number, max?: number, raw?: boolean): any[];

  /**
   * Converts a record into a [key, value] pair array format
   * @param arg - Record object to convert to list format
   * @returns Array containing [key, record] where key is extracted from record's key field
   */
  list(arg: any): any[];

  /**
   * Transforms all records using a mapping function, similar to Array.map
   * @param fn - Function to transform each record (record, key)
   * @param raw - Whether to return raw data without processing
   * @returns Array of transformed results
   */
  map(fn: (value: any, key: string) => any, raw?: boolean): any[];

  /**
   * Internal helper method for predicate matching with support for arrays and regex
   * @param record - Record to test against predicate
   * @param predicate - Predicate object with field-value pairs
   * @param op - Operator for array matching ('||' for OR, '&&' for AND)
   * @returns True if record matches predicate criteria
   */
  matchesPredicate(record: any, predicate: Record<string, any>, op: string): boolean;

  /**
   * Merges two values together with support for arrays and objects
   * @param a - First value (target)
   * @param b - Second value (source)
   * @param override - Whether to override arrays instead of concatenating
   * @returns Merged result
   */
  merge(a: any, b: any, override?: boolean): any;

  /**
   * Lifecycle hook executed after batch operations for custom postprocessing
   * @param arg - Result of batch operation
   * @param type - Type of batch operation that was performed
   * @returns Modified result (override this method to implement custom logic)
   */
  onbatch(arg: any, type?: string): any;

  /**
   * Lifecycle hook executed after clear operation for custom postprocessing
   */
  onclear(): void;

  /**
   * Lifecycle hook executed after delete operation for custom postprocessing
   * @param key - Key of deleted record
   * @param batch - Whether this was part of a batch operation
   */
  ondelete(key?: string, batch?: boolean): void;

  /**
   * Lifecycle hook executed after override operation for custom postprocessing
   * @param type - Type of override operation that was performed
   */
  onoverride(type?: string): void;

  /**
   * Lifecycle hook executed after set operation for custom postprocessing
   * @param arg - Record that was set
   * @param batch - Whether this was part of a batch operation
   */
  onset(arg?: any, batch?: boolean): void;

  /**
   * Replaces all store data or indexes with new data for bulk operations
   * @param data - Data to replace with (format depends on type)
   * @param type - Type of data: 'records' or 'indexes'
   * @returns True if operation succeeded
   */
  override(data: any[], type?: string): boolean;

  /**
   * Reduces all records to a single value using a reducer function
   * @param fn - Reducer function (accumulator, value, key, store)
   * @param accumulator - Initial accumulator value
   * @returns Final reduced value
   */
  reduce(fn: (accumulator: any, value: any, key: string, store: Haro) => any, accumulator?: any): any;

  /**
   * Rebuilds indexes for specified fields or all fields for data consistency
   * @param index - Specific index field(s) to rebuild, or all if not specified
   * @returns This instance for method chaining
   */
  reindex(index?: string | string[]): Haro;

  /**
   * Searches for records containing a value across specified indexes
   * @param value - Value to search for (string, function, or RegExp)
   * @param index - Index(es) to search in, or all if not specified
   * @param raw - Whether to return raw data without processing
   * @returns Array of matching records
   */
  search(value: any, index?: string | string[], raw?: boolean): any[];

  /**
   * Sets or updates a record in the store with automatic indexing
   * @param key - Key for the record, or null to use record's key field
   * @param data - Record data to set
   * @param batch - Whether this is part of a batch operation
   * @param override - Whether to override existing data instead of merging
   * @returns The stored record (frozen if immutable mode)
   */
  set(key?: string | null, data?: any, batch?: boolean, override?: boolean): any;

  /**
   * Internal method to add entries to indexes for a record
   * @param key - Key of record being indexed
   * @param data - Data of record being indexed
   * @param indice - Specific index to update, or null for all
   * @returns This instance for method chaining
   */
  setIndex(key: string, data: any, indice?: string | null): Haro;

  /**
   * Sorts all records using a comparator function
   * @param fn - Comparator function for sorting (a, b) => number
   * @param frozen - Whether to return frozen records
   * @returns Sorted array of records
   */
  sort(fn: (a: any, b: any) => number, frozen?: boolean): any[];

  /**
   * Comparator function for sorting keys with type-aware comparison logic
   * @param a - First value to compare
   * @param b - Second value to compare
   * @returns Negative number if a < b, positive if a > b, zero if equal
   */
  sortKeys(a: any, b: any): number;

  /**
   * Sorts records by a specific indexed field in ascending order
   * @param index - Index field name to sort by
   * @param raw - Whether to return raw data without processing
   * @returns Array of records sorted by the specified field
   */
  sortBy(index?: string, raw?: boolean): any[];

  /**
   * Converts all store data to a plain array of records
   * @returns Array containing all records in the store
   */
  toArray(): any[];

  /**
   * Generates a RFC4122 v4 UUID for record identification
   * @returns UUID string in standard format
   */
  uuid(): string;

  /**
   * Returns an iterator of all values in the store
   * @returns Iterator of record values
   */
  values(): IterableIterator<any>;

  /**
   * Advanced filtering with predicate logic supporting AND/OR operations on arrays
   * @param predicate - Object with field-value pairs for filtering
   * @param op - Operator for array matching ('||' for OR, '&&' for AND)
   * @returns Array of records matching the predicate criteria
   */
  where(predicate?: Record<string, any>, op?: string): any[];
}

/**
 * Factory function to create a new Haro instance with optional initial data
 * @param data - Initial data to populate the store
 * @param config - Configuration object passed to Haro constructor
 * @returns New Haro instance configured and optionally populated
 */
export function haro(data?: any[] | null, config?: HaroConfig): Haro; 