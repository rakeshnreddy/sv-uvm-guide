import { describe, expect, it } from "vitest";

import { crc32, createZip, createZipBlob, normalizeZipPath } from "@/lib/zip-store";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const FIXED_TIME = new Date(2026, 9, 18, 13, 45, 30);

interface ParsedEntry {
  name: string;
  flags: number;
  method: number;
  crc: number;
  size: number;
  data: Uint8Array;
  localOffset: number;
}

/** Reads an archive back through its end-of-central-directory record and central directory. */
function parseZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  expect(view.getUint16(eocd + 8, true)).toBe(entryCount);
  expect(centralOffset + centralSize).toBe(eocd);

  const entries: ParsedEntry[] = [];
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const size = view.getUint32(offset + 24, true);
    expect(view.getUint32(offset + 20, true)).toBe(size);
    const nameLength = view.getUint16(offset + 28, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    // The local header repeats the same facts and is followed by the stored data.
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    expect(view.getUint16(localOffset + 6, true)).toBe(flags);
    expect(view.getUint16(localOffset + 8, true)).toBe(method);
    expect(view.getUint32(localOffset + 14, true)).toBe(crc);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const extraLength = view.getUint16(localOffset + 28, true);
    expect(decoder.decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength))).toBe(name);
    const dataStart = localOffset + 30 + localNameLength + extraLength;
    entries.push({ name, flags, method, crc, size, data: bytes.subarray(dataStart, dataStart + size), localOffset });
    offset += 46 + nameLength;
  }
  return { entries, centralOffset, eocd };
}

describe("crc32", () => {
  it("matches the standard check values", () => {
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(encoder.encode("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });
});

describe("createZip", () => {
  it("writes local headers, a central directory and the end record with the right signatures", () => {
    const bytes = createZip([{ path: "a.txt", content: "hello" }], { modifiedAt: FIXED_TIME });
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const { entries, eocd } = parseZip(bytes);
    expect(eocd).toBe(bytes.length - 22);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: "a.txt", method: 0, size: 5, crc: crc32(encoder.encode("hello")) });
    expect(decoder.decode(entries[0].data)).toBe("hello");
  });

  it("stores every entry, in order, with its CRC and length", () => {
    const files = [
      { path: "lab-v2/README.md", content: "# Guide\n" },
      { path: "lab-v2/work/tb.sv", content: "module tb;\nendmodule\n" },
      { path: "lab-v2/empty.txt", content: "" },
      { path: "lab-v2/bytes.bin", content: new Uint8Array([0, 1, 2, 255]) },
    ];
    const { entries } = parseZip(createZip(files, { modifiedAt: FIXED_TIME }));
    expect(entries.map((entry) => entry.name)).toEqual(files.map((file) => file.path));
    entries.forEach((entry, index) => {
      const content = files[index].content;
      const data = typeof content === "string" ? encoder.encode(content) : content;
      expect(entry.size).toBe(data.length);
      expect([...entry.data]).toEqual([...data]);
      expect(entry.crc).toBe(crc32(data));
    });
    expect(entries[0].localOffset).toBe(0);
  });

  it("marks names as UTF-8 and encodes them as UTF-8", () => {
    const { entries } = parseZip(createZip([{ path: "übung/naïve-€.sv", content: "x" }], { modifiedAt: FIXED_TIME }));
    expect(entries[0].name).toBe("übung/naïve-€.sv");
    expect(entries[0].flags & 0x0800).toBe(0x0800);
  });

  it("stamps the DOS time and date", () => {
    const bytes = createZip([{ path: "a", content: "" }], { modifiedAt: FIXED_TIME });
    const view = new DataView(bytes.buffer);
    const time = view.getUint16(10, true);
    const date = view.getUint16(12, true);
    expect(time >> 11).toBe(13);
    expect((time >> 5) & 0x3f).toBe(45);
    expect((time & 0x1f) * 2).toBe(30);
    expect((date >> 9) + 1980).toBe(2026);
    expect((date >> 5) & 0x0f).toBe(10);
    expect(date & 0x1f).toBe(18);
  });

  it("writes an empty archive as just the end record", () => {
    const bytes = createZip([]);
    expect(bytes.length).toBe(22);
    expect(parseZip(bytes).entries).toEqual([]);
  });

  it("normalizes names and refuses unsafe or duplicate ones", () => {
    expect(normalizeZipPath("/a//b/./c.sv")).toBe("a/b/c.sv");
    expect(normalizeZipPath("a\\b.sv")).toBe("a/b.sv");
    expect(() => normalizeZipPath("../escape")).toThrow("ZIP_ENTRY_NAME_INVALID");
    expect(() => normalizeZipPath("C:/x")).toThrow("ZIP_ENTRY_NAME_INVALID");
    expect(() => normalizeZipPath("///")).toThrow("ZIP_ENTRY_NAME_EMPTY");
    expect(() => createZip([{ path: "a", content: "1" }, { path: "/a", content: "2" }])).toThrow("ZIP_DUPLICATE_ENTRY");
  });

  it("wraps the archive in an application/zip Blob", async () => {
    const blob = createZipBlob([{ path: "a.txt", content: "hello" }], { modifiedAt: FIXED_TIME });
    expect(blob.type).toBe("application/zip");
    const expected = createZip([{ path: "a.txt", content: "hello" }], { modifiedAt: FIXED_TIME });
    expect(blob.size).toBe(expected.length);
  });
});
