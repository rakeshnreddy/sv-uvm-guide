import { describe, expect, it } from "vitest";

import {
  compareObjects,
  comparePredictionOptions,
  compareScenarios,
  defaultFields,
  fieldMacroLine,
  noFlagWarning,
  opEnabled,
  printObject,
  runCopy,
  type CompareSetup,
  type FieldSpec,
} from "@/lib/uvm-policy-model";

const scenario = (id: string) => compareScenarios.find((s) => s.id === id)!.setup;

describe("uvm-policy-model: field flags (uvm_object_defines.svh `m_uvm_field_op_begin)", () => {
  it("UVM_ALL_ON enables compare, copy and print", () => {
    expect(["COMPARE", "COPY", "PRINT"].every((op) => opEnabled({ allOn: true }, op as "COMPARE"))).toBe(true);
  });

  it("UVM_ALL_ON | UVM_NOCOMPARE removes the field from compare only", () => {
    const f = { allOn: true, noCompare: true };
    expect(opEnabled(f, "COMPARE")).toBe(false);
    expect(opEnabled(f, "COPY")).toBe(true);
    expect(opEnabled(f, "PRINT")).toBe(true);
  });

  it("UVM_NOCOMPARE without UVM_ALL_ON is a no-op for every operation and warns (1800.2, Mantis 7187)", () => {
    const field: FieldSpec = { name: "tag", kind: "int", bits: 8, flags: { allOn: false, noCompare: true } };
    expect(opEnabled(field.flags, "COMPARE")).toBe(false);
    expect(opEnabled(field.flags, "PRINT")).toBe(false);
    expect(opEnabled(field.flags, "COPY")).toBe(false);
    expect(noFlagWarning(field)).toMatch(/UVM\/FIELDS\/NO_FLAG/);
    expect(fieldMacroLine(field)).toBe("`uvm_field_int(tag, UVM_NOCOMPARE)");
  });
});

describe("uvm-policy-model: compare() (uvm_comparer.svh compare_object)", () => {
  it("default threshold 1 stops after the first miscompare: two differing fields → get_result() = 1", () => {
    const r = compareObjects(scenario("two-diffs"));
    expect(r.returned).toBe(0);
    expect(r.result).toBe(1);
    expect(r.steps.find((s) => s.field === "tag")?.status).toBe("skipped-threshold");
  });

  it("threshold 0 (unlimited) counts both miscompares; show_max 1 prints one and says so in the summary", () => {
    const r = compareObjects({ ...scenario("two-diffs"), threshold: 0 });
    expect(r.result).toBe(2);
    expect(r.miscompares).toHaveLength(2);
    expect(r.printed.filter((p) => p.includes("Miscompare for"))).toHaveLength(1);
    expect(r.printed.at(-1)).toContain("2 Miscompare(s) (1 shown) for object exp@12 vs. act@15");
  });

  it("miscompare messages are UVM_INFO [MISCMP], not errors", () => {
    const r = compareObjects(scenario("two-diffs"));
    expect(r.printed[0]).toBe("UVM_INFO @ 0: reporter [MISCMP] Miscompare for exp.data: lhs = 'hcafe : rhs = 'hcaff");
    expect(r.printed.every((p) => p.startsWith("UVM_INFO"))).toBe(true);
  });

  it("UVM_NOCOMPARE excludes the only differing field: compare() returns 1", () => {
    const r = compareObjects(scenario("nocompare"));
    expect(r.returned).toBe(1);
    expect(r.result).toBe(0);
    expect(r.printed).toEqual([]);
  });

  it("UVM_REFERENCE: different handles with equal contents miscompare; deep compare matches", () => {
    const ref = compareObjects(scenario("reference"));
    expect(ref.returned).toBe(0);
    expect(ref.miscompares[0]).toBe("exp.cfg: lhs = @7 : rhs = @9");
    const deep = compareObjects({ ...scenario("reference"), fields: defaultFields() });
    expect(deep.returned).toBe(1);
  });

  it("deep compare recurses into a nested object that differs", () => {
    const base = scenario("reference");
    const setup: CompareSetup = { ...base, fields: defaultFields(), heap: { ...base.heap, 9: { id: 9, burst_len: 8 } } };
    const r = compareObjects(setup);
    expect(r.miscompares).toEqual(["exp.cfg.burst_len: lhs = 'h4 : rhs = 'h8"]);
  });

  it("macros AND do_compare() both run: do_compare returning 1 cannot hide a macro miscompare", () => {
    const r = compareObjects(scenario("macros-plus-do-compare"));
    expect(r.doCompareReturned).toBe(1);
    expect(r.returned).toBe(0);
    expect(r.result).toBe(1);
  });

  it("a failing do_compare() makes compare() return 0 even with no counted miscompare", () => {
    const base = scenario("nocompare");
    const r = compareObjects({ ...base, userDoCompare: ["tag"] });
    expect(r.result).toBe(0);
    expect(r.returned).toBe(0);
  });

  it("the same handle matches without looking at fields", () => {
    const base = scenario("two-diffs");
    const r = compareObjects({ ...base, rhs: base.lhs });
    expect(r.returned).toBe(1);
    expect(r.steps[0].status).toBe("same-handle");
  });

  it("each scenario's prediction options contain exactly one correct answer, all distinct", () => {
    for (const s of compareScenarios) {
      const opts = comparePredictionOptions(s.setup);
      expect(opts.filter((o) => o.correct)).toHaveLength(1);
      expect(new Set(opts.map((o) => o.id)).size).toBe(opts.length);
      expect(opts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("the threshold misconception appears as a wrong option for two differing fields", () => {
    const opts = comparePredictionOptions(scenario("two-diffs"));
    const two = opts.find((o) => o.result === 2);
    expect(two?.correct).toBe(false);
    expect(two?.feedback).toMatch(/threshold is 1/);
  });
});

describe("uvm-policy-model: copy() (uvm_copier_defines.svh `uvm_copy_object)", () => {
  it("field macro deep copy creates a new nested object: p1 is unaffected", () => {
    const r = runCopy("macro-deep");
    expect(r.shared).toBe(false);
    expect(r.p1BurstAfter).toBe(4);
    expect(r.p2BurstAfter).toBe(8);
    expect(r.p2.cfg).not.toBe(r.p1.cfg);
  });

  it("UVM_REFERENCE copies the handle: p1 sees the change", () => {
    const r = runCopy("macro-reference");
    expect(r.shared).toBe(true);
    expect(r.p1BurstAfter).toBe(8);
  });

  it("a hand-written do_copy with cfg = rhs_.cfg aliases the nested object", () => {
    const r = runCopy("manual-alias");
    expect(r.p2.cfg).toBe(r.p1.cfg);
    expect(r.p1BurstAfter).toBe(8);
  });

  it("do_copy with clone() gives p2 its own object", () => {
    expect(runCopy("manual-clone").p1BurstAfter).toBe(4);
  });
});

describe("uvm-policy-model: print() (uvm_printer.svh)", () => {
  const { lhs, heap } = scenario("two-diffs");

  it("table printer lists nested fields under a deep object", () => {
    const out = printObject("table", defaultFields(), lhs, heap).join("\n");
    expect(out).toMatch(/Name\s+Type\s+Size\s+Value/);
    expect(out).toMatch(/cfg\s+pkt_cfg\s+-\s+@7/);
    expect(out).toMatch(/burst_len\s+integral\s+8\s+'h4/);
  });

  it("UVM_REFERENCE prints only the object header, no nested fields", () => {
    const fields = defaultFields().map((f) => (f.name === "cfg" ? { ...f, flags: { allOn: true, reference: true } } : f));
    const out = printObject("tree", fields, lhs, heap).join("\n");
    expect(out).toContain("cfg: (pkt_cfg@7)");
    expect(out).not.toContain("burst_len");
  });

  it("UVM_NOPRINT and a flag without UVM_ALL_ON both hide the field", () => {
    const fields = defaultFields().map((f) =>
      f.name === "tag" ? { ...f, flags: { allOn: false, noCompare: true } } : f.name === "parity" ? { ...f, flags: { allOn: true, noPrint: true } } : f,
    );
    const out = printObject("line", fields, lhs, heap).join("\n");
    expect(out).not.toContain("tag:");
    expect(out).not.toContain("parity:");
    expect(out).toContain("addr: 'h40");
  });
});
