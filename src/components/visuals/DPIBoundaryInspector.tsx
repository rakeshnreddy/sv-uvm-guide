'use client';

import React, { useState } from 'react';
import { ArrowLeftRight, Clock, AlertCircle, FileCode, CheckCircle2 } from 'lucide-react';

type FlowState = 'idle' | 'sv_call' | 'marshal_in' | 'c_exec' | 'marshal_out' | 'sv_resume';

export default function DPIBoundaryInspector() {
    const [flowState, setFlowState] = useState<FlowState>('idle');
    const [functionType, setFunctionType] = useState<'pure' | 'context' | 'standard'>('standard');
    const [showHazard, setShowHazard] = useState(false);

    const runFlow = () => {
        setShowHazard(false);
        setFlowState('sv_call');

        setTimeout(() => {
            setFlowState('marshal_in');
            setTimeout(() => {
                setFlowState('c_exec');
                setTimeout(() => {
                    if (showHazard || (functionType !== 'pure' && Math.random() > 0.7)) {
                        setShowHazard(true);
                        return; // Halt flow to show hazard
                    }
                    setFlowState('marshal_out');
                    setTimeout(() => setFlowState('sv_resume'), 1200);
                }, 1500);
            }, 1200);
        }, 1000);
    };

    const getSvBoxStyle = () => {
        switch (flowState) {
            case 'idle': return 'border-slate-300 bg-white text-slate-700';
            case 'sv_call': return 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-200';
            case 'marshal_in': return 'border-slate-300 bg-slate-50 text-slate-400'; // Waiting
            case 'c_exec': return 'border-slate-300 bg-slate-50 text-slate-400'; // Waiting
            case 'marshal_out': return 'border-blue-300 bg-white text-blue-600';
            case 'sv_resume': return 'border-green-500 bg-green-50 text-green-800 ring-2 ring-green-200';
            default: return '';
        }
    };

    const getCBoxStyle = () => {
        switch (flowState) {
            case 'idle': return 'border-slate-300 bg-white text-slate-700';
            case 'sv_call': return 'border-slate-300 bg-white text-slate-500';
            case 'marshal_in': return 'border-purple-300 bg-white text-purple-600';
            case 'c_exec': return 'border-purple-500 bg-purple-50 text-purple-800 ring-2 ring-purple-200';
            case 'marshal_out': return 'border-slate-300 bg-slate-50 text-slate-400';
            case 'sv_resume': return 'border-slate-300 bg-white text-slate-700';
            default: return '';
        }
    };

    const getBoundaryStyle = () => {
        if (flowState === 'marshal_in') return 'bg-gradient-to-r from-blue-400 to-purple-400 opacity-100 scale-105';
        if (flowState === 'marshal_out') return 'bg-gradient-to-l from-purple-400 to-green-400 opacity-100 scale-105';
        return 'bg-slate-200 opacity-50';
    };

    return (
        <div className="flex flex-col border border-slate-200 rounded-lg p-6 bg-slate-50 my-8 shadow-sm font-sans w-full">
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 m-0">DPI Boundary Inspector</h3>
                    <p className="text-sm text-slate-500 mt-1 mb-0">
                        SystemVerilog ↔ C Call Flow & Type Marshaling
                    </p>
                </div>

                <div className="flex bg-slate-200 p-1 rounded-md">
                    <button
                        onClick={() => setFunctionType('pure')}
                        className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${functionType === 'pure' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        pure function
                    </button>
                    <button
                        onClick={() => setFunctionType('context')}
                        className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${functionType === 'context' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        context function
                    </button>
                    <button
                        onClick={() => setFunctionType('standard')}
                        className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${functionType === 'standard' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        standard function
                    </button>
                </div>
            </div>

            <div className="relative flex items-center justify-between w-full mt-4 mb-12 px-8">

                {/* SystemVerilog Side */}
                <div className={`w-1/3 flex flex-col items-center p-6 border-2 rounded-xl transition-all duration-300 ${getSvBoxStyle()}`}>
                    <FileCode size={32} className="mb-3" />
                    <h4 className="font-bold text-lg m-0">SystemVerilog</h4>
                    <div className="text-xs font-mono mt-3 text-center bg-white/50 px-2 py-1 rounded">
                        {flowState === 'idle' && 'ready'}
                        {flowState === 'sv_call' && 'c_add(a, b);'}
                        {flowState === 'marshal_in' && '// Thread blocked'}
                        {flowState === 'c_exec' && '// Waiting on C...'}
                        {flowState === 'marshal_out' && 'int result = ...'}
                        {flowState === 'sv_resume' && 'result received'}
                    </div>
                </div>

                {/* The DPI Boundary */}
                <div className="w-1/3 flex flex-col items-center justify-center relative h-32">

                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-full h-8 transition-all duration-500 rounded-full flex items-center justify-center text-white font-bold text-xs tracking-wider ${getBoundaryStyle()}`}>
                            DPI BOUNDARY
                        </div>
                    </div>

                    {/* Animating Data Package -> */}
                    <div className={`absolute top-4 bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-mono px-2 py-1 rounded transition-all duration-1000 ease-in-out z-10 
            ${flowState === 'idle' ? 'opacity-0 left-0' : ''}
            ${flowState === 'sv_call' ? 'opacity-100 left-0' : ''}
            ${flowState === 'marshal_in' ? 'opacity-100 left-1/2 -translate-x-1/2 scale-110 shadow-md' : ''}
            ${flowState === 'c_exec' || flowState === 'marshal_out' || flowState === 'sv_resume' ? 'opacity-0 left-full -translate-x-full' : ''}
          `}>
                        svLogicVecVal a, b
                    </div>

                    {/* Animating Data Package <- */}
                    <div className={`absolute bottom-4 bg-green-100 text-green-800 border border-green-300 text-[10px] font-mono px-2 py-1 rounded transition-all duration-1000 ease-in-out z-10 
            ${flowState !== 'marshal_out' && flowState !== 'sv_resume' ? 'opacity-0 right-0' : ''}
            ${flowState === 'marshal_out' ? 'opacity-100 left-1/2 -translate-x-1/2 scale-110 shadow-md' : ''}
            ${flowState === 'sv_resume' ? 'opacity-100 left-0' : ''}
          `}>
                        return int
                    </div>
                </div>

                {/* C Side */}
                <div className={`w-1/3 flex flex-col items-center p-6 border-2 rounded-xl transition-all duration-300 ${getCBoxStyle()}`}>
                    <FileCode size={32} className="mb-3" />
                    <h4 className="font-bold text-lg m-0">C / C++</h4>
                    <div className="text-xs font-mono mt-3 text-center bg-white/50 px-2 py-1 rounded">
                        {flowState === 'idle' || flowState === 'sv_call' ? 'ready' : ''}
                        {flowState === 'marshal_in' ? 'allocating stack...' : ''}
                        {flowState === 'c_exec' ? 'return a + b;' : ''}
                        {flowState === 'marshal_out' || flowState === 'sv_resume' ? 'completed' : ''}
                    </div>
                </div>

            </div>

            {/* Hazard Warning Overlay */}
            {showHazard && (
                <div className="absolute inset-0 bg-red-500/10 backdrop-blur-[1px] rounded-lg flex items-center justify-center z-20">
                    <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center max-w-sm border-2 border-red-500 text-center animate-in zoom-in duration-200">
                        <AlertCircle size={40} className="text-red-500 mb-3" />
                        <h4 className="font-bold text-red-700 m-0 mb-2">Simulation Blocked!</h4>
                        <p className="text-sm text-slate-600 m-0">
                            The C function is taking too long to return. Because it is <strong>not</strong> exported as an SV task, it executes in 0 simulation time but blocks the entire simulator thread. No other SV processes can evaluate!
                        </p>
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => { setShowHazard(false); setFlowState('idle'); }} className="px-4 py-2 bg-slate-200 text-slate-700 font-medium text-sm rounded hover:bg-slate-300 transition-colors">Abort Test</button>
                            <button onClick={() => { setShowHazard(false); setFlowState('marshal_out'); setTimeout(() => setFlowState('sv_resume'), 1200); }} className="px-4 py-2 bg-red-600 text-white font-medium text-sm rounded hover:bg-red-700 transition-colors">Force Return</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status & Explanation */}
            <div className="bg-slate-100 rounded-md p-4 min-h-[100px] flex gap-4 items-start border border-slate-200">
                <div className="bg-indigo-100 p-2 rounded-full text-indigo-600 mt-1 shrink-0">
                    <Clock size={18} />
                </div>
                <div>
                    <h5 className="font-bold text-slate-700 text-sm m-0 mb-1">
                        {flowState === 'idle' && 'Ready to Execute'}
                        {flowState === 'sv_call' && '1. SystemVerilog Call'}
                        {flowState === 'marshal_in' && '2. Type Marshaling (Inbound)'}
                        {flowState === 'c_exec' && '3. C Function Execution'}
                        {flowState === 'marshal_out' && '4. Type Marshaling (Outbound)'}
                        {flowState === 'sv_resume' && '5. SV Simulation Resumes'}
                    </h5>
                    <p className="text-sm text-slate-600 m-0 leading-relaxed">
                        {flowState === 'idle' && 'Click "Run DPI Call" to visualize the flow.'}
                        {flowState === 'sv_call' && 'SV suspends process execution and prepares arguments for the C domain.'}
                        {flowState === 'marshal_in' && 'The simulator translates SV types (like 4-state logic) into C-compatible types (like svLogicVecVal).'}
                        {flowState === 'c_exec' &&
                            <span className="flex flex-col gap-1">
                                <span>The C function executes. SV simulator time is frozen.</span>
                                {functionType === 'pure' && <span className="text-green-600 text-xs font-semibold">✓ Pure function: guarantees no side-effects or SV state reads. Highly optimized.</span>}
                                {functionType === 'context' && <span className="text-orange-600 text-xs font-semibold">! Context function: C code can call back into SV tasks/functions and read simulation state. Slower.</span>}
                            </span>
                        }
                        {flowState === 'marshal_out' && 'The return value is packed back into an SV-compatible memory layout.'}
                        {flowState === 'sv_resume' && 'The SV process unblocks and continues execution with the new result.'}
                    </p>
                </div>
            </div>

            <div className="mt-6 flex justify-center gap-4">
                <button
                    onClick={() => { setFlowState('idle'); setShowHazard(false); }}
                    className="px-4 py-2 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium text-sm transition-colors"
                >
                    Reset
                </button>
                <button
                    onClick={runFlow}
                    disabled={flowState !== 'idle' && flowState !== 'sv_resume'}
                    className="px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors flex items-center gap-2"
                >
                    {flowState !== 'idle' && flowState !== 'sv_resume' ? 'Executing...' : 'Run DPI Call'}
                    <ArrowLeftRight size={16} />
                </button>
                <button
                    onClick={() => setShowHazard(true)}
                    className="px-4 py-2 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-medium text-sm transition-colors flex items-center gap-2"
                >
                    Force Hazard Demo
                    <AlertCircle size={16} />
                </button>
            </div>
        </div>
    );
}
