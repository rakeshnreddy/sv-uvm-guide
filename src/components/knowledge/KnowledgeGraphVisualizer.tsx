'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getFullKnowledgeGraph, KnowledgeGraphData, ConceptNode, RelationshipEdge } from '@/lib/knowledge-graph-engine';

// Extend D3's Node and Link interfaces for our data
interface D3Node extends d3.SimulationNodeDatum, ConceptNode {}
interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  type: RelationshipEdge['type'];
}

const KnowledgeGraphVisualizer = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getFullKnowledgeGraph().then(data => {
      const rootNode: ConceptNode = { id: 'root', name: 'UVM & SV', description: 'Root', tier: 'Foundational' };
      const nodes = [rootNode, ...data.nodes];
      const edges = data.nodes.map(node => ({
        source: 'root',
        target: node.id,
        type: 'RELATED' as const
      }));
      setGraphData({ nodes, edges: [...data.edges, ...edges] });
    });
  }, []);

  useEffect(() => {
    if (graphData && svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const width = parseInt(svg.style('width'));
      const height = parseInt(svg.style('height'));

      const nodes: D3Node[] = JSON.parse(JSON.stringify(graphData.nodes));
      const links: D3Link[] = JSON.parse(JSON.stringify(graphData.edges));

      const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(30));

      const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .join("line");

      const node = svg.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .call(drag(simulation) as any);

      const circles = node.append("circle")
        .attr("r", 20)
        .attr("stroke-width", 1.5);

      const labels = node.append("text")
        .attr("x", 24)
        .attr("y", "0.31em")
        .text((d: any) => d.name)
        .attr("font-size", "12px");

      // Highlighting logic based on search term
      const lowercasedSearch = searchTerm.toLowerCase();
      const isSearching = lowercasedSearch.trim() !== '';

      const searchMatchIds = new Set(
        isSearching ? nodes.filter(n => n.name.toLowerCase().includes(lowercasedSearch)).map(n => n.id) : []
      );

      node.attr('opacity', d => {
        if (!isSearching) return 1;
        return searchMatchIds.has(d.id) ? 1 : 0.2;
      });

      link
        .attr("stroke", "#999")
        .attr("stroke-opacity", d => {
            if (!isSearching) return 0.6;
            const sourceMatch = searchMatchIds.has((d.source as D3Node).id);
            const targetMatch = searchMatchIds.has((d.target as D3Node).id);
            return sourceMatch && targetMatch ? 1 : 0.2;
        })
        .attr("stroke-width", d => Math.sqrt(d.strength || 1));

      circles
        .attr("stroke", d => isSearching && searchMatchIds.has(d.id) ? '#ef4444' : '#fff') // red-500 for highlight
        .attr("fill", (d: any) => {
          if (d.id === 'root') return '#fde047';
          switch(d.tier) {
            case 'Foundational': return '#60a5fa';
            case 'Intermediate': return '#4ade80';
            case 'Advanced': return '#f87171';
            case 'Expert': return '#c084fc';
            default: return '#a3a3a3';
          }
        });

      labels.attr("fill", "#333");

      simulation.on("tick", () => {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);
        node
          .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      });

      function drag(simulation: d3.Simulation<D3Node, D3Link>) {
        function dragstarted(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }
        function dragged(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
          d.fx = event.x;
          d.fy = event.y;
        }
        function dragended(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
        return d3.drag<SVGGElement, D3Node>().on("start", dragstarted).on("drag", dragged).on("end", dragended);
      }
    }
  }, [graphData, searchTerm]);

  return (
    <div className="p-4 border rounded-lg bg-white shadow-lg">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4">
        <div>
            <h2 className="text-2xl font-bold text-center md:text-left">Knowledge Graph Visualizer</h2>
            <p className="text-gray-600 text-center md:text-left">
                An interactive map of SystemVerilog and UVM concepts.
            </p>
        </div>
        <div className="mt-4 md:mt-0">
            <input
                type="text"
                placeholder="Search concepts..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
        </div>
      </div>
      <div className="w-full h-[600px] bg-gray-50 rounded-md">
        <svg ref={svgRef} width="100%" height="100%"></svg>
      </div>
    </div>
  );
};

export default KnowledgeGraphVisualizer;
