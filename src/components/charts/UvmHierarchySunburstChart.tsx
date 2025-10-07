"use client";

import React, { useMemo } from "react";
import { hierarchy, partition, type HierarchyRectangularNode } from "d3-hierarchy";
import { arc as d3Arc } from "d3-shape";
import { scaleOrdinal } from "d3-scale";

type SunburstNode = {
  name: string;
  value: number;
  description?: string;
  children?: SunburstNode[];
};

const uvmHierarchyData: SunburstNode = {
  name: "uvm_object",
  value: 100,
  description: "Base class for UVM data and component classes.",
  children: [
    {
      name: "uvm_transaction",
      value: 20,
      description: "Base for transactions passed between components.",
      children: [
        {
          name: "uvm_sequence_item",
          value: 10,
          description: "Parameterized transaction used by sequences.",
        },
      ],
    },
    {
      name: "uvm_sequence_base",
      value: 20,
      description: "Base class for transaction-generating sequences.",
      children: [
        {
          name: "uvm_sequence",
          value: 10,
          description: "Parameterized sequence class controlling stimulus.",
        },
      ],
    },
    {
      name: "uvm_report_object",
      value: 60,
      description: "Adds messaging and reporting capabilities.",
      children: [
        {
          name: "uvm_component",
          value: 50,
          description: "Structural unit in the testbench phasing system.",
          children: [
            { name: "uvm_driver", value: 5, description: "Drives transactions to the DUT." },
            { name: "uvm_monitor", value: 5, description: "Observes DUT activity." },
            { name: "uvm_sequencer", value: 5, description: "Arbitrates sequence items." },
            { name: "uvm_scoreboard", value: 5, description: "Checks DUT behaviour." },
            { name: "uvm_agent", value: 10, description: "Wraps sequencer, driver, monitor." },
            { name: "uvm_env", value: 10, description: "Containers for agents and analysis." },
            { name: "uvm_test", value: 10, description: "Top-level test controller." },
          ],
        },
      ],
    },
  ],
};

const palette = scaleOrdinal<number, string>()
  .domain([0, 1, 2, 3, 4])
  .range(["#6366f1", "#0ea5e9", "#22c55e", "#f97316", "#f43f5e"]);

const chartDimensions = {
  size: 520,
  margin: 12,
};

const UvmHierarchySunburstChart: React.FC = () => {
  const { size, margin } = chartDimensions;
  const radius = size / 2 - margin;

  const nodes = useMemo(() => {
    const root = hierarchy(uvmHierarchyData)
      .sum((d) => d.value)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = partition<SunburstNode>().size([2 * Math.PI, radius])(root);
    return layout.descendants().filter((node) => node.depth > 0);
  }, [radius]);

  const arcGenerator = useMemo(
    () =>
      d3Arc<HierarchyRectangularNode<SunburstNode>>()
        .startAngle((d) => d.x0)
        .endAngle((d) => d.x1)
        .innerRadius((d) => d.y0)
        .outerRadius((d) => d.y1)
        .cornerRadius(4),
    [],
  );

  return (
    <div className="w-full" aria-label="UVM hierarchy sunburst">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="presentation">
        <title>UVM hierarchy overview</title>
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          {nodes.map((node) => {
            const path = arcGenerator(node);
            if (!path) return null;
            const color = palette(node.depth) ?? "#38bdf8";
            return (
              <path
                key={node.data.name + node.depth}
                d={path}
                fill={color}
                fillOpacity={0.85 - node.depth * 0.1}
                stroke="#0f172a"
                strokeOpacity={0.05}
              >
                <title>{`${node.data.name}: ${node.data.description ?? "UVM class."}`}</title>
              </path>
            );
          })}

          <circle r={radius * 0.28} fill="hsl(var(--background))" fillOpacity={0.9} stroke="hsl(var(--border))" strokeOpacity={0.4} />
          <text textAnchor="middle" fontSize={18} fontWeight={600} fill="currentColor" fillOpacity={0.85} dy={-4}>
            UVM Hierarchy
          </text>
          <text textAnchor="middle" fontSize={12} fill="currentColor" fillOpacity={0.6} dy={16}>
            Explore base classes and components
          </text>
        </g>
      </svg>
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: palette(1) }} /> Data & sequences</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: palette(2) }} /> Components</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: palette(3) }} /> Testbench roles</span>
      </div>
    </div>
  );
};

export default UvmHierarchySunburstChart;
