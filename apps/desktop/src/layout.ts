// Grid slot for a quanta card: short text takes one slot, long text spans more.
// Photos stay in one slot; a stack is barely wider than a single print.
export function quantaSlot(text: string) {
  const length = text.trim().length + text.split("\n").length * 40;
  if (length > 900) return "slot-large";
  if (length > 320) return "slot-wide";
  return "slot-small";
}
