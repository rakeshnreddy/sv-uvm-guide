import { describe, expect, it } from "vitest";

import { buildEnv, annotateTree, parseExpression, formatDecimal, fromBits, type ExprNode } from "@/lib/sv-expression-model";
import {
  EXCLUDED_NOTE,
  MIN_GROUPING_OPTIONS,
  GROUPING_UNAVAILABLE,
  PLAYGROUND_DECLS,
  PRECEDENCE_ROWS,
  WIDTH_CHOICES,
  analyzeExpression,
  analyzePrecedence,
  analyzeWidth,
  bowlsOf,
  findPrecedencePreset,
  findWidthPreset,
  fullGrouping,
  groupingOptions,
  ifOutcome,
  isParenthesization,
  layoutTree,
  operatorTokens,
  precedencePresets,
  rootExplanation,
  rootOperatorId,
  rowOfOperator,
  storedOptions,
  tapFeedback,
  widthOptions,
  widthPresets,
} from "@/lib/sv-expression-tree-presets";

const binaryRows = PRECEDENCE_ROWS.filter((r) => r.rank > 1 && r.label !== "?: (conditional operator)");
const binaryOps = binaryRows.flatMap((r) => r.operators).filter((o) => o !== "inside");
const unwrap = (n: ExprNode): ExprNode => (n.kind === "paren" ? unwrap(n.inner) : n);

describe("§11.3.2 Table 11-2: the explorer's rows agree with parseExpression", () => {
  it("Table 11-2 row order: for every pair of binary operators, the higher row takes its operands first", () => {
    for (const op1 of binaryOps) {
      for (const op2 of binaryOps) {
        const r1 = rowOfOperator(op1)!;
        const r2 = rowOfOperator(op2)!;
        const root = unwrap(parseExpression(`a ${op1} b ${op2} c`));
        expect(root.kind).toBe("binary");
        if (root.kind !== "binary") continue;
        // Same row: left to right (§11.3.2), so the second operator is the root, like a tighter first operator.
        const expected = r1.rank <= r2.rank ? op2 : op1;
        expect(root.op, `${op1} vs ${op2}`).toBe(expected);
      }
    }
  });
  it("Table 11-2 unary row: a unary operator binds tighter than every binary operator", () => {
    for (const u of ["-", "+", "!", "~", "&", "|", "^", "~&", "~|", "~^", "^~"]) {
      for (const op of binaryOps) {
        const root = unwrap(parseExpression(`${u}a ${op} b`));
        expect(root.kind, `${u}a ${op} b`).toBe("binary");
      }
    }
  });
  it("§11.3.2: ?: has the lowest precedence here and groups right to left", () => {
    for (const op of binaryOps) {
      const root = unwrap(parseExpression(`a ${op} b ? c : d`));
      expect(root.kind, op).toBe("cond");
    }
    expect(fullGrouping(parseExpression("s ? x : t ? y : z"))).toBe("s ? x : (t ? y : z)");
    expect(fullGrouping(parseExpression("a ? b : c ? d : e ? f : g"))).toBe("a ? b : (c ? d : (e ? f : g))");
  });
  it("Table 11-2: inside shares the row of < <= > >=, so it groups left to right with them and sits below + and above ==", () => {
    const rootOf = (s: string) => unwrap(parseExpression(s));
    for (const op of ["<", "<=", ">", ">="]) {
      expect(rootOf(`a ${op} b inside {c}`).kind, op).toBe("inside");
      const r = rootOf(`a inside {c} ${op} b`);
      expect(r.kind === "binary" && r.op, op).toBe(op);
    }
    expect(fullGrouping(parseExpression("a < b inside {c}"))).toBe("(a < b) inside {c}");
    expect(fullGrouping(parseExpression("a + b inside {c}"))).toBe("(a + b) inside {c}");
    expect(rootOf("a + b inside {c}").kind).toBe("inside");
    const eq = rootOf("a == b inside {c}");
    expect(eq.kind === "binary" && eq.op).toBe("==");
    expect(rowOfOperator("inside")!.label).toBe("< <= > >= inside dist");
  });
  it("Table 11-2 unary ^~ binds tighter than binary &, and keeps its spelling", () => {
    expect(fullGrouping(parseExpression("^~a & b"))).toBe("(^~a) & b");
    expect(fullGrouping(parseExpression("a ^~ b & c"))).toBe("a ^~ (b & c)");
  });
  it("Table 11-2 lists ** as left-associative and == above binary &", () => {
    expect(rowOfOperator("**")?.associativity).toBe("left");
    expect(rowOfOperator("==")!.rank).toBeLessThan(rowOfOperator("&")!.rank);
    expect(rowOfOperator("+")!.rank).toBeLessThan(rowOfOperator("<<")!.rank);
    expect(rowOfOperator("^~")?.label).toBe("^ ~^ ^~ (binary)");
  });
});

describe("precedence presets: each grouping pinned to its Table 11-2 rows (§11.3.2)", () => {
  const expected: Record<string, { grouping: string; value: string; intended: string; flips: boolean }> = {
    "flags-mask": { grouping: "flags & (mask == 0)", value: "0", intended: "1", flips: true },
    "shift-plus": { grouping: "x << (1 + y)", value: "24", intended: "8", flips: true },
    "not-equal": { grouping: "(!a) == b", value: "0", intended: "1", flips: true },
    "chained-compare": { grouping: "(a < b) < c", value: "1", intended: "0", flips: true },
    "or-and": { grouping: "a || (b && c)", value: "1", intended: "0", flips: true },
    "conditional-chain": { grouping: "s ? x : (t ? y : z)", value: "1", intended: "1", flips: false },
    "power-chain": { grouping: "(2 ** 3) ** 2", value: "64", intended: "512", flips: true },
    "unary-power": { grouping: "(-2) ** 2", value: "4", intended: "-4", flips: true },
  };
  for (const p of precedencePresets) {
    it(`${p.source} groups as ${expected[p.id].grouping} (Table 11-2 rows: ${p.rows.join(" | ")})`, () => {
      const a = analyzePrecedence(p);
      const e = expected[p.id];
      expect(a.actual.grouping).toBe(e.grouping);
      expect(formatDecimal(a.actual.value)).toBe(e.value);
      expect(formatDecimal(a.intended.value)).toBe(e.intended);
      expect(a.differs).toBe(e.flips);
      for (const row of p.rows) expect(PRECEDENCE_ROWS.some((r) => r.label === row)).toBe(true);
      // The explanation names the rows it relies on.
      const fb = a.options.find((o) => o.correct)!.feedback;
      if (p.rows.length > 1 && !p.rows[0].startsWith("unary")) expect(fb).toContain(p.rows[0]);
    });
  }
  it("§11.3.2: equality above binary &: flags & mask == 0 does not run the if branch; (flags & mask) == 0 does", () => {
    const a = analyzePrecedence(findPrecedencePreset("flags-mask"));
    expect(a.flip).toContain("the if branch now runs");
    expect(a.flip).toContain("`flags & mask == 0` is 4'b0000 (0): the if branch does not run");
  });
  it("§11.3.2: a right-associative ?: chain needs no parentheses: no flip", () => {
    expect(analyzePrecedence(findPrecedencePreset("conditional-chain")).flip).toContain("No flip");
  });
  it("a < b < c compares the 1-bit result of a < b with c (Table 11-21: relational result is 1 bit)", () => {
    const a = analyzePrecedence(findPrecedencePreset("chained-compare"));
    const inner = a.actual.layout.nodes.find((n) => n.text === "a < b")!;
    expect(inner.annotation.selfWidth).toBe(1);
    expect(isParenthesization(a.preset.source, a.preset.intended)).toBe(false);
  });
  it("unknown preset ids fall back to the first preset", () => {
    expect(findPrecedencePreset("nope").id).toBe("flags-mask");
    expect(findWidthPreset(undefined).id).toBe("s9-sum");
  });
});

describe("prediction options and feedback are generated from the parse", () => {
  it("every preset offers 2-3 groupings, exactly one correct, sorted by text", () => {
    for (const p of precedencePresets) {
      const opts = groupingOptions(p.source, p.decls, p.intended);
      expect(opts.length).toBeGreaterThanOrEqual(2);
      expect(opts.length).toBeLessThanOrEqual(3);
      expect(opts.filter((o) => o.correct)).toHaveLength(1);
      expect([...opts.map((o) => o.grouping)].sort((x, y) => x.localeCompare(y))).toEqual(opts.map((o) => o.grouping));
      for (const o of opts) expect(isParenthesization(p.source, o.source)).toBe(true);
    }
  });
  it("tapping the root operator is correct; any other operator is not, and the feedback names the root", () => {
    for (const p of precedencePresets) {
      const a = analyzePrecedence(p);
      expect(a.rootId).toBe("r");
      expect(tapFeedback(p.source, p.decls, "r").correct).toBe(true);
      for (const t of a.tokens.filter((t) => t.nodeId !== a.rootId)) {
        const fb = tapFeedback(p.source, p.decls, t.nodeId);
        expect(fb.correct).toBe(false);
        expect(fb.text).toContain("is applied last");
      }
    }
  });
  it("operatorTokens locates each operator in the source, including the ^~ spelling and both halves of ?:", () => {
    const src = "a ^~ b == c";
    const toks = operatorTokens(src, parseExpression(src));
    expect(toks.map((t) => [src.slice(t.start, t.end), t.nodeId])).toEqual([
      ["^~", "r"],
      ["==", "r.1"],
    ]);
    // The tap button shows the spelling the learner typed.
    expect(toks.map((t) => t.symbol)).toEqual(["^~", "=="]);
    const u = "^~a & b";
    expect(operatorTokens(u, parseExpression(u)).map((t) => [t.symbol, u.slice(t.start, t.end)])).toEqual([
      ["^~", "^~"],
      ["&", "&"],
    ]);
    const c = "s ? x : t ? y : z";
    expect(operatorTokens(c, parseExpression(c)).map((t) => `${t.symbol}${t.start}:${t.nodeId}`)).toEqual(["?2:r", ":6:r", "?10:r.2", ":14:r.2"]);
    expect(rootOperatorId(parseExpression("((a + b))"))).toBe("r.0.0");
  });
});

describe("typed expressions: ^~ spelling, inside members, single-grouping input", () => {
  it("Table 11-2 lists ^~ and ~^ as one operator: groupingOptions works for either spelling", () => {
    for (const s of ["a ^~ b == c", "a & b ^~ c", "^~a & b", "a ~^ b == c"]) {
      const opts = groupingOptions(s, PLAYGROUND_DECLS);
      expect(opts.length, s).toBeGreaterThanOrEqual(2);
      expect(opts.length, s).toBeLessThanOrEqual(3);
      expect(opts.filter((o) => o.correct), s).toHaveLength(1);
      for (const o of opts) expect(isParenthesization(s, o.source), `${s} / ${o.source}`).toBe(true);
    }
    // The explanation echoes the source spelling.
    expect(rootExplanation(parseExpression("a ^~ b & c"))).toContain("`^~` is applied last: the parser builds `a ^~ (b & c)`");
  });
  it("isParenthesization compares tokens, not characters", () => {
    expect(isParenthesization("a ^~ b", "(a ~^ b)")).toBe(true);
    expect(isParenthesization("a ^ ~b", "a ^~ b")).toBe(false);
    expect(isParenthesization("~&a", "~(&a)")).toBe(false);
  });
  it("§11.4.13: inside members are fixed by the braces, not by precedence", () => {
    for (const s of ["a inside {b + 1}", "a inside {b + 1, c}", "a inside {[b:c+1]}", "a inside {b || c}"]) {
      const text = rootExplanation(parseExpression(s));
      expect(text, s).toContain("sits inside the delimiters");
      expect(text, s).not.toContain("binds tighter than `inside`");
    }
    expect(rootExplanation(parseExpression("a < b inside {c}"))).toContain("the parser builds `(a < b) inside {c}`");
    expect(rootExplanation(parseExpression("a < b inside {c}"))).toContain("groups left to right");
  });
  it("an expression whose root has only one possible grouping offers fewer than two choices", () => {
    for (const s of ["(a + b) * c", "a + -b", "{a, b} + c", "a ? b+c : c", "a inside {1,2} && b"]) {
      expect(groupingOptions(s, PLAYGROUND_DECLS).length, s).toBeLessThan(MIN_GROUPING_OPTIONS);
    }
  });
  it("Table 11-2: ?: is the lowest row and inside shares the relational row, so regroupings around them are offered", () => {
    const cases: Array<[string, string]> = [
      // ?: binds loosest: the condition is `s & t`, not `t`.
      ["s & t ? x : y", "s & (t ? x : y)"],
      ["a == b ? x : y", "a == (b ? x : y)"],
      // the else operand takes `c + a`, not `c`.
      ["a ? b : c + a", "(a ? b : c) + a"],
      // inside shares the < <= > >= row, above == (left to right within the row).
      ["a == b inside {1,2}", "(a == b) inside {1,2}"],
      ["a < b inside {1,2}", "a < (b inside {1,2})"],
      // a unary operator binds tighter than ?: and inside.
      ["!a ? b : c", "!(a ? b : c)"],
    ];
    for (const [s, alt] of cases) {
      expect(isParenthesization(s, alt), alt).toBe(true);
      const opts = groupingOptions(s, PLAYGROUND_DECLS);
      expect(opts.length, s).toBeGreaterThanOrEqual(MIN_GROUPING_OPTIONS);
      expect(opts.length, s).toBeLessThanOrEqual(3);
      expect(opts.filter((o) => o.correct), s).toHaveLength(1);
      const wrong = opts.filter((o) => !o.correct).map((o) => o.source);
      expect(wrong, s).toContain(alt);
      for (const o of opts) expect(isParenthesization(s, o.source), `${s} / ${o.source}`).toBe(true);
    }
    expect(GROUPING_UNAVAILABLE).not.toMatch(/allow only|only the parser/);
  });
  it("tap feedback for the left operand of inside cites the shared row, not delimiters", () => {
    const fb = tapFeedback("a < b inside {c}", PLAYGROUND_DECLS, "r.0");
    expect(fb.correct).toBe(false);
    expect(fb.text).not.toContain("delimiters");
  });
});

describe("typed expressions", () => {
  it(`excluded operators are reported, not mis-parsed: ${EXCLUDED_NOTE}`, () => {
    for (const s of ["a -> b", "a <-> b", "a dist {1}", "--a", "++a", "a++", "a--", "a--b", "a++b", "!--a"]) {
      const r = analyzeExpression(s, PLAYGROUND_DECLS);
      expect(r.ok, s).toBe(false);
      if (!r.ok) expect(r.message).toBe(EXCLUDED_NOTE);
    }
    // §11.4.2: ++ and -- are increment/decrement; with a space the signs are two operators.
    const dec = analyzeExpression("--a", PLAYGROUND_DECLS);
    if (!dec.ok) expect(dec.clause).toContain("§11.4.2");
    for (const s of ["- -a", "a - -b", "a + +b", "dist_x + 1"]) {
      const r = analyzeExpression(s, [...PLAYGROUND_DECLS, { name: "dist_x", type: "logic", width: 4, init: "4'd1" }]);
      expect(r.ok, s).toBe(true);
    }
    expect(fullGrouping(parseExpression("a - -b"))).toBe("a - (-b)");
  });
  it("empty, overlong and undeclared input give a message instead of a tree", () => {
    expect(analyzeExpression("   ", PLAYGROUND_DECLS).ok).toBe(false);
    expect(analyzeExpression("a + ".repeat(30) + "a", PLAYGROUND_DECLS).ok).toBe(false);
    const r = analyzeExpression("q + 1", PLAYGROUND_DECLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/not declared/);
  });
  it("§11.4 with x: u = 4'b1x01 gives an x result that §12.4 treats as false in an if", () => {
    const r = analyzeExpression("u + 1", PLAYGROUND_DECLS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.bval).not.toBe(BigInt(0));
    const out = ifOutcome(fromBits(["x"]));
    expect(out.runs).toBe(false);
    expect(out.text).toContain("§12.4");
    expect(ifOutcome(fromBits(["0", "0"])).runs).toBe(false);
    expect(ifOutcome(fromBits(["1", "0"])).runs).toBe(true);
  });
  it("§12.4: a z condition is reported as z (not as x), and does not run the branch", () => {
    const z = ifOutcome(fromBits(["z"]));
    expect(z.runs).toBe(false);
    expect(z.text).toContain("has z bits");
    expect(z.text).not.toContain("has x");
    expect(ifOutcome(fromBits(["x", "z"])).text).toContain("has x and z bits");
  });
  it("a partly unknown value with a known 1 bit counts as true (simulator practice, recorded as an assumption)", () => {
    expect(ifOutcome(fromBits(["1", "x", "0", "1"])).runs).toBe(true);
  });
  it("layoutTree collapses parentheses, numbers nodes bottom-up and places parents over their children", () => {
    const r = analyzeExpression("(a + b) * c", PLAYGROUND_DECLS);
    if (!r.ok) throw new Error("parse");
    const { root, nodes, slots } = r.layout;
    expect(root.label).toBe("*");
    expect(root.children[0].parenthesized).toBe(true);
    expect(slots).toBe(3);
    for (const n of nodes) for (const c of n.children) expect(c.order).toBeLessThan(n.order);
    expect(root.order).toBe(nodes.length - 1);
  });
});

describe("§11.6.1 Table 11-21 and §11.8.2: bowls", () => {
  const env = buildEnv([
    { name: "a", type: "logic", width: 8, init: "8'd200" },
    { name: "b", type: "logic", width: 8, init: "8'd100" },
    { name: "n", type: "logic", width: 3, init: "3'd1" },
  ]);
  const bowls = (src: string, target?: number) => {
    const ast = parseExpression(src);
    const ann = annotateTree(ast, env, target);
    return { map: bowlsOf(ast, ann, target ? { text: "t", width: target } : undefined), layout: layoutTree(ast, ann) };
  };
  it("Table 11-21: shift amounts, ** exponents, the ?: condition, && || operands, reduction operands and concatenation members are self-determined", () => {
    const cases: [string, string][] = [
      ["a << n", "shift amount"],
      ["a ** n", "exponent of **"],
      ["n ? a : b", "condition of ?:"],
      ["a && b", "operand of &&"],
      ["|a", "reduction"],
      ["{a, b}", "concatenation member"],
    ];
    for (const [src, reason] of cases) {
      const { map } = bowls(src, 16);
      const selfBowls = map.bowls.filter((b) => b.kind === "self");
      expect(selfBowls.length, src).toBeGreaterThan(0);
      expect(selfBowls[0].reason, src).toContain(reason);
      expect(selfBowls.every((b) => !b.target), src).toBe(true);
    }
  });
  it("§11.8.2: both operands of a comparison share one bowl sized to the wider, and the result is 1 bit", () => {
    const { map } = bowls("a + b > 255", 1);
    expect(map.bowls.map((b) => [b.kind, b.width])).toEqual([
      ["context", 1],
      ["compare", 32],
    ]);
    expect(map.bowls[1].members.map((m) => m.text)).toEqual(["a", "b", "255"]);
  });
  it("§11.6.1: the target joins the root bowl; every node in a bowl is evaluated at the bowl's width, the largest of its members", () => {
    for (const p of widthPresets) {
      const w = analyzeWidth(p);
      expect(w.bowls.bowls[0].target).toEqual({ text: p.target.name, width: p.target.width });
      for (const b of w.bowls.bowls) {
        for (const id of b.nodeIds) expect(w.layout.nodes.find((n) => n.id === id)!.annotation.width, `${p.id} ${b.id}`).toBe(b.width);
        const widest = Math.max(...b.members.map((m) => m.width), b.target?.width ?? 0);
        expect(b.width, `${p.id} ${b.id}`).toBe(widest);
      }
    }
  });
});

describe("§11.6.2 width presets: the lesson's trace table", () => {
  const table: Record<string, { bowl: number; stored: string; kept: boolean }> = {
    "s9-sum": { bowl: 9, stored: "s9 = 300", kept: true },
    "s9-concat": { bowl: 8, stored: "s9 = 44", kept: false },
    "carry-s8": { bowl: 9, stored: "carry = 1, s8 = 44", kept: true },
    "s8-shift": { bowl: 8, stored: "s8 = 22", kept: false },
    "s8-plus-0": { bowl: 32, stored: "s8 = 150", kept: true },
    "s8-plus-1b0": { bowl: 8, stored: "s8 = 22", kept: false },
    "flag-255": { bowl: 32, stored: "flag = 1", kept: true },
    "flag-8d255": { bowl: 8, stored: "flag = 0", kept: false },
  };
  for (const p of widthPresets) {
    const e = table[p.id];
    it(`${p.target.name} = ${p.expr}: a + b in ${e.bowl} bits, ${e.stored} (§11.6.1, §11.8.2)`, () => {
      const w = analyzeWidth(p);
      expect(w.focusBowl.width).toBe(e.bowl);
      expect(w.stored).toBe(e.stored);
      expect(w.carryKept).toBe(e.kept);
      expect(w.carryText).toContain(e.kept ? "Carry kept" : "Carry dropped");
      expect(w.exact).toBe(BigInt(300));
      expect(w.steps.map((s) => s.kind)).toContain("assign");
      expect(w.steps[0].kind).toBe("context");
      const wo = widthOptions(w);
      expect(wo.map((o) => o.label)).toEqual(WIDTH_CHOICES.map((c) => `${c} bits`));
      expect(wo.filter((o) => o.correct).map((o) => o.label)).toEqual([`${e.bowl} bits`]);
      const so = storedOptions(w);
      expect(so.length).toBeGreaterThanOrEqual(2);
      expect(so.filter((o) => o.correct).map((o) => o.label)).toEqual([e.stored]);
    });
  }
  it("§11.4.12: {carry, s8} is a 9-bit target whose first member takes the MSB", () => {
    const w = analyzeWidth(findWidthPreset("carry-s8"));
    expect(w.evaluation.contextWidth).toBe(9);
    expect(w.declarations).toEqual(["logic [7:0] a = 8'd200;", "logic [7:0] b = 8'd100;", "logic carry;", "logic [7:0] s8;"]);
  });
  it("§11.6.1: a member's own bowl cannot see the target: {a + b} into s9 is 8 bits, and the feedback for 9 says so", () => {
    const w = analyzeWidth(findWidthPreset("s9-concat"));
    expect(w.bowls.bowls[0].width).toBe(9);
    expect(widthOptions(w).find((o) => o.label === "9 bits")!.feedback).toContain("outside this bowl");
  });
  it("Table 11-21: the unsized 0 is 32 bits and widens the bowl; the 1-bit 1'b0 widens nothing", () => {
    expect(analyzeWidth(findWidthPreset("s8-plus-0")).focusBowl.members.find((m) => m.text === "0")?.width).toBe(32);
    expect(analyzeWidth(findWidthPreset("s8-plus-1b0")).focusBowl.members.find((m) => m.text === "1'b0")?.width).toBe(1);
  });
  it("every contrast points at an existing preset", () => {
    for (const p of widthPresets) if (p.contrast) expect(widthPresets.some((q) => q.id === p.contrast)).toBe(true);
  });
});
