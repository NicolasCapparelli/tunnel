// Shared JSON value codec for texture DTCG documents and texture recipes.
// Not exported from the package index.
import { isAuroraColor } from './color.js';
import { AuroraDtcg, REFERENCE } from './dtcg.js';
import { AuroraArgumentError, AuroraFormatError, AuroraStateError } from './errors.js';
import { AuroraFoundation } from './foundation.js';
import { isFiniteNumber, isJsonObject } from './json.js';
import { AuroraAlias, AuroraLiteral, isAlias, isLiteral } from './ref.js';
import { AuroraColorToken } from './token.js';
import { AURORA_STROKE_KEYWORDS, AuroraBorder, AuroraCubicBezier, AuroraDimension, AuroraDuration, AuroraFontFamily, AuroraFontWeight, AuroraShadow, AuroraShadowLayer, AuroraStrokeStyle, AuroraTypography, isKind, } from './values.js';
const FONT_WEIGHT_NAMES = {
    thin: 100,
    hairline: 100,
    'extra-light': 200,
    'ultra-light': 200,
    light: 300,
    normal: 400,
    regular: 400,
    book: 400,
    medium: 500,
    'semi-bold': 600,
    'demi-bold': 600,
    bold: 700,
    'extra-bold': 800,
    'ultra-bold': 800,
    black: 900,
    heavy: 900,
    'extra-black': 950,
    'ultra-black': 950,
};
const LINE_CAPS = ['round', 'butt', 'square'];
/**
 * Recipe codecs write `dp` units literally. DTCG codecs write `px` and the
 * caller records dp with a token-level `$extensions["dev.aurora"]` marker,
 * passed back as `pxIsDp` when decoding.
 */
export class TextureCodec {
    textureContract;
    recipe;
    constructor(textureContract, recipe) {
        this.textureContract = textureContract;
        this.recipe = recipe;
    }
    get contract() {
        if (this.textureContract === undefined)
            throw new AuroraStateError('Decoding needs a texture contract');
        return this.textureContract;
    }
    // ---------------------------------------------------------------- encode
    encode(authored) {
        if (isAlias(authored))
            return `{${authored.target.path}}`;
        if (isKind(authored, 'dimension'))
            return this.encodeDimension(authored);
        if (typeof authored === 'number')
            return authored;
        if (isKind(authored, 'fontFamily')) {
            return authored.names.length === 1 ? authored.names[0] : [...authored.names];
        }
        if (isKind(authored, 'fontWeight'))
            return authored.value;
        if (isKind(authored, 'duration'))
            return { value: authored.microseconds / 1000, unit: 'ms' };
        if (isKind(authored, 'cubicBezier'))
            return [authored.x1, authored.y1, authored.x2, authored.y2];
        if (isKind(authored, 'strokeStyle'))
            return this.encodeStroke(authored);
        if (isKind(authored, 'border')) {
            return {
                color: this.encodeColor(authored.color),
                width: this.encodeRef(authored.widthRef),
                style: this.encodeRef(authored.styleRef),
            };
        }
        if (isKind(authored, 'shadow')) {
            return authored.layers.map((layer) => ({
                color: this.encodeColor(layer.color),
                offsetX: this.encodeRef(layer.offsetXRef),
                offsetY: this.encodeRef(layer.offsetYRef),
                blur: this.encodeRef(layer.blurRef),
                spread: this.encodeRef(layer.spreadRef),
                ...(layer.inset ? { inset: true } : {}),
            }));
        }
        if (isKind(authored, 'typography')) {
            return {
                fontFamily: this.encodeRef(authored.fontFamilyRef),
                fontSize: this.encodeRef(authored.fontSizeRef),
                fontWeight: this.encodeRef(authored.fontWeightRef),
                letterSpacing: this.encodeRef(authored.letterSpacingRef),
                lineHeight: this.encodeRef(authored.lineHeightRef),
            };
        }
        if (typeof authored === 'boolean' || typeof authored === 'string')
            return authored;
        throw new AuroraArgumentError(`Cannot encode texture value ${String(authored)}`);
    }
    encodeRef(ref) {
        return this.encode(isLiteral(ref) ? ref.value : ref);
    }
    encodeColor(color) {
        if (isAlias(color))
            return `{${color.target.path}}`;
        const value = isLiteral(color) ? color.value : color;
        if (isAuroraColor(value))
            return AuroraDtcg.encodeColorValue(value);
        throw new AuroraArgumentError(`Cannot encode colour ${String(color)}`);
    }
    encodeDimension(value) {
        return { value: value.value, unit: value.unit === 'dp' && !this.recipe ? 'px' : value.unit };
    }
    /**
     * DTCG has no `none` stroke; Aurora writes an invisible zero-length dash
     * pattern, which other tools also draw as no line.
     */
    encodeStroke(value) {
        if (value.isNone) {
            return this.recipe ? 'none' : { dashArray: [{ value: 0, unit: 'px' }], lineCap: 'butt' };
        }
        if (value.keyword !== undefined)
            return value.keyword;
        return {
            dashArray: value.dashArrayRefs.map((dash) => this.encodeRef(dash)),
            lineCap: value.lineCap,
        };
    }
    /** Whether [authored] holds a literal dp dimension anywhere. */
    static usesDp(authored) {
        const dp = (ref) => (isKind(ref, 'dimension') && ref.unit === 'dp') || (isKind(ref, 'strokeStyle') && TextureCodec.usesDp(ref));
        if (isKind(authored, 'dimension'))
            return dp(authored);
        if (isKind(authored, 'strokeStyle'))
            return authored.dashArrayRefs?.some(dp) ?? false;
        if (isKind(authored, 'border'))
            return dp(authored.widthRef) || dp(authored.styleRef);
        if (isKind(authored, 'shadow')) {
            return authored.layers.some((l) => dp(l.offsetXRef) || dp(l.offsetYRef) || dp(l.blurRef) || dp(l.spreadRef));
        }
        if (isKind(authored, 'typography'))
            return dp(authored.fontSizeRef) || dp(authored.letterSpacingRef);
        return false;
    }
    // ---------------------------------------------------------------- decode
    /**
     * Decodes a `$value` for [token] into an authored texture value, keeping
     * aliases. Malformed input throws `AuroraFormatError`; ranges and alias
     * resolution are validated later by `AuroraTexture`.
     */
    decode(token, raw, at, pxIsDp = false) {
        if (typeof raw === 'string' && REFERENCE.test(raw)) {
            const target = this.target(raw, at);
            if (target.type !== token.type) {
                throw new AuroraFormatError(`${at} must alias a ${token.type} token, not ${target.path}`);
            }
            return new AuroraAlias(target);
        }
        const dp = pxIsDp;
        const typed = token;
        switch (typed.type) {
            case 'color':
                throw new AuroraFormatError(`${at}: colour tokens belong to theme contracts`);
            case 'dimension':
                return this.decodeDimension(raw, at, dp);
            case 'number':
                return this.number(raw, at);
            case 'fontFamily':
                return this.decodeFamily(raw, at);
            case 'fontWeight':
                return this.decodeWeight(raw, at);
            case 'duration':
                return this.decodeDuration(raw, at);
            case 'cubicBezier':
                return this.decodeBezier(raw, at);
            case 'strokeStyle':
                return this.decodeStroke(raw, at, dp);
            case 'border':
                return this.decodeBorder(raw, at, dp);
            case 'shadow':
                return this.decodeShadow(raw, at, dp);
            case 'typography':
                return this.decodeTypography(raw, at, dp);
            case 'boolean':
                if (typeof raw !== 'boolean')
                    throw new AuroraFormatError(`${at} must be a boolean`);
                return raw;
            case 'enum':
                if (typeof raw !== 'string')
                    throw new AuroraFormatError(`${at} must be a string`);
                return raw;
        }
    }
    target(raw, at) {
        const path = REFERENCE.exec(raw)[1];
        const target = this.contract.tokens.get(path);
        if (target === undefined)
            throw new AuroraFormatError(`${at} aliases unknown token ${path}`);
        return target;
    }
    field(raw, at, type, decode) {
        if (typeof raw === 'string' && REFERENCE.test(raw)) {
            const target = this.target(raw, at);
            if (target.type !== type)
                throw new AuroraFormatError(`${at} aliases ${target.path}, a ${target.type}`);
            return new AuroraAlias(target);
        }
        const value = decode(raw);
        return (typeof value === 'object' && value !== null ? value : new AuroraLiteral(value));
    }
    dimensionField(raw, at, dp) {
        return this.field(raw, at, 'dimension', (value) => this.decodeDimension(value, at, dp));
    }
    colorField(raw, at) {
        if (typeof raw === 'string' && REFERENCE.test(raw)) {
            const path = REFERENCE.exec(raw)[1];
            if (this.contract.tokens.has(path)) {
                throw new AuroraFormatError(`${at} must refer to a theme colour, not ${path}`);
            }
            const foundation = AuroraFoundation.tokens.find((token) => token.path === path);
            return new AuroraAlias(foundation ?? new AuroraColorToken(path, { description: `Theme colour ${path}.` }));
        }
        return AuroraDtcg.decodeColorValue(raw, at);
    }
    object(raw, at, required, optional = []) {
        if (!isJsonObject(raw))
            throw new AuroraFormatError(`${at} must be an object`);
        const unknown = Object.keys(raw).filter((k) => !required.includes(k) && !optional.includes(k));
        if (unknown.length > 0)
            throw new AuroraFormatError(`${at} has unsupported fields ${unknown.join(', ')}`);
        const missing = required.filter((k) => !Object.prototype.hasOwnProperty.call(raw, k));
        if (missing.length > 0)
            throw new AuroraFormatError(`${at} is missing ${missing.join(', ')}`);
        return raw;
    }
    number(raw, at) {
        if (!isFiniteNumber(raw))
            throw new AuroraFormatError(`${at} must be a finite number`);
        return raw;
    }
    decodeDimension(raw, at, pxIsDp) {
        const map = this.object(raw, at, ['value', 'unit']);
        const value = this.number(map['value'], `${at}.value`);
        switch (map['unit']) {
            case 'px':
                return new AuroraDimension(value, pxIsDp ? 'dp' : 'px');
            case 'rem':
                return AuroraDimension.rem(value);
            case 'dp':
                if (this.recipe)
                    return AuroraDimension.dp(value);
        }
        throw new AuroraFormatError(`${at}.unit must be ${this.recipe ? 'dp, px or rem' : 'px or rem'}`);
    }
    decodeFamily(raw, at) {
        if (typeof raw === 'string')
            return new AuroraFontFamily([raw]);
        if (Array.isArray(raw) && raw.every((name) => typeof name === 'string')) {
            return new AuroraFontFamily(raw);
        }
        throw new AuroraFormatError(`${at} must be a font family name or list of names`);
    }
    decodeWeight(raw, at) {
        if (typeof raw === 'string') {
            const value = Object.prototype.hasOwnProperty.call(FONT_WEIGHT_NAMES, raw) ? FONT_WEIGHT_NAMES[raw] : undefined;
            if (value === undefined)
                throw new AuroraFormatError(`${at}: unknown font weight ${raw}`);
            return new AuroraFontWeight(value);
        }
        if (isFiniteNumber(raw) && Number.isInteger(raw))
            return new AuroraFontWeight(raw);
        throw new AuroraFormatError(`${at} must be an integer font weight or keyword`);
    }
    decodeDuration(raw, at) {
        const map = this.object(raw, at, ['value', 'unit']);
        const value = this.number(map['value'], `${at}.value`);
        switch (map['unit']) {
            case 'ms':
                return new AuroraDuration(value * 1000);
            case 's':
                return new AuroraDuration(value * 1000000);
        }
        throw new AuroraFormatError(`${at}.unit must be ms or s`);
    }
    decodeBezier(raw, at) {
        if (!Array.isArray(raw) || raw.length !== 4) {
            throw new AuroraFormatError(`${at} must be an array of four numbers`);
        }
        const p = raw.map((value, i) => this.number(value, `${at}[${i}]`));
        return new AuroraCubicBezier(p[0], p[1], p[2], p[3]);
    }
    decodeStroke(raw, at, dp) {
        if (typeof raw === 'string') {
            const keyword = AURORA_STROKE_KEYWORDS.includes(raw) ? raw : undefined;
            if (keyword === undefined || (keyword === 'none' && !this.recipe)) {
                throw new AuroraFormatError(`${at}: unsupported stroke style ${raw}`);
            }
            return AuroraStrokeStyle.keyword(keyword);
        }
        const map = this.object(raw, at, ['dashArray', 'lineCap']);
        const dashes = map['dashArray'];
        if (!Array.isArray(dashes) || dashes.length === 0) {
            throw new AuroraFormatError(`${at}.dashArray must be a nonempty array`);
        }
        const cap = LINE_CAPS.find((value) => value === map['lineCap']);
        if (cap === undefined)
            throw new AuroraFormatError(`${at}.lineCap must be round, butt or square`);
        const refs = dashes.map((dash, i) => this.dimensionField(dash, `${at}.dashArray[${i}]`, dp));
        if (refs.every((ref) => isKind(ref, 'dimension') && ref.value === 0))
            return AuroraStrokeStyle.none;
        return AuroraStrokeStyle.dashes(refs, cap);
    }
    decodeBorder(raw, at, dp) {
        const map = this.object(raw, at, ['color', 'width', 'style']);
        return new AuroraBorder({
            color: this.colorField(map['color'], `${at}.color`),
            width: this.dimensionField(map['width'], `${at}.width`, dp),
            style: this.field(map['style'], `${at}.style`, 'strokeStyle', (value) => this.decodeStroke(value, `${at}.style`, dp)),
        });
    }
    decodeShadow(raw, at, dp) {
        const layers = Array.isArray(raw) ? raw : [raw];
        return new AuroraShadow(layers.map((layer, i) => {
            const where = Array.isArray(raw) ? `${at}[${i}]` : at;
            const map = this.object(layer, where, ['color', 'offsetX', 'offsetY', 'blur', 'spread'], ['inset']);
            const inset = map['inset'] ?? false;
            if (typeof inset !== 'boolean')
                throw new AuroraFormatError(`${where}.inset must be bool`);
            return new AuroraShadowLayer({
                color: this.colorField(map['color'], `${where}.color`),
                offsetX: this.dimensionField(map['offsetX'], `${where}.offsetX`, dp),
                offsetY: this.dimensionField(map['offsetY'], `${where}.offsetY`, dp),
                blur: this.dimensionField(map['blur'], `${where}.blur`, dp),
                spread: this.dimensionField(map['spread'], `${where}.spread`, dp),
                inset,
            });
        }));
    }
    decodeTypography(raw, at, dp) {
        const map = this.object(raw, at, ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight']);
        return new AuroraTypography({
            fontFamily: this.field(map['fontFamily'], `${at}.fontFamily`, 'fontFamily', (value) => this.decodeFamily(value, `${at}.fontFamily`)),
            fontSize: this.dimensionField(map['fontSize'], `${at}.fontSize`, dp),
            fontWeight: this.field(map['fontWeight'], `${at}.fontWeight`, 'fontWeight', (value) => this.decodeWeight(value, `${at}.fontWeight`)),
            letterSpacing: this.dimensionField(map['letterSpacing'], `${at}.letterSpacing`, dp),
            lineHeight: this.field(map['lineHeight'], `${at}.lineHeight`, 'number', (value) => this.number(value, `${at}.lineHeight`)),
        });
    }
}
