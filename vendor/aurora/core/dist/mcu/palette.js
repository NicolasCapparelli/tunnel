// Ported from material_color_utilities 0.11.1 (Dart), palettes/tonal_palette.dart
// and contrast/contrast.dart. Copyright 2021-2022 Google LLC. Apache-2.0; see
// LICENSE-material-color-utilities and NOTICE.md in this package.
import { Hct } from './hct.js';
import * as utils from './utils.js';
/** Hue and chroma, from which any tone can be produced. */
export class TonalPalette {
    hue;
    chroma;
    _keyColor;
    constructor(hue, chroma, keyColor) {
        this.hue = hue;
        this.chroma = chroma;
        this._keyColor = keyColor;
    }
    static of(hue, chroma) {
        return new TonalPalette(hue, chroma);
    }
    static fromHct(hct) {
        return new TonalPalette(hct.hue, hct.chroma, hct);
    }
    /** Computed lazily; Dart computes it eagerly with the same result. */
    get keyColor() {
        this._keyColor ??= TonalPalette.createKeyColor(this.hue, this.chroma);
        return this._keyColor;
    }
    static createKeyColor(hue, chroma) {
        const startTone = 50.0;
        let smallestDeltaHct = Hct.from(hue, chroma, startTone);
        let smallestDelta = Math.abs(smallestDeltaHct.chroma - chroma);
        for (let delta = 1.0; delta < 50.0; delta += 1.0) {
            if (utils.dartRound(chroma) === utils.dartRound(smallestDeltaHct.chroma)) {
                return smallestDeltaHct;
            }
            const hctAdd = Hct.from(hue, chroma, startTone + delta);
            const hctAddDelta = Math.abs(hctAdd.chroma - chroma);
            if (hctAddDelta < smallestDelta) {
                smallestDelta = hctAddDelta;
                smallestDeltaHct = hctAdd;
            }
            const hctSubtract = Hct.from(hue, chroma, startTone - delta);
            const hctSubtractDelta = Math.abs(hctSubtract.chroma - chroma);
            if (hctSubtractDelta < smallestDelta) {
                smallestDelta = hctSubtractDelta;
                smallestDeltaHct = hctSubtract;
            }
        }
        return smallestDeltaHct;
    }
    /** ARGB for [tone]. Dart caches this; the result is deterministic. */
    tone(tone) {
        return Hct.from(this.hue, this.chroma, tone).toInt();
    }
    getHct(tone) {
        return Hct.from(this.hue, this.chroma, tone);
    }
}
function ratioOfYs(y1, y2) {
    const lighter = y1 > y2 ? y1 : y2;
    const darker = lighter === y2 ? y1 : y2;
    return (lighter + 5.0) / (darker + 5.0);
}
export const Contrast = {
    ratioOfTones(toneA, toneB) {
        toneA = utils.clampDouble(0.0, 100.0, toneA);
        toneB = utils.clampDouble(0.0, 100.0, toneB);
        return ratioOfYs(utils.yFromLstar(toneA), utils.yFromLstar(toneB));
    },
    lighter(tone, ratio) {
        if (tone < 0.0 || tone > 100.0)
            return -1.0;
        const darkY = utils.yFromLstar(tone);
        const lightY = ratio * (darkY + 5.0) - 5.0;
        const realContrast = ratioOfYs(lightY, darkY);
        const delta = Math.abs(realContrast - ratio);
        if (realContrast < ratio && delta > 0.04)
            return -1;
        const returnValue = utils.lstarFromY(lightY) + 0.4;
        if (returnValue < 0 || returnValue > 100)
            return -1;
        return returnValue;
    },
    darker(tone, ratio) {
        if (tone < 0.0 || tone > 100.0)
            return -1.0;
        const lightY = utils.yFromLstar(tone);
        const darkY = (lightY + 5.0) / ratio - 5.0;
        const realContrast = ratioOfYs(lightY, darkY);
        const delta = Math.abs(realContrast - ratio);
        if (realContrast < ratio && delta > 0.04)
            return -1;
        const returnValue = utils.lstarFromY(darkY) - 0.4;
        if (returnValue < 0 || returnValue > 100)
            return -1;
        return returnValue;
    },
    lighterUnsafe(tone, ratio) {
        const lighterSafe = Contrast.lighter(tone, ratio);
        return lighterSafe < 0.0 ? 100.0 : lighterSafe;
    },
    darkerUnsafe(tone, ratio) {
        const darkerSafe = Contrast.darker(tone, ratio);
        return darkerSafe < 0.0 ? 0.0 : darkerSafe;
    },
};
