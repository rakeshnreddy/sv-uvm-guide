import { describe, expect, it } from "vitest";

import { containerPrograms, emptyWorld, execStmt, runProgram, type ContainerStmt } from "@/lib/uvm-container-model";

const run = (stmts: ContainerStmt[]) => runProgram(stmts);
const last = (stmts: ContainerStmt[]) => run(stmts).at(-1)!.result;

describe("uvm-container-model: uvm_pool (uvm_pool.svh, IEEE 1800.2-2020 11.2)", () => {
  const pool: ContainerStmt = { kind: "new", target: "p", type: "uvm_pool#(string,int)", name: "p" };

  it("get() of a missing key INSERTS the default value and returns it", () => {
    const steps = run([pool, { kind: "get", target: "p", key: "timeout", into: "n" }, { kind: "num", target: "p" }]);
    expect(steps[1].result.output).toBe("n = 0");
    expect(steps[1].result.changed).toBe(true);
    expect(steps[2].result.output).toBe("1");
  });

  it("exists() does not insert", () => {
    const steps = run([pool, { kind: "exists", target: "p", key: "x" }, { kind: "num", target: "p" }]);
    expect(steps[1].result.output).toBe("0");
    expect(steps[2].result.output).toBe("0");
  });

  it("delete() of a missing key warns POOLDEL and changes nothing", () => {
    const r = last([pool, { kind: "delete", target: "p", key: "nope" }]);
    expect(r.warning).toMatch(/\[POOLDEL\] delete: pool key doesn't exist/);
    expect(r.changed).toBe(false);
  });

  it("add() overwrites an existing key", () => {
    const steps = run([pool, { kind: "add", target: "p", key: "k", value: 1 }, { kind: "add", target: "p", key: "k", value: 5 }, { kind: "get", target: "p", key: "k" }]);
    expect(steps[3].result.output).toBe("n = 5");
  });

  it("get_global_pool() returns one singleton per specialization", () => {
    const steps = run([
      { kind: "global", target: "a", type: "uvm_pool#(string,int)" },
      { kind: "global", target: "b", type: "uvm_pool#(string,int)" },
      { kind: "global", target: "c", type: "uvm_pool#(string,uvm_event)" },
      { kind: "same", a: "a", b: "b" },
      { kind: "same", a: "a", b: "c" },
    ]);
    expect(steps[3].result.output).toBe("1");
    expect(steps[4].result.output).toBe("0");
  });

  it("a uvm_pool of class handles returns (and stores) null for a missing key: trigger() is a null access", () => {
    const steps = run([
      { kind: "new", target: "raw", type: "uvm_pool#(string,uvm_event)", name: "raw" },
      { kind: "get-trigger", target: "raw", key: "dma_done" },
      { kind: "num", target: "raw" },
    ]);
    expect(steps[1].result.fatal).toMatch(/Null object access/);
    expect(steps).toHaveLength(2); // a fatal stops the program
    expect(steps[1].result.world.objects[1].entries).toEqual([["dma_done", { kind: "null" }]]);
  });

  it("uvm_event_pool::get() creates the event (uvm_object_string_pool::get → new(key))", () => {
    const r = last([{ kind: "event-pool-get-global-trigger", key: "cfg_done" }]);
    expect(r.fatal).toBeUndefined();
    const pool = Object.values(r.world.objects).find((o) => o.type === "uvm_event_pool")!;
    expect(pool.entries[0][1]).toMatchObject({ kind: "event", name: "cfg_done", triggered: true });
  });

  it("entries iterate in lexicographic key order (IEEE 1800-2023 §7.8.2)", () => {
    const r = last([pool, { kind: "add", target: "p", key: "zeta", value: 1 }, { kind: "add", target: "p", key: "alpha", value: 2 }]);
    expect(r.world.objects[1].entries.map(([k]) => k)).toEqual(["alpha", "zeta"]);
  });

  it("print() lists values; compare() of two different pools still returns 1 (no do_compare)", () => {
    const steps = run([
      pool,
      { kind: "add", target: "p", key: "a", value: 1 },
      { kind: "new", target: "p2", type: "uvm_pool#(string,int)", name: "p2" },
      { kind: "print", target: "p" },
      { kind: "compare", a: "p", b: "p2" },
    ]);
    expect(steps[3].result.output).toContain("[-key0--]  1");
    expect(steps[4].result.output).toBe("1");
  });
});

describe("uvm-container-model: uvm_queue (uvm_queue.svh, IEEE 1800.2-2020 11.3)", () => {
  const q: ContainerStmt[] = [
    { kind: "new", target: "q", type: "uvm_queue#(int)", name: "q" },
    { kind: "push_back", target: "q", value: 5 },
    { kind: "push_back", target: "q", value: 9 },
  ];

  it("insert(size(), x) is rejected with QUEUEINS (a native queue would append)", () => {
    const r = last([...q, { kind: "insert", target: "q", index: "size", value: 7 }]);
    expect(r.warning).toMatch(/\[QUEUEINS\] insert: given index out of range for queue of size 2/);
    expect(r.world.objects[1].items).toEqual([5, 9]);
  });

  it("insert(i, x) with i < size() inserts before i", () => {
    const r = last([...q, { kind: "insert", target: "q", index: 1, value: 7 }]);
    expect(r.world.objects[1].items).toEqual([5, 7, 9]);
  });

  it("get() out of range warns QUEUEGET, returns the default and never grows the queue", () => {
    const r = last([...q, { kind: "qget", target: "q", index: 4 }]);
    expect(r.output).toBe("x = 0");
    expect(r.warning).toMatch(/QUEUEGET/);
    expect(r.world.objects[1].items).toHaveLength(2);
  });

  it("delete() with no index empties; delete(i) out of range warns QUEUEDEL", () => {
    expect(last([...q, { kind: "qdelete", target: "q", index: 7 }]).warning).toMatch(/QUEUEDEL/);
    expect(last([...q, { kind: "qdelete", target: "q" }]).world.objects[1].items).toEqual([]);
  });

  it("pop_front() on an empty queue returns the default (IEEE 1800-2023 §7.10.2.4)", () => {
    const r = last([{ kind: "new", target: "q", type: "uvm_queue#(int)", name: "q" }, { kind: "pop_front", target: "q" }]);
    expect(r.output).toBe("x = 0");
  });

  it("print() shows only the header; convert2string() shows the elements", () => {
    const steps = run([...q, { kind: "print", target: "q" }, { kind: "convert2string", target: "q" }]);
    expect(steps[3].result.output).not.toContain("5");
    expect(steps[4].result.output).toBe("'{5, 9}");
  });

  it("compare() of queues with different contents returns 1: there is nothing to compare", () => {
    const r = last([...q, { kind: "new", target: "q2", type: "uvm_queue#(int)", name: "q2" }, { kind: "compare", a: "q", b: "q2" }]);
    expect(r.output).toBe("1");
  });
});

describe("uvm-container-model: explorer programs", () => {
  it("every program has exactly one correct prediction option and runs without an unexpected fatal before the gate", () => {
    for (const p of Object.values(containerPrograms)) {
      expect(p.options.filter((o) => o.correct)).toHaveLength(1);
      const steps = runProgram(p.stmts);
      expect(steps.length).toBeGreaterThan(p.predictAt);
      expect(steps.slice(0, p.predictAt).every((s) => !s.result.fatal)).toBe(true);
    }
  });

  it("execStmt never mutates its input world", () => {
    const w = emptyWorld();
    execStmt(w, { kind: "new", target: "q", type: "uvm_queue#(int)", name: "q" });
    expect(w.objects).toEqual({});
  });
});
