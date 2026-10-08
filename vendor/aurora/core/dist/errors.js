export class AuroraError extends Error {
}
/** Reports every completeness and type problem instead of stopping at the first. */
export class AuroraValidationError extends AuroraError {
    category = 'validation';
    issues;
    constructor(issues) {
        const list = Object.freeze([...issues]);
        super(`Aurora validation failed:\n${list.map((issue) => `- ${issue}`).join('\n')}`);
        this.name = 'AuroraValidationError';
        this.issues = list;
    }
}
/** Malformed or unsupported input. */
export class AuroraFormatError extends AuroraError {
    category = 'format';
    constructor(message) {
        super(message);
        this.name = 'AuroraFormatError';
    }
}
/** An invalid argument, such as an unknown id or an inconsistent declaration. */
export class AuroraArgumentError extends AuroraError {
    category = 'argument';
    constructor(message) {
        super(message);
        this.name = 'AuroraArgumentError';
    }
}
/** The requested operation is not possible in the current state. */
export class AuroraStateError extends AuroraError {
    category = 'state';
    constructor(message) {
        super(message);
        this.name = 'AuroraStateError';
    }
}
