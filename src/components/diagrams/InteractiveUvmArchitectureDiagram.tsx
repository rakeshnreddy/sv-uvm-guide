"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { select } from 'd3-selection';
import { stratify, tree } from 'd3-hierarchy';
import { linkVertical } from 'd3-shape';
import { zoomIdentity, ZoomBehavior } from 'd3-zoom';
import 'd3-transition';
import { motion } from 'framer-motion';
import type { UvmComponent } from './uvm-data-model';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useZoomPan } from '@/hooks/useZoomPan';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import useAsync from '@/hooks/useAsync';
import useLazyRender from '@/hooks/useLazyRender';
import useAccessibility from '@/hooks/useAccessibility';
import { exportSvgAsPng, exportSvgAsPdf } from '@/lib/exportUtils';
import { useTheme } from 'next-themes';
import { useLocale } from '@/hooks/useLocale';



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
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const { theme, setTheme } = useTheme();
  const [activeComponent, setActiveComponent] = useState<UvmComponent | null>(null);
  const [highlightedType, setHighlightedType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<UvmComponent[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);
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

  const { locale } = useLocale();


  const { data: model, loading, error } = useAsync(() => import('./uvm-data-model'));
  const visible = useLazyRender(containerRef);
  useAccessibility(svgRef, 'Interactive UVM architecture diagram', { svg: false });

    const uvmComponentsList = useMemo(() => model?.uvmComponents ?? [], [model]);
    const uvmConnectionsList = useMemo(() => model?.uvmConnections ?? [], [model]);
    const compositionalComponents = useMemo(
      () => uvmComponentsList.filter(c => c.type !== 'uvm_class'),
      [uvmComponentsList]
    );
    const componentTypes = useMemo(
      () => [...new Set(compositionalComponents.map(c => c.type.split('_')[0]))],
      [compositionalComponents]
    );

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
      setHighlightIndex(0);
      setSelectedComponent(null);
    }
  };

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setHighlightIndex(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setHighlightIndex(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex]);
    }
  };

  const handleSelect = (component: UvmComponent) => {
    setSearchTerm(component.name);
    setSuggestions([]);
    setSelectedComponent(component);
    zoomToComponent(component.id);
  };

  const resetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomRef.current.transform, zoomIdentity);
    }
  };

  const zoomToComponent = useCallback((id: string) => {
    if (!svgRef.current || !zoomRef.current) return;
    const pos = nodePositionsRef.current.get(id);
    if (!pos) return;
    const width = 850;
    const height = 650;
    const scale = 1.5;
    const transform = zoomIdentity
      .translate(width / 2 - pos.y * scale, height / 2 - pos.x * scale)
      .scale(scale);
    select(svgRef.current)
      .transition()
      .duration(750)
      .call(zoomRef.current.transform, transform);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportPng = useCallback(() => {
    if (svgRef.current) {
      exportSvgAsPng(svgRef.current, 'uvm-architecture');
    }
  }, []);

  const handleExportPdf = useCallback(() => {
    if (svgRef.current) {
      exportSvgAsPdf(svgRef.current, 'uvm-architecture');
    }
  }, []);

  const toggleTheme = () => {
    if (!theme) return;
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useZoomPan(svgRef, zoomRef);


  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'e') {
        e.preventDefault();
        handleExportPng();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'e') {
        e.preventDefault();
        handleExportPdf();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleExportPng, handleExportPdf]);

  useEffect(() => {
    if (!visible || !svgRef.current || !model) return;

    const width = 850;
    const height = 650;

    const svg = select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .html(''); // Clear previous contents

    const root = stratify<UvmComponent>()
      .id(d => d.id)
      .parentId(d => d.parent)
      (compositionalComponents);

    const treeLayout = tree<UvmComponent>().size([height - 100, width - 250]);
    const treeData = treeLayout(root);

    const g = svg.append('g').attr('transform', 'translate(125, 50)');

    nodePositionsRef.current.clear();
    const nodePositions = nodePositionsRef.current;

    const controlLayer = g.append('g').attr('class', 'control-layer');
    const nodeLayer = g.append('g').attr('class', 'node-layer');
    const dataLayer = g.append('g').attr('class', 'data-flow-layer');

    if (showControlFlow) {
      const links = treeData.links().filter(l => {
        const s = l.source.data.type.split('_')[0] as keyof typeof layers;
        const t = l.target.data.type.split('_')[0] as keyof typeof layers;
        return layers[s] && layers[t];
      });
      controlLayer.selectAll('.link')
        .data(links)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', linkVertical()
          .x(d => (d as any).y)
          .y(d => (d as any).x) as any
        )
        .attr('stroke', 'hsl(var(--muted-foreground))')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 2')
        .attr('fill', 'none')
        .attr('pointer-events', 'none')
        .append('title')
        .text(d => `${(d.source as any).data.name} → ${(d.target as any).data.name}`);
    }

    const nodes = nodeLayer.selectAll('.node')
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
      .on('mouseover', (_, d) => setActiveComponent(d.data))
      .on('mouseout', () => setActiveComponent(null))
      .on('focus', (_, d) => setActiveComponent(d.data))
      .on('blur', () => setActiveComponent(null));

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
      })
      .append('title')
      .text(d => d.data.description);

    nodes.append('text')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .style('fill', 'hsl(var(--primary-foreground))')
      .text(d => d.data.name);

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

        const flows = uvmConnectionsList.filter(c => {
          if (c.type === 'composition') return false;
          const s = uvmComponentsList.find(x => x.id === c.source)!;
          const t = uvmComponentsList.find(x => x.id === c.target)!;
        const sType = s.type.split('_')[0] as keyof typeof layers;
        const tType = t.type.split('_')[0] as keyof typeof layers;
        return layers[sType] && layers[tType] && nodePositions.has(c.source) && nodePositions.has(c.target);
      });

      dataLayer.selectAll('.flow')
        .data(flows)
        .enter()
        .append('path')
        .attr('class', 'flow')
        .attr('d', d => {
          const s = nodePositions.get(d.source);
          const t = nodePositions.get(d.target);
          if (!s || !t) return '';
          const midY = (s.y + t.y) / 2;
          return `M${s.y},${s.x} C${midY},${s.x} ${midY},${t.x} ${t.y},${t.x}`;
        })
        .attr('stroke', d => d.type === 'analysis' ? 'hsl(var(--warning))' : 'hsl(var(--info))')
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('marker-end', 'url(#arrow)')
        .attr('pointer-events', 'none')
        .append('title')
        .text(d => d.description);
    }


  }, [highlightedType, searchTerm, showDataFlow, showControlFlow, layers, selectedComponent, visible, model, compositionalComponents, uvmConnectionsList, uvmComponentsList]);

  if (loading || !visible) {
    return <div ref={containerRef}>Loading diagram...</div>;
  }

  if (error || !model) {
    return <div ref={containerRef}>Error loading diagram</div>;
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="absolute top-2 left-2 flex flex-wrap gap-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg">
        <div className="relative">
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="Search components... (press /)"
            className="w-48"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKey}
          />
          {suggestions.length > 0 && (
            <ul className="absolute top-full left-0 mt-1 w-48 bg-background border rounded-md shadow z-10 max-h-40 overflow-auto">
              {suggestions.map((s, idx) => (
                <li
                  key={s.id}
                  className={`p-1 cursor-pointer ${idx === highlightIndex ? 'bg-muted' : 'hover:bg-muted'}`}
                  onMouseDown={() => handleSelect(s)}
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
        <Button variant="outline" size="sm" onClick={handleExportPng} aria-label="Export as PNG">
          Export PNG
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf} aria-label="Export as PDF">
          Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
          Toggle Theme
        </Button>
      </div>
      <svg ref={svgRef} className="w-full h-auto touch-none" />
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
