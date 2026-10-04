import React from 'react';
import { KnowledgeContextProvider } from '@/contexts/KnowledgeContext';
import ConceptModal from '@/components/knowledge/ConceptModal';

export default function CurriculumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No horizontal padding of its own: the learning layout's 16 px gutter is the
  // only one at 390 px. ConceptModal serves lessons that opt in to concept links.
  return (
    <KnowledgeContextProvider>
      <div className="relative">
        {children}
        <ConceptModal />
      </div>
    </KnowledgeContextProvider>
  );
}
