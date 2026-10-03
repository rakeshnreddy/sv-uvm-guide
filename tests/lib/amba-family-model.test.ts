import { describe, expect, it } from "vitest";

import {
  AMBA_PROTOCOLS,
  CAPABILITIES,
  FACT_KEYS,
  FIT_SCENARIOS,
  assessFit,
  bestFit,
  getFitScenario,
  getProtocol,
  type AmbaProtocolId,
} from "@/lib/amba-family-model";

const fact = (id: AmbaProtocolId, key: (typeof FACT_KEYS)[number]) => getProtocol(id).facts[key];

describe("AMBA family facts", () => {
  it("every protocol has every fact, each with a spec citation", () => {
    for (const p of AMBA_PROTOCOLS) {
      for (const key of FACT_KEYS) {
        expect(p.facts[key].text.length, `${p.id}.${key}`).toBeGreaterThan(0);
        expect(p.facts[key].source, `${p.id}.${key}`).toMatch(/IHI00(22E|24D|33B\.b|50E\.b|51A)/);
      }
      for (const c of CAPABILITIES) expect(typeof p.capabilities[c]).toBe("boolean");
    }
  });

  it("APB is not pipelined and has no bursts or outstanding transfers (IHI0024D §1.1, §4.1)", () => {
    expect(fact("apb", "pipelining")).toMatchObject({ support: "no", source: "IHI0024D §1.1" });
    expect(fact("apb", "pipelining").text).toMatch(/at least two cycles/);
    expect(fact("apb", "bursts").support).toBe("no");
    expect(fact("apb", "outstanding").support).toBe("no");
    expect(getProtocol("apb").capabilities.backToBack).toBe(false);
  });

  it("APB strobes and error response are optional additions (PSTRB in APB4, PSLVERR in APB3; IHI0024D §3.2, §3.4)", () => {
    expect(fact("apb", "strobes")).toMatchObject({ support: "optional" });
    expect(fact("apb", "strobes").text).toMatch(/PSTRB/);
    expect(fact("apb", "errors")).toMatchObject({ support: "optional" });
    expect(fact("apb", "errors").text).toMatch(/PSLVERR.*last ACCESS cycle/);
  });

  it("AHB has separate HWDATA and HRDATA buses, not one multiplexed channel (IHI0033B.b §6.1; audit B-AMBA-1 L81)", () => {
    expect(fact("ahb", "channels").text).toMatch(/separate write \(HWDATA\) and read \(HRDATA\)/);
    expect(fact("ahb", "channels").text).not.toMatch(/multiplex/i);
  });

  it("AHB pipelines address and data but keeps one transfer per phase, in order, with a two-cycle ERROR (IHI0033B.b §3.1, §5.1)", () => {
    expect(fact("ahb", "pipelining").support).toBe("yes");
    expect(fact("ahb", "outstanding").support).toBe("limited");
    expect(fact("ahb", "ordering").support).toBe("no");
    expect(fact("ahb", "errors").text).toMatch(/two cycles/);
    expect(fact("ahb", "bursts").text).toMatch(/1KB/);
    expect(getProtocol("ahb").capabilities.outstanding).toBe(false);
  });

  it("AXI burst limits: AXI3 1-16 for all types; AXI4 INCR to 256, FIXED/WRAP to 16; no 4KB crossing (IHI0022E §A3.4.1)", () => {
    expect(fact("axi3", "bursts").text).toMatch(/1 to 16 beats for FIXED, INCR and WRAP/);
    expect(fact("axi4", "bursts").text).toMatch(/INCR 1 to 256 beats; FIXED and WRAP 1 to 16/);
    for (const id of ["axi3", "axi4"] as const) expect(fact(id, "bursts").text).toMatch(/4KB/);
  });

  it("out-of-order completion is across different IDs only; same-ID stays ordered (IHI0022E §A5.3; audit B-AMBA-1 L54)", () => {
    for (const id of ["axi3", "axi4"] as const) {
      expect(fact(id, "ordering").support).toBe("yes");
      expect(fact(id, "ordering").text).toMatch(/Different IDs may complete in any order; the same ID stays in order/);
    }
  });

  it("write interleaving exists only in AXI3; AXI4 removed WID (IHI0022E §A5.4)", () => {
    expect(fact("axi3", "ordering").text).toMatch(/interleaved/);
    expect(fact("axi4", "ordering").text).toMatch(/No write interleaving/);
    expect(fact("axi4", "ordering").source).toMatch(/§A5\.4/);
  });

  it("AXI response set includes EXOKAY (IHI0022E §A3.4.4; audit B-AMBA-1 L66)", () => {
    for (const id of ["axi3", "axi4"] as const) expect(fact(id, "errors").text).toMatch(/OKAY, EXOKAY, SLVERR, DECERR/);
  });

  it("AXI4-Lite: single beat, no IDs so in order, multiple outstanding allowed, WSTRB kept, no EXOKAY (IHI0022E §B1.1)", () => {
    expect(fact("axi4-lite", "bursts").support).toBe("no");
    expect(fact("axi4-lite", "ordering").support).toBe("no");
    expect(fact("axi4-lite", "outstanding").text).toMatch(/Multiple outstanding transactions are allowed/);
    expect(fact("axi4-lite", "strobes").support).toBe("yes");
    expect(fact("axi4-lite", "errors").text).toMatch(/EXOKAY is not supported/);
  });

  it("AXI4-Stream has no addresses and no response channel (IHI0051A §2.1)", () => {
    expect(getProtocol("axi4-stream").capabilities.addressed).toBe(false);
    expect(fact("axi4-stream", "errors").support).toBe("no");
    expect(fact("axi4-stream", "ordering").text).toMatch(/never reordered/);
  });

  it("ACE adds three snoop channels; ACE-Lite has none and is I/O coherent only (IHI0022E §C1.3.2, §C11.1)", () => {
    const aceLanes = getProtocol("ace").lanes.map((l) => l.name);
    expect(aceLanes).toEqual(expect.arrayContaining(["AC", "CR", "CD"]));
    expect(getProtocol("ace-lite").lanes.map((l) => l.name)).not.toContain("AC");
    expect(getProtocol("ace").capabilities.snooped).toBe(true);
    expect(getProtocol("ace-lite").capabilities).toMatchObject({ snooped: false, ioCoherent: true });
  });

  it("CHI: REQ/RSP/SNP/DAT channels, at most 64 bytes per transaction, RespErr OK/EXOK/DERR/NDERR (IHI0050E.b §2.1, §2.10.1, §9.2)", () => {
    expect(fact("chi", "channels").text).toMatch(/REQ, RSP, SNP and DAT/);
    expect(fact("chi", "bursts").text).toMatch(/at most 64 bytes/);
    expect(fact("chi", "errors").text).toMatch(/OK, EXOK, DERR .* NDERR/);
    expect(getProtocol("chi").capabilities.networkLayer).toBe(true);
    expect(AMBA_PROTOCOLS.filter((p) => p.capabilities.networkLayer).map((p) => p.id)).toEqual(["chi"]);
  });

  it("capability flags agree with the cited facts", () => {
    for (const p of AMBA_PROTOCOLS) {
      expect(p.capabilities.bursts, p.id).toBe(p.facts.bursts.support === "yes");
      expect(p.capabilities.outOfOrder, p.id).toBe(p.facts.ordering.support === "yes");
      expect(p.capabilities.snooped, p.id).toBe(p.facts.coherency.support === "yes");
      expect(p.capabilities.ioCoherent, p.id).toBe(p.facts.coherency.support === "yes" || p.facts.coherency.support === "limited");
    }
  });
});

describe("which protocol fits this block?", () => {
  it("every scenario has exactly one best fit among its options", () => {
    for (const s of FIT_SCENARIOS) {
      expect(bestFit(s), s.id).not.toBeNull();
      expect(s.options.map((o) => o.protocol)).toContain(bestFit(s));
      expect(new Set(s.options.map((o) => o.protocol)).size, s.id).toBe(s.options.length);
    }
  });

  it.each([
    ["uart", "apb"],
    ["dma", "axi4"],
    ["cpu-cluster", "ace"],
    ["gpu", "ace-lite"],
    ["video", "axi4-stream"],
    ["mesh", "chi"],
  ] as const)("%s → %s", (scenarioId, expected) => {
    expect(bestFit(getFitScenario(scenarioId))).toBe(expected);
  });

  it("explains a wrong choice with the capability it lacks", () => {
    expect(assessFit("ahb", getFitScenario("dma")).missing).toEqual(["outstanding", "concurrentReadWrite"]);
    expect(assessFit("ace-lite", getFitScenario("cpu-cluster")).missing).toEqual(["snooped"]);
    expect(assessFit("axi4-stream", getFitScenario("dma")).missing).toContain("addressed");
  });

  it("explains an over-built choice with the extras it pays for", () => {
    expect(assessFit("ace", getFitScenario("gpu"))).toMatchObject({ missing: [], extras: ["snooped"] });
    expect(assessFit("axi4-lite", getFitScenario("uart"))).toMatchObject({ missing: [], extras: ["outstanding", "concurrentReadWrite"] });
  });

  it("every option has diagnostic feedback", () => {
    for (const s of FIT_SCENARIOS) for (const o of s.options) expect(o.feedback.length, `${s.id}/${o.protocol}`).toBeGreaterThan(40);
  });
});
