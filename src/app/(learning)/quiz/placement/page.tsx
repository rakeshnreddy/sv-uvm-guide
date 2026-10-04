import type { Metadata } from 'next';
import Link from 'next/link';

import { PlacementQuiz } from '@/components/assessment/PlacementQuiz';
import { placementTierRecommendations } from '@/components/assessment/placementQuizData';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { resolvePlacementPlan, resolveRoutes, type PlacementPlan } from '@/lib/learning-paths';
import { isFeatureEnabled } from '@/tools/featureFlags';

export const metadata: Metadata = {
  title: 'Find your level',
  description:
    'Ten questions on SystemVerilog, UVM and debug habits that recommend a starting lesson on the Junior, Practitioner or Expert route.',
};

const quizSections = [
  {
    title: 'SystemVerilog Foundations',
    description: 'Data types, procedural blocks, interfaces and modports, and constraints.',
    sample: ['Four-state data types', 'Combinational blocks without latches', 'Interfaces and modports', 'Weighted constraints'],
  },
  {
    title: 'Verification Methodology',
    description: 'UVM agents, configuration and the sequencer-driver handshake.',
    sample: ['Active and passive agents', 'The configuration database', 'Sequencer-driver handshake'],
  },
  {
    title: 'Debug & Coverage Habits',
    description: 'Coverage closure, end-of-test control and failure triage.',
    sample: ['Closing coverage on error paths', 'Who owns the objection', 'Reproducing a failure from its seed'],
  },
];

const focusRing =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const inlineLink = `font-medium text-primary underline underline-offset-4 hover:no-underline ${focusRing}`;

export default function PlacementQuizPage() {
  const routes = resolveRoutes(curriculumData, { labs: getAllLabs() });
  const plans: Record<number, PlacementPlan> = Object.fromEntries(
    placementTierRecommendations.map((recommendation) => [
      recommendation.tier,
      resolvePlacementPlan(recommendation.route, routes),
    ]),
  );
  const tracking = isFeatureEnabled('tracking');

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-16">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Skill placement</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">Find your level</h1>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground">
          Answer ten questions to find where to start. Your result is a starting lesson on one of the three{' '}
          <Link href="/curriculum#routes" className={inlineLink}>
            learning routes
          </Link>
          , a short list of lessons to skim first, and lessons for any area that scored under 75%.
        </p>
      </header>

      <PlacementQuiz plans={plans} showDashboardLink={tracking} />

      <section aria-labelledby="placement-coverage-heading">
        <h2 id="placement-coverage-heading" className="text-xl font-semibold text-foreground">
          What the quiz covers
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {quizSections.map((section) => (
            <article
              key={section.title}
              aria-labelledby={`placement-coverage-${section.title.replace(/\W+/g, '-').toLowerCase()}`}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <h3
                id={`placement-coverage-${section.title.replace(/\W+/g, '-').toLowerCase()}`}
                className="text-base font-semibold text-foreground"
              >
                {section.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {section.sample.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="placement-skip-heading" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 id="placement-skip-heading" className="text-lg font-semibold text-foreground">
          Rather choose for yourself?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Compare the{' '}
          <Link href="/curriculum#route-junior" className={inlineLink}>
            Junior
          </Link>
          ,{' '}
          <Link href="/curriculum#route-practitioner" className={inlineLink}>
            Practitioner
          </Link>{' '}
          and{' '}
          <Link href="/curriculum#route-expert" className={inlineLink}>
            Expert
          </Link>{' '}
          routes on the curriculum page, or jump to the{' '}
          <Link href="/curriculum/expert-index" className={inlineLink}>
            expert index
          </Link>
          .
          {tracking && (
            <>
              {' '}
              For practice tabs, analytics and project-style evaluations, open the{' '}
              <Link href="/assessment" className={inlineLink}>
                assessment center
              </Link>
              .
            </>
          )}
        </p>
      </section>
    </div>
  );
}
