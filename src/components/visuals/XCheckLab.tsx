"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { CycleWaveform, type CycleMarker, type CycleSignal } from "@/components/visual-system/CycleWaveform";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePrefersReducedMotion } from "@/components/visual-system/usePlayback";
import { classifyValue, valueStyles } from "@/components/visual-system/visual-language";
import { BIT4_VALUES, type Bit4 } from "@/lib/sv-four-state-model";
import {
  CHECKER_FORMS,
  CHECKER_FORM_LABELS,
  CHECKER_PRESETS,
  CHECK_EDGES,
  CULPRITS,
  DEBUG_ASSUMPTION,
  DEBUG_EDGES,
  DEBUG_HINTS,
  DEBUG_SCENARIOS,
  FIX_IDS,
  FIX_LABELS,
  NO_FIXES,
  OPERATOR_BIT_WORD,
  checkerOptions,
  checkerSource,
  debugLogOptions,
  debugSource,
  evaluateChecker,
  findCheckerPreset,
  fixKey,
  gradeSuspects,
  matchingPreset,
  operatorBits,
  simulateStatusReg,
  sumLiteral,
  type CheckerConfig,
  type CheckerForm,
  type FixId,
  type FixSet,
  type SuspectId,
} from "@/lib/x-check-model";
import { cn } from "@/lib/utils";

export interface XCheckLabProps {
  /** "checker" (F2E: which counter moves) or "debug" (F2A: the reset bug nobody saw). */
  mode?: "checker" | "debug";
  /** checker: d10, d11, all-x, x-low (default), x-high, valid-x, int-copy. debug: status-reg (the only one). */
  preset?: string;
}

export const XCHECK_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §11.4.5 (==, !=, ===, !==), §12.4 (an x or z condition is false), §16.3 (immediate assert), §6.11.2 (2-state conversion), Table 6-7 (default values), §20.9 ($isunknown) and §20.10 ($error).",
  "The operators, the if rule, the 2-state copy and the default values come from the same four-state model as the F2A explorers, so the visuals cannot disagree.",
  "sum and e.sum are unsigned logic [8:0]. The checker runs once, on one edge with a result; the expected value is taken as already popped from the queue.",
  "With an else clause, an immediate assert runs that fail statement instead of the default $error (§16.3). $assertcontrol (§20.11) is not modelled.",
  DEBUG_ASSUMPTION,
];

const mono = "font-mono [font-variant-ligatures:none]";
const buttonClass =
  "inline-flex min-h-10 items-center rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const textButtonClass = "inline-flex min-h-10 items-center text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const panel = "rounded-xl border border-border/70 bg-background/50 p-3";
const touchButtons = "[@media(pointer:coarse)]:[&_button]:min-h-10";

/** Mounted only inside a revealed prompt, so the parent knows the answer is on screen. */
function RevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

function LiveAnnouncement({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only" data-testid="xcheck-live">
      {text}
    </p>
  );
}

function ClauseTag({ clause }: { clause: string }) {
  return <span className="rounded border border-border/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{clause}</span>;
}

/* ------------------------------------------------------------------ */
/* Checker mode                                                        */
/* ------------------------------------------------------------------ */

function BitEditor({ name, bits, onChange }: { name: string; bits: Bit4[]; onChange: (bits: Bit4[]) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={cn("text-sm font-semibold text-foreground", mono)}>{name}</span>
        <span className={cn("text-xs text-muted-foreground", mono)}>= {sumLiteral(bits)}</span>
      </div>
      <div role="group" aria-label={`Bits of ${name}, bit 8 first`} className="flex gap-1">
        {bits.map((bit, i) => {
          const index = bits.length - 1 - i;
          const next = BIT4_VALUES[(BIT4_VALUES.indexOf(bit) + 1) % BIT4_VALUES.length];
          return (
            <button
              // Keyed by position so focus stays on the bit while its value cycles.
              key={i}
              type="button"
              onClick={() => onChange(bits.map((b, k) => (k === i ? next : b)))}
              aria-label={`${name}[${index}] is ${bit}. Activate to change it to ${next}.`}
              className={cn(
                "h-10 w-7 rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                mono,
                valueStyles[classifyValue(bit)].className,
              )}
            >
              {bit}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const outcomeGlyph = { match: "=", mismatch: "≠", ambiguous: "?" } as const;
const outcomeClass = {
  match: "border-emerald-500/70 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  mismatch: "border-rose-500/70 bg-rose-500/10 text-rose-800 dark:text-rose-200",
  ambiguous: valueStyles.unknown.className,
} as const;

function OperatorBitTable({ config }: { config: CheckerConfig }) {
  const bits = operatorBits(config);
  const leftName = config.copyToInt ? "s" : "sum";
  const cell = "inline-flex h-6 w-5 items-center justify-center rounded border";
  return (
    <div className="overflow-x-auto">
      <table className={cn("border-collapse text-center text-xs", mono)}>
        <caption className="sr-only">
          {leftName} against e.sum bit by bit: {bits.map((b) => `bit ${b.index} ${b.left} vs ${b.right}, ${OPERATOR_BIT_WORD[b.outcome]}`).join("; ")}
        </caption>
        <thead aria-hidden>
          <tr>
            <th />
            {bits.map((b) => (
              <th key={b.index} className="text-[10px] font-normal text-muted-foreground">
                {b.index}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-hidden>
          {(["left", "right"] as const).map((side) => (
            <tr key={side}>
              <th className="pr-2 text-left text-[11px] font-normal text-muted-foreground">{side === "left" ? leftName : "e.sum"}</th>
              {bits.map((b) => (
                <td key={b.index} className="p-px">
                  <span className={cn(cell, valueStyles[classifyValue(b[side])].className)}>{b[side]}</span>
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th className="pr-2 text-left text-[11px] font-semibold text-foreground">bit</th>
            {bits.map((b) => (
              <td key={b.index} className="p-px">
                <span className={cn(cell, "font-semibold", outcomeClass[b.outcome])}>{outcomeGlyph[b.outcome]}</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-muted-foreground">= match, ≠ a known bit differs, ? unknown (x or z) against == or !=.</p>
    </div>
  );
}

const configKey = (c: CheckerConfig) => `${c.sum.join("")}|${c.exp.join("")}|${c.form}|${c.guard}|${c.outValid}|${c.copyToInt}`;

function CheckerLab({ preset }: { preset?: string }) {
  const reduced = usePrefersReducedMotion();
  const [config, setConfig] = useState<CheckerConfig>(() => findCheckerPreset(preset).config);
  const key = configKey(config);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setStep(0);
  }
  const revealed = revealedKey === key;
  const onReveal = useCallback((v: boolean) => setRevealedKey(v ? key : null), [key]);
  const result = useMemo(() => evaluateChecker(config), [config]);
  const options = useMemo(() => checkerOptions(config), [config]);
  const current = Math.min(step, result.steps.length - 1);
  const presetId = matchingPreset(config);
  const update = (patch: Partial<CheckerConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const lines: CodeTraceLine[] = checkerSource(config).map((l) => ({ key: l.key, text: l.text, owner: "testbench" }));
  const formControl = (line: CodeTraceLine) =>
    line.key === "check" ? (
      <select
        aria-label="Checker form"
        value={config.form}
        onChange={(e) => update({ form: e.target.value as CheckerForm })}
        className={cn("min-h-8 rounded border border-white/20 bg-slate-900 px-1 text-[11px] text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400", mono)}
      >
        {CHECKER_FORMS.map((f) => (
          <option key={f} value={f}>
            {CHECKER_FORM_LABELS[f]}
          </option>
        ))}
      </select>
    ) : null;

  const shown = result.steps.slice(0, current + 1);
  const done = current >= result.steps.length - 1;
  const announcement = revealed ? `Step ${current + 1} of ${result.steps.length}: ${result.steps[current].label} gives ${result.steps[current].value}. ${result.steps[current].text}${done ? ` ${result.verdictText}` : ""}` : "";

  return (
    <VisualFrame
      label="X check lab: which counter moves"
      eyebrow="Experiment · predict, then step"
      title="Does the X get counted?"
      summary="Set sum's 9 bits and the expected value, choose the checker form in the code, and predict which counter moves on this edge. The reveal steps through the operator, the branch and the counter, each with its clause."
      fidelity="model"
      assumptions={XCHECK_ASSUMPTIONS}
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rows of the lesson table, and two more ways X hides</p>
        <div role="group" aria-label="Presets" className={cn("flex flex-wrap gap-1.5", touchButtons)}>
          {CHECKER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={presetId === p.id}
              onClick={() => setConfig(p.config)}
              className={cn(
                "min-h-9 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                mono,
                presetId === p.id ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(panel, "space-y-3")}>
        <BitEditor name="sum" bits={config.sum} onChange={(sum) => update({ sum })} />
        <BitEditor name="e.sum" bits={config.exp} onChange={(exp) => update({ exp })} />
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
          <div className="space-y-1">
            <p className={cn("text-xs text-muted-foreground", mono)}>out_valid</p>
            <SegmentedControl<Bit4> label="out_valid" mono className={touchButtons} value={config.outValid} onChange={(outValid) => update({ outValid })} options={BIT4_VALUES.map((b) => ({ value: b, label: `1'b${b}` }))} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Guard</p>
            <SegmentedControl<"on" | "off">
              label="$isunknown(out_valid) guard"
              className={touchButtons}
              value={config.guard ? "on" : "off"}
              onChange={(v) => update({ guard: v === "on" })}
              options={[
                { value: "on", label: "with $isunknown" },
                { value: "off", label: "without" },
              ]}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">What the compare reads</p>
            <SegmentedControl<"logic" | "int">
              label="What the compare reads"
              className={touchButtons}
              value={config.copyToInt ? "int" : "logic"}
              onChange={(v) => update({ copyToInt: v === "int" })}
              options={[
                { value: "logic", label: "sum itself" },
                { value: "int", label: "an int copy s" },
              ]}
            />
          </div>
        </div>
      </div>

      <CodeTrace label="The checker, on one rising edge" lines={lines} activeKey={revealed ? result.steps[current].lineKey : undefined} renderLineControl={formControl} />

      <PredictionPrompt className={touchButtons} resetKey={key} question={<>On this edge, which counter moves?</>} options={options}>
        <RevealSignal onChange={onReveal} />
        <div className="space-y-3" data-testid="checker-reveal">
          <div role="group" aria-label="Reveal steps" className={cn("flex flex-wrap items-center gap-2", touchButtons)}>
            <button type="button" className={buttonClass} disabled={current <= 0} onClick={() => setStep(current - 1)} aria-label="Previous step">
              ←
            </button>
            <input
              type="range"
              min={0}
              max={result.steps.length - 1}
              value={current}
              onChange={(e) => setStep(Number(e.target.value))}
              aria-label="Reveal step"
              aria-valuetext={`Step ${current + 1} of ${result.steps.length}: ${result.steps[current].label}`}
              className="h-10 min-w-0 flex-1 accent-cyan-500"
            />
            <button type="button" className={buttonClass} disabled={done} onClick={() => setStep(current + 1)} aria-label="Next step">
              →
            </button>
            <button type="button" className={textButtonClass} disabled={done} onClick={() => setStep(result.steps.length - 1)}>
              Show every step
            </button>
          </div>
          <ol className="space-y-2" aria-label="Evaluation steps">
            {shown.map((s, i) => (
              <li
                key={`${s.kind}-${i}`}
                data-testid="check-step"
                className={cn(
                  "space-y-1 rounded-lg border p-3 text-sm",
                  i === current ? "border-cyan-500/60 bg-cyan-500/[0.06]" : "border-border/70",
                  !reduced && "transition-colors duration-200 motion-reduce:transition-none",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">{i + 1}.</span>
                  <code className={cn("text-xs text-foreground", mono)}>{s.label}</code>
                  <span aria-hidden>→</span>
                  <ValueChip value={s.value} />
                  <ClauseTag clause={s.clause} />
                </div>
                <p className="text-foreground">{s.text}</p>
                {s.kind === "operator" ? <OperatorBitTable config={config} /> : null}
              </li>
            ))}
          </ol>
          {done ? (
            <p
              data-testid="check-verdict"
              className={cn(
                "rounded-lg border p-3 text-sm font-semibold",
                result.verdict === "honest-pass" || result.verdict === "honest-fail" || result.verdict === "no-result"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                  : "border-rose-500/50 bg-rose-500/10 text-rose-900 dark:text-rose-100",
              )}
            >
              {result.verdictText}
            </p>
          ) : null}
        </div>
      </PredictionPrompt>
      <LiveAnnouncement text={announcement} />
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Debug mode                                                          */
/* ------------------------------------------------------------------ */

const codeOnly = (text: string) => text.replace(/\s*\/\/.*$/, "").trim();

function DebugLab() {
  const suspects = useMemo(() => gradeSuspects(), []);
  const [picked, setPicked] = useState<SuspectId | null>(null);
  const [found, setFound] = useState<readonly SuspectId[]>([]);
  const [skipped, setSkipped] = useState(false);
  const [fixes, setFixes] = useState<FixSet>(NO_FIXES);
  /** The log is given for the unfixed bench (the lesson prints it); every other fix state is predicted first. */
  const [revealedLogs, setRevealedLogs] = useState<readonly string[]>(["none"]);
  const [said, setSaid] = useState("");
  const [attempt, setAttempt] = useState(0);

  const huntDone = skipped || CULPRITS.every((c) => found.includes(c));
  const source = debugSource(fixes);
  const run = useMemo(() => simulateStatusReg(fixes), [fixes]);
  const key = fixKey(fixes);
  const logShown = revealedLogs.includes(key);
  /** The fix state whose prompt was answered last: its prompt stays on screen with its feedback until the fixes change. */
  const [answeredKey, setAnsweredKey] = useState<string | null>(null);
  const showPrompt = key !== "none" && (!logShown || answeredKey === key);
  const onReveal = useCallback(
    (v: boolean) => {
      if (!v) return;
      setAnsweredKey(key);
      setRevealedLogs((prev) => (prev.includes(key) ? prev : [...prev, key]));
    },
    [key],
  );
  const suspect = suspects.find((s) => s.id === picked) ?? null;
  const copyName = fixes.B ? "err_q" : "err_bit";

  const suspectRows = suspects
    .map((s) => ({ s, line: source.findIndex((l) => l.key === s.lineKey) }))
    .sort((a, b) => a.line - b.line);

  const choose = (id: SuspectId) => {
    const s = suspects.find((x) => x.id === id);
    if (!s) return;
    setPicked(id);
    if (s.verdict === "culprit") setFound((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSaid(`${s.verdict === "culprit" ? "Found." : "A decoy."} ${s.feedback} Model check: ${s.evidence}`);
  };
  const toggleFix = (id: FixId) => {
    const next = { ...fixes, [id]: !fixes[id] };
    setFixes(next);
    // A prompt only stays for the state it was answered in; coming back to a predicted state shows its log directly.
    setAnsweredKey(null);
    const nextKey = fixKey(next);
    setSaid(`${FIX_LABELS[id]} ${next[id] ? "applied" : "removed"}. ${revealedLogs.includes(nextKey) ? `Log: ${simulateStatusReg(next).summary}.` : "Predict the log before it runs."}`);
  };
  const startOver = () => {
    setPicked(null);
    setFound([]);
    setSkipped(false);
    setFixes(NO_FIXES);
    setRevealedLogs(["none"]);
    setAnsweredKey(null);
    setSaid("");
    setAttempt((n) => n + 1);
  };

  const lines: CodeTraceLine[] = source.map((l) => ({ key: l.key, text: l.text, owner: l.owner }));
  const signals: CycleSignal[] = [
    { name: "clk", kind: "clock" },
    { name: "rst_n", kind: "bit", values: run.rstN },
    { name: "set_err", kind: "bit", values: run.setErr },
    { name: "dut.err", kind: "bus", values: run.dutErr },
    { name: copyName, kind: "bus", values: run.copy },
    { name: "isunknown", kind: "bit", values: run.unknown },
  ];
  const markers: CycleMarker[] = logShown
    ? run.checks.map((c) => ({
        edge: c.edge,
        tone: c.counter === "pass" ? "pass" : "fail",
        short: c.counter === "pass" ? "pass" : "FAIL",
        label: `Edge ${c.edge}: ${copyName} ${c.op} 1'b0 is ${c.result}, ${c.branch} branch, ${c.counter === "pass" ? "pass_cnt++" : "fail_cnt++ and $error"}`,
      }))
    : [];
  const fixLabelText = FIX_IDS.filter((id) => fixes[id]).map((id) => FIX_LABELS[id]);

  return (
    <VisualFrame
      label="X check lab: the reset bug nobody saw"
      eyebrow="Debug it · find, fix, predict"
      title="The reset bug nobody saw"
      summary="The log says PASS=3 FAIL=0, yet dut.err is x from the first edge. Pick the lines that hide the bug, then apply fixes one at a time and predict each log before it runs."
      fidelity="model"
      assumptions={XCHECK_ASSUMPTIONS}
    >
      <CodeTrace label="status_reg and tb_top" lines={lines} activeKey={suspect ? suspect.lineKey : undefined} />

      <section aria-label="Find the lines" className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Which lines create the x, erase it, and would still hide it? Pick suspects one by one.</p>
        <ul className="space-y-2" aria-label="Suspect lines">
          {suspectRows.map(({ s, line }) => {
            const isFound = found.includes(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => choose(s.id)}
                  aria-pressed={picked === s.id}
                  aria-label={`Suspect line ${line + 1}: ${codeOnly(source[line].text)}${isFound ? ", found" : ""}`}
                  className={cn(buttonClass, "w-full justify-between gap-3", picked === s.id && "border-amber-500 bg-amber-500/15")}
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      line {line + 1}, {source[line].owner === "design" ? "status_reg" : "tb_top"}
                    </span>
                    <code className={cn("block break-words text-xs", mono)}>{codeOnly(source[line].text)}</code>
                  </span>
                  {isFound ? (
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">✓ found</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {suspect ? (
          <div
            data-testid="suspect-verdict"
            className={cn("space-y-1 rounded-lg border p-3 text-sm", suspect.verdict === "culprit" ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10")}
          >
            <p className="font-semibold text-foreground">{suspect.verdict === "culprit" ? `Culprit: it ${suspect.role} the x.` : "A decoy."}</p>
            <p className="text-foreground">{suspect.feedback}</p>
            <p className="text-xs text-muted-foreground">Model check: {suspect.evidence}</p>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground" data-testid="hunt-progress">
          Culprits found: {CULPRITS.filter((c) => found.includes(c)).length} of {CULPRITS.length}
        </p>
        {!huntDone ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <HintLadder hints={[...DEBUG_HINTS]} resetKey={String(attempt)} className={cn("min-w-0 flex-1", touchButtons)} />
            <button type="button" className={textButtonClass} onClick={() => setSkipped(true)}>
              Skip the hunt and go to the fixes
            </button>
          </div>
        ) : null}
      </section>

      {huntDone ? (
        <section aria-label="Apply fixes" className="space-y-3" data-testid="fix-panel">
          <p className="text-sm font-semibold text-foreground">Apply fixes one at a time. Try (B) alone, then (C) alone, then both, then (A) as well.</p>
          <div role="group" aria-label="Fixes" className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
            {FIX_IDS.map((id) => (
              <button key={id} type="button" aria-pressed={fixes[id]} onClick={() => toggleFix(id)} className={cn(buttonClass, fixes[id] && "border-cyan-500 bg-cyan-500/10")}>
                <span aria-hidden className="mr-2">
                  {fixes[id] ? "☑" : "☐"}
                </span>
                {FIX_LABELS[id]}
              </button>
            ))}
          </div>
          <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground" aria-label="Fix states predicted">
            {DEBUG_SCENARIOS.filter((s) => s.id !== "none").map((s) => (
              <li key={s.id} className="rounded-full border border-border/70 px-2 py-0.5">
                {s.id === "ABC" ? "A, B and C" : s.id.split("").join(" and ")}: {revealedLogs.includes(s.id) ? "✓ predicted" : "not yet"}
              </li>
            ))}
          </ul>
          <CycleWaveform
            title="status_reg run, edges 0 to 4"
            caption={`Each column is one rising edge, 0 to ${DEBUG_EDGES - 1}, with the value the edge samples. Hatched cells are x. isunknown is $isunknown(dut.err); ${copyName} is the monitor's copy as each check sees it. The checks run at edges ${CHECK_EDGES.join(", ")}${
              logShown ? ": ✓ marks a pass and ✕ a failure." : "; their marks appear once the log is revealed."
            }`}
            edges={DEBUG_EDGES}
            signals={signals}
            markers={markers}
          />
          {showPrompt ? (
            <PredictionPrompt
              className={touchButtons}
              resetKey={`${attempt}|${key}`}
              question={<>With {fixLabelText.length ? fixLabelText.join(", ") : "no fix"}, what does the log say?</>}
              options={debugLogOptions(fixes)}
            >
              <RevealSignal onChange={onReveal} />
            </PredictionPrompt>
          ) : null}
          {logShown ? (
            <div data-testid="debug-log" className="space-y-2">
              <pre aria-label="Simulation log" className={cn("overflow-x-auto rounded-lg border border-border/70 bg-slate-950/90 px-3 py-2 text-xs text-slate-100", mono)}>
                {run.log.map((l) => (l.kind === "error" ? `Error @ edge ${l.edge}: ${l.text}` : l.text)).join("\n")}
              </pre>
              <p className="text-[11px] text-muted-foreground">The prefix of each $error line is tool-specific (§20.10); the user text and the $display line are exact.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <LiveAnnouncement text={said} />
      <button type="button" className={textButtonClass} onClick={startOver}>
        Start over
      </button>
    </VisualFrame>
  );
}

export default function XCheckLab({ mode = "checker", preset }: XCheckLabProps) {
  if (mode === "debug") return <DebugLab />;
  return <CheckerLab preset={preset} />;
}
