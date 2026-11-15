"use client";

import React, { useId } from "react";

import {
  describeTree,
  TREE_STATE_TEXT,
  treeRows,
  type NodeVerdict,
  type TreeNode,
} from "@/lib/sv-process-tree-scenarios";
import type { ThreadState } from "@/lib/sv-process-model";
import { cn } from "@/lib/utils";

/** What a revealed process-control statement did to a node. */
export type TreeMark = "killed" | "waited" | "forced-out";

export const TREE_MARK_TEXT: Record<TreeMark, { glyph: string; text: string }> = {
  killed: { glyph: "✕", text: "killed" },
  waited: { glyph: "⧖", text: "waited for" },
  "forced-out": { glyph: "↩", text: "forced out" },
};

export const VERDICT_TEXT: Record<NodeVerdict, string> = {
  hit: "you picked it",
  missed: "you missed it",
  extra: "not reached",
  clear: "not reached",
};

/*
 * Node states sit on a neutral card surface and are told apart by glyph and
 * text, not by signal colours (DESIGN.md section 3: cyan, slate, rose and amber
 * keep their value meanings). Contract roles carry the two end states.
 */
const STATE_GLYPH: Record<ThreadState, { glyph: string; className: string }> = {
  pending: { glyph: "◌", className: "fill-muted-foreground" },
  ready: { glyph: "●", className: "fill-muted-foreground" },
  running: { glyph: "▶", className: "fill-primary" },
  blocked: { glyph: "⏸", className: "fill-foreground" },
  done: { glyph: "✓", className: "fill-success" },
  killed: { glyph: "✕", className: "fill-danger" },
};

/*
 * Sized so the drawing's viewBox stays at or under about 300 units for the
 * scenarios' depth of 2, so at 390 px (about 300 px of drawing) the 12 and 13
 * px text renders at full size. MARK_W fits the longest mark ("↩ forced out",
 * "⧖ waited for", "◆ caller", about 12 characters at 12 px); the full caller
 * note goes in the text outline, and the prompt names the statement.
 */
const ROW_H = 44;
const BOX_W = 140;
const BOX_H = 32;
const INDENT = 24;
const PAD = 8;
const MARK_W = 88;
/** Labels longer than this are cut with an ellipsis so they fit BOX_W (13 px mono). */
const MAX_LABEL = 11;
/** The drawing may grow to this multiple of its viewBox width, so it does not balloon on wide screens. */
const MAX_SCALE = 1.25;

interface ProcessTreeViewProps {
  tree: TreeNode[];
  time: number;
  /** The process the current step is about (gets the accent marker). */
  currentPid?: number;
  /** The process about to run (or that ran) the statement being predicted. */
  callerPid?: number;
  /** Text-outline note for the caller, e.g. "the caller, runs disable fork;". The drawing shows "◆ caller". */
  callerNote?: string;
  /** Processes the learner may tap while predicting. */
  selectable?: number[];
  selected?: number[];
  onToggle?: (pid: number) => void;
  /** Revealed effect of the statement, per node. */
  marks?: Record<number, TreeMark>;
  verdicts?: Record<number, NodeVerdict>;
  /** Caption for the marks, e.g. "Marks: what disable fork; reached at t = 15 ns". */
  marksCaption?: string;
  className?: string;
}

/**
 * The parent-child process tree at one trace step, as an indented tree (one
 * row per process) so it stays readable at 390 px. The SVG is an image with a
 * text outline as its equivalent; while predicting, every candidate is also a
 * toggle button.
 */
export default function ProcessTreeView({
  tree,
  time,
  currentPid,
  callerPid,
  callerNote = "calls it",
  selectable,
  selected = [],
  onToggle,
  marks,
  verdicts,
  marksCaption,
  className,
}: ProcessTreeViewProps) {
  const outlineId = useId();
  const rows = treeRows(tree);
  const maxDepth = Math.max(0, ...rows.map((r) => r.node.depth));
  const width = PAD + maxDepth * INDENT + BOX_W + 8 + MARK_W;
  const height = Math.max(ROW_H, rows.length * ROW_H + 4);
  const canPick = (pid: number) => Boolean(selectable?.includes(pid) && onToggle);
  const xOf = (depth: number) => PAD + depth * INDENT;
  const yOf = (row: number) => row * ROW_H + 6;
  const markText = (pid: number) => {
    const mark = marks?.[pid];
    return mark ? `${TREE_MARK_TEXT[mark].glyph} ${TREE_MARK_TEXT[mark].text}` : undefined;
  };

  return (
    <figure className={cn("rounded-xl border border-border bg-card p-3", className)}>
      <p className="mb-2 text-label text-muted-foreground">Process tree at t = {time} ns</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No process exists yet.</p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={describeTree(tree, time)}
          aria-describedby={outlineId}
          className="mx-auto block w-full text-foreground"
          style={{ maxWidth: width * MAX_SCALE }}
        >
          {rows.map(({ node, row, parentRow }) =>
            parentRow === null ? null : (
              <path
                key={`edge-${node.pid}`}
                d={`M ${xOf(node.depth - 1) + 12} ${yOf(parentRow) + BOX_H} V ${yOf(row) + BOX_H / 2} H ${xOf(node.depth)}`}
                fill="none"
                className="stroke-muted-foreground"
                strokeOpacity={0.6}
                strokeWidth={1.5}
              />
            ),
          )}
          {rows.map(({ node, row }) => {
            const x = xOf(node.depth);
            const y = yOf(row);
            const picked = selected.includes(node.pid);
            const pickable = canPick(node.pid);
            const state = STATE_GLYPH[node.state];
            const mark = markText(node.pid);
            const isCaller = callerPid === node.pid;
            const ended = node.state === "done" || node.state === "killed";
            return (
              <g
                key={node.pid}
                data-pid={node.pid}
                onClick={pickable ? () => onToggle?.(node.pid) : undefined}
                className={pickable ? "cursor-pointer" : undefined}
              >
                <rect
                  x={x}
                  y={y}
                  width={BOX_W}
                  height={BOX_H}
                  rx={8}
                  className={cn("fill-card", picked ? "stroke-primary" : isCaller ? "stroke-foreground" : "stroke-border")}
                  strokeWidth={picked || isCaller ? 2.5 : 1.5}
                />
                {currentPid === node.pid ? <rect x={x} y={y + 6} width={3} height={BOX_H - 12} rx={1.5} className="fill-primary" /> : null}
                {pickable ? (
                  <text x={x + 10} y={y + 21} fontSize={13} className={picked ? "fill-primary" : "fill-muted-foreground"}>
                    {picked ? "☑" : "☐"}
                  </text>
                ) : null}
                <text
                  x={x + (pickable ? 26 : 12)}
                  y={y + 21}
                  fontSize={13}
                  className={cn("font-mono [font-variant-ligatures:none]", ended ? "fill-muted-foreground" : "fill-foreground")}
                  textDecoration={node.state === "killed" ? "line-through" : undefined}
                >
                  {node.label.length > MAX_LABEL ? (
                    <>
                      <title>{node.label}</title>
                      {`${node.label.slice(0, MAX_LABEL - 1)}…`}
                    </>
                  ) : (
                    node.label
                  )}
                </text>
                <text x={x + BOX_W - 12} y={y + 21} fontSize={13} textAnchor="middle" className={state.className}>
                  {state.glyph}
                </text>
                {mark ? (
                  <text x={x + BOX_W + 8} y={y + 21} fontSize={12} fontWeight={600} className={marks?.[node.pid] === "killed" ? "fill-danger" : "fill-foreground"}>
                    {mark}
                  </text>
                ) : isCaller ? (
                  <text x={x + BOX_W + 8} y={y + 21} fontSize={12} className="fill-muted-foreground">
                    ◆ caller
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      )}
      <ul id={outlineId} className="sr-only">
        {rows.map(({ node }) => {
          const parent = node.parent !== null ? tree.find((n) => n.pid === node.parent) : undefined;
          const mark = marks?.[node.pid];
          return (
            <li key={node.pid}>
              {node.label}: {TREE_STATE_TEXT[node.state]}, {parent ? `child of ${parent.label}` : "a procedure (root)"}
              {callerPid === node.pid ? `, ${callerNote}` : ""}
              {mark ? `, ${TREE_MARK_TEXT[mark].text}` : ""}
              {verdicts?.[node.pid] ? `, ${VERDICT_TEXT[verdicts[node.pid]]}` : ""}
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        One row per process, indented under the process that forked it. ◌ not started · ● ready · ▶ running · ⏸ blocked · ✓ finished · ✕ killed.
        {marksCaption ? <span className="mt-1 block text-foreground">{marksCaption}</span> : null}
      </figcaption>
      {selectable && onToggle ? (
        <div role="group" aria-label="Processes you predict it reaches" className="mt-3 flex flex-wrap gap-2">
          {rows
            .filter(({ node }) => selectable.includes(node.pid))
            .map(({ node }) => {
              const picked = selected.includes(node.pid);
              return (
                <button
                  key={node.pid}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => onToggle(node.pid)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-lg border bg-muted px-3 font-mono text-sm text-foreground [font-variant-ligatures:none] transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    picked ? "border-primary" : "border-border",
                  )}
                >
                  <span aria-hidden className={picked ? "text-primary" : "text-muted-foreground"}>
                    {picked ? "☑" : "☐"}
                  </span>
                  {node.label}
                </button>
              );
            })}
        </div>
      ) : null}
    </figure>
  );
}
