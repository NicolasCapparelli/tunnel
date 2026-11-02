import { describe, expect, it } from "vitest";
import { appendRecognizedText } from "../apps/mobile/src/camera-draft";

describe("camera OCR draft", () => {
  it("preserves the note, line breaks and recognized Unicode text", () => {
    expect(appendRecognizedText("Existing note  ", "Café\nLine 2")).toBe(
      "Existing note  \nCafé\nLine 2",
    );
    expect(appendRecognizedText("", "Café\nLine 2")).toBe("Café\nLine 2");
  });
  it("rejects an empty recognition without replacing the draft", () => {
    expect(() => appendRecognizedText("Keep this", " \n\t")).toThrow(
      "No text found",
    );
  });
  it("enforces the combined UTF-8 limit without truncating either input", () => {
    expect(appendRecognizedText("a".repeat(65534), "b")).toHaveLength(65536);
    expect(() => appendRecognizedText("a".repeat(65535), "b")).toThrow("64 KB");
    expect(() => appendRecognizedText("é".repeat(32767), "é")).toThrow("64 KB");
  });
});
