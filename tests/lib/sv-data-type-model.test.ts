import { describe, expect, it } from "vitest";

import { DATA_TYPE_ROWS, buildValueDrills, formatBits } from "@/lib/sv-data-type-model";

const row = (id: string) => DATA_TYPE_ROWS.find((r) => r.id === id)!;

describe("sv-data-type-model: Table 6-8 facts (IEEE 1800-2023 §6.11)", () => {
  it("2-state vs 4-state", () => {
    for (const id of ["logic", "reg", "integer", "time", "wire"]) expect(row(id).states, id).toBe(4);
    for (const id of ["bit", "byte", "shortint", "int", "longint"]) expect(row(id).states, id).toBe(2);
  });

  it("fixed widths: byte 8, shortint 16, int 32, longint 64, integer 32, time 64; vectors are user-sized", () => {
    expect(["byte", "shortint", "int", "longint", "integer", "time"].map((id) => row(id).width)).toEqual([8, 16, 32, 64, 32, 64]);
    for (const id of ["bit", "logic", "reg", "wire"]) expect(row(id).width, id).toBeNull();
  });

  it("signedness defaults (§6.11.3): byte/shortint/int/longint/integer signed; bit/logic/reg/time unsigned", () => {
    for (const id of ["byte", "shortint", "int", "longint", "integer"]) expect(row(id).signed, id).toBe(true);
    for (const id of ["bit", "logic", "reg", "time"]) expect(row(id).signed, id).toBe(false);
  });

  it("logic and reg are the same type (§6.11.2)", () => {
    const { id: _a, example: _ea, note: _na, ...logic } = row("logic");
    const { id: _b, example: _eb, note: _nb, ...reg } = row("reg");
    expect(reg).toEqual(logic);
  });
});

describe("sv-data-type-model: default values (Table 6-7, §6.6)", () => {
  it("4-state variables default to 'x, 2-state to '0, an undriven wire is 'z", () => {
    expect(row("logic").defaultText).toBe("'x");
    expect(row("integer").defaultText).toBe("'x");
    expect(row("time").defaultText).toBe("'x");
    expect(row("int").defaultText).toBe("'0");
    expect(row("bit").defaultText).toBe("'0");
    expect(row("wire").defaultText).toBe("'z");
    expect(row("real").defaultText).toBe("0.0");
    expect(row("string").defaultText).toMatch(/^""/);
  });

  it("only the wire row is a net", () => {
    expect(DATA_TYPE_ROWS.filter((r) => r.kind === "net").map((r) => r.id)).toEqual(["wire"]);
  });
});

describe("sv-data-type-model: drills are graded by the four-state model", () => {
  const drills = buildValueDrills();
  const drill = (id: string) => drills.find((d) => d.id === id)!;

  it("every drill has exactly one correct option and it equals the computed answer", () => {
    for (const d of drills) {
      const correct = d.options.filter((o) => o.correct);
      expect(correct, d.id).toHaveLength(1);
      expect(correct[0].label, d.id).toBe(d.answer);
    }
  });

  it("computes the defaults, signed display and 4→2-state conversion", () => {
    expect(drill("int-default").answer).toBe("32'h00000000");
    expect(drill("logic-default").answer).toBe("4'bxxxx");
    expect(drill("integer-default").answer).toBe("32'hxxxxxxxx");
    expect(drill("wire-undriven").answer).toBe("4'bzzzz");
    expect(drill("byte-signed").answer).toBe("-1");
    expect(drill("bit-unsigned").answer).toBe("255");
    expect(drill("four-to-two").answer).toBe("4'b1000");
  });

  it("formats literals compactly", () => {
    expect(formatBits(["1", "0", "x", "z"])).toBe("4'b10xz");
    expect(formatBits(Array(16).fill("z"))).toBe("16'hzzzz");
  });
});
