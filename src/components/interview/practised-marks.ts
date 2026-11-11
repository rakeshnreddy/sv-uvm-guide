/**
 * The "practised" mark on the interview pages: plain data, the CSS and the
 * one function that paints the stored marks onto the server markup. No
 * React, no DOM globals at import time.
 *
 * How it works without a flash (the same idea as level-filter.ts): the server
 * renders every question with its toggle, every count variant empty and the
 * "Hide practised" box unchecked. practisedBootScript, placed before the
 * questions, reads the marks stored in this browser and runs paintPractised
 * on the rows as the parser adds them (a MutationObserver, whose callbacks run
 * before the browser paints), then once more when the document is parsed.
 * The client controller runs the same function after hydration, after a
 * client-side navigation and on every change. No question data is sent for
 * this: the rows already carry their ids and levels.
 *
 * paintPractised is sent to the browser as its own source text (toString), so
 * it must stay self-contained: no imports, no outer variables, plain ES5.
 * The attribute names below are spelled out again inside it; the tests check
 * that the two agree.
 */
import { INTERVIEW_HIDE_PRACTISED_KEY, INTERVIEW_PRACTISED_KEY } from '@/lib/learner-store/keys';

import { assertSafeLevels, LEVEL_ATTRIBUTE, LEVEL_COUNT_ATTRIBUTE, LEVEL_GROUP_ATTRIBUTE, QUESTION_LEVEL_ATTRIBUTE } from './level-filter';

export { INTERVIEW_HIDE_PRACTISED_KEY, INTERVIEW_PRACTISED_KEY };

/** On a question's details element and its list item once the learner marked it. */
export const PRACTISED_ATTRIBUTE = 'data-practised';
/** The toggle button inside an opened question (aria-pressed). */
export const PRACTISED_TOGGLE_ATTRIBUTE = 'data-practised-toggle';
/** The "Practised" state in the collapsed row. */
export const PRACTISED_MARK_ATTRIBUTE = 'data-practised-mark';
/** The toggle's two labels; CSS shows the one for the row's state. */
export const PRACTISED_LABEL_OFF_ATTRIBUTE = 'data-practised-off';
export const PRACTISED_LABEL_ON_ATTRIBUTE = 'data-practised-on';
/** One count variant ("3 of 48 practised"), with its scope (a bank slug or `all`), level and total. */
export const PRACTISED_COUNT_ATTRIBUTE = 'data-practised-count';
export const PRACTISED_SCOPE_ATTRIBUTE = 'data-practised-scope';
export const QUESTION_TOTAL_ATTRIBUTE = 'data-question-total';
/** On a count variant with nothing to say (no marks): not displayed. */
export const PRACTISED_EMPTY_ATTRIBUTE = 'data-empty';
/** On <html>: the levels (and `all`) whose questions in this page's scope are all practised. */
export const PRACTISED_DONE_ATTRIBUTE = 'data-practised-done';
/** On <html> while "Hide practised" is on. */
export const HIDE_PRACTISED_ATTRIBUTE = 'data-interview-hide-practised';
/** The "Hide practised" checkbox. */
export const HIDE_PRACTISED_INPUT_ATTRIBUTE = 'data-practised-hide';
/**
 * A row marked during this visit while practised rows are hidden: it stays in
 * view until the box changes. Set on the row's list item, its level section
 * and <html>.
 */
export const PRACTISED_RECENT_ATTRIBUTE = 'data-practised-recent';
/** "Every question shown here is practised", with the button that shows them again. */
export const PRACTISED_ALL_HIDDEN_ATTRIBUTE = 'data-practised-all-hidden';
/** The button inside that note. */
export const SHOW_PRACTISED_ACTION_ATTRIBUTE = 'data-practised-show';

/** The scope of the index page's totals: every bank. */
export const ALL_BANKS = 'all';

/** "3 of 48 practised"; nothing when none is (no empty clutter beside the meta lines). */
export function practisedCountText(practised: number, total: number): string {
  if (practised <= 0 || total <= 0) return '';
  return `${Math.min(practised, total)} of ${total} practised`;
}

/** What the live region says after the learner sets or clears a mark. */
export function practisedStatusText(marked: boolean, practised: number, total: number): string {
  const lead = marked ? 'Marked as practised.' : 'Practised mark cleared.';
  if (total <= 0) return lead;
  return `${lead} ${Math.min(practised, total)} of ${total} practised.`;
}

/** Reads "Hide practised"; storage can be missing or throw. */
export function readHidePractised(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    return storage?.getItem(INTERVIEW_HIDE_PRACTISED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Stores "Hide practised" (off clears the key). Failures are ignored: it still works for this visit. */
export function writeHidePractised(storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined, hide: boolean): void {
  try {
    if (hide) storage?.setItem(INTERVIEW_HIDE_PRACTISED_KEY, '1');
    else storage?.removeItem(INTERVIEW_HIDE_PRACTISED_KEY);
  } catch {
    // Storage is optional.
  }
}

/** What paintPractised needs: the stored marks (question id → bank and level), the box and the page's scope. */
export interface PractisedPaintInput {
  marks: Readonly<Record<string, unknown>>;
  hide: boolean;
  /** The bank page's slug, or ALL_BANKS on the index. */
  scope: string;
  /** True once every row is in the document: marks for this bank that name no row are then not counted. */
  complete: boolean;
}

/** Practised counts by scope (bank slug and `all`), then level (and `all`). */
export type PractisedTally = Record<string, Record<string, number>>;

/**
 * Applies the marks to the page: each row's state and its toggle's
 * aria-pressed, the "Hide practised" box and <html> attribute, every count
 * variant and the <html> list of fully practised levels. Idempotent, and it
 * writes only what changes, so it can run on every parser mutation. Rows on
 * a bank page are the truth for that bank (their level, their presence);
 * other banks are counted from the stored marks. Returns the tally.
 *
 * Self-contained ES5: it is sent as source text in the pre-paint script.
 */
export function paintPractised(doc: Document, input: PractisedPaintInput): PractisedTally {
  var root = doc.documentElement;
  var scope = input.scope;
  var marks = input.marks || {};
  var has = Object.prototype.hasOwnProperty;
  var effective: Record<string, { bank: string; level: string }> = {};
  var id: string;
  var i: number;

  function setFlag(element: Element | null, name: string, on: boolean) {
    if (!element) return;
    if (on && !element.hasAttribute(name)) element.setAttribute(name, '');
    else if (!on && element.hasAttribute(name)) element.removeAttribute(name);
  }
  function setValue(element: Element, name: string, value: string | null) {
    if (value === null) {
      if (element.hasAttribute(name)) element.removeAttribute(name);
    } else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  // A mark the store would read: an object with a time, a bank and a level (the store's parse checks them fully).
  function valid(value: unknown): value is { at: number; bank: string; level: string } {
    var mark = value as { at?: unknown; bank?: unknown; level?: unknown } | null;
    return !!mark && typeof mark === 'object' && typeof mark.at === 'number' && typeof mark.bank === 'string' && typeof mark.level === 'string';
  }

  for (id in marks) {
    if (!has.call(marks, id)) continue;
    var stored = marks[id];
    if (valid(stored)) {
      if (input.complete && stored.bank === scope) continue;
      effective[id] = { bank: stored.bank, level: stored.level };
    }
  }

  var rows = doc.querySelectorAll('details[data-question-level]');
  for (i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var rowId = row.id.indexOf('q-') === 0 ? row.id.slice(2) : '';
    var on = !!rowId && has.call(marks, rowId) && valid(marks[rowId]);
    if (on) effective[rowId] = { bank: scope, level: row.getAttribute('data-question-level') || '' };
    else if (rowId) delete effective[rowId];
    setFlag(row, 'data-practised', on);
    setFlag(row.parentElement, 'data-practised', on);
    var toggle = row.querySelector('[data-practised-toggle]');
    if (toggle) setValue(toggle, 'aria-pressed', on ? 'true' : 'false');
  }

  setFlag(root, 'data-interview-hide-practised', !!input.hide);
  var boxes = doc.querySelectorAll('input[data-practised-hide]');
  for (i = 0; i < boxes.length; i += 1) {
    var box = boxes[i] as HTMLInputElement;
    // Set even when equal: it marks the box as changed, so hydration keeps it.
    box.checked = !!input.hide;
  }

  var tally: PractisedTally = { all: { all: 0 } };
  for (id in effective) {
    if (!has.call(effective, id)) continue;
    var mark = effective[id];
    if (!tally[mark.bank]) tally[mark.bank] = { all: 0 };
    tally[mark.bank].all += 1;
    tally[mark.bank][mark.level] = (tally[mark.bank][mark.level] || 0) + 1;
    tally.all.all += 1;
    tally.all[mark.level] = (tally.all[mark.level] || 0) + 1;
  }

  var done: string[] = [];
  var counts = doc.querySelectorAll('[data-practised-count]');
  for (i = 0; i < counts.length; i += 1) {
    var count = counts[i];
    var countScope = count.getAttribute('data-practised-scope') || '';
    var level = count.getAttribute('data-level-count') || 'all';
    var total = parseInt(count.getAttribute('data-question-total') || '0', 10) || 0;
    var practised = Math.min((tally[countScope] && tally[countScope][level]) || 0, total);
    var text = practised > 0 ? practised + ' of ' + total + ' practised' : '';
    if (count.textContent !== text) count.textContent = text;
    setFlag(count, 'data-empty', text === '');
    if (countScope === scope && total > 0 && practised >= total && done.indexOf(level) < 0) done.push(level);
  }
  setValue(root, 'data-practised-done', done.length ? done.join(' ') : null);
  return tally;
}

/**
 * A function's source with whole-line comments dropped and whitespace runs
 * collapsed, so the pre-paint script stays small whatever the server bundle
 * does. Safe for paintPractised: no string in it holds two spaces in a row
 * or a line break (the tests run the compacted script).
 */
export function compactSource(source: string): string {
  return source
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The check mark the rows and toggles draw: one symbol per page (PractisedSetup), used by reference. */
export const CHECK_SYMBOL_ID = 'practised-check';

/**
 * The pre-paint script: reads the stored marks and "Hide practised", then
 * paints them as the rows arrive and once the document is parsed. Put it
 * before anything it paints (the first child of the page).
 */
export function practisedBootScript(scope: string): string {
  assertSafeLevels(scope === ALL_BANKS ? [] : [scope]);
  return [
    '(function(){try{',
    'var m={},h=false,s;',
    `try{s=JSON.parse(localStorage.getItem(${JSON.stringify(INTERVIEW_PRACTISED_KEY)})||"null");if(s&&s.v===1&&s.data&&s.data.questions&&typeof s.data.questions==="object")m=s.data.questions}catch(e){}`,
    `try{h=localStorage.getItem(${JSON.stringify(INTERVIEW_HIDE_PRACTISED_KEY)})==="1"}catch(e){}`,
    `var p=${compactSource(paintPractised.toString())};`,
    `var i={marks:m,hide:h,scope:${JSON.stringify(scope)},complete:false},d=document;`,
    'var r=function(){try{p(d,i)}catch(e){}};r();',
    'if(d.readyState==="loading"&&typeof MutationObserver==="function"){var o=new MutationObserver(r);o.observe(d.documentElement,{childList:true,subtree:true});',
    'd.addEventListener("DOMContentLoaded",function(){o.disconnect();i.complete=true;r()})}',
    '}catch(e){}})();',
  ].join('');
}

/**
 * The CSS that shows the practised state from the attributes paintPractised
 * sets: the mark in the row, the toggle's label, empty count variants, and,
 * while "Hide practised" is on, practised rows, fully practised level
 * sections and the note that says everything shown is practised.
 */
export function practisedCss(levels: readonly string[]): string {
  assertSafeLevels(levels);
  const hide = `html[${HIDE_PRACTISED_ATTRIBUTE}]`;
  // A row kept in view carries the recent flag, and so do its level section and <html> (no :has(), for older engines).
  const notRecent = `:not([${PRACTISED_RECENT_ATTRIBUTE}])`;
  const done = (level: string) => `[${PRACTISED_DONE_ATTRIBUTE}~="${level}"]`;
  const rules = [
    `[${PRACTISED_MARK_ATTRIBUTE}],[${PRACTISED_LABEL_ON_ATTRIBUTE}],[${PRACTISED_ALL_HIDDEN_ATTRIBUTE}]{display:none}`,
    `details[${PRACTISED_ATTRIBUTE}] [${PRACTISED_MARK_ATTRIBUTE}],details[${PRACTISED_ATTRIBUTE}] [${PRACTISED_LABEL_ON_ATTRIBUTE}]{display:inline}`,
    `details[${PRACTISED_ATTRIBUTE}] [${PRACTISED_LABEL_OFF_ATTRIBUTE}]{display:none}`,
    `[${PRACTISED_COUNT_ATTRIBUTE}][${PRACTISED_EMPTY_ATTRIBUTE}]{display:none!important}`,
    `${hide} [data-question-rows]>li[${PRACTISED_ATTRIBUTE}]:not([${PRACTISED_RECENT_ATTRIBUTE}]){display:none}`,
    `${hide}:not([${LEVEL_ATTRIBUTE}])${done('all')}${notRecent} [${PRACTISED_ALL_HIDDEN_ATTRIBUTE}]{display:block}`,
  ];
  for (const level of levels) {
    rules.push(
      `${hide}${done(level)} [${LEVEL_GROUP_ATTRIBUTE}="${level}"]${notRecent}{display:none}`,
      `${hide}[${LEVEL_ATTRIBUTE}="${level}"]${done(level)}${notRecent} [${PRACTISED_ALL_HIDDEN_ATTRIBUTE}]{display:block}`,
    );
  }
  return rules.join('\n');
}

/** The level count attribute and the row attribute paintPractised reads, re-exported for the markup builders. */
export { LEVEL_COUNT_ATTRIBUTE, QUESTION_LEVEL_ATTRIBUTE };
