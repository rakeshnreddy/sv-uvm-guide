/**
 * Site Monaco themes. Editors sit on the code surface (--code-surface in
 * globals.css, 226 40% 5%), which stays dark in both site modes (DESIGN.md
 * section 3), so both theme names resolve to the same dark palette: a caller
 * that still asks for the light theme gets the dark editor.
 *
 * Monaco's built-in `vs-dark` token colours (and its bracket-pair colours,
 * which the built-in SystemVerilog language applies to begin/end and
 * task/endtask) were tuned for #1e1e1e. Every token colour below, and every
 * inherited one, is at least 4.5:1 against the code surface, the current-line
 * highlight and the 10% primary tint used for step-highlighted lines
 * (tests/lib/monaco-themes.test.ts measures them).
 */

/** Minimal slice of the Monaco API this module needs (avoids importing monaco at runtime). */
export interface MonacoThemeApi {
  editor: {
    defineTheme: (
      name: string,
      data: {
        base: 'vs' | 'vs-dark';
        inherit: boolean;
        rules: { token: string; foreground?: string; fontStyle?: string }[];
        colors: Record<string, string>;
      },
    ) => void;
  };
}

export const SITE_MONACO_THEME = { light: 'sv-light', dark: 'sv-dark' } as const;

/** Editor surfaces, as hex because Monaco does not read CSS variables. */
export const MONACO_SURFACE = {
  /** hsl(226 40% 5%), the --code-surface role. */
  background: '#080a12',
  /** One step above the code surface: the current line and editor widgets. */
  raised: '#121725',
  /** Hairline around widgets. */
  border: '#2a3142',
  foreground: '#d4d4d4',
} as const;

/** Token overrides on top of vs-dark. Each comment gives the stock colour it replaces. */
export const SITE_MONACO_RULES: { token: string; foreground: string }[] = [
  { token: 'comment', foreground: '7fb069' }, // was 608b4e: 4.4:1 on the current line
  { token: 'keyword', foreground: '6cb6ff' }, // was 569cd6; kept brighter so keywords read first
  { token: 'variable.predefined', foreground: '79a7ff' }, // system tasks; was 4864aa: 3.0:1
  { token: 'regexp', foreground: 'c27aa3' }, // was b46695: 4.4:1 on the step tint
  { token: 'delimiter.html', foreground: '939393' }, // was 808080: 4.4:1 on the step tint
  { token: 'delimiter.xml', foreground: '939393' }, // was 808080
  { token: 'tag.id.pug', foreground: '79a7ff' }, // was 4f76ac
  { token: 'tag.class.pug', foreground: '79a7ff' }, // was 4f76ac
  { token: 'string.sql', foreground: 'ff6666' }, // was ff0000: 4.3:1 on the step tint
  { token: 'operator.sql', foreground: '8496a8' }, // was 778899
];

const bracketColors = (fg: string): Record<string, string> =>
  Object.fromEntries([
    ...[1, 2, 3, 4, 5, 6].map((n) => [`editorBracketHighlight.foreground${n}`, fg]),
    ['editorBracketHighlight.unexpectedBracket.foreground', fg],
  ]);

export const SITE_MONACO_COLORS: Record<string, string> = {
  'editor.background': MONACO_SURFACE.background,
  'editor.foreground': MONACO_SURFACE.foreground,
  'editorGutter.background': MONACO_SURFACE.background,
  'editor.lineHighlightBackground': MONACO_SURFACE.raised,
  'editor.lineHighlightBorder': MONACO_SURFACE.raised,
  'minimap.background': MONACO_SURFACE.background,
  'editorStickyScroll.background': MONACO_SURFACE.background,
  'editorWidget.background': MONACO_SURFACE.raised,
  'editorWidget.border': MONACO_SURFACE.border,
  'editorSuggestWidget.background': MONACO_SURFACE.raised,
  'editorSuggestWidget.border': MONACO_SURFACE.border,
  'editorSuggestWidget.selectedBackground': '#1d2436',
  'editorHoverWidget.background': MONACO_SURFACE.raised,
  'editorHoverWidget.border': MONACO_SURFACE.border,
  'peekViewEditor.background': MONACO_SURFACE.background,
  'peekViewResult.background': MONACO_SURFACE.raised,
  ...bracketColors('#d4d4d4'),
  'editorLineNumber.foreground': '#a3a3a3',
  'editorLineNumber.activeForeground': '#e5e5e5',
};

let defined = false;

export function defineSiteMonacoThemes(monaco: MonacoThemeApi): void {
  if (defined) return;
  for (const name of [SITE_MONACO_THEME.dark, SITE_MONACO_THEME.light]) {
    monaco.editor.defineTheme(name, {
      base: 'vs-dark',
      inherit: true,
      rules: SITE_MONACO_RULES,
      colors: SITE_MONACO_COLORS,
    });
  }
  defined = true;
}
