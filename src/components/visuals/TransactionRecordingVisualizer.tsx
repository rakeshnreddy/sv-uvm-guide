"use client";

import React, { useMemo, useState } from "react";

import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  DRIVE_NS,
  driverSource,
  enableSource,
  implSource,
  recordingItems,
  recordingPredictionOptions,
  runRecording,
  type RecordImpl,
  type RecordingEnable,
  type RecordingSetup,
} from "@/lib/uvm-recording-model";
import { cn } from "@/lib/utils";

export const RECORDING_MODEL_ASSUMPTIONS = [
  "Follows uvm-core 2020.3.1: recording_detail defaults to UVM_NONE, so get_recording_enabled() is 0 until set_recording_enabled(1) (IEEE 1800.2 13.1.6.13) or a non-zero recording_detail config value read at construction/build (library behaviour).",
  "With recording off, begin_tr() opens nothing and returns handle 0. With it on, end_tr() calls tr.record() (field macros + do_record) and closes the recorder (13.1.7).",
  "The default database is uvm_text_tr_database (tr_db.log); simulators substitute their own uvm_tr_database (Clause 7). Handle numbers are invented.",
  "Each item takes 20 ns to drive; the READ's rdata is filled in during drive().",
];

const enableChoices: { value: RecordingEnable; label: string }[] = [
  { value: "default", label: "nothing (default)" },
  { value: "set_recording_enabled", label: "set_recording_enabled(1)" },
  { value: "config-before-build", label: "config_db in test build" },
  { value: "config-in-run-phase", label: "config_db in run_phase" },
];

const implChoices: { value: RecordImpl; label: string }[] = [
  { value: "none", label: "no record code" },
  { value: "field-macros", label: "field macros" },
  { value: "do_record", label: "do_record()" },
];

function CodePanel({ label, lines, highlight }: { label: string; lines: string[]; highlight?: (line: string) => boolean }) {
  return (
    <figure aria-label={label} className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
      <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</figcaption>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-5 [font-variant-ligatures:none]">
        {lines.map((l, i) => (
          <span key={i} className={cn("block", highlight?.(l) && "bg-amber-400/15 text-amber-100")}>
            {l || " "}
          </span>
        ))}
      </pre>
    </figure>
  );
}

function StreamView({ setup }: { setup: RecordingSetup }) {
  const run = runRecording(setup);
  const span = recordingItems.length * DRIVE_NS;
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs [font-variant-ligatures:none]">
        begin_tr() returned: {run.beginTrHandles.join(", ")}
        {run.enabled ? "" : "  (0 = nothing opened)"}
      </p>
      <figure aria-label="Transaction stream" className="overflow-x-auto rounded-xl border border-border/70 bg-background/50 p-3">
        <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Transaction stream {run.streamName ? <span className="normal-case tracking-normal">“{run.streamName}”</span> : null} · x-axis: simulation time, t = 0 … {span} ns
        </figcaption>
        <div className="relative min-w-[300px]">
          {run.transactions.length === 0 ? (
            <p className="flex h-16 items-center justify-center rounded-md border border-dashed border-border/70 text-sm text-muted-foreground">⊘ empty stream — nothing was recorded</p>
          ) : (
            <div className="space-y-1">
              {run.transactions.map((t) => {
                const left = (t.begin / span) * 100;
                const width = (((t.end ?? span) - t.begin) / span) * 100;
                return (
                  <div key={t.handle} className="relative h-[5.5rem] rounded-md border border-dashed border-border/50">
                    <div
                      className={cn(
                        "absolute top-1 bottom-1 overflow-hidden rounded-md border px-1.5 py-1 font-mono text-[10.5px] leading-4 [font-variant-ligatures:none]",
                        t.end === null ? "border-dashed border-rose-500/70 bg-rose-500/10" : "border-cyan-500/70 bg-cyan-500/10",
                      )}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      <span className="block font-semibold">
                        #{t.handle} {t.end === null ? "▶ never closed" : `${t.begin}–${t.end} ns`}
                      </span>
                      {t.attributes.length ? (
                        t.attributes.map(([k, v]) => (
                          <span key={k} className="block truncate">
                            {k}={v}
                          </span>
                        ))
                      ) : (
                        <span className="block text-muted-foreground">no fields</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground" aria-hidden>
            {Array.from({ length: recordingItems.length + 1 }, (_, i) => (
              <span key={i}>{i * DRIVE_NS}</span>
            ))}
          </div>
        </div>
        <ul className="sr-only">
          {run.transactions.map((t) => (
            <li key={t.handle}>
              Transaction {t.handle} from {t.begin} ns to {t.end === null ? "never closed" : `${t.end} ns`}; {t.attributes.length ? t.attributes.map(([k, v]) => `${k} ${v}`).join(", ") : "no fields"}.
            </li>
          ))}
        </ul>
      </figure>
      <p aria-live="polite" className={cn("rounded-xl border p-3 text-sm", run.transactions.length && run.transactions[0].attributes.length ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10")}>
        <strong>{run.enabled ? "Recording on. " : "Recording off. "}</strong>
        {run.enableWhy} {run.verdict}
      </p>
    </div>
  );
}

/** Transaction recording explorer: what must be true for a driver's transactions to appear in the waveform database. */
export default function TransactionRecordingVisualizer() {
  const [setup, setSetup] = useState<RecordingSetup>({ enable: "default", impl: "do_record", callEndTr: true });
  const options = useMemo(() => recordingPredictionOptions(setup), [setup]);
  const update = (patch: Partial<RecordingSetup>) => setSetup((s) => ({ ...s, ...patch }));

  return (
    <VisualFrame
      label="UVM transaction recording explorer"
      eyebrow="Experiment"
      title="Why is my transaction stream empty?"
      summary="A driver brackets each item with begin_tr()/end_tr(). Three things decide what reaches the database: whether recording is enabled, what record() writes, and whether end_tr() runs."
      fidelity="model"
      assumptions={RECORDING_MODEL_ASSUMPTIONS}
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-[11px] text-muted-foreground">1. Enable recording on the driver</p>
          <SegmentedControl label="How recording is enabled" mono options={enableChoices} value={setup.enable} onChange={(enable) => update({ enable })} />
        </div>
        <div>
          <p className="mb-1 text-[11px] text-muted-foreground">2. What record() writes for bus_item</p>
          <SegmentedControl label="Recording implementation" mono options={implChoices} value={setup.impl} onChange={(impl) => update({ impl })} />
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={setup.callEndTr} onChange={(e) => update({ callEndTr: e.target.checked })} className="h-4 w-4 accent-cyan-500" />
          3. The driver calls <span className="font-mono [font-variant-ligatures:none]">end_tr(req)</span>
        </label>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <CodePanel label="Enable" lines={enableSource[setup.enable]} />
        <CodePanel label="bus_item" lines={implSource[setup.impl]} />
        <CodePanel label="pkt_driver" lines={driverSource(setup.callEndTr)} highlight={(l) => l.includes("begin_tr") || l.includes("end_tr")} />
      </div>

      <PredictionPrompt question="After three items (WRITE, READ, WRITE), what does the transaction stream show?" resetKey={JSON.stringify(setup)} options={options}>
        <StreamView setup={setup} />
      </PredictionPrompt>
    </VisualFrame>
  );
}
