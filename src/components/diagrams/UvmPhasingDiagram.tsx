"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  UVM_DEFAULT_TIMEOUT_NS,
  eventLogLine,
  formatTime,
  simulateRun,
  timeTicks,
  type RunResult,
  type RunScenario,
} from "@/lib/uvm-phase-model";
import { cn } from "@/lib/utils";

/** Objection / end-of-test explorer for run_phase: raise, drop, drain, phase_ready_to_end, timeout. */

type RaiseMode = "start" | "late" | "missing";
type DrainNs = 0 | 50 | 200;
type TimeoutMode = "default" | "explicit";

export interface EndOfTestConfig {
  raise: RaiseMode;
  drop: boolean;
  drain: DrainNs;
  timeout: TimeoutMode;
  /** Scoreboard re-raises in phase_ready_to_end while a response is pending. */
  hook: boolean;
}

const SEQ_NS = 400;
const RESPONSE_AT = 430;
const EXPLICIT_TIMEOUT_NS = 2000;

export const END_OF_TEST_ASSUMPTIONS = [
  "Model of uvm-core 2020.3.1 (IEEE 1800.2-2020): uvm_phase_hopper::execute_phase, uvm_objection drain, uvm_root timeout.",
  "seq.start returns 400 ns after it is called; the DUT's last response reaches the scoreboard 30 ns later.",
  "Drain time is set on uvm_test_top; the scoreboard (env.scb) is its descendant, so one count covers both.",
  "Only run_phase is shown. The 12 runtime phases have no objections here, so each ends at 0 ns.",
  "The log is simplified; real +UVM_OBJECTION_TRACE lines carry more fields.",
];

export const END_OF_TEST_PRESETS: { id: string; label: string; summary: string; config: EndOfTestConfig }[] = [
  {
    id: "healthy",
    label: "Healthy test",
    summary: "The test owns the objection around seq.start and sets a drain time.",
    config: { raise: "start", drop: true, drain: 50, timeout: "explicit", hook: false },
  },
  {
    id: "zero",
    label: "Ends at 0 ns",
    summary: "Bug: nobody raises an objection in run_phase.",
    config: { raise: "missing", drop: true, drain: 0, timeout: "explicit", hook: false },
  },
  {
    id: "late",
    label: "Raise too late",
    summary: "Bug: the test waits #10ns before raising.",
    config: { raise: "late", drop: true, drain: 0, timeout: "explicit", hook: false },
  },
  {
    id: "lost",
    label: "Lost response",
    summary: "Bug: no drain time, and the last response is still in flight when the objection drops.",
    config: { raise: "start", drop: true, drain: 0, timeout: "explicit", hook: false },
  },
  {
    id: "ready",
    label: "phase_ready_to_end",
    summary: "The scoreboard holds the phase open until its last response arrives.",
    config: { raise: "start", drop: true, drain: 0, timeout: "explicit", hook: true },
  },
  {
    id: "hang",
    label: "Never dropped",
    summary: "Bug: the drop is missing. Does the drain time save you?",
    config: { raise: "start", drop: false, drain: 50, timeout: "explicit", hook: false },
  },
];

export function configToScenario(config: EndOfTestConfig): RunScenario {
  const raiseAt = config.raise === "late" ? 10 : 0;
  return {
    timeout: config.timeout === "explicit" ? EXPLICIT_TIMEOUT_NS : UVM_DEFAULT_TIMEOUT_NS,
    run: {
      drainTime: config.drain,
      objections:
        config.raise === "missing"
          ? []
          : [{ who: "uvm_test_top", raiseAt, dropAt: config.drop ? raiseAt + SEQ_NS : null, label: "test objection" }],
      arrivals: config.raise === "start" ? [{ at: RESPONSE_AT, label: "last response" }] : [],
      readyToEnd: config.hook ? { who: "uvm_test_top.env.scb", kind: "until-arrivals" } : undefined,
    },
  };
}

type OutcomeId = "zero" | "atDrop" | "later" | "timeout";

export function classifyOutcome(result: RunResult): OutcomeId {
  if (result.fatal) return "timeout";
  if (result.runEnd === 0) return "zero";
  if (result.runEnd === SEQ_NS) return "atDrop";
  return "later";
}

const OUTCOME_OPTIONS: { id: OutcomeId; label: string; feedback: string }[] = [
  {
    id: "zero",
    label: "run_phase ends at 0 ns.",
    feedback:
      "This happens when nothing has raised an objection by the end of run_phase's first time step: UVM skips the phase and kills its threads at once.",
  },
  {
    id: "atDrop",
    label: "It ends at 400 ns, when the objection drops. The 430 ns response is lost.",
    feedback:
      "This happens when the count reaches 0 with no drain time and no phase_ready_to_end re-raise: the phase ends in that time step and kills the monitor thread.",
  },
  {
    id: "later",
    label: "It ends after 400 ns (drain or phase_ready_to_end). The 430 ns response is checked.",
    feedback:
      "A drain time, counted from the moment the count reaches 0, or a re-raise in phase_ready_to_end keeps run_phase alive until the response arrives.",
  },
  {
    id: "timeout",
    label: "It never ends by itself: the timeout watchdog issues UVM_FATAL.",
    feedback:
      "Only an objection that is never dropped does this. A drain time cannot help, because it starts only when the count reaches 0.",
  },
];

const configKey = (c: EndOfTestConfig) => `${c.raise}|${c.drop}|${c.drain}|${c.timeout}|${c.hook}`;

const RAISE_NEXT: Record<RaiseMode, RaiseMode> = { start: "late", late: "missing", missing: "start" };
const RAISE_LABEL: Record<RaiseMode, string> = { start: "at start", late: "after #10ns", missing: "removed" };
const DRAIN_NEXT: Record<DrainNs, DrainNs> = { 0: 50, 50: 200, 200: 0 };

function codeLines(c: EndOfTestConfig): CodeTraceLine[] {
  const raiseText =
    c.raise === "start"
      ? "    phase.raise_objection(this);"
      : c.raise === "late"
        ? "    #10ns; phase.raise_objection(this);"
        : "    // phase.raise_objection(this);  <- missing";
  return [
    { text: "class my_test extends uvm_test;", owner: "testbench" },
    { text: "  function void build_phase(uvm_phase phase);", owner: "testbench" },
    { text: "    super.build_phase(phase);", owner: "testbench" },
    { text: '    env = my_env::type_id::create("env", this);', owner: "testbench" },
    {
      key: "timeout",
      owner: "testbench",
      text: c.timeout === "explicit" ? "    uvm_root::get().set_timeout(2us);" : "    // no set_timeout: default 9200 s",
    },
    { text: "  endfunction", owner: "testbench" },
    { text: "  task run_phase(uvm_phase phase);", owner: "testbench" },
    { text: '    my_seq seq = my_seq::type_id::create("seq");', owner: "testbench" },
    {
      key: "drain",
      owner: "testbench",
      text: c.drain > 0 ? `    phase.get_objection().set_drain_time(this, ${c.drain}ns);` : "    // no drain time",
    },
    { key: "raise", owner: "testbench", text: raiseText },
    { text: "    seq.start(env.agt.sqr);   // returns 400 ns later", owner: "testbench" },
    {
      key: "drop",
      owner: "testbench",
      text: c.drop ? "    phase.drop_objection(this);" : "    // phase.drop_objection(this);  <- missing",
    },
    { text: "  endtask", owner: "testbench" },
    { text: "endclass", owner: "testbench" },
    { text: "" },
    { text: "class my_scoreboard extends uvm_scoreboard;   // env.scb", owner: "testbench" },
    { text: "  int pending;   // responses expected but not yet seen", owner: "testbench" },
    ...(c.hook
      ? [
          { key: "hook", owner: "testbench" as const, text: "  function void phase_ready_to_end(uvm_phase phase);" },
          { text: '    if (phase.get_name() != "run" || pending == 0) return;', owner: "testbench" as const },
          { text: "    phase.raise_objection(this);", owner: "testbench" as const },
          { text: "    fork begin", owner: "testbench" as const },
          { text: "      wait (pending == 0);", owner: "testbench" as const },
          { text: "      phase.drop_objection(this);", owner: "testbench" as const },
          { text: "    end join_none", owner: "testbench" as const },
          { text: "  endfunction", owner: "testbench" as const },
        ]
      : [{ key: "hook", owner: "testbench" as const, text: "  // no phase_ready_to_end override" }]),
    { text: "endclass", owner: "testbench" },
  ];
}

function whySentence(c: EndOfTestConfig, r: RunResult): string {
  const lane = r.lanes.run;
  if (r.fatal) {
    return `The objection is never dropped, so the count never reaches 0 and ${c.drain > 0 ? `the ${c.drain} ns drain never starts` : "no drain could start"}. run_phase's watchdog fires at ${formatTime(r.fatal.at)}: UVM_FATAL [PH_TIMEOUT]. extract, check and report never run.`;
  }
  if (r.runEnd === 0 && c.raise === "missing") {
    return "Nothing raised an objection in run_phase's first time step, so UVM ended run_phase at 0 ns and killed its threads, including the one about to call seq.start. No traffic and no errors: a false pass.";
  }
  if (r.runEnd === 0) {
    return "The raise waits for #10ns, but UVM looks for objections at the end of the first time step. Finding none, it ended run_phase at 0 ns and killed the thread before the delay elapsed.";
  }
  const seen = lane.arrivals[0]?.seen ?? false;
  const parts = [`The count reached 0 at ${formatTime(SEQ_NS)}.`];
  if (c.drain > 0) parts.push(`The ${c.drain} ns drain held the phase open until ${formatTime(lane.allDroppedAt)}.`);
  if (lane.readyToEndRounds > 1) {
    parts.push(`phase_ready_to_end was called ${lane.readyToEndRounds} times: the scoreboard re-raised until its last response arrived, then let the phase end.`);
  } else if (c.drain === 0) {
    parts.push("No drain time and nobody re-raised in phase_ready_to_end, so the phase ended in that time step.");
  }
  parts.push(
    `run_phase ended at ${formatTime(r.runEnd)}; the response due at ${formatTime(RESPONSE_AT)} was ${seen ? "checked ✓." : "lost ✕: the monitor thread had been killed."}`,
  );
  return parts.join(" ");
}

function scoreboardLine(c: EndOfTestConfig, r: RunResult): { tone: "ok" | "warn" | "error"; text: string } {
  if (r.fatal) return { tone: "error", text: `UVM_FATAL @ ${formatTime(r.fatal.at)} [PH_TIMEOUT] ${r.fatal.message}` };
  if (c.raise !== "start") return { tone: "warn", text: "UVM_INFO [SCB] check_phase: 0 responses expected, 0 matched. The test passes without sending any traffic." };
  const seen = r.lanes.run.arrivals[0]?.seen ?? false;
  return seen
    ? { tone: "ok", text: "UVM_INFO [SCB] check_phase: every expected response matched." }
    : { tone: "error", text: "UVM_ERROR [SCB] check_phase: 1 expected response never arrived." };
}

const W = 560;
const L = 44;
const R = 20;
const BASE_Y = 104;
const STEP_Y = 30;

function ObjectionTimeline({ result }: { result: RunResult }) {
  const lane = result.lanes.run;
  const farFatal = result.fatal && result.fatal.at > 5000;
  const end = lane.end ?? 0;
  const windowMax = result.fatal ? (farFatal ? 600 : result.fatal.at) : Math.max(500, Math.ceil((end + 100) / 100) * 100);
  const x = (t: number) => L + (Math.min(t, windowMax) / windowMax) * (W - L - R);
  const y = (count: number) => BASE_Y - count * STEP_Y;
  const shownEnd = farFatal ? windowMax : end;

  let d = "";
  lane.countSteps.forEach(([t, count], i) => {
    if (t > windowMax) return;
    d += i === 0 ? `M ${x(t)} ${y(count)}` : ` H ${x(t)} V ${y(count)}`;
  });
  d += ` H ${x(shownEnd)}`;

  const raises = lane.events.filter((e) => e.kind === "raise" && e.t <= windowMax);
  const drops = lane.events.filter((e) => e.kind === "drop" && e.t <= windowMax);
  const ready = lane.events.filter((e) => e.kind === "ready-to-end");
  const arrival = lane.arrivals[0];

  const summary = [
    raises.length === 0 ? "No objection raised." : `Objections raised at ${raises.map((e) => formatTime(e.t)).join(", ")}.`,
    drops.length ? `Dropped at ${drops.map((e) => formatTime(e.t)).join(", ")}.` : raises.length ? "Never dropped." : "",
    lane.drains.filter((dr) => !dr.cancelled).map((dr) => `Drain from ${formatTime(dr.from)} to ${formatTime(dr.to)}.`).join(" "),
    result.fatal ? `UVM_FATAL PH_TIMEOUT at ${formatTime(result.fatal.at)}.` : `run_phase ends at ${formatTime(lane.end)}.`,
    arrival ? `Last response at ${formatTime(arrival.at)} ${arrival.seen ? "checked" : "lost"}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className="rounded-xl border border-border/70 bg-background/40 p-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} 170`} role="img" aria-label={`run_phase objection count over simulation time. ${summary}`} className="block h-auto w-full min-w-[300px]">
          <defs>
            <pattern id="uvm-drain-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="stroke-amber-500/60" strokeWidth="2" />
            </pattern>
          </defs>
          <text x={4} y={y(1) + 4} fontSize="10" className="fill-muted-foreground">
            count 1
          </text>
          <text x={4} y={y(0) + 4} fontSize="10" className="fill-muted-foreground">
            0
          </text>
          <line x1={L} x2={W - R} y1={BASE_Y} y2={BASE_Y} className="stroke-border" />
          {timeTicks(windowMax).map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={BASE_Y} y2={BASE_Y + 4} className="stroke-border" />
              <text x={x(t)} y={BASE_Y + 15} fontSize="9" textAnchor="middle" className="fill-muted-foreground">
                {formatTime(t)}
              </text>
            </g>
          ))}
          {lane.drains.map((dr) => (
            <g key={`${dr.from}-${dr.cancelled}`}>
              <rect x={x(dr.from)} y={y(1)} width={Math.max(2, x(dr.to) - x(dr.from))} height={STEP_Y} fill="url(#uvm-drain-hatch)" className="stroke-amber-500" strokeDasharray="3 2" />
              <text x={x(dr.from) + 2} y={y(1) - 4} fontSize="9" className="fill-amber-700 dark:fill-amber-300">
                {dr.cancelled ? "drain cancelled" : "drain"}
              </text>
            </g>
          ))}
          <path d={d} fill="none" strokeWidth="2.5" className="stroke-cyan-600 dark:stroke-cyan-400" />
          {raises.map((e, i) => (
            <text key={`r${i}`} x={x(e.t)} y={y(e.count ?? 1) - 6} fontSize="12" textAnchor="middle" className="fill-cyan-700 dark:fill-cyan-300">
              ▲
            </text>
          ))}
          {drops.map((e, i) => (
            <text key={`d${i}`} x={x(e.t)} y={y(0) - 6} fontSize="12" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300">
              ▼
            </text>
          ))}
          {ready.map((e) => (
            <text key={`rte${e.t}`} x={x(e.t)} y={y(0) + 28} fontSize="10" textAnchor="middle" className="fill-violet-700 dark:fill-violet-300">
              ◆
            </text>
          ))}
          {arrival ? (
            <g>
              <circle cx={x(arrival.at)} cy={y(2) - 6} r="5" className={arrival.seen ? "fill-emerald-500" : "fill-none stroke-rose-500"} strokeWidth="2" />
              <text x={x(arrival.at) + 8} y={y(2) - 2} fontSize="10" className={arrival.seen ? "fill-emerald-700 dark:fill-emerald-300" : "fill-rose-700 dark:fill-rose-300"}>
                {arrival.seen ? "✓ response" : "✕ response lost"}
              </text>
            </g>
          ) : null}
          {result.fatal ? (
            <g>
              <line x1={x(windowMax)} x2={x(windowMax)} y1={20} y2={BASE_Y} strokeWidth="2" className="stroke-rose-500" />
              <text x={x(windowMax) - 4} y={30} fontSize="10" textAnchor="end" className="fill-rose-700 dark:fill-rose-300">
                {farFatal ? `⋯ ${formatTime(result.fatal.at)}: ` : ""}✕ PH_TIMEOUT
              </text>
            </g>
          ) : (
            <g>
              <line x1={x(end)} x2={x(end)} y1={20} y2={BASE_Y} strokeDasharray="4 3" strokeWidth="1.5" className="stroke-foreground" />
              <text x={Math.min(x(end) + 4, W - 110)} y={30} fontSize="10" className="fill-foreground">
                ■ run_phase ends {formatTime(end)}
              </text>
            </g>
          )}
        </svg>
      </div>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
        <span>x-axis: simulation time</span>
        <span>▲ raise · ▼ drop</span>
        <span>hatched: drain time</span>
        <span>◆ phase_ready_to_end call</span>
        <span>■ phase end · ✕ fatal</span>
      </figcaption>
    </figure>
  );
}

export default function UvmPhasingDiagram() {
  const [presetId, setPresetId] = useState("healthy");
  const [config, setConfig] = useState<EndOfTestConfig>(END_OF_TEST_PRESETS[0].config);
  const preset = END_OF_TEST_PRESETS.find((p) => p.id === presetId) ?? END_OF_TEST_PRESETS[0];
  const edited = configKey(preset.config) !== configKey(config);

  const result = useMemo(() => simulateRun(configToScenario(config)), [config]);
  const outcome = classifyOutcome(result);
  const lines = useMemo(() => codeLines(config), [config]);
  const options: PredictionOption[] = OUTCOME_OPTIONS.map((o) => ({ id: o.id, label: o.label, feedback: o.feedback, correct: o.id === outcome }));
  const verdict = scoreboardLine(config, result);
  const log = result.events.filter((e) => e.phase === "run" || e.kind === "timeout").map(eventLogLine);

  const update = (patch: Partial<EndOfTestConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const control = (line: CodeTraceLine) => {
    const btn = (label: string, aria: string, onClick: () => void) => (
      <button
        type="button"
        onClick={onClick}
        aria-label={aria}
        className="min-h-7 rounded-md border border-cyan-400/50 bg-cyan-400/10 px-2 py-0.5 font-mono text-[11px] text-cyan-100 hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 [font-variant-ligatures:none]"
      >
        {label}
      </button>
    );
    switch (line.key) {
      case "timeout":
        return btn(
          config.timeout === "explicit" ? "timeout: 2 us" : "timeout: default",
          `Timeout is ${config.timeout === "explicit" ? "2 us" : "the default 9200 s"}. Switch to ${config.timeout === "explicit" ? "the default" : "2 us"}`,
          () => update({ timeout: config.timeout === "explicit" ? "default" : "explicit" }),
        );
      case "drain":
        return btn(`drain: ${config.drain} ns`, `Drain time is ${config.drain} ns. Change to ${DRAIN_NEXT[config.drain]} ns`, () => update({ drain: DRAIN_NEXT[config.drain] }));
      case "raise":
        return btn(`raise: ${RAISE_LABEL[config.raise]}`, `Raise is ${RAISE_LABEL[config.raise]}. Change to ${RAISE_LABEL[RAISE_NEXT[config.raise]]}`, () =>
          update({ raise: RAISE_NEXT[config.raise] }),
        );
      case "drop":
        return btn(config.drop ? "drop: present" : "drop: removed", config.drop ? "Remove the drop_objection call" : "Restore the drop_objection call", () => update({ drop: !config.drop }));
      case "hook":
        return btn(config.hook ? "hook: on" : "hook: off", config.hook ? "Remove the scoreboard's phase_ready_to_end" : "Add phase_ready_to_end to the scoreboard", () =>
          update({ hook: !config.hook }),
        );
      default:
        return null;
    }
  };

  return (
    <VisualFrame
      label="Objections and end of test explorer"
      eyebrow="Experiment · debug"
      title="When does run_phase end?"
      summary="run_phase ends when every objection has dropped, after any drain time and phase_ready_to_end re-raise. Change the code, predict, then check against the model."
      fidelity="model"
      assumptions={END_OF_TEST_ASSUMPTIONS}
    >
      <div className="space-y-2">
        <SegmentedControl
          label="Scenario"
          value={presetId}
          onChange={(id) => {
            setPresetId(id);
            setConfig((END_OF_TEST_PRESETS.find((p) => p.id === id) ?? END_OF_TEST_PRESETS[0]).config);
          }}
          options={END_OF_TEST_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        />
        <p className="text-sm text-muted-foreground">
          {preset.summary}
          {edited ? " (edited: your own variant)" : ""}
        </p>
      </div>

      <CodeTrace label="Test and scoreboard (use the buttons to change a line)" lines={lines} renderLineControl={control} />

      <PredictionPrompt
        question="Run this code. When does run_phase end, and is the last response (due at 430 ns) checked?"
        options={options}
        resetKey={configKey(config)}
      >
        <div className="space-y-3">
          <ObjectionTimeline result={result} />
          <p aria-live="polite" className="text-sm text-foreground">
            <strong>Why: </strong>
            {whySentence(config, result)}
          </p>
          <p
            className={cn(
              "rounded-lg border px-3 py-2 font-mono text-[12px] [font-variant-ligatures:none]",
              verdict.tone === "ok" && "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
              verdict.tone === "warn" && "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
              verdict.tone === "error" && "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200",
            )}
          >
            {verdict.tone === "ok" ? "✓ " : verdict.tone === "warn" ? "! " : "✕ "}
            {verdict.text}
          </p>
          <details className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">Objection trace (simplified +UVM_OBJECTION_TRACE / +UVM_PHASE_TRACE)</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[11px] leading-5 text-slate-100 [font-variant-ligatures:none]">
              {log.join("\n")}
            </pre>
          </details>
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
