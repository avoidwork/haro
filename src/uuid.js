import {INT_0, INT_1, INT_16, INT_3, INT_4, INT_8, INT_9, STRING_A, STRING_B, STRING_OBJECT} from "./constants.js";

const r = [INT_8, INT_9, STRING_A, STRING_B];

/**
 * Generates a random 4-character hexadecimal string segment.
 * @returns {string} A 4-character hexadecimal string
 */
function s () {
	return ((Math.random() + INT_1) * 0x10000 | INT_0).toString(INT_16).substring(INT_1);
}

/**
 * Generates a UUID v4 compliant string using random hexadecimal segments.
 * @returns {string} A UUID v4 string in the format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
function randomUUID () {
	return `${s()}${s()}-${s()}-4${s().slice(INT_0, INT_3)}-${r[Math.floor(Math.random() * INT_4)]}${s().slice(INT_0, INT_3)}-${s()}${s()}${s()}`;
}

/**
 * UUID generation function that uses native crypto.randomUUID when available,
 * otherwise falls back to a custom implementation.
 * @type {Function}
 * @returns {string} A UUID v4 string
 */
export const uuid = typeof crypto === STRING_OBJECT ? crypto.randomUUID.bind(crypto) : randomUUID;
