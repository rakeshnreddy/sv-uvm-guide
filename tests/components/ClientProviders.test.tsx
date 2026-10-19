import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ClientProvidersModule = typeof import("@/components/providers/ClientProviders");

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  useSession: vi.fn(),
}));

function stubMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function authRequests(): string[] {
  return mocks.fetch.mock.calls
    .map(([input]) => (typeof input === "string" ? input : input instanceof URL ? input.href : String(input?.url ?? input)))
    .filter((url) => url.includes("/api/auth"));
}

/** What a learner does that makes next-auth's SessionProvider refetch: return to the tab, focus the window. */
async function returnToTab() {
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function renderProviders(module: ClientProvidersModule) {
  const { default: ClientProviders } = module;
  await act(async () => {
    render(
      <ClientProviders>
        <p>Lesson content</p>
      </ClientProviders>,
    );
  });
}

describe("ClientProviders", () => {
  beforeEach(() => {
    vi.resetModules();
    stubMatchMedia();
    mocks.fetch.mockReset();
    mocks.fetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "{}",
    }));
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.useSession.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.doUnmock("@/lib/persistence/accounts");
    vi.doUnmock("next-auth/react");
    vi.unstubAllGlobals();
  });

  describe("with accounts off (the default build flags)", () => {
    it("renders children and never requests /api/auth/session, on mount or when the learner returns to the tab", async () => {
      await renderProviders(await import("@/components/providers/ClientProviders"));

      expect(screen.getByText("Lesson content")).toBeInTheDocument();
      await returnToTab();
      await returnToTab();

      expect(authRequests()).toEqual([]);
    });
  });

  describe("with accounts on", () => {
    it("mounts SessionProvider around the children", async () => {
      vi.doMock("@/lib/persistence/accounts", () => ({ ACCOUNTS_ENABLED: true, SERVER_SYNC_READY: false }));
      vi.doMock("next-auth/react", () => ({
        SessionProvider: ({ children }: { children: React.ReactNode }) => (
          <div data-testid="session-provider">{children}</div>
        ),
        useSession: mocks.useSession,
        signOut: vi.fn(),
      }));

      await renderProviders(await import("@/components/providers/ClientProviders"));

      const provider = screen.getByTestId("session-provider");
      expect(provider).toContainElement(screen.getByText("Lesson content"));
    });

    it("lets the real SessionProvider request the session, which the accounts-off build avoids", async () => {
      vi.doMock("@/lib/persistence/accounts", () => ({ ACCOUNTS_ENABLED: true, SERVER_SYNC_READY: false }));

      await renderProviders(await import("@/components/providers/ClientProviders"));

      expect(screen.getByText("Lesson content")).toBeInTheDocument();
      await waitFor(() => expect(authRequests()).toContainEqual(expect.stringContaining("/api/auth/session")));
    });
  });
});
