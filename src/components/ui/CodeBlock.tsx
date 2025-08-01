'use client';
import React, { useState, useEffect } from "react";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { useTheme } from "next-themes";
import { lightTheme, darkTheme } from "@/lib/code-theme";
import { Copy, Check } from "lucide-react";
import { Button } from "./Button";

interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
  showLineNumbers?: boolean;
  lineProps?: (lineNumber: number) => React.HTMLAttributes<HTMLElement>;
  customStyle?: React.CSSProperties;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code = '',
  language = "systemverilog",
  fileName,
  showLineNumbers = true,
  lineProps,
  customStyle,
}) => {
  const { theme } = useTheme();
  const [isCopied, setIsCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  if (!isMounted) {
    return (
      <div className="bg-secondary text-secondary-foreground p-4 rounded-md shadow-md my-4">
        <pre><code>Loading code...</code></pre>
      </div>
    );
  }

  const codeTheme = theme === "dark" ? darkTheme : lightTheme;

  return (
    <div data-testid="code-block" className="my-4 rounded-lg shadow-lg overflow-hidden bg-white/10 backdrop-blur-lg border border-white/20">
      {fileName && (
        <div className="flex justify-between items-center px-4 py-2 bg-white/10 border-b border-white/20">
          <span className="text-xs font-mono text-muted-foreground">{fileName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Copy code to clipboard"
          >
            {isCopied ? (
              <Check className="w-4 h-4 mr-1" />
            ) : (
              <Copy className="w-4 h-4 mr-1" />
            )}
            {isCopied ? "Copied!" : "Copy"}
          </Button>
        </div>
      )}
      {!fileName && (
         <div className="relative text-right p-2">
            <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                aria-label="Copy code to clipboard"
            >
                {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
         </div>
      )}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language.toLowerCase() === "systemverilog" ? "verilog" : language}
          style={codeTheme as any}
          showLineNumbers={showLineNumbers}
          lineNumberStyle={{ color: "var(--muted-foreground)", fontSize: "0.8em", marginRight: "1em" }}
          wrapLines={true}
          lineProps={lineProps}
          customStyle={{
            margin: 0,
            borderRadius: "0",
            backgroundColor: "transparent",
            ...customStyle,
          }}
        >
          {code.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

