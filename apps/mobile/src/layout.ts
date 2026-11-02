// Phone grid: compact cards share a row in pairs, everything else spans the width.
// Order is kept, so a compact card next to a wide one sits alone at half width.
export function pairRows<T>(items: T[], compact: (item: T) => boolean) {
  const rows: T[][] = [];
  for (const item of items) {
    const last = rows.at(-1);
    if (compact(item) && last?.length === 1 && compact(last[0]))
      last.push(item);
    else rows.push([item]);
  }
  return rows;
}

type Quanta = {
  text: string;
  attachments?: { mimeType: string }[];
};

// Photo-only quanta fit one phone column; text and files need the full width.
export function compactQuanta(q: Quanta) {
  return (
    !q.text.trim() &&
    !!q.attachments?.length &&
    q.attachments.every((a) => a.mimeType.startsWith("image/"))
  );
}
