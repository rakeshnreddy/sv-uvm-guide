import { describe, expect, it } from 'vitest';

import { loadInterviewBanks, toRichBlocks } from '@/app/(learning)/interview-prep/interview-banks';
import {
  CODE_TOKEN_ATTRIBUTE,
  codeTokenCss,
  codeTokenName,
  codeTokens,
  highlightedCodeHtml,
} from '@/components/interview/code-highlight-html';
import { codeAsRichText, questionRowHtml } from '@/components/interview/question-html';
import { codeBlockHtml } from '@/components/interview/rich-text-html';
import { codeSurfaceHljsStyle } from '@/lib/code-surface-hljs';

function parse(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

/** Every code block the bank pages show: the question's own code, and code in the model answer and rubric. */
function everyCodeBlock() {
  const blocks: { id: string; code: string; language: string }[] = [];
  for (const bank of loadInterviewBanks()) {
    for (const question of bank.levels.flatMap((group) => group.questions)) {
      const texts = [question.modelAnswer, question.rubric, question.code ? codeAsRichText(question.code) : ''];
      for (const text of texts) {
        for (const block of toRichBlocks(text)) {
          if (block.type === 'code') blocks.push({ id: question.id, code: block.code, language: block.language });
        }
      }
    }
  }
  return blocks;
}

describe('syntax colours in interview answers', () => {
  const blocks = everyCodeBlock();

  it('finds the code blocks of every bank', () => {
    expect(blocks.length).toBeGreaterThan(150);
    expect(blocks.filter((block) => block.language === 'systemverilog').length).toBeGreaterThan(100);
  });

  it('keeps every character of every code block: its text is the source, unchanged', () => {
    for (const block of blocks) {
      const code = parse(codeBlockHtml(block.code, block.language)).querySelector('pre > code')!;
      expect(code.textContent, `${block.id} (${block.language})`).toBe(block.code);
    }
  });

  it('colours SystemVerilog with the lesson code blocks’ tokens and leaves text, logs and tables plain', () => {
    const sv = blocks.find((block) => block.language === 'systemverilog' && /\bmodule\b/.test(block.code))!;
    const html = codeBlockHtml(sv.code, sv.language);
    const keyword = parse(html).querySelector(`[${CODE_TOKEN_ATTRIBUTE}="${codeTokenName('hljs-keyword')}"]`);
    expect(keyword?.textContent).toMatch(/^(module|logic|input|output|always_ff|always_comb|assign|endmodule|begin|end)$/);
    const text = blocks.find((block) => block.language === 'text')!;
    expect(parse(codeBlockHtml(text.code, text.language)).querySelector(`[${CODE_TOKEN_ATTRIBUTE}]`)).toBeNull();
    expect(codeTokens('x;', 'text')).toBeNull();
  });

  it('escapes the code and never lets it close an element', () => {
    const html = highlightedCodeHtml('if (a < b && c > d) $display("</pre><script>x</script>");', 'systemverilog');
    const host = parse(`<pre><code>${html}</code></pre>`);
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('code')!.textContent).toBe('if (a < b && c > d) $display("</pre><script>x</script>");');
  });

  it('has one rule per token code, with the colours of the lesson code blocks', () => {
    const css = codeTokenCss();
    expect(css).toContain(`[data-rich] pre code{color:${codeSurfaceHljsStyle.hljs.color}}`);
    for (const [key, style] of Object.entries(codeSurfaceHljsStyle)) {
      if (key === 'hljs') continue;
      const code = codeTokenName(key)!;
      expect(code, key).toMatch(/^[a-z]$/);
      if (style.color) expect(css, key).toContain(`[${CODE_TOKEN_ATTRIBUTE}=${code}]{color:${style.color}`);
    }
    // Comments and quotes share a colour, so they share one code.
    expect(codeTokenName('hljs-comment')).toBe(codeTokenName('hljs-quote'));
  });

  it('colours the code inside a question row too', () => {
    const [bank] = loadInterviewBanks();
    const question = bank.levels.flatMap((group) => group.questions).find((candidate) => /```systemverilog/.test(candidate.modelAnswer))!;
    expect(parse(questionRowHtml(question)).querySelector(`pre [${CODE_TOKEN_ATTRIBUTE}]`)).not.toBeNull();
  });
});
