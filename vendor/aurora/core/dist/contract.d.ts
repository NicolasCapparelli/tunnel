import type { AuroraColorToken } from './token.js';
export declare const TOKEN_PATH: RegExp;
export interface AuroraContractInit {
    id: string;
    version?: number;
    extensions?: Iterable<AuroraColorToken>;
}
/**
 * Foundation plus app-owned additions. Every declared token is required. Use one
 * contract instance per app: themes, runtimes and generator requests check it by
 * identity, as tokens are.
 */
export declare class AuroraContract {
    readonly id: string;
    readonly version: number;
    readonly tokens: ReadonlyMap<string, AuroraColorToken>;
    constructor(init: AuroraContractInit);
    /** True when [token] is this contract's declaration (by identity). */
    contains(token: AuroraColorToken): boolean;
}
