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
          [F.surface, color("#293632")],
          [F.surfaceContainerLow, color("#32413b")],
          [F.surfaceContainer, color("#32413b")],
          [F.surfaceContainerHigh, color("#3d4c46")],
          [F.surfaceContainerHighest, color("#44564d")],
          [F.onSurface, color("#dde9df")],
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
