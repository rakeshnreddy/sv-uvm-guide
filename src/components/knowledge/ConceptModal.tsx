'use client';

import React, { useEffect, useState } from 'react';
import { useKnowledgeContext } from '@/contexts/KnowledgeContext';
import { KnowledgeGraphData, getFullKnowledgeGraph, analyzeDependencies, DependencyAnalysis } from '@/lib/knowledge-graph-engine';

const ConceptModal = () => {
  const { activeConcept, setActiveConcept } = useKnowledgeContext();
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [dependencies, setDependencies] = useState<DependencyAnalysis | null>(null);

  useEffect(() => {
    getFullKnowledgeGraph().then(setGraphData);
  }, []);

  useEffect(() => {
    if (activeConcept && graphData) {
      const analysis = analyzeDependencies(graphData, activeConcept.id);
      setDependencies(analysis);
    } else {
      setDependencies(null);
    }
  }, [activeConcept, graphData]);

  if (!activeConcept) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center"
      onClick={() => setActiveConcept(null)}
    >
      <div
        className="bg-gray-800 text-white rounded-lg shadow-2xl p-6 w-full max-w-2xl mx-4 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-primary">{activeConcept.name}</h2>
          <button
            onClick={() => setActiveConcept(null)}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        <p className="text-gray-300 mb-4">{activeConcept.description}</p>

        {dependencies && dependencies.prerequisites.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Prerequisites:</h3>
            <ul className="list-disc list-inside bg-gray-700/50 p-3 rounded-md">
              {dependencies.prerequisites.map(node => <li key={node.id}>{node.name}</li>)}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
};

export default ConceptModal;
