import { AuroraCubicBezierToken, AuroraDimensionToken, AuroraDurationToken, AuroraFontFamilyToken, AuroraTypographyToken, type AuroraToken } from './token.js';
/**
 * Aurora texture foundation v1: the Material 3 baseline type scale, corner
 * shapes and motion. Every texture supplies these; apps add their own tokens as
 * texture contract extensions. The `type`, `shape` and `motion` namespaces are
 * reserved.
 */
export declare const AuroraTextureFoundation: Readonly<{
    version: 1;
    namespaces: readonly string[];
    brandFamily: AuroraFontFamilyToken;
    plainFamily: AuroraFontFamilyToken;
    displayLarge: AuroraTypographyToken;
    displayMedium: AuroraTypographyToken;
    displaySmall: AuroraTypographyToken;
    headlineLarge: AuroraTypographyToken;
    headlineMedium: AuroraTypographyToken;
    headlineSmall: AuroraTypographyToken;
    titleLarge: AuroraTypographyToken;
    titleMedium: AuroraTypographyToken;
    titleSmall: AuroraTypographyToken;
    bodyLarge: AuroraTypographyToken;
    bodyMedium: AuroraTypographyToken;
    bodySmall: AuroraTypographyToken;
    labelLarge: AuroraTypographyToken;
    labelMedium: AuroraTypographyToken;
    labelSmall: AuroraTypographyToken;
    extraSmallShape: AuroraDimensionToken;
    smallShape: AuroraDimensionToken;
    mediumShape: AuroraDimensionToken;
    largeShape: AuroraDimensionToken;
    extraLargeShape: AuroraDimensionToken;
    shortDuration: AuroraDurationToken;
    mediumDuration: AuroraDurationToken;
    longDuration: AuroraDurationToken;
    extraLongDuration: AuroraDurationToken;
    easingStandard: AuroraCubicBezierToken;
    easingEmphasizedDecelerate: AuroraCubicBezierToken;
    easingEmphasizedAccelerate: AuroraCubicBezierToken;
    tokens: readonly AuroraToken<unknown>[];
}>;
/** Material 3 baseline values for every texture foundation token. */
export declare const auroraMaterialTextureValues: ReadonlyMap<AuroraToken<unknown>, unknown>;
