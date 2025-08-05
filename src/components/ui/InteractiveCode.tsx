"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { Button } from './Button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// This is a placeholder for SystemVerilog language support.
// A full implementation would require a Monarch tokenizer.
const registerSystemVerilogLanguage = (monacoInstance: typeof monaco) => {
    const langId = 'systemverilog';
    if (monacoInstance.languages.getLanguages().some(lang => lang.id === langId)) {
        return;
    }
    monacoInstance.languages.register({ id: langId });
    // Basic keyword highlighting for demonstration
    monacoInstance.languages.setMonarchTokensProvider(langId, {
        keywords: [
            'module', 'endmodule', 'logic', 'reg', 'wire', 'initial', 'always',
            'begin', 'end', 'if', 'else', 'case', 'endcase', 'parameter',
            'localparam', 'assign', 'always_ff', 'always_comb', 'function',
            'task', 'class', 'extends', 'super', 'new', 'virtual', 'interface',
            'modport', 'program', 'package', 'import', 'export', 'typedef',
            'struct', 'union', 'enum', 'string', 'integer', 'bit', 'byte', 'int',
            'shortint', 'longint', 'time', 'real', 'shortreal'
        ],
        operators: [
            '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
            '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
            '<<', '>>', '->', '<->'
        ],
        symbols:  /[=><!~?:&|+\-*/^%]+/,
        tokenizer: {
            root: [
                [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
                [/`[a-zA-Z_]\w*/, 'predefined'], // For `defines
                [/\d+/, 'number'],
                [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
                [/\/\//, 'comment'],
                [/\/\*/, 'comment', '@comment' ],
                [/[{}()\[\]]/, '@brackets'],
                [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } } ],
            ],
            comment: [
                [/[^/*]+/, 'comment' ],
                [/\*\//, 'comment', '@pop'  ],
                [/./, 'comment'],
            ],
            string: [
                [/[^\\"]+/, 'string'],
                [/\\./, 'string.escape.invalid'],
                [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' } ]
            ],
        },
    });
};


export interface ExplanationStep {
  target: string;
  title?: string;
  explanation: React.ReactNode;
}

interface InteractiveCodeProps {
  children: React.ReactNode;
  language?: string;
  fileName?: string;
  explanationSteps?: ExplanationStep[];
  initialStep?: number;
  isEditable?: boolean;
}

const parseTargetLines = (target: string, monacoInstance: typeof monaco): monaco.IRange[] => {
  if (!target || target.toLowerCase() === 'all' || !monacoInstance) {
    return [];
  }

  const ranges: monaco.IRange[] = [];
  const parts = target.split(',');
  parts.forEach(part => {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        ranges.push(new monacoInstance.Range(start, 1, end, 1));
      }
    } else {
      const lineNumber = Number(part);
      if (!isNaN(lineNumber)) {
        ranges.push(new monacoInstance.Range(lineNumber, 1, lineNumber, 1));
      }
    }
  });
  return ranges;
};

export const InteractiveCode: React.FC<InteractiveCodeProps> = ({
  children,
  language = "systemverilog",
  fileName,
  explanationSteps = [],
  initialStep = 0,
  isEditable = false,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep);
  const { theme } = useTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [decorations, setDecorations] = useState<string[]>([]);

  const code = useMemo(() => {
    let codeString = '';
    React.Children.forEach(children, (child) => {
      if (typeof child === 'string') {
        codeString += child;
      } else if (React.isValidElement(child) && child.props.children) {
        if (child.props.mdxType === 'pre') {
            const codeChild = React.Children.toArray(child.props.children).find(c => React.isValidElement(c) && c.props.mdxType === 'code');
            if(codeChild && React.isValidElement(codeChild)) {
                codeString += React.Children.toArray(codeChild.props.children).join('');
            }
        } else {
            codeString += React.Children.toArray(child.props.children).join('');
        }
      }
    });
    return codeString.trim();
  }, [children]);

  const hasExplanations = explanationSteps.length > 0;

  useEffect(() => {
    if (editorRef.current && monacoRef.current && hasExplanations) {
      const currentStep = explanationSteps[currentStepIndex];
      const newDecorations = editorRef.current.deltaDecorations(
        decorations,
        currentStep ? parseTargetLines(currentStep.target, monacoRef.current).map(range => ({
          range,
          options: {
            isWholeLine: true,
            className: 'monaco-highlighted-line',
            marginClassName: 'monaco-highlighted-line-margin',
          }
        })) : []
      );
      setDecorations(newDecorations);

      if (currentStep) {
        const ranges = parseTargetLines(currentStep.target, monacoRef.current);
        if (ranges.length > 0) {
          editorRef.current.revealLineInCenter(ranges[0].startLineNumber, monaco.editor.ScrollType.Smooth);
        }
      }
    }
  }, [currentStepIndex, hasExplanations, explanationSteps]);


  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    registerSystemVerilogLanguage(monacoInstance);

    // Initial decoration update
    if (hasExplanations) {
        const currentStep = explanationSteps[currentStepIndex];
        if (currentStep) {
            const ranges = parseTargetLines(currentStep.target, monacoInstance);
            const newDecorations = editor.deltaDecorations(
                [],
                ranges.map(range => ({
                    range,
                    options: {
                        isWholeLine: true,
                        className: 'monaco-highlighted-line',
                        marginClassName: 'monaco-highlighted-line-margin',
                    }
                }))
            );
            setDecorations(newDecorations);
            if (ranges.length > 0) {
              editor.revealLineInCenter(ranges[0].startLineNumber);
            }
        }
    }
  };


  const handleNext = () => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, explanationSteps.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div data-testid="interactive-code" className="interactive-code my-6 p-4 border border-white/20 rounded-lg shadow-md bg-white/10 backdrop-blur-lg">
      <div className="code-section mb-4 relative bg-transparent rounded-md overflow-hidden border border-white/20">
        {fileName && (
            <div className="bg-gray-700 text-white text-sm py-1 px-4">{fileName}</div>
        )}
        <Editor
          height="400px"
          language={language}
          value={code}
          onMount={handleEditorDidMount}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            readOnly: !isEditable,
            domReadOnly: !isEditable,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
            glyphMargin: true,
          }}
        />
      </div>

      {hasExplanations && (
        <>
          <div className="explanation-section p-4 bg-white/10 dark:bg-black/10 rounded min-h-[100px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStepIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {explanationSteps[currentStepIndex]?.title && <h4 className="font-semibold text-lg mb-2 text-primary">{explanationSteps[currentStepIndex].title}</h4>}
                <div className="text-sm text-foreground/90">{explanationSteps[currentStepIndex]?.explanation || 'End of walkthrough.'}</div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="navigation-controls flex justify-between items-center mt-4">
            <Button onClick={handlePrevious} disabled={currentStepIndex === 0} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {explanationSteps.length}
            </span>
            <Button onClick={handleNext} disabled={currentStepIndex === explanationSteps.length - 1} variant="outline">
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default InteractiveCode;
