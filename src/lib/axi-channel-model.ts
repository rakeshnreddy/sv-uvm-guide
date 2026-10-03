/**
 * AXI channel handshake and ordering model.
 *
 * Rules, all verified in Arm IHI 0022E (AXI and ACE, Issue E):
 * - A3.2.1 Handshake process: a transfer occurs at a rising edge where VALID
 *   and READY are both HIGH; a source must not wait for READY before asserting
 *   VALID; once VALID is asserted it stays asserted until the handshake; the
 *   source keeps its information stable until the transfer; a destination may
 *   wait for VALID, and may deassert READY before VALID is asserted.
 * - A3.3: write data can appear before the write address.
 * - A3.3.1 Dependencies: the slave must wait for ARVALID and ARREADY before
 *   asserting RVALID; AXI4 write response dependency: the slave must wait for
 *   AWVALID, AWREADY, WVALID, WREADY (and WLAST) before asserting BVALID.
 * - A5.3.1 Read ordering: same ARID returns in issue order; different ARIDs in
 *   any order and may be interleaved.
 * - A5.3 / A5.3.2 / A5.4: same-AWID writes complete in issue order; AXI4 write
 *   data follows address order with no interleaving.
 * - A5.3.5: the interconnect appends master-port bits to the ID.
 *
 * Time model: edge k is the k-th rising ACLK edge. A value at edge k is the
 * value sampled at that edge (it changed just after edge k-1). Pure, no React.
 */

export type ChannelName = "AW" | "W" | "B" | "AR" | "R";
export const CHANNEL_ORDER: ChannelName[] = ["AW", "W", "B", "AR", "R"];

export const CHANNEL_INFO: Record<ChannelName, { title: string; source: "master" | "slave"; payload: string; last?: string; resp?: string }> = {
  AW: { title: "Write address", source: "master", payload: "AWADDR" },
  W: { title: "Write data", source: "master", payload: "WDATA", last: "WLAST" },
  B: { title: "Write response", source: "slave", payload: "BRESP" },
  AR: { title: "Read address", source: "master", payload: "ARADDR" },
  R: { title: "Read data", source: "slave", payload: "RDATA", last: "RLAST", resp: "RRESP" },
};

export type Bit = 0 | 1;

export interface ChannelItem {
  /** Unique key within its channel. */
  key: string;
  /** Transaction this item belongs to (links B to AW/W and R to AR). */
  txn: string;
  /** Payload value shown on the bus. */
  label: string;
  last?: boolean;
  /** RRESP for R items. */
  resp?: string;
  /** Earliest edge at which the source is able to drive VALID for this item. */
  availableAt: number;
}

export type ReadyPolicy =
  | { kind: "pattern"; bits: number[] }
  | { kind: "always" }
  /** The destination waits for VALID, then asserts READY `delay` edges later (legal, A3.2.1). */
  | { kind: "after-valid"; delay: number };

export interface ChannelPlan {
  items: ChannelItem[];
  ready: ReadyPolicy;
}

export type Fault =
  /** The source drives VALID LOW at `edge` although no handshake happened (illegal). */
  | { kind: "drop-valid"; channel: ChannelName; edge: number }
  /** A legacy AXI3-style slave that waits for WLAST only, not for the AW handshake (illegal in AXI4). */
  | { kind: "b-ignores-aw" };

export interface ChannelScenario {
  edges: number;
  channels: Partial<Record<ChannelName, ChannelPlan>>;
  faults?: Fault[];
}

export interface Handshake {
  channel: ChannelName;
  edge: number;
  item: ChannelItem;
  /** 0-based index of the item in its channel. */
  index: number;
}

export type TraceEventKind = "handshake" | "stall" | "dependency-wait" | "fault";

export interface TraceEvent {
  edge: number;
  channel: ChannelName;
  kind: TraceEventKind;
  text: string;
  clause?: string;
}

export interface ChannelSignals {
  valid: Bit[];
  ready: Bit[];
  payload: (string | undefined)[];
  last?: (Bit | undefined)[];
  resp?: (string | undefined)[];
  /** Index of the item on the bus at each edge (null when VALID is LOW). */
  itemIndex: (number | null)[];
}

export interface ChannelTrace {
  edges: number;
  channels: ChannelName[];
  signals: Partial<Record<ChannelName, ChannelSignals>>;
  handshakes: Handshake[];
  events: TraceEvent[];
  violations: ProtocolViolation[];
}

export type ProtocolRule = "valid-held" | "payload-stable" | "b-after-aw-and-wlast" | "r-after-ar";

export interface ProtocolViolation {
  rule: ProtocolRule;
  clause: string;
  channel: ChannelName;
  edge: number;
  message: string;
}

const readyAt = (policy: ReadyPolicy, edge: number, presentingSince: number | null): Bit => {
  if (policy.kind === "always") return 1;
  if (policy.kind === "pattern") return policy.bits[edge] === 1 ? 1 : 0;
  return presentingSince !== null && edge >= presentingSince + policy.delay ? 1 : 0;
};

function missingDependencies(channel: ChannelName, item: ChannelItem, done: Handshake[], faults: Fault[]): string[] {
  const missing: string[] = [];
  if (channel === "B") {
    const ignoreAw = faults.some((f) => f.kind === "b-ignores-aw");
    if (!ignoreAw && !done.some((h) => h.channel === "AW" && h.item.txn === item.txn)) missing.push("the AW handshake");
    if (!done.some((h) => h.channel === "W" && h.item.txn === item.txn && h.item.last)) missing.push("the WLAST handshake");
  }
  if (channel === "R" && !done.some((h) => h.channel === "AR" && h.item.txn === item.txn)) missing.push("the AR handshake");
  return missing;
}

/** Runs a scenario edge by edge. The sources obey A3.2.1 unless a fault is injected. */
export function simulateChannels(scenario: ChannelScenario): ChannelTrace {
  const faults = scenario.faults ?? [];
  const channels = CHANNEL_ORDER.filter((c) => scenario.channels[c]);
  const signals: Partial<Record<ChannelName, ChannelSignals>> = {};
  const state = new Map<ChannelName, { next: number; since: number | null }>();
  for (const c of channels) {
    signals[c] = { valid: [], ready: [], payload: [], last: [], resp: [], itemIndex: [] };
    state.set(c, { next: 0, since: null });
  }
  const handshakes: Handshake[] = [];
  const events: TraceEvent[] = [];

  for (let edge = 0; edge < scenario.edges; edge += 1) {
    const done = handshakes.slice(); // only handshakes at earlier edges
    const thisEdge: Handshake[] = [];
    for (const c of channels) {
      const plan = scenario.channels[c] as ChannelPlan;
      const s = state.get(c) as { next: number; since: number | null };
      const sig = signals[c] as ChannelSignals;
      const item = plan.items[s.next];
      let valid: Bit = 0;
      const drop = faults.find((f) => f.kind === "drop-valid" && f.channel === c && f.edge === edge);
      if (item) {
        if (s.since !== null) {
          if (drop) {
            s.since = null;
            events.push({
              edge,
              channel: c,
              kind: "fault",
              text: `${c}VALID is driven LOW at edge ${edge} although ${c}READY never accepted ${item.label}.`,
              clause: "IHI0022E A3.2.1",
            });
          } else valid = 1;
        } else if (edge >= item.availableAt) {
          const missing = missingDependencies(c, item, done, faults);
          if (missing.length === 0) {
            valid = 1;
            s.since = edge;
          } else {
            events.push({
              edge,
              channel: c,
              kind: "dependency-wait",
              text: `The slave has ${item.label} ready but must keep ${c}VALID LOW: it is still waiting for ${missing.join(" and ")}.`,
              clause: "IHI0022E A3.3.1",
            });
          }
        }
      }
      const ready = readyAt(plan.ready, edge, valid ? s.since : null);
      sig.valid.push(valid);
      sig.ready.push(ready);
      sig.payload.push(valid && item ? item.label : undefined);
      sig.last?.push(valid && item ? (item.last ? 1 : 0) : undefined);
      sig.resp?.push(valid && item ? item.resp : undefined);
      sig.itemIndex.push(valid && item ? s.next : null);
      if (valid && item) {
        if (ready) {
          const h = { channel: c, edge, item, index: s.next };
          thisEdge.push(h);
          events.push({
            edge,
            channel: c,
            kind: "handshake",
            text: `${c}VALID and ${c}READY are both 1 at edge ${edge}: ${item.label}${item.last ? " (last)" : ""} transfers.`,
            clause: "IHI0022E A3.2.1",
          });
          s.next += 1;
          s.since = null;
        } else {
          events.push({
            edge,
            channel: c,
            kind: "stall",
            text: `${c}READY is 0 at edge ${edge}: the ${CHANNEL_INFO[c].source} must hold ${c}VALID and ${item.label} stable.`,
            clause: "IHI0022E A3.2.1",
          });
        }
      }
    }
    handshakes.push(...thisEdge);
  }

  const trace: ChannelTrace = { edges: scenario.edges, channels, signals, handshakes, events, violations: [] };
  trace.violations = checkChannels(signals, scenario.edges);
  return trace;
}

const countBefore = (bits: Bit[], ready: Bit[], edge: number, extra?: (k: number) => boolean) => {
  let n = 0;
  for (let k = 0; k < edge; k += 1) if (bits[k] === 1 && ready[k] === 1 && (!extra || extra(k))) n += 1;
  return n;
};

/**
 * Protocol checker over sampled signals. It knows nothing about how the trace
 * was produced, so it also checks hand-written or WaveDrom-derived traces.
 */
export function checkChannels(
  signals: Partial<Record<ChannelName, Pick<ChannelSignals, "valid" | "ready"> & Partial<Pick<ChannelSignals, "payload" | "last">>>>,
  edges: number,
): ProtocolViolation[] {
  const out: ProtocolViolation[] = [];
  for (const c of CHANNEL_ORDER) {
    const s = signals[c];
    if (!s) continue;
    for (let k = 0; k + 1 < edges; k += 1) {
      if (s.valid[k] === 1 && s.ready[k] !== 1) {
        if (s.valid[k + 1] !== 1) {
          out.push({
            rule: "valid-held",
            clause: "IHI0022E A3.2.1",
            channel: c,
            edge: k + 1,
            message: `${c}VALID was 1 with ${c}READY 0 at edge ${k}, then fell at edge ${k + 1} without a handshake. "Once VALID is asserted it must remain asserted until the handshake occurs."`,
          });
        } else if (s.payload && s.payload[k + 1] !== s.payload[k]) {
          out.push({
            rule: "payload-stable",
            clause: "IHI0022E A3.2.1",
            channel: c,
            edge: k + 1,
            message: `${CHANNEL_INFO[c].payload} changed from ${s.payload[k] ?? "X"} to ${s.payload[k + 1] ?? "X"} at edge ${k + 1} while the transfer was still waiting for ${c}READY.`,
          });
        }
      }
    }
  }

  const starts = (s: Pick<ChannelSignals, "valid" | "ready">, k: number) =>
    s.valid[k] === 1 && (k === 0 || s.valid[k - 1] !== 1 || s.ready[k - 1] === 1);

  const b = signals.B;
  const aw = signals.AW;
  const w = signals.W;
  if (b && aw && w) {
    for (let k = 0; k < edges; k += 1) {
      if (!starts(b, k)) continue;
      const nth = countBefore(b.valid, b.ready, k) + 1;
      const awDone = countBefore(aw.valid, aw.ready, k);
      const wlastDone = countBefore(w.valid, w.ready, k, (j) => (w.last ? w.last[j] === 1 : true));
      if (Math.min(awDone, wlastDone) < nth) {
        const missing = [awDone < nth ? "an AW handshake" : null, wlastDone < nth ? "a WLAST handshake" : null].filter(Boolean).join(" and ");
        out.push({
          rule: "b-after-aw-and-wlast",
          clause: "IHI0022E A3.3.1 (AXI4 write response dependency)",
          channel: "B",
          edge: k,
          message: `BVALID rises at edge ${k} for response ${nth}, but there was no earlier ${missing} for it. In AXI4 the slave must wait for AWVALID, AWREADY, WVALID, WREADY and WLAST before asserting BVALID.`,
        });
      }
    }
  }
  const r = signals.R;
  const ar = signals.AR;
  if (r && ar) {
    for (let k = 0; k < edges; k += 1) {
      if (!starts(r, k)) continue;
      const arDone = countBefore(ar.valid, ar.ready, k);
      const rlastDone = countBefore(r.valid, r.ready, k, (j) => (r.last ? r.last[j] === 1 : true));
      if (arDone <= rlastDone) {
        out.push({
          rule: "r-after-ar",
          clause: "IHI0022E A3.3.1",
          channel: "R",
          edge: k,
          message: `RVALID rises at edge ${k} but no read address is outstanding. The slave must wait for ARVALID and ARREADY before asserting RVALID.`,
        });
      }
    }
  }
  return out.sort((a, b2) => a.edge - b2.edge);
}

// ---------------------------------------------------------------------------
// Prediction support: model-derived answers and per-choice feedback
// ---------------------------------------------------------------------------

export type EdgeQuestion =
  | { kind: "handshake"; channel: ChannelName; itemIndex: number }
  | { kind: "first-valid"; channel: ChannelName; itemIndex: number };

export function answerEdge(trace: ChannelTrace, q: EdgeQuestion): number | null {
  const sig = trace.signals[q.channel];
  if (!sig) return null;
  if (q.kind === "handshake") return trace.handshakes.find((h) => h.channel === q.channel && h.index === q.itemIndex)?.edge ?? null;
  const k = sig.itemIndex.findIndex((i) => i === q.itemIndex);
  return k === -1 ? null : k;
}

/** Why an edge is (or is not) the answer, derived from the trace. */
export function explainEdgeChoice(trace: ChannelTrace, q: EdgeQuestion, edge: number): { correct: boolean; feedback: string } {
  const c = q.channel;
  const sig = trace.signals[c] as ChannelSignals;
  const answer = answerEdge(trace, q);
  const v = sig.valid[edge];
  const r = sig.ready[edge];
  if (q.kind === "handshake") {
    if (answer === edge) {
      return { correct: true, feedback: `At edge ${edge} ${c}VALID = 1 and ${c}READY = 1 for the same item, so it transfers there (A3.2.1). Every earlier edge is missing one of the two.` };
    }
    if (answer !== null && edge > answer) {
      return { correct: false, feedback: `The transfer already completed at edge ${answer}, the first edge where both were 1. Nothing about edge ${edge} can undo or repeat it.` };
    }
    if (v && !r) return { correct: false, feedback: `${c}READY is 0 at edge ${edge}. VALID alone transfers nothing: the source has to hold VALID and the payload until READY is also 1.` };
    if (!v && r) return { correct: false, feedback: `${c}READY is 1 at edge ${edge}, but ${c}VALID is 0. A READY with no VALID is just the receiver saying it could accept; nothing moves.` };
    if (v && r) return { correct: false, feedback: `Both are 1 at edge ${edge}, but that handshake moves a different item. Count the transfers.` };
    return { correct: false, feedback: `Both ${c}VALID and ${c}READY are 0 at edge ${edge}.` };
  }
  // first-valid
  if (answer === edge) {
    const deps = c === "B" ? "the AW handshake and the WLAST handshake both happened at earlier edges" : c === "R" ? "the AR handshake happened at an earlier edge" : "the source has the item";
    return { correct: true, feedback: `Edge ${edge} is the first edge after ${deps}, and the slave does not wait for ${c}READY (A3.3.1).` };
  }
  const wait = trace.events.find((e) => e.channel === c && e.edge === edge && e.kind === "dependency-wait");
  if (answer !== null && edge < answer) {
    if (wait) return { correct: false, feedback: `Too early. ${wait.text} (${wait.clause}).` };
    return { correct: false, feedback: `Too early: at edge ${edge} the ${CHANNEL_INFO[c].source} has nothing to send yet on ${c}.` };
  }
  if (answer !== null && edge > answer) {
    return { correct: false, feedback: `Later than necessary. Every dependency is met before edge ${answer}, and a source must not wait for READY before asserting VALID, so VALID can already be 1 at edge ${answer}.` };
  }
  return { correct: false, feedback: `${c}VALID never rises in this window.` };
}

// ---------------------------------------------------------------------------
// WaveDrom export / import (used by the static lesson figures)
// ---------------------------------------------------------------------------

export interface WaveLaneSignal {
  name: string;
  wave: string;
  data?: string[];
}
export type WaveLane = WaveLaneSignal | Record<string, never> | (string | WaveLaneSignal)[];
export interface WaveDromSpec {
  signal: WaveLane[];
}

function bitWave(values: (number | undefined)[]): string {
  let out = "";
  let prev: string | null = null;
  for (const v of values) {
    const ch = v === undefined ? "x" : v === 1 ? "1" : "0";
    out += ch === prev ? "." : ch;
    prev = ch;
  }
  return out;
}

function busWave(values: (string | undefined)[], itemIndex?: (number | null)[]): { wave: string; data: string[] } {
  let wave = "";
  const data: string[] = [];
  let prev: string | undefined | null = null;
  values.forEach((v, k) => {
    const sameItem = !itemIndex || k === 0 || itemIndex[k] === itemIndex[k - 1];
    if (k > 0 && v === prev && sameItem) {
      wave += ".";
    } else if (v === undefined) {
      wave += "x";
    } else {
      wave += "=";
      data.push(v);
    }
    prev = v;
  });
  return { wave, data };
}

export interface WaveGroup {
  channel: ChannelName;
  label?: string;
  payload?: boolean;
  last?: boolean;
  resp?: boolean;
  /** Adds a `xVALID && xREADY` row that is 1 in each column that ends in a transfer. */
  handshakeRow?: boolean;
}

/**
 * Column k of the WaveDrom diagram holds the value sampled at model edge k,
 * i.e. at the rising ACLK edge that ends column k.
 */
export function traceToWaveDrom(trace: ChannelTrace, groups: WaveGroup[]): WaveDromSpec {
  const signal: WaveLane[] = [{ name: "ACLK", wave: `p${".".repeat(trace.edges - 1)}` }];
  for (const g of groups) {
    const s = trace.signals[g.channel];
    if (!s) continue;
    const info = CHANNEL_INFO[g.channel];
    const lanes: WaveLaneSignal[] = [
      { name: `${g.channel}VALID`, wave: bitWave(s.valid) },
      { name: `${g.channel}READY`, wave: bitWave(s.ready) },
    ];
    if (g.payload !== false) lanes.push({ name: info.payload, ...busWave(s.payload, s.itemIndex) });
    if (g.resp && info.resp && s.resp) lanes.push({ name: info.resp, ...busWave(s.resp, s.itemIndex) });
    if (g.last && info.last && s.last) lanes.push({ name: info.last, wave: bitWave(s.last) });
    if (g.handshakeRow) {
      lanes.push({ name: `${g.channel}VALID && ${g.channel}READY`, wave: bitWave(s.valid.map((v, k) => (v === 1 && s.ready[k] === 1 ? 1 : 0))) });
    }
    signal.push({});
    signal.push(g.label ? [g.label, ...lanes] : lanes[0]);
    if (!g.label) lanes.slice(1).forEach((l) => signal.push(l));
  }
  return { signal };
}

/** Expands a WaveDrom wave string into one value per column. */
export function waveToValues(wave: string, data: string[] = []): (string | number | undefined)[] {
  const out: (string | number | undefined)[] = [];
  let prev: string | number | undefined;
  let d = 0;
  for (const ch of wave) {
    if (ch === ".") {
      out.push(prev);
      continue;
    }
    if (ch === "0" || ch === "l" || ch === "L") prev = 0;
    else if (ch === "1" || ch === "h" || ch === "H") prev = 1;
    else if (ch === "x") prev = undefined;
    else if (ch === "=" || (ch >= "2" && ch <= "9")) {
      prev = data[d] ?? `#${d}`;
      d += 1;
    } else if ("pPnN".includes(ch)) prev = ch;
    else prev = undefined;
    out.push(prev);
  }
  return out;
}

/** Flattens WaveDrom groups into name -> per-column values. */
export function waveDromToColumns(spec: { signal: unknown[] }): Map<string, (string | number | undefined)[]> {
  const out = new Map<string, (string | number | undefined)[]>();
  const visit = (lane: unknown) => {
    if (Array.isArray(lane)) {
      lane.slice(1).forEach(visit);
      return;
    }
    const s = lane as { name?: string; wave?: string; data?: string[] | string };
    if (s && typeof s.name === "string" && typeof s.wave === "string") {
      const data = Array.isArray(s.data) ? s.data : typeof s.data === "string" ? s.data.split(/\s+/) : [];
      out.set(s.name, waveToValues(s.wave, data));
    }
  };
  spec.signal.forEach(visit);
  return out;
}

/** Runs the protocol checker on a WaveDrom spec that uses AXI channel names. */
export function checkWaveDrom(spec: { signal: unknown[] }): { violations: ProtocolViolation[]; handshakes: Partial<Record<ChannelName, number[]>>; edges: number } {
  const cols = waveDromToColumns(spec);
  const edges = Math.max(0, ...[...cols.values()].map((v) => v.length));
  const asBits = (v: (string | number | undefined)[] | undefined): Bit[] => (v ?? []).map((x) => (x === 1 ? 1 : 0));
  const signals: Partial<Record<ChannelName, Pick<ChannelSignals, "valid" | "ready" | "payload" | "last">>> = {};
  const handshakes: Partial<Record<ChannelName, number[]>> = {};
  for (const c of CHANNEL_ORDER) {
    const valid = cols.get(`${c}VALID`);
    const ready = cols.get(`${c}READY`);
    if (!valid || !ready) continue;
    const info = CHANNEL_INFO[c];
    const payload = (cols.get(info.payload) ?? []).map((x) => (x === undefined ? undefined : String(x)));
    const lastCol = info.last ? cols.get(info.last) : undefined;
    signals[c] = {
      valid: asBits(valid),
      ready: asBits(ready),
      payload,
      last: lastCol ? lastCol.map((x) => (x === undefined ? undefined : x === 1 ? 1 : 0)) : undefined,
    };
    handshakes[c] = asBits(valid).flatMap((v, k) => (v === 1 && asBits(ready)[k] === 1 ? [k] : []));
  }
  return { violations: checkChannels(signals, edges), handshakes, edges };
}

// ---------------------------------------------------------------------------
// Scenarios used by the visuals and the B-AXI-1 lesson figures
// ---------------------------------------------------------------------------

const pattern = (...bits: number[]): ReadyPolicy => ({ kind: "pattern", bits });
const always: ReadyPolicy = { kind: "always" };

export interface HandshakeScenarioSpec {
  id: string;
  title: string;
  summary: string;
  scenario: ChannelScenario;
  /** Rows the learner can toggle (READY of pattern-driven channels). */
  question: EdgeQuestion | { kind: "spot-violation" };
  /** Wrong edges to offer, chosen to expose a misconception. */
  distractors?: number[];
  prompt: string;
}

const awItem = (key: string, label: string, availableAt: number, txn = "wr1"): ChannelItem => ({ key, txn, label, availableAt });

export const HANDSHAKE_BASICS: HandshakeScenarioSpec[] = [
  {
    id: "valid-first",
    title: "VALID first",
    summary: "The source has an address at edge 1; the destination is not ready until later (IHI0022E Figure A3-2).",
    scenario: { edges: 6, channels: { AW: { items: [awItem("a0", "0x1000", 1)], ready: pattern(0, 0, 0, 1, 0, 0) } } },
    question: { kind: "handshake", channel: "AW", itemIndex: 0 },
    distractors: [1, 2, 4],
    prompt: "At which edge does the address transfer?",
  },
  {
    id: "ready-first",
    title: "READY first",
    summary: "The destination raises READY before the source has anything to send (Figure A3-3).",
    scenario: { edges: 6, channels: { AW: { items: [awItem("a0", "0x1000", 2)], ready: pattern(0, 1, 1, 1, 0, 0) } } },
    question: { kind: "handshake", channel: "AW", itemIndex: 0 },
    distractors: [1, 3],
    prompt: "AWREADY is already 1 at edge 1. At which edge does the address transfer?",
  },
  {
    id: "together",
    title: "Same edge",
    summary: "Both sides happen to be ready together (Figure A3-4).",
    scenario: { edges: 5, channels: { AW: { items: [awItem("a0", "0x1000", 1)], ready: pattern(0, 1, 0, 0, 0) } } },
    question: { kind: "handshake", channel: "AW", itemIndex: 0 },
    distractors: [2, 3],
    prompt: "Both rise for edge 1. At which edge does the address transfer?",
  },
  {
    id: "ready-withdrawn",
    title: "READY withdrawn",
    summary: "The destination may drop READY before VALID arrives. The source still must not wait for it.",
    scenario: { edges: 7, channels: { AW: { items: [awItem("a0", "0x1000", 2)], ready: pattern(0, 1, 0, 0, 1, 0, 0) } } },
    question: { kind: "handshake", channel: "AW", itemIndex: 0 },
    distractors: [1, 2, 5],
    prompt: "AWREADY pulses at edge 1, AWVALID arrives at edge 2. At which edge does the address transfer?",
  },
  {
    id: "back-to-back",
    title: "Back-to-back",
    summary: "VALID stays 1 for several edges while three addresses go out. Each edge with VALID and READY both 1 is a separate transfer.",
    scenario: {
      edges: 7,
      channels: { AW: { items: [awItem("a0", "0x1000", 1, "wr1"), awItem("a1", "0x2000", 1, "wr2"), awItem("a2", "0x3000", 1, "wr3")], ready: pattern(0, 1, 1, 0, 1, 0, 0) } },
    },
    question: { kind: "handshake", channel: "AW", itemIndex: 2 },
    distractors: [2, 3, 5],
    prompt: "Three addresses are queued. At which edge does the third one (0x3000) transfer?",
  },
  {
    id: "dropped-valid",
    title: "Debug: dropped VALID",
    summary: "A master gives up on an address while the slave is stalling, then offers it again. Find the edge where the trace breaks the protocol.",
    scenario: {
      edges: 7,
      channels: { AW: { items: [awItem("a0", "0x1000", 1)], ready: pattern(0, 0, 0, 0, 0, 1, 0) } },
      faults: [{ kind: "drop-valid", channel: "AW", edge: 3 }],
    },
    question: { kind: "spot-violation" },
    prompt: "Select the edge where this trace first violates the handshake rules.",
  },
];

const wItem = (key: string, label: string, availableAt: number, last = false, txn = "wr1"): ChannelItem => ({ key, txn, label, availableAt, last });

export const CHANNEL_SCENARIOS: HandshakeScenarioSpec[] = [
  {
    id: "w-before-aw",
    title: "W before AW",
    summary: "The slave is slow to accept the address, so both data beats transfer first. That is legal (A3.3). The slave already has the response ready.",
    scenario: {
      edges: 8,
      channels: {
        AW: { items: [awItem("aw", "0x1000", 1)], ready: pattern(0, 0, 0, 0, 1, 0, 0, 0) },
        W: { items: [wItem("w0", "D0", 1), wItem("w1", "D1", 1, true)], ready: always },
        B: { items: [{ key: "b", txn: "wr1", label: "OKAY", availableAt: 0 }], ready: always },
      },
    },
    question: { kind: "first-valid", channel: "B", itemIndex: 0 },
    distractors: [3, 4, 6],
    prompt: "WLAST transfers at edge 2 and AWREADY rises for edge 4. At which edge is BVALID first 1?",
  },
  {
    id: "independent",
    title: "Backpressure on W only",
    summary: "The slave stalls write data (WREADY = 0) while a read is in flight on AR and R.",
    scenario: {
      edges: 8,
      channels: {
        AW: { items: [awItem("aw", "0x1000", 1)], ready: always },
        W: { items: [wItem("w0", "D0", 1), wItem("w1", "D1", 1, true)], ready: pattern(0, 0, 0, 0, 1, 1, 0, 0) },
        B: { items: [{ key: "b", txn: "wr1", label: "OKAY", availableAt: 0 }], ready: always },
        AR: { items: [{ key: "ar", txn: "rd1", label: "0x2000", availableAt: 1 }], ready: always },
        R: {
          items: [
            { key: "r0", txn: "rd1", label: "R0", availableAt: 0, resp: "OKAY" },
            { key: "r1", txn: "rd1", label: "R1", availableAt: 0, last: true, resp: "OKAY" },
          ],
          ready: always,
        },
      },
    },
    question: { kind: "handshake", channel: "R", itemIndex: 1 },
    distractors: [2, 5, 6],
    prompt: "WREADY stays 0 until edge 4. At which edge does the last read beat (RLAST) transfer?",
  },
  {
    id: "read-burst",
    title: "Read after AR",
    summary: "A three-beat read. The slave has data waiting but may only drive RVALID after the AR handshake.",
    scenario: {
      edges: 7,
      channels: {
        AR: { items: [{ key: "ar", txn: "rd1", label: "0x2000", availableAt: 1 }], ready: pattern(0, 0, 1, 0, 0, 0, 0) },
        R: {
          items: [
            { key: "r0", txn: "rd1", label: "R0", availableAt: 0, resp: "OKAY" },
            { key: "r1", txn: "rd1", label: "R1", availableAt: 0, resp: "OKAY" },
            { key: "r2", txn: "rd1", label: "R2", availableAt: 0, last: true, resp: "OKAY" },
          ],
          ready: always,
        },
      },
    },
    question: { kind: "first-valid", channel: "R", itemIndex: 0 },
    distractors: [1, 2, 4],
    prompt: "ARREADY is 1 only at edge 2. At which edge is RVALID first 1?",
  },
  {
    id: "axi3-slave",
    title: "Debug: legacy slave",
    summary: "This slave was written for AXI3 habits: it answers as soon as WLAST arrives. Find the edge where the AXI4 trace breaks a rule.",
    scenario: {
      edges: 8,
      channels: {
        AW: { items: [awItem("aw", "0x1000", 1)], ready: pattern(0, 0, 0, 0, 1, 0, 0, 0) },
        W: { items: [wItem("w0", "D0", 1), wItem("w1", "D1", 1, true)], ready: always },
        B: { items: [{ key: "b", txn: "wr1", label: "OKAY", availableAt: 0 }], ready: always },
      },
      faults: [{ kind: "b-ignores-aw" }],
    },
    question: { kind: "spot-violation" },
    prompt: "Select the edge where this AXI4 trace first breaks a rule.",
  },
];

/** The static figures in B-AXI-1, generated from the same engine (see tests). */
export const LESSON_FIGURES = {
  handshake: {
    scenario: { edges: 6, channels: { AW: { items: [awItem("a0", "0x1000", 1)], ready: pattern(0, 0, 0, 1, 0, 0) } } } as ChannelScenario,
    groups: [{ channel: "AW", payload: true, handshakeRow: true }] as WaveGroup[],
  },
  write: {
    scenario: {
      edges: 7,
      channels: {
        AW: { items: [awItem("aw", "0x1000", 1)], ready: pattern(0, 1, 0, 0, 0, 0, 0) },
        W: { items: [wItem("w0", "D0", 2), wItem("w1", "D1", 2), wItem("w2", "D2", 2, true)], ready: pattern(0, 0, 1, 1, 1, 0, 0) },
        B: { items: [{ key: "b", txn: "wr1", label: "OKAY", availableAt: 0 }], ready: pattern(0, 0, 0, 0, 0, 1, 0) },
      },
    } as ChannelScenario,
    groups: [
      { channel: "AW", label: "AW channel" },
      { channel: "W", label: "W channel", last: true },
      { channel: "B", label: "B channel" },
    ] as WaveGroup[],
  },
  read: {
    scenario: {
      edges: 7,
      channels: {
        AR: { items: [{ key: "ar", txn: "rd1", label: "0x2000", availableAt: 1 }], ready: pattern(0, 1, 0, 0, 0, 0, 0) },
        R: {
          items: [
            { key: "r0", txn: "rd1", label: "D0", availableAt: 3, resp: "OKAY" },
            { key: "r1", txn: "rd1", label: "D1", availableAt: 3, resp: "OKAY" },
            { key: "r2", txn: "rd1", label: "D2", availableAt: 3, last: true, resp: "OKAY" },
          ],
          ready: pattern(0, 0, 0, 1, 1, 1, 0),
        },
      },
    } as ChannelScenario,
    groups: [
      { channel: "AR", label: "AR channel" },
      { channel: "R", label: "R channel", resp: true, last: true },
    ] as WaveGroup[],
  },
} as const;

export function lessonFigure(name: keyof typeof LESSON_FIGURES): WaveDromSpec {
  const fig = LESSON_FIGURES[name];
  return traceToWaveDrom(simulateChannels(fig.scenario), fig.groups);
}

/** SVA that checks the same rules as `checkChannels`, keyed by rule id. */
export const CHANNEL_SVA: { key: ProtocolRule; clause: string; lines: string[] }[] = [
  {
    key: "valid-held",
    clause: "A3.2.1",
    lines: [
      "// A3.2.1: once VALID is 1 it stays 1 until READY is also 1",
      "a_aw_hold: assert property (@(posedge ACLK) disable iff (!ARESETn)",
      "  AWVALID && !AWREADY |=> AWVALID);",
    ],
  },
  {
    key: "payload-stable",
    clause: "A3.2.1",
    lines: [
      "// A3.2.1: the payload is stable while the transfer waits",
      "a_aw_stable: assert property (@(posedge ACLK) disable iff (!ARESETn)",
      "  AWVALID && !AWREADY |=> $stable({AWADDR, AWLEN, AWSIZE, AWBURST, AWID}));",
    ],
  },
  {
    key: "b-after-aw-and-wlast",
    clause: "A3.3.1",
    lines: [
      "// A3.3.1 AXI4: BVALID only after both the AW and the WLAST handshake",
      "// aw_done / wlast_done count handshakes; b_done counts B handshakes",
      "a_b_dep: assert property (@(posedge ACLK) disable iff (!ARESETn)",
      "  BVALID |-> (aw_done > b_done) && (wlast_done > b_done));",
    ],
  },
  {
    key: "r-after-ar",
    clause: "A3.3.1",
    lines: [
      "// A3.3.1: RVALID only while a read address is outstanding",
      "a_r_dep: assert property (@(posedge ACLK) disable iff (!ARESETn)",
      "  RVALID |-> (ar_done > rlast_done));",
    ],
  },
];

// ---------------------------------------------------------------------------
// Ordering (A5.3, A5.4) and interconnect IDs (A5.3.5)
// ---------------------------------------------------------------------------

export interface OrderedRequest {
  key: string;
  id: number;
  /** Data beats (reads, write data) carried by the transaction. */
  beats: number;
  label: string;
  /** Master port, for interconnect scenarios. */
  master?: number;
}

export interface OrderCheck {
  legal: boolean;
  clause: string;
  reason: string;
}

const beatsSent = (sequence: string[], key: string) => sequence.filter((k) => k === key).length;

/**
 * Can the slave send the next R beat of `next` after `sent`? Same ARID: in
 * address order, no mixing. Different ARIDs: any order, interleaving allowed.
 */
export function checkNextReadBeat(requests: OrderedRequest[], sent: string[], next: string): OrderCheck {
  const target = requests.find((r) => r.key === next);
  if (!target) return { legal: false, clause: "IHI0022E A5.3.1", reason: `${next} is not an outstanding read.` };
  if (beatsSent(sent, next) >= target.beats) {
    return { legal: false, clause: "IHI0022E A3.4.1", reason: `${target.label} already sent all ${target.beats} beats (RLAST). A burst carries exactly AxLEN+1 transfers.` };
  }
  const idx = requests.indexOf(target);
  const blocker = requests.slice(0, idx).find((r) => r.id === target.id && beatsSent(sent, r.key) < r.beats);
  if (blocker) {
    return {
      legal: false,
      clause: "IHI0022E A5.3.1",
      reason: `${target.label} has ARID ${target.id}, like ${blocker.label}, which was issued earlier and is not finished. Same-ID read data must return in address order, so ${blocker.label} must complete first.`,
    };
  }
  const others = requests.filter((r) => r.id !== target.id && beatsSent(sent, r.key) > 0 && beatsSent(sent, r.key) < r.beats);
  return {
    legal: true,
    clause: "IHI0022E A5.3.1",
    reason: others.length
      ? `Legal: ${target.label} (ID ${target.id}) may interleave with ${others.map((o) => `${o.label} (ID ${o.id})`).join(", ")}, because their IDs differ.`
      : `Legal: no earlier read with ARID ${target.id} is still pending.`,
  };
}

/** Same-AWID write responses return in address order (A5.3); one B per write. */
export function checkNextWriteResponse(writes: OrderedRequest[], sent: string[], next: string): OrderCheck {
  const target = writes.find((w) => w.key === next);
  if (!target) return { legal: false, clause: "IHI0022E A5.3", reason: `${next} is not an outstanding write.` };
  if (sent.includes(next)) return { legal: false, clause: "IHI0022E A3.3", reason: `${target.label} already received its single write response.` };
  const idx = writes.indexOf(target);
  const blocker = writes.slice(0, idx).find((w) => w.id === target.id && !sent.includes(w.key));
  if (blocker) {
    return {
      legal: false,
      clause: "IHI0022E A5.3",
      reason: `${target.label} and ${blocker.label} share AWID ${target.id}. Writes with the same AWID must complete in the order their addresses were issued, so ${blocker.label}'s BRESP comes first.`,
    };
  }
  return { legal: true, clause: "IHI0022E A5.3", reason: `Legal: no earlier write with AWID ${target.id} is still waiting for its response.` };
}

/** AXI4 write data follows address order and is never interleaved (A5.3.2, A5.4). */
export function checkNextWriteBeat(writes: OrderedRequest[], sent: string[], next: string): OrderCheck {
  const target = writes.find((w) => w.key === next);
  if (!target) return { legal: false, clause: "IHI0022E A5.4", reason: `${next} is not an outstanding write.` };
  if (beatsSent(sent, next) >= target.beats) return { legal: false, clause: "IHI0022E A3.4.1", reason: `${target.label} already sent WLAST.` };
  const current = writes.find((w) => beatsSent(sent, w.key) < w.beats);
  if (current && current.key !== next) {
    return {
      legal: false,
      clause: "IHI0022E A5.4",
      reason: `${current.label} was issued first and its data is not finished. In AXI4 "all write data for a transaction must be provided in consecutive transfers", in address order, whatever the AWIDs (there is no WID).`,
    };
  }
  return { legal: true, clause: "IHI0022E A5.4", reason: `Legal: ${target.label} is the oldest write whose data is not complete.` };
}

export interface ReplayedBeat {
  key: string;
  id: number;
  beat: number;
  last: boolean;
  check: OrderCheck;
}

export type OrderingKind = "read-data" | "write-response" | "write-data";

const checkers: Record<OrderingKind, typeof checkNextReadBeat> = {
  "read-data": checkNextReadBeat,
  "write-response": checkNextWriteResponse,
  "write-data": checkNextWriteBeat,
};

/** Replays a whole sequence, flagging every illegal entry. Illegal entries still count as sent. */
export function replayOrdering(kind: OrderingKind, requests: OrderedRequest[], sequence: string[]): ReplayedBeat[] {
  const out: ReplayedBeat[] = [];
  const sent: string[] = [];
  for (const key of sequence) {
    const req = requests.find((r) => r.key === key);
    const check = checkers[kind](requests, sent, key);
    sent.push(key);
    const beat = beatsSent(sent, key);
    const beatsOf = kind === "write-response" ? 1 : req?.beats ?? 1;
    out.push({ key, id: req?.id ?? -1, beat, last: beat === beatsOf, check });
  }
  return out;
}

export function isLegalOrdering(kind: OrderingKind, requests: OrderedRequest[], sequence: string[]): boolean {
  return replayOrdering(kind, requests, sequence).every((b) => b.check.legal);
}

/**
 * A5.3.5: the interconnect appends master-port bits to the ID. Where those
 * bits go is IMPLEMENTATION DEFINED; this model puts them above the master ID.
 */
export function extendId(masterPort: number, id: number, masterIdBits: number): number {
  return masterPort * 2 ** masterIdBits + id;
}

export function splitExtendedId(slaveId: number, masterIdBits: number): { masterPort: number; id: number } {
  return { masterPort: Math.floor(slaveId / 2 ** masterIdBits), id: slaveId % 2 ** masterIdBits };
}

export function idBits(value: number, width: number): string {
  return value.toString(2).padStart(width, "0");
}
