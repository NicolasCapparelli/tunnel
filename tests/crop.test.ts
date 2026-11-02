import { describe, expect, it } from "vitest";
import { dragCrop, fitImage, fullCrop } from "../apps/mobile/src/crop";

describe("OCR image crop", () => {
  it("starts with the full image and fits portrait/landscape without distorting or including letterboxing", () => {
    expect(fullCrop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(fitImage(2000, 4000, 300, 400)).toEqual({ width: 200, height: 400 });
    expect(fitImage(4000, 2000, 300, 400)).toEqual({ width: 300, height: 150 });
  });
  it("resizes all corners while keeping the opposite corner fixed", () => {
    expect(dragCrop(fullCrop, "tl", 0.2, 0.3)).toEqual({
      x: 0.2,
      y: 0.3,
      width: 0.8,
      height: 0.7,
    });
    expect(dragCrop(fullCrop, "br", -0.2, -0.3)).toEqual({
      x: 0,
      y: 0,
      width: 0.8,
      height: 0.7,
    });
    expect(dragCrop(fullCrop, "tr", -0.2, 0.3)).toEqual({
      x: 0,
      y: 0.3,
      width: 0.8,
      height: 0.7,
    });
    expect(dragCrop(fullCrop, "bl", 0.2, -0.3)).toEqual({
      x: 0.2,
      y: 0,
      width: 0.8,
      height: 0.7,
    });
  });
  it("clamps movement and prevents handles crossing or leaving the image", () => {
    const crop = { x: 0.2, y: 0.2, width: 0.5, height: 0.5 };
    expect(dragCrop(crop, "move", 5, -5)).toEqual({ ...crop, x: 0.5, y: 0 });
    const tiny = dragCrop(fullCrop, "tl", 5, 5);
    expect(tiny.width).toBeCloseTo(0.1);
    expect(tiny.height).toBeCloseTo(0.1);
    expect(dragCrop(fullCrop, "br", 5, 5)).toEqual(fullCrop);
    expect(dragCrop(fullCrop, "tl", -5, -5)).toEqual(fullCrop);
    const resized = dragCrop(
      { x: 0.9, y: 0.9, width: 0.1, height: 0.1 },
      "br",
      0,
      0,
      0.5,
      0.5,
    );
    expect(resized.x + resized.width).toBeLessThanOrEqual(1);
    expect(resized.y + resized.height).toBeLessThanOrEqual(1);
  });
});
