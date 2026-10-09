import { describe, it, expect } from "vitest";
import {
  composerPrompts,
  nextPrompt,
  shouldLaunchQuanta,
  validDeviceName,
} from "../packages/shared/src/composer";
describe("composer and device boundaries", () => {
  it("rotates without repeating and retains the original prompt", () => {
    expect(composerPrompts[0]).toBe(
      "Ready to stochastically appear somewhere else?",
    );
    expect(nextPrompt(0)).toBe(1);
    expect(nextPrompt(composerPrompts.length - 1)).toBe(0);
  });
  it("launches a short upward gesture consistently on tall phones", () => {
    expect(shouldLaunchQuanta(65, 700)).toBe(true);
    expect(shouldLaunchQuanta(42, 240)).toBe(true);
    expect(shouldLaunchQuanta(10, 700)).toBe(false);
    expect(shouldLaunchQuanta(-65, 700)).toBe(false);
  });
  it("accepts upward flick momentum but rejects tiny accidental touches", () => {
    expect(shouldLaunchQuanta(20, 700, -0.8)).toBe(true);
    expect(shouldLaunchQuanta(8, 700, -2)).toBe(false);
    expect(shouldLaunchQuanta(20, 700, 0.8)).toBe(false);
  });
  it("validates UTF-8 names rather than JS character counts", () => {
    expect(validDeviceName("  My desktop  ")).toBe("My desktop");
    expect(() => validDeviceName("  ")).toThrow();
    expect(validDeviceName("🌀".repeat(20))).toHaveLength(40);
    expect(() => validDeviceName("🌀".repeat(21))).toThrow();
  });
});
