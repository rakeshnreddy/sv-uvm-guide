/**
 * One interview question as a native disclosure (details and summary), as an
 * HTML string (rich-text-html.ts says why a string). The summary row shows the
 * question, its level and its kind; opening it shows the code to read, the
 * model answer and everything else the bank holds. It works with scripts off.
 * The row's id is stable (q-<question id>) so a question can be linked to.
 */
import { questionAnchor, type InterviewQuestion } from '@/app/(learning)/interview-prep/interview-banks';
import { signalTagClass, signalTagTier } from '@/components/ui/SignalTag';
import type { LessonLink } from '@/lib/practice-links';
import { tierDataAttribute } from '@/lib/tier-colors';

import { QUESTION_LEVEL_ATTRIBUTE, REQUIRES_SCRIPT_ATTRIBUTE } from './level-filter';
import {
  CHECK_SYMBOL_ID,
  PRACTISED_LABEL_OFF_ATTRIBUTE,
  PRACTISED_LABEL_ON_ATTRIBUTE,
  PRACTISED_MARK_ATTRIBUTE,
  PRACTISED_TOGGLE_ATTRIBUTE,
} from './practised-marks';
import { escapeHtml, inlineTextHtml, richTextHtml, textListHtml } from './rich-text-html';

/** Wraps unfenced bank code in a fence, so it renders as one code block. */
export function codeAsRichText(code: string): string {
  return code.includes('```') ? code : `\`\`\`\n${code}\n\`\`\``;
}

function partHtml(title: string, body: string): string {
  return `<div data-part=""><h3>${escapeHtml(title)}</h3>${body}</div>`;
}

/** A module code as the signal tag (SignalTag's own classes and tier tint), for markup built as a string. */
export function signalTagHtml(code: string): string {
  const tier = tierDataAttribute(signalTagTier(code));
  const tierAttribute = tier ? ` data-tier="${tier}"` : '';
  return `<span class="${signalTagClass({ tinted: tier !== undefined })}"${tierAttribute} translate="no" data-signal-tag="">${escapeHtml(code)}</span>`;
}

/** "Learn it in": each lesson as one link, the module code as a signal tag, then the lesson title. */
export function questionLessonsHtml(lessons: readonly LessonLink[]): string {
  if (lessons.length === 0) return '';
  const items = lessons
    .map((lesson) => {
      const elective = lesson.track === 'elective' ? '<span class="text-muted-foreground"> (elective)</span>' : '';
      return `<li><a href="${escapeHtml(lesson.href)}" data-lesson-link="">${signalTagHtml(lesson.code)}<span>${escapeHtml(lesson.title)}${elective}</span></a></li>`;
    })
    .join('');
  return `<div data-lessons=""><h3>Learn it in</h3><ul>${items}</ul></div>`;
}

const CHEVRON =
  '<svg aria-hidden="true" viewBox="0 0 16 16" data-chevron=""><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

/** The check mark, by reference to the page's one symbol (PractisedSetup), so 48 rows do not repeat the path twice each. */
const CHECK = `<svg aria-hidden="true" data-check=""><use href="#${CHECK_SYMBOL_ID}"></use></svg>`;

/**
 * "Mark as practised" / "Practised": a toggle button (aria-pressed) at the end
 * of the opened question. The learner's click is the only thing that sets or
 * clears the mark. It needs scripts, so a noscript rule hides it.
 */
export function practisedToggleHtml(): string {
  return [
    `<div data-practised-tools="" ${REQUIRES_SCRIPT_ATTRIBUTE}="">`,
    `<button type="button" ${PRACTISED_TOGGLE_ATTRIBUTE}="" aria-pressed="false">`,
    `${CHECK}<span ${PRACTISED_LABEL_OFF_ATTRIBUTE}="">Mark as practised</span><span ${PRACTISED_LABEL_ON_ATTRIBUTE}="">Practised</span>`,
    '</button></div>',
  ].join('');
}

/** The row's "Practised" state: a check and the word, shown by the CSS once the question is marked. */
export const PRACTISED_MARK_HTML = `<span ${PRACTISED_MARK_ATTRIBUTE}=""><span aria-hidden="true"> · </span><span class="sr-only">, </span>${CHECK}Practised</span>`;

/** The answer panel: code, model answer, rubric, mistakes, follow-ups, lessons and sources, as the bank holds them, then the practised toggle. */
export function answerHtml(question: InterviewQuestion): string {
  return [
    question.code ? partHtml('Read this code first', richTextHtml(codeAsRichText(question.code))) : '',
    partHtml('Model answer', richTextHtml(question.modelAnswer)),
    question.rubric ? partHtml('What a strong answer covers', richTextHtml(question.rubric)) : '',
    question.commonMistakes.length > 0 ? partHtml('Common mistakes', textListHtml(question.commonMistakes)) : '',
    question.followUps.length > 0 ? partHtml('Follow-up questions', textListHtml(question.followUps)) : '',
    questionLessonsHtml(question.lessons),
    question.sources.length > 0 ? `<div data-sources=""><h3>Sources the bank cites</h3>${textListHtml(question.sources)}</div>` : '',
    practisedToggleHtml(),
  ].join('');
}

/** One question row: a details element with the level attribute the filter's CSS reads. */
export function questionRowHtml(question: InterviewQuestion): string {
  const kind = `${escapeHtml(question.levelLabel)}<span aria-hidden="true"> · </span><span class="sr-only">, </span>${escapeHtml(question.categoryLabel)}`;
  return [
    `<details id="${escapeHtml(questionAnchor(question.id))}" ${QUESTION_LEVEL_ATTRIBUTE}="${escapeHtml(question.level)}" class="scroll-mt-24">`,
    `<summary>${CHEVRON}<span class="min-w-0 flex-1"><span data-prompt="">${inlineTextHtml(question.prompt)}</span><span data-kind="">${kind}${PRACTISED_MARK_HTML}</span></span></summary>`,
    `<div data-answer="">${answerHtml(question)}</div>`,
    '</details>',
  ].join('');
}

/** A level's questions as one ordered list, rows divided by hairlines. */
export function questionListHtml(questions: readonly InterviewQuestion[]): string {
  return `<ol role="list" data-question-rows="">${questions.map((question) => `<li>${questionRowHtml(question)}</li>`).join('')}</ol>`;
}
