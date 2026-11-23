"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { declToSource, formatCompact, formatDecimal, isKnown, type SvValue } from "@/lib/sv-expression-model";
import {
  EXCLUDED_NOTE,
  GROUPING_UNAVAILABLE,
  MIN_GROUPING_OPTIONS,
  PLAYGROUND_DECLS,
  analyzeExpression,
  analyzePrecedence,
  analyzeWidth,
  findPrecedencePreset,
  findWidthPreset,
  fullGrouping,
  ifOutcome,
  isParenthesization,
  nodeSummary,
  precedencePresets,
  stepLabel,
  storedOptions,
  tapFeedback,
  valueText,
  widthOptions,
  widthPresets,
  type Bowl,
  type BowlKind,
  type BowlMap,
  type PrecedenceAnalysis,
  type PrecedencePreset,
  type TreeLayout,
  type TreeNodeView,
  type WidthAnalysis,
} from "@/lib/sv-expression-tree-presets";
import { cn } from "@/lib/utils";

export const EXPRESSION_TREE_ASSUMPTIONS = [
  "Grouping follows IEEE 1800-2023 §11.3.2 and Table 11-2. " + EXCLUDED_NOTE,
  "Widths follow §11.6.1 (Table 11-21) and the evaluation steps of §11.8.2; values follow the 4-state operator rules of §11.4.",
  "Unsized constants such as 0 and 255 are at least 32 bits (Table 11-21); the model uses exactly 32, as simulators commonly do.",
  "An if condition that is 0, x or z does not run the branch (§12.4).",
  "A value with a known 1 bit and other bits x or z (u = 4'b1x01) is taken as true by if, !, && and ||: it is nonzero whatever the unknown bits are. §12.4 and §11.4.7 do not spell out partly unknown vectors, so this is the usual simulator behaviour, not a quoted rule.",
  "Precedence fixes the grouping, not the order operands are evaluated in; short-circuiting (§11.3.5) is not shown.",
  "The bowl is this course's picture of a context; the standard speaks of context-determined and self-determined operands.",
];

export interface ExpressionTreeExplorerProps {
  /** "precedence": how Table 11-2 groups an expression. "width": the bowl view of §11.6 and §11.8.2. */
  mode?: "precedence" | "width";
  /** A preset id of the chosen mode (see precedencePresets and widthPresets). */
  preset?: string;
}

export default function ExpressionTreeExplorer({ mode = "precedence", preset }: ExpressionTreeExplorerProps) {
  return mode === "width" ? <WidthView initial={preset} /> : <PrecedenceView initial={preset} />;
}

// ---------------------------------------------------------------------------
// Tree drawing
// ---------------------------------------------------------------------------

const SLOT = 84;
const LEVEL = 72;
const NODE_W = 76;
const NODE_H = 42;
const PAD = 8;
/** The narrowest spacing (node width plus a 4 px gap) and side margin of the compact layout. */
const COMPACT_STEP = NODE_W + 4;
const COMPACT_PAD = 4;

const neutralTreeBody = "bg-[linear-gradient(180deg,hsl(var(--foreground)/var(--fig-quiet-top)),hsl(var(--foreground)/var(--fig-quiet-bottom)))]";
const cyanTreeBody = "bg-[linear-gradient(180deg,hsl(var(--fig-cyan-body)/var(--fig-obj-top)),hsl(var(--fig-cyan-body)/var(--fig-obj-bottom)))]";
const indigoTreeBody = "bg-[linear-gradient(180deg,hsl(var(--fig-indigo-body)/var(--fig-obj-top)),hsl(var(--fig-indigo-body)/var(--fig-obj-bottom)))]";
const roseTreeBody = "bg-[linear-gradient(180deg,hsl(var(--fig-rose-body)/var(--fig-obj-top)),hsl(var(--fig-rose-body)/var(--fig-obj-bottom)))]";
const predictionBody = "bg-[linear-gradient(180deg,hsl(var(--fig-amber-body)/var(--fig-obj-top)),hsl(var(--fig-amber-body)/var(--fig-obj-bottom)))]";
const treeRim = "shadow-[inset_0_1px_hsl(var(--fig-obj-highlight)),0_3px_7px_-4px_hsl(var(--fig-obj-shadow))]";
/** The root of a precedence tree: a raised neutral plate (shadow offset 7), never a hue: cyan means 1 or the current step. */
const rootRim = "shadow-[inset_0_1px_hsl(var(--fig-obj-highlight)),0_7px_12px_-5px_hsl(var(--fig-obj-shadow))]";

const bowlTone: Record<BowlKind, { node: string; bowl: string; tag: string; name: string }> = {
  context: {
    node: cn("border-fig-indigo bg-card", indigoTreeBody),
    bowl: cn("border-fig-indigo", indigoTreeBody),
    tag: "bg-card text-fig-indigo-text",
    name: "context-determined",
  },
  self: {
    node: cn("border-fig-generic bg-card border-dashed", neutralTreeBody),
    bowl: cn("border-fig-generic border-dashed", neutralTreeBody),
    tag: "bg-card text-foreground",
    name: "self-determined",
  },
  compare: {
    node: cn("border-fig-generic bg-card border-dotted", neutralTreeBody),
    bowl: cn("border-fig-generic border-dotted", neutralTreeBody),
    tag: "bg-card text-foreground",
    name: "comparison operands",
  },
  cast: {
    node: cn("border-fig-indigo bg-card border-double", indigoTreeBody),
    bowl: cn("border-fig-indigo border-double", indigoTreeBody),
    tag: "bg-card text-fig-indigo-text",
    name: "cast",
  },
};

/** Short value for a node box (the full value is in the node's accessible name). */
function shortValue(v: SvValue): string {
  if (isKnown(v)) return formatDecimal(v);
  return v.width <= 8 ? formatCompact(v) : "has x/z";
}

/**
 * A tidier placement for a narrow box: nodes on the same level stay one SLOT apart, but a subtree may slide under a
 * neighbour that sits on other levels, so a leaf high in the tree no longer takes a column of its own. Same nodes,
 * same order, same node size; returns each node's x in slots, the leftmost at 0.
 */
function compactX(root: TreeNodeView): Map<string, number> {
  type Placed = { xs: Map<string, number>; contour: { l: number; r: number }[] };
  const place = (n: TreeNodeView): Placed => {
    if (n.children.length === 0) return { xs: new Map([[n.id, 0]]), contour: [{ l: 0, r: 0 }] };
    const xs = new Map<string, number>();
    const merged: { l: number; r: number }[] = [];
    const roots: number[] = [];
    n.children.forEach((c) => {
      const sub = place(c);
      let shift = 0;
      if (roots.length > 0) {
        shift = -Infinity;
        sub.contour.forEach((lv, d) => {
          if (merged[d]) shift = Math.max(shift, merged[d].r + 1 - lv.l);
        });
      }
      sub.xs.forEach((x, id) => xs.set(id, x + shift));
      sub.contour.forEach((lv, d) => {
        merged[d] = merged[d] ? { l: Math.min(merged[d].l, lv.l + shift), r: Math.max(merged[d].r, lv.r + shift) } : { l: lv.l + shift, r: lv.r + shift };
      });
      roots.push(shift);
    });
    const mid = (roots[0] + roots[roots.length - 1]) / 2;
    xs.forEach((x, id) => xs.set(id, x - mid));
    xs.set(n.id, 0);
    return { xs, contour: [{ l: 0, r: 0 }, ...merged.map((lv) => ({ l: lv.l - mid, r: lv.r - mid }))] };
  };
  const { xs } = place(root);
  const min = Math.min(...xs.values());
  xs.forEach((x, id) => xs.set(id, x - min));
  return xs;
}

interface TreeDiagramProps {
  layout: TreeLayout;
  label: string;
  /** Nodes with order <= shownUpTo show their value and width. */
  shownUpTo?: number;
  bowls?: BowlMap;
  highlight?: string[];
  /** Nodes whose value lost its carry at the bowl width (drawn in the rose error state). */
  lost?: string[];
}

function TreeDiagram({ layout, label, shownUpTo = Infinity, bowls, highlight = [], lost = [] }: TreeDiagramProps) {
  const outlineId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  // On a phone the leaf-per-column layout can be wider than the box (F2.5: the s8 trees at 390 px hid the shift
  // amount). Measure the box; when the usual layout does not fit, use the compact one, which keeps the node size.
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setBoxWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wideWidth = PAD * 2 + layout.slots * SLOT;
  const compact = useMemo(() => {
    if (boxWidth === null || wideWidth <= boxWidth) return null;
    const xs = compactX(layout.root);
    const span = Math.max(...xs.values());
    // Keep the usual spacing where it fits; else close the gaps between nodes down to 4 px, then the side margin to 4 px.
    const fit = (pad: number) => (span > 0 ? (boxWidth - pad * 2 - NODE_W) / span : SLOT);
    const pad = fit(PAD) >= COMPACT_STEP ? PAD : COMPACT_PAD;
    const step = Math.min(SLOT, Math.max(COMPACT_STEP, fit(pad)));
    return { xs, pad, step, width: pad * 2 + span * step + NODE_W };
  }, [boxWidth, wideWidth, layout]);
  const width = compact ? compact.width : wideWidth;
  const pos = (n: TreeNodeView) =>
    compact
      ? { left: compact.pad + (compact.xs.get(n.id) ?? 0) * compact.step, top: PAD + n.depth * LEVEL }
      : { left: PAD + n.x * SLOT + (SLOT - NODE_W) / 2, top: PAD + n.depth * LEVEL };
  const height = PAD * 2 + (layout.levels - 1) * LEVEL + NODE_H;
  const bowlById = (id: string): Bowl | undefined => bowls?.bowls.find((b) => b.id === bowls.bowlOf[id]);
  const selectedNode = layout.nodes.find((n) => n.id === selected);
  const edges: { from: TreeNodeView; to: TreeNodeView }[] = layout.nodes.flatMap((n) => n.children.map((c) => ({ from: n, to: c })));

  const outline = (n: TreeNodeView): React.ReactNode => (
    <li key={n.id}>
      {n.order <= shownUpTo ? nodeSummary(n) : `${n.label}: not evaluated yet`}
      {bowls ? ` (bowl ${bowls.bowlOf[n.id]})` : ""}
      {n.children.length > 0 ? <ul className="ml-4 list-disc">{n.children.map(outline)}</ul> : null}
    </li>
  );

  return (
    <div className="space-y-2">
      <div ref={boxRef} className="fig-stage !p-0 max-w-full overflow-x-auto rounded-xl border border-fig-generic bg-[hsl(var(--fig-well))]" tabIndex={-1}>
        <div className="relative" style={{ width, height }}>
          <svg width={width} height={height} role="img" aria-label={label} aria-describedby={outlineId} className="absolute inset-0 text-foreground">
            {edges.map(({ from, to }) => {
              const a = pos(from);
              const b = pos(to);
              return (
                <line
                  key={`${from.id}-${to.id}`}
                  x1={a.left + NODE_W / 2}
                  y1={a.top + NODE_H}
                  x2={b.left + NODE_W / 2}
                  y2={b.top}
                  className="stroke-fig-generic"
                  strokeDasharray={to.order > shownUpTo ? "4 3" : undefined}
                  strokeWidth={1.8}
                />
              );
            })}
          </svg>
          {layout.nodes.map((n) => {
            const p = pos(n);
            const shown = n.order <= shownUpTo;
            const bowl = bowlById(n.id);
            const isRoot = n.id === layout.root.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelected(selected === n.id ? null : n.id)}
                aria-pressed={selected === n.id}
                aria-label={shown ? nodeSummary(n) : `${n.label}: not evaluated yet`}
                className={cn(
                  "absolute flex flex-col items-center justify-center rounded-lg border px-0.5 font-mono text-xs leading-tight text-foreground transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
                  bowl ? bowlTone[bowl.kind].node : "border-border bg-card",
                  isRoot && "border-2",
                  lost.includes(n.id) && ["border-2 border-fig-rose bg-card", roseTreeBody, treeRim],
                  !shown && "opacity-40",
                  highlight.includes(n.id) && "ring-2 ring-fig-cyan ring-offset-1 ring-offset-background",
                  // The neutral selection ring (DESIGN.md section 13). Written as one arbitrary property: cn() dropped the bare
                  // `outline` style next to focus-visible:outline-none, so the ring never showed.
                  selected === n.id && "[outline:2px_solid_hsl(var(--foreground))] [outline-offset:2px]",
                  !bowls && cn(
                    "border-fig-generic opacity-100",
                    shown && !isRoot && neutralTreeBody,
                    !shown && "border-dashed",
                    isRoot && ["border-foreground/75 bg-card", shown && [neutralTreeBody, rootRim]],
                  ),
                )}
                style={{ left: p.left, top: p.top, width: NODE_W, height: NODE_H }}
              >
                <span className="max-w-full truncate font-semibold">
                  {n.parenthesized ? `(${n.label})` : n.label}
                </span>
                <span className="max-w-full truncate text-xs text-muted-foreground">
                  {shown ? `${n.annotation.width}b · ${shortValue(n.annotation.value)}` : "…"}
                </span>
                {bowl ? (
                  <span aria-hidden className={cn("absolute -right-1 -top-2 rounded px-1 text-[11px] font-bold", bowlTone[bowl.kind].tag)}>
                    {bowl.id}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {selectedNode ? (
        <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm" aria-live="polite">
          {selectedNode.order <= shownUpTo ? nodeSummary(selectedNode) : `${selectedNode.label} is not evaluated yet: step on to reach it.`}
          {bowls && selectedNode.order <= shownUpTo ? ` In bowl ${bowls.bowlOf[selectedNode.id]}.` : ""}
        </p>
      ) : null}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Text outline of the tree</summary>
        <ul id={outlineId} className="mt-1 list-disc pl-5">
          {outline(layout.root)}
        </ul>
      </details>
    </div>
  );
}

function Decls({ decls, label = "Declarations", bowlInputs }: { decls: string[]; label?: string; bowlInputs?: boolean }) {
  if (decls.length === 0) return null;
  return (
    <div
      data-fig-art={bowlInputs ? "" : undefined}
      data-fig-focus={bowlInputs ? "width-declarations" : undefined}
      className={cn(
        "rounded-lg bg-code-surface px-3 py-2 font-mono text-[12px] leading-5 text-code-foreground [font-variant-ligatures:none]",
        bowlInputs && ["fig-stage !px-3 !py-[7px] border border-fig-indigo bg-card text-foreground", indigoTreeBody, treeRim],
      )}
      aria-label={label}
      role="group"
    >
      {decls.map((d) => (
        <div key={d} className={cn("break-words", bowlInputs && ["rounded-sm border-l-2 border-fig-generic pl-2", neutralTreeBody])}>
          {d}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Precedence view
// ---------------------------------------------------------------------------

const CUSTOM = "custom";

function PrecedenceView({ initial }: { initial?: string }) {
  const [presetId, setPresetId] = useState<string>(initial === CUSTOM ? CUSTOM : findPrecedencePreset(initial).id);
  const [draft, setDraft] = useState("u & a | b == c");
  const [custom, setCustom] = useState<string | null>(null);
  const inputId = useId();

  const customResult = useMemo(() => (custom === null ? null : analyzeExpression(custom, PLAYGROUND_DECLS)), [custom]);
  const customPreset = useMemo<PrecedencePreset | null>(
    () =>
      customResult && customResult.ok
        ? { id: CUSTOM, source: customResult.source, decls: PLAYGROUND_DECLS, intended: fullGrouping(customResult.ast), use: "value", rows: [] }
        : null,
    [customResult],
  );
  const preset = presetId === CUSTOM ? customPreset : findPrecedencePreset(presetId);

  return (
    <VisualFrame
      label="Expression tree explorer: precedence and associativity"
      eyebrow="Experiment"
      title="Which operator is applied last?"
      summary="Predict how Table 11-2 groups an expression written without parentheses, then watch the parse tree build bottom-up."
      fidelity="model"
      assumptions={EXPRESSION_TREE_ASSUMPTIONS}
      className="fig-panel"
    >
      <SegmentedControl
        label="Expression"
        mono
        value={presetId}
        onChange={setPresetId}
        options={[...precedencePresets.map((p) => ({ value: p.id, label: p.source })), { value: CUSTOM, label: "type your own", ariaLabel: "Type your own expression" }]}
      />
      {presetId === CUSTOM ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setCustom(draft);
          }}
        >
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
            Your expression
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={inputId}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={120}
              spellCheck={false}
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-lg border border-border/70 bg-background px-3 font-mono text-sm [font-variant-ligatures:none]"
            />
            <button type="submit" className="h-10 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Use this expression
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{EXCLUDED_NOTE}</p>
          <Decls decls={PLAYGROUND_DECLS.map((d) => declToSource(d))} label="Variables you can use" />
          {/* Always mounted, so screen readers announce the message when its text changes. */}
          <p className="text-sm text-rose-700 empty:hidden dark:text-rose-300" aria-live="polite" data-testid="expression-error">
            {customResult && !customResult.ok ? `${customResult.message}${customResult.clause ? ` (${customResult.clause})` : ""}` : ""}
          </p>
        </form>
      ) : null}
      {preset ? <PrecedenceRound key={`${preset.id}:${preset.source}`} preset={preset} /> : null}
    </VisualFrame>
  );
}

type Method = "tap" | "grouping";

function PrecedenceRound({ preset }: { preset: PrecedencePreset }) {
  const analysis = useMemo(() => analyzePrecedence(preset), [preset]);
  const [method, setMethod] = useState<Method>("tap");
  const [tapped, setTapped] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const source = analysis.actual.source;
  const shownSource = preset.use === "if" ? `if (${source})` : source;
  const offset = preset.use === "if" ? 4 : 0;
  const feedback = tapped ? tapFeedback(preset.source, preset.decls, tapped) : null;
  const revealed = tapped !== null || skipped;
  const canChooseGrouping = analysis.options.length >= MIN_GROUPING_OPTIONS;

  return (
    <div className="space-y-4">
      {preset.id !== CUSTOM ? <Decls decls={preset.decls.map((d) => declToSource(d))} /> : null}
      <SegmentedControl
        label="How to predict"
        value={method}
        onChange={(m) => {
          setMethod(m);
          setTapped(null);
          setSkipped(false);
        }}
        options={[
          { value: "tap", label: "Tap the operator applied last" },
          { value: "grouping", label: "Choose the grouping", disabled: !canChooseGrouping },
        ]}
      />
      {!canChooseGrouping ? <p className="text-xs text-muted-foreground">{GROUPING_UNAVAILABLE}</p> : null}
      {method === "tap" || !canChooseGrouping ? (
        <div className="space-y-3">
          <div className="fig-stage !px-4 !py-3 rounded-xl border border-fig-generic">
            <p className="mb-3 text-sm font-semibold text-foreground" id={`q-${preset.id}`}>
              <span className="mr-2 rounded bg-fig-amber-fill px-1.5 py-0.5 text-label text-fig-amber-text">Predict</span>
              Tap the operator the parser applies last: the root of the tree.
            </p>
            <SourceWithOperators
              source={shownSource}
              analysis={analysis}
              offset={offset}
              disabled={revealed}
              tapped={tapped}
              onTap={setTapped}
            />
            {!revealed ? (
              <button type="button" onClick={() => setSkipped(true)} className="mt-3 -ml-2 inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Reveal without predicting
              </button>
            ) : (
              <div className="mt-3 text-sm" aria-live="polite">
                {feedback ? (
                  <p className={feedback.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                    <strong>{feedback.correct ? "Correct. " : "Not quite. "}</strong>
                    {feedback.text}
                  </p>
                ) : (
                  <p className="text-muted-foreground">{tapFeedback(preset.source, preset.decls, analysis.rootId ?? "r").text}</p>
                )}
              </div>
            )}
          </div>
          {revealed ? <PrecedenceReveal analysis={analysis} /> : null}
        </div>
      ) : (
        <>
          <pre className="overflow-x-auto rounded-lg bg-code-surface px-3 py-2 font-mono text-sm text-code-foreground [font-variant-ligatures:none]">{shownSource}</pre>
          <PredictionPrompt
            question="Which grouping does the parser build?"
            resetKey={preset.id + preset.source}
            options={analysis.options.map((o) => ({ id: o.id, label: <code className="font-mono [font-variant-ligatures:none]">{o.grouping}</code>, correct: o.correct, feedback: o.feedback }))}
          >
            <PrecedenceReveal analysis={analysis} />
          </PredictionPrompt>
        </>
      )}
    </div>
  );
}

function SourceWithOperators({
  source,
  analysis,
  offset,
  disabled,
  tapped,
  onTap,
}: {
  source: string;
  analysis: PrecedenceAnalysis;
  offset: number;
  disabled: boolean;
  tapped: string | null;
  onTap: (id: string) => void;
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  analysis.tokens.forEach((t, i) => {
    const start = t.start + offset;
    if (start > cursor) parts.push(<span key={`s${i}`}>{source.slice(cursor, start)}</span>);
    const isRoot = t.nodeId === analysis.rootId;
    parts.push(
      <button
        key={`t${i}`}
        type="button"
        disabled={disabled}
        onClick={() => onTap(t.nodeId)}
        aria-label={`Predict: ${t.symbol === "?" || t.symbol === ":" ? "?:" : t.symbol} (operator ${i + 1}) is applied last`}
        data-fig-state={disabled ? (isRoot ? "correct" : tapped === t.nodeId ? "wrong" : undefined) : undefined}
        className={cn(
          "mx-0.5 inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-fig-generic px-1.5 font-mono font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
          disabled && isRoot && "border-fig-emerald bg-fig-emerald-fill",
          disabled && tapped === t.nodeId && !isRoot && "border-fig-rose bg-fig-rose-fill",
        )}
      >
        {t.symbol}
      </button>,
    );
    cursor = t.end + offset;
  });
  if (cursor < source.length) parts.push(<span key="tail">{source.slice(cursor)}</span>);
  return (
    <div
      data-fig-art=""
      data-fig-focus="prediction-expression"
      className={cn(
        "flex flex-wrap items-center gap-y-1 rounded-lg border-2 border-fig-amber px-1 py-0.5 font-mono text-base text-foreground [font-variant-ligatures:none]",
        predictionBody,
        treeRim,
      )}
    >
      {parts}
    </div>
  );
}

function PrecedenceReveal({ analysis }: { analysis: PrecedenceAnalysis }) {
  const [rewritten, setRewritten] = useState(false);
  const { preset } = analysis;
  const current = rewritten ? analysis.intended : analysis.actual;
  const nodes = current.layout.nodes;
  const playback = usePlayback(nodes.length, current.source);
  const index = Math.min(playback.index, nodes.length - 1);
  const atEnd = index >= nodes.length - 1;
  const step = nodes[index];
  const isCustom = preset.id === CUSTOM;
  const parensOnly = isParenthesization(preset.source, preset.intended);
  const resultLine = (v: SvValue) => (preset.use === "if" ? `${valueText(v)}: ${ifOutcome(v).text}.` : `${valueText(v)}.`);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">
            {rewritten ? "With the parentheses added" : "What the parser builds"}: <code className="font-mono [font-variant-ligatures:none]">{current.grouping}</code>
          </h4>
          <TreeDiagram layout={current.layout} label={`Parse tree of ${current.source}, built bottom-up`} shownUpTo={index} />
          <PlaybackControls playback={playback} stepCount={nodes.length} stepNoun="Node" describeStep={(i) => nodeSummary(nodes[Math.min(i, nodes.length - 1)])} />
          <p className="text-sm text-foreground" aria-live="polite">
            <span className="font-semibold">Node {index + 1}: </span>
            {nodeSummary(step)}
          </p>
          {atEnd ? (
            <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
              <strong>Result: </strong>
              {resultLine(current.value)}
            </p>
          ) : null}
        </div>
        {!isCustom ? (
          <div className="min-w-0 space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              What the author meant: <code className="font-mono [font-variant-ligatures:none]">{analysis.intended.grouping}</code>
            </h4>
            <TreeDiagram layout={analysis.intended.layout} label={`Tree the author meant, ${analysis.intended.source}`} />
            <p className="text-sm">
              <strong>Meant: </strong>
              {resultLine(analysis.intended.value)}
            </p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRewritten((r) => !r)}
          aria-pressed={rewritten}
          className="inline-flex h-10 items-center rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-4 text-sm font-semibold text-foreground hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {rewritten ? "Show as written" : parensOnly ? "Add parentheses" : "Rewrite as meant"}
        </button>
        {rewritten ? (
          <code className="font-mono text-sm [font-variant-ligatures:none]">{preset.use === "if" ? `if (${analysis.intended.source})` : analysis.intended.source}</code>
        ) : null}
      </div>
      {rewritten ? (
        <p className="text-sm text-foreground" aria-live="polite">
          {analysis.flip}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Width view (the bowls)
// ---------------------------------------------------------------------------

function WidthView({ initial }: { initial?: string }) {
  const [presetId, setPresetId] = useState(findWidthPreset(initial).id);
  const analysis = useMemo(() => analyzeWidth(findWidthPreset(presetId)), [presetId]);

  return (
    <VisualFrame
      label="Expression tree explorer: expression width"
      eyebrow="Experiment"
      title="How wide is the bowl?"
      summary="One context-determined region, joined to the target, shares one width. Self-determined operands and comparison operands get bowls of their own."
      fidelity="model"
      assumptions={EXPRESSION_TREE_ASSUMPTIONS}
      className="fig-panel"
    >
      <SegmentedControl
        label="Statement"
        mono
        value={presetId}
        onChange={setPresetId}
        options={widthPresets.map((p) => ({ value: p.id, label: `${p.target.name} = ${p.expr};` }))}
      />
      <WidthRound key={presetId} analysis={analysis} onContrast={setPresetId} />
    </VisualFrame>
  );
}

function WidthRound({ analysis, onContrast }: { analysis: WidthAnalysis; onContrast: (id: string) => void }) {
  const focus = analysis.preset.focus;
  return (
    <div className="space-y-4">
      <Decls decls={analysis.declarations} bowlInputs />
      <pre className="overflow-x-auto rounded-lg bg-code-surface px-3 py-2 font-mono text-sm text-code-foreground [font-variant-ligatures:none]">{analysis.statement}</pre>
      <PredictionPrompt
        question={<>How wide is the bowl in which <code className="font-mono">{focus}</code> is added?</>}
        options={widthOptions(analysis).map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback }))}
      >
        <PredictionPrompt
          question={<>What does the target hold after <code className="font-mono">{analysis.statement}</code>?</>}
          options={storedOptions(analysis).map((o) => ({ id: o.id, label: <code className="font-mono">{o.label}</code>, correct: o.correct, feedback: o.feedback }))}
        >
          <WidthReveal analysis={analysis} onContrast={onContrast} />
        </PredictionPrompt>
      </PredictionPrompt>
    </div>
  );
}

function BowlView({ bowl, map, focusBowl }: { bowl: Bowl; map: BowlMap; focusBowl: string }) {
  const tone = bowlTone[bowl.kind];
  const kids = bowl.children.map((id) => map.bowls.find((b) => b.id === id)!).filter(Boolean);
  // The operand that sets the bowl's width: as wide as the bowl while another part of it is narrower.
  const widths = [...bowl.members.map((m) => m.width), ...(bowl.target ? [bowl.target.width] : [])];
  const setsWidth = (w: number) => w === bowl.width && widths.some((x) => x < bowl.width);
  return (
    <li
      className={cn("min-w-0 list-none rounded-b-[1.75rem] border-x-2 border-b-2 border-t-4 px-3 pb-4 pt-2", tone.bowl, treeRim, bowl.id === focusBowl && "ring-2 ring-inset ring-fig-cyan")}
      aria-label={`Bowl ${bowl.id}: ${bowl.width} bits, ${tone.name}${bowl.reason ? `, ${bowl.reason}` : ""}`}
    >
      <p className="text-xs font-semibold text-foreground">
        <span className={cn("mr-1.5 rounded px-1 text-xs font-bold", tone.tag)}>{bowl.id}</span>
        {bowl.width}-bit bowl · {tone.name}
      </p>
      {bowl.reason ? <p className="text-xs text-foreground">{bowl.reason}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {bowl.members.map((m) => (
          <span
            key={m.text}
            data-fig-sets-width={setsWidth(m.width) ? "" : undefined}
            className={cn(
              "rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 font-mono text-xs [font-variant-ligatures:none]",
              setsWidth(m.width) && ["border-2 border-foreground/70 bg-card px-[5px] py-px font-semibold", neutralTreeBody, treeRim],
            )}
          >
            {m.text} <span className="text-muted-foreground">({m.width})</span>
          </span>
        ))}
        {bowl.target ? (
          <span className={cn("rounded-md border-2 border-fig-cyan bg-card px-1.5 py-0.5 font-mono text-xs font-semibold [font-variant-ligatures:none]", cyanTreeBody)}>
            target {bowl.target.text} <span className="text-muted-foreground">({bowl.target.width})</span>
          </span>
        ) : null}
      </div>
      {kids.length > 0 ? (
        <ul className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
          {kids.map((k) => (
            <BowlView key={k.id} bowl={k} map={map} focusBowl={focusBowl} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function WidthReveal({ analysis, onContrast }: { analysis: WidthAnalysis; onContrast: (id: string) => void }) {
  const steps = analysis.steps;
  const playback = usePlayback(steps.length, analysis.preset.id);
  const index = Math.min(playback.index, steps.length - 1);
  const step = steps[index];
  const focusOpIndex = steps.findIndex((s) => s.kind === "op" && s.text === analysis.preset.focus);
  const highlight = analysis.layout.nodes.filter((n) => n.text === step.text).map((n) => n.id);
  const root = analysis.bowls.bowls[0];
  const lost = !analysis.carryKept && focusOpIndex >= 0 && index >= focusOpIndex ? [analysis.focusNode.id] : [];
  const contrast = analysis.preset.contrast ? widthPresets.find((p) => p.id === analysis.preset.contrast) : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">The bowls</h4>
        <ul className="fig-stage !p-0" aria-label="Bowls of the expression">
          <BowlView bowl={root} map={analysis.bowls} focusBowl={analysis.focusBowl.id} />
        </ul>
      </div>
      <TreeDiagram layout={analysis.layout} label={`Tree of ${analysis.statement} with each node tagged by its bowl`} bowls={analysis.bowls} highlight={highlight} lost={lost} />
      <PlaybackControls playback={playback} stepCount={steps.length} stepNoun="Step" describeStep={(i) => stepLabel(steps[Math.min(i, steps.length - 1)])} />
      <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm" aria-live="polite">
        <p className="font-semibold text-foreground">
          {index + 1}. {stepLabel(step)}
        </p>
        <p className="mt-1 text-foreground">
          {step.why} <span className="text-muted-foreground">({step.clause})</span>
        </p>
      </div>
      {focusOpIndex >= 0 && index >= focusOpIndex ? (
        <p className={cn("text-sm font-semibold", analysis.carryKept ? "text-fig-emerald-text" : "text-fig-rose-text")}>
          <span aria-hidden>{analysis.carryKept ? "✓ " : "✕ "}</span>
          {analysis.carryText}
        </p>
      ) : null}
      {index >= steps.length - 1 ? (
        <p className="text-sm">
          <strong>Stored: </strong>
          <code className="font-mono">{analysis.stored}</code>
        </p>
      ) : null}
      {contrast ? (
        <button
          type="button"
          onClick={() => onContrast(contrast.id)}
          className="inline-flex min-h-10 items-center rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-4 text-left text-sm font-semibold text-foreground hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Compare with&nbsp;<code className="font-mono [font-variant-ligatures:none]">{`${contrast.target.name} = ${contrast.expr};`}</code>
        </button>
      ) : null}
    </div>
  );
}
