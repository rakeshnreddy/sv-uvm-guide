import { describe, expect, it } from "vitest";

import {
  DEBUG_FIXES,
  DEBUG_SUSPECTS,
  DEFAULT_MONITOR_CONFIG,
  FMONITOR_FLAG_READING,
  NOT_DEFINED_ID,
  SILENT_ID,
  FINISH_TIME,
  SECOND_CALL_TIMES,
  STIMULUS,
  TOGGLE_TIMES,
  configProblems,
  formatLine,
  gradeFix,
  gradeSlot,
  listsFor,
  missedChanges,
  monitorSource,
  runMonitor,
  slotAnswerId,
  slotOptions,
  type MonitorConfig,
} from "@/lib/sv-monitor-model";

const cfg = (over: Partial<MonitorConfig>): MonitorConfig => ({ ...DEFAULT_MONITOR_CONFIG, ...over });
const slot = (config: MonitorConfig, time: number) => {
  const s = runMonitor(config).slots.find((x) => x.time === time);
  if (!s) throw new Error(`no slot at ${time}`);
  return s;
};
const texts = (config: MonitorConfig) => runMonitor(config).log.map((l) => (l.channel === "file" ? `file: ${l.text}` : l.text));
const codes = (config: MonitorConfig, time: number) => slot(config, time).notes.map((n) => n.code);

describe("sv-monitor-model · the lesson trace (§21.2.3)", () => {
  it("§21.2.3: the lesson bench logs t=0 a=0, t=10 a=1, t=20 a=3, t=40 b=5, t=50 b=6 (debug case 1's log)", () => {
    expect(texts(DEFAULT_MONITOR_CONFIG)).toEqual(["t=0 a=0", "t=10 a=1", "t=20 a=3", "t=40 b=5", "t=50 b=6"]);
  });

  it("§20.3.1 example: the $monitor call prints a first line in its own slot, labelled as the example's behaviour", () => {
    const s = slot(DEFAULT_MONITOR_CONFIG, 0);
    expect(s.lines[0]).toMatchObject({ cause: "first-line", timing: "postponed" });
    const note = s.notes.find((n) => n.code === "first-line");
    expect(note?.sentence).toContain("as shown in the §20.3.1 example");
    expect(note?.sentence).toContain("§21.2.3 itself does not state it");
    // The region of the first line is the lab's placement, from §4.4.2.9's rule for $monitor events.
    expect(note?.sentence).toContain("The lab places that line in the Postponed region");
  });

  it("§21.2.3: two changes of a in one slot give one line with the new value", () => {
    const s = slot(DEFAULT_MONITOR_CONFIG, 20);
    expect(s.lines.map((l) => l.text)).toEqual(["t=20 a=3"]);
    expect(s.changes[0].values).toEqual([2, 3]);
    expect(codes(DEFAULT_MONITOR_CONFIG, 20)).toContain("collapsed");
    expect(s.notes.find((n) => n.code === "collapsed")?.sentence).toContain("displayed once, at the end of the time step (§21.2.3)");
  });

  it("§21.2.3: at 30 ns b is not watched and $time does not count, so nothing prints", () => {
    const s = slot(DEFAULT_MONITOR_CONFIG, 30);
    expect(s.lines).toEqual([]);
    expect(codes(DEFAULT_MONITOR_CONFIG, 30)).toEqual(["not-watched", "time-not-counted"]);
  });

  it("§4.4.2.9: change lines print at the end of the slot, in the Postponed region", () => {
    const s = slot(DEFAULT_MONITOR_CONFIG, 10);
    expect(s.lines[0]).toMatchObject({ timing: "postponed", cause: "change" });
    expect(s.notes[0].sentence).toContain("§4.4.2.9");
  });

  it("§21.2.3: a new $monitor call replaces the list (§21.2.3 asks for no warning); a's change at 50 ns is lost", () => {
    expect(codes(DEFAULT_MONITOR_CONFIG, 40)).toEqual(["replaces", "first-line"]);
    const at50 = slot(DEFAULT_MONITOR_CONFIG, 50);
    expect(at50.lines.map((l) => l.text)).toEqual(["t=50 b=6"]);
    expect(at50.notes.find((n) => n.code === "replaced-earlier")?.sentence).toContain("replaced at 40 ns");
    const run = runMonitor(DEFAULT_MONITOR_CONFIG);
    expect(run.bands.map((b) => [b.listId, b.from, b.to])).toEqual([
      ["list1", 0, 40],
      ["list2", 40, 60],
    ]);
  });

  it("§21.2.3: $finish at 60 ns: nothing watched changed, nothing prints", () => {
    expect(slot(DEFAULT_MONITOR_CONFIG, 60).lines).toEqual([]);
    expect(codes(DEFAULT_MONITOR_CONFIG, 60)).toEqual(["finish"]);
  });

  it("the printed values come from the format model's %0d", () => {
    const [list1] = listsFor(DEFAULT_MONITOR_CONFIG);
    expect(formatLine(list1, 1234, { a: 15, b: 0 })).toBe("t=1234 a=15");
  });
});

describe("sv-monitor-model · controls", () => {
  it("§21.2.3: adding b to the first list makes 30 ns print", () => {
    const c = cfg({ firstListHasB: true, secondCallTime: null });
    expect(texts(c)).toEqual(["t=0 a=0 b=0", "t=10 a=1 b=0", "t=20 a=3 b=0", "t=30 a=3 b=5", "t=50 a=4 b=6"]);
  });

  it("§21.2.3: deleting the second call keeps the first list for the whole run", () => {
    const c = cfg({ secondCallTime: null });
    expect(texts(c)).toEqual(["t=0 a=0", "t=10 a=1", "t=20 a=3", "t=50 a=4"]);
    expect(runMonitor(c).slots.map((s) => s.time)).not.toContain(40);
  });

  it("§21.2.3: moving the second call to 15 ns replaces the list earlier; a at 20 ns is lost", () => {
    const c = cfg({ secondCallTime: 15 });
    expect(texts(c)).toEqual(["t=0 a=0", "t=10 a=1", "t=15 b=0", "t=30 b=5", "t=50 b=6"]);
  });

  it("§21.2.3: $monitoroff silences changes; $monitoron prints at once, whether or not anything changed", () => {
    const c = cfg({ monitorOffTime: 5, monitorOnTime: 25 });
    expect(texts(c)).toEqual(["t=0 a=0", "t=25 a=3", "t=40 b=5", "t=50 b=6"]);
    expect(codes(c, 10)).toContain("flag-off");
    const on = slot(c, 25);
    expect(on.lines[0]).toMatchObject({ timing: "immediate", cause: "monitoron" });
    expect(runMonitor(c).offRanges).toEqual([{ from: 5, to: 25 }]);
  });

  it("§21.2.3: $monitoron resumes the most recent $monitor list, not a replaced one", () => {
    const c = cfg({ monitorOnTime: 45 });
    expect(slot(c, 45).lines.map((l) => l.text)).toEqual(["t=45 b=5"]);
  });

  it("§21.2.3: the $monitoron note matches the flag's state", () => {
    const alreadyOn = slot(cfg({ monitorOnTime: 45 }), 45).notes.find((n) => n.code === "monitoron")?.sentence;
    expect(alreadyOn).toContain("The flag is already on; $monitoron still prints");
    const wasOff = slot(cfg({ monitorOffTime: 5, monitorOnTime: 25 }), 25).notes.find((n) => n.code === "monitoron")?.sentence;
    expect(wasOff).toContain("$monitoron turns the flag on");
  });

  it("§21.2.3: a $monitoroff with no later $monitoron stays off to the end; a $monitoron before it does not open a range", () => {
    expect(runMonitor(cfg({ monitorOffTime: 55 })).offRanges).toEqual([{ from: 55, to: 60 }]);
    expect(runMonitor(cfg({ monitorOnTime: 15, monitorOffTime: 35 })).offRanges).toEqual([{ from: 35, to: 60 }]);
  });

  it("§21.2.3 is silent on a $monitor call made while the flag is off: the first line is not defined", () => {
    const c = cfg({ monitorOffTime: 35 });
    const s = slot(c, 40);
    expect(s.lines[0].timing).toBe("not-defined");
    expect(slotAnswerId(s)).toBe(NOT_DEFINED_ID);
    expect(s.notes.map((n) => n.code)).toContain("call-while-off");
    expect(missedChanges(runMonitor(c)).map((m) => m.time)).toContain(50);
  });

  it("§21.3.2: an $fmonitor runs beside the $monitor list, and $monitoroff does not stop it", () => {
    const c = cfg({ secondTask: "$fmonitor", monitorOffTime: 45 });
    const run = runMonitor(c);
    expect(texts(c)).toEqual(["t=0 a=0", "t=10 a=1", "t=20 a=3", "file: t=40 b=5", "file: t=50 b=6"]);
    expect(codes(c, 50)).toContain("fmonitor-ignores-flag");
    // §21.3.2 only says there is no on/off counterpart: the note is worded as the lab's reading.
    expect(slot(c, 50).notes.find((n) => n.code === "fmonitor-ignores-flag")?.sentence).toBe(FMONITOR_FLAG_READING);
    expect(FMONITOR_FLAG_READING).toContain("the lab reads $monitoroff as affecting only $monitor");
    expect(run.bands.map((b) => b.label)).toEqual(["$monitor: $time, a", "$fmonitor to b.log: $time, b"]);
    expect(codes(c, 40)).toContain("fmonitor-added");
  });

  it("§21.3.2: with $fmonitor both lists print at 50 ns", () => {
    expect(slot(cfg({ secondTask: "$fmonitor" }), 50).lines.map((l) => `${l.channel}:${l.text}`)).toEqual(["stdout:t=50 a=4", "file:t=50 b=6"]);
  });

  it("config problems: added statements stay in quiet slots and never share one", () => {
    expect(configProblems(DEFAULT_MONITOR_CONFIG)).toEqual([]);
    expect(configProblems(cfg({ secondCallTime: 20 }))[0]).toContain("no assignment");
    expect(configProblems(cfg({ monitorOffTime: 10 }))[0]).toContain("$monitoroff");
    expect(configProblems(cfg({ monitorOffTime: 15, monitorOnTime: 15 }))[0]).toContain("share a slot");
  });

  it("the slots offered for added statements avoid every assignment and $finish, so no order inside a slot is assumed", () => {
    const busy = new Set<number>([...STIMULUS.map((s) => s.time), FINISH_TIME]);
    expect(SECOND_CALL_TIMES.filter((t) => busy.has(t))).toEqual([]);
    expect(TOGGLE_TIMES.filter((t) => busy.has(t))).toEqual([]);
  });
});

describe("sv-monitor-model · source", () => {
  it("generates the lesson's bench, with delays recomputed from the statement times", () => {
    expect(monitorSource(DEFAULT_MONITOR_CONFIG).map((l) => l.text.trim())).toEqual([
      "`timescale 1ns/1ns",
      "module tb_top;",
      "logic [3:0] a, b;",
      "initial begin",
      "a = 0;",
      "b = 0;",
      '$monitor("t=%0d a=%0d", $time, a);',
      "#10 a = 1;",
      "#10 begin a = 2; a = 3; end   // two changes in one time slot",
      "#10 b = 5;",
      '#10 $monitor("t=%0d b=%0d", $time, b);',
      "#10 begin a = 4; b = 6; end",
      "#10 $finish;",
      "end",
      "endmodule",
    ]);
  });

  it("inserted statements change the delays around them", () => {
    const lines = monitorSource(cfg({ secondCallTime: null, monitorOffTime: 5 })).map((l) => l.text.trim());
    expect(lines).toContain("#5 $monitoroff;");
    expect(lines).toContain("#5 a = 1;");
    expect(lines).toContain("#20 begin a = 4; b = 6; end");
    const f = monitorSource(cfg({ secondTask: "$fmonitor" })).map((l) => l.text.trim());
    // §21.3.1: $fopen with no type argument returns a multichannel descriptor, so the variable is named mcd.
    expect(f).toContain("integer mcd;");
    expect(f).toContain('mcd = $fopen("b.log");');
    expect(f).toContain('#10 $fmonitor(mcd, "t=%0d b=%0d", $time, b);');
  });
});

describe("sv-monitor-model · predictions", () => {
  it("each slot offers the answer, silence and misconception lines, at most four", () => {
    const run = runMonitor(DEFAULT_MONITOR_CONFIG);
    run.slots.forEach((s) => {
      const options = slotOptions(run, s.time);
      expect(options.length).toBeLessThanOrEqual(4);
      expect(options.filter((o) => o.correct)).toHaveLength(1);
      expect(options.some((o) => o.id === SILENT_ID)).toBe(true);
    });
    expect(slotOptions(run, 20).map((o) => o.label)).toContain("t=20 a=2");
    // The two-write misconception survives the four-option cut.
    expect(slotOptions(run, 20).map((o) => o.label)).toContain("t=20 a=2, then t=20 a=3");
    expect(slotOptions(run, 30).find((o) => o.correct)?.label).toBe("Silent");
  });

  it("every valid bench gives each slot one correct option, a Silent option and at most four", () => {
    const times = (list: readonly number[]) => [null, ...list];
    let count = 0;
    times(SECOND_CALL_TIMES).forEach((secondCallTime) =>
      (["$monitor", "$fmonitor"] as const).forEach((secondTask) =>
        [false, true].forEach((firstListHasB) =>
          times(TOGGLE_TIMES).forEach((monitorOffTime) =>
            times(TOGGLE_TIMES).forEach((monitorOnTime) => {
              const c: MonitorConfig = { secondCallTime, secondTask, firstListHasB, monitorOffTime, monitorOnTime };
              if (secondCallTime === null && secondTask === "$fmonitor") return;
              if (configProblems(c).length) return;
              count += 1;
              const run = runMonitor(c);
              run.slots.forEach((s) => {
                const options = slotOptions(run, s.time);
                expect(options.length).toBeLessThanOrEqual(4);
                expect(options.filter((o) => o.correct)).toHaveLength(1);
                expect(options.some((o) => o.id === SILENT_ID)).toBe(true);
                expect(gradeSlot(run, s.time, slotAnswerId(s)).correct).toBe(true);
              });
            }),
          ),
        ),
      ),
    );
    expect(count).toBeGreaterThan(800);
  });

  it("§4.4.2.9, §21.3.2: lines on stdout and in the file are joined with 'and', since no order between them is defined", () => {
    const run = runMonitor(cfg({ secondTask: "$fmonitor" }));
    const answer = slotOptions(run, 50).find((o) => o.correct);
    expect(answer?.label).toBe("t=50 a=4 and b.log: t=50 b=6");
  });

  it("grading explains with the slot's notes", () => {
    const run = runMonitor(DEFAULT_MONITOR_CONFIG);
    const g = gradeSlot(run, 30, "t=30 b=5");
    expect(g.correct).toBe(false);
    expect(g.sentence).toContain("$time");
    expect(gradeSlot(run, 30, SILENT_ID).correct).toBe(true);
  });
});

describe("sv-monitor-model · debug case 1", () => {
  it("the suspects name lines of the generated source, and the culprit is the call that replaces the list", () => {
    const keys = monitorSource(DEFAULT_MONITOR_CONFIG).map((l) => l.key);
    DEBUG_SUSPECTS.forEach((s) => expect(keys).toContain(s.sourceKey));
    const culprit = DEBUG_SUSPECTS.filter((s) => s.verdict === "culprit");
    expect(culprit.map((s) => s.sourceKey)).toEqual(["second-call"]);
    expect(culprit[0].feedback).toContain("nothing in §21.2.3 asks for a warning");
    expect(culprit[0].feedback).toContain("switch from a= to b= at 40 ns");
    expect(runMonitor(DEFAULT_MONITOR_CONFIG).slots.find((s) => s.notes.some((n) => n.code === "replaces"))?.time).toBe(40);
  });

  it("the suspects' factual claims hold on the default run", () => {
    const run = runMonitor(DEFAULT_MONITOR_CONFIG);
    const at = (t: number) => run.log.filter((l) => l.time === t).map((l) => l.text);
    // first-call: "printed a's changes at 10 and 20 ns"; assign-5: "Nothing printed at 30 ns".
    expect(at(10)).toEqual(["t=10 a=1"]);
    expect(at(20)).toEqual(["t=20 a=3"]);
    expect(at(30)).toEqual([]);
    // The culprit's trace: the lines switch from a= to b= at 40 ns.
    expect(at(40)).toEqual(["t=40 b=5"]);
  });

  it("the case: a=4 at 50 ns is missed by the lesson bench", () => {
    expect(missedChanges(runMonitor(DEFAULT_MONITOR_CONFIG))).toEqual([
      { time: 30, signal: "b", value: 5 },
      { time: 50, signal: "a", value: 4 },
    ]);
  });

  const verdict = (id: string) => gradeFix(DEBUG_FIXES.find((f) => f.id === id) as (typeof DEBUG_FIXES)[number]);

  it("fixes are graded by rerunning the model against the case: a=4 at 50 ns logged, nothing the original log reported lost", () => {
    expect(verdict("one-list").verdict).toBe("fixed");
    expect(verdict("one-list").gapNote).toBeNull();
    expect(verdict("one-list").sentence).toBe("Every change of a and b now reaches a log line in its own slot.");
    expect(verdict("monitoron").verdict).toBe("not-fixed");
    expect(verdict("monitoron").sentence).toContain("a=4 at 50 ns is still not logged");
    expect(verdict("monitoron").run.log.find((l) => l.time === 45)?.text).toBe("t=45 b=5");
  });

  it("the lesson's $fmonitor fix (§21.3.2) fixes the case; the 30 ns gap is a separate note", () => {
    const g = verdict("fmonitor");
    expect(g.verdict).toBe("fixed");
    expect(g.lost).toEqual([]);
    expect(g.alreadyMissed).toEqual([{ time: 30, signal: "b", value: 5 }]);
    expect(g.sentence).toBe("a=4 at 50 ns is logged now, and every change the original log reported is still reported.");
    expect(g.sentence).not.toContain("b=5");
    expect(g.gapNote).toBe("b=5 at 30 ns was not logged before this fix either: the list active then, $monitor($time, a), does not watch b.");
  });

  it("moving the call to 55 ns is partial: it loses b=6 at 50 ns, which the original log reported", () => {
    const g = verdict("move-later");
    expect(g.verdict).toBe("partial");
    expect(g.lost).toEqual([{ time: 50, signal: "b", value: 6 }]);
    expect(g.missed).toEqual([
      { time: 30, signal: "b", value: 5 },
      { time: 50, signal: "b", value: 6 },
    ]);
    expect(g.sentence).toBe("a=4 at 50 ns is logged again, but b=6 at 50 ns, which the original log reported, is no longer logged.");
    expect(g.gapNote).toContain("b=5 at 30 ns");
  });
});
