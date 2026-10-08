export declare class ViewingConditions {
    readonly whitePoint: number[];
    readonly adaptingLuminance: number;
    readonly backgroundLstar: number;
    readonly surround: number;
    readonly discountingIlluminant: boolean;
    readonly backgroundYTowhitePointY: number;
    readonly aw: number;
    readonly nbb: number;
    readonly ncb: number;
    readonly c: number;
    readonly nC: number;
    readonly drgbInverse: number[];
    readonly rgbD: number[];
    readonly fl: number;
    readonly fLRoot: number;
    readonly z: number;
    constructor(whitePoint: number[], adaptingLuminance: number, backgroundLstar: number, surround: number, discountingIlluminant: boolean, backgroundYTowhitePointY: number, aw: number, nbb: number, ncb: number, c: number, nC: number, drgbInverse: number[], rgbD: number[], fl: number, fLRoot: number, z: number);
    static make(whitePoint?: number[], adaptingLuminance?: number, backgroundLstar?: number, surround?: number, discountingIlluminant?: boolean): ViewingConditions;
    static readonly sRgb: ViewingConditions;
    static readonly standard: ViewingConditions;
}
export declare class Cam16 {
    readonly hue: number;
    readonly chroma: number;
    readonly j: number;
    readonly q: number;
    readonly m: number;
    readonly s: number;
    readonly jstar: number;
    readonly astar: number;
    readonly bstar: number;
    constructor(hue: number, chroma: number, j: number, q: number, m: number, s: number, jstar: number, astar: number, bstar: number);
    distance(other: Cam16): number;
    static fromInt(argb: number): Cam16;
    static fromIntInViewingConditions(argb: number, viewingConditions: ViewingConditions): Cam16;
    static fromXyzInViewingConditions(x: number, y: number, z: number, vc: ViewingConditions): Cam16;
    static fromJch(j: number, c: number, h: number): Cam16;
    static fromJchInViewingConditions(J: number, C: number, h: number, vc: ViewingConditions): Cam16;
    static fromUcs(jstar: number, astar: number, bstar: number): Cam16;
    static fromUcsInViewingConditions(jstar: number, astar: number, bstar: number, vc: ViewingConditions): Cam16;
    toInt(): number;
    viewed(vc: ViewingConditions): number;
    xyzInViewingConditions(vc: ViewingConditions): number[];
}
export declare class Hct {
    private _hue;
    private _chroma;
    private _tone;
    private _argb;
    private constructor();
    static from(hue: number, chroma: number, tone: number): Hct;
    static fromInt(argb: number): Hct;
    toInt(): number;
    get hue(): number;
    set hue(newHue: number);
    get chroma(): number;
    set chroma(newChroma: number);
    get tone(): number;
    set tone(newTone: number);
    equals(other: Hct): boolean;
    private setInternalState;
    inViewingConditions(vc: ViewingConditions): Hct;
}
