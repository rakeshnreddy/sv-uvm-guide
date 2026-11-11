import type { Metadata } from 'next';
import Link from 'next/link';

import { PlacementQuiz } from '@/components/assessment/PlacementQuiz';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Section } from '@/components/layout/Section';
import { cardClass } from '@/components/ui/Card';
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
    <PageShell width="content">
      {/* Curriculum › Find your level: the quiz is listed under Learn, beside the curriculum. */}
      <PageHeader
        breadcrumbs={[siteLink(CURRICULUM_HREF), { label: siteLabel(PLACEMENT_QUIZ_HREF) }]}
        title={siteLabel(PLACEMENT_QUIZ_HREF)}
        lead={
          <>
            Answer ten questions to find where to start: a lesson on one of the three{' '}
            <Link href={START_HERE_HREF} className={inlineLink}>
              learning routes
            </Link>
            , lessons to skim first, and lessons for any area under 75%.
          </>
        }
      />

      <PlacementQuiz plans={plans} />

      <Section id="placement-coverage" title="What the quiz covers" className="mt-12">
        <ul className="grid gap-4 lg:grid-cols-3">
          {quizSections.map((section) => {
            const headingId = `placement-coverage-${section.title.replace(/\W+/g, '-').toLowerCase()}`;
            return (
              <li key={section.title} className={cardClass({ variant: 'glassQuiet', padding: 'default' })}>
                <h3 id={headingId} className="text-h4 text-foreground">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {section.sample.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="placement-skip" title="Rather choose for yourself?">
        <p className="max-w-[30em] text-ui text-muted-foreground">
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
      </Section>
    </PageShell>
  );
}
