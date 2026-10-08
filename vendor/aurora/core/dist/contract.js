import { AuroraArgumentError } from './errors.js';
import { AuroraFoundation } from './foundation.js';
export const TOKEN_PATH = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/;
const foundationTokens = new Set(AuroraFoundation.tokens);
/**
 * Foundation plus app-owned additions. Every declared token is required. Use one
 * contract instance per app: themes, runtimes and generator requests check it by
 * identity, as tokens are.
 */
export class AuroraContract {
    id;
    version;
    tokens;
    constructor(init) {
        const version = init.version ?? 1;
        if (init.id.trim() === '' || !Number.isInteger(version) || version < 1) {
            throw new AuroraArgumentError('Contract needs a nonempty id and a positive version');
        }
        const tokens = new Map();
        for (const token of [...AuroraFoundation.tokens, ...(init.extensions ?? [])]) {
            if (token.type !== 'color') {
                throw new AuroraArgumentError(`Theme contracts declare colour tokens only: ${token.path}`);
            }
            if (!TOKEN_PATH.test(token.path) || token.description.trim() === '') {
                throw new AuroraArgumentError(`Token ${token.path} needs a valid dotted path and description`);
            }
            if (tokens.has(token.path)) {
                throw new AuroraArgumentError(`Duplicate or redefined token: ${token.path}`);
            }
            if (!foundationTokens.has(token) && token.path.startsWith('colors.')) {
                throw new AuroraArgumentError(`The colors namespace belongs to Aurora: ${token.path}`);
            }
            for (const path of tokens.keys()) {
                if (path.startsWith(`${token.path}.`) || token.path.startsWith(`${path}.`)) {
                    throw new AuroraArgumentError(`Token/group path collision: ${token.path}`);
                }
            }
            tokens.set(token.path, token);
        }
        this.id = init.id;
        this.version = version;
        this.tokens = tokens;
        Object.freeze(this);
    }
    /** True when [token] is this contract's declaration (by identity). */
    contains(token) {
        return this.tokens.get(token.path) === token;
    }
}
