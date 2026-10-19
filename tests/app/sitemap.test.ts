import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap, { PUBLIC_PAGES, labPaths, lessonPaths, practicePaths } from "@/app/sitemap";
import { normalizeSlug } from "@/lib/curriculum-data";
import { getAllLabs } from "@/lib/lab-registry";
import { PRACTICE_PAGES } from "@/lib/practice-links";

const APP_DIR = path.resolve(__dirname, "../../src/app");
const LEARNING_DIR = path.join(APP_DIR, "(learning)");

/** Pages hidden behind a switch: they answer 404 by default and stay out of the sitemap. */
const HIDDEN_PAGES = ["/notifications", "/resources", "/projects", "/history", "/knowledge-hub", "/assessment", "/community"];

/** Static child routes of a folder under (learning), for example /exercises/<name>. */
function childRoutes(segments: string[], skip: string[] = []): string[] {
  const dir = path.join(LEARNING_DIR, ...segments);
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !skip.includes(entry.name) && !/^[[(]/.test(entry.name))
    .filter((entry) => fs.existsSync(path.join(dir, entry.name, "page.tsx")))
    .map((entry) => `/${[...segments, entry.name].join("/")}`);
}

/** The page.tsx for a static route, looking inside route groups such as (learning). */
function pageFileFor(route: string): string | undefined {
  const segments = route.split("/").filter(Boolean);
  const search = (dir: string, rest: string[]): string | undefined => {
    if (rest.length === 0) {
      const file = path.join(dir, "page.tsx");
      if (fs.existsSync(file)) return file;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (/^\(.*\)$/.test(entry.name)) {
        const found = search(path.join(dir, entry.name), rest);
        if (found) return found;
      } else if (rest.length > 0 && entry.name === rest[0]) {
        const found = search(path.join(dir, entry.name), rest.slice(1));
        if (found) return found;
      }
    }
    return undefined;
  };
  return search(APP_DIR, segments);
}

describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  it("lists absolute, unique URLs", () => {
    for (const url of urls) expect(url).toMatch(/^https?:\/\/[^/]+(\/|$)/);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("lists every lesson at its canonical URL", () => {
    const lessons = lessonPaths();
    expect(lessons.length).toBeGreaterThan(100);
    for (const lesson of lessons) {
      const slug = lesson.replace(/^\/curriculum\//, "").split("/").map(decodeURIComponent);
      expect(normalizeSlug(slug), lesson).toEqual(slug);
      expect(urls.some((url) => url.endsWith(lesson))).toBe(true);
    }
    expect(lessons).toContain("/curriculum/T1_Foundational/F2E_First_Self_Checking_Testbench/index");
  });

  it("lists only public pages that exist and are not behind a switch, sign-in or a 404", () => {
    for (const route of [...PUBLIC_PAGES, ...practicePaths()]) {
      const file = pageFileFor(route);
      expect(file, `${route} has no page.tsx`).toBeDefined();
      const source = fs.readFileSync(file as string, "utf-8");
      expect(source, `${route} is gated`).not.toMatch(/isFeatureEnabled|requireSession|SITE_FEATURES|notFound\(/);
    }
  });

  it("lists the placement quiz and the legal pages, which explain browser storage", () => {
    for (const route of ["/", "/quiz/placement", "/privacy-policy", "/terms-of-service"]) {
      expect(PUBLIC_PAGES as readonly string[]).toContain(route);
    }
  });

  it("lists every exercise, practice visualization and tool page from the practice map", () => {
    const practice = practicePaths();
    expect(practice).toEqual(expect.arrayContaining(PRACTICE_PAGES.map((page) => page.href)));
    expect(practice).toHaveLength(PRACTICE_PAGES.length);
    // Every such route in the app is listed, so a new practice page cannot miss the sitemap.
    const routes = [
      ...childRoutes(["exercises"]),
      ...childRoutes(["practice", "visualizations"]),
      ...childRoutes(["practice"], ["lab", "visualizations"]),
      ...childRoutes(["visualizations"]),
    ];
    expect(routes).toEqual(expect.arrayContaining(["/exercises/uvm-phase-sorter", "/practice/waveform-studio", "/visualizations/systemverilog-3d"]));
    expect(routes.some((route) => route.startsWith("/practice/visualizations/"))).toBe(true);
    for (const route of routes) expect(practice, `${route} is not in the sitemap`).toContain(route);
    for (const route of practice) expect(urls.filter((url) => url.endsWith(route))).toHaveLength(1);
  });

  it("lists every available lab, and only those, at its prerendered URL", () => {
    const available = getAllLabs().filter((lab) => lab.status === "available");
    expect(available.length).toBeGreaterThan(0);
    expect(labPaths()).toEqual(available.map((lab) => `/practice/lab/${encodeURIComponent(lab.id)}`));
    for (const lab of getAllLabs().filter((entry) => entry.status !== "available")) {
      expect(labPaths()).not.toContain(`/practice/lab/${encodeURIComponent(lab.id)}`);
    }
    for (const lab of labPaths()) expect(urls.filter((url) => url.endsWith(lab))).toHaveLength(1);
    // The lab route exists, so every listed URL resolves to its prerendered page.
    expect(pageFileFor("/practice/lab/[labId]")).toBeDefined();
  });

  it("leaves out learner pages and hidden pages", () => {
    const paths = urls.map((url) => new URL(url).pathname);
    for (const route of ["/dashboard", "/settings", ...HIDDEN_PAGES]) {
      expect(paths, `${route} is in the sitemap`).not.toContain(route);
      expect(PUBLIC_PAGES as readonly string[]).not.toContain(route);
    }
    expect(paths.some((pathname) => pathname.startsWith("/dashboard/") || pathname.startsWith("/community"))).toBe(false);
  });

  it("hides every hidden page behind notFound() in its page.tsx", () => {
    for (const route of HIDDEN_PAGES) {
      const file = pageFileFor(route);
      expect(file, `${route} has no page.tsx`).toBeDefined();
      const source = fs.readFileSync(file as string, "utf-8");
      expect(source, `${route} is not hidden`).toMatch(/notFound\(\)/);
      expect(source, `${route} reads the flags module directly`).not.toMatch(/@\/tools\/featureFlags|isFeatureEnabled/);
      expect(source, `${route} forces a dynamic render`).not.toMatch(/export const dynamic\s*=\s*["']force-dynamic["']/);
    }
  });

  it("is referenced from robots.txt, which keeps the learner pages out", () => {
    const rules = robots();
    expect(rules.sitemap).toMatch(/\/sitemap\.xml$/);
    const disallow = ([] as string[]).concat(...[rules.rules].flat().map((rule) => [rule.disallow ?? []].flat()));
    expect(disallow).toEqual(expect.arrayContaining(["/dashboard", "/settings"]));
  });
});
