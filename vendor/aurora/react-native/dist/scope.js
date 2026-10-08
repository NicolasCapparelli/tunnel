import { jsx as _jsx } from "react/jsx-runtime";
import { resolveTextureColor, } from '@aurora/core';
import { createContext, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, } from 'react';
import { Appearance } from 'react-native';
import { appearanceFromColorScheme, AuroraController } from './controller.js';
import { createNativeTextureReader } from './native.js';
const ScopeContext = createContext(undefined);
function controllerStore(controller) {
    let state;
    let snapshot;
    return {
        controller,
        subscribe: controller.subscribe,
        getSnapshot() {
            const next = controller.state;
            if (next !== state || snapshot === undefined) {
                state = next;
                snapshot = { variant: next.variant, texture: next.texture };
            }
            return snapshot;
        },
    };
}
class FixedStore {
    controller = undefined;
    snapshot;
    listeners = new Set();
    constructor(variant, texture) {
        texture?.validateColors(variant.contract);
        this.snapshot = { variant, texture };
    }
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    getSnapshot = () => this.snapshot;
    set(variant, texture) {
        if (variant === this.snapshot.variant && texture === this.snapshot.texture)
            return;
        texture?.validateColors(variant.contract);
        this.snapshot = { variant, texture };
        for (const listener of [...this.listeners])
            listener();
    }
}
function managedKey(props) {
    return [props.contract, props.fallback, ...props.themes, '|', ...(props.textures ?? [])];
}
/**
 * Provides a controller to its subtree. Pass `controller` to borrow one you own
 * (never disposed here), or pass the runtime configuration to let the provider
 * create and dispose its own. Managed configuration is fixed while mounted;
 * give the provider a new `key` to replace it.
 *
 * The provider renders no native view, only a context provider, so theme
 * changes never remount navigation. Only components that read Aurora through
 * hooks re-render on accepted changes.
 */
export function AuroraProvider(props) {
    const borrowed = 'controller' in props ? props.controller : undefined;
    const managedInit = borrowed === undefined ? props : undefined;
    const [managed] = useState(() => (managedInit === undefined ? undefined : new AuroraController(managedInit)));
    const [initialKey] = useState(() => (managedInit === undefined ? undefined : managedKey(managedInit)));
    if (managedInit !== undefined && initialKey !== undefined) {
        const key = managedKey(managedInit);
        if (key.length !== initialKey.length || key.some((value, i) => value !== initialKey[i])) {
            throw new Error('AuroraProvider managed configuration is fixed while mounted; give the provider a new key.');
        }
    }
    const controller = borrowed ?? managed;
    // Dispose an owned controller only after a real unmount. StrictMode runs the
    // cleanup and the effect again synchronously, which this check survives.
    const alive = useRef(false);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            if (managed !== undefined) {
                // A microtask, as with queueMicrotask, which React Native's types omit.
                void Promise.resolve().then(() => {
                    if (!alive.current)
                        managed.dispose();
                });
            }
        };
    }, [managed]);
    const follow = props.followSystemAppearance ?? true;
    const onError = props.onSystemAppearanceError;
    useEffect(() => {
        if (!follow)
            return;
        const sync = (scheme) => {
            try {
                controller.setSystemAppearance(appearanceFromColorScheme(scheme));
            }
            catch (error) {
                if (onError !== undefined)
                    onError(error);
                else
                    console.error(error);
            }
        };
        sync(Appearance.getColorScheme());
        const subscription = Appearance.addChangeListener(({ colorScheme }) => sync(colorScheme));
        return () => subscription.remove();
    }, [controller, follow, onError]);
    const current = useMemo(() => controllerStore(controller), [controller]);
    return _jsx(ScopeContext.Provider, { value: current, children: props.children });
}
/**
 * Themes a subtree with an immutable variant (and optional texture) without a
 * controller or system-appearance subscription, such as a dark canvas inside a
 * light app. It renders no native view. Changing `variant` or `texture`, or
 * calling `update` on its handle, re-renders only components that read Aurora
 * through hooks. Texture colours must exist in the variant's contract.
 */
export function AuroraFixedScope(props) {
    const { variant, texture } = props;
    const [store] = useState(() => new FixedStore(variant, texture));
    useLayoutEffect(() => {
        store.set(variant, texture);
    }, [store, variant, texture]);
    useImperativeHandle(props.ref, () => ({
        update: (next, nextTexture) => store.set(next, nextTexture),
    }), [store]);
    return _jsx(ScopeContext.Provider, { value: store, children: props.children });
}
// ---------------------------------------------------------------- hooks
function useStore() {
    const store = useContext(ScopeContext);
    if (store === undefined) {
        throw new Error('Aurora access requires an AuroraProvider or AuroraFixedScope ancestor.');
    }
    return store;
}
/** The nearest scope's variant and texture; re-renders when either changes. */
export function useAuroraScope() {
    const store = useStore();
    return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
/** The active theme variant. */
export function useAuroraVariant() {
    return useAuroraScope().variant;
}
/** Typed foundation reads for the active variant (`tokens.primary`). */
export function useAuroraTokens() {
    return useAuroraScope().variant.tokens;
}
const views = new WeakMap();
function textureView(texture, variant) {
    let byTexture = views.get(variant);
    if (byTexture === undefined) {
        byTexture = new WeakMap();
        views.set(variant, byTexture);
    }
    let view = byTexture.get(texture);
    if (view === undefined) {
        const read = (token) => texture.read(token);
        view = Object.freeze({
            texture,
            variant,
            read,
            color: (ref) => resolveTextureColor(variant, ref),
            native: createNativeTextureReader(read, variant),
        });
        byTexture.set(texture, view);
    }
    return view;
}
/** The active texture, or undefined when the scope has none. */
export function useMaybeAuroraTexture() {
    const { variant, texture } = useAuroraScope();
    return texture === undefined ? undefined : textureView(texture, variant);
}
/** The active texture. Throws when no texture is active. */
export function useAuroraTexture() {
    const view = useMaybeAuroraTexture();
    if (view === undefined) {
        throw new Error('No Aurora texture is active. Register textures on the provider or controller, or pass a texture to AuroraFixedScope.');
    }
    return view;
}
export function useAuroraToken(token) {
    const { variant, texture } = useAuroraScope();
    if (token.type === 'color')
        return variant.read(token);
    if (texture === undefined)
        throw new Error(`No Aurora texture is active to read ${token.path}.`);
    return texture.read(token);
}
/** The nearest provider's controller. Throws inside a fixed scope. */
export function useAuroraController() {
    const store = useStore();
    if (store.controller === undefined)
        throw new Error('AuroraFixedScope has no selection controller.');
    return store.controller;
}
/** The nearest provider's full runtime state (selection, theme, variant, texture). */
export function useAuroraState() {
    const controller = useAuroraController();
    return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
