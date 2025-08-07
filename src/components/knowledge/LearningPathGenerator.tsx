'use client';

import React, { useState, useEffect } from 'react';
import {
  getFullKnowledgeGraph,
  generateLearningPath,
  KnowledgeGraphData,
  LearningPath,
  ConceptNode,
} from '@/lib/knowledge-graph-engine';

interface LearningPathGeneratorProps {
  onPathGenerated: (pathIds: string[]) => void;
}

const LearningPathGenerator = ({ onPathGenerated }: LearningPathGeneratorProps) => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [startConcept, setStartConcept] = useState<string>('');
  const [goalConcept, setGoalConcept] = useState<string>('');
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);

  useEffect(() => {
    getFullKnowledgeGraph().then(data => {
      setGraphData(data);
      if (data.nodes.length > 1) {
        setStartConcept('data_types');
        setGoalConcept('uvm_sequences');
      }
    });
  }, []);

  const handleGeneratePath = () => {
    if (graphData && startConcept && goalConcept) {
      const result = generateLearningPath(graphData, startConcept, goalConcept);
      setLearningPath(result);
      onPathGenerated(result.path.map(node => node.id));
    }
  };

  const ConceptSelector = ({ value, onChange, id, concepts }: { value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, id: string, concepts: ConceptNode[] }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {id === 'start-concept' ? 'Starting Point' : 'Learning Goal'}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
      >
        {concepts.map(node => (
          <option key={node.id} value={node.id}>{node.name}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Learning Path Generator</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {graphData && (
          <>
            <ConceptSelector id="start-concept" value={startConcept} onChange={e => setStartConcept(e.target.value)} concepts={graphData.nodes} />
            <ConceptSelector id="goal-concept" value={goalConcept} onChange={e => setGoalConcept(e.target.value)} concepts={graphData.nodes} />
          </>
        )}
      </div>
      <button
        onClick={handleGeneratePath}
        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Generate Learning Path
      </button>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Recommended Path:</h3>
        {learningPath && learningPath.path.length > 0 && (
          <ol className="list-decimal list-inside space-y-2 bg-gray-50 p-4 rounded-md">
            {learningPath.path.map(node => (
              <li key={node.id} className="text-gray-800">{node.name}</li>
            ))}
          </ol>
        )}
        {learningPath && learningPath.path.length === 0 && startConcept && goalConcept && (
          <p className="text-gray-500 bg-gray-50 p-4 rounded-md">
            No prerequisite path found from '{graphData?.nodes.find(n => n.id === startConcept)?.name}' to '{graphData?.nodes.find(n => n.id === goalConcept)?.name}'. Try different concepts.
          </p>
        )}
      </div>
    </div>
  );
};

export default LearningPathGenerator;
