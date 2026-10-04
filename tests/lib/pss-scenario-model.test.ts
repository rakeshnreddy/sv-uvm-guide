import { describe, expect, it } from "vitest";

import { PSS_SCENARIOS, SCOREBOARD_LINES, expandExec, generateTarget, pssSourceLines, resolveScenario } from "@/lib/pss-scenario-model";

describe("pss-scenario-model: scenario resolution (Accellera PSS buffer, inference and resource rules)", () => {
  it("buffer binding: the read's input binds to the write that completes before it; nothing is inferred", () => {
    const r = resolveScenario(PSS_SCENARIOS.raw);
    expect(r.outcome).toBe("as_written");
    expect(r.slots.map((s) => s.map((i) => i.id))).toEqual([["write_a#1"], ["read_check_a#2"]]);
    expect(r.instances[1].boundFrom).toEqual({ in_buf: "write_a#1.out_buf" });
    expect(r.instances[1].values.in_buf).toEqual(r.instances[0].values.out_buf);
  });

  it("inference: an activity with only a read gets a producer action the activity never mentioned", () => {
    const r = resolveScenario(PSS_SCENARIOS.infer);
    expect(r.outcome).toBe("inferred");
    expect(r.instances.map((i) => [i.id, i.inferred])).toEqual([
      ["write_a#1", true],
      ["read_check_a#2", false],
    ]);
    expect(r.instances[0].slot).toBeLessThan(r.instances[1].slot);
    expect(r.instances[0].why).toMatch(/dma_copy_a could also produce one/);
  });

  it("resources: parallel actions that lock dma_chan_r get distinct instance ids from a pool of 2", () => {
    const r = resolveScenario(PSS_SCENARIOS.dma_two);
    expect(r.feasible).toBe(true);
    const parallel = r.slots[r.slots.length - 1];
    expect(parallel.map((i) => i.action)).toEqual(["dma_copy_a", "dma_copy_a"]);
    expect(parallel.map((i) => i.chan)).toEqual([0, 1]);
    // Each copy's source buffer needs a producer that completes before the parallel block.
    expect(r.instances.filter((i) => i.inferred).every((i) => i.slot < parallel[0].slot)).toBe(true);
    // dst.data == src.data
    for (const d of parallel) expect(d.values.dst.data).toBe(d.values.src.data);
  });

  it("resources: a pool of 1 cannot serve two parallel locks → solve-time error, no code generated", () => {
    const r = resolveScenario(PSS_SCENARIOS.dma_one);
    expect(r.feasible).toBe(false);
    expect(r.outcome).toBe("infeasible");
    expect(r.error).toMatch(/chan_p holds only 1 instance/);
    expect(generateTarget(r, "C").join("\n")).toMatch(/nothing generated/);
  });

  it("solved values are deterministic and respect the buffer constraint (aligned, in range)", () => {
    const a = resolveScenario(PSS_SCENARIOS.dma_two);
    const b = resolveScenario(PSS_SCENARIOS.dma_two);
    expect(a.instances.map((i) => i.values)).toEqual(b.instances.map((i) => i.values));
    for (const inst of a.instances)
      for (const v of Object.values(inst.values)) {
        expect(v.addr % 4).toBe(0);
        expect(v.addr).toBeGreaterThanOrEqual(0x1000);
        expect(v.addr).toBeLessThanOrEqual(0x1ffc);
      }
  });
});

describe("pss-scenario-model: source and target text", () => {
  it("the PSS source declares the buffer, resource, pools, actions, exec blocks and activity", () => {
    const src = pssSourceLines(PSS_SCENARIOS.dma_one).map((l) => l.text).join("\n");
    expect(src).toContain("buffer mem_buf_s {");
    expect(src).toContain("resource dma_chan_r { }");
    expect(src).toContain("pool [1] dma_chan_r chan_p;");
    expect(src).toContain("bind buf_p *;");
    expect(src).toContain("lock   dma_chan_r chan;");
    expect(src).toContain("output mem_buf_s out_buf;");
    expect(src).toMatch(/exec body C {2}= """ mem_write32\(\{\{out_buf\.addr\}\}/);
    expect(src).toContain("      parallel {");
    // PSS uses `in [a..b]`, not SystemVerilog `inside`.
    expect(src).not.toContain("inside");
  });

  it("the C target self-checks inline; the SV target only starts sequences and leaves checking to the scoreboard", () => {
    const r = resolveScenario(PSS_SCENARIOS.raw);
    const c = generateTarget(r, "C").join("\n");
    const sv = generateTarget(r, "SV").join("\n");
    expect(c).toMatch(/if \(mem_read32\(0x[0-9A-F]{8}\) != 0x[0-9A-F]{8}\) test_fail\(\);/);
    expect(sv).not.toMatch(/uvm_error|!==|!=/);
    expect(sv).toContain("read data is checked by the scoreboard");
    expect(SCOREBOARD_LINES.join("\n")).toContain("ref_mem.exists(t.addr) && t.data !== ref_mem[t.addr]");
  });

  it("exec templates substitute the bound buffer values and the locked instance id", () => {
    const r = resolveScenario(PSS_SCENARIOS.dma_two);
    const second = r.slots[r.slots.length - 1][1];
    const line = expandExec(second, "C")[0];
    expect(line.startsWith("dma_copy(1, ")).toBe(true);
    expect(generateTarget(r, "SV").join("\n")).toMatch(/fork[\s\S]*dma_copy_a_3[\s\S]*dma_copy_a_4[\s\S]*join/);
  });
});
