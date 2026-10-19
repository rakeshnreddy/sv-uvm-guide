import { NextResponse, type NextRequest } from "next/server";

import { isServerPersistenceConfigured } from "@/server/persistence-gate";

/**
 * NextAuth's catch-all route, behind the persistence gate.
 *
 * next-auth and src/lib/auth.ts are imported lazily inside the handler, so a
 * deploy without accounts never evaluates them here, and the placeholder
 * sign-in page is gone. When isServerPersistenceConfigured() is false:
 * - GET /api/auth/session answers 200 {} (signed out, never cached), so a
 *   half-configured deploy that still mounts SessionProvider gets a quiet
 *   "signed out" instead of an error on every page mount and tab focus;
 * - POST /api/auth/_log (next-auth's client error log) answers 204;
 * - every other path and method answers 404 {error: "ACCOUNTS_DISABLED"}.
 *
 * Dynamic on purpose: the gate reads the runtime environment on each request.
 */
export const dynamic = "force-dynamic";

type RouteContext = { params: { nextauth?: string[] } };

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** The first path segment after /api/auth/, e.g. "session", "signin" or "callback". */
function authAction(request: NextRequest, context: RouteContext | undefined): string | undefined {
  const fromParams = context?.params?.nextauth?.[0];
  if (fromParams) return fromParams;
  const match = /\/api\/auth\/([^/?#]+)/.exec(request.nextUrl.pathname);
  return match?.[1];
}

function accountsDisabledResponse(request: NextRequest, context: RouteContext | undefined): NextResponse {
  const action = authAction(request, context);

  if (request.method === "GET" && action === "session") {
    return NextResponse.json({}, { status: 200, headers: NO_STORE });
  }
  if (request.method === "POST" && action === "_log") {
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  }
  return NextResponse.json({ error: "ACCOUNTS_DISABLED" }, { status: 404, headers: NO_STORE });
}

async function handler(request: NextRequest, context: RouteContext): Promise<Response> {
  if (!isServerPersistenceConfigured()) {
    return accountsDisabledResponse(request, context);
  }

  const [{ default: NextAuth }, { authOptions }] = await Promise.all([
    import("next-auth"),
    import("@/lib/auth"),
  ]);
  return NextAuth(authOptions)(request, context);
}

export { handler as GET, handler as POST };
