import { AuroraColor } from './color.js';
import { AuroraContract } from './contract.js';
import { type AuroraContrastCheck, type AuroraContrastCheckJson, type AuroraContrastPair } from './contrast.js';
import type { JsonObject } from './json.js';
import { type AuroraAppearance, AuroraTheme, AuroraThemeVariant, type AuroraValues } from './theme.js';
import type { AuroraColorToken } from './token.js';
/** Material palette strategies at contrast level zero, pinned to MCU 0.11.1. */
export type AuroraGenerationScheme = 'tonalSpot' | 'fidelity' | 'vibrant' | 'expressive' | 'content' | 'monochrome' | 'neutral' | 'rainbow' | 'fruitSalad';
export declare const AURORA_GENERATION_SCHEMES: readonly AuroraGenerationScheme[];
export type AuroraPalette = 'primary' | 'secondary' | 'tertiary' | 'neutral' | 'neutralVariant' | 'error' | 'success' | 'warning' | 'info';
export declare const AURORA_PALETTES: readonly AuroraPalette[];
/** Copy an already resolved token, including a deliberate override. */
export declare class AuroraAliasRule {
    readonly target: AuroraColorToken;
    readonly kind: "alias";
    constructor(target: AuroraColorToken);
}
/** Select an HCT tone from a generated palette for each appearance. */
export declare class AuroraToneRule {
    readonly kind: "tone";
    readonly palette: AuroraPalette;
    readonly lightTone: number;
    readonly darkTone: number;
    constructor(init: {
        palette: AuroraPalette;
        lightTone: number;
        darkTone: number;
    });
}
/** Declarative, portable rules for required app tokens. No framework callbacks. */
export type AuroraTokenRule = AuroraAliasRule | AuroraToneRule;
export interface AuroraGenerationRequestInit {
    contract: AuroraContract;
    id: string;
    name: string;
    primary: AuroraColor;
    scheme?: AuroraGenerationScheme;
    secondary?: AuroraColor | undefined;
    tertiary?: AuroraColor | undefined;
    success?: AuroraColor | undefined;
    warning?: AuroraColor | undefined;
    info?: AuroraColor | undefined;
    appearances?: Iterable<AuroraAppearance>;
    preferredAppearance?: AuroraAppearance;
    /** Explicit values for every appearance; they override rules and generation. */
    values?: AuroraValues<AuroraColorToken, AuroraColor>;
    /** Explicit values for one appearance; they override shared values. */
    variantValues?: Partial<Record<AuroraAppearance, AuroraValues<AuroraColorToken, AuroraColor>>>;
    rules?: AuroraValues<AuroraColorToken, AuroraTokenRule>;
    contrastPairs?: Iterable<AuroraContrastPair>;
}
/** Immutable input. Explicit values override rules and generated defaults. */
export declare class AuroraGenerationRequest {
    readonly scheme: AuroraGenerationScheme;
    readonly contract: AuroraContract;
    readonly id: string;
    readonly name: string;
    readonly seeds: ReadonlyMap<AuroraPalette, AuroraColor>;
    readonly appearances: readonly AuroraAppearance[];
    readonly preferredAppearance: AuroraAppearance;
    readonly values: ReadonlyMap<AuroraColorToken, AuroraColor>;
    readonly variantValues: ReadonlyMap<AuroraAppearance, ReadonlyMap<AuroraColorToken, AuroraColor>>;
    readonly rules: ReadonlyMap<AuroraColorToken, AuroraTokenRule>;
    readonly contrastPairs: readonly AuroraContrastPair[];
    constructor(init: AuroraGenerationRequestInit);
}
/** An Aurora generation manifest with DTCG variant documents. */
export interface AuroraGenerationManifest {
    algorithm: string;
    foundationVersion: number;
    contract: {
        id: string;
        version: number;
    };
    id: string;
    name: string;
    preferredAppearance: AuroraAppearance;
    variants: Partial<Record<AuroraAppearance, JsonObject>>;
    contrast: AuroraContrastCheckJson[];
}
export declare class AuroraGenerationResult {
    readonly theme: AuroraTheme;
    readonly scheme: AuroraGenerationScheme;
    readonly checks: readonly AuroraContrastCheck[];
    constructor(theme: AuroraTheme, checks: Iterable<AuroraContrastCheck>, scheme: AuroraGenerationScheme);
    get algorithm(): string;
    get issues(): AuroraContrastCheck[];
    /** Printable diagnostics without logging or other IO. */
    debugReport(): string;
    /** An Aurora manifest with DTCG variant documents; not itself a DTCG document. */
    toJson(): AuroraGenerationManifest;
}
/** Deterministic generation, independent of widgets, storage, network, or device. */
export declare const AuroraGenerator: Readonly<{
    algorithm: "aurora-tonal-v1-mcu-0.11.1";
    algorithmFor(scheme: AuroraGenerationScheme): string;
    /**
     * Foundation-only snapshots for per-entity branding. Never registers a theme
     * or supplies values for an app contract's extensions.
     */
    variants(seed: AuroraColor, scheme?: AuroraGenerationScheme): ReadonlyMap<AuroraAppearance, AuroraThemeVariant>;
    generate(request: AuroraGenerationRequest): AuroraGenerationResult;
}>;
