"use client";

import React, { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { lineRadial } from 'd3-shape';

interface Skill {
  skill: string;
  level: number; // 0-100
}

const mockSkills: Skill[] = [
  { skill: 'SystemVerilog Syntax', level: 85 },
  { skill: 'UVM Basics', level: 70 },
  { skill: 'Verification Planning', level: 60 },
  { skill: 'Advanced UVM', level: 45 },
  { skill: 'Functional Coverage', level: 75 },
  { skill: 'Assertions', level: 80 },
];

export const SkillMatrixVisualizer = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    const width = 400;
    const height = 400;
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const radius = Math.min(chartWidth, chartHeight) / 2;
    const numSkills = mockSkills.length;
    const angleSlice = (Math.PI * 2) / numSkills;

    // Clear previous render
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

    const rScale = scaleLinear().range([0, radius]).domain([0, 100]);

    // Draw grid lines (cobweb)
    const gridLevels = [25, 50, 75, 100];
    g.selectAll('.grid-circle')
      .data(gridLevels)
      .enter()
      .append('circle')
      .attr('class', 'grid-circle')
      .attr('r', d => rScale(d))
      .style('fill', 'none')
      .style('stroke', 'rgba(255, 255, 255, 0.3)');

    // Draw axes
    const axes = g.selectAll('.axis')
      .data(mockSkills)
      .enter()
      .append('g')
      .attr('class', 'axis');

    axes.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', (d, i) => rScale(100) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr('y2', (d, i) => rScale(100) * Math.sin(angleSlice * i - Math.PI / 2))
      .style('stroke', 'rgba(255, 255, 255, 0.5)')
      .style('stroke-width', '1px');

    // Add labels
    axes.append('text')
      .attr('class', 'legend')
      .style('font-size', '11px')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('x', (d, i) => rScale(110) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr('y', (d, i) => rScale(110) * Math.sin(angleSlice * i - Math.PI / 2))
      .text(d => d.skill)
      .style('fill', 'rgba(255, 255, 255, 0.8)');

    // Draw the data shape
    const radarLine = lineRadial<Skill>()
      .radius(d => rScale(d.level))
      .angle((d, i) => i * angleSlice);

    const radarData = [...mockSkills, mockSkills[0]]; // Close the loop

    g.append('path')
      .datum(radarData)
      .attr('d', radarLine)
      .style('fill', 'rgba(59, 130, 246, 0.5)')
      .style('stroke', 'rgba(59, 130, 246, 1)')
      .style('stroke-width', '2px');

  }, []);

  return (
    <div className="p-4 border border-dashed border-white/30 rounded-lg my-6 bg-white/5">
      <h2 className="text-2xl font-bold text-primary mb-4">Skill Matrix Visualizer</h2>
      <p className="text-foreground/80 mb-4">
        This radar chart visualizes your current skill levels across key areas.
      </p>
      <div className="flex justify-center">
        <svg ref={svgRef} width="400" height="400"></svg>
      </div>
    </div>
  );
};

export default SkillMatrixVisualizer;
