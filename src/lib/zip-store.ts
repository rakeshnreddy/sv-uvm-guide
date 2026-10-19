/**
 * A small, pure ZIP writer for downloads built in the browser (lab workspaces).
 *
 * Entries are stored without compression (method 0), which every unzip tool
 * reads. Each entry gets a local file header, its data, and a central
 * directory record; the archive ends with the end-of-central-directory
 * record. Names are UTF-8 with general-purpose flag bit 11 set. ZIP64 is not
 * supported: more than 65 535 entries or 4 GiB throws.
 */

export interface ZipEntry {
  /** Path inside the archive, with '/' separators. */
  path: string;
  content: string | Uint8Array;
}

export interface ZipOptions {
  /** Modification time stamped on every entry (DOS format, local time). Defaults to now. */
  modifiedAt?: Date;
}

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
/** Version 2.0: what most writers record for stored entries. */
const ZIP_VERSION = 20;
/** General-purpose bit 11: the name is UTF-8. */
const UTF8_NAME_FLAG = 0x0800;
const STORED = 0;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

/** CRC-32 (IEEE 802.3, the polynomial ZIP uses) of `data`, as an unsigned 32-bit number. */
export function crc32(data: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = table[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** DOS time and date fields; times before 1980 are clamped to 1980-01-01. */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = date.getFullYear();
  if (year < 1980) return { time: 0, date: (1 << 5) | 1 };
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((Math.min(year, 2107) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** A '/'-separated relative path; throws on an empty name, '..' segments or a drive letter. */
export function normalizeZipPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter((part) => part.length > 0 && part !== ".");
  if (parts.length === 0) throw new Error("ZIP_ENTRY_NAME_EMPTY");
  if (parts.some((part) => part === "..") || /^[A-Za-z]:$/.test(parts[0])) throw new Error("ZIP_ENTRY_NAME_INVALID");
  return parts.join("/");
}

/** Builds an uncompressed ZIP archive of `entries`, in order. Duplicate names throw. */
export function createZip(entries: readonly ZipEntry[], options: ZipOptions = {}): Uint8Array {
  if (entries.length > MAX_UINT16) throw new Error("ZIP_TOO_MANY_ENTRIES");
  const encoder = new TextEncoder();
  const stamp = dosDateTime(options.modifiedAt ?? new Date());
  const seen = new Set<string>();

  const prepared = entries.map((entry) => {
    const name = normalizeZipPath(entry.path);
    if (seen.has(name)) throw new Error("ZIP_DUPLICATE_ENTRY");
    seen.add(name);
    const nameBytes = encoder.encode(name);
    if (nameBytes.length > MAX_UINT16) throw new Error("ZIP_ENTRY_NAME_INVALID");
    const data = typeof entry.content === "string" ? encoder.encode(entry.content) : entry.content;
    return { nameBytes, data, crc: crc32(data) };
  });

  const localSize = prepared.reduce((total, entry) => total + 30 + entry.nameBytes.length + entry.data.length, 0);
  const centralSize = prepared.reduce((total, entry) => total + 46 + entry.nameBytes.length, 0);
  const totalSize = localSize + centralSize + 22;
  if (localSize > MAX_UINT32 || totalSize > MAX_UINT32) throw new Error("ZIP_TOO_LARGE");

  const output = new Uint8Array(totalSize);
  const view = new DataView(output.buffer);
  let offset = 0;
  const u16 = (value: number) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const u32 = (value: number) => {
    view.setUint32(offset, value >>> 0, true);
    offset += 4;
  };
  const bytes = (value: Uint8Array) => {
    output.set(value, offset);
    offset += value.length;
  };

  const localOffsets: number[] = [];
  for (const entry of prepared) {
    localOffsets.push(offset);
    u32(LOCAL_FILE_HEADER);
    u16(ZIP_VERSION);
    u16(UTF8_NAME_FLAG);
    u16(STORED);
    u16(stamp.time);
    u16(stamp.date);
    u32(entry.crc);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(entry.nameBytes.length);
    u16(0);
    bytes(entry.nameBytes);
    bytes(entry.data);
  }

  const centralOffset = offset;
  prepared.forEach((entry, index) => {
    u32(CENTRAL_DIRECTORY_HEADER);
    u16(ZIP_VERSION);
    u16(ZIP_VERSION);
    u16(UTF8_NAME_FLAG);
    u16(STORED);
    u16(stamp.time);
    u16(stamp.date);
    u32(entry.crc);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(entry.nameBytes.length);
    u16(0); // extra field length
    u16(0); // comment length
    u16(0); // disk number start
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(localOffsets[index]);
    bytes(entry.nameBytes);
  });

  const centralLength = offset - centralOffset;
  u32(END_OF_CENTRAL_DIRECTORY);
  u16(0); // this disk
  u16(0); // disk with the central directory
  u16(prepared.length);
  u16(prepared.length);
  u32(centralLength);
  u32(centralOffset);
  u16(0); // comment length
  return output;
}

/** A Blob of `createZip(entries)`, typed application/zip, for downloadBlob(). */
export function createZipBlob(entries: readonly ZipEntry[], options?: ZipOptions): Blob {
  const archive = createZip(entries, options);
  const buffer = new ArrayBuffer(archive.length);
  new Uint8Array(buffer).set(archive);
  return new Blob([buffer], { type: "application/zip" });
}
