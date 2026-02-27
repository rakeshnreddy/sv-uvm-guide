'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, Database, Cpu, Activity, AlertTriangle, Bug } from 'lucide-react';

export default function RALPredictorVisualizer() {
    const [step, setStep] = useState(0);
    const [debugMode, setDebugMode] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isPlaying) {
            timer = setInterval(() => {
                setStep((prev) => {
                    if (prev >= 5) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1500);
        }
        return () => clearInterval(timer);
    }, [isPlaying]);

    const reset = () => {
        setStep(0);
        setIsPlaying(false);
    };

    const play = () => {
        if (step >= 5) reset();
        setIsPlaying(true);
    };

    const getStepColor = (currentStep: number, activeStep: number) => {
        if (debugMode && currentStep === 3) return 'border-red-500 text-red-500 bg-red-50';
        return activeStep >= currentStep
            ? 'border-blue-500 text-blue-700 bg-blue-50'
            : 'border-slate-300 text-slate-500 bg-white';
    };

    const getArrowColor = (currentStep: number, activeStep: number) => {
        if (debugMode && currentStep === 3) return 'text-red-500';
        return activeStep >= currentStep ? 'text-blue-500' : 'text-slate-300';
    };

    return (
        <div className="flex flex-col border border-slate-200 rounded-lg p-6 bg-slate-50 my-8 shadow-sm font-sans">
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 m-0">RAL Predictor Pipeline</h3>
                    <p className="text-sm text-slate-500 mt-1 mb-0">
                        {debugMode ? 'Debug Mode: Mismatch Analysis' : 'Standard Implicit Prediction Flow'}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { setDebugMode(!debugMode); reset(); }}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${debugMode ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                    >
                        <Bug size={16} />
                        {debugMode ? 'Exit Debug Mode' : 'Simulate Mirror Mismatch'}
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-8 relative items-center py-6">

                {/* Top Layer: Register Model */}
                <div className="flex w-full justify-between items-center px-12">
                    <div className="w-1/3 flex flex-col items-center">
                        <div className={`p-4 border-2 rounded-xl flex flex-col items-center w-full shadow-sm transition-all duration-300 ${getStepColor(0, step)}`}>
                            <Database className="mb-2" size={24} />
                            <span className="font-semibold text-center">uvm_reg_block</span>
                            <span className="text-xs mt-1 text-center opacity-80">frontdoor write()</span>
                        </div>
                        {step === 0 && <span className="text-xs mt-2 text-blue-600 font-medium">1. Sequence issues write</span>}
                    </div>

                    <div className="w-1/3 flex flex-col items-center relative">
                        {/* The actual mirror */}
                        <div className={`p-4 border-2 rounded-xl flex flex-col items-center w-full shadow-sm transition-all duration-300 z-10 ${debugMode && step >= 4 ? 'border-red-500 bg-red-50' : getStepColor(5, step)}`}>
                            <Database className="mb-2" size={24} />
                            <span className="font-semibold text-center">uvm_reg</span>
                            <span className="text-xs mt-1 text-center space-y-1">
                                <div className="flex justify-between w-full px-2">
                                    <span>Mirror:</span>
                                    <span className="font-mono bg-white px-1 rounded border border-slate-200">
                                        {step >= 5 ? (debugMode ? '0x0000' : '0x1234') : '0x0000'}
                                    </span>
                                </div>
                            </span>
                        </div>
                        {step === 5 && !debugMode && <span className="text-xs mt-2 text-blue-600 font-medium absolute -bottom-6 w-[200px] text-center">6. Mirror updated successfully</span>}
                        {step >= 4 && debugMode && <span className="text-xs mt-2 text-red-600 font-medium absolute -bottom-6 w-[200px] text-center text-nowrap"><AlertTriangle size={12} className="inline mr-1" />Mismatch: Mirror not updated</span>}
                    </div>
                </div>

                {/* Middle Vertical Arrows */}
                <div className="flex w-full justify-between px-12 relative">
                    <div className="w-1/3 flex justify-center">
                        <div className="flex flex-col items-center">
                            <div className={`w-0.5 h-16 transition-colors duration-300 ${getArrowColor(1, step)} bg-current`}></div>
                        </div>
                    </div>

                    <div className="w-1/3 flex justify-center">
                        <div className="flex flex-col items-center relative">
                            <div className={`w-0.5 h-16 transition-colors duration-300 ${getArrowColor(4, step)} bg-current flex flex-col items-center justify-end`}>
                                <div className={`w-3 h-3 rotate-45 border-t-2 border-l-2 mb-[-6px] transition-colors duration-300 ${getArrowColor(4, step)}`}></div>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Middle Layer: Predictor & Adapter */}
                <div className="flex w-full justify-between items-center px-12 relative z-10">
                    <div className="w-1/3 flex flex-col items-center">
                        {/* Empty space holder for alignment */}
                    </div>

                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4">
                        <div className={`p-4 border-2 rounded-xl flex flex-col items-center w-48 shadow-sm transition-all duration-300 ${getStepColor(4, step)}`}>
                            <Activity className="mb-2" size={24} />
                            <span className="font-semibold text-center leading-tight">uvm_reg_adapter</span>
                            <span className="text-xs mt-1 text-center opacity-80">(bus2reg)</span>
                        </div>
                    </div>

                    <div className="w-1/3 flex flex-col items-center z-10">
                        <div className={`p-4 border-2 rounded-xl flex flex-col items-center w-full shadow-sm transition-all duration-300 ${getStepColor(3, step)}`}>
                            <Cpu className="mb-2" size={24} />
                            <span className="font-semibold text-center leading-tight">uvm_reg_predictor</span>
                            <span className="text-xs mt-1 text-center opacity-80">Implicit Prediction</span>
                        </div>
                        {step === 3 && debugMode && (
                            <div className="absolute -left-10 bg-red-100 border border-red-300 text-red-800 p-2 rounded-md text-xs w-48 shadow-md mt-20 z-20">
                                <AlertTriangle size={14} className="inline mr-1" />
                                <strong>Debug Note:</strong> Is predictor's <code className="bg-red-50">map</code> or <code className="bg-red-50">adapter</code> null?
                            </div>
                        )}
                        {step === 3 && !debugMode && <span className="text-xs mt-2 text-blue-600 font-medium absolute -bottom-6 w-full text-center">4. Predictor receives item</span>}
                        {step === 4 && <span className="text-xs mt-2 text-blue-600 font-medium absolute bottom-4 -left-32 w-32 text-center -translate-x-full">5. Adapter converts format</span>}
                    </div>
                </div>

                {/* Lower Vertical Arrows */}
                <div className="flex w-full justify-between px-12 relative">
                    <div className="w-1/3 flex justify-center">
                        <div className="flex flex-col items-center">
                            <div className={`w-0.5 h-16 transition-colors duration-300 ${getArrowColor(1, step)} bg-current flex flex-col items-center justify-end`}>
                                <div className={`w-3 h-3 rotate-45 border-b-2 border-r-2 mb-[4px] transition-colors duration-300 ${getArrowColor(1, step)}`}></div>
                            </div>
                        </div>
                    </div>

                    <div className="w-1/3 flex justify-center">
                        <div className="flex flex-col items-center relative">
                            <div className={`w-0.5 h-16 transition-colors duration-300 ${getArrowColor(2, step)} bg-current`}></div>
                        </div>
                    </div>
                </div>


                {/* Bottom Layer: DUT & Bus Monitor */}
                <div className="flex w-full justify-between items-center px-12">
                    <div className="w-1/3 flex flex-col items-center z-10">
                        <div className={`p-4 bg-slate-800 text-slate-100 rounded-xl flex flex-col items-center w-full shadow-md transition-all duration-300 ${step >= 1 ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}>
                            <Cpu className="mb-2" size={24} />
                            <span className="font-semibold text-center">DUT Bus Interface</span>
                            <div className="flex -space-x-1 mt-2">
                                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                            </div>
                        </div>
                        {step === 1 && <span className="text-xs mt-2 text-blue-600 font-medium absolute -bottom-6 w-full text-center">2. Bus transaction executes</span>}
                    </div>

                    {/* Bottom horizontal arrow */}
                    <div className="flex-1 flex justify-center items-center px-2 relative">
                        <div className={`h-0.5 w-full transition-colors duration-300 ${getArrowColor(2, step)} bg-current flex items-center justify-end`}>
                            <div className={`w-3 h-3 rotate-45 border-t-2 border-r-2 mr-[2px] mt-[-1px] transition-colors duration-300 ${getArrowColor(2, step)}`}></div>
                        </div>
                        {step === 2 && debugMode && (
                            <div className="absolute -top-12 bg-red-100 border border-red-300 text-red-800 p-2 rounded-md text-xs w-48 shadow-md text-center">
                                <AlertTriangle size={14} className="inline mr-1" />
                                Is AP connected downstream in connect_phase?
                            </div>
                        )}
                    </div>

                    <div className="w-1/3 flex flex-col items-center">
                        <div className={`p-4 border-2 rounded-xl flex flex-col items-center w-full shadow-sm transition-all duration-300 ${getStepColor(2, step)}`}>
                            <Activity className="mb-2" size={24} />
                            <span className="font-semibold text-center">uvm_monitor</span>
                            <span className="text-xs mt-1 text-center opacity-80">Analysis Port (AP)</span>
                        </div>
                        {step === 2 && !debugMode && <span className="text-xs mt-2 text-blue-600 font-medium absolute -bottom-6 w-full text-center">3. Monitor broadcasts item</span>}
                    </div>
                </div>

            </div>

            {/* Controls */}
            <div className="flex justify-center items-center gap-4 mt-8 pt-4 border-t border-slate-200">
                <button
                    onClick={() => setStep(Math.max(0, step - 1))}
                    disabled={step === 0 || isPlaying}
                    className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                    Previous
                </button>

                <button
                    onClick={isPlaying ? () => setIsPlaying(false) : play}
                    disabled={step >= 5 && !isPlaying}
                    className="px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
                >
                    {isPlaying ? 'Pause' : step >= 5 ? 'Finished' : step === 0 ? 'Start Flow' : 'Play Flow'}
                </button>

                <button
                    onClick={() => setStep(Math.min(5, step + 1))}
                    disabled={step >= 5 || isPlaying || (debugMode && step >= 3)}
                    className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                    Next
                </button>

                <button
                    onClick={reset}
                    className="ml-4 px-3 py-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-sm font-medium transition-colors"
                >
                    Reset
                </button>
            </div>

            {/* Current Step Description */}
            <div className="mt-4 text-center text-sm min-h-[40px] flex items-center justify-center">
                {step === 0 && <span className="text-slate-600">Idle state. Waiting for sequence to issue a frontdoor <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">write()</code>.</span>}
                {step === 1 && <span className="text-slate-600">The adapter converts <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">uvm_reg_bus_op</code> to a bus item, and the driver applies it to the DUT.</span>}
                {step === 2 && <span className="text-slate-600">The bus monitor observes the physical transaction and writes the item to its analysis port.</span>}
                {step === 3 && !debugMode && <span className="text-slate-600">The predictor receives the bus item via its <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">bus_in</code> analysis export.</span>}
                {step === 3 && debugMode && <span className="text-red-600 font-medium">Pipeline Break: Predictor drops item! Often caused by missing <code className="text-xs bg-red-50 border border-red-200 px-1 py-0.5 rounded">connect_phase</code> hookup or null proxy handles.</span>}
                {step === 4 && <span className="text-slate-600">The predictor uses the adapter's <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">bus2reg</code> function to convert it back to a generic register operation.</span>}
                {step === 5 && !debugMode && <span className="text-slate-800 font-medium whitespace-nowrap"><span className="text-green-600">✓ Success:</span> The specific <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">uvm_reg</code> mirror is implicitly updated.</span>}
            </div>
        </div>
    );
}
