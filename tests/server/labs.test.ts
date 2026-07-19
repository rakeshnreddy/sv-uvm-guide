import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    labAttempt: {
      findFirst: mocks.findFirst,
      update: mocks.update,
      create: mocks.create,
    },
  }),
}));

import { getLabById } from "@/lib/lab-registry";
import {
  completeLabStep,
  LabStepCompletionError,
  saveLabWorkspace,
} from "@/server/labs";

describe("server-authoritative lab progress", () => {
  const lab = getLabById("axi-deadlock-hunt-lab")!;

  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.update.mockReset();
    mocks.create.mockReset();
  });

  it("does not let workspace autosave mutate completion state", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "attempt-1" });
    mocks.update.mockResolvedValueOnce({
      currentStepId: "2",
      completedSteps: ["1"],
      workspace: { "axi_deadlock_checker.sv": "learner code" },
    });

    await saveLabWorkspace("user-1", lab, {
      currentStepId: "2",
      fileBuffers: { "axi_deadlock_checker.sv": "learner code" },
    });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: {
        currentStepId: "2",
        workspace: { "axi_deadlock_checker.sv": "learner code" },
      },
    });
  });

  it("requires prior server-recorded steps before completing a later step", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: "attempt-1",
      completedSteps: [],
      stepEvidence: {},
    });

    await expect(completeLabStep("user-1", lab, "2", { kind: "self_attested" }))
      .rejects.toMatchObject({ code: "LAB_PREVIOUS_STEP_INCOMPLETE" } satisfies Partial<LabStepCompletionError>);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("records self-attestation evidence and only completes after every step", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: "attempt-1",
      currentStepId: "3",
      completedSteps: ["1", "2"],
      workspace: {},
      stepEvidence: {
        "1": { kind: "self_attested" },
        "2": { kind: "self_attested" },
      },
    });
    mocks.update.mockImplementationOnce(({ data }) => Promise.resolve({
      ...data,
      workspace: {},
    }));

    const progress = await completeLabStep("user-1", lab, "3", { kind: "self_attested" });

    expect(progress.completedSteps).toEqual(["1", "2", "3"]);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "COMPLETED",
        stepEvidence: expect.objectContaining({
          "3": expect.objectContaining({ kind: "self_attested", stepVersion: "1" }),
        }),
      }),
    }));
  });
});
