// Ported from material_color_utilities 0.11.1 (Dart), utils/math_utils.dart
// and utils/color_utils.dart. Copyright 2021 Google LLC. Apache-2.0; see
// LICENSE-material-color-utilities and NOTICE.md in this package.
/** Dart's `double.round()`: halves round away from zero. */
export function dartRound(value) {
    return value < 0 ? -Math.round(-value) : Math.round(value);
}
/** Dart's `%`: the result has the sign of a positive divisor. */
export function dartMod(value, divisor) {
    const result = value % divisor;
    return result < 0 ? result + Math.abs(divisor) : result + 0;
}
export function signum(num) {
    if (num < 0)
        return -1;
    if (num === 0)
        return 0;
    return 1;
}
export function lerp(start, stop, amount) {
    return (1.0 - amount) * start + amount * stop;
}
export function clampInt(min, max, input) {
    if (input < min)
        return min;
    if (input > max)
        return max;
    return input;
}
export function clampDouble(min, max, input) {
    if (input < min)
        return min;
    if (input > max)
        return max;
    return input;
}
export function sanitizeDegreesInt(degrees) {
    degrees = dartMod(degrees, 360);
    if (degrees < 0)
        degrees = degrees + 360;
    return degrees;
}
export function sanitizeDegreesDouble(degrees) {
    degrees = dartMod(degrees, 360.0);
    if (degrees < 0)
        degrees = degrees + 360.0;
    return degrees;
}
export function rotationDirection(from, to) {
    const increasingDifference = sanitizeDegreesDouble(to - from);
    return increasingDifference <= 180.0 ? 1.0 : -1.0;
}
export function differenceDegrees(a, b) {
    return 180.0 - Math.abs(Math.abs(a - b) - 180.0);
}
export function matrixMultiply(row, matrix) {
    const m = matrix;
    const r = row;
    const a = r[0] * m[0][0] + r[1] * m[0][1] + r[2] * m[0][2];
    const b = r[0] * m[1][0] + r[1] * m[1][1] + r[2] * m[1][2];
    const c = r[0] * m[2][0] + r[1] * m[2][1] + r[2] * m[2][2];
    return [a, b, c];
}
const SRGB_TO_XYZ = [
    [0.41233895, 0.35762064, 0.18051042],
    [0.2126, 0.7152, 0.0722],
    [0.01932141, 0.11916382, 0.95034478],
];
const XYZ_TO_SRGB = [
    [3.2413774792388685, -1.5376652402851851, -0.49885366846268053],
    [-0.9691452513005321, 1.8758853451067872, 0.04156585616912061],
    [0.05562093689691305, -0.20395524564742123, 1.0571799111220335],
];
const WHITE_POINT_D65 = [95.047, 100.0, 108.883];
export function argbFromRgb(red, green, blue) {
    return ((255 << 24) | ((red & 255) << 16) | ((green & 255) << 8) | (blue & 255)) >>> 0;
}
export function argbFromLinrgb(linrgb) {
    return argbFromRgb(delinearized(linrgb[0]), delinearized(linrgb[1]), delinearized(linrgb[2]));
}
export function alphaFromArgb(argb) {
    return (argb >>> 24) & 255;
}
export function redFromArgb(argb) {
    return (argb >>> 16) & 255;
}
export function greenFromArgb(argb) {
    return (argb >>> 8) & 255;
}
export function blueFromArgb(argb) {
    return argb & 255;
}
export function isOpaque(argb) {
    return alphaFromArgb(argb) >= 255;
}
export function argbFromXyz(x, y, z) {
    const m = XYZ_TO_SRGB;
    const linearR = m[0][0] * x + m[0][1] * y + m[0][2] * z;
    const linearG = m[1][0] * x + m[1][1] * y + m[1][2] * z;
    const linearB = m[2][0] * x + m[2][1] * y + m[2][2] * z;
    return argbFromRgb(delinearized(linearR), delinearized(linearG), delinearized(linearB));
}
export function xyzFromArgb(argb) {
    const r = linearized(redFromArgb(argb));
    const g = linearized(greenFromArgb(argb));
    const b = linearized(blueFromArgb(argb));
    return matrixMultiply([r, g, b], SRGB_TO_XYZ);
}
export function argbFromLab(l, a, b) {
    const fy = (l + 16.0) / 116.0;
    const fx = a / 500.0 + fy;
    const fz = fy - b / 200.0;
    const x = labInvf(fx) * WHITE_POINT_D65[0];
    const y = labInvf(fy) * WHITE_POINT_D65[1];
    const z = labInvf(fz) * WHITE_POINT_D65[2];
    return argbFromXyz(x, y, z);
}
export function labFromArgb(argb) {
    const linearR = linearized(redFromArgb(argb));
    const linearG = linearized(greenFromArgb(argb));
    const linearB = linearized(blueFromArgb(argb));
    const m = SRGB_TO_XYZ;
    const x = m[0][0] * linearR + m[0][1] * linearG + m[0][2] * linearB;
    const y = m[1][0] * linearR + m[1][1] * linearG + m[1][2] * linearB;
    const z = m[2][0] * linearR + m[2][1] * linearG + m[2][2] * linearB;
    const fx = labF(x / WHITE_POINT_D65[0]);
    const fy = labF(y / WHITE_POINT_D65[1]);
    const fz = labF(z / WHITE_POINT_D65[2]);
    return [116.0 * fy - 16, 500.0 * (fx - fy), 200.0 * (fy - fz)];
}
export function argbFromLstar(lstar) {
    const component = delinearized(yFromLstar(lstar));
    return argbFromRgb(component, component, component);
}
export function lstarFromArgb(argb) {
    const y = xyzFromArgb(argb)[1];
    return 116.0 * labF(y / 100.0) - 16.0;
}
export function yFromLstar(lstar) {
    return 100.0 * labInvf((lstar + 16.0) / 116.0);
}
export function lstarFromY(y) {
    return labF(y / 100.0) * 116.0 - 16.0;
}
export function linearized(rgbComponent) {
    const normalized = rgbComponent / 255.0;
    if (normalized <= 0.040449936)
        return (normalized / 12.92) * 100.0;
    return Math.pow((normalized + 0.055) / 1.055, 2.4) * 100.0;
}
export function delinearized(rgbComponent) {
    const normalized = rgbComponent / 100.0;
    let value = 0.0;
    if (normalized <= 0.0031308) {
        value = normalized * 12.92;
    }
    else {
        value = 1.055 * Math.pow(normalized, 1.0 / 2.4) - 0.055;
    }
    return clampInt(0, 255, dartRound(value * 255.0));
}
export function whitePointD65() {
    return WHITE_POINT_D65;
}
function labF(t) {
    const e = 216.0 / 24389.0;
    const kappa = 24389.0 / 27.0;
    if (t > e)
        return Math.pow(t, 1.0 / 3.0);
    return (kappa * t + 16) / 116;
}
function labInvf(ft) {
    const e = 216.0 / 24389.0;
    const kappa = 24389.0 / 27.0;
    const ft3 = ft * ft * ft;
    if (ft3 > e)
        return ft3;
    return (116 * ft - 16) / kappa;
}
