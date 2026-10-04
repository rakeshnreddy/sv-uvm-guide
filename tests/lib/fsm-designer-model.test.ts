import { describe, expect, it } from "vitest";

import { stateMachineData } from "@/components/animations/state-machine-data";
import {
  analyzeReachability,
  edgeBetween,
  edgeForInput,
  encodeState,
  encodingWidth,
  resetWalk,
  stepWalk,
} from "@/lib/fsm-designer-model";

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

describe("Sequence Detector preset (Moore, overlapping 1-0-1)", () => {
  const detector = stateMachineData.find((p) => p.name === "Sequence Detector")!;
  const idOf = (name: string) => detector.states.find((st) => st.name === name)!.id;
  const nameOf = (id: string) => detector.states.find((st) => st.id === id)!.name;

  /** Feed a bit string from reset; return the state name after each bit. */
  const run = (bits: string) => {
    let current = detector.states[0].id;
    return [...bits].map((b) => {
      const index = edgeForInput(detector.transitions, current, b === "1" ? 1 : 0);
      expect(index).not.toBeNull();
      current = detector.transitions[index as number].target;
      return nameOf(current);
    });
  };

  it("every state has exactly one edge for in=0 and one for in=1 (complete and deterministic)", () => {
    for (const st of detector.states) {
      const out = detector.transitions.filter((t) => t.source === st.id);
      expect(out.filter((t) => t.input === 0)).toHaveLength(1);
      expect(out.filter((t) => t.input === 1)).toHaveLength(1);
      expect(out.every((t) => t.input !== undefined)).toBe(true);
    }
  });

  it("reaches FOUND exactly when the last three inputs were 1, 0, 1", () => {
    expect(run("101")).toEqual(["S1", "S10", "FOUND"]);
    expect(run("100")).toEqual(["S1", "S10", "IDLE"]);
    expect(run("1101")).toEqual(["S1", "S1", "S10", "FOUND"]);
  });

  it("detects overlapping matches: 10101 reports FOUND after bits 3 and 5", () => {
    const states = run("10101");
    expect(states.map((n, i) => (n === "FOUND" ? i + 1 : null)).filter(Boolean)).toEqual([3, 5]);
  });

  it("FOUND followed by 1 restarts from S1, not IDLE", () => {
    expect(run("1011")).toEqual(["S1", "S10", "FOUND", "S1"]);
    expect(idOf("S1")).toBe("q1");
  });

  it("the random walk applies a seeded input and always takes the edge labelled with it", () => {
    const go = (seed: number) => {
      let w = resetWalk(detector.states);
      const seen: string[] = [];
      for (let i = 0; i < 40; i += 1) {
        const from = w.current as string;
        w = stepWalk(w, detector.transitions, seed);
        const taken = detector.transitions[edgeForInput(detector.transitions, from, w.lastInput as 0 | 1) as number];
        expect(w.lastInput === 0 || w.lastInput === 1).toBe(true);
        expect(w.current).toBe(taken.target);
        seen.push(`${w.lastInput}`);
      }
      return seen.join("");
    };
    expect(go(5)).toEqual(go(5));
    const bits = go(5);
    expect(bits).toMatch(/0/);
    expect(bits).toMatch(/1/);
  });
});
