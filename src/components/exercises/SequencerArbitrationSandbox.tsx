"use client";

import React, { useMemo, useState } from "react";

import { QueueChips, UvmLog } from "@/components/diagrams/AnimatedUvmSequenceDriverHandshakeDiagram";
import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { useExerciseProgress } from "@/hooks/useExerciseProgress";
import {
  ARB_MODE_INFO,
  ARB_MODES,
  arbitrationScenario,
  arbitrationSource,
  DEFAULT_DRIVER,
  firstContestedDecision,
  sampleDecisionWinners,
  simulateSequencer,
  type ArbDecision,
  type ArbitrationPresetId,
  type ArbMode,
  type SeqOp,
  type SequencerRun,
  type SequencerScenario,
  type SequenceSpec,
} from "@/lib/uvm-sequencer-model";
import { cn } from "@/lib/utils";

export const ARBITRATION_ASSUMPTIONS = [
  "Follows uvm-core 2020.3.1 uvm_sequencer_base: m_choose_next_request(), grant_queued_locks(), is_blocked(), m_lock_req().",
  "Arbitration runs only when the driver calls get_next_item(); each item takes 10 ns to drive.",
  "Start times are staggered by 1 ns so the queue order is explicit. Requests made at exactly the same time are queued in a simulator-dependent order.",
  "Random modes use a seeded generator, not $urandom: the odds match, the exact picks do not. SEQ_ARB_USER and is_relevant() are not modelled.",
  "In uvm-core a lock() is granted as soon as no other lock or grab blocks it, although it is pushed to the back of the queue. The model follows that code.",
];

interface SeqForm {
  priority: number;
  startAt: number;
  items: number;
  take: "none" | "lock" | "grab";
  release: boolean;
  waitNs: number;
}

const IDS = ["A", "B", "C"] as const;
const PRIORITIES = [50, 100, 200, 300, 500];
const STARTS = [0, 1, 2, 3, 4, 5];
const WAITS = [0, 20, 40];

function formFromSpec(spec: SequenceSpec): SeqForm {
  const take = spec.ops.find((o) => o.kind === "lock" || o.kind === "grab");
  const wait = spec.ops.find((o): o is { kind: "wait"; ns: number } => o.kind === "wait");
  return {
    priority: spec.priority,
    startAt: spec.startAt,
    items: spec.ops.filter((o) => o.kind === "item").length,
    take: take ? (take.kind as "lock" | "grab") : "none",
    release: spec.ops.some((o) => o.kind === "unlock" || o.kind === "ungrab"),
    waitNs: wait?.ns ?? 0,
  };
}

function specFromForm(id: string, form: SeqForm): SequenceSpec {
  const ops: SeqOp[] = [];
  if (form.take !== "none") ops.push({ kind: form.take });
  for (let i = 0; i < form.items; i += 1) ops.push({ kind: "item" });
  if (form.waitNs > 0) ops.push({ kind: "wait", ns: form.waitNs });
  if (form.take !== "none" && form.release) ops.push({ kind: form.take === "grab" ? "ungrab" : "unlock" });
  return { id, name: `seq_${id.toLowerCase()}`, priority: form.priority, startAt: form.startAt, ops };
}

interface PresetCopy {
  label: string;
  blurb: string;
  /** Curated question; otherwise one is generated from the model. */
  curated?: (run: SequencerRun) => { question: string; options: PredictionOption[] };
}

const PRESETS: Record<ArbitrationPresetId, PresetCopy> = {
  fifo: { label: "FIFO", blurb: "Three sequences, two items each. C has priority 300, but the sequencer uses the default FIFO rule." },
  strict_fifo: { label: "STRICT_FIFO", blurb: "The same three sequences with UVM_SEQ_ARB_STRICT_FIFO: priority now decides, FIFO only breaks ties." },
  weighted: { label: "WEIGHTED", blurb: "B has priority 300, A and C have 100. WEIGHTED draws a random winner, weighted by priority." },
  lock: {
    label: "lock()",
    blurb: "C queues an item at 3 ns. B calls lock() at 5 ns, sends two items, then unlock().",
    curated: () => ({
      question: "Who receives grant #2 at t = 10 ns?",
      options: [
        {
          id: "B",
          label: "B: its lock was granted at 5 ns, so every other request is blocked",
          correct: true,
          feedback: "grant_queued_locks() grants B's lock as soon as nobody else holds one. From 5 ns, is_blocked() is true for A and C, so B's request is the only candidate.",
        },
        {
          id: "C",
          label: "C: it queued at 3 ns, before B's lock request",
          correct: false,
          feedback: "That is what 'arbitrated like any other request' suggests, but uvm-core grants the lock immediately when no other lock blocks it. C's older request is skipped as blocked.",
        },
        {
          id: "A",
          label: "A: it keeps the sequencer until all three of its items are sent",
          correct: false,
          feedback: "A sequence never owns the sequencer between items unless it holds a lock. A's next request joins the back of the queue at 10 ns, and it is blocked by B's lock anyway.",
        },
      ],
    }),
  },
  forgot_unlock: {
    label: "Forgot unlock()",
    blurb: "B calls lock(), sends two items, then spends 40 ns on other work and returns from body() without unlock().",
    curated: () => ({
      question: "When does C get its first grant?",
      options: [
        {
          id: "70",
          label: "At 70 ns, when B's body() returns: UVM removes the lock with a SEQFINERR error",
          correct: true,
          feedback: "A lock is held until unlock(). B queues nothing from 30 to 70 ns, so the driver idles while A and C starve. When B exits, remove_sequence_from_queues() deletes the lock and reports SEQFINERR.",
        },
        {
          id: "30",
          label: "At 30 ns: the lock is released when B has no more items queued",
          correct: false,
          feedback: "There is no auto-release. The lock stays in lock_list while B is alive, even when B has nothing queued.",
        },
        {
          id: "never",
          label: "Never: the sequencer stays locked for the rest of the test",
          correct: false,
          feedback: "That happens only if B never finishes (for example a forever loop). When the owning sequence exits, the sequencer drops its lock and reports SEQFINERR.",
        },
        {
          id: "20",
          label: "At 20 ns: FIFO order ignores locks",
          correct: false,
          feedback: "Locks apply in every arbitration mode. m_choose_next_request() skips every request for which is_blocked() is true before the mode's rule is applied.",
        },
      ],
    }),
  },
  grab_vs_lock: {
    label: "grab vs lock",
    blurb: "A holds a lock until 30 ns. B calls lock() at 2 ns, C calls grab() at 4 ns. Both wait.",
    curated: () => ({
      question: "A unlocks at 30 ns. Who gets the sequencer next?",
      options: [
        {
          id: "C",
          label: "C: the grab request sits at the front of the queue",
          correct: true,
          feedback: "grab() uses push_front, so when A unlocks, grant_queued_locks() finds C's grab first. B's lock waits until C calls ungrab().",
        },
        {
          id: "B",
          label: "B: it asked first",
          correct: false,
          feedback: "Waiting locks are granted in queue order, and grab() jumps to the front of that queue regardless of when it was called.",
        },
        {
          id: "both",
          label: "Both: B holds the lock while C holds the grab",
          correct: false,
          feedback: "Locks and grabs share one lock_list. While one sequence is in it, every other sequence is blocked, including lock and grab requests.",
        },
      ],
    }),
  },
};

const PRESET_ORDER: ArbitrationPresetId[] = ["fifo", "strict_fifo", "weighted", "lock", "forgot_unlock", "grab_vs_lock"];

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Prediction generated from the model for edited or plain-mode scenarios. */
function generatedPrediction(scenario: SequencerScenario, run: SequencerRun): { question: string; options: PredictionOption[]; decision?: ArbDecision } {
  const decision = firstContestedDecision(run) ?? run.decisions[0];
  if (!decision) {
    return {
      question: "Will the driver receive any item?",
      options: [
        { id: "no", label: "No", correct: true, feedback: run.outcome.summary },
        { id: "yes", label: "Yes", correct: false, feedback: "No sequence ever reaches start_item() with an unblocked request." },
      ],
    };
  }
  const info = ARB_MODE_INFO[scenario.mode];
  if (info.random && decision.available > 1) {
    const live = decision.candidates.filter((c) => c.outcome === "won" || c.outcome === "lost");
    const target = [...live].sort((a, b) => b.chance - a.chance)[0];
    const spec = scenario.sequences.find((s) => s.id === target.seqId)!;
    const sum = live.reduce((s, c) => s + (scenario.sequences.find((x) => x.id === c.seqId)?.priority ?? 0), 0);
    const top = Math.max(...live.map((c) => scenario.sequences.find((x) => x.id === c.seqId)?.priority ?? 0));
    const topCount = live.filter((c) => scenario.sequences.find((x) => x.id === c.seqId)?.priority === top).length;
    const formulas = [
      { value: spec.priority / sum, why: "priority ÷ sum of the waiting priorities: the WEIGHTED rule." },
      { value: 1 / live.length, why: "1 ÷ number of unblocked requests: the RANDOM rule, which ignores priority." },
      { value: spec.priority === top ? 1 / topCount : 0, why: "1 ÷ size of the highest-priority group (0 if outranked): the STRICT_RANDOM rule." },
      { value: 1, why: "Always: only a non-random rule (FIFO or STRICT_FIFO) or a single candidate gives certainty." },
      { value: 0, why: "Never: only true when the request is blocked, or outranked under a STRICT mode." },
    ];
    const options: PredictionOption[] = [];
    for (const f of formulas) {
      const label = pct(f.value);
      const existing = options.find((o) => o.label === label);
      const correct = Math.abs(f.value - target.chance) < 1e-9;
      if (existing) {
        if (correct) existing.correct = true;
        continue;
      }
      options.push({ id: label, label, correct, feedback: `${label} is ${f.why}` });
      if (options.length === 4) break;
    }
    const right = options.find((o) => o.correct);
    if (right) right.feedback = `${right.feedback} ${target.reason}`;
    return {
      question: `${info.short}: at grant #${decision.index} (t = ${decision.time} ns) the unblocked requests are ${live
        .map((c) => `${c.seqId} (priority ${scenario.sequences.find((x) => x.id === c.seqId)?.priority})`)
        .join(", ")}. What is the chance that ${target.seqId} wins?`,
      options,
      decision,
    };
  }
  return {
    question: `${info.short}: which sequence receives grant #${decision.index} at t = ${decision.time} ns?`,
    options: decision.candidates.map((c) => ({
      id: c.seqId,
      label: `${c.seqId} (seq_${c.seqId.toLowerCase()}, priority ${scenario.sequences.find((s) => s.id === c.seqId)?.priority})`,
      correct: c.outcome === "won",
      feedback: c.reason,
    })),
    decision,
  };
}

const outcomeGlyph: Record<string, string> = { won: "✓", lost: "✕", blocked: "⊘", absent: "–" };
const rowColour: Record<string, string> = {
  A: "fill-sky-500/70",
  B: "fill-violet-500/70",
  C: "fill-emerald-500/70",
};

function GrantTimeline({ run, scenario }: { run: SequencerRun; scenario: SequencerScenario }) {
  const maxT = Math.max(10, run.outcome.time, ...run.driven.map((d) => d.end), ...run.lockSpans.map((l) => l.end ?? run.outcome.time));
  const W = 640;
  const left = 44;
  const rowH = 30;
  const top = 8;
  const H = top + scenario.sequences.length * rowH + 30;
  const x = (tt: number) => left + ((W - left - 12) * tt) / maxT;
  const ticks: number[] = [];
  const stepT = maxT > 120 ? 20 : 10;
  for (let tt = 0; tt <= maxT; tt += stepT) ticks.push(tt);
  const desc = run.decisions.map((d) => `${d.item} granted at ${d.time} ns`).join("; ");
  return (
    <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/50 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[300px]" role="img" aria-label={`Grant timeline: ${desc}`}>
        {scenario.sequences.map((s, row) => {
          const y = top + row * rowH;
          const locks = run.lockSpans.filter((l) => l.seqId === s.id);
          const waits = run.decisions
            .filter((d) => d.winner === s.id)
            .map((d) => ({ from: d.queue.find((q) => q.kind === "REQ" && q.seqId === s.id)?.queuedAt ?? d.time, to: d.time }));
          return (
            <g key={s.id}>
              <text x={6} y={y + 18} className="fill-foreground font-mono text-[11px] font-semibold">
                {s.id} p{s.priority}
              </text>
              <line x1={left} x2={W - 12} y1={y + rowH - 2} y2={y + rowH - 2} className="stroke-border" strokeWidth={0.6} />
              {locks.map((l, i) => (
                <g key={`l${i}`}>
                  <rect
                    x={x(l.start)}
                    y={y + 2}
                    width={Math.max(2, x(l.end ?? maxT) - x(l.start))}
                    height={rowH - 6}
                    rx={4}
                    className="fill-amber-500/10 stroke-amber-500"
                    strokeDasharray="4 3"
                  />
                  <text x={x(l.start) + 3} y={y + 11} className="fill-amber-700 text-[9px] font-bold dark:fill-amber-300">
                    {l.kind === "grab" ? "⚑ grab" : "🔒 lock"}
                  </text>
                </g>
              ))}
              {waits.map((w, i) =>
                w.to > w.from ? (
                  <line key={`w${i}`} x1={x(w.from)} x2={x(w.to)} y1={y + 20} y2={y + 20} className="stroke-muted-foreground" strokeDasharray="2 2" strokeWidth={1} />
                ) : null,
              )}
              {run.driven
                .filter((d) => d.seqId === s.id)
                .map((d, i) => (
                  <g key={`d${i}`}>
                    <rect x={x(d.start) + 0.5} y={y + 13} width={Math.max(2, x(d.end) - x(d.start) - 1)} height={13} rx={3} className={rowColour[s.id] ?? "fill-cyan-500/70"} />
                    <text x={(x(d.start) + x(d.end)) / 2} y={y + 23} textAnchor="middle" className="fill-slate-950 font-mono text-[9px] font-bold">
                      {d.item}
                    </text>
                  </g>
                ))}
            </g>
          );
        })}
        {ticks.map((tt) => (
          <g key={tt}>
            <line x1={x(tt)} x2={x(tt)} y1={top + scenario.sequences.length * rowH} y2={top + scenario.sequences.length * rowH + 4} className="stroke-muted-foreground" />
            <text x={x(tt)} y={top + scenario.sequences.length * rowH + 15} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {tt}
            </text>
          </g>
        ))}
        <text x={W - 12} y={H - 2} textAnchor="end" className="fill-muted-foreground text-[9px]">
          t (ns) · bar = item on the driver · dotted = waiting for a grant · dashed box = holds the lock
        </text>
      </svg>
    </div>
  );
}

function SequenceEditor({ id, form, onChange }: { id: string; form: SeqForm; onChange: (f: SeqForm) => void }) {
  const field = "h-10 w-full rounded-md border border-border/70 bg-background/70 px-2 text-sm text-foreground";
  const labelCls = "flex flex-col gap-1 text-xs text-muted-foreground";
  return (
    <fieldset className="min-w-0 rounded-xl border border-border/70 p-3">
      <legend className="px-1 text-sm font-semibold text-foreground">
        <span className="mr-1 rounded-full border border-amber-500/60 px-1.5 text-[9px] text-amber-800 dark:text-amber-200">SEQ</span>
        seq_{id.toLowerCase()} ({id})
      </legend>
      <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,110px),1fr))]">
        <label className={labelCls}>
          Priority
          <select className={field} value={form.priority} onChange={(e) => onChange({ ...form, priority: Number(e.target.value) })}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          start() at
          <select className={field} value={form.startAt} onChange={(e) => onChange({ ...form, startAt: Number(e.target.value) })}>
            {STARTS.map((s) => (
              <option key={s} value={s}>
                {s} ns
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Items
          <select className={field} value={form.items} onChange={(e) => onChange({ ...form, items: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Before items
          <select className={field} value={form.take} onChange={(e) => onChange({ ...form, take: e.target.value as SeqForm["take"] })}>
            <option value="none">nothing</option>
            <option value="lock">lock()</option>
            <option value="grab">grab()</option>
          </select>
        </label>
        <label className={labelCls}>
          Then wait
          <select className={field} value={form.waitNs} onChange={(e) => onChange({ ...form, waitNs: Number(e.target.value) })}>
            {WAITS.map((w) => (
              <option key={w} value={w}>
                {w === 0 ? "no wait" : `#${w}ns`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {form.take !== "none" ? (
        <label className="mt-2 flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-cyan-500" checked={form.release} onChange={(e) => onChange({ ...form, release: e.target.checked })} />
          <span>
            calls <code className="font-mono [font-variant-ligatures:none]">{form.take === "grab" ? "ungrab()" : "unlock()"}</code> at the end
          </span>
        </label>
      ) : null}
    </fieldset>
  );
}

function DecisionList({ run }: { run: SequencerRun }) {
  return (
    <ol className="space-y-2" aria-label="Arbitration decisions">
      {run.decisions.map((d) => (
        <li key={d.index} className="rounded-xl border border-border/70 bg-background/50 p-3">
          <p className="text-sm font-semibold text-foreground">
            Grant #{d.index} · t = {d.time} ns → <span className="font-mono">{d.item}</span>
            {d.draw ? <span className="ml-2 text-xs font-normal text-muted-foreground">(draw {d.draw.value} of 0..{d.draw.max})</span> : null}
          </p>
          <div className="mt-2">
            <QueueChips queue={d.queue} lockList={d.lockList} />
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {d.candidates.map((c) => (
              <li key={c.seqId} className={cn(c.outcome === "won" ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
                <span aria-hidden className="mr-1 font-mono">
                  {outcomeGlyph[c.outcome]}
                </span>
                <span className="sr-only">{c.outcome}: </span>
                {c.reason}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function SeedCheck({ scenario, decision }: { scenario: SequencerScenario; decision: ArbDecision }) {
  const N = 400;
  const counts = useMemo(() => sampleDecisionWinners(scenario, decision.index, N), [scenario, decision.index]);
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <p className="text-sm font-semibold text-foreground">
        Model check: grant #{decision.index} over {N} seeds
      </p>
      <ul className="mt-2 space-y-1.5">
        {decision.candidates
          .filter((c) => c.outcome === "won" || c.outcome === "lost")
          .map((c) => {
            const share = (counts[c.seqId] ?? 0) / N;
            return (
              <li key={c.seqId} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{c.seqId}</span>
                  <span className="text-muted-foreground">
                    observed {pct(share)} · rule says {pct(c.chance)}
                  </span>
                </div>
                <div className="mt-0.5 h-2 rounded bg-muted" aria-hidden>
                  <div className="h-2 rounded bg-cyan-500" style={{ width: `${share * 100}%` }} />
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

/**
 * Sequencer arbitration sandbox on the uvm-sequencer model: arbitration modes,
 * priorities, lock/grab and their release, with a prediction gate.
 */
const SequencerArbitrationSandbox: React.FC = () => {
  const [presetId, setPresetId] = useState<ArbitrationPresetId>("fifo");
  const [mode, setMode] = useState<ArbMode>(() => arbitrationScenario("fifo").mode);
  const [seed, setSeed] = useState(() => arbitrationScenario("fifo").seed);
  const [forms, setForms] = useState<SeqForm[]>(() => arbitrationScenario("fifo").sequences.map(formFromSpec));
  const [edited, setEdited] = useState(false);
  const { logInteraction, recordAttempt } = useExerciseProgress("sequencer-arbitration-sandbox");

  const loadPreset = (id: ArbitrationPresetId) => {
    const s = arbitrationScenario(id);
    setPresetId(id);
    setMode(s.mode);
    setSeed(s.seed);
    setForms(s.sequences.map(formFromSpec));
    setEdited(false);
    logInteraction();
  };

  const scenario: SequencerScenario = useMemo(
    () => ({ mode, seed, driver: { ...DEFAULT_DRIVER }, sequences: forms.map((f, i) => specFromForm(IDS[i], f)) }),
    [mode, seed, forms],
  );
  const run = useMemo(() => simulateSequencer(scenario), [scenario]);
  const info = ARB_MODE_INFO[mode];
  const preset = PRESETS[presetId];
  const prediction = useMemo(() => {
    if (!edited && preset.curated) return { ...preset.curated(run), decision: undefined };
    return generatedPrediction(scenario, run);
  }, [edited, preset, run, scenario]);

  // Random modes ask about odds, which do not depend on the seed.
  const configKey = JSON.stringify({ presetId, edited, mode, forms, seed: info.random ? 0 : seed });
  const code = useMemo(() => arbitrationSource(scenario).map((l) => ({ ...l, owner: "testbench" as const })), [scenario]);

  const edit = (i: number, f: SeqForm) => {
    setForms((prev) => prev.map((x, k) => (k === i ? f : x)));
    setEdited(true);
    logInteraction();
  };

  return (
    <VisualFrame
      label="Sequencer arbitration sandbox"
      eyebrow="Experiment"
      title="Sequencer arbitration sandbox"
      summary="Three sequences compete for one driver. Pick a scenario or edit the sequences, predict the grant, then read why the sequencer chose it."
      fidelity="model"
      assumptions={ARBITRATION_ASSUMPTIONS}
    >
      <SegmentedControl
        label="Arbitration scenario"
        options={PRESET_ORDER.map((p) => ({ value: p, label: PRESETS[p].label }))}
        value={presetId}
        onChange={loadPreset}
      />
      <p className="text-sm text-muted-foreground">
        {edited ? <strong className="text-foreground">Edited: </strong> : null}
        {edited ? "your own scenario. The question below is generated from the model." : preset.blurb}
      </p>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">set_arbitration()</p>
        <SegmentedControl
          label="Arbitration mode"
          mono
          options={ARB_MODES.map((m) => ({ value: m, label: ARB_MODE_INFO[m].short, ariaLabel: m }))}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setEdited(true);
            logInteraction();
          }}
        />
        <p className="text-sm text-foreground">
          <code className="font-mono text-[13px] [font-variant-ligatures:none]">{mode}</code>: {info.rule}
        </p>
        {info.random ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              Seed
              <input
                type="number"
                min={1}
                max={99999}
                value={seed}
                onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))}
                className="h-10 w-24 rounded-md border border-border/70 bg-background/70 px-2 font-mono text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => setSeed((s) => (s % 99999) + 1)}
              className="h-10 rounded-lg border border-border/70 px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Next seed
            </button>
            <span className="text-xs text-muted-foreground">Same seed, same picks. Change it to see another legal run.</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        {forms.map((f, i) => (
          <SequenceEditor key={IDS[i]} id={IDS[i]} form={f} onChange={(next) => edit(i, next)} />
        ))}
      </div>

      <CodeTrace label="Generated test and sequence bodies" lines={code} className="min-w-0" />

      <PredictionPrompt
        question={prediction.question}
        options={prediction.options}
        resetKey={configKey}
        onCommit={(_, correct) => recordAttempt(correct ? 100 : 0)}
      >
        <div className="space-y-4">
          <p
            aria-live="polite"
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium",
              run.outcome.kind === "complete" && !run.log.some((l) => l.severity === "ERROR")
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
            )}
          >
            Grant order: {run.decisions.map((d) => `${d.item}@${d.time}`).join(" → ") || "none"}. {run.outcome.summary}
          </p>
          <GrantTimeline run={run} scenario={scenario} />
          {info.random && prediction.decision && prediction.decision.available > 1 ? <SeedCheck scenario={scenario} decision={prediction.decision} /> : null}
          <UvmLog lines={run.log} />
          <details className="rounded-xl border border-border/70 p-3" open>
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Every arbitration decision, with the reason for each sequence</summary>
            <div className="mt-3">
              <DecisionList run={run} />
            </div>
          </details>
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
};

export default SequencerArbitrationSandbox;
