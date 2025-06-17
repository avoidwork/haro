import {INT_0, INT_1, INT_16, INT_3, INT_4, INT_8, INT_9, STRING_A, STRING_B, STRING_OBJECT} from "./constants.js";

/**
 * Array of constants used to generate random parts of a UUID.
 */
/* istanbul ignore next */
const r = [INT_8, INT_9, STRING_A, STRING_B];

/**
 * Generates a random string segment for the UUID.
 *
 * @returns {string} A randomly generated hexadecimal string segment.
 */
/* istanbul ignore next */
function s () {
	return ((Math.random() + INT_1) * 0x10000 | INT_0).toString(INT_16).substring(INT_1);
}

/**
 * Generates a random UUID (Universally Unique Identifier).
 *
 * This function uses the RFC4122 version 4 algorithm to generate a UUID.
 * If the environment supports it, it will use the `crypto.randomUUID` method.
 * Otherwise, it falls back to a custom implementation that uses random
 * number generation and predefined constants for certain parts of the UUID.
 *
 * @returns {string} A randomly generated UUID string in the format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx.
 */
/* istanbul ignore next */
function randomUUID () {
	return `${s()}${s()}-${s()}-4${s().slice(INT_0, INT_3)}-${r[Math.floor(Math.random() * INT_4)]}${s().slice(INT_0, INT_3)}-${s()}${s()}${s()}`;
}

/**
 * A function to generate a UUID.
 *
 * This constant determines whether to use the native `crypto.randomUUID` method
 * (if available) or fall back to the custom `randomUUID` implementation.
 */
export const uuid = typeof crypto === STRING_OBJECT ? crypto.randomUUID.bind(crypto) : randomUUID;
