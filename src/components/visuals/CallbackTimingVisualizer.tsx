"use client";

import React, { useMemo, useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode } from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  DEFAULT_CB_CONFIG,
  DRIVERS,
  callbackSource,
  locationLabels,
  runCallbackScenario,
  shortPath,
  type CbConfig,
  type CbLocation,
  type CbOrdering,
  type CbOutcome,
  type CbResult,
  type CbTarget,
  type LogCbTiming,
} from "@/lib/uvm-callback-model";
import { cn } from "@/lib/utils";

export const CALLBACK_MODEL_ASSUMPTIONS = [
  "Registration and iteration follow uvm-core 2020.3.1 src/base/uvm_callback.svh (IEEE 1800.2-2020 §10.7): add(null, cb) is type-wide; the first instance add copies the type-wide queue; UVM_PREPEND inserts at the front; iteration skips callbacks whose callback_mode() is 0.",
  "UVM builds top-down: a component's children exist only after its own build_phase has run. A handle is read when add() executes.",
  "Reading a member through a null handle is illegal (IEEE 1800-2023 §8.4); simulators stop with a null-object error.",
  "Each driver sends two packets, at 10 ns and 30 ns. err_cb inverts the CRC; log_cb prints the CRC it sees.",
  "Not modelled: report catchers, `uvm_set_super_type` inheritance, delete() on an instance with no queue.",
];

const outcomeText: Record<CbOutcome, string> = {
  "only-agt0": "Only agt0.drv corrupts CRCs",
  both: "Both drivers corrupt CRCs",
  neither: "No driver corrupts anything",
  "null-access": "Simulation stops with a null-object error during build",
};

function outcomeOptions(r: CbResult): PredictionOption[] {
  const o = r.outcome;
  const byName = r.config.target === "by-name";
  const fb = (id: CbOutcome): string => {
    if (id === o) return r.why;
    switch (id) {
      case "only-agt0":
        return `That is what the code means to do. ${r.why}`;
      case "both":
        return o === "only-agt0"
          ? "Type-wide registration happens only when add() receives null. Here the handle points at the real agt0 driver, so err_cb goes into agt0's instance queue."
          : o === "neither"
            ? `Nothing is registered at all. ${r.why}`
            : `The call never runs. ${r.why}`;
      case "neither":
        return o === "both"
          ? "add() does not reject a null handle: null is how you ask for type-wide registration, so it succeeds silently and every my_driver gets err_cb."
          : o === "only-agt0"
            ? `The target exists at this point. ${r.why}`
            : `It fails before add() runs. ${r.why}`;
      case "null-access":
        return byName
          ? "add_by_name takes a string, so no handle is dereferenced."
          : o === "both"
            ? "Only the last handle on the path is null, and passing a null handle is legal. Reading a member through a null handle is not, and that does not happen here."
            : "Every object on the path exists here, so nothing is read through a null handle.";
    }
  };
  return (["only-agt0", "both", "neither", "null-access"] as CbOutcome[]).map((id) => ({ id, label: outcomeText[id], correct: id === o, feedback: fb(id) }));
}

function CallbackTopology({ result }: { result: CbResult }) {
  const corrupted = (d: string) => result.runs.some((r) => r.driver === d && r.corrupted);
  const q = (d: string) => result.queues.find((x) => x.driver === d)!;
  const drvNode = (d: string, x: number): DiagramNode => {
    const intended = d === DRIVERS[0];
    const c = corrupted(d);
    return {
      id: d,
      label: "drv",
      sublabel: q(d).queue.length ? q(d).queue.join(" → ") : "no callbacks",
      kind: "driver",
      x,
      y: 104,
      w: 150,
      h: 56,
      badge: q(d).source === "instance" ? "own queue" : "type-wide",
      state: result.outcome === "null-access" ? "dim" : c ? (intended ? "ok" : "error") : "normal",
    };
  };
  const nodes: DiagramNode[] = [
    { id: "test", label: "uvm_test_top (err_test)", kind: "test", x: 6, y: 6, w: 628, h: 208, container: true },
    { id: "env", label: "env", kind: "env", x: 20, y: 32, w: 600, h: 170, container: true },
    { id: "agt0", label: "agt0", kind: "agent", x: 34, y: 62, w: 280, h: 126, container: true },
    { id: "agt1", label: "agt1", kind: "agent", x: 326, y: 62, w: 280, h: 126, container: true },
    drvNode(DRIVERS[0], 50),
    drvNode(DRIVERS[1], 342),
    { id: "sqr0", label: "sqr", kind: "sequencer", x: 214, y: 104, w: 84, h: 56 },
    { id: "sqr1", label: "sqr", kind: "sequencer", x: 506, y: 104, w: 84, h: 56 },
  ];
  const edges: DiagramEdge[] = [
    { id: "e0", from: "sqr0", to: DRIVERS[0], style: "data", label: "req" },
    { id: "e1", from: "sqr1", to: DRIVERS[1], style: "data", label: "req" },
  ];
  return (
    <BlockDiagram
      title={`Component tree after build. agt0.drv queue: ${q(DRIVERS[0]).queue.join(", ") || "empty"} (${q(DRIVERS[0]).source}). agt1.drv queue: ${q(DRIVERS[1]).queue.join(", ") || "empty"} (${q(DRIVERS[1]).source}).`}
      width={640}
      minWidth={480}
      height={220}
      nodes={nodes}
      edges={edges}
    />
  );
}

function QueuesPanel({ result }: { result: CbResult }) {
  const s = result.finalState;
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-xs">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Callback queues for (my_driver, drv_cb)</p>
      <dl className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <dt className="min-w-[8rem] font-mono text-foreground">type-wide (*)</dt>
          <dd className="font-mono text-foreground">{s.typeWide.length ? s.typeWide.join(" → ") : "empty"}</dd>
        </div>
        {DRIVERS.map((d) => (
          <div key={d} className="flex flex-wrap gap-2">
            <dt className="min-w-[8rem] font-mono text-foreground">{shortPath(d)}</dt>
            <dd className="text-foreground">
              {s.instance[d] ? (
                <span className="font-mono">{s.instance[d].join(" → ") || "empty"}</span>
              ) : (
                <span className="text-muted-foreground">no instance queue: iterates the type-wide queue</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ElaborationTimeline({ result }: { result: CbResult }) {
  return (
    <ol className="space-y-1.5 text-sm" aria-label="Elaboration order">
      {result.timeline.map((s, i) => (
        <li
          key={i}
          className={cn(
            "rounded-lg border px-3 py-2",
            s.isAdd ? (s.message?.severity === "fatal" ? "border-rose-500/60 bg-rose-500/10" : s.message?.severity === "warning" ? "border-amber-500/60 bg-amber-500/10" : "border-cyan-500/60 bg-cyan-500/10") : "border-border/60",
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {i + 1}. {s.phase} · {s.scope}
            {s.isAdd ? " · ▶ your add()" : ""}
          </p>
          <code className="block whitespace-pre-wrap break-words font-mono text-[12px] text-foreground [font-variant-ligatures:none]">{s.text}</code>
          {s.message ? (
            <p className={cn("mt-1 text-xs", s.message.severity === "fatal" ? "text-rose-700 dark:text-rose-300" : s.message.severity === "warning" ? "text-amber-800 dark:text-amber-200" : "text-foreground/80")}>
              {s.message.severity === "warning" ? `UVM_WARNING [${s.message.id}] ` : s.message.severity === "fatal" ? "Fatal: " : ""}
              {s.message.text}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-muted-foreground">exists now: {s.exists.join(", ") || "only the test"}</p>
        </li>
      ))}
    </ol>
  );
}

function RunTable({ result }: { result: CbResult }) {
  if (result.outcome === "null-access") return <p className="text-sm text-rose-700 dark:text-rose-300">No packets are sent: the simulation stopped during build_phase.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] border-collapse text-xs">
        <caption className="mb-1 text-left text-[11px] text-muted-foreground">pre_send hooks per packet, in the order `uvm_do_callbacks runs them</caption>
        <thead>
          <tr>
            {["Driver", "Packet", "Callbacks run", "CRC sent"].map((h) => (
              <th key={h} scope="col" className="border-b border-border p-1.5 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.runs.map((r) => (
            <tr key={`${r.driver}-${r.packet}`}>
              <th scope="row" className="border-b border-border/60 p-1.5 text-left font-mono font-medium">
                {shortPath(r.driver)}
              </th>
              <td className="border-b border-border/60 p-1.5">
                #{r.packet} at {r.t} ns
              </td>
              <td className="border-b border-border/60 p-1.5 font-mono [font-variant-ligatures:none]">{r.executed.length ? r.executed.map((e) => `${e.cb}: ${e.effect}`).join("; ") : "none"}</td>
              <td className={cn("border-b border-border/60 p-1.5 font-mono", r.corrupted ? "font-semibold text-rose-700 dark:text-rose-300" : "text-foreground")}>
                {r.corrupted ? "✕ " : "✓ "}0x{r.crcOut.toString(16).toUpperCase().padStart(2, "0")}
                {r.corrupted ? " (corrupted)" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderQuestion({ result }: { result: CbResult }) {
  const first = result.runs.find((r) => r.driver === DRIVERS[0] && r.packet === 1)!;
  const logEffect = first.executed.find((e) => e.cb === "log_cb")?.effect ?? "";
  const logsCorrupted = logEffect.includes("0xA5");
  const orderText = result.agt0Order.join(" → ");
  const options: PredictionOption[] = [
    {
      id: "original",
      label: "The original CRC, 0x5A",
      correct: !logsCorrupted,
      feedback: !logsCorrupted
        ? `agt0.drv runs ${orderText}: log_cb was in the queue first and err_cb was appended after it, so the log shows a CRC the DUT never received.`
        : `Here err_cb runs first (${orderText}). ${result.config.ordering === "UVM_PREPEND" ? "UVM_PREPEND put it in front of log_cb." : "log_cb was registered type-wide after agt0's queue already held err_cb, so it was appended behind it."}`,
    },
    {
      id: "corrupted",
      label: "The corrupted CRC, 0xA5",
      correct: logsCorrupted,
      feedback: logsCorrupted
        ? `agt0.drv runs ${orderText}, so log_cb sees the CRC after err_cb flipped it.`
        : `Callbacks run in queue order, not in the order you think of them. agt0.drv runs ${orderText}: log_cb prints before err_cb changes anything.`,
    },
  ];
  return (
    <PredictionPrompt question="On agt0.drv's first packet, which CRC does log_cb print?" options={options} resetKey={JSON.stringify(result.config)}>
      <RunTable result={result} />
    </PredictionPrompt>
  );
}

function CallbackExplorer() {
  const [config, setConfig] = useState<CbConfig>(DEFAULT_CB_CONFIG);
  const [advanced, setAdvanced] = useState(false);
  const set = <K extends keyof CbConfig>(key: K, value: CbConfig[K]) => setConfig((c) => ({ ...c, [key]: value }));
  const result = useMemo(() => runCallbackScenario(config), [config]);
  const lines: CodeTraceLine[] = callbackSource(config).map((l) => ({ text: l.text, key: l.key, owner: "testbench" }));
  const configKey = JSON.stringify(config);
  const showOrder = (result.outcome === "only-agt0" || result.outcome === "both") && config.logCb !== "none";

  return (
    <VisualFrame
      label="Callback registration timing experiment"
      eyebrow="Experiment"
      title="When does add() see your driver?"
      summary="err_test wants CRC errors on agt0's driver only; agt1's driver must stay clean. Choose where the add() call runs and what it is given, then predict."
      fidelity="model"
      assumptions={CALLBACK_MODEL_ASSUMPTIONS}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div>
          <p className="mb-1 text-xs font-semibold text-foreground">Where the add() runs</p>
          <SegmentedControl<CbLocation>
            label="Where the add() runs"
            mono
            value={config.location}
            onChange={(v) => set("location", v)}
            options={(["test-build", "env-build", "test-connect", "test-eoe"] as CbLocation[]).map((l) => ({ value: l, label: locationLabels[l] }))}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-foreground">What add() is given</p>
          <SegmentedControl<CbTarget>
            label="What add() is given"
            value={config.target}
            onChange={(v) => set("target", v)}
            options={[
              { value: "handle", label: "Handle to agt0's driver" },
              { value: "by-name", label: "add_by_name(\"*.agt0.drv\")" },
              { value: "null", label: "null" },
            ]}
          />
        </div>
      </div>
      <div>
        <button
          type="button"
          aria-expanded={advanced}
          onClick={() => setAdvanced((a) => !a)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {advanced ? "Hide advanced: order and callback_mode" : "Show advanced: order and callback_mode"}
        </button>
        {advanced ? (
          <div className="mt-2 grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            <div>
              <p className="mb-1 text-xs font-semibold text-foreground">err_cb ordering</p>
              <SegmentedControl<CbOrdering>
                label="err_cb ordering"
                mono
                value={config.ordering}
                onChange={(v) => set("ordering", v)}
                options={[
                  { value: "UVM_APPEND", label: "UVM_APPEND" },
                  { value: "UVM_PREPEND", label: "UVM_PREPEND" },
                ]}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-foreground">Type-wide log_cb registered in</p>
              <SegmentedControl<LogCbTiming>
                label="Type-wide log_cb registered in"
                value={config.logCb}
                onChange={(v) => set("logCb", v)}
                options={[
                  { value: "base-build", label: "base_test build_phase" },
                  { value: "start-of-sim", label: "start_of_simulation_phase" },
                  { value: "none", label: "not registered" },
                ]}
              />
            </div>
            <label className="flex min-h-10 items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={config.disableAt20ns} onChange={(e) => set("disableAt20ns", e.target.checked)} className="h-4 w-4 accent-cyan-500" />
              err_cb.callback_mode(0) at 20 ns
            </label>
          </div>
        ) : null}
      </div>

      <CodeTrace label="Test and environment code (generated from the model)" lines={lines} activeKey="add" />

      <PredictionPrompt question="Two drivers, env.agt0.drv and env.agt1.drv. What happens when the test runs?" options={outcomeOptions(result)} resetKey={configKey}>
        <div className="space-y-4">
          <div
            aria-live="polite"
            className={cn(
              "rounded-xl border p-3 text-sm",
              result.outcome === "only-agt0" ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10",
            )}
          >
            <p className="font-semibold text-foreground">
              <span aria-hidden className="mr-1.5">
                {result.outcome === "only-agt0" ? "✓" : "✕"}
              </span>
              {result.summary}
            </p>
            <p className="mt-1 text-foreground/90">{result.why}</p>
          </div>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Build order, top-down</p>
              <ElaborationTimeline result={result} />
            </div>
            <div className="min-w-0 space-y-3">
              <CallbackTopology result={result} />
              <QueuesPanel result={result} />
            </div>
          </div>
          {showOrder ? <OrderQuestion key={configKey} result={result} /> : <RunTable result={result} />}
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------------- */
/* Debug challenge                                                            */
/* ------------------------------------------------------------------------- */

const DEBUG_BASE: CbConfig = { ...DEFAULT_CB_CONFIG, location: "env-build", target: "handle", logCb: "none" };

const driverLines: CodeTraceLine[] = [
  { text: "" },
  { text: "class my_driver extends uvm_driver #(packet);", owner: "testbench" },
  { text: "  `uvm_register_cb(my_driver, drv_cb)", key: "register", owner: "testbench" },
  { text: "  task run_phase(uvm_phase phase);", owner: "testbench" },
  { text: "    forever begin", owner: "testbench" },
  { text: "      seq_item_port.get_next_item(req);", owner: "testbench" },
  { text: "      `uvm_do_callbacks(my_driver, drv_cb, pre_send(this, req))", key: "do", owner: "testbench" },
  { text: "      drive(req);  seq_item_port.item_done();", owner: "testbench" },
  { text: "    end", owner: "testbench" },
  { text: "  endtask", owner: "testbench" },
  { text: "endclass", owner: "testbench" },
];

const cbSuspects: { key: string; verdict: "culprit" | "innocent"; feedback: string }[] = [
  {
    key: "create-agt",
    verdict: "innocent",
    feedback: "Creating the agents here is right. The problem is what does not exist yet: agt0's own build_phase, which creates agt0.drv, has not run.",
  },
  {
    key: "add",
    verdict: "culprit",
    feedback:
      "Yes. agt0.drv is read when add() runs, inside my_env.build_phase. agt0 exists but its build_phase has not run, so agt0.drv is null and add(null, err_cb) registers err_cb for every my_driver, silently.",
  },
  {
    key: "register",
    verdict: "innocent",
    feedback: "`uvm_register_cb only declares that my_driver accepts drv_cb callbacks. It attaches nothing to any instance.",
  },
  {
    key: "do",
    verdict: "innocent",
    feedback: "`uvm_do_callbacks runs whatever queue this driver has. agt1's driver has no instance queue, so it runs the type-wide queue, which is where err_cb ended up.",
  },
];

const cbFixes: { id: string; label: string; config: CbConfig; review: string }[] = [
  {
    id: "env-connect",
    label: "Move the add() to my_env.connect_phase",
    config: { ...DEBUG_BASE, location: "env-connect" },
    review: "Accepted. By connect_phase every driver exists, so agt0.drv is the real instance.",
  },
  {
    id: "by-name",
    label: 'Keep it in build_phase but call add_by_name("*.agt0.drv", err_cb, this)',
    config: { ...DEBUG_BASE, target: "by-name" },
    review: "Rejected. add_by_name finds no driver during build (CBNOMTC), so nothing is injected anywhere and the error test quietly tests nothing.",
  },
  {
    id: "prepend",
    label: "Pass UVM_PREPEND so err_cb runs before other callbacks",
    config: { ...DEBUG_BASE, ordering: "UVM_PREPEND" },
    review: "Rejected. Ordering does not change what the null handle means: still type-wide.",
  },
  {
    id: "test-build",
    label: "Move it to err_test.build_phase: add(env.agt0.drv, err_cb)",
    config: { ...DEBUG_BASE, location: "test-build" },
    review: "Rejected. Even earlier: env.agt0 itself is null in the test's build_phase, so the simulation stops on a null-object access.",
  },
];

function CallbackDebugChallenge() {
  const buggy = useMemo(() => runCallbackScenario(DEBUG_BASE), []);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);
  const visible = useMemo<CodeTraceLine[]>(() => {
    const src = callbackSource(DEBUG_BASE);
    const envStart = src.findIndex((l) => l.text.startsWith("class my_env"));
    return [...src.slice(envStart).map((l) => ({ text: l.text, key: l.key, owner: "testbench" as const })), ...driverLines];
  }, []);
  const chosen = cbSuspects.find((s) => s.key === suspect);
  const found = chosen?.verdict === "culprit";
  const fix = cbFixes.find((f) => f.id === fixId);
  const fixResult = fix ? runCallbackScenario(fix.config) : null;
  const firstOfKey = (line: CodeTraceLine) => visible.find((l) => l.key === line.key) === line;

  return (
    <VisualFrame
      label="Callback debugging challenge"
      eyebrow="Debug it"
      title="The error test that breaks the wrong driver"
      summary="The error-injection test should corrupt CRCs on agt0 only. The regression shows CRC errors from agt1's scoreboard too. Find the line, then choose a fix; the model reruns the build and both drivers."
      fidelity="model"
      assumptions={CALLBACK_MODEL_ASSUMPTIONS}
    >
      <pre className="overflow-x-auto rounded-xl bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]" aria-label="Failing log">
        {buggy.runs
          .filter((r) => r.corrupted)
          .map((r) =>
            r.driver.includes("agt1")
              ? `UVM_ERROR @ ${r.t} ns [SCB1] CRC error on packet ${r.packet}: agt1 is not under error injection`
              : `UVM_INFO  @ ${r.t} ns [SCB0] CRC error on packet ${r.packet}: expected, injected by err_cb`,
          )
          .join("\n")}
      </pre>
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Step 1: select the line that makes agt1 corrupt its packets</p>
        <CodeTrace
          label="my_env and my_driver"
          lines={visible}
          activeKey={suspect ?? undefined}
          renderLineControl={(line) =>
            cbSuspects.some((s) => s.key === line.key) && firstOfKey(line) ? (
              <button
                type="button"
                aria-pressed={suspect === line.key}
                aria-label={`Suspect line: ${line.text.trim()}`}
                onClick={() => setSuspect(line.key as string)}
                className={cn(
                  "min-h-7 rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                  suspect === line.key ? "border-amber-400 bg-amber-400/20 text-amber-100" : "border-slate-500 text-slate-300 hover:bg-white/10",
                )}
              >
                {suspect === line.key ? "suspected" : "suspect"}
              </button>
            ) : null
          }
        />
        {chosen ? (
          <p aria-live="polite" className={cn("mt-2 text-sm", found ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
            <strong>{found ? "Found it. " : "Not this one. "}</strong>
            {chosen.feedback}
          </p>
        ) : null}
        {!found ? (
          <HintLadder
            className="mt-2"
            hints={[
              "agt1 never appears in the code, yet it runs err_cb. Which kind of registration reaches every instance?",
              "add(null, cb) is type-wide. Where could a null sneak into an add() call?",
              "Which build_phase creates agt0.drv, and has it run when my_env.build_phase reaches the add()?",
            ]}
          />
        ) : null}
      </div>
      {found ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">Step 2: choose a fix; the model rebuilds the tree and runs both drivers</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {cbFixes.map((f) => (
              <label key={f.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fixId === f.id ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}>
                <input type="radio" name="cb-fix" checked={fixId === f.id} onChange={() => setFixId(f.id)} className="mt-1 accent-cyan-500" />
                <span className="font-mono text-[12.5px] [font-variant-ligatures:none]">{f.label}</span>
              </label>
            ))}
          </div>
          {fix && fixResult ? (
            <div
              aria-live="polite"
              className={cn("mt-3 space-y-1 rounded-xl border p-3 text-sm", fixResult.outcome === "only-agt0" ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10")}
            >
              <p className="font-semibold text-foreground">Model: {fixResult.summary}</p>
              <p className="text-foreground/90">
                <strong>Review: </strong>
                {fix.review}
              </p>
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </VisualFrame>
  );
}

/**
 * UVM callback registration timing: null handle → type-wide, top-down build,
 * APPEND/PREPEND order and callback_mode. `mode="debug"` is a find-and-fix
 * challenge on the two-driver leak.
 */
export default function CallbackTimingVisualizer({ mode = "explore" }: { mode?: "explore" | "debug" }) {
  return mode === "debug" ? <CallbackDebugChallenge /> : <CallbackExplorer />;
}
