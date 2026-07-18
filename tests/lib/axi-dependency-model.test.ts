import { describe, expect, it } from "vitest";

import {
  analyzeDependencies,
  channelDependencyScenario,
  delayedReadyScenario,
  findDirectedCycle,
} from "@/lib/axi-dependency-model";

describe("AXI wait-for dependency model", () => {
  it("detects a directed dependency cycle", () => {
    expect(findDirectedCycle(channelDependencyScenario.dependencies)).toEqual([
      "master.WVALID",
      "slave.AWREADY",
      "master.WVALID",
    ]);
  });

  it("attributes the violation to VALID depending on READY", () => {
    const result = analyzeDependencies(channelDependencyScenario);
    expect(result.hasCycle).toBe(true);
    expect(result.illegalEdges).toEqual([
      expect.objectContaining({ from: "master.WVALID", legality: "illegal" }),
    ]);
    expect(channelDependencyScenario.dependencies[1].legality).toBe("legal-destination-policy");
  });

  it("accepts a legal delayed-READY scenario without a cycle", () => {
    expect(analyzeDependencies(delayedReadyScenario)).toMatchObject({ hasCycle: false, illegalEdges: [] });
  });
});
