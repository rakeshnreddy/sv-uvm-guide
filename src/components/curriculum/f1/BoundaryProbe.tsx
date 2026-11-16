"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { FigureDepthDefs, depthFill, glowFilter, levelFill, rimStroke, shadowFilter } from "@/components/visual-system/figure-depth";
import { comparisonStyles, valueStyles } from "@/components/visual-system/visual-language";
import {
  BOUNDARY_PROBE_ASSUMPTIONS,
  LENS_VALUES,
  MAX_VALUES,
  PRESETS,
  SPEC_LINE,
  TEMP_MAX,
  TEMP_MIN,
  THRESHOLD,
  axisFraction,
  bandSentence,
  bandTickLabel,
  check,
  countOptions,
  disagreementBand,
  markerLayout,
  nextStep,
  normalizeValues,
  parseTemp,
  presetById,
  rtlLine,
  rtlOperator,
  runChecks,
  xNote,
  type Bit4,
  type NextStep,
  type PresetId,
  type RunResult,
} from "@/lib/boundary-probe-model";
import { cn } from "@/lib/utils";

export interface BoundaryProbeProps {
  /** The test values it opens with: "typical" (50, 150) or "boundary" (99, 100, 101, the lesson's test). */
  preset?: PresetId;
  /** Open with the RTL already fixed (>=). */
  fixed?: boolean;
}

type ValueSet = PresetId | "custom";

const mono = "font-mono [font-variant-ligatures:none] tabular-nums";
const panel = "rounded-xl border border-border bg-card p-3";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const inputClass =
  "h-10 w-24 min-w-0 rounded-md border border-input bg-card px-2 font-mono text-sm text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** The shared segmented control is 36 px tall: lift it to 40 px on touch screens from here. */
const touchButtons = "[@media(pointer:coarse)]:[&_button]:min-h-10";
/** The frame's assumptions disclosure: a 40 px target on touch screens. The frame is a figure panel (DESIGN.md section 14): the tier field behind it. */
const frameClass = "fig-panel [@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3";

const bitClass = (b: Bit4) => (b === 1 ? valueStyles.one.className : b === 0 ? valueStyles.zero.className : valueStyles.unknown.className);

/*
 * Depth for the HTML parts of the drawing (DESIGN.md section 14), from the figure tokens only. A part is an opaque
 * card base under a gradient in its own body hue (lighter at the top in both modes), a lit top rim and a soft shadow.
 * At rest a part keeps 40% of its hue; the focal or state part takes it whole and sits higher. Forced colours drop
 * the gradients and shadows, and the part's own border, text and glyph carry the meaning; print drops the glows.
 */
const restBody = {
  zero: "bg-card bg-[linear-gradient(180deg,hsl(var(--fig-slate-body)/calc(var(--fig-obj-top)*0.4)),hsl(var(--fig-slate-body)/calc(var(--fig-obj-bottom)*0.4)))]",
  one: "bg-card bg-[linear-gradient(180deg,hsl(var(--fig-cyan-body)/calc(var(--fig-obj-top)*0.4)),hsl(var(--fig-cyan-body)/calc(var(--fig-obj-bottom)*0.4)))]",
  match: "bg-card bg-[linear-gradient(180deg,hsl(var(--fig-emerald-body)/calc(var(--fig-obj-top)*0.4)),hsl(var(--fig-emerald-body)/calc(var(--fig-obj-bottom)*0.4)))]",
};
const fullBody = {
  zero: "bg-card bg-[linear-gradient(180deg,hsl(var(--fig-slate-body)/var(--fig-obj-top)),hsl(var(--fig-slate-body)/var(--fig-obj-bottom)))]",
  one: "bg-card bg-[linear-gradient(180deg,hsl(var(--fig-cyan-body)/var(--fig-obj-top)),hsl(var(--fig-cyan-body)/var(--fig-obj-bottom)))]",
  mismatch: "bg-card bg-[linear-gradient(180deg,hsl(var(--fig-rose-body)/var(--fig-obj-top)),hsl(var(--fig-rose-body)/var(--fig-obj-bottom)))]",
};
/** Resting on the panel: the lit rim and a 3 px shadow. */
const objectRest = "shadow-[inset_0_1px_0_hsl(var(--fig-obj-highlight)),0_3px_5px_-2px_hsl(var(--fig-obj-shadow))]";
/** Raised and lit (the focal or state part): the rim, a 7 px shadow and a glow in the state's hue. Print keeps only the rim. */
const objectRaisedRose =
  "relative z-[1] shadow-[inset_0_1px_0_hsl(var(--fig-obj-highlight)),0_7px_10px_-4px_hsl(var(--fig-obj-shadow)),0_0_14px_hsl(var(--fig-rose)/var(--fig-glow))] print:shadow-[inset_0_1px_0_hsl(var(--fig-obj-highlight))]";
/**
 * A bit of the close-up read as a one-bit trace: a 1 carries the high level along its top edge (cyan), a 0 the low
 * level along its bottom edge (slate), so each row reads low, then a rising edge, then high, and the two edges sit
 * one cell apart. Only the cells of the disagreement band glow (rose) and sit raised: one focal part. In forced
 * colours, where shadows and rings drop, those cells keep a Highlight outline. Written out in full for Tailwind.
 */
const levelShadow = (b: Bit4, raised: boolean) =>
  b === 1
    ? raised
      ? "shadow-[inset_0_2px_0_hsl(var(--fig-cyan)),0_7px_10px_-4px_hsl(var(--fig-obj-shadow)),0_0_14px_hsl(var(--fig-rose)/var(--fig-glow))]"
      : "shadow-[inset_0_2px_0_hsl(var(--fig-cyan)),0_3px_5px_-2px_hsl(var(--fig-obj-shadow))]"
    : raised
      ? "shadow-[inset_0_-2px_0_hsl(var(--fig-slate)),inset_0_1px_0_hsl(var(--fig-obj-highlight)),0_7px_10px_-4px_hsl(var(--fig-obj-shadow)),0_0_14px_hsl(var(--fig-rose)/var(--fig-glow))]"
      : "shadow-[inset_0_-2px_0_hsl(var(--fig-slate)),inset_0_1px_0_hsl(var(--fig-obj-highlight)),0_3px_5px_-2px_hsl(var(--fig-obj-shadow))]";
/**
 * The band's cells in forced colours, where the ring and the glow drop: an outline in the system highlight. The style
 * is an arbitrary property because tailwind-merge drops a bare `outline` next to `outline-2`.
 */
const forcedFocal = "forced-colors:[outline-style:solid] forced-colors:outline-2 forced-colors:outline-[Highlight]";
/** A screen set into the panel (a well): the well token and a shadow cast inward from its top edge. */
const wellClass = "rounded-lg border border-border/70 bg-[hsl(var(--fig-well))] shadow-[inset_0_2px_6px_-2px_hsl(var(--fig-obj-shadow))]";
/** A bit on a lit body: its value colour (text and outline) from the visual language, its depth from the figure. */
const litBit = (b: Bit4, strength: "rest" | "full" = "rest") =>
  cn(bitClass(b), b === 1 ? (strength === "full" ? fullBody.one : restBody.one) : b === 0 ? (strength === "full" ? fullBody.zero : restBody.zero) : null, objectRest);

/** Where a run of values sits on the axis, in per cent: its centre and its width (one value is 1/256 of the axis). */
const bandSpan = (values: number[]) => {
  const total = TEMP_MAX - TEMP_MIN + 1;
  const start = (values[0] - TEMP_MIN) / total;
  const end = (values[values.length - 1] - TEMP_MIN + 1) / total;
  return { centre: ((start + end) / 2) * 100, width: (end - start) * 100 };
};
/** The band never draws narrower than this, so a one-value band still reads as a part at 390 px. */
const BAND_MIN_PX = 6;

/**
 * The depth under one lane of the number line, drawn in SVG behind the lane's own HTML segments (which keep their
 * words, borders and colours). Geometry is in per cent of the lane, so it lines up with the segments at every width.
 * The lane is a one-bit trace over the temperature axis: low (slate) up to the threshold, a rising edge, high (cyan)
 * after it, drawn as a lit trace. The lanes are the subject, so in light mode they take their body hue whole (at 40%
 * they read as plain white bars); dark keeps the rest strength, which already reads as lit glass. The rising edge is
 * drawn in the cyan ink in light mode, so it keeps 3:1 against the pale lane. The test values are not drawn here (the
 * marker row under the lanes carries them and their verdicts), so nothing crowds the focal part: the disagreement
 * band, drawn on the RTL lane only (where the RTL is wrong) as a filled, glowing rose segment from the Spec edge to the
 * RTL edge, at least BAND_MIN_PX wide.
 */
function LaneDepth({ id, first, band }: { id: string; first: number; band: number[] }) {
  const edge = ((first - TEMP_MIN) / (TEMP_MAX - TEMP_MIN + 1)) * 100;
  const span = band.length ? bandSpan(band) : null;
  const bandBox = span
    ? { x: `calc(${span.centre}% - max(${span.width / 2}%, ${BAND_MIN_PX / 2}px))`, width: `max(${span.width}%, ${BAND_MIN_PX}px)` }
    : null;
  return (
    <svg aria-hidden className="fig-fx pointer-events-none absolute inset-0 h-full w-full overflow-visible" data-testid="lane-depth">
      <defs>
        <FigureDepthDefs id={id} hues={["slate", "cyan"]} width={2400} height={40} level />
      </defs>
      <g className="fig-fx-blur" filter={shadowFilter(id)}>
        <rect x="0.3%" y={3} width="99.4%" height="100%" rx={6} className="fig-shadow" />
      </g>
      <rect x="0" y="0" width="100%" height="100%" rx={6} className="fill-card" />
      {/* Light (and print): the body hue whole. Dark: the rest strength. */}
      <rect x="0" y="0" width={`${edge}%`} height="100%" fill={depthFill(id, "slate", "full")} className="dark:hidden" />
      <rect x={`${edge}%`} y="0" width={`${100 - edge}%`} height="100%" fill={depthFill(id, "cyan", "full")} className="dark:hidden" />
      <rect x="0" y="0" width={`${edge}%`} height="100%" fill={depthFill(id, "slate", "rest")} className="hidden dark:inline" />
      <rect x={`${edge}%`} y="0" width={`${100 - edge}%`} height="100%" fill={depthFill(id, "cyan", "rest")} className="hidden dark:inline" />
      <rect x="1.25" y="1.25" style={{ width: "calc(100% - 2.5px)", height: "calc(100% - 2.5px)" }} rx={5} fill="none" stroke={rimStroke(id)} strokeWidth={1} />
      {/* The alarm as a one-bit trace: high after the threshold, so the cyan fill deepens toward its top edge (the high
          level), and the rising edge at the threshold is a lit line. */}
      <rect x={`${edge}%`} y="0" width={`${100 - edge}%`} height="100%" fill={levelFill(id)} />
      <g className="fig-fx-blur fig-glow-soft" filter={glowFilter(id)}>
        <line x1={`${edge}%`} x2={`${edge}%`} y1="0" y2="100%" className="stroke-fig-cyan" strokeWidth={6} />
        {bandBox ? <rect y="-2" height="32" style={bandBox} className="fill-fig-rose" /> : null}
      </g>
      {/* The disagreement band: the focal part after the reveal. */}
      {bandBox ? <rect y="0" height="100%" rx={1} style={bandBox} className="fill-fig-rose" data-testid="band-column" /> : null}
      <line x1={`${edge}%`} x2={`${edge}%`} y1="0" y2="100%" className="stroke-fig-cyan-text dark:stroke-fig-cyan" strokeWidth={2} />
    </svg>
  );
}

/** One persistent polite live region, mounted from the first render so its first message is announced. */
function LiveAnnouncement({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only" data-testid="probe-live">
      {text}
    </p>
  );
}

/** Mounted inside the reveal: tells the parent the answer is showing and what to announce. */
function RevealSignal({ text, onReveal }: { text: string; onReveal: (text: string | null) => void }) {
  useEffect(() => {
    onReveal(text);
    return () => onReveal(null);
  }, [text, onReveal]);
  return null;
}

/** Takes the focus when the reveal opens, because the button that had it has just gone. */
function RevealHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h4 ref={ref} tabIndex={-1} className="text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </h4>
  );
}

/** Marker geometry on the number line, in px: the triangle row, then one row per stacked label. */
const TRIANGLE_ROW_PX = 16;
const LABEL_ROW_PX = 18;

/** The whole 0 to 255 range: where each side raises the alarm, and where the test values sit. */
function NumberLine({ values, fixed, run }: { values: number[]; fixed: boolean; run: RunResult | null }) {
  const rows = [
    { name: "Spec", code: `t >= ${THRESHOLD}`, first: THRESHOLD },
    { name: "RTL", code: `temp ${rtlOperator(fixed)} ${THRESHOLD}`, first: fixed ? THRESHOLD : THRESHOLD + 1 },
  ];
  const total = TEMP_MAX - TEMP_MIN + 1;
  const layout = markerLayout(values, run);
  /** Reserve the rows the revealed labels (with their glyphs) need, so the line keeps its height on reveal. */
  const markerRows = Math.max(layout.rows, markerLayout(values, runChecks(values, fixed)).rows);
  const fx = `probe-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const band = disagreementBand(fixed);
  return (
    <figure className={cn(panel, "fig-panel space-y-2")} data-testid="number-line">
      <figcaption className="text-xs text-muted-foreground">
        All {total} values of <code className={mono}>logic [7:0]</code>, {TEMP_MIN} to {TEMP_MAX}. A bar reads 1 where that side raises the alarm.
      </figcaption>
      {/* The screen: both lanes, the value markers and the axis sit in a well, like the traces of a logic analyser. */}
      <div className={cn(wellClass, "space-y-1.5 px-2 pt-1")}>
      {rows.map((row, i) => {
        const zeroWidth = ((row.first - TEMP_MIN) / total) * 100;
        const tick = row.name === "RTL" && run ? bandTickLabel(fixed) : null;
        return (
          <div key={row.name} className="space-y-1">
            <p className="text-xs text-foreground">
              <span className="font-medium">{row.name}</span> <code className={mono}>{row.code}</code>
            </p>
            <div className="relative h-7" aria-hidden>
              <LaneDepth id={`${fx}-${i}`} first={row.first} band={run && row.name === "RTL" ? band.values : []} />
              <div className="relative flex h-7 overflow-hidden rounded-md">
                <div className={cn("flex items-center border px-1 text-xs", valueStyles.zero.className, "border-fig-slate/80 bg-transparent dark:border-slate-400/60")} style={{ width: `${zeroWidth}%` }}>
                  alarm 0
                </div>
                <div className={cn("flex flex-1 items-center border px-1 text-xs", valueStyles.one.className, "border-fig-cyan bg-transparent dark:border-cyan-500/70")}>alarm 1</div>
              </div>
            </div>
            {tick && band.width ? (
              <div className="relative h-5" data-testid="band-tick">
                <span
                  className={cn("absolute top-0 flex items-center gap-1 whitespace-nowrap text-xs font-medium", comparisonStyles.mismatch.className)}
                  style={{ left: `${axisFraction(band.values[0]) * 100}%`, transform: "translateX(-0.5ch)" }}
                >
                  <span aria-hidden>{comparisonStyles.mismatch.glyph}</span>
                  <span className={mono}>{tick}</span>
                </span>
                {/* A leader from the band on the lane above down to its tick. */}
                <span aria-hidden className="absolute -top-1 h-1 w-0.5 -translate-x-1/2 bg-fig-rose" style={{ left: `${bandSpan(band.values).centre}%` }} />
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="relative" style={{ height: TRIANGLE_ROW_PX + markerRows * LABEL_ROW_PX }} aria-hidden data-testid="value-markers">
        <div className="absolute inset-x-0 top-0 border-t border-border" />
        {layout.markers.map((m) => {
          const result = run?.results.find((r) => r.temp === m.value);
          const mark = result ? (result.pass ? comparisonStyles.match : comparisonStyles.mismatch) : null;
          return (
            <React.Fragment key={m.value}>
              <span
                className={cn("absolute top-0 -translate-x-1/2 text-xs leading-4", mark ? mark.className : "text-foreground", result && !result.pass && "z-[1]")}
                style={{ left: `${m.at * 100}%` }}
                data-testid={`marker-${m.value}`}
              >
                ▲
              </span>
              <span
                className={cn("absolute whitespace-nowrap text-center text-xs leading-[18px]", mono, mark ? mark.className : "text-foreground")}
                style={{ left: `${m.labelLeft * 100}%`, width: `${m.labelWidth * 100}%`, top: TRIANGLE_ROW_PX + m.row * LABEL_ROW_PX }}
                data-testid={`marker-label-${m.value}`}
              >
                {m.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>
      <div className={cn("flex justify-between text-xs text-muted-foreground", mono)} aria-hidden>
        <span>{TEMP_MIN}</span>
        <span>{TEMP_MAX}</span>
      </div>
      </div>
      <p className="sr-only">
        The spec raises the alarm where {rows[0].code}; the RTL raises it where {rows[1].code}. Test values: {values.join(", ") || "none"}.
        {run && bandTickLabel(fixed) ? ` They disagree at ${bandTickLabel(fixed)}.` : ""}
      </p>
    </figure>
  );
}

/** A close-up of the values around the threshold: both sides and their !== verdict, value by value. */
function BandLens({ fixed }: { fixed: boolean }) {
  const band = disagreementBand(fixed);
  const cells = LENS_VALUES.map((v) => check(v, fixed));
  const cell = "flex h-8 items-center justify-center rounded border text-xs";
  return (
    <figure className={cn(panel, "fig-panel space-y-2")} data-testid="band-lens">
      <figcaption className="text-xs text-muted-foreground">
        Close-up of {LENS_VALUES[0]} to {LENS_VALUES[LENS_VALUES.length - 1]}. Disagreement band: <span className="font-medium text-foreground">{band.width} value{band.width === 1 ? "" : "s"} wide</span>
        {band.width ? ` (${band.text})` : ""}.
      </figcaption>
      <table className={cn(wellClass, "w-full table-fixed border-separate border-spacing-1 border-0 ring-1 ring-inset ring-border/70")} aria-label="Spec, RTL and the !== check for each value near the threshold">
        <colgroup>
          <col style={{ width: "3.25rem" }} />
          {cells.map((c) => (
            <col key={c.temp} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="text-left text-xs font-medium text-muted-foreground">
              temp
            </th>
            {cells.map((c) => (
              <th key={c.temp} scope="col" className={cn("text-xs font-medium", mono, c.differs ? comparisonStyles.mismatch.className : "text-foreground")}>
                {c.temp}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["Spec", (c: (typeof cells)[number]) => c.expected],
              ["RTL", (c: (typeof cells)[number]) => c.alarm],
            ] as const
          ).map(([name, pick]) => (
            <tr key={name}>
              <th scope="row" className="text-left text-xs font-medium text-foreground">
                {name}
              </th>
              {cells.map((c) => (
                <td key={c.temp} className="p-0">
                  <span className={cn(cell, mono, litBit(pick(c), c.differs ? "full" : "rest"), c.differs && cn("relative z-[1] ring-2 ring-danger", forcedFocal), levelShadow(pick(c), c.differs === 1), "print:shadow-none")}>
                    {String(pick(c))}
                  </span>
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className={cn("text-left text-xs font-medium text-foreground", mono)}>
              !==
            </th>
            {cells.map((c) => {
              const mark = c.differs ? comparisonStyles.mismatch : comparisonStyles.match;
              return (
                <td key={c.temp} className="p-0">
                  <span
                    className={cn(
                      cell,
                      mark.className,
                      c.differs ? cn("border-fig-rose font-semibold", fullBody.mismatch, objectRaisedRose, forcedFocal) : cn("border-fig-emerald/60", restBody.match, objectRest),
                    )}
                  >
                    <span aria-hidden>{mark.glyph}</span>
                    <span className="sr-only">{c.differs ? "differ: fail" : "equal: pass"}</span>
                  </span>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-foreground" data-testid="band-sentence">
        {bandSentence(fixed)}
      </p>
    </figure>
  );
}

/** One line after the reveal that points to the next experiment on the junior path. */
function NextStepHint({ step, onAction }: { step: NextStep; onAction: (action: PresetId | "fix") => void }) {
  const { action, button } = step;
  return (
    <div className={cn(panel, "flex flex-wrap items-center gap-2")} data-testid="next-step">
      <p className="min-w-0 flex-1 basis-56 text-sm text-foreground">
        <span className="font-medium">Next: </span>
        {step.text}
      </p>
      {action && button ? (
        <button type="button" className={buttonClass} onClick={() => onAction(action)}>
          {button}
        </button>
      ) : null}
    </div>
  );
}

function Results({ run }: { run: RunResult }) {
  return (
    <div className="space-y-3">
      <table className={cn(panel, "w-full border-separate border-spacing-0 text-xs")} data-testid="results-table">
        <caption className="sr-only">Each check: the RTL's alarm, the spec's expected value and the !== verdict</caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="pb-1 font-medium">temp</th>
            <th scope="col" className="pb-1 font-medium">alarm (RTL)</th>
            <th scope="col" className="pb-1 font-medium">expected (spec)</th>
            <th scope="col" className="pb-1 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {run.results.map((r) => {
            const mark = r.pass ? comparisonStyles.match : comparisonStyles.mismatch;
            return (
              <tr key={r.temp}>
                <td className={cn("py-1", mono)}>{r.temp}</td>
                <td className="py-1">
                  <span className={cn("rounded border px-1.5", mono, litBit(r.alarm))}>{String(r.alarm)}</span>
                </td>
                <td className="py-1">
                  <span className={cn("rounded border px-1.5", mono, litBit(r.expected))}>{String(r.expected)}</span>
                </td>
                <td className={cn("py-1 font-medium", mark.className)}>
                  <span aria-hidden>{mark.glyph} </span>
                  {r.pass ? "pass" : "fail"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <figure className="overflow-hidden rounded-xl border border-code-border bg-code-surface text-code-foreground">
        <figcaption className="border-b border-code-border px-3 py-2 text-xs text-code-muted">What the test prints</figcaption>
        <pre className={cn("overflow-x-auto px-3 py-2 text-sm", mono)} data-testid="run-output">
          {run.output.join("\n")}
        </pre>
      </figure>
    </div>
  );
}

export default function BoundaryProbe({ preset = "typical", fixed: initialFixed = false }: BoundaryProbeProps) {
  const inputId = useId();
  const errorId = useId();
  const [valueSet, setValueSet] = useState<ValueSet>(preset);
  const [values, setValues] = useState<number[]>(() => normalizeValues(presetById(preset).values));
  const [fixed, setFixed] = useState(initialFixed);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [focusAfter, setFocusAfter] = useState<"values" | "fix" | null>(null);
  const valuesRef = useRef<HTMLDivElement>(null);
  const fixRef = useRef<HTMLButtonElement>(null);

  /** A next-step button closes the reveal it sits in, so the focus goes to the control it changed. */
  useEffect(() => {
    if (focusAfter === "fix") fixRef.current?.focus();
    if (focusAfter === "values") valuesRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    if (focusAfter) setFocusAfter(null);
  }, [focusAfter]);

  const run = useMemo(() => runChecks(values, fixed), [values, fixed]);
  const options: PredictionOption[] = useMemo(
    () => countOptions(values, fixed).map((o) => ({ id: o.id, label: <span className={mono}>{o.label}</span>, correct: o.correct, feedback: o.feedback })),
    [values, fixed],
  );
  const onReveal = useCallback((text: string | null) => {
    setRevealed(text !== null);
    setSaid(text ?? "");
  }, []);

  const choosePreset = (next: ValueSet) => {
    setValueSet(next);
    setError(null);
    if (next !== "custom") setValues(normalizeValues(presetById(next).values));
  };
  const addValue = () => {
    const parsed = parseTemp(draft, values);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setDraft("");
    setValueSet("custom");
    setValues(normalizeValues([...values, parsed.value]));
  };
  const removeValue = (v: number) => {
    setValueSet("custom");
    setError(null);
    setValues(values.filter((x) => x !== v));
  };

  const currentPreset = valueSet === "custom" ? null : presetById(valueSet);
  const valuesText = values.join(", ");
  const resetKey = `${attempt}|${fixed}|${valuesText}`;

  return (
    <VisualFrame
      label="Boundary probe: where > and >= disagree"
      eyebrow="Experiment · predict then reveal"
      title="One character, one value"
      summary={`The spec says the alarm is 1 when temp is ${THRESHOLD} or more; the RTL writes >. Pick test values, predict the summary line, then see which values can tell the two apart.`}
      fidelity="model"
      assumptions={BOUNDARY_PROBE_ASSUMPTIONS}
      className={frameClass}
    >
      <div className={cn("space-y-3", touchButtons)}>
        <div ref={valuesRef}>
          <SegmentedControl<ValueSet>
            label="Test values"
            value={valueSet}
            onChange={choosePreset}
            options={[
              ...PRESETS.map((p) => ({ value: p.id as ValueSet, label: `${p.label} (${p.values.join(", ")})` })),
              { value: "custom" as ValueSet, label: "Custom" },
            ]}
          />
        </div>
        {currentPreset ? <p className="text-xs text-muted-foreground">{currentPreset.note}</p> : null}

        <div className={cn(panel, "space-y-3")}>
          <p className="text-xs font-medium text-foreground" id={`${inputId}-chips`}>
            Values the test checks, in order ({values.length} of at most {MAX_VALUES})
          </p>
          {values.length ? (
            <ul className="flex flex-wrap gap-2" aria-labelledby={`${inputId}-chips`}>
              {values.map((v) => (
                <li key={v} className="inline-flex items-center rounded-lg border border-border bg-muted pl-2 text-sm text-foreground">
                  <span className={mono}>{v}</span>
                  <button type="button" onClick={() => removeValue(v)} aria-label={`Remove ${v}`} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span aria-hidden>✕</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No values yet. Add one to run the test.</p>
          )}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addValue();
            }}
          >
            <div className="flex flex-col gap-1">
              <label htmlFor={inputId} className="text-xs font-medium text-foreground">
                Add a value ({TEMP_MIN} to {TEMP_MAX})
              </label>
              <input
                id={inputId}
                className={inputClass}
                inputMode="numeric"
                autoComplete="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            <button type="submit" className={buttonClass}>
              Add value
            </button>
          </form>
          {error ? (
            <p id={errorId} role="alert" className="text-xs text-danger">
              <span aria-hidden>✕ </span>
              {error}
            </p>
          ) : null}
        </div>

        <button ref={fixRef} type="button" aria-pressed={fixed} onClick={() => setFixed((f) => !f)} className={cn(buttonClass, fixed && "border-ring bg-muted")}>
          <span aria-hidden className={cn("inline-flex size-5 items-center justify-center rounded border border-input text-xs", fixed && "border-ring text-foreground")}>
            {fixed ? "✓" : ""}
          </span>
          Fix the RTL (&gt; becomes &gt;=)
        </button>
      </div>

      <figure className="overflow-hidden rounded-xl border border-code-border bg-code-surface text-code-foreground">
        <figcaption className="border-b border-code-border px-3 py-2 text-xs text-code-muted">The design line and the check</figcaption>
        <pre className={cn("overflow-x-auto px-3 py-2 text-sm", mono)} data-testid="code-lines">
          {`${rtlLine(fixed)}   // RTL\n${SPEC_LINE}   // spec`}
        </pre>
      </figure>

      <NumberLine values={values} fixed={fixed} run={revealed ? run : null} />

      <LiveAnnouncement text={said} />

      {values.length ? (
        <PredictionPrompt
          className={touchButtons}
          resetKey={resetKey}
          question={
            <>
              The test checks {valuesText} against <code className={mono}>{`temp ${rtlOperator(fixed)} 8'd${THRESHOLD}`}</code>. What is the last line it prints?
            </>
          }
          options={options}
        >
          {({ committed }) => {
            const chosen = options.find((o) => o.id === committed);
            const verdict = chosen ? (chosen.correct ? "Correct." : "Not quite.") : "Revealed.";
            return (
              <div className="space-y-3" data-testid="probe-reveal">
                <RevealSignal text={`${verdict} The test prints ${run.summary}. ${bandSentence(fixed)}`} onReveal={onReveal} />
                <RevealHeading>
                  The run: <span className={mono}>{run.summary}</span>
                </RevealHeading>
                <Results run={run} />
                <BandLens fixed={fixed} />
                <NextStepHint
                  step={nextStep(values, fixed)}
                  onAction={(action) => {
                    if (action === "fix") {
                      setFixed(true);
                      setFocusAfter("fix");
                    } else {
                      choosePreset(action);
                      setFocusAfter("values");
                    }
                  }}
                />
              </div>
            );
          }}
        </PredictionPrompt>
      ) : null}

      <p className="text-xs text-muted-foreground" data-testid="x-note">
        {xNote()}
      </p>

      <div>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            choosePreset(preset);
            setFixed(initialFixed);
            setDraft("");
            setAttempt((n) => n + 1);
          }}
        >
          Start over
        </button>
      </div>
    </VisualFrame>
  );
}
