import { AuroraColorToken } from './token.js';
const primary = new AuroraColorToken('colors.primary', { description: "Accent for prominent actions." });
const onPrimary = new AuroraColorToken('colors.onPrimary', { description: "Text and icons on primary." });
const primaryContainer = new AuroraColorToken('colors.primaryContainer', { description: "Lower-emphasis container for prominent actions." });
const onPrimaryContainer = new AuroraColorToken('colors.onPrimaryContainer', { description: "Text and icons on primaryContainer." });
const primaryFixed = new AuroraColorToken('colors.primaryFixed', { description: "Container accent that stays constant across appearances." });
const primaryFixedDim = new AuroraColorToken('colors.primaryFixedDim', { description: "Stronger fixed primary accent." });
const onPrimaryFixed = new AuroraColorToken('colors.onPrimaryFixed', { description: "Text and icons on fixed primary accents." });
const onPrimaryFixedVariant = new AuroraColorToken('colors.onPrimaryFixedVariant', { description: "Lower-emphasis content on fixed primary accents." });
const secondary = new AuroraColorToken('colors.secondary', { description: "Accent for less prominent actions." });
const onSecondary = new AuroraColorToken('colors.onSecondary', { description: "Text and icons on secondary." });
const secondaryContainer = new AuroraColorToken('colors.secondaryContainer', { description: "Lower-emphasis container for less prominent actions." });
const onSecondaryContainer = new AuroraColorToken('colors.onSecondaryContainer', { description: "Text and icons on secondaryContainer." });
const secondaryFixed = new AuroraColorToken('colors.secondaryFixed', { description: "Container accent that stays constant across appearances." });
const secondaryFixedDim = new AuroraColorToken('colors.secondaryFixedDim', { description: "Stronger fixed secondary accent." });
const onSecondaryFixed = new AuroraColorToken('colors.onSecondaryFixed', { description: "Text and icons on fixed secondary accents." });
const onSecondaryFixedVariant = new AuroraColorToken('colors.onSecondaryFixedVariant', { description: "Lower-emphasis content on fixed secondary accents." });
const tertiary = new AuroraColorToken('colors.tertiary', { description: "Accent for contrasting accents." });
const onTertiary = new AuroraColorToken('colors.onTertiary', { description: "Text and icons on tertiary." });
const tertiaryContainer = new AuroraColorToken('colors.tertiaryContainer', { description: "Lower-emphasis container for contrasting accents." });
const onTertiaryContainer = new AuroraColorToken('colors.onTertiaryContainer', { description: "Text and icons on tertiaryContainer." });
const tertiaryFixed = new AuroraColorToken('colors.tertiaryFixed', { description: "Container accent that stays constant across appearances." });
const tertiaryFixedDim = new AuroraColorToken('colors.tertiaryFixedDim', { description: "Stronger fixed tertiary accent." });
const onTertiaryFixed = new AuroraColorToken('colors.onTertiaryFixed', { description: "Text and icons on fixed tertiary accents." });
const onTertiaryFixedVariant = new AuroraColorToken('colors.onTertiaryFixedVariant', { description: "Lower-emphasis content on fixed tertiary accents." });
const error = new AuroraColorToken('colors.error', { description: "Error and destructive feedback." });
const onError = new AuroraColorToken('colors.onError', { description: "Text and icons on error." });
const errorContainer = new AuroraColorToken('colors.errorContainer', { description: "Lower-emphasis error container." });
const onErrorContainer = new AuroraColorToken('colors.onErrorContainer', { description: "Text and icons on errorContainer." });
const surface = new AuroraColorToken('colors.surface', { description: "Default page and component surface." });
const onSurface = new AuroraColorToken('colors.onSurface', { description: "Primary text and icons on surfaces." });
const surfaceDim = new AuroraColorToken('colors.surfaceDim', { description: "Dimmest surface tone." });
const surfaceBright = new AuroraColorToken('colors.surfaceBright', { description: "Brightest surface tone." });
const surfaceContainerLowest = new AuroraColorToken('colors.surfaceContainerLowest', { description: "Lowest surface container level." });
const surfaceContainerLow = new AuroraColorToken('colors.surfaceContainerLow', { description: "Low surface container level." });
const surfaceContainer = new AuroraColorToken('colors.surfaceContainer', { description: "Default distinct surface container." });
const surfaceContainerHigh = new AuroraColorToken('colors.surfaceContainerHigh', { description: "High surface container level." });
const surfaceContainerHighest = new AuroraColorToken('colors.surfaceContainerHighest', { description: "Highest surface container level." });
const onSurfaceVariant = new AuroraColorToken('colors.onSurfaceVariant', { description: "Lower-emphasis text and icons on surfaces." });
const outline = new AuroraColorToken('colors.outline', { description: "Boundaries requiring emphasis." });
const outlineVariant = new AuroraColorToken('colors.outlineVariant', { description: "Subtle decorative boundaries and dividers." });
const shadow = new AuroraColorToken('colors.shadow', { description: "Color of cast shadows." });
const scrim = new AuroraColorToken('colors.scrim', { description: "Color of obscuring modal overlays." });
const inverseSurface = new AuroraColorToken('colors.inverseSurface', { description: "Surface contrasting with surrounding appearance." });
const onInverseSurface = new AuroraColorToken('colors.onInverseSurface', { description: "Text and icons on inverseSurface." });
const inversePrimary = new AuroraColorToken('colors.inversePrimary', { description: "Primary accent on inverseSurface." });
const surfaceTint = new AuroraColorToken('colors.surfaceTint', { description: "Accent used by Material surface tint treatments." });
const success = new AuroraColorToken('colors.success', { description: "Success feedback." });
const onSuccess = new AuroraColorToken('colors.onSuccess', { description: "Text and icons on success." });
const successContainer = new AuroraColorToken('colors.successContainer', { description: "Lower-emphasis success container." });
const onSuccessContainer = new AuroraColorToken('colors.onSuccessContainer', { description: "Text and icons on successContainer." });
const warning = new AuroraColorToken('colors.warning', { description: "Warning feedback." });
const onWarning = new AuroraColorToken('colors.onWarning', { description: "Text and icons on warning." });
const warningContainer = new AuroraColorToken('colors.warningContainer', { description: "Lower-emphasis warning container." });
const onWarningContainer = new AuroraColorToken('colors.onWarningContainer', { description: "Text and icons on warningContainer." });
const info = new AuroraColorToken('colors.info', { description: "Info feedback." });
const onInfo = new AuroraColorToken('colors.onInfo', { description: "Text and icons on info." });
const infoContainer = new AuroraColorToken('colors.infoContainer', { description: "Lower-emphasis info container." });
const onInfoContainer = new AuroraColorToken('colors.onInfoContainer', { description: "Text and icons on infoContainer." });
/** Aurora foundation v1: current Material color roles plus status roles. */
export const AuroraFoundation = Object.freeze({
    version: 1,
    primary,
    onPrimary,
    primaryContainer,
    onPrimaryContainer,
    primaryFixed,
    primaryFixedDim,
    onPrimaryFixed,
    onPrimaryFixedVariant,
    secondary,
    onSecondary,
    secondaryContainer,
    onSecondaryContainer,
    secondaryFixed,
    secondaryFixedDim,
    onSecondaryFixed,
    onSecondaryFixedVariant,
    tertiary,
    onTertiary,
    tertiaryContainer,
    onTertiaryContainer,
    tertiaryFixed,
    tertiaryFixedDim,
    onTertiaryFixed,
    onTertiaryFixedVariant,
    error,
    onError,
    errorContainer,
    onErrorContainer,
    surface,
    onSurface,
    surfaceDim,
    surfaceBright,
    surfaceContainerLowest,
    surfaceContainerLow,
    surfaceContainer,
    surfaceContainerHigh,
    surfaceContainerHighest,
    onSurfaceVariant,
    outline,
    outlineVariant,
    shadow,
    scrim,
    inverseSurface,
    onInverseSurface,
    inversePrimary,
    surfaceTint,
    success,
    onSuccess,
    successContainer,
    onSuccessContainer,
    warning,
    onWarning,
    warningContainer,
    onWarningContainer,
    info,
    onInfo,
    infoContainer,
    onInfoContainer,
    tokens: Object.freeze([
        primary,
        onPrimary,
        primaryContainer,
        onPrimaryContainer,
        primaryFixed,
        primaryFixedDim,
        onPrimaryFixed,
        onPrimaryFixedVariant,
        secondary,
        onSecondary,
        secondaryContainer,
        onSecondaryContainer,
        secondaryFixed,
        secondaryFixedDim,
        onSecondaryFixed,
        onSecondaryFixedVariant,
        tertiary,
        onTertiary,
        tertiaryContainer,
        onTertiaryContainer,
        tertiaryFixed,
        tertiaryFixedDim,
        onTertiaryFixed,
        onTertiaryFixedVariant,
        error,
        onError,
        errorContainer,
        onErrorContainer,
        surface,
        onSurface,
        surfaceDim,
        surfaceBright,
        surfaceContainerLowest,
        surfaceContainerLow,
        surfaceContainer,
        surfaceContainerHigh,
        surfaceContainerHighest,
        onSurfaceVariant,
        outline,
        outlineVariant,
        shadow,
        scrim,
        inverseSurface,
        onInverseSurface,
        inversePrimary,
        surfaceTint,
        success,
        onSuccess,
        successContainer,
        onSuccessContainer,
        warning,
        onWarning,
        warningContainer,
        onWarningContainer,
        info,
        onInfo,
        infoContainer,
        onInfoContainer,
    ]),
});
/** Direct immutable values for the entire app contract. No global active theme. */
export class AuroraTokens {
    variant;
    constructor(variant) {
        this.variant = variant;
    }
    read(token) {
        return this.variant.read(token);
    }
    /** Accent for prominent actions. */
    get primary() {
        return this.variant.read(primary);
    }
    /** Text and icons on primary. */
    get onPrimary() {
        return this.variant.read(onPrimary);
    }
    /** Lower-emphasis container for prominent actions. */
    get primaryContainer() {
        return this.variant.read(primaryContainer);
    }
    /** Text and icons on primaryContainer. */
    get onPrimaryContainer() {
        return this.variant.read(onPrimaryContainer);
    }
    /** Container accent that stays constant across appearances. */
    get primaryFixed() {
        return this.variant.read(primaryFixed);
    }
    /** Stronger fixed primary accent. */
    get primaryFixedDim() {
        return this.variant.read(primaryFixedDim);
    }
    /** Text and icons on fixed primary accents. */
    get onPrimaryFixed() {
        return this.variant.read(onPrimaryFixed);
    }
    /** Lower-emphasis content on fixed primary accents. */
    get onPrimaryFixedVariant() {
        return this.variant.read(onPrimaryFixedVariant);
    }
    /** Accent for less prominent actions. */
    get secondary() {
        return this.variant.read(secondary);
    }
    /** Text and icons on secondary. */
    get onSecondary() {
        return this.variant.read(onSecondary);
    }
    /** Lower-emphasis container for less prominent actions. */
    get secondaryContainer() {
        return this.variant.read(secondaryContainer);
    }
    /** Text and icons on secondaryContainer. */
    get onSecondaryContainer() {
        return this.variant.read(onSecondaryContainer);
    }
    /** Container accent that stays constant across appearances. */
    get secondaryFixed() {
        return this.variant.read(secondaryFixed);
    }
    /** Stronger fixed secondary accent. */
    get secondaryFixedDim() {
        return this.variant.read(secondaryFixedDim);
    }
    /** Text and icons on fixed secondary accents. */
    get onSecondaryFixed() {
        return this.variant.read(onSecondaryFixed);
    }
    /** Lower-emphasis content on fixed secondary accents. */
    get onSecondaryFixedVariant() {
        return this.variant.read(onSecondaryFixedVariant);
    }
    /** Accent for contrasting accents. */
    get tertiary() {
        return this.variant.read(tertiary);
    }
    /** Text and icons on tertiary. */
    get onTertiary() {
        return this.variant.read(onTertiary);
    }
    /** Lower-emphasis container for contrasting accents. */
    get tertiaryContainer() {
        return this.variant.read(tertiaryContainer);
    }
    /** Text and icons on tertiaryContainer. */
    get onTertiaryContainer() {
        return this.variant.read(onTertiaryContainer);
    }
    /** Container accent that stays constant across appearances. */
    get tertiaryFixed() {
        return this.variant.read(tertiaryFixed);
    }
    /** Stronger fixed tertiary accent. */
    get tertiaryFixedDim() {
        return this.variant.read(tertiaryFixedDim);
    }
    /** Text and icons on fixed tertiary accents. */
    get onTertiaryFixed() {
        return this.variant.read(onTertiaryFixed);
    }
    /** Lower-emphasis content on fixed tertiary accents. */
    get onTertiaryFixedVariant() {
        return this.variant.read(onTertiaryFixedVariant);
    }
    /** Error and destructive feedback. */
    get error() {
        return this.variant.read(error);
    }
    /** Text and icons on error. */
    get onError() {
        return this.variant.read(onError);
    }
    /** Lower-emphasis error container. */
    get errorContainer() {
        return this.variant.read(errorContainer);
    }
    /** Text and icons on errorContainer. */
    get onErrorContainer() {
        return this.variant.read(onErrorContainer);
    }
    /** Default page and component surface. */
    get surface() {
        return this.variant.read(surface);
    }
    /** Primary text and icons on surfaces. */
    get onSurface() {
        return this.variant.read(onSurface);
    }
    /** Dimmest surface tone. */
    get surfaceDim() {
        return this.variant.read(surfaceDim);
    }
    /** Brightest surface tone. */
    get surfaceBright() {
        return this.variant.read(surfaceBright);
    }
    /** Lowest surface container level. */
    get surfaceContainerLowest() {
        return this.variant.read(surfaceContainerLowest);
    }
    /** Low surface container level. */
    get surfaceContainerLow() {
        return this.variant.read(surfaceContainerLow);
    }
    /** Default distinct surface container. */
    get surfaceContainer() {
        return this.variant.read(surfaceContainer);
    }
    /** High surface container level. */
    get surfaceContainerHigh() {
        return this.variant.read(surfaceContainerHigh);
    }
    /** Highest surface container level. */
    get surfaceContainerHighest() {
        return this.variant.read(surfaceContainerHighest);
    }
    /** Lower-emphasis text and icons on surfaces. */
    get onSurfaceVariant() {
        return this.variant.read(onSurfaceVariant);
    }
    /** Boundaries requiring emphasis. */
    get outline() {
        return this.variant.read(outline);
    }
    /** Subtle decorative boundaries and dividers. */
    get outlineVariant() {
        return this.variant.read(outlineVariant);
    }
    /** Color of cast shadows. */
    get shadow() {
        return this.variant.read(shadow);
    }
    /** Color of obscuring modal overlays. */
    get scrim() {
        return this.variant.read(scrim);
    }
    /** Surface contrasting with surrounding appearance. */
    get inverseSurface() {
        return this.variant.read(inverseSurface);
    }
    /** Text and icons on inverseSurface. */
    get onInverseSurface() {
        return this.variant.read(onInverseSurface);
    }
    /** Primary accent on inverseSurface. */
    get inversePrimary() {
        return this.variant.read(inversePrimary);
    }
    /** Accent used by Material surface tint treatments. */
    get surfaceTint() {
        return this.variant.read(surfaceTint);
    }
    /** Success feedback. */
    get success() {
        return this.variant.read(success);
    }
    /** Text and icons on success. */
    get onSuccess() {
        return this.variant.read(onSuccess);
    }
    /** Lower-emphasis success container. */
    get successContainer() {
        return this.variant.read(successContainer);
    }
    /** Text and icons on successContainer. */
    get onSuccessContainer() {
        return this.variant.read(onSuccessContainer);
    }
    /** Warning feedback. */
    get warning() {
        return this.variant.read(warning);
    }
    /** Text and icons on warning. */
    get onWarning() {
        return this.variant.read(onWarning);
    }
    /** Lower-emphasis warning container. */
    get warningContainer() {
        return this.variant.read(warningContainer);
    }
    /** Text and icons on warningContainer. */
    get onWarningContainer() {
        return this.variant.read(onWarningContainer);
    }
    /** Info feedback. */
    get info() {
        return this.variant.read(info);
    }
    /** Text and icons on info. */
    get onInfo() {
        return this.variant.read(onInfo);
    }
    /** Lower-emphasis info container. */
    get infoContainer() {
        return this.variant.read(infoContainer);
    }
    /** Text and icons on infoContainer. */
    get onInfoContainer() {
        return this.variant.read(onInfoContainer);
    }
}
