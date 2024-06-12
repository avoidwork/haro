import {
    INT_0,
    INT_1,
    INT_16,
    INT_3,
    INT_4,
    INT_8,
    INT_9,
    STRING_A,
    STRING_B,
    STRING_EMPTY,
    STRING_OBJECT,
    STRING_PIPE
} from "./constants.js";

const r = [INT_8, INT_9, STRING_A, STRING_B];

export const clone = structuredClone ?? function shallowClone(arg) {
    return JSON.parse(JSON.stringify(arg, null, INT_0));
};

export function each(arr = [], fn) {
    for (const [idx, value] of arr.entries()) {
        fn(value, idx);
    }

    return arr;
}

export function indexKeys(arg = STRING_EMPTY, delimiter = STRING_PIPE, data = {}) {
    return arg.split(delimiter).reduce((a, li, lidx) => {
        const result = [];

        (Array.isArray(data[li]) ? data[li] : [data[li]]).forEach(lli => lidx === INT_0 ? result.push(lli) : a.forEach(x => result.push(`${x}${delimiter}${lli}`)));

        return result;
    }, []);
}

export function delIndex(index, indexes, delimiter, key, data) {
    index.forEach(i => {
        const idx = indexes.get(i);

        each(i.includes(delimiter) ? indexKeys(i, delimiter, data) : Array.isArray(data[i]) ? data[i] : [data[i]], value => {
            if (idx.has(value)) {
                const o = idx.get(value);

                o.delete(key);

                if (o.size === INT_0) {
                    idx.delete(value);
                }
            }
        });
    });
}

export function merge(a, b) {
    if (a instanceof Object && b instanceof Object) {
        each(Object.keys(b), i => {
            if (a[i] instanceof Object && b[i] instanceof Object) {
                a[i] = merge(a[i], b[i]);
            } else if (Array.isArray(a[i]) && Array.isArray(b[i])) {
                a[i] = a[i].concat(b[i]);
            } else {
                a[i] = b[i];
            }
        });
    } else if (Array.isArray(a) && Array.isArray(b)) {
        a = a.concat(b);
    } else {
        a = b;
    }

    return a;
}

export function s() {
    return ((Math.random() + INT_1) * 0x10000 | INT_0).toString(INT_16).substring(INT_1);
}

export function setIndex(index, indexes, delimiter, key, data, indice) {
    each(indice === null ? index : [indice], i => {
        const lindex = indexes.get(i);

        if (i.includes(delimiter)) {
            each(indexKeys(i, delimiter, data), c => {
                if (lindex.has(c) === false) {
                    lindex.set(c, new Set());
                }

                lindex.get(c).add(key);
            });
        } else {
            each(Array.isArray(data[i]) ? data[i] : [data[i]], d => {
                if (lindex.has(d) === false) {
                    lindex.set(d, new Set());
                }

                lindex.get(d).add(key);
            });
        }
    });
}

export const uuid = typeof crypto === STRING_OBJECT ? crypto.randomUUID.bind(crypto) : () => `${s()}${s()}-${s()}-4${s().slice(INT_0, INT_3)}-${r[Math.floor(Math.random() * INT_4)]}${s().slice(INT_0, INT_3)}-${s()}${s()}${s()}`;
