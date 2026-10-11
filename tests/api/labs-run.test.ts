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
    labVersion: "2",
    stepId: "write-task",
    stepVersion: "1",
    files: [{ path: "work/tb_counter_unrefactored.sv", content }],
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
    const response = await POST(request(submission("task automatic drive_sequence(input byte start_value, input int unsigned repeat_count, input byte step = 8'h01);\n  @(posedge clk);\n  enable <= 1;\n  data <= start_value;\nendtask")));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      diagnostics: [],
      progress: { completedSteps: ["1"] },
    });
    expect(mocks.completeLabStep).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ id: "basics-1" }),
      "write-task",
      expect.objectContaining({ kind: "graded", graderId: "sv-basics-v2" }),
    );
  });

  it("does not accept expected syntax hidden in comments", async () => {
    const response = await POST(request(submission("/* task automatic drive_sequence(input byte start_value, input int unsigned repeat_count, input byte step = 8'h01);\n  @(posedge clk);\n  enable <= 1;\n  data <= start_value;\nendtask */")));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(false);
    expect(payload.hint).toContain("task automatic drive_sequence");
    expect(mocks.completeLabStep).not.toHaveBeenCalled();
  });

  it("requires authentication before grading", async () => {
    mocks.requireSession.mockRejectedValueOnce(new mocks.AuthenticationError());

    const response = await POST(request(submission("task automatic drive_sequence(input byte start_value, input int unsigned repeat_count, input byte step = 8'h01);\n  @(posedge clk);\n  enable <= 1;\n  data <= start_value;\nendtask")));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
  });
});
