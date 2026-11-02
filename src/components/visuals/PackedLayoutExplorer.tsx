"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { BitStrip, BitStripLegend, type BitLegendItem, type BitSegment, type BitValue } from "@/components/visual-system/BitStrip";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { MutationMatrix, cellKey, type MutationCell, type MutationPrediction } from "@/components/visual-system/MutationMatrix";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { ReorderList } from "@/components/visual-system/ReorderList";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  LESSON_EXPECTED_FAILURES,
  MAX_MEMBER_WIDTH,
  MIN_MEMBER_WIDTH,
  MUTATIONS,
  TB_CHECKS,
  UNDEFINED_TAGGED,
  changedLogLines,
  enumDeclarationText,
  enumMemberReadout,
  failingChecks,
  formatD,
  formatSizedHex,
  formatTaggedP,
  formatUnionP,
  hexAligned,
  lessonHexDigits,
  makeTagged,
  memberRanges,
  memberTypeText,
  mutationBoard,
  nibbleOverlay,
  rangeText,
  readMember,
  readTagged,
  readUnionPath,
  reorderMembers,
  rewidthVector,
  setMemberWidth,
  slice,
  structBits,
  structInitialValue,
  structStates,
  structTypedef,
  structVectorCards,
  svHex,
  taggedPackedBits,
  taggedPackedLayout,
  taggedTypedef,
  unionInitialValue,
  unionProblems,
  unionRows,
  unionStates,
  unionTypedef,
  unionWidth,
  unpackedWholeAssignCard,
  writeMember,
  writeUnionPath,
  writeXInMember,
  xWriteOffer,
  type EnumArrival,
  type MutationId,
  type PackedMember,
  type RuleCard,
  type TaggedMember,
  type TaggedUnionType,
  type TaggedValue,
  type UnionPacking,
  type UnionRow,
  type UnionType,
} from "@/lib/sv-aggregate-layout-model";
import {
  CLINIC_FIXES,
  CLINIC_SCENARIOS,
  STRUCT_PRESETS,
  TAGGED_READ_PREDICTION,
  UNION_PRESETS,
  VINT,
  VINT_THIRD_MEMBER,
  applyStructAction,
  clinicScenario,
  currentVarName,
  runWholeAction,
  structPreset,
  taggedAssignStatement,
  taggedAssignValue,
  unionPreset,
  type ChoiceOption,
  type ClinicRun,
  type FixId,
  type StructPreset,
  type StructStatement,
  type UnionPreset,
} from "@/lib/sv-aggregate-scenarios";
import { bitsOf, type SvValue } from "@/lib/sv-expression-model";
import { cn } from "@/lib/utils";

/**
 * PackedLayoutExplorer: aggregate types at bit level.
 *
 * Every number on screen comes from src/lib/sv-aggregate-layout-model.ts; the
 * presets and clinic scenarios live in src/lib/sv-aggregate-scenarios.ts.
 * Modes: struct (default) | union | tagged | mutation | debug.
 */

export type ExplorerMode = "struct" | "union" | "tagged" | "mutation" | "debug";

export interface PackedLayoutExplorerProps {
  mode?: ExplorerMode;
  /** A preset id of the mode: a struct preset, a union preset or a clinic scenario. */
  preset?: string;
}

export const PACKED_LAYOUT_ASSUMPTIONS = [
  "Bit layouts follow IEEE 1800-2023 §7.2.1 (packed structs), §7.3.1 (hard and soft packed unions), §7.3.2 and §11.9 (tagged unions); widths and defaults follow §20.6.2, §10.7 and Table 6-7, so a variable nothing has written shows all x when it is 4-state.",
  "Editing a typedef is not a run-time action: when you reorder or resize members, the vector keeps its bits and the names move over it, as a monitor sees a wire. If the total shrinks the top bits go; if it grows the new bits hold the Table 6-7 default.",
  "White space in %p output is implementation dependent (§21.2.1.6); the model prints one spacing.",
  "The nested soft union and the third tagged member are our own examples, not the standard's Figures 7-1 to 7-3.",
];

const toBits = (v: SvValue): BitValue[] => bitsOf(v);

/** Values read best in the code font; the clinic's long root causes are sentences, so they use the prose font. */
const toOptions = (options: readonly ChoiceOption[], font: "mono" | "prose" = "mono"): PredictionOption[] =>
  options.map((o) => ({ id: o.id, label: font === "mono" ? <span className="font-mono [font-variant-ligatures:none]">{o.label}</span> : o.label, correct: o.correct, feedback: o.feedback }));

const codeLines = (text: string, owner?: CodeTraceLine["owner"]): CodeTraceLine[] => text.split("\n").map((t, i) => ({ text: t, key: `l${i}`, owner }));

const primaryButton =
  "inline-flex min-h-10 items-center rounded-lg bg-cyan-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const secondaryButton =
  "inline-flex min-h-10 items-center rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const toggleButton = (on: boolean) =>
  cn(
    "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
    on ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
  );
const codeChip = "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.95em] text-foreground [font-variant-ligatures:none] [overflow-wrap:anywhere]";

/**
 * Calls `onReveal` once, when the revealed part of a PredictionPrompt mounts.
 * The latest handler is read through a ref, so a new callback identity never
 * fires it again; the handler must still be idempotent (StrictMode mounts twice).
 */
function OnReveal({ onReveal }: { onReveal: () => void }) {
  const latest = useRef(onReveal);
  latest.current = onReveal;
  useEffect(() => {
    latest.current();
  }, []);
  return null;
}

function RuleCardView({ card }: { card: RuleCard }) {
  return (
    <div
      role="note"
      className={cn(
        "rounded-lg border p-3 text-sm",
        card.legal ? "border-emerald-500/50 bg-emerald-500/[0.06]" : "border-rose-500/50 bg-rose-500/[0.06]",
      )}
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className={cn("font-semibold", card.legal ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
          <span aria-hidden>{card.legal ? "✓ " : "✕ "}</span>
          {card.legal ? "Legal" : "Compile error"}
        </span>
        <code className={codeChip}>{card.code}</code>
        <span className="text-xs text-muted-foreground">({card.clause})</span>
      </p>
      <p className="mt-1 text-muted-foreground">{card.message}</p>
    </div>
  );
}

/** Whether a scroll container is wider than its box, so it should be a focusable region (the pattern MutationMatrix uses). */
function useHorizontalOverflow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);
  return [ref, overflowing] as const;
}

/**
 * Strips never wrap: they scroll inside this panel, so the page itself never
 * scrolls sideways. When it overflows the panel takes focus, so a keyboard can
 * reach the low bits in browsers that do not make scrollers focusable.
 */
function StripPanel({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
  const [ref, overflowing] = useHorizontalOverflow<HTMLDivElement>();
  return (
    <div
      ref={ref}
      role="region"
      aria-label={overflowing ? `${label} (scrolls sideways)` : label}
      tabIndex={overflowing ? 0 : undefined}
      className={cn("min-w-0 overflow-x-auto rounded-xl border border-border/70 bg-background/50 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <div className="w-max min-w-full">{children}</div>
    </div>
  );
}

/**
 * A width field that commits on blur or Enter, not on every keystroke, so
 * backspacing through "16" does not pass through width 1 and cut the vector.
 */
function WidthInput({ value, min, max, disabled, label, onCommit }: { value: number; min: number; max: number; disabled?: boolean; label: string; onCommit: (width: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, Math.round(n)));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={draft}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      className="h-10 w-20 rounded-lg border border-border/70 bg-background px-2 text-right font-mono text-sm text-foreground disabled:opacity-50"
    />
  );
}

/**
 * The control that ran a statement unmounts with it, so focus would fall back
 * to the page. After a step it moves to what comes next: the next statement's
 * "Run it" or first prediction radio, or the statement that just ran when the
 * sequence is over. A reset lowers `applied` and leaves focus where it is.
 */
function useStatementFocus(applied: number) {
  const listRef = useRef<HTMLOListElement>(null);
  const previous = useRef(applied);
  useEffect(() => {
    const advanced = applied > previous.current;
    previous.current = applied;
    if (!advanced) return;
    const item = (index: number) => listRef.current?.querySelector<HTMLElement>(`[data-statement="${index}"]`);
    const target = item(applied)?.querySelector<HTMLElement>('[data-testid="run-statement"], input[type="radio"]:not(:disabled)') ?? item(applied - 1);
    target?.focus();
  }, [applied]);
  return listRef;
}

const statementItemFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Status({ text, testId }: { text: string; testId: string }) {
  return (
    <p role="status" aria-live="polite" data-testid={testId} className="text-sm text-foreground">
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Struct mode
// ---------------------------------------------------------------------------

interface StructRunState {
  members: PackedMember[];
  value: SvValue;
  /** The variable the value belongs to: the kata's second statement writes rx, not hdr. */
  varName: string;
  applied: number;
  changed: number[];
  extendedFrom?: number;
  droppedFrom?: number;
  layoutEdited: boolean;
  /** How the enum member's current value got there, so the readout can name the path. */
  enumArrival: EnumArrival;
  note: string;
}

const initialStructState = (p: StructPreset): StructRunState => ({
  members: [...p.members],
  value: structInitialValue(p.members),
  varName: currentVarName(p, 0),
  applied: 0,
  changed: [],
  layoutEdited: false,
  enumArrival: "never-assigned",
  note: "",
});

function StructMode({ preset: presetId }: { preset?: string }) {
  const [presetKey, setPresetKey] = useState(structPreset(presetId).id);
  const preset = structPreset(presetKey);
  const [run, setRun] = useState<StructRunState>(() => initialStructState(preset));
  const [packed, setPacked] = useState(true);
  /** Bumped on every preset choice, re-selecting the current one included, so the prediction prompts remount re-armed. */
  const [gen, setGen] = useState(0);
  const statementsRef = useStatementFocus(run.applied);

  const choosePreset = (id: string) => {
    setPresetKey(structPreset(id).id);
    setRun(initialStructState(structPreset(id)));
    setPacked(true);
    setGen((g) => g + 1);
  };

  const { members, value, applied, varName } = run;
  const ranges = useMemo(() => memberRanges(members), [members]);
  const width = structBits(members);
  const states = structStates(members);
  // Until the first gated statement is answered, the bit ranges would answer it, so they appear on commit.
  const firstGate = preset.statements.findIndex((s) => s.prediction);
  const rangesHidden = firstGate >= 0 && applied <= firstGate && !run.layoutEdited;
  const segments: BitSegment[] = rangesHidden ? [] : ranges.map((r) => ({ hi: r.hi, lo: r.lo, label: r.name }));
  const overlay = useMemo(() => nibbleOverlay(members, value), [members, value]);
  const cards = useMemo(() => structVectorCards(varName, members, packed, value), [varName, members, packed, value]);
  // The first card is the part-select, which names the first member's range.
  const shownCards = rangesHidden ? cards.slice(1) : cards;
  const enumMember = members.find((m) => m.type.kind === "enum");
  const enumDeclarations = Array.from(new Set(members.flatMap((m) => (m.type.kind === "enum" ? [enumDeclarationText(m.type.spec)] : []))));
  // The readout explains the vector back door, which only a packed struct has. Before a statement runs it would show "" and give away the enum-field prediction.
  const enumReadout = packed && enumMember && applied > 0 ? enumMemberReadout(members, value, enumMember.name, "struct", run.enumArrival) : null;
  const hasX = bitsOf(value).some((b) => b === "x" || b === "z");

  const applyStatement = useCallback(
    (index: number) => {
      setRun((prev) => {
        if (prev.applied !== index) return prev;
        const s = preset.statements[index];
        if (!s) return prev;
        const next = applyStructAction(prev.members, prev.value, s.action);
        let changed: number[] = [];
        let extendedFrom: number | undefined;
        let droppedFrom: number | undefined;
        // A preset's own note describes the preset's layout, so after a layout edit only the model's note is true.
        const presetNote = prev.layoutEdited ? "" : (s.note ?? "");
        let note = presetNote;
        let enumArrival: EnumArrival = prev.enumArrival;
        if (s.action.kind === "member") {
          const written = s.action.member;
          const w = writeMember(prev.members, prev.value, written, s.action.value);
          changed = w.changed;
          note = `${w.note} ${presetNote}`.trim();
          if (prev.members.find((m) => m.name === written)?.type.kind === "enum") enumArrival = "member-write";
        } else if (s.action.kind === "whole") {
          const a = runWholeAction(prev.members, s.action);
          extendedFrom = a.extendedFrom;
          droppedFrom = a.droppedFrom;
          enumArrival = "whole-vector";
          // Truncation marks nothing on the strip (the discarded bits are the source's, above the MSB), so the note carries it.
          if (prev.layoutEdited || a.droppedFrom !== undefined) note = `${a.note} ${presetNote}`.trim();
        } else {
          enumArrival = "member-write";
          if (prev.layoutEdited) note = "An assignment pattern by member name writes every member (§10.9.2).";
        }
        return { ...prev, value: next, varName: currentVarName(preset, index + 1), applied: index + 1, changed, extendedFrom, droppedFrom, enumArrival, note };
      });
    },
    [preset],
  );

  const editLayout = (nextMembers: PackedMember[]) => {
    setRun((prev) => {
      return {
        ...prev,
        members: nextMembers,
        value: rewidthVector(prev.value, structBits(nextMembers), structStates(nextMembers)),
        changed: [],
        extendedFrom: undefined,
        droppedFrom: undefined,
        layoutEdited: true,
        enumArrival: prev.enumArrival === "never-assigned" ? "never-assigned" : "layout-edit",
        note: "Layout edited: the vector keeps its bits and the member names move over it.",
      };
    });
  };

  const writeX = (name: string) => {
    setRun((prev) => {
      const w = writeXInMember(prev.members, prev.value, name);
      const enumArrival: EnumArrival = xWriteOffer(prev.varName, prev.members, name).partSelect ? "part-select" : prev.enumArrival;
      return { ...prev, value: w.value, changed: w.changed, extendedFrom: undefined, droppedFrom: undefined, enumArrival, note: w.note };
    });
  };

  /** The packed/unpacked what-if view keeps the members' values but drops the vector-level marks and note. */
  const togglePacked = () => {
    setPacked((p) => !p);
    setRun((prev) => ({ ...prev, changed: [], extendedFrom: undefined, droppedFrom: undefined, note: "" }));
  };

  /** In the unpacked view a member write or an assignment pattern runs on its own; the sequence and its predictions belong to the packed layout. */
  const runUnpacked = (s: StructStatement) => {
    setRun((prev) => {
      if (s.action.kind === "whole") return prev;
      const next = applyStructAction(prev.members, prev.value, s.action);
      const note =
        s.action.kind === "member"
          ? `${s.action.member} is written by name; the other members keep their values (§7.2).`
          : "An assignment pattern by member name writes every member (§10.9.2).";
      return { ...prev, value: next, varName: s.varName ?? preset.varName, changed: [], extendedFrom: undefined, droppedFrom: undefined, enumArrival: "member-write", note };
    });
  };

  const fieldText = ranges.map((r) => `${r.name} ${rangeText(r)} = ${formatSizedHex(readMember(members, value, r.name))}`).join(", ");
  const memberText = ranges.map((r) => `${r.name} = ${formatSizedHex(readMember(members, value, r.name))}`).join(", ");
  const noteText = run.note ? ` ${run.note}` : "";
  // An unpacked struct is not a vector: no literal for the whole, no bit ranges, no signing (§7.2.1) and no vector state-ness; $bits still counts its members (§20.6.2).
  const statusText = packed
    ? `${varName} = ${formatSizedHex(value)}; $bits(${preset.typeName}) = ${width}; ${states}-state, unsigned. ${rangesHidden ? memberText : fieldText}.${noteText}`
    : `${varName} is an unpacked struct: members are referenced by name and there is no bit numbering (§7.2.1); $bits(${preset.typeName}) = ${width} (§20.6.2). ${memberText}.${noteText}`;

  // 'dropped' is listed only when a struck-through cell exists: truncation discards source bits above the strip's MSB, which the note reports instead.
  const legend: BitLegendItem[] = ["changed", "extended", "dropped", "x"].filter((item) =>
    item === "changed" ? run.changed.length > 0 : item === "extended" ? run.extendedFrom !== undefined : item === "dropped" ? run.droppedFrom !== undefined && run.droppedFrom < width : hasX,
  ) as BitLegendItem[];

  const nextStatement = preset.statements[applied];
  const gated = Boolean(nextStatement?.prediction) && !run.layoutEdited;

  return (
    <VisualFrame
      label="Packed struct layout explorer"
      eyebrow="Predict, then experiment"
      title="Which bits does each member own?"
      summary={preset.summary}
      fidelity="model"
      assumptions={PACKED_LAYOUT_ASSUMPTIONS}
    >
      <SegmentedControl label="Struct preset" options={STRUCT_PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={preset.id} onChange={choosePreset} mono />

      <CodeTrace label={`typedef (${preset.source})`} lines={codeLines([...enumDeclarations, structTypedef(preset.typeName, members, packed, !rangesHidden)].join("\n"), "testbench")} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={!packed} onClick={togglePacked} className={toggleButton(!packed)} data-testid="struct-unpacked-toggle">
          <span aria-hidden>{packed ? "▭" : "▯▯▯"}</span>
          Unpacked view
        </button>
        <ValueChip name={`$bits(${preset.typeName})`} value={width} />
        {packed ? (
          <>
            <ValueChip name="states" value={`${states}-state`} />
            <ValueChip name="sign" value="unsigned" />
          </>
        ) : null}
      </div>

      {packed ? (
        <StripPanel label={`Bits of ${varName}`}>
          <BitStrip
            bits={toBits(value)}
            label={`${varName}, ${preset.typeName}`}
            segments={segments}
            bitNumbers
            changed={run.changed}
            extendedFrom={run.extendedFrom}
            droppedFrom={run.droppedFrom}
          />
          {legend.length ? <BitStripLegend items={legend} className="mt-2" /> : null}
          {rangesHidden ? (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="ranges-hidden">
              The member bit ranges appear once you answer the question below.
            </p>
          ) : null}
        </StripPanel>
      ) : (
        <div className="space-y-3" data-testid="struct-unpacked-view">
          <ul className="flex flex-wrap gap-2" aria-label={`${varName} as an unpacked struct: separate members, no bit numbering`}>
            {members.map((m) => (
              <li key={m.id} className="rounded-lg border border-dashed border-border/80 bg-background/50 px-3 py-2 text-sm">
                <p className="font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">{memberTypeText(m)}</p>
                <p className="font-semibold text-foreground">{m.name}</p>
                <p className="font-mono text-xs [font-variant-ligatures:none]">{formatSizedHex(readMember(members, value, m.name))}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            An unpacked struct has no bit numbering (§7.2.1): members are read by name, and the packing is implementation-dependent, normally matching the C compiler. Signing is not allowed on it either (§7.2.1).
          </p>
        </div>
      )}

      <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        {shownCards.map((c) => (
          <RuleCardView key={c.code} card={c} />
        ))}
      </div>

      {packed && applied > 0 && !rangesHidden ? (
        <div className="space-y-2" data-testid="hex-overlay">
          <p className="text-sm font-semibold text-foreground">Hex digits over the members</p>
          <ol className="flex flex-wrap gap-1" aria-label="Hex digits, most significant first">
            {overlay.map((n) => {
              const shared = n.members.length > 1;
              return (
                <li
                  key={n.index}
                  className={cn("min-w-[3.25rem] rounded-md border px-2 py-1 text-center font-mono text-xs [font-variant-ligatures:none]", shared ? "border-rose-500/60 bg-rose-500/[0.08]" : "border-border/70 bg-background/50")}
                >
                  <span className="block text-base font-bold text-foreground">{lessonHexDigits(n.digit ?? "")}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    [{n.hi}:{n.lo}]
                  </span>
                  <span className="block text-[10px] text-foreground">
                    {n.members.join(" + ")}
                    {shared ? <span className="sr-only"> (shared digit)</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {ranges.map((r) => {
              const aligned = hexAligned(members, r.name);
              return (
                <li key={r.id} className={aligned ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                  <span aria-hidden>{aligned ? "✓ " : "✕ "}</span>
                  {r.name} {rangeText(r)}: {aligned ? "reads straight off the hex" : "shares a hex digit, so it does not"}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {enumReadout ? (
        <div role="note" data-testid="enum-readout" className={cn("rounded-lg border p-3 text-sm", enumReadout.isMember ? "border-border/70" : "border-amber-500/60 bg-amber-500/[0.06]")}>
          <p>
            <code className={codeChip}>
              {varName}.{enumMember?.name}.name()
            </code>{" "}
            returns <code className={codeChip}>&quot;{enumReadout.name}&quot;</code>
            <span className="ml-2 text-xs text-muted-foreground">({enumReadout.basis})</span>
          </p>
          <p className="mt-1 text-muted-foreground">{enumReadout.note}</p>
        </div>
      ) : null}

      <section aria-label="Statements" className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Statements</p>
        {/* Hidden, not unmounted, in the unpacked view: an unmounted prompt would come back unanswered for a statement that has already run. */}
        <ol ref={statementsRef} className="space-y-2" hidden={!packed}>
          {preset.statements.map((s, i) => {
            const done = i < applied;
            const current = i === applied;
            return (
              <li key={s.code} data-statement={i} tabIndex={-1} className={cn("rounded-lg border p-3", statementItemFocus, done ? "border-emerald-500/40 bg-emerald-500/[0.04]" : current ? "border-amber-500/40" : "border-dashed border-border/60 opacity-60")}>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span aria-hidden className="text-xs text-muted-foreground">
                    {i + 1}.
                  </span>
                  <code className={codeChip}>{s.code}</code>
                  {done ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">run</span> : null}
                </p>
                {done && i === applied - 1 && run.note ? <p className="mt-1 text-xs text-muted-foreground">{run.note}</p> : null}
                {current && !gated ? (
                  <button type="button" onClick={() => applyStatement(i)} className={cn(primaryButton, "mt-2")} data-testid="run-statement">
                    Run it
                  </button>
                ) : null}
                {/* The prompt stays mounted for the statement it just ran, so its feedback remains readable; `gen` remounts it re-armed on a reset. */}
                {s.prediction && !run.layoutEdited && (current || i === applied - 1) ? (
                  <PredictionPrompt key={`${preset.id}-${gen}-${i}`} question={s.prediction.question} options={toOptions(s.prediction.options)} resetKey={`${preset.id}-${gen}-${i}`} className="mt-2">
                    <OnReveal onReveal={() => applyStatement(i)} />
                    <p className="text-sm text-muted-foreground">The strip above now shows the result.</p>
                  </PredictionPrompt>
                ) : null}
              </li>
            );
          })}
        </ol>
        {!packed ? (
          <ol className="space-y-2" data-testid="unpacked-statements">
            {preset.statements.map((s, i) =>
              s.action.kind === "whole" ? (
                <li key={s.code}>
                  <RuleCardView card={unpackedWholeAssignCard(preset.typeName, s.code)} />
                </li>
              ) : (
                <li key={s.code} className="rounded-lg border border-border/70 p-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span aria-hidden className="text-xs text-muted-foreground">
                      {i + 1}.
                    </span>
                    <code className={codeChip}>{s.code}</code>
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Legal: {s.action.kind === "member" ? "a member is written by name (§7.2)" : "an assignment pattern by member name (§10.9.2)"}
                    </span>
                  </p>
                  <button type="button" onClick={() => runUnpacked(s)} className={cn(secondaryButton, "mt-2")} data-testid={`run-unpacked-${i}`}>
                    Run it
                  </button>
                </li>
              ),
            )}
          </ol>
        ) : null}
        {!packed ? (
          <p className="text-xs text-muted-foreground">Unpacked view: whole-vector statements do not compile, member writes run on their own, and the predictions, written for the packed layout, wait until you switch back.</p>
        ) : null}
        {packed && run.layoutEdited && preset.statements.some((s) => s.prediction) ? (
          <p className="text-xs text-muted-foreground">Layout edited: the predictions were written for the preset layout, so statements now run directly.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => choosePreset(preset.id)} className={secondaryButton}>
            Reset preset
          </button>
          {packed
            ? members.map((m) => {
                const offer = xWriteOffer(varName, members, m.name);
                // An enum member's x goes through a part-select, whose text names the range, so it waits for the ranges.
                if (offer.partSelect && rangesHidden) return null;
                return (
                  <button key={m.id} type="button" onClick={() => writeX(m.name)} className={secondaryButton} data-testid={`write-x-${m.id}`}>
                    {offer.partSelect ? <code className="font-mono [font-variant-ligatures:none]">{offer.label}</code> : offer.label}
                  </button>
                );
              })
            : null}
        </div>
      </section>

      <details className="rounded-xl border border-border/70 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Edit the layout: member order and widths</summary>
        <div className="mt-3 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
          <ReorderList
            label={rangesHidden ? "Member order" : "Member order (first = most significant)"}
            items={members.map((m) => ({ id: m.id, label: m.name, description: `${memberTypeText(m)}, ${m.width} bit${m.width === 1 ? "" : "s"}` }))}
            order={members.map((m) => m.id)}
            onChange={(order) => editLayout(reorderMembers(members, order))}
            mono
          />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Widths (1 to {MAX_MEMBER_WIDTH} bits)</p>
            {members.map((m) => (
              <label key={m.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-mono [font-variant-ligatures:none]">{m.name}</span>
                <WidthInput
                  value={m.width}
                  min={MIN_MEMBER_WIDTH}
                  max={Math.max(MAX_MEMBER_WIDTH, m.width)}
                  disabled={m.type.kind === "enum"}
                  label={`Width of ${m.name} in bits`}
                  onCommit={(w) => editLayout(setMemberWidth(members, m.id, w, Math.max(MAX_MEMBER_WIDTH, m.width)))}
                />
              </label>
            ))}
            {enumMember ? <p className="text-xs text-muted-foreground">An enum member keeps the width of its base type.</p> : null}
          </div>
        </div>
      </details>

      <Status text={statusText} testId="struct-status" />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Union mode
// ---------------------------------------------------------------------------

const CELL = 16;
const NIBBLE = CELL * 4 + 3;
const NIBBLE_GAP = 4;

function UnionRowView({ row, value, width, changed, unaffected, varName }: { row: UnionRow; value: SvValue; width: number; changed: readonly number[]; unaffected: readonly number[]; varName: string }) {
  const missing = Math.ceil((width - row.width) / 4);
  const placeholderWidth = missing > 0 ? missing * NIBBLE + (missing - 1) * NIBBLE_GAP : 0;
  // Only the bits beyond the written member are unaffected (§7.3.1), so a narrower row may claim its whole gap only when every bit of the gap was left alone.
  const highlightsUnaffected = row.unaffectedAbove.length > 0 && row.unaffectedAbove.every((b) => unaffected.includes(b));
  return (
    <div className="flex items-end justify-end gap-1" data-testid={`union-row-${row.path}`} style={{ paddingLeft: row.depth * 8 }}>
      <span className="mr-2 shrink-0 self-start pt-3 font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">
        {varName}.{row.path}
      </span>
      <div className="flex items-end gap-1">
        {missing > 0 ? (
          <span
            role="note"
            aria-label={`bits ${width - 1} to ${row.width} are not part of ${row.path}${highlightsUnaffected ? ", unaffected by the write" : ""}`}
            style={{ width: placeholderWidth }}
            className={cn(
              "flex h-6 items-center justify-center self-end rounded-[3px] border border-dashed text-[10px] font-medium",
              highlightsUnaffected ? "border-amber-500/80 bg-amber-500/[0.08] text-amber-900 dark:text-amber-200" : "border-slate-400/60 text-muted-foreground",
            )}
          >
            {highlightsUnaffected ? `[${width - 1}:${row.width}] unaffected` : `[${width - 1}:${row.width}] not in ${row.label}`}
          </span>
        ) : null}
        {row.pieces.map((p) => (
          <BitStrip
            key={p.path}
            bits={toBits(slice(value, p.hi, p.lo))}
            label={`${varName}.${p.path}`}
            msbIndex={p.hi}
            bitNumbers
            segments={[{ hi: p.hi, lo: p.lo, label: p.label }]}
            changed={changed.filter((b) => b >= p.lo && b <= p.hi)}
          />
        ))}
      </div>
    </div>
  );
}

interface UnionRunState {
  value: SvValue;
  applied: number;
  changed: number[];
  unaffected: number[];
  note: string;
}

function UnionMode({ preset: presetId }: { preset?: string }) {
  const [presetKey, setPresetKey] = useState(unionPreset(presetId).id);
  const preset: UnionPreset = unionPreset(presetKey);
  const [packing, setPacking] = useState<UnionPacking>(preset.union.packing);
  const narrowBase = preset.union.members.find((m) => m.id === preset.narrowMember)!;
  const [narrowWidth, setNarrowWidth] = useState(narrowBase.width);
  /** Set by a width edit, cleared by a reset: the predictions were written for the preset's widths, as in struct mode. */
  const [widthEdited, setWidthEdited] = useState(false);
  const [run, setRun] = useState<UnionRunState>({ value: unionInitialValue(preset.union), applied: 0, changed: [], unaffected: [], note: "" });
  const [path, setPath] = useState<string>(preset.statements[0]?.path ?? preset.union.members[0].name);
  const [hexInput, setHexInput] = useState("");
  const [inputError, setInputError] = useState("");
  /** Bumped on every preset choice, re-selecting the current one included, so the prediction prompts remount re-armed. */
  const [gen, setGen] = useState(0);
  const selectId = useId();
  const statementsRef = useStatementFocus(run.applied);

  const choosePreset = (id: string) => {
    const p = unionPreset(id);
    setPresetKey(p.id);
    setPacking(p.union.packing);
    setNarrowWidth(p.union.members.find((m) => m.id === p.narrowMember)!.width);
    setWidthEdited(false);
    setRun({ value: unionInitialValue(p.union), applied: 0, changed: [], unaffected: [], note: "" });
    setPath(p.statements[0]?.path ?? p.union.members[0].name);
    setHexInput("");
    setInputError("");
    setGen((g) => g + 1);
  };

  const union: UnionType = useMemo(
    () => ({ ...preset.union, packing, members: preset.union.members.map((m) => (m.id === preset.narrowMember ? { ...m, width: narrowWidth } : m)) }),
    [preset, packing, narrowWidth],
  );
  const width = unionWidth(union);
  const states = unionStates(union);
  const value = rewidthVector(run.value, width, states);
  const rows = useMemo(() => unionRows(union), [union]);
  const problems = useMemo(() => unionProblems(union), [union]);
  const paths = rows.flatMap((r) => (r.pieces.length > 1 ? [r.path, ...r.pieces.map((p) => p.path)] : [r.path]));
  const pView = formatUnionP(union, value);
  // Unequal hard packed members do not compile (§7.3.1), so nothing can run until the declaration is legal again.
  const blocked = problems.length > 0;

  const write = useCallback(
    (targetPath: string, src: SvValue, note?: string) => {
      setRun((prev) => {
        const w = writeUnionPath(union, rewidthVector(prev.value, width, states), targetPath, src);
        return { ...prev, value: w.value, changed: w.changed, unaffected: w.unaffected, note: `${w.note}${note ? ` ${note}` : ""}` };
      });
    },
    [union, width, states],
  );

  const applyStatement = useCallback(
    (index: number) => {
      setRun((prev) => {
        if (prev.applied !== index) return prev;
        const s = preset.statements[index];
        if (!s) return prev;
        const w = writeUnionPath(union, rewidthVector(prev.value, width, states), s.path, s.value);
        return { value: w.value, applied: index + 1, changed: w.changed, unaffected: w.unaffected, note: `${w.note}${s.note ? ` ${s.note}` : ""}` };
      });
    },
    [preset, union, width, states],
  );

  const submitWrite = () => {
    if (blocked) return;
    const entry = hexInput.trim();
    const digits = entry.replace(/_/g, "");
    if (!digits || !/^[0-9a-fA-F_xXzZ]+$/.test(entry)) {
      setInputError("Enter hex digits (0-9, a-f, x, z; underscores allowed).");
      return;
    }
    setInputError("");
    // The entry is a sized literal of one nibble per digit; the model's write resizes it to the member (§10.7) and says so in its note.
    write(path, svHex(digits.length * 4, digits));
  };

  const nextStatement = preset.statements[run.applied];
  const gated = Boolean(nextStatement?.prediction) && !widthEdited;

  const rowText = rows.map((r) => `${preset.varName}.${r.path} ${rangeText(r)} = ${formatSizedHex(readUnionPath(union, value, r.path))}`).join("; ");
  const statusText = `${union.name} is ${width} bits, ${states}-state, ${packing === "soft" ? "soft packed" : "hard packed"}. ${rowText}.${run.note ? ` ${run.note}` : ""}`;

  return (
    <VisualFrame label="Packed union explorer" eyebrow="Predict, then experiment" title="One storage, several names" summary={preset.summary} fidelity="model" assumptions={PACKED_LAYOUT_ASSUMPTIONS}>
      <SegmentedControl label="Union preset" options={UNION_PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={preset.id} onChange={choosePreset} mono />

      <CodeTrace label={`typedef (${preset.source})`} lines={codeLines(unionTypedef(union), "testbench")} />

      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl<UnionPacking>
          label="Packing"
          options={[
            { value: "packed", label: "union packed (hard)" },
            { value: "soft", label: "union soft" },
          ]}
          value={packing}
          onChange={setPacking}
          mono
        />
        <label className="flex items-center gap-2 text-sm">
          <span>
            Width of <code className={codeChip}>{preset.narrowMember}</code>
          </span>
          <WidthInput
            value={narrowWidth}
            min={1}
            max={64}
            label={`Width of ${preset.narrowMember} in bits`}
            onCommit={(w) => {
              setNarrowWidth(w);
              setWidthEdited(true);
            }}
          />
        </label>
        <ValueChip name="width" value={width} />
        <ValueChip name="states" value={`${states}-state`} />
      </div>

      {problems.length ? (
        <div className="space-y-2" data-testid="union-problems">
          {problems.map((p) => (
            <RuleCardView key={p.code} card={p} />
          ))}
        </div>
      ) : null}

      <StripPanel label={`Rows of ${preset.varName}`}>
        <div className="space-y-3">
          {rows.map((r) => (
            <UnionRowView key={r.path} row={r} value={value} width={width} changed={run.changed} unaffected={run.unaffected} varName={preset.varName} />
          ))}
        </div>
        {run.changed.length ? <BitStripLegend items={["changed"]} className="mt-3" /> : null}
      </StripPanel>

      <section aria-label="Statements" className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Statements</p>
        <ol ref={statementsRef} className="space-y-2">
          {preset.statements.map((s, i) => {
            const done = i < run.applied;
            const current = i === run.applied;
            return (
              <li key={s.code} data-statement={i} tabIndex={-1} className={cn("rounded-lg border p-3", statementItemFocus, done ? "border-emerald-500/40 bg-emerald-500/[0.04]" : current ? "border-amber-500/40" : "border-dashed border-border/60 opacity-60")}>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span aria-hidden className="text-xs text-muted-foreground">
                    {i + 1}.
                  </span>
                  <code className={codeChip}>{s.code}</code>
                  {done ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">run</span> : null}
                </p>
                {done && i === run.applied - 1 && run.note ? <p className="mt-1 text-xs text-muted-foreground">{run.note}</p> : null}
                {current && !gated && !blocked ? (
                  <button type="button" onClick={() => applyStatement(i)} className={cn(primaryButton, "mt-2")} data-testid="run-statement">
                    Run it
                  </button>
                ) : null}
                {/* The prompt stays mounted for the statement it just ran, so its feedback remains readable; hidden, not unmounted, while the declaration does not compile, so its answer survives. */}
                {s.prediction && !widthEdited && (current || i === run.applied - 1) ? (
                  <div hidden={blocked}>
                    <PredictionPrompt key={`${preset.id}-${gen}-${i}`} question={s.prediction.question} options={toOptions(s.prediction.options)} resetKey={`${preset.id}-${gen}-${i}`} className="mt-2">
                      <OnReveal onReveal={() => applyStatement(i)} />
                      <p className="text-sm text-muted-foreground">Every row above now shows the new bits.</p>
                    </PredictionPrompt>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {blocked ? <p className="text-xs text-muted-foreground">This declaration does not compile, so nothing can run: make the widths equal, or switch to union soft.</p> : null}
        {widthEdited && !blocked && preset.statements.some((s) => s.prediction) ? (
          <p className="text-xs text-muted-foreground">Width edited: the predictions were written for the preset widths, so statements now run directly.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => choosePreset(preset.id)} className={secondaryButton}>
            Reset preset
          </button>
        </div>
      </section>

      <section aria-label="Write through a row" className="space-y-2 rounded-xl border border-border/70 p-3">
        <p className="text-sm font-semibold text-foreground">Write through any row</p>
        <div className="flex flex-wrap items-end gap-2">
          <label htmlFor={`${selectId}-path`} className="text-sm">
            Member
          </label>
          <select id={`${selectId}-path`} value={path} onChange={(e) => setPath(e.target.value)} className="h-10 rounded-lg border border-border/70 bg-background px-2 font-mono text-sm text-foreground">
            {paths.map((p) => (
              <option key={p} value={p}>
                {preset.varName}.{p}
              </option>
            ))}
          </select>
          <label htmlFor={`${selectId}-hex`} className="text-sm">
            Hex value
          </label>
          <input
            id={`${selectId}-hex`}
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitWrite();
            }}
            placeholder="e.g. DEAD"
            className="h-10 w-32 rounded-lg border border-border/70 bg-background px-2 font-mono text-sm text-foreground"
          />
          <button type="button" onClick={submitWrite} disabled={blocked} className={primaryButton} data-testid="union-write">
            Write
          </button>
        </div>
        {inputError ? (
          <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">
            {inputError}
          </p>
        ) : null}
      </section>

      <div role="note" className="rounded-lg border border-border/70 p-3 text-sm" data-testid="union-p">
        <code className={codeChip}>$display(&quot;%p&quot;, {preset.varName});</code> prints <code className={codeChip}>{pView.text}</code>
        <p className="mt-1 text-muted-foreground">This is the first-declared-member reading of §21.2.1.6, here {pView.member}.</p>
        <details className="mt-1 text-muted-foreground">
          <summary className="cursor-pointer text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Why tools can differ</summary>
          <p className="mt-1">
            The standard states that rule for unions in its paragraph on aggregates, while its rules for singular values name only packed structures, and a packed union is a singular integral value, so packed-union %p output is tool-dependent. Print the member you
            need, or the raw view with %h.
          </p>
        </details>
      </div>

      <Status text={statusText} testId="union-status" />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Tagged mode
// ---------------------------------------------------------------------------

function TaggedMode() {
  const [third, setThird] = useState(false);
  const [packed, setPacked] = useState(false);
  const [v, setV] = useState<TaggedValue>(UNDEFINED_TAGGED);
  const [pendingRead, setPendingRead] = useState<string | null>(null);
  const [readCount, setReadCount] = useState(0);
  const [pShown, setPShown] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const readResultRef = useRef<HTMLParagraphElement>(null);

  const type: TaggedUnionType = useMemo(() => ({ ...VINT, members: third ? [...VINT.members, VINT_THIRD_MEMBER] : VINT.members }), [third]);
  const tagName = v.tagIndex === null ? null : type.members[v.tagIndex].name;
  const layout = taggedPackedLayout(type);
  const picture = useMemo(() => taggedPackedBits(type, v), [type, v]);
  const read = pendingRead ? readTagged(type, v, pendingRead) : null;

  const assign = (member: TaggedMember) => {
    setV(makeTagged(type, member.name, taggedAssignValue(member)));
    setPendingRead(null);
    setPShown(false);
    setLog((l) => [...l, taggedAssignStatement(member)]);
  };

  const startRead = (member: string) => {
    setPendingRead(member);
    setReadCount((n) => n + 1);
    setPShown(false);
  };

  const resetV = () => {
    setV(UNDEFINED_TAGGED);
    setPendingRead(null);
    setPShown(false);
    setLog([]);
  };

  const toggleThird = () => {
    setThird((t) => !t);
    resetV();
  };

  const valueText = v.tagIndex === null ? "undefined" : v.value ? formatSizedHex(v.value) : "(void: no value)";
  const statusText = `v: tag ${tagName ?? "undefined"}, value ${valueText}. ${packed ? picture.note : `Tag width ${layout.tagBits} bit${layout.tagBits === 1 ? "" : "s"} for ${type.members.length} members (§7.3.2).`}`;

  return (
    <VisualFrame
      label="Tagged union explorer"
      eyebrow="Predict, then run"
      title="The tag guards every read"
      summary="Build VInt values with tagged expressions, then predict whether each read is legal before running it (§11.9)."
      fidelity="model"
      assumptions={PACKED_LAYOUT_ASSUMPTIONS}
    >
      <CodeTrace label={third ? "typedef (our example, after §7.3.2)" : "typedef (IEEE 1800-2023 §7.3.2 example)"} lines={codeLines(taggedTypedef(type, packed), "testbench")} />

      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={third} onClick={toggleThird} className={toggleButton(third)} data-testid="tagged-third">
          Third member (bit [7:0] Small)
        </button>
        <button type="button" aria-pressed={packed} onClick={() => setPacked((p) => !p)} className={toggleButton(packed)} data-testid="tagged-packed">
          Packed layout
        </button>
        <button type="button" onClick={resetV} className={secondaryButton}>
          Reset v
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Statements">
        {type.members.map((m) => (
          <button key={m.name} type="button" onClick={() => assign(m)} className={secondaryButton}>
            <code className="font-mono [font-variant-ligatures:none]">{taggedAssignStatement(m)}</code>
          </button>
        ))}
        {type.members
          .filter((m) => m.width !== null)
          .map((m) => (
            <button key={`read-${m.name}`} type="button" onClick={() => startRead(m.name)} className={secondaryButton}>
              <code className="font-mono [font-variant-ligatures:none]">$display(&quot;%0d&quot;, v.{m.name});</code>
            </button>
          ))}
        <button type="button" onClick={() => setPShown(true)} className={secondaryButton}>
          <code className="font-mono [font-variant-ligatures:none]">$display(&quot;%p&quot;, v);</code>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ValueChip name="tag" value={tagName ?? "undefined"} changed={false} />
        <span data-testid="tagged-value" className="inline-flex items-center gap-1.5 rounded-md border border-indigo-400/60 bg-indigo-500/10 px-2 py-0.5 font-mono text-sm text-indigo-800 dark:text-indigo-100">
          <span className="text-xs opacity-90">value</span>
          <span className="font-semibold">{valueText}</span>
        </span>
        {pShown ? (
          <span data-testid="tagged-p" className="text-sm">
            <code className={codeChip}>%p</code> prints <code className={codeChip}>{formatTaggedP(type, v)}</code> <span className="text-xs text-muted-foreground">(tag:value, §21.2.1.6)</span>
          </span>
        ) : null}
      </div>

      {pendingRead ? (
        <PredictionPrompt key={readCount} question={TAGGED_READ_PREDICTION(`v.${pendingRead}`, tagName).question} options={toOptions(TAGGED_READ_PREDICTION(`v.${pendingRead}`, tagName).options)} resetKey={String(readCount)}>
          <OnReveal onReveal={() => readResultRef.current?.focus()} />
          {read ? (
            <p ref={readResultRef} tabIndex={-1} data-testid="tagged-read-result" className={cn("text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", read.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
              <span aria-hidden>{read.ok ? "✓ " : "✕ "}</span>
              {/* The statement is %0d, so the printed text is decimal (§21.2.1.3); the value chip above keeps the sized hex. */}
              {read.ok ? `$display prints ${read.value.width === 0 ? "nothing" : formatD(read.value)}. ${read.note}` : read.error}
            </p>
          ) : null}
        </PredictionPrompt>
      ) : null}

      {packed ? (
        <StripPanel label="Packed bits of v">
          <BitStrip bits={picture.bits} label={`v, ${type.name} packed`} bitNumbers segments={picture.segments} undefinedBits={picture.undefinedBits} />
          <BitStripLegend items={["undefined"]} className="mt-2" />
          <p className="mt-2 text-sm text-muted-foreground" data-testid="tagged-layout-note">
            {layout.width} bits: tag {rangeText({ hi: layout.tagHi, lo: layout.tagLo })} ({layout.tagBits} bit{layout.tagBits === 1 ? "" : "s"} for {type.members.length} members). {picture.note}
          </p>
        </StripPanel>
      ) : null}

      {log.length ? <CodeTrace label="Statements run" lines={log.map((t, i) => ({ text: t, key: `s${i}`, owner: "testbench" as const }))} /> : null}

      <Status text={statusText} testId="tagged-status" />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Mutation mode
// ---------------------------------------------------------------------------

function MutationMode() {
  const board = useMemo(() => mutationBoard(), []);
  const [predictions, setPredictions] = useState<Record<string, MutationPrediction>>({});
  const [revealed, setRevealed] = useState(false);
  /** Set by "Run without predicting": unmarked cells then stay ungraded instead of counting as "will miss". */
  const [skipped, setSkipped] = useState(false);
  const [selected, setSelected] = useState<{ row: string; col: MutationId }>({ row: TB_CHECKS[0].id, col: MUTATIONS[0].id });
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  const cells: Record<string, MutationCell> = useMemo(() => {
    const out: Record<string, MutationCell> = {};
    for (const [key, cell] of Object.entries(board.cells)) out[key] = { state: cell.state, summary: cell.summary };
    return out;
  }, [board]);

  const reveal = (asSkipped: boolean) => {
    setSkipped(asSkipped);
    setRevealed(true);
  };
  // The control that started or reset the run unmounts with it, so focus moves to what replaces it.
  const previouslyRevealed = useRef(false);
  useEffect(() => {
    if (revealed && !previouslyRevealed.current) resultsRef.current?.focus();
    if (!revealed && previouslyRevealed.current) skipRef.current?.focus();
    previouslyRevealed.current = revealed;
  }, [revealed]);

  const allKeys = TB_CHECKS.flatMap((c) => MUTATIONS.map((m) => ({ key: cellKey(c.id, m.id), where: `${c.label} against ${m.label}` })));
  // The task is to mark the checks expected to fail, so at the reveal an unmarked cell means "will miss".
  const graded: Record<string, MutationPrediction> = useMemo(() => {
    if (!revealed || skipped) return predictions;
    return Object.fromEntries(TB_CHECKS.flatMap((c) => MUTATIONS.map((m) => [cellKey(c.id, m.id), predictions[cellKey(c.id, m.id)] ?? "miss"] as const)));
  }, [revealed, skipped, predictions]);
  const missedCatches = allKeys.filter(({ key }) => board.cells[key].state === "caught" && predictions[key] !== "catch");
  const marked = Object.keys(predictions).length;

  const selectedRun = board.runs[selected.col];
  const selectedCheck = TB_CHECKS.find((c) => c.id === selected.row)!;
  const selectedMutation = MUTATIONS.find((m) => m.id === selected.col)!;
  const selectedCell = board.cells[cellKey(selected.row, selected.col)];
  const failLine = selectedRun.log.indexOf(`FAIL: ${selectedCheck.label}`);
  const diff = changedLogLines(board.baseline, selectedRun);
  const agreement = MUTATIONS.map((m) => {
    const got = failingChecks(board.runs[m.id]);
    const expected = [...LESSON_EXPECTED_FAILURES[m.id]];
    return { id: m.id, label: m.label, agrees: got.length === expected.length && got.every((id, i) => id === expected[i]), got, expected };
  });

  return (
    <VisualFrame
      label="Mutation board for the lesson's tb_top"
      eyebrow="Predict, then run"
      title="Which self-check catches which change?"
      summary="The lesson's tb_top has eleven named checks. For each of the three edits from Make It Work, mark the checks you expect to fail, then run the model. A cell you leave unmarked counts as will miss."
      fidelity="model"
      assumptions={[...PACKED_LAYOUT_ASSUMPTIONS, "Each cell runs the whole tb_top with that one edit applied; a check 'catches' the edit when it prints FAIL."]}
    >
      <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        {MUTATIONS.map((m) => (
          <div key={m.id} className="rounded-lg border border-border/70 p-3 text-sm">
            <p className="font-semibold text-foreground">{m.label}</p>
            <p className="text-xs text-muted-foreground">{m.description}</p>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-950/90 p-2 font-mono text-[11px] leading-4 text-slate-100 [font-variant-ligatures:none]">
              <code>
                {m.before.split("\n").map((l) => `- ${l}`).join("\n")}
                {"\n"}
                {m.after.split("\n").map((l) => `+ ${l}`).join("\n")}
              </code>
            </pre>
          </div>
        ))}
      </div>

      <MutationMatrix
        label="Checks against mutations"
        rows={TB_CHECKS.map((c) => ({ id: c.id, label: c.label }))}
        columns={MUTATIONS.map((m) => ({ id: m.id, label: m.label }))}
        cells={cells}
        predictions={graded}
        onPredict={(rowId, colId, value) => setPredictions((p) => ({ ...p, [cellKey(rowId, colId)]: value }))}
        revealed={revealed}
        onCellSelect={(rowId, colId) => setSelected({ row: rowId, col: colId as MutationId })}
        selectedCell={revealed ? cellKey(selected.row, selected.col) : undefined}
        rowHeader="Check"
        columnNoun="mutation"
        columnTotals
      />

      <div className="flex flex-wrap gap-2">
        {!revealed ? (
          <>
            <button type="button" disabled={marked === 0} onClick={() => reveal(false)} className={primaryButton} data-testid="mutation-reveal">
              Run the three mutants
            </button>
            <button ref={skipRef} type="button" onClick={() => reveal(true)} className={secondaryButton} data-testid="mutation-skip">
              Run without predicting
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setRevealed(false);
              setSkipped(false);
              setPredictions({});
            }}
            className={secondaryButton}
          >
            Reset predictions
          </button>
        )}
      </div>
      {!revealed && marked === 0 ? <p className="text-xs text-muted-foreground">Mark at least one check first, or run without predicting.</p> : null}

      {revealed ? (
        <div className="space-y-3" data-testid="mutation-results">
          <h4 ref={resultsRef} tabIndex={-1} className="text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Results
          </h4>
          {skipped ? null : (
            <p className="text-sm text-foreground" data-testid="mutation-missed">
              {missedCatches.length === 0
                ? "You marked every check that caught a mutation."
                : `You did not mark ${missedCatches.length} check${missedCatches.length === 1 ? "" : "s"} that caught a mutation: ${missedCatches.map((c) => c.where).join("; ")}.`}
            </p>
          )}
          <SegmentedControl<MutationId> label="Show the log of" options={MUTATIONS.map((m) => ({ value: m.id, label: m.label }))} value={selected.col} onChange={(col) => setSelected((prev) => ({ ...prev, col }))} />
          <p className="text-sm text-muted-foreground" data-testid="mutation-selected">
            {selectedCheck.label} against {selectedMutation.label}: {selectedCell.summary}.{" "}
            {failLine >= 0 ? "Its FAIL line is highlighted below." : "This check passed here, so it has no FAIL line."}
          </p>
          <div className="rounded-lg border border-border/70 p-3 text-sm">
            <p className="font-semibold text-foreground">Changed $display lines</p>
            {diff.length === 0 ? (
              <p className="text-muted-foreground">No $display line changes; only the FAIL lines and the PASS/FAIL count differ.</p>
            ) : (
              <ul className="mt-1 space-y-1 font-mono text-xs [font-variant-ligatures:none]">
                {diff.map((d) => (
                  <li key={d.index} className="break-words">
                    <span className="text-rose-700 dark:text-rose-300">- {d.before}</span>
                    <br />
                    <span className="text-emerald-700 dark:text-emerald-300">+ {d.after}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <CodeTrace
            label={`tb_top output with "${selectedMutation.label}"`}
            lines={selectedRun.log.map((t, i) => ({ text: t, key: t.startsWith("FAIL:") ? `fail${i}` : `log${i}`, owner: "testbench" as const }))}
            activeKey={failLine >= 0 ? `fail${failLine}` : undefined}
            contextKeys={selectedRun.log.map((t, i) => (t.startsWith("FAIL:") ? `fail${i}` : "")).filter(Boolean)}
          />
          <ul className="space-y-1 text-xs" data-testid="lesson-agreement">
            {agreement.map((a) => (
              <li key={a.id} className={a.agrees ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                <span aria-hidden>{a.agrees ? "✓ " : "✕ "}</span>
                {a.label}: the lesson expects {a.expected.map((id) => TB_CHECKS.find((c) => c.id === id)?.label).join(", ")} to fail
                {a.agrees ? "; the model agrees." : `; the model got ${a.got.join(", ") || "none"}. Report this to the lesson's maintainer.`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Debug mode (struct and enum clinic)
// ---------------------------------------------------------------------------

function DebugMode({ preset: presetId }: { preset?: string }) {
  const [scenarioKey, setScenarioKey] = useState(clinicScenario(presetId).id);
  const scenario = clinicScenario(scenarioKey);
  const [causeRevealed, setCauseRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [suspectShown, setSuspectShown] = useState(false);
  const [fix, setFix] = useState<FixId | null>(null);
  const [rerun, setRerun] = useState<{ fix: FixId; result: ClinicRun } | null>(null);
  /** Bumped on every scenario choice and reset, so the prompt and the hints remount re-armed. */
  const [gen, setGen] = useState(0);
  const linesHeadingRef = useRef<HTMLHeadingElement>(null);
  const suspectLineRef = useRef<HTMLButtonElement>(null);

  const choose = (id: string) => {
    setGen((g) => g + 1);
    setScenarioKey(clinicScenario(id).id);
    setCauseRevealed(false);
    setPicked(null);
    setSuspectShown(false);
    setFix(null);
    setRerun(null);
  };

  const asFound = useMemo(() => scenario.run(null), [scenario]);
  const isSuspectLine = (key: string | null) => key !== null && scenario.suspectKeys.includes(key);
  const found = isSuspectLine(picked) || suspectShown;
  const pickedLine = scenario.lines.find((l) => l.key === picked);
  const onCauseReveal = useCallback(() => setCauseRevealed(true), []);

  // The control pressed unmounts in each of these steps, so focus moves to what it opened.
  useEffect(() => {
    if (causeRevealed) linesHeadingRef.current?.focus();
  }, [causeRevealed]);
  useEffect(() => {
    if (suspectShown) suspectLineRef.current?.focus();
  }, [suspectShown]);

  const verdict = rerun
    ? rerun.result.fixed
      ? `Fixed. ${scenario.fixFeedback[rerun.fix]}`
      : `The symptom is still there. ${scenario.fixFeedback[rerun.fix]}`
    : "";

  return (
    <VisualFrame
      label="Struct and enum debugging clinic"
      eyebrow="Debug it"
      title={scenario.title}
      summary={scenario.symptom}
      fidelity="model"
      assumptions={[...PACKED_LAYOUT_ASSUMPTIONS, "Logs are regenerated by the model for the declaration you choose, so a fix that does not touch the cause keeps the symptom."]}
    >
      <SegmentedControl label="Scenario" options={CLINIC_SCENARIOS.map((s) => ({ value: s.id, label: s.title }))} value={scenario.id} onChange={choose} />

      <CodeTrace label="Log, as found" lines={asFound.log.map((t, i) => ({ text: t, key: `a${i}` }))} />

      <PredictionPrompt key={`${scenario.id}-${gen}`} question="What is the root cause?" options={toOptions(scenario.causes, "prose")} resetKey={`${scenario.id}-${gen}`}>
        <OnReveal onReveal={onCauseReveal} />
        <p className="text-sm text-muted-foreground">Now find the declaration that causes it.</p>
      </PredictionPrompt>

      {causeRevealed ? (
        <section aria-label="Declarations" className="space-y-2" data-testid="clinic-lines">
          <h4 ref={linesHeadingRef} tabIndex={-1} className="text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Click the suspect declaration line
          </h4>
          <ol className="overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 py-2 font-mono text-[12px] leading-6 text-slate-100 [font-variant-ligatures:none]">
            {scenario.lines.map((l, i) => {
              const isPicked = picked === l.key;
              const isSuspect = isSuspectLine(l.key);
              const mark = isPicked || (suspectShown && isSuspect) ? (isSuspect ? "✓" : "✕") : "";
              return (
                <li key={l.key}>
                  <button
                    ref={l.key === scenario.suspectKeys[0] ? suspectLineRef : undefined}
                    type="button"
                    onClick={() => setPicked(l.key)}
                    aria-pressed={isPicked}
                    aria-label={`Line ${i + 1}: ${l.text.trim()}${mark ? (isSuspect ? ", the suspect" : ", not the suspect") : ""}`}
                    className={cn(
                      "flex w-full items-start gap-2 border-l-2 px-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 motion-reduce:transition-none",
                      isPicked || (suspectShown && isSuspect) ? (isSuspect ? "border-emerald-400 bg-emerald-400/10" : "border-rose-400 bg-rose-400/10") : "border-transparent",
                    )}
                  >
                    <span aria-hidden className="w-6 shrink-0 text-right text-[11px] text-slate-400">
                      {i + 1}
                    </span>
                    <code className="min-w-0 flex-1 whitespace-pre-wrap break-words">{l.text}</code>
                    <span aria-hidden className={cn("w-4 shrink-0", isSuspect ? "text-emerald-300" : "text-rose-300")}>
                      {mark}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {pickedLine ? (
            <p data-testid="clinic-line-feedback" className={cn("text-sm", isSuspectLine(pickedLine.key) ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
              <span aria-hidden>{isSuspectLine(pickedLine.key) ? "✓ " : "✕ "}</span>
              {pickedLine.whenPicked}
            </p>
          ) : null}
          {!found ? (
            <button type="button" onClick={() => setSuspectShown(true)} className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Show the suspect
            </button>
          ) : null}
        </section>
      ) : null}

      {causeRevealed && found ? (
        <section aria-label="Fix" className="space-y-2" data-testid="clinic-fix">
          <p className="text-sm font-semibold text-foreground">Pick a fix, then rerun</p>
          {/* Plain buttons, not a radio group: with nothing chosen yet every option must still be reachable by Tab. */}
          <div role="group" aria-label="Fix" className="flex flex-wrap gap-2">
            {CLINIC_FIXES.map((f) => (
              <button key={f.id} type="button" aria-pressed={fix === f.id} onClick={() => setFix(f.id)} className={toggleButton(fix === f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          {fix ? <CodeTrace label="Change" lines={codeLines(scenario.fixCode[fix], "testbench")} /> : null}
          <button type="button" disabled={!fix} onClick={() => fix && setRerun({ fix, result: scenario.run(fix) })} className={primaryButton} data-testid="clinic-rerun">
            Rerun
          </button>
          {rerun ? <CodeTrace label={`Log after rerun with "${CLINIC_FIXES.find((f) => f.id === rerun.fix)?.label}"`} lines={rerun.result.log.map((t, i) => ({ text: t, key: `r${i}` }))} /> : null}
          <p role="status" aria-live="polite" data-testid="clinic-verdict" className={cn("text-sm", rerun ? (rerun.result.fixed ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300") : "text-muted-foreground")}>
            {rerun ? (
              <>
                <span aria-hidden>{rerun.result.fixed ? "✓ " : "✕ "}</span>
                {verdict} {rerun.result.verdict}
              </>
            ) : null}
          </p>
        </section>
      ) : null}

      <HintLadder hints={[...scenario.hints]} resetKey={`${scenario.id}-${gen}`} />
      <button type="button" onClick={() => choose(scenario.id)} className={secondaryButton}>
        Reset scenario
      </button>
      {/* The clause names the rule behind the cause, so it waits for the cause. */}
      {causeRevealed ? <p className="text-xs text-muted-foreground">Source: IEEE 1800-2023 {scenario.clause}.</p> : null}
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export default function PackedLayoutExplorer({ mode = "struct", preset }: PackedLayoutExplorerProps) {
  return (
    <div data-testid="packed-layout-explorer" data-mode={mode} className="min-w-0">
      {mode === "union" ? <UnionMode preset={preset} /> : mode === "tagged" ? <TaggedMode /> : mode === "mutation" ? <MutationMode /> : mode === "debug" ? <DebugMode preset={preset} /> : <StructMode preset={preset} />}
    </div>
  );
}
