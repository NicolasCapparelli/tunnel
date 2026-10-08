/** An immutable sRGB color stored as an unsigned 32-bit ARGB value. */
export declare class AuroraColor {
    readonly kind: "color";
    readonly argb: number;
    constructor(argb: number);
    /** Parses `#RRGGBB` or `#RRGGBBAA` (CSS order, not ARGB). */
    static hex(hex: string): AuroraColor;
    /** Builds a color from 8-bit channels. */
    static rgba(red: number, green: number, blue: number, alpha?: number): AuroraColor;
    get alpha(): number;
    get red(): number;
    get green(): number;
    get blue(): number;
    /** Lowercase `#rrggbbaa`, as the portable fixtures compare colors. */
    get hex(): string;
    equals(other: unknown): boolean;
    toString(): string;
}
/** True for an {@link AuroraColor}, checked by its `kind` rather than `instanceof`. */
export declare function isAuroraColor(value: unknown): value is AuroraColor;
