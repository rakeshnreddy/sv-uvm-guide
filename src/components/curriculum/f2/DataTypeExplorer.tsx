"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const STATE_ORDER = ["0", "1", "X", "Z"] as const;
type StateSymbol = (typeof STATE_ORDER)[number];

type HardwareKind = "flip-flop" | "wire" | "register";

interface DataTypeDescriptor {
  id: DataTypeId;
  label: string;
  family: "Variable" | "Net";
  states: "2-state" | "4-state";
  signedness: string;
  defaultValue: string;
  bitWidth: number;
  cycleStates: StateSymbol[];
  hardware: HardwareKind;
  hardwareLabel: string;
  description: string;
  lrmReference: string;
  lrmSnippet: string;
}

type DataTypeId = "logic" | "bit" | "int" | "byte" | "reg" | "wire";

const DATA_TYPES: DataTypeDescriptor[] = [
  {
    id: "logic",
    label: "logic [3:0]",
    family: "Variable",
    states: "4-state",
    signedness: "Unsigned by default; `logic signed` enables signed math",
    defaultValue: "'x",
    bitWidth: 4,
    cycleStates: ["0", "1", "X", "Z"],
    hardware: "flip-flop",
    hardwareLabel: "Flip-flop driven inside procedural code",
    description:
      "Single-driver procedural storage. Resolves to flop or latch depending on the always block style.",
    lrmReference: "IEEE 1800-2023 §6.8.1",
    lrmSnippet:
      "logic is a four-state variable data type that can represent 0, 1, X, and Z and may be used wherever reg was permitted.",
  },
  {
    id: "bit",
    label: "bit [3:0]",
    family: "Variable",
    states: "2-state",
    signedness: "Unsigned packed array (`bit signed [3:0]` flips interpretation)",
    defaultValue: "'0",
    bitWidth: 4,
    cycleStates: ["0", "1"],
    hardware: "register",
    hardwareLabel: "Binary register optimized for synthesis and math",
    description:
      "Two-state storage. Great for counters, scoreboards, and anywhere X/Z are not required.",
    lrmReference: "IEEE 1800-2023 §6.4.2",
    lrmSnippet:
      "The bit type is a two-state data type with values restricted to 0 and 1, suitable for synthesis and arithmetic use.",
  },
  {
    id: "int",
    label: "int",
    family: "Variable",
    states: "2-state",
    signedness: "Signed 32-bit (`int unsigned` keeps arithmetic positive)",
    defaultValue: "0",
    bitWidth: 8,
    cycleStates: ["0", "1"],
    hardware: "register",
    hardwareLabel: "32-bit arithmetic register or ALU input",
    description:
      "32-bit two-state integer. Simulator promotes operands to int for most math, so mind the signedness.",
    lrmReference: "IEEE 1800-2023 §6.10",
    lrmSnippet:
      "int is a two-state signed 32-bit integer type used by default in expressions unless context dictates otherwise.",
  },
  {
    id: "byte",
    label: "byte",
    family: "Variable",
    states: "2-state",
    signedness: "Signed 8-bit (`byte unsigned` for 0–255 transfers)",
    defaultValue: "0",
    bitWidth: 8,
    cycleStates: ["0", "1"],
    hardware: "register",
    hardwareLabel: "8-bit register—think scratchpad or FIFO entry",
    description:
      "Convenient 8-bit integer for protocol payloads and scoreboard data structures.",
    lrmReference: "IEEE 1800-2023 §6.10",
    lrmSnippet:
      "byte is an 8-bit two-state signed integer type; declare byte unsigned to model raw packets.",
  },
  {
    id: "reg",
    label: "reg [3:0]",
    family: "Variable",
    states: "4-state",
    signedness: "Unsigned unless declared `reg signed`",
    defaultValue: "'x",
    bitWidth: 4,
    cycleStates: ["0", "1", "X", "Z"],
    hardware: "flip-flop",
    hardwareLabel: "Legacy flop representation (still maps to storage)",
    description:
      "Historical 4-state procedural variable. Use logic in new RTL, but you will still read reg in legacy IP.",
    lrmReference: "IEEE 1800-2023 §6.6",
    lrmSnippet:
      "reg variables hold four-state values and represent procedural storage elements.",
  },
  {
    id: "wire",
    label: "wire [3:0]",
    family: "Net",
    states: "4-state",
    signedness: "Unsigned; drive strength resolved across drivers",
    defaultValue: "'z",
    bitWidth: 4,
    cycleStates: ["0", "1", "X", "Z"],
    hardware: "wire",
    hardwareLabel: "Physical interconnect with possible tri-state",
    description:
      "Represents a resolved net. Multiple continuous drivers combine according to strength rules.",
    lrmReference: "IEEE 1800-2023 §6.7",
    lrmSnippet:
      "A net type such as wire represents connections between structural elements and resolves competing drivers to 0, 1, X, or Z.",
  },
];

const stateColors: Record<StateSymbol, string> = {
  "0": "bg-slate-200 text-slate-900 border-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600",
  "1": "bg-emerald-500 text-white border-emerald-600",
  X: "bg-amber-500 text-white border-amber-600",
  Z: "bg-purple-500 text-white border-purple-600",
};

const FlipFlopIcon = () => (
  <svg viewBox="0 0 120 80" className="h-20 w-full max-w-[160px] text-primary" role="img" aria-label="Flip-flop icon">
    <rect x="10" y="10" width="60" height="60" rx="8" className="fill-primary/10 stroke-current" strokeWidth="4" />
    <polyline points="70,20 100,20 100,60 70,60" className="fill-none stroke-current" strokeWidth="4" strokeLinejoin="round" />
    <circle cx="28" cy="30" r="6" className="fill-current" />
    <circle cx="28" cy="50" r="6" className="fill-current" />
    <line x1="46" y1="30" x2="62" y2="30" className="stroke-current" strokeWidth="4" strokeLinecap="round" />
    <line x1="46" y1="50" x2="62" y2="50" className="stroke-current" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const WireIcon = () => (
  <svg viewBox="0 0 160 60" className="h-16 w-full max-w-[200px] text-primary" role="img" aria-label="Wire icon">
    <path
      d="M10 30 C40 10, 60 50, 90 30 S140 40, 150 30"
      className="fill-none stroke-current"
      strokeWidth="6"
      strokeLinecap="round"
    />
  </svg>
);

const RegisterIcon = () => (
  <svg viewBox="0 0 140 80" className="h-20 w-full max-w-[180px] text-primary" role="img" aria-label="Register icon">
    <rect x="10" y="10" width="120" height="60" rx="10" className="fill-primary/10 stroke-current" strokeWidth="4" />
    {[0, 1, 2, 3].map((slot) => (
      <rect
        key={slot}
        x={24 + slot * 24}
        y={24}
        width={16}
        height={32}
        className="fill-current/10 stroke-current"
        strokeWidth="3"
        rx="3"
      />
    ))}
  </svg>
);

const hardwareIconMap: Record<HardwareKind, React.ReactNode> = {
  "flip-flop": <FlipFlopIcon />,
  wire: <WireIcon />,
  register: <RegisterIcon />,
};

type BitValues = StateSymbol[];

const createInitialBits = (descriptor: DataTypeDescriptor): BitValues => {
  const initialState = descriptor.defaultValue === "'z" ? "Z" : descriptor.defaultValue === "'x" ? "X" : "0";
  return Array.from({ length: descriptor.bitWidth }, () => initialState);
};

const getNextState = (descriptor: DataTypeDescriptor, current: StateSymbol): StateSymbol => {
  const cycle = descriptor.cycleStates;
  const currentIndex = cycle.indexOf(current);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % cycle.length : 0;
  return cycle[nextIndex];
};

const DataTypeExplorer: React.FC = () => {
  const [selectedType, setSelectedType] = useState<DataTypeId>("logic");
  const descriptor = useMemo(
    () => DATA_TYPES.find((type) => type.id === selectedType) ?? DATA_TYPES[0],
    [selectedType]
  );
  const [bitValues, setBitValues] = useState<BitValues>(() => createInitialBits(DATA_TYPES[0]));

  React.useEffect(() => {
    setBitValues(createInitialBits(descriptor));
  }, [descriptor]);

  const handleBitToggle = (index: number) => {
    setBitValues((prev) => {
      const next = [...prev];
      next[index] = getNextState(descriptor, prev[index]);
      return next;
    });
  };

  return (
    <Card
      className="my-8 border-primary/40 bg-background/80 shadow-lg"
      data-testid="curriculum-data-type-explorer"
    >
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">Data Type Sandbox</CardTitle>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Experiment with SystemVerilog declarations. Click the boxes to cycle through the legal values for the selected
          type and see how signedness, default initialization, and synthesized hardware react.
        </p>
        <div className="flex flex-wrap gap-2">
          {DATA_TYPES.map((type) => (
            <Button
              key={type.id}
              variant={type.id === descriptor.id ? "default" : "outline"}
              onClick={() => setSelectedType(type.id)}
              className={cn(
                "rounded-full border px-4 py-1 text-sm transition",
                type.id === descriptor.id && "shadow-md"
              )}
              data-testid={`select-${type.id}`}
            >
              {type.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[1.7fr,1fr]">
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={descriptor.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="rounded-lg border border-dashed border-primary/40 bg-muted/20 p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Visualizer</p>
                  <h3 className="text-lg font-semibold">{descriptor.label}</h3>
                </div>
                <span className="text-xs font-medium text-muted-foreground">Click bits to cycle values</span>
              </div>
              <div
                className={cn(
                  "grid gap-3",
                  descriptor.bitWidth > 4 ? "grid-cols-8" : "grid-cols-4"
                )}
                data-testid="bit-visualizer"
              >
                {bitValues.map((value, index) => (
                  <motion.button
                    key={`${descriptor.id}-${index}-${value}`}
                    onClick={() => handleBitToggle(index)}
                    whileTap={{ scale: 0.92 }}
                    className={cn(
                      "flex h-12 items-center justify-center rounded border text-lg font-semibold shadow-sm transition-colors",
                      stateColors[value]
                    )}
                    title={`Bit ${index}: ${value}`}
                    data-testid={`bit-${index}`}
                  >
                    {value}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
          <motion.div
            key={`${descriptor.id}-description`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="rounded-lg border bg-background/60 p-5 text-sm shadow-sm"
          >
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Why it matters</h4>
            <p className="text-muted-foreground">{descriptor.description}</p>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          <motion.aside
            key={`${descriptor.id}-aside`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div className="rounded-lg border bg-background/70 p-5 text-sm shadow-sm">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Properties</h4>
              <dl className="space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Family</dt>
                  <dd className="font-medium" data-testid="property-family">
                    {descriptor.family}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Value system</dt>
                  <dd className="font-medium" data-testid="property-value-system">
                    {descriptor.states}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Signedness</dt>
                  <dd className="text-right font-medium" data-testid="property-signedness">
                    {descriptor.signedness}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Uninitialized value</dt>
                  <dd className="font-medium" data-testid="property-default-value">
                    <code>{descriptor.defaultValue}</code>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border bg-background/70 p-5 text-sm shadow-sm">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Hardware implication</h4>
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-full">{hardwareIconMap[descriptor.hardware]}</div>
                <p className="font-medium leading-snug" data-testid="hardware-label">
                  {descriptor.hardwareLabel}
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-primary/5 p-5 text-sm shadow-sm">
              <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">From the LRM</h4>
              <p className="text-muted-foreground" data-testid="lrm-snippet">
                {descriptor.lrmSnippet}
              </p>
              <p className="mt-2 text-xs uppercase tracking-wide text-primary/70">{descriptor.lrmReference}</p>
            </div>
          </motion.aside>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default DataTypeExplorer;
