'use client';

import React, { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { SegmentedControl } from '@/components/visual-system';
import { matchesQuery } from '@/lib/curriculum-overview';
import {
  conceptSearchText,
  curriculumOrder,
  type ConceptGraph,
  type ConceptKind,
  type ConceptNode,
  type ConceptTier,
} from '@/lib/knowledge-graph-engine';
import { MAP_TIERS } from './ModuleMap';

type KindFilter = 'all' | ConceptKind;
type TierFilter = 'all' | ConceptTier;

const PAGE_SIZE = 40;

const KIND_LABEL: Record<ConceptKind, string> = { module: 'Module', lesson: 'Lesson', term: 'Key term' };

export interface ConceptListFilters {
  query: string;
  kind: KindFilter;
  tier: TierFilter;
}

/** The concepts that match a query, a kind and a tier, in curriculum order. */
export function filterConcepts(nodes: readonly ConceptNode[], { query, kind, tier }: ConceptListFilters): ConceptNode[] {
  return nodes.filter(
    (node) =>
      (kind === 'all' || node.kind === kind) &&
      (tier === 'all' || node.tier === tier) &&
      matchesQuery(conceptSearchText(node), query),
  );
}

interface ConceptListProps {
  graph: ConceptGraph;
  /** Show a module on the map above. */
  onShowOnMap: (node: ConceptNode) => void;
}

/**
 * Every module, lesson and key term as a searchable list: the text version of
 * the module map, and the way to find a term by name.
 */
export default function ConceptList({ graph, onShowOnMap }: ConceptListProps) {
  const ordered = useMemo(() => curriculumOrder(graph), [graph]);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [tier, setTier] = useState<TierFilter>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const inputId = useId();

  const counts = useMemo(() => {
    const count = (k: ConceptKind) => ordered.filter((node) => node.kind === k).length;
    return { all: ordered.length, module: count('module'), lesson: count('lesson'), term: count('term') };
  }, [ordered]);
  const results = useMemo(() => filterConcepts(ordered, { query, kind, tier }), [ordered, query, kind, tier]);
  const shown = results.slice(0, limit);

  const resetLimit = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setLimit(PAGE_SIZE);
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-foreground">
          Search concepts
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => resetLimit(setQuery)(event.target.value)}
          placeholder="For example: clocking block, objection, 4KB"
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <SegmentedControl<KindFilter>
        label="Kind of concept"
        value={kind}
        onChange={resetLimit(setKind)}
        options={[
          { value: 'all', label: `All (${counts.all})` },
          { value: 'module', label: `Modules (${counts.module})` },
          { value: 'lesson', label: `Lessons (${counts.lesson})` },
          { value: 'term', label: `Key terms (${counts.term})` },
        ]}
      />
      <SegmentedControl<TierFilter>
        label="Tier"
        value={tier}
        onChange={resetLimit(setTier)}
        options={[{ value: 'all', label: 'All tiers' }, ...MAP_TIERS]}
      />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {results.length === 0
          ? 'No concept matches. Try a shorter word or another filter.'
          : `Showing ${shown.length} of ${results.length} ${results.length === 1 ? 'concept' : 'concepts'}.`}
      </p>

      <ul className="space-y-3">
        {shown.map((node) => (
          <li key={node.id} className="glass-quiet rounded-xl p-3 sm:p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {KIND_LABEL[node.kind ?? 'term']} · {node.tier}
              {node.kind === 'term' && node.code ? ` · first taught in ${node.code}` : ''}
              {node.track === 'elective' ? ' · elective' : ''}
            </p>
            <h3 className="mt-1 break-words text-h4 text-foreground">
              {node.kind !== 'term' && node.href ? (
                <Link
                  href={node.href}
                  className="text-foreground underline-offset-4 transition-colors duration-150 ease-bench hover:text-primary hover:underline"
                >
                  {node.name}
                </Link>
              ) : (
                node.name
              )}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{node.description}</p>
            {node.kind === 'term' && (
              <p className="mt-2 text-sm">
                <span className="font-semibold">Taught in: </span>
                {(node.lessons ?? []).map((lesson, index) => (
                  <React.Fragment key={lesson.key}>
                    {index > 0 && '; '}
                    <Link href={lesson.href} className="text-primary underline underline-offset-2 hover:no-underline">
                      {lesson.title}
                    </Link>
                  </React.Fragment>
                ))}
              </p>
            )}
            {node.kind === 'module' && (
              <button
                type="button"
                onClick={() => onShowOnMap(node)}
                className="mt-2 min-h-10 rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors duration-150 ease-bench hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Show {node.code} on the map
              </button>
            )}
          </li>
        ))}
      </ul>

      {results.length > shown.length && (
        <button
          type="button"
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
          className="min-h-11 w-full rounded-lg border border-border bg-muted px-4 text-sm font-medium text-foreground transition-colors duration-150 ease-bench hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Show {Math.min(PAGE_SIZE, results.length - shown.length)} more
        </button>
      )}
    </div>
  );
}
