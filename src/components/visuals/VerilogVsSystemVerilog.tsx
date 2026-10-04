"use client";

import React, { useState } from "react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { cn } from "@/lib/utils";

type FeatureKey = "datatypes" | "oop" | "assertions" | "randomization";

interface Side {
  code: string;
  desc: string;
}

export const COMPARISON: Record<FeatureKey, { title: string; verilog: Side; sv: Side }> = {
  datatypes: {
    title: "Data Types",
    verilog: {
      code: "reg  [7:0] a;   // variable\nwire [7:0] b;   // net\ninteger    i;",
      desc: "reg (and integer, time, real) for variables, wire for nets. You choose reg or wire by how the signal is assigned, not by whether it is a register. No structs, enums or typedef.",
    },
    sv: {
      code: "logic [7:0] a;            // 4-state, same type as reg\nbit   [7:0] b;            // 2-state\ntypedef enum {IDLE, RUN} state_t;\nstruct { int x, y; } point;",
      desc: "logic replaces reg as the descriptive name (§6.11.2). Adds 2-state bit, byte and int, and user-defined types: typedef, enum, struct, union.",
    },
  },
  oop: {
    title: "Object Oriented Programming",
    verilog: {
      code: "// No classes.\n// Reuse comes from modules,\n// tasks and functions only.",
      desc: "No classes. Testbench data and the code that handles it stay separate, and nothing can be created dynamically while the test runs.",
    },
    sv: {
      code: 'class Packet;\n  rand bit [31:0] addr;\n  function void print();\n    $display("addr=%0h", addr);\n  endfunction\nendclass',
      desc: "Full OOP support: Classes, Inheritance, Polymorphism, created with new() while the test runs. Essential for UVM and modern verification (§8).",
    },
  },
  assertions: {
    title: "Assertions",
    verilog: {
      code: 'always @(posedge clk)\n  if (req && !gnt)\n    $display("Error!");',
      desc: "Procedural checks only. Temporal rules such as \"gnt must follow req 3 cycles later\" need hand-written counters and state.",
    },
    sv: {
      code: "assert property (\n  @(posedge clk) req |-> ##3 gnt\n);",
      desc: "SystemVerilog Assertions (SVA, §16): one line states the temporal rule, and the simulator (or a formal tool) checks it on every clock.",
    },
  },
  randomization: {
    title: "Randomization",
    verilog: {
      code: "reg [31:0] a;\na = $random;\nif (a > 100) a = 100;  // clamp",
      desc: "Plain random numbers. Legal values must be forced with hand-written code, and this clamp turns almost every value into 100.",
    },
    sv: {
      code: "class Txn;\n  rand bit [31:0] addr;\n  constraint c_addr {\n    addr inside {[0:100]};\n    addr % 4 == 0;\n  }\nendclass\n// t.randomize() picks a legal addr",
      desc: "Constraint solver (§18): declare the rules and randomize() finds values that satisfy all of them.",
    },
  },
};

const KEYWORD_OPTIONS: PredictionOption[] = [
  {
    id: "compiles",
    label: "It compiles. SystemVerilog accepts all Verilog code.",
    correct: false,
    feedback:
      "This is the common myth. SystemVerilog reserves new keywords (logic, bit, int, class and more), and a keyword cannot be used as an identifier (§5.6.2).",
  },
  {
    id: "error",
    label: "Compile error: logic is a reserved keyword in SystemVerilog.",
    correct: true,
    feedback:
      "With a SystemVerilog keyword set, logic is reserved, so reg [7:0] logic; is an error. The LRM's own example in §22.14 uses this case. Wrap the legacy file in `begin_keywords \"1364-2001\" … `end_keywords, or rename the signal.",
  },
  {
    id: "retyped",
    label: "It compiles, and the signal silently becomes a 4-state logic type.",
    correct: false,
    feedback: "The parser never gets that far. logic is a keyword, so it cannot also be the name of the reg.",
  },
  {
    id: "warning",
    label: "A warning only: the tool renames the signal for you.",
    correct: false,
    feedback: "Tools do not rename identifiers. A reserved word used as a name is a syntax error until you rename it or select an older keyword set.",
  },
];

const codeClass = "overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12.5px] leading-5 text-slate-100 [font-variant-ligatures:none]";

/** F1C: Verilog-2001 vs SystemVerilog, side by side, plus the keyword-compatibility trap. */
export default function VerilogVsSystemVerilog() {
  const [feature, setFeature] = useState<FeatureKey>("datatypes");
  const current = COMPARISON[feature];

  return (
    <div data-testid="verilog-vs-sv">
      <VisualFrame
        label="Verilog versus SystemVerilog comparison"
        eyebrow="Compare"
        title="Verilog vs. SystemVerilog"
        summary="Select a feature to compare the Verilog-2001 way with the SystemVerilog way."
        fidelity="illustration"
        assumptions={["Short snippets that show the idea. They are not complete compilable files."]}
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Feature to compare">
          {(Object.keys(COMPARISON) as FeatureKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={feature === key}
              onClick={() => setFeature(key)}
              className={cn(
                "min-h-10 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                feature === key ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {COMPARISON[key].title}
            </button>
          ))}
        </div>

        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]" aria-live="polite">
          <div className="min-w-0 rounded-xl border border-border/70 bg-background/40 p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Verilog (IEEE 1364-2001)</p>
            <pre className={codeClass}>
              <code>{current.verilog.code}</code>
            </pre>
            <p className="mt-2 text-sm text-muted-foreground">{current.verilog.desc}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-cyan-500/40 bg-cyan-500/[0.04] p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">SystemVerilog (IEEE 1800)</p>
            <pre className={codeClass}>
              <code>{current.sv.code}</code>
            </pre>
            <p className="mt-2 text-sm text-muted-foreground">{current.sv.desc}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Backward compatible? Try a legacy file.</p>
          <pre className={codeClass}>
            <code>{"// legacy.v: legal Verilog-2001\nmodule legacy;\n  reg [7:0] logic;   // 'logic' was an ordinary name\nendmodule"}</code>
          </pre>
          <PredictionPrompt question="You compile legacy.v as SystemVerilog with no directives. What happens?" options={KEYWORD_OPTIONS}>
            <div className="space-y-2 text-sm">
              <p className="text-foreground">The fix that keeps the old name: select the Verilog-2001 keyword set for this file only (§22.14).</p>
              <pre className={codeClass}>
                <code>{'`begin_keywords "1364-2001"\nmodule legacy;\n  reg [7:0] logic;   // OK: not a keyword in 1364-2001\nendmodule\n`end_keywords'}</code>
              </pre>
            </div>
          </PredictionPrompt>
        </div>

        <p className="text-sm text-muted-foreground">
          SystemVerilog contains all of Verilog: IEEE 1364-2005 was merged into IEEE 1800-2009. But it is not a drop-in superset for every legacy file.
          New reserved keywords such as <code className="font-mono [font-variant-ligatures:none]">logic</code>,{" "}
          <code className="font-mono [font-variant-ligatures:none]">bit</code>, <code className="font-mono [font-variant-ligatures:none]">int</code> and{" "}
          <code className="font-mono [font-variant-ligatures:none]">class</code> break old code that used them as names, unless you use{" "}
          <code className="font-mono [font-variant-ligatures:none]">`begin_keywords</code>.
        </p>
      </VisualFrame>
    </div>
  );
}
