"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { bitClassName } from "@/components/visual-system/BitStrip";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  BOUND_MAX,
  BOUND_MIN,
  COUNT_TYPE_DECL,
  INPUT_NOTES,
  INT_INPUT_MAX,
  INT_INPUT_MIN,
  LOOP_ASSUMPTIONS,
  LOOP_PRESETS,
  PREDICTION_QUESTION,
  buildProgram,
  inputKey,
  parseCountBits,
  predictionOptions,
  presetById,
  presetInputs,
  runLoop,
  summarizeRun,
  testPlacementText,
  type CountType,
  type LoopInputs,
  type LoopPresetId,
  type FlowBox,
  type LoopProgram,
  type LoopRun,
  type LoopStep,
  type LoopVar,
} from "@/lib/sv-loop-model";
import { parseBits, type Bit4 } from "@/lib/sv-four-state-model";
import { cn } from "@/lib/utils";

export interface LoopTracerProps {
  /** The preset the tracer opens on. */
  preset?: LoopPresetId;
  /** The presets offered in the picker (default: all). The opening preset is always included. */
  presets?: LoopPresetId[];
}

const selectClass =
  "h-10 min-w-0 rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const inputClass =
  "h-10 w-full min-w-0 rounded-md border border-border bg-card px-2 font-mono text-sm text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border bg-card p-3";
const chipClass = "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-0.5 text-sm text-foreground tabular-nums";
/** The shared primitives size some controls below 40 px (segments, summaries, the speed select): size them for touch from here. */
const touchClass =
  "[@media(pointer:coarse)]:[&_button]:min-h-10 [@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3 [@media(pointer:coarse)]:[&_select]:min-h-10";

const COUNT_TYPES: CountType[] = ["int", "logic4", "logic4s"];

const intError = `Type a whole number from ${INT_INPUT_MIN} to ${INT_INPUT_MAX}.`;
const parseIntText = (text: string): number | null => {
  if (!/^\s*-?\d+\s*$/.test(text)) return null;
  const v = Number(text);
  return v >= INT_INPUT_MIN && v <= INT_INPUT_MAX ? v : null;
};

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground", className)}>
      {label}
      {children}
    </label>
  );
}

const BIT_CUE: Record<Bit4, string> = { "0": "0", "1": "1", x: "x, unknown", z: "z, high impedance" };

/** A 4-bit literal such as 4'bxx01, drawn bit by bit with the four-state encoding (x hatched, z dashed). */
function LiteralBits({ value }: { value: string }) {
  const match = /^(\d+'b)([01xz]+)$/.exec(value);
  if (!match) return <span className="font-semibold">{value}</span>;
  const bits = parseBits(match[2]);
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold" data-testid="literal-bits">
      <span>{match[1]}</span>
      {bits.map((b, i) => (
        <span key={i} data-bit={b} className={cn("inline-flex h-5 w-4 items-center justify-center rounded-sm border text-xs", bitClassName(b))}>
          {b}
        </span>
      ))}
    </span>
  );
}

function VarChip({ v }: { v: LoopVar }) {
  if (v.kind === "logic1") return <ValueChip name={v.name} value={v.value} changed={v.changed} />;
  const literal = v.kind === "logic4" ? /^\d+'b([01xz]+)$/.exec(v.value) : null;
  const unknown = literal !== null && /[xz]/.test(literal[1]);
  const bitsText = literal ? `, bits ${parseBits(literal[1]).map((b) => BIT_CUE[b]).join("; ")}` : "";
  return (
    <span
      role="img"
      className={cn(chipClass, mono, v.changed && "ring-2 ring-primary ring-offset-1 ring-offset-background")}
      aria-label={`${v.name} = ${v.value}${unknown ? `, has x or z bits${bitsText}` : ""}${v.changed ? ", just changed" : ""}`}
    >
      <span className="text-xs text-muted-foreground">{v.name}</span>
      {literal ? <LiteralBits value={v.value} /> : <span className="font-semibold">{v.value}</span>}
      {v.changed ? (
        <span aria-hidden className="text-xs text-primary">
          ▲
        </span>
      ) : null}
    </span>
  );
}

function Flowchart({ program, step }: { program: LoopProgram; step: LoopStep }) {
  const { edges } = program;
  const exitBox = program.boxes.find((b) => b.id === "exit");
  // Boxes before the exit: init (outside the loop, when present) and the in-loop boxes.
  const flow = program.boxes.filter((b) => b.id !== "exit");
  const renderBox = (box: FlowBox) => {
    const active = box.id === step.box;
    return (
      <div
        aria-current={active ? "step" : undefined}
        data-testid={`flow-${box.id}`}
        className={cn(
          "rounded-lg border border-border bg-card px-3 py-2 transition-colors duration-200 motion-reduce:transition-none",
          active && "border-l-2 border-l-primary bg-muted",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <code className={cn(mono, "text-sm font-medium text-foreground")}>{box.code}</code>
          {active ? <span className="text-xs font-medium text-primary">Now</span> : null}
          {active && step.jump ? (
            <span className={cn(chipClass, "text-xs")} data-testid="jump-tag">
              <span aria-hidden>{step.jump === "continue" ? "↪" : "⇥"}</span>
              {step.jump}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{box.role}</p>
        {box.next ? <p className="text-xs text-muted-foreground">{box.next}</p> : null}
      </div>
    );
  };
  return (
    <div className="space-y-2">
      <p className="text-label text-muted-foreground">Flowchart</p>
      <ol className="space-y-1.5" aria-label="Loop flowchart">
        {flow.map((box, i) => {
          const nextBox = flow[i + 1];
          return (
            <li key={box.id} className="space-y-1.5">
              {renderBox(box)}
              {nextBox ? (
                <p aria-hidden className="pl-4 text-xs text-muted-foreground" data-testid={`flow-arrow-${box.id}-${nextBox.id}`}>
                  ↓
                </p>
              ) : (
                <p
                  className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground"
                  data-testid="flow-loopback"
                  data-to={edges.loopBackTo}
                >
                  <span aria-hidden className="text-sm text-foreground">
                    ↑
                  </span>
                  {edges.loopBackLabel}
                </p>
              )}
            </li>
          );
        })}
        {exitBox ? (
          <li key="exit" className="space-y-1.5 pt-1">
            <div className="ml-4 space-y-0.5 border-l-2 border-dashed border-border pl-2" data-testid="flow-exit-branch">
              {edges.exitFrom.map((from) => (
                <p key={from} className="flex gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden className="text-foreground">
                    ⤷
                  </span>
                  <span>Exit from {from}</span>
                </p>
              ))}
            </div>
            <div className="ml-4">{renderBox(exitBox)}</div>
          </li>
        ) : null}
      </ol>
      <p className="text-xs text-muted-foreground" data-testid="test-placement">
        {testPlacementText(program)}
      </p>
    </div>
  );
}

function Trace({ run, stepKey }: { run: LoopRun; stepKey: string }) {
  const playback = usePlayback(run.steps.length, stepKey);
  const step = run.steps[Math.min(playback.index, run.steps.length - 1)];
  const consoleRef = useRef<HTMLDivElement>(null);
  const isLast = playback.index >= run.steps.length - 1;

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [playback.index]);

  const lineText = run.program.code[step.line] ?? "";

  return (
    <div className="space-y-4" data-testid="loop-trace">
      <PlaybackControls playback={playback} stepCount={run.steps.length} stepNoun="Loop step" describeStep={(i) => run.steps[i]?.what ?? ""} />

      <div className="overflow-hidden rounded-xl border border-code-border bg-code-surface text-code-foreground">
        <p className="border-b border-code-border px-3 py-1.5 text-label text-code-muted">Current line</p>
        <p className={cn(mono, "flex gap-2 px-3 py-2 text-sm")} data-testid="current-line">
          <span className="shrink-0 text-code-muted">Line {step.line + 1}</span>
          <code className="min-w-0 whitespace-pre-wrap break-words">{lineText.trim()}</code>
        </p>
      </div>

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <Flowchart program={run.program} step={step} />

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" aria-label="Loop state" role="group">
            <span className={chipClass} data-testid="pass-counter">
              <span className="text-xs text-muted-foreground">Passes</span>
              <span className="font-semibold">{step.passes}</span>
            </span>
            <span className={chipClass} data-testid="sim-time">
              <span className="text-xs text-muted-foreground">Sim time</span>
              <span className={cn(mono, "font-semibold")}>t = {step.time}</span>
            </span>
            <span className={chipClass} data-testid="statement-count">
              <span className="text-xs text-muted-foreground">Statements at t = {step.time}</span>
              <span className="font-semibold">{step.statementsAtThisTime}</span>
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-label text-muted-foreground">Loop variables</p>
            <div className="flex flex-wrap gap-2" data-testid="loop-vars">
              {step.vars.map((v) => (
                <VarChip key={v.name} v={v} />
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-code-border bg-code-surface text-code-foreground">
            <p className="border-b border-code-border px-3 py-1.5 text-label text-code-muted">Console</p>
            {/* Not live: the status line below already reads each step, including what $display prints. Focusable, so keyboard users can scroll it. */}
            <div
              ref={consoleRef}
              role="log"
              aria-live="off"
              aria-label="Console output"
              tabIndex={0}
              className={cn(mono, "max-h-40 overflow-y-auto px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
              data-testid="console"
            >
              {step.console.length === 0 ? (
                <p className="text-code-muted">Nothing printed yet</p>
              ) : (
                step.console.map((line, i) => <p key={`${i}-${line}`}>{line}</p>)
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={panel}>
        <p className="text-sm text-foreground" data-testid="step-what">
          {step.what}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Rule: {step.clause}, IEEE 1800-2023</p>
        {isLast ? (
          <p className="mt-2 text-sm font-medium text-foreground" data-testid="loop-result">
            Result: {summarizeRun(run)}.
          </p>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="sr-only" data-testid="trace-live">
        {`Step ${playback.index + 1} of ${run.steps.length}. ${step.what} Passes: ${step.passes}. Sim time t = ${step.time}.`}
      </p>
    </div>
  );
}

export default function LoopTracer({ preset = "for-continue-break", presets }: LoopTracerProps) {
  const offered = useMemo(() => {
    const list = presets && presets.length > 0 ? presets : LOOP_PRESETS.map((p) => p.id);
    return list.includes(preset) ? list : [preset, ...list];
  }, [preset, presets]);

  const errorId = useId();
  const [presetId, setPresetId] = useState<LoopPresetId>(preset);
  const [inputs, setInputs] = useState<LoopInputs>(() => presetInputs(presetById(preset)));
  const [bitsText, setBitsText] = useState(inputs.countBits);
  const [intText, setIntText] = useState(String(inputs.countInt));

  const current = presetById(presetId);
  const programId = current.program;
  const program = buildProgram(programId, inputs);

  const choosePreset = (id: LoopPresetId) => {
    const next = presetInputs(presetById(id));
    setPresetId(id);
    setInputs(next);
    setBitsText(next.countBits);
    setIntText(String(next.countInt));
  };

  const usesCount = program.inputs.includes("count");
  const usesInt = program.inputs.includes("countInt") || (usesCount && inputs.countType === "int");
  const usesBits = usesCount && inputs.countType !== "int";
  const bitsParse = parseCountBits(bitsText);
  const intValue = parseIntText(intText);
  const inputError = usesBits && !bitsParse.ok ? bitsParse.error : usesInt && intValue === null ? intError : null;

  const run = useMemo(() => (inputError ? null : runLoop(programId, inputs)), [inputError, programId, inputs]);
  const options: PredictionOption[] = useMemo(
    () => (run ? predictionOptions(programId, inputs, run).map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback })) : []),
    [run, programId, inputs],
  );
  const resetKey = `${presetId}|${inputKey(programId, inputs)}`;
  const codeLines: CodeTraceLine[] = program.code.map((text, i) => ({ text, key: `l${i}` }));

  return (
    <VisualFrame
      label="Loop tracer: counting loop passes"
      eyebrow="Experiment"
      title="Loop tracer"
      summary="Pick a loop and set its inputs, predict how many passes it makes and what it prints, then step through it."
      fidelity="model"
      assumptions={LOOP_ASSUMPTIONS}
      className={touchClass}
    >
      <div className={cn(panel, "space-y-3")}>
        {offered.length > 1 ? (
          <Field label="Loop">
            <select className={selectClass} value={presetId} onChange={(e) => choosePreset(e.target.value as LoopPresetId)}>
              {offered.map((id) => (
                <option key={id} value={id}>
                  {presetById(id).label}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="text-sm text-foreground">{current.label}</p>
        )}

        {usesCount ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Type of n</p>
            <SegmentedControl
              label="Type of n"
              mono
              value={inputs.countType}
              options={COUNT_TYPES.map((t) => ({ value: t, label: COUNT_TYPE_DECL[t] }))}
              onChange={(t) => setInputs((prev) => ({ ...prev, countType: t }))}
            />
          </div>
        ) : null}

        {usesBits ? (
          <Field label="Bits of n, most significant first (0, 1, x or z)">
            <input
              className={inputClass}
              value={bitsText}
              maxLength={6}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!bitsParse.ok || undefined}
              aria-describedby={!bitsParse.ok ? errorId : undefined}
              onChange={(e) => {
                const text = e.target.value;
                setBitsText(text);
                const parsed = parseCountBits(text);
                if (parsed.ok) setInputs((prev) => ({ ...prev, countBits: parsed.bits.join("") }));
              }}
            />
          </Field>
        ) : null}

        {usesInt ? (
          <Field label={`Value of int n (${INT_INPUT_MIN} to ${INT_INPUT_MAX})`}>
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min={INT_INPUT_MIN}
              max={INT_INPUT_MAX}
              step={1}
              value={intText}
              aria-invalid={intValue === null || undefined}
              aria-describedby={intValue === null ? errorId : undefined}
              onChange={(e) => {
                const text = e.target.value;
                setIntText(text);
                const v = parseIntText(text);
                if (v !== null) setInputs((prev) => ({ ...prev, countInt: v }));
              }}
            />
          </Field>
        ) : null}
        {usesInt ? <p className="text-xs text-muted-foreground">{INPUT_NOTES.int}</p> : null}

        {program.inputs.includes("cond") && program.condChoices ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Value of c</p>
            <SegmentedControl
              label="Value of c"
              mono
              value={program.condChoices.includes(inputs.cond) ? inputs.cond : "0"}
              options={program.condChoices.map((b) => ({ value: b, label: `1'b${b}` }))}
              onChange={(b: Bit4) => setInputs((prev) => ({ ...prev, cond: b }))}
            />
            {programId === "do-while" ? <p className="text-xs text-muted-foreground">{INPUT_NOTES.doWhileCond}</p> : null}
          </div>
        ) : null}

        {program.inputs.includes("bound") ? (
          <Field label="N in i < N">
            <select className={cn(selectClass, mono)} value={inputs.bound} onChange={(e) => setInputs((prev) => ({ ...prev, bound: Number(e.target.value) }))}>
              {Array.from({ length: BOUND_MAX - BOUND_MIN + 1 }, (_, i) => BOUND_MIN + i).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <CodeTrace lines={codeLines} label="The loop" />

      {inputError ? (
        <p id={errorId} role="alert" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-danger" data-testid="input-error">
          {inputError}
        </p>
      ) : run ? (
        <PredictionPrompt question={PREDICTION_QUESTION} options={options} resetKey={resetKey}>
          {() => <Trace key={resetKey} run={run} stepKey={resetKey} />}
        </PredictionPrompt>
      ) : null}
    </VisualFrame>
  );
}
