import { describe, expect, it } from "vitest";

import { evaluatePhaseOrder, movePhase, shuffleArray, uvmPhases } from "../../src/components/exercises/UvmPhaseSorterExercise";

const lane = (name: "common" | "schedule") => uvmPhases.filter((p) => p.lane === name);

describe("UvmPhaseSorterExercise helpers", () => {
  it("keeps run_phase in the common lane and the 12 runtime phases in their own lane", () => {
    expect(lane("common").map((p) => p.id)).toEqual(["build", "connect", "end_of_elaboration", "start_of_simulation", "run", "extract", "check", "report", "final"]);
    expect(lane("schedule")).toHaveLength(12);
    expect(lane("schedule")[0].id).toBe("pre_reset");
  });

  it("moves phases to new positions", () => {
    const moved = movePhase(lane("common"), "final", "build");
    expect(moved[0].id).toBe("final");
    expect(moved[1].id).toBe("build");
  });

  it("evaluates whether a lane is sorted", () => {
    expect(evaluatePhaseOrder(lane("schedule"))).toBe(true);
    expect(evaluatePhaseOrder(movePhase(lane("schedule"), "post_shutdown", "pre_reset"))).toBe(false);
  });

  it("shuffles deterministically and never returns the solved order", () => {
    expect(shuffleArray(lane("common"), 4)).toEqual(shuffleArray(lane("common"), 4));
    expect(evaluatePhaseOrder(shuffleArray(lane("common"), 4))).toBe(false);
  });
});
