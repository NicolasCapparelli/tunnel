import type { AuroraColor } from './color.js';
import type { AuroraAppearance, AuroraThemeVariant } from './theme.js';
import type { AuroraColorToken } from './token.js';
export interface AuroraContrastPairInit {
    foreground: AuroraColorToken;
    background: AuroraColorToken;
    /** WCAG ratio in [1, 21]; defaults to 4.5. */
    minimumRatio?: number;
}
/** Explicit foreground/background usage to evaluate, not a whole-app audit. */
export declare class AuroraContrastPair {
    readonly foreground: AuroraColorToken;
    readonly background: AuroraColorToken;
    readonly minimumRatio: number;
    constructor(init: AuroraContrastPairInit);
}
export type AuroraContrastStatus = 'pass' | 'fail' | 'unknown';
export interface AuroraContrastCheckJson {
    appearance: AuroraAppearance;
    foreground: string;
    background: string;
    minimumRatio: number;
    ratio: number | null;
    status: AuroraContrastStatus;
    reason?: 'transparentBackground';
}
export declare class AuroraContrastCheck {
    readonly appearance: AuroraAppearance;
    readonly pair: AuroraContrastPair;
    /** Null means the background is translucent and its backing color is unknown. */
    readonly ratio: number | null;
    constructor(appearance: AuroraAppearance, pair: AuroraContrastPair, 
    /** Null means the background is translucent and its backing color is unknown. */
    ratio: number | null);
    get status(): AuroraContrastStatus;
    toJson(): AuroraContrastCheckJson;
}
/**
 * sRGB relative-luminance contrast. Foreground alpha is composited over an
 * opaque background; translucent backgrounds require a backing color and are
 * reported as unknown. No colors are changed by diagnostics.
 */
export declare const AuroraContrast: Readonly<{
    /** The documented foundation pairs, checked for every generated variant. */
    foundationPairs: readonly AuroraContrastPair[];
    /** WCAG ratio, or null when the background is translucent. */
    ratio(foreground: AuroraColor, background: AuroraColor): number | null;
    /**
     * Highest measured contrast, retaining the first candidate on ties. Rejects
     * unknown backing colors and empty candidate sets.
     */
    bestOn(background: AuroraColor, candidates: Iterable<AuroraColor>): AuroraColor;
    /** Checks the foundation pairs plus [additionalPairs] for one variant. */
    check(variant: AuroraThemeVariant, additionalPairs?: Iterable<AuroraContrastPair>): AuroraContrastCheck[];
}>;
