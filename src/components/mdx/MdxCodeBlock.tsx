import React from "react";

import { CodeBlock } from "@/components/ui/CodeBlock";

type CodeElementProps = { className?: string; children?: React.ReactNode };

/** The fence's language from the `code` element's `language-…` class, or "" when none was given. */
export function fenceLanguage(className?: string): string {
  const match = /(?:^|\s)language-([^\s]+)/.exec(className ?? "");
  return match ? match[1] : "";
}

/** The text of a fenced block's `code` child, or null when the child is not plain text. */
export function fenceSource(children: React.ReactNode): { code: string; language: string } | null {
  const child = React.Children.toArray(children)[0];
  if (!React.isValidElement<CodeElementProps>(child)) return null;
  const parts = React.Children.toArray(child.props.children);
  if (!parts.every((part) => typeof part === "string" || typeof part === "number")) return null;
  return { code: parts.join(""), language: fenceLanguage(child.props.className) };
}

/**
 * The MDX `pre` override: a fenced code block becomes a CodeBlock, highlighted
 * when the lesson is rendered on the server. Anything else (a `pre` written by
 * hand with markup inside) keeps its own markup on the code surface.
 */
export function MdxCodeBlock({ children, className, ...props }: React.ComponentPropsWithoutRef<"pre">) {
  const source = fenceSource(children);
  if (source) return <CodeBlock code={source.code} language={source.language || "text"} />;
  return (
    <pre {...props} className={className}>
      {children}
    </pre>
  );
}

export default MdxCodeBlock;
