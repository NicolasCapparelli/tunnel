import {
  AuroraColor,
  AuroraContract,
  AuroraFoundation as F,
  AuroraGenerationRequest,
  AuroraGenerator,
  AuroraSelection,
} from "@aurora/core";

export const contract = new AuroraContract({ id: "tunnel.v1" });
const color = AuroraColor.hex;
function makeTheme(
  id: string,
  name: string,
  seed: string,
  paper: string,
  card: string,
) {
  return AuroraGenerator.generate(
    new AuroraGenerationRequest({
      contract,
      id,
      name,
      primary: color(seed),
      variantValues: {
        light: [
          [F.surface, color(paper)],
          [F.surfaceContainerLow, color(card)],
          [F.surfaceContainer, color(card)],
          [F.surfaceContainerHigh, color(paper)],
          [F.surfaceContainerHighest, color(paper)],
          [F.onSurface, color("#344640")],
        ],
        dark: [
          [F.surface, color("#3e4d60")],
          [F.surfaceContainerLowest, color("#2c3a4b")],
          [F.surfaceContainerLow, color("#314052")],
          [F.surfaceContainer, color("#46586e")],
          [F.surfaceContainerHigh, color("#4a5c72")],
          [F.surfaceContainerHighest, color("#2a3849")],
          [F.onSurface, color("#f4f8fc")],
          [F.onSurfaceVariant, color("#c5d2e0")],
          [F.outline, color("#93a6ba")],
          [F.outlineVariant, color("#65778b")],
          [
            F.primary,
            color(
              id === "dune"
                ? "#f2be9f"
                : id === "mineral"
                  ? "#9cdebc"
                  : "#6fe0c2",
            ),
          ],
          [F.onPrimary, color("#102e28")],
          [F.primaryContainer, color("#2a3849")],
          [F.onPrimaryContainer, color("#f4f8fc")],
          [F.error, color("#ffb4ab")],
        ],
      },
    }),
  ).theme;
}
export const themes = [
  makeTheme("mineral", "Mineral", "#296657", "#e8ece4", "#f2f4ed"),
  makeTheme("dune", "Dune", "#9b533c", "#f0e8db", "#f8f0e4"),
  makeTheme("tide", "Tide", "#376682", "#e4ebef", "#eff4f6"),
];
export type ThemePreferences = {
  themeId: string;
  appearance: "light" | "dark" | "system";
};
export const defaultTheme: ThemePreferences = {
  themeId: "mineral",
  appearance: "light",
};
export function restoreTheme(value: unknown): ThemePreferences {
  if (!value || typeof value !== "object") return defaultTheme;
  const p = value as Partial<ThemePreferences>;
  return {
    themeId: themes.some((t) => t.id === p.themeId)
      ? p.themeId!
      : defaultTheme.themeId,
    appearance: ["light", "dark", "system"].includes(p.appearance ?? "")
      ? p.appearance!
      : "light",
  };
}
export function themeSelection(p: ThemePreferences) {
  return new AuroraSelection(p);
}
