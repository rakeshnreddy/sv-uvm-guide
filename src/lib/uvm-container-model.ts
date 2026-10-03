/**
 * Deterministic model of the UVM container classes uvm_pool #(KEY,T),
 * uvm_event_pool and uvm_queue #(T), next to native SystemVerilog containers.
 *
 * Rules checked against uvm-core 2020.3.1 (IEEE 1800.2-2020):
 *  - base/uvm_pool.svh (11.2): uvm_pool #(KEY,T) wraps `T pool[KEY]` and is type-safe.
 *    get_global_pool() returns one singleton per specialization. get(key) INSERTS the
 *    default value of T when the key is missing (0 for int, null for a class handle).
 *    exists() does not insert. delete() of a missing key warns POOLDEL and does nothing.
 *    do_copy (shallow: the array is copied, class handles are shared) and do_print exist;
 *    there is no do_compare, so compare() returns 1 whatever the contents.
 *  - uvm_object_string_pool #(T)::get() creates `new(key)` for a missing key;
 *    uvm_event_pool is uvm_object_string_pool #(uvm_event#(uvm_object)) (10.4.1).
 *  - base/uvm_queue.svh (11.3): wraps an SV queue `T queue[$]`. get(i) out of range warns
 *    QUEUEGET and returns the default without growing; insert(i,x) with i >= size() or
 *    i < 0 warns QUEUEINS and is ignored (so insert(size(), x) cannot append, unlike a
 *    native queue, IEEE 1800-2023 §7.10.2.2); delete(i) out of range warns QUEUEDEL;
 *    delete() with no index empties the queue. do_copy and convert2string ("%p") exist;
 *    no do_print (print() shows only the header) and no do_compare.
 *  - String-indexed associative arrays iterate in lexicographic order (§7.8.2).
 *  - pop_front() on an empty queue returns the default value and may warn (§7.10.2.4).
 */

export type ContainerType = "uvm_pool#(string,int)" | "uvm_pool#(string,uvm_event)" | "uvm_event_pool" | "uvm_queue#(int)";

export type PoolValue = { kind: "int"; value: number } | { kind: "null" } | { kind: "event"; name: string; objId: number; triggered: boolean };

export interface ContainerInstance {
  objId: number;
  type: ContainerType;
  name: string;
  /** Pools: key → value, kept sorted by key. */
  entries: [string, PoolValue][];
  /** Queues. */
  items: number[];
}

export interface World {
  objects: Record<number, ContainerInstance>;
  vars: Record<string, number | null>;
  /** get_global_pool() singletons, per specialization. */
  globals: Partial<Record<ContainerType, number>>;
  nextId: number;
}

export type ContainerStmt =
  | { kind: "new"; target: string; type: ContainerType; name: string }
  | { kind: "global"; target: string; type: ContainerType }
  | { kind: "add"; target: string; key: string; value: number }
  | { kind: "add-event"; target: string; key: string }
  | { kind: "get"; target: string; key: string; into?: string }
  | { kind: "get-trigger"; target: string; key: string }
  | { kind: "event-pool-get-global-trigger"; key: string }
  | { kind: "exists"; target: string; key: string }
  | { kind: "delete"; target: string; key: string }
  | { kind: "num"; target: string }
  | { kind: "same"; a: string; b: string }
  | { kind: "push_back"; target: string; value: number }
  | { kind: "push_front"; target: string; value: number }
  | { kind: "pop_front"; target: string }
  | { kind: "insert"; target: string; index: number | "size"; value: number }
  | { kind: "qget"; target: string; index: number }
  | { kind: "qdelete"; target: string; index?: number }
  | { kind: "compare"; a: string; b: string }
  | { kind: "print"; target: string }
  | { kind: "convert2string"; target: string };

export interface StmtResult {
  world: World;
  /** What the statement returned or displayed. */
  output: string;
  warning?: string;
  /** A run-stopping error (e.g. a null handle access). */
  fatal?: string;
  /** Did the statement change the container contents? */
  changed: boolean;
  why: string;
}

export function emptyWorld(): World {
  return { objects: {}, vars: {}, globals: {}, nextId: 1 };
}

function clone(world: World): World {
  const objects: Record<number, ContainerInstance> = {};
  for (const [k, o] of Object.entries(world.objects)) {
    objects[Number(k)] = { ...o, entries: o.entries.map(([key, v]) => [key, { ...v }] as [string, PoolValue]), items: [...o.items] };
  }
  return { objects, vars: { ...world.vars }, globals: { ...world.globals }, nextId: world.nextId };
}

function sortEntries(o: ContainerInstance) {
  o.entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function formatPoolValue(v: PoolValue | undefined): string {
  if (!v) return "—";
  if (v.kind === "int") return String(v.value);
  if (v.kind === "null") return "null";
  return `uvm_event@${v.objId} "${v.name}"${v.triggered ? " (triggered)" : ""}`;
}

export function stmtSource(s: ContainerStmt): string {
  switch (s.kind) {
    case "new":
      return s.type === "uvm_queue#(int)" ? `${s.target} = uvm_queue#(int)::type_id::create("${s.name}");` : `${s.target} = new("${s.name}");   // ${s.type}`;
    case "global":
      return `${s.target} = ${s.type}::get_global_pool();`;
    case "add":
      return `${s.target}.add("${s.key}", ${s.value});`;
    case "add-event":
      return `${s.target}.add("${s.key}", new("${s.key}"));`;
    case "get":
      return `${s.into ?? "n"} = ${s.target}.get("${s.key}");`;
    case "get-trigger":
      return `${s.target}.get("${s.key}").trigger();`;
    case "event-pool-get-global-trigger":
      return `uvm_event_pool::get_global("${s.key}").trigger();`;
    case "exists":
      return `$display(${s.target}.exists("${s.key}"));`;
    case "delete":
      return `${s.target}.delete("${s.key}");`;
    case "num":
      return `$display(${s.target}.num());`;
    case "same":
      return `$display(${s.a} == ${s.b});`;
    case "push_back":
      return `${s.target}.push_back(${s.value});`;
    case "push_front":
      return `${s.target}.push_front(${s.value});`;
    case "pop_front":
      return `x = ${s.target}.pop_front();`;
    case "insert":
      return `${s.target}.insert(${s.index === "size" ? `${s.target}.size()` : s.index}, ${s.value});`;
    case "qget":
      return `x = ${s.target}.get(${s.index});`;
    case "qdelete":
      return s.index === undefined ? `${s.target}.delete();` : `${s.target}.delete(${s.index});`;
    case "compare":
      return `$display(${s.a}.compare(${s.b}));`;
    case "print":
      return `${s.target}.print();`;
    case "convert2string":
      return `$display(${s.target}.convert2string());`;
  }
}

function defaultFor(type: ContainerType): PoolValue {
  return type === "uvm_pool#(string,int)" ? { kind: "int", value: 0 } : { kind: "null" };
}

function objOf(world: World, v: string): ContainerInstance | null {
  const id = world.vars[v];
  return id === undefined || id === null ? null : world.objects[id];
}

function nullFatal(world: World, target: string): StmtResult {
  return { world, output: "", fatal: `Null object access: ${target} is null (simulator run-time error).`, changed: false, why: `${target} was never assigned an object.` };
}

export function execStmt(input: World, s: ContainerStmt): StmtResult {
  const world = clone(input);
  const make = (type: ContainerType, name: string): number => {
    const objId = world.nextId++;
    world.objects[objId] = { objId, type, name, entries: [], items: [] };
    return objId;
  };

  switch (s.kind) {
    case "new": {
      world.vars[s.target] = make(s.type, s.name);
      return { world, output: `${s.target} → ${s.type}@${world.vars[s.target]}`, changed: true, why: "A new, empty container object." };
    }
    case "global": {
      let id = world.globals[s.type];
      const created = id === undefined;
      if (id === undefined) {
        id = make(s.type, "pool");
        world.globals[s.type] = id;
      }
      world.vars[s.target] = id;
      return {
        world,
        output: `${s.target} → ${s.type}@${id}`,
        changed: created,
        why: created
          ? `First call: get_global_pool() creates the singleton for ${s.type}.`
          : `Same specialization, same singleton: ${s.target} points at the existing ${s.type}@${id}.`,
      };
    }
    case "same": {
      const a = world.vars[s.a];
      const b = world.vars[s.b];
      return { world, output: a === b ? "1" : "0", changed: false, why: a === b ? "Both handles point at the same object." : "Different objects." };
    }
    case "event-pool-get-global-trigger": {
      let id = world.globals.uvm_event_pool;
      if (id === undefined) {
        id = make("uvm_event_pool", "global_pool");
        world.globals.uvm_event_pool = id;
      }
      const pool = world.objects[id];
      let entry = pool.entries.find(([k]) => k === s.key);
      let created = false;
      if (!entry) {
        entry = [s.key, { kind: "event", name: s.key, objId: world.nextId++, triggered: false }];
        pool.entries.push(entry);
        sortEntries(pool);
        created = true;
      }
      if (entry[1].kind === "event") entry[1].triggered = true;
      return {
        world,
        output: `triggered uvm_event "${s.key}"`,
        changed: true,
        why: created
          ? "uvm_event_pool::get() creates a uvm_event named after the key when it is missing, so the trigger always has an object."
          : "The event already exists in the global event pool.",
      };
    }
    default:
      break;
  }

  const target = "target" in s ? s.target : s.kind === "compare" ? s.a : "";
  const o = objOf(world, target);
  if (!o) return nullFatal(world, target);

  switch (s.kind) {
    case "add": {
      const existing = o.entries.find(([k]) => k === s.key);
      if (existing) existing[1] = { kind: "int", value: s.value };
      else o.entries.push([s.key, { kind: "int", value: s.value }]);
      sortEntries(o);
      return { world, output: "", changed: true, why: existing ? "add() overwrites an existing key." : "add() stores the pair." };
    }
    case "add-event": {
      const value: PoolValue = { kind: "event", name: s.key, objId: world.nextId++, triggered: false };
      const existing = o.entries.find(([k]) => k === s.key);
      if (existing) existing[1] = value;
      else o.entries.push([s.key, value]);
      sortEntries(o);
      return { world, output: "", changed: true, why: "add() stores the event handle." };
    }
    case "get":
    case "get-trigger": {
      let entry = o.entries.find(([k]) => k === s.key);
      let created = false;
      if (!entry) {
        const value: PoolValue = o.type === "uvm_event_pool" ? { kind: "event", name: s.key, objId: world.nextId++, triggered: false } : defaultFor(o.type);
        entry = [s.key, value];
        o.entries.push(entry);
        sortEntries(o);
        created = true;
      }
      const value = entry[1];
      if (s.kind === "get") {
        return {
          world,
          output: `${s.into ?? "n"} = ${formatPoolValue(value)}`,
          changed: created,
          why: created
            ? `"${s.key}" was missing, so get() inserted the default value (${formatPoolValue(value)}) and returned it. num() just grew by one.`
            : `get() returns the stored value for "${s.key}".`,
        };
      }
      if (value.kind !== "event") {
        return {
          world,
          output: "",
          fatal: `Null object access: ${s.target}.get("${s.key}") returned null and .trigger() was called on it.`,
          changed: created,
          why: `uvm_pool #(string,uvm_event)::get() inserts the default of a class type — null — for a missing key. Use uvm_event_pool, whose get() creates the event.`,
        };
      }
      value.triggered = true;
      return { world, output: `triggered uvm_event "${s.key}"`, changed: true, why: created ? "uvm_event_pool::get() created the event, then it was triggered." : "Triggered the stored event." };
    }
    case "exists": {
      const has = o.entries.some(([k]) => k === s.key);
      return { world, output: has ? "1" : "0", changed: false, why: "exists() only looks; unlike get(), it never inserts." };
    }
    case "delete": {
      const i = o.entries.findIndex(([k]) => k === s.key);
      if (i < 0) {
        const text = o.type === "uvm_event_pool" ? `delete: key '${s.key}' doesn't exist` : "delete: pool key doesn't exist. Ignoring delete request";
        return { world, output: "", warning: `UVM_WARNING [POOLDEL] ${text}`, changed: false, why: "Deleting a missing key is ignored with a warning." };
      }
      o.entries.splice(i, 1);
      return { world, output: "", changed: true, why: "Entry removed." };
    }
    case "num":
      return { world, output: String(o.entries.length), changed: false, why: "num() counts the keys stored, including ones get() inserted." };
    case "push_back":
      o.items.push(s.value);
      return { world, output: "", changed: true, why: "Appended." };
    case "push_front":
      o.items.unshift(s.value);
      return { world, output: "", changed: true, why: "Prepended." };
    case "pop_front": {
      if (o.items.length === 0) return { world, output: "x = 0", changed: false, why: "Empty queue: pop_front() returns the default value (IEEE 1800-2023 §7.10.2.4); the simulator may warn." };
      const v = o.items.shift() as number;
      return { world, output: `x = ${v}`, changed: true, why: "Removed and returned the first element." };
    }
    case "insert": {
      const index = s.index === "size" ? o.items.length : s.index;
      if (index >= o.items.length || index < 0) {
        return {
          world,
          output: "",
          warning: `UVM_WARNING [QUEUEINS] insert: given index out of range for queue of size ${o.items.length}. Ignoring insert request`,
          changed: false,
          why: `uvm_queue::insert rejects index ${index} because it is not below size() = ${o.items.length}. A native queue would accept index == size() and append.`,
        };
      }
      o.items.splice(index, 0, s.value);
      return { world, output: "", changed: true, why: `Inserted before index ${index}.` };
    }
    case "qget": {
      if (s.index >= o.items.length || s.index < 0) {
        return {
          world,
          output: "x = 0",
          warning: `UVM_WARNING [QUEUEGET] get: given index out of range for queue of size ${o.items.length}. Ignoring get request`,
          changed: false,
          why: "Out of range: uvm_queue::get warns and returns the default. Unlike uvm_pool::get, it never creates an element.",
        };
      }
      return { world, output: `x = ${o.items[s.index]}`, changed: false, why: "In range." };
    }
    case "qdelete": {
      if (s.index === undefined) {
        o.items = [];
        return { world, output: "", changed: true, why: "delete() with no index empties the queue." };
      }
      if (s.index >= o.items.length || s.index < -1) {
        return { world, output: "", warning: `UVM_WARNING [QUEUEDEL] delete: given index out of range for queue of size ${o.items.length}. Ignoring delete request`, changed: false, why: "Out of range: ignored." };
      }
      o.items.splice(s.index, 1);
      return { world, output: "", changed: true, why: "Removed." };
    }
    case "compare": {
      const b = objOf(world, s.b);
      if (!b) return nullFatal(world, s.b);
      return {
        world,
        output: "1",
        changed: false,
        why: `uvm_queue and uvm_pool define no do_compare and register no fields, so compare() has nothing to compare and returns 1 — even though ${s.a} and ${s.b} hold different elements.`,
      };
    }
    case "print": {
      if (o.type === "uvm_queue#(int)") {
        return { world, output: `${o.name}  uvm_queue  -  @${o.objId}`, changed: false, why: "uvm_queue has no do_print, so print() shows only the object header — no elements." };
      }
      // uvm_pool::do_print never increments its counter, so every row is labelled [-key0--].
      const rows = o.entries.map(([, v]) => `    [-key0--]  ${formatPoolValue(v)}`);
      return {
        world,
        output: [`${o.name}  ${o.type}  -  @${o.objId}`, `  pool  aa_object_string  ${o.entries.length}  -`, ...rows].join("\n"),
        changed: false,
        why: "uvm_pool::do_print lists every stored value (the reference implementation labels each row [-key0--] instead of printing the key).",
      };
    }
    case "convert2string":
      return { world, output: `'{${o.items.join(", ")}}`, changed: false, why: "uvm_queue::convert2string returns $sformatf(\"%p\", queue)." };
    default:
      return { world, output: "", changed: false, why: "" };
  }
}

export interface ProgramStep {
  stmt: ContainerStmt;
  source: string;
  result: StmtResult;
}

/** Runs statements in order; a fatal stops the program. */
export function runProgram(stmts: ContainerStmt[], start: World = emptyWorld()): ProgramStep[] {
  const steps: ProgramStep[] = [];
  let world = start;
  for (const stmt of stmts) {
    const result = execStmt(world, stmt);
    steps.push({ stmt, source: stmtSource(stmt), result });
    world = result.world;
    if (result.fatal) break;
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Explorer programs
// ---------------------------------------------------------------------------

export type ContainerMode = "pool" | "event" | "queue";

export interface ContainerProgram {
  mode: ContainerMode;
  title: string;
  declarations: string[];
  stmts: ContainerStmt[];
  /** Index of the statement whose result is gated behind a prediction. */
  predictAt: number;
  question: string;
  options: { id: string; label: string; correct: boolean; feedback: string }[];
}

export const containerPrograms: Record<ContainerMode, ContainerProgram> = {
  pool: {
    mode: "pool",
    title: "uvm_pool #(string,int): an error counter shared through the global pool",
    declarations: ["uvm_pool #(string,int) err_pool, other;", "int n;"],
    stmts: [
      { kind: "global", target: "err_pool", type: "uvm_pool#(string,int)" },
      { kind: "add", target: "err_pool", key: "crc", value: 2 },
      { kind: "get", target: "err_pool", key: "timeout", into: "n" },
      { kind: "num", target: "err_pool" },
      { kind: "exists", target: "err_pool", key: "parity" },
      { kind: "delete", target: "err_pool", key: "parity" },
      { kind: "global", target: "other", type: "uvm_pool#(string,int)" },
      { kind: "same", a: "err_pool", b: "other" },
    ],
    predictAt: 2,
    question: 'The key "timeout" was never added. What does n = err_pool.get("timeout") do?',
    options: [
      { id: "insert", label: "n = 0, and the pool now holds a \"timeout\" entry (num() becomes 2)", correct: true, feedback: "uvm_pool::get() inserts the default value of T for a missing key and returns it. Use exists() first when absence matters." },
      { id: "nochange", label: "n = 0, and the pool is unchanged", correct: false, feedback: "That is how reading a missing element of a native associative array behaves. uvm_pool::get() writes the default into the pool, so num() grows." },
      { id: "fatal", label: "A UVM_FATAL: the key does not exist", correct: false, feedback: "uvm_pool::get() never errors. Only delete() of a missing key warns (POOLDEL)." },
      { id: "x", label: "n = 'x because nothing was stored", correct: false, feedback: "T is int, a 2-state type; its default is 0, and get() stores that default." },
    ],
  },
  event: {
    mode: "event",
    title: "Sharing an event by name: uvm_pool #(string,uvm_event) vs uvm_event_pool",
    declarations: ["uvm_pool #(string,uvm_event) raw;"],
    stmts: [
      { kind: "event-pool-get-global-trigger", key: "cfg_done" },
      { kind: "new", target: "raw", type: "uvm_pool#(string,uvm_event)", name: "raw" },
      { kind: "get-trigger", target: "raw", key: "dma_done" },
    ],
    predictAt: 2,
    question: 'Nobody added "dma_done" to raw. What happens at raw.get("dma_done").trigger()?',
    options: [
      { id: "null", label: "A null object access: get() inserted and returned null", correct: true, feedback: "For a class type T, the default value get() inserts is null. Calling trigger() on it is a run-time null access. uvm_event_pool::get() creates the event instead." },
      { id: "creates", label: "get() creates a new uvm_event, which is triggered", correct: false, feedback: "Only uvm_object_string_pool specializations such as uvm_event_pool create an object in get(). A plain uvm_pool stores the default value, null." },
      { id: "warn", label: "A POOLDEL-style warning and nothing happens", correct: false, feedback: "get() never warns. The handle it returns is null, and dereferencing null stops the run." },
    ],
  },
  queue: {
    mode: "queue",
    title: "uvm_queue #(int): a class wrapper around an SV queue",
    declarations: ["uvm_queue #(int) q, q2;", "int x;"],
    stmts: [
      { kind: "new", target: "q", type: "uvm_queue#(int)", name: "q" },
      { kind: "push_back", target: "q", value: 5 },
      { kind: "push_back", target: "q", value: 9 },
      { kind: "insert", target: "q", index: "size", value: 7 },
      { kind: "qget", target: "q", index: 4 },
      { kind: "new", target: "q2", type: "uvm_queue#(int)", name: "q2" },
      { kind: "push_back", target: "q2", value: 1 },
      { kind: "compare", a: "q", b: "q2" },
      { kind: "print", target: "q" },
      { kind: "convert2string", target: "q" },
    ],
    predictAt: 3,
    question: "q holds '{5, 9}. What does q.insert(q.size(), 7) do?",
    options: [
      { id: "ignored", label: "Nothing: a QUEUEINS warning, q stays '{5, 9}", correct: true, feedback: "uvm_queue::insert accepts only 0 ≤ index < size(). To append, call push_back()." },
      { id: "append", label: "Appends 7: q becomes '{5, 9, 7}", correct: false, feedback: "That is native queue behaviour (index == size() is legal, §7.10.2.2). uvm_queue::insert rejects index == size()." },
      { id: "grow", label: "Grows q with a default element first, like uvm_pool::get", correct: false, feedback: "uvm_queue never creates elements: get() and insert() out of range only warn." },
    ],
  },
};

/** Policy support of the containers in uvm-core 2020.3.1. */
export const containerPolicySupport = [
  { container: "uvm_pool #(KEY,T)", copy: "shallow (handles shared)", print: "yes, every entry", compare: "no — always 1", convert2string: "no" },
  { container: "uvm_queue #(T)", copy: "shallow (handles shared)", print: "header only", compare: "no — always 1", convert2string: "yes, %p" },
] as const;
