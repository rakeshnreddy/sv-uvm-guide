import { describe, expect, it } from "vitest";

import {
  ALL_X_32,
  CMDLINE_PRESETS,
  LOOKUPS,
  PLUSARG_PALETTE,
  PlusargOutsideModelError,
  convertDecimal,
  describeScanStep,
  displayPlusargValue,
  explainLookup,
  initialValue,
  parseUserString,
  plusargSource,
  returnOptions,
  runLookup,
  testPlusargs,
  valueOptions,
  valuePlusargs,
  type ValuePlusargsResult,
} from "@/lib/sv-plusargs-model";

const lesson = ["+VECTORS=vectors_bad.txt", "+VERBOSE"];

describe("§21.6 $test$plusargs: prefix matching in command-line order", () => {
  it("§21.6 the standard's own example: +HELLO matches HELLO, HE and H, but not HELLO_HERE, HI or LO", () => {
    const tokens = ["+HELLO"];
    expect(testPlusargs(tokens, "HELLO").returns).toBe("nonzero");
    expect(testPlusargs(tokens, "HE").returns).toBe("nonzero");
    expect(testPlusargs(tokens, "H").returns).toBe("nonzero");
    expect(testPlusargs(tokens, "HELLO_HERE").returns).toBe(0);
    expect(testPlusargs(tokens, "HI").returns).toBe(0);
    expect(testPlusargs(tokens, "LO").returns).toBe(0);
  });

  it("§21.6 the prefix trap: V matches +VECTORS=..., the first plusarg, before +VERBOSE is examined", () => {
    const r = testPlusargs(lesson, "V");
    expect(r.returns).toBe("nonzero");
    expect(r.matchIndex).toBe(0);
    expect(r.scan).toHaveLength(1);
    expect(explainLookup(r)).toMatch(/prefix matching/);
  });

  it("§21.6 the result is 'nonzero', never promised to be 1", () => {
    expect(explainLookup(testPlusargs(lesson, "VERBOSE"))).toMatch(/nonzero, not 1/);
  });

  it("§21.6 TEST matches +TESTNAME=t1, but TEST= does not", () => {
    expect(testPlusargs(["+TESTNAME=t1"], "TEST").returns).toBe("nonzero");
    const r = valuePlusargs(["+TESTNAME=t1"], "TEST=%d", initialValue("int", 0));
    expect(r.returns).toBe(0);
    expect(r.scan[0]).toMatchObject({ matchedChars: 4, mismatchAt: 4, matches: false });
  });

  it("§21.6 the query never includes the leading +; a token without + is outside the model", () => {
    expect(testPlusargs(["+DUMP"], "DUMP").returns).toBe("nonzero");
    expect(testPlusargs(["+DUMP"], "+DUMP").returns).toBe(0);
    expect(() => testPlusargs(["DUMP"], "DUMP")).toThrow(PlusargOutsideModelError);
  });

  it("§21.6 scan narration names the matched characters and the mismatch", () => {
    const r = testPlusargs(["+SEED=1", "+VERBOSE"], "VERBOSE");
    expect(describeScanStep(r.scan[0], "VERBOSE")).toMatch(/no characters match/);
    expect(describeScanStep(r.scan[1], "VERBOSE")).toMatch(/First match/);
  });
});

describe("§21.6 $value$plusargs", () => {
  it("§21.6 a miss returns 0, leaves the variable unchanged and warns nobody (lesson: seed keeps 1)", () => {
    const r = valuePlusargs(lesson, "SEED=%d", initialValue("int", 1));
    expect(r.returns).toBe(0);
    expect(r.changed).toBe(false);
    expect(displayPlusargValue(r.after)).toBe("1");
    expect(explainLookup(r, "seed")).toMatch(/leaves seed at 1 and prints no warning/);
  });

  it("§21.6 %s stores the remainder as a string (lesson: vec_file becomes vectors_bad.txt)", () => {
    const r = valuePlusargs(lesson, "VECTORS=%s", initialValue("string", "vectors.txt"));
    expect(r.returns).toBe("nonzero");
    expect(displayPlusargValue(r.after)).toBe('"vectors_bad.txt"');
  });

  it("§21.6 the first match in command-line order wins: +SEED=1 +SEED=2 gives 1", () => {
    const r = valuePlusargs(["+SEED=1", "+SEED=2"], "SEED=%d", initialValue("int", 7));
    expect(r.matchIndex).toBe(0);
    expect(displayPlusargValue(r.after)).toBe("1");
  });

  it("§21.6 an empty remainder stores zero, or an empty string for %s", () => {
    expect(displayPlusargValue(valuePlusargs(["+SEED="], "SEED=%d", initialValue("int", 1)).after)).toBe("0");
    expect(displayPlusargValue(valuePlusargs(["+SEED="], "SEED=%d", initialValue("logic32", 1)).after)).toBe("0");
    expect(displayPlusargValue(valuePlusargs(["+VECTORS="], "VECTORS=%s", initialValue("string", "a")).after)).toBe('""');
  });

  it("§21.6 + §6.11.2 illegal characters write 'bx: logic [31:0] reads X, int silently becomes 0", () => {
    const asLogic = valuePlusargs(["+SEED=12x"], "SEED=%d", initialValue("logic32", 1));
    expect(asLogic.conversion).toBe("illegal");
    expect(asLogic.after).toEqual({ type: "logic32", bits: ALL_X_32 });
    expect(displayPlusargValue(asLogic.after)).toBe("X");
    const asInt = valuePlusargs(["+SEED=12x"], "SEED=%d", initialValue("int", 1));
    expect(displayPlusargValue(asInt.after)).toBe("0");
    expect(explainLookup(asInt, "seed")).toMatch(/2-state type, so the x bits become 0 \(§6\.11\.2\)/);
  });

  it("§21.6 a value too large for the variable is truncated", () => {
    expect(convertDecimal("4294967297", "logic32")).toEqual({ value: { type: "logic32", bits: "1".padStart(32, "0") }, conversion: "truncated" });
    expect(convertDecimal("4294967295", "int").value).toEqual({ type: "int", value: -1 });
    expect(convertDecimal("2147483647", "int").value).toEqual({ type: "int", value: 2147483647 });
  });

  it("§21.6 signs, underscores and a lone x are excluded: the clause does not list what %d accepts", () => {
    expect(() => convertDecimal("-5", "int")).toThrow(PlusargOutsideModelError);
    expect(() => convertDecimal("1_000", "int")).toThrow(PlusargOutsideModelError);
    expect(() => convertDecimal("x", "logic32")).toThrow(PlusargOutsideModelError);
  });

  it("§21.6 user_string is a plusarg string followed by a format; only %d and %s are modelled", () => {
    expect(parseUserString("SEED=%d")).toEqual({ prefix: "SEED=", format: "d" });
    expect(parseUserString("TEST=%0d")).toEqual({ prefix: "TEST=", format: "d" });
    expect(() => parseUserString("FREQ+%0F")).toThrow(PlusargOutsideModelError);
    expect(() => parseUserString("%d")).toThrow(PlusargOutsideModelError);
  });
});

describe("§21.6 scenario data for the visual", () => {
  it("§21.6 every palette token and preset is inside the model for every lookup and type", () => {
    for (const p of CMDLINE_PRESETS) for (const t of p.tokens) expect(PLUSARG_PALETTE as readonly string[]).toContain(t);
    for (const t of PLUSARG_PALETTE) for (const l of LOOKUPS) for (const ty of ["int", "logic32"] as const) expect(() => runLookup([t], l.id, ty)).not.toThrow();
  });

  it("§21.6 each lookup line in the generated source matches its spec, and the type toggle changes the declarations", () => {
    const src = plusargSource("logic32").map((l) => l.text).join("\n");
    expect(src).toContain('void\'($value$plusargs("SEED=%d", seed));');
    expect(src).toContain("v_found = ($test$plusargs(\"V\") != 0);");
    expect(src).toContain("logic [31:0] seed = 1;");
    expect(plusargSource("int").map((l) => l.text)).toContain("int seed = 1;");
  });

  it("§21.6 prediction options: exactly one correct answer, and it equals the model's result", () => {
    for (const p of CMDLINE_PRESETS) {
      for (const l of LOOKUPS) {
        for (const ty of ["int", "logic32"] as const) {
          const r = runLookup(p.tokens, l.id, ty);
          const ro = returnOptions(r);
          expect(ro.filter((o) => o.correct)).toHaveLength(1);
          if (r.kind === "value") {
            const vo = valueOptions(r as ValuePlusargsResult, p.tokens, l.variable?.name ?? "");
            expect(vo.filter((o) => o.correct)).toHaveLength(1);
            expect(vo.find((o) => o.correct)?.label).toBe(displayPlusargValue(r.after));
            expect(vo.length).toBeGreaterThanOrEqual(2);
          }
        }
      }
    }
  });

  it("§21.6 the first-wins preset separates first match, last match and a miss", () => {
    const preset = CMDLINE_PRESETS.find((p) => p.id === "first-wins");
    expect(preset?.tokens).toEqual(["+SEED=7", "+SEED=2"]);
    const r = runLookup(preset!.tokens, "seed", "int") as ValuePlusargsResult;
    expect(displayPlusargValue(r.after)).toBe("7");
    expect(displayPlusargValue(r.before)).toBe("1");
    const opts = valueOptions(r, preset!.tokens, "seed");
    expect(opts.map((o) => [o.label, o.correct])).toEqual(expect.arrayContaining([["7", true], ["1", false], ["2", false]]));
  });

  it("§21.6 distractors diagnose: a later +SEED and the leading digits of 12x are offered with the right reason", () => {
    const first = runLookup(["+SEED=1", "+SEED=2"], "seed", "int") as ValuePlusargsResult;
    const o2 = valueOptions(first, ["+SEED=1", "+SEED=2"], "seed").find((o) => o.label === "2");
    expect(o2?.feedback).toMatch(/first match is the one converted/);
    const bad = runLookup(["+SEED=12x"], "seed", "logic32") as ValuePlusargsResult;
    const o12 = valueOptions(bad, ["+SEED=12x"], "seed").find((o) => o.label === "12");
    expect(o12?.feedback).toMatch(/'bx/);
  });
});
