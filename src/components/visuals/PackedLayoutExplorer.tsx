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
  MAX_MEMBER_WIDTH,
  MIN_MEMBER_WIDTH,
  MUTATIONS,
  TB_CHECKS,
  UNDEFINED_TAGGED,
  changedLogLines,
  changedReadsText,
  enumDeclarationText,
  enumMemberReadout,
  enumTrackAfterLayoutEdit,
  enumTrackAfterWrite,
  formatD,
  formatSizedHex,
  formatUnionP,
  hexAligned,
  lessonHexDigits,
  makeTagged,
  memberRanges,
  memberTypeText,
  mutationBoard,
  NEVER_ASSIGNED_TRACK,
  nibbleOverlay,
  rangeText,
  readMember,
  readTagged,
  readUnionPiece,
  readUnionPath,
  reorderMembers,
  rewidthVector,
  setMemberWidth,
  structBits,
  structInitialValue,
  structStates,
  structTypedef,
  structVectorCards,
  svHex,
  taggedPReading,
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
  type EnumTrack,
  type MutationId,
  type NamedRead,
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
  CLINIC_NOTE_PREFIX,
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
  "White space in %p output is implementation dependent (§21.2.1.6); the model prints one spacing. The output shall be a legal interpretation of the assignment pattern syntax (§21.2.1.6), which is built from braces prefixed with an apostrophe (§10.9), so an untagged union's first member prints as '{name:value} and a tagged union's tag:value as '{tag:value}. A void member has no value (§7.3.2), and what stands for it is not stated, so '{tag} for one is derived.",
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
 * Scrolls a strip panel sideways, and only sideways, until a bit is in view. The
 * panel opens at the MSB end, so at phone width a write to the low bits would
 * otherwise happen off screen. The bit is found by the number BitStrip draws above it.
 */
function scrollBitIntoView(panel: HTMLElement, bit: number) {
  const cell = Array.from(panel.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')).find((el) => el.childElementCount === 0 && el.textContent === String(bit));
  if (!cell || typeof panel.scrollTo !== "function") return;
  const box = panel.getBoundingClientRect();
  const rect = cell.getBoundingClientRect();
  if (rect.left >= box.left && rect.right <= box.right) return;
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  panel.scrollTo({ left: panel.scrollLeft + rect.left - box.left - 16, behavior: reduced ? "auto" : "smooth" });
}

/**
 * Strips never wrap: they scroll inside this panel, so the page itself never
 * scrolls sideways. When it overflows the panel takes focus, so a keyboard can
 * reach the low bits in browsers that do not make scrollers focusable. `reveal`
 * lists the bits a write just changed, most significant first; the panel brings
 * the first one into view.
 *
 * Only the strips go in `children`: that box is as wide as its widest line, so a
 * sentence in it would never wrap. Legends and notes go in `footer`, outside the
 * scroller, where they wrap to the panel and stay put while the bits scroll.
 */
function StripPanel({ children, footer, label, className, reveal }: { children: React.ReactNode; footer?: React.ReactNode; label: string; className?: string; reveal?: readonly number[] }) {
  const [ref, overflowing] = useHorizontalOverflow<HTMLDivElement>();
  useEffect(() => {
    if (ref.current && reveal?.length) scrollBitIntoView(ref.current, reveal[0]);
  }, [ref, reveal]);
  return (
    <div className={cn("min-w-0 rounded-xl border border-border/70 bg-background/50 p-2", className)}>
      {/* The padding is on the scroller, so a cell's ring at the edge is not clipped by it. */}
      <div
        ref={ref}
        role="region"
        aria-label={overflowing ? `${label} (scrolls sideways)` : label}
        tabIndex={overflowing ? 0 : undefined}
        className="min-w-0 overflow-x-auto p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="w-max min-w-full" data-testid="strip-scroll">
          {children}
        </div>
      </div>
      {footer ? <div className="mt-1 space-y-2 px-1 pb-1">{footer}</div> : null}
    </div>
  );
}

/**
 * A width field that commits typed text on blur or Enter, not on every
 * keystroke, so backspacing through "16" does not pass through width 1 and cut
 * the vector. A step is a finished choice, so the arrow keys and the spinner
 * commit at once.
 */
function WidthInput({ value, min, max, disabled, label, onCommit }: { value: number; min: number; max: number; disabled?: boolean; label: string; onCommit: (width: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  /** The text when a press on the field began: if a press changes it without a key, the press was on the spinner. */
  const textAtPress = useRef<string | null>(null);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }
  const commit = (text: string) => {
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n)) {
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
      onBlur={(e) => commit(e.target.value)}
      onPointerDown={(e) => {
        textAtPress.current = e.currentTarget.value;
      }}
      onPointerUp={(e) => {
        if (textAtPress.current !== null && textAtPress.current !== e.currentTarget.value) commit(e.currentTarget.value);
        textAtPress.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(draft);
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const typed = draft.trim() === "" || !Number.isFinite(Number(draft)) ? value : Number(draft);
          commit(String(typed + (e.key === "ArrowUp" ? 1 : -1)));
        }
      }}
      className="h-10 w-20 rounded-lg border border-border/70 bg-background px-2 text-right font-mono text-sm text-foreground disabled:opacity-50"
    />
  );
}

const WIDTH_HINT = "Type a width, then press Enter or leave the field; the arrows apply at once.";

/**
 * Moves focus to the feedback of a revealed PredictionPrompt, its polite region.
 * That region mounts together with its text, which screen readers announce
 * unreliably, and the diagnosis is the point of predict-then-reveal, so a learner
 * must not be moved past it. Tab then goes on to the next control. Returns false
 * when `container` holds no revealed prompt.
 */
function focusPromptFeedback(container: Element | null | undefined): boolean {
  const feedback = container?.querySelector<HTMLElement>('[aria-live="polite"]');
  if (!feedback) return false;
  feedback.tabIndex = -1;
  feedback.focus();
  return true;
}

const feedbackFocusRing = "[&_[aria-live=polite]:focus-visible]:outline-none [&_[aria-live=polite]:focus-visible]:ring-2 [&_[aria-live=polite]:focus-visible]:ring-ring";

/**
 * The control that ran a statement unmounts with it, so focus would fall back
 * to the page. After a step answered by a prediction it moves to that prompt's
 * feedback. After a plain "Run it" it moves to what comes next: the next
 * statement's "Run it" or first prediction radio, or the statement that just ran
 * when the sequence is over. A reset lowers `applied` and leaves focus where it is.
 */
function useStatementFocus(applied: number) {
  const listRef = useRef<HTMLOListElement>(null);
  const previous = useRef(applied);
  useEffect(() => {
    const advanced = applied > previous.current;
    previous.current = applied;
    if (!advanced) return;
    const item = (index: number) => listRef.current?.querySelector<HTMLElement>(`[data-statement="${index}"]`);
    if (focusPromptFeedback(item(applied - 1))) return;
    const target = item(applied)?.querySelector<HTMLElement>('[data-run-statement], input[type="radio"]:not(:disabled)') ?? item(applied - 1);
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

/**
 * The full value map stays on screen as plain text. Only what changed, plus the
 * note, goes to the live region, so a six-member register is not read out in
 * full on every step, over the prompt's feedback.
 */
function StatusWithAnnouncement({ text, announcement, testId }: { text: string; announcement: string; testId: string }) {
  return (
    <>
      <p data-testid={testId} className="text-sm text-foreground">
        {text}
      </p>
      <p role="status" aria-live="polite" data-testid={`${testId}-live`} className="sr-only">
        {announcement}
      </p>
    </>
  );
}

/** The one caveat behind every packed %p reading, folded so the output itself stays short. */
function WhyToolsDiffer({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-1 text-muted-foreground">
      <summary className="cursor-pointer text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Why tools can differ</summary>
      <p className="mt-1">{children}</p>
    </details>
  );
}

const announcementOf = (changed: string, note: string): string => [changed ? `${changed}.` : "No value changed.", note].filter(Boolean).join(" ");

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
  /**
   * Why the preset's predictions and notes no longer hold: a typedef edit, or a
   * write outside the sequence. Null while the run is still the preset's own.
   */
  voided: "layout" | "write" | null;
  /** Whether anything has written the variable: a statement, an x write or an unpacked member write. A typedef edit alone does not. */
  wrote: boolean;
  /** How the enum member's current value got there, and the range it was written at, so the readout names the real path (`enumTrackAfterWrite`, `enumTrackAfterLayoutEdit`). */
  enum: EnumTrack;
  /** About the statement that ran last; shown under it. */
  note: string;
  /** About a change made outside the sequence; shown beside the control that made it. */
  experiment: { source: "x" | "layout" | "unpacked"; text: string } | null;
  /** The live region's text: what the last action changed. */
  announcement: string;
}

const initialStructState = (p: StructPreset): StructRunState => ({
  members: [...p.members],
  value: structInitialValue(p.members),
  varName: currentVarName(p, 0),
  applied: 0,
  changed: [],
  voided: null,
  wrote: false,
  enum: NEVER_ASSIGNED_TRACK,
  note: "",
  experiment: null,
  announcement: "",
});

const memberReads = (members: readonly PackedMember[], before: SvValue, after: SvValue): NamedRead[] =>
  members.map((m) => ({ name: m.name, before: readMember(members, before, m.name), after: readMember(members, after, m.name) }));

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
    setRun({ ...initialStructState(structPreset(id)), announcement: "Reset: nothing has run yet." });
    setPacked(true);
    setGen((g) => g + 1);
  };

  const { members, value, applied, varName } = run;
  const ranges = useMemo(() => memberRanges(members), [members]);
  const width = structBits(members);
  const states = structStates(members);
  // Until the first gated statement is answered, the bit ranges would answer it, so they appear on commit.
  const firstGate = preset.statements.findIndex((s) => s.prediction);
  const rangesHidden = firstGate >= 0 && applied <= firstGate && !run.voided;
  const segments: BitSegment[] = rangesHidden ? [] : ranges.map((r) => ({ hi: r.hi, lo: r.lo, label: r.name }));
  const overlay = useMemo(() => nibbleOverlay(members, value), [members, value]);
  const cards = useMemo(() => structVectorCards(varName, members, packed, value), [varName, members, packed, value]);
  // The first card is the part-select, which names the first member's range.
  const shownCards = rangesHidden ? cards.slice(1) : cards;
  const hasWrite = run.wrote;
  const enumMember = members.find((m) => m.type.kind === "enum");
  const enumDeclarations = Array.from(new Set(members.flatMap((m) => (m.type.kind === "enum" ? [enumDeclarationText(m.type.spec)] : []))));
  // The readout explains the vector back door, which only a packed struct has. Before a statement runs it would show "" and give away the enum-field prediction.
  const enumReadout = packed && enumMember && hasWrite ? enumMemberReadout(members, value, enumMember.name, run.enum.arrival) : null;
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
        // A preset's own note describes the preset's own run, so once the run has left it only the model's note is true.
        const presetNote = prev.voided ? "" : (s.note ?? "");
        // The model's member-write note names the bit range, which would answer a prediction that is still open.
        const rangesStillHidden = !prev.voided && firstGate >= 0 && index + 1 <= firstGate;
        let note = presetNote;
        let enumTrack: EnumTrack;
        if (s.action.kind === "member") {
          const written = s.action.member;
          const w = writeMember(prev.members, prev.value, written, s.action.value);
          changed = w.changed;
          note = `${rangesStillHidden ? `${written} is written; the other members keep their bits (§7.2.1).` : w.note} ${presetNote}`.trim();
          enumTrack = enumTrackAfterWrite(prev.members, prev.enum, written, "member-write");
        } else if (s.action.kind === "whole") {
          const a = runWholeAction(prev.members, s.action);
          extendedFrom = a.extendedFrom;
          droppedFrom = a.droppedFrom;
          enumTrack = enumTrackAfterWrite(prev.members, prev.enum, null, "whole-vector");
          // Truncation marks nothing on the strip (the discarded bits are the source's, above the MSB), so the note carries it.
          if (prev.voided || a.droppedFrom !== undefined) note = `${a.note} ${presetNote}`.trim();
        } else {
          enumTrack = enumTrackAfterWrite(prev.members, prev.enum, null, "member-write");
          if (prev.voided) note = "An assignment pattern by member name writes every member (§10.9.2).";
        }
        const varNext = currentVarName(preset, index + 1);
        const changedText = changedReadsText(memberReads(prev.members, prev.value, next), { name: varNext, value: next });
        return { ...prev, value: next, varName: varNext, applied: index + 1, changed, extendedFrom, droppedFrom, wrote: true, enum: enumTrack, note, experiment: null, announcement: announcementOf(changedText, note) };
      });
    },
    [preset, firstGate],
  );

  const editLayout = (nextMembers: PackedMember[]) => {
    setRun((prev) => {
      const text = "Layout edited: the vector keeps its bits and the member names move over it.";
      const bits = structBits(nextMembers);
      return {
        ...prev,
        members: nextMembers,
        value: rewidthVector(prev.value, bits, structStates(nextMembers)),
        changed: [],
        extendedFrom: undefined,
        droppedFrom: undefined,
        voided: "layout",
        // Only a move of the enum member's own range puts other bits under it; a reorder that leaves it where it was written keeps the earlier arrival.
        enum: enumTrackAfterLayoutEdit(nextMembers, prev.enum),
        note: "",
        experiment: { source: "layout", text },
        announcement: `${text} $bits is ${bits}.`,
      };
    });
  };

  const writeX = (name: string) => {
    setRun((prev) => {
      const w = writeXInMember(prev.members, prev.value, name);
      // An enum member's x goes in through a part-select (`xWriteOffer`); any other member's write leaves the enum's arrival as it was.
      const enumTrack = enumTrackAfterWrite(prev.members, prev.enum, name, "part-select");
      const changedText = changedReadsText(memberReads(prev.members, prev.value, w.value), { name: prev.varName, value: w.value });
      return {
        ...prev,
        value: w.value,
        changed: w.changed,
        extendedFrom: undefined,
        droppedFrom: undefined,
        voided: prev.voided ?? "write",
        wrote: true,
        enum: enumTrack,
        // A statement's note describes the values it left, which this write has just changed.
        note: "",
        experiment: { source: "x", text: w.note },
        announcement: announcementOf(changedText, w.note),
      };
    });
  };

  /** The packed/unpacked what-if view keeps the members' values but drops the vector-level marks and note. */
  const togglePacked = () => {
    setPacked((p) => !p);
    setRun((prev) => ({ ...prev, changed: [], extendedFrom: undefined, droppedFrom: undefined, note: "", experiment: null, announcement: packed ? "Unpacked view: members by name, no bit numbering." : "Packed view: one vector." }));
  };

  /**
   * In the unpacked view a member write or an assignment pattern runs on its own.
   * It is outside the sequence, and it may put a gated statement's answer on the
   * strip, so it voids the predictions as any other free write does.
   */
  const runUnpacked = (s: StructStatement) => {
    setRun((prev) => {
      if (s.action.kind === "whole") return prev;
      const next = applyStructAction(prev.members, prev.value, s.action);
      const note =
        s.action.kind === "member"
          ? `${s.action.member} is written by name; the other members keep their values (§7.2).`
          : "An assignment pattern by member name writes every member (§10.9.2).";
      const changedText = changedReadsText(memberReads(prev.members, prev.value, next), { name: s.varName ?? preset.varName, value: next });
      return {
        ...prev,
        value: next,
        varName: s.varName ?? preset.varName,
        changed: [],
        extendedFrom: undefined,
        droppedFrom: undefined,
        voided: prev.voided ?? "write",
        wrote: true,
        enum: enumTrackAfterWrite(prev.members, prev.enum, s.action.kind === "member" ? s.action.member : null, "member-write"),
        note: "",
        experiment: { source: "unpacked", text: note },
        announcement: announcementOf(changedText, note),
      };
    });
  };

  // The editor's limit is the tool's, not the language's: 16 bits, or a preset member's own wider width (frame_t's 24-bit body), which it keeps after a shrink.
  const widthMax = (m: PackedMember): number => Math.max(MAX_MEMBER_WIDTH, m.width, preset.members.find((p) => p.id === m.id)?.width ?? 0);
  const wider = members.filter((m) => m.type.kind !== "enum" && widthMax(m) > MAX_MEMBER_WIDTH);
  const widthLimitsText = `Widths (${MIN_MEMBER_WIDTH} to ${MAX_MEMBER_WIDTH} bits${wider.map((m) => `; ${m.name} up to ${widthMax(m)}`).join("")})`;
  const fieldText = ranges.map((r) => `${r.name} ${rangeText(r)} = ${formatSizedHex(readMember(members, value, r.name))}`).join(", ");
  const memberText = ranges.map((r) => `${r.name} = ${formatSizedHex(readMember(members, value, r.name))}`).join(", ");
  const shownNote = run.experiment?.text ?? run.note;
  const noteText = shownNote ? ` ${shownNote}` : "";
  // An unpacked struct is not a vector: no literal for the whole, no bit ranges, no signing (§7.2.1) and no vector state-ness; $bits still counts its members (§20.6.2).
  const statusText = packed
    ? `${varName} = ${formatSizedHex(value)}; $bits(${preset.typeName}) = ${width}; ${states}-state, unsigned. ${rangesHidden ? memberText : fieldText}.${noteText}`
    : `${varName} is an unpacked struct: members are referenced by name and there is no bit numbering (§7.2.1); $bits(${preset.typeName}) = ${width} (§20.6.2). ${memberText}.${noteText}`;

  // 'dropped' is listed only when a struck-through cell exists: truncation discards source bits above the strip's MSB, which the note reports instead.
  const legend: BitLegendItem[] = ["changed", "extended", "dropped", "x"].filter((item) =>
    item === "changed" ? run.changed.length > 0 : item === "extended" ? run.extendedFrom !== undefined : item === "dropped" ? run.droppedFrom !== undefined && run.droppedFrom < width : hasX,
  ) as BitLegendItem[];

  const nextStatement = preset.statements[applied];
  const gated = Boolean(nextStatement?.prediction) && !run.voided;

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
        <StripPanel
          label={`Bits of ${varName}`}
          reveal={run.changed}
          footer={
            legend.length || rangesHidden ? (
              <>
                {legend.length ? <BitStripLegend items={legend} /> : null}
                {rangesHidden ? (
                  <p className="text-xs text-muted-foreground" data-testid="ranges-hidden">
                    The member bit ranges appear once you answer the question below.
                  </p>
                ) : null}
              </>
            ) : null
          }
        >
          <BitStrip
            bits={toBits(value)}
            label={`${varName}, ${preset.typeName}`}
            segments={segments}
            bitNumbers
            changed={run.changed}
            extendedFrom={run.extendedFrom}
            droppedFrom={run.droppedFrom}
          />
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

      <section aria-label="Statements" className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Statements</p>
        {/* Hidden, not unmounted, in the unpacked view: an unmounted prompt would come back unanswered for a statement that has already run. */}
        <ol ref={statementsRef} className="space-y-2" hidden={!packed}>
          {preset.statements.map((s, i) => {
            const done = i < applied;
            const current = i === applied;
            return (
              <li key={s.code} data-statement={i} tabIndex={-1} className={cn("rounded-lg border p-3", statementItemFocus, feedbackFocusRing, done ? "border-emerald-500/40 bg-emerald-500/[0.04]" : current ? "border-amber-500/40" : "border-dashed border-border/60 opacity-60")}>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span aria-hidden className="text-xs text-muted-foreground">
                    {i + 1}.
                  </span>
                  <code className={codeChip}>{s.code}</code>
                  {done ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">run</span> : null}
                </p>
                {done && i === applied - 1 && run.note ? <p className="mt-1 text-xs text-muted-foreground">{run.note}</p> : null}
                {current && !gated ? (
                  <button type="button" onClick={() => applyStatement(i)} className={cn(primaryButton, "mt-2")} data-testid="run-statement" data-run-statement>
                    Run it
                  </button>
                ) : null}
                {/* The prompt stays mounted for the statement it just ran, so its feedback remains readable; `gen` remounts it re-armed on a reset. */}
                {s.prediction && !run.voided && (current || i === applied - 1) ? (
                  <PredictionPrompt key={`${preset.id}-${gen}-${i}`} question={s.prediction.question} options={toOptions(s.prediction.options)} resetKey={`${preset.id}-${gen}-${i}`} className="mt-2">
                    <OnReveal onReveal={() => applyStatement(i)} />
                    <p className="text-sm text-muted-foreground">
                      The strip above now shows <code className={codeChip}>{varName} = {formatSizedHex(value)}</code>.
                    </p>
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
        {!packed && run.experiment?.source === "unpacked" ? (
          <p data-testid="experiment-note" className="text-xs text-muted-foreground">
            {run.experiment.text}
          </p>
        ) : null}
        {!packed ? (
          <p className="text-xs text-muted-foreground">
            Unpacked view: whole-vector statements do not compile and member writes run on their own.{" "}
            {run.voided ? "A write outside the sequence turned the predictions off, so statements run directly when you switch back." : "The predictions, written for the packed layout, wait until you switch back."}
          </p>
        ) : null}
        {packed && run.voided && preset.statements.some((s) => s.prediction) ? (
          <p className="text-xs text-muted-foreground" data-testid="predictions-voided">
            {run.voided === "layout" ? "Layout edited: the predictions were written for the preset layout, so statements now run directly." : "You wrote outside the sequence: the predictions were written for the values the statements leave, so statements now run directly."}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => choosePreset(preset.id)} className={secondaryButton}>
            Reset preset
          </button>
        </div>
        {/* Folded away: one stray press would end the predictions, so an experiment has to be asked for. */}
        {packed ? (
          <details className="rounded-lg border border-border/70 p-3" data-testid="x-experiments">
            <summary className="cursor-pointer text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Experiment: write an x into a member</summary>
            <p className="mt-2 text-xs text-muted-foreground">A write here is outside the sequence, so it turns the predictions off until you reset the preset.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {members.map((m) => {
                const offer = xWriteOffer(varName, members, m.name);
                // An enum member's x goes through a part-select, whose text names the range, so it waits for the ranges.
                if (offer.partSelect && rangesHidden) return null;
                return (
                  <button key={m.id} type="button" onClick={() => writeX(m.name)} className={secondaryButton} data-testid={`write-x-${m.id}`}>
                    {offer.partSelect ? <code className="font-mono [font-variant-ligatures:none]">{offer.label}</code> : offer.label}
                  </button>
                );
              })}
            </div>
          </details>
        ) : null}
        {packed && run.experiment?.source === "x" ? (
          <p data-testid="experiment-note" className="text-xs text-muted-foreground">
            {run.experiment.text}
          </p>
        ) : null}
      </section>

      {enumReadout ? (
        <div role="note" data-testid="enum-readout" className={cn("rounded-lg border p-3 text-sm", enumReadout.isMember ? "border-border/70" : "border-amber-500/60 bg-amber-500/[0.06]")}>
          <p>
            <code className={codeChip}>
              {varName}.{enumMember?.name}.name()
            </code>{" "}
            returns <code className={codeChip}>&quot;{enumReadout.name}&quot;</code>
            <span className="ml-2 text-xs text-muted-foreground">({enumReadout.citation})</span>
          </p>
          <p className="mt-1 text-muted-foreground">{enumReadout.note}</p>
        </div>
      ) : null}

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

      {/* A vector rule says little about a value nothing has written, so in the packed view the cards wait for the first write. */}
      {!packed || hasWrite ? (
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]" data-testid="struct-cards">
          {shownCards.map((c) => (
            <RuleCardView key={c.code} card={c} />
          ))}
        </div>
      ) : null}

      <details className="rounded-xl border border-border/70 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Edit the layout: member order and widths</summary>
        {/* The strip is out of sight from here, so this line follows the edits, under the site header. */}
        <p data-testid="layout-live" className="sticky top-16 z-10 mt-3 rounded-md border border-border/70 bg-background px-2 py-1 font-mono text-xs text-foreground [font-variant-ligatures:none]">
          {rangesHidden ? members.map((m) => `${m.name} (${m.width})`).join(" | ") : ranges.map((r) => `${r.name} ${rangeText(r)}`).join(" | ")}; $bits = {width}
        </p>
        {run.experiment?.source === "layout" ? (
          <p data-testid="experiment-note" className="mt-2 text-xs text-muted-foreground">
            {run.experiment.text}
          </p>
        ) : null}
        <div className="mt-3 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
          <ReorderList
            label={rangesHidden ? "Member order" : "Member order (first = most significant)"}
            items={members.map((m) => ({ id: m.id, label: m.name, description: `${memberTypeText(m)}, ${m.width} bit${m.width === 1 ? "" : "s"}` }))}
            order={members.map((m) => m.id)}
            onChange={(order) => editLayout(reorderMembers(members, order))}
            mono
          />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground" data-testid="width-limits">
              {widthLimitsText}
            </p>
            {members.map((m) => (
              <label key={m.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-mono [font-variant-ligatures:none]">{m.name}</span>
                <WidthInput
                  value={m.width}
                  min={MIN_MEMBER_WIDTH}
                  max={widthMax(m)}
                  disabled={m.type.kind === "enum"}
                  label={`Width of ${m.name} in bits`}
                  onCommit={(w) => editLayout(setMemberWidth(members, m.id, w, widthMax(m)))}
                />
              </label>
            ))}
            {enumMember ? <p className="text-xs text-muted-foreground">An enum member keeps the width of its base type.</p> : null}
            <p className="text-xs text-muted-foreground">{WIDTH_HINT}</p>
          </div>
        </div>
      </details>

      <StatusWithAnnouncement text={statusText} announcement={run.announcement} testId="struct-status" />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Union mode
// ---------------------------------------------------------------------------

const CELL = 16;
const NIBBLE = CELL * 4 + 3;
const NIBBLE_GAP = 4;

function UnionRowView({
  row,
  value,
  width,
  changed,
  unaffected,
  varName,
  positionHidden,
}: {
  row: UnionRow;
  value: SvValue;
  width: number;
  changed: readonly number[];
  unaffected: readonly number[];
  varName: string;
  /** While the first gated statement is open a narrower row, a field or a lane would answer it, so only whole-width rows are drawn, and those without their pieces. */
  positionHidden: boolean;
}) {
  // Above the strip and stuck to the panel's left edge, so the name stays readable while the bits scroll under it.
  const name = (
    <span className="sticky left-0 block w-fit font-mono text-xs text-muted-foreground [font-variant-ligatures:none]" style={{ paddingLeft: row.depth * 8 }}>
      {varName}.{row.path}
    </span>
  );
  if (positionHidden) {
    return (
      <div className="space-y-1" data-testid={`union-row-${row.path}`}>
        {name}
        {row.width === width ? (
          <div className="flex justify-end">
            <BitStrip bits={toBits(readUnionPiece(value, row))} label={`${varName}.${row.path}`} msbIndex={row.hi} bitNumbers changed={changed} />
          </div>
        ) : (
          <p className="sticky left-0 w-fit rounded-[3px] border border-dashed border-slate-400/60 px-2 py-1 text-xs text-muted-foreground">{row.width} bits: where they sit appears once you answer</p>
        )}
      </div>
    );
  }
  const missing = Math.ceil((width - row.width) / 4);
  const placeholderWidth = missing > 0 ? missing * NIBBLE + (missing - 1) * NIBBLE_GAP : 0;
  // Only the bits beyond the written member are unaffected (§7.3.1), so a narrower row may claim its whole gap only when every bit of the gap was left alone.
  const highlightsUnaffected = row.unaffectedAbove.length > 0 && row.unaffectedAbove.every((b) => unaffected.includes(b));
  return (
    <div className="space-y-1" data-testid={`union-row-${row.path}`}>
      {name}
      <div className="flex items-end justify-end gap-1">
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
        {/* Each piece is drawn as its member reads it, so a 2-state piece shows 0 where the 4-state union holds x, as the status line does (§7.3.1, §6.11.2). */}
        {row.pieces.map((p) => (
          <BitStrip
            key={p.path}
            bits={toBits(readUnionPiece(value, p))}
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
  /** About the statement that ran last; shown under it. */
  note: string;
  /** About a write through the free control; shown beside that control. */
  experiment: string;
  /** The live region's text: what the last action changed. */
  announcement: string;
}

const initialUnionRun = (u: UnionType, announcement = ""): UnionRunState => ({ value: unionInitialValue(u), applied: 0, changed: [], unaffected: [], note: "", experiment: "", announcement });

/** The preset's union with the chosen packing and the narrowing control's width. */
const unionVariant = (preset: UnionPreset, packing: UnionPacking, narrowWidth: number): UnionType => ({
  ...preset.union,
  packing,
  members: preset.union.members.map((m) => (m.id === preset.narrowMember ? { ...m, width: narrowWidth } : m)),
});

/** What a union write changed: every row that reads differently, or only the whole-width rows while positions are hidden. */
const unionChangedText = (u: UnionType, varName: string, before: SvValue, after: SvValue, positionHidden: boolean): string => {
  const width = unionWidth(u);
  const rows = unionRows(u).filter((r) => !positionHidden || r.width === width);
  return changedReadsText(
    rows.map((r) => ({ name: `${varName}.${r.path}`, before: readUnionPath(u, before, r.path), after: readUnionPath(u, after, r.path) })),
    { name: varName, value: after },
  );
};

function UnionMode({ preset: presetId }: { preset?: string }) {
  const [presetKey, setPresetKey] = useState(unionPreset(presetId).id);
  const preset: UnionPreset = unionPreset(presetKey);
  const [packing, setPacking] = useState<UnionPacking>(preset.union.packing);
  const narrowBase = preset.union.members.find((m) => m.id === preset.narrowMember)!;
  const [narrowWidth, setNarrowWidth] = useState(narrowBase.width);
  /** Set by a width edit or a free write, cleared by a reset: the predictions were written for the preset's widths and values, as in struct mode. */
  const [voided, setVoided] = useState<"width" | "write" | null>(null);
  const [run, setRun] = useState<UnionRunState>(() => initialUnionRun(preset.union));
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
    setVoided(null);
    setRun(initialUnionRun(p.union, "Reset: nothing has run yet."));
    setPath(p.statements[0]?.path ?? p.union.members[0].name);
    setHexInput("");
    setInputError("");
    setGen((g) => g + 1);
  };

  const union: UnionType = useMemo(() => unionVariant(preset, packing, narrowWidth), [preset, packing, narrowWidth]);
  const width = unionWidth(union);
  const states = unionStates(union);
  const value = rewidthVector(run.value, width, states);
  const rows = useMemo(() => unionRows(union), [union]);
  const problems = useMemo(() => unionProblems(union), [union]);
  const paths = rows.flatMap((r) => (r.pieces.length > 1 ? [r.path, ...r.pieces.map((p) => p.path)] : [r.path]));
  const pView = formatUnionP(union, value);
  // Unequal hard packed members do not compile (§7.3.1), so nothing can run until the declaration is legal again.
  const blocked = problems.length > 0;

  // Until the first gated statement is answered, a narrower row, a field or a lane would answer it, as the ranges would in struct mode.
  const firstGate = preset.statements.findIndex((st) => st.prediction);
  const positionHidden = firstGate >= 0 && run.applied <= firstGate && voided === null;

  const write = useCallback(
    (targetPath: string, src: SvValue) => {
      setRun((prev) => {
        const before = rewidthVector(prev.value, width, states);
        const w = writeUnionPath(union, before, targetPath, src);
        return { ...prev, value: w.value, changed: w.changed, unaffected: w.unaffected, note: "", experiment: w.note, announcement: announcementOf(unionChangedText(union, preset.varName, before, w.value, false), w.note) };
      });
    },
    [union, width, states, preset.varName],
  );

  const applyStatement = useCallback(
    (index: number) => {
      setRun((prev) => {
        if (prev.applied !== index) return prev;
        const s = preset.statements[index];
        if (!s) return prev;
        const before = rewidthVector(prev.value, width, states);
        const w = writeUnionPath(union, before, s.path, s.value);
        const stillHidden = firstGate >= 0 && index + 1 <= firstGate && voided === null;
        // A preset's own note describes the preset's own run, so once a width edit or a free write has left it only the model's note is true, as in struct mode.
        const presetNote = voided ? "" : (s.note ?? "");
        const note = `${stillHidden ? w.openNote : w.note} ${presetNote}`.trim();
        return { value: w.value, applied: index + 1, changed: w.changed, unaffected: w.unaffected, note, experiment: "", announcement: announcementOf(unionChangedText(union, preset.varName, before, w.value, stillHidden), note) };
      });
    },
    [preset, union, width, states, firstGate, voided],
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
    setVoided((v) => v ?? "write");
    // The entry is a sized literal of one nibble per digit; the model's write resizes it to the member (§10.7) and says so in its note.
    write(path, svHex(digits.length * 4, digits));
  };

  /**
   * A declaration edit. The last write's note and marks describe the old
   * declaration, so they go, and the live region says what the edit did, since
   * the status line is not live. The value takes the new width for good: bits
   * cut off by a shrink do not come back when the width grows again (`rewidthVector`).
   */
  const announceDeclaration = (next: UnionType) => {
    const problem = unionProblems(next)[0];
    const text = problem ? problem.message : `${next.name} is now ${unionWidth(next)} bits, ${next.packing === "soft" ? "soft packed" : "hard packed"}.`;
    setRun((prev) => ({ ...prev, value: rewidthVector(prev.value, unionWidth(next), unionStates(next)), changed: [], unaffected: [], note: "", experiment: "", announcement: text }));
  };

  const choosePacking = (next: UnionPacking) => {
    setPacking(next);
    announceDeclaration(unionVariant(preset, next, narrowWidth));
  };

  const commitNarrowWidth = (w: number) => {
    setNarrowWidth(w);
    setVoided((v) => (v === "write" ? v : "width"));
    announceDeclaration(unionVariant(preset, packing, w));
  };

  const nextStatement = preset.statements[run.applied];
  const gated = Boolean(nextStatement?.prediction) && !voided;

  const rowText = positionHidden
    ? rows
        .filter((r) => r.width === width)
        .map((r) => `${preset.varName}.${r.path} = ${formatSizedHex(readUnionPath(union, value, r.path))}`)
        .join("; ")
    : rows.map((r) => `${preset.varName}.${r.path} ${rangeText(r)} = ${formatSizedHex(readUnionPath(union, value, r.path))}`).join("; ");
  const shownNote = run.experiment || run.note;
  // A declaration that does not compile has no width, state-ness or values to report.
  const statusText = blocked ? `${union.name} does not compile. ${problems[0].message}` : `${union.name} is ${width} bits, ${states}-state, ${packing === "soft" ? "soft packed" : "hard packed"}. ${rowText}.${shownNote ? ` ${shownNote}` : ""}`;

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
          onChange={choosePacking}
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
            onCommit={commitNarrowWidth}
          />
        </label>
        {blocked ? null : (
          <>
            <ValueChip name="width" value={width} />
            <ValueChip name="states" value={`${states}-state`} />
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{WIDTH_HINT}</p>

      {problems.length ? (
        <div className="space-y-2" data-testid="union-problems">
          {problems.map((p) => (
            <RuleCardView key={p.code} card={p} />
          ))}
        </div>
      ) : null}

      {/* §7.3.1 gives no layout to a hard packed union whose members differ in size, so while it does not compile no row claims bit positions, as the status, chips and %p panel already do. */}
      {blocked ? (
        <p data-testid="union-rows-blocked" className="rounded-xl border border-dashed border-border/80 p-3 text-sm text-muted-foreground">
          No rows to draw: this declaration does not compile, so its members have no bit positions (§7.3.1). The value is kept and the rows come back once the declaration is legal.
        </p>
      ) : (
        <StripPanel label={`Rows of ${preset.varName}`} reveal={run.changed} footer={run.changed.length ? <BitStripLegend items={["changed"]} /> : null}>
          <div className="space-y-3">
            {rows.map((r) => (
              <UnionRowView key={r.path} row={r} value={value} width={width} changed={run.changed} unaffected={run.unaffected} varName={preset.varName} positionHidden={positionHidden} />
            ))}
          </div>
        </StripPanel>
      )}

      <section aria-label="Statements" className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Statements</p>
        <ol ref={statementsRef} className="space-y-2">
          {preset.statements.map((s, i) => {
            const done = i < run.applied;
            const current = i === run.applied;
            return (
              <li key={s.code} data-statement={i} tabIndex={-1} className={cn("rounded-lg border p-3", statementItemFocus, feedbackFocusRing, done ? "border-emerald-500/40 bg-emerald-500/[0.04]" : current ? "border-amber-500/40" : "border-dashed border-border/60 opacity-60")}>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span aria-hidden className="text-xs text-muted-foreground">
                    {i + 1}.
                  </span>
                  <code className={codeChip}>{s.code}</code>
                  {done ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">run</span> : null}
                </p>
                {done && i === run.applied - 1 && run.note ? <p className="mt-1 text-xs text-muted-foreground">{run.note}</p> : null}
                {current && !gated && !blocked ? (
                  <button type="button" onClick={() => applyStatement(i)} className={cn(primaryButton, "mt-2")} data-testid="run-statement" data-run-statement>
                    Run it
                  </button>
                ) : null}
                {/* The prompt stays mounted for the statement it just ran, so its feedback remains readable; hidden, not unmounted, while the declaration does not compile, so its answer survives. */}
                {s.prediction && !voided && (current || i === run.applied - 1) ? (
                  <div hidden={blocked}>
                    <PredictionPrompt key={`${preset.id}-${gen}-${i}`} question={s.prediction.question} options={toOptions(s.prediction.options)} resetKey={`${preset.id}-${gen}-${i}`} className="mt-2">
                      <OnReveal onReveal={() => applyStatement(i)} />
                      <p className="text-sm text-muted-foreground">
                        The rows above now read the new bits: <code className={codeChip}>{formatSizedHex(value)}</code>.
                      </p>
                    </PredictionPrompt>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {blocked ? <p className="text-xs text-muted-foreground">This declaration does not compile, so nothing can run: make the widths equal, or switch to union soft.</p> : null}
        {voided && !blocked && preset.statements.some((s) => s.prediction) ? (
          <p className="text-xs text-muted-foreground" data-testid="predictions-voided">
            {voided === "width" ? "Width edited: the predictions were written for the preset widths, so statements now run directly." : "You wrote outside the sequence: the predictions were written for the values the statements leave, so statements now run directly."}
          </p>
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
        {run.experiment ? (
          <p data-testid="experiment-note" className="text-xs text-muted-foreground">
            {run.experiment}
          </p>
        ) : null}
      </section>

      {blocked ? null : (
        <div role="note" className="rounded-lg border border-border/70 p-3 text-sm" data-testid="union-p">
          <code className={codeChip}>$display(&quot;%p&quot;, {preset.varName});</code> under this reading prints <code className={codeChip}>{pView.text}</code>
          <p className="mt-1 text-muted-foreground">This is the first-declared-member reading of §21.2.1.6, here {pView.member}.</p>
          <WhyToolsDiffer>
            The aggregate paragraph of §21.2.1.6 says only the first declared element of a union is printed, but a packed union is a singular value (§6.4, §6.11.1). The subclause&apos;s last paragraph says that %p of a singular expression formats it as an element of an aggregate, and
            the rules for elements end with: all other singular data types print their values as they would unformatted. Tools can therefore print this pattern or the union&apos;s plain decimal value, here <code className={codeChip}>{pView.unformatted}</code> (an unformatted value prints
            in decimal, §21.2.1.1), so packed-union %p output is tool-dependent. Print the member you need, or the raw view with %h.
          </WhyToolsDiffer>
        </div>
      )}

      <StatusWithAnnouncement text={statusText} announcement={run.announcement} testId="union-status" />
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
  const readPromptRef = useRef<HTMLDivElement>(null);

  const type: TaggedUnionType = useMemo(() => ({ ...VINT, members: third ? [...VINT.members, VINT_THIRD_MEMBER] : VINT.members }), [third]);
  const tagName = v.tagIndex === null ? null : type.members[v.tagIndex].name;
  const layout = taggedPackedLayout(type);
  const picture = useMemo(() => taggedPackedBits(type, v), [type, v]);
  const read = pendingRead ? readTagged(type, v, pendingRead) : null;
  const readPrediction = pendingRead ? TAGGED_READ_PREDICTION(`v.${pendingRead}`, tagName) : null;

  // The read button stays where it is and the question mounts further down, so focus goes to the question's first answer.
  useEffect(() => {
    if (readCount > 0) readPromptRef.current?.querySelector<HTMLElement>('input[type="radio"]')?.focus();
  }, [readCount]);

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
  const layoutText = packed ? picture.note : `If declared packed, the tag would be ${layout.tagBits} bit${layout.tagBits === 1 ? "" : "s"} (§7.3.2); an unpacked tagged union has no required representation (§7.3).`;
  const pReading = taggedPReading(type, v, packed);
  const statusText = `v: tag ${tagName ?? "undefined"}, value ${valueText}. ${layoutText}${pShown ? ` ${pReading.sentence}` : ""}`;

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

      <div className="flex flex-wrap items-start gap-2">
        <ValueChip name="tag" value={tagName ?? "undefined"} changed={false} />
        <span data-testid="tagged-value" className="inline-flex items-center gap-1.5 rounded-md border border-indigo-400/60 bg-indigo-500/10 px-2 py-0.5 font-mono text-sm text-indigo-800 dark:text-indigo-100">
          <span className="text-xs opacity-90">value</span>
          <span className="font-semibold">{valueText}</span>
        </span>
        {pShown ? (
          <div data-testid="tagged-p" className="min-w-0 text-sm">
            {pReading.text === null ? (
              <>
                <code className={codeChip}>%p</code> output is not defined: the variable was never assigned, so its value, tag bits included, is undefined <span className="text-xs text-muted-foreground">({pReading.citation})</span>
              </>
            ) : (
              <>
                <code className={codeChip}>%p</code> prints <code className={codeChip}>{pReading.text}</code> <span className="text-xs text-muted-foreground">({pReading.citation})</span>
              </>
            )}
            {pReading.basis === "tool-dependent" ? (
              <WhyToolsDiffer>
                The standard states tag:value in its paragraph on aggregates, but a packed tagged union is singular (§6.4, §6.11.1). %p of a singular expression formats it as an element of an aggregate (the last paragraph of §21.2.1.6), and its list for singular values sends every type it
                does not name, packed unions included, to their unformatted value. The two readings differ, so its %p output is tool-dependent. Print the member you need by name.
              </WhyToolsDiffer>
            ) : null}
          </div>
        ) : null}
      </div>

      {readPrediction ? (
        <div ref={readPromptRef}>
          <PredictionPrompt key={readCount} question={readPrediction.question} options={toOptions(readPrediction.options)} resetKey={String(readCount)}>
            {({ committed }) => {
              const chosen = readPrediction.options.find((o) => o.id === committed);
              return (
                <>
                  <OnReveal onReveal={() => readResultRef.current?.focus()} />
                  {read ? (
                    <p ref={readResultRef} tabIndex={-1} data-testid="tagged-read-result" className={cn("text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", read.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                      {/* Focus lands here, past the prompt's feedback, so the verdict on the prediction travels with the result. */}
                      {chosen ? <span className="sr-only">{chosen.correct ? "Your prediction was right. " : "Your prediction was wrong. "}</span> : null}
                      <span aria-hidden>{read.ok ? "✓ " : "✕ "}</span>
                      {/* The statement is %0d, so the printed text is decimal (Table 21-1, §21.2.1.1) at minimum width (§21.2.1.2); the value chip above keeps the sized hex. */}
                      {/* A void member has no read button, and readTagged reports a void read as not stated, so an ok read always has a value. */}
                      {read.ok ? `$display prints ${formatD(read.value)}. ${read.note}` : read.error}
                    </p>
                  ) : null}
                </>
              );
            }}
          </PredictionPrompt>
        </div>
      ) : null}

      {packed ? (
        <StripPanel
          label="Packed bits of v"
          footer={
            <>
              <BitStripLegend items={["undefined"]} />
              <p className="text-sm text-muted-foreground" data-testid="tagged-layout-note">
                {layout.width} bits: tag {rangeText({ hi: layout.tagHi, lo: layout.tagLo })} ({layout.tagBits} bit{layout.tagBits === 1 ? "" : "s"} for {type.members.length} members). {picture.note}
              </p>
            </>
          }
        >
          <BitStrip bits={picture.bits} label={`v, ${type.name} packed`} bitNumbers segments={picture.segments} undefinedBits={picture.undefinedBits} />
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
  const selectedExpr = board.baseline.checks.find((c) => c.id === selected.row)?.expr ?? "";

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

      <details className="rounded-lg border border-border/70 p-3 text-sm" data-testid="mutation-checks">
        <summary className="cursor-pointer font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">What each check tests</summary>
        <ul className="mt-2 space-y-1">
          {board.baseline.checks.map((c) => (
            <li key={c.id}>
              <span className="text-foreground">{c.label}</span>: <code className={codeChip}>{c.expr}</code>
            </li>
          ))}
        </ul>
      </details>

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
            {selectedCheck.label} (<code className={codeChip}>{selectedExpr}</code>) against {selectedMutation.label}: {selectedCell.summary}.{" "}
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
  /** Latched by the first suspect pick: every line invites a click, and reading another one must not take away the fix section or the rerun. */
  const [suspectFound, setSuspectFound] = useState(false);
  const [fix, setFix] = useState<FixId | null>(null);
  const [rerun, setRerun] = useState<{ fix: FixId; result: ClinicRun } | null>(null);
  /** Bumped on every scenario choice and reset, so the prompt and the hints remount re-armed. */
  const [gen, setGen] = useState(0);
  const causePromptRef = useRef<HTMLDivElement>(null);
  const suspectLineRef = useRef<HTMLButtonElement>(null);

  const choose = (id: string) => {
    setGen((g) => g + 1);
    setScenarioKey(clinicScenario(id).id);
    setCauseRevealed(false);
    setPicked(null);
    setSuspectShown(false);
    setSuspectFound(false);
    setFix(null);
    setRerun(null);
  };

  const asFound = useMemo(() => scenario.run(null), [scenario]);
  const isSuspectLine = (key: string | null) => key !== null && scenario.suspectKeys.includes(key);
  const found = suspectFound || suspectShown;
  // The learner who asks to be shown still gets the reason, until they pick a line themselves.
  const feedbackLine = scenario.lines.find((l) => l.key === picked) ?? (suspectShown ? scenario.lines.find((l) => l.key === scenario.suspectKeys[0]) : undefined);
  const onCauseReveal = useCallback(() => setCauseRevealed(true), []);

  // The control pressed unmounts in each of these steps. The cause's feedback comes first, because the diagnosis is the point; Tab goes on to the lines.
  useEffect(() => {
    if (causeRevealed) focusPromptFeedback(causePromptRef.current);
  }, [causeRevealed]);
  useEffect(() => {
    if (suspectShown) suspectLineRef.current?.focus();
  }, [suspectShown]);

  const verdict = rerun
    ? rerun.result.fixed
      ? `Fixed. ${scenario.fixFeedback[rerun.fix]}`
      : `${rerun.result.moved ? "The symptom moved." : "The symptom is still there."} ${scenario.fixFeedback[rerun.fix]}`
    : "";

  return (
    <VisualFrame
      label="Struct and enum debugging clinic"
      eyebrow="Debug it"
      title={scenario.title}
      summary={scenario.symptom}
      fidelity="model"
      assumptions={[
        ...PACKED_LAYOUT_ASSUMPTIONS,
        "Logs are regenerated by the model for the declaration you choose, so a fix that does not touch the cause keeps the symptom.",
        `In a log, a line that starts with ${CLINIC_NOTE_PREFIX.trim()} is the model's note, not simulator output, and compile or run lines summarise what the tool reports. $error prints a tool-specific message (§20.10), so a note gives only its text.`,
      ]}
    >
      <SegmentedControl label="Scenario" options={CLINIC_SCENARIOS.map((s) => ({ value: s.id, label: s.title }))} value={scenario.id} onChange={choose} />

      <CodeTrace label="Log, as found" lines={asFound.log.map((t, i) => ({ text: t, key: `a${i}` }))} />

      <div ref={causePromptRef} className={feedbackFocusRing}>
        <PredictionPrompt key={`${scenario.id}-${gen}`} question="What is the root cause?" options={toOptions(scenario.causes, "prose")} resetKey={`${scenario.id}-${gen}`}>
          <OnReveal onReveal={onCauseReveal} />
          <p className="text-sm text-muted-foreground">Now find the declaration that causes it.</p>
        </PredictionPrompt>
      </div>

      {causeRevealed ? (
        <section aria-label="Declarations" className="space-y-2" data-testid="clinic-lines">
          <h4 className="text-sm font-semibold text-foreground">Click the suspect declaration line</h4>
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
                    onClick={() => {
                      setPicked(l.key);
                      if (isSuspect) setSuspectFound(true);
                    }}
                    aria-pressed={isPicked}
                    aria-label={`Line ${i + 1}: ${l.text.trim()}${mark ? (isSuspect ? ", the suspect" : ", not the suspect") : ""}`}
                    className={cn(
                      "flex w-full items-start gap-2 border-l-2 px-2 py-1.5 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 motion-reduce:transition-none",
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
          {/* Always mounted, so a screen reader hears the explanation when a line is picked. */}
          <p role="status" aria-live="polite" data-testid="clinic-line-feedback" className={cn("text-sm", feedbackLine ? (isSuspectLine(feedbackLine.key) ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300") : "")}>
            {feedbackLine ? (
              <>
                <span aria-hidden>{isSuspectLine(feedbackLine.key) ? "✓ " : "✕ "}</span>
                {feedbackLine.whenPicked}
              </>
            ) : null}
          </p>
          {!found ? (
            <button
              type="button"
              onClick={() => {
                setPicked(null);
                setSuspectShown(true);
              }}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
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
