"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { LayoutGroup, MotionConfig, motion } from "framer-motion";

import { BitStrip, BitStripLegend, type BitSegment, type BitTone } from "@/components/visual-system/BitStrip";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePrefersReducedMotion } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  CAST_ASSUMPTIONS,
  CAST_DEST_IDS,
  CAST_DEST_LABELS,
  CAST_PRESETS,
  CAST_SOURCE_IDS,
  CAST_SOURCE_LABELS,
  FILL_ORIGIN,
  NONEXISTENT_ORIGIN,
  REC24_X_NOTE,
  STREAM_ASSUMPTIONS,
  STREAM_OPS,
  STREAM_PRESETS,
  SUBJECT_OPS,
  SUBJECT_TARGETS,
  TARGET_LABELS,
  arrangeOptions,
  bitRuns,
  formatBits,
  segmentWords,
  runCast,
  runStream,
  type CastConfig,
  type CastDestId,
  type CastSourceId,
  type CompareRow,
  type LabOption,
  type StreamConfig,
  type StreamDirection,
  type StreamOpId,
  type StreamStep,
  type StreamTargetId,
  type TaggedBit,
} from "@/lib/sv-stream-model";
import { cn } from "@/lib/utils";

export type StreamPackLabMode = "stream" | "cast";

export interface StreamPackLabProps {
  /** "stream": pack, slice, reverse and fit (§11.4.14); "cast": bit-stream casts (§6.24.3). */
  mode?: StreamPackLabMode;
  /** A preset id of the chosen mode: see STREAM_PRESETS and CAST_PRESETS in sv-stream-model. */
  preset?: string;
}

const selectClass = "h-10 min-w-0 rounded-md border border-border/70 bg-background/60 px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-40 motion-reduce:transition-none";
const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border/70 bg-background/50 p-3";
/** The shared primitives size some buttons below 40 px (text links, min-h-9 segments): size them for touch from here. */
const touchButtons = "[@media(pointer:coarse)]:[&_button]:min-h-10";
const frameClass = "[@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3";
const checkLabelClass = "flex items-center gap-2 text-xs text-foreground [@media(pointer:coarse)]:min-h-10";
const eyebrowClass = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

const toPredictionOptions = (options: LabOption[], seed: string): PredictionOption[] =>
  arrangeOptions(options, seed).map((o) => ({ id: o.id, label: <span className={cn(mono, "break-words text-xs")}>{o.label}</span>, correct: o.correct, feedback: o.feedback }));

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** One persistent polite live region per lab, mounted from the first render so the first verdict is announced. */
function LiveAnnouncement({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only" data-testid="lab-live">
      {text}
    </p>
  );
}

const verdictText = (options: PredictionOption[], committed: string | null): string => {
  const chosen = options.find((o) => o.id === committed);
  const correct = options.find((o) => o.correct);
  if (!chosen) return correct ? `Revealed. ${correct.feedback}` : "";
  if (chosen.correct || !correct) return `${chosen.correct ? "Correct." : "Not quite."} ${chosen.feedback}`;
  return `Not quite. ${chosen.feedback} Why the answer holds: ${correct.feedback}`;
};

/** Mounted inside a prompt's reveal: writes the verdict into the live region, and clears it when the prompt re-arms. */
function VerdictSignal({ options, committed, onSay }: { options: PredictionOption[]; committed: string | null; onSay: (text: string) => void }) {
  useEffect(() => {
    onSay(verdictText(options, committed));
    return () => onSay("");
  }, [options, committed, onSay]);
  return null;
}

/** Takes the focus when a reveal opens: the button that had it has just gone. */
function RevealHeading({ children, testId = "reveal-heading" }: { children: React.ReactNode; testId?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h4 ref={ref} tabIndex={-1} data-testid={testId} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </h4>
  );
}

/** At the end it stays focusable and does nothing: a button that disables itself drops the focus. */
function StepButton({ label, atEnd, onClick, children }: { label: string; atEnd: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={buttonClass} aria-label={label} aria-disabled={atEnd || undefined} onClick={atEnd ? undefined : onClick}>
      {children}
    </button>
  );
}

function StartOver({ onClick }: { onClick: () => void }) {
  return (
    <div>
      <button type="button" className={buttonClass} onClick={onClick}>
        Start over
      </button>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground", className)}>
      {label}
      {children}
    </label>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground" aria-hidden>
        {label}
      </p>
      {children}
    </div>
  );
}

function CodeBlock({ lines, label }: { lines: string[]; label: string }) {
  return (
    <pre aria-label={label} className={cn("whitespace-pre-wrap break-words rounded-lg bg-slate-950/90 p-3 text-[12px] leading-5 text-slate-100", mono)} data-testid="lab-code">
      <code>{lines.join("\n")}</code>
    </pre>
  );
}

// Tones: one per hdr field, so a field keeps its colour wherever the stream moves it.
const FIELD_TONES: Record<string, BitTone> = { len: "cyan", addr: "violet", kind: "amber", a: "cyan", b: "violet", lit: "sky", [FILL_ORIGIN]: "slate", [NONEXISTENT_ORIGIN]: "slate" };

function toneFor(origin: string): BitTone {
  const known = FIELD_TONES[origin];
  if (known) return known;
  const index = /\[(\d+)\]/.exec(origin);
  return index && Number(index[1]) % 2 === 1 ? "sky" : "emerald";
}

/** One line that tells the learner which number is which. */
function BracketKey() {
  return (
    <p className="text-[11px] text-muted-foreground" data-testid="bracket-key">
      Each label names a field and its own bits, left to right (kind bits 0..7 is kind bit-reversed), then [where they sit in this strip].
    </p>
  );
}

/** Segments for a BitStrip in its default [w-1:0] numbering, from the model's runs. */
function segmentsFor(bits: readonly TaggedBit[]): BitSegment[] {
  const w = bits.length;
  return bitRuns(bits).map((r) => ({ hi: w - 1 - r.start, lo: w - 1 - r.end, label: segmentWords(r), tone: toneFor(r.origin) }));
}

function Strip({ bits, label, marked, markLabel }: { bits: readonly TaggedBit[]; label: string; marked?: number[]; markLabel?: string }) {
  if (bits.length === 0) return null;
  const w = bits.length;
  return (
    <BitStrip
      bits={bits.map((b) => b.v)}
      label={label}
      valueText={formatBits(bits.map((b) => b.v))}
      segments={segmentsFor(bits)}
      highlight={marked?.map((p) => w - 1 - p)}
      highlightLabel={markLabel}
    />
  );
}

/** Cards are drawn up to this many; beyond it (one-bit slices of a 32-bit stream) the strip alone carries the step. */
const MAX_CARDS = 12;

/**
 * Cards keep a layoutId per label, so between the slice and reverse steps each
 * slice visibly moves to its new place. With reduced motion it jumps.
 */
function StepView({ step, reducedMotion, groupId }: { step: StreamStep; reducedMotion: boolean; groupId: string }) {
  const cards = step.cards && step.cards.length > 1 && step.cards.length <= MAX_CARDS ? step.cards : null;
  const transition = reducedMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 28 };
  return (
    <div className="space-y-3" data-testid={`step-${step.id}`} data-reduced-motion={reducedMotion ? "true" : "false"}>
      {step.error ? (
        <p role="note" className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
          <span aria-hidden>✕ </span>
          {step.text}
        </p>
      ) : null}
      {cards ? (
        <ol className="flex flex-wrap gap-2" aria-label={`${step.title}: ${cards.length} pieces, in order`}>
          {cards.map((c, i) => (
            <motion.li layout="position" layoutId={`${groupId}-${c.label}`} transition={transition} key={`${c.label}-${i}`} className="min-w-0 max-w-full rounded-lg border border-border/70 bg-background/60 p-2">
              <p className={cn("mb-1 text-[11px] font-semibold text-foreground", mono)}>{c.label}</p>
              <Strip bits={c.bits} label={c.label} />
            </motion.li>
          ))}
        </ol>
      ) : (
        <Strip bits={step.bits} label={`${step.title}: the stream`} marked={step.marked} markLabel={step.markLabel} />
      )}
      {cards && step.marked ? <Strip bits={step.bits} label={`${step.title}: the stream`} marked={step.marked} markLabel={step.markLabel} /> : null}
    </div>
  );
}

/** Step-through of the model's steps: buttons, a scrubber and the step text in a live region. */
function StepThrough({ steps, label }: { steps: StreamStep[]; label: string }) {
  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const groupId = useId();
  const last = steps.length - 1;
  const i = Math.min(index, last);
  const step = steps[i];
  if (!step) return null;
  const hasMarks = steps.some((s) => s.marked && s.marked.length > 0);
  return (
    <div className={cn("space-y-3", panel)} role="group" aria-label={label}>
      <div className="flex flex-wrap items-center gap-2">
        <StepButton label="Previous step" atEnd={i === 0} onClick={() => setIndex(i - 1)}>
          <span aria-hidden>←</span>
        </StepButton>
        <StepButton label="Next step" atEnd={i === last} onClick={() => setIndex(i + 1)}>
          <span aria-hidden>→</span>
        </StepButton>
        <input
          type="range"
          min={0}
          max={last}
          value={i}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-label="Step scrubber"
          aria-valuetext={`Step ${i + 1} of ${steps.length}: ${step.title}`}
          className="h-2 min-w-[120px] flex-1 cursor-pointer accent-cyan-500 [@media(pointer:coarse)]:h-10"
        />
        <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>
          {i + 1}/{steps.length}
        </span>
      </div>
      <ol className="flex flex-wrap gap-1 text-[11px]" aria-label="Steps">
        {steps.map((s, k) => (
          <li key={s.id}>
            <button
              type="button"
              aria-current={k === i ? "step" : undefined}
              onClick={() => setIndex(k)}
              className={cn(
                "min-h-8 rounded-full border px-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-10",
                k === i ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {k + 1}. {s.title}
            </button>
          </li>
        ))}
      </ol>
      <p className="text-sm text-foreground" aria-live="polite" data-testid="step-text">
        <strong>
          Step {i + 1} of {steps.length}: {step.title}.{" "}
        </strong>
        {step.error ? "This step fails; see the error below." : step.text}
      </p>
      <MotionConfig reducedMotion="user">
        <LayoutGroup id={groupId}>
          <StepView step={step} reducedMotion={reducedMotion} groupId={groupId} />
        </LayoutGroup>
      </MotionConfig>
      <BracketKey />
      <BitStripLegend items={hasMarks ? ["x", "highlight"] : ["x"]} />
    </div>
  );
}

function CompareList({ rows, title }: { rows: CompareRow[]; title: string }) {
  return (
    <div className="space-y-2">
      <p className={eyebrowClass}>{title}</p>
      <ul className="space-y-2" data-testid="compare-rows">
        {rows.map((r) => (
          <li key={r.code} className={cn(panel, "space-y-1 text-sm", r.error && "border-rose-500/50")}>
            <code className={cn(mono, "block break-words text-xs")}>{r.code}</code>
            <p className={cn(mono, "font-semibold", r.error && "text-rose-700 dark:text-rose-300")}>{r.result}</p>
            <p className="text-xs text-muted-foreground">{r.why}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stream mode
// ---------------------------------------------------------------------------

function StreamLab({ preset }: { preset?: string }) {
  const initial = STREAM_PRESETS.find((p) => p.id === preset) ?? STREAM_PRESETS[0];
  const [presetId, setPresetId] = useState(initial.id);
  const [config, setConfig] = useState<StreamConfig>(initial.config);
  const [attempt, setAttempt] = useState(0);
  const [said, setSaid] = useState("");
  const run = useMemo(() => runStream(config), [config]);
  const resetKey = `${attempt}|${JSON.stringify(config)}`;
  const options = useMemo(() => toPredictionOptions(run.options, resetKey), [run, resetKey]);
  const current = STREAM_PRESETS.find((p) => p.id === presetId);

  const applyPreset = (id: string) => {
    const p = STREAM_PRESETS.find((x) => x.id === id);
    setPresetId(id);
    if (p) setConfig(p.config);
  };
  const change = (patch: Partial<StreamConfig>) => {
    setPresetId("custom");
    setConfig((c) => ({ ...c, ...patch }));
  };

  const { subject } = config;
  const unpack = config.direction === "unpack" || subject === "payload";
  const steps = run.pack?.steps ?? run.unpack?.steps ?? [];
  const opOptions = SUBJECT_OPS[subject].map((id) => ({ value: id, label: STREAM_OPS[id].label }));
  const targetOptions = SUBJECT_TARGETS[subject].map((id) => ({ value: id, label: TARGET_LABELS[id] }));

  return (
    <VisualFrame
      label="Stream pack lab: streaming operators"
      eyebrow="Experiment · predict then reveal"
      title="Pack, slice, reverse, fit"
      summary="A streaming concatenation packs its operands into one bit stream; with << it cuts the stream into slices from the right and reverses their order, with >> it keeps the order; then the stream meets its target (IEEE 1800-2023 §11.4.14). Pick an operator and a target, predict, then step through."
      fidelity="model"
      assumptions={STREAM_ASSUMPTIONS}
      className={frameClass}
    >
      <div className={cn("space-y-3", touchButtons)}>
        <Field label="Preset">
          <select className={selectClass} value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            {STREAM_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </Field>
        {current ? <p className="text-xs text-muted-foreground">For the lesson section: {current.section}.</p> : null}
        {subject === "hdr" ? (
          <Group label="Direction">
            <SegmentedControl<StreamDirection>
              label="Direction"
              value={config.direction}
              onChange={(direction) => change({ direction, xInAddr: direction === "unpack" ? false : config.xInAddr })}
              options={[
                { value: "pack", label: "Pack: the stream is the source" },
                { value: "unpack", label: "Unpack: the stream is the target" },
              ]}
            />
          </Group>
        ) : null}
        {opOptions.length > 1 ? (
          <Group label="Operator">
            <SegmentedControl<StreamOpId> label="Operator" mono value={config.op} onChange={(op) => change({ op })} options={opOptions} />
          </Group>
        ) : null}
        {subject !== "payload" ? (
          <Group label={unpack ? "Source" : "Target"}>
            <SegmentedControl<StreamTargetId> label={unpack ? "Source" : "Target"} mono value={config.target} onChange={(target) => change({ target })} options={targetOptions} />
          </Group>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <label className={checkLabelClass}>
              <input type="checkbox" checked={config.withRange} onChange={(e) => change({ withRange: e.target.checked })} className="h-4 w-4 accent-cyan-500" />
              <span>
                Use <code className={mono}>with [0 +: hdr.len]</code>
              </span>
            </label>
            <Group label="First byte of rx (lands in hdr.len)">
              <SegmentedControl<string>
                label="First byte of rx"
                mono
                value={String(config.lenByte)}
                onChange={(v) => change({ lenByte: Number(v) })}
                options={[
                  { value: "4", label: "8'h04" },
                  { value: "8", label: "8'h08" },
                ]}
              />
            </Group>
          </div>
        )}
        {!unpack && subject !== "literal" ? (
          <label className={checkLabelClass}>
            <input type="checkbox" checked={config.xInAddr} onChange={(e) => change({ xInAddr: e.target.checked })} className="h-4 w-4 accent-cyan-500" />
            <span>
              Inject x into <code className={mono}>hdr.addr[3:0]</code>
            </span>
          </label>
        ) : null}
      </div>

      <CodeBlock lines={run.code} label="The code to predict" />
      {run.notes.map((n) => (
        <p key={n} role="note" className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {n}
        </p>
      ))}

      <LiveAnnouncement text={said} />

      <PredictionPrompt className={touchButtons} resetKey={resetKey} question={run.question} options={options}>
        {({ committed }) => (
          <div className="space-y-4" data-testid="stream-reveal">
            <VerdictSignal options={options} committed={committed} onSay={setSaid} />
            <RevealHeading>Step through the stream</RevealHeading>
            <StepThrough key={resetKey} steps={steps} label="Streaming steps" />
            {run.unpack?.status === "not-modelled" ? (
              <p role="note" className="text-sm text-amber-900 dark:text-amber-100">
                {run.unpack.message}
              </p>
            ) : null}
            {run.compare.length > 1 ? <CompareList rows={run.compare} title="The same operands with each operator" /> : null}
          </div>
        )}
      </PredictionPrompt>
      <StartOver
        onClick={() => {
          applyPreset(initial.id);
          setAttempt((n) => n + 1);
        }}
      />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Cast mode
// ---------------------------------------------------------------------------

function CastLab({ preset }: { preset?: string }) {
  const initial = CAST_PRESETS.find((p) => p.id === preset) ?? CAST_PRESETS[0];
  const [presetId, setPresetId] = useState(initial.id);
  const [config, setConfig] = useState<CastConfig>(initial.config);
  const [attempt, setAttempt] = useState(0);
  const [said, setSaid] = useState("");
  const [compileRevealed, setCompileRevealed] = useState(false);
  const xId = useId();
  const run = useMemo(() => runCast(config), [config]);
  const resetKey = `${attempt}|${JSON.stringify(config)}`;
  const compileOptions = useMemo(() => toPredictionOptions(run.compileOptions, `c${resetKey}`), [run, resetKey]);
  const valueOptions = useMemo(() => toPredictionOptions(run.valueOptions, `v${resetKey}`), [run, resetKey]);
  const current = CAST_PRESETS.find((p) => p.id === presetId);
  const xAllowed = config.source === "rec";

  const applyPreset = (id: string) => {
    const p = CAST_PRESETS.find((x) => x.id === id);
    setPresetId(id);
    if (p) setConfig(p.config);
  };
  const change = (patch: Partial<CastConfig>) => {
    setPresetId("custom");
    setConfig((c) => {
      const next = { ...c, ...patch };
      return next.source === "rec" ? next : { ...next, xInAddr: false };
    });
  };

  return (
    <VisualFrame
      label="Stream pack lab: bit-stream casting"
      eyebrow="Experiment · predict then reveal"
      title="Change the shape, keep the order"
      summary="A bit-stream cast flattens the source into one packed value, first member in the most significant bits, and cuts it into the destination from the left; when either type is unpacked the sizes must be equal (IEEE 1800-2023 §6.24.3). Predict whether the cast compiles, then what it holds."
      fidelity="model"
      assumptions={CAST_ASSUMPTIONS}
      className={frameClass}
    >
      <div className={cn("space-y-3", touchButtons)}>
        <Field label="Preset">
          <select className={selectClass} value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            {CAST_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </Field>
        {current ? <p className="text-xs text-muted-foreground">For the lesson section: {current.section}.</p> : null}
        <Group label="Source">
          <SegmentedControl<CastSourceId> label="Source" mono value={config.source} onChange={(source) => change({ source })} options={CAST_SOURCE_IDS.map((id) => ({ value: id, label: CAST_SOURCE_LABELS[id] }))} />
        </Group>
        <Group label="Destination">
          <SegmentedControl<CastDestId> label="Destination" mono value={config.dest} onChange={(dest) => change({ dest })} options={CAST_DEST_IDS.map((id) => ({ value: id, label: CAST_DEST_LABELS[id] }))} />
        </Group>
        <div className="space-y-1">
          <label className={checkLabelClass}>
            <input
              type="checkbox"
              checked={config.xInAddr}
              disabled={!xAllowed}
              aria-describedby={xAllowed ? undefined : xId}
              onChange={(e) => change({ xInAddr: e.target.checked })}
              className="h-4 w-4 accent-cyan-500 disabled:opacity-40"
            />
            <span>
              Inject x into <code className={mono}>rec.addr[3:0]</code>
            </span>
          </label>
          {!xAllowed ? (
            <p id={xId} className="text-xs text-muted-foreground">
              {REC24_X_NOTE}
            </p>
          ) : null}
        </div>
      </div>

      <CodeBlock lines={run.code} label="The code to predict" />

      <LiveAnnouncement text={said} />

      <PredictionPrompt className={touchButtons} resetKey={`c${resetKey}`} question={run.compileQuestion} options={compileOptions}>
        {({ committed }) => (
          <div className="space-y-4" data-testid="compile-reveal">
            <VerdictSignal options={compileOptions} committed={committed} onSay={setSaid} />
            <CompileRevealSignal onChange={setCompileRevealed} />
            <RevealHeading testId="compile-heading">{run.result.compiles ? "It compiles" : "It does not compile"}</RevealHeading>
            {run.result.compiles ? (
              <p className="text-sm text-foreground">{run.result.message}</p>
            ) : (
              <>
                <p role="note" className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
                  <span aria-hidden>✕ </span>
                  {run.result.message}
                </p>
                <CastStrips run={run} showValue={false} />
                <CompareList rows={run.compare} title="Streaming handles what the cast cannot: each row assigns to a 32-bit word_t w" />
              </>
            )}
          </div>
        )}
      </PredictionPrompt>

      {run.result.compiles && compileRevealed ? (
        <PredictionPrompt className={touchButtons} resetKey={`v${resetKey}`} question={run.valueQuestion} options={valueOptions}>
          {({ committed }) => (
            <div className="space-y-4" data-testid="value-reveal">
              <VerdictSignal options={valueOptions} committed={committed} onSay={setSaid} />
              <RevealHeading testId="value-heading">How the cast moves the bits</RevealHeading>
              <p className="text-sm text-foreground">
                v = <code className={cn(mono, "font-semibold")}>{run.valueText}</code>
              </p>
              <CastStrips run={run} showValue />
              <CompareList rows={run.compare} title="The same source three ways: each row assigns to a 32-bit word_t w" />
            </div>
          )}
        </PredictionPrompt>
      ) : null}
      <StartOver
        onClick={() => {
          applyPreset(initial.id);
          setAttempt((n) => n + 1);
        }}
      />
    </VisualFrame>
  );
}

/** Mounted only inside the compile reveal, so the value prompt appears after it. */
function CompileRevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

function CastStrips({ run, showValue }: { run: ReturnType<typeof runCast>; showValue: boolean }) {
  const hasX = run.result.generic.some((b) => b.v === "x" || b.v === "z");
  // Before the value reveal the Cut step is hidden; the message is already shown above, so it is not repeated.
  const steps = showValue ? run.result.steps : run.result.steps.filter((s) => !s.startsWith("Cut") && s !== run.result.message);
  return (
    <div className={cn("space-y-3", panel)}>
      {steps.length > 0 ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground" aria-label="How the cast works">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ) : null}
      <div className="space-y-1">
        <p className={eyebrowClass}>Flattened {run.source.name}</p>
        <Strip bits={run.result.generic} label={`${run.source.name} flattened`} />
      </div>
      {showValue && run.result.value ? (
        <div className="space-y-1">
          <p className={eyebrowClass}>v, cut from the left</p>
          <Strip bits={run.result.value} label="v after the cast" />
        </div>
      ) : null}
      <BracketKey />
      {hasX ? <BitStripLegend items={["x"]} /> : null}
    </div>
  );
}

export default function StreamPackLab({ mode = "stream", preset }: StreamPackLabProps) {
  return mode === "cast" ? <CastLab preset={preset} /> : <StreamLab preset={preset} />;
}
