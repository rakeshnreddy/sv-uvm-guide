import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireSession: vi.fn(),
  completeLabStep: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  AuthenticationError: mocks.AuthenticationError,
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/labs", () => ({
  LabStepCompletionError: class LabStepCompletionError extends Error {},
  completeLabStep: mocks.completeLabStep,
}));

import { POST } from "@/app/api/labs/run/route";

function submission(content: string) {
  return {
    labId: "basics-1",
    labVersion: "1",
    stepId: "1",
    stepVersion: "1",
    files: [{ path: "work/dut_counter.sv", content }],
  };
}

function request(body: unknown) {
  return new Request("http://localhost/api/labs/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/labs/run", () => {
  beforeEach(() => {
    mocks.requireSession.mockReset();
    mocks.requireSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.completeLabStep.mockReset();
    mocks.completeLabStep.mockResolvedValue({
      currentStepId: "2",
      completedSteps: ["1"],
      fileBuffers: {},
    });
  });

  it("runs a versioned manifest-owned grader for an authenticated learner", async () => {
    const response = await POST(request(submission("int myVar;")));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      diagnostics: [],
      progress: { completedSteps: ["1"] },
    });
    expect(mocks.completeLabStep).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ id: "basics-1" }),
      "1",
      expect.objectContaining({ kind: "graded", graderId: "sv-basics-v1" }),
    );
  });

  it("does not accept expected syntax hidden in comments", async () => {
    const response = await POST(request(submission("// int myVar;")));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(false);
    expect(payload.hint).toContain("Declare myVar as an int");
    expect(mocks.completeLabStep).not.toHaveBeenCalled();
  });

  it("requires authentication before grading", async () => {
    mocks.requireSession.mockRejectedValueOnce(new mocks.AuthenticationError());

    const response = await POST(request(submission("int myVar;")));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
  });
});
