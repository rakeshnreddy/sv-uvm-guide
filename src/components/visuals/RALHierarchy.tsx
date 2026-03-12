'use client';

import React, { useState } from 'react';
import { Database, Layers, Binary, Grid3X3, ChevronRight, ChevronDown, BookOpen } from 'lucide-react';

interface HierarchyNode {
  id: string;
  label: string;
  className: string;
  icon: React.ReactNode;
  clause: string;
  role: string;
  apis: string[];
  children?: HierarchyNode[];
}

const hierarchy: HierarchyNode = {
  id: 'block',
  label: 'uvm_reg_block',
  className: 'top_block',
  icon: <Database size={18} />,
  clause: 'IEEE 1800.2-2020 §18.1',
  role: 'Top-level container that holds registers, memories, sub-blocks, and one or more address maps. Represents an entire IP or subsystem register specification.',
  apis: ['create_map()', 'add_reg()', 'add_mem()', 'lock_model()', 'get_registers()', 'mirror()', 'reset()'],
  children: [
    {
      id: 'map',
      label: 'uvm_reg_map',
      className: 'cfg_bus',
      icon: <Grid3X3 size={18} />,
      clause: 'IEEE 1800.2-2020 §18.2',
      role: 'Address map that assigns physical addresses to registers and memories. A single block can have multiple maps for different bus interfaces (e.g., AXI front-door vs. APB side-band).',
      apis: ['add_reg()', 'add_mem()', 'add_submap()', 'get_base_addr()', 'set_sequencer()', 'set_auto_predict()'],
      children: [
        {
          id: 'reg1',
          label: 'uvm_reg',
          className: 'status_reg',
          icon: <Layers size={18} />,
          clause: 'IEEE 1800.2-2020 §18.4',
          role: 'A single hardware register. Knows its reset value, access policy, and mirrored value. Supports frontdoor (bus) and backdoor (HDL path) access.',
          apis: ['read()', 'write()', 'mirror()', 'predict()', 'get_mirrored_value()', 'get()', 'set()', 'peek()', 'poke()'],
          children: [
            {
              id: 'field1',
              label: 'uvm_reg_field',
              className: 'state[7:0]',
              icon: <Binary size={18} />,
              clause: 'IEEE 1800.2-2020 §18.5',
              role: 'Individual bit-slice within a register. Defines the hardware access type (RW, RO, W1C, W1S, volatile, etc.) and reset value for that field range.',
              apis: ['configure()', 'get_access()', 'get_reset()', 'set()', 'get()', 'predict()'],
            },
            {
              id: 'field2',
              label: 'uvm_reg_field',
              className: 'enable[0]',
              icon: <Binary size={18} />,
              clause: 'IEEE 1800.2-2020 §18.5',
              role: 'Individual bit-slice within a register. Defines the hardware access type (RW, RO, W1C, W1S, volatile, etc.) and reset value for that field range.',
              apis: ['configure()', 'get_access()', 'get_reset()', 'set()', 'get()', 'predict()'],
            },
          ],
        },
        {
          id: 'reg2',
          label: 'uvm_reg',
          className: 'control_reg',
          icon: <Layers size={18} />,
          clause: 'IEEE 1800.2-2020 §18.4',
          role: 'A single hardware register. Knows its reset value, access policy, and mirrored value. Supports frontdoor (bus) and backdoor (HDL path) access.',
          apis: ['read()', 'write()', 'mirror()', 'predict()', 'get_mirrored_value()', 'get()', 'set()', 'peek()', 'poke()'],
          children: [
            {
              id: 'field3',
              label: 'uvm_reg_field',
              className: 'mode[3:0]',
              icon: <Binary size={18} />,
              clause: 'IEEE 1800.2-2020 §18.5',
              role: 'Individual bit-slice within a register. Defines the hardware access type (RW, RO, W1C, W1S, volatile, etc.) and reset value for that field range.',
              apis: ['configure()', 'get_access()', 'get_reset()', 'set()', 'get()', 'predict()'],
            },
          ],
        },
        {
          id: 'mem',
          label: 'uvm_mem',
          className: 'sram_1k',
          icon: <Database size={18} />,
          clause: 'IEEE 1800.2-2020 §19',
          role: 'Models a block of memory with a base address and size. Used for DMA buffers, lookup tables, and instruction memories. Supports burst and walk sequences.',
          apis: ['read()', 'write()', 'burst_read()', 'burst_write()', 'get_size()', 'get_n_bits()'],
        },
      ],
    },
  ],
};

function getNodeColor(label: string): { bg: string; border: string; text: string; selectedBg: string } {
  switch (label) {
    case 'uvm_reg_block':
      return { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', selectedBg: 'bg-indigo-100' };
    case 'uvm_reg_map':
      return { bg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-700', selectedBg: 'bg-sky-100' };
    case 'uvm_reg':
      return { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', selectedBg: 'bg-emerald-100' };
    case 'uvm_reg_field':
      return { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', selectedBg: 'bg-amber-100' };
    case 'uvm_mem':
      return { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', selectedBg: 'bg-purple-100' };
    default:
      return { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700', selectedBg: 'bg-slate-100' };
  }
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: HierarchyNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: HierarchyNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const colors = getNodeColor(node.label);
  const isSelected = selectedId === node.id;

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      <button
        onClick={() => {
          onSelect(node);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm font-medium transition-all duration-200 w-full mb-1
          ${isSelected ? `${colors.selectedBg} ${colors.border} ring-2 ring-offset-1 ring-${colors.border.replace('border-', '')}` : `${colors.bg} ${colors.border} hover:shadow-md`}
          ${colors.text}`}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="shrink-0">{node.icon}</span>
        <span className="font-semibold">{node.label}</span>
        <span className="text-xs opacity-70 font-mono ml-1">{node.className}</span>
      </button>
      {hasChildren && expanded && (
        <div className="border-l-2 border-slate-200 ml-4 pl-1">
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RALHierarchy() {
  const [selected, setSelected] = useState<HierarchyNode | null>(null);

  return (
    <div className="flex flex-col border border-slate-200 rounded-lg bg-slate-50 my-8 shadow-sm font-sans overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200 bg-white">
        <BookOpen size={20} className="text-indigo-600" />
        <h3 className="text-lg font-bold text-slate-800 m-0">RAL Object Hierarchy</h3>
        <span className="text-xs text-slate-500 ml-2">Click any node to explore</span>
      </div>

      <div className="grid md:grid-cols-[1fr_1fr] gap-0">
        {/* Tree view */}
        <div className="p-4 border-r border-slate-200 overflow-auto">
          <TreeNode node={hierarchy} depth={0} selectedId={selected?.id ?? null} onSelect={setSelected} />
        </div>

        {/* Detail panel */}
        <div className="p-5 bg-white min-h-[260px]">
          {selected ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {selected.icon}
                  <h4 className={`text-base font-bold m-0 ${getNodeColor(selected.label).text}`}>{selected.label}</h4>
                </div>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{selected.className}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                <BookOpen size={12} />
                {selected.clause}
              </div>

              <p className="text-sm text-slate-600 leading-relaxed m-0">{selected.role}</p>

              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 mt-0">Key APIs</h5>
                <div className="flex flex-wrap gap-1.5">
                  {selected.apis.map((api) => (
                    <code key={api} className="text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                      {api}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <Database size={32} />
              <span className="text-sm">Select a node to see its role, clause, and APIs</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
