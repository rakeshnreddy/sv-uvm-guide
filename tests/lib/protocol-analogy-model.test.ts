import { describe, expect, it } from "vitest";

import {
  CHANNEL_MAP,
  WRITE_ORDERS,
  checkHandshakeOrder,
  completedChannels,
  readSteps,
  writeSteps,
  type AnalogyStep,
} from "@/lib/protocol-analogy-model";

const step = (...completes: AnalogyStep["completes"]): AnalogyStep => ({
  id: completes.join("+"),
  completes,
  analogy: "",
  real: "",
  breaksDown: "",
  source: "",
});

describe("protocol analogy model", () => {
  it("every write order is legal AXI4, including W before AW (IHI0022E §A3.3)", () => {
    for (const { value } of WRITE_ORDERS) {
      expect(checkHandshakeOrder(writeSteps(value)), value).toEqual([]);
      expect(completedChannels(writeSteps(value), writeSteps(value).length).sort()).toEqual(["AW", "B", "W"]);
    }
    expect(writeSteps("box-first").map((s) => s.completes)).toEqual([["W"], ["AW"], ["B"]]);
  });

  it("a receipt before the box is flagged: B needs the AW and WLAST handshakes in AXI4 (§A3.3.1)", () => {
    expect(checkHandshakeOrder([step("AW"), step("B"), step("W")])).toEqual([
      expect.objectContaining({ channel: "B", rule: expect.stringMatching(/WLAST/) }),
    ]);
    expect(checkHandshakeOrder([step("W"), step("B"), step("AW")])).toHaveLength(1);
  });

  it("read data before the order form is flagged (§A3.3.1)", () => {
    expect(checkHandshakeOrder(readSteps())).toEqual([]);
    expect(checkHandshakeOrder([step("R"), step("AR")])).toEqual([expect.objectContaining({ channel: "R" })]);
  });

  it("the read walkthrough has exactly two steps, AR then R (e2e relies on 'Step 1 of 2')", () => {
    expect(readSteps().map((s) => s.completes)).toEqual([["AR"], ["R"]]);
  });

  it("every step names its real handshake, where the analogy breaks, and a source", () => {
    const all = [...WRITE_ORDERS.flatMap(({ value }) => writeSteps(value)), ...readSteps()];
    for (const s of all) {
      expect(s.real).toMatch(/VALID && \w*READY/);
      expect(s.breaksDown.length).toBeGreaterThan(40);
      expect(s.source).toMatch(/IHI0022E §A/);
    }
  });

  it("the receipt step states the AXI4 B dependency and the label step says W carries no ID in AXI4", () => {
    const [, , b] = writeSteps("label-first");
    expect(b.real).toMatch(/only after the AW handshake and the W handshake carrying WLAST/);
    expect(writeSteps("label-first")[0].breaksDown).toMatch(/WID was removed/);
  });

  it("maps each channel to its direction: only B and R flow from slave to master", () => {
    expect(Object.values(CHANNEL_MAP).filter((m) => m.direction === "slave → master").map((m) => m.channel)).toEqual(["B", "R"]);
  });
});
