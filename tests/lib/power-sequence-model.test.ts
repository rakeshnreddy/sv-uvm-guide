import { describe, expect, it } from "vitest";

import { CLAMP_VALUE, CTX_VALUE, POWER_SCENARIOS, runPowerSequence, upfLines } from "@/lib/power-sequence-model";

describe("power-sequence-model (UPF power-aware semantics)", () => {
  it("correct order: PD_TOP only ever sees ctx or the clamp, and retention brings ctx back", () => {
    const run = runPowerSequence(POWER_SCENARIOS.correct.events);
    expect(run.outcome).toBe("clean");
    expect(run.snapshots.map((s) => s.topSees)).toEqual([CTX_VALUE, CLAMP_VALUE, CLAMP_VALUE, CLAMP_VALUE, CLAMP_VALUE, CLAMP_VALUE, CTX_VALUE]);
    expect(run.firstFailure).toEqual({});
    expect(run.contextRestored).toBe(true);
  });

  it("isolation stays consistent: isoEn is 1 from ISO_ON through RESTORE and 0 only after ISO_OFF", () => {
    const run = runPowerSequence(POWER_SCENARIOS.correct.events);
    expect(run.snapshots.map((s) => s.isoEn)).toEqual([0, 1, 1, 1, 1, 1, 0]);
    const restore = run.snapshots.find((s) => s.event === "RESTORE")!;
    expect(restore.isoEn).toBe(1);
    expect(restore.why).not.toMatch(/isolation removed/i);
  });

  it("save-then-isolate is also legal: the order of save and isolation does not matter while powered", () => {
    expect(runPowerSequence(POWER_SCENARIOS.save_then_iso.events).outcome).toBe("clean");
  });

  it("corruption: power-off turns every PD_CPU register to X; the retention element keeps the saved value", () => {
    const off = runPowerSequence(POWER_SCENARIOS.correct.events).snapshots[3];
    expect(off.event).toBe("PWR_OFF");
    expect(off).toMatchObject({ ctx: "X", scratch: "X", retained: CTX_VALUE, supplyOn: false });
  });

  it("power-on alone restores nothing; non-retained state stays X even after restore", () => {
    const run = runPowerSequence(POWER_SCENARIOS.correct.events);
    expect(run.snapshots[4]).toMatchObject({ event: "PWR_ON", ctx: "X" });
    expect(run.snapshots[5]).toMatchObject({ event: "RESTORE", ctx: CTX_VALUE, scratch: "X" });
  });

  it("power off before isolation leaks X into PD_TOP and fails p_iso_before_pwr_down at that step", () => {
    const run = runPowerSequence(POWER_SCENARIOS.off_before_iso.events);
    expect(run.firstFailure.p_iso_before_pwr_down).toBe(2);
    expect(run.xLeakSteps).toEqual([2]);
    expect(run.outcome).toBe("x_leak");
  });

  it("releasing isolation before restore exposes the still-corrupted ctx", () => {
    const run = runPowerSequence(POWER_SCENARIOS.early_release.events);
    expect(run.xLeakSteps).toEqual([5]);
    expect(run.contextRestored).toBe(true);
    expect(run.outcome).toBe("x_leak");
  });

  it("saving after power-off saves X: p_save_while_powered fails and the context is lost", () => {
    const run = runPowerSequence(POWER_SCENARIOS.save_after_off.events);
    expect(run.firstFailure.p_save_while_powered).toBe(3);
    expect(run.contextRestored).toBe(false);
    expect(run.outcome).toBe("both");
  });

  it("restoring without any save leaves ctx X; forgetting ISO_OFF leaves the domain isolated", () => {
    const run = runPowerSequence(["ISO_ON", "PWR_OFF", "PWR_ON", "RESTORE"]);
    expect(run.contextRestored).toBe(false);
    expect(run.endIsolated).toBe(true);
    expect(run.outcome).toBe("context_lost");
    expect(run.summary).toMatch(/isolation is still on/);
  });

  it("every step names the UPF command that governs it", () => {
    const keys = new Set(upfLines().map((l) => l.key));
    for (const snap of runPowerSequence(POWER_SCENARIOS.correct.events).snapshots) {
      expect(snap.upfKeys.length).toBeGreaterThan(0);
      for (const k of snap.upfKeys) expect(keys.has(k)).toBe(true);
    }
    const text = upfLines().map((l) => l.text).join("\n");
    for (const cmd of ["create_power_domain", "create_supply_net", "create_power_switch", "set_isolation", "set_retention", "add_power_state"]) {
      expect(text).toContain(cmd);
    }
  });
});
