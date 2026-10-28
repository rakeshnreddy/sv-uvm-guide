import { describe, expect, it } from "vitest";

import {
  EDGE_TABLE,
  describeTransition,
  edgeMatches,
  edgeOf,
  eventControlFires,
  isTrueCondition,
  lsbOf,
  parseEventExpression,
  termFires,
  valueChanged,
  type Bit4,
} from "@/lib/sv-event-control-model";

const BITS: Bit4[] = ["0", "1", "x", "z"];

describe("§9.4.2 Table 9-2: detecting posedge and negedge", () => {
  // Rows are the value before, columns the value after, exactly as Table 9-2 lays them out.
  const table: Record<Bit4, Record<Bit4, "posedge" | "negedge" | null>> = {
    "0": { "0": null, "1": "posedge", x: "posedge", z: "posedge" },
    "1": { "0": "negedge", "1": null, x: "negedge", z: "negedge" },
    x: { "0": "negedge", "1": "posedge", x: null, z: null },
    z: { "0": "negedge", "1": "posedge", x: null, z: null },
  };

  it.each(BITS.flatMap((from) => BITS.map((to) => [from, to] as const)))("from %s to %s", (from, to) => {
    expect(edgeOf(from, to)).toBe(table[from][to]);
    expect(EDGE_TABLE[from][to]).toBe(table[from][to]);
  });

  it("posedge is 0→1, 0→x, 0→z, x→1, z→1; negedge is 1→0, 1→x, 1→z, x→0, z→0", () => {
    const pos = BITS.flatMap((f) => BITS.filter((t) => edgeOf(f, t) === "posedge").map((t) => `${f}${t}`));
    const neg = BITS.flatMap((f) => BITS.filter((t) => edgeOf(f, t) === "negedge").map((t) => `${f}${t}`));
    expect(pos.sort()).toEqual(["01", "0x", "0z", "x1", "z1"].sort());
    expect(neg.sort()).toEqual(["10", "1x", "1z", "x0", "z0"].sort());
  });

  it("the `edge` keyword is detected whenever posedge or negedge is (§9.4.2)", () => {
    expect(edgeMatches("edge", "x", 0)).toBe(true);
    expect(edgeMatches("edge", 0, 1)).toBe(true);
    expect(edgeMatches("edge", "x", "z")).toBe(false);
  });

  it("narration names the Table 9-2 cell", () => {
    expect(describeTransition("x", 0)).toBe("x → 0 is a negedge (Table 9-2, from x to 0)");
    expect(describeTransition("x", "z")).toBe("x → z is no edge (Table 9-2, from x to z)");
  });
});

describe("§9.4.2: edges use the least significant bit; unchanged values are not events", () => {
  it("reads the LSB of numbers and of 4-state bit strings", () => {
    expect(lsbOf(6)).toBe("0");
    expect(lsbOf(7)).toBe("1");
    expect(lsbOf("10x")).toBe("x");
    expect(lsbOf("Z")).toBe("z");
  });

  it("an edge is detected on the LSB only: 2 → 3 is a posedge, 1 → 3 is no edge", () => {
    expect(edgeMatches("posedge", 2, 3)).toBe(true);
    expect(edgeMatches("posedge", 1, 3)).toBe(false);
    expect(edgeMatches("negedge", 3, 2)).toBe(true);
  });

  it("a change of value with the same LSB still wakes an any-change control, but not an edge control", () => {
    expect(termFires({ kind: "change", before: 1, after: 3 })).toBe(true);
    expect(termFires({ kind: "posedge", before: 1, after: 3 })).toBe(false);
  });

  it("a write that leaves the expression's value unchanged is not an event", () => {
    expect(valueChanged(1, "0001")).toBe(false);
    expect(valueChanged("X", "x")).toBe(false);
    expect(termFires({ kind: "change", before: "x", after: "x" })).toBe(false);
    expect(termFires({ kind: "change", before: 0, after: "x" })).toBe(true);
  });
});

describe("§9.4.2.1 event OR: `or` and `,` are the same operator", () => {
  it("parses both separators, and a mix of them, into the same terms", () => {
    const orList = parseEventExpression("posedge clk or negedge rst_n");
    expect(orList).toEqual([
      { kind: "posedge", expr: "clk" },
      { kind: "negedge", expr: "rst_n" },
    ]);
    expect(parseEventExpression("posedge clk, negedge rst_n")).toEqual(orList);
    expect(parseEventExpression("a or b, c").map((t) => t.expr)).toEqual(["a", "b", "c"]);
  });

  it("fires when any one term fires", () => {
    const r = eventControlFires([
      { kind: "posedge", before: 0, after: 0 },
      { kind: "negedge", before: "x", after: 0 },
    ]);
    expect(r).toEqual({ fires: true, firedBy: [1] });
    expect(eventControlFires([{ kind: "posedge", before: 1, after: 0 }]).fires).toBe(false);
  });

  it("does not split inside identifiers that contain 'or'", () => {
    expect(parseEventExpression("vector or order").map((t) => t.expr)).toEqual(["vector", "order"]);
  });
});

describe("§9.4.2.3 iff guards, with §12.4 truth", () => {
  it("iff binds tighter than or: `a iff en or b` is `(a iff en) or b`", () => {
    expect(parseEventExpression("a iff en or b")).toEqual([
      { kind: "change", expr: "a", iff: "en" },
      { kind: "change", expr: "b" },
    ]);
    expect(parseEventExpression("a iff (en or b)")).toEqual([{ kind: "change", expr: "a", iff: "(en or b)" }]);
  });

  it("the guard is checked when the expression changes and must be true", () => {
    expect(termFires({ kind: "change", before: 0, after: 1, guard: 1 })).toBe(true);
    expect(termFires({ kind: "change", before: 0, after: 1, guard: 0 })).toBe(false);
    // A guard that is true does not make an unchanged expression an event.
    expect(termFires({ kind: "change", before: 1, after: 1, guard: 1 })).toBe(false);
  });

  it("§12.4: x and z guards are false; a nonzero known value is true", () => {
    expect(termFires({ kind: "change", before: 0, after: 1, guard: "x" })).toBe(false);
    expect(termFires({ kind: "change", before: 0, after: 1, guard: "z" })).toBe(false);
    expect(isTrueCondition(5)).toBe(true);
    expect(isTrueCondition("0000")).toBe(false);
    expect(isTrueCondition("0100")).toBe(true);
    expect(isTrueCondition("xx")).toBe(false);
  });

  it("mixed known-1 and unknown bits are outside the model and say so", () => {
    expect(() => isTrueCondition("1x")).toThrow(/outside this model/);
  });
});

describe("input checking", () => {
  it("rejects strings that are not 4-state bit strings, and unsupported terms", () => {
    expect(() => lsbOf("2")).toThrow(RangeError);
    expect(() => parseEventExpression("posedge")).toThrow(SyntaxError);
    expect(() => parseEventExpression("a or")).toThrow(SyntaxError);
  });
});
