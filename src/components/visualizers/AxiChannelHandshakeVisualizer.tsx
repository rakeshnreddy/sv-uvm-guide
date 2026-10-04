"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { CycleWaveform, type CycleMarker, type CycleSignal } from "@/components/visual-system/CycleWaveform";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  CHANNEL_INFO,
  CHANNEL_SCENARIOS,
  CHANNEL_SVA,
  HANDSHAKE_BASICS,
  answerEdge,
  explainEdgeChoice,
  simulateChannels,
  type ChannelName,
  type ChannelScenario,
  type ChannelTrace,
  type EdgeQuestion,
  type HandshakeScenarioSpec,
  type ProtocolRule,
} from "@/lib/axi-channel-model";
import { cn } from "@/lib/utils";

export const AXI_CHANNEL_ASSUMPTIONS = [
  "Edge k is the k-th rising ACLK edge; a value at edge k is what the receiver samples there (it changed just after edge k-1).",
  "Rules: handshake and stability (IHI0022E A3.2.1); W may precede AW (A3.3); RVALID after the AR handshake and, in AXI4, BVALID after the AW and WLAST handshakes (A3.3.1).",
  "Sources only wait for data to be available and for A3.3.1 dependencies; they never wait for READY. Reset is not modelled.",
  "READY patterns are free choices of the receiver; editing them never makes a trace illegal.",
];

const HINTS: Record<ProtocolRule, string[]> = {
  "valid-held": [
    "Find an edge where VALID is 1 and READY is 0.",
    "What must VALID be at the very next edge after such a stall?",
    "A3.2.1: once VALID is asserted it must remain asserted until the handshake.",
  ],
  "payload-stable": ["Find a stall (VALID 1, READY 0).", "Compare the payload before and after the stall.", "A3.2.1: the source keeps its information stable until the transfer."],
  "b-after-aw-and-wlast": [
    "List the edges where the AW handshake and the WLAST handshake happen.",
    "Now find the first edge where BVALID is 1.",
    "AXI4 (A3.3.1): BVALID needs both handshakes at earlier edges, not just WLAST.",
  ],
  "r-after-ar": ["Where is the AR handshake?", "Where does RVALID first rise?", "A3.3.1: RVALID only after ARVALID and ARREADY."],
};

/** Mounted only inside the revealed part of the prompt, so the parent knows when to show answers. */
function RevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

function withReady(base: ChannelScenario, overrides: Partial<Record<ChannelName, number[]>>): ChannelScenario {
  const channels = { ...base.channels };
  for (const [c, bits] of Object.entries(overrides) as [ChannelName, number[]][]) {
    const plan = channels[c];
    if (plan) channels[c] = { ...plan, ready: { kind: "pattern", bits } };
  }
  return { ...base, channels };
}

function waveSignals(trace: ChannelTrace, hidden: ChannelName | null): CycleSignal[] {
  const out: CycleSignal[] = [{ name: "ACLK", kind: "clock" }];
  for (const c of trace.channels) {
    const s = trace.signals[c];
    if (!s) continue;
    const info = CHANNEL_INFO[c];
    if (c !== hidden) out.push({ name: `${c}VALID`, kind: "bit", values: s.valid });
    out.push({ name: `${c}READY`, kind: "bit", values: s.ready, editable: true });
    if (c !== hidden) {
      out.push({ name: info.payload, kind: "bus", values: s.payload });
      if (info.last && s.last) out.push({ name: info.last, kind: "bit", values: s.last });
    }
  }
  return out;
}

function markersFor(trace: ChannelTrace): CycleMarker[] {
  const out: CycleMarker[] = [];
  for (let edge = 0; edge < trace.edges; edge += 1) {
    const bad = trace.violations.filter((v) => v.edge === edge);
    const hs = trace.handshakes.filter((h) => h.edge === edge);
    if (bad.length) out.push({ edge, tone: "fail", label: `Edge ${edge}: ${bad.map((b) => b.message).join(" ")}`, short: bad.map((b) => b.channel).join("+") });
    else if (hs.length)
      out.push({ edge, tone: "pass", label: `Edge ${edge}: handshake on ${hs.map((h) => `${h.channel} (${h.item.label})`).join(", ")}`, short: hs.map((h) => h.channel).join("+") });
  }
  return out;
}

function EdgeNarration({ trace, edge }: { trace: ChannelTrace; edge: number }) {
  const events = trace.events.filter((e) => e.edge === edge);
  const bad = trace.violations.filter((v) => v.edge === edge);
  return (
    <div aria-live="polite" className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm">
      <p className="mb-1 font-semibold text-foreground">Edge {edge}</p>
      {events.length === 0 && bad.length === 0 ? <p className="text-muted-foreground">Nothing happens on any channel.</p> : null}
      <ul className="space-y-1">
        {events.map((e, i) => (
          <li key={i} className={cn(e.kind === "handshake" ? "text-emerald-800 dark:text-emerald-200" : e.kind === "fault" ? "text-rose-800 dark:text-rose-200" : "text-foreground/90")}>
            <span aria-hidden>{e.kind === "handshake" ? "✓ " : e.kind === "stall" ? "⏸ " : e.kind === "dependency-wait" ? "… " : "✕ "}</span>
            <strong className="font-mono">{e.channel}</strong> {e.text} {e.clause ? <span className="text-xs text-muted-foreground">({e.clause})</span> : null}
          </li>
        ))}
        {bad.map((v, i) => (
          <li key={`v${i}`} className="text-rose-800 dark:text-rose-200">
            ✕ <strong>Violation</strong> ({v.clause}): {v.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  /** "handshake": one channel, basic VALID/READY timing. "channels": cross-channel rules. */
  focus?: "handshake" | "channels";
}

export default function AxiChannelHandshakeVisualizer({ focus = "channels" }: Props) {
  const specs: HandshakeScenarioSpec[] = focus === "handshake" ? HANDSHAKE_BASICS : CHANNEL_SCENARIOS;
  const [specId, setSpecId] = useState(specs[0].id);
  const [overrides, setOverrides] = useState<Partial<Record<ChannelName, number[]>>>({});
  const [revealed, setRevealed] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [checked, setChecked] = useState<number | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const onReveal = useCallback((v: boolean) => setRevealed(v), []);

  const spec = specs.find((s) => s.id === specId) ?? specs[0];
  const scenario = useMemo(() => withReady(spec.scenario, overrides), [spec, overrides]);
  const trace = useMemo(() => simulateChannels(scenario), [scenario]);
  const key = `${spec.id}|${JSON.stringify(overrides)}`;
  const spot = spec.question.kind === "spot-violation";
  const question = spec.question.kind === "spot-violation" ? null : (spec.question as EdgeQuestion);
  const answer = question ? answerEdge(trace, question) : null;
  const firstViolation = trace.violations[0] ?? null;
  const found = spot && checked !== null && firstViolation !== null && checked === firstViolation.edge;
  const showAnswers = spot ? found || gaveUp || firstViolation === null : revealed;
  const hidden = question && question.kind === "first-valid" && !revealed ? question.channel : null;

  const reset = (id: string) => {
    setSpecId(id);
    setOverrides({});
    setCursor(undefined);
    setChecked(null);
    setGaveUp(false);
  };

  const toggle = (signal: string, edge: number) => {
    const c = signal.replace(/READY$/, "") as ChannelName;
    const current = trace.signals[c]?.ready ?? [];
    setOverrides((o) => ({ ...o, [c]: current.map((b, k) => (k === edge ? (b ? 0 : 1) : b)) }));
    setChecked(null);
    setGaveUp(false);
  };

  const options: PredictionOption[] = useMemo(() => {
    if (!question) return [];
    const edges = Array.from(new Set([...(answer === null ? [] : [answer]), ...(spec.distractors ?? [])]))
      .filter((e) => e >= 0 && e < trace.edges)
      .sort((a, b) => a - b);
    const opts: PredictionOption[] = edges.map((e) => {
      const { correct, feedback } = explainEdgeChoice(trace, question, e);
      return { id: String(e), label: `Edge ${e}`, correct, feedback };
    });
    if (answer === null) opts.push({ id: "none", label: `Not within these ${trace.edges} edges`, correct: true, feedback: "With these READY values the transfer never completes inside the window." });
    return opts;
  }, [question, answer, spec, trace]);

  const rules = focus === "handshake" ? CHANNEL_SVA.filter((r) => r.key === "valid-held" || r.key === "payload-stable") : CHANNEL_SVA;
  const codeLines: CodeTraceLine[] = rules.flatMap((r) => [...r.lines.map((text) => ({ text, key: r.key, owner: "testbench" as const })), { text: "" }]);
  const violatedRule = showAnswers ? firstViolation?.rule : undefined;
  const narrationEdge = cursor ?? (spot ? firstViolation?.edge : answer) ?? 0;

  return (
    <div data-testid={focus === "handshake" ? "axi-handshake-basics" : "axi-channel-handshake-visualizer"}>
      <VisualFrame
        label={focus === "handshake" ? "AXI VALID/READY handshake explorer" : "AXI five-channel dependency explorer"}
        eyebrow={spot ? "Debug it" : "Predict, then experiment"}
        title={focus === "handshake" ? "Which edge completes the handshake?" : "What may happen before what across the five channels?"}
        summary={
          <>
            {spec.summary} Click any <span className="font-mono">READY</span> cell to change the receiver&apos;s choice; the model re-runs.
          </>
        }
        fidelity="model"
        assumptions={AXI_CHANNEL_ASSUMPTIONS}
      >
        <SegmentedControl label="Scenario" options={specs.map((s) => ({ value: s.id, label: s.title }))} value={spec.id} onChange={reset} />

        <CycleWaveform
          title={`${spec.title} waveform`}
          signals={waveSignals(trace, hidden)}
          edges={trace.edges}
          markers={showAnswers ? markersFor(trace) : []}
          cursor={showAnswers || spot ? cursor : undefined}
          onToggle={toggle}
          onSelectEdge={showAnswers || spot ? (e) => setCursor(e) : undefined}
          caption={`x-axis: ACLK rising edges 0 to ${trace.edges - 1}. Each value is the one sampled at that edge. ✓ marks a handshake, ✕ a protocol violation.${
            hidden ? ` ${hidden}VALID and its payload are hidden until you predict.` : ""
          }`}
        />

        {question ? (
          <PredictionPrompt question={spec.prompt} options={options} resetKey={key}>
            <RevealSignal onChange={onReveal} />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Select any edge on the axis to read what happens there and why.</p>
              <EdgeNarration trace={trace} edge={narrationEdge} />
            </div>
          </PredictionPrompt>
        ) : (
          <div className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-500/[0.05] p-4">
            <p className="text-sm font-semibold text-foreground">{spec.prompt}</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Selected: {cursor === undefined ? "none (use the edge numbers under the waveform)" : `edge ${cursor}`}</span>
              <button
                type="button"
                disabled={cursor === undefined}
                onClick={() => setChecked(cursor ?? null)}
                className="inline-flex h-10 items-center rounded-lg bg-rose-500 px-4 text-sm font-semibold text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Check this edge
              </button>
              {!found && !gaveUp ? (
                <button type="button" onClick={() => setGaveUp(true)} className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Show the answer
                </button>
              ) : null}
            </div>
            <div aria-live="polite" className="text-sm">
              {firstViolation === null ? (
                <p className="text-emerald-700 dark:text-emerald-300">✓ With your READY changes this trace is legal: the model finds no violation.</p>
              ) : found || gaveUp ? (
                <p className={found ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}>
                  <strong>{found ? "Found it. " : `The first violation is at edge ${firstViolation.edge}. `}</strong>
                  {firstViolation.message} ({firstViolation.clause})
                </p>
              ) : checked !== null ? (
                <p className="text-rose-700 dark:text-rose-300">
                  <strong>Edge {checked} is legal. </strong>
                  {trace.events
                    .filter((e) => e.edge === checked)
                    .map((e) => e.text)
                    .join(" ") || "Nothing happens there."}
                </p>
              ) : null}
            </div>
            {firstViolation && !found && !gaveUp ? <HintLadder hints={HINTS[firstViolation.rule]} resetKey={key} /> : null}
            {showAnswers && firstViolation ? <EdgeNarration trace={trace} edge={narrationEdge} /> : null}
          </div>
        )}

        <CodeTrace label="SVA that checks these rules (violated property highlighted)" lines={codeLines} activeKey={violatedRule} />
        {focus === "channels" ? (
          <p className="text-xs text-muted-foreground">
            The counters <span className="font-mono">aw_done</span>, <span className="font-mono">wlast_done</span>, <span className="font-mono">b_done</span>,{" "}
            <span className="font-mono">ar_done</span> and <span className="font-mono">rlast_done</span> each add 1 at every edge where their handshake happens.
          </p>
        ) : null}
        {revealed && !spot && question ? (
          <p className="text-xs text-muted-foreground">
            Rule in play: {question.kind === "first-valid" ? "A3.3.1 dependencies between channels" : "A3.2.1 handshake"}; the {CHANNEL_INFO[question.channel].title.toLowerCase()} channel is driven by the{" "}
            {CHANNEL_INFO[question.channel].source}.
          </p>
        ) : null}
      </VisualFrame>
    </div>
  );
}
