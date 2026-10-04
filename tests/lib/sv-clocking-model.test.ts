import { describe, expect, it } from "vitest";

import {
  DEFAULT_CLOCK,
  DEFAULT_INPUT_SKEW,
  DEFAULT_OUTPUT_SKEW,
  DEFAULT_SCENARIO,
  cycleDelay,
  dutOutputTrace,
  edgeAt,
  edgeTime,
  inputSamplePoint,
  nextEdgeAfter,
  rawBlockingDriveCapture,
  readClockvar,
  readRawAtEdge,
  readSignal,
  runClocking,
  sampleInput,
  scenarioToSource,
  scheduleDrive,
  type SignalTrace,
} from "@/lib/sv-clocking-model";

const clock = DEFAULT_CLOCK; // edges at 5, 15, 25, 35 ns

describe("sv-clocking-model: clock geometry", () => {
  it("numbers rising edges from 1 at firstEdge + (k-1) * period", () => {
    expect([1, 2, 3, 4].map((k) => edgeTime(clock, k))).toEqual([5, 15, 25, 35]);
    expect(edgeAt(clock, 25)).toBe(3);
    expect(edgeAt(clock, 23)).toBeNull();
    expect(nextEdgeAfter(clock, 25)).toBe(4);
    expect(nextEdgeAfter(clock, 18)).toBe(3);
    expect(nextEdgeAfter(clock, 0)).toBe(1);
  });
});

describe("sv-clocking-model: defaults (§14.3)", () => {
  it("default input skew is #1step and default output skew is #0", () => {
    expect(DEFAULT_INPUT_SKEW).toEqual({ kind: "1step" });
    expect(DEFAULT_OUTPUT_SKEW).toEqual({ kind: "zero" });
  });
});

describe("sv-clocking-model: input sampling (§14.4, §14.13)", () => {
  const flop = dutOutputTrace(clock, { delay: 0, update: "nba" });

  it("#1step samples in Preponed of the edge's time slot, so an NBA update at the edge is not seen (§14.4, §4.4.2.1)", () => {
    const point = inputSamplePoint(clock, 3, { kind: "1step" });
    expect(point.at).toEqual({ time: 25, region: "preponed" });
    expect(sampleInput(flop, clock, 3, { kind: "1step" }).value).toBe(2);
  });

  it("explicit #0 samples in Observed, after the design's NBA update at that edge (§14.4, §14.13)", () => {
    expect(inputSamplePoint(clock, 3, { kind: "zero" }).at).toEqual({ time: 25, region: "observed" });
    expect(sampleInput(flop, clock, 3, { kind: "zero" }).value).toBe(3);
  });

  it("explicit #0 does not see a Re-NBA (testbench drive) update in the same slot: Observed precedes Re-NBA", () => {
    const tbDriven: SignalTrace = { name: "s", initial: 0, changes: [{ at: { time: 25, region: "reNba" }, value: 9, cause: "drive" }] };
    expect(sampleInput(tbDriven, clock, 3, { kind: "zero" }).value).toBe(0);
  });

  it("#N samples in Postponed of edge - N, so a change exactly at edge - N is captured (§14.13)", () => {
    // Path delay 8 ns: dout becomes 2 at 15 + 8 = 23 = 25 - 2.
    const late = dutOutputTrace(clock, { delay: 8, update: "nba" });
    const point = inputSamplePoint(clock, 3, { kind: "delay", units: 2 });
    expect(point.at).toEqual({ time: 23, region: "postponed" });
    expect(sampleInput(late, clock, 3, { kind: "delay", units: 2 }).value).toBe(2);
  });

  it("#N misses a change that arrives after edge - N: the input skew acts like a setup window", () => {
    // Path delay 9 ns: dout becomes 2 at 24, after the 23 ns sample.
    const tooLate = dutOutputTrace(clock, { delay: 9, update: "nba" });
    expect(sampleInput(tooLate, clock, 3, { kind: "delay", units: 2 }).value).toBe(1);
    // #1step still sees it, because 24 is before the edge at 25.
    expect(sampleInput(tooLate, clock, 3, { kind: "1step" }).value).toBe(2);
  });

  it("before any change the sample is the signal's initial value", () => {
    expect(sampleInput(flop, clock, 1, { kind: "1step" }).value).toBe(0);
  });
});

describe("sv-clocking-model: reading clockvars (§14.10, §14.13)", () => {
  const flop = dutOutputTrace(clock, { delay: 0, update: "nba" });

  it("after @(cb) the read is the new sample of that edge, never a race (@(cb) fires in Observed after the update)", () => {
    const read = readClockvar(flop, clock, 3, { kind: "1step" }, "cb");
    expect(read.race).toBe(false);
    expect(read.value).toBe(2);
  });

  it("after @(posedge clk) the read races between the previous and the new sample (§14.13 NOTE)", () => {
    const read = readClockvar(flop, clock, 3, { kind: "1step" }, "posedge");
    expect(read.race).toBe(true);
    expect(read.candidates).toEqual([1, 2]);
  });
});

describe("sv-clocking-model: raw @(posedge clk) reads without a clocking block", () => {
  it("an NBA update at the edge is not yet visible in Active, deterministically", () => {
    const read = readRawAtEdge(dutOutputTrace(clock, { delay: 0, update: "nba" }), clock, 3);
    expect(read).toMatchObject({ value: 2, race: false });
  });

  it("a blocking update in Active at the same edge races with the read (§4.7)", () => {
    const read = readRawAtEdge(dutOutputTrace(clock, { delay: 0, update: "blocking" }), clock, 3);
    expect(read.race).toBe(true);
    expect(read.candidates).toEqual([2, 3]);
  });

  it("#1step removes that race: Preponed is read-only and precedes Active", () => {
    const blocking = dutOutputTrace(clock, { delay: 0, update: "blocking" });
    expect(sampleInput(blocking, clock, 3, { kind: "1step" }).value).toBe(2);
    expect(readSignal(blocking, { time: 25, region: "preponed" }).race).toBe(false);
  });
});

describe("sv-clocking-model: synchronous drives (§14.16)", () => {
  it("#0 output skew: a drive issued at edge 2 matures in Re-NBA of edge 2's time slot and the DUT captures it at edge 3", () => {
    const drive = scheduleDrive(clock, { kind: "zero" }, { issuedAt: 15 });
    expect(drive.at).toEqual({ time: 15, region: "reNba" });
    expect(drive.capturedAtEdge).toBe(3);
  });

  it("nonzero output skew: the signal changes skew units after the edge, still in Re-NBA", () => {
    const drive = scheduleDrive(clock, { kind: "delay", units: 2 }, { issuedAt: 15 });
    expect(drive.at).toEqual({ time: 17, region: "reNba" });
    expect(drive.capturedAtEdge).toBe(3);
  });

  it("an output skew of a full period lands after edge 3's flops sampled, so they capture at edge 4", () => {
    const drive = scheduleDrive(clock, { kind: "delay", units: 10 }, { issuedAt: 15 });
    expect(drive.at.time).toBe(25);
    expect(drive.capturedAtEdge).toBe(4);
  });

  it("a drive executed between clocking events acts as if issued at the next one (`#3 cb.v <= e` matures in cycle 1)", () => {
    const lrmClock = { period: 10, firstEdge: 10, edges: 3, unit: "" };
    const drive = scheduleDrive(lrmClock, { kind: "zero" }, { issuedAt: 3 });
    expect(drive.clockingEdge).toBe(1);
    expect(drive.at.time).toBe(10);
  });

  it("`cb.v <= ##2 r` updates two cycles of cb's clock later, plus the output skew", () => {
    const drive = scheduleDrive(clock, { kind: "delay", units: 1 }, { issuedAt: 15, intraCycles: 2 });
    expect(drive.matureEdge).toBe(4);
    expect(drive.at).toEqual({ time: 36, region: "reNba" });
  });

  it("a racy blocking drive at the edge may be captured at that edge or the next", () => {
    expect(rawBlockingDriveCapture(2)).toEqual([2, 3]);
  });
});

describe("sv-clocking-model: procedural ## cycle delay (§14.11, §14.12)", () => {
  it("##N without a default clocking is a compile error", () => {
    const result = cycleDelay(clock, { cycles: 1, hasDefaultClocking: false, time: 15, afterClockingEvent: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.clause).toBe("§14.11");
  });

  it("##1 after @(cb) at edge 2 resumes at edge 3", () => {
    const result = cycleDelay(clock, { cycles: 1, hasDefaultClocking: true, time: 15, afterClockingEvent: true });
    expect(result).toMatchObject({ ok: true, resumeEdge: 3, suspends: true });
  });

  it("##1 executed between edges waits only the fraction of a cycle to the next edge", () => {
    const result = cycleDelay(clock, { cycles: 1, hasDefaultClocking: true, time: 18, afterClockingEvent: false });
    expect(result).toMatchObject({ ok: true, resumeEdge: 3 });
  });

  it("##0 continues without suspension when the clocking event already occurred in this time step", () => {
    const result = cycleDelay(clock, { cycles: 0, hasDefaultClocking: true, time: 15, afterClockingEvent: true });
    expect(result).toMatchObject({ ok: true, resumeEdge: 2, suspends: false });
  });

  it("##0 suspends until the clocking event when it has not occurred yet in this time step", () => {
    const result = cycleDelay(clock, { cycles: 0, hasDefaultClocking: true, time: 15, afterClockingEvent: false });
    expect(result).toMatchObject({ ok: true, resumeEdge: 2, suspends: true });
  });

  it("a negative count is rejected", () => {
    expect(cycleDelay(clock, { cycles: -1, hasDefaultClocking: true, time: 15, afterClockingEvent: true }).ok).toBe(false);
  });
});

describe("sv-clocking-model: full scenario", () => {
  it("default skews: cb.dout read after @(cb) at edge 3 is 2, and the edge-2 drive is captured at edge 3", () => {
    const run = runClocking(DEFAULT_SCENARIO);
    expect(run.question.edge).toBe(3);
    expect(run.question.afterCb.value).toBe(2);
    expect(run.drive?.capturedAtEdge).toBe(3);
    expect(run.clockvar.changes.map((c) => c.value)).toEqual([0, 1, 2, 3]);
  });

  it("the prefix form `##1 cb.din <= v` is illegal without a default clocking, but `cb.din <= ##1 v` is not", () => {
    const prefix = runClocking({ ...DEFAULT_SCENARIO, driveForm: "prefix", hasDefaultClocking: false });
    expect(prefix.driveError?.clause).toBe("§14.11");
    expect(prefix.drive).toBeNull();
    const intra = runClocking({ ...DEFAULT_SCENARIO, driveForm: "intra", hasDefaultClocking: false });
    expect(intra.driveError).toBeNull();
    expect(intra.drive?.matureEdge).toBe(3);
  });

  it("the prefix form blocks the process until edge 3 and then drives in edge 3's slot", () => {
    const run = runClocking({ ...DEFAULT_SCENARIO, driveForm: "prefix" });
    expect(run.driveBlocksUntilEdge).toBe(3);
    expect(run.drive?.at).toEqual({ time: 25, region: "reNba" });
    expect(run.drive?.capturedAtEdge).toBe(4);
  });

  it("generated code declares the skews chosen in the scenario", () => {
    const text = scenarioToSource({ ...DEFAULT_SCENARIO, inputSkew: { kind: "delay", units: 2 }, outputSkew: { kind: "delay", units: 1 } })
      .map((l) => l.text)
      .join("\n");
    expect(text).toContain("default clocking cb @(posedge clk);");
    expect(text).toContain("default input #2ns output #1ns;");
    expect(text).toContain("cb.din <= 8'hA5;");
  });
});
