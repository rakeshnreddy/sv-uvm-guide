"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EditorProps, OnMount } from '@monaco-editor/react';
import type * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { select } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { max } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';

type Monaco = typeof monacoEditor;
type MonacoRange = monacoEditor.IRange;
type MonacoEditorInstance = monacoEditor.editor.IStandaloneCodeEditor;
type MonacoLanguageExtension = monacoEditor.languages.ILanguageExtensionPoint;
import {
  connectCollaboration,
  broadcastEdit,
  type UserEdit,
} from '../../lib/collaboration';

const MonacoEditor = dynamic<EditorProps>(
  () => import('@monaco-editor/react').then(mod => mod.default),
  { ssr: false }
);

// Register a more complete SystemVerilog language definition using Monarch
// tokenization rules. This provides basic support for numbers, strings,
// macros and comments so that the editor can properly highlight typical
// SystemVerilog source files.
export const registerSystemVerilogLanguage = (monacoInstance: Monaco) => {
    const langId = 'systemverilog';
    if (
      monacoInstance.languages
        .getLanguages()
        .some((lang: MonacoLanguageExtension) => lang.id === langId)
    ) {
        return;
    }

    monacoInstance.languages.register({ id: langId });
    monacoInstance.languages.setMonarchTokensProvider(langId, {
        defaultToken: '',
        tokenPostfix: '.sv',

        // Keywords taken from the SystemVerilog specification
        keywords: [
            'module', 'endmodule', 'logic', 'reg', 'wire', 'initial', 'always',
            'begin', 'end', 'if', 'else', 'case', 'endcase', 'parameter',
            'localparam', 'assign', 'always_ff', 'always_comb', 'function',
            'task', 'class', 'extends', 'super', 'new', 'virtual', 'interface',
            'modport', 'program', 'package', 'import', 'export', 'typedef',
            'struct', 'union', 'enum', 'string', 'integer', 'bit', 'byte', 'int',
            'shortint', 'longint', 'time', 'real', 'shortreal', 'generate',
            'endgenerate', 'typedef', 'return', 'void'
        ],

        operators: [
            '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
            '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
            '<<', '>>', '<<<', '>>>', '->', '<->'
        ],

        // regular expressions used by the tokenizer
        symbols: /[=><!~?:&|+\-*\/^%]+/,
        escapes: /\\(?:[abfnrtv"'\\]|x[0-9A-Fa-f]{1,4})/,

        tokenizer: {
            root: [
                { include: '@whitespace' },
                [/`define|`ifdef|`ifndef|`else|`elsif|`endif|`timescale|`include/, 'keyword.directive'],
                [/`[a-zA-Z_][\w$]*/, 'macro'],
                [/[a-zA-Z_][\w$]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
                [/\/\*/, 'comment', '@comment'],
                [/\/\/.*$/, 'comment'],
                [/#?\d+'[bodhBODH][0-9a-fA-F_xzXZ?]+/, 'number'],
                [/#?\d+/, 'number'],
                [/"/, { token: 'string.quote', bracket: '@open', next: '@string_dq' }],
                [/'/, { token: 'string.quote', bracket: '@open', next: '@string_sq' }],
                [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
                [/[{}()\[\]]/, '@brackets'],
            ],

            // whitespace, including newlines
            whitespace: [
                [/[ \t\r\n]+/, 'white'],
            ],

            comment: [
                [/[^/*]+/, 'comment'],
                [/\*\//, 'comment', '@pop'],
                [/./, 'comment'],
            ],

            string_dq: [
                [/[^\\"\n]+/, 'string'],
                [/\\./, 'string.escape'],
                [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
            ],

            string_sq: [
                [/[^\\'\n]+/, 'string'],
                [/\\./, 'string.escape'],
                [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
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
  collabUrl?: string;
  userId?: string;
}

const parseTargetLines = (target: string, monacoInstance: Monaco | null): MonacoRange[] => {
  if (!target || target.toLowerCase() === 'all' || !monacoInstance) {
    return [];
  }

  const ranges: MonacoRange[] = [];
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

interface ASTNode {
  type: string;
  name?: string;
  children?: ASTNode[];
  details?: Record<string, any>;
}

interface AnalysisResult {
  ast: ASTNode[];
  metrics: {
    lines: number;
    modules: number;
    alwaysBlocks: number;
    complexity: number;
  };
  suggestions: string[];
  warnings: string[];
  refactorSuggestions: string[];
  performance: {
    speed: string;
    memory: number;
    timing: string;
  };
  testCases: string[];
}

const parseSystemVerilogAST = (input: string): ASTNode[] => {
  const lines = input.split(/\r?\n/);
  const root: ASTNode[] = [];
  let currentModule: ASTNode | null = null;
  const stack: ASTNode[] = [];

  lines.forEach((line) => {
    const moduleMatch = line.match(/^\s*module\s+(\w+)/);
    if (moduleMatch) {
      const moduleNode: ASTNode = { type: 'module', name: moduleMatch[1], children: [] };
      root.push(moduleNode);
      currentModule = moduleNode;
      stack.length = 0;
      return;
    }
    if (/^\s*endmodule/.test(line)) {
      currentModule = null;
      stack.length = 0;
      return;
    }
    if (!currentModule) return;

    const alwaysMatch = line.match(/^\s*always(_ff|_comb)?/);
    if (alwaysMatch) {
      const alwaysNode: ASTNode = {
        type: 'always',
        name: alwaysMatch[0],
        children: [],
      };
      currentModule.children!.push(alwaysNode);
      stack.push(alwaysNode);
      return;
    }
    if (/^\s*begin\b/.test(line)) {
      const blockNode: ASTNode = { type: 'block', children: [] };
      const parent = stack[stack.length - 1] || currentModule;
      parent.children!.push(blockNode);
      stack.push(blockNode);
      return;
    }
    if (/^\s*end\b/.test(line)) {
      stack.pop();
      return;
    }
    const parent = stack[stack.length - 1] || currentModule;
    parent.children!.push({ type: 'statement', details: { line: line.trim() } });
  });
  return root;
};

const analyzeSystemVerilog = (input: string): AnalysisResult => {
  const lines = input.split(/\r?\n/);
  const ast = parseSystemVerilogAST(input);
  const modules = ast.length;
  let alwaysBlocks = 0;
  ast.forEach((m) => {
    alwaysBlocks += m.children?.filter((c) => c.type === 'always').length || 0;
  });
  const complexity = lines.reduce(
    (acc, l) => acc + ((l.match(/\b(if|case|for|while)\b/g) || []).length),
    0
  );

  const metrics = {
    lines: lines.length,
    modules,
    alwaysBlocks,
    complexity,
  };

  const suggestions: string[] = [];
  const refactorSuggestions: string[] = [];

  if (input.match(/\btodo\b/i)) {
    suggestions.push('Remove TODO comments before final submission.');
  }
  if (input.includes('always_ff') && !input.includes('<=')) {
    suggestions.push('Use non-blocking assignments (<=) in sequential logic.');
  }
  if (complexity > 10) {
    refactorSuggestions.push('Consider simplifying complex conditional logic.');
  }
  if (lines.some((l) => l.length > 120)) {
    refactorSuggestions.push('Split long lines to improve readability.');
  }

  const warnings: string[] = [];
  if (input.includes('#')) {
    warnings.push('Avoid using # delays for synthesizable code.');
  }
  if (input.match(/\bfork\b/)) {
    warnings.push('fork...join detected; ensure this is safe for your design.');
  }

  const memory = lines.filter((l) => l.match(/\b(reg|logic|byte|int|bit|shortint|longint)\b/)).length * 4;
  const performance = {
    speed: complexity > 20 ? 'Slow' : complexity > 5 ? 'Moderate' : 'Fast',
    memory,
    timing: `${alwaysBlocks * 10 + complexity} ns estimated latency`,
  };

  const testCases = ast.map(
    (m) => `module tb_${m.name};\n  ${m.name} uut();\n  initial begin\n    // Add test sequences here\n  end\nendmodule`
  );

  return {
    ast,
    metrics,
    suggestions,
    warnings,
    refactorSuggestions,
    performance,
    testCases,
  };
};

export const InteractiveCode: React.FC<InteractiveCodeProps> = ({
  children,
  language = "systemverilog",
  fileName,
  explanationSteps = [],
  initialStep = 0,
  isEditable = false,
  collabUrl,
  userId = 'local',
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep);
  const { theme, resolvedTheme } = useTheme();
  const effectiveTheme = (theme === 'system' ? resolvedTheme : theme) ?? 'dark';
  const isDarkMode = effectiveTheme === 'dark';
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

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

  const [codeContent, setCodeContent] = useState(code);
  useEffect(() => setCodeContent(code), [code]);

  const socketRef = useRef<WebSocket | null>(null);
  const lastRemoteEdit = useRef<number>(0);
  const [reviewLog, setReviewLog] = useState<UserEdit[]>([]);

  useEffect(() => {
    if (!collabUrl) return;
    const socket = connectCollaboration(collabUrl);
    socketRef.current = socket;
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'edit') {
          const incoming: UserEdit = data.edit;
          if (incoming.user !== userId && incoming.timestamp > lastRemoteEdit.current) {
            lastRemoteEdit.current = incoming.timestamp;
            setCodeContent(incoming.content);
            setReviewLog((log) => [...log, incoming]);
          }
        }
      } catch (e) {
        // ignore malformed messages
      }
    };
    return () => socket.close();
  }, [collabUrl, userId]);

  /* eslint-disable-next-line react-hooks/exhaustive-deps -- analyzeSystemVerilog is a stable helper */
  const analysis = useMemo(() => analyzeSystemVerilog(codeContent), [codeContent]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const flowRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!analysis || !svgRef.current) return;
    const data = [
      { label: 'Lines', value: analysis.metrics.lines },
      { label: 'Modules', value: analysis.metrics.modules },
      { label: 'Always', value: analysis.metrics.alwaysBlocks },
    ];
    const svg = select(svgRef.current);
    const width = Number(svg.attr('width')) || 300;
    const height = Number(svg.attr('height')) || 120;
    svg.selectAll('*').remove();
    const x = scaleBand().domain(data.map(d => d.label)).range([0, width]).padding(0.1);
    const y = scaleLinear().domain([0, max(data, d => d.value) || 1]).range([height, 0]);
    svg.append('g').selectAll('rect').data(data).enter().append('rect')
      .attr('x', d => x(d.label) || 0)
      .attr('y', d => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d.value))
      .attr('fill', '#3b82f6');
    svg.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(x));
    svg.append('g').call(axisLeft(y).ticks(3));
  }, [analysis]);

  useEffect(() => {
    if (!analysis || !flowRef.current) return;
    const svg = select(flowRef.current);
    const width = Number(svg.attr('width')) || 300;
    const height = Number(svg.attr('height')) || 200;
    svg.selectAll('*').remove();
    let y = 20;
    analysis.ast.forEach(mod => {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .text(mod.name || 'module');
      const startY = y;
      y += 20;
      mod.children?.filter(c => c.type === 'always').forEach((al, idx) => {
        svg.append('line')
          .attr('x1', width / 2)
          .attr('y1', startY + 5)
          .attr('x2', width / 2)
          .attr('y2', y - 10)
          .attr('stroke', '#555');
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .text(al.name || `always_${idx}`);
        y += 20;
      });
      y += 10;
    });
  }, [analysis]);

  const hasExplanations = explanationSteps.length > 0;

  useEffect(() => {
    if (editorRef.current && monacoRef.current && hasExplanations) {
      const currentStep = explanationSteps[currentStepIndex];
      const newDecorations = editorRef.current.deltaDecorations(
        decorationsRef.current,
        currentStep ? parseTargetLines(currentStep.target, monacoRef.current).map(range => ({
          range,
          options: {
            isWholeLine: true,
            className: 'monaco-highlighted-line',
            marginClassName: 'monaco-highlighted-line-margin',
          }
        })) : []
      );
      decorationsRef.current = newDecorations;

      if (currentStep) {
        const ranges = parseTargetLines(currentStep.target, monacoRef.current);
        if (ranges.length > 0) {
          const monacoInstance = monacoRef.current;
          editorRef.current.revealLineInCenter(
            ranges[0].startLineNumber,
            monacoInstance?.editor.ScrollType.Smooth
          );
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
        decorationsRef.current = newDecorations;
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
    <div
      data-testid="interactive-code"
      className={cn(
        'interactive-code my-6 rounded-lg border p-4 shadow-md backdrop-blur-lg transition-colors',
        isDarkMode
          ? 'border-white/20 bg-white/10 text-[rgba(230,241,255,0.85)]'
          : 'border-slate-300/60 bg-slate-950/5 text-slate-800'
      )}
    >
      <div
        className={cn(
          'code-section relative mb-4 overflow-hidden rounded-md border transition-colors',
          isDarkMode ? 'border-white/20 bg-transparent' : 'border-slate-200/80 bg-white'
        )}
      >
        {fileName && (
            <div className="bg-gray-700 text-white text-sm py-1 px-4">{fileName}</div>
        )}
        <MonacoEditor
          height="400px"
          language={language}
          value={codeContent}
          onMount={handleEditorDidMount}
          onChange={(value) => {
            const newValue = value || '';
            setCodeContent(newValue);
            if (socketRef.current) {
              const edit: UserEdit = {
                user: userId,
                content: newValue,
                timestamp: Date.now(),
              };
              broadcastEdit(socketRef.current, edit);
            }
          }}
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
      <div className="analysis-section grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="text-sm">
          <h4 className="font-semibold mb-2">Metrics</h4>
          <ul className="list-disc ml-5">
            <li>Lines: {analysis?.metrics.lines}</li>
            <li>Modules: {analysis?.metrics.modules}</li>
            <li>Always blocks: {analysis?.metrics.alwaysBlocks}</li>
            <li>Complexity tokens: {analysis?.metrics.complexity}</li>
          </ul>
          <h4 className="font-semibold mt-4 mb-2">Performance</h4>
          <ul className="list-disc ml-5">
            <li>Speed: {analysis?.performance.speed}</li>
            <li>Memory estimate: {analysis?.performance.memory} bytes</li>
            <li>Timing: {analysis?.performance.timing}</li>
          </ul>
          <h4 className="font-semibold mt-4 mb-2">Suggestions</h4>
          <ul className="list-disc ml-5">
            {analysis?.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
            {analysis?.suggestions.length === 0 && <li>No suggestions</li>}
          </ul>
          <h4 className="font-semibold mt-4 mb-2">Refactor Suggestions</h4>
          <ul className="list-disc ml-5">
            {analysis?.refactorSuggestions.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
            {analysis?.refactorSuggestions.length === 0 && <li>None</li>}
          </ul>
          <h4 className="font-semibold mt-4 mb-2">Security Warnings</h4>
          <ul className="list-disc ml-5">
            {analysis?.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {analysis?.warnings.length === 0 && <li>None detected</li>}
          </ul>
          <h4 className="font-semibold mt-4 mb-2">Generated Tests</h4>
          <pre className="bg-black/10 p-2 rounded">{analysis?.testCases.join('\n')}</pre>
        </div>
        <div className="flex flex-col justify-center items-center space-y-4">
          <svg ref={svgRef} width="300" height="120"></svg>
          <svg ref={flowRef} width="300" height="200"></svg>
        </div>
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
      {reviewLog.length > 0 && (
        <div className="mt-4 text-xs">
          <h4 className="font-semibold mb-1">Review Log</h4>
          <ul className="list-disc ml-5 max-h-24 overflow-auto">
            {reviewLog.map((e, i) => (
              <li key={i}>{e.user} @ {new Date(e.timestamp).toLocaleTimeString()}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default InteractiveCode;
