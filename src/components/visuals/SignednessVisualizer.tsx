'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label';
import { ArrowRight, ArrowDown } from 'lucide-react';

export default function SignednessVisualizer() {
    const [width, setWidth] = useState(4);
    const [value, setValue] = useState(12); // Default to a value that shows difference (e.g. 1100 = 12 or -4)
    const [isSigned, setIsSigned] = useState(false);

    // Calculate max value for the current width
    const maxVal = Math.pow(2, width) - 1;
    const safeValue = Math.min(value, maxVal);

    // Convert to binary string
    const binaryString = safeValue.toString(2).padStart(width, '0');

    // Interpret as signed (Two's complement)
    const getSignedValue = (val: number, bits: number) => {
        const msb = 1 << (bits - 1);
        return (val & msb) ? val - (1 << bits) : val;
    };

    const signedInterpretation = getSignedValue(safeValue, width);
    const unsignedInterpretation = safeValue;

    // Extension preview (extending to width + 4)
    const extWidth = width + 4;
    const unsignedExt = safeValue; // Zero extension
    const signedExt = signedInterpretation < 0
        ? (Math.pow(2, extWidth) - Math.pow(2, width)) + safeValue // Sign extension
        : safeValue;

    const unsignedExtBin = unsignedExt.toString(2).padStart(extWidth, '0');
    const signedExtBin = signedExt.toString(2).padStart(extWidth, '0');

    return (
        <Card className="w-full max-w-3xl mx-auto border-slate-700 bg-slate-900/50">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Signedness Trap Visualizer</span>
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="signed-mode" className="text-sm font-normal text-slate-400">Unsigned</Label>
                        <Switch id="signed-mode" checked={isSigned} onCheckedChange={setIsSigned} />
                        <Label htmlFor="signed-mode" className="text-sm font-bold text-emerald-400">Signed</Label>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">

                {/* Controls */}
                <div className="flex flex-wrap gap-6 p-4 bg-black/20 rounded-lg border border-white/5">
                    <div className="space-y-2">
                        <Label className="text-slate-200">Bit Width: {width}</Label>
                        <div className="flex gap-2">
                            {[4, 8, 16].map(w => (
                                <Button
                                    key={w}
                                    variant={width === w ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => { setWidth(w); setValue(Math.min(value, Math.pow(2, w) - 1)); }}
                                >
                                    {w}-bit
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 flex-1">
                        <Label className="text-slate-200">Raw Bits (Value: {safeValue})</Label>
                        <input
                            type="range"
                            min="0"
                            max={maxVal}
                            value={safeValue}
                            onChange={(e) => setValue(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="font-mono text-xl tracking-widest text-center text-cyan-400 break-all">
                            {binaryString}
                        </div>
                    </div>
                </div>

                {/* Interpretation */}
                <div className="grid md:grid-cols-2 gap-8">
                    <div className={`p-6 rounded-xl border transition-all ${!isSigned ? 'bg-emerald-500/10 border-emerald-500/50 ring-2 ring-emerald-500/20' : 'opacity-50 grayscale'}`}>
                        <h3 className="text-sm uppercase tracking-wide text-emerald-400 font-semibold mb-2">Unsigned View</h3>
                        <div className="text-4xl font-bold text-white mb-1">{unsignedInterpretation}</div>
                        <p className="text-xs text-slate-400">Treats all bits as magnitude.</p>
                    </div>

                    <div className={`p-6 rounded-xl border transition-all ${isSigned ? 'bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500/20' : 'opacity-50 grayscale'}`}>
                        <h3 className="text-sm uppercase tracking-wide text-amber-400 font-semibold mb-2">Signed View</h3>
                        <div className="text-4xl font-bold text-white mb-1">{signedInterpretation}</div>
                        <p className="text-xs text-slate-400">MSB ({binaryString[0]}) is negative weight.</p>
                    </div>
                </div>

                {/* Extension Behavior */}
                <div className="relative pt-4">
                    <div className="absolute left-1/2 -top-2 -translate-x-1/2 text-slate-500">
                        <ArrowDown />
                    </div>
                    <h3 className="text-center text-sm font-semibold text-slate-300 mb-4">
                        What happens if you assign to a {extWidth}-bit variable?
                    </h3>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <div className="font-mono text-sm text-slate-400 text-center">Zero Extension</div>
                            <div className="font-mono text-lg text-center bg-black/40 p-2 rounded border border-emerald-500/20">
                                <span className="text-emerald-500">{unsignedExtBin.slice(0, 4)}</span>
                                <span className="text-white">{unsignedExtBin.slice(4)}</span>
                            </div>
                            <p className="text-xs text-center text-slate-400">Pads with 0s.</p>
                        </div>

                        <div className="space-y-2">
                            <div className="font-mono text-sm text-slate-400 text-center">Sign Extension</div>
                            <div className="font-mono text-lg text-center bg-black/40 p-2 rounded border border-amber-500/20">
                                <span className="text-amber-500">{signedExtBin.slice(0, 4)}</span>
                                <span className="text-white">{signedExtBin.slice(4)}</span>
                            </div>
                            <p className="text-xs text-center text-slate-400">Pads with MSB ({binaryString[0]}).</p>
                        </div>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
