# Code Style Guide

This document outlines the coding standards and conventions for the Haro project. Following these guidelines ensures consistent, maintainable, and readable code across the entire codebase.

## Table of Contents

1. [General Principles](#general-principles)
2. [JavaScript Language Guidelines](#javascript-language-guidelines)
3. [Naming Conventions](#naming-conventions)
4. [Code Structure](#code-structure)
5. [Documentation Standards](#documentation-standards)
6. [Testing Standards](#testing-standards)
7. [Error Handling](#error-handling)
8. [Performance Considerations](#performance-considerations)
9. [Security Guidelines](#security-guidelines)
10. [ESLint Configuration](#eslint-configuration)

## General Principles

### Code Quality
- Write code that is **readable**, **maintainable**, and **testable**
- Follow the **principle of least surprise** - code should behave as expected
- Use **meaningful names** for variables, functions, and classes
- Keep functions **small and focused** on a single responsibility
- Write **self-documenting code** with clear intent

### Consistency
- Follow established patterns within the codebase
- Use consistent indentation and formatting
- Maintain uniform error handling patterns
- Apply naming conventions consistently

## JavaScript Language Guidelines

### ES6+ Features
Use modern JavaScript features appropriately:

```javascript
// ✅ Good - Use const/let instead of var
const API_ENDPOINT = 'https://api.example.com';
let userData = null;

// ✅ Good - Use arrow functions for concise syntax
const processData = data => data.map(item => item.value);

// ✅ Good - Use template literals
const message = `Processing ${count} items`;

// ✅ Good - Use destructuring
const {name, age} = user;
const [first, second] = array;

// ✅ Good - Use spread operator
const newArray = [...existingArray, newItem];
```

### Variable Declarations
```javascript
// ✅ Good - Use const for immutable values
const MAX_RETRIES = 3;
const config = {timeout: 5000};

// ✅ Good - Use let for mutable values
let currentIndex = 0;
let isProcessing = false;

// ❌ Bad - Avoid var
var oldStyleVariable = 'avoid this';
```

### Function Declarations
```javascript
// ✅ Good - Use function declarations for named functions
function processRecord(record) {
    return record.transform();
}

// ✅ Good - Use arrow functions for callbacks and short functions
const numbers = [1, 2, 3].map(n => n * 2);

// ✅ Good - Use consistent spacing
function calculateTotal (items) {
    return items.reduce((sum, item) => sum + item.price, 0);
}
```

## Naming Conventions

### Variables and Functions
- Use **camelCase** for all variable and function names
- Use **descriptive names** that clearly indicate purpose

```javascript
// ✅ Good
const userAccountBalance = 1000;
const getCurrentUser = () => {...};
const processPaymentRequest = (request) => {...};

// ❌ Bad
const uab = 1000;
const getUsr = () => {...};
const proc = (req) => {...};
```

### Constants
- Use **UPPER_SNAKE_CASE** for constants
- Group related constants together

```javascript
// ✅ Good
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;
const ERROR_MESSAGES = {
    INVALID_INPUT: 'Invalid input provided',
    NETWORK_ERROR: 'Network connection failed'
};
```

### Classes
- Use **PascalCase** for class names
- Use **camelCase** for methods and properties

```javascript
// ✅ Good
class DataProcessor {
    constructor(options) {
        this.processingOptions = options;
    }

    processData(data) {
        return this.transformData(data);
    }
}
```

### Files and Modules
- Use **kebab-case** for file names
- Use **camelCase** for module exports

```javascript
// File: data-processor.js
export class DataProcessor {...}
export const processData = () => {...};
```

## Code Structure

### Indentation and Formatting
- Use **tabs** for indentation (not spaces)
- Use **consistent brace style** (1TBS with single-line allowance)
- Keep lines reasonably short (aim for readability)

```javascript
// ✅ Good - Consistent indentation and brace style
function processItems(items) {
    if (items.length === 0) {
        return [];
    }

    return items.map(item => {
        if (item.isValid) {
            return item.process();
        }

        return item.getDefault();
    });
}
```

### Import/Export Organization
```javascript
// ✅ Good - Group imports logically
import {randomUUID} from 'crypto';
import {promises as fs} from 'fs';

import {
    STRING_EMPTY,
    STRING_INVALID_TYPE,
    MAX_RETRIES
} from './constants.js';

// Export at the end of file
export {DataProcessor};
export {processData};
```

### Object and Array Formatting
```javascript
// ✅ Good - Multi-line formatting for complex objects
const config = {
    server: {
        host: 'localhost',
        port: 3000
    },
    database: {
        url: 'mongodb://localhost:27017',
        options: {
            useUnifiedTopology: true
        }
    }
};

// ✅ Good - Single line for simple objects
const point = {x: 10, y: 20};
```

## Documentation Standards

### JSDoc Comments
Use **JSDoc standard** for all functions and classes:

```javascript
/**
 * Processes user data and returns formatted results
 * @param {Object} userData - Raw user data to process
 * @param {string} userData.name - User's full name
 * @param {number} userData.age - User's age
 * @param {Object} [options={}] - Processing options
 * @param {boolean} [options.validate=true] - Whether to validate input
 * @returns {Object} Processed user data
 * @throws {Error} Throws error if validation fails
 * @example
 * const result = processUserData({name: 'John', age: 30});
 * // Returns: {name: 'John', age: 30, processed: true}
 */
function processUserData(userData, options = {}) {
    // Implementation
}
```

### Class Documentation
```javascript
/**
 * Manages data storage and retrieval with indexing capabilities
 * @class
 * @example
 * const store = new DataStore({
 *   index: ['name', 'email'],
 *   immutable: true
 * });
 */
class DataStore {
    /**
     * Creates a new DataStore instance
     * @param {Object} config - Configuration options
     * @param {string[]} [config.index=[]] - Fields to index
     * @param {boolean} [config.immutable=false] - Enable immutable mode
     */
    constructor(config = {}) {
        // Implementation
    }
}
```

### Code Comments
```javascript
// ✅ Good - Explain WHY, not WHAT
function calculateDiscount(price, customerType) {
    // Premium customers get 15% discount to encourage loyalty
    const discountRate = customerType === 'premium' ? 0.15 : 0.05;
    
    return price * (1 - discountRate);
}

// ✅ Good - Document complex algorithms
function complexCalculation(data) {
    // Using Boyer-Moore algorithm for efficient string searching
    // This approach reduces time complexity from O(n*m) to O(n+m)
    return algorithmImplementation(data);
}
```

## Testing Standards

### Unit Tests
- Place unit tests in `tests/unit/` directory
- Use **node-assert** for assertions
- Run tests with **Mocha**
- Follow **AAA pattern** (Arrange, Act, Assert)

```javascript
// tests/unit/data-processor.test.js
import assert from 'node:assert';
import {DataProcessor} from '../../src/data-processor.js';

describe('DataProcessor', () => {
    describe('processData', () => {
        it('should transform valid data correctly', () => {
            // Arrange
            const processor = new DataProcessor();
            const inputData = [{id: 1, name: 'test'}];
            
            // Act
            const result = processor.processData(inputData);
            
            // Assert
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].processed, true);
        });

        it('should throw error for invalid input', () => {
            // Arrange
            const processor = new DataProcessor();
            
            // Act & Assert
            assert.throws(() => {
                processor.processData(null);
            }, {message: 'Invalid input provided'});
        });
    });
});
```

### Integration Tests
- Place integration tests in `tests/integration/` directory
- Test complete workflows and system interactions
- Use realistic data and scenarios

```javascript
// tests/integration/store-operations.test.js
import assert from 'node:assert';
import {Haro} from '../../src/haro.js';

describe('Store Operations Integration', () => {
    it('should handle complete CRUD workflow', () => {
        // Arrange
        const store = new Haro({
            index: ['name', 'email'],
            versioning: true
        });
        
        // Act - Create
        const user = store.set(null, {name: 'John', email: 'john@example.com'});
        
        // Assert - Create
        assert.ok(user);
        assert.strictEqual(user.name, 'John');
        
        // Act - Read
        const found = store.find({name: 'John'});
        
        // Assert - Read
        assert.strictEqual(found.length, 1);
        assert.strictEqual(found[0].email, 'john@example.com');
    });
});
```

## Error Handling

### Error Types
```javascript
// ✅ Good - Use descriptive error messages
if (!data) {
    throw new Error('Data parameter is required');
}

if (typeof data !== 'object') {
    throw new Error('Data must be an object');
}

// ✅ Good - Use specific error types when appropriate
class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}
```

### Error Handling Patterns
```javascript
// ✅ Good - Handle errors gracefully
function processData(data) {
    try {
        validateData(data);
        return transformData(data);
    } catch (error) {
        if (error instanceof ValidationError) {
            // Handle validation errors specifically
            return {error: error.message, field: error.field};
        }
        // Re-throw unexpected errors
        throw error;
    }
}

// ✅ Good - Use consistent error responses
function apiHandler(request) {
    try {
        return {success: true, data: processRequest(request)};
    } catch (error) {
        return {success: false, error: error.message};
    }
}
```

## Performance Considerations

### Efficient Data Structures
```javascript
// ✅ Good - Use Map for frequent lookups
const userCache = new Map();

// ✅ Good - Use Set for unique collections
const processedIds = new Set();

// ✅ Good - Use appropriate array methods
const activeUsers = users.filter(user => user.isActive);
const userNames = users.map(user => user.name);
```

### Memory Management
```javascript
// ✅ Good - Clean up references
function processLargeDataSet(data) {
    const processor = new DataProcessor();
    const result = processor.process(data);
    
    // Clean up large objects
    processor.cleanup();
    
    return result;
}

// ✅ Good - Use streaming for large data
function processLargeFile(filePath) {
    const stream = fs.createReadStream(filePath);
    return stream.pipe(new DataProcessor());
}
```

## Security Guidelines

### Input Validation
```javascript
// ✅ Good - Validate all inputs
function setUserData(userData) {
    if (!userData || typeof userData !== 'object') {
        throw new Error('Invalid user data');
    }
    
    if (!userData.email || !isValidEmail(userData.email)) {
        throw new Error('Valid email is required');
    }
    
    // Sanitize input
    const sanitizedData = sanitizeUserInput(userData);
    return sanitizedData;
}
```

### Safe Object Access
```javascript
// ✅ Good - Use optional chaining
const userName = user?.profile?.name || 'Anonymous';

// ✅ Good - Validate object structure
function processUserProfile(profile) {
    if (!profile || typeof profile !== 'object') {
        throw new Error('Invalid profile object');
    }
    
    const {name, email} = profile;
    if (!name || !email) {
        throw new Error('Profile must contain name and email');
    }
    
    return {name, email};
}
```

## ESLint Configuration

The project uses ESLint for code quality enforcement. Key rules include:

- **Indentation**: Tabs with consistent variable declaration alignment
- **Quotes**: Double quotes with escape avoidance
- **Semicolons**: Required
- **Brace Style**: 1TBS with single-line allowance
- **Comma Style**: Trailing commas not allowed
- **Space Requirements**: Consistent spacing around operators and keywords
- **No Unused Variables**: All variables must be used
- **Consistent Returns**: Functions should have consistent return patterns

### Running ESLint
```bash
# Check all files
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

## Best Practices Summary

1. **Use meaningful names** for variables, functions, and classes
2. **Write comprehensive JSDoc comments** for all public APIs
3. **Keep functions small** and focused on single responsibility
4. **Handle errors gracefully** with appropriate error types
5. **Write thorough tests** for all functionality
6. **Use modern JavaScript features** appropriately
7. **Follow consistent formatting** with tab indentation
8. **Validate all inputs** and sanitize user data
9. **Use appropriate data structures** for performance
10. **Clean up resources** to prevent memory leaks

## Tools and Automation

- **ESLint**: Code quality and style enforcement
- **Mocha**: Test runner for unit and integration tests
- **Node Assert**: Assertion library for testing
- **Rollup**: Module bundler for distribution
- **Husky**: Git hooks for pre-commit checks

---

*This style guide is a living document. As the project evolves, these guidelines should be updated to reflect new patterns and best practices.* 