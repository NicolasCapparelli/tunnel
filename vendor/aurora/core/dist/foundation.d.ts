import type { AuroraColor } from './color.js';
import { AuroraColorToken } from './token.js';
import type { AuroraThemeVariant } from './theme.js';
/** Aurora foundation v1: current Material color roles plus status roles. */
export declare const AuroraFoundation: Readonly<{
    version: 1;
    primary: AuroraColorToken;
    onPrimary: AuroraColorToken;
    primaryContainer: AuroraColorToken;
    onPrimaryContainer: AuroraColorToken;
    primaryFixed: AuroraColorToken;
    primaryFixedDim: AuroraColorToken;
    onPrimaryFixed: AuroraColorToken;
    onPrimaryFixedVariant: AuroraColorToken;
    secondary: AuroraColorToken;
    onSecondary: AuroraColorToken;
    secondaryContainer: AuroraColorToken;
    onSecondaryContainer: AuroraColorToken;
    secondaryFixed: AuroraColorToken;
    secondaryFixedDim: AuroraColorToken;
    onSecondaryFixed: AuroraColorToken;
    onSecondaryFixedVariant: AuroraColorToken;
    tertiary: AuroraColorToken;
    onTertiary: AuroraColorToken;
    tertiaryContainer: AuroraColorToken;
    onTertiaryContainer: AuroraColorToken;
    tertiaryFixed: AuroraColorToken;
    tertiaryFixedDim: AuroraColorToken;
    onTertiaryFixed: AuroraColorToken;
    onTertiaryFixedVariant: AuroraColorToken;
    error: AuroraColorToken;
    onError: AuroraColorToken;
    errorContainer: AuroraColorToken;
    onErrorContainer: AuroraColorToken;
    surface: AuroraColorToken;
    onSurface: AuroraColorToken;
    surfaceDim: AuroraColorToken;
    surfaceBright: AuroraColorToken;
    surfaceContainerLowest: AuroraColorToken;
    surfaceContainerLow: AuroraColorToken;
    surfaceContainer: AuroraColorToken;
    surfaceContainerHigh: AuroraColorToken;
    surfaceContainerHighest: AuroraColorToken;
    onSurfaceVariant: AuroraColorToken;
    outline: AuroraColorToken;
    outlineVariant: AuroraColorToken;
    shadow: AuroraColorToken;
    scrim: AuroraColorToken;
    inverseSurface: AuroraColorToken;
    onInverseSurface: AuroraColorToken;
    inversePrimary: AuroraColorToken;
    surfaceTint: AuroraColorToken;
    success: AuroraColorToken;
    onSuccess: AuroraColorToken;
    successContainer: AuroraColorToken;
    onSuccessContainer: AuroraColorToken;
    warning: AuroraColorToken;
    onWarning: AuroraColorToken;
    warningContainer: AuroraColorToken;
    onWarningContainer: AuroraColorToken;
    info: AuroraColorToken;
    onInfo: AuroraColorToken;
    infoContainer: AuroraColorToken;
    onInfoContainer: AuroraColorToken;
    tokens: readonly AuroraColorToken[];
}>;
/** Direct immutable values for the entire app contract. No global active theme. */
export declare class AuroraTokens {
    private readonly variant;
    constructor(variant: AuroraThemeVariant);
    read(token: AuroraColorToken): AuroraColor;
    /** Accent for prominent actions. */
    get primary(): AuroraColor;
    /** Text and icons on primary. */
    get onPrimary(): AuroraColor;
    /** Lower-emphasis container for prominent actions. */
    get primaryContainer(): AuroraColor;
    /** Text and icons on primaryContainer. */
    get onPrimaryContainer(): AuroraColor;
    /** Container accent that stays constant across appearances. */
    get primaryFixed(): AuroraColor;
    /** Stronger fixed primary accent. */
    get primaryFixedDim(): AuroraColor;
    /** Text and icons on fixed primary accents. */
    get onPrimaryFixed(): AuroraColor;
    /** Lower-emphasis content on fixed primary accents. */
    get onPrimaryFixedVariant(): AuroraColor;
    /** Accent for less prominent actions. */
    get secondary(): AuroraColor;
    /** Text and icons on secondary. */
    get onSecondary(): AuroraColor;
    /** Lower-emphasis container for less prominent actions. */
    get secondaryContainer(): AuroraColor;
    /** Text and icons on secondaryContainer. */
    get onSecondaryContainer(): AuroraColor;
    /** Container accent that stays constant across appearances. */
    get secondaryFixed(): AuroraColor;
    /** Stronger fixed secondary accent. */
    get secondaryFixedDim(): AuroraColor;
    /** Text and icons on fixed secondary accents. */
    get onSecondaryFixed(): AuroraColor;
    /** Lower-emphasis content on fixed secondary accents. */
    get onSecondaryFixedVariant(): AuroraColor;
    /** Accent for contrasting accents. */
    get tertiary(): AuroraColor;
    /** Text and icons on tertiary. */
    get onTertiary(): AuroraColor;
    /** Lower-emphasis container for contrasting accents. */
    get tertiaryContainer(): AuroraColor;
    /** Text and icons on tertiaryContainer. */
    get onTertiaryContainer(): AuroraColor;
    /** Container accent that stays constant across appearances. */
    get tertiaryFixed(): AuroraColor;
    /** Stronger fixed tertiary accent. */
    get tertiaryFixedDim(): AuroraColor;
    /** Text and icons on fixed tertiary accents. */
    get onTertiaryFixed(): AuroraColor;
    /** Lower-emphasis content on fixed tertiary accents. */
    get onTertiaryFixedVariant(): AuroraColor;
    /** Error and destructive feedback. */
    get error(): AuroraColor;
    /** Text and icons on error. */
    get onError(): AuroraColor;
    /** Lower-emphasis error container. */
    get errorContainer(): AuroraColor;
    /** Text and icons on errorContainer. */
    get onErrorContainer(): AuroraColor;
    /** Default page and component surface. */
    get surface(): AuroraColor;
    /** Primary text and icons on surfaces. */
    get onSurface(): AuroraColor;
    /** Dimmest surface tone. */
    get surfaceDim(): AuroraColor;
    /** Brightest surface tone. */
    get surfaceBright(): AuroraColor;
    /** Lowest surface container level. */
    get surfaceContainerLowest(): AuroraColor;
    /** Low surface container level. */
    get surfaceContainerLow(): AuroraColor;
    /** Default distinct surface container. */
    get surfaceContainer(): AuroraColor;
    /** High surface container level. */
    get surfaceContainerHigh(): AuroraColor;
    /** Highest surface container level. */
    get surfaceContainerHighest(): AuroraColor;
    /** Lower-emphasis text and icons on surfaces. */
    get onSurfaceVariant(): AuroraColor;
    /** Boundaries requiring emphasis. */
    get outline(): AuroraColor;
    /** Subtle decorative boundaries and dividers. */
    get outlineVariant(): AuroraColor;
    /** Color of cast shadows. */
    get shadow(): AuroraColor;
    /** Color of obscuring modal overlays. */
    get scrim(): AuroraColor;
    /** Surface contrasting with surrounding appearance. */
    get inverseSurface(): AuroraColor;
    /** Text and icons on inverseSurface. */
    get onInverseSurface(): AuroraColor;
    /** Primary accent on inverseSurface. */
    get inversePrimary(): AuroraColor;
    /** Accent used by Material surface tint treatments. */
    get surfaceTint(): AuroraColor;
    /** Success feedback. */
    get success(): AuroraColor;
    /** Text and icons on success. */
    get onSuccess(): AuroraColor;
    /** Lower-emphasis success container. */
    get successContainer(): AuroraColor;
    /** Text and icons on successContainer. */
    get onSuccessContainer(): AuroraColor;
    /** Warning feedback. */
    get warning(): AuroraColor;
    /** Text and icons on warning. */
    get onWarning(): AuroraColor;
    /** Lower-emphasis warning container. */
    get warningContainer(): AuroraColor;
    /** Text and icons on warningContainer. */
    get onWarningContainer(): AuroraColor;
    /** Info feedback. */
    get info(): AuroraColor;
    /** Text and icons on info. */
    get onInfo(): AuroraColor;
    /** Lower-emphasis info container. */
    get infoContainer(): AuroraColor;
    /** Text and icons on infoContainer. */
    get onInfoContainer(): AuroraColor;
}
