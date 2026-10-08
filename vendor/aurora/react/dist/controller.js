import { AuroraRuntime, } from '@aurora/core';
export const DARK_QUERY = '(prefers-color-scheme: dark)';
/** The browser's current appearance, or light where `matchMedia` is unavailable. */
export function systemAppearance() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
        return 'light';
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}
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
export class AuroraController {
    runtime;
    ownsRuntime;
    listeners = new Set();
    disposed = false;
    notified;
    stopListening;
    constructor(init) {
        if ('runtime' in init) {
            this.runtime = init.runtime;
            this.ownsRuntime = false;
        }
        else {
            this.runtime = new AuroraRuntime({ ...init, systemAppearance: init.systemAppearance ?? systemAppearance() });
            this.ownsRuntime = true;
        }
        this.notified = this.runtime.state;
        // Changes made on the runtime directly (for example by other code holding a
        // borrowed runtime) arrive asynchronously; notify for those as well.
        this.stopListening = this.runtime.listen(() => this.notifyIfChanged());
    }
    /** A controller over a caller-owned runtime; disposing it leaves the runtime open. */
    static borrow(runtime) {
        return new AuroraController({ runtime });
    }
    get state() {
        return this.runtime.state;
    }
    /** Stable snapshot accessor for `useSyncExternalStore`. */
    getSnapshot = () => this.runtime.state;
    /** Synchronous subscription for `useSyncExternalStore`. */
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    select(selection) {
        this.mutate(() => this.runtime.select(selection));
    }
    setSystemAppearance(appearance) {
        this.mutate(() => this.runtime.setSystemAppearance(appearance));
    }
    /** Pairs a theme with a texture, or removes the pairing when undefined. */
    pairTexture(themeId, textureId) {
        this.mutate(() => this.runtime.pairTexture(themeId, textureId));
    }
    mutate(change) {
        change();
        this.notifyIfChanged();
    }
    notifyIfChanged() {
        if (this.disposed || this.runtime.state === this.notified)
            return;
        this.notified = this.runtime.state;
        for (const listener of [...this.listeners])
            listener();
    }
    get isDisposed() {
        return this.disposed;
    }
    /** Stops notifications; disposes the runtime only when this controller owns it. */
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.listeners.clear();
        this.stopListening();
        if (this.ownsRuntime)
            this.runtime.dispose();
    }
}
