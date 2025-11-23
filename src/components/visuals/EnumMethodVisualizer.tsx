'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';

const ENUM_VALUES = ["IDLE", "START", "BUSY", "ERROR"];

export default function EnumMethodVisualizer() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [lastAction, setLastAction] = useState("Initial State");
    const [resultDisplay, setResultDisplay] = useState("IDLE");

    const handleMethod = (method: string) => {
        let newIndex = currentIndex;
        let display = "";
        let action = "";

        switch (method) {
            case "first":
                newIndex = 0;
                display = ENUM_VALUES[0];
                action = "state.first()";
                break;
            case "last":
                newIndex = ENUM_VALUES.length - 1;
                display = ENUM_VALUES[ENUM_VALUES.length - 1];
                action = "state.last()";
                break;
            case "next":
                // SV next() wraps around
                newIndex = (currentIndex + 1) % ENUM_VALUES.length;
                display = ENUM_VALUES[newIndex];
                action = "state.next()";
                break;
            case "prev":
                // SV prev() wraps around
                newIndex = (currentIndex - 1 + ENUM_VALUES.length) % ENUM_VALUES.length;
                display = ENUM_VALUES[newIndex];
                action = "state.prev()";
                break;
            case "name":
                // Does not change state, just returns string
                display = `"${ENUM_VALUES[currentIndex]}"`;
                action = "state.name()";
                break;
        }

        if (method !== "name") {
            setCurrentIndex(newIndex);
        }
        setResultDisplay(display);
        setLastAction(action);
    };

    return (
        <Card className="my-8 border-slate-700 bg-slate-900 text-slate-100">
            <CardHeader>
                <CardTitle className="text-purple-400">Enum Method Visualizer</CardTitle>
                <p className="text-xs font-mono text-slate-400">typedef enum &#123; IDLE, START, BUSY, ERROR &#125; state_e;</p>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Visualization of Enum States */}
                <div className="flex flex-wrap justify-center gap-4">
                    {ENUM_VALUES.map((val, idx) => (
                        <div
                            key={val}
                            className={`relative flex h-16 w-20 items-center justify-center rounded-lg border-2 transition-all duration-300 ${idx === currentIndex
                                    ? "border-purple-500 bg-purple-500/20 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-110"
                                    : "border-slate-700 bg-slate-800 text-slate-500"
                                }`}
                        >
                            <span className="font-bold">{val}</span>
                            {idx === currentIndex && (
                                <div className="absolute -bottom-6 text-[10px] text-purple-400">Current</div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => handleMethod("first")} variant="outline" className="border-slate-600 hover:bg-slate-800">
                        .first()
                    </Button>
                    <Button onClick={() => handleMethod("prev")} variant="outline" className="border-slate-600 hover:bg-slate-800">
                        .prev()
                    </Button>
                    <Button onClick={() => handleMethod("next")} variant="outline" className="border-slate-600 hover:bg-slate-800">
                        .next()
                    </Button>
                    <Button onClick={() => handleMethod("last")} variant="outline" className="border-slate-600 hover:bg-slate-800">
                        .last()
                    </Button>
                    <div className="w-4" /> {/* Spacer */}
                    <Button onClick={() => handleMethod("name")} variant="secondary" className="bg-sky-600 text-white hover:bg-sky-700">
                        .name()
                    </Button>
                </div>

                {/* Result Panel */}
                <div className="flex items-center justify-center gap-4 rounded bg-black/40 p-4 font-mono">
                    <span className="text-slate-400">{lastAction}</span>
                    <ArrowRight className="h-4 w-4 text-slate-600" />
                    <span className="text-xl font-bold text-emerald-400">{resultDisplay}</span>
                </div>
            </CardContent>
        </Card>
    );
}
