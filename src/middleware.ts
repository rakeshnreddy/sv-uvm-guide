import { NextResponse, type NextRequest } from "next/server";

import { canonicalLessonRedirect } from "@/lib/curriculum/canonical-redirect";

/**
 * Header-level 308s for non-canonical lesson URLs, on every request
 * (src/lib/curriculum/canonical-redirect.ts explains why the page's own
 * redirect is not enough under ISR). The legacy redirects in next.config.mjs
 * run before middleware, so this sees only URLs they did not match. Every
 * other request passes through unchanged.
 */
export function middleware(request: NextRequest) {
  const location = canonicalLessonRedirect(request.nextUrl.pathname, request.method);
  if (!location) return NextResponse.next();

  // Keep the query string; browsers keep the #fragment across a redirect by themselves.
  const url = request.nextUrl.clone();
  url.pathname = location;
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Lesson URLs only: the overview (/curriculum) and the rest of the site never run middleware.
  matcher: ["/curriculum/:path+"],
};
