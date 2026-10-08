import { type JsonValue } from './json.js';
import type { AuroraTextureContract } from './texture.js';
import { type AuroraToken } from './token.js';
/**
 * Recipe codecs write `dp` units literally. DTCG codecs write `px` and the
 * caller records dp with a token-level `$extensions["dev.aurora"]` marker,
 * passed back as `pxIsDp` when decoding.
 */
export declare class TextureCodec {
    private readonly textureContract;
    readonly recipe: boolean;
    constructor(textureContract: AuroraTextureContract | undefined, recipe: boolean);
    get contract(): AuroraTextureContract;
    encode(authored: unknown): JsonValue;
    private encodeRef;
    private encodeColor;
    private encodeDimension;
    /**
     * DTCG has no `none` stroke; Aurora writes an invisible zero-length dash
     * pattern, which other tools also draw as no line.
     */
    private encodeStroke;
    /** Whether [authored] holds a literal dp dimension anywhere. */
    static usesDp(authored: unknown): boolean;
    /**
     * Decodes a `$value` for [token] into an authored texture value, keeping
     * aliases. Malformed input throws `AuroraFormatError`; ranges and alias
     * resolution are validated later by `AuroraTexture`.
     */
    decode(token: AuroraToken<unknown>, raw: unknown, at: string, pxIsDp?: boolean): unknown;
    private target;
    private field;
    private dimensionField;
    private colorField;
    private object;
    private number;
    private decodeDimension;
    private decodeFamily;
    private decodeWeight;
    private decodeDuration;
    private decodeBezier;
    private decodeStroke;
    private decodeBorder;
    private decodeShadow;
    private decodeTypography;
}
