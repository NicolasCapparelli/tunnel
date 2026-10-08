import { Hct } from './hct.js';
import { TonalPalette } from './palette.js';
export declare enum Variant {
    monochrome = "monochrome",
    neutral = "neutral",
    tonalSpot = "tonalSpot",
    vibrant = "vibrant",
    expressive = "expressive",
    content = "content",
    fidelity = "fidelity",
    rainbow = "rainbow",
    fruitSalad = "fruitSalad"
}
export declare class ContrastCurve {
    readonly low: number;
    readonly normal: number;
    readonly medium: number;
    readonly high: number;
    constructor(low: number, normal: number, medium: number, high: number);
    get(contrastLevel: number): number;
}
export declare enum TonePolarity {
    darker = 0,
    lighter = 1,
    nearer = 2,
    farther = 3
}
export declare class ToneDeltaPair {
    readonly roleA: DynamicColor;
    readonly roleB: DynamicColor;
    readonly delta: number;
    readonly polarity: TonePolarity;
    readonly stayTogether: boolean;
    constructor(roleA: DynamicColor, roleB: DynamicColor, delta: number, polarity: TonePolarity, stayTogether: boolean);
}
interface DynamicColorOptions {
    name: string;
    palette: (s: DynamicScheme) => TonalPalette;
    tone: (s: DynamicScheme) => number;
    isBackground?: boolean;
    background?: (s: DynamicScheme) => DynamicColor;
    secondBackground?: (s: DynamicScheme) => DynamicColor;
    contrastCurve?: ContrastCurve;
    toneDeltaPair?: (s: DynamicScheme) => ToneDeltaPair;
}
export declare class DynamicColor {
    readonly name: string;
    readonly palette: (s: DynamicScheme) => TonalPalette;
    readonly tone: (s: DynamicScheme) => number;
    readonly isBackground: boolean;
    readonly background: ((s: DynamicScheme) => DynamicColor) | undefined;
    readonly secondBackground: ((s: DynamicScheme) => DynamicColor) | undefined;
    readonly contrastCurve: ContrastCurve | undefined;
    readonly toneDeltaPair: ((s: DynamicScheme) => ToneDeltaPair) | undefined;
    constructor(options: DynamicColorOptions);
    getArgb(scheme: DynamicScheme): number;
    getHct(scheme: DynamicScheme): Hct;
    getTone(scheme: DynamicScheme): number;
    static foregroundTone(bgTone: number, ratio: number): number;
    static enableLightForeground(tone: number): number;
    static tonePrefersLightForeground(tone: number): boolean;
    static toneAllowsLightForeground(tone: number): boolean;
}
export interface DynamicSchemeOptions {
    sourceColorArgb: number;
    variant: Variant;
    contrastLevel?: number;
    isDark: boolean;
    primaryPalette: TonalPalette;
    secondaryPalette: TonalPalette;
    tertiaryPalette: TonalPalette;
    neutralPalette: TonalPalette;
    neutralVariantPalette: TonalPalette;
}
export declare class DynamicScheme {
    readonly sourceColorArgb: number;
    readonly sourceColorHct: Hct;
    readonly variant: Variant;
    readonly isDark: boolean;
    readonly contrastLevel: number;
    readonly primaryPalette: TonalPalette;
    readonly secondaryPalette: TonalPalette;
    readonly tertiaryPalette: TonalPalette;
    readonly neutralPalette: TonalPalette;
    readonly neutralVariantPalette: TonalPalette;
    readonly errorPalette: TonalPalette;
    constructor(options: DynamicSchemeOptions);
    static getRotatedHue(sourceColor: Hct, hues: readonly number[], rotations: readonly number[]): number;
    getArgb(dynamicColor: DynamicColor): number;
    get surface(): number;
    get surfaceDim(): number;
    get surfaceBright(): number;
    get surfaceContainerLowest(): number;
    get surfaceContainerLow(): number;
    get surfaceContainer(): number;
    get surfaceContainerHigh(): number;
    get surfaceContainerHighest(): number;
    get onSurface(): number;
    get surfaceVariant(): number;
    get onSurfaceVariant(): number;
    get inverseSurface(): number;
    get inverseOnSurface(): number;
    get outline(): number;
    get outlineVariant(): number;
    get shadow(): number;
    get scrim(): number;
    get surfaceTint(): number;
    get primary(): number;
    get onPrimary(): number;
    get primaryContainer(): number;
    get onPrimaryContainer(): number;
    get inversePrimary(): number;
    get secondary(): number;
    get onSecondary(): number;
    get secondaryContainer(): number;
    get onSecondaryContainer(): number;
    get tertiary(): number;
    get onTertiary(): number;
    get tertiaryContainer(): number;
    get onTertiaryContainer(): number;
    get error(): number;
    get onError(): number;
    get errorContainer(): number;
    get onErrorContainer(): number;
    get primaryFixed(): number;
    get primaryFixedDim(): number;
    get onPrimaryFixed(): number;
    get onPrimaryFixedVariant(): number;
    get secondaryFixed(): number;
    get secondaryFixedDim(): number;
    get onSecondaryFixed(): number;
    get onSecondaryFixedVariant(): number;
    get tertiaryFixed(): number;
    get tertiaryFixedDim(): number;
    get onTertiaryFixed(): number;
    get onTertiaryFixedVariant(): number;
}
export declare function isDisliked(hct: Hct): boolean;
export declare function fixIfDisliked(hct: Hct): Hct;
/** Material dynamic colour roles, keyed by MCU getter name. */
export declare const MaterialDynamicColors: Readonly<Record<string, DynamicColor>>;
export declare class TemperatureCache {
    readonly input: Hct;
    private _hctsByTemp;
    private _hctsByHue;
    private _tempsByArgb;
    private _inputRelativeTemperature;
    private _complement;
    constructor(input: Hct);
    get warmest(): Hct;
    get coldest(): Hct;
    private temp;
    analogous(count?: number, divisions?: number): Hct[];
    get complement(): Hct;
    relativeTemperature(hct: Hct): number;
    get inputRelativeTemperature(): number;
    get hctsByTemp(): Hct[];
    /** Dart keys this map by Hct, whose equality is its ARGB value. */
    get tempsByArgb(): Map<number, number>;
    get hctsByHue(): Hct[];
    static isBetween(angle: number, a: number, b: number): boolean;
    static rawTemperature(color: Hct): number;
}
/** The MCU `Scheme<Variant>(sourceColorHct:, isDark:, contrastLevel:)` constructors. */
export declare function schemeFor(variant: Variant, sourceColorHct: Hct, isDark: boolean, contrastLevel: number): DynamicScheme;
export {};
