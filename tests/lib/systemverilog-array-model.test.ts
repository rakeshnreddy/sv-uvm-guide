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
