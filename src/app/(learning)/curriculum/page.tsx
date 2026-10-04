import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import CurriculumOverview from '@/components/curriculum/CurriculumOverview';
import { verificationStackLinks } from '@/components/diagrams/verification-stack-links';
import { curriculumData, findPrevNextTopics } from '@/lib/curriculum-data';
import { buildCurriculumOverview, PLANNED_MODULES, type LessonPosition } from '@/lib/curriculum-overview';
import { readLessonMinutes, readManifestTiers } from '@/lib/curriculum-scan';
import { getAllLabs } from '@/lib/lab-registry';
import { resolveMilestones, resolveRoutes } from '@/lib/learning-paths';

export const metadata: Metadata = {
  title: 'Curriculum',
  description:
    'The SystemVerilog and UVM curriculum in learning order: choose a Junior, Practitioner or Expert route, or browse every module by tier.',
};

/** The next lesson on the learning path, from the generated navigation (the core path skips electives). */
function nextLesson(lesson: LessonPosition): LessonPosition | undefined {
  const next = findPrevNextTopics([lesson.tierId, lesson.moduleId, lesson.lessonSlug]).next;
  if (!next) return undefined;
  const [tierId, moduleId, lessonSlug] = next.slug.split('/');
  return tierId && moduleId && lessonSlug ? { tierId, moduleId, lessonSlug } : undefined;
}

export default function CurriculumPage() {
  const labs = getAllLabs();
  const tiers = buildCurriculumOverview({
    data: curriculumData,
    tiers: readManifestTiers(),
    minutesByLesson: readLessonMinutes(curriculumData),
    labs,
    nextOf: nextLesson,
  });
  const routes = resolveRoutes(curriculumData, { labs });
  const milestones = resolveMilestones(labs);
  const stackLessons = verificationStackLinks.filter((link) => link.href !== '#');

  return (
    <div className="mx-auto max-w-7xl pb-16">
      <header className="mb-10 max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">Learning Curriculum</h1>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          SystemVerilog and UVM from the first testbench to staff-level methodology, in four tiers ordered by what each
          lesson needs first. Pick a route that matches your experience, or browse every module below.
        </p>
      </header>

      <CurriculumOverview tiers={tiers} routes={routes} milestones={milestones} planned={PLANNED_MODULES} />

      <section aria-labelledby="verification-stack-heading">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-5 max-w-3xl">
            <h2 id="verification-stack-heading" className="text-xl font-semibold text-foreground sm:text-2xl">
              Explore the verification stack
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Start from the test layer and follow the flow into environments, agents, analysis and coverage. Each card
              opens the lesson that explains that layer, and the last card opens the interactive architecture
              walkthrough, which follows the same layers.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stackLessons.map(({ id, title, description, href }) => (
              <Link
                key={id}
                data-node-id={id}
                href={href}
                className="group flex min-w-0 flex-col rounded-2xl border border-border bg-background p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
              >
                <span className="flex items-center justify-between gap-2 text-sm font-semibold text-primary">
                  {title}
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </span>
                <span className="mt-2 text-sm text-muted-foreground">{description}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
