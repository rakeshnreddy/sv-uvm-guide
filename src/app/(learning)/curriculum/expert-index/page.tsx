import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { PAGE_HEADER_ACTION_LINK_CLASS, PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Section } from '@/components/layout/Section';
import { SignalTag } from '@/components/ui/SignalTag';
import { curriculumData } from '@/lib/curriculum-data';
import { loadExpertIndex } from '@/lib/curriculum-scan';
import type { ExpertIndexModule, ExpertIndexTier } from '@/lib/expert-index';
import { routeAnchor } from '@/lib/learning-route-state';
import { siteLabel } from '@/lib/nav-labels';
import { CURRICULUM_HREF, EXPERT_INDEX_HREF, INTERVIEW_PREP_HREF } from '@/lib/site-links';
import { tierDataAttribute, tierOfModuleCode, tierOfTierSlug } from '@/lib/tier-colors';

export const metadata: Metadata = {
  title: 'Expert index',
  description:
    'Every expert-layer topic in the SystemVerilog and UVM curriculum, as deep links grouped by tier and module.',
};

const focusRing =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const inlineLink = `font-medium text-primary underline underline-offset-4 hover:no-underline ${focusRing}`;
/** On phones each link's target grows to 32 px by padding that negative margins cancel, so the dense lists keep their rhythm. */
const listLink = `font-medium text-primary underline-offset-4 transition-colors duration-150 ease-bench hover:underline motion-reduce:transition-none max-sm:inline-block max-sm:-my-1.5 max-sm:py-1.5 ${focusRing}`;
/** A quiet header action (no fill: the page has no filled action), in primary text over the colour field. */
const actionLink = PAGE_HEADER_ACTION_LINK_CLASS;

/** The labels from the one navigation config: "Curriculum" and "Expert index". */
const EXPERT_INDEX_TRAIL = [
  { label: siteLabel(CURRICULUM_HREF), href: CURRICULUM_HREF },
  { label: siteLabel(EXPERT_INDEX_HREF) },
] as const;

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function TaggedModule({ module }: { module: ExpertIndexModule }) {
  const lessonsWithTopics = module.lessons.filter((lesson) => lesson.topics.length > 0);
  const showLessonNames = module.lessons.length > 1;
  return (
    <article
      aria-labelledby={`expert-${module.id}`}
      data-tier={tierDataAttribute(tierOfModuleCode(module.code))}
      // Quiet glass with the module's tier edge (DESIGN.md section 11).
      className={`glass-quiet rounded-xl p-4 sm:p-5${tierOfModuleCode(module.code) ? ' tier-edge' : ''}`}
    >
      <h3 id={`expert-${module.id}`} className="text-h4 text-foreground">
        <SignalTag code={module.code} className="mr-2 align-[0.1em]" />
        <span className="sr-only">: </span>
        <Link href={module.href} className={listLink}>
          {module.displayTitle}
        </Link>
        {module.track === 'elective' && (
          <span className="ml-2 rounded border border-dashed border-border px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground">
            Elective
          </span>
        )}
      </h3>
      <div className="mt-3 space-y-3">
        {lessonsWithTopics.map((lesson) => (
          <div key={lesson.slug}>
            {showLessonNames && (
              <p className="text-xs font-medium text-muted-foreground">
                In{' '}
                <Link href={lesson.href} className={listLink}>
                  {lesson.title}
                </Link>
              </p>
            )}
            <ul className="mt-1 space-y-1.5 text-sm">
              {lesson.topics.map((topic) => (
                <li key={topic.href} className="flex gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <Link href={topic.href} className={`${listLink} [overflow-wrap:anywhere]`}>
                    {topic.topic}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}

function UntaggedModules({ tier, modules }: { tier: ExpertIndexTier; modules: ExpertIndexModule[] }) {
  if (modules.length === 0) return null;
  const allUntagged = modules.length === tier.modules.length;
  return (
    <div className="mt-6">
      <h3 id={`${tier.anchor}-untagged`} className="text-h4 text-foreground">
        {allUntagged ? 'No expert topics tagged in this tier yet' : `Not tagged yet (${modules.length})`}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Authors are adding <code className="rounded bg-muted px-1 font-mono text-[0.9em]">Expert:</code> subsections as
        lessons are revised. Until then, go deeper through each module&apos;s Push Further section where it has one.
      </p>
      <ul aria-labelledby={`${tier.anchor}-untagged`} className="glass-quiet mt-3 divide-y divide-border rounded-xl">
        {modules.map((module) => (
          <li key={module.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <span className="min-w-0">
              <SignalTag code={module.code} className="mr-2" />
              <span className="sr-only">: </span>
              <Link href={module.href} className={`${listLink} [overflow-wrap:anywhere]`}>
                {module.displayTitle}
              </Link>
              {module.track === 'elective' && <span className="ml-2 text-xs text-muted-foreground">(elective)</span>}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {module.pushFurtherHref ? (
                <Link
                  href={module.pushFurtherHref}
                  className={listLink}
                  aria-label={`Push Further in ${module.code}: ${module.displayTitle}`}
                >
                  Push Further
                </Link>
              ) : (
                'No Push Further section yet'
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ExpertIndexPage() {
  const index = loadExpertIndex(curriculumData);
  const summary =
    index.topicCount === 0
      ? 'No lesson has tagged expert topics yet. Each module below links its Push Further section where it has one.'
      : `${plural(index.topicCount, 'expert topic')} in ${index.taggedModuleCount} of ${index.moduleCount} modules. Modules without tagged topics link their Push Further section where they have one.`;

  return (
    <PageShell width="content">
      <PageHeader
        breadcrumbs={EXPERT_INDEX_TRAIL}
        title={siteLabel(EXPERT_INDEX_HREF)}
        lead="Every Expert subsection in the lessons, linked to the heading itself: corner cases, tool behaviour, methodology trade-offs and staff-level questions."
        meta={<span>{summary}</span>}
        actions={
          <>
            <Link href={`${CURRICULUM_HREF}#${routeAnchor('expert')}`} className={actionLink}>
              The Expert route
            </Link>
            <Link href={INTERVIEW_PREP_HREF} className={actionLink}>
              {siteLabel(INTERVIEW_PREP_HREF)}
            </Link>
          </>
        }
      />
      <p className="max-w-[30em] text-ui text-muted-foreground">
        Every module on the{' '}
        <Link href={`${CURRICULUM_HREF}#modules`} className={inlineLink}>
          curriculum page
        </Link>{' '}
        lists the modules it builds on, so a gap is one click away.
      </p>

      <nav aria-label="Tiers on this page" className="mb-12 mt-6">
        <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {index.tiers.map((tier) => (
            <li key={tier.id}>
              <a
                href={`#${tier.anchor}`}
                data-tier={tierDataAttribute(tierOfTierSlug(tier.id))}
                className={`glass-quiet flex min-h-[44px] items-center justify-between gap-2 rounded-lg border-tier-current-border px-3 py-2 transition-colors duration-150 ease-bench hover:bg-muted motion-reduce:transition-none ${focusRing}`}
              >
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span className="tier-step" aria-hidden="true" />
                  {tier.title}
                </span>
                <span className="text-xs text-muted-foreground">{plural(tier.topicCount, 'topic')}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {index.tiers.map((tier) => {
        const tagged = tier.modules.filter((m) => m.topicCount > 0);
        const untagged = tier.modules.filter((m) => m.topicCount === 0);
        return (
          <Section
            key={tier.id}
            id={tier.anchor}
            data-tier={tierDataAttribute(tierOfTierSlug(tier.id))}
            title={
              <span className="flex items-center gap-3">
                <span className="tier-step" aria-hidden="true" />
                {tier.title}
              </span>
            }
            description={tier.audience || undefined}
          >
            {tagged.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {plural(tier.topicCount, 'expert topic')} in {tagged.length} of {plural(tier.modules.length, 'module')}.
              </p>
            )}
            {tagged.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {tagged.map((module) => (
                  <TaggedModule key={module.id} module={module} />
                ))}
              </div>
            )}
            <UntaggedModules tier={tier} modules={untagged} />
          </Section>
        );
      })}
    </PageShell>
  );
}
