import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireSession: mocks.requireSession,
}));
vi.mock("@/server/reviews", () => ({
  ReviewAuthorizationError: class ReviewAuthorizationError extends Error {},
  authorizeRepositoryAccess: vi.fn(),
  reviewRepository: { create: mocks.create, listByCommit: vi.fn() },
}));

import { POST } from "@/app/api/reviews/route";

describe("POST /api/reviews", () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue({ user: { id: "reviewer-1" } });
    mocks.create.mockResolvedValue({ id: "review-1" });
  });

  it("creates an authenticated, repository-scoped review", async () => {
    const response = await POST(
      new Request("http://localhost/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          repository: "local/sv-uvm-guide",
          commitSha: "abcdef1",
          comment: "good",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({
      userId: "reviewer-1",
      repository: "local/sv-uvm-guide",
      commitSha: "abcdef1",
      comment: "good",
      approved: undefined,
    });
  });

  it("rejects requests without repository or commit SHA", async () => {
    const response = await POST(
      new Request("http://localhost/api/reviews", {
        method: "POST",
        body: JSON.stringify({ comment: "bad" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
