'use client';

import React, { useState } from 'react';

export default function VirtualSequencerExplorer() {
    const [activeStep, setActiveStep] = useState(0);

    const steps = [
        { title: "Idle", description: "The system is idle. Virtual Sequencer holds handles to Agent Sequencers." },
        { title: "Start Virtual Sequence", description: "The Virtual Sequence begins execution on the Virtual Sequencer." },
        { title: "Dispatch PCIe", description: "Virtual Sequence starts a sequence on the PCIe Agent's Sequencer." },
        { title: "Dispatch Ethernet", description: "Concurrently, it starts a sequence on the Ethernet Agent's Sequencer." },
        { title: "Coordination Complete", description: "Both sequences finish. The Virtual Sequence completes." }
    ];

    const handleNext = () => {
        setActiveStep((prev: number) => (prev < steps.length - 1 ? prev + 1 : 0));
    };

    return (
        <div className="p-6 border rounded-xl shadow-lg bg-zinc-900 text-white font-sans my-8">
            <h3 className="text-xl font-bold mb-4 text-blue-400">Virtual Sequencer Explorer</h3>
            <p className="text-gray-300 mb-6">{steps[activeStep].description}</p>

            <div className="flex flex-col md:flex-row gap-8 items-center justify-center mb-8 relative border p-6 rounded-lg bg-zinc-800">

                {/* Virtual Sequence Box */}
                <div className={`p-4 rounded border-2 transition-all duration-500 z-10 
          ${activeStep >= 1 && activeStep < 4 ? 'border-blue-400 bg-blue-900/40 shadow-[0_0_15px_rgba(96,165,250,0.5)]' : 'border-gray-600 bg-gray-800'}`}>
                    <div className="font-semibold text-center pb-2 border-b border-gray-600 mb-2">Virtual Sequence</div>
                    {activeStep >= 1 ? <div className="text-xs text-blue-300">Running body()</div> : <div className="text-xs text-gray-500 text-center">Idle</div>}
                </div>

                {/* Lines/Arrows Area */}
                <div className="hidden md:flex flex-col items-center justify-center w-24 relative h-32">
                    {/* Arrow to PCIe */}
                    <div className={`absolute top-4 w-full h-0.5 transition-all duration-300 origin-left 
            ${activeStep >= 2 ? 'bg-green-400' : 'bg-gray-700'}`}></div>
                    <div className={`absolute right-0 top-[11px] border-solid border-l-8 border-y-transparent border-y-[6px] border-r-0 transition-colors duration-300
            ${activeStep >= 2 ? 'border-l-green-400' : 'border-l-gray-700'}`}></div>

                    {/* Arrow to Ethernet */}
                    <div className={`absolute bottom-6 w-full h-0.5 transition-all duration-300 origin-left 
            ${activeStep >= 3 ? 'bg-purple-400' : 'bg-gray-700'}`}></div>
                    <div className={`absolute right-0 bottom-[19px] border-solid border-l-8 border-y-transparent border-y-[6px] border-r-0 transition-colors duration-300
            ${activeStep >= 3 ? 'border-l-purple-400' : 'border-l-gray-700'}`}></div>
                </div>

                {/* Target Sequencers */}
                <div className="flex flex-col gap-6 z-10 w-48">
                    <div className={`p-4 rounded border-2 transition-all duration-500 
            ${activeStep >= 2 ? 'border-green-400 bg-green-900/40 shadow-[0_0_15px_rgba(74,222,128,0.5)]' : 'border-gray-600 bg-gray-800'}`}>
                        <div className="font-semibold text-center">PCIe Sequencer</div>
                        {activeStep >= 2 && <div className="text-xs text-green-300 mt-2 text-center animate-pulse">Running pci_seq</div>}
                    </div>

                    <div className={`p-4 rounded border-2 transition-all duration-500 
            ${activeStep >= 3 ? 'border-purple-400 bg-purple-900/40 shadow-[0_0_15px_rgba(192,132,252,0.5)]' : 'border-gray-600 bg-gray-800'}`}>
                        <div className="font-semibold text-center">Ethernet Sequencer</div>
                        {activeStep >= 3 && <div className="text-xs text-purple-300 mt-2 text-center animate-pulse">Running eth_seq</div>}
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center bg-zinc-950 p-4 rounded border border-zinc-800">
                <div className="text-sm font-medium text-gray-400">
                    Step {activeStep + 1} of {steps.length}: <span className="text-white">{steps[activeStep].title}</span>
                </div>
                <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
                >
                    {activeStep === steps.length - 1 ? 'Restart' : 'Next Step'}
                </button>
            </div>
        </div>
    );
}
