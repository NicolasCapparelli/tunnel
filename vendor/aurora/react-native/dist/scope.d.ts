import { type AuroraColor, type AuroraColorToken, type AuroraRef, type AuroraState, type AuroraTexture, type AuroraThemeVariant, type AuroraToken, type AuroraTokens } from '@aurora/core';
import { type ReactNode, type Ref } from 'react';
import { AuroraController, type AuroraControllerInit } from './controller.js';
import { type AuroraNativeTextureReader } from './native.js';
/** The values a scope exposes: the active variant and texture. */
export interface AuroraScopeSnapshot {
    readonly variant: AuroraThemeVariant;
    readonly texture: AuroraTexture | undefined;
}
export type AuroraProviderProps = ({
    controller: AuroraController;
} | AuroraControllerInit) & {
    children?: ReactNode;
    /** Follow the device appearance (`Appearance`) changes. Defaults to true. */
    followSystemAppearance?: boolean;
    /**
     * Called when the system appearance changes to one the selection cannot
     * show under the `reject` fallback. The state stays unchanged. Without it,
     * the error goes to `console.error`.
     */
    onSystemAppearanceError?: (error: unknown) => void;
};
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
export declare function AuroraProvider(props: AuroraProviderProps): ReactNode;
/** Imperative control of a fixed scope, for per-frame updates without rendering. */
export interface AuroraScopeHandle {
    /** Shows [variant] and [texture] now and notifies hook readers. */
    update(variant: AuroraThemeVariant, texture?: AuroraTexture): void;
}
export interface AuroraFixedScopeProps {
    variant: AuroraThemeVariant;
    texture?: AuroraTexture | undefined;
    children?: ReactNode;
    ref?: Ref<AuroraScopeHandle>;
}
/**
 * Themes a subtree with an immutable variant (and optional texture) without a
 * controller or system-appearance subscription, such as a dark canvas inside a
 * light app. It renders no native view. Changing `variant` or `texture`, or
 * calling `update` on its handle, re-renders only components that read Aurora
 * through hooks. Texture colours must exist in the variant's contract.
 */
export declare function AuroraFixedScope(props: AuroraFixedScopeProps): ReactNode;
/** The nearest scope's variant and texture; re-renders when either changes. */
export declare function useAuroraScope(): AuroraScopeSnapshot;
/** The active theme variant. */
export declare function useAuroraVariant(): AuroraThemeVariant;
/** Typed foundation reads for the active variant (`tokens.primary`). */
export declare function useAuroraTokens(): AuroraTokens;
/** A texture bound to the variant it is shown with. */
export interface AuroraTextureView {
    readonly texture: AuroraTexture;
    readonly variant: AuroraThemeVariant;
    /** The resolved value of a texture token. */
    read<T>(token: AuroraToken<T>): T;
    /** A texture colour (literal or theme colour alias) resolved against the variant. */
    color(ref: AuroraRef<AuroraColor>): AuroraColor;
    /** Explicit React Native style conversions of texture tokens against this variant. */
    readonly native: AuroraNativeTextureReader;
}
/** The active texture, or undefined when the scope has none. */
export declare function useMaybeAuroraTexture(): AuroraTextureView | undefined;
/** The active texture. Throws when no texture is active. */
export declare function useAuroraTexture(): AuroraTextureView;
/**
 * A typed read of any token, including app extensions: a colour token reads the
 * active variant; any other token reads the active texture.
 */
export declare function useAuroraToken(token: AuroraColorToken): AuroraColor;
export declare function useAuroraToken<T>(token: AuroraToken<T>): T;
/** The nearest provider's controller. Throws inside a fixed scope. */
export declare function useAuroraController(): AuroraController;
/** The nearest provider's full runtime state (selection, theme, variant, texture). */
export declare function useAuroraState(): AuroraState;
