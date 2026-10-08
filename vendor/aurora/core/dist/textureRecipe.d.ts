import type { JsonValue } from './json.js';
import { AuroraTexture, AuroraTextureContract } from './texture.js';
/** Portable texture recipe v1: a JSON description of one texture. See `spec/texture-recipe-v1.md`. */
export declare const AuroraTextureRecipe: Readonly<{
    /**
     * Decodes a texture. Pass the app's [contract] so several recipes share one
     * contract instance (required by runtimes); the recipe's `contract` must then
     * describe exactly that contract. Without it, the recipe's contract is built fresh.
     */
    decode(input: unknown, contract?: AuroraTextureContract): AuroraTexture;
    /** The recipe JSON for a texture value, such as a value read from a texture. Dimensions keep their unit. */
    encodeValue(value: unknown): JsonValue;
    /** Decodes a recipe `contract` object into a texture contract. */
    decodeContract(definition: unknown): AuroraTextureContract;
}>;
