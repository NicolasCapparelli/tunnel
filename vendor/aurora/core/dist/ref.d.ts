import type { AuroraToken } from './token.js';
/**
 * A literal primitive value, such as a line height of `1.4`. Aurora's value
 * classes (such as `AuroraDimension`) are their own literals and need no wrapper.
 */
export declare class AuroraLiteral<T> {
    readonly value: T;
    readonly kind: "literal";
    constructor(value: T);
    toString(): string;
}
/**
 * A reference to another token. Aliases between texture tokens resolve when a
 * texture is constructed. An alias to a colour token inside a texture refers to
 * the active theme and resolves against the active theme variant.
 */
export declare class AuroraAlias<T> {
    readonly target: AuroraToken<T>;
    readonly kind: "alias";
    constructor(target: AuroraToken<T>);
    toString(): string;
}
/** Aurora value classes, which are their own literal references. */
type SelfLiteral<T> = T extends {
    readonly kind: string;
} ? T : never;
/** A value or a reference to another token of the same value type. */
export type AuroraRef<T> = SelfLiteral<T> | AuroraLiteral<T> | AuroraAlias<T>;
export declare function isAlias(value: unknown): value is AuroraAlias<unknown>;
export declare function isLiteral(value: unknown): value is AuroraLiteral<unknown>;
/**
 * The literal value of [ref]. Values read from a texture are always resolved;
 * authored values may still hold aliases, which throw here.
 */
export declare function resolvedRef<T>(ref: AuroraRef<T>, field: string): T;
/** Structural equality for references: same literal value or same alias target. */
export declare function refEquals(a: unknown, b: unknown): boolean;
/** Equality for Aurora values: value classes compare by content. */
export declare function valueEquals(a: unknown, b: unknown): boolean;
export {};
