'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';

export default function ArrayMethodExplorer() {
    const [array, setArray] = useState<number[]>([42, 15, 8, 15, 23, 4, 8, 99]);
    const [result, setResult] = useState<string>("");
    const [highlightIndices, setHighlightIndices] = useState<number[]>([]);
    const [lastAction, setLastAction] = useState("Initial Array");

    const resetArray = () => {
        setArray([42, 15, 8, 15, 23, 4, 8, 99]);
        setResult("");
        setHighlightIndices([]);
        setLastAction("Reset");
    };

    const handleMethod = (method: string) => {
        let resStr = "";
        let indices: number[] = [];
        let newArr = [...array];

        switch (method) {
            case "sort":
                newArr.sort((a, b) => a - b);
                setArray(newArr);
                resStr = "Array sorted in ascending order.";
                setLastAction("q.sort()");
                break;
            case "rsort":
                newArr.sort((a, b) => b - a);
                setArray(newArr);
                resStr = "Array sorted in descending order.";
                setLastAction("q.rsort()");
                break;
            case "reverse":
                newArr.reverse();
                setArray(newArr);
                resStr = "Array reversed.";
                setLastAction("q.reverse()");
                break;
            case "shuffle":
                newArr.sort(() => Math.random() - 0.5);
                setArray(newArr);
                resStr = "Array shuffled.";
                setLastAction("q.shuffle()");
                break;
            case "unique":
                // SV unique returns a queue of unique values
                const uniqueVals = Array.from(new Set(array));
                resStr = `Unique values: { ${uniqueVals.join(", ")} }`;
                setLastAction("q.unique()");
                break;
            case "sum":
                const sum = array.reduce((a, b) => a + b, 0);
                resStr = `Sum: ${sum}`;
                setLastAction("q.sum()");
                break;
            case "max":
                const max = Math.max(...array);
                resStr = `Max: ${max}`;
                // Highlight max values
                array.forEach((v, i) => { if (v === max) indices.push(i); });
                setHighlightIndices(indices);
                setLastAction("q.max()");
                break;
            case "min":
                const min = Math.min(...array);
                resStr = `Min: ${min}`;
                array.forEach((v, i) => { if (v === min) indices.push(i); });
                setHighlightIndices(indices);
                setLastAction("q.min()");
                break;
            case "find_gt_20":
                const found = array.filter(x => x > 20);
                resStr = `Found (x > 20): { ${found.join(", ")} }`;
                array.forEach((v, i) => { if (v > 20) indices.push(i); });
                setHighlightIndices(indices);
                setLastAction("q.find(x) with (x > 20)");
                break;
            case "find_index_eq_15":
                // SV find_index returns queue of indices
                array.forEach((v, i) => { if (v === 15) indices.push(i); });
                resStr = `Indices where x == 15: { ${indices.join(", ")} }`;
                setHighlightIndices(indices);
                setLastAction("q.find_index(x) with (x == 15)");
                break;
        }

        if (method !== "sort" && method !== "rsort" && method !== "reverse" && method !== "shuffle") {
            // For non-mutating methods (in this viz context), just show result
        } else {
            setHighlightIndices([]);
        }
        setResult(resStr);
    };

    return (
        <Card className="my-8 border-slate-700 bg-slate-900 text-slate-100" data-testid="array-method-explorer">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-orange-400">Array Method Explorer</CardTitle>
                <Button onClick={resetArray} variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset
                </Button>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Array Visualization */}
                <div className="flex flex-wrap justify-center gap-2">
                    {array.map((val, idx) => (
                        <div
                            key={idx}
                            className={`flex h-12 w-12 items-center justify-center rounded border-2 font-mono text-lg transition-all duration-300 ${highlightIndices.includes(idx)
                                ? "border-orange-500 bg-orange-500/20 text-orange-200 scale-110 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                : "border-slate-700 bg-slate-800 text-slate-400"
                                }`}
                        >
                            {val}
                        </div>
                    ))}
                </div>
                <div className="text-center text-xs text-slate-500">Index: 0 .. {array.length - 1}</div>

                {/* Controls */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Button onClick={() => handleMethod("sort")} variant="outline" className="border-slate-600 hover:bg-slate-800">sort()</Button>
                    <Button onClick={() => handleMethod("rsort")} variant="outline" className="border-slate-600 hover:bg-slate-800">rsort()</Button>
                    <Button onClick={() => handleMethod("reverse")} variant="outline" className="border-slate-600 hover:bg-slate-800">reverse()</Button>
                    <Button onClick={() => handleMethod("shuffle")} variant="outline" className="border-slate-600 hover:bg-slate-800">shuffle()</Button>

                    <Button onClick={() => handleMethod("sum")} variant="outline" className="border-slate-600 hover:bg-slate-800">sum()</Button>
                    <Button onClick={() => handleMethod("max")} variant="outline" className="border-slate-600 hover:bg-slate-800">max()</Button>
                    <Button onClick={() => handleMethod("min")} variant="outline" className="border-slate-600 hover:bg-slate-800">min()</Button>
                    <Button onClick={() => handleMethod("unique")} variant="outline" className="border-slate-600 hover:bg-slate-800">unique()</Button>

                    <Button onClick={() => handleMethod("find_gt_20")} variant="secondary" className="col-span-2 bg-sky-700 text-white hover:bg-sky-600">find(x) with (x &gt; 20)</Button>
                    <Button onClick={() => handleMethod("find_index_eq_15")} variant="secondary" className="col-span-2 bg-sky-700 text-white hover:bg-sky-600">find_index with (x == 15)</Button>
                </div>

                {/* Result Panel */}
                <div className="rounded bg-black/40 p-4 text-center">
                    <div className="mb-1 text-sm text-slate-400">{lastAction}</div>
                    <div className="font-mono text-lg font-bold text-emerald-400">{result || "Ready"}</div>
                </div>
            </CardContent>
        </Card>
    );
}
