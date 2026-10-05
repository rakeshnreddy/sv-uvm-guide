/**
 * Data for the curriculum overview (/curriculum): tiers, modules and lessons in
 * manifest order, plus the small helpers the overview, the routes and the
 * expert index share.
 *
 * Pure and data-free: callers pass the generated curriculum data in, so client
 * components can import the helpers (search matching, naming) without bundling
 * the curriculum twice. The server page builds the overview once and hands the
 * plain result to the client components.
 */

import type { Module as CurriculumTier } from '@/lib/curriculum-data';

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

/** "I-SV-1_OOP" -> "I-SV-1"; "B-AMBA-F1_Bridges_and_System_Integration" -> "B-AMBA-F1". */
export function moduleCode(moduleId: string): string {
  return moduleId.split('_')[0] ?? moduleId;
}

/** "T3_Advanced" -> "t3": the anchor of a tier section on /curriculum and on the expert index. */
export function tierAnchor(tierId: string): string {
  const match = /^T(\d+)/i.exec(tierId);
  return match ? `t${match[1]}` : tierId.toLowerCase();
}

/** "T3_Advanced" -> 3. */
export function tierNumber(tierId: string): number {
  const match = /^T(\d+)/i.exec(tierId);
  return match ? Number(match[1]) : 0;
}

/** Drops legacy " | Series" suffixes from lesson titles (G30-ORD-14) for display. */
export function cleanLessonTitle(title: string): string {
  return title.split(' | ')[0].trim();
}

/** A module title without its "CODE: " prefix, for places that show the code separately. */
export function moduleDisplayTitle(title: string, code: string): string {
  const clean = cleanLessonTitle(title);
  return clean.startsWith(`${code}: `) ? clean.slice(code.length + 2) : clean;
}

/** "Mailboxes" in I-SV-5 -> "I-SV-5: Mailboxes"; titles that already start with the code are kept. */
export function labelWithCode(code: string, title: string): string {
  return title.startsWith(`${code}:`) ? title : `${code}: ${title}`;
}

/** Canonical lesson URL: exact folder case, `index` for module pages (spine §5.9). */
export function lessonHref(tierId: string, moduleId: string, lessonSlug: string): string {
  return `/curriculum/${tierId}/${moduleId}/${lessonSlug}`;
}

/** Key of a lesson inside the overview: "<ModuleFolder>/<lesson>". */
export function lessonKey(moduleId: string, lessonSlug: string): string {
  return `${moduleId}/${lessonSlug}`;
}

/** Reading time in minutes, the same estimate the lesson header shows (words ÷ 180). */
export function readingMinutes(wordCount: number): number {
  return wordCount > 0 ? Math.max(1, Math.round(wordCount / 180)) : 0;
}

/**
 * The lane a module sits in on the curriculum map: tiers are columns, tracks
 * are lanes (T3 has a UVM lane and an AMBA lane).
 */
export function moduleLane(moduleId: string, track: 'core' | 'elective' = 'core'): string {
  if (track === 'elective') return 'Electives';
  if (/^F1/.test(moduleId)) return 'Why verify';
  if (/^F2/.test(moduleId)) return 'The language';
  if (/^F3/.test(moduleId)) return 'Time and races';
  if (/^F4/.test(moduleId)) return 'Structure and interfaces';
  if (/^I-SV-/.test(moduleId)) return 'SystemVerilog for verification';
  if (/^I-UVM-/.test(moduleId)) return 'UVM';
  if (/^A-UVM-/.test(moduleId)) return 'UVM environments';
  if (/^B-/.test(moduleId)) return 'AMBA protocols';
  if (/^E-/.test(moduleId)) return 'Methodology and systems';
  return 'Modules';
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * True when every word of the query starts a word in the haystack. Case-blind;
 * underscores and punctuation separate words, so "config_db" finds
 * "uvm_config_db" and "ral" finds "RAL" but not "general".
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = haystack.toLowerCase();
  return tokens.every((token) => {
    let from = text.indexOf(token);
    while (from !== -1) {
      if (from === 0 || !WORD_CHAR.test(text[from - 1])) return true;
      from = text.indexOf(token, from + 1);
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// Planned modules (spine §3.4 and §4.2): shown on the map, never linked
// ---------------------------------------------------------------------------

export interface PlannedModule {
  code: string;
  title: string;
  tierId: string;
  /** Manifest module id the planned module will follow. */
  after: string;
  lane: string;
  summary: string;
}

/**
 * Modules the spine proposes but that do not exist yet. Remove an entry when
 * its module lands in the manifest; tests/lib/curriculum-overview.test.ts
 * fails while a planned code is also a real module.
 */
export const PLANNED_MODULES: readonly PlannedModule[] = [
  {
    code: 'A-UVM-9',
    title: 'Reset Handling and Error Injection',
    tierId: 'T3_Advanced',
    after: 'A-UVM-8_Multi_Agent_Topologies',
    lane: 'UVM environments',
    summary: 'Keep agents, scoreboards and tests correct across mid-test reset and deliberate error injection.',
  },
  {
    code: 'B-APB-1',
    title: 'APB Protocol & Verification',
    tierId: 'T3_Advanced',
    after: 'B-AMBA-2_Protocol_Intuition_and_Memory_Hooks',
    lane: 'AMBA protocols',
    summary: 'Read, drive and check APB transfers and build the simplest complete protocol agent.',
  },
];

// ---------------------------------------------------------------------------
// The overview
// ---------------------------------------------------------------------------

export interface OverviewLesson {
  /** "<ModuleFolder>/<lesson>". */
  key: string;
  slug: string;
  title: string;
  href: string;
  /** Key of the next lesson on the learning path (core path skips electives); absent at the end. */
  next?: string;
}

export interface OverviewLab {
  id: string;
  title: string;
  href: string;
}

export interface OverviewModule {
  id: string;
  code: string;
  /** Title as authored, e.g. "F2A: Core Data Types". */
  title: string;
  /** Title without the code prefix, e.g. "Core Data Types". */
  displayTitle: string;
  href: string;
  tierId: string;
  track: 'core' | 'elective';
  lane: string;
  description: string;
  lessons: OverviewLesson[];
  /** Manifest prerequisites (module ids), always earlier in the order. */
  prerequisites: string[];
  /** Ids of modules that list this one as a prerequisite. */
  unlocks: string[];
  milestones: string[];
  /** Estimated reading time for the whole module, in minutes (0 when unknown). */
  minutes: number;
  /** Available labs the lab registry assigns to this module. */
  labs: OverviewLab[];
  /** Descriptions of the module's other lessons, which the overview search also matches. */
  lessonDescriptions: string;
}

export interface OverviewTier {
  id: string;
  anchor: string;
  number: number;
  title: string;
  audience: string;
  modules: OverviewModule[];
  lessonCount: number;
  electiveCount: number;
}

export interface OverviewLabInput {
  id: string;
  title: string;
  owningModule: string;
  status: string;
}

export interface LessonPosition {
  tierId: string;
  moduleId: string;
  lessonSlug: string;
}

export interface CurriculumOverviewInput {
  data: readonly CurriculumTier[];
  /** Tier titles and audiences from content/curriculum/curriculum.manifest.json. */
  tiers: readonly { id: string; title: string; audience: string }[];
  /** Reading minutes per lesson, keyed "<ModuleFolder>/<lesson>". */
  minutesByLesson?: Readonly<Record<string, number>>;
  labs?: readonly OverviewLabInput[];
  /** The next lesson on the learning path (the generated `findPrevNextTopics`). */
  nextOf?: (lesson: LessonPosition) => LessonPosition | undefined;
}

export function buildCurriculumOverview(input: CurriculumOverviewInput): OverviewTier[] {
  const unlocks = new Map<string, string[]>();
  for (const tier of input.data) {
    for (const section of tier.sections) {
      for (const prerequisite of section.prerequisites ?? []) {
        unlocks.set(prerequisite, [...(unlocks.get(prerequisite) ?? []), section.slug]);
      }
    }
  }

  return input.data.map((tier) => {
    const meta = input.tiers.find((t) => t.id === tier.slug);
    const modules = tier.sections.map((section): OverviewModule => {
      const code = moduleCode(section.slug);
      const track = section.track ?? 'core';
      const lessons = section.topics.map((topic): OverviewLesson => {
        const next = input.nextOf?.({ tierId: tier.slug, moduleId: section.slug, lessonSlug: topic.slug });
        return {
          key: lessonKey(section.slug, topic.slug),
          slug: topic.slug,
          title: cleanLessonTitle(topic.title),
          href: lessonHref(tier.slug, section.slug, topic.slug),
          ...(next ? { next: lessonKey(next.moduleId, next.lessonSlug) } : {}),
        };
      });
      const indexTopic = section.topics.find((t) => t.slug === 'index') ?? section.topics[0];
      const title = cleanLessonTitle(section.title);
      const displayTitle = moduleDisplayTitle(section.title, code);
      const description = indexTopic?.description ?? '';
      const minutes = section.topics.reduce(
        (sum, topic) => sum + (input.minutesByLesson?.[lessonKey(section.slug, topic.slug)] ?? 0),
        0,
      );
      const lessonDescriptions = section.topics
        .filter((topic) => topic !== indexTopic && topic.description)
        .map((topic) => topic.description)
        .join(' \n ');

      return {
        id: section.slug,
        code,
        title,
        displayTitle,
        href: lessonHref(tier.slug, section.slug, indexTopic?.slug ?? 'index'),
        tierId: tier.slug,
        track,
        lane: moduleLane(section.slug, track),
        description,
        lessons,
        prerequisites: [...(section.prerequisites ?? [])],
        unlocks: unlocks.get(section.slug) ?? [],
        milestones: [...(section.milestones ?? [])].sort(),
        minutes,
        labs: (input.labs ?? [])
          .filter((lab) => lab.status === 'available' && lab.owningModule === code)
          .map((lab) => ({ id: lab.id, title: lab.title.replace(/\s+/g, ' ').trim(), href: `/practice/lab/${lab.id}` })),
        lessonDescriptions,
      };
    });

    return {
      id: tier.slug,
      anchor: tierAnchor(tier.slug),
      number: tierNumber(tier.slug),
      title: meta?.title ?? tier.title,
      audience: meta?.audience ?? '',
      modules,
      lessonCount: modules.reduce((sum, m) => sum + m.lessons.length, 0),
      electiveCount: modules.filter((m) => m.track === 'elective').length,
    };
  });
}

/** The text the overview search matches for a module: code, titles and descriptions of all its lessons. */
export function moduleSearchText(module: OverviewModule): string {
  return [module.code, module.title, module.description, ...module.lessons.map((l) => l.title), module.lessonDescriptions]
    .join(' \n ')
    .toLowerCase();
}

/** Every module of the overview by id. */
export function indexOverviewModules(tiers: readonly OverviewTier[]): Map<string, OverviewModule> {
  return new Map(tiers.flatMap((tier) => tier.modules.map((m) => [m.id, m] as const)));
}

export interface IndexedLesson extends OverviewLesson {
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
}

/** Every lesson of the overview by key ("<ModuleFolder>/<lesson>"). */
export function indexOverviewLessons(tiers: readonly OverviewTier[]): Map<string, IndexedLesson> {
  const map = new Map<string, IndexedLesson>();
  for (const tier of tiers) {
    for (const m of tier.modules) {
      for (const lesson of m.lessons) {
        map.set(lesson.key, { ...lesson, moduleId: m.id, moduleCode: m.code, moduleTitle: m.displayTitle });
      }
    }
  }
  return map;
}
