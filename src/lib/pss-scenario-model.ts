/**
 * A small model of how a Portable Stimulus (Accellera PSS 2.x) tool turns a
 * partial scenario into a concrete one, and how one resolved scenario is
 * realised on two targets through `exec body` target templates.
 *
 * Rules modelled (Accellera Portable Test and Stimulus Standard; section
 * numbers not verified here):
 * - Buffer flow objects: a consumer's buffer input must be bound to an output
 *   of an action that completes before the consumer starts.
 * - Inference: when the activity contains no producer for a required input,
 *   the tool adds (infers) a producer action to complete the scenario.
 * - Resource pools: `lock` claims exclusive use of one resource instance from
 *   the bound pool. Actions in a `parallel` block run concurrently, so each
 *   needs its own instance; if the pool is too small the scenario has no
 *   legal solution and the tool reports it at solve time.
 * - `exec body <lang> = """..."""` target templates: `{{expr}}` is replaced by
 *   the solved value; the tool emits the bodies in schedule order.
 *
 * Choices a real tool makes freely (which legal producer to infer, which
 * binding, the random values) are fixed here: shortest producer chain, most
 * recent unconsumed output, a seeded generator.
 */

export type ActionName = "write_a" | "read_check_a" | "dma_copy_a";
export type TargetLang = "C" | "SV";

export interface BufferValue {
  addr: number;
  data: number;
}

interface FlowField {
  dir: "input" | "output";
  name: string;
}

interface ActionDecl {
  name: ActionName;
  fields: FlowField[];
  lock?: string;
  constraints: string[];
  exec: Record<TargetLang, string[]>;
}

export const BUFFER_TYPE = "mem_buf_s";
export const RESOURCE_TYPE = "dma_chan_r";
export const ADDR_LO = 0x1000;
export const ADDR_HI = 0x1ffc;

export const ACTIONS: Record<ActionName, ActionDecl> = {
  write_a: {
    name: "write_a",
    fields: [{ dir: "output", name: "out_buf" }],
    constraints: [],
    exec: {
      C: ["mem_write32({{out_buf.addr}}, {{out_buf.data}});"],
      SV: [
        'mem_wr_seq s = mem_wr_seq::type_id::create("s");',
        "s.addr = {{out_buf.addr}}; s.data = {{out_buf.data}};",
        "s.start(m_sequencer);",
      ],
    },
  },
  read_check_a: {
    name: "read_check_a",
    fields: [{ dir: "input", name: "in_buf" }],
    constraints: [],
    exec: {
      C: ["if (mem_read32({{in_buf.addr}}) != {{in_buf.data}}) test_fail();"],
      SV: [
        'mem_rd_seq s = mem_rd_seq::type_id::create("s");',
        "s.addr = {{in_buf.addr}};",
        "s.start(m_sequencer);  // read data is checked by the scoreboard",
      ],
    },
  },
  dma_copy_a: {
    name: "dma_copy_a",
    fields: [
      { dir: "input", name: "src" },
      { dir: "output", name: "dst" },
    ],
    lock: "chan",
    constraints: ["dst.data == src.data;", "dst.addr != src.addr;"],
    exec: {
      C: ["dma_copy({{chan.instance_id}}, {{src.addr}}, {{dst.addr}});"],
      SV: [
        'dma_seq s = dma_seq::type_id::create("s");',
        "s.chan = {{chan.instance_id}}; s.src = {{src.addr}}; s.dst = {{dst.addr}};",
        "s.start(m_sequencer);",
      ],
    },
  },
};

/** Declaration order is the order the model tries producers in. */
const PRODUCERS: ActionName[] = ["write_a", "dma_copy_a"];

export type ActivityStmt = { kind: "do"; action: ActionName } | { kind: "parallel"; actions: ActionName[] };

export type PssScenarioId = "raw" | "infer" | "dma_two" | "dma_one";

export interface PssScenario {
  id: PssScenarioId;
  title: string;
  topAction: string;
  activity: ActivityStmt[];
  chanPoolSize: number;
}

export const PSS_SCENARIOS: Record<PssScenarioId, PssScenario> = {
  raw: {
    id: "raw",
    title: "Write, then read back",
    topAction: "raw_test_a",
    activity: [
      { kind: "do", action: "write_a" },
      { kind: "do", action: "read_check_a" },
    ],
    chanPoolSize: 2,
  },
  infer: {
    id: "infer",
    title: "Read only",
    topAction: "read_only_test_a",
    activity: [{ kind: "do", action: "read_check_a" }],
    chanPoolSize: 2,
  },
  dma_two: {
    id: "dma_two",
    title: "Two DMA copies in parallel, pool [2]",
    topAction: "dma_par_test_a",
    activity: [{ kind: "parallel", actions: ["dma_copy_a", "dma_copy_a"] }],
    chanPoolSize: 2,
  },
  dma_one: {
    id: "dma_one",
    title: "Two DMA copies in parallel, pool [1]",
    topAction: "dma_par_test_a",
    activity: [{ kind: "parallel", actions: ["dma_copy_a", "dma_copy_a"] }],
    chanPoolSize: 1,
  },
};

export interface ActionInstance {
  id: string;
  action: ActionName;
  inferred: boolean;
  slot: number;
  /** Buffer input field → producing instance id. */
  boundFrom: Record<string, string>;
  /** Solved buffer values by field name (inputs and outputs). */
  values: Record<string, BufferValue>;
  /** dma_chan_r instance_id when the action locks a channel. */
  chan?: number;
  why: string;
}

export type PssOutcome = "as_written" | "inferred" | "infeasible";

export interface PssResolution {
  scenario: PssScenario;
  feasible: boolean;
  outcome: PssOutcome;
  /** Each slot runs after the previous one; instances inside a slot run in parallel. */
  slots: ActionInstance[][];
  instances: ActionInstance[];
  error?: string;
  notes: string[];
}

function lcg(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x >>> 8;
  };
}

/** Resolves the activity into a schedule: binds buffers, infers producers, assigns resources. */
export function resolveScenario(scenario: PssScenario, seed = 2023): PssResolution {
  const rand = lcg(seed);
  const randAddr = () => ADDR_LO + 4 * (rand() % ((ADDR_HI - ADDR_LO) / 4 + 1));
  const slots: ActionInstance[][] = [];
  const instances: ActionInstance[] = [];
  const available: { from: string; value: BufferValue }[] = [];
  const notes: string[] = [];
  let inferredAny = false;

  const make = (action: ActionName, inferred: boolean, why: string): ActionInstance => {
    const inst: ActionInstance = { id: `${action}#${instances.length + 1}`, action, inferred, slot: -1, boundFrom: {}, values: {}, why };
    instances.push(inst);
    return inst;
  };

  /** Binds every buffer input of `inst`, inferring producers into earlier slots when needed. */
  const bindInputs = (inst: ActionInstance) => {
    for (const field of ACTIONS[inst.action].fields.filter((f) => f.dir === "input")) {
      let source = available.pop();
      if (!source) {
        const producer = PRODUCERS.find((p) => ACTIONS[p].fields.every((f) => f.dir === "output"));
        const alt = PRODUCERS.filter((p) => p !== producer);
        const inferred = make(
          producer as ActionName,
          true,
          `Inferred: nothing earlier in the activity produces the ${BUFFER_TYPE} that ${inst.id}.${field.name} needs, so the tool adds a producer that completes first. (${alt.join(", ")} could also produce one; a tool may pick any legal producer.)`,
        );
        inferredAny = true;
        produceOutputs(inferred);
        place([inferred]);
        source = available.pop() as { from: string; value: BufferValue };
      } else {
        inst.why += ` ${inst.id}.${field.name} binds to ${source.from}: a buffer must be written by an action that completes before its consumer starts.`;
      }
      inst.boundFrom[field.name] = source.from;
      inst.values[field.name] = source.value;
    }
  };

  const produceOutputs = (inst: ActionInstance) => {
    for (const field of ACTIONS[inst.action].fields.filter((f) => f.dir === "output")) {
      let value: BufferValue = { addr: randAddr(), data: ((rand() << 8) ^ rand()) >>> 0 };
      if (inst.action === "dma_copy_a") {
        const src = inst.values.src;
        let addr = randAddr();
        while (addr === src.addr) addr = randAddr();
        value = { addr, data: src.data };
      }
      inst.values[field.name] = value;
      available.push({ from: `${inst.id}.${field.name}`, value });
    }
  };

  const place = (group: ActionInstance[]) => {
    const slot = slots.length;
    group.forEach((g) => (g.slot = slot));
    slots.push(group);
  };

  let error: string | undefined;
  for (const stmt of scenario.activity) {
    const names = stmt.kind === "do" ? [stmt.action] : stmt.actions;
    const group = names.map((a) => make(a, false, stmt.kind === "parallel" ? "Traversed inside parallel { }." : "Traversed by the activity."));
    for (const inst of group) bindInputs(inst);
    const lockers = group.filter((g) => ACTIONS[g.action].lock);
    if (lockers.length > scenario.chanPoolSize) {
      error = `No legal schedule: ${lockers.length} actions in parallel { } each lock a ${RESOURCE_TYPE}, but chan_p holds only ${scenario.chanPoolSize} instance${scenario.chanPoolSize === 1 ? "" : "s"}. The tool reports this at solve time, before any test runs.`;
      break;
    }
    lockers.forEach((g, i) => {
      g.chan = i;
      g.why += ` Locks ${RESOURCE_TYPE} instance_id ${i} from chan_p (pool of ${scenario.chanPoolSize})${lockers.length > 1 ? "; parallel actions cannot share a locked instance" : ""}.`;
    });
    for (const inst of group) produceOutputs(inst);
    place(group);
  }

  if (error) {
    notes.push(error);
    return { scenario, feasible: false, outcome: "infeasible", slots: [], instances: [], error, notes };
  }
  renumberInScheduleOrder(slots, instances);
  if (inferredAny) notes.push(`The tool inferred ${instances.filter((i) => i.inferred).length} producer action(s) the activity never mentioned.`);
  else notes.push("Every buffer input is satisfied by an action the activity already traverses, so nothing is inferred.");
  return { scenario, feasible: true, outcome: inferredAny ? "inferred" : "as_written", slots, instances: slots.flat(), notes };
}

/** Ids are created in discovery order; renumber them so #1, #2, … follow the schedule. */
function renumberInScheduleOrder(slots: ActionInstance[][], instances: ActionInstance[]) {
  const map = new Map<string, string>();
  slots.flat().forEach((inst, i) => map.set(inst.id, `${inst.action}#${i + 1}`));
  const rename = (text: string) => text.replace(/\b(write_a|read_check_a|dma_copy_a)#\d+/g, (m) => map.get(m) ?? m);
  for (const inst of instances) {
    inst.why = rename(inst.why);
    for (const k of Object.keys(inst.boundFrom)) inst.boundFrom[k] = rename(inst.boundFrom[k]);
  }
  for (const inst of instances) inst.id = map.get(inst.id) ?? inst.id;
}

// ── Source and target text, generated from the same declarations ───────────

export interface SourceLine {
  key?: string;
  text: string;
}

function actionSource(decl: ActionDecl): SourceLine[] {
  const key = decl.name;
  const lines: SourceLine[] = [{ key, text: `  action ${decl.name} {` }];
  for (const f of decl.fields) lines.push({ key, text: `    ${f.dir.padEnd(6, " ")} ${BUFFER_TYPE} ${f.name};` });
  if (decl.lock) lines.push({ key, text: `    lock   ${RESOURCE_TYPE} ${decl.lock};` });
  if (decl.constraints.length) lines.push({ key, text: `    constraint { ${decl.constraints.join(" ")} }` });
  for (const lang of ["C", "SV"] as TargetLang[]) {
    const body = decl.exec[lang];
    if (body.length === 1) {
      lines.push({ key: `${key}:${lang}`, text: `    exec body ${lang.padEnd(2, " ")} = """ ${body[0]} """;` });
    } else {
      lines.push({ key: `${key}:${lang}`, text: `    exec body ${lang.padEnd(2, " ")} = """` });
      for (const b of body) lines.push({ key: `${key}:${lang}`, text: `      ${b}` });
      lines.push({ key: `${key}:${lang}`, text: '    """;' });
    }
  }
  lines.push({ key, text: "  }" });
  return lines;
}

export function pssSourceLines(scenario: PssScenario): SourceLine[] {
  const activity: SourceLine[] = [];
  for (const stmt of scenario.activity) {
    if (stmt.kind === "do") activity.push({ key: "activity", text: `      do mem_subsys_c::${stmt.action};` });
    else {
      activity.push({ key: "activity", text: "      parallel {" });
      for (const a of stmt.actions) activity.push({ key: "activity", text: `        do mem_subsys_c::${a};` });
      activity.push({ key: "activity", text: "      }" });
    }
  }
  return [
    { key: "buffer", text: `buffer ${BUFFER_TYPE} {` },
    { key: "buffer", text: "  rand bit[31:0] addr;" },
    { key: "buffer", text: "  rand bit[31:0] data;" },
    { key: "buffer", text: `  constraint { addr in [0x${ADDR_LO.toString(16).toUpperCase()}..0x${ADDR_HI.toString(16).toUpperCase()}]; addr % 4 == 0; }` },
    { key: "buffer", text: "}" },
    { key: "resource", text: `resource ${RESOURCE_TYPE} { }` },
    { text: "" },
    { text: "component mem_subsys_c {" },
    { key: "pool", text: `  pool ${BUFFER_TYPE} buf_p;` },
    { key: "pool", text: `  pool [${scenario.chanPoolSize}] ${RESOURCE_TYPE} chan_p;` },
    { key: "pool", text: "  bind buf_p *;" },
    { key: "pool", text: "  bind chan_p *;" },
    ...actionSource(ACTIONS.write_a),
    ...actionSource(ACTIONS.read_check_a),
    ...actionSource(ACTIONS.dma_copy_a),
    { text: "}" },
    { text: "" },
    { text: "component pss_top {" },
    { text: "  mem_subsys_c mem;" },
    { key: "activity", text: `  action ${scenario.topAction} {` },
    { key: "activity", text: "    activity {" },
    ...activity,
    { key: "activity", text: "    }" },
    { key: "activity", text: "  }" },
    { text: "}" },
  ];
}

const fmt = (lang: TargetLang, v: number) => {
  const h = (v >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return lang === "C" ? `0x${h}` : `32'h${h.slice(0, 4)}_${h.slice(4)}`;
};

/** Expands one instance's exec template: `{{field.member}}` → solved value. */
export function expandExec(inst: ActionInstance, lang: TargetLang): string[] {
  return ACTIONS[inst.action].exec[lang].map((line) =>
    line.replace(/\{\{\s*([a-z_]+)\.([a-z_]+)\s*\}\}/g, (_, field: string, member: string) => {
      if (member === "instance_id") return String(inst.chan ?? 0);
      const v = inst.values[field];
      if (!v) return "/* unbound */";
      return fmt(lang, member === "addr" ? v.addr : v.data);
    }),
  );
}

const label = (inst: ActionInstance) => `${inst.id}${inst.inferred ? " (inferred)" : ""}`;

/** Illustrative target code: exec bodies in schedule order. Real tools add their own runtime glue. */
export function generateTarget(res: PssResolution, lang: TargetLang): string[] {
  if (!res.feasible) return [lang === "C" ? "/* nothing generated: the scenario has no legal solution */" : "// nothing generated: the scenario has no legal solution"];
  if (lang === "C") {
    const out = ["/* exec body C templates, expanded in schedule order */", "void test_main(void) {"];
    for (const slot of res.slots) {
      if (slot.length > 1) {
        out.push(`  /* parallel: ${slot.map((s) => s.id).join(" and ")}. A tool maps the branches to separate cores or threads;`);
        out.push("     shown one after the other here. */");
      }
      for (const inst of slot) {
        out.push(`  /* ${label(inst)} */`);
        for (const l of expandExec(inst, "C")) out.push(`  ${l}`);
      }
    }
    out.push("}");
    return out;
  }
  const out = ["// exec body SV templates, expanded in schedule order", "task body();"];
  const block = (inst: ActionInstance, indent: string) => {
    out.push(`${indent}begin : ${inst.id.replace("#", "_")}${inst.inferred ? "  // inferred" : ""}`);
    for (const l of expandExec(inst, "SV")) out.push(`${indent}  ${l}`);
    out.push(`${indent}end`);
  };
  for (const slot of res.slots) {
    if (slot.length > 1) {
      out.push("  fork");
      for (const inst of slot) block(inst, "    ");
      out.push("  join");
    } else block(slot[0], "  ");
  }
  out.push("endtask");
  return out;
}

/** The check that the C target performs inline lives in the UVM scoreboard instead. */
export const SCOREBOARD_LINES = [
  "// mem_scoreboard: already in the UVM env, not generated from PSS",
  "function void write(mem_item t);",
  "  if (t.is_write) ref_mem[t.addr] = t.data;",
  "  else if (ref_mem.exists(t.addr) && t.data !== ref_mem[t.addr])",
  '    `uvm_error("SCB", $sformatf("addr %0h: read %0h, expected %0h",',
  "                                t.addr, t.data, ref_mem[t.addr]))",
  "endfunction",
];
