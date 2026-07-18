import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listByCommit: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireSession: mocks.requireSession,
}));
vi.mock("@/server/reviews", () => ({
  ReviewAuthorizationError: class ReviewAuthorizationError extends Error {},
  authorizeRepositoryAccess: vi.fn(),
  reviewRepository: { create: vi.fn(), listByCommit: mocks.listByCommit },
}));

import { GET } from "@/app/api/reviews/route";

describe("GET /api/reviews", () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue({ user: { id: "reviewer-1" } });
    mocks.listByCommit.mockResolvedValue([
      { id: "review-2", createdAt: new Date("2026-07-18T10:00:00Z") },
      { id: "review-1", createdAt: new Date("2026-07-18T09:00:00Z") },
    ]);
  });

  it("uses deterministic cursor pagination within the authenticated user's scope", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/reviews?repository=local%2Fsv-uvm-guide&commitSha=abcdef1&limit=1",
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.listByCommit).toHaveBeenCalledWith({
      userId: "reviewer-1",
      repository: "local/sv-uvm-guide",
      commitSha: "abcdef1",
      cursor: undefined,
      limit: 1,
    });
    const payload = await response.json();
    expect(payload.reviews).toHaveLength(1);
    expect(payload.nextCursor).toBe("review-2");
  });
});
