"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { bindToSource, resolveBinds, type BindDirective, type DesignInstance } from "@/lib/sv-elaboration-model";
import { cn } from "@/lib/utils";

const DESIGN: DesignInstance[] = [
  { path: "tb_top.dut", module: "soc" },
  { path: "tb_top.dut.u_slave_0", module: "ahb_slave", localNames: ["u_fifo"] },
  { path: "tb_top.dut.u_slave_1", module: "ahb_slave", localNames: ["u_fifo"] },
  { path: "tb_top.dut.u_spi", module: "spi_ctrl" },
];

const PORTS = ".hclk(clk_i), .hresetn(rst_ni), .haddr(addr_i)";
const base: BindDirective = { form: "module", target: "ahb_slave", unit: "ahb_protocol_chk", instanceName: "chk_inst", ports: PORTS };

type ScenarioId = "module" | "list" | "instance" | "clash";

const SCENARIOS: Record<ScenarioId, { label: string; binds: BindDirective[]; note: string }> = {
  module: { label: "every ahb_slave", binds: [base], note: "Module form: the instance goes into every instance of ahb_slave, designwide." },
  list: {
    label: "listed instances",
    binds: [{ ...base, form: "module-list", instances: ["tb_top.dut.u_slave_1"] }],
    note: "Module : instance-list form: only the listed instances of ahb_slave get it.",
  },
  instance: {
    label: "one instance path",
    binds: [{ ...base, form: "instance", target: "tb_top.dut.u_slave_0" }],
    note: "Instance form: exactly one target instance.",
  },
  clash: {
    label: "two binds, same name",
    binds: [base, { ...base, unit: "ahb_cov_collector" }],
    note: "Two bind statements introduce the same instance name chk_inst into ahb_slave.",
  },
};

const RTL = [
  "module ahb_slave (input logic clk_i, rst_ni,",
  "                  input logic [31:0] addr_i);",
  "  ahb_fifo u_fifo (.*);",
  "  // ... locked RTL, owned by another team",
  "endmodule",
];

const CHECKER = [
  "checker ahb_protocol_chk (input logic hclk, hresetn,",
  "                          input logic [31:0] haddr);",
  "  a_addr_known: assert property (@(posedge hclk)",
  "    disable iff (!hresetn) !$isunknown(haddr));",
  "endchecker",
];

type Answer = "all" | "slave0" | "slave1" | "bindScope" | "error";

export default function BindDirectiveVisualizer() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("module");
  const scenario = SCENARIOS[scenarioId];
  const result = useMemo(() => resolveBinds(DESIGN, scenario.binds), [scenario]);
  const boundPaths = result.bound.map((b) => b.path);

  const correct: Answer =
    result.errors.length > 0
      ? "error"
      : boundPaths.length === 2
        ? "all"
        : boundPaths[0] === "tb_top.dut.u_slave_0.chk_inst"
          ? "slave0"
          : "slave1";

  const why: Record<Answer, string> = {
    all: "Binding to a module name inserts the instance into every instance of that module (§23.11), so both slaves get chk_inst.",
    slave0: "Only tb_top.dut.u_slave_0 is targeted, so only it gets chk_inst; the bound instance sits inside its target (§23.11).",
    slave1: "Only the listed instance tb_top.dut.u_slave_1 is targeted (§23.11).",
    bindScope:
      "The bind statement can be written anywhere (a bind file, tb_top, or $unit), but the instance is created inside the target scope, as if typed at the end of that module (§23.11).",
    error: "Each target would get two instances named chk_inst. A bound instance name may not clash with a name already in the target, including one added by another bind (§23.11).",
  };

  const diagnose = (id: Answer): string => {
    if (id === correct) return why[id];
    if (id === "bindScope") return why.bindScope;
    if (id === "error") return "Nothing clashes here: chk_inst is a new name in each target scope.";
    if (correct === "error") return "Both statements target ahb_slave with the same instance name, so the second one cannot be inserted.";
    if (id === "all") return "Only the module form reaches every instance. This statement names its target instance(s) explicitly.";
    if (correct === "all") return "The module form is not limited to one instance: every instance of ahb_slave gets the checker.";
    return "Read the target in the statement: it names the other instance.";
  };

  const option = (id: Answer, label: React.ReactNode): PredictionOption => ({ id, label, correct: id === correct, feedback: diagnose(id) });

  const options: PredictionOption[] = [
    option("all", <code className="font-mono text-xs">tb_top.dut.u_slave_0.chk_inst and tb_top.dut.u_slave_1.chk_inst</code>),
    option("slave0", <code className="font-mono text-xs">tb_top.dut.u_slave_0.chk_inst only</code>),
    option("slave1", <code className="font-mono text-xs">tb_top.dut.u_slave_1.chk_inst only</code>),
    option("bindScope", <><code className="font-mono text-xs">tb_top.chk_inst</code>, where the bind statement is written</>),
    option("error", "None: elaboration stops with an error"),
  ];

  const boundUnder = (path: string) => result.bound.filter((b) => b.parent === path);

  return (
    <VisualFrame
      label="Bind explorer"
      eyebrow="Experiment"
      title="bind: add a checker without editing the RTL"
      summary={
        <>
          <code className="font-mono">bind</code> is not a compiler directive (no backtick). It is processed at <strong>elaboration</strong>, when the tool builds the
          design hierarchy: the instance is inserted into the target scope as if it were typed at the end of that module (§23.11). Pick a form and predict where
          the checker lands.
        </>
      }
      fidelity="model"
      assumptions={[
        "Design: tb_top.dut contains two ahb_slave instances (u_slave_0, u_slave_1) and one spi_ctrl.",
        "Bind targets and name clashes follow §23.11; port expressions are resolved in the target scope.",
        "Errors are classified, not quoted: the wording differs by tool.",
      ]}
    >
      <SegmentedControl
        label="Bind form"
        options={(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => ({ value: id, label: SCENARIOS[id].label }))}
        value={scenarioId}
        onChange={setScenarioId}
      />

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <CodeTrace label="Locked RTL (not edited)" lines={RTL.map((text) => ({ text, owner: "design" as const }))} />
        <CodeTrace label="Checker" lines={CHECKER.map((text) => ({ text, owner: "testbench" as const }))} />
      </div>
      <CodeTrace
        label="sva_bindings.sv · processed at elaboration"
        lines={scenario.binds.map((b, i) => ({ text: bindToSource(b), owner: "testbench" as const, key: `bind-${i}` }))}
        contextKeys={scenario.binds.map((_, i) => `bind-${i}`)}
      />
      <p className="text-sm text-muted-foreground">{scenario.note} The names in the port list (clk_i, addr_i) are looked up inside the target ahb_slave, not where the bind is written.</p>

      <PredictionPrompt resetKey={scenarioId} question="After elaboration, where does the checker instance appear?" options={options}>
        <div className="space-y-3" aria-live="polite">
          {result.errors.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-900 dark:text-rose-100">
              {result.errors.map((e, i) => (
                <li key={i}>
                  ✕ Elaboration error: {e.message} ({e.clause})
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
              ✓ Bound: {boundPaths.map((p) => (
                <code key={p} className="mr-2 font-mono text-xs">
                  {p}
                </code>
              ))}
            </p>
          )}
          <div className="rounded-xl border border-border/70 bg-background/50 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {result.errors.length > 0 ? "Hierarchy when elaboration stopped" : "Elaborated hierarchy"}
            </p>
            <ul aria-label="Elaborated hierarchy" className="space-y-1 font-mono text-xs [font-variant-ligatures:none]">
              <li>tb_top</li>
              <li className="pl-4">
                dut <span className="text-muted-foreground">(soc)</span>
                <ul className="space-y-1 border-l border-border/70 pl-4">
                  {DESIGN.filter((d) => d.path.split(".").length === 3).map((d) => (
                    <li key={d.path}>
                      {d.path.split(".").pop()} <span className="text-muted-foreground">({d.module})</span>
                      <ul className="space-y-0.5 border-l border-border/70 pl-4">
                        {(d.localNames ?? []).map((n) => (
                          <li key={n} className="text-muted-foreground">
                            {n}
                          </li>
                        ))}
                        {boundUnder(d.path).map((b) => (
                          <li
                            key={b.path}
                            aria-label={`${b.path}, bound ${b.unit}`}
                            className={cn("w-fit rounded border px-1.5", "border-violet-500/60 bg-violet-500/10 text-violet-900 dark:text-violet-100")}
                          >
                            ⊕ chk_inst <span className="opacity-75">({b.unit}, bound)</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </div>
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
