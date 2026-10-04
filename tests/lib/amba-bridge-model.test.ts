import { describe, expect, it } from "vitest";

import {
  AHB_HBURSTS,
  BRIDGE_PRESETS,
  ahbBytes,
  ahbFixedBeats,
  axiBytes,
  checkAhbBurst,
  countAnswer,
  outputBytes,
  translateAhbToAxi,
  translateAxiToAhb,
  translatePreset,
  type AhbBurst,
  type AhbOut,
  type AxiOut,
} from "@/lib/amba-bridge-model";
import { computeBurst, type AxiBurstType } from "@/lib/axi-burst-model";

const preset = (id: string) => translatePreset(BRIDGE_PRESETS.find((p) => p.id === id)!);
const axiOuts = (id: string) => preset(id).outputs as AxiOut[];
const ahbOuts = (id: string) => preset(id).outputs as AhbOut[];

describe("amba-bridge-model: AHB rules (IHI0033B.b 3.5)", () => {
  it("an AHB incrementing burst that crosses 1KB is illegal stimulus, so the old 0x0FE0 example cannot reach a bridge", () => {
    const r = preset("illegal-ahb");
    expect(r.inputViolations.map((v) => v.clause)).toEqual(["IHI0033B.b 3.5"]);
    expect(r.outputs).toEqual([]);
    expect(countAnswer(r)).toBe("illegal");
  });

  it("wrapping bursts are not subject to the 1KB rule; unaligned transfers are illegal", () => {
    expect(checkAhbBurst({ haddr: 0x3f8, hsize: 2, hburst: "WRAP4", beats: 4, busBytes: 4 })).toEqual([]);
    expect(checkAhbBurst({ haddr: 0x1002, hsize: 2, hburst: "INCR4", beats: 4, busBytes: 4 })).toHaveLength(1);
  });

  it("an INCR16 that ends exactly at 0x03FF is legal and needs no split", () => {
    const r = preset("ends-at-1kb");
    expect(r.outputs).toHaveLength(1);
    expect(r.reasons[0].kind).toBe("fits");
  });
});

describe("amba-bridge-model: AHB -> AXI split reasons are the AXI 256 cap and width conversion", () => {
  it("the simple INCR4 maps to one AXI INCR burst", () => {
    const [b] = axiOuts("simple");
    expect(b.label).toBe("AXI Burst 1");
    expect(b.request).toMatchObject({ startAddress: 0x1000, axlen: 3, axsize: 2, burst: "INCR" });
  });

  it("a 1024-transfer undefined-length INCR becomes four AXI INCR256 bursts (A3.4.1 cap)", () => {
    const outs = axiOuts("undefined-incr");
    expect(outs.map((o) => [o.request.startAddress, o.request.axlen])).toEqual([
      [0x400, 255],
      [0x500, 255],
      [0x600, 255],
      [0x700, 255],
    ]);
    expect(preset("undefined-incr").reasons.map((r) => r.kind)).toContain("axi-256-cap");
  });

  it("a downsized WRAP16 of doublewords would need a 32-beat AXI WRAP, so it becomes two INCR16 bursts in wrap order", () => {
    const outs = axiOuts("wrap-downsize");
    expect(outs.map((o) => [o.request.startAddress, o.request.axlen, o.request.axsize, o.request.burst])).toEqual([
      [0x140, 15, 2, "INCR"],
      [0x100, 15, 2, "INCR"],
    ]);
  });

  it("sweep: every legal AHB burst becomes legal AXI bursts carrying the same bytes in the same order, never crossing 4KB", () => {
    const addrs = [0x0, 0x8, 0x3c0, 0x3f8, 0x400, 0xfe0, 0xff8, 0x1f00];
    let checked = 0;
    for (const busBytes of [4, 8]) {
      for (const axiBus of [4, 8]) {
        for (let hsize = 0; 2 ** hsize <= busBytes; hsize += 1) {
          for (const hburst of AHB_HBURSTS) {
            for (const beats of hburst === "INCR" ? [1, 2, 3, 17, 300] : [ahbFixedBeats(hburst) as number]) {
              for (const haddr of addrs) {
                const ahb: AhbBurst = { haddr, hsize, hburst, beats, busBytes };
                if (checkAhbBurst(ahb).length > 0) continue;
                const r = translateAhbToAxi(ahb, axiBus);
                for (const o of r.outputs as AxiOut[]) expect(o.result.legal, `${hburst} ${haddr} ${o.label}`).toBe(true);
                expect(outputBytes(r)).toEqual(ahbBytes(ahb));
                checked += 1;
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});

describe("amba-bridge-model: AXI -> AHB must split at 1KB", () => {
  it("a legal AXI INCR16 at 0x03F0 crosses 0x0400, so the bridge issues INCR4 then a 12-transfer INCR", () => {
    expect(ahbOuts("axi-across-1kb").map((o) => [o.burst.haddr, o.burst.hburst, o.burst.beats])).toEqual([
      [0x3f0, "INCR4", 4],
      [0x400, "INCR", 12],
    ]);
    expect(preset("axi-across-1kb").reasons.some((r) => r.kind === "ahb-1kb" && r.splits)).toBe(true);
  });

  it("an unaligned AXI start becomes aligned SINGLE transfers for the partial bytes", () => {
    expect(ahbOuts("axi-unaligned").map((o) => [o.burst.haddr, o.burst.hsize, o.burst.hburst, o.burst.beats])).toEqual([
      [0x1001, 0, "SINGLE", 1],
      [0x1002, 1, "SINGLE", 1],
      [0x1004, 2, "INCR", 3],
    ]);
  });

  it("AXI WRAP4/8/16 map straight to AHB WRAP4/8/16", () => {
    expect(ahbOuts("axi-wrap4").map((o) => o.burst.hburst)).toEqual(["WRAP4"]);
  });

  it("sweep: every legal AXI burst becomes legal AHB bursts carrying the same bytes in the same order", () => {
    const addrs = [0x0, 0x1, 0x3f0, 0x3fe, 0x7fc, 0xfc0, 0x1003];
    let checked = 0;
    for (const burst of ["FIXED", "INCR", "WRAP"] as AxiBurstType[]) {
      for (let axsize = 0; axsize <= 2; axsize += 1) {
        for (const axlen of [0, 1, 3, 7, 15, 40]) {
          for (const startAddress of addrs) {
            const req = { startAddress, axlen, axsize, burst, dataBusBytes: 4 };
            if (!computeBurst(req).legal) continue;
            const r = translateAxiToAhb(req, 4);
            for (const o of r.outputs as AhbOut[]) expect(checkAhbBurst(o.burst), `${burst} ${startAddress} ${o.label}`).toEqual([]);
            expect(outputBytes(r)).toEqual(axiBytes(computeBurst(req)));
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});
