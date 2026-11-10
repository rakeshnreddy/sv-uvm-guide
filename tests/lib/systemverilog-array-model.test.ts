import { describe, expect, it } from "vitest";

import {
  applyAssocOp,
  applyDynamicOp,
  applyQueueOp,
  buildArrayInstances,
  compareAssocKeys,
  createAssocArray,
  createDynamicArray,
  createQueue,
  createQueueIdAllocator,
  declarationOf,
  defaultElementValue,
  encodeArrayCoordinates,
  MAX_VISIBLE_INSTANCES,
  predictContainerOp,
  queueOverflowChoices,
  runQueueComparison,
  validateDimensions,
  wrapToWidth,
  accessOp,
  accessSemanticsQuestions,
  declarationWithContents,
  deleteWalkSteps,
  queueIndexShifts,
  queueProgramChoices,
  queueSlice,
  queueSliceChoices,
  queueWriteChoices,
  runQueueProgram,
  type QueueOp,
} from "@/lib/systemverilog-array-model";

describe("SystemVerilog array visualization model", () => {
  it("caps fixed-array rendering work", () => {
    const result = buildArrayInstances(
      { packed: [1_000, 1_000, 1_000], unpacked: [1_000, 1_000] },
      MAX_VISIBLE_INSTANCES,
    );
    expect(result.instances).toHaveLength(MAX_VISIBLE_INSTANCES);
    expect(result.truncated).toBe(true);
    expect(result.logicalInstanceCount).toBeGreaterThan(MAX_VISIBLE_INSTANCES);
  });

  it("normalizes negative, NaN, empty, and extreme dimensions", () => {
    expect(validateDimensions({
      packed: [-4, Number.NaN, Number.POSITIVE_INFINITY, 12],
      unpacked: [],
    })).toEqual({ packed: [1, 1, 1], unpacked: [1] });
    expect(validateDimensions({ packed: [10_000], unpacked: [10_000] })).toEqual({
      packed: [64],
      unpacked: [64],
    });
  });

  it("allocates queue IDs independently per visualizer mount", () => {
    const firstMount = createQueueIdAllocator();
    const secondMount = createQueueIdAllocator();
    expect([firstMount.next(), firstMount.next(), secondMount.next()]).toEqual([1, 2, 1]);
  });

  it("§7.4.4: unpacked indices come first, then packed; the rightmost dimension varies fastest", () => {
    const dimensions = { packed: [3, 4], unpacked: [2, 5] };
    expect(encodeArrayCoordinates(dimensions, {
      unpacked: [1, 3],
      packed: [2, 1],
    })).toBe(105);
    expect(encodeArrayCoordinates(dimensions, {
      unpacked: [2, 0],
      packed: [0, 0],
    })).toBeNull();
  });

  it("keeps a requested logical bit in a capped instance preview", () => {
    const result = buildArrayInstances(
      { packed: [64, 64], unpacked: [64] },
      8,
      200_000,
    );
    expect(result.instances).toHaveLength(8);
    expect(result.instances.at(-1)?.logicalIndex).toBe(200_000);
  });
});

// ---------------------------------------------------------------------------
// Container semantics. Each test names the IEEE 1800-2023 clause it pins.
// ---------------------------------------------------------------------------

describe("element defaults (Table 7-1 / Table 6-7)", () => {
  it("4-state types default to x and 2-state types to 0", () => {
    expect(defaultElementValue("logic8")).toBe("X");
    expect(defaultElementValue("int")).toBe(0);
    expect(defaultElementValue("byte")).toBe(0);
  });

  it("wraps values to the declared width and signedness", () => {
    expect(wrapToWidth(372, 8, false)).toBe(116);
    expect(wrapToWidth(200, 8, true)).toBe(-56);
    expect(wrapToWidth(5_508_518_400, 32, true)).toBe(1_213_551_104);
  });
});

describe("dynamic arrays (§7.5)", () => {
  const buf = createDynamicArray("buffer", "logic8", [0, 10, 20, 30]);

  it("§7.5.1: arr = new[N] is destructive and default-initializes (x for logic)", () => {
    const r = applyDynamicOp(buf, { op: "new", size: 8 });
    expect(r.code).toBe("buffer = new[8];");
    expect(r.after.values).toEqual(Array(8).fill("X"));
  });

  it("§7.5.1: arr = new[N] on a 2-state int array fills with 0", () => {
    const r = applyDynamicOp(createDynamicArray("a", "int", [5, 6]), { op: "new", size: 3 });
    expect(r.after.values).toEqual([0, 0, 0]);
  });

  it("§7.5.1: new[N](arr) copies and pads with the type default", () => {
    const r = applyDynamicOp(buf, { op: "new-copy", size: 6 });
    expect(r.code).toBe("buffer = new[6](buffer);");
    expect(r.after.values).toEqual([0, 10, 20, 30, "X", "X"]);
    expect(r.changedIndices).toEqual([4, 5]);
  });

  it("§7.5.1: new[N](arr) with a smaller N truncates (LRM example dest1 = new[2](src))", () => {
    const src = createDynamicArray("dest1", "int", [2, 3, 4]);
    expect(applyDynamicOp(src, { op: "new-copy", size: 2 }).after.values).toEqual([2, 3]);
    expect(applyDynamicOp(src, { op: "new-copy", size: 4 }).after.values).toEqual([2, 3, 4, 0]);
  });

  it("§7.5.1: a negative size is an error and changes nothing", () => {
    const r = applyDynamicOp(buf, { op: "new", size: -1 });
    expect(r.diagnostics[0].level).toBe("error");
    expect(r.after).toBe(buf);
  });

  it("§7.5: push_back is not a dynamic-array method (compile error, no change)", () => {
    const r = applyDynamicOp(buf, { op: "push_back", value: 1 });
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0].level).toBe("error");
    expect(r.after.values).toEqual(buf.values);
  });

  it("§7.5.2/§7.5.3: size() reports elements (no capacity) and delete() empties", () => {
    expect(applyDynamicOp(buf, { op: "size" }).returned?.value).toBe(4);
    expect(applyDynamicOp(buf, { op: "delete" }).after.values).toEqual([]);
  });

  it("§7.4.5: an out-of-range read returns the default and never grows the array", () => {
    const r = applyDynamicOp(buf, { op: "read", index: 9 });
    expect(r.returned?.value).toBe("X");
    expect(r.after.values).toHaveLength(4);
    expect(r.diagnostics[0].level).toBe("may-warn");
  });

  it("§7.4.5: an out-of-range write is a no-op", () => {
    const r = applyDynamicOp(buf, { op: "write", index: 4, value: 7 });
    expect(r.after.values).toEqual(buf.values);
    expect(r.diagnostics[0].level).toBe("may-warn");
  });
});

describe("queues (§7.10)", () => {
  it("§7.10: q[$] is unbounded and q[$:N] declares a bound of N+1 elements", () => {
    expect(declarationOf(createQueue("q", "int", null))).toBe("int q[$];");
    expect(declarationOf(createQueue("q", "int", 3))).toBe("int q[$:3];");
    const q = createQueue("q", "int", null, [1, 2, 3, 4]);
    expect(applyQueueOp(q, { op: "push_back", value: 5 }).after.values).toEqual([1, 2, 3, 4, 5]);
  });

  it("§7.10.5: push_back on a full bounded queue discards the NEW element with a warning", () => {
    const full = createQueue("q", "int", 3, [1, 2, 3, 4]);
    const r = applyQueueOp(full, { op: "push_back", value: 5 });
    expect(r.after.values).toEqual([1, 2, 3, 4]);
    expect(r.discarded).toEqual([5]);
    expect(r.diagnostics).toEqual([expect.objectContaining({ level: "warning", clause: "§7.10.5" })]);
  });

  it("§7.10.5: push_front on a full bounded queue discards the OLD LAST element", () => {
    const full = createQueue("q", "int", 3, [1, 2, 3, 4]);
    const r = applyQueueOp(full, { op: "push_front", value: 9 });
    expect(r.after.values).toEqual([9, 1, 2, 3]);
    expect(r.discarded).toEqual([4]);
  });

  it("§7.10.5: a middle insert on a full bounded queue also discards the old last element", () => {
    const full = createQueue("q", "int", 3, [1, 2, 3, 4]);
    expect(applyQueueOp(full, { op: "insert", index: 1, value: 7 }).after.values).toEqual([1, 7, 2, 3]);
  });

  it("§7.10.2.2: insert with index > size() has no effect (not clamped) and may warn", () => {
    const q = createQueue("q", "int", null, [1, 2]);
    const r = applyQueueOp(q, { op: "insert", index: 5, value: 9 });
    expect(r.after.values).toEqual([1, 2]);
    expect(r.diagnostics[0].level).toBe("may-warn");
    expect(applyQueueOp(q, { op: "insert", index: 2, value: 9 }).after.values).toEqual([1, 2, 9]);
  });

  it("§7.10.2.3: delete(index) out of range has no effect", () => {
    const q = createQueue("q", "int", null, [1, 2]);
    expect(applyQueueOp(q, { op: "delete-index", index: 2 }).after.values).toEqual([1, 2]);
    expect(applyQueueOp(q, { op: "delete-index", index: 0 }).after.values).toEqual([2]);
  });

  it("§7.10.2.4/§7.10.2.5: popping an empty queue returns the default, changes nothing and may warn", () => {
    const empty = createQueue("q", "logic8", null, []);
    const r = applyQueueOp(empty, { op: "pop_front" });
    expect(r.returned?.value).toBe("X");
    expect(r.after.values).toEqual([]);
    expect(r.diagnostics[0].level).toBe("may-warn");
    expect(applyQueueOp(createQueue("q", "int", null), { op: "pop_back" }).returned?.value).toBe(0);
  });

  it("§7.10.2.4: pop_front returns the head", () => {
    const r = applyQueueOp(createQueue("q", "int", null, [7, 8]), { op: "pop_front" });
    expect(r.returned?.value).toBe(7);
    expect(r.after.values).toEqual([8]);
  });

  it("compares q[$] with q[$:N] and finds the first divergent step", () => {
    const cmp = runQueueComparison([1, 2, 3], 3, [
      { op: "push_back", value: 4 },
      { op: "push_front", value: 9 },
    ]);
    expect(cmp.firstDivergence).toBe(1);
    expect(cmp.unboundedFinal).toEqual([9, 1, 2, 3, 4]);
    expect(cmp.boundedFinal).toEqual([9, 1, 2, 3]);
    expect(cmp.warnings).toBe(1);
  });

  it("prediction for a full bounded queue has exactly one correct option, matching §7.10.5", () => {
    const full = createQueue("q", "int", 3, [1, 2, 3, 4]);
    const choices = queueOverflowChoices(full, [{ op: "push_front", value: 9 }]);
    const correct = choices.filter((c) => c.correct);
    expect(correct).toHaveLength(1);
    expect(correct[0].label).toBe("'{9, 1, 2, 3}");
    expect(choices.map((c) => c.label)).toContain("'{1, 2, 3, 4}"); // the "blocked" misconception
  });
});

describe("associative arrays (§7.8, §7.9)", () => {
  const scores = createAssocArray("scores", "int", "string", [["beta", 3], ["alpha", 7], ["Gamma", 1]]);

  it("§7.8.2: string indices are ordered lexicographically by character code (uppercase first)", () => {
    expect(scores.entries.map((e) => e.key)).toEqual(["Gamma", "alpha", "beta"]);
    expect(compareAssocKeys("Z", "a")).toBeLessThan(0);
  });

  it("§7.8.4: int indices are ordered numerically (signed)", () => {
    const ids = createAssocArray("ids", "int", "int", [[10, 1], [-5, 2], [3, 3]]);
    expect(ids.entries.map((e) => e.key)).toEqual([-5, 3, 10]);
  });

  it("§7.9.4/§7.9.6: first() and next() walk index order, not write order", () => {
    const first = applyAssocOp(scores, { op: "first" });
    expect(first.after.iter).toBe("Gamma");
    const next = applyAssocOp(first.after, { op: "next" });
    expect(next.after.iter).toBe("alpha");
  });

  it("§7.9.6: next() past the last key returns 0 and leaves the index unchanged", () => {
    const atEnd = { ...scores, iter: "beta" };
    const r = applyAssocOp(atEnd, { op: "next" });
    expect(r.returned?.value).toBe(0);
    expect(r.after.iter).toBe("beta");
  });

  it("§7.8.6/§7.8.7: reading a missing key returns the default with a warning and does not allocate", () => {
    const r = applyAssocOp(scores, { op: "read", key: "eve" });
    expect(r.returned?.value).toBe(0);
    expect(r.diagnostics).toEqual([expect.objectContaining({ level: "warning", clause: "§7.8.6" })]);
    expect(r.after.entries).toHaveLength(3);
  });

  it("§7.9.3: exists() returns 1/0 without a warning", () => {
    expect(applyAssocOp(scores, { op: "exists", key: "beta" }).returned?.value).toBe(1);
    const missing = applyAssocOp(scores, { op: "exists", key: "eve" });
    expect(missing.returned?.value).toBe(0);
    expect(missing.diagnostics).toHaveLength(0);
  });

  it("§7.9.2: delete(key) of a missing key issues no warning", () => {
    const r = applyAssocOp(scores, { op: "delete-key", key: "eve" });
    expect(r.diagnostics).toHaveLength(0);
    expect(applyAssocOp(scores, { op: "delete-key", key: "beta" }).after.entries).toHaveLength(2);
  });

  it("§12.7.3: foreach visits keys in index order", () => {
    expect(applyAssocOp(scores, { op: "foreach" }).visited).toEqual(["Gamma", "alpha", "beta"]);
  });
});

describe("container predictions", () => {
  it("asks what new[N] leaves behind and marks the default-filled answer correct", () => {
    const p = predictContainerOp(createDynamicArray("buffer", "logic8", [0, 10, 20, 30]), { op: "new", size: 8 });
    const correct = p?.options.find((o) => o.correct);
    expect(correct?.label).toBe("'{x, x, x, x}");
    expect(p?.options.find((o) => o.label === "'{0, 10, 20, 30}")?.correct).toBe(false);
  });

  it("asks about the first key and offers insertion order and dictionary order as distractors", () => {
    const s = createAssocArray("scores", "int", "string", [["beta", 3], ["alpha", 7], ["Gamma", 1]]);
    const p = predictContainerOp(s, { op: "first" });
    expect(p?.options.find((o) => o.correct)?.label).toBe('"Gamma"');
    expect(p?.options.map((o) => o.label)).toEqual(expect.arrayContaining(['"beta"', '"alpha"']));
  });

  it("does not gate routine operations", () => {
    expect(predictContainerOp(createQueue("q", "int", null, [1]), { op: "push_back", value: 2 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Access semantics, slices, indexed writes, delete walks and op sequences.
// ---------------------------------------------------------------------------

const correctLabel = (opts: { label: string; correct: boolean }[]) => opts.filter((o) => o.correct).map((o) => o.label);

describe("associative-array access semantics (§7.8.6, §7.8.7, §7.9.11)", () => {
  const plain = () => createAssocArray("a", "int", "int", [[3, 7]]);
  const withDefault = () => createAssocArray("a", "int", "int", [[3, 7]], 1);

  it("§7.9.11: a declared default appears in the literal", () => {
    expect(declarationWithContents(withDefault())).toBe("int a[int] = '{3:7, default:1};");
    expect(declarationWithContents(createAssocArray("a", "int", "int", [], 1))).toBe("int a[int] = '{default:1};");
    expect(declarationWithContents(plain())).toBe("int a[int] = '{3:7};");
  });

  it("§7.8.6/§7.9.11: with a declared default a missing read returns it, without a warning, and allocates nothing", () => {
    const r = applyAssocOp(withDefault(), { op: "read", key: 1 });
    expect(r.returned?.value).toBe(1);
    expect(r.diagnostics).toHaveLength(0);
    expect(r.after.entries).toHaveLength(1);
  });

  it("§7.8.7: the standard's example: int a[int] = '{default:1}; a[1]++ allocates a[1] at 1, which then becomes 2", () => {
    const a = createAssocArray("a", "int", "int", [], 1);
    const r = applyAssocOp(a, { op: "rmw", key: 1, form: "increment" });
    expect(r.code).toBe("a[1]++;");
    expect(r.after.entries).toEqual([{ key: 1, value: 2 }]);
    expect(r.diagnostics).toHaveLength(0);
    expect(r.why).toMatch(/allocates it first with its user-specified default 1.*writes 2/);
    expect(r.clause).toBe("§7.8.7");
  });

  it("§7.8.7: aa[k] += 2 without a default allocates at the Table 7-1 value 0 and writes 2", () => {
    const r = applyAssocOp(plain(), { op: "rmw", key: 1, form: "add-assign", amount: 2 });
    expect(r.code).toBe("a[1] += 2;");
    expect(r.after.entries.map((e) => [e.key, e.value])).toEqual([[1, 2], [3, 7]]);
  });

  it("§7.8.7, §11.4.3: on logic [7:0] a read-modify-write of a missing key allocates 'x, and x + 1 stays x", () => {
    const r = applyAssocOp(createAssocArray("a", "logic8", "int"), { op: "rmw", key: 1, form: "increment" });
    expect(r.after.entries).toEqual([{ key: 1, value: "X" }]);
    expect(r.clause).toBe("§7.8.7, §11.4.3");
  });

  it("wraps an existing logic [7:0] entry at 255 + 1 to 0 (the element width)", () => {
    const r = applyAssocOp(createAssocArray("a", "logic8", "int", [[1, 255]]), { op: "rmw", key: 1, form: "increment" });
    expect(r.after.entries).toEqual([{ key: 1, value: 0 }]);
  });

  it("§7.8.7: a ref actual allocates the entry, with a caveat about the initial value", () => {
    const r = applyAssocOp(withDefault(), { op: "ref-arg", key: 1 });
    expect(r.code).toBe("v = peek(a[1]);");
    expect(r.returned?.value).toBe(1);
    expect(r.after.entries).toHaveLength(2);
    expect(r.caveat).toMatch(/says only that the entry is allocated/);
  });

  it("§7.8.6/§7.8.4: an x index read warns and returns Table 7-1; an x index write is ignored with a warning", () => {
    const read = applyAssocOp(createAssocArray("a", "logic8", "int"), { op: "read", key: 0, xIndex: true });
    expect(read.code).toBe("v = a[kx];");
    expect(read.returned?.value).toBe("X");
    expect(read.diagnostics[0]).toMatchObject({ level: "warning", clause: "§7.8.6" });
    const write = applyAssocOp(plain(), { op: "write", key: 0, value: 5, xIndex: true });
    expect(write.after.entries).toHaveLength(1);
    expect(write.diagnostics[0]).toMatchObject({ level: "warning", clause: "§7.8.6" });
  });

  it("§7.8.6: an x index read with a declared default carries a caveat instead of a stronger claim", () => {
    expect(applyAssocOp(withDefault(), { op: "read", key: 0, xIndex: true }).caveat).toMatch(/does not say whether/);
  });

  it("§7.9.11: a default changes no method: exists() is still 0 and num() counts written keys", () => {
    const s = withDefault();
    expect(applyAssocOp(s, { op: "exists", key: 1 }).returned?.value).toBe(0);
    expect(applyAssocOp(s, { op: "num" }).returned?.value).toBe(1);
  });

  it("§7.8.6/§7.8.7: the three predictions for a plain missing read: v = 0, a required warning, num() unchanged", () => {
    const q = accessSemanticsQuestions(plain(), accessOp("read", 1));
    expect(correctLabel(q.find((x) => x.aspect === "value")!.options)).toEqual(["v = 0"]);
    expect(correctLabel(q.find((x) => x.aspect === "warning")!.options)).toEqual(["A warning is required"]);
    expect(correctLabel(q.find((x) => x.aspect === "num")!.options)).toEqual(["num() = 1"]);
  });

  it("§7.8.7: predictions for a[1]++ with '{default:1}: 2 afterwards, no warning, num() + 1; 'default ignored' is a distractor", () => {
    const q = accessSemanticsQuestions(withDefault(), accessOp("increment", 1));
    const value = q.find((x) => x.aspect === "value")!;
    expect(correctLabel(value.options)).toEqual(["a[1] = 2 afterwards"]);
    expect(value.options.find((o) => o.id === "default-ignored")?.label).toBe("a[1] = 1 afterwards");
    expect(correctLabel(q.find((x) => x.aspect === "warning")!.options)).toEqual(["No warning"]);
    expect(correctLabel(q.find((x) => x.aspect === "num")!.options)).toEqual(["num() = 2"]);
  });

  it("§7.9.2: delete of a missing key has no value question and no warning", () => {
    const q = accessSemanticsQuestions(plain(), accessOp("delete-key", 1));
    expect(q.map((x) => x.aspect)).toEqual(["warning", "num"]);
    expect(correctLabel(q[0].options)).toEqual(["No warning"]);
  });

  it("every access question has exactly one correct option", () => {
    for (const s of [plain(), withDefault(), createAssocArray("a", "logic8", "int", [[3, 7]])]) {
      for (const st of ["read", "write", "increment", "add-assign", "ref-arg", "exists", "delete-key"] as const) {
        for (const key of [1, 3]) {
          for (const q of accessSemanticsQuestions(s, accessOp(st, key))) {
            expect(q.options.filter((o) => o.correct)).toHaveLength(1);
            expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length);
          }
        }
      }
    }
  });

  it("every value question offers at least two computed wrong options besides the error option", () => {
    const states = [plain(), withDefault(), createAssocArray("a", "logic8", "int", [[3, 7]]), createAssocArray("a", "logic8", "int", [[3, 7]], 1)];
    for (const s of states) {
      for (const st of ["read", "write", "increment", "add-assign", "ref-arg", "exists"] as const) {
        for (const key of [1, 3]) {
          const v = accessSemanticsQuestions(s, accessOp(st, key)).find((q) => q.aspect === "value")!;
          expect(v.options.filter((o) => o.id !== "fatal" && !o.correct).length, `${st} k=${key}`).toBeGreaterThanOrEqual(1);
          expect(v.options.length, `${st} k=${key}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("§7.8.7: a[1] = 5 on a missing key offers 'No entry is written' as a computed wrong option", () => {
    const v = accessSemanticsQuestions(plain(), accessOp("write", 1)).find((q) => q.aspect === "value")!;
    expect(correctLabel(v.options)).toEqual(["a[1] = 5 afterwards"]);
    const wrong = v.options.find((o) => o.label === "No entry is written")!;
    expect(wrong.correct).toBe(false);
    expect(wrong.feedback).toMatch(/target of an assignment is allocated \(§7\.8\.7\)/);
  });

  it("§7.8.6/§7.9.11: reading an existing key offers the Table 7-1 value and the declared default as wrong options", () => {
    const v = accessSemanticsQuestions(withDefault(), accessOp("read", 3)).find((q) => q.aspect === "value")!;
    expect(correctLabel(v.options)).toEqual(["v = 7"]);
    expect(v.options.find((o) => o.label === "v = 0")?.feedback).toMatch(/Table 7-1 value is only what a nonexistent entry reads as/);
    expect(v.options.find((o) => o.label === "v = 1")?.feedback).toMatch(/§7\.9\.11/);
  });

  it("the 'no warning' answer for ++, += and a ref actual on a missing key says it is inferred from §7.8.7", () => {
    for (const st of ["increment", "add-assign", "ref-arg"] as const) {
      const w = accessSemanticsQuestions(plain(), accessOp(st, 1)).find((q) => q.aspect === "warning")!;
      expect(correctLabel(w.options)).toEqual(["No warning"]);
      expect(w.options[0].feedback).toMatch(/does not state "no warning" for this case directly; the lab infers it from §7\.8\.7/);
    }
  });

  it("predictContainerOp gates rmw and ref-arg on the allocation question", () => {
    const p = predictContainerOp(plain(), { op: "rmw", key: 1, form: "increment" });
    expect(correctLabel(p!.options)).toEqual(["num() = 2"]);
    expect(predictContainerOp(plain(), { op: "ref-arg", key: 1 })).not.toBeNull();
  });
});

describe("queue slices and indexed writes (§7.10.1)", () => {
  const q = createQueue("q", "int", null, [10, 20, 30, 40]);
  const slice = (a: number | "X", b: number | "X") => queueSlice(q.values, a, b).values;

  it("§7.10.1: Q[a:b] yields b-a+1 items", () => {
    expect(slice(1, 2)).toEqual([20, 30]);
    expect(slice(0, 0)).toEqual([10]);
  });
  it("§7.10.1: a > b yields the empty queue", () => {
    expect(slice(2, 1)).toEqual([]);
  });
  it("§7.10.1: a < 0 is treated as 0 and b > $ as $", () => {
    expect(slice(-1, 1)).toEqual([10, 20]);
    expect(slice(2, 9)).toEqual([30, 40]);
    expect(queueSlice(q.values, -1, 1).why).toMatch(/a = -1 < 0 is treated as 0/);
  });
  it("§7.10.1: Q[n:n] with n outside 0..$ yields {}, and clamping past both ends can leave a > b", () => {
    expect(slice(7, 7)).toEqual([]);
    expect(slice(-3, -1)).toEqual([]);
    expect(slice(5, 9)).toEqual([]);
    expect(queueSlice([], 0, 0).values).toEqual([]);
  });
  it("§7.10.1: an x bound yields the empty queue", () => {
    expect(slice("X", 2)).toEqual([]);
    expect(applyQueueOp(q, { op: "slice", from: "X", to: 2 }).code).toBe("s = q[kx:2];");
  });
  it("§7.10.1: slice choices have one correct answer and diagnose exclusive ends and reversal", () => {
    const c = queueSliceChoices(q.values, 1, 2);
    expect(correctLabel(c)).toEqual(["'{20, 30}"]);
    expect(c.find((o) => o.id === "exclusive")?.label).toBe("'{20}");
    expect(queueSliceChoices(q.values, 2, 1).find((o) => o.id === "reverse")?.label).toBe("'{30, 20}");
    expect(predictContainerOp(q, { op: "slice", from: 2, to: 9 })?.options.filter((o) => o.correct)).toHaveLength(1);
  });
  it("§7.10.1: q[i] inside 0..$ updates in place", () => {
    const r = applyQueueOp(q, { op: "write", index: 1, value: 5 });
    expect(r.after.values).toEqual([10, 5, 30, 40]);
    expect(r.diagnostics).toHaveLength(0);
  });
  it("§7.10.1: writing q[$+1] is legal and appends", () => {
    const r = applyQueueOp(q, { op: "write", index: 4, value: 50 });
    expect(r.after.values).toEqual([10, 20, 30, 40, 50]);
    expect(r.clause).toBe("§7.10.1");
  });
  it("§7.10.1: a write outside 0..$+1 or with an x index is ignored with a required warning", () => {
    for (const index of [7, -1, "X"] as const) {
      const r = applyQueueOp(q, { op: "write", index, value: 1 });
      expect(r.after.values).toEqual([10, 20, 30, 40]);
      expect(r.diagnostics[0]).toMatchObject({ level: "warning", clause: "§7.10.1" });
    }
  });
  it("§7.10.1/§7.10.5: q[$+1] on a full bounded queue discards the new item with a warning", () => {
    const r = applyQueueOp(createQueue("q", "int", 3, [1, 2, 3, 4]), { op: "write", index: 4, value: 9 });
    expect(r.after.values).toEqual([1, 2, 3, 4]);
    expect(r.clause).toBe("§7.10.5");
  });
  it("§7.10.1/§7.10.5: on a full q[$:3], q[$+1] = 9 is predicted as discarded with a warning, and size() stays 4", () => {
    const full = createQueue("q", "int", 3, [1, 2, 3, 4]);
    const op = { op: "write", index: 4, value: 9 } as const;
    const c = queueWriteChoices(full, op);
    expect(correctLabel(c)).toEqual(["Discarded with a warning; size() stays 4"]);
    expect(c.find((o) => o.id === "append")?.feedback).toMatch(/beyond the bound \$:3, so it is discarded with a warning and size\(\) stays 4 \(§7\.10\.5\)/);
    const p = predictContainerOp(full, op)!;
    expect(p.question).toMatch(/int q\[\$:3\]/);
    expect(correctLabel(p.options)).toEqual(["Discarded with a warning; size() stays 4"]);
    // The answer agrees with what applyQueueOp does.
    expect(applyQueueOp(full, op).after.values).toHaveLength(4);
  });
  it("§7.10.5: on a bounded queue with room, q[$+1] still appends and the discard option is a computed wrong answer", () => {
    const roomy = createQueue("q", "int", 3, [1, 2]);
    const c = queueWriteChoices(roomy, { op: "write", index: 2, value: 9 });
    expect(correctLabel(c)).toEqual(["Appends; size() becomes 3"]);
    expect(c.find((o) => o.id === "discarded")?.feedback).toMatch(/fits under the bound \$:3/);
    expect(queueWriteChoices(q, { op: "write", index: 4, value: 50 }).some((o) => o.id === "discarded")).toBe(false);
  });
  it("§7.10.5: the discard explanation reads as one sentence for q[$+1], push_back, push_front and insert", () => {
    const full = createQueue("q", "int", 3, [1, 2, 3, 4]);
    expect(applyQueueOp(full, { op: "write", index: 4, value: 9 }).why).toBe(
      "Writing to q[$+1] (index 4) is legal, but as if the queue were unbounded the new element would sit at index 4, beyond the bound $:3, so it is discarded and a warning is issued; size() stays 4.",
    );
    expect(applyQueueOp(full, { op: "push_back", value: 9 }).why).toMatch(/^push_back\(9\) is legal, but as if the queue were unbounded/);
    expect(applyQueueOp(full, { op: "push_front", value: 9 }).why).toMatch(/^push_front\(9\) is legal, but it shifts the existing elements up; the old last element '\{4\}/);
    expect(applyQueueOp(full, { op: "insert", index: 1, value: 9 }).why).toMatch(/^insert\(1, 9\) is legal, but it shifts/);
    expect(applyQueueOp(q, { op: "write", index: 4, value: 50 }).why).toMatch(/^Writing to q\[\$\+1\] \(index 4\) is legal and appends; size\(\) is now 5/);
  });
  it("§7.10.1: slicing an empty queue says no index is in range, never 0..-1", () => {
    expect(queueSlice([], 0, 0).why).toMatch(/the queue is empty, so no n is in range/);
    expect(queueSlice([], 0, 2).why).toMatch(/The queue is empty, so no index is in range/);
    for (const [a, b] of [[0, 0], [0, 2], [-1, 3]] as const) expect(queueSlice([], a, b).why).not.toMatch(/-1\)|\(-1|0\.\.-1/);
  });
  it("§7.10.1: an x upper bound still gets a distinct wrong answer when reading x as 0 would also give {}", () => {
    const c = queueSliceChoices(q.values, 1, "X");
    expect(correctLabel(c)).toEqual(["'{} (empty)"]);
    expect(c.find((o) => o.id === "x-as-last")?.label).toBe("'{20, 30, 40}");
    expect(c.length).toBeGreaterThanOrEqual(3);
  });
  it("§7.10.1: write choices mark update / append / ignored from the model", () => {
    expect(queueWriteChoices(q, { op: "write", index: 4, value: 50 }).find((o) => o.correct)?.id).toBe("append");
    expect(queueWriteChoices(q, { op: "write", index: 7, value: 1 }).find((o) => o.correct)?.id).toBe("ignored");
    expect(queueWriteChoices(q, { op: "write", index: 0, value: 1 }).find((o) => o.correct)?.id).toBe("update");
  });
});

describe("deleting while walking an associative array (§7.9.6, §12.7.3, §7.12.1)", () => {
  it("§7.9.6: the first()/next() walk deletes 4 and 9, and next() finds 9 after 4 was deleted", () => {
    const steps = deleteWalkSteps("first-next");
    const last = steps[steps.length - 1];
    expect(last.after.entries.map((e) => e.key)).toEqual([1]);
    const afterDelete4 = steps.find((s) => s.line === "next" && s.before.iter === 4)!;
    expect(afterDelete4.before.entries.map((e) => e.key)).toEqual([1, 9]);
    expect(afterDelete4.found).toBe(1);
    expect(afterDelete4.after.iter).toBe(9);
    expect(correctLabel(afterDelete4.prediction!.options)).toEqual(["returns 1; id = 9"]);
  });
  it("§7.9.6: the final next() returns 0 and leaves id at the deleted key 9", () => {
    const steps = deleteWalkSteps("first-next");
    const last = steps[steps.length - 1];
    expect(last.found).toBe(0);
    expect(last.after.iter).toBe(9);
    expect(correctLabel(last.prediction!.options)).toEqual(["returns 0; id = 9"]);
  });
  it("§12.7.3: the foreach strategy stops at an undefined outcome and never invents a next step", () => {
    const steps = deleteWalkSteps("foreach");
    const last = steps[steps.length - 1];
    expect(last.undefinedOutcome).toBe(true);
    expect(last.after.entries.map((e) => e.key)).toEqual([1, 9]);
    expect(steps.filter((s) => s.undefinedOutcome)).toHaveLength(1);
    expect(correctLabel(last.prediction!.options)).toEqual(["Undefined: the standard promises no outcome"]);
  });
  it("§7.12.1: find_index then delete reads first, deletes second, and notes the unspecified locator order", () => {
    const steps = deleteWalkSteps("find-index");
    expect(steps[0].emptyIds).toEqual([4, 9]);
    expect(steps[0].after.entries).toHaveLength(3);
    expect(steps[0].why).toMatch(/unspecified order/);
    expect(steps[steps.length - 1].after.entries.map((e) => e.key)).toEqual([1]);
  });
});

describe("a mixed queue program (§7.10.2)", () => {
  const program: QueueOp[] = [
    { op: "push_front", value: 0 },
    { op: "insert", index: 2, value: 9 },
    { op: "pop_back" },
    { op: "push_back", value: 7 },
  ];

  it("§7.10.2: '{1, 2, 3} with push_front(0), insert(2, 9), pop_back(), push_back(7) ends '{0, 1, 9, 2, 7} and pops 3", () => {
    const run = runQueueProgram([1, 2, 3], program);
    expect(run.final).toEqual([0, 1, 9, 2, 7]);
    expect(run.popped).toEqual([3]);
  });
  it("§7.10.2.6/§7.10.2.2: push_front shifts every item up; insert(2, ..) shifts items from index 2", () => {
    const run = runQueueProgram([1, 2, 3], program);
    expect(run.steps[0].shifts).toEqual([{ value: 1, from: 0, to: 1 }, { value: 2, from: 1, to: 2 }, { value: 3, from: 2, to: 3 }]);
    expect(run.steps[1].shifts).toEqual([{ value: 2, from: 2, to: 3 }, { value: 3, from: 3, to: 4 }]);
    expect(run.steps[2].shifts).toEqual([]);
    expect(queueIndexShifts(createQueue("q", "int", null, [1, 2]), { op: "pop_front" })).toEqual([{ value: 2, from: 1, to: 0 }]);
  });
  it("§7.10.2.2/§7.10.2.5: choices diagnose insert-after, pop_back-as-front and pop-as-peek with computed labels", () => {
    const c = queueProgramChoices([1, 2, 3], program);
    expect(correctLabel(c)).toEqual(["q = '{0, 1, 9, 2, 7}; popped v = 3"]);
    expect(c.find((o) => o.id === "insert-after")?.label).toBe("q = '{0, 1, 2, 9, 7}; popped v = 3");
    expect(c.find((o) => o.id === "pop-back-front")?.label).toBe("q = '{1, 9, 2, 3, 7}; popped v = 0");
    expect(c.find((o) => o.id === "pop-peek")?.label).toBe("q = '{0, 1, 9, 2, 3, 7}; popped v = 3");
  });
});
