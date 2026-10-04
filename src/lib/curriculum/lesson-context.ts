/**
 * Orientation data for one lesson page (G30-PAGE-01, G30-PAGE-V01, G30-PAGE-05..10):
 * where the lesson sits (tier, module, "Lesson k of N"), its track and
 * milestones, what to read first, the previous and next lessons on the path,
 * and the breadcrumb trail.
 *
 * Everything comes from content/curriculum/curriculum.manifest.json, directly
 * (tier titles and audiences) or through the generated curriculum data (order,
 * tracks, prerequisites, milestones, titles), so the page chrome, the
 * <BeforeYouStart /> and <NextLesson /> MDX components and the tests agree.
 * Server-side and test-side only: it imports the manifest JSON.
 */
import manifestJson from "../../../content/curriculum/curriculum.manifest.json";
import {
  curriculumData,
  findPrevNextTopics,
  normalizeSlug,
  type Section,
} from "@/lib/curriculum-data";

import { lessonPath, type LessonSlug } from "./lesson-urls";

interface ManifestTier {
  id: string;
  title?: string;
  audience?: string;
}

const manifestTiers: readonly ManifestTier[] = (manifestJson as { tiers: ManifestTier[] }).tiers;

/** Testbench milestones M0–M8 (docs/audit/2026-10-03-learning-outcomes/tb-mastery-progression.md). */
export const MILESTONE_LABELS: Readonly<Record<string, string>> = {
  M0: "Self-checking directed testbench",
  M1: "Race-aware interface testbench with clocking blocks",
  M2: "Reusable UVM agent, active and passive",
  M3: "Reference-model scoreboard with end-of-test accounting",
  M4: "Coverage-driven environment with a closure loop",
  M5: "Multi-agent environment with virtual sequences",
  M6: "Out-of-order, ID-aware protocol verification",
  M7: "RAL-integrated environment with a predictor",
  M8: "Subsystem or SoC capstone: reset, errors, concurrency, closure",
};

export type Track = "core" | "elective";

/** Drops the legacy " | Series" suffix some sub-lesson titles still carry (G30-ORD-14). */
export function cleanTitle(title: string): string {
  return title.split(" | ")[0].trim();
}

/** "I-SV-1_OOP" -> "I-SV-1". */
export function moduleCodeOf(moduleId: string): string {
  return moduleId.split("_")[0] ?? moduleId;
}

/** "T3_Advanced" -> "t3", the tier's anchor on /curriculum. */
export function tierAnchorId(tierId: string): string {
  const match = /^T(\d+)/i.exec(tierId);
  return match ? `t${match[1]}` : tierId.toLowerCase();
}

export interface TierInfo {
  id: string;
  /** "T2". */
  code: string;
  /** "Tier 2: Intermediate", from the manifest. */
  title: string;
  audience?: string;
  /** The tier's section on the curriculum overview, for example `/curriculum#t2`. */
  href: string;
}

export function getTierInfo(tierId: string): TierInfo | undefined {
  const tier = curriculumData.find((entry) => entry.slug === tierId);
  if (!tier) return undefined;
  const manifestTier = manifestTiers.find((entry) => entry.id === tierId);
  const code = tierId.split("_")[0] ?? tier.tier;
  return {
    id: tierId,
    code,
    title: manifestTier?.title ?? `${code}: ${tier.title}`,
    audience: manifestTier?.audience,
    href: `/curriculum#${tierAnchorId(tierId)}`,
  };
}

export interface ModuleInfo {
  id: string;
  code: string;
  /** "I-SV-1: Object-Oriented Programming for Verification": always starts with the code. */
  label: string;
  /** Canonical URL of the module's first page. */
  href: string;
  tierId: string;
  track: Track;
  /** 1-based position of the module in its tier, in manifest order. */
  position: number;
  /** Number of modules in the tier. */
  count: number;
}

function moduleLabel(section: Section): string {
  const code = moduleCodeOf(section.slug);
  const title = cleanTitle(section.title);
  return title.startsWith(`${code}:`) || title.startsWith(`${code} `) ? title : `${code}: ${title}`;
}

function findModule(moduleId: string): { tierId: string; section: Section; position: number; count: number } | undefined {
  for (const tier of curriculumData) {
    const index = tier.sections.findIndex((section) => section.slug === moduleId);
    if (index >= 0) {
      return { tierId: tier.slug, section: tier.sections[index], position: index + 1, count: tier.sections.length };
    }
  }
  return undefined;
}

function firstLessonSlug(section: Section): string {
  return (section.topics.find((topic) => topic.slug === "index") ?? section.topics[0])?.slug ?? "index";
}

export function getModuleInfo(moduleId: string): ModuleInfo | undefined {
  const found = findModule(moduleId);
  if (!found) return undefined;
  const { tierId, section, position, count } = found;
  return {
    id: section.slug,
    code: moduleCodeOf(section.slug),
    label: moduleLabel(section),
    href: lessonPath([tierId, section.slug, firstLessonSlug(section)]),
    tierId,
    track: section.track ?? "core",
    position,
    count,
  };
}

export interface LessonRef {
  slug: LessonSlug;
  /** Canonical URL. */
  href: string;
  /** The lesson's title without legacy suffixes. */
  title: string;
  /** What links show: the module label (with its code) for a module's first page, else the title. */
  label: string;
  moduleId: string;
  moduleCode: string;
  tierId: string;
  /** 1-based position in the module, in manifest order (the module page is lesson 1). */
  position: number;
  /** Number of lessons in the module. */
  count: number;
  isModulePage: boolean;
  track: Track;
}

/** The lesson a slug resolves to (any accepted URL form), or `undefined`. */
export function getLessonRef(rawSlug: readonly string[]): LessonRef | undefined {
  const normalized = normalizeSlug([...rawSlug]);
  if (normalized.length !== 3) return undefined;
  const [tierId, moduleId, lessonSlug] = normalized;
  const found = findModule(moduleId);
  if (!found || found.tierId !== tierId) return undefined;
  const { section } = found;
  const index = section.topics.findIndex((topic) => topic.slug === lessonSlug);
  if (index === -1) return undefined;
  const topic = section.topics[index];
  const isModulePage = index === 0 || topic.slug === "index";
  return {
    slug: [tierId, moduleId, lessonSlug],
    href: lessonPath([tierId, moduleId, lessonSlug]),
    title: cleanTitle(topic.title),
    label: isModulePage ? moduleLabel(section) : cleanTitle(topic.title),
    moduleId,
    moduleCode: moduleCodeOf(moduleId),
    tierId,
    position: index + 1,
    count: section.topics.length,
    isModulePage,
    track: section.track ?? "core",
  };
}

export interface PrerequisiteItem {
  /** "lesson": the previous lesson in the same module; "module": a manifest prerequisite. */
  kind: "lesson" | "module";
  href: string;
  label: string;
  moduleCode: string;
}

/**
 * What to read before a lesson. A module's first page lists the manifest
 * prerequisites. A later page in a multi-page module lists the page before it
 * first (the pages build on each other), then the module's prerequisites.
 * Returns `undefined` when the slug is not a lesson.
 */
export function lessonPrerequisites(rawSlug: readonly string[]): PrerequisiteItem[] | undefined {
  const lesson = getLessonRef(rawSlug);
  if (!lesson) return undefined;
  const found = findModule(lesson.moduleId);
  if (!found) return undefined;

  const items: PrerequisiteItem[] = [];
  if (!lesson.isModulePage) {
    const previous = found.section.topics[lesson.position - 2];
    if (previous) {
      const ref = getLessonRef([lesson.tierId, lesson.moduleId, previous.slug]);
      if (ref) items.push({ kind: "lesson", href: ref.href, label: ref.label, moduleCode: ref.moduleCode });
    }
  }
  for (const moduleId of found.section.prerequisites ?? []) {
    const info = getModuleInfo(moduleId);
    if (info) items.push({ kind: "module", href: info.href, label: info.label, moduleCode: info.code });
  }
  return items;
}

export interface NeighbourLesson extends LessonRef {
  /** "lesson": same module; "module": another module of the same tier; "tier": another tier. */
  step: "lesson" | "module" | "tier";
  /** The neighbour's tier title, for "Starts Tier 3: Advanced". */
  tierTitle: string;
  /** True when the step leaves an elective for the core path. */
  returnsToCore: boolean;
  /** The step in words, for the pager: "Lesson 3 of 9 in I-UVM-3B", "Next module: I-SV-2A", "Starts Tier 3: Advanced". */
  boundary: string;
}

function describeStep(current: LessonRef, neighbour: LessonRef, direction: "prev" | "next"): Omit<NeighbourLesson, keyof LessonRef> {
  const tierTitle = getTierInfo(neighbour.tierId)?.title ?? neighbour.tierId;
  const step: NeighbourLesson["step"] = neighbour.tierId !== current.tierId
    ? "tier"
    : neighbour.moduleId !== current.moduleId ? "module" : "lesson";
  const returnsToCore = direction === "next" && step !== "lesson" && current.track === "elective" && neighbour.track === "core";

  const parts: string[] = [];
  if (step === "tier") parts.push(direction === "next" ? `Starts ${tierTitle}` : `Back to ${tierTitle}`);
  else if (step === "module") parts.push(direction === "next" ? `Next module: ${neighbour.moduleCode}` : `Previous module: ${neighbour.moduleCode}`);
  else parts.push(`Lesson ${neighbour.position} of ${neighbour.count} in ${neighbour.moduleCode}`);
  if (returnsToCore) parts.push("back on the core path");
  else if (step !== "lesson" && neighbour.track === "elective") parts.push("elective");

  return { step, tierTitle, returnsToCore, boundary: parts.join(", ") };
}

/**
 * Previous and next lessons on the learning path, from the generated
 * navigation: the core path skips electives, and an elective's Next returns
 * to the path (findPrevNextTopics).
 */
export function lessonNeighbours(rawSlug: readonly string[]): { prev?: NeighbourLesson; next?: NeighbourLesson } {
  const current = getLessonRef(rawSlug);
  if (!current) return {};
  const { prev, next } = findPrevNextTopics([...current.slug]);
  const resolve = (topic: { slug: string } | undefined, direction: "prev" | "next"): NeighbourLesson | undefined => {
    if (!topic) return undefined;
    const ref = getLessonRef(topic.slug.split("/"));
    return ref ? { ...ref, ...describeStep(current, ref, direction) } : undefined;
  };
  const result: { prev?: NeighbourLesson; next?: NeighbourLesson } = {};
  const prevLesson = resolve(prev, "prev");
  const nextLesson = resolve(next, "next");
  if (prevLesson) result.prev = prevLesson;
  if (nextLesson) result.next = nextLesson;
  return result;
}

export interface LessonContext {
  lesson: LessonRef;
  tier: TierInfo;
  module: ModuleInfo;
  /** Every lesson of the module, in manifest order. */
  lessons: Array<LessonRef & { current: boolean }>;
  prerequisites: PrerequisiteItem[];
  milestones: Array<{ id: string; label: string }>;
  prev?: NeighbourLesson;
  next?: NeighbourLesson;
}

export function getLessonContext(rawSlug: readonly string[]): LessonContext | undefined {
  const lesson = getLessonRef(rawSlug);
  if (!lesson) return undefined;
  const tier = getTierInfo(lesson.tierId);
  const moduleInfo = getModuleInfo(lesson.moduleId);
  const found = findModule(lesson.moduleId);
  if (!tier || !moduleInfo || !found) return undefined;

  const lessons = found.section.topics
    .map((topic) => getLessonRef([lesson.tierId, lesson.moduleId, topic.slug]))
    .filter((ref): ref is LessonRef => Boolean(ref))
    .map((ref) => ({ ...ref, current: ref.href === lesson.href }));

  return {
    lesson,
    tier,
    module: moduleInfo,
    lessons,
    prerequisites: lessonPrerequisites(lesson.slug) ?? [],
    milestones: (found.section.milestones ?? [])
      .slice()
      .sort()
      .map((id) => ({ id, label: MILESTONE_LABELS[id] ?? id })),
    ...lessonNeighbours(lesson.slug),
  };
}

export interface Crumb {
  label: string;
  href: string;
  /** The page the trail ends on: rendered with aria-current="page". */
  current: boolean;
}

/**
 * Curriculum › Tier › Module › Lesson, with canonical links (G30-PAGE-03/07/08):
 * the tier links to its section of the overview, the module to its first page,
 * and a module's first page ends the trail itself (no repeated crumb).
 */
export function lessonBreadcrumbs(rawSlug: readonly string[]): Crumb[] {
  const lesson = getLessonRef(rawSlug);
  if (!lesson) return [];
  const tier = getTierInfo(lesson.tierId);
  const moduleInfo = getModuleInfo(lesson.moduleId);
  if (!tier || !moduleInfo) return [];
  const crumbs: Crumb[] = [
    { label: "Curriculum", href: "/curriculum", current: false },
    { label: tier.title, href: tier.href, current: false },
    { label: moduleInfo.label, href: moduleInfo.href, current: lesson.isModulePage },
  ];
  if (!lesson.isModulePage) crumbs.push({ label: lesson.title, href: lesson.href, current: true });
  return crumbs;
}
