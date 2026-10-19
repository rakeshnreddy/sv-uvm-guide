import React from "react";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AuthModule = typeof import("@/contexts/AuthContext");

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

function sessionValue(status: "loading" | "authenticated" | "unauthenticated", user?: { id?: string; name?: string | null }) {
  return {
    status,
    data: status === "authenticated" ? { user: { id: "learner-1", name: "Ada", ...user }, expires: "2099-01-01" } : null,
    update: vi.fn(),
  };
}

async function importWithAccounts(): Promise<AuthModule> {
  vi.doMock("@/lib/persistence/accounts", () => ({ ACCOUNTS_ENABLED: true, SERVER_SYNC_READY: false }));
  vi.doMock("next-auth/react", () => ({ useSession: mocks.useSession, signOut: mocks.signOut }));
  return import("@/contexts/AuthContext");
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.useSession.mockReset();
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.doUnmock("@/lib/persistence/accounts");
    vi.doUnmock("next-auth/react");
  });

  describe("with accounts off (the default build flags)", () => {
    it("returns a signed-out user without any provider, using the real next-auth module", async () => {
      // The real useSession throws outside a SessionProvider, so this only
      // passes if the anonymous branch never calls it.
      const { useAuth } = await import("@/contexts/AuthContext");

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      await expect(result.current.signOut()).resolves.toBeUndefined();
    });

    it("returns the same frozen object on every render and never calls useSession", async () => {
      vi.doMock("next-auth/react", () => ({ useSession: mocks.useSession, signOut: mocks.signOut }));
      const { useAuth } = await import("@/contexts/AuthContext");

      const { result, rerender } = renderHook(() => useAuth());
      const first = result.current;
      rerender();
      rerender();

      expect(result.current).toBe(first);
      expect(Object.isFrozen(first)).toBe(true);
      await first.signOut();
      expect(mocks.useSession).not.toHaveBeenCalled();
      expect(mocks.signOut).not.toHaveBeenCalled();
    });

    it("keeps AuthProvider a pass-through", async () => {
      const { AuthProvider } = await import("@/contexts/AuthContext");

      render(
        <AuthProvider>
          <p>Lesson content</p>
        </AuthProvider>,
      );

      expect(screen.getByText("Lesson content")).toBeInTheDocument();
    });
  });

  describe("with accounts on", () => {
    it("maps the signed-in session user", async () => {
      mocks.useSession.mockReturnValue(sessionValue("authenticated", { id: "learner-42", name: "Grace" }));
      const { useAuth } = await importWithAccounts();

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toEqual({ uid: "learner-42", isAnonymous: false, displayName: "Grace" });
      expect(result.current.loading).toBe(false);
      expect(mocks.useSession).toHaveBeenCalled();
    });

    it("keeps the user and the value stable while the session does not change", async () => {
      mocks.useSession.mockReturnValue(sessionValue("authenticated", { id: "learner-7" }));
      const { useAuth } = await importWithAccounts();

      const { result, rerender } = renderHook(() => useAuth());
      const first = result.current;
      // next-auth hands out a new session object on each refetch.
      mocks.useSession.mockReturnValue(sessionValue("authenticated", { id: "learner-7" }));
      rerender();

      expect(result.current).toBe(first);
      expect(result.current.user).toBe(first.user);
      expect(result.current.signOut).toBe(first.signOut);
    });

    it("reports loading with no user while the session loads, then the user", async () => {
      mocks.useSession.mockReturnValue(sessionValue("loading"));
      const { useAuth } = await importWithAccounts();

      const { result, rerender } = renderHook(() => useAuth());
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(true);

      mocks.useSession.mockReturnValue(sessionValue("authenticated"));
      rerender();
      expect(result.current.user).toEqual({ uid: "learner-1", isAnonymous: false, displayName: "Ada" });
      expect(result.current.loading).toBe(false);
    });

    it("treats a signed-out session, or one without a user id, as no user", async () => {
      mocks.useSession.mockReturnValue(sessionValue("unauthenticated"));
      const { useAuth } = await importWithAccounts();

      const { result, rerender } = renderHook(() => useAuth());
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);

      mocks.useSession.mockReturnValue({ status: "authenticated", data: { user: { name: "No id" } }, update: vi.fn() });
      rerender();
      expect(result.current.user).toBeNull();
    });

    it("signs out without a redirect", async () => {
      mocks.useSession.mockReturnValue(sessionValue("authenticated"));
      const { useAuth } = await importWithAccounts();

      const { result } = renderHook(() => useAuth());
      await result.current.signOut();

      expect(mocks.signOut).toHaveBeenCalledTimes(1);
      expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false });
    });
  });
});
