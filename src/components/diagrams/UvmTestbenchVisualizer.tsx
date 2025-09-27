'use client';

import React, { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  SimulationNodeDatum,
} from 'd3-force';
import { uvmComponents, uvmConnections } from './uvm-data-model';
import { UvmComponent } from './uvm-data-model';

const UvmTestbenchVisualizer = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = select(svgRef.current);
    // Clear previous renders
    svg.selectAll('*').remove();

    // 1. Set up a force simulation
    const simulation = forceSimulation(uvmComponents as SimulationNodeDatum[])
      .force('link', forceLink(uvmConnections).id(d => (d as UvmComponent).id).distance(100))
      .force('charge', forceManyBody().strength(-300))
      .force('center', forceCenter(width / 2, height / 2));

    // 2. Create links (lines)
    const link = svg.append('g')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(uvmConnections)
      .join('line')
      .attr('stroke', d => {
        if (d.type === 'analysis') return '#2ecc71';
        if (d.type === 'seq_item') return '#3498db';
        return '#999';
      })
      .attr('stroke-width', d => d.type === 'seq_item' ? 2.5 : 1.5)
      .attr('stroke-dasharray', d => d.type === 'analysis' ? '5,5' : 'none');

    // 3. Create nodes (groups of rect + text)
    const node = svg.append('g')
      .selectAll('g')
      .data(uvmComponents)
      .join('g');

    node.append('rect')
      .attr('width', 140)
      .attr('height', 40)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', '#f0f0f0')
      .attr('stroke', '#333');

    node.append('text')
      .text(d => d.name)
      .attr('x', 70)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#000');

    // 4. Update positions on each 'tick' of the simulation
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node.attr('transform', d => `translate(${(d as any).x - 70}, ${(d as any).y - 20})`);
    });

  }, []);

  return <svg ref={svgRef} width="100%" height="600px" style={{ border: '1px solid #ccc' }} />;
};

export default UvmTestbenchVisualizer;
