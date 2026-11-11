'use client';

import { useEffect, useLayoutEffect } from 'react';

import { LEARNER_DATA_CHANGED_EVENT } from '@/lib/learner-store/keys';
import { writeOutcomeMessage } from '@/lib/learner-store/record';
import { interviewPractisedRecord, setQuestionPractised } from '@/lib/learner-store/repositories/interview';

import { ALL_LEVELS, LEVEL_GROUP_ATTRIBUTE, QUESTION_LEVEL_ATTRIBUTE } from './level-filter';
import { announce, currentLevel, idFromHash } from './level-filter-dom';
import {
  HIDE_PRACTISED_INPUT_ATTRIBUTE,
  PRACTISED_ATTRIBUTE,
  PRACTISED_COUNT_ATTRIBUTE,
  PRACTISED_RECENT_ATTRIBUTE,
  PRACTISED_SCOPE_ATTRIBUTE,
  PRACTISED_TOGGLE_ATTRIBUTE,
  QUESTION_TOTAL_ATTRIBUTE,
  SHOW_PRACTISED_ACTION_ATTRIBUTE,
  paintPractised,
  practisedStatusText,
  readHidePractised,
  writeHidePractised,
  type PractisedTally,
} from './practised-marks';

/** useLayoutEffect in the browser (it runs before paint), useEffect on the server, where neither runs. */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Paints this browser's marks and "Hide practised" onto the page (practised-marks.ts). */
export function paintStoredPractised(doc: Document, scope: string): PractisedTally {
  return paintPractised(doc, {
    marks: interviewPractisedRecord.read().questions,
    hide: readHidePractised(storage()),
    scope,
    complete: true,
  });
}

/** The question id of a row (its id without the q- prefix). */
function questionIdOf(row: Element): string | null {
  return row.id.startsWith('q-') && row.id.length > 2 ? row.id.slice(2) : null;
}

/** Practised and total questions on view: this page's scope at the chosen level. */
function onView(doc: Document, scope: string, tally: PractisedTally): { practised: number; total: number } {
  const level = currentLevel(doc);
  const variant = Array.from(doc.querySelectorAll(`[${PRACTISED_COUNT_ATTRIBUTE}]`)).find(
    (element) => element.getAttribute(PRACTISED_SCOPE_ATTRIBUTE) === scope && element.getAttribute('data-level-count') === level,
  );
  return {
    practised: tally[scope]?.[level] ?? 0,
    total: Number(variant?.getAttribute(QUESTION_TOTAL_ATTRIBUTE) ?? 0) || 0,
  };
}

/** Lets every row back under "Hide practised" (after the box changes). */
function clearRecent(doc: Document): void {
  doc.querySelectorAll(`[${PRACTISED_RECENT_ATTRIBUTE}]`).forEach((element) => element.removeAttribute(PRACTISED_RECENT_ATTRIBUTE));
}

/** Keeps a practised row, its level section and the "all hidden" note's page in view while practised rows are hidden. */
function keepInView(row: Element): void {
  row.parentElement?.setAttribute(PRACTISED_RECENT_ATTRIBUTE, '');
  row.closest(`[${LEVEL_GROUP_ATTRIBUTE}]`)?.setAttribute(PRACTISED_RECENT_ATTRIBUTE, '');
  row.ownerDocument.documentElement.setAttribute(PRACTISED_RECENT_ATTRIBUTE, '');
}

export interface PractisedControllerProps {
  /** The bank page's slug, or ALL_BANKS on the index. */
  scope: string;
}

/**
 * Wires the practised marks: the toggle inside each opened question (the only
 * thing that sets or clears a mark), "Hide practised" and its way back, and a
 * repaint when the marks change in another tab or through an import or reset.
 * It renders nothing and holds no question data.
 */
export function PractisedController({ scope }: PractisedControllerProps) {
  useBeforePaint(() => {
    paintStoredPractised(document, scope);
  }, [scope]);

  useEffect(() => {
    const doc = document;
    const repaint = () => paintStoredPractised(doc, scope);

    const setHide = (hide: boolean): PractisedTally => {
      writeHidePractised(storage(), hide);
      clearRecent(doc);
      return repaint();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const toggle = target?.closest(`[${PRACTISED_TOGGLE_ATTRIBUTE}]`);
      if (toggle) {
        const row = toggle.closest(`details[${QUESTION_LEVEL_ATTRIBUTE}]`);
        const id = row ? questionIdOf(row) : null;
        if (!row || !id) return;
        const marked = !row.hasAttribute(PRACTISED_ATTRIBUTE);
        const outcome = setQuestionPractised(
          id,
          marked ? { bank: scope, level: row.getAttribute(QUESTION_LEVEL_ATTRIBUTE) ?? ALL_LEVELS } : null,
        );
        const problem = writeOutcomeMessage(outcome);
        if (outcome === 'too-large' || outcome === 'blocked-newer-version' || outcome === 'blocked-corrupt') {
          announce(doc, problem ?? 'The mark could not be saved.');
          return;
        }
        // Marked while practised rows are hidden: it stays where the learner is until the box changes.
        if (marked) keepInView(row);
        const { practised, total } = onView(doc, scope, repaint());
        announce(doc, practisedStatusText(marked, practised, total));
        return;
      }
      if (target?.closest(`[${SHOW_PRACTISED_ACTION_ATTRIBUTE}]`)) {
        setHide(false);
        doc.querySelector<HTMLInputElement>(`input[${HIDE_PRACTISED_INPUT_ATTRIBUTE}]`)?.focus();
        announce(doc, 'Showing practised questions.');
      }
    };

    const onChange = (event: Event) => {
      const box = event.target;
      if (!(box instanceof HTMLInputElement) || !box.hasAttribute(HIDE_PRACTISED_INPUT_ATTRIBUTE)) return;
      const { practised, total } = onView(doc, scope, setHide(box.checked));
      announce(doc, box.checked ? `Practised questions hidden. ${Math.max(total - practised, 0)} left to practise.` : 'Showing practised questions.');
    };

    /** A link to a practised question shows it even while practised rows are hidden. */
    const onHash = () => {
      const id = idFromHash(window.location.hash);
      const row = id ? doc.getElementById(id) : null;
      if (row instanceof HTMLDetailsElement && row.hasAttribute(PRACTISED_ATTRIBUTE)) keepInView(row);
    };

    onHash();
    const unsubscribe = interviewPractisedRecord.subscribe(repaint);
    doc.addEventListener('click', onClick);
    doc.addEventListener('change', onChange);
    window.addEventListener('hashchange', onHash);
    window.addEventListener(LEARNER_DATA_CHANGED_EVENT, repaint);
    return () => {
      unsubscribe();
      doc.removeEventListener('click', onClick);
      doc.removeEventListener('change', onChange);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener(LEARNER_DATA_CHANGED_EVENT, repaint);
    };
  }, [scope]);

  return null;
}

export default PractisedController;
