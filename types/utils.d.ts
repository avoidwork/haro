export function shallowClone(arg: any): any;
export function each(arr: any[], fn: any): any[];
export function indexKeys(arg?: string, delimiter?: string, data?: {}): any[];
export function delIndex(index: any, indexes: any, delimiter: any, key: any, data: any): void;
export function merge(a: any, b: any): any;
export function s(): string;
export function setIndex(index: any, indexes: any, delimiter: any, key: any, data: any, indice: any): void;
export const clone: typeof structuredClone | typeof shallowClone;
export const uuid: any;
