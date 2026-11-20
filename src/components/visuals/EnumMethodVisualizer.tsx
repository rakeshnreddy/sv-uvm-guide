"use client";

import React, { useEffect, useId, useRef, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { valueStyles } from "@/components/visual-system/visual-language";
import {
  ENUM_ASSIGN_OUTCOMES,
  ENUM_DECL_PRESETS,
  OPCODE_DECL,
  assignIntToEnum,
  callEnumMethod,
  enumAssignOutcomeLabel,
  enumAssignResultText,
  enumBaseText,
  enumDeclPreset,
  enumDeclaration,
  enumDefault,
  enumNumberLine,
  enumPredictionChoices,
  enumSpecText,
  enumTypeFromDeclaration,
  formatEnumValue,
  gradeEnumDeclPrediction,
  isMember,
  nextStepQuestion,
  resolveEnumDeclaration,
  writeEnumThroughPackedStruct,
  type EnumAssignOutcome,
  type EnumDeclGrade,
  type EnumDeclPresetId,
  type EnumMethod,
  type EnumMethodResult,
  type EnumTypeModel,
  type EnumValue,
  type ResolvedEnum,
} from "@/lib/sv-enum-string-model";
import { cn } from "@/lib/utils";

export type EnumVisualizerTab = "methods" | "declaration" | "casts";

export interface EnumMethodVisualizerProps {
  /** Which view opens first. Default "methods", the original explorer. */
  initialTab?: EnumVisualizerTab;
  /** Declaration the "How values are assigned" view starts on. Default "sparse", {A = 3, B, C = 7, D}. */
  declarationPreset?: EnumDeclPresetId;
  /** Where the packed-struct row of the casts view links to (the packed layout explorer's "enum field" preset); without it the row names the preset in text. */
  packedExplorerHref?: string;
}

/* Shared classes: secondary buttons on a solid surface, 40 px touch targets. */
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const textButtonClass =
  "inline-flex min-h-10 items-center px-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const selectClass =
  "h-10 w-full min-w-0 rounded-md border border-input bg-card px-2 font-mono text-sm text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border bg-card p-3";
/** The prediction encoding of the visual language (amber, with a "Predict" chip), as PredictionPrompt draws it. */
const predictPanel = "rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3 sm:p-4";
const predictChip = "mr-2 rounded bg-warning-subtle px-1.5 py-0.5 text-label text-warning";
/** The shared primitives size some buttons below 40 px (segments, the assumptions summary): size them for touch from here. */
const touchTargets = "[@media(pointer:coarse)]:[&_button]:min-h-10 [@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3";

const TABS: { value: EnumVisualizerTab; label: string }[] = [
  { value: "methods", label: "Methods" },
  { value: "declaration", label: "How values are assigned" },
  { value: "casts", label: "Casts" },
];

const FRAME: Record<EnumVisualizerTab, { title: string; summary: string; assumptions: string[] }> = {
  methods: {
    title: "Enum methods, including the traps",
    summary: "Choose what s holds, including a value that is not a member, then call a method.",
    assumptions: [
      "Follows IEEE 1800-2023 §6.19.3–§6.19.5 and §6.24.2. Members have implicit values 0 to 3.",
      "Methods return values; s only changes when you assign the result.",
    ],
  },
  declaration: {
    title: "How enum values are assigned",
    summary: "Pick a declaration, predict each name's value or a compile error, then see the values on a number line.",
    assumptions: [
      "Follows IEEE 1800-2023 §6.19 (implicit values, uniqueness, range, sized literals, x and z) and §6.19.2 with Table 6-10 (name[N] and name[N:M]); next() follows §6.19.5.3.",
      "Base types up to 32 bits. Values are written as plain numbers, sized literals or 'x; constant expressions with parameters are not modelled.",
      "§6.19 calls the x and z errors syntax errors; tools report all of these errors when they compile or elaborate the code, and the wording of each message is the tool's.",
    ],
  },
  casts: {
    title: "Putting a number into an enum",
    summary: "Choose raw, predict what each statement does, then check each row.",
    assumptions: [
      "Follows IEEE 1800-2023 §6.19.3 and §6.19.4 (a plain assignment is illegal; a static cast does not check), and §6.24.2 ($cast as a function returns 0 or 1 and never errors; as a task, a failed cast is a run-time error). op holds OP_NOP before each statement.",
      "The standard calls the plain assignment illegal; tools reject it when they compile or elaborate the code. What a run-time error prints, and whether the run stops, is up to the tool.",
      "Both raw values fit the 4-bit base. A wider value would first be converted to the base type by the static cast (§6.19.4); that truncation is not modelled.",
      "The packed-struct row is derived: §7.2.1 makes a packed struct one vector, and §6.19.3 checks assignments to the enum variable itself (it names the union case).",
    ],
  },
};

/**
 * Enum explorer with three views: the methods (the original, and the default),
 * how a declaration assigns values (§6.19, §6.19.2), and the four ways to put
 * a number into an enum (§6.19.3, §6.19.4, §6.24.2). Every value and sentence
 * comes from src/lib/sv-enum-string-model.ts.
 */
export default function EnumMethodVisualizer({ initialTab = "methods", declarationPreset, packedExplorerHref }: EnumMethodVisualizerProps = {}) {
  const [tab, setTab] = useState<EnumVisualizerTab>(initialTab);
  const [announcement, setAnnouncement] = useState("");
  const frame = FRAME[tab];

  return (
    <VisualFrame label="Enum method explorer" eyebrow="Experiment" title={frame.title} summary={frame.summary} fidelity="model" assumptions={frame.assumptions} className={cn("fig-panel !overflow-visible", touchTargets)}>
      <SegmentedControl
        label="Enum explorer view"
        value={tab}
        onChange={(v) => {
          setTab(v);
          setAnnouncement(`Showing ${TABS.find((t) => t.value === v)?.label.toLowerCase()}.`);
        }}
        options={TABS}
      />
      <p role="status" aria-live="polite" className="sr-only" data-testid="enum-live">
        {announcement}
      </p>
      {tab === "methods" ? <MethodsView /> : null}
      {tab === "declaration" ? <DeclarationView initialPreset={declarationPreset} announce={setAnnouncement} /> : null}
      {tab === "casts" ? <CastsView announce={setAnnouncement} packedExplorerHref={packedExplorerHref} /> : null}
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Methods (the original explorer)                                     */
/* ------------------------------------------------------------------ */

type Base = "int" | "logic";

const MEMBERS = ["IDLE", "START", "BUSY", "ERROR"];
const ENUMS: Record<Base, EnumTypeModel> = {
  int: { name: "state_e", baseDecl: "", states: 2, members: MEMBERS },
  logic: { name: "state_e", baseDecl: "logic [1:0]", states: 4, members: MEMBERS },
};
/** A value that is not a member: an out-of-range static cast for int, 'x for the 4-state base. */
const INVALID: Record<Base, { value: EnumValue; label: string; code: string }> = {
  int: { value: 7, label: "state_e'(7)", code: "s = state_e'(7);" },
  logic: { value: "x", label: "'x (never assigned)", code: "// s never assigned: starts at 'x" },
};

const METHODS: { method: EnumMethod; label: (n: number) => string }[] = [
  { method: "first", label: () => "first()" },
  { method: "last", label: () => "last()" },
  { method: "next", label: (n) => `next(${n === 1 ? "" : n})` },
  { method: "prev", label: (n) => `prev(${n === 1 ? "" : n})` },
  { method: "num", label: () => "num()" },
  { method: "name", label: () => "name()" },
];

const formatReturn = (t: EnumTypeModel, r: EnumMethodResult["returns"]) =>
  r.kind === "enum" ? formatEnumValue(t, r.value) : r.kind === "int" ? String(r.value) : `"${r.value}"`;

function MethodsView() {
  const [base, setBase] = useState<Base>("int");
  const [current, setCurrent] = useState<EnumValue>(0);
  const [n, setN] = useState(1);
  const [result, setResult] = useState<EnumMethodResult | null>(null);
  const t = ENUMS[base];
  const invalid = INVALID[base];
  const currentKey = current === invalid.value ? "invalid" : String(current);

  const switchBase = (b: Base) => {
    setBase(b);
    setCurrent(0);
    setResult(null);
  };

  const neverAssigned = enumDefault(t);
  const neverName = callEnumMethod(t, neverAssigned, "name").returns;
  const neverNameText = neverName.kind === "string" ? neverName.value : "";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Base type</span>
        <SegmentedControl
          label="Enum base type"
          mono
          value={base}
          onChange={switchBase}
          options={[
            { value: "int", label: "default (int)" },
            { value: "logic", label: "logic [1:0]" },
          ]}
        />
      </div>

      <PredictionPrompt
        resetKey={base}
        question={
          <>
            <code className="font-mono">state_e s;</code> is never assigned (the reset was forgotten). What does <code className="font-mono">s.name()</code> return?
          </>
        }
        options={[
          {
            id: "idle",
            label: '"IDLE"',
            correct: neverNameText === "IDLE",
            feedback:
              base === "int"
                ? "The default base type is int, which is 2-state and starts at 0 (Table 6-7). 0 is IDLE, so an un-reset state machine looks as if it sits in IDLE and the missing reset is hidden."
                : "A logic [1:0] base is 4-state and starts at 'x (Table 6-7). 'x is not IDLE.",
          },
          {
            id: "empty",
            label: '"" (empty string)',
            correct: neverNameText === "",
            feedback:
              base === "logic"
                ? "s starts at 'x, which is not a member, so name() returns the empty string (§6.19.5.6). The missing reset is visible."
                : "An int-based enum starts at 0 (Table 6-7). Here 0 is IDLE, the first member, so s does not start at an invalid value.",
          },
          {
            id: "x",
            label: '"x"',
            correct: false,
            feedback: "name() returns a member's name or the empty string. It never prints the value itself (§6.19.5.6).",
          },
          {
            id: "error",
            label: "A run-time error",
            correct: false,
            feedback: "Calling name() on any value is legal. An invalid value gives \"\" rather than an error (§6.19.5.6).",
          },
        ]}
      >
        <p className="text-sm text-muted-foreground" aria-live="polite">
          With this base type an unassigned <code className="font-mono">s</code> holds {formatEnumValue(t, neverAssigned)}. Prefer a 4-state base such as{" "}
          <code className="font-mono">logic [1:0]</code> for FSM state so a missing reset shows up as x.
        </p>
      </PredictionPrompt>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">s holds</p>
        <SegmentedControl
          label="Value held by s"
          mono
          value={currentKey}
          onChange={(k) => {
            setCurrent(k === "invalid" ? invalid.value : Number(k));
            setResult(null);
          }}
          options={[...MEMBERS.map((m, i) => ({ value: String(i), label: m })), { value: "invalid", label: invalid.label }]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">N for next(N) / prev(N)</span>
          <SegmentedControl label="Step count N" mono value={String(n)} onChange={(v) => setN(Number(v))} options={["1", "2", "3"].map((v) => ({ value: v, label: v }))} />
        </div>
      </div>

      <ol className="fig-stage !p-0 flex flex-wrap gap-2 rounded-xl bg-[hsl(var(--fig-well))]" aria-label="Enum members in declaration order">
        {MEMBERS.map((m, i) => {
          const isCurrent = current === i;
          const isReturned = result?.returns.kind === "enum" && result.returns.value === i;
          return (
            <li
              key={m}
              className={cn(
                "rounded-lg border px-3 py-2 font-mono text-sm [font-variant-ligatures:none]",
                "bg-[linear-gradient(180deg,hsl(var(--foreground)/var(--fig-quiet-top)),hsl(var(--foreground)/var(--fig-quiet-bottom)))] shadow-[inset_0_1px_hsl(var(--fig-obj-highlight))]",
                isCurrent ? "border-fig-cyan" : "border-fig-generic",
                isReturned && "ring-2 ring-fig-cyan",
              )}
            >
              {m} = {i}
              {isCurrent ? <span className="ml-1 text-xs">◀ s</span> : null}
              {isReturned ? <span className="ml-1 text-xs">▲ returned</span> : null}
            </li>
          );
        })}
        {!isMember(t, current) ? (
          <li className="rounded-lg border border-dashed border-fig-rose bg-fig-rose-fill px-3 py-2 font-mono text-sm text-fig-rose-text">
            {formatEnumValue(t, current)} <span className="ml-1 text-xs">◀ s</span>
          </li>
        ) : null}
      </ol>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Enum methods">
        {METHODS.map(({ method, label }) => (
          <button key={method} type="button" onClick={() => setResult(callEnumMethod(t, current, method, n))} className={cn(buttonClass, mono)}>
            s.{label(n)}
          </button>
        ))}
      </div>

      <CodeTrace
        label="The code"
        lines={[
          { text: enumDeclaration(t), key: "decl" },
          { text: "state_e s;", key: "var" },
          { text: current === invalid.value ? invalid.code : `s = ${MEMBERS[current as number]};`, key: "set" },
          ...(result ? [{ text: `r = ${result.call};  // ${formatReturn(t, result.returns)}`, key: "call" }] : []),
        ]}
        activeKey={result ? "call" : undefined}
      />

      <div className={cn(panel, "min-h-12 text-sm")} aria-live="polite">
        {result ? (
          <>
            <p className="font-mono [font-variant-ligatures:none]">
              {result.call} → <strong>{formatReturn(t, result.returns)}</strong>
            </p>
            <p className="mt-1 text-muted-foreground">{result.why}</p>
            {result.returns.kind === "enum" ? (
              <button
                type="button"
                onClick={() => {
                  if (result.returns.kind === "enum") setCurrent(result.returns.value);
                  setResult(null);
                }}
                className={cn(buttonClass, mono, "mt-2")}
              >
                s = {result.call};
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">Call a method to see what it returns.</p>
        )}
      </div>

      {base === "int" ? <CastDrill t={t} /> : null}
    </>
  );
}

function CastDrill({ t }: { t: EnumTypeModel }) {
  const rows = (["plain", "static-cast", "dynamic-cast"] as const).map((form) => assignIntToEnum(t, 0, 7, form));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] border-collapse text-sm">
        <caption className="mb-1 text-left text-xs text-muted-foreground">Putting the int 7 into s (which holds IDLE): three ways</caption>
        <thead>
          <tr>
            <th scope="col" className="border border-border/60 px-2 py-1 text-left">Code</th>
            <th scope="col" className="border border-border/60 px-2 py-1 text-left">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td className="border border-border/60 px-2 py-1 font-mono [font-variant-ligatures:none]">{r.code}</td>
              <td className="border border-border/60 px-2 py-1">
                <span className={r.compiles ? "" : "text-danger"}>{r.compiles ? "" : "✕ "}</span>
                {r.compiles ? `s = ${formatEnumValue(t, r.after)}${r.castReturn !== undefined ? `, $cast returns ${r.castReturn}` : ""}. ` : ""}
                <span className="text-muted-foreground">{r.why}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* How values are assigned (§6.19, §6.19.2)                            */
/* ------------------------------------------------------------------ */

const DECL_TYPE_NAME = "demo_e";

function DeclarationView({ initialPreset, announce }: { initialPreset?: EnumDeclPresetId; announce: (text: string) => void }) {
  const [presetId, setPresetId] = useState<EnumDeclPresetId>(enumDeclPreset(initialPreset).id);
  const preset = enumDeclPreset(presetId);
  const resolved = resolveEnumDeclaration(preset.spec);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Declaration</p>
        <SegmentedControl
          label="Enum declaration"
          mono
          value={presetId}
          onChange={(id) => {
            setPresetId(id);
            announce(`Declaration ${enumDeclPreset(id).label}. Nothing is revealed yet.`);
          }}
          options={ENUM_DECL_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        />
      </div>
      <CodeTrace label="The declaration" lines={[{ text: `typedef ${enumSpecText(preset.spec)} ${DECL_TYPE_NAME};`, key: "decl" }]} />
      {/* Keyed by preset so a new declaration starts with a fresh, unanswered prediction. */}
      <DeclarationPrediction key={presetId} resolved={resolved} announce={announce} />
    </div>
  );
}

type PickedValue = number | "x" | null;

function DeclarationPrediction({ resolved, announce }: { resolved: ResolvedEnum; announce: (text: string) => void }) {
  const ids = useId();
  const [compiles, setCompiles] = useState<"yes" | "no" | "">("");
  const [values, setValues] = useState<Record<string, PickedValue>>({});
  const [grade, setGrade] = useState<EnumDeclGrade | null>(null);
  const [skipped, setSkipped] = useState(false);
  const revealed = grade !== null || skipped;
  // The buttons that reveal unmount, so move focus to the verdict instead of letting it fall to the page.
  const verdictRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (revealed) verdictRef.current?.focus();
  }, [revealed]);
  const choices = enumPredictionChoices(resolved.spec);
  const complete = compiles === "no" || (compiles === "yes" && resolved.members.every((m) => values[m.name] !== undefined && values[m.name] !== null));

  const lockIn = () => {
    const g = gradeEnumDeclPrediction(resolved, { compiles: compiles === "yes", values });
    setGrade(g);
    announce(g.feedback);
  };

  return (
    <div className="space-y-4">
      <div className={predictPanel}>
        <fieldset disabled={revealed} className="space-y-3">
          <legend className="mb-1 text-sm font-semibold text-foreground">
            <span className={predictChip}>Predict</span>
            Does it compile? If it does, what value does each name get? The generated names are listed for you.
          </legend>
          <div role="radiogroup" aria-label="Does the declaration compile?" className="flex flex-wrap gap-2">
            {(
              [
                { value: "yes", label: "It compiles" },
                { value: "no", label: "Compile error" },
              ] as const
            ).map((o) => (
              <label key={o.value} className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm", compiles === o.value && "border-amber-500/70")}>
                <input type="radio" name={`${ids}-compiles`} value={o.value} checked={compiles === o.value} onChange={() => setCompiles(o.value)} className="size-5 shrink-0 accent-amber-500" />
                {o.label}
              </label>
            ))}
          </div>
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(100%,8.5rem),1fr))]">
            {resolved.members.map((m) => {
              const id = `${ids}-${m.name}`;
              const v = values[m.name];
              return (
                <div key={m.name} className="space-y-1">
                  <label htmlFor={id} className={cn("block text-xs font-medium text-foreground", mono)}>
                    {m.name}
                  </label>
                  <select
                    id={id}
                    className={selectClass}
                    value={v === undefined || v === null ? "" : String(v)}
                    onChange={(e) => setValues((prev) => ({ ...prev, [m.name]: e.target.value === "" ? null : e.target.value === "x" ? "x" : Number(e.target.value) }))}
                  >
                    <option value="">Choose</option>
                    {choices.map((c) => (
                      <option key={c} value={String(c)}>
                        {c}
                      </option>
                    ))}
                    <option value="x">&apos;x</option>
                  </select>
                </div>
              );
            })}
          </div>
          {compiles === "no" ? <p className="text-xs text-muted-foreground">For a compile error the values are optional.</p> : null}
        </fieldset>
        {!revealed ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={buttonClass} disabled={!complete} onClick={lockIn}>
              Lock in prediction
            </button>
            <button
              type="button"
              className={textButtonClass}
              onClick={() => {
                setSkipped(true);
                announce(revealSummary(resolved));
              }}
            >
              Reveal without predicting
            </button>
          </div>
        ) : null}
      </div>

      {revealed ? (
        <div className="space-y-4">
          {grade ? (
            <p ref={verdictRef} tabIndex={-1} className={cn(verdictFocus, "text-sm", grade.correct ? "text-success" : "text-danger")}>
              <span aria-hidden>{grade.correct ? "✓ " : "✕ "}</span>
              {/* For a declaration that does not compile, the error list below carries the reasons. */}
              {resolved.ok ? grade.feedback : `${grade.correct ? "Correct" : "Not quite"}: it does not compile. The errors are listed below.`}
            </p>
          ) : (
            <p ref={verdictRef} tabIndex={-1} className={cn(verdictFocus, "text-sm text-muted-foreground")}>
              {resolved.ok ? revealSummary(resolved) : "It does not compile. The errors are listed below."}
            </p>
          )}
          <NumberLine resolved={resolved} />
          <ValueTable resolved={resolved} grade={grade} />
          {resolved.issues.length ? (
            <ul className="space-y-2" aria-label="Declaration errors">
              {resolved.issues.map((i) => (
                <li key={`${i.kind}-${i.member}`} className={cn(panel, "flex gap-2 text-sm")}>
                  <span aria-hidden className="font-semibold text-danger">
                    ✕
                  </span>
                  <span>
                    <span className="font-semibold text-danger">Error: </span>
                    {i.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {resolved.notes.map((n) => (
            <p key={n} className="text-xs text-muted-foreground">
              {n}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">Base type {enumBaseText(resolved)}.</p>
          <NextStep resolved={resolved} announce={announce} />
        </div>
      ) : null}
    </div>
  );
}

/** A focus ring for a block that receives focus from code after a reveal. */
const verdictFocus = "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const revealSummary = (r: ResolvedEnum) =>
  r.ok
    ? `It compiles: ${r.members.map((m) => `${m.name} = ${m.value === null ? "no value" : typeof m.value === "number" ? m.value : `'${m.value}`}`).join(", ")}.`
    : `It does not compile. ${r.issues.map((i) => i.message).join(" ")}`;

const memberValueText = (v: ResolvedEnum["members"][number]["value"]) => (v === null ? "no value" : typeof v === "number" ? String(v) : `'${v}`);

/** Lines with more slots than this may not fit a phone screen; they scroll sideways and say so. */
const LONG_LINE_SLOTS = 6;

/**
 * Members placed at their codes on a value line; gaps are dashed, collisions and errors carry ✕.
 * The line stays one row and scrolls sideways inside its own box when it is wider than the screen.
 */
function NumberLine({ resolved, pointer, label = "Number line of the enum values" }: { resolved: ResolvedEnum; pointer?: number; label?: string }) {
  const line = enumNumberLine(resolved);
  const errorNames = new Set(resolved.members.filter((m) => m.inError).map((m) => m.name));
  return (
    <figure className={cn(panel, "fig-stage !p-3 space-y-2 border-fig-generic bg-[hsl(var(--fig-well))]")}>
      <figcaption className="text-label text-subtle">Values on a number line, in value order</figcaption>
      {line.slots.length > LONG_LINE_SLOTS ? <p className="text-xs text-muted-foreground sm:hidden">Scroll the line sideways to see every value.</p> : null}
      <ol
        className="fig-stage !p-0 grid grid-flow-col auto-cols-[minmax(min-content,1fr)] gap-1 overflow-x-auto pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={label}
        // A line that can scroll sideways takes keyboard focus so the arrow keys can scroll it.
        tabIndex={line.slots.length > LONG_LINE_SLOTS ? 0 : undefined}
      >
        {line.slots.map((s) => {
          const collision = s.members.length > 1;
          const valueLabel = s.from === s.to ? String(s.from) : `${s.from}–${s.to}`;
          return (
            <li
              key={`${s.kind}-${s.from}`}
              aria-label={
                s.kind === "gap"
                  ? `${s.from === s.to ? `value ${s.from}` : `values ${s.from} to ${s.to}`}: no member`
                  : `value ${s.from}: ${s.members.join(" and ")}${collision ? ", the same value twice, an error" : ""}${pointer === s.from ? ", s is here" : ""}`
              }
              className={cn(
                "flex min-h-24 min-w-[2.75rem] flex-col items-stretch justify-end gap-1 rounded-md border p-1 text-center",
                s.kind === "gap" ? "border-dashed border-fig-generic text-muted-foreground" : collision ? "border-2 border-fig-rose bg-fig-rose-fill" : "border-fig-generic bg-[linear-gradient(180deg,hsl(var(--foreground)/var(--fig-quiet-top)),hsl(var(--foreground)/var(--fig-quiet-bottom)))] shadow-[inset_0_1px_hsl(var(--fig-obj-highlight))]",
                // Inset, so the scroll container (no padding) cannot clip the pointer ring.
                pointer === s.from && "ring-2 ring-inset ring-fig-cyan",
              )}
            >
              {s.kind === "gap" ? (
                <span className="text-xs">no member</span>
              ) : (
                s.members.map((name) => (
                  <span key={name} className={cn("whitespace-nowrap rounded border px-1 py-0.5 text-xs", mono, errorNames.has(name) ? "border-fig-rose text-fig-rose-text" : "border-fig-generic bg-card text-foreground")}>
                    {errorNames.has(name) ? <span aria-hidden>✕ </span> : null}
                    {name}
                  </span>
                ))
              )}
              {pointer === s.from ? (
                <span aria-hidden className="text-xs text-foreground">
                  ▲ s
                </span>
              ) : null}
              <span aria-hidden className={cn("border-t border-border pt-0.5 text-xs tabular-nums", mono)}>
                {valueLabel}
              </span>
            </li>
          );
        })}
      </ol>
      {line.offLine.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Not on the line:</span>
          {line.offLine.map((m) =>
            m.value === "x" || m.value === "z" ? (
              <span key={m.name} className={cn("rounded border px-1.5 py-0.5 text-xs", mono, valueStyles[m.value === "x" ? "unknown" : "highz"].className)} aria-label={`${m.name} = '${m.value}, ${valueStyles[m.value === "x" ? "unknown" : "highz"].cue}`}>
                {m.name} = &apos;{m.value}
              </span>
            ) : (
              <span key={m.name} className={cn("rounded border border-danger px-1.5 py-0.5 text-xs text-danger", mono)}>
                <span aria-hidden>✕ </span>
                {m.name}: no value
              </span>
            ),
          )}
        </div>
      ) : null}
    </figure>
  );
}

function ValueTable({ resolved, grade }: { resolved: ResolvedEnum; grade: EnumDeclGrade | null }) {
  return (
    <ul className="fig-stage !p-0 space-y-2 rounded-xl bg-[hsl(var(--fig-well))]" aria-label="Each name, its value and the rule that gave it">
      {resolved.members.map((m) => {
        const row = grade?.perMember.find((p) => p.name === m.name);
        const said = row && row.predicted !== null && row.predicted !== undefined ? row : null;
        return (
          <li key={m.name} className={cn(panel, "py-2 text-sm")}>
            <p className={mono}>
              <span className="font-medium text-foreground">{m.name}</span> = <span className={m.inError ? "text-danger" : "text-foreground"}>{memberValueText(m.value)}</span>
              {said ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  you said {memberValueText(said.predicted)} <span aria-label={said.match ? "matches" : "does not match"}>{said.match ? "✓" : "✕"}</span>
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-muted-foreground">{m.rule}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** next() on a legal numeric declaration: predict, then step through the declaration order. */
function NextStep({ resolved, announce }: { resolved: ResolvedEnum; announce: (text: string) => void }) {
  const t = enumTypeFromDeclaration(resolved, DECL_TYPE_NAME);
  const q = t ? nextStepQuestion(t) : null;
  const [s, setS] = useState<number | null>(q ? q.start : null);
  const [last, setLast] = useState<EnumMethodResult | null>(null);
  if (!t || !q || s === null) {
    return resolved.ok ? <p className="text-xs text-muted-foreground">The method model does not step next() through an x or z value, so the next() demo is off for this declaration.</p> : null;
  }
  const step = (method: "next" | "prev") => {
    const r = callEnumMethod(t, s, method);
    setLast(r);
    if (r.returns.kind === "enum" && typeof r.returns.value === "number") setS(r.returns.value);
    announce(`${r.call} returns ${formatReturn(t, r.returns)}. ${r.why}`);
  };
  return (
    <PredictionPrompt question={q.question} options={q.options}>
      <div className="space-y-3">
        <NumberLine resolved={resolved} pointer={s} label="Number line of the enum values, with s" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Step s through the declaration order">
          <button type="button" className={cn(buttonClass, mono)} onClick={() => step("prev")}>
            s = s.prev();
          </button>
          <button type="button" className={cn(buttonClass, mono)} onClick={() => step("next")}>
            s = s.next();
          </button>
        </div>
        <div className={cn(panel, "text-sm")}>
          <p className={mono}>s = {formatEnumValue(t, s)}</p>
          <p className="mt-1 text-muted-foreground">{last ? last.why : "Step s with next() and prev() to walk the declaration order."}</p>
        </div>
      </div>
    </PredictionPrompt>
  );
}

/* ------------------------------------------------------------------ */
/* Casts (§6.19.3, §6.19.4, §6.24.2)                                   */
/* ------------------------------------------------------------------ */

const OPCODE = enumTypeFromDeclaration(resolveEnumDeclaration(OPCODE_DECL), "opcode_e") as EnumTypeModel;
const OP_BEFORE = OPCODE.values![0];
const RAW_CHOICES = [2, 7] as const;
type Raw = (typeof RAW_CHOICES)[number];

interface CastRow {
  id: string;
  code: string;
  comment?: string;
  outcome: EnumAssignOutcome;
  after: EnumValue;
  why: string;
  derived?: boolean;
}

function castRows(raw: Raw): CastRow[] {
  const forms = (["plain", "static-cast", "dynamic-cast", "dynamic-cast-task"] as const).map((form) => {
    const r = assignIntToEnum(OPCODE, OP_BEFORE, raw, form, { varName: "op", sourceText: "raw" });
    return { id: form, code: r.code, outcome: r.outcome, after: r.after, why: r.why };
  });
  const back = writeEnumThroughPackedStruct(OPCODE, raw);
  return [...forms, { id: "packed", code: back.code, comment: "// cmd_t c; bus[31:28] = raw lands in c.op", outcome: back.outcome, after: back.after, why: back.why, derived: true }];
}

function CastsView({ announce, packedExplorerHref }: { announce: (text: string) => void; packedExplorerHref?: string }) {
  const [raw, setRaw] = useState<Raw>(7);
  const rows = castRows(raw);
  return (
    <div className="space-y-4">
      <CodeTrace
        label="The code"
        lines={[
          { text: `typedef ${enumSpecText(OPCODE_DECL)} opcode_e;`, key: "decl" },
          { text: "opcode_e op;  int raw;  int ok;", key: "vars" },
          { text: "cmd_t c;  // packed, 32 bits: op [31:28], addr [27:16], data [15:0]; vif.bus is 32 bits", key: "struct" },
          { text: `op = ${OPCODE.members[0]};  raw = ${raw};`, key: "set" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">raw holds</span>
        <SegmentedControl
          label="Value of raw"
          mono
          value={String(raw)}
          onChange={(v) => {
            setRaw(Number(v) as Raw);
            announce(`raw = ${v}. The rows are unanswered again.`);
          }}
          options={RAW_CHOICES.map((r) => ({ value: String(r), label: `raw = ${r}${isMember(OPCODE, r) ? " (a member)" : " (not a member)"}` }))}
        />
      </div>
      <ol className="fig-stage !p-0 space-y-3 rounded-xl bg-[hsl(var(--fig-well))]" aria-label="Statements that put raw into op">
        {rows.map((row) => (
          <CastRowCard key={`${raw}-${row.id}`} row={row} raw={raw} announce={announce} packedExplorerHref={packedExplorerHref} />
        ))}
      </ol>
    </div>
  );
}

function CastRowCard({ row, raw, announce, packedExplorerHref }: { row: CastRow; raw: Raw; announce: (text: string) => void; packedExplorerHref?: string }) {
  const id = useId();
  const [picked, setPicked] = useState<EnumAssignOutcome | "">("");
  const [revealed, setRevealed] = useState(false);
  const varName = row.derived ? "c.op" : "op";
  const result = enumAssignResultText(OPCODE, row, OP_BEFORE, varName);
  const correct = picked !== "" && picked === row.outcome;
  // "Check this row" and "Reveal" unmount on reveal: move focus to the result.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (revealed) resultRef.current?.focus();
  }, [revealed]);
  const reveal = () => {
    setRevealed(true);
    announce(`${row.code} ${picked ? (correct ? "Correct." : "Not quite.") : ""} ${result} ${row.why}`);
  };
  return (
    <li className={cn(panel, "space-y-2 border-fig-generic bg-[linear-gradient(180deg,hsl(var(--foreground)/var(--fig-quiet-top)),hsl(var(--foreground)/var(--fig-quiet-bottom)))] shadow-[inset_0_1px_hsl(var(--fig-obj-highlight))]")}>
      <div className="flex flex-wrap items-center gap-2">
        <code className={cn("max-w-full break-words rounded-md border border-code-border bg-code-surface px-2 py-1 text-sm text-code-foreground", mono)}>
          {row.code}
          {row.comment ? <span className="text-code-muted">{`  ${row.comment}`}</span> : null}
        </code>
        {row.derived ? <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Derived</span> : null}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-56 space-y-1">
          <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
            Your prediction
          </label>
          <select id={id} className={cn(selectClass, "font-sans")} value={picked} disabled={revealed} onChange={(e) => setPicked(e.target.value as EnumAssignOutcome | "")}>
            <option value="">Choose an outcome</option>
            {ENUM_ASSIGN_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {enumAssignOutcomeLabel(o, varName)}
              </option>
            ))}
          </select>
        </div>
        {!revealed ? (
          <>
            <button type="button" className={buttonClass} disabled={!picked} onClick={reveal}>
              Check this row
            </button>
            <button type="button" className={textButtonClass} onClick={reveal}>
              Reveal
            </button>
          </>
        ) : null}
      </div>
      {revealed ? (
        <div ref={resultRef} tabIndex={-1} className={cn(verdictFocus, "space-y-1 text-sm")} data-testid={`cast-result-${row.id}`}>
          <p className="font-medium text-foreground">
            {picked ? <span className={correct ? "text-success" : "text-danger"}>{correct ? "✓ Correct. " : `✕ Not quite: the outcome is "${enumAssignOutcomeLabel(row.outcome, varName)}". `}</span> : null}
            <OutcomeTag outcome={row.outcome} /> {result}
          </p>
          <p className="text-muted-foreground">{row.why}</p>
          {row.derived ? (
            <p className="text-muted-foreground">
              {packedExplorerHref ? (
                <a href={packedExplorerHref} className="text-primary underline underline-offset-2">
                  Open the packed layout explorer on its enum field preset
                </a>
              ) : (
                <>See it bit by bit in the packed layout explorer: struct mode, the &quot;enum field&quot; preset.</>
              )}{" "}
              Here raw lands in the top hex digit of the 32-bit word; the explorer&apos;s preset writes 7 there.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** A label plus a glyph on a neutral raised surface: no signal-value colour for an outcome. */
function OutcomeTag({ outcome }: { outcome: EnumAssignOutcome }) {
  const tag: Record<EnumAssignOutcome, { glyph: string; text: string }> = {
    "compile-error": { glyph: "✕", text: "Compile error" },
    assigned: { glyph: "→", text: "Assigned" },
    "assigned-ok-1": { glyph: "→", text: "ok = 1" },
    "unchanged-ok-0": { glyph: "=", text: "ok = 0" },
    "runtime-error": { glyph: "!", text: "Run-time error" },
  };
  return (
    <span className="mr-1 inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
      <span aria-hidden>{tag[outcome].glyph}</span>
      {tag[outcome].text}
    </span>
  );
}
