import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireSession: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  AuthenticationError: mocks.AuthenticationError,
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({ assessmentAttempt: { create: mocks.create } }),
}));

import { POST } from "@/app/api/me/assessments/route";
import { assessmentQuestionBanks } from "@/server/assessment-question-bank";

function request(body: unknown) {
  return new Request("http://localhost/api/me/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/me/assessments", () => {
  const bank = assessmentQuestionBanks["adaptive-test"];
  const responses = bank.questions.map((question) => ({
    questionId: question.id,
    optionId: question.correctOptionId,
  }));

  beforeEach(() => {
    mocks.requireSession.mockReset();
    mocks.requireSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.create.mockReset();
    mocks.create.mockResolvedValue({ id: "attempt-1", score: 1, completedAt: new Date() });
  });

  it("stores server-calculated correctness and score", async () => {
    const response = await POST(request({
      assessmentId: "adaptive-test",
      assessmentVersion: bank.assessmentVersion,
      scoringVersion: bank.scoringVersion,
      responses,
    }));

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        score: 1,
        responses: { create: expect.arrayContaining([
          expect.objectContaining({ questionId: "1", isCorrect: true, score: 1 }),
        ]) },
      }),
    }));
  });

  it("rejects browser-authored correctness booleans", async () => {
    const response = await POST(request({
      assessmentId: "adaptive-test",
      assessmentVersion: bank.assessmentVersion,
      scoringVersion: bank.scoringVersion,
      responses: responses.map((item) => ({ ...item, isCorrect: true })),
    }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
