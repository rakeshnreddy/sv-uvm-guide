'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

import type { OverviewModule, OverviewTier } from '@/lib/curriculum-overview';
import { tierSectionId } from '@/lib/site-links';
import { tierDataAttribute, tierOfTierSlug } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';
import { ModuleCard, type ModuleCardPrerequisite } from './ModuleCard';
import { focusRing } from './overview-ui';

export interface TierSectionProps {
  tier: OverviewTier;
  /** The modules to show: every module of the tier, or the ones matching a search. */
  modules: OverviewModule[];
  open: boolean;
  onToggle: () => void;
  /** Set while a search is active: the counts say how many modules match. */
  searching?: boolean;
  /** Every module by id, to resolve prerequisites in earlier tiers. */
  moduleIndex: ReadonlyMap<string, OverviewModule>;
  milestoneNames: Readonly<Record<string, string>>;
  visitedModules: ReadonlySet<string>;
  hereModuleId?: string;
}

function countLine(tier: OverviewTier, shown: number, searching: boolean): string {
  const modules = `${tier.modules.length} ${tier.modules.length === 1 ? 'module' : 'modules'}`;
  const electives = tier.electiveCount > 0 ? ` (${tier.electiveCount} elective)` : '';
  const lessons = `${tier.lessonCount} ${tier.lessonCount === 1 ? 'lesson' : 'lessons'}`;
  const matches = searching ? ` · ${shown} ${shown === 1 ? 'module matches' : 'modules match'}` : '';
  return `${modules}${electives} · ${lessons}${matches}`;
}

/**
 * One tier of the overview: a heading that holds the disclosure button (so
 * heading navigation still finds the tier), who the tier is for, its counts,
 * and its modules in manifest order. The section id ("t1"…"t4") comes from
 * tierSectionId in site-links and is the anchor that /curriculum#t3 opens.
 */
export const TierSection: React.FC<TierSectionProps> = ({
  tier,
  modules,
  open,
  onToggle,
  searching = false,
  moduleIndex,
  milestoneNames,
  visitedModules,
  hereModuleId,
}) => {
  // The stable id from site-links ("t3"), which /curriculum#t3, the course
  // outline, the breadcrumbs and the footer link to.
  const sectionId = tierSectionId(tier.id);
  const headingId = `${sectionId}-heading`;
  const panelId = `${sectionId}-panel`;

  const prerequisitesOf = (module: OverviewModule): ModuleCardPrerequisite[] =>
    module.prerequisites.flatMap((id) => {
      const prerequisite = moduleIndex.get(id);
      return prerequisite
        ? [{ id, code: prerequisite.code, title: prerequisite.displayTitle, href: prerequisite.href }]
        : [];
    });

  // The tier colour (DESIGN.md section 11): data-tier scopes the section, so
  // the heading's step mark, the 2 px top edge, every module card's edge and
  // the tinted signal tags inside all take this tier's colour.
  const tierNumber = tierOfTierSlug(tier.id);

  // scroll-mt-24 keeps the heading clear of the 64 px sticky header when a link lands here.
  return (
    <section
      id={sectionId}
      aria-labelledby={headingId}
      data-tier={tierDataAttribute(tierNumber)}
      className={cn('scroll-mt-24 rounded-2xl border border-border', tierNumber && 'tier-edge')}
    >
      <h3 id={headingId} className="text-h3 text-foreground">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={cn(
            'flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl px-4 pt-4 text-left sm:px-6 sm:pt-5',
            focusRing,
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            {tierNumber ? <span className="tier-step" aria-hidden="true" data-testid="tier-step" /> : null}
            <span>{tier.title}</span>
          </span>
          <ChevronDown
            className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div className="px-4 pb-4 sm:px-6 sm:pb-5">
        {tier.audience && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Who it is for:</span> {tier.audience}
          </p>
        )}
        <p className="mt-1 text-xs text-subtle">{countLine(tier, modules.length, searching)}</p>
      </div>
      <div id={panelId} hidden={!open} className="px-4 pb-5 sm:px-6">
        {open && (
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <li key={module.id} className="min-w-0">
                <ModuleCard
                  module={module}
                  prerequisites={prerequisitesOf(module)}
                  milestoneNames={milestoneNames}
                  visited={visitedModules.has(module.id)}
                  here={hereModuleId === module.id}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

export default TierSection;
