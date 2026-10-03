/**
 * Site Monaco themes. Monaco's built-in `vs` / `vs-dark` token colours (and
 * its bracket-pair colours, which the built-in SystemVerilog language applies
 * to begin/end and task/endtask) fall below WCAG AA 4.5:1 on the editor
 * background and on the step-highlighted line. These themes keep the stock
 * palettes but raise the failing colours. Ratios were computed against the
 * plain background and against the 10% primary tint used for highlighted lines.
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

const bracketColors = (fg: string): Record<string, string> =>
  Object.fromEntries([
    ...[1, 2, 3, 4, 5, 6].map((n) => [`editorBracketHighlight.foreground${n}`, fg]),
    ['editorBracketHighlight.unexpectedBracket.foreground', fg],
  ]);

let defined = false;

export function defineSiteMonacoThemes(monaco: MonacoThemeApi): void {
  if (defined) return;
  monaco.editor.defineTheme(SITE_MONACO_THEME.light, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '166534' }, // was 008000: 3.9:1 on the highlighted line
      { token: 'number', foreground: '047857' }, // was 098658: 3.4:1 on the highlighted line
    ],
    colors: {
      ...bracketColors('#1f2937'),
      'editorLineNumber.foreground': '#4b5563',
      'editorLineNumber.activeForeground': '#111827',
    },
  });
  monaco.editor.defineTheme(SITE_MONACO_THEME.dark, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7fb069' }, // was 608b4e: 4.2:1
      { token: 'keyword', foreground: '6cb6ff' }, // was 569cd6: 4.4:1 on the highlighted line
      { token: 'variable.predefined', foreground: '79a7ff' }, // system tasks; was 4864aa: 2.9:1
    ],
    colors: {
      ...bracketColors('#d4d4d4'),
      'editorLineNumber.foreground': '#a3a3a3',
      'editorLineNumber.activeForeground': '#e5e5e5',
    },
  });
  defined = true;
}
