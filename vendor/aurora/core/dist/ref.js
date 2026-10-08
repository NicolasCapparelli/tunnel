import { AuroraStateError } from './errors.js';
/**
 * A literal primitive value, such as a line height of `1.4`. Aurora's value
 * classes (such as `AuroraDimension`) are their own literals and need no wrapper.
 */
export class AuroraLiteral {
    value;
    kind = 'literal';
    constructor(value) {
        this.value = value;
        Object.freeze(this);
    }
    toString() {
        return String(this.value);
    }
}
/**
 * A reference to another token. Aliases between texture tokens resolve when a
 * texture is constructed. An alias to a colour token inside a texture refers to
 * the active theme and resolves against the active theme variant.
 */
export class AuroraAlias {
    target;
    kind = 'alias';
    constructor(target) {
        this.target = target;
        Object.freeze(this);
    }
    toString() {
        return `{${this.target.path}}`;
    }
}
export function isAlias(value) {
    return typeof value === 'object' && value !== null && value.kind === 'alias';
}
export function isLiteral(value) {
    return typeof value === 'object' && value !== null && value.kind === 'literal';
}
/**
 * The literal value of [ref]. Values read from a texture are always resolved;
 * authored values may still hold aliases, which throw here.
 */
export function resolvedRef(ref, field) {
    if (isAlias(ref)) {
        throw new AuroraStateError(`${field} is an unresolved alias to ${ref.target.path}; read resolved values from a texture`);
    }
    if (isLiteral(ref))
        return ref.value;
    return ref;
}
/** Structural equality for references: same literal value or same alias target. */
export function refEquals(a, b) {
    if (a === b)
        return true;
    if (isAlias(a) && isAlias(b))
        return a.target.path === b.target.path && a.target.type === b.target.type;
    if (isLiteral(a) && isLiteral(b))
        return valueEquals(a.value, b.value);
    return valueEquals(a, b);
}
/** Equality for Aurora values: value classes compare by content. */
export function valueEquals(a, b) {
    if (a === b)
        return true;
    if (typeof a === 'object' && a !== null && typeof a.equals === 'function') {
        return a.equals(b);
    }
    return false;
}
