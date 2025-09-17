"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { uvmComponents, uvmConnections } from './uvm-data-model';
import { Button } from '@/components/ui/Button';

const portTypes = ['analysis', 'seq_item'];
const phaseColors: Record<string, string> = {
  build_phase: '#22c55e',
  run_phase: '#f59e0b',
  compile: '#6b7280',
};

const UvmComponentRelationshipVisualizer = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [showComposition, setShowComposition] = useState(true);
  const [showInheritance, setShowInheritance] = useState(true);
  const [showPorts, setShowPorts] = useState(true);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [path, setPath] = useState<string[]>([]);
  const [isolatedNode, setIsolatedNode] = useState<string | null>(null);

  const baseLinks = useMemo(
    () =>
      uvmConnections.filter(
        c =>
          (showComposition && c.type === 'composition') ||
          (showInheritance && c.type === 'inheritance') ||
          (showPorts && portTypes.includes(c.type))
      ),
    [showComposition, showInheritance, showPorts]
  );

  const { nodesFiltered, linksFiltered } = useMemo(() => {
    if (!isolatedNode) {
      return { nodesFiltered: uvmComponents, linksFiltered: baseLinks };
    }
    const neighborIds = new Set<string>([isolatedNode]);
    baseLinks.forEach(l => {
      if (l.source === isolatedNode) neighborIds.add(l.target);
      if (l.target === isolatedNode) neighborIds.add(l.source);
    });
    return {
      nodesFiltered: uvmComponents.filter(n => neighborIds.has(n.id)),
      linksFiltered: baseLinks.filter(
        l => neighborIds.has(l.source) && neighborIds.has(l.target)
      ),
    };
  }, [baseLinks, isolatedNode]);

  const nodeMetrics = useMemo(() => {
    const metrics = new Map<
      string,
      { in: number; out: number; types: Record<string, number>; clustering: number }
    >();
    const adjacency = new Map<string, Set<string>>();

    linksFiltered.forEach(l => {
      const src = metrics.get(l.source) || { in: 0, out: 0, types: {} as Record<string, number>, clustering: 0 };
      src.out++;
      src.types[l.type] = (src.types[l.type] || 0) + 1;
      metrics.set(l.source, src);
      const tgt = metrics.get(l.target) || { in: 0, out: 0, types: {} as Record<string, number>, clustering: 0 };
      tgt.in++;
      tgt.types[l.type] = (tgt.types[l.type] || 0) + 1;
      metrics.set(l.target, tgt);
      if (!adjacency.has(l.source)) adjacency.set(l.source, new Set());
      if (!adjacency.has(l.target)) adjacency.set(l.target, new Set());
      adjacency.get(l.source)!.add(l.target);
      adjacency.get(l.target)!.add(l.source);
    });

    adjacency.forEach((neighbors, node) => {
      const k = neighbors.size;
      let clustering = 0;
      if (k > 1) {
        let linksBetween = 0;
        const arr = Array.from(neighbors);
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            if (adjacency.get(arr[i])?.has(arr[j])) linksBetween++;
          }
        }
        clustering = linksBetween / (k * (k - 1) / 2);
      }
      const metric = metrics.get(node) || { in: 0, out: 0, types: {}, clustering: 0 };
      metric.clustering = clustering;
      metrics.set(node, metric);
    });

    return metrics;
  }, [linksFiltered]);

  const nodes: (d3.SimulationNodeDatum & {
    id: string;
    name: string;
    type: string;
    description: string;
    parent?: string;
    children?: string[];
  })[] = useMemo(() => nodesFiltered.map(c => ({ ...c })), [nodesFiltered]);

  const links = useMemo(() => {
    const phaseCount: Record<string, number> = {};
    return linksFiltered.map(l => ({
      ...l,
      order: l.phase
        ? (phaseCount[l.phase] = (phaseCount[l.phase] || 0) + 1)
        : undefined,
    }));
  }, [linksFiltered]);

  const findPath = useCallback((start: string, end: string): string[] => {
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
  }, [linksFiltered]);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 600;

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'UVM component relationships')
      .html('');

    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'context-stroke');

    const simulation = d3
      .forceSimulation(nodes)
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
        if (d.phase && phaseColors[d.phase]) return phaseColors[d.phase];
        if (d.type === 'analysis') return 'hsl(var(--warning))';
        if (d.type === 'seq_item') return 'hsl(var(--muted))';
        if (d.type === 'inheritance') return '#555';
        return '#999';
      })
      .attr('marker-end', 'url(#arrow)')
      .attr('class', d => {
        const sid = (d.source as any).id;
        const tid = (d.target as any).id;
        const inPath = path.includes(sid) && path.includes(tid) && Math.abs(path.indexOf(sid) - path.indexOf(tid)) === 1;
        return inPath ? 'message-path' : null;
      });

    link.append('title').text(d => d.description);

    const phaseLabels = svg.append('g')
      .selectAll('text')
      .data(links.filter(l => l.phase))
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('fill', '#000')
      .style('font-size', '8px')
      .text(d => `${d.phase}${d.order ? ' ' + d.order : ''}`);

    const node = svg
      .append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 20)
      .attr('fill', d =>
        selectedNodes.includes(d.id) ? 'hsl(var(--info))' : 'hsl(var(--primary))'
      )
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => d.name)
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
      .on('dblclick', (_, d) => {
        setIsolatedNode(prev => (prev === d.id ? null : d.id));
        setSelectedNodes([d.id]);
      })
      .on('keydown', (event, d) => {
        if (event.key === 'Enter') {
          event.preventDefault();
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
        }
        if (event.key === ' ') {
          event.preventDefault();
          setIsolatedNode(prev => (prev === d.id ? null : d.id));
          setSelectedNodes([d.id]);
        }
      })
      .call(drag(simulation) as any);

    node.append('title')
      .text(d => {
        const m = nodeMetrics.get(d.id) || { in: 0, out: 0, types: {}, clustering: 0 };
        const types = Object.entries(m.types).map(([t, c]) => `${t}:${c}`).join(', ');
        return `${d.name}\nIn: ${m.in} Out: ${m.out} CC: ${m.clustering.toFixed(2)}\n${types}`;
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

      phaseLabels
        .attr('x', d => ((d.source as any).x + (d.target as any).x) / 2)
        .attr('y', d => ((d.source as any).y + (d.target as any).y) / 2);
    });

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && path.length > 1) {
      let i = 0;
      const step = () => {
        if (i >= path.length - 1) return;
        const from = nodes.find(n => n.id === path[i]);
        const to = nodes.find(n => n.id === path[i + 1]);
        if (!from || !to) return;
        const circle = svg
          .append('circle')
          .attr('class', 'message-circle')
          .attr('r', 5)
          .attr('fill', 'hsl(var(--info))')
          .attr('cx', from.x || 0)
          .attr('cy', from.y || 0);
        circle
          .transition()
          .duration(800)
          .ease(d3.easeLinear)
          .attr('cx', to.x || 0)
          .attr('cy', to.y || 0)
          .on('end', () => {
            circle.remove();
            i++;
            step();
          });
      };
      step();
    }

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

  }, [links, nodes, selectedNodes, path, nodeMetrics, findPath]);

  useEffect(() => {
    if (selectedNodes.length !== 1) setIsolatedNode(null);
  }, [selectedNodes]);

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-bold mb-2">UVM Component Relationship Visualizer</h2>
      <div className="flex flex-wrap gap-2 mb-2">
        <Button
          variant={showComposition ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowComposition(v => !v)}
          aria-pressed={showComposition}
        >
          Composition
        </Button>
        <Button
          variant={showInheritance ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowInheritance(v => !v)}
          aria-pressed={showInheritance}
        >
          Inheritance
        </Button>
        <Button
          variant={showPorts ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowPorts(v => !v)}
          aria-pressed={showPorts}
        >
          Ports
        </Button>
      </div>
      <p className="text-sm mb-2">
        Nodes: {nodes.length} | Relationships: {links.length}
        {selectedNodes.length === 2 && path.length > 0 && ` | Path length: ${path.length - 1}`}
      </p>
      <svg ref={svgRef} className="w-full h-auto" />
      <div className="overflow-x-auto mt-2">
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left pr-2">Node</th>
              <th className="text-left pr-2">In</th>
              <th className="text-left pr-2">Out</th>
              <th className="text-left pr-2">CC</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map(n => {
              const m = nodeMetrics.get(n.id) || { in: 0, out: 0, clustering: 0 };
              return (
                <tr key={n.id}>
                  <td className="pr-2">{n.name}</td>
                  <td className="pr-2">{m.in}</td>
                  <td className="pr-2">{m.out}</td>
                  <td className="pr-2">{m.clustering.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <style>{`
        .message-path {
          stroke-dasharray: 5 5;
          animation: dash 1s linear infinite;
        }
        @keyframes dash {
          to { stroke-dashoffset: -10; }
        }
        @media (prefers-reduced-motion: reduce) {
          .message-path {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default UvmComponentRelationshipVisualizer;
