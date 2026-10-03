"use client";

import React, { useMemo, useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode } from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { CycleWaveform, type CycleMarker, type CycleSignal } from "@/components/visual-system/CycleWaveform";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  DEFAULT_COORD_CONFIG,
  VC_ITEMS,
  irqPassive,
  resetHandlingLabels,
  resetHandlingSource,
  runCoordination,
  variantLabels,
  vcNs,
  vseqSource,
  type CoordConfig,
  type ResetHandling,
  type VcOutcome,
  type VcResult,
  type VseqVariant,
} from "@/lib/vseq-coordination-model";
import { cn } from "@/lib/utils";

export const COORDINATION_MODEL_ASSUMPTIONS = [
  "DUT: data is accepted only while CTRL.EN = 1; cfg_seq writes SRC then CTRL.EN (two APB writes, 4 cycles). Accepted data comes out 2 cycles later. Reset clears EN and discards data in flight.",
  "The scoreboard predicts one output per item the input monitor sees (it does not model EN), drains for up to 40 ns after the test drops its objection, then checks leftovers and that all 6 planned items were sent.",
  "Join semantics follow IEEE 1800-2023 §9.3.2. When the last objection drops, run_phase ends and its forked sequence threads are killed. uvm_event::wait_on returns at once if the event already fired (1800.2-2020 §10.1.1.2.2).",
  "PH_TIMEOUT uses the uvm-core default of 9200 s; the SEQ fatal text is from src/seq/uvm_sequence_base.svh. Time is in 10 ns cycles.",
  "Not modelled: sequencer arbitration, lock/grab, phase jumping, interrupts beyond the background responder.",
];

const outcomeLabels: Record<VcOutcome, string> = {
  pass: "PASS: all 6 items reach the scoreboard",
  missing: "Some items are lost in the DUT: check_phase reports MISSING",
  count: "Fewer than 6 items are ever sent: the count check fails",
  hang: "The test never ends: UVM_FATAL [PH_TIMEOUT]",
  fatal: "UVM_FATAL [SEQ] at the first start_item",
};

const shortLane: Record<string, string> = {
  body: "body()",
  "cfg thread": "T cfg",
  "data thread": "T data",
  "irq thread": "T irq",
  "main thread": "T main",
};

function outcomeOptions(r: VcResult): PredictionOption[] {
  const o = r.outcome;
  const miscon: Record<VcOutcome, string> = {
    pass: "That needs every item sent after CTRL.EN = 1, body() to return, and nothing cut short.",
    missing: "Losing items needs data to reach the DUT before it is configured (or during reset).",
    count: "A short count needs body() to return while data_seq is still running.",
    hang: "A hang needs a join that waits for a thread that never ends.",
    fatal: "A fatal needs a sequence started on a null sequencer.",
  };
  return (Object.keys(outcomeLabels) as VcOutcome[]).map((id) => ({
    id,
    label: outcomeLabels[id],
    correct: id === o,
    feedback: id === o ? r.why : `${miscon[id]} Here: ${r.why}`,
  }));
}

function CoordinationTopology({ variant }: { variant: VseqVariant }) {
  const passive = irqPassive(variant);
  const nodes: DiagramNode[] = [
    { id: "env", label: "env", kind: "env", x: 6, y: 6, w: 628, h: 228, container: true },
    { id: "vsqr", label: "v_sqr", sublabel: "virtual sequencer", kind: "sequencer", x: 230, y: 30, w: 180, h: 50 },
    { id: "apb_agt", label: "apb_agt", kind: "agent", x: 20, y: 104, w: 190, h: 116, container: true, badge: "active" },
    { id: "data_agt", label: "data_agt", kind: "agent", x: 225, y: 104, w: 190, h: 116, container: true, badge: "active" },
    { id: "irq_agt", label: "irq_agt", kind: "agent", x: 430, y: 104, w: 190, h: 116, container: true, badge: passive ? "passive" : "active" },
    { id: "apb_sqr", label: "sqr", kind: "sequencer", x: 32, y: 130, w: 76, h: 40 },
    { id: "apb_drv", label: "drv", kind: "driver", x: 120, y: 130, w: 76, h: 40 },
    { id: "data_sqr", label: "sqr", kind: "sequencer", x: 237, y: 130, w: 76, h: 40 },
    { id: "data_drv", label: "drv", kind: "driver", x: 325, y: 130, w: 76, h: 40 },
    { id: "irq_mon", label: "mon", kind: "monitor", x: 530, y: 176, w: 76, h: 36 },
  ];
  if (!passive) {
    nodes.push({ id: "irq_sqr", label: "sqr", kind: "sequencer", x: 442, y: 130, w: 76, h: 40 }, { id: "irq_drv", label: "drv", kind: "driver", x: 530, y: 130, w: 76, h: 40 });
  }
  const edges: DiagramEdge[] = [
    { id: "h-apb", from: "vsqr", to: "apb_sqr", style: "control", label: "apb_sqr", points: [[70, 92]] },
    { id: "h-data", from: "vsqr", to: "data_sqr", style: "control", label: "data_sqr" },
    passive
      ? { id: "h-irq", from: "vsqr", to: "irq_agt", style: "control", label: "irq_sqr = null", state: "error", points: [[525, 55]] }
      : { id: "h-irq", from: "vsqr", to: "irq_sqr", style: "control", label: "irq_sqr", points: [[480, 92]] },
    { id: "apb", from: "apb_sqr", to: "apb_drv", style: "data" },
    { id: "data", from: "data_sqr", to: "data_drv", style: "data" },
  ];
  if (!passive) edges.push({ id: "irq", from: "irq_sqr", to: "irq_drv", style: "data" });
  return (
    <BlockDiagram
      title={`Environment: virtual sequencer with handles to apb, data and irq sequencers.${passive ? " irq_agt is passive, so it has no sequencer and v_sqr.irq_sqr is null." : ""}`}
      width={640}
      minWidth={480}
      height={240}
      nodes={nodes}
      edges={edges}
    />
  );
}

function CoordinationWave({ result }: { result: VcResult }) {
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const signals: CycleSignal[] = [
    { name: "clk", kind: "clock" },
    { name: "rst_n", kind: "bit", values: result.cycles.map((c) => c.rst_n) },
    { name: "apb", kind: "bus", values: result.cycles.map((c) => c.apb) },
    { name: "EN", kind: "bit", values: result.cycles.map((c) => c.en) },
    { name: "din", kind: "bus", values: result.cycles.map((c) => c.din) },
    { name: "dout", kind: "bus", values: result.cycles.map((c) => c.dout) },
    { name: "objection", kind: "bit", values: result.cycles.map((c) => c.objection) },
    ...result.lanes.map((l) => ({ name: shortLane[l.name] ?? l.name, kind: "bus" as const, values: l.values })),
  ];
  const markers: CycleMarker[] = result.cycles.flatMap((c): CycleMarker[] => {
    const fail = c.notes.find((n) => n.includes("dropped") || n.includes("UVM_FATAL") || n.includes("after the run ended"));
    if (fail) return [{ edge: c.t, tone: "fail", label: `cycle ${c.t}: ${c.notes.join("; ")}` }];
    if (c.notes.some((n) => n.includes("matched"))) return [{ edge: c.t, tone: "pass", label: `cycle ${c.t}: ${c.notes.join("; ")}` }];
    if (c.notes.length) return [{ edge: c.t, tone: "info", label: `cycle ${c.t}: ${c.notes.join("; ")}` }];
    return [];
  });
  const stop = result.runEnd ?? result.fatalAt;
  const selected = cursor !== undefined ? result.cycles[cursor] : undefined;
  return (
    <div className="space-y-2">
      <CycleWaveform
        title="Virtual sequence timeline"
        signals={signals}
        edges={result.edges}
        markers={markers}
        cursor={cursor}
        onSelectEdge={setCursor}
        cycleWidth={40}
        highlights={stop !== null ? [{ from: Math.min(stop + 1, result.edges - 1), to: result.edges - 1, tone: "fail", label: "run phase over" }] : []}
        caption={`x-axis: clock cycles of 10 ns (cycle k starts at k × 10 ns); each column shows what is on the bus in that cycle. ✓ item matched at the output, ✕ item lost or fatal, ● other event. Select a cycle number to read what happened.${
          result.outcome === "hang" ? " The run continues past the right edge until the 9200 s watchdog." : ""
        }`}
      />
      <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/[0.06] p-3 text-sm" aria-live="polite">
        {selected ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              cycle {selected.t} · {vcNs(selected.t)}
            </p>
            <p className="mt-1 text-foreground">{selected.notes.length ? selected.notes.join(". ") + "." : "Nothing changes in this cycle."}</p>
          </>
        ) : (
          <p className="text-muted-foreground">Select a cycle number under the waveform to read what happened in it.</p>
        )}
      </div>
    </div>
  );
}

function ItemsTable({ result }: { result: VcResult }) {
  const fateText: Record<string, string> = {
    matched: "✓ matched",
    "dropped-en": "✕ dropped (EN = 0)",
    "dropped-reset": "✕ lost in reset",
    flushed: "◌ flushed on reset",
    "not-observed": "✕ out after the run ended",
    cut: "✕ never sent",
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] border-collapse text-xs">
        <caption className="mb-1 text-left text-[11px] text-muted-foreground">The {VC_ITEMS} planned data items</caption>
        <thead>
          <tr>
            {["Item", "Sent", "Fate", "Why"].map((h) => (
              <th key={h} scope="col" className="border-b border-border p-1.5 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.items.map((it) => (
            <tr key={it.name}>
              <th scope="row" className="border-b border-border/60 p-1.5 text-left font-mono">
                {it.name}
              </th>
              <td className="border-b border-border/60 p-1.5 font-mono">{it.driven === null ? "—" : vcNs(it.driven)}</td>
              <td className={cn("border-b border-border/60 p-1.5 whitespace-nowrap", it.fate === "matched" || it.fate === "flushed" ? "text-foreground" : "font-semibold text-rose-700 dark:text-rose-300")}>
                {fateText[it.fate]}
              </td>
              <td className="border-b border-border/60 p-1.5 text-muted-foreground">{it.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunReveal({ result }: { result: VcResult }) {
  return (
    <div className="space-y-4">
      <div aria-live="polite" className={cn("rounded-xl border p-3 text-sm", result.outcome === "pass" ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10")}>
        <p className="font-semibold text-foreground">
          <span aria-hidden className="mr-1.5">
            {result.outcome === "pass" ? "✓" : "✕"}
          </span>
          {result.summary}
        </p>
        <p className="mt-1 text-foreground/90">{result.why}</p>
      </div>
      <CoordinationWave key={JSON.stringify(result.config)} result={result} />
      <ItemsTable result={result} />
      <pre className="overflow-x-auto rounded-xl bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]" aria-label="Simulation log">
        {result.log.join("\n")}
      </pre>
    </div>
  );
}

const MAIN_VARIANTS: VseqVariant[] = ["sequential", "fork-join", "fork-event", "background-join", "passive-irq-seq"];

function CoordinationExplorer() {
  const [config, setConfig] = useState<CoordConfig>(DEFAULT_COORD_CONFIG);
  const [advanced, setAdvanced] = useState(false);
  const result = useMemo(() => runCoordination(config), [config]);
  const configKey = JSON.stringify(config);
  const lines: CodeTraceLine[] = [
    ...vseqSource(config.variant).map((l) => ({ text: l.text, key: l.key, owner: "testbench" as const })),
    ...(config.reset ? [{ text: "" }, ...resetHandlingSource(config.resetHandling).map((l) => ({ text: l.text, key: l.key, owner: "testbench" as const }))] : []),
  ];

  return (
    <VisualFrame
      label="Virtual sequence coordination experiment"
      eyebrow="Experiment"
      title="Configure first, then send: who enforces the order?"
      summary="One virtual sequence drives an APB config agent and a data agent; an interrupt agent sits beside them. Pick the body() structure, predict the result, then read the timeline cycle by cycle."
      fidelity="model"
      assumptions={COORDINATION_MODEL_ASSUMPTIONS}
    >
      <div>
        <p className="mb-1 text-xs font-semibold text-foreground">Virtual sequence body()</p>
        <SegmentedControl<VseqVariant>
          label="Virtual sequence body"
          value={config.variant}
          onChange={(v) => setConfig((c) => ({ ...c, variant: v }))}
          options={MAIN_VARIANTS.map((v) => ({ value: v, label: variantLabels[v] }))}
        />
      </div>
      <div>
        <button
          type="button"
          aria-expanded={advanced}
          onClick={() => setAdvanced((a) => !a)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {advanced ? "Hide advanced: reset in the middle of traffic" : "Show advanced: reset in the middle of traffic"}
        </button>
        {advanced ? (
          <div className="mt-2 grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            <label className="flex min-h-10 items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={config.reset} onChange={(e) => setConfig((c) => ({ ...c, reset: e.target.checked }))} className="h-4 w-4 accent-cyan-500" />
              Assert rst_n at 80 ns for 20 ns
            </label>
            <div>
              <p className="mb-1 text-xs font-semibold text-foreground">Testbench reset handling</p>
              <SegmentedControl<ResetHandling>
                label="Testbench reset handling"
                value={config.resetHandling}
                onChange={(v) => setConfig((c) => ({ ...c, resetHandling: v }))}
                options={(["none", "flush", "restart"] as ResetHandling[]).map((h) => ({ value: h, label: resetHandlingLabels[h], disabled: !config.reset }))}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <CodeTrace label="soc_vseq body() (generated from the model)" lines={lines} className="min-w-0" />
        <div className="min-w-0">
          <CoordinationTopology variant={config.variant} />
        </div>
      </div>

      <PredictionPrompt question={`With “${variantLabels[config.variant]}”${config.reset ? ` and a reset at 80 ns (${resetHandlingLabels[config.resetHandling]})` : ""}, what does the run report?`} options={outcomeOptions(result)} resetKey={configKey}>
        <RunReveal result={result} />
      </PredictionPrompt>
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------------- */
/* Debug challenge: the virtual sequence that never returns                   */
/* ------------------------------------------------------------------------- */

const vcSuspects: { key: string; verdict: "culprit" | "innocent"; feedback: string }[] = [
  {
    key: "join",
    verdict: "culprit",
    feedback:
      "Yes. fork…join waits for every branch, and the irq branch runs irq_seq, which never ends. body() never returns, so the test never drops its objection.",
  },
  {
    key: "irq_seq",
    verdict: "innocent",
    feedback: "The background responder is legitimate: it must answer interrupts for the whole test. The bug is that something waits for it to finish.",
  },
  {
    key: "wait",
    verdict: "innocent",
    feedback: "wait_on returns as soon as cfg_done has fired (or at once if it already has). The data thread finishes at 110 ns; look for what is still running after that.",
  },
  {
    key: "trigger",
    verdict: "innocent",
    feedback: "The trigger fires at 50 ns and releases the data thread. Nothing waits on it after that.",
  },
];

const vcFixes: { variant: VseqVariant; label: string; review: string }[] = [
  { variant: "background-join-any", label: "Change join to join_any", review: "join_any returns when the first branch ends, which is the config thread at 50 ns. The test ends while data_seq is still sending." },
  { variant: "background-join-none", label: "Change join to join_none", review: "join_none returns at once. The test drops its objection at 10 ns and the run ends before anything is sent." },
  {
    variant: "background-isolated",
    label: "Fork the irq sequence in its own fork…join_none, keep cfg and data in fork…join",
    review: "Accepted. body() waits for the foreground work only; the background responder keeps running until the run phase ends.",
  },
];

function CoordinationDebugChallenge() {
  const buggy = useMemo(() => runCoordination({ variant: "background-join", reset: false, resetHandling: "none" }), []);
  const lines: CodeTraceLine[] = vseqSource("background-join").map((l) => ({ text: l.text, key: l.key, owner: "testbench" }));
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fix, setFix] = useState<VseqVariant | null>(null);
  const chosen = vcSuspects.find((s) => s.key === suspect);
  const found = chosen?.verdict === "culprit";
  const fixResult = fix ? runCoordination({ variant: fix, reset: false, resetHandling: "none" }) : null;
  const fixInfo = vcFixes.find((f) => f.variant === fix);
  const firstOfKey = (line: CodeTraceLine) => lines.find((l) => l.key === line.key) === line;

  return (
    <VisualFrame
      label="Virtual sequence debugging challenge"
      eyebrow="Debug it"
      title="The test that never ends"
      summary="Every data item matched, yet the regression job is killed by the watchdog. Find the line, then choose a fix; the model reruns the virtual sequence."
      fidelity="model"
      assumptions={COORDINATION_MODEL_ASSUMPTIONS}
    >
      <pre className="overflow-x-auto rounded-xl bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]" aria-label="Failing log">
        {[
          `UVM_INFO  @ ${vcNs(buggy.items[buggy.items.length - 1].out ?? 0)} [SCB] ${buggy.items.filter((i) => i.fate === "matched").length} of ${VC_ITEMS} items matched`,
          ...buggy.log.filter((l) => l.includes("FATAL")),
        ].join("\n")}
      </pre>
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Step 1: select the line that keeps body() from returning</p>
        <CodeTrace
          label="soc_vseq body()"
          lines={lines}
          activeKey={suspect ?? undefined}
          renderLineControl={(line) =>
            vcSuspects.some((s) => s.key === line.key) && firstOfKey(line) ? (
              <button
                type="button"
                aria-pressed={suspect === line.key}
                aria-label={`Suspect line: ${line.text.trim()}`}
                onClick={() => setSuspect(line.key as string)}
                className={cn(
                  "min-h-7 rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                  suspect === line.key ? "border-amber-400 bg-amber-400/20 text-amber-100" : "border-slate-500 text-slate-300 hover:bg-white/10",
                )}
              >
                {suspect === line.key ? "suspected" : "suspect"}
              </button>
            ) : null
          }
        />
        {chosen ? (
          <p aria-live="polite" className={cn("mt-2 text-sm", found ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
            <strong>{found ? "Found it. " : "Not this one. "}</strong>
            {chosen.feedback}
          </p>
        ) : null}
        {!found ? (
          <HintLadder
            className="mt-2"
            hints={[
              "The test drops its objection after vseq.start() returns. What has to happen for body() to return?",
              "List the three fork branches. Which ones ever finish?",
              "Which kind of join waits for all of them?",
            ]}
          />
        ) : null}
      </div>
      {found ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">Step 2: choose a fix; the model reruns the virtual sequence</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {vcFixes.map((f) => (
              <label key={f.variant} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fix === f.variant ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}>
                <input type="radio" name="vc-fix" checked={fix === f.variant} onChange={() => setFix(f.variant)} className="mt-1 accent-cyan-500" />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
          {fixResult && fixInfo ? (
            <div aria-live="polite" className={cn("mt-3 space-y-2 rounded-xl border p-3 text-sm", fixResult.outcome === "pass" ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10")}>
              <p className="font-semibold text-foreground">Model: {fixResult.summary}</p>
              <p className="text-foreground/90">
                <strong>Review: </strong>
                {fixInfo.review}
              </p>
              {fixResult.outcome === "pass" ? (
                <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] text-slate-100 [font-variant-ligatures:none]">
                  {vseqSource(fixInfo.variant)
                    .map((l) => l.text)
                    .join("\n")}
                </pre>
              ) : null}
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </VisualFrame>
  );
}

/**
 * Multi-agent coordination: virtual sequence ordering (config before data),
 * fork variants, a passive agent's null sequencer, and reset mid-traffic.
 * `mode="debug"` is the hanging fork…join challenge.
 */
export default function MultiAgentCoordinationVisualizer({ mode = "explore" }: { mode?: "explore" | "debug" }) {
  return mode === "debug" ? <CoordinationDebugChallenge /> : <CoordinationExplorer />;
}
