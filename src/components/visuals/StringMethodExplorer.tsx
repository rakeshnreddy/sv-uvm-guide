"use client";

import React, { useId, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { callStringMethod, type StringMethod, type StringMethodResult } from "@/lib/sv-enum-string-model";

const METHODS: { method: StringMethod; label: (i: number, j: number, c: string) => string }[] = [
  { method: "len", label: () => "len()" },
  { method: "toupper", label: () => "toupper()" },
  { method: "tolower", label: () => "tolower()" },
  { method: "getc", label: (i) => `getc(${i})` },
  { method: "putc", label: (i, _j, c) => (c ? `putc(${i}, "${c}")` : `putc(${i}, 8'd0)`) },
  { method: "substr", label: (i, j) => `substr(${i}, ${j})` },
];

const inputClass =
  "h-10 w-full rounded-md border border-border/70 bg-background px-2 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [font-variant-ligatures:none]";

export default function StringMethodExplorer() {
  const ids = { s: useId(), i: useId(), j: useId(), c: useId() };
  const [s, setS] = useState("SystemVerilog");
  const [i, setI] = useState(0);
  const [j, setJ] = useState(5);
  const [c, setC] = useState("s");
  const [result, setResult] = useState<{ before: string; r: StringMethodResult } | null>(null);

  const run = (method: StringMethod) => {
    const r = callStringMethod(s, method, { i, j, c });
    setResult({ before: s, r });
    if (r.after !== s) setS(r.after);
  };

  const toInt = (v: string) => (Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : 0);

  return (
    <VisualFrame
      label="String method explorer"
      eyebrow="Experiment"
      title="String methods, edges included"
      summary="Edit s and the indices, then call a method. Try an index past the end: string methods return a default or leave s alone instead of failing."
      fidelity="model"
      assumptions={["Follows IEEE 1800-2023 §6.16.1–§6.16.8 for len, putc, getc, toupper, tolower and substr. ASCII characters only."]}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))]">
        <div className="col-span-full">
          <label htmlFor={ids.s} className="mb-1 block text-xs font-medium text-muted-foreground">
            s (string)
          </label>
          <input id={ids.s} type="text" value={s} onChange={(e) => setS(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor={ids.i} className="mb-1 block text-xs font-medium text-muted-foreground">
            i (index)
          </label>
          <input id={ids.i} type="number" value={i} onChange={(e) => setI(toInt(e.target.value))} className={inputClass} />
        </div>
        <div>
          <label htmlFor={ids.j} className="mb-1 block text-xs font-medium text-muted-foreground">
            j (substr end)
          </label>
          <input id={ids.j} type="number" value={j} onChange={(e) => setJ(toInt(e.target.value))} className={inputClass} />
        </div>
        <div>
          <label htmlFor={ids.c} className="mb-1 block text-xs font-medium text-muted-foreground">
            c (putc character)
          </label>
          <input id={ids.c} type="text" maxLength={1} value={c} onChange={(e) => setC(e.target.value)} className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Valid indices are 0 to {s.length - 1} (s.len() = {s.length}).
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="String methods">
        {METHODS.map(({ method, label }) => (
          <button
            key={method}
            type="button"
            onClick={() => run(method)}
            className="min-h-10 rounded-md border border-border/70 px-3 font-mono text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [font-variant-ligatures:none]"
          >
            s.{label(i, j, c)}
          </button>
        ))}
      </div>

      {result ? (
        <CodeTrace
          label="SystemVerilog"
          lines={[
            { text: `string s = "${result.before}";`, key: "decl" },
            {
              text:
                result.r.returns !== undefined
                  ? `r = ${result.r.call};  // ${result.r.returns}`
                  : `${result.r.call};  // s is now "${result.r.after}"`,
              key: "call",
            },
          ]}
          activeKey="call"
        />
      ) : null}
      <div className="min-h-12 rounded-lg border border-border/70 bg-background/50 p-3 text-sm" aria-live="polite">
        {result ? (
          <>
            <p className="font-mono [font-variant-ligatures:none]">
              {result.r.call}
              {result.r.returns !== undefined ? (
                <>
                  {" "}
                  → <strong>{result.r.returns}</strong>
                </>
              ) : (
                <>
                  {" "}
                  → s = <strong>&quot;{result.r.after}&quot;</strong>
                </>
              )}
            </p>
            <p className="mt-1 text-muted-foreground">{result.r.why}</p>
          </>
        ) : (
          <p className="text-muted-foreground">Call a method to see the result.</p>
        )}
      </div>
    </VisualFrame>
  );
}
