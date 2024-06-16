export function haro(data?: any, config?: {}): Haro;
export class Haro {
    constructor({ delimiter, id, index, key, versioning }?: {
        delimiter?: string;
        id?: any;
        index?: any[];
        key?: string;
        versioning?: boolean;
    });
    data: any;
    delimiter: string;
    id: any;
    index: any[];
    indexes: any;
    key: string;
    versions: any;
    versioning: boolean;
    batch(args: any, type?: string): any;
    beforeBatch(arg: any): any;
    beforeClear(): void;
    beforeDelete(): void;
    beforeSet(): void;
    clear(): this;
    clone(arg: any): any;
    del(key?: string, batch?: boolean): void;
    delIndex(index: any, indexes: any, delimiter: any, key: any, data: any): void;
    dump(type?: string): any;
    each(arr: any[], fn: any): any[];
    entries(): any;
    find(where?: {}, raw?: boolean): any;
    filter(fn: any, raw?: boolean): any;
    forEach(fn: any, ctx: any): this;
    get(key: any, raw?: boolean): any;
    has(key: any): any;
    indexKeys(arg?: string, delimiter?: string, data?: {}): any[];
    keys(): any;
    limit(offset?: number, max?: number, raw?: boolean): any;
    list(...args: any[]): readonly any[];
    map(fn: any, raw?: boolean): readonly any[];
    merge(a?: {}, b?: {}, override?: boolean): {};
    onbatch(arg: any): any;
    onclear(): void;
    ondelete(): void;
    onoverride(): void;
    onset(): void;
    override(data: any, type?: string): boolean;
    reduce(fn: any, accumulator: any, raw?: boolean): any;
    reindex(index: any): this;
    search(value: any, index: any, raw?: boolean): any;
    set(key?: any, data?: {}, batch?: boolean, override?: boolean): any;
    setIndex(index: any, indexes: any, delimiter: any, key: any, data: any, indice: any): void;
    sort(fn: any, frozen?: boolean): any;
    sortBy(index?: string, raw?: boolean): readonly any[];
    toArray(frozen?: boolean): any;
    uuid(): any;
    values(): any;
    where(predicate?: {}, raw?: boolean, op?: string): any;
}
