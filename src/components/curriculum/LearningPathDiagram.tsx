'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, MapPin } from 'lucide-react';

import {
  indexOverviewModules,
  type OverviewModule,
  type OverviewTier,
  type PlannedModule,
} from '@/lib/curriculum-overview';
import { cn } from '@/lib/utils';
import { eyebrow, focusRing } from './overview-ui';

export interface CurriculumMapProps {
  tiers: OverviewTier[];
  /** Modules the spine proposes that do not exist yet: shown, never linked. */
  planned: readonly PlannedModule[];
  /** The module of the lesson the learner opened last. */
  hereModuleId?: string;
}

type LaneItem = { kind: 'module'; module: OverviewModule } | { kind: 'planned'; planned: PlannedModule };

interface Lane {
  name: string;
  items: LaneItem[];
}

/** Groups a tier's modules into lanes in manifest order and slots planned modules after their predecessor. */
export function tierLanes(tier: OverviewTier, planned: readonly PlannedModule[]): Lane[] {
  const lanes: Lane[] = [];
  const laneOf = (name: string) => {
    let lane = lanes.find((l) => l.name === name);
    if (!lane) {
      lane = { name, items: [] };
      lanes.push(lane);
    }
    return lane;
  };
  for (const entry of tier.modules) {
    laneOf(entry.lane).items.push({ kind: 'module', module: entry });
    for (const p of planned) {
      if (p.tierId === tier.id && p.after === entry.id) laneOf(p.lane).items.push({ kind: 'planned', planned: p });
    }
  }
  return lanes;
}

function codes(ids: readonly string[], modules: ReadonlyMap<string, OverviewModule>): string {
  return ids.map((id) => modules.get(id)?.code ?? id).join(', ');
}

function describe(entry: OverviewModule, modules: ReadonlyMap<string, OverviewModule>, here: boolean): string {
  const parts = [
    here ? 'You are here.' : '',
    entry.track === 'elective' ? 'Elective.' : 'Core module.',
    entry.prerequisites.length ? `Needs ${codes(entry.prerequisites, modules)}.` : 'Needs no earlier module.',
    entry.unlocks.length ? `Unlocks ${codes(entry.unlocks, modules)}.` : 'No later module builds on it yet.',
  ];
  return parts.filter(Boolean).join(' ');
}

/**
 * The curriculum map: tiers are columns, tracks are lanes, every module is a
 * link. Focusing or pointing at a module marks the modules it needs first and
 * the ones that build on it, with a text tag on each so the relationship never
 * rests on colour. Each link also carries the same facts as its description,
 * and the list view is the full text equivalent.
 */
export default function CurriculumMap({ tiers, planned, hereModuleId }: CurriculumMapProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const modules = useMemo(() => indexOverviewModules(tiers), [tiers]);
  const active = activeId ? modules.get(activeId) : undefined;
  const needs = new Set(active?.prerequisites ?? []);
  const unlocks = new Set(active?.unlocks ?? []);

  return (
    <div role="group" aria-labelledby="curriculum-map-heading" className="mt-6">
      <h3 id="curriculum-map-heading" className="text-lg font-semibold text-foreground">
        Curriculum map
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Tiers run across, tracks run down, and every module links to its first lesson. Focus or point at a module to
        mark what it needs first and what builds on it. The list view gives the same prerequisites as text.
      </p>

      <ul aria-label="Map legend" className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <li className="rounded-md border border-border bg-background px-2 py-1">Core module</li>
        <li className="rounded-md border-2 border-dashed border-border bg-background px-2 py-1">Elective (labelled)</li>
        <li className="rounded-md border border-dotted border-muted-foreground bg-muted px-2 py-1">Planned: not published yet</li>
        <li className="inline-flex items-center gap-1 rounded-md border border-primary px-2 py-1 text-foreground">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> You are here
        </li>
        <li className="inline-flex items-center gap-1 rounded-md border-2 border-primary px-2 py-1 text-foreground">
          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> Needed first
        </li>
        <li className="inline-flex items-center gap-1 rounded-md border-2 border-foreground/70 px-2 py-1 text-foreground">
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> Builds on it
        </li>
      </ul>

      <p aria-hidden="true" className="mt-3 min-h-[1.25rem] text-sm text-foreground">
        {active
          ? `${active.code} needs ${active.prerequisites.length ? codes(active.prerequisites, modules) : 'no earlier module'}; ${
              active.unlocks.length ? `${codes(active.unlocks, modules)} build on it` : 'no later module builds on it yet'
            }.`
          : ''}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {tiers.map((tier) => (
          <section
            key={tier.id}
            aria-labelledby={`map-${tier.anchor}`}
            className="min-w-0 rounded-2xl border border-border bg-card p-3"
          >
            <h4 id={`map-${tier.anchor}`} className="text-sm font-semibold text-foreground">
              {tier.title}
            </h4>
            {tierLanes(tier, planned).map((lane) => {
              const laneId = `map-${tier.anchor}-${lane.name.replace(/\W+/g, '-').toLowerCase()}`;
              return (
                <div key={lane.name} className="mt-3">
                  <p id={laneId} className={eyebrow}>
                    {lane.name}
                  </p>
                  <ul
                    aria-labelledby={laneId}
                    className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,9.5rem),1fr))] gap-1.5 lg:grid-cols-1"
                  >
                    {lane.items.map((item) => {
                      if (item.kind === 'planned') {
                        const p = item.planned;
                        return (
                          <li key={`planned-${p.code}`} className="min-w-0">
                            <div className="flex min-h-[44px] flex-col justify-center rounded-lg border border-dotted border-muted-foreground bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                              <span className="font-mono font-semibold">{p.code}</span>
                              <span className="[overflow-wrap:anywhere]">{p.title}</span>
                              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">Planned</span>
                            </div>
                          </li>
                        );
                      }
                      const m = item.module;
                      const here = m.id === hereModuleId;
                      const isActive = m.id === activeId;
                      const isNeed = needs.has(m.id);
                      const isUnlock = unlocks.has(m.id);
                      const descriptionId = `map-desc-${m.id}`;
                      return (
                        <li key={m.id} className="min-w-0">
                          <Link
                            href={m.href}
                            aria-describedby={descriptionId}
                            aria-current={here ? 'location' : undefined}
                            onFocus={() => setActiveId(m.id)}
                            onBlur={() => setActiveId((current) => (current === m.id ? null : current))}
                            onMouseEnter={() => setActiveId(m.id)}
                            onMouseLeave={() => setActiveId((current) => (current === m.id ? null : current))}
                            className={cn(
                              'flex min-h-[44px] flex-col justify-center rounded-lg bg-background px-2.5 py-1.5 text-xs text-foreground transition-colors motion-reduce:transition-none hover:border-primary',
                              focusRing,
                              m.track === 'elective' ? 'border-2 border-dashed border-border' : 'border border-border',
                              here && 'border-primary',
                              isNeed && 'border-2 border-solid border-primary',
                              isUnlock && 'border-2 border-solid border-foreground/70',
                              isActive && 'ring-2 ring-primary',
                            )}
                          >
                            <span className="flex items-center gap-1 font-mono font-semibold">
                              {m.code}
                              {here && <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                            </span>
                            <span className="[overflow-wrap:anywhere]">{m.displayTitle}</span>
                            {(here || m.track === 'elective' || isNeed || isUnlock) && (
                              <span className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {here && <span className="text-primary">You are here</span>}
                                {m.track === 'elective' && <span>Elective</span>}
                                {isNeed && (
                                  <span className="inline-flex items-center gap-0.5 text-foreground">
                                    <ArrowUp className="h-3 w-3" aria-hidden="true" /> Needed first
                                  </span>
                                )}
                                {isUnlock && (
                                  <span className="inline-flex items-center gap-0.5 text-foreground">
                                    <ArrowDown className="h-3 w-3" aria-hidden="true" /> Builds on it
                                  </span>
                                )}
                              </span>
                            )}
                          </Link>
                          <span id={descriptionId} hidden>
                            {describe(m, modules, here)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
