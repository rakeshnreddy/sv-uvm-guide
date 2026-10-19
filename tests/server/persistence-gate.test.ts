import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type GateModule = typeof import("@/server/persistence-gate");

const CONFIGURED_ENV = Object.freeze({
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://learner:secret@db.example.test:5432/sv_uvm",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  NEXTAUTH_SECRET: "nextauth-secret-at-least-32-characters-long",
});

function withEnv(overrides: Record<string, string | undefined>): Record<string, string | undefined> {
  return { ...CONFIGURED_ENV, ...overrides };
}

async function loadGate(): Promise<GateModule> {
  return import("@/server/persistence-gate");
}

describe("isServerPersistenceConfigured", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/prisma");
    vi.doUnmock("@/lib/persistence/accounts");
    vi.unstubAllEnvs();
  });

  describe("through the explicit parameters", () => {
    it("is true only when accounts, a database, a provider and a secret are all present", async () => {
      const { isServerPersistenceConfigured } = await loadGate();

      expect(isServerPersistenceConfigured(CONFIGURED_ENV, true)).toBe(true);
    });

    it("is false whenever accounts are off, however complete the environment", async () => {
      const { isServerPersistenceConfigured } = await loadGate();

      expect(isServerPersistenceConfigured(CONFIGURED_ENV, false)).toBe(false);
    });

    it("needs DATABASE_URL", async () => {
      const { isServerPersistenceConfigured } = await loadGate();

      expect(isServerPersistenceConfigured(withEnv({ DATABASE_URL: undefined }), true)).toBe(false);
      expect(isServerPersistenceConfigured(withEnv({ DATABASE_URL: "" }), true)).toBe(false);
      expect(isServerPersistenceConfigured(withEnv({ DATABASE_URL: "   " }), true)).toBe(false);
    });

    it("needs both Google keys when the test identity is not available", async () => {
      const { isServerPersistenceConfigured } = await loadGate();

      expect(isServerPersistenceConfigured(withEnv({ GOOGLE_CLIENT_ID: undefined }), true)).toBe(false);
      expect(isServerPersistenceConfigured(withEnv({ GOOGLE_CLIENT_SECRET: "" }), true)).toBe(false);
      expect(
        isServerPersistenceConfigured(withEnv({ GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined }), true),
      ).toBe(false);
    });

    it("needs NEXTAUTH_SECRET or SESSION_SECRET", async () => {
      const { isServerPersistenceConfigured } = await loadGate();

      expect(isServerPersistenceConfigured(withEnv({ NEXTAUTH_SECRET: undefined }), true)).toBe(false);
      expect(
        isServerPersistenceConfigured(
          withEnv({ NEXTAUTH_SECRET: undefined, SESSION_SECRET: "session-secret-at-least-32-characters" }),
          true,
        ),
      ).toBe(true);
      expect(isServerPersistenceConfigured(withEnv({ NEXTAUTH_SECRET: "", SESSION_SECRET: "" }), true)).toBe(false);
    });

    it("accepts the token-gated test identity as a provider only outside production", async () => {
      const { hasSignInProvider, isServerPersistenceConfigured } = await loadGate();
      const testIdentity = { GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined, AUTH_TEST_MODE: "true" };

      expect(isServerPersistenceConfigured(withEnv({ ...testIdentity, NODE_ENV: "development" }), true)).toBe(true);
      expect(isServerPersistenceConfigured(withEnv({ ...testIdentity, NODE_ENV: "test" }), true)).toBe(true);
      expect(isServerPersistenceConfigured(withEnv({ ...testIdentity, NODE_ENV: "production" }), true)).toBe(false);
      expect(
        isServerPersistenceConfigured(withEnv({ ...testIdentity, NODE_ENV: "development", AUTH_TEST_MODE: "false" }), true),
      ).toBe(false);

      expect(hasSignInProvider(withEnv({ ...testIdentity, NODE_ENV: "production" }))).toBe(false);
      expect(hasSignInProvider(withEnv({ ...testIdentity, NODE_ENV: "development" }))).toBe(true);
    });

    it("keeps Google sign-in valid in production even with AUTH_TEST_MODE exported", async () => {
      const { isServerPersistenceConfigured } = await loadGate();

      expect(isServerPersistenceConfigured(withEnv({ AUTH_TEST_MODE: "true" }), true)).toBe(true);
    });
  });

  describe("with the default parameters", () => {
    it("reads process.env and the build-time ACCOUNTS_ENABLED switch, which is off by default", async () => {
      for (const [name, value] of Object.entries(CONFIGURED_ENV)) vi.stubEnv(name, value);
      const { isServerPersistenceConfigured } = await loadGate();

      expect(isServerPersistenceConfigured()).toBe(false);
      expect(isServerPersistenceConfigured(process.env)).toBe(false);
    });

    it("opens when ACCOUNTS_ENABLED is on and process.env is complete", async () => {
      for (const [name, value] of Object.entries(CONFIGURED_ENV)) vi.stubEnv(name, value);
      vi.doMock("@/lib/persistence/accounts", () => ({ ACCOUNTS_ENABLED: true, SERVER_SYNC_READY: false }));
      const { isServerPersistenceConfigured } = await loadGate();

      expect(isServerPersistenceConfigured()).toBe(true);

      vi.stubEnv("DATABASE_URL", "");
      expect(isServerPersistenceConfigured()).toBe(false);
    });
  });

  describe("module boundaries", () => {
    it("never imports '@/lib/auth' or '@/lib/prisma', even when the gate is open", async () => {
      const authFactory = vi.fn(() => ({ authOptions: {} }));
      const prismaFactory = vi.fn(() => ({ prisma: {}, getPrisma: () => ({}) }));
      vi.doMock("@/lib/auth", authFactory);
      vi.doMock("@/lib/prisma", prismaFactory);

      const { isServerPersistenceConfigured } = await loadGate();
      expect(isServerPersistenceConfigured(CONFIGURED_ENV, true)).toBe(true);
      expect(isServerPersistenceConfigured(CONFIGURED_ENV, false)).toBe(false);

      expect(authFactory).not.toHaveBeenCalled();
      expect(prismaFactory).not.toHaveBeenCalled();
    });

    it("loads under vitest's 'server-only' alias, while the marker module itself refuses client bundles", async () => {
      // Untyped modules: import them through variables so tsc does not resolve them.
      const alias = "server-only";
      const clientBuildOfMarker = "next/dist/compiled/server-only/index.js";

      await expect(import(/* @vite-ignore */ alias)).resolves.toBeDefined();
      await expect(import(/* @vite-ignore */ clientBuildOfMarker)).rejects.toThrow(
        /cannot be imported from a Client Component module/,
      );
    });
  });
});
