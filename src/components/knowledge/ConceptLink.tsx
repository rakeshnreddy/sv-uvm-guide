'use client';

import React from 'react';
import { useKnowledgeContext } from '@/contexts/KnowledgeContext';

interface ConceptLinkProps {
  conceptId: string;
  children: React.ReactNode;
}

/**
 * Inline concept reference injected into lesson prose by remark-concept-links.
 * Rendered as a real button so keyboard and screen-reader users can open the
 * concept dialog; styled to read as part of the sentence.
 */
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
    <button
      type="button"
      onClick={handleClick}
      data-concept-id={conceptId}
      aria-haspopup="dialog"
      className="inline cursor-pointer border-0 border-b border-dotted border-primary/60 bg-transparent p-0 font-[inherit] font-semibold text-primary transition-colors duration-200 hover:border-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      title={`Learn more about ${String(children)}`}
    >
      {children}
    </button>
  );
};

export default ConceptLink;
