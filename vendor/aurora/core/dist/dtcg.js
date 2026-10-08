import { AuroraColor } from './color.js';
import { AuroraFormatError, AuroraValidationError } from './errors.js';
import { hasOwn, isFiniteNumber, isJsonObject } from './json.js';
import { dartRound } from './mcu/utils.js';
import { AuroraThemeVariant } from './theme.js';
export const REFERENCE = /^\{([a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*)\}$/;
const DTCG_KEYS = new Set(['$type', '$value', '$description', '$extensions', '$deprecated']);
const COLOR_KEYS = new Set(['colorSpace', 'components', 'alpha', 'hex']);
/**
 * DTCG 2025.10 color profile: groups, sRGB colors, and whole-token aliases. One
 * document represents one variant; identity and appearance live outside it.
 * Unsupported constructs fail explicitly; this is not a full DTCG resolver.
 */
export const AuroraDtcg = Object.freeze({
    encode(variant) {
        const document = {};
        for (const [token, color] of variant.values) {
            const parts = token.path.split('.');
            let group = document;
            for (const part of parts.slice(0, -1)) {
                group = (group[part] ??= {});
            }
            group[parts[parts.length - 1]] = {
                $type: 'color',
                $description: token.description,
                $value: AuroraDtcg.encodeColorValue(color),
            };
        }
        return document;
    },
    decode(document, options) {
        const { contract } = options;
        if (!isJsonObject(document))
            throw new AuroraFormatError('Expected a DTCG token document object');
        const raw = new Map();
        const visit = (node, path, inheritedType) => {
            if (hasOwn(node, '$type') && typeof node['$type'] !== 'string') {
                throw new AuroraFormatError(`Invalid token type at ${path}`);
            }
            if (hasOwn(node, '$description') && typeof node['$description'] !== 'string') {
                throw new AuroraFormatError(`Invalid description at ${path}`);
            }
            if (hasOwn(node, '$extensions') && !isJsonObject(node['$extensions'])) {
                throw new AuroraFormatError(`Invalid extensions metadata at ${path}`);
            }
            if (hasOwn(node, '$deprecated') &&
                typeof node['$deprecated'] !== 'boolean' &&
                typeof node['$deprecated'] !== 'string') {
                throw new AuroraFormatError(`Invalid deprecation metadata at ${path}`);
            }
            const type = hasOwn(node, '$type') ? node['$type'] : inheritedType;
            for (const key of Object.keys(node)) {
                if (key.startsWith('$') && !DTCG_KEYS.has(key)) {
                    throw new AuroraFormatError(`Unsupported DTCG property ${key} at ${path}`);
                }
            }
            if (hasOwn(node, '$value')) {
                if (path === '' || Object.keys(node).some((key) => !key.startsWith('$'))) {
                    throw new AuroraFormatError(`Invalid token/group structure at ${path}`);
                }
                if (type !== undefined && type !== null && type !== 'color') {
                    throw new AuroraFormatError(`Unsupported type ${String(type)} at ${path}`);
                }
                raw.set(path, { value: node['$value'], type });
                return;
            }
            for (const [key, child] of Object.entries(node)) {
                if (key.startsWith('$'))
                    continue;
                if (key.includes('.') || !isJsonObject(child)) {
                    throw new AuroraFormatError(`Expected a named group or token at ${path}.${key}`);
                }
                visit(child, path === '' ? key : `${path}.${key}`, type);
            }
        };
        visit(document, '', undefined);
        const issues = [];
        for (const path of contract.tokens.keys()) {
            if (!raw.has(path))
                issues.push(`Missing required token ${path}`);
        }
        for (const path of raw.keys()) {
            if (!contract.tokens.has(path))
                issues.push(`Undeclared token ${path}`);
        }
        if (issues.length > 0)
            throw new AuroraValidationError(issues);
        const resolved = new Map();
        const visiting = new Set();
        const resolve = (path) => {
            const done = resolved.get(path);
            if (done !== undefined)
                return done;
            const token = raw.get(path);
            if (token === undefined)
                throw new AuroraFormatError(`Unknown alias target ${path}`);
            if (visiting.has(path))
                throw new AuroraFormatError(`Cyclic token alias at ${path}`);
            visiting.add(path);
            const value = token.value;
            let color;
            if (typeof value === 'string') {
                const reference = REFERENCE.exec(value);
                if (reference === null)
                    throw new AuroraFormatError(`Expected a whole-token alias at ${path}`);
                color = resolve(reference[1]);
            }
            else {
                if (token.type !== 'color')
                    throw new AuroraFormatError(`Missing color type at ${path}`);
                color = AuroraDtcg.decodeColorValue(value, path);
            }
            visiting.delete(path);
            resolved.set(path, color);
            return color;
        };
        return new AuroraThemeVariant({
            contract,
            appearance: options.appearance,
            values: [...contract.tokens.values()].map((token) => [token, resolve(token.path)]),
        });
    },
    /** The structured sRGB `$value` for [color]. */
    encodeColorValue(color) {
        return {
            colorSpace: 'srgb',
            components: [color.red / 255, color.green / 255, color.blue / 255],
            alpha: color.alpha / 255,
        };
    },
    /** Decodes a structured sRGB `$value`; [path] names it in errors. */
    decodeColorValue(raw, path) {
        if (!isJsonObject(raw) || raw['colorSpace'] !== 'srgb') {
            throw new AuroraFormatError(`Expected a structured sRGB color at ${path}`);
        }
        if (Object.keys(raw).some((key) => !COLOR_KEYS.has(key))) {
            throw new AuroraFormatError(`Unsupported color property at ${path}`);
        }
        const components = raw['components'];
        if (!Array.isArray(components) || components.length !== 3) {
            throw new AuroraFormatError(`Expected three sRGB components at ${path}`);
        }
        const channel = (value) => {
            if (!isFiniteNumber(value) || value < 0 || value > 1) {
                throw new AuroraFormatError(`Expected a finite color channel in [0, 1] at ${path}`);
            }
            return dartRound(value * 255);
        };
        const red = channel(components[0]);
        const green = channel(components[1]);
        const blue = channel(components[2]);
        const alpha = channel(hasOwn(raw, 'alpha') ? raw['alpha'] : 1);
        if (hasOwn(raw, 'hex')) {
            const hex = raw['hex'];
            if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
                throw new AuroraFormatError(`Invalid optional hex fallback at ${path}`);
            }
        }
        return AuroraColor.rgba(red, green, blue, alpha);
    },
});
