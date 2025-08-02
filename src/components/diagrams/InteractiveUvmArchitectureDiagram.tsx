"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { uvmComponents, uvmConnections, UvmComponent, UvmConnection } from './uvm-data-model';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const componentTypes = [...new Set(uvmComponents.map(c => c.type.split('_')[0]))];

const componentColor = {
  test: 'hsl(var(--primary))',
  env: 'hsl(var(--secondary))',
  agent: 'hsl(var(--accent))',
  sequencer: 'hsl(var(--info))',
  driver: 'hsl(var(--success))',
  monitor: 'hsl(var(--warning))',
  scoreboard: 'hsl(var(--danger))',
  dut: 'hsl(var(--foreground))',
  default: 'hsl(var(--muted))',
};

const InteractiveUvmArchitectureDiagram = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeComponent, setActiveComponent] = useState<UvmComponent | null>(null);
  const [highlightedType, setHighlightedType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 850;
    const height = 650;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .html(''); // Clear previous contents

    const root = d3.stratify<UvmComponent>()
      .id(d => d.id)
      .parentId(d => uvmComponents.find(c => c.id === d.id)?.parent)
      (uvmComponents);

    const treeLayout = d3.tree<UvmComponent>().size([height - 100, width - 250]);
    const treeData = treeLayout(root);

    const g = svg.append('g').attr('transform', 'translate(125, 50)');

    // Links
    g.selectAll('.link')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkVertical()
        .x(d => (d as any).y)
        .y(d => (d as any).x)
      )
      .attr('stroke', 'hsl(var(--muted-foreground))')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none');

    // Nodes
    const nodes = g.selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .on('mouseover', (event, d) => {
        setActiveComponent(d.data);
      })
      .on('mouseout', () => {
        setActiveComponent(null);
      });

    nodes.append('rect')
      .attr('width', 150)
      .attr('height', 60)
      .attr('x', -75)
      .attr('y', -30)
      .attr('rx', 5)
      .attr('fill', d => componentColor[d.data.type.split('_')[0]] || componentColor.default)
      .attr('stroke', 'hsl(var(--primary))')
      .attr('stroke-width', 1)
      .style('opacity', d => {
        const typeMatch = highlightedType === null || d.data.type.startsWith(highlightedType);
        const searchMatch = searchTerm === '' || d.data.name.toLowerCase().includes(searchTerm.toLowerCase());
        return typeMatch && searchMatch ? 1 : 0.2;
      });

    nodes.append('text')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .style('fill', 'hsl(var(--primary-foreground))')
      .text(d => d.data.name);

    // Zoom functionality
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

  }, [highlightedType, searchTerm]);

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 flex flex-wrap gap-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg">
        <Input
          type="search"
          placeholder="Search components..."
          className="w-48"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {componentTypes.map(type => (
          <Button
            key={type}
            variant={highlightedType === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => setHighlightedType(highlightedType === type ? null : type)}
          >
            {type}
          </Button>
        ))}
      </div>
      <svg ref={svgRef} className="w-full h-auto" />
      {activeComponent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border rounded-b-lg shadow-lg"
        >
          <h3 className="font-bold text-primary">{activeComponent.name} ({activeComponent.type})</h3>
          <p className="text-sm text-muted-foreground">{activeComponent.description}</p>
        </motion.div>
      )}
      <div className="absolute bottom-2 right-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg text-xs">
        <h4 className="font-bold mb-1">Legend</h4>
        {Object.entries(componentColor).map(([type, color]) => (
          <div key={type} className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }} />
            <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InteractiveUvmArchitectureDiagram;
