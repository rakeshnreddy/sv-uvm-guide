// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { getMiddlewareMatchers } from "next/dist/build/analysis/get-page-static-info";
import { getMiddlewareRouteMatcher } from "next/dist/shared/lib/router/utils/middleware-route-matcher";
import { describe, expect, it } from "vitest";

import { curriculumRedirects } from "@/generated/curriculum-redirects.mjs";
import { curriculumData, toPrettyCurriculumSlug } from "@/lib/curriculum-data";
import { canonicalLessonRedirect } from "@/lib/curriculum/canonical-redirect";
import { resolveCurriculumRequest } from "@/lib/curriculum/lesson-urls";
import { config, middleware } from "@/middleware";

/**
 * The middleware's header-level 308s for non-canonical lesson URLs (NB1 lead
 * request 1): the decision function, the response it builds, and the matcher
 * as Next compiles it.
 */

const ORIGIN = "http://localhost:3000";
const F1A = "/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index";
const F1B = "/curriculum/T1_Foundational/F1B_The_Verification_Mindset/index";
const MAILBOXES = "/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes";

const lessons = curriculumData.flatMap((tier) =>
  tier.sections.flatMap((section) =>
    section.topics.map((topic) => ({
      segments: [tier.slug, section.slug, topic.slug],
      canonical: `/curriculum/${tier.slug}/${section.slug}/${topic.slug}`,
      isIndex: topic.slug === "index",
    })),
  ),
);

/** Static pages beside the lesson catch-all, for example /curriculum/expert-index, read from the App Router tree. */
function staticCurriculumPages(): string[] {
  const appRoot = path.join(process.cwd(), "src", "app");
  const pages: string[] = [];
  const walk = (dir: string, segments: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const isGroup = /^\(.+\)$/.test(entry.name);
      if (!isGroup && /^[[@_]/.test(entry.name)) continue; // dynamic, parallel and private segments
      const next = isGroup ? segments : [...segments, entry.name];
      const child = path.join(dir, entry.name);
      if (next[0] === "curriculum" && next.length > 1 && fs.existsSync(path.join(child, "page.tsx"))) {
        pages.push(`/${next.join("/")}`);
      }
      walk(child, next);
    }
  };
  walk(appRoot, []);
  return pages.sort();
}

function run(pathname: string, init?: { method?: string }) {
  return middleware(new NextRequest(new URL(pathname, ORIGIN), init));
}

describe("canonicalLessonRedirect (the middleware decision)", () => {
  it("lets every canonical lesson URL through", () => {
    for (const lesson of lessons) {
      expect(canonicalLessonRedirect(lesson.canonical), lesson.canonical).toBeNull();
    }
  });

  it("redirects every other form of every lesson to its canonical URL", () => {
    for (const lesson of lessons) {
      const pretty = `/curriculum/${lesson.segments.map(toPrettyCurriculumSlug).join("/")}`;
      const upper = `/curriculum/${lesson.segments.map((segment) => segment.toUpperCase()).join("/")}`;
      expect(canonicalLessonRedirect(pretty), pretty).toBe(lesson.canonical);
      expect(canonicalLessonRedirect(upper), upper).toBe(lesson.canonical);
      expect(canonicalLessonRedirect(`${lesson.canonical}/extra/segments`)).toBe(lesson.canonical);
      if (lesson.isIndex) {
        const moduleUrl = lesson.canonical.replace(/\/index$/, "");
        expect(canonicalLessonRedirect(moduleUrl), moduleUrl).toBe(lesson.canonical);
      }
    }
  });

  it("covers the acceptance URL forms: module, tier, pretty slug and extra segments", () => {
    expect(canonicalLessonRedirect("/curriculum/T1_Foundational/F1B_The_Verification_Mindset")).toBe(F1B);
    expect(canonicalLessonRedirect("/curriculum/T1_Foundational")).toBe(F1A);
    expect(canonicalLessonRedirect("/curriculum/t1-foundational/f1b-the-verification-mindset/index")).toBe(F1B);
    expect(canonicalLessonRedirect(`${F1A}/x/y`)).toBe(F1A);
    expect(canonicalLessonRedirect("/curriculum/t2-intermediate/i-sv-5-synchronization-and-ipc/mailboxes")).toBe(MAILBOXES);
  });

  it("decodes percent-encoded segments the way the page decodes its params", () => {
    expect(canonicalLessonRedirect("/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/ind%65x")).toBeNull();
    expect(canonicalLessonRedirect("/curriculum/t1%2Dfoundational")).toBe(F1A);
    expect(canonicalLessonRedirect("/curriculum/T1_Foundational/%E0%A4%A")).toBeNull();
  });

  it("agrees with the lesson page on every URL it decides", () => {
    const samples = [
      ...lessons.map((lesson) => lesson.canonical),
      ...lessons.map((lesson) => `/curriculum/${lesson.segments.map(toPrettyCurriculumSlug).join("/")}`),
      "/curriculum/T1_Foundational",
      "/curriculum/does-not-exist",
      "/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/no-such-lesson",
    ];
    for (const pathname of samples) {
      const page = resolveCurriculumRequest(pathname.replace(/^\/curriculum\//, "").split("/"));
      expect(canonicalLessonRedirect(pathname), pathname).toBe(page.kind === "redirect" ? page.location : null);
    }
  });

  it("leaves URLs that are not lessons to the page's 404", () => {
    expect(canonicalLessonRedirect("/curriculum/does-not-exist")).toBeNull();
    expect(canonicalLessonRedirect("/curriculum/T1_Foundational/Nope")).toBeNull();
    expect(canonicalLessonRedirect("/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/no-such-lesson")).toBeNull();
    expect(canonicalLessonRedirect("/curriculum/")).toBeNull();
  });

  it("never redirects the overview, the rest of the site or a static page under /curriculum", () => {
    expect(canonicalLessonRedirect("/curriculum")).toBeNull();
    expect(canonicalLessonRedirect("/practice")).toBeNull();
    expect(canonicalLessonRedirect("/T1_Foundational/F1A_The_Cost_of_Bugs")).toBeNull();
    const pages = staticCurriculumPages();
    expect(pages).toContain("/curriculum/expert-index");
    for (const page of pages) expect(canonicalLessonRedirect(page), page).toBeNull();
  });

  it("redirects GET and HEAD only", () => {
    expect(canonicalLessonRedirect("/curriculum/T1_Foundational", "HEAD")).toBe(F1A);
    expect(canonicalLessonRedirect("/curriculum/T1_Foundational", "get")).toBe(F1A);
    expect(canonicalLessonRedirect("/curriculum/T1_Foundational", "POST")).toBeNull();
    expect(canonicalLessonRedirect("/curriculum/T1_Foundational", "OPTIONS")).toBeNull();
  });

  it("is never a second hop after a legacy redirect: every destination is already canonical", () => {
    const destinations = curriculumRedirects.map((redirect) => redirect.destination).filter((destination) => !destination.includes(":"));
    expect(destinations.length).toBeGreaterThan(0);
    for (const destination of destinations) {
      expect(canonicalLessonRedirect(destination.split(/[?#]/)[0]), destination).toBeNull();
    }
  });
});

describe("middleware response", () => {
  it("answers a non-canonical lesson URL with a 308 and a Location header", () => {
    const response = run("/curriculum/t1-foundational/f1b-the-verification-mindset/index");
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`${ORIGIN}${F1B}`);
  });

  it("keeps the query string", () => {
    const response = run("/curriculum/T1_Foundational?from=newsletter&step=2");
    expect(response.status).toBe(308);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe(F1A);
    expect(location.search).toBe("?from=newsletter&step=2");
  });

  it("passes canonical lessons, unknown URLs, static pages and other methods through unchanged", () => {
    for (const pathname of [F1A, MAILBOXES, "/curriculum/does-not-exist", "/curriculum/expert-index"]) {
      const response = run(pathname);
      expect(response.headers.get("x-middleware-next"), pathname).toBe("1");
      expect(response.headers.get("location"), pathname).toBeNull();
    }
    const post = run("/curriculum/T1_Foundational", { method: "POST" });
    expect(post.headers.get("x-middleware-next")).toBe("1");
    expect(post.headers.get("location")).toBeNull();
  });
});

describe("middleware matcher, compiled the way next build compiles it", () => {
  const matches = getMiddlewareRouteMatcher(getMiddlewareMatchers(config.matcher, {} as never));
  const runsOn = (pathname: string) => matches(pathname, { headers: {} } as never, {});

  it("runs on every URL below /curriculum", () => {
    expect(runsOn(F1A)).toBe(true);
    expect(runsOn("/curriculum/T1_Foundational")).toBe(true);
    expect(runsOn("/curriculum/t1-foundational/f1b-the-verification-mindset/index/extra")).toBe(true);
    expect(runsOn("/curriculum/expert-index")).toBe(true);
  });

  it("never runs on the overview or anywhere else", () => {
    for (const pathname of ["/curriculum", "/", "/practice", "/practice/lab/basics-1", "/curriculumx/T1_Foundational", "/api/feature-flags"]) {
      expect(runsOn(pathname), pathname).toBe(false);
    }
  });
});
