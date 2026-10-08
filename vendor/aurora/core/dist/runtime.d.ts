import type { AuroraContract } from './contract.js';
import type { AuroraTexture, AuroraTextureContract } from './texture.js';
import { type AuroraAppearance, type AuroraAppearancePreference, type AuroraTheme, type AuroraThemeVariant } from './theme.js';
/** A missing variant either fails or uses the theme's explicitly preferred one. */
export type AuroraVariantFallback = 'reject' | 'preferred';
/** Stored selection JSON. `textureId` is present only for an explicit texture choice. */
export interface AuroraSelectionJson {
    themeId: string;
    appearance: AuroraAppearancePreference;
    textureId?: string;
}
export interface AuroraSelectionInit {
    themeId: string;
    appearance?: AuroraAppearancePreference;
    /**
     * The texture the user chose explicitly. Undefined uses the theme's paired
     * texture, or no texture when the theme has no pairing.
     */
    textureId?: string | undefined;
}
export interface AuroraSelectionRestoreInit {
    themeId?: string | undefined;
    preference?: string | undefined;
    themes: Iterable<AuroraTheme>;
    fallbackId: string;
    textureId?: string | undefined;
    textures?: Iterable<AuroraTexture>;
}
/** A theme identity, appearance preference and optional explicit texture. */
export declare class AuroraSelection {
    readonly themeId: string;
    readonly appearance: AuroraAppearancePreference;
    readonly textureId: string | undefined;
    constructor(init: AuroraSelectionInit);
    /**
     * Restore settings without performing IO or resolving missing variants. The
     * fallback identity must exist; variant policy remains the runtime's job. A
     * texture id that is not among the registered textures restores to
     * undefined, which uses the theme's paired texture.
     */
    static restore(init: AuroraSelectionRestoreInit): AuroraSelection;
    /** Forgiving stored-data boundary; malformed fields use restore defaults. */
    static restoreJson(json: unknown, options: {
        themes: Iterable<AuroraTheme>;
        fallbackId: string;
        textures?: Iterable<AuroraTexture>;
    }): AuroraSelection;
    /** Strict decoding: rejects malformed or unknown fields. */
    static fromJson(json: unknown): AuroraSelection;
    toJson(): AuroraSelectionJson;
    equals(other: AuroraSelection): boolean;
}
/** Immutable snapshot of the requested selection and its resolved values. */
export declare class AuroraState {
    readonly selection: AuroraSelection;
    readonly theme: AuroraTheme;
    readonly variant: AuroraThemeVariant;
    /** The active texture: the selected one, else the theme's paired one, else undefined. */
    readonly texture: AuroraTexture | undefined;
    constructor(selection: AuroraSelection, theme: AuroraTheme, variant: AuroraThemeVariant, 
    /** The active texture: the selected one, else the theme's paired one, else undefined. */
    texture?: AuroraTexture | undefined);
}
export interface AuroraRuntimeInit {
    contract: AuroraContract;
    themes: Iterable<AuroraTheme>;
    initialSelection: AuroraSelection;
    fallback: AuroraVariantFallback;
    /** The host's current system appearance; defaults to light. */
    systemAppearance?: AuroraAppearance;
    textures?: Iterable<AuroraTexture>;
    /** Theme id to the texture id it uses when the selection names none. */
    texturePairings?: Readonly<Record<string, string>> | ReadonlyMap<string, string>;
}
export type AuroraStateListener = (state: AuroraState) => void;
/**
 * Framework-free selection runtime. Rejected changes leave selection and
 * active values intact. Accepted changes are delivered asynchronously, in
 * order, to listeners registered with {@link AuroraRuntime.listen}, matching the
 * Dart runtime's broadcast stream; read {@link AuroraRuntime.state} for the
 * current snapshot.
 */
export declare class AuroraRuntime {
    readonly contract: AuroraContract;
    readonly fallback: AuroraVariantFallback;
    readonly themes: ReadonlyMap<string, AuroraTheme>;
    /** Registered textures by id; empty when the app does not use textures. */
    readonly textures: ReadonlyMap<string, AuroraTexture>;
    private readonly pairings;
    private systemAppearance;
    private current;
    private readonly listeners;
    private disposed;
    constructor(init: AuroraRuntimeInit);
    /** The shared texture contract, or undefined when no textures are registered. */
    get textureContract(): AuroraTextureContract | undefined;
    /** Theme id to paired texture id. */
    get texturePairings(): ReadonlyMap<string, string>;
    get state(): AuroraState;
    /** The system appearance used for `system` preferences. */
    get system(): AuroraAppearance;
    /**
     * Delivers each later accepted change asynchronously (on a microtask) and in
     * order. Returns a function that stops delivery. A disposed runtime delivers
     * nothing.
     */
    listen(listener: AuroraStateListener): () => void;
    /** Changes as an async iterable, ending after the runtime is disposed. */
    changes(): AsyncIterable<AuroraState>;
    private readonly closeHandlers;
    private resolve;
    private checkPairing;
    private emit;
    /**
     * Pairs [themeId] with [textureId], or removes its pairing when undefined.
     * Selections without an explicit texture use the active theme's pairing.
     */
    pairTexture(themeId: string, textureId: string | undefined): void;
    select(selection: AuroraSelection): void;
    setSystemAppearance(appearance: AuroraAppearance): void;
    private ensureOpen;
    get isDisposed(): boolean;
    /** Stops accepting changes. Already scheduled deliveries still run. */
    dispose(): void;
}
