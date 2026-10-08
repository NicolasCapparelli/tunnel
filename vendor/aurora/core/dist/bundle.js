import { AuroraContract } from './contract.js';
import { AuroraDtcg } from './dtcg.js';
import { AuroraError, AuroraFormatError, AuroraValidationError } from './errors.js';
import { hasOwn, isJsonObject } from './json.js';
import { AuroraTextureContract } from './texture.js';
import { AuroraTextureDtcg } from './textureDtcg.js';
import { AuroraTheme } from './theme.js';
const ID = /^[a-z][a-z0-9_-]{0,79}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const APPEARANCES = ['light', 'dark'];
const TEXTURE_FILE = 'texture.tokens.json';
let foundationContract;
let textureFoundationContract;
function variantFile(appearance) {
    return `${appearance}.tokens.json`;
}
function decodeIssues(error, file) {
    if (error instanceof AuroraValidationError || (error instanceof AuroraError && error.category === 'validation')) {
        return error.issues.map((message) => ({ category: 'validation', file, message }));
    }
    if (error instanceof AuroraError) {
        return [{ category: error.category === 'validation' ? 'validation' : 'format', file, message: error.message }];
    }
    throw error;
}
/** Checks the manifest, collecting issues; returns it when its shape is usable. */
function checkManifest(raw, issues) {
    const issue = (message) => {
        issues.push({ category: 'format', file: 'manifest', message });
    };
    if (!isJsonObject(raw)) {
        issue('manifest must be an object');
        return undefined;
    }
    const fields = (value, allowed, at) => {
        const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
        if (unknown.length > 0)
            issue(`${at} has unsupported fields ${unknown.join(', ')}`);
    };
    const text = (value, at) => {
        if (typeof value === 'string' && value.trim() !== '')
            return value;
        issue(`${at} must be a nonempty string`);
        return undefined;
    };
    const id = (value, at) => {
        if (typeof value === 'string' && ID.test(value))
            return value;
        issue(`${at} must be 1-80 lowercase letters, digits, _ or -, starting with a letter`);
        return undefined;
    };
    fields(raw, ['bundleVersion', 'theme', 'texture', 'pairing', 'provenance'], 'manifest');
    if (raw['bundleVersion'] !== 1)
        issue('bundleVersion must be 1');
    let usable = true;
    let theme;
    if (!isJsonObject(raw['theme'])) {
        issue('theme must be an object');
        usable = false;
    }
    else {
        const t = raw['theme'];
        fields(t, ['id', 'name', 'preferredAppearance', 'variants'], 'theme');
        const themeId = id(t['id'], 'theme.id');
        const name = text(t['name'], 'theme.name');
        const variants = t['variants'];
        let list;
        if (!Array.isArray(variants) ||
            variants.length === 0 ||
            variants.some((v) => !APPEARANCES.includes(v)) ||
            new Set(variants).size !== variants.length) {
            issue('theme.variants must be a nonempty array of unique light/dark');
        }
        else {
            list = variants;
        }
        const preferred = t['preferredAppearance'];
        if (list !== undefined && !list.includes(preferred)) {
            issue('theme.preferredAppearance must be one of theme.variants');
        }
        if (themeId !== undefined && name !== undefined && list !== undefined && list.includes(preferred)) {
            theme = { id: themeId, name, preferredAppearance: preferred, variants: list };
        }
        else {
            usable = false;
        }
    }
    let texture;
    if (hasOwn(raw, 'texture')) {
        if (!isJsonObject(raw['texture'])) {
            issue('texture must be an object');
            usable = false;
        }
        else {
            fields(raw['texture'], ['id', 'name'], 'texture');
            const textureId = id(raw['texture']['id'], 'texture.id');
            const name = text(raw['texture']['name'], 'texture.name');
            if (textureId !== undefined && name !== undefined)
                texture = { id: textureId, name };
            else
                usable = false;
        }
    }
    let pairing;
    if (hasOwn(raw, 'pairing')) {
        const p = raw['pairing'];
        if (!isJsonObject(p)) {
            issue('pairing must be an object');
        }
        else {
            fields(p, ['themeId', 'textureId'], 'pairing');
            if (!hasOwn(raw, 'texture'))
                issue('pairing needs a texture');
            if (theme !== undefined && p['themeId'] !== theme.id)
                issue('pairing.themeId must equal theme.id');
            if (texture !== undefined && p['textureId'] !== texture.id)
                issue('pairing.textureId must equal texture.id');
            if (typeof p['themeId'] === 'string' && typeof p['textureId'] === 'string') {
                pairing = { themeId: p['themeId'], textureId: p['textureId'] };
            }
        }
    }
    let provenance;
    if (!isJsonObject(raw['provenance'])) {
        issue('provenance must be an object');
    }
    else {
        const p = raw['provenance'];
        fields(p, ['generator', 'sourceHash', 'createdAt'], 'provenance');
        const generator = text(p['generator'], 'provenance.generator');
        const sourceHash = text(p['sourceHash'], 'provenance.sourceHash');
        const createdAt = p['createdAt'];
        if (typeof createdAt !== 'string' || !DATE_TIME.test(createdAt)) {
            issue('provenance.createdAt must be an RFC 3339 date-time');
        }
        else if (generator !== undefined && sourceHash !== undefined) {
            provenance = { generator, sourceHash, createdAt };
        }
    }
    if (!usable || theme === undefined || provenance === undefined)
        return undefined;
    return {
        bundleVersion: 1,
        theme,
        ...(texture === undefined ? {} : { texture }),
        ...(pairing === undefined ? {} : { pairing }),
        provenance,
    };
}
/** Portable bundle v1: decode, validate and produce. See `spec/bundle-v1.md`. */
export const AuroraBundle = Object.freeze({
    /** The shared foundation-only theme contract used when no app contract is given. */
    get foundationContract() {
        foundationContract ??= new AuroraContract({ id: 'aurora-foundation' });
        return foundationContract;
    },
    /** The shared texture-foundation-only contract used when no app texture contract is given. */
    get textureFoundationContract() {
        textureFoundationContract ??= new AuroraTextureContract({ id: 'aurora-texture-foundation' });
        return textureFoundationContract;
    },
    /**
     * Validates a single-file bundle object (or a folder loaded into one) and
     * reports every issue. Never throws for invalid input.
     */
    validate(input, options = {}) {
        const contract = options.contract ?? AuroraBundle.foundationContract;
        const textureContract = options.textureContract ?? AuroraBundle.textureFoundationContract;
        const issues = [];
        const fail = () => ({ valid: false, issues, contents: undefined });
        if (!isJsonObject(input)) {
            issues.push({ category: 'format', file: 'bundle', message: 'A bundle must be an object with manifest and files' });
            return fail();
        }
        for (const key of Object.keys(input)) {
            if (key !== 'manifest' && key !== 'files') {
                issues.push({ category: 'format', file: 'bundle', message: `Unsupported bundle field ${key}` });
            }
        }
        const manifest = checkManifest(input['manifest'], issues);
        const files = input['files'];
        if (!isJsonObject(files)) {
            issues.push({ category: 'format', file: 'bundle', message: 'files must be an object of token documents' });
            return fail();
        }
        const expected = new Set();
        if (manifest !== undefined) {
            for (const appearance of manifest.theme.variants)
                expected.add(variantFile(appearance));
            if (manifest.texture !== undefined)
                expected.add(TEXTURE_FILE);
            for (const name of expected) {
                if (!hasOwn(files, name)) {
                    issues.push({ category: 'format', file: name, message: `${name} is listed by the manifest but missing` });
                }
            }
            for (const name of Object.keys(files)) {
                if (!expected.has(name)) {
                    issues.push({ category: 'format', file: name, message: `${name} is not listed by the manifest` });
                }
            }
        }
        const variants = [];
        for (const appearance of APPEARANCES) {
            const name = variantFile(appearance);
            if (!hasOwn(files, name) || (manifest !== undefined && !expected.has(name)))
                continue;
            try {
                variants.push(AuroraDtcg.decode(files[name], { contract, appearance }));
            }
            catch (error) {
                issues.push(...decodeIssues(error, name));
            }
        }
        let texture;
        if (hasOwn(files, TEXTURE_FILE) && (manifest === undefined || expected.has(TEXTURE_FILE))) {
            try {
                texture = AuroraTextureDtcg.decode(files[TEXTURE_FILE], {
                    contract: textureContract,
                    id: manifest?.texture?.id ?? 'texture',
                    name: manifest?.texture?.name ?? 'Texture',
                });
                texture.validateColors(contract);
            }
            catch (error) {
                texture = undefined;
                issues.push(...decodeIssues(error, TEXTURE_FILE));
            }
        }
        if (issues.length > 0 || manifest === undefined)
            return fail();
        const theme = new AuroraTheme({
            id: manifest.theme.id,
            name: manifest.theme.name,
            preferredAppearance: manifest.theme.preferredAppearance,
            variants,
        });
        return { valid: true, issues, contents: { manifest, theme, texture, pairing: manifest.pairing } };
    },
    /**
     * Validates and returns the bundle's theme, texture and pairing. Throws an
     * `AuroraFormatError` when any issue is a format issue, otherwise an
     * `AuroraValidationError` listing every issue as `file: message`.
     */
    load(input, options = {}) {
        const report = AuroraBundle.validate(input, options);
        if (report.contents !== undefined)
            return report.contents;
        const lines = report.issues.map((issue) => `${issue.file}: ${issue.message}`);
        if (report.issues.some((issue) => issue.category === 'format'))
            throw new AuroraFormatError(lines.join('\n'));
        throw new AuroraValidationError(lines);
    },
    /** Assembles the single-file form from a folder's `manifest.json` and token files. */
    fromFolder(manifest, files) {
        return { manifest, files };
    },
    /** Produces a single-file bundle from a theme and an optional texture. */
    encode(init) {
        const { theme, texture } = init;
        const variants = APPEARANCES.filter((appearance) => theme.variants.has(appearance));
        const files = {};
        for (const appearance of variants)
            files[variantFile(appearance)] = AuroraDtcg.encode(theme.variants.get(appearance));
        if (texture !== undefined)
            files[TEXTURE_FILE] = AuroraTextureDtcg.encode(texture);
        const pair = texture !== undefined && (init.pair ?? true);
        return {
            manifest: {
                bundleVersion: 1,
                theme: { id: theme.id, name: theme.name, preferredAppearance: theme.preferredAppearance, variants },
                ...(texture === undefined ? {} : { texture: { id: texture.id, name: texture.name } }),
                ...(pair ? { pairing: { themeId: theme.id, textureId: texture.id } } : {}),
                provenance: { ...init.provenance },
            },
            files,
        };
    },
});
