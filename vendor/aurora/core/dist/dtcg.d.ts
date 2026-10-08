import { AuroraColor } from './color.js';
import type { AuroraContract } from './contract.js';
import { type JsonObject } from './json.js';
import { type AuroraAppearance, AuroraThemeVariant } from './theme.js';
export declare const REFERENCE: RegExp;
export interface AuroraDtcgDecodeOptions {
    contract: AuroraContract;
    appearance: AuroraAppearance;
}
/** A structured sRGB `$value`. */
export interface AuroraDtcgColorValue {
    colorSpace: 'srgb';
    components: [number, number, number];
    alpha: number;
}
/**
 * DTCG 2025.10 color profile: groups, sRGB colors, and whole-token aliases. One
 * document represents one variant; identity and appearance live outside it.
 * Unsupported constructs fail explicitly; this is not a full DTCG resolver.
 */
export declare const AuroraDtcg: Readonly<{
    encode(variant: AuroraThemeVariant): JsonObject;
    decode(document: unknown, options: AuroraDtcgDecodeOptions): AuroraThemeVariant;
    /** The structured sRGB `$value` for [color]. */
    encodeColorValue(color: AuroraColor): AuroraDtcgColorValue;
    /** Decodes a structured sRGB `$value`; [path] names it in errors. */
    decodeColorValue(raw: unknown, path: string): AuroraColor;
}>;
