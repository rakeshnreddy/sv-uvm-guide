"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePrefersReducedMotion } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { comparisonStyles, valueStyles } from "@/components/visual-system/visual-language";
import {
  FORMAT_PRESETS,
  FORMAT_WIDTHS,
  RULE_NAME,
  SPACE_GLYPH,
  SPECIFIER_IDS,
  bitsText,
  findFormatPreset,
  formatWith,
  gradeGuess,
  literalText,
  nextBit,
  resizeBits,
  type FormatResult,
  type FourStateBit,
  type GuessGrade,
  type SpecifierId,
} from "@/lib/sv-format-model";
import {
  CASE_CHANGE,
  DEBUG_FIXES,
  DEBUG_SUSPECTS,
  DEFAULT_MONITOR_CONFIG,
  FILE_NAME,
  FINISH_TIME,
  FMONITOR_FLAG_READING,
  SECOND_CALL_TIMES,
  TOGGLE_TIMES,
  gradeFix,
  gradeSlot,
  lineLabel,
  monitorSource,
  runMonitor,
  slotOptions,
  type MonitorConfig,
  type MonitorRun,
  type PrintedLine,
  type SecondTask,
} from "@/lib/sv-monitor-model";
import { cn } from "@/lib/utils";

export type PrintingLabMode = "format" | "monitor";

export interface PrintingLabProps {
  mode?: PrintingLabMode;
  /**
   * format mode: "r1" (default), "10x1", "all-z" or "xz-digit".
   * monitor mode: omit for the lesson trace, or "replaced-list" for debug case 1.
   */
  preset?: string;
}

export const FORMAT_ASSUMPTIONS = [
  "Every printed string is computed by sv-format-model from IEEE 1800-2023 §21.2.1.2 (the field is sized to the largest value the expression can hold; decimal pads with spaces, the other radices keep leading zeros; %0 gives the minimum width) and §21.2.1.3 (the x and z table, 4-bit hex and 3-bit octal groups, %b prints each bit, decimal is right-justified in its field). The groups are counted from bit 0, as the §21.2.1.3 example xxXa (14 bits in hex) shows; the clause's text does not say so in words.",
  "The lab covers unsigned vectors only. How a signed value sizes its field, explicit field widths such as %3d, and %x are not shown here.",
  "Reading: §21.2.1.3 says a decimal value is right-justified in a fixed-width field, so the lab pads a decimal x, X, z or Z to the automatic width as it pads a number.",
];

export const MONITOR_ASSUMPTIONS = [
  "Every line is computed by sv-monitor-model from IEEE 1800-2023 §21.2.3 ($monitor: one active list, a display at the end of the time step in which a listed argument changed, $time, $stime and $realtime changes do not count, $monitoroff and $monitoron), §21.3.2 (any number of $fmonitor lists, with no $monitoron or $monitoroff counterpart) and §4.4.2.9 (the Postponed region).",
  "The first line a $monitor call prints in its own slot is not stated in the normative text of §21.2.3. The lab shows it because the §20.3.1 example output shows one ('0 set=x'), and labels it that way; $fmonitor is treated the same because §21.3.2 says it works just like $monitor.",
  "The standard does not say whether a $monitor call made while the monitor flag is off prints a first line; the lab marks that line as not defined.",
  "Added statements go only into slots with no assignment, so no order between statements of one slot is assumed. A value that changes and returns to its old value inside one slot is not modelled.",
  `Reading: ${FMONITOR_FLAG_READING}`,
];

const mono = "font-mono [font-variant-ligatures:none]";
/** Secondary button: raised surface, hairline border, primary text (DESIGN.md section 2). */
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
/** The one filled accent button of a view. */
const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const textButtonClass =
  "inline-flex min-h-10 items-center px-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** A selected item: raised surface with a 2 px accent marker on its leading edge (DESIGN.md section 2, rule 3). */
const selectedClass = "border-l-2 border-l-primary bg-muted";
const selectClass = "h-10 min-w-0 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const panel = "rounded-xl border border-border bg-card p-3";
const touchButtons = "[@media(pointer:coarse)]:[&_button]:min-h-10";
const frameClass = "[@media(pointer:coarse)]:[&_summary]:min-h-10";

/** The example control shows this once the learner edits the bits or the width. */
const CUSTOM = "custom";

function LiveAnnouncement({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only" data-testid="lab-live">
      {text}
    </p>
  );
}

function RevealHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h4 ref={ref} tabIndex={-1} data-testid="reveal-heading" className="text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </h4>
  );
}

/** correct: success box; wrong: danger box; partial: a neutral raised box with a half-filled glyph and no verdict word of its own. */
type VerdictTone = "correct" | "wrong" | "partial";

function Verdict({ correct, tone, children }: { correct: boolean; tone?: VerdictTone; children: React.ReactNode }) {
  const t: VerdictTone = tone ?? (correct ? "correct" : "wrong");
  return (
    <div
      data-tone={t}
      className={cn(
        "rounded-lg border p-3 text-sm text-foreground",
        t === "correct" ? "border-success/50 bg-success-subtle" : t === "wrong" ? "border-danger/50 bg-danger-subtle" : "border-border bg-muted",
      )}
    >
      <strong className={t === "correct" ? "text-success" : t === "wrong" ? "text-danger" : "text-foreground"}>
        <span aria-hidden>{t === "correct" ? "✓ " : t === "wrong" ? "✕ " : "◐ "}</span>
        {t === "correct" ? "Correct. " : t === "wrong" ? "Not quite. " : ""}
      </strong>
      {children}
    </div>
  );
}

const bitCue = (bit: FourStateBit) => (bit === "0" ? valueStyles.zero : bit === "1" ? valueStyles.one : bit === "x" ? valueStyles.unknown : valueStyles.highz);

// ---------------------------------------------------------------------------
// Format mode

/** "4 characters: 2 spaces, then 10". A screen reader does not speak a run of spaces, so they are counted. */
export function describeCells(text: string): string {
  if (text.length === 0) return "nothing";
  const parts = (text.match(/ +|[^ ]+/g) ?? []).map((p) => (p[0] === " " ? `${p.length} ${p.length === 1 ? "space" : "spaces"}` : p));
  return `${text.length} ${text.length === 1 ? "character" : "characters"}: ${parts.join(", then ")}`;
}

/** Character cells: one cell per printed character, a space drawn as ·. */
function CharCells({ text, grade, testId, label }: { text: string; grade?: GuessGrade; testId: string; label: string }) {
  const chars = text.split("");
  return (
    <div data-testid={testId}>
      <p className="sr-only">
        {label}: {describeCells(text)}.
      </p>
      <div aria-hidden className="flex flex-wrap gap-1">
        {chars.length === 0 ? <span className="text-sm text-muted-foreground">(empty)</span> : null}
        {chars.map((c, i) => {
          const cell = grade?.cells[grade.cells.length - chars.length + i];
          return (
            <span key={i} className="flex flex-col items-center">
              <span className={cn("flex h-9 w-7 items-center justify-center rounded border border-code-border bg-code-surface text-base text-code-foreground", mono, c === " " && "text-code-muted")}>
                {c === " " ? SPACE_GLYPH : c}
              </span>
              {cell ? (
                <span className={cn("text-xs", cell.match ? comparisonStyles.match.className : comparisonStyles.mismatch.className)}>
                  {cell.match ? comparisonStyles.match.glyph : comparisonStyles.mismatch.glyph}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The bit strip with each digit group's bracket and character under it. */
function GroupBrackets({ result }: { result: FormatResult }) {
  const w = result.width;
  const columns = { gridTemplateColumns: `repeat(${w}, minmax(0, 1fr))` };
  const describe = result.groups
    .map((g) => `bits ${g.hi === g.lo ? g.hi : `${g.hi} to ${g.lo}`} (${bitsText(g.bits)}) print ${g.char}, ${RULE_NAME[g.rule]}`)
    .join("; ");
  return (
    <figure className={cn(panel, "space-y-1")} data-testid="group-brackets">
      <figcaption className="text-label text-muted-foreground">
        {result.spec.radix === "d" ? "Decimal decides the whole value at once" : result.spec.radix === "b" ? "Binary prints each bit" : `Groups of ${result.spec.radix === "h" ? 4 : 3} bits, counted from bit 0`}
      </figcaption>
      <p className="sr-only">{describe}.</p>
      <div aria-hidden className="grid gap-1" style={{ ...columns, maxWidth: `${w * 2.75}rem` }}>
        {result.bits.map((b, i) => (
          <span key={`n${i}`} className="text-center text-xs tabular-nums text-muted-foreground">
            {w - 1 - i}
          </span>
        ))}
        {result.bits.map((b, i) => (
          <span key={`b${i}`} className={cn("flex h-8 items-center justify-center rounded border text-sm font-semibold", mono, bitCue(b).className)}>
            {b}
          </span>
        ))}
        {result.groups.map((g) => (
          <span
            key={`g${g.hi}`}
            className="flex min-w-0 flex-col items-center border-t-2 border-muted-foreground pt-1 text-center"
            style={{ gridColumn: `${w - g.hi} / span ${g.hi - g.lo + 1}` }}
          >
            <span className={cn("text-base font-semibold text-foreground", mono)}>{g.char}</span>
            {/* Binary groups are one bit wide: the single rule sentence covers them, so no per-bit label crowds the strip. */}
            {g.rule !== "known" && result.spec.radix !== "b" ? <span className="text-xs leading-4 text-muted-foreground">{RULE_NAME[g.rule]}</span> : null}
          </span>
        ))}
      </div>
    </figure>
  );
}

function FormatLab({ preset }: { preset?: string }) {
  const initial = findFormatPreset(preset);
  const [presetId, setPresetId] = useState(initial.id);
  const [bits, setBits] = useState<FourStateBit[]>(initial.bits);
  const [spec, setSpec] = useState<SpecifierId>(initial.specifier);
  const [guess, setGuess] = useState("");
  const [committed, setCommitted] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [said, setSaid] = useState("");
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusInput, setFocusInput] = useState(false);
  useEffect(() => {
    if (focusInput && committed === null && !skipped) {
      inputRef.current?.focus();
      setFocusInput(false);
    }
  }, [focusInput, committed, skipped]);

  const result = useMemo(() => formatWith(bits, spec), [bits, spec]);
  const grade = committed !== null ? gradeGuess(result, committed) : null;
  const revealed = committed !== null || skipped;
  const width = bits.length;

  const reset = () => {
    setGuess("");
    setCommitted(null);
    setSkipped(false);
    setSaid("");
  };
  const choosePreset = (id: string) => {
    if (id === CUSTOM) return;
    const p = findFormatPreset(id);
    setPresetId(p.id);
    setBits(p.bits);
    setSpec(p.specifier);
    reset();
  };
  const chooseWidth = (w: string) => {
    setBits((b) => resizeBits(b, Number(w)));
    setPresetId(CUSTOM);
    reset();
  };
  const toggleBit = (i: number) => {
    setBits((b) => b.map((x, k) => (k === i ? nextBit(x) : x)));
    setPresetId(CUSTOM);
    reset();
  };
  const check = () => {
    const g = gradeGuess(result, guess);
    setCommitted(guess);
    setSaid(`${g.correct ? "Correct." : "Not quite."} ${g.sentence}`);
  };
  const reveal = () => {
    setSkipped(true);
    setSaid(`Revealed. ${gradeGuess(result, result.text).sentence}`);
  };

  return (
    <VisualFrame
      label="Printing lab: how a number is sized and how x and z print"
      eyebrow="Experiment · predict, then check"
      title="What exactly does $display print?"
      summary="Choose a width, set each bit to 0, 1, x or z, and pick a format specifier. Type the exact text, spaces included, then check it against the rules of §21.2.1.2 and §21.2.1.3."
      fidelity="model"
      assumptions={FORMAT_ASSUMPTIONS}
      className={frameClass}
    >
      <div className={cn("space-y-3", touchButtons)}>
        <div className="space-y-1">
          <p className="text-label text-muted-foreground">Example</p>
          <SegmentedControl<string>
            label="Example"
            value={presetId}
            onChange={choosePreset}
            options={[
              ...FORMAT_PRESETS.map((p) => ({ value: p.id, label: p.label })),
              ...(presetId === CUSTOM ? [{ value: CUSTOM, label: "Your own value" }] : []),
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div className="space-y-1">
            <p className="text-label text-muted-foreground">Width</p>
            <SegmentedControl<string>
              label="Width"
              value={String(width)}
              onChange={chooseWidth}
              options={FORMAT_WIDTHS.map((w) => ({ value: String(w), label: `${w} bits` }))}
            />
          </div>
          <div className="space-y-1">
            <p className="text-label text-muted-foreground">Format specifier</p>
            <SegmentedControl<SpecifierId> label="Format specifier" mono value={spec} onChange={(s) => { setSpec(s); reset(); }} options={SPECIFIER_IDS.map((s) => ({ value: s, label: s }))} />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-label text-muted-foreground" id={`${inputId}-bits`}>
          Bits of v, most significant first. Press a bit to step it through 0, 1, x and z.
        </p>
        <div role="group" aria-labelledby={`${inputId}-bits`} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, maxWidth: `${width * 2.75}rem` }}>
          {bits.map((b, i) => (
            <span key={`n${i}`} aria-hidden className="text-center text-xs tabular-nums text-muted-foreground">
              {width - 1 - i}
            </span>
          ))}
          {bits.map((b, i) => (
            <button
              key={`b${i}`}
              type="button"
              onClick={() => toggleBit(i)}
              aria-label={`Bit ${width - 1 - i}: ${b}, ${bitCue(b).cue}`}
              className={cn("flex h-10 min-w-0 items-center justify-center rounded border text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mono, bitCue(b).className)}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <CodeTrace
        label="The statement"
        lines={[
          { key: "decl", text: `logic [${width - 1}:0] v = ${literalText(bits)};` },
          { key: "display", text: `$display("${spec}", v);` },
        ]}
      />

      <div className={cn(panel, "space-y-3")}>
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          Predict: type exactly what prints
        </label>
        <p id={hintId} className="text-xs text-muted-foreground">
          Type a space as a space or as {SPACE_GLYPH}. Each cell below is one printed character.
        </p>
        <input
          ref={inputRef}
          id={inputId}
          aria-describedby={hintId}
          value={guess}
          disabled={revealed}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && guess.length > 0 && !revealed) check();
          }}
          autoComplete="off"
          spellCheck={false}
          className={cn("h-10 w-full max-w-xs rounded-md border border-input bg-card px-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mono)}
        />
        <CharCells text={guess.split(SPACE_GLYPH).join(" ")} testId="guess-cells" label="Your prediction" />
        {!revealed ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={primaryButtonClass} disabled={guess.length === 0} onClick={check}>
              Check my prediction
            </button>
            <button type="button" className={textButtonClass} onClick={reveal}>
              Reveal without predicting
            </button>
          </div>
        ) : null}
      </div>

      <LiveAnnouncement text={said} />

      {revealed ? (
        <div className="space-y-3" data-testid="format-reveal">
          <RevealHeading>
            What <code className={mono}>{spec}</code> prints for {literalText(bits)}
          </RevealHeading>
          {grade ? <Verdict correct={grade.correct}>{grade.sentence}</Verdict> : <p className="text-sm text-foreground">{gradeGuess(result, result.text).sentence}</p>}
          <div className={cn(panel, "space-y-2")}>
            <p className="text-label text-muted-foreground">Printed text{grade ? ", with your cells marked" : ""}</p>
            <CharCells text={result.text} grade={grade ?? undefined} testId="answer-cells" label="Printed text" />
          </div>
          <GroupBrackets result={result} />
          <div className="space-y-1 text-sm">
            <p className="text-foreground" data-testid="width-sentence">
              <strong>Width: </strong>
              {result.widthSentence}
            </p>
            {result.ruleSentences.length ? (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground" data-testid="rule-sentences">
                {result.ruleSentences.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              reset();
              setFocusInput(true);
            }}
          >
            Try another prediction
          </button>
        </div>
      ) : null}
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Monitor mode: the timeline

const pct = (t: number) => `${(t / FINISH_TIME) * 100}%`;
const TICKS = [0, 10, 20, 30, 40, 50, 60];

const timingGlyph: Record<PrintedLine["timing"], { glyph: string; word: string }> = {
  postponed: { glyph: "P", word: "printed in the Postponed region" },
  immediate: { glyph: "now", word: "printed immediately by $monitoron" },
  "not-defined": { glyph: "?", word: "not defined by the standard" },
};

/**
 * Vertical level (0 upper, 1 lower) for each print marker of one row: a marker
 * less than 10 ns after the previous one drops to the other level, so close
 * markers such as "now" at 45 ns and "P" at 50 ns do not overlap on a phone.
 */
export function markerLevels(lines: readonly { time: number }[]): number[] {
  const levels: number[] = [];
  lines.forEach((l, i) => {
    const prev = i > 0 ? lines[i - 1] : null;
    levels.push(prev && l.time - prev.time < 10 ? 1 - levels[i - 1] : 0);
  });
  return levels;
}

/** Slot axis, lanes for a and b, and, after the reveal, the watch lists and print markers. */
function MonitorTimeline({ run, revealed }: { run: MonitorRun; revealed: boolean }) {
  const reduced = usePrefersReducedMotion();
  const lane = (signal: "a" | "b") =>
    run.slots
      .filter((s) => s.changes.some((c) => c.signal === signal))
      .map((s) => ({ time: s.time, values: s.changes.find((c) => c.signal === signal)?.values ?? [] }));
  const summary = [
    `a is written at ${lane("a").map((x) => `${x.time} ns (${x.values.join(" then ")})`).join(", ")}`,
    `b at ${lane("b").map((x) => `${x.time} ns (${x.values.join(" then ")})`).join(", ")}`,
    revealed ? `watch lists: ${run.bands.map((b) => `${b.label} from ${b.from} to ${b.to} ns`).join("; ")}` : "",
    revealed && run.offRanges.length ? `monitor flag off ${run.offRanges.map((r) => `from ${r.from} to ${r.to} ns`).join(", ")}` : "",
    revealed ? `lines print at ${run.log.map((l) => `${l.time} ns (${timingGlyph[l.timing].word})`).join(", ") || "no time"}` : "",
  ]
    .filter(Boolean)
    .join(". ");
  const rowLabel = "w-16 shrink-0 text-xs text-muted-foreground";
  const track = "relative h-9 flex-1";
  return (
    <figure className={cn(panel, "space-y-2")} data-testid="monitor-timeline">
      <figcaption className="text-label text-muted-foreground">The run, 0 to {FINISH_TIME} ns</figcaption>
      <p className="sr-only" data-testid="timeline-summary">
        {summary}.
      </p>
      <div aria-hidden className="space-y-1 pr-3">
        <div className="flex items-center gap-2">
          <span className={rowLabel}>time (ns)</span>
          <div className={cn(track, "h-5 border-b border-border")}>
            {TICKS.map((t) => (
              <span key={t} className="absolute top-0 -translate-x-1/2 text-xs tabular-nums text-muted-foreground" style={{ left: pct(t) }}>
                {t}
              </span>
            ))}
          </div>
        </div>
        {(["a", "b"] as const).map((signal) => (
          <div key={signal} className="flex items-center gap-2">
            <span className={cn(rowLabel, mono)}>{signal}</span>
            <div className={cn(track, "border-b border-dashed border-border")}>
              {lane(signal).map((x) => (
                <span
                  key={x.time}
                  className={cn("absolute top-1 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-muted px-1 text-xs text-foreground", mono)}
                  style={{ left: pct(x.time) }}
                >
                  {x.values.join("→")}
                </span>
              ))}
            </div>
          </div>
        ))}
        {revealed ? (
          <>
            {(["$monitor", "$fmonitor"] as const).map((task) => {
              const bands = run.bands.filter((b) => b.task === task);
              if (bands.length === 0) return null;
              return (
                <div key={task} className="flex items-center gap-2">
                  <span className={cn(rowLabel, mono)}>{task === "$fmonitor" ? FILE_NAME : "$monitor"}</span>
                  <div className={track}>
                    {bands.map((b) => (
                      <span
                        key={b.listId}
                        data-testid={`band-${b.listId}`}
                        className={cn(
                          "absolute top-1 flex h-7 items-center overflow-hidden rounded border bg-muted px-1 text-xs text-foreground",
                          b.listId === "list1" ? "border-solid border-muted-foreground" : "border-dashed border-muted-foreground",
                          !reduced && "transition-[left,width] duration-300 motion-reduce:transition-none",
                        )}
                        style={{ left: pct(b.from), width: pct(b.to - b.from) }}
                      >
                        <span className={cn("truncate", mono)}>{b.args}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            {run.offRanges.length ? (
              <div className="flex items-center gap-2">
                <span className={rowLabel}>$monitor flag</span>
                <div className={track}>
                  {run.offRanges.map((r) => (
                    <span key={r.from} className="absolute top-1 flex h-7 items-center overflow-hidden rounded border border-dotted border-muted-foreground bg-card px-1 text-xs text-muted-foreground" style={{ left: pct(r.from), width: pct(r.to - r.from) }}>
                      off
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="space-y-1" data-testid="print-markers">
              {(["stdout", "file"] as const).map((channel) => {
                const rowLines = run.log.filter((l) => l.channel === channel);
                if (channel === "file" && rowLines.length === 0) return null;
                const levels = markerLevels(rowLines);
                return (
                  <div key={channel} className="flex items-center gap-2" data-testid={`print-markers-${channel}`}>
                    <span className={cn(rowLabel, channel === "file" && mono)}>{channel === "file" ? FILE_NAME : "prints"}</span>
                    <div className={cn(track, "h-11")}>
                      {rowLines.map((l, i) => (
                        <span
                          key={`${l.time}-${l.listId}`}
                          className={cn(
                            "absolute -translate-x-1/2 rounded border bg-card px-1 text-xs font-medium text-foreground",
                            l.timing === "postponed" ? "border-dashed border-muted-foreground" : l.timing === "immediate" ? "border-solid border-foreground" : "border-dotted border-muted-foreground",
                            levels[i] === 1 ? "top-5" : "top-0",
                          )}
                          style={{ left: pct(l.time) }}
                        >
                          {timingGlyph[l.timing].glyph}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
      {revealed ? (
        <p className="text-xs text-muted-foreground">
          Key: P = printed at the end of the slot, in the Postponed region (§4.4.2.9, dashed); now = printed at once by $monitoron (solid); ? = not defined. Each band is a watch list and the arguments it watches: solid for the first call, dashed for the second.{run.log.some((l) => l.channel === "file") ? ` Markers on the prints row are standard output; markers on the row labelled ${FILE_NAME} are lines the $fmonitor list writes to the file.` : ""}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">The watch lists and the print markers appear after you check your predictions.</p>
      )}
    </figure>
  );
}

function LogPanel({ lines, label, testId }: { lines: PrintedLine[]; label: string; testId: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-code-border bg-code-surface text-code-foreground" data-testid={testId}>
      <figcaption className="border-b border-code-border px-3 py-2 text-label text-code-muted">{label}</figcaption>
      <pre className={cn("whitespace-pre-wrap break-words px-3 py-2 text-xs leading-5", mono)}>
        {lines.length ? lines.map((l) => (l.timing === "not-defined" ? `${l.text}   (not defined by the standard)` : l.text)).join("\n") : "(nothing printed)"}
      </pre>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Monitor mode: predictions per slot

const timeChoice = (t: number | null) => (t === null ? "none" : String(t));
const parseChoice = (v: string) => (v === "none" ? null : Number(v));

function MonitorControls({ config, onChange }: { config: MonitorConfig; onChange: (c: MonitorConfig) => void }) {
  const ids = { second: useId(), off: useId(), on: useId(), b: useId() };
  const taken = (except: keyof MonitorConfig) =>
    new Set(
      (["secondCallTime", "monitorOffTime", "monitorOnTime"] as const)
        .filter((k) => k !== except)
        .map((k) => config[k])
        .filter((t): t is number => t !== null),
    );
  const timeSelect = (id: string, label: string, key: "secondCallTime" | "monitorOffTime" | "monitorOnTime", times: readonly number[], none: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label text-muted-foreground">
        {label}
      </label>
      <select id={id} className={selectClass} value={timeChoice(config[key])} onChange={(e) => onChange({ ...config, [key]: parseChoice(e.target.value) })}>
        <option value="none">{none}</option>
        {times.map((t) => (
          <option key={t} value={String(t)} disabled={taken(key).has(t)}>
            at {t} ns
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <div className={cn(panel, "space-y-3")} role="group" aria-label="Change the bench">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        {timeSelect(ids.second, "Second call", "secondCallTime", SECOND_CALL_TIMES, "Deleted")}
        {timeSelect(ids.off, "$monitoroff", "monitorOffTime", TOGGLE_TIMES, "Not used")}
        {timeSelect(ids.on, "$monitoron", "monitorOnTime", TOGGLE_TIMES, "Not used")}
      </div>
      <div className={cn("flex flex-wrap items-end gap-x-6 gap-y-3", touchButtons)}>
        <div className="space-y-1">
          <p className="text-label text-muted-foreground">Second call uses</p>
          <SegmentedControl<SecondTask>
            label="Second call uses"
            mono
            value={config.secondTask}
            onChange={(t) => onChange({ ...config, secondTask: t })}
            options={[
              { value: "$monitor", label: "$monitor" },
              { value: "$fmonitor", label: "$fmonitor", disabled: config.secondCallTime === null },
            ]}
          />
        </div>
        <label htmlFor={ids.b} className="flex min-h-10 items-center gap-2 text-sm text-foreground">
          <input id={ids.b} type="checkbox" className="size-5 accent-primary" checked={config.firstListHasB} onChange={(e) => onChange({ ...config, firstListHasB: e.target.checked })} />
          Add b to the first list
        </label>
      </div>
    </div>
  );
}

function MonitorLab() {
  const [config, setConfig] = useState<MonitorConfig>(DEFAULT_MONITOR_CONFIG);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [said, setSaid] = useState("");
  const run = useMemo(() => runMonitor(config), [config]);
  const firstSelectRef = useRef<HTMLSelectElement>(null);
  const [focusFirst, setFocusFirst] = useState(false);
  useEffect(() => {
    if (focusFirst && !revealed) {
      firstSelectRef.current?.focus();
      setFocusFirst(false);
    }
  }, [focusFirst, revealed]);
  const times = run.slots.map((s) => s.time);
  const allChosen = times.every((t) => choices[t] !== undefined);
  const grades = times.map((t) => gradeSlot(run, t, choices[t] ?? null));
  const score = grades.filter((g) => g.correct).length;

  const change = (c: MonitorConfig) => {
    setConfig(c.secondCallTime === null && c.secondTask === "$fmonitor" ? { ...c, secondTask: "$monitor" } : c);
    setChoices({});
    setRevealed(false);
    setChecked(false);
    setSaid("");
  };
  const check = () => {
    setRevealed(true);
    setChecked(true);
    setSaid(`You predicted ${score} of ${times.length} slots. ${grades.filter((g) => !g.correct).map((g) => `${g.time} ns: ${g.answerLabel}.`).join(" ")}`);
  };
  const reveal = () => {
    setRevealed(true);
    setChecked(false);
    setSaid(`Revealed. ${run.log.map((l) => `${l.time} ns: ${lineLabel(l)}`).join(". ")}.`);
  };

  return (
    <VisualFrame
      label="Printing lab: when $monitor prints"
      eyebrow="Experiment · predict each slot"
      title="When does $monitor print?"
      summary="One $monitor list is active at a time. Predict what each time slot prints, then check. Change the bench and predict again."
      fidelity="model"
      assumptions={MONITOR_ASSUMPTIONS}
      className={frameClass}
    >
      <MonitorControls config={config} onChange={change} />
      <CodeTrace label="tb_top" lines={run.source.map((l) => ({ key: l.key, text: l.text }))} />
      <MonitorTimeline run={run} revealed={revealed} />

      <div className={cn(panel, "space-y-3")}>
        <p className="text-sm font-medium text-foreground">Predict: what does each slot print?</p>
        <ol className="space-y-3" aria-label="Time slots">
          {run.slots.map((s, i) => {
            const id = `slot-${s.time}`;
            const options = slotOptions(run, s.time);
            const g = grades[i];
            return (
              <li key={s.time} className="space-y-1 border-t border-border pt-3 first:border-t-0 first:pt-0" data-testid={id}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <label htmlFor={id} className="w-14 text-sm font-semibold tabular-nums text-foreground">
                    {s.time} ns
                  </label>
                  <code className={cn("min-w-0 flex-1 break-words rounded bg-code-surface px-2 py-1 text-xs text-code-foreground", mono)}>{s.statements.join(" ")}</code>
                </div>
                <select
                  ref={i === 0 ? firstSelectRef : undefined}
                  id={id}
                  aria-label={`Prediction for ${s.time} ns`}
                  className={cn(selectClass, "w-full", mono)}
                  value={choices[s.time] ?? ""}
                  disabled={revealed}
                  onChange={(e) => setChoices((c) => ({ ...c, [s.time]: e.target.value }))}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {revealed ? (
                  <div className="space-y-1 text-sm" data-testid={`${id}-reveal`}>
                    <p className="text-foreground">
                      {checked ? (
                        <span className={g.correct ? comparisonStyles.match.className : comparisonStyles.mismatch.className}>
                          <span aria-hidden>{g.correct ? comparisonStyles.match.glyph : comparisonStyles.mismatch.glyph} </span>
                          {g.correct ? "Right: " : "Answer: "}
                        </span>
                      ) : (
                        <span className="font-medium">Answer: </span>
                      )}
                      <span className={mono}>{g.answerLabel}</span>
                    </p>
                    <p className="text-muted-foreground">{g.sentence}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {!revealed ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={primaryButtonClass} disabled={!allChosen} onClick={check}>
              Check my predictions
            </button>
            <button type="button" className={textButtonClass} onClick={reveal}>
              Reveal without predicting
            </button>
            {!allChosen ? <span className="text-xs text-muted-foreground">Choose an answer for every slot to check.</span> : null}
          </div>
        ) : null}
      </div>

      <LiveAnnouncement text={said} />

      {revealed ? (
        <div className="space-y-3" data-testid="monitor-reveal">
          <RevealHeading>{checked ? `You predicted ${score} of ${times.length} slots` : "What the run prints"}</RevealHeading>
          <LogPanel lines={run.log.filter((l) => l.channel === "stdout")} label="Standard output" testId="log-stdout" />
          {run.log.some((l) => l.channel === "file") ? <LogPanel lines={run.log.filter((l) => l.channel === "file")} label={FILE_NAME} testId="log-file" /> : null}
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              change(config);
              setFocusFirst(true);
            }}
          >
            Predict again
          </button>
        </div>
      ) : null}
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Monitor mode: debug case 1

function MonitorDebug() {
  const source = useMemo(() => monitorSource(DEFAULT_MONITOR_CONFIG), []);
  const run = useMemo(() => runMonitor(DEFAULT_MONITOR_CONFIG), []);
  const [suspectKey, setSuspectKey] = useState<string | null>(null);
  const [huntDone, setHuntDone] = useState(false);
  const [fixId, setFixId] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const firstCall = source.find((l) => l.key === "first-call")?.text.trim() ?? "";
  const suspect = DEBUG_SUSPECTS.find((s) => s.sourceKey === suspectKey);
  const fix = fixId ? gradeFix(DEBUG_FIXES.find((f) => f.id === fixId) as (typeof DEBUG_FIXES)[number]) : null;
  const verdictWord = { fixed: "Fixes it.", partial: "Partly fixes it.", "not-fixed": "Does not fix it." } as const;

  const choose = (key: string) => {
    const s = DEBUG_SUSPECTS.find((x) => x.sourceKey === key);
    if (!s) return;
    setSuspectKey(key);
    setSaid(`${s.verdict === "culprit" ? "Found it." : "Not this line."} ${s.feedback}`);
    if (s.verdict === "culprit") setHuntDone(true);
  };
  const chooseFix = (id: string) => {
    setFixId(id);
    const g = gradeFix(DEBUG_FIXES.find((f) => f.id === id) as (typeof DEBUG_FIXES)[number]);
    setSaid(`${verdictWord[g.verdict]} ${g.sentence}${g.gapNote ? ` ${g.gapNote}` : ""}`);
  };
  const startOver = () => {
    setSuspectKey(null);
    setHuntDone(false);
    setFixId(null);
    setSaid("");
  };

  return (
    <VisualFrame
      label="Printing lab: the signal that went quiet"
      eyebrow="Debug it · find the line, then fix it"
      title="The signal that went quiet"
      summary={
        <>
          The bench calls <code className={mono}>{firstCall}</code> at 0 ns. a also changed at {CASE_CHANGE.time} ns (a={CASE_CHANGE.value}), but the log never shows it. Find the line responsible, then choose a fix: the model reruns the bench. In the lesson, the second call comes from another process; here every statement sits in one initial block, and the behaviour is the same.
        </>
      }
      fidelity="model"
      assumptions={MONITOR_ASSUMPTIONS}
      className={frameClass}
    >
      <LogPanel lines={run.log} label="The log" testId="log-symptom" />
      <CodeTrace label="tb_top" lines={source.map((l) => ({ key: l.key, text: l.text }))} activeKey={huntDone ? "second-call" : undefined} />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Which line stops a from printing?</p>
        <ul className="space-y-2" aria-label="Suspect lines">
          {DEBUG_SUSPECTS.map((s) => {
            const line = source.find((l) => l.key === s.sourceKey);
            const pressed = suspectKey === s.sourceKey;
            return (
              <li key={s.sourceKey}>
                <button
                  type="button"
                  aria-pressed={pressed}
                  aria-label={`Suspect line: ${line?.text.trim()}`}
                  onClick={() => choose(s.sourceKey)}
                  className={cn(buttonClass, "w-full justify-start", pressed && selectedClass)}
                >
                  <code className={cn("block break-words text-xs", mono)}>{line?.text.trim()}</code>
                </button>
              </li>
            );
          })}
        </ul>
        {suspect ? (
          <div data-testid="suspect-verdict">
            <Verdict correct={suspect.verdict === "culprit"}>{suspect.feedback}</Verdict>
          </div>
        ) : null}
        {!huntDone ? (
          <button type="button" className={textButtonClass} onClick={() => setHuntDone(true)}>
            Skip to the fixes
          </button>
        ) : null}
      </div>

      <LiveAnnouncement text={said} />

      {huntDone ? (
        <div className="space-y-3" data-testid="debug-fixes">
          <RevealHeading>Choose a fix. The model reruns the bench.</RevealHeading>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]" role="group" aria-label="Fixes">
            {DEBUG_FIXES.map((f) => (
              <button key={f.id} type="button" aria-pressed={fixId === f.id} onClick={() => chooseFix(f.id)} className={cn(buttonClass, "justify-start", fixId === f.id && selectedClass)}>
                {f.label}
              </button>
            ))}
          </div>
          {fix ? (
            <div className="space-y-3" data-testid="fix-verdict">
              <Verdict correct={fix.verdict === "fixed"} tone={fix.verdict === "fixed" ? "correct" : fix.verdict === "partial" ? "partial" : "wrong"}>
                <strong>{verdictWord[fix.verdict]} </strong>
                {fix.sentence}
              </Verdict>
              {fix.gapNote ? (
                <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground" data-testid="fix-gap-note">
                  <span className="font-medium text-foreground">Not part of this bug: </span>
                  {fix.gapNote}
                </p>
              ) : null}
              <MonitorTimeline run={fix.run} revealed />
              <LogPanel lines={fix.run.log.filter((l) => l.channel === "stdout")} label="Standard output after the fix" testId="fix-log" />
              {fix.run.log.some((l) => l.channel === "file") ? <LogPanel lines={fix.run.log.filter((l) => l.channel === "file")} label={`${FILE_NAME} after the fix`} testId="fix-log-file" /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div>
        <button type="button" className={buttonClass} onClick={startOver}>
          Start over
        </button>
      </div>
    </VisualFrame>
  );
}

export default function PrintingLab({ mode = "format", preset }: PrintingLabProps) {
  if (mode === "monitor") return preset === "replaced-list" ? <MonitorDebug /> : <MonitorLab />;
  return <FormatLab preset={preset} />;
}
