"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import {
  COMMON_PHASES,
  EXAMPLE_TREE,
  RUNTIME_PHASES,
  RUNTIME_PHASE_NAMES,
  childrenInVisitOrder,
  findPhase,
  formatTime,
  isTaskPhase,
  phaseCallOrder,
  phaseOrder,
  simulateRun,
  timeTicks,
  type ComponentNode,
  type PhaseDef,
  type PhaseOrder,
  type RunResult,
  type RunScenario,
  type RuntimePhaseName,
} from "@/lib/uvm-phase-model";
import { cn } from "@/lib/utils";

export const PHASE_TIMELINE_ASSUMPTIONS = [
  "Model of the uvm-core 2020.3.1 reference implementation of IEEE 1800.2-2020 (uvm_common_phases.svh, uvm_runtime_phases.svh, uvm_domain.svh, uvm_phase_hopper.svh).",
  "uvm_root, the traversal root, is not shown. Siblings are visited in instance-name order, as uvm-core stores children in m_children[string].",
  "Run-time scenarios use made-up durations; all components are in the default uvm domain. Phase jumps and extra domains are not modelled.",
];

const ORDER_GLYPH: Record<PhaseOrder, string> = { "top-down": "↓", "bottom-up": "↑", parallel: "∥" };
const ORDER_TEXT: Record<PhaseOrder, string> = {
  "top-down": "top-down (parent first)",
  "bottom-up": "bottom-up (children first)",
  parallel: "every component in parallel",
};

const PHASE_SNIPPET: Record<string, string> = {
  build: `function void build_phase(uvm_phase phase);
  super.build_phase(phase);  // auto-config of this component's fields
  scb = my_scoreboard::type_id::create("scb", this);
  agt = my_agent::type_id::create("agt", this);
endfunction`,
  connect: `function void connect_phase(uvm_phase phase);
  agt.mon.ap.connect(scb.analysis_export);
endfunction`,
  end_of_elaboration: `function void end_of_elaboration_phase(uvm_phase phase);
  uvm_root::get().print_topology();
endfunction`,
  start_of_simulation: `function void start_of_simulation_phase(uvm_phase phase);
  \`uvm_info("CFG", $sformatf("num_txns=%0d", num_txns), UVM_LOW)
endfunction`,
  run: `task run_phase(uvm_phase phase);       // in the test
  my_seq seq = my_seq::type_id::create("seq");
  phase.raise_objection(this);
  seq.start(env.agt.sqr);
  phase.drop_objection(this);
endtask`,
  extract: `function void extract_phase(uvm_phase phase);
  leftover = expected_q.size();
endfunction`,
  check: `function void check_phase(uvm_phase phase);
  if (leftover != 0)
    \`uvm_error("SCB", $sformatf("%0d expected items never arrived", leftover))
endfunction`,
  report: `function void report_phase(uvm_phase phase);
  \`uvm_info("SCB", $sformatf("%0d matches", matches), UVM_NONE)
endfunction`,
  final: `function void final_phase(uvm_phase phase);
  $fclose(log_fd);
endfunction`,
};

const runtimeSnippet = (p: PhaseDef) => `task ${p.method}(uvm_phase phase);
  phase.raise_objection(this);
  // time-consuming work for this step
  phase.drop_objection(this);
endtask`;

// ---------------------------------------------------------------------------
// Phase map
// ---------------------------------------------------------------------------

function PhaseChip({ phase, selected, onSelect }: { phase: PhaseDef; selected: boolean; onSelect: (name: string) => void }) {
  const order = phaseOrder(phase);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${phase.method}: ${isTaskPhase(phase) ? "task" : "function"}, ${ORDER_TEXT[order]}`}
      onClick={() => onSelect(phase.name)}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 border px-2.5 py-1 font-mono text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
        isTaskPhase(phase) ? "rounded-full border-amber-500/60 bg-amber-500/10" : "rounded-md border-sky-500/50 bg-sky-500/10",
        selected && "ring-2 ring-cyan-500",
      )}
    >
      <span aria-hidden className="font-sans text-[13px] font-bold">
        {ORDER_GLYPH[order]}
      </span>
      {phase.method}
    </button>
  );
}

function PhaseMap({ selected, onSelect }: { selected: string; onSelect: (name: string) => void }) {
  const before = COMMON_PHASES.slice(0, 4);
  const run = COMMON_PHASES[4];
  const after = COMMON_PHASES.slice(5);
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-3" role="group" aria-label="UVM phase map">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Common domain · zero-time functions</p>
      <div className="flex flex-wrap items-center gap-2">
        {before.map((p, i) => (
          <React.Fragment key={p.name}>
            <PhaseChip phase={p} selected={selected === p.name} onSelect={onSelect} />
            {i < before.length - 1 ? <span aria-hidden className="text-muted-foreground">→</span> : null}
          </React.Fragment>
        ))}
      </div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        <div className="rounded-lg border border-dashed border-amber-500/60 p-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800 dark:text-amber-200">Lane 1 · common domain</p>
          <PhaseChip phase={run} selected={selected === run.name} onSelect={onSelect} />
          <p className="mt-2 text-xs text-muted-foreground">One task phase. Ends only after its objections drop and the uvm schedule beside it has ended.</p>
        </div>
        <div className="rounded-lg border border-dashed border-amber-500/60 p-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800 dark:text-amber-200">
            Lane 2 · uvm domain, schedule &quot;uvm_sched&quot; ∥ run_phase
          </p>
          <ol className="flex flex-wrap items-center gap-1.5">
            {RUNTIME_PHASES.map((p) => (
              <li key={p.name}>
                <PhaseChip phase={p} selected={selected === p.name} onSelect={onSelect} />
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">12 task phases, one after another. Each starts for every component together.</p>
        </div>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Both lanes done → zero-time functions</p>
      <div className="flex flex-wrap items-center gap-2">
        {after.map((p, i) => (
          <React.Fragment key={p.name}>
            <PhaseChip phase={p} selected={selected === p.name} onSelect={onSelect} />
            {i < after.length - 1 ? <span aria-hidden className="text-muted-foreground">→</span> : null}
          </React.Fragment>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Square chip = function (no time) · round chip = task (consumes time) · ↓ top-down · ↑ bottom-up · ∥ all components in parallel
      </p>
    </div>
  );
}

function PhaseDetail({ name }: { name: string }) {
  const phase = findPhase(name);
  if (!phase) return null;
  const order = phaseOrder(phase);
  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]" aria-live="polite">
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Phase</dt>
          <dd className="font-mono [font-variant-ligatures:none]">
            {phase.method} · {phase.phaseClass} extends {phase.base}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Order</dt>
          <dd>
            {ORDER_GLYPH[order]} {ORDER_TEXT[order]} · {isTaskPhase(phase) ? "task (consumes time)" : "function (zero time)"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Purpose</dt>
          <dd>{phase.purpose}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Source</dt>
          <dd>
            IEEE 1800.2-2020 §{phase.clause}; {phase.domain === "uvm" ? "uvm_runtime_phases.svh" : "uvm_common_phases.svh"}
          </dd>
        </div>
      </dl>
      <pre className="min-w-0 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]">
        <code>{PHASE_SNIPPET[phase.name] ?? runtimeSnippet(phase)}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode A: call order of a function phase
// ---------------------------------------------------------------------------

const FUNCTION_PHASES = COMMON_PHASES.filter((p) => !isTaskPhase(p));

const CREATION_FEEDBACK =
  "Creation order does not matter. uvm-core keeps children in an associative array indexed by instance name and visits them in string order, so env.agt comes before env.scb.";
const PARALLEL_FEEDBACK =
  "Only task phases (run_phase and the 12 runtime phases) run components in parallel. Function phases call one component at a time, depth-first.";

/** Prediction for the selected function phase; the correct answer is read from the model's call order. */
function callOrderPrediction(phaseName: string): { question: string; options: PredictionOption[] } {
  const order = phaseCallOrder(phaseName);
  const method = order.phase.method;
  if (order.order === "top-down") {
    const third = order.calls[2]?.path;
    const opts = [
      { id: "uvm_test_top.env.agt", label: "uvm_test_top.env.agt", feedback: "Depth-first pre-order: env's children come next, in instance-name order, so agt precedes scb." },
      { id: "uvm_test_top.env.scb", label: "uvm_test_top.env.scb (env creates it first)", feedback: CREATION_FEEDBACK },
      { id: "uvm_test_top.env.agt.drv", label: "uvm_test_top.env.agt.drv", feedback: "drv is env's grandchild. Pre-order runs agt itself before descending into agt's children." },
      { id: "both", label: "env.agt and env.scb at the same time", feedback: PARALLEL_FEEDBACK },
    ];
    return { question: `uvm_test_top and env run first. Whose ${method} is called third?`, options: opts.map((o) => ({ ...o, correct: o.id === third })) };
  }
  const first = order.calls[0]?.path;
  const opts = [
    { id: "uvm_test_top.env.agt.drv", label: "uvm_test_top.env.agt.drv", feedback: "Bottom-up is depth-first post-order: the deepest component on the first branch (agt before scb, drv before mon) finishes first." },
    { id: "uvm_test_top", label: "uvm_test_top (the test)", feedback: "That is top-down order, used only by build_phase and final_phase. This phase is bottom-up: children before parents." },
    { id: "uvm_test_top.env.scb", label: "uvm_test_top.env.scb (env creates it first)", feedback: CREATION_FEEDBACK },
    { id: "all", label: "All seven at the same time", feedback: PARALLEL_FEEDBACK },
  ];
  return { question: `Which component's ${method} is called first?`, options: opts.map((o) => ({ ...o, correct: o.id === first })) };
}

function TreeList({ node, prefix, current, done }: { node: ComponentNode; prefix: string; current?: string; done: Set<string> }) {
  const path = prefix ? `${prefix}.${node.name}` : node.name;
  const isCurrent = current === path;
  const isDone = done.has(path);
  return (
    <li>
      <span
        aria-current={isCurrent ? "step" : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[12px] transition-colors duration-200 motion-reduce:transition-none [font-variant-ligatures:none]",
          isCurrent ? "border-cyan-500 bg-cyan-500/15 font-semibold" : isDone ? "border-emerald-500/50 bg-emerald-500/10" : "border-border/70",
        )}
      >
        <span aria-hidden className="w-3 text-center">
          {isCurrent ? "▶" : isDone ? "✓" : "·"}
        </span>
        {node.name}
        <span className="text-[10px] text-muted-foreground">{node.type}</span>
        {isCurrent ? <span className="sr-only"> (executing now)</span> : isDone ? <span className="sr-only"> (done)</span> : null}
      </span>
      {node.children?.length ? (
        <ul className="ml-4 mt-1 space-y-1 border-l border-border/70 pl-3">
          {childrenInVisitOrder(node).map((c) => (
            <TreeList key={c.name} node={c} prefix={path} current={current} done={done} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function CallOrderPlayer({ phaseName }: { phaseName: string }) {
  const order = useMemo(() => phaseCallOrder(phaseName), [phaseName]);
  const playback = usePlayback(order.calls.length, phaseName);
  const index = Math.min(playback.index, order.calls.length - 1);
  const call = order.calls[index];
  const done = new Set(order.calls.slice(0, index).map((c) => c.path));
  const children = order.calls.filter((c) => c.path.startsWith(`${call.path}.`) && c.depth === call.depth + 1).map((c) => c.name);
  const why =
    order.order === "top-down"
      ? index === 0
        ? "It is the root of the test tree, so a top-down phase starts here."
        : `Its parent already ran; its own children (${children.join(", ") || "none"}) come after it, depth-first.`
      : children.length
        ? `All of its children (${children.join(", ")}) have already run: bottom-up finishes a subtree before its root.`
        : "It has no children, so nothing has to finish before it. Siblings follow in name order.";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <ul className="space-y-1 rounded-xl border border-border/70 bg-background/40 p-3" aria-label={`Component tree during ${order.phase.method}`}>
          <TreeList node={EXAMPLE_TREE} prefix="" current={call.path} done={done} />
        </ul>
        <ol className="min-w-0 overflow-x-auto rounded-xl bg-slate-950/90 p-3 font-mono text-[12px] leading-6 text-slate-100 [font-variant-ligatures:none]" aria-label="Call log">
          {order.calls.slice(0, index + 1).map((c, i) => (
            <li key={c.path} className={i === index ? "text-cyan-300" : undefined}>
              {i + 1}. {c.path}.{order.phase.method}()
            </li>
          ))}
        </ol>
      </div>
      <div aria-live="polite" className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
        <p>
          <strong>What: </strong>
          <span className="font-mono [font-variant-ligatures:none]">
            {call.path}.{order.phase.method}()
          </span>{" "}
          runs ({call.type}). Call {index + 1} of {order.calls.length}.
        </p>
        <p className="mt-1">
          <strong>Why: </strong>
          {why}
        </p>
      </div>
      <PlaybackControls playback={playback} stepCount={order.calls.length} stepNoun="Call" describeStep={(i) => `${order.calls[i]?.path}.${order.phase.method}()`} />
    </div>
  );
}

function CallOrderMode() {
  const [phaseName, setPhaseName] = useState("connect");
  const { question, options } = callOrderPrediction(phaseName);
  return (
    <div className="space-y-3">
      <SegmentedControl
        label="Function phase"
        mono
        value={phaseName}
        onChange={setPhaseName}
        options={FUNCTION_PHASES.map((p) => ({ value: p.name, label: p.name, ariaLabel: p.method }))}
      />
      <p className="text-sm text-muted-foreground">
        env&apos;s build_phase creates <code>scb</code> first, then <code>agt</code>; the agent creates <code>sqr</code>, <code>drv</code>, <code>mon</code>.
      </p>
      <PredictionPrompt question={question} options={options} resetKey={phaseName}>
        <CallOrderPlayer phaseName={phaseName} />
      </PredictionPrompt>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode B: run_phase in parallel with the uvm schedule
// ---------------------------------------------------------------------------

interface RuntimeCase {
  id: string;
  label: string;
  scenario: RunScenario;
  /** Extra code that has no objection (and therefore no model effect besides being killed). */
  extraCode?: string[];
  question: string;
  options: { id: string; label: string; feedback: string; isCorrect: (r: RunResult) => boolean }[];
}

const RUNTIME_CASES: RuntimeCase[] = [
  {
    id: "sync",
    label: "Two components in reset",
    scenario: {
      schedule: {
        reset: {
          objections: [
            { who: "uvm_test_top.env.agt", raiseAt: 0, dropAt: 100, label: "drive reset" },
            { who: "uvm_test_top.env.scb", raiseAt: 0, dropAt: 30, label: "clear model" },
          ],
        },
        configure: { objections: [{ who: "uvm_test_top.env.agt", raiseAt: 0, dropAt: 50, label: "program registers" }] },
        main: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 300, label: "traffic" }] },
      },
    },
    question: "env.scb drops its reset_phase objection at 30 ns; env.agt drops at 100 ns. When does env.scb's configure_phase start?",
    options: [
      { id: "own", label: "At 30 ns, right after its own reset work.", feedback: "Runtime phases are synchronized across the domain: reset_phase ends for everyone only when the last reset objection drops.", isCorrect: () => false },
      { id: "last", label: "At 100 ns, when the last reset objection drops.", feedback: "Every component in the uvm domain shares one reset_phase node. configure_phase starts for all of them when it ends.", isCorrect: (r) => r.lanes.configure.start === 100 },
      { id: "zero", label: "At 0 ns: all runtime phases run in parallel.", feedback: "The 12 runtime phases run one after another. What runs in parallel with them is run_phase.", isCorrect: () => false },
      { id: "afterRun", label: "After run_phase ends.", feedback: "run_phase runs beside the schedule; it does not gate the runtime phases.", isCorrect: () => false },
    ],
  },
  {
    id: "mixed",
    label: "Objection only in run_phase",
    scenario: {
      run: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 500, label: "wait for traffic" }] },
    },
    extraCode: [
      "// uvm_test_top: stimulus started in main_phase, no objection",
      "task main_phase(uvm_phase phase);",
      "  seq.start(env.agt.sqr);   // would take 300 ns",
      "endtask",
    ],
    question: "The test raises an objection only in run_phase (0–500 ns) and starts its sequence in main_phase without one. When does main_phase end?",
    options: [
      { id: "zero", label: "At 0 ns: nothing objected in main_phase, so it ends at once and kills the sequence.", feedback: "Each phase has its own objection. With none raised in main_phase's first time step, UVM skips it and kills its threads.", isCorrect: (r) => r.lanes.main.end === 0 },
      { id: "withRun", label: "At 500 ns, together with run_phase.", feedback: "run_phase's objection belongs to run_phase only. It keeps run_phase alive, not main_phase.", isCorrect: () => false },
      { id: "seq", label: "At 300 ns, when the sequence finishes.", feedback: "Finishing the task does not end a phase, and an unfinished task does not hold it open: only objections do.", isCorrect: () => false },
      { id: "never", label: "Never: run_phase blocks it.", feedback: "Nothing blocks the schedule; it simply runs through its 12 phases.", isCorrect: () => false },
    ],
  },
  {
    id: "schedOnly",
    label: "Runtime phases only",
    scenario: {
      schedule: {
        reset: { objections: [{ who: "uvm_test_top.env.agt", raiseAt: 0, dropAt: 100, label: "drive reset" }] },
        configure: { objections: [{ who: "uvm_test_top.env.agt", raiseAt: 0, dropAt: 50, label: "program registers" }] },
        main: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 300, label: "traffic" }] },
        shutdown: { objections: [{ who: "uvm_test_top.env.scb", raiseAt: 0, dropAt: 20, label: "drain scoreboard" }] },
      },
    },
    question: "Nobody raises an objection in run_phase. When does run_phase end?",
    options: [
      { id: "zero", label: "At 0 ns: no objection, so it is skipped.", feedback: "Skipping only stops run_phase waiting for its own objections. It still waits for its sibling, the uvm schedule, because both precede extract.", isCorrect: () => false },
      { id: "sched", label: "When post_shutdown ends (470 ns).", feedback: "run_phase and the uvm schedule both precede extract_phase, so run_phase waits for the schedule (wait_for_self_and_siblings_to_drop).", isCorrect: (r) => r.runEnd === 470 },
      { id: "main", label: "When main_phase ends (450 ns).", feedback: "There is nothing special about main_phase; run_phase waits for the whole schedule.", isCorrect: () => false },
      { id: "never", label: "Never: the timeout fires.", feedback: "Nothing is stuck: every objection drops, so the test ends normally.", isCorrect: () => false },
    ],
  },
];

function scenarioCode(c: RuntimeCase): CodeTraceLine[] {
  const byWho = new Map<string, string[]>();
  const add = (phase: string, act: RunScenario["run"]) => {
    for (const o of act?.objections ?? []) {
      const lines = byWho.get(o.who) ?? [];
      const dur = o.dropAt === null ? null : o.dropAt - o.raiseAt;
      lines.push(
        `task ${phase}_phase(uvm_phase phase);`,
        "  phase.raise_objection(this);",
        dur === null ? "  forever #10ns;   // never drops" : `  #${dur}ns;   // ${o.label ?? "work"}`,
        ...(dur === null ? [] : ["  phase.drop_objection(this);"]),
        "endtask",
      );
      byWho.set(o.who, lines);
    }
  };
  add("run", c.scenario.run);
  for (const name of RUNTIME_PHASE_NAMES) add(name, c.scenario.schedule?.[name as RuntimePhaseName]);
  const out: CodeTraceLine[] = [];
  for (const [who, lines] of byWho) {
    out.push({ text: `// ${who}`, owner: "testbench" });
    for (const t of lines) out.push({ text: t, owner: "testbench" });
  }
  for (const t of c.extraCode ?? []) out.push({ text: t, owner: "testbench" });
  return out;
}

const LANE_W = 560;
const LANE_L = 96;
const LANE_R = 16;

function LaneChart({ result }: { result: RunResult }) {
  const end = result.runEnd ?? 0;
  const max = Math.max(100, Math.ceil((end + 50) / 50) * 50);
  const x = (t: number) => LANE_L + (t / max) * (LANE_W - LANE_L - LANE_R);
  const sched = RUNTIME_PHASE_NAMES.map((n) => result.lanes[n]).filter((l) => l.start !== null && l.end !== null);
  const longPhases = sched.filter((l) => (l.end as number) > (l.start as number));
  const zeroAt = new Map<number, string[]>();
  for (const l of sched) if (l.end === l.start) zeroAt.set(l.start as number, [...(zeroAt.get(l.start as number) ?? []), l.phase]);
  const run = result.lanes.run;
  const label = `run_phase from 0 to ${formatTime(run.end)}. uvm schedule: ${longPhases.map((l) => `${l.phase} ${formatTime(l.start)}–${formatTime(l.end)}`).join(", ") || "every phase ends at once"}. Cleanup at ${formatTime(result.cleanupAt)}.`;
  return (
    <figure className="rounded-xl border border-border/70 bg-background/40 p-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${LANE_W} 132`} role="img" aria-label={label} className="block h-auto w-full min-w-[300px]">
          <text x={4} y={30} fontSize="11" className="fill-foreground">
            run_phase
          </text>
          <text x={4} y={72} fontSize="11" className="fill-foreground">
            uvm schedule
          </text>
          <rect x={x(0)} y={18} width={Math.max(3, x(run.end ?? 0) - x(0))} height={18} rx={9} className="fill-amber-500/20 stroke-amber-500" />
          {longPhases.map((l) => (
            <g key={l.phase}>
              <rect x={x(l.start as number)} y={60} width={x(l.end as number) - x(l.start as number)} height={18} rx={9} className="fill-cyan-500/15 stroke-cyan-600" />
              <text x={(x(l.start as number) + x(l.end as number)) / 2} y={73} fontSize="10" textAnchor="middle" className="fill-foreground">
                {l.phase}
              </text>
            </g>
          ))}
          {[...zeroAt.entries()].map(([t, names]) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={56} y2={82} strokeDasharray="2 2" className="stroke-muted-foreground" />
              <text x={x(t) + 2} y={92} fontSize="8" className="fill-muted-foreground">
                {names.length} at once
              </text>
            </g>
          ))}
          {result.cleanupAt !== null ? (
            <g>
              <line x1={x(result.cleanupAt)} x2={x(result.cleanupAt)} y1={10} y2={100} strokeDasharray="4 3" className="stroke-foreground" />
              <text x={Math.min(x(result.cleanupAt) + 3, LANE_W - 90)} y={12} fontSize="9" className="fill-foreground">
                ■ extract…final
              </text>
            </g>
          ) : null}
          <line x1={LANE_L} x2={LANE_W - LANE_R} y1={104} y2={104} className="stroke-border" />
          {timeTicks(max, 4).map((t) => (
            <text key={t} x={x(t)} y={118} fontSize="9" textAnchor="middle" className="fill-muted-foreground">
              {formatTime(t)}
            </text>
          ))}
        </svg>
      </div>
      <figcaption className="px-1 text-[11px] text-muted-foreground">x-axis: simulation time. Dashed tick: phases that ended at once (no objection).</figcaption>
    </figure>
  );
}

const REASON_TEXT = {
  "all-dropped": "all objections dropped",
  "no-objection": "no objection: ended at once",
  timeout: "timeout",
  "not-reached": "not reached",
  hang: "never ends",
} as const;

function RuntimeMode() {
  const [caseId, setCaseId] = useState(RUNTIME_CASES[0].id);
  const c = RUNTIME_CASES.find((k) => k.id === caseId) ?? RUNTIME_CASES[0];
  const result = useMemo(() => simulateRun(c.scenario), [c]);
  const options: PredictionOption[] = c.options.map((o) => ({ id: o.id, label: o.label, feedback: o.feedback, correct: o.isCorrect(result) }));
  const rows = [result.lanes.run, ...RUNTIME_PHASE_NAMES.map((n) => result.lanes[n])];
  return (
    <div className="space-y-3">
      <SegmentedControl label="Run-time scenario" value={caseId} onChange={setCaseId} options={RUNTIME_CASES.map((k) => ({ value: k.id, label: k.label }))} />
      <CodeTrace label="Objections in this scenario (generated from the model input)" lines={scenarioCode(c)} />
      <PredictionPrompt question={c.question} options={options} resetKey={caseId}>
        <div className="space-y-3">
          <LaneChart result={result} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-left text-xs">
              <caption className="sr-only">Start and end of each run-time phase</caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1 pr-2 font-semibold">Phase</th>
                  <th className="py-1 pr-2 font-semibold">Start</th>
                  <th className="py-1 pr-2 font-semibold">End</th>
                  <th className="py-1 font-semibold">Why it ended</th>
                </tr>
              </thead>
              <tbody className="font-mono [font-variant-ligatures:none]">
                {rows.map((l) => (
                  <tr key={l.phase} className={cn("border-t border-border/50", l.end !== null && l.start !== null && l.end > l.start && "bg-cyan-500/5")}>
                    <td className="py-1 pr-2">{l.phase}_phase</td>
                    <td className="py-1 pr-2">{formatTime(l.start)}</td>
                    <td className="py-1 pr-2">{formatTime(l.end)}</td>
                    <td className="py-1 font-sans">
                      {l.phase === "run" && l.waitedForSchedule ? "waited for the uvm schedule" : REASON_TEXT[l.reason]}
                      {l.killedRaises.length ? " · a later raise was killed" : ""}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border/50">
                  <td className="py-1 pr-2">extract … final</td>
                  <td className="py-1 pr-2">{formatTime(result.cleanupAt)}</td>
                  <td className="py-1 pr-2">{formatTime(result.cleanupAt)}</td>
                  <td className="py-1 font-sans">zero-time functions after both lanes end</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </PredictionPrompt>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Mode = "order" | "runtime";

export function UvmPhaseTimelineVisualizer() {
  const [selected, setSelected] = useState("run");
  const [mode, setMode] = useState<Mode>("order");
  return (
    <VisualFrame
      label="UVM phase map and timeline"
      eyebrow="Mental picture · experiment"
      title="One map of UVM phasing"
      summary="Function phases walk the component tree depth-first, top-down or bottom-up. run_phase runs beside a 12-phase schedule that every component steps through together."
      fidelity="model"
      assumptions={PHASE_TIMELINE_ASSUMPTIONS}
    >
      <PhaseMap selected={selected} onSelect={setSelected} />
      <PhaseDetail name={selected} />
      <div className="space-y-3 border-t border-border/60 pt-4">
        <SegmentedControl
          label="Experiment"
          value={mode}
          onChange={setMode}
          options={[
            { value: "order", label: "Who is called first?" },
            { value: "runtime", label: "run_phase ∥ uvm schedule" },
          ]}
        />
        {mode === "order" ? <CallOrderMode /> : <RuntimeMode />}
      </div>
    </VisualFrame>
  );
}

export default UvmPhaseTimelineVisualizer;
