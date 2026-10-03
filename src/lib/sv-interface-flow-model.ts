/**
 * Class → virtual interface → modport → signal flow, built on the interface
 * rules in `sv-interface-model.ts`.
 *
 * Rules (IEEE 1800-2023, each pinned by tests/lib/sv-interface-flow-model.test.ts):
 * - A virtual interface is a variable that holds a handle to an interface
 *   instance. It is null until assigned, and using a null virtual interface
 *   is a fatal run-time error (§25.9).
 * - A virtual interface type may select a modport; the modport is then part
 *   of its type, so access through it is limited to that modport (§25.9, §25.5).
 * - An interface instance, or a virtual interface with no modport, may be
 *   assigned to a virtual interface with a modport selected. Assigning a
 *   modport-selected handle to a no-modport handle is illegal, and so is
 *   assigning between different modports (§25.9: assignment only from the
 *   same type, and the modport is part of the type).
 * - Through a clocking block, input clockvars are read (sampled, §14.13),
 *   output clockvars are driven with `<=` (§14.16); writing an input or
 *   reading an output clockvar is illegal (§14.3).
 * - An `inout` modport item needs a net: variables cannot be connected to
 *   either side of an inout port (§6.5, §23.3.3).
 *
 * Static (compile/elaboration) errors are reported before run-time ones,
 * because a design that does not compile never reaches time 0.
 */

import { SIMPLE_BUS_IF, checkAccess, type AccessOp, type InterfaceDecl } from "./sv-interface-model";

export interface VifSetup {
  /** Modport selected in the virtual interface type, or null for `virtual simple_bus_if`. */
  modport: string | null;
  /** Whether `top` executes `drv.vif = bus_if;` before the driver runs. */
  assigned: boolean;
  /** Path relative to the handle, e.g. `cb.valid` or `valid`. */
  path: string;
  op: AccessOp;
}

export type FlowStepId = "instance" | "handle" | "modport" | "signal";

export interface FlowStep {
  id: FlowStepId;
  status: "ok" | "error" | "not-reached";
  text: string;
  clause?: string;
}

export interface VifVerdict {
  outcome: "legal" | "compile-error" | "fatal-runtime";
  statement: string;
  rule: string;
  clause: string;
  steps: FlowStep[];
}

export const vifTypeText = (decl: InterfaceDecl, modport: string | null) => `virtual ${decl.name}${modport ? `.${modport}` : ""}`;

function statementText(path: string, op: AccessOp): string {
  const full = `vif.${path}`;
  if (op === "read") return `x = ${full};`;
  return `${full} <= ${path.endsWith("addr") || path.endsWith("data") ? "32'h1000" : "1"};`;
}

/** Static legality of `path`/`op` through a handle with no modport selected. */
function checkWithoutModport(decl: InterfaceDecl, path: string, op: AccessOp): { legal: boolean; rule: string; clause: string } {
  const [head, tail] = path.split(".");
  if (head === decl.clocking.name) {
    const item = decl.clocking.items.find((i) => i.signal === tail);
    if (!item) return { legal: false, rule: `${tail} is not a clockvar of ${head}.`, clause: "§14.3" };
    if (op === "read" && item.dir === "output") {
      return { legal: false, rule: `${tail} is an output of ${head}: reading an output clockvar is illegal.`, clause: "§14.3" };
    }
    if (op === "drive" && item.dir === "input") {
      return { legal: false, rule: `${tail} is an input of ${head}: writing an input clockvar is illegal.`, clause: "§14.3" };
    }
    return op === "read"
      ? { legal: true, rule: `Reads the value ${head} sampled just before its last clocking event (#1step).`, clause: "§14.13" }
      : { legal: true, rule: `A synchronous drive: the value lands in Re-NBA at the next clocking event (output skew #0).`, clause: "§14.16" };
  }
  const signal = decl.signals.find((s) => s.name === head);
  if (!signal || tail) return { legal: false, rule: `${decl.name} has no member ${path}.`, clause: "§25.9" };
  if (op === "read") return { legal: true, rule: `With no modport selected, every member of the interface is reachable through the handle.`, clause: "§25.9" };
  // Signals the master view only reads are driven by the slave (the DUT).
  const ownedByDut = decl.modports.find((m) => m.name === "master")?.ports.some((p) => p.signal === head && p.dir === "input");
  return {
    legal: true,
    rule: `With no modport selected, nothing restricts the direction: the class writes ${head} directly, with no clocking-block timing.${
      ownedByDut ? ` The compiler accepts it, but ${head} belongs to the DUT, so the testbench now fights the DUT's own driver. A modport would have caught this.` : ""
    }`,
    clause: "§25.9",
  };
}

/** Full verdict for one statement executed by a class through a virtual interface. */
export function checkVifAccess(decl: InterfaceDecl, setup: VifSetup): VifVerdict {
  const statement = statementText(setup.path, setup.op);
  const typeText = vifTypeText(decl, setup.modport);
  const instanceStep: FlowStep = { id: "instance", status: "ok", text: `top instantiates ${decl.name} bus_if: the signals exist from elaboration on.`, clause: "§25.3" };

  const staticCheck = setup.modport
    ? (() => {
        const v = checkAccess(decl, setup.modport, setup.path, setup.op);
        return { legal: v.outcome === "legal", rule: v.rule.replace(/\bbus\./g, "vif."), clause: v.clause };
      })()
    : checkWithoutModport(decl, setup.path, setup.op);

  const viewText = setup.modport ? `The handle's type ${typeText} limits it to modport ${setup.modport}.` : `The handle's type ${typeText} selects no modport, so no direction rules apply.`;

  if (!staticCheck.legal) {
    return {
      outcome: "compile-error",
      statement,
      rule: `${staticCheck.rule} The tool rejects this before simulation starts, whether or not the handle is ever assigned.`,
      clause: staticCheck.clause,
      steps: [
        instanceStep,
        { id: "handle", status: "not-reached", text: "Never runs: the design does not compile." },
        { id: "modport", status: "error", text: `${viewText} ${staticCheck.rule}`, clause: staticCheck.clause },
        { id: "signal", status: "not-reached", text: "No signal is touched." },
      ],
    };
  }

  if (!setup.assigned) {
    return {
      outcome: "fatal-runtime",
      statement,
      rule: "The code compiles, but vif is still null when the driver first uses it: the simulator stops with a fatal error at that line (often the wait on the clock, before this statement).",
      clause: "§25.9",
      steps: [
        instanceStep,
        { id: "handle", status: "error", text: "drv.vif was never assigned, so it holds null. The first use of vif is a fatal run-time error.", clause: "§25.9" },
        { id: "modport", status: "ok", text: `${viewText} The statement itself is legal.`, clause: staticCheck.clause },
        { id: "signal", status: "not-reached", text: "Not reached: simulation has stopped." },
      ],
    };
  }

  const signal = setup.path.split(".").at(-1) as string;
  return {
    outcome: "legal",
    statement,
    rule: staticCheck.rule,
    clause: staticCheck.clause,
    steps: [
      instanceStep,
      {
        id: "handle",
        status: "ok",
        text: `drv.vif = bus_if; stores a handle to the instance. An instance with no modport may be assigned to a handle of any modport view.`,
        clause: "§25.9",
      },
      { id: "modport", status: "ok", text: `${viewText} ${staticCheck.rule}`, clause: staticCheck.clause },
      {
        id: "signal",
        status: "ok",
        text:
          setup.op === "read"
            ? `The class gets ${setup.path.startsWith(`${decl.clocking.name}.`) ? "the sampled" : "the current"} value of bus_if.${signal}.`
            : setup.path.startsWith(`${decl.clocking.name}.`)
              ? `bus_if.${signal} changes in Re-NBA of the clocking event; the DUT's slave view reads it.`
              : `bus_if.${signal} changes as soon as the statement runs; the DUT's slave view reads it.`,
      },
    ],
  };
}

export type VifSource = { kind: "instance" } | { kind: "vif"; modport: string | null };

/** §25.9 assignment compatibility for `target = source;`. */
export function checkVifAssignment(targetModport: string | null, source: VifSource): { legal: boolean; why: string; clause: string } {
  if (source.kind === "instance") {
    return { legal: true, why: "An interface instance (no modport selected) may be assigned to a virtual interface with or without a modport.", clause: "§25.9" };
  }
  if (source.modport === targetModport) return { legal: true, why: "Same interface, same modport: the types match.", clause: "§25.9" };
  if (source.modport === null) {
    return { legal: true, why: "A virtual interface with no modport may be assigned to one with a modport selected.", clause: "§25.9" };
  }
  return {
    legal: false,
    why:
      targetModport === null
        ? "Illegal: a handle with a modport selected cannot be assigned to a handle with no modport (it would widen access)."
        : `Illegal: the modport is part of the type, so .${source.modport} and .${targetModport} handles are different types.`,
    clause: "§25.9",
  };
}

/** Modport items that are illegal in the declaration itself (inout on a variable, §6.5, §23.3.3). */
export function modportDeclarationErrors(decl: InterfaceDecl): string[] {
  const errors: string[] = [];
  for (const mp of decl.modports) {
    for (const port of mp.ports) {
      const signal = decl.signals.find((s) => s.name === port.signal);
      if (port.dir === "inout" && signal?.kind === "variable") errors.push(`${mp.name}.${port.signal}`);
    }
  }
  return errors;
}

export interface FlowStatement {
  path: string;
  op: AccessOp;
}

/** Statements offered for every handle type. Each type gets at least one legal and one illegal choice. */
export const FLOW_STATEMENTS: FlowStatement[] = [
  { path: "cb.valid", op: "drive" },
  { path: "valid", op: "drive" },
  { path: "cb.ready", op: "read" },
  { path: "ready", op: "read" },
  { path: "ready", op: "drive" },
  { path: "cb.valid", op: "read" },
];

export const HANDLE_MODPORTS: (string | null)[] = [null, "drv", "master", "monitor"];

export interface FlowPreset {
  id: string;
  label: string;
  setup: VifSetup;
  /** What a learner debugging this would see in the log. */
  symptom: string;
}

export const FLOW_PRESETS: FlowPreset[] = [
  { id: "working", label: "Clocking drive", setup: { modport: "drv", assigned: true, path: "cb.valid", op: "drive" }, symptom: "valid rises one clock edge after the drive." },
  { id: "null-vif", label: "Assignment missing", setup: { modport: "drv", assigned: false, path: "cb.valid", op: "drive" }, symptom: "Simulation stops at time 0 with a fatal null-handle error." },
  { id: "bypass-cb", label: "Direct drive via drv", setup: { modport: "drv", assigned: true, path: "valid", op: "drive" }, symptom: "The file does not compile: valid is not visible through drv." },
  { id: "monitor-drives", label: "Monitor handle drives", setup: { modport: "monitor", assigned: true, path: "valid", op: "drive" }, symptom: "Compile error on the assignment to an input." },
  { id: "read-output", label: "Read cb.valid", setup: { modport: "drv", assigned: true, path: "cb.valid", op: "read" }, symptom: "Compile error on the read of cb.valid." },
];

export interface FlowCodeLine {
  text: string;
  key?: string;
  owner?: "design" | "testbench";
}

/** Class and top-level code for a setup, generated from the same data the verdict uses. */
export function flowSource(decl: InterfaceDecl, setup: VifSetup): FlowCodeLine[] {
  const mp = setup.modport ? decl.modports.find((m) => m.name === setup.modport) : undefined;
  const clockingOnly = !setup.modport || Boolean(mp?.clocking);
  const wait = clockingOnly ? `@(vif.${decl.clocking.name});` : `@(posedge vif.${decl.clock});`;
  return [
    { text: "class driver;", owner: "testbench" },
    { text: `  ${vifTypeText(decl, setup.modport)} vif;`, key: "vif-decl", owner: "testbench" },
    { text: "  task run();", owner: "testbench" },
    { text: `    ${wait}`, key: "wait", owner: "testbench" },
    { text: `    ${statementText(setup.path, setup.op)}`, key: "stmt", owner: "testbench" },
    { text: "  endtask", owner: "testbench" },
    { text: "endclass", owner: "testbench" },
    { text: "" },
    { text: "module top;", owner: "design" },
    { text: `  logic ${decl.clock};`, owner: "design" },
    { text: `  ${decl.name} bus_if (${decl.clock});`, key: "instance", owner: "design" },
    { text: "  slave_dut dut (bus_if.slave);", owner: "design" },
    { text: "  driver drv;", owner: "testbench" },
    { text: "  initial begin", owner: "testbench" },
    { text: "    drv = new();", owner: "testbench" },
    { text: setup.assigned ? "    drv.vif = bus_if;" : "    // drv.vif = bus_if;   (missing)", key: "assign", owner: "testbench" },
    { text: "    drv.run();", owner: "testbench" },
    { text: "  end", owner: "testbench" },
    { text: "endmodule", owner: "design" },
  ];
}

export { SIMPLE_BUS_IF };
