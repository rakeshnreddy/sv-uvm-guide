import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkWriteStrobe,
  computeBurst,
  formatStrobe,
  hex,
  maxIncrBeatsBefore4KB,
  type BurstRequest,
} from "@/lib/axi-burst-model";

const burst = (r: Partial<BurstRequest> & Pick<BurstRequest, "startAddress">) =>
  computeBurst({ axlen: 3, axsize: 2, burst: "INCR", dataBusBytes: 4, ...r });

const addresses = (r: ReturnType<typeof computeBurst>) => r.beats.map((b) => b.address);
const lanes = (r: ReturnType<typeof computeBurst>) => r.beats.map((b) => b.lanes);

describe("axi-burst-model: IHI0022E A3.4.1 burst address equations", () => {
  it("unaligned INCR 0x1003, size 4: Address_N = Aligned_Address + (N-1) x Number_Bytes after the first transfer", () => {
    const r = burst({ startAddress: 0x1003 });
    expect(addresses(r)).toEqual([0x1003, 0x1004, 0x1008, 0x100c]);
    expect(r.alignedAddress).toBe(0x1000);
    expect(r.aligned).toBe(false);
    // First transfer: Lower_Byte_Lane = 3, Upper_Byte_Lane = Aligned + 3 - 0x1000 = 3.
    expect(lanes(r)).toEqual([[3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);
    expect(r.legal).toBe(true);
  });

  it("Figure A3-13: 32-bit transfers from 0x01 and 0x07 on a 32-bit bus", () => {
    expect(lanes(burst({ startAddress: 0x01 }))).toEqual([[1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);
    const r = burst({ startAddress: 0x07, axlen: 4 });
    expect(addresses(r)).toEqual([0x07, 0x08, 0x0c, 0x10, 0x14]);
    expect(lanes(r)[0]).toEqual([3]);
  });

  it("Figure A3-14: 32-bit transfers from 0x07 on a 64-bit bus use lane 7, then lanes 0-3 and 4-7 alternately", () => {
    const r = burst({ startAddress: 0x07, dataBusBytes: 8 });
    expect(addresses(r)).toEqual([0x07, 0x08, 0x0c, 0x10]);
    expect(lanes(r)).toEqual([[7], [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 2, 3]]);
  });

  it("Figure A3-15: WRAP4 of 32-bit transfers from 0x04 on a 64-bit bus wraps to Wrap_Boundary 0x00", () => {
    const r = burst({ startAddress: 0x04, burst: "WRAP", dataBusBytes: 8 });
    expect(r.wrapBoundary).toBe(0x00);
    expect(addresses(r)).toEqual([0x04, 0x08, 0x0c, 0x00]);
    expect(r.beats.map((b) => b.wrapped)).toEqual([false, false, false, true]);
    expect(lanes(r)).toEqual([[4, 5, 6, 7], [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 2, 3]]);
  });

  it("WRAP continues with Start_Address + (N-1) x Number_Bytes - total after the wrap", () => {
    const r = burst({ startAddress: 0x1008, burst: "WRAP" });
    expect(addresses(r)).toEqual([0x1008, 0x100c, 0x1000, 0x1004]);
    // AHB spec prose uses the same arithmetic: WRAP4 words at 0x34 -> 0x34, 0x38, 0x3C, 0x30.
    expect(addresses(burst({ startAddress: 0x34, burst: "WRAP" }))).toEqual([0x34, 0x38, 0x3c, 0x30]);
  });

  it("Figure A3-8 and A3-9: narrow transfers move across the byte lanes", () => {
    expect(lanes(burst({ startAddress: 0, axsize: 0, axlen: 4 }))).toEqual([[0], [1], [2], [3], [0]]);
    expect(lanes(burst({ startAddress: 4, axlen: 2, dataBusBytes: 8 }))).toEqual([[4, 5, 6, 7], [0, 1, 2, 3], [4, 5, 6, 7]]);
  });

  it("an unaligned first transfer stops at the size-aligned container: 0x1001, size 4, 64-bit bus uses lanes 1-3, not 1-4", () => {
    expect(lanes(burst({ startAddress: 0x1001, dataBusBytes: 8 }))[0]).toEqual([1, 2, 3]);
  });

  it("FIXED keeps the same address and the same lanes on every beat, even when unaligned (A3.4.1, A3.4.2)", () => {
    const r = burst({ startAddress: 0x1001, burst: "FIXED" });
    expect(addresses(r)).toEqual([0x1001, 0x1001, 0x1001, 0x1001]);
    expect(lanes(r)).toEqual([[1, 2, 3], [1, 2, 3], [1, 2, 3], [1, 2, 3]]);
  });
});

describe("axi-burst-model: legality rules (A3.4.1)", () => {
  it("WRAP length must be 2, 4, 8 or 16 and the sequence is then undefined", () => {
    const r = burst({ startAddress: 0x1000, burst: "WRAP", axlen: 2 });
    expect(r.legal).toBe(false);
    expect(r.violations.map((v) => v.rule)).toContain("wrap-length");
    expect(r.beats).toEqual([]);
  });

  it("WRAP start must be aligned to the transfer size", () => {
    const r = burst({ startAddress: 0x1003, burst: "WRAP" });
    expect(r.violations.map((v) => v.rule)).toEqual(["wrap-unaligned"]);
  });

  it("AXI4 INCR may carry 256 transfers but not 257; FIXED and WRAP stop at 16; AXI3 stops at 16 for all", () => {
    expect(burst({ startAddress: 0, axlen: 255, axsize: 0 }).legal).toBe(true);
    expect(burst({ startAddress: 0, axlen: 256, axsize: 0 }).violations.map((v) => v.rule)).toContain("length-range");
    expect(burst({ startAddress: 0, axlen: 16, burst: "FIXED" }).violations.map((v) => v.rule)).toContain("length-range");
    expect(burst({ startAddress: 0, axlen: 16, axsize: 0, version: "AXI3" }).violations.map((v) => v.rule)).toContain("length-range");
  });

  it("transfer size must not exceed the data bus width", () => {
    const r = burst({ startAddress: 0x1000, axsize: 3 });
    expect(r.violations.map((v) => v.rule)).toEqual(["size-exceeds-bus"]);
    expect(r.beats).toEqual([]);
  });
});

describe("axi-burst-model: the 4KB rule uses the bytes actually transferred", () => {
  it("INCR 0x0FF0, AxLEN=3, AxSIZE=2 ends at 0x0FFF and is legal", () => {
    const r = burst({ startAddress: 0x0ff0 });
    expect(r.highestByte).toBe(0x0fff);
    expect(r.crosses4KB).toBe(false);
  });

  it("INCR 0x0FF4, 4 x 4 bytes ends at 0x1003 and crosses 0x1000", () => {
    const r = burst({ startAddress: 0x0ff4 });
    expect(r.crosses4KB).toBe(true);
    expect(r.crossedBoundary).toBe(0x1000);
    expect(r.beats.map((b) => b.page)).toEqual([0, 0, 0, 1]);
  });

  it("an INCR that crosses by a single byte is illegal", () => {
    expect(burst({ startAddress: 0x0ffc, axlen: 1 }).violations.map((v) => v.rule)).toEqual(["cross-4kb"]);
  });

  it("unaligned INCR ending exactly at 0x0FFF is legal (addr + total would wrongly say it crosses)", () => {
    const r = burst({ startAddress: 0x0ffe, axlen: 0 });
    expect(r.highestByte).toBe(0x0fff);
    expect(r.legal).toBe(true);
  });

  it("WRAP at the page edge and FIXED near 0xFFC never cross", () => {
    expect(burst({ startAddress: 0x0ffc, burst: "WRAP" }).legal).toBe(true);
    expect(burst({ startAddress: 0x0ffc, burst: "FIXED", axlen: 15 }).legal).toBe(true);
  });

  it("maxIncrBeatsBefore4KB gives the split point a master must use", () => {
    expect(maxIncrBeatsBefore4KB(0x0fc4, 2)).toBe(15);
    expect(maxIncrBeatsBefore4KB(0x0000, 0)).toBe(256);
    expect(maxIncrBeatsBefore4KB(0x0ffe, 2)).toBe(1);
  });
});

describe("axi-burst-model: WSTRB is a subset of the active lanes (A3.4.3)", () => {
  it("a sparse strobe inside the active lanes is legal; a lane outside is not", () => {
    const first = burst({ startAddress: 0x1001, dataBusBytes: 8 }).beats[0];
    expect(checkWriteStrobe(first, [1, 2])).toEqual({ legal: true, extraLanes: [], skippedLanes: [3] });
    expect(checkWriteStrobe(first, [1, 2, 3, 4]).extraLanes).toEqual([4]);
  });

  it("2 bytes at 0x1 with AxSIZE=1 activates lane 1 only, so 4'b0110 is illegal; with AxSIZE=2 it is a legal sparse strobe", () => {
    const half = burst({ startAddress: 0x1, axsize: 1, axlen: 0 }).beats[0];
    expect(half.lanes).toEqual([1]);
    expect(checkWriteStrobe(half, [1, 2]).legal).toBe(false);
    const word = burst({ startAddress: 0x1, axsize: 2, axlen: 0 }).beats[0];
    expect(checkWriteStrobe(word, [1, 2]).legal).toBe(true);
  });

  it("formats WSTRB with the highest lane on the left", () => {
    expect(formatStrobe([4, 5, 6, 7], 8)).toBe("8'b1111_0000");
    expect(formatStrobe([0, 1], 4)).toBe("4'b0011");
    expect(formatStrobe([3], 4)).toBe("4'b1000");
  });
});

describe("B-AXI-2 lesson tables agree with the model", () => {
  const mdx = fs.readFileSync(path.join(process.cwd(), "content/curriculum/T3_Advanced/B-AXI-2_AXI_Burst_Math/index.mdx"), "utf8");
  /** Body rows of the first markdown table after `marker`. */
  const tableAfter = (marker: string): string[][] => {
    const at = mdx.indexOf(marker);
    expect(at, marker).toBeGreaterThan(-1);
    const lines = mdx.slice(at).split("\n");
    const start = lines.findIndex((l) => l.startsWith("|"));
    const rows: string[][] = [];
    for (const l of lines.slice(start)) {
      if (!l.startsWith("|")) break;
      rows.push(l.split("|").slice(1, -1).map((c) => c.trim().replace(/\*\*|`/g, "")));
    }
    return rows.slice(2);
  };
  const laneText = (lanes: number[]) => (lanes.length === 1 ? `${lanes[0]}` : `${lanes[0]}-${lanes[lanes.length - 1]}`);

  it("aligned and unaligned INCR examples", () => {
    expect(tableAfter("**Example (aligned):**").map((r) => r[2])).toEqual(addresses(burst({ startAddress: 0x1000 })).map((a) => hex(a)));
    const unaligned = burst({ startAddress: 0x1003 });
    const rows = tableAfter("**Example (unaligned, IHI0022E A3.4.1):**");
    expect(rows.map((r) => r[2])).toEqual(addresses(unaligned).map((a) => hex(a)));
    expect(rows.map((r) => r[3])).toEqual(lanes(unaligned).map(laneText));
  });

  it("WRAP4 example", () => {
    const rows = tableAfter("**Example:** A WRAP4 burst");
    expect(rows.map((r) => r[2])).toEqual(addresses(burst({ startAddress: 0x1004, burst: "WRAP" })).map((a) => hex(a)));
  });

  it("64-bit WSTRB table", () => {
    for (const [addr, size, bytes, strobe] of tableAfter("**Example on a 64-bit (8-byte) data bus**")) {
      const b = burst({ startAddress: Number.parseInt(addr, 16), axsize: Number.parseInt(size, 10), axlen: 0, dataBusBytes: 8 }).beats[0];
      expect(formatStrobe(b.lanes, 8), addr).toBe(strobe);
      expect(b.lanes.length, addr).toBe(Number(bytes));
    }
  });

  it("narrow transfer table", () => {
    const r = burst({ startAddress: 0x1000, axsize: 1 });
    const rows = tableAfter("**Example:** 2-byte INCR burst on a 4-byte bus");
    expect(rows.map((x) => x[1])).toEqual(addresses(r).map((a) => hex(a)));
    expect(rows.map((x) => x[3])).toEqual(r.beats.map((b) => formatStrobe(b.lanes, 4)));
  });
});
