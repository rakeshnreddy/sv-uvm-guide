'use client';

import { useEffect, useLayoutEffect } from 'react';

import { ALL_LEVELS, LEVEL_FILTER_ATTRIBUTE, levelStatusText, readStoredLevel, writeStoredLevel } from './level-filter';
import { announce, applyLevel, collapseAll, expandAll, filterLevels, openQuestionFromHash } from './level-filter-dom';

/** The attribute on the expand and collapse buttons; its value names the action. */
export const DISCLOSURE_ACTION_ATTRIBUTE = 'data-interview-action';

export interface InterviewPageControllerProps {
  /** Question counts per level on this page, plus `all`, for the live region. */
  counts: Readonly<Record<string, number>>;
  /** Level value to label, for the live region. */
  labels: Readonly<Record<string, string>>;
  /** Question anchors that live on another page, to their page (the index keeps old deep links working). */
  elsewhere?: Readonly<Record<string, string>>;
}

/** useLayoutEffect in the browser (it runs before paint), useEffect on the server, where neither runs. */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Wires the server-rendered filter, the expand and collapse buttons and deep
 * links. It renders nothing and holds no question data: the questions are
 * server markup. On a full load the inline script applies the level before
 * first paint; after a client-side navigation (no inline script) the layout
 * effect below does, still before the browser paints the new page.
 */
export function InterviewPageController({ counts, labels, elsewhere }: InterviewPageControllerProps) {
  useBeforePaint(() => {
    applyLevel(document, readStoredLevel(storage(), filterLevels(document)));
  }, []);

  useEffect(() => {
    const doc = document;

    const say = (level: string) => announce(doc, levelStatusText(level, counts, labels));

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== 'radio' || !target.closest(`[${LEVEL_FILTER_ATTRIBUTE}]`)) return;
      const level = applyLevel(doc, target.value);
      writeStoredLevel(storage(), level);
      say(level);
    };

    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest(`[${DISCLOSURE_ACTION_ATTRIBUTE}]`) : null;
      if (!button) return;
      const action = button.getAttribute(DISCLOSURE_ACTION_ATTRIBUTE);
      if (action === 'expand') {
        const open = expandAll(doc);
        announce(doc, `${open} ${open === 1 ? 'question' : 'questions'} open.`);
      } else if (action === 'collapse') {
        collapseAll(doc);
        announce(doc, 'All questions closed.');
      }
    };

    const onHash = () => {
      const result = openQuestionFromHash(doc, window.location.hash, elsewhere);
      if (result.kind === 'redirect') {
        window.location.replace(result.href);
      } else if (result.kind === 'opened') {
        if (result.widened) say(ALL_LEVELS);
        result.element.scrollIntoView({ block: 'start' });
      }
    };

    onHash();
    doc.addEventListener('change', onChange);
    doc.addEventListener('click', onClick);
    window.addEventListener('hashchange', onHash);
    return () => {
      doc.removeEventListener('change', onChange);
      doc.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', onHash);
    };
  }, [counts, labels, elsewhere]);

  return null;
}

export default InterviewPageController;
