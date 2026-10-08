import { AuroraColor } from './color.js';
import { AuroraContract } from './contract.js';
import { AuroraContrast } from './contrast.js';
import { AuroraDtcg } from './dtcg.js';
import { AuroraArgumentError, AuroraValidationError } from './errors.js';
import { AuroraFoundation } from './foundation.js';
import { materialRoleValues } from './materialRoles.js';
import { DynamicScheme, schemeFor, Variant } from './mcu/dynamic.js';
import { Hct } from './mcu/hct.js';
import { TonalPalette } from './mcu/palette.js';
import { AURORA_APPEARANCES, AuroraTheme, AuroraThemeVariant } from './theme.js';
export const AURORA_GENERATION_SCHEMES = Object.freeze([
    'tonalSpot',
    'fidelity',
    'vibrant',
    'expressive',
    'content',
    'monochrome',
    'neutral',
    'rainbow',
    'fruitSalad',
]);
export const AURORA_PALETTES = Object.freeze([
    'primary',
    'secondary',
    'tertiary',
    'neutral',
    'neutralVariant',
    'error',
    'success',
    'warning',
    'info',
]);
/** Copy an already resolved token, including a deliberate override. */
export class AuroraAliasRule {
    target;
    kind = 'alias';
    constructor(target) {
        this.target = target;
        Object.freeze(this);
    }
}
/** Select an HCT tone from a generated palette for each appearance. */
export class AuroraToneRule {
    kind = 'tone';
    palette;
    lightTone;
    darkTone;
    constructor(init) {
        for (const tone of [init.lightTone, init.darkTone]) {
            if (!Number.isFinite(tone) || tone < 0 || tone > 100) {
                throw new AuroraArgumentError('Tone must be finite and in [0, 100]');
            }
        }
        this.palette = init.palette;
        this.lightTone = init.lightTone;
        this.darkTone = init.darkTone;
        Object.freeze(this);
    }
}
/** Immutable input. Explicit values override rules and generated defaults. */
export class AuroraGenerationRequest {
    scheme;
    contract;
    id;
    name;
    seeds;
    appearances;
    preferredAppearance;
    values;
    variantValues;
    rules;
    contrastPairs;
    constructor(init) {
        const { contract } = init;
        if (init.id.trim() === '' || init.name.trim() === '') {
            throw new AuroraArgumentError('Theme identity must not be empty');
        }
        const requested = [...(init.appearances ?? AURORA_APPEARANCES)];
        const preferred = init.preferredAppearance ?? 'light';
        if (requested.length === 0 || new Set(requested).size !== requested.length || !requested.includes(preferred)) {
            throw new AuroraArgumentError('Choose unique appearances including the preferred appearance');
        }
        // Canonical order makes output independent of the caller's input ordering.
        requested.sort((a, b) => AURORA_APPEARANCES.indexOf(a) - AURORA_APPEARANCES.indexOf(b));
        const seeds = new Map([['primary', init.primary]]);
        if (init.secondary !== undefined)
            seeds.set('secondary', init.secondary);
        if (init.tertiary !== undefined)
            seeds.set('tertiary', init.tertiary);
        seeds.set('success', init.success ?? AuroraColor.hex('#146c2e'));
        seeds.set('warning', init.warning ?? AuroraColor.hex('#805600'));
        seeds.set('info', init.info ?? AuroraColor.hex('#0061a4'));
        if ([...seeds.values()].some((color) => color.alpha !== 255)) {
            throw new AuroraArgumentError('Seed colors must be opaque');
        }
        const validateToken = (token) => {
            if (!contract.contains(token))
                throw new AuroraArgumentError(`Undeclared generation token ${token.path}`);
        };
        const values = new Map(init.values ?? []);
        for (const token of values.keys())
            validateToken(token);
        const variantValues = new Map();
        for (const [appearance, entries] of Object.entries(init.variantValues ?? {})) {
            if (entries === undefined)
                continue;
            if (!requested.includes(appearance)) {
                throw new AuroraArgumentError('Values supplied for an unrequested appearance');
            }
            const map = new Map(entries);
            for (const token of map.keys())
                validateToken(token);
            variantValues.set(appearance, map);
        }
        const foundation = new Set(AuroraFoundation.tokens);
        const rules = new Map(init.rules ?? []);
        for (const [token, rule] of rules) {
            validateToken(token);
            if (foundation.has(token)) {
                throw new AuroraArgumentError('Rules are for app extensions; use values to override foundation tokens');
            }
            if (rule.kind === 'alias')
                validateToken(rule.target);
        }
        const pairs = [...(init.contrastPairs ?? [])];
        for (const pair of pairs) {
            validateToken(pair.foreground);
            validateToken(pair.background);
        }
        this.contract = contract;
        this.id = init.id;
        this.name = init.name;
        this.seeds = seeds;
        this.appearances = Object.freeze(requested);
        this.preferredAppearance = preferred;
        this.values = values;
        this.variantValues = variantValues;
        this.rules = rules;
        this.contrastPairs = Object.freeze(pairs);
        this.scheme = init.scheme ?? 'tonalSpot';
        Object.freeze(this);
    }
}
export class AuroraGenerationResult {
    theme;
    scheme;
    checks;
    constructor(theme, checks, scheme) {
        this.theme = theme;
        this.scheme = scheme;
        this.checks = Object.freeze([...checks]);
        Object.freeze(this);
    }
    get algorithm() {
        return AuroraGenerator.algorithmFor(this.scheme);
    }
    get issues() {
        return this.checks.filter((check) => check.status !== 'pass');
    }
    /** Printable diagnostics without logging or other IO. */
    debugReport() {
        const issues = this.issues;
        if (issues.length === 0)
            return 'No declared contrast issues.';
        return issues
            .map((check) => `${check.appearance}: ${check.pair.foreground.path} / ${check.pair.background.path}: ` +
            `${check.status}, ratio ${check.ratio === null ? 'unknown' : check.ratio.toFixed(2)} ` +
            `(minimum ${check.pair.minimumRatio})`)
            .join('\n');
    }
    /** An Aurora manifest with DTCG variant documents; not itself a DTCG document. */
    toJson() {
        const variants = {};
        for (const [appearance, variant] of this.theme.variants)
            variants[appearance] = AuroraDtcg.encode(variant);
        return {
            algorithm: this.algorithm,
            foundationVersion: AuroraFoundation.version,
            contract: { id: this.theme.contract.id, version: this.theme.contract.version },
            id: this.theme.id,
            name: this.theme.name,
            preferredAppearance: this.theme.preferredAppearance,
            variants,
            contrast: this.checks.map((check) => check.toJson()),
        };
    }
}
const VARIANTS = {
    tonalSpot: Variant.tonalSpot,
    fidelity: Variant.fidelity,
    vibrant: Variant.vibrant,
    expressive: Variant.expressive,
    content: Variant.content,
    monochrome: Variant.monochrome,
    neutral: Variant.neutral,
    rainbow: Variant.rainbow,
    fruitSalad: Variant.fruitSalad,
};
function scheme(seed, appearance, kind = 'tonalSpot') {
    return schemeFor(VARIANTS[kind], Hct.fromInt(seed.argb), appearance === 'dark', 0);
}
function toneColor(palette, tone) {
    return new AuroraColor(Hct.from(palette.hue, palette.chroma, tone).toInt());
}
const STATUS_PALETTES = ['success', 'warning', 'info'];
/** Deterministic generation, independent of widgets, storage, network, or device. */
export const AuroraGenerator = Object.freeze({
    algorithm: 'aurora-tonal-v1-mcu-0.11.1',
    algorithmFor(scheme) {
        return scheme === 'tonalSpot' ? AuroraGenerator.algorithm : `aurora-${scheme}-v1-mcu-0.11.1`;
    },
    /**
     * Foundation-only snapshots for per-entity branding. Never registers a theme
     * or supplies values for an app contract's extensions.
     */
    variants(seed, scheme = 'tonalSpot') {
        return AuroraGenerator.generate(new AuroraGenerationRequest({
            contract: new AuroraContract({ id: 'aurora-foundation' }),
            id: 'seed',
            name: 'Seed',
            primary: seed,
            scheme,
        })).theme.variants;
    },
    generate(request) {
        const variants = [];
        const checks = [];
        const tokens = request.contract.tokens;
        for (const appearance of request.appearances) {
            const base = scheme(request.seeds.get('primary'), appearance, request.scheme);
            const secondarySeed = request.seeds.get('secondary');
            const tertiarySeed = request.seeds.get('tertiary');
            const primaryScheme = new DynamicScheme({
                sourceColorArgb: base.sourceColorArgb,
                variant: base.variant,
                isDark: base.isDark,
                primaryPalette: base.primaryPalette,
                secondaryPalette: secondarySeed === undefined ? base.secondaryPalette : TonalPalette.fromHct(Hct.fromInt(secondarySeed.argb)),
                tertiaryPalette: tertiarySeed === undefined ? base.tertiaryPalette : TonalPalette.fromHct(Hct.fromInt(tertiarySeed.argb)),
                neutralPalette: base.neutralPalette,
                neutralVariantPalette: base.neutralVariantPalette,
            });
            const status = new Map(STATUS_PALETTES.map((palette) => [palette, scheme(request.seeds.get(palette), appearance)]));
            const values = materialRoleValues(primaryScheme);
            for (const [palette, statusScheme] of status) {
                const cap = palette[0].toUpperCase() + palette.substring(1);
                values.set(tokens.get(`colors.${palette}`), new AuroraColor(statusScheme.primary));
                values.set(tokens.get(`colors.on${cap}`), new AuroraColor(statusScheme.onPrimary));
                values.set(tokens.get(`colors.${palette}Container`), new AuroraColor(statusScheme.primaryContainer));
                values.set(tokens.get(`colors.on${cap}Container`), new AuroraColor(statusScheme.onPrimaryContainer));
            }
            for (const [token, color] of request.values)
                values.set(token, color);
            for (const [token, color] of request.variantValues.get(appearance) ?? [])
                values.set(token, color);
            const palettes = new Map([
                ['primary', primaryScheme.primaryPalette],
                ['secondary', primaryScheme.secondaryPalette],
                ['tertiary', primaryScheme.tertiaryPalette],
                ['neutral', primaryScheme.neutralPalette],
                ['neutralVariant', primaryScheme.neutralVariantPalette],
                ['error', primaryScheme.errorPalette],
                ...[...status].map(([palette, s]) => [palette, s.primaryPalette]),
            ]);
            const visiting = new Set();
            const issues = [];
            const resolve = (token) => {
                const known = values.get(token);
                if (known !== undefined)
                    return known;
                if (visiting.has(token)) {
                    throw new AuroraValidationError([`Cyclic generation rule at ${token.path} (${appearance})`]);
                }
                visiting.add(token);
                const rule = request.rules.get(token);
                let color;
                if (rule?.kind === 'alias') {
                    color = resolve(rule.target);
                }
                else if (rule?.kind === 'tone') {
                    color = toneColor(palettes.get(rule.palette), appearance === 'light' ? rule.lightTone : rule.darkTone);
                }
                visiting.delete(token);
                if (color !== undefined)
                    values.set(token, color);
                return color;
            };
            for (const token of tokens.values()) {
                if (resolve(token) === undefined) {
                    issues.push(`Missing value or generation rule for ${token.path} (${appearance})`);
                }
            }
            if (issues.length > 0)
                throw new AuroraValidationError(issues);
            const variant = new AuroraThemeVariant({ contract: request.contract, appearance, values });
            variants.push(variant);
            checks.push(...AuroraContrast.check(variant, request.contrastPairs));
        }
        return new AuroraGenerationResult(new AuroraTheme({
            id: request.id,
            name: request.name,
            variants,
            preferredAppearance: request.preferredAppearance,
        }), checks, request.scheme);
    },
});
