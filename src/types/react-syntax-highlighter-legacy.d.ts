declare module "react-syntax-highlighter/dist/light" {
  import type { ComponentType } from "react";
  import type { SyntaxHighlighterProps } from "react-syntax-highlighter";

  const SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>;

  export function registerLanguage(name: string, language: unknown): void;
  export default SyntaxHighlighter;
}

declare module "react-syntax-highlighter/dist/languages/*" {
  const language: unknown;
  export default language;
}
