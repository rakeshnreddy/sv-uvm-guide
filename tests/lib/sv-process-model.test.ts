import { describe, expect, it } from "vitest";

import {
  c,
  eventRaceScenario,
  exploreProcessOrders,
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
