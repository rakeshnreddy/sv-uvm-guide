"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
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
/** The frame's assumptions disclosure: a 40 px target on touch screens. */
const frameClass = "[@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3";

const bitClass = (b: Bit4) => (b === 1 ? valueStyles.one.className : b === 0 ? valueStyles.zero.className : valueStyles.unknown.className);

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
  return (
    <figure className={cn(panel, "space-y-2")} data-testid="number-line">
      <figcaption className="text-xs text-muted-foreground">
        All {total} values of <code className={mono}>logic [7:0]</code>, {TEMP_MIN} to {TEMP_MAX}. A bar reads 1 where that side raises the alarm.
      </figcaption>
      {rows.map((row) => {
        const zeroWidth = ((row.first - TEMP_MIN) / total) * 100;
        const tick = row.name === "RTL" && run ? bandTickLabel(fixed) : null;
        const band = disagreementBand(fixed);
        return (
          <div key={row.name} className="space-y-1">
            <p className="text-xs text-foreground">
              <span className="font-medium">{row.name}</span> <code className={mono}>{row.code}</code>
            </p>
            <div className="flex h-7 overflow-hidden rounded-md" aria-hidden>
              <div className={cn("flex items-center border px-1 text-xs", valueStyles.zero.className)} style={{ width: `${zeroWidth}%` }}>
                alarm 0
              </div>
              <div className={cn("flex flex-1 items-center border px-1 text-xs", valueStyles.one.className)}>alarm 1</div>
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
                className="absolute top-0 -translate-x-1/2 text-xs leading-4 text-foreground"
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
    <figure className={cn(panel, "space-y-2")} data-testid="band-lens">
      <figcaption className="text-xs text-muted-foreground">
        Close-up of {LENS_VALUES[0]} to {LENS_VALUES[LENS_VALUES.length - 1]}. Disagreement band: <span className="font-medium text-foreground">{band.width} value{band.width === 1 ? "" : "s"} wide</span>
        {band.width ? ` (${band.text})` : ""}.
      </figcaption>
      <table className="w-full table-fixed border-separate border-spacing-1" aria-label="Spec, RTL and the !== check for each value near the threshold">
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
                  <span className={cn(cell, mono, bitClass(pick(c)), c.differs && "ring-2 ring-danger")}>{String(pick(c))}</span>
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
                  <span className={cn(cell, "border-border bg-muted", mark.className)}>
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
                  <span className={cn("rounded border px-1.5", mono, bitClass(r.alarm))}>{String(r.alarm)}</span>
                </td>
                <td className="py-1">
                  <span className={cn("rounded border px-1.5", mono, bitClass(r.expected))}>{String(r.expected)}</span>
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
