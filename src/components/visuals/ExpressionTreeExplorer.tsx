"use client";

import React, { useId, useMemo, useState } from "react";

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

const bowlTone: Record<BowlKind, { node: string; bowl: string; tag: string; name: string }> = {
  context: {
    node: "border-cyan-500/70 bg-cyan-500/10",
    bowl: "border-cyan-500/70 bg-cyan-500/[0.06]",
    tag: "bg-cyan-500/20 text-cyan-900 dark:text-cyan-100",
    name: "context-determined",
  },
  self: {
    node: "border-violet-500/70 bg-violet-500/10 border-dashed",
    bowl: "border-violet-500/70 bg-violet-500/[0.06] border-dashed",
    tag: "bg-violet-500/20 text-violet-900 dark:text-violet-100",
    name: "self-determined",
  },
  compare: {
    node: "border-amber-500/70 bg-amber-500/10 border-dotted",
    bowl: "border-amber-500/70 bg-amber-500/[0.06] border-dotted",
    tag: "bg-amber-500/20 text-amber-900 dark:text-amber-100",
    name: "comparison operands",
  },
  cast: {
    node: "border-indigo-500/70 bg-indigo-500/10",
    bowl: "border-indigo-500/70 bg-indigo-500/[0.06]",
    tag: "bg-indigo-500/20 text-indigo-900 dark:text-indigo-100",
    name: "cast",
  },
};

/** Short value for a node box (the full value is in the node's accessible name). */
function shortValue(v: SvValue): string {
  if (isKnown(v)) return formatDecimal(v);
  return v.width <= 8 ? formatCompact(v) : "has x/z";
}

const pos = (n: TreeNodeView) => ({ left: PAD + n.x * SLOT + (SLOT - NODE_W) / 2, top: PAD + n.depth * LEVEL });

interface TreeDiagramProps {
  layout: TreeLayout;
  label: string;
  /** Nodes with order <= shownUpTo show their value and width. */
  shownUpTo?: number;
  bowls?: BowlMap;
  highlight?: string[];
}

function TreeDiagram({ layout, label, shownUpTo = Infinity, bowls, highlight = [] }: TreeDiagramProps) {
  const outlineId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const width = PAD * 2 + layout.slots * SLOT;
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
      <div className="max-w-full overflow-x-auto rounded-xl border border-border/60 bg-background/40" tabIndex={-1}>
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
                  stroke="currentColor"
                  strokeOpacity={to.order <= shownUpTo ? 0.55 : 0.2}
                  strokeWidth={1.4}
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
                  "absolute flex flex-col items-center justify-center rounded-lg border px-1 font-mono text-[11px] leading-tight text-foreground transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
                  bowl ? bowlTone[bowl.kind].node : "border-border bg-card",
                  isRoot && "border-2",
                  !shown && "opacity-40",
                  highlight.includes(n.id) && "ring-2 ring-cyan-400 ring-offset-1 ring-offset-background",
                  selected === n.id && "outline outline-2 outline-offset-2 outline-foreground/60",
                )}
                style={{ left: p.left, top: p.top, width: NODE_W, height: NODE_H }}
              >
                <span className="max-w-full truncate font-semibold">
                  {n.parenthesized ? `(${n.label})` : n.label}
                </span>
                <span className="max-w-full truncate text-[10px] text-muted-foreground">
                  {shown ? `${n.annotation.width}b · ${shortValue(n.annotation.value)}` : "…"}
                </span>
                {bowl ? (
                  <span aria-hidden className={cn("absolute -right-1 -top-2 rounded px-1 text-[9px] font-bold", bowlTone[bowl.kind].tag)}>
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

function Decls({ decls, label = "Declarations" }: { decls: string[]; label?: string }) {
  if (decls.length === 0) return null;
  return (
    <div className="rounded-lg bg-slate-950/90 px-3 py-2 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]" aria-label={label} role="group">
      {decls.map((d) => (
        <div key={d} className="break-words">
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
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-4">
            <p className="mb-3 text-sm font-semibold text-foreground" id={`q-${preset.id}`}>
              <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Predict</span>
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
              <button type="button" onClick={() => setSkipped(true)} className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
          <pre className="overflow-x-auto rounded-lg bg-slate-950/90 px-3 py-2 font-mono text-sm text-slate-100 [font-variant-ligatures:none]">{shownSource}</pre>
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
        className={cn(
          "mx-0.5 inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-amber-500/60 bg-amber-500/10 px-1.5 font-mono font-semibold text-foreground hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
          disabled && isRoot && "border-emerald-500 bg-emerald-500/15",
          disabled && tapped === t.nodeId && !isRoot && "border-rose-500 bg-rose-500/15",
        )}
      >
        {t.symbol}
      </button>,
    );
    cursor = t.end + offset;
  });
  if (cursor < source.length) parts.push(<span key="tail">{source.slice(cursor)}</span>);
  return <div className="flex flex-wrap items-center gap-y-1 font-mono text-base text-foreground [font-variant-ligatures:none]">{parts}</div>;
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
      <Decls decls={analysis.declarations} />
      <pre className="overflow-x-auto rounded-lg bg-slate-950/90 px-3 py-2 font-mono text-sm text-slate-100 [font-variant-ligatures:none]">{analysis.statement}</pre>
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
  return (
    <li
      className={cn("min-w-0 list-none rounded-b-[1.75rem] border-x-2 border-b-2 border-t-4 px-3 pb-4 pt-2", tone.bowl, bowl.id === focusBowl && "ring-2 ring-cyan-400/70")}
      aria-label={`Bowl ${bowl.id}: ${bowl.width} bits, ${tone.name}${bowl.reason ? `, ${bowl.reason}` : ""}`}
    >
      <p className="text-xs font-semibold text-foreground">
        <span className={cn("mr-1.5 rounded px-1 text-[10px] font-bold", tone.tag)}>{bowl.id}</span>
        {bowl.width}-bit bowl · {tone.name}
      </p>
      {bowl.reason ? <p className="text-[11px] text-muted-foreground">{bowl.reason}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {bowl.members.map((m) => (
          <span key={m.text} className="rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 font-mono text-[11px] [font-variant-ligatures:none]">
            {m.text} <span className="text-muted-foreground">({m.width})</span>
          </span>
        ))}
        {bowl.target ? (
          <span className="rounded-md border-2 border-cyan-600/70 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold [font-variant-ligatures:none]">
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
  const contrast = analysis.preset.contrast ? widthPresets.find((p) => p.id === analysis.preset.contrast) : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">The bowls</h4>
        <ul aria-label="Bowls of the expression">
          <BowlView bowl={root} map={analysis.bowls} focusBowl={analysis.focusBowl.id} />
        </ul>
      </div>
      <TreeDiagram layout={analysis.layout} label={`Tree of ${analysis.statement} with each node tagged by its bowl`} bowls={analysis.bowls} highlight={highlight} />
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
        <p className={cn("text-sm font-semibold", analysis.carryKept ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
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
