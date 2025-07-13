/**
 * Configuration object for creating a Haro instance
 */
export interface HaroConfig {
  delimiter?: string;
  id?: string;
  index?: string[];
  key?: string;
  versioning?: boolean;
}

/**
 * Haro is a modern immutable DataStore for collections of records
 */
export class Haro {
  data: Map<string, any>;
  delimiter: string;
  id: string;
  index: string[];
  indexes: Map<string, Map<any, Set<string>>>;
  key: string;
  versions: Map<string, any>;
  versioning: boolean;
  readonly registry: string[];
  readonly size: number;

  /**
   * Creates a new Haro instance
   * @param config - Configuration object
   */
  constructor(config?: HaroConfig);

  /**
   * Performs batch operations on multiple records
   * @param args - Array of records to process
   * @param type - Type of operation (SET or DEL)
   * @returns Array of results from the batch operation
   */
  batch(args: any[], type?: string): any[];

  /**
   * Hook for custom logic before batch operations
   * @param arg - Arguments passed to batch operation
   * @param type - Type of batch operation
   * @returns Modified arguments
   */
  beforeBatch(arg: any, type?: string): any;

  /**
   * Hook for custom logic before clear operation
   */
  beforeClear(): void;

  /**
   * Hook for custom logic before delete operation
   * @param key - Key of record to delete
   * @param batch - Whether this is part of a batch operation
   * @returns Array containing key and batch flag
   */
  beforeDelete(key?: string, batch?: boolean): [string, boolean];

  /**
   * Hook for custom logic before set operation
   * @param key - Key of record to set
   * @param batch - Whether this is part of a batch operation
   * @returns Array containing key and batch flag
   */
  beforeSet(key?: string, batch?: boolean): [string, boolean];

  /**
   * Clears all data from the store
   * @returns This instance for method chaining
   */
  clear(): Haro;

  /**
   * Creates a deep clone of the given argument
   * @param arg - Value to clone
   * @returns Deep clone of the argument
   */
  clone(arg: any): any;

  /**
   * Deletes a record from the store
   * @param key - Key of record to delete
   * @param batch - Whether this is part of a batch operation
   * @throws Throws error if record not found
   */
  del(key?: string, batch?: boolean): void;

  /**
   * Removes entries from indexes for a deleted record
   * @param index - Array of index names
   * @param indexes - Map of indexes
   * @param delimiter - Delimiter for composite indexes
   * @param key - Key of record being deleted
   * @param data - Data of record being deleted
   */
  delIndex(index: string[], indexes: Map<string, Map<any, Set<string>>>, delimiter: string, key: string, data: any): void;

  /**
   * Exports data or indexes from the store
   * @param type - Type of data to dump (RECORDS or INDEXES)
   * @returns Array of records or indexes
   */
  dump(type?: string): any[];

  /**
   * Utility method to iterate over an array
   * @param arr - Array to iterate over
   * @param fn - Function to call for each element
   * @returns The original array
   */
  each(arr: any[], fn: (value: any, index: number) => void): any[];

  /**
   * Returns an iterator of [key, value] pairs for each element in the data
   * @returns Iterator of entries
   */
  entries(): IterableIterator<[string, any]>;

  /**
   * Finds records matching the given criteria using indexes
   * @param where - Object with field-value pairs to match
   * @param raw - Whether to return raw data or frozen records
   * @returns Array of matching records
   */
  find(where?: Record<string, any>, raw?: boolean): any[];

  /**
   * Filters records using a predicate function
   * @param fn - Predicate function to test each record
   * @param raw - Whether to return raw data or frozen records
   * @returns Array of filtered records
   */
  filter(fn: (value: any, key: string) => boolean, raw?: boolean): any[];

  /**
   * Executes a provided function once for each key/value pair
   * @param fn - Function to execute for each element
   * @param ctx - Optional context object
   */
  forEach(fn: (value: any, key: string) => void, ctx?: any): void;

  /**
   * Gets a record from the store
   * @param key - Key of record to get
   * @param raw - Whether to return raw data or frozen record
   * @returns The record or undefined if not found
   */
  get(key: string, raw?: boolean): any;

  /**
   * Checks if a record exists in the store
   * @param key - Key to check
   * @returns True if record exists, false otherwise
   */
  has(key: string): boolean;

  /**
   * Generates index keys for composite indexes
   * @param arg - Index definition
   * @param delimiter - Delimiter for composite indexes
   * @param data - Data object
   * @returns Array of index keys
   */
  indexKeys(arg?: string, delimiter?: string, data?: Record<string, any>): any[];

  /**
   * Returns an iterator of keys
   * @returns Iterator of keys
   */
  keys(): IterableIterator<string>;

  /**
   * Returns a limited subset of records
   * @param offset - Starting offset
   * @param max - Maximum number of records
   * @param raw - Whether to return raw data or frozen records
   * @returns Array of records
   */
  limit(offset?: number, max?: number, raw?: boolean): any[];

  /**
   * Creates a frozen array of records
   * @param args - Records to include in the list
   * @returns Frozen array of records
   */
  list(...args: any[]): readonly any[];

  /**
   * Maps over records using a function
   * @param fn - Function to map each record
   * @param raw - Whether to return raw data or frozen records
   * @returns Array of mapped values
   */
  map(fn: (value: any, key: string) => any, raw?: boolean): any[];

  /**
   * Merges two objects
   * @param a - First object
   * @param b - Second object
   * @param override - Whether to override existing properties
   * @returns Merged object
   */
  merge(a: any, b: any, override?: boolean): any;

  /**
   * Hook for custom logic after batch operations
   * @param arg - Result of batch operation
   * @param type - Type of batch operation
   * @returns Modified result
   */
  onbatch(arg: any, type?: string): any;

  /**
   * Hook for custom logic after clear operation
   */
  onclear(): void;

  /**
   * Hook for custom logic after delete operation
   * @param key - Key of deleted record
   * @param batch - Whether this was part of a batch operation
   */
  ondelete(key?: string, batch?: boolean): void;

  /**
   * Hook for custom logic after override operation
   * @param type - Type of override operation
   */
  onoverride(type?: string): void;

  /**
   * Hook for custom logic after set operation
   * @param arg - Set operation result
   * @param batch - Whether this was part of a batch operation
   */
  onset(arg?: any, batch?: boolean): void;

  /**
   * Overrides the data store with new data
   * @param data - New data to load
   * @param type - Type of data being loaded
   * @returns This instance for method chaining
   */
  override(data: any, type?: string): Haro;

  /**
   * Reduces records to a single value using a function
   * @param fn - Reducer function
   * @param accumulator - Initial accumulator value
   * @param raw - Whether to use raw data or frozen records
   * @returns Reduced value
   */
  reduce(fn: (accumulator: any, value: any, key: string) => any, accumulator: any, raw?: boolean): any;

  /**
   * Rebuilds indexes for the store
   * @param index - Optional specific index to rebuild
   * @returns This instance for method chaining
   */
  reindex(index?: string[]): Haro;

  /**
   * Searches for records by value in specific indexes
   * @param value - Value to search for
   * @param index - Index to search in
   * @param raw - Whether to return raw data or frozen records
   * @returns Array of matching records
   */
  search(value: any, index: string, raw?: boolean): any[];

  /**
   * Sets a record in the store
   * @param key - Key for the record (null for auto-generation)
   * @param data - Data to store
   * @param batch - Whether this is part of a batch operation
   * @param override - Whether to override existing record
   * @returns The stored record
   */
  set(key?: string | null, data?: any, batch?: boolean, override?: boolean): any;

  /**
   * Adds entries to indexes for a record
   * @param index - Array of index names
   * @param indexes - Map of indexes
   * @param delimiter - Delimiter for composite indexes
   * @param key - Key of record being indexed
   * @param data - Data of record being indexed
   * @param indice - Optional specific index to update
   */
  setIndex(index: string[], indexes: Map<string, Map<any, Set<string>>>, delimiter: string, key: string, data: any, indice?: string): void;

  /**
   * Sorts records using a comparison function
   * @param fn - Comparison function
   * @param frozen - Whether to return frozen array
   * @returns Sorted array of records
   */
  sort(fn: (a: any, b: any) => number, frozen?: boolean): any[];

  /**
   * Sorts records by a specific index
   * @param index - Index to sort by
   * @param raw - Whether to return raw data or frozen records
   * @returns Sorted array of records
   */
  sortBy(index?: string, raw?: boolean): any[];

  /**
   * Converts the store to an array
   * @param frozen - Whether to return frozen array
   * @returns Array of records
   */
  toArray(frozen?: boolean): any[];

  /**
   * Generates a UUID
   * @returns UUID string
   */
  uuid(): string;

  /**
   * Returns an iterator of values
   * @returns Iterator of values
   */
  values(): IterableIterator<any>;

  /**
   * Finds records matching complex criteria
   * @param predicate - Object with field-value pairs to match
   * @param raw - Whether to return raw data or frozen records
   * @param op - Logical operator for combining criteria
   * @returns Array of matching records
   */
  where(predicate?: Record<string, any>, raw?: boolean, op?: string): any[];
}

/**
 * Factory function to create a new Haro instance
 * @param data - Optional initial data to load
 * @param config - Configuration object
 * @returns New Haro instance
 */
export function haro(data?: any, config?: HaroConfig): Haro; 