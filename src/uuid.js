import {INT_0, INT_1, INT_16, INT_3, INT_4, INT_8, INT_9, STRING_A, STRING_B, STRING_OBJECT,} from "./constants.js";

/* istanbul ignore next */
const r = [INT_8, INT_9, STRING_A, STRING_B];

/* istanbul ignore next */
function s () {
	return ((Math.random() + INT_1) * 0x10000 | INT_0).toString(INT_16).substring(INT_1);
}

/* istanbul ignore next */
function customUUID () {
	return `${s()}${s()}-${s()}-4${s().slice(INT_0, INT_3)}-${r[Math.floor(Math.random() * INT_4)]}${s().slice(INT_0, INT_3)}-${s()}${s()}${s()}`;
}

export const uuid = typeof crypto === STRING_OBJECT ? crypto.randomUUID.bind(crypto) : customUUID;
