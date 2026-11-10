import { describe, expect, it } from "vitest";

import { listCycles } from "@/lib/axi-deadlock-model";
import {
  blockedCalls,
  buildTriageRound,
  circularWaitScenario,
  deadlockFeedback,
  deadlockStory,
  describeWaitCycle,
  firstCycleStep,
  HOLDER_EDGE_NOTE,
  isCleanRun,
  isRepaired,
  KATA_STARTER,
  kataEndState,
  kataFeedback,
  kataScenario,
  kataStory,
  nextOrderSeed,
  repairSummary,
  REPORT_LINE,
  runEvidence,
  shuffledSmells,
  SMELL_IDS,
  SMELLS,
  smellScenario,
  smellsIn,
  spinFixScenario,
  starvedConsumerScenario,
  triageFeedback,
  waitForGraph,
  waitingAlwaysAtEnd,
} from "@/lib/sv-ipc-smell-scenarios";
import { prepareScenario, simulateProcesses } from "@/lib/sv-process-model";

const source = (s: ReturnType<typeof circularWaitScenario>) => prepareScenario(s).source.map((l) => l.text).join("\n");
const lastStep = (r: ReturnType<typeof simulateProcesses>) => r.trace[r.trace.length - 1];

describe("the five shapes, each diagnosed from its run alone", () => {
  it.each(SMELL_IDS)("%s: the run shows exactly its own shape and no error line", (smell) => {
    const round = buildTriageRound(smell);
    expect(smellsIn(round.result)).toEqual([smell]);
    expect(round.evidence.errorsPrinted).toBe(0);
    expect(round.exploration.capped).toBe(false);
  });

  it.each(SMELL_IDS)("%s: every explored order shows its own shape or none, never a foreign one, and no error line", (smell) => {
    const round = buildTriageRound(smell);
    round.exploration.outcomes.forEach((g) => {
      expect([[smell], []]).toContainEqual(smellsIn(g.result));
      expect(g.result.log.filter((l) => l.severity === "error" || l.severity === "fatal")).toHaveLength(0);
    });
  });

  it.each(SMELL_IDS)("%s: the fix leaves no shape in any order of the ready processes", (smell) => {
    const round = buildTriageRound(smell);
    expect(isRepaired(round.fixedExploration)).toBe(true);
    expect(round.fixedExploration.capped).toBe(false);
    expect(round.fixedResult.outcome.kind).toBe("quiet");
  });

  it("every shape has three hints, none of which names the shape", () => {
    SMELL_IDS.forEach((id) => {
      expect(SMELLS[id].hints).toHaveLength(3);
      SMELLS[id].hints.forEach((h) => expect(h.toLowerCase()).not.toContain(SMELLS[id].name.toLowerCase()));
    });
  });

  it("no hint uses a significant word of any shape's name", () => {
    const words = ["deadlock", "spin", "leak", "starv", "circular", "missed"];
    SMELL_IDS.forEach((id) => SMELLS[id].hints.forEach((h) => words.forEach((w) => expect(h.toLowerCase(), `${id}: ${h}`).not.toContain(w))));
  });

  it("feedback states the shape's signature and the run's own evidence", () => {
    const round = buildTriageRound("starved-consumer");
    expect(triageFeedback("starved-consumer", round)).toBe(
      "Starved consumer is a process left blocked in a mailbox get(). This run shows: the run ended at t = 30 ns; consumer in mbx.get — empty.",
    );
    expect(triageFeedback("leaked-key", round)).toMatch(/^Leaked key would show processes blocked in get\(\) of one semaphore/);
  });

  it("feedback for the spin round says time stopped and nobody is blocked", () => {
    const round = buildTriageRound("spin-triggered");
    expect(triageFeedback("spin-triggered", round)).toBe(
      "Spinning on triggered is simulation time stopped advancing (a zero-delay loop). This run shows: time stopped advancing; no process is blocked.",
    );
    expect(triageFeedback("missed-trigger", round)).toBe(
      "Missed trigger would show a process left blocked in @(event). This run shows: time stopped advancing; no process is blocked.",
    );
  });

  it("feedback for the circular-wait round lists both blocked processes and their calls", () => {
    const round = buildTriageRound("circular-wait");
    const shows = "This run shows: the run ended at t = 5 ns; proc_a in s2.get(1) — 0 keys free; proc_b in s1.get(1) — 0 keys free.";
    expect(triageFeedback("circular-wait", round)).toBe(
      `Circular wait (deadlock) is two or more processes blocked in get() whose wait-for graph closes a cycle through different processes. ${shows}`,
    );
    expect(triageFeedback("leaked-key", round)).toBe(
      `Leaked key would show processes blocked in get() of one semaphore, with no cycle between two processes. ${shows}`,
    );
  });

  it("isRepaired requires an uncapped exploration whose every run ends quietly or by $finish with nobody stuck", () => {
    const bug = buildTriageRound("starved-consumer");
    expect(isRepaired(bug.exploration)).toBe(false);
    expect(isRepaired({ ...bug.fixedExploration, capped: true })).toBe(false);
    const spin = buildTriageRound("spin-triggered");
    expect(isCleanRun(spin.result)).toBe(false);
    expect(isCleanRun(spin.fixedResult)).toBe(true);
  });

  it("the repair line is true for the spin fix: only the always procedure still waits, and that is named as normal", () => {
    const round = buildTriageRound("spin-triggered");
    expect(waitingAlwaysAtEnd(round.fixedResult)).toEqual([{ label: "consumer", on: "@(done)" }]);
    expect(repairSummary(round)).toBe(
      "Repaired: in every one of the 2 orders of the ready processes the model ran, the run ends quietly with no process outside an always procedure left blocked and no zero-delay loop. consumer still waits in @(done) at the end: an always procedure waiting for its next trigger is normal (§9.2).",
    );
    expect(repairSummary(buildTriageRound("leaked-key"))).not.toContain("still waits");
    expect(repairSummary(buildTriageRound("starved-consumer"))).toMatch(/^Repaired: /);
  });
});

describe("missed trigger (IEEE 1800-2023 §15.5.1, §15.5.2, §4.7)", () => {
  it("§15.5.2: the trigger runs before the @, so consumer stays blocked and the run ends quietly at 10 ns (§9.6.1)", () => {
    const round = buildTriageRound("missed-trigger");
    expect(round.evidence.ending).toBe("quiet");
    expect(round.evidence.endTime).toBe(10);
    expect(round.evidence.blocked).toEqual([{ label: "consumer", call: "@(done)", kind: "event", object: "done" }]);
    expect(round.evidence.endingText).toContain("(§9.6.1)");
    expect(round.evidence.endingText).toContain("No error was printed.");
  });

  it("§4.7: only some orders of the ready processes miss it (2 of 4)", () => {
    const round = buildTriageRound("missed-trigger");
    expect(round.exploration.runCount).toBe(4);
    expect(round.ordersWithSmell).toBe(2);
  });

  it("§15.5.3 fix: wait (done.triggered) wakes in every order", () => {
    const round = buildTriageRound("missed-trigger");
    expect(round.fixedResult.log.map((l) => l.text)).toContain("consumer woke");
  });
});

describe("spinning on triggered (IEEE 1800-2023 §15.5.3)", () => {
  it("§15.5.3: triggered stays true for the time step, so the zero-delay loop stops time at 10 ns in every order", () => {
    const round = buildTriageRound("spin-triggered");
    expect(round.evidence.ending).toBe("time-stopped");
    expect(round.evidence.endTime).toBe(10);
    expect(round.evidence.blocked).toEqual([]);
    expect(round.ordersWithSmell).toBe(round.exploration.runCount);
    expect(round.evidence.endingText).toContain("tool-dependent");
  });

  it("§9.2: the fix's always procedure waiting at the end is normal and not reported as a shape", () => {
    const r = simulateProcesses(spinFixScenario());
    expect(r.blockedAtEnd.map((b) => b.label)).toEqual(["consumer"]);
    expect(blockedCalls(r)).toEqual([]);
    expect(r.log.map((l) => l.text)).toEqual(["producer triggered done", "consumer saw done, n = 1"]);
    expect(source(spinFixScenario())).toContain("always begin // consumer\n  @(done);");
  });
});

describe("leaked key (IEEE 1800-2023 §15.3.2, §15.3.3)", () => {
  it("§15.3.3: after send 2 returns without put(), driver and checker block in bus.get(1)", () => {
    const round = buildTriageRound("leaked-key");
    expect(round.result.log.map((l) => `${l.time} ${l.text}`)).toEqual(["10 send 1 done"]);
    expect(round.evidence.blocked.map((b) => `${b.label}:${b.kind}:${b.object}`)).toEqual(["driver:semaphore:bus", "checker:semaphore:bus"]);
    expect(round.result.finalSemaphores.bus.keys).toBe(0);
  });

  it("the wait-for graph's only cycle passes through one process: driver waits for the key it took itself", () => {
    const graph = waitForGraph(lastStep(buildTriageRound("leaked-key").result));
    expect(graph.multiProcessCycles).toEqual([]);
    expect(graph.cycles).toHaveLength(1);
    expect(describeWaitCycle(graph.cycles[0])).toBe("driver waits for bus, whose key it took itself.");
  });
});

describe("circular wait (IEEE 1800-2023 §15.3.3, §15.3)", () => {
  it("renders the lesson's code: proc_a takes s1 then s2, proc_b s2 then s1", () => {
    const text = source(circularWaitScenario());
    expect(text).toContain("semaphore s1 = new(1);\nsemaphore s2 = new(1);");
    expect(text).toContain("initial begin // proc_a\n  s1.get(1);\n  #5 s2.get(1);");
    expect(text).toContain("initial begin // proc_b\n  s2.get(1);\n  #5 s1.get(1);");
  });

  it("§15.3.3: the cycle closes at 5 ns and the run ends quietly at 5 ns in every order", () => {
    const story = deadlockStory({ order: "opposite", startDelay: 0 });
    expect(story.verdict).toBe("hang");
    expect(story.result.trace[story.cycleStep].time).toBe(5);
    expect(story.cycleText).toBe("proc_b waits for s1, held by proc_a; proc_a waits for s2, held by proc_b.");
    expect(story.exploration.outcomes).toHaveLength(1);
    expect(story.exploration.runCount).toBe(4);
    expect(story.explanation).toContain("all of them end this way");
  });

  it("cycle detection is listCycles from the AXI deadlock model, on {from, to, legality: 'legal'} edges", () => {
    const step = lastStep(simulateProcesses(circularWaitScenario()));
    const graph = waitForGraph(step);
    expect(graph.cycles).toEqual(listCycles(graph.edges.map((e) => ({ from: e.from, to: e.to, legality: "legal", explanation: e.label }))));
  });

  it("§15.3: every holder edge says it is bookkeeping, because a semaphore does not track owners", () => {
    const graph = waitForGraph(lastStep(simulateProcesses(circularWaitScenario())));
    const held = graph.edges.filter((e) => e.kind === "held");
    expect(held).toHaveLength(2);
    held.forEach((e) => expect(e.label).toContain(HOLDER_EDGE_NOTE));
    expect(HOLDER_EDGE_NOTE).toBe("model bookkeeping: a semaphore does not track owners");
  });

  it("opposite orders deadlock only when the critical sections overlap: a 10 ns start lets both finish", () => {
    const story = deadlockStory({ order: "opposite", startDelay: 10 });
    expect(story.verdict).toBe("finish");
    expect(firstCycleStep(story.result)).toBe(-1);
    expect(story.result.endTime).toBe(15);
    expect(story.explanation).toMatch(/^proc_a returns both keys at t = 5 ns, before proc_b asks for its first key at t = 10 ns/);
  });

  it("§15.3.3: in the same order proc_b queues FIFO behind proc_a at 0 ns, and both finish by 10 ns", () => {
    const story = deadlockStory({ order: "same", startDelay: 0 });
    expect(story.verdict).toBe("finish");
    const queued = story.result.trace.find((s) => s.semaphores.s1.waiters.some((w) => w.label === "proc_b"));
    expect(queued?.time).toBe(0);
    expect(story.result.blockedAtEnd).toEqual([]);
    expect(story.explanation).toContain("proc_b blocks in s1.get(1) at t = 0 ns while proc_a holds the key");
    expect(story.explanation).toContain("gets the key when it is returned at t = 5 ns");
  });

  it("prediction feedback: the right answer explains, the wrong ones cite the orders run", () => {
    const story = deadlockStory({ order: "opposite", startDelay: 0 });
    expect(deadlockFeedback("hang", story)).toBe(story.explanation);
    expect(deadlockFeedback("depends", story)).toBe("Every one of the 4 orders the model ran ends the same way, so the scheduler's choice does not matter here.");
    expect(deadlockFeedback("finish", story)).toContain("both processes end blocked");
  });
});

describe("starved consumer (IEEE 1800-2023 §15.4.5)", () => {
  it("§15.4.5: the fourth get() blocks on an empty mailbox after three values; the run ends quietly at 30 ns", () => {
    const r = simulateProcesses(starvedConsumerScenario("bug"));
    expect(r.log.map((l) => `${l.time} ${l.text}`)).toEqual(["10 consumer: got 1", "20 consumer: got 2", "30 consumer: got 3"]);
    expect(blockedCalls(r)).toEqual([{ label: "consumer", call: "mbx.get — empty", kind: "mailbox-get", object: "mbx" }]);
    expect(runEvidence(r).ending).toBe("quiet");
  });

  it("a shared count of 3 lets the consumer finish", () => {
    const r = simulateProcesses(starvedConsumerScenario("shared-count"));
    expect(r.log.map((l) => l.text)).toContain("consumer: all values checked");
    expect(r.blockedAtEnd).toEqual([]);
  });
});

describe("kata: repair the hand-off (IEEE 1800-2023 §15.4.5, §15.5.2, §4.7)", () => {
  it("renders the kata starter: unbounded mailbox, repeat (4), #30 @(mon_done)", () => {
    const text = source(kataScenario(KATA_STARTER));
    expect(text).toContain("mailbox #(int) mon2chk = new();");
    expect(text).toContain("repeat (4) begin");
    expect(text).toContain("#30 @(mon_done);");
  });

  it("§4.7: the starter has two outcomes at 30 ns, report line printed or not, with chk blocked in its fourth get()", () => {
    const story = kataStory(KATA_STARTER);
    expect(story.exploration.capped).toBe(false);
    expect(story.reportVerdict).toBe("depends");
    expect(story.groups.map((g) => g.reportPrinted).sort()).toEqual([false, true]);
    story.groups.forEach((g) => {
      expect(g.chkGets).toBe(3);
      expect(g.chkBlocked).toBe(true);
      expect(g.result.endTime).toBe(30);
      expect(g.result.log.slice(0, 3).map((l) => `${l.time} ${l.text}`)).toEqual(["10 chk: got 10", "20 chk: got 20", "30 chk: got 30"]);
    });
    expect(story.raceAt).toEqual({ time: 30, options: ["mon", "report"] });
    const missing = story.groups.find((g) => !g.reportPrinted);
    expect(missing && kataEndState(missing)).toBe("chk blocked in get() #4 (mon2chk.get — empty); report blocked in @(mon_done); ended at t = 30 ns");
  });

  it("§15.4.5: sharing N removes the starved consumer and nothing else", () => {
    const story = kataStory({ sharedN: true, waitFromZero: false });
    expect(story.smellOrders["starved-consumer"]).toBe(0);
    expect(story.smellOrders["missed-trigger"]).toBeGreaterThan(0);
    expect(story.reportVerdict).toBe("depends");
  });

  it("§15.5.2: waiting from 0 ns removes the missed trigger and nothing else", () => {
    const story = kataStory({ sharedN: false, waitFromZero: true });
    expect(story.smellOrders["missed-trigger"]).toBe(0);
    expect(story.smellOrders["starved-consumer"]).toBe(story.exploration.runCount);
    expect(story.reportVerdict).toBe("always");
  });

  it("both fixes: one outcome, five lines, nobody blocked", () => {
    const story = kataStory({ sharedN: true, waitFromZero: true });
    expect(story.groups).toHaveLength(1);
    expect(story.groups[0].result.log.map((l) => l.text)).toEqual(["chk: got 10", "chk: got 20", "chk: got 30", "chk: all values checked", REPORT_LINE]);
    expect(story.groups[0].result.blockedAtEnd).toEqual([]);
  });

  it("the race feedback names the two ready processes and the orders that print", () => {
    const story = kataStory(KATA_STARTER);
    const text = kataFeedback("depends", story);
    expect(text).toContain("At t = 30 ns mon and report are both ready");
    expect(text).toContain(`The model ran 24 orders of the ready processes; 12 print "${REPORT_LINE}".`);
    expect(kataFeedback("always", story)).toContain("does not match the model");
  });
});

describe("rounds and scenarios", () => {
  it("shuffledSmells is a deterministic permutation of the five", () => {
    expect(shuffledSmells(0)).toEqual(shuffledSmells(0));
    expect([...shuffledSmells(3)].sort()).toEqual([...SMELL_IDS].sort());
    expect(shuffledSmells(0)).not.toEqual(shuffledSmells(1));
  });

  it("consecutive seeds never give the same order (s = 0..50), so a replay is always a new order", () => {
    for (let s = 0; s <= 50; s += 1) {
      expect(shuffledSmells(s), `seed ${s}`).not.toEqual(shuffledSmells(s + 1));
      expect(shuffledSmells(nextOrderSeed(s))).not.toEqual(shuffledSmells(s));
      expect([...shuffledSmells(s)].sort()).toEqual([...SMELL_IDS].sort());
    }
  });

  it("120 consecutive seeds give all 120 orders, so each shape is first and last 24 times", () => {
    const orders = Array.from({ length: 120 }, (_, s) => shuffledSmells(s));
    expect(new Set(orders.map((o) => o.join())).size).toBe(120);
    SMELL_IDS.forEach((id) => {
      expect(orders.filter((o) => o[0] === id)).toHaveLength(24);
      expect(orders.filter((o) => o[4] === id)).toHaveLength(24);
    });
    for (let s = 0; s < 119; s += 1) expect(orders[s][0], `first at seed ${s}`).not.toBe(orders[s + 1][0]);
    for (let s = 0; s < 117; s += 1) {
      const lasts = new Set([orders[s][4], orders[s + 1][4], orders[s + 2][4]]);
      expect(lasts.size, `last at seeds ${s}..${s + 2}`).toBeGreaterThan(1);
    }
  });

  it("negative, fractional and non-finite seeds still give a permutation", () => {
    [-1, -121, 2.7, Number.NaN, Number.POSITIVE_INFINITY].forEach((s) => expect([...shuffledSmells(s)].sort()).toEqual([...SMELL_IDS].sort()));
    expect(shuffledSmells(-1)).toEqual(shuffledSmells(119));
  });

  it("uses the existing sv-process-model scenarios for three of the shapes", () => {
    expect(smellScenario("missed-trigger").id).toBe("event-race:at-trigger");
    expect(smellScenario("spin-triggered").id).toBe("event-race:triggered-loop");
    expect(smellScenario("leaked-key").id).toBe("key-leak:bug");
  });
});
