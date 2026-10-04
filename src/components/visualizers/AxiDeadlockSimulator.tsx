"use client";

import React, { useMemo, useState } from "react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import type { DependencyEdge } from "@/lib/axi-dependency-model";
import {
  DEADLOCK_PRESETS,
  DEADLOCK_VERDICT_LABELS,
  PREDICTION_CHOICES,
  WRITE_POLICIES,
  analyzeWriteConfig,
  policyKey,
  predictionFeedback,
  type DeadlockAnalysis,
  type PolicyId,
  type WaitPolicy,
} from "@/lib/axi-deadlock-model";
import { cn } from "@/lib/utils";

export const DEADLOCK_ASSUMPTIONS = [
  "One write transaction on one master–slave interface. Read channels follow the same rules (IHI0022E §A3.3.1).",
  "An arrow X → Y means X is not asserted until Y is. A deadlock is a closed loop of such waits; the model lists every loop.",
  "Legality follows IHI0022E §A3.2.1 and §A3.3.1: a source must not wait for READY; a destination may wait for VALID; BVALID must follow the AW and WLAST handshakes (AXI4).",
  "Interconnect-level deadlocks, such as W-data ordering across two slaves, are out of scope.",
];

// ---------------------------------------------------------------------------
// Wait-for graph geometry (view only)
// ---------------------------------------------------------------------------

const ROW_Y: Record<string, number> = { AW: 40, W: 110, B: 180 };
const NODE_W = 104;
const NODE_H = 30;
const MASTER_X = 12;
const SLAVE_X = 244;

const rowOf = (signal: string) => (signal.startsWith("AW") ? "AW" : signal.startsWith("W") ? "W" : "B");

function nodeBox(node: string) {
  const [owner, signal] = node.split(".");
  const y = ROW_Y[rowOf(signal)];
  const x = owner === "master" ? MASTER_X : SLAVE_X;
  return { x, y: y - NODE_H / 2, cy: y, anchorX: owner === "master" ? x + NODE_W : x, signal, owner };
}

const GRAPH_NODES = ["master.AWVALID", "master.WVALID", "master.BREADY", "slave.AWREADY", "slave.WREADY", "slave.BVALID"];

function edgeGeometry(edge: DependencyEdge) {
  const a = nodeBox(edge.from);
  const b = nodeBox(edge.to);
  const p1 = { x: a.anchorX, y: a.cy };
  const p2 = { x: b.anchorX, y: b.cy };
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = 18;
  const c = { x: (p1.x + p2.x) / 2 + (-dy / len) * bow, y: (p1.y + p2.y) / 2 + (dx / len) * bow };
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * c.x + t * t * p2.x,
    y: (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * c.y + t * t * p2.y,
  });
  const tx = p2.x - c.x;
  const ty = p2.y - c.y;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const head = [
    `${p2.x},${p2.y}`,
    `${p2.x - ux * 9 - uy * 4.5},${p2.y - uy * 9 + ux * 4.5}`,
    `${p2.x - ux * 9 + uy * 4.5},${p2.y - uy * 9 - ux * 4.5}`,
  ].join(" ");
  return { d: `M ${p1.x} ${p1.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`, head, badge: at(0.35) };
}

const inLoop = (analysis: DeadlockAnalysis, edge: DependencyEdge) =>
  analysis.cycles.some((cycle) => cycle.slice(0, -1).some((from, i) => from === edge.from && cycle[i + 1] === edge.to));

const pretty = (node: string) => node.replace(".", " ");

function WaitGraph({ analysis }: { analysis: DeadlockAnalysis }) {
  const loopNodes = new Set(analysis.cycles.flat());
  const label =
    analysis.cycles.length > 0
      ? `Wait-for graph with ${analysis.edges.length} waits. Loop: ${analysis.cycles.map((c) => c.map(pretty).join(" → ")).join("; ")}.`
      : `Wait-for graph with ${analysis.edges.length} waits and no loop.`;
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-2">
      <svg viewBox="0 0 360 214" role="img" aria-label={label} className="h-auto w-full min-w-[300px] max-w-[520px]">
        <text x={MASTER_X} y={12} className="fill-muted-foreground text-[10px] font-semibold uppercase">
          Master
        </text>
        <text x={SLAVE_X} y={12} className="fill-muted-foreground text-[10px] font-semibold uppercase">
          Slave
        </text>
        {analysis.edges.map((edge, i) => {
          const g = edgeGeometry(edge);
          const loop = inLoop(analysis, edge);
          const required = edge.legality === "legal";
          const stroke = loop ? "stroke-rose-500" : required ? "stroke-slate-400" : "stroke-amber-600 dark:stroke-amber-400";
          const fill = loop ? "fill-rose-500" : required ? "fill-slate-400" : "fill-amber-600 dark:fill-amber-400";
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <path d={g.d} fill="none" className={stroke} strokeWidth={loop ? 2.5 : 1.5} strokeDasharray={loop ? undefined : "5 4"} />
              <polygon points={g.head} className={fill} />
              <circle cx={g.badge.x} cy={g.badge.y} r={8} className="fill-background stroke-border" strokeWidth={1} />
              <text x={g.badge.x} y={g.badge.y + 3.5} textAnchor="middle" className="fill-foreground text-[10px] font-semibold">
                {i + 1}
              </text>
            </g>
          );
        })}
        {GRAPH_NODES.map((node) => {
          const box = nodeBox(node);
          const looped = loopNodes.has(node);
          return (
            <g key={node}>
              <rect
                x={box.x}
                y={box.y}
                width={NODE_W}
                height={NODE_H}
                rx={6}
                className={cn(looped ? "fill-rose-500/15 stroke-rose-500" : "fill-card stroke-border")}
                strokeWidth={looped ? 2 : 1}
              />
              <text x={box.x + NODE_W / 2} y={box.cy + 4} textAnchor="middle" className="fill-foreground font-mono text-[11px]">
                {looped ? `↻ ${box.signal}` : box.signal}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Arrow X → Y: X waits for Y. Numbers match the list below. Thick solid arrows and ↻ nodes form a loop; grey arrows are waits AXI4 requires.
      </p>
    </div>
  );
}

function legalityTag(edge: DependencyEdge) {
  if (edge.legality === "illegal") return { text: "✕ forbidden wait", className: "text-rose-700 dark:text-rose-300" };
  if (edge.legality === "legal-destination-policy") return { text: "✓ allowed wait", className: "text-emerald-700 dark:text-emerald-300" };
  return { text: "■ required by AXI4", className: "text-muted-foreground" };
}

function Outcome({ analysis }: { analysis: DeadlockAnalysis }) {
  const verdict = DEADLOCK_VERDICT_LABELS[analysis.verdict];
  return (
    <div className="space-y-3" aria-live="polite">
      <p
        className={cn(
          "rounded-lg border p-3 text-sm font-semibold",
          analysis.verdict === "deadlock" && "border-rose-500/60 bg-rose-500/10 text-rose-800 dark:text-rose-200",
          analysis.verdict === "latent-violation" && "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100",
          analysis.verdict === "safe" && "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        )}
      >
        <span aria-hidden>{verdict.glyph} </span>
        Model result: {verdict.title}
      </p>
      {analysis.cycles.length > 0 ? (
        <ol className="space-y-1 text-sm" aria-label="Wait-for loops">
          {analysis.cycles.map((cycle) => (
            <li key={cycle.join(">")} className="font-mono text-rose-800 [font-variant-ligatures:none] dark:text-rose-200">
              ↻ {cycle.map(pretty).join(" → ")}
            </li>
          ))}
        </ol>
      ) : null}
      <WaitGraph analysis={analysis} />
      <ol className="space-y-2 text-sm" aria-label="Waits in this configuration">
        {analysis.edges.map((edge, i) => {
          const tag = legalityTag(edge);
          return (
            <li key={`${edge.from}-${edge.to}`} className="rounded-lg border border-border/60 p-2">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold text-muted-foreground">{i + 1}.</span>
                <span className="font-mono [font-variant-ligatures:none]">
                  {pretty(edge.from)} waits for {pretty(edge.to)}
                </span>
                <span className={cn("text-xs font-semibold", tag.className)}>{tag.text}</span>
                {edge.rule ? <span className="font-mono text-[11px] text-muted-foreground">{edge.rule}</span> : null}
              </p>
              <p className="mt-1 text-muted-foreground">{edge.explanation}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PolicyGroup({ side, title, selected, onToggle }: { side: WaitPolicy["side"]; title: string; selected: PolicyId[]; onToggle: (id: PolicyId) => void }) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-border/70 p-3">
      <legend className="px-1 text-sm font-semibold text-foreground">{title}</legend>
      <div className="space-y-1">
        {WRITE_POLICIES.filter((p) => p.side === side).map((policy) => (
          <label key={policy.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-1 text-sm hover:bg-muted/50">
            <input type="checkbox" checked={selected.includes(policy.id)} onChange={() => onToggle(policy.id)} className="h-4 w-4 accent-cyan-600" />
            <span className="font-mono [font-variant-ligatures:none]">{policy.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function AxiDeadlockSimulator() {
  const [policies, setPolicies] = useState<PolicyId[]>(DEADLOCK_PRESETS[0].policies);
  const key = policyKey(policies);
  const analysis = useMemo(() => analyzeWriteConfig(policies), [policies]);

  const toggle = (id: PolicyId) => setPolicies((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const options: PredictionOption[] = PREDICTION_CHOICES.map((choice) => ({
    id: choice.id,
    label: choice.label,
    correct: choice.id === analysis.verdict,
    feedback: predictionFeedback(analysis, choice.id),
  }));

  return (
    <div data-testid="axi-deadlock-simulator">
      <VisualFrame
        label="AXI write deadlock experiment"
        eyebrow="Experiment"
        title="Will this write deadlock?"
        summary="Choose which signals wait for which on each side. Predict the outcome, then see the wait-for graph and every loop in it."
        fidelity="model"
        assumptions={DEADLOCK_ASSUMPTIONS}
      >
        <div role="group" aria-label="Presets" className="flex flex-wrap gap-2">
          {DEADLOCK_PRESETS.map((preset) => {
            const active = policyKey(preset.policies) === key;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPolicies(preset.policies)}
                className={cn(
                  "min-h-10 rounded-full border px-3 text-xs transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
                )}
              >
                {preset.name}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          <PolicyGroup side="master" title="Master waits (drives AW, W; receives B)" selected={policies} onToggle={toggle} />
          <PolicyGroup side="slave" title="Slave waits (receives AW, W; drives B)" selected={policies} onToggle={toggle} />
        </div>
        <p className="text-xs text-muted-foreground">
          Always present: the slave&apos;s BVALID waits for the AW handshake and the W handshake carrying WLAST (AXI4, IHI0022E §A3.3.1).
        </p>

        <PredictionPrompt question="With these waits, what happens to a single write?" options={options} resetKey={key}>
          <Outcome analysis={analysis} />
        </PredictionPrompt>
      </VisualFrame>
    </div>
  );
}
