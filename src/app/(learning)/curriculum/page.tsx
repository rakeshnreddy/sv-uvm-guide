import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import CurriculumOverview from '@/components/curriculum/CurriculumOverview';
import { tierChip } from '@/components/curriculum/overview-ui';
import { recentScriptLessons, resumeRecentScript } from '@/components/curriculum/resume-recent-script';
import { routeFollowedScript } from '@/components/curriculum/route-followed-script';
import { returningLearnerScript } from '@/components/home/landing-resume';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Section } from '@/components/layout/Section';
import { cardClass } from '@/components/ui/Card';
import { verificationStackLinks } from '@/components/diagrams/verification-stack-links';
import { continueLessons } from '@/lib/continue-lesson-data';
import { curriculumData, findPrevNextTopics } from '@/lib/curriculum-data';
import { buildCurriculumOverview, PLANNED_MODULES, type LessonPosition, type OverviewTier } from '@/lib/curriculum-overview';
import { readLessonMinutes, readManifestTiers } from '@/lib/curriculum-scan';
import { getAllLabs } from '@/lib/lab-registry';
import { resolveMilestones, resolveRoutes } from '@/lib/learning-paths';
import { siteLabel } from '@/lib/nav-labels';
import { CURRICULUM_HREF, tierSectionId } from '@/lib/site-links';
import { tierDataAttribute, tierOfTierSlug } from '@/lib/tier-colors';

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

/**
 * The four tiers as jump links under the page lead, each with its step mark
 * in the tier colour (DESIGN.md section 11), so the page reads as four
 * coloured tiers from the top. "#t3" opens and scrolls to that tier's section.
 */
function TierJumpLinks({ tiers }: { tiers: readonly OverviewTier[] }) {
  return (
    <nav aria-label="Tiers" className="mt-6" data-testid="tier-jump-links">
      <ul className="flex flex-wrap gap-2">
        {tiers.map((tier) => (
          <li key={tier.id}>
            <a href={`#${tierSectionId(tier.id)}`} data-tier={tierDataAttribute(tierOfTierSlug(tier.id))} className={tierChip}>
              <span className="tier-step" aria-hidden="true" />
              {tier.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
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
  const lessonsInOrder = continueLessons();

  return (
    <PageShell width="content">
      {/*
        Mark <html> before first paint: a lesson visit, the followed route and how many recent lessons will be
        listed, so "Pick up where you left off" and the followed route's card paint at their final size.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: returningLearnerScript() + routeFollowedScript() + resumeRecentScript(recentScriptLessons(lessonsInOrder)),
        }}
      />
      <PageHeader
        title={siteLabel(CURRICULUM_HREF)}
        lead="SystemVerilog and UVM from the first testbench to staff-level methodology, in four tiers. Pick a route, or browse every module below."
      >
        <TierJumpLinks tiers={tiers} />
      </PageHeader>

      <CurriculumOverview tiers={tiers} routes={routes} milestones={milestones} planned={PLANNED_MODULES} continueLessons={lessonsInOrder} />

      <Section
        id="verification-stack"
        title="Explore the verification stack"
        description="Follow the test layer into environments, agents, analysis and coverage. Each card opens the lesson for that layer; the last opens the interactive architecture walkthrough."
        className="mt-12"
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stackLessons.map(({ id, title, description, href }) => (
            <li key={id} className={cardClass({ variant: 'glassQuietInteractive', padding: 'compact', className: 'flex min-w-0 flex-col' })}>
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
