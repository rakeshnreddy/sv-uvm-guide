'use client';

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { eyebrow, focusRing, inlineLink, primaryAction, secondaryAction, textLink } from '@/components/curriculum/overview-ui';
import { LearnerSectionNav } from '@/components/learner/LearnerSectionNav';
import { StorageStatusNote } from '@/components/learner/StorageStatusNote';
import { labelWithCode } from '@/lib/curriculum-overview';
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
import { labProgressRecords } from '@/lib/learner-store/repositories/labs';
import { readExerciseProgress, type StoredExerciseProgress } from '@/lib/learner-store/repositories/legacy';
import { curriculumProgressRecord, lessonLogRecord } from '@/lib/learner-store/repositories/lessons';
import { metaRecord, type LearnerMeta } from '@/lib/learner-store/repositories/meta';
import { notebookEntries, type NotebookEntry } from '@/lib/learner-store/repositories/notebook';
import type { ResolvedLesson } from '@/lib/learning-paths';
import {
  lastVisit,
  nextOnRoute,
  readSelectedRoute,
  routeAnchor,
  subscribeSelectedRoute,
  type RouteId,
} from '@/lib/learning-route-state';
import { usePersistenceTarget } from '@/lib/persistence/target';
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
}

const NO_EXERCISES: readonly StoredExerciseProgress[] = Object.freeze([]);
const serverRoute = () => null;

const card = 'min-w-0 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6';
const panel = 'min-w-0 rounded-2xl border border-border bg-background p-4';
const muted = 'text-sm text-muted-foreground';
const listItem = 'flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm';

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
      <h2 id={id} className="text-lg font-semibold text-foreground sm:text-xl">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A decorative bar; the numbers next to it carry the information. */
function Bar({ percent }: { percent: number }) {
  return (
    <div aria-hidden="true" className="mt-2 h-2 w-full rounded-full bg-muted">
      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

interface LastOpened {
  lesson: IndexedStaticLesson;
  at: number;
}

function ContinueCard({
  last,
  route,
  progress,
}: {
  last: LastOpened | null;
  route: DashboardRoute | null;
  progress: Parameters<typeof nextOnRoute>[1];
}) {
  const position = route ? nextOnRoute(route.sequence, progress) : null;
  const next = route && position && position.status !== 'complete' ? route.sequence[position.index] : undefined;

  return (
    <DashboardCard id="dashboard-continue-heading" title="Continue" className="md:col-span-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={panel}>
          <p className={eyebrow}>Last opened</p>
          {last ? (
            <>
              <Link href={last.lesson.href} className={cn(secondaryAction, 'mt-3 max-w-full')}>
                <span className="[overflow-wrap:anywhere]">
                  Back to {labelWithCode(last.lesson.moduleCode, last.lesson.title)}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
              <p className="mt-2 text-xs text-muted-foreground">Opened {formatDate(last.at)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-foreground">No lesson opened in this browser yet.</p>
          )}
        </div>
        <div className={panel}>
          {route ? (
            <>
              <p className={eyebrow}>Next on your {route.name} route</p>
              {next ? (
                <Link href={next.href} className={cn(primaryAction, 'mt-3 max-w-full')}>
                  <span className="[overflow-wrap:anywhere]">
                    {position?.status === 'not-started' ? 'Start with ' : 'Continue with '}
                    {labelWithCode(next.moduleCode, next.title)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              ) : (
                <p className="mt-1 text-sm text-foreground">
                  You have opened every lesson on this route.{' '}
                  <Link href="/curriculum#routes" className={inlineLink}>
                    Choose another route
                  </Link>
                  .
                </p>
              )}
            </>
          ) : (
            <>
              <p className={eyebrow}>Your route</p>
              <p className="mt-1 text-sm text-foreground">You aren&apos;t following a learning route yet.</p>
              <Link href="/curriculum#routes" className={cn(textLink, 'mt-2 inline-block text-sm')}>
                Choose a route
              </Link>
            </>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}

function LessonsCard({ summary, moduleHrefs }: { summary: CurriculumProgressSummary; moduleHrefs: ReadonlyMap<string, string> }) {
  return (
    <DashboardCard id="dashboard-lessons-heading" title="Lessons" className="md:col-span-2">
      <p className="text-sm text-foreground" data-testid="dashboard-lesson-totals">
        <strong className="font-semibold">{summary.done}</strong> done and{' '}
        <strong className="font-semibold">{summary.opened}</strong> opened, of {summary.total} lessons.
      </p>
      <ul className="mt-4 space-y-5">
        {summary.tiers.map((tier) => {
          const active = tier.modules.filter((mod) => mod.opened > 0);
          return (
            <li key={tier.id} className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-sm font-semibold text-foreground">{tier.label}</h3>
                <p className={muted}>
                  {tier.done} of {tier.total} done ({tier.percentDone}%) · {tier.opened} opened
                </p>
              </div>
              <Bar percent={tier.percentDone} />
              {active.length > 0 && (
                <details className="mt-2">
                  <summary className={cn('cursor-pointer rounded-sm text-sm font-medium text-primary', focusRing)}>
                    Modules you opened ({active.length})
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {active.map((mod) => (
                      <li key={mod.id} className={listItem}>
                        <Link href={moduleHrefs.get(mod.id) ?? '/curriculum'} className={cn(textLink, '[overflow-wrap:anywhere]')}>
                          {labelWithCode(mod.code, mod.title)}
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
        })}
      </ul>
    </DashboardCard>
  );
}

function LabsCard({ summaries }: { summaries: LabSummaries }) {
  const { inProgress, completed } = summaries;
  return (
    <DashboardCard id="dashboard-labs-heading" title="Labs">
      {inProgress.length + completed.length === 0 ? (
        <>
          <p className={muted}>No lab started in this browser yet.</p>
          <Link href="/practice#labs" className={cn(textLink, 'mt-2 inline-block text-sm')}>
            Browse the labs
          </Link>
        </>
      ) : (
        <div className="space-y-4">
          {inProgress.length > 0 && (
            <div>
              <h3 id="dashboard-labs-progress" className="text-sm font-semibold text-foreground">
                In progress ({inProgress.length})
              </h3>
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
              <h3 id="dashboard-labs-done" className="text-sm font-semibold text-foreground">
                Done ({completed.length})
              </h3>
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

function ReviewCard({ due, tracked }: { due: number; tracked: number }) {
  return (
    <DashboardCard id="dashboard-review-heading" title="Review">
      <p className="text-sm text-foreground">
        <strong className="text-2xl font-semibold">{due}</strong> {due === 1 ? 'card' : 'cards'} due today
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {tracked > 0
          ? `${plural(tracked, 'card', 'cards')} in your review queue.`
          : "Rate a flashcard in a lesson's “Reinforce the essentials” section to start your review queue."}
      </p>
      <Link href="/dashboard/review" className={cn(textLink, 'mt-3 inline-block text-sm')}>
        Open the review queue
      </Link>
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
        <strong className="text-2xl font-semibold">{entries.length}</strong> {entries.length === 1 ? 'note' : 'notes'}
      </p>
      {latest ? (
        <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {/* Learner-written text: rendered as plain text only. */}
          Latest: <span className="font-medium text-foreground">{latest.title.trim() || 'Untitled note'}</span>
          {latest.updatedAt > 0 ? ` · ${formatDate(latest.updatedAt)}` : ''}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Your “Teach it back” answers from lessons and your own notes are kept here.
        </p>
      )}
      <Link href="/dashboard/notebook" className={cn(textLink, 'mt-3 inline-block text-sm')}>
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
            <strong className="font-semibold">Start in Tier {attempt.tier}</strong>
            {routeName ? ` on the ${routeName} route` : ''}, {percentText(attempt.percent)} ·{' '}
            {formatDate(attempt.completedAt)}
          </p>
          {stale && (
            <p className="mt-1 text-xs text-muted-foreground">The quiz has changed since this attempt.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {routeName && (
              <Link href={`/curriculum#${routeAnchor(attempt.routeId)}`} className={textLink}>
                See the {routeName} route
              </Link>
            )}
            <Link href="/quiz/placement" className={textLink}>
              Retake the quiz
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className={muted}>You haven&apos;t taken the placement quiz in this browser.</p>
          <Link href="/quiz/placement" className={cn(textLink, 'mt-2 inline-block text-sm')}>
            Find your level
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
            <p className="mt-1 text-xs text-muted-foreground">Every quiz you took has a best score of 75% or more.</p>
          ) : (
            <>
              <h3 id="dashboard-quizzes-weak" className="mt-3 text-sm font-semibold text-foreground">
                Under 75%: worth another look
              </h3>
              <ul aria-labelledby="dashboard-quizzes-weak" className="mt-2 space-y-1.5">
                {weak.map((entry) => {
                  // The link always comes from the curriculum index, never from the stored path.
                  const lesson = lessons.get(entry.lessonPath);
                  if (!lesson) return null;
                  const lowest = entry.quizzes[0];
                  return (
                    <li key={entry.lessonPath} className={listItem}>
                      <Link href={lesson.href} className={cn(textLink, '[overflow-wrap:anywhere]')}>
                        {labelWithCode(lesson.moduleCode, lesson.title)}
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
          <Link href="/practice" className={cn(textLink, 'mt-2 inline-block text-sm')}>
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
    <DashboardCard id="dashboard-streak-heading" title="Streak and the last 7 days" className="md:col-span-2">
      <p className="text-sm text-foreground">
        <strong className="text-2xl font-semibold">{streak}</strong> {streak === 1 ? 'day' : 'days'} in a row
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        A day counts when you open a lesson, finish a lab step, review flashcards, take a quiz or write a note, by
        this device&apos;s clock.
      </p>
      <ol aria-label="Activity in the last 7 days" className="mt-4 grid max-w-md grid-cols-7 gap-1.5">
        {days.map((day) => {
          const date = dayDate(day.dayKey);
          const height = day.total > 0 ? Math.max(8, Math.round((day.total / busiest) * 100)) : 0;
          return (
            <li key={day.dayKey} className="flex min-w-0 flex-col items-center gap-1">
              <span aria-hidden="true" className="flex h-16 w-full items-end overflow-hidden rounded-md bg-muted">
                <span className="block w-full rounded-md bg-primary" style={{ height: `${height}%` }} />
              </span>
              <span aria-hidden="true" className="text-xs font-semibold text-foreground">
                {day.total}
              </span>
              <span aria-hidden="true" className="text-[11px] text-muted-foreground">
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
    <DashboardCard id="dashboard-data-heading" title="Your data" className="md:col-span-2">
      <p className="text-sm text-foreground">
        Everything on this page is stored only in this browser. Download a backup to keep it safe or to move it to
        another browser.
      </p>
      {remind && (
        <p className="mt-3 rounded-2xl border border-amber-700/50 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-300/50 dark:bg-amber-950/40 dark:text-amber-100">
          {meta.lastExportAt
            ? `Your last backup is from ${formatDate(meta.lastExportAt)}, more than ${BACKUP_REMINDER_DAYS} days ago.`
            : "You haven't downloaded a backup yet."}{' '}
          Download one so your progress isn&apos;t lost.
        </p>
      )}
      {!remind && meta.lastExportAt ? (
        <p className="mt-2 text-xs text-muted-foreground">Last backup: {formatDate(meta.lastExportAt)}.</p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        Some browsers clear site data for sites they haven&apos;t seen for a while.
      </p>
      <Link href="/settings#data" className={cn(primaryAction, 'mt-4')}>
        Back up or reset your data
      </Link>
    </DashboardCard>
  );
}

function EmptyState() {
  return (
    <section aria-labelledby="dashboard-empty-heading" className={cn(card, 'sm:p-8')}>
      <h2 id="dashboard-empty-heading" className="text-xl font-semibold text-foreground sm:text-2xl">
        Nothing recorded in this browser yet
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Open a lesson, finish a lab step, rate a flashcard or take a quiz, and it shows up here. It stays in this
        browser.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href="/quiz/placement" className={primaryAction}>
          Find your level
        </Link>
        <Link href="/curriculum#route-junior" className={secondaryAction}>
          Begin the Junior route
        </Link>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        Moving from another browser?{' '}
        <Link href="/settings#data" className={inlineLink}>
          Import a backup
        </Link>{' '}
        in Settings.
      </p>
    </section>
  );
}

function AccountNotice() {
  return (
    <section aria-labelledby="dashboard-account-heading" className={card}>
      <h2 id="dashboard-account-heading" className="text-xl font-semibold text-foreground">
        Your progress is saved to your account
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
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
 * The learner dashboard, read from the learner records in this browser. The
 * server render and the hydrating render show only the heading and a neutral
 * line; the cards appear right after hydration. It never writes and makes no
 * request: while the persistence target is 'server' (accounts with server
 * sync), it says so instead of presenting local data as the learner's
 * progress.
 */
export default function DashboardPageClient({
  curriculum,
  routes,
  labs,
  exercises: exerciseMeta,
  placementVersions,
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
  const meta = useRecord(metaRecord);
  const selectedRoute = useSyncExternalStore(subscribeSelectedRoute, readSelectedRoute, serverRoute);
  const { now, exercises } = useBrowserReads();

  const lessons = useMemo(() => indexStaticLessons(curriculum), [curriculum]);
  const moduleHrefs = useMemo(() => {
    const hrefs = new Map<string, string>();
    for (const tier of curriculum) {
      for (const mod of tier.modules) {
        const first = mod.lessons.find((lesson) => lesson.slug === 'index') ?? mod.lessons[0];
        if (first) hrefs.set(mod.id, first.href);
      }
    }
    return hrefs;
  }, [curriculum]);
  const labRecords = useMemo(() => labEntries.map((entry) => entry.value), [labEntries]);
  const notebook = useMemo(() => notebookList.map((entry) => entry.value), [notebookList]);
  const lessonSummary = useMemo(
    () => tierAndModuleProgress(curriculum, progress, lessonLog),
    [curriculum, progress, lessonLog],
  );
  const labProgress = useMemo(() => labSummaries(labRecords, labs), [labRecords, labs]);
  // Only quizzes on lessons that still exist: a stored lessonPath is never used as a link on its own.
  const knownQuizzes = useMemo(() => quizzesOnKnownLessons(assessments.quizzes, lessons), [assessments.quizzes, lessons]);
  const weak = useMemo(() => weakQuizLessons(knownQuizzes), [knownQuizzes]);
  const exerciseList = useMemo(() => exerciseSummaries(exercises, exerciseMeta), [exercises, exerciseMeta]);

  const loaded = hydrated && targetReady && now !== null;

  let body: React.ReactNode;
  if (!loaded) {
    body = <p className={muted}>Reading what this browser has saved…</p>;
  } else if (target === 'server') {
    body = <AccountNotice />;
  } else {
    const hasData = hasLearnerData({
      curriculum: progress,
      lessonLog,
      labs: labRecords,
      flashcards,
      notebook,
      assessments,
      activity: activity.days,
      exercises,
    });
    if (!hasData) {
      body = <EmptyState />;
    } else {
      const last = latestLesson(progress, lessonLog, lessons);
      const route = routes.find((candidate) => candidate.id === selectedRoute) ?? null;
      const attempt = latestPlacementAttempt(assessments);
      const attemptRoute = attempt ? routes.find((candidate) => candidate.id === attempt.routeId) : undefined;
      const stale = Boolean(
        attempt &&
          placementVersions &&
          (attempt.assessmentVersion !== placementVersions.assessmentVersion ||
            attempt.scoringVersion !== placementVersions.scoringVersion),
      );
      body = (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ContinueCard last={last} route={route} progress={progress} />
          <LessonsCard summary={lessonSummary} moduleHrefs={moduleHrefs} />
          <LabsCard summaries={labProgress} />
          <ReviewCard due={countDueCards(flashcards, now)} tracked={trackedCardCount(flashcards)} />
          <NotebookCard entries={notebook} />
          <PlacementCard attempt={attempt} routeName={attemptRoute?.name ?? null} stale={stale} />
          <QuizzesCard taken={Object.keys(knownQuizzes).length} weak={weak} lessons={lessons} />
          <ExercisesCard summaries={exerciseList} />
          <StreakCard streak={dailyStreak(activity.days, now)} days={last7Days(activity.days, now)} />
          <DataCard meta={meta} remind={backupReminder(meta, true, now)} />
        </div>
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-16">
      <header className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Your learning</h1>
          <p className="mt-2 max-w-3xl text-base text-muted-foreground">
            The lessons, labs, reviews, notes and quiz results recorded in this browser, and what to do next.
          </p>
        </div>
        <LearnerSectionNav current="dashboard" />
        <StorageStatusNote savedLabel="Stored only in this browser" />
      </header>
      {body}
    </div>
  );
}

/** The most recently opened lesson that still exists: from the lesson log, or from 'curriculumProgress' for older visits. */
function latestLesson(
  progress: Parameters<typeof lastVisit>[0],
  lessonLog: { lessons: Readonly<Record<string, { lastVisitedAt: number }>> },
  lessons: ReadonlyMap<string, IndexedStaticLesson>,
): LastOpened | null {
  let best: LastOpened | null = null;
  for (const [path, visit] of Object.entries(lessonLog.lessons)) {
    const lesson = lessons.get(path);
    if (lesson && (!best || visit.lastVisitedAt > best.at)) best = { lesson, at: visit.lastVisitedAt };
  }
  const legacy = lastVisit(progress);
  if (legacy && (!best || legacy.at > best.at)) {
    const lesson = [...lessons.values()].find(
      (candidate) => candidate.moduleId === legacy.moduleId && candidate.slug === legacy.lessonSlug,
    );
    if (lesson) best = { lesson, at: legacy.at };
  }
  return best;
}
