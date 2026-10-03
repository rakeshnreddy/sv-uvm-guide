/**
 * Deterministic model of UVM callback registration and iteration, checked
 * against uvm-core 2020.3.1 src/base/uvm_callback.svh and
 * src/macros/uvm_callback_defines.svh (IEEE 1800.2-2020 §10.7, Annex B.4, D.1).
 *
 * Rules implemented (one queue per (T, CB) type pair; a single pair here):
 * 1. add(null, cb, ordering) is type-wide (`m_add_tw_cbs`): cb goes into the
 *    type-wide queue AND into every instance queue that already exists, at the
 *    back (UVM_APPEND) or front (UVM_PREPEND).
 * 2. add(obj, cb, ordering) with a non-null obj: the first instance add creates
 *    the instance queue and COPIES the type-wide queue into it; then cb is
 *    pushed at the back or front of that instance queue.
 * 3. Adding a callback already in the target queue only warns (CBPREG).
 * 4. Iteration (`uvm_do_callbacks` → uvm_callback_iter → get_first/get_next)
 *    walks the instance queue if one exists, otherwise the type-wide queue
 *    (`m_get_q`), and skips callbacks whose callback_mode() is 0.
 * 5. callback_mode(0/1) sets a bit on the callback OBJECT (`m_enabled`), so it
 *    affects every queue that holds it. It returns the previous mode.
 * 6. delete(null, cb) removes cb from the type-wide queue and from every
 *    instance queue; delete(obj, cb) removes it from obj's queue. Not found →
 *    CBUNREG warning.
 * 7. add_by_name(name, cb, root) looks components up with find_all; when none
 *    exist yet it warns CBNOMTC and registers nothing.
 *
 * The handle passed to add() is evaluated when add() runs. UVM builds top-down
 * (a parent's build_phase creates its children; their build_phase runs later),
 * so a handle to a component that is not built yet is null. Reading a member
 * through a null handle (e.g. env.agt0.drv while env.agt0 is null) is illegal
 * (IEEE 1800-2023 §8.4); simulators stop with a null-object-access error.
 *
 * Not modelled: report catchers copied into new instance queues, callbacks
 * inherited through `uvm_set_super_type`, and delete(obj, cb) on an object
 * that has no instance queue (uvm-core dereferences a null queue there).
 */

export type CbOrdering = "UVM_APPEND" | "UVM_PREPEND";

export interface CallbackState {
  typeWide: string[];
  /** Instance queues keyed by full component path. */
  instance: Record<string, string[]>;
  /** callback_mode of each callback object (default on). */
  enabled: Record<string, boolean>;
}

export interface CbMessage {
  severity: "info" | "warning" | "error" | "fatal";
  id: string;
  text: string;
}

export const emptyCallbackState = (): CallbackState => ({ typeWide: [], instance: {}, enabled: {} });

const clone = (s: CallbackState): CallbackState => ({
  typeWide: [...s.typeWide],
  instance: Object.fromEntries(Object.entries(s.instance).map(([k, v]) => [k, [...v]])),
  enabled: { ...s.enabled },
});

const place = (q: string[], cb: string, ordering: CbOrdering) => (ordering === "UVM_APPEND" ? q.push(cb) : q.unshift(cb));

/** uvm_callbacks#(T,CB)::add(obj, cb, ordering). `obj` is a component path or null. */
export function cbAdd(state: CallbackState, obj: string | null, cb: string, ordering: CbOrdering = "UVM_APPEND"): { state: CallbackState; message?: CbMessage } {
  const s = clone(state);
  if (!(cb in s.enabled)) s.enabled[cb] = true;
  if (obj === null) {
    if (s.typeWide.includes(cb)) {
      return { state: s, message: { severity: "warning", id: "CBPREG", text: `Callback object ${cb} is already registered with type my_driver` } };
    }
    place(s.typeWide, cb, ordering);
    for (const path of Object.keys(s.instance)) {
      if (!s.instance[path].includes(cb)) place(s.instance[path], cb, ordering);
    }
    return { state: s };
  }
  if (!s.instance[obj]) s.instance[obj] = [...s.typeWide];
  if (s.instance[obj].includes(cb)) {
    return { state: s, message: { severity: "warning", id: "CBPREG", text: `Callback object ${cb} is already registered with object ${obj}` } };
  }
  place(s.instance[obj], cb, ordering);
  return { state: s };
}

/** uvm_callbacks#(T,CB)::delete(obj, cb). */
export function cbDelete(state: CallbackState, obj: string | null, cb: string): { state: CallbackState; message?: CbMessage } {
  const s = clone(state);
  let found = false;
  if (obj === null) {
    if (s.typeWide.includes(cb)) {
      s.typeWide = s.typeWide.filter((c) => c !== cb);
      found = true;
    }
    for (const path of Object.keys(s.instance)) {
      if (s.instance[path].includes(cb)) {
        s.instance[path] = s.instance[path].filter((c) => c !== cb);
        found = true;
      }
    }
  } else if (s.instance[obj]?.includes(cb)) {
    s.instance[obj] = s.instance[obj].filter((c) => c !== cb);
    found = true;
  }
  return found
    ? { state: s }
    : { state: s, message: { severity: "warning", id: "CBUNREG", text: `Callback ${cb} cannot be removed from object ${obj ?? "(*)"} because it is not currently registered to that object.` } };
}

/** The queue `uvm_do_callbacks` walks for one component (uvm_callbacks::m_get_q). */
export function cbQueueFor(state: CallbackState, obj: string): { source: "instance" | "type-wide"; queue: string[] } {
  return state.instance[obj] ? { source: "instance", queue: [...state.instance[obj]] } : { source: "type-wide", queue: [...state.typeWide] };
}

/** Enabled callbacks in execution order (get_first/get_next skip callback_mode()==0). */
export function cbIterate(state: CallbackState, obj: string): string[] {
  return cbQueueFor(state, obj).queue.filter((cb) => state.enabled[cb] !== false);
}

/** cb.callback_mode(on): returns the previous mode; -1 only queries. */
export function cbCallbackMode(state: CallbackState, cb: string, on: 0 | 1 | -1 = -1): { state: CallbackState; previous: boolean } {
  const s = clone(state);
  const previous = s.enabled[cb] !== false;
  if (on === 0) s.enabled[cb] = false;
  if (on === 1) s.enabled[cb] = true;
  return { state: s, previous };
}

/* ------------------------------------------------------------------------- */
/* Scenario: err_test wants to corrupt CRCs on agt0's driver only             */
/* ------------------------------------------------------------------------- */

export type CbLocation = "test-build" | "env-build" | "env-connect" | "test-connect" | "test-eoe";
export type CbTarget = "handle" | "by-name" | "null";
export type LogCbTiming = "none" | "base-build" | "start-of-sim";

export interface CbConfig {
  location: CbLocation;
  target: CbTarget;
  ordering: CbOrdering;
  /** When base_test registers the type-wide log_cb. */
  logCb: LogCbTiming;
  /** The test calls err_cb.callback_mode(0) at 20 ns, between the two packets. */
  disableAt20ns: boolean;
}

export const DEFAULT_CB_CONFIG: CbConfig = {
  location: "test-build",
  target: "handle",
  ordering: "UVM_APPEND",
  logCb: "base-build",
  disableAt20ns: false,
};

export const DRIVERS = ["uvm_test_top.env.agt0.drv", "uvm_test_top.env.agt1.drv"] as const;
export const shortPath = (p: string) => p.replace("uvm_test_top.", "");

export const locationLabels: Record<CbLocation, string> = {
  "test-build": "err_test.build_phase",
  "env-build": "my_env.build_phase",
  "env-connect": "my_env.connect_phase",
  "test-connect": "err_test.connect_phase",
  "test-eoe": "err_test.end_of_elaboration_phase",
};

export const targetLabels: Record<CbTarget, string> = {
  handle: "a handle",
  "by-name": "add_by_name",
  null: "null",
};

/** Where the add() call sits, the handle expression it uses, and which component's code it is. */
function addSite(config: CbConfig): { owner: "test" | "env"; phase: string; handleExpr: string; path: string[] } {
  const owner = config.location.startsWith("env") ? "env" : "test";
  const phase = config.location.endsWith("build") ? "build_phase" : config.location.endsWith("connect") ? "connect_phase" : "end_of_elaboration_phase";
  // Path from the code's own scope to the target driver.
  const path = owner === "env" ? ["agt0", "drv"] : ["env", "agt0", "drv"];
  return { owner, phase, handleExpr: path.join("."), path };
}

export function addCallText(config: CbConfig): string {
  const site = addSite(config);
  const order = config.ordering === "UVM_PREPEND" ? ", UVM_PREPEND" : "";
  if (config.target === "null") return `uvm_callbacks#(my_driver, drv_cb)::add(null, err_cb${order});`;
  if (config.target === "by-name") return `uvm_callbacks#(my_driver, drv_cb)::add_by_name("*.agt0.drv", err_cb, this${order});`;
  return `uvm_callbacks#(my_driver, drv_cb)::add(${site.handleExpr}, err_cb${order});`;
}

export type CbOutcome = "only-agt0" | "both" | "neither" | "null-access";

export interface CbTimelineStep {
  phase: string;
  /** Which component's code runs. */
  scope: string;
  text: string;
  /** Components that exist after this step. */
  exists: string[];
  isAdd?: boolean;
  message?: CbMessage;
  /** Queue state after this step. */
  state: CallbackState;
}

export interface CbPacketRun {
  driver: string;
  packet: number;
  t: number;
  crcIn: number;
  executed: { cb: string; effect: string }[];
  crcOut: number;
  corrupted: boolean;
}

export interface CbResult {
  config: CbConfig;
  timeline: CbTimelineStep[];
  handleValue: "component" | "null" | "null-access" | "by-name";
  addMessage?: CbMessage;
  fatal?: CbMessage;
  finalState: CallbackState;
  queues: { driver: string; source: "instance" | "type-wide"; queue: string[] }[];
  runs: CbPacketRun[];
  outcome: CbOutcome;
  /** Order in which agt0.drv runs its callbacks on packet 1. */
  agt0Order: string[];
  summary: string;
  why: string;
}

const crcs: Record<string, number[]> = {
  [DRIVERS[0]]: [0x5a, 0x3c],
  [DRIVERS[1]]: [0x77, 0x18],
};

const hex = (v: number) => `0x${v.toString(16).toUpperCase().padStart(2, "0")}`;

export function runCallbackScenario(config: CbConfig): CbResult {
  const site = addSite(config);
  let state = emptyCallbackState();
  const timeline: CbTimelineStep[] = [];
  const exists = new Set<string>(["uvm_test_top"]);
  const snap = () => [...exists].map(shortPath).filter((p) => p !== "uvm_test_top");
  const step = (phase: string, scope: string, text: string, extra: Partial<CbTimelineStep> = {}) =>
    timeline.push({ phase, scope, text, exists: snap(), state, ...extra });

  // Assigned inside doAdd(); the cast keeps TypeScript from narrowing it to the initial value.
  let handleValue = "component" as CbResult["handleValue"];
  let addMessage: CbMessage | undefined;
  let fatal: CbMessage | undefined;

  const doAdd = (phase: string) => {
    const scope = site.owner === "env" ? "my_env" : "err_test";
    if (config.target === "null") {
      handleValue = "null";
      state = cbAdd(state, null, "err_cb", config.ordering).state;
      step(phase, scope, addCallText(config), { isAdd: true, message: { severity: "info", id: "CB", text: "obj is null: err_cb is registered type-wide, for every my_driver" } });
      return;
    }
    if (config.target === "by-name") {
      handleValue = "by-name";
      const found = DRIVERS.filter((d) => d.endsWith(".agt0.drv") && exists.has(d));
      if (found.length === 0) {
        addMessage = {
          severity: "warning",
          id: "CBNOMTC",
          text: 'add_by_name failed to find any components matching the name *.agt0.drv, callback err_cb will not be registered.',
        };
        step(phase, scope, addCallText(config), { isAdd: true, message: addMessage });
        return;
      }
      for (const d of found) state = cbAdd(state, d, "err_cb", config.ordering).state;
      step(phase, scope, addCallText(config), { isAdd: true, message: { severity: "info", id: "CB", text: `found ${found.map(shortPath).join(", ")}: err_cb added to that instance` } });
      return;
    }
    // Handle: walk the path from the code's scope.
    const base = site.owner === "env" ? "uvm_test_top.env" : "uvm_test_top";
    let cursor = base;
    for (let i = 0; i < site.path.length; i += 1) {
      const next = `${cursor}.${site.path[i]}`;
      const isLeaf = i === site.path.length - 1;
      if (!exists.has(next)) {
        if (isLeaf) {
          handleValue = "null";
          state = cbAdd(state, null, "err_cb", config.ordering).state;
          step(phase, scope, addCallText(config), {
            isAdd: true,
            message: { severity: "info", id: "CB", text: `${site.handleExpr} is still null here, so add(null, …) registers err_cb type-wide. No warning.` },
          });
        } else {
          handleValue = "null-access";
          fatal = {
            severity: "fatal",
            id: "NULL",
            text: `Null object access: ${site.path.slice(0, i + 1).join(".")} is null when ${site.handleExpr} is read (IEEE 1800-2023 §8.4).`,
          };
          step(phase, scope, addCallText(config), { isAdd: true, message: fatal });
        }
        return;
      }
      cursor = next;
    }
    state = cbAdd(state, cursor, "err_cb", config.ordering).state;
    step(phase, scope, addCallText(config), { isAdd: true, message: { severity: "info", id: "CB", text: `${site.handleExpr} = ${shortPath(cursor)}: err_cb added to that instance only` } });
  };

  // build_phase, top-down.
  exists.add("uvm_test_top.env");
  step("build_phase", "base_test", 'env = my_env::type_id::create("env", this);');
  if (config.logCb === "base-build") {
    state = cbAdd(state, null, "log_cb").state;
    step("build_phase", "base_test", "uvm_callbacks#(my_driver, drv_cb)::add(null, log_cb); // every driver logs");
  }
  if (config.location === "test-build") doAdd("build_phase");
  if (!fatal) {
    exists.add("uvm_test_top.env.agt0");
    exists.add("uvm_test_top.env.agt1");
    step("build_phase", "my_env", 'agt0 = my_agent::type_id::create("agt0", this); agt1 = …');
    if (config.location === "env-build") doAdd("build_phase");
    exists.add("uvm_test_top.env.agt0.drv");
    exists.add("uvm_test_top.env.agt1.drv");
    step("build_phase", "my_agent ×2", 'drv = my_driver::type_id::create("drv", this);');
    if (config.location === "env-connect") doAdd("connect_phase");
    if (config.location === "test-connect") doAdd("connect_phase");
    if (config.location === "test-eoe") doAdd("end_of_elaboration_phase");
    if (config.logCb === "start-of-sim") {
      state = cbAdd(state, null, "log_cb").state;
      step("start_of_simulation_phase", "base_test", "uvm_callbacks#(my_driver, drv_cb)::add(null, log_cb);");
    }
  }

  const finalState = state;
  const queues = DRIVERS.map((d) => ({ driver: d, ...cbQueueFor(finalState, d) }));
  const runs: CbPacketRun[] = [];
  if (!fatal) {
    let runState = finalState;
    for (const [packet, t] of [
      [1, 10],
      [2, 30],
    ] as const) {
      if (packet === 2 && config.disableAt20ns) runState = cbCallbackMode(runState, "err_cb", 0).state;
      for (const d of DRIVERS) {
        let crc = crcs[d][packet - 1];
        const executed: { cb: string; effect: string }[] = [];
        for (const cb of cbIterate(runState, d)) {
          if (cb === "err_cb") {
            const before = crc;
            crc = ~crc & 0xff;
            executed.push({ cb, effect: `pkt.crc = ~pkt.crc (${hex(before)} → ${hex(crc)})` });
          } else {
            executed.push({ cb, effect: `logs crc=${hex(crc)}` });
          }
        }
        runs.push({ driver: d, packet, t, crcIn: crcs[d][packet - 1], executed, crcOut: crc, corrupted: crc !== crcs[d][packet - 1] });
      }
    }
  }

  const corruptedOn = (d: string) => runs.some((r) => r.driver === d && r.corrupted);
  const outcome: CbOutcome = fatal ? "null-access" : corruptedOn(DRIVERS[0]) && corruptedOn(DRIVERS[1]) ? "both" : corruptedOn(DRIVERS[0]) ? "only-agt0" : "neither";
  const agt0Order = cbIterate(finalState, DRIVERS[0]);

  let why: string;
  if (outcome === "null-access") {
    why = `UVM builds top-down. When err_test.build_phase runs, env exists but env.build_phase has not run, so env.agt0 is null and reading env.agt0.drv is a null-handle access.`;
  } else if (handleValue === "null" && config.target !== "null") {
    why = `${site.handleExpr} is evaluated when add() runs. During ${locationLabels[config.location]} the driver has not been built, so the call is add(null, err_cb): type-wide, every my_driver, with no warning.`;
  } else if (config.target === "null") {
    why = "add(null, cb) is the documented way to register a callback for every instance of the type, including drivers created later.";
  } else if (handleValue === "by-name" && outcome === "neither") {
    why = "add_by_name searches the components that exist when it runs. In build_phase the drivers do not exist yet, so it warns CBNOMTC and registers nothing.";
  } else {
    why = `By ${config.location.includes("connect") ? "connect_phase" : "end_of_elaboration_phase"} every component is built, so ${config.target === "by-name" ? "the name lookup finds" : `${site.handleExpr} is`} the real agt0 driver and err_cb goes into its instance queue only.`;
  }

  const summaryByOutcome: Record<CbOutcome, string> = {
    "only-agt0": "Only agt0.drv corrupts its CRCs: the intended result.",
    both: "Both drivers corrupt their CRCs: the callback leaked to every my_driver.",
    neither: "Neither driver corrupts anything: the callback was never registered.",
    "null-access": "Simulation stops during build_phase with a null-object-access error.",
  };

  return {
    config,
    timeline,
    handleValue,
    addMessage,
    fatal,
    finalState,
    queues,
    runs,
    outcome,
    agt0Order,
    summary: summaryByOutcome[outcome],
    why,
  };
}

/** Code panel for the scenario, generated from the same configuration. */
export function callbackSource(config: CbConfig): { text: string; key?: string }[] {
  const site = addSite(config);
  const add = { text: `    ${addCallText(config)}`, key: "add" };
  const lines: { text: string; key?: string }[] = [
    { text: "class base_test extends uvm_test;" },
    { text: "  function void build_phase(uvm_phase phase);" },
    { text: '    env = my_env::type_id::create("env", this);', key: "create-env" },
  ];
  if (config.logCb === "base-build") lines.push({ text: "    uvm_callbacks#(my_driver, drv_cb)::add(null, log_cb);", key: "log" });
  lines.push({ text: "  endfunction" });
  if (config.logCb === "start-of-sim") {
    lines.push({ text: "  function void start_of_simulation_phase(uvm_phase phase);" });
    lines.push({ text: "    uvm_callbacks#(my_driver, drv_cb)::add(null, log_cb);", key: "log" });
    lines.push({ text: "  endfunction" });
  }
  lines.push({ text: "endclass" }, { text: "" });
  if (site.owner === "env") {
    lines.push({ text: "class my_env extends uvm_env;" });
    if (site.phase === "build_phase") {
      lines.push({ text: "  function void build_phase(uvm_phase phase);" });
      lines.push({ text: '    agt0 = my_agent::type_id::create("agt0", this);', key: "create-agt" });
      lines.push({ text: '    agt1 = my_agent::type_id::create("agt1", this);', key: "create-agt" });
    } else {
      lines.push({ text: `  function void ${site.phase}(uvm_phase phase);` });
    }
    lines.push({ text: '    err_cb = crc_err_cb::type_id::create("err_cb");' });
    lines.push(add);
    lines.push({ text: "  endfunction" }, { text: "endclass" });
    if (config.disableAt20ns) {
      lines.push({ text: "" }, { text: "class err_test extends base_test;" });
      lines.push({ text: "  task run_phase(uvm_phase phase);" });
      lines.push({ text: "    #20ns void'(env.err_cb.callback_mode(0));  // off for every queue", key: "mode" });
      lines.push({ text: "  endtask" }, { text: "endclass" });
    }
  } else {
    lines.push({ text: "class err_test extends base_test;" });
    lines.push({ text: `  function void ${site.phase}(uvm_phase phase);` });
    if (site.phase === "build_phase") lines.push({ text: "    super.build_phase(phase);   // creates env" });
    lines.push({ text: '    err_cb = crc_err_cb::type_id::create("err_cb");' });
    lines.push(add);
    lines.push({ text: "  endfunction" });
    if (config.disableAt20ns) {
      lines.push({ text: "  task run_phase(uvm_phase phase);" });
      lines.push({ text: "    #20ns void'(err_cb.callback_mode(0));  // off for every queue", key: "mode" });
      lines.push({ text: "  endtask" });
    }
    lines.push({ text: "endclass" });
  }
  return lines;
}
