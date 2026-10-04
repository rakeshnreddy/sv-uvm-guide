import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { curriculumData } from '@/lib/curriculum-data';
import { loadExpertIndex } from '@/lib/curriculum-scan';
import type { ExpertIndexModule, ExpertIndexTier } from '@/lib/expert-index';
import { INTERVIEW_PREP_HREF } from '@/lib/learning-paths';
import { routeAnchor } from '@/lib/learning-route-state';

export const metadata: Metadata = {
  title: 'Expert index',
  description:
    'Every expert-layer topic in the SystemVerilog and UVM curriculum, as deep links grouped by tier and module.',
};

const focusRing =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const inlineLink = `font-medium text-primary underline underline-offset-4 hover:no-underline ${focusRing}`;
const listLink = `font-medium text-primary underline-offset-4 hover:underline ${focusRing}`;
const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function TaggedModule({ module }: { module: ExpertIndexModule }) {
  const lessonsWithTopics = module.lessons.filter((lesson) => lesson.topics.length > 0);
  const showLessonNames = module.lessons.length > 1;
  return (
    <article
      aria-labelledby={`expert-${module.id}`}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <h3 id={`expert-${module.id}`} className="text-base font-semibold text-foreground sm:text-lg">
        <span className="mr-2 font-mono text-sm text-muted-foreground">{module.code}</span>
        <Link href={module.href} className={listLink}>
          {module.displayTitle}
        </Link>
        {module.track === 'elective' && (
          <span className="ml-2 rounded-full border border-dashed border-border px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground">
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
      <h3 id={`${tier.anchor}-untagged`} className="text-base font-semibold text-foreground">
        {allUntagged ? 'No expert topics tagged in this tier yet' : `Not tagged yet (${modules.length})`}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Authors are adding <code className="rounded bg-muted px-1 font-mono text-[0.9em]">Expert:</code> subsections as
        lessons are revised. Until then, go deeper through each module&apos;s Push Further section where it has one.
      </p>
      <ul aria-labelledby={`${tier.anchor}-untagged`} className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
        {modules.map((module) => (
          <li key={module.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <span className="min-w-0">
              <span className="mr-2 font-mono text-xs text-muted-foreground">{module.code}</span>
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
    <div className="mx-auto max-w-5xl pb-16">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <li>
            <Link href="/curriculum" className={listLink}>
              Curriculum
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <span aria-current="page" className="font-medium text-foreground">
              Expert index
            </span>
          </li>
        </ol>
      </nav>

      <header className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className={eyebrow}>Expert layers</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">Expert index</h1>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground">
          Every <strong className="font-semibold text-foreground">Expert:</strong> subsection in the lessons, linked to
          the heading itself: standard corner cases, tool-dependent behaviour, methodology trade-offs, scale and
          performance, and staff-level interview questions. Every module on the{' '}
          <Link href="/curriculum#modules" className={inlineLink}>
            curriculum page
          </Link>{' '}
          lists the modules it builds on, so a gap is one click away.
        </p>
        <p className="mt-3 max-w-3xl text-sm text-foreground">{summary}</p>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href={`/curriculum#${routeAnchor('expert')}`} className={inlineLink}>
            The Expert route
          </Link>
          <Link href={INTERVIEW_PREP_HREF} className={inlineLink}>
            Interview prep
          </Link>
        </p>
      </header>

      <nav aria-label="Tiers on this page" className="mt-6">
        <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {index.tiers.map((tier) => (
            <li key={tier.id}>
              <a
                href={`#${tier.anchor}`}
                className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 hover:border-primary ${focusRing}`}
              >
                <span className="font-medium text-foreground">{tier.title}</span>
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
          <section key={tier.id} id={tier.anchor} aria-labelledby={`${tier.anchor}-heading`} className="mt-10 scroll-mt-24">
            <h2 id={`${tier.anchor}-heading`} className="text-2xl font-semibold text-foreground">
              {tier.title}
            </h2>
            {tier.audience && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{tier.audience}</p>}
            {tagged.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
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
          </section>
        );
      })}
    </div>
  );
}
