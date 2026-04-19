# Haro Project Guide

## Overview
Haro is a modern immutable DataStore for collections of records with indexing, versioning, and batch operations support.

## Project Structure
- `src/haro.js` - Main Haro class and factory function
- `src/constants.js` - String and number constants
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
