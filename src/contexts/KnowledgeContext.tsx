'use client';

import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { ConceptNode, KnowledgeGraphData, conceptGraph } from '@/lib/knowledge-graph-engine';

interface KnowledgeContextType {
  graphData: KnowledgeGraphData | null;
  activeConcept: ConceptNode | null;
  setActiveConcept: (concept: ConceptNode | null) => void;
  getNodeById: (id: string) => ConceptNode | undefined;
}

const KnowledgeContext = createContext<KnowledgeContextType | undefined>(undefined);

/**
 * Shares the concept graph (static, derived from the curriculum) and the
 * concept open in ConceptModal. The graph is available on the first render, so
 * a ConceptLink works as soon as it is on screen.
 */
export const KnowledgeContextProvider = ({ children }: { children: ReactNode }) => {
  const [activeConcept, setActiveConcept] = useState<ConceptNode | null>(null);
  const getNodeById = useCallback((id: string) => conceptGraph.byId.get(id), []);

  const value = useMemo(
    () => ({ graphData: conceptGraph, activeConcept, setActiveConcept, getNodeById }),
    [activeConcept, getNodeById],
  );

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
};

export const useKnowledgeContext = () => {
  const context = useContext(KnowledgeContext);
  if (context === undefined) {
    throw new Error('useKnowledgeContext must be used within a KnowledgeContextProvider');
  }
  return context;
};
