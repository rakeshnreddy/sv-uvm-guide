import { describe, expect, it } from "vitest";

import { ALL_SCENARIOS, displayObjections, hangScenarios, runHang } from "@/lib/uvm-hang-model";

describe("uvm-hang-model: missing item_done (uvm_sequencer.svh get_next_item / item_done)", () => {
  const run = runHang({ scenario: "missing-item-done", variant: "bug" });

  it("the second get_next_item reports the 'called twice' error, repeatedly, until PH_TIMEOUT", () => {
    const err = run.log.find((l) => l.kind === "error");
    expect(err?.text).toBe("UVM_ERROR @ 10: uvm_test_top.env.agt.sqr [uvm_test_top.env.agt.sqr] Get_next_item called twice without item_done or get in between");
    expect(err?.repeat).toBe(99); // every 10 ns from 10 to 990
    expect(run.ended).toBe("timeout");
    expect(run.log.find((l) => l.kind === "fatal")?.text).toBe("UVM_FATAL @ 1000: reporter [PH_TIMEOUT] Explicit timeout of 1000 hit, indicating a probable testbench issue");
    expect(run.log.at(-1)?.text).toContain("UVM_ERROR : 99  UVM_FATAL : 1");
  });

  it("main_seq is stuck in finish_item for pkt 1 and the same item stays outstanding", () => {
    expect(run.processes.find((p) => p.name === "main_seq")?.status).toBe("finish_item: waiting for item_done (pkt 1)");
    expect(run.sequencer.outstandingItem).toBe("pkt 1");
    expect(run.itemsCompleted).toBe(0);
  });

  it("calling item_done ends the run after 3 items at 30 ns", () => {
    const fixed = runHang({ scenario: "missing-item-done", variant: "fixed" });
    expect(fixed.ended).toBe("all-dropped");
    expect(fixed.endTime).toBe(30);
    expect(fixed.itemsCompleted).toBe(3);
    expect(fixed.errors).toBe(0);
  });

  it("a longer timeout only delays the same hang", () => {
    const later = runHang({ scenario: "missing-item-done", variant: "longer-timeout" });
    expect(later.ended).toBe("timeout");
    expect(later.endTime).toBe(10_000);
  });

  it("dropping the test objection early ends the run at 0 ns with nothing driven (bug hidden)", () => {
    const early = runHang({ scenario: "missing-item-done", variant: "drop-early" });
    expect(early.ended).toBe("all-dropped");
    expect(early.endTime).toBe(0);
    expect(early.itemsCompleted).toBe(0);
    expect(early.errors).toBe(0);
  });
});

describe("uvm-hang-model: stuck objection (uvm_objection.svh trace and display_objections)", () => {
  const run = runHang({ scenario: "stuck-objection", variant: "bug", objectionTrace: true });

  it("the scoreboard holds one objection after the mismatch path skips its drop", () => {
    expect(run.ended).toBe("timeout");
    expect(run.objections.find((o) => o.path === "uvm_test_top.env.scb")).toEqual({ path: "uvm_test_top.env.scb", source: 1, total: 1 });
    expect(run.objections.find((o) => o.path === "uvm_test_top")).toEqual({ path: "uvm_test_top", source: 0, total: 1 });
  });

  it("the objection trace uses the OBJTN_TRC format and shows the test dropping at 40 ns", () => {
    expect(run.log).toContainEqual(
      expect.objectContaining({ text: "UVM_INFO @ 40: run_objection [OBJTN_TRC] Object uvm_test_top dropped 1 run_objection objection(s) (main_seq done): count=0  total=1" }),
    );
  });

  it("display_objections lists source and total counts with indentation", () => {
    expect(run.objectionTable[0]).toBe("The total objection count is 1");
    expect(run.objectionTable).toContain(`1       1${" ".repeat(13)}scb`);
    expect(run.objectionTable).toContain(`0       1${" ".repeat(9)}uvm_test_top`);
    expect(run.objectionTable).toContain(`0       1${" ".repeat(7)}uvm_top`);
  });

  it("dropping on every path ends at 40 ns and still reports the mismatch", () => {
    const fixed = runHang({ scenario: "stuck-objection", variant: "fixed" });
    expect(fixed.ended).toBe("all-dropped");
    expect(fixed.endTime).toBe(40);
    expect(fixed.errors).toBe(1);
  });

  it("drain time does not help: the total never reaches zero", () => {
    expect(runHang({ scenario: "stuck-objection", variant: "drain-time" }).ended).toBe("timeout");
  });
});

describe("uvm-hang-model: grab leak (uvm_sequencer_base.svh lock_list)", () => {
  const run = runHang({ scenario: "grab-leak", variant: "bug" });

  it("the still-running irq_seq keeps the sequencer grabbed; main_seq waits for a grant forever", () => {
    expect(run.ended).toBe("timeout");
    expect(run.sequencer.grabbedBy).toBe("irq_seq");
    expect(run.sequencer.waitingRequests).toEqual(["main_seq"]);
    expect(run.processes.find((p) => p.name === "main_seq")?.status).toBe("start_item: waiting for grant");
    expect(run.processes.find((p) => p.name === "driver run_phase")?.status).toBe("get_next_item: waiting for an item");
    expect(run.errors).toBe(0);
  });

  it("ungrab() lets main_seq finish: run ends at 50 ns", () => {
    const fixed = runHang({ scenario: "grab-leak", variant: "fixed" });
    expect(fixed.endTime).toBe(50);
    expect(fixed.sequencer.grabbedBy).toBeNull();
  });

  it("lock() without unlock() hangs the same way", () => {
    expect(runHang({ scenario: "grab-leak", variant: "lock-instead" }).sequencer.grabbedBy).toBe("irq_seq");
  });
});

describe("uvm-hang-model: no objection", () => {
  it("a run phase with no objection ends at 0 ns; raising one runs all 4 items", () => {
    const bug = runHang({ scenario: "no-objection", variant: "bug" });
    expect(bug.ended).toBe("all-dropped");
    expect(bug.endTime).toBe(0);
    expect(bug.itemsCompleted).toBe(0);
    expect(bug.log.at(-1)?.text).toContain("UVM_ERROR : 0  UVM_FATAL : 0");
    expect(bug.narration).toMatch(/No objection/);
    const fixed = runHang({ scenario: "no-objection", variant: "fixed" });
    expect(fixed.endTime).toBe(40);
    expect(fixed.itemsCompleted).toBe(4);
  });
});

describe("uvm-hang-model: scenario data", () => {
  it("each scenario has one correct suspect and one correct fix, and the correct fix ends the run", () => {
    for (const id of ALL_SCENARIOS) {
      const s = hangScenarios[id];
      expect(s.suspects.filter((x) => x.correct)).toHaveLength(1);
      expect(s.fixes.filter((x) => x.correct)).toHaveLength(1);
      const good = s.fixes.find((f) => f.correct)!;
      expect(runHang({ scenario: id, variant: good.variant }).ended).toBe("all-dropped");
    }
  });

  it("display_objections with nothing raised prints only the total", () => {
    expect(displayObjections([])).toEqual(["The total objection count is 0"]);
  });
});
