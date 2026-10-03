/**
 * Deterministic educational model of uvm_config_db#(T) set/get.
 *
 * Checked against uvm-core 2020.3.1 (accellera-official/uvm-core, tag
 * 2020.3.1). Clause numbers are IEEE 1800.2-2020 numbers taken from the
 * `@uvm-ieee` tags in that source.
 *
 * set (uvm_config_db::set, Annex C.4.2.2.1; uvm_config_db_default_implementation_t::set)
 * - A null cntxt means uvm_root, whose full name is "" (uvm_component::new
 *   renames "__top__" to "") and whose depth is 0.
 * - Scope = inst_name if cntxt's full name is ""; cntxt's full name if
 *   inst_name is ""; otherwise `{cntxt.get_full_name(), ".", inst_name}`.
 * - Each (cntxt, T, scope, field) pair owns one resource; a repeated set from
 *   the same context overwrites it.
 * - Precedence: during the build phase, default_precedence (1000) minus the
 *   cntxt depth, so a higher context wins; at any other time, 1000.
 * - Every set moves its resource to the front of the queue for that field
 *   name (set_priority_name(PRI_HIGH)), so the latest set wins ties.
 *
 * get (uvm_config_db::get, C.4.2.2.2; uvm_resource_pool::lookup_name,
 * C.2.4.4.1; get_highest_precedence, C.2.4.4.2)
 * - The lookup path is built the same way from the caller's cntxt and inst_name.
 * - Candidates: resources whose field name is exactly the requested name,
 *   whose type is exactly T, and whose scope glob matches the lookup path
 *   (uvm_is_match).
 * - Winner: the first candidate in queue order with the highest precedence.
 * - No candidate: get returns 0, leaves the variable unchanged and prints
 *   nothing (unless +UVM_CONFIG_DB_TRACE is on).
 *
 * Time model: build_phase runs top-down, depth-first (children in name
 * order), so build-time calls are ordered by their caller's position in that
 * walk, then by code order. run-phase calls are ordered as listed
 * (t = 10 ns, 20 ns, …).
 *
 * Not modelled: regex (/…/) scopes, uvm_resource_db calls, wait_modified,
 * field-macro auto-configuration, and set_default_precedence.
 */

import { uvmIsMatch } from "./uvm-glob-model";

export const DEFAULT_PRECEDENCE = 1000;

export type CfgPhase = "pre_run_test" | "build" | "run";

export const PHASE_LABELS: Record<CfgPhase, string> = {
  pre_run_test: "before run_test()",
  build: "build_phase",
  run: "run_phase",
};

const PHASE_RANK: Record<CfgPhase, number> = { pre_run_test: 0, build: 1, run: 2 };

/** The top module (tb_top) is not a component; its calls pass cntxt = null. */
export const TOP_MODULE = "tb_top";

export interface CfgSetOp {
  kind: "set";
  id: string;
  /** Component whose code makes the call, or TOP_MODULE. */
  caller: string;
  /** Full name of cntxt, or null (uvm_root). Usually `this` = caller. */
  cntxt: string | null;
  instName: string;
  field: string;
  type: string;
  value: string;
  phase: CfgPhase;
}

export interface CfgGetOp {
  kind: "get";
  id: string;
  caller: string;
  cntxt: string | null;
  instName: string;
  field: string;
  type: string;
  phase: CfgPhase;
  /** Name of the variable passed to get(). */
  variable?: string;
}

export type CfgOp = CfgSetOp | CfgGetOp;

export interface CfgTree {
  /** Full paths in build (preorder) order. */
  paths: string[];
}

export const STANDARD_CFG_TREE: CfgTree = {
  paths: [
    "uvm_test_top",
    "uvm_test_top.env",
    "uvm_test_top.env.agt0",
    "uvm_test_top.env.agt0.drv",
    "uvm_test_top.env.agt0.mon",
    "uvm_test_top.env.agt1",
    "uvm_test_top.env.agt1.drv",
    "uvm_test_top.env.agt1.mon",
  ],
};

/** uvm_component::get_depth: 0 for uvm_root (""), else 1 + number of dots. */
export function depthOf(fullName: string | null): number {
  if (!fullName) return 0;
  return fullName.split(".").length;
}

/** Scope or lookup path from cntxt and inst_name, as in set() and get(). */
export function resolveScope(cntxt: string | null, instName: string): string {
  const ctx = cntxt ?? "";
  if (instName === "") return ctx;
  if (ctx === "") return instName;
  return `${ctx}.${instName}`;
}

export function precedenceFor(op: CfgSetOp): number {
  return op.phase === "build" ? DEFAULT_PRECEDENCE - depthOf(op.cntxt) : DEFAULT_PRECEDENCE;
}

export interface ScheduledOp {
  op: CfgOp;
  /** 1-based position in time order. */
  order: number;
  /** Human time label, e.g. "build: uvm_test_top" or "t = 20 ns". */
  when: string;
  /** Simulation time in ns for run-phase calls, 0 otherwise. */
  timeNs: number;
}

/** Orders the calls in simulation time. */
export function scheduleConfigOps(ops: CfgOp[], tree: CfgTree = STANDARD_CFG_TREE): ScheduledOp[] {
  const pre = (caller: string) => {
    const i = tree.paths.indexOf(caller);
    return i < 0 ? -1 : i;
  };
  const indexed = ops.map((op, i) => ({ op, i }));
  indexed.sort((a, b) => {
    const pr = PHASE_RANK[a.op.phase] - PHASE_RANK[b.op.phase];
    if (pr !== 0) return pr;
    if (a.op.phase === "build") {
      const d = pre(a.op.caller) - pre(b.op.caller);
      if (d !== 0) return d;
    }
    return a.i - b.i;
  });
  let runCount = 0;
  return indexed.map(({ op }, k) => {
    let when = "";
    let timeNs = 0;
    if (op.phase === "pre_run_test") when = "time 0, before run_test()";
    else if (op.phase === "build") when = `build_phase of ${op.caller}`;
    else {
      runCount += 1;
      timeNs = runCount * 10;
      when = `run_phase, t = ${timeNs} ns`;
    }
    return { op, order: k + 1, when, timeNs };
  });
}

export interface Resource {
  key: string;
  /** Last set() that wrote this resource. */
  setId: string;
  /** Every set() that wrote it, oldest first. */
  setIds: string[];
  cntxt: string | null;
  scope: string;
  field: string;
  type: string;
  value: string;
  precedence: number;
}

export interface Candidate {
  resource: Resource;
  /** Position in the field's queue (0 = front = most recently set). */
  queuePos: number;
  fieldMatches: boolean;
  typeMatches: boolean;
  scopeMatches: boolean;
  eligible: boolean;
  winner: boolean;
}

export interface GetResult {
  op: CfgGetOp;
  lookupPath: string;
  found: boolean;
  value: string | null;
  winner: Resource | null;
  /** Every resource that exists at the time of the get (any field), with match flags. */
  candidates: Candidate[];
  /** set() calls that happen after this get. */
  laterSetIds: string[];
}

export interface SetResult {
  op: CfgSetOp;
  scope: string;
  precedence: number;
  reused: boolean;
}

export interface ConfigRun {
  schedule: ScheduledOp[];
  sets: Record<string, SetResult>;
  gets: Record<string, GetResult>;
  trace: string[];
  /** Database state at the end, per field, front first. */
  queues: Record<string, Resource[]>;
}

interface Db {
  resources: Map<string, Resource>;
  queues: Map<string, Resource[]>;
}

function lookup(db: Db, path: string, field: string, type: string): { candidates: Candidate[]; winner: Resource | null } {
  const candidates: Candidate[] = [];
  db.queues.forEach((queue, f) => {
    queue.forEach((live, queuePos) => {
      // Snapshot: a later set() from the same context mutates the live resource.
      const resource: Resource = { ...live, setIds: [...live.setIds] };
      const fieldMatches = f === field;
      const typeMatches = resource.type === type;
      const scopeMatches = uvmIsMatch(resource.scope, path);
      candidates.push({ resource, queuePos, fieldMatches, typeMatches, scopeMatches, eligible: fieldMatches && typeMatches && scopeMatches, winner: false });
    });
  });
  // get_highest_precedence: first in queue order with the strictly highest precedence.
  let winner: Candidate | null = null;
  for (const c of candidates.filter((x) => x.eligible).sort((a, b) => a.queuePos - b.queuePos)) {
    if (!winner || c.resource.precedence > winner.resource.precedence) winner = c;
  }
  if (winner) winner.winner = true;
  return { candidates, winner: winner?.resource ?? null };
}

const show = (type: string, value: string) => `(${type}) ${value}`;

export function runConfigDb(ops: CfgOp[], tree: CfgTree = STANDARD_CFG_TREE): ConfigRun {
  const schedule = scheduleConfigOps(ops, tree);
  const db: Db = { resources: new Map(), queues: new Map() };
  const sets: Record<string, SetResult> = {};
  const gets: Record<string, GetResult> = {};
  const trace: string[] = [];

  schedule.forEach(({ op }, idx) => {
    if (op.kind === "set") {
      const scope = resolveScope(op.cntxt, op.instName);
      const key = `${op.cntxt ?? "<uvm_root>"}|${op.type}|${scope}|${op.field}`;
      const precedence = precedenceFor(op);
      let resource = db.resources.get(key);
      const reused = Boolean(resource);
      if (!resource) {
        resource = { key, setId: op.id, setIds: [], cntxt: op.cntxt, scope, field: op.field, type: op.type, value: op.value, precedence };
        db.resources.set(key, resource);
      }
      resource.setId = op.id;
      resource.setIds.push(op.id);
      resource.value = op.value;
      resource.precedence = precedence;
      const queue = (db.queues.get(op.field) ?? []).filter((r) => r !== resource);
      db.queues.set(op.field, [resource, ...queue]);
      sets[op.id] = { op, scope, precedence, reused };
      trace.push(
        `UVM_INFO [CFGDB/SET] Configuration scope='${scope}' name='${op.field}' (type ${op.type}) set accessor=${op.cntxt ?? ""} = ${show(op.type, op.value)}`,
      );
      return;
    }
    const path = resolveScope(op.cntxt, op.instName);
    const { candidates, winner } = lookup(db, path, op.field, op.type);
    const laterSetIds = schedule.slice(idx + 1).filter((s) => s.op.kind === "set").map((s) => s.op.id);
    gets[op.id] = { op, lookupPath: path, found: Boolean(winner), value: winner?.value ?? null, winner, candidates, laterSetIds };
    trace.push(
      `UVM_INFO [CFGDB/GET] Configuration scope='${path}' name='${op.field}' (type ${op.type}) read accessor=${op.cntxt ?? ""} = ${winner ? show(op.type, winner.value) : "null (failed lookup)"}`,
    );
  });

  const queues: Record<string, Resource[]> = {};
  db.queues.forEach((q, f) => {
    queues[f] = q.map((r) => ({ ...r, setIds: [...r.setIds] }));
  });
  return { schedule, sets, gets, trace, queues };
}

/**
 * What each component would read for (field, type) if it called
 * get(this, "", field, value) at the moment of `getId`.
 */
export function reachAt(ops: CfgOp[], getId: string, tree: CfgTree = STANDARD_CFG_TREE): Record<string, { found: boolean; value: string | null; setId: string | null }> {
  const target = ops.find((o) => o.id === getId);
  if (!target || target.kind !== "get") return {};
  const out: Record<string, { found: boolean; value: string | null; setId: string | null }> = {};
  for (const path of tree.paths) {
    // Same caller as the real get, so the probe sits at the same point in time.
    const probe: CfgGetOp = { ...target, id: `${getId}::probe`, cntxt: path, instName: "" };
    const idx = ops.indexOf(target);
    const probeOps = [...ops.slice(0, idx), probe, ...ops.slice(idx + 1)].filter((o) => o.kind === "set" || o.id === probe.id);
    const run = runConfigDb(probeOps, tree);
    const g = run.gets[probe.id];
    out[path] = { found: g.found, value: g.value, setId: g.winner?.setId ?? null };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

function setLabel(ops: CfgOp[], setId: string): string {
  const sets = ops.filter((o) => o.kind === "set");
  const i = sets.findIndex((o) => o.id === setId);
  const op = sets[i];
  if (!op || op.kind !== "set") return setId;
  return `set #${i + 1} (from ${op.cntxt === null ? "the top module, cntxt = null" : op.caller})`;
}

function precedenceWhy(r: Resource, ops: CfgOp[]): string {
  const op = ops.find((o) => o.id === r.setId);
  if (!op || op.kind !== "set") return `${r.precedence}`;
  return op.phase === "build"
    ? `${r.precedence} (set during build from depth ${depthOf(op.cntxt)}: 1000 − ${depthOf(op.cntxt)})`
    : `${r.precedence} (set outside build: default 1000)`;
}

/** One-paragraph "why" for a get() result. */
export function explainGet(ops: CfgOp[], run: ConfigRun, getId: string): string {
  const g = run.gets[getId];
  if (!g) return "";
  const eligible = g.candidates.filter((c) => c.eligible).sort((a, b) => a.queuePos - b.queuePos);
  if (g.found && g.winner) {
    if (eligible.length === 1) {
      return `Only ${setLabel(ops, g.winner.setId)} matches field '${g.op.field}', type ${g.op.type} and path "${g.lookupPath}", so get returns 1 with ${g.winner.value}.`;
    }
    const losers = eligible.filter((c) => !c.winner);
    const samePrec = losers.filter((c) => c.resource.precedence === g.winner?.precedence);
    const parts = [`${eligible.length} sets match "${g.lookupPath}". ${setLabel(ops, g.winner.setId)} has precedence ${precedenceWhy(g.winner, ops)}`];
    if (samePrec.length > 0) {
      parts.push(`and ties with ${samePrec.map((c) => setLabel(ops, c.resource.setId)).join(", ")}; on a tie the most recent set() wins`);
    } else {
      parts.push(`which beats ${losers.map((c) => `${setLabel(ops, c.resource.setId)} at ${c.resource.precedence}`).join(", ")}`);
    }
    return `${parts.join(" ")}. Path specificity is not a factor.`;
  }
  const typeMiss = g.candidates.find((c) => c.fieldMatches && c.scopeMatches && !c.typeMatches);
  if (typeMiss) {
    return `get returns 0 and prints nothing. ${setLabel(ops, typeMiss.resource.setId)} has the right field and scope, but its type is ${typeMiss.resource.type}; this get asks for ${g.op.type}. uvm_config_db#(T) only finds entries of exactly type T.`;
  }
  const fieldMiss = g.candidates.find((c) => !c.fieldMatches && c.typeMatches && c.scopeMatches);
  if (fieldMiss) {
    return `get returns 0 and prints nothing. No set uses field '${g.op.field}'; ${setLabel(ops, fieldMiss.resource.setId)} uses '${fieldMiss.resource.field}'. Field names must match exactly.`;
  }
  const scopeMiss = g.candidates.find((c) => c.fieldMatches && c.typeMatches && !c.scopeMatches);
  if (scopeMiss) {
    return `get returns 0. ${setLabel(ops, scopeMiss.resource.setId)} is scoped to "${scopeMiss.resource.scope}", which does not match "${g.lookupPath}".`;
  }
  const later = g.laterSetIds.map((id) => ops.find((o) => o.id === id)).find((o) => o && o.kind === "set" && o.field === g.op.field);
  if (later) {
    return `get returns 0: ${setLabel(ops, later.id)} has not happened yet. It runs later, and the database does not push new values to components that already read.`;
  }
  return `get returns 0: nothing was set for field '${g.op.field}'.`;
}

export const NO_VALUE = "__no_value__";

/** Candidate answers for "what does this get() return?". */
export function getCandidates(ops: CfgOp[], run: ConfigRun, getId: string): string[] {
  const g = run.gets[getId];
  if (!g) return [];
  const values: string[] = [];
  for (const op of ops) {
    if (op.kind === "set" && (op.field === g.op.field || op.type === g.op.type) && !values.includes(op.value)) values.push(op.value);
  }
  values.push(NO_VALUE);
  return values;
}

/** Diagnostic feedback for predicting `value` (or NO_VALUE). */
export function diagnoseGetCandidate(ops: CfgOp[], run: ConfigRun, getId: string, value: string): string {
  const g = run.gets[getId];
  if (!g) return "";
  const actual = g.found ? g.value : NO_VALUE;
  if (value === actual) return explainGet(ops, run, getId);
  if (value === NO_VALUE) {
    return `get finds a match, so it returns 1. ${explainGet(ops, run, getId)}`;
  }
  const setsWithValue = ops.filter((o): o is CfgSetOp => o.kind === "set" && o.value === value);
  for (const s of setsWithValue) {
    if (g.laterSetIds.includes(s.id)) {
      return `${setLabel(ops, s.id)} runs after this get (${PHASE_LABELS[s.phase]}). config_db is not reactive: the component already read its value.`;
    }
    const c = g.candidates.find((x) => x.resource.setIds.includes(s.id));
    if (!c) continue;
    if (c.resource.setId !== s.id) {
      return `${setLabel(ops, s.id)} was overwritten by a later set() from the same context with the same scope and field.`;
    }
    if (!c.fieldMatches) return `${setLabel(ops, s.id)} sets field '${c.resource.field}', but get asks for '${g.op.field}'. Field names must match exactly.`;
    if (!c.typeMatches) {
      return `${setLabel(ops, s.id)} stores a ${c.resource.type}, but get asks for ${g.op.type}. Different type parameters are different databases, so get cannot see it.`;
    }
    if (!c.scopeMatches) return `${setLabel(ops, s.id)} is scoped to "${c.resource.scope}", which does not match "${g.lookupPath}".`;
    if (!c.winner && g.winner) {
      if (c.resource.precedence < g.winner.precedence) {
        const op = ops.find((o) => o.id === s.id) as CfgSetOp;
        const later = run.schedule.findIndex((x) => x.op.id === s.id) > run.schedule.findIndex((x) => x.op.id === g.winner?.setId);
        const wild = /[*?+]/;
        const moreSpecific = !wild.test(c.resource.scope) && wild.test(g.winner.scope);
        return `${setLabel(ops, s.id)} matches, but its precedence is ${precedenceWhy(c.resource, ops)} against ${precedenceWhy(g.winner, ops)}.${
          op.phase === "build" && later ? " It ran later, but during build the higher context wins, not the later call." : ""
        }${moreSpecific ? " Its more specific path does not help: specificity is not part of the rule." : ""}`;
      }
      return `${setLabel(ops, s.id)} matches with the same precedence, but ${setLabel(ops, g.winner.setId)} was set more recently, and the most recent set wins ties.`;
    }
  }
  return `No set() delivers ${value} to "${g.lookupPath}". ${explainGet(ops, run, getId)}`;
}

// ---------------------------------------------------------------------------
// Source generation
// ---------------------------------------------------------------------------

export interface CfgSourceLine {
  text: string;
  key?: string;
}

const CLASS_OF: Record<string, string> = {
  uvm_test_top: "my_test",
  "uvm_test_top.env": "my_env",
  "uvm_test_top.env.agt0": "my_agent",
  "uvm_test_top.env.agt1": "my_agent",
  "uvm_test_top.env.agt0.drv": "my_driver",
  "uvm_test_top.env.agt1.drv": "my_driver",
  "uvm_test_top.env.agt0.mon": "my_monitor",
  "uvm_test_top.env.agt1.mon": "my_monitor",
};

export function classOf(path: string): string {
  return CLASS_OF[path] ?? "my_component";
}

export function shortName(path: string | null): string {
  if (path === null) return "null";
  return path.split(".").slice(-1)[0];
}

function cntxtArg(op: CfgOp): string {
  if (op.cntxt === null) return "null";
  return op.cntxt === op.caller ? "this" : op.cntxt;
}

export function opToSource(op: CfgOp): string {
  if (op.kind === "set") return `uvm_config_db#(${op.type})::set(${cntxtArg(op)}, "${op.instName}", "${op.field}", ${op.value});`;
  return `if (!uvm_config_db#(${op.type})::get(${cntxtArg(op)}, "${op.instName}", "${op.field}", ${op.variable ?? op.field}))`;
}

/** Calls grouped by where they live, in time order. */
export function configSource(ops: CfgOp[], tree: CfgTree = STANDARD_CFG_TREE): CfgSourceLine[] {
  const schedule = scheduleConfigOps(ops, tree);
  const lines: CfgSourceLine[] = [];
  let lastHeader = "";
  const lastRunTime: Record<string, number> = {};
  for (const { op, timeNs } of schedule) {
    const header =
      op.caller === TOP_MODULE
        ? "// module tb_top: initial begin … run_test(); end"
        : `// ${classOf(op.caller)}::${op.phase === "run" ? "run_phase" : "build_phase"}   (this = ${op.caller})`;
    if (header !== lastHeader) {
      lines.push({ text: header });
      lastHeader = header;
    }
    if (op.phase === "run") {
      const prev = lastRunTime[op.caller] ?? 0;
      lines.push({ text: `#${timeNs - prev};`, key: `${op.id}-delay` });
      lastRunTime[op.caller] = timeNs;
    }
    lines.push({ text: opToSource(op), key: op.id });
    if (op.kind === "get") lines.push({ text: `  \`uvm_warning("NOCFG", "${op.field} not found")`, key: `${op.id}-warn` });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface ConfigPreset {
  id: string;
  label: string;
  summary: string;
  ops: CfgOp[];
  getId: string;
}

const setOp = (id: string, caller: string, instName: string, field: string, type: string, value: string, phase: CfgPhase = "build"): CfgSetOp => ({
  kind: "set",
  id,
  caller,
  cntxt: caller === TOP_MODULE ? null : caller,
  instName,
  field,
  type,
  value,
  phase,
});

const getOp = (id: string, caller: string, field: string, type: string, phase: CfgPhase = "build", variable?: string): CfgGetOp => ({
  kind: "get",
  id,
  caller,
  cntxt: caller,
  instName: "",
  field,
  type,
  phase,
  variable,
});

const TEST = "uvm_test_top";
const ENV = "uvm_test_top.env";
const AGT0 = "uvm_test_top.env.agt0";
const DRV0 = "uvm_test_top.env.agt0.drv";

export const CONFIG_PRESETS: ConfigPreset[] = [
  {
    id: "build-hierarchy",
    label: "Test vs env (build)",
    summary: "The test and the env both configure agt0 during build. The env's set() runs later.",
    ops: [setOp("s1", TEST, "env.agt0", "num_pkts", "int", "10"), setOp("s2", ENV, "agt0", "num_pkts", "int", "20"), getOp("g", AGT0, "num_pkts", "int")],
    getId: "g",
  },
  {
    id: "specificity",
    label: "Wildcard vs exact path",
    summary: "The test uses a broad wildcard; the env names agt0 exactly. Does the more specific path win?",
    ops: [setOp("s1", TEST, "*", "num_pkts", "int", "5"), setOp("s2", ENV, "agt0", "num_pkts", "int", "20"), getOp("g", AGT0, "num_pkts", "int")],
    getId: "g",
  },
  {
    id: "top-vs-test",
    label: "Top module vs test",
    summary: "tb_top sets a value before run_test(); the test sets another one in build_phase.",
    ops: [
      setOp("s1", TOP_MODULE, "uvm_test_top.env.agt0", "num_pkts", "int", "1", "pre_run_test"),
      setOp("s2", TEST, "env.agt0", "num_pkts", "int", "99"),
      getOp("g", AGT0, "num_pkts", "int"),
    ],
    getId: "g",
  },
  {
    id: "after-build",
    label: "After build: last wins",
    summary: "During run_phase the test and the env both change num_pkts, then agt0 reads it again.",
    ops: [
      setOp("s1", TEST, "env.agt0", "num_pkts", "int", "40", "run"),
      setOp("s2", ENV, "agt0", "num_pkts", "int", "30", "run"),
      getOp("g", AGT0, "num_pkts", "int", "run"),
    ],
    getId: "g",
  },
  {
    id: "late-set",
    label: "Set after get",
    summary: "The test changes num_pkts in run_phase. agt0 read it in build_phase.",
    ops: [setOp("s1", TEST, "env.agt0", "num_pkts", "int", "10"), setOp("s2", TEST, "env.agt0", "num_pkts", "int", "50", "run"), getOp("g", AGT0, "num_pkts", "int")],
    getId: "g",
  },
  {
    id: "type-mismatch",
    label: "Debug: type mismatch",
    summary: "tb_top publishes the interface; the driver asks for the modport view. No error appears, but vif stays null.",
    ops: [
      setOp("s1", TOP_MODULE, "uvm_test_top.env.agt0.drv", "vif", "virtual apb_if", "apb_vif", "pre_run_test"),
      getOp("g", DRV0, "vif", "virtual apb_if.drv_mp", "build", "vif"),
    ],
    getId: "g",
  },
  {
    id: "field-typo",
    label: "Debug: field typo",
    summary: "The driver's get() spells the field differently from tb_top's set().",
    ops: [
      setOp("s1", TOP_MODULE, "uvm_test_top.env.agt0.drv", "vif", "virtual apb_if", "apb_vif", "pre_run_test"),
      getOp("g", DRV0, "viif", "virtual apb_if", "build", "vif"),
    ],
    getId: "g",
  },
  {
    id: "wildcard-reach",
    label: "How far does * reach?",
    summary: "The test makes the agents passive with the scope env.agt*. Can a driver inside an agent read is_active too?",
    ops: [setOp("s1", TEST, "env.agt*", "is_active", "uvm_active_passive_enum", "UVM_PASSIVE"), getOp("g", DRV0, "is_active", "uvm_active_passive_enum")],
    getId: "g",
  },
];

export const CONFIG_TYPES = ["int", "bit [31:0]", "uvm_active_passive_enum", "virtual apb_if", "virtual apb_if.drv_mp", "apb_config"];
