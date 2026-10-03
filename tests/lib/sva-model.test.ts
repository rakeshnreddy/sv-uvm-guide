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
