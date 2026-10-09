import { utf8ToBytes } from "@noble/ciphers/utils.js";
export const composerPrompts = [
  "Ready to stochastically appear somewhere else?",
  "A thought here. A possibility elsewhere.",
  "What would you like to tunnel?",
  "Give this quanta somewhere new to be.",
  "A little context, one quantum leap away.",
] as const;
export const nextPrompt = (index: number) =>
  (index + 1) % composerPrompts.length;
export function validDeviceName(name: string) {
  const value = name.trim();
  if (!value || utf8ToBytes(value).length > 80)
    throw new Error("Use a device name between 1 and 80 UTF-8 bytes.");
  return value;
}
// Two particles from the handle, independent of the height of the phone.
export function shouldLaunchQuanta(
  distance: number,
  travel: number,
  velocity = 0,
) {
  return (
    distance >= Math.min(64, (travel * 2) / 12) ||
    (distance >= 18 && velocity <= -0.65)
  );
}
