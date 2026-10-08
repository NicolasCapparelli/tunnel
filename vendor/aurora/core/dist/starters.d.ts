import { AuroraColor } from './color.js';
import type { AuroraColorToken } from './token.js';
/** Complete explicit foundation presets; app extensions are still required. */
export declare const AuroraStarterValues: Readonly<{
    light: ReadonlyMap<AuroraColorToken, AuroraColor>;
    dark: ReadonlyMap<AuroraColorToken, AuroraColor>;
}>;
