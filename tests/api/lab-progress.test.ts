import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  AuthenticationError: class AuthenticationError extends Error {},
  LabStepCompletionError: class LabStepCompletionError extends Error {},
  requireSession: vi.fn(),
  getLabProgress: vi.fn(),
  saveLabWorkspace: vi.fn(),
  completeLabStep: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  AuthenticationError: mocks.AuthenticationError,
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/labs", () => ({
  LabStepCompletionError: mocks.LabStepCompletionError,
  getLabProgress: mocks.getLabProgress,
  saveLabWorkspace: mocks.saveLabWorkspace,
  completeLabStep: mocks.completeLabStep,
}));

import { PATCH, POST } from "@/app/api/me/labs/[labId]/progress/route";

const context = { params: { labId: "axi-deadlock-hunt-lab" } };

function request(method: string, body: unknown) {
  return new Request("http://localhost/api/me/labs/axi-deadlock-hunt-lab/progress", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("lab progress authority", () => {
  beforeEach(() => {
    mocks.requireSession.mockReset();
    mocks.requireSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.saveLabWorkspace.mockReset();
    mocks.completeLabStep.mockReset();
    mocks.completeLabStep.mockResolvedValue({
      currentStepId: "2",
      completedSteps: ["1"],
      fileBuffers: {},
    });
  });

  it("rejects a browser-supplied completedSteps list", async () => {
    const response = await PATCH(request("PATCH", {
      labVersion: "1",
      currentStepId: "1",
      completedSteps: ["1", "2", "3"],
      fileBuffers: {},
    }), context);

    expect(response.status).toBe(400);
    expect(mocks.saveLabWorkspace).not.toHaveBeenCalled();
  });

  it("records an explicitly self-attested manifest step on the server", async () => {
    const response = await POST(request("POST", {
      labVersion: "1",
      stepId: "1",
      stepVersion: "1",
      completion: "self_attested",
    }), context);

    expect(response.status).toBe(200);
    expect(mocks.completeLabStep).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ id: "axi-deadlock-hunt-lab" }),
      "1",
      { kind: "self_attested" },
    );
  });

  it("does not let the manual endpoint complete a graded step", async () => {
    const response = await POST(request("POST", {
      labVersion: "1",
      stepId: "1",
      stepVersion: "1",
      completion: "self_attested",
    }), { params: { labId: "basics-1" } });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "LAB_STEP_REQUIRES_GRADER" });
    expect(mocks.completeLabStep).not.toHaveBeenCalled();
  });
});
