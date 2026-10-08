import { AuroraFormatError, AuroraValidationError } from './errors.js';
import { hasOwn, isJsonObject } from './json.js';
import { AuroraTexture } from './texture.js';
import { TextureCodec } from './textureCodec.js';
const EXTENSION_KEY = 'dev.aurora';
const DTCG_KEYS = new Set(['$type', '$value', '$description', '$extensions', '$deprecated']);
const AURORA_KEYS = new Set(['type', 'values', 'unit']);
/**
 * DTCG 2025.10 profile for textures: one document holds one complete texture.
 *
 * Every DTCG token type Aurora supports is written with its standard `$type`.
 * Booleans and enums, which DTCG lacks, have no `$type` and are marked with
 * `$extensions["dev.aurora"]` (`{"type": "boolean"}` or
 * `{"type": "enum", "values": [...]}`). Dimensions in dp are written as `px`
 * with `{"unit": "dp"}` in the same extension. Aliases are kept as `{path}`
 * references. References to theme colour tokens (for example
 * `{colors.outline}`) resolve against the active theme, not this document.
 * Texture identity lives outside the document.
 */
export const AuroraTextureDtcg = Object.freeze({
    extensionKey: EXTENSION_KEY,
    encode(texture) {
        const codec = new TextureCodec(texture.contract, false);
        const document = {};
        for (const token of texture.contract.tokens.values()) {
            const parts = token.path.split('.');
            let group = document;
            for (const part of parts.slice(0, -1))
                group = (group[part] ??= {});
            const authored = texture.authored(token);
            const extension = {};
            if (token.type === 'boolean')
                extension['type'] = 'boolean';
            if (token.type === 'enum') {
                extension['type'] = 'enum';
                extension['values'] = [...token.values];
            }
            if (TextureCodec.usesDp(authored))
                extension['unit'] = 'dp';
            const entry = {};
            if (token.type !== 'boolean' && token.type !== 'enum')
                entry['$type'] = token.type;
            entry['$description'] = token.description;
            entry['$value'] = codec.encode(authored);
            if (Object.keys(extension).length > 0)
                entry['$extensions'] = { [EXTENSION_KEY]: extension };
            group[parts[parts.length - 1]] = entry;
        }
        return document;
    },
    decode(document, options) {
        const { contract } = options;
        if (!isJsonObject(document))
            throw new AuroraFormatError('Expected a DTCG token document object');
        const raw = new Map();
        const visit = (node, path, inheritedType) => {
            for (const key of Object.keys(node)) {
                if (key.startsWith('$') && !DTCG_KEYS.has(key)) {
                    throw new AuroraFormatError(`Unsupported DTCG property ${key} at ${path}`);
                }
            }
            if (hasOwn(node, '$type') && typeof node['$type'] !== 'string') {
                throw new AuroraFormatError(`Invalid token type at ${path}`);
            }
            if (hasOwn(node, '$description') && typeof node['$description'] !== 'string') {
                throw new AuroraFormatError(`Invalid description at ${path}`);
            }
            const extensions = node['$extensions'];
            if (extensions !== undefined && extensions !== null && !isJsonObject(extensions)) {
                throw new AuroraFormatError(`Invalid extensions metadata at ${path}`);
            }
            const aurora = isJsonObject(extensions) ? extensions[EXTENSION_KEY] : undefined;
            if (aurora !== undefined && aurora !== null && !isJsonObject(aurora)) {
                throw new AuroraFormatError(`Invalid ${EXTENSION_KEY} metadata at ${path}`);
            }
            const type = node['$type'] ?? inheritedType;
            if (hasOwn(node, '$value')) {
                if (path === '' || Object.keys(node).some((key) => !key.startsWith('$'))) {
                    throw new AuroraFormatError(`Invalid token/group structure at ${path}`);
                }
                raw.set(path, { value: node['$value'], type, aurora: isJsonObject(aurora) ? aurora : {} });
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
        visit(document, '', null);
        const issues = [
            ...[...contract.tokens.keys()].filter((path) => !raw.has(path)).map((path) => `Missing required token ${path}`),
            ...[...raw.keys()].filter((path) => !contract.tokens.has(path)).map((path) => `Undeclared token ${path}`),
        ];
        if (issues.length > 0)
            throw new AuroraValidationError(issues);
        const codec = new TextureCodec(contract, false);
        const values = new Map();
        for (const token of contract.tokens.values()) {
            const entry = raw.get(token.path);
            const aurora = entry.aurora;
            const unknown = Object.keys(aurora).filter((key) => !AURORA_KEYS.has(key));
            if (unknown.length > 0) {
                throw new AuroraFormatError(`Unsupported ${EXTENSION_KEY} fields at ${token.path}: ${unknown.join(', ')}`);
            }
            const isAliasValue = typeof entry.value === 'string' && entry.value.startsWith('{');
            const type = entry.type ?? null;
            if (token.type === 'boolean' || token.type === 'enum') {
                if (type !== null || aurora['type'] !== token.type) {
                    throw new AuroraFormatError(`${token.path} must be marked with ${EXTENSION_KEY} type ${token.type} and no $type`);
                }
                if (token.type === 'enum') {
                    const allowed = token.values;
                    const declared = aurora['values'];
                    if (!Array.isArray(declared) ||
                        declared.length !== allowed.length ||
                        !allowed.every((value) => declared.includes(value))) {
                        throw new AuroraFormatError(`${token.path} records allowed values that differ from the contract`);
                    }
                }
            }
            else if (type !== token.type && !(isAliasValue && type === null)) {
                throw new AuroraFormatError(`${token.path} must have type ${token.type}, not ${String(type)}`);
            }
            if (hasOwn(aurora, 'unit') && aurora['unit'] !== 'dp') {
                throw new AuroraFormatError(`Unsupported ${EXTENSION_KEY} unit at ${token.path}`);
            }
            values.set(token, codec.decode(token, entry.value, token.path, aurora['unit'] === 'dp'));
        }
        return new AuroraTexture({ contract, id: options.id, name: options.name, values });
    },
});
