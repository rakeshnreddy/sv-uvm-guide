'use client';

import React, { useId, useMemo, useState } from 'react';

import { LessonLinkList, focusRing } from '@/components/practice/LearnInLesson';
import {
  RESOURCE_COST_LABELS,
  matchesResourceQuery,
  type ResourceGroup,
  type ResourceGroupId,
} from '@/lib/resources';
import type { ResolvedResource } from '@/lib/resources-lessons';
import { cn } from '@/lib/utils';

interface ResourceLibraryProps {
  groups: readonly ResourceGroup[];
  resources: readonly ResolvedResource[];
}

type GroupFilter = ResourceGroupId | 'all';

const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

/** Hostname shown next to each link, so learners see where it goes before they click. */
function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return href;
  }
}

function ResourceCard({ resource }: { resource: ResolvedResource }) {
  const headingId = `resource-${resource.id}`;
  return (
    <article
      aria-labelledby={headingId}
      data-resource-id={resource.id}
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-background/60 p-4 sm:p-5"
    >
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground [font-variant-ligatures:none]">
            {resource.tag}
          </span>
          <span className="text-xs text-muted-foreground">{RESOURCE_COST_LABELS[resource.cost]}</span>
        </div>
        <h3 id={headingId} className="text-lg font-semibold leading-snug text-foreground">
          <a
            href={resource.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('rounded-sm text-primary underline-offset-4 hover:underline', focusRing)}
          >
            {resource.name}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </h3>
        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {resource.publisher} · {hostOf(resource.href)}
        </p>
      </header>

      <p className="text-sm leading-relaxed text-foreground">{resource.summary}</p>

      {resource.supports.length > 0 ? (
        <div>
          <p className={eyebrow}>What it covers</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-foreground [overflow-wrap:anywhere]">
            {resource.supports.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className={eyebrow}>When to use it</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{resource.whenToUse}</p>
      </div>

      <LessonLinkList lessons={resource.lessonLinks} label="Used in" />
    </article>
  );
}

/**
 * The searchable, filterable list. Every resource is in the server-rendered
 * HTML; the search box and group buttons only hide the ones that do not match.
 */
export default function ResourceLibrary({ groups, resources }: ResourceLibraryProps) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<GroupFilter>('all');
  const searchId = useId();
  const statusId = useId();

  const visible = useMemo(
    () =>
      resources.filter(
        (resource) => (group === 'all' || resource.group === group) && matchesResourceQuery(resource, query),
      ),
    [resources, group, query],
  );

  const filterButton = (id: GroupFilter, label: string) => {
    const active = group === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={active}
        onClick={() => setGroup(id)}
        className={cn(
          'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
          active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background text-foreground hover:bg-muted',
          focusRing,
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3" role="search" aria-label="Filter resources">
        <label htmlFor={searchId} className="text-sm font-medium text-foreground">
          Search resources
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="For example: AXI, UVM, Python, 4-state"
          aria-describedby={statusId}
          className={cn(
            'w-full max-w-xl rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
            focusRing,
          )}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show resources by purpose">
          {filterButton('all', 'All')}
          {groups.map((g) => filterButton(g.id, g.title))}
        </div>
        <p id={statusId} className="text-sm text-muted-foreground" aria-live="polite">
          {visible.length === resources.length
            ? `Showing all ${resources.length} resources.`
            : `Showing ${visible.length} of ${resources.length} resources.`}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-foreground">
          No resource matches that search. Try a shorter word, or choose All.
        </p>
      ) : null}

      {groups.map((g) => {
        const items = visible.filter((resource) => resource.group === g.id);
        if (items.length === 0) return null;
        return (
          <section key={g.id} aria-labelledby={`group-${g.id}`} className="flex flex-col gap-4">
            <div>
              <h2 id={`group-${g.id}`} className="text-2xl font-semibold text-foreground">
                {g.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{g.purpose}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
