import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHANNEL_SCENARIOS,
  HANDSHAKE_BASICS,
  answerEdge,
  checkChannels,
  checkNextReadBeat,
  checkNextWriteBeat,
  checkNextWriteResponse,
  checkWaveDrom,
  explainEdgeChoice,
  extendId,
  isLegalOrdering,
  lessonFigure,
  replayOrdering,
  simulateChannels,
  splitExtendedId,
  type Bit,
  type ChannelScenario,
  type OrderedRequest,
} from "@/lib/axi-channel-model";

const bits = (s: string): Bit[] => s.split("").map((c) => (c === "1" ? 1 : 0));
const hs = (scenario: ChannelScenario) => simulateChannels(scenario).handshakes.map((h) => `${h.channel}${h.index}@${h.edge}`);

describe("axi-channel-model: VALID/READY handshake (IHI0022E A3.2.1)", () => {
  it("a transfer happens only at an edge where VALID and READY are both 1", () => {
    const t = simulateChannels({
      edges: 6,
      channels: { AW: { items: [{ key: "a", txn: "t", label: "0x10", availableAt: 1 }], ready: { kind: "pattern", bits: [1, 0, 0, 1, 0, 0] } } },
    });
    // READY at edge 0 is ignored (no VALID yet); the transfer happens at edge 3.
    expect(t.handshakes.map((h) => h.edge)).toEqual([3]);
    expect(t.signals.AW?.valid).toEqual([0, 1, 1, 1, 0, 0]);
    expect(t.violations).toEqual([]);
  });

  it("once VALID is asserted the source keeps it and the payload until the handshake", () => {
    const t = simulateChannels({
      edges: 8,
      channels: { W: { items: [{ key: "w", txn: "t", label: "D0", availableAt: 1, last: true }], ready: { kind: "pattern", bits: [0, 0, 0, 0, 0, 1, 0, 0] } } },
    });
    expect(t.signals.W?.valid).toEqual([0, 1, 1, 1, 1, 1, 0, 0]);
    expect(t.signals.W?.payload.slice(1, 6)).toEqual(["D0", "D0", "D0", "D0", "D0"]);
  });

  it("a destination that waits for VALID before READY is legal (after-valid policy)", () => {
    const t = simulateChannels({
      edges: 6,
      channels: { AR: { items: [{ key: "a", txn: "t", label: "0x20", availableAt: 1 }], ready: { kind: "after-valid", delay: 2 } } },
    });
    expect(t.handshakes.map((h) => h.edge)).toEqual([3]);
    expect(t.violations).toEqual([]);
  });

  it("every preset handshake scenario is legal except the dropped-VALID debug case, which fails exactly at the drop", () => {
    for (const s of [...HANDSHAKE_BASICS, ...CHANNEL_SCENARIOS]) {
      const v = simulateChannels(s.scenario).violations;
      if (s.id === "dropped-valid") expect(v.map((x) => [x.rule, x.edge])).toEqual([["valid-held", 3]]);
      else if (s.id === "axi3-slave") expect(v.map((x) => [x.rule, x.edge])).toEqual([["b-after-aw-and-wlast", 3]]);
      else expect(v, s.id).toEqual([]);
    }
  });

  it("the checker flags a VALID that falls without a handshake and a payload that changes while stalled", () => {
    const v = checkChannels(
      {
        AW: { valid: bits("0110"), ready: bits("0000") },
        W: { valid: bits("0111"), ready: bits("0001"), payload: [undefined, "D0", "D1", "D1"] },
      },
      4,
    );
    expect(v.map((x) => [x.channel, x.rule, x.edge])).toEqual([
      ["W", "payload-stable", 2],
      ["AW", "valid-held", 3],
    ]);
  });
});

describe("axi-channel-model: cross-channel dependencies (A3.3, A3.3.1)", () => {
  const wBeforeAw = CHANNEL_SCENARIOS.find((s) => s.id === "w-before-aw")!;

  it("write data may transfer before the write address (A3.3)", () => {
    expect(hs(wBeforeAw.scenario)).toEqual(["W0@1", "W1@2", "AW0@4", "B0@5"]);
    expect(simulateChannels(wBeforeAw.scenario).violations).toEqual([]);
  });

  it("AXI4: BVALID waits for the AW handshake even when WLAST is long done", () => {
    const t = simulateChannels(wBeforeAw.scenario);
    expect(answerEdge(t, { kind: "first-valid", channel: "B", itemIndex: 0 })).toBe(5);
    expect(t.events.filter((e) => e.channel === "B" && e.kind === "dependency-wait").map((e) => e.edge)).toEqual([0, 1, 2, 3, 4]);
  });

  it("AXI4: BVALID in the same edge as the AW handshake is still too early", () => {
    const v = checkChannels(
      {
        AW: { valid: bits("0001"), ready: bits("0001") },
        W: { valid: bits("0100"), ready: bits("0100"), last: bits("0100") },
        B: { valid: bits("0001"), ready: bits("0001") },
      },
      4,
    );
    expect(v.map((x) => [x.rule, x.edge])).toEqual([["b-after-aw-and-wlast", 3]]);
  });

  it("RVALID may only rise after the AR handshake", () => {
    const read = CHANNEL_SCENARIOS.find((s) => s.id === "read-burst")!;
    expect(hs(read.scenario)).toEqual(["AR0@2", "R0@3", "R1@4", "R2@5"]);
    const v = checkChannels({ AR: { valid: bits("0110"), ready: bits("0010") }, R: { valid: bits("0010"), ready: bits("0010") } }, 4);
    expect(v.map((x) => [x.rule, x.edge])).toEqual([["r-after-ar", 2]]);
  });

  it("backpressure on W does not delay R: the channels are independent", () => {
    const s = CHANNEL_SCENARIOS.find((x) => x.id === "independent")!;
    const t = simulateChannels(s.scenario);
    expect(answerEdge(t, { kind: "handshake", channel: "R", itemIndex: 1 })).toBe(3);
    expect(answerEdge(t, { kind: "handshake", channel: "W", itemIndex: 1 })).toBe(5);
  });
});

describe("axi-channel-model: prediction feedback is derived from the trace", () => {
  it("diagnoses READY-low, READY-without-VALID and too-late choices", () => {
    const s = HANDSHAKE_BASICS.find((x) => x.id === "ready-withdrawn")!;
    const t = simulateChannels(s.scenario);
    const q = { kind: "handshake", channel: "AW", itemIndex: 0 } as const;
    expect(explainEdgeChoice(t, q, 4).correct).toBe(true);
    expect(explainEdgeChoice(t, q, 1).feedback).toMatch(/AWVALID is 0/);
    expect(explainEdgeChoice(t, q, 2).feedback).toMatch(/AWREADY is 0/);
    expect(explainEdgeChoice(t, q, 5).feedback).toMatch(/already completed at edge 4/);
  });

  it("every preset's answer is one of its offered edges and exactly one offered edge is correct", () => {
    for (const s of [...HANDSHAKE_BASICS, ...CHANNEL_SCENARIOS]) {
      if (s.question.kind === "spot-violation") continue;
      const t = simulateChannels(s.scenario);
      const answer = answerEdge(t, s.question);
      expect(answer, s.id).not.toBeNull();
      const options = Array.from(new Set([answer as number, ...(s.distractors ?? [])]));
      expect(options.filter((e) => explainEdgeChoice(t, s.question as never, e).correct)).toEqual([answer]);
    }
  });
});

describe("axi-channel-model: ordering rules (A5.3, A5.4) and IDs (A5.3.5)", () => {
  const reads: OrderedRequest[] = [
    { key: "A", id: 0, beats: 2, label: "A" },
    { key: "B", id: 1, beats: 2, label: "B" },
    { key: "C", id: 0, beats: 1, label: "C" },
  ];

  it("same-ID read data returns in address order; different IDs may reorder and interleave (A5.3.1)", () => {
    expect(isLegalOrdering("read-data", reads, ["B", "A", "B", "A", "C"])).toBe(true);
    expect(checkNextReadBeat(reads, ["A"], "C").legal).toBe(false);
    expect(checkNextReadBeat(reads, ["A", "A"], "C").legal).toBe(true);
    expect(checkNextReadBeat(reads, ["A", "A"], "A").legal).toBe(false);
  });

  it("replay marks the illegal beat and the beat numbers / RLAST", () => {
    const r = replayOrdering("read-data", reads, ["A", "C", "A"]);
    expect(r.map((b) => b.check.legal)).toEqual([true, false, true]);
    expect(r.map((b) => b.last)).toEqual([false, true, true]);
  });

  it("same-AWID write responses complete in order; different AWIDs do not (A5.3)", () => {
    const writes: OrderedRequest[] = [
      { key: "W1", id: 2, beats: 1, label: "W1" },
      { key: "W2", id: 3, beats: 1, label: "W2" },
      { key: "W3", id: 2, beats: 1, label: "W3" },
    ];
    expect(checkNextWriteResponse(writes, [], "W2").legal).toBe(true);
    expect(checkNextWriteResponse(writes, [], "W3").legal).toBe(false);
    expect(isLegalOrdering("write-response", writes, ["W2", "W1", "W3"])).toBe(true);
  });

  it("AXI4 write data is never interleaved, even with different AWIDs (A5.4)", () => {
    const writes: OrderedRequest[] = [
      { key: "X", id: 0, beats: 2, label: "X" },
      { key: "Y", id: 1, beats: 1, label: "Y" },
    ];
    expect(checkNextWriteBeat(writes, ["X"], "Y").legal).toBe(false);
    expect(isLegalOrdering("write-data", writes, ["X", "X", "Y"])).toBe(true);
  });

  it("the interconnect appends master-port bits: master 0 ID 2'b10 -> 2, master 1 ID 2'b10 -> 6", () => {
    expect(extendId(0, 0b10, 2)).toBe(2);
    expect(extendId(1, 0b10, 2)).toBe(6);
    expect(splitExtendedId(6, 2)).toEqual({ masterPort: 1, id: 2 });
  });
});

describe("B-AXI-1 lesson figures are generated by the model and pass the checker", () => {
  const mdx = fs.readFileSync(
    path.join(process.cwd(), "content/curriculum/T3_Advanced/B-AXI-1_AXI_Channel_Architecture/index.mdx"),
    "utf8",
  );
  const specs = [...mdx.matchAll(/<ProtocolWaveform[\s\S]*?spec=\{([\s\S]*?)\}\s*\n\s*caption=/g)].map(
    // The MDX holds JS object literals, so evaluate them.
    (m) => new Function(`return (${m[1]});`)() as { signal: unknown[] },
  );

  it("the lesson has exactly the three model figures, in order", () => {
    expect(specs).toEqual([lessonFigure("handshake"), lessonFigure("write"), lessonFigure("read")]);
  });

  it("no figure violates A3.2.1 or A3.3.1 and the handshake row matches VALID && READY", () => {
    for (const spec of specs) {
      const { violations } = checkWaveDrom(spec);
      expect(violations).toEqual([]);
    }
    const first = checkWaveDrom(specs[0]);
    expect(first.handshakes.AW).toEqual([3]);
  });

  it("the checker rejects the old canonical figure (two transfers, VALID dropped without READY)", () => {
    const old = {
      signal: [
        { name: "AWVALID", wave: "01...0." },
        { name: "AWREADY", wave: "0.1.0.." },
      ],
    };
    const r = checkWaveDrom(old);
    expect(r.handshakes.AW).toEqual([2, 3]);
    expect(r.violations.map((v) => v.rule)).toEqual(["valid-held"]);
  });
});
