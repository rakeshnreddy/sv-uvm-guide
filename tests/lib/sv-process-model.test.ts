import { describe, expect, it } from "vitest";

import {
  alignedOutcomeRuns,
  bin,
  c,
  divergenceFromBase,
  eventRaceScenario,
  exploreProcessOrders,
  firstDivergentStep,
  formatDisplay,
  inferCombSensitivity,
  inferStarSensitivity,
  lit,
  now,
  settledHistory,
  startOrder,
  stepNarrationBadges,
  STEP_KIND_LABELS,
  STEP_REGION_LABELS,
  valueAt,
  variableHistory,
  type EventTermDef,
  type Expr,
  type InitializerRule,
  type Stmt,
  forkLoopScenario,
  gradeKeyLeak,
  gradeTimeoutBench,
  joinVariantsScenario,
  keyLeakScenario,
  mailboxPut,
  mailboxScenario,
  mailboxTake,
  newMailbox,
  newSemaphore,
  prepareScenario,
  processLanes,
  semaphoreGet,
  semaphorePut,
  semaphoreScenario,
  simulateProcesses,
  timeoutBenchScenario,
  v,
  waitForkScenario,
  type ProcessScenario,
  type SimResult,
  type TraceStep,
} from "@/lib/sv-process-model";
import { proceduralScenarios } from "@/components/animations/procedural-blocks-data";

const lines = (r: SimResult) => r.log.map((l) => `${l.time}:${l.label}:${l.text}`);
const timeOf = (r: SimResult, text: string) => r.log.find((l) => l.text === text)?.time;

describe("§9.3.2 fork-join control options (Table 9-1)", () => {
  it("join resumes the parent when the last child ends, join_any at the first, join_none at once", () => {
    expect(timeOf(simulateProcesses(joinVariantsScenario("join")), "parent continues")).toBe(30);
    expect(timeOf(simulateProcesses(joinVariantsScenario("join_any")), "parent continues")).toBe(10);
    expect(timeOf(simulateProcesses(joinVariantsScenario("join_none")), "parent continues")).toBe(0);
  });

  it("join_any leaves the other children running", () => {
    const r = simulateProcesses(joinVariantsScenario("join_any"));
    expect(timeOf(r, "C done")).toBe(20);
    expect(timeOf(r, "B done")).toBe(30);
  });

  it("join_none children do not start until the parent blocks or terminates", () => {
    const r = simulateProcesses(joinVariantsScenario("join_none"));
    expect(r.log.map((l) => l.text).slice(0, 3)).toEqual(["parent: fork", "parent continues", "A starts"]);
    // While the parent is still running after the fork, every child is 'pending'.
    const afterFork = r.trace.find((s) => s.kind === "exec" && /forks A, B, C/.test(s.what));
    expect(afterFork?.procs.filter((p) => p.label !== "parent").every((p) => p.state === "pending")).toBe(true);
  });

  it("a join_none child starts at the parent's first blocking statement, not later", () => {
    const scenario: ProcessScenario = {
      id: "start-on-block",
      title: "",
      processes: [
        {
          id: "p",
          label: "parent",
          kind: "initial",
          body: [
            { kind: "fork", join: "join_none", branches: [{ kind: "display", format: "child runs", args: [] }], labels: ["child"] },
            { kind: "display", format: "parent before #5", args: [] },
            { kind: "delay", amount: c(5), then: { kind: "display", format: "parent after #5", args: [] } },
          ],
        },
      ],
    };
    expect(lines(simulateProcesses(scenario))).toEqual(["0:parent:parent before #5", "0:child:child runs", "5:parent:parent after #5"]);
  });
});

describe("§9.3.2 / §6.21 fork inside a loop", () => {
  it("children that read the loop variable all see its final value", () => {
    expect(simulateProcesses(forkLoopScenario("bug")).log.map((l) => l.text)).toEqual(["i = 3", "i = 3", "i = 3"]);
  });

  it("an automatic variable declared in the fork captures each iteration's value before spawning", () => {
    expect(simulateProcesses(forkLoopScenario("fork-automatic")).log.map((l) => l.text)).toEqual(["k = 0", "k = 1", "k = 2"]);
  });

  it("an automatic variable declared inside the spawned begin-end is initialized only when the child starts (the LRM's `m` example)", () => {
    expect(simulateProcesses(forkLoopScenario("begin-automatic")).log.map((l) => l.text)).toEqual(["m = 3", "m = 3", "m = 3"]);
  });
});

describe("§9.6.1 wait fork", () => {
  it("waits for immediate children only, not their descendants", () => {
    const r = simulateProcesses(waitForkScenario());
    expect(timeOf(r, "parent passes wait fork")).toBe(20);
    expect(timeOf(r, "G (grandchild) done")).toBe(50);
  });
});

describe("§9.6.3 disable fork", () => {
  it("kills every descendant of the caller, including a monitor forked earlier", () => {
    const r = simulateProcesses(timeoutBenchScenario("none", false));
    const kill = r.trace.find((s) => s.kind === "kill");
    expect(kill?.time).toBe(15);
    expect(kill?.killed?.sort()).toEqual(["monitor", "timer 1"]);
    expect(r.log.filter((l) => l.text === "monitor alive").map((l) => l.time)).toEqual([10]);
  });

  it("the isolation wrapper limits disable fork to the race", () => {
    const r = simulateProcesses(timeoutBenchScenario("isolate", false));
    expect(r.trace.find((s) => s.kind === "kill")?.killed).toEqual(["timer 1"]);
    expect(r.log.filter((l) => l.text === "monitor alive").map((l) => l.time)).toEqual([10, 20, 30, 40]);
  });

  it("also kills descendants of children that already terminated", () => {
    const scenario: ProcessScenario = {
      id: "orphans",
      title: "",
      processes: [
        {
          id: "p",
          label: "parent",
          kind: "initial",
          body: [
            {
              kind: "fork",
              join: "join_none",
              labels: ["C"],
              branches: [{ kind: "fork", join: "join_none", labels: ["G"], branches: [{ kind: "delay", amount: c(50), then: { kind: "display", format: "G done", args: [] } }] }],
            },
            { kind: "delay", amount: c(10) },
            { kind: "disableFork" },
          ],
        },
      ],
    };
    const r = simulateProcesses(scenario);
    const kill = r.trace.find((s) => s.kind === "kill");
    expect(kill?.procs.find((p) => p.label === "C")?.state).toBe("done");
    expect(kill?.killed).toEqual(["G"]);
    expect(r.log).toHaveLength(0);
  });

  it("killing a key holder does not return its semaphore keys", () => {
    const scenario: ProcessScenario = {
      id: "kill-holder",
      title: "",
      semaphores: [{ name: "sem", keys: 1 }],
      processes: [
        {
          id: "p",
          label: "parent",
          kind: "initial",
          body: [
            {
              kind: "fork",
              join: "join_none",
              labels: ["holder"],
              branches: [{ kind: "seq", body: [{ kind: "semaphore", op: "get", semaphore: "sem", keys: 1 }, { kind: "delay", amount: c(100) }] }],
            },
            { kind: "delay", amount: c(5) },
            { kind: "disableFork" },
          ],
        },
      ],
    };
    const r = simulateProcesses(scenario);
    expect(r.finalSemaphores.sem.keys).toBe(0);
    expect(r.trace.find((s) => s.kind === "kill")?.why).toMatch(/does not return them/);
  });
});

describe("§9.6.2 disable by block name", () => {
  it("with one activation, disable guard ends only that call's timer", () => {
    const r = simulateProcesses(timeoutBenchScenario("named", false));
    expect(r.trace.find((s) => s.kind === "kill")?.killed).toEqual(["timer 1"]);
  });

  it("disables every activation: xfer(2)'s block is ended by xfer(1)'s disable", () => {
    const r = simulateProcesses(timeoutBenchScenario("named", true));
    const kill = r.trace.find((s) => s.kind === "kill");
    expect(kill?.killed?.sort()).toEqual(["rsp 2", "timer 1", "timer 2"]);
    expect(kill?.unwound).toEqual(["xfer(2)"]);
    expect(r.log.map((l) => l.text)).not.toContain("xfer 2 response");
  });
});

describe("timeout-bench grading (debug challenge)", () => {
  it.each([
    ["none", false, false],
    ["none", true, true],
    ["isolate", false, true],
    ["isolate", true, true],
    ["named", false, true],
    ["named", true, false],
    ["wait-fork", false, false],
    ["remove", false, false],
  ] as const)("fix %s with concurrent=%s passes: %s", (fix, concurrent, passes) => {
    expect(gradeTimeoutBench(simulateProcesses(timeoutBenchScenario(fix, concurrent)), concurrent).passed).toBe(passes);
  });

  it("wait fork waits for the never-ending monitor, so the watchdog ends the run", () => {
    const r = simulateProcesses(timeoutBenchScenario("wait-fork", false));
    expect(r.outcome).toMatchObject({ kind: "finish", by: "watchdog", time: 100 });
  });
});

describe("§15.5 named events", () => {
  it("§15.5.2: -> with @ is a race — the outcome depends on which process runs first", () => {
    const exploration = exploreProcessOrders(eventRaceScenario("at-trigger"));
    expect(exploration.deterministic).toBe(false);
    const declared = simulateProcesses(eventRaceScenario("at-trigger"));
    expect(declared.blockedAtEnd.map((b) => b.label)).toEqual(["consumer"]);
    const reversed = simulateProcesses(eventRaceScenario("at-trigger"), { order: "reverse" });
    expect(reversed.log.map((l) => l.text)).toContain("consumer woke");
  });

  it("§15.5.3: wait(ev.triggered) catches a trigger earlier in the same time step, in every order", () => {
    const exploration = exploreProcessOrders(eventRaceScenario("triggered"));
    expect(exploration.deterministic).toBe(true);
    expect(exploration.outcomes[0].result.log.map((l) => l.text)).toContain("consumer woke");
  });

  it("§15.5.1: ->> triggers in the NBA region of the same time, so @ waiters always catch it", () => {
    const exploration = exploreProcessOrders(eventRaceScenario("nonblocking"));
    expect(exploration.deterministic).toBe(true);
    const r = simulateProcesses(eventRaceScenario("nonblocking"));
    const fire = r.trace.find((s) => s.region === "nba");
    expect(fire?.time).toBe(10);
    expect(timeOf(r, "consumer woke")).toBe(10);
  });

  it("§15.5.3: the triggered state persists for the whole time step, so a loop around wait(ev.triggered) never advances time", () => {
    const r = simulateProcesses(eventRaceScenario("triggered-loop"));
    expect(r.outcome).toMatchObject({ kind: "zero-delay-loop", time: 10, label: "consumer" });
  });

  it("the triggered state is cleared when time advances", () => {
    const scenario: ProcessScenario = {
      id: "stale",
      title: "",
      events: ["e"],
      processes: [
        { id: "a", label: "trigger", kind: "initial", body: [{ kind: "trigger", event: "e" }] },
        { id: "b", label: "late", kind: "initial", body: [{ kind: "delay", amount: c(1), then: { kind: "waitTriggered", event: "e" } }, { kind: "display", format: "passed", args: [] }] },
      ],
    };
    const r = simulateProcesses(scenario);
    expect(r.log).toHaveLength(0);
    expect(r.blockedAtEnd.map((b) => b.label)).toEqual(["late"]);
  });
});

describe("§15.3 semaphores", () => {
  it("§15.3.3: waiters are served first-in first-out", () => {
    const r = simulateProcesses(semaphoreScenario("fifo"));
    expect(timeOf(r, "B got the key")).toBe(10);
    expect(timeOf(r, "C got the key")).toBe(15);
  });

  it("§15.3.3: get(n) waits until n keys are available at once", () => {
    expect(timeOf(simulateProcesses(semaphoreScenario("multi-key")), "B got 2 keys")).toBe(10);
  });

  it("§15.3.1/§15.3.2: put may raise the count above the initial number of keys", () => {
    const after = semaphorePut(newSemaphore<string>(1), 2);
    expect(after.state.keys).toBe(3);
  });

  it("§15.3.4: try_get returns without blocking and takes nothing when keys are short", () => {
    const r = semaphoreGet(newSemaphore<string>(1), "A", 2, false);
    expect(r).toMatchObject({ acquired: false, blocked: false });
    expect(r.state.keys).toBe(1);
    expect(r.state.waiters).toHaveLength(0);
  });

  it("modelling assumption: a waiter whose request fits is served even if an earlier, larger request does not", () => {
    let sem = newSemaphore<string>(0);
    sem = semaphoreGet(sem, "big", 2, true).state;
    sem = semaphoreGet(sem, "small", 1, true).state;
    const r = semaphorePut(sem, 1);
    expect(r.woken.map((w) => w.who)).toEqual(["small"]);
    expect(r.state.waiters.map((w) => w.who)).toEqual(["big"]);
  });
});

describe("§15.4 mailboxes", () => {
  it("§15.4.3: put blocks while a bounded mailbox is full and resumes when a get frees a slot", () => {
    expect(timeOf(simulateProcesses(mailboxScenario(2)), "sent 2")).toBe(10);
    expect(timeOf(simulateProcesses(mailboxScenario(1)), "sent 2")).toBe(20);
  });

  it("§15.4.1: new() is unbounded, so put never blocks", () => {
    expect(timeOf(simulateProcesses(mailboxScenario(0)), "sent 3")).toBe(0);
  });

  it("§15.4.5: messages are delivered in FIFO order", () => {
    expect(simulateProcesses(mailboxScenario(2)).log.filter((l) => l.label === "consumer").map((l) => l.text)).toEqual(["got 0", "got 1", "got 2", "got 3"]);
  });

  it("§15.4.4: try_put on a full mailbox returns 0 and leaves it unchanged", () => {
    const full = mailboxPut(newMailbox<string>(1), "P", 7, true).state;
    const r = mailboxPut(full, "P", 8, false);
    expect(r).toMatchObject({ stored: false, blocked: false });
    expect(r.state.items).toEqual([7]);
  });

  it("§15.4.6: try_get on an empty mailbox returns nothing without blocking", () => {
    const r = mailboxTake(newMailbox<string>(2), "C", false, false);
    expect(r.value).toBeUndefined();
    expect(r.blocked).toBe(false);
    expect(r.state.getWaiters).toHaveLength(0);
  });

  it("§15.4.5: blocked getters are woken oldest-first", () => {
    let m = newMailbox<string>(2);
    m = mailboxTake(m, "C1", false, true).state;
    m = mailboxTake(m, "C2", false, true).state;
    const r = mailboxPut(m, "P", 5, true);
    expect(r.woken).toEqual([{ who: "C1", kind: "get", value: 5 }]);
    expect(r.state.getWaiters.map((w) => w.who)).toEqual(["C2"]);
  });

  it("§15.4.7: one message unblocks every waiting peek ahead of a get, and peek leaves it queued", () => {
    let m = newMailbox<string>(2);
    m = mailboxTake(m, "P1", true, true).state;
    m = mailboxTake(m, "P2", true, true).state;
    m = mailboxTake(m, "G", false, true).state;
    const r = mailboxPut(m, "prod", 9, true);
    expect(r.woken.map((w) => `${w.who}:${w.kind}`)).toEqual(["P1:peek", "P2:peek", "G:get"]);
    expect(r.state.items).toEqual([]);
    expect(mailboxTake(mailboxPut(newMailbox<string>(2), "prod", 3, true).state, "P", true, false).state.items).toEqual([3]);
  });
});

describe("semaphore key leak (debug challenge)", () => {
  it("an early return while holding the key deadlocks every later sender", () => {
    const r = simulateProcesses(keyLeakScenario("bug"));
    expect(r.outcome).toEqual({ kind: "quiet", time: 12 });
    expect(r.blockedAtEnd.map((b) => b.label)).toEqual(["driver", "checker"]);
    expect(gradeKeyLeak(r)).toMatchObject({ noHang: false, keysReturned: false });
  });

  it.each([
    ["put-before-return", { passed: true }],
    ["put-early", { noHang: true, noCollision: false, passed: false }],
    ["try-get", { noCollision: false, keysReturned: false, passed: false }],
    ["two-keys", { noHang: true, keysReturned: false, passed: false }],
  ] as const)("fix %s is graded %o", (fix, expected) => {
    expect(gradeKeyLeak(simulateProcesses(keyLeakScenario(fix)))).toMatchObject(expected);
  });
});

describe("§9.2 procedures and §9.2.3 final", () => {
  it("final runs once at the end of simulation, after $finish, with the settled values", () => {
    const r = simulateProcesses(proceduralScenarios[0].build("nba"));
    expect(r.outcome).toMatchObject({ kind: "finish", time: 22 });
    expect(r.log.filter((l) => l.region === "final").map((l) => `${l.time}:${l.text}`)).toEqual(["22:final: count = 2"]);
  });

  it("final also runs when simulation ends because nothing is left to do", () => {
    const scenario: ProcessScenario = {
      id: "quiet-final",
      title: "",
      vars: [{ name: "x", type: "int", init: 0 }],
      processes: [
        { id: "i", label: "init", kind: "initial", body: [{ kind: "delay", amount: c(7), then: { kind: "assign", target: "x", expr: c(4) } }] },
        { id: "f", label: "report", kind: "final", body: [{ kind: "display", format: "x = %0d", args: [v("x")] }] },
      ],
    };
    expect(lines(simulateProcesses(scenario))).toEqual(["7:report:x = 4"]);
  });

  it("§10.4.2: nonblocking updates land in the NBA region of the same time step, not a later time", () => {
    const r = simulateProcesses(proceduralScenarios[1].build("nba"));
    const updates = r.trace.filter((s) => s.region === "nba");
    expect(updates.map((s) => s.time)).toEqual([10, 10]);
    expect(r.log.map((l) => `${l.time}:${l.region}:${l.text}`)).toEqual([
      "10:active:display: a=1 b=2",
      "10:postponed:strobe: a=2 b=1",
      "11:active:one ns later: a=2 b=1",
    ]);
  });

  it("every procedural prediction has exactly one option the model confirms", () => {
    for (const preset of proceduralScenarios) {
      for (const style of preset.styleToggle ? (["nba", "blocking"] as const) : (["nba"] as const)) {
        const r = simulateProcesses(preset.build(style));
        expect(preset.options.filter((o) => o.matches(r)).map((o) => o.id), `${preset.id}/${style}`).toHaveLength(1);
      }
    }
  });
});

describe("trace integrity", () => {
  const all: ProcessScenario[] = [
    joinVariantsScenario("join"),
    joinVariantsScenario("join_none"),
    timeoutBenchScenario("isolate", true),
    timeoutBenchScenario("named", true),
    waitForkScenario(),
    forkLoopScenario("fork-automatic"),
    eventRaceScenario("nonblocking"),
    semaphoreScenario("fifo"),
    mailboxScenario(2),
    keyLeakScenario("bug"),
    ...proceduralScenarios.map((p) => p.build("nba")),
  ];

  it.each(all.map((s) => [s.id, s] as const))("%s replays identically and points only at generated source lines", (_id, scenario) => {
    const first = simulateProcesses(scenario);
    const second = simulateProcesses(scenario);
    expect(second.trace).toEqual(first.trace);
    first.trace.forEach((step, i) => expect(step.index).toBe(i));
    const keys = new Set(prepareScenario(scenario).source.map((l) => l.key).filter(Boolean));
    first.trace.forEach((step) => {
      if (step.lineKey) expect(keys.has(step.lineKey), `${step.lineKey} in ${scenario.id}`).toBe(true);
      step.procs.forEach((p) => {
        if (p.lineKey && p.state !== "done" && p.state !== "killed") expect(keys.has(p.lineKey), `${p.label}@${p.lineKey}`).toBe(true);
      });
    });
    expect(first.trace.at(-1)?.kind).toBe("end");
  });

  it("generated source shows the constructs the model executes", () => {
    const text = prepareScenario(timeoutBenchScenario("isolate", false)).source.map((l) => l.text.trim());
    expect(text).toContain("disable fork;");
    expect(text).toContain("join_any");
    expect(text.filter((t) => t.startsWith("fork"))).toHaveLength(3);
    const loop = prepareScenario(forkLoopScenario("fork-automatic")).source.map((l) => l.text.trim());
    expect(loop).toContain("automatic int k = i;");
    expect(loop).toContain("for (int i = 0; i < 3; i++) begin");
  });

  it("lanes record when a process was killed", () => {
    const r = simulateProcesses(timeoutBenchScenario("none", false));
    const monitor = processLanes(r).find((l) => l.label === "monitor");
    expect(monitor?.endState).toBe("killed");
    expect(monitor?.end).toBe(15);
    expect(monitor?.marks.some((m) => m.kind === "killed" && m.time === 15)).toBe(true);
  });
});

/* ========================================================================= */
/* The process-model core extension (event controls, procedure kinds,         */
/* initializers, severity, while, horizon, exploration options).             */
/* ========================================================================= */

const disp = (format: string, ...args: Expr[]): Stmt => ({ kind: "display", format, args });
const after = (amount: number, then?: Stmt): Stmt => ({ kind: "delay", amount: c(amount), then });
const set = (target: string, expr: Expr, nba = false): Stmt => ({ kind: "assign", target, expr, nba });
const on = (terms: EventTermDef[], then: Stmt, separator?: "or" | ","): Stmt => ({ kind: "waitEvents", terms, then, separator });

/** Fingerprint of everything a trace shows, except narration that the extension deliberately rewords. */
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Projection used for the golden fingerprints. Print steps keep their log line
 * (time, process, text, region) but drop narration, so the key-leak check
 * moving from $display to $error (same text) is not a trace change; final
 * steps drop `why`, which (h) relabels. Everything else is compared.
 */
function project(r: SimResult) {
  return {
    outcome: r.outcome,
    endTime: r.endTime,
    blockedAtEnd: r.blockedAtEnd,
    finalVars: r.finalVars,
    choices: r.choices,
    choiceWidths: r.choiceWidths,
    processes: r.processes,
    log: r.log.map((l) => [l.time, l.pid, l.label, l.text, l.region]),
    trace: r.trace.map((s) => [
      s.index,
      s.time,
      s.region,
      s.kind,
      s.pid ?? null,
      s.lineKey ?? null,
      s.kind === "print" ? null : s.what,
      s.kind === "print" || s.kind === "final" ? null : s.why,
      s.procs.map((p) => [p.pid, p.label, p.parent, p.depth, p.state, p.blockedOn ?? null, p.lineKey ?? null, p.kind]),
      s.vars,
      s.mailboxes,
      s.semaphores,
      s.events,
      s.log.length,
      s.killed ?? null,
      s.unwound ?? null,
      s.choice ?? null,
    ]),
  };
}

/** Fingerprints captured from the model before the event-control refactor (local edgeFires). */
const GOLDEN: Record<string, string> = {
  "join-variants:join|declaration": "fblo88bykj",
  "join-variants:join|reverse": "mlmdkb8rb9",
  "join-variants:join|explore": "tl2onxzwc3",
  "join-variants:join_any|declaration": "2wzqyy4xz8",
  "join-variants:join_any|reverse": "kdnluzv24j",
  "join-variants:join_any|explore": "2ab9xh8s0l5",
  "join-variants:join_none|declaration": "9eoa1wbzye",
  "join-variants:join_none|reverse": "2eq7jawp99u",
  "join-variants:join_none|explore": "27k7179sufh",
  "timeout:none:1|declaration": "108sjnpr70t",
  "timeout:none:1|reverse": "tbcjyxyhbp",
  "timeout:none:1|explore": "17nh7jbqavq",
  "timeout:none:2|declaration": "2gan6vq5dhl",
  "timeout:none:2|reverse": "20o751fp946",
  "timeout:none:2|explore": "throws:Scenario timeout:none:2 exceeded 128 orderings",
  "timeout:isolate:1|declaration": "5b1yj0loql",
  "timeout:isolate:1|reverse": "1v69qb6hxde",
  "timeout:isolate:1|explore": "1mqiteneq50",
  "timeout:isolate:2|declaration": "25cgsulg9dg",
  "timeout:isolate:2|reverse": "1lokocpbati",
  "timeout:isolate:2|explore": "throws:Scenario timeout:isolate:2 exceeded 128 orderings",
  "timeout:named:1|declaration": "1dxfd4kkilb",
  "timeout:named:1|reverse": "lnck8qe6o8",
  "timeout:named:1|explore": "29thp1pfudc",
  "timeout:named:2|declaration": "121zs5kvf79",
  "timeout:named:2|reverse": "1xo12tqsuw2",
  "timeout:named:2|explore": "throws:Scenario timeout:named:2 exceeded 128 orderings",
  "timeout:wait-fork:1|declaration": "n5ki0ao6d2",
  "timeout:wait-fork:1|reverse": "xsk0g8gg1",
  "timeout:wait-fork:1|explore": "1g8jtf1gxla",
  "timeout:wait-fork:2|declaration": "1n31lfa8nx0",
  "timeout:wait-fork:2|reverse": "104g1ongioc",
  "timeout:wait-fork:2|explore": "throws:Scenario timeout:wait-fork:2 exceeded 128 orderings",
  "timeout:remove:1|declaration": "1cnhjwgg0qz",
  "timeout:remove:1|reverse": "1w0wknze9bu",
  "timeout:remove:1|explore": "rhiktwgomr",
  "timeout:remove:2|declaration": "lkr9klz0qk",
  "timeout:remove:2|reverse": "4tvsek2775",
  "timeout:remove:2|explore": "throws:Scenario timeout:remove:2 exceeded 128 orderings",
  "wait-fork|declaration": "dze1xu109a",
  "wait-fork|reverse": "2g1fwjhnsnm",
  "wait-fork|explore": "1u4iuna58z5",
  "fork-loop:bug|declaration": "8cnfdumxz0",
  "fork-loop:bug|reverse": "2fmmlhd4vqs",
  "fork-loop:bug|explore": "rhblm3uo48",
  "fork-loop:fork-automatic|declaration": "1cpwztobyt1",
  "fork-loop:fork-automatic|reverse": "1vkt8in5brp",
  "fork-loop:fork-automatic|explore": "1cpj55e1ieu",
  "fork-loop:begin-automatic|declaration": "1b790dt0s5m",
  "fork-loop:begin-automatic|reverse": "xc9k7qafor",
  "fork-loop:begin-automatic|explore": "7p42wf9rc9",
  "event-race:at-trigger|declaration": "26lai717vba",
  "event-race:at-trigger|reverse": "1r6x3d8uugh",
  "event-race:at-trigger|explore": "4t4rzatjyz",
  "event-race:triggered|declaration": "tkhfc9p5pr",
  "event-race:triggered|reverse": "h1t4nnhtif",
  "event-race:triggered|explore": "1lcellmyn5q",
  "event-race:nonblocking|declaration": "1h2p9cqinev",
  "event-race:nonblocking|reverse": "mrn9gjc8nz",
  "event-race:nonblocking|explore": "1lcellmyn5q",
  "event-race:triggered-loop|declaration": "zih92hs4ve",
  "event-race:triggered-loop|reverse": "200au54304g",
  "event-race:triggered-loop|explore": "25ry7qzmoen",
  "sem:fifo|declaration": "bn4uu79ohp",
  "sem:fifo|reverse": "6n8wnkbsjw",
  "sem:fifo|explore": "rn69n9uxpd",
  "sem:multi-key|declaration": "6e59nu53w6",
  "sem:multi-key|reverse": "1xdnhwc6c5f",
  "sem:multi-key|explore": "1g54jjl4h8v",
  "mbx:0|declaration": "1l7giomag6d",
  "mbx:0|reverse": "1a059q08ois",
  "mbx:0|explore": "28kzz5yu15x",
  "mbx:1|declaration": "vlgc52v0v8",
  "mbx:1|reverse": "w6v7ykm4xz",
  "mbx:1|explore": "1irja124xzn",
  "mbx:2|declaration": "idy7q91mds",
  "mbx:2|reverse": "1sgwfq6x1g1",
  "mbx:2|explore": "wfyxce3pu4",
  "mbx:3|declaration": "pjwl6wxi6x",
  "mbx:3|reverse": "2cfdz26cs7u",
  "mbx:3|explore": "1irdo5oloa1",
  "key-leak:bug|declaration": "14lk7gn690o",
  "key-leak:bug|reverse": "28zddu4ohlt",
  "key-leak:bug|explore": "ddbndwm6v6",
  "key-leak:put-before-return|declaration": "1ylsohi3zxs",
  "key-leak:put-before-return|reverse": "1t6jpnvvytl",
  "key-leak:put-before-return|explore": "19ox1hwtimj",
  "key-leak:put-early|declaration": "1xvl6x94fx7",
  "key-leak:put-early|reverse": "20m7iqzi43v",
  "key-leak:put-early|explore": "6u2spi063i",
  "key-leak:try-get|declaration": "1i46gk6qfog",
  "key-leak:try-get|reverse": "2g78fftfakr",
  "key-leak:try-get|explore": "6u2spi063i",
  "key-leak:two-keys|declaration": "10fxzouoeej",
  "key-leak:two-keys|reverse": "h43dgtj41h",
  "key-leak:two-keys|explore": "19ox1hwtimj",
  "procedures|declaration": "113ubfi096o",
  "procedures|reverse": "1mc4ow42vss",
  "procedures|explore": "28io885sxfx",
  "nba-swap:nba|declaration": "1gcxvcg3ciy",
  "nba-swap:nba|reverse": "1gcxvcg3ciy",
  "nba-swap:nba|explore": "1l2otxdakqw",
  "nba-swap:blocking|declaration": "93ezj0qqfi",
  "nba-swap:blocking|reverse": "93ezj0qqfi",
  "nba-swap:blocking|explore": "2gn9xu6a4ih",
  "fork-timing|declaration": "qmg6ibfpqv",
  "fork-timing|reverse": "2aqtyspcnr6",
  "fork-timing|explore": "5w8c7mcr5p",
  "edge-vs-level|declaration": "1ygcdl5u5kd",
  "edge-vs-level|reverse": "tnd7lomd2a",
  "edge-vs-level|explore": "ym15fqy6xv",
};

const existingScenarios = (): ProcessScenario[] => [
  ...(["join", "join_any", "join_none"] as const).map(joinVariantsScenario),
  ...(["none", "isolate", "named", "wait-fork", "remove"] as const).flatMap((f) => [timeoutBenchScenario(f, false), timeoutBenchScenario(f, true)]),
  waitForkScenario(),
  ...(["bug", "fork-automatic", "begin-automatic"] as const).map(forkLoopScenario),
  ...(["at-trigger", "triggered", "nonblocking", "triggered-loop"] as const).map(eventRaceScenario),
  ...(["fifo", "multi-key"] as const).map(semaphoreScenario),
  ...[0, 1, 2, 3].map(mailboxScenario),
  ...(["bug", "put-before-return", "put-early", "try-get", "two-keys"] as const).map(keyLeakScenario),
  ...proceduralScenarios.flatMap((p) => (p.styleToggle ? [p.build("nba"), p.build("blocking")] : [p.build("nba")])),
];

describe("event-control refactor: every existing scenario's trace is unchanged", () => {
  it("matches the pre-refactor fingerprints in declaration order, reverse order and exploration", () => {
    const got: Record<string, string> = {};
    existingScenarios().forEach((s) => {
      got[`${s.id}|declaration`] = cyrb53(JSON.stringify(project(simulateProcesses(s))));
      got[`${s.id}|reverse`] = cyrb53(JSON.stringify(project(simulateProcesses(s, { order: "reverse" }))));
      try {
        const e = exploreProcessOrders(s);
        got[`${s.id}|explore`] = cyrb53(JSON.stringify({ d: e.deterministic, n: e.runCount, o: e.outcomes.map((o) => [o.signature, o.runs]) }));
      } catch (error) {
        got[`${s.id}|explore`] = `throws:${(error as Error).message}`;
      }
    });
    expect(Object.keys(got)).toHaveLength(Object.keys(GOLDEN).length);
    expect(got).toEqual(GOLDEN);
  });

  it("the key-leak collision check now uses $error (§20.10) with the same text, so grading is unchanged", () => {
    const r = simulateProcesses(keyLeakScenario("put-early"));
    const collision = r.log.find((l) => l.text.startsWith("COLLISION"));
    expect(collision).toMatchObject({ severity: "error", text: "COLLISION: 2 senders on the bus" });
    expect(prepareScenario(keyLeakScenario("bug")).source.map((l) => l.text.trim())).toContain('if (busy > 1) $error("COLLISION: %0d senders on the bus", busy);');
    expect(gradeKeyLeak(r).noCollision).toBe(false);
  });
});

describe("§9.4.2 event controls in the process model", () => {
  it("@(a) wakes on any change of a, x → 0 included; a write of the same value is not an event", () => {
    const s: ProcessScenario = {
      id: "any-change",
      title: "",
      vars: [{ name: "a", type: "logic" }],
      processes: [
        { id: "w", label: "watch", kind: "always", body: [on([{ expr: v("a") }], disp("a=%b", v("a")))] },
        { id: "d", label: "drive", kind: "initial", body: [after(1, set("a", c(0))), after(1, set("a", c(0))), after(1, set("a", c(1)))] },
      ],
    };
    expect(lines(simulateProcesses(s))).toEqual(["1:watch:a=0", "3:watch:a=1"]);
  });

  it("§9.4.2.1: @(a or b) and @(a, b) are the same event OR", () => {
    const orList = (separator: "or" | ","): ProcessScenario => ({
      id: `or-list-${separator}`,
      title: "",
      vars: [
        { name: "a", type: "logic", init: 0 },
        { name: "b", type: "logic", init: 0 },
      ],
      processes: [
        { id: "w", label: "watch", kind: "always", body: [on([{ expr: v("a") }, { expr: v("b") }], disp("t=%0d", now), separator)] },
        { id: "d", label: "drive", kind: "initial", body: [after(1, set("a", c(1))), after(1, set("b", c(1)))] },
      ],
    });
    expect(lines(simulateProcesses(orList("or")))).toEqual(["1:watch:t=1", "2:watch:t=2"]);
    expect(simulateProcesses(orList(",")).log).toEqual(simulateProcesses(orList("or")).log);
    expect(prepareScenario(orList(",")).source.map((l) => l.text)).toContain('always @(a, b) $display("t=%0d", $time); // watch');
  });

  it("@(posedge clk or negedge rst_n) wakes on either edge only: rst_n x → 0 is a negedge (Table 9-2), 0 → 1 is not", () => {
    const s: ProcessScenario = {
      id: "flop-edges",
      title: "",
      vars: [
        { name: "clk", type: "logic", init: 0 },
        { name: "rst_n", type: "logic" },
      ],
      processes: [
        {
          id: "f",
          label: "flop",
          kind: "always",
          keyword: "always_ff",
          body: [
            on(
              [
                { edge: "posedge", expr: v("clk") },
                { edge: "negedge", expr: v("rst_n") },
              ],
              disp("wake t=%0d", now),
            ),
          ],
        },
        { id: "tb", label: "tb", kind: "initial", body: [after(1, set("rst_n", c(0))), after(1, set("rst_n", c(1))), after(1, set("clk", c(1))), after(1, set("clk", c(0)))] },
      ],
    };
    const r = simulateProcesses(s);
    expect(lines(r)).toEqual(["1:flop:wake t=1", "3:flop:wake t=3"]);
    const reset = r.trace.find((step) => step.time === 1 && step.kind === "exec");
    expect(reset?.why).toMatch(/rst_n x → 0 is a negedge \(Table 9-2, from x to 0\)/);
    const release = r.trace.find((step) => step.time === 2 && step.kind === "exec");
    expect(release?.why).toMatch(/flop keeps waiting: rst_n 0 → 1 is a posedge/i);
  });

  it("an edge looks at the least significant bit only: an int going 2 → 3 is a posedge, 3 → 5 is not", () => {
    const s: ProcessScenario = {
      id: "lsb-edge",
      title: "",
      vars: [{ name: "n", type: "int", init: 0 }],
      processes: [
        { id: "w", label: "watch", kind: "always", body: [on([{ edge: "posedge", expr: v("n") }], disp("posedge n=%0d", v("n")))] },
        { id: "d", label: "drive", kind: "initial", body: [after(1, set("n", c(2))), after(1, set("n", c(3))), after(1, set("n", c(5)))] },
      ],
    };
    expect(lines(simulateProcesses(s))).toEqual(["2:watch:posedge n=3"]);
  });

  it("a change of an operand that leaves the event expression's value unchanged is not an event", () => {
    const s: ProcessScenario = {
      id: "same-value",
      title: "",
      vars: [
        { name: "a", type: "logic", init: 0 },
        { name: "b", type: "logic", init: 0 },
      ],
      processes: [
        { id: "w", label: "watch", kind: "always", body: [on([{ expr: bin("&&", v("a"), v("b")) }], disp("both t=%0d", now))] },
        { id: "d", label: "drive", kind: "initial", body: [after(1, set("a", c(1))), after(1, set("b", c(1)))] },
      ],
    };
    expect(lines(simulateProcesses(s))).toEqual(["2:watch:both t=2"]);
  });

  it("§9.4.2.3: an iff guard is checked when the expression changes; a guard change alone, or an x guard, does not wake", () => {
    const s: ProcessScenario = {
      id: "iff-guard",
      title: "",
      vars: [
        { name: "a", type: "logic", init: 0 },
        { name: "en", type: "logic", init: 0 },
      ],
      processes: [
        { id: "w", label: "watch", kind: "always", body: [on([{ expr: v("a"), iff: v("en") }], disp("t=%0d", now))] },
        {
          id: "d",
          label: "drive",
          kind: "initial",
          body: [after(1, set("a", c(1))), after(1, set("en", c(1))), after(1, set("a", c(0))), after(1, set("en", c("X"))), after(1, set("a", c(1)))],
        },
      ],
    };
    expect(lines(simulateProcesses(s))).toEqual(["3:watch:t=3"]);
    expect(prepareScenario(s).source.map((l) => l.text)).toContain('always @(a iff en) $display("t=%0d", $time); // watch');
  });
});

describe("§9.2 start order and §4.5 / §10.4.2 nonblocking updates at time zero", () => {
  const resetScenario = (nba: boolean): ProcessScenario => ({
    id: `time0-negedge-${nba ? "nba" : "blocking"}`,
    title: "",
    vars: [{ name: "rst_n", type: "logic" }],
    processes: [
      { id: "f", label: "flop", kind: "always", body: [on([{ edge: "negedge", expr: v("rst_n") }], disp("reset seen"))] },
      { id: "b", label: "bench", kind: "initial", body: [set("rst_n", c(0), nba)] },
    ],
  });

  it("§9.2: a blocking write at t = 0 is seen only if the waiting procedure started first", () => {
    const e = exploreProcessOrders(resetScenario(false));
    expect(e.deterministic).toBe(false);
    expect(e.outcomes.map((o) => o.result.log.length).sort()).toEqual([0, 1]);
    const missed = simulateProcesses(resetScenario(false), { order: "reverse" });
    expect(missed.trace.find((s) => s.kind === "exec")?.why).toMatch(/flop has not started yet, so nothing is waiting at its @\(negedge rst_n\), and this change is missed: rst_n x → 0 is a negedge/i);
  });

  it("§4.5, §10.4.2: a nonblocking write at t = 0 lands after every procedure reached its first timing control, so every order sees it", () => {
    const e = exploreProcessOrders(resetScenario(true));
    expect(e.deterministic).toBe(true);
    expect(lines(e.outcomes[0].result)).toEqual(["0:flop:reset seen"]);
    const r = simulateProcesses(resetScenario(true), { order: "reverse" });
    const update = r.trace.find((s) => s.region === "nba");
    expect(update?.time).toBe(0);
    expect(update?.procs.find((p) => p.label === "flop")?.state).toBe("ready");
  });

  it("startOrder and firstDivergentStep describe how two orders differ", () => {
    const a = simulateProcesses(resetScenario(false));
    const b = simulateProcesses(resetScenario(false), { order: "reverse" });
    expect(startOrder(a)).toEqual(["flop", "bench"]);
    expect(startOrder(b)).toEqual(["bench", "flop"]);
    const d = firstDivergentStep([a, b]);
    expect(a.trace.slice(0, d).map((s) => s.what)).toEqual(b.trace.slice(0, d).map((s) => s.what));
    expect(a.trace[d].what).not.toBe(b.trace[d].what);
    expect(b.trace[d].choice).toEqual({ options: ["flop", "bench"], picked: "bench" });
  });
});

describe("§9.2.2.2 always_comb and §9.2.2.2.2 always @*", () => {
  it("§9.2.2.2: always_comb is triggered once at time zero, after every initial and always procedure has started (model placement, no interleaving)", () => {
    // §9.2.2.2 promises only that the run comes after every procedure has been started; §4.7 would
    // let a started procedure be suspended part way. "first y=x" in every order is the model's
    // placement within its no-interleaving scope: each started procedure runs to its first wait first.
    const s: ProcessScenario = {
      id: "comb-after-start",
      title: "",
      vars: [
        { name: "a", type: "logic", init: 1 },
        { name: "y", type: "logic" },
      ],
      processes: [
        // Declared first, still runs last at time zero.
        { id: "c", label: "comb", kind: "always_comb", body: [set("y", v("a"))] },
        { id: "i1", label: "first", kind: "initial", body: [disp("first y=%b", v("y"))] },
        { id: "i2", label: "second", kind: "initial", body: [after(5, disp("later y=%b", v("y")))] },
      ],
    };
    const e = exploreProcessOrders(s);
    expect(e.deterministic).toBe(true);
    expect(lines(e.outcomes[0].result)).toEqual(["0:first:first y=x", "5:second:later y=1"]);
    const r = simulateProcesses(s);
    expect(r.trace.find((step) => step.kind === "start" && !step.pid)?.what).toMatch(/comb \(always_comb\) waits until they have all started/);
    const trigger = r.trace.findIndex((step) => step.kind === "start" && step.pid === 0);
    expect(r.trace.slice(0, trigger).filter((step) => step.kind === "block" || step.kind === "print").map((step) => step.pid)).toEqual(expect.arrayContaining([1, 2]));
  });

  it("§9.2.2.2.2: always @* does not run at time zero; always_comb does", () => {
    const s: ProcessScenario = {
      id: "star-vs-comb",
      title: "",
      vars: [
        { name: "a", type: "logic", init: 1 },
        { name: "y1", type: "logic" },
        { name: "y2", type: "logic" },
      ],
      processes: [
        { id: "s", label: "star", kind: "always_star", body: [set("y1", v("a"))] },
        { id: "c", label: "comb", kind: "always_comb", body: [set("y2", v("a"))] },
      ],
    };
    const r = simulateProcesses(s);
    expect(r.finalVars).toEqual({ a: 1, y1: "X", y2: 1 });
    expect(r.outcome).toEqual({ kind: "quiet", time: 0 });
    expect(r.trace.at(-1)?.why).toMatch(/always procedures are still waiting for their next event, which is normal/);
    const text = prepareScenario(s).source.map((l) => l.text);
    expect(text).toContain("always @* y1 = a; // star");
    expect(text).toContain("always_comb y2 = a; // comb");
  });

  it("always_comb runs again when an input changes", () => {
    const s: ProcessScenario = {
      id: "comb-rerun",
      title: "",
      vars: [
        { name: "a", type: "logic", init: 1 },
        { name: "y", type: "logic" },
      ],
      processes: [
        { id: "c", label: "comb", kind: "always_comb", body: [set("y", v("a"))] },
        { id: "d", label: "drive", kind: "initial", body: [after(5, set("a", c(0)))] },
      ],
    };
    expect(settledHistory(simulateProcesses(s), "y")).toEqual([
      { time: 0, value: 1 },
      { time: 5, value: 0 },
    ]);
  });

  it("§9.2.2.2.1: always_comb leaves out variables written or declared in the block and names used only in timing controls", () => {
    const body: Stmt[] = [
      set("tmp", bin("+", v("a"), v("b"))),
      set("y", bin("+", v("tmp"), v("c"))),
      { kind: "seq", decls: [{ name: "k", init: v("d") }], body: [set("z", v("k"))] },
      { kind: "waitCond", cond: v("go") },
    ];
    expect(inferCombSensitivity(body)).toEqual(["a", "b", "c", "d"]);
    expect(inferCombSensitivity([set("y", bin("+", v("y"), v("a")))])).toEqual(["a"]);
  });

  it("§9.4.2.2: @* adds every name the statement reads, including one it also writes, but not lvalue-only or timing-only names", () => {
    expect(inferStarSensitivity([set("tmp", bin("+", v("a"), v("b"))), set("y", bin("+", v("tmp"), v("c")))])).toEqual(["a", "b", "tmp", "c"]);
    expect(inferStarSensitivity([after(1, set("y", v("a"))), { kind: "waitCond", cond: v("go") }])).toEqual(["a"]);
  });

  it("§9.2.2.2.2: an always_comb body with a blocking statement, a timing or event control, or a fork is rejected", () => {
    const comb = (body: Stmt[], tasks: ProcessScenario["tasks"] = []): ProcessScenario => ({
      id: `bad-comb-${JSON.stringify(body).length}-${tasks.length}`,
      title: "",
      vars: [
        { name: "a", type: "logic", init: 1 },
        { name: "y", type: "logic" },
      ],
      mailboxes: [{ name: "mb", bound: 0 }],
      tasks,
      processes: [{ id: "c", label: "comb", kind: "always_comb", body }],
    });
    const rejected = [
      [after(5, set("y", v("a")))],
      [on([{ expr: v("a") }], set("y", v("a")))],
      [{ kind: "waitCond", cond: v("a") } as Stmt],
      [{ kind: "fork", join: "join", branches: [set("y", v("a"))] } as Stmt],
      [{ kind: "if", cond: v("a"), then: [{ kind: "mailbox", op: "get", mailbox: "mb", target: "y" } as Stmt] } as Stmt],
    ];
    rejected.forEach((body) => {
      expect(() => prepareScenario(comb(body))).toThrow(/always_comb comb contains .*§9\.2\.2\.2\.2/);
      expect(() => simulateProcesses(comb(body))).toThrow(/§9\.2\.2\.2\.2/);
    });
    expect(() => prepareScenario(comb([{ kind: "call", task: "pause", args: [] }], [{ name: "pause", automatic: true, params: [], body: [after(1)] }]))).toThrow(
      /a call of task pause, which contains a delay/,
    );
    // Allowed: plain statements, a function-like try_get, and a task without timing controls.
    expect(() => simulateProcesses(comb([set("y", v("a")), { kind: "mailbox", op: "try_get", mailbox: "mb", target: "y" }]))).not.toThrow();
    expect(() => prepareScenario(comb([{ kind: "call", task: "copy", args: [] }], [{ name: "copy", automatic: true, params: [], body: [set("y", v("a"))] }]))).not.toThrow();
  });
});

describe("narration of changes the event controls do not see", () => {
  const flopAndBench = (rst: 0 | "X", write: 0 | 1): ProcessScenario => ({
    id: `missed-${rst}-${write}`,
    title: "",
    vars: [
      { name: "clk", type: "logic", init: 0 },
      rst === "X" ? { name: "rst_n", type: "logic" } : { name: "rst_n", type: "logic", init: rst },
    ],
    processes: [
      // Declared first, so the default order runs the bench before the flop has started.
      { id: "b", label: "bench", kind: "initial", body: [set("rst_n", c(write))] },
      {
        id: "f",
        label: "flop",
        kind: "always",
        body: [
          on(
            [
              { edge: "posedge", expr: v("clk") },
              { edge: "negedge", expr: v("rst_n") },
            ],
            disp("wake"),
          ),
        ],
      },
    ],
  });
  const note = (r: SimResult) => r.trace.find((s) => /has not started yet/.test(s.why))?.why ?? "";

  it("§9.2: a change before the waiter starts is 'missed' only if its event control would have fired (Table 9-2)", () => {
    expect(note(simulateProcesses(flopAndBench("X", 0)))).toMatch(
      /flop has not started yet, so nothing is waiting at its @\(posedge clk or negedge rst_n\), and this change is missed: rst_n x → 0 is a negedge \(Table 9-2, from x to 0\)/i,
    );
    const posedge = note(simulateProcesses(flopAndBench(0, 1)));
    expect(posedge).not.toMatch(/missed/);
    expect(posedge).toMatch(
      /flop has not started yet, and this change would not have woken its @\(posedge clk or negedge rst_n\) anyway: rst_n 0 → 1 is a posedge \(Table 9-2, from 0 to 1\), which matches neither posedge clk nor negedge rst_n/i,
    );
  });

  it("§9.4.2.3: a change whose iff guard is false would not have woken the waiter, so it is not reported as missed", () => {
    const guarded = (en: 0 | 1): ProcessScenario => ({
      id: `missed-iff-${en}`,
      title: "",
      vars: [
        { name: "a", type: "logic", init: 0 },
        { name: "en", type: "logic", init: en },
      ],
      processes: [
        { id: "b", label: "bench", kind: "initial", body: [set("a", c(1))] },
        { id: "w", label: "watch", kind: "always", body: [on([{ expr: v("a"), iff: v("en") }], disp("a=%b", v("a")))] },
      ],
    });
    expect(note(simulateProcesses(guarded(1)))).toMatch(/watch has not started yet, so nothing is waiting at its @\(a iff en\), and this change is missed: a 0 → 1, and any change counts/i);
    expect(note(simulateProcesses(guarded(0)))).toMatch(
      /watch has not started yet, and this change would not have woken its @\(a iff en\) anyway: a 0 → 1, but its guard iff en is 0, which is not true \(§9\.4\.2\.3, §12\.4\)/i,
    );
  });

  it("a waiter that keeps waiting is told which terms the change fails to match", () => {
    const s: ProcessScenario = {
      id: "keeps-waiting-terms",
      title: "",
      vars: [
        { name: "clk", type: "logic", init: 0 },
        { name: "rst_n", type: "logic", init: 0 },
        { name: "a", type: "logic", init: 0 },
        { name: "b", type: "logic", init: 0 },
      ],
      processes: [
        {
          id: "f",
          label: "flop",
          kind: "always",
          body: [
            on(
              [
                { edge: "posedge", expr: v("clk") },
                { edge: "negedge", expr: v("rst_n") },
              ],
              disp("flop"),
            ),
          ],
        },
        { id: "w", label: "watch", kind: "always", body: [on([{ expr: bin("&&", v("a"), v("b")) }], disp("both"))] },
        { id: "d", label: "drive", kind: "initial", body: [after(1, set("rst_n", c(1))), after(1, set("a", c(1)))] },
      ],
    };
    const r = simulateProcesses(s);
    expect(r.trace.find((step) => step.time === 1 && step.kind === "exec")?.why).toMatch(
      /flop keeps waiting: rst_n 0 → 1 is a posedge \(Table 9-2, from 0 to 1\), which matches neither posedge clk nor negedge rst_n\./i,
    );
    expect(r.trace.find((step) => step.time === 2 && step.kind === "exec")?.why).toMatch(
      /watch keeps waiting: a 0 → 1 leaves a && b at 0, and a change that leaves the expression's value unchanged is not an event \(§9\.4\.2\)/i,
    );
  });
});

describe("§6.8 declaration initializers, and the 1364-2005 contrast (§6.8 NOTE)", () => {
  const ready = (rule?: InitializerRule): ProcessScenario => ({
    id: `ready-${rule ?? "default"}`,
    title: "",
    initializerRule: rule,
    vars: [{ name: "ready", type: "reg", init: 1, initLabel: "1'b1" }],
    processes: [{ id: "w", label: "watch", kind: "always", body: [on([{ expr: v("ready") }], disp("ready=%b", v("ready")))] }],
  });

  it("§6.8 / §10.5: the initial value is set before any procedure starts, so @(ready) sees no change in any order", () => {
    const e = exploreProcessOrders(ready("ieee1800"));
    expect(e.deterministic).toBe(true);
    expect(e.outcomes[0].result.log).toEqual([]);
    const r = simulateProcesses(ready("ieee1800"));
    expect(r.trace[0]).toMatchObject({ kind: "start", what: "Before any procedure starts, the declaration initializers set ready = 1." });
    expect(r.trace[0].why).toMatch(/derived from §6\.8/);
    expect(prepareScenario(ready("ieee1800")).source[0].text).toBe("reg ready = 1'b1;");
  });

  it("§6.8 / §10.5: the initializer step happens before any procedure starts, so it is marked preStart (no scheduling region)", () => {
    const r = simulateProcesses(ready("ieee1800"));
    expect(r.trace[0].preStart).toBe(true);
    expect(r.trace.slice(1).some((s) => s.preStart)).toBe(false);
    expect(simulateProcesses(ready("ieee1364-2005")).trace[0].preStart).toBe(true);
    expect(simulateProcesses(ready()).trace[0].preStart).toBeUndefined();
  });

  it("Table 6-7: with no initializer, the first step says each variable starts at its type's default", () => {
    const r = simulateProcesses({ ...ready("ieee1800"), id: "no-init", vars: [{ name: "ready", type: "reg" }] });
    expect(r.trace[0].what).toMatch(/^No variable has a declaration initializer/);
    expect(r.trace[0].why).toMatch(/default value \(Table 6-7\): x for 4-state types such as logic and reg/);
    expect(r.trace[0].why).not.toMatch(/setting it produces no event/);
  });

  it("several declarations can share one statement (`logic y1, y2;`), and comment lines can hold a line in place", () => {
    const s: ProcessScenario = {
      id: "shared-decl",
      title: "",
      vars: [
        { name: "a", type: "logic", init: 1, initLabel: "1'b1", key: "decl:a" },
        { name: "y1", type: "logic", key: "decl:y" },
        { name: "y2", type: "logic", init: 0, sharesLine: true },
      ],
      commentLines: [{ key: "gone", text: "(no stimulus)" }],
      processes: [{ id: "c", label: "comb", kind: "always_comb", body: [set("y1", v("a"))] }],
    };
    const source = prepareScenario(s).source;
    expect(source.map((l) => l.text)).toEqual(["logic a = 1'b1;", "logic y1, y2 = 0;", "", "always_comb y1 = a; // comb", "", "// (no stimulus)"]);
    expect(source.map((l) => l.key)).toEqual(["decl:a", "decl:y", undefined, expect.any(String), undefined, "gone"]);
    expect(simulateProcesses(s).finalVars).toEqual({ a: 1, y1: 1, y2: 0 });
    expect(() => prepareScenario({ ...s, id: "shared-bad", vars: [{ name: "n", type: "int" }, { name: "y", type: "logic", sharesLine: true }] })).toThrow(/same type/);
  });

  it("without an explicit rule the behaviour is the same and no extra narration step is added", () => {
    const r = simulateProcesses(ready());
    expect(r.log).toEqual([]);
    expect(r.trace[0].what).toBe("t = 0: watch is ready to run.");
  });

  it("§6.8 NOTE: under the 1364-2005 behaviour the initializer is a time-zero process, so the output depends on order", () => {
    const s = ready("ieee1364-2005");
    const e = exploreProcessOrders(s);
    expect(e.outcomes).toHaveLength(2);
    expect(e.outcomes.map((o) => lines(o.result)).sort()).toEqual([[], ["0:watch:ready=1"]]);
    const r = simulateProcesses(s);
    expect(r.trace[0].what).toMatch(/ready starts as x/);
    expect(r.processes.map((p) => `${p.label}:${p.kind}`)).toEqual(["init ready:initial", "watch:always"]);
    const keys = new Set(prepareScenario(s).source.map((l) => l.key).filter(Boolean));
    r.trace.forEach((step) => {
      if (step.lineKey) expect(keys.has(step.lineKey), step.lineKey).toBe(true);
    });
  });
});

describe("§20.10 severity tasks, §20.2 $stop and $finish, §9.2.3 final procedures", () => {
  const withFinal = (body: Stmt[]): ProcessScenario => ({
    id: `sev-${body.length}`,
    title: "",
    vars: [{ name: "n", type: "int", init: 3 }],
    processes: [
      { id: "t", label: "test", kind: "initial", body },
      { id: "w", label: "watchdog", kind: "initial", body: [after(100, disp("watchdog"))] },
      { id: "f", label: "report", kind: "final", body: [disp("final at %0t", now)] },
    ],
  });

  it("§20.10: $info, $warning and $error print and the process carries on; $fatal makes an implicit $finish, and final runs", () => {
    const s = withFinal([
      { kind: "severity", level: "info", format: "n = %0d", args: [v("n")] },
      { kind: "severity", level: "warning", format: "careful", args: [] },
      { kind: "severity", level: "error", format: "bad %0d", args: [v("n")] },
      after(5, disp("still running")),
      { kind: "severity", level: "fatal", finishNumber: 1, format: "giving up", args: [] },
      disp("never printed"),
    ]);
    const r = simulateProcesses(s);
    expect(r.log.map((l) => `${l.time}:${l.severity ?? "display"}:${l.text}`)).toEqual([
      "0:info:n = 3",
      "0:warning:careful",
      "0:error:bad 3",
      "5:display:still running",
      "5:fatal:giving up",
      "5:display:final at 5",
    ]);
    expect(r.outcome).toEqual({ kind: "finish", time: 5, by: "test", via: "fatal" });
    expect(r.trace.find((step) => step.kind === "finish")?.why).toMatch(/§20\.10/);
    const text = prepareScenario(s).source.map((l) => l.text.trim());
    expect(text).toEqual(expect.arrayContaining(['$info("n = %0d", n);', '$warning("careful");', '$error("bad %0d", n);', '$fatal(1, "giving up");']));
  });

  it("Syntax 20-11: $fatal takes finish_number before any message, so a message without one is rejected", () => {
    const fatal = (stmt: Stmt): ProcessScenario => ({ id: `fatal-${JSON.stringify(stmt)}`, title: "", processes: [{ id: "t", label: "test", kind: "initial", body: [stmt] }] });
    expect(() => prepareScenario(fatal({ kind: "severity", level: "fatal", format: "boom", args: [] }))).toThrow(/needs its finish_number first.*Syntax 20-11/);
    expect(prepareScenario(fatal({ kind: "severity", level: "fatal", args: [] })).source.map((l) => l.text)).toContain("initial $fatal; // test");
    expect(prepareScenario(fatal({ kind: "severity", level: "fatal", finishNumber: 0, args: [] })).source.map((l) => l.text)).toContain("initial $fatal(0); // test");
    expect(prepareScenario(fatal({ kind: "severity", level: "error", format: "bad", args: [] })).source.map((l) => l.text)).toContain('initial $error("bad"); // test');
  });

  it("§20.2: $stop suspends simulation, so nothing after it runs and final procedures do not run", () => {
    const r = simulateProcesses(withFinal([after(3, { kind: "stop" }), disp("after stop")]));
    expect(r.outcome).toEqual({ kind: "stop", time: 3, by: "test" });
    expect(r.log).toEqual([]);
    expect(r.trace.at(-1)?.what).toMatch(/suspended by \$stop at t = 3/);
    expect(prepareScenario(withFinal([{ kind: "stop" }])).source.map((l) => l.text)).toContain("initial $stop; // test");
  });

  it("§9.2.3: after $finish, final runs because simulation ended through $finish", () => {
    const r = simulateProcesses(withFinal([after(2, { kind: "finish" })]));
    expect(lines(r)).toEqual(["2:report:final at 2"]);
    expect(r.trace.find((step) => step.kind === "final")?.why).toMatch(/due to an explicit or implicit call to \$finish \(§9\.2\.3\)/);
  });

  it("when nothing is left to do, running final is labelled a model assumption (§9.6.1 does not say)", () => {
    const quiet: ProcessScenario = {
      id: "quiet-final-label",
      title: "",
      processes: [
        { id: "i", label: "init", kind: "initial", body: [after(7)] },
        { id: "f", label: "report", kind: "final", body: [disp("done")] },
      ],
    };
    const step = simulateProcesses(quiet).trace.find((s) => s.kind === "final");
    expect(step?.why).toMatch(/^Model assumption/);
    expect(step?.why).toMatch(/§9\.6\.1/);
  });
});

describe("§12.7.4 while", () => {
  const loop = (cond: Expr, body: Stmt[]): ProcessScenario => ({
    id: `while-${JSON.stringify(cond)}-${body.length}`,
    title: "",
    loopBudget: 30,
    vars: [
      { name: "i", type: "int", init: 0 },
      { name: "busy", type: "logic", init: 1 },
      { name: "u", type: "logic" },
    ],
    processes: [{ id: "p", label: "p", kind: "initial", body: [{ kind: "while", cond, body }, disp("after i=%0d", v("i"))] }],
  });

  it("repeats while the condition is true", () => {
    expect(lines(simulateProcesses(loop(bin("<", v("i"), c(3)), [set("i", bin("+", v("i"), c(1)))])))).toEqual(["0:p:after i=3"]);
  });

  it("§12.4: an x condition counts as false, so the body never runs", () => {
    const r = simulateProcesses(loop(v("u"), [set("i", c(9))]));
    expect(lines(r)).toEqual(["0:p:after i=0"]);
    expect(r.trace.find((s) => s.kind === "loop")?.what).toMatch(/x, which counts as false/);
  });

  it("§9.2.2.1: a while with an empty body and a true condition never lets time advance", () => {
    const s = loop(v("busy"), []);
    expect(simulateProcesses(s).outcome).toMatchObject({ kind: "zero-delay-loop", time: 0, label: "p" });
    expect(prepareScenario(s).source.map((l) => l.text.trim())).toContain("while (busy);");
  });
});

describe("the model horizon (maxTime) and booked wake-ups", () => {
  const clockOnly: ProcessScenario = {
    id: "free-clock",
    title: "",
    vars: [{ name: "clk", type: "logic", init: 0 }],
    processes: [
      { id: "c", label: "clock", kind: "always", body: [after(5, set("clk", { kind: "inv", operand: v("clk") }))] },
      { id: "f", label: "report", kind: "final", body: [disp("final")] },
    ],
  };

  it("a free-running clock ends at the horizon instead of running past maxSteps, and final procedures do not run", () => {
    expect(() => simulateProcesses(clockOnly)).toThrow(/exceeded/);
    const r = simulateProcesses(clockOnly, { maxTime: 12 });
    expect(r.outcome).toEqual({ kind: "horizon", time: 10, maxTime: 12, next: 15 });
    expect(r.log).toEqual([]);
    expect(r.trace.at(-1)?.why).toMatch(/limit of this model, not SystemVerilog/);
  });

  it("the scenario's maxTime is the default, and SimOptions.maxTime overrides it", () => {
    expect(simulateProcesses({ ...clockOnly, id: "free-clock-7", maxTime: 7 }).outcome).toMatchObject({ kind: "horizon", time: 5, next: 10 });
    expect(simulateProcesses({ ...clockOnly, id: "free-clock-7b", maxTime: 7 }, { maxTime: 20 }).outcome).toMatchObject({ kind: "horizon", time: 20, next: 25 });
  });

  it("each step lists the pending delay wake-ups with their due times", () => {
    const r = simulateProcesses(clockOnly, { maxTime: 12 });
    expect(r.trace.find((s) => s.kind === "block")?.booked).toEqual([{ pid: 0, label: "clock", time: 5 }]);
    expect(r.trace.at(-1)?.booked).toEqual([{ pid: 0, label: "clock", time: 15 }]);
  });
});

describe("exploreProcessOrders options", () => {
  it("still accepts a plain maxRuns number", () => {
    expect(exploreProcessOrders(eventRaceScenario("at-trigger"), 64).deterministic).toBe(false);
  });

  it("throws at the cap by default; onCap 'mark' returns what it found with capped: true (a model limit)", () => {
    const s = timeoutBenchScenario("none", true);
    expect(() => exploreProcessOrders(s, { maxRuns: 4 })).toThrow(/exceeded 4 orderings/);
    const e = exploreProcessOrders(s, { maxRuns: 4, onCap: "mark" });
    expect(e).toMatchObject({ capped: true, runCount: 4, deterministic: false });
    expect(exploreProcessOrders(eventRaceScenario("triggered")).capped).toBe(false);
  });

  it("signature 'timestamps' ignores line order inside one time stamp", () => {
    const s: ProcessScenario = {
      id: "same-time-prints",
      title: "",
      processes: [
        { id: "a", label: "A", kind: "initial", body: [disp("from A")] },
        { id: "b", label: "B", kind: "initial", body: [disp("from B")] },
      ],
    };
    expect(exploreProcessOrders(s).outcomes).toHaveLength(2);
    expect(exploreProcessOrders(s, { signature: "timestamps" }).outcomes).toHaveLength(1);
  });

  it("watch adds variable histories to the signature, for races that print nothing", () => {
    const s: ProcessScenario = {
      id: "last-writer",
      title: "",
      vars: [{ name: "x", type: "int", init: 0 }],
      processes: [
        { id: "a", label: "A", kind: "initial", body: [set("x", c(1))] },
        { id: "b", label: "B", kind: "initial", body: [set("x", c(2))] },
      ],
    };
    expect(exploreProcessOrders(s).outcomes).toHaveLength(1);
    const e = exploreProcessOrders(s, { watch: ["x"] });
    expect(e.outcomes.map((o) => o.result.finalVars.x).sort()).toEqual([1, 2]);
  });

  it("alignedOutcomeRuns picks, per group, the run that shares the longest prefix with the first group", () => {
    const s: ProcessScenario = {
      id: "three-way",
      title: "",
      maxTime: 12,
      vars: [
        { name: "clk", type: "logic", init: 0 },
        { name: "rst_n", type: "logic" },
        { name: "q", type: "logic" },
      ],
      processes: [
        { id: "c", label: "clock", kind: "always", body: [after(5, set("clk", { kind: "inv", operand: v("clk") }))] },
        {
          id: "f",
          label: "flop",
          kind: "always",
          body: [
            on(
              [
                { edge: "posedge", expr: v("clk") },
                { edge: "negedge", expr: v("rst_n") },
              ],
              set("q", c(0), true),
            ),
          ],
        },
        { id: "b", label: "bench", kind: "initial", body: [set("rst_n", lit(0, "1'b0"))] },
      ],
    };
    const e = exploreProcessOrders(s, { watch: ["q"] });
    expect(e.outcomes).toHaveLength(2);
    const plain = firstDivergentStep(e.outcomes.map((o) => o.result));
    const aligned = alignedOutcomeRuns(s, e);
    expect(firstDivergentStep(aligned)).toBeGreaterThan(plain);
    expect(startOrder(aligned[0])).toEqual(["clock", "flop", "bench"]);
    expect(startOrder(aligned[1])).toEqual(["clock", "bench", "flop"]);
    expect(valueAt(aligned[0], "q", 0)).toBe(0);
    expect(valueAt(aligned[1], "q", 0)).toBe("X");
  });

  it("alignedOutcomeRuns breaks ties at the same split step by the choices that sort first (closest to the base run)", () => {
    // writer before watcher decides the outcome; the filler's place does not.
    const s: ProcessScenario = {
      id: "tie-break",
      title: "",
      vars: [{ name: "a", type: "logic" }],
      processes: [
        { id: "w", label: "watcher", kind: "always", body: [on([{ expr: v("a") }], disp("seen a=%b", v("a")))] },
        { id: "i", label: "writer", kind: "initial", body: [set("a", c(1))] },
        { id: "f", label: "filler", kind: "initial", body: [after(10)] },
      ],
    };
    const e = exploreProcessOrders(s);
    expect(e.outcomes).toHaveLength(2);
    // Discovery order puts "filler first" ahead of "writer first" in the second group.
    expect(e.outcomes[1].runs[0][0]).toBe(2);
    const aligned = alignedOutcomeRuns(s, e);
    const at = firstDivergentStep(aligned);
    expect(aligned[1].trace[at].choice).toEqual({ options: ["watcher", "writer", "filler"], picked: "writer" });
    expect(startOrder(aligned[1])).toEqual(["writer", "watcher", "filler"]);
  });
});

describe("divergenceFromBase: where each outcome card starts", () => {
  // Two independent races: p/q print at t = 0, r/s print at t = 10. Four outcomes;
  // one of them leaves the declaration-order base run only at t = 10.
  const twoRaces: ProcessScenario = {
    id: "two-races",
    title: "",
    processes: [
      { id: "p", label: "p", kind: "initial", body: [disp("p")] },
      { id: "q", label: "q", kind: "initial", body: [disp("q")] },
      { id: "r", label: "r", kind: "initial", body: [after(10, disp("r"))] },
      { id: "s", label: "s", kind: "initial", body: [after(10, disp("s"))] },
    ],
  };

  it("with three or more outcomes, a run that leaves the base later is marked at its own split, not the first one", () => {
    const e = exploreProcessOrders(twoRaces);
    expect(e.outcomes).toHaveLength(4);
    const runs = alignedOutcomeRuns(twoRaces, e);
    const printed = (r: SimResult) => r.log.map((l) => l.text).join("");
    expect(printed(runs[0])).toBe("pqrs");
    const at = divergenceFromBase(runs);
    const global = firstDivergentStep(runs);
    // The base card starts at the first split of any run from it.
    expect(at[0]).toBe(global);
    const late = runs.findIndex((r) => printed(r) === "pqsr");
    expect(at[late]).toBeGreaterThan(global);
    expect(runs[late].trace[at[late]]).toMatchObject({ time: 10, choice: { options: ["r", "s"], picked: "s" } });
    // A shared index would point the late card at a t = 0 step where it still matches the base.
    expect(runs[late].trace[global].what).toBe(runs[0].trace[global].what);
    // Every card's start is a scheduler choice that differs from the base run's at that step.
    runs.slice(1).forEach((run, k) => {
      const i = at[k + 1];
      expect(run.trace[i].choice?.picked).not.toBe(runs[0].trace[i].choice?.picked);
      expect(run.trace.slice(0, i).map((st) => st.what)).toEqual(runs[0].trace.slice(0, i).map((st) => st.what));
    });
  });

  it("for two runs it equals firstDivergentStep, and one run starts at 0", () => {
    const s = eventRaceScenario("at-trigger");
    const runs = alignedOutcomeRuns(s, exploreProcessOrders(s, 64)).slice(0, 2);
    expect(divergenceFromBase(runs)).toEqual([firstDivergentStep(runs), firstDivergentStep(runs)]);
    expect(divergenceFromBase(runs.slice(0, 1))).toEqual([0]);
    expect(divergenceFromBase([])).toEqual([]);
  });
});

describe("stepNarrationBadges: the shared narration badges", () => {
  it("without a context it gives the plain kind and region labels (what every narrator showed before)", () => {
    [joinVariantsScenario("join_any"), timeoutBenchScenario("none", true), waitForkScenario(), eventRaceScenario("nonblocking")].forEach((s) =>
      simulateProcesses(s).trace.forEach((step) => {
        const b = stepNarrationBadges(step);
        expect(b.kind).toBe(STEP_KIND_LABELS[step.kind]);
        expect(b.where).toBe(STEP_REGION_LABELS[step.region]);
        expect(b.tone).toBe(step.kind === "kill" ? "kill" : "default");
        expect(b.choice).toBe(step.choice ? `Scheduler choice: ${step.choice.picked} of ${step.choice.options.join(", ")}` : undefined);
      }),
    );
  });

  it("§6.8: the initializer step is before any procedure starts; under the 1364-2005 rule the badge cites the §6.8 NOTE", () => {
    const ready = (rule: InitializerRule): ProcessScenario => ({
      id: `badge-${rule}`,
      title: "",
      initializerRule: rule,
      vars: [{ name: "ready", type: "reg", init: 1, initLabel: "1'b1" }],
      processes: [{ id: "w", label: "watch", kind: "always", body: [on([{ expr: v("ready") }], disp("ready=%b", v("ready")))] }],
    });
    const modern = simulateProcesses(ready("ieee1800")).trace[0];
    expect(stepNarrationBadges(modern, { initializerRule: "ieee1800" }).where).toBe("Before any procedure starts (§6.8)");
    const legacy = simulateProcesses(ready("ieee1364-2005")).trace[0];
    const where = stepNarrationBadges(legacy, { initializerRule: "ieee1364-2005" }).where;
    expect(where).toBe("Before any procedure starts · 1364-2005 rule (§6.8 NOTE)");
    expect(where).not.toMatch(/\(§6\.8\)/);
    // Later steps keep their region.
    expect(stepNarrationBadges(simulateProcesses(ready("ieee1800")).trace[1], { initializerRule: "ieee1800" }).where).toBe("Active region");
  });

  it("the end step of a horizon run is a model limit; a quiet end that runs final procedures is a model assumption (§9.6.1)", () => {
    const clock: ProcessScenario = {
      id: "badge-horizon",
      title: "",
      maxTime: 12,
      vars: [{ name: "clk", type: "logic", init: 0 }],
      processes: [{ id: "c", label: "clock", kind: "always", body: [after(5, set("clk", { kind: "inv", operand: v("clk") }))] }],
    };
    const r = simulateProcesses(clock);
    const end = stepNarrationBadges(r.trace.at(-1) as TraceStep, { outcome: r.outcome });
    expect(end).toMatchObject({ kind: "Model horizon", where: "A model limit, not the end of simulation", tone: "horizon" });
    const quiet: ProcessScenario = {
      id: "badge-quiet-final",
      title: "",
      processes: [
        { id: "i", label: "bench", kind: "initial", body: [after(5)] },
        { id: "f", label: "report", kind: "final", body: [disp("done")] },
      ],
    };
    const q = simulateProcesses(quiet);
    const finalStep = q.trace.find((st) => st.kind === "final") as TraceStep;
    expect(stepNarrationBadges(finalStep, { outcome: q.outcome }).assumption).toBe(true);
    expect(q.trace.filter((st) => stepNarrationBadges(st).assumption)).toHaveLength(1);
  });
});

describe("history helpers and formatting", () => {
  it("variableHistory lists every change; settledHistory keeps the value at the end of each time stamp", () => {
    const s: ProcessScenario = {
      id: "history",
      title: "",
      vars: [{ name: "x", type: "int", init: 0 }],
      processes: [{ id: "p", label: "p", kind: "initial", body: [set("x", c(1)), set("x", c(2)), after(4, set("x", c(2))), after(1, set("x", c(7)))] }],
    };
    const r = simulateProcesses(s);
    expect(variableHistory(r, "x").map((h) => `${h.time}:${h.value}`)).toEqual(["0:0", "0:1", "0:2", "5:7"]);
    expect(settledHistory(r, "x")).toEqual([
      { time: 0, value: 2 },
      { time: 5, value: 7 },
    ]);
    expect(valueAt(r, "x", 3)).toBe(2);
  });

  it("formats %b for the one-bit values these scenarios print, with x for unknown", () => {
    expect(formatDisplay("%b %0b %0d", [1, "X", 5])).toBe("1 x 5");
  });

  it("generates always_ff with its statement below, compact if/else, enum declarations and literal labels", () => {
    const s: ProcessScenario = {
      id: "ff-source",
      title: "",
      vars: [
        { name: "clk", type: "logic", init: 0 },
        { name: "rst_n", type: "logic", init: 0, initLabel: "1'b0", key: "decl:rst_n" },
        { name: "state", type: "logic", enumLabels: ["S_IDLE", "S_RUN"] },
      ],
      processes: [
        {
          id: "f",
          label: "flop",
          kind: "always",
          keyword: "always_ff",
          role: "design",
          body: [
            on(
              [
                { edge: "posedge", expr: v("clk") },
                { edge: "negedge", expr: v("rst_n") },
              ],
              { kind: "if", compact: true, cond: { kind: "not", operand: v("rst_n") }, then: [set("state", lit(0, "S_IDLE"), true)], else: [set("state", lit(1, "S_RUN"), true)] },
            ),
          ],
        },
      ],
    };
    const source = prepareScenario(s).source;
    expect(source.map((l) => l.text)).toEqual([
      "logic clk = 0;",
      "logic rst_n = 1'b0;",
      "enum logic {S_IDLE, S_RUN} state;",
      "",
      "always_ff @(posedge clk or negedge rst_n) // flop",
      "  if (!rst_n) state <= S_IDLE;",
      "  else state <= S_RUN;",
    ]);
    expect(source[1].key).toBe("decl:rst_n");
    const r = simulateProcesses({ ...s, id: "ff-source-run", maxTime: 6, processes: [...s.processes, { id: "c", label: "clock", kind: "always", body: [after(5, set("clk", c(1)))] }] });
    expect(r.trace.find((step) => step.region === "nba")?.what).toBe("NBA region, still t = 5: state updates x → S_IDLE.");
  });
});
