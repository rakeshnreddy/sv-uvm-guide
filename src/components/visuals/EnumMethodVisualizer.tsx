"use client";

import React, { useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  assignIntToEnum,
  callEnumMethod,
  enumDeclaration,
  enumDefault,
  formatEnumValue,
  isMember,
  type EnumMethod,
  type EnumMethodResult,
  type EnumTypeModel,
  type EnumValue,
} from "@/lib/sv-enum-string-model";
import { cn } from "@/lib/utils";

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

export default function EnumMethodVisualizer() {
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
    <VisualFrame
      label="Enum method explorer"
      eyebrow="Experiment"
      title="Enum methods, including the traps"
      summary="Choose what s holds, including a value that is not a member, then call a method."
      fidelity="model"
      assumptions={[
        "Follows IEEE 1800-2023 §6.19.3–§6.19.5 and §6.24.2. Members have implicit values 0 to 3.",
        "Methods return values; s only changes when you assign the result.",
      ]}
    >
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
                : "An int-based enum never starts at an invalid value: it starts at 0, which is the first member here.",
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

      <ol className="flex flex-wrap gap-2" aria-label="Enum members in declaration order">
        {MEMBERS.map((m, i) => {
          const isCurrent = current === i;
          const isReturned = result?.returns.kind === "enum" && result.returns.value === i;
          return (
            <li
              key={m}
              className={cn(
                "rounded-lg border px-3 py-2 font-mono text-sm [font-variant-ligatures:none]",
                isCurrent ? "border-violet-500 bg-violet-500/10 text-foreground" : "border-border/70 text-muted-foreground",
                isReturned && "ring-2 ring-cyan-400",
              )}
            >
              {m} = {i}
              {isCurrent ? <span className="ml-1 text-xs">◀ s</span> : null}
              {isReturned ? <span className="ml-1 text-xs">▲ returned</span> : null}
            </li>
          );
        })}
        {!isMember(t, current) ? (
          <li className="rounded-lg border border-dashed border-rose-500/70 px-3 py-2 font-mono text-sm text-rose-700 dark:text-rose-200">
            {formatEnumValue(t, current)} <span className="ml-1 text-xs">◀ s</span>
          </li>
        ) : null}
      </ol>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Enum methods">
        {METHODS.map(({ method, label }) => (
          <button
            key={method}
            type="button"
            onClick={() => setResult(callEnumMethod(t, current, method, n))}
            className="min-h-10 rounded-md border border-border/70 px-3 font-mono text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [font-variant-ligatures:none]"
          >
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

      <div className="min-h-12 rounded-lg border border-border/70 bg-background/50 p-3 text-sm" aria-live="polite">
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
                className="mt-2 min-h-9 rounded-md border border-cyan-500/60 px-3 font-mono text-xs hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [font-variant-ligatures:none]"
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
    </VisualFrame>
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
                <span className={r.compiles ? "" : "text-rose-700 dark:text-rose-300"}>{r.compiles ? "" : "✕ "}</span>
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
