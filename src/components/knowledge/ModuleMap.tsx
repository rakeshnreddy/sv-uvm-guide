'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SegmentedControl } from '@/components/visual-system';
import { useKnowledgeContext } from '@/contexts/KnowledgeContext';
import {
  analyzeDependencies,
  mapLanes,
  moveInMap,
  prerequisiteClosure,
  type ConceptGraph,
  type ConceptNode,
  type ConceptTier,
  type MapKey,
} from '@/lib/knowledge-graph-engine';
import { milestoneName } from '@/lib/learning-paths';
import { cn } from '@/lib/utils';

export const MAP_TIERS: readonly { value: ConceptTier; label: string }[] = [
  { value: 'Foundational', label: 'Tier 1' },
  { value: 'Intermediate', label: 'Tier 2' },
  { value: 'Advanced', label: 'Tier 3' },
  { value: 'Expert', label: 'Tier 4' },
];

const MAP_KEYS = new Set<string>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

export const mapNodeDomId = (moduleId: string) => `concept-map-${moduleId}`;

interface ModuleMapProps {
  graph: ConceptGraph;
  tier: ConceptTier;
  onTierChange: (tier: ConceptTier) => void;
  /** The selected module node id. */
  selectedId: string;
  onSelect: (node: ConceptNode) => void;
}

/**
 * The module map: one tier at a time, lanes as columns, modules in manifest
 * order. Selecting a module marks its direct prerequisites (▲ first) and the
 * modules that build on it (▼ next) and opens its details below. Arrow keys
 * move between modules (roving tabindex); Enter or Space selects.
 */
export default function ModuleMap({ graph, tier, onTierChange, selectedId, onSelect }: ModuleMapProps) {
  const lanes = useMemo(() => mapLanes(graph, tier), [graph, tier]);
  const tierModules = useMemo(() => lanes.flatMap((lane) => lane.modules), [lanes]);
  const selected = graph.byId.get(selectedId);
  const dependencies = useMemo(() => analyzeDependencies(graph, selectedId), [graph, selectedId]);
  const prerequisiteIds = new Set(dependencies.prerequisites.map((node) => node.id));
  const dependentIds = new Set(dependencies.dependents.map((node) => node.id));
  const hintId = useId();

  const selectedInTier = tierModules.some((node) => node.id === selectedId);
  const [focusId, setFocusId] = useState(selectedInTier ? selectedId : tierModules[0]?.id ?? '');
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const moveFocus = useRef(false);

  // Keep the roving tab stop on the selected module, or on the tier's first module.
  useEffect(() => {
    setFocusId(selectedInTier ? selectedId : tierModules[0]?.id ?? '');
  }, [selectedId, selectedInTier, tierModules]);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    buttons.current.get(focusId)?.focus();
  }, [focusId]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!MAP_KEYS.has(event.key)) return;
    event.preventDefault();
    const next = moveInMap(lanes, focusId, event.key as MapKey);
    if (next === focusId) return;
    moveFocus.current = true;
    setFocusId(next);
  };

  const tierLabel = MAP_TIERS.find((entry) => entry.value === tier)?.label ?? tier;

  return (
    <div className="space-y-4">
      <SegmentedControl label="Tier shown on the map" options={[...MAP_TIERS]} value={tier} onChange={onTierChange} />

      <p id={hintId} className="text-sm text-muted-foreground">
        Columns are the lanes of {tierLabel}; modules run top to bottom in curriculum order. Arrow keys move between modules,
        Enter or Space selects one. After you select a module, <span aria-hidden="true">▲</span> first marks a module it
        needs and <span aria-hidden="true">▼</span> next a module that builds on it.
      </p>

      <div
        role="group"
        aria-label={`${tierLabel} module map`}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        className="grid gap-2 sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.max(lanes.length, 1)}, minmax(0, 1fr))` }}
      >
        {lanes.map((lane) => (
          <div key={lane.lane} className="min-w-0">
            <h3 lang="en" className="mb-2 min-h-8 hyphens-auto break-words text-label text-foreground">
              {lane.lane}
            </h3>
            <ul className="space-y-2">
              {lane.modules.map((node) => {
                const isSelected = node.id === selectedId;
                const isPrerequisite = prerequisiteIds.has(node.id);
                const isDependent = dependentIds.has(node.id);
                return (
                  <li key={node.id}>
                    <button
                      id={mapNodeDomId(node.moduleId!)}
                      ref={(element) => {
                        if (element) buttons.current.set(node.id, element);
                        else buttons.current.delete(node.id);
                      }}
                      type="button"
                      tabIndex={node.id === focusId ? 0 : -1}
                      aria-pressed={isSelected}
                      onClick={() => onSelect(node)}
                      onFocus={() => setFocusId(node.id)}
                      className={cn(
                        'flex min-h-11 w-full min-w-0 flex-col items-start rounded-lg border bg-card px-2 py-1.5 text-left transition-colors duration-150 ease-bench focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                        isSelected
                          ? 'border-2 border-cyan-600 bg-cyan-500/15 dark:border-cyan-400'
                          : isPrerequisite
                            ? 'border-amber-500 bg-amber-500/10'
                            : isDependent
                              ? 'border-violet-500 bg-violet-500/10'
                              : 'border-border hover:bg-muted',
                        node.track === 'elective' && !isSelected && 'border-dashed',
                      )}
                    >
                      <span className="font-mono text-xs font-semibold [font-variant-ligatures:none] sm:text-sm">{node.code}</span>
                      <span className="sr-only text-xs leading-snug text-muted-foreground sm:not-sr-only sm:line-clamp-2">
                        {node.name.slice((node.code?.length ?? 0) + 2)}
                      </span>
                      {isPrerequisite && (
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          <span aria-hidden="true">▲ </span>first<span className="sr-only">: needed before {selected?.code}</span>
                        </span>
                      )}
                      {isDependent && (
                        <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                          <span aria-hidden="true">▼ </span>next<span className="sr-only">: builds on {selected?.code}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {selected
          ? `Selected ${selected.name}. Study first: ${dependencies.prerequisites.length} modules. Leads to: ${dependencies.dependents.length} modules.`
          : ''}
      </p>

      {selected && <ModuleDetails graph={graph} module={selected} onSelect={onSelect} />}
    </div>
  );
}

interface ModuleDetailsProps {
  graph: ConceptGraph;
  module: ConceptNode;
  onSelect: (node: ConceptNode) => void;
}

/** The selected module: what it needs, what it leads to, its lessons and key terms. */
export function ModuleDetails({ graph, module, onSelect }: ModuleDetailsProps) {
  const { setActiveConcept } = useKnowledgeContext();
  const { prerequisites, dependents, related } = analyzeDependencies(graph, module.id);
  const closure = prerequisiteClosure(graph, module.moduleId!);
  const headingId = useId();

  const moduleButton = (node: ConceptNode) => (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className="min-h-10 w-full rounded-lg border border-border px-3 py-1.5 text-left text-sm transition-colors duration-150 ease-bench hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {node.name}
      {node.tier !== module.tier && <span className="text-muted-foreground"> ({node.tier})</span>}
    </button>
  );

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
      <p className="text-xs font-medium text-subtle">
        {module.tier} · {module.lane}
        {module.track === 'elective' ? ' · elective' : ''}
      </p>
      <h3 id={headingId} className="mt-1 text-h3 text-foreground">
        {module.name}
      </h3>
      <p className="mt-2 text-muted-foreground">{module.description}</p>
      {module.href && (
        <p className="mt-3">
          <Link href={module.href} className="font-semibold text-primary underline underline-offset-2 hover:no-underline">
            Open {module.code}
          </Link>
        </p>
      )}
      {module.milestones && module.milestones.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="font-semibold">Feeds milestone{module.milestones.length > 1 ? 's' : ''}: </span>
          {module.milestones.map((id) => `${id} (${milestoneName(id)})`).join('; ')}
        </p>
      )}

      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
        <div>
          <h4 className="mb-2 text-sm font-semibold">
            <span aria-hidden="true">▲ </span>Study first ({prerequisites.length})
          </h4>
          {prerequisites.length > 0 ? (
            <ul className="space-y-2">
              {prerequisites.map((node) => (
                <li key={node.id}>{moduleButton(node)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing: this is where the course starts.</p>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">
            <span aria-hidden="true">▼ </span>Leads to ({dependents.length})
          </h4>
          {dependents.length > 0 ? (
            <ul className="space-y-2">
              {dependents.map((node) => (
                <li key={node.id}>{moduleButton(node)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No module lists it as a prerequisite.</p>
          )}
        </div>
      </div>

      {closure.length > prerequisites.length && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">Everything it builds on ({closure.length} modules)</summary>
          <p className="mt-2 text-muted-foreground">{closure.map((node) => node.code).join(' → ')}</p>
        </details>
      )}

      <h4 className="mb-2 mt-4 text-sm font-semibold">Lessons ({module.lessons?.length ?? 0})</h4>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {(module.lessons ?? []).map((lesson) => (
          <li key={lesson.key}>
            <Link href={lesson.href} className="text-primary underline underline-offset-2 hover:no-underline">
              {lesson.title}
            </Link>
          </li>
        ))}
      </ol>

      {related.length > 0 && (
        <>
          <h4 className="mb-2 mt-4 text-sm font-semibold">Key terms taught here</h4>
          <ul className="flex flex-wrap gap-2">
            {related.map((term) => (
              <li key={term.id}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setActiveConcept(term)}
                  className="min-h-10 rounded border border-border bg-muted px-3 text-sm text-foreground transition-colors duration-150 ease-bench hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {term.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
