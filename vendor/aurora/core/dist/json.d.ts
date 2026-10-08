/** JSON-compatible values, as produced by `JSON.parse`. */
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject {
    [key: string]: JsonValue;
}
/** A plain JSON object (not null, not an array). */
export declare function isJsonObject(value: unknown): value is Record<string, unknown>;
export declare function hasOwn(value: object, key: string): boolean;
/** A finite JSON number (Dart `num` that `isFinite`). */
export declare function isFiniteNumber(value: unknown): value is number;
