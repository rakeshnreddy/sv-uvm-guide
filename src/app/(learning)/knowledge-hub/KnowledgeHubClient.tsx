'use client';

import React, { useCallback, useState } from 'react';
import ConceptList from '@/components/knowledge/ConceptList';
import ConceptModal from '@/components/knowledge/ConceptModal';
import ModuleMap, { mapNodeDomId } from '@/components/knowledge/ModuleMap';
import { KnowledgeContextProvider } from '@/contexts/KnowledgeContext';
import { conceptGraph, type ConceptNode, type ConceptTier } from '@/lib/knowledge-graph-engine';

const FIRST_MODULE = conceptGraph.modules[0];

/**
 * The knowledge hub: a module map (prerequisites from the curriculum
 * manifest) and a searchable list of every module, lesson and key term, both
 * over the concept graph in src/lib/knowledge-graph-engine.ts.
 */
const KnowledgeHubClient = () => {
  const [tier, setTier] = useState<ConceptTier>(FIRST_MODULE?.tier ?? 'Foundational');
  const [selectedId, setSelectedId] = useState<string>(FIRST_MODULE?.id ?? '');

  const select = useCallback((node: ConceptNode) => {
    setTier(node.tier);
    setSelectedId(node.id);
  }, []);

  const showOnMap = useCallback(
    (node: ConceptNode) => {
      select(node);
      // After the map re-renders on the module's tier, bring the module into view and focus it.
      requestAnimationFrame(() => {
        const element = node.moduleId ? document.getElementById(mapNodeDomId(node.moduleId)) : null;
        element?.scrollIntoView({ block: 'center' });
        element?.focus();
      });
    },
    [select],
  );

  const moduleCount = conceptGraph.modules.length;
  const lessonCount = conceptGraph.modules.reduce((total, node) => total + (node.lessons?.length ?? 0), 0);
  const termCount = conceptGraph.terms.length;

  return (
    <KnowledgeContextProvider>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl">Knowledge Hub</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            How the {moduleCount} modules and {lessonCount} lessons of the curriculum build on each other, and where each of{' '}
            {termCount} key terms is taught.
          </p>
        </header>

        <section aria-labelledby="module-map-heading" className="mb-10">
          <h2 id="module-map-heading" className="mb-3 text-2xl font-bold">
            Module map
          </h2>
          <ModuleMap graph={conceptGraph} tier={tier} onTierChange={setTier} selectedId={selectedId} onSelect={select} />
        </section>

        <section aria-labelledby="concept-list-heading">
          <h2 id="concept-list-heading" className="mb-1 text-2xl font-bold">
            Every concept
          </h2>
          <p className="mb-4 text-muted-foreground">
            The same map as a list: search modules, lessons and key terms, and open the lesson that teaches each one.
          </p>
          <ConceptList graph={conceptGraph} onShowOnMap={showOnMap} />
        </section>
      </div>
      <ConceptModal />
    </KnowledgeContextProvider>
  );
};

export default KnowledgeHubClient;
