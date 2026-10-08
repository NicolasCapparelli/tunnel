import { AuroraArgumentError, AuroraFormatError, AuroraStateError } from './errors.js';
import { hasOwn, isJsonObject } from './json.js';
import { parseAppearancePreference, } from './theme.js';
/** A theme identity, appearance preference and optional explicit texture. */
export class AuroraSelection {
    themeId;
    appearance;
    textureId;
    constructor(init) {
        this.themeId = init.themeId;
        this.appearance = init.appearance ?? 'system';
        this.textureId = init.textureId;
        Object.freeze(this);
    }
    /**
     * Restore settings without performing IO or resolving missing variants. The
     * fallback identity must exist; variant policy remains the runtime's job. A
     * texture id that is not among the registered textures restores to
     * undefined, which uses the theme's paired texture.
     */
    static restore(init) {
        const ids = new Set([...init.themes].map((theme) => theme.id));
        if (!ids.has(init.fallbackId))
            throw new AuroraArgumentError(`Unknown fallback theme ${init.fallbackId}`);
        const textureIds = new Set([...(init.textures ?? [])].map((texture) => texture.id));
        return new AuroraSelection({
            themeId: init.themeId !== undefined && ids.has(init.themeId) ? init.themeId : init.fallbackId,
            appearance: parseAppearancePreference(init.preference) ?? 'system',
            textureId: init.textureId !== undefined && textureIds.has(init.textureId) ? init.textureId : undefined,
        });
    }
    /** Forgiving stored-data boundary; malformed fields use restore defaults. */
    static restoreJson(json, options) {
        const map = isJsonObject(json) ? json : {};
        const text = (value) => (typeof value === 'string' ? value : undefined);
        return AuroraSelection.restore({
            themeId: text(map['themeId']),
            preference: text(map['appearance']),
            themes: options.themes,
            fallbackId: options.fallbackId,
            textureId: text(map['textureId']),
            ...(options.textures === undefined ? {} : { textures: options.textures }),
        });
    }
    /** Strict decoding: rejects malformed or unknown fields. */
    static fromJson(json) {
        const map = isJsonObject(json) ? json : undefined;
        const id = map?.['themeId'];
        const appearance = parseAppearancePreference(map?.['appearance']);
        const textureId = map?.['textureId'];
        if (map === undefined ||
            typeof id !== 'string' ||
            id.trim() === '' ||
            appearance === undefined ||
            (hasOwn(map, 'textureId') && (typeof textureId !== 'string' || textureId.trim() === '')) ||
            Object.keys(map).some((key) => key !== 'themeId' && key !== 'appearance' && key !== 'textureId')) {
            throw new AuroraFormatError('Expected themeId, appearance and optional textureId selection fields');
        }
        return new AuroraSelection({ themeId: id, appearance, textureId: textureId });
    }
    toJson() {
        return {
            themeId: this.themeId,
            appearance: this.appearance,
            ...(this.textureId === undefined ? {} : { textureId: this.textureId }),
        };
    }
    equals(other) {
        return other.themeId === this.themeId && other.appearance === this.appearance && other.textureId === this.textureId;
    }
}
/** Immutable snapshot of the requested selection and its resolved values. */
export class AuroraState {
    selection;
    theme;
    variant;
    texture;
    constructor(selection, theme, variant, 
    /** The active texture: the selected one, else the theme's paired one, else undefined. */
    texture = undefined) {
        this.selection = selection;
        this.theme = theme;
        this.variant = variant;
        this.texture = texture;
        Object.freeze(this);
    }
}
/**
 * Framework-free selection runtime. Rejected changes leave selection and
 * active values intact. Accepted changes are delivered asynchronously, in
 * order, to listeners registered with {@link AuroraRuntime.listen}, matching the
 * Dart runtime's broadcast stream; read {@link AuroraRuntime.state} for the
 * current snapshot.
 */
export class AuroraRuntime {
    contract;
    fallback;
    themes;
    /** Registered textures by id; empty when the app does not use textures. */
    textures;
    pairings = new Map();
    systemAppearance;
    current;
    listeners = new Set();
    disposed = false;
    constructor(init) {
        this.contract = init.contract;
        this.fallback = init.fallback;
        this.systemAppearance = init.systemAppearance ?? 'light';
        const textures = [...(init.textures ?? [])];
        const textureRegistry = new Map();
        for (const texture of textures) {
            if (texture.contract !== textures[0].contract) {
                throw new AuroraArgumentError('Textures must use the same texture contract instance');
            }
            if (textureRegistry.has(texture.id))
                throw new AuroraArgumentError(`Duplicate texture id ${texture.id}`);
            texture.validateColors(init.contract);
            textureRegistry.set(texture.id, texture);
        }
        this.textures = textureRegistry;
        const registry = new Map();
        for (const theme of init.themes) {
            if (theme.contract !== init.contract)
                throw new AuroraArgumentError(`Theme ${theme.id} uses a different contract`);
            if (registry.has(theme.id))
                throw new AuroraArgumentError(`Duplicate theme id ${theme.id}`);
            registry.set(theme.id, theme);
        }
        this.themes = registry;
        const pairings = init.texturePairings instanceof Map ? init.texturePairings : new Map(Object.entries(init.texturePairings ?? {}));
        for (const [themeId, textureId] of pairings) {
            this.checkPairing(themeId, textureId);
            this.pairings.set(themeId, textureId);
        }
        this.current = this.resolve(init.initialSelection, this.systemAppearance);
    }
    /** The shared texture contract, or undefined when no textures are registered. */
    get textureContract() {
        return this.textures.values().next().value?.contract;
    }
    /** Theme id to paired texture id. */
    get texturePairings() {
        return new Map(this.pairings);
    }
    get state() {
        return this.current;
    }
    /** The system appearance used for `system` preferences. */
    get system() {
        return this.systemAppearance;
    }
    /**
     * Delivers each later accepted change asynchronously (on a microtask) and in
     * order. Returns a function that stops delivery. A disposed runtime delivers
     * nothing.
     */
    listen(listener) {
        if (this.disposed)
            return () => { };
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    /** Changes as an async iterable, ending after the runtime is disposed. */
    changes() {
        const runtime = this;
        return {
            [Symbol.asyncIterator]() {
                const queue = [];
                let wake;
                let closed = runtime.disposed;
                const stop = runtime.listen((state) => {
                    queue.push(state);
                    wake?.();
                });
                const onClose = () => {
                    closed = true;
                    wake?.();
                };
                runtime.closeHandlers.add(onClose);
                const finish = () => {
                    stop();
                    runtime.closeHandlers.delete(onClose);
                    return { value: undefined, done: true };
                };
                return {
                    async next() {
                        while (true) {
                            if (queue.length > 0)
                                return { value: queue.shift(), done: false };
                            if (closed)
                                return finish();
                            await new Promise((resolve) => {
                                wake = resolve;
                            });
                            wake = undefined;
                        }
                    },
                    async return() {
                        return finish();
                    },
                };
            },
        };
    }
    closeHandlers = new Set();
    resolve(selection, system) {
        const theme = this.themes.get(selection.themeId);
        if (theme === undefined)
            throw new AuroraArgumentError(`Unknown theme ${selection.themeId}`);
        const appearance = selection.appearance === 'system' ? system : selection.appearance;
        const variant = theme.variants.get(appearance) ??
            (this.fallback === 'preferred' ? theme.variants.get(theme.preferredAppearance) : undefined);
        if (variant === undefined)
            throw new AuroraStateError(`Theme ${theme.id} has no ${appearance} variant`);
        const textureId = selection.textureId ?? this.pairings.get(theme.id);
        let texture;
        if (textureId !== undefined) {
            texture = this.textures.get(textureId);
            if (texture === undefined) {
                throw new AuroraArgumentError(this.textures.size === 0
                    ? `Texture ${textureId} selected, but no textures are registered`
                    : `Unknown texture ${textureId}`);
            }
        }
        return new AuroraState(selection, theme, variant, texture);
    }
    checkPairing(themeId, textureId) {
        if (!this.themes.has(themeId))
            throw new AuroraArgumentError(`Unknown theme ${themeId}`);
        if (textureId !== undefined && !this.textures.has(textureId)) {
            throw new AuroraArgumentError(`Unknown texture ${textureId}`);
        }
    }
    emit(state) {
        this.current = state;
        const listeners = [...this.listeners];
        void Promise.resolve().then(() => {
            for (const listener of listeners) {
                if (this.listeners.has(listener))
                    listener(state);
            }
        });
    }
    /**
     * Pairs [themeId] with [textureId], or removes its pairing when undefined.
     * Selections without an explicit texture use the active theme's pairing.
     */
    pairTexture(themeId, textureId) {
        this.ensureOpen();
        this.checkPairing(themeId, textureId);
        if (this.pairings.get(themeId) === textureId)
            return;
        if (textureId === undefined) {
            this.pairings.delete(themeId);
        }
        else {
            this.pairings.set(themeId, textureId);
        }
        const next = this.resolve(this.current.selection, this.systemAppearance);
        if (next.texture === this.current.texture)
            return;
        this.emit(next);
    }
    select(selection) {
        this.ensureOpen();
        const next = this.resolve(selection, this.systemAppearance);
        if (this.current.selection.equals(selection))
            return;
        this.emit(next);
    }
    setSystemAppearance(appearance) {
        this.ensureOpen();
        if (this.systemAppearance === appearance)
            return;
        const next = this.resolve(this.current.selection, appearance);
        this.systemAppearance = appearance;
        if (next.variant === this.current.variant)
            return;
        this.emit(next);
    }
    ensureOpen() {
        if (this.disposed)
            throw new AuroraStateError('AuroraRuntime has been disposed');
    }
    get isDisposed() {
        return this.disposed;
    }
    /** Stops accepting changes. Already scheduled deliveries still run. */
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        void Promise.resolve().then(() => {
            this.listeners.clear();
            for (const close of [...this.closeHandlers])
                close();
        });
    }
}
