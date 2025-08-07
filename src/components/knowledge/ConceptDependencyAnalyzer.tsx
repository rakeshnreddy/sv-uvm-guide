'use client';

import React, { useState, useEffect } from 'react';
import { getFullKnowledgeGraph, analyzeDependencies, KnowledgeGraphData, DependencyAnalysis, ConceptNode } from '@/lib/knowledge-graph-engine';

const ConceptDependencyAnalyzer = () => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const [dependencies, setDependencies] = useState<DependencyAnalysis | null>(null);

  useEffect(() => {
    getFullKnowledgeGraph().then(data => {
      setGraphData(data);
      // Set a default concept to analyze
      if (data.nodes.length > 0) {
        const defaultConcept = 'uvm_intro';
        setSelectedConcept(defaultConcept);
        const analysis = analyzeDependencies(data, defaultConcept);
        setDependencies(analysis);
      }
    });
  }, []);

  const handleConceptChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const conceptId = event.target.value;
    setSelectedConcept(conceptId);
    if (graphData) {
      const analysis = analyzeDependencies(graphData, conceptId);
      setDependencies(analysis);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Concept Dependency Analyzer</h2>
      <div className="mb-4">
        <label htmlFor="concept-select" className="block text-sm font-medium text-gray-700 mb-1">
          Select a Concept to Analyze:
        </label>
        <select
          id="concept-select"
          value={selectedConcept}
          onChange={handleConceptChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          {graphData?.nodes.map(node => (
            <option key={node.id} value={node.id}>
              {node.name}
            </option>
          ))}
        </select>
      </div>

      {dependencies && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Prerequisites</h3>
            <ul className="list-disc list-inside bg-gray-50 p-3 rounded-md">
              {dependencies.prerequisites.length > 0 ? (
                dependencies.prerequisites.map(node => <li key={node.id}>{node.name}</li>)
              ) : (
                <li className="list-none text-gray-500">None</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Dependents</h3>
            <p className="text-xs text-gray-500 mb-1">(Concepts that require this one as a prerequisite)</p>
            <ul className="list-disc list-inside bg-gray-50 p-3 rounded-md">
              {dependencies.dependents.length > 0 ? (
                dependencies.dependents.map(node => <li key={node.id}>{node.name}</li>)
              ) : (
                <li className="list-none text-gray-500">None</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConceptDependencyAnalyzer;
