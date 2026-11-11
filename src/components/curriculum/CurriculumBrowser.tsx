'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { List, Map as MapIcon, Search } from 'lucide-react';

import {
  indexOverviewModules,
  matchesQuery,
  moduleSearchText,
  type OverviewTier,
  type PlannedModule,
} from '@/lib/curriculum-overview';
import { tierSectionId } from '@/lib/site-links';
import { cn } from '@/lib/utils';
import CurriculumMap from './LearningPathDiagram';
import { TierSection } from './TierSection';
import { focusRing, secondaryAction } from './overview-ui';

export interface CurriculumBrowserProps {
  tiers: OverviewTier[];
  planned: readonly PlannedModule[];
  milestoneNames: Readonly<Record<string, string>>;
  visitedModules: ReadonlySet<string>;
  hereModuleId?: string;
}

type View = 'list' | 'map';

/**
 * The hash of a link that points at a section of the page it is on ("#t3" for
 * "/curriculum#t3" clicked on /curriculum), or null for a link anywhere else.
 */
export function samePageHash(href: string, location: Pick<Location, 'href' | 'pathname'>): string | null {
  let url: URL;
  try {
    url = new URL(href, location.href);
  } catch {
    return null;
  }
  if (!url.hash || url.origin !== new URL(location.href).origin) return null;
  const normalise = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);
  return normalise(url.pathname) === normalise(location.pathname) ? url.hash : null;
}

/**
 * "Modules by tier": every module in manifest order, as tier sections (list)
 * or as the curriculum map. The search filters modules by code, titles and
 * descriptions and opens every tier that has a match. "/curriculum#t3" opens
 * Tier 3, whether the page loads with that hash or a link on the page (the
 * course outline, the footer) points there.
 */
export function CurriculumBrowser({ tiers, planned, milestoneNames, visitedModules, hereModuleId }: CurriculumBrowserProps) {
  const [view, setView] = useState<View>('list');
  const [query, setQuery] = useState('');
  const [openTiers, setOpenTiers] = useState<ReadonlySet<string>>(() => new Set(tiers.slice(0, 1).map((t) => t.id)));
  // Tiers the learner collapsed while searching; cleared whenever the query changes.
  const [collapsedInSearch, setCollapsedInSearch] = useState<ReadonlySet<string>>(new Set());
  const searchId = useId();
  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const moduleIndex = useMemo(() => indexOverviewModules(tiers), [tiers]);
  const searchText = useMemo(
    () => new Map(tiers.flatMap((tier) => tier.modules.map((m) => [m.id, moduleSearchText(m)] as const))),
    [tiers],
  );

  useEffect(() => {
    const openTier = (hash: string) => {
      const tier = tiers.find((t) => `#${tierSectionId(t.id)}` === hash);
      if (!tier) return;
      setView('list');
      setQuery('');
      setOpenTiers((current) => new Set(current).add(tier.id));
      window.requestAnimationFrame(() => document.getElementById(tierSectionId(tier.id))?.scrollIntoView?.({ block: 'start' }));
    };
    const openFromHash = () => openTier(window.location.hash);
    // A Next.js link to "/curriculum#t3" from this page changes the URL with
    // history.pushState, which fires no hashchange: catch the click instead.
    const openFromClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      const hash = anchor ? samePageHash(anchor.getAttribute('href') ?? '', window.location) : null;
      if (hash) openTier(hash);
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    document.addEventListener('click', openFromClick);
    return () => {
      window.removeEventListener('hashchange', openFromHash);
      document.removeEventListener('click', openFromClick);
    };
  }, [tiers]);

  useEffect(() => {
    setCollapsedInSearch(new Set());
  }, [trimmed]);

  const filtered = useMemo(
    () =>
      tiers.map((tier) => ({
        tier,
        modules: searching ? tier.modules.filter((m) => matchesQuery(searchText.get(m.id) ?? '', trimmed)) : tier.modules,
      })),
    [tiers, searching, trimmed, searchText],
  );
  const shown = searching ? filtered.filter((entry) => entry.modules.length > 0) : filtered;
  const matchCount = filtered.reduce((sum, entry) => sum + entry.modules.length, 0);
  const allOpen = tiers.every((t) => openTiers.has(t.id));

  const isOpen = (tierId: string) => (searching ? !collapsedInSearch.has(tierId) : openTiers.has(tierId));
  const toggle = (tierId: string) => {
    const flip = (set: ReadonlySet<string>) => {
      const next = new Set(set);
      if (next.has(tierId)) next.delete(tierId);
      else next.add(tierId);
      return next;
    };
    if (searching) setCollapsedInSearch(flip);
    else setOpenTiers(flip);
  };

  const status = searching
    ? matchCount === 0
      ? `No modules match “${trimmed}”. Try a module code such as I-SV-5, or a topic such as mailbox.`
      : `${matchCount} ${matchCount === 1 ? 'module matches' : 'modules match'} “${trimmed}” in ${shown.length} ${
          shown.length === 1 ? 'tier' : 'tiers'
        }.`
    : '';

  return (
    <section id="modules" aria-labelledby="modules-heading" className="mb-12 scroll-mt-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h2 id="modules-heading" className="text-h2 text-foreground">
            Modules by tier
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Every module in learning order. Core modules form the main path. Electives, marked with a dashed border and
            an Elective label, sit beside it, and the core path&apos;s Next link skips them.
          </p>
        </div>
        <div role="group" aria-label="View" className="inline-flex shrink-0 self-start rounded-lg border border-border bg-card p-1 lg:self-auto">
          {(
            [
              { id: 'list', label: 'List', Icon: List },
              { id: 'map', label: 'Map', Icon: MapIcon },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn(
                'inline-flex min-h-[40px] items-center gap-2 rounded-md border-b-2 px-4 text-sm transition-colors duration-150 ease-bench motion-reduce:transition-none',
                focusRing,
                // The chosen view: the raised surface with a 2 px accent underline, not an accent fill.
                view === id
                  ? 'border-primary bg-muted font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor={searchId} className="text-sm font-medium text-foreground">
              Search modules and lessons
            </label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="For example: mailbox, WSTRB, config_db or I-SV-5"
                autoComplete="off"
                className={cn(
                  'min-h-[44px] w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground',
                  focusRing,
                )}
              />
            </div>
          </div>
          {searching ? (
            <button type="button" onClick={() => setQuery('')} className={secondaryAction}>
              Clear search
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpenTiers(allOpen ? new Set() : new Set(tiers.map((t) => t.id)))}
              className={secondaryAction}
            >
              {allOpen ? 'Collapse all tiers' : 'Expand all tiers'}
            </button>
          )}
        </div>
      )}

      <p aria-live="polite" className={cn('text-sm text-muted-foreground', status && 'mt-3')}>
        {view === 'list' ? status : ''}
      </p>

      {view === 'list' ? (
        shown.length > 0 ? (
          <div className="mt-4 space-y-4">
            {shown.map(({ tier, modules }) => (
              <TierSection
                key={tier.id}
                tier={tier}
                modules={modules}
                open={isOpen(tier.id)}
                onToggle={() => toggle(tier.id)}
                searching={searching}
                moduleIndex={moduleIndex}
                milestoneNames={milestoneNames}
                visitedModules={visitedModules}
                hereModuleId={hereModuleId}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-h4 text-foreground">No modules found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The search covers module codes, titles and lesson descriptions.
            </p>
            <button type="button" onClick={() => setQuery('')} className={cn(secondaryAction, 'mt-4')}>
              Clear search
            </button>
          </div>
        )
      ) : (
        <CurriculumMap tiers={tiers} planned={planned} hereModuleId={hereModuleId} />
      )}
    </section>
  );
}

export default CurriculumBrowser;
