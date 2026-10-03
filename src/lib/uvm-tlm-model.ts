/**
 * Deterministic model of UVM TLM 1.0 connections and analysis broadcast.
 * No React, no randomness: every visual in I-UVM-2B renders this model's output.
 *
 * Every rule below was checked against the uvm-core 2020.3.1 reference implementation
 * (github.com/accellera-official/uvm-core, tag 2020.3.1). Clause numbers come from that
 * source's own `@uvm-ieee 1800.2-2020` annotations.
 *
 * - src/base/uvm_port_base.svh
 *   - connect() (§5.5.2.14): late-connection warning, null/self errors, the interface-mask
 *     check, "imp.connect() is illegal", "export.connect(port) is illegal", then the
 *     relationship check.
 *   - m_check_relationship(): port→port must go child→parent, port→export/imp between
 *     siblings, export→export/imp parent→child. Violations are *warnings*, silenced
 *     (UVM_NO_ACTION) unless `check_connection_relationships` is set, and skipped entirely
 *     for uvm_analysis_port.
 *   - resolve_bindings() (§5.5.2.15): collects the imps reachable through m_provided_by into
 *     m_imp_list[string] (keyed by the imp's full name), then checks min_size/max_size.
 *   - get_if(i): walks m_imp_list with foreach, so index i is the i-th imp in
 *     lexicographic full-name order (IEEE 1800-2023 §7.8.2: string-indexed associative
 *     arrays are ordered lexicographically).
 * - src/tlm1/uvm_analysis_port.svh: uvm_analysis_port (§12.2.10.1) is UVM_PORT with
 *   min 0 / max unbounded and write() loops `for (i = 0; i < size(); i++) get_if(i).write(t)`;
 *   uvm_analysis_export (§12.2.10.3) is UVM_EXPORT with min 1 / max unbounded.
 * - src/tlm1/uvm_tlm_imps.svh: UVM_PORT_COMMON min 1 / max 1, UVM_SEQ_PORT min 0 / max 1,
 *   UVM_EXPORT_COMMON min 1 / max 1, UVM_IMP_COMMON min 1 / max 1.
 * - src/macros/uvm_tlm_defines.svh: interface masks; `uvm_analysis_imp_decl(SFX) (§B.5.22)
 *   defines class uvm_analysis_imp<SFX> whose write() calls m_imp.write<SFX>().
 * - src/tlm1/uvm_tlm_fifos.svh, uvm_tlm_fifo_base.svh: uvm_tlm_analysis_fifo is created with
 *   size 0 (unbounded); its analysis_export is a uvm_analysis_imp and write() is
 *   `void'(try_put(t))`; get_export is an alias of the uvm_get_peek_imp named "get_peek_export".
 * - src/base/uvm_root.svh: phase_started(end_of_elaboration) runs do_resolve_bindings() and
 *   then issues UVM_FATAL [BUILDERR] "stopping due to build errors" if any UVM_ERROR exists.
 * - src/comps/uvm_subscriber.svh: analysis_export is a uvm_analysis_imp created with the
 *   name "analysis_imp".
 * - src/seq/uvm_sequencer.svh: seq_item_export is a uvm_seq_item_pull_imp.
 */

// ── Interface masks (src/macros/uvm_tlm_defines.svh) ─────────────────────────

export const TLM_MASK = {
  BLOCKING_PUT: 1 << 0,
  BLOCKING_GET: 1 << 1,
  BLOCKING_PEEK: 1 << 2,
  NONBLOCKING_PUT: 1 << 4,
  NONBLOCKING_GET: 1 << 5,
  NONBLOCKING_PEEK: 1 << 6,
  ANALYSIS: 1 << 8,
} as const;

export const MASK_PUT = TLM_MASK.BLOCKING_PUT | TLM_MASK.NONBLOCKING_PUT;
export const MASK_GET = TLM_MASK.BLOCKING_GET | TLM_MASK.NONBLOCKING_GET;
export const MASK_PEEK = TLM_MASK.BLOCKING_PEEK | TLM_MASK.NONBLOCKING_PEEK;
export const MASK_GET_PEEK = MASK_GET | MASK_PEEK;
/** `UVM_SEQ_ITEM_PULL_MASK: bits 0..8 of the sequencer interface family. */
export const SEQ_ITEM_PULL_MASK = 0x1ff;

export const UNBOUNDED = Number.POSITIVE_INFINITY;

// ── Topology ────────────────────────────────────────────────────────────────

/** UVM_PORT, UVM_EXPORT or UVM_IMPLEMENTATION. */
export type TlmRole = "port" | "export" | "imp";
/** The interface base class: uvm_tlm_if_base or uvm_sqr_if_base. Different families never type-check. */
export type TlmFamily = "tlm" | "sqr";

export type TlmComponentKind =
  | "test"
  | "env"
  | "agent"
  | "sequencer"
  | "driver"
  | "monitor"
  | "scoreboard"
  | "subscriber"
  | "fifo"
  | "generic";

export interface TlmComponent {
  id: string;
  /** Instance name passed to create()/new(). */
  name: string;
  /** Parent component id; null means the child of uvm_root (uvm_test_top). */
  parent: string | null;
  kind: TlmComponentKind;
  cls: string;
}

export interface TlmEndpoint {
  /** `${owner}.${handle}` */
  id: string;
  owner: string;
  /** Member handle used in code, e.g. `get_export`. */
  handle: string;
  /** Name passed to new(); used by get_full_name(). Usually equals the handle. */
  objName: string;
  role: TlmRole;
  /** get_type_name(), used in UVM messages. */
  typeName: string;
  /** Declaration as written in the class, e.g. `uvm_analysis_imp #(bus_item, bus_scoreboard)`. */
  declaration: string;
  family: TlmFamily;
  txn: string;
  mask: number;
  minSize: number;
  maxSize: number;
  /** Imps only: the method the imp forwards to on its owner. */
  implMethod?: string;
}

export interface TlmTopology {
  components: TlmComponent[];
  endpoints: TlmEndpoint[];
}

/** One `from.connect(to)` call: requirer.connect(provider). */
export interface TlmConnection {
  from: string;
  to: string;
}

// Endpoint factories mirror the uvm-core constructors so min/max/masks cannot drift.

export function analysisPort(owner: string, handle: string, txn: string): TlmEndpoint {
  return {
    id: `${owner}.${handle}`,
    owner,
    handle,
    objName: handle,
    role: "port",
    typeName: "uvm_analysis_port",
    declaration: `uvm_analysis_port #(${txn})`,
    family: "tlm",
    txn,
    mask: TLM_MASK.ANALYSIS,
    minSize: 0,
    maxSize: UNBOUNDED,
  };
}

export function analysisExport(owner: string, handle: string, txn: string): TlmEndpoint {
  return {
    id: `${owner}.${handle}`,
    owner,
    handle,
    objName: handle,
    role: "export",
    typeName: "uvm_analysis_export",
    declaration: `uvm_analysis_export #(${txn})`,
    family: "tlm",
    txn,
    mask: TLM_MASK.ANALYSIS,
    minSize: 1,
    maxSize: UNBOUNDED,
  };
}

export function analysisImp(
  owner: string,
  handle: string,
  txn: string,
  opts: { objName?: string; suffix?: string; ownerCls?: string } = {},
): TlmEndpoint {
  const suffix = opts.suffix ?? "";
  const typeName = `uvm_analysis_imp${suffix}`;
  return {
    id: `${owner}.${handle}`,
    owner,
    handle,
    objName: opts.objName ?? handle,
    role: "imp",
    typeName,
    declaration: `${typeName} #(${txn}, ${opts.ownerCls ?? owner})`,
    family: "tlm",
    txn,
    mask: TLM_MASK.ANALYSIS,
    minSize: 1,
    maxSize: 1,
    implMethod: `write${suffix}`,
  };
}

export function seqItemPullPort(owner: string, txn: string): TlmEndpoint {
  return {
    id: `${owner}.seq_item_port`,
    owner,
    handle: "seq_item_port",
    objName: "seq_item_port",
    role: "port",
    typeName: "uvm_seq_item_pull_port",
    declaration: `uvm_seq_item_pull_port #(${txn})`,
    family: "sqr",
    txn,
    mask: SEQ_ITEM_PULL_MASK,
    minSize: 0,
    maxSize: 1,
  };
}

export function seqItemPullImp(owner: string, txn: string, ownerCls = owner): TlmEndpoint {
  return {
    id: `${owner}.seq_item_export`,
    owner,
    handle: "seq_item_export",
    objName: "seq_item_export",
    role: "imp",
    typeName: "uvm_seq_item_pull_imp",
    declaration: `uvm_seq_item_pull_imp #(${txn}, ${txn}, ${ownerCls})`,
    family: "sqr",
    txn,
    mask: SEQ_ITEM_PULL_MASK,
    minSize: 1,
    maxSize: 1,
    implMethod: "get_next_item",
  };
}

export function blockingGetPort(owner: string, handle: string, txn: string): TlmEndpoint {
  return {
    id: `${owner}.${handle}`,
    owner,
    handle,
    objName: handle,
    role: "port",
    typeName: "uvm_blocking_get_port",
    declaration: `uvm_blocking_get_port #(${txn})`,
    family: "tlm",
    txn,
    mask: TLM_MASK.BLOCKING_GET,
    minSize: 1,
    maxSize: 1,
  };
}

export function putImp(owner: string, handle: string, txn: string, objName = handle): TlmEndpoint {
  return {
    id: `${owner}.${handle}`,
    owner,
    handle,
    objName,
    role: "imp",
    typeName: "uvm_put_imp",
    declaration: `uvm_put_imp #(${txn}, ${owner})`,
    family: "tlm",
    txn,
    mask: MASK_PUT,
    minSize: 1,
    maxSize: 1,
    implMethod: "put",
  };
}

export function getPeekImp(owner: string, handle: string, txn: string, objName = handle): TlmEndpoint {
  return {
    id: `${owner}.${handle}`,
    owner,
    handle,
    objName,
    role: "imp",
    typeName: "uvm_get_peek_imp",
    declaration: `uvm_get_peek_imp #(${txn}, ${owner})`,
    family: "tlm",
    txn,
    mask: MASK_GET_PEEK,
    minSize: 1,
    maxSize: 1,
    implMethod: "get",
  };
}

/** The externally visible endpoints of `uvm_tlm_analysis_fifo #(T)` (uvm_tlm_fifo_base.svh). */
export function analysisFifoEndpoints(owner: string, txn: string): TlmEndpoint[] {
  return [
    { ...analysisImp(owner, "analysis_export", txn), declaration: `uvm_analysis_imp #(${txn}, uvm_tlm_analysis_fifo #(${txn}))` },
    putImp(owner, "put_export", txn),
    getPeekImp(owner, "get_export", txn, "get_peek_export"),
  ];
}

// ── Hierarchy helpers ───────────────────────────────────────────────────────

function componentMap(topo: TlmTopology) {
  return new Map(topo.components.map((c) => [c.id, c]));
}

export function findEndpoint(topo: TlmTopology, id: string): TlmEndpoint {
  const ep = topo.endpoints.find((e) => e.id === id);
  if (!ep) throw new Error(`Unknown endpoint ${id}`);
  return ep;
}

/** Component ids from the root down to `id`, inclusive. */
export function ancestry(topo: TlmTopology, id: string): string[] {
  const byId = componentMap(topo);
  const chain: string[] = [];
  let cur = byId.get(id);
  while (cur) {
    chain.unshift(cur.id);
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  return chain;
}

export function componentFullName(topo: TlmTopology, id: string): string {
  const byId = componentMap(topo);
  return ancestry(topo, id)
    .map((c) => byId.get(c)?.name ?? c)
    .join(".");
}

export function endpointFullName(topo: TlmTopology, ep: TlmEndpoint): string {
  return `${componentFullName(topo, ep.owner)}.${ep.objName}`;
}

function parentOf(topo: TlmTopology, id: string): string | null {
  return topo.components.find((c) => c.id === id)?.parent ?? null;
}

export function lowestCommonAncestor(topo: TlmTopology, a: string, b: string): string {
  const pa = ancestry(topo, a);
  const pb = ancestry(topo, b);
  let lca = pa[0];
  for (let i = 0; i < Math.min(pa.length, pb.length) && pa[i] === pb[i]; i += 1) lca = pa[i];
  return lca;
}

/** Hierarchical reference to an endpoint as written inside `writer`'s class. */
export function referenceFrom(topo: TlmTopology, writer: string, ep: TlmEndpoint): string {
  const chain = ancestry(topo, ep.owner);
  const at = chain.indexOf(writer);
  const byId = componentMap(topo);
  const below = (at >= 0 ? chain.slice(at + 1) : chain).map((c) => byId.get(c)?.name ?? c);
  return [...below, ep.handle].join(".");
}

export interface ConnectStatement {
  /** Component whose connect_phase holds the call: the lowest common ancestor of both owners. */
  writer: string;
  code: string;
  /** Components whose internals the call reaches into (more than one level below the writer). */
  reachesInside: string[];
}

export function connectStatement(topo: TlmTopology, fromId: string, toId: string): ConnectStatement {
  const from = findEndpoint(topo, fromId);
  const to = findEndpoint(topo, toId);
  const writer = lowestCommonAncestor(topo, from.owner, to.owner);
  const byId = componentMap(topo);
  const reachesInside = new Set<string>();
  for (const ep of [from, to]) {
    const chain = ancestry(topo, ep.owner);
    const below = chain.slice(chain.indexOf(writer) + 1);
    if (below.length > 1) reachesInside.add(byId.get(below[0])?.name ?? below[0]);
  }
  return {
    writer,
    code: `${referenceFrom(topo, writer, from)}.connect(${referenceFrom(topo, writer, to)});`,
    reachesInside: [...reachesInside],
  };
}

function ifBase(ep: TlmEndpoint): string {
  return ep.family === "sqr" ? `uvm_sqr_if_base #(${ep.txn}, ${ep.txn})` : `uvm_tlm_if_base #(${ep.txn}, ${ep.txn})`;
}

// ── connect() ───────────────────────────────────────────────────────────────

export type ConnectPhase = "build" | "connect" | "end_of_elaboration" | "run";

export interface ConnectOptions {
  /** Phase in which connect() is called. Default: connect. */
  phase?: ConnectPhase;
  /** uvm_config_int "check_connection_relationships" for the requirer. Default: off (UVM default). */
  checkRelationships?: boolean;
}

export type ConnectKind = "ok" | "compile_error" | "uvm_error" | "uvm_warning" | "duplicate";

export type ConnectRule =
  | "ok"
  | "type-parameter"
  | "late-connection"
  | "self"
  | "interface-mask"
  | "imp-connect"
  | "export-to-port"
  | "relationship-port-port"
  | "relationship-port-export"
  | "relationship-export-export"
  | "duplicate";

export interface RelationshipCheck {
  /** False when the check is skipped (uvm_analysis_port). */
  checked: boolean;
  ok: boolean;
  /** The warning text UVM would print when the check is enabled. */
  message?: string;
}

export interface ConnectResult {
  from: string;
  to: string;
  kind: ConnectKind;
  rule: ConnectRule;
  /** True when connect() records the binding (m_provided_by). */
  accepted: boolean;
  /** UVM report id, e.g. "Connection Error". */
  reportId?: string;
  /** Message text as uvm-core prints it. */
  message: string;
  /** Full log line in UVM style (null for accepted connections with nothing to report). */
  log: string | null;
  /** Plain-English explanation of the rule. */
  why: string;
  statement: ConnectStatement;
  relationship: RelationshipCheck;
}

function relationshipCheck(topo: TlmTopology, from: TlmEndpoint, to: TlmEndpoint): RelationshipCheck & { rule?: ConnectRule } {
  // "if we're an analysis port, allow connection to anywhere" (m_check_relationship)
  if (from.typeName === "uvm_analysis_port") return { checked: false, ok: true };
  const fromParent = from.owner;
  const toParent = to.owner;
  const fromGparent = parentOf(topo, fromParent);
  const toGparent = parentOf(topo, toParent);
  const toFull = endpointFullName(topo, to);
  if (from.role === "port" && to.role === "port" && fromGparent !== toParent) {
    return {
      checked: true,
      ok: false,
      rule: "relationship-port-port",
      message: `${toFull} (of type ${to.typeName}) is not up one level of hierarchy from this port. A port-to-port connection takes the form child_component.child_port.connect(parent_port)`,
    };
  }
  if (from.role === "port" && (to.role === "export" || to.role === "imp") && fromGparent !== toGparent) {
    return {
      checked: true,
      ok: false,
      rule: "relationship-port-export",
      message: `${toFull} (of type ${to.typeName}) is not at the same level of hierarchy as this port. A port-to-export connection takes the form component1.port.connect(component2.export)`,
    };
  }
  if (from.role === "export" && (to.role === "export" || to.role === "imp") && fromParent !== toGparent) {
    return {
      checked: true,
      ok: false,
      rule: "relationship-export-export",
      message: `${toFull} (of type ${to.typeName}) is not down one level of hierarchy from this export. An export-to-export or export-to-imp connection takes the form parent_export.connect(child_component.child_export)`,
    };
  }
  return { checked: true, ok: true };
}

function uvmLog(severity: "UVM_ERROR" | "UVM_WARNING" | "UVM_FATAL", context: string, id: string, message: string): string {
  return `${severity} @ 0: ${context} [${id}] ${message}`;
}

/**
 * Applies the checks of uvm_port_base::connect() in source order, preceded by the
 * compile-time type check that SystemVerilog performs on connect(this_type provider).
 */
export function checkConnect(
  topo: TlmTopology,
  existing: TlmConnection[],
  fromId: string,
  toId: string,
  options: ConnectOptions = {},
): ConnectResult {
  const from = findEndpoint(topo, fromId);
  const to = findEndpoint(topo, toId);
  const fromFull = endpointFullName(topo, from);
  const toFull = endpointFullName(topo, to);
  const statement = connectStatement(topo, fromId, toId);
  const skipped: RelationshipCheck = { checked: false, ok: true };
  const base = { from: fromId, to: toId, statement };

  // Compile time: connect() takes uvm_port_base #(IF) of the *same* specialization.
  if (from.family !== to.family || from.txn !== to.txn) {
    return {
      ...base,
      kind: "compile_error",
      rule: "type-parameter",
      accepted: false,
      message: `connect() expects uvm_port_base #(${ifBase(from)}) but ${referenceFrom(topo, statement.writer, to)} is uvm_port_base #(${ifBase(to)}). (Exact wording is tool-specific.)`,
      log: null,
      why:
        from.family !== to.family
          ? "Sequencer-driver ports and TLM/analysis ports implement different interface classes, so the compiler rejects the call before simulation starts."
          : `The transaction types differ (${from.txn} vs ${to.txn}). Each specialization of a parameterized class is a distinct type, so the compiler rejects the call.`,
      relationship: skipped,
    };
  }

  const phase = options.phase ?? "connect";
  if (phase === "end_of_elaboration" || phase === "run") {
    const message = `Attempt to connect ${fromFull} (of type ${from.typeName}) at or after end_of_elaboration phase.  Ignoring.`;
    return {
      ...base,
      kind: "uvm_warning",
      rule: "late-connection",
      accepted: false,
      reportId: "Late Connection",
      message,
      log: uvmLog("UVM_WARNING", fromFull, "Late Connection", message),
      why: "Bindings are resolved when end_of_elaboration starts. A connect() after that is ignored with only a warning, so the port stays unconnected.",
      relationship: skipped,
    };
  }

  if (fromId === toId) {
    const message = "Cannot connect a port instance to itself";
    return {
      ...base,
      kind: "uvm_error",
      rule: "self",
      accepted: false,
      reportId: "Connection Error",
      message,
      log: uvmLog("UVM_ERROR", fromFull, "Connection Error", message),
      why: "A connection needs two different endpoints.",
      relationship: skipped,
    };
  }

  if ((to.mask & from.mask) !== from.mask) {
    const message = `${toFull} (of type ${to.typeName}) does not provide the complete interface required of this port (type ${from.typeName})`;
    return {
      ...base,
      kind: "uvm_error",
      rule: "interface-mask",
      accepted: false,
      reportId: "Connection Error",
      message,
      log: uvmLog("UVM_ERROR", fromFull, "Connection Error", message),
      why: `The provider must implement every method the caller may call. ${from.typeName} needs ${describeMask(from.mask)}; ${to.typeName} provides ${describeMask(to.mask)}.`,
      relationship: skipped,
    };
  }

  if (from.role === "imp") {
    const message = `Cannot call an imp port's connect method. An imp is connected only to the component passed in its constructor. (You attempted to bind this imp to ${toFull})`;
    return {
      ...base,
      kind: "uvm_error",
      rule: "imp-connect",
      accepted: false,
      reportId: "Connection Error",
      message,
      log: uvmLog("UVM_ERROR", fromFull, "Connection Error", message),
      why: "An imp is the end of every chain: it is bound to its implementing component when it is constructed. Calls flow toward it, so it is always the argument of connect(), never the caller.",
      relationship: skipped,
    };
  }

  if (from.role === "export" && to.role === "port") {
    const message = `Cannot connect exports to ports Try calling port.connect(export) instead. (You attempted to bind this export to ${toFull}).`;
    return {
      ...base,
      kind: "uvm_error",
      rule: "export-to-port",
      accepted: false,
      reportId: "Connection Error",
      message,
      log: uvmLog("UVM_ERROR", fromFull, "Connection Error", message),
      why: "connect() is directional: requirer.connect(provider). The port is the requirer, so the port calls connect() and the export is the argument.",
      relationship: skipped,
    };
  }

  if (existing.some((c) => c.from === fromId && c.to === toId)) {
    return {
      ...base,
      kind: "duplicate",
      rule: "duplicate",
      accepted: false,
      message: "Already connected. connect() stores providers by full name, so a repeated call changes nothing.",
      log: null,
      why: "m_provided_by is keyed by the provider's full name; the second call overwrites the same entry.",
      relationship: skipped,
    };
  }

  const rel = relationshipCheck(topo, from, to);
  const relationship: RelationshipCheck = { checked: rel.checked, ok: rel.ok, message: rel.message };
  if (!rel.ok && options.checkRelationships) {
    return {
      ...base,
      kind: "uvm_warning",
      rule: rel.rule ?? "ok",
      accepted: true,
      reportId: "Connection Warning",
      message: rel.message ?? "",
      log: uvmLog("UVM_WARNING", fromFull, "Connection Warning", rel.message ?? ""),
      why: "The binding is still made; the warning only says the call skips a level of hierarchy.",
      relationship,
    };
  }

  return {
    ...base,
    kind: "ok",
    rule: "ok",
    accepted: true,
    message: "Connected.",
    log: null,
    why: okExplanation(from, to),
    relationship,
  };
}

function okExplanation(from: TlmEndpoint, to: TlmEndpoint): string {
  if (from.role === "port" && to.role === "port") return "Port to port goes up one level: the child's port is promoted to the parent's port, so code outside the parent sees one port.";
  if (from.role === "export") return "Export to export/imp goes down one level: the parent's export forwards calls to a child that implements them.";
  if (to.role === "imp") return "Port to imp between siblings: calls on the port now reach the component that implements the interface.";
  return "Port to export between siblings: the export forwards the calls further down to an imp.";
}

export function describeMask(mask: number): string {
  if (mask === SEQ_ITEM_PULL_MASK) return "the sequencer pull interface (get_next_item, item_done, …)";
  const names: [number, string][] = [
    [TLM_MASK.BLOCKING_PUT, "put()"],
    [TLM_MASK.NONBLOCKING_PUT, "try_put()/can_put()"],
    [TLM_MASK.BLOCKING_GET, "get()"],
    [TLM_MASK.NONBLOCKING_GET, "try_get()/can_get()"],
    [TLM_MASK.BLOCKING_PEEK, "peek()"],
    [TLM_MASK.NONBLOCKING_PEEK, "try_peek()/can_peek()"],
    [TLM_MASK.ANALYSIS, "write()"],
  ];
  const parts = names.filter(([bit]) => (mask & bit) !== 0).map(([, n]) => n);
  return parts.length ? parts.join(", ") : "nothing";
}

// ── resolve_bindings() at end_of_elaboration ────────────────────────────────

export interface Resolution {
  endpointId: string;
  fullName: string;
  /** Number of imps reached (size()). */
  size: number;
  /** Imps reached, in m_imp_list order: lexicographic by full name. */
  imps: string[];
  minSize: number;
  maxSize: number;
  status: "ok" | "below-min" | "above-max";
  message?: string;
  log?: string;
}

export function resolveBindings(topo: TlmTopology, connections: TlmConnection[]): Map<string, Resolution> {
  const providedBy = new Map<string, string[]>();
  for (const c of connections) {
    const list = providedBy.get(c.from) ?? [];
    if (!list.includes(c.to)) list.push(c.to);
    providedBy.set(c.from, list);
  }
  const memo = new Map<string, string[]>();
  const reach = (id: string, visiting: Set<string>): string[] => {
    const cached = memo.get(id);
    if (cached) return cached;
    const ep = findEndpoint(topo, id);
    if (ep.role === "imp") {
      memo.set(id, [id]);
      return [id];
    }
    if (visiting.has(id)) return [];
    visiting.add(id);
    const byName = new Map<string, string>();
    for (const p of providedBy.get(id) ?? []) {
      for (const imp of reach(p, visiting)) byName.set(endpointFullName(topo, findEndpoint(topo, imp)), imp);
    }
    visiting.delete(id);
    // m_imp_list is an associative array indexed by string: foreach walks it in lexicographic order.
    const ordered = [...byName.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, impId]) => impId);
    memo.set(id, ordered);
    return ordered;
  };

  const out = new Map<string, Resolution>();
  for (const ep of topo.endpoints) {
    const imps = reach(ep.id, new Set());
    const size = imps.length;
    const fullName = endpointFullName(topo, ep);
    let status: Resolution["status"] = "ok";
    let message: string | undefined;
    if (size < ep.minSize) {
      status = "below-min";
      message = `connection count of ${size} does not meet required minimum of ${ep.minSize}`;
    } else if (ep.maxSize !== UNBOUNDED && size > ep.maxSize) {
      status = "above-max";
      message = `connection count of ${size} exceeds maximum of ${ep.maxSize}`;
    }
    out.set(ep.id, {
      endpointId: ep.id,
      fullName,
      size,
      imps,
      minSize: ep.minSize,
      maxSize: ep.maxSize,
      status,
      message,
      log: message ? uvmLog("UVM_ERROR", fullName, "Connection Error", message) : undefined,
    });
  }
  return out;
}

export interface Elaboration {
  /** Results of each attempted connect() in call order. */
  results: ConnectResult[];
  /** Bindings that connect() recorded. */
  connections: TlmConnection[];
  compiles: boolean;
  resolutions: Map<string, Resolution>;
  /** UVM log lines up to the start of run_phase, in order. */
  log: string[];
  errorCount: number;
  /** UVM_FATAL [BUILDERR] stops the run before start_of_simulation. */
  buildErrorFatal: boolean;
  runStarts: boolean;
}

export const BUILDERR_LOG = "UVM_FATAL @ 0: reporter [BUILDERR] stopping due to build errors";

/** Runs a connect_phase (a list of connect() calls) through end_of_elaboration. */
export function elaborate(topo: TlmTopology, attempts: TlmConnection[], options: ConnectOptions = {}): Elaboration {
  const results: ConnectResult[] = [];
  const connections: TlmConnection[] = [];
  for (const a of attempts) {
    const r = checkConnect(topo, connections, a.from, a.to, options);
    results.push(r);
    if (r.accepted) connections.push({ from: a.from, to: a.to });
  }
  const compileErrors = results.filter((r) => r.kind === "compile_error");
  if (compileErrors.length > 0) {
    return {
      results,
      connections: [],
      compiles: false,
      resolutions: new Map(),
      log: compileErrors.map((r) => `Compile error: ${r.statement.code} — ${r.message}`),
      errorCount: compileErrors.length,
      buildErrorFatal: false,
      runStarts: false,
    };
  }
  const log = results.filter((r) => r.log).map((r) => r.log as string);
  const connectErrors = results.filter((r) => r.kind === "uvm_error").length;
  const resolutions = resolveBindings(topo, connections);
  const resolutionErrors = [...resolutions.values()].filter((r) => r.status !== "ok").sort((a, b) => (a.fullName < b.fullName ? -1 : 1));
  log.push(...resolutionErrors.map((r) => r.log as string));
  const errorCount = connectErrors + resolutionErrors.length;
  if (errorCount > 0) log.push(BUILDERR_LOG);
  return {
    results,
    connections,
    compiles: true,
    resolutions,
    log,
    errorCount,
    buildErrorFatal: errorCount > 0,
    runStarts: errorCount === 0,
  };
}

/** The imps an analysis port's write() calls, in the order uvm-core calls them. */
export function analysisCallOrder(topo: TlmTopology, connections: TlmConnection[], portId: string): string[] {
  return resolveBindings(topo, connections).get(portId)?.imps ?? [];
}

// ── Goals ───────────────────────────────────────────────────────────────────

export interface ReachGoal {
  from: string;
  reaches: string;
}

export function goalStatus(topo: TlmTopology, connections: TlmConnection[], goals: ReachGoal[]) {
  const res = resolveBindings(topo, connections);
  return goals.map((g) => ({ ...g, met: res.get(g.from)?.imps.includes(g.reaches) ?? false }));
}

// ── Analysis broadcast trace ────────────────────────────────────────────────

export type TxnValue = Record<string, number>;

export interface BroadcastInput {
  topo: TlmTopology;
  portId: string;
  /** Imp ids in the order the env's connect_phase connects them. */
  connectOrder: string[];
  txn: TxnValue;
  /** Simulation time of the write, in ns. */
  time: number;
  /** A subscriber that (wrongly) modifies the object it receives. */
  mutation?: { impId: string; field: string; to: number };
}

export interface BroadcastStep {
  /** Imp being called, or null for the enter/return steps. */
  current: string | null;
  /** Call stack from the monitor's run_phase down. */
  callStack: string[];
  what: string;
  why: string;
  /** Shared object after this step. */
  txn: TxnValue;
  /** What each imp's subscriber saw when it was called. */
  seen: Record<string, TxnValue>;
  time: number;
}

export interface BroadcastResult {
  order: string[];
  steps: BroadcastStep[];
  connectCode: string[];
}

export function broadcastTrace(input: BroadcastInput): BroadcastResult {
  const { topo, portId, connectOrder, time } = input;
  const connections = connectOrder.map((to) => ({ from: portId, to }));
  const order = analysisCallOrder(topo, connections, portId);
  const port = findEndpoint(topo, portId);
  const portOwner = topo.components.find((c) => c.id === port.owner);
  const portRef = `${portOwner?.name ?? port.owner}.${port.handle}`;
  let txn: TxnValue = { ...input.txn };
  const seen: Record<string, TxnValue> = {};
  const fmt = (t: TxnValue) => Object.entries(t).map(([k, v]) => `${k}=${v}`).join(" ");
  const steps: BroadcastStep[] = [
    {
      current: null,
      callStack: ["mon.run_phase", `${port.handle}.write(t)`],
      what: `At t = ${time} ns the monitor calls ${portRef}.write(t) with t = {${fmt(txn)}}.`,
      why: "write() is a function. It runs inside the monitor's own process: no thread is forked and no event is scheduled.",
      txn: { ...txn },
      seen: {},
      time,
    },
  ];
  order.forEach((impId, i) => {
    const imp = findEndpoint(topo, impId);
    const owner = topo.components.find((c) => c.id === imp.owner);
    seen[impId] = { ...txn };
    const mutated = input.mutation && input.mutation.impId === impId;
    if (mutated && input.mutation) txn = { ...txn, [input.mutation.field]: input.mutation.to };
    steps.push({
      current: impId,
      callStack: ["mon.run_phase", `${port.handle}.write(t)`, `${endpointFullName(topo, imp)}.write(t)`, `${owner?.cls ?? imp.owner}::${imp.implMethod}(t)`],
      what:
        `Call ${i + 1} of ${order.length}: ${owner?.name ?? imp.owner}.${imp.implMethod}(t) sees {${fmt(seen[impId])}}` +
        (mutated && input.mutation ? ` and then sets t.${input.mutation.field} = ${input.mutation.to}.` : ", returns, and the loop continues."),
      why:
        i === 0
          ? "At end_of_elaboration uvm-core collected the imps into a list keyed by full name, so it calls them in name order, not in connect() order. The standard promises no order: never rely on it."
          : mutated
            ? "Every subscriber receives the same object handle. Modifying it changes what every later subscriber sees; the uvm_analysis_imp documentation says write() must not modify the value."
            : "The next call starts only when the previous write() has returned. Still the same process, still the same simulation time.",
      txn: { ...txn },
      seen: { ...seen },
      time,
    });
  });
  steps.push({
    current: null,
    callStack: ["mon.run_phase"],
    what: `${port.handle}.write(t) returns. The monitor's next statement runs at t = ${time} ns.`,
    why:
      order.length === 0
        ? "With no subscriber connected the loop runs zero times: an analysis port may legally have 0 connections."
        : `All ${order.length} calls happened in zero simulation time. An analysis port has no buffer and no back-pressure.`,
    txn: { ...txn },
    seen: { ...seen },
    time,
  });
  return {
    order,
    steps,
    connectCode: connectOrder.map((impId) => connectStatement(topo, portId, impId).code),
  };
}

// ── Slow subscriber: what can a write() contain? ────────────────────────────

export type SlowSubscriberChoice = "delay-in-write" | "task-in-write" | "analysis-fifo";

export interface SlowSubscriberVerdict {
  compiles: boolean;
  /** IEEE 1800-2023 rule that decides the outcome. */
  rule: string;
  message: string;
}

export function slowSubscriberVerdict(choice: SlowSubscriberChoice): SlowSubscriberVerdict {
  switch (choice) {
    case "delay-in-write":
      return {
        compiles: false,
        rule: "IEEE 1800-2023 §13.4 (a): a function shall not contain time-controlling statements (#, ##, @, wait, fork-join…).",
        message: "Compile error: a delay control is not allowed inside function write(). (Exact wording is tool-specific.)",
      };
    case "task-in-write":
      return {
        compiles: false,
        rule: "IEEE 1800-2023 §13.4 (b): a function shall not enable tasks.",
        message: "Compile error: function write() cannot call task check_response(). (Exact wording is tool-specific.)",
      };
    case "analysis-fifo":
      return {
        compiles: true,
        rule: "uvm_tlm_analysis_fifo::write() is try_put() into an unbounded FIFO, so it always succeeds in zero time; get() is a task and may block.",
        message: "Compiles. The time-consuming check runs in the checker's own run_phase thread.",
      };
  }
}

export interface FifoSimInput {
  /** Times (ns) at which the monitor calls ap.write(). */
  writeTimes: number[];
  /** Time (ns) the checker spends per item after get() returns. */
  serviceTime: number;
  /** Time (ns) at which the test ends (last objection dropped, no drain). */
  endOfTest: number;
}

export interface FifoSimItem {
  id: number;
  writtenAt: number;
  /** get() returned. */
  startedAt: number;
  doneAt: number;
}

export interface FifoSimResult {
  items: FifoSimItem[];
  /** FIFO used() after each time slot where it changes. */
  occupancy: { t: number; used: number }[];
  maxUsed: number;
  /** The monitor never waits: write() into an unbounded analysis FIFO cannot block. */
  monitorWaitNs: number;
  /** Items whose check had not finished when the test ended. */
  uncheckedAtEnd: number[];
}

/**
 * One producer (monitor writes into the analysis FIFO) and one consumer
 * (`forever begin get_port.get(t); #service; end`). FIFO order; unbounded.
 */
export function simulateAnalysisFifo(input: FifoSimInput): FifoSimResult {
  const writes = [...input.writeTimes].sort((a, b) => a - b);
  const items: FifoSimItem[] = [];
  let free = 0;
  writes.forEach((t, i) => {
    const startedAt = Math.max(t, free);
    const doneAt = startedAt + input.serviceTime;
    items.push({ id: i + 1, writtenAt: t, startedAt, doneAt });
    free = doneAt;
  });
  const times = [...new Set([0, ...items.flatMap((it) => [it.writtenAt, it.startedAt])])].sort((a, b) => a - b);
  const occupancy = times.map((t) => ({
    t,
    used: items.filter((it) => it.writtenAt <= t).length - items.filter((it) => it.startedAt <= t).length,
  }));
  return {
    items,
    occupancy,
    maxUsed: Math.max(0, ...occupancy.map((o) => o.used)),
    monitorWaitNs: 0,
    uncheckedAtEnd: items.filter((it) => it.doneAt > input.endOfTest).map((it) => it.id),
  };
}

// ── Pull model: driver ↔ sequencer connection ───────────────────────────────

export type PullConnectChoice = "port-to-imp" | "imp-to-port" | "missing";

export const PULL_TXN = "bus_item";

export const pullTopology: TlmTopology = {
  components: [
    { id: "test", name: "uvm_test_top", parent: null, kind: "test", cls: "bus_test" },
    { id: "env", name: "env", parent: "test", kind: "env", cls: "bus_env" },
    { id: "agt", name: "agt", parent: "env", kind: "agent", cls: "bus_agent" },
    { id: "sqr", name: "sqr", parent: "agt", kind: "sequencer", cls: "bus_sequencer" },
    { id: "drv", name: "drv", parent: "agt", kind: "driver", cls: "bus_driver" },
  ],
  endpoints: [seqItemPullPort("drv", PULL_TXN), seqItemPullImp("sqr", PULL_TXN, "bus_sequencer")],
};

export type PullEdge = "call" | "item" | "pins" | "sequence";

export interface PullStep {
  id: string;
  phase: "connect_phase" | "end_of_elaboration" | "run_phase";
  what: string;
  why: string;
  /** Diagram edge that carries the token for this step. */
  edge: PullEdge | null;
  token: { label: string; tone: "data" | "control" | "error" } | null;
  /** Code line key to highlight. */
  codeKey: string;
  outcome?: "ok" | "error" | "fatal";
}

export interface PullRun {
  choice: PullConnectChoice;
  connectLine: string;
  elaboration: Elaboration;
  steps: PullStep[];
  /** How the run ends. */
  ending: "handshake-completes" | "build-error-fatal" | "null-handle-at-get_next_item";
}

export function pullModelRun(choice: PullConnectChoice): PullRun {
  const attempts: TlmConnection[] =
    choice === "port-to-imp"
      ? [{ from: "drv.seq_item_port", to: "sqr.seq_item_export" }]
      : choice === "imp-to-port"
        ? [{ from: "sqr.seq_item_export", to: "drv.seq_item_port" }]
        : [];
  const elaboration = elaborate(pullTopology, attempts);
  const connectLine =
    attempts.length > 0 ? connectStatement(pullTopology, attempts[0].from, attempts[0].to).code : "// (no connect() call)";
  const steps: PullStep[] = [];
  const first = elaboration.results[0];
  steps.push({
    id: "connect",
    phase: "connect_phase",
    what: attempts.length ? `bus_agent::connect_phase runs ${connectLine}` : "bus_agent::connect_phase makes no connect() call.",
    why: first
      ? first.accepted
        ? first.why
        : `${first.message} ${first.why}`
      : "Nothing is bound. Nothing reports it yet either.",
    edge: null,
    token: first && !first.accepted ? { label: "✕ connect", tone: "error" } : null,
    codeKey: "connect",
    outcome: first && !first.accepted ? "error" : "ok",
  });
  const res = elaboration.resolutions.get("drv.seq_item_port");
  steps.push({
    id: "eoe",
    phase: "end_of_elaboration",
    what: `resolve_bindings(): drv.seq_item_port reaches ${res?.size ?? 0} imp(s); min_size is 0, max_size is 1.`,
    why: elaboration.buildErrorFatal
      ? "The connect() error was already counted, so uvm_root stops the run with UVM_FATAL [BUILDERR] before run_phase."
      : res && res.size === 0
        ? "uvm_seq_item_pull_port is constructed with min_size 0, so an unconnected seq_item_port passes this check silently."
        : "One imp, within 0..1. No error, so the run continues to run_phase.",
    edge: null,
    token: null,
    codeKey: "connect",
    outcome: elaboration.buildErrorFatal ? "fatal" : "ok",
  });
  if (elaboration.buildErrorFatal) {
    return { choice, connectLine, elaboration, steps, ending: "build-error-fatal" };
  }
  if (res && res.size === 0) {
    steps.push({
      id: "gni-null",
      phase: "run_phase",
      what: "The driver calls seq_item_port.get_next_item(req). The port has no interface bound (m_if is null).",
      why: "The port forwards the call to m_if, which resolve_bindings() sets only when size() > 0. The simulator stops on a null object access; the message text is tool-specific and names no UVM component.",
      edge: "call",
      token: { label: "null", tone: "error" },
      codeKey: "gni",
      outcome: "fatal",
    });
    return { choice, connectLine, elaboration, steps, ending: "null-handle-at-get_next_item" };
  }
  steps.push(
    {
      id: "seq-start",
      phase: "run_phase",
      what: "The sequence calls start_item(req) and blocks, waiting for a grant.",
      why: "The sequencer grants a sequence only when the driver asks for an item. Nothing is pushed toward the driver.",
      edge: "sequence",
      token: { label: "wait grant", tone: "control" },
      codeKey: "seq-start",
    },
    {
      id: "gni",
      phase: "run_phase",
      what: "The driver calls seq_item_port.get_next_item(req). The call travels driver → sequencer, which grants the waiting sequence.",
      why: "The driver is the initiator: its port requires the interface and the sequencer's imp provides it. That is why the driver's port calls connect().",
      edge: "call",
      token: { label: "get_next_item()", tone: "control" },
      codeKey: "gni",
    },
    {
      id: "seq-finish",
      phase: "run_phase",
      what: "start_item() returns. The sequence randomizes req and calls finish_item(req), which hands req to the sequencer and blocks.",
      why: "finish_item() does not return until the driver says it is done with this item.",
      edge: "sequence",
      token: { label: "req", tone: "data" },
      codeKey: "seq-finish",
    },
    {
      id: "item",
      phase: "run_phase",
      what: "get_next_item() returns: req travels sequencer → driver as the task's output argument.",
      why: "In a pull connection the call goes one way and the data comes back the other way. Connection direction is not data direction.",
      edge: "item",
      token: { label: "req", tone: "data" },
      codeKey: "gni",
    },
    {
      id: "drive",
      phase: "run_phase",
      what: "The driver drives req onto the interface; simulation time passes.",
      why: "Only the driver touches pins. The sequence is still blocked inside finish_item().",
      edge: "pins",
      token: { label: "pins", tone: "data" },
      codeKey: "drive",
    },
    {
      id: "done",
      phase: "run_phase",
      what: "The driver calls seq_item_port.item_done(). finish_item() in the sequence returns.",
      why: "item_done() is another call from driver to sequencer. Without it the sequence never leaves finish_item().",
      edge: "call",
      token: { label: "item_done()", tone: "control" },
      codeKey: "done",
      outcome: "ok",
    },
  );
  return { choice, connectLine, elaboration, steps, ending: "handshake-completes" };
}

// ── Builder scenarios (topology, goals, reference solution, broken preset) ──

export type BuilderScenarioId = "agent" | "fifo" | "promotion" | "imp_decl";

export interface BuilderScenario {
  id: BuilderScenarioId;
  title: string;
  goal: string;
  topo: TlmTopology;
  goals: ReachGoal[];
  solution: TlmConnection[];
  /** A connect_phase with one realistic bug, for the debug mode. */
  broken: TlmConnection[];
}

const testRoot: TlmComponent = { id: "test", name: "uvm_test_top", parent: null, kind: "test", cls: "bus_test" };
const envNode: TlmComponent = { id: "env", name: "env", parent: "test", kind: "env", cls: "bus_env" };

export const TLM_BUILDER_SCENARIOS: BuilderScenario[] = [
  {
    id: "agent",
    title: "Inside an agent",
    goal: "In bus_agent, let the driver pull items from the sequencer and promote the monitor's ap to the agent's ap. In bus_env, send the agent's ap to the scoreboard.",
    topo: {
      components: [
        testRoot,
        envNode,
        { id: "agt", name: "agt", parent: "env", kind: "agent", cls: "bus_agent" },
        { id: "sqr", name: "sqr", parent: "agt", kind: "sequencer", cls: "bus_sequencer" },
        { id: "drv", name: "drv", parent: "agt", kind: "driver", cls: "bus_driver" },
        { id: "mon", name: "mon", parent: "agt", kind: "monitor", cls: "bus_monitor" },
        { id: "scb", name: "scb", parent: "env", kind: "scoreboard", cls: "bus_scoreboard" },
      ],
      endpoints: [
        seqItemPullImp("sqr", "bus_item", "bus_sequencer"),
        seqItemPullPort("drv", "bus_item"),
        analysisPort("mon", "ap", "bus_item"),
        analysisPort("agt", "ap", "bus_item"),
        analysisImp("scb", "item_imp", "bus_item", { ownerCls: "bus_scoreboard" }),
      ],
    },
    goals: [
      { from: "drv.seq_item_port", reaches: "sqr.seq_item_export" },
      { from: "mon.ap", reaches: "scb.item_imp" },
      { from: "agt.ap", reaches: "scb.item_imp" },
    ],
    solution: [
      { from: "drv.seq_item_port", to: "sqr.seq_item_export" },
      { from: "mon.ap", to: "agt.ap" },
      { from: "agt.ap", to: "scb.item_imp" },
    ],
    broken: [
      { from: "sqr.seq_item_export", to: "drv.seq_item_port" },
      { from: "mon.ap", to: "agt.ap" },
      { from: "agt.ap", to: "scb.item_imp" },
    ],
  },
  {
    id: "fifo",
    title: "Env with an analysis FIFO",
    goal: "In bus_env, send the agent's items to the analysis FIFO and to the coverage subscriber, and let the scoreboard pull items from the FIFO.",
    topo: {
      components: [
        testRoot,
        envNode,
        { id: "agt", name: "agt", parent: "env", kind: "agent", cls: "bus_agent" },
        { id: "fifo", name: "fifo", parent: "env", kind: "fifo", cls: "uvm_tlm_analysis_fifo #(bus_item)" },
        { id: "scb", name: "scb", parent: "env", kind: "scoreboard", cls: "bus_scoreboard" },
        { id: "cov", name: "cov", parent: "env", kind: "subscriber", cls: "bus_coverage" },
      ],
      endpoints: [
        analysisPort("agt", "ap", "bus_item"),
        ...analysisFifoEndpoints("fifo", "bus_item"),
        blockingGetPort("scb", "get_port", "bus_item"),
        analysisImp("cov", "analysis_export", "bus_item", { objName: "analysis_imp", ownerCls: "uvm_subscriber #(bus_item)" }),
      ],
    },
    goals: [
      { from: "agt.ap", reaches: "fifo.analysis_export" },
      { from: "agt.ap", reaches: "cov.analysis_export" },
      { from: "scb.get_port", reaches: "fifo.get_export" },
    ],
    solution: [
      { from: "agt.ap", to: "fifo.analysis_export" },
      { from: "agt.ap", to: "cov.analysis_export" },
      { from: "scb.get_port", to: "fifo.get_export" },
    ],
    broken: [
      { from: "agt.ap", to: "fifo.analysis_export" },
      { from: "agt.ap", to: "cov.analysis_export" },
    ],
  },
  {
    id: "promotion",
    title: "Promotion through two boundaries",
    goal: "Carry the monitor's items out of the agent and into the scoreboard that check_env hides inside it. Cross each boundary through that component's own port or export.",
    topo: {
      components: [
        testRoot,
        envNode,
        { id: "agt", name: "agt", parent: "env", kind: "agent", cls: "bus_agent" },
        { id: "mon", name: "mon", parent: "agt", kind: "monitor", cls: "bus_monitor" },
        { id: "chk_env", name: "chk_env", parent: "env", kind: "env", cls: "check_env" },
        { id: "scb", name: "scb", parent: "chk_env", kind: "scoreboard", cls: "bus_scoreboard" },
      ],
      endpoints: [
        analysisPort("mon", "ap", "bus_item"),
        analysisPort("agt", "ap", "bus_item"),
        analysisExport("chk_env", "analysis_export", "bus_item"),
        analysisImp("scb", "item_imp", "bus_item", { ownerCls: "bus_scoreboard" }),
      ],
    },
    goals: [
      { from: "mon.ap", reaches: "scb.item_imp" },
      { from: "agt.ap", reaches: "scb.item_imp" },
      { from: "chk_env.analysis_export", reaches: "scb.item_imp" },
    ],
    solution: [
      { from: "mon.ap", to: "agt.ap" },
      { from: "agt.ap", to: "chk_env.analysis_export" },
      { from: "chk_env.analysis_export", to: "scb.item_imp" },
    ],
    broken: [
      { from: "mon.ap", to: "agt.ap" },
      { from: "agt.ap", to: "chk_env.analysis_export" },
    ],
  },
  {
    id: "imp_decl",
    title: "Two-input scoreboard",
    goal: "The scoreboard declares two analysis imps with `uvm_analysis_imp_decl(_exp) and (_act). Connect the input-side agent to exp_imp and the output-side agent to act_imp.",
    topo: {
      components: [
        testRoot,
        envNode,
        { id: "in_agt", name: "in_agt", parent: "env", kind: "agent", cls: "bus_agent" },
        { id: "out_agt", name: "out_agt", parent: "env", kind: "agent", cls: "pkt_agent" },
        { id: "scb", name: "scb", parent: "env", kind: "scoreboard", cls: "bridge_scoreboard" },
      ],
      endpoints: [
        analysisPort("in_agt", "ap", "bus_item"),
        analysisPort("out_agt", "ap", "pkt_item"),
        analysisImp("scb", "exp_imp", "bus_item", { suffix: "_exp", ownerCls: "bridge_scoreboard" }),
        analysisImp("scb", "act_imp", "pkt_item", { suffix: "_act", ownerCls: "bridge_scoreboard" }),
      ],
    },
    goals: [
      { from: "in_agt.ap", reaches: "scb.exp_imp" },
      { from: "out_agt.ap", reaches: "scb.act_imp" },
    ],
    solution: [
      { from: "in_agt.ap", to: "scb.exp_imp" },
      { from: "out_agt.ap", to: "scb.act_imp" },
    ],
    broken: [
      { from: "in_agt.ap", to: "scb.act_imp" },
      { from: "out_agt.ap", to: "scb.exp_imp" },
    ],
  },
];

/** Class-member declarations for a scenario, generated from the endpoints. */
export function declarationSource(topo: TlmTopology): { owner: string; cls: string; lines: string[] }[] {
  const out: { owner: string; cls: string; lines: string[] }[] = [];
  for (const comp of topo.components) {
    const eps = topo.endpoints.filter((e) => e.owner === comp.id);
    if (eps.length === 0 || comp.kind === "fifo") continue;
    const macros: string[] = [];
    const lines: string[] = [];
    for (const ep of eps) {
      const suffix = ep.typeName.startsWith("uvm_analysis_imp_") ? ep.typeName.slice("uvm_analysis_imp".length) : "";
      if (suffix) macros.push(`\`uvm_analysis_imp_decl(${suffix})   // before the class`);
      const inherited = ep.handle === "seq_item_port" || ep.handle === "seq_item_export" || ep.objName === "analysis_imp";
      lines.push(`${ep.declaration} ${ep.handle};${inherited ? "   // inherited" : ""}`);
      if (ep.role === "imp" && ep.mask === TLM_MASK.ANALYSIS && !inherited) lines.push(`function void ${ep.implMethod}(${ep.txn} t); … endfunction`);
    }
    out.push({ owner: comp.id, cls: comp.cls, lines: [...macros, ...lines] });
  }
  return out;
}
