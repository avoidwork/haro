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
