"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { uvmComponents, uvmConnections, UvmComponent } from './uvm-data-model';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useZoomPan } from '@/hooks/useZoomPan';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { exportSvg } from '@/lib/exportUtils';

const compositionalComponents = uvmComponents.filter(c => c.type !== 'uvm_class');

const componentTypes = [...new Set(compositionalComponents.map(c => c.type.split('_')[0]))];

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

type ComponentColorKey = keyof typeof componentColor;

const InteractiveUvmArchitectureDiagram = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [activeComponent, setActiveComponent] = useState<UvmComponent | null>(null);
  const [highlightedType, setHighlightedType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<UvmComponent[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<UvmComponent | null>(null);
  const [showDataFlow, setShowDataFlow] = useState(true);
  const [showControlFlow, setShowControlFlow] = useState(true);
  const [layers, setLayers] = useState({
    test: true,
    env: true,
    agent: true,
    driver: true,
    monitor: true,
  });

  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value === '') {
      setSuggestions([]);
      setSelectedComponent(null);
    } else {
      const matches = compositionalComponents.filter(c => c.name.toLowerCase().includes(value.toLowerCase()));
      setSuggestions(matches);
      setSelectedComponent(null);
    }
  };

  const handleSelect = (component: UvmComponent) => {
    setSearchTerm(component.name);
    setSuggestions([]);
    setSelectedComponent(component);
  };

  const resetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = useCallback(() => {
    if (svgRef.current) {
      exportSvg(svgRef.current, 'uvm-architecture');
    }
  }, []);

  useZoomPan(svgRef);
  useKeyboardNavigation(svgRef as unknown as React.RefObject<HTMLElement | SVGSVGElement>);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExport();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleExport]);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 850;
    const height = 650;

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('tabindex', 0)
      .attr('aria-label', 'Interactive UVM architecture diagram')
      .html(''); // Clear previous contents

    const root = d3.stratify<UvmComponent>()
      .id(d => d.id)
      .parentId(d => d.parent)
      (compositionalComponents);

    const treeLayout = d3.tree<UvmComponent>().size([height - 100, width - 250]);
    const treeData = treeLayout(root);

    const g = svg.append('g').attr('transform', 'translate(125, 50)');

    const nodePositions = new Map<string, { x: number; y: number }>();

    // Control Flow Links
    if (showControlFlow) {
      const links = treeData.links().filter(l => {
        const s = l.source.data.type.split('_')[0] as keyof typeof layers;
        const t = l.target.data.type.split('_')[0] as keyof typeof layers;
        return layers[s] && layers[t];
      });
      g.selectAll('.link')
        .data(links)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d3.linkVertical()
          .x(d => (d as any).y)
          .y(d => (d as any).x) as any
        )
        .attr('stroke', 'hsl(var(--muted-foreground))')
        .attr('stroke-width', 1.5)
        .attr('fill', 'none');
    }

    // Nodes
    const nodes = g.selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('tabindex', 0)
      .attr('data-focusable', true)
      .attr('aria-label', d => d.data.name)
      .attr('transform', d => {
        nodePositions.set(d.data.id, { x: d.x, y: d.y });
        return `translate(${d.y},${d.x})`;
      })
      .style('display', d => layers[d.data.type.split('_')[0] as keyof typeof layers] ? null : 'none')
      .on('mouseover', (event, d) => {
        setActiveComponent(d.data);
      })
      .on('mouseout', () => {
        setActiveComponent(null);
      })
      .on('focus', (_, d) => {
        setActiveComponent(d.data);
      })
      .on('blur', () => {
        setActiveComponent(null);
      });

    nodes.append('rect')
      .attr('width', 150)
      .attr('height', 60)
      .attr('x', -75)
      .attr('y', -30)
      .attr('rx', 5)
      .attr('fill', d => {
        const type = d.data.type.split('_')[0] as ComponentColorKey;
        return componentColor[type] || componentColor.default;
      })
      .attr('stroke', 'hsl(var(--primary))')
      .attr('stroke-width', d => selectedComponent && d.data.id === selectedComponent.id ? 3 : 1)
      .style('opacity', d => {
        const typeMatch = highlightedType === null || d.data.type.startsWith(highlightedType);
        const searchMatch = searchTerm === '' || d.data.name.toLowerCase().includes(searchTerm.toLowerCase());
        const selectedMatch = !selectedComponent || d.data.id === selectedComponent.id;
        return typeMatch && searchMatch && selectedMatch ? 1 : 0.2;
      });

    nodes.append('text')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .style('fill', 'hsl(var(--primary-foreground))')
      .text(d => d.data.name);

    // Data flow connections
    if (showDataFlow) {
      const defs = svg.append('defs');
      defs.append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', 'hsl(var(--muted-foreground))');

      const flows = uvmConnections.filter(c => c.type !== 'composition' && nodePositions.has(c.source) && nodePositions.has(c.target));

      g.selectAll('.flow')
        .data(flows)
        .enter()
        .append('path')
        .attr('class', 'flow')
        .attr('d', d => {
          const s = nodePositions.get(d.source)!;
          const t = nodePositions.get(d.target)!;
          const midY = (s.y + t.y) / 2;
          return `M${s.y},${s.x} C${midY},${s.x} ${midY},${t.x} ${t.y},${t.x}`;
        })
        .attr('stroke', d => d.type === 'analysis' ? 'hsl(var(--warning))' : 'hsl(var(--info))')
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('marker-end', 'url(#arrow)');
    }


  }, [highlightedType, searchTerm, showDataFlow, showControlFlow]);


  return (
    <div className="relative">
      <div className="absolute top-2 left-2 flex flex-wrap gap-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg">
        <div className="relative">
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="Search components... (press /)"
            className="w-48"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          {suggestions.length > 0 && (
            <ul className="absolute top-full left-0 mt-1 w-48 bg-background border rounded-md shadow z-10 max-h-40 overflow-auto">
              {suggestions.map(s => (
                <li
                  key={s.id}
                  className="p-1 cursor-pointer hover:bg-muted"
                  onClick={() => handleSelect(s)}
                >
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>
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
        {(['test','env','agent','driver','monitor'] as const).map(layer => (
          <Button
            key={layer}
            variant={layers[layer] ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleLayer(layer)}
          >
            {layer}
          </Button>
        ))}
        <Button
          variant={showDataFlow ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowDataFlow(!showDataFlow)}
        >
          Data Flow
        </Button>
        <Button
          variant={showControlFlow ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowControlFlow(!showControlFlow)}
        >
          Control Flow
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          Export
        </Button>
      </div>
      <svg
        ref={svgRef}
        className="w-full h-auto touch-none"
        tabIndex={0}
        aria-label="Interactive UVM architecture diagram"
        role="img"
      />
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
