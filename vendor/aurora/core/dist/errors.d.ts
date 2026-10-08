/**
 * Error categories shared with the Dart core. Messages may differ between
 * languages; categories may not.
 *
 * - `validation`: contract completeness or value rules, listing every issue
 *   (Dart `AuroraValidationException`).
 * - `format`: malformed or unsupported input (Dart `FormatException`).
 * - `argument`: an invalid call, such as an unknown theme id (Dart `ArgumentError`).
 * - `state`: an operation the current state does not allow, such as a missing
 *   variant under the reject policy or a disposed runtime (Dart `StateError`).
 */
export type AuroraErrorCategory = 'validation' | 'format' | 'argument' | 'state';
export declare abstract class AuroraError extends Error {
    abstract readonly category: AuroraErrorCategory;
}
/** Reports every completeness and type problem instead of stopping at the first. */
export declare class AuroraValidationError extends AuroraError {
    readonly category: "validation";
    readonly issues: readonly string[];
    constructor(issues: Iterable<string>);
}
/** Malformed or unsupported input. */
export declare class AuroraFormatError extends AuroraError {
    readonly category: "format";
    constructor(message: string);
}
/** An invalid argument, such as an unknown id or an inconsistent declaration. */
export declare class AuroraArgumentError extends AuroraError {
    readonly category: "argument";
    constructor(message: string);
}
/** The requested operation is not possible in the current state. */
export declare class AuroraStateError extends AuroraError {
    readonly category: "state";
    constructor(message: string);
}
