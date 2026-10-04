'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

import type { OverviewModule, OverviewTier } from '@/lib/curriculum-overview';
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
 * and its modules in manifest order. The section id ("t1"…"t4") is the anchor
 * that /curriculum#t3 opens.
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
  const headingId = `${tier.anchor}-heading`;
  const panelId = `${tier.anchor}-panel`;

  const prerequisitesOf = (module: OverviewModule): ModuleCardPrerequisite[] =>
    module.prerequisites.flatMap((id) => {
      const prerequisite = moduleIndex.get(id);
      return prerequisite
        ? [{ id, code: prerequisite.code, title: prerequisite.displayTitle, href: prerequisite.href }]
        : [];
    });

  return (
    <section id={tier.anchor} aria-labelledby={headingId} className="scroll-mt-24 rounded-3xl border border-border bg-card/60">
      <h3 id={headingId} className="text-xl font-semibold text-foreground sm:text-2xl">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={cn(
            'flex min-h-[44px] w-full items-center justify-between gap-3 rounded-3xl px-4 pt-4 text-left sm:px-6 sm:pt-5',
            focusRing,
          )}
        >
          <span>{tier.title}</span>
          <ChevronDown
            className={cn('h-6 w-6 shrink-0 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
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
        <p className="mt-1 text-xs text-muted-foreground">{countLine(tier, modules.length, searching)}</p>
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
