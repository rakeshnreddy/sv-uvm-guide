"use client";

import React, { useEffect, useId, useState } from "react";

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
  checkDrivers,
  diagnoseNetGuess,
  driverAssignSource,
  netDeclarationSource,
  resolveNet,
  resolveNetOverTime,
  strengthLabel,
  type Bit4,
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
  "One scalar net. Each driver uses the same strength for 0 and 1, as in assign (strong0, strong1). tri, triand and trior behave exactly like wire, wand and wor.",
  "Not modelled: trireg charge-decay delays, switches and charge sharing between triregs, L/H partial values from gates, user-defined nettypes.",
  "Compile errors are shown as the error class the standard requires; real tools word them differently.",
];

type Mode = "drivers" | "legality" | "trireg";

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

function ResultBanner({ result }: { result: NetResolution }) {
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
        <ValueChip name="y" value={chipValue(result.value)} />
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

function DriversMode() {
  const [net, setNet] = useState<NetType>("wire");
  const [drivers, setDrivers] = useState<NetDriver[]>(PRESETS[1].drivers);
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
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Load a corner case:</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setNet(p.net);
              setDrivers(p.drivers.map((x) => ({ ...x })));
            }}
            className="min-h-9 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {p.label}
          </button>
        ))}
      </div>
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

function LegalityMode() {
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
          {!check.legal ? <p className="text-xs text-muted-foreground">Real tools word this differently; the error class is what the standard requires ({check.clause}).</p> : null}
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

export default function NetResolutionSimulator() {
  const [mode, setMode] = useState<Mode>("drivers");
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
        {mode === "drivers" ? <DriversMode /> : null}
        {mode === "legality" ? <LegalityMode /> : null}
        {mode === "trireg" ? <TriregMode /> : null}
      </div>
    </VisualFrame>
  );
}
