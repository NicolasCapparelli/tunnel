import { describe, it, expect } from "vitest";
import { compactQuanta, pairRows } from "../apps/mobile/src/layout";

const photo = { text: "", attachments: [{ mimeType: "image/png" }] };
const note = { text: "hello", attachments: [] };
const file = { text: "", attachments: [{ mimeType: "application/pdf" }] };

describe("phone quanta grid", () => {
  it("treats only photo-only quanta as compact", () => {
    expect(compactQuanta(photo)).toBe(true);
    expect(compactQuanta(note)).toBe(false);
    expect(compactQuanta(file)).toBe(false);
    expect(compactQuanta({ ...photo, text: "caption" })).toBe(false);
  });

  it("pairs consecutive compact quanta and keeps order", () => {
    const rows = pairRows(
      [photo, photo, photo, note, photo, file],
      compactQuanta,
    );
    expect(rows.map((r) => r.length)).toEqual([2, 1, 1, 1, 1]);
    expect(rows.flat()).toEqual([photo, photo, photo, note, photo, file]);
  });

  it("never pairs a wide quanta", () => {
    expect(pairRows([note, note], compactQuanta).map((r) => r.length)).toEqual([
      1, 1,
    ]);
  });
});
