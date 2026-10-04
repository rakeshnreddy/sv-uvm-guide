'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useKnowledgeContext } from '@/contexts/KnowledgeContext';
import { KnowledgeGraphData, getFullKnowledgeGraph, analyzeDependencies, DependencyAnalysis } from '@/lib/knowledge-graph-engine';

const ConceptModal = () => {
  const { activeConcept, setActiveConcept } = useKnowledgeContext();
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [dependencies, setDependencies] = useState<DependencyAnalysis | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

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

  // Move focus into the dialog when it opens, close on Escape, and return
  // focus to the concept link that opened it.
  useEffect(() => {
    if (!activeConcept) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setActiveConcept(null);
      } else if (event.key === 'Tab') {
        // Single focusable control: keep focus inside the dialog.
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [activeConcept, setActiveConcept]);

  if (!activeConcept) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => setActiveConcept(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="mx-4 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-6 text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl font-bold text-primary">{activeConcept.name}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setActiveConcept(null)}
            aria-label="Close concept details"
            className="rounded-md px-2 text-2xl leading-none text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <p id={descriptionId} className="mb-4 text-muted-foreground">{activeConcept.description}</p>

        {dependencies && dependencies.prerequisites.length > 0 && (
          <div>
            <h3 className="mb-2 text-lg font-semibold">Prerequisites</h3>
            <ul className="list-inside list-disc rounded-md bg-muted/50 p-3">
              {dependencies.prerequisites.map(node => <li key={node.id}>{node.name}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConceptModal;
