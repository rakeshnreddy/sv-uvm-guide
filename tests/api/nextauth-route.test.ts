import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RouteModule = typeof import("@/app/api/auth/[...nextauth]/route");
type GateModule = typeof import("@/server/persistence-gate");

const mocks = vi.hoisted(() => ({
  configured: vi.fn<(...args: unknown[]) => boolean>(),
  nextAuthImported: vi.fn(),
  authImported: vi.fn(),
  NextAuth: vi.fn(),
  delegate: vi.fn(),
  authOptions: { providers: [], secret: "route-test-secret" },
}));

vi.mock("@/server/persistence-gate", () => ({
  isServerPersistenceConfigured: (...args: unknown[]) => mocks.configured(...args),
}));

// Registered afresh before every test (vi.doMock), so each factory runs again
// whenever the route really imports the module and the "never imported"
// assertions cannot pass on a module cached by an earlier test.
function mockLazyAuthModules() {
  vi.doMock("next-auth", () => {
    mocks.nextAuthImported();
    return { default: mocks.NextAuth };
  });
  vi.doMock("@/lib/auth", () => {
    mocks.authImported();
    return { authOptions: mocks.authOptions };
  });
}

async function loadRoute(): Promise<RouteModule> {
  return import("@/app/api/auth/[...nextauth]/route");
}

function authRequest(method: "GET" | "POST", path: string) {
  const segments = path.split("/").filter(Boolean);
  const request = new NextRequest(`http://127.0.0.1:3100/api/auth/${path}`, { method });
  return { request, context: { params: { nextauth: segments } } };
}

describe("/api/auth/[...nextauth]", () => {
  let actualGate: GateModule;

  beforeEach(async () => {
    vi.resetModules();
    actualGate = await vi.importActual<GateModule>("@/server/persistence-gate");
    mocks.configured.mockReset();
    mocks.configured.mockImplementation((...args) =>
      actualGate.isServerPersistenceConfigured(...(args as Parameters<GateModule["isServerPersistenceConfigured"]>)),
    );
    mocks.nextAuthImported.mockReset();
    mocks.authImported.mockReset();
    mocks.NextAuth.mockReset();
    mocks.delegate.mockReset();
    mocks.NextAuth.mockReturnValue(mocks.delegate);
    mocks.delegate.mockResolvedValue(new Response("delegated", { status: 200 }));
    mockLazyAuthModules();
  });

  afterEach(() => {
    vi.doUnmock("next-auth");
    vi.doUnmock("@/lib/auth");
    vi.unstubAllEnvs();
  });

  it("is force-dynamic and imports neither next-auth nor '@/lib/auth' at module load", async () => {
    const route = await loadRoute();

    expect(route.dynamic).toBe("force-dynamic");
    expect(route.GET).toBe(route.POST);
    expect(mocks.nextAuthImported).not.toHaveBeenCalled();
    expect(mocks.authImported).not.toHaveBeenCalled();
  });

  describe("when the gate is not configured", () => {
    beforeEach(() => {
      mocks.configured.mockReturnValue(false);
    });

    it("answers GET /api/auth/signin with 404 ACCOUNTS_DISABLED", async () => {
      const { GET } = await loadRoute();
      const { request, context } = authRequest("GET", "signin");

      const response = await GET(request, context);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "ACCOUNTS_DISABLED" });
    });

    it("answers GET /api/auth/session with 200 {} that is never cached", async () => {
      const { GET } = await loadRoute();
      const { request, context } = authRequest("GET", "session");

      const response = await GET(request, context);

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({});
    });

    it("answers POST /api/auth/_log with an empty 204", async () => {
      const { POST } = await loadRoute();
      const { request, context } = authRequest("POST", "_log");

      const response = await POST(request, context);

      expect(response.status).toBe(204);
      await expect(response.text()).resolves.toBe("");
    });

    it.each([
      ["POST", "callback/x"],
      ["POST", "callback/test-credentials"],
      ["POST", "signin/google"],
      ["POST", "signout"],
      ["POST", "session"],
      ["GET", "csrf"],
      ["GET", "providers"],
      ["GET", "callback/google"],
      ["GET", "_log"],
    ] as const)("answers %s /api/auth/%s with 404 ACCOUNTS_DISABLED", async (method, path) => {
      const route = await loadRoute();
      const { request, context } = authRequest(method, path);

      const response = await route[method](request, context);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "ACCOUNTS_DISABLED" });
    });

    it("reads the action from the URL when the route params are missing", async () => {
      const { GET } = await loadRoute();
      const request = new NextRequest("http://127.0.0.1:3100/api/auth/session", { method: "GET" });

      const response = await GET(request, { params: {} });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({});
    });

    it("never imports next-auth or '@/lib/auth' while answering", async () => {
      const route = await loadRoute();
      for (const [method, path] of [["GET", "session"], ["GET", "signin"], ["POST", "_log"], ["POST", "callback/x"]] as const) {
        const { request, context } = authRequest(method, path);
        await route[method](request, context);
      }

      expect(mocks.nextAuthImported).not.toHaveBeenCalled();
      expect(mocks.authImported).not.toHaveBeenCalled();
      expect(mocks.NextAuth).not.toHaveBeenCalled();
    });
  });

  describe("with the real gate and the default build flags (accounts off)", () => {
    it("stays closed even when the runtime env has a database, a provider and a secret", async () => {
      vi.stubEnv("DATABASE_URL", "postgresql://learner:secret@db.example.test:5432/sv_uvm");
      vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
      vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret");
      vi.stubEnv("NEXTAUTH_SECRET", "nextauth-secret-at-least-32-characters-long");
      const { GET } = await loadRoute();
      const signin = authRequest("GET", "signin");
      const session = authRequest("GET", "session");

      const signinResponse = await GET(signin.request, signin.context);
      const sessionResponse = await GET(session.request, session.context);

      expect(signinResponse.status).toBe(404);
      expect(sessionResponse.status).toBe(200);
      expect(mocks.configured).toHaveBeenCalled();
      expect(mocks.authImported).not.toHaveBeenCalled();
    });
  });

  describe("when the gate is configured", () => {
    beforeEach(() => {
      mocks.configured.mockReturnValue(true);
    });

    it("delegates a GET once to NextAuth(authOptions) with the request and route context", async () => {
      const { GET } = await loadRoute();
      const { request, context } = authRequest("GET", "signin");

      const response = await GET(request, context);

      expect(mocks.NextAuth).toHaveBeenCalledTimes(1);
      expect(mocks.NextAuth).toHaveBeenCalledWith(mocks.authOptions);
      expect(mocks.delegate).toHaveBeenCalledTimes(1);
      expect(mocks.delegate).toHaveBeenCalledWith(request, context);
      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe("delegated");
    });

    it("delegates POST callbacks and the session read instead of answering them itself", async () => {
      const { GET, POST } = await loadRoute();
      const callback = authRequest("POST", "callback/test-credentials");
      const session = authRequest("GET", "session");

      await POST(callback.request, callback.context);
      await GET(session.request, session.context);

      expect(mocks.delegate).toHaveBeenNthCalledWith(1, callback.request, callback.context);
      expect(mocks.delegate).toHaveBeenNthCalledWith(2, session.request, session.context);
      expect(mocks.NextAuth).toHaveBeenCalledWith(mocks.authOptions);
      expect(mocks.authImported).toHaveBeenCalledTimes(1);
    });
  });
});
