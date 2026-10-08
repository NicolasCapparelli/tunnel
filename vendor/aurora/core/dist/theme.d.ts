import { type AuroraColor } from './color.js';
import type { AuroraContract } from './contract.js';
import { AuroraTokens } from './foundation.js';
import type { AuroraColorToken } from './token.js';
/** A concrete appearance. */
export type AuroraAppearance = 'light' | 'dark';
/** A selection preference: a concrete appearance, or follow the system. */
export type AuroraAppearancePreference = 'light' | 'dark' | 'system';
export declare const AURORA_APPEARANCES: readonly AuroraAppearance[];
/** Exact portable names; unknown values return undefined for caller-owned fallback. */
export declare function parseAppearancePreference(name: unknown): AuroraAppearancePreference | undefined;
/** Token-keyed values: a `Map`, or any iterable of `[token, value]` pairs. */
export type AuroraValues<K, V> = ReadonlyMap<K, V> | Iterable<readonly [K, V]>;
export interface AuroraThemeVariantInit {
    contract: AuroraContract;
    appearance: AuroraAppearance;
    values: AuroraValues<AuroraColorToken, unknown>;
}
/** Complete, validated values for a single concrete appearance. */
export declare class AuroraThemeVariant {
    readonly contract: AuroraContract;
    readonly appearance: AuroraAppearance;
    readonly values: ReadonlyMap<AuroraColorToken, AuroraColor>;
    private _tokens;
    constructor(init: AuroraThemeVariantInit);
    read(token: AuroraColorToken): AuroraColor;
    /** Direct immutable token values, usable without any framework integration. */
    get tokens(): AuroraTokens;
    /** Convenience alias for color-focused consumers. */
    get colors(): AuroraTokens;
}
export interface AuroraThemeInit {
    id: string;
    name: string;
    variants: Iterable<AuroraThemeVariant>;
    preferredAppearance: AuroraAppearance;
}
/** Identity plus available complete variants, all using the same app contract. */
export declare class AuroraTheme {
    readonly id: string;
    readonly name: string;
    readonly contract: AuroraContract;
    readonly variants: ReadonlyMap<AuroraAppearance, AuroraThemeVariant>;
    readonly preferredAppearance: AuroraAppearance;
    constructor(init: AuroraThemeInit);
    /** The variant for [appearance], if the theme has one. */
    variant(appearance: AuroraAppearance): AuroraThemeVariant | undefined;
}
export interface AuroraStarterVariantInit {
    contract: AuroraContract;
    appearance: AuroraAppearance;
    /** App extensions and deliberate foundation overrides. */
    values?: AuroraValues<AuroraColorToken, AuroraColor>;
}
/** Complete explicit foundation presets; app extensions are still required. */
export declare const AuroraStarter: Readonly<{
    light: ReadonlyMap<AuroraColorToken, AuroraColor>;
    dark: ReadonlyMap<AuroraColorToken, AuroraColor>;
    variant(init: AuroraStarterVariantInit): AuroraThemeVariant;
}>;
