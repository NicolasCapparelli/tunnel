/** A plain JSON object (not null, not an array). */
export function isJsonObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
}
/** A finite JSON number (Dart `num` that `isFinite`). */
export function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
