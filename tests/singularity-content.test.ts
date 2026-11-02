import { expect, it } from "vitest";
import {
  singularityEntryContent,
  singularityEntryText,
} from "../packages/shared/src/singularity";

it("preserves the complete quantum when a space title is derived from long multiline text", () => {
  const text = "A".repeat(120) + "\n\nSecond paragraph\nUnicode: λ → ∞";
  const entry = singularityEntryContent(text);
  expect(entry.title).toHaveLength(80);
  expect(singularityEntryText(entry)).toBe(text);
});

it("copies legacy separate titles and bodies without losing either field", () => {
  expect(
    singularityEntryText({ title: "Project", body: "A different note" }),
  ).toBe("Project\nA different note");
  expect(singularityEntryText({ title: "Project", body: "" })).toBe("Project");
  expect(singularityEntryText({ title: "", body: "Only content" })).toBe(
    "Only content",
  );
});
