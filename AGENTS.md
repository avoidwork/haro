# AGENTS.md

Rules and principles for agents working on **this** project.

---

## 1. Core Rules

### 1.0 Document Conventions

When updating this document, append new information or sections. Do NOT delete or overwrite existing content unless explicitly directed. Always ask before making structural changes. When in doubt, keep it.

### 1.1 Forbidden Patterns

The following are **strictly prohibited**:

- Hardcoded secrets, API keys, or credentials.
- `console.log()` statements in production code (use `console.warn()` / `console.error()` per `.oxlintrc.json`).
- `eval()`, `new Function()` at any level.
- `*` imports (`import * as x from 'y'`).
- Mutating a list while iterating over it.
- `var` declarations — always use `const` or `let`.
- `==` / `!=` — always use `===` / `!==`.
- Prototype pollution: never merge user input directly into objects without sanitizing `__proto__`, `constructor`, `prototype` keys.
- `console.log` in tests — use `node:assert` for assertions.

### 1.2 Security Rules

Follow the [OWASP Top 10](https://owasp.org/www-project-top-10/) for every piece of code written:

- Never store plaintext secrets. Use `process.env`.
- Validate all inputs. Use type checks (`typeof`) and shape validation before processing.
- File uploads must pass whitelist + MIME validation (if applicable).
- Use parameterized queries. Never concatenate user input into queries.
- Implement secure token verification. Reject tokens with weak algorithms.
- Validate all outbound tool URLs against an allowlist. Disallow `file://`, `gopher://`, `dict://` schemes.
- Protect against prototype pollution — always filter `__proto__`, `constructor`, `prototype` keys before merging.

### 1.3 Git Operations

- **Never rebase under any circumstance without explicit agreement from the user.** Never assume your decision is correct.
- **Never push to any branch without explicit user approval.** Git changes (checkout, reset, revert, amend) are local operations — do not auto-push. Always ask "Push to remote?" before running `git push`.
- Never force push.

### 1.4 Core Principles

- **DRY**: Extract repeated logic into helper functions. Centralize constants in `src/constants.js`. No copy-paste code blocks greater than three lines.
- **KISS**: Prefer simple, readable code over clever solutions. If a solution requires more than three levels of indentation or a helper with more than 10 lines, reconsider it.
- **YAGNI**: Do NOT build features, abstractions, or configurations not required by the current spec. No generic "future-proof" wrappers. Ad-hoc solutions are acceptable as long as they serve a present requirement.
- **Single Responsibility**: Each function, class, and module must have one reason to change.
- **Open/Closed**: Extend via composition — not by modifying existing logic.
- **Dependency Inversion**: Depend on abstractions for external services. Inject implementations.

---

## 2. Project Context

Haro is an in-memory DataStore for collections of records with indexing, versioning, batch operations, and advanced querying capabilities.

### 2.0 Expected Project Layout

```
src/haro.js         - Main Haro class and factory function
src/constants.js    - String and number constants
src/query-strategy.js - Strategy pattern for predicate matching
tests/unit/         - Unit tests (mirrors src/ structure)
benchmarks/         - Performance benchmark suites
dist/               - Built distribution files (generated)
types/haro.d.ts     - TypeScript definitions
```

### 2.1 Quick Commands

| Command           | Purpose                              |
|-------------------|--------------------------------------|
| `npm test`        | Run lint + all unit tests            |
| `npm run fix`     | Auto-fix linting/formatting issues   |
| `npm run lint`    | Check code style with oxlint + oxfmt |
| `npm run coverage`| Generate coverage report             |
| `npm run build`   | Lint + build distribution (rollup)   |
| `npm run benchmark`| Run performance benchmarks          |

---

## 3. JavaScript Conventions

### 3.1 Language & Tooling

- **Node.js**: 19.0.0+ (required for Web Crypto API SHA-256 hashing)
- **Package manager**: npm — the **only** supported package manager.
- **Linting**: `oxlint` — no console, no unused vars, strict type checks.
- **Formatting**: `oxfmt` — tabs for indentation, double quotes, semicolons required.
- **Testing**: Node.js native test runner (`node --test`) + `node:assert`.
- **Build**: `rollup` for bundling to `dist/` (ESM + CJS).
- **Git hooks**: `husky` (manages lint, format, test checks).

### 3.2 Style

- Use **tabs** for indentation. No spaces.
- Use **double quotes** for all string literals.
- Always use **semicolons**.
- Follow **1TBS brace style** with single-line allowance.
- Use **camelCase** for variables and functions. **PascalCase** for classes. **UPPER_SNAKE_CASE** for constants.
- All public methods and exported functions MUST have JSDoc comments with `@param`, `@returns`, `@throws`, and `@example`.
- Private methods prefixed with `#` (private class fields) or `_`.

### 3.3 Error Handling

- Use `throw new Error('descriptive message')`. Define domain-specific Error subclasses for complex cases (e.g., `ValidationError extends Error`).
- Validate inputs at function boundaries with early `if` guards.
- Never swallow errors silently — always `throw` or propagate.

### 3.4 ES6+ Features

- Use `const` / `let` — never `var`.
- Use arrow functions for short callbacks. `function` declarations for named functions.
- Use template literals for string interpolation.
- Use destructuring and spread for object/array manipulation.
- Use optional chaining (`?.`) and nullish coalescing (`??`).
- Use class private fields (`#field`) for encapsulation.

### 3.5 Testing

- Tests live in `tests/unit/` mirroring `src/` structure.
- Use `node:assert` for assertions. No external test framework.
- Use `describe` / `it` / `beforeEach` from `node:test`.
- Follow AAA pattern: Arrange, Act, Assert.
- Test both success and error cases.
- Coverage is enforced via pre-commit: `npm run coverage`.

---

## 4. Framework Conventions

### 4.1 Haro DataStore

- Factory function `haro(data, config)` and class `Haro(config)` are the two entry points.
- All methods that return data MUST respect `immutable` mode — return frozen copies via `#freezeResult()`.
- Batch operations (`setMany`, `deleteMany`) set `#inBatch = true` to defer indexing until `reindex()`.
- Caching uses `tiny-lru` for LRU cache, keyed by SHA-256 hashes of query args.
- `search()` and `where()` are async and populate the cache. `find()` is synchronous.
- Keys are stored in a `Map`. Indexes are stored as `Map<string, Map<value, Set<key>>>`.

### 4.2 Constants Convention

All string and numeric literals MUST come from `src/constants.js`. Never hardcode strings used for comparisons, error messages, or property names:

```javascript
// ✅ Good
import { STRING_EMPTY, STRING_OBJECT } from './constants.js';
if (typeof data !== STRING_OBJECT) {
    throw new Error(STRING_ERROR_SET_DATA_TYPE);
}

// ❌ Bad
if (typeof data !== 'object') {
    throw new Error('set: data must be an object');
}
```

### 4.3 Indexing Rules

- `#index` config array persists across `clear()` — separate from `#indexes` Map which holds runtime index data.
- Composite indexes use delimiter (default `|`) to join sorted field names.
- Use `#getIndexKeysFrom()` with getter callbacks for data objects vs where clauses.
- Deep indexing with dot notation is supported (e.g., `user.profile.department`).

### 4.4 Batch Operations

- `setMany()` and `deleteMany()` set `#inBatch = true` to skip indexing during individual operations.
- Indexing is deferred to `reindex()` call after batch completes.
- Nested batch calls (calling setMany within setMany) throw errors.
- `#inBatch` affects versioning too — versions are not saved during batch operations.

### 4.5 Immutable Mode

- `#freezeResult()` centralizes `Object.freeze()` calls — never use inline `Object.freeze()` for return values.
- Cached reads use `#fromCache()` to return cloned (non-immutable) or frozen (immutable) results.
- The `#merge()` helper preserves version snapshots by freezing cloned originals before versioning.

---

## 5. Git Conventions

### 5.1 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add file upload endpoint with whitelist validation
fix: correct JWT audience claim validation
docs: update AGENTS.md with new config variables
test: add graph node unit tests for file_processor
chore: pin all dependencies in pyproject.toml
```

### 5.2 Branching

- Main branch is `master`.
- Feature branches: `feat/<short-desc>` or `fix/<short-desc>`.
- Never commit directly to `master`. Always create a feature branch first, then open a PR targeting `master`.

### 5.2.1 Agent Workflow

When auditing or modifying AGENTS.md (or any file):
1. Create a feature branch: `git checkout -b docs/<short-desc>` (or `feat/`, `fix/`).
2. Make changes and commit on the feature branch.
3. Push the feature branch and open a PR with `gh pr create --base master`.
4. Never commit or push directly to `main` or `master`.

### 5.3 Code Review

- All changes require at least one other reviewer (automated checks are mandatory but not sufficient).
- No merging without passing CI (lint → test).
- PR descriptions must reference related items from design documents.

### 5.4 Pull Request Templates

If a `.github/PULL_REQUEST_TEMPLATE.md` file exists, it MUST be used when creating PRs. Fill out every section — do not leave any section blank. If a section does not apply, write `N/A` rather than skipping it.

---

## 6. Operational Rules

Session learnings — critical gotchas that affect how code must be written and tested.

### 6.1 Coverage

The `cover` pre-commit hook enforces **100% code coverage**. Every new function or class needs test coverage. No exceptions.

```bash
npm run coverage          # generates coverage.txt
```

### 6.2 Pre-commit Hook and coverage.txt

The `cover` pre-commit hook runs tests then regenerates `coverage.txt`. If the hook modifies a staged file, `git commit` fails. Always `git add -A` and `git commit --amend -C HEAD` after a failed commit from a modified `coverage.txt`.

### 6.3 Pre-commit Runs Tests

The pre-commit hook runs `npm test` and `npm run coverage` in addition to linting/formatting. A commit can fail due to test failures or insufficient coverage, not just lint errors.

### 6.4 Testing Patterns

Tests use the Node.js native test runner. Key conventions:

```javascript
// tests/unit/haro.test.js
import assert from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { Haro } from "../../src/haro.js";

describe("Haro", () => {
    let store;

    beforeEach(() => {
        store = new Haro();
    });

    it("should set and retrieve a record", () => {
        // Arrange
        const data = { name: "John", age: 30 };

        // Act
        store.set(null, data);

        // Assert
        assert.strictEqual(store.size, 1);
    });
});
```

- Use `beforeEach` per `describe` to reset store state.
- Test both successful paths and error paths with `assert.throws()`.
- Use `assert.strictEqual` for exact type/value comparison.
- Cover edge cases: null inputs, wrong types, empty inputs, boundary values.

### 6.5 String Constants Are Mandatory

Hardcoded strings used for type checks, error messages, or property operations are **forbidden**. They must come from `src/constants.js`. The `#clone()` fallback pattern is common:

```javascript
// ✅ Good — structuredClone exists in Node 17+
#clone(arg) {
    if (typeof structuredClone === STRING_FUNCTION) {
        return structuredClone(arg);
    }
    /* node:coverage ignore */ return JSON.parse(JSON.stringify(arg));
}
```

### 6.6 Prototype Pollution Protection

The `set()` method MUST filter out `__proto__`, `constructor`, and `prototype` keys from user data before assignment:

```javascript
const pollutionProps = new Set([STRING_PROTO, STRING_CONSTRUCTOR, STRING_PROTOTYPE]);
const safeData = Object.fromEntries(
    Object.entries(data).filter(([k]) => !pollutionProps.has(k)),
);
```

### 6.7 Unreachable Code

Code that can never execute is a smell. Remove dead code to avoid coverage gaps and confusion. The `/* node:coverage ignore */` comment is the only allowed way to exclude coverage — use sparingly (e.g., JSON fallback fallbacks for older Node versions).

---

## 7. Session Learnings

Discovery notes about the codebase.

### 7.1 README is the source of truth for project layout

The `README.md` may show a more up-to-date project structure (e.g., additional middleware modules, tool files). When in doubt, use it to verify the layout in section 2.0.

### 7.2 Coverage Patterns for State Transitions

Hard-to-reach branches often involve state transitions (e.g., `clear()` → `set()` on same store). Coverage gaps frequently involve conditional logic on `#inBatch`, `#immutable`, `#cacheEnabled`, or `#versioning`. Add tests that explicitly combine features (immutable + indexing + batch + caching).

### 7.3 `node:coverage ignore` Annotations

Lines annotated with `/* node:coverage ignore */` are deliberate exclusions (e.g., JSON fallback when `structuredClone` is unavailable). These are acceptable and expected. Do not try to cover them with tests.

---

## 8. Checklist Before Marking a TODO Complete

- [ ] All public methods have JSDoc comments with `@param`, `@returns`, `@example`.
- [ ] No hardcoded strings — all literals come from `src/constants.js`.
- [ ] Tests written using `node:assert` + `node:test` (describe/it/beforeEach).
- [ ] Tests follow AAA pattern (Arrange, Act, Assert).
- [ ] `npm test` passes (lint + all tests).
- [ ] `npm run coverage` shows 100% coverage (or verified `/* node:coverage ignore */` annotations).
- [ ] `oxlint` and `oxfmt` pass — no lint errors or formatting issues.
- [ ] No hardcoded secrets or credentials introduced.
- [ ] Prototype pollution protection in place for any user data merging.
- [ ] Threat model considerations addressed in PR description.
