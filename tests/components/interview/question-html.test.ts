import { describe, expect, it } from 'vitest';

import { loadInterviewBanks, type InterviewQuestion } from '@/app/(learning)/interview-prep/interview-banks';
import { bankSummaryLine } from '@/components/interview/BankNav';
import { codeAsRichText, questionListHtml, questionRowHtml, signalTagHtml } from '@/components/interview/question-html';
import { QUESTION_LIST_CLASS, RICH_TEXT_SCOPE_CLASS } from '@/components/interview/question-styles';
import { codeBlockHtml, escapeHtml, inlineTextHtml, richTextHtml } from '@/components/interview/rich-text-html';

function parse(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

const QUESTION: InterviewQuestion = {
  id: 'x-1',
  level: 'mid',
  levelLabel: 'Mid-level',
  category: 'coding',
  categoryLabel: 'Coding',
  prompt: 'Why does `a <= b` <script>alert(1)</script> differ?',
  code: 'always_ff @(posedge clk) q <= d;',
  rubric: 'Names **both** regions.',
  modelAnswer: 'First.\n\n- one\n- two\n\n| A | B |\n|---|---|\n| `x` | 1 |',
  followUps: ['And `always_comb`?'],
  commonMistakes: ['Mixing "blocking" & nonblocking'],
  sources: ['IEEE 1800-2023 §10.4'],
  lessons: [],
};

describe('rich text as HTML', () => {
  it('escapes every piece of bank text', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    const row = parse(questionRowHtml(QUESTION));
    expect(row.querySelector('script')).toBeNull();
    expect(row.querySelector('[data-prompt]')?.textContent).toBe('Why does a <= b <script>alert(1)</script> differ?');
    expect(row.querySelector('[data-sources]')?.textContent).toContain('§10.4');
  });

  it('renders inline code, bold, lists, tables and code blocks with no classes of their own', () => {
    expect(inlineTextHtml('use `x` and **y**')).toBe('use <code>x</code> and <strong>y</strong>');
    const rich = parse(richTextHtml(QUESTION.modelAnswer));
    expect(rich.querySelectorAll('[data-rich] > p')).toHaveLength(1);
    expect(rich.querySelectorAll('li')).toHaveLength(2);
    expect(rich.querySelector('[data-table] table th')?.textContent).toBe('A');
    expect(rich.querySelectorAll('[class]')).toHaveLength(0);
    const pre = parse(codeBlockHtml('x = 1;', 'systemverilog')).querySelector('pre');
    expect(pre).toHaveAttribute('aria-label', 'SystemVerilog code example');
    expect(pre).toHaveAttribute('tabindex', '0');
    expect(codeAsRichText('x;')).toBe('```\nx;\n```');
    expect(codeAsRichText('```sv\nx;\n```')).toBe('```sv\nx;\n```');
  });
});

describe('question rows', () => {
  it('is a closed details element with a stable id, the level attribute and the level and kind in the summary', () => {
    const details = parse(questionRowHtml(QUESTION)).querySelector('details') as HTMLDetailsElement;
    expect(details.id).toBe('q-x-1');
    expect(details.open).toBe(false);
    expect(details).toHaveAttribute('data-question-level', 'mid');
    const kind = details.querySelector('summary [data-kind]') as HTMLElement;
    // The practised state sits at the end of the kind line; the CSS shows it only once the row is marked.
    const mark = kind.querySelector('[data-practised-mark]');
    expect(mark?.textContent).toBe(' · , Practised');
    mark?.remove();
    expect(kind.textContent).toBe('Mid-level · , Coding');
    const headings = Array.from(details.querySelectorAll('[data-answer] h3')).map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Read this code first',
      'Model answer',
      'What a strong answer covers',
      'Common mistakes',
      'Follow-up questions',
      'Sources the bank cites',
    ]);
  });

  it('links lessons with the signal tag, tinted by the module tier', () => {
    const [bank] = loadInterviewBanks();
    const question = bank.levels[0].questions[0];
    const row = parse(questionRowHtml(question));
    const links = Array.from(row.querySelectorAll('[data-lessons] a[data-lesson-link]'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(question.lessons.map((lesson) => lesson.href));
    const tag = links[0].querySelector('[data-signal-tag]');
    expect(tag?.textContent).toBe(question.lessons[0].code);
    expect(tag).toHaveAttribute('data-tier');
    expect(parse(signalTagHtml('M3')).querySelector('[data-signal-tag]')).not.toHaveAttribute('data-tier');
  });

  it('lists a level as one ordered list, one row per question', () => {
    const list = parse(questionListHtml([QUESTION, { ...QUESTION, id: 'x-2' }]));
    expect(list.querySelectorAll('ol[data-question-rows] > li > details')).toHaveLength(2);
  });

  it('keeps the scope classes free of interpolation, so Tailwind can find them', () => {
    expect(RICH_TEXT_SCOPE_CLASS).not.toMatch(/\$\{|undefined/);
    expect(QUESTION_LIST_CLASS.startsWith(RICH_TEXT_SCOPE_CLASS)).toBe(true);
    expect(QUESTION_LIST_CLASS).toContain('[&_summary]:flex');
  });
});

describe('bank summary line', () => {
  it('drops the opener the banks share and keeps the topics', () => {
    expect(bankSummaryLine('Interview preparation from junior to senior staff: data types and arrays.')).toBe('Data types and arrays.');
    expect(bankSummaryLine('Interview questions on UVM from junior to senior staff: objects and components.')).toBe('Objects and components.');
    expect(bankSummaryLine('Interview preparation from junior to senior staff covering APB and AXI.')).toBe('APB and AXI.');
    expect(bankSummaryLine('Interview preparation for simulation debug, from logs to triage.')).toBe('Simulation debug, from logs to triage.');
    expect(bankSummaryLine('A bank about buses.')).toBe('A bank about buses.');
  });
});
