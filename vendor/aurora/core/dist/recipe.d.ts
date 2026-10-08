import { AuroraGenerationRequest } from './generator.js';
export declare function recipeMap(value: unknown, field: string): Record<string, unknown>;
export declare function recipeList(value: unknown, field: string): unknown[];
export declare function recipeText(value: unknown, field: string): string;
export declare function recipeFields(value: Record<string, unknown>, allowed: readonly string[], field: string): void;
/** Dart `int`: JSON numbers without a fractional part. */
export declare function isJsonInteger(value: unknown): value is number;
/** Portable authoring recipe v1 shared by agents and other generator interfaces. */
export declare const AuroraRecipe: Readonly<{
    decode(input: unknown): AuroraGenerationRequest;
}>;
