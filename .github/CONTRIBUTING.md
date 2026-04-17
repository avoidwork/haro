# Contributing to Haro

Thank you for your interest in contributing to Haro! This document provides guidelines and instructions for contributing.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Code Style](#code-style)
4. [Testing](#testing)
5. [Submitting Changes](#submitting-changes)
6. [Reporting Issues](#reporting-issues)

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/haro.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Requirements

- Node.js >= 17.0.0
- npm

### Project Structure

- `src/` - Source code
- `tests/unit/` - Unit tests
- `dist/` - Built distribution (generated)
- `types/` - TypeScript definitions

## Code Style

This project uses **Oxlint** and **Oxfmt** for code quality and formatting:

```bash
# Check code style
npm run lint

# Fix auto-fixable issues
npm run fix
```

### Key Guidelines

- Use **tabs** for indentation
- Use **double quotes** for strings
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes
- Use **UPPER_SNAKE_CASE** for constants
- Write **JSDoc comments** for all public APIs
- Keep functions small and focused

### String Constants

Use string constants from `src/constants.js` for string literals:

```javascript
// ✅ Good
import { STRING_EMPTY } from './constants.js';
if (str === STRING_EMPTY) { ... }

// ❌ Bad
if (str === '') { ... }
```

## Testing

This project uses **Node.js native test runner**:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run coverage
```

### Writing Tests

- Place unit tests in `tests/unit/`
- Use `node:assert` for assertions
- Follow AAA pattern (Arrange, Act, Assert)
- Test both success and error cases

Example:

```javascript
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Haro } from '../src/haro.js';

describe('MyFeature', () => {
    it('should do something', () => {
        // Arrange
        const store = new Haro();
        
        // Act
        const result = store.set(null, { name: 'test' });
        
        // Assert
        assert.ok(result);
        assert.strictEqual(result.name, 'test');
    });
});
```

## Submitting Changes

1. Make your changes
2. Run tests: `npm test`
3. Run lint: `npm run lint`
4. Commit with clear messages
5. Push to your fork
6. Open a Pull Request

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Be concise and descriptive
- Reference issues when applicable

### Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Code is formatted (`npm run fix`)
- [ ] Documentation is updated if needed
- [ ] Commit messages are clear

## Reporting Issues

When reporting issues, please include:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: Detailed steps to reproduce
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Node.js version, OS, etc.
- **Code Example**: Minimal reproducible example

Example:

```markdown
## Description
The `find()` method throws an error when passed null.

## Steps to Reproduce
1. Create a new Haro instance
2. Call `store.find(null)`

## Expected Behavior
Should throw a descriptive error or handle null gracefully

## Actual Behavior
Throws: "Cannot read property 'length' of null"

## Environment
- Node.js: v18.0.0
- OS: macOS 13.0

## Code Example
```javascript
import { Haro } from 'haro';
const store = new Haro();
store.find(null); // Throws error
```
```

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Welcome newcomers and help them learn
- Keep discussions professional and on-topic

## Questions?

Feel free to open an issue for questions or discussions about contributing.

---

Thank you for contributing to Haro! 🎉
