/**
 * Deterministic educational model of the UVM register layer (RAL).
 *
 * Every rule was checked against the uvm-core 2020.3.1 reference
 * implementation (accellera-official/uvm-core, tag 2020.3.1, src/reg/).
 * Clause numbers are IEEE 1800.2-2020 numbers taken from the `@uvm-ieee` tags
 * in that source.
 *
 * uvm_reg_field.svh (§18.5)
 * - m_predefine_policies() defines 25 policies: RO RW RC RS WRC WRS WC WS WSRC
 *   WCRS W1C W1S W1T W0C W0S W0T W1SRC W1CRS W0SRC W0CRS WO WOC WOS W1 WO1.
 *   "NOACCESS" is not configurable; get_access(map) returns it when the map's
 *   rights hide the field (e.g. a WO field in a register mapped "RO").
 * - configure(): `m_check = volatile ? UVM_NO_CHECK : UVM_CHECK`, so a volatile
 *   field is skipped by mirror(UVM_CHECK) unless set_compare(UVM_CHECK) (§18.5.5.15).
 * - set() (§18.5.5.2) changes only the desired value, and models the effect of
 *   the write (W1C: desired & ~value; RO: unchanged; …).
 * - XpredictX: the mirror after a predicted write, per policy.
 * - do_predict(): UVM_PREDICT_WRITE applies XpredictX only for
 *   UVM_FRONTDOOR/UVM_PREDICT doors (a backdoor value is taken as is).
 *   UVM_PREDICT_READ clears RC-family fields, sets RS-family fields and leaves
 *   WO-family fields untouched, again only for frontdoor/predict doors.
 *   UVM_PREDICT_DIRECT takes the value as is. Every prediction ends with
 *   `m_mirrored = field_val; m_desired = field_val`.
 * - needs_update() (§18.5.5.8): 0 for RO/RC/RS, else (mirrored != desired) | volatile.
 * - XupdateX: the value update() must write so the field reaches its desired value.
 *
 * uvm_reg.svh (§18.4)
 * - write() (§18.4.4.9) calls set(value) before the access.
 * - Frontdoor write()/read(): the register predicts itself only when
 *   `system_map.get_auto_predict()` is 1. Otherwise only an external
 *   uvm_reg_predictor updates the mirror.
 * - update() (§18.4.4.13) returns without a bus access when needs_update() is 0.
 * - mirror() (§18.4.4.14) samples get_mirrored_value() *before* the read, reads,
 *   then do_check() compares every field except UVM_NO_CHECK and "WO*" fields.
 *   The UVM_ERROR text below is the do_check_error() format.
 * - poke()/peek() (§18.4.4.11/12) need a backdoor or an HDL path (add_hdl_path,
 *   §18.4.6.4); otherwise "No backdoor access available…" and UVM_NOT_OK.
 *   After the access they call do_predict(UVM_PREDICT_WRITE / _READ) with the
 *   UVM_BACKDOOR door: the mirror takes the raw value, with no policy applied.
 * - predict() (§18.4.4.15) defaults to UVM_PREDICT_DIRECT.
 *
 * uvm_reg_map.svh (§18.2): new() sets m_auto_predict = 0, so auto-predict is
 * off by default. set_auto_predict(1) is §18.2.5.2. do_bus_access() calls
 * adapter.reg2bus(), runs the item on the sequencer, then adapter.bus2reg() on
 * the request item, or on the response when adapter.provides_responses is 1.
 *
 * uvm_reg_predictor.svh (§19.3): write() is the bus_in imp. It fatals with
 * REG/WRITE/NULL when adapter is null, looks the register up with
 * map.get_reg_by_offset(), and calls do_predict() with the UVM_PREDICT door,
 * so the access policy is applied. It cannot see backdoor accesses.
 *
 * Terminology (UVM User's Guide, "Mirroring"; section number unverified):
 * implicit (auto) prediction = map.set_auto_predict(1); explicit prediction =
 * a uvm_reg_predictor fed by a bus monitor; passive = a predictor watching a bus
 * the register model never drives.
 *
 * Model assumptions: one register map with "RW" rights, 32-bit registers and
 * 32-bit bus, little endian, no byte enables, no callbacks, zero-time accesses.
 * The DUT implements each field's policy exactly; write-only fields read as 0.
 */

// ---------------------------------------------------------------------------
// Access policies
// ---------------------------------------------------------------------------

export const ACCESS_POLICIES = [
  "RO",
  "RW",
  "RC",
  "RS",
  "WRC",
  "WRS",
  "WC",
  "WS",
  "WSRC",
  "WCRS",
  "W1C",
  "W1S",
  "W1T",
  "W0C",
  "W0S",
  "W0T",
  "W1SRC",
  "W1CRS",
  "W0SRC",
  "W0CRS",
  "WO",
  "WOC",
  "WOS",
  "W1",
  "WO1",
] as const;

export type AccessPolicy = (typeof ACCESS_POLICIES)[number];
export type EffectiveAccess = AccessPolicy | "NOACCESS";
export type MapRights = "RW" | "RO" | "WO";
export type CheckMode = "UVM_CHECK" | "UVM_NO_CHECK";

const READ_CLEARS: readonly EffectiveAccess[] = ["RC", "WRC", "WSRC", "W1SRC", "W0SRC"];
const READ_SETS: readonly EffectiveAccess[] = ["RS", "WRS", "WCRS", "W1CRS", "W0CRS"];
const WRITE_ONLY: readonly EffectiveAccess[] = ["WO", "WOC", "WOS", "WO1", "NOACCESS"];

/** One-line meaning of each policy (write effect · read effect). */
export const POLICY_INFO: Record<AccessPolicy, { write: string; read: string }> = {
  RO: { write: "a write has no effect", read: "a read has no side effect" },
  RW: { write: "takes the written value", read: "a read has no side effect" },
  RC: { write: "a write has no effect", read: "a read clears it to 0" },
  RS: { write: "a write has no effect", read: "a read sets all bits" },
  WRC: { write: "takes the written value", read: "a read clears it to 0" },
  WRS: { write: "takes the written value", read: "a read sets all bits" },
  WC: { write: "any write clears it to 0", read: "a read has no side effect" },
  WS: { write: "any write sets all bits", read: "a read has no side effect" },
  WSRC: { write: "any write sets all bits", read: "a read clears it to 0" },
  WCRS: { write: "any write clears it to 0", read: "a read sets all bits" },
  W1C: { write: "writing 1 clears a bit, writing 0 leaves it", read: "a read has no side effect" },
  W1S: { write: "writing 1 sets a bit, writing 0 leaves it", read: "a read has no side effect" },
  W1T: { write: "writing 1 toggles a bit, writing 0 leaves it", read: "a read has no side effect" },
  W0C: { write: "writing 0 clears a bit, writing 1 leaves it", read: "a read has no side effect" },
  W0S: { write: "writing 0 sets a bit, writing 1 leaves it", read: "a read has no side effect" },
  W0T: { write: "writing 0 toggles a bit, writing 1 leaves it", read: "a read has no side effect" },
  W1SRC: { write: "writing 1 sets a bit", read: "a read clears it to 0" },
  W1CRS: { write: "writing 1 clears a bit", read: "a read sets all bits" },
  W0SRC: { write: "writing 0 sets a bit", read: "a read clears it to 0" },
  W0CRS: { write: "writing 0 clears a bit", read: "a read sets all bits" },
  WO: { write: "takes the written value", read: "write-only: reads are not predicted or checked" },
  WOC: { write: "any write clears it to 0", read: "write-only: reads are not predicted or checked" },
  WOS: { write: "any write sets all bits", read: "write-only: reads are not predicted or checked" },
  W1: { write: "only the first write after a hard reset takes effect", read: "a read has no side effect" },
  WO1: { write: "only the first write after a hard reset takes effect", read: "write-only: reads are not predicted or checked" },
};

export function fieldMask(size: number): number {
  return size >= 32 ? 0xffffffff : 2 ** size - 1;
}

const u32 = (v: number) => v >>> 0;
const and = (a: number, b: number) => (a & b) >>> 0;
const or = (a: number, b: number) => (a | b) >>> 0;
const xor = (a: number, b: number) => (a ^ b) >>> 0;
const not = (a: number, mask: number) => (~a & mask) >>> 0;

/** uvm_reg_field::get_access(map): the policy as seen through the map's rights. */
export function effectiveAccess(policy: AccessPolicy, rights: MapRights = "RW"): EffectiveAccess {
  if (rights === "RW") return policy;
  if (rights === "RO") {
    if (["RW", "RO", "WC", "WS", "W1C", "W1S", "W1T", "W0C", "W0S", "W0T", "W1"].includes(policy)) return "RO";
    if (["RC", "WRC", "W1SRC", "W0SRC", "WSRC"].includes(policy)) return "RC";
    if (["RS", "WRS", "W1CRS", "W0CRS", "WCRS"].includes(policy)) return "RS";
    if (["WO", "WOC", "WOS", "WO1"].includes(policy)) return "NOACCESS";
    return policy;
  }
  // rights === "WO"
  switch (policy) {
    case "RW":
    case "WRC":
    case "WRS":
      return "WO";
    case "W1SRC":
      return "W1S";
    case "W0SRC":
      return "W0S";
    case "W1CRS":
      return "W1C";
    case "W0CRS":
      return "W0C";
    case "WCRS":
      return "WC";
    case "WSRC":
      return "WS";
    case "RO":
    case "RC":
    case "RS":
      return "NOACCESS";
    default:
      return policy;
  }
}

/** uvm_reg_field::XpredictX: the field after a write of `wr` when it held `cur`. Also the DUT's write behaviour. */
export function predictWriteValue(access: EffectiveAccess, cur: number, wr: number, size: number, written: boolean): number {
  const mask = fieldMask(size);
  const c = and(cur, mask);
  const w = and(wr, mask);
  switch (access) {
    case "RO":
    case "RC":
    case "RS":
    case "NOACCESS":
      return c;
    case "RW":
    case "WRC":
    case "WRS":
    case "WO":
      return w;
    case "WC":
    case "WCRS":
    case "WOC":
      return 0;
    case "WS":
    case "WSRC":
    case "WOS":
      return mask;
    case "W1C":
    case "W1CRS":
      return and(c, not(w, mask));
    case "W1S":
    case "W1SRC":
      return or(c, w);
    case "W1T":
      return xor(c, w);
    case "W0C":
    case "W0CRS":
      return and(c, w);
    case "W0S":
    case "W0SRC":
      return or(c, not(w, mask));
    case "W0T":
      return xor(c, not(w, mask));
    case "W1":
    case "WO1":
      return written ? c : w;
  }
}

/**
 * uvm_reg_field::do_predict(UVM_PREDICT_READ) through the frontdoor or a
 * predictor: the mirror after observing `observed`, or null when the field is
 * write-only and the mirror is left untouched.
 */
export function predictReadValue(access: EffectiveAccess, observed: number, size: number): number | null {
  if (READ_CLEARS.includes(access)) return 0;
  if (READ_SETS.includes(access)) return fieldMask(size);
  if (WRITE_ONLY.includes(access)) return null;
  return and(observed, fieldMask(size));
}

/** uvm_reg_field::set(): the new desired value. Uses the configured policy (m_access). */
export function setDesiredValue(access: AccessPolicy, desired: number, value: number, size: number, written: boolean): number {
  const mask = fieldMask(size);
  const d = and(desired, mask);
  const v = and(value, mask);
  switch (access) {
    case "RO":
    case "RC":
    case "RS":
      return d;
    case "RW":
    case "WRC":
    case "WRS":
    case "WO":
      return v;
    case "WC":
    case "WCRS":
    case "WOC":
      return 0;
    case "WS":
    case "WSRC":
    case "WOS":
      return mask;
    case "W1C":
    case "W1CRS":
      return and(d, not(v, mask));
    case "W1S":
    case "W1SRC":
      return or(d, v);
    case "W1T":
      return xor(d, v);
    case "W0C":
    case "W0CRS":
      return and(d, v);
    case "W0S":
    case "W0SRC":
      return or(d, not(v, mask));
    case "W0T":
      return xor(d, not(v, mask));
    case "W1":
    case "WO1":
      return written ? d : v;
  }
}

/** uvm_reg_field::XupdateX(): the value update() writes so the field reaches `desired`. */
export function updateWriteValue(access: AccessPolicy, desired: number, mirrored: number, size: number): number {
  const mask = fieldMask(size);
  switch (access) {
    case "W1C":
    case "W0S":
    case "W1CRS":
    case "W0SRC":
      return not(desired, mask);
    case "W1T":
      return and(xor(desired, mirrored), mask);
    case "W0T":
      return not(xor(desired, mirrored), mask);
    default:
      return and(desired, mask);
  }
}

/** uvm_reg_field::needs_update(). */
export function fieldNeedsUpdate(access: EffectiveAccess, desired: number, mirrored: number, isVolatile: boolean): boolean {
  if (access === "RO" || access === "RC" || access === "RS") return false;
  return desired !== mirrored || isVolatile;
}

/** DUT read: the value returned on the bus and the field afterwards (RC/RS side effects). Write-only fields read as 0. */
export function dutReadField(access: EffectiveAccess, cur: number, size: number): { returned: number; next: number } {
  const returned = WRITE_ONLY.includes(access) ? 0 : cur;
  if (READ_CLEARS.includes(access)) return { returned, next: 0 };
  if (READ_SETS.includes(access)) return { returned, next: fieldMask(size) };
  return { returned, next: cur };
}

/** do_check() ignores UVM_NO_CHECK fields and fields whose access starts with "WO". */
export function fieldIsCompared(access: EffectiveAccess, compare: CheckMode): boolean {
  return compare === "UVM_CHECK" && access.slice(0, 2) !== "WO";
}

// ---------------------------------------------------------------------------
// Register block
// ---------------------------------------------------------------------------

export interface RalFieldSpec {
  name: string;
  lsb: number;
  size: number;
  access: AccessPolicy;
  volatile: boolean;
  reset: number;
  /** What the hardware does with this field, in one line. */
  role: string;
}

export interface RalRegSpec {
  name: string;
  offset: number;
  nBits: number;
  rights: MapRights;
  description: string;
  fields: RalFieldSpec[];
}

export interface RalBlockSpec {
  /** Instance name of the block (`ral` in the env), the prefix of get_full_name(). */
  instance: string;
  typeName: string;
  regs: RalRegSpec[];
}

export const I2C_BLOCK: RalBlockSpec = {
  instance: "ral",
  typeName: "i2c_reg_block",
  regs: [
    {
      name: "CTRL",
      offset: 0x00,
      nBits: 32,
      rights: "RW",
      description: "Control: enable, interrupt enable, speed mode",
      fields: [
        { name: "EN", lsb: 0, size: 1, access: "RW", volatile: false, reset: 0, role: "Enables the controller" },
        { name: "IE", lsb: 1, size: 1, access: "RW", volatile: false, reset: 0, role: "Interrupt enable" },
        { name: "MODE", lsb: 2, size: 2, access: "RW", volatile: false, reset: 0, role: "0 standard, 1 fast, 2 fast-plus" },
        { name: "RSVD", lsb: 4, size: 28, access: "RO", volatile: false, reset: 0, role: "Reserved, reads 0" },
      ],
    },
    {
      name: "STATUS",
      offset: 0x04,
      nBits: 32,
      rights: "RW",
      description: "Status, driven by hardware",
      fields: [
        { name: "BUSY", lsb: 0, size: 1, access: "RO", volatile: true, reset: 0, role: "Hardware sets it while a transfer runs" },
        { name: "TX_EMPTY", lsb: 1, size: 1, access: "RO", volatile: true, reset: 1, role: "Hardware: transmit buffer empty" },
        { name: "RX_FULL", lsb: 2, size: 1, access: "RO", volatile: true, reset: 0, role: "Hardware: receive buffer full" },
      ],
    },
    {
      name: "INT_STATUS",
      offset: 0x08,
      nBits: 32,
      rights: "RW",
      description: "Interrupt status: hardware sets, software clears by writing 1",
      fields: [
        { name: "DONE", lsb: 0, size: 1, access: "W1C", volatile: true, reset: 0, role: "Hardware sets it when a transfer completes" },
        { name: "ERR", lsb: 1, size: 1, access: "W1C", volatile: true, reset: 0, role: "Hardware sets it on a bus error" },
      ],
    },
    {
      name: "GPIO",
      offset: 0x0c,
      nBits: 32,
      rights: "RW",
      description: "Debug LEDs: write 1 to toggle, write 1 to set the pull-ups",
      fields: [
        { name: "LED", lsb: 0, size: 4, access: "W1T", volatile: false, reset: 0, role: "Each 1 written toggles one LED" },
        { name: "PULLUP", lsb: 4, size: 4, access: "W1S", volatile: false, reset: 0, role: "Each 1 written enables one pull-up; only reset clears it" },
      ],
    },
    {
      name: "TX_DATA",
      offset: 0x10,
      nBits: 32,
      rights: "RW",
      description: "Transmit data (write-only)",
      fields: [{ name: "DATA", lsb: 0, size: 8, access: "WO", volatile: false, reset: 0, role: "Byte to transmit" }],
    },
    {
      name: "NACK_CNT",
      offset: 0x14,
      nBits: 32,
      rights: "RW",
      description: "NACK counter, cleared by reading it",
      fields: [{ name: "COUNT", lsb: 0, size: 8, access: "RC", volatile: true, reset: 0, role: "Hardware counts NACKs; a read clears it" }],
    },
  ],
};

export function findReg(block: RalBlockSpec, name: string): RalRegSpec {
  const reg = block.regs.find((r) => r.name === name);
  if (!reg) throw new Error(`Unknown register ${name}`);
  return reg;
}

/** Returns a copy of the block with one field's configuration patched. */
export function withFieldConfig(block: RalBlockSpec, regName: string, fieldName: string, patch: Partial<RalFieldSpec>): RalBlockSpec {
  return {
    ...block,
    regs: block.regs.map((r) =>
      r.name !== regName ? r : { ...r, fields: r.fields.map((f) => (f.name === fieldName ? { ...f, ...patch } : f)) },
    ),
  };
}

/** Returns a copy of the block with an extra 8-bit register LAB whose single field uses `access`. */
export function withPolicyLab(block: RalBlockSpec, access: AccessPolicy, isVolatile = false, reset = 0): RalBlockSpec {
  const lab: RalRegSpec = {
    name: "LAB",
    offset: 0x18,
    nBits: 32,
    rights: "RW",
    description: `Policy lab: one 8-bit field configured "${access}"`,
    fields: [{ name: "F", lsb: 0, size: 8, access, volatile: isVolatile, reset, role: POLICY_INFO[access].write }],
  };
  return { ...block, regs: [...block.regs.filter((r) => r.name !== "LAB"), lab] };
}

export function fullName(block: RalBlockSpec, reg: RalRegSpec): string {
  return `${block.instance}.${reg.name}`;
}

/** The generated `configure()` call for a field, with the 9 arguments of §18.5.3.2. */
export function fieldConfigureLine(f: RalFieldSpec): string {
  const isRand = ["RW", "WRC", "WRS", "WO", "W1", "WO1"].includes(f.access) ? 1 : 0;
  return `${f.name}.configure(this, ${f.size}, ${f.lsb}, "${f.access}", ${f.volatile ? 1 : 0}, ${f.size}'h${f.reset.toString(16).toUpperCase()}, 1, ${isRand}, 0);`;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** 0x0000_000F style, padded to the register width. */
export function showHex(value: number, nBits = 32): string {
  const digits = Math.ceil(nBits / 4);
  const raw = u32(value).toString(16).toUpperCase().padStart(digits, "0");
  return `0x${raw.replace(/\B(?=([0-9A-F]{4})+$)/g, "_")}`;
}

/** SystemVerilog literal as a learner would type it: 'h5, 'hFFFF_FFFF. */
export function svHex(value: number): string {
  const raw = u32(value).toString(16).toUpperCase();
  return `'h${raw.replace(/\B(?=([0-9A-F]{4})+$)/g, "_")}`;
}

/** Field value as N'hX. */
export function fieldHex(value: number, size: number): string {
  return `${size}'h${u32(value).toString(16).toUpperCase()}`;
}

/** `%h` of a 64-bit uvm_reg_data_t, as UVM prints it in do_check_error(). */
export function uvmHex(value: number): string {
  return u32(value).toString(16).padStart(16, "0");
}

/** Parses 'hFF, 0xFF, FF (hex) or 255 (decimal, only with a d prefix: 'd255). Returns null when invalid or too wide. */
export function parseRegValue(text: string, nBits = 32): number | null {
  const t = text.trim().replace(/_/g, "");
  let v: number;
  if (/^('h|0x|h)?[0-9a-f]+$/i.test(t)) v = parseInt(t.replace(/^('h|0x|h)/i, ""), 16);
  else if (/^'d[0-9]+$/i.test(t)) v = parseInt(t.slice(2), 10);
  else return null;
  if (!Number.isFinite(v) || v < 0 || v > fieldMask(nBits)) return null;
  return v;
}

// ---------------------------------------------------------------------------
// State and environment
// ---------------------------------------------------------------------------

export interface RalFieldState {
  /** get(): the value the test wants. */
  desired: number;
  /** get_mirrored_value(): what the model believes the DUT holds. */
  mirrored: number;
  /** m_written, used by W1/WO1 prediction. */
  modelWritten: boolean;
  compare: CheckMode;
  /** The DUT's actual field value (what peek() would return). */
  dut: number;
  dutWritten: boolean;
}

export interface RalState {
  regs: Record<string, RalFieldState[]>;
  /** Set once a UVM_FATAL ends the simulation. */
  halted: string | null;
}

export type PredictorWiring = "connected" | "unconnected" | "absent";

export interface RalEnv {
  /** ral.default_map.set_auto_predict(1) — implicit prediction. */
  autoPredict: boolean;
  /**
   * Explicit prediction: a uvm_reg_predictor exists ("absent" = not built), and
   * `monitor.ap.connect(predictor.bus_in)` ran ("connected").
   */
  predictor: PredictorWiring;
  /** predictor.map = ral.default_map */
  predictorMapSet: boolean;
  /** predictor.adapter = adapter */
  predictorAdapterSet: boolean;
  /** add_hdl_path()/configure(hdl_path) gave the registers a backdoor. */
  hdlPath: boolean;
  /**
   * Adapter bug: the driver returns read data in a separate response
   * (put_response) but the adapter keeps provides_responses = 0, so the map
   * calls bus2reg() on the request item, whose data field is still 0.
   */
  readDataFromRequest: boolean;
}

export const EXPLICIT_ENV: RalEnv = {
  autoPredict: false,
  predictor: "connected",
  predictorMapSet: true,
  predictorAdapterSet: true,
  hdlPath: true,
  readDataFromRequest: false,
};

/** The UVM defaults: auto-predict off and no predictor. Frontdoor accesses do not update the mirror. */
export const DEFAULT_UVM_ENV: RalEnv = { ...EXPLICIT_ENV, predictor: "absent" };

export const AUTO_PREDICT_ENV: RalEnv = { ...EXPLICIT_ENV, autoPredict: true, predictor: "absent" };

export function initialState(block: RalBlockSpec): RalState {
  const regs: Record<string, RalFieldState[]> = {};
  for (const reg of block.regs) {
    regs[reg.name] = reg.fields.map((f) => ({
      desired: f.reset,
      mirrored: f.reset,
      modelWritten: false,
      compare: f.volatile ? "UVM_NO_CHECK" : "UVM_CHECK",
      dut: f.reset,
      dutWritten: false,
    }));
  }
  return { regs, halted: null };
}

function cloneState(s: RalState): RalState {
  const regs: Record<string, RalFieldState[]> = {};
  for (const [k, v] of Object.entries(s.regs)) regs[k] = v.map((f) => ({ ...f }));
  return { regs, halted: s.halted };
}

type FieldKey = "desired" | "mirrored" | "dut";

/** Concatenates field values into the register value (uvm_reg::get / get_mirrored_value). */
export function regValue(block: RalBlockSpec, state: RalState, regName: string, key: FieldKey): number {
  const reg = findReg(block, regName);
  const fields = state.regs[regName];
  return reg.fields.reduce((acc, f, i) => or(acc, u32(fields[i][key] * 2 ** f.lsb)), 0);
}

function slice(value: number, f: RalFieldSpec): number {
  return and(Math.floor(u32(value) / 2 ** f.lsb), fieldMask(f.size));
}

function concat(reg: RalRegSpec, values: number[]): number {
  return reg.fields.reduce((acc, f, i) => or(acc, u32(values[i] * 2 ** f.lsb)), 0);
}

/** uvm_reg::needs_update(). */
export function regNeedsUpdate(block: RalBlockSpec, state: RalState, regName: string): boolean {
  const reg = findReg(block, regName);
  return reg.fields.some((f, i) => {
    const s = state.regs[regName][i];
    return fieldNeedsUpdate(effectiveAccess(f.access, reg.rights), s.desired, s.mirrored, f.volatile);
  });
}

/** The do_check() valid-bits mask. */
export function checkMask(block: RalBlockSpec, state: RalState, regName: string): number {
  const reg = findReg(block, regName);
  return reg.fields.reduce(
    (acc, f, i) => (fieldIsCompared(effectiveAccess(f.access, reg.rights), state.regs[regName][i].compare) ? or(acc, u32(fieldMask(f.size) * 2 ** f.lsb)) : acc),
    0,
  );
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export type RalOp =
  | { kind: "set"; reg: string; value: number }
  | { kind: "update"; reg: string }
  | { kind: "write"; reg: string; value: number }
  | { kind: "read"; reg: string }
  | { kind: "mirror"; reg: string; check: boolean }
  | { kind: "peek"; reg: string }
  | { kind: "poke"; reg: string; value: number }
  | { kind: "predict"; reg: string; value: number }
  | { kind: "setCompare"; reg: string; field: string; check: boolean }
  | { kind: "reset" }
  /** The DUT's own logic changes a field. No bus access, nothing predicts. */
  | { kind: "hw"; reg: string; field: string; value: number; note?: string }
  /** Another initiator (CPU firmware, DMA) writes the register on the monitored bus. */
  | { kind: "busWrite"; reg: string; value: number; initiator?: string };

export type PredictionSource = "auto-predict" | "uvm_reg_predictor" | "backdoor do_predict" | "predict()";

export interface PredictionEvent {
  source: PredictionSource;
  kind: "UVM_PREDICT_WRITE" | "UVM_PREDICT_READ" | "UVM_PREDICT_DIRECT";
  value: number;
}

export interface UvmMessage {
  /** SIM_FATAL is a simulator runtime error (e.g. null handle), not a UVM report. */
  severity: "UVM_INFO" | "UVM_WARNING" | "UVM_ERROR" | "UVM_FATAL" | "SIM_FATAL";
  id: string;
  text: string;
  /** Verbosity of a UVM_INFO, when it is not UVM_NONE/UVM_LOW. */
  verbosity?: "UVM_HIGH";
}

export interface BusTransfer {
  kind: "WRITE" | "READ";
  addr: number;
  data: number;
  initiator: "RAL" | string;
}

export interface RalStep {
  op: RalOp;
  code: string;
  before: RalState;
  after: RalState;
  bus: BusTransfer | null;
  predictions: PredictionEvent[];
  /** Value handed back to the test (read/peek data, predict() return…). */
  returned: { label: string; value: number } | null;
  status: "UVM_IS_OK" | "UVM_NOT_OK" | null;
  messages: UvmMessage[];
  /** Plain-language reason for the outcome. */
  why: string;
  /** True when the operation did nothing (update with nothing to do, simulation ended). */
  noEffect: boolean;
}

export function opCode(op: RalOp, block: RalBlockSpec = I2C_BLOCK): string {
  const r = "reg" in op ? `${block.instance}.${op.reg}` : block.instance;
  switch (op.kind) {
    case "set":
      return `${r}.set(${svHex(op.value)});`;
    case "update":
      return `${r}.update(status);`;
    case "write":
      return `${r}.write(status, ${svHex(op.value)});`;
    case "read":
      return `${r}.read(status, rdata);`;
    case "mirror":
      return `${r}.mirror(status, ${op.check ? "UVM_CHECK" : "UVM_NO_CHECK"});`;
    case "peek":
      return `${r}.peek(status, rdata);`;
    case "poke":
      return `${r}.poke(status, ${svHex(op.value)});`;
    case "predict":
      return `void'(${r}.predict(${svHex(op.value)}));`;
    case "setCompare":
      return `${r}.${op.field}.set_compare(${op.check ? "UVM_CHECK" : "UVM_NO_CHECK"});`;
    case "reset":
      return `${block.instance}.reset();`;
    case "hw":
      return `// DUT logic: ${op.reg}.${op.field} becomes ${op.value}${op.note ? ` (${op.note})` : ""}`;
    case "busWrite":
      return `// ${op.initiator ?? "firmware"} writes ${op.reg} = ${svHex(op.value)} on the bus (not through the RAL)`;
  }
}

interface Ctx {
  block: RalBlockSpec;
  env: RalEnv;
  reg: RalRegSpec;
  s: RalState;
  predictions: PredictionEvent[];
  messages: UvmMessage[];
}

function fieldsOf(ctx: Ctx) {
  return ctx.s.regs[ctx.reg.name];
}

/** uvm_reg::do_predict → uvm_reg_field::do_predict for every field. */
function doPredict(ctx: Ctx, kind: PredictionEvent["kind"], door: "FRONTDOOR" | "PREDICT" | "BACKDOOR" | "DIRECT", value: number, source: PredictionSource) {
  ctx.reg.fields.forEach((f, i) => {
    const st = fieldsOf(ctx)[i];
    const access = effectiveAccess(f.access, ctx.reg.rights);
    const v = slice(value, f);
    let next: number | null = v;
    if (kind === "UVM_PREDICT_WRITE") {
      next = door === "BACKDOOR" ? v : predictWriteValue(access, st.mirrored, v, f.size, st.modelWritten);
      st.modelWritten = true;
    } else if (kind === "UVM_PREDICT_READ") {
      next = door === "BACKDOOR" ? v : predictReadValue(access, v, f.size);
    }
    if (next === null) return;
    st.mirrored = next;
    st.desired = next;
  });
  ctx.predictions.push({ source, kind, value: u32(value) });
}

function predictorAvailable(ctx: Ctx, bus: BusTransfer): boolean {
  if (ctx.env.predictor !== "connected") return false;
  if (!ctx.env.predictorAdapterSet) {
    ctx.messages.push({ severity: "UVM_FATAL", id: "REG/WRITE/NULL", text: "write: adapter handle is null" });
    ctx.s.halted = "uvm_reg_predictor::write() found predictor.adapter == null (UVM_FATAL REG/WRITE/NULL).";
    return false;
  }
  if (!ctx.env.predictorMapSet) {
    ctx.messages.push({
      severity: "SIM_FATAL",
      id: "null handle",
      text: `Null object access in uvm_reg_predictor::write(): predictor.map was never set (the exact text depends on the simulator). Observed ${bus.kind} at ${svHex(bus.addr)}.`,
    });
    ctx.s.halted = "uvm_reg_predictor::write() dereferenced a null predictor.map.";
    return false;
  }
  return true;
}

function frontdoorWrite(ctx: Ctx, value: number, initiator: string): BusTransfer {
  const bus: BusTransfer = { kind: "WRITE", addr: ctx.reg.offset, data: and(value, fieldMask(ctx.reg.nBits)), initiator };
  // The DUT applies each field's policy.
  ctx.reg.fields.forEach((f, i) => {
    const st = fieldsOf(ctx)[i];
    st.dut = predictWriteValue(effectiveAccess(f.access, ctx.reg.rights), st.dut, slice(bus.data, f), f.size, st.dutWritten);
    st.dutWritten = true;
  });
  // Explicit prediction: the monitor sees the transfer and calls predictor.bus_in.write().
  if (predictorAvailable(ctx, bus)) {
    doPredict(ctx, "UVM_PREDICT_WRITE", "PREDICT", bus.data, "uvm_reg_predictor");
    ctx.messages.push({
      severity: "UVM_INFO",
      id: "REG_PREDICT",
      text: `Observed WRITE transaction to register ${fullName(ctx.block, ctx.reg)}: value='h${bus.data.toString(16)} : updated value = 'h${regValue(ctx.block, ctx.s, ctx.reg.name, "desired").toString(16)}`,
      verbosity: "UVM_HIGH",
    });
  }
  // Implicit prediction happens only for accesses the register model itself started.
  if (!ctx.s.halted && initiator === "RAL" && ctx.env.autoPredict) {
    doPredict(ctx, "UVM_PREDICT_WRITE", "FRONTDOOR", bus.data, "auto-predict");
  }
  return bus;
}

function frontdoorRead(ctx: Ctx): { bus: BusTransfer; data: number } {
  const returnedFields: number[] = [];
  ctx.reg.fields.forEach((f, i) => {
    const st = fieldsOf(ctx)[i];
    const r = dutReadField(effectiveAccess(f.access, ctx.reg.rights), st.dut, f.size);
    returnedFields.push(r.returned);
    st.dut = r.next;
  });
  const busData = concat(ctx.reg, returnedFields);
  const bus: BusTransfer = { kind: "READ", addr: ctx.reg.offset, data: busData, initiator: "RAL" };
  // What bus2reg() hands back to read(): the request item's data unless the adapter reads the response.
  const data = ctx.env.readDataFromRequest ? 0 : busData;
  if (predictorAvailable(ctx, bus)) {
    doPredict(ctx, "UVM_PREDICT_READ", "PREDICT", busData, "uvm_reg_predictor");
    ctx.messages.push({
      severity: "UVM_INFO",
      id: "REG_PREDICT",
      text: `Observed READ transaction to register ${fullName(ctx.block, ctx.reg)}: value='h${busData.toString(16)}`,
      verbosity: "UVM_HIGH",
    });
  }
  if (!ctx.s.halted && ctx.env.autoPredict) {
    doPredict(ctx, "UVM_PREDICT_READ", "FRONTDOOR", data, "auto-predict");
  }
  return { bus, data };
}

function describePredictions(preds: PredictionEvent[]): string {
  if (preds.length === 0) return "";
  const names = preds.map((p) => (p.source === "uvm_reg_predictor" ? "the uvm_reg_predictor" : p.source === "auto-predict" ? "auto-predict" : p.source));
  return names.join(" and then ");
}

/** Fields whose predicted value differs from simply copying the written bits. */
function policyNotes(reg: RalRegSpec, before: RalFieldState[], written: number): string[] {
  const notes: string[] = [];
  reg.fields.forEach((f, i) => {
    const v = slice(written, f);
    const predicted = predictWriteValue(effectiveAccess(f.access, reg.rights), before[i].mirrored, v, f.size, before[i].modelWritten);
    if (predicted !== v) {
      notes.push(`${f.name} is ${f.access} (${POLICY_INFO[f.access].write}): ${fieldHex(before[i].mirrored, f.size)} → ${fieldHex(predicted, f.size)}`);
    }
  });
  return notes;
}

function stalenessNote(block: RalBlockSpec, s: RalState, regName: string): string {
  const reg = findReg(block, regName);
  const m = regValue(block, s, regName, "mirrored");
  const d = regValue(block, s, regName, "dut");
  return m === d ? "" : ` The mirror (${showHex(m, reg.nBits)}) no longer matches the DUT (${showHex(d, reg.nBits)}).`;
}

/** Applies one operation. Pure: returns the step with a fresh `after` state. */
export function applyOp(block: RalBlockSpec, env: RalEnv, state: RalState, op: RalOp): RalStep {
  const before = state;
  const s = cloneState(state);
  const code = opCode(op, block);
  const base = { op, code, before, bus: null as BusTransfer | null, returned: null as RalStep["returned"], status: null as RalStep["status"] };
  if (s.halted) {
    return { ...base, after: s, predictions: [], messages: [], why: `Not executed: the simulation already ended. ${s.halted}`, noEffect: true };
  }
  if (op.kind === "reset") {
    for (const reg of block.regs) {
      reg.fields.forEach((f, i) => {
        const st = s.regs[reg.name][i];
        st.mirrored = f.reset;
        st.desired = f.reset;
        st.modelWritten = false;
      });
    }
    return {
      ...base,
      after: s,
      predictions: [],
      messages: [],
      why: "reset() sets every field's mirrored and desired values to the reset value. It does not touch the DUT; reset the DUT first.",
      noEffect: false,
    };
  }

  const reg = findReg(block, op.reg);
  const ctx: Ctx = { block, env, reg, s, predictions: [], messages: [] };
  const fields = s.regs[reg.name];
  const name = fullName(block, reg);
  let bus: BusTransfer | null = null;
  let returned: RalStep["returned"] = null;
  let status: RalStep["status"] = null;
  let why = "";
  let noEffect = false;

  switch (op.kind) {
    case "set": {
      reg.fields.forEach((f, i) => {
        fields[i].desired = setDesiredValue(f.access, fields[i].desired, slice(op.value, f), f.size, fields[i].modelWritten);
      });
      const d = regValue(block, s, reg.name, "desired");
      const odd = reg.fields.filter((f) => f.access !== "RW" && f.access !== "WO").map((f) => `${f.name} (${f.access})`);
      why = `set() only changes the desired value (get() now returns ${showHex(d, reg.nBits)}). No bus access, the mirror and the DUT are unchanged.${
        odd.length ? ` set() models the write's effect per policy, so ${odd.join(", ")} did not simply copy the bits.` : ""
      } Call update() to push it to the DUT.`;
      break;
    }
    case "update": {
      if (!regNeedsUpdate(block, s, reg.name)) {
        why = "needs_update() is 0: every writable field's desired value equals its mirrored value, so update() returns without a bus access.";
        noEffect = true;
        status = "UVM_IS_OK";
        break;
      }
      const upd = concat(
        reg,
        reg.fields.map((f, i) => updateWriteValue(f.access, fields[i].desired, fields[i].mirrored, f.size)),
      );
      const volatileOnly = reg.fields.every((f, i) => {
        const st = fields[i];
        const access = effectiveAccess(f.access, reg.rights);
        return !fieldNeedsUpdate(access, st.desired, st.mirrored, false);
      });
      // update() calls write(), which calls set() first.
      reg.fields.forEach((f, i) => {
        fields[i].desired = setDesiredValue(f.access, fields[i].desired, slice(upd, f), f.size, fields[i].modelWritten);
      });
      bus = frontdoorWrite(ctx, upd, "RAL");
      status = "UVM_IS_OK";
      why = `${
        volatileOnly
          ? "needs_update() is 1 only because a writable field is volatile (needs_update() = (mirrored != desired) | volatile)."
          : "needs_update() is 1: a desired value differs from the mirror."
      } update() computes the value to write per policy (XupdateX) and writes ${svHex(upd)}.${
        ctx.predictions.length ? ` The mirror was predicted by ${describePredictions(ctx.predictions)}.` : " Nothing predicted the write, so the mirror is unchanged."
      }`;
      break;
    }
    case "write":
    case "busWrite": {
      const ral = op.kind === "write";
      const beforeFields = fields.map((f) => ({ ...f }));
      if (ral) {
        reg.fields.forEach((f, i) => {
          fields[i].desired = setDesiredValue(f.access, fields[i].desired, slice(op.value, f), f.size, fields[i].modelWritten);
        });
      }
      bus = frontdoorWrite(ctx, op.value, ral ? "RAL" : op.initiator ?? "firmware");
      status = ral ? "UVM_IS_OK" : null;
      const notes = policyNotes(reg, beforeFields, bus.data);
      const preds = ctx.predictions;
      if (s.halted) {
        why = `The DUT took the write, then the predictor stopped the simulation. ${s.halted}`;
      } else if (preds.length === 0) {
        why = ral
          ? `write() updated the desired value through set() and the DUT took the bus write, but nothing predicted it: auto-predict is ${env.autoPredict ? "on" : "off"} and ${
              env.predictor === "connected" ? "the predictor is connected" : env.predictor === "unconnected" ? "the predictor's bus_in was never connected to the monitor" : "there is no uvm_reg_predictor"
            }.${stalenessNote(block, s, reg.name)}`
          : `${op.kind === "busWrite" ? op.initiator ?? "Firmware" : "Firmware"} wrote the DUT directly. Auto-predict only sees accesses the register model starts, and ${
              env.predictor === "connected" ? "no predictor saw it" : env.predictor === "unconnected" ? "the predictor is not connected to the monitor" : "there is no uvm_reg_predictor"
            }, so the model never hears about it.${stalenessNote(block, s, reg.name)}`;
      } else {
        const double = preds.length > 1 ? " Both paths predicted the same write: it was applied twice." : "";
        why = `${ral ? "write() set the desired value, the DUT took the bus write, and " : "The monitor saw the bus write, so "}${describePredictions(preds)} updated the mirror field by field.${
          notes.length ? ` ${notes.join("; ")}.` : " Every field took the written bits."
        }${double}${stalenessNote(block, s, reg.name)}`;
      }
      break;
    }
    case "read":
    case "mirror": {
      const exp = regValue(block, s, reg.name, "mirrored");
      const mask = checkMask(block, s, reg.name);
      const r = frontdoorRead(ctx);
      bus = r.bus;
      status = "UVM_IS_OK";
      if (op.kind === "read") returned = { label: "rdata", value: r.data };
      let checkText = "";
      if (op.kind === "mirror" && op.check && !s.halted) {
        if (and(r.data, mask) !== and(exp, mask)) {
          ctx.messages.push({
            severity: "UVM_ERROR",
            id: "RegModel",
            text: `Register "${name}" value read from DUT (0x${uvmHex(r.data)}) does not match mirrored value (0x${uvmHex(exp)}) (valid bit mask = 0x${uvmHex(mask)})`,
          });
          reg.fields.forEach((f) => {
            if (!fieldIsCompared(effectiveAccess(f.access, reg.rights), before.regs[reg.name][reg.fields.indexOf(f)].compare)) return;
            const val = slice(r.data, f);
            const e = slice(exp, f);
            if (val !== e) {
              ctx.messages.push({
                severity: "UVM_INFO",
                id: "RegModel",
                text: `Field ${f.name} (${name}[${f.lsb + f.size - 1}:${f.lsb}]) mismatch read=${f.size}'h${val.toString(16)} mirrored=${f.size}'h${e.toString(16)}`,
              });
            }
          });
          checkText = ` UVM_CHECK compared the read data with the mirror captured before the read (mask ${showHex(mask, reg.nBits)}) and found a difference.`;
        } else {
          const skipped = reg.fields.filter((f, i) => !fieldIsCompared(effectiveAccess(f.access, reg.rights), before.regs[reg.name][i].compare)).map((f) => f.name);
          checkText = ` UVM_CHECK found no difference${skipped.length ? `; it skipped ${skipped.join(", ")} (volatile fields default to UVM_NO_CHECK, WO fields are never compared)` : ""}.`;
        }
      }
      const side = reg.fields
        .filter((f) => READ_CLEARS.includes(effectiveAccess(f.access, reg.rights)) || READ_SETS.includes(effectiveAccess(f.access, reg.rights)))
        .map((f) => `${f.name} is ${f.access}, so the read itself changed the DUT`);
      const adapterNote = env.readDataFromRequest
        ? ` bus2reg() read the request item (provides_responses = 0) whose data was never filled, so the test got ${showHex(r.data, reg.nBits)} instead of ${showHex(r.bus.data, reg.nBits)}.`
        : "";
      if (s.halted) {
        why = `The read reached the DUT, then the predictor stopped the simulation. ${s.halted}`;
      } else {
        why = `${op.kind === "read" ? "read()" : "mirror()"} performed a frontdoor read of ${showHex(r.bus.data, reg.nBits)}.${adapterNote}${checkText} ${
          ctx.predictions.length
            ? `${describePredictions(ctx.predictions)} predicted the read${side.length ? ` (${side.join("; ")}; the prediction applies the same rule)` : ""}.`
            : `Nothing predicted the read, so the mirror did not change${op.kind === "mirror" ? ": a frontdoor mirror() only refreshes the mirror through auto-predict or a predictor" : ""}.${side.length ? ` ${side.join("; ")}.` : ""}`
        }${stalenessNote(block, s, reg.name)}`;
      }
      break;
    }
    case "peek":
    case "poke": {
      if (!env.hdlPath) {
        status = "UVM_NOT_OK";
        ctx.messages.push({
          severity: "UVM_ERROR",
          id: "RegModel",
          text:
            op.kind === "peek"
              ? `No backdoor access available to peek register "${name}"`
              : `No backdoor access available to poke register '${name}'`,
        });
        why = `${op.kind}() needs a backdoor: give the register an HDL path (configure(…, hdl_path) or add_hdl_path_slice()). Nothing changed.`;
        noEffect = true;
        break;
      }
      status = "UVM_IS_OK";
      if (op.kind === "peek") {
        const raw = regValue(block, s, reg.name, "dut");
        returned = { label: "rdata", value: raw };
        doPredict(ctx, "UVM_PREDICT_READ", "BACKDOOR", raw, "backdoor do_predict");
        why = `peek() read ${showHex(raw, reg.nBits)} straight from the HDL with no side effects (an RC field is not cleared), then called do_predict(UVM_PREDICT_READ) itself: the mirror now equals the DUT. No bus traffic, so the predictor component saw nothing.`;
      } else {
        const v = and(op.value, fieldMask(reg.nBits));
        reg.fields.forEach((f, i) => {
          fields[i].dut = slice(v, f);
        });
        doPredict(ctx, "UVM_PREDICT_WRITE", "BACKDOOR", v, "backdoor do_predict");
        const ignored = reg.fields.filter((f) => f.access !== "RW" && f.access !== "WO").map((f) => `${f.name} (${f.access})`);
        why = `poke() deposited ${showHex(v, reg.nBits)} into the HDL, bypassing every access policy${
          ignored.length ? `, including ${ignored.join(", ")}` : ""
        }, then called do_predict(UVM_PREDICT_WRITE, UVM_BACKDOOR) itself: mirror and desired take the raw value. You do not need predict() after a poke.`;
      }
      break;
    }
    case "predict": {
      doPredict(ctx, "UVM_PREDICT_DIRECT", "DIRECT", op.value, "predict()");
      returned = { label: "return", value: 1 };
      why = `predict() with the default UVM_PREDICT_DIRECT sets mirrored and desired to ${showHex(and(op.value, fieldMask(reg.nBits)), reg.nBits)} with no policy and no bus or DUT access. Use it for changes the bus never shows, such as hardware events.${stalenessNote(block, s, reg.name)}`;
      break;
    }
    case "setCompare": {
      const idx = reg.fields.findIndex((f) => f.name === op.field);
      fields[idx].compare = op.check ? "UVM_CHECK" : "UVM_NO_CHECK";
      why = `set_compare() changes only whether mirror(UVM_CHECK) compares ${op.field}.`;
      break;
    }
    case "hw": {
      const idx = reg.fields.findIndex((f) => f.name === op.field);
      const f = reg.fields[idx];
      fields[idx].dut = and(op.value, fieldMask(f.size));
      why = `The DUT's own logic changed ${reg.name}.${f.name} to ${fieldHex(fields[idx].dut, f.size)}. No bus access happened, so neither a predictor nor auto-predict can know.${stalenessNote(block, s, reg.name)}`;
      break;
    }
  }

  return {
    ...base,
    after: s,
    bus,
    predictions: ctx.predictions,
    returned,
    status,
    messages: ctx.messages,
    why,
    noEffect,
  };
}

export interface RalRun {
  steps: RalStep[];
  final: RalState;
}

export function runOps(block: RalBlockSpec, env: RalEnv, ops: RalOp[], start: RalState = initialState(block)): RalRun {
  const steps: RalStep[] = [];
  let s = start;
  for (const op of ops) {
    const step = applyOp(block, env, s, op);
    steps.push(step);
    s = step.after;
  }
  return { steps, final: s };
}

export function countErrors(steps: RalStep[]): number {
  return steps.reduce((n, st) => n + st.messages.filter((m) => m.severity === "UVM_ERROR" || m.severity === "UVM_FATAL" || m.severity === "SIM_FATAL").length, 0);
}

export function busWriteCount(steps: RalStep[]): number {
  return steps.filter((st) => st.bus?.kind === "WRITE").length;
}

// ---------------------------------------------------------------------------
// Prediction prompts generated from the model
// ---------------------------------------------------------------------------

export interface ValueChoice {
  id: string;
  value: number;
  label: string;
  correct: boolean;
  feedback: string;
}

/**
 * Candidate answers for "what is get_mirrored_value() after this step?":
 * the model's answer plus the values common misconceptions produce, each
 * with feedback that names the misconception.
 */
export function mirroredChoices(block: RalBlockSpec, step: RalStep): ValueChoice[] {
  const op = step.op;
  if (op.kind === "reset") return [];
  const reg = findReg(block, op.reg);
  const correct = regValue(block, step.after, reg.name, "mirrored");
  const candidates: { value: number; feedback: string }[] = [];
  if ("value" in op && op.kind !== "hw") {
    candidates.push({
      value: and(op.value, fieldMask(reg.nBits)),
      feedback: "That copies the written value. The mirror is predicted field by field from each access policy, and only when something predicts the access.",
    });
  }
  candidates.push({
    value: regValue(block, step.before, reg.name, "mirrored"),
    feedback: "That assumes the mirror did not change. Check who predicts this call: a predictor, auto-predict, or the backdoor's own do_predict().",
  });
  candidates.push({
    value: regValue(block, step.after, reg.name, "dut"),
    feedback: "That is the DUT's actual value. The mirror is the model's belief; it follows the DUT only when an access is predicted.",
  });
  candidates.push({
    value: regValue(block, step.after, reg.name, "desired"),
    feedback: "That is get(), the desired value. set() and write() change it immediately; the mirror changes only through prediction.",
  });
  const seen = new Map<number, ValueChoice>();
  seen.set(correct, { id: `v${correct}`, value: correct, label: showHex(correct, reg.nBits), correct: true, feedback: step.why });
  for (const c of candidates) {
    if (seen.has(c.value)) continue;
    seen.set(c.value, { id: `v${c.value}`, value: c.value, label: showHex(c.value, reg.nBits), correct: false, feedback: c.feedback });
  }
  return [...seen.values()].sort((a, b) => a.value - b.value);
}

// ---------------------------------------------------------------------------
// Guided challenges (A-UVM-4A)
// ---------------------------------------------------------------------------

export type ChallengeAsk =
  | { kind: "mirrored"; reg: string }
  | { kind: "busWrites" }
  | { kind: "check"; reg: string; field: string }
  | { kind: "readTriple"; reg: string }
  | { kind: "desiredMirrored"; reg: string };

export interface RalChallenge {
  id: string;
  title: string;
  question: string;
  env: RalEnv;
  setup: RalOp[];
  ops: RalOp[];
  ask: ChallengeAsk;
  options: { id: string; label: string; answer: string; feedback: string }[];
}

export function challengeAnswer(block: RalBlockSpec, ch: RalChallenge): { answer: string; setup: RalRun; run: RalRun } {
  const setup = runOps(block, ch.env, ch.setup);
  const run = runOps(block, ch.env, ch.ops, setup.final);
  const f = run.final;
  let answer = "";
  switch (ch.ask.kind) {
    case "mirrored":
      answer = showHex(regValue(block, f, ch.ask.reg, "mirrored"));
      break;
    case "busWrites":
      answer = String(busWriteCount(run.steps));
      break;
    case "check": {
      const reg = findReg(block, ch.ask.reg);
      const idx = reg.fields.findIndex((x) => x.name === (ch.ask as { field: string }).field);
      answer = `${countErrors(run.steps) > 0 ? "error" : "ok"}:${f.regs[reg.name][idx].mirrored}`;
      break;
    }
    case "readTriple": {
      const ret = run.steps.find((st) => st.returned)?.returned?.value ?? 0;
      answer = `${ret}:${regValue(block, f, ch.ask.reg, "mirrored")}:${regValue(block, f, ch.ask.reg, "dut")}`;
      break;
    }
    case "desiredMirrored":
      answer = `${regValue(block, f, ch.ask.reg, "desired")}:${regValue(block, f, ch.ask.reg, "mirrored")}`;
      break;
  }
  return { answer, setup, run };
}

export const RAL_CHALLENGES: RalChallenge[] = [
  {
    id: "ro-bits",
    title: "Write all ones",
    question: "Explicit predictor connected. After ral.CTRL.write(status, 'hFFFF_FFFF), what does ral.CTRL.get_mirrored_value() return?",
    env: EXPLICIT_ENV,
    setup: [],
    ops: [{ kind: "write", reg: "CTRL", value: 0xffffffff }],
    ask: { kind: "mirrored", reg: "CTRL" },
    options: [
      { id: "all", label: "0xFFFF_FFFF", answer: showHex(0xffffffff), feedback: "That copies the bus data into the mirror. RSVD[31:4] is RO, so the predictor keeps its old value (0)." },
      { id: "rw", label: "0x0000_000F", answer: showHex(0xf), feedback: "Right. The predictor applies each field's policy: EN, IE and MODE are RW and take the bits; RSVD is RO and keeps 0." },
      { id: "none", label: "0x0000_0000", answer: showHex(0), feedback: "That would be true with no predictor and auto-predict off. Here the predictor sees the write on the bus." },
    ],
  },
  {
    id: "w1c",
    title: "Clear interrupts",
    question:
      "Hardware set DONE and ERR, and a read let the mirror learn 'h3. Now the test writes 'hFF to INT_STATUS (both fields W1C). What is the mirrored value afterwards?",
    env: EXPLICIT_ENV,
    setup: [
      { kind: "hw", reg: "INT_STATUS", field: "DONE", value: 1, note: "transfer complete" },
      { kind: "hw", reg: "INT_STATUS", field: "ERR", value: 1, note: "bus error" },
      { kind: "read", reg: "INT_STATUS" },
    ],
    ops: [{ kind: "write", reg: "INT_STATUS", value: 0xff }],
    ask: { kind: "mirrored", reg: "INT_STATUS" },
    options: [
      { id: "ff", label: "0x0000_00FF", answer: showHex(0xff), feedback: "That treats the fields as RW. For W1C, writing 1 clears the bit; the prediction is mirror & ~data. Bits [7:2] belong to no field." },
      { id: "keep", label: "0x0000_0003", answer: showHex(0x3), feedback: "That assumes W1C writes do not touch the mirror. The predictor applies W1C: 'h3 & ~'hFF = 0." },
      { id: "zero", label: "0x0000_0000", answer: showHex(0), feedback: "Right. W1C predicts mirror & ~data, so both bits clear, exactly like the DUT." },
    ],
  },
  {
    id: "update-twice",
    title: "set() then update(), twice",
    question: "On CTRL: set('h5); update(); set('h5); update(); — how many bus writes happen?",
    env: EXPLICIT_ENV,
    setup: [],
    ops: [
      { kind: "set", reg: "CTRL", value: 0x5 },
      { kind: "update", reg: "CTRL" },
      { kind: "set", reg: "CTRL", value: 0x5 },
      { kind: "update", reg: "CTRL" },
    ],
    ask: { kind: "busWrites" },
    options: [
      { id: "two", label: "2", answer: "2", feedback: "update() is not a write. It writes only when needs_update() is 1, that is when a desired value differs from the mirror (or a writable field is volatile)." },
      { id: "one", label: "1", answer: "1", feedback: "Right. After the first update() the predictor sets mirror = desired = 'h5, so the second update() finds nothing to do." },
      { id: "zero", label: "0", answer: "0", feedback: "set() never touches the bus; it only changes the desired value. update() is what writes." },
    ],
  },
  {
    id: "volatile",
    title: "Check a hardware-driven field",
    question: "BUSY is RO and configured volatile=1. Hardware sets BUSY to 1, then the test calls ral.STATUS.mirror(status, UVM_CHECK). What happens?",
    env: EXPLICIT_ENV,
    setup: [{ kind: "hw", reg: "STATUS", field: "BUSY", value: 1, note: "transfer running" }],
    ops: [{ kind: "mirror", reg: "STATUS", check: true }],
    ask: { kind: "check", reg: "STATUS", field: "BUSY" },
    options: [
      { id: "err", label: "UVM_ERROR: BUSY read 1, mirrored 0", answer: "error:1", feedback: "A volatile field gets UVM_NO_CHECK in configure(), so mirror(UVM_CHECK) skips it. To check it anyway, call BUSY.set_compare(UVM_CHECK)." },
      { id: "ok-upd", label: "No error, and the mirror now shows BUSY = 1", answer: "ok:1", feedback: "Right. The compare skips BUSY (volatile ⇒ UVM_NO_CHECK), and the predictor still updates the mirror from the read." },
      { id: "ok-stale", label: "No error, and the mirror still shows BUSY = 0", answer: "ok:0", feedback: "Skipping the compare does not skip prediction. The predictor saw the read and updated BUSY to 1." },
    ],
  },
  {
    id: "poke",
    title: "Backdoor poke",
    question: "With an HDL path configured, the test calls ral.CTRL.poke(status, 'hFFFF_FFFF). What is the mirrored value afterwards?",
    env: EXPLICIT_ENV,
    setup: [],
    ops: [{ kind: "poke", reg: "CTRL", value: 0xffffffff }],
    ask: { kind: "mirrored", reg: "CTRL" },
    options: [
      { id: "zero", label: "0x0000_0000", answer: showHex(0), feedback: "A common belief is that you must call predict() after a poke. poke() calls do_predict() itself; only the predictor component misses it (no bus traffic)." },
      { id: "policy", label: "0x0000_000F", answer: showHex(0xf), feedback: "That is the frontdoor answer. A backdoor poke deposits the raw value into the HDL, RO bits included, and predicts with the UVM_BACKDOOR door, which applies no policy." },
      { id: "raw", label: "0xFFFF_FFFF", answer: showHex(0xffffffff), feedback: "Right. poke() bypasses access policies in the DUT and in the prediction, so even RSVD becomes all ones." },
    ],
  },
  {
    id: "rc-read",
    title: "Read-to-clear counter",
    question: "NACK_CNT.COUNT is RC and hardware has counted 5 NACKs. The test calls ral.NACK_CNT.read(status, rdata). What are rdata, the mirror and the DUT afterwards?",
    env: EXPLICIT_ENV,
    setup: [{ kind: "hw", reg: "NACK_CNT", field: "COUNT", value: 5, note: "5 NACKs" }],
    ops: [{ kind: "read", reg: "NACK_CNT" }],
    ask: { kind: "readTriple", reg: "NACK_CNT" },
    options: [
      { id: "a", label: "rdata 5 · mirror 0 · DUT 0", answer: "5:0:0", feedback: "Right. The read returns 5 and clears the DUT; the prediction for an RC field is 0, so the mirror matches the DUT." },
      { id: "b", label: "rdata 5 · mirror 5 · DUT 0", answer: "5:5:0", feedback: "That copies the read data into the mirror. For RC fields do_predict(UVM_PREDICT_READ) predicts 0, because the read cleared the hardware." },
      { id: "c", label: "rdata 0 · mirror 0 · DUT 0", answer: "0:0:0", feedback: "The clear happens after the value is returned: the test sees 5." },
      { id: "d", label: "rdata 5 · mirror 5 · DUT 5", answer: "5:5:5", feedback: "RC means a read clears the hardware field, so the DUT is 0 after the read." },
    ],
  },
  {
    id: "default-env",
    title: "UVM defaults",
    question: "No uvm_reg_predictor and auto-predict left at its default. After ral.CTRL.write(status, 'h5), what do get() and get_mirrored_value() return?",
    env: DEFAULT_UVM_ENV,
    setup: [],
    ops: [{ kind: "write", reg: "CTRL", value: 0x5 }],
    ask: { kind: "desiredMirrored", reg: "CTRL" },
    options: [
      { id: "both", label: "get() 'h5 · mirror 'h5", answer: "5:5", feedback: "Auto-predict is off by default (uvm_reg_map::new sets it to 0), and nothing else predicts, so the mirror stays at its reset value." },
      { id: "split", label: "get() 'h5 · mirror 'h0", answer: "5:0", feedback: "Right. write() calls set(), so the desired value is 'h5, but nothing predicted the access: the mirror stays 'h0 while the DUT holds 'h5." },
      { id: "none", label: "get() 'h0 · mirror 'h0", answer: "0:0", feedback: "write() calls set() before the bus access, so get() returns 'h5 even without prediction." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Prediction paths (A-UVM-4B)
// ---------------------------------------------------------------------------

export type TrafficKind = "ral-write" | "firmware-write" | "ral-toggle" | "poke";

export const TRAFFIC: Record<TrafficKind, { label: string; op: RalOp }> = {
  "ral-write": { label: "ral.CTRL.write('h5)", op: { kind: "write", reg: "CTRL", value: 0x5 } },
  "firmware-write": { label: "firmware writes CTRL = 'h9", op: { kind: "busWrite", reg: "CTRL", value: 0x9, initiator: "firmware" } },
  "ral-toggle": { label: "ral.GPIO.write('h1) — LED is W1T", op: { kind: "write", reg: "GPIO", value: 0x1 } },
  poke: { label: "ral.CTRL.poke('h3)", op: { kind: "poke", reg: "CTRL", value: 0x3 } },
};

export const TRAFFIC_KINDS = Object.keys(TRAFFIC) as TrafficKind[];

export type PathNode = "test" | "ral" | "adapter" | "sqr" | "drv" | "dut" | "mon" | "pred" | "cpu";
export type PathEdge =
  | "test-ral"
  | "ral-adapter"
  | "adapter-sqr"
  | "sqr-drv"
  | "drv-dut"
  | "cpu-dut"
  | "dut-mon"
  | "mon-pred"
  | "pred-ral"
  | "auto"
  | "ral-dut-backdoor";

export interface PathBeat {
  id: string;
  node: PathNode;
  edge?: PathEdge;
  token?: string;
  tone: "ok" | "error" | "skip";
  what: string;
  why: string;
}

/** The six-beat story of one access: who carries it and who predicts it. Derived from the same step the table shows. */
export function predictionPath(block: RalBlockSpec, env: RalEnv, step: RalStep): PathBeat[] {
  const op = step.op;
  const beats: PathBeat[] = [];
  if (op.kind === "reset") return beats;
  const reg = findReg(block, op.reg);
  const hex = (v: number) => svHex(v);
  const predictorBeat = (bus: BusTransfer): PathBeat[] => {
    const out: PathBeat[] = [
      {
        id: "mon",
        node: "mon",
        edge: "dut-mon",
        token: bus.kind === "WRITE" ? "wr" : "rd",
        tone: "ok",
        what: `The bus monitor observes ${bus.kind} ${hex(bus.addr)} = ${hex(bus.data)} and calls ap.write(tr).`,
        why: "Monitors publish every transfer they see, whoever started it.",
      },
    ];
    if (env.predictor === "absent") {
      out.push({ id: "pred", node: "mon", tone: "skip", what: "No uvm_reg_predictor exists, so nobody turns the transfer into a prediction.", why: "Explicit prediction needs a predictor component in the env." });
      return out;
    }
    if (env.predictor === "unconnected") {
      out.push({
        id: "pred",
        node: "mon",
        edge: "mon-pred",
        tone: "error",
        what: "monitor.ap has no subscriber: the predictor's bus_in was never connected. The write() call goes nowhere, silently.",
        why: "An analysis port may legally have zero connections, so UVM reports nothing. The mirror goes stale.",
      });
      return out;
    }
    const fatal = step.messages.find((m) => m.severity === "UVM_FATAL" || m.severity === "SIM_FATAL");
    if (fatal) {
      out.push({ id: "pred", node: "pred", edge: "mon-pred", token: "tr", tone: "error", what: `predictor.bus_in.write(tr) runs, then: ${fatal.id} ${fatal.text}`, why: "predictor.map and predictor.adapter must be set in connect_phase." });
      return out;
    }
    const p = step.predictions.find((x) => x.source === "uvm_reg_predictor");
    out.push({
      id: "pred",
      node: "pred",
      edge: "pred-ral",
      token: "predict",
      tone: "ok",
      what: `The predictor calls adapter.bus2reg(), finds ${reg.name} with map.get_reg_by_offset(${hex(bus.addr)}), and calls do_predict(${p?.kind ?? "…"}).`,
      why: "The UVM_PREDICT door applies each field's access policy.",
    });
    return out;
  };

  if (op.kind === "poke" || op.kind === "peek") {
    beats.push({ id: "call", node: "test", edge: "test-ral", tone: "ok", what: `The test calls ${step.code}`, why: "Backdoor accesses go straight from the register model to the HDL." });
    if (step.status === "UVM_NOT_OK") {
      beats.push({ id: "bd", node: "ral", tone: "error", what: step.messages[0]?.text ?? "No backdoor available.", why: "Configure an HDL path first." });
      return beats;
    }
    beats.push({ id: "bd", node: "dut", edge: "ral-dut-backdoor", token: op.kind, tone: "ok", what: `uvm_hdl_${op.kind === "poke" ? "deposit" : "read"}() touches the DUT storage directly. No clock, no bus transfer.`, why: "Backdoor access ignores the bus protocol and the access policy." });
    beats.push({ id: "mon", node: "mon", tone: "skip", what: "The monitor sees nothing, so the uvm_reg_predictor is not involved.", why: "This is why a predictor-only env would miss backdoor changes, if poke()/peek() did not predict themselves." });
    beats.push({ id: "self", node: "ral", edge: "auto", token: "do_predict", tone: "ok", what: `${op.kind}() calls do_predict(${op.kind === "poke" ? "UVM_PREDICT_WRITE" : "UVM_PREDICT_READ"}, UVM_BACKDOOR) itself.`, why: "Backdoor accesses keep the mirror in sync without any predictor." });
    return beats;
  }

  if (op.kind === "busWrite") {
    beats.push({ id: "fw", node: "cpu", edge: "cpu-dut", token: "wr", tone: "ok", what: `${op.initiator ?? "Firmware"} drives WRITE ${hex(reg.offset)} = ${hex(op.value)} on the bus. The register model did not start it.`, why: "CPUs, DMA engines and other masters change registers without asking the RAL." });
    if (step.bus) beats.push(...predictorBeat(step.bus));
    beats.push({
      id: "auto",
      node: "ral",
      tone: "skip",
      what: `Auto-predict is ${env.autoPredict ? "on, but" : "off and"} only runs inside read()/write() calls the register model makes. It never sees this write.`,
      why: "Implicit prediction cannot track traffic from other initiators.",
    });
    return beats;
  }

  if (op.kind !== "write" && op.kind !== "read" && op.kind !== "mirror" && op.kind !== "update") return beats;
  const isRead = op.kind === "read" || op.kind === "mirror";
  beats.push({
    id: "call",
    node: "test",
    edge: "test-ral",
    tone: "ok",
    what: `The test calls ${step.code}`,
    why: isRead
      ? `${op.kind}() starts a frontdoor access through the map.`
      : op.kind === "update"
        ? "update() found needs_update() = 1 and calls write() with the value XupdateX computed."
        : "write() first calls set(), so the desired value changes before any bus activity.",
  });
  if (!step.bus) return beats;
  beats.push({ id: "reg2bus", node: "adapter", edge: "ral-adapter", token: "bus_op", tone: "ok", what: `default_map calls adapter.reg2bus() with {kind: ${isRead ? "UVM_READ" : "UVM_WRITE"}, addr: ${hex(step.bus.addr)}${isRead ? "" : `, data: ${hex(step.bus.data)}`}}.`, why: "The map owns the address; the adapter builds the protocol item." });
  beats.push({ id: "seq", node: "sqr", edge: "adapter-sqr", token: "item", tone: "ok", what: "The map runs the item on the sequencer that set_sequencer() registered (start_item/finish_item).", why: "Register accesses arbitrate like any other sequence item." });
  beats.push({ id: "drv", node: "dut", edge: "drv-dut", token: isRead ? "rd" : "wr", tone: "ok", what: `The driver performs ${step.bus.kind} ${hex(step.bus.addr)}${isRead ? ` and the DUT returns ${hex(step.bus.data)}` : ` = ${hex(step.bus.data)}`}.`, why: "The DUT applies its own field behaviour (RO ignores, W1C clears, RC clears on read…)." });
  beats.push(...predictorBeat(step.bus));
  if (!step.after.halted) {
    beats.push({
      id: "auto",
      node: "ral",
      edge: env.autoPredict ? "auto" : undefined,
      token: env.autoPredict ? "auto" : undefined,
      tone: env.autoPredict ? "ok" : "skip",
      what: env.autoPredict
        ? `${isRead ? "read()" : "write()"} returns and, because map.get_auto_predict() is 1, calls do_predict(${isRead ? "UVM_PREDICT_READ" : "UVM_PREDICT_WRITE"}) itself.${
            step.predictions.length > 1 ? " The predictor already did: this access is predicted twice." : ""
          }`
        : `${isRead ? "read()" : "write()"} returns. Auto-predict is off (the default), so the register does not predict itself.`,
      why: env.autoPredict ? "Implicit prediction: the register predicts the value it wrote, or the read data the adapter handed back, not what the monitor saw." : "With auto-predict off, the uvm_reg_predictor is the only thing that updates the mirror.",
    });
  }
  return beats;
}

/** One-line verdicts used by the three prediction modes table. */
export const PREDICTION_MODES = [
  {
    id: "implicit",
    name: "Implicit (auto-predict)",
    code: "ral.default_map.set_auto_predict(1);",
    updates: "read()/write() call do_predict() when the access completes",
    seesOtherTraffic: false,
    failure: "Misses firmware, DMA and other initiators; trusts the adapter round trip",
  },
  {
    id: "explicit",
    name: "Explicit (uvm_reg_predictor)",
    code: "agent.mon.ap.connect(predictor.bus_in);",
    updates: "The predictor, from every transfer the bus monitor publishes",
    seesOtherTraffic: true,
    failure: "A missing connect() or unset map/adapter: silent stale mirror or a fatal",
  },
  {
    id: "passive",
    name: "Passive",
    code: "// predictor on a bus the RAL never drives",
    updates: "The predictor only; the RAL issues no accesses on that bus",
    seesOtherTraffic: true,
    failure: "Same wiring risks as explicit; the test must not use frontdoor RAL calls on that map",
  },
] as const;

// ---------------------------------------------------------------------------
// Debug probes
// ---------------------------------------------------------------------------

export interface ProbeOutcome {
  id: string;
  label: string;
  reg: string;
  mirrored: number;
  dut: number;
  ok: boolean;
  note: string;
}

const PREDICTION_PROBES: { id: string; label: string; ops: RalOp[]; reg: string }[] = [
  { id: "ral-write", label: "ral.CTRL.write('h5)", ops: [{ kind: "write", reg: "CTRL", value: 0x5 }], reg: "CTRL" },
  { id: "firmware", label: "firmware writes CTRL = 'h9", ops: [{ kind: "busWrite", reg: "CTRL", value: 0x9, initiator: "firmware" }], reg: "CTRL" },
  { id: "toggle", label: "ral.GPIO.write('h1) (W1T LED)", ops: [{ kind: "write", reg: "GPIO", value: 0x1 }], reg: "GPIO" },
];

/**
 * Runs three probes from reset and reports whether the mirror tracks the DUT.
 * `afterEachWrite` lets a "fix" add calls (e.g. mirror()) after each access.
 */
export function runPredictionProbes(block: RalBlockSpec, env: RalEnv, afterEachWrite: (reg: string) => RalOp[] = () => []): ProbeOutcome[] {
  return PREDICTION_PROBES.map((p) => {
    const run = runOps(block, env, [...p.ops, ...afterEachWrite(p.reg)]);
    const mirrored = regValue(block, run.final, p.reg, "mirrored");
    const dut = regValue(block, run.final, p.reg, "dut");
    const fatal = run.steps.flatMap((s) => s.messages).find((m) => m.severity === "UVM_FATAL" || m.severity === "SIM_FATAL");
    const preds = run.steps.reduce((n, s) => n + s.predictions.length, 0);
    const ok = !fatal && mirrored === dut;
    const note = fatal
      ? `${fatal.severity} ${fatal.id}`
      : ok
        ? "mirror matches DUT"
        : preds > 1
          ? "predicted twice: mirror toggled back"
          : "stale mirror";
    return { id: p.id, label: p.label, reg: p.reg, mirrored, dut, ok, note };
  });
}
