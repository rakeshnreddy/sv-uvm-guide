/**
 * Deterministic educational model of the UVM factory (uvm_default_factory).
 *
 * Every rule below was checked against the uvm-core 2020.3.1 reference
 * implementation (accellera-official/uvm-core, tag 2020.3.1). Clause numbers
 * are IEEE 1800.2-2020 numbers taken from the `@uvm-ieee` tags in that source.
 *
 * - set_inst_override_by_type (§8.3.1.4.1) appends to the instance-override
 *   queue (`m_inst_overrides.push_back`). An identical override (same path,
 *   same types) is ignored with DUPOVRD.
 * - set_type_override_by_type (§8.3.1.4.2) keeps one entry per original type:
 *   with replace=1 (the default) an existing entry is replaced in place
 *   (TPREGR); with replace=0 the existing entry stays (TPREGD). New entries go
 *   to the front (`push_front`). Identical original and override types only
 *   warn (TYPDUP) and are still recorded.
 * - find_override_by_type (§8.3.1.7.1): instance overrides are checked first,
 *   in registration order, and the first match wins. Only if none matches are
 *   type overrides checked. If the chosen override produces a different type,
 *   the lookup runs again for that type at the same path (chaining A→B, B→C ⇒ C).
 * - Instance paths are matched with `uvm_is_match` only when they contain `*`
 *   or `?`; otherwise they must be equal (see uvm-glob-model.ts).
 * - `type_id::create` (uvm_registry_common::create, §8.2.3.2.4 / §8.2.4.2.4)
 *   builds the context from `parent.get_full_name()`, asks the factory, then
 *   `$cast`s the result to the requested type. A failed cast is UVM_FATAL
 *   FCTTYP.
 * - A class without a registration macro has no proxy of its own:
 *   `C::get_type()` resolves to the nearest registered ancestor's proxy.
 * - Overrides only affect create() calls made after they are registered.
 *
 * Not modelled: *_by_name overrides and aliases, regex (/…/) paths, abstract
 * registries, and the behaviour of cyclic override chains (the model stops at
 * the first repeated type).
 */

import { factoryPathHasWildcard, factoryPathMatches } from "./uvm-glob-model";

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export type FactoryKind = "component" | "object";

export interface FactoryClass {
  name: string;
  kind: FactoryKind;
  extends: string | null;
  /** Has `uvm_component_utils / `uvm_object_utils (its own factory proxy). */
  registered: boolean;
  /** UVM library base class: not offered in pickers, not printed as user code. */
  library?: boolean;
}

export type ClassTable = FactoryClass[];

export const FACTORY_CLASSES: ClassTable = [
  { name: "uvm_test", kind: "component", extends: null, registered: true, library: true },
  { name: "uvm_env", kind: "component", extends: null, registered: true, library: true },
  { name: "uvm_agent", kind: "component", extends: null, registered: true, library: true },
  { name: "uvm_driver", kind: "component", extends: null, registered: true, library: true },
  { name: "uvm_monitor", kind: "component", extends: null, registered: true, library: true },
  { name: "uvm_sequence_item", kind: "object", extends: null, registered: true, library: true },
  { name: "my_test", kind: "component", extends: "uvm_test", registered: true },
  { name: "my_env", kind: "component", extends: "uvm_env", registered: true },
  { name: "dbg_env", kind: "component", extends: "my_env", registered: true },
  { name: "my_agent", kind: "component", extends: "uvm_agent", registered: true },
  { name: "base_driver", kind: "component", extends: "uvm_driver", registered: true },
  { name: "mock_driver", kind: "component", extends: "base_driver", registered: true },
  { name: "err_driver", kind: "component", extends: "mock_driver", registered: true },
  { name: "quiet_driver", kind: "component", extends: "base_driver", registered: false },
  { name: "my_monitor", kind: "component", extends: "uvm_monitor", registered: true },
  { name: "cov_monitor", kind: "component", extends: "my_monitor", registered: true },
  { name: "my_txn", kind: "object", extends: "uvm_sequence_item", registered: true },
  { name: "err_txn", kind: "object", extends: "my_txn", registered: true },
];

export function findClass(table: ClassTable, name: string): FactoryClass | undefined {
  return table.find((c) => c.name === name);
}

/** [name, parent, grandparent, …] */
export function ancestry(table: ClassTable, name: string): string[] {
  const chain: string[] = [];
  let current: string | null = name;
  while (current && !chain.includes(current)) {
    chain.push(current);
    current = findClass(table, current)?.extends ?? null;
  }
  return chain;
}

export function isSubclassOf(table: ClassTable, child: string, ancestor: string): boolean {
  return ancestry(table, child).includes(ancestor);
}

/**
 * What `C::get_type()` / `C::type_id` refers to: C's own proxy if C is
 * registered, otherwise the nearest registered ancestor's (static members are
 * inherited). null means no proxy exists, so the code does not compile.
 */
export function proxyOf(table: ClassTable, name: string): string | null {
  return ancestry(table, name).find((c) => findClass(table, c)?.registered) ?? null;
}

// ---------------------------------------------------------------------------
// Override calls and factory state
// ---------------------------------------------------------------------------

export interface TypeOverrideCall {
  id: string;
  kind: "type";
  original: string;
  override: string;
  /** Second argument of set_type_override; UVM default is 1. */
  replace: boolean;
}

export interface InstOverrideCall {
  id: string;
  kind: "inst";
  original: string;
  override: string;
  /** The string passed as inst_path. */
  pathArg: string;
  /** Full name of the `parent` argument (`this`), or null when no parent is passed. */
  parentPath: string | null;
}

export type OverrideCall = TypeOverrideCall | InstOverrideCall;

/** `{parent.get_full_name(), ".", inst_path}` when a parent is given (uvm_registry_common::set_inst_override). */
export function fullInstPath(call: InstOverrideCall): string {
  if (call.parentPath === null) return call.pathArg;
  return call.pathArg === "" ? call.parentPath : `${call.parentPath}.${call.pathArg}`;
}

export interface FactoryEntry {
  /** The call that created or last replaced this entry. */
  callId: string;
  kind: "type" | "inst";
  /** Proxy (type handle) names, after get_type() resolution. */
  original: string;
  override: string;
  fullPath?: string;
  replace: boolean;
}

export interface FactoryState {
  /** Registration order (push_back). */
  inst: FactoryEntry[];
  /** Index 0 is the front (push_front), as in m_type_overrides. */
  type: FactoryEntry[];
}

export type Severity = "INFO" | "WARNING" | "ERROR" | "FATAL";

export interface FactoryMessage {
  severity: Severity;
  id: string;
  text: string;
  callId?: string;
  nodePath?: string;
}

export const emptyFactory = (): FactoryState => ({ inst: [], type: [] });

export interface ApplyResult {
  state: FactoryState;
  messages: FactoryMessage[];
  /** What happened to the call, for explanations. */
  effect: "added" | "replaced" | "kept-existing" | "duplicate" | "compile-error";
  /** callId of the entry that was replaced or kept. */
  otherCallId?: string;
}

export function applyOverride(table: ClassTable, state: FactoryState, call: OverrideCall): ApplyResult {
  const original = proxyOf(table, call.original);
  const override = proxyOf(table, call.override);
  if (!original || !override) {
    const missing = !original ? call.original : call.override;
    return {
      state,
      effect: "compile-error",
      messages: [{ severity: "ERROR", id: "COMPILE", callId: call.id, text: `${missing} has no get_type(): it is not derived from any registered class.` }],
    };
  }
  const messages: FactoryMessage[] = [];

  if (call.kind === "inst") {
    const path = fullInstPath(call);
    const dup = state.inst.find((e) => e.fullPath === path && e.original === original && e.override === override);
    if (dup) {
      messages.push({
        severity: "INFO",
        id: "DUPOVRD",
        callId: call.id,
        text: `Instance override for '${original}' already exists: override type '${override}' with full_inst_path '${path}'`,
      });
      return { state, messages, effect: "duplicate", otherCallId: dup.callId };
    }
    const entry: FactoryEntry = { callId: call.id, kind: "inst", original, override, fullPath: path, replace: false };
    return { state: { inst: [...state.inst, entry], type: state.type }, messages, effect: "added" };
  }

  if (original === override) {
    messages.push({ severity: "WARNING", id: "TYPDUP", callId: call.id, text: `Original and override type arguments are identical: ${original}` });
  }
  const existingIndex = state.type.findIndex((e) => e.original === original);
  if (existingIndex >= 0) {
    const existing = state.type[existingIndex];
    if (!call.replace) {
      messages.push({
        severity: "INFO",
        id: "TPREGD",
        callId: call.id,
        text: `Original object type '${original}' already registered to produce '${existing.override}'.  Set 'replace' argument to replace the existing entry.`,
      });
      return { state, messages, effect: "kept-existing", otherCallId: existing.callId };
    }
    messages.push({
      severity: "INFO",
      id: "TPREGR",
      callId: call.id,
      text: `Original object type '${original}' already registered to produce '${existing.override}'.  Replacing with override to produce type '${override}'.`,
    });
    const type = state.type.map((e, i) => (i === existingIndex ? { ...e, callId: call.id, override, replace: call.replace } : e));
    return { state: { inst: state.inst, type }, messages, effect: "replaced", otherCallId: existing.callId };
  }
  const entry: FactoryEntry = { callId: call.id, kind: "type", original, override, replace: call.replace };
  return { state: { inst: state.inst, type: [entry, ...state.type] }, messages, effect: "added" };
}

// ---------------------------------------------------------------------------
// Lookup (find_override_by_type)
// ---------------------------------------------------------------------------

export interface InstCheck {
  entry: FactoryEntry;
  /** 1-based registration position in the instance queue. */
  position: number;
  typeMatches: boolean;
  pathMatches: boolean;
  selected: boolean;
  /** A matching entry that was never reached because an earlier one matched first. */
  shadowed: boolean;
}

export interface LookupHop {
  requested: string;
  fullPath: string;
  instChecks: InstCheck[];
  /** Type overrides whose original type is this hop's requested type. */
  typeCandidates: FactoryEntry[];
  chosen: FactoryEntry | null;
  via: "inst" | "type" | "none";
}

export interface Lookup {
  result: string;
  hops: LookupHop[];
  loop: boolean;
}

export function findOverrideByType(state: FactoryState, requested: string, fullPath: string): Lookup {
  const hops: LookupHop[] = [];
  const visited: string[] = [];
  let current = requested;
  for (;;) {
    if (visited.includes(current)) return { result: current, hops, loop: true };
    visited.push(current);
    const hop: LookupHop = { requested: current, fullPath, instChecks: [], typeCandidates: [], chosen: null, via: "none" };
    hops.push(hop);

    // Instance overrides: registration order, first match wins. Skipped for an empty path.
    if (fullPath !== "") {
      state.inst.forEach((entry, i) => {
        const typeMatches = entry.original === current;
        const pathMatches = factoryPathMatches(entry.fullPath ?? "", fullPath);
        const matches = typeMatches && pathMatches;
        const selected = matches && hop.chosen === null;
        if (selected) {
          hop.chosen = entry;
          hop.via = "inst";
        }
        hop.instChecks.push({ entry, position: i + 1, typeMatches, pathMatches, selected, shadowed: matches && !selected });
      });
    }

    // Type overrides, only if no instance override matched.
    hop.typeCandidates = state.type.filter((e) => e.original === current);
    if (!hop.chosen) {
      let chosen: FactoryEntry | null = null;
      for (const entry of hop.typeCandidates) {
        if (chosen === null || !chosen.replace) {
          chosen = entry;
          if (chosen.replace) break;
        }
      }
      if (chosen) {
        hop.chosen = chosen;
        hop.via = "type";
      }
    }

    if (!hop.chosen || hop.chosen.override === current) return { result: current, hops, loop: false };
    current = hop.chosen.override;
  }
}

// ---------------------------------------------------------------------------
// Build program: overrides placed in the test, components created top-down
// ---------------------------------------------------------------------------

export type Placement = "test-build-before" | "test-build-after" | "test-connect";

export const PLACEMENT_LABELS: Record<Placement, string> = {
  "test-build-before": "my_test::build_phase, before env is created",
  "test-build-after": "my_test::build_phase, after env is created",
  "test-connect": "my_test::connect_phase",
};

export type PlacedOverride = OverrideCall & { placement: Placement };

export interface BuildNode {
  name: string;
  /** The class named in `T::type_id::create(...)` or the declared handle type for `new`. */
  requested: string;
  construct?: "create" | "new";
  /** "parent": create(name, this). "none": create(name), so the factory sees only the name. */
  context?: "parent" | "none";
  /** Components are created in build_phase; objects may be created in run_phase. */
  createdIn?: "build" | "run";
  children?: BuildNode[];
}

export interface FactoryProgram {
  classes: ClassTable;
  /** uvm_test_top, created by run_test(). */
  root: BuildNode;
  overrides: PlacedOverride[];
}

export type FactoryEvent =
  | { kind: "override"; call: PlacedOverride; phase: "build" | "connect" }
  | { kind: "create"; node: BuildNode; path: string; contextPath: string | null; parentPath: string; parentRequested: string; phase: "build" | "run" };

const byName = (a: BuildNode, b: BuildNode) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * Time order of the program: build_phase is top-down and depth-first (children
 * visited in name order, as m_children is keyed by name); each component's
 * build_phase creates its children in code order. connect_phase overrides come
 * after the whole build; run-phase object creation comes last.
 */
export function scheduleProgram(program: FactoryProgram): FactoryEvent[] {
  const events: FactoryEvent[] = [];
  const runCreates: FactoryEvent[] = [];
  const overridesAt = (p: Placement) => program.overrides.filter((o) => o.placement === p);

  const build = (node: BuildNode, path: string, isRoot: boolean) => {
    if (isRoot) overridesAt("test-build-before").forEach((call) => events.push({ kind: "override", call, phase: "build" }));
    for (const child of node.children ?? []) {
      const ev: FactoryEvent = {
        kind: "create",
        node: child,
        path: `${path}.${child.name}`,
        contextPath: (child.context ?? "parent") === "parent" ? path : null,
        parentPath: path,
        parentRequested: node.requested,
        phase: child.createdIn === "run" ? "run" : "build",
      };
      if (ev.phase === "run") runCreates.push(ev);
      else events.push(ev);
    }
    if (isRoot) overridesAt("test-build-after").forEach((call) => events.push({ kind: "override", call, phase: "build" }));
    const children = (node.children ?? []).filter((c) => c.createdIn !== "run").slice().sort(byName);
    for (const child of children) build(child, `${path}.${child.name}`, false);
  };

  build(program.root, program.root.name, true);
  overridesAt("test-connect").forEach((call) => events.push({ kind: "override", call, phase: "connect" }));
  return [...events, ...runCreates];
}

export type NodeStatus = "built" | "fatal" | "not-built";

export interface NodeResult {
  path: string;
  name: string;
  requested: string;
  construct: "create" | "new";
  /** Path the factory matched against ({contxt, ".", name} or just name). */
  factoryPath: string;
  status: NodeStatus;
  /** Class actually constructed (null when not built). For FCTTYP, the type the factory returned. */
  built: string | null;
  lookup: Lookup | null;
  /** 1-based position among create() calls. */
  createOrder: number | null;
  /** Override call ids that were registered after this node was created. */
  laterCallIds: string[];
}

export interface FactoryRun {
  nodes: NodeResult[];
  messages: FactoryMessage[];
  /** Factory state at the end (or at the fatal). */
  state: FactoryState;
  /** What each override call did. */
  effects: Record<string, ApplyResult["effect"]>;
  /** Event index at which each override call ran. */
  callTimes: Record<string, number>;
  fatal: FactoryMessage | null;
  events: FactoryEvent[];
}

function collectNodes(node: BuildNode, path: string, out: { node: BuildNode; path: string }[]) {
  for (const child of node.children ?? []) {
    const childPath = `${path}.${child.name}`;
    out.push({ node: child, path: childPath });
    collectNodes(child, childPath, out);
  }
}

export function runFactoryProgram(program: FactoryProgram): FactoryRun {
  const events = scheduleProgram(program);
  const table = program.classes;
  let state = emptyFactory();
  const messages: FactoryMessage[] = [];
  const effects: Record<string, ApplyResult["effect"]> = {};
  const callTimes: Record<string, number> = {};
  const results = new Map<string, NodeResult>();
  const allNodes: { node: BuildNode; path: string }[] = [];
  collectNodes(program.root, program.root.name, allNodes);
  for (const { node, path } of allNodes) {
    results.set(path, {
      path,
      name: node.name,
      requested: node.requested,
      construct: node.construct ?? "create",
      factoryPath: "",
      status: "not-built",
      built: null,
      lookup: null,
      createOrder: null,
      laterCallIds: [],
    });
  }

  let fatal: FactoryMessage | null = null;
  let createCount = 0;
  for (let i = 0; i < events.length && !fatal; i += 1) {
    const ev = events[i];
    if (ev.kind === "override") {
      const applied = applyOverride(table, state, ev.call);
      state = applied.state;
      effects[ev.call.id] = applied.effect;
      callTimes[ev.call.id] = i;
      messages.push(...applied.messages);
      results.forEach((r) => {
        if (r.status !== "not-built") r.laterCallIds.push(ev.call.id);
      });
      continue;
    }
    const r = results.get(ev.path);
    if (!r) continue;
    createCount += 1;
    r.createOrder = createCount;
    r.factoryPath = ev.contextPath ? `${ev.contextPath}.${ev.node.name}` : ev.node.name;
    if (r.construct === "new") {
      r.status = "built";
      r.built = ev.node.requested;
      continue;
    }
    const requestedProxy = proxyOf(table, ev.node.requested) ?? ev.node.requested;
    const lookup = findOverrideByType(state, requestedProxy, r.factoryPath);
    r.lookup = lookup;
    r.built = lookup.result;
    if (lookup.loop) {
      messages.push({ severity: "ERROR", id: "OVRDLOOP", nodePath: ev.path, text: "Cyclic override chain: the model stops at the first repeated type." });
    }
    if (!isSubclassOf(table, lookup.result, requestedProxy)) {
      const kind = findClass(table, requestedProxy)?.kind ?? "component";
      const parentType = results.get(ev.parentPath)?.built ?? ev.parentRequested;
      fatal = {
        severity: "FATAL",
        id: "FCTTYP",
        nodePath: ev.path,
        text: `Factory did not return a ${kind} of type '${requestedProxy}'. A component of type '${lookup.result}' was returned instead. Name=${ev.node.name} Parent=${ev.contextPath === null && kind === "object" ? "null" : parentType} contxt=${ev.contextPath ?? ""}`,
      };
      r.status = "fatal";
      messages.push(fatal);
      continue;
    }
    r.status = "built";
  }

  return { nodes: allNodes.map(({ path }) => results.get(path) as NodeResult), messages, state, effects, callTimes, fatal, events };
}

export function nodeResult(run: FactoryRun, path: string): NodeResult | undefined {
  return run.nodes.find((n) => n.path === path);
}

export const OUTCOME_FATAL = "FATAL";
export const OUTCOME_NOT_BUILT = "NOT_BUILT";

/** The class a node became, "FATAL" for an FCTTYP failure, or "NOT_BUILT" if it was never created. */
export function outcomeOf(node: NodeResult): string {
  if (node.status === "fatal") return OUTCOME_FATAL;
  if (node.status === "not-built" || !node.built) return OUTCOME_NOT_BUILT;
  return node.built;
}

/** Types reachable from `requested` through any override (the chain closure), for relevance checks. */
function reachableTypes(program: FactoryProgram, requested: string): Set<string> {
  const reachable = new Set<string>([requested]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const call of program.overrides) {
      const orig = proxyOf(program.classes, call.original) ?? call.original;
      if ((reachable.has(orig) || reachable.has(call.original)) && !reachable.has(call.override)) {
        reachable.add(call.override);
        grew = true;
      }
    }
  }
  return reachable;
}

// ---------------------------------------------------------------------------
// Explanations (all derived from the run)
// ---------------------------------------------------------------------------

function describeCall(program: FactoryProgram, callId: string): string {
  const index = program.overrides.findIndex((o) => o.id === callId);
  const call = program.overrides[index];
  if (!call) return callId;
  return call.kind === "inst"
    ? `#${index + 1} (instance ${call.original} → ${call.override}, path "${fullInstPath(call)}")`
    : `#${index + 1} (type ${call.original} → ${call.override})`;
}

/** One-sentence "why" for a node's outcome. */
export function explainNode(program: FactoryProgram, run: FactoryRun, path: string): string {
  const node = nodeResult(run, path);
  if (!node) return "";
  if (node.status === "not-built") {
    return run.fatal ? `Never created: the FCTTYP fatal at ${run.fatal.nodePath} ended the simulation first.` : "Not created by this program.";
  }
  if (node.construct === "new") {
    return `Built with new(), so the factory is never asked: it is always a ${node.requested}, whatever overrides exist.`;
  }
  const lookup = node.lookup;
  if (!lookup) return "";
  const hopText = lookup.hops
    .filter((h) => h.chosen && h.chosen.override !== h.requested)
    .map((h) => {
      const how = h.via === "inst" ? "instance override" : "type override";
      return `${h.requested} → ${h.chosen?.override} by ${how} ${describeCall(program, h.chosen?.callId ?? "")}`;
    });
  const first = lookup.hops[0];
  const shadowed = first.instChecks.filter((c) => c.shadowed);
  let text: string;
  if (hopText.length === 0) {
    const self = first.chosen && first.chosen.override === first.requested;
    text = self
      ? `The only matching override maps ${first.requested} to itself (TYPDUP), so create() builds ${first.requested}.`
      : `No override matches ${first.requested} at "${node.factoryPath}", so create() builds ${first.requested}.`;
  } else {
    text = `${hopText.join("; then ")}.`;
    if (hopText.length > 1) text += " Each hop looks up overrides again for the new type (chaining).";
  }
  if (first.via === "inst" && first.typeCandidates.length > 0) text += " Instance overrides are checked before type overrides, so the type override is ignored here.";
  if (shadowed.length > 0) {
    text += ` ${shadowed.map((c) => `#${program.overrides.findIndex((o) => o.id === c.entry.callId) + 1}`).join(", ")} also matched but was registered later; the first registered match wins.`;
  }
  if (node.status === "fatal") {
    text += ` type_id::create then $casts the ${node.built} to ${node.requested}; it does not extend ${node.requested}, so UVM issues FCTTYP and stops.`;
  }
  const reachable = reachableTypes(program, node.requested);
  const late = node.laterCallIds.filter((id) => {
    const call = program.overrides.find((o) => o.id === id);
    return Boolean(call) && reachable.has(proxyOf(program.classes, call?.original ?? "") ?? "");
  });
  if (late.length > 0) text += ` ${late.map((id) => describeCall(program, id)).join(", ")} ran after this create(), so it cannot change this object.`;
  return text;
}

/** Candidate answers for "which class does create() build at <path>?". */
export function candidateOutcomes(program: FactoryProgram, run: FactoryRun, path: string): string[] {
  const node = nodeResult(run, path);
  if (!node) return [];
  const out = [...reachableTypes(program, node.requested)];
  const anyIncompatible = out.some((c) => !isSubclassOf(program.classes, proxyOf(program.classes, c) ?? c, node.requested));
  const actual = outcomeOf(node);
  if (anyIncompatible || actual === OUTCOME_FATAL) out.push(OUTCOME_FATAL);
  if (!out.includes(actual)) out.push(actual);
  return out;
}

/** Diagnostic feedback for choosing `candidate` as the outcome at `path`. */
export function diagnoseCandidate(program: FactoryProgram, run: FactoryRun, path: string, candidate: string): string {
  const node = nodeResult(run, path);
  if (!node) return "";
  const actual = outcomeOf(node);
  if (candidate === actual) return explainNode(program, run, path);
  const table = program.classes;
  const callsTo = program.overrides.filter((o) => o.override === candidate);

  if (actual === OUTCOME_NOT_BUILT) {
    return `Nothing is built here: the FCTTYP fatal at ${run.fatal?.nodePath ?? "an earlier create()"} ended the simulation before this create() ran.`;
  }
  if (candidate === OUTCOME_NOT_BUILT) {
    return `This create() does run. ${explainNode(program, run, path)}`;
  }
  if (node.construct === "new") {
    return `The agent builds this ${node.name} with new(). new() never consults the factory, so no override can turn it into a ${candidate}.`;
  }
  if (candidate === OUTCOME_FATAL) {
    return `No cast fails here: the factory returns ${node.built} for "${node.factoryPath}", and ${node.built} extends ${node.requested}.`;
  }
  if (actual === OUTCOME_FATAL) {
    if (candidate === node.built) {
      return `The factory does return a ${candidate}, but type_id::create then $casts it to ${node.requested}. ${candidate} does not extend ${node.requested}, so the cast fails with UVM_FATAL FCTTYP.`;
    }
    return `Follow the overrides: the factory returns ${node.built}, which is not a ${node.requested}, so create() ends in FCTTYP.`;
  }
  // The unregistered-class trap.
  const unregistered = callsTo.find((c) => !findClass(table, c.override)?.registered);
  if (unregistered && proxyOf(table, candidate) !== candidate) {
    return `${candidate} has no \`uvm_component_utils, so ${candidate}::get_type() is ${proxyOf(table, candidate)}'s proxy. The override becomes ${proxyOf(table, candidate)} → ${proxyOf(table, candidate)}: a TYPDUP warning and no change.`;
  }
  const lookup = node.lookup;
  if (!lookup) return "";
  // Registered too late.
  const lateCall = callsTo.find((c) => node.laterCallIds.includes(c.id));
  if (lateCall) {
    return `${describeCall(program, lateCall.id)} is registered in ${PLACEMENT_LABELS[lateCall.placement]}, after this create() already ran. Overrides affect only later create() calls.`;
  }
  // Intermediate hop in a chain.
  const hopIndex = lookup.hops.findIndex((h) => h.requested === candidate);
  if (hopIndex > 0) {
    return `${candidate} is only an intermediate hop. The factory looks up overrides again for ${candidate} at the same path and finds ${lookup.hops[hopIndex].chosen?.override ?? "another"} (chaining).`;
  }
  const first = lookup.hops[0];
  // Shadowed instance override (registered later than the winner).
  const shadow = lookup.hops.flatMap((h) => h.instChecks).find((c) => c.shadowed && c.entry.override === candidate);
  if (shadow) {
    const winner = lookup.hops.find((h) => h.via === "inst")?.chosen;
    return `Override ${describeCall(program, shadow.entry.callId)} also matches this path, but ${describeCall(program, winner?.callId ?? "")} was registered first. Among instance overrides the first registered match wins, not the most specific path.`;
  }
  // Instance override whose path does not match.
  const missed = first.instChecks.find((c) => c.entry.override === candidate && c.typeMatches && !c.pathMatches);
  if (missed) {
    const pattern = missed.entry.fullPath ?? "";
    const hint = factoryPathHasWildcard(pattern)
      ? "As a glob, * matches any characters (dots included) and ? matches one character, but the whole path must match."
      : "Without * or ?, the factory compares the two strings exactly.";
    return `The instance override's full path is "${pattern}", but this create() asks at "${node.factoryPath}". ${hint}`;
  }
  // Type override beaten by an instance override.
  if (first.via === "inst" && first.typeCandidates.some((e) => e.override === candidate)) {
    return `A type override would give ${candidate}, but an instance override matches this path, and instance overrides are always checked before type overrides.`;
  }
  // Type override replaced or kept out.
  const replacedOrKept = callsTo.find((c) => c.kind === "type" && (run.effects[c.id] === "kept-existing" || !run.state.type.some((e) => e.callId === c.id)));
  if (replacedOrKept) {
    return run.effects[replacedOrKept.id] === "kept-existing"
      ? `${describeCall(program, replacedOrKept.id)} passes replace=0, so the existing override for ${replacedOrKept.original} stays and this call is ignored (TPREGD).`
      : `${describeCall(program, replacedOrKept.id)} was replaced by a later set_type_override for ${replacedOrKept.original} (replace=1 is the default).`;
  }
  if (candidate === node.requested) {
    return `An override applies on this path: ${explainNode(program, run, path)}`;
  }
  const otherOriginal = callsTo.find((c) => (proxyOf(table, c.original) ?? c.original) !== node.requested && !lookup.hops.some((h) => h.requested === c.original));
  if (otherOriginal) {
    return `That override replaces ${otherOriginal.original}, not ${node.requested}. Overrides are keyed by the requested type.`;
  }
  return `The factory does not produce ${candidate} at "${node.factoryPath}". ${explainNode(program, run, path)}`;
}

// ---------------------------------------------------------------------------
// Source generation (kept in sync with the model data)
// ---------------------------------------------------------------------------

export interface SourceLine {
  text: string;
  key?: string;
}

export function overrideToSource(call: OverrideCall): string {
  if (call.kind === "type") {
    return `${call.original}::type_id::set_type_override(${call.override}::get_type()${call.replace ? "" : ", 0"});`;
  }
  const parent = call.parentPath === null ? "" : ", this";
  return `${call.original}::type_id::set_inst_override(${call.override}::get_type(), "${call.pathArg}"${parent});`;
}

/** my_test source with the overrides in their placements. */
export function testSource(program: FactoryProgram): SourceLine[] {
  const at = (p: Placement) => program.overrides.filter((o) => o.placement === p);
  const env = program.root.children?.[0];
  const lines: SourceLine[] = [
    { text: `class ${program.root.requested} extends uvm_test;` },
    { text: `  \`uvm_component_utils(${program.root.requested})` },
    { text: `  ${env?.requested ?? "my_env"} ${env?.name ?? "env"};` },
    { text: "  function new(string name, uvm_component parent);" },
    { text: "    super.new(name, parent);" },
    { text: "  endfunction" },
    { text: "  function void build_phase(uvm_phase phase);" },
    { text: "    super.build_phase(phase);" },
    ...at("test-build-before").map((o) => ({ text: `    ${overrideToSource(o)}`, key: o.id })),
    { text: `    ${env?.name ?? "env"} = ${env?.requested ?? "my_env"}::type_id::create("${env?.name ?? "env"}", this);`, key: "create-env" },
    ...at("test-build-after").map((o) => ({ text: `    ${overrideToSource(o)}`, key: o.id })),
    { text: "  endfunction" },
  ];
  const connect = at("test-connect");
  if (connect.length > 0) {
    lines.push({ text: "  function void connect_phase(uvm_phase phase);" });
    connect.forEach((o) => lines.push({ text: `    ${overrideToSource(o)}`, key: o.id }));
    lines.push({ text: "  endfunction" });
  }
  lines.push({ text: "endclass" });
  return lines;
}

/** build_phase body of the class that creates `children` (e.g. my_agent). */
export function builderSource(className: string, children: BuildNode[], baseClass = "uvm_agent"): SourceLine[] {
  const creates = children.filter((c) => c.createdIn !== "run");
  return [
    { text: `class ${className} extends ${baseClass};` },
    { text: `  \`uvm_component_utils(${className})` },
    ...creates.map((c) => ({ text: `  ${c.requested} ${c.name};` })),
    { text: "  // constructor omitted" },
    { text: "  function void build_phase(uvm_phase phase);" },
    { text: "    super.build_phase(phase);" },
    ...creates.map((c) => ({
      text:
        (c.construct ?? "create") === "new"
          ? `    ${c.name} = new("${c.name}", this);   // bypasses the factory`
          : `    ${c.name} = ${c.requested}::type_id::create("${c.name}", this);`,
      key: `create-${c.name}`,
    })),
    { text: "  endfunction" },
    { text: "endclass" },
  ];
}

/** run_phase of a component that creates objects (e.g. a monitor creating transactions). */
export function objectCreatorSource(className: string, baseClass: string, objects: BuildNode[]): SourceLine[] {
  return [
    { text: `class ${className} extends ${baseClass};` },
    { text: "  task run_phase(uvm_phase phase);" },
    ...objects.map((o) => ({ text: `    ${o.requested} ${o.name};` })),
    ...objects.map((o) => ({
      text: `    ${o.name} = ${o.requested}::type_id::create("${o.name}"${(o.context ?? "parent") === "parent" ? ", this" : ""});`,
      key: `create-${o.name}`,
    })),
    { text: "    // … fill tr from the bus, then ap.write(tr)" },
    { text: "  endtask" },
    { text: "endclass" },
  ];
}

/** One line per user class, showing which ones lack a registration macro. */
export function classDeclarations(table: ClassTable, names: string[]): SourceLine[] {
  return names
    .map((n) => findClass(table, n))
    .filter((c): c is FactoryClass => Boolean(c) && !c?.library)
    .map((c) => ({
      key: `class-${c.name}`,
      text: c.registered
        ? `class ${c.name} extends ${c.extends}; \`uvm_${c.kind}_utils(${c.name}) … endclass`
        : `class ${c.name} extends ${c.extends}; /* no \`uvm_${c.kind}_utils */ … endclass`,
    }));
}

/** factory.print()-style listing (uvm_default_factory::print): instance overrides in queue order, type overrides front first. */
export function factoryPrintout(state: FactoryState): string[] {
  const lines = ["#### Factory Configuration (*)", ""];
  if (state.inst.length === 0 && state.type.length === 0) {
    lines.push("  No instance or type overrides are registered with this factory");
    return lines;
  }
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
  if (state.inst.length === 0) lines.push("No instance overrides are registered with this factory");
  else {
    const w1 = Math.max(14, ...state.inst.map((e) => e.original.length));
    const w2 = Math.max(13, ...state.inst.map((e) => (e.fullPath ?? "").length));
    lines.push("Instance Overrides:", "");
    lines.push(`  ${pad("Requested Type", w1)}  ${pad("Override Path", w2)}  Override Type`);
    lines.push(`  ${"-".repeat(w1)}  ${"-".repeat(w2)}  ${"-".repeat(13)}`);
    state.inst.forEach((e) => lines.push(`  ${pad(e.original, w1)}  ${pad(e.fullPath ?? "", w2)}  ${e.override}`));
  }
  lines.push("");
  if (state.type.length === 0) lines.push("No type overrides are registered with this factory");
  else {
    const w1 = Math.max(14, ...state.type.map((e) => e.original.length));
    lines.push("Type Overrides:", "");
    lines.push(`  ${pad("Requested Type", w1)}  Override Type`);
    lines.push(`  ${"-".repeat(w1)}  ${"-".repeat(13)}`);
    state.type.forEach((e) => lines.push(`  ${pad(e.original, w1)}  ${e.override}`));
  }
  return lines;
}

/** create()-style lookup narrative for one node (what the factory checks, in order). */
export function lookupLog(program: FactoryProgram, node: NodeResult): string[] {
  if (node.status === "not-built") return ["(never created)"];
  if (node.construct === "new") return [`${node.name} = new("${node.name}", this) → factory not consulted → ${node.requested}`];
  const withContext = node.factoryPath !== node.name;
  const lines = [`${node.requested}::type_id::create("${node.name}"${withContext ? ", this" : ""}) → full path "${node.factoryPath}"`];
  const label = (callId: string) => `#${program.overrides.findIndex((o) => o.id === callId) + 1}`;
  node.lookup?.hops.forEach((hop, i) => {
    lines.push(`${i === 0 ? "find_override_by_type" : `→ ${hop.requested} differs from ${node.lookup?.hops[i - 1].requested}: look up again, find_override_by_type`}(${hop.requested}, "${hop.fullPath}")`);
    if (hop.instChecks.length === 0) lines.push("  instance overrides: none registered");
    let reachedWinner = false;
    hop.instChecks.forEach((c) => {
      const tag = label(c.entry.callId);
      if (reachedWinner) {
        if (c.typeMatches && c.pathMatches) lines.push(`  ${tag} ${c.entry.fullPath} → ${c.entry.override}: also matches, never reached (first match already won)`);
        return;
      }
      if (!c.typeMatches) lines.push(`  ${tag} original ${c.entry.original} ≠ ${hop.requested}: skip`);
      else if (!c.pathMatches) lines.push(`  ${tag} "${c.entry.fullPath}" vs "${hop.fullPath}": ✕ no match`);
      else {
        lines.push(`  ${tag} "${c.entry.fullPath}" vs "${hop.fullPath}": ✓ match → ${c.entry.override} (first match wins)`);
        reachedWinner = true;
      }
    });
    if (hop.via !== "inst") {
      if (hop.typeCandidates.length === 0) lines.push(`  type overrides for ${hop.requested}: none`);
      else if (hop.chosen) lines.push(`  type override ${label(hop.chosen.callId)}: ${hop.requested} → ${hop.chosen.override}`);
    } else if (hop.typeCandidates.length > 0) {
      lines.push(`  type override for ${hop.requested} not consulted (instance override already chosen)`);
    }
  });
  if (node.lookup?.loop) lines.push("  cyclic override chain: model stops");
  lines.push(node.status === "fatal" ? `$cast(${node.requested} ← ${node.built}) fails → UVM_FATAL [FCTTYP]` : `$cast to ${node.requested} ✓ → builds ${node.built}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Standard testbench used by the explorer and scenarios
// ---------------------------------------------------------------------------

export function standardTree(options: { driverConstruct?: "create" | "new"; envType?: string } = {}): BuildNode {
  const agent = (name: string): BuildNode => ({
    name,
    requested: "my_agent",
    children: [
      { name: "drv", requested: "base_driver", construct: options.driverConstruct ?? "create" },
      { name: "mon", requested: "my_monitor" },
    ],
  });
  return {
    name: "uvm_test_top",
    requested: "my_test",
    children: [{ name: "env", requested: options.envType ?? "my_env", children: [agent("agt0"), agent("agt1")] }],
  };
}

export const TEST_TOP = "uvm_test_top";
