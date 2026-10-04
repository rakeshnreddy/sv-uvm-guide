"use client";

import React, { useMemo, useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode, type DiagramPort } from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import {
  analysisImp,
  analysisPort,
  broadcastTrace,
  endpointFullName,
  simulateAnalysisFifo,
  slowSubscriberVerdict,
  type SlowSubscriberChoice,
  type TlmTopology,
} from "@/lib/uvm-tlm-model";
import { cn } from "@/lib/utils";

// ── Scenario data (semantics come from the model) ───────────────────────────

const TOPO: TlmTopology = {
  components: [
    { id: "test", name: "uvm_test_top", parent: null, kind: "test", cls: "bus_test" },
    { id: "env", name: "env", parent: "test", kind: "env", cls: "bus_env" },
    { id: "agt", name: "agt", parent: "env", kind: "agent", cls: "bus_agent" },
    { id: "scb", name: "scb", parent: "env", kind: "scoreboard", cls: "bus_scoreboard" },
    { id: "cov", name: "cov", parent: "env", kind: "subscriber", cls: "bus_coverage" },
    { id: "log", name: "log", parent: "env", kind: "subscriber", cls: "txn_logger" },
  ],
  endpoints: [
    analysisPort("agt", "ap", "bus_item"),
    analysisImp("scb", "item_imp", "bus_item", { ownerCls: "bus_scoreboard" }),
    analysisImp("cov", "analysis_export", "bus_item", { objName: "analysis_imp" }),
    analysisImp("log", "analysis_export", "bus_item", { objName: "analysis_imp" }),
  ],
};

const SUBSCRIBERS = ["scb.item_imp", "cov.analysis_export", "log.analysis_export"];
const TXN = { addr: 0x10, data: 0xa5 };
const WRITE_TIME = 10;

const hex = (n: number) => `0x${n.toString(16)}`;
const fmt = (t: Record<string, number>) => Object.entries(t).map(([k, v]) => `${k}=${hex(v)}`).join(" ");

const NODES: DiagramNode[] = [
  { id: "env", label: "env", kind: "env", x: 10, y: 10, w: 540, h: 240, container: true },
  { id: "agt", label: "agt", sublabel: "bus_agent (mon inside)", kind: "agent", x: 30, y: 100, w: 150, h: 60 },
  { id: "scb", label: "scb", sublabel: "bus_scoreboard", kind: "scoreboard", x: 360, y: 30, w: 170, h: 50 },
  { id: "cov", label: "cov", sublabel: "bus_coverage", kind: "subscriber", x: 360, y: 105, w: 170, h: 50 },
  { id: "log", label: "log", sublabel: "txn_logger", kind: "subscriber", x: 360, y: 180, w: 170, h: 50 },
];

const CALL_PREDICTION: PredictionOption[] = [
  {
    id: "same-time",
    label: "At t = 10 ns, after all three write() functions have returned.",
    correct: true,
    feedback: "ap.write() is a loop of ordinary function calls inside the monitor's own process. Each subscriber's write() runs to completion before the next starts, and none can consume time.",
  },
  {
    id: "parallel",
    label: "At t = 10 ns immediately, while the subscribers run in parallel threads.",
    correct: false,
    feedback: "No thread is forked. The subscribers run one after another inside the monitor's call to ap.write(), so the monitor continues only after the last one returns.",
  },
  {
    id: "slowest",
    label: "When the slowest subscriber has finished its checking.",
    correct: false,
    feedback: "write() is a function, so it cannot take simulation time. There is no slow write(): a subscriber that needs time must queue the item and do the work in its own task.",
  },
  {
    id: "delta",
    label: "Three delta cycles later, one per subscriber.",
    correct: false,
    feedback: "A function call schedules no event, so there is no delta cycle. Everything happens in the same scheduling step.",
  },
];

const SLOW_PREDICTION: PredictionOption[] = [
  {
    id: "in-write",
    label: "Inside write(): the monitor simply waits 25 ns each time.",
    correct: false,
    feedback: "write() is a function, and a function cannot contain a delay (IEEE 1800-2023 §13.4). Even if it could, the monitor would stall and miss bus cycles; that is why analysis connections have no back-pressure.",
  },
  {
    id: "fifo",
    label: "Not in write(): queue the item in a uvm_tlm_analysis_fifo and wait in chk's own run_phase thread.",
    correct: true,
    feedback: "The FIFO's write() is a zero-time try_put() into an unbounded queue. The checker's run_phase calls get(), a task that may block, and spends its 25 ns there.",
  },
  {
    id: "auto",
    label: "write() returns at once and UVM runs the check later by itself.",
    correct: false,
    feedback: "UVM queues nothing for you. An analysis port has no buffer; if a subscriber needs one, you add a FIFO.",
  },
  {
    id: "task",
    label: "In a task that write() calls.",
    correct: false,
    feedback: "A function cannot enable a task (IEEE 1800-2023 §13.4), so this does not compile.",
  },
];

const SLOW_CHOICES: { value: SlowSubscriberChoice; label: string }[] = [
  { value: "delay-in-write", label: "#25ns inside write()" },
  { value: "task-in-write", label: "call a task from write()" },
  { value: "analysis-fifo", label: "analysis FIFO + get() loop" },
];

const SLOW_CODE: Record<SlowSubscriberChoice, CodeTraceLine[]> = {
  "delay-in-write": [
    { text: "// bus_checker", owner: "testbench" },
    { text: "function void write(bus_item t);", owner: "testbench" },
    { text: "  #25ns;          // ✕ a function cannot contain a delay", key: "bad", owner: "testbench" },
    { text: "  compare(t);", owner: "testbench" },
    { text: "endfunction", owner: "testbench" },
  ],
  "task-in-write": [
    { text: "// bus_checker", owner: "testbench" },
    { text: "function void write(bus_item t);", owner: "testbench" },
    { text: "  check_response(t);   // ✕ a function cannot call a task", key: "bad", owner: "testbench" },
    { text: "endfunction", owner: "testbench" },
    { text: "task check_response(bus_item t);  // waits ~25 ns", owner: "testbench" },
  ],
  "analysis-fifo": [
    { text: "// bus_env", owner: "testbench" },
    { text: "uvm_tlm_analysis_fifo #(bus_item) chk_fifo;", owner: "testbench" },
    { text: 'chk_fifo = new("chk_fifo", this);            // build_phase', owner: "testbench" },
    { text: "agt.ap.connect(chk_fifo.analysis_export);    // connect_phase", key: "fifo-in", owner: "testbench" },
    { text: "chk.get_port.connect(chk_fifo.get_export);", key: "fifo-out", owner: "testbench" },
    { text: "" },
    { text: "// bus_checker::run_phase", owner: "testbench" },
    { text: "forever begin", owner: "testbench" },
    { text: "  get_port.get(t);         // task: blocks until an item is queued", key: "get", owner: "testbench" },
    { text: "  wait_for_response(t);    // ~25 ns", owner: "testbench" },
    { text: "  compare(t);", owner: "testbench" },
    { text: "end", owner: "testbench" },
  ],
};

const WRITES = [10, 20, 30, 40];
const SERVICE = 25;

type Section = "trace" | "slow";

/** Analysis broadcast: an ordered, zero-time call trace, and why a slow subscriber needs a FIFO. */
export default function AnalysisBroadcastVisualizer({ section: initialSection = "trace" }: { section?: Section }) {
  const [section, setSection] = useState<Section>(initialSection);
  return (
    <VisualFrame
      label="Analysis port broadcast"
      eyebrow="Watch it run"
      title="What ap.write(t) really does"
      summary="An analysis port calls every connected subscriber's write() in turn, inside the monitor's own process, at one simulation time."
      fidelity="model"
      assumptions={[
        "Call order follows uvm-core 2020.3.1: write() walks the imps resolved at end_of_elaboration, stored by full name. IEEE 1800.2 promises no order.",
        "The checker's 25 ns per item and the monitor's 10 ns write spacing are example numbers.",
        "Compiler messages are paraphrased; wording differs by tool.",
      ]}
    >
      <SegmentedControl
        label="View"
        value={section}
        onChange={setSection}
        options={[
          { value: "trace", label: "Call trace" },
          { value: "slow", label: "Slow subscriber" },
        ]}
      />
      {section === "trace" ? <CallTrace /> : <SlowSubscriber />}
    </VisualFrame>
  );
}

function CallTrace() {
  const [connectOrder, setConnectOrder] = useState<string[]>(SUBSCRIBERS);
  const [mutate, setMutate] = useState(false);
  const trace = useMemo(
    () =>
      broadcastTrace({
        topo: TOPO,
        portId: "agt.ap",
        connectOrder,
        txn: TXN,
        time: WRITE_TIME,
        mutation: mutate ? { impId: "cov.analysis_export", field: "data", to: 0 } : undefined,
      }),
    [connectOrder, mutate],
  );
  const playback = usePlayback(trace.steps.length, `${connectOrder.join()}-${mutate}`);
  const step = trace.steps[Math.min(playback.index, trace.steps.length - 1)];
  const final = trace.steps[trace.steps.length - 1];
  const scbSaw = final.seen["scb.item_imp"];

  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= connectOrder.length) return;
    const next = [...connectOrder];
    [next[i], next[j]] = [next[j], next[i]];
    setConnectOrder(next);
  };

  const ports: DiagramPort[] = [
    { id: "agt.ap", nodeId: "agt", side: "right", offset: 0.5, kind: "analysis_port", label: "ap", state: step.callStack.length > 1 ? "active" : "normal" },
    { id: "scb.item_imp", nodeId: "scb", side: "left", offset: 0.5, kind: "analysis_imp", label: "item_imp", state: step.current === "scb.item_imp" ? "active" : "normal" },
    { id: "cov.analysis_export", nodeId: "cov", side: "left", offset: 0.5, kind: "analysis_imp", label: "analysis_export", state: step.current === "cov.analysis_export" ? "active" : "normal" },
    { id: "log.analysis_export", nodeId: "log", side: "left", offset: 0.5, kind: "analysis_imp", label: "analysis_export", state: step.current === "log.analysis_export" ? "active" : "normal" },
  ];
  const edges: DiagramEdge[] = connectOrder.map((imp) => ({
    id: imp,
    from: "agt.ap",
    to: imp,
    style: "data",
    label: `#${trace.order.indexOf(imp) + 1} write(t)`,
    state: step.current === imp ? "active" : step.current ? "dim" : "normal",
  }));
  const nodes = NODES.map((n) => ({ ...n, state: step.current?.startsWith(`${n.id}.`) ? ("active" as const) : ("normal" as const) }));

  const codeLines: CodeTraceLine[] = [
    { text: "// bus_env::connect_phase", owner: "testbench" },
    ...trace.connectCode.map((text, i) => ({ text, key: connectOrder[i], owner: "testbench" as const })),
    { text: "" },
    { text: "// bus_monitor::run_phase (inside agt)", owner: "testbench" },
    { text: "ap.write(t);          // t = new item, sampled at t = 10 ns", key: "write", owner: "testbench" },
    { text: "@(vif.mon_cb);        // next statement", key: "after", owner: "testbench" },
  ];
  const activeKey = step.current ?? (playback.index === 0 ? "write" : "after");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The env connects three subscribers to <code className="font-mono">agt.ap</code>. Predict the timing, then step through the calls. Afterwards, reorder the{" "}
        <code className="font-mono">connect()</code> lines and watch whether the call order changes.
      </p>
      <PredictionPrompt resetKey="trace" question="The monitor calls ap.write(t) at t = 10 ns. When does the monitor's next statement run?" options={CALL_PREDICTION}>
        <div className="space-y-4">
          <BlockDiagram
            title={`Analysis broadcast at t = ${WRITE_TIME} ns. Call order: ${trace.order.map((i) => i.split(".")[0]).join(", ")}. ${step.what}`}
            width={560}
            height={260}
            nodes={nodes}
            ports={ports}
            edges={edges}
            tokens={step.current ? [{ edgeId: step.current, t: 0.75, label: "t", tone: "data" }] : []}
            showLegend
          />
          <PlaybackControls playback={playback} stepCount={trace.steps.length} stepNoun="Call" describeStep={(i) => trace.steps[i]?.what ?? ""} />
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-[15px]" aria-live="polite">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                t = {step.time} ns · step {playback.index + 1} of {trace.steps.length}
              </p>
              <p className="text-foreground">
                <strong>What: </strong>
                {step.what.replace(/=(\d+)/g, (_, n) => `=${hex(Number(n))}`)}
              </p>
              <p className="mt-1 text-muted-foreground">
                <strong className="text-foreground">Why: </strong>
                {step.why}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/50 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Call stack (one process)</p>
              <ol className="space-y-0.5 font-mono text-xs [font-variant-ligatures:none]" aria-label="Call stack">
                {step.callStack.map((frame, i) => (
                  <li key={frame} style={{ paddingLeft: `${i * 10}px` }}>
                    {i > 0 ? "└ " : ""}
                    {frame}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/40 p-3 text-sm">
            <p className="font-semibold text-foreground">
              Call order: {trace.order.map((imp) => endpointFullName(TOPO, TOPO.endpoints.find((e) => e.id === imp)!)).join(" → ")}
            </p>
            <p className="mt-1 text-muted-foreground">
              uvm-core sorts the imps by full name when it resolves bindings, so cov runs before log, and log before scb, whatever order the{" "}
              <code className="font-mono">connect()</code> calls are in. Treat the order as unspecified: no subscriber may depend on another having seen the item.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={mutate} onChange={(e) => setMutate(e.target.checked)} className="h-4 w-4 accent-rose-500" />
              Bug: cov.write() clears <code className="font-mono">t.data</code> after sampling coverage
            </label>
            <p
              className={cn("mt-2 font-mono text-xs [font-variant-ligatures:none]", scbSaw.data === TXN.data ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}
              aria-live="polite"
            >
              {scbSaw.data === TXN.data
                ? `✓ UVM_INFO @ 10: uvm_test_top.env.scb [SCB] match: ${fmt(scbSaw)}`
                : `✕ UVM_ERROR @ 10: uvm_test_top.env.scb [SCB] mismatch: expected data=${hex(TXN.data)}, got ${fmt(scbSaw)}`}
            </p>
            {mutate ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Every subscriber receives the same handle. cov runs first, so log and scb see the cleared field. Subscribers must not modify the item; clone it if you need to change a copy.
              </p>
            ) : null}
          </div>
        </div>
      </PredictionPrompt>
      <CodeTrace
        label="Connect order (reorder with the arrows) and the monitor's call"
        lines={codeLines}
        activeKey={activeKey}
        renderLineControl={(line) => {
          const i = connectOrder.indexOf(line.key ?? "");
          if (i < 0) return null;
          return (
            <span className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${line.text} up`} className={arrowClass}>
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === connectOrder.length - 1} aria-label={`Move ${line.text} down`} className={arrowClass}>
                ↓
              </button>
            </span>
          );
        }}
      />
    </div>
  );
}

const arrowClass =
  "h-7 w-7 rounded-md border border-slate-500 text-[12px] text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-30";

function SlowSubscriber() {
  const [choice, setChoice] = useState<SlowSubscriberChoice>("delay-in-write");
  const [endOfTest, setEndOfTest] = useState<"45" | "110">("45");
  const verdict = slowSubscriberVerdict(choice);
  const sim = useMemo(() => simulateAnalysisFifo({ writeTimes: WRITES, serviceTime: SERVICE, endOfTest: Number(endOfTest) }), [endOfTest]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A new subscriber, <code className="font-mono">chk</code>, must wait about 25 ns for the DUT&apos;s response before it can check each item. The monitor writes an item every 10 ns.
      </p>
      <PredictionPrompt resetKey="slow" question="Where can chk's 25 ns of waiting go?" options={SLOW_PREDICTION}>
        <div className="space-y-4">
          <SegmentedControl label="chk implementation" value={choice} onChange={setChoice} options={SLOW_CHOICES} />
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
            <CodeTrace label="chk code" lines={SLOW_CODE[choice]} activeKey={verdict.compiles ? undefined : "bad"} />
            <div
              aria-live="polite"
              className={cn(
                "rounded-xl border p-3 text-sm",
                verdict.compiles ? "border-emerald-500/50 bg-emerald-500/5" : "border-rose-500/50 bg-rose-500/5",
              )}
            >
              <p className={cn("font-semibold", verdict.compiles ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                {verdict.compiles ? "✓ " : "✕ "}
                {verdict.message}
              </p>
              <p className="mt-1 text-muted-foreground">
                <strong className="text-foreground">Rule: </strong>
                {verdict.rule}
              </p>
            </div>
          </div>
          {verdict.compiles ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted-foreground">Test drops its last objection at</span>
                <SegmentedControl
                  label="End of test"
                  value={endOfTest}
                  onChange={setEndOfTest}
                  options={[
                    { value: "45", label: "t = 45 ns" },
                    { value: "110", label: "t = 110 ns" },
                  ]}
                />
              </div>
              <FifoTimeline sim={sim} endOfTest={Number(endOfTest)} />
              <p className="text-sm text-foreground" aria-live="polite">
                The monitor never waits (0 ns): every write() returns at once and the FIFO holds up to {sim.maxUsed} items.{" "}
                {sim.uncheckedAtEnd.length > 0
                  ? `Ending at ${endOfTest} ns leaves item${sim.uncheckedAtEnd.length > 1 ? "s" : ""} #${sim.uncheckedAtEnd.join(", #")} unchecked: keep an objection until chk is idle, or report a non-empty FIFO in check_phase.`
                  : "Every item is checked before the test ends."}
              </p>
            </div>
          ) : null}
        </div>
      </PredictionPrompt>
    </div>
  );
}

function FifoTimeline({ sim, endOfTest }: { sim: ReturnType<typeof simulateAnalysisFifo>; endOfTest: number }) {
  const x0 = 70;
  const x1 = 540;
  const tMax = 120;
  const x = (t: number) => x0 + ((x1 - x0) * t) / tMax;
  const label = `Timeline 0 to ${tMax} ns. Monitor writes at ${WRITES.join(", ")} ns. Checker busy ${sim.items
    .map((it) => `#${it.id} ${it.startedAt}-${it.doneAt} ns`)
    .join(", ")}. FIFO peaks at ${sim.maxUsed}. Test ends at ${endOfTest} ns.`;
  const steps = sim.occupancy;
  return (
    <figure className="rounded-xl border border-border/70 bg-background/40 p-2">
      <div className="overflow-x-auto">
        <svg viewBox="0 0 560 190" className="block h-auto w-full min-w-[300px]" role="img" aria-label={label}>
          {[0, 20, 40, 60, 80, 100, 120].map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={20} y2={160} className="stroke-border" strokeWidth={0.6} />
              <text x={x(t)} y={176} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {t}
              </text>
            </g>
          ))}
          <text x={x1} y={188} textAnchor="end" className="fill-muted-foreground text-[10px]">
            simulation time, ns
          </text>
          <text x={4} y={38} className="fill-foreground text-[10px] font-semibold">mon write()</text>
          {sim.items.map((it) => (
            <g key={`w${it.id}`}>
              <path d={`M${x(it.writtenAt)},28 l6,6 l-6,6 l-6,-6 z`} className="fill-cyan-500" />
              <text x={x(it.writtenAt)} y={24} textAnchor="middle" className="fill-foreground text-[9px]">
                #{it.id}
              </text>
            </g>
          ))}
          <text x={4} y={84} className="fill-foreground text-[10px] font-semibold">FIFO used()</text>
          {steps.map((o, i) => {
            const next = steps[i + 1]?.t ?? sim.items[sim.items.length - 1].doneAt;
            return (
              <g key={`o${o.t}`}>
                <rect x={x(o.t)} y={100 - o.used * 14} width={Math.max(0, x(next) - x(o.t))} height={o.used * 14} className="fill-indigo-500/30 stroke-indigo-500" strokeWidth={0.8} />
                {o.used > 0 ? (
                  <text x={x(o.t) + 4} y={96 - o.used * 14} className="fill-foreground text-[9px]">
                    {o.used}
                  </text>
                ) : null}
              </g>
            );
          })}
          <text x={4} y={134} className="fill-foreground text-[10px] font-semibold">chk busy</text>
          {sim.items.map((it) => {
            const unchecked = sim.uncheckedAtEnd.includes(it.id);
            return (
              <g key={`c${it.id}`}>
                <rect
                  x={x(it.startedAt)}
                  y={120}
                  width={x(it.doneAt) - x(it.startedAt) - 2}
                  height={22}
                  rx={4}
                  className={unchecked ? "fill-rose-500/15 stroke-rose-500" : "fill-emerald-500/15 stroke-emerald-500"}
                  strokeDasharray={unchecked ? "4 3" : undefined}
                />
                <text x={x(it.startedAt) + 5} y={135} className="fill-foreground text-[9px]">
                  #{it.id} {unchecked ? "✕" : "✓"}
                </text>
              </g>
            );
          })}
          <line x1={x(endOfTest)} x2={x(endOfTest)} y1={14} y2={160} className="stroke-amber-500" strokeWidth={1.6} strokeDasharray="6 4" />
          <text x={x(endOfTest) + 4} y={14} className="fill-amber-700 text-[9.5px] font-semibold dark:fill-amber-300">
            test ends
          </text>
        </svg>
      </div>
      <figcaption className="mt-1 text-[11px] text-muted-foreground">
        ◆ write() (zero time) · shaded steps: items waiting in the FIFO · boxes: chk checking an item (✓ done before the end, ✕ dashed: unfinished)
      </figcaption>
    </figure>
  );
}
