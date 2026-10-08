import { describe, it, expect } from "vitest";
import { AuroraContrast, AuroraRuntime, AuroraSelection } from "@aurora/core";
import { contract, themes, restoreTheme } from "../packages/shared/src/theme";
describe("Aurora integration", () => {
  it("supplies complete light/dark variants with readable UI text", () => {
    for (const theme of themes)
      for (const appearance of ["light", "dark"] as const) {
        const v = theme.variants.get(appearance)!;
        expect(v.contract).toBe(contract);
        expect(v.values.size).toBe(contract.tokens.size);
        expect(
          AuroraContrast.ratio(
            v.tokens.onSurface,
            v.tokens.surfaceContainerLow,
          ),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          AuroraContrast.ratio(
            v.tokens.onSurfaceVariant,
            v.tokens.surfaceContainerLow,
          ),
        ).toBeGreaterThanOrEqual(4.5);
      }
  });
  it("switches selection on the same runtime and rejects retired preferences safely", () => {
    const runtime = new AuroraRuntime({
      contract,
      themes,
      initialSelection: new AuroraSelection({
        themeId: "mineral",
        appearance: "light",
      }),
      fallback: "preferred",
    });
    runtime.select(
      new AuroraSelection({ themeId: "dune", appearance: "dark" }),
    );
    expect(runtime.state.theme.id).toBe("dune");
    expect(runtime.state.variant.appearance).toBe("dark");
    expect(restoreTheme({ themeId: "retired", appearance: "garbage" })).toEqual(
      { themeId: "mineral", appearance: "light" },
    );
    runtime.dispose();
  });
});
