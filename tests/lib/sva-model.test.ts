import { describe, expect, it } from "vitest";

import {
  assertionCode,
  diagnoseAttempt,
  evaluateProperty,
  evaluateSva,
  focusEdge,
  parseSva,
  scenarioTrace,
  svaDebugCases,
  svaLearnScenarios,
  temporalFamilies,
  type AttemptStatus,
  type SvaEvaluation,
  type SvaTrace,
} from "@/lib/sva-model";

/** Build a trace from bit strings: `values[k]` is the value sampled at edge k. */
function tr(rows: Record<string, string>, defaults?: SvaTrace["defaults"]): SvaTrace {
  const signals: SvaTrace["signals"] = {};
  let length = 0;
  for (const [name, bits] of Object.entries(rows)) {
    signals[name] = [...bits].map((c) => (c === "x" || c === "X" ? "X" : Number(c)));
    length = Math.max(length, bits.length);
  }
  return { length, signals, defaults };
}

function run(source: string, trace: SvaTrace): SvaEvaluation {
  const result = evaluateProperty(source, trace);
  if (!result.ok) throw new Error(`parse error: ${result.error.message}`);
  return result.evaluation;
}

const statuses = (e: SvaEvaluation) => e.attempts.map((a) => a.status);
const at = (e: SvaEvaluation, k: number) => e.attempts[k];

describe("sva-model: a sequence used as a property (§16.12.2, §16.14.8 a)", () => {
  const trace = tr({ req: "01000000", ack: "00010000" });

  it("bare `req ##2 ack` FAILS on every idle edge instead of passing vacuously", () => {
    const e = run("req ##2 ack", trace);
    expect(at(e, 0).status).toBe("FAIL");
    expect(at(e, 0).end).toBe(0);
    expect(at(e, 0).reason).toMatch(/`req` is false at edge 0/);
    expect(at(e, 2).status).toBe("FAIL");
    expect(e.counts.VACUOUS).toBe(0);
  });

  it("the attempt that sees req passes when its last element matches", () => {
    const e = run("req ##2 ack", trace);
    expect(at(e, 1).status).toBe("PASS");
    expect(at(e, 1).end).toBe(3);
    expect(at(e, 1).steps.map((s) => [s.edge, s.element, s.kind])).toEqual([
      [1, "req", "match"],
      [3, "##2 ack", "match"], // the element is labelled with the delay that reached it
    ]);
  });

  it("adding an antecedent turns idle edges into vacuous successes", () => {
    const e = run("req |-> ##2 ack", trace);
    expect(at(e, 0).status).toBe("VACUOUS");
    expect(at(e, 1).status).toBe("PASS");
    expect(e.counts.FAIL).toBe(0);
  });

  it("an unfinished attempt is PENDING, not FAIL, when the trace ends (weak sequence, §16.12.2)", () => {
    const e = run("req ##2 ack", tr({ req: "00001", ack: "00000" }));
    expect(at(e, 4).status).toBe("PENDING");
    expect(at(e, 4).end).toBe(4);
  });
});

describe("sva-model: implication timing (§16.12.7)", () => {
  // req sampled high at edge 2; ack sampled high at edge 3 only.
  const trace = tr({ req: "001000", ack: "000100" });

  it("`|->` checks the consequent on the antecedent's end edge", () => {
    const e = run("req |-> ack", trace);
    expect(at(e, 2).status).toBe("FAIL");
    expect(at(e, 2).end).toBe(2);
  });

  it("`|=>` checks the consequent one edge later", () => {
    const e = run("req |=> ack", trace);
    expect(at(e, 2).status).toBe("PASS");
    expect(at(e, 2).end).toBe(3);
    expect(at(e, 2).steps.some((s) => s.kind === "note" && /next edge 3/.test(s.detail))).toBe(true);
  });

  it("`a |=> b` is equivalent to `a |-> ##1 b`", () => {
    const traceB = tr({ req: "0110100", ack: "0011010" });
    expect(statuses(run("req |=> ack", traceB))).toEqual(statuses(run("req |-> ##1 ack", traceB)));
  });

  it("every match of a ranged antecedent must be followed by the consequent", () => {
    // For the attempt at edge 0, `a ##[1:2] b` matches at edges 1 and 2; c is checked after each.
    const t2 = tr({ a: "1000", b: "0110", c: "0010" });
    const e = run("a ##[1:2] b |-> c", t2);
    expect(at(e, 0).status).toBe("FAIL");
    expect(at(e, 0).end).toBe(1); // the match ending at edge 1 has c=0, even though the one at edge 2 has c=1
  });
});

describe("sva-model: vacuity (§16.14.8)", () => {
  it("an implication whose antecedent never matches is a vacuous success, not a real pass", () => {
    const e = run("req |=> ack", tr({ req: "0000", ack: "0000" }));
    expect(e.counts.VACUOUS).toBe(4);
    expect(e.counts.PASS).toBe(0);
    expect(at(e, 1).reason).toMatch(/vacuous success/);
  });

  it("the dead-antecedent debug case reports zero failures and zero real passes", () => {
    const debug = svaDebugCases.find((c) => c.id === "dead-antecedent")!;
    const buggy = run(debug.property, scenarioTrace(debug));
    expect(buggy.counts).toMatchObject({ FAIL: 0, PASS: 0, VACUOUS: 12 });
    const fixed = run(debug.fixedProperty, scenarioTrace(debug));
    expect(at(fixed, 3).status).toBe("PASS");
    expect(at(fixed, 7).status).toBe("FAIL");
    expect(at(fixed, 7).end).toBe(8);
  });

  it("`not` of a vacuously true property is false (§16.12.3)", () => {
    const e = run("not (req |-> ack)", tr({ req: "0", ack: "0" }));
    expect(at(e, 0).status).toBe("FAIL");
  });
});

describe("sva-model: sampled values and sampled-value functions (§16.5.1, §16.9.3)", () => {
  it("$rose sees a change one edge after it is drawn: values[k] is the value sampled at edge k", () => {
    // req goes high just after edge 1, so it is sampled 0 at edge 1 and 1 at edge 2.
    const e = run("$rose(req) |-> ack", tr({ req: "0011", ack: "0010" }));
    expect(at(e, 1).status).toBe("VACUOUS");
    expect(at(e, 2).status).toBe("PASS");
    expect(at(e, 3).status).toBe("VACUOUS"); // still high: no rise
    expect(at(e, 2).steps[0].detail).toMatch(/req was 0 at edge 1, 1 at edge 2/);
  });

  it("$rose at the first edge compares with the default sampled value: X for logic, so 1 counts as a rise", () => {
    const e = run("$rose(req)", tr({ req: "1" }));
    expect(at(e, 0).status).toBe("PASS");
    expect(at(e, 0).steps[0].detail).toMatch(/before edge 0 \(default\)/);
  });

  it("$rose at the first edge is false when the default is 1 (e.g. a bit declared with initializer 1)", () => {
    const e = run("$rose(req)", tr({ req: "1" }, { req: 1 }));
    expect(at(e, 0).status).toBe("FAIL");
  });

  it("$fell at the first edge is true for a logic signal that starts at 0 (X → 0 is a fall), false for a bit (0 → 0)", () => {
    expect(at(run("$fell(rst_n)", tr({ rst_n: "0" })), 0).status).toBe("PASS");
    expect(at(run("$fell(rst_n)", tr({ rst_n: "0" }, { rst_n: 0 })), 0).status).toBe("FAIL");
  });

  it("$fell, $stable and $changed compare consecutive sampled values", () => {
    const trace = tr({ a: "1100" });
    expect(statuses(run("$fell(a)", trace))).toEqual(["FAIL", "FAIL", "PASS", "FAIL"]);
    expect(statuses(run("$stable(a)", trace))).toEqual(["FAIL", "PASS", "FAIL", "PASS"]); // X → 1 is a change
    expect(statuses(run("$changed(a)", trace))).toEqual(["PASS", "FAIL", "PASS", "FAIL"]);
  });

  it("$past returns the default sampled value (X) before the first tick, which compares as unknown/false", () => {
    const e = run("q == $past(d)", tr({ q: "0011", d: "0110" }));
    expect(at(e, 0).status).toBe("FAIL");
    expect(at(e, 0).reason).toMatch(/X \(unknown counts as false, §16\.6\)/);
    expect(statuses(e).slice(1)).toEqual(["PASS", "PASS", "PASS"]);
  });

  it("$past(expr, N) looks N ticks back", () => {
    const e = run("q == $past(d, 2)", tr({ d: "1010", q: "0011" }));
    expect(at(e, 2).status).toBe("PASS");
    expect(at(e, 3).status).toBe("FAIL");
  });

  it("$past across reset: the first edge after reset compares against data sampled during reset", () => {
    const debug = svaDebugCases.find((c) => c.id === "past-reset")!;
    const buggy = run(debug.property, scenarioTrace(debug));
    expect(statuses(buggy).slice(0, 4)).toEqual(["DISABLED", "DISABLED", "DISABLED", "FAIL"]);
    expect(buggy.counts.FAIL).toBe(1);
    const fixed = run(debug.fixedProperty, scenarioTrace(debug));
    expect(at(fixed, 3).status).toBe("VACUOUS");
    expect(fixed.counts.FAIL).toBe(0);
  });
});

describe("sva-model: repetition (§16.9.2, F.3.4.2)", () => {
  const trace = tr({ start: "0100000000", ack: "0010100000", done: "0000001000" });

  it("[*N] needs N consecutive matches", () => {
    const e = run("start |=> ack[*2] ##1 done", trace);
    expect(at(e, 1).status).toBe("FAIL");
    expect(at(e, 1).end).toBe(3);
  });

  it("goto [->N] matches on the Nth occurrence, so the next element must follow immediately", () => {
    const e = run("start |=> ack[->2] ##1 done", trace);
    expect(at(e, 1).status).toBe("FAIL");
    expect(at(e, 1).end).toBe(5);
    expect(at(e, 1).steps.filter((s) => s.element === "ack[->2]" && s.kind === "match").map((s) => s.edge)).toEqual([2, 4]);
  });

  it("[->1] waits any number of edges and passes on the first occurrence", () => {
    const e = run("req |=> gnt[->1]", tr({ req: "1000000", gnt: "0000010" }));
    expect(at(e, 0).status).toBe("PASS");
    expect(at(e, 0).end).toBe(5);
    expect(at(e, 0).steps.find((s) => s.kind === "wait")).toMatchObject({ edge: 1, toEdge: 4 });
  });

  it("[->N] still waiting when the trace ends is PENDING", () => {
    const e = run("req |=> gnt[->2]", tr({ req: "100000", gnt: "001000" }));
    expect(at(e, 0).status).toBe("PENDING");
  });

  it("nonconsecutive [=N] allows quiet edges after the Nth occurrence", () => {
    const e = run("start |=> ack[=2] ##1 done", trace);
    expect(at(e, 1).status).toBe("PASS");
    expect(at(e, 1).end).toBe(6);
  });

  it("[*m:n] accepts any count in the range", () => {
    const e = run("a |-> b[*1:3] ##1 c", tr({ a: "10000", b: "11100", c: "00010" }));
    expect(at(e, 0).status).toBe("PASS");
    expect(at(e, 0).end).toBe(3);
  });
});

describe("sva-model: delays and windows (§16.7)", () => {
  it("##[m:n] passes on the first edge in the window and fails when the window closes", () => {
    const scenario = svaLearnScenarios.find((s) => s.id === "window")!;
    const e = run(scenario.property, scenarioTrace(scenario));
    expect(at(e, 1)).toMatchObject({ status: "PASS", end: 3 });
    expect(at(e, 5)).toMatchObject({ status: "FAIL", end: 8 });
    expect(at(e, 5).reason).toMatch(/not true at any edge from 6 to 8/);
    expect(at(e, 10).status).toBe("PENDING");
  });

  it("##[1:$] is bounded by the trace end: no match yet means PENDING, not FAIL", () => {
    const e = run("req |-> ##[1:$] ack", tr({ req: "1000", ack: "0000" }));
    expect(at(e, 0).status).toBe("PENDING");
  });

  it("##0 overlaps the end of the left operand with the start of the right one", () => {
    const e = run("a ##0 b", tr({ a: "11", b: "01" }));
    expect(statuses(e)).toEqual(["FAIL", "PASS"]);
  });
});

describe("sva-model: throughout / within / intersect / and / or (§16.9.5–§16.9.10)", () => {
  it("throughout fails at the first edge the condition drops while the sequence is in progress", () => {
    const scenario = svaLearnScenarios.find((s) => s.id === "goto-throughout")!;
    const e = run(scenario.property, scenarioTrace(scenario));
    expect(at(e, 1)).toMatchObject({ status: "PASS", end: 4 });
    expect(at(e, 6)).toMatchObject({ status: "FAIL", end: 9 });
    expect(at(e, 6).reason).toMatch(/`busy` is false at edge 9/);
    expect(at(e, 10).status).toBe("PENDING");
  });

  it("throughout also requires the condition on the edge where the sequence ends", () => {
    const family = temporalFamilies.find((f) => f.id === "conditions")!;
    const trace = scenarioTrace(family);
    expect(at(run("req |=> done[->1]", trace), 1)).toMatchObject({ status: "PASS", end: 6 });
    expect(at(run("req |=> busy throughout done[->1]", trace), 1)).toMatchObject({ status: "FAIL", end: 6 });
    expect(at(run("req |=> done[->1] within busy[*4]", trace), 1)).toMatchObject({ status: "FAIL", end: 5 });
  });

  it("within passes when the inner sequence occurs inside the outer one", () => {
    const e = run("req |=> done[->1] within busy[*4]", tr({ req: "1000000", busy: "0111100", done: "0010000" }));
    expect(at(e, 0)).toMatchObject({ status: "PASS", end: 4 });
  });

  it("intersect requires both operands to end on the same edge", () => {
    const trace = tr({ a: "1111", b: "0010" });
    expect(at(run("a[*3] intersect (1 ##2 b)", trace), 0).status).toBe("PASS");
    expect(at(run("a[*2] intersect (1 ##2 b)", trace), 0).status).toBe("FAIL");
  });

  it("sequence `and` ends when the later operand ends; `or` when either matches", () => {
    const trace = tr({ a: "100", b: "001" });
    expect(at(run("a and (1 ##2 b)", trace), 0)).toMatchObject({ status: "PASS", end: 2 });
    expect(at(run("(a ##1 b) or (a ##2 b)", trace), 0)).toMatchObject({ status: "PASS", end: 2 });
  });
});

describe("sva-model: disable iff (§16.12)", () => {
  const scenario = svaLearnScenarios.find((s) => s.id === "disable")!;
  const trace = scenarioTrace(scenario);

  it("an attempt in flight when the disable condition becomes true is DISABLED, not failed", () => {
    const withReset = run(scenario.property, trace);
    expect(at(withReset, 4)).toMatchObject({ status: "DISABLED", end: 5 });
    const withoutReset = run("req |-> ##[1:3] ack", trace);
    expect(at(withoutReset, 4)).toMatchObject({ status: "FAIL", end: 7 });
  });

  it("attempts that start while the condition is true are disabled, even if they would be vacuous", () => {
    const e = run(scenario.property, trace);
    expect(at(e, 5).status).toBe("DISABLED");
    expect(at(e, 6).status).toBe("DISABLED");
    expect(at(e, 7).status).toBe("VACUOUS");
  });

  it("attempts that finish before reset are unaffected", () => {
    const e = run(scenario.property, trace);
    expect(at(e, 1)).toMatchObject({ status: "PASS", end: 2 });
    expect(at(e, 8)).toMatchObject({ status: "PASS", end: 10 });
  });
});

describe("sva-model: parse errors are reported, never treated as false", () => {
  const signals = ["req", "ack", "rst"];
  const error = (src: string) => {
    const r = parseSva(src, signals);
    if (r.ok) throw new Error(`expected an error for ${src}`);
    return r.error;
  };

  it("unknown signal names", () => {
    expect(error("req && foo |-> ack").message).toMatch(/Unknown signal `foo`/);
  });

  it("invalid implication operators such as `|-->`", () => {
    const e = error("req |--> ack");
    expect(e.message).toMatch(/`\|-->` is not an SVA operator/);
    expect(e.position).toBe(4);
  });

  it("`&&` between sequences (use `and`)", () => {
    expect(error("(req ##1 ack) && req").message).toMatch(/use `and`/);
  });

  it("goto repetition on a sequence", () => {
    expect(error("(req ##1 ack)[->1]").message).toMatch(/applies only to a Boolean/);
  });

  it("sampled-value functions in a disable condition (§16.12)", () => {
    expect(error("disable iff ($past(rst)) req |-> ack").message).toMatch(/explicit clocking event/);
  });

  it("a property used as an antecedent", () => {
    expect(error("(req |-> ack) |-> req").message).toMatch(/antecedent/);
  });

  it("a sequence property that can match empty (§16.12.2)", () => {
    expect(error("req[*0:2]").message).toMatch(/empty match/);
  });

  it("unsupported operators get a specific message", () => {
    expect(error("req until ack").message).toMatch(/not supported/);
    expect(error("req |-> ##[3:1] ack").message).toMatch(/empty/);
  });

  it("valid properties parse, with an optional clock and disable condition", () => {
    const r = parseSva("@(posedge clk) disable iff (rst) req |=> ack;", signals);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.clock).toMatchObject({ edge: "posedge", signal: "clk" });
      expect(r.spec.shape).toBe("implication");
      expect(r.spec.overlapping).toBe(false);
      expect(assertionCode(r.spec)[1]).toBe("  @(posedge clk) disable iff (rst)");
    }
  });
});

describe("sva-model: scenario data the visuals rely on", () => {
  it("learn scenarios produce the outcomes their focus text promises", () => {
    const expectations: Record<string, Partial<Record<number, AttemptStatus>>> = {
      "fixed-delay": { 1: "PASS", 6: "FAIL", 10: "PENDING", 0: "VACUOUS" },
      "next-cycle": { 2: "FAIL", 6: "PASS", 11: "PENDING" },
      "rose-repeat": { 0: "PASS", 4: "FAIL", 5: "VACUOUS", 9: "PASS" },
    };
    for (const scenario of svaLearnScenarios) {
      const e = run(scenario.property, scenarioTrace(scenario));
      expect(e.attempts).toHaveLength(12);
      for (const [edge, status] of Object.entries(expectations[scenario.id] ?? {})) {
        expect(at(e, Number(edge)).status, `${scenario.id} A${edge}`).toBe(status);
      }
    }
  });

  it("each debug case's buggy property misbehaves and its fix does not fail on the same trace", () => {
    for (const c of svaDebugCases) {
      const trace = scenarioTrace(c);
      const buggy = run(c.property, trace);
      const fixed = run(c.fixedProperty, trace);
      expect(c.options.filter((o) => o.correct)).toHaveLength(1);
      if (c.id === "dead-antecedent") {
        expect(buggy.counts.PASS + buggy.counts.FAIL, c.id).toBe(0);
        expect(fixed.counts.FAIL, c.id).toBeGreaterThan(0); // the real DUT bug becomes visible
      } else {
        expect(buggy.counts.FAIL, c.id).toBeGreaterThan(0);
        expect(fixed.counts.FAIL, c.id).toBe(0);
      }
    }
  });

  it("temporal families give the focus attempt different outcomes for different operators", () => {
    for (const family of temporalFamilies) {
      const trace = scenarioTrace(family);
      const k = focusEdge(family, trace);
      const outcomes = family.operators.map((op) => {
        const a = at(run(op.property, trace), k);
        return `${a.status}@${a.end}`;
      });
      expect(new Set(outcomes).size, family.id).toBeGreaterThan(1);
    }
  });
});

describe("sva-model: prediction diagnostics", () => {
  it("predicting VACUOUS for a failing bare sequence names the missing antecedent", () => {
    const parsed = parseSva("req ##2 ack", ["req", "ack"]);
    if (!parsed.ok) throw new Error("parse");
    const e = evaluateSva(parsed.spec, tr({ req: "0000", ack: "0000" }));
    const d = diagnoseAttempt(parsed.spec, at(e, 0), "VACUOUS");
    expect(d.correct).toBe(false);
    expect(d.message).toMatch(/no antecedent/);
  });

  it("predicting PASS for a vacuous attempt explains that nothing was checked", () => {
    const parsed = parseSva("req |-> ack", ["req", "ack"]);
    if (!parsed.ok) throw new Error("parse");
    const e = evaluateSva(parsed.spec, tr({ req: "0", ack: "0" }));
    expect(diagnoseAttempt(parsed.spec, at(e, 0), "PASS").message).toMatch(/only a vacuous success/);
    expect(diagnoseAttempt(parsed.spec, at(e, 0), "VACUOUS").correct).toBe(true);
  });
});

describe("sva-model: text helpers", () => {
  it("splits inline code spans and strips backticks", async () => {
    const { splitInlineCode, plainText } = await import("@/lib/sva-model");
    expect(splitInlineCode("`ack` is false")).toEqual([
      { code: true, text: "ack" },
      { code: false, text: " is false" },
    ]);
    expect(plainText("`req ##2 ack` matched")).toBe("req ##2 ack matched");
  });
});

describe("sva-model: status wording (§16.14.8)", () => {
  it("§16.14.8: a vacuous evaluation is named a vacuous success, never a pass", async () => {
    const { statusText } = await import("@/lib/sva-model");
    expect(statusText.VACUOUS).toBe("vacuous success");
    expect(statusText.VACUOUS).not.toMatch(/pass/);
  });
});

describe("sva-model: lesson presets, modes and renaming", () => {
  it("§16.12.7, §16.14.8: req-gnt-2 gives the F1C outcomes (A1 passes at 3, A4 fails at 6, six vacuous successes)", async () => {
    const { reqGnt2Scenario } = await import("@/lib/sva-model");
    const e = run(reqGnt2Scenario.property, scenarioTrace(reqGnt2Scenario));
    expect(e.attempts).toHaveLength(8);
    expect(at(e, 1)).toMatchObject({ status: "PASS", end: 3 });
    expect(at(e, 4)).toMatchObject({ status: "FAIL", end: 6 });
    expect(statuses(e).filter((s) => s === "VACUOUS")).toHaveLength(6);
    expect(e.counts.PENDING).toBe(0);
  });

  it("§16.7: the early-grant challenge is met only when a failing attempt has gnt = 1 one edge before its check edge", async () => {
    const { reqGnt2Scenario, gradeEarlyGrantChallenge } = await import("@/lib/sva-model");
    const challenge = reqGnt2Scenario.challenge!;
    const base = scenarioTrace(reqGnt2Scenario);
    const start = gradeEarlyGrantChallenge(run(reqGnt2Scenario.property, base), base, challenge);
    expect(start.met).toBe(false);
    expect(start.message).toBe("Attempt A4 fails at edge 6, but gnt is 0 at edge 5. Set gnt to 1 at edge 5 and leave it 0 at edge 6.");

    const early = tr({ req: "01001000", gnt: "00010100" });
    const met = gradeEarlyGrantChallenge(run(reqGnt2Scenario.property, early), early, challenge);
    expect(met).toMatchObject({ met: true, attempt: 4 });
    expect(met.message).toMatch(/gnt is 1 at edge 5: one edge early/);

    const none = tr({ req: "00000000", gnt: "00000000" });
    expect(gradeEarlyGrantChallenge(run(reqGnt2Scenario.property, none), none, challenge).message).toMatch(/^No attempt fails yet/);
  });

  it("normalizeModes keeps known modes in order and falls back to all three", async () => {
    const { normalizeModes } = await import("@/lib/sva-model");
    expect(normalizeModes(["write", "learn"])).toEqual(["learn", "write"]);
    expect(normalizeModes(["learn"])).toEqual(["learn"]);
    expect(normalizeModes([])).toEqual(["learn", "debug", "write"]);
    expect(normalizeModes(["bogus"])).toEqual(["learn", "debug", "write"]);
    expect(normalizeModes(undefined)).toEqual(["learn", "debug", "write"]);
  });

  it("renameScenario renames whole identifiers in the property, rows and sentences, and rejects bad targets", async () => {
    const { renameScenario } = await import("@/lib/sva-model");
    const fixed = svaLearnScenarios.find((s) => s.id === "fixed-delay")!;
    const { scenario, ignored } = renameScenario(fixed, { ack: "gnt" });
    expect(ignored).toEqual([]);
    expect(scenario.id).toBe("fixed-delay");
    expect(scenario.property).toBe("req |-> ##2 gnt");
    expect(scenario.signals).toEqual(["req", "gnt"]);
    expect(scenario.rows.gnt).toEqual(fixed.rows.ack);
    expect(scenario.focus).not.toMatch(/\back\b/);
    // Same outcomes after renaming.
    expect(statuses(run(scenario.property, scenarioTrace(scenario)))).toEqual(statuses(run(fixed.property, scenarioTrace(fixed))));

    expect(renameScenario(fixed, { ack: "req" }).ignored).toEqual(["ack -> req"]);
    expect(renameScenario(fixed, { ack: "and" }).ignored).toEqual(["ack -> and"]);
    expect(renameScenario(fixed, { ack: "9x" }).ignored).toEqual(["ack -> 9x"]);
    expect(renameScenario(fixed, { nothere: "zz" }).scenario).toBe(fixed);

    const rose = svaLearnScenarios.find((s) => s.id === "rose-repeat")!;
    expect(renameScenario(rose, { req: "start" }).scenario.property).toBe("$rose(start) |=> ack[*2]");
  });

  it("findTracePreset knows every trace-lab preset id, and the sampling id is separate", async () => {
    const { findTracePreset, svaPresetIds, SAMPLING_PRESET_ID } = await import("@/lib/sva-model");
    for (const id of svaPresetIds.filter((i) => i !== SAMPLING_PRESET_ID)) expect(findTracePreset(id)?.id).toBe(id);
    expect(findTracePreset(SAMPLING_PRESET_ID)).toBeUndefined();
    expect(findTracePreset("nope")).toBeUndefined();
  });
});

describe("sva-model: sampling lab (§16.5.1, §4.4.2.5, §4.4.2.6, §16.9.3, §16.12, §16.14.1)", () => {
  const load = () => import("@/lib/sva-model");

  it("§16.5.1: the property reads the Preponed sample, so the edge where the flop copies d = 1 still passes and the first failure is one edge later", async () => {
    const { evaluateSamplingLab, flopOutputLowPreset } = await load();
    const r = evaluateSamplingLab(flopOutputLowPreset);
    expect(r.qRow).toEqual([0, 0, 0, 1, 1, 0]);
    expect(r.edges.map((e) => e.verdict)).toEqual(["PASS", "PASS", "PASS", "FAIL", "FAIL", "PASS"]);
    expect(r.edges[2]).toMatchObject({ sampledQ: 0, currentQ: 1 });
  });

  it("§4.4.2.6, §16.9.3: the pass statement runs in Reactive with current values, so q and $sampled(q) disagree at the copy edge", async () => {
    const { evaluateSamplingLab, flopOutputLowPreset } = await load();
    const r = evaluateSamplingLab(flopOutputLowPreset);
    expect(r.edges[2].printed).toBe("pass: $sampled(q)=0 q=1");
    expect(r.edges[2].disagree).toBe(true);
    expect(r.edges[0].printed).toBe("pass: $sampled(q)=0 q=0");
    expect(r.edges.filter((e) => e.disagree).map((e) => e.edge)).toEqual([2]);
  });

  it("§16.14.1: a failing attempt with no else clause calls $error, and its pass message does not print", async () => {
    const { evaluateSamplingLab, flopOutputLowPreset } = await load();
    const e = evaluateSamplingLab(flopOutputLowPreset).edges[3];
    expect(e.printed).toBeNull();
    expect(e.reactive).toMatch(/\$error \(§16\.14\.1\)/);
  });

  it("§16.12: disable iff reads rst's current value, so the edge where rst rises (sample 0) is disabled and runs no action block", async () => {
    const { evaluateSamplingLab, flopOutputLowPreset } = await load();
    const r = evaluateSamplingLab({ ...flopOutputLowPreset, disableOnRst: true });
    expect(r.edges.map((e) => e.verdict)).toEqual(["PASS", "PASS", "PASS", "DISABLED", "DISABLED", "DISABLED"]);
    expect(r.edges[3]).toMatchObject({ sampledRst: 0, currentRst: 1, printed: null });
    expect(r.edges[3].reason).toMatch(/Its sample is 0, but `disable iff` reads the current value, 1/);
    expect(r.code[4]).toBe("  @(posedge clk) disable iff (rst) q == 1'b0)");
  });

  it("§16.12: when rst falls at an edge its sample is 1 but its current value is 0, so that attempt is not disabled", async () => {
    const { evaluateSamplingLab } = await load();
    const r = evaluateSamplingLab({ d: [1, 1, 1, 1, 1, 1], rst: [0, 0, 1, 0, 0, 0], qInit: 0, disableOnRst: true });
    // rst rises at edge 1 (current 1) and falls at edge 2 (current 0).
    expect(r.edges[1].verdict).toBe("DISABLED");
    expect(r.edges[2]).toMatchObject({ sampledRst: 1, currentRst: 0 });
    expect(r.edges[2].verdict).toBe("FAIL"); // q sampled at 2 = d at edge 1 = 1: the flop read rst = 0 at edge 1
  });

  it("§16.6, §16.9.3: an x sample makes q == 1'b0 x, which is false, and $sampled(q) prints x", async () => {
    const { evaluateSamplingLab, gradeSamplingPrediction } = await load();
    const r = evaluateSamplingLab({ d: [0, 0, 0, 0, 0, 0], rst: [0, 0, 0, 0, 0, 0], qInit: "x", disableOnRst: false });
    expect(r.edges[0]).toMatchObject({ sampledQ: "x", expression: "x", verdict: "FAIL" });
    expect(r.edges[0].reason).toMatch(/counts as false \(§16\.6\)/);
    expect(r.edges[1]).toMatchObject({ sampledQ: 0, verdict: "PASS", printed: "pass: $sampled(q)=0 q=0" });
    expect(gradeSamplingPrediction(r.edges[0], { verdict: "PASS", sampled: "x", current: 0 }).verdictCorrect).toBe(false);
  });

  it("the last edge's current rst is its sample (rst holds after the trace), and edges stay in step with the rows", async () => {
    const { evaluateSamplingLab } = await load();
    const r = evaluateSamplingLab({ d: [0, 0, 0], rst: [0, 0, 1], qInit: 0, disableOnRst: true });
    expect(r.edges).toHaveLength(3);
    expect(r.edges[2]).toMatchObject({ sampledRst: 1, currentRst: 1, verdict: "DISABLED" });
    expect(r.edges[1]).toMatchObject({ sampledRst: 0, currentRst: 1, verdict: "DISABLED" });
  });

  it("grading explains the one-edge lag, the Reactive print and the disable condition", async () => {
    const { evaluateSamplingLab, flopOutputLowPreset, gradeSamplingPrediction } = await load();
    const r = evaluateSamplingLab(flopOutputLowPreset);
    const lagWrong = gradeSamplingPrediction(r.edges[2], { verdict: "FAIL" });
    expect(lagWrong).toMatchObject({ correct: false, verdictCorrect: false, printCorrect: null });
    expect(lagWrong.message).toMatch(/reads the Preponed sample q = 0 \(§16\.5\.1\), so it passes/);

    const printWrong = gradeSamplingPrediction(r.edges[2], { verdict: "PASS", sampled: 0, current: 0 });
    expect(printWrong).toMatchObject({ correct: false, verdictCorrect: true, printCorrect: false });
    expect(printWrong.message).toMatch(/q prints 1, the value the flop wrote in NBA\. \$sampled\(q\) returns the value the property used, 0 \(§16\.9\.3\)/);

    const right = gradeSamplingPrediction(r.edges[2], { verdict: "PASS", sampled: 0, current: 1 });
    expect(right).toMatchObject({ correct: true, printCorrect: true });
    expect(right.message).toBe('Correct: it prints "pass: $sampled(q)=0 q=1". The two values disagree because the action block runs after the flop\'s write.');

    const d = evaluateSamplingLab({ ...flopOutputLowPreset, disableOnRst: true });
    expect(gradeSamplingPrediction(d.edges[3], { verdict: "FAIL" }).message).toMatch(/disable iff` reads the current value, 1, in Observed \(§16\.12\)/);
    expect(gradeSamplingPrediction(d.edges[2], { verdict: "DISABLED" }).message).toBe("rst is 0 in Observed, so the attempt is not disabled.");
  });

  it("region markers and the summary are generated from the result", async () => {
    const { evaluateSamplingLab, flopOutputLowPreset, regionMarkers, summarizeSampling } = await load();
    const r = evaluateSamplingLab(flopOutputLowPreset);
    expect(regionMarkers(r.edges[2], false)).toEqual({
      preponed: "▼ Preponed: q sampled = 0",
      observed: "✓ Observed: q == 1'b0 is 1 (true) on the sample: pass",
      reactive: 'Reactive: the pass statement prints "pass: $sampled(q)=0 q=1" (§4.4.2.6)',
    });
    expect(summarizeSampling(r)).toBe("4 passes · 2 fails · 0 disabled; the pass message prints q different from $sampled(q) at edge 2");
  });
});

describe("sva-model: vacuity follows the recursive rules of §16.14.8", () => {
  it("§16.14.8 i and j: the reason names item i for |-> and item j for |=>, never item h (if-else)", () => {
    const viaOverlap = run("a |-> (b |-> c)", tr({ a: "1", b: "0", c: "0" }));
    expect(at(viaOverlap, 0)).toMatchObject({ status: "VACUOUS", vacuity: "consequent" });
    expect(at(viaOverlap, 0).reason).toMatch(/§16\.14\.8 i\)/);
    const viaNext = run("a |=> (b |-> c)", tr({ a: "10", b: "00", c: "00" }));
    expect(at(viaNext, 0)).toMatchObject({ status: "VACUOUS", vacuity: "consequent" });
    expect(at(viaNext, 0).reason).toMatch(/§16\.14\.8 j\)/);
    expect(at(run("a |-> b", tr({ a: "0", b: "0" })), 0).reason).toMatch(/§16\.14\.8 i\)/);
    expect(at(run("a |=> b", tr({ a: "0", b: "0" })), 0)).toMatchObject({ status: "VACUOUS", vacuity: "antecedent" });
    expect(at(run("a |=> b", tr({ a: "0", b: "0" })), 0).reason).toMatch(/§16\.14\.8 j\)/);
    for (const e of [viaOverlap, viaNext]) expect(at(e, 0).reason).not.toMatch(/16\.14\.8 h/);
  });

  it("§16.14.8 d: `not not (a |-> b)` with a false is a vacuous success, not a pass", () => {
    const e = run("not not (a |-> b)", tr({ a: "0", b: "0" }));
    expect(at(e, 0)).toMatchObject({ status: "VACUOUS", vacuity: "not" });
    expect(e.counts.PASS).toBe(0);
    // With a true, the inner attempt is nonvacuous, so `not not` is a real pass or a real fail.
    expect(at(run("not not (a |-> b)", tr({ a: "1", b: "1" })), 0)).toMatchObject({ status: "PASS" });
    const realFail = at(run("not not (a |-> b)", tr({ a: "1", b: "0" })), 0);
    expect(realFail.status).toBe("FAIL");
    expect(realFail.vacuity).toBeUndefined();
  });

  it("§16.14.8 d: `not (a |-> b)` with a false is false but vacuous, and the reason records that reporting is up to the tool", () => {
    const a0 = at(run("not (a |-> b)", tr({ a: "0", b: "0" })), 0);
    expect(a0).toMatchObject({ status: "FAIL", vacuity: "not" });
    expect(a0.reason).toMatch(/§16\.12\.3/);
    expect(a0.reason).toMatch(/vacuous by §16\.14\.8 d\)/);
    expect(a0.reason).toMatch(/fail action runs \(§16\.14\.1\)/);
    expect(a0.reason).toMatch(/up to the tool/);
    // A nonvacuous `not`: the antecedent matched and the consequent held.
    expect(at(run("not (a |-> b)", tr({ a: "1", b: "1" })), 0).vacuity).toBeUndefined();
  });

  it("§16.14.8 e and f: `and` / `or` are vacuous only when both operands are", () => {
    const both = tr({ a: "0", b: "0", c: "0" });
    expect(at(run("(a |-> b) and (a |-> c)", both), 0)).toMatchObject({ status: "VACUOUS", vacuity: "and" });
    expect(at(run("(a |-> b) or (a |-> c)", both), 0)).toMatchObject({ status: "VACUOUS", vacuity: "or" });
    // One operand is vacuously true, the other is false but also vacuous: still vacuous (e), never a pass.
    expect(at(run("(not (a |-> b)) or (a |-> c)", both), 0)).toMatchObject({ status: "VACUOUS", vacuity: "or" });
    // `and` with a vacuous false operand and a vacuous true one is false and vacuous (f).
    expect(at(run("(not (a |-> b)) and (a |-> c)", both), 0)).toMatchObject({ status: "FAIL", vacuity: "and" });
    // One nonvacuous operand makes the whole attempt nonvacuous.
    const mixed = tr({ a: "0", b: "0", d: "1" });
    expect(at(run("(a |-> b) and d", mixed), 0)).toMatchObject({ status: "PASS" });
    expect(at(run("(a |-> b) and d", mixed), 0).vacuity).toBeUndefined();
  });
});

describe("sva-model: an operand's vacuity is never reported as the attempt's", () => {
  const t = tr({ a: "0", b: "1", c: "1", d: "0" });

  it("`(not (a |-> b)) and (c |-> b)`: a nonvacuous fail whose reason does not call the attempt vacuous (§16.14.8 f)", () => {
    const a0 = at(run("(not (a |-> b)) and (c |-> b)", t), 0);
    expect(a0.status).toBe("FAIL");
    expect(a0.vacuity).toBeUndefined();
    expect(a0.reason).not.toMatch(/attempt (as a whole )?is vacuous/i);
    expect(a0.reason).not.toMatch(/up to the tool/);
    expect(a0.reason).toMatch(/`\(not \(a \|-> b\)\)` is false \(§16\.12\.3\) and is itself evaluated vacuously \(§16\.14\.8 d\)/);
    expect(a0.reason).toMatch(/`\(c \|-> b\)` was evaluated nonvacuously, so .* is nonvacuous \(§16\.14\.8 f\)/);
  });

  it("`(not (a |-> b)) or (c |-> d)`: a nonvacuous fail whose reason does not call the attempt vacuous (§16.14.8 e)", () => {
    const a0 = at(run("(not (a |-> b)) or (c |-> d)", t), 0);
    expect(a0.status).toBe("FAIL");
    expect(a0.vacuity).toBeUndefined();
    expect(a0.reason).not.toMatch(/attempt (as a whole )?is vacuous/i);
    expect(a0.reason).toMatch(/`\(c \|-> d\)` was evaluated nonvacuously, so .* is nonvacuous \(§16\.14\.8 e\)/);
  });

  it("the attempt-level note names the top operator's item and appears once", () => {
    const both = tr({ a: "0", b: "0", c: "0" });
    const andV = at(run("(not (a |-> b)) and (a |-> c)", both), 0);
    expect(andV).toMatchObject({ status: "FAIL", vacuity: "and" });
    expect(andV.reason).toMatch(/attempt as a whole is vacuous by §16\.14\.8 f\)/);
    expect(andV.reason.match(/up to the tool/g)).toHaveLength(1);
    const notV = at(run("not (a |-> b)", both), 0);
    expect(notV.reason.match(/up to the tool/g)).toHaveLength(1);
    // Wrapped in a further `not`, the operand reason makes no fail-action claim.
    const outer = at(run("not ((not (a |-> b)) and (c |-> b))", t), 0);
    expect(outer.status).toBe("PASS");
    expect(outer.reason).not.toMatch(/fail action runs/);
  });

  it("diagnoseAttempt: predicting PASS for a false but vacuous attempt names §16.14.8 d)", () => {
    const parsed = parseSva("not (a |-> b)", ["a", "b"]);
    if (!parsed.ok) throw new Error(parsed.error.message);
    const trace = tr({ a: "0", b: "0" });
    const attempt = at(evaluateSva(parsed.spec, trace), 0);
    const d = diagnoseAttempt(parsed.spec, attempt, "PASS");
    expect(d.correct).toBe(false);
    expect(d.message).toMatch(/^It fails at edge 0\. The operand of `not` was evaluated vacuously, and `not` keeps that \(§16\.14\.8 d\)/);
    expect(d.message).toMatch(/not a pass or a vacuous success/);
    // A nonvacuous failure keeps the short message.
    const real = parseSva("a |-> b", ["a", "b"]);
    if (!real.ok) throw new Error(real.error.message);
    const ra = at(evaluateSva(real.spec, tr({ a: "1", b: "0" })), 0);
    expect(diagnoseAttempt(real.spec, ra, "PASS").message).not.toMatch(/vacuous/);
  });
});

describe("sva-model: diagnostics name the real cause of a vacuous attempt", () => {
  const diag = (source: string, trace: SvaTrace, predicted: AttemptStatus) => {
    const parsed = parseSva(source, Object.keys(trace.signals));
    if (!parsed.ok) throw new Error(parsed.error.message);
    const e = evaluateSva(parsed.spec, trace);
    return { attempt: at(e, 0), d: diagnoseAttempt(parsed.spec, at(e, 0), predicted) };
  };

  it("nested `c |-> (a |-> b)`: the antecedent matched, so the message does not say it did not", () => {
    const t = tr({ c: "1", a: "0", b: "0" });
    for (const predicted of ["PASS", "FAIL"] as const) {
      const { attempt, d } = diag("c |-> (a |-> b)", t, predicted);
      expect(attempt.status).toBe("VACUOUS");
      expect(d.correct).toBe(false);
      expect(d.message).toMatch(/The antecedent matched, but every consequent attempt it started was itself vacuous \(§16\.14\.8 i, j\)/);
      expect(d.message).not.toMatch(/antecedent did not match/);
    }
    expect(diag("c |-> (a |-> b)", t, "PASS").d.message).toMatch(/only a vacuous success/);
  });

  it("`(a |-> b) and (a |-> c)`: the message cites §16.14.8 f, not a missing antecedent", () => {
    const { d } = diag("(a |-> b) and (a |-> c)", tr({ a: "0", b: "0", c: "0" }), "FAIL");
    expect(d.message).toMatch(/Both operands of `and` were evaluated vacuously \(§16\.14\.8 f\)/);
    expect(d.message).not.toMatch(/antecedent did not match/);
    expect(diag("(a |-> b) or (a |-> c)", tr({ a: "0", b: "0", c: "0" }), "PASS").d.message).toMatch(/§16\.14\.8 e\)/);
    expect(diag("not not (a |-> b)", tr({ a: "0", b: "0" }), "PASS").d.message).toMatch(/§16\.14\.8 d\)/);
  });

  it("a plain implication with a false antecedent still says so", () => {
    const { d } = diag("a |-> b", tr({ a: "0", b: "0" }), "FAIL");
    expect(d.message).toMatch(/^The antecedent did not match, so the consequent was never checked \(§16\.14\.8 i, j\)/);
  });

  it("predicting VACUOUS for a vacuous but false `not` explains that a vacuous success needs a true result", () => {
    const { attempt, d } = diag("not (a |-> b)", tr({ a: "0", b: "0" }), "VACUOUS");
    expect(attempt.status).toBe("FAIL");
    expect(d.message).toMatch(/the attempt is vacuous, but the property is false/);
    expect(d.message).toMatch(/does not say how a tool reports a vacuous failure/);
  });

  it("attemptStatusPhrase is built from statusText", async () => {
    const { attemptStatusPhrase, statusText } = await import("@/lib/sva-model");
    expect(attemptStatusPhrase({ status: "VACUOUS", end: 3 })).toBe(statusText.VACUOUS);
    expect(attemptStatusPhrase({ status: "FAIL", end: 8 })).toBe("fail at edge 8");
    expect(attemptStatusPhrase({ status: "FAIL", end: 0, vacuity: "not" })).toBe("fail at edge 0 (vacuous evaluation)");
    expect(attemptStatusPhrase({ status: "PASS", end: 2 })).toBe("pass at edge 2");
  });
});

describe("sva-model: renaming checks reserved keywords and every preset (§5.6.2, Annex B)", () => {
  it("SV_RESERVED_KEYWORDS holds the 248 words of Table B.1", async () => {
    const { SV_RESERVED_KEYWORDS } = await import("@/lib/sva-model");
    expect(SV_RESERVED_KEYWORDS.size).toBe(248);
    for (const w of ["always", "if", "until", "first_match", "s_eventually", "property", "sequence", "assert", "logic", "wire", "int", "begin", "and", "xor"]) {
      expect(SV_RESERVED_KEYWORDS.has(w), w).toBe(true);
    }
    expect(SV_RESERVED_KEYWORDS.has("gnt")).toBe(false);
  });

  it("{req: 'always'} and {req: 'logic'} are ignored, so the preset keeps parsing as legal SystemVerilog", async () => {
    const { renameScenario } = await import("@/lib/sva-model");
    const fixed = svaLearnScenarios.find((s) => s.id === "fixed-delay")!;
    for (const kw of ["always", "logic", "if", "until", "first_match", "s_eventually", "property", "sequence", "assert", "wire", "int", "begin"]) {
      const r = renameScenario(fixed, { req: kw });
      expect(r.ignored, kw).toEqual([`req -> ${kw}`]);
      expect(r.scenario).toBe(fixed);
    }
  });

  it("one map is checked against every preset: {req: 'busy'} clashes in goto-throughout, so it is ignored everywhere", async () => {
    const { renameTracePresets } = await import("@/lib/sva-model");
    const r = renameTracePresets({ req: "busy" });
    expect(r.ignored).toEqual(["req -> busy"]);
    expect(r.learn.find((s) => s.id === "fixed-delay")!.property).toBe("req |-> ##2 ack");
    expect(r.learn.find((s) => s.id === "goto-throughout")!.signals).toContain("req");

    const ok = renameTracePresets({ ack: "gnt" });
    expect(ok.ignored).toEqual([]);
    expect(ok.learn.find((s) => s.id === "fixed-delay")!.property).toBe("req |-> ##2 gnt");
    expect(ok.debug.every((c) => !c.signals.includes("ack"))).toBe(true);
    expect(ok.reqGnt2.property).toBe("req |-> ##2 gnt");

    expect(renameTracePresets({ ackk: "x" }).ignored).toEqual(["ackk -> x"]);
  });

  it("renaming rewrites the article before the name and the challenge prompt names the signal", async () => {
    const { renameTracePresets } = await import("@/lib/sva-model");
    const r = renameTracePresets({ ack: "gnt" });
    const labels = r.debug.flatMap((c) => c.options.map((o) => o.label)).join(" | ");
    expect(labels).toMatch(/so a gnt at exactly \+2/);
    expect(labels).not.toMatch(/\ban gnt\b/);

    const g = renameTracePresets({ gnt: "ack" });
    expect(g.reqGnt2.challenge!.prompt).toBe("Make the assertion fail while ack is 1 at some edge: set ack to 1 one edge early.");
    expect(g.reqGnt2.challenge!.prompt).not.toMatch(/grant/);
    expect(g.reqGnt2.challenge!.consequent).toBe("ack");
  });
});
