// @aurora/core: the portable Aurora core. No DOM, React or Node APIs.
export { AuroraArgumentError, AuroraError, AuroraFormatError, AuroraStateError, AuroraValidationError, } from './errors.js';
export { AuroraColor, isAuroraColor } from './color.js';
export { AuroraBooleanToken, AuroraBorderToken, AuroraColorToken, AuroraCubicBezierToken, AuroraDimensionToken, AuroraDurationToken, AuroraEnumToken, AuroraFontFamilyToken, AuroraFontWeightToken, AuroraNumberToken, AuroraShadowToken, AuroraStrokeStyleToken, AuroraToken, AuroraTypographyToken, } from './token.js';
export { AuroraAlias, AuroraLiteral, isAlias, isLiteral, resolvedRef } from './ref.js';
export { AURORA_STROKE_KEYWORDS, AuroraBorder, AuroraCubicBezier, AuroraDimension, AuroraDuration, AuroraFontFamily, AuroraFontWeight, AuroraShadow, AuroraShadowLayer, AuroraStrokeStyle, AuroraTypography, isKind, } from './values.js';
export { AuroraContract } from './contract.js';
export { AuroraFoundation, AuroraTokens } from './foundation.js';
export { AURORA_APPEARANCES, AuroraStarter, AuroraTheme, AuroraThemeVariant, parseAppearancePreference, } from './theme.js';
export { AuroraSelection, AuroraRuntime, AuroraState, } from './runtime.js';
export { AuroraContrast, AuroraContrastCheck, AuroraContrastPair, } from './contrast.js';
export { AuroraDtcg } from './dtcg.js';
export { AURORA_GENERATION_SCHEMES, AURORA_PALETTES, AuroraAliasRule, AuroraGenerationRequest, AuroraGenerationResult, AuroraGenerator, AuroraToneRule, } from './generator.js';
export { AuroraRecipe } from './recipe.js';
export { AuroraTextureFoundation } from './textureFoundation.js';
export { AuroraTexture, AuroraTextureContract, AuroraTextureStarter, resolveTextureColor, } from './texture.js';
export { AuroraTextureDtcg } from './textureDtcg.js';
export { AuroraTextureRecipe } from './textureRecipe.js';
export { AuroraBundle, } from './bundle.js';
