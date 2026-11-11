import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import CurriculumOverview from '@/components/curriculum/CurriculumOverview';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Section } from '@/components/layout/Section';
import { cardClass } from '@/components/ui/Card';
import { verificationStackLinks } from '@/components/diagrams/verification-stack-links';
import { curriculumData, findPrevNextTopics } from '@/lib/curriculum-data';
import { buildCurriculumOverview, PLANNED_MODULES, type LessonPosition } from '@/lib/curriculum-overview';
import { readLessonMinutes, readManifestTiers } from '@/lib/curriculum-scan';
import { getAllLabs } from '@/lib/lab-registry';
import { resolveMilestones, resolveRoutes } from '@/lib/learning-paths';
import { siteLabel } from '@/lib/nav-labels';
import { CURRICULUM_HREF } from '@/lib/site-links';

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
    <PageShell width="content">
      <PageHeader
        title={siteLabel(CURRICULUM_HREF)}
        lead="SystemVerilog and UVM from the first testbench to staff-level methodology, in four tiers. Pick a route that matches your experience, or browse every module below."
      />

      <CurriculumOverview tiers={tiers} routes={routes} milestones={milestones} planned={PLANNED_MODULES} />

      <Section
        id="verification-stack"
        title="Explore the verification stack"
        description="Follow the test layer into environments, agents, analysis and coverage. Each card opens the lesson for that layer; the last opens the interactive architecture walkthrough."
        className="mt-12"
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stackLessons.map(({ id, title, description, href }) => (
            <li key={id} className={cardClass({ variant: 'interactive', padding: 'compact', className: 'flex min-w-0 flex-col' })}>
              <Link
                data-node-id={id}
                href={href}
                className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
              >
                {title}
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              </Link>
              <span className="mt-2 text-sm text-muted-foreground">{description}</span>
            </li>
          ))}
        </ul>
      </Section>
    </PageShell>
  );
}
