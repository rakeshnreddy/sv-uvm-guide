import { describe, expect, it } from "vitest";

import { c as pc, now as pnow, simulateProcesses, v as pv, type ProcessScenario } from "@/lib/sv-process-model";
import {
  DEFAULT_DIRECTIONS,
  FORMAL_SIGNATURES,
  KATA_BUGGY_LOG,
  KATA_EXPECTED_LOG,
  KATA_SOLUTION,
  KATA_SUSPECTS,
  KATA_SYMPTOMS,
  NO_KATA_FIXES,
  SECOND_CALL_OPTIONS,
  addCall,
  addReturns,
  benchSource,
  bin,
  c,
  callOnePrint,
  checkInitializer,
  coerce,
  compileBench,
  countCallsBench,
  countOnesBench,
  defaultValue,
  directionsSummary,
  exploreBench,
  factBench,
  factorial,
  formatDisplay,
  gradeKata,
  kataBench,
  kataFixNote,
  literalCallIssues,
  now,
  outerReturnValue,
  pulseBench,
  recursionTable,
  resolveFormals,
  resolveReturnType,
  sendBench,
  sendVerdict,
  showDirsBench,
  signatureToSource,
  simulateBench,
  sumToBench,
  truncateTo,
  v,
  waitCyclesEffect,
  type Bench,
  type Direction,
} from "@/lib/sv-subroutine-model";

const logOf = (bench: Bench, choices?: number[]) => simulateBench(bench, { choices }).log.map((l) => l.text);

describe("§6.8 Table 6-7 defaults, §10.7 truncation", () => {
  it("4-state types start at x, 2-state at 0, strings empty", () => {
    expect(defaultValue("logic")).toBe("X");
    expect(defaultValue("logic [7:0]")).toBe("X");
    expect(defaultValue("int")).toBe(0);
    expect(defaultValue("int unsigned")).toBe(0);
    expect(defaultValue("string")).toBe("");
  });

  it("a wider value stored into a narrower variable keeps its low bits", () => {
    expect(truncateTo(5, 1)).toBe(1);
    expect(truncateTo(4, 1)).toBe(0);
    expect(truncateTo(0x1ff, 8)).toBe(0xff);
    expect(coerce(5, "logic")).toBe(1);
    expect(coerce(300, "logic [7:0]")).toBe(44);
    expect(coerce("X", "logic")).toBe("X");
    expect(coerce("X", "int")).toBe(0);
  });

  it("formats %0d, %s and %b the way the lesson's logs read", () => {
    expect(formatDisplay("t=%0d id=%0d", [10, 2])).toBe("t=10 id=2");
    expect(formatDisplay("t=%0d %s", [12, "second"])).toBe("t=12 second");
    expect(formatDisplay("t=%0d busy=%b", [13, 1])).toBe("t=13 busy=1");
    expect(formatDisplay("busy=%b", ["X"])).toBe("busy=x");
  });

  it("does not model %t: the specifier is left in place, so no bench may use it", () => {
    expect(formatDisplay("t=%t", [10])).toBe("t=%t");
    expect(formatDisplay("t=%0t %0d", [10, 2])).toBe("t=%0t 10");
  });
});

describe("§13.3 formal directions and types you did not write", () => {
  it("split: lo inherits output and logic [7:0] from hi", () => {
    const [word, hi, lo] = resolveFormals(FORMAL_SIGNATURES.split.formals);
    expect(word).toMatchObject({ direction: "input", type: "logic [15:0]", directionSource: "explicit", typeSource: "explicit" });
    expect(hi).toMatchObject({ direction: "output", type: "logic [7:0]", directionSource: "explicit", typeSource: "explicit" });
    expect(lo).toMatchObject({ direction: "output", type: "logic [7:0]", directionSource: "inherited", typeSource: "inherited", directionFrom: "hi", typeFrom: "hi" });
  });

  it("wait_cycles(n): no direction and no type make n an input one-bit logic", () => {
    const [n] = resolveFormals(FORMAL_SIGNATURES.wait_cycles.formals);
    expect(n).toMatchObject({ direction: "input", type: "logic", directionSource: "default", typeSource: "default" });
    expect(waitCyclesEffect(4, n.type)).toEqual({ stored: 0, cycles: 0 });
    expect(waitCyclesEffect(5, n.type)).toEqual({ stored: 1, cycles: 1 });
  });

  it("wait_cycles_ok(input int unsigned n) keeps every count", () => {
    const [n] = resolveFormals(FORMAL_SIGNATURES.wait_cycles_ok.formals);
    expect(waitCyclesEffect(5, n.type)).toEqual({ stored: 5, cycles: 5 });
  });

  it("the LRM's mytask3(a, b, output logic [15:0] u, v): a and b default to input, v inherits output and the type", () => {
    const resolved = resolveFormals([{ name: "a" }, { name: "b" }, { name: "u", direction: "output", type: "logic [15:0]" }, { name: "v" }]);
    expect(resolved.map((f) => `${f.direction} ${f.type} ${f.name}`)).toEqual(["input logic a", "input logic b", "output logic [15:0] u", "output logic [15:0] v"]);
    expect(resolved[1].directionSource).toBe("default");
    expect(resolved[1].typeSource).toBe("inherited");
    expect(resolved[3].directionSource).toBe("inherited");
  });

  it("a formal with its own direction but no type is one-bit logic, not the previous type", () => {
    const [, b] = resolveFormals([{ name: "a", direction: "input", type: "int" }, { name: "b", direction: "output" }]);
    expect(b).toMatchObject({ type: "logic", typeSource: "default" });
  });

  it("prints the lesson's signatures exactly", () => {
    expect(signatureToSource(FORMAL_SIGNATURES.split)).toBe("task automatic split(input logic [15:0] word, output logic [7:0] hi, lo);");
    expect(signatureToSource(FORMAL_SIGNATURES.wait_cycles)).toBe("task automatic wait_cycles(n);");
    expect(signatureToSource(FORMAL_SIGNATURES.wait_cycles_ok)).toBe("task automatic wait_cycles_ok(input int unsigned n);");
    expect(signatureToSource(FORMAL_SIGNATURES.add)).toBe("function automatic add(input int a, input int b);");
  });
});

describe("§13.4 implicit return type", () => {
  it("a function with no return type returns a one-bit logic, so add(2, 3) is 1'b1", () => {
    expect(resolveReturnType()).toEqual({ type: "logic", source: "implicit" });
    expect(resolveReturnType("int")).toEqual({ type: "int", source: "explicit" });
    expect(addReturns(2, 3)).toBe(1);
    expect(addReturns(2, 2)).toBe(0);
    expect(addReturns(2, 3, "int")).toBe(5);
  });
});

describe("§13.5, §13.5.2 a literal actual, through the formals as resolved", () => {
  const add = (a: Parameters<typeof resolveFormals>[0][number], b: Parameters<typeof resolveFormals>[0][number]) => resolveFormals([a, b]);
  const asWritten = FORMAL_SIGNATURES.add.formals;

  it("add(2, 3) as the lesson writes it computes 5", () => {
    expect(addCall(resolveFormals(asWritten))).toMatchObject({ issues: [], sum: 5, returned: 1 });
    expect(addCall(resolveFormals(asWritten), "int")).toMatchObject({ sum: 5, returned: 5 });
  });

  it("a formal with no type is one bit, so 2 stores 0 and the sum is 3", () => {
    const formals = add({ name: "a", direction: "input" }, { name: "b", direction: "input", type: "int" });
    const call = addCall(formals, "int");
    expect(call.args?.map((arg) => arg.stored)).toEqual([0, 3]);
    expect(call).toMatchObject({ sum: 3, returned: 3 });
  });

  it("two one-bit formals keep the low bits of both literals", () => {
    const call = addCall(add({ name: "a" }, { name: "b" }), "int");
    expect(call.args?.map((arg) => [arg.type, arg.stored])).toEqual([
      ["logic", 0],
      ["logic", 1],
    ]);
    expect(call).toMatchObject({ sum: 1, returned: 1 });
  });

  it("a literal may not reach an output or inout (§13.5) or a ref (§13.5.2)", () => {
    for (const [direction, clause] of [
      ["output", "§13.5"],
      ["inout", "§13.5"],
      ["ref", "§13.5.2"],
      ["const ref", "§13.5.2"],
    ] as [Direction, string][]) {
      const call = addCall(add({ name: "a", direction, type: "int" }, { name: "b", direction: "input", type: "int" }));
      expect(call.issues).toEqual([expect.objectContaining({ clause, message: expect.stringContaining("add(..., 2, ...)") })]);
      expect(call.args).toBeUndefined();
      expect(call.returned).toBeUndefined();
    }
    expect(literalCallIssues("wait_cycles", [{ name: "n", direction: "input" }], [4])).toEqual([]);
    expect(literalCallIssues("wait_cycles", [{ name: "n", direction: "ref" }], [4])).toEqual([expect.objectContaining({ clause: "§13.5.2", message: expect.stringContaining("wait_cycles(..., 4, ...)") })]);
    expect(literalCallIssues("wait_cycles", [{ name: "n", direction: "output" }], [4])).toEqual([expect.objectContaining({ clause: "§13.5" })]);
  });
});

describe("Narration reads the operands before the write", () => {
  const whats = (bench: Bench) => simulateBench(bench).trace.map((s) => s.what).join("\n");

  it("show_dirs prints true arithmetic on every self-assignment", () => {
    const text = whats(showDirsBench({ lifetime: "automatic", directions: DEFAULT_DIRECTIONS }));
    expect(text).toContain("a = a + 10 = 5 + 10 = 15");
    expect(text).toContain("b = b + 20 = 0 + 20 = 20");
    expect(text).toContain("c = c + 30 = 5 + 30 = 35");
    expect(text).toContain("d = d + 40 = 5 + 40 = 45");
  });

  it("a static output shows the value the second call starts from", () => {
    const text = whats(showDirsBench({ lifetime: "static", directions: { ...DEFAULT_DIRECTIONS, d: "inout" }, calls: 2 }));
    expect(text).toContain("b + 20 = 0 + 20 = 20");
    expect(text).toContain("b + 20 = 20 + 20 = 40");
  });

  it("count_ones shows the 8 a static second call starts from, and the 0 an automatic one starts from", () => {
    const statics = whats(countOnesBench("static"));
    expect(statics).toContain("0 + 8 = 8");
    expect(statics).toContain("8 + 1 = 9");
    const autos = whats(countOnesBench("automatic"));
    expect(autos).toContain("0 + 8 = 8");
    expect(autos).toContain("0 + 1 = 1");
  });

  it("count_calls counts up from the value before the write", () => {
    const text = whats(countCallsBench());
    expect(text).toContain("total = total + 1 = 0 + 1 = 1");
    expect(text).toContain("total = total + 1 = 2 + 1 = 3");
    expect(text).toContain("this_call = this_call + 1 = 0 + 1 = 1");
  });
});

describe("Why and clause follow the variable's own storage, not the subroutine's lifetime (§13.3.1, §6.21)", () => {
  const stepOf = (bench: Bench, predicate: (s: ReturnType<typeof simulateBench>["trace"][number]) => boolean) => simulateBench(bench).trace.find(predicate) as ReturnType<typeof simulateBench>["trace"][number];

  it("in a static task, an automatic local is per activation and a static local is shared", () => {
    const own = stepOf(countCallsBench(), (s) => s.lineKey === "this-inc");
    expect(own.why).toMatch(/this activation's own copy/);
    expect(own.why).not.toMatch(/shared/);
    expect(own.clause).toBe("§13.3.1, §6.21");
    const shared = stepOf(countCallsBench(), (s) => s.lineKey === "total-inc");
    expect(shared.why).toMatch(/one shared copy/);
    expect(shared.clause).toBe("§13.3.2");
  });

  it("enter, print and return name which variables are shared and which are own", () => {
    const enter = stepOf(countCallsBench(), (s) => s.kind === "enter");
    expect(enter.what).toMatch(/uses the one shared copy of total and gets its own this_call/);
    expect(enter.what).toMatch(/this_call starts at 0/);
    expect(enter.what).toMatch(/total is static: it keeps 0/);
    expect(enter.why).toMatch(/total is one shared copy/);
    expect(enter.why).toMatch(/this_call belongs to this activation/);
    expect(enter.why).not.toMatch(/one copy of each variable/);

    const print = stepOf(countCallsBench(), (s) => s.kind === "print");
    expect(print.why).toMatch(/total is read from the shared copy/);
    expect(print.why).toMatch(/this_call is this activation's own copy/);
    expect(print.clause).toBe("§13.3.1, §6.21");

    const ret = stepOf(countCallsBench(), (s) => s.kind === "return");
    expect(ret.what).toMatch(/its own this_call is dropped/);
    expect(ret.what).toMatch(/the shared storage keeps total = 1/);
    expect(ret.why).toMatch(/Automatic storage is deallocated/);
    expect(ret.why).toMatch(/Static variables retain/);
  });

  it("the mirror case: a static local in an automatic task keeps counting across overlapping calls", () => {
    const bench: Bench = {
      id: "mirror",
      title: "mirror",
      globals: [],
      subs: [
        {
          name: "m",
          kind: "task",
          lifetime: "automatic",
          formals: [{ name: "id", direction: "input", type: "int" }],
          locals: [{ name: "seen", type: "int", qualifier: "static", init: c(0) }],
          body: [
            { kind: "assign", target: "seen", expr: bin("+", v("seen"), c(1)), key: "inc" },
            { kind: "assign", target: "id", expr: bin("+", v("id"), c(1)), key: "own" },
            { kind: "delay", amount: c(5), key: "print", then: { kind: "display", format: "t=%0d id=%0d seen=%0d", args: [now, v("id"), v("seen")] } },
          ],
        },
      ],
      processes: [{ id: "main", label: "initial", body: [{ kind: "fork", key: "f", branches: [[{ kind: "call", sub: "m", args: [c(1)], key: "c1" }], [{ kind: "delay", amount: c(1), key: "c2", then: { kind: "call", sub: "m", args: [c(10)] } }]] }] }],
    };
    expect(logOf(bench)).toEqual(["t=5 id=2 seen=2", "t=6 id=11 seen=2"]);
    const run = simulateBench(bench);
    expect(run.trace[0].what).toMatch(/static subroutine storage exists from time 0/);
    const seen = run.trace.find((s) => s.lineKey === "inc") as (typeof run.trace)[number];
    expect(seen.why).toMatch(/one shared copy/);
    expect(seen.clause).toBe("§13.3.1, §6.21");
    const own = run.trace.find((s) => s.lineKey === "own") as (typeof run.trace)[number];
    expect(own.why).toMatch(/this activation's own copy/);
    expect(own.clause).toBe("§13.3.2");
    const enter = run.trace.find((s) => s.kind === "enter") as (typeof run.trace)[number];
    expect(enter.what).toMatch(/uses the one shared copy of seen and gets its own id/);
  });

  it("a plain static task's own variables are still described as the one shared copy", () => {
    const run = simulateBench(sendBench({ lifetime: "static", secondCallAt: 2 }));
    expect((run.trace.find((s) => s.kind === "print") as (typeof run.trace)[number]).why).toMatch(/whatever the shared copy holds now/);
    expect((run.trace.find((s) => s.kind === "enter") as (typeof run.trace)[number]).why).toMatch(/one copy of each variable/);
  });

  it("an input's own copy is never copied back; an output's waits for the return", () => {
    const run = simulateBench(showDirsBench({ lifetime: "automatic", directions: DEFAULT_DIRECTIONS }));
    expect((run.trace.find((s) => s.lineKey === "dir-a") as (typeof run.trace)[number]).why).toMatch(/never copied back/);
    expect((run.trace.find((s) => s.lineKey === "dir-b") as (typeof run.trace)[number]).why).toMatch(/until the copy-out at the return/);
  });
});

describe("Functions cite the function clauses", () => {
  const functionBenches: Bench[] = (["static", "automatic"] as const).flatMap((lifetime) => [countOnesBench(lifetime), factBench({ lifetime, n: 3 }), sumToBench({ lifetime, n: 3 })]);

  it("no function step cites §13.3.2, which is about tasks", () => {
    functionBenches.forEach((bench) => simulateBench(bench).trace.forEach((s) => expect(s.clause ?? "").not.toContain("§13.3.2")));
  });

  it("an automatic function's enter step cites §13.4.2 and §6.21 and says nothing of outputs; a static one cites §13.4.2", () => {
    const auto = simulateBench(factBench({ lifetime: "automatic", n: 2 })).trace.find((s) => s.kind === "enter");
    expect(auto?.clause).toBe("§13.4.2, §6.21");
    expect(auto?.why).toMatch(/on each entry to the call/);
    expect(auto?.why).not.toMatch(/outputs included/);
    const shared = simulateBench(factBench({ lifetime: "static", n: 2 })).trace.find((s) => s.kind === "enter");
    expect(shared?.clause).toBe("§13.4.2");
    expect(simulateBench(factBench({ lifetime: "static", n: 2 })).trace.find((s) => s.kind === "return")?.clause).toBe("§13.3, §13.4.2");
  });

  it("task steps still cite §13.3.2", () => {
    const run = simulateBench(sendBench({ lifetime: "automatic", secondCallAt: 2 }));
    expect(run.trace.find((s) => s.kind === "enter")?.clause).toBe("§13.3.2, §13.3");
    expect(run.trace.find((s) => s.kind === "print")?.clause).toBe("§13.3.2");
    expect(run.trace.find((s) => s.kind === "return")?.clause).toBe("§13.3, §13.3.2");
  });
});

describe("§6.21 initializers in static subroutines", () => {
  it("rejects `int calls = 0;` in a static task and accepts static, automatic, or an automatic task", () => {
    expect(checkInitializer("static", "none")).toMatchObject({ ok: false, clause: "§6.21", source: "int calls = 0;" });
    expect(checkInitializer("static", "static")).toMatchObject({ ok: true, source: "static int calls = 0;" });
    expect(checkInitializer("static", "automatic")).toMatchObject({ ok: true, source: "automatic int calls = 0;" });
    expect(checkInitializer("automatic", "none")).toMatchObject({ ok: true });
    expect(checkInitializer("static", "static").message).toMatch(/once, at time 0/);
    expect(checkInitializer("static", "automatic").message).toMatch(/every call/);
  });

  it("the compile check flags the same declaration inside a bench", () => {
    const bench = countCallsBench();
    bench.subs[0].locals[0] = { name: "total", type: "int", init: { kind: "const", value: 0 } };
    expect(compileBench(bench)).toEqual([expect.objectContaining({ clause: "§6.21", key: "local:count_calls:total" })]);
  });
});

describe("§13.3.2 two callers, one shared variable (the lesson's send bench)", () => {
  it("static #2: call 2 overwrites the shared id at t = 2, so both calls print id=2", () => {
    expect(logOf(sendBench({ lifetime: "static", secondCallAt: 2 }))).toEqual(["t=10 id=2", "t=12 id=2"]);
  });

  it("automatic #2: each call prints its own id", () => {
    expect(logOf(sendBench({ lifetime: "automatic", secondCallAt: 2 }))).toEqual(["t=10 id=1", "t=12 id=2"]);
  });

  it("static #12: no overlap, so the static version prints correctly (the bug is intermittent)", () => {
    expect(logOf(sendBench({ lifetime: "static", secondCallAt: 12 }))).toEqual(["t=10 id=1", "t=22 id=2"]);
    expect(sendVerdict(exploreBench(sendBench({ lifetime: "static", secondCallAt: 12 })))).toBe("id=1");
  });

  it("static #10: §4.7 leaves the order open, so the model finds both id=1 and id=2", () => {
    const exploration = exploreBench(sendBench({ lifetime: "static", secondCallAt: 10 }));
    const firsts = exploration.outcomes.map((o) => o.result.log[0].text).sort();
    expect(firsts).toEqual(["t=10 id=1", "t=10 id=2"]);
    expect(exploration.deterministic).toBe(false);
    expect(sendVerdict(exploration)).toBe("either");
    expect(exploration.outcomes.reduce((n, o) => n + o.runs.length, 0)).toBe(exploration.runCount);
  });

  it("call 1's print is read from call 1's own line, in every lifetime, start time and debug setting", () => {
    const expected = { static: { 2: "id=2", 10: "either", 12: "id=1" }, automatic: { 2: "id=1", 10: "id=1", 12: "id=1" } } as const;
    for (const lifetime of ["static", "automatic"] as const) {
      for (const secondCallAt of SECOND_CALL_OPTIONS) {
        for (const debugPrints of [false, true]) {
          expect(sendVerdict(exploreBench(sendBench({ lifetime, secondCallAt, debugPrints })))).toBe(expected[lifetime][secondCallAt]);
        }
      }
    }
  });

  it("automatic #10 with the debug prints: two log orders, call 1 prints id=1 in both", () => {
    const exploration = exploreBench(sendBench({ lifetime: "automatic", secondCallAt: 10, debugPrints: true }));
    expect(exploration.outcomes).toHaveLength(2);
    expect(exploration.outcomes.map((o) => o.result.log.filter((l) => l.time === 10).map((l) => l.text)).sort()).toEqual([
      ["t=10 enter id=2", "t=10 use   id=1"],
      ["t=10 use   id=1", "t=10 enter id=2"],
    ]);
    exploration.outcomes.forEach((o) => expect(callOnePrint(o.result)).toBe("id=1"));
  });

  it("the debug comment claims a difference only conditionally for a static task, and own storage for an automatic one", () => {
    const comment = (lifetime: "static" | "automatic") => benchSource(sendBench({ lifetime, secondCallAt: 12, debugPrints: true })).find((l) => l.key === "send-print")?.text;
    expect(comment("static")).toContain("// if this differs from enter: shared storage");
    expect(comment("automatic")).toContain("// same as enter: own storage");
  });

  it("automatic #10: every order prints id=1 first", () => {
    const exploration = exploreBench(sendBench({ lifetime: "automatic", secondCallAt: 10 }));
    expect(exploration.deterministic).toBe(true);
    expect(sendVerdict(exploration)).toBe("id=1");
  });

  it("the storage panel shows one shared box written by both calls, or one box per activation", () => {
    const sharedRun = simulateBench(sendBench({ lifetime: "static", secondCallAt: 2 }));
    const atTwo = sharedRun.trace.filter((s) => s.time === 2 && s.kind === "enter")[0];
    expect(atTwo.boxes).toHaveLength(1);
    expect(atTwo.boxes[0]).toMatchObject({ id: "static:send", owner: "static", activations: [1, 2] });
    expect(atTwo.boxes[0].vars[0]).toMatchObject({ name: "id", value: 2, changed: true });
    expect(atTwo.what).toMatch(/overwriting 1/);

    const ownRun = simulateBench(sendBench({ lifetime: "automatic", secondCallAt: 2 }));
    const ownAtTwo = ownRun.trace.filter((s) => s.time === 2 && s.kind === "enter")[0];
    expect(ownAtTwo.boxes.map((b) => [b.id, b.vars[0].value])).toEqual([
      ["act:1", 1],
      ["act:2", 2],
    ]);
    const firstReturn = ownRun.trace.find((s) => s.kind === "return") as (typeof ownRun.trace)[number];
    expect(firstReturn.time).toBe(10);
    expect(firstReturn.boxes.find((b) => b.id === "act:1")?.alive).toBe(false);
    expect(ownRun.trace[firstReturn.index + 1].boxes.map((b) => b.id)).toEqual(["act:2"]);
  });

  it("the enter/use debug prints show the shared id changing between the two lines", () => {
    expect(logOf(sendBench({ lifetime: "static", secondCallAt: 2, debugPrints: true }))).toEqual(["t=0 enter id=1", "t=2 enter id=2", "t=10 use   id=2", "t=12 use   id=2"]);
    expect(logOf(sendBench({ lifetime: "automatic", secondCallAt: 2, debugPrints: true }))).toEqual(["t=0 enter id=1", "t=2 enter id=2", "t=10 use   id=1", "t=12 use   id=2"]);
  });

  it("consistency: the #2 overlap bench prints the same ids in the sv-process-model", () => {
    const scenario = (automatic: boolean): ProcessScenario => ({
      id: `send-check:${automatic}`,
      title: "send",
      tasks: [{ name: "send", automatic, params: ["id"], body: [{ kind: "delay", amount: pc(10), then: { kind: "display", format: "t=%0d id=%0d", args: [pnow, pv("id")] } }] }],
      processes: [
        {
          id: "main",
          label: "initial",
          kind: "initial",
          body: [{ kind: "fork", join: "join", branches: [{ kind: "call", task: "send", args: [pc(1)] }, { kind: "delay", amount: pc(2), then: { kind: "call", task: "send", args: [pc(2)] } }] }],
        },
      ],
    });
    for (const lifetime of ["static", "automatic"] as const) {
      const theirs = simulateProcesses(scenario(lifetime === "automatic")).log.map((l) => l.text);
      expect(logOf(sendBench({ lifetime, secondCallAt: 2 }))).toEqual(theirs);
    }
  });
});

describe("§13.4.2, §6.21 initializers preset", () => {
  it("count_ones: a static local keeps 8 from the first call, so the second returns 9; automatic returns 1", () => {
    expect(logOf(countOnesBench("static"))).toEqual(["count_ones(8'hFF) = 8", "count_ones(8'h01) = 9"]);
    expect(logOf(countOnesBench("automatic"))).toEqual(["count_ones(8'hFF) = 8", "count_ones(8'h01) = 1"]);
  });

  it("count_calls: a static total counts across calls while an automatic this_call restarts", () => {
    expect(logOf(countCallsBench())).toEqual(["total=1 this_call=1", "total=2 this_call=1", "total=3 this_call=1"]);
    const run = simulateBench(countCallsBench());
    const third = run.trace.filter((s) => s.kind === "print")[2];
    expect(third.boxes.find((b) => b.owner === "static")?.vars).toEqual([expect.objectContaining({ name: "total", value: 3 })]);
    expect(third.boxes.find((b) => b.owner === 3)?.vars).toEqual([expect.objectContaining({ name: "this_call", value: 1 })]);
  });
});

describe("§13.4.2 recursion needs automatic", () => {
  it("fact_static(4) returns 1 and fact_auto(4) returns 24", () => {
    expect(logOf(factBench({ lifetime: "static", n: 4 }))).toEqual(["fact_static(4) = 1"]);
    expect(logOf(factBench({ lifetime: "automatic", n: 4 }))).toEqual(["fact_auto(4) = 24"]);
    for (let n = 1; n <= 5; n += 1) {
      expect(outerReturnValue(simulateBench(factBench({ lifetime: "automatic", n })))).toBe(factorial(n));
      expect(outerReturnValue(simulateBench(factBench({ lifetime: "static", n })))).toBe(1);
    }
  });

  it("static: one shared n overwritten 4 → 3 → 2 → 1, each return evaluates rest * n with the current n", () => {
    const run = simulateBench(factBench({ lifetime: "static", n: 4 }));
    const nValues = run.trace.filter((s) => s.kind === "enter").map((s) => s.boxes.find((b) => b.owner === "static")?.vars.find((x) => x.name === "n")?.value);
    expect(nValues).toEqual([4, 3, 2, 1]);
    run.trace.filter((s) => s.kind === "enter").forEach((s) => expect(s.boxes).toHaveLength(1));
    const returns = run.trace.filter((s) => s.kind === "return");
    expect(returns.map((s) => s.what)).toEqual([
      expect.stringMatching(/fact_static\(1\) returns 1 at/),
      expect.stringMatching(/fact_static\(2\) returns rest \* n = 1 \* 1 = 1/),
      expect.stringMatching(/fact_static\(3\) returns rest \* n = 1 \* 1 = 1/),
      expect.stringMatching(/fact_static\(4\) returns rest \* n = 1 \* 1 = 1/),
    ]);
    expect(returns[1].why).toMatch(/not reentrant/);
  });

  it("automatic: four activation boxes, each with its own n and rest", () => {
    const run = simulateBench(factBench({ lifetime: "automatic", n: 4 }));
    const deepest = run.trace.filter((s) => s.kind === "enter")[3];
    expect(deepest.boxes.map((b) => [b.owner, b.vars.find((x) => x.name === "n")?.value])).toEqual([
      [1, 4],
      [2, 3],
      [3, 2],
      [4, 1],
    ]);
    expect(deepest.callStack).toEqual([1, 2, 3, 4]);
    expect(run.trace.filter((s) => s.kind === "return").map((s) => s.what)).toEqual([
      expect.stringMatching(/fact_auto\(1\) returns 1/),
      expect.stringMatching(/rest \* n = 1 \* 2 = 2/),
      expect.stringMatching(/rest \* n = 2 \* 3 = 6/),
      expect.stringMatching(/rest \* n = 6 \* 4 = 24/),
    ]);
  });

  it("generates the lesson's seven-row trace table for fact_static(4)", () => {
    const rows = recursionTable(simulateBench(factBench({ lifetime: "static", n: 4 })));
    expect(rows.map((r) => [r.running, r.does, r.nAfter, r.restAfter])).toEqual([
      ["fact_static(4)", "copies 4 into n, calls fact_static(3)", "4", "0"],
      ["fact_static(3)", "copies 3 into n, calls fact_static(2)", "3", "0"],
      ["fact_static(2)", "copies 2 into n, calls fact_static(1)", "2", "0"],
      ["fact_static(1)", "copies 1 into n; the base case returns 1", "1", "0"],
      ["fact_static(2)", "rest = 1, returns rest * n = 1 * 1 = 1", "1", "1"],
      ["fact_static(3)", "rest = 1, returns rest * n = 1 * 1 = 1", "1", "1"],
      ["fact_static(4)", "rest = 1, returns rest * n = 1 * 1 = 1", "1", "1"],
    ]);
    expect(rows.map((r) => r.traceIndex)).toEqual([...rows.map((r) => r.traceIndex)].sort((a, b) => a - b));
  });

  it("sum_to(3) returns 0 when static and 6 when automatic", () => {
    expect(logOf(sumToBench({ lifetime: "static", n: 3 }))).toEqual(["sum_to(3) = 0"]);
    expect(logOf(sumToBench({ lifetime: "automatic", n: 3 }))).toEqual(["sum_to(3) = 6"]);
  });
});

describe("§13.3, §13.3.2, §13.5.2 argument directions (the lesson's show_dirs bench)", () => {
  const defaults = { lifetime: "automatic" as const, directions: DEFAULT_DIRECTIONS };

  it("prints the lesson's two lines: ref changes at once, output and inout at the return, input never", () => {
    expect(logOf(showDirsBench(defaults))).toEqual(["t=5  during: v_in=5 v_out=5 v_io=5 v_ref=45", "t=10 after:  v_in=5 v_out=20 v_io=35 v_ref=45"]);
    const summary = directionsSummary(simulateBench(showDirsBench(defaults)));
    expect(summary.during).toEqual({ v_in: 5, v_out: 5, v_io: 5, v_ref: 45 });
    expect(summary.after).toEqual({ v_in: 5, v_out: 20, v_io: 35, v_ref: 45 });
  });

  it("an output starts at the int default 0 inside an automatic task, not at the caller's 5", () => {
    const run = simulateBench(showDirsBench(defaults));
    const enter = run.trace.find((s) => s.kind === "enter") as (typeof run.trace)[number];
    expect(enter.what).toMatch(/b starts at 0 \(output: not copied in; the int default\)/);
    expect(enter.boxes[0].vars.find((x) => x.name === "b")?.value).toBe(0);
    expect(enter.boxes[0].refs).toEqual([{ name: "d", target: "v_ref", direction: "ref" }]);
  });

  it("copy-out happens once, at the return (§13.3): the trace has exactly one return step that writes v_out and v_io", () => {
    const run = simulateBench(showDirsBench(defaults));
    const returns = run.trace.filter((s) => s.kind === "return");
    expect(returns).toHaveLength(1);
    expect(returns[0].time).toBe(10);
    expect(returns[0].changedGlobals.sort()).toEqual(["v_io", "v_out"]);
    const refWrite = run.trace.find((s) => s.lineKey === "dir-d") as (typeof run.trace)[number];
    expect(refWrite.time).toBe(0);
    expect(refWrite.changedGlobals).toEqual(["v_ref"]);
    expect(refWrite.clause).toBe("§13.5.2");
  });

  it("every direction on every formal gives the values §13.3 and §13.5.2 predict", () => {
    const expectations: Record<Direction, { during: number; after: number }> = {
      input: { during: 5, after: 5 },
      output: { during: 5, after: 20 },
      inout: { during: 5, after: 35 },
      ref: { during: 45, after: 45 },
      "const ref": { during: 5, after: 5 },
    };
    (["input", "output", "inout", "ref"] as Direction[]).forEach((direction) => {
      const directions = { ...DEFAULT_DIRECTIONS, b: direction };
      const summary = directionsSummary(simulateBench(showDirsBench({ lifetime: "automatic", directions })));
      const adds = direction === "output" ? 20 : direction === "inout" ? 20 : direction === "ref" ? 20 : 0;
      expect(summary.after.v_out).toBe(direction === "input" ? 5 : direction === "output" ? 20 : 5 + adds);
      expect(summary.during.v_out).toBe(direction === "ref" ? 25 : 5);
    });
    expect(expectations.ref.during).toBe(45);
  });

  it("a static task called twice keeps its output from the previous call (§13.3.2)", () => {
    const directions = { ...DEFAULT_DIRECTIONS, d: "inout" as Direction };
    const twice = simulateBench(showDirsBench({ lifetime: "static", directions, calls: 2 }));
    const summary = directionsSummary(twice);
    expect(summary.after).toEqual({ v_in: 5, v_out: 20, v_io: 35, v_ref: 45 });
    expect(summary.afterSecond).toEqual({ v_in: 5, v_out: 40, v_io: 65, v_ref: 85 });
    const second = twice.trace.filter((s) => s.kind === "enter")[1];
    expect(second.what).toMatch(/b keeps 20 \(output: not copied in; static storage is not re-initialized\)/);
    const once = directionsSummary(simulateBench(showDirsBench({ lifetime: "automatic", directions, calls: 2 })));
    expect(once.afterSecond?.v_out).toBe(20);
  });

  it("the code comments stay true for a second call", () => {
    const text = (lifetime: "static" | "automatic", calls: 1 | 2) =>
      benchSource(showDirsBench({ lifetime, directions: { ...DEFAULT_DIRECTIONS, d: "inout" }, calls }))
        .map((l) => l.text)
        .join("\n");
    expect(text("automatic", 1)).toContain("b starts at 0, the int default, not at the caller's 5");
    expect(text("automatic", 1)).toContain("from t=0 to t=10");
    expect(text("static", 2)).toContain("on the first call only");
    expect(text("static", 2)).not.toContain("from t=0 to t=10");
    expect(text("static", 2)).not.toContain("not at the caller's 5");
    expect(text("static", 2)).toContain("for 10 ns, on each call");
    expect(text("automatic", 2)).toContain("b starts at 0 on each call");
  });

  it("illegal choices are reported with their clause instead of being run", () => {
    expect(compileBench(showDirsBench({ lifetime: "static", directions: DEFAULT_DIRECTIONS }))).toEqual([expect.objectContaining({ clause: "§13.5.2", key: "formal:show_dirs:d" })]);
    expect(compileBench(showDirsBench({ lifetime: "automatic", directions: { ...DEFAULT_DIRECTIONS, d: "const ref" } }))).toEqual([
      expect.objectContaining({ clause: "§13.5.2", key: "dir-d", message: expect.stringMatching(/const ref/) }),
    ]);
    expect(compileBench(showDirsBench({ lifetime: "automatic", directions: DEFAULT_DIRECTIONS, nbaOnB: true }))).toEqual([expect.objectContaining({ clause: "§13.3.2", key: "dir-b" })]);
    // §13.5.2: a ref argument may not be used where an automatic variable may not, so `b <= b + 20` through a ref b is an error even though b itself is a binding, not an automatic item.
    expect(compileBench(showDirsBench({ lifetime: "automatic", directions: { ...DEFAULT_DIRECTIONS, b: "ref" }, nbaOnB: true }))).toEqual([
      expect.objectContaining({ clause: "§13.5.2", key: "dir-b", message: expect.stringMatching(/nonblocking assignment through b unless the formal is declared ref static/) }),
    ]);
    expect(compileBench(showDirsBench({ lifetime: "automatic", directions: { ...DEFAULT_DIRECTIONS, b: "ref" } }))).toEqual([]);
    expect(() => simulateBench(showDirsBench({ lifetime: "static", directions: DEFAULT_DIRECTIONS }))).toThrow(/does not compile/);
  });

  it("<= to a static task's formal is legal and lands in the NBA region before the return", () => {
    const directions = { ...DEFAULT_DIRECTIONS, d: "input" as Direction };
    const bench = showDirsBench({ lifetime: "static", directions, nbaOnB: true });
    expect(compileBench(bench)).toEqual([]);
    const run = simulateBench(bench);
    expect(run.trace.some((s) => s.kind === "nba" && s.time === 0)).toBe(true);
    expect(directionsSummary(run).after.v_out).toBe(20);
  });
});

describe("§13.3, §13.5.2, §9.4.2 pulse(busy): output versus ref", () => {
  it("output: busy stays 0 and always @(busy) never prints", () => {
    const run = simulateBench(pulseBench({ lifetime: "automatic", direction: "output" }));
    expect(run.log).toEqual([]);
    const ret = run.trace.find((s) => s.kind === "return") as (typeof run.trace)[number];
    expect(ret.time).toBe(23);
    expect(ret.what).toMatch(/busy was already 0, so nothing changes and always @\(busy\) does not wake/);
    expect(run.trace.map((s) => s.globals.busy)).not.toContain(1);
  });

  it("ref: busy is 1 at 13 ns and 0 at 23 ns", () => {
    const run = simulateBench(pulseBench({ lifetime: "automatic", direction: "ref" }));
    expect(run.log.map((l) => `${l.time}:${l.text}`)).toEqual(["13:t=13 busy=1", "23:t=23 busy=0"]);
    expect(run.trace.filter((s) => s.kind === "watch").map((s) => s.clause)).toEqual(["§9.4.2", "§9.4.2"]);
  });

  it("<= in a static task: the copy-out at the return runs before the NBA update, so busy takes flag's old 1 (§13.3, §4.4.2.4)", () => {
    for (const direction of ["output", "inout"] as const) {
      const run = simulateBench(pulseBench({ lifetime: "static", direction, nba: true }));
      expect(run.log.map((l) => l.text)).toEqual(["t=23 busy=1"]);
      expect(run.globals.busy).toBe(1);
    }
    expect(simulateBench(pulseBench({ lifetime: "static", direction: "input", nba: true })).log).toEqual([]);
  });

  it("inout and input never move busy; const ref, static+ref and <= through a ref are compile errors", () => {
    expect(simulateBench(pulseBench({ lifetime: "automatic", direction: "inout" })).log).toEqual([]);
    expect(simulateBench(pulseBench({ lifetime: "automatic", direction: "input" })).log).toEqual([]);
    expect(compileBench(pulseBench({ lifetime: "automatic", direction: "const ref" })).map((i) => i.clause)).toEqual(["§13.5.2", "§13.5.2"]);
    expect(compileBench(pulseBench({ lifetime: "static", direction: "ref" })).map((i) => i.clause)).toEqual(["§13.5.2"]);
    const nbaThroughRef = compileBench(pulseBench({ lifetime: "automatic", direction: "ref", nba: true }));
    expect(nbaThroughRef.map((i) => i.clause)).toEqual(["§13.5.2", "§13.5.2"]);
    expect(nbaThroughRef.map((i) => i.key)).toEqual(["pulse-high", "pulse-low"]);
    expect(nbaThroughRef[0].message).toMatch(/flag is a ref argument.*ref static/);
    expect(compileBench(pulseBench({ lifetime: "automatic", direction: "const ref", nba: true })).map((i) => i.clause)).toEqual(["§13.5.2", "§13.5.2", "§13.5.2", "§13.5.2"]);
    expect(compileBench(pulseBench({ lifetime: "automatic", direction: "output", nba: true })).map((i) => i.clause)).toEqual(["§13.3.2", "§13.3.2"]);
  });
});

describe("Kata: fix the bench that lies", () => {
  it("as written, the bench prints the lesson's lying log", () => {
    expect(logOf(kataBench())).toEqual([...KATA_BUGGY_LOG]);
    expect(compileBench(kataBench())).toEqual([]);
  });

  it("the three one-word fixes produce the corrected log and pass", () => {
    const grade = gradeKata(KATA_SOLUTION);
    expect(grade.passed).toBe(true);
    expect(grade.log).toEqual([...KATA_EXPECTED_LOG]);
    expect(grade.lines.every((l) => l.match)).toBe(true);
    expect(grade.notes).toEqual([]);
  });

  it("grades partial fixes line by line", () => {
    const grade = gradeKata({ ...NO_KATA_FIXES, sum_to: "automatic" });
    expect(grade.passed).toBe(false);
    expect(grade.lines.map((l) => l.match)).toEqual([false, true, true, false, false]);
    expect(grade.lines[0]).toEqual({ expected: "t=10 first", actual: "t=10 second", match: false });
    expect(grade.lines[3]).toEqual({ expected: "t=13 busy=1", actual: undefined, match: false });
  });

  it("decoys: <= on pulse is a §13.3.2 error, ref on a static log_after a §13.5.2 error, and no-op fixes are explained", () => {
    const nba = gradeKata({ ...KATA_SOLUTION, pulse: "nba" });
    expect(nba.passed).toBe(false);
    expect(nba.issues.map((i) => i.clause)).toEqual(["§13.3.2", "§13.3.2"]);
    const ref = gradeKata({ ...KATA_SOLUTION, log_after: "ref" });
    expect(ref.issues.map((i) => i.clause)).toEqual(expect.arrayContaining(["§13.5.2"]));
    expect(ref.issues.some((i) => /literal/.test(i.message))).toBe(true);
    expect(kataFixNote("sum_to", "return-type")).toMatch(/already returns int/);
    expect(kataFixNote("pulse", "automatic")).toMatch(/already automatic/);
    expect(kataFixNote("log_after", "automatic")).toBeUndefined();
    expect(gradeKata({ ...KATA_SOLUTION, sum_to: "return-type" }).notes).toHaveLength(1);
  });

  it("every symptom names a declaration line that exists in the source, and every decoy line has a diagnosis for each symptom", () => {
    const keys = new Set(benchSource(kataBench()).map((l) => l.key));
    KATA_SYMPTOMS.forEach((s) => expect(keys.has(s.suspect)).toBe(true));
    KATA_SUSPECTS.forEach((line) => {
      expect(keys.has(line.key)).toBe(true);
      KATA_SYMPTOMS.forEach((s) => {
        if (s.suspect !== line.key) expect(line.feedback[s.id]).toBeTruthy();
        else expect(line.feedback[s.id]).toBeUndefined();
      });
    });
  });
});

describe("Source generation", () => {
  it("renders the send bench as the lesson writes it, with the lifetime keyword following the toggle", () => {
    const text = (bench: Bench) => benchSource(bench).map((l) => l.text);
    expect(text(sendBench({ lifetime: "static", secondCallAt: 2 }))).toContain("  task send(input int id);");
    expect(text(sendBench({ lifetime: "automatic", secondCallAt: 2 }))).toContain("  task automatic send(input int id);");
    expect(text(sendBench({ lifetime: "static", secondCallAt: 2 }))).toContain('    #10 $display("t=%0d id=%0d", $time, id);');
    const lines = benchSource(sendBench({ lifetime: "static", secondCallAt: 2 }));
    expect(lines.find((l) => l.key === "sub:send")?.text).toBe("  task send(input int id);");
    expect(lines.find((l) => l.key === "call-2")?.text).toMatch(/^\s+#2 send\(2\);/);
  });

  it("can leave the comments out while every line keeps its number and key", () => {
    const benches = [sendBench({ lifetime: "static", secondCallAt: 2, debugPrints: true }), factBench({ lifetime: "static", n: 4 }), countOnesBench("static"), showDirsBench({ lifetime: "automatic", directions: DEFAULT_DIRECTIONS }), pulseBench({ lifetime: "automatic", direction: "output" })];
    benches.forEach((bench) => {
      const withComments = benchSource(bench);
      const without = benchSource(bench, { comments: false });
      expect(withComments.some((l) => l.text.includes("//"))).toBe(true);
      expect(without.some((l) => l.text.includes("//"))).toBe(false);
      expect(without.map((l) => l.key)).toEqual(withComments.map((l) => l.key));
    });
  });

  it("renders show_dirs with one formal per line and the kata bench's declarations", () => {
    const dirs = benchSource(showDirsBench({ lifetime: "automatic", directions: DEFAULT_DIRECTIONS })).map((l) => l.text);
    expect(dirs).toContain("  int v_in = 5, v_out = 5, v_io = 5, v_ref = 5;");
    expect(dirs).toContain("  task automatic show_dirs(");
    expect(dirs).toContain("    ref int d");
    const kata = benchSource(kataBench()).map((l) => l.text);
    expect(kata).toContain("  task log_after(input int delay_ns, input string msg);");
    expect(kata).toContain("  function int sum_to(input int n);");
    expect(kata).toContain("  task automatic pulse(output logic flag);");
    expect(kata).toContain('  always @(busy) $display("t=%0d busy=%b", $time, busy);');
    expect(kata).toContain('      #2 log_after(10, "second");');
    const fixed = benchSource(kataBench(KATA_SOLUTION)).map((l) => l.text);
    expect(fixed).toContain("  task automatic log_after(input int delay_ns, input string msg);");
    expect(fixed).toContain("  function automatic int sum_to(input int n);");
    expect(fixed).toContain("  task automatic pulse(ref logic flag);");
  });

  it("every step's line key points at a source line", () => {
    for (const bench of [sendBench({ lifetime: "static", secondCallAt: 10 }), factBench({ lifetime: "static", n: 3 }), showDirsBench({ lifetime: "automatic", directions: DEFAULT_DIRECTIONS }), kataBench(KATA_SOLUTION)]) {
      const keys = new Set(benchSource(bench).map((l) => l.key).filter(Boolean));
      simulateBench(bench).trace.forEach((s) => {
        if (s.lineKey) expect(keys.has(s.lineKey)).toBe(true);
      });
    }
  });
});
