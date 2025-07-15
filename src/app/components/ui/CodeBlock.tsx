"use client";

import React, { useState, useEffect } from 'react';
import { rehype } from 'rehype';
import rehypePrettyCode from 'rehype-pretty-code';
import { CopyButton } from './CopyButton';

import type { Element as HastElement } from 'hast';

interface CodeBlockProps {
  code: string;
  language: string;
  className?: string;
  theme?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  className = '',
  theme = 'github-dark'
}) => {
  const [highlightedCode, setHighlightedCode] = useState('');

  useEffect(() => {
    const highlight = async () => {
      const options = {
        theme: theme,
        keepBackground: true,
        defaultLanguage: language,
        onVisitLine(node: HastElement) {
          if (node.children.length === 0) {
            node.children = [{ type: 'text', value: ' ' }];
          }
        },
        onVisitHighlightedLine(node: HastElement) {
          if (node.properties && Array.isArray(node.properties.className)) {
            node.properties.className.push('highlighted');
          } else if (node.properties) {
            node.properties.className = ['highlighted'];
          }
        },
        onVisitHighlightedChars(node: HastElement) {
          if (node.properties) {
            node.properties.className = ['word--highlighted'];
          } else {
            node.properties = { className: ['word--highlighted'] };
          }
        },
      } satisfies Record<string, unknown>;

      const processedCode = await rehype()
        .data('settings', { fragment: true })
        .use(rehypePrettyCode as any, options as any)
        .process(code);
      setHighlightedCode(processedCode.toString());
    };

    highlight();
  }, [code, language, theme]);

  return (
    <div className={`relative group ${className}`}>
      <CopyButton textToCopy={code} />
      <div
        className="prose prose-sm dark:prose-invert max-w-none
                   [&>pre]:bg-background/80 [&>pre]:backdrop-blur-sm [&>pre]:border [&>pre]:border-[rgba(100,255,218,0.2)]
                   [&>pre]:rounded-md [&>pre]:p-4 [&>pre]:shadow-md
                   [&_code]:font-mono [&_code]:text-sm"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  );
};

export { CodeBlock };
