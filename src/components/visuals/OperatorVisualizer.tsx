'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function OperatorVisualizer() {
    const [a, setA] = useState(0b1010); // 4-bit
    const [b, setB] = useState(0b1100); // 4-bit
    const [op, setOp] = useState("&");
    const [result, setResult] = useState<string>("");
    const [explanation, setExplanation] = useState("");

    // Helper to format binary
    const toBin = (val: number, width: number = 4) => {
        return val.toString(2).padStart(width, '0');
    };

    useEffect(() => {
        let res = 0;
        let exp = "";
        let resStr = "";

        switch (op) {
            case "&":
                res = a & b;
                resStr = toBin(res, 4);
                exp = "Bitwise AND: Result is 1 only if both bits are 1.";
                break;
            case "|":
                res = a | b;
                resStr = toBin(res, 4);
                exp = "Bitwise OR: Result is 1 if either bit is 1.";
                break;
            case "^":
                res = a ^ b;
                resStr = toBin(res, 4);
                exp = "Bitwise XOR: Result is 1 if bits are different.";
                break;
            case "~&":
                res = ~(a & b) & 0xF; // Mask to 4 bits
                resStr = toBin(res, 4);
                exp = "Bitwise NAND: Inverse of AND.";
                break;
            case "concat":
                resStr = `{${toBin(a, 4)}, ${toBin(b, 4)}} = ${toBin(a, 4)}${toBin(b, 4)}`;
                exp = "Concatenation: Joins bits together into a wider vector.";
                break;
            case "replicate":
                resStr = `{2{${toBin(a, 4)}}} = ${toBin(a, 4)}${toBin(a, 4)}`;
                exp = "Replication: Repeats the vector N times.";
                break;
            case "reduction_&":
                res = (a === 0xF) ? 1 : 0; // Simplified reduction logic for demo
                // Actual JS bitwise doesn't have reduction, so manual check
                let redAnd = 1;
                for (let i = 0; i < 4; i++) if (!((a >> i) & 1)) redAnd = 0;
                resStr = redAnd.toString();
                exp = "Reduction AND: Returns 1 if ALL bits in A are 1.";
                break;
            case "reduction_|":
                res = (a > 0) ? 1 : 0;
                resStr = res.toString();
                exp = "Reduction OR: Returns 1 if ANY bit in A is 1.";
                break;
        }
        setResult(resStr);
        setExplanation(exp);
    }, [a, b, op]);

    const toggleBit = (val: number, bit: number, setter: (v: number) => void) => {
        setter(val ^ (1 << bit));
    };

    const BitBox = ({ val, setter, label }: { val: number, setter: (v: number) => void, label: string }) => (
        <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-bold text-slate-400">{label}</span>
            <div className="flex gap-1">
                {[3, 2, 1, 0].map((i) => (
                    <button
                        key={i}
                        onClick={() => toggleBit(val, i, setter)}
                        className={`h-10 w-8 rounded border-2 text-lg font-mono transition-all ${(val >> i) & 1
                            ? "border-sky-500 bg-sky-500/20 text-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.3)]"
                            : "border-slate-700 bg-slate-800 text-slate-600 hover:border-slate-500"
                            }`}
                    >
                        {(val >> i) & 1}
                    </button>
                ))}
            </div>
            <div className="text-xs text-slate-500">Hex: {val.toString(16).toUpperCase()}</div>
        </div>
    );

    return (
        <Card className="my-8 border-slate-700 bg-slate-900 text-slate-100" data-testid="operator-visualizer">
            <CardHeader>
                <CardTitle className="text-sky-400">Operator Visualizer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="flex flex-wrap justify-center gap-12">
                    <BitBox val={a} setter={setA} label="Operand A" />
                    <BitBox val={b} setter={setB} label="Operand B" />
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setOp("&")} variant={op === "&" ? "default" : "outline"} className="w-12 font-mono">&</Button>
                    <Button onClick={() => setOp("|")} variant={op === "|" ? "default" : "outline"} className="w-12 font-mono">|</Button>
                    <Button onClick={() => setOp("^")} variant={op === "^" ? "default" : "outline"} className="w-12 font-mono">^</Button>
                    <Button onClick={() => setOp("~&")} variant={op === "~&" ? "default" : "outline"} className="w-12 font-mono">~&</Button>
                    <div className="w-4" />
                    <Button onClick={() => setOp("concat")} variant={op === "concat" ? "default" : "outline"} className="font-mono">{`{A,B}`}</Button>
                    <Button onClick={() => setOp("replicate")} variant={op === "replicate" ? "default" : "outline"} className="font-mono">{`{2{A}}`}</Button>
                    <div className="w-4" />
                    <Button onClick={() => setOp("reduction_&")} variant={op === "reduction_&" ? "default" : "outline"} className="font-mono">&A</Button>
                    <Button onClick={() => setOp("reduction_|")} variant={op === "reduction_|" ? "default" : "outline"} className="font-mono">|A</Button>
                </div>

                <div className="rounded-lg border border-slate-700 bg-black/40 p-6 text-center">
                    <div className="mb-2 text-sm text-slate-400">{explanation}</div>
                    <div className="font-mono text-3xl font-bold text-emerald-400 tracking-widest">
                        {result}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
