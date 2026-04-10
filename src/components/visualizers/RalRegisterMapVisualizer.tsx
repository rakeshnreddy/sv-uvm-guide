'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Grid3X3, Layers, BookOpen, GitMerge, Binary, Info, Play, ChevronRight, ChevronDown } from 'lucide-react';

interface BitField {
  name: string;
  lsb: number;
  width: number;
  access: string;
  reset: string;
  description: string;
}

interface Register {
  name: string;
  offset: string;
  description: string;
  resetValue: string;
  fields: BitField[];
}

interface RegBlock {
  name: string;
  baseAddress: string;
  registers: Register[];
}

const sampleBlock: RegBlock = {
  name: 'i2c_block',
  baseAddress: '0x4000_0000',
  registers: [
    {
      name: 'CTRL',
      offset: '0x00',
      description: 'I2C Control Register',
      resetValue: '0x0000_0000',
      fields: [
        { name: 'RSVD', lsb: 4, width: 28, access: 'RO', reset: '0x0', description: 'Reserved' },
        { name: 'MODE', lsb: 2, width: 2, access: 'RW', reset: '0x0', description: '00: Standard, 01: Fast, 10: High-Speed' },
        { name: 'IE', lsb: 1, width: 1, access: 'RW', reset: '0', description: 'Interrupt Enable' },
        { name: 'EN', lsb: 0, width: 1, access: 'RW', reset: '0', description: 'I2C Block Enable' },
      ],
    },
    {
      name: 'STATUS',
      offset: '0x04',
      description: 'I2C Status Register',
      resetValue: '0x0000_0002',
      fields: [
        { name: 'RSVD', lsb: 3, width: 29, access: 'RO', reset: '0x0', description: 'Reserved' },
        { name: 'RX_FULL', lsb: 2, width: 1, access: 'RO', reset: '0', description: 'Receive Buffer Full' },
        { name: 'TX_EMPTY', lsb: 1, width: 1, access: 'RO', reset: '1', description: 'Transmit Buffer Empty' },
        { name: 'BUSY', lsb: 0, width: 1, access: 'RO', reset: '0', description: 'I2C Bus Busy' },
      ],
    },
    {
      name: 'TX_DATA',
      offset: '0x08',
      description: 'Transmit Data Register',
      resetValue: '0x0000_0000',
      fields: [
        { name: 'RSVD', lsb: 8, width: 24, access: 'RO', reset: '0x0', description: 'Reserved' },
        { name: 'DATA', lsb: 0, width: 8, access: 'WO', reset: '0x00', description: 'Data to transmit' },
      ],
    },
    {
      name: 'RX_DATA',
      offset: '0x0C',
      description: 'Receive Data Register',
      resetValue: '0x0000_0000',
      fields: [
        { name: 'RSVD', lsb: 8, width: 24, access: 'RO', reset: '0x0', description: 'Reserved' },
        { name: 'DATA', lsb: 0, width: 8, access: 'RO', reset: '0x00', description: 'Received data' },
      ],
    },
  ],
};

function getFieldColor(access: string, isRsvd: boolean) {
  if (isRsvd) return 'bg-slate-200 border-slate-300 text-slate-500 hover:bg-slate-300';
  switch (access) {
    case 'RW': return 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200';
    case 'RO': return 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200';
    case 'WO': return 'bg-purple-100 border-purple-300 text-purple-800 hover:bg-purple-200';
    case 'W1C': return 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200';
    default: return 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200';
  }
}

export function RalRegisterMapVisualizer() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root', 'regs']));
  const [selectedReg, setSelectedReg] = useState<Register | null>(sampleBlock.registers[0]);
  const [hoveredField, setHoveredField] = useState<BitField | null>(null);
  
  // Simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [mirrorValue, setMirrorValue] = useState<string>(sampleBlock.registers[0].resetValue);
  const [simMessage, setSimMessage] = useState<string>('');
  const [writeVal, setWriteVal] = useState<string>('0x0000_0003');

  // Reset simulation when switching registers
  useEffect(() => {
    if (selectedReg) {
      setMirrorValue(selectedReg.resetValue);
      setSimMessage('');
      setWriteVal('0x0000_0003');
    }
  }, [selectedReg]);

  const toggleNode = (nodeId: string) => {
    const next = new Set(expandedNodes);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    setExpandedNodes(next);
  };

  const simulateWrite = () => {
    if (!selectedReg) return;
    
    setIsSimulating(true);
    setSimMessage('Initiating frontdoor write...');
    
    setTimeout(() => {
      setSimMessage(`Bus sequence executing write to offset ${selectedReg.offset}...`);
      
      setTimeout(() => {
        let hasWritable = selectedReg.fields.some(f => ['RW', 'WO', 'W1C'].includes(f.access));
        if (hasWritable) {
          setMirrorValue(writeVal);
          setSimMessage(`Success: Predictor updated mirror value to ${writeVal}`);
        } else {
          setSimMessage(`Ignored: Register is read-only. Mirror stays ${mirrorValue}`);
        }
        setIsSimulating(false);
      }, 1000);
      
    }, 800);
  };

  return (
    <div className="flex flex-col border border-slate-200 rounded-lg bg-white my-8 shadow-sm font-sans overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200 bg-slate-50">
        <Database size={20} className="text-indigo-600" />
        <h3 className="text-lg font-bold text-slate-800 m-0">RAL Register Map Dashboard</h3>
        <span className="text-xs text-slate-500 ml-2">Explore the hierarchical register model</span>
      </div>

      <div className="grid md:grid-cols-[250px_1fr] gap-0">
        {/* Left Panel: Tree */}
        <div className="p-4 border-r border-slate-200 bg-slate-50/50 overflow-auto max-h-[500px]">
          {/* Root Block */}
          <div>
            <button 
              onClick={() => toggleNode('root')}
              className="flex items-center gap-1.5 w-full text-left py-1.5 px-2 rounded hover:bg-slate-200 font-medium text-slate-800 text-sm"
            >
              {expandedNodes.has('root') ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
              <Database size={16} className="text-indigo-600 shrink-0" />
              <span>{sampleBlock.name}</span>
            </button>
            
            <AnimatePresence>
              {expandedNodes.has('root') && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="ml-6 border-l-2 border-slate-200 pl-2 overflow-hidden"
                >
                  <button 
                    onClick={() => toggleNode('regs')}
                    className="flex items-center gap-1.5 w-full text-left py-1 px-2 mt-1 rounded hover:bg-slate-200 font-medium text-slate-700 text-sm"
                  >
                    {expandedNodes.has('regs') ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                    <Grid3X3 size={14} className="text-sky-600 shrink-0" />
                    <span>Registers</span>
                  </button>
                  
                  <AnimatePresence>
                    {expandedNodes.has('regs') && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-4 border-l-2 border-slate-200 pl-2 mt-1 overflow-hidden"
                      >
                        {sampleBlock.registers.map((reg) => (
                          <button
                            key={reg.name}
                            onClick={() => setSelectedReg(reg)}
                            className={`flex items-center gap-1.5 w-full text-left py-1.5 px-2 my-0.5 rounded text-sm transition-colors
                              ${selectedReg?.name === reg.name 
                                  ? 'bg-indigo-100 text-indigo-700 font-semibold' 
                                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'}
                            `}
                          >
                            <Layers size={14} className={selectedReg?.name === reg.name ? 'text-indigo-600' : 'text-slate-400'} />
                            <span>{reg.name}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Panel: Details */}
        <div className="p-6 bg-white min-h-[500px]">
          {selectedReg ? (
            <motion.div 
              key={selectedReg.name}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Header Info */}
              <div className="flex flex-col gap-1 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-bold text-slate-800 flex items-center gap-2 m-0">
                    <Layers className="text-indigo-500" /> {selectedReg.name}
                  </h4>
                  <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                    Offset: {selectedReg.offset}
                  </span>
                </div>
                <p className="text-sm text-slate-500 m-0">{selectedReg.description}</p>
              </div>

              {/* Bit Field Diagram */}
              <div>
                <h5 className="text-sm font-semibold uppercase tracking-wide text-slate-600 mb-3 flex items-center gap-2">
                  <Binary size={16} /> Bit-Field Diagram (32-bit)
                </h5>
                <div className="w-full flex h-16 border-2 border-slate-300 rounded shadow-sm overflow-hidden mb-2 items-stretch" onMouseLeave={() => setHoveredField(null)}>
                  {selectedReg.fields.map((field, idx) => {
                    const flexBasis = `${(field.width / 32) * 100}%`;
                    const isRsvd = field.name === 'RSVD';
                    return (
                      <div 
                        key={`${field.name}-${idx}`}
                        className={`flex flex-col items-center justify-center border-r last:border-r-0 border-slate-300 transition-colors cursor-crosshair
                          ${getFieldColor(field.access, isRsvd)}`}
                        style={{ flexBasis }}
                        onMouseEnter={() => setHoveredField(field)}
                      >
                        {!isRsvd && field.width > 2 && (
                          <span className="text-xs font-bold leading-none">{field.name}</span>
                        )}
                        {!isRsvd && field.width <= 2 && (
                          <span className="text-[10px] font-bold leading-none" style={{ writingMode: 'vertical-rl' }}>{field.name}</span>
                        )}
                        <span className="text-[9px] opacity-70 mt-1 block">
                          {field.width > 1 ? `[${field.lsb + field.width - 1}:${field.lsb}]` : `[${field.lsb}]`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Field Hover Details */}
                <div className="h-20 bg-slate-50 border border-slate-200 rounded p-3 flex items-start gap-4">
                  <Info className="text-indigo-400 mt-0.5 shrink-0" size={18} />
                  {hoveredField ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800 text-sm">{hoveredField.name}</span>
                        <span className="text-xs bg-white border border-slate-200 px-1.5 rounded text-slate-500">
                          {hoveredField.width > 1 ? `[${hoveredField.lsb + hoveredField.width - 1}:${hoveredField.lsb}]` : `[${hoveredField.lsb}]`}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          hoveredField.name === 'RSVD' ? 'bg-slate-200 text-slate-600' : 
                          hoveredField.access === 'RW' ? 'bg-emerald-100 text-emerald-700' :
                          hoveredField.access === 'RO' ? 'bg-blue-100 text-blue-700' :
                          hoveredField.access === 'WO' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                        }`}>{hoveredField.access}</span>
                      </div>
                      <p className="text-xs text-slate-600 m-0">{hoveredField.description}</p>
                      <p className="text-xs text-slate-500 mt-0.5 m-0 font-mono">Reset: {hoveredField.reset}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic m-0">Hover over a bit-field above to see details.</p>
                  )}
                </div>
              </div>

              {/* Simulation Sandbox */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded p-4">
                <h5 className="text-sm font-semibold uppercase tracking-wide text-indigo-800 mb-3 flex items-center gap-2">
                  <Play size={16} /> Simulate RAL Operations
                </h5>
                
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="bg-white border border-slate-200 p-2 rounded flex justify-between items-center">
                    <span className="text-slate-500">Reset Value:</span>
                    <span className="font-mono font-semibold text-slate-700">{selectedReg.resetValue}</span>
                  </div>
                  <div className="bg-white border border-slate-200 p-2 rounded flex justify-between items-center ring-1 ring-indigo-500/20">
                    <span className="text-indigo-600 font-medium">Mirror Value:</span>
                    <span className="font-mono font-bold text-indigo-700">{mirrorValue}</span>
                  </div>
                </div>

                <div className="flex gap-2 isolate">
                  <input 
                    type="text" 
                    value={writeVal}
                    onChange={(e) => setWriteVal(e.target.value)}
                    className="flex-1 text-sm font-mono px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={simulateWrite}
                    disabled={isSimulating}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSimulating ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Writing...</>
                    ) : (
                      <><GitMerge size={16} /> Frontdoor Write</>
                    )}
                  </button>
                </div>

                <AnimatePresence>
                  {simMessage && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 text-xs font-mono bg-slate-900 text-emerald-400 p-2 rounded border border-slate-700 whitespace-pre-wrap"
                    >
                      {'>'} {simMessage}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <Layers size={32} />
              <span className="text-sm">Select a register from the tree to view its map</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RalRegisterMapVisualizer;
