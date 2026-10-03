"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  SIMPLE_BUS_IF,
  TRY_STATEMENTS,
  checkAccess,
  interfaceToSource,
  moduleHeader,
  viewOf,
  type ViewSignal,
} from "@/lib/sv-interface-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Signals are logic variables; clk is the interface's input port.",
  "Direction rules follow §25.5 (modports), §23.3.3.2 (input ports), §14.3/§14.16 (clockvars).",
  "Errors are classified, not quoted: every tool words them differently.",
  "For nets, §23.3.3.1 port coercion can turn a driven input into an inout with a warning; not modelled.",
];

const VIEWS = [
  { value: "master", label: "master" },
  { value: "slave", label: "slave" },
  { value: "monitor", label: "monitor" },
  { value: "drv", label: "drv (clocking cb)" },
];

const flowText: Record<ViewSignal["flow"], string> = {
  "into-module": "flows from the interface into the module",
  "out-of-module": "flows out of the module into the interface",
  both: "flows both ways",
};

function FlowArrow({ flow }: { flow: ViewSignal["flow"] }) {
  // Module on the left, interface on the right: input points left, output points right.
  const left = flow === "into-module" || flow === "both";
  const right = flow === "out-of-module" || flow === "both";
  return (
    <svg viewBox="0 0 64 14" className="h-3.5 w-16 shrink-0" aria-hidden>
      <line x1={left ? 8 : 2} x2={right ? 56 : 62} y1="7" y2="7" strokeWidth="2" className={flow === "into-module" ? "stroke-cyan-500" : "stroke-amber-500"} />
      {left ? <polygon points="0,7 9,2 9,12" className="fill-cyan-500" /> : null}
      {right ? <polygon points="64,7 55,2 55,12" className="fill-amber-500" /> : null}
    </svg>
  );
}

const OPTIONS = (legal: boolean, rule: string, clause: string) => [
  {
    id: "legal",
    label: "It compiles: this module is allowed to do that through the modport.",
    correct: legal,
    feedback: legal ? `${rule} (${clause})` : `Not allowed: ${rule} (${clause})`,
  },
  {
    id: "compile",
    label: "The tool rejects it before simulation starts (compile or elaboration error).",
    correct: !legal,
    feedback: legal ? `Nothing in the modport forbids it. ${rule} (${clause})` : `${rule} (${clause})`,
  },
  {
    id: "runtime",
    label: "It compiles, then fails or produces X when the statement runs.",
    correct: false,
    feedback: "Direction rules are static. They are checked when the design is compiled and elaborated, before time 0, not when the line executes.",
  },
];

export const ModportExplorer = () => {
  const decl = SIMPLE_BUS_IF;
  const [view, setView] = useState("master");
  const [tryIndex, setTryIndex] = useState(0);

  const modport = decl.modports.find((m) => m.name === view) ?? decl.modports[0];
  const signals = useMemo(() => viewOf(decl, view), [decl, view]);
  const source = useMemo(() => interfaceToSource(decl), [decl]);
  const attempts = TRY_STATEMENTS[view] ?? [];
  const attempt = attempts[Math.min(tryIndex, attempts.length - 1)];
  const verdict = checkAccess(decl, view, attempt.path, attempt.op);
  const legal = verdict.outcome === "legal";

  const changeView = (next: string) => {
    setView(next);
    setTryIndex(0);
  };

  return (
    <VisualFrame
      label="Modport explorer"
      eyebrow="Mental picture"
      title="One bundle, four views"
      summary={
        <>
          An interface is the cable; a modport is the view one module gets of it. Pick a view and read the arrows from that module&apos;s side: ◀ input flows{" "}
          <em>into</em> the module, ▶ output flows <em>out</em>.
        </>
      }
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <SegmentedControl label="Modport view" mono options={VIEWS} value={view} onChange={changeView} />

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="min-w-0 space-y-2 rounded-xl border border-border/70 bg-background/50 p-3">
          <p className="break-words font-mono text-xs text-foreground [font-variant-ligatures:none]">{moduleHeader(decl, modport)}</p>
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>{modport.user}</span>
            <span>{decl.name}</span>
          </div>
          <ul className="space-y-1.5" aria-label={`Signals visible through modport ${view}`}>
            {signals.map((s) => (
              <li
                key={s.path}
                aria-label={`${s.path}: ${s.dir}, ${flowText[s.flow]}`}
                className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-card/60 px-2 py-1.5"
              >
                <span
                  className={cn(
                    "w-14 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold",
                    s.dir === "input" ? "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200" : "bg-amber-500/15 text-amber-900 dark:text-amber-100",
                  )}
                >
                  {s.dir}
                </span>
                <FlowArrow flow={s.flow} />
                <code className="min-w-0 break-all font-mono text-xs text-foreground [font-variant-ligatures:none]">{s.path}</code>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {view === "drv"
              ? "Through drv the module sees only the clocking block: it samples ready and drives the request signals with the clocking block's timing (§25.5.5)."
              : view === "monitor"
                ? "Every arrow points into the monitor: it can observe the bus but cannot drive it."
                : "Not listed here means not reachable through this port at all."}
          </p>
        </div>
        <CodeTrace
          label={`Interface source · modport ${view} highlighted`}
          lines={source.map((l) => ({ text: l.text, key: l.key }))}
          contextKeys={[`mp-${view}`, ...(view === "drv" ? ["cb"] : [])]}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Try a statement inside {modport.user}</p>
        <SegmentedControl
          label="Statement to try"
          mono
          options={attempts.map((a, i) => ({ value: String(i), label: checkAccess(decl, view, a.path, a.op).statement }))}
          value={String(Math.min(tryIndex, attempts.length - 1))}
          onChange={(v) => setTryIndex(Number(v))}
        />
        <PredictionPrompt
          resetKey={`${view}:${tryIndex}`}
          question={
            <>
              Inside <code className="font-mono [font-variant-ligatures:none]">{moduleHeader(decl, modport)}</code>, what happens with{" "}
              <code className="font-mono [font-variant-ligatures:none]">{verdict.statement}</code>?
            </>
          }
          options={OPTIONS(legal, verdict.rule, verdict.clause)}
        >
          <div
            aria-live="polite"
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              legal
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                : "border-rose-500/50 bg-rose-500/10 text-rose-900 dark:text-rose-100",
            )}
          >
            <p className="font-semibold">
              {legal ? "✓ Legal" : "✕ Compile-time error"}: <code className="font-mono [font-variant-ligatures:none]">{verdict.statement}</code>
            </p>
            <p className="mt-1">
              {verdict.rule} <span className="text-xs opacity-80">({verdict.clause})</span>
            </p>
          </div>
        </PredictionPrompt>
      </div>

      <p className="text-xs text-muted-foreground">
        Limits: a modport restricts what a module can do <em>through that port</em>. It does not stop two modules on the same <code className="font-mono">master</code>{" "}
        view from both driving, and a hierarchical reference such as <code className="font-mono">top.bus_if.ready</code> bypasses it.
      </p>
    </VisualFrame>
  );
};
