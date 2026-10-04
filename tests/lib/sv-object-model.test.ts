import { describe, expect, it } from "vitest";

import {
  aliasesOf,
  castOutcome,
  classSourceLines,
  dispatchClassLines,
  getHeapPreset,
  gradeMonitor,
  heapPresets,
  HEADER_CLASS,
  PACKET_CLASS,
  resolveCall,
  scenarioCodeLines,
  simulateHeap,
  TXN_HIERARCHY,
  withVirtualOrigin,
  type ClassTable,
  type HeapScenario,
  type HeapState,
  type HeapStatement,
} from "@/lib/sv-object-model";

const packetScenario = (statements: HeapStatement[], vars = ["p1", "p2", "p3"]): HeapScenario => ({
  id: "t",
  title: "t",
  classes: [HEADER_CLASS, PACKET_CLASS],
  vars: vars.map((name) => ({ name, className: "packet", kind: "handle" as const })),
  statements,
});

const ref = (s: HeapState, v: string) => {
  const value = s.vars[v];
  return value.kind === "handle" ? value.ref : null;
};
const obj = (s: HeapState, id: string | null) => s.objects.find((o) => o.id === id);
const int = (s: HeapState, id: string | null, f: string) => {
  const v = obj(s, id)?.fields[f];
  return v?.kind === "int" ? v.value : undefined;
};
const handle = (s: HeapState, id: string | null, f: string) => {
  const v = obj(s, id)?.fields[f];
  return v?.kind === "handle" ? v.ref : undefined;
};
const queue = (s: HeapState, id: string | null, f: string) => {
  const v = obj(s, id)?.fields[f];
  return v?.kind === "intQueue" ? v.items : undefined;
};

describe("sv-object-model heap: handles and new", () => {
  it("§8.4: declared class variables start null and no object exists before new", () => {
    const run = simulateHeap(packetScenario([]));
    expect(run.trace).toHaveLength(1);
    expect(ref(run.final, "p1")).toBeNull();
    expect(run.final.objects).toHaveLength(0);
    // §8.9: the static property exists without any object.
    expect(run.final.statics["packet::count"]).toBe(0);
  });

  it("§8.7: new runs property initializers (header hdr = new) and then the constructor body", () => {
    const run = simulateHeap(packetScenario([{ id: "x", kind: "new", target: "p1" }]));
    const p = ref(run.final, "p1");
    expect(p).toBe("packet@1");
    expect(handle(run.final, p, "hdr")).toBe("header@1");
    expect(int(run.final, "header@1", "len")).toBe(4);
    expect(queue(run.final, p, "data")).toEqual([1, 2]);
    expect(run.final.statics["packet::count"]).toBe(1);
  });

  it("§8.12: h2 = h1 copies the handle — no new object, writes through either name are seen by both", () => {
    const run = simulateHeap(getHeapPreset("aliasing").build());
    expect(run.final.objects.filter((o) => o.className === "packet")).toHaveLength(1);
    expect(ref(run.final, "p2")).toBe(ref(run.final, "p1"));
    expect(int(run.final, ref(run.final, "p1"), "id")).toBe(7);
    expect(run.final.log).toEqual(["p1.id=7"]);
  });
});

describe("sv-object-model heap: shallow copy (§8.12)", () => {
  const run = simulateHeap(getHeapPreset("shallow-copy").build());
  const p1 = ref(run.final, "p1");
  const p2 = ref(run.final, "p2");

  it("creates a second object of the same class", () => {
    expect(p1).toBe("packet@1");
    expect(p2).toBe("packet@2");
  });

  it("copies ints by value: writes to the copy do not reach the source", () => {
    expect(int(run.final, p2, "id")).toBe(5);
    const changed = simulateHeap(packetScenario([{ id: "a", kind: "new", target: "p1" }, { id: "b", kind: "shallowCopy", target: "p2", source: "p1" }, { id: "c", kind: "setInt", target: "p2.id", value: 3 }]));
    expect(int(changed.final, "packet@1", "id")).toBe(0);
  });

  it("copies nested object handles as handles: p1.hdr and p2.hdr are the same header", () => {
    expect(handle(run.final, p1, "hdr")).toBe("header@1");
    expect(handle(run.final, p2, "hdr")).toBe("header@1");
    expect(run.final.objects.filter((o) => o.className === "header")).toHaveLength(1);
    expect(int(run.final, "header@1", "len")).toBe(9);
    expect(run.final.log).toEqual(["p1.data='{1, 2}", "p1.hdr.len=9"]);
  });

  it("§7.6 + §8.12: a queue property is copied element by element, so it is not shared", () => {
    expect(queue(run.final, p1, "data")).toEqual([1, 2]);
    expect(queue(run.final, p2, "data")).toEqual([1, 2, 3]);
  });

  it("does not call the constructor or run declaration initializers", () => {
    const counted = simulateHeap(getHeapPreset("static-count").build());
    // Three packets exist, but only two were built with new().
    expect(counted.trace.find((s) => s.stmtId === "c3")?.state.objects.filter((o) => o.className === "packet")).toHaveLength(3);
    expect(counted.final.statics["packet::count"]).toBe(2);
    // No header was created for the copy: the initializer `header hdr = new` did not run.
    const afterCopy = counted.trace.find((s) => s.stmtId === "c3")!.state;
    expect(afterCopy.objects.filter((o) => o.className === "header")).toHaveLength(2);
  });
});

describe("sv-object-model heap: user-written deep copy", () => {
  const run = simulateHeap(getHeapPreset("deep-copy").build());

  it("copies the nested header's contents into the target's own header", () => {
    const afterCopy = run.trace.find((s) => s.stmtId === "d4")!.state;
    expect(handle(afterCopy, "packet@2", "hdr")).toBe("header@2");
    expect(int(afterCopy, "header@2", "len")).toBe(9);
  });

  it("leaves nothing shared: later writes through the copy do not reach the source", () => {
    expect(int(run.final, "header@1", "len")).toBe(9);
    expect(int(run.final, "header@2", "len")).toBe(2);
    expect(run.final.log).toEqual(["p1.hdr.len=9", "p3.hdr.len=2"]);
  });

  it("generates the copy() it executes: contents copied with hdr.copy, never hdr = rhs.hdr", () => {
    const text = classSourceLines(PACKET_CLASS).map((l) => l.text).join("\n");
    expect(text).toContain("hdr.copy(rhs.hdr);");
    expect(text).not.toMatch(/hdr = rhs\.hdr;/);
    expect(text).toContain("data = rhs.data;");
  });
});

describe("sv-object-model heap: lifetime and null (§8.29, §8.4)", () => {
  const run = simulateHeap(getHeapPreset("null-and-garbage").build());

  it("§8.29: dropping the last handle makes the object (and what only it reaches) unreachable", () => {
    const afterOrphan = run.trace.find((s) => s.stmtId === "n3")!;
    expect(afterOrphan.becameUnreachable.sort()).toEqual(["header@1", "packet@1"]);
    expect(obj(afterOrphan.state, "packet@2")?.reachable).toBe(true);
  });

  it("an object stays reachable while any handle still refers to it", () => {
    const afterP2Null = run.trace.find((s) => s.stmtId === "n4")!;
    expect(afterP2Null.becameUnreachable).toEqual([]);
    expect(obj(afterP2Null.state, "packet@2")?.reachable).toBe(true);
    const afterP1Null = run.trace.find((s) => s.stmtId === "n5")!;
    expect(afterP1Null.becameUnreachable.sort()).toEqual(["header@2", "packet@2"]);
  });

  it("§8.29: reachability is transitive, so a cycle with no outside handle is unreachable", () => {
    const cyc: HeapScenario = {
      id: "cycle",
      title: "cycle",
      classes: [{ name: "node", column: 1, fields: [{ kind: "handle", name: "next", className: "node", init: "null" }] }],
      vars: [
        { name: "a", className: "node", kind: "handle" },
        { name: "b", className: "node", kind: "handle" },
      ],
      statements: [
        { id: "1", kind: "new", target: "a" },
        { id: "2", kind: "new", target: "b" },
        { id: "3", kind: "assign", target: "a.next", source: "b" },
        { id: "4", kind: "assign", target: "b.next", source: "a" },
        { id: "5", kind: "assign", target: "a", source: null },
        { id: "6", kind: "assign", target: "b", source: null },
      ],
    };
    const r = simulateHeap(cyc);
    expect(r.trace.find((s) => s.stmtId === "5")!.becameUnreachable).toEqual([]);
    expect(r.final.objects.every((o) => !o.reachable)).toBe(true);
  });

  it("§8.4: a virtual method call through a null handle is a run-time error and the trace stops", () => {
    expect(run.error).toMatch(/null/);
    const last = run.trace.at(-1)!;
    expect(last.stmtId).toBe("n6");
    expect(last.error).toMatch(/virtual method through a null handle is illegal \(§8\.4\)/);
  });

  it("§8.4: writing a field through a null handle is a run-time error", () => {
    const r = simulateHeap(packetScenario([{ id: "w", kind: "setInt", target: "p1.id", value: 1 }]));
    expect(r.error).toMatch(/p1 is null/);
  });

  it("§8.4 + §8.9: a static property is still accessible through a null handle", () => {
    const r = simulateHeap(getHeapPreset("static-count").build());
    expect(r.error).toBeUndefined();
    expect(r.final.log).toEqual(["packet::count=2", "p2.count=2", "p1.count=2"]);
  });
});

describe("sv-object-model heap: the stored-handle scoreboard bug", () => {
  it("reusing one txn object makes every stored expected item read the last sample", () => {
    const v = gradeMonitor("buggy");
    expect(v.stored).toEqual([9, 9, 9]);
    expect(v.distinctObjects).toBe(1);
    expect(v.pass).toBe(false);
  });

  it("constructing a new txn inside the loop fixes it", () => {
    const v = gradeMonitor("new-in-loop");
    expect(v.stored).toEqual([3, 5, 9]);
    expect(v.distinctObjects).toBe(3);
    expect(v.pass).toBe(true);
  });

  it("storing a copy (new t) fixes it; storing a second handle to the same object does not", () => {
    expect(gradeMonitor("copy-before-store").pass).toBe(true);
    const alias = gradeMonitor("alias-before-store");
    expect(alias.stored).toEqual([9, 9, 9]);
    expect(alias.pass).toBe(false);
  });

  it("setting t = null after storing crashes on the next iteration (§8.4)", () => {
    const v = gradeMonitor("null-after-store");
    expect(v.stored).toBeNull();
    expect(v.run.error).toMatch(/t is null/);
    expect(v.run.trace.at(-1)?.iteration).toBe(2);
  });

  it("aliasesOf lists every name that reaches the shared object", () => {
    const v = gradeMonitor("buggy");
    expect(v.run.final.log).toEqual(["9 9 9"]);
    expect(aliasesOf(v.run.final, "txn@1").sort()).toEqual(["exp_q[0]", "exp_q[1]", "exp_q[2]", "t"]);
  });
});

describe("sv-object-model heap: code generation stays in sync", () => {
  it("every preset statement appears as generated SystemVerilog", () => {
    for (const preset of heapPresets) {
      const scenario = preset.build();
      const keys = scenarioCodeLines(scenario).map((l) => l.key);
      for (const gate of preset.gates) expect(keys).toContain(gate.stmtId);
    }
    const lines = scenarioCodeLines(getHeapPreset("shallow-copy").build()).map((l) => l.text.trim());
    expect(lines).toContain("p2 = new p1;");
    expect(lines).toContain("p2.data.push_back(3);");
  });

  it("every gate has exactly one correct option, and the model's trace agrees with it", () => {
    const after = (presetId: Parameters<typeof getHeapPreset>[0], stmtId: string) => simulateHeap(getHeapPreset(presetId).build()).trace.find((s) => s.stmtId === stmtId)!;
    const checks: Record<string, () => void> = {
      "objects-after-assign": () => expect(after("aliasing", "a2").state.objects.filter((o) => o.className === "packet")).toHaveLength(1),
      "read-through-alias": () => expect(int(after("aliasing", "a3").state, "packet@1", "id")).toBe(7),
      "queue-after-shallow": () => expect(queue(after("shallow-copy", "s4").state, "packet@1", "data")).toEqual([1, 2]),
      "nested-after-shallow": () => expect(int(after("shallow-copy", "s5").state, "header@1", "len")).toBe(9),
      "header-after-copy": () => {
        const s = after("deep-copy", "d4").state;
        expect(handle(s, "packet@2", "hdr")).not.toBe(handle(s, "packet@1", "hdr"));
        expect(int(s, handle(s, "packet@2", "hdr") ?? null, "len")).toBe(9);
      },
      "independent-after-copy": () => expect(int(after("deep-copy", "d5").state, "header@1", "len")).toBe(9),
      orphan: () => expect(obj(after("null-and-garbage", "n3").state, "packet@1")?.reachable).toBe(false),
      "null-call": () => expect(after("null-and-garbage", "n6").error).toBeDefined(),
      "count-after-copy": () => expect(after("static-count", "c3").state.statics["packet::count"]).toBe(2),
      "static-through-null": () => expect(after("static-count", "c6").state.log.at(-1)).toBe("p1.count=2"),
    };
    const gateIds = heapPresets.flatMap((p) => p.gates.map((g) => g.id));
    expect(gateIds.sort()).toEqual(Object.keys(checks).sort());
    for (const preset of heapPresets) for (const gate of preset.gates) expect(gate.options.filter((o) => o.correct)).toHaveLength(1);
    Object.values(checks).forEach((check) => check());
  });
});

describe("sv-object-model dispatch (§8.14, §8.15, §8.20)", () => {
  it("§8.20 Example 1: printA (non-virtual) follows the handle, printB (virtual) follows the object", () => {
    const lrm: ClassTable = [
      {
        name: "BasePacket",
        methods: [
          { name: "printA", isVirtual: false, output: "BasePacket::A is 1" },
          { name: "printB", isVirtual: true, output: "BasePacket::B is 2" },
        ],
      },
      {
        name: "My_Packet",
        extends: "BasePacket",
        methods: [
          { name: "printA", isVirtual: false, output: "My_Packet::A is 3" },
          { name: "printB", isVirtual: true, output: "My_Packet::B is 4" },
        ],
      },
    ];
    const call = (method: string, handleType: string) => resolveCall(lrm, { handleType, objectType: "My_Packet", method });
    const outputOf = (r: ReturnType<typeof call>) => (r.kind === "ok" ? r.output : r.kind);
    expect(outputOf(call("printA", "BasePacket"))).toEqual(["BasePacket::A is 1"]);
    expect(outputOf(call("printB", "BasePacket"))).toEqual(["My_Packet::B is 4"]);
    expect(outputOf(call("printA", "My_Packet"))).toEqual(["My_Packet::A is 3"]);
  });

  it("virtual describe() through a base_txn handle runs the object's override", () => {
    const r = resolveCall(TXN_HIERARCHY, { handleType: "base_txn", objectType: "bad_crc_txn", method: "describe" });
    expect(r.kind === "ok" && r.binding).toBe("dynamic");
    expect(r.kind === "ok" && r.implementation).toBe("bad_crc_txn");
  });

  it("without virtual, the handle's declared class decides", () => {
    const table = withVirtualOrigin(TXN_HIERARCHY, "describe", null);
    const r = resolveCall(table, { handleType: "base_txn", objectType: "bad_crc_txn", method: "describe" });
    expect(r.kind === "ok" && r.binding).toBe("static");
    expect(r.kind === "ok" && r.implementation).toBe("base_txn");
    const mid = resolveCall(table, { handleType: "crc_txn", objectType: "bad_crc_txn", method: "describe" });
    expect(mid.kind === "ok" && mid.implementation).toBe("crc_txn");
  });

  it("§8.20: virtual first written in a subclass is virtual only from that class down", () => {
    const table = withVirtualOrigin(TXN_HIERARCHY, "describe", "crc_txn");
    const fromBase = resolveCall(table, { handleType: "base_txn", objectType: "bad_crc_txn", method: "describe" });
    expect(fromBase.kind === "ok" && fromBase.implementation).toBe("base_txn");
    const fromMid = resolveCall(table, { handleType: "crc_txn", objectType: "bad_crc_txn", method: "describe" });
    expect(fromMid.kind === "ok" && fromMid.implementation).toBe("bad_crc_txn");
    // The override in bad_crc_txn has no keyword but is still virtual.
    expect(dispatchClassLines(table).find((l) => l.key === "cls:bad_crc_txn:describe")?.text).toContain("still virtual");
    expect(dispatchClassLines(table).find((l) => l.key === "cls:crc_txn:describe")?.text).toMatch(/^ {2}virtual function/);
  });

  it("§8.15: super.print() chains run the base body first, then each override", () => {
    const r = resolveCall(TXN_HIERARCHY, { handleType: "base_txn", objectType: "bad_crc_txn", method: "print" });
    expect(r.kind === "ok" && r.executed).toEqual(["base_txn", "crc_txn", "bad_crc_txn"]);
    expect(r.kind === "ok" && r.output).toEqual(["addr=0x10", "crc=0x5a", "(crc deliberately wrong)"]);
  });

  it("§8.14: a method added by a subclass is not callable through a base handle, whatever the object", () => {
    const r = resolveCall(TXN_HIERARCHY, { handleType: "base_txn", objectType: "bad_crc_txn", method: "corrupt" });
    expect(r.kind).toBe("compile-error");
    expect(r.kind === "compile-error" && r.stage).toBe("call");
    expect(resolveCall(TXN_HIERARCHY, { handleType: "bad_crc_txn", objectType: "bad_crc_txn", method: "corrupt" }).kind).toBe("ok");
  });

  it("§8.16: a derived-class handle cannot refer to a base-class object", () => {
    const r = resolveCall(TXN_HIERARCHY, { handleType: "crc_txn", objectType: "base_txn", method: "describe" });
    expect(r.kind === "compile-error" && r.stage).toBe("assignment");
  });
});

describe("sv-object-model casting (§8.16, §6.24.2)", () => {
  const cast = (srcType: string, objectType: string, dstType: string, form: "function" | "task" | "assign") =>
    castOutcome(TXN_HIERARCHY, { srcType, objectType, dstType, form });

  it("upcast by plain assignment is always legal", () => {
    const r = cast("bad_crc_txn", "bad_crc_txn", "base_txn", "assign");
    expect(r.direction).toBe("up");
    expect(r.compiles && r.assigned).toBe(true);
  });

  it("downcast by plain assignment is a compile error even when the object would fit", () => {
    const r = cast("base_txn", "bad_crc_txn", "crc_txn", "assign");
    expect(r.direction).toBe("down");
    expect(r.compiles).toBe(false);
  });

  it("$cast succeeds when the object is the destination class or a subclass of it", () => {
    expect(cast("base_txn", "crc_txn", "crc_txn", "function")).toMatchObject({ assigned: true, returns: 1, runtimeError: false });
    expect(cast("base_txn", "bad_crc_txn", "crc_txn", "function")).toMatchObject({ assigned: true, returns: 1 });
  });

  it("§6.24.2: as a function, a failed $cast returns 0, assigns nothing and raises no error", () => {
    expect(cast("base_txn", "base_txn", "crc_txn", "function")).toMatchObject({ compiles: true, assigned: false, returns: 0, runtimeError: false });
    expect(cast("base_txn", "crc_txn", "bad_crc_txn", "function")).toMatchObject({ assigned: false, returns: 0 });
  });

  it("§6.24.2: as a task, a failed $cast is a run-time error and the destination is unchanged", () => {
    expect(cast("base_txn", "base_txn", "crc_txn", "task")).toMatchObject({ compiles: true, assigned: false, runtimeError: true });
  });

  it("an impossible setup (a derived variable holding a base object) is flagged", () => {
    expect(cast("crc_txn", "base_txn", "crc_txn", "function").setupLegal).toBe(false);
  });
});
