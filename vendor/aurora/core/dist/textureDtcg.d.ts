import { type JsonObject } from './json.js';
import { AuroraTexture, type AuroraTextureContract } from './texture.js';
export interface AuroraTextureDtcgDecodeOptions {
    contract: AuroraTextureContract;
    id: string;
    name: string;
}
/**
 * DTCG 2025.10 profile for textures: one document holds one complete texture.
 *
 * Every DTCG token type Aurora supports is written with its standard `$type`.
 * Booleans and enums, which DTCG lacks, have no `$type` and are marked with
 * `$extensions["dev.aurora"]` (`{"type": "boolean"}` or
 * `{"type": "enum", "values": [...]}`). Dimensions in dp are written as `px`
 * with `{"unit": "dp"}` in the same extension. Aliases are kept as `{path}`
 * references. References to theme colour tokens (for example
 * `{colors.outline}`) resolve against the active theme, not this document.
 * Texture identity lives outside the document.
 */
export declare const AuroraTextureDtcg: Readonly<{
    extensionKey: "dev.aurora";
    encode(texture: AuroraTexture): JsonObject;
    decode(document: unknown, options: AuroraTextureDtcgDecodeOptions): AuroraTexture;
}>;
