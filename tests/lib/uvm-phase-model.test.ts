import { describe, expect, it } from "vitest";

import {
  COMMON_PHASES,
  COMMON_ORDER,
  DIRECTION_PHASES,
  EXAMPLE_TREE,
  RUNTIME_PHASES,
  RUNTIME_PHASE_NAMES,
  SCHEDULE_ORDER,
  UVM_DEFAULT_TIMEOUT_NS,
  agentBuild,
  customPhaseSource,
  gradePhaseSorter,
  insertCustomPhase,
  phaseCallOrder,
  phaseOrder,
  seededShuffle,
  simulateRun,
  type ComponentNode,
} from "@/lib/uvm-phase-model";

const names = (phase: string, tree?: ComponentNode) => phaseCallOrder(phase, tree).calls.map((c) => c.path.replace(/^uvm_test_top\.?/, "") || "uvm_test_top");

describe("phase definitions (uvm-core 2020.3.1 uvm_common_phases.svh / uvm_runtime_phases.svh)", () => {
  it("build and final extend uvm_topdown_phase; connect…report extend uvm_bottomup_phase; run is a task phase", () => {
    const dirs = Object.fromEntries(COMMON_PHASES.map((p) => [p.name, phaseOrder(p)]));
    expect(dirs).toEqual({
      build: "top-down",
      connect: "bottom-up",
      end_of_elaboration: "bottom-up",
      start_of_simulation: "bottom-up",
      run: "parallel",
      extract: "bottom-up",
      check: "bottom-up",
      report: "bottom-up",
      final: "top-down",
    });
  });

  it("the uvm schedule holds the 12 runtime task phases in add_uvm_phases order (uvm_domain.svh, §9.8.2)", () => {
    expect(RUNTIME_PHASES.map((p) => p.name)).toEqual([...RUNTIME_PHASE_NAMES]);
    expect(RUNTIME_PHASE_NAMES[0]).toBe("pre_reset");
    expect(RUNTIME_PHASE_NAMES[11]).toBe("post_shutdown");
    expect(RUNTIME_PHASES.every((p) => p.base === "uvm_task_phase" && p.domain === "uvm")).toBe(true);
    expect(RUNTIME_PHASES[7]).toMatchObject({ name: "main", clause: "9.8.2.8" });
  });
});

describe("traversal order (uvm_topdown_phase / uvm_bottomup_phase traverse)", () => {
  it("build_phase is depth-first pre-order: each parent before its children", () => {
    expect(names("build")).toEqual(["uvm_test_top", "env", "env.agt", "env.agt.drv", "env.agt.mon", "env.agt.sqr", "env.scb"]);
  });

  it("is depth-first, not level by level: env.agt.drv is built before its uncle env.scb", () => {
    const order = names("build");
    expect(order.indexOf("env.agt.drv")).toBeLessThan(order.indexOf("env.scb"));
  });

  it("connect_phase is depth-first post-order: the deepest component on the first branch goes first", () => {
    expect(names("connect")).toEqual(["env.agt.drv", "env.agt.mon", "env.agt.sqr", "env.agt", "env.scb", "env", "uvm_test_top"]);
  });

  it("end_of_elaboration, start_of_simulation, extract, check and report use the same bottom-up order", () => {
    for (const phase of ["end_of_elaboration", "start_of_simulation", "extract", "check", "report"]) {
      expect(names(phase)).toEqual(names("connect"));
    }
  });

  it("final_phase is top-down like build_phase", () => {
    expect(names("final")).toEqual(names("build"));
  });

  it("siblings follow instance-name order, not creation order (m_children[string]; IEEE 1800-2023 §7.8.2)", () => {
    // env creates scb before agt, yet agt is visited first.
    const env = EXAMPLE_TREE.children?.[0];
    expect(env?.children?.map((c) => c.name)).toEqual(["scb", "agt"]);
    expect(names("build").indexOf("env.agt")).toBeLessThan(names("build").indexOf("env.scb"));
    // Renaming the agent changes the visit order.
    const renamed: ComponentNode = {
      name: "uvm_test_top",
      type: "t",
      children: [{ name: "env", type: "e", children: [{ name: "scb", type: "s" }, { name: "z_agt", type: "a" }] }],
    };
    expect(names("build", renamed)).toEqual(["uvm_test_top", "env", "env.scb", "env.z_agt"]);
  });

  it("run_phase threads are forked for every component (uvm_task_phase) and reported as parallel", () => {
    const run = phaseCallOrder("run");
    expect(run.order).toBe("parallel");
    expect(run.calls).toHaveLength(7);
  });
});

describe("super.build_phase (uvm_component::build → apply_config_settings; uvm_agent::build_phase is_active lookup)", () => {
  it("children are still created and phased when the agent skips super.build_phase", () => {
    const out = agentBuild({ callsSuper: false, configuredIsActive: null, configuredNumTxns: null });
    expect(out.children).toEqual(["mon", "drv", "sqr"]);
    expect(out.childBuildPhasesRun).toBe(true);
  });

  it("skipping super ignores is_active from config_db: a PASSIVE agent still builds a driver and sequencer", () => {
    const out = agentBuild({ callsSuper: false, configuredIsActive: "UVM_PASSIVE", configuredNumTxns: 50 });
    expect(out.isActive).toBe("UVM_ACTIVE");
    expect(out.isActiveSource).toBe("default");
    expect(out.children).toContain("drv");
    expect(out.autoConfigApplied).toBe(false);
    expect(out.numTxns).toBe(10);
  });

  it("calling super applies the configuration: PASSIVE builds only the monitor and num_txns is auto-configured", () => {
    const out = agentBuild({ callsSuper: true, configuredIsActive: "UVM_PASSIVE", configuredNumTxns: 50 });
    expect(out.children).toEqual(["mon"]);
    expect(out.numTxns).toBe(50);
    expect(out.autoConfigApplied).toBe(true);
  });
});

describe("objections and end of test (uvm_phase_hopper::execute_phase, uvm_objection)", () => {
  it("no objection anywhere: run_phase ends at 0 ns ('No objections raised, skipping phase')", () => {
    const r = simulateRun({});
    expect(r.runEnd).toBe(0);
    expect(r.cleanupAt).toBe(0);
    expect(r.lanes.run.reason).toBe("no-objection");
    expect(r.fatal).toBeNull();
  });

  it("the phase ends in the time step the last objection drops", () => {
    const r = simulateRun({ run: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 400 }] } });
    expect(r.runEnd).toBe(400);
  });

  it("the phase waits for the last of several objectors", () => {
    const r = simulateRun({
      run: {
        objections: [
          { who: "uvm_test_top", raiseAt: 0, dropAt: 400 },
          { who: "uvm_test_top.env.scb", raiseAt: 0, dropAt: 430 },
        ],
      },
    });
    expect(r.runEnd).toBe(430);
  });

  it("drain time delays the end after the count reaches zero (set_drain_time, §10.5.1.3.7)", () => {
    const r = simulateRun({ run: { drainTime: 50, objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 400 }] } });
    expect(r.runEnd).toBe(450);
    expect(r.lanes.run.drains).toEqual([{ from: 400, to: 450, cancelled: false }]);
  });

  it("a raise during the drain cancels it, and the drain restarts after the next drop", () => {
    const r = simulateRun({
      run: {
        drainTime: 50,
        objections: [
          { who: "uvm_test_top", raiseAt: 0, dropAt: 400 },
          { who: "uvm_test_top", raiseAt: 420, dropAt: 500 },
        ],
      },
    });
    expect(r.runEnd).toBe(550);
    expect(r.lanes.run.drains).toContainEqual({ from: 400, to: 420, cancelled: true });
  });

  it("drain time is no hang safety net: a never-dropped objection ends only by the PH_TIMEOUT fatal", () => {
    const r = simulateRun({ timeout: 2000, run: { drainTime: 50, objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: null }] } });
    expect(r.fatal).toEqual({ at: 2000, id: "PH_TIMEOUT", message: "Explicit timeout of 2 us hit, indicating a probable testbench issue" });
    expect(r.runEnd).toBeNull();
    expect(r.cleanupAt).toBeNull();
    expect(r.lanes.run.reason).toBe("timeout");
  });

  it("the default timeout is `UVM_DEFAULT_TIMEOUT = 9200 s and is reported as 'Default'", () => {
    const r = simulateRun({ run: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: null }] } });
    expect(r.timeout).toBe(UVM_DEFAULT_TIMEOUT_NS);
    expect(r.fatal?.at).toBe(9200e9);
    expect(r.fatal?.message).toMatch(/^Default timeout of 9200 s hit/);
  });

  it("set_timeout(0) disables the watchdog: a stuck objection hangs forever", () => {
    const r = simulateRun({ timeout: 0, run: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: null }] } });
    expect(r.fatal).toBeNull();
    expect(r.hangs).toBe(true);
  });

  it("a raise after the first time step is too late: the phase already ended and killed the thread", () => {
    const r = simulateRun({ run: { objections: [{ who: "uvm_test_top", raiseAt: 10, dropAt: 410 }] } });
    expect(r.runEnd).toBe(0);
    expect(r.lanes.run.killedRaises).toHaveLength(1);
    expect(r.events.some((e) => e.kind === "killed")).toBe(true);
  });

  it("threads are killed at phase end: a response still in flight is lost (uvm_task_phase)", () => {
    const r = simulateRun({
      run: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 400 }], arrivals: [{ at: 430, label: "last response" }] },
    });
    expect(r.runEnd).toBe(400);
    expect(r.lanes.run.arrivals[0].seen).toBe(false);
  });

  it("phase_ready_to_end can re-raise to keep the phase alive until the last response arrives", () => {
    const r = simulateRun({
      run: {
        objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 400 }],
        arrivals: [{ at: 430, label: "last response" }],
        readyToEnd: { who: "uvm_test_top.env.scb", kind: "until-arrivals" },
      },
    });
    expect(r.runEnd).toBe(430);
    expect(r.lanes.run.arrivals[0].seen).toBe(true);
    expect(r.lanes.run.readyToEndRounds).toBe(2);
  });

  it("phase_ready_to_end is called at most get_max_ready_to_end_iterations() times (default 20, §9.3.1.3.5)", () => {
    const always = { who: "uvm_test_top.env.scb", kind: "fixed" as const, extendBy: 10, rounds: Number.POSITIVE_INFINITY };
    const r = simulateRun({ run: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 400 }], readyToEnd: always } });
    expect(r.lanes.run.readyToEndRounds).toBe(20);
    expect(r.runEnd).toBe(600);
    const capped = simulateRun({ maxReadyToEndIterations: 3, run: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 400 }], readyToEnd: always } });
    expect(capped.runEnd).toBe(430);
  });
});

describe("run_phase in parallel with the uvm schedule (uvm_domain::get_common_domain with_phase(run))", () => {
  it("runtime phases are synchronized: configure starts for everyone when the last reset objection drops", () => {
    const r = simulateRun({
      schedule: {
        reset: {
          objections: [
            { who: "uvm_test_top.env.agt", raiseAt: 0, dropAt: 100 },
            { who: "uvm_test_top.env.scb", raiseAt: 0, dropAt: 30 },
          ],
        },
        configure: { objections: [{ who: "uvm_test_top.env.agt", raiseAt: 0, dropAt: 50 }] },
      },
    });
    expect(r.lanes.reset.end).toBe(100);
    expect(r.lanes.configure.start).toBe(100);
    expect(r.lanes.configure.end).toBe(150);
  });

  it("a runtime phase with no objection ends at once even while run_phase is busy", () => {
    const r = simulateRun({
      run: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 500 }] },
      schedule: { main: { objections: [{ who: "uvm_test_top.env.agt.drv", raiseAt: 5, dropAt: 300 }] } },
    });
    expect(r.lanes.main.start).toBe(0);
    expect(r.lanes.main.end).toBe(0);
    expect(r.lanes.main.killedRaises).toHaveLength(1);
    expect(r.runEnd).toBe(500);
  });

  it("run_phase cannot end before the uvm schedule ends (wait_for_self_and_siblings_to_drop)", () => {
    const r = simulateRun({
      schedule: {
        reset: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 100 }] },
        main: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 300 }] },
      },
    });
    expect(r.scheduleEnd).toBe(400);
    expect(r.runEnd).toBe(400);
    expect(r.lanes.run.waitedForSchedule).toBe(true);
  });

  it("run_phase raises made while it waits for the schedule still hold it open", () => {
    const r = simulateRun({
      run: { objections: [{ who: "uvm_test_top", raiseAt: 50, dropAt: 600 }] },
      schedule: { main: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 400 }] } },
    });
    expect(r.runEnd).toBe(600);
  });

  it("cleanup phases start only after both run_phase and the schedule have ended", () => {
    const r = simulateRun({
      run: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 500 }] },
      schedule: { main: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: 300 }] } },
    });
    expect(r.scheduleEnd).toBe(300);
    expect(r.cleanupAt).toBe(500);
  });

  it("a hang in main_phase is caught by the run_phase watchdog, which waits for the schedule", () => {
    const r = simulateRun({ timeout: 2000, schedule: { main: { objections: [{ who: "uvm_test_top", raiseAt: 0, dropAt: null }] } } });
    expect(r.fatal?.at).toBe(2000);
    expect(r.lanes.main.reason).toBe("timeout");
    expect(r.lanes.post_main.reason).toBe("not-reached");
  });
});

describe("custom phase insertion (uvm_phase::add, find(stay_in_scope=1))", () => {
  it("adding to the common domain relative to reset_phase is a PH_BAD_ADD fatal: reset lives in uvm_sched", () => {
    const r = insertCustomPhase({ name: "load_fw", target: "common", after: "reset", implementsExecTask: true });
    expect(r.ok).toBe(false);
    expect(r.fatal?.message).toBe("cannot find after_phase 'reset' within node 'common'");
  });

  it("before_phase is checked before after_phase, as in uvm_phase::add", () => {
    const r = insertCustomPhase({ name: "load_fw", target: "common", after: "reset", before: "configure", implementsExecTask: true });
    expect(r.fatal?.message).toBe("cannot find before_phase 'configure' within node 'common'");
  });

  it("after_phase alone inserts the phase serially in the uvm schedule", () => {
    const r = insertCustomPhase({ name: "load_fw", target: "uvm_sched", after: "reset", implementsExecTask: true });
    expect(r.ok).toBe(true);
    expect(r.container.slice(0, 4)).toEqual(["pre_reset", "reset", "load_fw", "post_reset"]);
  });

  it("with_phase creates a parallel branch beside the anchor", () => {
    const r = insertCustomPhase({ name: "warmup", target: "uvm_sched", with: "main", implementsExecTask: true });
    expect(r.steps).toContainEqual({ kind: "parallel", lanes: [["main"], ["warmup"]], custom: "warmup" });
  });

  it("after + before that are not neighbours give a branch parallel to the phases between them", () => {
    const r = insertCustomPhase({ name: "fw", target: "uvm_sched", after: "reset", before: "configure", implementsExecTask: true });
    expect(r.steps).toContainEqual({ kind: "parallel", lanes: [["post_reset", "pre_configure"], ["fw"]], custom: "fw" });
  });

  it("before_phase earlier than after_phase is a fatal", () => {
    const r = insertCustomPhase({ name: "fw", target: "uvm_sched", after: "main", before: "reset", implementsExecTask: true });
    expect(r.fatal?.message).toBe("Phase 'reset' is not before phase 'main'");
  });

  it("with_phase together with after_phase is a fatal", () => {
    const r = insertCustomPhase({ name: "fw", target: "uvm_sched", with: "main", after: "reset", implementsExecTask: true });
    expect(r.fatal?.message).toMatch(/only one of with_phase\/after_phase/);
  });

  it("without an exec_task override no component method runs (uvm_phase::exec_task is empty)", () => {
    const r = insertCustomPhase({ name: "load_fw", target: "uvm_sched", after: "reset", implementsExecTask: false });
    expect(r.ok).toBe(true);
    expect(r.componentMethodCalled).toBe(false);
    expect(r.notes.join(" ")).toMatch(/default exec_task is empty/);
  });

  it("a task phase after extract still runs, but run_phase threads are gone and no watchdog guards it", () => {
    const r = insertCustomPhase({ name: "late", target: "common", after: "extract", implementsExecTask: true });
    expect(r.ok).toBe(true);
    expect(r.container.slice(5, 7)).toEqual(["extract", "late"]);
    expect(r.notes.join(" ")).toMatch(/never timed out/);
  });

  it("generated source overrides exec_task and targets the uvm schedule", () => {
    const src = customPhaseSource({ name: "load_fw", target: "uvm_sched", after: "reset", implementsExecTask: true });
    expect(src).toMatch(/virtual task exec_task\(uvm_component comp, uvm_phase phase\);/);
    expect(src).toMatch(/\$cast\(env, comp\)/);
    expect(src).toMatch(/uvm_domain::get_uvm_schedule\(\)\.add\(load_fw_phase_c::get\(\),\n {2}\.after_phase\(uvm_reset_phase::get\(\)\)\);/);
  });
});

describe("phase sorter grading", () => {
  const solvedDirections = Object.fromEntries(DIRECTION_PHASES.map((n) => [n, phaseOrder(COMMON_PHASES.find((p) => p.name === n)!)])) as Record<
    string,
    "top-down" | "bottom-up"
  >;

  it("a fully correct answer scores 100%", () => {
    const g = gradePhaseSorter({ common: COMMON_ORDER, schedule: SCHEDULE_ORDER, directions: solvedDirections });
    expect(g.percent).toBe(100);
    expect(g.passed).toBe(true);
  });

  it("one misplaced phase costs one point, not every phase after it", () => {
    const common = COMMON_ORDER.filter((n) => n !== "run").concat("run");
    const g = gradePhaseSorter({ common, schedule: SCHEDULE_ORDER, directions: solvedDirections });
    expect(g.commonInPlace).toHaveLength(8);
    expect(g.points).toBe(g.total - 1);
  });

  it("final marked bottom-up is diagnosed as top-down", () => {
    const g = gradePhaseSorter({ common: COMMON_ORDER, schedule: SCHEDULE_ORDER, directions: { ...solvedDirections, final: "bottom-up" } });
    expect(g.directionCorrect.final).toBe(false);
    expect(g.diagnoses.join(" ")).toMatch(/final_phase is top-down/);
  });

  it("seeded shuffle is deterministic and never returns the solved order", () => {
    expect(seededShuffle(SCHEDULE_ORDER, 3)).toEqual(seededShuffle(SCHEDULE_ORDER, 3));
    for (let seed = 0; seed < 20; seed += 1) expect(seededShuffle(COMMON_ORDER, seed)).not.toEqual(COMMON_ORDER);
  });
});
