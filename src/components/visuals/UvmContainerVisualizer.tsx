"use client";

import React, { useState } from 'react';
import { Database, List, ArrowRightLeft, Plus, Trash2, Search, ChevronRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types & Data                                                       */
/* ------------------------------------------------------------------ */

type ContainerType = 'uvm_pool' | 'uvm_queue' | 'sv_aa' | 'sv_queue';

interface ContainerInfo {
  key: ContainerType;
  label: string;
  category: 'uvm' | 'sv';
  description: string;
  operations: string[];
  strengths: string[];
  weaknesses: string[];
}

const CONTAINERS: ContainerInfo[] = [
  {
    key: 'uvm_pool',
    label: 'uvm_pool',
    category: 'uvm',
    description: 'Global singleton associative container with string keys. Provides a shared namespace accessible from anywhere in the testbench hierarchy.',
    operations: ['add(key, val)', 'get(key)', 'delete(key)', 'exists(key)', 'num()', 'first(key)', 'next(key)'],
    strengths: ['Global singleton access via ::get_global_pool()', 'No need to pass handles between components', 'String-keyed — flexible and self-documenting'],
    weaknesses: ['No type safety on values', 'Global state — hard to test in isolation', 'Singleton pattern can mask coupling'],
  },
  {
    key: 'uvm_queue',
    label: 'uvm_queue',
    category: 'uvm',
    description: 'A parameterized FIFO wrapper around a dynamic array, compatible with uvm_object registration and the UVM factory.',
    operations: ['push_back(val)', 'push_front(val)', 'pop_back()', 'pop_front()', 'get(index)', 'size()', 'insert(index, val)', 'delete(index)'],
    strengths: ['Factory-compatible (can be overridden)', 'Supports print/compare/copy via uvm_object', 'Parameterized — type-safe'],
    weaknesses: ['Slight overhead vs native SV queue', 'Rarely needed unless factory integration matters', 'Less familiar API to SV engineers'],
  },
  {
    key: 'sv_aa',
    label: 'SV Associative Array',
    category: 'sv',
    description: 'Native SystemVerilog associative array. Hash-map semantics with arbitrary key types (string, int, or any type).',
    operations: ['aa[key] = val', 'aa.exists(key)', 'aa.delete(key)', 'aa.size()', 'aa.first(key)', 'aa.next(key)', 'foreach (aa[k]) ...'],
    strengths: ['Zero overhead — built into the language', 'Supports any key type', 'Familiar SV syntax', 'Foreach iteration'],
    weaknesses: ['No global singleton access', 'Must pass handles explicitly', 'No UVM policy integration (print/compare)'],
  },
  {
    key: 'sv_queue',
    label: 'SV Queue ($)',
    category: 'sv',
    description: 'Native SystemVerilog queue with $-syntax. Ordered, double-ended, and supports array manipulation methods.',
    operations: ['q.push_back(val)', 'q.push_front(val)', 'q.pop_back()', 'q.pop_front()', 'q[i]', 'q.size()', 'q.insert(i, val)', 'q.delete(i)'],
    strengths: ['Zero overhead — built into the language', 'Rich array methods (sort, find, unique)', 'No registration needed', 'Familiar SV syntax'],
    weaknesses: ['No factory override support', 'No UVM print/compare integration', 'Cannot be used as a uvm_object field without wrapper'],
  },
];

/* ------------------------------------------------------------------ */
/* Interactive demo state                                             */
/* ------------------------------------------------------------------ */

interface DemoEntry { key: string; value: string }

function ContainerDemo({ container }: { container: ContainerInfo }) {
  const [entries, setEntries] = useState<DemoEntry[]>([
    { key: 'status', value: 'PASS' },
    { key: 'count', value: '42' },
  ]);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);

  const addEntry = () => {
    if (!newKey.trim()) return;
    setEntries(prev => [...prev.filter(e => e.key !== newKey), { key: newKey, value: newVal }]);
    setNewKey('');
    setNewVal('');
  };

  const removeEntry = (key: string) => {
    setEntries(prev => prev.filter(e => e.key !== key));
  };

  const doSearch = () => {
    const found = entries.find(e => e.key === searchKey);
    setSearchResult(found ? found.value : '❌ Not found');
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Current contents */}
      <div className="bg-black/40 rounded-lg p-3 border border-slate-800">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5">
          <Database className="w-3 h-3" /> Contents ({entries.length} entries)
        </div>
        {entries.length === 0 ? (
          <div className="text-xs text-slate-500 italic">Empty</div>
        ) : (
          <div className="flex flex-col gap-1">
            {entries.map(e => (
              <div key={e.key} className="flex items-center justify-between text-xs font-mono bg-slate-800/50 rounded px-2 py-1">
                <span>
                  <span className="text-blue-300">{e.key}</span>
                  <span className="text-slate-500"> → </span>
                  <span className="text-emerald-300">{e.value}</span>
                </span>
                <button onClick={() => removeEntry(e.key)} className="text-rose-400 hover:text-rose-300 ml-2">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add + Search controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex items-center gap-1">
          <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="key"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 min-w-0" />
          <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="value"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 min-w-0" />
          <button onClick={addEntry} className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 shrink-0" title="Add entry">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <input value={searchKey} onChange={e => { setSearchKey(e.target.value); setSearchResult(null); }} placeholder="search key"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 min-w-0" />
          <button onClick={doSearch} className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500 shrink-0" title="Search">
            <Search className="w-3.5 h-3.5" />
          </button>
          {searchResult !== null && (
            <span className={`text-xs font-mono ${searchResult.startsWith('❌') ? 'text-rose-400' : 'text-emerald-300'}`}>
              {searchResult}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function UvmContainerVisualizer() {
  const [selected, setSelected] = useState<ContainerType>('uvm_pool');
  const [showCompare, setShowCompare] = useState(false);

  const current = CONTAINERS.find(c => c.key === selected)!;

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 font-sans my-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h3 className="text-xl font-bold font-display text-white m-0">UVM vs Native SV Containers</h3>
        <p className="text-sm text-slate-400 mt-1">
          Explore each container, try the operations, and compare their tradeoffs.
        </p>
      </div>

      {/* Container selector */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-800/60 p-1 rounded-lg border border-slate-700 text-xs w-fit">
        {CONTAINERS.map(c => (
          <button
            key={c.key}
            onClick={() => { setSelected(c.key); setShowCompare(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              selected === c.key && !showCompare
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {c.category === 'uvm' ? <Database className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            {c.label}
          </button>
        ))}
        <button
          onClick={() => setShowCompare(!showCompare)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all border-l border-slate-700 ml-1 ${
            showCompare ? 'bg-purple-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Compare All
        </button>
      </div>

      {/* Content */}
      {showCompare ? (
        /* Comparison table */
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 px-2">Feature</th>
                {CONTAINERS.map(c => (
                  <th key={c.key} className={`text-left py-2 px-2 ${c.category === 'uvm' ? 'text-purple-300' : 'text-blue-300'}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800/50">
                <td className="py-1.5 px-2 text-slate-300 font-semibold">Type</td>
                <td className="py-1.5 px-2 text-slate-400">Assoc. map</td>
                <td className="py-1.5 px-2 text-slate-400">Ordered list</td>
                <td className="py-1.5 px-2 text-slate-400">Assoc. map</td>
                <td className="py-1.5 px-2 text-slate-400">Ordered list</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-1.5 px-2 text-slate-300 font-semibold">Global access</td>
                <td className="py-1.5 px-2 text-emerald-400">✓ singleton</td>
                <td className="py-1.5 px-2 text-rose-400">✗</td>
                <td className="py-1.5 px-2 text-rose-400">✗</td>
                <td className="py-1.5 px-2 text-rose-400">✗</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-1.5 px-2 text-slate-300 font-semibold">Factory support</td>
                <td className="py-1.5 px-2 text-emerald-400">✓</td>
                <td className="py-1.5 px-2 text-emerald-400">✓</td>
                <td className="py-1.5 px-2 text-rose-400">✗</td>
                <td className="py-1.5 px-2 text-rose-400">✗</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-1.5 px-2 text-slate-300 font-semibold">Print/Compare</td>
                <td className="py-1.5 px-2 text-emerald-400">✓ via policy</td>
                <td className="py-1.5 px-2 text-emerald-400">✓ via policy</td>
                <td className="py-1.5 px-2 text-rose-400">✗ manual</td>
                <td className="py-1.5 px-2 text-rose-400">✗ manual</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-1.5 px-2 text-slate-300 font-semibold">Performance</td>
                <td className="py-1.5 px-2 text-amber-400">Overhead</td>
                <td className="py-1.5 px-2 text-amber-400">Overhead</td>
                <td className="py-1.5 px-2 text-emerald-400">Native</td>
                <td className="py-1.5 px-2 text-emerald-400">Native</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-1.5 px-2 text-slate-300 font-semibold">Array methods</td>
                <td className="py-1.5 px-2 text-rose-400">✗</td>
                <td className="py-1.5 px-2 text-rose-400">✗</td>
                <td className="py-1.5 px-2 text-rose-400">✗</td>
                <td className="py-1.5 px-2 text-emerald-400">✓ sort, find, unique</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        /* Single container detail view */
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-400">{current.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API reference */}
            <div className="bg-black/40 rounded-lg p-3 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">API</div>
              <div className="flex flex-col gap-1">
                {current.operations.map(op => (
                  <code key={op} className="text-xs font-mono text-blue-300 bg-slate-800/50 rounded px-1.5 py-0.5">
                    {op}
                  </code>
                ))}
              </div>
            </div>

            {/* Strengths / Weaknesses */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1 font-semibold">Strengths</div>
                {current.strengths.map(s => (
                  <div key={s} className="text-xs text-slate-300 flex items-start gap-1.5 mb-0.5">
                    <span className="text-emerald-400 shrink-0">+</span> {s}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[10px] text-rose-500 uppercase tracking-wider mb-1 font-semibold">Weaknesses</div>
                {current.weaknesses.map(w => (
                  <div key={w} className="text-xs text-slate-300 flex items-start gap-1.5 mb-0.5">
                    <span className="text-rose-400 shrink-0">−</span> {w}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive demo */}
          <div className="border-t border-slate-800 pt-4">
            <div className="text-xs text-slate-400 mb-2 font-semibold flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-emerald-500" />
              Try it: add, search, and remove entries
            </div>
            <ContainerDemo container={current} />
          </div>
        </div>
      )}
    </div>
  );
}
