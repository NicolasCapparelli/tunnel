import { AuroraContract } from './contract.js';
import { type JsonObject } from './json.js';
import { type AuroraTexture, AuroraTextureContract } from './texture.js';
import { type AuroraAppearance, AuroraTheme } from './theme.js';
/** One problem found in a bundle. See `spec/bundle-v1.md`. */
export interface AuroraBundleIssue {
    category: 'format' | 'validation';
    /** `manifest`, `bundle`, or the token file name. */
    file: string;
    message: string;
}
export interface AuroraBundleProvenance {
    /** The producer and its version, such as `tokenseed@0.2.0`. */
    generator: string;
    /** Identifies the source design, such as `sha256:<hex>`. */
    sourceHash: string;
    /** RFC 3339 date-time. */
    createdAt: string;
}
export interface AuroraBundleManifest {
    bundleVersion: 1;
    theme: {
        id: string;
        name: string;
        preferredAppearance: AuroraAppearance;
        variants: AuroraAppearance[];
    };
    texture?: {
        id: string;
        name: string;
    };
    pairing?: {
        themeId: string;
        textureId: string;
    };
    provenance: AuroraBundleProvenance;
}
/** The single-file form: a manifest plus token documents by file name. */
export interface AuroraBundleJson {
    manifest: AuroraBundleManifest;
    files: Record<string, JsonObject>;
}
export interface AuroraBundleContents {
    manifest: AuroraBundleManifest;
    theme: AuroraTheme;
    texture: AuroraTexture | undefined;
    /** The producer's suggested pairing; the app decides whether to register it. */
    pairing: {
        themeId: string;
        textureId: string;
    } | undefined;
}
export interface AuroraBundleOptions {
    /** The app's theme contract. Defaults to the shared foundation-only contract. */
    contract?: AuroraContract;
    /** The app's texture contract. Defaults to the shared texture-foundation-only contract. */
    textureContract?: AuroraTextureContract;
}
export interface AuroraBundleReport {
    valid: boolean;
    issues: AuroraBundleIssue[];
    /** Present when the bundle is valid. */
    contents: AuroraBundleContents | undefined;
}
export interface AuroraBundleEncodeInit {
    theme: AuroraTheme;
    texture?: AuroraTexture;
    /** Suggest pairing the theme with the texture. Defaults to true when a texture is given. */
    pair?: boolean;
    provenance: AuroraBundleProvenance;
}
/** Portable bundle v1: decode, validate and produce. See `spec/bundle-v1.md`. */
export declare const AuroraBundle: Readonly<{
    /** The shared foundation-only theme contract used when no app contract is given. */
    readonly foundationContract: AuroraContract;
    /** The shared texture-foundation-only contract used when no app texture contract is given. */
    readonly textureFoundationContract: AuroraTextureContract;
    /**
     * Validates a single-file bundle object (or a folder loaded into one) and
     * reports every issue. Never throws for invalid input.
     */
    validate(input: unknown, options?: AuroraBundleOptions): AuroraBundleReport;
    /**
     * Validates and returns the bundle's theme, texture and pairing. Throws an
     * `AuroraFormatError` when any issue is a format issue, otherwise an
     * `AuroraValidationError` listing every issue as `file: message`.
     */
    load(input: unknown, options?: AuroraBundleOptions): AuroraBundleContents;
    /** Assembles the single-file form from a folder's `manifest.json` and token files. */
    fromFolder(manifest: unknown, files: Record<string, unknown>): unknown;
    /** Produces a single-file bundle from a theme and an optional texture. */
    encode(init: AuroraBundleEncodeInit): AuroraBundleJson;
}>;
