import { isAuroraColor } from './color.js';
import { AuroraArgumentError, AuroraValidationError } from './errors.js';
import { AuroraStarterValues } from './starters.js';
import { AuroraTokens } from './foundation.js';
export const AURORA_APPEARANCES = Object.freeze(['light', 'dark']);
/** Exact portable names; unknown values return undefined for caller-owned fallback. */
export function parseAppearancePreference(name) {
    return name === 'light' || name === 'dark' || name === 'system' ? name : undefined;
}
/** Complete, validated values for a single concrete appearance. */
export class AuroraThemeVariant {
    contract;
    appearance;
    values;
    _tokens;
    constructor(init) {
        const { contract } = init;
        const values = new Map(init.values);
        const issues = [];
        for (const token of contract.tokens.values()) {
            if (!values.has(token)) {
                issues.push(`Missing required token ${token.path}`);
            }
            else if (!isAuroraColor(values.get(token))) {
                issues.push(`${token.path} must be an AuroraColor`);
            }
        }
        for (const token of values.keys()) {
            if (!contract.contains(token))
                issues.push(`Undeclared token ${token.path}`);
        }
        if (issues.length > 0)
            throw new AuroraValidationError(issues);
        this.contract = contract;
        this.appearance = init.appearance;
        // Contract order, so iteration and export are deterministic.
        this.values = new Map([...contract.tokens.values()].map((token) => [token, values.get(token)]));
    }
    read(token) {
        if (!this.contract.contains(token)) {
            throw new AuroraArgumentError(`Token ${token.path} is not in this contract`);
        }
        return this.values.get(token);
    }
    /** Direct immutable token values, usable without any framework integration. */
    get tokens() {
        this._tokens ??= new AuroraTokens(this);
        return this._tokens;
    }
    /** Convenience alias for color-focused consumers. */
    get colors() {
        return this.tokens;
    }
}
/** Identity plus available complete variants, all using the same app contract. */
export class AuroraTheme {
    id;
    name;
    contract;
    variants;
    preferredAppearance;
    constructor(init) {
        if (init.id.trim() === '' || init.name.trim() === '') {
            throw new AuroraArgumentError('Theme id and name cannot be empty');
        }
        const byAppearance = new Map();
        let contract;
        for (const variant of init.variants) {
            contract ??= variant.contract;
            if (contract !== variant.contract) {
                throw new AuroraArgumentError('Variants must use the same contract instance');
            }
            if (byAppearance.has(variant.appearance)) {
                throw new AuroraArgumentError(`Duplicate ${variant.appearance} variant`);
            }
            byAppearance.set(variant.appearance, variant);
        }
        if (!byAppearance.has(init.preferredAppearance)) {
            throw new AuroraArgumentError('Preferred appearance must have a variant');
        }
        this.id = init.id;
        this.name = init.name;
        this.contract = contract;
        this.variants = byAppearance;
        this.preferredAppearance = init.preferredAppearance;
        Object.freeze(this);
    }
    /** The variant for [appearance], if the theme has one. */
    variant(appearance) {
        return this.variants.get(appearance);
    }
}
/** Complete explicit foundation presets; app extensions are still required. */
export const AuroraStarter = Object.freeze({
    light: AuroraStarterValues.light,
    dark: AuroraStarterValues.dark,
    variant(init) {
        const base = init.appearance === 'light' ? AuroraStarterValues.light : AuroraStarterValues.dark;
        return new AuroraThemeVariant({
            contract: init.contract,
            appearance: init.appearance,
            values: new Map([...base, ...new Map(init.values ?? [])]),
        });
    },
});
