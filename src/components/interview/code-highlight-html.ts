/**
 * Syntax colours for the code blocks inside interview answers, as an HTML
 * string built when the bank page is prerendered (the pages stay static).
 *
 * Same highlighter and theme as the lesson code blocks: highlight.js with the
 * grammars registered in src/lib/highlight-code.ts, and the token colours of
 * src/lib/code-surface-hljs.ts. Lesson code blocks set each colour inline
 * (CodeBlock); here each token carries only a one-letter `data-t` code (one per
 * distinct colour and style) and one stylesheet, built from the same colour
 * table, colours them. A static page carries its markup three times (the HTML,
 * the RSC data inlined in it and the RSC payload of a client navigation), so
 * every byte per token counts: `<span data-t=k>` needs no quotes to escape.
 *
 * The code itself is never changed: the tokens' text, joined, is the source
 * character for character (highlightedCodeHtml falls back to plain text when it
 * would not be), and every piece goes through escapeHtml.
 */
import hljs from 'highlight.js/lib/core';

import { codeSurfaceHljsStyle } from '@/lib/code-surface-hljs';
import { parseHighlightedHtml, resolveCodeLanguage, type CodeToken } from '@/lib/highlight-code';

/** The attribute on each coloured token: <span data-t=a>. */
export const CODE_TOKEN_ATTRIBUTE = 'data-t';

/** The scope the token colours apply in: code blocks inside bank text (rich-text-html.ts). */
const CODE_TOKEN_SCOPE = '[data-rich] pre';

const styleSignature = (style: Readonly<Record<string, string>>) => JSON.stringify(Object.entries(style).sort());

/**
 * One code per distinct token style, in the colour table's order ("a", "b",
 * ...): "hljs-comment" and "hljs-quote" share one, as they share a colour.
 */
const TOKEN_CODES: ReadonlyMap<string, string> = (() => {
  const bySignature = new Map<string, string>();
  const codes = new Map<string, string>();
  for (const [key, style] of Object.entries(codeSurfaceHljsStyle)) {
    if (key === 'hljs') continue;
    const signature = styleSignature(style);
    if (!bySignature.has(signature)) bySignature.set(signature, (bySignature.size + 10).toString(36));
    codes.set(key, bySignature.get(signature)!);
  }
  return codes;
})();

/** The token code for a style key of codeSurfaceHljsStyle ("hljs-keyword" -> a letter), or undefined for none. */
export function codeTokenName(styleKey: string): string | undefined {
  return TOKEN_CODES.get(styleKey);
}

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => ESCAPES[character]);

/**
 * The tokens of `code` in `language`, or null when the language has no grammar
 * or the tokens would not rebuild the source exactly. Unlike highlightCode,
 * the source is not normalised: what the bank holds is what the page shows.
 */
export function codeTokens(code: string, language?: string | null): CodeToken[] | null {
  const { grammar } = resolveCodeLanguage(language);
  if (!grammar || !hljs.getLanguage(grammar)) return null;
  try {
    const tokens = parseHighlightedHtml(hljs.highlight(code, { language: grammar, ignoreIllegals: true }).value);
    return tokens.map((token) => token.text).join('') === code ? tokens : null;
  } catch {
    return null;
  }
}

/** The inside of a <code> element: coloured tokens when the language has a grammar, otherwise the escaped text. */
export function highlightedCodeHtml(code: string, language?: string | null): string {
  const tokens = codeTokens(code, language);
  if (!tokens) return escapeHtml(code);
  return tokens
    .map((token) => {
      const code = token.style ? codeTokenName(token.style) : undefined;
      return code ? `<span ${CODE_TOKEN_ATTRIBUTE}=${code}>${escapeHtml(token.text)}</span>` : escapeHtml(token.text);
    })
    .join('');
}

const cssProperty = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * One stylesheet for every token colour, from the lesson code blocks' colour
 * table (codeSurfaceHljsStyle). The code surface is dark in both modes, so the
 * colours do not change with the theme. Forced-colours mode overrides them.
 */
export function codeTokenCss(): string {
  const declarations = (style: Record<string, string>) =>
    Object.entries(style)
      .map(([property, value]) => `${cssProperty(property)}:${value}`)
      .join(';');
  // The default code text, as the lesson code blocks set it (the `hljs` entry's colour only: the rest is layout).
  const base = `${CODE_TOKEN_SCOPE} code{color:${codeSurfaceHljsStyle.hljs.color}}`;
  const rules = new Map<string, string>();
  for (const [key, style] of Object.entries(codeSurfaceHljsStyle)) {
    const code = codeTokenName(key);
    if (code && !rules.has(code)) rules.set(code, `${CODE_TOKEN_SCOPE} [${CODE_TOKEN_ATTRIBUTE}=${code}]{${declarations(style)}}`);
  }
  return base + [...rules.values()].join('');
}
