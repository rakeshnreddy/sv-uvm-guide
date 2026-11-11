"use client";

import React, { useId, useMemo } from "react";

import { cycleEdgeKeys, edgeKey, HOLDER_EDGE_NOTE, type WaitForGraph as WaitForGraphData, type WaitForNode } from "@/lib/sv-ipc-smell-scenarios";
import { cn } from "@/lib/utils";

interface WaitForGraphProps {
  graph: WaitForGraphData;
  /** Accessible name prefix, e.g. "Wait-for graph at t = 5 ns". */
  label: string;
  className?: string;
}

const W = 320;
const ROW = 74;
const PAD = 40;
const NODE_W = 76;
const NODE_H = 30;

interface Placed extends WaitForNode {
  x: number;
  y: number;
}

/** Processes alternate between the left and right columns; semaphores sit in the middle. */
function layout(nodes: WaitForNode[]): { placed: Placed[]; height: number } {
  const procs = nodes.filter((n) => n.kind === "process");
  const sems = nodes.filter((n) => n.kind === "semaphore");
  const left = procs.filter((_, i) => i % 2 === 0);
  const right = procs.filter((_, i) => i % 2 === 1);
  const rows = Math.max(left.length, right.length, sems.length, 1);
  const height = PAD * 2 + (rows - 1) * ROW;
  const column = (list: WaitForNode[], x: number): Placed[] =>
    list.map((n, i) => ({ ...n, x, y: PAD + (list.length === 1 ? ((rows - 1) * ROW) / 2 : (i * (rows - 1) * ROW) / Math.max(list.length - 1, 1)) }));
  return { placed: [...column(left, 52), ...column(sems, W / 2), ...column(right, W - 52)], height: Math.max(height, PAD * 2) };
}

/** Point where the segment from (x, y) toward (tx, ty) leaves a node box of half-size (hw, hh). */
function exitPoint(x: number, y: number, tx: number, ty: number, hw: number, hh: number) {
  const dx = tx - x;
  const dy = ty - y;
  if (dx === 0 && dy === 0) return { x, y };
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
  return { x: x + dx * scale, y: y + dy * scale };
}

/**
 * Wait-for graph for semaphores: process -> the semaphore it waits on;
 * semaphore -> the process its key was taken by. The holder edges are model
 * bookkeeping (a semaphore does not track owners, IEEE 1800-2023 §15.3), so
 * they are dashed and say so. Edges on a closed cycle are drawn in rose.
 */
export function WaitForGraph({ graph, label, className }: WaitForGraphProps) {
  const baseId = useId().replace(/:/g, "");
  const { placed, height } = useMemo(() => layout(graph.nodes), [graph.nodes]);
  const onCycle = useMemo(() => cycleEdgeKeys(graph), [graph]);
  const at = (id: string) => placed.find((n) => n.id === id);
  const hasCycle = graph.cycles.length > 0;
  const summary = graph.edges.length
    ? graph.edges.map((e) => `${e.from.replace(/^\w+:/, "")} to ${e.to.replace(/^\w+:/, "")}: ${e.label}${onCycle.has(edgeKey(e)) ? ", on the cycle" : ""}`).join("; ")
    : "no process waits and no key is taken";
  const markers = { waits: `${baseId}-waits`, held: `${baseId}-held`, cycle: `${baseId}-cycle` };

  return (
    <figure className={cn("rounded-xl border border-border bg-card p-2", hasCycle && "border-rose-500/60", className)}>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${label}: ${summary}.${hasCycle ? " The graph has a closed cycle." : ""}`} className="w-full max-w-[420px] text-foreground">
        <defs>
          {(
            [
              ["waits", "fill-amber-600 dark:fill-amber-300"],
              ["held", "fill-slate-500 dark:fill-slate-400"],
              ["cycle", "fill-rose-600 dark:fill-rose-400"],
            ] as const
          ).map(([kind, cls]) => (
            <marker key={kind} id={markers[kind]} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={cls} />
            </marker>
          ))}
        </defs>
        {graph.edges.map((e) => {
          const a = at(e.from);
          const b = at(e.to);
          if (!a || !b) return null;
          const reverse = graph.edges.some((o) => o.from === e.to && o.to === e.from);
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const off = reverse ? 7 : 0;
          const nx = (-(b.y - a.y) / len) * off;
          const ny = ((b.x - a.x) / len) * off;
          const p = exitPoint(a.x + nx, a.y + ny, b.x + nx, b.y + ny, NODE_W / 2 + 2, NODE_H / 2 + 2);
          const q = exitPoint(b.x + nx, b.y + ny, a.x + nx, a.y + ny, NODE_W / 2 + 4, NODE_H / 2 + 4);
          const cyc = onCycle.has(edgeKey(e));
          const tone = cyc ? "cycle" : e.kind;
          const mx = (p.x + q.x) / 2 + nx * 1.6;
          const my = (p.y + q.y) / 2 + ny * 1.6;
          return (
            <g key={edgeKey(e)}>
              <title>{e.label}</title>
              <line
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                markerEnd={`url(#${markers[tone]})`}
                strokeWidth={cyc ? 2.5 : 1.5}
                strokeDasharray={e.kind === "held" ? "5 4" : undefined}
                className={cn(
                  "transition-colors duration-300 motion-reduce:transition-none",
                  cyc ? "stroke-rose-600 dark:stroke-rose-400" : e.kind === "waits" ? "stroke-amber-600 dark:stroke-amber-300" : "stroke-slate-500 dark:stroke-slate-400",
                )}
              />
              <text
                x={mx}
                y={my - 3}
                fontSize={9.5}
                textAnchor="middle"
                className={cn(cyc ? "fill-rose-700 dark:fill-rose-300" : "fill-muted-foreground")}
                paintOrder="stroke"
                stroke="hsl(var(--background))"
                strokeWidth={3}
              >
                {e.kind === "waits" ? "waits for" : "held by*"}
              </text>
            </g>
          );
        })}
        {placed.map((n) => {
          const involved = graph.cycles.some((cy) => cy.includes(n.id));
          return (
            <g key={n.id}>
              <rect
                x={n.x - NODE_W / 2}
                y={n.y - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={n.kind === "semaphore" ? NODE_H / 2 : 6}
                strokeWidth={involved ? 2 : 1.25}
                className={cn(
                  n.kind === "semaphore" ? "fill-amber-500/10" : "fill-cyan-500/10",
                  involved ? "stroke-rose-600 dark:stroke-rose-400" : n.kind === "semaphore" ? "stroke-amber-600/70 dark:stroke-amber-300/70" : "stroke-cyan-600/70 dark:stroke-cyan-300/70",
                )}
              />
              <text x={n.x} y={n.y + 4} fontSize={11.5} textAnchor="middle" fill="currentColor" className="font-mono [font-variant-ligatures:none]">
                {n.kind === "semaphore" ? `⚿ ${n.label}` : n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="space-y-1 px-1 pt-1 text-xs text-muted-foreground">
        <span className="block">
          <span aria-hidden className="text-amber-700 dark:text-amber-300">→</span> process waits for a semaphore (queued in get(), §15.3.3);{" "}
          <span aria-hidden>⇢</span> held by*: the key was taken by that process. *{HOLDER_EDGE_NOTE} (§15.3: put() takes only a count).{" "}
          <span className="text-rose-700 dark:text-rose-300">Rose</span>: a closed cycle.
        </span>
        <span className="sr-only">Edges: {summary}.</span>
      </figcaption>
    </figure>
  );
}

export default WaitForGraph;
