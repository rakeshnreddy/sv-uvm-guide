/**
 * The course outline the sidebar renders: tiers → modules → lessons in
 * manifest order (content/curriculum/curriculum.manifest.json, via the
 * generated curriculum data), with the current lesson marked and each tier's
 * consecutive elective modules grouped. Pure, so the order is unit-tested
 * against the manifest.
 */
import manifest from "../../../content/curriculum/curriculum.manifest.json";
import { normalizeSlug, type Module } from "@/lib/curriculum-data";

import { displayLessonTitle, moduleCode, stripModuleCode } from "./search-engine";

export type Track = "core" | "elective";

export interface OutlineLesson {
  slug: string;
  title: string;
  href: string;
  current: boolean;
}

export interface OutlineModule {
  /** Module folder, for example "I-SV-5_Synchronization_and_IPC". */
  id: string;
  /** "I-SV-5". */
  code: string;
  /** Title without the code: "Synchronization and IPC". */
  title: string;
  /** The module's first lesson (its index page). */
  href: string;
  track: Track;
  /** Every lesson in order, the index page first. */
  lessons: OutlineLesson[];
  /** Holds the current lesson. */
  current: boolean;
}

/** A run of consecutive modules on the same track; elective runs are labelled in the outline. */
export interface OutlineGroup {
  track: Track;
  modules: OutlineModule[];
}

export interface OutlineTier {
  /** Tier folder, for example "T2_Intermediate". */
  id: string;
  /** "T2". */
  code: string;
  /** From the manifest: "Tier 2: Intermediate". */
  title: string;
  audience?: string;
  groups: OutlineGroup[];
  moduleCount: number;
  lessonCount: number;
  /** Holds the current lesson. */
  current: boolean;
}

export interface TierMeta {
  id: string;
  title: string;
  audience?: string;
}

/** Tier titles and audiences, from the manifest (the generated data has short names only). */
export const manifestTierMeta: TierMeta[] = manifest.tiers.map((tier) => ({
  id: tier.id,
  title: tier.title,
  audience: tier.audience,
}));

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * The lesson a pathname renders, as [tier, module, lesson] folders, or null
 * when the page is not a lesson (the overview, practice pages, …). Accepts
 * every URL form the lesson route accepts (two-segment, pretty slugs).
 */
export function currentLessonSlug(pathname: string | null | undefined): string[] | null {
  if (!pathname) return null;
  const segments = pathname.split(/[?#]/)[0].split("/").filter(Boolean).map(safeDecode);
  if (segments[0] !== "curriculum" || segments.length < 2) return null;
  const normalized = normalizeSlug(segments.slice(1));
  return normalized.length === 3 ? normalized : null;
}

/** Lesson pages dock the outline at lg and wider. */
export function isLessonPath(pathname: string | null | undefined): boolean {
  return currentLessonSlug(pathname) !== null;
}

/** "F1A: The Cost of Bugs" → "The Cost of Bugs"; titles without a code stay as they are. */
export function moduleDisplayTitle(title: string, code: string): string {
  return stripModuleCode(displayLessonTitle(title), code);
}

export function buildCourseOutline(
  data: readonly Module[],
  tierMeta: readonly TierMeta[],
  current: readonly string[] | null,
): OutlineTier[] {
  const currentKey = current && current.length === 3 ? current.join("/") : null;

  return data.map((tier) => {
    const meta = tierMeta.find((entry) => entry.id === tier.slug);
    const groups: OutlineGroup[] = [];
    let lessonCount = 0;

    for (const section of tier.sections) {
      if (section.topics.length === 0) continue;
      const code = moduleCode(section.slug);
      const track: Track = section.track === "elective" ? "elective" : "core";
      const lessons: OutlineLesson[] = section.topics.map((topic) => {
        const key = `${tier.slug}/${section.slug}/${topic.slug}`;
        return {
          slug: topic.slug,
          title: moduleDisplayTitle(topic.title, code),
          href: `/curriculum/${key}`,
          current: key === currentKey,
        };
      });
      lessonCount += lessons.length;

      const outlineModule: OutlineModule = {
        id: section.slug,
        code,
        title: moduleDisplayTitle(section.title, code),
        href: lessons[0].href,
        track,
        lessons,
        current: lessons.some((lesson) => lesson.current),
      };
      const last = groups[groups.length - 1];
      if (last && last.track === track) last.modules.push(outlineModule);
      else groups.push({ track, modules: [outlineModule] });
    }

    const modules = groups.flatMap((group) => group.modules);
    return {
      id: tier.slug,
      code: tier.tier,
      title: meta?.title ?? `${tier.tier}: ${tier.title}`,
      audience: meta?.audience,
      groups,
      moduleCount: modules.length,
      lessonCount,
      current: modules.some((mod) => mod.current),
    };
  });
}

/** Every lesson URL in outline order: what a learner walking the outline top to bottom visits. */
export function outlineLessonHrefs(outline: readonly OutlineTier[]): string[] {
  return outline.flatMap((tier) =>
    tier.groups.flatMap((group) => group.modules.flatMap((mod) => mod.lessons.map((lesson) => lesson.href))),
  );
}

/** Tiers and modules open by default: the ones holding the current lesson, else the first tier. */
export function defaultExpansion(outline: readonly OutlineTier[]): { tiers: string[]; modules: string[] } {
  const currentTier = outline.find((tier) => tier.current);
  const currentModule = currentTier?.groups.flatMap((group) => group.modules).find((mod) => mod.current);
  return {
    tiers: currentTier ? [currentTier.id] : outline.slice(0, 1).map((tier) => tier.id),
    modules: currentModule && currentModule.lessons.length > 1 ? [currentModule.id] : [],
  };
}
