'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Settings2, Cpu, Database, Network, ArrowRight } from 'lucide-react';

type ProtocolFamily = 'AHB' | 'AHB-Lite' | 'AXI4' | 'AXI4-Lite' | 'AXI4-Stream';

interface ProtocolInfo {
  id: ProtocolFamily;
  name: string;
  subtitle: string;
  topology: string;
  useCase: string;
  complexity: 'Low' | 'Medium' | 'High';
  features: {
    multiMaster: boolean;
    bursts: boolean;
    independentChannels: boolean;
    outOfOrder: boolean;
    addressPhase: boolean;
  };
  description: string;
}

const PROTOCOLS: ProtocolInfo[] = [
  {
    id: 'AHB',
    name: 'AHB',
    subtitle: 'Advanced High-performance Bus',
    topology: 'Shared Bus (Multi-Master with Arbiter)',
    useCase: 'Legacy SoCs or specific multi-master, low-latency subsystems.',
    complexity: 'Medium',
    features: {
      multiMaster: true,
      bursts: true,
      independentChannels: false,
      outOfOrder: false,
      addressPhase: true,
    },
    description: 'The original high-performance bus. Uses a shared bus topology requiring an arbiter to grant bus access to multiple masters. Address and data phases are pipelined, but responses must return in order.',
  },
  {
    id: 'AHB-Lite',
    name: 'AHB-Lite',
    subtitle: 'Simplified AHB for single masters',
    topology: 'Shared Bus (Single-Master)',
    useCase: 'Cortex-M microcontrollers, simple peripheral buses.',
    complexity: 'Low',
    features: {
      multiMaster: false,
      bursts: true,
      independentChannels: false,
      outOfOrder: false,
      addressPhase: true,
    },
    description: 'A streamlined version of AHB supporting only a single master, eliminating the need for an arbiter or request/grant signals. Extremely common in modern microcontroller designs for connecting the CPU to memory and peripherals.',
  },
  {
    id: 'AXI4',
    name: 'AXI4',
    subtitle: 'Advanced eXtensible Interface',
    topology: 'Point-to-point / Interconnect',
    useCase: 'High-bandwidth memory controllers, multi-core SoCs, GPU/NPU interfaces.',
    complexity: 'High',
    features: {
      multiMaster: true,
      bursts: true,
      independentChannels: true,
      outOfOrder: true,
      addressPhase: true,
    },
    description: 'The dominant high-performance protocol. Uses five independent channels (Write Address, Write Data, Write Response, Read Address, Read Data). Supports multiple outstanding transactions and out-of-order completion, relying on an interconnect fabric rather than a shared bus.',
  },
  {
    id: 'AXI4-Lite',
    name: 'AXI4-Lite',
    subtitle: 'Simplified AXI for control registers',
    topology: 'Point-to-point / Interconnect',
    useCase: 'Peripheral configuration, CSRs (Control and Status Registers).',
    complexity: 'Medium',
    features: {
      multiMaster: true,
      bursts: false,
      independentChannels: true,
      outOfOrder: false,
      addressPhase: true,
    },
    description: 'A lightweight subset of AXI4. It maintains the five-channel architecture but removes support for bursts, making all transactions exactly one beat long. Perfect for simple control register access where AXI4\'s full complexity is unnecessary.',
  },
  {
    id: 'AXI4-Stream',
    name: 'AXI4-Stream',
    subtitle: 'High-speed unidirectional data streaming',
    topology: 'Point-to-point (Unidirectional)',
    useCase: 'Video processing, DSP, network packet routing, PCIe payloads.',
    complexity: 'Low',
    features: {
      multiMaster: false,
      bursts: false,
      independentChannels: false,
      outOfOrder: false,
      addressPhase: false,
    },
    description: 'Designed purely for moving streams of data without addresses. It uses a simple VALID/READY handshake to transfer data in one direction. It has no concept of reads, writes, or memory addresses—just a continuous flow of payload.',
  },
];

export function AmbaFamilyExplorer() {
  const [activeTab, setActiveTab] = useState<ProtocolFamily>('AHB-Lite');

  const activeInfo = PROTOCOLS.find((p) => p.id === activeTab)!;

  const renderTopologyDiagram = (id: ProtocolFamily) => {
    switch (id) {
      case 'AHB':
        return (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex w-full justify-around gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-24 items-center justify-center rounded-lg border-2 border-blue-500 bg-blue-100 font-semibold text-blue-900">Master 1</div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-24 items-center justify-center rounded-lg border-2 border-blue-500 bg-blue-100 font-semibold text-blue-900">Master 2</div>
              </div>
            </div>
            <div className="flex w-full justify-around px-12">
              <div className="h-6 border-l-2 border-slate-400"></div>
              <div className="h-6 border-l-2 border-slate-400"></div>
            </div>
            <div className="flex w-3/4 items-center justify-center rounded-md border-2 border-slate-400 bg-slate-100 py-3 text-sm font-bold text-slate-700">
              Shared Bus & Arbiter
            </div>
            <div className="flex w-full justify-around px-12">
              <div className="h-6 border-l-2 border-slate-400"></div>
              <div className="h-6 border-l-2 border-slate-400"></div>
            </div>
            <div className="flex w-full justify-around gap-4">
              <div className="flex h-12 w-24 items-center justify-center rounded-lg border-2 border-green-500 bg-green-100 font-semibold text-green-900">Slave 1</div>
              <div className="flex h-12 w-24 items-center justify-center rounded-lg border-2 border-green-500 bg-green-100 font-semibold text-green-900">Slave 2</div>
            </div>
          </div>
        );
      case 'AHB-Lite':
        return (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-12 w-32 items-center justify-center rounded-lg border-2 border-blue-500 bg-blue-100 font-semibold text-blue-900">Single Master</div>
            <div className="h-6 border-l-2 border-slate-400"></div>
            <div className="flex w-2/3 items-center justify-center rounded-md border-2 border-slate-400 bg-slate-100 py-2 text-sm font-bold text-slate-700">Decoder</div>
            <div className="flex w-full justify-around px-8">
              <div className="h-6 border-l-2 border-slate-400"></div>
              <div className="h-6 border-l-2 border-slate-400"></div>
            </div>
            <div className="flex w-full justify-around gap-4 px-4">
              <div className="flex h-12 w-24 items-center justify-center rounded-lg border-2 border-green-500 bg-green-100 font-semibold text-green-900">Slave 1</div>
              <div className="flex h-12 w-24 items-center justify-center rounded-lg border-2 border-green-500 bg-green-100 font-semibold text-green-900">Slave 2</div>
            </div>
          </div>
        );
      case 'AXI4':
      case 'AXI4-Lite':
        return (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex w-full justify-between px-4">
              <div className="flex h-16 w-24 flex-col items-center justify-center rounded-lg border-2 border-blue-500 bg-blue-100 font-semibold text-blue-900">
                <span>Master 1</span>
              </div>
              <div className="flex h-16 w-24 flex-col items-center justify-center rounded-lg border-2 border-blue-500 bg-blue-100 font-semibold text-blue-900">
                <span>Master 2</span>
              </div>
            </div>
            <div className="flex w-full items-center justify-between px-12">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 border-l-[3px] border-indigo-400/70"></div>
                ))}
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 border-l-[3px] border-indigo-400/70"></div>
                ))}
              </div>
            </div>
            <div className="flex w-[90%] flex-col items-center justify-center rounded-xl border-2 border-indigo-400 bg-indigo-50 py-3 text-sm font-bold text-indigo-900">
              AXI Interconnect Fabric
              <span className="text-xs font-normal opacity-80">(5 Independent Channels)</span>
            </div>
            <div className="flex w-full items-center justify-between px-12">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 border-l-[3px] border-indigo-400/70"></div>
                ))}
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 border-l-[3px] border-indigo-400/70"></div>
                ))}
              </div>
            </div>
            <div className="flex w-full justify-between px-4">
              <div className="flex h-16 w-24 flex-col items-center justify-center rounded-lg border-2 border-green-500 bg-green-100 font-semibold text-green-900">
                <span>Slave 1</span>
              </div>
              <div className="flex h-16 w-24 flex-col items-center justify-center rounded-lg border-2 border-green-500 bg-green-100 font-semibold text-green-900">
                <span>Slave 2</span>
              </div>
            </div>
          </div>
        );
      case 'AXI4-Stream':
        return (
          <div className="flex flex-col items-center justify-center gap-6 py-12">
            <div className="flex w-full items-center justify-center gap-2">
              <div className="flex h-16 w-32 items-center justify-center rounded-lg border-2 border-blue-500 bg-blue-100 font-semibold text-blue-900">Source</div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-xs font-semibold text-indigo-600">TDATA, TVALID</span>
                <ArrowRight className="h-6 w-24 text-indigo-500" strokeWidth={3} />
                <div className="flex items-center gap-1">
                  <ArrowRight className="h-4 w-20 rotate-180 text-rose-500" strokeWidth={2} />
                  <span className="text-xs font-semibold text-rose-600">TREADY</span>
                </div>
              </div>
              <div className="flex h-16 w-32 items-center justify-center rounded-lg border-2 border-green-500 bg-green-100 font-semibold text-green-900">Destination</div>
            </div>
            <div className="text-center text-sm text-slate-500">Unidirectional Data Flow. No Addresses.</div>
          </div>
        );
    }
  };

  const FeatureRow = ({ label, value }: { label: string; value: boolean }) => (
    <div className="flex items-center justify-between border-b border-slate-200 py-3 last:border-0">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {value ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      ) : (
        <XCircle className="h-5 w-5 text-slate-300" />
      )}
    </div>
  );

  return (
    <div className="my-8 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="amba-family-explorer">
      {/* Header Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 bg-slate-50">
        {PROTOCOLS.map((protocol) => (
          <button
            key={protocol.id}
            onClick={() => setActiveTab(protocol.id)}
            className={cn(
              'flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition-colors min-w-[120px]',
              activeTab === protocol.id
                ? 'border-primary text-primary bg-white'
                : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            )}
          >
            {protocol.name}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2">
        {/* Left column: Diagram & Use case */}
        <div className="flex flex-col border-b border-slate-200 bg-slate-50/50 p-6 md:border-b-0 md:border-r">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-900">{activeInfo.name}</h3>
            <p className="text-sm font-medium text-slate-500">{activeInfo.subtitle}</p>
          </div>
          
          <div className="mb-6 flex-1 rounded-xl border border-slate-200 bg-white shadow-inner">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeInfo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full w-full"
              >
                {renderTopologyDiagram(activeInfo.id)}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Settings2 className="h-4 w-4" /> Topology
              </h4>
              <p className="mt-1 text-sm font-medium text-slate-800">{activeInfo.topology}</p>
            </div>
            <div>
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Cpu className="h-4 w-4" /> Ideal Use Case
              </h4>
              <p className="mt-1 text-sm text-slate-700">{activeInfo.useCase}</p>
            </div>
          </div>
        </div>

        {/* Right column: Details and Features */}
        <div className="flex flex-col p-6">
          <div className="mb-6 rounded-lg bg-blue-50 p-4 text-sm leading-relaxed text-blue-900 border border-blue-100">
            {activeInfo.description}
          </div>

          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Protocol Capabilities
          </h4>
          <div className="rounded-lg border border-slate-200 bg-white px-4">
            <FeatureRow label="Addresses Support" value={activeInfo.features.addressPhase} />
            <FeatureRow label="Multi-Master Native" value={activeInfo.features.multiMaster} />
            <FeatureRow label="Burst Transfers" value={activeInfo.features.bursts} />
            <FeatureRow label="Independent Read/Write Channels" value={activeInfo.features.independentChannels} />
            <FeatureRow label="Out-of-Order Completion" value={activeInfo.features.outOfOrder} />
          </div>

          <div className="mt-auto pt-6 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Complexity</span>
            <span className={cn(
              "rounded-full px-3 py-1 text-xs font-bold",
              activeInfo.complexity === 'Low' && 'bg-green-100 text-green-700',
              activeInfo.complexity === 'Medium' && 'bg-yellow-100 text-yellow-700',
              activeInfo.complexity === 'High' && 'bg-red-100 text-red-700'
            )}>
              {activeInfo.complexity}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
