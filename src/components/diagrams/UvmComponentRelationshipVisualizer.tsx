"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { uvmComponents, uvmConnections } from './uvm-data-model';
import { Button } from '@/components/ui/Button';

const connectionTypes = [...new Set(uvmConnections.map(c => c.type))];

const UvmComponentRelationshipVisualizer = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(connectionTypes);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const filteredLinks = uvmConnections.filter(c => activeFilters.includes(c.type));
  const degreeMap = new Map<string, number>();
  filteredLinks.forEach(l => {
    degreeMap.set(l.source, (degreeMap.get(l.source) || 0) + 1);
    degreeMap.set(l.target, (degreeMap.get(l.target) || 0) + 1);
  });

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 600;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .html(''); // Clear previous contents

    const nodes: (d3.SimulationNodeDatum & { id: string; name: string; type: string; })[] = uvmComponents.map(c => ({ ...c }));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(filteredLinks).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(filteredLinks)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.type === 'parent_child' ? 3 : 1))
      .attr('stroke', d => (selectedNode && ((d.source as any).id === selectedNode || (d.target as any).id === selectedNode)) ? 'hsl(var(--info))' : '#999');

    const node = svg.append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 20)
      .attr('fill', d => d.id === selectedNode ? 'hsl(var(--info))' : 'hsl(var(--primary))')
      .on('click', (_, d) => setSelectedNode(selectedNode === d.id ? null : d.id))
      .call(drag(simulation) as any);

    const labels = svg.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes)
      .enter().append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style('fill', 'hsl(var(--primary-foreground))')
      .style('font-size', '10px')
      .text(d => d.name)
      .call(drag(simulation) as any);

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);

      labels
        .attr('x', d => d.x!)
        .attr('y', d => d.y!);
    });

    function drag(simulation: d3.Simulation<any, any>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }

  }, [filteredLinks, selectedNode]);

  const handleFilterChange = (type: string) => {
    setActiveFilters(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-bold mb-2">UVM Component Relationship Visualizer</h2>
      <div className="flex flex-wrap gap-2 mb-2">
        {connectionTypes.map(type => (
          <Button
            key={type}
            variant={activeFilters.includes(type) ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange(type)}
          >
            {type}
          </Button>
        ))}
      </div>
      <p className="text-sm mb-2">
        Nodes: {uvmComponents.length} | Relationships: {filteredLinks.length}
        {selectedNode && ` | ${selectedNode} connections: ${degreeMap.get(selectedNode) || 0}`}
      </p>
      <svg ref={svgRef} className="w-full h-auto" />
    </div>
  );
};

export default UvmComponentRelationshipVisualizer;
