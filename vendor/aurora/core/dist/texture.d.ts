import { type AuroraColor } from './color.js';
import { type AuroraContract } from './contract.js';
import { type AuroraRef } from './ref.js';
import type { AuroraThemeVariant, AuroraValues } from './theme.js';
import type { AuroraToken } from './token.js';
export interface AuroraTextureContractInit {
    id: string;
    version?: number;
    extensions?: Iterable<AuroraToken<unknown>>;
}
/**
 * Texture foundation plus app-owned additions. Every declared token is required.
 *
 * Textures hold non-colour values (type, shape, motion, lines, density, chrome
 * and component defaults). Colours belong to theme contracts, so a texture
 * contract never declares colour tokens; borders and shadows refer to theme
 * colour tokens with `AuroraAlias` instead.
 */
export declare class AuroraTextureContract {
    readonly id: string;
    readonly version: number;
    readonly tokens: ReadonlyMap<string, AuroraToken<unknown>>;
    constructor(init: AuroraTextureContractInit);
    /** True when [token] is this contract's declaration (by identity). */
    contains(token: AuroraToken<unknown>): boolean;
}
export interface AuroraTextureInit {
    contract: AuroraTextureContract;
    id: string;
    name: string;
    /**
     * Values are the token's value type, an `AuroraLiteral` of it, or an
     * `AuroraAlias` to another token of the same type in this contract.
     */
    values: AuroraValues<AuroraToken<unknown>, unknown>;
}
/**
 * A named, complete, validated set of texture values. A texture has one value
 * set shared by every appearance; its colours alias theme colour tokens and
 * therefore follow the active theme variant.
 */
export declare class AuroraTexture {
    readonly contract: AuroraTextureContract;
    readonly id: string;
    readonly name: string;
    /** Paths of every theme colour token this texture's values refer to. */
    readonly colorReferences: ReadonlySet<string>;
    private readonly authoredValues;
    private readonly resolvedValues;
    /**
     * Validates every value against its token type, resolves aliases, and
     * reports all problems in one `AuroraValidationError`.
     */
    constructor(init: AuroraTextureInit);
    /**
     * The resolved value of [token]. Composite colours may still be aliases to
     * theme colour tokens; resolve those with `resolveTextureColor`.
     */
    read<T>(token: AuroraToken<T>): T;
    /** The value as authored, keeping aliases, for export. */
    authored(token: AuroraToken<unknown>): unknown;
    /**
     * Fails unless every colour this texture refers to is a colour token of
     * [themeContract]. Runtimes and adapters call this when pairing textures
     * with themes.
     */
    validateColors(themeContract: AuroraContract): void;
}
/** Resolve a texture colour (a literal or a theme colour alias) against a theme variant. */
export declare function resolveTextureColor(variant: AuroraThemeVariant, color: AuroraRef<AuroraColor>): AuroraColor;
export interface AuroraTextureStarterInit {
    contract: AuroraTextureContract;
    id: string;
    name: string;
    /** Overrides of foundation tokens, plus every app extension. */
    values?: AuroraValues<AuroraToken<unknown>, unknown>;
}
/** Explicit starter texture values. App extensions are still required. */
export declare const AuroraTextureStarter: Readonly<{
    /** Material 3 baseline values for every texture foundation token. */
    material: ReadonlyMap<AuroraToken<unknown>, unknown>;
    /** A complete texture: the Material starter values plus [values]. */
    texture(init: AuroraTextureStarterInit): AuroraTexture;
}>;
