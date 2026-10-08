// CSS custom-property emitter: the web stand-in for the Flutter Material
// bridge. Pure functions; the DOM helpers only touch the element they are given.
import { AuroraArgumentError, isKind, resolveTextureColor, } from '@aurora/core';
const GENERIC_FAMILIES = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui',
    'ui-serif',
    'ui-sans-serif',
    'ui-monospace',
    'ui-rounded',
    'math',
    'emoji',
    'fangsong',
]);
const PREFIX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
/**
 * The custom property name for a token path: `--{prefix}-{segments joined by
 * "-"}`, keeping each segment's case. `colors.onPrimaryContainer` becomes
 * `--aurora-colors-onPrimaryContainer`. Path segments never contain `-`, so
 * names are unique per path.
 */
export function auroraCssName(path, options = {}) {
    const prefix = options.prefix ?? 'aurora';
    if (!PREFIX.test(prefix))
        throw new AuroraArgumentError(`Invalid CSS prefix ${prefix}`);
    return `--${prefix}-${path.split('.').join('-')}`;
}
/** `#rrggbb` when opaque, otherwise `#rrggbbaa`. */
export function cssColor(color) {
    return color.alpha === 255 ? color.hex.substring(0, 7) : color.hex;
}
function cssNumber(value) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}
/** `dp` and `px` are both CSS pixels (1dp = 1px); `rem` is kept. */
export function cssDimension(value) {
    return `${cssNumber(value.value)}${value.unit === 'rem' ? 'rem' : 'px'}`;
}
export function cssFontFamily(value) {
    return value.names.map((name) => (GENERIC_FAMILIES.has(name) ? name : JSON.stringify(name))).join(', ');
}
/** The CSS `border-style` for a stroke; dash patterns become `dashed`. */
export function cssStrokeStyle(value) {
    return value.keyword ?? 'dashed';
}
function put(out, owners, name, value, path) {
    const owner = owners.get(name);
    if (owner !== undefined && owner !== path) {
        throw new AuroraArgumentError(`CSS variable ${name} is produced by both ${owner} and ${path}; rename one token`);
    }
    owners.set(name, path);
    out[name] = value;
}
const cache = new WeakMap();
const textureIds = new WeakMap();
let nextTextureId = 1;
/**
 * CSS custom properties for a resolved variant plus an optional texture.
 *
 * Colours: one variable per token. Texture tokens:
 * - dimension: `12px` (dp and px) or `1.5rem`; number: plain number
 * - fontFamily: quoted names, generic families unquoted; fontWeight: number
 * - duration: `200ms`; cubicBezier: `cubic-bezier(x1, y1, x2, y2)`
 * - strokeStyle: a `border-style` keyword (dash patterns become `dashed`, with
 *   `-dashArray` and `-lineCap` variables for SVG or canvas use)
 * - border: the `border` shorthand, plus `-width`, `-style` and `-color`
 * - shadow: the `box-shadow` list, or `none`
 * - typography: the `font` shorthand, plus `-fontFamily`, `-fontSize`,
 *   `-fontWeight`, `-letterSpacing` and `-lineHeight`
 * - boolean: `1` or `0`; enum: the value
 *
 * Theme colour references inside textures resolve against [variant]. Results
 * are cached per variant, texture and prefix, so repeated calls are cheap.
 */
export function auroraCssVariables(variant, texture, options = {}) {
    const prefix = options.prefix ?? 'aurora';
    let textureId = 0;
    if (texture !== undefined) {
        textureId = textureIds.get(texture) ?? nextTextureId++;
        textureIds.set(texture, textureId);
    }
    const key = `${prefix}\u0000${textureId}`;
    let byKey = cache.get(variant);
    const cached = byKey?.get(key);
    if (cached !== undefined)
        return cached;
    const out = {};
    const owners = new Map();
    const name = (path) => auroraCssName(path, { prefix });
    for (const [token, color] of variant.values)
        put(out, owners, name(token.path), cssColor(color), token.path);
    if (texture !== undefined) {
        texture.validateColors(variant.contract);
        const color = (ref) => cssColor(resolveTextureColor(variant, ref));
        for (const token of texture.contract.tokens.values()) {
            const path = token.path;
            const base = name(path);
            const value = texture.read(token);
            const add = (suffix, css) => put(out, owners, `${base}${suffix}`, css, path);
            if (isKind(value, 'dimension')) {
                add('', cssDimension(value));
            }
            else if (typeof value === 'number') {
                add('', cssNumber(value));
            }
            else if (isKind(value, 'fontFamily')) {
                add('', cssFontFamily(value));
            }
            else if (isKind(value, 'fontWeight')) {
                add('', String(value.value));
            }
            else if (isKind(value, 'duration')) {
                add('', `${cssNumber(value.milliseconds)}ms`);
            }
            else if (isKind(value, 'cubicBezier')) {
                add('', `cubic-bezier(${[value.x1, value.y1, value.x2, value.y2].map(cssNumber).join(', ')})`);
            }
            else if (isKind(value, 'strokeStyle')) {
                add('', cssStrokeStyle(value));
                if (value.dashArray !== undefined) {
                    add('-dashArray', value.dashArray.map(cssDimension).join(' '));
                    add('-lineCap', value.lineCap);
                }
            }
            else if (isKind(value, 'border')) {
                const width = cssDimension(value.width);
                const style = cssStrokeStyle(value.style);
                const c = color(value.color);
                add('', `${width} ${style} ${c}`);
                add('-width', width);
                add('-style', style);
                add('-color', c);
            }
            else if (isKind(value, 'shadow')) {
                add('', value.layers.length === 0
                    ? 'none'
                    : value.layers
                        .map((layer) => [
                        layer.inset ? 'inset' : '',
                        cssDimension(layer.offsetX),
                        cssDimension(layer.offsetY),
                        cssDimension(layer.blur),
                        cssDimension(layer.spread),
                        color(layer.color),
                    ]
                        .filter((part) => part !== '')
                        .join(' '))
                        .join(', '));
            }
            else if (isKind(value, 'typography')) {
                const family = cssFontFamily(value.fontFamily);
                const size = cssDimension(value.fontSize);
                const weight = String(value.fontWeight.value);
                const height = cssNumber(value.lineHeight);
                add('', `${weight} ${size}/${height} ${family}`);
                add('-fontFamily', family);
                add('-fontSize', size);
                add('-fontWeight', weight);
                add('-letterSpacing', cssDimension(value.letterSpacing));
                add('-lineHeight', height);
            }
            else if (typeof value === 'boolean') {
                add('', value ? '1' : '0');
            }
            else if (typeof value === 'string') {
                add('', value);
            }
        }
    }
    const result = Object.freeze(out);
    if (byKey === undefined) {
        byKey = new Map();
        cache.set(variant, byKey);
    }
    byKey.set(key, result);
    return result;
}
/** The declarations as a CSS rule, such as `:root { --aurora-colors-primary: #6750a4; ... }`. */
export function auroraCssText(selector, declarations) {
    const body = Object.entries(declarations)
        .map(([name, value]) => `  ${name}: ${value};`)
        .join('\n');
    return `${selector} {\n${body}\n}`;
}
/**
 * Writes [next] to [element]'s inline style, touching only variables whose
 * value changed and removing ones [previous] had that [next] lacks.
 */
export function applyAuroraCssVariables(element, next, previous = {}) {
    if (next === previous)
        return;
    for (const name of Object.keys(previous)) {
        if (!(name in next))
            element.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(next)) {
        if (previous[name] !== value)
            element.style.setProperty(name, value);
    }
}
