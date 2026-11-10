import { describe, expect, it } from "vitest";

import {
  DETECTOR_PRESETS,
  DETECT_TARGETS,
  LATCH_NOTE,
  TRAFFIC_EXPECTED_LIGHT,
  analyzeUnassigned,
  cellText,
  detectionCount,
  detectorArcs,
  detectorCode,
  detectorMachine,
  explainLightAt,
  explainPrints,
  findDetectorPreset,
  findTrafficPreset,
  gradeDetectorGuess,
  gradePrintGuess,
  latchSummary,
  logUpTo,
  matchLabel,
  mooreOutputStates,
  noMatchLabel,
  noMatchSelects,
  parseDinStream,
  printEdges,
  referenceMatchEnds,
  runComb,
  runDetector,
  runTraffic,
  stateDuration,
  trafficActiveKeys,
  trafficCode,
  trafficMachine,
  trafficSegments,
  trafficVerdict,
  type Bit,
  type DetectorMachine,
} from "@/lib/fsm-stepper-model";

const BENCH: Bit[] = [1, 0, 1, 0, 1, 1, 0, 1];
const code = (lines: { text: string }[]) => lines.map((l) => l.text).join("\n");
const allStreams = (n: number): Bit[][] =>
  Array.from({ length: 2 ** n }, (_, v) => Array.from({ length: n }, (_, i) => ((v >> (n - 1 - i)) & 1) as Bit));

// The lesson's listing (F2C index.mdx, "Case study: a two-process state machine"), comments included.
const LESSON_MEALY_CODE = [
  "typedef enum logic [1:0] {S_IDLE, S_GOT_1, S_GOT_10} state_t;",
  "state_t state, state_next;",
  "",
  "always_ff @(posedge clk or negedge rst_n) begin   // the only writer of state",
  "  if (!rst_n) state <= S_IDLE;",
  "  else        state <= state_next;",
  "end",
  "",
  "always_comb begin",
  "  state_next = state;      // seed every output: no path can infer a latch",
  "  detected   = 1'b0;",
  "  unique case (state)      // no default: an x or illegal state is reported",
  "    S_IDLE:   if (din)  state_next = S_GOT_1;",
  "    S_GOT_1:  if (!din) state_next = S_GOT_10;",
  "    S_GOT_10: begin",
  "      detected = din;      // Mealy output: depends on the state and on din",
  "      if (din) state_next = S_GOT_1;   // the final 1 can start the next match",
  "      else     state_next = S_IDLE;",
  "    end",
  "  endcase",
  "end",
].join("\n");

describe("101 detector: the lesson's machine and code", () => {
  it("the generated Mealy code equals the lesson's listing character for character", () => {
    expect(code(detectorCode(detectorMachine("mealy")))).toBe(LESSON_MEALY_CODE);
  });

  it("generates the lesson's two-process code from the machine data", () => {
    const text = code(detectorCode(detectorMachine("mealy")));
    expect(text).toContain("typedef enum logic [1:0] {S_IDLE, S_GOT_1, S_GOT_10} state_t;");
    expect(text).toContain("  else        state <= state_next;");
    expect(text).toContain("  state_next = state;      // seed every output: no path can infer a latch");
    expect(text).toContain("  detected   = 1'b0;");
    expect(text).toContain("    S_IDLE:   if (din)  state_next = S_GOT_1;");
    expect(text).toContain("    S_GOT_1:  if (!din) state_next = S_GOT_10;");
    expect(text).toContain("      if (din) state_next = S_GOT_1;");
    expect(text).toContain("      else     state_next = S_IDLE;");
  });

  it("6.19.4: every state_next assignment names an enum value directly, so the code needs no cast (both styles)", () => {
    for (const style of ["mealy", "moore"] as const) {
      const text = code(detectorCode(detectorMachine(style)));
      expect(text).not.toMatch(/\?/);
      expect(text).not.toMatch(/state_t'\(/);
    }
  });

  it("Moore S_FOUND comments give the reason for each arc", () => {
    const text = code(detectorCode(detectorMachine("moore")));
    expect(text).toContain("      if (din) state_next = S_GOT_1;   // this new 1 starts the next match");
    expect(text).toContain("      else     state_next = S_GOT_10;   // the match's final 1 and this 0 are a 1 0 prefix");
    expect(text).toContain("      detected = 1'b1;     // Moore output: depends on the state only");
  });

  it("9.2.2.4 / 9.2.2.2: the always_ff is the only writer of state; the always_comb writes only state_next and detected", () => {
    for (const style of ["mealy", "moore"] as const) {
      const m = detectorMachine(style);
      const lines = detectorCode(m).map((l) => l.text);
      const start = lines.indexOf("always_comb begin");
      const end = lines.lastIndexOf("end");
      expect(start).toBeGreaterThan(0);
      expect(end).toBe(lines.length - 1);
      const comb = lines.slice(start + 1, end).map((l) => l.replace(/\/\/.*$/, ""));
      for (const l of comb) expect(l).not.toMatch(/(^|[^\w])state\s*<?=(?!=)/);
      const targets = [
        ...m.seeds.map((a) => a.target),
        ...m.arms.flatMap((arm) => arm.stmts.flatMap((s) => (s.kind === "assign" ? [s.assign.target] : [s.then.target, ...(s.else ? [s.else.target] : [])]))),
      ];
      for (const t of targets) expect(DETECT_TARGETS).toContain(t);
      const ff = lines.slice(0, start).filter((l) => /state\s*<=/.test(l));
      expect(ff).toEqual(["  if (!rst_n) state <= S_IDLE;", "  else        state <= state_next;"]);
    }
  });

  it("12.5: when two items match, only the first one written runs", () => {
    const overlapping: DetectorMachine = {
      style: "mealy",
      states: ["S_IDLE", "S_GOT_1"],
      encodingWidth: 1,
      seeds: [],
      arms: [
        { state: "S_IDLE", stmts: [{ kind: "assign", assign: { target: "state_next", value: { kind: "state", name: "S_GOT_1" } } }] },
        { state: "S_IDLE", stmts: [{ kind: "assign", assign: { target: "state_next", value: { kind: "state", name: "S_IDLE" } } }] },
      ],
    };
    const r = runComb(overlapping, "S_IDLE", 0);
    expect(r.armIndex).toBe(0);
    expect(r.values.state_next).toBe("S_GOT_1");
    expect(r.executedKeys).toEqual(["arm:S_IDLE:0:assign"]);
  });

  it("12.5: the matching item runs, and an x select or an unused encoding matches no item", () => {
    const m = detectorMachine("mealy");
    expect(runComb(m, "S_GOT_1", 0).armIndex).toBe(1);
    expect(noMatchSelects(m)).toEqual(["x", "2'b11"]);
    const unused = runComb(m, "2'b11", 1);
    expect(unused.armIndex).toBeNull();
    // The seed state_next = state keeps the select's own value.
    expect(unused.values).toEqual({ state_next: "2'b11", detected: 0 });
    expect(runComb(m, "x", 0).values).toEqual({ state_next: "x", detected: 0 });
    const x = runComb(m, "x", 1);
    expect(x.armIndex).toBeNull();
    expect(x.source).toEqual({ state_next: "seed", detected: "seed" });
    expect(noMatchLabel(m)).toBe("x or 2'b11");
    expect(noMatchLabel(detectorMachine("moore"))).toBe("x");
  });

  it("10.4.2: the state sampled at edge k+1 is the state_next computed at edge k (the NBA update lands after the edge)", () => {
    const run = runDetector("mealy", BENCH);
    run.edges.slice(1).forEach((e, i) => expect(e.state).toBe(run.edges[i].nextState));
    expect(run.edges[0].state).toBe("S_IDLE");
  });

  it("reproduces the lesson's TimingDiagram columns on the bench pattern", () => {
    const run = runDetector("mealy", BENCH);
    expect(run.edges.map((e) => e.state)).toEqual(["S_IDLE", "S_GOT_1", "S_GOT_10", "S_GOT_1", "S_GOT_10", "S_GOT_1", "S_GOT_1", "S_GOT_10"]);
    expect(run.edges.map((e) => e.detected)).toEqual([0, 0, 1, 0, 1, 0, 0, 1]);
    expect(run.edges.filter((e) => e.match).map((e) => matchLabel(e))).toEqual([
      "Bits 1 to 3 are 1 0 1: detected",
      "Bits 3 to 5 are 1 0 1: the overlapping second match",
      "Bits 6 to 8 are 1 0 1: detected",
    ]);
  });

  it("overlapping matches count: 10101 gives two detections", () => {
    const run = runDetector("mealy", findDetectorPreset("overlap").din);
    expect(detectionCount(run)).toBe(2);
    expect(run.edges[4].match).toEqual({ from: 2, to: 4, overlapsPrevious: true, sharedBit: 2, number: 2 });
    expect(gradeDetectorGuess(run, 4, null).sentences.at(-1)).toBe(
      "Bits 3 to 5 are 1 0 1. It overlaps the previous match: bit 3, the 1 that completed that match, took the machine from S_GOT_10 to S_GOT_1 instead of S_IDLE, so it also starts this one. Overlapping matches count.",
    );
  });

  it("Moore overlap: the sentence names the transitions the Moore machine takes", () => {
    const moore = runDetector("moore", BENCH);
    const sentence =
      "Bits 3 to 5 are 1 0 1. It overlaps the previous match: bit 3, the 1 that completed that match, took S_GOT_10 to S_FOUND at edge 2. S_FOUND remembers that 1, so the 0 at bit 4 took S_FOUND to S_GOT_10 at edge 3 instead of S_IDLE. Overlapping matches count.";
    expect(moore.edges[2]).toMatchObject({ state: "S_GOT_10", nextState: "S_FOUND" });
    expect(moore.edges[3]).toMatchObject({ state: "S_FOUND", nextState: "S_GOT_10" });
    expect(moore.edges.some((e) => e.edge >= 2 && e.edge <= 5 && e.state === "S_GOT_1")).toBe(false);
    expect(gradeDetectorGuess(moore, 5, null).sentences.at(-1)).toBe(sentence);
    expect(matchLabel(moore.edges[5])).toBe("Bits 3 to 5 are 1 0 1: the overlapping second match");
    const alt = runDetector("moore", [1, 0, 1, 0, 1, 0, 1]);
    expect(alt.edges[5].match).toMatchObject({ from: 2, to: 4, overlapsPrevious: true });
    expect(gradeDetectorGuess(alt, 5, null).sentences.at(-1)).toBe(sentence);
  });

  it("presets 1001 and 111 give no detection", () => {
    expect(detectionCount(runDetector("mealy", findDetectorPreset("1001").din))).toBe(0);
    expect(detectionCount(runDetector("mealy", findDetectorPreset("111").din))).toBe(0);
    expect(DETECTOR_PRESETS.map((p) => p.id)).toEqual(["bench", "overlap", "1001", "111"]);
  });

  it("Mealy detections match a brute-force 1 0 1 search on every 8-bit stream", () => {
    for (const din of allStreams(8)) {
      const run = runDetector("mealy", din);
      expect(run.edges.filter((e) => e.detected === 1).map((e) => e.edge)).toEqual(referenceMatchEnds(din));
    }
  });

  it("Moore toggle: the FOUND state makes detected arrive one edge later, on every 8-bit stream", () => {
    for (const din of allStreams(8)) {
      const mealy = runDetector("mealy", din);
      const moore = runDetector("moore", din);
      moore.edges.slice(1).forEach((e, i) => expect(e.detected).toBe(mealy.edges[i].detected));
      expect(moore.edges[0].detected).toBe(0);
      expect(moore.pendingDetect).toBe(mealy.edges[din.length - 1].detected === 1);
      expect(detectionCount(moore)).toBe(detectionCount(mealy));
    }
    expect(mooreOutputStates(detectorMachine("moore"))).toEqual(["S_FOUND"]);
  });

  it("state diagram arcs come from the same items the stepper executes", () => {
    const arcs = detectorArcs(detectorMachine("mealy"));
    expect(arcs).toHaveLength(6);
    expect(arcs.filter((a) => a.detected === 1)).toEqual([{ from: "S_GOT_10", to: "S_GOT_1", din: 1, detected: 1 }]);
    expect(arcs.find((a) => a.from === "S_GOT_10" && a.din === 0)?.to).toBe("S_IDLE");
  });
});

describe("unassigned-path analysis (9.2.2.2, 12.5)", () => {
  it("9.2.2.2: with the seed lines, every (state, din) cell assigns both outputs, the x row included", () => {
    for (const style of ["mealy", "moore"] as const) {
      expect(analyzeUnassigned(detectorMachine(style), true).every((c) => c.unassigned.length === 0)).toBe(true);
    }
    expect(analyzeUnassigned(detectorMachine("mealy"), true)).toHaveLength(8);
    expect(analyzeUnassigned(detectorMachine("moore"), true)).toHaveLength(10);
    expect(latchSummary(detectorMachine("mealy"), true)).toBe(
      "With the seed lines, all 8 cells assign both state_next and detected, including x or 2'b11, where no case item runs. No latch can be inferred.",
    );
  });

  it("9.2.2.2: without the seeds, the Mealy cells that miss an output are exactly the lesson's latch paths", () => {
    const cells = analyzeUnassigned(detectorMachine("mealy"), false);
    const at = (select: string, din: Bit) => cells.find((c) => c.select === select && c.din === din)?.unassigned;
    expect(at("S_IDLE", 0)).toEqual(["state_next", "detected"]);
    expect(at("S_IDLE", 1)).toEqual(["detected"]);
    expect(at("S_GOT_1", 0)).toEqual(["detected"]);
    expect(at("S_GOT_1", 1)).toEqual(["state_next", "detected"]);
    expect(at("S_GOT_10", 0)).toEqual([]);
    expect(at("S_GOT_10", 1)).toEqual([]);
    expect(at("x", 0)).toEqual(["state_next", "detected"]);
    expect(at("x", 1)).toEqual(["state_next", "detected"]);
    expect(latchSummary(detectorMachine("mealy"), false)).toBe(
      `Without the seed lines, 6 of 8 cells leave an output unassigned (state_next in 4, detected in 6). On each such path the output ${LATCH_NOTE}.`,
    );
  });

  it("the arc table's cell text: the no-match row keeps the select's own value, and seeds-off cells say what holds", () => {
    const mealy = detectorMachine("mealy");
    for (const din of [0, 1] as Bit[]) {
      expect(cellText(mealy, "x", din, true)).toEqual({
        main: "no item runs (12.5); the seeds give state_next = state (x stays x, 2'b11 stays 2'b11), detected = 0",
      });
    }
    expect(cellText(detectorMachine("moore"), "x", 0, true).main).toBe("no item runs (12.5); the seeds give state_next = state (x stays x), detected = 0");
    expect(cellText(mealy, "x", 1, false)).toEqual({
      main: "no item runs (12.5); state_next holds old value, detected holds old value",
      warning: "state_next, detected unassigned",
    });
    expect(cellText(mealy, "S_GOT_10", 1, true)).toEqual({ main: "S_GOT_1, detected = 1" });
    expect(cellText(mealy, "S_GOT_10", 1, false)).toEqual({ main: "S_GOT_1, detected = 1" });
    expect(cellText(mealy, "S_IDLE", 1, false)).toEqual({ main: "S_GOT_1, detected holds old value", warning: "detected unassigned" });
    expect(cellText(mealy, "S_GOT_1", 1, false)).toEqual({ main: "state_next holds old value, detected holds old value", warning: "state_next, detected unassigned" });
    expect(cellText(detectorMachine("moore"), "S_FOUND", 0, false)).toEqual({ main: "S_GOT_10, detected = 1" });
  });

  it("9.2.2.2: the latch note says tools should warn, not that they must", () => {
    expect(LATCH_NOTE).toBe("holds old value: latched behaviour; tools should warn (9.2.2.2)");
  });

  it("the removed seed lines are shown as removed in the code", () => {
    const text = code(detectorCode(detectorMachine("mealy"), false));
    expect(text).toContain("// removed: state_next = state;");
    expect(text).not.toMatch(/^ {2}state_next = state;/m);
  });
});

describe("prediction grading", () => {
  const run = runDetector("mealy", BENCH);

  it("explains a correct prediction with the item that ran and the NBA update (10.4.2)", () => {
    const g = gradeDetectorGuess(run, 2, { next: "S_GOT_1", detected: 1 });
    expect(g.nextCorrect && g.detectedCorrect).toBe(true);
    expect(g.headline).toBe("Correct: next state S_GOT_1, detected 1.");
    expect(g.sentences[0]).toBe(
      "In S_GOT_10 with din = 1, unique case (state) runs the S_GOT_10 item, the first item that matches (12.5). It runs state_next = S_GOT_1, so the next state is S_GOT_1.",
    );
    expect(g.sentences[1]).toMatch(/runs detected = din\. A Mealy output depends on the state and on din/);
    expect(g.sentences[2]).toMatch(/NBA region.*\(10\.4\.2\)/);
  });

  it("names the half that is wrong, and the seed that holds when an if has no else", () => {
    const g = gradeDetectorGuess(run, 5, { next: "S_GOT_10", detected: 0 });
    expect(g.headline).toBe("detected 0 is right, but the next state is S_GOT_1, not S_GOT_10.");
    expect(g.sentences[0]).toMatch(/if \(!din\) is false and has no else, so state_next keeps its seed, state/);
    expect(g.sentences[1]).toBe("Only the S_GOT_10 item assigns detected, so here it keeps its seed, 1'b0: detected is 0.");
  });

  it("Moore: detected comes from the S_FOUND item alone", () => {
    const moore = runDetector("moore", BENCH);
    const g = gradeDetectorGuess(moore, 3, { next: "S_GOT_10", detected: 1 });
    expect(g.nextCorrect && g.detectedCorrect).toBe(true);
    expect(g.sentences[1]).toMatch(/S_FOUND item runs detected = 1'b1\. A Moore output depends on the state only/);
  });
});

describe("din stream input", () => {
  it("accepts 0 and 1 with spaces, and rejects empty, x/z and over-long streams with a visible reason", () => {
    expect(parseDinStream("1 0 1")).toEqual({ bits: [1, 0, 1] });
    expect(parseDinStream("  ").error).toBe("Type at least one bit.");
    expect(parseDinStream("10x1").error).toMatch(/"x" is not 0 or 1.*x and z are outside its model/);
    expect(parseDinStream("1".repeat(17)).error).toBe("At most 16 bits.");
  });
});

describe("traffic-light controller", () => {
  it("reproduces the bench's expected_light sequence and the lesson's state and timer columns", () => {
    const run = runTraffic(trafficMachine(false));
    expect(run.edges.map((e) => e.light)).toEqual(TRAFFIC_EXPECTED_LIGHT);
    expect(run.edges.map((e) => e.state)).toEqual(["RED", "RED", "RED", "RED", "GREEN", "GREEN", "GREEN", "YELLOW", "RED", "RED", "RED", "RED"]);
    expect(run.edges.map((e) => e.timer)).toEqual([3, 2, 1, 0, 2, 1, 0, 0, 3, 2, 1, 0]);
    expect(run.fail).toBe(0);
  });

  it("the timer loads 3/2/0, so the states last 4/3/1 edges", () => {
    const m = trafficMachine(false);
    expect([m.loads.RED, m.loads.GREEN, m.loads.YELLOW]).toEqual([3, 2, 0]);
    expect([stateDuration(m, "RED"), stateDuration(m, "GREEN"), stateDuration(m, "YELLOW")]).toEqual([4, 3, 1]);
  });

  it("prints the lesson's expected output: changes after edges 3, 6, 7 and 11", () => {
    const run = runTraffic(trafficMachine(false));
    expect(run.log).toEqual(["t=55 ns: light=001", "t=85 ns: light=010", "t=95 ns: light=100", "t=135 ns: light=001", "PASS=12 FAIL=0"]);
    expect(printEdges(run)).toEqual([3, 6, 7, 11]);
    expect(explainPrints(run)).toMatch(/^A change is printed after edges 3 \(t = 55 ns, light=001\), 6/);
    expect(logUpTo(run, 6)).toEqual(["t=55 ns: light=001", "t=85 ns: light=010"]);
    expect(logUpTo(run, 11)).toEqual(run.log);
  });

  it("break-it: YELLOW loading 4'd1 gives the first failure at edge 8", () => {
    const run = runTraffic(trafficMachine(true));
    expect(run.firstFailure).toBe(8);
    expect(run.pass).toBe(11);
    expect(run.fail).toBe(1);
    expect(printEdges(run)).toEqual([3, 6, 8]);
    expect(run.log).toEqual([
      "t=55 ns: light=001",
      "t=85 ns: light=010",
      "$error at t=105 ns: edge 8: light=010, expected 100",
      "t=105 ns: light=100",
      "PASS=11 FAIL=1",
    ]);
    expect(trafficVerdict(run)).toBe("PASS=11 FAIL=1. The first failure is at edge 8 (t = 105 ns): light=010, expected 100.");
    expect(code(trafficCode(run.machine))).toContain("YELLOW: timer <= 4'd1;");
  });

  it("explains the light at a chosen edge from the segment it falls in", () => {
    const run = runTraffic(trafficMachine(false));
    expect(explainLightAt(run, 7)).toBe(
      "Edge 7 is the only edge where state is YELLOW: it was entered after edge 6, where the flop loaded timer <= 4'd0, so it lasts 1 edge. The decoder gives light = 010, which matches expected_light[7].",
    );
    expect(explainLightAt(run, 0)).toMatch(/reset put it there with timer = 3, so it lasts 4 edges/);
    const broken = runTraffic(trafficMachine(true));
    expect(explainLightAt(broken, 8)).toMatch(/edges 7 to 8, where state is YELLOW.*lasts 2 edges.*expected_light\[8\] is 100/);
    expect(trafficSegments(broken).at(-1)).toMatchObject({ state: "RED", from: 9, to: 11, cut: true });
  });

  it("grades the print prediction with the missing and extra edges", () => {
    const run = runTraffic(trafficMachine(false));
    expect(gradePrintGuess(run, [3, 6, 7, 11]).correct).toBe(true);
    expect(gradePrintGuess(run, [3, 4]).sentence).toBe("Not quite: you missed 6, 7, 11, and 4 print nothing (at edge 4 timer is 2, so state holds).");
  });

  it("12.5 / 9.2.2.4: the active decoder item and the always_ff branch follow the edge", () => {
    const run = runTraffic(trafficMachine(false));
    expect(trafficActiveKeys(run.edges[3])).toEqual({ active: "dec:RED", context: ["next:RED", "ff:move", "load:GREEN"] });
    expect(trafficActiveKeys(run.edges[1])).toEqual({ active: "dec:RED", context: ["next:RED", "ff:count"] });
    const keys = trafficCode(run.machine).map((l) => l.key);
    for (const k of ["dec:RED", "next:YELLOW", "load:GREEN", "ff:count", "ff:move"]) expect(keys).toContain(k);
  });

  it("presets: the lesson controller and the YELLOW break-it", () => {
    expect(findTrafficPreset("break-yellow")).toMatchObject({ broken: true, predictEdge: 8 });
    expect(findTrafficPreset(undefined).id).toBe("lesson");
  });
});
