"use client";

import React, { useCallback, useEffect, useId, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { classifyValue, valueStyles } from "@/components/visual-system/visual-language";
import {
  BIT4_VALUES,
  CHARGE_STRENGTHS,
  DRIVE_STRENGTHS,
  IMPLICIT_PULL_ID,
  STRENGTH_LEVEL,
  bitConflictTag,
  checkDrivers,
  describeOpenDrainDevice,
  diagnoseNetGuess,
  driverAssignSource,
  effectiveDriver,
  isContinuousWriter,
  netDeclarationSource,
  openDrainAssignSource,
  openDrainControl,
  openDrainDriver,
  openDrainSummary,
  openDrainTruthTable,
  portKind,
  resolveNet,
  resolveNetOverTime,
  selectText,
  strengthLabel,
  type Bit4,
  type OpenDrainDevice,
  type PortDataType,
  type PortDirection,
  type PortKindKeyword,
  type PortKindResult,
  type ChargeStrength,
  type DeclKind,
  type DriveStrength,
  type DriverCheck,
  type NetDriver,
  type NetResolution,
  type NetType,
  type Writer,
} from "@/lib/sv-four-state-model";
import { cn } from "@/lib/utils";

export const NET_MODEL_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §6.5 (who may drive nets and variables), §6.6.1–§6.6.5 with Tables 6-2 to 6-6 (net types), and §28.11–§28.15 (strength levels: supply > strong > pull > weak > highz; the strongest level wins; equal-strength conflict gives x on wire/tri).",
  "One scalar net. Each driver uses the same strength for 0 and 1, as in assign (strong0, strong1), except the open-drain preset, which uses the per-value pair (strong0, highz1) of §10.3.4. tri, triand and trior behave exactly like wire, wand and wor.",
  "Driver legality checks each bit of a packed variable as its own element (§6.5, §11.5.3), with constant bit selects only. Port kinds follow §23.2.2.3 for the first port of an ANSI port list, with `default_nettype wire`.",
  "Not modelled: trireg charge-decay delays, switches and charge sharing between triregs, L/H partial values from gates, user-defined nettypes.",
  "Compile errors are shown as the error class the standard requires; real tools word them differently.",
];

type Mode = "drivers" | "legality" | "trireg";
type LegalityPattern = "bitwise" | "ports";

export interface NetResolutionSimulatorProps {
  /** Mode shown first. Defaults to "drivers". */
  initialMode?: Mode;
  /** Legality mode: open the per-bit lab ("bitwise") or the port-kind lab ("ports"). Default: the whole-variable lab. */
  pattern?: LegalityPattern;
  /** Drivers mode: "open-drain", or the id of a corner-case preset (fight, strong-weak, x-driver, wand, wor-strength, tri0-weak, all-off). */
  preset?: string;
}

const chipValue = (bit: Bit4) => (bit === "x" ? "X" : bit === "z" ? "Z" : bit);
const codeLines = (lines: string[]): CodeTraceLine[] => lines.map((text, i) => ({ text, key: `l${i}` }));

const NET_CHOICES: { value: NetType; label: string }[] = [
  { value: "wire", label: "wire" },
  { value: "wand", label: "wand" },
  { value: "wor", label: "wor" },
  { value: "tri0", label: "tri0" },
  { value: "tri1", label: "tri1" },
  { value: "trireg", label: "trireg" },
  { value: "uwire", label: "uwire" },
];

const DRIVER_IDS = ["a", "b", "c"] as const;

interface Preset {
  id: string;
  label: string;
  net: NetType;
  drivers: NetDriver[];
}

const d = (id: string, value: Bit4, strength: DriveStrength = "strong"): NetDriver => ({ id, value, strength });

const PRESETS: Preset[] = [
  { id: "fight", label: "Bus fight", net: "wire", drivers: [d("a", "0"), d("b", "1")] },
  { id: "strong-weak", label: "Strong beats weak", net: "wire", drivers: [d("a", "0", "strong"), d("b", "1", "weak")] },
  { id: "x-driver", label: "Weak x vs pull 1", net: "wire", drivers: [d("a", "x", "weak"), d("b", "1", "pull")] },
  { id: "wand", label: "wand at equal strength", net: "wand", drivers: [d("a", "0"), d("b", "1")] },
  { id: "wor-strength", label: "wor across strengths", net: "wor", drivers: [d("a", "0", "strong"), d("b", "1", "weak")] },
  { id: "tri0-weak", label: "Weak 1 vs tri0", net: "tri0", drivers: [d("a", "1", "weak"), d("b", "z")] },
  { id: "all-off", label: "Everyone off", net: "wire", drivers: [d("a", "z"), d("b", "z")] },
];

/** Rendered inside a PredictionPrompt: tells the parent that the answer is now visible. */
function OnReveal({ revealKey, onReveal }: { revealKey: string; onReveal: (key: string) => void }) {
  useEffect(() => {
    onReveal(revealKey);
  }, [revealKey, onReveal]);
  return null;
}

/* ------------------------------------------------------------------ */
/* Strength ladder (the picture)                                       */
/* ------------------------------------------------------------------ */

function StrengthLadder({ net, drivers, result, charge }: { net: NetType; drivers: NetDriver[]; result: NetResolution | null; charge?: ChargeStrength }) {
  const shown: NetDriver[] = [...drivers];
  if (net === "tri0" || net === "tri1") shown.push({ id: IMPLICIT_PULL_ID, value: net === "tri0" ? "0" : "1", strength: "pull" });
  const rows: { name: string; level: number; charge?: boolean }[] = [
    { name: "supply", level: STRENGTH_LEVEL.supply },
    { name: "strong", level: STRENGTH_LEVEL.strong },
    { name: "pull", level: STRENGTH_LEVEL.pull },
    ...(net === "trireg" ? [{ name: "large (charge)", level: STRENGTH_LEVEL.large, charge: true }] : []),
    { name: "weak", level: STRENGTH_LEVEL.weak },
    ...(net === "trireg"
      ? [
          { name: "medium (charge)", level: STRENGTH_LEVEL.medium, charge: true },
          { name: "small (charge)", level: STRENGTH_LEVEL.small, charge: true },
        ]
      : []),
    { name: "highz (off)", level: 0 },
  ];
  const winningLevel = result && result.ok && result.value !== "z" && result.winners.length > 0 ? STRENGTH_LEVEL[result.strength] : null;
  const token = (drv: NetDriver, side: string) => {
    const label = drv.id === IMPLICIT_PULL_ID ? (drv.value === "0" ? "pull-down" : "pull-up") : drv.id;
    const won = result && result.ok && result.winners.includes(drv.id);
    return (
      <span
        key={`${drv.id}-${side}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs [font-variant-ligatures:none]",
          valueStyles[classifyValue(chipValue(drv.value))].className,
          drv.id === IMPLICIT_PULL_ID && "rounded-full",
        )}
      >
        {label}:{drv.value}
        {won ? <span aria-label="sets the net value">▶</span> : null}
      </span>
    );
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] border-collapse text-sm">
        <caption className="mb-1 text-left text-xs text-muted-foreground">
          Strength ladder (Table 28-7). Each driver sits on its strength row, on the side of the value it drives; an x driver sits on both sides.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border border-border/60 px-2 py-1 text-left">drives 0</th>
            <th scope="col" className="border border-border/60 px-2 py-1">strength</th>
            <th scope="col" className="border border-border/60 px-2 py-1 text-right">drives 1</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const at = shown.filter((drv) => drv.value !== "z" && STRENGTH_LEVEL[drv.strength] === row.level);
            const zeros = at.filter((drv) => drv.value === "0" || drv.value === "x");
            const ones = at.filter((drv) => drv.value === "1" || drv.value === "x");
            const off = row.level === 0 ? shown.filter((drv) => drv.value === "z") : [];
            const isWin = winningLevel !== null && row.level === winningLevel && !row.charge;
            const isCharge = row.charge && result && result.ok && result.strength === (row.name.split(" ")[0] as ChargeStrength);
            return (
              <tr key={row.name} className={cn((isWin || isCharge) && "bg-cyan-500/10")}>
                <td className="border border-border/60 px-2 py-1">
                  <div className="flex flex-wrap gap-1">{zeros.map((drv) => token(drv, "0"))}</div>
                </td>
                <th scope="row" className={cn("border border-border/60 px-2 py-1 text-center text-xs font-medium", (isWin || isCharge) ? "text-foreground" : "text-muted-foreground")}>
                  {(isWin || isCharge) ? <span aria-hidden>▶ </span> : null}
                  {row.name} ({row.level})
                  {isWin ? <span className="sr-only">, strongest level present</span> : null}
                  {isCharge ? <span className="sr-only">, stored charge</span> : null}
                  {charge && row.charge && row.name.startsWith(charge) ? <span className="block text-[10px]">declared charge</span> : null}
                </th>
                <td className="border border-border/60 px-2 py-1">
                  <div className="flex flex-wrap justify-end gap-1">
                    {ones.map((drv) => token(drv, "1"))}
                    {off.map((drv) => token(drv, "z"))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultBanner({ result, netName = "y" }: { result: NetResolution; netName?: string }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-900 dark:text-rose-100" aria-live="polite">
        <strong>✕ Elaboration error.</strong> {result.why}
      </div>
    );
  }
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ValueChip name={netName} value={chipValue(result.value)} />
        <span className="rounded-md border border-border/70 px-2 py-0.5 font-mono text-xs [font-variant-ligatures:none]" aria-label={`strength and value ${result.label}`}>
          {result.label}
        </span>
        <span className="text-xs text-muted-foreground">(%v style: strength + value)</span>
      </div>
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">Why: </strong>
        {result.why}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mode 1: drivers on a net                                            */
/* ------------------------------------------------------------------ */

const GUESSES: { id: Bit4 | "error"; label: string }[] = [
  { id: "0", label: "y reads 0" },
  { id: "1", label: "y reads 1" },
  { id: "x", label: "y reads x" },
  { id: "z", label: "y reads z (floating)" },
  { id: "error", label: "The design does not elaborate" },
];

function DriverRow({ driver, onChange, onRemove }: { driver: NetDriver; onChange: (drv: NetDriver) => void; onRemove?: () => void }) {
  const selectId = useId();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-2">
      <span className="font-mono text-sm font-semibold [font-variant-ligatures:none]">driver {driver.id}</span>
      <SegmentedControl
        label={`Value driven by ${driver.id}`}
        mono
        value={driver.value}
        onChange={(value) => onChange({ ...driver, value })}
        options={BIT4_VALUES.map((v) => ({ value: v, label: v }))}
      />
      <label htmlFor={selectId} className="sr-only">
        Strength of driver {driver.id}
      </label>
      <select
        id={selectId}
        value={driver.strength}
        onChange={(e) => onChange({ ...driver, strength: e.target.value as DriveStrength })}
        className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {DRIVE_STRENGTHS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {driver.value === "z" ? <span className="text-xs text-muted-foreground">off: strength does not matter</span> : null}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove driver ${driver.id}`}
          className="ml-auto min-h-9 rounded-md border border-border/70 px-2 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}

function DriversMode({ initialPreset }: { initialPreset?: string }) {
  const start = PRESETS.find((p) => p.id === initialPreset) ?? PRESETS[1];
  const [view, setView] = useState<"free" | "open-drain">(initialPreset === "open-drain" ? "open-drain" : "free");
  const [net, setNet] = useState<NetType>(start.net);
  const [drivers, setDrivers] = useState<NetDriver[]>(() => start.drivers.map((x) => ({ ...x })));
  const [charge, setCharge] = useState<ChargeStrength>("medium");
  const result = resolveNet(net, drivers, { charge });
  const key = `${net}:${charge}:${drivers.map((x) => `${x.id}${x.value}${x.strength}`).join(",")}`;
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const revealed = revealedKey === key;
  const truth: Bit4 | "error" = result.ok ? result.value : "error";

  const feedbackFor = (guess: Bit4 | "error"): string => {
    if (guess === truth) return result.why;
    if (guess === "error") {
      return net === "uwire"
        ? "This uwire has a single driver, which is exactly what it allows."
        : "Nets exist to accept several continuous drivers and resolve them. Only variables and uwire reject a second continuous driver.";
    }
    if (!result.ok) return result.why;
    return diagnoseNetGuess(net, drivers, guess, { charge });
  };

  const options: PredictionOption[] = GUESSES.map((g) => ({ id: g.id, label: g.label, correct: g.id === truth, feedback: feedbackFor(g.id) }));

  const updateDriver = (i: number, drv: NetDriver) => setDrivers((list) => list.map((x, k) => (k === i ? drv : x)));
  const sources = drivers.map((drv) => `logic ${drv.id} = 1'b${drv.value};${drv.value === "z" ? "   // driver off" : ""}`);
  const lines = [
    "// driver values you picked",
    ...sources,
    netDeclarationSource(net, "y", charge) + (net === "tri0" ? "   // built-in pull-down" : net === "tri1" ? "   // built-in pull-up" : ""),
    ...drivers.map((drv) => driverAssignSource(drv)),
  ];

  const presetBar = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Load a corner case:</span>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            setView("free");
            setNet(p.net);
            setDrivers(p.drivers.map((x) => ({ ...x })));
          }}
          className="min-h-9 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {p.label}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={view === "open-drain"}
        onClick={() => setView("open-drain")}
        className={cn(
          "min-h-9 rounded-full border px-3 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          view === "open-drain" ? "border-cyan-500/70 bg-cyan-500/10 text-foreground" : "border-border/70 text-muted-foreground",
        )}
      >
        Open-drain on tri1
      </button>
    </div>
  );

  if (view === "open-drain") {
    return (
      <div className="space-y-4">
        {presetBar}
        <OpenDrainPanel />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Net type</p>
        <SegmentedControl label="Net type" mono value={net} onChange={setNet} options={NET_CHOICES} />
        {net === "trireg" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Charge strength</span>
            <SegmentedControl label="trireg charge strength" mono value={charge} onChange={setCharge} options={CHARGE_STRENGTHS.map((c) => ({ value: c, label: c }))} />
          </div>
        ) : null}
      </div>
      {presetBar}
      <div className="space-y-2">
        {drivers.map((drv, i) => (
          <DriverRow
            key={drv.id}
            driver={drv}
            onChange={(x) => updateDriver(i, x)}
            onRemove={drivers.length > 2 ? () => setDrivers((list) => list.filter((_, k) => k !== i)) : undefined}
          />
        ))}
        {drivers.length < 3 ? (
          <button
            type="button"
            onClick={() => {
              const id = DRIVER_IDS.find((x) => !drivers.some((drv) => drv.id === x)) ?? "c";
              setDrivers((list) => [...list, d(id, "z", "strong")]);
            }}
            className="min-h-9 rounded-md border border-dashed border-border/70 px-3 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            + Add a third driver
          </button>
        ) : null}
      </div>
      <StrengthLadder net={net} drivers={drivers} result={revealed && result.ok ? result : null} charge={net === "trireg" ? charge : undefined} />
      <CodeTrace label="The code" lines={codeLines(lines)} />
      <PredictionPrompt resetKey={key} question={<>What does <code className="font-mono">y</code> resolve to?</>} options={options}>
        <OnReveal revealKey={key} onReveal={setRevealedKey} />
        <ResultBanner result={result} />
      </PredictionPrompt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mode 2: variable vs net (who may drive)                             */
/* ------------------------------------------------------------------ */

type Decl = "logic" | "wire" | "uwire";
type Pattern = "two-assign" | "two-always" | "assign-always" | "comb-initial";

const PATTERNS: Record<Pattern, { label: string; writers: Writer[]; code: string[] }> = {
  "two-assign": {
    label: "two assign",
    writers: [
      { id: "assign y = a", kind: "assign" },
      { id: "assign y = b", kind: "assign" },
    ],
    code: ["assign y = a;", "assign y = b;"],
  },
  "two-always": {
    label: "two always",
    writers: [
      { id: "always @(a)", kind: "procedural" },
      { id: "always @(b)", kind: "procedural" },
    ],
    code: ["always @(a) y = a;", "always @(b) y = b;"],
  },
  "assign-always": {
    label: "assign + always",
    writers: [
      { id: "assign y = a", kind: "assign" },
      { id: "always @(b)", kind: "procedural" },
    ],
    code: ["assign y = a;", "always @(b) y = b;"],
  },
  "comb-initial": {
    label: "always_comb + initial",
    writers: [
      { id: "always_comb", kind: "always_comb" },
      { id: "initial", kind: "procedural" },
    ],
    code: ["always_comb y = a;", "initial     y = 1'b0;"],
  },
};

type LegalityGuess = "resolves" | "last-write" | "error";

function legalityFeedback(check: DriverCheck, decl: Decl, guess: LegalityGuess): string {
  const truth: LegalityGuess = check.outcome === "compile-error" ? "error" : check.outcome === "last-write-wins" ? "last-write" : "resolves";
  if (guess === truth) return check.why;
  if (guess === "resolves") {
    if (check.errorClass === "multiple-continuous-on-variable") return "Only nets have a resolution function. A variable with two continuous drivers is rejected by the tool, not resolved to x (§6.5).";
    if (check.errorClass === "procedural-on-net") return "A net cannot be assigned procedurally at all, so there is nothing to resolve (§6.5).";
    if (check.outcome === "last-write-wins") return "Procedural writes to a variable do not fight. Each write simply replaces the value (§6.5).";
    return check.why;
  }
  if (guess === "last-write") {
    if (check.outcome === "net-resolves") return "A net never remembers a last write. It continuously combines all of its drivers.";
    if (check.errorClass === "multiple-continuous-on-variable" || check.errorClass === "mixed-continuous-procedural") {
      return "A continuous assignment is not a write that happens once: it drives y all the time. The standard forbids a second driver of any kind on such a variable (§6.5, §10.3.2).";
    }
    return check.why;
  }
  // Guessed error.
  if (check.outcome === "last-write-wins") return "Several procedural writers are legal for a plain variable; the last write wins (§6.5). It is still a race if both write in the same time step.";
  if (check.outcome === "net-resolves") return `Several continuous drivers are exactly what a ${decl} is for: they are resolved, not rejected.`;
  return check.why;
}

function WholeVariableLab() {
  const [decl, setDecl] = useState<Decl>("logic");
  const [pattern, setPattern] = useState<Pattern>("two-assign");
  const p = PATTERNS[pattern];
  const kind: DeclKind = decl === "logic" ? "variable" : decl;
  const check = checkDrivers(kind, p.writers);
  const truth: LegalityGuess = check.outcome === "compile-error" ? "error" : check.outcome === "last-write-wins" ? "last-write" : "resolves";
  const options: PredictionOption[] = [
    { id: "resolves", label: "It compiles, and y is the resolved value of both drivers", correct: truth === "resolves", feedback: legalityFeedback(check, decl, "resolves") },
    { id: "last-write", label: "It compiles, and y holds whichever write happened last", correct: truth === "last-write", feedback: legalityFeedback(check, decl, "last-write") },
    { id: "error", label: "It does not compile: the tool reports an illegal driver", correct: truth === "error", feedback: legalityFeedback(check, decl, "error") },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Declaration of y</p>
          <SegmentedControl
            label="Declaration of y"
            mono
            value={decl}
            onChange={setDecl}
            options={[
              { value: "logic", label: "logic y (variable)", ariaLabel: "logic y, a variable" },
              { value: "wire", label: "wire y (net)", ariaLabel: "wire y, a net" },
              { value: "uwire", label: "uwire y", ariaLabel: "uwire y, a single-driver net" },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Who writes y</p>
          <SegmentedControl
            label="Who writes y"
            mono
            value={pattern}
            onChange={setPattern}
            options={(Object.keys(PATTERNS) as Pattern[]).map((k) => ({ value: k, label: PATTERNS[k].label }))}
          />
        </div>
      </div>
      <CodeTrace label="The code" lines={codeLines(["logic a, b;", `${decl} y;`, ...p.code])} />
      <PredictionPrompt resetKey={`${decl}:${pattern}`} question="What does the tool do with this code?" options={options}>
        <div aria-live="polite" className="space-y-2 text-sm">
          <div
            className={cn(
              "rounded-lg border px-3 py-2 font-medium",
              check.legal
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-rose-500/60 bg-rose-500/10 text-rose-800 dark:text-rose-200",
            )}
          >
            {check.legal ? "✓ " : "✕ "}
            {check.message}
          </div>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Why: </strong>
            {check.why}
          </p>
          {check.outcome === "compile-error" ? <p className="text-xs text-muted-foreground">Real tools word this differently; the error class is what the standard requires ({check.clause}).</p> : null}
        </div>
      </PredictionPrompt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drivers mode, open-drain preset: (strong0, highz1) on tri1          */
/* ------------------------------------------------------------------ */

const OPEN_DRAIN_IDS = ["dev_a", "dev_b"] as const;
const OD_NET = "sda";

const OD_GUESSES: { id: Bit4; label: string }[] = [
  { id: "0", label: `${OD_NET} reads 0` },
  { id: "1", label: `${OD_NET} reads 1` },
  { id: "x", label: `${OD_NET} reads x` },
  { id: "z", label: `${OD_NET} reads z (floating)` },
];

const comboKey = (pullLow: readonly boolean[]) => pullLow.map((p) => (p ? "L" : "R")).join("");

function OpenDrainPanel() {
  const [pullLow, setPullLow] = useState<boolean[]>([false, false]);
  const [seen, setSeen] = useState<string[]>([]);
  const devices: OpenDrainDevice[] = OPEN_DRAIN_IDS.map((id, i) => ({ id, pullLow: pullLow[i] }));
  const drivers = devices.map(openDrainDriver);
  const result = resolveNet("tri1", drivers);
  const key = comboKey(pullLow);
  const rows = openDrainTruthTable(OPEN_DRAIN_IDS);
  const allSeen = rows.every((r) => seen.includes(comboKey(r.pullLow)));
  const markSeen = useCallback((k: string) => setSeen((list) => (list.includes(k) ? list : [...list, k])), []);
  const truth: Bit4 | "error" = result.ok ? result.value : "error";

  const options: PredictionOption[] = OD_GUESSES.map((g) => ({
    id: g.id,
    label: g.label,
    correct: g.id === truth,
    feedback: diagnoseNetGuess("tri1", drivers, g.id),
  }));

  const lines = [
    `tri1 ${OD_NET};`,
    ...devices.map((dev) => `logic ${openDrainControl(dev)} = 1'b${dev.pullLow ? 1 : 0};`),
    ...devices.map((dev) => openDrainAssignSource(dev, OD_NET)),
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Two devices share an open-drain line. Each one can only pull <code className="font-mono">{OD_NET}</code> low or let go. Set each device, predict, reveal, and cover all four combinations.
      </p>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        {devices.map((dev, i) => (
          <div key={dev.id}>
            <p className="mb-1 font-mono text-xs font-medium text-muted-foreground [font-variant-ligatures:none]">{dev.id}</p>
            <SegmentedControl
              label={`${dev.id} action`}
              value={dev.pullLow ? "low" : "release"}
              onChange={(v) => setPullLow((list) => list.map((p, k) => (k === i ? v === "low" : p)))}
              options={[
                { value: "low", label: "pulls low", ariaLabel: `${dev.id} pulls low` },
                { value: "release", label: "lets go", ariaLabel: `${dev.id} lets go` },
              ]}
            />
          </div>
        ))}
      </div>
      <CodeTrace label="The code" lines={codeLines(lines)} />
      <PredictionPrompt resetKey={key} question={<>What does <code className="font-mono">{OD_NET}</code> read?</>} options={options}>
        <OnReveal revealKey={key} onReveal={markSeen} />
        <div className="space-y-3">
          <ResultBanner result={result} netName={OD_NET} />
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {devices.map((dev) => (
              <li key={dev.id}>{describeOpenDrainDevice(dev)}</li>
            ))}
          </ul>
          <StrengthLadder net="tri1" drivers={drivers.map(effectiveDriver)} result={result} />
        </div>
      </PredictionPrompt>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-sm">
          <caption className="mb-1 text-left text-xs text-muted-foreground">All four combinations. A row fills in once you have predicted it.</caption>
          <thead>
            <tr>
              {OPEN_DRAIN_IDS.map((id) => (
                <th key={id} scope="col" className="border border-border/60 px-2 py-1 text-left font-mono font-medium [font-variant-ligatures:none]">
                  {id}
                </th>
              ))}
              <th scope="col" className="border border-border/60 px-2 py-1 font-mono font-medium">{OD_NET}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const k = comboKey(r.pullLow);
              const shown = seen.includes(k);
              return (
                <tr key={k} className={cn(k === key && "bg-amber-500/10")}>
                  {r.pullLow.map((p, i) => (
                    <td key={OPEN_DRAIN_IDS[i]} className="border border-border/60 px-2 py-1 text-xs">
                      {p ? "pulls low" : "lets go"}
                    </td>
                  ))}
                  <td className="border border-border/60 px-2 py-1 text-center">
                    {shown && r.result.ok ? (
                      <span className="inline-flex items-center gap-1">
                        <ValueChip value={chipValue(r.result.value)} />
                        <span className="font-mono text-xs">{r.result.label}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">predict first</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {allSeen ? (
        <p className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-sm" aria-live="polite">
          <strong>The pattern: </strong>
          {openDrainSummary(rows, OD_NET)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {seen.length} of {rows.length} combinations predicted.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mode 2: legality labs                                               */
/* ------------------------------------------------------------------ */

type LegalityView = "whole" | LegalityPattern;

function LegalityMode({ initialPattern }: { initialPattern?: LegalityPattern }) {
  const [view, setView] = useState<LegalityView>(initialPattern ?? "whole");
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">What to check</p>
        <SegmentedControl
          label="Legality lab"
          value={view}
          onChange={setView}
          options={[
            { value: "whole", label: "Whole variable" },
            { value: "bitwise", label: "Bits of logic [1:0] v" },
            { value: "ports", label: "Port kinds" },
          ]}
        />
      </div>
      {view === "whole" ? <WholeVariableLab /> : null}
      {view === "bitwise" ? <BitwiseLab /> : null}
      {view === "ports" ? <PortKindLab /> : null}
    </div>
  );
}

/* Per-bit driver rule on logic [1:0] v ------------------------------- */

const V = "v";
const V_WIDTH = 2;

interface BitWriterChoice {
  key: string;
  writer: Writer;
  /** Source line, built from the writer's select. */
  line: string;
}

const bitWriter = (key: string, kind: Writer["kind"], bits: [number, number], make: (lhs: string) => string): BitWriterChoice => {
  const line = make(selectText(V, bits, V_WIDTH));
  return { key, line, writer: { id: line.replace(/;$/, ""), kind, bits } };
};

const BIT_WRITERS: BitWriterChoice[] = [
  bitWriter("a0", "assign", [0, 0], (lhs) => `assign ${lhs} = a;`),
  bitWriter("a1", "assign", [1, 1], (lhs) => `assign ${lhs} = b;`),
  bitWriter("aw", "assign", [1, 0], (lhs) => `assign ${lhs} = c;`),
  bitWriter("c1", "always_comb", [1, 1], (lhs) => `always_comb ${lhs} = b & c;`),
  bitWriter("init", "initializer", [1, 0], (lhs) => `logic [${V_WIDTH - 1}:0] ${lhs} = ${V_WIDTH}'b${"0".repeat(V_WIDTH)};`),
  bitWriter("port", "port", [1, 0], (lhs) => `sub u_sub (.q(${lhs}));`),
];

const WRITER_NOTES: Record<string, string> = {
  init: "declaration initializer",
  port: "output port of an instance",
};

const BIT_PRESETS: { id: string; label: string; keys: string[] }[] = [
  { id: "split", label: "Split bits", keys: ["a0", "a1"] },
  { id: "overlap", label: "Whole v plus v[1]", keys: ["aw", "a1"] },
  { id: "comb", label: "assign v[0] + always_comb v[1]", keys: ["a0", "c1"] },
  { id: "init", label: "Initializer + assign v", keys: ["init", "aw"] },
];

type CompileGuess = "ok" | "error" | "open";

const compileTruth = (c: DriverCheck): CompileGuess => (c.outcome === "compile-error" ? "error" : c.outcome === "tool-dependent" ? "open" : "ok");

function compileFeedback(check: DriverCheck, guess: CompileGuess): string {
  const truth = compileTruth(check);
  if (guess === truth) return check.why;
  if (truth === "open") return `Neither answer is guaranteed. ${check.why}`;
  if (guess === "open") {
    return check.openBits?.length
      ? `Part of it is left to the tool, but another bit breaks the rule, so it does not compile either way. ${check.why}`
      : `The standard settles this case. ${check.why}`;
  }
  if (truth === "error") return `One bit breaks the rule. ${check.why}`;
  return `No bit has a forbidden mix of writers. ${check.why}`;
}

function BitwiseLab() {
  const [keys, setKeys] = useState<string[]>(BIT_PRESETS[0].keys);
  const chosen = BIT_WRITERS.filter((w) => keys.includes(w.key));
  const check = checkDrivers("variable", chosen.map((w) => w.writer), { width: V_WIDTH, name: V });
  const key = BIT_WRITERS.filter((w) => keys.includes(w.key)).map((w) => w.key).join(",");
  const init = chosen.find((w) => w.writer.kind === "initializer");
  const lines = [
    "logic a, b, c;",
    init ? init.line : `logic [${V_WIDTH - 1}:0] ${V};`,
    ...chosen.filter((w) => w !== init).map((w) => w.line),
  ];
  if (chosen.some((w) => w.key === "port")) lines.push(`// module sub (output logic [${V_WIDTH - 1}:0] q); …`);
  const toggle = (k: string) => setKeys((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]));
  const options: PredictionOption[] = (
    [
      { id: "ok", label: "It compiles" },
      { id: "error", label: "It does not compile" },
      { id: "open", label: "The standard leaves it to the tool" },
    ] as { id: CompileGuess; label: string }[]
  ).map((o) => ({ ...o, correct: o.id === compileTruth(check), feedback: compileFeedback(check, o.id) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Load a row of the lesson table:</span>
        {BIT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setKeys(p.keys)}
            className="min-h-9 rounded-full border border-border/70 px-3 py-1 font-mono text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [font-variant-ligatures:none]"
          >
            {p.label}
          </button>
        ))}
      </div>
      <fieldset className="space-y-2 rounded-lg border border-border/60 p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          Writers of <code className="font-mono">logic [{V_WIDTH - 1}:0] {V}</code>
        </legend>
        {BIT_WRITERS.map((w) => (
          <label key={w.key} className="flex min-h-9 cursor-pointer flex-wrap items-center gap-2 text-sm">
            <input type="checkbox" checked={keys.includes(w.key)} onChange={() => toggle(w.key)} className="h-4 w-4 accent-cyan-600" />
            <code className="break-all font-mono text-xs [font-variant-ligatures:none]">{w.line}</code>
            {WRITER_NOTES[w.key] ? <span className="text-xs text-muted-foreground">({WRITER_NOTES[w.key]})</span> : null}
          </label>
        ))}
      </fieldset>
      <CodeTrace label="The code" lines={codeLines(lines)} />
      {chosen.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tick at least one writer, then predict.</p>
      ) : (
        <PredictionPrompt resetKey={key} question="What does the tool do with these writers?" options={options}>
          <div className="space-y-3" aria-live="polite">
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium",
                check.outcome === "compile-error"
                  ? "border-rose-500/60 bg-rose-500/10 text-rose-800 dark:text-rose-200"
                  : check.outcome === "tool-dependent"
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                    : "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
              )}
            >
              {check.outcome === "compile-error" ? "✕ " : check.outcome === "tool-dependent" ? "? " : "✓ "}
              {check.message}
            </div>
            <ul className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))]" aria-label={`Writers of each bit of ${V}`}>
              {(check.bits ?? []).map((bit) => {
                // Each card is coloured from its own bit's check, so an open bit stays amber even when another bit has an error.
                const bitOutcome = bit.check?.outcome;
                const tag = bitConflictTag(bit.check);
                const writers = chosen.filter((w) => bit.writers.includes(w.writer.id));
                return (
                  <li
                    key={bit.index}
                    className={cn(
                      "rounded-lg border p-2",
                      bitOutcome === "compile-error"
                        ? "border-rose-500/70 bg-rose-500/10"
                        : bitOutcome === "tool-dependent"
                          ? "border-amber-500/70 bg-amber-500/10"
                          : "border-emerald-500/50 bg-emerald-500/[0.06]",
                    )}
                    data-outcome={bitOutcome ?? "no-writer"}
                  >
                    <p className="font-mono text-sm font-semibold [font-variant-ligatures:none]">
                      {V}[{bit.index}]
                      {tag ? <span className="ml-2 text-xs font-normal">{tag}</span> : null}
                    </p>
                    {writers.length === 0 ? <p className="text-xs text-muted-foreground">{bit.check?.why ?? checkDrivers("variable", []).why}</p> : null}
                    <ul className="mt-1 space-y-1">
                      {writers.map((w) => {
                        const continuous = isContinuousWriter(w.writer.kind, "variable");
                        return (
                          <li key={w.key} className="flex flex-wrap items-center gap-1 text-xs">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                continuous ? "bg-cyan-500/20 text-cyan-900 dark:text-cyan-100" : "bg-violet-500/20 text-violet-900 dark:text-violet-100",
                              )}
                            >
                              {continuous ? "continuous" : "procedural"}
                            </span>
                            <code className="break-all font-mono [font-variant-ligatures:none]">{w.writer.id}</code>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Why: </strong>
              {check.why}
            </p>
            {check.outcome === "compile-error" ? <p className="text-xs text-muted-foreground">Real tools word this differently; the error class is what the standard requires ({check.clause}).</p> : null}
          </div>
        </PredictionPrompt>
      )}
    </div>
  );
}

/* Port kinds (§23.2.2.3) --------------------------------------------- */

const DIRECTIONS: PortDirection[] = ["input", "output", "inout", "ref"];
const DATA_TYPES: { value: PortDataType; label: string; ariaLabel: string }[] = [
  { value: "omitted", label: "(none)", ariaLabel: "data type omitted" },
  { value: "implicit", label: "[7:0]", ariaLabel: "implicit data type [7:0]" },
  { value: "explicit", label: "logic", ariaLabel: "explicit data type logic" },
];
const KIND_KEYWORDS: { value: PortKindKeyword; label: string; ariaLabel: string }[] = [
  { value: "none", label: "(none)", ariaLabel: "no port kind keyword" },
  { value: "net", label: "wire", ariaLabel: "port kind wire" },
  { value: "var", label: "var", ariaLabel: "port kind var" },
];

const PORT_PRESETS: [PortDirection, PortDataType, PortKindKeyword][] = [
  ["input", "explicit", "none"],
  ["input", "implicit", "none"],
  ["inout", "explicit", "none"],
  ["output", "explicit", "none"],
  ["output", "implicit", "none"],
  ["output", "explicit", "var"],
  ["inout", "explicit", "var"],
];

type KindGuess = PortKindResult["kind"];

const KIND_WORD: Record<KindGuess, string> = { net: "a net", variable: "a variable", illegal: "illegal" };

function kindFeedback(r: PortKindResult, guess: KindGuess): string {
  if (guess === r.kind) return r.why;
  if (r.kind === "illegal") return `This declaration is illegal, so it is neither a net nor a variable. ${r.why}`;
  if (guess === "illegal") return `The declaration is legal: ${r.declared} is ${KIND_WORD[r.kind]}. ${r.why}`;
  return `${r.declared} is ${KIND_WORD[r.kind]}, not ${KIND_WORD[guess]}. ${r.why}`;
}

function PortKindLab() {
  const [direction, setDirection] = useState<PortDirection>("input");
  const [dataType, setDataType] = useState<PortDataType>("explicit");
  const [keyword, setKeyword] = useState<PortKindKeyword>("none");
  const r = portKind(direction, dataType, keyword);
  const key = `${direction}:${dataType}:${keyword}`;
  const options: PredictionOption[] = (["net", "variable", "illegal"] as KindGuess[]).map((g) => ({
    id: g,
    label: g === "illegal" ? "It does not compile" : `It is ${KIND_WORD[g]}`,
    correct: g === r.kind,
    feedback: kindFeedback(r, g),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Load a declaration:</span>
        {PORT_PRESETS.map(([dir, dt, kw]) => {
          const declared = portKind(dir, dt, kw).declared;
          return (
            <button
              key={declared}
              type="button"
              onClick={() => {
                setDirection(dir);
                setDataType(dt);
                setKeyword(kw);
              }}
              className="min-h-9 rounded-full border border-border/70 px-3 py-1 font-mono text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [font-variant-ligatures:none]"
            >
              {declared}
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Direction</p>
          <SegmentedControl label="Port direction" mono value={direction} onChange={setDirection} options={DIRECTIONS.map((d2) => ({ value: d2, label: d2 }))} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Data type</p>
          <SegmentedControl label="Port data type" mono value={dataType} onChange={setDataType} options={DATA_TYPES} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Port kind keyword</p>
          <SegmentedControl label="Port kind keyword" mono value={keyword} onChange={setKeyword} options={KIND_KEYWORDS} />
        </div>
      </div>
      <CodeTrace label="The code" lines={codeLines(["module m (", `  ${r.declared}`, ");"])} />
      <p className="text-xs text-muted-foreground">
        Rules for the first port of an ANSI port list with <code className="font-mono">`default_nettype wire</code>. A later port that omits direction, kind and data type inherits them from the previous port (§23.2.2.3). Only the 4-state type logic is offered, because a net needs a 4-state data type (§6.7.1).
      </p>
      <PredictionPrompt resetKey={key} question={<>Is this port a net or a variable?</>} options={options}>
        <div className="space-y-2 text-sm" aria-live="polite">
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2",
              r.kind === "illegal" ? "border-rose-500/60 bg-rose-500/10" : r.kind === "net" ? "border-cyan-500/60 bg-cyan-500/10" : "border-violet-500/60 bg-violet-500/10",
            )}
          >
            <strong>{r.kind === "illegal" ? "✕ Compile error" : `It is ${KIND_WORD[r.kind]}`}</strong>
            {r.expanded ? (
              <span className="text-xs">
                written out in full: <code className="font-mono [font-variant-ligatures:none]">{r.expanded}</code>
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Why: </strong>
            {r.why}
          </p>
        </div>
      </PredictionPrompt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mode 3: trireg charge retention                                      */
/* ------------------------------------------------------------------ */

function TriregMode() {
  const [charge, setCharge] = useState<ChargeStrength>("medium");
  const [first, setFirst] = useState<Bit4>("1");
  const steps: { time: string; story: string; drivers: NetDriver[] }[] = [
    { time: "0 ns", story: `a drives ${first} (strong); b is off`, drivers: [d("a", first, "strong"), d("b", "z", "weak")] },
    { time: "10 ns", story: "a lets go (z); b is still off", drivers: [d("a", "z", "strong"), d("b", "z", "weak")] },
    { time: "20 ns", story: "b drives 0 (weak)", drivers: [d("a", "z", "strong"), d("b", "0", "weak")] },
  ];
  const trireg = resolveNetOverTime("trireg", steps.map((s) => s.drivers), { charge });
  const wire = resolveNetOverTime("wire", steps.map((s) => s.drivers));
  const at10 = trireg[1];
  const truth: Bit4 = at10.ok ? at10.value : "x";
  const options: PredictionOption[] = (
    [
      { id: "z", label: "y reads z: nothing drives it" },
      { id: first, label: `y keeps ${first}` },
      { id: "x", label: "y becomes x: the stored value is unknown" },
      { id: first === "0" ? "1" : "0", label: `y reads ${first === "0" ? "1" : "0"}` },
    ] as { id: Bit4; label: string }[]
  )
    .filter((o, i, list) => list.findIndex((p) => p.id === o.id) === i)
    .map((o) => ({ id: o.id, label: o.label, correct: o.id === truth, feedback: diagnoseNetGuess("trireg", steps[1].drivers, o.id, { charge, stored: first }) }));

  const lines = [
    `trireg (${charge}) y;           // charge storage node`,
    `logic a = 1'b${first}, a_en = 1'b1;`,
    "logic b = 1'b0, b_en = 1'b0;",
    "assign (strong0, strong1) y = a_en ? a : 1'bz;",
    "assign (weak0, weak1)     y = b_en ? b : 1'bz;",
    "initial begin",
    "  #10 a_en = 1'b0;   // a lets go of y",
    "  #10 b_en = 1'b1;   // weak b drives 0",
    "end",
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Value a drives at 0 ns</p>
          <SegmentedControl label="Value a drives at 0 ns" mono value={first} onChange={setFirst} options={(["0", "1", "x"] as Bit4[]).map((v) => ({ value: v, label: v }))} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">trireg charge strength</p>
          <SegmentedControl label="trireg charge strength" mono value={charge} onChange={setCharge} options={CHARGE_STRENGTHS.map((c) => ({ value: c, label: c }))} />
        </div>
      </div>
      <CodeTrace label="The code" lines={codeLines(lines)} />
      <PredictionPrompt resetKey={`${charge}:${first}`} question={<>At <code className="font-mono">t = 10 ns</code> every driver is z. What does the trireg <code className="font-mono">y</code> read?</>} options={options}>
        <div className="space-y-3" aria-live="polite">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] border-collapse text-sm">
              <caption className="mb-1 text-left text-xs text-muted-foreground">The same drivers on a trireg and on a wire. Time is simulation time.</caption>
              <thead>
                <tr>
                  <th scope="col" className="border border-border/60 px-2 py-1 text-left">t</th>
                  <th scope="col" className="border border-border/60 px-2 py-1 text-left">drivers</th>
                  <th scope="col" className="border border-border/60 px-2 py-1">trireg y</th>
                  <th scope="col" className="border border-border/60 px-2 py-1">wire y</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s, i) => {
                  const t = trireg[i];
                  const w = wire[i];
                  return (
                    <tr key={s.time} className={cn(i === 1 && "bg-amber-500/10")}>
                      <th scope="row" className="border border-border/60 px-2 py-1 text-left font-mono font-normal">{s.time}</th>
                      <td className="border border-border/60 px-2 py-1 text-xs text-muted-foreground">{s.story}</td>
                      <td className="border border-border/60 px-2 py-1 text-center">
                        {t.ok ? (
                          <span className="inline-flex items-center gap-1">
                            <ValueChip value={chipValue(t.value)} />
                            <span className="font-mono text-xs">{t.label}</span>
                          </span>
                        ) : null}
                      </td>
                      <td className="border border-border/60 px-2 py-1 text-center">
                        {w.ok ? (
                          <span className="inline-flex items-center gap-1">
                            <ValueChip value={chipValue(w.value)} />
                            <span className="font-mono text-xs">{strengthLabel(w.value, w.strength)}</span>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {trireg.map((t, i) => (t.ok ? <li key={steps[i].time}><strong className="text-foreground">{steps[i].time}:</strong> {t.why}</li> : null))}
          </ul>
          <StrengthLadder net="trireg" drivers={steps[1].drivers} result={at10} charge={charge} />
        </div>
      </PredictionPrompt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export default function NetResolutionSimulator({ initialMode, pattern, preset }: NetResolutionSimulatorProps = {}) {
  const [mode, setMode] = useState<Mode>(initialMode ?? (pattern ? "legality" : "drivers"));
  return (
    <VisualFrame
      label="Net resolution simulator"
      eyebrow="Experiment"
      title="Who wins the wire?"
      summary="Pick a net type and its drivers, predict, then reveal. Strength is compared first; values only fight at equal strength."
      fidelity="model"
      assumptions={NET_MODEL_ASSUMPTIONS}
    >
      <SegmentedControl
        label="Simulator mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "drivers", label: "Drivers on a net" },
          { value: "legality", label: "Variable vs net" },
          { value: "trireg", label: "trireg holds charge" },
        ]}
      />
      <div className="min-w-0">
        {mode === "drivers" ? <DriversMode initialPreset={preset} /> : null}
        {mode === "legality" ? <LegalityMode initialPattern={pattern} /> : null}
        {mode === "trireg" ? <TriregMode /> : null}
      </div>
    </VisualFrame>
  );
}
