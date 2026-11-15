import { describe, expect, it } from "vitest";

import {
  BENCH_ASSUMPTIONS,
  BENCH_MAX_RUNS,
  BENCH_VARIANTS,
  GOT_TEXT,
  HANDOFF_REGROUP_ASSUMPTION,
  UNREGROUPED_HANDOFF_NOTE,
  WATCHDOG_NS,
  benchMoments,
  benchScenario,
  benchStory,
  endingSentence,
  exploreBench,
  firstGotAt,
  firstQueuedAt,
  logLineText,
  mailboxFillHistory,
  outcomeRuns,
  passVerdict,
  passed,
  presentBenchRun,
  presentProcessRun,
  printTime,
  sameTimeScenario,
  sameTimeStory,
  stepClauses,
  stopPoint,
  triggerWakeStep,
} from "@/lib/sv-ipc-bench-scenarios";
import { c, mailboxScenario, prepareScenario, simulateProcesses, type ProcessScenario } from "@/lib/sv-process-model";

const run = (variant: (typeof BENCH_VARIANTS)[number], advanced = false) => simulateProcesses(benchScenario(variant, { advanced }));
const log = (variant: (typeof BENCH_VARIANTS)[number], advanced = false) => run(variant, advanced).log.map(logLineText);
const source = (variant: (typeof BENCH_VARIANTS)[number], advanced = false) => prepareScenario(benchScenario(variant, { advanced })).source.map((l) => l.text);

describe("the bench as written (IEEE 1800-2023 §15.3, §15.4, §15.5)", () => {
  it("prints the lesson's expected log line for line", () => {
    expect(log("as-written")).toEqual([
      "0 gen: put 1",
      "0 drv: write 1 start",
      "0 gen: put 2",
      "10 drv: write 1 end",
      "10 drv: write 2 start",
      "10 gen: put 3",
      "20 drv: write 2 end",
      "20 drv: write 3 start",
      "30 drv: write 3 end",
      "30 irq: write 99 start",
      "30 chk: PASS, drv sent 3 items",
      "40 irq: write 99 end",
    ]);
    const r = run("as-written");
    expect(r.outcome).toEqual({ kind: "quiet", time: 40 });
    expect(r.blockedAtEnd).toEqual([]);
  });

  it("§15.4.3: put(3) on the full new(1) mailbox waits until drv's get frees the slot at 10 ns", () => {
    const r = run("as-written");
    expect(printTime(r, "gen", "put 3")).toBe(10);
    expect(r.trace.some((s) => s.kind === "block" && s.what.includes("gen2drv.put(3)") && s.time === 0)).toBe(true);
    // §15.4.3, §15.4.5: each get empties the slot, and gen's resumed put refills it in the same time stamp.
    expect(mailboxFillHistory(r, "gen2drv")).toEqual([
      { time: 0, items: 0 },
      { time: 0, items: 1 },
      { time: 0, items: 0 },
      { time: 0, items: 1 },
      { time: 10, items: 0 },
      { time: 10, items: 1 },
      { time: 20, items: 0 },
    ]);
  });

  it("§15.4.3: the get that frees the slot leaves it empty and gen ready; gen's own put stores the message when it resumes", () => {
    const t = presentBenchRun(run("as-written")).trace;
    const at = (what: string) => t.findIndex((s) => s.what === what);
    const get1 = at("drv: gen2drv.get(item) takes 1 (0/1 left).");
    expect(get1).toBeGreaterThan(0);
    expect(t[get1].mailboxes.gen2drv.items).toEqual([]);
    expect(t[get1].procs.find((p) => p.label === "gen")?.state).toBe("ready");
    expect(t[get1 + 1].what).toBe("gen wakes: its gen2drv.put(2) can complete now that a slot is free (0/1). The put stores 2 when gen runs.");
    const store2 = at("gen's gen2drv.put(2) stores 2 (1/1).");
    expect(store2).toBeGreaterThan(get1 + 1);
    expect(t.slice(get1, store2).every((s) => s.mailboxes.gen2drv.items.length === 0)).toBe(true);
    expect(t[store2]).toMatchObject({ time: 0, pid: t[get1 + 1].pid, mailboxes: { gen2drv: { items: [2] } } });
    expect(t[store2].procs.find((p) => p.label === "gen")?.state).toBe("running");
    expect(stepClauses(t[store2])).toEqual(["§15.4.3"]);
    expect(t[store2 + 1].what).toBe('gen prints "put 2".');
    const get2 = at("drv: gen2drv.get(item) takes 2 (0/1 left).");
    const store3 = at("gen's gen2drv.put(3) stores 3 (1/1).");
    expect(t[get2].time).toBe(10);
    expect(t[store3]).toMatchObject({ time: 10, mailboxes: { gen2drv: { items: [3] } } });
    expect(t.every((s, i) => s.index === i)).toBe(true);
  });

  it("§15.3.3: irq asks for the key at 25 ns, waits in the FIFO queue, and starts its write at 30 ns", () => {
    const r = run("as-written");
    expect(firstQueuedAt(r, "bus", "irq")).toBe(25);
    expect(printTime(r, "irq", "write 99 start")).toBe(30);
  });

  it("§15.5.1, §15.5.2: drv's -> drv_done at 30 ns wakes chk, which has waited since 0 ns", () => {
    const r = run("as-written");
    const wake = triggerWakeStep(r, "drv_done", "chk");
    expect(wake?.time).toBe(30);
    expect(r.trace.find((s) => s.kind === "block" && s.what.includes("@(drv_done)"))?.time).toBe(0);
  });

  it("generates the bench's code from the model: bounded mailbox, one key, $error on the else path (§20.10)", () => {
    const text = source("as-written").join("\n");
    expect(text).toContain("mailbox #(int) gen2drv = new(1);");
    expect(text).toContain("semaphore bus = new(1);");
    expect(text).toContain("event drv_done;");
    expect(text).toContain('$error("drv sent %0d items, expected 3", n_sent);');
    expect(text).toContain("bus.put(1);");
  });

  it("every order of the ready processes gives one time-stamped outcome (§4.7)", () => {
    const e = exploreBench(benchScenario("as-written"));
    expect(e.capped).toBe(false);
    expect(e.outcomes).toHaveLength(1);
  });
});

describe("break it on purpose", () => {
  it("§15.3.2, §9.6.1: without bus.put(1) the log stops after '10 gen: put 3' and the run ends quietly at 25 ns", () => {
    const r = run("no-put");
    expect(stopPoint(r)).toEqual({ line: "10 gen: put 3", end: 25 });
    expect(r.outcome.kind).toBe("quiet");
    expect(r.blockedAtEnd.map((b) => b.label)).toEqual(["drv", "irq", "chk"]);
    expect(passed(r)).toBe(false);
    expect(source("no-put").join("\n")).not.toContain("bus.put(1);");
  });

  it("§9.6.1: both key bugs end quietly, and the ending says any end-of-run report is tool-dependent", () => {
    expect(endingSentence(run("no-put"))).toMatch(/§9\.6\.1.*tool-dependent/);
    expect(endingSentence(run("new-zero"))).toMatch(/§9\.6\.1.*tool-dependent/);
  });

  it("§15.3.1: new() defaults keyCount to 0, so the log stops after '0 gen: put 2' and the run ends at 25 ns", () => {
    const r = run("new-zero");
    expect(log("new-zero")).toEqual(["0 gen: put 1", "0 gen: put 2"]);
    expect(stopPoint(r)).toEqual({ line: "0 gen: put 2", end: 25 });
    expect(r.blockedAtEnd.map((b) => b.label)).toEqual(["gen", "drv", "irq", "chk"]);
    expect(source("new-zero")).toContain("semaphore bus = new(0);");
  });

  it("§15.5.2, §4.7: with #30 @(drv_done), PASS depends on the process order at 30 ns (two time-stamped outcomes)", () => {
    const story = benchStory("late-wait");
    const e = story.exploration!;
    expect(e.capped).toBe(false);
    expect(e.outcomes).toHaveLength(2);
    expect(passVerdict(e)).toBe("depends");
    expect(e.outcomes.map((g) => passed(g.result)).sort()).toEqual([false, true]);
    // The declaration-order run lets drv trigger first: chk misses it and stays blocked.
    expect(story.result.blockedAtEnd.map((b) => b.label)).toEqual(["chk"]);
    expect(e.outcomes.reduce((n, g) => n + g.runs.length, 0)).toBe(e.runCount);
    expect(e.runCount).toBe(160);
    expect(e.outcomes.map((g) => [passed(g.result), g.runs.length])).toEqual([
      [false, 80],
      [true, 80],
    ]);
  });

  it("aligned outcome runs differ only from the 30 ns time stamp on", () => {
    const story = benchStory("late-wait");
    const [a, b] = outcomeRuns(story.scenario, story.exploration!);
    const first = a.log.findIndex((l, i) => logLineText(l) !== (b.log[i] ? logLineText(b.log[i]) : ""));
    expect(passed(a)).toBe(false);
    expect(logLineText(b.log[first])).toBe("30 chk: PASS, drv sent 3 items");
  });

  it("with the clock on, the capped exploration's cards still differ only from the 30 ns PASS line on", () => {
    const story = benchStory("late-wait", { advanced: true });
    expect(story.exploration!.capped).toBe(true);
    const [a, b] = outcomeRuns(story.scenario, story.exploration!);
    const first = a.log.findIndex((l, i) => logLineText(l) !== (b.log[i] ? logLineText(b.log[i]) : ""));
    expect(passed(a)).toBe(false);
    expect(logLineText(b.log[first])).toBe("30 chk: PASS, drv sent 3 items");
    // The card's run has its group's outcome.
    expect(passed(b)).toBe(true);
  });

  it("§20.10: no bench change reaches chk's $error branch (the assumptions say so)", () => {
    BENCH_VARIANTS.forEach((vt) => [false, true].forEach((adv) => expect(run(vt, adv).log.filter((l) => l.severity)).toEqual([])));
    exploreBench(benchScenario("late-wait")).outcomes.forEach((g) => expect(g.result.log.filter((l) => l.severity)).toEqual([]));
    expect(BENCH_ASSUMPTIONS.join(" ")).toContain("No bench change here reaches that branch");
  });
});

describe("advanced: a free-running clock and a #100 watchdog (§9.6.1, §20.2)", () => {
  it("the leaked-key bench runs to the watchdog's $finish with no PASS line, instead of ending at 25 ns", () => {
    const r = run("no-put", true);
    expect(r.outcome).toMatchObject({ kind: "finish", time: WATCHDOG_NS, by: "watchdog" });
    expect(passed(r)).toBe(false);
    expect(stopPoint(r)).toEqual({ line: "10 gen: put 3", end: 100 });
    expect(endingSentence(r)).toContain("watchdog's $finish ends the run at 100 ns (§20.2)");
    expect(source("no-put", true)).toContain("always #5 clk = ~clk; // clock");
    expect(source("no-put", true)).toContain("initial #100 $finish; // watchdog");
  });

  it("the clock does not change what the bench prints", () => {
    BENCH_VARIANTS.forEach((vt) => expect(log(vt, true)).toEqual(log(vt)));
  });

  it("the clock, not irq, is why the leaked-key run goes on after its last line", () => {
    const q = benchStory("no-put", { advanced: true }).questions[0];
    const early = q.options.find((o) => o.label === "After “10 gen: put 3”, ending at 10 ns")!;
    expect(early.feedback).toContain("the free-running clock always has a next wake-up");
    expect(early.feedback).not.toContain("irq is still booked");
    const plain = benchStory("no-put").questions[0].options.find((o) => o.label === "After “10 gen: put 3”, ending at 10 ns")!;
    expect(plain.feedback).toContain(`irq is still booked to wake at 25 ns`);
  });

  it("marks the capped exploration instead of failing, and still finds both outcomes", () => {
    const e = exploreBench(benchScenario("late-wait", { advanced: true }));
    expect(e.capped).toBe(true);
    expect(e.runCount).toBe(BENCH_MAX_RUNS);
    expect(passVerdict(e)).toBe("depends");
    benchStory("late-wait", { advanced: true }).questions[0].options.forEach((o) => expect(o.feedback).toContain("stopped at its cap"));
  });
});

describe("predictions are generated from the runs", () => {
  it("as written: put 3 at 10 ns and irq's write at 30 ns, not 25", () => {
    const [put3, irq] = benchStory("as-written").questions;
    expect(put3.options.filter((o) => o.correct).map((o) => o.label)).toEqual(["t = 10 ns"]);
    expect(irq.options.filter((o) => o.correct).map((o) => o.label)).toEqual(["t = 30 ns"]);
    expect(irq.options.find((o) => o.label === "t = 25 ns")?.feedback).toContain("§15.3.3");
  });

  it("each key bug's answer is the other bug's distractor, and the end time follows the advanced toggle", () => {
    const noPut = benchStory("no-put").questions[0];
    const newZero = benchStory("new-zero").questions[0];
    expect(noPut.options.find((o) => o.correct)?.label).toBe("After “10 gen: put 3”, ending at 25 ns");
    expect(newZero.options.find((o) => o.correct)?.label).toBe("After “0 gen: put 2”, ending at 25 ns");
    expect(noPut.options.map((o) => o.label)).toContain("After “0 gen: put 2”, ending at 25 ns");
    expect(newZero.options.map((o) => o.label)).toContain("After “10 gen: put 3”, ending at 25 ns");
    // Both branches of the 'other bug' feedback name their clause.
    expect(noPut.options.find((o) => o.label === "After “0 gen: put 2”, ending at 25 ns")?.feedback).toContain("the key is never returned (§15.3.2)");
    expect(newZero.options.find((o) => o.label === "After “10 gen: put 3”, ending at 25 ns")?.feedback).toContain("starts empty (§15.3.1)");
    expect(noPut.options.find((o) => o.id === "hang")?.correct).toBe(false);
    expect(benchStory("no-put", { advanced: true }).questions[0].options.find((o) => o.correct)?.label).toBe("After “10 gen: put 3”, ending at 100 ns");
  });

  it("#30: 'It depends' is correct and the feedback counts the orders the model ran", () => {
    const story = benchStory("late-wait");
    const q = story.questions[0];
    const right = q.options.find((o) => o.correct)!;
    expect(right.id).toBe("depends");
    const withPass = story.exploration!.outcomes.filter((g) => passed(g.result)).reduce((n, g) => n + g.runs.length, 0);
    expect(right.feedback).toContain(`${withPass} of the ${story.exploration!.runCount} orders`);
  });
});

describe("the presented run (presentBenchRun)", () => {
  const shownRuns = () => [
    ...BENCH_VARIANTS.flatMap((vt) => [false, true].map((adv) => benchStory(vt, { advanced: adv }).result)),
    ...outcomeRuns(benchScenario("late-wait"), exploreBench(benchScenario("late-wait"))),
  ];

  it("keeps the engine's log, outcome and end state, and is idempotent", () => {
    BENCH_VARIANTS.forEach((vt) => {
      const raw = run(vt);
      const shown = presentBenchRun(raw);
      expect(shown.log).toEqual(raw.log);
      expect(shown.outcome).toEqual(raw.outcome);
      expect(shown.blockedAtEnd).toEqual(raw.blockedAtEnd);
      expect(presentBenchRun(shown).trace).toEqual(shown.trace);
    });
  });

  it("never shows a producer blocked in put() unless it is in the mailbox's put queue, nor more items than the bound", () => {
    shownRuns().forEach((r) =>
      r.trace.forEach((s) =>
        Object.entries(s.mailboxes).forEach(([name, m]) => {
          if (m.bound > 0) expect(m.items.length).toBeLessThanOrEqual(m.bound);
          s.procs
            .filter((p) => p.state === "blocked" && p.blockedOn?.startsWith(`${name}.put(`))
            .forEach((p) => expect(m.putWaiters.map((w) => w.label)).toContain(p.label));
        }),
      ),
    );
  });

  it("regroups every hand-off in the runs the component shows", () => {
    shownRuns().forEach((r) => {
      expect(r.trace.filter((s) => s.what.includes("completes now that a slot is free"))).toEqual([]);
      expect(r.trace.filter((s) => /\(1\/1 left\)/.test(s.what))).toEqual([]);
    });
  });

  it("§15.5.2 and §15.5.3: the trigger's why limits 'only already waiting' to @ and gives wait (.triggered) its own clause", () => {
    const step = triggerWakeStep(presentBenchRun(run("as-written")), "drv_done", "chk")!;
    expect(step.why).toBe(
      "A trigger unblocks only the processes already waiting in @(drv_done); one that reaches @(drv_done) after the trigger stays blocked (§15.5.2). A wait (drv_done.triggered) also proceeds if it runs later in this time step, because drv_done.triggered stays true until time advances (§15.5.3).",
    );
    expect(stepClauses(step)).toEqual(["§15.5.2", "§15.5.3"]);
  });

  it("every presented step names a clause, in the bench and in both same-time programs", () => {
    const sameTime = (["shared-key", "owner"] as const).flatMap((vt) => {
      const st = sameTimeStory(vt);
      return [st.result, ...outcomeRuns(st.scenario, st.exploration)];
    });
    [...shownRuns(), ...sameTime].forEach((r) => expect(r.trace.filter((s) => stepClauses(s).length === 0).map((s) => s.what)).toEqual([]));
  });

  it("no generated feedback repeats the prompt's own 'Correct.' with a 'Right' prefix", () => {
    const questions = [
      ...BENCH_VARIANTS.flatMap((vt) => [false, true].flatMap((adv) => benchStory(vt, { advanced: adv }).questions)),
      sameTimeStory("shared-key").question,
      sameTimeStory("owner").question,
    ];
    questions.forEach((q) => q.options.forEach((o) => expect(o.feedback).not.toMatch(/^Right\b/)));
  });
});

describe("clauses per step", () => {
  it("every step of the bench run names a clause", () => {
    const r = run("as-written");
    const missing = r.trace.filter((s) => stepClauses(s).length === 0);
    expect(missing.map((s) => s.what)).toEqual([]);
    expect(stepClauses(r.trace[r.trace.length - 1])).toEqual(["§9.6.1"]);
  });

  it("names §20.2 for the watchdog's $finish", () => {
    const r = run("no-put", true);
    expect(stepClauses(r.trace[r.trace.length - 1])).toEqual(["§20.2"]);
  });

  it("maps one step of each kind to its exact clauses", () => {
    const plain = presentBenchRun(run("as-written")).trace;
    const clocked = presentBenchRun(run("no-put", true)).trace;
    const owner = sameTimeStory("owner").result.trace;
    const find = (trace: typeof plain, test: (s: (typeof plain)[number]) => boolean) => {
      const step = trace.find(test);
      expect(step).toBeDefined();
      return stepClauses(step!);
    };
    expect(find(plain, (s) => s.kind === "start")).toEqual(["§9.2"]);
    expect(find(plain, (s) => s.kind === "print")).toEqual(["§21.2.1"]);
    expect(find(plain, (s) => s.kind === "loop" && s.what.includes("enters the loop with"))).toEqual(["§12.7.1"]);
    expect(find(plain, (s) => / calls bus_write\(/.test(s.what))).toEqual(["§13.3", "§13.3.1"]);
    expect(find(plain, (s) => /\bfinishes\.$/.test(s.what))).toEqual(["§9.2.1"]);
    expect(find(plain, (s) => s.what.startsWith("drv: n_sent = "))).toEqual(["§10.4.1"]);
    expect(find(plain, (s) => s.what.startsWith("chk: if ("))).toEqual(["§12.4"]);
    expect(find(plain, (s) => s.what.startsWith("drv waits #10"))).toEqual(["§9.4.1"]);
    expect(find(plain, (s) => s.kind === "advance")).toEqual(["§4.5", "§15.5.3"]);
    expect(find(plain, (s) => s.kind === "end")).toEqual(["§9.6.1"]);
    expect(find(clocked, (s) => s.kind === "finish")).toEqual(["§9.2.3", "§20.2"]);
    expect(find(clocked, (s) => s.kind === "end")).toEqual(["§20.2"]);
    expect(find(owner, (s) => s.what === "B blocks on wait (grant == 1).")).toEqual(["§9.4.3"]);
  });

  it("key moments are found in the trace", () => {
    expect(benchMoments(run("as-written")).map((m) => m.label)).toEqual(["gen2drv full at 0 ns", "irq queues for bus at 25 ns", "-> drv_done wakes chk at 30 ns", "Run ends at 40 ns"]);
    expect(benchMoments(run("late-wait")).map((m) => m.label)).toContain("-> drv_done at 30 ns: nobody waiting");
  });
});

describe("same-time arrivals (§15.3.3, §4.7)", () => {
  it("B and C call get at 2 ns: two outcomes, each with its own FIFO queue order", () => {
    const story = sameTimeStory("shared-key");
    expect(story.exploration.capped).toBe(false);
    expect(story.exploration.outcomes).toHaveLength(2);
    expect(story.verdict).toBe("depends");
    expect(story.queues.map((q) => q.join(",")).sort()).toEqual(["B,C", "C,B"]);
    const firsts = story.exploration.outcomes.map((g) => firstGotAt(g.result, 10)).sort();
    expect(firsts).toEqual(["B", "C"]);
    // FIFO keeps the arrival order: whoever queued first gets the key first.
    story.exploration.outcomes.forEach((g, i) => expect(firstGotAt(g.result, 10)).toBe(story.queues[i][0]));
  });

  it("the queue holds the arrival order: the second arrival gets the key 5 ns later", () => {
    const r = simulateProcesses(sameTimeScenario("shared-key"));
    expect(r.log.map(logLineText)).toEqual(["10 B: B got the key", "15 C: C got the key"]);
  });

  it("routing requests through one owner makes the time-stamped outcome order-independent (§15.4.1 unbounded req)", () => {
    const story = sameTimeStory("owner");
    expect(story.exploration.outcomes).toHaveLength(1);
    expect(story.verdict).toBe("B");
    // No semaphore here: access comes from grant == id, so the log says "got the bus".
    expect(story.result.log.map(logLineText)).toEqual(["10 B: B got the bus", "15 C: C got the bus"]);
    expect(GOT_TEXT.owner).toBe("got the bus");
    expect(story.question.question).toContain("“got the bus”");
    expect(sameTimeStory("shared-key").question.question).toContain("“got the key”");
    expect(firstGotAt(story.result, 10)).toBe("B");
    expect(prepareScenario(story.scenario).source.map((l) => l.text)).toContain("mailbox #(int) req = new();");
    expect(story.question.options.find((o) => o.correct)?.id).toBe("B");
    // A fixed verdict: C is never first, so the feedback does not say "not always".
    const c = story.question.options.find((o) => o.id === "C")!;
    expect(c.feedback).toMatch(/^Not C: in every order the model ran, B is first\./);
    expect(c.feedback).not.toContain("Not always");
  });

  it("the shared-key question's right answer is 'depends' and quotes the arrival-order sentence of §15.3.3", () => {
    const right = sameTimeStory("shared-key").question.options.find((o) => o.correct)!;
    expect(right.id).toBe("depends");
    expect(right.feedback).toContain("does not guarantee the order in which processes arrive at the queue");
  });
});

describe("limits", () => {
  it("names the cap and the watchdog from the constants", () => {
    expect(BENCH_ASSUMPTIONS.join(" ")).toContain(`up to ${BENCH_MAX_RUNS} orders`);
    expect(BENCH_ASSUMPTIONS.join(" ")).toContain(`$finish at ${WATCHDOG_NS} ns`);
  });

  it("states how the code's $error string differs from the lesson's, and the put() hand-off regrouping", () => {
    const text = BENCH_ASSUMPTIONS.join(" ");
    expect(text).toContain('the lesson\'s $error("chk: drv sent %0d items, expected 3") appears as $error("drv sent %0d items, expected 3")');
    expect(source("as-written").join("\n")).toContain('$error("drv sent %0d items, expected 3", n_sent);');
    expect(text).toContain("only the order of steps inside one time stamp is regrouped");
  });
});

describe("the presented run outside the bench (mailbox mode's back-pressure programs)", () => {
  const bounds = [1, 2, 0];

  it("presentBenchRun is presentProcessRun", () => {
    expect(presentBenchRun).toBe(presentProcessRun);
  });

  it("§15.4.3: no get leaves a bounded mailbox full while the producer is still blocked, and log and outcome are the engine's", () => {
    bounds.forEach((bound) => {
      const raw = simulateProcesses(mailboxScenario(bound));
      const shown = presentProcessRun(raw);
      expect(shown.log).toEqual(raw.log);
      expect(shown.outcome).toEqual(raw.outcome);
      expect(shown.blockedAtEnd).toEqual(raw.blockedAtEnd);
      expect(presentProcessRun(shown).trace).toEqual(shown.trace);
      if (bound > 0) expect(shown.trace.filter((s) => s.what.includes(`(${bound}/${bound} left)`))).toEqual([]);
      expect(shown.trace.filter((s) => s.what.includes("completes now that a slot is free"))).toEqual([]);
      expect(shown.trace.filter((s) => s.why.includes(UNREGROUPED_HANDOFF_NOTE))).toEqual([]);
      shown.trace.forEach((s) => {
        const m = s.mailboxes.mbx;
        if (bound > 0) expect(m.items.length).toBeLessThanOrEqual(bound);
        s.procs
          .filter((p) => p.state === "blocked" && p.blockedOn?.startsWith("mbx.put("))
          .forEach((p) => expect(m.putWaiters.map((w) => w.label)).toContain(p.label));
      });
    });
  });

  it("new(1): the producer's own step stores each resumed put, right after the consumer's get empties the slot", () => {
    const t = presentProcessRun(simulateProcesses(mailboxScenario(1))).trace;
    const get = t.findIndex((s) => s.what === "consumer: mbx.get(v) takes 0 (0/1 left).");
    expect(get).toBeGreaterThan(0);
    expect(t[get].mailboxes.mbx.items).toEqual([]);
    expect(t[get].procs.find((p) => p.label === "producer")?.state).toBe("ready");
    const store = t.findIndex((s) => s.what === "producer's mbx.put(1) stores 1 (1/1).");
    expect(store).toBeGreaterThan(get);
    expect(t[store].time).toBe(t[get].time);
    expect(stepClauses(t[store])).toEqual(["§15.4.3"]);
  });

  it("marks a hand-off it cannot regroup: another process uses the mailbox before the producer resumes", () => {
    // new(1) holds 0; prod blocks in put(1). At 10 ns cons takes 0, then peeker (woken
    // from its delay before prod is woken by the get) calls mbx.num() before prod runs.
    const scenario: ProcessScenario = {
      id: "mbx:skip",
      title: "A hand-off another process observes",
      vars: [
        { name: "x", type: "int", init: 0 },
        { name: "n", type: "int", init: 0 },
      ],
      mailboxes: [{ name: "mbx", bound: 1 }],
      processes: [
        { id: "cons", label: "cons", kind: "initial", body: [{ kind: "delay", amount: c(10) }, { kind: "mailbox", op: "get", mailbox: "mbx", target: "x" }] },
        { id: "peeker", label: "peeker", kind: "initial", body: [{ kind: "delay", amount: c(10) }, { kind: "mailbox", op: "num", mailbox: "mbx", target: "n" }] },
        {
          id: "prod",
          label: "prod",
          kind: "initial",
          body: [
            { kind: "mailbox", op: "put", mailbox: "mbx", value: c(0) },
            { kind: "mailbox", op: "put", mailbox: "mbx", value: c(1) },
          ],
        },
      ],
    };
    const raw = simulateProcesses(scenario);
    const get = raw.trace.findIndex((s) => s.kind === "exec" && /^cons: mbx\.get\(x\) takes 0/.test(s.what));
    expect(get).toBeGreaterThan(0);
    const prodRuns = raw.trace.findIndex((s, i) => i > get + 1 && s.pid === raw.trace[get + 1].pid);
    expect(raw.trace.slice(get + 2, prodRuns).some((s) => s.what.includes("mbx."))).toBe(true);
    const shown = presentProcessRun(raw);
    expect(shown.trace.map((s) => s.what)).toEqual(raw.trace.map((s) => s.what));
    expect(shown.trace[get].why.endsWith(UNREGROUPED_HANDOFF_NOTE)).toBe(true);
    expect(shown.trace.filter((s) => s.why.includes(UNREGROUPED_HANDOFF_NOTE))).toHaveLength(1);
    expect(presentProcessRun(shown).trace).toEqual(shown.trace);
    expect(HANDOFF_REGROUP_ASSUMPTION).toContain("shown as the engine runs it, and that step says so");
  });
});
