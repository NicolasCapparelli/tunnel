export type Crop = { x: number; y: number; width: number; height: number };
export type CropHandle = "tl" | "tr" | "bl" | "br" | "move";
export const fullCrop: Crop = { x: 0, y: 0, width: 1, height: 1 };
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export function fitImage(
  width: number,
  height: number,
  areaWidth: number,
  areaHeight: number,
) {
  const scale = Math.min(areaWidth / width, areaHeight / height);
  return { width: width * scale, height: height * scale };
}

/** Coordinates are fractions of the upright image, independent of letterboxing. */
export function dragCrop(
  start: Crop,
  handle: CropHandle,
  dx: number,
  dy: number,
  minWidth = 0.1,
  minHeight = 0.1,
): Crop {
  if (handle === "move")
    return {
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height),
    };
  let left = start.x,
    top = start.y,
    right = start.x + start.width,
    bottom = start.y + start.height;
  if (handle.endsWith("l")) left = clamp(left + dx, 0, right - minWidth);
  else right = clamp(right + dx, Math.min(1, left + minWidth), 1);
  if (handle.startsWith("t")) top = clamp(top + dy, 0, bottom - minHeight);
  else bottom = clamp(bottom + dy, Math.min(1, top + minHeight), 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
