"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  containerPolicySupport,
  containerPrograms,
  emptyWorld,
  execStmt,
  formatPoolValue,
  runProgram,
  stmtSource,
  type ContainerMode,
  type ContainerStmt,
  type ProgramStep,
  type World,
} from "@/lib/uvm-container-model";
import { cn } from "@/lib/utils";

export const CONTAINER_MODEL_ASSUMPTIONS = [
  "Follows uvm-core 2020.3.1 (IEEE 1800.2-2020 11.2 uvm_pool, 11.3 uvm_queue, 10.4.1 uvm_event_pool): uvm_pool::get inserts the default value for a missing key; uvm_event_pool::get creates the event; uvm_queue rejects out-of-range get/insert/delete with a warning.",
  "Neither container implements do_compare, so compare() returns 1 whatever they hold; uvm_queue has no do_print.",
  "Native SystemVerilog containers follow IEEE 1800-2023 §7.8 (associative arrays, string keys in lexicographic order) and §7.10 (queues).",
  "Object ids (@1, @2…) are invented. A null-handle access is shown as the run-stopping error simulators report.",
];

function WorldView({ world }: { world: World }) {
  const objects = Object.values(world.objects);
  if (objects.length === 0) return <p className="text-sm text-muted-foreground">No container objects yet.</p>;
  const handlesTo = (id: number) =>
    Object.entries(world.vars)
      .filter(([, v]) => v === id)
      .map(([k]) => k);
  const globalOf = (id: number) => (Object.entries(world.globals).find(([, v]) => v === id)?.[0] ?? null);
  return (
    <ul className="space-y-2" aria-label="Container objects">
      {objects.map((o) => {
        const names = handlesTo(o.objId);
        const global = globalOf(o.objId);
        return (
          <li key={o.objId} className="rounded-xl border border-border/70 bg-background/50 p-3">
            <p className="font-mono text-xs [font-variant-ligatures:none]">
              <span className="font-semibold">{o.type}@{o.objId}</span>
              {names.length ? <span className="text-muted-foreground"> ◀ {names.join(", ")}</span> : null}
              {global ? <span className="ml-2 rounded border border-cyan-500/60 px-1 text-[10px] text-cyan-800 dark:text-cyan-200">global singleton</span> : null}
            </p>
            {o.type === "uvm_queue#(int)" ? (
              <p className="mt-1 font-mono text-xs [font-variant-ligatures:none]">
                queue = {"'{"}
                {o.items.join(", ")}
                {"}"} <span className="text-muted-foreground">size() = {o.items.length}</span>
              </p>
            ) : (
              <table className="mt-1 w-full min-w-[220px] text-left font-mono text-xs [font-variant-ligatures:none]">
                <caption className="sr-only">Entries of {o.type}@{o.objId}</caption>
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th scope="col" className="pr-3">key</th>
                    <th scope="col">value</th>
                  </tr>
                </thead>
                <tbody>
                  {o.entries.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-muted-foreground">
                        (empty) num() = 0
                      </td>
                    </tr>
                  ) : (
                    o.entries.map(([k, v]) => (
                      <tr key={k} className="border-t border-border/40">
                        <td className="pr-3">&quot;{k}&quot;</td>
                        <td className={cn(v.kind === "null" && "text-rose-700 dark:text-rose-300")}>{formatPoolValue(v)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StepResult({ step, highlight = false }: { step: ProgramStep; highlight?: boolean }) {
  const r = step.result;
  return (
    <li className={cn("rounded-lg border p-2 text-sm", highlight ? "border-amber-500/60 bg-amber-500/[0.06]" : "border-border/60")}>
      <code className="font-mono text-xs [font-variant-ligatures:none]">{step.source}</code>
      {r.output ? <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-foreground [font-variant-ligatures:none]">→ {r.output}</pre> : null}
      {r.warning ? <p className="mt-1 font-mono text-xs text-amber-700 dark:text-amber-300 [font-variant-ligatures:none]">⚠ {r.warning}</p> : null}
      {r.fatal ? <p className="mt-1 font-mono text-xs font-semibold text-rose-700 dark:text-rose-300 [font-variant-ligatures:none]">✕ {r.fatal}</p> : null}
      <p className="mt-1 text-xs text-muted-foreground">{r.why}</p>
    </li>
  );
}

type ConsoleOp = "get" | "exists" | "add" | "delete" | "push_back" | "insert" | "qget" | "qdelete";

function TryItConsole({ mode, world, onRun }: { mode: ContainerMode; world: World; onRun: (stmt: ContainerStmt) => void }) {
  const isQueue = mode === "queue";
  const [op, setOp] = useState<ConsoleOp>(isQueue ? "insert" : "get");
  const [key, setKey] = useState("parity");
  const [num, setNum] = useState(1);
  const [val, setVal] = useState(7);
  const target = isQueue ? "q" : "err_pool";
  if (world.vars[target] === undefined) return null;
  const build = (): ContainerStmt => {
    switch (op) {
      case "get":
        return { kind: "get", target, key, into: "n" };
      case "exists":
        return { kind: "exists", target, key };
      case "add":
        return { kind: "add", target, key, value: val };
      case "delete":
        return { kind: "delete", target, key };
      case "push_back":
        return { kind: "push_back", target, value: val };
      case "insert":
        return { kind: "insert", target, index: num, value: val };
      case "qget":
        return { kind: "qget", target, index: num };
      case "qdelete":
        return { kind: "qdelete", target, index: num };
    }
  };
  const ops: { value: ConsoleOp; label: string }[] = isQueue
    ? [
        { value: "insert", label: "insert(i, v)" },
        { value: "push_back", label: "push_back(v)" },
        { value: "qget", label: "get(i)" },
        { value: "qdelete", label: "delete(i)" },
      ]
    : [
        { value: "get", label: "get(key)" },
        { value: "exists", label: "exists(key)" },
        { value: "add", label: "add(key, v)" },
        { value: "delete", label: "delete(key)" },
      ];
  const needsKey = ["get", "exists", "add", "delete"].includes(op);
  const needsIndex = ["insert", "qget", "qdelete"].includes(op);
  const needsValue = ["add", "push_back", "insert"].includes(op);
  return (
    <fieldset className="rounded-xl border border-border/70 p-3">
      <legend className="px-1 text-sm font-semibold text-foreground">Try your own call on {target}</legend>
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col text-xs text-muted-foreground">
          Method
          <select value={op} onChange={(e) => setOp(e.target.value as ConsoleOp)} className="h-10 rounded-md border border-border/70 bg-background px-2 font-mono text-sm text-foreground">
            {ops.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {needsKey ? (
          <label className="flex flex-col text-xs text-muted-foreground">
            key
            <input value={key} onChange={(e) => setKey(e.target.value)} className="h-10 w-28 rounded-md border border-border/70 bg-background px-2 font-mono text-sm text-foreground" />
          </label>
        ) : null}
        {needsIndex ? (
          <label className="flex flex-col text-xs text-muted-foreground">
            index i
            <input type="number" value={num} onChange={(e) => setNum(Number(e.target.value))} className="h-10 w-20 rounded-md border border-border/70 bg-background px-2 font-mono text-sm text-foreground" />
          </label>
        ) : null}
        {needsValue ? (
          <label className="flex flex-col text-xs text-muted-foreground">
            value v
            <input type="number" value={val} onChange={(e) => setVal(Number(e.target.value))} className="h-10 w-20 rounded-md border border-border/70 bg-background px-2 font-mono text-sm text-foreground" />
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => onRun(build())}
          className="h-10 rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Run <span className="font-mono [font-variant-ligatures:none]">{stmtSource(build())}</span>
        </button>
      </div>
    </fieldset>
  );
}

const buttonClass =
  "inline-flex h-10 items-center rounded-lg border border-border/70 bg-background/60 px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

function ProgramRunner({ mode }: { mode: ContainerMode }) {
  const program = containerPrograms[mode];
  const steps = useMemo(() => runProgram(program.stmts), [program]);
  const [count, setCount] = useState(0);
  const [extra, setExtra] = useState<ProgramStep[]>([]);
  const executed = steps.slice(0, count);
  const baseWorld = count === 0 ? emptyWorld() : steps[count - 1].result.world;
  const world = extra.length ? extra[extra.length - 1].result.world : baseWorld;
  const finished = count >= steps.length;
  const gated = count === program.predictAt;
  const lines = [
    ...program.declarations.map((text) => ({ text, owner: "testbench" as const })),
    ...program.stmts.map((s, i) => ({ text: stmtSource(s), key: `s${i}`, owner: "testbench" as const })),
  ];
  const reset = () => {
    setCount(0);
    setExtra([]);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{program.title}</p>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <CodeTrace label="Program" lines={lines} activeKey={finished ? undefined : `s${count}`} contextKeys={program.stmts.slice(0, count).map((_, i) => `s${i}`)} />
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">State after {count} statement{count === 1 ? "" : "s"}</p>
          <WorldView world={world} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={cn(buttonClass, "border-cyan-500/50 bg-cyan-500/10")} disabled={finished || gated} onClick={() => setCount((c) => c + 1)}>
          {gated ? "Predict first ↓" : finished ? "Program finished" : "Run next statement"}
        </button>
        <button type="button" className={buttonClass} onClick={reset} disabled={count === 0 && extra.length === 0}>
          Reset
        </button>
      </div>

      {count >= program.predictAt ? (
        <PredictionPrompt question={program.question} options={program.options} resetKey={`${mode}`}>
          {count === program.predictAt ? (
            <button type="button" className={cn(buttonClass, "border-amber-500/60 bg-amber-500/10")} onClick={() => setCount((c) => c + 1)}>
              Run <span className="ml-1 font-mono [font-variant-ligatures:none]">{steps[program.predictAt].source}</span>
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">Ran it — the result is the highlighted entry under Results.</p>
          )}
        </PredictionPrompt>
      ) : null}

      {executed.length ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Results</p>
          <ol className="space-y-2" aria-live="polite">
            {[...executed, ...extra].map((step, i) => (
              <StepResult key={i} step={step} highlight={i === program.predictAt} />
            ))}
          </ol>
        </div>
      ) : null}

      {finished && mode !== "event" ? (
        <TryItConsole
          mode={mode}
          world={world}
          onRun={(stmt) => {
            const result = execStmt(world, stmt);
            setExtra((cur) => [...cur, { stmt, source: stmtSource(stmt), result }]);
          }}
        />
      ) : null}
    </div>
  );
}

/** uvm_pool / uvm_event_pool / uvm_queue explorer: step through real calls, predict the surprising ones, then try your own. */
export default function UvmContainerVisualizer() {
  const [mode, setMode] = useState<ContainerMode>("pool");
  return (
    <VisualFrame
      label="UVM container explorer"
      eyebrow="Experiment"
      title="uvm_pool and uvm_queue: what the calls really do"
      summary="Step through each program. When a call surprises most engineers, the explorer stops and asks you first."
      fidelity="model"
      assumptions={CONTAINER_MODEL_ASSUMPTIONS}
    >
      <SegmentedControl
        label="Container"
        mono
        value={mode}
        onChange={setMode}
        options={[
          { value: "pool", label: "uvm_pool" },
          { value: "event", label: "uvm_event_pool" },
          { value: "queue", label: "uvm_queue" },
        ]}
      />
      <ProgramRunner key={mode} mode={mode} />
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[300px] text-left text-xs">
          <caption className="px-3 pt-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Policy support in uvm-core 2020.3.1</caption>
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-1.5">Container</th>
              <th scope="col" className="px-3 py-1.5">copy()</th>
              <th scope="col" className="px-3 py-1.5">print()</th>
              <th scope="col" className="px-3 py-1.5">compare()</th>
              <th scope="col" className="px-3 py-1.5">convert2string()</th>
            </tr>
          </thead>
          <tbody>
            {containerPolicySupport.map((row) => (
              <tr key={row.container} className="border-t border-border/50">
                <td className="px-3 py-1.5 font-mono [font-variant-ligatures:none]">{row.container}</td>
                <td className="px-3 py-1.5">{row.copy}</td>
                <td className="px-3 py-1.5">{row.print}</td>
                <td className="px-3 py-1.5">✕ {row.compare}</td>
                <td className="px-3 py-1.5">{row.convert2string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </VisualFrame>
  );
}
