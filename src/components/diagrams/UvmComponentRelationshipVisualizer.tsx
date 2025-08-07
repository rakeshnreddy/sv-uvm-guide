"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { uvmComponents, uvmConnections } from './uvm-data-model';
import { Button } from '@/components/ui/Button';

const connectionTypes = [...new Set(uvmConnections.map(c => c.type))];

const UvmComponentRelationshipVisualizer = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(connectionTypes);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [path, setPath] = useState<string[]>([]);
  const [isolatedNode, setIsolatedNode] = useState<string | null>(null);

  const baseLinks = uvmConnections.filter(c => activeFilters.includes(c.type));
  let nodesFiltered = uvmComponents;
  let linksFiltered = baseLinks;
  if (isolatedNode) {
    const neighborIds = new Set<string>([isolatedNode]);
    baseLinks.forEach(l => {
      if (l.source === isolatedNode) neighborIds.add(l.target);
      if (l.target === isolatedNode) neighborIds.add(l.source);
    });
    nodesFiltered = uvmComponents.filter(n => neighborIds.has(n.id));
    linksFiltered = baseLinks.filter(l => neighborIds.has(l.source) && neighborIds.has(l.target));
  }

  const nodeMetrics = new Map<string, { in: number; out: number; types: Record<string, number> }>();
  linksFiltered.forEach(l => {
    const src = nodeMetrics.get(l.source) || { in: 0, out: 0, types: {} as Record<string, number> };
    src.out++;
    src.types[l.type] = (src.types[l.type] || 0) + 1;
    nodeMetrics.set(l.source, src);
    const tgt = nodeMetrics.get(l.target) || { in: 0, out: 0, types: {} as Record<string, number> };
    tgt.in++;
    tgt.types[l.type] = (tgt.types[l.type] || 0) + 1;
    nodeMetrics.set(l.target, tgt);
  });

  const nodes: (d3.SimulationNodeDatum & {
    id: string;
    name: string;
    type: string;
    description: string;
    parent?: string;
    children?: string[];
  })[] = nodesFiltered.map(c => ({ ...c }));
  const links = linksFiltered.map(l => ({ ...l }));

  const findPath = (start: string, end: string): string[] => {
    const queue: string[] = [start];
    const visited = new Set<string>([start]);
    const parent = new Map<string, string>();

    const adj = new Map<string, string[]>();
    linksFiltered.forEach(l => {
      adj.set(l.source, [...(adj.get(l.source) || []), l.target]);
      adj.set(l.target, [...(adj.get(l.target) || []), l.source]);
    });

    while (queue.length) {
      const node = queue.shift()!;
      if (node === end) break;
      for (const n of Array.from(adj.get(node) || [])) {
        if (!visited.has(n)) {
          visited.add(n);
          parent.set(n, node);
          queue.push(n);
        }
      }
    }

    if (start !== end && !parent.has(end)) return [];
    const result = [end];
    let cur = end;
    while (cur !== start) {
      const p = parent.get(cur);
      if (!p) break;
      result.unshift(p);
      cur = p;
    }
    return result;
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 600;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .html('');

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => (d.type === 'composition' ? 3 : 1))
      .attr('stroke-dasharray', d => d.type === 'inheritance' ? '4 2' : null)
      .attr('stroke', d => {
        const sid = (d.source as any).id;
        const tid = (d.target as any).id;
        const inPath = path.includes(sid) && path.includes(tid) && Math.abs(path.indexOf(sid) - path.indexOf(tid)) === 1;
        const selected = selectedNodes.includes(sid) || selectedNodes.includes(tid);
        if (inPath || selected) return 'hsl(var(--info))';
        if (d.type === 'analysis') return 'hsl(var(--warning))';
        if (d.type === 'seq_item') return 'hsl(var(--muted))';
        if (d.type === 'inheritance') return '#555';
        return '#999';
      })
      .attr('class', d => {
        const sid = (d.source as any).id;
        const tid = (d.target as any).id;
        const inPath = path.includes(sid) && path.includes(tid) && Math.abs(path.indexOf(sid) - path.indexOf(tid)) === 1;
        return inPath ? 'message-path' : null;
      });

    const node = svg.append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 20)
      .attr('fill', d => selectedNodes.includes(d.id) ? 'hsl(var(--info))' : 'hsl(var(--primary))')
      .on('click', (_, d) => {
        setSelectedNodes(prev => {
          if (prev.length === 0) return [d.id];
          if (prev.length === 1) {
            if (prev[0] === d.id) return [];
            const newSel = [prev[0], d.id];
            setPath(findPath(newSel[0], newSel[1]));
            return newSel;
          }
          return [d.id];
        });
      })
      .call(drag(simulation) as any);

    node.append('title')
      .text(d => {
        const m = nodeMetrics.get(d.id) || { in: 0, out: 0, types: {} };
        const types = Object.entries(m.types).map(([t, c]) => `${t}:${c}`).join(', ');
        return `${d.name}\nIn: ${m.in} Out: ${m.out}\n${types}`;
      });

    const labels = svg.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
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

  }, [links, nodes, selectedNodes, path, nodeMetrics]);

  useEffect(() => {
    if (selectedNodes.length !== 1) setIsolatedNode(null);
  }, [selectedNodes]);

  const handleFilterChange = (type: string) => {
    setActiveFilters(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleIsolation = () => {
    if (selectedNodes.length === 1) {
      setIsolatedNode(prev => prev === selectedNodes[0] ? null : selectedNodes[0]);
    }
  };

  const selectedMetrics = selectedNodes.length === 1 ? nodeMetrics.get(selectedNodes[0]) : null;

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
        {selectedNodes.length === 1 && (
          <Button
            variant={isolatedNode ? 'destructive' : 'secondary'}
            size="sm"
            onClick={toggleIsolation}
          >
            {isolatedNode ? 'Show All' : 'Isolate'}
          </Button>
        )}
      </div>
      <p className="text-sm mb-2">
        Nodes: {nodes.length} | Relationships: {links.length}
        {selectedMetrics && (
          <> | In: {selectedMetrics.in} Out: {selectedMetrics.out} | {
            Object.entries(selectedMetrics.types).map(([t, c]) => `${t}:${c}`).join(', ')
          }</>
        )}
        {selectedNodes.length === 2 && path.length > 0 && ` | Path length: ${path.length - 1}`}
      </p>
      <svg ref={svgRef} className="w-full h-auto" />
      <style>{`
        .message-path {
          stroke-dasharray: 5 5;
          animation: dash 1s linear infinite;
        }
        @keyframes dash {
          to { stroke-dashoffset: -10; }
        }
      `}</style>
    </div>
  );
};

export default UvmComponentRelationshipVisualizer;
