import type { Metadata } from 'next';
import Link from 'next/link';

import { PlacementQuiz } from '@/components/assessment/PlacementQuiz';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { placementTierRecommendations } from '@/components/assessment/placementQuizData';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { resolvePlacementPlan, resolveRoutes, type PlacementPlan } from '@/lib/learning-paths';
import { siteLabel, siteLink } from '@/lib/nav-labels';
import { CURRICULUM_HREF, EXPERT_INDEX_HREF, PLACEMENT_QUIZ_HREF, START_HERE_HREF } from '@/lib/site-links';

export const metadata: Metadata = {
  title: siteLabel(PLACEMENT_QUIZ_HREF),
  description:
    'Ten questions on SystemVerilog, UVM and debug habits that recommend a starting lesson on the Junior, Practitioner or Expert route.',
};

const quizSections = [
  {
    title: 'SystemVerilog foundations',
    description: 'Data types, procedural blocks, interfaces and modports, and constraints.',
    sample: ['Four-state data types', 'Combinational blocks without latches', 'Interfaces and modports', 'Weighted constraints'],
  },
  {
    title: 'Verification methodology',
    description: 'UVM agents, configuration and the sequencer-driver handshake.',
    sample: ['Active and passive agents', 'The configuration database', 'Sequencer-driver handshake'],
  },
  {
    title: 'Debug and coverage habits',
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

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-16">
      {/* Curriculum › Find your level: the quiz is listed under Learn, beside the curriculum. */}
      <div>
        <Breadcrumbs items={[siteLink(CURRICULUM_HREF), { label: siteLabel(PLACEMENT_QUIZ_HREF) }]} className="-mt-2 mb-4" />
        <header>
          <p className="text-xs font-medium text-subtle">Skill placement</p>
          <h1 className="mt-2 text-h1 text-foreground">{siteLabel(PLACEMENT_QUIZ_HREF)}</h1>
          <p className="mt-3 max-w-3xl text-lead text-muted-foreground">
            Answer ten questions to find where to start. Your result is a starting lesson on one of the three{' '}
            <Link href={START_HERE_HREF} className={inlineLink}>
              learning routes
            </Link>
            , a short list of lessons to skim first, and lessons for any area that scored under 75%.
          </p>
        </header>
      </div>

      <PlacementQuiz plans={plans} />

      <section aria-labelledby="placement-coverage-heading">
        <h2 id="placement-coverage-heading" className="text-h3 text-foreground">
          What the quiz covers
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {quizSections.map((section) => (
            <article
              key={section.title}
              aria-labelledby={`placement-coverage-${section.title.replace(/\W+/g, '-').toLowerCase()}`}
              className="rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <h3
                id={`placement-coverage-${section.title.replace(/\W+/g, '-').toLowerCase()}`}
                className="text-h4 text-foreground"
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

      <section aria-labelledby="placement-skip-heading" className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 id="placement-skip-heading" className="text-h3 text-foreground">
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
          <Link href={EXPERT_INDEX_HREF} className={inlineLink}>
            expert index
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
