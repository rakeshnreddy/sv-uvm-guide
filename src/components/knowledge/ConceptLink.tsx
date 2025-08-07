'use client';

import React from 'react';
import { useKnowledgeContext } from '@/contexts/KnowledgeContext';

interface ConceptLinkProps {
  conceptId: string;
  children: React.ReactNode;
}

const ConceptLink = ({ conceptId, children }: ConceptLinkProps) => {
  const { setActiveConcept, getNodeById } = useKnowledgeContext();

  const handleClick = () => {
    const conceptNode = getNodeById(conceptId);
    if (conceptNode) {
      setActiveConcept(conceptNode);
    } else {
      console.warn(`ConceptLink: Node with id "${conceptId}" not found.`);
    }
  };

  return (
    <span
      onClick={handleClick}
      data-concept-id={conceptId}
      className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer border-b border-blue-400/50 hover:border-blue-300/80 transition-colors duration-200"
      title={`Learn more about ${String(children)}`}
    >
      {children}
    </span>
  );
};

export default ConceptLink;
