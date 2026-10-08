import { type AuroraAppearance, AuroraRuntime, type AuroraRuntimeInit, type AuroraSelection, type AuroraState } from '@aurora/core';
export declare const DARK_QUERY = "(prefers-color-scheme: dark)";
/** The browser's current appearance, or light where `matchMedia` is unavailable. */
export declare function systemAppearance(): AuroraAppearance;
export type AuroraControllerInit = Omit<AuroraRuntimeInit, 'systemAppearance'> & {
    /** Defaults to the browser's `prefers-color-scheme`. */
    systemAppearance?: AuroraAppearance;
};
/**
 * Wraps an `AuroraRuntime` and notifies listeners synchronously after each
 * accepted change, which is what `useSyncExternalStore` needs. Rejected changes
 * throw and notify nobody.
 *
 * Ownership follows the Flutter adapter: `new AuroraController(init)` creates
 * and owns its runtime and disposes it in {@link dispose};
 * {@link AuroraController.borrow} wraps a runtime the caller owns and never
 * disposes it.
 */
export declare class AuroraController {
    readonly runtime: AuroraRuntime;
    readonly ownsRuntime: boolean;
    private readonly listeners;
    private disposed;
    private notified;
    private readonly stopListening;
    constructor(init: AuroraControllerInit | {
        runtime: AuroraRuntime;
    });
    /** A controller over a caller-owned runtime; disposing it leaves the runtime open. */
    static borrow(runtime: AuroraRuntime): AuroraController;
    get state(): AuroraState;
    /** Stable snapshot accessor for `useSyncExternalStore`. */
    readonly getSnapshot: () => AuroraState;
    /** Synchronous subscription for `useSyncExternalStore`. */
    readonly subscribe: (listener: () => void) => (() => void);
    select(selection: AuroraSelection): void;
    setSystemAppearance(appearance: AuroraAppearance): void;
    /** Pairs a theme with a texture, or removes the pairing when undefined. */
    pairTexture(themeId: string, textureId: string | undefined): void;
    private mutate;
    private notifyIfChanged;
    get isDisposed(): boolean;
    /** Stops notifications; disposes the runtime only when this controller owns it. */
    dispose(): void;
}
