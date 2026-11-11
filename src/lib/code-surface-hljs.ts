/**
 * highlight.js token colours for code blocks (src/lib/highlight-code.ts turns
 * highlight.js output into tokens keyed by this style; src/components/ui/CodeBlock.tsx
 * renders them). Code panels sit on the code surface
 * (--code-surface, 226 40% 5%, #080a12), which is dark in both site modes
 * (DESIGN.md section 3), so this style is fixed and does not follow the theme.
 * The token colours match the site Monaco theme (src/lib/monaco-themes.ts) so
 * a snippet looks the same in a code block and in the lab editor. Every colour
 * is at least 4.5:1 on the code surface (tests/components/CodeBlock.test.tsx).
 */

export const CODE_SURFACE_TEXT = {
  /** Default code text. */
  text: '#d4d4d4',
  /** Line numbers, file names and other secondary text on the code surface. */
  secondary: '#a3a3a3',
  keyword: '#6cb6ff',
  comment: '#7fb069',
  string: '#ce9178',
  number: '#b5cea8',
  type: '#3dc9b0',
  builtIn: '#79a7ff',
  meta: '#c586c0',
  title: '#dcdcaa',
  variable: '#9cdcfe',
  deletion: '#ff6b6b',
} as const;

const c = CODE_SURFACE_TEXT;

export const codeSurfaceHljsStyle: Record<string, Record<string, string>> = {
  hljs: {
    display: 'block',
    overflowX: 'auto',
    padding: '1em',
    color: c.text,
    background: 'transparent',
  },
  'hljs-comment': { color: c.comment, fontStyle: 'italic' },
  'hljs-quote': { color: c.comment, fontStyle: 'italic' },
  'hljs-keyword': { color: c.keyword },
  'hljs-selector-tag': { color: c.keyword },
  'hljs-literal': { color: c.keyword },
  'hljs-doctag': { color: c.keyword },
  'hljs-string': { color: c.string },
  'hljs-regexp': { color: c.string },
  'hljs-meta-string': { color: c.string },
  'hljs-number': { color: c.number },
  'hljs-type': { color: c.type },
  'hljs-class .hljs-title': { color: c.type },
  'hljs-built_in': { color: c.builtIn },
  'hljs-builtin-name': { color: c.builtIn },
  'hljs-meta': { color: c.meta },
  'hljs-title': { color: c.title },
  'hljs-section': { color: c.title },
  'hljs-function': { color: c.title },
  'hljs-attr': { color: c.variable },
  'hljs-attribute': { color: c.variable },
  'hljs-variable': { color: c.variable },
  'hljs-template-variable': { color: c.variable },
  'hljs-params': { color: c.text },
  'hljs-symbol': { color: c.number },
  'hljs-bullet': { color: c.number },
  'hljs-name': { color: c.keyword },
  'hljs-tag': { color: c.text },
  'hljs-addition': { color: c.comment },
  'hljs-deletion': { color: c.deletion },
  'hljs-emphasis': { fontStyle: 'italic' },
  'hljs-strong': { fontWeight: '600' },
};

/**
 * The style key for one highlight.js span class list ("hljs-keyword",
 * "hljs-title class_", "hljs-title function_"), or undefined when the style
 * has no rule for it, so the token takes its parent's colour.
 */
export function codeSurfaceStyleKey(className: string): string | undefined {
  const [base, ...modifiers] = className.trim().split(/\s+/);
  if (base === 'hljs-title' && modifiers.includes('class_')) return 'hljs-class .hljs-title';
  return base && base !== 'hljs' && base in codeSurfaceHljsStyle ? base : undefined;
}
