/**
 * The self-assessment model: pure helpers that turn the learner records kept
 * in this browser into one summary per track (SystemVerilog, UVM, assertions
 * and coverage, AMBA, expert topics) and a short list of next steps for each.
 *
 * Every number comes from a record the learner made here: lessons marked done
 * or opened, lesson quiz results, lab progress, flashcard review state and the
 * placement quiz. Nothing is estimated, scored by a model or invented. Callers
 * pass every input in (including `now`), so the helpers are safe in server
 * components and easy to test.
 */
import { labelWithCode, moduleCode } from '@/lib/curriculum-overview';
import {
  indexStaticLessons,
  tierAndModuleProgress,
  weakQuizLessons,
  WEAK_QUIZ_THRESHOLD,
  type IndexedStaticLesson,
  type ModuleProgressSummary,
  type StaticTier,
  type WeakQuizLesson,
} from '@/lib/learner-stats';
import type { AssessmentData, PlacementAttempt, QuizResult } from '@/lib/learner-store/repositories/assessments';
import { isCardDue, type FlashcardData } from '@/lib/learner-store/repositories/flashcards';
import type { LabProgressRecord } from '@/lib/learner-store/repositories/labs';
import type { CurriculumProgressData, LessonLogData } from '@/lib/learner-store/repositories/lessons';

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export type TrackId = 'systemverilog' | 'uvm' | 'assertions-coverage' | 'amba' | 'expert';

/** The placement quiz's areas, as PlacementQuiz stores them in PlacementAttempt.categories. */
export type PlacementAreaId = 'foundations' | 'methodology' | 'debug';

export interface TrackDefinition {
  id: TrackId;
  name: string;
  /** Which modules the track holds, in words. */
  scope: string;
  /** The placement area that tests this track, if any. */
  placementArea: PlacementAreaId | null;
  /** Says what the placement area does not measure for this track, when it covers only part of it. */
  placementNote?: string;
}

export const TRACKS: readonly TrackDefinition[] = Object.freeze([
  {
    id: 'systemverilog',
    name: 'SystemVerilog',
    scope: 'Tier 1 foundations and the Tier 2 language modules (OOP, randomization, IPC, DPI, compiler directives and generates, power intent).',
    placementArea: 'foundations',
  },
  {
    id: 'uvm',
    name: 'UVM',
    scope: 'Why UVM, the Tier 2 UVM modules and the Tier 3 UVM modules (RAL, callbacks, scoreboards, VIP, multi-agent, reset).',
    placementArea: 'methodology',
  },
  {
    id: 'assertions-coverage',
    name: 'Assertions and coverage',
    scope: 'Functional coverage (I-SV-3A, I-SV-3B), SVA (I-SV-4A, I-SV-4B) and checkers (I-SV-4C).',
    placementArea: 'debug',
    placementNote: 'That area covers coverage and debug habits, not assertions.',
  },
  {
    id: 'amba',
    name: 'AMBA',
    scope: 'The Tier 3 protocol modules: APB, AHB, AXI and the AMBA family modules.',
    placementArea: null,
  },
  {
    id: 'expert',
    name: 'Expert topics',
    scope: 'Tier 4: debug at scale, methodology customization, performance, formal, power, PSS, SoC and the electives.',
    placementArea: null,
  },
]);

const trackById = new Map(TRACKS.map((track) => [track.id, track]));

export function trackDefinition(id: TrackId): TrackDefinition {
  return trackById.get(id) as TrackDefinition;
}

/**
 * The track of a module folder, a module code or a flashcard deck id (they
 * all start with the module code, for example 'I-SV-4A_SVA_Fundamentals',
 * 'I-SV-4A' or 'I-SV-4A_Assertions_SVA_Fundamentals'). Null when the id does
 * not start with a known module code.
 */
export function trackForModule(id: string): TrackId | null {
  if (/^I-SV-[34][A-Z]?(?:[_-]|$)/.test(id)) return 'assertions-coverage';
  if (/^I-SV-9(?:[_-]|$)/.test(id)) return 'uvm';
  if (/^F\d/.test(id) || /^I-SV-\d/.test(id)) return 'systemverilog';
  if (/^(?:I|A)-UVM-/.test(id)) return 'uvm';
  if (/^B-[A-Z]+-/.test(id)) return 'amba';
  if (/^E-[A-Z]+/.test(id)) return 'expert';
  return null;
}

/** The module folder of a canonical lesson path, '/curriculum/<Tier>/<Module>/<lesson>'. */
function moduleFolderOf(href: string): string | null {
  const match = /^\/curriculum\/[^/]+\/([^/]+)\//.exec(href);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Static inputs (built on the server)
// ---------------------------------------------------------------------------

/** An available lab, as the assessment page needs it. */
export interface AssessmentLab {
  id: string;
  version: string;
  title: string;
  href: string;
  stepCount: number;
  /** The owning module's code, for example 'I-SV-4A'. */
  owningModule: string;
  /** Labs to finish first. */
  labPrerequisites: string[];
}

/** Where the placement quiz starts a learner for a tier, resolved on the server. */
export interface AssessmentPlacementPlan {
  tier: number;
  routeId: string;
  routeName: string;
  startHref: string;
  startTitle: string;
  startModuleCode: string;
}

export interface PlacementVersions {
  assessmentVersion: string;
  scoringVersion: string;
}

// ---------------------------------------------------------------------------
// Per-track summaries
// ---------------------------------------------------------------------------

/** Cards with a review interval of at least this many days count as well known. */
export const WELL_KNOWN_INTERVAL_DAYS = 21;

export interface TrackLessonCounts {
  total: number;
  opened: number;
  done: number;
}

export interface TrackQuizCounts {
  /** Lesson quizzes attempted at least once. */
  taken: number;
  /** Quizzes whose best score is at or over 75%. */
  passed: number;
  /** Mean of best / total over the quizzes taken, from 0 to 1; null when none was taken. */
  averageBest: number | null;
  /** Lessons with a quiz under 75%, lowest first. */
  weak: WeakQuizEntry[];
}

export interface WeakQuizEntry extends WeakQuizLesson {
  /** 'I-SV-4A: SVA Fundamentals'-style lesson name. */
  lessonName: string;
}

export interface TrackLabItem {
  id: string;
  title: string;
  href: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completedSteps: number;
  stepCount: number;
  updatedAt: number;
}

export interface TrackLabCounts {
  available: number;
  inProgress: number;
  completed: number;
  items: TrackLabItem[];
}

export interface TrackFlashcardCounts {
  /** Decks opened in a lesson or on the review page. */
  decks: number;
  /** Cards in those decks. */
  cards: number;
  /** Cards rated at least once. */
  reviewed: number;
  /** Cards with a review interval of WELL_KNOWN_INTERVAL_DAYS days or more. */
  wellKnown: number;
  /** Cards due today. */
  due: number;
}

export interface TrackPlacement {
  area: PlacementAreaId;
  /** Fraction correct in that area of the latest attempt, from 0 to 1. */
  percent: number;
  /** What the area does not measure for this track, when it covers only part of it. */
  note?: string;
}

export type RecommendationKind = 'retake-quiz' | 'resume-lab' | 'continue-lesson' | 'start-lesson' | 'review-cards' | 'start-lab';

export interface Recommendation {
  kind: RecommendationKind;
  /** The action, for example 'Retake the quiz in I-SV-4A: SVA Fundamentals'. */
  label: string;
  href: string;
  /** Why it is recommended, from the learner's own record. */
  reason: string;
}

export interface TrackSummary {
  id: TrackId;
  name: string;
  scope: string;
  lessons: TrackLessonCounts;
  modules: ModuleProgressSummary[];
  quizzes: TrackQuizCounts;
  labs: TrackLabCounts;
  flashcards: TrackFlashcardCounts;
  /** The placement area result that tests this track; null when the quiz does not test it or was not taken. */
  placement: TrackPlacement | null;
  /** True when the learner has any record in this track (placement alone does not count). */
  hasActivity: boolean;
  recommendations: Recommendation[];
}

export interface AssessmentInput {
  curriculum: readonly StaticTier[];
  labs: readonly AssessmentLab[];
  progress: CurriculumProgressData;
  lessonLog: LessonLogData;
  labRecords: readonly LabProgressRecord[];
  flashcards: FlashcardData;
  assessments: AssessmentData;
  now: number;
}

export interface AssessmentSummary {
  tracks: TrackSummary[];
  /** The newest placement attempt, or null. */
  placement: PlacementAttempt | null;
  /** True when anything at all is recorded: lessons, quizzes, labs, flashcards or a placement attempt. */
  hasData: boolean;
}

function emptyLessons(): TrackLessonCounts {
  return { total: 0, opened: 0, done: 0 };
}

function emptyFlashcards(): TrackFlashcardCounts {
  return { decks: 0, cards: 0, reviewed: 0, wellKnown: 0, due: 0 };
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The lab record to show for an available lab: the current version's, else the newest earlier one. */
function labRecordFor(lab: AssessmentLab, records: readonly LabProgressRecord[]): LabProgressRecord | null {
  const saved = records.filter((record) => record.labId === lab.id);
  if (saved.length === 0) return null;
  return saved.find((record) => record.labVersion === lab.version) ?? [...saved].sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

function lessonsDoneSet(progress: CurriculumProgressData, lessons: readonly IndexedStaticLesson[]): Set<string> {
  const done = new Set<string>();
  for (const lesson of lessons) {
    if (progress[lesson.moduleId]?.completedLessons.includes(lesson.slug)) done.add(lesson.href);
  }
  return done;
}

function lessonsOpenedSet(
  progress: CurriculumProgressData,
  lessonLog: LessonLogData,
  lessons: readonly IndexedStaticLesson[],
  done: ReadonlySet<string>,
): Set<string> {
  const opened = new Set<string>(done);
  for (const lesson of lessons) {
    if (lessonLog.lessons[lesson.href] !== undefined) opened.add(lesson.href);
    const entry = progress[lesson.moduleId];
    if (entry?.lastVisitedAt && (entry.lastVisitedLesson ?? 'index') === lesson.slug) opened.add(lesson.href);
  }
  return opened;
}

/**
 * The next lesson to read in a track: the first lesson not marked done after
 * the furthest lesson the learner has opened or finished (curriculum order),
 * else the first lesson not marked done. Null when every lesson is done.
 */
export function nextLessonInTrack(
  lessons: readonly IndexedStaticLesson[],
  done: ReadonlySet<string>,
  opened: ReadonlySet<string>,
): { lesson: IndexedStaticLesson; continuing: boolean } | null {
  let furthest = -1;
  lessons.forEach((lesson, index) => {
    if (opened.has(lesson.href)) furthest = index;
  });
  // An opened lesson that is not done yet is the one to finish.
  if (furthest >= 0 && !done.has(lessons[furthest].href)) return { lesson: lessons[furthest], continuing: true };
  for (let index = furthest + 1; index < lessons.length; index += 1) {
    if (!done.has(lessons[index].href)) return { lesson: lessons[index], continuing: furthest >= 0 };
  }
  const first = lessons.find((lesson) => !done.has(lesson.href));
  return first ? { lesson: first, continuing: furthest >= 0 } : null;
}

/** Up to this many next steps per track. */
export const RECOMMENDATIONS_PER_TRACK = 3;

/**
 * Builds the per-track summaries. Quiz results on lessons that are no longer
 * in the curriculum, lab records for labs that are not available, and decks
 * whose id does not start with a module code are left out, so every link on
 * the page points at a page that exists.
 */
export function buildAssessmentSummary(input: AssessmentInput): AssessmentSummary {
  const { curriculum, labs, progress, lessonLog, labRecords, flashcards, assessments, now } = input;
  const lessonIndex = indexStaticLessons(curriculum);
  const moduleSummary = tierAndModuleProgress(curriculum, progress, lessonLog);
  const allLessons = [...lessonIndex.values()];
  const done = lessonsDoneSet(progress, allLessons);
  const opened = lessonsOpenedSet(progress, lessonLog, allLessons, done);

  // Module code -> its position in the curriculum and its first lesson, for ordering labs.
  const moduleOrder = new Map<string, number>();
  const moduleTitle = new Map<string, string>();
  for (const tier of curriculum) {
    for (const mod of tier.modules) {
      if (!moduleOrder.has(mod.code)) moduleOrder.set(mod.code, moduleOrder.size);
      moduleTitle.set(mod.code, mod.title);
    }
  }

  const placement = assessments.placement[0] ?? null;
  const completedLabIds = new Set<string>();
  for (const lab of labs) {
    if (labRecordFor(lab, labRecords)?.status === 'completed') completedLabIds.add(lab.id);
  }

  const tracks = TRACKS.map((track): TrackSummary => {
    const trackLessons = allLessons.filter((lesson) => trackForModule(lesson.moduleId) === track.id);
    const trackLessonPaths = new Set(trackLessons.map((lesson) => lesson.href));
    const lessons = emptyLessons();
    const modules = moduleSummary.tiers.flatMap((tier) => tier.modules).filter((mod) => trackForModule(mod.id) === track.id);
    for (const mod of modules) {
      lessons.total += mod.total;
      lessons.opened += mod.opened;
      lessons.done += mod.done;
    }

    // Quizzes on lessons of this track that still exist.
    const trackQuizzes: Record<string, QuizResult> = {};
    for (const [key, result] of Object.entries(assessments.quizzes)) {
      if (trackLessonPaths.has(result.lessonPath) && result.total > 0) trackQuizzes[key] = result;
    }
    const quizList = Object.values(trackQuizzes);
    const quizzes: TrackQuizCounts = {
      taken: quizList.length,
      passed: quizList.filter((quiz) => quiz.best / quiz.total >= WEAK_QUIZ_THRESHOLD).length,
      averageBest: quizList.length > 0 ? quizList.reduce((sum, quiz) => sum + quiz.best / quiz.total, 0) / quizList.length : null,
      weak: weakQuizLessons(trackQuizzes).flatMap((weak) => {
        const lesson = lessonIndex.get(weak.lessonPath);
        return lesson ? [{ ...weak, lessonName: labelWithCode(lesson.moduleCode, lesson.title) }] : [];
      }),
    };

    // Labs owned by this track's modules, in curriculum order.
    const trackLabs = labs
      .filter((lab) => trackForModule(lab.owningModule) === track.id)
      .sort(
        (a, b) =>
          (moduleOrder.get(a.owningModule) ?? Number.MAX_SAFE_INTEGER) -
            (moduleOrder.get(b.owningModule) ?? Number.MAX_SAFE_INTEGER) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
    const labItems: TrackLabItem[] = trackLabs.map((lab) => {
      const record = labRecordFor(lab, labRecords);
      return {
        id: lab.id,
        title: lab.title,
        href: lab.href,
        status: record ? record.status : 'not_started',
        completedSteps: record ? Math.min(record.completedSteps.length, lab.stepCount) : 0,
        stepCount: lab.stepCount,
        updatedAt: record?.updatedAt ?? 0,
      };
    });
    const labCounts: TrackLabCounts = {
      available: labItems.length,
      inProgress: labItems.filter((item) => item.status === 'in_progress').length,
      completed: labItems.filter((item) => item.status === 'completed').length,
      items: labItems,
    };

    // Flashcards in decks of this track's modules.
    const cards = emptyFlashcards();
    for (const [deckId, deck] of Object.entries(flashcards.decks)) {
      const lessonModule = deck.lessons.map((lesson) => moduleFolderOf(lesson.href)).find((folder) => folder !== null);
      const deckTrack = trackForModule(deckId) ?? (lessonModule ? trackForModule(lessonModule) : null);
      if (deckTrack !== track.id) continue;
      cards.decks += 1;
      cards.cards += deck.cardIds.length;
      for (const cardId of deck.cardIds) {
        const state = flashcards.cards[cardId];
        if (!state || state.deckId !== deckId) continue;
        if (state.reviews > 0 || state.lastReviewedAt > 0) cards.reviewed += 1;
        if (state.interval >= WELL_KNOWN_INTERVAL_DAYS) cards.wellKnown += 1;
        if (isCardDue(state, now)) cards.due += 1;
      }
    }

    const area = track.placementArea;
    const areaResult = area && placement ? placement.categories.find((category) => category.id === area) : undefined;
    const trackPlacement: TrackPlacement | null =
      area && areaResult
        ? { area, percent: areaResult.percent, ...(track.placementNote ? { note: track.placementNote } : {}) }
        : null;

    const hasActivity =
      lessons.opened > 0 || quizzes.taken > 0 || labCounts.inProgress + labCounts.completed > 0 || cards.reviewed > 0;

    // Next steps, most specific first.
    const recommendations: Recommendation[] = [];
    const weakest = quizzes.weak[0];
    if (weakest) {
      const lesson = lessonIndex.get(weakest.lessonPath);
      const quiz = weakest.quizzes[0];
      if (lesson && quiz) {
        recommendations.push({
          kind: 'retake-quiz',
          label: `Reread and retake the quiz in ${labelWithCode(lesson.moduleCode, lesson.title)}`,
          href: lesson.href,
          reason: `Your best score is ${quiz.best} of ${quiz.total} (${pct(quiz.bestFraction)}), under ${pct(WEAK_QUIZ_THRESHOLD)}.`,
        });
      }
    }
    const resumable = [...labItems].filter((item) => item.status === 'in_progress').sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (resumable) {
      recommendations.push({
        kind: 'resume-lab',
        label: `Finish the lab: ${resumable.title}`,
        href: resumable.href,
        reason: `${resumable.completedSteps} of ${plural(resumable.stepCount, 'step', 'steps')} done.`,
      });
    }
    const next = nextLessonInTrack(trackLessons, done, opened);
    // Skipped when the retake already points at the same lesson.
    if (next && !recommendations.some((item) => item.href === next.lesson.href)) {
      const name = labelWithCode(next.lesson.moduleCode, next.lesson.title);
      recommendations.push(
        next.continuing
          ? {
              kind: 'continue-lesson',
              label: `Continue with ${name}`,
              href: next.lesson.href,
              reason: opened.has(next.lesson.href)
                ? 'You opened this lesson but have not marked it done.'
                : 'The next lesson you have not marked done.',
            }
          : {
              kind: 'start-lesson',
              label: `Start with ${name}`,
              href: next.lesson.href,
              reason: 'You have not opened a lesson in this track yet; this is its first lesson.',
            },
      );
    }
    if (cards.due > 0) {
      recommendations.push({
        kind: 'review-cards',
        label: 'Review your due flashcards',
        href: '/dashboard/review',
        reason: `${plural(cards.due, 'card is', 'cards are')} due today in this track.`,
      });
    }
    // A lab whose prerequisites are done and whose module the learner has started.
    const startable = labItems.find((item) => {
      if (item.status !== 'not_started') return false;
      const lab = trackLabs.find((candidate) => candidate.id === item.id);
      if (!lab || !lab.labPrerequisites.every((id) => completedLabIds.has(id))) return false;
      return trackLessons.some((lesson) => moduleCode(lesson.moduleId) === lab.owningModule && opened.has(lesson.href));
    });
    if (startable) {
      const lab = trackLabs.find((candidate) => candidate.id === startable.id) as AssessmentLab;
      const title = moduleTitle.get(lab.owningModule);
      recommendations.push({
        kind: 'start-lab',
        label: `Start the lab: ${startable.title}`,
        href: startable.href,
        reason: `It practices ${title ? labelWithCode(lab.owningModule, title) : lab.owningModule}, which you have started.`,
      });
    }

    return {
      id: track.id,
      name: track.name,
      scope: track.scope,
      lessons,
      modules,
      quizzes,
      labs: labCounts,
      flashcards: cards,
      placement: trackPlacement,
      hasActivity,
      recommendations: recommendations.slice(0, RECOMMENDATIONS_PER_TRACK),
    };
  });

  const hasData =
    placement !== null ||
    Object.keys(assessments.quizzes).length > 0 ||
    tracks.some((track) => track.hasActivity) ||
    labRecords.length > 0 ||
    Object.keys(flashcards.cards).length > 0 ||
    Object.keys(lessonLog.lessons).length > 0;

  return { tracks, placement, hasData };
}

/** True when the attempt was made with an earlier version of the placement quiz or its scoring. */
export function isStalePlacement(attempt: PlacementAttempt, versions: PlacementVersions | undefined): boolean {
  if (!versions) return false;
  return attempt.assessmentVersion !== versions.assessmentVersion || attempt.scoringVersion !== versions.scoringVersion;
}

/** The plan the placement quiz gave for this attempt, when its tier and route still match one. */
export function placementPlanFor(
  attempt: PlacementAttempt,
  plans: readonly AssessmentPlacementPlan[],
): AssessmentPlacementPlan | null {
  return plans.find((plan) => plan.tier === attempt.tier && plan.routeId === attempt.routeId) ?? null;
}
