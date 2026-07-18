import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSession, enqueue } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireSession,
}));

vi.mock("@/server/simulation", async () => {
  const actual = await vi.importActual<typeof import("@/server/simulation")>("@/server/simulation");
  return {
    ...actual,
    simulationJobs: { enqueue },
  };
});

import { POST } from "@/app/api/simulate/route";

describe("POST /api/simulate", () => {
  beforeEach(() => {
    requireSession.mockReset();
    enqueue.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    const { AuthenticationError } = await import("@/lib/auth");
    requireSession.mockRejectedValue(new AuthenticationError());

    const response = await POST(
      new Request("http://localhost/api/simulate", {
        method: "POST",
        body: JSON.stringify({
          backend: "icarus",
          files: [{ path: "top.sv", content: "module top; endmodule" }],
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
  });

  it("enqueues a validated job and returns 202", async () => {
    requireSession.mockResolvedValue({ user: { id: "user-1" } });
    enqueue.mockResolvedValue({ id: "job-1", status: "queued" });

    const response = await POST(
      new Request("http://localhost/api/simulate", {
        method: "POST",
        body: JSON.stringify({
          backend: "verilator",
          files: [{ path: "top.sv", content: "module top; endmodule" }],
        }),
      }),
    );

    expect(response.status).toBe(202);
    expect(enqueue).toHaveBeenCalledWith("user-1", {
      backend: "verilator",
      files: [{ path: "top.sv", content: "module top; endmodule" }],
    });
    await expect(response.json()).resolves.toEqual({ jobId: "job-1", status: "queued" });
  });

  it("rejects untrusted backend identifiers", async () => {
    requireSession.mockResolvedValue({ user: { id: "user-1" } });
    const response = await POST(
      new Request("http://localhost/api/simulate", {
        method: "POST",
        body: JSON.stringify({
          backend: "bash",
          files: [{ path: "top.sv", content: "module top; endmodule" }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
