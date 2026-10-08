import { Hct } from './hct.js';
/** Hue and chroma, from which any tone can be produced. */
export declare class TonalPalette {
    readonly hue: number;
    readonly chroma: number;
    private _keyColor;
    private constructor();
    static of(hue: number, chroma: number): TonalPalette;
    static fromHct(hct: Hct): TonalPalette;
    /** Computed lazily; Dart computes it eagerly with the same result. */
    get keyColor(): Hct;
    static createKeyColor(hue: number, chroma: number): Hct;
    /** ARGB for [tone]. Dart caches this; the result is deterministic. */
    tone(tone: number): number;
    getHct(tone: number): Hct;
}
export declare const Contrast: {
    ratioOfTones(toneA: number, toneB: number): number;
    lighter(tone: number, ratio: number): number;
    darker(tone: number, ratio: number): number;
    lighterUnsafe(tone: number, ratio: number): number;
    darkerUnsafe(tone: number, ratio: number): number;
};
