import React from 'react';
import { KnowledgeContextProvider } from '@/contexts/KnowledgeContext';
import ConceptModal from '@/components/knowledge/ConceptModal';

export default function CurriculumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <KnowledgeContextProvider>
      <div className="relative p-4 md:p-6">
        {children}
        <ConceptModal />
      </div>
    </KnowledgeContextProvider>
  );
}
