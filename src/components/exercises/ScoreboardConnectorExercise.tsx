"use client";

import React, { useMemo, useState } from "react";

import {
  BlockDiagram,
  type DiagramEdge,
  type DiagramNode,
  type DiagramNodeKind,
  type DiagramPort,
  type PortKind,
} from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { useExerciseProgress } from "@/hooks/useExerciseProgress";
import {
  CALL_ORDER_RULE,
  FIFO_THREAD_POINTS,
  SCB_GIVEN,
  SCB_GOALS,
  SCB_TOPOLOGY,
  SILENT_MISSING_NOTE,
  attemptConnection,
  callOrderPrediction,
  componentRef,
  connectPhaseSource,
  connectionKey,
  endpointRef,
  gradeWiring,
  scoreboardRunPhaseSource,
  writeCallOrder,
  type ScbAttempt,
  type ScbConnectionStatus,
  type ScbGrade,
} from "@/lib/scoreboard-connector-exercise";
import { TLM_MASK, type TlmConnection, type TlmEndpoint } from "@/lib/uvm-tlm-model";
import { cn } from "@/lib/utils";

// ── View geometry (the model owns semantics; this file owns pixels) ─────────

const DIAGRAM = { width: 640, height: 400 };

const BOXES: Record<string, { x: number; y: number; w: number; h: number; container?: boolean; sublabel?: string }> = {
  env: { x: 8, y: 8, w: 624, h: 384, container: true },
  agt: { x: 20, y: 34, w: 196, h: 346, container: true },
  sqr: { x: 36, y: 60, w: 164, h: 54 },
  drv: { x: 36, y: 150, w: 164, h: 54 },
  mon: { x: 36, y: 280, w: 164, h: 60 },
  prd: { x: 260, y: 60, w: 130, h: 64 },
  scb: { x: 450, y: 34, w: 174, h: 236, container: true },
  expected_fifo: { x: 466, y: 64, w: 146, h: 66, sublabel: "uvm_tlm_analysis_fifo" },
  actual_fifo: { x: 466, y: 172, w: 146, h: 66, sublabel: "uvm_tlm_analysis_fifo" },
  cov: { x: 260, y: 316, w: 130, h: 60 },
};

const PORT_PLACES: Record<string, { side: DiagramPort["side"]; offset: number }> = {
  "mon.ap": { side: "right", offset: 0.5 },
  "drv.seq_item_port": { side: "top", offset: 0.5 },
  "sqr.seq_item_export": { side: "bottom", offset: 0.5 },
  "prd.analysis_export": { side: "left", offset: 0.78 },
  "prd.ap": { side: "right", offset: 0.78 },
  "expected_fifo.analysis_export": { side: "left", offset: 0.82 },
  "actual_fifo.analysis_export": { side: "left", offset: 0.82 },
  "cov.analysis_export": { side: "left", offset: 0.78 },
};

function nodeKind(id: string, kind: string): DiagramNodeKind {
  if (id === "prd") return "predictor";
  return kind as DiagramNodeKind;
}

function portKindOf(ep: TlmEndpoint): PortKind {
  if (ep.role === "port") return ep.typeName === "uvm_analysis_port" ? "analysis_port" : "port";
  if (ep.role === "export") return "export";
  return ep.mask === TLM_MASK.ANALYSIS ? "analysis_imp" : "imp";
}

const GLYPH: Record<PortKind, string> = { port: "■", export: "○", imp: "●", analysis_port: "◆", analysis_imp: "●" };

const methodLabel = (ep: TlmEndpoint) => (ep.family === "sqr" ? "get_next_item()" : "write()");

const STATUS_GLYPH: Record<ScbConnectionStatus, string> = { serves: "✓", wrong: "✕", unneeded: "○", given: "·" };

const tone = {
  ok: "text-emerald-700 dark:text-emerald-300",
  warn: "text-amber-700 dark:text-amber-300",
  bad: "text-rose-700 dark:text-rose-300",
};

export const SCOREBOARD_CONNECTOR_ASSUMPTIONS = [
  "Every connect() runs uvm-core 2020.3.1's uvm_port_base::connect() checks through the shared TLM model. Mismatched interface types are compile errors whose wording is tool-specific.",
  "Goals are graded by what each analysis port reaches after resolve_bindings(). UVM itself is silent about a missing analysis connection, because uvm_analysis_port has min_size 0.",
  "The 'wrong stream' verdicts (raw items into expected_fifo, predictions into actual_fifo or coverage, port-to-port merges, a predictor feeding itself) are checking-design rules of this exercise. UVM accepts those connections.",
  "One monitor observes complete transactions; the predictor computes each expected item from the observed one and writes a new object on its ap.",
  "bus_env reaches into agt.mon and the scoreboard's FIFOs directly. A reusable agent usually promotes ap to the agent boundary.",
  "The driver-sequencer connection is already made in bus_agent::connect_phase.",
];

const HINTS = [
  "The caller of connect() is the end that calls write(): an analysis port (◆). The argument is the end that implements write() (●).",
  "Names can mislead: analysis_export on a uvm_subscriber or a uvm_tlm_analysis_fifo is a uvm_analysis_imp, so it is always the argument.",
  "One port can feed many imps: agt.mon.ap needs three connect() calls, and the predictor's own ap needs one.",
];

const ENDPOINT_GROUPS = SCB_TOPOLOGY.components.filter((c) => SCB_TOPOLOGY.endpoints.some((e) => e.owner === c.id));

function buttonClass(variant: "primary" | "plain" = "plain") {
  return cn(
    "inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "border border-border bg-background text-foreground hover:bg-muted",
  );
}

// ── Component ───────────────────────────────────────────────────────────────

const ScoreboardConnectorExercise: React.FC = () => {
  const [learner, setLearner] = useState<TlmConnection[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [last, setLast] = useState<ScbAttempt | null>(null);
  const [grade, setGrade] = useState<ScbGrade | null>(null);
  const { progress, recordAttempt, resetProgress, logInteraction, analytics } = useExerciseProgress("scoreboard-connector");

  // Live classification drives the diagram and code annotations; goals are revealed only by Check.
  const live = useMemo(() => gradeWiring(learner), [learner]);
  const statusByKey = useMemo(() => new Map(live.connections.map((c) => [c.key, c.status])), [live]);

  const pick = (id: string) => {
    logInteraction();
    if (!selected) {
      setSelected(id);
      setLast(null);
      return;
    }
    if (selected === id) {
      setSelected(null);
      return;
    }
    const attempt = attemptConnection(learner, selected, id);
    setLast(attempt);
    setSelected(null);
    if (attempt.recorded) {
      setLearner((cs) => [...cs, { from: selected, to: id }]);
      setGrade(null);
    }
  };

  const removeConnection = (key: string) => {
    logInteraction();
    setLearner((cs) => cs.filter((c) => connectionKey(c) !== key));
    setLast(null);
    setGrade(null);
  };

  const check = () => {
    const result = gradeWiring(learner);
    setGrade(result);
    setSelected(null);
    recordAttempt(result.score);
  };

  const resetBoard = () => {
    logInteraction();
    setLearner([]);
    setSelected(null);
    setLast(null);
    setGrade(null);
  };

  // Diagram
  const recorded = [...SCB_GIVEN, ...learner];
  const errorEnds = last && !last.recorded ? [last.result.from, last.result.to] : [];
  const lastKey = last?.recorded ? connectionKey({ from: last.result.from, to: last.result.to }) : undefined;
  const nodes: DiagramNode[] = SCB_TOPOLOGY.components
    .filter((c) => BOXES[c.id])
    .map((c) => {
      const box = BOXES[c.id];
      return { id: c.id, label: c.name, sublabel: box.sublabel, kind: nodeKind(c.id, c.kind), x: box.x, y: box.y, w: box.w, h: box.h, container: box.container };
    });
  const ports: DiagramPort[] = SCB_TOPOLOGY.endpoints.map((ep) => ({
    id: ep.id,
    nodeId: ep.owner,
    side: PORT_PLACES[ep.id]?.side ?? "left",
    offset: PORT_PLACES[ep.id]?.offset ?? 0.5,
    kind: portKindOf(ep),
    label: ep.handle,
    state: selected === ep.id ? "active" : errorEnds.includes(ep.id) ? "error" : "normal",
  }));
  const edges: DiagramEdge[] = recorded.map((c) => {
    const key = connectionKey(c);
    const wrong = statusByKey.get(key) === "wrong";
    const method = methodLabel(SCB_TOPOLOGY.endpoints.find((e) => e.id === c.from) as TlmEndpoint);
    return {
      id: key,
      from: c.from,
      to: c.to,
      style: "causal",
      label: wrong ? `✕ ${method}` : method,
      state: wrong ? "error" : key === lastKey ? "active" : "normal",
    };
  });
  const diagramTitle = `bus_env: ${learner.length} connect() call${learner.length === 1 ? "" : "s"} made. ${
    learner.map((c) => `${endpointRef(c.from)} to ${endpointRef(c.to)}${statusByKey.get(connectionKey(c)) === "wrong" ? " (wrong stream)" : ""}`).join("; ") ||
    "No checking-side connections yet."
  }`;

  // Code
  const codeLines: CodeTraceLine[] = connectPhaseSource(learner).map((l) => ({
    text: l.key && statusByKey.get(l.key) === "wrong" ? `${l.text}  // ✕ wrong stream` : l.text,
    key: l.given ? undefined : l.key,
    owner: "testbench",
  }));

  return (
    <VisualFrame
      label="Scoreboard connector exercise"
      eyebrow="Exercise"
      title="Wire the checking side of an agent environment"
      summary="Write bus_env's connect_phase: pick the endpoint that calls connect(), then its argument. Each attempt runs uvm-core's connect() checks; Check grades the wiring against four goals."
      fidelity="model"
      assumptions={SCOREBOARD_CONNECTOR_ASSUMPTIONS}
      className="my-0 w-full"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        <div>
          <p className="font-semibold text-foreground">Best score: {progress.bestScore}%</p>
          <p>
            Attempts: {progress.attempts}
            {progress.lastPlayedLabel ? ` · Last played ${progress.lastPlayedLabel}` : ""}
          </p>
          {progress.attempts > 0 ? (
            <p className="text-xs">
              Average score: {Math.round(analytics.competency)}% · Interactions: {analytics.engagement}
            </p>
          ) : null}
        </div>
        {progress.attempts > 0 ? (
          <button type="button" onClick={resetProgress} className={cn(buttonClass(), "text-xs")}>
            Clear saved progress
          </button>
        ) : null}
      </div>

      <div className="text-sm text-foreground">
        <p className="font-semibold">Goals</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">
          {SCB_GOALS.map((g) => (
            <li key={g.id}>
              {g.label}{" "}
              <span className="font-mono text-xs [font-variant-ligatures:none]">
                ({endpointRef(g.from)} → {endpointRef(g.reaches)})
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-1 text-xs text-muted-foreground">The driver and sequencer belong to the agent and are already connected.</p>
      </div>

      <BlockDiagram
        title={diagramTitle}
        width={DIAGRAM.width}
        height={DIAGRAM.height}
        nodes={nodes}
        ports={ports}
        edges={edges}
        minWidth={520}
        showLegend
      />
      <p className="text-xs text-muted-foreground">
        Dashed arrows point from the caller of connect() to its argument, which is also the direction write() calls travel. ✕ marks a stream the
        checker must not receive.
      </p>

      <div
        role="group"
        aria-label="Ports, exports and imps. Pick the caller of connect(), then its argument. Escape cancels."
        className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]"
        onKeyDown={(e) => {
          if (e.key === "Escape" && selected) {
            e.preventDefault();
            setSelected(null);
          }
        }}
      >
        {ENDPOINT_GROUPS.map((c) => (
          <fieldset key={c.id} className="min-w-0 rounded-lg border border-border p-2">
            <legend className="px-1 font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">
              {componentRef(c.id)} · {c.cls}
            </legend>
            <div className="flex flex-col gap-1">
              {SCB_TOPOLOGY.endpoints
                .filter((e) => e.owner === c.id)
                .map((ep) => {
                  const isSel = selected === ep.id;
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      aria-pressed={isSel}
                      aria-label={`${endpointRef(ep.id)} (${ep.role}, ${ep.typeName})`}
                      onClick={() => pick(ep.id)}
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-md border px-2 py-1 text-left font-mono text-xs text-foreground transition-colors [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                        isSel ? "border-cyan-500 bg-cyan-500/15" : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      <span aria-hidden className="w-3 text-center">
                        {GLYPH[portKindOf(ep)]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{ep.handle}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {ep.role} · {ep.typeName}
                        </span>
                      </span>
                      {isSel ? <span className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">caller</span> : null}
                    </button>
                  );
                })}
            </div>
          </fieldset>
        ))}
      </div>

      <div aria-live="polite" className="min-h-6 text-sm text-foreground">
        {selected ? (
          <p>
            Caller: <code className="font-mono [font-variant-ligatures:none]">{endpointRef(selected)}</code>. Now pick the argument:{" "}
            <code className="font-mono [font-variant-ligatures:none]">{endpointRef(selected)}.connect(…);</code>{" "}
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground underline underline-offset-2">
              Cancel
            </button>
          </p>
        ) : last ? (
          <AttemptVerdict attempt={last} />
        ) : (
          <p className="text-muted-foreground">Pick the endpoint that calls connect().</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={check} className={buttonClass("primary")}>
          Check wiring
        </button>
        <button type="button" onClick={resetBoard} className={buttonClass()}>
          Reset board
        </button>
      </div>
      <HintLadder hints={HINTS} />

      <CodeTrace
        label="Generated connect_phase code"
        lines={codeLines}
        renderLineControl={(line) =>
          line.key ? (
            <button
              type="button"
              onClick={() => removeConnection(line.key as string)}
              aria-label={`Remove ${line.text}`}
              className="rounded-md border border-slate-500 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              remove
            </button>
          ) : null
        }
      />

      {grade ? <GradeReport grade={grade} /> : null}

      {grade?.passed ? <AfterSuccess learner={learner} /> : null}
    </VisualFrame>
  );
};

// ── Sub-views ───────────────────────────────────────────────────────────────

function AttemptVerdict({ attempt }: { attempt: ScbAttempt }) {
  const cls =
    attempt.outcome === "connected" || attempt.outcome === "duplicate" ? tone.ok : attempt.outcome === "flagged" ? tone.warn : tone.bad;
  return (
    <div className="space-y-1" data-testid="connect-verdict">
      <p className={cn("font-semibold", cls)}>
        {attempt.headline} <code className="break-all font-mono font-normal [font-variant-ligatures:none]">{attempt.code}</code>
      </p>
      {attempt.result.log ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-950/90 p-2 font-mono text-[12px] text-slate-100 [font-variant-ligatures:none]">
          {attempt.result.log}
        </pre>
      ) : attempt.result.kind === "compile_error" ? (
        <p className="font-mono text-xs [font-variant-ligatures:none]">{attempt.result.message}</p>
      ) : null}
      <p className="text-muted-foreground">
        <strong className="text-foreground">Why: </strong>
        {attempt.why}
      </p>
      {attempt.fix ? (
        <p className="text-muted-foreground">
          <strong className="text-foreground">Fix: </strong>
          <code className="break-all font-mono [font-variant-ligatures:none]">{attempt.fix}</code>
        </p>
      ) : null}
    </div>
  );
}

function GradeReport({ grade }: { grade: ScbGrade }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="exercise-feedback"
      className={cn(
        "space-y-3 rounded-lg border bg-card p-4 text-sm text-foreground",
        grade.passed ? "border-emerald-500/60" : "border-amber-500/60",
      )}
    >
      <div>
        <p className="text-lg font-semibold">Score: {grade.score}%</p>
        <p className={grade.passed ? tone.ok : tone.warn}>
          {grade.passed ? "✓ " : "! "}
          {grade.message}
        </p>
      </div>
      <div>
        <p className="font-semibold">Goals</p>
        <ul aria-label="Goal results" className="mt-1 space-y-1">
          {grade.goals.map((g) => (
            <li key={g.id}>
              <span className={cn("font-semibold", g.met ? tone.ok : tone.bad)}>
                {g.met ? "✓" : "✕"} {g.label}
              </span>
              {g.met ? null : <span className="block text-muted-foreground">{g.missingWhy}</span>}
            </li>
          ))}
        </ul>
        {grade.goals.some((g) => !g.met) ? <p className="mt-1 text-xs text-muted-foreground">{SILENT_MISSING_NOTE}</p> : null}
      </div>
      <div>
        <p className="font-semibold">Your connect() calls</p>
        {grade.connections.length === 0 ? (
          <p className="text-muted-foreground">None yet.</p>
        ) : (
          <ul aria-label="Per-connection feedback" className="mt-1 space-y-1">
            {grade.connections.map((c) => (
              <li key={c.key}>
                <span className={cn("font-semibold", c.status === "serves" ? tone.ok : c.status === "wrong" ? tone.bad : "text-muted-foreground")}>
                  {STATUS_GLYPH[c.status]}{" "}
                </span>
                <code className="break-all font-mono text-xs [font-variant-ligatures:none]">{c.code}</code>
                <span className="block text-muted-foreground">{c.why}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">UVM&apos;s own verdict: </strong>
        {grade.uvmVerdict}
      </p>
    </div>
  );
}

function AfterSuccess({ learner }: { learner: TlmConnection[] }) {
  const calls = writeCallOrder(learner);
  const options = callOrderPrediction(learner);
  return (
    <PredictionPrompt
      question="agt.mon.ap.write(t) now has three subscribers. In uvm-core 2020.3.1, whose write() runs first?"
      options={options}
    >
      <div className="space-y-4 text-sm text-foreground">
        <div>
          <p className="font-semibold">One monitor write(), in call order</p>
          <ol aria-label="write() call order" className="mt-1 space-y-1">
            {calls.map((c) => (
              <li key={c.index} className={cn("rounded-md border border-border bg-background p-2", c.depth > 0 && "ml-6")}>
                <span className="font-mono text-xs [font-variant-ligatures:none]">
                  {c.index}. {c.call}
                </span>{" "}
                <span className="text-muted-foreground">{c.effect}</span>
                <span className="block break-all font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{c.fullName}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-muted-foreground">
            <strong className="text-foreground">Name-ordered: </strong>
            {CALL_ORDER_RULE}
          </p>
        </div>
        <div>
          <p className="font-semibold">Why the FIFOs give the scoreboard its own thread</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            {FIFO_THREAD_POINTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <CodeTrace label="bus_scoreboard run_phase" lines={scoreboardRunPhaseSource().map((text) => ({ text, owner: "testbench" }))} />
      </div>
    </PredictionPrompt>
  );
}

export default ScoreboardConnectorExercise;
