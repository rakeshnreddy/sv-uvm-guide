/**
 * Pure helpers behind the practice State Machine Designer: state encodings,
 * reachability from the reset state, and a seeded random walk used to
 * measure state/transition coverage. No React, deterministic.
 */

export type FsmEncoding = "binary" | "gray" | "onehot";

export interface FsmState {
  id: string;
  name: string;
}

export interface FsmTransition {
  source: string;
  target: string;
  /** Input bit that enables this edge (`in == 0` or `in == 1`). Omitted: the edge is unconditional. */
  input?: 0 | 1;
}

/** Flip-flops needed: one per state for one-hot, ceil(log2 N) (minimum 1) otherwise. */
export function encodingWidth(stateCount: number, encoding: FsmEncoding): number {
  if (encoding === "onehot") return Math.max(1, stateCount);
  return Math.max(1, Math.ceil(Math.log2(Math.max(1, stateCount))));
}

/**
 * Code for the state at `index`, written MSB first (as in `4'b0010`).
 * One-hot sets bit `index`, so state 0 is ...0001. Gray is the reflected
 * binary code `i ^ (i >> 1)`, in which consecutive codes differ by one bit.
 */
export function encodeState(index: number, stateCount: number, encoding: FsmEncoding): string {
  const width = encodingWidth(stateCount, encoding);
  if (encoding === "onehot") return `${"0".repeat(Math.max(0, width - 1 - index))}1${"0".repeat(index)}`;
  const value = encoding === "gray" ? index ^ (index >> 1) : index;
  return value.toString(2).padStart(width, "0");
}

export const ENCODING_HINTS: Record<FsmEncoding, string> = {
  binary: "Binary uses the fewest flip-flops (ceil(log2 N)); next-state and output decode is wider.",
  gray:
    "Gray codes differ by one bit between neighbours in code order. That only cuts switching when the FSM mostly steps through states in that order (counters, sequencers); it does not make arbitrary next-state logic glitch-free.",
  onehot: "One-hot uses one flip-flop per state; decode is a single bit per state, which is usually small and fast in FPGAs.",
};

export interface Reachability {
  reachable: Set<string>;
  unreachable: string[];
  /** Transitions whose source can never be reached, so they can never fire. */
  dead: FsmTransition[];
}

/** Depth-first reachability from the reset state (the first state). */
export function analyzeReachability(states: FsmState[], transitions: FsmTransition[]): Reachability {
  const reachable = new Set<string>();
  const start = states[0]?.id;
  const stack = start ? [start] : [];
  while (stack.length) {
    const id = stack.pop() as string;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const t of transitions) if (t.source === id) stack.push(t.target);
  }
  return {
    reachable,
    unreachable: states.filter((s) => !reachable.has(s.id)).map((s) => s.name),
    dead: transitions.filter((t) => !reachable.has(t.source)),
  };
}

export function createLcg(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x >>> 8;
  };
}

export interface WalkState {
  current: string | null;
  visitedStates: string[];
  /** Indexes into the transition list. */
  visitedTransitions: number[];
  step: number;
  /** Input bit applied on the last clock, when the current state had conditioned edges. */
  lastInput?: 0 | 1;
}

/** Integer hash with good bit mixing (lowbias32), so consecutive steps give independent-looking bits. */
function mix32(n: number): number {
  let h = n >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** The 1-bit input applied on clock `step` for a given seed; the same seed replays the same input stream. */
export function inputBit(seed: number, step: number): 0 | 1 {
  return (mix32(Math.imul(seed, 7919) + step + 1) & 1) as 0 | 1;
}

/**
 * Index of the edge an input-driven FSM takes from `current` when the input is `input`:
 * the edge labelled with that input value, else an unconditional edge, else null (the FSM holds).
 */
export function edgeForInput(transitions: FsmTransition[], current: string, input: 0 | 1): number | null {
  const matching = transitions.findIndex((t) => t.source === current && t.input === input);
  if (matching >= 0) return matching;
  const unconditional = transitions.findIndex((t) => t.source === current && t.input === undefined);
  return unconditional >= 0 ? unconditional : null;
}

/** Reset puts the FSM in the reset state, which already counts as visited. */
export function resetWalk(states: FsmState[]): WalkState {
  const current = states[0]?.id ?? null;
  return { current, visitedStates: current ? [current] : [], visitedTransitions: [], step: 0 };
}

/**
 * One clock: take one outgoing transition of the current state.
 * - If any outgoing edge is labelled with an input value, a seeded 1-bit input
 *   is applied and the matching edge is taken (`edgeForInput`); with no
 *   match the FSM holds its state.
 * - Otherwise the edges are unconditional, and the choice among several is
 *   made by a generator seeded with (seed, step).
 * Either way, the same seed replays the same walk.
 */
export function stepWalk(walk: WalkState, transitions: FsmTransition[], seed: number): WalkState {
  if (!walk.current) return walk;
  const options = transitions.map((t, i) => ({ ...t, i })).filter((t) => t.source === walk.current);
  if (options.length === 0) return { ...walk, step: walk.step + 1, lastInput: undefined };
  let choice: FsmTransition & { i: number };
  let lastInput: 0 | 1 | undefined;
  if (options.some((t) => t.input !== undefined)) {
    lastInput = inputBit(seed, walk.step);
    const index = edgeForInput(transitions, walk.current, lastInput);
    if (index === null) return { ...walk, step: walk.step + 1, lastInput };
    choice = { ...transitions[index], i: index };
  } else {
    const rand = createLcg(seed * 7919 + walk.step + 1);
    choice = options[rand() % options.length];
  }
  return {
    current: choice.target,
    visitedStates: walk.visitedStates.includes(choice.target) ? walk.visitedStates : [...walk.visitedStates, choice.target],
    visitedTransitions: walk.visitedTransitions.includes(choice.i) ? walk.visitedTransitions : [...walk.visitedTransitions, choice.i],
    step: walk.step + 1,
    lastInput,
  };
}

/** Straight segment between two boxes, trimmed to their borders so an arrowhead stays visible. */
export function edgeBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: { w: number; h: number },
): { x1: number; y1: number; x2: number; y2: number } {
  const ax = a.x + box.w / 2;
  const ay = a.y + box.h / 2;
  const bx = b.x + box.w / 2;
  const by = b.y + box.h / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const trim = (len: number) => {
    if (dx === 0 && dy === 0) return 0;
    const sx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx);
    const sy = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy);
    return Math.min(sx, sy) * len;
  };
  const f = trim(1);
  return { x1: ax + dx * f, y1: ay + dy * f, x2: bx - dx * f, y2: by - dy * f };
}
