import { describe, expect, it } from "vitest";

import { channelDependencyScenario, delayedReadyScenario, findDirectedCycle } from "@/lib/axi-dependency-model";
import {
  DEADLOCK_PRESETS,
  PREDICTION_CHOICES,
  REQUIRED_WRITE_EDGES,
  WRITE_POLICIES,
  analyzeWriteConfig,
  buildWriteScenario,
  legalPartnersFor,
  listCycles,
  policyKey,
  predictionFeedback,
  type PolicyId,
} from "@/lib/axi-deadlock-model";

const allSubsets = (): PolicyId[][] =>
  Array.from({ length: 1 << WRITE_POLICIES.length }, (_, mask) => WRITE_POLICIES.filter((_, i) => mask & (1 << i)).map((p) => p.id));

const preset = (id: string) => DEADLOCK_PRESETS.find((p) => p.id === id)!.policies;

describe("AXI write wait-for configurations (IHI0022E §A3.3.1)", () => {
  it("reuses the lesson model's edges for the classic and delayed-READY policies", () => {
    expect(buildWriteScenario(preset("classic")).dependencies.slice(0, 2)).toEqual(channelDependencyScenario.dependencies);
    expect(buildWriteScenario(preset("delayed-ready")).dependencies[0]).toEqual(delayedReadyScenario.dependencies[0]);
  });

  it("source waits for READY are illegal; destination waits for VALID are legal", () => {
    for (const p of WRITE_POLICIES) {
      const sourceWaitsForReady = /VALID$/.test(p.edge.from) && /READY$/.test(p.edge.to);
      expect(p.edge.legality === "illegal", p.id).toBe(sourceWaitsForReady);
    }
  });

  it("always includes the AXI4 B dependency on the AW and WLAST handshakes", () => {
    const deps = buildWriteScenario([]).dependencies;
    expect(deps).toEqual(REQUIRED_WRITE_EDGES);
    expect(deps.map((e) => `${e.from}->${e.to}`)).toEqual(["slave.BVALID->master.AWVALID", "slave.BVALID->master.WVALID"]);
  });

  it("classic: master WVALID waits for AWREADY + slave AWREADY waits for WVALID deadlocks", () => {
    const a = analyzeWriteConfig(preset("classic"));
    expect(a.verdict).toBe("deadlock");
    expect(a.cycles).toEqual([["master.WVALID", "slave.AWREADY", "master.WVALID"]]);
    expect(a.illegalEdges.map((e) => e.from)).toEqual(["master.WVALID"]);
    expect(a.why).toMatch(/master WVALID waits for AWREADY, slave AWREADY waits for WVALID/);
  });

  it("delayed READY alone is safe: a destination may wait for VALID", () => {
    expect(analyzeWriteConfig(preset("delayed-ready"))).toMatchObject({ verdict: "safe", cycles: [], illegalEdges: [] });
  });

  it("latent: an illegal source wait without a partner that waits back completes, and the model names the partner that would deadlock it", () => {
    const a = analyzeWriteConfig(preset("latent"));
    expect(a.verdict).toBe("latent-violation");
    expect(a.partners.map((p) => p.partner.id)).toEqual(["s-awready-waits-wvalid"]);
    expect(a.why).toMatch(/AWREADY waits for WVALID, the loop closes/);
  });

  it("B channel: a slave holding BVALID for BREADY deadlocks against a master that waits for BVALID", () => {
    const a = analyzeWriteConfig(preset("b-channel"));
    expect(a.verdict).toBe("deadlock");
    expect(a.cycles).toEqual([["master.BREADY", "slave.BVALID", "master.BREADY"]]);
    expect(a.illegalEdges.map((e) => e.from)).toEqual(["slave.BVALID"]);
  });

  it("lists every distinct loop when two deadlocks coexist", () => {
    const a = analyzeWriteConfig([...preset("classic"), ...preset("b-channel")]);
    expect(a.cycles).toHaveLength(2);
  });

  it("exhaustively: listCycles agrees with the lesson's findDirectedCycle on all 256 configurations", () => {
    for (const policies of allSubsets()) {
      const deps = buildWriteScenario(policies).dependencies;
      expect(listCycles(deps).length > 0, policyKey(policies)).toBe(findDirectedCycle(deps) !== null);
    }
  });

  it("exhaustively: every configuration of legal waits is deadlock-free", () => {
    const legalIds = WRITE_POLICIES.filter((p) => p.edge.legality !== "illegal").map((p) => p.id);
    for (const policies of allSubsets().filter((s) => s.every((id) => legalIds.includes(id)))) {
      expect(analyzeWriteConfig(policies).verdict, policyKey(policies)).toBe("safe");
    }
  });

  it("exhaustively: every deadlock contains an illegal wait, and every loop passes through one", () => {
    for (const policies of allSubsets()) {
      const a = analyzeWriteConfig(policies);
      if (a.verdict !== "deadlock") continue;
      for (const cycle of a.cycles) {
        const pairs = cycle.slice(0, -1).map((from, i) => [from, cycle[i + 1]]);
        expect(
          pairs.some(([from, to]) => a.illegalEdges.some((e) => e.from === from && e.to === to)),
          policyKey(policies),
        ).toBe(true);
      }
    }
  });

  it("every illegal wait has a legal partner that would deadlock it, so 'latent' is never a false alarm", () => {
    for (const p of WRITE_POLICIES.filter((x) => x.edge.legality === "illegal")) {
      expect(legalPartnersFor(p.edge).length, p.id).toBeGreaterThan(0);
    }
  });

  it("prediction feedback: the right choice gets the why; each wrong choice gets a diagnosis", () => {
    for (const id of ["classic", "latent", "delayed-ready"]) {
      const a = analyzeWriteConfig(preset(id));
      for (const choice of PREDICTION_CHOICES) {
        const text = predictionFeedback(a, choice.id);
        if (choice.id === a.verdict) expect(text).toBe(a.why);
        else expect(text).not.toBe(a.why);
      }
    }
    expect(predictionFeedback(analyzeWriteConfig(preset("latent")), "deadlock")).toMatch(/nothing waits back/);
    expect(predictionFeedback(analyzeWriteConfig(preset("delayed-ready")), "deadlock")).toMatch(/Waiting alone does not deadlock/);
  });

  it("policyKey is independent of selection order", () => {
    expect(policyKey(["s-awready-waits-wvalid", "m-wvalid-waits-awready"])).toBe(policyKey(["m-wvalid-waits-awready", "s-awready-waits-wvalid"]));
  });
});
