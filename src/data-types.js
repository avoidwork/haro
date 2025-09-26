/**
 * Data type definitions and type detection utilities
 */

/**
 * Type definitions for validation
 */
export const DataTypes = {
	STRING: "string",
	NUMBER: "number",
	BOOLEAN: "boolean",
	OBJECT: "object",
	ARRAY: "array",
	DATE: "date",
	UUID: "uuid",
	EMAIL: "email",
	URL: "url",
	ANY: "any"
};

/**
 * Type detection utilities
 */
export class TypeDetector {
	/**
	 * Get the type of a value
	 * @param {*} value - Value to check
	 * @returns {string} Type string
	 */
	static getValueType (value) {
		if (value === null) return "null";
		if (Array.isArray(value)) return DataTypes.ARRAY;
		if (value instanceof Date) return DataTypes.DATE;

		const basicType = typeof value;

		// Special type detection
		if (basicType === "string") {
			if (TypeDetector.isUUID(value)) return DataTypes.UUID;
			if (TypeDetector.isEmail(value)) return DataTypes.EMAIL;
			if (TypeDetector.isURL(value)) return DataTypes.URL;
		}

		return basicType;
	}

	/**
	 * Check if actual type matches expected type
	 * @param {string} actualType - Actual type
	 * @param {string} expectedType - Expected type
	 * @returns {boolean} True if types match
	 */
	static isTypeMatch (actualType, expectedType) {
		if (actualType === expectedType) return true;

		// Special cases
		if (expectedType === DataTypes.STRING) {
			return ["string", DataTypes.UUID, DataTypes.EMAIL, DataTypes.URL].includes(actualType);
		}

		return false;
	}

	/**
	 * Check if string is a UUID
	 * @param {string} value - String to check
	 * @returns {boolean} True if UUID format
	 */
	static isUUID (value) {
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

		return uuidRegex.test(value);
	}

	/**
	 * Check if string is an email
	 * @param {string} value - String to check
	 * @returns {boolean} True if email format
	 */
	static isEmail (value) {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

		return emailRegex.test(value);
	}

	/**
	 * Check if string is a URL
	 * @param {string} value - String to check
	 * @returns {boolean} True if URL format
	 */
	static isURL (value) {
		try {
			const url = new URL(value);

			return Boolean(url);
		} catch {
			return false;
		}
	}
}
