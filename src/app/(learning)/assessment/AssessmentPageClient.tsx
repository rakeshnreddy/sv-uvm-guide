'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { eyebrow, inlineLink, primaryAction, secondaryAction, textLink } from '@/components/curriculum/overview-ui';
import { LearnerSectionNav } from '@/components/learner/LearnerSectionNav';
import { StorageStatusNote } from '@/components/learner/StorageStatusNote';
import { labelWithCode } from '@/lib/curriculum-overview';
import type { StaticTier } from '@/lib/learner-stats';
import { LEARNER_DATA_CHANGED_EVENT } from '@/lib/learner-store/keys';
import { useHydrated, useKeyedRecordList, useRecord } from '@/lib/learner-store/react';
import { subscribeLearnerStore } from '@/lib/learner-store/record';
import { assessmentRecord, type PlacementAttempt } from '@/lib/learner-store/repositories/assessments';
import { flashcardRecord } from '@/lib/learner-store/repositories/flashcards';
import { labProgressRecords } from '@/lib/learner-store/repositories/labs';
import { curriculumProgressRecord, lessonLogRecord } from '@/lib/learner-store/repositories/lessons';
import { usePersistenceTarget } from '@/lib/persistence/target';
import { cn } from '@/lib/utils';

import {
  buildAssessmentSummary,
  isStalePlacement,
  placementPlanFor,
  WELL_KNOWN_INTERVAL_DAYS,
  type AssessmentLab,
  type AssessmentPlacementPlan,
  type PlacementAreaId,
  type PlacementVersions,
  type Recommendation,
  type TrackSummary,
} from './assessment-model';

export interface AssessmentPageClientProps {
  /** Every tier, module and lesson, built on the server from the curriculum data. */
  curriculum: readonly StaticTier[];
  /** Available labs from the registry. */
  labs: readonly AssessmentLab[];
  /** The placement quiz's starting lesson for each tier. */
  placementPlans: readonly AssessmentPlacementPlan[];
  placementAreaTitles: Readonly<Record<PlacementAreaId, string>>;
  placementVersions?: PlacementVersions;
}

const card = 'min-w-0 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6';
const panel = 'min-w-0 rounded-2xl border border-border bg-background p-4';
const muted = 'text-sm text-muted-foreground';

const dateFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/** The day `ms` falls on; a time no Date can hold reads as unknown. */
function formatDate(ms: number): string {
  return Number.isFinite(new Date(ms).getTime()) ? dateFormat.format(ms) : 'an unknown date';
}

function percentText(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** The clock, read after mount and again when learner data changes here or in another tab. */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    refresh();
    const unsubscribe = subscribeLearnerStore(refresh);
    window.addEventListener(LEARNER_DATA_CHANGED_EVENT, refresh);
    return () => {
      unsubscribe();
      window.removeEventListener(LEARNER_DATA_CHANGED_EVENT, refresh);
    };
  }, []);
  return now;
}

// ---------------------------------------------------------------------------
// Charts: every bar is decorative (aria-hidden); the visible text beside it
// carries the same numbers, so nothing depends on colour or on seeing the bar.
// ---------------------------------------------------------------------------

/** Done is a solid fill; opened but not done is a hatched fill, so the two differ without colour. */
function LessonBar({ total, opened, done }: { total: number; opened: number; done: number }) {
  const donePct = total > 0 ? clampPercent((done / total) * 100) : 0;
  const openedPct = total > 0 ? clampPercent(((opened - done) / total) * 100) : 0;
  return (
    <div aria-hidden="true" className="mt-2 flex h-3 w-full overflow-hidden rounded-full border border-border bg-muted">
      <div className="h-full bg-primary" style={{ width: `${donePct}%` }} />
      <div
        className="h-full bg-primary/40 [background-image:repeating-linear-gradient(135deg,transparent_0,transparent_3px,hsl(var(--foreground)/0.35)_3px,hsl(var(--foreground)/0.35)_5px)]"
        style={{ width: `${openedPct}%` }}
      />
    </div>
  );
}

function ScoreBar({ fraction }: { fraction: number }) {
  return (
    <div aria-hidden="true" className="mt-2 h-2 w-full overflow-hidden rounded-full border border-border bg-muted">
      <div className="h-full bg-primary" style={{ width: `${clampPercent(fraction * 100)}%` }} />
    </div>
  );
}

function OverviewChart({ tracks }: { tracks: readonly TrackSummary[] }) {
  return (
    <section aria-labelledby="assessment-overview-heading" className={card}>
      <h2 id="assessment-overview-heading" className="text-lg font-semibold text-foreground sm:text-xl">
        Lessons by track
      </h2>
      <figure className="mt-3">
        <figcaption className={muted}>
          Lessons marked done (solid) and opened but not yet done (striped), out of every lesson in the track.
        </figcaption>
        <ul className="mt-4 space-y-4">
          {tracks.map((track) => (
            <li key={track.id} className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                <a href={`#track-${track.id}`} className={textLink}>
                  {track.name}
                </a>
                <span className="text-muted-foreground">
                  {track.lessons.done} of {plural(track.lessons.total, 'lesson', 'lessons')} done
                  {track.lessons.opened > track.lessons.done
                    ? `, ${track.lessons.opened - track.lessons.done} more opened`
                    : ''}
                </span>
              </div>
              <LessonBar {...track.lessons} />
            </li>
          ))}
        </ul>
      </figure>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

function PlacementSection({
  attempt,
  plan,
  stale,
  areaTitles,
}: {
  attempt: PlacementAttempt | null;
  plan: AssessmentPlacementPlan | null;
  stale: boolean;
  areaTitles: Readonly<Record<PlacementAreaId, string>>;
}) {
  return (
    <section aria-labelledby="assessment-placement-heading" className={card}>
      <h2 id="assessment-placement-heading" className="text-lg font-semibold text-foreground sm:text-xl">
        Placement result
      </h2>
      {attempt ? (
        <div className="mt-3 space-y-4">
          <p className="text-sm text-foreground">
            Your latest attempt, on {formatDate(attempt.completedAt)}: {percentText(attempt.percent)} weighted score (harder questions count more),
            which places you in <strong className="font-semibold">Tier {attempt.tier}</strong>
            {plan ? ` on the ${plan.routeName} route` : ''}.
          </p>
          {stale && (
            <p className="text-xs text-muted-foreground">
              The placement quiz has changed since this attempt, so retake it for a current result.
            </p>
          )}
          {attempt.categories.length > 0 && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Score by area">
              {attempt.categories.map((category) => {
                const title = areaTitles[category.id as PlacementAreaId] ?? category.id;
                return (
                  <li key={category.id} className={panel}>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {percentText(category.percent)} correct{category.percent < 0.75 ? ', under 75%' : ''}
                    </p>
                    <ScoreBar fraction={category.percent} />
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {plan && (
              <Link href={plan.startHref} className={cn(secondaryAction, 'max-w-full')}>
                <span className="[overflow-wrap:anywhere]">
                  Placement start: {labelWithCode(plan.startModuleCode, plan.startTitle)}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            )}
            <Link href="/quiz/placement" className={secondaryAction}>
              Retake the placement quiz
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className={muted}>
            You haven&apos;t taken the placement quiz in this browser. Its ten questions cover SystemVerilog, UVM
            and debug and coverage habits; AMBA and the expert topics are not part of it.
          </p>
          <Link href="/quiz/placement" className={cn(textLink, 'mt-2 inline-block text-sm')}>
            Find your level
          </Link>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

function Stat({ label, value, detail }: { label: string; value: string; detail?: React.ReactNode }) {
  return (
    <div className={panel}>
      <dt className={eyebrow}>{label}</dt>
      <dd className="mt-1">
        <span className="block text-base font-semibold text-foreground">{value}</span>
        {detail ? <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span> : null}
      </dd>
    </div>
  );
}

function RecommendationList({ items, trackName }: { items: readonly Recommendation[]; trackName: string }) {
  if (items.length === 0) {
    return <p className={muted}>Every lesson in this track is marked done, and nothing is waiting for you here.</p>;
  }
  return (
    <ol className="space-y-3" aria-label={`Next steps in ${trackName}`}>
      {items.map((item) => (
        <li key={`${item.kind}:${item.href}`} className="min-w-0 text-sm">
          <Link href={item.href} className={cn(textLink, '[overflow-wrap:anywhere]')}>
            {item.label}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
        </li>
      ))}
    </ol>
  );
}

function TrackSection({
  track,
  areaTitles,
}: {
  track: TrackSummary;
  areaTitles: Readonly<Record<PlacementAreaId, string>>;
}) {
  const headingId = `track-${track.id}-heading`;
  const { lessons, quizzes, labs, flashcards, placement } = track;
  const startedModules = track.modules.filter((mod) => mod.opened > 0);
  const startedLabs = labs.items.filter((item) => item.status !== 'not_started');

  return (
    <section id={`track-${track.id}`} aria-labelledby={headingId} className={cn(card, 'scroll-mt-24')}>
      <h2 id={headingId} className="text-lg font-semibold text-foreground sm:text-xl">
        {track.name}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{track.scope}</p>
      {!track.hasActivity && (
        <p className="mt-3 text-sm text-foreground">Nothing recorded in this track yet.</p>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Lessons"
          value={`${lessons.done} of ${lessons.total} done`}
          detail={`${plural(lessons.opened, 'lesson', 'lessons')} opened`}
        />
        <Stat
          label="Lesson quizzes"
          value={quizzes.taken > 0 ? `${quizzes.passed} of ${quizzes.taken} at 75% or more` : 'None taken'}
          detail={quizzes.averageBest !== null ? `Average best score ${percentText(quizzes.averageBest)}` : undefined}
        />
        <Stat
          label="Labs"
          value={labs.available > 0 ? `${labs.completed} of ${labs.available} completed` : 'No labs yet'}
          detail={labs.inProgress > 0 ? `${labs.inProgress} in progress` : undefined}
        />
        <Stat
          label="Flashcards"
          value={flashcards.cards > 0 ? `${flashcards.wellKnown} of ${flashcards.cards} well known` : 'No decks opened'}
          detail={
            flashcards.cards > 0
              ? `${flashcards.reviewed} rated, ${flashcards.due} due today. Well known: a review interval of ${WELL_KNOWN_INTERVAL_DAYS} days or more.`
              : undefined
          }
        />
        <Stat
          label="Placement area"
          value={
            placement
              ? `${percentText(placement.percent)} correct`
              : track.id === 'amba' || track.id === 'expert'
                ? 'Not tested'
                : 'Not taken'
          }
          detail={
            placement
              ? [areaTitles[placement.area], placement.note].filter(Boolean).join('. ')
              : track.id === 'amba' || track.id === 'expert'
                ? 'The placement quiz does not cover this track.'
                : undefined
          }
        />
      </dl>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-foreground">Next steps</h3>
        <div className="mt-2">
          <RecommendationList items={track.recommendations} trackName={track.name} />
        </div>
      </div>

      {(startedModules.length > 0 || startedLabs.length > 0 || quizzes.weak.length > 0) && (
        <details className="mt-5 rounded-2xl border border-border bg-background p-4 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">Details for {track.name}</summary>
          {startedModules.length > 0 && (
            <div className="mt-3">
              <h3 className={eyebrow}>Modules you have started</h3>
              <ul className="mt-2 space-y-1">
                {startedModules.map((mod) => (
                  <li key={mod.id} className="flex min-w-0 flex-wrap justify-between gap-x-3">
                    <span className="[overflow-wrap:anywhere]">{labelWithCode(mod.code, mod.title)}</span>
                    <span className="text-muted-foreground">
                      {mod.done} of {mod.total} done
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {startedLabs.length > 0 && (
            <div className="mt-3">
              <h3 className={eyebrow}>Labs you have started</h3>
              <ul className="mt-2 space-y-1">
                {startedLabs.map((lab) => (
                  <li key={lab.id} className="flex min-w-0 flex-wrap justify-between gap-x-3">
                    <Link href={lab.href} className={cn(textLink, '[overflow-wrap:anywhere]')}>
                      {lab.title}
                    </Link>
                    <span className="text-muted-foreground">
                      {lab.status === 'completed'
                        ? 'Completed'
                        : `${lab.completedSteps} of ${plural(lab.stepCount, 'step', 'steps')} done`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {quizzes.weak.length > 0 && (
            <div className="mt-3">
              <h3 className={eyebrow}>Quizzes under 75%</h3>
              <ul className="mt-2 space-y-1">
                {quizzes.weak.map((weak) => (
                  <li key={weak.lessonPath} className="flex min-w-0 flex-wrap justify-between gap-x-3">
                    <Link href={weak.lessonPath} className={cn(textLink, '[overflow-wrap:anywhere]')}>
                      {weak.lessonName}
                    </Link>
                    <span className="text-muted-foreground">Best {percentText(weak.lowestFraction)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <section aria-labelledby="assessment-empty-heading" className={cn(card, 'sm:p-8')}>
      <h2 id="assessment-empty-heading" className="text-xl font-semibold text-foreground sm:text-2xl">
        Nothing to assess yet
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        This page summarizes what you do on this site: lessons you mark done, lesson quizzes, labs, flashcard
        reviews and the placement quiz. None of that is recorded in this browser yet.
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
    <section aria-labelledby="assessment-account-heading" className={card}>
      <h2 id="assessment-account-heading" className="text-xl font-semibold text-foreground">
        Your progress is saved to your account
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        While you are signed in, new progress is saved to your account. This page reads only what is stored in this
        browser, so it does not assess account progress yet.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/**
 * The self-assessment, read from the learner records in this browser. The
 * server render and the hydrating render show only the heading and a neutral
 * line; the summaries appear right after hydration. It never writes and makes
 * no request.
 */
export default function AssessmentPageClient({
  curriculum,
  labs,
  placementPlans,
  placementAreaTitles,
  placementVersions,
}: AssessmentPageClientProps) {
  const hydrated = useHydrated();
  const { target, ready: targetReady } = usePersistenceTarget();
  const progress = useRecord(curriculumProgressRecord);
  const lessonLog = useRecord(lessonLogRecord);
  const labEntries = useKeyedRecordList(labProgressRecords);
  const flashcards = useRecord(flashcardRecord);
  const assessments = useRecord(assessmentRecord);
  const now = useNow();

  const labRecords = useMemo(() => labEntries.map((entry) => entry.value), [labEntries]);
  const summary = useMemo(
    () =>
      now === null
        ? null
        : buildAssessmentSummary({ curriculum, labs, progress, lessonLog, labRecords, flashcards, assessments, now }),
    [curriculum, labs, progress, lessonLog, labRecords, flashcards, assessments, now],
  );

  const loaded = hydrated && targetReady && summary !== null;

  let body: React.ReactNode;
  if (!loaded || summary === null) {
    body = <p className={muted}>Reading what this browser has saved…</p>;
  } else if (target === 'server') {
    body = <AccountNotice />;
  } else if (!summary.hasData) {
    body = <EmptyState />;
  } else {
    const attempt = summary.placement;
    body = (
      <div className="space-y-6">
        <OverviewChart tracks={summary.tracks} />
        <PlacementSection
          attempt={attempt}
          plan={attempt ? placementPlanFor(attempt, placementPlans) : null}
          stale={attempt ? isStalePlacement(attempt, placementVersions) : false}
          areaTitles={placementAreaTitles}
        />
        {summary.tracks.map((track) => (
          <TrackSection key={track.id} track={track} areaTitles={placementAreaTitles} />
        ))}
        <p className={muted}>
          These numbers come only from this browser. Download a backup in{' '}
          <Link href="/settings#data" className={inlineLink}>
            Settings
          </Link>{' '}
          to keep them, or see everything else on{' '}
          <Link href="/dashboard" className={inlineLink}>
            your dashboard
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-16">
      <header className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Self-assessment</h1>
          <p className="mt-2 max-w-3xl text-base text-muted-foreground">
            Where you stand in each track, from what you have done here: lessons, lesson quizzes, labs, flashcards and
            the placement quiz. It is a self-check, not a grade or a certificate.
          </p>
        </div>
        <LearnerSectionNav current="assessment" />
        <StorageStatusNote savedLabel="Stored only in this browser" />
      </header>
      {body}
    </div>
  );
}
