import { describe, expect, it } from "vitest";

import {
  createMethodArray,
  evaluateMethod,
  predictMethod,
  withChoicesFor,
} from "@/lib/sv-array-methods-model";

const intQ = createMethodArray("queue", "int"); // '{42, 15, 8, 15, 23, 4, 8, 99}
const bitQ = createMethodArray("queue", "bit8"); // '{200, 15, 8, 15, 23, 4, 8, 99}
const byteQ = createMethodArray("queue", "byte"); // '{100, 15, 8, 15, 23, 4, 8, 99}
const assoc = createMethodArray("assoc", "int");

describe("locator methods return queues (§7.12.1)", () => {
  it("min() and max() return a one-element queue, not a scalar", () => {
    const min = evaluateMethod(intQ, "min", "none");
    expect(min.kind).toBe("queue");
    expect(min.queue).toEqual([4]);
    expect(min.statement).toBe("int r[$] = data.min();");
    expect(evaluateMethod(intQ, "max", "none").queue).toEqual([99]);
  });

  it("unique() keeps one copy of each value, including duplicated ones", () => {
    expect(evaluateMethod(intQ, "unique", "none").queue).toEqual([42, 15, 8, 23, 4, 99]);
  });

  it("find() returns elements and find_index() returns int indices", () => {
    expect(evaluateMethod(intQ, "find", "gt20").queue).toEqual([42, 23, 99]);
    expect(evaluateMethod(intQ, "find_index", "gt20").queue).toEqual([0, 4, 7]);
    expect(evaluateMethod(intQ, "find_first", "eq15").queue).toEqual([15]);
    expect(evaluateMethod(intQ, "find_last_index", "eq15").queue).toEqual([3]);
  });

  it("find_index() on an associative array returns a queue of the index type", () => {
    const r = evaluateMethod(assoc, "find_index", "gt20");
    expect(r.queue).toEqual(["a", "e", "h"]);
    expect(r.returnType).toBe("queue of string");
  });

  it("find*() without a with clause is a compile error (with is mandatory)", () => {
    const r = evaluateMethod(intQ, "find", "none");
    expect(r.kind).toBe("error");
    expect(r.error?.clause).toBe("§7.12.1");
  });

  it("an empty match is an empty queue, not an error", () => {
    expect(evaluateMethod(createMethodArray("queue", "int", [1, 2]), "find", "gt20").queue).toEqual([]);
  });
});

describe("ordering methods (§7.12.2)", () => {
  it("sort() reorders in place and returns void", () => {
    const r = evaluateMethod(intQ, "sort", "none");
    expect(r.kind).toBe("void");
    expect(r.after).toEqual([4, 8, 8, 15, 15, 23, 42, 99]);
    expect(r.why).toMatch(/Array sorted in ascending order/);
  });

  it("sort() with (item % 10) sorts by the expression, not the value", () => {
    expect(evaluateMethod(intQ, "sort", "mod10").after).toEqual([42, 23, 4, 15, 15, 8, 8, 99]);
  });

  it("ordering methods are not allowed on associative arrays", () => {
    for (const m of ["sort", "rsort", "reverse", "shuffle"] as const) {
      const r = evaluateMethod(assoc, m, "none");
      expect(r.kind).toBe("error");
      expect(r.error?.clause).toBe("§7.12.2");
    }
  });

  it("reverse() and shuffle() with a with clause are compile errors", () => {
    expect(evaluateMethod(intQ, "reverse", "mod10").kind).toBe("error");
    expect(evaluateMethod(intQ, "shuffle", "mod10").kind).toBe("error");
  });

  it("shuffle() is deterministic for a given seed and keeps the same multiset", () => {
    const a = evaluateMethod(intQ, "shuffle", "none", 7).after;
    expect(evaluateMethod(intQ, "shuffle", "none", 7).after).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual([4, 8, 8, 15, 15, 23, 42, 99]);
  });
});

describe("reduction width (§7.12.3)", () => {
  it("sum() of bit [7:0] elements is 8 bits wide and wraps (372 → 116)", () => {
    const r = evaluateMethod(bitQ, "sum", "none");
    expect(r.scalar).toMatchObject({ value: 116, exact: "372", width: 8, overflow: true });
  });

  it("sum() of byte elements wraps as signed 8-bit (272 → 16)", () => {
    expect(evaluateMethod(byteQ, "sum", "none").scalar?.value).toBe(16);
  });

  it("sum() with (int'(item)) takes the with-expression type and does not wrap", () => {
    const r = evaluateMethod(bitQ, "sum", "int_cast");
    expect(r.scalar).toMatchObject({ value: 372, width: 32, overflow: false });
  });

  it("sum() with (item > 20) is 1 bit wide: counting 3 matches gives 1", () => {
    expect(evaluateMethod(intQ, "sum", "gt20").scalar?.value).toBe(1);
    expect(evaluateMethod(intQ, "sum", "gt20_count").scalar?.value).toBe(3);
  });

  it("product() of int elements wraps at 32 bits", () => {
    const r = evaluateMethod(intQ, "product", "none");
    expect(r.scalar?.exact).toBe("5508518400");
    expect(r.scalar?.value).toBe(1213551104);
  });

  it("xor() is the bitwise XOR of every element", () => {
    expect(evaluateMethod(createMethodArray("queue", "int", [1, 2, 3, 4]), "xor", "none").scalar?.value).toBe(4);
  });
});

describe("method predictions", () => {
  it("offers the scalar misconception for max() and marks the queue correct", () => {
    const p = predictMethod(intQ, "max", "none");
    expect(p.options.find((o) => o.correct)?.label).toBe("'{99}");
    expect(p.options.some((o) => o.label === "The scalar 99" && !o.correct)).toBe(true);
  });

  it("offers the exact (unwrapped) sum as a wrong answer when sum() overflows", () => {
    const p = predictMethod(bitQ, "sum", "none");
    expect(p.options.find((o) => o.correct)?.label).toBe("116");
    expect(p.options.find((o) => o.label === "372")?.correct).toBe(false);
  });

  it("every method/with combination yields at least two options and exactly one correct", () => {
    const methods = ["find", "find_index", "find_first", "min", "max", "unique", "unique_index", "sort", "rsort", "reverse", "shuffle", "sum", "product", "and", "or", "xor"] as const;
    for (const arr of [intQ, bitQ, assoc]) {
      for (const m of methods) {
        for (const w of withChoicesFor(m)) {
          const p = predictMethod(arr, m, w);
          expect(p.options.length, `${arr.kind} ${m} ${w}`).toBeGreaterThanOrEqual(2);
          expect(p.options.filter((o) => o.correct), `${arr.kind} ${m} ${w}`).toHaveLength(1);
        }
      }
    }
  });
});
