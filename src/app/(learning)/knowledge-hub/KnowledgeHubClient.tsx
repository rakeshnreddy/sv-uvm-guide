'use client';

import React, { useCallback, useState } from 'react';
import ConceptList from '@/components/knowledge/ConceptList';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Section } from '@/components/layout/Section';
import ConceptModal from '@/components/knowledge/ConceptModal';
import ModuleMap, { mapNodeDomId } from '@/components/knowledge/ModuleMap';
import { KnowledgeContextProvider } from '@/contexts/KnowledgeContext';
import { conceptGraph, type ConceptNode, type ConceptTier } from '@/lib/knowledge-graph-engine';
import { siteLabel } from '@/lib/nav-labels';

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
      <PageShell width="content">
        <PageHeader
          title={siteLabel('/knowledge-hub')}
          lead={`How the ${moduleCount} modules and ${lessonCount} lessons of the curriculum build on each other, and where each of ${termCount} key terms is taught.`}
        />

        <Section id="module-map" title="Module map">
          <ModuleMap graph={conceptGraph} tier={tier} onTierChange={setTier} selectedId={selectedId} onSelect={select} />
        </Section>

        <Section
          id="concept-list"
          title="Every concept"
          description="The same map as a list: search modules, lessons and key terms, and open the lesson that teaches each one."
        >
          <ConceptList graph={conceptGraph} onShowOnMap={showOnMap} />
        </Section>
      </PageShell>
      <ConceptModal />
    </KnowledgeContextProvider>
  );
};

export default KnowledgeHubClient;
