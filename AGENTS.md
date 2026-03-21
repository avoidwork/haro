# AGENTS.md

## Setup Commands

```bash
npm install          # Install dependencies
npm test             # Run tests
npm run coverage     # Run tests with coverage (target: 100%)
npm run benchmarks   # Run performance benchmarks
npm run lint         # Check linting (oxlint)
npm run fix          # Auto-fix linting issues
npm run build        # Build with rollup
```

---

## Development Workflow

1. Make changes to source files in `src/`
2. Run tests: `npm test` (ensure all pass)
3. Fix lint errors: `npm run fix`
4. Build: `npm run build`
5. Run coverage: `npm run coverage` (maintain 100% line coverage)
6. Commit changes (husky pre-commit hook runs fix + coverage + git add)

---

## Project Overview

**Haro.js** is a modern immutable DataStore library providing:
- Map-like interface with advanced querying capabilities
- Indexing support (single-field and composite indexes)
- Versioning to track record changes
- Batch operations for efficient bulk processing
- Lifecycle hooks for customization (beforeSet, onset, beforeDelete, ondelete, etc.)
- Immutable mode for data safety (frozen objects)

## Test Framework

- Uses Node's native test framework (`node:test`)
- All 148 tests across 15 test files
- Test files located in `tests/unit/`

## Key Bug Fixes Implemented

1. **Constructor**: Removed `return this.reindex()` to fix `instanceof` issues
2. **clone()**: Added fallback to `JSON.parse(JSON.stringify())` when `structuredClone` fails
3. **merge()**: Fixed to not mutate input objects by cloning before merging
4. **search()**: Fixed to handle falsy values correctly (`value == null` check)
5. **where()**: Removed early return that prevented full scan fallback

## Tooling

- **Linting**: oxlint (^1.56.0) with auto-fix
- **Formatting**: oxfmt (^0.41.0)
- **Build**: Rollup (^4.45.0) with terser
- **Test Runner**: Node native test framework
- **Changelog**: auto-changelog (^2.5.0)
- **Husky**: Pre-commit hooks for lint + coverage

## Constants

Defined in `src/constants.js`:
- `STRING_PIPE` ('|') - Delimiter for composite indexes
- `STRING_ID` ('id') - Default primary key field name
- `STRING_RECORDS`, `STRING_INDEXES` - Export types
- `STRING_SET`, `STRING_DEL` - Batch operation types
- Type check constants: `STRING_FUNCTION`, `STRING_OBJECT`, `STRING_STRING`, `STRING_NUMBER`

---
