// src/lib/code-theme.ts

// This is a custom theme for react-syntax-highlighter that uses CSS variables
// from our Tailwind CSS config. This ensures that code blocks match the
// application's theme.

const monoStack = "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, monospace";

export const lightTheme = {
  'code[class*="language-"]': {
    color: "hsl(var(--foreground))",
    background: "hsl(var(--background))",
    fontFamily: monoStack,
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
    mozTabSize: "4",
    oTabSize: "4",
    tabSize: "4",
    webkitHyphens: "none",
    mozHyphens: "none",
    msHyphens: "none",
    hyphens: "none",
  },
  'pre[class*="language-"]': {
    color: "hsl(var(--foreground))",
    background: "hsl(var(--background))",
    fontFamily: monoStack,
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
    mozTabSize: "4",
    oTabSize: "4",
    tabSize: "4",
    webkitHyphens: "none",
    mozHyphens: "none",
    msHyphens: "none",
    hyphens: "none",
    padding: "1em",
    margin: ".5em 0",
    overflow: "auto",
    borderRadius: "var(--radius)",
  },
  ':not(pre) > code[class*="language-"]': {
    background: "hsl(var(--secondary))",
    padding: ".1em",
    borderRadius: ".3em",
    whiteSpace: "normal",
  },
  comment: {
    color: "hsl(var(--muted-foreground))",
  },
  prolog: {
    color: "hsl(var(--muted-foreground))",
  },
  doctype: {
    color: "hsl(var(--muted-foreground))",
  },
  cdata: {
    color: "hsl(var(--muted-foreground))",
  },
  punctuation: {
    color: "hsl(var(--foreground))",
  },
  ".namespace": {
    opacity: ".7",
  },
  property: {
    color: "hsl(var(--primary))",
  },
  tag: {
    color: "hsl(var(--primary))",
  },
  boolean: {
    color: "hsl(var(--primary))",
  },
  number: {
    color: "hsl(var(--primary))",
  },
  constant: {
    color: "hsl(var(--primary))",
  },
  symbol: {
    color: "hsl(var(--primary))",
  },
  deleted: {
    color: "hsl(var(--destructive))",
  },
  selector: {
    color: "hsl(var(--accent))",
  },
  "attr-name": {
    color: "hsl(var(--accent))",
  },
  string: {
    color: "hsl(var(--accent))",
  },
  char: {
    color: "hsl(var(--accent))",
  },
  builtin: {
    color: "hsl(var(--accent))",
  },
  inserted: {
    color: "hsl(var(--accent))",
  },
  operator: {
    color: "hsl(var(--foreground))",
  },
  entity: {
    color: "hsl(var(--foreground))",
    cursor: "help",
  },
  url: {
    color: "hsl(var(--foreground))",
  },
  ".language-css .token.string": {
    color: "hsl(var(--foreground))",
  },
  ".style .token.string": {
    color: "hsl(var(--foreground))",
  },
  variable: {
    color: "hsl(var(--foreground))",
  },
  atrule: {
    color: "hsl(var(--primary))",
  },
  "attr-value": {
    color: "hsl(var(--primary))",
  },
  keyword: {
    color: "hsl(var(--primary))",
  },
  function: {
    color: "hsl(var(--primary))",
  },
  "class-name": {
    color: "hsl(var(--primary))",
  },
  regex: {
    color: "hsl(var(--destructive))",
  },
  important: {
    color: "hsl(var(--destructive))",
    fontWeight: "bold",
  },
  bold: {
    fontWeight: "bold",
  },
  italic: {
    fontStyle: "italic",
  },
};

export const darkTheme = {
  'code[class*="language-"]': {
    color: "hsl(var(--foreground))",
    background: "hsl(var(--background))",
    fontFamily: monoStack,
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
    mozTabSize: "4",
    oTabSize: "4",
    tabSize: "4",
    webkitHyphens: "none",
    mozHyphens: "none",
    msHyphens: "none",
    hyphens: "none",
  },
  'pre[class*="language-"]': {
    color: "hsl(var(--foreground))",
    background: "hsl(var(--background))",
    fontFamily: monoStack,
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
    mozTabSize: "4",
    oTabSize: "4",
    tabSize: "4",
    webkitHyphens: "none",
    mozHyphens: "none",
    msHyphens: "none",
    hyphens: "none",
    padding: "1em",
    margin: ".5em 0",
    overflow: "auto",
    borderRadius: "var(--radius)",
  },
  ':not(pre) > code[class*="language-"]': {
    background: "hsl(var(--secondary))",
    padding: ".1em",
    borderRadius: ".3em",
    whiteSpace: "normal",
  },
  comment: {
    color: "hsl(var(--muted-foreground))",
  },
  prolog: {
    color: "hsl(var(--muted-foreground))",
  },
  doctype: {
    color: "hsl(var(--muted-foreground))",
  },
  cdata: {
    color: "hsl(var(--muted-foreground))",
  },
  punctuation: {
    color: "hsl(var(--foreground))",
  },
  ".namespace": {
    opacity: ".7",
  },
  property: {
    color: "hsl(var(--primary))",
  },
  tag: {
    color: "hsl(var(--primary))",
  },
  boolean: {
    color: "hsl(var(--primary))",
  },
  number: {
    color: "hsl(var(--primary))",
  },
  constant: {
    color: "hsl(var(--primary))",
  },
  symbol: {
    color: "hsl(var(--primary))",
  },
  deleted: {
    color: "hsl(var(--destructive))",
  },
  selector: {
    color: "hsl(var(--accent))",
  },
  "attr-name": {
    color: "hsl(var(--accent))",
  },
  string: {
    color: "hsl(var(--accent))",
  },
  char: {
    color: "hsl(var(--accent))",
  },
  builtin: {
    color: "hsl(var(--accent))",
  },
  inserted: {
    color: "hsl(var(--accent))",
  },
  operator: {
    color: "hsl(var(--foreground))",
  },
  entity: {
    color: "hsl(var(--foreground))",
    cursor: "help",
  },
  url: {
    color: "hsl(var(--foreground))",
  },
  ".language-css .token.string": {
    color: "hsl(var(--foreground))",
  },
  ".style .token.string": {
    color: "hsl(var(--foreground))",
  },
  variable: {
    color: "hsl(var(--foreground))",
  },
  atrule: {
    color: "hsl(var(--primary))",
  },
  "attr-value": {
    color: "hsl(var(--primary))",
  },
  keyword: {
    color: "hsl(var(--primary))",
  },
  function: {
    color: "hsl(var(--primary))",
  },
  "class-name": {
    color: "hsl(var(--primary))",
  },
  regex: {
    color: "hsl(var(--destructive))",
  },
  important: {
    color: "hsl(var(--destructive))",
    fontWeight: "bold",
  },
  bold: {
    fontWeight: "bold",
  },
  italic: {
    fontStyle: "italic",
  },
};
