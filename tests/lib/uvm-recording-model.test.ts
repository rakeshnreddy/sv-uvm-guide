import { describe, expect, it } from "vitest";

import { recordingPredictionOptions, runRecording } from "@/lib/uvm-recording-model";

describe("uvm-recording-model (uvm_component.svh m_begin_tr / end_tr)", () => {
  it("recording is off by default: begin_tr returns 0 and the stream is empty", () => {
    const run = runRecording({ enable: "default", impl: "do_record", callEndTr: true });
    expect(run.enabled).toBe(false);
    expect(run.beginTrHandles).toEqual([0, 0, 0]);
    expect(run.transactions).toEqual([]);
  });

  it("set_recording_enabled(1) (IEEE 1800.2 13.1.6.13) records closed transactions with attributes", () => {
    const run = runRecording({ enable: "set_recording_enabled", impl: "do_record", callEndTr: true });
    expect(run.beginTrHandles.every((h) => h > 0)).toBe(true);
    expect(run.transactions.map((t) => [t.begin, t.end])).toEqual([
      [0, 20],
      [20, 40],
      [40, 60],
    ]);
  });

  it("attributes are recorded at end_tr, so the READ's rdata (filled during drive) is in the stream", () => {
    const run = runRecording({ enable: "set_recording_enabled", impl: "field-macros", callEndTr: true });
    expect(run.transactions[1].attributes).toContainEqual(["rdata", "'h3c"]);
  });

  it("recording_detail set before build enables; set in run_phase is never read", () => {
    expect(runRecording({ enable: "config-before-build", impl: "do_record", callEndTr: true }).enabled).toBe(true);
    expect(runRecording({ enable: "config-in-run-phase", impl: "do_record", callEndTr: true }).enabled).toBe(false);
  });

  it("without end_tr transactions stay open and no attributes are recorded", () => {
    const run = runRecording({ enable: "set_recording_enabled", impl: "do_record", callEndTr: false });
    expect(run.transactions.every((t) => t.end === null && t.attributes.length === 0)).toBe(true);
  });

  it("without field macros or do_record the transactions have no attributes", () => {
    const run = runRecording({ enable: "set_recording_enabled", impl: "none", callEndTr: true });
    expect(run.transactions).toHaveLength(3);
    expect(run.transactions.every((t) => t.attributes.length === 0)).toBe(true);
  });

  it("exactly one prediction option matches the model", () => {
    for (const enable of ["default", "set_recording_enabled", "config-in-run-phase"] as const) {
      for (const impl of ["none", "do_record"] as const) {
        for (const callEndTr of [true, false]) {
          const opts = recordingPredictionOptions({ enable, impl, callEndTr });
          expect(opts.filter((o) => o.correct)).toHaveLength(1);
        }
      }
    }
    expect(recordingPredictionOptions({ enable: "default", impl: "do_record", callEndTr: true }).find((o) => o.correct)?.id).toBe("empty");
  });
});
