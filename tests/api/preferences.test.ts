import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/notifications";
import { cloneNotificationPreferences } from "@/lib/user-preferences";

const mocks = vi.hoisted(() => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireSession: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  AuthenticationError: mocks.AuthenticationError,
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

import { GET, PATCH } from "@/app/api/me/preferences/route";

describe("/api/me/preferences", () => {
  beforeEach(() => {
    mocks.requireSession.mockReset();
    mocks.userFindUnique.mockReset();
    mocks.userUpdate.mockReset();
    mocks.requireSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns normalized persisted preferences for the authenticated user", async () => {
    mocks.userFindUnique.mockResolvedValue({
      preferences: {
        theme: "light",
        notifications: { channels: { email: false } },
      },
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { preferences: true },
    });
    expect(payload.preferences.theme).toBe("light");
    expect(payload.preferences.notifications.channels.email).toBe(false);
    expect(payload.preferences.notifications.channels.inApp).toBe(true);
  });

  it("merges and persists a validated partial update", async () => {
    const basePreferences = {
      theme: "dark" as const,
      shareTelemetry: true,
      notifications: cloneNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES),
      motivationalProfile: null,
    };
    mocks.userFindUnique.mockResolvedValue({ preferences: basePreferences });
    mocks.userUpdate.mockResolvedValue({});

    const response = await PATCH(new Request("http://localhost/api/me/preferences", {
      method: "PATCH",
      body: JSON.stringify({
        preferences: {
          theme: "light",
          notifications: { channels: { email: false }, quietHours: null },
        },
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "user-1" },
    }));
    expect(payload.preferences.theme).toBe("light");
    expect(payload.preferences.notifications.channels.email).toBe(false);
    expect(payload.preferences.notifications.channels.inApp).toBe(true);
    expect(payload.preferences.notifications.quietHours).toBeUndefined();
  });

  it("rejects unauthenticated requests", async () => {
    mocks.requireSession.mockRejectedValueOnce(new mocks.AuthenticationError());

    const response = await GET();

    expect(response.status).toBe(401);
  });
});
