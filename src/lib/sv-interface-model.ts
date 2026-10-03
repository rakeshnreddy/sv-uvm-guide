/**
 * Deterministic model of interface, modport and clocking-block access rules
 * (IEEE 1800-2023 Clauses 14, 23 and 25).
 *
 * Rules (each pinned by tests/lib/sv-interface-model.test.ts):
 * - A modport declares directions "as if inside the module" that uses it (§25.5),
 *   including for a clocking block listed in it (§25.5.5).
 * - Through a modport port, only the names listed in that modport are accessible (§25.5).
 * - Assigning to a variable declared as an input port is illegal (§23.3.3.2);
 *   reading inputs and outputs is legal.
 * - Variables cannot be connected to either side of an inout port, so an
 *   `inout` modport item needs a net (§6.5, §23.3.3).
 * - Writing an input clockvar or reading an output clockvar is illegal, and a
 *   clockvar can only be written with the synchronous drive `<=` (§14.3, §14.16).
 * - A null virtual interface is a fatal run-time error when used (§25.9).
 *
 * Assumptions: signals other than the clock are `logic` variables (the common
 * testbench style). For nets, §23.3.3.1 port coercion can turn a driven input
 * into an inout with a warning instead of an error; the model does not cover that.
 */

export type Direction = "input" | "output" | "inout";

export interface InterfaceSignal {
  name: string;
  width: number;
  kind: "variable" | "net";
  /** Who normally drives it, for the learner. */
  note: string;
}

export interface ClockingItem {
  signal: string;
  dir: "input" | "output";
}

export interface ClockingDecl {
  name: string;
  event: string;
  skews: string;
  items: ClockingItem[];
}

export interface ModportPort {
  signal: string;
  dir: Direction;
}

export interface ModportDecl {
  name: string;
  /** The module that would use this view. */
  user: string;
  ports: ModportPort[];
  /** `modport drv (clocking cb)` */
  clocking?: string;
}

export interface InterfaceDecl {
  name: string;
  clock: string;
  signals: InterfaceSignal[];
  clocking: ClockingDecl;
  modports: ModportDecl[];
}

const bus = ["addr", "data", "rw", "valid"];

export const SIMPLE_BUS_IF: InterfaceDecl = {
  name: "simple_bus_if",
  clock: "clk",
  signals: [
    { name: "addr", width: 32, kind: "variable", note: "request address, driven by the master" },
    { name: "data", width: 32, kind: "variable", note: "write data, driven by the master" },
    { name: "rw", width: 1, kind: "variable", note: "1 = read, 0 = write" },
    { name: "valid", width: 1, kind: "variable", note: "master has a request" },
    { name: "ready", width: 1, kind: "variable", note: "slave can accept it" },
  ],
  clocking: {
    name: "cb",
    event: "@(posedge clk)",
    skews: "default input #1step output #0;",
    items: [...bus.map((signal) => ({ signal, dir: "output" as const })), { signal: "ready", dir: "input" as const }],
  },
  modports: [
    {
      name: "master",
      user: "master_driver",
      ports: [{ signal: "clk", dir: "input" }, { signal: "ready", dir: "input" }, ...bus.map((signal) => ({ signal, dir: "output" as const }))],
    },
    {
      name: "slave",
      user: "slave_dut",
      ports: [{ signal: "clk", dir: "input" }, ...bus.map((signal) => ({ signal, dir: "input" as const })), { signal: "ready", dir: "output" }],
    },
    {
      name: "monitor",
      user: "bus_monitor",
      ports: [{ signal: "clk", dir: "input" }, ...[...bus, "ready"].map((signal) => ({ signal, dir: "input" as const }))],
    },
    { name: "drv", user: "tb_driver", ports: [], clocking: "cb" },
  ],
};

export interface CodeLine {
  text: string;
  key?: string;
}

const widthText = (w: number) => (w > 1 ? `[${w - 1}:0] ` : "");

/** Interface source generated from the declaration. Modport lines carry key `mp-<name>`. */
export function interfaceToSource(decl: InterfaceDecl): CodeLine[] {
  const lines: CodeLine[] = [{ text: `interface ${decl.name} (input logic ${decl.clock});` }];
  for (const s of decl.signals) {
    lines.push({ text: `  ${s.kind === "net" ? "wire " : "logic"} ${widthText(s.width).padEnd(7)}${s.name};`, key: `sig-${s.name}` });
  }
  lines.push({ text: "" });
  const c = decl.clocking;
  const outs = c.items.filter((i) => i.dir === "output").map((i) => i.signal);
  const ins = c.items.filter((i) => i.dir === "input").map((i) => i.signal);
  lines.push(
    { text: `  clocking ${c.name} ${c.event};`, key: "cb" },
    { text: `    ${c.skews}`, key: "cb" },
    { text: `    output ${outs.join(", ")};`, key: "cb" },
    { text: `    input  ${ins.join(", ")};`, key: "cb" },
    { text: "  endclocking", key: "cb" },
    { text: "" },
  );
  for (const mp of decl.modports) {
    const key = `mp-${mp.name}`;
    if (mp.clocking) {
      lines.push({ text: `  modport ${mp.name} (clocking ${mp.clocking});`, key });
      continue;
    }
    const groups: Direction[] = ["input", "output", "inout"];
    const parts = groups
      .map((d) => ({ d, names: mp.ports.filter((p) => p.dir === d).map((p) => p.signal) }))
      .filter((g) => g.names.length > 0);
    lines.push({ text: `  modport ${mp.name} (`, key });
    parts.forEach((g, i) => {
      lines.push({ text: `    ${g.d.padEnd(6)} ${g.names.join(", ")}${i < parts.length - 1 ? "," : ""}`, key });
    });
    lines.push({ text: "  );", key });
  }
  lines.push({ text: "endinterface" });
  return lines;
}

export function moduleHeader(decl: InterfaceDecl, modport: ModportDecl): string {
  return `module ${modport.user} (${decl.name}.${modport.name} bus);`;
}

export type AccessOp = "read" | "drive";

export type AccessOutcome = "legal" | "compile-error";

export interface AccessVerdict {
  outcome: AccessOutcome;
  /** The SystemVerilog statement the learner tried. */
  statement: string;
  rule: string;
  clause: string;
}

export interface ViewSignal {
  signal: string;
  /** Path used inside the module: `bus.ready` or `bus.cb.ready`. */
  path: string;
  dir: Direction;
  /** Arrow direction relative to the module. */
  flow: "into-module" | "out-of-module" | "both";
}

/** Signals visible through a modport, with direction as seen from the module. */
export function viewOf(decl: InterfaceDecl, modportName: string): ViewSignal[] {
  const mp = decl.modports.find((m) => m.name === modportName);
  if (!mp) return [];
  const flowOf = (dir: Direction): ViewSignal["flow"] => (dir === "input" ? "into-module" : dir === "output" ? "out-of-module" : "both");
  if (mp.clocking) {
    return decl.clocking.items.map((i) => ({ signal: i.signal, path: `bus.${decl.clocking.name}.${i.signal}`, dir: i.dir, flow: flowOf(i.dir) }));
  }
  return mp.ports.map((p) => ({ signal: p.signal, path: `bus.${p.signal}`, dir: p.dir, flow: flowOf(p.dir) }));
}

const COMPILE_NOTE = "The compiler or elaborator rejects the design before time 0; the exact message differs by tool.";

/**
 * Checks `x = <path>;` (read) or `<path> <= value;` (drive) inside a module whose
 * interface port uses `modportName`. `path` is relative to the port, e.g.
 * "ready" or "cb.ready".
 */
export function checkAccess(decl: InterfaceDecl, modportName: string, path: string, op: AccessOp): AccessVerdict {
  const mp = decl.modports.find((m) => m.name === modportName);
  const full = `bus.${path}`;
  const statement = op === "read" ? `x = ${full};` : `${full} <= ${path.endsWith("addr") || path.endsWith("data") ? "32'h1000" : "1"};`;
  if (!mp) return { outcome: "compile-error", statement, rule: `There is no modport named ${modportName}. ${COMPILE_NOTE}`, clause: "§25.5" };

  const [head, tail] = path.split(".");
  if (mp.clocking) {
    if (head !== mp.clocking || !tail) {
      return {
        outcome: "compile-error",
        statement,
        rule: `Modport ${mp.name} lists only clocking ${mp.clocking}, so ${full} is not visible through this port. Use ${`bus.${mp.clocking}.${head}`}. ${COMPILE_NOTE}`,
        clause: "§25.5, §25.5.5",
      };
    }
    const item = decl.clocking.items.find((i) => i.signal === tail);
    if (!item) {
      return { outcome: "compile-error", statement, rule: `${tail} is not a clockvar of ${mp.clocking}. ${COMPILE_NOTE}`, clause: "§14.3" };
    }
    if (op === "read" && item.dir === "output") {
      return {
        outcome: "compile-error",
        statement,
        rule: `${tail} is an output of ${mp.clocking}: reading an output clockvar is illegal. Sample it through an input clockvar instead. ${COMPILE_NOTE}`,
        clause: "§14.3",
      };
    }
    if (op === "drive" && item.dir === "input") {
      return {
        outcome: "compile-error",
        statement,
        rule: `${tail} is an input of ${mp.clocking}: writing an input clockvar is illegal. ${COMPILE_NOTE}`,
        clause: "§14.3",
      };
    }
    return op === "read"
      ? { outcome: "legal", statement, rule: `Reads the value ${mp.clocking} sampled at its most recent clocking event (#1step: just before the edge).`, clause: "§14.13" }
      : {
          outcome: "legal",
          statement,
          rule: `A synchronous drive: the new value lands in Re-NBA at the clocking event plus the output skew. Only <= is allowed on a clockvar.`,
          clause: "§14.16",
        };
  }

  const port = mp.ports.find((p) => p.signal === head);
  if (!port || tail) {
    return {
      outcome: "compile-error",
      statement,
      rule: `${full} is not listed in modport ${mp.name}, so it is not accessible through this port. ${COMPILE_NOTE}`,
      clause: "§25.5",
    };
  }
  if (op === "read") {
    return { outcome: "legal", statement, rule: `${head} is an ${port.dir} of modport ${mp.name}; a module may read its inputs and its own outputs.`, clause: "§25.5" };
  }
  if (port.dir === "input") {
    return {
      outcome: "compile-error",
      statement,
      rule: `${head} is an input in modport ${mp.name}. Modport directions are declared as if inside the module, and assigning to a variable declared as an input port is illegal. ${COMPILE_NOTE}`,
      clause: "§25.5, §23.3.3.2",
    };
  }
  const signal = decl.signals.find((s) => s.name === head);
  if (port.dir === "inout" && signal?.kind === "variable") {
    return {
      outcome: "compile-error",
      statement,
      rule: `${head} is a variable, and variables cannot be connected to either side of an inout port. Declare it as a net or use input/output. ${COMPILE_NOTE}`,
      clause: "§6.5, §23.3.3",
    };
  }
  return { outcome: "legal", statement, rule: `${head} is an output of modport ${mp.name}, so this module may drive it.`, clause: "§25.5" };
}

/** Statements offered in the explorer for each view (path, op). The first one is the default. */
export const TRY_STATEMENTS: Record<string, { path: string; op: AccessOp }[]> = {
  master: [
    { path: "ready", op: "drive" },
    { path: "addr", op: "drive" },
    { path: "ready", op: "read" },
  ],
  slave: [
    { path: "ready", op: "drive" },
    { path: "valid", op: "drive" },
    { path: "addr", op: "read" },
  ],
  monitor: [
    { path: "valid", op: "drive" },
    { path: "data", op: "read" },
  ],
  drv: [
    { path: "cb.valid", op: "drive" },
    { path: "valid", op: "drive" },
    { path: "cb.ready", op: "drive" },
    { path: "cb.ready", op: "read" },
    { path: "cb.valid", op: "read" },
  ],
};

/** §25.9: a virtual interface is null until assigned; using it then is a fatal run-time error. */
export function dereferenceVirtualInterface(assigned: boolean): { outcome: "ok" | "fatal-runtime"; why: string; clause: string } {
  return assigned
    ? { outcome: "ok", why: "The handle points at a real interface instance, so vif.cb.valid reaches its signals.", clause: "§25.9" }
    : { outcome: "fatal-runtime", why: "The handle is still null: the code compiles, then the simulator stops with a fatal error the first time it is used.", clause: "§25.9" };
}
