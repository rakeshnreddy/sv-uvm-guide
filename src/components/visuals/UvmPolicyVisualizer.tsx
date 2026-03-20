"use client";

import React, { useState } from 'react';
import { Printer, GitCompare, Binary, Database, Copy, ChevronRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Data model: a mock UVM packet with fields                          */
/* ------------------------------------------------------------------ */

interface PacketField {
  name: string;
  bits: number;
  valueA: number;
  valueB: number;      // second object for compare
}

const FIELDS: PacketField[] = [
  { name: 'addr',   bits: 32, valueA: 0x1000_CAFE, valueB: 0x1000_CAFE },
  { name: 'data',   bits: 32, valueA: 0xDEAD_BEEF, valueB: 0xBADC_0FFE },
  { name: 'parity', bits: 1,  valueA: 1,           valueB: 0 },
  { name: 'id',     bits: 8,  valueA: 42,          valueB: 42 },
];

const TABS = [
  { key: 'print',   label: 'Print',   icon: Printer },
  { key: 'compare', label: 'Compare', icon: GitCompare },
  { key: 'pack',    label: 'Pack',    icon: Binary },
  { key: 'record',  label: 'Record',  icon: Database },
  { key: 'copy',    label: 'Copy',    icon: Copy },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function hex(v: number, bits: number): string {
  const nibbles = Math.ceil(bits / 4);
  return '0x' + v.toString(16).toUpperCase().padStart(nibbles, '0');
}

function bin(v: number, bits: number): string {
  return v.toString(2).padStart(bits, '0');
}

/* ------------------------------------------------------------------ */
/* Sub-views                                                          */
/* ------------------------------------------------------------------ */

type PrintFormat = 'table' | 'tree' | 'line';

function PrintTab() {
  const [fmt, setFmt] = useState<PrintFormat>('table');

  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700">
            <th className="text-left py-1.5 px-2">Field</th>
            <th className="text-left py-1.5 px-2">Size</th>
            <th className="text-left py-1.5 px-2">Value</th>
          </tr>
        </thead>
        <tbody>
          {FIELDS.map(f => (
            <tr key={f.name} className="border-b border-slate-800/50">
              <td className="py-1.5 px-2 text-blue-300">{f.name}</td>
              <td className="py-1.5 px-2 text-slate-400">{f.bits}b</td>
              <td className="py-1.5 px-2 text-emerald-300">{hex(f.valueA, f.bits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderTree = () => (
    <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
{`my_packet (my_packet@0)
${FIELDS.map((f, i) => {
  const prefix = i === FIELDS.length - 1 ? '└──' : '├──';
  return `  ${prefix} ${f.name.padEnd(8)} ${hex(f.valueA, f.bits)}`;
}).join('\n')}`}
    </pre>
  );

  const renderLine = () => (
    <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
{`my_packet: { ${FIELDS.map(f => `${f.name}=${hex(f.valueA, f.bits)}`).join(', ')} }`}
    </pre>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-slate-400">
          <code className="text-purple-300">uvm_printer</code> formats an object&apos;s fields
          for debug output. UVM ships three built-in formats — switch between them below.
        </p>
        <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-lg border border-slate-700 w-fit text-xs">
          {(['table', 'tree', 'line'] as PrintFormat[]).map(f => (
            <button
              key={f}
              onClick={() => setFmt(f)}
              className={`px-3 py-1 rounded-md transition-all capitalize ${
                fmt === f ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-black/40 rounded-lg p-4 border border-slate-800">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
          uvm_default_printer = uvm_{fmt}_printer
        </div>
        {fmt === 'table' && renderTable()}
        {fmt === 'tree' && renderTree()}
        {fmt === 'line' && renderLine()}
      </div>

      <div className="text-[10px] text-slate-500 flex items-start gap-1.5 bg-slate-800/30 rounded p-2">
        <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />
        <span>Override <code className="text-slate-400">do_print()</code> in your class
        to customize output beyond what <code className="text-slate-400">`uvm_field_*</code> macros produce.</span>
      </div>
    </div>
  );
}

function CompareTab() {
  const [ran, setRan] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        <code className="text-purple-300">uvm_comparer</code> walks two objects field-by-field
        and reports mismatches. Click <strong>Compare</strong> to see the diff.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {['A', 'B'].map((label, idx) => (
          <div key={label} className="bg-black/40 rounded-lg p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
              Object {label}
            </div>
            {FIELDS.map(f => {
              const val = idx === 0 ? f.valueA : f.valueB;
              const mismatch = ran && f.valueA !== f.valueB;
              return (
                <div key={f.name} className={`flex justify-between text-xs font-mono py-0.5 px-1 rounded ${
                  mismatch
                    ? idx === 0
                      ? 'bg-rose-900/30 text-rose-300'
                      : 'bg-amber-900/30 text-amber-300'
                    : 'text-slate-300'
                }`}>
                  <span className="text-blue-300">{f.name}</span>
                  <span>{hex(val, f.bits)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <button
        onClick={() => setRan(true)}
        className="self-start px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500 transition-all"
      >
        {ran ? '✓ Compared' : 'Compare'}
      </button>

      {ran && (
        <div className="bg-black/40 rounded-lg p-3 border border-slate-800 text-xs font-mono">
          <div className="text-rose-400 font-semibold mb-1">Result: MISMATCH (2 field(s) differ)</div>
          {FIELDS.filter(f => f.valueA !== f.valueB).map(f => (
            <div key={f.name} className="text-slate-400 ml-2">
              <span className="text-blue-300">{f.name}</span>: {hex(f.valueA, f.bits)} ≠ {hex(f.valueB, f.bits)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PackTab() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        <code className="text-purple-300">uvm_packer</code> serializes an object&apos;s fields
        into a flat bitstream for transport across language boundaries or network sockets.
      </p>

      <div className="bg-black/40 rounded-lg p-4 border border-slate-800 overflow-x-auto">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3 font-semibold">
          Bitstream Layout (MSB → LSB)
        </div>
        <div className="flex flex-wrap gap-1">
          {FIELDS.map(f => {
            const bits = bin(f.valueA, f.bits);
            const colors = ['text-emerald-300', 'text-blue-300', 'text-purple-300', 'text-amber-300'];
            const bgs = ['bg-emerald-900/20', 'bg-blue-900/20', 'bg-purple-900/20', 'bg-amber-900/20'];
            const idx = FIELDS.indexOf(f);
            return (
              <div key={f.name} className={`flex flex-col items-center ${bgs[idx]} rounded p-2 border border-slate-700`}>
                <span className={`text-[10px] font-semibold ${colors[idx]} mb-1`}>{f.name}</span>
                <span className="text-[9px] font-mono text-slate-400 break-all max-w-[140px]">{bits}</span>
                <span className="text-[9px] text-slate-500 mt-0.5">{f.bits} bits</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-slate-400 font-mono">
          Total: {FIELDS.reduce((sum, f) => sum + f.bits, 0)} bits
          → {Math.ceil(FIELDS.reduce((sum, f) => sum + f.bits, 0) / 8)} bytes
        </div>
      </div>

      <div className="text-[10px] text-slate-500 flex items-start gap-1.5 bg-slate-800/30 rounded p-2">
        <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />
        <span>Override <code className="text-slate-400">do_pack()</code> / <code className="text-slate-400">do_unpack()</code> to
        control field order, add headers, or skip fields the receiver doesn&apos;t need.</span>
      </div>
    </div>
  );
}

function RecordTab() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        <code className="text-purple-300">uvm_recorder</code> logs structured transaction
        metadata into a database that waveform viewers (DVE, Verdi, SimVision) can display as protocol-level signal groups.
      </p>

      <div className="bg-black/40 rounded-lg p-4 border border-slate-800 overflow-x-auto">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3 font-semibold">
          Transaction Database Entry
        </div>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="text-left py-1.5 px-2">Attribute</th>
              <th className="text-left py-1.5 px-2">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-800/50">
              <td className="py-1.5 px-2 text-purple-300">stream</td>
              <td className="py-1.5 px-2 text-slate-300">driver.req</td>
            </tr>
            <tr className="border-b border-slate-800/50">
              <td className="py-1.5 px-2 text-purple-300">type</td>
              <td className="py-1.5 px-2 text-slate-300">my_packet</td>
            </tr>
            <tr className="border-b border-slate-800/50">
              <td className="py-1.5 px-2 text-purple-300">begin_time</td>
              <td className="py-1.5 px-2 text-emerald-300">1200 ns</td>
            </tr>
            <tr className="border-b border-slate-800/50">
              <td className="py-1.5 px-2 text-purple-300">end_time</td>
              <td className="py-1.5 px-2 text-emerald-300">1350 ns</td>
            </tr>
            {FIELDS.map(f => (
              <tr key={f.name} className="border-b border-slate-800/50">
                <td className="py-1.5 px-2 text-blue-300">{f.name}</td>
                <td className="py-1.5 px-2 text-slate-300">{hex(f.valueA, f.bits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-slate-500 flex items-start gap-1.5 bg-slate-800/30 rounded p-2">
        <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />
        <span>Override <code className="text-slate-400">do_record()</code> to add custom attributes
        (latency, error codes) that appear in waveform transaction views.</span>
      </div>
    </div>
  );
}

function CopyTab() {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        <code className="text-purple-300">uvm_copier</code> deep-copies an object&apos;s fields.
        For nested objects (handles), it recursively clones rather than aliasing the original reference.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-black/40 rounded-lg p-3 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
            Original (pkt)
          </div>
          {FIELDS.map(f => (
            <div key={f.name} className="flex justify-between text-xs font-mono py-0.5 px-1 text-slate-300">
              <span className="text-blue-300">{f.name}</span>
              <span>{hex(f.valueA, f.bits)}</span>
            </div>
          ))}
          <div className="mt-2 text-xs font-mono py-0.5 px-1 text-slate-300">
            <span className="text-purple-300">cfg</span>
            <span className="text-slate-500"> → @handle(0x3F)</span>
          </div>
        </div>

        <div className={`bg-black/40 rounded-lg p-3 border transition-all duration-500 ${
          copied ? 'border-emerald-700/50' : 'border-slate-800 opacity-40'
        }`}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
            {copied ? 'Deep Copy (pkt_copy)' : 'No copy yet'}
          </div>
          {copied && (
            <>
              {FIELDS.map(f => (
                <div key={f.name} className="flex justify-between text-xs font-mono py-0.5 px-1 text-emerald-300">
                  <span className="text-blue-300">{f.name}</span>
                  <span>{hex(f.valueA, f.bits)}</span>
                </div>
              ))}
              <div className="mt-2 text-xs font-mono py-0.5 px-1 text-emerald-300">
                <span className="text-purple-300">cfg</span>
                <span className="text-slate-500"> → @handle(0x7A)</span>
                <span className="text-emerald-500 text-[10px] ml-1">(new clone)</span>
              </div>
            </>
          )}
        </div>
      </div>

      <button
        onClick={() => setCopied(true)}
        className="self-start px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500 transition-all"
      >
        {copied ? '✓ Copied' : 'pkt_copy.copy(pkt)'}
      </button>

      {copied && (
        <div className="text-[10px] text-slate-500 flex items-start gap-1.5 bg-slate-800/30 rounded p-2">
          <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />
          <span>The nested <code className="text-slate-400">cfg</code> handle points to a
          <strong className="text-emerald-400"> new clone</strong> (0x7A), not the original (0x3F).
          Override <code className="text-slate-400">do_copy()</code> to skip, shallow-copy, or transform fields.</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function UvmPolicyVisualizer() {
  const [tab, setTab] = useState<TabKey>('print');

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 font-sans my-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h3 className="text-xl font-bold font-display text-white m-0">UVM Policy Classes</h3>
        <p className="text-sm text-slate-400 mt-1">
          Explore how the same <code className="text-blue-300">my_packet</code> object looks through five different policy lenses.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-800/60 p-1 rounded-lg border border-slate-700 text-xs w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              tab === key
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {tab === 'print' && <PrintTab />}
        {tab === 'compare' && <CompareTab />}
        {tab === 'pack' && <PackTab />}
        {tab === 'record' && <RecordTab />}
        {tab === 'copy' && <CopyTab />}
      </div>
    </div>
  );
}
