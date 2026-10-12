import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap, { PUBLIC_PAGES, lessonPaths } from "@/app/sitemap";
import { normalizeSlug } from "@/lib/curriculum-data";

const APP_DIR = path.resolve(__dirname, "../../src/app");

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

  it("lists only public pages that exist and are not behind a feature flag or sign-in", () => {
    for (const route of PUBLIC_PAGES) {
      const file = pageFileFor(route);
      expect(file, `${route} has no page.tsx`).toBeDefined();
      const source = fs.readFileSync(file as string, "utf-8");
      expect(source, `${route} is gated`).not.toMatch(/isFeatureEnabled|requireSession/);
    }
  });

  it("is referenced from robots.txt", () => {
    const rules = robots();
    expect(rules.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
