# Haro Project Guide

## Overview
Haro is a modern immutable DataStore for collections of records with indexing, versioning, and batch operations support.

## Project Structure
- `src/haro.js` - Main Haro class and factory function
- `src/constants.js` - String and number constants
- `src/query-strategy.js` - Strategy pattern for predicate matching (`ValueMatcher`, `PredicateStrategy`)
- `tests/` - Unit tests using Node.js native test runner
- `dist/` - Built distribution files (generated)
- `types/haro.d.ts` - TypeScript definitions

## Commands
```bash
npm run lint              # Lint code with oxlint
npm run fix               # Fix linting issues with oxlint and oxfmt
npm run test              # Run tests with Node.js test runner
npm run coverage          # Generate coverage report
npm run build             # Lint and build distribution files
npm run benchmark         # Run benchmarks
```

## Code Style
- Use tabs for indentation
- Follow ESLint/oxlint rules (no-console, no-unused-vars)
- Use JSDoc comments for documentation
- Keep functions small and focused
- Use template literals for string concatenation

## Rules
- No magic strings or magic numbers - always use constants from `src/constants.js`
- All string literals must be defined as constants with descriptive names (e.g., `STRING_EMPTY`, `STRING_ID`)
- All numeric literals (except 0 and 1 in simple operations) should use constants (e.g., `INT_0`, `CACHE_SIZE_DEFAULT`)
- Constants follow naming convention: `TYPE_NAME` for strings, `TYPE_NAME` for numbers

## Testing
- Tests use Node.js native test runner (`node --test`)
- Test files are in `tests/unit/` directory
- Run tests: `npm test`
- Generate coverage: `npm run coverage`

## Key Conventions
- All string literals use constants from `src/constants.js`
- Private/internal methods start with underscore prefix
- Lifecycle hooks follow `before*` and `on*` naming pattern
- Return `this` for method chaining where appropriate
- Use `Map` and `Set` for data structures
- Immutable mode uses `Object.freeze()` for data safety
- Adheres to DRY, YAGNI, and SOLID principles
- Follows OWASP security guidance

## Internal Helper Methods
- `#freezeResult(result)` - Freezes individual values or arrays when immutable mode is enabled
- `#fromCache(cached)` - Returns cloned result (non-immutable) or frozen result (immutable) from cache
- `#toCache(cacheKey, records)` - Stores results in cache if enabled
- `#getIndexKeysFrom(arg, source, getValueFn)` - Generates composite index keys using a getter callback
- `#getIndexValues(field, source)` - Extracts index values for a field, handling composite indexes and scalar/array fields. Centralizes deduplicated logic from `#setIndex()` and `#deleteIndex()`
- `#getNestedValue(obj, path)` - Retrieves nested values using dot notation (e.g., `user.profile.city`)
- `#sortKeys(a, b)` - Type-aware comparator: strings use `localeCompare`, numbers use subtraction, mixed types coerced to string
- `#merge(a, b)` - Deep merges values, skips prototype pollution keys (`__proto__`, `constructor`, `prototype`). `override` parameter removed
- `#invalidateCache()` - Clears cache if enabled and not in batch mode
- `#getCacheKey(domain, ...args)` - Generates SHA-256 hash cache key from arguments
- `#clone(arg)` - Deep clones values via `structuredClone` or JSON fallback

## Immutable Mode
- Use `#freezeResult()` to return frozen data instead of inline `Object.freeze()` checks
- Applies to: `get()`, `find()`, `filter()`, `limit()`, `map()`, `toArray()`, `sort()`, `sortBy()`, `search()`, `where()`
- Cached results are also frozen/cloned via `#fromCache()` when read
- `#merge()` preserves version snapshots by freezing cloned originals before versioning

## Caching
- Cache is opt-in via `cache: true` in constructor
- Automatically invalidates on all write operations (set, delete, clear, reindex, setMany, deleteMany, override)
- Does NOT invalidate during batch operations (`#inBatch = true`), only after batch completes
- `search()` and `where()` use multi-domain cache keys: `search_HASH` / `where_HASH`
- LRU cache size defaults to 1000 (`CACHE_SIZE_DEFAULT`)

## Indexing
- `#index` config array persists across `clear()` - `clearIndexes` is separate
- After `clear()`, `#indexes` Map is emptied but `#index` config remains
- Setting new records after `clear()` triggers lazy re-creation of index Maps in `#setIndex()`
- Composite indexes use delimiter (default `|`) to join sorted field names
- Use `#getIndexKeysFrom()` with appropriate getter callbacks for data objects vs where clauses

## Batch Operations
- `setMany()` and `deleteMany()` set `#inBatch = true` to skip indexing during individual operations
- Indexing is deferred to `reindex()` call after batch completes
- Nested batch calls (calling setMany within setMany) throw errors
- `#inBatch` affects versioning too - versions are not saved during batch operations

## Test Strategy Tips
- Hard-to-reach branches often involve state transitions (e.g., `clear()` → `set()` on same store)
- Coverage gaps frequently involve conditional logic on `#inBatch`, `#immutable`, or `#cacheEnabled`
- Add tests that explicitly combine features (immutable + indexing + batch + caching)

## Important Notes
- The `immutable` option freezes data for immutability
- Indexes improve query performance for `find()` and `where()` operations
- Deep indexing with dot notation is supported (e.g., `user.profile.department`)
- Versioning tracks historical changes when enabled
- Batch operations are more efficient than individual operations
- LRU caching is available for `search()` and `where()` methods (opt-in with `cache: true`)
- Cache uses Web Crypto API for SHA-256 hash generation (requires Node.js >=19.0.0)
- Cache keys are multi-domain: `search_HASH` or `where_HASH` format
- Cached results are cloned/frozen to prevent mutation (respects `immutable` mode)
- Cache invalidates on all write operations but preserves statistics
- `search()` and `where()` are async methods - use `await` when calling
- Cache statistics persist for the lifetime of the Haro instance

## Refactoring Patterns
- Centralize immutable freezing in `#freezeResult()` - never use inline `Object.freeze()` for return values
- Centralize cache read patterns in `#fromCache(cached)` and cache write in `#toCache(key, records)`
- Consolidate index key generation in `#getIndexKeysFrom()` using a getter callback parameter
- When DRY requires a single function to handle both data objects and where clauses, use a `getValueFn` callback parameter
- Always run `npm test` after structural refactors - helper extraction changes call signatures
