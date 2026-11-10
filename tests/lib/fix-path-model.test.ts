import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { COST_STAGES } from "@/lib/bug-cost-model";
import {
  CUSTOM_DEFAULT,
  DECIDE_SCENARIOS,
  DELAY_CLASSES,
  DELAY_EXCEPTION,
  FIB_AT_SPEC,
  FIELD_METAL_DELAY,
  FIELD_METAL_WHAT_CHANGES,
  FIX_LABELS,
  KATA_SCENARIOS,
  MISCONCEPTIONS,
  RANKING_START,
  STAGE_DELAYS,
  TREE_BRANCHES,
  TREE_NODES,
  TREE_STEP5,
  WHAT_CHANGES,
  allCorrect,
  costExplanation,
  costOrder,
  decide,
  escapeLine,
  factLines,
  findScenario,
  gradeCostOrder,
  gradeDelayOrder,
  isTapedOut,
  layersFor,
  multiplierText,
  predictionFeedback,
  predictionOptions,
  respinPath,
  spareFit,
  treePath,
  validateFacts,
  type BugFacts,
  type FixShape,
} from "@/lib/fix-path-model";

const scenario = (id: string) => {
  const s = findScenario(id);
  if (!s) throw new Error(`no scenario ${id}`);
  return s;
};

const shape = (over: Partial<FixShape> = {}): FixShape => ({
  needsNewTransistors: false,
  spare: { gatesNeeded: 4, spareCellsNearby: 12 },
  spareCellsElsewhere: false,
  timing: "closes",
  ...over,
});

const facts = (over: Partial<BugFacts> = {}): BugFacts => ({ stage: "post-silicon", workaround: "none", fix: shape(), ...over });

describe("F1A > Worked example: four late bugs, four decisions", () => {
  it("bug 1, wrong reset value three weeks before tape-out: pre-tape-out ECO, ×100, days to weeks, no masks yet", () => {
    const d = decide(scenario("reset-value").facts);
    expect(d.kind).toBe("eco");
    expect(d.stage.id).toBe("system");
    expect(d.multiplierText).toBe("×100");
    expect(d.delay).toBe("Days to weeks; no masks yet");
    expect(d.sections).toHaveLength(1);
    expect(d.sections[0].layers.every((l) => l.state === "no-mask")).toBe(true);
  });

  it("bug 2, > vs >= with spare cells nearby: metal-only respin, ×1,000, weeks, FIB-confirmed first", () => {
    const d = decide(scenario("comparator").facts);
    expect(d.kind).toBe("metal");
    expect(d.multiplierText).toBe("×1,000");
    expect(d.delay).toBe("Weeks");
    expect(d.why).toMatch(/FIB edit on a few samples proves the fix before the masks are bought/);
  });

  it("bug 3, a new pipeline stage of several hundred flip-flops: full respin, ×1,000 or more, months", () => {
    const d = decide(scenario("pipeline-stage").facts);
    expect(d.kind).toBe("full");
    expect(d.multiplierText).toBe("×1,000 or more");
    expect(d.delay).toBe("Months");
    expect(d.why).toMatch(/only the base layers can provide/);
  });

  it("bug 4, field corruption with a defeature bit: workaround now, real fix in the next silicon revision, ×10,000", () => {
    const d = decide(scenario("field-corruption").facts);
    expect(d.kind).toBe("workaround");
    expect(d.realFix).toBe("next-revision");
    expect(d.multiplierText).toBe("×10,000");
    expect(d.delay).toBe("Workaround as fast as a firmware release; the real fix waits for new silicon");
    expect(d.why).toMatch(/defeature bit protects customers now/);
    expect(d.summary).toMatch(/^Fix: Defeature bit through a firmware update now/);
  });

  it("every worked example's decision matches the decision the lesson states", () => {
    expect(DECIDE_SCENARIOS.map((s) => s.id)).toEqual(["reset-value", "comparator", "pipeline-stage", "field-corruption"]);
    DECIDE_SCENARIOS.forEach((s) => expect(decide(s.facts).kind).toBe(s.lessonKind));
  });
});

describe("F1A > Estimation kata: four bugs, one ranking", () => {
  it("every kata answer matches the lesson's worked solution", () => {
    const got = KATA_SCENARIOS.map((s) => [decide(s.facts).kind, decide(s.facts).multiplierText, decide(s.facts).delay]);
    expect(got).toEqual([
      ["spec", "×1", "Hours"],
      ["eco", "×100", "Days to weeks; no masks yet"],
      ["depends", "×1,000 or more", "Weeks if metal-only closes; months if not"],
      ["workaround", "×10,000", "Workaround as fast as a firmware release; the real fix waits for new silicon"],
    ]);
    KATA_SCENARIOS.forEach((s) => expect(decide(s.facts).kind).toBe(s.lessonKind));
  });

  it("kata 3: 40 gates against 12 nearby cells with more far away and timing unknown is 'depends', and the counts come from the facts", () => {
    const d = decide(scenario("kata-spare-cells").facts);
    expect(d.why).toContain("(40 gates needed, 12 spare cells nearby)");
    expect(d.why).toMatch(/If physical design finds a timing-clean metal-only fix, it is a metal-only respin .*; if not, a full respin\./);
    expect(d.sections.map((x) => x.caption)).toEqual(["If timing closes: metal-only respin", "If not: full respin"]);
  });

  it("kata 4: firmware waits after wake; no defeature bit", () => {
    const d = decide(scenario("kata-dma-wake").facts);
    expect(d.kind).toBe("workaround");
    expect(d.why).toMatch(/^A firmware update avoids the bug now/);
    expect(scenario("kata-dma-wake").detail).toMatch(/wait/);
  });

  it("the cost ranking is read from COST_STAGES, cheapest first", () => {
    expect(costOrder()).toEqual(["spec", "rtl", "system", "post-silicon", "field"]);
    expect(costExplanation()).toBe(
      "Cheapest first: Spec review ×1, RTL simulation ×10, Full-chip / emulation ×100, Post-silicon (lab) ×1,000, In the field ×10,000. Each later stage is about ten times the one before: a rule of thumb, not data.",
    );
  });

  it("the ranking starts from an order that is not the answer and contains every stage once", () => {
    expect([...RANKING_START].sort()).toEqual(COST_STAGES.map((s) => s.id).sort());
    expect(RANKING_START).not.toEqual(costOrder());
    expect(allCorrect(gradeCostOrder(RANKING_START))).toBe(false);
    expect(allCorrect(gradeDelayOrder(RANKING_START))).toBe(false);
  });

  it("cost grading marks each position against the cost order", () => {
    expect(allCorrect(gradeCostOrder(costOrder()))).toBe(true);
    const marks = gradeCostOrder(["rtl", "spec", "system", "post-silicon", "field"]);
    expect(marks).toEqual({ rtl: "wrong", spec: "wrong", system: "correct", "post-silicon": "correct", field: "correct" });
  });

  it("delay grading: the same order, except that the field stage is not graded wherever it sits (field containment can be fast)", () => {
    const ok = ["field", "spec", "rtl", "system", "post-silicon"] as const;
    const marks = gradeDelayOrder(ok);
    expect(marks.field).toBeUndefined();
    expect(allCorrect(marks)).toBe(true);
    expect(allCorrect(gradeDelayOrder(costOrder()))).toBe(true);
    expect(gradeDelayOrder(["spec", "system", "rtl", "field", "post-silicon"])).toEqual({ spec: "correct", system: "wrong", rtl: "wrong", "post-silicon": "correct" });
    expect(DELAY_EXCEPTION).toMatch(/contained quickly while its real fix waits for new silicon/);
  });

  it("stage delays use the lesson's wording, and field is the only stage with a fast containment", () => {
    expect(STAGE_DELAYS).toEqual({
      spec: "Hours",
      rtl: "Minutes to days",
      system: "Days to weeks",
      "post-silicon": "Weeks to months",
      field: DELAY_CLASSES.workaround,
    });
  });
});

describe("F1A > How to triage a late bug: steps 2-4 as a decision tree", () => {
  it("step 3: before tape-out a small fix is a pre-tape-out ECO (fix table: 'A small fix found late before tape-out')", () => {
    expect(isTapedOut("system")).toBe(false);
    expect(isTapedOut("post-silicon")).toBe(true);
    expect(isTapedOut("field")).toBe(true);
    const d = decide(facts({ stage: "system", fix: shape({ timing: "unknown" }) }));
    expect(d.kind).toBe("eco");
    expect(d.why).toMatch(/a small late fix is only a database edit/);
    expect(d.whatChanges).toBe(WHAT_CHANGES.eco);
    expect(d.tree.map((t) => [t.step, t.answer, t.leadsTo])).toEqual([
      [2, "no", null],
      [3, "no", FIX_LABELS.eco],
    ]);
  });

  it("step 3: a larger change before tape-out (new transistors) is not called an ECO; it is excluded ('Larger changes go back through synthesis and place-and-route')", () => {
    const large = facts({ stage: "system", fix: shape({ needsNewTransistors: true }) });
    expect(() => validateFacts(large)).toThrow(/synthesis and place-and-route/);
    expect(() => decide(large)).toThrow(RangeError);
    expect(() => predictionFeedback(large, "eco")).toThrow(RangeError);
  });

  it("step 4: new transistors force a full respin (fix table: 'needs new transistors or a larger logic change')", () => {
    expect(respinPath(shape({ needsNewTransistors: true, timing: "closes" }))).toBe("full");
  });

  it("step 4 and Designing for fixability: spare-cell fit and timing decide metal-only against full", () => {
    expect(respinPath(shape())).toBe("metal");
    expect(respinPath(shape({ timing: "fails" }))).toBe("full");
    expect(respinPath(shape({ timing: "unknown" }))).toBe("depends");
    expect(respinPath(shape({ spare: { gatesNeeded: 40, spareCellsNearby: 12 } }))).toBe("full");
    expect(respinPath(shape({ spare: { gatesNeeded: 40, spareCellsNearby: 12 }, spareCellsElsewhere: true }))).toBe("metal");
    expect(respinPath(shape({ spare: { gatesNeeded: 40, spareCellsNearby: 12 }, spareCellsElsewhere: true, timing: "fails" }))).toBe("full");
  });

  it("edge cases: zero gates is pure rewiring, equal counts fit, one gate over does not", () => {
    expect(spareFit(shape({ spare: { gatesNeeded: 0, spareCellsNearby: 0 } }))).toBe("nearby");
    expect(decide(facts({ fix: shape({ spare: { gatesNeeded: 0, spareCellsNearby: 0 } }) })).why).toMatch(/^The fix is pure rewiring/);
    expect(spareFit(shape({ spare: { gatesNeeded: 12, spareCellsNearby: 12 } }))).toBe("nearby");
    expect(spareFit(shape({ spare: { gatesNeeded: 13, spareCellsNearby: 12 } }))).toBe("none");
    expect(decide(facts({ fix: shape({ spare: { gatesNeeded: 1, spareCellsNearby: 1 } }) })).why).toContain("(1 gate needed, 1 spare cell nearby)");
  });

  it("edge cases: negative, fractional and non-finite counts are rejected", () => {
    expect(() => spareFit(shape({ spare: { gatesNeeded: -1, spareCellsNearby: 12 } }))).toThrow(RangeError);
    expect(() => spareFit(shape({ spare: { gatesNeeded: 1.5, spareCellsNearby: 12 } }))).toThrow(RangeError);
    expect(() => decide(facts({ fix: shape({ spare: { gatesNeeded: 4, spareCellsNearby: Number.NaN } }) }))).toThrow(RangeError);
  });

  it("every metal-only fix needs timing to close, including one that fits in nearby spare cells (listed as an assumption)", () => {
    expect(respinPath(shape({ spare: "fits-nearby", timing: "fails" }))).toBe("full");
    expect(respinPath(shape({ spare: "fits-nearby", timing: "unknown" }))).toBe("depends");
  });

  it("excluded facts: RTL-simulation bugs, workarounds before tape-out, and an unstated fix with no workaround", () => {
    expect(() => validateFacts(facts({ stage: "rtl" }))).toThrow(/RTL simulation are not modelled/);
    expect(() => validateFacts(facts({ stage: "system", workaround: "firmware" }))).toThrow(/only after tape-out/);
    expect(() => validateFacts(facts({ fix: null }))).toThrow(RangeError);
    expect(() => validateFacts(facts({ fix: shape({ spare: "not-stated" }) }))).toThrow(/spare-cell fit stated/);
  });

  it("step 2: a workaround is the production fix, and the RTL fix still takes steps 3 and 4 below it", () => {
    const d = decide(facts({ stage: "field", workaround: "firmware", fix: shape({ timing: "unknown" }) }));
    expect(d.kind).toBe("workaround");
    expect(d.realFix).toBe("depends");
    expect(d.tree.map((t) => [t.step, t.answer, t.role])).toEqual([
      [2, "yes", "production"],
      [3, "yes", "real-fix"],
      [4, "depends", "real-fix"],
    ]);
    expect(d.sections.map((s) => s.caption)).toEqual([
      "Now: the shipped silicon is unchanged",
      "Later, if timing closes: metal-only respin",
      "Later, if not: full respin",
    ]);
  });

  it("the worked examples' tree paths", () => {
    expect(treePath(scenario("comparator").facts).map((t) => t.answer)).toEqual(["no", "yes", "yes"]);
    expect(treePath(scenario("pipeline-stage").facts).map((t) => t.answer)).toEqual(["no", "yes", "no"]);
    expect(treePath(scenario("field-corruption").facts).map((t) => t.answer)).toEqual(["yes", "yes", "open"]);
    expect(treePath(scenario("kata-fifo-spec").facts)).toEqual([]);
  });
});

describe("F1A > Fixing silicon: the respin figure's layer encoding", () => {
  it("(a) ECO dashed, (b) metal-only upper metal hatched with lowest metal and base reused, (c) full all hatched; bug 4 all solid", () => {
    expect(layersFor("eco").map((l) => l.state)).toEqual(["no-mask", "no-mask", "no-mask", "no-mask"]);
    expect(layersFor("metal").map((l) => l.state)).toEqual(["new", "new", "reused", "reused"]);
    expect(layersFor("full").map((l) => l.state)).toEqual(["new", "new", "new", "new"]);
    expect(layersFor("workaround").map((l) => l.state)).toEqual(["reused", "reused", "reused", "reused"]);
    expect(layersFor("metal").map((l) => l.label)).toEqual(["upper metal + vias", "metal + vias", "lowest metal", "base (transistors)"]);
  });

  it("the multiplier comes from COST_STAGES, with 'or more' only for a full or possible full respin found post-silicon", () => {
    expect(multiplierText("post-silicon", "metal")).toBe("×1,000");
    expect(multiplierText("post-silicon", "full")).toBe("×1,000 or more");
    expect(multiplierText("post-silicon", "depends")).toBe("×1,000 or more");
    expect(multiplierText("field", "full")).toBe("×10,000");
    expect(multiplierText("spec", "spec")).toBe("×1");
  });
});

describe("F1A > Interview angle 'ECO or respin?': prediction feedback diagnoses the misconceptions", () => {
  it("'lines of RTL = layers': metal-only for a fix that needs new transistors", () => {
    const fb = predictionFeedback(scenario("pipeline-stage").facts, "metal");
    expect(fb.correct).toBe(false);
    expect(fb.feedback).toBe(MISCONCEPTIONS.linesOfRtl);
  });

  it("'any bug can be fixed in metal': metal-only when the spare cells cannot build it", () => {
    const fb = predictionFeedback(facts({ fix: shape({ spare: { gatesNeeded: 40, spareCellsNearby: 12 } }) }), "metal");
    expect(fb.feedback).toBe(MISCONCEPTIONS.anyBugInMetal);
  });

  it("'a FIB edit fixes production' is wrong for every scenario; at spec review there is no chip to edit at all", () => {
    [...DECIDE_SCENARIOS, ...KATA_SCENARIOS].forEach((s) => {
      const expected = s.facts.stage === "spec" ? FIB_AT_SPEC : MISCONCEPTIONS.fibFixesProduction;
      expect(predictionFeedback(s.facts, "fib")).toEqual({ correct: false, feedback: expected });
    });
    expect(FIB_AT_SPEC).toMatch(/no chip/);
    expect(FIB_AT_SPEC).not.toMatch(/masks or a workaround/);
  });

  it("'every silicon fix needs a full respin': full when metal-only works", () => {
    expect(predictionFeedback(scenario("comparator").facts, "full").feedback).toBe(MISCONCEPTIONS.everyFixIsFull);
  });

  it("an ECO after tape-out, a respin before it, and a respin when a workaround exists are each diagnosed", () => {
    expect(predictionFeedback(scenario("comparator").facts, "eco").feedback).toMatch(/masks exist/);
    expect(predictionFeedback(scenario("reset-value").facts, "metal").feedback).toMatch(/no masks exist/);
    expect(predictionFeedback(scenario("field-corruption").facts, "full").feedback).toMatch(/^Step 2 comes first/);
    expect(predictionFeedback(scenario("comparator").facts, "workaround").feedback).toMatch(/no firmware or defeature path/);
    expect(predictionFeedback(scenario("comparator").facts, "depends").feedback).toMatch(/^Nothing here is left open/);
    expect(predictionFeedback(scenario("kata-spare-cells").facts, "metal").feedback).toMatch(/Timing is not known yet/);
    expect(predictionFeedback(scenario("kata-spare-cells").facts, "full").feedback).toMatch(/Timing is not known yet/);
  });

  it("exactly one option is correct for every scenario, and its feedback is the decision's own explanation", () => {
    [...DECIDE_SCENARIOS, ...KATA_SCENARIOS].forEach((s) => {
      const mode = s.facts.stage === "spec" ? "kata" : KATA_SCENARIOS.includes(s) ? "kata" : "decide";
      const results = predictionOptions(mode).map((o) => predictionFeedback(s.facts, o));
      expect(results.filter((r) => r.correct)).toHaveLength(1);
      expect(results.find((r) => r.correct)?.feedback).toBe(decide(s.facts).why);
    });
  });
});

describe("F1A > How to triage a late bug, step 5: escape analysis", () => {
  it("names the earlier activity and computes the ratio with costRatio", () => {
    const s = scenario("kata-interrupt");
    expect(escapeLine(s.facts.stage, s.escape)).toBe(
      "Escape analysis (step 5): the plan had no check on when the interrupt clears: add a scenario and an assertion for it at block level. Caught at RTL simulation (×10) instead of Full-chip / emulation (×100), the rule of thumb says it costs 10 times less.",
    );
    const c = scenario("comparator");
    expect(escapeLine(c.facts.stage, c.escape)).toMatch(/instead of Post-silicon \(lab\) \(×1,000\), the rule of thumb says it costs 100 times less\.$/);
  });

  it("escape activities the lesson does not state (worked-example bugs 1 and 2) are marked 'for example'; stated ones are not", () => {
    expect(escapeLine("system", scenario("reset-value").escape)).toMatch(/^Escape analysis \(step 5\), for example: block-level simulation/);
    expect(escapeLine("post-silicon", scenario("comparator").escape)).toMatch(/^Escape analysis \(step 5\), for example: a block-level test/);
    ["field-corruption", "kata-interrupt", "kata-dma-wake"].forEach((id) => {
      const s = scenario(id);
      expect(escapeLine(s.facts.stage, s.escape)).not.toMatch(/for example/);
    });
  });

  it("without a named activity the line states step 5 generically; spec review needs none", () => {
    expect(escapeLine("post-silicon", null)).toMatch(/^Escape analysis \(step 5\): name the earlier activity/);
    expect(escapeLine("spec", null)).toMatch(/none needed/);
    const f = scenario("field-corruption");
    expect(escapeLine(f.facts.stage, f.escape)).toBe("Escape analysis (step 5): ask why no test combined that traffic mix, and add it to the plan.");
  });
});

describe("F1A > How to triage a late bug: the tree constants match the lesson's decision tree", () => {
  it("node labels, questions and branch targets are pinned", () => {
    expect(TREE_NODES).toEqual({
      2: { node: "2 Avoidable?", question: "Can firmware, a defeature bit or a software rule avoid the bug safely?" },
      3: { node: "3 Taped out?", question: "Do masks exist?" },
      4: { node: "4 Metal fix?", question: "Does the fix fit in rewiring plus spare cells?" },
    });
    expect(TREE_BRANCHES).toEqual({
      2: { yes: "Workaround: now; the RTL fix, if needed, takes the path below", no: "Go to step 3" },
      3: { yes: "Go to step 4", no: "Pre-tape-out ECO" },
      4: { yes: "Metal-only respin (FIB-confirm first)", no: "Full (base-layer) respin" },
    });
    expect(TREE_STEP5.node).toBe("5 Escape");
  });

  it("every node label and the 'FIB-confirm first' note appear in the lesson's ArchitectureDiagram", () => {
    const lesson = readFileSync(join(process.cwd(), "content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx"), "utf8");
    const start = lesson.indexOf('title="Triage of a late bug as a decision tree"');
    expect(start).toBeGreaterThan(-1);
    const tree = lesson.slice(start, lesson.indexOf("/>", start));
    [TREE_NODES[2].node, TREE_NODES[3].node, TREE_NODES[4].node, TREE_STEP5.node].forEach((label) => expect(tree).toContain(`label: "${label}"`));
    expect(tree).toContain('sublabel: "FIB-confirm first"');
    // Branch targets: step 2 yes -> workaround, step 3 no -> ECO, step 3 yes -> step 4, step 4 yes -> metal-only, no -> full.
    [
      '{ from: "s2", to: "wa", style: "causal", label: "yes" }',
      '{ from: "s2", to: "s3", style: "causal", label: "no" }',
      '{ from: "s3", to: "eco", style: "causal", label: "no" }',
      '{ from: "s3", to: "s4", style: "causal", label: "yes" }',
      '{ from: "s4", to: "metal", style: "causal", label: "yes" }',
      '{ from: "s4", to: "full", style: "causal", label: "no" }',
    ].forEach((edge) => expect(tree).toContain(edge));
  });
});

describe("F1A > Fixing silicon: held wafers belong to first silicon", () => {
  it("a metal-only fix found post-silicon finishes held wafers, as the lesson says", () => {
    const d = decide(scenario("comparator").facts);
    expect(d.whatChanges).toBe(WHAT_CHANGES.metal);
    expect(d.whatChanges).toMatch(/held wafers are finished/);
    expect(d.delay).toBe("Weeks");
  });

  it("a metal-only fix for a field bug does not assume held wafers", () => {
    const d = decide(facts({ stage: "field" }));
    expect(d.kind).toBe("metal");
    expect(d.whatChanges).toBe(FIELD_METAL_WHAT_CHANGES);
    expect(d.whatChanges).not.toMatch(/held wafers are finished/);
    expect(d.delay).toBe(FIELD_METAL_DELAY);
    expect(d.summary).toContain(FIELD_METAL_DELAY);
  });
});

describe("facts shown before a prediction", () => {
  it("state inputs only, never a fix label", () => {
    const labels = Object.values(FIX_LABELS);
    [...DECIDE_SCENARIOS, ...KATA_SCENARIOS].forEach((s) => {
      factLines(s.facts).forEach((line) => labels.forEach((l) => expect(line).not.toContain(l)));
    });
    expect(factLines(CUSTOM_DEFAULT)).toContain("Gates needed: 4; spare cells nearby: 12");
  });
});
