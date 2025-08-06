"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { Button } from './Button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import * as d3 from 'd3';

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

  const [codeContent, setCodeContent] = useState(code);
  useEffect(() => setCodeContent(code), [code]);

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

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  useEffect(() => {
    setAnalysis(analyzeSystemVerilog(codeContent));
  }, [codeContent]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const flowRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!analysis || !svgRef.current) return;
    const data = [
      { label: 'Lines', value: analysis.metrics.lines },
      { label: 'Modules', value: analysis.metrics.modules },
      { label: 'Always', value: analysis.metrics.alwaysBlocks },
    ];
    const svg = d3.select(svgRef.current);
    const width = Number(svg.attr('width')) || 300;
    const height = Number(svg.attr('height')) || 120;
    svg.selectAll('*').remove();
    const x = d3.scaleBand().domain(data.map(d => d.label)).range([0, width]).padding(0.1);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.value) || 1]).range([height, 0]);
    svg.append('g').selectAll('rect').data(data).enter().append('rect')
      .attr('x', d => x(d.label) || 0)
      .attr('y', d => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d.value))
      .attr('fill', '#3b82f6');
    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y).ticks(3));
  }, [analysis]);

  useEffect(() => {
    if (!analysis || !flowRef.current) return;
    const svg = d3.select(flowRef.current);
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
          value={codeContent}
          onMount={handleEditorDidMount}
          onChange={(value) => setCodeContent(value || '')}
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
    </div>
  );
};

export default InteractiveCode;
