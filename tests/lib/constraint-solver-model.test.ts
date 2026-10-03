import { describe, expect, it } from "vitest";

import {
  classToSource,
  dist,
  distItemWeight,
  enumLabels,
  exprToSource,
  hard,
  itemToSource,
  legalValues,
  marginal,
  parseDistItems,
  parseExpr,
  probabilityOf,
  sampledMarginal,
  sampleRandomize,
  soft,
  solve,
  solveBefore,
  solveOrderStages,
  toFraction,
  type ClassModel,
  type ConstraintItem,
  type RandVarDecl,
} from "@/lib/constraint-solver-model";

const bits = (name: string, width: number, signed = false): RandVarDecl => ({ name, type: { kind: "bits", width, signed } });

const cls = (vars: RandVarDecl[], blocks: Array<[string, ConstraintItem[]]>, extra: Partial<ClassModel> = {}): ClassModel => ({
  className: "item",
  vars,
  blocks: blocks.map(([name, items]) => ({ name, items })),
  ...extra,
});

const p = (result: ReturnType<typeof solve>, name: string, value: number) => marginal(result, name).get(value) ?? 0;
const keys = (result: ReturnType<typeof solve>) => result.solutions.map((s) => s.key).sort();

describe("§18.5.9 uniform over legal combinations (joint-uniform)", () => {
  // The classic practice-page example: len < 5; data < len * 10.
  const lenData = cls([bits("len", 3), bits("data", 8)], [
    ["c_len", [hard("len < 5")]],
    ["c_data", [hard("data < len * 10")]],
  ]);

  it("biases toward len = 4 because len = 4 pairs with the most data values", () => {
    const r = solve(lenData);
    expect(r.status).toBe("ok");
    expect(r.solutions).toHaveLength(10 + 20 + 30 + 40);
    expect(p(r, "len", 4)).toBeCloseTo(40 / 100, 12);
    expect(p(r, "len", 1)).toBeCloseTo(10 / 100, 12);
    // len = 0 has no legal data value (data < 0), so it is not a legal value at all.
    expect(p(r, "len", 0)).toBe(0);
    for (const s of r.solutions) expect(s.probability).toBeCloseTo(1 / 100, 12);
  });

  it("solve len before data makes every legal len equally likely (and len = 0 stays illegal)", () => {
    const ordered = { ...lenData, blocks: [...lenData.blocks, { name: "c_order", items: [solveBefore(["len"], ["data"])] }] };
    const r = solve(ordered);
    for (const len of [1, 2, 3, 4]) expect(p(r, "len", len)).toBeCloseTo(0.25, 12);
    expect(p(r, "len", 0)).toBe(0);
  });

  it("reproduces the LRM table: P(s) is 1/(1+2^n) unordered and 1/2 with solve s before d", () => {
    const base = cls([bits("s", 1), bits("d", 8)], [["c", [hard("s -> d == 0")]]]);
    const unordered = solve(base);
    expect(probabilityOf(unordered, (x) => x.s === 1)).toBeCloseTo(1 / 257, 12);
    expect(probabilityOf(unordered, (x) => x.d === 0)).toBeCloseTo(2 / 257, 12);
    const ordered = solve({ ...base, blocks: [...base.blocks, { name: "order", items: [solveBefore(["s"], ["d"])] }] });
    expect(probabilityOf(ordered, (x) => x.s === 1)).toBeCloseTo(0.5, 12);
    expect(probabilityOf(ordered, (x) => x.d === 0)).toBeCloseTo(0.5 + 0.5 / 256, 12);
  });

  it("solve…before never changes the legal set and cannot make randomize() fail", () => {
    const base = cls([bits("x", 3), bits("y", 3)], [["c_sum", [hard("x + y < 8")]]]);
    const ordered = { ...base, blocks: [...base.blocks, { name: "c_order", items: [solveBefore(["x"], ["y"])] }] };
    expect(keys(solve(ordered))).toEqual(keys(solve(base)));
    expect(p(solve(base), "x", 0)).toBeCloseTo(8 / 36, 12);
    expect(p(solve(ordered), "x", 0)).toBeCloseTo(1 / 8, 12);
    const impossible = { ...ordered, blocks: [...ordered.blocks, { name: "c_no", items: [hard("x > 7")] }] };
    const r = solve(impossible);
    expect(r.status).toBe("unsat");
    expect(r.core.map((m) => m.clause.id)).toEqual(["c_no.0"]);
  });

  it("orders variables as late as possible: unordered variables join the last ordered set", () => {
    expect(solveOrderStages([["a", "b"]], ["a", "b", "c"])).toEqual([["a"], ["b", "c"]]);
    expect(solveOrderStages([["a", "b"], ["b", "c"], ["d", "c"]], ["a", "b", "c", "d", "e"])).toEqual([["a"], ["b", "d"], ["c", "e"]]);
    expect(() => solveOrderStages([["a", "b"], ["b", "a"]], ["a", "b"])).toThrow(/Circular/);
  });

  it("the order direction matters: solve kind before length vs solve length before kind", () => {
    const labels = { SMALL: 0, JUMBO: 1 };
    const packet: ClassModel = {
      className: "packet",
      vars: [bits("length", 5), { name: "kind", type: { kind: "enum", typeName: "kind_e", labels: ["SMALL", "JUMBO"] } }],
      blocks: [
        { name: "c_len", items: [hard("length inside {[4:16]}")] },
        { name: "c_kind", items: [hard("(kind == JUMBO) -> (length == 16)", labels)] },
      ],
    };
    const jumbo = (r: ReturnType<typeof solve>) => p(r, "kind", 1);
    expect(jumbo(solve(packet))).toBeCloseTo(1 / 14, 12);
    expect(jumbo(solve(packet, {}, { extraSolveBefore: [["kind", "length"]] }))).toBeCloseTo(1 / 2, 12);
    expect(jumbo(solve(packet, {}, { extraSolveBefore: [["length", "kind"]] }))).toBeCloseTo(1 / 26, 12);
  });
});

describe("§18.5.5 implication is the Boolean (!a || b), not 'evaluate a first'", () => {
  const lrm = cls([bits("a", 4), bits("b", 4)], [["c", [hard("(a == 0) -> (b == 1)")]]]);

  it("matches the LRM example: P(a == 0) = 1/241", () => {
    const r = solve(lrm);
    expect(r.solutions).toHaveLength(241);
    expect(p(r, "a", 0)).toBeCloseTo(1 / 241, 12);
  });

  it("has exactly the solution set of !(a == 0) || (b == 1)", () => {
    const boolean = cls([bits("a", 4), bits("b", 4)], [["c", [hard("!(a == 0) || (b == 1)")]]]);
    expect(keys(solve(lrm))).toEqual(keys(solve(boolean)));
  });

  it("works backwards: if b cannot be 1, a can never be 0", () => {
    const backwards = cls([bits("a", 4), bits("b", 4)], [
      ["c", [hard("(a == 0) -> (b == 1)")]],
      ["c_b", [hard("b == 0")]],
    ]);
    const r = solve(backwards);
    expect(r.status).toBe("ok");
    expect(p(r, "a", 0)).toBe(0);
    expect(legalValues(r, "a")).not.toContain(0);
  });

  it("if-else is the equivalent pair of implications (§18.5.6)", () => {
    const vars = [bits("mode", 2), bits("len", 4)];
    const ifElse: ConstraintItem = {
      kind: "ifElse",
      cond: parseExpr("mode == 0"),
      then: [hard("len < 3")],
      else: [hard("len > 12")],
    };
    const pair = cls(vars, [["c", [hard("(mode == 0) -> (len < 3)"), hard("(mode != 0) -> (len > 12)")]]]);
    expect(keys(solve(cls(vars, [["c", [ifElse]]])))).toEqual(keys(solve(pair)));
  });

  it("the I-SV-2B lesson example: is_write = 1 only 16/272 of the time (array elements do not weigh in)", () => {
    const pkt: ClassModel = {
      className: "pkt",
      vars: [bits("is_write", 1), bits("addr", 8)],
      arrays: [{ name: "data", elem: { kind: "bits", width: 8 }, maxSize: 255 }],
      blocks: [
        { name: "c_addr", items: [hard("is_write -> addr inside {[0:15]}")] },
        { name: "c_size", items: [hard("data.size() == addr")] },
      ],
    };
    const r = solve(pkt);
    expect(p(r, "is_write", 1)).toBeCloseTo(16 / 272, 12);
  });
});

describe("§18.5.3 dist", () => {
  const x9 = [bits("x", 9)];

  it("weights are ratios: {100:=1, 200:=2, 300:=5} gives 1:2:5 and := equals :/ on single values", () => {
    for (const items of ["100:=1, 200:=2, 300:=5", "100:/1, 200:/2, 300:/5"]) {
      const r = solve(cls(x9, [["d", [dist("x", items)]]]));
      expect(p(r, "x", 100)).toBeCloseTo(1 / 8, 12);
      expect(p(r, "x", 200)).toBeCloseTo(2 / 8, 12);
      expect(p(r, "x", 300)).toBeCloseTo(5 / 8, 12);
      expect(r.solutions).toHaveLength(3);
    }
  });

  it("a value excluded by another constraint leaves the others in their ratio (x != 200 gives 1:5)", () => {
    const r = solve(cls(x9, [["d", [dist("x", "100:=1, 200:=2, 300:=5")]], ["c", [hard("x != 200")]]]));
    expect(p(r, "x", 100)).toBeCloseTo(1 / 6, 12);
    expect(p(r, "x", 300)).toBeCloseTo(5 / 6, 12);
  });

  it(":= on a range weighs every value; :/ splits the weight across the range", () => {
    const perValue = solve(cls([bits("x", 3)], [["d", [dist("x", "0 := 4, [1:3] := 4")]]]));
    const split = solve(cls([bits("x", 3)], [["d", [dist("x", "0 := 4, [1:3] :/ 4")]]]));
    expect(p(perValue, "x", 0)).toBeCloseTo(4 / 16, 12);
    expect(p(perValue, "x", 2)).toBeCloseTo(4 / 16, 12);
    expect(p(split, "x", 0)).toBeCloseTo(4 / 8, 12);
    expect(p(split, "x", 2)).toBeCloseTo(4 / 3 / 8, 12);
    // dist is also a membership test: 4..7 are illegal in both.
    for (const r of [perValue, split]) for (const x of [4, 5, 6, 7]) expect(p(r, "x", x)).toBe(0);
    expect(distItemWeight(parseDistItems("[1:3] := 4")[0])).toBe(12);
    expect(distItemWeight(parseDistItems("[1:3] :/ 4")[0])).toBe(4);
  });

  it("{[100:102]:=1, 103:=1} equals {[100:102]:/3, 103:=1}", () => {
    const a = solve(cls(x9, [["d", [dist("x", "[100:102]:=1, 103:=1")]]]));
    const b = solve(cls(x9, [["d", [dist("x", "[100:102]:/3, 103:=1")]]]));
    for (const x of [100, 101, 102, 103]) expect(p(a, "x", x)).toBeCloseTo(p(b, "x", x), 12);
    expect(p(a, "x", 103)).toBeCloseTo(1 / 4, 12);
  });

  it("the range weight applies to the range as a whole: x > 101 with {[100:102]:=1, 103:=1} gives 102:103 = 3:1", () => {
    const r = solve(cls(x9, [["c", [hard("x > 101")]], ["d", [dist("x", "[100:102]:=1, 103:=1")]]]));
    expect(p(r, "x", 102)).toBeCloseTo(3 / 4, 12);
    expect(p(r, "x", 103)).toBeCloseTo(1 / 4, 12);
  });

  it("weights of a value listed in several items add up (four LRM spellings of 1:2:1)", () => {
    for (const items of ["[100:102]:=1, 101:=1", "[100:101]:/1, [101:102]:/1", "100:/1, 101:/2, 102:/1", "100:/1, 101:/1, 101:/1, 102:/1"]) {
      const r = solve(cls(x9, [["d", [dist("x", items)]]]));
      expect(p(r, "x", 100)).toBeCloseTo(1 / 4, 12);
      expect(p(r, "x", 101)).toBeCloseTo(2 / 4, 12);
      expect(p(r, "x", 102)).toBeCloseTo(1 / 4, 12);
    }
    const zeroPlusRange = solve(cls(x9, [["d", [dist("x", "100:/0, [100:102]:/1")]]]));
    for (const x of [100, 101, 102]) expect(p(zeroPlusRange, "x", x)).toBeCloseTo(1 / 3, 12);
  });

  it("the explorer's {8 := 80, [4:16] :/ 20}: 8 is in both items, so it gets 80 + 20/13 of 100", () => {
    const r = solve(cls([bits("length", 5)], [
      ["c_len", [hard("length inside {[4:16]}")]],
      ["c_dist", [dist("length", "8 := 80, [4:16] :/ 20")]],
    ]));
    expect(p(r, "length", 8)).toBeCloseTo(0.8 + 0.2 / 13, 12);
    expect(p(r, "length", 4)).toBeCloseTo(0.2 / 13, 12);
  });

  it("the I-SV-2A opcode dist: 0 → 10%, each of 1..3 → 70%/3, each of 8..F → 2.5%, 4..7 impossible", () => {
    const r = solve(cls([bits("opcode", 4)], [["opcode_dist", [dist("opcode", "4'h0 := 10, [4'h1:4'h3] :/ 70, [4'h8:4'hF] :/ 20")]]]));
    expect(p(r, "opcode", 0)).toBeCloseTo(0.1, 12);
    expect(p(r, "opcode", 2)).toBeCloseTo(0.7 / 3, 12);
    expect(p(r, "opcode", 9)).toBeCloseTo(0.025, 12);
    expect(p(r, "opcode", 5)).toBe(0);
  });

  it("nonzero weights never cause failure, but membership and zero weights are hard constraints", () => {
    const weighted = solve(cls([bits("x", 3)], [["d", [dist("x", "0 := 1000, [1:3] := 1")]], ["c", [hard("x == 2")]]]));
    expect(weighted.status).toBe("ok");
    expect(p(weighted, "x", 2)).toBe(1);
    const zero = solve(cls([bits("x", 3)], [["d", [dist("x", "0 := 0, 1 := 1")]], ["c", [hard("x == 0")]]]));
    expect(zero.status).toBe("unsat");
    expect(zero.core.map((m) => m.clause.id).sort()).toEqual(["c.0", "d.0"]);
    const outside = solve(cls([bits("x", 3)], [["d", [dist("x", "0 := 4, [1:3] :/ 4")]], ["c", [hard("x > 3")]]]));
    expect(outside.status).toBe("unsat");
  });
});

describe("§18.5.13 soft constraints are priorities, not probabilities", () => {
  const x3 = [bits("x", 3), bits("y", 3)];

  it("an uncontested soft constraint holds every time (P = 1, not 90%)", () => {
    const r = solve(cls(x3, [["c_def", [soft("x == 0")]]]));
    expect(p(r, "x", 0)).toBe(1);
    expect(r.keptSoft.map((c) => c.id)).toEqual(["c_def.0"]);
  });

  it("a soft constraint that conflicts with a hard one is discarded; the rest stays uniform", () => {
    const r = solve(cls(x3, [["c_def", [soft("x == 0")]], ["c_range", [hard("x inside {[2:7]}")]]]));
    expect(p(r, "x", 0)).toBe(0);
    for (const x of [2, 3, 4, 5, 6, 7]) expect(p(r, "x", x)).toBeCloseTo(1 / 6, 12);
    expect(r.droppedSoft).toEqual([expect.objectContaining({ reason: "hard", conflictsWith: ["c_range.0"] })]);
  });

  it("between conflicting soft constraints the later declaration wins (§18.5.13.1)", () => {
    const r = solve(cls(x3, [["c_def", [soft("x == 0")]], ["c_late", [soft("x == 5")]]]));
    expect(p(r, "x", 5)).toBe(1);
    expect(r.droppedSoft[0].clause.id).toBe("c_def.0");
    expect(r.droppedSoft[0].conflictsWith).toEqual(["c_late.0"]);
    const swapped = solve(cls(x3, [["c_late", [soft("x == 5")]], ["c_def", [soft("x == 0")]]]));
    expect(p(swapped, "x", 0)).toBe(1);
  });

  it("inline with constraints beat class constraints (§18.5.13.1, §18.7)", () => {
    const base = cls(x3, [["c_def", [soft("x == 0")]]]);
    expect(p(solve(base, { inline: [soft("x == 3")] }), "x", 3)).toBe(1);
    const hardInline = solve(base, { inline: [hard("x > 3")] });
    for (const x of [4, 5, 6, 7]) expect(p(hardInline, "x", x)).toBeCloseTo(1 / 4, 12);
  });

  it("only soft constraints can never fail, and consistent softs act like hard ones", () => {
    const onlySoft = solve(cls(x3, [["a", [soft("x == 1")]], ["b", [soft("x == 2")]], ["c", [soft("x + y > 20")]]]));
    expect(onlySoft.status).toBe("ok");
    const consistent = cls(x3, [["a", [soft("x < 4")]], ["b", [soft("y == x")]]]);
    const asHard = cls(x3, [["a", [hard("x < 4")]], ["b", [hard("y == x")]]]);
    expect(keys(solve(consistent))).toEqual(keys(solve(asHard)));
  });

  it("disable soft discards lower-priority soft constraints on that variable (§18.5.13.2 A1/A2/A3)", () => {
    const r = solve(cls([bits("x", 4)], [
      ["A1", [soft("x == 3")]],
      ["A2", [{ kind: "disableSoft", variable: "x" }]],
      ["A3", [soft("x inside {1, 2}")]],
    ]));
    expect(legalValues(r, "x")).toEqual([1, 2]);
    expect(r.droppedSoft.map((d) => d.reason)).toEqual(["disable-soft"]);
  });

  it("a soft dist that can be satisfied together with an earlier soft gives that value (§18.5.13.2 B1/B3)", () => {
    const b3 = solve(cls([bits("x", 4)], [["B1", [soft("x == 5")]], ["B3", [dist("x", "5, 8", { soft: true })]]]));
    expect(p(b3, "x", 5)).toBe(1);
    const b2 = solve(cls([bits("x", 4)], [["B1", [soft("x == 5")]], ["B2", [{ kind: "disableSoft", variable: "x" }, dist("x", "5, 8", { soft: true })]]]));
    expect(p(b2, "x", 5)).toBeCloseTo(0.5, 12);
    expect(p(b2, "x", 8)).toBeCloseTo(0.5, 12);
  });

  it("I-SV-2A pitfall: a top-level soft default silently forbids secure mode, even with solve…before", () => {
    const buggy = cls([bits("is_secure", 1), bits("burst_len", 2)], [
      ["burst_rules", [soft("burst_len == 2'b10"), hard("is_secure -> burst_len == 2'b01")]],
      ["order", [solveBefore(["is_secure"], ["burst_len"])]],
    ]);
    expect(p(solve(buggy), "is_secure", 1)).toBe(0);
    const fixed = cls([bits("is_secure", 1), bits("burst_len", 2)], [
      ["burst_rules", [hard("is_secure -> burst_len == 2'b01"), { kind: "implies", cond: parseExpr("!is_secure"), body: [soft("burst_len == 2'b10")] }]],
    ]);
    expect(p(solve(fixed), "is_secure", 1)).toBeCloseTo(0.5, 12);
  });
});

describe("§18.6.3 failure and the minimal conflicting subset", () => {
  const debug = cls([bits("x", 3), bits("y", 3)], [
    ["c_sum", [hard("x + y < 6")]],
    ["c_x", [hard("x > 3")]],
    ["c_y", [hard("y > 2")]],
    ["c_odd", [hard("y % 2 == 1")]],
  ]);

  it("returns a minimal core that excludes innocent constraints", () => {
    const r = solve(debug);
    expect(r.status).toBe("unsat");
    expect(r.failureProbability).toBe(1);
    expect(r.core.map((m) => m.clause.id)).toEqual(["c_sum.0", "c_x.0", "c_y.0"]);
    expect(r.core.every((m) => m.removalFixes)).toBe(true);
    // Every member is needed: removing any one makes the set satisfiable.
    for (const id of ["c_sum", "c_x", "c_y"]) expect(solve(debug, { disabledBlocks: [id] }).status).toBe("ok");
    // The innocent constraint alone does not fix it.
    expect(solve(debug, { disabledBlocks: ["c_odd"] }).status).toBe("unsat");
  });

  it("rand_mode(0) holds a variable at its value and can be part of the conflict (§18.8)", () => {
    const r = solve(debug, { disabledBlocks: ["c_sum", "c_x", "c_y"], stateVars: { y: 4 } });
    expect(r.status).toBe("unsat");
    expect(r.core.map((m) => m.clause.id).sort()).toEqual(["c_odd.0", "rand_mode:y"]);
    const held = solve(debug, { disabledBlocks: ["c_sum", "c_x", "c_y"], stateVars: { y: 5 } });
    expect(p(held, "y", 5)).toBe(1);
    expect(p(held, "x", 3)).toBeCloseTo(1 / 8, 12);
  });

  it("constraint_mode(0) removes a block; unknown names are rejected (§18.9)", () => {
    expect(() => solve(debug, { disabledBlocks: ["nope"] })).toThrow(/unknown block/);
  });

  it("the I-SV-2B lab premise: these constraints never fail; IPV6 is silently never generated", () => {
    const labels = { IPV4: 0, IPV6: 1, RAW: 2 };
    const lab: ClassModel = {
      className: "packet",
      vars: [{ name: "proto", type: { kind: "enum", typeName: "protocol_t", labels: ["IPV4", "IPV6", "RAW"] } }, bits("length", 9)],
      blocks: [
        { name: "c_proto_len", items: [hard("(proto == IPV4) -> length inside {[20:60]}", labels), hard("(proto == IPV6) -> length == 40", labels)] },
        { name: "c_hardware_limit", items: [hard("length inside {16, 32, 64, 128, 256}")] },
      ],
    };
    const r = solve(lab);
    expect(r.status).toBe("ok");
    expect(r.failureProbability).toBe(0);
    expect(p(r, "proto", labels.IPV6)).toBe(0);
    expect(p(r, "proto", labels.IPV4)).toBeCloseTo(1 / 6, 12);
    const forced = solve(lab, { inline: [hard("proto == IPV6", labels)] });
    expect(forced.status).toBe("unsat");
    expect(forced.core.map((m) => m.clause.id).sort()).toEqual(["c_hardware_limit.0", "c_proto_len.1", "with.0"]);
  });

  it("the solver-debug lesson example is a three-constraint conflict", () => {
    const r = solve({
      className: "Packet",
      vars: [bits("size", 4)],
      arrays: [{ name: "payload", elem: { kind: "bits", width: 8 }, maxSize: 15 }],
      blocks: [
        { name: "c_size", items: [hard("size > 10")] },
        { name: "c_len", items: [hard("payload.size() < 5")] },
        { name: "c_match", items: [hard("payload.size() == size")] },
      ],
    });
    expect(r.core.map((m) => m.clause.id)).toEqual(["c_size.0", "c_len.0", "c_match.0"]);
  });
});

describe("§18.5.7.1 array sizes are solved before elements", () => {
  const withArray = (sizeRange: string, elementRule: string): ClassModel => ({
    className: "frame",
    vars: [bits("len", 3)],
    arrays: [{ name: "payload", elem: { kind: "bits", width: 2 }, maxSize: 7 }],
    blocks: [
      { name: "c_len", items: [hard(`len inside {${sizeRange}}`)] },
      { name: "c_size", items: [hard("payload.size() == len")] },
      { name: "c_elems", items: [{ kind: "foreach", array: "payload", index: "i", body: [hard(elementRule)] }] },
    ],
  });

  it("each size is equally likely even though longer arrays have many more element combinations", () => {
    const r = solve(withArray("[1:4]", "payload[i] != 3"));
    for (const len of [1, 2, 3, 4]) expect(p(r, "len", len)).toBeCloseTo(0.25, 12);
    const completions = r.solutions.map((s) => s.elementCompletions);
    expect(completions).toEqual([3, 9, 27, 81]);
  });

  it("element constraints that cannot hold for the chosen size make randomize() fail", () => {
    const r = solve(withArray("[1:6]", "payload[i] == i"));
    // payload[4] == 4 is impossible for a 2-bit element, so sizes 5 and 6 fail.
    expect(r.failureProbability).toBeCloseTo(2 / 6, 12);
  });
});

describe("seeded sampling (run randomize() N times)", () => {
  const coupling = cls([bits("x", 3), bits("y", 3)], [["c_sum", [hard("x + y < 8")]]]);

  it("is reproducible for a seed and converges to the exact distribution", () => {
    const r = solve(coupling);
    const a = sampleRandomize(r, 20000, 7);
    const b = sampleRandomize(r, 20000, 7);
    expect([...a.counts.entries()]).toEqual([...b.counts.entries()]);
    const counts = sampledMarginal(r, a, "x");
    for (const [x, exact] of marginal(r, "x")) expect((counts.get(x) ?? 0) / 20000).toBeCloseTo(exact, 1);
  });

  it("a satisfiable problem never reports a failed randomize()", () => {
    const lenData = cls([bits("len", 3), bits("data", 8)], [["c_len", [hard("len < 5")]], ["c_data", [hard("data < len * 10")]]]);
    expect(sampleRandomize(solve(lenData), 1000, 1).failures).toBe(0);
  });
});

describe("generated SystemVerilog stays in sync with the model data", () => {
  it("round-trips expressions and prints dist, implication and inline calls", () => {
    for (const src of ["x + y < 8", "(x == 0) -> (y == 0)", "x inside {[2:7]}", "y % 2 == 1", "!is_secure"]) {
      const e = parseExpr(src);
      expect(parseExpr(exprToSource(e))).toEqual(e);
    }
    expect(exprToSource(parseExpr("(x == 0) -> (y == 0)"))).toBe("(x == 0) -> (y == 0)");
    expect(itemToSource(dist("x", "0 := 4, [1:3] :/ 4"))).toBe("x dist { 0 := 4, [1:3] :/ 4 };");
    const model = cls([bits("x", 3), bits("y", 3)], [["c_sum", [hard("x + y < 8")]], ["c_order", [solveBefore(["x"], ["y"])]]]);
    const text = classToSource(model, { disabledBlocks: ["c_order"], stateVars: { y: 4 }, inline: [hard("x != 0")] }).map((l) => l.text);
    expect(text).toContain("  rand bit [2:0] x, y;");
    expect(text).toContain("  constraint c_sum { x + y < 8; }");
    expect(text).toContain("  constraint c_order { solve x before y; }");
    expect(text).toContain("p.c_order.constraint_mode(0);");
    expect(text).toContain("p.y = 4; p.y.rand_mode(0);");
    expect(text).toContain("ok = p.randomize() with { x != 0; };");
  });

  it("prints enum labels and sized literals as written", () => {
    const model: ClassModel = {
      className: "packet",
      vars: [{ name: "kind", type: { kind: "enum", typeName: "kind_e", labels: ["SMALL", "JUMBO"] } }],
      blocks: [],
    };
    expect(exprToSource(parseExpr("kind == JUMBO", enumLabels(model)))).toBe("kind == JUMBO");
    expect(exprToSource(parseExpr("burst_len == 2'b10"))).toBe("burst_len == 2'b10");
    expect(classToSource(model)[0].text).toBe("typedef enum {SMALL, JUMBO} kind_e;");
  });

  it("formats exact probabilities as small fractions", () => {
    expect(toFraction(1 / 13)).toBe("1/13");
    expect(toFraction(8 / 36)).toBe("2/9");
    expect(toFraction(1 / 241)).toBe("1/241");
  });
});
