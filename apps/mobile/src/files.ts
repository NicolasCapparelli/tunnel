import { releaseNativeFiles, saveNativeFile } from "./connection";
import * as FS from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import {
  validateAttachments,
  validateQuanta,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type Quanta,
} from "@tunnel/shared";
const root = FS.documentDirectory + "quanta/";
export async function importFile(
  uri: string,
  name: string,
  mimeType = "application/octet-stream",
  size?: number,
): Promise<Attachment> {
  const info = await FS.getInfoAsync(uri);
  const bytes = info.exists && "size" in info ? info.size : size;
  if (bytes === undefined || bytes > MAX_ATTACHMENT_BYTES)
    throw new Error("Keep attachments under 250 MB per quanta.");
  const clean =
    name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 80) || "attachment";
  const folder = root + Crypto.randomUUID() + "/";
  await FS.makeDirectoryAsync(folder, { intermediates: true });
  const target = folder + clean;
  await FS.copyAsync({ from: uri, to: target });
  return { name: clean, mimeType, size: bytes, uri: target };
}
export async function storeQuanta(q: Quanta): Promise<Quanta> {
  const files: Attachment[] = [];
  for (const a of q.attachments ?? []) {
    if (a.data === undefined) {
      files.push(a);
      continue;
    }
    const folder = root + q.id + "/";
    await FS.makeDirectoryAsync(folder, { intermediates: true });
    const uri = folder + files.length + "-" + a.name;
    await FS.writeAsStringAsync(uri, a.data, {
      encoding: FS.EncodingType.Base64,
    });
    files.push({ name: a.name, mimeType: a.mimeType, size: a.size, uri });
  }
  return { ...q, attachments: files };
}
export async function wireQuanta(q: Quanta): Promise<Quanta> {
  validateQuanta(q);
  const files = await Promise.all(
    (q.attachments ?? []).map(async (a) => ({
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
      data:
        a.data ??
        (await FS.readAsStringAsync(a.uri!, {
          encoding: FS.EncodingType.Base64,
        })),
    })),
  );
  const wire = { ...q, attachments: files };
  validateAttachments(files, true);
  return wire;
}
export async function shareFile(a: Attachment) {
  if (!a.uri || !(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is unavailable.");
  await Sharing.shareAsync(a.uri, {
    mimeType: a.mimeType,
    dialogTitle: a.name,
  });
}

/** Delete only previously owned files released by history, preserving drafts and retained transfers. */
export async function releaseFiles(
  previous: Quanta[],
  retained: Quanta[],
  drafts: Attachment[],
) {
  const keep = new Set(
    [...retained.flatMap((q) => q.attachments ?? []), ...drafts].map(
      (a) => a.uri,
    ),
  );
  const stale = previous
    .flatMap((q) => q.attachments ?? [])
    .filter((a) => a.uri?.startsWith(root) && !keep.has(a.uri));
  await releaseNativeFiles(
    previous
      .flatMap((q) => q.attachments ?? [])
      .filter((a) => a.uri && !keep.has(a.uri))
      .map((a) => a.uri!),
  ).catch(() => {});
  await Promise.all(
    stale.map((a) =>
      FS.deleteAsync(a.uri!, { idempotent: true }).catch(() => {}),
    ),
  );
}

export async function saveFile(a: Attachment) {
  if (!a.uri) throw new Error("Missing file.");
  await saveNativeFile(a);
}
