import { describe, expect, it } from "vitest";

import { analyzeReachability, edgeBetween, encodeState, encodingWidth, resetWalk, stepWalk } from "@/lib/fsm-designer-model";

const states = [
  { id: "a", name: "IDLE" },
  { id: "b", name: "RUN" },
  { id: "c", name: "DONE" },
  { id: "d", name: "ORPHAN" },
];

describe("fsm-designer-model", () => {
  it("one-hot needs one flip-flop per state; binary and gray need ceil(log2 N)", () => {
    expect(encodingWidth(5, "onehot")).toBe(5);
    expect(encodingWidth(5, "binary")).toBe(3);
    expect(encodingWidth(4, "gray")).toBe(2);
    expect(encodingWidth(1, "binary")).toBe(1);
  });

  it("one-hot sets bit i, written MSB first (state 0 = 0001)", () => {
    expect([0, 1, 2, 3].map((i) => encodeState(i, 4, "onehot"))).toEqual(["0001", "0010", "0100", "1000"]);
  });

  it("gray codes differ by exactly one bit between neighbours", () => {
    const codes = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => encodeState(i, 8, "gray"));
    expect(codes).toEqual(["000", "001", "011", "010", "110", "111", "101", "100"]);
    for (let i = 1; i < codes.length; i += 1) {
      const diff = [...codes[i]].filter((ch, k) => ch !== codes[i - 1][k]).length;
      expect(diff).toBe(1);
    }
  });

  it("reachability starts at the reset state; transitions out of unreachable states are dead", () => {
    const r = analyzeReachability(states, [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "d", target: "a" },
    ]);
    expect(r.unreachable).toEqual(["ORPHAN"]);
    expect(r.dead).toEqual([{ source: "d", target: "a" }]);
  });

  it("coverage counts the reset state immediately and each state on arrival", () => {
    const transitions = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    let w = resetWalk(states);
    expect(w.visitedStates).toEqual(["a"]);
    w = stepWalk(w, transitions, 1);
    expect(w.current).toBe("b");
    expect(w.visitedStates).toEqual(["a", "b"]);
    expect(w.visitedTransitions).toEqual([0]);
  });

  it("the random walk is reproducible for a seed", () => {
    const transitions = [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
      { source: "b", target: "a" },
      { source: "c", target: "a" },
    ];
    const run = (seed: number) => {
      let w = resetWalk(states);
      const path: (string | null)[] = [];
      for (let i = 0; i < 12; i += 1) {
        w = stepWalk(w, transitions, seed);
        path.push(w.current);
      }
      return path;
    };
    expect(run(3)).toEqual(run(3));
  });

  it("edges are trimmed to the box borders so arrowheads are not hidden under the target", () => {
    const e = edgeBetween({ x: 0, y: 0 }, { x: 200, y: 0 }, { w: 96, h: 64 });
    expect(e).toEqual({ x1: 96, y1: 32, x2: 200, y2: 32 });
  });
});
