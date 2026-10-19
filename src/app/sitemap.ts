import type { MetadataRoute } from "next";

import { curriculumData } from "@/lib/curriculum-data";
import { env } from "@/lib/env";
import { getAllLabs } from "@/lib/lab-registry";

/**
 * Public pages that render without sign-in or a database. Lessons and
 * available labs are public static pages too and are listed separately
 * (lessonPaths, labPaths). Left out on purpose:
 * - learner pages (/dashboard, its review and notebook pages, /settings):
 *   they show data kept in the visitor's browser, and robots.txt disallows
 *   /dashboard and /settings;
 * - hidden pages, which answer 404 unless a switch turns them on (draft pages
 *   such as /resources, /projects and /history; /assessment; /notifications;
 *   /community).
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
] as const;

/** Every lesson, from the same data as the lesson route's generateStaticParams. */
export function lessonPaths(): string[] {
  return curriculumData.flatMap((tier) =>
    tier.sections.flatMap((section) =>
      section.topics.map((topic) => `/curriculum/${[tier.slug, section.slug, topic.slug].map(encodeURIComponent).join("/")}`),
    ),
  );
}

/** Every available lab, as the lab route's generateStaticParams prerenders them. Coming-soon labs answer 404. */
export function labPaths(): string[] {
  return getAllLabs()
    .filter((lab) => lab.status === "available")
    .map((lab) => `/practice/lab/${encodeURIComponent(lab.id)}`);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.APP_URL.replace(/\/+$/, "");
  return [...PUBLIC_PAGES, ...lessonPaths(), ...labPaths()].map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: path.startsWith("/curriculum/") || path.startsWith("/practice/lab/") ? "monthly" : "weekly",
  }));
}
