/**
 * Syntax highlighting for code blocks, run where the block renders: on the
 * server for lesson pages, which are prerendered, so the HTML already carries
 * the colours and nothing changes when the page hydrates. It is synchronous and
 * has no browser dependencies, so a client component can use it too.
 *
 * highlight.js returns HTML with nested `hljs-*` spans. `highlightCode` turns
 * that into plain data: one array of tokens per source line, each token tagged
 * with the style key from `codeSurfaceHljsStyle`, so the renderer can split
 * multi-line comments and strings at line breaks.
 */
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import makefile from "highlight.js/lib/languages/makefile";
import python from "highlight.js/lib/languages/python";
import tcl from "highlight.js/lib/languages/tcl";
import typescript from "highlight.js/lib/languages/typescript";
import verilog from "highlight.js/lib/languages/verilog";
import yaml from "highlight.js/lib/languages/yaml";

import { codeSurfaceStyleKey } from "@/lib/code-surface-hljs";

const GRAMMARS = { bash, c, cpp, diff, javascript, json, makefile, python, tcl, typescript, verilog, yaml } as const;
type GrammarName = keyof typeof GRAMMARS;

for (const [name, grammar] of Object.entries(GRAMMARS)) {
  if (!hljs.getLanguage(name)) hljs.registerLanguage(name, grammar);
}

export interface CodeLanguage {
  /** The fence name as written, lower-cased ("systemverilog", "text"); "" when none was given. */
  id: string;
  /** The highlight.js grammar, or undefined for plain text. */
  grammar?: GrammarName;
  /** What the block's label shows, in the language's own spelling. */
  label: string;
}

/** Fence names used in the curriculum (and common aliases), with their grammar and label. */
const LANGUAGES: Record<string, Omit<CodeLanguage, "id">> = {
  systemverilog: { grammar: "verilog", label: "SystemVerilog" },
  sv: { grammar: "verilog", label: "SystemVerilog" },
  svh: { grammar: "verilog", label: "SystemVerilog" },
  verilog: { grammar: "verilog", label: "Verilog" },
  v: { grammar: "verilog", label: "Verilog" },
  bash: { grammar: "bash", label: "Bash" },
  sh: { grammar: "bash", label: "Shell" },
  shell: { grammar: "bash", label: "Shell" },
  console: { grammar: "bash", label: "Shell" },
  c: { grammar: "c", label: "C" },
  cpp: { grammar: "cpp", label: "C++" },
  "c++": { grammar: "cpp", label: "C++" },
  python: { grammar: "python", label: "Python" },
  py: { grammar: "python", label: "Python" },
  tcl: { grammar: "tcl", label: "Tcl" },
  yaml: { grammar: "yaml", label: "YAML" },
  yml: { grammar: "yaml", label: "YAML" },
  makefile: { grammar: "makefile", label: "Makefile" },
  make: { grammar: "makefile", label: "Makefile" },
  diff: { grammar: "diff", label: "Diff" },
  json: { grammar: "json", label: "JSON" },
  javascript: { grammar: "javascript", label: "JavaScript" },
  js: { grammar: "javascript", label: "JavaScript" },
  typescript: { grammar: "typescript", label: "TypeScript" },
  ts: { grammar: "typescript", label: "TypeScript" },
  // No grammar in highlight.js; shown as plain text with its own name.
  pss: { label: "PSS" },
  text: { label: "Text" },
  txt: { label: "Text" },
  plaintext: { label: "Text" },
  log: { label: "Log" },
};

/** Resolves a fence name to its grammar and label. Unknown names keep their own name as the label. */
export function resolveCodeLanguage(language?: string | null): CodeLanguage {
  const id = (language ?? "").trim().toLowerCase();
  const known = LANGUAGES[id];
  if (known) return { id, ...known };
  return { id, label: id ? id : "Code" };
}

/** One run of text with one colour; `style` is a key of `codeSurfaceHljsStyle`, absent for plain text. */
export interface CodeToken {
  text: string;
  style?: string;
}
export type CodeLine = CodeToken[];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'" };
const decode = (text: string) => text.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_, name: string) => ENTITIES[name]);

/**
 * Turns highlight.js HTML (only `<span class="…">`, `</span>` and escaped text)
 * into tokens. A token's style comes from the innermost span that has one.
 */
export function parseHighlightedHtml(html: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  const stack: (string | undefined)[] = [];
  const pattern = /<span class="([^"]*)">|<\/span>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    if (match[1] !== undefined) {
      stack.push(codeSurfaceStyleKey(match[1]) ?? stack[stack.length - 1]);
    } else if (match[2] !== undefined) {
      const style = stack[stack.length - 1];
      tokens.push(style ? { text: decode(match[2]), style } : { text: decode(match[2]) });
    } else {
      stack.pop();
    }
  }
  return tokens;
}

/** Splits tokens at line breaks; a token that spans lines becomes one token per line. */
export function splitTokenLines(tokens: readonly CodeToken[]): CodeLine[] {
  const lines: CodeLine[] = [[]];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push(token.style ? { text: part, style: token.style } : { text: part });
    });
  }
  return lines;
}

/** Drops blank lines at the start and whitespace at the end, keeping the first line's indentation. */
export function normalizeCode(code: string): string {
  return code.replace(/^(?:[ \t]*\r?\n)+/, "").replace(/\s+$/, "").replace(/\r\n?/g, "\n");
}

/** Highlights `code` and returns one token array per line. Plain text comes back as one token per line. */
export function highlightCode(code: string, language?: string | null): CodeLine[] {
  const source = normalizeCode(code);
  const { grammar } = resolveCodeLanguage(language);
  if (!grammar) return source.split("\n").map((line) => (line ? [{ text: line }] : []));
  try {
    const { value } = hljs.highlight(source, { language: grammar, ignoreIllegals: true });
    return splitTokenLines(parseHighlightedHtml(value));
  } catch {
    return source.split("\n").map((line) => (line ? [{ text: line }] : []));
  }
}
