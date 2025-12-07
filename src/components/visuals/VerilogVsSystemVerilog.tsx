'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Check, X, ArrowRight } from 'lucide-react';

export default function VerilogVsSystemVerilog() {
    const [feature, setFeature] = useState<'datatypes' | 'oop' | 'assertions' | 'randomization'>('datatypes');

    const content = {
        datatypes: {
            title: "Data Types",
            verilog: {
                code: "reg [7:0] a;\nwire [7:0] b;\ninteger i;",
                desc: "Limited to 'reg' and 'wire'. Confusing rules on where to use which. No complex structures."
            },
            sv: {
                code: "logic [7:0] a;\nbit [7:0] b;\nstruct { int x, y; } point;\nenum { IDLE, RUN } state;",
                desc: "Unified 'logic' type. Added 'bit', 'byte', 'int'. Native support for structs, enums, and unions."
            }
        },
        oop: {
            title: "Object Oriented Programming",
            verilog: {
                code: "// Not supported\n// Must use modules\n// and static tasks",
                desc: "No classes. Hard to create reusable, dynamic testbench components. Data and methods are separated."
            },
            sv: {
                code: "class Packet;\n  rand bit [31:0] addr;\n  function void print();\nendclass",
                desc: "Full OOP support: Classes, Inheritance, Polymorphism. Essential for UVM and modern verification."
            }
        },
        assertions: {
            title: "Assertions",
            verilog: {
                code: "if (req && !gnt) begin\n  $display(\"Error!\");\nend",
                desc: "Procedural checks only. Hard to express temporal logic (e.g., 'A must happen 3 cycles after B')."
            },
            sv: {
                code: "assert property (\n  @(posedge clk) req |-> ##3 gnt\n);",
                desc: "SystemVerilog Assertions (SVA). Concise syntax for complex temporal relationships. Native simulator support."
            }
        },
        randomization: {
            title: "Randomization",
            verilog: {
                code: "a = $random;\nif (a > 100) a = 100;",
                desc: "Simple random number generation. Constraints must be manually coded using loops and if-statements."
            },
            sv: {
                code: "constraint c_addr {\n  addr inside {[0:100]};\n  addr % 4 == 0;\n}",
                desc: "Constraint Solver. Declarative constraints allow the tool to find valid solutions automatically."
            }
        }
    };

    return (
        <Card className="my-8 border-slate-700 bg-slate-900 text-slate-100" data-testid="verilog-vs-sv">
            <CardHeader>
                <CardTitle className="text-center text-xl text-sky-400">Verilog vs. SystemVerilog</CardTitle>
            </CardHeader>
            <CardContent>
                {/* Navigation */}
                <div className="mb-8 flex flex-wrap justify-center gap-2">
                    {Object.keys(content).map((key) => (
                        <Button
                            key={key}
                            variant={feature === key ? "default" : "outline"}
                            onClick={() => setFeature(key as any)}
                            className="capitalize"
                        >
                            {content[key as keyof typeof content].title}
                        </Button>
                    ))}
                </div>

                {/* Comparison Grid */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Verilog Side */}
                    <div className="rounded-lg border border-red-900/50 bg-red-950/10 p-4">
                        <div className="mb-4 flex items-center justify-between border-b border-red-900/30 pb-2">
                            <span className="font-bold text-red-400">Verilog (1995/2001)</span>
                            <X className="h-5 w-5 text-red-500" />
                        </div>
                        <pre className="mb-4 overflow-x-auto rounded bg-black/50 p-3 font-mono text-sm text-red-200">
                            {content[feature].verilog.code}
                        </pre>
                        <p className="text-sm text-slate-400">{content[feature].verilog.desc}</p>
                    </div>

                    {/* SystemVerilog Side */}
                    <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/10 p-4">
                        <div className="mb-4 flex items-center justify-between border-b border-emerald-900/30 pb-2">
                            <span className="font-bold text-emerald-400">SystemVerilog (2005+)</span>
                            <Check className="h-5 w-5 text-emerald-500" />
                        </div>
                        <pre className="mb-4 overflow-x-auto rounded bg-black/50 p-3 font-mono text-sm text-emerald-200">
                            {content[feature].sv.code}
                        </pre>
                        <p className="text-sm text-slate-400">{content[feature].sv.desc}</p>
                    </div>
                </div>

                <div className="mt-8 text-center text-sm text-slate-500">
                    SystemVerilog is a superset of Verilog. All Verilog code is valid SystemVerilog.
                </div>
            </CardContent>
        </Card>
    );
}
