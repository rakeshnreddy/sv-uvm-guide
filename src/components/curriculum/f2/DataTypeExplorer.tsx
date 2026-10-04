"use client";

import React, { useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { classifyValue, valueStyles } from "@/components/visual-system/visual-language";
import {
  assignToIntegral,
  defaultNetValue,
  defaultVariableValue,
  formatLiteral,
  INTEGRAL_TYPES,
  parseBits,
  toSigned,
  toUnsigned,
  type Bit4,
  type IntegralTypeId,
} from "@/lib/sv-four-state-model";
import { cn } from "@/lib/utils";

type DataTypeId = "logic" | "reg" | "bit" | "int" | "byte" | "integer" | "wire";

interface DataTypeDescriptor {
  id: DataTypeId;
  /** Declaration shown in code. */
  decl: string;
  label: string;
  family: "Variable" | "Net";
  /** Integral type the widths/defaults come from (Table 6-8); wire is a 4-state net of logic. */
  base: IntegralTypeId;
  width: number;
  summary: string;
  writers: string;
  hardware: string;
  clauses: string;
}

/** Rules are paraphrased from IEEE 1800-2023 and cite the clause they come from. Widths, states and signedness come from the model (Table 6-8). */
const DATA_TYPES: DataTypeDescriptor[] = [
  {
    id: "logic",
    decl: "logic [3:0] v;",
    label: "logic [3:0]",
    family: "Variable",
    base: "logic",
    width: 4,
    summary: "4-state integral variable with a width you choose. logic and reg name the same type.",
    writers: "Any number of procedural writes (the last write wins), or exactly one continuous assignment or port.",
    hardware: "None implied. How the code writes it decides whether synthesis builds a wire, a latch or a flop.",
    clauses: "§6.5, §6.11.2, Table 6-8",
  },
  {
    id: "reg",
    decl: "reg [3:0] v;",
    label: "reg [3:0]",
    family: "Variable",
    base: "reg",
    width: 4,
    summary: "The same type as logic, kept for compatibility. Despite its name it does not imply a register.",
    writers: "Same rules as logic: procedural writes, or one continuous assignment or port.",
    hardware: "None implied. Prefer logic in new code: the name reg misleads readers.",
    clauses: "§6.11.2, Table 6-8",
  },
  {
    id: "bit",
    decl: "bit [3:0] v;",
    label: "bit [3:0]",
    family: "Variable",
    base: "bit",
    width: 4,
    summary: "2-state integral variable with a width you choose. x and z written into it become 0.",
    writers: "Same rules as any variable.",
    hardware: "None implied. Safe for testbench data that must never be x; risky for DUT-facing signals because it erases x.",
    clauses: "§6.11.2, Table 6-7, Table 6-8",
  },
  {
    id: "int",
    decl: "int v;",
    label: "int",
    family: "Variable",
    base: "int",
    width: 32,
    summary: "2-state, 32-bit, signed integer. It starts at 0 and turns any x or z it receives into 0.",
    writers: "Same rules as any variable.",
    hardware: "None implied. Good for loop counters and scoreboard arithmetic.",
    clauses: "§6.11.2, Table 6-7, Table 6-8",
  },
  {
    id: "byte",
    decl: "byte v;",
    label: "byte",
    family: "Variable",
    base: "byte",
    width: 8,
    summary: "2-state, 8-bit, signed: 8'hFF reads as -1. Use byte unsigned for raw 0–255 data.",
    writers: "Same rules as any variable.",
    hardware: "None implied.",
    clauses: "§6.11.3, Table 6-8",
  },
  {
    id: "integer",
    decl: "integer v;",
    label: "integer",
    family: "Variable",
    base: "integer",
    width: 32,
    summary: "4-state, 32-bit, signed. Unlike int it can hold x and z, and it starts as x.",
    writers: "Same rules as any variable.",
    hardware: "None implied.",
    clauses: "§6.11.2, Table 6-7, Table 6-8",
  },
  {
    id: "wire",
    decl: "wire [3:0] v;",
    label: "wire [3:0]",
    family: "Net",
    base: "logic",
    width: 4,
    summary: "A net: it stores nothing itself and shows the resolved value of its continuous drivers. It reads z when nobody drives it.",
    writers: "One or more continuous drivers (assign, ports), combined by strength; never procedural assignments.",
    hardware: "An interconnect. Several drivers model a shared or tri-state bus.",
    clauses: "§6.5, §6.6.1, §6.7.1",
  },
];

const SAMPLE = "1x0z";

const allowedStates = (states: 2 | 4): Bit4[] => (states === 2 ? ["0", "1"] : ["0", "1", "x", "z"]);

function initialBits(descriptor: DataTypeDescriptor): Bit4[] {
  return descriptor.family === "Net" ? defaultNetValue("wire", descriptor.width) : defaultVariableValue(descriptor.base, descriptor.width);
}

function describeDefault(descriptor: DataTypeDescriptor): string {
  const bits = initialBits(descriptor);
  const v = bits[0];
  if (descriptor.width > 8) return v === "0" ? "0" : `${descriptor.width}'b${v}…${v} (all ${v})`;
  return formatLiteral(bits);
}

function numericReadout(bits: Bit4[], signed: boolean): string {
  const u = toUnsigned(bits);
  if (u === null) return "No numeric value: the vector contains x or z.";
  const s = toSigned(bits);
  return signed ? `${s?.toString()} (signed)` : `${u.toString()} (unsigned)`;
}

const DataTypeExplorer: React.FC = () => {
  const [selected, setSelected] = useState<DataTypeId>("logic");
  const descriptor = DATA_TYPES.find((t) => t.id === selected) ?? DATA_TYPES[0];
  const info = INTEGRAL_TYPES[descriptor.base];
  const states = info.states;
  const [bits, setBits] = useState<Bit4[]>(() => initialBits(DATA_TYPES[0]));
  const [lastAction, setLastAction] = useState<{ code: string; why: string } | null>(null);

  const selectType = (id: DataTypeId) => {
    const next = DATA_TYPES.find((t) => t.id === id) ?? DATA_TYPES[0];
    setSelected(id);
    setBits(initialBits(next));
    setLastAction(null);
  };

  const cycleBit = (i: number) => {
    const allowed = allowedStates(states);
    setBits((prev) => prev.map((b, k) => (k === i ? allowed[(allowed.indexOf(b) + 1) % allowed.length] : b)));
    setLastAction(null);
  };

  const writeSample = () => {
    const result = assignToIntegral(parseBits(SAMPLE), { states, width: descriptor.width });
    setBits(result.bits);
    setLastAction({
      code: descriptor.family === "Net" ? `assign v = 4'b${SAMPLE};` : `v = 4'b${SAMPLE};`,
      why:
        descriptor.family === "Net"
          ? "A net carries all four values, so its single driver's 4'b1x0z appears unchanged."
          : `${descriptor.width > 4 ? `The 4-bit value is zero-extended to ${descriptor.width} bits. ` : ""}${result.why}`,
    });
  };

  const resetToDefault = () => {
    setBits(initialBits(descriptor));
    setLastAction(null);
  };

  return (
    <div data-testid="curriculum-data-type-explorer">
      <VisualFrame
        label="Data type sandbox"
        eyebrow="Explore"
        title="Data type sandbox"
        summary="Pick a type, then edit its bits or write 4'b1x0z into it. Width, value system, signedness and starting value all come from the standard's type tables."
        fidelity="model"
        assumptions={[
          "Widths, signedness and starting values follow IEEE 1800-2023 Table 6-7 and Table 6-8; x/z to 0 on 2-state assignment follows §6.11.2.",
          "Rule text is paraphrased, not quoted, and cites the clause it comes from.",
          "The wire row shows a single driver's value; multiple drivers are covered by the net resolution simulator.",
        ]}
      >
        <SegmentedControl label="Data type" mono value={selected} onChange={selectType} options={DATA_TYPES.map((t) => ({ value: t.id, label: t.label }))} />

        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {descriptor.family === "Net" ? "Resolved value" : "Stored value"}, bit {descriptor.width - 1} first
              </p>
              <span className="text-xs text-muted-foreground">Activate a bit to cycle {states === 2 ? "0 and 1" : "0, 1, x and z"}</span>
            </div>
            <div
              role="group"
              aria-label={`${descriptor.label} bits`}
              data-testid="bit-visualizer"
              className={cn("grid max-w-[320px] gap-1", descriptor.width > 4 ? "grid-cols-8" : "grid-cols-4")}
            >
              {bits.map((value, index) => {
                const bitNumber = descriptor.width - 1 - index;
                return (
                  <button
                    // Keyed by position only, so keyboard focus survives a value change.
                    key={index}
                    type="button"
                    onClick={() => cycleBit(index)}
                    aria-label={`Bit ${bitNumber} is ${value}`}
                    data-testid={`bit-${index}`}
                    className={cn(
                      "flex h-10 items-center justify-center rounded border font-mono text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                      valueStyles[classifyValue(value)].className,
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-sm [font-variant-ligatures:none]" data-testid="value-readout">
              {formatLiteral(bits)}
              <span className="block font-sans text-xs text-muted-foreground">{numericReadout(bits, info.signed)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={writeSample}
                className="min-h-10 rounded-md border border-cyan-500/60 bg-cyan-500/10 px-3 font-mono text-xs text-foreground hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [font-variant-ligatures:none]"
              >
                {descriptor.family === "Net" ? "Drive" : "Write"} 4&apos;b{SAMPLE}
              </button>
              <button
                type="button"
                onClick={resetToDefault}
                className="min-h-10 rounded-md border border-border/70 px-3 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back to the starting value
              </button>
            </div>
            <CodeTrace
              label="Declaration"
              lines={[
                { text: descriptor.decl, key: "decl" },
                ...(lastAction ? [{ text: lastAction.code, key: "action" }] : []),
                { text: `// v is now ${formatLiteral(bits)}`, key: "now" },
              ]}
              activeKey={lastAction ? "action" : undefined}
            />
            <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite" data-testid="last-action-why">
              {lastAction ? lastAction.why : ""}
            </p>
          </div>

          <aside className="min-w-0 space-y-3 text-sm">
            <dl className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-4">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Family</dt>
                <dd className="font-medium" data-testid="property-family">{descriptor.family}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Value system</dt>
                <dd className="font-medium" data-testid="property-value-system">{states}-state</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Width</dt>
                <dd className="font-medium" data-testid="property-width">
                  {descriptor.width} bits{info.width === null ? " (you choose)" : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Signedness</dt>
                <dd className="font-medium" data-testid="property-signedness">{info.signed ? "signed" : "unsigned"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Starting value</dt>
                <dd className="font-medium" data-testid="property-default-value">
                  <code className="font-mono [font-variant-ligatures:none]">{describeDefault(descriptor)}</code>
                </dd>
              </div>
            </dl>
            <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-4">
              <p data-testid="type-rule">{descriptor.summary}</p>
              <p>
                <strong className="text-foreground">Who may write it: </strong>
                <span className="text-muted-foreground">{descriptor.writers}</span>
              </p>
              <p>
                <strong className="text-foreground">Hardware: </strong>
                <span className="text-muted-foreground" data-testid="hardware-label">{descriptor.hardware}</span>
              </p>
              <p className="text-xs text-muted-foreground">Paraphrased from IEEE 1800-2023 {descriptor.clauses}.</p>
            </div>
          </aside>
        </div>
      </VisualFrame>
    </div>
  );
};

export default DataTypeExplorer;
