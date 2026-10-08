import { jsx as _jsx } from "react/jsx-runtime";
import { resolveTextureColor, } from '@aurora/core';
import { createContext, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, } from 'react';
import { AuroraController, DARK_QUERY } from './controller.js';
import { applyAuroraCssVariables, auroraCssVariables } from './css.js';
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
/**
 * Writes the store's declarations to the target imperatively, diffing against
 * what it last wrote, so changes never re-render the subtree.
 */
function useCssVariables(store, target, prefix, element) {
    useLayoutEffect(() => {
        if (target === 'none')
            return;
        const node = target === 'root' ? document.documentElement : element();
        if (node === null)
            return;
        let previous = {};
        const apply = () => {
            const { variant, texture } = store.getSnapshot();
            const next = auroraCssVariables(variant, texture, prefix === undefined ? {} : { prefix });
            applyAuroraCssVariables(node, next, previous);
            previous = next;
        };
        apply();
        const stop = store.subscribe(apply);
        return () => {
            stop();
            applyAuroraCssVariables(node, {}, previous);
        };
    }, [store, target, prefix, element]);
}
const CONTENTS = { display: 'contents' };
function managedKey(props) {
    return [props.contract, props.fallback, ...props.themes, '|', ...(props.textures ?? [])];
}
/**
 * Provides a controller to its subtree. Pass `controller` to borrow one you own
 * (never disposed here), or pass the runtime configuration to let the provider
 * create and dispose its own. Managed configuration is fixed while mounted;
 * give the provider a new `key` to replace it.
 *
 * Only components that read Aurora through hooks re-render on accepted
 * changes; CSS custom properties are written imperatively.
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
                queueMicrotask(() => {
                    if (!alive.current)
                        managed.dispose();
                });
            }
        };
    }, [managed]);
    const follow = props.followSystemAppearance ?? true;
    const onError = props.onSystemAppearanceError;
    useEffect(() => {
        if (!follow || typeof window === 'undefined' || typeof window.matchMedia !== 'function')
            return;
        const query = window.matchMedia(DARK_QUERY);
        const sync = () => {
            try {
                controller.setSystemAppearance(query.matches ? 'dark' : 'light');
            }
            catch (error) {
                if (onError !== undefined)
                    onError(error);
                else if (typeof reportError === 'function')
                    reportError(error);
            }
        };
        sync();
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, [controller, follow, onError]);
    const current = useMemo(() => controllerStore(controller), [controller]);
    const element = useRef(null);
    const getElement = useStableGetter(element);
    useCssVariables(current, props.cssVariables ?? 'element', props.cssPrefix, getElement);
    const Tag = props.as ?? 'div';
    return (_jsx(ScopeContext.Provider, { value: current, children: (props.cssVariables ?? 'element') === 'element' ? (_jsx(Tag, { ref: element, "data-aurora-scope": "", className: props.className, style: CONTENTS, children: props.children })) : (props.children) }));
}
function useStableGetter(ref) {
    const [getter] = useState(() => () => ref.current);
    return getter;
}
/**
 * Themes a subtree with an immutable variant (and optional texture) without a
 * controller or system-appearance subscription, for previews and gallery
 * thumbnails. Cheap to nest. Changing `variant` or `texture`, or calling
 * `update` on its handle, rewrites only the CSS variables whose values changed
 * and re-renders only components that read Aurora through hooks.
 */
export function AuroraFixedScope(props) {
    const { variant, texture } = props;
    const [store] = useState(() => new FixedStore(variant, texture));
    useLayoutEffect(() => {
        store.set(variant, texture);
    }, [store, variant, texture]);
    const element = useRef(null);
    const getElement = useStableGetter(element);
    useImperativeHandle(props.ref, () => ({
        update: (next, nextTexture) => store.set(next, nextTexture),
        get element() {
            return element.current;
        },
    }), [store]);
    const target = props.cssVariables === 'root' ? 'none' : (props.cssVariables ?? 'element');
    useCssVariables(store, target, props.cssPrefix, getElement);
    const Tag = props.as ?? 'div';
    return (_jsx(ScopeContext.Provider, { value: store, children: target === 'element' ? (_jsx(Tag, { ref: element, "data-aurora-scope": "", className: props.className, style: CONTENTS, children: props.children })) : (props.children) }));
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
        view = Object.freeze({
            texture,
            variant,
            read: (token) => texture.read(token),
            color: (ref) => resolveTextureColor(variant, ref),
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
