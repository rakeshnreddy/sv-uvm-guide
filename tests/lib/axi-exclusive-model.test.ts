import { describe, expect, it } from "vitest";

import { EXCLUSIVE_PRESETS, exclusiveRestrictionErrors, runExclusive, type ExclusiveOp } from "@/lib/axi-exclusive-model";

const preset = (id: string) => EXCLUSIVE_PRESETS.find((p) => p.id === id)!.ops;
const resps = (ops: ExclusiveOp[], policy: Parameters<typeof runExclusive>[1]) => runExclusive(ops, policy).steps.map((s) => s.resp);

describe("axi-exclusive-model (IHI0022E A7.2)", () => {
  it("an uncontended exclusive read/write pair succeeds with EXOKAY and updates memory (A7.2.2)", () => {
    const run = runExclusive(preset("clean"), "per-id", { "0x1000": 0 });
    expect(run.steps.map((s) => s.resp)).toEqual(["EXOKAY", "EXOKAY"]);
    expect(run.steps[1].memoryAfter["0x1000"]).toBe(1);
  });

  it("a normal write by another master in between makes the exclusive write fail: OKAY, memory unchanged (A7.2.3)", () => {
    const run = runExclusive(preset("intervening-write"), "per-id", { "0x1000": 0 });
    expect(run.steps.map((s) => s.resp)).toEqual(["EXOKAY", "OKAY", "OKAY"]);
    expect(run.steps[2].memoryUpdated).toBe(false);
    expect(run.steps[2].memoryAfter["0x1000"]).toBe(7);
  });

  it("per-ID monitors (the A7.2.3 recommendation): the first writer wins and its write ends the other monitor", () => {
    expect(resps(preset("race"), "per-id")).toEqual(["EXOKAY", "EXOKAY", "EXOKAY", "OKAY"]);
  });

  it("a single shared monitor loses M0's reservation on M1's exclusive read, so the outcome flips", () => {
    expect(resps(preset("race"), "single")).toEqual(["EXOKAY", "EXOKAY", "OKAY", "EXOKAY"]);
  });

  it("a slave without exclusive support answers the exclusive read with OKAY and still performs the write (A7.2.2, A7.2.5)", () => {
    const run = runExclusive(preset("clean"), "unsupported", { "0x1000": 0 });
    expect(run.steps.map((s) => s.resp)).toEqual(["OKAY", "OKAY"]);
    expect(run.steps[1].memoryUpdated).toBe(true);
  });

  it("an exclusive read with the same ID moves that ID's monitor to the new address (A7.2.1)", () => {
    const ops: ExclusiveOp[] = [
      { kind: "ex-read", id: 0, master: "M0", addr: 0x1000, bytesPerBeat: 4, beats: 1 },
      { kind: "ex-read", id: 0, master: "M0", addr: 0x2000, bytesPerBeat: 4, beats: 1 },
      { kind: "write", id: 1, master: "M1", addr: 0x1000, bytesPerBeat: 4, beats: 1, data: 9 },
      { kind: "ex-write", id: 0, master: "M0", addr: 0x2000, bytesPerBeat: 4, beats: 1, data: 1 },
    ];
    const run = runExclusive(ops, "per-id");
    expect(run.steps[1].monitorAfter).toEqual([{ id: 0, addr: 0x2000, bytes: 4 }]);
    expect(run.steps.map((s) => s.resp)).toEqual(["EXOKAY", "EXOKAY", "OKAY", "EXOKAY"]);
    // An exclusive write whose address differs from the exclusive read is UNPREDICTABLE (A7.2.4).
    expect(resps([ops[0], { ...ops[3], addr: 0x1004 }], "per-id")[1]).toBe("UNPREDICTABLE");
  });

  it("A7.2.4: total bytes must be a power of 2 up to 128, aligned, and at most 16 transfers", () => {
    const base = { kind: "ex-read" as const, id: 0, master: "M0" };
    expect(exclusiveRestrictionErrors({ ...base, addr: 0x1004, bytesPerBeat: 4, beats: 3 }).length).toBe(2);
    // 256 bytes: a power of 2, but over 128 bytes and over 16 transfers.
    expect(exclusiveRestrictionErrors({ ...base, addr: 0x1000, bytesPerBeat: 8, beats: 32 })).toHaveLength(2);
    expect(exclusiveRestrictionErrors({ ...base, addr: 0x1040, bytesPerBeat: 4, beats: 16 })).toEqual([]);
    expect(resps(preset("restriction"), "per-id")).toEqual(["UNPREDICTABLE"]);
  });
});
