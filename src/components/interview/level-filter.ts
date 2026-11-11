/**
 * The interview level filter (SPEC-phases-2-4.md, "Other pages"): plain data
 * and string builders shared by the server markup, the pre-paint script and
 * the client controller. No React, no DOM globals at import time.
 *
 * How it works without a flash: the server renders every question and every
 * count variant. A tiny inline script, run while the page is parsed, copies
 * the level stored in this browser onto <html data-interview-level>. A style
 * element built here hides what does not match, so the first paint already
 * shows the chosen level. The client controller only handles changes.
 */

/** The "All levels" value. No bank level may use it. */
export const ALL_LEVELS = 'all';

export const ALL_LEVELS_LABEL = 'All levels';

/** A UI convenience, not learner data (like the outline's collapsed state). */
export const LEVEL_STORAGE_KEY = 'sv-uvm:interview-level';

/** The attribute on <html> that holds the chosen level while the page is open. */
export const LEVEL_ATTRIBUTE = 'data-interview-level';

/** Marks a question row (a details element) with its level. */
export const QUESTION_LEVEL_ATTRIBUTE = 'data-question-level';

/** Marks a level section on a bank page. */
export const LEVEL_GROUP_ATTRIBUTE = 'data-level-group';

/** Marks one variant of a count ("48 questions", "16 junior questions"); `all` shows by default. */
export const LEVEL_COUNT_ATTRIBUTE = 'data-level-count';

/** The filter's fieldset. */
export const LEVEL_FILTER_ATTRIBUTE = 'data-level-filter';

/** The polite live region that announces the new count. */
export const LEVEL_STATUS_ATTRIBUTE = 'data-level-status';

/** Elements that only work with JavaScript (expand and collapse all); hidden by a noscript style otherwise. */
export const REQUIRES_SCRIPT_ATTRIBUTE = 'data-requires-script';

const SAFE_VALUE = /^[a-z0-9-]+$/;

/** Level values become CSS attribute selectors and script literals, so they must be plain slugs. */
export function assertSafeLevels(levels: readonly string[]): void {
  for (const level of levels) {
    if (!SAFE_VALUE.test(level) || level === ALL_LEVELS) {
      throw new Error(`Interview level "${level}" must be a lowercase slug other than "${ALL_LEVELS}"`);
    }
  }
}

/** The stored value if it names a known level, else "all". */
export function resolveLevel(stored: string | null | undefined, levels: readonly string[]): string {
  return stored && levels.includes(stored) ? stored : ALL_LEVELS;
}

/** Reads the stored level; storage can be missing or throw (private mode, blocked site data). */
export function readStoredLevel(storage: Pick<Storage, 'getItem'> | undefined, levels: readonly string[]): string {
  try {
    return resolveLevel(storage?.getItem(LEVEL_STORAGE_KEY), levels);
  } catch {
    return ALL_LEVELS;
  }
}

/** Stores the level ("all" clears it). Failures are ignored: the filter still works for this visit. */
export function writeStoredLevel(storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined, level: string): void {
  try {
    if (level === ALL_LEVELS) storage?.removeItem(LEVEL_STORAGE_KEY);
    else storage?.setItem(LEVEL_STORAGE_KEY, level);
  } catch {
    // Storage is optional.
  }
}

export function pluralQuestions(count: number): string {
  return count === 1 ? 'question' : 'questions';
}

/**
 * The count text for one level: "48 questions", "16 junior questions",
 * "1 senior staff question", "No staff questions".
 */
export function levelCountText(count: number, levelLabel?: string): string {
  const qualifier = levelLabel ? `${levelLabel.toLowerCase()} ` : '';
  if (count === 0) return `No ${qualifier}questions`;
  return `${count} ${qualifier}${pluralQuestions(count)}`;
}

/** What the live region says after a change: "Showing 16 junior questions." or "Showing all 48 questions." */
export function levelStatusText(level: string, counts: Readonly<Record<string, number>>, labels: Readonly<Record<string, string>>): string {
  if (level === ALL_LEVELS) {
    const total = counts[ALL_LEVELS] ?? 0;
    return `Showing all ${total} ${pluralQuestions(total)}.`;
  }
  const count = counts[level] ?? 0;
  return count === 0 ? `${levelCountText(0, labels[level])}.` : `Showing ${levelCountText(count, labels[level])}.`;
}

/**
 * The CSS that applies the filter from the <html> attribute: count variants,
 * question rows and level sections that do not match are not displayed.
 */
export function levelFilterCss(levels: readonly string[]): string {
  assertSafeLevels(levels);
  const html = (level: string) => `html[${LEVEL_ATTRIBUTE}="${level}"]`;
  const rules = [`[${LEVEL_COUNT_ATTRIBUTE}]:not([${LEVEL_COUNT_ATTRIBUTE}="${ALL_LEVELS}"]){display:none}`];
  for (const level of levels) {
    rules.push(
      `${html(level)} [${LEVEL_COUNT_ATTRIBUTE}="${ALL_LEVELS}"]{display:none}`,
      `${html(level)} [${LEVEL_COUNT_ATTRIBUTE}="${level}"]{display:inline}`,
      `${html(level)} [${QUESTION_LEVEL_ATTRIBUTE}]:not([${QUESTION_LEVEL_ATTRIBUTE}="${level}"]){display:none}`,
      `${html(level)} [${LEVEL_GROUP_ATTRIBUTE}]:not([${LEVEL_GROUP_ATTRIBUTE}="${level}"]){display:none}`,
    );
  }
  return rules.join('\n');
}

/**
 * The pre-paint script: put the level stored in this browser on <html>. It
 * runs where it is placed, so it goes before anything level-aware.
 */
export function levelBootScript(levels: readonly string[]): string {
  assertSafeLevels(levels);
  return [
    '(function(){try{',
    `var l=${JSON.stringify(levels)},v=null;`,
    `try{v=localStorage.getItem(${JSON.stringify(LEVEL_STORAGE_KEY)})}catch(e){}`,
    'var d=document.documentElement;',
    `if(l.indexOf(v)<0)d.removeAttribute(${JSON.stringify(LEVEL_ATTRIBUTE)});else d.setAttribute(${JSON.stringify(LEVEL_ATTRIBUTE)},v);`,
    '}catch(e){}})();',
  ].join('');
}

/**
 * Checks the radio for the level on <html>; placed right after the radios.
 * Every radio's checked state is set (not only the chosen one), which marks
 * them all as changed, so hydration cannot put the server's default back.
 */
export function levelRadioSyncScript(levels: readonly string[]): string {
  assertSafeLevels(levels);
  return [
    '(function(){try{',
    `var l=${JSON.stringify(levels)},v=document.documentElement.getAttribute(${JSON.stringify(LEVEL_ATTRIBUTE)});`,
    `if(l.indexOf(v)<0)v=${JSON.stringify(ALL_LEVELS)};`,
    `var r=document.querySelectorAll('[${LEVEL_FILTER_ATTRIBUTE}] input[type=radio]');`,
    'for(var i=0;i<r.length;i++)r[i].checked=r[i].value===v;',
    '}catch(e){}})();',
  ].join('');
}

/** Hides the script-only controls when scripts are off (inside a noscript element). */
export const NOSCRIPT_CSS = `[${REQUIRES_SCRIPT_ATTRIBUTE}]{display:none!important}`;
