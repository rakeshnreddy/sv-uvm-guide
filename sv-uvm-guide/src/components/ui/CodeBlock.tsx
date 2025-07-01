"use client";

import React, { useState, useEffect } from "react";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
// Choosing a dark theme for code blocks, can be customized or made theme-aware
import { okaidia } from "react-syntax-highlighter/dist/esm/styles/prism"; // Changed to okaidia
import { Copy, Check } from "lucide-react";
import { Button } from "./Button"; // Using our existing Button component

// Registering SystemVerilog language support if available and not auto-detected
// highlight.js itself might need specific language packs if Prism doesn't cover it well enough out of the box.
// For Prism via react-syntax-highlighter, many common languages are supported.
// SystemVerilog might require a custom registration or ensuring it's part of the default set.
// Let's assume 'systemverilog' or 'verilog' will work.
// We might need to explicitly import and register the language if it doesn't work by default.
// import systemverilog from 'react-syntax-highlighter/dist/esm/languages/prism/systemverilog'; // Example
// SyntaxHighlighter.registerLanguage('systemverilog', systemverilog);


interface CodeBlockProps {
  code: string;
  language?: string; // e.g., "systemverilog", "javascript"
  fileName?: string;
  showLineNumbers?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = "systemverilog", // Default to systemverilog
  fileName,
  showLineNumbers = true,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Attempt to register SystemVerilog if not already.
    // This often needs to be done once globally.
    // For now, we'll assume it's available or try a common alias.
    // (This part can be tricky with server components vs client components and bundlers)
  }, []);


  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy code: ", err);
      // Handle error (e.g., show a toast message)
    }
  };

  if (!isMounted) {
    // Avoids potential SSR/hydration mismatch issues with syntax highlighter
    // or navigator.clipboard usage if not careful.
    // A simple div or null can be returned until mounted.
    return (
      <div className="bg-gray-800 text-white p-4 rounded-md shadow-md my-4">
        <pre><code>Loading code...</code></pre>
      </div>
    );
  }

  // Custom style for the highlighter to match glassmorphism if desired,
  // or use a pre-defined style like materialDark.
  // For full glassmorphism, background of SyntaxHighlighter needs to be transparent
  // and the parent div should have the glassmorphism class.
  const codeBlockStyle = {
    ...okaidia, // Use okaidia here
    'pre[class*="language-"]': {
      ...okaidia['pre[class*="language-"]'], // Use okaidia here
      backgroundColor: "transparent", // Try to make it transparent for parent glassmorphism
      padding: "1em",
    },
     // Ensure the code itself has a background if the pre is transparent
    'code[class*="language-"]': {
        ...okaidia['code[class*="language-"]'], // Use okaidia here
        // backgroundColor: "rgba(0,0,0,0.1)", // Slight dark background for text readability
    }
  };


  return (
    <div className="my-4 rounded-lg shadow-lg overflow-hidden bg-gray-800/70 dark:bg-slate-800/70 backdrop-blur-sm border border-white/10 dark:border-slate-700/50">
      {fileName && (
        <div className="flex justify-between items-center px-4 py-2 bg-gray-700/50 dark:bg-slate-700/50 border-b border-white/10 dark:border-slate-600/50">
          <span className="text-xs font-mono text-gray-300 dark:text-slate-300">{fileName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-gray-300 dark:text-slate-300 hover:text-white dark:hover:text-white"
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
      {!fileName && ( // Show copy button at top right if no filename header
         <div className="relative text-right p-2">
            <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="absolute top-2 right-2 text-gray-300 dark:text-slate-300 hover:text-white dark:hover:text-white"
                aria-label="Copy code to clipboard"
            >
                {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
         </div>
      )}
      <SyntaxHighlighter
        language={language.toLowerCase() === "systemverilog" ? "verilog" : language} // Prism might use 'verilog'
        style={codeBlockStyle}
        showLineNumbers={showLineNumbers}
        lineNumberStyle={{ color: "#6b7280", fontSize: "0.8em", marginRight: "1em" }} // Tailwind gray-500
        wrapLines={true}
        customStyle={{
          margin: 0, // Remove default margin from SyntaxHighlighter
          borderRadius: "0", // Ensure no double border radius if parent has one
          // backgroundColor: "transparent" // Already part of codeBlockStyle modification
        }}
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;
