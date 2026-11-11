'use client';

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { CodedLabel, withoutCode } from '@/components/curriculum/CodedLabel';
import { focusRing, inlineLink, primaryAction, secondaryAction, tagInLink, textLink } from '@/components/curriculum/overview-ui';
import { InterviewPractisedTile } from '@/components/learner/InterviewPractisedTile';
import { LearnerPageHeader } from '@/components/learner/LearnerSectionNav';
import { ProgressTraceLegend, ProgressTraceView } from '@/components/learner/ProgressTrace';
import { StorageStatusNote } from '@/components/learner/StorageStatusNote';
import { PageShell } from '@/components/layout/PageShell';
import { Section } from '@/components/layout/Section';
import { cardClass } from '@/components/ui/Card';
import { labelWithCode } from '@/lib/curriculum-overview';
import {
  continueAccessibleName,
  continueLabel,
  continueLesson,
  lastOpenedAt,
  type ContinueLessonEntry,
  type ContinuePosition,
} from '@/lib/continue-lesson';
import {
  backupReminder,
  dailyStreak,
  exerciseSummaries,
  hasLearnerData,
  indexStaticLessons,
  labSummaries,
  last7Days,
  quizzesOnKnownLessons,
  tierAndModuleProgress,
  trackedCardCount,
  weakQuizLessons,
  BACKUP_REMINDER_DAYS,
  type ActivityDay,
  type CurriculumProgressSummary,
  type ExerciseMeta,
  type ExerciseSummary,
  type IndexedStaticLesson,
  type LabMeta,
  type LabSummaries,
  type StaticTier,
  type WeakQuizLesson,
} from '@/lib/learner-stats';
import { LEARNER_DATA_CHANGED_EVENT } from '@/lib/learner-store/keys';
import { useHydrated, useKeyedRecordList, useRecord } from '@/lib/learner-store/react';
import { subscribeLearnerStore } from '@/lib/learner-store/record';
import { activityRecord } from '@/lib/learner-store/repositories/activity';
import { assessmentRecord, latestPlacementAttempt, type PlacementAttempt } from '@/lib/learner-store/repositories/assessments';
import { countDueCards, flashcardRecord } from '@/lib/learner-store/repositories/flashcards';
import { interviewPractisedRecord, practisedCount } from '@/lib/learner-store/repositories/interview';
import { labProgressRecords } from '@/lib/learner-store/repositories/labs';
import { readExerciseProgress, type StoredExerciseProgress } from '@/lib/learner-store/repositories/legacy';
import { curriculumProgressRecord, lessonLogRecord } from '@/lib/learner-store/repositories/lessons';
import { metaRecord, type LearnerMeta } from '@/lib/learner-store/repositories/meta';
import { notebookEntries, type NotebookEntry } from '@/lib/learner-store/repositories/notebook';
import type { ResolvedLesson } from '@/lib/learning-paths';
import {
  nextOnRoute,
  readSelectedRoute,
  routeAnchor,
  subscribeSelectedRoute,
  type RouteId,
} from '@/lib/learning-route-state';
import { siteLabel } from '@/lib/nav-labels';
import { usePersistenceTarget } from '@/lib/persistence/target';
import { emptyTraces, progressTraces, traceTotals, type TierTrace } from '@/lib/progress-trace';
import {
  CURRICULUM_HREF,
  DASHBOARD_HREF,
  LABS_HREF,
  NOTEBOOK_HREF,
  PLACEMENT_QUIZ_HREF,
  PRACTICE_HREF,
  REVIEW_HREF,
  SETTINGS_HREF,
  START_HERE_HREF,
  tierSectionHref,
} from '@/lib/site-links';
import { tierDataAttribute } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';

/** A learning route as "Continue" needs it: its name and lessons in route order. */
export interface DashboardRoute {
  id: RouteId;
  name: string;
  sequence: ResolvedLesson[];
}

export interface PlacementVersions {
  assessmentVersion: string;
  scoringVersion: string;
}

export interface DashboardPageClientProps {
  /** Every tier, module and lesson, built on the server from the curriculum data. */
  curriculum: readonly StaticTier[];
  routes: readonly DashboardRoute[];
  /** Available labs from the registry. */
  labs: readonly LabMeta[];
  exercises: readonly ExerciseMeta[];
  /** The placement quiz's current versions; an older saved attempt is marked as from an earlier quiz. */
  placementVersions?: PlacementVersions;
  /** Every lesson in course order (continueLessons()), for the one continue rule. */
  continueLessons: readonly ContinueLessonEntry[];
  /** Questions in every interview bank, counted on the server from the bank data. */
  interviewQuestionTotal: number;
}

const NO_EXERCISES: readonly StoredExerciseProgress[] = Object.freeze([]);
const serverRoute = () => null;

/**
 * The dashboard body's least height: the learner page minimum, raised to the
 * viewport less 20rem (the header, page header and the gap above the footer
 * take about 21 to 23rem at every width), so the footer starts below the fold
 * in every state.
 */
export const DASHBOARD_BODY_MIN_HEIGHT_CLASS =
  'min-h-[max(22rem,calc(100svh-20rem))] sm:min-h-[max(16rem,calc(100svh-20rem))]';

/**
 * The top slot's reserved height: it holds "Continue" and reviews due, the
 * empty state or the account notice, all read after hydration. The progress
 * traces below it render on the server, so the slot keeps the height of its
 * usual contents from the first paint and the traces do not move when the
 * browser's records arrive. Measured at 390, 700, 1024 and 1440 px.
 */
export const DASHBOARD_TOP_MIN_HEIGHT_CLASS = 'min-h-[30rem] sm:min-h-[25.5rem] md:min-h-[18rem]';

/*
 * Colour and glass (DESIGN.md section 11): "Continue", at the top of the page
 * over the colour field, is the one real glass card; the cards further down
 * are quiet glass. Nothing inside a card is another card.
 */
const card = cardClass({ variant: 'glassQuiet', padding: 'default', className: 'min-w-0' });
const muted = 'text-sm text-muted-foreground';
const listItem = 'flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm';
/** A text link that stands on its own line: a 40 px tall target (DESIGN.md section 5), not just its line of text. */
const standaloneLink = cn(textLink, 'mt-1 inline-flex min-h-10 items-center text-sm');

const BACKUP_HREF = `${SETTINGS_HREF}#data`;

const dateFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const weekdayLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

/** The day `ms` falls on. A time no Date can hold (Intl would throw 'Invalid time value') reads as unknown. */
function formatDate(ms: number): string {
  return Number.isFinite(new Date(ms).getTime()) ? dateFormat.format(ms) : 'an unknown date';
}

function dayDate(dayKey: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function percentText(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * Values only the browser has, read after mount: the clock and the exercise
 * scores useExerciseProgress keeps under its own keys. They are read again
 * when learner data changes in another tab, or after an import or reset.
 */
function useBrowserReads(): { now: number | null; exercises: readonly StoredExerciseProgress[] } {
  const [state, setState] = useState<{ now: number | null; exercises: readonly StoredExerciseProgress[] }>({
    now: null,
    exercises: NO_EXERCISES,
  });

  useEffect(() => {
    const refresh = () => setState({ now: Date.now(), exercises: readExerciseProgress() });
    refresh();
    const unsubscribe = subscribeLearnerStore(refresh);
    window.addEventListener(LEARNER_DATA_CHANGED_EVENT, refresh);
    return () => {
      unsubscribe();
      window.removeEventListener(LEARNER_DATA_CHANGED_EVENT, refresh);
    };
  }, []);

  return state;
}

/** A quiet-glass card in the activity grid, with an h3 under the section's h2. */
function DashboardCard({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn(card, className)}>
      <h3 id={id} className="text-h4 text-foreground">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Continue and reviews due
// ---------------------------------------------------------------------------

/**
 * Which Continue link carries the view's one filled accent: the lesson to
 * continue (DESIGN.md section 10: Continue comes first), otherwise the next
 * lesson on the learner's route.
 */
export function continuePrimary(hasContinue: boolean, hasNext: boolean): 'continue' | 'next' | null {
  if (hasContinue) return 'continue';
  if (hasNext) return 'next';
  return null;
}

/** The line over the lesson to continue: why it is the one. */
export function dashboardContinueEyebrow(position: ContinuePosition<ContinueLessonEntry>): string {
  return position.reason === 'next-after-done'
    ? `Next after ${position.lastOpened.code}, which you marked done`
    : 'Last opened';
}

/**
 * "Continue": one glass block. The lesson to continue leads, with the view's
 * accent; the route's next lesson sits beside it as the quieter action,
 * across a hairline. No card inside it.
 */
function ContinueBlock({
  position,
  lastAt,
  route,
  progress,
}: {
  position: ContinuePosition<ContinueLessonEntry> | null;
  /** When this browser last opened position.lastOpened, epoch ms. */
  lastAt: number | null;
  route: DashboardRoute | null;
  progress: Parameters<typeof nextOnRoute>[1];
}) {
  const routePosition = route ? nextOnRoute(route.sequence, progress) : null;
  const next = route && routePosition && routePosition.status !== 'complete' ? route.sequence[routePosition.index] : undefined;
  // The route's next lesson is the lesson to continue: one link, on the left.
  const nextIsContinue = Boolean(position && next && next.href === position.lesson.href);
  const primary = continuePrimary(Boolean(position), Boolean(next) && !nextIsContinue);

  return (
    <section
      aria-labelledby="dashboard-continue-heading"
      className={cardClass({ variant: 'glass', padding: 'default', className: 'grid min-w-0 gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-0' })}
    >
      <div className="min-w-0 md:pr-6">
        <h2 id="dashboard-continue-heading" className="text-h3 text-foreground">
          Continue
        </h2>
        <p className="mt-1 text-ui text-muted-foreground">{position ? dashboardContinueEyebrow(position) : 'Last opened'}</p>
        {position ? (
          <>
            <Link
              href={position.lesson.href}
              data-testid="dashboard-continue"
              aria-label={continueAccessibleName(position.lesson)}
              className={cn(primary === 'continue' ? primaryAction : secondaryAction, 'mt-4 max-w-full justify-start text-left')}
            >
              <span className="[overflow-wrap:anywhere]">
                {continueLabel(position.lesson)}: {position.lesson.title}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
            {lastAt !== null && (
              <p className="mt-2 text-label text-muted-foreground">
                {position.reason === 'next-after-done' ? `${position.lastOpened.code} opened` : 'Opened'} {formatDate(lastAt)}
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-foreground">No lesson opened in this browser yet.</p>
        )}
      </div>
      <div className="min-w-0 border-t border-border pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        {route ? (
          <>
            <h3 className="text-ui font-medium text-foreground">Next on your {route.name} route</h3>
            {next && nextIsContinue ? (
              <p className="mt-1 text-sm text-muted-foreground">It is the lesson to continue.</p>
            ) : next ? (
              <Link
                href={next.href}
                className={cn(primary === 'next' ? primaryAction : secondaryAction, 'mt-3 max-w-full justify-start text-left')}
              >
                <span className="[overflow-wrap:anywhere]">
                  {routePosition?.status === 'not-started' ? 'Start with ' : 'Continue with '}
                  {labelWithCode(next.moduleCode, next.title)}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                You have opened every lesson on this route.{' '}
                <Link href={START_HERE_HREF} className={inlineLink}>
                  Choose another route
                </Link>
                .
              </p>
            )}
          </>
        ) : (
          <>
            <h3 className="text-ui font-medium text-foreground">Your route</h3>
            <p className="mt-1 text-sm text-muted-foreground">You aren&apos;t following a learning route yet.</p>
            <Link href={START_HERE_HREF} className={standaloneLink}>
              Choose a route
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

/** Reviews due: the count and one way into the review queue; says so plainly when none are due. */
function ReviewsDue({ due, tracked }: { due: number; tracked: number }) {
  return (
    <section
      aria-labelledby="dashboard-review-heading"
      className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border pb-6"
    >
      <div className="min-w-0">
        <h2 id="dashboard-review-heading" className="text-h4 text-foreground">
          Reviews due
        </h2>
        <p className="mt-1 text-sm text-foreground" data-testid="dashboard-reviews-due">
          {due > 0 ? (
            <>
              <strong className="font-mono font-medium tabular-nums">{due}</strong> {due === 1 ? 'flashcard is' : 'flashcards are'}{' '}
              due today.
            </>
          ) : (
            'No flashcards are due today.'
          )}{' '}
          <span className="text-muted-foreground">
            {tracked > 0
              ? `${plural(tracked, 'card', 'cards')} in your review queue.`
              : "Rate a flashcard in a lesson's “Reinforce the essentials” section to start your review queue."}
          </span>
        </p>
      </div>
      <Link href={REVIEW_HREF} className={cn(secondaryAction, 'shrink-0')}>
        Open the review queue
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Progress traces
// ---------------------------------------------------------------------------

/** One tier: its name (linking to its section of the curriculum), its totals, its trace and the modules opened. */
function TierProgress({
  trace,
  modules,
}: {
  trace: TierTrace;
  /** The tier's module counts, after load; null in the server render. */
  modules: CurriculumProgressSummary['tiers'][number]['modules'] | null;
}) {
  const headingId = `dashboard-tier-${trace.tierId}`;
  const active = modules?.filter((mod) => mod.opened > 0) ?? [];
  const hrefs = new Map(trace.segments.map((segment) => [segment.id, segment.href]));
  return (
    <li className="min-w-0" data-tier={tierDataAttribute(trace.tier)}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
        <h3 id={headingId} className="flex items-center gap-2 text-h4 text-foreground">
          {trace.tier ? <span className="tier-step" aria-hidden="true" /> : null}
          <Link href={tierSectionHref(trace.tierId)} className={cn('rounded-sm underline-offset-4 hover:underline', focusRing)}>
            {trace.label}
          </Link>
        </h3>
        <p className="text-sm tabular-nums text-muted-foreground" data-testid="dashboard-tier-totals">
          {traceTotals(trace)}
        </p>
      </div>
      <ProgressTraceView trace={trace} className="mt-3" />
      {active.length > 0 && (
        <details className="mt-1">
          <summary className={cn('flex min-h-10 cursor-pointer items-center rounded-sm text-sm font-medium text-primary', focusRing)}>
            Modules you opened ({active.length})
          </summary>
          <ul className="mt-1">
            {active.map((mod) => (
              <li key={mod.id} className={cn(listItem, 'min-h-8 py-1')}>
                <Link
                  href={hrefs.get(mod.id) ?? CURRICULUM_HREF}
                  aria-label={labelWithCode(mod.code, mod.title)}
                  className={cn(textLink, 'group [overflow-wrap:anywhere]')}
                >
                  <CodedLabel code={mod.code} title={withoutCode(mod.title, mod.code)} tagClassName={tagInLink} />
                </Link>
                <span className="text-muted-foreground">
                  {mod.done} of {mod.total} done · {mod.opened} opened
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/**
 * The four tiers as progress traces. The server render draws every module not
 * started in the same boxes, so nothing moves when the browser's records
 * arrive.
 */
function ProgressSection({ traces, summary }: { traces: readonly TierTrace[]; summary: CurriculumProgressSummary | null }) {
  return (
    <Section
      id="dashboard-progress"
      title="Progress"
      className="mt-12"
      description={
        <span data-testid="dashboard-lesson-totals">
          {summary
            ? `${summary.done} done and ${summary.opened} opened, of ${summary.total} lessons.`
            : 'One segment per module, in course order.'}
        </span>
      }
    >
      <ProgressTraceLegend />
      <ul className="mt-6 space-y-8">
        {traces.map((trace, index) => (
          <TierProgress key={trace.tierId} trace={trace} modules={summary?.tiers[index]?.modules ?? null} />
        ))}
      </ul>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Activity cards
// ---------------------------------------------------------------------------

function LabsCard({ summaries }: { summaries: LabSummaries }) {
  const { inProgress, completed } = summaries;
  return (
    <DashboardCard id="dashboard-labs-heading" title="Labs">
      {inProgress.length + completed.length === 0 ? (
        <>
          <p className={muted}>No lab started in this browser yet.</p>
          <Link href={LABS_HREF} className={standaloneLink}>
            Browse the labs
          </Link>
        </>
      ) : (
        <div className="space-y-4">
          {inProgress.length > 0 && (
            <div>
              <h4 id="dashboard-labs-progress" className="text-sm font-medium text-foreground">
                In progress ({inProgress.length})
              </h4>
              <ul aria-labelledby="dashboard-labs-progress" className="mt-2 space-y-1.5">
                {inProgress.map((lab) => (
                  <li key={lab.id} className={listItem}>
                    <Link href={lab.href} className={cn(textLink, '[overflow-wrap:anywhere]')}>
                      {lab.title}
                    </Link>
                    <span className="text-muted-foreground">
                      {lab.completedSteps} of {plural(lab.stepCount, 'step', 'steps')} done
                      {lab.currentVersion ? '' : ' (an earlier version)'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <h4 id="dashboard-labs-done" className="text-sm font-medium text-foreground">
                Done ({completed.length})
              </h4>
              <ul aria-labelledby="dashboard-labs-done" className="mt-2 space-y-1.5">
                {completed.map((lab) => (
                  <li key={lab.id} className={listItem}>
                    <Link href={lab.href} className={cn(textLink, '[overflow-wrap:anywhere]')}>
                      {lab.title}
                    </Link>
                    <span className="text-muted-foreground">
                      {lab.completedAt ? `Completed ${formatDate(lab.completedAt)}` : 'Completed'}
                      {lab.currentVersion ? '' : ' (an earlier version)'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
}

function NotebookCard({ entries }: { entries: readonly NotebookEntry[] }) {
  const latest = entries.reduce<NotebookEntry | null>(
    (newest, entry) => (!newest || entry.updatedAt > newest.updatedAt ? entry : newest),
    null,
  );
  return (
    <DashboardCard id="dashboard-notebook-heading" title="Notebook">
      <p className="text-sm text-foreground">
        <strong className="font-mono text-xl font-medium tabular-nums">{entries.length}</strong>{' '}
        {entries.length === 1 ? 'note' : 'notes'}
      </p>
      {latest ? (
        <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {/* Learner-written text: rendered as plain text only. */}
          Latest: <span className="font-medium text-foreground">{latest.title.trim() || 'Untitled note'}</span>
          {latest.updatedAt > 0 ? ` · ${formatDate(latest.updatedAt)}` : ''}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Your “Teach it back” answers from lessons and your own notes are kept here.
        </p>
      )}
      <Link href={NOTEBOOK_HREF} className={cn(standaloneLink, 'mt-2')}>
        Open your notebook
      </Link>
    </DashboardCard>
  );
}

function PlacementCard({
  attempt,
  routeName,
  stale,
}: {
  attempt: PlacementAttempt | null;
  routeName: string | null;
  stale: boolean;
}) {
  return (
    <DashboardCard id="dashboard-placement-heading" title="Placement">
      {attempt ? (
        <>
          <p className="text-sm text-foreground">
            <strong className="font-medium">Start in Tier {attempt.tier}</strong>
            {routeName ? ` on the ${routeName} route` : ''}, {percentText(attempt.percent)} ·{' '}
            {formatDate(attempt.completedAt)}
          </p>
          {stale && <p className="mt-1 text-sm text-muted-foreground">The quiz has changed since this attempt.</p>}
          <div className="mt-2 flex flex-wrap gap-x-5 text-sm">
            {routeName && (
              <Link href={`${CURRICULUM_HREF}#${routeAnchor(attempt.routeId)}`} className={cn(textLink, 'inline-flex min-h-10 items-center')}>
                See the {routeName} route
              </Link>
            )}
            <Link href={PLACEMENT_QUIZ_HREF} className={cn(textLink, 'inline-flex min-h-10 items-center')}>
              Retake the quiz
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className={muted}>You haven&apos;t taken the placement quiz in this browser.</p>
          <Link href={PLACEMENT_QUIZ_HREF} className={standaloneLink}>
            {siteLabel(PLACEMENT_QUIZ_HREF)}
          </Link>
        </>
      )}
    </DashboardCard>
  );
}

function QuizzesCard({
  taken,
  weak,
  lessons,
}: {
  taken: number;
  weak: readonly WeakQuizLesson[];
  lessons: ReadonlyMap<string, IndexedStaticLesson>;
}) {
  return (
    <DashboardCard id="dashboard-quizzes-heading" title="Quizzes">
      {taken === 0 ? (
        <p className={muted}>No lesson quiz taken in this browser yet.</p>
      ) : (
        <>
          <p className="text-sm text-foreground">{plural(taken, 'lesson quiz', 'lesson quizzes')} taken.</p>
          {weak.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Every quiz you took has a best score of 75% or more.</p>
          ) : (
            <>
              <h4 id="dashboard-quizzes-weak" className="mt-3 text-sm font-medium text-foreground">
                Under 75%: worth another look
              </h4>
              <ul aria-labelledby="dashboard-quizzes-weak" className="mt-2 space-y-1.5">
                {weak.map((entry) => {
                  // The link always comes from the curriculum index, never from the stored path.
                  const lesson = lessons.get(entry.lessonPath);
                  if (!lesson) return null;
                  const lowest = entry.quizzes[0];
                  return (
                    <li key={entry.lessonPath} className={listItem}>
                      <Link
                        href={lesson.href}
                        aria-label={labelWithCode(lesson.moduleCode, lesson.title)}
                        className={cn(textLink, 'group [overflow-wrap:anywhere]')}
                      >
                        <CodedLabel code={lesson.moduleCode} title={withoutCode(lesson.title, lesson.moduleCode)} tagClassName={tagInLink} />
                      </Link>
                      <span className="text-muted-foreground">
                        best {lowest.best} of {lowest.total} ({percentText(lowest.bestFraction)})
                        {entry.quizzes.length > 1 ? `, ${entry.quizzes.length} quizzes` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </DashboardCard>
  );
}

function ExercisesCard({ summaries }: { summaries: readonly ExerciseSummary[] }) {
  return (
    <DashboardCard id="dashboard-exercises-heading" title="Exercises">
      {summaries.length === 0 ? (
        <>
          <p className={muted}>No exercise attempted in this browser yet.</p>
          <Link href={PRACTICE_HREF} className={standaloneLink}>
            Browse practice
          </Link>
        </>
      ) : (
        <ul className="space-y-1.5">
          {summaries.map((exercise) => (
            <li key={exercise.id} className={listItem}>
              {exercise.href ? (
                <Link href={exercise.href} className={cn(textLink, '[overflow-wrap:anywhere]')}>
                  {exercise.title}
                </Link>
              ) : (
                <span className="font-medium text-foreground [overflow-wrap:anywhere]">{exercise.title}</span>
              )}
              <span className="text-muted-foreground">
                best {exercise.bestScore}% · {plural(exercise.attempts, 'attempt', 'attempts')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

function StreakCard({ streak, days }: { streak: number; days: readonly ActivityDay[] }) {
  const busiest = Math.max(1, ...days.map((day) => day.total));
  return (
    <DashboardCard id="dashboard-streak-heading" title="Streak and the last 7 days">
      <p className="text-sm text-foreground">
        <strong className="font-mono text-xl font-medium tabular-nums">{streak}</strong> {streak === 1 ? 'day' : 'days'} in a
        row
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        A day counts when you open a lesson, finish a lab step, review flashcards, take a quiz or write a note, by
        this device&apos;s clock.
      </p>
      <ol aria-label="Activity in the last 7 days" className="mt-4 grid max-w-md grid-cols-7 gap-1.5">
        {days.map((day) => {
          const date = dayDate(day.dayKey);
          const height = day.total > 0 ? Math.max(8, Math.round((day.total / busiest) * 100)) : 0;
          return (
            <li key={day.dayKey} className="flex min-w-0 flex-col items-center gap-1">
              <span aria-hidden="true" className="flex h-12 w-full items-end overflow-hidden rounded bg-muted">
                <span className="block w-full rounded-sm bg-success" style={{ height: `${height}%` }} />
              </span>
              <span aria-hidden="true" className="font-mono text-xs font-medium tabular-nums text-foreground">
                {day.total}
              </span>
              <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
                {weekdayShort.format(date)}
              </span>
              <span className="sr-only">
                {weekdayLong.format(date)}: {plural(day.total, 'activity', 'activities')}
              </span>
            </li>
          );
        })}
      </ol>
    </DashboardCard>
  );
}

function DataCard({ meta, remind }: { meta: LearnerMeta; remind: boolean }) {
  return (
    <section aria-labelledby="dashboard-data-heading" className={cn(card, 'mt-5')}>
      <h2 id="dashboard-data-heading" className="text-h4 text-foreground">
        Your data
      </h2>
      <p className="mt-3 max-w-[40em] text-sm text-foreground">
        Everything on this page is stored only in this browser. Download a backup to keep it safe or to move it to
        another browser.
      </p>
      {remind && (
        <p className="mt-3 rounded-lg border border-warning/50 bg-warning-subtle p-3 text-sm font-medium text-foreground">
          {meta.lastExportAt
            ? `Your last backup is from ${formatDate(meta.lastExportAt)}, more than ${BACKUP_REMINDER_DAYS} days ago.`
            : "You haven't downloaded a backup yet."}{' '}
          Download one so your progress isn&apos;t lost.
        </p>
      )}
      {!remind && meta.lastExportAt ? (
        <p className="mt-2 text-sm text-muted-foreground">Last backup: {formatDate(meta.lastExportAt)}.</p>
      ) : null}
      <p className="mt-2 text-sm text-muted-foreground">
        Some browsers clear site data for sites they haven&apos;t seen for a while.
      </p>
      <Link href={BACKUP_HREF} className={cn(secondaryAction, 'mt-4')}>
        Back up or reset your data
      </Link>
    </section>
  );
}

function EmptyState() {
  return (
    <section
      aria-labelledby="dashboard-empty-heading"
      className={cardClass({ variant: 'glass', className: 'flex flex-1 flex-col p-5 sm:p-8' })}
    >
      <h2 id="dashboard-empty-heading" className="text-h3 text-foreground">
        Nothing recorded in this browser yet
      </h2>
      <p className="mt-2 max-w-[30em] text-sm text-muted-foreground">
        Open a lesson, finish a lab step, rate a flashcard or take a quiz, and it shows up here. It stays in this
        browser.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href={PLACEMENT_QUIZ_HREF} className={primaryAction}>
          {siteLabel(PLACEMENT_QUIZ_HREF)}
        </Link>
        <Link href={`${CURRICULUM_HREF}#${routeAnchor('junior')}`} className={secondaryAction}>
          Begin the Junior route
        </Link>
      </div>
      {/* mt-auto: the top slot's spare height sits inside the card, above this footer line, not under the card. */}
      <p className="mt-auto pt-5 text-sm text-muted-foreground">
        Moving from another browser?{' '}
        <Link href={BACKUP_HREF} className={inlineLink}>
          Import a backup
        </Link>{' '}
        in {siteLabel(SETTINGS_HREF)}.
      </p>
    </section>
  );
}

function AccountNotice() {
  return (
    <section aria-labelledby="dashboard-account-heading" className={cn(card, 'flex flex-1 flex-col')}>
      <h2 id="dashboard-account-heading" className="text-h3 text-foreground">
        Your progress is saved to your account
      </h2>
      <p className="mt-2 max-w-[30em] text-sm text-muted-foreground">
        While you are signed in, new progress is saved to your account. This page reads only what is stored in this
        browser, so it does not show account progress yet.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/**
 * The learner dashboard, read from the learner records in this browser, in
 * the order DESIGN.md section 10 sets: "Continue", reviews due, the progress
 * traces, then everything else. The server render and the hydrating render
 * show the heading, a neutral line in the top slot and every tier's trace not
 * started; the records fill them right after hydration. It never writes and
 * makes no request: while the persistence target is 'server' (accounts with
 * server sync), it says so instead of presenting local data as the learner's
 * progress.
 */
export default function DashboardPageClient({
  curriculum,
  routes,
  labs,
  exercises: exerciseMeta,
  placementVersions,
  continueLessons,
  interviewQuestionTotal,
}: DashboardPageClientProps) {
  const hydrated = useHydrated();
  const { target, ready: targetReady } = usePersistenceTarget();
  const progress = useRecord(curriculumProgressRecord);
  const lessonLog = useRecord(lessonLogRecord);
  const labEntries = useKeyedRecordList(labProgressRecords);
  const flashcards = useRecord(flashcardRecord);
  const notebookList = useKeyedRecordList(notebookEntries);
  const assessments = useRecord(assessmentRecord);
  const activity = useRecord(activityRecord);
  const interviewPractised = useRecord(interviewPractisedRecord);
  const meta = useRecord(metaRecord);
  const selectedRoute = useSyncExternalStore(subscribeSelectedRoute, readSelectedRoute, serverRoute);
  const { now, exercises } = useBrowserReads();

  const lessons = useMemo(() => indexStaticLessons(curriculum), [curriculum]);
  const labRecords = useMemo(() => labEntries.map((entry) => entry.value), [labEntries]);
  const notebook = useMemo(() => notebookList.map((entry) => entry.value), [notebookList]);
  const lessonSummary = useMemo(
    () => tierAndModuleProgress(curriculum, progress, lessonLog),
    [curriculum, progress, lessonLog],
  );
  const position = useMemo(() => continueLesson(lessonLog, progress, continueLessons), [lessonLog, progress, continueLessons]);
  const serverTraces = useMemo(() => emptyTraces(curriculum), [curriculum]);
  const traces = useMemo(
    () => progressTraces(curriculum, progress, lessonLog, position?.lesson.href ?? null),
    [curriculum, progress, lessonLog, position],
  );
  const labProgress = useMemo(() => labSummaries(labRecords, labs), [labRecords, labs]);
  // Only quizzes on lessons that still exist: a stored lessonPath is never used as a link on its own.
  const knownQuizzes = useMemo(() => quizzesOnKnownLessons(assessments.quizzes, lessons), [assessments.quizzes, lessons]);
  const weak = useMemo(() => weakQuizLessons(knownQuizzes), [knownQuizzes]);
  const exerciseList = useMemo(() => exerciseSummaries(exercises, exerciseMeta), [exercises, exerciseMeta]);

  const loaded = hydrated && targetReady && now !== null;
  const local = loaded && target !== 'server';
  const hasData =
    local &&
    hasLearnerData({
      curriculum: progress,
      lessonLog,
      labs: labRecords,
      flashcards,
      notebook,
      assessments,
      activity: activity.days,
      exercises,
      interview: practisedCount(interviewPractised) > 0,
    });

  let top: React.ReactNode;
  let rest: React.ReactNode = null;
  if (!loaded) {
    top = <p className={muted}>Reading what this browser has saved…</p>;
  } else if (target === 'server') {
    top = <AccountNotice />;
  } else if (!hasData) {
    top = <EmptyState />;
  } else {
    const lastAt = position ? lastOpenedAt(lessonLog, progress, position.lastOpened.href) : null;
    const route = routes.find((candidate) => candidate.id === selectedRoute) ?? null;
    const attempt = latestPlacementAttempt(assessments);
    const attemptRoute = attempt ? routes.find((candidate) => candidate.id === attempt.routeId) : undefined;
    const stale = Boolean(
      attempt &&
        placementVersions &&
        (attempt.assessmentVersion !== placementVersions.assessmentVersion ||
          attempt.scoringVersion !== placementVersions.scoringVersion),
    );
    top = (
      <>
        <ContinueBlock position={position} lastAt={lastAt} route={route} progress={progress} />
        <ReviewsDue due={countDueCards(flashcards, now)} tracked={trackedCardCount(flashcards)} />
      </>
    );
    rest = (
      <>
        <Section id="dashboard-activity" title="Labs, quizzes and notes" className="mt-12">
          {/* items-start: each card is as tall as what it says, never stretched to its neighbour with empty glass. */}
          <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
            <LabsCard summaries={labProgress} />
            <QuizzesCard taken={Object.keys(knownQuizzes).length} weak={weak} lessons={lessons} />
            <ExercisesCard summaries={exerciseList} />
            <PlacementCard attempt={attempt} routeName={attemptRoute?.name ?? null} stale={stale} />
            <NotebookCard entries={notebook} />
            <StreakCard streak={dailyStreak(activity.days, now)} days={last7Days(activity.days, now)} />
            <InterviewPractisedTile total={interviewQuestionTotal} />
          </div>
        </Section>
        <DataCard meta={meta} remind={backupReminder(meta, true, now)} />
      </>
    );
  }

  return (
    <PageShell width="content">
      <LearnerPageHeader
        current="dashboard"
        title={siteLabel(DASHBOARD_HREF)}
        lead="The lessons, labs, reviews, notes and quiz results recorded in this browser, and what to do next."
        meta={<StorageStatusNote savedLabel="Stored only in this browser" />}
      />
      <div data-testid="dashboard-body" aria-busy={!loaded} className={DASHBOARD_BODY_MIN_HEIGHT_CLASS}>
        <div data-testid="dashboard-top" className={cn('flex flex-col', DASHBOARD_TOP_MIN_HEIGHT_CLASS)}>
          {top}
        </div>
        {/* Account progress is not in this browser: no traces drawn from local records then. */}
        {loaded && target === 'server' ? null : (
          <ProgressSection traces={local ? traces : serverTraces} summary={hasData ? lessonSummary : null} />
        )}
        {rest}
      </div>
    </PageShell>
  );
}
