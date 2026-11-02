import {
  parsePairing,
  type Credentials,
  type Quanta,
  type Transfer,
} from "./index";
export const MAX_DESKTOPS = 8;
export function restoreDesktops(raw: unknown): Credentials[] {
  const result: Credentials[] = [];
  for (const candidate of Array.isArray(raw) ? raw : raw ? [raw] : []) {
    try {
      const p = parsePairing(JSON.stringify(candidate), Date.now(), true);
      if (
        typeof candidate.deviceId !== "string" ||
        !candidate.deviceId ||
        typeof candidate.deviceName !== "string"
      )
        continue;
      if (
        result.some((c) => c.serverId === p.serverId) ||
        result.length >= MAX_DESKTOPS
      )
        continue;
      result.push({
        ...p,
        deviceId: candidate.deviceId,
        deviceName: candidate.deviceName,
      });
    } catch {
      /* Recover valid peers without discarding the entire registry. */
    }
  }
  return result;
}
export function upsertDesktop(
  links: Credentials[],
  next: Credentials,
): Credentials[] {
  if (
    !links.some((c) => c.serverId === next.serverId) &&
    links.length >= MAX_DESKTOPS
  )
    throw new Error("Link up to eight desktops.");
  return links.some((c) => c.serverId === next.serverId)
    ? links.map((c) => (c.serverId === next.serverId ? next : c))
    : [...links, next];
}
export function destinationIds(links: Credentials[], raw: unknown): string[] {
  const known = new Set(links.map((c) => c.serverId));
  return [
    ...new Set(
      (Array.isArray(raw) ? raw : []).filter(
        (id): id is string => typeof id === "string" && known.has(id),
      ),
    ),
  ];
}
export function recipientTransfers(
  q: Quanta,
  links: Credentials[],
  ids: string[],
  randomId: () => string,
): Transfer[] {
  const targets = destinationIds(links, ids);
  if (!targets.length) throw new Error("Choose at least one linked desktop.");
  return targets.map((id) => ({
    ...q,
    id: randomId(),
    serverId: id,
    peer: links.find((c) => c.serverId === id)!.desktopName,
    direction: "sent",
    status: "pending",
  }));
}
