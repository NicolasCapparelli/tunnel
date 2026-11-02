import {
  Collection,
  EntanglementDb,
  MergePolicy,
  Ref,
  Schema,
  type SqlExecutor,
  type Json,
} from "@entanglement/core";
import {
  CloudflareAccountSource,
  CloudflareSyncBackend,
  type CloudflareAccessSession,
} from "@entanglement/cloudflare";

export interface RawQuanta {
  id: string;
  text: string;
  createdAt: number;
  sourceDevice: string | null;
}

export interface SingularitySpaceRecord {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface SingularityEntry {
  id: string;
  spaceId: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

/** A one-field composer keeps the full text; the title is only a preview. */
export function singularityEntryContent(text: string) {
  return { title: text.split("\n")[0].slice(0, 80), body: text };
}

/** Older entries can have a separate title. Include it without repeating previews. */
export function singularityEntryText(
  entry: Pick<SingularityEntry, "title" | "body">,
) {
  if (!entry.body) return entry.title;
  return entry.body.startsWith(entry.title)
    ? entry.body
    : `${entry.title}\n${entry.body}`;
}

const encode = <T>(value: T): Json => JSON.parse(JSON.stringify(value)) as Json;
export const rawQuanta = new Collection<RawQuanta>("singularity_quanta", {
  decode: (json) => json as unknown as RawQuanta,
  encode,
  idOf: (value) => value.id,
  fields: ["id", "text", "createdAt", "sourceDevice"],
  indexes: ["createdAt"],
  merge: MergePolicy.wholeDocument,
});
export const singularitySpaces = new Collection<SingularitySpaceRecord>(
  "singularity_spaces",
  {
    decode: (json) => json as unknown as SingularitySpaceRecord,
    encode,
    idOf: (value) => value.id,
    fields: ["id", "name", "description", "createdAt", "updatedAt"],
    indexes: ["name", "updatedAt"],
    merge: MergePolicy.fieldwise(),
  },
);
export const singularityEntries = new Collection<SingularityEntry>(
  "singularity_entries",
  {
    decode: (json) => json as unknown as SingularityEntry,
    encode,
    idOf: (value) => value.id,
    fields: ["id", "spaceId", "title", "body", "createdAt", "updatedAt"],
    indexes: ["spaceId", "updatedAt"],
    refs: (doc) => [new Ref(singularitySpaces.name, String(doc.spaceId))],
    merge: MergePolicy.fieldwise(),
  },
);

const schema = new Schema({
  version: 1,
  collections: [rawQuanta, singularitySpaces, singularityEntries],
});

export interface SingularityRuntime {
  db: EntanglementDb;
  account: CloudflareAccountSource;
  dispose(): Promise<void>;
}

/** Opens the same realtime, local-first Singularity model on desktop and Android. */
export async function openSingularity(options: {
  endpoint: string;
  session: CloudflareAccessSession;
  accountId: string | null;
  executor: SqlExecutor;
  deviceLabel: string;
  request?: typeof fetch;
}): Promise<SingularityRuntime> {
  const backend = new CloudflareSyncBackend(
    options.endpoint,
    options.session,
    options.request,
  );
  const account = new CloudflareAccountSource(options.accountId);
  const db = await EntanglementDb.open({
    executor: options.executor,
    schema,
    backend,
    accounts: account,
    options: {
      defaultMode: "realtime",
      realtime: {
        conflictPolicy: "preferRemote",
        debounceMs: 600,
        hintDelayMs: 120,
        pollMs: 45_000,
      },
      deviceLabel: options.deviceLabel,
    },
  });
  return { db, account, dispose: () => db.close() };
}
