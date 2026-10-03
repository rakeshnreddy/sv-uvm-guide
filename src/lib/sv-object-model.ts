/**
 * Deterministic educational model of SystemVerilog class objects, handles,
 * copying, object lifetime and method dispatch (IEEE 1800-2023 Clause 8).
 *
 * Part 1 — heap model. A scenario is data: flat class declarations (ints, a
 * queue of ints, nested class handles, static ints), handle variables, and a
 * list of statements. `simulateHeap` executes it and returns a trace of full
 * snapshots, so stepping back restores the exact prior state.
 *   - §8.4  a class variable holds a handle; uninitialized handles are null;
 *           accessing a non-static member or a virtual method through a null
 *           handle is illegal (result indeterminate, implementations may
 *           issue an error). Static members stay accessible.
 *   - §8.7  `new` allocates, runs property initializers, then the constructor body.
 *   - §8.9  a static property exists once per class, shared by every object.
 *   - §8.12 `h2 = h1` copies the handle (one object, two names).
 *           `h2 = new h1` is a shallow copy: a new object of the source
 *           object's class, allocated WITHOUT running the constructor or any
 *           declaration initializer; every property is copied, and object
 *           handles are copied as handles (the nested object is shared).
 *   - §7.6  assigning a queue/dynamic array copies its elements, so a queue
 *           property is independent after a shallow copy.
 *   - §8.29 objects are reclaimed automatically; once no handle in an active
 *           scope can reach an object it is unreachable and eligible for
 *           reclamation. There is no explicit free.
 *   A user-written `copy()` (deep copy) is modelled as the code the model
 *   generates for it — a convention, not a language rule.
 *
 * Part 2 — dispatch model over a single-inheritance class table.
 *   - §8.14 through a base-class handle you see the base class's members;
 *           members added by a subclass are hidden.
 *   - §8.20 a virtual method call binds to the object's class (the latest
 *           override); a non-virtual call binds to the class visible from the
 *           handle's declared type. Once virtual, a method stays virtual in
 *           every subclass that overrides it, with or without the keyword.
 *   - §8.15 `super.m()` calls the implementation one level up, directly.
 *   - §8.16 / §6.24.2 upcasts are implicit; a direct downcast assignment is
 *           illegal; `$cast` succeeds only when the object is the destination
 *           class or a subclass of it. As a function it returns 0 on failure
 *           (no error, destination unchanged); as a task a failure is a
 *           run-time error (destination unchanged).
 *
 * Not modelled (on purpose): default argument values of overridden virtual
 * methods. §8.20 only requires the *presence* of a default to match; the
 * standard does not say which override's default expression a call through
 * a base handle uses, so the model asserts no rule.
 */

// ---------------------------------------------------------------------------
// Part 1 — heap model
// ---------------------------------------------------------------------------

export type FieldDecl =
  | { kind: "int"; name: string; init: number; isStatic?: boolean }
  | { kind: "handle"; name: string; className: string; init: "null" | "new" }
  | { kind: "intQueue"; name: string; init: number[] };

export interface HeapMethodDecl {
  name: string;
  /** Declared `virtual`. Calling a virtual method through null is illegal (§8.4). */
  isVirtual: boolean;
  /** Instance-member paths (relative to `this`) that the body prints with $display. */
  displays: string[];
}

export interface HeapClassDecl {
  name: string;
  fields: FieldDecl[];
  /** Static ints that a user-defined constructor increments (`count++;`). */
  ctorIncrements?: string[];
  /** Generate a user-written deep `copy(rhs)` method for this class. */
  hasCopy?: boolean;
  methods?: HeapMethodDecl[];
  /** Layout hint for views: 1 = top-level objects, 2 = nested objects. */
  column: number;
}

export interface HeapVarDecl {
  name: string;
  className: string;
  kind: "handle" | "handleQueue";
  /** Component that owns the variable (e.g. "monitor"), shown as a label. */
  owner?: string;
}

export type HeapStatement =
  | { id: string; kind: "new"; target: string }
  | { id: string; kind: "assign"; target: string; source: string | null }
  | { id: string; kind: "shallowCopy"; target: string; source: string }
  | { id: string; kind: "copyCall"; target: string; source: string }
  | { id: string; kind: "setInt"; target: string; value: number | number[]; rhsText?: string }
  | { id: string; kind: "pushInt"; target: string; value: number }
  | { id: string; kind: "pushHandle"; target: string; source: string }
  | { id: string; kind: "call"; target: string; method: string }
  | { id: string; kind: "display"; exprs: string[] }
  | { id: string; kind: "repeat"; count: number; body: HeapStatement[] };

export interface HeapScenario {
  id: string;
  title: string;
  classes: HeapClassDecl[];
  vars: HeapVarDecl[];
  statements: HeapStatement[];
}

export type FieldValue =
  | { kind: "int"; value: number }
  | { kind: "handle"; ref: string | null }
  | { kind: "intQueue"; items: number[] };

export interface HeapObject {
  /** Simulator-style object name, e.g. `packet@1`. */
  id: string;
  className: string;
  fields: Record<string, FieldValue>;
  /** How the object came to exist, in words. */
  origin: string;
  /** Reachable from some handle variable (§8.29). Unreachable objects are eligible for reclamation. */
  reachable: boolean;
}

export type VarValue = { kind: "handle"; ref: string | null } | { kind: "handleQueue"; refs: (string | null)[] };

export interface HeapState {
  /** Every object ever created, in creation order (unreachable ones stay listed, flagged). */
  objects: HeapObject[];
  vars: Record<string, VarValue>;
  /** Static properties keyed `class::field` (§8.9). */
  statics: Record<string, number>;
  log: string[];
}

export interface HeapTraceStep {
  index: number;
  /** Statement id; for loop bodies this is the body statement's id. */
  stmtId?: string;
  /** 1-based loop iteration when the statement sits inside `repeat`. */
  iteration?: number;
  source?: string;
  what: string;
  why: string;
  rule?: string;
  state: HeapState;
  /** Keys: `var:p1`, `obj:packet@1` (created), `field:packet@1.id`, `static:packet::count`. */
  changed: string[];
  created: string[];
  becameUnreachable: string[];
  error?: string;
}

export interface HeapRun {
  trace: HeapTraceStep[];
  final: HeapState;
  error?: string;
}

// --- helpers ---------------------------------------------------------------

const cloneState = (s: HeapState): HeapState => ({
  objects: s.objects.map((o) => ({
    ...o,
    fields: Object.fromEntries(
      Object.entries(o.fields).map(([k, v]) => [k, v.kind === "intQueue" ? { kind: "intQueue", items: [...v.items] } : { ...v }]),
    ) as Record<string, FieldValue>,
  })),
  vars: Object.fromEntries(
    Object.entries(s.vars).map(([k, v]) => [k, v.kind === "handleQueue" ? { kind: "handleQueue", refs: [...v.refs] } : { ...v }]),
  ) as Record<string, VarValue>,
  statics: { ...s.statics },
  log: [...s.log],
});

const classOf = (scenario: HeapScenario, name: string): HeapClassDecl => {
  const decl = scenario.classes.find((c) => c.name === name);
  if (!decl) throw new Error(`Unknown class ${name}`);
  return decl;
};

const instanceFields = (decl: HeapClassDecl) => decl.fields.filter((f) => !(f.kind === "int" && f.isStatic));

export const staticKey = (className: string, field: string) => `${className}::${field}`;

export const formatQueue = (items: number[]) => `'{${items.join(", ")}}`;

interface PathSeg {
  name: string;
  index?: number;
}

function parsePath(path: string): { staticClass?: string; segs: PathSeg[] } {
  const scope = path.match(/^(\w+)::(\w+)$/);
  if (scope) return { staticClass: scope[1], segs: [{ name: scope[2] }] };
  const segs = path.split(".").map((raw) => {
    const m = raw.match(/^(\w+)(?:\[(\d+)\])?$/);
    if (!m) throw new Error(`Bad path segment "${raw}" in ${path}`);
    return { name: m[1], index: m[2] === undefined ? undefined : Number(m[2]) };
  });
  return { segs };
}

type StaticType =
  | { kind: "handle"; className: string }
  | { kind: "handleQueue"; className: string }
  | { kind: "int" }
  | { kind: "intQueue" };

type Location =
  | { kind: "var"; name: string }
  | { kind: "queueElem"; name: string; index: number }
  | { kind: "field"; objId: string; field: string }
  | { kind: "static"; key: string };

type Resolution = { ok: true; loc: Location; type: StaticType } | { ok: false; error: string };

/** Declared (static) type of a path, independent of run-time values. Used for code generation. */
export function staticTypeOf(scenario: HeapScenario, path: string): StaticType {
  const { staticClass, segs } = parsePath(path);
  if (staticClass) return { kind: "int" };
  const v = scenario.vars.find((x) => x.name === segs[0].name);
  if (!v) throw new Error(`Unknown variable ${segs[0].name}`);
  let type: StaticType = v.kind === "handleQueue" && segs[0].index === undefined ? { kind: "handleQueue", className: v.className } : { kind: "handle", className: v.className };
  for (const seg of segs.slice(1)) {
    if (type.kind !== "handle") throw new Error(`Cannot select .${seg.name} in ${path}`);
    const field: FieldDecl | undefined = classOf(scenario, type.className).fields.find((f) => f.name === seg.name);
    if (!field) throw new Error(`No field ${seg.name} in ${type.className}`);
    type = field.kind === "handle" ? { kind: "handle", className: field.className } : field.kind === "intQueue" ? { kind: "intQueue" } : { kind: "int" };
  }
  return type;
}

class HeapMachine {
  state: HeapState;
  private counters: Record<string, number> = {};

  constructor(private scenario: HeapScenario) {
    const statics: Record<string, number> = {};
    // §8.9 / §10.5: static properties are initialized once, before any procedure runs.
    for (const c of scenario.classes) for (const f of c.fields) if (f.kind === "int" && f.isStatic) statics[staticKey(c.name, f.name)] = f.init;
    const vars: Record<string, VarValue> = {};
    // §8.4: an uninitialized class variable holds null.
    for (const v of scenario.vars) vars[v.name] = v.kind === "handleQueue" ? { kind: "handleQueue", refs: [] } : { kind: "handle", ref: null };
    this.state = { objects: [], vars, statics, log: [] };
  }

  obj(id: string): HeapObject {
    const o = this.state.objects.find((x) => x.id === id);
    if (!o) throw new Error(`No object ${id}`);
    return o;
  }

  private nextId(className: string) {
    this.counters[className] = (this.counters[className] ?? 0) + 1;
    return `${className}@${this.counters[className]}`;
  }

  /** §8.7: allocate, run property initializers (which may allocate nested objects), then the constructor body. */
  construct(className: string, origin: string): string {
    const decl = classOf(this.scenario, className);
    const id = this.nextId(className);
    const object: HeapObject = { id, className, fields: {}, origin, reachable: true };
    this.state.objects.push(object);
    for (const f of instanceFields(decl)) {
      if (f.kind === "int") object.fields[f.name] = { kind: "int", value: f.init };
      else if (f.kind === "intQueue") object.fields[f.name] = { kind: "intQueue", items: [...f.init] };
      else object.fields[f.name] = { kind: "handle", ref: f.init === "new" ? this.construct(f.className, `initializer \`${f.className} ${f.name} = new;\` of ${id}`) : null };
    }
    for (const s of decl.ctorIncrements ?? []) this.state.statics[staticKey(className, s)] += 1;
    return id;
  }

  /** §8.12 shallow copy: same class as the source object, no constructor, no initializers; handles copied as handles. */
  shallowCopy(srcId: string): string {
    const src = this.obj(srcId);
    const id = this.nextId(src.className);
    const fields: Record<string, FieldValue> = {};
    for (const [name, value] of Object.entries(src.fields)) {
      // §7.6: a queue assignment copies the elements into the target queue.
      fields[name] = value.kind === "intQueue" ? { kind: "intQueue", items: [...value.items] } : { ...value };
    }
    this.state.objects.push({ id, className: src.className, fields, origin: `shallow copy of ${srcId}`, reachable: true });
    return id;
  }

  /** The user-written copy() the model generates: values copied, nested objects copied recursively into the target's own objects. */
  deepCopyInto(dstId: string, srcId: string, seen = new Set<string>()) {
    if (seen.has(srcId)) return;
    seen.add(srcId);
    const dst = this.obj(dstId);
    const src = this.obj(srcId);
    for (const [name, value] of Object.entries(src.fields)) {
      if (value.kind === "int") dst.fields[name] = { kind: "int", value: value.value };
      else if (value.kind === "intQueue") dst.fields[name] = { kind: "intQueue", items: [...value.items] };
      else if (value.ref === null) dst.fields[name] = { kind: "handle", ref: null };
      else {
        const current = dst.fields[name];
        let target = current?.kind === "handle" ? current.ref : null;
        if (target === null) {
          const nested = this.obj(value.ref);
          target = this.construct(nested.className, `\`${name} = new;\` inside ${dstId}.copy()`);
          dst.fields[name] = { kind: "handle", ref: target };
        }
        this.deepCopyInto(target, value.ref, seen);
      }
    }
  }

  /** Resolve a path to a storage location, applying the §8.4 null-access rule along the way. */
  resolve(path: string): Resolution {
    const { staticClass, segs } = parsePath(path);
    if (staticClass) return { ok: true, loc: { kind: "static", key: staticKey(staticClass, segs[0].name) }, type: { kind: "int" } };
    const decl = this.scenario.vars.find((v) => v.name === segs[0].name);
    if (!decl) throw new Error(`Unknown variable ${segs[0].name}`);
    let loc: Location;
    let type: StaticType;
    if (decl.kind === "handleQueue") {
      if (segs[0].index === undefined) {
        loc = { kind: "var", name: decl.name };
        type = { kind: "handleQueue", className: decl.className };
      } else {
        const refs = (this.state.vars[decl.name] as { refs: (string | null)[] }).refs;
        if (segs[0].index >= refs.length) return { ok: false, error: `${decl.name}[${segs[0].index}] does not exist: the queue holds ${refs.length} handle${refs.length === 1 ? "" : "s"}.` };
        loc = { kind: "queueElem", name: decl.name, index: segs[0].index };
        type = { kind: "handle", className: decl.className };
      }
    } else {
      loc = { kind: "var", name: decl.name };
      type = { kind: "handle", className: decl.className };
    }
    let prefix = segs[0].index === undefined ? segs[0].name : `${segs[0].name}[${segs[0].index}]`;
    for (const seg of segs.slice(1)) {
      if (type.kind !== "handle") throw new Error(`Cannot select .${seg.name} in ${path}`);
      const field: FieldDecl | undefined = classOf(this.scenario, type.className).fields.find((f) => f.name === seg.name);
      if (!field) throw new Error(`No field ${seg.name} in ${type.className}`);
      if (field.kind === "int" && field.isStatic) {
        // §8.4 restricts only non-static members: a static property is reachable even through null.
        loc = { kind: "static", key: staticKey(type.className, field.name) };
        type = { kind: "int" };
      } else {
        const ref = this.readHandle(loc);
        if (ref === null) {
          return {
            ok: false,
            error: `${prefix} is null, so ${prefix}.${seg.name} does not exist. Accessing a non-static member through a null handle is illegal (§8.4); simulators stop with a null-object access error.`,
          };
        }
        loc = { kind: "field", objId: ref, field: field.name };
        type = field.kind === "handle" ? { kind: "handle", className: field.className } : field.kind === "intQueue" ? { kind: "intQueue" } : { kind: "int" };
      }
      prefix = `${prefix}.${seg.name}`;
    }
    return { ok: true, loc, type };
  }

  readHandle(loc: Location): string | null {
    if (loc.kind === "var") {
      const v = this.state.vars[loc.name];
      if (v.kind !== "handle") throw new Error(`${loc.name} is a queue`);
      return v.ref;
    }
    if (loc.kind === "queueElem") return (this.state.vars[loc.name] as { refs: (string | null)[] }).refs[loc.index];
    if (loc.kind === "field") {
      const f = this.obj(loc.objId).fields[loc.field];
      if (f.kind !== "handle") throw new Error(`${loc.field} is not a handle`);
      return f.ref;
    }
    throw new Error("A static int is not a handle");
  }

  writeHandle(loc: Location, ref: string | null) {
    if (loc.kind === "var") this.state.vars[loc.name] = { kind: "handle", ref };
    else if (loc.kind === "queueElem") (this.state.vars[loc.name] as { refs: (string | null)[] }).refs[loc.index] = ref;
    else if (loc.kind === "field") this.obj(loc.objId).fields[loc.field] = { kind: "handle", ref };
    else throw new Error("Cannot store a handle in a static int");
  }

  readValue(path: string): { ok: true; text: string; value: number | number[] | string | null } | { ok: false; error: string } {
    const r = this.resolve(path);
    if (!r.ok) return r;
    const { loc, type } = r;
    if (loc.kind === "static") {
      const v = this.state.statics[loc.key];
      return { ok: true, text: String(v), value: v };
    }
    if (type.kind === "int" && loc.kind === "field") {
      const f = this.obj(loc.objId).fields[loc.field] as { value: number };
      return { ok: true, text: String(f.value), value: f.value };
    }
    if (type.kind === "intQueue" && loc.kind === "field") {
      const f = this.obj(loc.objId).fields[loc.field] as { items: number[] };
      return { ok: true, text: formatQueue(f.items), value: [...f.items] };
    }
    if (type.kind === "handle") {
      const ref = this.readHandle(loc);
      return { ok: true, text: ref ?? "null", value: ref };
    }
    throw new Error(`Cannot read ${path}`);
  }

  /** §8.29: an object is reachable if a chain of handles leads to it from a variable in scope. */
  markReachability(): void {
    const reached = new Set<string>();
    const stack: string[] = [];
    for (const v of Object.values(this.state.vars)) {
      if (v.kind === "handle" && v.ref) stack.push(v.ref);
      if (v.kind === "handleQueue") v.refs.forEach((r) => r && stack.push(r));
    }
    while (stack.length) {
      const id = stack.pop() as string;
      if (reached.has(id)) continue;
      reached.add(id);
      for (const f of Object.values(this.obj(id).fields)) if (f.kind === "handle" && f.ref) stack.push(f.ref);
    }
    for (const o of this.state.objects) o.reachable = reached.has(o.id);
  }

  /** Objects that were reachable in `prev` and are unreachable now. */
  lostSince(prev: HeapState): string[] {
    this.markReachability();
    const wasReachable = new Set(prev.objects.filter((o) => o.reachable).map((o) => o.id));
    return this.state.objects.filter((o) => wasReachable.has(o.id) && !o.reachable).map((o) => o.id);
  }
}

/** Every access path (from a variable, through handle fields) that currently leads to the object. */
export function aliasesOf(state: HeapState, objId: string, maxDepth = 3): string[] {
  const out: string[] = [];
  const objects = new Map(state.objects.map((o) => [o.id, o]));
  const walk = (ref: string | null, path: string, depth: number) => {
    if (!ref || depth > maxDepth) return;
    if (ref === objId) out.push(path);
    const o = objects.get(ref);
    if (!o) return;
    for (const [name, f] of Object.entries(o.fields)) if (f.kind === "handle") walk(f.ref, `${path}.${name}`, depth + 1);
  };
  for (const [name, v] of Object.entries(state.vars)) {
    if (v.kind === "handle") walk(v.ref, name, 0);
    else v.refs.forEach((r, i) => walk(r, `${name}[${i}]`, 0));
  }
  return out;
}

function diffState(prev: HeapState, next: HeapState): string[] {
  const changed: string[] = [];
  for (const [name, v] of Object.entries(next.vars)) if (JSON.stringify(v) !== JSON.stringify(prev.vars[name])) changed.push(`var:${name}`);
  const prevObjects = new Map(prev.objects.map((o) => [o.id, o]));
  for (const o of next.objects) {
    const p = prevObjects.get(o.id);
    if (!p) {
      changed.push(`obj:${o.id}`);
      continue;
    }
    for (const [name, f] of Object.entries(o.fields)) if (JSON.stringify(f) !== JSON.stringify(p.fields[name])) changed.push(`field:${o.id}.${name}`);
  }
  for (const [k, v] of Object.entries(next.statics)) if (prev.statics[k] !== v) changed.push(`static:${k}`);
  return changed;
}

// --- source generation ------------------------------------------------------

export function statementSource(scenario: HeapScenario, s: HeapStatement): string {
  switch (s.kind) {
    case "new":
      return `${s.target} = new;`;
    case "assign":
      return `${s.target} = ${s.source ?? "null"};`;
    case "shallowCopy":
      return `${s.target} = new ${s.source};`;
    case "copyCall":
      return `${s.target}.copy(${s.source});`;
    case "setInt":
      return `${s.target} = ${s.rhsText ?? (Array.isArray(s.value) ? s.value[0] : s.value)};`;
    case "pushInt":
      return `${s.target}.push_back(${s.value});`;
    case "pushHandle":
      return `${s.target}.push_back(${s.source});`;
    case "call":
      return `${s.target}.${s.method}();`;
    case "display": {
      const spec = (e: string) => (staticTypeOf(scenario, e).kind === "intQueue" ? "%p" : "%0d");
      // One expression prints "name=value"; several print bare values, keeping lines short.
      const fmt = s.exprs.length === 1 ? `${s.exprs[0]}=${spec(s.exprs[0])}` : s.exprs.map(spec).join(" ");
      return `$display("${fmt}", ${s.exprs.join(", ")});`;
    }
    case "repeat":
      return `repeat (${s.count}) begin`;
    default:
      return "";
  }
}

export interface SourceLine {
  text: string;
  key?: string;
}

/** SystemVerilog declaration for one class, generated from the same data the model executes. */
export function classSourceLines(decl: HeapClassDecl): SourceLine[] {
  const k = (part: string) => `cls:${decl.name}:${part}`;
  const lines: SourceLine[] = [{ text: `class ${decl.name};`, key: k("head") }];
  for (const f of decl.fields) {
    if (f.kind === "int") lines.push({ text: `  ${f.isStatic ? "static " : ""}int ${f.name} = ${f.init};`, key: k(f.name) });
    else if (f.kind === "intQueue") lines.push({ text: `  int ${f.name}[$] = {${f.init.join(", ")}};`, key: k(f.name) });
    else lines.push({ text: `  ${f.className} ${f.name}${f.init === "new" ? " = new" : ""};`, key: k(f.name) });
  }
  if (decl.ctorIncrements?.length) {
    lines.push({ text: "  function new();", key: k("new") });
    decl.ctorIncrements.forEach((s) => lines.push({ text: `    ${s}++;`, key: k(`new:${s}`) }));
    lines.push({ text: "  endfunction", key: k("new:end") });
  }
  if (decl.hasCopy) {
    lines.push({ text: "  // user-written deep copy: a convention, not built in", key: k("copy:c") });
    lines.push({ text: `  function void copy(${decl.name} rhs);`, key: k("copy") });
    for (const f of instanceFields(decl)) {
      if (f.kind === "int") lines.push({ text: `    ${f.name} = rhs.${f.name};`, key: k(`copy:${f.name}`) });
      else if (f.kind === "intQueue") lines.push({ text: `    ${f.name} = rhs.${f.name};  // queue: elements copied`, key: k(`copy:${f.name}`) });
      else {
        lines.push({ text: `    if (rhs.${f.name} == null) ${f.name} = null;`, key: k(`copy:${f.name}:a`) });
        lines.push({ text: "    else begin", key: k(`copy:${f.name}:b`) });
        lines.push({ text: `      if (${f.name} == null) ${f.name} = new;`, key: k(`copy:${f.name}:c`) });
        lines.push({ text: `      ${f.name}.copy(rhs.${f.name});  // copy contents, not the handle`, key: k(`copy:${f.name}:d`) });
        lines.push({ text: "    end", key: k(`copy:${f.name}:e`) });
      }
    }
    lines.push({ text: "  endfunction", key: k("copy:end") });
  }
  for (const m of decl.methods ?? []) {
    lines.push({ text: `  ${m.isVirtual ? "virtual " : ""}function void ${m.name}();`, key: k(m.name) });
    const fmt = m.displays.map((d) => `${d}=%0d`).join(" ");
    lines.push({ text: `    $display("${fmt}", ${m.displays.join(", ")});`, key: k(`${m.name}:body`) });
    lines.push({ text: "  endfunction", key: k(`${m.name}:end`) });
  }
  lines.push({ text: "endclass", key: k("end") });
  return lines;
}

/** The test code (declarations plus one initial block), generated from the scenario data. */
export function scenarioCodeLines(scenario: HeapScenario): SourceLine[] {
  const lines: SourceLine[] = [];
  const groups = new Map<string, HeapVarDecl[]>();
  for (const v of scenario.vars) {
    const key = `${v.className}|${v.kind}|${v.owner ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }
  groups.forEach((vars) => {
    const v = vars[0];
    const names = vars.map((x) => (x.kind === "handleQueue" ? `${x.name}[$]` : x.name)).join(", ");
    lines.push({ text: `${v.className} ${names};${v.owner ? `  // ${v.owner}` : ""}`, key: `decl:${vars.map((x) => x.name).join(",")}` });
  });
  lines.push({ text: "initial begin", key: "initial" });
  const emit = (stmts: HeapStatement[], indent: string) => {
    for (const s of stmts) {
      lines.push({ text: `${indent}${statementSource(scenario, s)}`, key: s.id });
      if (s.kind === "repeat") {
        emit(s.body, `${indent}  `);
        lines.push({ text: `${indent}end`, key: `${s.id}:end` });
      }
    }
  };
  emit(scenario.statements, "  ");
  lines.push({ text: "end", key: "initial:end" });
  return lines;
}

// --- execution --------------------------------------------------------------

const describeRef = (ref: string | null) => ref ?? "null";

/** Run a heap scenario. The trace starts with the initial state and stops at the first run-time error. */
export function simulateHeap(scenario: HeapScenario): HeapRun {
  const m = new HeapMachine(scenario);
  const trace: HeapTraceStep[] = [];
  let error: string | undefined;

  const push = (step: Omit<HeapTraceStep, "index" | "state" | "changed" | "created" | "becameUnreachable">, prev: HeapState) => {
    const becameUnreachable = m.lostSince(prev);
    const state = cloneState(m.state);
    const changed = diffState(prev, state);
    trace.push({
      ...step,
      index: trace.length,
      state,
      changed,
      created: changed.filter((c) => c.startsWith("obj:")).map((c) => c.slice(4)),
      becameUnreachable,
    });
  };

  push(
    {
      what: "Before the first statement: every class variable holds null, and no object exists yet.",
      why: "Declaring a class variable creates a name for a handle, not an object; an uninitialized handle is null (§8.4, §8.12). Static properties already exist (§8.9).",
      rule: "§8.4",
    },
    cloneState(m.state),
  );

  const gcNote = (ids: string[]) =>
    ids.length
      ? ` ${ids.join(" and ")} ${ids.length === 1 ? "has" : "have"} no handle left: unreachable, so eligible for automatic reclamation (§8.29). There is no free/delete in SystemVerilog.`
      : "";

  const exec = (s: HeapStatement, iteration?: number): boolean => {
    if (s.kind === "repeat") {
      for (let i = 1; i <= s.count; i += 1) {
        for (const b of s.body) if (!exec(b, i)) return false;
      }
      return true;
    }
    const prev = cloneState(m.state);
    const source = statementSource(scenario, s);
    const base = { stmtId: s.id, iteration, source };
    const fail = (message: string) => {
      error = message;
      push({ ...base, what: `Run-time error at \`${source}\``, why: message, rule: "§8.4", error: message }, prev);
      return false;
    };

    switch (s.kind) {
      case "new": {
        const r = m.resolve(s.target);
        if (!r.ok) return fail(r.error);
        if (r.type.kind !== "handle") throw new Error(`${s.target} is not a handle`);
        const old = m.readHandle(r.loc);
        const id = m.construct(r.type.className, `\`${source}\``);
        m.writeHandle(r.loc, id);
        const decl = classOf(scenario, r.type.className);
        const nested = m.state.objects.filter((o) => !prev.objects.some((p) => p.id === o.id) && o.id !== id).map((o) => o.id);
        const ctor = decl.ctorIncrements?.length ? ` The constructor body then runs: ${decl.ctorIncrements.map((c) => `${decl.name}::${c}`).join(", ")} becomes ${decl.ctorIncrements.map((c) => m.state.statics[staticKey(decl.name, c)]).join(", ")}.` : "";
        const init = nested.length ? ` Its initializer also creates ${nested.join(", ")}.` : "";
        push(
          {
            ...base,
            what: `Creates ${id} and stores its handle in ${s.target}.${init}${ctor}${old ? ` ${s.target} no longer refers to ${old}.` : ""}`,
            why: `new allocates an object, initializes its properties, then runs the constructor (§8.7). ${s.target} holds only a handle to it (§8.4).${gcNote(m.lostSince(prev))}`,
            rule: "§8.7",
          },
          prev,
        );
        return true;
      }
      case "assign": {
        const t = m.resolve(s.target);
        if (!t.ok) return fail(t.error);
        let ref: string | null = null;
        if (s.source !== null) {
          const src = m.resolve(s.source);
          if (!src.ok) return fail(src.error);
          ref = m.readHandle(src.loc);
        }
        const old = m.readHandle(t.loc);
        m.writeHandle(t.loc, ref);
        const lost = m.lostSince(prev);
        if (s.source === null) {
          push(
            {
              ...base,
              what: `${s.target} is cleared to null.${old ? ` It no longer refers to ${old}.` : ""}`,
              why: `Assigning null drops one handle; the object itself is untouched while any other handle still reaches it.${gcNote(lost)}`,
              rule: lost.length ? "§8.29" : "§8.4",
            },
            prev,
          );
        } else {
          push(
            {
              ...base,
              what: `${s.target} now holds the same handle as ${s.source}: ${describeRef(ref)}. No object is created.`,
              why: `Handle assignment copies the reference, not the object, so ${s.target} and ${s.source} are two names for one object (§8.12).${gcNote(lost)}`,
              rule: "§8.12",
            },
            prev,
          );
        }
        return true;
      }
      case "shallowCopy": {
        const t = m.resolve(s.target);
        if (!t.ok) return fail(t.error);
        const src = m.resolve(s.source);
        if (!src.ok) return fail(src.error);
        const srcRef = m.readHandle(src.loc);
        if (srcRef === null) return fail(`${s.source} is null: there is no object to copy. A shallow copy needs an object handle (§8.12).`);
        const id = m.shallowCopy(srcRef);
        m.writeHandle(t.loc, id);
        const srcObj = m.obj(srcRef);
        const shared = Object.entries(srcObj.fields)
          .filter(([, f]) => f.kind === "handle" && f.ref)
          .map(([name, f]) => `${s.target}.${name} and ${s.source}.${name} both refer to ${(f as { ref: string }).ref}`);
        const queues = Object.entries(srcObj.fields).filter(([, f]) => f.kind === "intQueue").map(([name]) => name);
        push(
          {
            ...base,
            what: `Creates ${id}, a shallow copy of ${srcRef}. ${shared.length ? `${shared.join("; ")}.` : "It has no handle properties, so nothing is shared."}`,
            why: `A shallow copy allocates a new object without running the constructor or any initializer, then copies every property. Integers${queues.length ? " and queues" : ""} get their own copies${queues.length ? " (a queue assignment copies its elements, §7.6)" : ""}; handle properties are copied as handles, so nested objects are shared (§8.12).`,
            rule: "§8.12",
          },
          prev,
        );
        return true;
      }
      case "copyCall": {
        const t = m.resolve(s.target);
        if (!t.ok) return fail(t.error);
        const dst = m.readHandle(t.loc);
        if (dst === null) return fail(`${s.target} is null, so ${s.target}.copy() runs with no object behind it; its first member access is illegal (§8.4).`);
        const src = m.resolve(s.source);
        if (!src.ok) return fail(src.error);
        const srcRef = m.readHandle(src.loc);
        if (srcRef === null) return fail(`${s.source} is null; copy() reads rhs members through a null handle, which is illegal (§8.4).`);
        m.deepCopyInto(dst, srcRef);
        push(
          {
            ...base,
            what: `Runs the user-written copy(): ${dst} gets ${srcRef}'s values, and each nested object's contents are copied into ${dst}'s own nested object.`,
            why: "copy() is ordinary user code. Because it copies the nested object's contents instead of its handle, nothing is shared afterwards: a deep copy. The language gives you only the shallow copy (§8.12).",
            rule: "§8.12",
          },
          prev,
        );
        return true;
      }
      case "setInt": {
        const r = m.resolve(s.target);
        if (!r.ok) return fail(r.error);
        const value = Array.isArray(s.value) ? s.value[Math.max(0, (iteration ?? 1) - 1)] : s.value;
        if (r.loc.kind === "static") m.state.statics[r.loc.key] = value;
        else if (r.loc.kind === "field") m.obj(r.loc.objId).fields[r.loc.field] = { kind: "int", value };
        else throw new Error(`${s.target} is not an int`);
        const owner = r.loc.kind === "field" ? r.loc.objId : null;
        const through = s.target.slice(0, s.target.lastIndexOf("."));
        const others = owner ? aliasesOf(m.state, owner).filter((a) => a !== through) : [];
        const field = s.target.split(".").pop();
        push(
          {
            ...base,
            what: `${s.rhsText ? `${s.rhsText} returns ${value}; the statement writes` : "Writes"} ${value} into ${owner ? `${owner}.${field}` : s.target}${owner ? ` through ${through}` : ""}.`,
            why: owner
              ? others.length
                ? `${owner} is also reached through ${others.join(", ")}, so ${others.map((a) => `${a}.${field}`).join(" and ")} now read${others.length === 1 ? "s" : ""} ${value} too: one object, several names.`
                : `${owner} is reached only through ${through}; no other name sees this write.`
              : "A static property has one copy per class; every object sees the new value (§8.9).",
            rule: owner ? "§8.12" : "§8.9",
          },
          prev,
        );
        return true;
      }
      case "pushInt": {
        const r = m.resolve(s.target);
        if (!r.ok) return fail(r.error);
        if (r.loc.kind !== "field") throw new Error(`${s.target} is not a queue property`);
        const f = m.obj(r.loc.objId).fields[r.loc.field] as { kind: "intQueue"; items: number[] };
        f.items.push(s.value);
        push(
          {
            ...base,
            what: `Appends ${s.value} to ${r.loc.objId}.${r.loc.field}, which is now ${formatQueue(f.items)}.`,
            why: "A queue property is a value, like an int: each object holds its own elements, so this changes only this object's queue (§7.6, §8.12).",
            rule: "§7.6",
          },
          prev,
        );
        return true;
      }
      case "pushHandle": {
        const r = m.resolve(s.target);
        if (!r.ok) return fail(r.error);
        const src = m.resolve(s.source);
        if (!src.ok) return fail(src.error);
        const ref = m.readHandle(src.loc);
        const v = m.state.vars[s.target];
        if (v.kind !== "handleQueue") throw new Error(`${s.target} is not a queue of handles`);
        v.refs.push(ref);
        const holders = ref ? aliasesOf(m.state, ref) : [];
        push(
          {
            ...base,
            what: `Appends a copy of ${s.source}'s handle: ${s.target}[${v.refs.length - 1}] → ${describeRef(ref)}.`,
            why: ref
              ? `A queue of class handles stores handles. ${holders.length > 1 ? `${ref} is now reached through ${holders.join(", ")}: storing it did not snapshot its contents.` : "Storing it did not snapshot the object's contents."}`
              : "A null handle was stored.",
            rule: "§8.12",
          },
          prev,
        );
        return true;
      }
      case "call": {
        const r = m.resolve(s.target);
        if (!r.ok) return fail(r.error);
        if (r.type.kind !== "handle") throw new Error(`${s.target} is not a handle`);
        const method = classOf(scenario, r.type.className).methods?.find((x) => x.name === s.method);
        if (!method) throw new Error(`No method ${s.method}`);
        const ref = m.readHandle(r.loc);
        if (ref === null) {
          if (method.isVirtual) return fail(`${s.target} is null. Calling a virtual method through a null handle is illegal (§8.4): there is no object whose class could choose the implementation. Simulators stop with a null-object access error.`);
          if (method.displays.length) return fail(`${s.target} is null. ${s.method}() is not virtual, so the call starts, but its first access to an instance member is illegal (§8.4).`);
        }
        const parts: string[] = [];
        for (const d of method.displays) {
          const v = m.readValue(`${s.target}.${d}`);
          if (!v.ok) return fail(v.error);
          parts.push(`${d}=${v.text}`);
        }
        m.state.log.push(parts.join(" "));
        push({ ...base, what: `${s.target}.${s.method}() prints: ${parts.join(" ")}`, why: `The method runs on ${describeRef(ref)}, the object ${s.target} refers to.`, rule: "§8.6" }, prev);
        return true;
      }
      case "display": {
        const parts: string[] = [];
        for (const e of s.exprs) {
          const v = m.readValue(e);
          if (!v.ok) return fail(v.error);
          parts.push(s.exprs.length === 1 ? `${e}=${v.text}` : v.text);
        }
        m.state.log.push(parts.join(" "));
        const statics = s.exprs.filter((e) => {
          const r = m.resolve(e);
          return r.ok && r.loc.kind === "static";
        });
        const throughNull = statics.filter((e) => {
          if (e.includes("::")) return false;
          const prefix = m.resolve(e.slice(0, e.lastIndexOf(".")));
          return prefix.ok && m.readHandle(prefix.loc) === null;
        });
        push(
          {
            ...base,
            what: `Prints: ${parts.join(" ")}`,
            why: statics.length
              ? `${statics.join(" and ")} name${statics.length === 1 ? "s" : ""} the one class-wide static property (§8.9).${
                  throughNull.length
                    ? ` ${throughNull.join(", ")} goes through a null handle, and that is legal: a static property needs no object, and §8.4 forbids only non-static members and virtual methods.`
                    : ""
                }`
              : "Each name is followed handle by handle to the object that holds the value.",
            rule: statics.length ? "§8.9" : "§8.5",
          },
          prev,
        );
        return true;
      }
      default:
        return true;
    }
  };

  for (const s of scenario.statements) if (!exec(s)) break;
  return { trace, final: trace[trace.length - 1].state, error };
}

// --- presets ----------------------------------------------------------------

export const HEADER_CLASS: HeapClassDecl = {
  name: "header",
  column: 2,
  hasCopy: true,
  fields: [{ kind: "int", name: "len", init: 4 }],
};

export const PACKET_CLASS: HeapClassDecl = {
  name: "packet",
  column: 1,
  hasCopy: true,
  ctorIncrements: ["count"],
  fields: [
    { kind: "int", name: "count", init: 0, isStatic: true },
    { kind: "int", name: "id", init: 0 },
    { kind: "intQueue", name: "data", init: [1, 2] },
    { kind: "handle", name: "hdr", className: "header", init: "new" },
  ],
  methods: [{ name: "print", isVirtual: true, displays: ["id", "hdr.len"] }],
};

export type HeapScenarioId = "aliasing" | "shallow-copy" | "deep-copy" | "null-and-garbage" | "static-count";

export interface HeapGate {
  id: string;
  /** The statement the learner predicts the effect of. */
  stmtId: string;
  question: string;
  options: { id: string; label: string; correct: boolean; feedback: string }[];
}

export interface HeapPreset {
  id: HeapScenarioId;
  label: string;
  summary: string;
  build: () => HeapScenario;
  gates: HeapGate[];
}

const packetVars = (...names: string[]): HeapVarDecl[] => names.map((name) => ({ name, className: "packet", kind: "handle" }));
const packetClasses = () => [HEADER_CLASS, PACKET_CLASS];

export const heapPresets: HeapPreset[] = [
  {
    id: "aliasing",
    label: "p2 = p1",
    summary: "Handle assignment: two variables, one object.",
    build: () => ({
      id: "aliasing",
      title: "Two names, one object",
      classes: packetClasses(),
      vars: packetVars("p1", "p2"),
      statements: [
        { id: "a1", kind: "new", target: "p1" },
        { id: "a2", kind: "assign", target: "p2", source: "p1" },
        { id: "a3", kind: "setInt", target: "p2.id", value: 7 },
        { id: "a4", kind: "display", exprs: ["p1.id"] },
      ],
    }),
    gates: [
      {
        id: "objects-after-assign",
        stmtId: "a2",
        question: "After p2 = p1; how many packet objects exist?",
        options: [
          { id: "one", label: "One. p1 and p2 hold the same handle.", correct: true, feedback: "Handle assignment copies the arrow, not the box (§8.12). new ran once, so one packet exists." },
          { id: "two", label: "Two. p2 gets its own copy of p1's object.", correct: false, feedback: "That is what new p1 does. Plain assignment copies only the handle, so no object is created." },
          { id: "zero", label: "Zero. Assignment moves the object, so p1 becomes null.", correct: false, feedback: "Nothing is moved: p1 keeps its handle and p2 receives a copy of it." },
        ],
      },
      {
        id: "read-through-alias",
        stmtId: "a3",
        question: "After p2.id = 7; what does p1.id read?",
        options: [
          { id: "seven", label: "7", correct: true, feedback: "p1 and p2 refer to the same packet, so a write through either name is visible through the other." },
          { id: "zero", label: "0 (its initial value)", correct: false, feedback: "That would need two objects. p2 = p1 created none; both names reach the one packet." },
          { id: "x", label: "X, because two handles write the same object", correct: false, feedback: "Handles are not drivers. One object holds one id, and the last write wins." },
        ],
      },
    ],
  },
  {
    id: "shallow-copy",
    label: "p2 = new p1",
    summary: "Shallow copy: values copied, nested object shared.",
    build: () => ({
      id: "shallow-copy",
      title: "Shallow copy shares the nested header",
      classes: packetClasses(),
      vars: packetVars("p1", "p2"),
      statements: [
        { id: "s1", kind: "new", target: "p1" },
        { id: "s2", kind: "setInt", target: "p1.id", value: 5 },
        { id: "s3", kind: "shallowCopy", target: "p2", source: "p1" },
        { id: "s4", kind: "pushInt", target: "p2.data", value: 3 },
        { id: "s5", kind: "setInt", target: "p2.hdr.len", value: 9 },
        { id: "s6", kind: "display", exprs: ["p1.data"] },
        { id: "s7", kind: "display", exprs: ["p1.hdr.len"] },
      ],
    }),
    gates: [
      {
        id: "queue-after-shallow",
        stmtId: "s4",
        question: "After p2.data.push_back(3); what is p1.data?",
        options: [
          { id: "same", label: "'{1, 2}: p1 keeps its own queue", correct: true, feedback: "The shallow copy copied the queue's elements (§7.6, §8.12). A queue is a value, like an int, so the two packets have separate queues." },
          { id: "shared", label: "'{1, 2, 3}: the queue is shared", correct: false, feedback: "Only class handles are shared by a shallow copy. A queue property is copied element by element." },
          { id: "empty", label: "'{}: shallow copy leaves queues empty", correct: false, feedback: "Every property is copied. The constructor and initializers are skipped, but the values come from the source object." },
        ],
      },
      {
        id: "nested-after-shallow",
        stmtId: "s5",
        question: "After p2.hdr.len = 9; what is p1.hdr.len?",
        options: [
          { id: "nine", label: "9", correct: true, feedback: "new p1 copied the hdr handle, not the header object, so p1.hdr and p2.hdr are one header (§8.12)." },
          { id: "four", label: "4: p2 has its own header", correct: false, feedback: "A shallow copy never creates nested objects, even when the class declares header hdr = new; (§8.12). That needs a deep copy." },
          { id: "error", label: "Null-access error: p2.hdr was never constructed", correct: false, feedback: "p2.hdr is not null: it holds the same handle as p1.hdr." },
        ],
      },
    ],
  },
  {
    id: "deep-copy",
    label: "p3.copy(p1)",
    summary: "A user-written deep copy: nothing shared.",
    build: () => ({
      id: "deep-copy",
      title: "Deep copy duplicates the nested header",
      classes: packetClasses(),
      vars: packetVars("p1", "p3"),
      statements: [
        { id: "d1", kind: "new", target: "p1" },
        { id: "d2", kind: "setInt", target: "p1.hdr.len", value: 9 },
        { id: "d3", kind: "new", target: "p3" },
        { id: "d4", kind: "copyCall", target: "p3", source: "p1" },
        { id: "d5", kind: "setInt", target: "p3.hdr.len", value: 2 },
        { id: "d6", kind: "display", exprs: ["p1.hdr.len"] },
        { id: "d7", kind: "display", exprs: ["p3.hdr.len"] },
      ],
    }),
    gates: [
      {
        id: "header-after-copy",
        stmtId: "d4",
        question: "After p3.copy(p1); which header does p3.hdr refer to?",
        options: [
          { id: "own", label: "Its own header (created by p3 = new), now holding len = 9", correct: true, feedback: "copy() calls hdr.copy(rhs.hdr): it copies the header's contents into p3's existing header. The handles stay different." },
          { id: "p1s", label: "p1's header, because copy() copies every property", correct: false, feedback: "That is what a shallow copy or hdr = rhs.hdr would do. This copy() copies the header's contents instead." },
          { id: "null", label: "null, because copy() does not create objects", correct: false, feedback: "p3 = new already ran the initializer header hdr = new; and copy() keeps that object." },
        ],
      },
      {
        id: "independent-after-copy",
        stmtId: "d5",
        question: "After p3.hdr.len = 2; what is p1.hdr.len?",
        options: [
          { id: "nine", label: "9", correct: true, feedback: "The deep copy gave p3 its own header, so writes through p3 cannot reach p1's." },
          { id: "two", label: "2", correct: false, feedback: "That would need p1.hdr and p3.hdr to be one object. After a deep copy they are two." },
          { id: "four", label: "4", correct: false, feedback: "p1.hdr.len was set to 9 before the copy, and nothing has changed it since." },
        ],
      },
    ],
  },
  {
    id: "null-and-garbage",
    label: "null & garbage",
    summary: "Dropping handles; calling through null.",
    build: () => ({
      id: "null-and-garbage",
      title: "When the last handle goes, the object goes",
      classes: packetClasses(),
      vars: packetVars("p1", "p2"),
      statements: [
        { id: "n1", kind: "new", target: "p1" },
        { id: "n2", kind: "new", target: "p2" },
        { id: "n3", kind: "assign", target: "p1", source: "p2" },
        { id: "n4", kind: "assign", target: "p2", source: null },
        { id: "n5", kind: "assign", target: "p1", source: null },
        { id: "n6", kind: "call", target: "p1", method: "print" },
      ],
    }),
    gates: [
      {
        id: "orphan",
        stmtId: "n3",
        question: "After p1 = p2; what happens to the first packet (packet@1)?",
        options: [
          { id: "gc", label: "No handle reaches it, so it is eligible for automatic reclamation", correct: true, feedback: "SystemVerilog reclaims unreachable objects automatically (§8.29). Its header goes with it: nothing else reaches header@1." },
          { id: "leak", label: "It leaks until the test calls delete on it", correct: false, feedback: "SystemVerilog has no delete or free for objects. Memory management is automatic (§8.29)." },
          { id: "copied", label: "p2's packet is copied into it", correct: false, feedback: "Assignment copies handles. p1 now refers to packet@2; packet@1 is untouched but unreachable." },
        ],
      },
      {
        id: "null-call",
        stmtId: "n6",
        question: "p1 is now null. What does p1.print(); do?",
        options: [
          { id: "error", label: "Run-time error: null-object access", correct: true, feedback: "print() is virtual and reads id. Both are illegal through a null handle (§8.4); simulators stop with a null-object access error." },
          { id: "zeros", label: "Prints id=0 hdr.len=0", correct: false, feedback: "There is no object, so there are no default values to print." },
          { id: "last", label: "Prints the values of the last object p1 referred to", correct: false, feedback: "A null handle remembers nothing. The old packet is unreachable." },
          { id: "compile", label: "Compile error", correct: false, feedback: "The compiler cannot know p1 will be null. The failure happens at run time." },
        ],
      },
    ],
  },
  {
    id: "static-count",
    label: "static count",
    summary: "One static per class; shallow copy skips new().",
    build: () => ({
      id: "static-count",
      title: "A static counter is one box for the whole class",
      classes: packetClasses(),
      vars: packetVars("p1", "p2", "p3"),
      statements: [
        { id: "c1", kind: "new", target: "p1" },
        { id: "c2", kind: "new", target: "p2" },
        { id: "c3", kind: "shallowCopy", target: "p3", source: "p1" },
        { id: "c4", kind: "display", exprs: ["packet::count"] },
        { id: "c4b", kind: "display", exprs: ["p2.count"] },
        { id: "c5", kind: "assign", target: "p1", source: null },
        { id: "c6", kind: "display", exprs: ["p1.count"] },
      ],
    }),
    gates: [
      {
        id: "count-after-copy",
        stmtId: "c3",
        question: "Three packets exist after p3 = new p1; what is packet::count?",
        options: [
          { id: "two", label: "2", correct: true, feedback: "A shallow copy allocates without calling new(), so count++ ran only for p1 and p2 (§8.12)." },
          { id: "three", label: "3", correct: false, feedback: "That assumes every object runs the constructor. new p1 skips it (§8.12)." },
          { id: "one", label: "1, because each object has its own count", correct: false, feedback: "count is static: one copy for the class, shared by every packet (§8.9)." },
        ],
      },
      {
        id: "static-through-null",
        stmtId: "c6",
        question: "p1 is null. What does $display(p1.count) do?",
        options: [
          { id: "prints", label: "Prints 2", correct: true, feedback: "count is static, so it belongs to the class, not an object. §8.4 forbids only non-static members and virtual methods through null." },
          { id: "error", label: "Null-object access error", correct: false, feedback: "That holds for instance members like p1.id. A static property needs no object (§8.4, §8.9)." },
          { id: "zero", label: "Prints 0", correct: false, feedback: "There is one count for the class and the constructor has incremented it twice." },
        ],
      },
    ],
  },
];

export const getHeapPreset = (id: HeapScenarioId) => heapPresets.find((p) => p.id === id) ?? heapPresets[0];

// --- the "stored handle" scoreboard bug ---------------------------------------

export const TXN_CLASS: HeapClassDecl = { name: "txn", column: 1, fields: [{ kind: "int", name: "data", init: 0 }] };

export const MONITOR_SAMPLES = [3, 5, 9];

export type MonitorVariant = "buggy" | "new-in-loop" | "copy-before-store" | "alias-before-store" | "null-after-store";

/** The monitor loop that stores expected items, in its buggy form and four candidate fixes. */
export function monitorScenario(variant: MonitorVariant): HeapScenario {
  const vars: HeapVarDecl[] = [
    { name: "t", className: "txn", kind: "handle", owner: "monitor" },
    ...(variant === "copy-before-store" || variant === "alias-before-store" ? [{ name: "c", className: "txn", kind: "handle" as const, owner: "monitor" }] : []),
    { name: "exp_q", className: "txn", kind: "handleQueue", owner: "scoreboard" },
  ];
  const sample: HeapStatement = { id: "m2", kind: "setInt", target: "t.data", value: MONITOR_SAMPLES, rhsText: "bus_sample()" };
  const body: HeapStatement[] =
    variant === "new-in-loop"
      ? [{ id: "m1", kind: "new", target: "t" }, sample, { id: "m3", kind: "pushHandle", target: "exp_q", source: "t" }]
      : variant === "copy-before-store"
        ? [sample, { id: "m4", kind: "shallowCopy", target: "c", source: "t" }, { id: "m3", kind: "pushHandle", target: "exp_q", source: "c" }]
        : variant === "alias-before-store"
          ? [sample, { id: "m4", kind: "assign", target: "c", source: "t" }, { id: "m3", kind: "pushHandle", target: "exp_q", source: "c" }]
          : variant === "null-after-store"
            ? [sample, { id: "m3", kind: "pushHandle", target: "exp_q", source: "t" }, { id: "m5", kind: "assign", target: "t", source: null }]
            : [sample, { id: "m3", kind: "pushHandle", target: "exp_q", source: "t" }];
  return {
    id: `monitor-${variant}`,
    title: "Monitor stores expected items",
    classes: [TXN_CLASS],
    vars,
    statements: [
      ...(variant === "new-in-loop" ? [] : [{ id: "m1", kind: "new", target: "t" } as HeapStatement]),
      { id: "loop", kind: "repeat", count: MONITOR_SAMPLES.length, body },
      { id: "m6", kind: "display", exprs: MONITOR_SAMPLES.map((_, i) => `exp_q[${i}].data`) },
    ],
  };
}

export interface ScoreboardVerdict {
  run: HeapRun;
  /** data values the scoreboard will read back from exp_q, or null on a run-time error. */
  stored: number[] | null;
  distinctObjects: number;
  pass: boolean;
}

/** Run a monitor variant and grade it: the stored items must still read 3, 5, 9. */
export function gradeMonitor(variant: MonitorVariant): ScoreboardVerdict {
  const run = simulateHeap(monitorScenario(variant));
  const q = run.final.vars.exp_q;
  const refs = q.kind === "handleQueue" ? q.refs : [];
  const stored = run.error
    ? null
    : refs.map((r) => {
        const o = run.final.objects.find((x) => x.id === r);
        const f = o?.fields.data;
        return f && f.kind === "int" ? f.value : NaN;
      });
  const distinctObjects = new Set(refs.filter(Boolean)).size;
  const pass = stored !== null && stored.length === MONITOR_SAMPLES.length && stored.every((v, i) => v === MONITOR_SAMPLES[i]);
  return { run, stored, distinctObjects, pass };
}

// ---------------------------------------------------------------------------
// Part 2 — dispatch and casting
// ---------------------------------------------------------------------------

export interface DispatchMethodDecl {
  name: string;
  /** Written with the `virtual` keyword in this class. */
  isVirtual: boolean;
  /** Body starts with super.<name>(). */
  callsSuper?: boolean;
  /** What the body prints. */
  output: string;
}

export interface DispatchClassDecl {
  name: string;
  extends?: string;
  methods: DispatchMethodDecl[];
}

export type ClassTable = DispatchClassDecl[];

const lookup = (table: ClassTable, name: string) => {
  const c = table.find((x) => x.name === name);
  if (!c) throw new Error(`Unknown class ${name}`);
  return c;
};

/** [cls, parent, grandparent, …] */
export function ancestry(table: ClassTable, cls: string): string[] {
  const out: string[] = [];
  let cur: string | undefined = cls;
  while (cur) {
    out.push(cur);
    cur = lookup(table, cur).extends;
  }
  return out;
}

/** Reflexive: a class is a subclass of itself. */
export const isSubclassOf = (table: ClassTable, sub: string, sup: string) => ancestry(table, sub).includes(sup);

/** Nearest class, starting at `cls` and walking up, that declares `method`. */
export function findDeclaringClass(table: ClassTable, cls: string, method: string): string | null {
  return ancestry(table, cls).find((c) => lookup(table, c).methods.some((m) => m.name === method)) ?? null;
}

/** §8.20: a method is virtual as seen from `cls` if any declaration at or above `cls` says `virtual`. */
export function isVirtualFrom(table: ClassTable, cls: string, method: string): boolean {
  return ancestry(table, cls).some((c) => lookup(table, c).methods.some((m) => m.name === method && m.isVirtual));
}

/** Rewrite the table so `method` is first declared virtual in `origin` (or nowhere). */
export function withVirtualOrigin(table: ClassTable, method: string, origin: string | null): ClassTable {
  return table.map((c) => ({ ...c, methods: c.methods.map((m) => (m.name === method ? { ...m, isVirtual: c.name === origin } : m)) }));
}

export interface CallConfig {
  handleType: string;
  objectType: string;
  method: string;
}

export type CallResult =
  | { kind: "compile-error"; stage: "assignment" | "call"; reason: string; rule: string }
  | {
      kind: "ok";
      binding: "static" | "dynamic";
      /** Class whose declaration the compiler sees from the handle type. */
      declaredIn: string;
      /** Class whose body runs first (the one the call binds to). */
      implementation: string;
      /** Every body that executes, outermost-first in print order (super calls first). */
      executed: string[];
      output: string[];
      why: string;
      rule: string;
    };

/** Which method body runs for `h.method()` when `h` (declared handleType) refers to an objectType object. */
export function resolveCall(table: ClassTable, { handleType, objectType, method }: CallConfig): CallResult {
  if (!isSubclassOf(table, objectType, handleType)) {
    return {
      kind: "compile-error",
      stage: "assignment",
      reason: `A ${handleType} handle cannot refer to a ${objectType} object: ${objectType} is a base class of ${handleType}. Assigning base to derived is illegal without $cast (§8.16).`,
      rule: "§8.16",
    };
  }
  const declaredIn = findDeclaringClass(table, handleType, method);
  if (!declaredIn) {
    return {
      kind: "compile-error",
      stage: "call",
      reason: `${handleType} has no method ${method}(). The compiler checks the handle's declared type, not the object; members added by a subclass are hidden from a base handle (§8.14). Cast to the subclass first.`,
      rule: "§8.14",
    };
  }
  const dynamic = isVirtualFrom(table, declaredIn, method);
  const implementation = dynamic ? (findDeclaringClass(table, objectType, method) as string) : declaredIn;
  const executed: string[] = [];
  const output: string[] = [];
  const run = (cls: string) => {
    const decl = lookup(table, cls).methods.find((m) => m.name === method);
    if (!decl) return;
    const parent = lookup(table, cls).extends;
    if (decl.callsSuper && parent) {
      // §8.15: super.m() calls the implementation one level up, statically.
      const up = findDeclaringClass(table, parent, method);
      if (up) run(up);
    }
    executed.push(cls);
    output.push(decl.output);
  };
  run(implementation);
  const virtualAt = ancestry(table, declaredIn).reverse().find((c) => lookup(table, c).methods.some((m) => m.name === method && m.isVirtual));
  const why = dynamic
    ? `${method}() is virtual (first declared virtual in ${virtualAt}), so the call binds at run time to the object's class: ${objectType} uses ${implementation}::${method}() (§8.20).`
    : `${method}() is not virtual as seen from ${handleType}, so the compiler binds the call to the declaration it sees from the handle type: ${declaredIn}::${method}(). The object's class is ignored (§8.14, §8.20).`;
  const superNote = executed.length > 1 ? ` Each body starts with super.${method}(), which calls the version one level up directly (§8.15).` : "";
  return { kind: "ok", binding: dynamic ? "dynamic" : "static", declaredIn, implementation, executed, output, why: why + superNote, rule: dynamic ? "§8.20" : "§8.14" };
}

export type CastForm = "function" | "task" | "assign";

export interface CastConfig {
  srcType: string;
  objectType: string;
  dstType: string;
  form: CastForm;
}

export interface CastResult {
  /** The setup line `src = objectType::new();` is legal. */
  setupLegal: boolean;
  compiles: boolean;
  assigned: boolean;
  /** Return value of the function form. */
  returns?: 0 | 1;
  runtimeError: boolean;
  direction: "same" | "up" | "down" | "unrelated";
  why: string;
  rule: string;
}

/** §8.16 / §6.24.2: direct assignment vs $cast as a function or task. */
export function castOutcome(table: ClassTable, { srcType, objectType, dstType, form }: CastConfig): CastResult {
  const direction = srcType === dstType ? "same" : isSubclassOf(table, srcType, dstType) ? "up" : isSubclassOf(table, dstType, srcType) ? "down" : "unrelated";
  if (!isSubclassOf(table, objectType, srcType)) {
    return {
      setupLegal: false,
      compiles: false,
      assigned: false,
      runtimeError: false,
      direction,
      why: `A ${srcType} variable cannot hold a ${objectType} object in the first place (§8.16).`,
      rule: "§8.16",
    };
  }
  const fits = isSubclassOf(table, objectType, dstType);
  if (form === "assign") {
    const legal = direction === "same" || direction === "up";
    return {
      setupLegal: true,
      compiles: legal,
      assigned: legal,
      runtimeError: false,
      direction,
      why: legal
        ? `Assigning a ${srcType} handle to a ${dstType} variable is always legal: every ${srcType} is a ${dstType}. No cast is needed (§8.16).`
        : `The compiler only knows src is a ${srcType}. Assigning a ${direction === "down" ? "superclass" : "unrelated"} handle to a ${dstType} variable is illegal, whatever the object really is (§8.16). Use $cast.`,
      rule: "§8.16",
    };
  }
  const objectNote = `The object is a ${objectType}, which ${fits ? "is" : "is not"} a ${dstType}${fits && objectType !== dstType ? " (a subclass counts)" : ""}.`;
  if (form === "function") {
    return {
      setupLegal: true,
      compiles: true,
      assigned: fits,
      returns: fits ? 1 : 0,
      runtimeError: false,
      direction,
      why: fits
        ? `${objectNote} $cast performs the assignment and returns 1 (§8.16).`
        : `${objectNote} As a function, $cast returns 0, leaves dst unchanged and reports no error, so your code must check it (§6.24.2).`,
      rule: fits ? "§8.16" : "§6.24.2",
    };
  }
  return {
    setupLegal: true,
    compiles: true,
    assigned: fits,
    runtimeError: !fits,
    direction,
    why: fits
      ? `${objectNote} The task form performs the assignment (§8.16).`
      : `${objectNote} Called as a task, a failed $cast is a run-time error and dst is left unchanged (§6.24.2).`,
    rule: fits ? "§8.16" : "§6.24.2",
  };
}

/** The three-level transaction hierarchy used by the dispatch explorer. */
export const TXN_HIERARCHY: ClassTable = [
  {
    name: "base_txn",
    methods: [
      { name: "describe", isVirtual: true, output: "I am a base_txn" },
      { name: "print", isVirtual: true, output: "addr=0x10" },
    ],
  },
  {
    name: "crc_txn",
    extends: "base_txn",
    methods: [
      { name: "describe", isVirtual: false, output: "I am a crc_txn" },
      { name: "print", isVirtual: false, callsSuper: true, output: "crc=0x5a" },
    ],
  },
  {
    name: "bad_crc_txn",
    extends: "crc_txn",
    methods: [
      { name: "describe", isVirtual: false, output: "I am a bad_crc_txn" },
      { name: "print", isVirtual: false, callsSuper: true, output: "(crc deliberately wrong)" },
      { name: "corrupt", isVirtual: false, output: "crc flipped" },
    ],
  },
];

/** Generated class declarations for a dispatch table; keys `cls:<class>:<method>`. */
export function dispatchClassLines(table: ClassTable): SourceLine[] {
  const lines: SourceLine[] = [];
  for (const c of table) {
    lines.push({ text: `class ${c.name}${c.extends ? ` extends ${c.extends}` : ""};`, key: `cls:${c.name}` });
    for (const m of c.methods) {
      const inherited = !m.isVirtual && c.extends && isVirtualFrom(table, c.extends, m.name);
      lines.push({ text: `  ${m.isVirtual ? "virtual " : ""}function void ${m.name}();${inherited ? "  // still virtual" : ""}`, key: `cls:${c.name}:${m.name}` });
      if (m.callsSuper) lines.push({ text: `    super.${m.name}();`, key: `cls:${c.name}:${m.name}:super` });
      lines.push({ text: `    $display("${m.output}");`, key: `cls:${c.name}:${m.name}:body` });
      lines.push({ text: "  endfunction", key: `cls:${c.name}:${m.name}:end` });
    }
    lines.push({ text: "endclass", key: `cls:${c.name}:end` });
  }
  return lines;
}

/** Generated test code for one call configuration. */
export function dispatchCallLines({ handleType, objectType, method }: CallConfig): SourceLine[] {
  return [
    { text: `${handleType} h;`, key: "call:decl" },
    { text: "initial begin", key: "call:initial" },
    { text: handleType === objectType ? "  h = new;" : `  h = ${objectType}::new();  // §8.8`, key: "call:new" },
    { text: `  h.${method}();`, key: "call:call" },
    { text: "end", key: "call:end" },
  ];
}

/** Generated test code for one cast configuration. */
export function castLines({ srcType, objectType, dstType, form }: CastConfig): SourceLine[] {
  const body =
    form === "assign"
      ? [{ text: "  dst = src;", key: "cast:op" }]
      : form === "task"
        ? [{ text: "  $cast(dst, src);  // task form", key: "cast:op" }]
        : [
            { text: "  if ($cast(dst, src))  // function form", key: "cast:op" },
            { text: '    $display("cast ok");', key: "cast:ok" },
            { text: "  else", key: "cast:else" },
            { text: '    $display("not a ' + dstType + '");', key: "cast:fail" },
          ];
  return [
    { text: `${srcType} src;`, key: "cast:src" },
    { text: `${dstType} dst;`, key: "cast:dst" },
    { text: "initial begin", key: "cast:initial" },
    { text: srcType === objectType ? "  src = new;" : `  src = ${objectType}::new();`, key: "cast:new" },
    ...body,
    { text: "end", key: "cast:end" },
  ];
}
