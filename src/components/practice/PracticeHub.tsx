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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-primary mb-4">Practice Hub</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Sharpen your SystemVerilog and UVM skills with hands-on exercises, interactive visualizations, and tools.
      </p>

      {Object.entries(categorizedItems).map(([category, items]) => (
        <section key={category} className="mb-12">
          <h2 className="text-2xl font-semibold text-accent mb-4 pb-2 border-b border-border">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <Link href={item.href} key={item.href} className="group">
                <Card className="h-full transition-all duration-300 hover:shadow-lg hover:border-primary">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="group-hover:text-primary">{item.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default PracticeHub;
