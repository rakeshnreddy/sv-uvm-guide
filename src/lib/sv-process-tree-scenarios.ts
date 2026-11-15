/**
 * The process tree behind fork-join, wait fork, disable fork and disable by
 * name, as a pure model on top of `sv-process-model` (which it does not
 * change). The simulator decides what happens; this file reads its trace as a
 * parent-child tree, finds the steps where a process-control statement runs,
 * and grades a learner's "which processes does it reach?" prediction.
 *
 * Rules (IEEE 1800-2023, checked against the standard's text):
 * - §9.5: SystemVerilog creates a thread of execution for each initial, final
 *   and always-family procedure and for each parallel statement of a fork-join
 *   (join, join_any or join_none). A begin-end block is not in that list: per
 *   §9.3.1 its statements run in sequence in the process that reaches it, so
 *   it adds no node to the tree. (The standard states the list; "begin-end adds
 *   no process" is the reading of that list, not a sentence of its own.) A
 *   task call is not in the list either, so by the same reading it runs in
 *   the caller's process and adds no node.
 * - §9.3.2: join waits for every spawned process, join_any for any one,
 *   join_none for none; spawned processes start only once the parent blocks or
 *   terminates.
 * - §9.6.1: wait fork blocks until all immediate child subprocesses have
 *   terminated, "excluding their descendants".
 * - §9.6.2: disable ends the activity of a named block or task, and all
 *   activity enabled within it; execution resumes at the statement after the
 *   block. A process waiting inside the block itself is therefore forced out of
 *   it and carries on, not ended. "Disabling an automatic task or a block
 *   inside an automatic task proceeds as for regular tasks for all concurrent
 *   executions of the task", and a task enabled more than once has all its
 *   activations disabled, so a block inside an automatic task is reached in
 *   every concurrent call. §9.6.3 adds that disable uses the static block name
 *   and so ends every process executing that block, whatever its parent.
 * - §9.6.3: disable fork terminates all descendant subprocesses of the calling
 *   process, "including descendants of subprocesses that have already
 *   terminated".
 *
 * Model limits: the same as sv-process-model (declaration order for ready
 * processes, §4.7 leaves it open; no #0; no process::kill). A wait fork that
 * sits on the same line as another statement (`#5 wait fork;`) is not offered
 * as a prediction point, because its line is shared.
 */

import {
  c,
  type PreparedScenario,
  type ProcedureKind,
  type ProcessScenario,
  type ProcessScenarioId,
  type SimResult,
  type Stmt,
  type ThreadState,
  type TraceStep,
} from "@/lib/sv-process-model";

/* ------------------------------------------------------------------------- */
/* Scenario ids                                                               */
/* ------------------------------------------------------------------------- */

export type TreeScenarioId = "wrapper-begin-end" | "finished-child-grandchild";

/** Every scenario ForkJoinVisualizer accepts: the process-model ones plus the tree ones. */
export type ForkJoinScenarioId = ProcessScenarioId | TreeScenarioId;

export const TREE_SCENARIO_IDS: TreeScenarioId[] = ["wrapper-begin-end", "finished-child-grandchild"];

export function isTreeScenarioId(id: string): id is TreeScenarioId {
  return (TREE_SCENARIO_IDS as string[]).includes(id);
}

/* ------------------------------------------------------------------------- */
/* Scenario builders (existing statement kinds only)                           */
/* ------------------------------------------------------------------------- */

const display = (format: string): Stmt => ({ kind: "display", format, args: [] });
const delay = (amount: number, then?: Stmt): Stmt => ({ kind: "delay", amount: c(amount), then });

export type WrapperVariant = "fork-join" | "begin-end" | "none";

export const WRAPPER_VARIANTS: { value: WrapperVariant; label: string }[] = [
  { value: "fork-join", label: "fork begin … end join" },
  { value: "begin-end", label: "begin … end" },
  { value: "none", label: "none" },
];

/**
 * test forks a background monitor, then races a response (#15) against a
 * timer (#40) with join_any and cleans up with disable fork. The race and its
 * cleanup sit inside the chosen wrapper. Only `fork begin … end join` creates a
 * process (§9.5), so only it changes which process calls disable fork.
 */
export function wrapperScenario(wrapper: WrapperVariant): ProcessScenario {
  const race: Stmt = {
    id: "race",
    kind: "fork",
    join: "join_any",
    branches: [delay(15, display("response")), delay(40, display("TIMEOUT"))],
    labels: ["rsp", "timer"],
  };
  const cleanup: Stmt = { id: "cleanup", kind: "disableFork" };
  const guarded: Stmt[] =
    wrapper === "fork-join"
      ? [{ id: "wrapper", kind: "fork", join: "join", branches: [{ id: "wrapper-body", kind: "seq", body: [race, cleanup] }], labels: ["wrapper"] }]
      : wrapper === "begin-end"
        ? [{ id: "wrapper-body", kind: "seq", body: [race, cleanup], comment: "wrapper" }]
        : [race, cleanup];
  return {
    id: `tree-wrapper:${wrapper}`,
    title: "Does a wrapper isolate disable fork?",
    processes: [
      {
        id: "test",
        label: "test",
        kind: "initial",
        body: [
          { id: "spawn-monitor", kind: "fork", join: "join_none", branches: [{ kind: "forever", body: [delay(10, display("monitor alive"))] }], labels: ["monitor"] },
          ...guarded,
          { ...delay(30, display("test done")), id: "test-wait" },
          { kind: "finish" },
        ],
      },
    ],
  };
}

export type CleanupVariant = "disable-fork" | "wait-fork";

export const CLEANUP_VARIANTS: { value: CleanupVariant; label: string }[] = [
  { value: "disable-fork", label: "disable fork" },
  { value: "wait-fork", label: "wait fork" },
];

/** Delays of the finished-child scenario, so text and tests read them from one place. */
export const FINISHED_CHILD_TIMES = { childEnds: 5, cleanupAt: 10, grandchildEnds: 50 } as const;

/**
 * parent forks C with join; C forks its own child G (join_none) and finishes
 * at 5 ns. At 10 ns parent runs the cleanup statement. C has already
 * terminated, so G is parent's grandchild through a finished child: disable
 * fork still kills it (§9.6.3); wait fork does not wait for it (§9.6.1).
 */
export function finishedChildScenario(cleanup: CleanupVariant): ProcessScenario {
  const { childEnds, cleanupAt, grandchildEnds } = FINISHED_CHILD_TIMES;
  return {
    id: `tree-finished-child:${cleanup}`,
    title: "A finished child with a running grandchild",
    processes: [
      {
        id: "parent",
        label: "parent",
        kind: "initial",
        body: [
          {
            id: "spawn-c",
            kind: "fork",
            join: "join",
            labels: ["C"],
            branches: [
              {
                kind: "seq",
                body: [
                  { id: "spawn-g", kind: "fork", join: "join_none", branches: [delay(grandchildEnds, display("G done"))], labels: ["G"] },
                  delay(childEnds, display("C done")),
                ],
              },
            ],
          },
          { id: "parent-wait", ...delay(cleanupAt - childEnds) },
          cleanup === "disable-fork" ? { id: "cleanup", kind: "disableFork" } : { id: "cleanup", kind: "waitFork" },
          display("parent passes cleanup"),
        ],
      },
    ],
  };
}

/* ------------------------------------------------------------------------- */
/* The tree at one trace step                                                 */
/* ------------------------------------------------------------------------- */

export interface TreeNode {
  pid: number;
  label: string;
  parent: number | null;
  depth: number;
  state: ThreadState;
  kind: ProcedureKind | "child";
  /** Children in creation order. */
  children: number[];
}

export const isTerminatedState = (state: ThreadState) => state === "done" || state === "killed";

/** The process forest at a step, in creation order. Only processes created so far appear. */
export function processTree(step: TraceStep): TreeNode[] {
  const nodes: TreeNode[] = step.procs.map((p) => ({ pid: p.pid, label: p.label, parent: p.parent, depth: p.depth, state: p.state, kind: p.kind, children: [] }));
  const byPid = new Map(nodes.map((n) => [n.pid, n]));
  nodes.forEach((n) => {
    if (n.parent !== null) byPid.get(n.parent)?.children.push(n.pid);
  });
  return nodes;
}

const nodeOf = (tree: TreeNode[], pid: number) => tree.find((n) => n.pid === pid);

/** Immediate children of a process, finished or not (§9.6.1's "immediate child subprocesses"). */
export function immediateChildrenOf(tree: TreeNode[], pid: number): number[] {
  return nodeOf(tree, pid)?.children.slice() ?? [];
}

/** Every descendant, through finished and killed processes too (§9.6.3). Depth-first, creation order. */
export function descendantsOf(tree: TreeNode[], pid: number): number[] {
  const out: number[] = [];
  const visit = (p: number) =>
    immediateChildrenOf(tree, p).forEach((k) => {
      out.push(k);
      visit(k);
    });
  visit(pid);
  return out;
}

/** The chain of parents from `pid` up to its root, nearest first (excluding `pid`). */
export function ancestorsOf(tree: TreeNode[], pid: number): number[] {
  const out: number[] = [];
  let at = nodeOf(tree, pid)?.parent ?? null;
  while (at !== null) {
    out.push(at);
    at = nodeOf(tree, at)?.parent ?? null;
  }
  return out;
}

/** §9.6.3: the processes disable fork ends — living descendants of the caller. */
export function disableForkReach(tree: TreeNode[], caller: number): number[] {
  return descendantsOf(tree, caller).filter((pid) => !isTerminatedState(nodeOf(tree, pid)?.state ?? "done"));
}

/** §9.6.1: the processes wait fork waits for — living immediate children of the caller. */
export function waitForkReach(tree: TreeNode[], caller: number): number[] {
  return immediateChildrenOf(tree, caller).filter((pid) => !isTerminatedState(nodeOf(tree, pid)?.state ?? "done"));
}

/* ------------------------------------------------------------------------- */
/* Checkpoints: steps where a process-control statement runs                  */
/* ------------------------------------------------------------------------- */

export type CheckpointKind = "disable-fork" | "wait-fork" | "disable-name";

export interface TreeCheckpoint {
  id: string;
  kind: CheckpointKind;
  /** Index of the trace step that executes the statement; the learner predicts at stepIndex - 1. */
  stepIndex: number;
  time: number;
  lineKey: string;
  /** Source text of the statement, e.g. `disable fork;`. */
  statement: string;
  /** For disable-name: the block or task name. */
  target?: string;
  callerPid: number;
  callerLabel: string;
  /** The tree just before the statement runs (what the learner sees while predicting). */
  before: TreeNode[];
  /** Processes the learner may tap: every node except the caller, in tree order. */
  candidates: number[];
  /** What the statement reaches, read from the simulator's trace. */
  reached: number[];
  /** For disable-name: of `reached`, the processes forced out of the block rather than killed. */
  unwound: number[];
  /** For disable-name: the automatic task the block sits in, if any (§9.6.2's block-in-automatic-task rule). */
  automaticTask?: string;
  /**
   * The caller's children spawned by its most recent fork statement. A fork
   * creates all of its processes in one trace step, so children that first
   * appear in the same step came from the same fork.
   */
  latestForkChildren: number[];
}

type ControlStatement = { kind: CheckpointKind; lineKey: string; target?: string; automaticTask?: string };

function collectControlStatements(prepared: PreparedScenario): ControlStatement[] {
  const out: ControlStatement[] = [];
  let automaticTask: string | undefined;
  const visit = (stmt: Stmt, nestedInThen: boolean) => {
    const key = stmt.id ? prepared.lineKeyOf.get(stmt.id) : undefined;
    switch (stmt.kind) {
      case "disableFork":
        if (key) out.push({ kind: "disable-fork", lineKey: key });
        return;
      case "disable":
        if (key) out.push({ kind: "disable-name", lineKey: key, target: stmt.target, automaticTask });
        return;
      case "waitFork":
        // A wait fork sharing a line with a delay or event control cannot be told apart by line.
        if (key && !nestedInThen) out.push({ kind: "wait-fork", lineKey: key });
        return;
      case "delay":
      case "waitEvent":
      case "waitEdge":
      case "waitTriggered":
      case "waitCond":
      case "waitEvents":
        if (stmt.then) visit(stmt.then, true);
        return;
      case "seq":
      case "repeat":
      case "for":
      case "forever":
      case "while":
        stmt.body.forEach((s) => visit(s, false));
        return;
      case "fork":
        stmt.branches.forEach((s) => visit(s, false));
        return;
      case "if":
        stmt.then.forEach((s) => visit(s, false));
        stmt.else?.forEach((s) => visit(s, false));
        return;
      default:
        return;
    }
  };
  prepared.scenario.tasks?.forEach((t) => {
    automaticTask = t.automatic ? t.name : undefined;
    t.body.forEach((s) => visit(s, false));
  });
  automaticTask = undefined;
  prepared.scenario.processes.forEach((p) => p.body.forEach((s) => visit(s, false)));
  return out;
}

const STATEMENT_TEXT: Record<CheckpointKind, (target?: string) => string> = {
  "disable-fork": () => "disable fork;",
  "wait-fork": () => "wait fork;",
  "disable-name": (target) => `disable ${target ?? ""};`,
};

/**
 * Every step of a run where disable fork, wait fork or disable <name>
 * executes, with the tree before it and what the simulator says it reached.
 */
export function findTreeCheckpoints(result: SimResult, prepared: PreparedScenario): TreeCheckpoint[] {
  const statements = collectControlStatements(prepared);
  const out: TreeCheckpoint[] = [];
  result.trace.forEach((step, index) => {
    if (index === 0 || step.pid === undefined || !step.lineKey) return;
    const match = statements.find((s) => s.lineKey === step.lineKey);
    if (!match) return;
    const isControlStep = match.kind === "wait-fork" ? step.kind === "block" || step.kind === "exec" : step.kind === "kill";
    if (!isControlStep) return;
    const previous = result.trace[index - 1];
    // A process keeps the line key of the wait fork it just passed; only the step that
    // reaches the statement (the caller was on another line before) is the checkpoint.
    if (previous.procs.find((p) => p.pid === step.pid)?.lineKey === step.lineKey && match.kind === "wait-fork") return;
    const before = processTree(result.trace[index - 1]);
    const caller = step.pid;
    const pidOfLabel = (label: string) => before.find((n) => n.label === label)?.pid;
    const fromLabels = (labels: string[] | undefined) => (labels ?? []).map(pidOfLabel).filter((p): p is number => p !== undefined);
    let reached: number[];
    let unwound: number[] = [];
    if (match.kind === "wait-fork") {
      // The simulator blocks on (or passes) wait fork from its own child list (§9.6.1); the
      // tree carries the same parent links, and a test pins the wake-up time to these children.
      reached = waitForkReach(processTree(step), caller);
    } else if (match.kind === "disable-fork") {
      reached = fromLabels(step.killed);
    } else {
      unwound = fromLabels(step.unwound);
      reached = [...fromLabels(step.killed), ...unwound];
    }
    const childSteps = before
      .filter((n) => n.parent === caller)
      .map((n) => ({ pid: n.pid, first: result.trace.findIndex((s) => s.procs.some((p) => p.pid === n.pid)) }));
    const lastFork = Math.max(-1, ...childSteps.map((c) => c.first));
    const latestForkChildren = childSteps.filter((c) => c.first === lastFork).map((c) => c.pid);
    const callerLabel = before.find((n) => n.pid === caller)?.label ?? `#${caller}`;
    out.push({
      id: `${match.kind}:${index}`,
      kind: match.kind,
      stepIndex: index,
      time: step.time,
      lineKey: step.lineKey,
      statement: STATEMENT_TEXT[match.kind](match.target),
      target: match.target,
      callerPid: caller,
      callerLabel,
      before,
      candidates: treeOrder(before)
        .filter((n) => n.pid !== caller)
        .map((n) => n.pid),
      reached,
      unwound,
      automaticTask: match.automaticTask,
      latestForkChildren,
    });
  });
  return out;
}

/* ------------------------------------------------------------------------- */
/* Grading a prediction                                                       */
/* ------------------------------------------------------------------------- */

export type NodeVerdict = "hit" | "missed" | "extra" | "clear";

export interface NodeFeedback {
  pid: number;
  label: string;
  reached: boolean;
  picked: boolean;
  verdict: NodeVerdict;
  why: string;
}

export interface TreeGrade {
  correct: boolean;
  hits: number;
  misses: number;
  extras: number;
  /** One entry per candidate, in tree order. */
  nodes: NodeFeedback[];
  summary: string;
}

/** "a", "a and b", "a, b and c"; "no process" when empty. */
export const listLabels = (labels: string[]) =>
  labels.length === 0 ? "no process" : labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;

/**
 * What the statement does to the processes it ends (or waits for). For
 * disable <name>, `past` covers only the processes it ends: a process waiting
 * inside the block itself is forced out and carries on (§9.6.2), see `nodeOutcome`.
 */
export const CHECKPOINT_VERBS: Record<CheckpointKind, { base: string; ask: string; past: string }> = {
  "disable-fork": { base: "kill", ask: "kills", past: "killed" },
  "wait-fork": { base: "wait for", ask: "waits for", past: "waited for" },
  "disable-name": { base: "end", ask: "ends", past: "ended" },
};

const labelsIn = (cp: TreeCheckpoint, pids: number[]) =>
  treeOrder(cp.before)
    .filter((n) => pids.includes(n.pid))
    .map((n) => n.label);

/** For disable-name: the reached processes it ends, as opposed to the ones it forces out of the block. */
const endedPids = (cp: TreeCheckpoint) => cp.reached.filter((pid) => !cp.unwound.includes(pid));

/** The block name used in disable-name text. */
const targetName = (cp: TreeCheckpoint) => cp.target ?? "the block";

/** What the statement did to one candidate, for the reveal row: "killed", "forced out of guard", "not reached". */
export function nodeOutcome(cp: TreeCheckpoint, pid: number): string {
  if (!cp.reached.includes(pid)) return "not reached";
  if (cp.unwound.includes(pid)) return `forced out of ${targetName(cp)}`;
  return CHECKPOINT_VERBS[cp.kind].past;
}

/**
 * The model's answer in one sentence, e.g. "disable fork kills monitor and timer 1."
 * For disable <name> it keeps the processes it ends apart from the ones it
 * forces out of the block, which carry on after it (§9.6.2).
 */
export function checkpointAnswer(cp: TreeCheckpoint): string {
  if (cp.kind !== "disable-name" || cp.unwound.length === 0) {
    return `${statementName(cp)} ${CHECKPOINT_VERBS[cp.kind].ask} ${listLabels(labelsIn(cp, cp.reached))}.`;
  }
  const target = targetName(cp);
  const out = labelsIn(cp, cp.unwound);
  return `${statementName(cp)} ends ${listLabels(labelsIn(cp, endedPids(cp)))}, and forces ${listLabels(out)} out of ${target}; ${listLabels(out)} ${
    out.length === 1 ? "carries" : "carry"
  } on after the block (§9.6.2).`;
}

/** The statement without its semicolon, for use inside a sentence: "disable fork". */
export const statementName = (cp: TreeCheckpoint) => cp.statement.replace(/;$/, "");

export function checkpointQuestion(cp: TreeCheckpoint): string {
  const ask =
    cp.kind === "disable-name"
      ? `Which processes does it reach (end, or force out of ${targetName(cp)})?`
      : `Which processes does it ${CHECKPOINT_VERBS[cp.kind].base}?`;
  return `At t = ${cp.time} ns, ${cp.callerLabel} is about to run ${statementName(cp)}. ${ask} Tap each one you predict, or none.`;
}

/** "You missed …" for the summary; for disable <name> it says which missed processes are ended and which forced out. */
function missedText(cp: TreeCheckpoint, missed: number[]): string {
  if (missed.length === 0) return "";
  if (cp.kind !== "disable-name") return ` You missed ${listLabels(labelsIn(cp, missed))}.`;
  const ended = labelsIn(cp, missed.filter((pid) => !cp.unwound.includes(pid)));
  const out = labelsIn(cp, missed.filter((pid) => cp.unwound.includes(pid)));
  const parts = [
    ...(ended.length ? [`${listLabels(ended)}, which it ends`] : []),
    ...(out.length ? [`${listLabels(out)}, which it forces out of ${targetName(cp)}`] : []),
  ];
  return ` You missed ${parts.join(", and ")}.`;
}

function relationText(tree: TreeNode[], pid: number): string {
  const node = nodeOf(tree, pid);
  if (!node) return "";
  if (node.parent === null) return `${node.label} is a separate procedure, the root of its own tree (§9.5)`;
  const parent = nodeOf(tree, node.parent);
  return `${node.label} is a child of ${parent?.label ?? "another process"}`;
}

const aliveText = (state: ThreadState) => (state === "pending" ? "alive (spawned, not yet started)" : "still running");

function endedText(state: ThreadState): string {
  return state === "killed" ? "been killed" : "finished";
}

function explain(cp: TreeCheckpoint, node: TreeNode, reached: boolean): string {
  const tree = cp.before;
  const caller = cp.callerLabel;
  const isDescendant = descendantsOf(tree, cp.callerPid).includes(node.pid);
  const isChild = node.parent === cp.callerPid;
  const isAncestor = ancestorsOf(tree, cp.callerPid).includes(node.pid);
  const ended = isTerminatedState(node.state);
  // Labels of the processes between the caller and this node, nearest the caller first.
  const between = ancestorsOf(tree, node.pid)
    .slice(0, ancestorsOf(tree, node.pid).indexOf(cp.callerPid))
    .reverse()
    .map((pid) => nodeOf(tree, pid) as TreeNode);
  const endedBetween = between.filter((n) => isTerminatedState(n.state));

  if (cp.kind === "disable-fork") {
    if (reached) {
      if (isChild) {
        const earlier = cp.latestForkChildren.includes(node.pid)
          ? ""
          : " An earlier fork statement created it: disable fork is not limited to the most recent fork.";
        return `${node.label} is a child of ${caller} and ${aliveText(node.state)}, so disable fork kills it (§9.6.3).${earlier}`;
      }
      const path = [caller, ...between.map((n) => n.label), node.label].join(" → ");
      const through = endedBetween.length
        ? ` It dies even though ${listLabels(endedBetween.map((n) => `${n.label} has already ${endedText(n.state)}`))}: disable fork reaches descendants of subprocesses that have already terminated (§9.6.3).`
        : "";
      return `${node.label} is a descendant of ${caller} (${path}), so disable fork kills it too${endedBetween.length ? "." : " (§9.6.3)."}${through}`;
    }
    if (isDescendant && ended) return `${node.label} is a ${isChild ? "child" : "descendant"} of ${caller}, but it has already ${endedText(node.state)}, so there is nothing left for disable fork to end.`;
    if (isAncestor) return `${node.label} is an ancestor of ${caller}, not a descendant. disable fork never reaches up the tree (§9.6.3).`;
    return `${relationText(tree, node.pid)}, not a descendant of ${caller}. disable fork follows only the calling process's own subtree (§9.6.3).`;
  }

  if (cp.kind === "wait-fork") {
    if (reached) return `${node.label} is an immediate child of ${caller} and ${aliveText(node.state)}, so wait fork waits for it (§9.6.1).`;
    if (isChild && ended) return `${node.label} is an immediate child of ${caller}, but it has already ${endedText(node.state)}, so there is nothing to wait for.`;
    if (isAncestor) return `${node.label} is an ancestor of ${caller}, not a child. wait fork waits only for the calling process's immediate children (§9.6.1).`;
    if (isDescendant) {
      const kin = node.depth - (nodeOf(tree, cp.callerPid)?.depth ?? 0) === 2 ? "grandchild" : "descendant";
      return `${node.label} is a ${kin} of ${caller}, not an immediate child. wait fork waits for immediate children only, excluding their descendants (§9.6.1)${ended ? "." : `, so ${node.label} runs on without holding ${caller}.`}`;
    }
    return `${relationText(tree, node.pid)}, not a child of ${caller}. wait fork waits only for the calling process's own children (§9.6.1).`;
  }

  // disable <name>: reach comes from the simulator, which tracks which processes execute the block.
  const target = targetName(cp);
  if (reached) {
    if (cp.unwound.includes(node.pid)) {
      return `${node.label} is executing inside ${target} itself, so disable ${target} forces it out of the block; it carries on after the block (§9.6.2).`;
    }
    const rule = cp.automaticTask
      ? ` ${target} sits in the automatic task ${cp.automaticTask}, and disabling a block inside an automatic task acts on all concurrent executions of the task (§9.6.2).`
      : "";
    return `${node.label} is a process running inside ${target}. disable uses the block's static name, so it ends every process executing ${target}, whichever call started it (§9.6.2, §9.6.3).${rule}`;
  }
  if (ended) return `${node.label} has already ${endedText(node.state)}, so there is nothing left to end.`;
  return `${node.label} is not executing ${target}, so disable ${target} does not reach it, whatever its place in the tree (§9.6.3).`;
}

/** Grades the set of processes a learner predicted the statement reaches. */
export function gradeTreePrediction(cp: TreeCheckpoint, picked: number[]): TreeGrade {
  const nodes: NodeFeedback[] = cp.candidates.map((pid) => {
    const node = nodeOf(cp.before, pid) as TreeNode;
    const reached = cp.reached.includes(pid);
    const isPicked = picked.includes(pid);
    const verdict: NodeVerdict = reached ? (isPicked ? "hit" : "missed") : isPicked ? "extra" : "clear";
    return { pid, label: node.label, reached, picked: isPicked, verdict, why: explain(cp, node, reached) };
  });
  const hits = nodes.filter((n) => n.verdict === "hit").length;
  const misses = nodes.filter((n) => n.verdict === "missed").length;
  const extras = nodes.filter((n) => n.verdict === "extra").length;
  const correct = misses === 0 && extras === 0;
  const answer = checkpointAnswer(cp);
  const summary = correct
    ? `Correct. ${answer}`
    : `Not quite. ${answer}${missedText(cp, nodes.filter((n) => n.verdict === "missed").map((n) => n.pid))}${
        extras ? ` It does not ${cp.kind === "disable-name" ? "reach" : CHECKPOINT_VERBS[cp.kind].base} ${listLabels(nodes.filter((n) => n.verdict === "extra").map((n) => n.label))}.` : ""
      }`;
  return { correct, hits, misses, extras, nodes, summary };
}

/* ------------------------------------------------------------------------- */
/* Tree text and layout (pure, shared by the SVG and its text outline)         */
/* ------------------------------------------------------------------------- */

export const TREE_STATE_TEXT: Record<ThreadState, string> = {
  pending: "not started",
  ready: "ready",
  running: "running",
  blocked: "blocked",
  done: "finished",
  killed: "killed",
};

/** Depth-first order (roots in creation order), the order the outline and the SVG rows use. */
export function treeOrder(tree: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const visit = (n: TreeNode) => {
    out.push(n);
    n.children.forEach((k) => {
      const child = nodeOf(tree, k);
      if (child) visit(child);
    });
  };
  tree.filter((n) => n.parent === null || !nodeOf(tree, n.parent)).forEach(visit);
  return out;
}

/** One sentence describing the whole tree, for the SVG's accessible name. */
export function describeTree(tree: TreeNode[], time: number): string {
  if (tree.length === 0) return `Process tree at t = ${time} ns: no process yet.`;
  const parts = treeOrder(tree).map((n) => {
    const parent = n.parent !== null ? nodeOf(tree, n.parent) : undefined;
    return `${n.label} (${TREE_STATE_TEXT[n.state]}${parent ? `, child of ${parent.label}` : ", procedure"})`;
  });
  return `Process tree at t = ${time} ns: ${parts.join("; ")}.`;
}

export interface TreeRow {
  node: TreeNode;
  row: number;
  /** Parent's row, for the connector; null for a root. */
  parentRow: number | null;
}

/** Indented-tree rows: one row per process, so the drawing stays readable at 390 px. */
export function treeRows(tree: TreeNode[]): TreeRow[] {
  const ordered = treeOrder(tree);
  const rowOf = new Map(ordered.map((n, i) => [n.pid, i]));
  return ordered.map((node, row) => ({ node, row, parentRow: node.parent !== null ? (rowOf.get(node.parent) ?? null) : null }));
}
