/**
 * AXI exclusive access model (Arm IHI 0022E, A7.2).
 *
 * - A7.2.1/A7.2.3: the monitor records the address and ARID of an exclusive
 *   read and watches that location until a write to it, or another exclusive
 *   read with the same ARID. An exclusive write succeeds (EXOKAY, memory
 *   updated) only if the location is still monitored for that AWID; otherwise
 *   OKAY and memory is not updated.
 * - A7.2.2: a slave without exclusive support answers an exclusive read with
 *   OKAY, meaning "not supported".
 * - A7.2.5: an exclusive write to a slave without exclusive support always
 *   updates memory and returns OKAY.
 * - A7.2.3 recommends one monitor per exclusive-capable ID. A single shared
 *   monitor is an implementation choice this model offers for comparison.
 * - A7.2.4 restrictions; breaking them is UNPREDICTABLE.
 *
 * Transaction-level, sequential (each operation completes before the next).
 * Pure, no React.
 */

export type ExclusiveOpKind = "ex-read" | "ex-write" | "write" | "read";
export type MonitorPolicy = "per-id" | "single" | "unsupported";
export type AxiResp = "OKAY" | "EXOKAY";

export interface ExclusiveOp {
  kind: ExclusiveOpKind;
  /** Transaction ID as seen at the slave (the interconnect makes it unique per master). */
  id: number;
  /** Who issued it, for display. */
  master: string;
  addr: number;
  /** AxSIZE as bytes per transfer. */
  bytesPerBeat: number;
  /** Burst length (AxLEN + 1). */
  beats: number;
  /** Value written, for writes. */
  data?: number;
}

export interface MonitorEntry {
  id: number;
  addr: number;
  bytes: number;
}

export interface ExclusiveStep {
  op: ExclusiveOp;
  resp: AxiResp | "UNPREDICTABLE";
  memoryUpdated: boolean;
  memoryAfter: Record<string, number>;
  monitorAfter: MonitorEntry[];
  /** One-sentence cause, with the clause. */
  why: string;
  restrictionErrors: string[];
}

export interface ExclusiveRun {
  steps: ExclusiveStep[];
  policy: MonitorPolicy;
}

const key = (addr: number) => `0x${addr.toString(16).toUpperCase()}`;
const overlaps = (a: number, aBytes: number, b: number, bBytes: number) => a < b + bBytes && b < a + aBytes;

/** A7.2.4 checks for a single exclusive access, plus read/write pairing. */
export function exclusiveRestrictionErrors(op: ExclusiveOp, pairedRead?: ExclusiveOp): string[] {
  const errors: string[] = [];
  const total = op.bytesPerBeat * op.beats;
  if ((total & (total - 1)) !== 0) errors.push(`${total} bytes is not a power of 2 (A7.2.4).`);
  if (total > 128) errors.push(`${total} bytes exceeds the 128-byte maximum (A7.2.4).`);
  if (op.beats > 16) errors.push(`AXI4 exclusive bursts are limited to 16 transfers; this one has ${op.beats} (A7.2.4).`);
  if (op.addr % total !== 0) errors.push(`Address ${key(op.addr)} is not aligned to the ${total}-byte total (A7.2.4).`);
  if (op.kind === "ex-write" && pairedRead) {
    if (pairedRead.addr !== op.addr) errors.push(`The exclusive write address ${key(op.addr)} differs from the exclusive read address ${key(pairedRead.addr)} (A7.2.4).`);
    if (pairedRead.bytesPerBeat !== op.bytesPerBeat || pairedRead.beats !== op.beats) errors.push("Burst size and length must match the preceding exclusive read with the same ID (A7.2.4).");
  }
  return errors;
}

export function runExclusive(ops: ExclusiveOp[], policy: MonitorPolicy, initialMemory: Record<string, number> = {}): ExclusiveRun {
  let monitors: MonitorEntry[] = [];
  const memory: Record<string, number> = { ...initialMemory };
  const lastExRead = new Map<number, ExclusiveOp>();
  const steps: ExclusiveStep[] = [];

  const clearWrittenLocation = (op: ExclusiveOp) => {
    monitors = monitors.filter((m) => !overlaps(m.addr, m.bytes, op.addr, op.bytesPerBeat * op.beats));
  };

  for (const op of ops) {
    const exclusive = op.kind === "ex-read" || op.kind === "ex-write";
    const restrictionErrors = exclusive ? exclusiveRestrictionErrors(op, op.kind === "ex-write" ? lastExRead.get(op.id) : undefined) : [];
    let resp: ExclusiveStep["resp"] = "OKAY";
    let memoryUpdated = false;
    let why = "";

    if (restrictionErrors.length > 0 && policy !== "unsupported") {
      resp = "UNPREDICTABLE";
      why = `This exclusive access breaks A7.2.4 (${restrictionErrors[0]}). The result is UNPREDICTABLE, so a protocol checker must flag it.`;
    } else if (op.kind === "read") {
      why = "A normal read does not change any monitor.";
    } else if (op.kind === "write") {
      memory[key(op.addr)] = op.data ?? 0;
      memoryUpdated = true;
      const before = monitors.length;
      clearWrittenLocation(op);
      why =
        before !== monitors.length
          ? `A write to a monitored location ends that monitoring, so any exclusive write waiting on ${key(op.addr)} will now fail (A7.2.3).`
          : "A normal write. No monitor was watching this location.";
    } else if (op.kind === "ex-read") {
      lastExRead.set(op.id, op);
      if (policy === "unsupported") {
        resp = "OKAY";
        why = "This slave has no exclusive monitor, so it answers the exclusive read with OKAY. The master should treat OKAY as 'exclusive access not supported' and not attempt the write (A7.2.2).";
      } else {
        resp = "EXOKAY";
        const entry = { id: op.id, addr: op.addr, bytes: op.bytesPerBeat * op.beats };
        if (policy === "per-id") {
          monitors = [...monitors.filter((m) => m.id !== op.id), entry];
          why = `EXOKAY: the monitor for ID ${op.id} now watches ${key(op.addr)}. A later exclusive read with the same ID would move it (A7.2.3).`;
        } else {
          const evicted = monitors.find((m) => m.id !== op.id);
          monitors = [entry];
          why = evicted
            ? `EXOKAY, but the single shared monitor now belongs to ID ${op.id}; ID ${evicted.id}'s reservation is lost although nobody wrote ${key(evicted.addr)}. A7.2.3 recommends one monitor per ID to avoid this.`
            : `EXOKAY: the single shared monitor watches ${key(op.addr)} for ID ${op.id}.`;
        }
      }
    } else {
      // ex-write
      if (policy === "unsupported") {
        memory[key(op.addr)] = op.data ?? 0;
        memoryUpdated = true;
        resp = "OKAY";
        why = "A slave without exclusive support always performs the write and returns OKAY (A7.2.5).";
      } else {
        const match = monitors.find((m) => m.id === op.id && m.addr === op.addr);
        if (match) {
          memory[key(op.addr)] = op.data ?? 0;
          memoryUpdated = true;
          resp = "EXOKAY";
          clearWrittenLocation(op);
          why = `EXOKAY: ${key(op.addr)} is still monitored for ID ${op.id}, so nothing wrote it since the exclusive read. Memory is updated, and the write ends every other monitor on this location (A7.2.3).`;
        } else {
          resp = "OKAY";
          why = `OKAY, write not performed: ${key(op.addr)} is no longer monitored for ID ${op.id}. Either the location was written, or the monitor moved. The master must retry the whole read-modify-write (A7.2.2, A7.2.3).`;
        }
        lastExRead.delete(op.id);
      }
    }

    steps.push({ op, resp, memoryUpdated, memoryAfter: { ...memory }, monitorAfter: monitors.map((m) => ({ ...m })), why, restrictionErrors });
  }
  return { steps, policy };
}

// ---------------------------------------------------------------------------
// Presets used by ExclusiveAccessVisualizer
// ---------------------------------------------------------------------------

export interface ExclusivePreset {
  id: string;
  title: string;
  summary: string;
  ops: ExclusiveOp[];
  /** Index of the step the learner predicts. */
  questionStep: number;
  question: string;
  /** Policies where the preset is meaningful; the first is the default. */
  policies: MonitorPolicy[];
}

const M0 = 0;
const M1 = 1;
const op = (kind: ExclusiveOpKind, id: number, data?: number, extra: Partial<ExclusiveOp> = {}): ExclusiveOp => ({
  kind,
  id,
  master: id === M0 ? "M0" : "M1",
  addr: 0x1000,
  bytesPerBeat: 4,
  beats: 1,
  data,
  ...extra,
});

export const EXCLUSIVE_PRESETS: ExclusivePreset[] = [
  {
    id: "clean",
    title: "Uncontended",
    summary: "M0 reads the lock word exclusively, then writes it back. Nobody else touches 0x1000.",
    ops: [op("ex-read", M0), op("ex-write", M0, 1)],
    questionStep: 1,
    question: "What does the slave return for M0's exclusive write?",
    policies: ["per-id", "single", "unsupported"],
  },
  {
    id: "intervening-write",
    title: "Intervening normal write",
    summary: "Between M0's exclusive read and write, M1 does a plain write to the same word.",
    ops: [op("ex-read", M0), op("write", M1, 7), op("ex-write", M0, 1)],
    questionStep: 2,
    question: "What does the slave return for M0's exclusive write?",
    policies: ["per-id", "single"],
  },
  {
    id: "race",
    title: "Two masters race",
    summary: "Both masters read the lock exclusively. M0 writes first, then M1.",
    ops: [op("ex-read", M0), op("ex-read", M1), op("ex-write", M0, 1), op("ex-write", M1, 2)],
    questionStep: 2,
    question: "What does the slave return for M0's exclusive write (the first of the two)?",
    policies: ["per-id", "single"],
  },
  {
    id: "restriction",
    title: "Debug: bad exclusive",
    summary: "M0 issues an exclusive read of 3 beats x 4 bytes at 0x1004.",
    ops: [op("ex-read", M0, undefined, { addr: 0x1004, beats: 3 })],
    questionStep: 0,
    question: "What is the outcome of this exclusive read?",
    policies: ["per-id"],
  },
];
