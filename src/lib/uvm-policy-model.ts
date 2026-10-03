/**
 * Deterministic model of uvm_object policy operations — compare(), copy() and
 * print() — driven by `uvm_field_* macro flags and policy knobs.
 *
 * Rules checked against uvm-core 2020.3.1 (IEEE 1800.2-2020 reference implementation):
 *  - macros/uvm_object_defines.svh `m_uvm_field_op_begin: an operation runs only when
 *    FLAG contains that operation (e.g. UVM_COMPARE, part of UVM_ALL_ON) and not its
 *    UVM_NO<OP> bit. A flag such as UVM_NOCOMPARE without UVM_ALL_ON enables no
 *    operation at all and issues UVM/FIELDS/NO_FLAG (Mantis 7187; B.2.2.1).
 *  - base/uvm_comparer.svh compare_object(): same handle → match without looking;
 *    field automation (do_execute_op) runs first, then the user's do_compare(); if
 *    do_compare() returns 1 but the miscompare count grew, the result is 0. So macros and
 *    do_compare() BOTH run and their results combine (16.3.3.4).
 *    Defaults: threshold 1 (comparison stops counting after the first miscompare,
 *    `m_uvm_compare_threshold_begin), show_max 1, sev UVM_INFO, verbosity UVM_LOW (16.3).
 *    Messages: "Miscompare for <ctx>: lhs = 'h.. : rhs = 'h.." and
 *    "<n> Miscompare(s) [(<m> shown)] for object <lhs>@<id> vs. <rhs>@<id>" (id MISCMP).
 *    With UVM_REFERENCE, two different handles miscompare even if their contents are
 *    equal ("lhs = @7 : rhs = @9").
 *  - macros/uvm_copier_defines.svh `uvm_copy_object: UVM_REFERENCE (or a null rhs)
 *    copies the handle; otherwise a missing target is created with rhs.create() and
 *    the contents are copied (deep copy, 16.6). A hand-written do_copy copies exactly
 *    what it says: `cfg = rhs_.cfg;` shares the nested object.
 *  - base/uvm_printer.svh print_object(): UVM_REFERENCE prints only the object header
 *    (no nested fields); uvm_printer::set_default()/get_default() select the printer
 *    used by print() (16.2). The UVM 1.2 global `uvm_default_printer` is not in 1800.2.
 */

export type PolicyOp = "COMPARE" | "COPY" | "PRINT";

export interface FieldFlags {
  /** UVM_ALL_ON (or UVM_DEFAULT) is part of the flag. */
  allOn: boolean;
  noCompare?: boolean;
  noCopy?: boolean;
  noPrint?: boolean;
  /** Object fields only: operate on the handle. */
  reference?: boolean;
}

export interface FieldSpec {
  name: string;
  kind: "int" | "object";
  bits?: number;
  flags: FieldFlags;
}

export interface CfgObject {
  id: number;
  burst_len: number;
}

export interface PacketObject {
  /** Instance name (get_name()). */
  name: string;
  id: number;
  addr: number;
  data: number;
  parity: number;
  tag: number;
  /** Handle to a pkt_cfg on the heap, or null. */
  cfg: number | null;
}

export type Heap = Record<number, CfgObject>;

export const INT_FIELDS = ["addr", "data", "parity", "tag"] as const;
export type IntFieldName = (typeof INT_FIELDS)[number];

const INT_BITS: Record<IntFieldName, number> = { addr: 32, data: 32, parity: 1, tag: 8 };

export function defaultFields(): FieldSpec[] {
  return [
    ...INT_FIELDS.map((name) => ({ name, kind: "int" as const, bits: INT_BITS[name], flags: { allOn: true } })),
    { name: "cfg", kind: "object", flags: { allOn: true } },
  ];
}

export function flagText(f: FieldFlags): string {
  const parts: string[] = [];
  if (f.allOn) parts.push("UVM_ALL_ON");
  if (f.noCompare) parts.push("UVM_NOCOMPARE");
  if (f.noCopy) parts.push("UVM_NOCOPY");
  if (f.noPrint) parts.push("UVM_NOPRINT");
  if (f.reference) parts.push("UVM_REFERENCE");
  return parts.length ? parts.join(" | ") : "0";
}

/** `m_uvm_field_op_begin (non-legacy semantics). */
export function opEnabled(f: FieldFlags, op: PolicyOp): boolean {
  if (!f.allOn) return false;
  if (op === "COMPARE") return !f.noCompare;
  if (op === "COPY") return !f.noCopy;
  return !f.noPrint;
}

/** `m_warn_if_no_positive_ops: a flag with NO_* bits but no positive operation. */
export function noFlagWarning(field: FieldSpec): string | null {
  const f = field.flags;
  if (f.allOn) return null;
  if (!(f.noCompare || f.noCopy || f.noPrint || f.reference)) return null;
  return `UVM_WARNING [UVM/FIELDS/NO_FLAG] Field macro for ${field.name} uses FLAG without or'ing any explicit UVM_xxx actions. Per IEEE 1800.2-2020, it is treated as a NO-OP.`;
}

export function fieldMacroLine(field: FieldSpec): string {
  const macro = field.kind === "int" ? "uvm_field_int" : "uvm_field_object";
  return `\`${macro}(${field.name}, ${flagText(field.flags)})`;
}

export function hex(n: number): string {
  return `'h${n.toString(16)}`;
}

// ---------------------------------------------------------------------------
// compare()
// ---------------------------------------------------------------------------

export interface CompareSetup {
  fields: FieldSpec[];
  lhs: PacketObject;
  rhs: PacketObject;
  heap: Heap;
  /** set_threshold(); 0 = unlimited. Default 1. */
  threshold: number;
  /** set_show_max(); 0 = unlimited. Default 1. */
  showMax: number;
  /** A user do_compare() that compares these fields with == and returns the AND, without calling the comparer. */
  userDoCompare?: IntFieldName[];
}

export type CompareStatus = "equal" | "miscompare" | "skipped-flag" | "skipped-threshold" | "same-handle";

export interface CompareStep {
  field: string;
  flag: string;
  status: CompareStatus;
  lhs: string;
  rhs: string;
  why: string;
}

export interface CompareResult {
  /** Return value of lhs.compare(rhs). */
  returned: 0 | 1;
  /** comparer.get_result(): miscompares counted. */
  result: number;
  steps: CompareStep[];
  /** MISCMP messages actually printed (UVM_INFO, verbosity UVM_LOW). */
  printed: string[];
  /** Every miscompare, also the unprinted ones (get_miscompares()). */
  miscompares: string[];
  doCompareReturned?: 0 | 1;
  warnings: string[];
}

export const COMPARER_DEFAULTS = { threshold: 1, showMax: 1 } as const;

export function compareObjects(setup: CompareSetup): CompareResult {
  const { lhs, rhs, heap, threshold, showMax } = setup;
  const steps: CompareStep[] = [];
  const printed: string[] = [];
  const miscompares: string[] = [];
  const warnings = setup.fields.map(noFlagWarning).filter((w): w is string => Boolean(w));
  let result = 0;

  const record = (ctx: string) => {
    result += 1;
    miscompares.push(ctx);
    if (showMax === 0 || result <= showMax) printed.push(`UVM_INFO @ 0: reporter [MISCMP] Miscompare for ${ctx}`);
  };
  const underThreshold = () => threshold === 0 || result < threshold;

  if (lhs.id === rhs.id) {
    return { returned: 1, result: 0, steps: [{ field: "(object)", flag: "", status: "same-handle", lhs: `@${lhs.id}`, rhs: `@${rhs.id}`, why: "Same handle: compare() returns 1 without looking at any field." }], printed, miscompares, warnings };
  }

  for (const field of setup.fields) {
    const flag = flagText(field.flags);
    if (field.kind === "int") {
      const name = field.name as IntFieldName;
      const l = lhs[name];
      const r = rhs[name];
      const base = { field: name, flag, lhs: hex(l), rhs: hex(r) };
      if (!opEnabled(field.flags, "COMPARE")) {
        steps.push({ ...base, status: "skipped-flag", why: field.flags.allOn ? "UVM_NOCOMPARE: not compared." : "No positive operation in the flag: the macro does nothing for this field." });
        continue;
      }
      if (!underThreshold()) {
        steps.push({ ...base, status: "skipped-threshold", why: `Threshold ${threshold} reached: the macros stop comparing.` });
        continue;
      }
      if (l === r) {
        steps.push({ ...base, status: "equal", why: "Equal." });
      } else {
        record(`${lhs.name}.${name}: lhs = ${hex(l)} : rhs = ${hex(r)}`);
        steps.push({ ...base, status: "miscompare", why: "Values differ: one miscompare." });
      }
      continue;
    }

    // Object field (cfg).
    const lId = lhs.cfg;
    const rId = rhs.cfg;
    const show = (h: number | null) => (h === null ? "null" : `@${h}`);
    const base = { field: field.name, flag, lhs: show(lId), rhs: show(rId) };
    if (!opEnabled(field.flags, "COMPARE")) {
      steps.push({ ...base, status: "skipped-flag", why: field.flags.allOn ? "UVM_NOCOMPARE: not compared." : "No positive operation in the flag." });
      continue;
    }
    if (!underThreshold()) {
      steps.push({ ...base, status: "skipped-threshold", why: `Threshold ${threshold} reached.` });
      continue;
    }
    if (lId === rId) {
      steps.push({ ...base, status: "equal", why: "Same handle: equal without recursion." });
      continue;
    }
    if (field.flags.reference || lId === null || rId === null) {
      record(`${lhs.name}.${field.name}: lhs = ${show(lId)} : rhs = ${show(rId)}`);
      steps.push({
        ...base,
        status: "miscompare",
        why: field.flags.reference ? "UVM_REFERENCE compares handles: two different objects miscompare even with equal contents." : "One handle is null.",
      });
      continue;
    }
    const lb = heap[lId].burst_len;
    const rb = heap[rId].burst_len;
    if (lb === rb) {
      steps.push({ ...base, lhs: `@${lId} {burst_len ${lb}}`, rhs: `@${rId} {burst_len ${rb}}`, status: "equal", why: "Deep compare: different objects, equal contents." });
    } else {
      record(`${lhs.name}.${field.name}.burst_len: lhs = ${hex(lb)} : rhs = ${hex(rb)}`);
      steps.push({ ...base, lhs: `@${lId} {burst_len ${lb}}`, rhs: `@${rId} {burst_len ${rb}}`, status: "miscompare", why: "Deep compare found a nested difference." });
    }
  }

  let returned: 0 | 1 = 1;
  let doCompareReturned: 0 | 1 | undefined;
  if (setup.userDoCompare) {
    doCompareReturned = setup.userDoCompare.every((f) => lhs[f] === rhs[f]) ? 1 : 0;
    returned = doCompareReturned;
  }
  if (returned === 1 && result > 0) returned = 0;
  if (returned === 0) {
    const prefix = result === 0 ? "" : showMax !== 0 && showMax < result ? `${result} Miscompare(s) (${showMax} shown) for object ` : `${result} Miscompare(s) for object `;
    printed.push(`UVM_INFO @ 0: reporter [MISCMP] ${prefix}${lhs.name}@${lhs.id} vs. ${rhs.name}@${rhs.id}`);
  }
  return { returned, result, steps, printed, miscompares, doCompareReturned, warnings };
}

// ---------------------------------------------------------------------------
// copy()
// ---------------------------------------------------------------------------

export type CopyImpl = "macro-deep" | "macro-reference" | "manual-alias" | "manual-clone";

export interface CopyRun {
  impl: CopyImpl;
  /** Heap after p2.copy(p1); p2.cfg.burst_len = 8; */
  heap: Heap;
  p1: PacketObject;
  p2: PacketObject;
  shared: boolean;
  p1BurstAfter: number;
  p2BurstAfter: number;
  why: string;
}

export function copyImplLines(impl: CopyImpl): string[] {
  switch (impl) {
    case "macro-deep":
      return ["`uvm_object_utils_begin(packet)", "  `uvm_field_int(addr, UVM_ALL_ON)", "  `uvm_field_object(cfg, UVM_ALL_ON)", "`uvm_object_utils_end"];
    case "macro-reference":
      return ["`uvm_object_utils_begin(packet)", "  `uvm_field_int(addr, UVM_ALL_ON)", "  `uvm_field_object(cfg, UVM_ALL_ON | UVM_REFERENCE)", "`uvm_object_utils_end"];
    case "manual-alias":
      return [
        "virtual function void do_copy(uvm_object rhs);",
        "  packet rhs_;",
        "  super.do_copy(rhs);",
        "  $cast(rhs_, rhs);",
        "  addr = rhs_.addr;",
        "  cfg  = rhs_.cfg;      // copies the handle",
        "endfunction",
      ];
    case "manual-clone":
      return [
        "virtual function void do_copy(uvm_object rhs);",
        "  packet rhs_;",
        "  super.do_copy(rhs);",
        "  $cast(rhs_, rhs);",
        "  addr = rhs_.addr;",
        "  if (rhs_.cfg != null) $cast(cfg, rhs_.cfg.clone());",
        "endfunction",
      ];
  }
}

export const COPY_TEST_LINES = [
  "p1 = packet::type_id::create(\"p1\");",
  "p1.cfg = pkt_cfg::type_id::create(\"cfg\");",
  "p1.cfg.burst_len = 4;",
  "p2 = packet::type_id::create(\"p2\");",
  "p2.copy(p1);",
  "p2.cfg.burst_len = 8;",
  "$display(\"p1 burst_len = %0d\", p1.cfg.burst_len);",
];

export function runCopy(impl: CopyImpl): CopyRun {
  // packet@1 (p1) → pkt_cfg@2; packet@3 (p2) starts with cfg = null.
  const heap: Heap = { 2: { id: 2, burst_len: 4 } };
  const p1: PacketObject = { name: "p1", id: 1, addr: 0x40, data: 0, parity: 0, tag: 0, cfg: 2 };
  const p2: PacketObject = { name: "p2", id: 3, addr: 0, data: 0, parity: 0, tag: 0, cfg: null };
  p2.addr = p1.addr;
  const shared = impl === "macro-reference" || impl === "manual-alias";
  if (shared) {
    p2.cfg = p1.cfg;
  } else {
    heap[4] = { id: 4, burst_len: heap[2].burst_len };
    p2.cfg = 4;
  }
  heap[p2.cfg as number] = { ...heap[p2.cfg as number], burst_len: 8 };
  const why: Record<CopyImpl, string> = {
    "macro-deep": "`uvm_field_object with UVM_ALL_ON deep-copies: p2.cfg was null, so the copier creates a new pkt_cfg with p1.cfg.create() and copies its fields. Changing p2.cfg leaves p1.cfg alone.",
    "macro-reference": "UVM_REFERENCE tells the copier to copy the handle. p1 and p2 now share one pkt_cfg, so writing through p2 changes what p1 sees.",
    "manual-alias": "do_copy runs exactly the code you wrote. cfg = rhs_.cfg copies a handle, not an object, so both packets share one pkt_cfg — the classic aliasing bug.",
    "manual-clone": "clone() creates a new pkt_cfg and copies into it, so p2 owns its own configuration.",
  };
  return { impl, heap, p1, p2, shared, p1BurstAfter: heap[2].burst_len, p2BurstAfter: heap[p2.cfg as number].burst_len, why: why[impl] };
}

// ---------------------------------------------------------------------------
// print()
// ---------------------------------------------------------------------------

export type PrinterKind = "table" | "tree" | "line";

export const printerDefaultCall: Record<PrinterKind, string> = {
  table: "uvm_printer::set_default(uvm_table_printer::get_default());",
  tree: "uvm_printer::set_default(uvm_tree_printer::get_default());",
  line: "uvm_printer::set_default(uvm_line_printer::get_default());",
};

interface Row {
  depth: number;
  name: string;
  type: string;
  size: string;
  value: string;
  /** Object header with children. */
  children?: Row[];
}

function printableRows(fields: FieldSpec[], obj: PacketObject, heap: Heap): Row[] {
  const rows: Row[] = [];
  for (const field of fields) {
    if (!opEnabled(field.flags, "PRINT")) continue;
    if (field.kind === "int") {
      const n = field.name as IntFieldName;
      rows.push({ depth: 1, name: n, type: "integral", size: String(field.bits), value: hex(obj[n]) });
    } else {
      const h = obj.cfg;
      if (h === null) {
        rows.push({ depth: 1, name: field.name, type: "pkt_cfg", size: "-", value: "<null>" });
      } else if (field.flags.reference) {
        rows.push({ depth: 1, name: field.name, type: "pkt_cfg", size: "-", value: `@${h}` });
      } else {
        rows.push({
          depth: 1,
          name: field.name,
          type: "pkt_cfg",
          size: "-",
          value: `@${h}`,
          children: [{ depth: 2, name: "burst_len", type: "integral", size: "8", value: hex(heap[h].burst_len) }],
        });
      }
    }
  }
  return rows;
}

/**
 * Output of obj.print() with the default printer set to `kind`.
 * Column widths are simplified; the structure matches uvm_table/tree/line_printer.
 */
export function printObject(kind: PrinterKind, fields: FieldSpec[], obj: PacketObject, heap: Heap): string[] {
  const rows = printableRows(fields, obj, heap);
  const flat: Row[] = [];
  rows.forEach((r) => {
    flat.push(r);
    r.children?.forEach((c) => flat.push(c));
  });
  if (kind === "table") {
    const all = [{ depth: 0, name: obj.name, type: "packet", size: "-", value: `@${obj.id}` }, ...flat];
    const nameW = Math.max(4, ...all.map((r) => r.name.length + r.depth * 2)) + 2;
    const typeW = Math.max(4, ...all.map((r) => r.type.length)) + 2;
    const sizeW = 6;
    const line = "-".repeat(nameW + typeW + sizeW + 8);
    const fmt = (r: { depth: number; name: string; type: string; size: string; value: string }) =>
      `${(" ".repeat(r.depth * 2) + r.name).padEnd(nameW)}${r.type.padEnd(typeW)}${r.size.padEnd(sizeW)}${r.value}`;
    return [line, fmt({ depth: 0, name: "Name", type: "Type", size: "Size", value: "Value" }), line, ...all.map(fmt), line];
  }
  if (kind === "tree") {
    const out = [`${obj.name}: (packet@${obj.id}) {`];
    for (const r of rows) {
      if (r.children) {
        out.push(`  ${r.name}: (pkt_cfg${r.value}) {`);
        r.children.forEach((c) => out.push(`    ${c.name}: ${c.value}`));
        out.push("  }");
      } else if (r.type === "pkt_cfg") {
        out.push(`  ${r.name}: (pkt_cfg${r.value === "<null>" ? "" : r.value}) ${r.value === "<null>" ? "<null>" : ""}`.trimEnd());
      } else {
        out.push(`  ${r.name}: ${r.value}`);
      }
    }
    out.push("}");
    return out;
  }
  const parts = rows.map((r) => {
    if (r.children) return `${r.name}: (pkt_cfg${r.value}) { ${r.children.map((c) => `${c.name}: ${c.value}`).join("  ")} }`;
    if (r.type === "pkt_cfg") return `${r.name}: (pkt_cfg${r.value})`;
    return `${r.name}: ${r.value}`;
  });
  return [`${obj.name}: (packet@${obj.id}) { ${parts.join("  ")} }`];
}

// ---------------------------------------------------------------------------
// Compare scenarios (prediction presets)
// ---------------------------------------------------------------------------

export interface CompareScenario {
  id: string;
  title: string;
  summary: string;
  setup: CompareSetup;
}

function packets(overrides: Partial<PacketObject> = {}, cfgBurst = 4, sharedCfg = false) {
  const heap: Heap = { 7: { id: 7, burst_len: 4 } };
  const exp: PacketObject = { name: "exp", id: 12, addr: 0x40, data: 0xcafe, parity: 1, tag: 3, cfg: 7 };
  let actCfg = 7;
  if (!sharedCfg) {
    heap[9] = { id: 9, burst_len: cfgBurst };
    actCfg = 9;
  }
  const act: PacketObject = { name: "act", id: 15, addr: 0x40, data: 0xcafe, parity: 1, tag: 3, cfg: actCfg, ...overrides };
  return { exp, act, heap };
}

function withFlags(changes: Record<string, FieldFlags>): FieldSpec[] {
  return defaultFields().map((f) => (changes[f.name] ? { ...f, flags: changes[f.name] } : f));
}

export const compareScenarios: CompareScenario[] = (() => {
  const twoDiffs = packets({ data: 0xcaff, tag: 7 });
  const tagOnly = packets({ tag: 7 });
  const sameContents = packets();
  const dataDiff = packets({ data: 0xcaff });
  return [
    {
      id: "two-diffs",
      title: "Two fields differ",
      summary: "data and tag differ; every field uses UVM_ALL_ON; default comparer.",
      setup: { fields: defaultFields(), lhs: twoDiffs.exp, rhs: twoDiffs.act, heap: twoDiffs.heap, ...COMPARER_DEFAULTS },
    },
    {
      id: "nocompare",
      title: "Exclude tag",
      summary: "Only tag differs, and tag is declared UVM_ALL_ON | UVM_NOCOMPARE.",
      setup: { fields: withFlags({ tag: { allOn: true, noCompare: true } }), lhs: tagOnly.exp, rhs: tagOnly.act, heap: tagOnly.heap, ...COMPARER_DEFAULTS },
    },
    {
      id: "reference",
      title: "UVM_REFERENCE on cfg",
      summary: "exp.cfg and act.cfg are different objects with equal contents; cfg uses UVM_ALL_ON | UVM_REFERENCE.",
      setup: { fields: withFlags({ cfg: { allOn: true, reference: true } }), lhs: sameContents.exp, rhs: sameContents.act, heap: sameContents.heap, ...COMPARER_DEFAULTS },
    },
    {
      id: "macros-plus-do-compare",
      title: "Macros + do_compare()",
      summary: "data differs. The class has field macros AND a do_compare() that only checks addr.",
      setup: { fields: defaultFields(), lhs: dataDiff.exp, rhs: dataDiff.act, heap: dataDiff.heap, ...COMPARER_DEFAULTS, userDoCompare: ["addr"] },
    },
  ];
})();

export interface ComparePredictionOption {
  id: string;
  returned: 0 | 1;
  result: number;
  correct: boolean;
  feedback: string;
}

/** Options for "what does exp.compare(act) return, and what does get_result() count?" */
export function comparePredictionOptions(setup: CompareSetup): ComparePredictionOption[] {
  const truth = compareObjects(setup);
  const options: ComparePredictionOption[] = [];
  const add = (r: CompareResult | { returned: 0 | 1; result: number }, feedback: string) => {
    const id = `${r.returned}-${r.result}`;
    if (options.some((o) => o.id === id)) return;
    options.push({ id, returned: r.returned, result: r.result, correct: r.returned === truth.returned && r.result === truth.result, feedback });
  };
  add(truth, explainCompare(setup, truth));
  add(compareObjects({ ...setup, threshold: 0 }), "That counts every differing field. The default comparer threshold is 1: after the first miscompare the field macros stop comparing, so get_result() stays at 1.");
  add(
    compareObjects({ ...setup, fields: defaultFields(), userDoCompare: setup.userDoCompare }),
    "That ignores the field flags. UVM_NOCOMPARE removes a field from compare(); UVM_REFERENCE compares handles instead of contents.",
  );
  if (setup.userDoCompare) {
    const onlyUser = setup.userDoCompare.every((f) => setup.lhs[f] === setup.rhs[f]);
    add({ returned: onlyUser ? 1 : 0, result: 0 }, "That treats do_compare() as replacing the macros. In UVM both run: field automation first, then do_compare(), and a miscompare from either makes compare() return 0.");
  }
  add({ returned: 1, result: 0 }, "A match needs every compared field to be equal (and, for UVM_REFERENCE, the same handle).");
  add({ returned: 0, result: 2 }, "Count only fields whose flags enable compare, and remember the default threshold of 1.");
  return options.slice(0, 4);
}

function explainCompare(setup: CompareSetup, r: CompareResult): string {
  const miss = r.steps.filter((s) => s.status === "miscompare").map((s) => s.field);
  const skippedThreshold = r.steps.filter((s) => s.status === "skipped-threshold").map((s) => s.field);
  const parts: string[] = [];
  if (miss.length) parts.push(`${miss.join(", ")} miscompare${miss.length > 1 ? "" : "s"}`);
  if (skippedThreshold.length) parts.push(`threshold ${setup.threshold} stops the macros before ${skippedThreshold.join(", ")}`);
  const flagged = r.steps.filter((s) => s.status === "skipped-flag").map((s) => s.field);
  if (flagged.length) parts.push(`${flagged.join(", ")} ${flagged.length > 1 ? "are" : "is"} excluded by ${flagged.length > 1 ? "their flags" : "its flag"}`);
  if (setup.userDoCompare) parts.push(`do_compare() also runs and returns ${r.doCompareReturned}, but the macro miscompare already makes the result 0`);
  const head = `compare() returns ${r.returned}; get_result() = ${r.result}.`;
  return parts.length ? `${head} ${parts.join("; ")}.` : `${head} Every compared field is equal.`;
}
