import type { MetadataRoute } from "next";

import { curriculumData } from "@/lib/curriculum-data";
import { env } from "@/lib/env";

/**
 * Public pages that render without sign-in or a database. Pages behind a
 * feature flag (dashboard, community, assessment, ...) and lab pages (they
 * require a session) are left out on purpose.
 */
export const PUBLIC_PAGES = [
  "/",
  "/curriculum",
  "/curriculum/expert-index",
  "/practice",
  "/practice/waveform-studio",
  "/interview-prep",
  "/exercises",
  "/knowledge-hub",
  "/learning-strategies",
  "/resources",
] as const;

/** Every lesson, from the same data as the lesson route's generateStaticParams. */
export function lessonPaths(): string[] {
  return curriculumData.flatMap((tier) =>
    tier.sections.flatMap((section) =>
      section.topics.map((topic) => `/curriculum/${[tier.slug, section.slug, topic.slug].map(encodeURIComponent).join("/")}`),
    ),
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.APP_URL.replace(/\/+$/, "");
  return [...PUBLIC_PAGES, ...lessonPaths()].map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: path.startsWith("/curriculum/") ? "monthly" : "weekly",
  }));
}
