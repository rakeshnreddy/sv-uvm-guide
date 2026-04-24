"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";

type Transfer = {
  id: string;
  name: string;
  type: "IDLE" | "NONSEQ" | "SEQ" | "BUSY";
  addr: string;
  data: string;
  addrCycleStart: number;
  addrCycleEnd: number;
  dataCycleStart: number;
  dataCycleEnd: number;
};

type Scenario = {
  id: string;
  name: string;
  description: string;
  maxCycles: number;
  transfers: Transfer[];
};

const SCENARIOS: Record<string, Scenario> = {
  single: {
    id: "single",
    name: "Single Transfer",
    description: "A basic single transfer with no wait states.",
    maxCycles: 5,
    transfers: [
      {
        id: "t1",
        name: "A",
        type: "NONSEQ",
        addr: "0x1000",
        data: "DATA_A",
        addrCycleStart: 1,
        addrCycleEnd: 1,
        dataCycleStart: 2,
        dataCycleEnd: 2,
      },
    ],
  },
  pipeline: {
    id: "pipeline",
    name: "Pipelined Transfers",
    description: "Two back-to-back transfers showing Address/Data phase overlap.",
    maxCycles: 6,
    transfers: [
      {
        id: "t1",
        name: "A",
        type: "NONSEQ",
        addr: "0x1000",
        data: "DATA_A",
        addrCycleStart: 1,
        addrCycleEnd: 1,
        dataCycleStart: 2,
        dataCycleEnd: 2,
      },
      {
        id: "t2",
        name: "B",
        type: "NONSEQ",
        addr: "0x2000",
        data: "DATA_B",
        addrCycleStart: 2,
        addrCycleEnd: 2,
        dataCycleStart: 3,
        dataCycleEnd: 3,
      },
    ],
  },
  wait_state: {
    id: "wait_state",
    name: "Wait-State Stretching",
    description: "The slave inserts a wait state (HREADY=0), stalling the pipeline.",
    maxCycles: 7,
    transfers: [
      {
        id: "t1",
        name: "A",
        type: "NONSEQ",
        addr: "0x1000",
        data: "DATA_A",
        addrCycleStart: 1,
        addrCycleEnd: 1,
        dataCycleStart: 2,
        dataCycleEnd: 3, // Cycle 2: HREADY=0, Cycle 3: HREADY=1
      },
      {
        id: "t2",
        name: "B",
        type: "NONSEQ",
        addr: "0x2000",
        data: "DATA_B",
        addrCycleStart: 2,
        addrCycleEnd: 3, // Must hold address stable due to wait state
        dataCycleStart: 4,
        dataCycleEnd: 4,
      },
    ],
  },
  burst_incr4: {
    id: "burst_incr4",
    name: "INCR4 Burst",
    description: "A 4-beat incrementing burst.",
    maxCycles: 8,
    transfers: [
      {
        id: "t1",
        name: "1",
        type: "NONSEQ",
        addr: "0x4000",
        data: "D_0",
        addrCycleStart: 1,
        addrCycleEnd: 1,
        dataCycleStart: 2,
        dataCycleEnd: 2,
      },
      {
        id: "t2",
        name: "2",
        type: "SEQ",
        addr: "0x4004",
        data: "D_1",
        addrCycleStart: 2,
        addrCycleEnd: 2,
        dataCycleStart: 3,
        dataCycleEnd: 3,
      },
      {
        id: "t3",
        name: "3",
        type: "SEQ",
        addr: "0x4008",
        data: "D_2",
        addrCycleStart: 3,
        addrCycleEnd: 3,
        dataCycleStart: 4,
        dataCycleEnd: 4,
      },
      {
        id: "t4",
        name: "4",
        type: "SEQ",
        addr: "0x400C",
        data: "D_3",
        addrCycleStart: 4,
        addrCycleEnd: 4,
        dataCycleStart: 5,
        dataCycleEnd: 5,
      },
    ],
  },
};

export default function AhbPipelineBurstVisualizer() {
  const [activeScenarioId, setActiveScenarioId] = useState<string>("pipeline");
  const [currentCycle, setCurrentCycle] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const scenario = SCENARIOS[activeScenarioId];

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && currentCycle < scenario.maxCycles) {
      timer = setTimeout(() => {
        setCurrentCycle((prev) => prev + 1);
      }, 1200);
    } else if (currentCycle >= scenario.maxCycles) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentCycle, scenario.maxCycles]);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentCycle(0);
  };

  const handleScenarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveScenarioId(e.target.value);
    setIsPlaying(false);
    setCurrentCycle(0);
  };

  // Compute what is active in each cycle
  const cycles = Array.from({ length: scenario.maxCycles }, (_, i) => {
    const activeAddrTransfer = scenario.transfers.find(
      (t) => i >= t.addrCycleStart && i <= t.addrCycleEnd
    );
    const activeDataTransfer = scenario.transfers.find(
      (t) => i >= t.dataCycleStart && i <= t.dataCycleEnd
    );

    // Determine HREADY for this cycle
    // HREADY is low if any active data transfer is in its wait state (not its end cycle)
    let hready = 1; // Default to 1
    if (activeDataTransfer) {
      if (i < activeDataTransfer.dataCycleEnd) {
        hready = 0;
      }
    }

    return {
      cycleIndex: i,
      activeAddrTransfer,
      activeDataTransfer,
      hready,
    };
  });

  const activeAddrPhase = cycles[currentCycle]?.activeAddrTransfer;
  const activeDataPhase = cycles[currentCycle]?.activeDataTransfer;
  const activeHready = cycles[currentCycle]?.hready;

  return (
    <div className="w-full flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm my-8">
      {/* Header and Controls */}
      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 m-0 text-base">
            AHB Timing Visualizer
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 m-0">
            {scenario.description}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <select
            value={activeScenarioId}
            onChange={handleScenarioChange}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
            aria-label="Select Scenario"
          >
            {Object.values(SCENARIOS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentCycle((prev) => Math.max(0, prev - 1));
              }}
              disabled={currentCycle === 0}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Step Backward"
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={currentCycle >= scenario.maxCycles}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border-x border-slate-300 dark:border-slate-700 transition-colors"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentCycle((prev) => Math.min(scenario.maxCycles - 1, prev + 1));
              }}
              disabled={currentCycle >= scenario.maxCycles - 1}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border-r border-slate-300 dark:border-slate-700 transition-colors"
              title="Step Forward"
            >
              <SkipForward size={18} />
            </button>
            <button
              onClick={handleReset}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Reset"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="p-6 overflow-x-auto min-w-[600px]">
        <div className="flex relative">
          {/* Row Labels */}
          <div className="w-32 flex-shrink-0 flex flex-col justify-between font-mono text-xs text-slate-500 dark:text-slate-400 py-2 font-medium z-10 bg-white dark:bg-slate-950">
            <div className="h-10 flex items-center border-b border-transparent">HCLK</div>
            <div className="h-20 flex items-center border-b border-transparent">Address Phase<br />(HADDR, HTRANS)</div>
            <div className="h-20 flex items-center border-b border-transparent">Data Phase<br />(HWDATA)</div>
            <div className="h-10 flex items-center">HREADY</div>
          </div>

          {/* Timeline Grid */}
          <div className="flex-grow flex relative ml-2">
            {cycles.map((cycle) => (
              <div
                key={cycle.cycleIndex}
                className={`flex-1 min-w-[80px] border-l border-slate-200 dark:border-slate-800 relative transition-colors duration-300 ${
                  cycle.cycleIndex === currentCycle
                    ? "bg-blue-50/50 dark:bg-blue-900/10"
                    : ""
                }`}
              >
                {/* Clock indicator */}
                <div className="h-10 flex items-center justify-center border-b border-slate-200 dark:border-slate-800">
                  <span className={`text-xs font-mono font-medium ${
                    cycle.cycleIndex <= currentCycle ? "text-slate-800 dark:text-slate-200" : "text-slate-300 dark:text-slate-700"
                  }`}>
                    T{cycle.cycleIndex}
                  </span>
                </div>

                {/* Address Phase Row */}
                <div className="h-20 border-b border-slate-200 dark:border-slate-800 p-2 flex items-center justify-center relative">
                  <AnimatePresence>
                    {cycle.activeAddrTransfer && cycle.cycleIndex <= currentCycle && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`w-full h-full rounded-md flex flex-col items-center justify-center text-xs font-mono font-bold shadow-sm ${
                          cycle.activeAddrTransfer.id === "t1" ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700" :
                          cycle.activeAddrTransfer.id === "t2" ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700" :
                          cycle.activeAddrTransfer.id === "t3" ? "bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700" :
                          "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700"
                        }`}
                      >
                        <span className="truncate w-full text-center px-1">
                          {cycle.activeAddrTransfer.type}
                        </span>
                        <span className="text-[10px] opacity-80 truncate w-full text-center px-1">
                          {cycle.activeAddrTransfer.addr}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Data Phase Row */}
                <div className="h-20 border-b border-slate-200 dark:border-slate-800 p-2 flex items-center justify-center relative">
                  <AnimatePresence>
                    {cycle.activeDataTransfer && cycle.cycleIndex <= currentCycle && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className={`w-full h-full rounded-md flex flex-col items-center justify-center text-xs font-mono font-bold shadow-sm ${
                          cycle.activeDataTransfer.id === "t1" ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700" :
                          cycle.activeDataTransfer.id === "t2" ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700" :
                          cycle.activeDataTransfer.id === "t3" ? "bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700" :
                          "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700"
                        } ${cycle.hready === 0 ? "opacity-60 border-dashed" : ""}`}
                      >
                        <span className="truncate w-full text-center px-1">
                          {cycle.activeDataTransfer.data}
                        </span>
                        {cycle.hready === 0 && (
                          <span className="text-[9px] uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-white/50 dark:bg-black/50 px-1 rounded-sm mt-1">Wait State</span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* HREADY Row */}
                <div className="h-10 flex items-center justify-center">
                  {cycle.cycleIndex <= currentCycle && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`font-mono text-sm font-bold ${
                        cycle.hready === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {cycle.hready}
                    </motion.span>
                  )}
                </div>

                {/* Active Cycle Cursor Line */}
                {cycle.cycleIndex === currentCycle && (
                  <motion.div
                    layoutId="activeCycle"
                    className="absolute top-0 bottom-0 left-0 w-[2px] bg-blue-500 dark:bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)] z-20"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status Log Panel */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-800 text-sm">
        <div className="flex items-center gap-2 font-mono text-blue-600 dark:text-blue-400 mb-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          Cycle {currentCycle} Status
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700 dark:text-slate-300 h-[60px]">
          <div>
            <span className="font-semibold block mb-1">Address Bus</span>
            {activeAddrPhase ? (
              <span>Broadcasting <strong className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded">{activeAddrPhase.type}</strong> for Transfer {activeAddrPhase.name} to <strong className="font-mono">{activeAddrPhase.addr}</strong></span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 italic">IDLE</span>
            )}
          </div>
          <div>
            <span className="font-semibold block mb-1">Data Bus</span>
            {activeDataPhase ? (
              <span>
                Processing Data for Transfer {activeDataPhase.name} <strong className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded">{activeDataPhase.data}</strong>. 
                {activeHready === 0 ? (
                  <span className="text-rose-600 dark:text-rose-400 font-medium ml-1">Slave needs more time (HREADY=0).</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">Data sampled (HREADY=1).</span>
                )}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 italic">No valid data being transferred.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
