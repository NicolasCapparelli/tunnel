// Ported from material_color_utilities 0.11.1 (Dart): dynamiccolor/*,
// dislike/dislike_analyzer.dart, temperature/temperature_cache.dart and the
// scheme/scheme_*.dart variants used by Aurora. Copyright 2021-2023 Google LLC.
// Apache-2.0; see LICENSE-material-color-utilities and NOTICE.md in this package.
//
// Aurora pins this exact algorithm (aurora-*-v1-mcu-0.11.1). Do not update it
// from newer MCU releases: their colour specs produce different values.
import { Hct } from './hct.js';
import { Contrast, TonalPalette } from './palette.js';
import * as utils from './utils.js';
export var Variant;
(function (Variant) {
    Variant["monochrome"] = "monochrome";
    Variant["neutral"] = "neutral";
    Variant["tonalSpot"] = "tonalSpot";
    Variant["vibrant"] = "vibrant";
    Variant["expressive"] = "expressive";
    Variant["content"] = "content";
    Variant["fidelity"] = "fidelity";
    Variant["rainbow"] = "rainbow";
    Variant["fruitSalad"] = "fruitSalad";
})(Variant || (Variant = {}));
export class ContrastCurve {
    low;
    normal;
    medium;
    high;
    constructor(low, normal, medium, high) {
        this.low = low;
        this.normal = normal;
        this.medium = medium;
        this.high = high;
    }
    get(contrastLevel) {
        if (contrastLevel <= -1.0)
            return this.low;
        if (contrastLevel < 0.0)
            return utils.lerp(this.low, this.normal, (contrastLevel - -1) / 1);
        if (contrastLevel < 0.5)
            return utils.lerp(this.normal, this.medium, (contrastLevel - 0) / 0.5);
        if (contrastLevel < 1.0)
            return utils.lerp(this.medium, this.high, (contrastLevel - 0.5) / 0.5);
        return this.high;
    }
}
export var TonePolarity;
(function (TonePolarity) {
    TonePolarity[TonePolarity["darker"] = 0] = "darker";
    TonePolarity[TonePolarity["lighter"] = 1] = "lighter";
    TonePolarity[TonePolarity["nearer"] = 2] = "nearer";
    TonePolarity[TonePolarity["farther"] = 3] = "farther";
})(TonePolarity || (TonePolarity = {}));
export class ToneDeltaPair {
    roleA;
    roleB;
    delta;
    polarity;
    stayTogether;
    constructor(roleA, roleB, delta, polarity, stayTogether) {
        this.roleA = roleA;
        this.roleB = roleB;
        this.delta = delta;
        this.polarity = polarity;
        this.stayTogether = stayTogether;
    }
}
export class DynamicColor {
    name;
    palette;
    tone;
    isBackground;
    background;
    secondBackground;
    contrastCurve;
    toneDeltaPair;
    constructor(options) {
        this.name = options.name;
        this.palette = options.palette;
        this.tone = options.tone;
        this.isBackground = options.isBackground ?? false;
        this.background = options.background;
        this.secondBackground = options.secondBackground;
        this.contrastCurve = options.contrastCurve;
        this.toneDeltaPair = options.toneDeltaPair;
    }
    getArgb(scheme) {
        return this.getHct(scheme).toInt();
    }
    getHct(scheme) {
        return this.palette(scheme).getHct(this.getTone(scheme));
    }
    getTone(scheme) {
        const decreasingContrast = scheme.contrastLevel < 0;
        if (this.toneDeltaPair !== undefined) {
            const pair = this.toneDeltaPair(scheme);
            const { roleA, roleB, delta, polarity, stayTogether } = pair;
            const bg = this.background(scheme);
            const bgTone = bg.getTone(scheme);
            const aIsNearer = polarity === TonePolarity.nearer ||
                (polarity === TonePolarity.lighter && !scheme.isDark) ||
                (polarity === TonePolarity.darker && scheme.isDark);
            const nearer = aIsNearer ? roleA : roleB;
            const farther = aIsNearer ? roleB : roleA;
            const amNearer = this.name === nearer.name;
            const expansionDir = scheme.isDark ? 1 : -1;
            const nContrast = nearer.contrastCurve.get(scheme.contrastLevel);
            const fContrast = farther.contrastCurve.get(scheme.contrastLevel);
            const nInitialTone = nearer.tone(scheme);
            let nTone = Contrast.ratioOfTones(bgTone, nInitialTone) >= nContrast
                ? nInitialTone
                : DynamicColor.foregroundTone(bgTone, nContrast);
            const fInitialTone = farther.tone(scheme);
            let fTone = Contrast.ratioOfTones(bgTone, fInitialTone) >= fContrast
                ? fInitialTone
                : DynamicColor.foregroundTone(bgTone, fContrast);
            if (decreasingContrast) {
                nTone = DynamicColor.foregroundTone(bgTone, nContrast);
                fTone = DynamicColor.foregroundTone(bgTone, fContrast);
            }
            if ((fTone - nTone) * expansionDir >= delta) {
                // Good: tones are far enough apart.
            }
            else {
                fTone = utils.clampDouble(0, 100, nTone + delta * expansionDir);
                if ((fTone - nTone) * expansionDir >= delta) {
                    // Good after moving the farther tone.
                }
                else {
                    nTone = utils.clampDouble(0, 100, fTone - delta * expansionDir);
                }
            }
            if (50 <= nTone && nTone < 60) {
                if (expansionDir > 0) {
                    nTone = 60;
                    fTone = Math.max(fTone, nTone + delta * expansionDir);
                }
                else {
                    nTone = 49;
                    fTone = Math.min(fTone, nTone + delta * expansionDir);
                }
            }
            else if (50 <= fTone && fTone < 60) {
                if (stayTogether) {
                    if (expansionDir > 0) {
                        nTone = 60;
                        fTone = Math.max(fTone, nTone + delta * expansionDir);
                    }
                    else {
                        nTone = 49;
                        fTone = Math.min(fTone, nTone + delta * expansionDir);
                    }
                }
                else {
                    fTone = expansionDir > 0 ? 60 : 49;
                }
            }
            return amNearer ? nTone : fTone;
        }
        let answer = this.tone(scheme);
        if (this.background === undefined)
            return answer;
        const bgTone = this.background(scheme).getTone(scheme);
        const desiredRatio = this.contrastCurve.get(scheme.contrastLevel);
        if (Contrast.ratioOfTones(bgTone, answer) < desiredRatio) {
            answer = DynamicColor.foregroundTone(bgTone, desiredRatio);
        }
        if (decreasingContrast) {
            answer = DynamicColor.foregroundTone(bgTone, desiredRatio);
        }
        if (this.isBackground && 50 <= answer && answer < 60) {
            answer = Contrast.ratioOfTones(49, bgTone) >= desiredRatio ? 49 : 60;
        }
        if (this.secondBackground !== undefined) {
            const bgTone1 = this.background(scheme).getTone(scheme);
            const bgTone2 = this.secondBackground(scheme).getTone(scheme);
            const upper = Math.max(bgTone1, bgTone2);
            const lower = Math.min(bgTone1, bgTone2);
            if (Contrast.ratioOfTones(upper, answer) >= desiredRatio &&
                Contrast.ratioOfTones(lower, answer) >= desiredRatio) {
                return answer;
            }
            const lightOption = Contrast.lighter(upper, desiredRatio);
            const darkOption = Contrast.darker(lower, desiredRatio);
            const availables = [];
            if (lightOption !== -1)
                availables.push(lightOption);
            if (darkOption !== -1)
                availables.push(darkOption);
            const prefersLight = DynamicColor.tonePrefersLightForeground(bgTone1) || DynamicColor.tonePrefersLightForeground(bgTone2);
            if (prefersLight)
                return lightOption < 0 ? 100 : lightOption;
            if (availables.length === 1)
                return availables[0];
            return darkOption < 0 ? 0 : darkOption;
        }
        return answer;
    }
    static foregroundTone(bgTone, ratio) {
        const lighterTone = Contrast.lighterUnsafe(bgTone, ratio);
        const darkerTone = Contrast.darkerUnsafe(bgTone, ratio);
        const lighterRatio = Contrast.ratioOfTones(lighterTone, bgTone);
        const darkerRatio = Contrast.ratioOfTones(darkerTone, bgTone);
        if (DynamicColor.tonePrefersLightForeground(bgTone)) {
            const negligibleDifference = Math.abs(lighterRatio - darkerRatio) < 0.1 && lighterRatio < ratio && darkerRatio < ratio;
            return lighterRatio >= ratio || lighterRatio >= darkerRatio || negligibleDifference ? lighterTone : darkerTone;
        }
        return darkerRatio >= ratio || darkerRatio >= lighterRatio ? darkerTone : lighterTone;
    }
    static enableLightForeground(tone) {
        if (DynamicColor.tonePrefersLightForeground(tone) && !DynamicColor.toneAllowsLightForeground(tone)) {
            return 49.0;
        }
        return tone;
    }
    static tonePrefersLightForeground(tone) {
        return utils.dartRound(tone) < 60;
    }
    static toneAllowsLightForeground(tone) {
        return utils.dartRound(tone) <= 49;
    }
}
export class DynamicScheme {
    sourceColorArgb;
    sourceColorHct;
    variant;
    isDark;
    contrastLevel;
    primaryPalette;
    secondaryPalette;
    tertiaryPalette;
    neutralPalette;
    neutralVariantPalette;
    errorPalette;
    constructor(options) {
        this.sourceColorArgb = options.sourceColorArgb >>> 0;
        this.variant = options.variant;
        this.contrastLevel = options.contrastLevel ?? 0.0;
        this.isDark = options.isDark;
        this.primaryPalette = options.primaryPalette;
        this.secondaryPalette = options.secondaryPalette;
        this.tertiaryPalette = options.tertiaryPalette;
        this.neutralPalette = options.neutralPalette;
        this.neutralVariantPalette = options.neutralVariantPalette;
        this.sourceColorHct = Hct.fromInt(this.sourceColorArgb);
        this.errorPalette = TonalPalette.of(25.0, 84.0);
    }
    static getRotatedHue(sourceColor, hues, rotations) {
        const sourceHue = sourceColor.hue;
        if (rotations.length === 1) {
            return utils.sanitizeDegreesDouble(sourceColor.hue + rotations[0]);
        }
        const size = hues.length;
        for (let i = 0; i <= size - 2; i++) {
            const thisHue = hues[i];
            const nextHue = hues[i + 1];
            if (thisHue < sourceHue && sourceHue < nextHue) {
                return utils.sanitizeDegreesDouble(sourceHue + rotations[i]);
            }
        }
        return sourceHue;
    }
    getArgb(dynamicColor) {
        return dynamicColor.getArgb(this);
    }
    get surface() { return this.getArgb(role('surface')); }
    get surfaceDim() { return this.getArgb(role('surfaceDim')); }
    get surfaceBright() { return this.getArgb(role('surfaceBright')); }
    get surfaceContainerLowest() { return this.getArgb(role('surfaceContainerLowest')); }
    get surfaceContainerLow() { return this.getArgb(role('surfaceContainerLow')); }
    get surfaceContainer() { return this.getArgb(role('surfaceContainer')); }
    get surfaceContainerHigh() { return this.getArgb(role('surfaceContainerHigh')); }
    get surfaceContainerHighest() { return this.getArgb(role('surfaceContainerHighest')); }
    get onSurface() { return this.getArgb(role('onSurface')); }
    get surfaceVariant() { return this.getArgb(role('surfaceVariant')); }
    get onSurfaceVariant() { return this.getArgb(role('onSurfaceVariant')); }
    get inverseSurface() { return this.getArgb(role('inverseSurface')); }
    get inverseOnSurface() { return this.getArgb(role('inverseOnSurface')); }
    get outline() { return this.getArgb(role('outline')); }
    get outlineVariant() { return this.getArgb(role('outlineVariant')); }
    get shadow() { return this.getArgb(role('shadow')); }
    get scrim() { return this.getArgb(role('scrim')); }
    get surfaceTint() { return this.getArgb(role('surfaceTint')); }
    get primary() { return this.getArgb(role('primary')); }
    get onPrimary() { return this.getArgb(role('onPrimary')); }
    get primaryContainer() { return this.getArgb(role('primaryContainer')); }
    get onPrimaryContainer() { return this.getArgb(role('onPrimaryContainer')); }
    get inversePrimary() { return this.getArgb(role('inversePrimary')); }
    get secondary() { return this.getArgb(role('secondary')); }
    get onSecondary() { return this.getArgb(role('onSecondary')); }
    get secondaryContainer() { return this.getArgb(role('secondaryContainer')); }
    get onSecondaryContainer() { return this.getArgb(role('onSecondaryContainer')); }
    get tertiary() { return this.getArgb(role('tertiary')); }
    get onTertiary() { return this.getArgb(role('onTertiary')); }
    get tertiaryContainer() { return this.getArgb(role('tertiaryContainer')); }
    get onTertiaryContainer() { return this.getArgb(role('onTertiaryContainer')); }
    get error() { return this.getArgb(role('error')); }
    get onError() { return this.getArgb(role('onError')); }
    get errorContainer() { return this.getArgb(role('errorContainer')); }
    get onErrorContainer() { return this.getArgb(role('onErrorContainer')); }
    get primaryFixed() { return this.getArgb(role('primaryFixed')); }
    get primaryFixedDim() { return this.getArgb(role('primaryFixedDim')); }
    get onPrimaryFixed() { return this.getArgb(role('onPrimaryFixed')); }
    get onPrimaryFixedVariant() { return this.getArgb(role('onPrimaryFixedVariant')); }
    get secondaryFixed() { return this.getArgb(role('secondaryFixed')); }
    get secondaryFixedDim() { return this.getArgb(role('secondaryFixedDim')); }
    get onSecondaryFixed() { return this.getArgb(role('onSecondaryFixed')); }
    get onSecondaryFixedVariant() { return this.getArgb(role('onSecondaryFixedVariant')); }
    get tertiaryFixed() { return this.getArgb(role('tertiaryFixed')); }
    get tertiaryFixedDim() { return this.getArgb(role('tertiaryFixedDim')); }
    get onTertiaryFixed() { return this.getArgb(role('onTertiaryFixed')); }
    get onTertiaryFixedVariant() { return this.getArgb(role('onTertiaryFixedVariant')); }
}
// ---------------------------------------------------------------- dislike
export function isDisliked(hct) {
    const huePasses = utils.dartRound(hct.hue) >= 90.0 && utils.dartRound(hct.hue) <= 111.0;
    const chromaPasses = utils.dartRound(hct.chroma) > 16.0;
    const tonePasses = utils.dartRound(hct.tone) < 65.0;
    return huePasses && chromaPasses && tonePasses;
}
export function fixIfDisliked(hct) {
    return isDisliked(hct) ? Hct.from(hct.hue, hct.chroma, 70.0) : hct;
}
// ---------------------------------------------------------------- material colors
const isFidelity = (s) => s.variant === Variant.fidelity || s.variant === Variant.content;
const isMonochrome = (s) => s.variant === Variant.monochrome;
function findDesiredChromaByTone(hue, chroma, tone, byDecreasingTone) {
    let answer = tone;
    let closestToChroma = Hct.from(hue, chroma, tone);
    if (closestToChroma.chroma < chroma) {
        let chromaPeak = closestToChroma.chroma;
        while (closestToChroma.chroma < chroma) {
            answer += byDecreasingTone ? -1.0 : 1.0;
            const potentialSolution = Hct.from(hue, chroma, answer);
            if (chromaPeak > potentialSolution.chroma)
                break;
            if (Math.abs(potentialSolution.chroma - chroma) < 0.4)
                break;
            const potentialDelta = Math.abs(potentialSolution.chroma - chroma);
            const currentDelta = Math.abs(closestToChroma.chroma - chroma);
            if (potentialDelta < currentDelta)
                closestToChroma = potentialSolution;
            chromaPeak = Math.max(chromaPeak, potentialSolution.chroma);
        }
    }
    return answer;
}
function highestSurface(s) {
    return s.isDark ? M.surfaceBright : M.surfaceDim;
}
const M = {};
M.surface = new DynamicColor({
    name: 'surface',
    palette: (s) => s.neutralPalette,
    tone: (s) => (s.isDark ? 6 : 98),
    isBackground: true,
});
M.surfaceDim = new DynamicColor({
    name: 'surface_dim',
    palette: (s) => s.neutralPalette,
    tone: (s) => (s.isDark ? 6 : new ContrastCurve(87, 87, 80, 75).get(s.contrastLevel)),
    isBackground: true,
});
M.surfaceBright = new DynamicColor({
    name: 'surface_bright',
    palette: (s) => s.neutralPalette,
    tone: (s) => (s.isDark ? new ContrastCurve(24, 24, 29, 34).get(s.contrastLevel) : 98),
    isBackground: true,
});
M['surfaceContainerLowest'] = new DynamicColor({
    name: 'surface_container_lowest',
    palette: (s) => s.neutralPalette,
    tone: (s) => (s.isDark ? new ContrastCurve(4, 4, 2, 0).get(s.contrastLevel) : 100),
    isBackground: true,
});
M['surfaceContainerLow'] = new DynamicColor({
    name: 'surface_container_low',
    palette: (s) => s.neutralPalette,
    tone: (s) => s.isDark
        ? new ContrastCurve(10, 10, 11, 12).get(s.contrastLevel)
        : new ContrastCurve(96, 96, 96, 95).get(s.contrastLevel),
    isBackground: true,
});
M['surfaceContainer'] = new DynamicColor({
    name: 'surface_container',
    palette: (s) => s.neutralPalette,
    tone: (s) => s.isDark
        ? new ContrastCurve(12, 12, 16, 20).get(s.contrastLevel)
        : new ContrastCurve(94, 94, 92, 90).get(s.contrastLevel),
    isBackground: true,
});
M['surfaceContainerHigh'] = new DynamicColor({
    name: 'surface_container_high',
    palette: (s) => s.neutralPalette,
    tone: (s) => s.isDark
        ? new ContrastCurve(17, 17, 21, 25).get(s.contrastLevel)
        : new ContrastCurve(92, 92, 88, 85).get(s.contrastLevel),
    isBackground: true,
});
M['surfaceContainerHighest'] = new DynamicColor({
    name: 'surface_container_highest',
    palette: (s) => s.neutralPalette,
    tone: (s) => s.isDark
        ? new ContrastCurve(22, 22, 26, 30).get(s.contrastLevel)
        : new ContrastCurve(90, 90, 84, 80).get(s.contrastLevel),
    isBackground: true,
});
M['onSurface'] = new DynamicColor({
    name: 'on_surface',
    palette: (s) => s.neutralPalette,
    tone: (s) => (s.isDark ? 90 : 10),
    background: highestSurface,
    contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
});
M['surfaceVariant'] = new DynamicColor({
    name: 'surface_variant',
    palette: (s) => s.neutralVariantPalette,
    tone: (s) => (s.isDark ? 30 : 90),
    isBackground: true,
});
M['onSurfaceVariant'] = new DynamicColor({
    name: 'on_surface_variant',
    palette: (s) => s.neutralVariantPalette,
    tone: (s) => (s.isDark ? 80 : 30),
    background: highestSurface,
    contrastCurve: new ContrastCurve(3, 4.5, 7, 11),
});
M['inverseSurface'] = new DynamicColor({
    name: 'inverse_surface',
    palette: (s) => s.neutralPalette,
    tone: (s) => (s.isDark ? 90 : 20),
});
M['inverseOnSurface'] = new DynamicColor({
    name: 'inverse_on_surface',
    palette: (s) => s.neutralPalette,
    tone: (s) => (s.isDark ? 20 : 95),
    background: () => M['inverseSurface'],
    contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
});
M['outline'] = new DynamicColor({
    name: 'outline',
    palette: (s) => s.neutralVariantPalette,
    tone: (s) => (s.isDark ? 60 : 50),
    background: highestSurface,
    contrastCurve: new ContrastCurve(1.5, 3, 4.5, 7),
});
M['outlineVariant'] = new DynamicColor({
    name: 'outline_variant',
    palette: (s) => s.neutralVariantPalette,
    tone: (s) => (s.isDark ? 30 : 80),
    background: highestSurface,
    contrastCurve: new ContrastCurve(1, 1, 3, 4.5),
});
M['shadow'] = new DynamicColor({ name: 'shadow', palette: (s) => s.neutralPalette, tone: () => 0 });
M['scrim'] = new DynamicColor({ name: 'scrim', palette: (s) => s.neutralPalette, tone: () => 0 });
M['surfaceTint'] = new DynamicColor({
    name: 'surface_tint',
    palette: (s) => s.primaryPalette,
    tone: (s) => (s.isDark ? 80 : 40),
    isBackground: true,
});
const containerPair = (container, role) => () => new ToneDeltaPair(M[container], M[role], 10, TonePolarity.nearer, false);
const fixedPair = (fixed, dim) => () => new ToneDeltaPair(M[fixed], M[dim], 10, TonePolarity.lighter, true);
M['primary'] = new DynamicColor({
    name: 'primary',
    palette: (s) => s.primaryPalette,
    tone: (s) => (isMonochrome(s) ? (s.isDark ? 100 : 0) : s.isDark ? 80 : 40),
    isBackground: true,
    background: highestSurface,
    contrastCurve: new ContrastCurve(3, 4.5, 7, 7),
    toneDeltaPair: containerPair('primaryContainer', 'primary'),
});
M['onPrimary'] = new DynamicColor({
    name: 'on_primary',
    palette: (s) => s.primaryPalette,
    tone: (s) => (isMonochrome(s) ? (s.isDark ? 10 : 90) : s.isDark ? 20 : 100),
    background: () => M['primary'],
    contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
});
M['primaryContainer'] = new DynamicColor({
    name: 'primary_container',
    palette: (s) => s.primaryPalette,
    tone: (s) => {
        if (isFidelity(s))
            return s.sourceColorHct.tone;
        if (isMonochrome(s))
            return s.isDark ? 85 : 25;
        return s.isDark ? 30 : 90;
    },
    isBackground: true,
    background: highestSurface,
    contrastCurve: new ContrastCurve(1, 1, 3, 4.5),
    toneDeltaPair: containerPair('primaryContainer', 'primary'),
});
M['onPrimaryContainer'] = new DynamicColor({
    name: 'on_primary_container',
    palette: (s) => s.primaryPalette,
    tone: (s) => {
        if (isFidelity(s))
            return DynamicColor.foregroundTone(M['primaryContainer'].tone(s), 4.5);
        if (isMonochrome(s))
            return s.isDark ? 0 : 100;
        return s.isDark ? 90 : 10;
    },
    background: () => M['primaryContainer'],
    contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
});
M['inversePrimary'] = new DynamicColor({
    name: 'inverse_primary',
    palette: (s) => s.primaryPalette,
    tone: (s) => (s.isDark ? 40 : 80),
    background: () => M['inverseSurface'],
    contrastCurve: new ContrastCurve(3, 4.5, 7, 7),
});
M['secondary'] = new DynamicColor({
    name: 'secondary',
    palette: (s) => s.secondaryPalette,
    tone: (s) => (s.isDark ? 80 : 40),
    isBackground: true,
    background: highestSurface,
    contrastCurve: new ContrastCurve(3, 4.5, 7, 7),
    toneDeltaPair: containerPair('secondaryContainer', 'secondary'),
});
M['onSecondary'] = new DynamicColor({
    name: 'on_secondary',
    palette: (s) => s.secondaryPalette,
    tone: (s) => (isMonochrome(s) ? (s.isDark ? 10 : 100) : s.isDark ? 20 : 100),
    background: () => M['secondary'],
    contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
});
M['secondaryContainer'] = new DynamicColor({
    name: 'secondary_container',
    palette: (s) => s.secondaryPalette,
    tone: (s) => {
        const initialTone = s.isDark ? 30.0 : 90.0;
        if (isMonochrome(s))
            return s.isDark ? 30 : 85;
        if (!isFidelity(s))
            return initialTone;
        return findDesiredChromaByTone(s.secondaryPalette.hue, s.secondaryPalette.chroma, initialTone, !s.isDark);
    },
    isBackground: true,
    background: highestSurface,
    contrastCurve: new ContrastCurve(1, 1, 3, 4.5),
    toneDeltaPair: containerPair('secondaryContainer', 'secondary'),
});
M['onSecondaryContainer'] = new DynamicColor({
    name: 'on_secondary_container',
    palette: (s) => s.secondaryPalette,
    tone: (s) => {
        if (!isFidelity(s))
            return s.isDark ? 90 : 10;
        return DynamicColor.foregroundTone(M['secondaryContainer'].tone(s), 4.5);
    },
    background: () => M['secondaryContainer'],
    contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
});
M['tertiary'] = new DynamicColor({
    name: 'tertiary',
    palette: (s) => s.tertiaryPalette,
    tone: (s) => (isMonochrome(s) ? (s.isDark ? 90 : 25) : s.isDark ? 80 : 40),
    isBackground: true,
    background: highestSurface,
    contrastCurve: new ContrastCurve(3, 4.5, 7, 7),
    toneDeltaPair: containerPair('tertiaryContainer', 'tertiary'),
});
M['onTertiary'] = new DynamicColor({
    name: 'on_tertiary',
    palette: (s) => s.tertiaryPalette,
    tone: (s) => (isMonochrome(s) ? (s.isDark ? 10 : 90) : s.isDark ? 20 : 100),
    background: () => M['tertiary'],
    contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
});
M['tertiaryContainer'] = new DynamicColor({
    name: 'tertiary_container',
    palette: (s) => s.tertiaryPalette,
    tone: (s) => {
        if (isMonochrome(s))
            return s.isDark ? 60 : 49;
        if (!isFidelity(s))
            return s.isDark ? 30 : 90;
        const proposedHct = s.tertiaryPalette.getHct(s.sourceColorHct.tone);
        return fixIfDisliked(proposedHct).tone;
    },
    isBackground: true,
    background: highestSurface,
    contrastCurve: new ContrastCurve(1, 1, 3, 4.5),
    toneDeltaPair: containerPair('tertiaryContainer', 'tertiary'),
});
M['onTertiaryContainer'] = new DynamicColor({
    name: 'on_tertiary_container',
    palette: (s) => s.tertiaryPalette,
    tone: (s) => {
        if (isMonochrome(s))
            return s.isDark ? 0 : 100;
        if (!isFidelity(s))
            return s.isDark ? 90 : 10;
        return DynamicColor.foregroundTone(M['tertiaryContainer'].tone(s), 4.5);
    },
    background: () => M['tertiaryContainer'],
    contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
});
M['error'] = new DynamicColor({
    name: 'error',
    palette: (s) => s.errorPalette,
    tone: (s) => (s.isDark ? 80 : 40),
    isBackground: true,
    background: highestSurface,
    contrastCurve: new ContrastCurve(3, 4.5, 7, 7),
    toneDeltaPair: containerPair('errorContainer', 'error'),
});
M['onError'] = new DynamicColor({
    name: 'on_error',
    palette: (s) => s.errorPalette,
    tone: (s) => (s.isDark ? 20 : 100),
    background: () => M['error'],
    contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
});
M['errorContainer'] = new DynamicColor({
    name: 'error_container',
    palette: (s) => s.errorPalette,
    tone: (s) => (s.isDark ? 30 : 90),
    isBackground: true,
    background: highestSurface,
    contrastCurve: new ContrastCurve(1, 1, 3, 4.5),
    toneDeltaPair: containerPair('errorContainer', 'error'),
});
M['onErrorContainer'] = new DynamicColor({
    name: 'on_error_container',
    palette: (s) => s.errorPalette,
    tone: (s) => (s.isDark ? 90 : 10),
    background: () => M['errorContainer'],
    contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
});
for (const [family, palette, fixedTone, dimTone, onTone, onVariantTone, monoFixed, monoDim, monoOn, monoOnVariant] of [
    ['primary', (s) => s.primaryPalette, 90.0, 80.0, 10.0, 30.0, 40.0, 30.0, 100.0, 90.0],
    ['secondary', (s) => s.secondaryPalette, 90.0, 80.0, 10.0, 30.0, 80.0, 70.0, 10.0, 25.0],
    ['tertiary', (s) => s.tertiaryPalette, 90.0, 80.0, 10.0, 30.0, 40.0, 30.0, 100.0, 90.0],
]) {
    const cap = family[0].toUpperCase() + family.slice(1);
    M[`${family}Fixed`] = new DynamicColor({
        name: `${family}_fixed`,
        palette,
        tone: (s) => (isMonochrome(s) ? monoFixed : fixedTone),
        isBackground: true,
        background: highestSurface,
        contrastCurve: new ContrastCurve(1, 1, 3, 4.5),
        toneDeltaPair: fixedPair(`${family}Fixed`, `${family}FixedDim`),
    });
    M[`${family}FixedDim`] = new DynamicColor({
        name: `${family}_fixed_dim`,
        palette,
        tone: (s) => (isMonochrome(s) ? monoDim : dimTone),
        isBackground: true,
        background: highestSurface,
        contrastCurve: new ContrastCurve(1, 1, 3, 4.5),
        toneDeltaPair: fixedPair(`${family}Fixed`, `${family}FixedDim`),
    });
    M[`on${cap}Fixed`] = new DynamicColor({
        name: `on_${family}_fixed`,
        palette,
        tone: (s) => (isMonochrome(s) ? monoOn : onTone),
        background: () => M[`${family}FixedDim`],
        secondBackground: () => M[`${family}Fixed`],
        contrastCurve: new ContrastCurve(4.5, 7, 11, 21),
    });
    M[`on${cap}FixedVariant`] = new DynamicColor({
        name: `on_${family}_fixed_variant`,
        palette,
        tone: (s) => (isMonochrome(s) ? monoOnVariant : onVariantTone),
        background: () => M[`${family}FixedDim`],
        secondBackground: () => M[`${family}Fixed`],
        contrastCurve: new ContrastCurve(3, 4.5, 7, 11),
    });
}
/** Material dynamic colour roles, keyed by MCU getter name. */
export const MaterialDynamicColors = M;
function role(name) {
    const color = M[name];
    if (color === undefined)
        throw new Error(`Unknown dynamic colour ${name}`);
    return color;
}
// ---------------------------------------------------------------- temperature
export class TemperatureCache {
    input;
    _hctsByTemp = [];
    _hctsByHue = [];
    _tempsByArgb;
    _inputRelativeTemperature = -1.0;
    _complement;
    constructor(input) {
        this.input = input;
    }
    get warmest() {
        const list = this.hctsByTemp;
        return list[list.length - 1];
    }
    get coldest() {
        return this.hctsByTemp[0];
    }
    temp(hct) {
        return this.tempsByArgb.get(hct.toInt());
    }
    analogous(count = 5, divisions = 12) {
        const startHue = utils.dartRound(this.input.hue);
        const startHct = this.hctsByHue[startHue];
        let lastTemp = this.relativeTemperature(startHct);
        const allColors = [startHct];
        let absoluteTotalTempDelta = 0.0;
        for (let i = 0; i < 360; i++) {
            const hue = utils.sanitizeDegreesInt(startHue + i);
            const hct = this.hctsByHue[hue];
            const temp = this.relativeTemperature(hct);
            absoluteTotalTempDelta += Math.abs(temp - lastTemp);
            lastTemp = temp;
        }
        let hueAddend = 1;
        const tempStep = absoluteTotalTempDelta / divisions;
        let totalTempDelta = 0.0;
        lastTemp = this.relativeTemperature(startHct);
        while (allColors.length < divisions) {
            const hue = utils.sanitizeDegreesInt(startHue + hueAddend);
            const hct = this.hctsByHue[hue];
            const temp = this.relativeTemperature(hct);
            totalTempDelta += Math.abs(temp - lastTemp);
            const desiredTotalTempDeltaForIndex = allColors.length * tempStep;
            let indexSatisfied = totalTempDelta >= desiredTotalTempDeltaForIndex;
            let indexAddend = 1;
            while (indexSatisfied && allColors.length < divisions) {
                allColors.push(hct);
                const desired = (allColors.length + indexAddend) * tempStep;
                indexSatisfied = totalTempDelta >= desired;
                indexAddend++;
            }
            lastTemp = temp;
            hueAddend++;
            if (hueAddend > 360) {
                while (allColors.length < divisions)
                    allColors.push(hct);
                break;
            }
        }
        const answers = [this.input];
        const increaseHueCount = Math.floor((count - 1) / 2.0);
        for (let i = 1; i < increaseHueCount + 1; i++) {
            let index = 0 - i;
            while (index < 0)
                index = allColors.length + index;
            if (index >= allColors.length)
                index = index % allColors.length;
            answers.unshift(allColors[index]);
        }
        const decreaseHueCount = count - increaseHueCount - 1;
        for (let i = 1; i < decreaseHueCount + 1; i++) {
            let index = i;
            while (index < 0)
                index = allColors.length + index;
            if (index >= allColors.length)
                index = index % allColors.length;
            answers.push(allColors[index]);
        }
        return answers;
    }
    get complement() {
        if (this._complement !== undefined)
            return this._complement;
        const coldestHue = this.coldest.hue;
        const coldestTemp = this.temp(this.coldest);
        const warmestHue = this.warmest.hue;
        const warmestTemp = this.temp(this.warmest);
        const range = warmestTemp - coldestTemp;
        const startHueIsColdestToWarmest = TemperatureCache.isBetween(this.input.hue, coldestHue, warmestHue);
        const startHue = startHueIsColdestToWarmest ? warmestHue : coldestHue;
        const endHue = startHueIsColdestToWarmest ? coldestHue : warmestHue;
        const directionOfRotation = 1.0;
        let smallestError = 1000.0;
        let answer = this.hctsByHue[utils.dartRound(this.input.hue)];
        const complementRelativeTemp = 1.0 - this.inputRelativeTemperature;
        for (let hueAddend = 0.0; hueAddend <= 360.0; hueAddend += 1.0) {
            const hue = utils.sanitizeDegreesDouble(startHue + directionOfRotation * hueAddend);
            if (!TemperatureCache.isBetween(hue, startHue, endHue))
                continue;
            const possibleAnswer = this.hctsByHue[utils.dartRound(hue)];
            const relativeTemp = (this.temp(possibleAnswer) - coldestTemp) / range;
            const error = Math.abs(complementRelativeTemp - relativeTemp);
            if (error < smallestError) {
                smallestError = error;
                answer = possibleAnswer;
            }
        }
        this._complement = answer;
        return answer;
    }
    relativeTemperature(hct) {
        const range = this.temp(this.warmest) - this.temp(this.coldest);
        const differenceFromColdest = this.temp(hct) - this.temp(this.coldest);
        if (range === 0.0)
            return 0.5;
        return differenceFromColdest / range;
    }
    get inputRelativeTemperature() {
        if (this._inputRelativeTemperature >= 0.0)
            return this._inputRelativeTemperature;
        const coldestTemp = this.temp(this.coldest);
        const range = this.temp(this.warmest) - coldestTemp;
        const differenceFromColdest = this.temp(this.input) - coldestTemp;
        this._inputRelativeTemperature = range === 0.0 ? 0.5 : differenceFromColdest / range;
        return this._inputRelativeTemperature;
    }
    get hctsByTemp() {
        if (this._hctsByTemp.length > 0)
            return this._hctsByTemp;
        const hcts = [...this.hctsByHue, this.input];
        hcts.sort((a, b) => this.temp(a) - this.temp(b));
        this._hctsByTemp = hcts;
        return hcts;
    }
    /** Dart keys this map by Hct, whose equality is its ARGB value. */
    get tempsByArgb() {
        if (this._tempsByArgb !== undefined)
            return this._tempsByArgb;
        const map = new Map();
        for (const hct of [...this.hctsByHue, this.input]) {
            map.set(hct.toInt(), TemperatureCache.rawTemperature(hct));
        }
        this._tempsByArgb = map;
        return map;
    }
    get hctsByHue() {
        if (this._hctsByHue.length > 0)
            return this._hctsByHue;
        const hcts = [];
        for (let hue = 0.0; hue <= 360.0; hue += 1.0) {
            hcts.push(Hct.from(hue, this.input.chroma, this.input.tone));
        }
        this._hctsByHue = hcts;
        return hcts;
    }
    static isBetween(angle, a, b) {
        if (a < b)
            return a <= angle && angle <= b;
        return a <= angle || angle <= b;
    }
    static rawTemperature(color) {
        const lab = utils.labFromArgb(color.toInt());
        const hue = utils.sanitizeDegreesDouble((Math.atan2(lab[2], lab[1]) * 180.0) / Math.PI);
        const chroma = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
        return (-0.5 + 0.02 * Math.pow(chroma, 1.07) * Math.cos((utils.sanitizeDegreesDouble(hue - 50.0) * Math.PI) / 180.0));
    }
}
// ---------------------------------------------------------------- schemes
const VIBRANT_HUES = [0, 41, 61, 101, 131, 181, 251, 301, 360];
const VIBRANT_SECONDARY = [18, 15, 10, 12, 15, 18, 15, 12, 12];
const VIBRANT_TERTIARY = [35, 30, 20, 25, 30, 35, 30, 25, 25];
const EXPRESSIVE_HUES = [0, 21, 51, 121, 151, 191, 271, 321, 360];
const EXPRESSIVE_SECONDARY = [45, 95, 45, 20, 45, 90, 45, 45, 45];
const EXPRESSIVE_TERTIARY = [120, 120, 20, 45, 20, 15, 20, 120, 120];
const SCHEMES = {
    [Variant.tonalSpot]: (h) => ({
        primaryPalette: TonalPalette.of(h.hue, 36.0),
        secondaryPalette: TonalPalette.of(h.hue, 16.0),
        tertiaryPalette: TonalPalette.of(utils.sanitizeDegreesDouble(h.hue + 60.0), 24.0),
        neutralPalette: TonalPalette.of(h.hue, 6.0),
        neutralVariantPalette: TonalPalette.of(h.hue, 8.0),
    }),
    [Variant.fidelity]: (h) => ({
        primaryPalette: TonalPalette.of(h.hue, h.chroma),
        secondaryPalette: TonalPalette.of(h.hue, Math.max(h.chroma - 32.0, h.chroma * 0.5)),
        tertiaryPalette: TonalPalette.fromHct(fixIfDisliked(new TemperatureCache(h).complement)),
        neutralPalette: TonalPalette.of(h.hue, h.chroma / 8.0),
        neutralVariantPalette: TonalPalette.of(h.hue, h.chroma / 8.0 + 4.0),
    }),
    [Variant.vibrant]: (h) => ({
        primaryPalette: TonalPalette.of(h.hue, 200.0),
        secondaryPalette: TonalPalette.of(DynamicScheme.getRotatedHue(h, VIBRANT_HUES, VIBRANT_SECONDARY), 24.0),
        tertiaryPalette: TonalPalette.of(DynamicScheme.getRotatedHue(h, VIBRANT_HUES, VIBRANT_TERTIARY), 32.0),
        neutralPalette: TonalPalette.of(h.hue, 10.0),
        neutralVariantPalette: TonalPalette.of(h.hue, 12.0),
    }),
    [Variant.expressive]: (h) => ({
        primaryPalette: TonalPalette.of(utils.sanitizeDegreesDouble(h.hue + 240.0), 40.0),
        secondaryPalette: TonalPalette.of(DynamicScheme.getRotatedHue(h, EXPRESSIVE_HUES, EXPRESSIVE_SECONDARY), 24.0),
        tertiaryPalette: TonalPalette.of(DynamicScheme.getRotatedHue(h, EXPRESSIVE_HUES, EXPRESSIVE_TERTIARY), 32.0),
        neutralPalette: TonalPalette.of(h.hue + 15.0, 8.0),
        neutralVariantPalette: TonalPalette.of(h.hue + 15.0, 12.0),
    }),
    [Variant.content]: (h) => ({
        primaryPalette: TonalPalette.of(h.hue, h.chroma),
        secondaryPalette: TonalPalette.of(h.hue, Math.max(h.chroma - 32.0, h.chroma * 0.5)),
        tertiaryPalette: TonalPalette.fromHct(fixIfDisliked(new TemperatureCache(h).analogous(3, 6).at(-1))),
        neutralPalette: TonalPalette.of(h.hue, h.chroma / 8.0),
        neutralVariantPalette: TonalPalette.of(h.hue, h.chroma / 8.0 + 4.0),
    }),
    [Variant.monochrome]: (h) => ({
        primaryPalette: TonalPalette.of(h.hue, 0.0),
        secondaryPalette: TonalPalette.of(h.hue, 0.0),
        tertiaryPalette: TonalPalette.of(h.hue, 0.0),
        neutralPalette: TonalPalette.of(h.hue, 0.0),
        neutralVariantPalette: TonalPalette.of(h.hue, 0.0),
    }),
    [Variant.neutral]: (h) => ({
        primaryPalette: TonalPalette.of(h.hue, 12.0),
        secondaryPalette: TonalPalette.of(h.hue, 8.0),
        tertiaryPalette: TonalPalette.of(h.hue, 16.0),
        neutralPalette: TonalPalette.of(h.hue, 2.0),
        neutralVariantPalette: TonalPalette.of(h.hue, 2.0),
    }),
    [Variant.rainbow]: (h) => ({
        primaryPalette: TonalPalette.of(h.hue, 48.0),
        secondaryPalette: TonalPalette.of(h.hue, 16.0),
        tertiaryPalette: TonalPalette.of(utils.sanitizeDegreesDouble(h.hue + 60.0), 24.0),
        neutralPalette: TonalPalette.of(h.hue, 0.0),
        neutralVariantPalette: TonalPalette.of(h.hue, 0.0),
    }),
    [Variant.fruitSalad]: (h) => ({
        primaryPalette: TonalPalette.of(utils.sanitizeDegreesDouble(h.hue - 50.0), 48.0),
        secondaryPalette: TonalPalette.of(utils.sanitizeDegreesDouble(h.hue - 50.0), 36.0),
        tertiaryPalette: TonalPalette.of(h.hue, 36.0),
        neutralPalette: TonalPalette.of(h.hue, 10.0),
        neutralVariantPalette: TonalPalette.of(h.hue, 16.0),
    }),
};
/** The MCU `Scheme<Variant>(sourceColorHct:, isDark:, contrastLevel:)` constructors. */
export function schemeFor(variant, sourceColorHct, isDark, contrastLevel) {
    return new DynamicScheme({
        sourceColorArgb: sourceColorHct.toInt(),
        variant,
        isDark,
        contrastLevel,
        ...SCHEMES[variant](sourceColorHct),
    });
}
