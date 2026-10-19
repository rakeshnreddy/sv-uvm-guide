'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import LearningPathGenerator from '@/components/knowledge/LearningPathGenerator';
import ConceptDependencyAnalyzer from '@/components/knowledge/ConceptDependencyAnalyzer';

const KnowledgeGraphVisualizer = dynamic(
  () => import('@/components/knowledge/KnowledgeGraphVisualizer'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

/**
 * The draft knowledge hub: the concept graph, a prerequisite path finder and
 * a dependency list, all over the hand-written graph in
 * src/lib/knowledge-graph-engine.ts. Rendered only when draft pages are on.
 */
const KnowledgeHubClient = () => {
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);

  return (
    <div className="container mx-auto p-4">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-2">SystemVerilog & UVM Knowledge Hub</h1>
        <p className="text-xl text-muted-foreground">
          A map of SystemVerilog and UVM concepts and the prerequisites between them.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="lg:col-span-2">
          <KnowledgeGraphVisualizer highlightedPath={highlightedPath} />
        </div>
        <div className="bg-white shadow-md rounded-lg p-6">
          <LearningPathGenerator onPathGenerated={setHighlightedPath} />
        </div>
        <div className="bg-white shadow-md rounded-lg p-6">
          <ConceptDependencyAnalyzer />
        </div>
      </div>
    </div>
  );
};

export default KnowledgeHubClient;
