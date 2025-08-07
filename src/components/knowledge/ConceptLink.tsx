'use client';

import React from 'react';

interface ConceptLinkProps {
  conceptId: string;
  children: React.ReactNode;
}

const ConceptLink = ({ conceptId, children }: ConceptLinkProps) => {
  const handleClick = () => {
    // In the future, this could open a modal or a side panel
    // with a "just-in-time" explanation of the concept.
    console.log(`Clicked concept: ${conceptId}`);
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
