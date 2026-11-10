'use client';

import React, { useEffect, useId, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useKnowledgeContext } from '@/contexts/KnowledgeContext';
import { analyzeDependencies, conceptGraph, type ConceptNode } from '@/lib/knowledge-graph-engine';

const KIND_LABEL: Record<NonNullable<ConceptNode['kind']>, string> = {
  module: 'Module',
  lesson: 'Lesson',
  term: 'Key term',
};

const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * The concept dialog opened by ConceptLink (lessons with `conceptLinking: true`)
 * and by the key-term buttons on /knowledge-hub. It shows the concept's tier,
 * the lessons that teach it, the modules to study first and related terms, all
 * from the concept graph derived from the curriculum.
 */
const ConceptModal = () => {
  const { activeConcept, setActiveConcept } = useKnowledgeContext();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isOpen = activeConcept !== null;

  const dependencies = useMemo(
    () => (activeConcept ? analyzeDependencies(conceptGraph, activeConcept.id) : null),
    [activeConcept],
  );

  // Remember what opened the dialog, return focus to it on close.
  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const target = returnFocusRef.current;
      if (target && target.isConnected) target.focus();
    };
  }, [isOpen]);

  // Lock page scroll behind the overlay while the dialog is open.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Focus the close button whenever the dialog opens or shows another concept.
  useEffect(() => {
    if (activeConcept) closeRef.current?.focus();
  }, [activeConcept]);

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setActiveConcept(null);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = dialogRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setActiveConcept]);

  if (!activeConcept) {
    return null;
  }

  const kind = activeConcept.kind ?? 'term';
  const lessons = activeConcept.lessons ?? [];
  const close = () => setActiveConcept(null);
  const lessonHeading = kind === 'module' ? 'Lessons' : kind === 'lesson' ? 'Open the lesson' : 'Taught in';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-5 text-card-foreground shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {KIND_LABEL[kind]} · {activeConcept.tier}
              {kind === 'term' && activeConcept.code ? ` · first taught in ${activeConcept.code}` : ''}
            </p>
            <h2 id={titleId} className="mt-1 break-words text-2xl font-bold text-primary">
              {activeConcept.name}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close concept details"
            className="min-h-10 min-w-10 rounded-md px-2 text-2xl leading-none text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <p id={descriptionId} className="mb-4 text-muted-foreground">
          {activeConcept.description}
        </p>

        {lessons.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-2 text-base font-semibold">{lessonHeading}</h3>
            <ul className="space-y-1">
              {lessons.map((lesson) => (
                <li key={lesson.key}>
                  <Link href={lesson.href} onClick={close} className="text-primary underline underline-offset-2 hover:no-underline">
                    {lesson.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {dependencies && dependencies.prerequisites.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-2 text-base font-semibold">Study first</h3>
            <ul className="space-y-1">
              {dependencies.prerequisites.map((node) => (
                <li key={node.id}>
                  {node.href ? (
                    <Link href={node.href} onClick={close} className="text-primary underline underline-offset-2 hover:no-underline">
                      {node.name}
                    </Link>
                  ) : (
                    node.name
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {dependencies && dependencies.related.length > 0 && (
          <section>
            <h3 className="mb-2 text-base font-semibold">{kind === 'term' ? 'Related terms' : 'Key terms taught here'}</h3>
            <ul className="flex flex-wrap gap-2">
              {dependencies.related.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => setActiveConcept(node)}
                    className="min-h-10 rounded-full border border-border px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {node.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};

export default ConceptModal;
