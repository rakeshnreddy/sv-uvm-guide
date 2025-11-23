'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function StringMethodExplorer() {
    const [inputStr, setInputStr] = useState("SystemVerilog");
    const [output, setOutput] = useState("");
    const [codeSnippet, setCodeSnippet] = useState("");

    const handleMethod = (method: string) => {
        let res = "";
        let code = "";

        switch (method) {
            case "len":
                res = inputStr.length.toString();
                code = `string s = "${inputStr}";\nint len = s.len(); // ${res}`;
                break;
            case "toupper":
                res = inputStr.toUpperCase();
                code = `string s = "${inputStr}";\nstring upper = s.toupper(); // "${res}"`;
                break;
            case "tolower":
                res = inputStr.toLowerCase();
                code = `string s = "${inputStr}";\nstring lower = s.tolower(); // "${res}"`;
                break;
            case "putc":
                if (inputStr.length > 0) {
                    const chars = inputStr.split('');
                    chars[0] = 'X';
                    res = chars.join('');
                    code = `string s = "${inputStr}";\ns.putc(0, "X"); // "${res}"`;
                } else {
                    res = "Error: String is empty";
                    code = `// Cannot putc on empty string`;
                }
                break;
            case "getc":
                if (inputStr.length > 0) {
                    res = `'${inputStr.charAt(0)}' (ASCII: ${inputStr.charCodeAt(0)})`;
                    code = `string s = "${inputStr}";\nbyte c = s.getc(0); // ${res}`;
                } else {
                    res = "Error: String is empty";
                    code = `// Cannot getc from empty string`;
                }
                break;
            case "substr":
                if (inputStr.length >= 3) {
                    res = inputStr.substring(0, 3); // SV substr is inclusive, JS substring is exclusive of end
                    // Actually SV substr(i, j) returns characters from index i to j inclusive.
                    // JS substring(i, j) returns i to j-1.
                    // So SV substr(0, 2) is first 3 chars.
                    code = `string s = "${inputStr}";\nstring sub = s.substr(0, 2); // "${res}"`;
                } else {
                    res = inputStr;
                    code = `string s = "${inputStr}";\nstring sub = s.substr(0, ${inputStr.length - 1}); // "${res}"`;
                }
                break;
        }
        setOutput(res);
        setCodeSnippet(code);
    };

    return (
        <Card className="my-8 border-slate-700 bg-slate-900 text-slate-100">
            <CardHeader>
                <CardTitle className="text-sky-400">String Method Explorer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm text-slate-400">Input String (s)</label>
                    <input
                        type="text"
                        value={inputStr}
                        onChange={(e) => setInputStr(e.target.value)}
                        className="w-full rounded border border-slate-600 bg-slate-800 p-2 text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Button onClick={() => handleMethod("len")} variant="outline" className="border-slate-600 hover:bg-slate-800">
                        s.len()
                    </Button>
                    <Button onClick={() => handleMethod("toupper")} variant="outline" className="border-slate-600 hover:bg-slate-800">
                        s.toupper()
                    </Button>
                    <Button onClick={() => handleMethod("tolower")} variant="outline" className="border-slate-600 hover:bg-slate-800">
                        s.tolower()
                    </Button>
                    <Button onClick={() => handleMethod("putc")} variant="outline" className="border-slate-600 hover:bg-slate-800">
                        s.putc(0, 'X')
                    </Button>
                    <Button onClick={() => handleMethod("getc")} variant="outline" className="border-slate-600 hover:bg-slate-800">
                        s.getc(0)
                    </Button>
                    <Button onClick={() => handleMethod("substr")} variant="outline" className="border-slate-600 hover:bg-slate-800">
                        s.substr(0, 2)
                    </Button>
                </div>

                {codeSnippet && (
                    <div className="rounded bg-black/40 p-4 font-mono text-sm">
                        <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">SystemVerilog Preview</div>
                        <pre className="text-emerald-400">{codeSnippet}</pre>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
