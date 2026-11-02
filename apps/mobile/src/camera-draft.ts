import { validateText } from "@tunnel/shared";

export function appendRecognizedText(
  draft: string,
  recognized: string,
): string {
  if (!recognized.trim())
    throw new Error(
      "No text found. Try a clearer photo with Latin-script text.",
    );
  const next = draft ? draft + "\n" + recognized : recognized;
  validateText(next);
  return next;
}
