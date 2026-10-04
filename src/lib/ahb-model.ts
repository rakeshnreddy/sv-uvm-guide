/**
 * AHB5 / AHB-Lite transfer model.
 *
 * Source: Arm IHI0033B.b, "AMBA 5 AHB Protocol Specification" (AHB5,
 * AHB-Lite). Every rule cites the section it implements; each was checked
 * against the extracted spec text.
 *
 * Time convention. Cycle k is the HCLK period that ENDS at rising edge k.
 * Everything driven during cycle k is sampled at edge k. The spec labels
 * edges T0, T1, …, so its interval "T(k-1)–Tk" is cycle k here.
 *
 * Pure and deterministic: no React, no randomness.
 */

// ---------------------------------------------------------------------------
// Encodings
// ---------------------------------------------------------------------------

export type HTrans = "IDLE" | "BUSY" | "NONSEQ" | "SEQ";
export type HBurst = "SINGLE" | "INCR" | "WRAP4" | "INCR4" | "WRAP8" | "INCR8" | "WRAP16" | "INCR16";
export type HResp = "OKAY" | "ERROR";

/** §3.2 Table 3-1, transfer type encoding. */
export const HTRANS_CODE: Record<HTrans, number> = { IDLE: 0b00, BUSY: 0b01, NONSEQ: 0b10, SEQ: 0b11 };

/** §3.5 Table 3-3, burst signal encoding. */
export const HBURST_CODE: Record<HBurst, number> = {
  SINGLE: 0b000,
  INCR: 0b001,
  WRAP4: 0b010,
  INCR4: 0b011,
  WRAP8: 0b100,
  INCR8: 0b101,
  WRAP16: 0b110,
  INCR16: 0b111,
};

const FIXED_BEATS: Record<Exclude<HBurst, "INCR">, number> = {
  SINGLE: 1,
  WRAP4: 4,
  INCR4: 4,
  WRAP8: 8,
  INCR8: 8,
  WRAP16: 16,
  INCR16: 16,
};

/** Bus width assumed by the model: 32 bits (the spec's recommended minimum, §6.1). */
export const BUS_BYTES = 4;

// ---------------------------------------------------------------------------
// Burst address math (§3.4, §3.5)
// ---------------------------------------------------------------------------

/** §3.4 Table 3-2: HSIZE encodes 2^HSIZE bytes. */
export function sizeBytes(hsize: number): number {
  return 2 ** hsize;
}

export function isWrapBurst(burst: HBurst): boolean {
  return burst === "WRAP4" || burst === "WRAP8" || burst === "WRAP16";
}

/** INCR (undefined length) and INCR4/8/16. The 1KB rule applies to these (§3.5). */
export function isIncrementingBurst(burst: HBurst): boolean {
  return burst === "INCR" || burst === "INCR4" || burst === "INCR8" || burst === "INCR16";
}

/** Beats in a burst. Undefined-length INCR takes its length from `incrBeats`. */
export function beatCount(burst: HBurst, incrBeats = 1): number {
  return burst === "INCR" ? Math.max(1, incrBeats) : FIXED_BEATS[burst];
}

/** §3.5: a wrapping burst wraps at (number of beats × transfer size) bytes. */
export function wrapBoundaryBytes(burst: HBurst, hsize: number): number | null {
  return isWrapBurst(burst) ? beatCount(burst) * sizeBytes(hsize) : null;
}

/**
 * Address of every beat. Incrementing: previous + size (§3.2 Table 3-1, SEQ).
 * Wrapping: the address wraps at the beats × size boundary (§3.5), e.g. a
 * WRAP4 of words from 0x34 is 0x34, 0x38, 0x3C, 0x30.
 */
export function burstAddresses(start: number, burst: HBurst, hsize: number, incrBeats = 1): number[] {
  const n = beatCount(burst, incrBeats);
  const size = sizeBytes(hsize);
  const boundary = wrapBoundaryBytes(burst, hsize);
  return Array.from({ length: n }, (_, i) => {
    if (boundary === null) return start + i * size;
    const base = Math.floor(start / boundary) * boundary;
    return base + ((start - base + i * size) % boundary);
  });
}

/** §3.5: all transfers in a burst must be aligned to their size. */
export function isAligned(addr: number, hsize: number): boolean {
  return addr % sizeBytes(hsize) === 0;
}

/** True when consecutive beats sit in different 1KB regions. */
export function crossesOneKB(addresses: number[]): boolean {
  return addresses.some((a, i) => i > 0 && Math.floor(a / 1024) !== Math.floor(addresses[i - 1] / 1024));
}

export interface BurstIssue {
  rule: "1kb" | "alignment" | "size";
  cite: string;
  text: string;
}

export interface BurstCheck {
  addresses: number[];
  wrapBoundary: number | null;
  legal: boolean;
  issues: BurstIssue[];
}

/** Legality of one burst against the address rules of §3.4 and §3.5. */
export function checkBurst(start: number, burst: HBurst, hsize: number, incrBeats = 1): BurstCheck {
  const addresses = burstAddresses(start, burst, hsize, incrBeats);
  const issues: BurstIssue[] = [];
  if (sizeBytes(hsize) > BUS_BYTES) {
    issues.push({ rule: "size", cite: "§3.4", text: `HSIZE ${hsize} (${sizeBytes(hsize)} bytes) is wider than the ${BUS_BYTES * 8}-bit data bus.` });
  }
  const unaligned = addresses.find((a) => !isAligned(a, hsize));
  if (unaligned !== undefined) {
    issues.push({ rule: "alignment", cite: "§3.5", text: `${hex(unaligned)} is not aligned to ${sizeBytes(hsize)}-byte transfers.` });
  }
  if (isIncrementingBurst(burst) && crossesOneKB(addresses)) {
    const at = addresses.find((a, i) => i > 0 && Math.floor(a / 1024) !== Math.floor(addresses[i - 1] / 1024)) as number;
    issues.push({
      rule: "1kb",
      cite: "§3.5",
      text: `${burst} from ${hex(start)} crosses the 1KB boundary at ${hex(Math.floor(at / 1024) * 1024)}. Masters must not start an incrementing burst that crosses a 1KB boundary.`,
    });
  }
  return { addresses, wrapBoundary: wrapBoundaryBytes(burst, hsize), legal: issues.length === 0, issues };
}

export function hex(n: number): string {
  return `0x${n.toString(16).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Cycle simulator
// ---------------------------------------------------------------------------

export interface BurstSpec {
  /** One-letter name, e.g. "A". Beats are "A" (single beat) or "A0", "A1", … */
  id: string;
  write: boolean;
  burst: HBurst;
  hsize: number;
  start: number;
  /** Beats of an undefined-length INCR. */
  incrBeats?: number;
  /** Cycles of BUSY the master drives before beat i (i ≥ 1). */
  busyBefore?: Record<number, number>;
  /** Cycles of IDLE the master drives before this burst's NONSEQ. */
  idleBefore?: number;
}

export interface SlaveResponse {
  /** OKAY wait states before the response (§5.1.2). */
  waits: number;
  resp: HResp;
}

/** What the master does once it sees an ERROR (§3.5.2: either is allowed). */
export type ErrorPolicy = "cancel" | "continue";
/** "one-cycle-bug" is a broken slave: ERROR for one cycle with HREADY high. */
export type ErrorStyle = "two-cycle" | "one-cycle-bug";

export interface AhbScenario {
  bursts: BurstSpec[];
  /** Per-beat slave behaviour, keyed by beat label. Default: zero-wait OKAY. */
  slave?: Record<string, SlaveResponse>;
  onError?: ErrorPolicy;
  errorStyle?: ErrorStyle;
  /** Idle cycles drawn after the last transfer completes. Default 1. */
  tailCycles?: number;
}

export interface Beat {
  label: string;
  burstId: string;
  index: number;
  addr: number;
  write: boolean;
  burst: HBurst;
  hsize: number;
  trans: "NONSEQ" | "SEQ";
}

export type BeatStatus = "done" | "cancelled" | "pending";

export interface BeatRecord extends Beat {
  /** First cycle this beat's NONSEQ/SEQ was on the address bus. */
  firstAddrCycle: number | null;
  /** Edge where HREADY was high with this beat on the address bus. */
  acceptEdge: number | null;
  dataCycles: number[];
  completeEdge: number | null;
  resp: HResp | null;
  status: BeatStatus;
}

export type DataPhase = "none" | "idle" | "busy" | "wait" | "done" | "error1" | "error2" | "error-bug";

export interface AhbCycle {
  cycle: number;
  // Address phase, driven by the master.
  htrans: HTrans;
  haddr: number | null;
  hburst: HBurst | null;
  hsize: number | null;
  hwrite: boolean | null;
  /** Beat on the address bus (for BUSY: the beat it announces). */
  addrBeat: string | null;
  /** True when this IDLE is the master cancelling after an ERROR. */
  cancelIdle: boolean;
  // Data phase.
  dataBeat: string | null;
  dataPhase: DataPhase;
  hready: 0 | 1;
  hresp: HResp;
  hwdata: string | null;
  hrdata: string | null;
  // What happens at edge k (the end of this cycle).
  accepted: string | null;
  completed: string | null;
  /** Beats the master abandons because of an ERROR it saw at this edge. */
  cancelled: string[];
  what: string;
  why: string;
}

export interface AhbTrace {
  cycles: AhbCycle[];
  beats: BeatRecord[];
}

type QueueItem = { kind: "IDLE" } | { kind: "BUSY"; beat: Beat } | { kind: "XFER"; beat: Beat };

const IDLE_ITEM: QueueItem = { kind: "IDLE" };
const MAX_CYCLES = 64;

function beatLabel(id: string, index: number, n: number): string {
  return n === 1 ? id : `${id}${index}`;
}

/**
 * Cycle-accurate run of one master and one slave region.
 *
 * Rules:
 * - Address phase lasts one cycle unless the previous transfer extends it;
 *   a transfer moves on only at an edge where HREADY is high (§3.1).
 * - NONSEQ starts a burst, SEQ continues it; BUSY carries the next beat's
 *   address and control and is not a transfer; IDLE asks for nothing (§3.2).
 * - IDLE and BUSY get a zero-wait OKAY and are ignored by the slave (§3.2).
 * - Wait states use OKAY (§5.1.2). ERROR takes two cycles: HRESP high with
 *   HREADY low, then HRESP high with HREADY high (§5.1.3, Table 5-2).
 * - A master that cancels after ERROR drives IDLE during the two-cycle
 *   response (§3.5.2, §5.1.3) and may change the address while HREADY is low
 *   (§3.6.2). It cannot cancel a transfer that has already been accepted (§5.1).
 * - Write data is held for the whole data phase (§6.1.1). Read data only has
 *   to be valid in the cycle that completes with OKAY (§6.1.2).
 */
export function simulateAhb(scenario: AhbScenario): AhbTrace {
  const onError: ErrorPolicy = scenario.onError ?? "cancel";
  const style: ErrorStyle = scenario.errorStyle ?? "two-cycle";
  let queue: QueueItem[] = [];
  const beats: BeatRecord[] = [];

  for (const b of scenario.bursts) {
    for (let i = 0; i < (b.idleBefore ?? 0); i++) queue.push(IDLE_ITEM);
    const addrs = burstAddresses(b.start, b.burst, b.hsize, b.incrBeats);
    addrs.forEach((addr, i) => {
      const beat: Beat = {
        label: beatLabel(b.id, i, addrs.length),
        burstId: b.id,
        index: i,
        addr,
        write: b.write,
        burst: b.burst,
        hsize: b.hsize,
        trans: i === 0 ? "NONSEQ" : "SEQ",
      };
      beats.push({ ...beat, firstAddrCycle: null, acceptEdge: null, dataCycles: [], completeEdge: null, resp: null, status: "pending" });
      if (i > 0) for (let n = 0; n < (b.busyBefore?.[i] ?? 0); n++) queue.push({ kind: "BUSY", beat });
      queue.push({ kind: "XFER", beat });
    });
  }

  const recordOf = (label: string) => beats.find((r) => r.label === label) as BeatRecord;
  const errorSeen = new Set<string>();
  const cycles: AhbCycle[] = [];
  let q = 0;
  let dp: QueueItem | null = null;
  let dpCycles = 0;
  let cancelNext = false;
  let tail = scenario.tailCycles ?? 1;

  for (let k = 0; k < MAX_CYCLES; k++) {
    const pending = q < queue.length || dp?.kind === "XFER" || cancelNext;
    if (!pending) {
      if (tail <= 0) break;
      tail -= 1;
    }

    // ---- Address phase (master) ----
    const cancelIdle = cancelNext;
    cancelNext = false;
    const fromQueue = !cancelIdle && q < queue.length;
    const item: QueueItem = fromQueue ? queue[q] : IDLE_ITEM;
    const addrBeat = item.kind === "IDLE" ? null : item.beat;
    const htrans: HTrans = item.kind === "IDLE" ? "IDLE" : item.kind === "BUSY" ? "BUSY" : item.beat.trans;
    if (item.kind === "XFER" && recordOf(item.beat.label).firstAddrCycle === null) {
      recordOf(item.beat.label).firstAddrCycle = k;
    }

    // ---- Data phase (slave) ----
    const xfer = dp?.kind === "XFER" ? dp.beat : null;
    let hready: 0 | 1 = 1;
    let hresp: HResp = "OKAY";
    let dataPhase: DataPhase = dp === null ? "none" : dp.kind === "IDLE" ? "idle" : dp.kind === "BUSY" ? "busy" : "done";
    if (xfer) {
      const r = scenario.slave?.[xfer.label] ?? { waits: 0, resp: "OKAY" };
      if (dpCycles < r.waits) {
        hready = 0;
        dataPhase = "wait";
      } else if (r.resp === "ERROR" && style === "one-cycle-bug") {
        hresp = "ERROR";
        dataPhase = "error-bug";
      } else if (r.resp === "ERROR" && dpCycles === r.waits) {
        hready = 0;
        hresp = "ERROR";
        dataPhase = "error1";
      } else if (r.resp === "ERROR") {
        hresp = "ERROR";
        dataPhase = "error2";
      }
      recordOf(xfer.label).dataCycles.push(k);
    }
    const hwdata = xfer && xfer.write ? xfer.label : null;
    const hrdata = xfer && !xfer.write && hready === 1 && hresp === "OKAY" ? xfer.label : null;

    // ---- Edge k ----
    let accepted: string | null = null;
    let completed: string | null = null;
    const cancelled: string[] = [];
    if (hready === 1) {
      if (xfer) {
        const rec = recordOf(xfer.label);
        rec.completeEdge = k;
        rec.resp = hresp;
        rec.status = "done";
        completed = xfer.label;
      }
      if (item.kind === "XFER") {
        recordOf(item.beat.label).acceptEdge = k;
        accepted = item.beat.label;
      }
      if (fromQueue) q += 1;
      dp = item;
      dpCycles = 0;
    } else {
      dpCycles += 1;
      // IDLE and BUSY are per-cycle choices; a NONSEQ/SEQ waits to be accepted.
      if (fromQueue && item.kind !== "XFER") q += 1;
    }

    // ---- Master reaction to ERROR ----
    if (xfer && hresp === "ERROR" && !errorSeen.has(xfer.label)) {
      errorSeen.add(xfer.label);
      if (onError === "cancel") {
        const drop = new Set<string>([xfer.burstId]);
        // The access on the address bus can be abandoned only if it was not accepted (§5.1).
        if (hready === 0 && addrBeat) drop.add(addrBeat.burstId);
        const keep: QueueItem[] = [];
        for (const it of queue.slice(q)) {
          if (it.kind !== "IDLE" && drop.has(it.beat.burstId)) {
            if (it.kind === "XFER") {
              recordOf(it.beat.label).status = "cancelled";
              cancelled.push(it.beat.label);
            }
          } else keep.push(it);
        }
        queue = [...queue.slice(0, q), ...keep];
        // Two-cycle ERROR: IDLE in the second cycle (§3.5.2). One-cycle bug: the
        // pending access was already accepted, so IDLE only helps if beats remain.
        cancelNext = hready === 0 || cancelled.length > 0;
      }
    }

    const cycle: AhbCycle = {
      cycle: k,
      htrans,
      haddr: addrBeat?.addr ?? null,
      hburst: addrBeat?.burst ?? null,
      hsize: addrBeat?.hsize ?? null,
      hwrite: addrBeat?.write ?? null,
      addrBeat: addrBeat?.label ?? null,
      cancelIdle,
      dataBeat: xfer?.label ?? null,
      dataPhase,
      hready,
      hresp,
      hwdata,
      hrdata,
      accepted,
      completed,
      cancelled,
      what: "",
      why: "",
    };
    const story = narrate(cycle, item, onError, cycles[k - 1] ?? null);
    cycle.what = story.what;
    cycle.why = story.why;
    cycles.push(cycle);
  }

  return { cycles, beats };
}

function narrate(c: AhbCycle, item: QueueItem, onError: ErrorPolicy, prev: AhbCycle | null): { what: string; why: string } {
  const k = c.cycle;
  const parts: string[] = [];
  let why = "";

  // Data side first: it decides what happens at the edge.
  switch (c.dataPhase) {
    case "none":
      parts.push("No data phase is in progress.");
      break;
    case "idle":
      parts.push("The data phase belongs to an IDLE: zero-wait OKAY.");
      break;
    case "busy":
      parts.push("The data phase belongs to a BUSY: the slave gives a zero-wait OKAY, and the master ignores HRDATA.");
      why = "§3.2 Table 3-1: slaves must give IDLE and BUSY a zero-wait OKAY and ignore them.";
      break;
    case "wait":
      parts.push(`${c.dataBeat}'s data phase is waited: HREADY is low with OKAY, so nothing is sampled at edge ${k}.`);
      why = "§3.1: a transfer completes only at an edge where HREADY is high. §5.1.2: wait states use OKAY. Extending a data phase also extends the next address phase.";
      break;
    case "done":
      parts.push(
        c.hwdata
          ? `The slave samples HWDATA = ${c.hwdata} at edge ${k}: ${c.dataBeat} completes OKAY.`
          : `The master samples HRDATA = ${c.hrdata} at edge ${k}: ${c.dataBeat} completes OKAY.`,
      );
      why = c.hwdata
        ? "§3.1 and §6.1.1: the master holds write data until an edge with HREADY high, where it is sampled."
        : "§6.1.2: read data only has to be valid in the final cycle, the one with HREADY high.";
      break;
    case "error1":
      parts.push(`ERROR, first cycle: HRESP is high and HREADY is low, so ${c.dataBeat} does not complete and nothing on the address bus is accepted at edge ${k}.`);
      why = "§5.1.3, Table 5-2: ERROR starts with HRESP high and HREADYOUT low. That spare cycle lets the master see the error before the next transfer is accepted.";
      break;
    case "error2":
      parts.push(`ERROR, second cycle: HRESP and HREADY are both high, so ${c.dataBeat} completes with ERROR at edge ${k}.`);
      why = "§5.1.3, Table 5-2: the second cycle drives HREADYOUT high while HRESP stays high.";
      break;
    case "error-bug":
      parts.push(`Protocol violation: the slave drives ERROR with HREADY high for one cycle, so ${c.dataBeat} completes at edge ${k} without a first ERROR cycle.`);
      why = "§5.1.3 requires a first cycle with HREADY low. Without it the master learns about the error at the same edge that accepts its next transfer, too late to cancel it.";
      break;
  }

  // Address side.
  if (c.cancelIdle) {
    const abandoned = prev?.cancelled ?? [];
    parts.push(
      abandoned.length === 0
        ? "The master drives IDLE to cancel after the ERROR."
        : `The master drives IDLE to cancel: ${abandoned.join(", ")} ${abandoned.length === 1 ? "is" : "are"} never accepted.`,
    );
    why =
      prev?.hready === 0
        ? "§3.5.2 and §5.1.3: a master that cancels after ERROR must drive IDLE during the two-cycle ERROR response. §3.6.2 lets it change the address while HREADY is low."
        : "§3.5.2: after an ERROR the master may cancel the remaining beats of the burst. The access accepted at the ERROR edge cannot be cancelled (§5.1).";
  } else if (item.kind === "IDLE") {
    parts.push("HTRANS is IDLE: the master requests nothing.");
  } else if (item.kind === "BUSY") {
    parts.push(`HTRANS is BUSY: the master pauses the burst. HADDR already shows ${c.addrBeat}'s address (${hex(c.haddr ?? 0)}).`);
    if (c.dataPhase !== "wait" && c.dataPhase !== "error1") why = "§3.2 Table 3-1: BUSY carries the address and control of the next beat but is not a transfer.";
  } else if (prev && prev.hready === 0 && !prev.cancelIdle && ((prev.htrans === "BUSY" && c.htrans === "SEQ") || (prev.htrans === "IDLE" && c.htrans === "NONSEQ"))) {
    parts.push(
      `The master changed ${prev.htrans} to ${c.htrans} while the slave was waiting. ${c.htrans} ${c.addrBeat} (${hex(c.haddr ?? 0)}) ${c.accepted ? `is accepted at edge ${k}` : "must now hold until HREADY is high"}.`,
    );
    why = `§3.6.1: during a waited transfer the master may change ${prev.htrans} to ${c.htrans}; after that HTRANS must stay constant until HREADY is high.`;
  } else if (c.accepted) {
    parts.push(`${c.htrans} ${c.accepted} (${hex(c.haddr ?? 0)}) is on the address bus and is accepted at edge ${k}, so its data phase starts next cycle.`);
    if (!why) why = "§3.1: the address phase lasts one cycle unless the previous transfer extends it; it ends at an edge with HREADY high.";
  } else {
    parts.push(`${c.htrans} ${c.addrBeat} (${hex(c.haddr ?? 0)}) is held on the address bus: HREADY is low, so its address phase is extended.`);
  }

  if (c.cancelled.length > 0) {
    parts.push(`Having seen the ERROR, the master abandons ${c.cancelled.join(", ")}.`);
  } else if (c.dataPhase === "error1" && onError === "continue") {
    parts.push("This master continues after the ERROR, so it keeps the pending transfer on the bus.");
  }
  const fallback =
    c.htrans === "IDLE" && (c.dataPhase === "none" || c.dataPhase === "idle")
      ? "§3.2 Table 3-1: IDLE means no transfer is required; the slave ignores it."
      : "§3.1: the address phase of one transfer overlaps the data phase of the previous one.";
  return { what: parts.join(" "), why: why || fallback };
}

// ---------------------------------------------------------------------------
// Protocol properties evaluated on a trace
// ---------------------------------------------------------------------------

export type AhbPropertyId =
  | "error-first-then-second"
  | "error-second-needs-first"
  | "hold-naive"
  | "hold-in-wait"
  | "busy-in-wait"
  | "incr-1kb-naive"
  | "incr-1kb-per-beat";

export interface AhbProperty {
  id: AhbPropertyId;
  name: string;
  /** "protocol": a correct spec check. "flawed": a check from older lessons that is wrong. */
  kind: "protocol" | "flawed";
  cite: string;
  summary: string;
  source: string[];
}

/** SV source shown to learners. The evaluator below implements the same expressions. */
export const AHB_PROPERTIES: Record<AhbPropertyId, AhbProperty> = {
  "error-first-then-second": {
    id: "error-first-then-second",
    name: "p_error_first_then_second",
    kind: "protocol",
    cite: "§5.1.3, Table 5-2",
    summary: "An ERROR first cycle must be followed by the second. Alone, it cannot see a one-cycle ERROR.",
    source: [
      "// [Protocol §5.1.3, Table 5-2] first ERROR cycle -> second ERROR cycle",
      "property p_error_first_then_second;",
      "  @(posedge HCLK) disable iff (!HRESETn)",
      "    (HRESP && !HREADY) |=> (HRESP && HREADY);",
      "endproperty",
    ],
  },
  "error-second-needs-first": {
    id: "error-second-needs-first",
    name: "p_error_second_needs_first",
    kind: "protocol",
    cite: "§5.1.3, Table 5-2",
    summary: "An ERROR completion must come right after an ERROR first cycle. This is the one that catches a one-cycle ERROR.",
    source: [
      "// [Protocol §5.1.3, Table 5-2] an ERROR completion needs a first cycle",
      "property p_error_second_needs_first;",
      "  @(posedge HCLK) disable iff (!HRESETn)",
      "    (HRESP && HREADY) |-> $past(HRESP && !HREADY);",
      "endproperty",
    ],
  },
  "hold-naive": {
    id: "hold-naive",
    name: "p_ctrl_stable (old)",
    kind: "flawed",
    cite: "contradicts §3.5.2, §3.6.1, §3.6.2",
    summary: "Demands that HTRANS and HADDR never change in a wait state. It fires on legal BUSY→SEQ and on cancel-after-ERROR.",
    source: [
      "// FLAWED: no exceptions for BUSY or for cancel-after-ERROR",
      "property p_ctrl_stable;",
      "  @(posedge HCLK) disable iff (!HRESETn)",
      "    (!HREADY && HTRANS != IDLE) |=>",
      "      $stable(HTRANS) && $stable(HADDR) && $stable({HWRITE, HSIZE, HBURST});",
      "endproperty",
    ],
  },
  "hold-in-wait": {
    id: "hold-in-wait",
    name: "p_hold_in_wait",
    kind: "protocol",
    cite: "§3.6.1, §3.6.2, §3.5.2",
    summary: "A waited NONSEQ/SEQ stays put, except that a master cancelling after ERROR switches to IDLE.",
    source: [
      "// [Protocol §3.6.1, §3.6.2, §3.5.2] a waited NONSEQ/SEQ holds,",
      "// unless the master cancels after an ERROR first cycle",
      "property p_hold_in_wait;",
      "  @(posedge HCLK) disable iff (!HRESETn)",
      "    (!HREADY && HTRANS inside {NONSEQ, SEQ}) |=>",
      "        ($stable(HTRANS) && $stable(HADDR) && $stable({HWRITE, HSIZE, HBURST}))",
      "     || ($past(HRESP) && HTRANS == IDLE);",
      "endproperty",
    ],
  },
  "busy-in-wait": {
    id: "busy-in-wait",
    name: "p_busy_in_wait",
    kind: "protocol",
    cite: "§3.6.1, §3.5.2",
    summary: "A waited BUSY may become SEQ at the same address; an undefined-length INCR may also end with IDLE or NONSEQ.",
    source: [
      "// [Protocol §3.6.1, §3.5.2] what a waited BUSY may change into",
      "property p_busy_in_wait;",
      "  @(posedge HCLK) disable iff (!HRESETn)",
      "    (!HREADY && HTRANS == BUSY) |=>",
      "        (HTRANS inside {BUSY, SEQ} && $stable(HADDR))",
      "     || ($past(HBURST) == INCR && HTRANS inside {IDLE, NONSEQ})",
      "     || ($past(HRESP) && HTRANS == IDLE);",
      "endproperty",
    ],
  },
  "incr-1kb-naive": {
    id: "incr-1kb-naive",
    name: "p_1kb_boundary (old)",
    kind: "flawed",
    cite: "contradicts §3.5",
    summary: "Adds the burst's total size to its start address for every burst type, so it fires on legal WRAP bursts and skips undefined-length INCR.",
    source: [
      "// FLAWED: ignores HBURST type; burst_bytes() returns 0 for INCR",
      "property p_1kb_boundary;",
      "  @(posedge HCLK) disable iff (!HRESETn)",
      "    (HTRANS == NONSEQ && HBURST != SINGLE) |->",
      "      (HADDR[9:0] + burst_bytes(HBURST, HSIZE)) <= 11'h400;",
      "endproperty",
    ],
  },
  "incr-1kb-per-beat": {
    id: "incr-1kb-per-beat",
    name: "p_incr_no_1kb_cross",
    kind: "protocol",
    cite: "§3.5, §4.2",
    summary: "Checks every accepted SEQ beat of an incrementing burst against the previous beat's 1KB region. Covers undefined-length INCR; WRAP is exempt.",
    source: [
      "// [Protocol §3.5, §4.2] incrementing bursts never cross 1KB.",
      "// Per beat, so undefined-length INCR is covered; WRAP bursts are exempt.",
      "property p_incr_no_1kb_cross;",
      "  @(posedge HCLK) disable iff (!HRESETn)",
      "    (HREADY && HTRANS == SEQ && !(HBURST inside {WRAP4, WRAP8, WRAP16})) |->",
      "      HADDR[31:10] == $past(HADDR[31:10], 1, HREADY && HTRANS inside {NONSEQ, SEQ});",
      "endproperty",
    ],
  },
};

export interface PropertyAttempt {
  /** Edge where the antecedent matched. */
  edge: number;
  /** Edge where the attempt passed or failed. */
  decidedAt: number;
  pass: boolean;
  why: string;
}

export interface PropertyResult {
  id: AhbPropertyId;
  attempts: PropertyAttempt[];
  failures: PropertyAttempt[];
  /** No attempt ever started: the property holds vacuously on this trace. */
  vacuous: boolean;
}

const sameCtrl = (a: AhbCycle, b: AhbCycle) => a.hwrite === b.hwrite && a.hsize === b.hsize && a.hburst === b.hburst;
const isXfer = (t: HTrans) => t === "NONSEQ" || t === "SEQ";

/** Last edge before k where `gate` held: SV `$past(expr, 1, gate)` (IEEE 1800-2023 §16.9.3). */
function pastGated(cycles: AhbCycle[], k: number, gate: (c: AhbCycle) => boolean): AhbCycle | null {
  for (let j = k - 1; j >= 0; j--) if (gate(cycles[j])) return cycles[j];
  return null;
}

/**
 * Evaluates one property at every edge of the trace, with sampled values
 * (column k = value sampled at edge k). An attempt still open at the last
 * edge is dropped. Before the first edge `$past` returns the reset values,
 * modelled here as OKAY, HREADY high and IDLE.
 */
export function evaluateAhbProperty(id: AhbPropertyId, trace: AhbTrace): PropertyResult {
  const cs = trace.cycles;
  const attempts: PropertyAttempt[] = [];
  const add = (edge: number, decidedAt: number, pass: boolean, why: string) => attempts.push({ edge, decidedAt, pass, why });

  for (let k = 0; k < cs.length; k++) {
    const c = cs[k];
    const next = cs[k + 1];
    const prev = k > 0 ? cs[k - 1] : null;
    switch (id) {
      case "error-first-then-second":
        if (c.hresp === "ERROR" && c.hready === 0 && next) {
          const ok = next.hresp === "ERROR" && next.hready === 1;
          add(k, k + 1, ok, ok ? `Edge ${k + 1} completes the ERROR.` : `Edge ${k + 1} does not show HRESP and HREADY both high.`);
        }
        break;
      case "error-second-needs-first":
        if (c.hresp === "ERROR" && c.hready === 1) {
          const ok = prev !== null && prev.hresp === "ERROR" && prev.hready === 0;
          add(k, k, ok, ok ? `Edge ${k - 1} was the first ERROR cycle.` : `Edge ${k} completes an ERROR, but edge ${k - 1} had no ERROR with HREADY low: a one-cycle ERROR.`);
        }
        break;
      case "hold-naive":
        if (c.hready === 0 && c.htrans !== "IDLE" && next) {
          const ok = next.htrans === c.htrans && next.haddr === c.haddr && sameCtrl(next, c);
          add(k, k + 1, ok, ok ? `Edge ${k + 1} still shows ${c.htrans} ${hex(c.haddr ?? 0)}.` : `HTRANS ${c.htrans} → ${next.htrans}${next.haddr !== c.haddr ? " with a new HADDR" : ""} at edge ${k + 1}. The old check calls that a violation.`);
        }
        break;
      case "hold-in-wait":
        if (c.hready === 0 && isXfer(c.htrans) && next) {
          const held = next.htrans === c.htrans && next.haddr === c.haddr && sameCtrl(next, c);
          const cancel = c.hresp === "ERROR" && next.htrans === "IDLE";
          const ok = held || cancel;
          add(k, k + 1, ok, held ? `${c.htrans} ${hex(c.haddr ?? 0)} is held.` : cancel ? `Cancel after ERROR: IDLE is allowed (§3.5.2, §3.6.2).` : `${c.htrans} changed to ${next.htrans} while waited, with no ERROR to justify it.`);
        }
        break;
      case "busy-in-wait":
        if (c.hready === 0 && c.htrans === "BUSY" && next) {
          const cont = (next.htrans === "BUSY" || next.htrans === "SEQ") && next.haddr === c.haddr;
          const incrEnd = c.hburst === "INCR" && (next.htrans === "IDLE" || next.htrans === "NONSEQ");
          const cancel = c.hresp === "ERROR" && next.htrans === "IDLE";
          const ok = cont || incrEnd || cancel;
          add(k, k + 1, ok, cont ? `BUSY → ${next.htrans} at the same address is allowed (§3.6.1).` : incrEnd ? "An undefined-length INCR may end here (§3.6.1)." : cancel ? "Cancel after ERROR (§3.5.2)." : `BUSY → ${next.htrans} is not allowed for ${c.hburst}.`);
        }
        break;
      case "incr-1kb-naive":
        if (c.htrans === "NONSEQ" && c.hburst !== null && c.hburst !== "SINGLE") {
          const total = c.hburst === "INCR" ? 0 : beatCount(c.hburst) * sizeBytes(c.hsize ?? 0);
          const low10 = (c.haddr ?? 0) % 1024;
          const ok = low10 + total <= 0x400;
          add(k, k, ok, ok ? `${hex(low10)} + ${total} bytes stays within 0x400.` : `${hex(low10)} + ${total} bytes > 0x400, so the old check fires${isWrapBurst(c.hburst) ? ", although a WRAP burst never leaves its own wrap boundary" : ""}.`);
        }
        break;
      case "incr-1kb-per-beat":
        if (c.hready === 1 && c.htrans === "SEQ" && c.hburst !== null && !isWrapBurst(c.hburst)) {
          const p = pastGated(cs, k, (x) => x.hready === 1 && isXfer(x.htrans));
          const ok = p !== null && p.haddr !== null && Math.floor((c.haddr ?? 0) / 1024) === Math.floor(p.haddr / 1024);
          add(k, k, ok, ok ? `${hex(c.haddr ?? 0)} is in the same 1KB region as the previous beat.` : `${hex(c.haddr ?? 0)} is in a different 1KB region from the previous beat ${p?.haddr !== null && p?.haddr !== undefined ? hex(p.haddr) : ""}.`);
        }
        break;
    }
  }
  return { id, attempts, failures: attempts.filter((a) => !a.pass), vacuous: attempts.length === 0 };
}

// ---------------------------------------------------------------------------
// Waveform rows (shared by the WaveDrom export and CycleWaveform)
// ---------------------------------------------------------------------------

export type WaveRow = "HCLK" | "HTRANS" | "HADDR" | "HBURST" | "HWRITE" | "HREADY" | "HRESP" | "HWDATA" | "HRDATA";

export interface RowCell {
  /** Text for buses, 0/1 for bits, null for don't-care / not valid (drawn as X). */
  value: string | 0 | 1 | null;
  /** Identity of the value: a new key draws a new bus segment even if the text repeats. */
  key: string;
}

export interface RowOptions {
  /** HADDR as the beat label ("A") or as hex ("0x40"). Default hex. */
  addr?: "label" | "hex";
  /** Prefix for data bus text, e.g. "Data ". Default "". */
  dataPrefix?: string;
}

export function rowCells(trace: AhbTrace, row: WaveRow, opts: RowOptions = {}): RowCell[] {
  const pre = opts.dataPrefix ?? "";
  return trace.cycles.map((c) => {
    switch (row) {
      case "HCLK":
        return { value: null, key: "clk" };
      case "HTRANS":
        return { value: c.htrans, key: `${c.htrans}:${c.addrBeat ?? "-"}` };
      case "HADDR":
        if (c.haddr === null) return { value: null, key: "x" };
        return { value: opts.addr === "label" ? (c.addrBeat as string) : hex(c.haddr), key: `${c.haddr}:${c.htrans === "BUSY" ? "busy" : c.addrBeat}` };
      case "HBURST":
        return c.hburst === null ? { value: null, key: "x" } : { value: c.hburst, key: c.hburst };
      case "HWRITE":
        return c.hwrite === null ? { value: null, key: "x" } : { value: c.hwrite ? 1 : 0, key: String(c.hwrite) };
      case "HREADY":
        return { value: c.hready, key: String(c.hready) };
      case "HRESP":
        return { value: c.hresp, key: c.hresp === "OKAY" ? "OKAY" : `ERROR:${c.cycle}` };
      case "HWDATA":
        return c.hwdata === null ? { value: null, key: "x" } : { value: `${pre}${c.hwdata}`, key: c.hwdata };
      case "HRDATA":
        return c.hrdata === null ? { value: null, key: "x" } : { value: `${pre}${c.hrdata}`, key: c.hrdata };
    }
  });
}

export interface WaveDromSignalSpec {
  name: string;
  wave: string;
  data?: string[];
}

const BIT_ROWS: WaveRow[] = ["HREADY", "HWRITE"];

/**
 * WaveDrom source for a trace. WaveDrom slot j is cycle j; its value is
 * sampled at the next rising edge, which matches "cycle k ends at edge k".
 */
export function toWaveDrom(trace: AhbTrace, rows: WaveRow[], opts: RowOptions = {}): { signal: WaveDromSignalSpec[] } {
  const n = trace.cycles.length;
  return {
    signal: rows.map((row) => {
      if (row === "HCLK") return { name: "HCLK", wave: `p${".".repeat(Math.max(0, n - 1))}` };
      const cells = rowCells(trace, row, opts);
      let wave = "";
      const data: string[] = [];
      cells.forEach((cell, i) => {
        const prev = i > 0 ? cells[i - 1] : null;
        if (cell.value === null) {
          wave += prev && prev.value === null ? "." : "x";
        } else if (BIT_ROWS.includes(row)) {
          wave += prev && prev.value === cell.value ? "." : String(cell.value);
        } else if (prev && prev.key === cell.key && prev.value !== null) {
          wave += ".";
        } else {
          wave += "=";
          data.push(String(cell.value));
        }
      });
      return data.length > 0 ? { name: row, wave, data } : { name: row, wave };
    }),
  };
}

// ---------------------------------------------------------------------------
// Lesson presets, experiment controls and predictions
// ---------------------------------------------------------------------------

export type AhbPresetId = "pipeline" | "wait" | "read" | "busy" | "wrap" | "error" | "bug";

export interface AhbConfig {
  /** Wait states on the first transfer (pipeline, wait, read). */
  waitsA: number;
  /** Wait states on the second transfer (pipeline, wait). */
  waitsB: number;
  /** BUSY cycles before beat A1 (busy). */
  busyCycles: number;
  /** Wait states on beat A0 (busy). */
  waitsA0: number;
  /** Wait states on beat A2 (busy). */
  waitsA2: number;
  wrapBurst: "WRAP4" | "INCR4";
  wrapStart: number;
  errorPolicy: ErrorPolicy;
  /** OKAY wait states before the ERROR (error, bug). */
  errorWaits: number;
  /** Error preset: A is an INCR4 that errors on A1 instead of a single transfer. */
  errorInBurst: boolean;
  slaveStyle: ErrorStyle;
}

export type AhbControlId =
  | "waitsA"
  | "waitsB"
  | "busyCycles"
  | "waitsA0"
  | "waitsA2"
  | "wrapBurst"
  | "wrapStart"
  | "errorPolicy"
  | "errorWaits"
  | "errorInBurst"
  | "slaveStyle";

export interface AhbPreset {
  id: AhbPresetId;
  title: string;
  summary: string;
  defaults: AhbConfig;
  controls: AhbControlId[];
  rows: WaveRow[];
  properties: AhbPropertyId[];
  build: (config: AhbConfig) => AhbScenario;
}

const BASE_CONFIG: AhbConfig = {
  waitsA: 0,
  waitsB: 0,
  busyCycles: 1,
  waitsA0: 0,
  waitsA2: 1,
  wrapBurst: "WRAP4",
  wrapStart: 0x34,
  errorPolicy: "cancel",
  errorWaits: 1,
  errorInBurst: false,
  slaveStyle: "two-cycle",
};

export const WRAP_START_OPTIONS = [0x30, 0x34, 0x38, 0x3c, 0x3f8];

const twoWrites = (c: AhbConfig): AhbScenario => ({
  bursts: [
    { id: "A", write: true, burst: "SINGLE", hsize: 2, start: 0x40, idleBefore: 1 },
    { id: "B", write: true, burst: "SINGLE", hsize: 2, start: 0x80 },
  ],
  slave: { A: { waits: c.waitsA, resp: "OKAY" }, B: { waits: c.waitsB, resp: "OKAY" } },
});

const errorScenario = (c: AhbConfig, style: ErrorStyle): AhbScenario => {
  const failing = c.errorInBurst ? "A1" : "A";
  return {
    bursts: [
      c.errorInBurst
        ? { id: "A", write: true, burst: "INCR4", hsize: 2, start: 0x40, idleBefore: 1 }
        : { id: "A", write: true, burst: "SINGLE", hsize: 2, start: 0x40, idleBefore: 1 },
      { id: "B", write: true, burst: "SINGLE", hsize: 2, start: 0x80 },
    ],
    slave: { [failing]: { waits: c.errorWaits, resp: "ERROR" } },
    onError: c.errorPolicy,
    errorStyle: style,
  };
};

export const AHB_PRESETS: AhbPreset[] = [
  {
    id: "pipeline",
    title: "Pipelined writes",
    summary: "Two single writes back to back. B's address phase overlaps A's data phase.",
    defaults: { ...BASE_CONFIG },
    controls: ["waitsA", "waitsB"],
    rows: ["HCLK", "HTRANS", "HADDR", "HREADY", "HWDATA"],
    properties: ["hold-in-wait", "hold-naive"],
    build: twoWrites,
  },
  {
    id: "wait",
    title: "Wait state",
    summary: "The slave holds HREADY low for one cycle of A's data phase. Watch what happens to B.",
    defaults: { ...BASE_CONFIG, waitsA: 1 },
    controls: ["waitsA", "waitsB"],
    rows: ["HCLK", "HTRANS", "HADDR", "HREADY", "HWDATA"],
    properties: ["hold-in-wait", "hold-naive"],
    build: twoWrites,
  },
  {
    id: "read",
    title: "Read with waits",
    summary: "Read A takes two wait states (spec Figure 3-3). When is HRDATA valid?",
    defaults: { ...BASE_CONFIG, waitsA: 2 },
    controls: ["waitsA"],
    rows: ["HCLK", "HTRANS", "HADDR", "HWRITE", "HREADY", "HRDATA"],
    properties: ["hold-in-wait", "hold-naive"],
    build: (c) => ({
      bursts: [
        { id: "A", write: false, burst: "SINGLE", hsize: 2, start: 0x40, idleBefore: 1 },
        { id: "B", write: false, burst: "SINGLE", hsize: 2, start: 0x44 },
      ],
      slave: { A: { waits: c.waitsA, resp: "OKAY" } },
    }),
  },
  {
    id: "busy",
    title: "BUSY in a burst",
    summary: "An INCR4 read with a BUSY cycle and a waited beat (spec Figure 3-6). Add waits on A0 to see BUSY change to SEQ during a wait.",
    defaults: { ...BASE_CONFIG },
    controls: ["busyCycles", "waitsA0", "waitsA2"],
    rows: ["HCLK", "HTRANS", "HADDR", "HBURST", "HREADY", "HRDATA"],
    properties: ["hold-in-wait", "busy-in-wait", "hold-naive"],
    build: (c) => ({
      bursts: [{ id: "A", write: false, burst: "INCR4", hsize: 2, start: 0x20, idleBefore: 1, busyBefore: { 1: c.busyCycles } }],
      slave: { A0: { waits: c.waitsA0, resp: "OKAY" }, A2: { waits: c.waitsA2, resp: "OKAY" } },
    }),
  },
  {
    id: "wrap",
    title: "WRAP vs INCR",
    summary: "A 4-beat word burst with a wait on the first beat (spec Figure 3-8). Change the type and start address; try 0x3F8.",
    defaults: { ...BASE_CONFIG },
    controls: ["wrapBurst", "wrapStart"],
    rows: ["HCLK", "HTRANS", "HADDR", "HBURST", "HREADY", "HWDATA"],
    properties: ["incr-1kb-per-beat", "incr-1kb-naive"],
    build: (c) => ({
      bursts: [{ id: "A", write: true, burst: c.wrapBurst, hsize: 2, start: c.wrapStart, idleBefore: 1 }],
      slave: { A0: { waits: 1, resp: "OKAY" } },
    }),
  },
  {
    id: "error",
    title: "Two-cycle ERROR",
    summary: "The slave answers A with ERROR after one OKAY wait state (spec Figure 5-1). B is already on the address bus.",
    defaults: { ...BASE_CONFIG },
    controls: ["errorPolicy", "errorWaits", "errorInBurst"],
    rows: ["HCLK", "HTRANS", "HADDR", "HREADY", "HRESP", "HWDATA"],
    properties: ["error-second-needs-first", "error-first-then-second", "hold-in-wait", "hold-naive"],
    build: (c) => errorScenario(c, "two-cycle"),
  },
  {
    id: "bug",
    title: "Debug: one-cycle ERROR",
    summary: "A broken slave drives ERROR for one cycle with HREADY high. Which assertion notices?",
    defaults: { ...BASE_CONFIG, slaveStyle: "one-cycle-bug" },
    controls: ["slaveStyle"],
    rows: ["HCLK", "HTRANS", "HADDR", "HREADY", "HRESP", "HWDATA"],
    properties: ["error-second-needs-first", "error-first-then-second"],
    build: (c) => errorScenario(c, c.slaveStyle),
  },
];

export function getPreset(id: AhbPresetId): AhbPreset {
  return AHB_PRESETS.find((p) => p.id === id) ?? AHB_PRESETS[0];
}

export interface PredictionChoice {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

export interface AhbPrediction {
  question: string;
  options: PredictionChoice[];
}

function beatRecord(trace: AhbTrace, label: string): BeatRecord {
  return trace.beats.find((b) => b.label === label) as BeatRecord;
}

/** "At which edge is X's data sampled?" with options built from the beat's own timeline. */
function dataEdgeQuestion(trace: AhbTrace, label: string, question: string): AhbPrediction {
  const rec = beatRecord(trace, label);
  const ce = rec.completeEdge ?? 0;
  const ae = rec.acceptEdge ?? 0;
  const fa = rec.firstAddrCycle ?? 0;
  const busyEdges = trace.cycles.filter((c) => c.dataPhase === "busy" && c.cycle > ae - 3 && c.cycle < ce).map((c) => c.cycle);
  const dir = rec.write ? "the slave samples HWDATA" : "the master samples HRDATA";
  const candidates = [ce, fa + 1, ce + 1, ae, ...busyEdges, ce - 1].filter((e) => e >= 0);
  const unique = Array.from(new Set(candidates)).slice(0, 4).sort((a, b) => a - b);
  const feedbackFor = (e: number): string => {
    if (e === ce) {
      return `${label} is accepted at edge ${ae}; its data phase runs from cycle ${ae + 1} and ${dir} at edge ${ce}, the first edge of that data phase with HREADY high (§3.1${rec.write ? ", §6.1.1" : ", §6.1.2"}).`;
    }
    if (busyEdges.includes(e)) {
      return `Edge ${e} ends the data phase of a BUSY cycle. The slave gives BUSY a zero-wait OKAY and the master ignores HRDATA there (§3.2, Figure 3-6). ${label}'s data comes at edge ${ce}.`;
    }
    if (e === fa + 1 && fa + 1 <= ae) {
      return `That would hold with no wait states. ${label}'s address phase started in cycle ${fa} but was extended until edge ${ae} (§3.1), so its data is sampled at edge ${ce}.`;
    }
    if (e === ae) return `Edge ${ae} accepts ${label}'s address phase. Its data phase only starts in the next cycle, so the data is sampled at edge ${ce}.`;
    if (e < ae) return `At edge ${e}, ${label} is still in its address phase; data moves only in the data phase that follows acceptance at edge ${ae}.`;
    if (e < ce) return `At edge ${e}, ${label} is in its data phase but HREADY is low, so nothing is sampled (§3.1). The data is sampled at edge ${ce}.`;
    return `Too late: ${label}'s data was already sampled at edge ${ce}, the first edge of its data phase with HREADY high.`;
  };
  return {
    question,
    options: unique.map((e) => ({ id: `edge-${e}`, label: `Edge ${e}`, correct: e === ce, feedback: feedbackFor(e) })),
  };
}

/** Builds the prediction for a preset from the model, so the answer always matches the run. */
export function buildPrediction(presetId: AhbPresetId, config: AhbConfig, trace: AhbTrace): AhbPrediction {
  switch (presetId) {
    case "pipeline":
    case "wait":
      return dataEdgeQuestion(trace, "B", `A has ${config.waitsA} wait state${config.waitsA === 1 ? "" : "s"} and B has ${config.waitsB}. At which edge does the slave sample B's write data?`);
    case "read":
      return dataEdgeQuestion(trace, "A", `Read A gets ${config.waitsA} wait state${config.waitsA === 1 ? "" : "s"}. At which edge does the master sample A's read data?`);
    case "busy":
      return dataEdgeQuestion(trace, "A1", `The master inserts ${config.busyCycles} BUSY cycle${config.busyCycles === 1 ? "" : "s"} before beat A1 (0x24). At which edge does the master sample A1's read data?`);
    case "wrap": {
      const addrs = burstAddresses(config.wrapStart, config.wrapBurst, 2);
      const other: "WRAP4" | "INCR4" = config.wrapBurst === "WRAP4" ? "INCR4" : "WRAP4";
      const otherAddrs = burstAddresses(config.wrapStart, other, 2);
      const last = addrs[3];
      const check = checkBurst(config.wrapStart, config.wrapBurst, 2);
      const wrapBase = Math.floor(config.wrapStart / 16) * 16;
      const candidates = Array.from(new Set([last, otherAddrs[3], config.wrapStart, wrapBase, last + 4])).slice(0, 4).sort((a, b) => a - b);
      const legality = check.legal ? "" : ` It is also illegal: ${check.issues.map((i) => i.text).join(" ")}`;
      const feedbackFor = (a: number): string => {
        if (a === last) {
          return config.wrapBurst === "WRAP4"
            ? `WRAP4 of words wraps at 4 × 4 = 16 bytes, so the beats are ${addrs.map(hex).join(", ")} (§3.5).`
            : `INCR4 adds the size each beat and never wraps: ${addrs.map(hex).join(", ")} (§3.2 Table 3-1, SEQ).${legality}`;
        }
        if (a === otherAddrs[3]) {
          return config.wrapBurst === "WRAP4"
            ? `That is the INCR4 sequence. A wrapping burst wraps at beats × size bytes (§3.5), here 16.`
            : `That wraps, but only WRAP bursts wrap; INCR4 keeps adding 4 bytes.`;
        }
        if (a === config.wrapStart) return "That is where the burst starts. It never comes back to its start address: each beat moves on by the transfer size.";
        const i = addrs.indexOf(a);
        if (i >= 0) return `That is beat A${i}, not the last beat. The beats are ${addrs.map(hex).join(", ")}.`;
        return `Not a beat of this burst. The beats are ${addrs.map(hex).join(", ")}.`;
      };
      return {
        question: `${config.wrapBurst} of words from ${hex(config.wrapStart)}. Which address does the last beat (A3) use?`,
        options: candidates.map((a) => ({ id: `addr-${a}`, label: hex(a), correct: a === last, feedback: feedbackFor(a) })),
      };
    }
    case "error": {
      const e2 = trace.cycles.find((c) => c.dataPhase === "error2");
      const e1 = trace.cycles.find((c) => c.dataPhase === "error1");
      const n = e2?.cycle ?? 0;
      const pendingLabel = e1?.addrBeat ?? "B";
      const pendingTrans = e1?.htrans ?? "NONSEQ";
      const answer = e2?.htrans === "IDLE" ? "idle" : "held";
      const cancel = config.errorPolicy === "cancel";
      const opts: PredictionChoice[] = [
        {
          id: "idle",
          label: "IDLE",
          correct: answer === "idle",
          feedback: cancel
            ? `The master saw ERROR with HREADY low at edge ${n - 1}, so it can still cancel: it drives IDLE in the second ERROR cycle and ${pendingLabel} is never accepted (§3.5.2, §5.1.3).`
            : `This master continues after the ERROR, which §3.5.2 allows. IDLE here would cancel ${pendingLabel}; continuing keeps it on the bus.`,
        },
        {
          id: "held",
          label: `${pendingTrans} ${pendingLabel}, unchanged`,
          correct: answer === "held",
          feedback: cancel
            ? `This master cancels. Leaving ${pendingTrans} ${pendingLabel} on the bus would let the slave accept it at edge ${n}, where HREADY is high.`
            : `A continuing master keeps ${pendingLabel} stable until HREADY is high; it is accepted at edge ${n} (§3.6).`,
        },
        {
          id: "busy",
          label: "BUSY",
          correct: false,
          feedback: "BUSY only pauses a burst between beats. It cancels nothing, and the burst would still continue (§3.2).",
        },
        {
          id: "new",
          label: "NONSEQ to a new address",
          correct: false,
          feedback: "A master that cancels must show IDLE during the two-cycle ERROR response (§3.5.2). It can start a new burst after that.",
        },
      ];
      return { question: `The slave errors on ${e1?.dataBeat ?? "A"}. What does the master drive on HTRANS in cycle ${n}, the second ERROR cycle?`, options: opts };
    }
    case "bug": {
      const naive = evaluateAhbProperty("error-first-then-second", trace);
      const fixed = evaluateAhbProperty("error-second-needs-first", trace);
      const nf = naive.failures.length > 0;
      const ff = fixed.failures.length > 0;
      const answer = nf && ff ? "both" : nf ? "naive" : ff ? "fixed" : "neither";
      const errEdge = trace.cycles.find((c) => c.hresp === "ERROR" && c.hready === 1)?.cycle ?? 0;
      const naiveNote = naive.vacuous
        ? "p_error_first_then_second needs HRESP high with HREADY low to start. A one-cycle ERROR never has HREADY low, so the property never starts an attempt and passes vacuously."
        : "p_error_first_then_second starts at the first ERROR cycle and sees the second one, so it passes.";
      const fixedNote = ff
        ? `p_error_second_needs_first fails at edge ${errEdge}: HRESP and HREADY are high, but edge ${errEdge - 1} had no ERROR with HREADY low (§5.1.3).`
        : `p_error_second_needs_first passes: edge ${errEdge - 1} was the first ERROR cycle.`;
      return {
        question: "Which assertion fails on this trace?",
        options: [
          {
            id: "naive",
            label: "Only p_error_first_then_second (the lesson's original check)",
            correct: answer === "naive",
            feedback: answer === "naive" ? `${naiveNote} ${fixedNote}` : `The original check is the one that stays silent. ${naiveNote} ${fixedNote}`,
          },
          { id: "fixed", label: "Only p_error_second_needs_first", correct: answer === "fixed", feedback: `${fixedNote} ${naiveNote}` },
          {
            id: "both",
            label: "Both of them",
            correct: answer === "both",
            feedback: answer === "both" ? `${naiveNote} ${fixedNote}` : `At most one of them can fire here. ${naiveNote} ${fixedNote}`,
          },
          {
            id: "neither",
            label: "Neither",
            correct: answer === "neither",
            feedback: answer === "neither" ? `This slave is legal: ${fixedNote} ${naiveNote}` : `A one-cycle ERROR breaks §5.1.3, and ${fixedNote}`,
          },
        ],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Lesson figures (static WaveDrom diagrams generated from the model)
// ---------------------------------------------------------------------------

export type LessonFigureId = "ahb1-pipeline" | "ahb1-wait-state" | "ahb2-two-cycle-error";

const LESSON_FIGURES: Record<LessonFigureId, { preset: AhbPresetId; rows: WaveRow[] }> = {
  "ahb1-pipeline": { preset: "pipeline", rows: ["HCLK", "HTRANS", "HADDR", "HWDATA", "HREADY"] },
  "ahb1-wait-state": { preset: "wait", rows: ["HCLK", "HTRANS", "HADDR", "HWDATA", "HREADY"] },
  "ahb2-two-cycle-error": { preset: "error", rows: ["HCLK", "HTRANS", "HADDR", "HWDATA", "HREADY", "HRESP"] },
};

/**
 * WaveDrom spec for a figure embedded in a lesson. The lesson MDX holds a
 * copy; a test fails if the copy drifts from this output.
 */
export function lessonFigure(id: LessonFigureId): { signal: WaveDromSignalSpec[] } {
  const fig = LESSON_FIGURES[id];
  const preset = getPreset(fig.preset);
  return toWaveDrom(simulateAhb(preset.build(preset.defaults)), fig.rows, { addr: "label", dataPrefix: "Data " });
}
