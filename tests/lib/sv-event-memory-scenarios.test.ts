import { describe, expect, it } from "vitest";

import {
  EVENT_MEMORY_ASSUMPTIONS,
  EVENT_MEMORY_PRESETS,
  SUGGESTED_CELL_ORDER,
  TRIGGER_TIME,
  VERDICT_LABELS,
  WAIT_FORMS,
  WAITER_PASSED_TEXT,
  WAITER_STARTS,
  cellExplanation,
  cellTimeline,
  columnHint,
  eventMemoryCellKey,
  eventMemoryMatrix,
  eventMemoryScenario,
  eventMemorySource,
  lateArrivalFailures,
  matrixTakeaway,
  memorySpan,
  nextSuggestedCell,
  notifyLogText,
  orderDependentCells,
  predictionFeedback,
  runEndState,
  runEventMemoryCell,
  runTitle,
  timeStepOrder,
  type CellOutcome,
  type CellVerdict,
  type WaitForm,
  type WaiterStart,
} from "@/lib/sv-event-memory-scenarios";

const verdict = (form: WaitForm, start: WaiterStart) => runEventMemoryCell(form, start).verdict;

describe("eventMemoryScenario: the code each cell runs", () => {
  it("notifies once at 20 ns and starts the waiter at the chosen time", () => {
    const src = eventMemorySource("semaphore", 50).map((l) => l.text);
    expect(src).toContain("semaphore sem = new(0);");
    expect(src).toContain("  #20 sem.put(1);");
    expect(src).toContain("  #50 sem.get(1);");
    expect(eventMemorySource("at-event", 0).map((l) => l.text)).toContain("  @(ev);");
    expect(eventMemorySource("triggered", 20).map((l) => l.text)).toContain("  #20 wait (ev.triggered);");
    expect(eventMemorySource("flag", 50).map((l) => l.text)).toContain("  #50 wait (flag);");
    expect(eventMemorySource("flag", 0).map((l) => l.text)[0]).toMatch(/^bit flag;/);
  });

  it("returns the same scenario object for the same cell", () => {
    expect(eventMemoryScenario("flag", 20)).toBe(eventMemoryScenario("flag", 20));
    expect(TRIGGER_TIME).toBe(20);
  });
});

describe("the twelve cells (each pinned)", () => {
  const expected: Record<WaitForm, Record<WaiterStart, CellVerdict>> = {
    "at-event": { 0: "passes", 20: "depends", 50: "blocks" },
    triggered: { 0: "passes", 20: "passes", 50: "blocks" },
    flag: { 0: "passes", 20: "passes", 50: "passes" },
    semaphore: { 0: "passes", 20: "passes", 50: "passes" },
  };

  it("IEEE 1800-2023 §15.5.1, §15.5.2: @(ev) waiting since 0 ns is woken by -> ev at 20 ns", () => {
    expect(verdict("at-event", 0)).toBe("passes");
    expect(runEventMemoryCell("at-event", 0).runs[0].passTime).toBe(20);
  });

  it("IEEE 1800-2023 §15.5.2, §4.7: @(ev) starting at 20 ns depends on which process runs first", () => {
    const cell = runEventMemoryCell("at-event", 20);
    expect(cell.verdict).toBe("depends");
    expect(cell.runs.map((r) => r.passed).sort()).toEqual([false, true]);
    expect(cell.runs.reduce((n, r) => n + r.runCount, 0)).toBe(cell.exploration.runCount);
    const blocked = cell.runs.find((r) => !r.passed);
    expect(blocked?.result.blockedAtEnd).toEqual([{ label: "waiter", on: "@(ev)" }]);
  });

  it("IEEE 1800-2023 §15.5.2: @(ev) starting at 50 ns never sees the 20 ns trigger", () => {
    expect(verdict("at-event", 50)).toBe("blocks");
    expect(runEventMemoryCell("at-event", 50).runs[0].result.endTime).toBe(50);
  });

  it("IEEE 1800-2023 §15.5.3: wait (ev.triggered) waiting since 0 ns passes at the trigger", () => {
    expect(verdict("triggered", 0)).toBe("passes");
  });

  it("IEEE 1800-2023 §15.5.3: wait (ev.triggered) in the trigger's time step passes in every order", () => {
    const cell = runEventMemoryCell("triggered", 20);
    expect(cell.verdict).toBe("passes");
    expect(cell.runs).toHaveLength(1);
    expect(cell.exploration.runCount).toBeGreaterThan(1);
  });

  it("IEEE 1800-2023 §15.5.3: wait (ev.triggered) at 50 ns blocks: the triggered state cleared when time advanced", () => {
    expect(verdict("triggered", 50)).toBe("blocks");
    expect(runEventMemoryCell("triggered", 50).runs[0].result.blockedAtEnd[0]?.on).toBe("wait (ev.triggered)");
  });

  it("IEEE 1800-2023 §9.4.3: wait (flag) waiting since 0 ns passes when flag becomes 1", () => {
    expect(verdict("flag", 0)).toBe("passes");
  });

  it("IEEE 1800-2023 §9.4.3, §4.7: wait (flag) at 20 ns passes in every order", () => {
    expect(verdict("flag", 20)).toBe("passes");
    expect(runEventMemoryCell("flag", 20).runs).toHaveLength(1);
  });

  it("IEEE 1800-2023 §9.4.3: wait (flag) at 50 ns passes at once because flag is already 1", () => {
    expect(verdict("flag", 50)).toBe("passes");
    expect(runEventMemoryCell("flag", 50).runs[0].passTime).toBe(50);
  });

  it("IEEE 1800-2023 §15.3.2, §15.3.3: sem.get(1) waiting since 0 ns is woken by put(1) at 20 ns", () => {
    expect(verdict("semaphore", 0)).toBe("passes");
    expect(runEventMemoryCell("semaphore", 0).runs[0].passTime).toBe(20);
  });

  it("IEEE 1800-2023 §15.3.1 to §15.3.3, §4.7: sem.get(1) at 20 ns passes in every order", () => {
    expect(verdict("semaphore", 20)).toBe("passes");
    expect(runEventMemoryCell("semaphore", 20).runs).toHaveLength(1);
  });

  it("IEEE 1800-2023 §15.3.1, §15.3.3: sem.get(1) at 50 ns takes the key banked at 20 ns", () => {
    expect(verdict("semaphore", 50)).toBe("passes");
    const run = runEventMemoryCell("semaphore", 50).runs[0];
    expect(run.passTime).toBe(50);
    expect(run.result.finalSemaphores.sem.keys).toBe(0);
  });

  it("the whole matrix matches the pinned table, row by row", () => {
    const matrix = eventMemoryMatrix();
    expect(matrix).toHaveLength(WAIT_FORMS.length);
    matrix.forEach((row, ri) => {
      expect(row).toHaveLength(WAITER_STARTS.length);
      row.forEach((cell, ci) => {
        expect(cell.form).toBe(WAIT_FORMS[ri]);
        expect(cell.waiterStart).toBe(WAITER_STARTS[ci]);
        expect(cell.verdict).toBe(expected[cell.form][cell.waiterStart]);
        expect(cell.exploration.capped).toBeFalsy();
      });
    });
  });

  it("every passing run prints the waiter line, and reset_gen always prints its notification at 20 ns", () => {
    eventMemoryMatrix()
      .flat()
      .forEach((cell) =>
        cell.runs.forEach((run) => {
          expect(run.result.log.find((l) => l.label === "reset_gen")).toMatchObject({ time: TRIGGER_TIME, text: notifyLogText(cell.form) });
          expect(run.passed).toBe(run.result.log.some((l) => l.text === WAITER_PASSED_TEXT));
          expect(run.passed).toBe(run.result.blockedAtEnd.length === 0);
        }),
      );
  });
});

describe("notification memory read from the trace", () => {
  it("IEEE 1800-2023 §15.5.1: -> ev is instantaneous", () => {
    const span = memorySpan("at-event", runEventMemoryCell("at-event", 50).runs[0].result);
    expect(span).toMatchObject({ kind: "instant", from: 20, until: 20 });
  });

  it("IEEE 1800-2023 §15.5.3: ev.triggered holds only for the 20 ns time step", () => {
    const span = memorySpan("triggered", runEventMemoryCell("triggered", 50).runs[0].result);
    expect(span).toMatchObject({ kind: "time-step", from: 20, until: 20 });
  });

  it("IEEE 1800-2023 §9.4.3: flag stays 1 to the end of the run", () => {
    const span = memorySpan("flag", runEventMemoryCell("flag", 50).runs[0].result);
    expect(span).toMatchObject({ kind: "level", from: 20 });
    expect(span.until).toBeUndefined();
    expect(span.text).toContain("before the run ends at 50 ns");
  });

  it("IEEE 1800-2023 §15.3.1, §15.3.3: the key is banked from 20 ns until the get at 50 ns", () => {
    const span = memorySpan("semaphore", runEventMemoryCell("semaphore", 50).runs[0].result);
    expect(span).toMatchObject({ kind: "banked", from: 20, until: 50 });
  });

  it("IEEE 1800-2023 §15.3.2: a key put while a get waits goes straight to it", () => {
    const span = memorySpan("semaphore", runEventMemoryCell("semaphore", 0).runs[0].result);
    expect(span.text).toMatch(/never holds it/);
  });

  it("each span carries a lane label that tells the forms apart in the 20 ns column", () => {
    const at = memorySpan("at-event", runEventMemoryCell("at-event", 20).runs[0].result);
    const trig = memorySpan("triggered", runEventMemoryCell("triggered", 20).runs[0].result);
    expect(at.label).toBe("-> ev is an instant; @(ev) reads no stored state");
    // §15.5.3: the same trigger does set ev.triggered for the time step, so the @(ev) label must not claim nothing is stored.
    expect(at.label).not.toMatch(/stores nothing/);
    expect(trig.label).toBe("ev.triggered true for the rest of the 20 ns time step");
    expect(memorySpan("flag", runEventMemoryCell("flag", 0).runs[0].result).label).toBe("flag = 1 from 20 ns to the end of the run");
    expect(memorySpan("semaphore", runEventMemoryCell("semaphore", 0).runs[0].result).label).toBe("key handed straight to the get()");
    expect(memorySpan("semaphore", runEventMemoryCell("semaphore", 20).runs[0].result).label).toBe("1 key, taken in the 20 ns time step");
    expect(memorySpan("semaphore", runEventMemoryCell("semaphore", 50).runs[0].result).label).toBe("1 key, 20 to 50 ns");
  });

  it("IEEE 1800-2023 §15.5.2, §15.5.3, §4.7: inside the 20 ns time step, the order of steps shows why @(ev) can miss and triggered cannot", () => {
    const at = runEventMemoryCell("at-event", 20);
    const blocked = at.runs.find((r) => !r.passed);
    const passed = at.runs.find((r) => r.passed);
    expect(timeStepOrder(blocked!.result)).toEqual(["reset_gen triggers ev. Nobody is waiting on it yet.", "waiter blocks on @(ev)."]);
    expect(timeStepOrder(passed!.result)).toEqual(["waiter blocks on @(ev).", "reset_gen triggers ev. It wakes waiter."]);
    const trig = runEventMemoryCell("triggered", 20).runs[0];
    expect(timeStepOrder(trig.result)).toEqual(["reset_gen triggers ev. Nobody is waiting on it yet.", "waiter passes wait (ev.triggered) at once."]);
    // Steps at other times are not included.
    expect(timeStepOrder(runEventMemoryCell("flag", 50).runs[0].result).some((s) => s.includes("passes wait (flag)"))).toBe(false);
  });

  it("the timeline reads notify, pass and end times from the run", () => {
    const cell = runEventMemoryCell("triggered", 50);
    const tl = cellTimeline(cell, cell.runs[0]);
    expect(tl).toMatchObject({ notifyTime: 20, passTime: undefined, endTime: 50, stillBlocked: true, ticks: [0, 20, 50], axisEnd: 60 });
  });
});

describe("explanations come from the runs", () => {
  it("names the pass time computed by the model", () => {
    expect(cellExplanation(runEventMemoryCell("flag", 50))).toContain("at 50 ns");
    expect(cellExplanation(runEventMemoryCell("semaphore", 0))).toContain("passes at 20 ns");
  });

  it("every cell has a specific explanation with a clause, never the fallback", () => {
    eventMemoryMatrix()
      .flat()
      .forEach((cell) => {
        const text = cellExplanation(cell);
        expect(text).not.toMatch(/^Unexpected/);
        expect(text).toMatch(/§\d/);
      });
  });

  it("IEEE 1800-2023 §4.7: the order-dependent cell says the order is open", () => {
    expect(cellExplanation(runEventMemoryCell("at-event", 20))).toContain("§4.7");
  });

  it("the right prediction gets the cell's explanation; each wrong one gets its own diagnosis", () => {
    eventMemoryMatrix()
      .flat()
      .forEach((cell) => {
        const choices: CellVerdict[] = ["passes", "blocks", "depends"];
        choices.forEach((choice) => {
          const text = predictionFeedback(cell, choice);
          if (choice === cell.verdict) expect(text).toBe(cellExplanation(cell));
          else expect(text).not.toBe(cellExplanation(cell));
          expect(text.length).toBeGreaterThan(20);
        });
      });
  });

  it("run titles and end states describe the run", () => {
    const cell = runEventMemoryCell("at-event", 20);
    const titles = cell.runs.map(runTitle).sort();
    expect(titles).toEqual(["Waiter passes at 20 ns", "Waiter stays blocked"]);
    expect(cell.runs.map(runEndState)).toContain("waiter blocked in @(ev)");
  });
});

describe("the takeaway from the completed matrix", () => {
  it("only the event forms fail a late arrival", () => {
    expect(lateArrivalFailures()).toEqual(["at-event", "triggered"]);
  });

  it("only @(ev) at 20 ns depends on order", () => {
    expect(orderDependentCells().map((c) => `${c.form}:${c.waiterStart}`)).toEqual(["at-event:20"]);
  });

  it("is generated from the matrix", () => {
    const text = matrixTakeaway();
    expect(text).toContain("@(ev) and wait (ev.triggered)");
    expect(text).toContain("wait (flag) and sem.get(1)");
    expect(text).toContain("@(ev) at 20 ns");
  });
});

describe("presets", () => {
  it("each preset opens a real cell", () => {
    Object.values(EVENT_MEMORY_PRESETS).forEach((p) => {
      expect(WAIT_FORMS).toContain(p.form);
      expect(WAITER_STARTS).toContain(p.waiterStart);
    });
  });

  it("names the lesson headings it is embedded under", () => {
    expect(EVENT_MEMORY_PRESETS["late-arrival"].section).toBe("Push Further > Expert: When a signal must last, use a level, not an event");
    expect(EVENT_MEMORY_PRESETS["named-event-mistakes"].section).toBe("Build Your Mental Model > Named events: announce that something happened");
  });
});

describe("the suggested path through the matrix", () => {
  it("covers each of the twelve cells exactly once, the order-dependent cell first", () => {
    const keys = SUGGESTED_CELL_ORDER.map((c) => eventMemoryCellKey(c.form, c.waiterStart));
    expect(new Set(keys).size).toBe(12);
    WAIT_FORMS.forEach((f) => WAITER_STARTS.forEach((st) => expect(keys).toContain(eventMemoryCellKey(f, st))));
    const first = SUGGESTED_CELL_ORDER[0];
    expect(runEventMemoryCell(first.form, first.waiterStart).verdict).toBe("depends");
  });

  it("suggests the first cell not yet revealed, and nothing when all are", () => {
    expect(nextSuggestedCell([])).toMatchObject({ form: "at-event", waiterStart: 20, label: "@(ev), starts at 20 ns (same time step)" });
    expect(nextSuggestedCell(["at-event:20"])).toMatchObject({ form: "triggered", waiterStart: 20 });
    expect(nextSuggestedCell(["at-event:20", "triggered:20"])).toMatchObject({ form: "at-event", waiterStart: 50 });
    expect(nextSuggestedCell(SUGGESTED_CELL_ORDER.map((c) => eventMemoryCellKey(c.form, c.waiterStart)))).toBeUndefined();
  });

  it("never gives the answer away: hints come from the times only", () => {
    expect(columnHint(0)).toBe("the waiter is already waiting when the notification runs at 20 ns");
    expect(columnHint(20)).toBe("the waiter and the notification are ready in the same 20 ns time step");
    expect(columnHint(50)).toBe("the waiter arrives 30 ns after the only notification");
    SUGGESTED_CELL_ORDER.forEach((_, i) => {
      const s = nextSuggestedCell(SUGGESTED_CELL_ORDER.slice(0, i).map((c) => eventMemoryCellKey(c.form, c.waiterStart)));
      Object.values(VERDICT_LABELS).forEach((v) => {
        expect(`${s?.label} ${s?.hint}`.toLowerCase()).not.toContain(v.toLowerCase());
      });
    });
  });
});

describe("polish: pass times, spans and wording pinned per cell", () => {
  it("IEEE 1800-2023 §15.5.3: wait (ev.triggered) from 0 ns and at 20 ns passes at 20 ns, with the time-step span", () => {
    ([0, 20] as const).forEach((start) => {
      const cell = runEventMemoryCell("triggered", start);
      cell.runs.forEach((r) => expect(r.passTime).toBe(20));
      expect(memorySpan("triggered", cell.runs[0].result)).toMatchObject({ kind: "time-step", from: 20, until: 20 });
    });
  });

  it("IEEE 1800-2023 §9.4.3: wait (flag) from 0 ns and at 20 ns passes at 20 ns; at 50 ns it passes at once", () => {
    expect(runEventMemoryCell("flag", 0).runs[0].passTime).toBe(20);
    runEventMemoryCell("flag", 20).runs.forEach((r) => expect(r.passTime).toBe(20));
    expect(cellExplanation(runEventMemoryCell("flag", 50))).toContain("passes at once");
  });

  it("IEEE 1800-2023 §9.4.3: when the run ends at the time flag is set, the span text does not name an end of run", () => {
    const span = memorySpan("flag", runEventMemoryCell("flag", 0).runs[0].result);
    expect(span.text).toBe("flag becomes 1 at 20 ns and stays 1; nothing clears it (§9.4.3).");
  });

  it("IEEE 1800-2023 §15.3.1 to §15.3.3: sem.get(1) from 0 ns and at 20 ns passes at 20 ns and leaves no key", () => {
    ([0, 20] as const).forEach((start) => {
      const run = runEventMemoryCell("semaphore", start).runs[0];
      expect(run.passTime).toBe(20);
      expect(run.result.finalSemaphores.sem.keys).toBe(0);
    });
  });

  it("IEEE 1800-2023 §15.3.1: in the 20 ns cell the span says it shows the put-first order", () => {
    const span = memorySpan("semaphore", runEventMemoryCell("semaphore", 20).runs[0].result);
    expect(span).toMatchObject({ kind: "banked", from: 20, until: 20 });
    expect(span.text).toMatch(/^In the order shown, put\(1\) runs first/);
  });

  it("IEEE 1800-2023 §15.5.1, §15.5.3: the @(ev) span calls the trigger instantaneous and cites both clauses", () => {
    const span = memorySpan("at-event", runEventMemoryCell("at-event", 20).runs[0].result);
    expect(span.text).toMatch(/lasts no time/);
    expect(span.text).toContain("(§15.5.1, §15.5.3)");
  });

  it("IEEE 1800-2023 §15.5.2: the @(ev) explanations keep before and after the right way round", () => {
    expect(cellExplanation(runEventMemoryCell("at-event", 20))).toContain("If the waiter reaches @(ev) first, -> ev wakes it");
    expect(cellExplanation(runEventMemoryCell("at-event", 20))).toContain("if -> ev runs first, the waiter arrives after the trigger and stays blocked");
    expect(cellExplanation(runEventMemoryCell("at-event", 50))).toContain("reaches @(ev) at 50 ns, after the only trigger at 20 ns");
  });

  it("IEEE 1800-2023 §15.5.3: a wrong 'passes' for wait (ev.triggered) at 50 ns names the time step and the late time", () => {
    expect(predictionFeedback(runEventMemoryCell("triggered", 50), "passes")).toBe(
      "wait (ev.triggered) cannot see a notification that is already over. ev.triggered was true only during the 20 ns time step; at 50 ns it is false (§15.5.3).",
    );
  });

  it("IEEE 1800-2023 §4.7: wrong predictions on the order-dependent cell cite §4.7", () => {
    const cell = runEventMemoryCell("at-event", 20);
    expect(predictionFeedback(cell, "passes")).toContain("§4.7");
    expect(predictionFeedback(cell, "blocks")).toContain("§4.7");
  });

  it("the assumptions cite §4.7 and §9.6.1 and do not claim the standard reports blocked processes", () => {
    const all = EVENT_MEMORY_ASSUMPTIONS.join(" ");
    expect(all).toContain("§4.7");
    expect(all).toContain("§9.6.1");
    expect(all).not.toMatch(/standard reports nothing/);
    expect(all).toContain("does not require a simulator to report");
  });

  it("the takeaway uses the plural when more than one cell depends on order", () => {
    const real = eventMemoryMatrix();
    const dep = real.flat().find((c) => c.verdict === "depends") as CellOutcome;
    const twice: CellOutcome[][] = real.map((row) => row.map((c) => (c.form === "triggered" && c.waiterStart === 20 ? { ...c, form: dep.form, verdict: "depends" as const } : c)));
    const text = matrixTakeaway(twice);
    expect(text).toContain("The cells that depend on order are");
    expect(text).not.toContain("The only cell");
    expect(matrixTakeaway(real)).toContain("The only cell that depends on order is @(ev) at 20 ns");
  });
});
