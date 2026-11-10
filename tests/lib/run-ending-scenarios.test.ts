import { describe, expect, it } from "vitest";

import {
  CONTROL_FACTS,
  END_CONTROLS,
  END_OF_RUN_VARIANTS,
  EXPECTATIONS,
  LOOP_BOXES,
  LOOP_HORIZON,
  LOOP_VARIANTS,
  NO_FINISH_HORIZON,
  PRESET_VIEW,
  SEVERITY_STEP_NS,
  TEST_DELAY,
  WATCHDOG_TIMEOUT,
  bookedAtEnd,
  bookedList,
  classifyEnder,
  controlExplanation,
  counterExplanation,
  endDiagnosticNote,
  endOfRunExplanation,
  endOfRunOptions,
  endingDetails,
  endingHeadline,
  finalSteps,
  jumpGates,
  jumpOptions,
  lessonSource,
  loopBoxNote,
  loopBoxOf,
  loopBoxPassed,
  loopEndOptions,
  runEndOfRun,
  runSchedulerLoop,
  runSeverity,
  runStepBadges,
  runStepWhy,
  severityCountOptions,
  severityLineOptions,
  severityPrefix,
  slotEvents,
  sourceLineOf,
} from "@/lib/run-ending-scenarios";

const configs = END_CONTROLS.flatMap((control) => [true, false].map((count) => ({ control, count })));

describe("severity-and-end: report, end or suspend", () => {
  it("§20.10: $error prints and returns, so later lines still run and n_fail is untouched by it", () => {
    for (const count of [true, false]) {
      const run = runSeverity({ control: "error", count });
      const error = run.result.log.find((l) => l.severity === "error");
      expect(error?.time).toBe(run.controlTime);
      expect(run.laterPrinted).toBe(true);
      expect(run.result.log.find((l) => l.text.startsWith("still running"))?.time).toBe(run.laterTime);
      expect(run.failCount).toBe(count ? 1 : 0);
    }
  });

  it("§20.10: $fatal makes an implicit call to $finish, and §9.2.3 final still runs in zero time", () => {
    const run = runSeverity({ control: "fatal", count: true });
    expect(run.result.outcome).toMatchObject({ kind: "finish", via: "fatal", time: run.controlTime });
    expect(run.laterPrinted).toBe(false);
    const finals = finalSteps(run.result);
    expect(finals.length).toBe(1);
    expect(finals.every((s) => s.time === run.controlTime)).toBe(true);
    expect(run.summary).toBe("final block: FAIL=1");
    expect(sourceLineOf(run.prepared, "ctl")).toBe('$fatal(1, "data mismatch at t=%0d", $time);');
  });

  it("§20.2 and §9.2.3: $stop suspends the run, so final does not run and nothing later prints", () => {
    const run = runSeverity({ control: "stop", count: true });
    expect(run.result.outcome).toMatchObject({ kind: "stop", time: run.controlTime });
    expect(finalSteps(run.result)).toEqual([]);
    expect(run.summary).toBeUndefined();
    expect(run.failCount).toBeUndefined();
    expect(endingHeadline(run.result)).toBe(`Suspended: what a batch tool does next is tool-dependent ($stop at t = ${run.controlTime} ns)`);
    const end = run.result.trace[run.result.trace.length - 1];
    expect(runStepBadges(end, run.result.outcome).where).toMatch(/not ended/);
  });

  it("§20.2: $stop is taught as a suspension that could be resumed, never as an end without final", () => {
    expect(CONTROL_FACTS.stop.returns).toBe("suspends");
    for (const count of [true, false]) {
      const run = runSeverity({ control: "stop", count });
      const suspended = `$stop suspends the run at t = ${run.controlTime} ns, so nothing after it runs unless someone resumes the simulation. In this run nobody does (§20.2).`;
      const options = severityLineOptions(run);
      expect(options.find((o) => o.id === "both")?.feedback).toBe(suspended);
      expect(options.find((o) => o.id === "later")?.feedback).toBe(suspended);
      options.forEach((o) => {
        expect(o.feedback).not.toMatch(/does not return/);
        expect(o.feedback).not.toMatch(/never runs/);
      });
      expect(controlExplanation(run)).toMatch(/Resumed from an interactive prompt, the initial block would go on at the next statement/);
      expect(counterExplanation(run)).toBe("No summary prints. final has not run: $stop suspended the run without ending it (§20.2, §9.2.3).");
      severityCountOptions(run).forEach((o) => expect(o.feedback).not.toMatch(/never runs|does not return/));
      const end = run.result.trace[run.result.trace.length - 1];
      expect(runStepWhy(end, run.result)).toBe(
        "initial is suspended at its $stop; no other process is waiting. Nothing runs unless someone resumes the simulation, and final procedures run only when simulation ends (§20.2, §9.2.3).",
      );
    }
    // $fatal and $finish do end the run, so "does not return" is right for them.
    const fatal = runSeverity({ control: "fatal", count: true });
    expect(severityLineOptions(fatal).find((o) => o.id === "both")?.feedback).toBe(
      `$fatal(1, …) ends the run and does not return, so the initial block never reaches t = ${fatal.laterTime} ns (§20.10).`,
    );
  });

  it("§20.10: $fatal is a fatal error that exits with an error code; its 1 is the $finish diagnostic level (§20.2 Table 20-1)", () => {
    const run = runSeverity({ control: "fatal", count: false });
    expect(controlExplanation(run)).toMatch(/prints a fatal error and makes an implicit call to \$finish at t = 20 ns, so the simulation ends with an error code; the 1 is the \$finish diagnostic level \(§20\.10, §20\.2 Table 20-1\)/);
    expect(counterExplanation(run)).toMatch(/^FAIL=0: \$fatal\(1, …\) printed a fatal error but changed no variable/);
    expect(counterExplanation(runSeverity({ control: "error", count: false }))).toMatch(/printed an error but/);
  });

  it("§20.10: $error has no implicit $finish; the text says so without claiming no tool option can end the run", () => {
    const run = runSeverity({ control: "error", count: true });
    expect(controlExplanation(run)).toMatch(/§20\.10 gives \$error no implicit \$finish \(a tool option, such as an error-count limit, could still end a run\)/);
    expect(controlExplanation(run)).not.toMatch(/does not end the run/);
  });

  it("§20.2 Table 20-1: the output notes the level-1 diagnostic at the call that ends or suspends the run", () => {
    configs.forEach((cfg) => {
      const run = runSeverity(cfg);
      const note = endDiagnosticNote(run.result, run.prepared);
      expect(note).toBeDefined();
      const call = cfg.control === "stop" ? "$stop" : cfg.control === "fatal" ? "$fatal" : "$finish";
      expect(note?.text).toMatch(new RegExp(`^Not shown: at \\${call} the tool also reports diagnostic level 1 \\(`));
      expect(note?.text).toMatch(/prints the simulation time and location/);
      expect(note?.text).toMatch(/Table 20-1/);
      // It belongs to the step that ran the call, at the time of the call.
      const at = run.result.trace[note?.index ?? -1];
      expect(at.time).toBe(cfg.control === "error" ? run.laterTime : run.controlTime);
      expect(at.pid).toBeDefined();
    });
    expect(endDiagnosticNote(runSeverity({ control: "fatal", count: true }).result, runSeverity({ control: "fatal", count: true }).prepared)?.text).toMatch(/its first argument is 1/);
    const horizon = runSchedulerLoop("free-clock");
    expect(endDiagnosticNote(horizon.result, horizon.prepared)).toBeUndefined();
  });

  it("§20.2: $finish ends the run at once; final runs after it (§9.2.3)", () => {
    const run = runSeverity({ control: "finish", count: false });
    expect(run.result.outcome).toMatchObject({ kind: "finish", time: run.controlTime });
    expect(run.result.outcome).not.toHaveProperty("via");
    expect(run.summary).toBe("final block: FAIL=0");
  });

  it("every control matches CONTROL_FACTS (§20.2, §20.10, §9.2.3), for both counter settings", () => {
    configs.forEach((cfg) => {
      const run = runSeverity(cfg);
      const facts = CONTROL_FACTS[cfg.control];
      expect(run.controlTime).toBe(2 * SEVERITY_STEP_NS);
      expect(run.laterPrinted).toBe(facts.returns === true);
      expect(run.summary !== undefined).toBe(facts.ends !== "suspend");
      if (facts.ends === "suspend") expect(run.result.outcome.kind).toBe("stop");
      else expect(run.result.outcome.kind).toBe("finish");
      if (run.failCount !== undefined) expect(run.failCount).toBe(cfg.count ? 1 : 0);
    });
  });

  it("grades exactly one line option and one count option for every setting, with the right one", () => {
    configs.forEach((cfg) => {
      const run = runSeverity(cfg);
      const lines = severityLineOptions(run).filter((o) => o.correct);
      const counts = severityCountOptions(run).filter((o) => o.correct);
      expect(lines).toHaveLength(1);
      expect(counts).toHaveLength(1);
      const expectedLine = run.laterPrinted ? "both" : run.summary ? "summary" : "neither";
      expect(lines[0].id).toBe(expectedLine);
      expect(counts[0].id).toBe(run.failCount === undefined ? "none" : String(run.failCount));
    });
  });

  it("the line prediction's feedback never states the FAIL count it asks about next", () => {
    configs.forEach((cfg) => {
      severityLineOptions(runSeverity(cfg)).forEach((o) => expect(o.feedback).not.toMatch(/FAIL=/));
    });
  });

  it("explains the summary from the counter alone: $error without n_fail++ leaves FAIL=0", () => {
    const run = runSeverity({ control: "error", count: false });
    expect(run.summary).toBe("final block: FAIL=0");
    expect(counterExplanation(run)).toMatch(/^FAIL=0: \$error printed an error but changed no variable/);
    expect(counterExplanation(runSeverity({ control: "fatal", count: true }))).toMatch(/^FAIL=1: final reads n_fail/);
    expect(counterExplanation(runSeverity({ control: "stop", count: true }))).toMatch(/No summary prints/);
  });

  it("§20.10: severity prefixes are placeholders, not a tool's real format", () => {
    expect(severityPrefix("error", 20)).toBe("‹Error prefix, 20 ns›");
    const run = runSeverity({ control: "error", count: true });
    expect(run.result.log.filter((l) => l.severity).map((l) => l.severity)).toEqual(["info", "warning", "error"]);
  });

  it("shows n_fail++ only when the toggle is on, and spells it as the lesson does", () => {
    expect(lessonSource(runSeverity({ control: "error", count: true }).prepared).some((l) => l.text.trim() === "n_fail++;")).toBe(true);
    expect(lessonSource(runSeverity({ control: "error", count: false }).prepared).some((l) => l.text.includes("n_fail++"))).toBe(false);
  });
});

describe("watchdog-race: endOfRunScenario", () => {
  it("is built from the lesson's snippet: fork run / watchdog join_any; disable fork; report(); $finish", () => {
    const text = lessonSource(runEndOfRun("normal").prepared).map((l) => l.text);
    const main = text.slice(text.indexOf("initial begin : main"));
    const order = ["  fork", "    begin : run", "    begin : watchdog", "      #(TIMEOUT);", "      fail_cnt++; // a hang is a failure", "      report();", "  join_any", "  disable fork;", "  report();", "  $finish;"];
    let at = 0;
    order.forEach((line) => {
      const found = main.indexOf(line, at);
      expect(found, line).toBeGreaterThanOrEqual(at);
      at = found + 1;
    });
    expect(main.some((l) => l.trim().startsWith('$fatal(1, "WDOG'))).toBe(true);
    expect(text).toContain("int n_exp = 0; // stands in for exp_q.size()");
  });

  it("normal: §9.3.2 join_any resumes main when run ends, and §9.6.3 disable fork kills the waiting watchdog", () => {
    const run = runEndOfRun("normal");
    expect(run.ender).toBe("main-finish");
    expect(run.watchdogKilledAt).toBe(run.result.outcome.time);
    expect(run.summary).toEqual({ text: `PASS=${EXPECTATIONS} FAIL=0`, time: run.result.outcome.time, by: "main" });
    expect(run.result.log.some((l) => l.severity === "fatal")).toBe(false);
    expect(run.result.outcome.time).toBeLessThan(WATCHDOG_TIMEOUT);
  });

  it("hang: run never completes its wait, so the watchdog's $fatal fires at TIMEOUT (§20.10)", () => {
    const run = runEndOfRun("hang");
    expect(run.ender).toBe("watchdog-fatal");
    expect(run.result.outcome).toMatchObject({ kind: "finish", via: "fatal", time: WATCHDOG_TIMEOUT, by: "watchdog" });
    expect(run.summary).toEqual({ text: "PASS=0 FAIL=1", time: WATCHDOG_TIMEOUT, by: "watchdog" });
    expect(run.result.blockedAtEnd.map((b) => b.label)).toEqual(expect.arrayContaining(["main", "run"]));
    expect(run.result.finalVars.clk).toBe("X");
  });

  it("$finish deleted: §9.6.1 the free-running clock keeps the run alive; the model stops at its horizon", () => {
    const run = runEndOfRun("no-finish");
    expect(run.ender).toBe("still-running");
    expect(run.result.outcome).toMatchObject({ kind: "horizon", maxTime: NO_FINISH_HORIZON });
    expect(run.summary?.text).toBe(`PASS=${EXPECTATIONS} FAIL=0`);
    expect(run.watchdogKilledAt).toBeDefined();
    expect(endingHeadline(run.result)).toBe(`Still running at the ${NO_FINISH_HORIZON} ns model horizon: the clock always has another event booked`);
    expect(finalSteps(run.result)).toEqual([]);
  });

  it("zero-delay wait loop: §9.2.2.1 and §12.7.4 time stops, the watchdog never fires and no summary prints", () => {
    const run = runEndOfRun("zero-delay");
    expect(run.ender).toBe("time-stopped");
    expect(run.result.outcome).toMatchObject({ kind: "zero-delay-loop", label: "run" });
    expect(run.summary).toBeUndefined();
    expect(run.result.log).toEqual([]);
    expect(run.result.trace[run.result.trace.length - 1].booked.some((b) => b.label === "watchdog" && b.time === WATCHDOG_TIMEOUT)).toBe(true);
    expect(sourceLineOf(run.prepared, "drain-wait")).toBe("while (n_exp != 0); // no timing control inside");
  });

  it("zero-delay wait loop: a while in a task cites §12.7.4 and §4.5, not the always form of §9.2.2.1", () => {
    const run = runEndOfRun("zero-delay");
    const end = run.result.trace[run.result.trace.length - 1];
    expect(runStepBadges(end, run.result.outcome, run.result).where).toBe("Simulation never ends: time cannot advance (§12.7.4, §4.5)");
    expect(endingDetails(run.result)[0]).toMatch(/\(§12\.7\.4, §4\.5\)\.$/);
    expect(endOfRunExplanation(run)).toMatch(/\(§12\.7\.4, §4\.5\)/);
    const why = runStepWhy(end, run.result);
    expect(why).toMatch(/^run never reaches a timing control, so the time slot never empties and time cannot advance \(§12\.7\.4, §4\.5\)\./);
    expect(why).toContain(`watchdog at t = ${WATCHDOG_TIMEOUT} ns`);
    expect(why).not.toMatch(/objection/);
  });

  it("grades exactly one ending option per variant, and the explanation names the run's own numbers", () => {
    END_OF_RUN_VARIANTS.forEach(({ value }) => {
      const run = runEndOfRun(value);
      const correct = endOfRunOptions(run).filter((o) => o.correct);
      expect(correct).toHaveLength(1);
      expect(correct[0].feedback).toBe(endOfRunExplanation(run));
      expect(classifyEnder(run.result)).toBe(run.ender);
      if (run.summary) expect(endOfRunExplanation(run)).toContain(run.summary.text);
    });
  });
});

describe("scheduler-loop: §4.5", () => {
  it("§4.5: time visits only booked times; $finish at 22 ns stops the 25 ns edge (§20.2, §9.2.3)", () => {
    const run = runSchedulerLoop("finish");
    expect(run.visited).toEqual([0, 5, 10, 15, 20, TEST_DELAY]);
    expect(run.result.outcome).toMatchObject({ kind: "finish", time: TEST_DELAY });
    expect(run.result.log.find((l) => l.region === "final")?.text).toBe("final: count = 2");
    expect(endingDetails(run.result)).toContain("Booked but never run: clock at t = 25 ns. Nothing runs after the end.");
  });

  it("§9.6.1: a blocked waiter with nothing booked ends quietly; final is a model assumption (§9.2.3)", () => {
    const run = runSchedulerLoop("quiet");
    expect(run.result.outcome).toEqual({ kind: "quiet", time: TEST_DELAY });
    expect(run.result.blockedAtEnd.map((b) => b.label)).toEqual(["waiter"]);
    const final = finalSteps(run.result)[0];
    expect(final.why).toMatch(/^Model assumption/);
    const finalIndex = run.result.trace.indexOf(final);
    expect(loopBoxNote(run.result, finalIndex)).toMatch(/^Model assumption/);
    expect(runStepBadges(final, run.result.outcome).assumption).toBe(true);
    expect(endingHeadline(run.result)).toBe(`Ended at t = ${TEST_DELAY} ns: nothing left booked`);
    expect(endingDetails(run.result)).toEqual([
      "Nothing is booked at any later time and nothing can wake the processes still waiting, so simulation ends by itself (§9.6.1).",
      "Model assumption: §9.2.3 ties final procedures to an explicit or implicit $finish and does not say whether they run here. The model runs them (report).",
    ]);
    // In UVM the phase timeout is a booked delay: such a run waits for it rather than hanging forever.
    const end = run.result.trace[run.result.trace.length - 1];
    expect(runStepWhy(end, run.result)).toMatch(/^Nothing is booked at any later time, so simulation ends by itself \(§9\.6\.1\), with these still waiting: waiter \(@\(posedge ready\)\)\./);
    expect(runStepWhy(end, run.result)).toMatch(/uvm_fatal\("PH_TIMEOUT"\)/);
    expect(runStepWhy(end, run.result)).not.toMatch(/this is a hang/);
  });

  it("§4.5 with a free-running clock and no $finish: still running at the model horizon", () => {
    const run = runSchedulerLoop("free-clock");
    expect(run.result.outcome).toMatchObject({ kind: "horizon", maxTime: LOOP_HORIZON, next: LOOP_HORIZON + 5 });
    expect(finalSteps(run.result)).toEqual([]);
    const last = run.result.trace.length - 1;
    expect(loopBoxOf(run.result, last)).toBe("check");
    expect(loopBoxNote(run.result, last)).toMatch(/model horizon/);
  });

  it("§9.2.2.1: always areg = ~areg; is a zero-delay loop, so time never leaves 0", () => {
    const run = runSchedulerLoop("zero-delay");
    expect(run.result.outcome).toMatchObject({ kind: "zero-delay-loop", time: 0, label: "toggle" });
    expect(run.visited).toEqual([0]);
    expect(jumpGates(run.result)).toEqual([]);
    expect(lessonSource(run.prepared).some((l) => l.text.startsWith("always areg = ~areg;"))).toBe(true);
    const last = run.result.trace.length - 1;
    const end = run.result.trace[last];
    expect(loopBoxOf(run.result, last)).toBe("execute");
    expect(runStepBadges(end, run.result.outcome, run.result).kind).toBe("Time stopped");
    expect(runStepBadges(end, run.result.outcome, run.result).where).toBe("Simulation never ends: time cannot advance (§9.2.2.1, §4.5)");
    // The test's 22 ns wake-up stays booked: time never reaches it.
    expect(bookedAtEnd(run.result)).toEqual([expect.objectContaining({ label: "test", time: TEST_DELAY })]);
    expect(endingDetails(run.result)).toContain(`Booked but never reached: test at t = ${TEST_DELAY} ns. A delay-based timer cannot fire while time is stopped.`);
    expect(endingDetails(run.result)[0]).toMatch(/^toggle ran the model's 16-statement loop budget at t = 0 ns/);
    // §9.2.2.1, §4.5: the hang does not depend on objections; the booked wake-ups wait for a time that never comes.
    const why = runStepWhy(end, run.result);
    expect(why).toBe(
      `toggle never reaches a timing control, so the time slot never empties and time cannot advance (§9.2.2.1, §4.5). The booked wake-ups (test at t = ${TEST_DELAY} ns) wait for a time that never comes, so none of these delays can fire. The run hangs whatever else the code does.`,
    );
  });

  it("never calls a suspended, cut-off or stuck run ended", () => {
    const runs = [runSeverity({ control: "stop", count: true }).result, runSchedulerLoop("free-clock").result, runSchedulerLoop("zero-delay").result, runEndOfRun("no-finish").result, runEndOfRun("zero-delay").result];
    runs.forEach((result) => {
      const end = result.trace[result.trace.length - 1];
      expect(endingHeadline(result)).not.toMatch(/^Ended/);
      expect(runStepBadges(end, result.outcome, result).where).not.toMatch(/^End of simulation/);
      expect(finalSteps(result)).toEqual([]);
    });
  });

  it("§4.5: every jump goes to the earliest booked time, and exactly one jump option is right", () => {
    LOOP_VARIANTS.forEach(({ value }) => {
      const { result } = runSchedulerLoop(value);
      jumpGates(result).forEach((gate) => {
        const before = bookedList(result, gate - 1, "due");
        expect(result.trace[gate].time).toBe(before[0].time);
        const options = jumpOptions(result, gate);
        expect(options.filter((o) => o.correct).map((o) => o.label)).toEqual([`t = ${result.trace[gate].time} ns`]);
        const tick = options.find((o) => o.label === `t = ${result.trace[gate - 1].time + 1} ns`);
        expect(tick?.correct).toBe(false);
        expect(tick?.feedback).toMatch(/^Time does not tick by 1 ns\./);
      });
    });
  });

  it("lists booked wake-ups earliest first, or in booking order while a jump is being predicted", () => {
    const { result } = runSchedulerLoop("finish");
    const gate = jumpGates(result)[1];
    expect(bookedList(result, gate - 1, "due").map((b) => b.time)).toEqual([10, 22]);
    expect(bookedList(result, gate - 1, "booking").map((b) => b.label)).toEqual(["test", "clock"]);
  });

  it("§4.3: the slot list shows ◆ update and ▶ evaluation events of the current time slot", () => {
    const { result } = runSchedulerLoop("finish");
    const at5 = result.trace.findIndex((s) => s.time === 5 && s.kind === "exec" && s.what.startsWith("clock"));
    const slot = slotEvents(result, at5);
    expect(slot.time).toBe(5);
    expect(slot.items).toEqual(
      expect.arrayContaining([
        { kind: "update", text: "clk 0 → 1", status: "now" },
        { kind: "evaluation", text: "counter is ready to run", status: "pending" },
      ]),
    );
  });

  it("§4.3: an NBA update is an update event, not the process running", () => {
    LOOP_VARIANTS.forEach(({ value }) => {
      const { result } = runSchedulerLoop(value);
      const nbas = result.trace.flatMap((s, i) => (s.kind === "nba" ? [i] : []));
      if (value === "finish" || value === "free-clock") expect(nbas.length).toBeGreaterThan(0);
      nbas.forEach((i) => {
        const items = slotEvents(result, i).items;
        expect(items.filter((it) => it.kind === "evaluation" && it.status === "now")).toEqual([]);
        expect(items).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "update", status: "now" })]));
      });
    });
  });

  it("§4.3: within a step the process's evaluation comes before the update it made", () => {
    const { result } = runSchedulerLoop("finish");
    const at5 = result.trace.findIndex((s) => s.time === 5 && s.kind === "exec" && s.what.startsWith("clock"));
    const texts = slotEvents(result, at5).items.map((i) => i.text);
    expect(texts.indexOf("clock runs")).toBeLessThan(texts.indexOf("clk 0 → 1"));
    const zero = runSchedulerLoop("zero-delay").result;
    const toggleStep = zero.trace.findIndex((s) => s.kind === "exec" && s.what.startsWith("toggle"));
    const zt = slotEvents(zero, toggleStep).items.map((i) => i.text);
    expect(zt.indexOf("toggle runs")).toBeLessThan(zt.indexOf("areg 0 → 1"));
  });

  it("collapses a long run of changes to one variable, so the zero-delay list stays short", () => {
    const { result } = runSchedulerLoop("zero-delay");
    const last = result.trace.length - 1;
    const items = slotEvents(result, last).items;
    const changes = result.trace.filter((s, i) => i > 0 && s.vars.areg !== result.trace[i - 1].vars.areg).length;
    expect(items.filter((i) => i.kind === "update")).toEqual([{ kind: "update", text: `areg changed ${changes} times: 0 → … → 0`, status: "done" }]);
    expect(items.length).toBeLessThanOrEqual(4);
  });

  it("§9.2.3: in the final phase the list holds only the final procedure, without the ▶ evaluation glyph", () => {
    (["finish", "quiet"] as const).forEach((value) => {
      const { result } = runSchedulerLoop(value);
      const first = result.trace.findIndex((s) => s.kind === "final");
      for (let i = first; i < result.trace.length; i += 1) {
        const slot = slotEvents(result, i);
        expect(slot.finalPhase).toBe(true);
        expect(slot.items).toEqual([{ kind: "final", text: "report (final procedure, zero time)", status: i === result.trace.length - 1 ? "done" : "now" }]);
      }
      expect(slotEvents(result, first - 1).finalPhase).toBe(false);
    });
  });

  it("grades exactly one ending option per program, matching the outcome kind", () => {
    LOOP_VARIANTS.forEach(({ value }) => {
      const run = runSchedulerLoop(value);
      const correct = loopEndOptions(run).filter((o) => o.correct);
      expect(correct.map((o) => o.id)).toEqual([run.result.outcome.kind]);
      expect(correct[0].feedback).toContain(endingHeadline(run.result));
      // It must not answer the jump predictions that come later.
      run.visited.slice(1, -1).forEach((t) => expect(correct[0].feedback).not.toContain(`t = ${t} ns`));
    });
  });

  it("words the wrong 'never ends: always booked' feedback for each program (§4.5, §9.2.2.1, §20.2, §20.10)", () => {
    const horizonOf = (value: (typeof LOOP_VARIANTS)[number]["value"]) => loopEndOptions(runSchedulerLoop(value)).find((o) => o.id === "horizon");
    const zero = horizonOf("zero-delay");
    expect(zero?.correct).toBe(false);
    expect(zero?.feedback).toBe(
      `This run never ends either, but not because something is always booked. Time is stuck at 0 ns, so the booked wake-up (test at t = ${TEST_DELAY} ns) is never reached (§9.2.2.1, §4.5).`,
    );
    LOOP_VARIANTS.filter(({ value }) => value !== "zero-delay" && value !== "free-clock").forEach(({ value }) => {
      expect(horizonOf(value)?.feedback).toBe(
        "A run keeps going with time advancing only while a process keeps booking delays and nothing ends it ($finish, or $fatal through its implicit $finish) (§4.5, §20.2, §20.10).",
      );
    });
    LOOP_VARIANTS.forEach(({ value }) => {
      loopEndOptions(runSchedulerLoop(value)).forEach((o) => expect(o.feedback).not.toMatch(/goes on forever only if/));
    });
  });

  it("maps every step onto a flowchart box, and never goes back into the loop once final starts (§4.5, §9.2.3)", () => {
    expect(LOOP_BOXES.map((b) => b.id)).toEqual(["init", "check", "move", "execute", "exit", "final"]);
    const boxesOf = (value: (typeof LOOP_VARIANTS)[number]["value"]) => {
      const { result } = runSchedulerLoop(value);
      return result.trace.map((_, i) => loopBoxOf(result, i));
    };
    const loopPart = (n: number[]) => n.flatMap((k) => ["move", ...Array<string>(k).fill("execute")]);
    // $finish at 22 ns: t = 0 runs four steps; 5 and 15 run five (clock, counter, NBA); 10 and 20 run two; 22 prints, then $finish, then final.
    expect(boxesOf("finish")).toEqual(["init", "execute", "execute", "execute", "execute", ...loopPart([5, 2, 5, 2, 1]), "exit", "final", "final", "final"]);
    // Blocked waiter: the check says No before final runs, and final keeps the box to the end.
    expect(boxesOf("quiet")).toEqual(["init", "execute", "execute", ...loopPart([2, 1]), "final", "final", "final"]);
    expect(boxesOf("free-clock").at(-1)).toBe("check");
    expect(boxesOf("zero-delay").every((b, i) => (i === 0 ? b === "init" : b === "execute"))).toBe(true);

    LOOP_VARIANTS.forEach(({ value }) => {
      const { result } = runSchedulerLoop(value);
      const boxes = result.trace.map((_, i) => loopBoxOf(result, i));
      const firstFinal = boxes.indexOf("final");
      const firstExit = boxes.indexOf("exit");
      if (firstFinal !== -1) expect(boxes.slice(firstFinal).every((b) => b === "final")).toBe(true);
      if (firstExit !== -1) expect(boxes.slice(firstExit).every((b) => b === "exit" || b === "final")).toBe(true);
      result.trace.forEach((s, i) => {
        if (s.region === "final") expect(boxes[i]).toBe("final");
      });
    });
  });

  it("§4.5, §9.6.1: a run without $finish passes the check (No) before its first final step", () => {
    const quiet = runSchedulerLoop("quiet").result;
    const first = quiet.trace.findIndex((s) => s.kind === "final");
    expect(loopBoxPassed(quiet, first)).toEqual({ box: "check", note: "No: every time slot is empty, so simulation ends (§9.6.1)." });
    quiet.trace.forEach((_, i) => {
      if (i !== first) expect(loopBoxPassed(quiet, i)).toBeUndefined();
    });
    // The check comes before any final step: no step after final shows the check.
    expect(quiet.trace.slice(first).some((_, k) => loopBoxOf(quiet, first + k) === "check")).toBe(false);
    expect(loopBoxNote(quiet, quiet.trace.length - 1)).toMatch(/^Run over: .*model assumption/);
    // A $finish run reaches final through the exit box, not the check.
    const fin = runSchedulerLoop("finish").result;
    fin.trace.forEach((_, i) => expect(loopBoxPassed(fin, i)).toBeUndefined());
  });
});

describe("presets", () => {
  it("draws each preset in the view its lesson uses", () => {
    expect(PRESET_VIEW).toEqual({ "severity-and-end": "lanes", "watchdog-race": "lanes", "scheduler-loop": "loop" });
  });
});
