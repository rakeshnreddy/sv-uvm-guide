'use client';

import React, { useState } from 'react';
import KnowledgeGraphVisualizer from '@/components/knowledge/KnowledgeGraphVisualizer';
import ConceptRelationshipMapper from '@/components/knowledge/ConceptRelationshipMapper';
import IntelligentCrossReference from '@/components/knowledge/IntelligentCrossReference';
import LearningPathGenerator from '@/components/knowledge/LearningPathGenerator';
import ConceptDependencyAnalyzer from '@/components/knowledge/ConceptDependencyAnalyzer';

const KnowledgeHubPage = () => {
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);

  return (
    <div className="container mx-auto p-4">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-2">SystemVerilog & UVM Knowledge Hub</h1>
        <p className="text-xl text-gray-600">
          An intelligent ecosystem for mastering hardware verification.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="lg:col-span-2">
          <KnowledgeGraphVisualizer highlightedPath={highlightedPath} />
        </div>
        <div className="bg-white shadow-md rounded-lg p-6">
          <ConceptRelationshipMapper />
        </div>
        <div className="bg-white shadow-md rounded-lg p-6">
          <IntelligentCrossReference />
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

export default KnowledgeHubPage;
