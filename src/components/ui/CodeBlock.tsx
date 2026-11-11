import React from "react";

import { CODE_SURFACE_TEXT, codeSurfaceHljsStyle } from "@/lib/code-surface-hljs";
import { highlightCode, resolveCodeLanguage, type CodeLine } from "@/lib/highlight-code";
import { cn } from "@/lib/utils";

import { CODE_BLOCK_COLLAPSE_LINES, CodeBlockFrame } from "./CodeBlockFrame";

// Code panels stay dark in both modes (DESIGN.md section 3), so the chrome on the
// code surface uses the code-surface roles, which are the same in both modes.
export const CODE_BLOCK_CHROME = {
  text: "text-code-foreground",
  secondary: "text-code-muted",
  hairline: "border-code-border",
  copyButton: "text-code-muted hover:bg-code-border hover:text-code-foreground",
} as const;

/** The listing: JetBrains Mono at the code token (13.5/22), growing to its longest line so the box around it scrolls. */
export const CODE_BLOCK_PRE_CLASS = "m-0 w-max min-w-full bg-transparent px-4 py-3 font-mono text-code [tab-size:2]";
/** Line numbers are a CSS counter, so they are never selected, copied or read out. */
export const CODE_BLOCK_LINE_NUMBER_CLASS =
  "[counter-increment:line] before:mr-4 before:inline-block before:w-[var(--code-line-number-width)] before:text-right before:text-code-muted before:content-[counter(line)]";

export interface CodeBlockProps {
  code: string;
  /** The fence name ("systemverilog", "bash", "text"). Defaults to SystemVerilog. */
  language?: string;
  fileName?: string;
  showLineNumbers?: boolean;
  /** Attributes for one line (1-based), for example to mark it; lines then render as blocks. */
  lineProps?: (lineNumber: number) => React.HTMLAttributes<HTMLElement>;
  /** Extra style for the `pre`. */
  customStyle?: React.CSSProperties;
  /** Listings longer than this open collapsed in a 28 rem window. */
  collapseAfter?: number;
  className?: string;
}

function renderLine(tokens: CodeLine) {
  return tokens.map((token, index) =>
    token.style ? (
      <span key={index} style={codeSurfaceHljsStyle[token.style] as React.CSSProperties}>
        {token.text}
      </span>
    ) : (
      <React.Fragment key={index}>{token.text}</React.Fragment>
    ),
  );
}

/**
 * The highlighted listing. Server-safe and synchronous: on lesson pages it is
 * highlighted when the page is prerendered, so the server HTML is final and
 * nothing moves when the page hydrates.
 */
export function CodeListing({
  lines,
  showLineNumbers = false,
  lineProps,
  customStyle,
}: {
  lines: readonly CodeLine[];
  showLineNumbers?: boolean;
  lineProps?: CodeBlockProps["lineProps"];
  customStyle?: React.CSSProperties;
}) {
  const asBlocks = Boolean(lineProps);
  const style = {
    color: CODE_SURFACE_TEXT.text,
    ...(showLineNumbers ? { counterReset: "line", "--code-line-number-width": `${String(lines.length).length}ch` } : {}),
    ...customStyle,
  } as React.CSSProperties;

  return (
    <pre className={CODE_BLOCK_PRE_CLASS} style={style}>
      <code>
        {lines.map((tokens, index) => {
          const extra = lineProps?.(index + 1) ?? {};
          return (
            <React.Fragment key={index}>
              <span
                {...extra}
                data-line={index + 1}
                className={cn(
                  showLineNumbers && CODE_BLOCK_LINE_NUMBER_CLASS,
                  asBlocks && "block min-h-[1.375rem]",
                  extra.className,
                ) || undefined}
              >
                {renderLine(tokens)}
              </span>
              {!asBlocks && index < lines.length - 1 ? "\n" : null}
            </React.Fragment>
          );
        })}
      </code>
    </pre>
  );
}

/**
 * A code block on the code surface: language label, copy button, and for
 * listings over 40 lines a 28 rem window with "Show all N lines". No "use
 * client": the highlighting runs where the block renders (on the server for
 * lessons) and only the chrome (CodeBlockFrame) is a client component.
 */
export function CodeBlock({
  code = "",
  language = "systemverilog",
  fileName,
  showLineNumbers = false,
  lineProps,
  customStyle,
  collapseAfter = CODE_BLOCK_COLLAPSE_LINES,
  className,
}: CodeBlockProps) {
  const lines = highlightCode(code, language);
  const { id, label } = resolveCodeLanguage(language);

  return (
    <CodeBlockFrame
      label={label}
      fileName={fileName}
      language={id}
      lineCount={lines.length}
      collapseAfter={collapseAfter}
      className={className}
    >
      <CodeListing lines={lines} showLineNumbers={showLineNumbers} lineProps={lineProps} customStyle={customStyle} />
    </CodeBlockFrame>
  );
}

export default CodeBlock;
