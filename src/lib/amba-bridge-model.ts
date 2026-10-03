/**
 * AHB <-> AXI bridge burst translation model.
 *
 * AHB rules (Arm IHI 0033B.b, AMBA 5 AHB):
 * - 3.5 Burst operation: "Masters must not attempt to start an incrementing
 *   burst that crosses a 1KB address boundary"; "All transfers in a burst must
 *   be aligned to the address boundary equal to the size of the transfer";
 *   HBURST encodings (Table 3-3) have no fixed-address burst and no 2-beat wrap.
 * - 3.4 Transfer size: HSIZE must not exceed the data bus width.
 * - 4.2 Address decoding: the minimum slave region is 1KB.
 *
 * AXI rules (Arm IHI 0022E): A3.4.1 (4KB, 256-beat INCR cap, WRAP lengths)
 * through `computeBurst`; A4.3.1 (downsizing below AxSIZE forces the
 * transaction to be modified).
 *
 * Because every 4KB boundary is also a 1KB boundary, a legal AHB INCR burst can
 * never cross 4KB. The real reasons an AHB->AXI bridge splits are the AXI
 * 256-transfer cap (undefined-length INCR) and width conversion. In the AXI->AHB
 * direction the bridge must split at 1KB.
 *
 * Bridge policy choices (not protocol rules) are labelled "policy" in `reasons`.
 * Pure, no React.
 */

import { computeBurst, hex, type AxiBurstType, type BurstRequest, type BurstResult } from "./axi-burst-model";

export type AhbHburst = "SINGLE" | "INCR" | "INCR4" | "INCR8" | "INCR16" | "WRAP4" | "WRAP8" | "WRAP16";
export const AHB_HBURSTS: AhbHburst[] = ["SINGLE", "INCR", "INCR4", "INCR8", "INCR16", "WRAP4", "WRAP8", "WRAP16"];
const FIXED_BEATS: Partial<Record<AhbHburst, number>> = { SINGLE: 1, INCR4: 4, INCR8: 8, INCR16: 16, WRAP4: 4, WRAP8: 8, WRAP16: 16 };
export const ONE_KB = 0x400;

export interface AhbBurst {
  haddr: number;
  /** HSIZE as log2 of bytes per transfer. */
  hsize: number;
  hburst: AhbHburst;
  /** Number of transfers. Fixed by HBURST except for undefined-length INCR. */
  beats: number;
  /** Data bus width in bytes. */
  busBytes: number;
}

export const isWrap = (h: AhbHburst) => h.startsWith("WRAP");
export const ahbFixedBeats = (h: AhbHburst) => FIXED_BEATS[h];

/** Transfer addresses of an AHB burst (incrementing, or wrapping at beats x size). */
export function ahbAddresses(b: AhbBurst): number[] {
  const nb = 2 ** b.hsize;
  const out: number[] = [];
  if (isWrap(b.hburst)) {
    const total = nb * b.beats;
    const lower = Math.floor(b.haddr / total) * total;
    for (let i = 0; i < b.beats; i += 1) out.push(lower + ((b.haddr - lower + i * nb) % total));
  } else {
    for (let i = 0; i < b.beats; i += 1) out.push(b.haddr + i * nb);
  }
  return out;
}

export interface Violation {
  clause: string;
  message: string;
}

export function checkAhbBurst(b: AhbBurst): Violation[] {
  const nb = 2 ** b.hsize;
  const v: Violation[] = [];
  if (nb > b.busBytes) v.push({ clause: "IHI0033B.b 3.4", message: `HSIZE of ${nb} bytes is wider than the ${b.busBytes}-byte data bus.` });
  const fixed = FIXED_BEATS[b.hburst];
  if (fixed !== undefined && fixed !== b.beats) v.push({ clause: "IHI0033B.b 3.5", message: `${b.hburst} always has ${fixed} transfer${fixed === 1 ? "" : "s"}, not ${b.beats}.` });
  if (b.beats < 1) v.push({ clause: "IHI0033B.b 3.5", message: "A burst needs at least one transfer." });
  if (b.haddr % nb !== 0) v.push({ clause: "IHI0033B.b 3.5", message: `${hex(b.haddr)} is not aligned to the ${nb}-byte transfer size. All transfers in a burst must be aligned.` });
  if (!isWrap(b.hburst) && b.beats > 0) {
    const last = b.haddr + b.beats * nb - 1;
    if (Math.floor(b.haddr / ONE_KB) !== Math.floor(last / ONE_KB)) {
      const boundary = (Math.floor(b.haddr / ONE_KB) + 1) * ONE_KB;
      v.push({
        clause: "IHI0033B.b 3.5",
        message: `Bytes ${hex(b.haddr)} to ${hex(last)} cross the 1KB boundary at ${hex(boundary)}. "Masters must not attempt to start an incrementing burst that crosses a 1KB address boundary."`,
      });
    }
  }
  return v;
}

export type ReasonKind =
  | "illegal-input"
  | "fits"
  | "axi-256-cap"
  | "narrow"
  | "downsize"
  | "downsize-wrap"
  | "ahb-1kb"
  | "ahb-unaligned"
  | "ahb-no-fixed"
  | "ahb-no-wrap2"
  | "ahb-undefined-incr"
  | "needs-downsizer";

export interface Reason {
  kind: ReasonKind;
  /** Whether the reason forces more than one output burst. */
  splits: boolean;
  /** "protocol" if a spec rule forces it; "policy" if it is this bridge's design choice. */
  basis: "protocol" | "policy";
  clause: string;
  text: string;
}

export interface AxiOut {
  kind: "axi";
  label: string;
  request: BurstRequest;
  result: BurstResult;
}

export interface AhbOut {
  kind: "ahb";
  label: string;
  burst: AhbBurst;
  addresses: number[];
}

export interface BridgeResult {
  direction: "ahb-to-axi" | "axi-to-ahb";
  inputViolations: Violation[];
  outputs: (AxiOut | AhbOut)[];
  reasons: Reason[];
  /** Narration of what the bridge does, in order. */
  steps: string[];
}

/** Byte addresses an AHB burst moves, in bus order. */
export function ahbBytes(b: AhbBurst): number[] {
  const nb = 2 ** b.hsize;
  return ahbAddresses(b).flatMap((a) => Array.from({ length: nb }, (_, i) => a + i));
}

/** Byte addresses an AXI burst moves, in bus order (all strobes on). */
export function axiBytes(r: BurstResult): number[] {
  return r.beats.flatMap((beat) => Array.from({ length: beat.lastByte - beat.firstByte + 1 }, (_, i) => beat.firstByte + i));
}

export function outputBytes(result: BridgeResult): number[] {
  return result.outputs.flatMap((o) => (o.kind === "axi" ? axiBytes(o.result) : ahbBytes(o.burst)));
}

const axiOut = (label: string, request: BurstRequest): AxiOut => ({ kind: "axi", label, request, result: computeBurst(request) });

function incrChunks(start: number, beats: number, axsize: number, dataBusBytes: number, firstLabel: number): AxiOut[] {
  const out: AxiOut[] = [];
  let addr = start;
  let left = beats;
  let n = firstLabel;
  while (left > 0) {
    const take = Math.min(256, left);
    out.push(axiOut(`AXI Burst ${n}`, { startAddress: addr, axlen: take - 1, axsize, burst: "INCR", dataBusBytes }));
    addr += take * 2 ** axsize;
    left -= take;
    n += 1;
  }
  return out;
}

export function translateAhbToAxi(ahb: AhbBurst, axiBusBytes: number): BridgeResult {
  const inputViolations = checkAhbBurst(ahb);
  const nb = 2 ** ahb.hsize;
  const steps = [`AHB master: ${ahb.hburst} ${ahb.beats} x ${nb} B at HADDR ${hex(ahb.haddr)} on a ${ahb.busBytes * 8}-bit bus.`];
  if (inputViolations.length > 0) {
    steps.push("This is not a legal AHB burst, so a correct AHB master never produces it. The bridge may assume it never happens; an AHB-side checker must fire instead.");
    return {
      direction: "ahb-to-axi",
      inputViolations,
      outputs: [],
      reasons: [{ kind: "illegal-input", splits: false, basis: "protocol", clause: inputViolations[0].clause, text: inputViolations[0].message }],
      steps,
    };
  }

  const reasons: Reason[] = [];
  let outputs: AxiOut[] = [];
  const wrap = isWrap(ahb.hburst);

  if (nb <= axiBusBytes) {
    const axsize = ahb.hsize;
    if (axiBusBytes > nb) {
      reasons.push({
        kind: "narrow",
        splits: false,
        basis: "policy",
        clause: "IHI0022E A3.4.3",
        text: `Each ${nb}-byte AHB transfer goes out as a narrow AXI transfer (AxSIZE=${axsize}) on the ${axiBusBytes * 8}-bit bus; the byte lanes move with the address.`,
      });
    }
    if (wrap) {
      outputs = [axiOut("AXI Burst 1", { startAddress: ahb.haddr, axlen: ahb.beats - 1, axsize, burst: "WRAP", dataBusBytes: axiBusBytes })];
    } else {
      outputs = incrChunks(ahb.haddr, ahb.beats, axsize, axiBusBytes, 1);
      if (ahb.beats > 256) {
        reasons.push({
          kind: "axi-256-cap",
          splits: true,
          basis: "protocol",
          clause: "IHI0022E A3.4.1",
          text: `AXI4 INCR bursts stop at 256 transfers. This undefined-length INCR has ${ahb.beats}, so it becomes ${outputs.length} AXI bursts.`,
        });
      }
    }
  } else {
    const k = nb / axiBusBytes;
    const axsize = Math.log2(axiBusBytes);
    const total = ahb.beats * k;
    reasons.push({
      kind: "downsize",
      splits: false,
      basis: "protocol",
      clause: "IHI0022E A4.3.1",
      text: `Each ${nb}-byte AHB transfer is wider than the ${axiBusBytes * 8}-bit AXI bus, so it becomes ${k} AXI transfers of ${axiBusBytes} bytes. Downsizing below the transfer size forces the bridge to modify the transaction.`,
    });
    if (wrap && total <= 16) {
      outputs = [axiOut("AXI Burst 1", { startAddress: ahb.haddr, axlen: total - 1, axsize, burst: "WRAP", dataBusBytes: axiBusBytes })];
    } else if (wrap) {
      const span = nb * ahb.beats;
      const lower = Math.floor(ahb.haddr / span) * span;
      const upper = lower + span;
      const firstBeats = (upper - ahb.haddr) / axiBusBytes;
      const secondBeats = (ahb.haddr - lower) / axiBusBytes;
      outputs = [axiOut("AXI Burst 1", { startAddress: ahb.haddr, axlen: firstBeats - 1, axsize, burst: "INCR", dataBusBytes: axiBusBytes })];
      if (secondBeats > 0) outputs.push(axiOut("AXI Burst 2", { startAddress: lower, axlen: secondBeats - 1, axsize, burst: "INCR", dataBusBytes: axiBusBytes }));
      reasons.push({
        kind: "downsize-wrap",
        splits: outputs.length > 1,
        basis: "protocol",
        clause: "IHI0022E A3.4.1",
        text: `After downsizing the wrap would need ${total} AXI transfers, but AXI WRAP bursts are limited to 2, 4, 8 or 16. The bridge issues the same byte order as INCR bursts: up to the wrap boundary ${hex(upper)}, then from ${hex(lower)}.`,
      });
    } else {
      outputs = incrChunks(ahb.haddr, total, axsize, axiBusBytes, 1);
      if (total > 256) {
        reasons.push({ kind: "axi-256-cap", splits: true, basis: "protocol", clause: "IHI0022E A3.4.1", text: `${total} AXI transfers exceed the 256-transfer INCR limit.` });
      }
    }
  }

  if (!reasons.some((r) => r.splits)) {
    reasons.unshift({
      kind: "fits",
      splits: false,
      basis: "protocol",
      clause: "IHI0033B.b 3.5",
      text:
        "No split is needed. A legal AHB incrementing burst never crosses 1KB, so it cannot cross a 4KB boundary either, and it fits in one AXI burst.",
    });
  }
  outputs.forEach((o) => steps.push(`${o.label}: AxADDR ${hex(o.request.startAddress)}, AxLEN ${o.request.axlen} (${o.request.axlen + 1} transfers), AxSIZE ${o.request.axsize}, ${o.request.burst}.`));
  return { direction: "ahb-to-axi", inputViolations: [], outputs, reasons, steps };
}

/** Largest naturally aligned power-of-two pieces covering bytes first..last. */
export function alignedPieces(first: number, last: number, maxBytes: number): { addr: number; bytes: number }[] {
  const out: { addr: number; bytes: number }[] = [];
  let a = first;
  while (a <= last) {
    let size = maxBytes;
    while (size > 1 && (a % size !== 0 || a + size - 1 > last)) size /= 2;
    out.push({ addr: a, bytes: size });
    a += size;
  }
  return out;
}

const ahbOut = (label: string, burst: AhbBurst): AhbOut => ({ kind: "ahb", label, burst, addresses: ahbAddresses(burst) });

function hburstFor(beats: number): AhbHburst {
  if (beats === 1) return "SINGLE";
  if (beats === 4) return "INCR4";
  if (beats === 8) return "INCR8";
  if (beats === 16) return "INCR16";
  return "INCR";
}

export function translateAxiToAhb(req: BurstRequest, ahbBusBytes: number): BridgeResult {
  const r = computeBurst(req);
  const nb = r.numberBytes;
  const steps = [`AXI master: ${req.burst} ${r.burstLength} x ${nb} B at AxADDR ${hex(req.startAddress)} on a ${req.dataBusBytes * 8}-bit bus.`];
  if (!r.legal) {
    steps.push("This is not a legal AXI burst. The bridge may assume it never happens; an AXI-side checker must fire instead.");
    return {
      direction: "axi-to-ahb",
      inputViolations: r.violations.map((v) => ({ clause: v.clause, message: v.message })),
      outputs: [],
      reasons: [{ kind: "illegal-input", splits: false, basis: "protocol", clause: r.violations[0].clause, text: r.violations[0].message }],
      steps,
    };
  }
  if (nb > ahbBusBytes) {
    return {
      direction: "axi-to-ahb",
      inputViolations: [],
      outputs: [],
      reasons: [{ kind: "needs-downsizer", splits: false, basis: "policy", clause: "IHI0033B.b 3.4", text: `A ${nb}-byte transfer does not fit the ${ahbBusBytes * 8}-bit AHB bus; a downsizer must come first (not modelled).` }],
      steps,
    };
  }

  const outputs: AhbOut[] = [];
  const reasons: Reason[] = [];
  const add = (b: Omit<AhbBurst, "busBytes">) => outputs.push(ahbOut(`AHB Burst ${outputs.length + 1}`, { ...b, busBytes: ahbBusBytes }));
  const singles = (first: number, last: number) =>
    alignedPieces(first, last, nb).forEach((p) => add({ haddr: p.addr, hsize: Math.log2(p.bytes), hburst: "SINGLE", beats: 1 }));

  if (req.burst === "FIXED") {
    r.beats.forEach((b) => singles(b.firstByte, b.lastByte));
    reasons.push({ kind: "ahb-no-fixed", splits: r.burstLength > 1, basis: "protocol", clause: "IHI0033B.b 3.5 (Table 3-3)", text: "AHB has no fixed-address burst type, so every AXI transfer becomes its own SINGLE transfer." });
  } else if (req.burst === "WRAP") {
    if (r.burstLength >= 4) {
      add({ haddr: req.startAddress, hsize: req.axsize, hburst: `WRAP${r.burstLength}` as AhbHburst, beats: r.burstLength });
    } else {
      // WRAP2: AHB has no 2-transfer wrap.
      const wb = r.wrapBoundary as number;
      if (req.startAddress === wb) add({ haddr: wb, hsize: req.axsize, hburst: "INCR", beats: 2 });
      else r.beats.forEach((b) => add({ haddr: b.address, hsize: req.axsize, hburst: "SINGLE", beats: 1 }));
      reasons.push({ kind: "ahb-no-wrap2", splits: req.startAddress !== wb, basis: "protocol", clause: "IHI0033B.b 3.5 (Table 3-3)", text: "AHB wraps only in 4, 8 or 16 transfers. A 2-transfer wrap that starts in the upper half becomes two SINGLE transfers in wrap order." });
    }
  } else {
    let first = 0;
    if (!r.aligned) {
      const b0 = r.beats[0];
      singles(b0.firstByte, b0.lastByte);
      first = 1;
      reasons.push({
        kind: "ahb-unaligned",
        splits: true,
        basis: "protocol",
        clause: "IHI0033B.b 3.5",
        text: `The first AXI transfer starts at ${hex(req.startAddress)}, which is not aligned to ${nb} bytes. AHB transfers must be aligned, so the bridge sends the partial bytes as smaller aligned SINGLE transfers.`,
      });
    }
    let addr = first === 1 ? r.alignedAddress + nb : req.startAddress;
    let left = r.burstLength - first;
    let segments = 0;
    while (left > 0) {
      const boundary = (Math.floor(addr / ONE_KB) + 1) * ONE_KB;
      const take = Math.min(left, (boundary - addr) / nb);
      add({ haddr: addr, hsize: req.axsize, hburst: hburstFor(take), beats: take });
      addr += take * nb;
      left -= take;
      segments += 1;
    }
    if (segments > 1) {
      reasons.push({
        kind: "ahb-1kb",
        splits: true,
        basis: "protocol",
        clause: "IHI0033B.b 3.5",
        text: "The AXI burst is legal (it stays inside 4KB) but it crosses a 1KB boundary, and an AHB master must not start an incrementing burst that crosses 1KB. The bridge splits at the boundary.",
      });
    }
    if (outputs.some((o) => o.burst.hburst === "INCR" && o.burst.beats > 1)) {
      reasons.push({
        kind: "ahb-undefined-incr",
        splits: false,
        basis: "policy",
        clause: "IHI0033B.b 3.5 (Table 3-3)",
        text: "Pieces that are not 4, 8 or 16 transfers long use HBURST=INCR (undefined length). A bridge could also break them into INCR4/8/16 plus SINGLEs; that is a design choice.",
      });
    }
  }

  if (!reasons.some((x) => x.splits)) {
    reasons.unshift({ kind: "fits", splits: false, basis: "protocol", clause: "IHI0033B.b 3.5", text: "No split is needed: the burst maps onto one legal AHB burst." });
  }
  outputs.forEach((o) => steps.push(`${o.label}: HADDR ${hex(o.burst.haddr)}, HBURST ${o.burst.hburst}, ${o.burst.beats} x ${2 ** o.burst.hsize} B.`));
  return { direction: "axi-to-ahb", inputViolations: [], outputs, reasons, steps };
}

// ---------------------------------------------------------------------------
// Presets for BridgeTranslationExplorer
// ---------------------------------------------------------------------------

export interface BridgePreset {
  id: string;
  label: string;
  desc: string;
  direction: "ahb-to-axi" | "axi-to-ahb";
  ahb?: AhbBurst;
  axi?: BurstRequest;
  /** Width of the bus on the other side, in bytes. */
  otherBusBytes: number;
}

export const BRIDGE_PRESETS: BridgePreset[] = [
  {
    id: "simple",
    label: "Simple INCR4",
    desc: "An AHB INCR4 write of words at 0x1000, 32-bit on both sides.",
    direction: "ahb-to-axi",
    ahb: { haddr: 0x1000, hsize: 2, hburst: "INCR4", beats: 4, busBytes: 4 },
    otherBusBytes: 4,
  },
  {
    id: "ends-at-1kb",
    label: "INCR16 up to 1KB",
    desc: "An AHB INCR16 of words that ends exactly at the 1KB boundary (last byte 0x03FF).",
    direction: "ahb-to-axi",
    ahb: { haddr: 0x03c0, hsize: 2, hburst: "INCR16", beats: 16, busBytes: 4 },
    otherBusBytes: 4,
  },
  {
    id: "undefined-incr",
    label: "1024-byte INCR",
    desc: "A byte-wide DMA streams 1024 bytes as one undefined-length INCR starting at 0x0400. It stays inside one 1KB region.",
    direction: "ahb-to-axi",
    ahb: { haddr: 0x0400, hsize: 0, hburst: "INCR", beats: 1024, busBytes: 4 },
    otherBusBytes: 4,
  },
  {
    id: "wrap-downsize",
    label: "WRAP16 to 32-bit",
    desc: "A 64-bit AHB master does a WRAP16 of doublewords at 0x0140 (a 128-byte line) into a 32-bit AXI fabric.",
    direction: "ahb-to-axi",
    ahb: { haddr: 0x0140, hsize: 3, hburst: "WRAP16", beats: 16, busBytes: 8 },
    otherBusBytes: 4,
  },
  {
    id: "illegal-ahb",
    label: "Debug: 0x0FE0 INCR8",
    desc: "An AHB INCR8 of doublewords at 0x0FE0. Before you count bursts, check the input.",
    direction: "ahb-to-axi",
    ahb: { haddr: 0x0fe0, hsize: 3, hburst: "INCR8", beats: 8, busBytes: 8 },
    otherBusBytes: 8,
  },
  {
    id: "axi-across-1kb",
    label: "AXI INCR16 across 1KB",
    desc: "A CPU issues an AXI INCR16 of words at 0x03F0 to an AHB peripheral region. It is a legal AXI burst.",
    direction: "axi-to-ahb",
    axi: { startAddress: 0x03f0, axlen: 15, axsize: 2, burst: "INCR", dataBusBytes: 4 },
    otherBusBytes: 4,
  },
  {
    id: "axi-unaligned",
    label: "AXI unaligned start",
    desc: "An AXI INCR4 of words that starts at 0x1001.",
    direction: "axi-to-ahb",
    axi: { startAddress: 0x1001, axlen: 3, axsize: 2, burst: "INCR", dataBusBytes: 4 },
    otherBusBytes: 4,
  },
  {
    id: "axi-wrap4",
    label: "AXI WRAP4",
    desc: "An AXI WRAP4 of words at 0x100C (a 16-byte line fill).",
    direction: "axi-to-ahb",
    axi: { startAddress: 0x100c, axlen: 3, axsize: 2, burst: "WRAP", dataBusBytes: 4 },
    otherBusBytes: 4,
  },
];

export function translatePreset(p: Pick<BridgePreset, "direction" | "ahb" | "axi" | "otherBusBytes">): BridgeResult {
  return p.direction === "ahb-to-axi" ? translateAhbToAxi(p.ahb as AhbBurst, p.otherBusBytes) : translateAxiToAhb(p.axi as BurstRequest, p.otherBusBytes);
}

export type BurstCountAnswer = "illegal" | "1" | "2" | "3+";

export function countAnswer(result: BridgeResult): BurstCountAnswer {
  if (result.inputViolations.length > 0) return "illegal";
  const n = result.outputs.length;
  return n <= 1 ? "1" : n === 2 ? "2" : "3+";
}

export const AXI_BURST_TYPES: AxiBurstType[] = ["FIXED", "INCR", "WRAP"];
