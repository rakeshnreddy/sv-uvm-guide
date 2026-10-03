/**
 * Configurable AXI write-channel wait-for policies, built on the dependency
 * rules in axi-dependency-model.ts (which this file does not change).
 *
 * Source: Arm IHI0022E §A3.3.1 "Dependencies between channel handshake
 * signals", including "Write transaction dependencies" and the "AXI4 write
 * response dependency":
 * - a source must not wait for READY before asserting VALID;
 * - a destination may wait for VALID before asserting READY;
 * - the slave may wait for AWVALID or WVALID, or both, before AWREADY or WREADY;
 * - the slave must not wait for BREADY before asserting BVALID;
 * - the master may wait for BVALID before asserting BREADY;
 * - (AXI4) the slave must wait for AWVALID, AWREADY, WVALID and WREADY (with
 *   WLAST) before asserting BVALID.
 *
 * An edge "X → Y" means "X waits for Y". A deadlock is a directed cycle.
 * Pure functions, no React.
 */

import {
  analyzeDependencies,
  channelDependencyScenario,
  delayedReadyScenario,
  type DependencyEdge,
  type DependencyScenario,
} from "./axi-dependency-model";

export type PolicyId =
  | "m-wvalid-waits-awready"
  | "m-awvalid-waits-wready"
  | "m-awvalid-waits-awready"
  | "m-bready-waits-bvalid"
  | "s-awready-waits-wvalid"
  | "s-wready-waits-awvalid"
  | "s-awready-waits-awvalid"
  | "s-bvalid-waits-bready";

export interface WaitPolicy {
  id: PolicyId;
  side: "master" | "slave";
  /** Short form shown on the control, e.g. "WVALID waits for AWREADY". */
  label: string;
  edge: DependencyEdge;
}

const VALID_RULE = "AXI-A3-VALID-INDEPENDENCE";

export const WRITE_POLICIES: WaitPolicy[] = [
  {
    id: "m-wvalid-waits-awready",
    side: "master",
    label: "WVALID waits for AWREADY",
    // Same edge object as the lesson's classic scenario.
    edge: channelDependencyScenario.dependencies[0],
  },
  {
    id: "m-awvalid-waits-wready",
    side: "master",
    label: "AWVALID waits for WREADY",
    edge: {
      from: "master.AWVALID",
      to: "slave.WREADY",
      legality: "illegal",
      rule: VALID_RULE,
      explanation: "The master must not wait for WREADY before asserting AWVALID (IHI0022E §A3.3.1).",
    },
  },
  {
    id: "m-awvalid-waits-awready",
    side: "master",
    label: "AWVALID waits for AWREADY",
    edge: {
      from: "master.AWVALID",
      to: "slave.AWREADY",
      legality: "illegal",
      rule: VALID_RULE,
      explanation: "A source is not permitted to wait until READY is asserted before asserting VALID (IHI0022E §A3.2.1).",
    },
  },
  {
    id: "m-bready-waits-bvalid",
    side: "master",
    label: "BREADY waits for BVALID",
    edge: {
      from: "master.BREADY",
      to: "slave.BVALID",
      legality: "legal-destination-policy",
      explanation: "The master can wait for BVALID before asserting BREADY (IHI0022E §A3.3.1).",
    },
  },
  {
    id: "s-awready-waits-wvalid",
    side: "slave",
    label: "AWREADY waits for WVALID",
    edge: channelDependencyScenario.dependencies[1],
  },
  {
    id: "s-wready-waits-awvalid",
    side: "slave",
    label: "WREADY waits for AWVALID",
    edge: {
      from: "slave.WREADY",
      to: "master.AWVALID",
      legality: "legal-destination-policy",
      explanation: "The slave can wait for AWVALID or WVALID, or both, before asserting WREADY (IHI0022E §A3.3.1).",
    },
  },
  {
    id: "s-awready-waits-awvalid",
    side: "slave",
    label: "AWREADY waits for AWVALID",
    // Same edge object as the lesson's delayed-READY scenario.
    edge: delayedReadyScenario.dependencies[0],
  },
  {
    id: "s-bvalid-waits-bready",
    side: "slave",
    label: "BVALID waits for BREADY",
    edge: {
      from: "slave.BVALID",
      to: "master.BREADY",
      legality: "illegal",
      rule: VALID_RULE,
      explanation: "The slave must not wait for the master to assert BREADY before asserting BVALID (IHI0022E §A3.3.1).",
    },
  },
];

/** Waits the specification requires of every AXI4 slave; always present. */
export const REQUIRED_WRITE_EDGES: DependencyEdge[] = [
  {
    from: "slave.BVALID",
    to: "master.AWVALID",
    legality: "legal",
    explanation: "AXI4: the slave must see the AW handshake before asserting BVALID (IHI0022E §A3.3.1, AXI4 write response dependency).",
  },
  {
    from: "slave.BVALID",
    to: "master.WVALID",
    legality: "legal",
    explanation: "The slave must see the W handshake carrying WLAST before asserting BVALID (IHI0022E §A3.3.1).",
  },
];

export function getPolicy(id: PolicyId): WaitPolicy {
  const found = WRITE_POLICIES.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown policy ${id}`);
  return found;
}

/** Canonical key for a policy set, independent of selection order. */
export function policyKey(policies: readonly PolicyId[]): string {
  return WRITE_POLICIES.filter((p) => policies.includes(p.id))
    .map((p) => p.id)
    .join("|");
}

export function buildWriteScenario(policies: readonly PolicyId[]): DependencyScenario {
  const chosen = WRITE_POLICIES.filter((p) => policies.includes(p.id));
  return {
    id: `custom:${policyKey(policies)}`,
    name: "Custom write configuration",
    description: chosen.length ? chosen.map((p) => `${p.side} ${p.label}`).join("; ") : "No optional waits selected.",
    dependencies: [...chosen.map((p) => p.edge), ...REQUIRED_WRITE_EDGES],
  };
}

/** True when `to` can reach `from` by following edges. */
function pathBetween(edges: readonly DependencyEdge[], start: string, goal: string): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to]);
  const queue: string[][] = [[start]];
  const seen = new Set([start]);
  while (queue.length) {
    const path = queue.shift()!;
    const node = path[path.length - 1];
    if (node === goal) return path;
    for (const nextNode of adjacency.get(node) ?? []) {
      if (seen.has(nextNode)) continue;
      seen.add(nextNode);
      queue.push([...path, nextNode]);
    }
  }
  return null;
}

/** Rotate a closed cycle [a, b, ..., a] so it starts at its smallest node. */
function normalizeCycle(cycle: string[]): string {
  const open = cycle.slice(0, -1);
  const start = open.indexOf([...open].sort()[0]);
  return [...open.slice(start), ...open.slice(0, start)].join(">");
}

/**
 * Every distinct wait-for cycle that passes through at least one edge.
 * Each cycle is a closed node list: [a, b, ..., a].
 */
export function listCycles(edges: readonly DependencyEdge[]): string[][] {
  const found = new Map<string, string[]>();
  for (const edge of edges) {
    const back = pathBetween(edges, edge.to, edge.from);
    if (!back) continue;
    const cycle = [edge.from, ...back];
    const key = normalizeCycle(cycle);
    if (!found.has(key)) found.set(key, cycle);
  }
  return [...found.values()];
}

export type DeadlockVerdict = "deadlock" | "latent-violation" | "safe";

export interface DeadlockAnalysis {
  verdict: DeadlockVerdict;
  edges: DependencyEdge[];
  cycles: string[][];
  illegalEdges: DependencyEdge[];
  /** For a latent violation: a legal partner policy that would close a cycle. */
  partners: { illegal: DependencyEdge; partner: WaitPolicy }[];
  why: string;
}

const signal = (node: string) => node.replace(/^(master|slave)\./, "");
const owner = (node: string) => node.split(".")[0];

export function describeCycle(cycle: string[]): string {
  const steps = cycle.slice(0, -1).map((node, i) => `${owner(node)} ${signal(node)} waits for ${signal(cycle[i + 1])}`);
  return `${steps.join(", ")}.`;
}

/** Legal policies that would close a cycle with this illegal edge. */
export function legalPartnersFor(illegal: DependencyEdge): WaitPolicy[] {
  return WRITE_POLICIES.filter(
    (p) => p.edge.legality !== "illegal" && listCycles([illegal, p.edge, ...REQUIRED_WRITE_EDGES]).length > 0,
  );
}

export function analyzeWriteConfig(policies: readonly PolicyId[]): DeadlockAnalysis {
  const scenario = buildWriteScenario(policies);
  const base = analyzeDependencies(scenario);
  const cycles = listCycles(scenario.dependencies);
  if (base.hasCycle !== cycles.length > 0) throw new Error("cycle detectors disagree");

  const illegalEdges = base.illegalEdges;
  const partners = illegalEdges.flatMap((illegal) => legalPartnersFor(illegal).slice(0, 1).map((partner) => ({ illegal, partner })));
  const brokenRules = illegalEdges.map((e) => e.explanation).join(" ");

  let verdict: DeadlockVerdict;
  let why: string;
  if (cycles.length > 0) {
    verdict = "deadlock";
    why = `Follow the waits: ${cycles.map(describeCycle).join(" Also: ")} Every signal in the loop waits for the next, so none can be asserted first and no handshake ever completes. The broken rule: ${brokenRules}`;
  } else if (illegalEdges.length > 0) {
    verdict = "latent-violation";
    const partnerText = partners.map(({ partner }) => `a legal ${partner.side} whose ${partner.label}`).join(", or ");
    const waits = illegalEdges.map((e) => `${owner(e.from)} ${signal(e.from)} waits for ${signal(e.to)}`).join("; ");
    why = `No wait-for loop with this partner, so the write completes. But ${waits}, which IHI0022E §A3.3.1 forbids: ${brokenRules} Paired with ${partnerText}, the loop closes and the write deadlocks.`;
  } else {
    verdict = "safe";
    why =
      "No loop, and every wait is one the specification allows: destinations wait for VALID, sources never wait for READY. A slow READY only adds latency (IHI0022E §A3.3.1).";
  }
  return { verdict, edges: scenario.dependencies, cycles, illegalEdges, partners, why };
}

export const DEADLOCK_VERDICT_LABELS: Record<DeadlockVerdict, { glyph: string; title: string }> = {
  deadlock: { glyph: "✕", title: "Deadlock" },
  "latent-violation": { glyph: "⚠", title: "Completes here, but breaks an AXI rule" },
  safe: { glyph: "✓", title: "Completes, and every wait is legal" },
};

export const PREDICTION_CHOICES: { id: DeadlockVerdict; label: string }[] = [
  { id: "deadlock", label: "It deadlocks: the two sides wait for each other forever." },
  { id: "latent-violation", label: "It completes here, but one side breaks an AXI rule, so another legal partner could deadlock it." },
  { id: "safe", label: "It completes, and every wait it uses is legal." },
];

/** Feedback for choosing `choice` when the model's verdict is `analysis.verdict`. */
export function predictionFeedback(analysis: DeadlockAnalysis, choice: DeadlockVerdict): string {
  if (choice === analysis.verdict) return analysis.why;
  const illegal = analysis.illegalEdges[0];
  const illegalText = illegal ? `${owner(illegal.from)} ${signal(illegal.from)} waits for ${signal(illegal.to)}` : "";
  const cycleText = analysis.cycles[0] ? describeCycle(analysis.cycles[0]) : "";
  const key = `${choice}/${analysis.verdict}` as const;
  switch (key) {
    case "deadlock/latent-violation":
      return `There is a rule violation (${illegalText}), but nothing waits back on it, so the chain ends. A deadlock needs a closed loop of waits.`;
    case "deadlock/safe":
      return "Waiting alone does not deadlock. Every wait here is a READY waiting for its VALID (or BREADY for BVALID), and the source side never waits, so the chain always ends.";
    case "latent-violation/deadlock":
      return `Worse than latent: with this partner the loop is already closed. ${cycleText}`;
    case "latent-violation/safe":
      return "No source waits for a READY here, so no rule is broken. A destination waiting for VALID is explicitly allowed (IHI0022E §A3.3.1).";
    case "safe/deadlock":
      return `Follow the waits: ${cycleText} The last waits for the first, so nothing can be asserted first.`;
    case "safe/latent-violation":
      return `It does complete, but ${illegalText}, and IHI0022E §A3.3.1 forbids a source waiting for READY. It works only because this partner happens not to wait back.`;
    default:
      return analysis.why;
  }
}

export const DEADLOCK_PRESETS: { id: string; name: string; policies: PolicyId[] }[] = [
  { id: "classic", name: "Classic W/AW deadlock", policies: ["m-wvalid-waits-awready", "s-awready-waits-wvalid"] },
  { id: "delayed-ready", name: "Legal delayed READY", policies: ["s-awready-waits-awvalid"] },
  { id: "latent", name: "Latent violation", policies: ["m-wvalid-waits-awready", "s-awready-waits-awvalid"] },
  { id: "b-channel", name: "B-channel deadlock", policies: ["m-bready-waits-bvalid", "s-bvalid-waits-bready"] },
];
