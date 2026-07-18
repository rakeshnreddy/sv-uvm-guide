export type DependencyLegality = "illegal" | "legal-destination-policy" | "legal";

export interface DependencyEdge {
  from: string;
  to: string;
  legality: DependencyLegality;
  rule?: string;
  explanation: string;
}

export interface DependencyScenario {
  id: string;
  name: string;
  description: string;
  dependencies: DependencyEdge[];
}

export const channelDependencyScenario: DependencyScenario = {
  id: "channel_dependency",
  name: "Cyclic write-channel dependency",
  description: "A source makes WVALID depend on AWREADY while the destination policy makes AWREADY depend on WVALID.",
  dependencies: [
    {
      from: "master.WVALID",
      to: "slave.AWREADY",
      legality: "illegal",
      rule: "AXI-A3-VALID-INDEPENDENCE",
      explanation: "A source must assert VALID independently of READY.",
    },
    {
      from: "slave.AWREADY",
      to: "master.WVALID",
      legality: "legal-destination-policy",
      explanation: "A destination may wait for VALID before asserting READY, although this policy completes the cycle here.",
    },
  ],
};

export const delayedReadyScenario: DependencyScenario = {
  id: "delayed_ready",
  name: "Legal delayed READY",
  description: "The destination applies backpressure without creating a source VALID dependency.",
  dependencies: [
    {
      from: "slave.AWREADY",
      to: "master.AWVALID",
      legality: "legal-destination-policy",
      explanation: "The destination may observe VALID before raising READY; a separate product watchdog may bound latency.",
    },
  ],
};

export const axiDependencyScenarios = [channelDependencyScenario, delayedReadyScenario] as const;

export function findDirectedCycle(edges: readonly DependencyEdge[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
  const visited = new Set<string>();
  const active = new Set<string>();
  const path: string[] = [];

  const visit = (node: string): string[] | null => {
    if (active.has(node)) {
      const cycleStart = path.indexOf(node);
      return [...path.slice(cycleStart), node];
    }
    if (visited.has(node)) return null;
    visited.add(node);
    active.add(node);
    path.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    path.pop();
    active.delete(node);
    return null;
  };

  for (const node of adjacency.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

export function analyzeDependencies(scenario: DependencyScenario) {
  const cycle = findDirectedCycle(scenario.dependencies);
  return {
    hasCycle: Boolean(cycle),
    cycle,
    illegalEdges: scenario.dependencies.filter((edge) => edge.legality === "illegal"),
  };
}
