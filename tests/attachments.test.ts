import fixture from "./fixtures/attachment.json";
import { describe, it, expect } from "vitest";
import {
  validateQuanta,
  validateAttachments,
  seal,
  open,
  MAX_ATTACHMENT_BYTES,
  ChunkReceiver,
} from "@tunnel/shared";
const file = {
  name: "photo.png",
  mimeType: "image/png",
  size: 3,
  data: "AAEC",
};
const q = {
  id: "file-quanta-123",
  text: "",
  createdAt: 1,
  attachments: [file],
};
describe("attachment quanta", () => {
  it("keeps the full text byte allowance with JSON escaping", () => {
    const key = "11".repeat(32);
    const message = {
      type: "text" as const,
      quanta: {
        id: "escaped-text-123",
        text: "\0".repeat(65536),
        createdAt: 1,
      },
    };
    expect(open(seal(message, key, new Uint8Array(12)), key)).toEqual(message);
  });
  it("receives ordered chunks and rejects gaps/early completion", () => {
    const r = new ChunkReceiver();
    r.begin({ ...q, attachments: [{ ...file, data: undefined }] });
    expect(() => r.chunk(q.id, 0, 1, "AAEC")).toThrow();
    expect(() => r.end(q.id)).toThrow();
    r.chunk(q.id, 0, 0, "AAEC");
    expect(r.end(q.id)).toEqual(q);
  });
  it("matches the native binary fixture", () => {
    expect(open(fixture.frame, fixture.key)).toEqual(fixture.message);
  });
  it("validates base64 beyond the old limit", () => {
    const data = Buffer.alloc(8 * 1024 * 1024).toString("base64");
    expect(() =>
      validateAttachments([{ ...file, size: 8 * 1024 * 1024, data }], true),
    ).not.toThrow();
  });
  it("round trips a binary-only quanta with optional notes", () => {
    const key = "11".repeat(32);
    expect(
      open(seal({ type: "text", quanta: q }, key, new Uint8Array(12)), key),
    ).toEqual({ type: "text", quanta: q });
    expect(() => validateQuanta({ ...q, text: "A note" }, true)).not.toThrow();
  });
  it("accepts empty files and exactly 250 MB", () => {
    expect(() =>
      validateAttachments([{ ...file, size: 0, data: "" }], true),
    ).not.toThrow();
    expect(() =>
      validateAttachments([
        {
          ...file,
          size: MAX_ATTACHMENT_BYTES,
          data: undefined,
          uri: "file:///private/file",
        },
      ]),
    ).not.toThrow();
  });
  it("rejects aggregate size/count excess before encoding", () => {
    expect(() =>
      validateAttachments([
        { ...file, size: MAX_ATTACHMENT_BYTES, data: undefined, uri: "local" },
        file,
      ]),
    ).toThrow();
    expect(() => validateAttachments(Array(33).fill(file))).toThrow();
  });
  it("rejects traversal, bad MIME, corrupt base64 and length mismatch", () => {
    for (const bad of [
      { ...file, name: "../photo" },
      { ...file, mimeType: "broken" },
      { ...file, data: "@@@@" },
      { ...file, size: 2 },
    ])
      expect(() => validateAttachments([bad], true)).toThrow();
  });
  it("requires bytes on the wire while allowing persisted local references", () => {
    const stored = {
      ...q,
      attachments: [{ ...file, data: undefined, uri: "file:///private/photo" }],
    };
    expect(() => validateQuanta(stored)).not.toThrow();
    expect(() => validateQuanta(stored, true)).toThrow();
    expect(() => validateQuanta({ ...q, text: "", attachments: [] })).toThrow();
  });
});
