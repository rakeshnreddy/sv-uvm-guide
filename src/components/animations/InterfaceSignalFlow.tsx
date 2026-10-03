"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  FLOW_PRESETS,
  FLOW_STATEMENTS,
  HANDLE_MODPORTS,
  SIMPLE_BUS_IF,
  checkVifAccess,
  flowSource,
  vifTypeText,
  type FlowStep,
  type VifSetup,
  type VifVerdict,
} from "@/lib/sv-interface-flow-model";
import { viewOf } from "@/lib/sv-interface-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Rules: virtual interfaces and null handles §25.9; modports §25.5 and §25.5.5; input ports §23.3.3.2; clockvars §14.3, §14.13, §14.16.",
  "Interface signals are logic variables; clk is the interface's input port. The DUT connects through the slave modport.",
  "Errors are classified (compile time vs run time), not quoted: every tool words them differently.",
  "Compile-time checks come first: a design that does not compile never reaches the null-handle check at run time.",
];

const decl = SIMPLE_BUS_IF;

/** Calls `onReveal` once the prediction prompt shows its revealed content. */
function RevealSignal({ onReveal }: { onReveal: () => void }) {
  useEffect(() => {
    onReveal();
  }, [onReveal]);
  return null;
}

const statementLabel = (path: string, op: "read" | "drive") => (op === "read" ? `x = vif.${path};` : `vif.${path} <= …;`);
const handleKey = (m: string | null) => m ?? "none";

const outcomeText: Record<VifVerdict["outcome"], string> = {
  legal: "✓ Compiles and runs",
  "compile-error": "✕ Compile-time error",
  "fatal-runtime": "✕ Fatal run-time error",
};

function options(verdict: VifVerdict): PredictionOption[] {
  return [
    {
      id: "legal",
      label: "It compiles and runs: the signal is driven or read.",
      correct: verdict.outcome === "legal",
      feedback: verdict.outcome === "legal" ? `${verdict.rule} (${verdict.clause})` : `Something stops it first: ${verdict.rule} (${verdict.clause})`,
    },
    {
      id: "compile-error",
      label: "The tool rejects it before simulation starts.",
      correct: verdict.outcome === "compile-error",
      feedback:
        verdict.outcome === "compile-error"
          ? `${verdict.rule} (${verdict.clause})`
          : verdict.outcome === "fatal-runtime"
            ? "The statement is legal for this handle type, so it compiles. Whether the handle points anywhere is only known at run time."
            : "Nothing in the handle's type forbids this access, so the compiler accepts it.",
    },
    {
      id: "fatal-runtime",
      label: "It compiles, then stops with a fatal error when the driver runs.",
      correct: verdict.outcome === "fatal-runtime",
      feedback:
        verdict.outcome === "fatal-runtime"
          ? `${verdict.rule} (${verdict.clause})`
          : verdict.outcome === "compile-error"
            ? "Direction and visibility rules are static: they are checked before time 0, so the run never starts."
            : "The handle was assigned, so it points at bus_if and nothing fails at run time.",
    },
  ];
}

const stepTitles: Record<FlowStep["id"], string> = {
  instance: "Interface instance in top",
  handle: "Virtual interface handle (drv.vif)",
  modport: "Modport view in the handle's type",
  signal: "Signal on bus_if, seen by the DUT",
};

const flowLabels: Partial<Record<FlowStep["id"], string>> = {
  handle: "handle points to",
  modport: "access limited by",
  signal: "drives / reads",
};

function FlowChain({ steps, revealed }: { steps: FlowStep[]; revealed: boolean }) {
  return (
    <ol aria-label="Signal path from the class to the pins" className="space-y-1">
      {steps.map((s, i) => {
        const status = revealed ? s.status : "pending";
        return (
          <li key={s.id}>
            {i > 0 ? (
              <div className="flex items-center gap-2 py-0.5 pl-4 text-[11px] text-muted-foreground" aria-hidden>
                <span className="text-base leading-none">↓</span>
                <span>{flowLabels[s.id]}</span>
              </div>
            ) : null}
            <div
              aria-label={`${stepTitles[s.id]}: ${status === "pending" ? "predict first" : status === "ok" ? "ok" : status === "error" ? "fails here" : "not reached"}`}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                status === "ok" && "border-emerald-500/60 bg-emerald-500/10",
                status === "error" && "border-rose-500/70 bg-rose-500/10",
                status === "not-reached" && "border-dashed border-border/70 opacity-70",
                status === "pending" && "border-border/70 bg-background/50",
              )}
            >
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <span aria-hidden className="w-4 text-center">
                  {status === "ok" ? "✓" : status === "error" ? "✕" : status === "not-reached" ? "○" : "·"}
                </span>
                {stepTitles[s.id]}
              </p>
              {revealed ? (
                <p className="mt-1 pl-6 text-xs text-muted-foreground [font-variant-ligatures:none]">
                  {s.text}
                  {s.clause ? <span className="opacity-80"> ({s.clause})</span> : null}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const MATRIX_SIGNALS = ["clk", "addr", "data", "rw", "valid", "ready"];

function DirectionMatrix() {
  const modports = decl.modports;
  const cell = (modport: string, signal: string) => {
    const view = viewOf(decl, modport);
    const v = view.find((s) => s.signal === signal);
    if (!v) return { text: "—", aria: "not visible" };
    const prefix = v.path.includes(`.${decl.clocking.name}.`) ? `${decl.clocking.name}.` : "";
    if (v.dir === "input") return { text: `◀ ${prefix}input`, aria: `${prefix}input, read only` };
    if (v.dir === "output") return { text: `▶ ${prefix}output`, aria: `${prefix}output, may drive` };
    return { text: `◆ ${prefix}inout`, aria: `${prefix}inout` };
  };
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[300px] w-full border-collapse text-left text-xs">
        <caption className="mb-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Direction per modport, seen from the module or handle using it</caption>
        <thead>
          <tr className="border-b border-border/70">
            <th scope="col" className="py-1.5 pr-2 font-semibold">
              Signal
            </th>
            {modports.map((m) => (
              <th key={m.name} scope="col" className="px-2 py-1.5 font-mono font-semibold [font-variant-ligatures:none]">
                {m.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX_SIGNALS.map((signal) => (
            <tr key={signal} className="border-b border-border/40">
              <th scope="row" className="py-1.5 pr-2 font-mono font-semibold [font-variant-ligatures:none]">
                {signal}
              </th>
              {modports.map((m) => {
                const c = cell(m.name, signal);
                return (
                  <td key={m.name} aria-label={`${m.name} ${signal}: ${c.aria}`} className={cn("px-2 py-1.5 font-mono [font-variant-ligatures:none]", c.text === "—" && "text-muted-foreground")}>
                    {c.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        ◀ input: flows into the user, read only. ▶ output: the user may drive it. — : not reachable through that view. No view uses <code className="font-mono">inout</code>: the signals are variables, and a
        variable cannot sit on either side of an inout port (§6.5, §23.3.3). A handle with no modport sees every row with no direction checks.
      </p>
    </div>
  );
}

/**
 * Interface → modport → virtual-interface flow, driven by
 * `sv-interface-flow-model.ts`. The learner varies the handle type, whether
 * the handle is assigned, and the statement, then predicts whether it
 * compiles, runs, or stops with a null-handle fatal error.
 */
const InterfaceSignalFlow = () => {
  const [presetId, setPresetId] = useState(FLOW_PRESETS[0].id);
  const [setup, setSetup] = useState<VifSetup>(FLOW_PRESETS[0].setup);
  const [revealed, setRevealed] = useState(false);
  /** Bumped on every change so the prediction and the revealed path always reset together. */
  const [round, setRound] = useState(0);

  const key = `${handleKey(setup.modport)}|${setup.assigned}|${setup.path}|${setup.op}`;
  const verdict = useMemo(() => checkVifAccess(decl, setup), [setup]);
  const lines = useMemo(() => flowSource(decl, setup), [setup]);
  const onReveal = useCallback(() => setRevealed(true), []);
  const preset = FLOW_PRESETS.find((p) => p.id === presetId);
  const matchesPreset = Boolean(preset && JSON.stringify(preset.setup) === JSON.stringify(setup));

  const update = (patch: Partial<VifSetup>) => {
    setSetup((s) => ({ ...s, ...patch }));
    setRevealed(false);
    setRound((r) => r + 1);
  };

  return (
    <VisualFrame
      label="Interface signal flow"
      eyebrow="Experiment · spot the bug"
      title="From a class to the pins: interface, modport, virtual interface"
      summary={
        <>
          A class cannot hold an interface, only a <em>handle</em> to one. Choose the handle&apos;s type, whether <code className="font-mono">top</code> fills it in, and what the driver
          does. Predict, then follow the path.
        </>
      }
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Start from</p>
        <div role="group" aria-label="Load a scenario" className="flex flex-wrap gap-2">
          {FLOW_PRESETS.map((p) => {
            const active = matchesPreset && p.id === presetId;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setPresetId(p.id);
                  setSetup(p.setup);
                  setRevealed(false);
                  setRound((r) => r + 1);
                }}
                className={cn(
                  "min-h-9 rounded-full border px-3 py-1.5 text-xs transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Load a scenario, or change the three controls below to build your own.</p>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Handle type</p>
          <SegmentedControl
            label="Virtual interface type"
            mono
            options={HANDLE_MODPORTS.map((m) => ({ value: handleKey(m), label: vifTypeText(decl, m) }))}
            value={handleKey(setup.modport)}
            onChange={(v) => update({ modport: v === "none" ? null : v })}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">In top</p>
          <SegmentedControl
            label="Handle assignment in top"
            mono
            options={[
              { value: "yes", label: "drv.vif = bus_if;" },
              { value: "no", label: "(assignment missing)" },
            ]}
            value={setup.assigned ? "yes" : "no"}
            onChange={(v) => update({ assigned: v === "yes" })}
          />
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">The driver executes</p>
        <SegmentedControl
          label="Statement in the driver"
          mono
          options={FLOW_STATEMENTS.map((s) => ({ value: `${s.op}:${s.path}`, label: statementLabel(s.path, s.op) }))}
          value={`${setup.op}:${setup.path}`}
          onChange={(v) => {
            const [op, path] = v.split(":");
            update({ op: op as VifSetup["op"], path });
          }}
        />
      </div>

      <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <CodeTrace
          label="Generated testbench code"
          lines={lines}
          activeKey={revealed ? (verdict.outcome === "fatal-runtime" ? "wait" : "stmt") : undefined}
          contextKeys={["vif-decl", "assign"]}
        />
        <FlowChain steps={verdict.steps} revealed={revealed} />
      </div>

      <PredictionPrompt resetKey={`${key}#${round}`} question={<>What happens when the driver runs this code?</>} options={options(verdict)}>
        <RevealSignal onReveal={onReveal} />
        <div
          aria-live="polite"
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            verdict.outcome === "legal" ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10",
          )}
        >
          <p className="font-semibold text-foreground">
            {outcomeText[verdict.outcome]}: <code className="font-mono [font-variant-ligatures:none]">{verdict.statement}</code>
          </p>
          <p className="mt-1 text-foreground [font-variant-ligatures:none]">
            {verdict.rule} <span className="text-xs opacity-80">({verdict.clause})</span>
          </p>
          {matchesPreset && preset ? <p className="mt-1 text-xs text-muted-foreground">What you would see: {preset.symptom}</p> : null}
          {verdict.outcome === "fatal-runtime" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Debug habit: check the handle where it is set, e.g. <code className="font-mono">if (vif == null) $fatal(1, &quot;vif not set&quot;);</code> in the driver&apos;s build or
              connect code, so the message names the cause.
            </p>
          ) : null}
        </div>
      </PredictionPrompt>

      <DirectionMatrix />
    </VisualFrame>
  );
};

export default InterfaceSignalFlow;
