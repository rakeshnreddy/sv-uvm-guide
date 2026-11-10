"use client";

import React, { useEffect, useId, useMemo, useState } from "react";

import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl, type SegmentOption } from "@/components/visual-system/SegmentedControl";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  CHECKER_IDENTIFIERS,
  CHECKER_PRESETS,
  CHRONOLOGICAL_SPECIFIERS,
  KEYWORD_TABLES,
  LINEAGE_STOPS,
  LINEAGE_YEARS,
  NOCONFIG_EXCLUDED,
  REGION_SCENARIOS,
  SPECIFIER_INFO,
  acceptanceSentence,
  classifyToken,
  designationYear,
  isVersionSpecifier,
  lineagePredictions,
  parseVersionSpecifier,
  regionGate,
  reservedWords,
  scenarioSteps,
  settingLabel,
  tableAddedBy,
  tableSentence,
  unmatchedAtEnd,
  verdictWord,
  wrongChoiceFeedback,
  type KeywordSetting,
  type KeywordVerdict,
  type LineageStop,
  type RegionStep,
  type TableId,
  type VersionSpecifier,
} from "@/lib/sv-keyword-model";
import { cn } from "@/lib/utils";

export type KeywordSetExplorerMode = "checker" | "regions" | "lineage";

export interface KeywordSetExplorerProps {
  /** checker: one word under one keyword set; regions: step through files; lineage: the standards timeline. */
  mode?: KeywordSetExplorerMode;
  /** checker: drill | reverse | noconfig | escaped | no-directive. regions: legacy_cnt | nested_stack. lineage: standards. */
  preset?: string;
}

export const KEYWORD_ASSUMPTIONS: Record<KeywordSetExplorerMode, string[]> = {
  checker: [
    "Implements IEEE 1800-2023 22.14 with Tables 22-1 to 22-6, 5.6, 5.6.1 and 5.6.2. It checks one token; it does not parse the code around it.",
    "With no directive, the keyword set is the implementation's default, which the standard leaves implementation dependent (22.14). The model does not guess it.",
    "Tools may define their own version specifiers (22.14); only the nine of Syntax 22-10 are known here.",
  ],
  regions: [
    "Implements the 22.14 stack: a push lasts across file boundaries until its `end_keywords, pairs nest, and `resetall does not affect them.",
    "Files are read in the order shown, in one compilation. Which keyword set a file with no directive gets is implementation dependent (22.14); the scenario states its assumption and lets you drop it.",
    "Only the watched word is tagged; the rest of each line is not parsed.",
  ],
  lineage: [
    "Years are taken from the standard designations only. Pre-IEEE names carry no date and sit just before the standard they led to.",
    "The two lanes are read separately: a row shares a designation year, not a month.",
    "Sources: IEEE 1800-2023 1.3 NOTE, 1.4 and 22.14; IEEE 1800.2-2020 front matter, Introduction and Clause 2; the uvm-core 2020.3.1 README.",
  ],
};

const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border/70 bg-background/40 p-3";
const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-border/70 bg-background/60 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

/** Screen-reader announcement of the current state. */
function LiveSummary({ text, testId }: { text: string; testId?: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only" data-testid={testId}>
      {text}
    </p>
  );
}

/** Rendered inside a PredictionPrompt's reveal: tells the parent the answer is out. */
function OnReveal({ onReveal }: { onReveal: () => void }) {
  useEffect(() => {
    onReveal();
  }, [onReveal]);
  return null;
}

const VERDICT_STYLE: Record<KeywordVerdict["verdict"], { glyph: string; className: string; label: string }> = {
  keyword: { glyph: "■", className: "border-violet-500/60 bg-violet-500/10 text-violet-800 dark:text-violet-200", label: "Reserved keyword" },
  identifier: { glyph: "○", className: "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200", label: "Ordinary identifier" },
  "implementation-dependent": { glyph: "?", className: "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100", label: "Tool default: implementation dependent" },
  "not-an-identifier": { glyph: "✕", className: "border-rose-500/60 bg-rose-500/10 text-rose-800 dark:text-rose-200", label: "Not an identifier" },
};

function TokenTag({ result, text }: { result: KeywordVerdict; text: string }) {
  const style = VERDICT_STYLE[result.verdict];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium", style.className)}>
      <span aria-hidden>{style.glyph}</span>
      <code className={mono}>{text}</code>
      <span>: {verdictWord(result)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Nested rings: the cumulative sets
// ---------------------------------------------------------------------------

interface RingsProps {
  specifier: VersionSpecifier | null;
  /** The table where the word entered; highlighted only after a reveal. */
  entered: TableId | null;
  /** The word sits in a table but the noconfig variant excludes it. */
  excluded?: boolean;
  /** A label for the word, e.g. logic. */
  word?: string;
}

/** Tables 22-1 (innermost) to 22-6 (outermost); rings in the chosen set are lit. */
export function KeywordRings({ specifier, entered, excluded = false, word }: RingsProps) {
  const included = new Set<TableId>(specifier ? SPECIFIER_INFO[specifier].tables : []);
  const noconfig = specifier === "1364-2001-noconfig";
  const description = [
    specifier ? `"${specifier}" includes ${[...included].map((t) => `Table ${t}`).join(", ")}${noconfig ? `, minus ${NOCONFIG_EXCLUDED.length} configuration words` : ""}.` : "No set chosen: the tool default is implementation dependent.",
    entered && word ? `${word} entered in Table ${entered}${excluded ? ", but this set excludes it" : ""}.` : word ? `${word} is in no table.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ring = (index: number): React.ReactNode => {
    const table = KEYWORD_TABLES[index];
    const lit = included.has(table.id);
    const isEntry = entered === table.id;
    return (
      <div
        className={cn(
          "rounded-xl border-2 p-1.5 sm:p-2",
          lit ? "border-cyan-500/70 bg-cyan-500/[0.06]" : "border-dashed border-border/70 bg-transparent",
          isEntry && "border-amber-500 ring-2 ring-amber-500/40",
        )}
        data-testid={`ring-${table.id}`}
        data-lit={lit}
        data-entry={isEntry}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 pb-1 text-[11px]">
          <span className={cn("font-semibold", lit ? "text-foreground" : "text-muted-foreground")}>Table {table.id}</span>
          <span className={cn(mono, "text-muted-foreground")}>{table.revision}</span>
          <span className="tabular-nums text-muted-foreground">+{table.words.length}</span>
          {table.id === "22-2" && noconfig ? <span className="text-amber-800 dark:text-amber-200">−{NOCONFIG_EXCLUDED.length} config words (22.14.4)</span> : null}
          {isEntry ? (
            <span className="rounded bg-amber-500/20 px-1 font-semibold text-amber-900 dark:text-amber-100">
              ◆ {word} entered here{excluded ? ", excluded by noconfig" : ""}
            </span>
          ) : null}
        </div>
        {index > 0 ? ring(index - 1) : null}
      </div>
    );
  };

  return (
    <figure className="space-y-1" aria-label="Cumulative keyword sets">
      <div role="img" aria-label={description}>
        {ring(KEYWORD_TABLES.length - 1)}
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Inner ring first: each version reserves its own table plus every ring inside it (22.14.2 to 22.14.8). &quot;1800-2017&quot; and &quot;1800-2023&quot; add no ring (22.14.9).
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// checker
// ---------------------------------------------------------------------------

const DEFAULT_KEY = "default";
const TYPED_KEY = "__typed";

const settingKey = (s: KeywordSetting) => (s.kind === "directive" ? s.specifier : DEFAULT_KEY);

function CheckerView({ preset }: { preset?: string }) {
  const initial = CHECKER_PRESETS[preset ?? ""] ?? CHECKER_PRESETS.drill;
  const [setting, setSetting] = useState<KeywordSetting>(initial.setting);
  const [token, setToken] = useState(initial.token);
  const [specText, setSpecText] = useState("");
  const [specError, setSpecError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const specInputId = useId();
  const tokenInputId = useId();

  const result = classifyToken(token, setting);
  const spec = setting.kind === "directive" ? setting.specifier : null;
  const resetKey = `${settingKey(setting)}|${token}`;
  const revealed = revealedKey === resetKey;
  const isListed = (CHECKER_IDENTIFIERS as readonly string[]).includes(token);
  const display = result.token.text || token;
  const onReveal = React.useCallback(() => setRevealedKey(resetKey), [resetKey]);
  const empty = token.trim() === "";

  const settingOptions: SegmentOption<string>[] = [
    { value: DEFAULT_KEY, label: "no directive" },
    ...CHRONOLOGICAL_SPECIFIERS.map((s) => ({ value: s, label: s })),
  ];
  const tokenOptions: SegmentOption<string>[] = [
    ...CHECKER_IDENTIFIERS.map((w) => ({ value: w, label: w, ariaLabel: w.startsWith("\\") ? `${w} (escaped)` : undefined })),
    { value: TYPED_KEY, label: "type your own", ariaLabel: "Type your own identifier" },
  ];

  const options: PredictionOption[] = [
    {
      id: "keyword",
      label: "Reserved keyword",
      correct: result.verdict === "keyword",
      feedback: result.verdict === "keyword" ? result.reasons.join(" ") : wrongChoiceFeedback(result),
    },
    {
      id: "identifier",
      label: "Ordinary identifier",
      correct: result.verdict === "identifier",
      feedback: result.verdict === "identifier" ? result.reasons.join(" ") : wrongChoiceFeedback(result),
    },
  ];

  const applySpecText = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseVersionSpecifier(specText);
    if (parsed.ok) {
      setSpecError(null);
      setSetting({ kind: "directive", specifier: parsed.specifier });
    } else {
      setSpecError(parsed.message);
    }
  };

  const setSummary = spec
    ? `"${spec}" reserves ${reservedWords(spec).size} words: Tables ${SPECIFIER_INFO[spec].tables[0]} to ${SPECIFIER_INFO[spec].tables[SPECIFIER_INFO[spec].tables.length - 1]}${spec === "1364-2001-noconfig" ? `, minus ${NOCONFIG_EXCLUDED.length} configuration words` : ""} (${SPECIFIER_INFO[spec].clause}).`
    : "No directive: the reserved list is the implementation's default set (22.14).";

  return (
    <VisualFrame
      label="Keyword set checker"
      eyebrow="Experiment · predict then reveal"
      title="Is it a keyword under this set?"
      summary="Pick the `begin_keywords version in effect and a word, then predict whether the word is reserved (IEEE 1800-2023 22.14, Tables 22-1 to 22-6)."
      fidelity="model"
      assumptions={KEYWORD_ASSUMPTIONS.checker}
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">1. Keyword set in effect</p>
        <SegmentedControl
          label="Keyword set in effect"
          options={settingOptions}
          value={settingKey(setting)}
          mono
          onChange={(v) => {
            setSpecError(null);
            setSetting(v === DEFAULT_KEY ? { kind: "default", assumed: null } : isVersionSpecifier(v) ? { kind: "directive", specifier: v } : setting);
          }}
        />
        <form onSubmit={applySpecText} className="flex flex-wrap items-end gap-2">
          <label htmlFor={specInputId} className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
            Or type a <code className={mono}>`begin_keywords</code> string
            <input
              id={specInputId}
              className={cn(inputClass, mono, "mt-1")}
              value={specText}
              placeholder='"1364-2000"'
              onChange={(e) => setSpecText(e.target.value)}
              aria-describedby={specError ? `${specInputId}-error` : undefined}
              aria-invalid={specError ? true : undefined}
            />
          </label>
          <button type="submit" className={buttonClass}>
            Apply
          </button>
        </form>
        {specError ? (
          <p id={`${specInputId}-error`} role="alert" className="rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
            <span aria-hidden>✕ </span>Error. {specError}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground" data-testid="set-summary">
          {setSummary}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">2. Identifier</p>
        <SegmentedControl label="Identifier to check" options={tokenOptions} value={isListed ? token : TYPED_KEY} mono onChange={(v) => setToken(v === TYPED_KEY ? (isListed ? "" : token) : v)} />
        <label htmlFor={tokenInputId} className="block text-xs text-muted-foreground">
          Identifier as written (a leading backslash escapes it)
          <input id={tokenInputId} className={cn(inputClass, mono, "mt-1")} value={token} onChange={(e) => setToken(e.target.value)} spellCheck={false} autoComplete="off" />
        </label>
      </div>

      <LiveSummary text={`Set: ${settingLabel(setting)}. Identifier: ${display || "none"}.${revealed || result.verdict === "implementation-dependent" || result.verdict === "not-an-identifier" ? ` ${result.headline}.` : ""}`} testId="checker-live" />

      {empty ? (
        <p className="rounded-lg border border-dashed border-border/70 p-3 text-sm text-muted-foreground" data-testid="empty-hint">
          Type an identifier above, such as <code className={mono}>my_signal</code> or an escaped <code className={mono}>{"\\soft"}</code>.
        </p>
      ) : result.verdict === "not-an-identifier" ? (
        <div className={cn("rounded-xl border p-3 text-sm", VERDICT_STYLE["not-an-identifier"].className)} data-testid="not-identifier-card">
          <p className="font-semibold">
            <span aria-hidden>✕ </span>
            {result.headline}
          </p>
          <p className="mt-1">{result.reasons.join(" ")}</p>
        </div>
      ) : result.verdict === "implementation-dependent" ? (
        <div className="space-y-3" data-testid="default-card">
          <div className={cn("rounded-xl border p-3 text-sm", VERDICT_STYLE["implementation-dependent"].className)}>
            <p className="font-semibold">
              <span aria-hidden>? </span>Tool default: implementation dependent
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <KeywordRings specifier={null} entered={result.enteredIn?.id ?? null} word={result.token.form === "invalid" ? undefined : result.token.name} />
        </div>
      ) : (
        <PredictionPrompt
          resetKey={resetKey}
          question={
            <>
              Under {spec ? <code className={mono}>{`\`begin_keywords "${spec}"`}</code> : "the tool default"}, is <code className={mono}>{display}</code> a reserved keyword or an ordinary identifier?
            </>
          }
          options={options}
        >
          <div className="space-y-3" data-testid="checker-reveal">
            <OnReveal onReveal={onReveal} />
            <p className={cn("inline-flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold", VERDICT_STYLE[result.verdict].className)}>
              <span aria-hidden>{VERDICT_STYLE[result.verdict].glyph}</span>
              {VERDICT_STYLE[result.verdict].label}: {result.headline}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground" data-testid="acceptance">
              {acceptanceSentence(result)}
            </p>
            <KeywordRings
              specifier={spec}
              entered={result.enteredIn?.id ?? null}
              excluded={result.excludedByNoconfig}
              word={result.token.form === "invalid" ? undefined : result.token.text}
            />
          </div>
        </PredictionPrompt>
      )}
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// regions
// ---------------------------------------------------------------------------

const EVENT_LABEL: Record<RegionStep["event"], string> = {
  line: "line",
  push: "push",
  pop: "pop",
  resetall: "`resetall",
  "file-boundary": "file boundary",
  error: "error",
};

function StackView({ step, base }: { step: RegionStep; base: KeywordSetting }) {
  const baseInEffect = step.stack.length === 0;
  const bottomLabel = settingLabel(base);
  return (
    <div className={cn(panel, "space-y-2")} data-testid="keyword-stack">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Keyword-set stack</p>
      <ol className="flex flex-col-reverse gap-1.5" aria-label="Keyword-set stack, bottom first">
        <li className={cn("rounded-lg border border-dashed px-2 py-1 text-xs", baseInEffect ? "border-cyan-500/70 bg-cyan-500/10 font-semibold text-foreground" : "border-border/70 text-muted-foreground")}>
          bottom: {bottomLabel}
          {baseInEffect ? <span className="ml-1">◀ in effect</span> : null}
        </li>
        {step.stack.map((s, i) => {
          const top = i === step.stack.length - 1;
          return (
            <li key={`${s}-${i}`} className={cn("rounded-lg border px-2 py-1 text-xs", top ? "border-cyan-500/70 bg-cyan-500/10 font-semibold text-foreground" : "border-border/70 text-muted-foreground")}>
              <code className={mono}>{`"${s}"`}</code>
              {top ? <span className="ml-1">◀ in effect</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RegionsView({ preset }: { preset?: string }) {
  const [scenarioId, setScenarioId] = useState(REGION_SCENARIOS[preset ?? ""] ? (preset as string) : "legacy_cnt");
  const scenario = REGION_SCENARIOS[scenarioId];
  const [assumption, setAssumption] = useState<string>(scenario.defaultAssumption ?? "unknown");
  const assumed: VersionSpecifier | null = isVersionSpecifier(assumption) ? assumption : null;
  const steps = useMemo(() => scenarioSteps(scenario, assumed), [scenario, assumed]);
  const gate = useMemo(() => regionGate(scenario, steps), [scenario, steps]);
  const key = `${scenario.id}|${assumption}`;
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const revealed = !gate || revealedKey === key;
  const playback = usePlayback(steps.length, key);
  const limit = revealed || !gate ? steps.length - 1 : gate.stepIndex;
  const shown = Math.min(playback.index, limit);
  const step = steps[shown];
  const atGate = Boolean(gate) && playback.index >= (gate?.stepIndex ?? Infinity);
  const blocked = !revealed && playback.index > limit;
  const unmatched = unmatchedAtEnd(steps);
  const onReveal = React.useCallback(() => setRevealedKey(key), [key]);

  useEffect(() => {
    if (blocked && playback.isPlaying) playback.pause();
  }, [blocked, playback]);

  const files = scenario.files.map((f) => ({
    name: f.name,
    steps: steps.filter((s) => s.file === f.name && s.lineNumber !== null),
  }));

  const promptOptions: PredictionOption[] = gate ? gate.options.map((o) => ({ ...o })) : [];

  return (
    <VisualFrame
      label="Keyword regions stepper"
      eyebrow="Step through · predict then reveal"
      title="Which keyword set covers each line?"
      summary="Step line by line and watch `begin_keywords push a set and `end_keywords pop it (IEEE 1800-2023 22.14). Each watched word is tagged by the set in effect."
      fidelity="model"
      assumptions={[...KEYWORD_ASSUMPTIONS.regions, ...scenario.notes]}
    >
      <SegmentedControl
        label="Scenario"
        options={Object.values(REGION_SCENARIOS).map((s) => ({ value: s.id, label: s.title }))}
        value={scenarioId}
        onChange={(v) => {
          setScenarioId(v);
          setAssumption(REGION_SCENARIOS[v].defaultAssumption ?? "unknown");
        }}
      />
      <p className="text-sm text-muted-foreground">{scenario.summary}</p>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground">Tool default for code outside any pair (22.14: implementation dependent)</p>
        <SegmentedControl
          label="Tool default keyword set"
          options={[
            { value: "1800-2023", label: 'assume "1800-2023"' },
            { value: "unknown", label: "unknown" },
          ]}
          value={assumption}
          onChange={setAssumption}
        />
      </div>

      <PlaybackControls playback={playback} stepCount={steps.length} stepNoun="Line" describeStep={(i) => (i > limit ? "hidden until you predict" : `${steps[i].file} ${steps[i].lineNumber ?? "boundary"}: ${EVENT_LABEL[steps[i].event]}`)} />

      <LiveSummary text={blocked ? "Predict before stepping further." : `${step.file}${step.lineNumber ? ` line ${step.lineNumber}` : ""}, ${EVENT_LABEL[step.event]}. ${step.note}`} testId="regions-live" />

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="min-w-0 space-y-3">
          {files.map((file) => {
            const boundary = steps.find((s) => s.event === "file-boundary" && s.file === file.name);
            const fileHidden = file.steps.every((s) => s.index > limit);
            return (
              <div key={file.name} className="min-w-0">
                {boundary ? (
                  <p
                    className={cn("mb-2 rounded border border-dashed px-2 py-1 text-center text-[11px]", shown === boundary.index ? "border-cyan-500 bg-cyan-500/10 text-foreground" : "border-border/70 text-muted-foreground")}
                    aria-current={shown === boundary.index ? "step" : undefined}
                  >
                    {boundary.index > limit ? "file boundary" : boundary.text}
                  </p>
                ) : null}
                <p className={cn("mb-1 text-xs font-semibold text-foreground", mono)}>{file.name}</p>
                {fileHidden ? (
                  <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground" data-testid="hidden-file">
                    {file.name} appears after you predict.
                  </p>
                ) : (
                  <ol className="overflow-hidden rounded-lg bg-slate-950/90 py-1 text-[12px] leading-5 text-slate-100">
                    {file.steps.map((s) => {
                      if (s.index > limit) return null;
                      const current = s.index === shown;
                      const visited = s.index <= shown;
                      return (
                        <li
                          key={s.index}
                          className={cn("px-2", current && "bg-cyan-500/25", s.event === "error" && visited && "bg-rose-500/25")}
                          aria-current={current ? "step" : undefined}
                        >
                          <div className="flex min-w-0 gap-2">
                            <span className="w-5 shrink-0 select-none text-right text-slate-400 tabular-nums" aria-hidden>
                              {s.lineNumber}
                            </span>
                            <code className={cn(mono, "min-w-0 whitespace-pre-wrap break-all")}>{s.text}</code>
                          </div>
                          {visited && (s.tokens.length > 0 || s.event !== "line") ? (
                            <div className="flex flex-wrap gap-1 pb-1 pl-7">
                              {s.event !== "line" ? (
                                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", s.event === "error" ? "bg-rose-500/30 text-rose-100" : "bg-cyan-500/30 text-cyan-50")}>
                                  {EVENT_LABEL[s.event]}
                                </span>
                              ) : null}
                              {s.tokens.map((t) => (
                                <span key={t.start} className="rounded bg-background">
                                  <TokenTag result={t.result} text={t.text} />
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
        <div className="min-w-0 space-y-3">
          <StackView step={step} base={{ kind: "default", assumed }} />
          <div className={cn(panel, "text-sm")} data-testid="step-note">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {step.file}
              {step.lineNumber ? `, line ${step.lineNumber}` : ""} · {EVENT_LABEL[step.event]}
            </p>
            <p className="mt-1 text-foreground">{step.note}</p>
          </div>
          {revealed && shown === steps.length - 1 ? (
            <p className="text-xs text-muted-foreground" data-testid="end-note">
              {unmatched.length
                ? `End of input with ${unmatched.length} open pair${unmatched.length > 1 ? "s" : ""}: each \`begin_keywords needs a matching \`end_keywords later (22.14).`
                : "End of input: every pair was matched (22.14)."}
            </p>
          ) : null}
        </div>
      </div>

      {gate && (atGate || revealed) ? (
        <PredictionPrompt resetKey={key} question={gate.question} options={promptOptions}>
          <OnReveal onReveal={onReveal} />
          <p className="text-sm text-muted-foreground">Step on: the rest of the input is now shown.</p>
        </PredictionPrompt>
      ) : null}
      {blocked ? (
        <p className="text-xs text-amber-900 dark:text-amber-100" data-testid="blocked-note">
          Predict above before stepping further.
        </p>
      ) : null}
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// lineage
// ---------------------------------------------------------------------------

/** Pre-IEEE stops sit in the row of the next IEEE stop in their lane. */
function rowYear(stop: LineageStop): number | null {
  const own = designationYear(stop);
  if (own !== null) return own;
  const after = LINEAGE_STOPS.slice(LINEAGE_STOPS.indexOf(stop) + 1).find((s) => s.lane === stop.lane && s.ieee);
  return after ? designationYear(after) : null;
}

const LANES: { id: LineageStop["lane"]; label: string }[] = [
  { id: "systemverilog", label: "Verilog → SystemVerilog" },
  { id: "uvm", label: "UVM" },
];

function TableBars({ highlight }: { highlight: TableId | null }) {
  const max = Math.max(...KEYWORD_TABLES.map((t) => t.words.length));
  return (
    <figure className="space-y-1">
      <ul className="space-y-1" aria-label="Words added by each keyword table">
        {KEYWORD_TABLES.map((t) => {
          const lit = t.id === highlight;
          return (
            <li key={t.id} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2 text-[11px]" data-testid={`bar-${t.id}`} data-lit={lit}>
              <span className={cn(lit ? "font-semibold text-foreground" : "text-muted-foreground")}>
                Table {t.id}
              </span>
              <span className="h-3 rounded bg-muted/40" aria-hidden>
                <span className={cn("block h-3 rounded", lit ? "bg-amber-500" : "bg-cyan-500/40")} style={{ width: `${Math.max(2, (t.words.length / max) * 100)}%` }} />
              </span>
              <span className="text-right tabular-nums text-muted-foreground">
                {t.words.length}
                <span className="sr-only"> words, {t.revision}{lit ? ", added by this revision" : ""}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <figcaption className="text-xs text-muted-foreground">Words each table lists (22.14.2 to 22.14.8); Table 22-1 is the base list.</figcaption>
    </figure>
  );
}

function LineageView() {
  const predictions = useMemo(() => lineagePredictions(), []);
  const [revealedCount, setRevealedCount] = useState(0);
  const playback = usePlayback(LINEAGE_STOPS.length);
  const stop = LINEAGE_STOPS[playback.index];
  const table = tableAddedBy(stop);
  const year = designationYear(stop);
  const reveal1 = React.useCallback(() => setRevealedCount((n) => Math.max(n, 1)), []);
  const reveal2 = React.useCallback(() => setRevealedCount((n) => Math.max(n, 2)), []);

  return (
    <VisualFrame
      label="Standards lineage timeline"
      eyebrow="Step through · predict then reveal"
      title="Which documents define the language, revision by revision"
      summary="Two lanes: the Verilog and SystemVerilog standards, and the UVM standards. At each stop: which documents define the whole language, and which keyword table that revision added (IEEE 1800-2023 1.3 NOTE, 22.14)."
      fidelity="model"
      assumptions={KEYWORD_ASSUMPTIONS.lineage}
    >
      <PredictionPrompt question={predictions[0].question} options={predictions[0].options}>
        <OnReveal onReveal={reveal1} />
      </PredictionPrompt>
      {revealedCount >= 1 ? (
        <PredictionPrompt question={predictions[1].question} options={predictions[1].options}>
          <OnReveal onReveal={reveal2} />
        </PredictionPrompt>
      ) : null}

      {revealedCount >= 2 ? (
        <div className="space-y-3" data-testid="lineage-timeline">
          <PlaybackControls playback={playback} stepCount={LINEAGE_STOPS.length} stepNoun="Stop" describeStep={(i) => LINEAGE_STOPS[i].label} />
          <LiveSummary text={`${stop.label}. ${stop.documents.join(" and ")}. ${tableSentence(stop)}`} testId="lineage-live" />

          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs" role="group" aria-label="Standards by designation year; choose one to jump to it">
            <span aria-hidden />
            {LANES.map((l) => (
              <span key={l.id} className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" aria-hidden>
                {l.label}
              </span>
            ))}
            {LINEAGE_YEARS.map((y) => (
              <React.Fragment key={y}>
                <span className="pt-1 font-mono tabular-nums text-muted-foreground" aria-hidden>
                  {y}
                </span>
                {LANES.map((lane) => (
                  <div key={lane.id} className="flex min-w-0 flex-col gap-1 border-l border-border/60 pl-2">
                    {LINEAGE_STOPS.filter((s) => s.lane === lane.id && rowYear(s) === y).map((s) => {
                      const i = LINEAGE_STOPS.indexOf(s);
                      const current = i === playback.index;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => playback.seek(i)}
                          aria-current={current ? "step" : undefined}
                          aria-label={`${s.label}${s.ieee ? "" : ", pre-IEEE, no date"}`}
                          className={cn(
                            "min-h-9 rounded-lg border px-2 py-1 text-left leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                            s.ieee ? "border-solid" : "border-dashed italic",
                            current ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <span className="break-words">{s.label}</span>
                          {!s.ieee ? <span className="block text-[10px] not-italic">precursor, no date</span> : null}
                          {s.attachments.length ? <span className="block text-[10px]">+ uvm-core 2020.3.1</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>

          <div className={cn(panel, "space-y-3")} data-testid="lineage-panel">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {stop.lane === "uvm" ? "UVM lane" : "SystemVerilog lane"} · {year ? `designation year ${year}` : "no date: placed in order only"}
              </p>
              <h4 className="text-base font-semibold text-foreground">{stop.label}</h4>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Which document(s) define the whole language here?</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {stop.documents.map((d) => (
                  <li key={d} className="rounded-full border border-cyan-500/60 bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-foreground">
                    {d}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-sm text-muted-foreground">{stop.definesNote}</p>
            </div>
            {stop.attachments.length ? (
              <ul className="list-disc pl-5 text-sm text-foreground">
                {stop.attachments.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : null}
            <div>
              <p className="text-sm font-semibold text-foreground">Keyword table this revision added</p>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="table-sentence">
                {tableSentence(stop)}
              </p>
              {table ? (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-foreground">Show the {table.words.length} words of Table {table.id}</summary>
                  <p className={cn(mono, "mt-1 break-words text-muted-foreground")}>{table.words.join(" ")}</p>
                </details>
              ) : null}
            </div>
            <TableBars highlight={table?.id ?? null} />
            <p className="text-xs text-muted-foreground">Source: {stop.source}.</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">The timeline opens after both predictions.</p>
      )}
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------

/** F1C: which identifiers are reserved, region by region, and the standards each keyword table belongs to. */
export default function KeywordSetExplorer({ mode = "checker", preset }: KeywordSetExplorerProps) {
  return (
    <div data-testid="keyword-set-explorer" data-mode={mode}>
      {mode === "regions" ? <RegionsView preset={preset} /> : mode === "lineage" ? <LineageView /> : <CheckerView preset={preset} />}
    </div>
  );
}
