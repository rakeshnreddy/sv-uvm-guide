'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { ConceptNode, KnowledgeGraphData, getFullKnowledgeGraph } from '@/lib/knowledge-graph-engine';

interface KnowledgeContextType {
  graphData: KnowledgeGraphData | null;
  activeConcept: ConceptNode | null;
  setActiveConcept: (concept: ConceptNode | null) => void;
  getNodeById: (id: string) => ConceptNode | undefined;
}

const KnowledgeContext = createContext<KnowledgeContextType | undefined>(undefined);

export const KnowledgeContextProvider = ({ children }: { children: ReactNode }) => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [activeConcept, setActiveConcept] = useState<ConceptNode | null>(null);

  useEffect(() => {
    getFullKnowledgeGraph().then(setGraphData);
  }, []);

  const getNodeById = (id: string): ConceptNode | undefined => {
    return graphData?.nodes.find(node => node.id === id);
  };

  const value = {
    graphData,
    activeConcept,
    setActiveConcept,
    getNodeById,
  };

  return (
    <KnowledgeContext.Provider value={value}>
      {children}
    </KnowledgeContext.Provider>
  );
};

export const useKnowledgeContext = () => {
  const context = useContext(KnowledgeContext);
  if (context === undefined) {
    throw new Error('useKnowledgeContext must be used within a KnowledgeContextProvider');
  }
  return context;
};
