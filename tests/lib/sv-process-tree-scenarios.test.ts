import { describe, expect, it } from "vitest";

import {
  eventRaceScenario,
  forkLoopScenario,
  joinVariantsScenario,
  prepareScenario,
  simulateProcesses,
  timeoutBenchScenario,
  waitForkScenario,
  type ProcessScenario,
} from "@/lib/sv-process-model";
import {
  checkpointAnswer,
  checkpointQuestion,
  describeTree,
  descendantsOf,
  disableForkReach,
  findTreeCheckpoints,
  FINISHED_CHILD_TIMES,
  finishedChildScenario,
  gradeTreePrediction,
  immediateChildrenOf,
  isTreeScenarioId,
  listLabels,
  nodeOutcome,
  processTree,
  treeRows,
  waitForkReach,
  wrapperScenario,
  type TreeCheckpoint,
} from "@/lib/sv-process-tree-scenarios";

const run = (scenario: ProcessScenario, order: "declaration" | "reverse" = "declaration") => {
  const prepared = prepareScenario(scenario);
  const result = simulateProcesses(scenario, { order });
  return { prepared, result, checkpoints: findTreeCheckpoints(result, prepared) };
};

const labelsOf = (cp: TreeCheckpoint, pids: number[]) => pids.map((pid) => cp.before.find((n) => n.pid === pid)?.label);
const pidOf = (cp: TreeCheckpoint, label: string) => cp.before.find((n) => n.label === label)?.pid as number;
const createdLabels = (scenario: ProcessScenario) => simulateProcesses(scenario).processes.map((p) => p.label);

const catalogue: ProcessScenario[] = [
  joinVariantsScenario("join"),
  joinVariantsScenario("join_any"),
  joinVariantsScenario("join_none"),
  timeoutBenchScenario("none", false),
  timeoutBenchScenario("isolate", false),
  timeoutBenchScenario("named", false),
  timeoutBenchScenario("named", true),
  timeoutBenchScenario("wait-fork", false),
  waitForkScenario(),
  forkLoopScenario("bug"),
  forkLoopScenario("fork-automatic"),
  eventRaceScenario("at-trigger"),
  wrapperScenario("fork-join"),
  wrapperScenario("begin-end"),
  wrapperScenario("none"),
  finishedChildScenario("disable-fork"),
  finishedChildScenario("wait-fork"),
];

describe("IEEE 1800-2023 §9.5: what creates a process", () => {
  it("§9.5: each initial procedure is a root and each statement of a fork is a child process", () => {
    const { result } = run(timeoutBenchScenario("none", false));
    const tree = processTree(result.trace[result.trace.length - 1]);
    const roots = tree.filter((n) => n.parent === null).map((n) => n.label);
    expect(roots).toEqual(["test", "watchdog"]);
    const test = tree.find((n) => n.label === "test");
    expect(test && immediateChildrenOf(tree, test.pid).map((pid) => tree.find((n) => n.pid === pid)?.label)).toEqual(["monitor", "rsp 1", "timer 1"]);
  });

  it("§9.5 with §9.3.1: a begin … end wrapper adds no node; fork begin … end join adds one", () => {
    expect(createdLabels(wrapperScenario("begin-end"))).toEqual(createdLabels(wrapperScenario("none")));
    expect(createdLabels(wrapperScenario("none"))).toEqual(["test", "monitor", "rsp", "timer"]);
    expect(createdLabels(wrapperScenario("fork-join"))).toEqual(["test", "monitor", "wrapper", "rsp", "timer"]);
  });

  it("§9.5: in the fork-join wrapper, rsp and timer are the wrapper's children, not test's", () => {
    const { result } = run(wrapperScenario("fork-join"));
    const tree = processTree(result.trace[result.trace.length - 1]);
    const labelOf = (pid: number) => tree.find((n) => n.pid === pid)?.label;
    const pid = (label: string) => tree.find((n) => n.label === label)?.pid as number;
    expect(immediateChildrenOf(tree, pid("wrapper")).map(labelOf)).toEqual(["rsp", "timer"]);
    expect(immediateChildrenOf(tree, pid("test")).map(labelOf)).toEqual(["monitor", "wrapper"]);
  });

  it("every process label is unique within a run, so reach read from the simulator's labels names one node", () => {
    for (const s of catalogue) {
      const labels = createdLabels(s);
      expect(new Set(labels).size, s.id).toBe(labels.length);
    }
  });

  it("§9.5: a task call runs in the caller's process (xfer is not a node)", () => {
    expect(createdLabels(timeoutBenchScenario("none", false))).not.toContain("xfer");
  });

  it("§9.5: the tree scenarios stay within six nodes", () => {
    for (const s of [wrapperScenario("fork-join"), wrapperScenario("begin-end"), wrapperScenario("none"), finishedChildScenario("disable-fork"), finishedChildScenario("wait-fork")]) {
      expect(createdLabels(s).length).toBeLessThanOrEqual(6);
    }
    expect(createdLabels(timeoutBenchScenario("isolate", false))).toHaveLength(6);
  });
});

describe("IEEE 1800-2023 §9.6.3: disable fork", () => {
  it("§9.6.3: the simulator's victims equal the caller's living descendants at every disable fork in the catalogue", () => {
    let seen = 0;
    for (const s of catalogue) {
      for (const order of ["declaration", "reverse"] as const) {
        for (const cp of run(s, order).checkpoints.filter((c) => c.kind === "disable-fork")) {
          seen += 1;
          expect([...cp.reached].sort()).toEqual([...disableForkReach(cp.before, cp.callerPid)].sort());
        }
      }
    }
    expect(seen).toBeGreaterThanOrEqual(8);
  });

  it("§9.6.3: disable fork kills a monitor forked by an earlier fork of the same process", () => {
    const [cp] = run(timeoutBenchScenario("none", false)).checkpoints;
    expect(cp.kind).toBe("disable-fork");
    expect(cp.callerLabel).toBe("test");
    expect(labelsOf(cp, cp.reached)).toEqual(["monitor", "timer 1"]);
    expect(cp.latestForkChildren.map((pid) => cp.before.find((n) => n.pid === pid)?.label)).toEqual(["rsp 1", "timer 1"]);
  });

  it("§9.6.3 with §9.5: begin … end does not isolate disable fork; fork begin … end join does", () => {
    const beginEnd = run(wrapperScenario("begin-end")).checkpoints[0];
    expect(beginEnd.callerLabel).toBe("test");
    expect(labelsOf(beginEnd, beginEnd.reached)).toEqual(["monitor", "timer"]);
    const forked = run(wrapperScenario("fork-join"));
    expect(forked.checkpoints[0].callerLabel).toBe("wrapper");
    expect(labelsOf(forked.checkpoints[0], forked.checkpoints[0].reached)).toEqual(["timer"]);
    expect(forked.result.log.filter((l) => l.text === "monitor alive").length).toBeGreaterThan(1);
  });

  it("§9.6.3: a grandchild dies although its parent, the caller's child, has already terminated", () => {
    const { result, checkpoints } = run(finishedChildScenario("disable-fork"));
    const [cp] = checkpoints;
    expect(cp.time).toBe(FINISHED_CHILD_TIMES.cleanupAt);
    expect(cp.before.find((n) => n.label === "C")?.state).toBe("done");
    expect(cp.before.find((n) => n.label === "G")?.state).toBe("blocked");
    expect(labelsOf(cp, cp.reached)).toEqual(["G"]);
    expect(descendantsOf(cp.before, cp.callerPid).map((pid) => cp.before.find((n) => n.pid === pid)?.label)).toEqual(["C", "G"]);
    expect(result.log.map((l) => `${l.time}:${l.text}`)).toEqual([`${FINISHED_CHILD_TIMES.childEnds}:C done`, `${FINISHED_CHILD_TIMES.cleanupAt}:parent passes cleanup`]);
  });
});

describe("IEEE 1800-2023 §9.6.1: wait fork", () => {
  it("§9.6.1: wait fork waits for immediate children only; the parent wakes when the last of them ends", () => {
    const { result, checkpoints } = run(waitForkScenario());
    const [cp] = checkpoints;
    expect(checkpoints.map((c) => c.kind)).toEqual(["wait-fork"]);
    expect(labelsOf(cp, cp.reached)).toEqual(["A", "B"]);
    const lastChildEnd = Math.max(...["A done", "B done"].map((t) => result.log.find((l) => l.text === t)?.time ?? -1));
    expect(result.log.find((l) => l.text === "parent passes wait fork")?.time).toBe(lastChildEnd);
    expect(result.log.find((l) => l.text === "G (grandchild) done")?.time).toBeGreaterThan(lastChildEnd);
  });

  it("§9.6.1: with its only child finished, wait fork passes at once and the grandchild runs on", () => {
    const { result, checkpoints } = run(finishedChildScenario("wait-fork"));
    const [cp] = checkpoints;
    expect(cp.reached).toEqual([]);
    expect(waitForkReach(cp.before, cp.callerPid)).toEqual([]);
    expect(result.log.find((l) => l.text === "parent passes cleanup")?.time).toBe(FINISHED_CHILD_TIMES.cleanupAt);
    expect(result.log.find((l) => l.text === "G done")?.time).toBe(FINISHED_CHILD_TIMES.grandchildEnds);
  });

  it("§9.6.1: the caller's parent is explained as an ancestor, and the question is pinned", () => {
    const [cp] = run(timeoutBenchScenario("wait-fork", true)).checkpoints;
    expect(cp.callerLabel).toBe("xfer(1)");
    expect(checkpointQuestion(cp)).toBe("At t = 15 ns, xfer(1) is about to run wait fork. Which processes does it wait for? Tap each one you predict, or none.");
    const g = gradeTreePrediction(cp, []);
    expect(g.nodes.find((n) => n.label === "test")?.why).toBe(
      "test is an ancestor of xfer(1), not a child. wait fork waits only for the calling process's immediate children (§9.6.1).",
    );
    expect(labelsOf(cp, cp.reached)).toEqual(["timer 1"]);
  });

  it("§9.6.1: a wait fork is one checkpoint, not one per step that keeps its line", () => {
    expect(run(forkLoopScenario("bug")).checkpoints.map((c) => c.kind)).toEqual(["wait-fork"]);
  });
});

describe("IEEE 1800-2023 §9.6.2: disable by name", () => {
  it("§9.6.2 / §9.6.3: disable guard ends the other call's activation too", () => {
    const [first] = run(timeoutBenchScenario("named", true)).checkpoints;
    expect(first.kind).toBe("disable-name");
    expect(first.statement).toBe("disable guard;");
    expect(first.callerLabel).toBe("xfer(1)");
    expect(labelsOf(first, first.reached).sort()).toEqual(["rsp 2", "timer 1", "timer 2", "xfer(2)"]);
    expect(labelsOf(first, first.unwound)).toEqual(["xfer(2)"]);
    expect(first.automaticTask).toBe("xfer");
    const g = gradeTreePrediction(first, []);
    for (const label of ["test", "monitor", "watchdog", "rsp 1"]) expect(g.nodes.find((n) => n.label === label)?.verdict).toBe("clear");
  });

  it("§9.6.2: xfer(2) is forced out of guard, not ended: it carries on and runs its own disable guard, which reaches nothing", () => {
    const [, second] = run(timeoutBenchScenario("named", true)).checkpoints;
    expect(second.kind).toBe("disable-name");
    expect(second.callerLabel).toBe("xfer(2)");
    expect(second.time).toBe(15);
    expect(second.reached).toEqual([]);
  });

  it("§9.6.2: the question and answer keep ended processes apart from the one forced out of the block", () => {
    const [first] = run(timeoutBenchScenario("named", true)).checkpoints;
    expect(checkpointQuestion(first)).toBe(
      "At t = 15 ns, xfer(1) is about to run disable guard. Which processes does it reach (end, or force out of guard)? Tap each one you predict, or none.",
    );
    const answer = checkpointAnswer(first);
    expect(answer).toBe("disable guard ends timer 1, rsp 2 and timer 2, and forces xfer(2) out of guard; xfer(2) carries on after the block (§9.6.2).");
    // The list of processes it ends stops at "and forces"; xfer(2) is not in it.
    expect(answer.split(", and forces")[0]).not.toMatch(/xfer\(2\)/);
    expect(nodeOutcome(first, pidOf(first, "xfer(2)"))).toBe("forced out of guard");
    expect(nodeOutcome(first, pidOf(first, "rsp 2"))).toBe("ended");
    expect(nodeOutcome(first, pidOf(first, "monitor"))).toBe("not reached");
  });

  it("§9.6.2: leaving xfer(2) unpicked is graded a miss of a forced-out process, not of an ended one", () => {
    const [first] = run(timeoutBenchScenario("named", true)).checkpoints;
    const g = gradeTreePrediction(first, ["timer 1", "rsp 2", "timer 2"].map((l) => pidOf(first, l)));
    expect(g.correct).toBe(false);
    expect(g.summary).toMatch(/ You missed xfer\(2\), which it forces out of guard\.$/);
    expect(g.nodes.find((n) => n.label === "xfer(2)")?.why).toBe(
      "xfer(2) is executing inside guard itself, so disable guard forces it out of the block; it carries on after the block (§9.6.2).",
    );
    expect(g.nodes.find((n) => n.label === "rsp 2")?.why).toMatch(/disabling a block inside an automatic task acts on all concurrent executions of the task \(§9\.6\.2\)/);
    const all = gradeTreePrediction(first, first.reached);
    expect(all.correct).toBe(true);
  });

  it("§9.6.2: with one call only that call's timer is ended", () => {
    const [cp] = run(timeoutBenchScenario("named", false)).checkpoints;
    expect(labelsOf(cp, cp.reached)).toEqual(["timer 1"]);
    expect(checkpointAnswer(cp)).toBe("disable guard ends timer 1.");
    expect(gradeTreePrediction(cp, []).summary).toBe("Not quite. disable guard ends timer 1. You missed timer 1, which it ends.");
  });
});

describe("IEEE 1800-2023 §9.3.2: join keywords and checkpoints", () => {
  it("§9.3.2: join_any resumes the caller when the response (#15) ends, so disable fork runs at 15 ns", () => {
    for (const w of ["fork-join", "begin-end", "none"] as const) {
      expect(run(wrapperScenario(w)).checkpoints[0].time).toBe(15);
    }
  });

  it("§9.3.2: runs without process control have no checkpoints", () => {
    expect(run(joinVariantsScenario("join")).checkpoints).toEqual([]);
    expect(run(eventRaceScenario("at-trigger")).checkpoints).toEqual([]);
  });

  it("§4.7: the reverse scheduler order changes no time or reach in the tree scenarios", () => {
    for (const s of [wrapperScenario("fork-join"), wrapperScenario("begin-end"), finishedChildScenario("disable-fork"), finishedChildScenario("wait-fork")]) {
      const a = run(s);
      const b = run(s, "reverse");
      expect(b.result.log.map((l) => `${l.time}:${l.text}`).sort()).toEqual(a.result.log.map((l) => `${l.time}:${l.text}`).sort());
      expect(b.checkpoints.map((c) => labelsOf(c, c.reached).sort())).toEqual(a.checkpoints.map((c) => labelsOf(c, c.reached).sort()));
    }
  });

  it("a checkpoint's tree is the step before the statement, so it does not show the answer", () => {
    const [cp] = run(timeoutBenchScenario("none", false)).checkpoints;
    expect(cp.before.some((n) => n.state === "killed")).toBe(false);
  });
});

describe("grading a prediction", () => {
  const [cp] = run(timeoutBenchScenario("none", false)).checkpoints;

  it("an exact pick is correct", () => {
    const g = gradeTreePrediction(cp, [pidOf(cp, "monitor"), pidOf(cp, "timer 1")]);
    expect(g.correct).toBe(true);
    expect(g.summary).toBe(`Correct. ${checkpointAnswer(cp)}`);
    expect(checkpointAnswer(cp)).toBe("disable fork kills monitor and timer 1.");
  });

  it("§9.6.3: missing the monitor is explained as an earlier fork's child", () => {
    const g = gradeTreePrediction(cp, [pidOf(cp, "timer 1")]);
    expect(g.correct).toBe(false);
    expect(g.misses).toBe(1);
    const monitor = g.nodes.find((n) => n.label === "monitor");
    expect(monitor?.verdict).toBe("missed");
    expect(monitor?.why).toMatch(/earlier fork statement/);
    expect(g.summary).toMatch(/You missed monitor\./);
  });

  it("§9.6.3: picking another procedure or a finished child is explained", () => {
    const g = gradeTreePrediction(cp, [pidOf(cp, "watchdog"), pidOf(cp, "rsp 1")]);
    expect(g.extras).toBe(2);
    expect(g.nodes.find((n) => n.label === "watchdog")?.why).toMatch(/separate procedure/);
    expect(g.nodes.find((n) => n.label === "rsp 1")?.why).toMatch(/already finished/);
  });

  it("§9.6.3: the finished-child miss names the finished parent", () => {
    const [fc] = run(finishedChildScenario("disable-fork")).checkpoints;
    const g = gradeTreePrediction(fc, []);
    expect(g.nodes.find((n) => n.label === "G")?.why).toMatch(/parent → C → G.*even though C has already finished/);
  });

  it("§9.6.3: a killed process between the caller and the victim is described as killed, not finished", () => {
    const before = [
      { pid: 0, label: "P", parent: null, depth: 0, state: "running" as const, kind: "initial" as const, children: [1] },
      { pid: 1, label: "K", parent: 0, depth: 1, state: "killed" as const, kind: "child" as const, children: [2] },
      { pid: 2, label: "G", parent: 1, depth: 2, state: "blocked" as const, kind: "child" as const, children: [] },
    ];
    const synthetic: TreeCheckpoint = {
      id: "disable-fork:1",
      kind: "disable-fork",
      stepIndex: 1,
      time: 0,
      lineKey: "x",
      statement: "disable fork;",
      callerPid: 0,
      callerLabel: "P",
      before,
      candidates: [1, 2],
      reached: [2],
      unwound: [],
      latestForkChildren: [1],
    };
    const why = gradeTreePrediction(synthetic, []).nodes.find((n) => n.label === "G")?.why;
    expect(why).toMatch(/even though K has already been killed:/);
    expect(why).not.toMatch(/K has already finished/);
  });

  it("§9.6.3: a grandchild reached through a running child cites the clause inside the sentence", () => {
    const before = [
      { pid: 0, label: "P", parent: null, depth: 0, state: "running" as const, kind: "initial" as const, children: [1] },
      { pid: 1, label: "C", parent: 0, depth: 1, state: "blocked" as const, kind: "child" as const, children: [2] },
      { pid: 2, label: "G", parent: 1, depth: 2, state: "blocked" as const, kind: "child" as const, children: [] },
    ];
    const synthetic: TreeCheckpoint = {
      id: "disable-fork:1",
      kind: "disable-fork",
      stepIndex: 1,
      time: 0,
      lineKey: "x",
      statement: "disable fork;",
      callerPid: 0,
      callerLabel: "P",
      before,
      candidates: [1, 2],
      reached: [1, 2],
      unwound: [],
      latestForkChildren: [1],
    };
    expect(gradeTreePrediction(synthetic, []).nodes.find((n) => n.label === "G")?.why).toBe(
      "G is a descendant of P (P → C → G), so disable fork kills it too (§9.6.3).",
    );
  });

  it("the extras clause uses the statement's own verb: kill for disable fork, wait for for wait fork", () => {
    const killExtras = gradeTreePrediction(cp, [pidOf(cp, "monitor"), pidOf(cp, "timer 1"), pidOf(cp, "watchdog")]);
    expect(killExtras.summary).toMatch(/ It does not kill watchdog\.$/);
    const [wc] = run(finishedChildScenario("wait-fork")).checkpoints;
    expect(gradeTreePrediction(wc, [pidOf(wc, "G")]).summary).toMatch(/ It does not wait for G\.$/);
    const [named] = run(timeoutBenchScenario("named", true)).checkpoints;
    expect(gradeTreePrediction(named, [...named.reached, pidOf(named, "monitor")]).summary).toMatch(/ It does not reach monitor\.$/);
  });

  it("§9.6.1: picking a grandchild for wait fork is explained", () => {
    const [wc] = run(finishedChildScenario("wait-fork")).checkpoints;
    const g = gradeTreePrediction(wc, [pidOf(wc, "G")]);
    expect(g.correct).toBe(false);
    expect(g.nodes.find((n) => n.label === "G")?.why).toMatch(/grandchild.*immediate children only/);
    expect(gradeTreePrediction(wc, []).correct).toBe(true);
    expect(checkpointAnswer(wc)).toBe("wait fork waits for no process.");
  });

  it("the caller is never a candidate, and the question names its time and statement", () => {
    expect(cp.candidates).not.toContain(cp.callerPid);
    expect(checkpointQuestion(cp)).toBe("At t = 15 ns, test is about to run disable fork. Which processes does it kill? Tap each one you predict, or none.");
  });
});

describe("tree text and rows", () => {
  it("rows are depth-first with parents before children; the description names every node", () => {
    const { result } = run(finishedChildScenario("disable-fork"));
    const last = result.trace[result.trace.length - 1];
    const tree = processTree(last);
    expect(treeRows(tree).map((r) => [r.node.label, r.parentRow])).toEqual([
      ["parent", null],
      ["C", 0],
      ["G", 1],
    ]);
    expect(describeTree(tree, last.time)).toBe(`Process tree at t = ${last.time} ns: parent (finished, procedure); C (finished, child of parent); G (killed, child of C).`);
    expect(describeTree([], 0)).toBe("Process tree at t = 0 ns: no process yet.");
  });

  it("rows stay depth-first when sibling subtrees are created interleaved, and each parentRow points at its parent", () => {
    const { result } = run(timeoutBenchScenario("isolate", true));
    const tree = processTree(result.trace[result.trace.length - 1]);
    const rows = treeRows(tree);
    expect(rows.map((r) => [r.node.label, r.parentRow])).toEqual([
      ["test", null],
      ["monitor", 0],
      ["xfer(1)", 0],
      ["wrapper 1", 2],
      ["rsp 1", 3],
      ["timer 1", 3],
      ["xfer(2)", 0],
      ["wrapper 2", 6],
      ["rsp 2", 7],
      ["timer 2", 7],
      ["watchdog", null],
    ]);
    // Creation order differs from row order here, which is what the parentRow mapping must survive.
    expect(tree.map((n) => n.label)).not.toEqual(rows.map((r) => r.node.label));
    for (const r of rows) {
      const parentRow = rows.find((p) => p.node.pid === r.node.parent);
      expect(r.parentRow).toBe(parentRow ? parentRow.row : null);
    }
  });

  it("lists read naturally and ids are recognised", () => {
    expect(listLabels([])).toBe("no process");
    expect(listLabels(["a", "b", "c"])).toBe("a, b and c");
    expect(isTreeScenarioId("wrapper-begin-end")).toBe(true);
    expect(isTreeScenarioId("wait-fork")).toBe(false);
  });
});
