import { describe, expect, it } from "vitest";

import {
  ADDRESS_DIGITS_NOTE,
  ARG_MODES,
  QUESTION_MARK_NOTE,
  READMEM_PRESETS,
  START_ONLY_RANGE_NOTE,
  addressRange,
  callForMode,
  callText,
  declarationText,
  getReadmemPreset,
  gradePrediction,
  loadDirection,
  memorySummary,
  runPreset,
  simulateReadmem,
  startAddress,
  tokenizeReadmemFile,
  unknownWord,
  validateCall,
  whyItLands,
  wordValue,
  type ReadmemMemory,
} from "@/lib/sv-readmem-model";

const ROM: ReadmemMemory = { name: "rom", width: 8, depth: 16 };
const valueAt = (run: ReturnType<typeof simulateReadmem>, a: number) => run.steps[run.steps.length - 1].cells[a];
const writeOrder = (run: ReturnType<typeof simulateReadmem>) => run.steps.filter((s) => s.kind === "write").map((s) => s.address);

describe("§21.4 load pointer start and direction", () => {
  it("§21.4: with no addresses, loading starts at the lowest address and moves upward", () => {
    const run = simulateReadmem("11 22 33 44", ROM, { mode: "none" });
    expect(startAddress(run.call)).toBe(0);
    expect(run.direction).toBe("up");
    expect(writeOrder(run)).toEqual([0, 1, 2, 3]);
  });

  it("§21.4: with only a start address, loading moves upward from it", () => {
    expect(writeOrder(simulateReadmem("11 22 33 44", ROM, { mode: "start", start: 4 }))).toEqual([4, 5, 6, 7]);
  });

  it("§21.4: with start and finish, loading moves from start toward finish", () => {
    expect(writeOrder(simulateReadmem("11 22 33 44", ROM, { mode: "ascending", start: 4, finish: 7 }))).toEqual([4, 5, 6, 7]);
  });

  it("§21.4: with start greater than finish, the address is decremented between loads", () => {
    const run = simulateReadmem("11 22 33 44", ROM, { mode: "descending", start: 7, finish: 4 });
    expect(loadDirection(run.call)).toBe("down");
    expect(writeOrder(run)).toEqual([7, 6, 5, 4]);
  });

  it("§21.4: the lesson's data.hex table matches the model for every call", () => {
    const p = getReadmemPreset("data-hex");
    expect(writeOrder(runPreset(p, "none"))).toEqual([0, 1, 2, 3]);
    expect(writeOrder(runPreset(p, "start"))).toEqual([4, 5, 6, 7]);
    expect(writeOrder(runPreset(p, "ascending"))).toEqual([4, 5, 6, 7]);
    expect(writeOrder(runPreset(p, "descending"))).toEqual([7, 6, 5, 4]);
  });

  it("§21.4: with no addresses or a start only, loading continues upward after an @ line", () => {
    expect(writeOrder(simulateReadmem("@4 aa bb", ROM, { mode: "none" }))).toEqual([4, 5]);
    expect(writeOrder(simulateReadmem("@4 aa bb", ROM, { mode: "start", start: 2 }))).toEqual([4, 5]);
  });

  it("§21.4: a downward load keeps going downward after an @ line", () => {
    const run = runPreset(getReadmemPreset("at4"), "descending");
    expect(callText("rom.hex", ROM, run.call)).toBe('$readmemh("rom.hex", rom, 7, 0);');
    expect(writeOrder(run)).toEqual([4, 3]);
    expect(valueAt(run, 4).digits).toBe("aa");
    expect(valueAt(run, 3).digits).toBe("bb");
    expect(run.steps.find((s) => s.kind === "address")?.message).toMatch(/direction stays downward/);
    expect(run.landed).toEqual([4, 3]);
  });

  it("§21.4: the start step states the start and the direction for every argument mode", () => {
    const p = getReadmemPreset("data-hex");
    expect(runPreset(p, "none").steps[0].message).toBe("No start or finish address: loading starts at the lowest address, 0, and moves upward, even after an @ line.");
    expect(runPreset(p, "start").steps[0].message).toBe("Start 4, no finish: loading starts at address 4 and moves upward toward 15, even after an @ line.");
    expect(runPreset(p, "ascending").steps[0].message).toBe(
      "Start 4, finish 7: start is not greater than finish, so the address goes up by one after each word. This direction holds even after an @ line.",
    );
    expect(runPreset(p, "descending").steps[0].message).toBe(
      "Start 7, finish 4: start is greater than finish, so the address goes down by one after each word. This direction holds even after an @ line.",
    );
  });

  it("§21.4: the lowest-address default holds only when the file has no @ lines, so the start step says an @ line can move it", () => {
    expect(runPreset(getReadmemPreset("at4"), "none").steps[0].message).toMatch(/starts at the lowest address, 0, unless an @ line in the file moves it/);
  });
});

describe("§21.4 @ addresses", () => {
  it("§21.4: an @ address is hexadecimal, so @10 is address 16", () => {
    const run = runPreset(getReadmemPreset("at10"));
    expect(run.memory.depth).toBe(32);
    expect(run.landed).toEqual([16]);
    expect(run.steps.find((s) => s.kind === "address")?.message).toMatch(/10 is hexadecimal, so this is address 16, not 10/);
  });

  it("only points out the hexadecimal reading when the digits would read differently as decimal", () => {
    expect(simulateReadmem("@09 aa", ROM, { mode: "none" }).steps.find((s) => s.kind === "address")?.message).toBe(
      "@09 moves the pointer to address 9. The direction stays upward.",
    );
    expect(simulateReadmem("@0a aa", ROM, { mode: "none" }).steps.find((s) => s.kind === "address")?.message).toMatch(/0a is hexadecimal, so this is address 10/);
  });

  it("§21.4 does not settle _, x or z after an @: rejecting them is labelled the model's reading", () => {
    const run = simulateReadmem("@1_0 aa", ROM, { mode: "none" });
    expect(run.tokens[0].kind).toBe("bad-address");
    expect(run.diagnostics[0]).toMatchObject({ severity: "error", basis: "model" });
    expect(run.diagnostics[0].message).toContain(ADDRESS_DIGITS_NOTE);
    expect(run.steps[1].message).toMatch(/not an address in this model/);
    // A character that is no hexadecimal digit at all stays a rule-basis error.
    expect(simulateReadmem("@g aa", ROM, { mode: "none" }).diagnostics[0]).toMatchObject({ severity: "error", basis: "rule" });
  });

  it("§21.4: upper- and lowercase hex digits are allowed after @", () => {
    expect(simulateReadmem("@A 01 @b 02", ROM, { mode: "none" }).landed).toEqual([10, 11]);
  });

  it("§21.4: no white space is allowed between @ and the number", () => {
    const run = simulateReadmem("@ 4 aa", ROM, { mode: "none" });
    expect(run.tokens[0].kind).toBe("bad-address");
    expect(run.landed).toEqual([]);
    // The rule (no white space after @) is the standard's; stopping there is the model's choice.
    expect(run.diagnostics[0]).toMatchObject({ severity: "error", basis: "rule" });
    expect(run.diagnostics[0].message).toMatch(/no white space between the @ and the number/);
    expect(run.diagnostics[1]).toMatchObject({ severity: "note", basis: "model" });
    expect(run.diagnostics[1].message).toMatch(/does not say how a tool reacts/);
    expect(run.modelDecides).toBe(true);
  });

  it("§21.4: with start and finish, an @ outside the range is an error and the load is terminated", () => {
    const run = runPreset(getReadmemPreset("out-of-range"), "ascending");
    expect(run.outcome).toBe("terminated");
    expect(run.landed).toEqual([]);
    expect(run.diagnostics).toHaveLength(1);
    expect(run.diagnostics[0]).toMatchObject({ severity: "error", clause: "IEEE 1800-2023 §21.4", basis: "rule" });
    expect(run.diagnostics[0].message).toMatch(/outside the call's range 4 to 7/);
  });

  it("§21.4: the same @ line loads normally when the call gives no address range", () => {
    const run = runPreset(getReadmemPreset("out-of-range"), "none");
    expect(run.outcome).toBe("complete");
    expect(run.landed).toEqual([2, 3]);
    expect(run.diagnostics).toEqual([]);
  });

  it("§21.4: a start-only call checks @ against start..highest and records that this reading is the model's", () => {
    const run = runPreset(getReadmemPreset("out-of-range"), "start");
    expect(addressRange(ROM, run.call)).toEqual({ low: 4, high: 15, fromCall: true });
    expect(run.outcome).toBe("terminated");
    expect(run.diagnostics[0].basis).toBe("model");
    expect(run.diagnostics[0].message).toContain(START_ONLY_RANGE_NOTE);
    // The step text does not present the upper bound as something the call gives.
    expect(run.steps.find((s) => s.kind === "error")?.message).toMatch(/outside the range 4 to 15 \(the start address up to the highest address, the model's reading of a start-only call\)/);
    expect(run.steps.find((s) => s.kind === "error")?.message).not.toMatch(/that the call gives/);
  });

  it("§21.4: with start above finish, an @ outside finish..start is an error and the load is terminated", () => {
    const run = runPreset(getReadmemPreset("out-of-range"), "descending");
    expect(run.range).toMatchObject({ low: 4, high: 7 });
    expect(run.outcome).toBe("terminated");
    expect(run.diagnostics[0]).toMatchObject({ severity: "error", basis: "rule" });
    expect(run.diagnostics[0].message).toMatch(/outside the call's range 4 to 7/);
  });

  it("§21.4: @10 outside a 0..15 call range is an error, because it is address 16", () => {
    const run = runPreset(getReadmemPreset("at10"), "ascending");
    expect(run.outcome).toBe("terminated");
    expect(run.diagnostics[0].message).toMatch(/@10 \(address 16\)/);
  });

  it("§21.4 is silent on an @ outside the memory with no call range: the model stops with a note", () => {
    const run = simulateReadmem("@20 aa", ROM, { mode: "none" });
    expect(run.outcome).toBe("stopped");
    expect(run.diagnostics[0]).toMatchObject({ severity: "note", basis: "model" });
  });
});

describe("§21.4 unreached cells are not modified", () => {
  it("§21.4 and §6.8 Table 6-7: the lesson's rom.hex writes 0, 1 and 8 and leaves the rest at x", () => {
    const run = runPreset(getReadmemPreset("rom-hex"));
    expect(run.landed).toEqual([0, 1, 8]);
    expect(valueAt(run, 0).digits).toBe("12");
    expect(valueAt(run, 1).digits).toBe("34");
    expect(valueAt(run, 8).digits).toBe("ff");
    expect(valueAt(run, 2)).toMatchObject({ written: false, digits: "xx" });
    expect(memorySummary(run, run.steps.length - 1)).toBe("rom[0] = 12, rom[1] = 34, rom[8] = ff; every other cell holds xx.");
    expect(run.steps[run.steps.length - 1].message).toBe("The file is fully read. Written: 0, 1 and 8. 13 cells the file never reached keep their old value: x for a logic word that was never written.");
  });

  it("the memory summary does not mention other cells when every cell was written", () => {
    const run = simulateReadmem("1 2", { name: "m", width: 8, depth: 2 }, { mode: "none" });
    expect(memorySummary(run, run.steps.length - 1)).toBe("m[0] = 01, m[1] = 02; every cell was written.");
  });

  it("§21.4: quiz question 7, @4 aa bb leaves rom[0] at x and puts bb in rom[5]", () => {
    const run = runPreset(getReadmemPreset("at4"));
    expect(run.landed).toEqual([4, 5]);
    expect(valueAt(run, 0).written).toBe(false);
    expect(valueAt(run, 4).digits).toBe("aa");
    expect(valueAt(run, 5).digits).toBe("bb");
  });

  it("§21.4: Kata 2's short file leaves the fourth sum word at x (9-bit words have 3 hex digits)", () => {
    const run = runPreset(getReadmemPreset("short"));
    expect(run.landed).toEqual([0, 1, 2]);
    expect(valueAt(run, 0).digits).toBe("003");
    expect(valueAt(run, 1).digits).toBe("100");
    expect(valueAt(run, 3)).toMatchObject({ written: false, digits: unknownWord(9) });
    expect(unknownWord(9)).toBe("xxx");
    expect(run.diagnostics).toEqual([]);
  });

  it("§21.4: a file longer than the memory loads until the highest address, then the model stops", () => {
    const run = simulateReadmem("1 2 3", { name: "m", width: 8, depth: 2 }, { mode: "none" });
    expect(run.landed).toEqual([0, 1]);
    expect(run.outcome).toBe("stopped");
    expect(run.diagnostics[0]).toMatchObject({ severity: "note", basis: "model" });
    // §21.4 itself loads until the highest address, so the landing set is the standard's, not the model's.
    expect(run.endedAt?.basis).toBe("rule");
    expect(run.modelDecides).toBe(false);
    expect(gradePrediction(run, new Set([0, 1])).headline).toBe("Right: values land at 0 and 1.");
    expect(run.steps.find((s) => s.kind === "stop")?.message).toMatch(/^The next address would be above 1, the highest address of m\./);
  });

  it("a downward load past address 0 never names address -1 as if it existed", () => {
    const run = runPreset(getReadmemPreset("rom-hex"), "descending");
    const stop = run.steps.find((s) => s.kind === "stop");
    expect(stop?.message).toMatch(/^The next address would be below 0, past the finish address 0\./);
    expect(run.diagnostics[0].message).not.toMatch(/Address -1/);
  });
});

describe("§21.4 number format", () => {
  it("§21.4: numbers shall have neither a size nor a base; 8'h34 is flagged and the model stops", () => {
    const run = runPreset(getReadmemPreset("sized"));
    expect(run.tokens.map((t) => t.kind)).toEqual(["word", "sized", "word"]);
    expect(run.landed).toEqual([0]);
    // §21.4 settles that the file shall not hold 8'h34 (basis rule); it does not say how a tool reacts, so the stop is the model's (basis model).
    expect(run.diagnostics).toHaveLength(2);
    expect(run.diagnostics[0]).toMatchObject({ severity: "error", basis: "rule", clause: "IEEE 1800-2023 §21.4" });
    expect(run.diagnostics[0].message).toMatch(/shall have neither the length nor the base format specified/);
    expect(run.diagnostics[0].message).not.toMatch(/model/);
    expect(run.diagnostics[1]).toMatchObject({ severity: "note", basis: "model", clause: "IEEE 1800-2023 §21.4" });
    expect(run.diagnostics[1].message).toMatch(/does not say how a tool reacts/);
    expect(run.steps.find((s) => s.kind === "stop")?.diagnostics).toEqual(run.diagnostics);
    expect(run.endedAt).toEqual({ tokenIndex: 1, text: "8'h34", wouldBeAddress: 1, basis: "model" });
    expect(run.modelDecides).toBe(true);
  });

  it("§21.4: both comment forms are allowed and white space separates numbers", () => {
    const tokens = tokenizeReadmemFile("12 /* two\nlines */ 34// end\n56");
    expect(tokens.map((t) => [t.kind, t.text])).toEqual([
      ["word", "12"],
      ["comment", "/* two\nlines */"],
      ["word", "34"],
      ["comment", "// end"],
      ["word", "56"],
    ]);
    expect(tokens[4].line).toBe(3);
  });

  it("§21.4 with §5.7.1: x, z and _ may appear in a number", () => {
    expect(wordValue("x", 8)).toMatchObject({ digits: "xx", unknown: true });
    expect(wordValue("z1", 8).digits).toBe("z1");
    expect(wordValue("1_2", 8).digits).toBe("12");
    expect(wordValue("3", 8).digits).toBe("03");
  });

  it("§5.7.1 (model reading): padding and truncation of x, z and partial top digits", () => {
    expect(wordValue("z", 8)).toMatchObject({ digits: "zz", unknown: true });
    expect(wordValue("x", 9).digits).toBe("xxx");
    expect(wordValue("x1", 9).digits).toBe("xx1");
    // Dropped bits that are all 0 are not a truncation of value.
    expect(wordValue("00ff", 8)).toMatchObject({ digits: "ff", truncated: false });
    expect(wordValue("1ff", 8)).toMatchObject({ digits: "ff", truncated: true });
  });

  it("wordValue accepts only a word token", () => {
    expect(() => wordValue("?", 8)).toThrow();
    expect(() => wordValue("_", 8)).toThrow();
    expect(() => wordValue("g1", 8)).toThrow();
  });

  it("§21.4: a based but unsized number is still flagged, and an unterminated /* is not a comment", () => {
    expect(tokenizeReadmemFile("'h34")[0].kind).toBe("sized");
    expect(tokenizeReadmemFile("12 /* open")[1].kind).toBe("invalid");
  });

  it("§21.4 does not list ?: rejecting it is labelled the model's reading", () => {
    const run = simulateReadmem("1? 22", ROM, { mode: "none" });
    expect(run.landed).toEqual([]);
    expect(run.diagnostics[0]).toMatchObject({ severity: "error", basis: "model" });
    expect(run.diagnostics[0].message).toContain(QUESTION_MARK_NOTE);
    expect(simulateReadmem("1@ 22", ROM, { mode: "none" }).diagnostics[0].basis).toBe("rule");
  });

  it("§5.7.1: a number cannot start with an underscore", () => {
    const run = simulateReadmem("_12", ROM, { mode: "none" });
    expect(run.tokens[0].kind).toBe("invalid");
    expect(run.diagnostics[0]).toMatchObject({ clause: "IEEE 1800-2023 §5.7.1", basis: "rule" });
    expect(run.diagnostics[1]).toMatchObject({ basis: "model" });
  });

  it("§5.7.1 (model reading): a word wider than the memory is truncated from the left with a note", () => {
    const run = simulateReadmem("1ff", ROM, { mode: "none" });
    expect(valueAt(run, 0).digits).toBe("ff");
    expect(run.diagnostics[0]).toMatchObject({ severity: "note", basis: "model" });
  });

  it("§21.4: any other character is not allowed in the file", () => {
    expect(tokenizeReadmemFile("g1")[0].kind).toBe("invalid");
  });
});

describe("§21.4 word-count warning", () => {
  it("§21.4: start and finish with no @ lines and a different word count is a warning", () => {
    const run = runPreset(getReadmemPreset("short"), "ascending");
    expect(run.landed).toEqual([0, 1, 2]);
    expect(run.diagnostics).toHaveLength(1);
    expect(run.diagnostics[0]).toMatchObject({ severity: "warning", basis: "rule" });
    expect(run.diagnostics[0].message).toMatch(/holds 3 data words and the range 0 to 3 holds 4/);
  });

  it("§21.4: the warning also applies to a downward range", () => {
    const run = runPreset(getReadmemPreset("short"), "descending");
    expect(writeOrder(run)).toEqual([3, 2, 1]);
    expect(run.diagnostics[0]).toMatchObject({ severity: "warning", basis: "rule" });
    expect(run.diagnostics[0].message).toMatch(/holds 3 data words and the range 3 to 0 holds 4/);
  });

  it("uses the singular for a one-word file", () => {
    const run = simulateReadmem("1", ROM, { mode: "ascending", start: 0, finish: 0 });
    expect(run.steps.find((s) => s.kind === "check")?.message).toBe("Final check: the file holds 1 word and the range 0 to 0 holds 1, so there is no warning.");
  });

  it("says when the model skips the word-count check because the file breaks the number format", () => {
    const run = simulateReadmem("1 2 8'h3", ROM, { mode: "ascending", start: 0, finish: 3 });
    expect(run.diagnostics.some((d) => d.severity === "warning")).toBe(false);
    const check = run.steps.find((s) => s.kind === "check");
    expect(check?.message).toMatch(/skipped/);
    expect(check?.diagnostics[0]).toMatchObject({ severity: "note", basis: "model" });
  });

  it("§21.4: a matching word count gives no warning", () => {
    const run = runPreset(getReadmemPreset("data-hex"), "ascending");
    expect(run.diagnostics).toEqual([]);
    expect(run.steps.find((s) => s.kind === "check")?.message).toMatch(/no warning/);
  });

  it("§21.4: no warning is checked when the file has @ lines or the call gives a start only", () => {
    expect(runPreset(getReadmemPreset("rom-hex"), "ascending").diagnostics).toEqual([]);
    expect(runPreset(getReadmemPreset("short"), "start").diagnostics).toEqual([]);
  });

  it("§21.4: more words than the range warns, and the model stops at the finish address", () => {
    const run = simulateReadmem("1 2 3 4 5", ROM, { mode: "ascending", start: 0, finish: 3 });
    expect(run.landed).toEqual([0, 1, 2, 3]);
    expect(run.diagnostics.map((d) => d.severity)).toEqual(["note", "warning"]);
  });
});

describe("prediction grading", () => {
  it("grades the exact landing set as right", () => {
    const g = gradePrediction(runPreset(getReadmemPreset("rom-hex")), new Set([0, 1, 8]));
    expect(g.correct).toBe(true);
    expect(g.headline).toBe("Right: values land at 0, 1 and 8.");
  });

  it("uses the singular when one word lands", () => {
    expect(whyItLands(runPreset(getReadmemPreset("sized")))).toMatch(/The word lands at 0\./);
    expect(whyItLands(runPreset(getReadmemPreset("rom-hex")))).toMatch(/The words land at 0, 1 and 8, in that order\./);
  });

  it("explains a decimal reading of @10", () => {
    const g = gradePrediction(runPreset(getReadmemPreset("at10")), new Set([10]));
    expect(g.correct).toBe(false);
    expect(g.missed).toEqual([16]);
    expect(g.extra).toEqual([10]);
    expect(g.reasons.join(" ")).toMatch(/@10 is hexadecimal, so it means address 16, not 10/);
  });

  it("labels the landing set as the model's when a model-basis stop decides it (sized number)", () => {
    const run = runPreset(getReadmemPreset("sized"));
    const wrong = gradePrediction(run, new Set([0, 2]));
    expect(wrong.headline).toBe("Not quite. In this model: values land at 0.");
    expect(gradePrediction(run, new Set([0, 1, 2])).headline).toBe("Not quite. In this model: values land at 0.");
    expect(gradePrediction(run, new Set([0])).headline).toBe("Right. In this model: values land at 0.");
    expect(wrong.reasons).toContain(
      "Address 2: the model stops at 8'h34, before reaching it. §21.4 does not say how a tool reacts there, so this is the model's reading (IEEE 1800-2023 §21.4).",
    );
  });

  it("labels a start-only termination as the model's, and keeps the standard's wording for a rule-basis termination", () => {
    const startOnly = runPreset(getReadmemPreset("out-of-range"), "start");
    expect(startOnly.modelDecides).toBe(true);
    expect(gradePrediction(startOnly, new Set()).headline).toBe("Right. In this model: no value lands anywhere.");
    const ranged = runPreset(getReadmemPreset("out-of-range"), "ascending");
    expect(ranged.endedAt).toMatchObject({ text: "@2", wouldBeAddress: 2, basis: "rule" });
    expect(ranged.modelDecides).toBe(false);
    expect(gradePrediction(ranged, new Set([2])).headline).toBe("Not quite: values land at no address.");
  });

  it("a complete load never says 'in this model'", () => {
    for (const p of READMEM_PRESETS) {
      for (const mode of ARG_MODES) {
        const run = runPreset(p, mode);
        if (run.outcome === "complete") {
          expect(run.modelDecides).toBe(false);
          expect(gradePrediction(run, new Set()).headline).not.toMatch(/In this model/);
        }
      }
    }
  });

  it("§21.4: a pick the load never reached because @2 ended it says so, not that the file never reaches it", () => {
    const run = runPreset(getReadmemPreset("out-of-range"), "ascending");
    const g = gradePrediction(run, new Set([0, 2, 3]));
    expect(g.reasons).toContain("Address 2: the load ended at @2, before reaching it (IEEE 1800-2023 §21.4).");
    expect(g.reasons).toContain("Address 3: the load ended at @2, before reaching it (IEEE 1800-2023 §21.4).");
    expect(g.reasons.join(" ")).not.toMatch(/Address [23]: the file never reaches it/);
    // An address below the would-be address in load order is still one the file never reaches.
    expect(g.reasons.some((r) => r.startsWith("Address 0: the file never reaches it"))).toBe(true);
  });

  it("a downward load ended early counts 'after' in its own direction", () => {
    const run = simulateReadmem("1 2 g 4", ROM, { mode: "descending", start: 7, finish: 0 });
    expect(run.landed).toEqual([7, 6]);
    expect(run.endedAt).toMatchObject({ text: "g", wouldBeAddress: 5, basis: "model" });
    const g = gradePrediction(run, new Set([5, 8]));
    expect(g.reasons.some((r) => r.startsWith("Address 5: the model stops at g"))).toBe(true);
    expect(g.reasons.some((r) => r.startsWith("Address 8: the file never reaches it"))).toBe(true);
  });

  it("an empty prediction is right when nothing lands", () => {
    const g = gradePrediction(runPreset(getReadmemPreset("out-of-range"), "ascending"), new Set());
    expect(g.correct).toBe(true);
    expect(g.headline).toBe("Right: no value lands anywhere.");
  });
});

describe("presets", () => {
  it("every preset runs in every argument mode with a call inside the memory", () => {
    for (const p of READMEM_PRESETS) {
      for (const mode of ARG_MODES) {
        expect(() => validateCall(p.memory, callForMode(p, mode))).not.toThrow();
        const run = runPreset(p, mode);
        expect(run.steps[0].kind).toBe("start");
        expect(run.steps[run.steps.length - 1].kind).toBe("end");
      }
    }
  });

  it("declaration text is computed from the memory", () => {
    expect(declarationText(getReadmemPreset("at10").memory)).toBe("logic [7:0] rom [0:31];");
    expect(declarationText(getReadmemPreset("short").memory)).toBe("logic [8:0] sum_mem [0:3];");
  });

  it("an unknown preset id falls back to the lesson's rom.hex", () => {
    expect(getReadmemPreset("nope").id).toBe("rom-hex");
  });

  it("validateCall rejects a call outside the memory", () => {
    expect(() => validateCall(ROM, { mode: "start", start: 16 })).toThrow();
    expect(() => validateCall(ROM, { mode: "descending", start: 2, finish: 5 })).toThrow();
  });
});
