"use client";

import React, { useMemo, useState } from "react";

import { CycleWaveform, type CycleMarker, type CycleSignal } from "@/components/visual-system/CycleWaveform";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  checkReadValue,
  extendId,
  idBits,
  legalReadValues,
  replayOrdering,
  type OrderedRequest,
  type OrderingKind,
  type RawRead,
  type RawWrite,
} from "@/lib/axi-channel-model";
import { cn } from "@/lib/utils";

export const AXI_ORDERING_ASSUMPTIONS = [
  "Every address handshake has already happened, in the order listed; only the response or data order is chosen.",
  "Rules: same-ID read data in address order, different IDs in any order and interleaved (IHI0022E A5.3.1); same-AWID write responses in order (A5.3); AXI4 write data in address order, never interleaved (A5.3.2, A5.4).",
  "Interconnect IDs: A5.3.5 says the interconnect appends master-port bits; putting them above the master's ID bits is this model's choice.",
  "Read after write: a read issued before the write's B may return the old or the new value (A5.3.4, A6.1); one issued after B must return the new value, whatever the IDs (A6.4). The model assumes one master, no other writer, each read inside one single-copy atomic block (A7.1) and a B from the final destination (A6.1 Note).",
  "One beat per column; READY is always 1, so each column is one transfer.",
];

type SequencePresetId = "same-id" | "diff-id" | "b-order" | "w-order" | "interconnect";

interface OrderingPreset {
  id: SequencePresetId;
  label: string;
  kind: OrderingKind;
  summary: string;
  question: string;
  requests: OrderedRequest[];
  /** Candidate sequences of request keys; exactly one is legal (checked by the model in tests). */
  options: string[][];
  /** Two-master interconnect view. */
  masterIdBits?: number;
}

export const ORDERING_PRESETS: OrderingPreset[] = [
  {
    id: "same-id",
    label: "Reads, same ID",
    kind: "read-data",
    summary: "The master issued read A, then read B, both with ARID 3. Each returns 2 beats.",
    question: "Which R channel order is legal?",
    requests: [
      { key: "A", id: 3, beats: 2, label: "A" },
      { key: "B", id: 3, beats: 2, label: "B" },
    ],
    options: [
      ["B", "B", "A", "A"],
      ["A", "B", "A", "B"],
      ["A", "A", "B", "B"],
    ],
  },
  {
    id: "diff-id",
    label: "Reads, different IDs",
    kind: "read-data",
    summary: "Reads A (ARID 1, 2 beats), B (ARID 2, 2 beats) and C (ARID 1, 1 beat) were issued in that order.",
    question: "Which R channel order is legal?",
    requests: [
      { key: "A", id: 1, beats: 2, label: "A" },
      { key: "B", id: 2, beats: 2, label: "B" },
      { key: "C", id: 1, beats: 1, label: "C" },
    ],
    options: [
      ["A", "C", "A", "B", "B"],
      ["B", "A", "B", "A", "C"],
      ["C", "B", "B", "A", "A"],
    ],
  },
  {
    id: "b-order",
    label: "Write responses",
    kind: "write-response",
    summary: "Writes W1 (AWID 2), W2 (AWID 3) and W3 (AWID 2) were issued in that order; all their data has arrived.",
    question: "Which B channel order is legal?",
    requests: [
      { key: "W1", id: 2, beats: 1, label: "W1" },
      { key: "W2", id: 3, beats: 1, label: "W2" },
      { key: "W3", id: 2, beats: 1, label: "W3" },
    ],
    options: [
      ["W3", "W2", "W1"],
      ["W2", "W1", "W3"],
      ["W3", "W1", "W2"],
    ],
  },
  {
    id: "w-order",
    label: "Write data (AXI4)",
    kind: "write-data",
    summary: "The master issued write X (AWID 0, 2 beats), then write Y (AWID 1, 1 beat). The W channel has no ID in AXI4.",
    question: "Which W channel order is legal?",
    requests: [
      { key: "X", id: 0, beats: 2, label: "X" },
      { key: "Y", id: 1, beats: 1, label: "Y" },
    ],
    options: [
      ["Y", "X", "X"],
      ["X", "Y", "X"],
      ["X", "X", "Y"],
    ],
  },
  {
    id: "interconnect",
    label: "Two masters",
    kind: "read-data",
    summary: "M0 issues A then C, M1 issues B, all with ARID 2'b10. The interconnect appends a 1-bit master number, so the slave sees ID 3'b010 for A and C and 3'b110 for B.",
    question: "Which R order may the slave return?",
    masterIdBits: 2,
    requests: [
      { key: "A", id: extendId(0, 0b10, 2), beats: 1, label: "M0:A", master: 0 },
      { key: "B", id: extendId(1, 0b10, 2), beats: 1, label: "M1:B", master: 1 },
      { key: "C", id: extendId(0, 0b10, 2), beats: 1, label: "M0:C", master: 0 },
    ],
    options: [
      ["C", "B", "A"],
      ["B", "A", "C"],
      ["C", "A", "B"],
    ],
  },
];

/** A situation about returned data rather than order: which values may each read return? */
export interface ReadAfterWritePreset {
  id: "read-after-write";
  label: string;
  summary: string;
  question: string;
  write: RawWrite;
  reads: RawRead[];
  /** Candidate results (read key -> RDATA); exactly one is legal (checked by the model in tests). */
  options: Record<string, string>[];
}

export const READ_AFTER_WRITE_PRESET: ReadAfterWritePreset = {
  id: "read-after-write",
  label: "Read after write, same ID",
  summary:
    "The master writes 0x42 to address 0x100 with AWID 1; the old value is 0x00. It issues read R1 (ARID 1) after the write data but before the write's B, then read R2 (ARID 1) after the B. No other master writes 0x100.",
  question: "Which pair of read results may the slave return?",
  write: { id: 1, addr: "0x100", oldValue: "0x00", newValue: "0x42", awEdge: 1, wEdge: 2, bEdge: 5 },
  reads: [
    { key: "R1", label: "R1", id: 1, arEdge: 3, rEdge: 4 },
    { key: "R2", label: "R2", id: 1, arEdge: 6, rEdge: 7 },
  ],
  options: [
    { R1: "0x42", R2: "0x00" },
    { R1: "0x00", R2: "0x42" },
    { R1: "0x00", R2: "0x00" },
  ],
};

export type IdOrderingPresetId = SequencePresetId | ReadAfterWritePreset["id"];

/** The situations in menu order: the four rules, read after write (Rule 4), then the interconnect. */
export const ID_ORDERING_MENU: { value: IdOrderingPresetId; label: string }[] = [
  ...ORDERING_PRESETS.filter((p) => p.id !== "interconnect").map((p) => ({ value: p.id, label: p.label })),
  { value: READ_AFTER_WRITE_PRESET.id, label: READ_AFTER_WRITE_PRESET.label },
  ...ORDERING_PRESETS.filter((p) => p.id === "interconnect").map((p) => ({ value: p.id, label: p.label })),
];

/** True when every read in `result` returns a value the model allows. */
export function isLegalReadResult(preset: ReadAfterWritePreset, result: Record<string, string>): boolean {
  return preset.reads.every((r) => result[r.key] !== undefined && checkReadValue(preset.write, r, result[r.key]).legal);
}

const KIND_NAMES: Record<OrderingKind, { ch: string; valid: string; id: string | null; data: string; last: string | null }> = {
  "read-data": { ch: "R", valid: "RVALID", id: "RID", data: "RDATA", last: "RLAST" },
  "write-response": { ch: "B", valid: "BVALID", id: "BID", data: "BRESP", last: null },
  "write-data": { ch: "W", valid: "WVALID", id: null, data: "WDATA", last: "WLAST" },
};

function seqLabel(p: OrderingPreset, seq: string[]) {
  const counts = new Map<string, number>();
  return seq
    .map((k) => {
      const n = counts.get(k) ?? 0;
      counts.set(k, n + 1);
      const label = p.requests.find((r) => r.key === k)?.label ?? k;
      return p.kind === "write-response" || (p.requests.find((r) => r.key === k)?.beats ?? 1) === 1 ? label : `${label}${n}`;
    })
    .join(", ");
}

function OrderWave({ preset, sequence }: { preset: OrderingPreset; sequence: string[] }) {
  const names = KIND_NAMES[preset.kind];
  const replay = replayOrdering(preset.kind, preset.requests, sequence);
  const edges = Math.max(6, replay.length + 1);
  const pad = <T,>(arr: T[], fill: T) => [...arr, ...Array.from({ length: edges - arr.length }, () => fill)];
  const idWidth = preset.masterIdBits ? preset.masterIdBits + 1 : 2;
  const signals: CycleSignal[] = [
    { name: "ACLK", kind: "clock" },
    { name: names.valid, kind: "bit", values: pad([0, ...replay.map(() => 1)], 0) },
  ];
  if (names.id) {
    signals.push({ name: names.id, kind: "bus", values: pad([undefined, ...replay.map((b) => (preset.masterIdBits ? idBits(b.id, idWidth) : String(b.id)))], undefined) });
  }
  signals.push({
    name: names.data,
    kind: "bus",
    values: pad([undefined, ...replay.map((b) => (preset.kind === "write-response" ? `OKAY ${b.key}` : `${preset.requests.find((r) => r.key === b.key)?.label ?? b.key}${b.beat - 1}`))], undefined),
  });
  if (names.last) signals.push({ name: names.last, kind: "bit", values: pad([undefined, ...replay.map((b) => (b.last ? 1 : 0))], undefined) });
  const markers: CycleMarker[] = replay.map((b, i) => ({
    edge: i + 1,
    tone: b.check.legal ? "pass" : "fail",
    label: `${names.ch} transfer ${i + 1} (${b.key}): ${b.check.reason}`,
  }));
  return (
    <CycleWaveform
      title={`${names.ch} channel order`}
      signals={signals}
      edges={edges}
      markers={markers}
      caption={`x-axis: ACLK edges; one ${names.ch} transfer per edge (${names.ch}READY held at 1). ✓ legal at that point, ✕ breaks an ordering rule.`}
    />
  );
}

function SequenceView({ preset }: { preset: OrderingPreset }) {
  const [sequence, setSequence] = useState<string[] | null>(null);
  const names = KIND_NAMES[preset.kind];

  const options: PredictionOption[] = useMemo(
    () =>
      preset.options.map((seq, i) => {
        const replay = replayOrdering(preset.kind, preset.requests, seq);
        const bad = replay.find((b) => !b.check.legal);
        return {
          id: String(i),
          label: <span className="font-mono">{seqLabel(preset, seq)}</span>,
          correct: !bad,
          feedback: bad ? `${bad.check.reason} (${bad.check.clause})` : `Every transfer is legal when it happens. ${replay[replay.length - 1].check.reason}`,
        };
      }),
    [preset],
  );
  const legalSeq = preset.options.find((seq) => replayOrdering(preset.kind, preset.requests, seq).every((b) => b.check.legal)) ?? [];
  const seq = sequence ?? legalSeq;
  const replay = replayOrdering(preset.kind, preset.requests, seq);
  const last = replay.length > 0 ? replay[replay.length - 1] : null;

  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label="Outstanding transactions in issue order">
        {preset.requests.map((r, i) => (
          <li key={r.key} className="rounded-lg border border-border/70 bg-background/50 px-3 py-1.5 text-sm">
            <span className="text-xs text-muted-foreground">#{i + 1} </span>
            <span className="font-semibold">{r.label}</span>{" "}
            <span className="font-mono text-xs [font-variant-ligatures:none]">
              {preset.kind === "read-data" ? "ARID" : "AWID"}={preset.masterIdBits ? `3'b${idBits(r.id, preset.masterIdBits + 1)}` : r.id}
            </span>
            {preset.kind !== "write-response" ? <span className="text-xs text-muted-foreground"> · {r.beats} beat{r.beats > 1 ? "s" : ""}</span> : null}
          </li>
        ))}
      </ul>

      {preset.masterIdBits ? (
        <div className="overflow-x-auto">
          <table className="min-w-[300px] text-left text-sm">
            <caption className="mb-1 text-left text-xs text-muted-foreground">Interconnect ID extension (A5.3.5): slave ID = {"{"}master port, master ARID{"}"}</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="pr-4">Master</th>
                <th scope="col" className="pr-4">ARID at master</th>
                <th scope="col" className="pr-4">ARID at slave</th>
                <th scope="col">Decimal</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[0, 1].map((m) => (
                <tr key={m}>
                  <td className="pr-4">M{m}</td>
                  <td className="pr-4">2&apos;b10</td>
                  <td className="pr-4">3&apos;b{idBits(extendId(m, 0b10, 2), 3)}</td>
                  <td>{extendId(m, 0b10, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <PredictionPrompt question={preset.question} options={options} resetKey={preset.id}>
        <div className="space-y-3">
          <OrderWave preset={preset} sequence={seq} />
          {last ? (
            <p aria-live="polite" className={cn("text-sm", last.check.legal ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
              {last.check.legal ? "✓ " : "✕ "}Last transfer ({last.key}): {last.check.reason} ({last.check.clause})
            </p>
          ) : null}
          <div className="rounded-xl border border-border/60 p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Play the {preset.kind === "write-data" ? "master" : "slave"}: send the next {names.ch} transfer</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={`Send the next ${names.ch} transfer`}>
              {preset.requests.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setSequence([...seq, r.key])}
                  className="inline-flex h-10 items-center gap-1 rounded-lg border border-border/70 px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Send {r.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSequence(seq.slice(0, -1))}
                disabled={seq.length === 0}
                className="inline-flex h-10 items-center rounded-lg border border-border/70 px-3 text-sm disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setSequence([])}
                className="inline-flex h-10 items-center rounded-lg border border-border/70 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Illegal transfers are recorded with ✕ so you can see what a checker would catch.</p>
            <ol className="mt-2 space-y-1 text-sm" aria-label="Transfers sent so far">
              {replay.map((b, i) => (
                <li key={i} className={b.check.legal ? "text-foreground" : "text-rose-700 dark:text-rose-300"}>
                  <span aria-hidden>{b.check.legal ? "✓" : "✕"}</span> <span className="font-mono">{i + 1}. {b.key}</span>
                  {preset.kind !== "write-response" && b.last ? <span className="font-mono text-xs"> ({names.last ?? "last"})</span> : null}: {b.check.legal ? "" : "Illegal. "}{b.check.reason}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </PredictionPrompt>
    </>
  );
}

const resultLabel = (preset: ReadAfterWritePreset, result: Record<string, string>) =>
  preset.reads.map((r) => `${r.label} = ${result[r.key] ?? "?"}`).join(", ");

function ReadAfterWriteWave({ preset, result }: { preset: ReadAfterWritePreset; result: Record<string, string> }) {
  const { write, reads } = preset;
  const edges = Math.max(write.bEdge, ...reads.map((r) => r.rEdge)) + 2;
  const at = <T,>(edge: number, value: T, fill: T) => Array.from({ length: edges }, (_, k) => (k === edge ? value : fill));
  const atEach = <T,>(pick: (r: RawRead) => number, value: (r: RawRead) => T, fill: T) =>
    Array.from({ length: edges }, (_, k) => {
      const r = reads.find((x) => pick(x) === k);
      return r ? value(r) : fill;
    });
  const signals: CycleSignal[] = [
    { name: "ACLK", kind: "clock" },
    { name: "AWVALID", kind: "bit", values: at(write.awEdge, 1, 0) },
    { name: "AWID", kind: "bus", values: at<string | undefined>(write.awEdge, String(write.id), undefined) },
    { name: "WVALID", kind: "bit", values: at(write.wEdge, 1, 0) },
    { name: "WDATA", kind: "bus", values: at<string | undefined>(write.wEdge, write.newValue, undefined) },
    { name: "BVALID", kind: "bit", values: at(write.bEdge, 1, 0) },
    { name: "BID", kind: "bus", values: at<string | undefined>(write.bEdge, String(write.id), undefined) },
    { name: "ARVALID", kind: "bit", values: atEach((r) => r.arEdge, () => 1, 0) },
    { name: "ARID", kind: "bus", values: atEach<string | undefined>((r) => r.arEdge, (r) => String(r.id), undefined) },
    { name: "RVALID", kind: "bit", values: atEach((r) => r.rEdge, () => 1, 0) },
    { name: "RDATA", kind: "bus", values: atEach<string | undefined>((r) => r.rEdge, (r) => result[r.key] ?? "?", undefined) },
  ];
  const markers: CycleMarker[] = [
    { edge: write.bEdge, tone: "info", short: "B", label: `B at edge ${write.bEdge}: the write is complete; every read issued after this edge must return ${write.newValue} (A6.4).` },
    ...reads.map((r): CycleMarker => {
      const value = result[r.key];
      if (value === undefined) return { edge: r.rEdge, tone: "pending", short: r.label, label: `${r.label}: choose its data.` };
      const check = checkReadValue(write, r, value);
      return { edge: r.rEdge, tone: check.legal ? "pass" : "fail", short: r.label, label: `${check.reason} (${check.clause})` };
    }),
  ];
  return (
    <CycleWaveform
      title="Write, then two reads of the same address"
      signals={signals}
      edges={edges}
      markers={markers}
      caption={`x-axis: ACLK edges; every READY is held at 1, so each VALID pulse is one transfer. AW at edge ${write.awEdge}, W (WLAST) at ${write.wEdge}, B at ${write.bEdge}; ${reads.map((r) => `${r.label}: AR at ${r.arEdge}, R at ${r.rEdge}`).join("; ")}.`}
    />
  );
}

function ReadAfterWriteView({ preset }: { preset: ReadAfterWritePreset }) {
  const [choice, setChoice] = useState<Record<string, string> | null>(null);
  const legalOption = preset.options.find((o) => isLegalReadResult(preset, o)) ?? {};
  const result = choice ?? legalOption;
  const { write } = preset;

  const options: PredictionOption[] = useMemo(
    () =>
      preset.options.map((opt, i) => {
        const bad = preset.reads.map((r) => checkReadValue(preset.write, r, opt[r.key])).find((c) => !c.legal);
        const allowed = preset.reads.map((r) => {
          const v = legalReadValues(preset.write, r);
          return `${r.label} may return ${v.values.length === 1 ? `only ${v.values[0]}` : v.values.join(" or ")} (${v.clause})`;
        });
        return {
          id: String(i),
          label: <span className="font-mono">{resultLabel(preset, opt)}</span>,
          correct: !bad,
          feedback: bad ? `${bad.reason} (${bad.clause})` : `Both results are legal: ${allowed.join("; ")}.`,
        };
      }),
    [preset],
  );

  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label="Transactions in issue order">
        <li className="rounded-lg border border-border/70 bg-background/50 px-3 py-1.5 text-sm">
          <span className="font-semibold">Write</span>{" "}
          <span className="font-mono text-xs [font-variant-ligatures:none]">
            AWID={write.id} · {write.addr} ← {write.newValue}
          </span>
          <span className="text-xs text-muted-foreground"> · B at edge {write.bEdge}</span>
        </li>
        {preset.reads.map((r) => (
          <li key={r.key} className="rounded-lg border border-border/70 bg-background/50 px-3 py-1.5 text-sm">
            <span className="font-semibold">{r.label}</span>{" "}
            <span className="font-mono text-xs [font-variant-ligatures:none]">
              ARID={r.id} · {write.addr}
            </span>
            <span className="text-xs text-muted-foreground"> · AR at edge {r.arEdge}</span>
          </li>
        ))}
      </ul>

      <PredictionPrompt question={preset.question} options={options} resetKey={preset.id}>
        <div className="space-y-3">
          <ReadAfterWriteWave preset={preset} result={result} />
          <div className="rounded-xl border border-border/60 p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Play the slave: choose the data each read returns</p>
            <div className="space-y-2">
              {preset.reads.map((r) => (
                <div key={r.key} className="flex flex-wrap items-center gap-2" role="group" aria-label={`Data returned for ${r.label}`}>
                  <span className="w-8 font-mono text-sm">{r.label}</span>
                  {[write.oldValue, write.newValue].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={result[r.key] === value}
                      onClick={() => setChoice({ ...result, [r.key]: value })}
                      className={cn(
                        "inline-flex h-10 items-center rounded-lg border border-border/70 px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        result[r.key] === value && "border-primary bg-primary/10 font-semibold",
                      )}
                    >
                      {r.label} returns {value}
                    </button>
                  ))}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setChoice({})}
                className="inline-flex h-10 items-center rounded-lg border border-border/70 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm" aria-label="Read results checked" aria-live="polite">
              {preset.reads.map((r) => {
                const value = result[r.key];
                if (value === undefined) {
                  return (
                    <li key={r.key} className="text-muted-foreground">
                      <span className="font-mono">{r.label}</span>: not returned yet.
                    </li>
                  );
                }
                const check = checkReadValue(write, r, value);
                return (
                  <li key={r.key} className={check.legal ? "text-foreground" : "text-rose-700 dark:text-rose-300"}>
                    <span aria-hidden>{check.legal ? "✓" : "✕"}</span> {check.reason} ({check.clause})
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </PredictionPrompt>
    </>
  );
}

const isPresetId = (id: string | undefined): id is IdOrderingPresetId => ID_ORDERING_MENU.some((m) => m.value === id);

export interface AxiIdOrderingVisualizerProps {
  /** Situation to open on (default: "same-id"). Unknown ids fall back to the default. */
  initialPreset?: IdOrderingPresetId;
}

export default function AxiIdOrderingVisualizer({ initialPreset }: AxiIdOrderingVisualizerProps = {}) {
  const [presetId, setPresetId] = useState<IdOrderingPresetId>(isPresetId(initialPreset) ? initialPreset : ORDERING_PRESETS[0].id);
  const sequencePreset = ORDERING_PRESETS.find((p) => p.id === presetId);
  const summary = sequencePreset ? sequencePreset.summary : READ_AFTER_WRITE_PRESET.summary;

  return (
    <div data-testid="axi-id-ordering-visualizer">
      <VisualFrame
        label="AXI ID ordering explorer"
        eyebrow="Predict, then play the slave"
        title="Which response orders does the ID allow?"
        summary="Pick a situation, predict which order (or which read data) is legal, then play it yourself. The model checks every transfer against the ordering rules."
        fidelity="model"
        assumptions={AXI_ORDERING_ASSUMPTIONS}
      >
        <SegmentedControl label="Ordering situation" options={ID_ORDERING_MENU} value={presetId} onChange={setPresetId} />
        <p className="text-sm text-foreground">{summary}</p>
        {sequencePreset ? <SequenceView key={sequencePreset.id} preset={sequencePreset} /> : <ReadAfterWriteView key={READ_AFTER_WRITE_PRESET.id} preset={READ_AFTER_WRITE_PRESET} />}
      </VisualFrame>
    </div>
  );
}
