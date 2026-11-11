/**
 * Bank text (the small Markdown subset parsed in interview-banks.ts) as an
 * HTML string, for the bank pages' question lists.
 *
 * Why a string and not React elements: a statically rendered page sends its
 * content twice, once as HTML and once in the RSC payload. As React elements,
 * the 48 SystemVerilog questions were about 7,000 elements, and the element
 * tree in the payload weighed about three times the text it carried. As one
 * string per level, the payload holds the markup once, about the size of the
 * HTML. Every piece of bank text goes through escapeHtml.
 *
 * The elements carry no classes: RICH_TEXT_SCOPE_CLASS (question-styles.ts),
 * set once on the element around the list, styles them.
 */
import { splitInlineCode, toRichBlocks, type InlinePart, type RichBlock } from '@/app/(learning)/interview-prep/interview-banks';

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for an element body or a double-quoted attribute value. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  systemverilog: 'SystemVerilog',
  sv: 'SystemVerilog',
  verilog: 'Verilog',
  python: 'Python',
  c: 'C',
  cpp: 'C++',
};

export function languageName(language: string): string {
  return LANGUAGE_NAMES[language.toLowerCase()] ?? language;
}

/** Inline code, bold and plain text. */
export function inlineHtml(parts: readonly InlinePart[]): string {
  return parts
    .map((part) => {
      const text = escapeHtml(part.text);
      const inner = part.code ? `<code>${text}</code>` : text;
      return part.bold ? `<strong>${inner}</strong>` : inner;
    })
    .join('');
}

/** Inline markup for one string of bank text. */
export function inlineTextHtml(text: string): string {
  return inlineHtml(splitInlineCode(text));
}

/** A code block: it scrolls sideways inside itself, so it is a named, focusable region. */
export function codeBlockHtml(code: string, language = 'text'): string {
  const label = language === 'text' ? 'Code example' : `${languageName(language)} code example`;
  return `<pre tabindex="0" role="region" data-scroll="" aria-label="${escapeHtml(label)}"><code>${escapeHtml(code)}</code></pre>`;
}

function blockHtml(block: RichBlock): string {
  switch (block.type) {
    case 'code':
      return codeBlockHtml(block.code, block.language);
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      return `<${tag}>${block.items.map((item) => `<li>${inlineHtml(item)}</li>`).join('')}</${tag}>`;
    }
    case 'table': {
      const head = block.header.map((cell) => `<th scope="col">${inlineHtml(cell)}</th>`).join('');
      const rows = block.rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineHtml(cell)}</td>`).join('')}</tr>`).join('');
      return `<div tabindex="0" role="region" aria-label="Table" data-scroll="" data-table=""><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    default:
      return `<p>${inlineHtml(block.parts)}</p>`;
  }
}

/** Paragraphs, lists, tables and code blocks, in a data-rich block. */
export function richTextHtml(text: string): string {
  return `<div data-rich="">${toRichBlocks(text).map(blockHtml).join('')}</div>`;
}

/** A bullet list of short bank strings (follow-ups, common mistakes, sources), in a data-rich block. */
export function textListHtml(items: readonly string[]): string {
  return `<div data-rich=""><ul>${items.map((item) => `<li>${inlineTextHtml(item)}</li>`).join('')}</ul></div>`;
}
