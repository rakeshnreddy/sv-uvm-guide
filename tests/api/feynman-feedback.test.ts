import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  evaluate: vi.fn(),
  enforceRateLimit: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireSession: mocks.requireSession,
}));
vi.mock("@/server/ai", () => ({
  AiConfigurationError: class AiConfigurationError extends Error {},
  aiTutor: { evaluateFeynmanExplanation: mocks.evaluate },
}));
vi.mock("@/server/ai/rate-limit", () => ({
  AiRateLimitError: class AiRateLimitError extends Error { retryAfterSeconds = 60; },
  enforceAiRateLimit: mocks.enforceRateLimit,
}));

import { POST } from "@/app/api/ai/feynman-feedback/route";

describe("POST /api/ai/feynman-feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.evaluate.mockResolvedValue({
      score: 84,
      feedback: "Clear explanation; add the phase lifecycle.",
      missingConcepts: ["phase lifecycle"],
    });
  });

  it("returns the structured evaluation", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/feynman-feedback", {
        method: "POST",
        body: JSON.stringify({ content: "A UVM component is part of a persistent testbench hierarchy." }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      score: 84,
      feedback: "Clear explanation; add the phase lifecycle.",
      missingConcepts: ["phase lifecycle"],
    });
  });

  it("rejects short content before provider construction", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/feynman-feedback", {
        method: "POST",
        body: JSON.stringify({ content: "too short" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.evaluate).not.toHaveBeenCalled();
  });
});
