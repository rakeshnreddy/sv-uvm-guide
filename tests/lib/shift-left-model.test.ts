import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { COST_STAGES, costRatio, formatMultiplier } from "@/lib/bug-cost-model";
import {
  ACTIVITIES,
  ALL_ACTIVITIES,
  BUGS,
  PRESETS,
  PUSH_FURTHER,
  TIMELINE,
  activity,
  bug,
  configKey,
  findPreset,
  joinAnd,
  laneMultiplierText,
  lateOnlyBugs,
  lateStageNote,
  movedCaveat,
  pastTapeOutText,
  placeBug,
  predictionFeedback,
  predictionOptions,
  revealOrder,
  runTimeline,
  summarizeRun,
  timelineStage,
  type ActivityId,
  type BugId,
} from "@/lib/shift-left-model";

const lesson = readFileSync(join(process.cwd(), "content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx"), "utf8");

/** The lesson's shift-left table, from its header row to the figure after it. */
const shiftLeftTable = (() => {
  const start = lesson.indexOf("| Activity | When it runs | What it catches early |");
  return lesson.slice(start, lesson.indexOf("<figure>", start));
})();

/** Quiz question 10: the bug-kind / earliest-activity pairing question. */
const quizQ10 = (() => {
  const start = lesson.indexOf("Which pairing of a bug kind with the earliest activity that reliably catches it is right?");
  return lesson.slice(start, lesson.indexOf("explanation:", start));
})();

const scheduleSlipReveal = (() => {
  const start = lesson.indexOf("drops lint and block simulation");
  return lesson.slice(start, lesson.indexOf("</details>", start));
})();

const without = (...off: ActivityId[]) => ALL_ACTIVITIES.filter((a) => !off.includes(a));

/** Every subset of the five activities (32). */
const allSubsets = (): ActivityId[][] =>
  Array.from({ length: 1 << ALL_ACTIVITIES.length }, (_, mask) => ALL_ACTIVITIES.filter((_, i) => mask & (1 << i)));

describe("F1A > Shift left: the activities match the lesson's shift-left table", () => {
  it("the table exists and has one row per activity, with the model's 'When it runs' text", () => {
    expect(shiftLeftTable.length).toBeGreaterThan(0);
    for (const a of ACTIVITIES) {
      expect(shiftLeftTable, a.id).toContain(a.lessonRow);
      expect(a.lessonRow, a.id).toContain(`| ${a.when} |`);
    }
  });

  it("activities sit on the timeline where the table runs them: planning at spec, lint/block sim/formal in RTL, emulation before tape-out", () => {
    expect(ACTIVITIES.map((a) => [a.id, a.stage])).toEqual([
      ["planning", "spec"],
      ["lint", "rtl"],
      ["block-sim", "rtl"],
      ["block-formal", "rtl"],
      ["emulation", "integration"],
    ]);
  });

  it("the merged fifth toggle follows the lesson: bugs lint and block sim miss move 'to full-chip simulation or emulation'", () => {
    expect(scheduleSlipReveal).toContain("to full-chip simulation or emulation");
    expect(activity("emulation").label).toBe("Full-chip simulation or emulation");
  });
});

describe("F1A > Shift left: each bug kind's earliest catcher is pinned to the lesson table and quiz question 10", () => {
  const expected: Record<BugId, ActivityId> = {
    "spec-contradiction": "planning",
    "latch-width": "lint",
    "block-functional": "block-sim",
    "arbiter-corner": "block-formal",
    "boot-hang": "emulation",
    "block-interaction": "emulation",
  };

  it("six tokens, numbered 1 to 6, each with the earliest catcher the lesson gives", () => {
    expect(BUGS.map((b) => b.glyph)).toEqual(["1", "2", "3", "4", "5", "6"]);
    for (const b of BUGS) expect(b.catchers[0], b.id).toBe(expected[b.id]);
  });

  it("each table-derived kind's evidence sits in the earliest catcher's own table row", () => {
    const rowOf = (a: ActivityId) => {
      const row = activity(a).lessonRow;
      const start = shiftLeftTable.indexOf(row);
      return shiftLeftTable.slice(start, shiftLeftTable.indexOf("\n", start));
    };
    for (const id of ["spec-contradiction", "latch-width", "block-functional", "arbiter-corner", "boot-hang"] as BugId[]) {
      expect(rowOf(bug(id).catchers[0]), id).toContain(bug(id).lessonEvidence);
    }
  });

  it("block interactions come from the pitfall paragraph: the late stages find 'interactions between blocks'", () => {
    expect(lesson).toContain("shifting left does not remove the late stages");
    expect(lesson).toContain(bug("block-interaction").lessonEvidence);
  });

  it("quiz question 10 pairs the same kinds with the same activities", () => {
    expect(quizQ10).toContain("A spec that contradicts itself");
    expect(quizQ10).toContain("Verification planning at spec review exposes it");
    expect(quizQ10).toContain("An unintended latch in combinational RTL: lint the code as it is written\", correct: true");
    expect(quizQ10).toContain("Only real software exposes a boot hang, and block formal runs no software. Emulation or FPGA prototyping runs it before tape-out.");
    expect(quizQ10).toContain("Formal on the arbiter block can prove that every request is eventually granted");
  });

  it("the spec-contradiction 'missed' reason is quiz question 10's own feedback", () => {
    expect(quizQ10).toContain(bug("spec-contradiction").missedWhy!);
  });

  it("only kinds the lesson routes to full-chip sim or emulation have it as a fallback (lint and block-sim kinds)", () => {
    const withFallback = BUGS.filter((b) => b.catchers.length > 1).map((b) => b.id);
    expect(withFallback).toEqual(["latch-width", "block-functional"]);
    for (const id of withFallback) expect(bug(id).catchers).toEqual([bug(id).catchers[0], "emulation"]);
    // Every single-catcher kind says why nothing later catches it reliably.
    for (const b of BUGS.filter((x) => x.catchers.length === 1)) expect(b.missedWhy, b.id).toBeTruthy();
  });

  it("the late-only kinds are block interactions and boot hangs (pitfall: 'interactions between blocks and real software')", () => {
    expect(lateOnlyBugs().map((b) => b.id)).toEqual(["boot-hang", "block-interaction"]);
  });
});

describe("F1A > Shift left: stage multipliers come only from the cost ladder (COST_STAGES, costRatio)", () => {
  it("lanes map onto COST_STAGES in order and show its multipliers", () => {
    expect(TIMELINE.flatMap((s) => s.costStages)).toEqual(COST_STAGES.map((s) => s.id));
    expect(TIMELINE.map((s) => laneMultiplierText(s.id))).toEqual([
      formatMultiplier(COST_STAGES[0].multiplier),
      formatMultiplier(COST_STAGES[1].multiplier),
      formatMultiplier(COST_STAGES[2].multiplier),
      `${formatMultiplier(COST_STAGES[3].multiplier)} to ${formatMultiplier(COST_STAGES[4].multiplier)}`,
    ]);
    expect(TIMELINE.map((s) => s.afterTapeOut)).toEqual([false, false, false, true]);
  });

  it("with every activity on, each token lands at its earliest catcher with that stage's ×N", () => {
    for (const p of runTimeline(ALL_ACTIVITIES)) {
      expect(p.kind, p.bug.id).toBe("earliest");
      expect(p.catcher?.id).toBe(p.bug.catchers[0]);
      expect(p.ratioVsEarliest).toBe(1);
    }
    expect(placeBug("spec-contradiction", ALL_ACTIVITIES).multiplierText).toBe("×1");
    expect(placeBug("latch-width", ALL_ACTIVITIES).multiplierText).toBe("×10");
    expect(placeBug("boot-hang", ALL_ACTIVITIES).multiplierText).toBe("×100");
  });

  it("a moved token's ratio is costRatio between the two stages: lint off sends latches to full-chip (×100), about 10 times", () => {
    const p = placeBug("latch-width", without("lint"));
    expect(p.kind).toBe("moved");
    expect(p.catcher?.id).toBe("emulation");
    expect(p.stage).toBe("integration");
    expect(p.multiplierText).toBe("×100");
    expect(p.ratioVsEarliest).toBe(costRatio("rtl", "system"));
    expect(p.sentence).toBe(
      "Latch or width mismatch: lint is off, so it moves right to full-chip simulation or emulation at integration, before tape-out (×100), about 10 times the cost at its earliest catcher. " +
        "Bugs of this kind that only the lab or a customer will hit go past the dashed tape-out line (×1,000 or more); the token shows the best case.",
    );
    expect(p.mayStillEscape).toBe(true);
  });

  it("the moved-token caveat is the second half of the lesson's schedule-slip reveal, with the cost ladder's multiplier", () => {
    expect(pastTapeOutText()).toBe(`${formatMultiplier(COST_STAGES[3].multiplier)} or more`);
    expect(scheduleSlipReveal).toContain("for the ones that only the lab or a customer will hit");
    expect(scheduleSlipReveal).toContain(`past the dashed tape-out line (${pastTapeOutText()})`);
    expect(movedCaveat()).toContain("only the lab or a customer will hit");
    expect(movedCaveat()).toContain(`past the dashed tape-out line (${pastTapeOutText()})`);
    // Every moved token, in every subset, carries it; no other kind of placement does.
    for (const enabled of allSubsets()) {
      for (const p of runTimeline(enabled)) {
        expect(p.mayStillEscape, `${p.bug.id} ${enabled}`).toBe(p.kind === "moved");
        if (p.kind === "moved") expect(p.sentence.endsWith(movedCaveat())).toBe(true);
        else expect(p.sentence).not.toContain(movedCaveat());
      }
    }
  });

  it("an escaped token is charged at the lab as a lower bound (×1,000 or more) and names the field as the upper case", () => {
    const p = placeBug("arbiter-corner", without("block-formal"));
    expect(p.kind).toBe("escaped");
    expect(p.catcher).toBeNull();
    expect(p.stage).toBe("after-tape-out");
    expect(p.multiplierText).toBe("×1,000 or more");
    expect(p.ratioVsEarliest).toBe(costRatio("rtl", "post-silicon"));
    expect(p.sentence).toContain("silicon lab (×1,000) or, if the lab misses it, the field (×10,000)");
    expect(p.sentence).toContain("about 100 times or more the cost at formal on blocks");
    expect(p.sentence).toContain(bug("arbiter-corner").missedWhy!);
  });

  it("an escaped spec contradiction costs about 1,000 times or more its spec-review fix", () => {
    expect(placeBug("spec-contradiction", []).ratioVsEarliest).toBe(costRatio("spec", "post-silicon"));
    expect(placeBug("spec-contradiction", []).sentence).toContain("about 1,000 times or more");
  });
});

describe("F1A > Shift left: cutting an activity moves its bugs right; it never removes them", () => {
  it("with every activity off, all six tokens pile up after the tape-out line", () => {
    const run = runTimeline([]);
    expect(run).toHaveLength(BUGS.length);
    expect(run.every((p) => p.stage === "after-tape-out")).toBe(true);
    expect(summarizeRun(run).sentence).toBe(
      "0 of 6 bug kinds are found before tape-out and 6 pass the tape-out line. 6 are found later than their earliest catcher: cutting an activity moved them right, it did not remove them.",
    );
  });

  it("the arbiter corner's reason never claims a simulation runs when none does", () => {
    for (const enabled of [[], ["planning"], ["lint"], ["planning", "lint"], ["block-sim"], ["emulation"]] as ActivityId[][]) {
      const s = placeBug("arbiter-corner", enabled).sentence;
      expect(s, `${enabled}`).not.toMatch(/still runs/);
      expect(s).toContain(bug("arbiter-corner").missedWhy!);
    }
    expect(bug("arbiter-corner").missedWhy).toBe("Random stimulus rarely reaches it, so simulation, whenever it runs, does not catch it reliably.");
  });

  it("for every subset of activities, every token lands somewhere at or right of its earliest catcher", () => {
    const order = TIMELINE.map((s) => s.id);
    for (let mask = 0; mask < 1 << ALL_ACTIVITIES.length; mask += 1) {
      const enabled = ALL_ACTIVITIES.filter((_, i) => mask & (1 << i));
      const run = runTimeline(enabled);
      expect(run).toHaveLength(BUGS.length);
      for (const p of run) {
        expect(order.indexOf(p.stage)).toBeGreaterThanOrEqual(order.indexOf(p.earliest.stage));
        expect(p.ratioVsEarliest).toBeGreaterThanOrEqual(1);
        if (p.catcher) expect(enabled).toContain(p.catcher.id);
      }
    }
  });

  it("switching an activity on never moves any token right (monotone)", () => {
    const order = TIMELINE.map((s) => s.id);
    for (let mask = 0; mask < 1 << ALL_ACTIVITIES.length; mask += 1) {
      const enabled = ALL_ACTIVITIES.filter((_, i) => mask & (1 << i));
      for (const extra of ALL_ACTIVITIES.filter((a) => !enabled.includes(a))) {
        const before = runTimeline(enabled);
        const after = runTimeline([...enabled, extra]);
        after.forEach((p, i) => expect(order.indexOf(p.stage)).toBeLessThanOrEqual(order.indexOf(before[i].stage)));
      }
    }
  });

  it("accepts a Set or an array for the enabled activities", () => {
    expect(runTimeline(new Set<ActivityId>(["lint"]))).toEqual(runTimeline(["lint"]));
  });
});

describe("F1A > Shift left: presets match the lesson's two pitfalls", () => {
  it("'schedule slipped' cuts lint and block simulation, as the lesson's predict-reveal does", () => {
    expect(lesson).toContain("the team drops lint and block simulation");
    const p = findPreset("schedule-slipped");
    expect(p.enabled).toEqual(["planning", "block-formal", "emulation"]);
    const run = runTimeline(p.enabled);
    expect(placeBug("block-functional", p.enabled).stage).toBe("integration");
    expect(placeBug("latch-width", p.enabled).stage).toBe("integration");
    // Best case on the tokens: all six kinds land before tape-out...
    expect(summarizeRun(run)).toMatchObject({ beforeTapeOut: 6, afterTapeOut: 0, moved: 2, mayStillEscape: 2 });
    // ...but the summary carries the reveal's second half: some of those bugs pass tape-out.
    expect(summarizeRun(run).sentence).toBe(
      "6 of 6 bug kinds are found before tape-out and 0 pass the tape-out line. 2 are found later than their earliest catcher: cutting an activity moved them right, it did not remove them. " +
        "That count is the best case: of the 2 kinds that moved to a later stage before tape-out, bugs that only the lab or a customer will hit go past the dashed tape-out line (×1,000 or more).",
    );
    expect(placeBug("block-functional", p.enabled).sentence).toContain(movedCaveat());
  });

  it("'late stages still matter' runs every early activity and still sends the late-only kinds past tape-out", () => {
    const p = findPreset("late-stages");
    expect(p.enabled).toEqual(["planning", "lint", "block-sim", "block-formal"]);
    const escaped = runTimeline(p.enabled).filter((x) => x.kind === "escaped").map((x) => x.bug.id);
    expect(escaped).toEqual(lateOnlyBugs().map((b) => b.id));
    expect(lateStageNote(p.enabled)).toBe(
      "Only full-chip simulation or emulation catches boot or driver hang and block interaction before tape-out. With it off they pass the tape-out line however many early activities run: shifting left does not remove the late stages.",
    );
    expect(lateStageNote(ALL_ACTIVITIES)).toBeNull();
  });

  it("each preset focuses a bug, and an unknown id falls back to the first preset", () => {
    expect(PRESETS.map((p) => p.id)).toEqual(["shift-left", "schedule-slipped", "late-stages", "late-discovery"]);
    expect(findPreset("nope").id).toBe("shift-left");
    expect(findPreset(undefined).id).toBe("shift-left");
    expect(findPreset("late-discovery").enabled).toEqual([]);
  });

  it("a preset's set-up text never names where its focus bug lands", () => {
    for (const p of PRESETS) {
      const landing = placeBug(p.focus, p.enabled);
      expect(p.setup).not.toContain(landing.multiplierText);
      expect(p.setup.toLowerCase()).not.toContain(bug(p.focus).short.toLowerCase());
      const lane = timelineStage(landing.stage);
      expect(p.setup.toLowerCase(), p.id).not.toContain(lane.label.toLowerCase());
      expect(p.setup.toLowerCase(), p.id).not.toContain(lane.phrase.toLowerCase());
      expect(p.setup.toLowerCase(), p.id).not.toContain("after tape-out");
      expect(p.setup.toLowerCase(), p.id).not.toContain("post-silicon");
      // The verdict comes after the reveal, as in the lesson.
      expect(p.setup.toLowerCase(), p.id).not.toContain("overhead mistake");
    }
  });
});

describe("F1A > Shift left: predictions and their feedback are generated from the placement", () => {
  it("exactly one option is correct for every bug and every subset, and its feedback is the placement sentence", () => {
    for (let mask = 0; mask < 1 << ALL_ACTIVITIES.length; mask += 1) {
      const enabled = ALL_ACTIVITIES.filter((_, i) => mask & (1 << i));
      for (const b of BUGS) {
        const options = predictionOptions(b.id, enabled);
        expect(options.map((o) => o.id)).toEqual(TIMELINE.map((s) => s.id));
        const correct = options.filter((o) => o.correct);
        expect(correct).toHaveLength(1);
        expect(correct[0].id).toBe(placeBug(b.id, enabled).stage);
        expect(correct[0].feedback).toBe(placeBug(b.id, enabled).sentence);
      }
    }
  });

  it("predicting too late: the enabled catcher finds it first", () => {
    expect(predictionFeedback("latch-width", ALL_ACTIVITIES, "after-tape-out")).toBe(
      "Lint is on and finds it first, while the RTL is written (×10). Later stages never see it.",
    );
  });

  it("predicting past tape-out for a moved token: partly right, with the schedule-slip caveat, never 'never see it'", () => {
    const f = predictionFeedback("block-functional", findPreset("schedule-slipped").enabled, "after-tape-out");
    expect(f).toContain(movedCaveat());
    expect(f).not.toContain("never see it");
    expect(f).toContain("Partly right.");
    expect(f).toContain("Full-chip simulation or emulation is on and finds it first, at integration, before tape-out (×100)");
    // The latch-width token with lint off and emulation on takes the same branch.
    const g = predictionFeedback("latch-width", ["emulation"], "after-tape-out");
    expect(placeBug("latch-width", ["emulation"]).kind).toBe("moved");
    expect(g).toContain(movedCaveat());
    expect(g).not.toContain("never see it");
    // Every moved token, every set of activities: no 'too late' feedback denies the caveat.
    for (const b of BUGS) {
      for (let mask = 0; mask < 1 << ALL_ACTIVITIES.length; mask++) {
        const enabled = ALL_ACTIVITIES.filter((_, i) => mask & (1 << i));
        const p = placeBug(b.id, enabled);
        const later = TIMELINE.slice(TIMELINE.findIndex((s) => s.id === p.stage) + 1);
        for (const s of later) {
          const fb = predictionFeedback(b.id, enabled, s.id);
          if (p.kind === "moved") {
            expect(fb).toContain(movedCaveat());
            expect(fb).not.toContain("never see it");
          } else {
            expect(fb).toContain("Later stages never see it.");
          }
        }
      }
    }
  });

  it("predicting the switched-off catcher's stage: the bug moves right, it is not removed", () => {
    const f = predictionFeedback("block-functional", findPreset("schedule-slipped").enabled, "rtl");
    expect(f).toContain("Block-level simulation would catch it while the RTL is written, but it is switched off.");
    expect(f).toContain("the bug moves right");
  });

  it("predicting a stage whose running activities cannot catch the kind reliably", () => {
    const f = predictionFeedback("block-interaction", findPreset("late-stages").enabled, "rtl");
    expect(f).toContain("Lint, block-level simulation and formal on blocks run while the RTL is written, but none of them catches this kind reliably.");
    const g = predictionFeedback("boot-hang", [], "spec");
    expect(g).toContain("At spec review, no activity catches this kind reliably, even when switched on.");
    const h = predictionFeedback("arbiter-corner", ["emulation"], "integration");
    expect(h).toContain("Full-chip simulation or emulation runs at integration, before tape-out, but it does not catch this kind reliably.");
    const i = predictionFeedback("arbiter-corner", [], "integration");
    expect(i).toContain("At integration, before tape-out, no activity catches this kind reliably, even when switched on.");
  });

  it("joins lists as 'a', 'a and b', 'a, b and c'", () => {
    expect(joinAnd([])).toBe("");
    expect(joinAnd(["a"])).toBe("a");
    expect(joinAnd(["a", "b"])).toBe("a and b");
    expect(joinAnd(["a", "b", "c"])).toBe("a, b and c");
  });

  it("every wrong option, for every bug and every subset, falls into the diagnosis its stage order calls for", () => {
    const order = TIMELINE.map((s) => s.id);
    for (const enabled of allSubsets()) {
      for (const b of BUGS) {
        const p = placeBug(b.id, enabled);
        for (const o of predictionOptions(b.id, enabled).filter((x) => !x.correct)) {
          const tag = `${b.id} [${enabled}] -> ${o.id}`;
          if (order.indexOf(o.id) > order.indexOf(p.stage)) {
            // Too late: there is a catcher, and it finds the bug first.
            expect(p.catcher, tag).not.toBeNull();
            expect(o.feedback, tag).toContain(`${p.catcher!.label} is on and finds it first`);
            continue;
          }
          // Too early.
          expect(o.feedback.endsWith(p.sentence), tag).toBe(true);
          const offCatcherHere = b.catchers.some((c) => activity(c).stage === o.id && !enabled.includes(c));
          if (offCatcherHere) {
            expect(o.feedback, tag).toContain("switched off");
            expect(o.feedback, tag).toContain("moves right");
          } else {
            expect(o.feedback, tag).toMatch(/catch(es)? this kind reliably/);
            // Grammar: "none" only with two or more running activities.
            const running = ACTIVITIES.filter((a) => a.stage === o.id && enabled.includes(a.id)).length;
            if (running === 1) expect(o.feedback, tag).not.toMatch(/none/i);
          }
        }
      }
    }
  });
});

describe("F1A > Shift left: the 'Push further' prompt rests on the lesson's own tables", () => {
  it("each claim it paraphrases is in the lesson, and the section it points to exists", () => {
    expect(lesson).toContain("Functional bugs in one block, with full visibility and fast runs");
    expect(PUSH_FURTHER).toContain("with full visibility and fast runs");
    expect(lesson).toContain("Debug across many blocks and long software runs, then re-verify every block the fix touches.");
    expect(PUSH_FURTHER).toContain("debugging across many blocks and long software runs, then re-verifying every block the fix touches");
    expect(lesson).toContain("### Expert: Shift-left trade-offs");
    expect(PUSH_FURTHER).toContain("Expert: Shift-left trade-offs");
  });
});

describe("F1A > Shift left: reveal order and run identity", () => {
  it("reveals the predicted bug first, then the rest in token order", () => {
    expect(revealOrder("boot-hang")).toEqual(["boot-hang", "spec-contradiction", "latch-width", "block-functional", "arbiter-corner", "block-interaction"]);
  });

  it("the config key ignores array order and changes with the focus bug or any toggle", () => {
    expect(configKey(["lint", "planning"], "boot-hang")).toBe(configKey(["planning", "lint"], "boot-hang"));
    expect(configKey(["lint"], "boot-hang")).not.toBe(configKey(["lint"], "latch-width"));
    expect(configKey([], "boot-hang")).not.toBe(configKey(["lint"], "boot-hang"));
  });

  it("summaries count before and after tape-out from the run (all on: six before, none moved)", () => {
    expect(summarizeRun(runTimeline(ALL_ACTIVITIES)).sentence).toBe(
      "6 of 6 bug kinds are found before tape-out and 0 pass the tape-out line. Every bug kind is found by its earliest reliable catcher.",
    );
    expect(summarizeRun(runTimeline(without("lint"))).sentence).toContain("1 is found later than its earliest catcher: cutting an activity moved it right, it did not remove it.");
  });
});
