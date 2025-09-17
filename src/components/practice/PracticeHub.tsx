import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface PracticeItem {
  href: string;
  title: string;
  description: string;
  status: 'completed' | 'wip' | 'planned';
  type: 'Exercise' | 'Animation' | 'Diagram' | 'Chart' | 'Tool';
}

const practiceItems: PracticeItem[] = [
  // Exercises
  {
    href: '/exercises/uvm-agent-builder',
    title: 'UVM Agent Builder',
    description: 'Drag and drop components to build a complete UVM agent.',
    status: 'planned',
    type: 'Exercise',
  },
  {
    href: '/exercises/uvm-phase-sorter',
    title: 'UVM Phase Sorter',
    description: 'Correctly order the UVM runtime phases.',
    status: 'planned',
    type: 'Exercise',
  },
  {
    href: '/exercises/scoreboard-connector',
    title: 'Scoreboard Connector',
    description: 'Visually connect monitor analysis ports to scoreboards.',
    status: 'planned',
    type: 'Exercise',
  },
  // Animations
  {
    href: '/practice/visualizations/systemverilog-data-types',
    title: 'SystemVerilog Data Types',
    description: 'Visualize the difference between 2-state and 4-state data types.',
    status: 'completed',
    type: 'Animation',
  },
  {
    href: '/practice/visualizations/procedural-blocks',
    title: 'Procedural Blocks Simulator',
    description: 'See how initial, always, and final blocks execute.',
    status: 'completed',
    type: 'Animation',
  },
  {
    href: '/practice/visualizations/concurrency',
    title: 'Concurrency Visualizer',
    description: 'Understand how concurrent processes execute in simulation.',
    status: 'completed',
    type: 'Animation',
  },
  {
    href: '/practice/visualizations/state-machine-designer',
    title: 'State Machine Designer',
    description: 'Design and simulate a simple finite state machine.',
    status: 'completed',
    type: 'Animation',
  },
  {
    href: '/practice/visualizations/randomization-explorer',
    title: 'Randomization Explorer',
    description: 'Explore the effects of constraints on randomization.',
    status: 'completed',
    type: 'Animation',
  },
  {
    href: '/practice/visualizations/assertion-builder',
    title: 'SVA Assertion Builder',
    description: 'Build SystemVerilog Assertions (SVA) with a guided interface.',
    status: 'completed',
    type: 'Animation',
  },
  {
    href: '/practice/visualizations/coverage-analyzer',
    title: 'Coverage Analyzer',
    description: 'See how functional coverage is collected and reported.',
    status: 'completed',
    type: 'Animation',
  },
  {
    href: '/practice/visualizations/interface-signal-flow',
    title: 'Interface Signal Flow',
    description: 'Visualize how signals flow through an interface with modports.',
    status: 'completed',
    type: 'Animation',
  },
  // Diagrams
  {
    href: '/practice/visualizations/uvm-architecture',
    title: 'Interactive UVM Architecture',
    description: 'Explore the components of a UVM testbench.',
    status: 'completed',
    type: 'Diagram',
  },
  {
    href: '/practice/visualizations/uvm-component-relationships',
    title: 'UVM Component Relationships',
    description: 'See how UVM components are connected and interact.',
    status: 'completed',
    type: 'Diagram',
  },
  {
    href: '/practice/visualizations/uvm-phasing',
    title: 'UVM Phasing Diagram',
    description: 'An interactive diagram of the UVM phasing mechanism.',
    status: 'completed',
    type: 'Diagram',
  },
  // Charts
  {
    href: '/practice/visualizations/data-type-comparison',
    title: 'Data Type Comparison',
    description: 'Compare memory usage and features of different data types.',
    status: 'completed',
    type: 'Chart',
  },
  // Tools
  {
    href: '/practice/waveform-studio',
    title: 'Waveform Studio',
    description: 'A tool for viewing and analyzing waveform diagrams.',
    status: 'completed',
    type: 'Tool',
  }
];

const PracticeHub = () => {
  const categorizedItems = practiceItems.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {} as Record<PracticeItem['type'], PracticeItem[]>);

  return (
    <div className="relative w-full bg-[color:var(--blueprint-bg)] text-[color:var(--blueprint-foreground)] overflow-hidden">
      <div className="absolute inset-0 hero-gradient opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050B1A]/60 to-[#050B1A]" />

      <div className="relative z-10 container mx-auto px-6 py-16">
        <div className="glass-card glow-border px-8 py-10 mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Practice Hub</h1>
          <p className="text-lg text-[color:var(--blueprint-foreground)]/75 max-w-2xl mx-auto">
            Sharpen your SystemVerilog & UVM skills with immersive exercises, visualizations, and tools.
          </p>
        </div>

        {Object.entries(categorizedItems).map(([category, items]) => (
          <section key={category} className="mb-14">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-semibold text-[color:var(--blueprint-accent)]">{category}</h2>
              <div className="neon-divider w-40" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <Link href={item.href} key={item.href} className="group">
                  <Card className="h-full px-6 py-8 transition-transform duration-300 group-hover:-translate-y-1">
                    <CardHeader className="p-0 mb-4">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-[color:var(--blueprint-foreground)] group-hover:text-[color:var(--blueprint-accent)]">{item.title}</CardTitle>
                        <span className="text-xs uppercase tracking-widest text-[color:var(--blueprint-foreground)]/50">{item.type}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <p className="text-sm text-[color:var(--blueprint-foreground)]/70">{item.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default PracticeHub;
