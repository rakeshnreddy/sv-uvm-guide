"use client";

import React, { useId, useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  AHB_HBURSTS,
  AXI_BURST_TYPES,
  BRIDGE_PRESETS,
  ONE_KB,
  ahbFixedBeats,
  countAnswer,
  translatePreset,
  type AhbBurst,
  type AhbHburst,
  type BridgePreset,
  type BridgeResult,
  type BurstCountAnswer,
} from "@/lib/amba-bridge-model";
import { hex, type AxiBurstType, type BurstRequest } from "@/lib/axi-burst-model";
import { cn } from "@/lib/utils";

export const BRIDGE_ASSUMPTIONS = [
  "AHB rules from IHI0033B.b 3.4 and 3.5 (1KB rule, aligned transfers, HBURST encodings); AXI rules from IHI0022E A3.4.1 and A4.3.1.",
  "The bridge knows the length of an undefined-length AHB INCR (for example, it buffered the write). A real bridge that does not know it must issue chunks, which is a design choice.",
  "Identity address mapping; no sparse strobes; reads and writes split the same way.",
  "Reasons are tagged Protocol when a spec rule forces them and Policy when they are this bridge's design choice.",
];

const AHB_1KB_SVA = [
  "// [Protocol IHI0033B.b 3.5] an incrementing burst never crosses 1KB.",
  "// Per-transfer form, so it also covers undefined-length INCR.",
  "logic [31:0] burst_start;",
  "always_ff @(posedge HCLK) if (HREADY && HTRANS == 2'b10) burst_start <= HADDR; // NONSEQ",
  "a_ahb_no_1kb_cross: assert property (@(posedge HCLK) disable iff (!HRESETn)",
  "  HREADY && HTRANS == 2'b11 && !(HBURST inside {3'b010, 3'b100, 3'b110}) // SEQ, not WRAP",
  "  |-> HADDR[31:10] == burst_start[31:10]);",
];

const ANSWERS: { id: BurstCountAnswer; label: string }[] = [
  { id: "1", label: "1 burst" },
  { id: "2", label: "2 bursts" },
  { id: "3+", label: "3 or more bursts" },
  { id: "illegal", label: "None: the input is illegal, a checker must fire" },
];

function feedbackFor(choice: BurstCountAnswer, result: BridgeResult): string {
  const actual = countAnswer(result);
  const split = result.reasons.filter((r) => r.splits).map((r) => r.text);
  const why = result.reasons.map((r) => r.text).join(" ");
  if (choice === actual) return `${why} The bridge issues ${result.outputs.length === 0 ? "nothing" : `${result.outputs.length} burst${result.outputs.length > 1 ? "s" : ""}`}.`;
  if (actual === "illegal") return `Check the input before translating it. ${result.inputViolations[0].message} (${result.inputViolations[0].clause})`;
  if (choice === "illegal") {
    return result.direction === "ahb-to-axi"
      ? "The AHB burst is legal: its transfers are aligned and an incrementing burst stays inside one 1KB region. Count the AXI bursts the bridge needs."
      : "The AXI burst is legal: it stays inside one 4KB page and follows the A3.4.1 length rules. The AHB side has its own limits, though.";
  }
  if (actual === "1") return `Nothing forces a split here. ${why}`;
  if (choice === "1") return `One burst is not enough. ${split.join(" ")}`;
  return `Count again: the bridge issues ${result.outputs.length} bursts. ${split.join(" ")}`;
}

function OutputCard({ out, index }: { out: BridgeResult["outputs"][number]; index: number }) {
  const rows: [string, string][] =
    out.kind === "axi"
      ? [
          ["AxADDR", hex(out.request.startAddress)],
          ["AxLEN", `${out.request.axlen} (${out.request.axlen + 1} transfers)`],
          ["AxSIZE", `${out.request.axsize} (${2 ** out.request.axsize} B)`],
          ["AxBURST", out.request.burst],
          ["Bytes", out.result.lowestByte === null ? "-" : `${hex(out.result.lowestByte)} to ${hex(out.result.highestByte as number)}`],
        ]
      : [
          ["HADDR", hex(out.burst.haddr)],
          ["HBURST", out.burst.hburst],
          ["HSIZE", `${2 ** out.burst.hsize} B`],
          ["Transfers", `${out.burst.beats}`],
          ["Bytes", `${hex(Math.min(...out.addresses))} to ${hex(Math.max(...out.addresses) + 2 ** out.burst.hsize - 1)}`],
        ];
  const legal = out.kind === "axi" ? out.result.legal : true;
  return (
    <div className={cn("min-w-0 rounded-xl border p-3", index % 2 === 0 ? "border-sky-500/40 bg-sky-500/[0.05]" : "border-violet-500/40 bg-violet-500/[0.05]")}>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px]">
          {index + 1}
        </span>
        {out.label}
        <span className={cn("ml-auto text-xs", legal ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>{legal ? "✓ legal" : "✕ illegal"}</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="font-mono text-muted-foreground">{k}</dt>
            <dd className="font-mono text-foreground">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

function ByteMap({ result, inputLo, inputHi }: { result: BridgeResult; inputLo: number; inputHi: number }) {
  const span = Math.max(1, inputHi - inputLo + 1);
  const pct = (a: number) => ((a - inputLo) / span) * 100;
  const boundaries: { at: number; kind: string }[] = [];
  for (let b = (Math.floor(inputLo / ONE_KB) + 1) * ONE_KB; b <= inputHi; b += ONE_KB) boundaries.push({ at: b, kind: b % 0x1000 === 0 ? "4KB" : "1KB" });
  const segs = result.outputs.map((o, i) => {
    const lo = o.kind === "axi" ? (o.result.lowestByte ?? inputLo) : Math.min(...o.addresses);
    const hi = o.kind === "axi" ? (o.result.highestByte ?? inputLo) : Math.max(...o.addresses) + 2 ** o.burst.hsize - 1;
    return { i, lo, hi };
  });
  return (
    <figure className="min-w-0">
      <div className="relative h-10 overflow-hidden rounded-lg border border-border/70 bg-muted/30" aria-hidden>
        {segs.map((s) => (
          <div
            key={s.i}
            className={cn("absolute top-1 bottom-1 flex items-center justify-center rounded border text-[11px] font-semibold", s.i % 2 === 0 ? "border-sky-500/60 bg-sky-500/20" : "border-violet-500/60 bg-violet-500/20")}
            style={{ left: `${pct(s.lo)}%`, width: `${Math.max(2, ((s.hi - s.lo + 1) / span) * 100)}%` }}
          >
            {s.i + 1}
          </div>
        ))}
        {boundaries.map((b) => (
          <div key={b.at} className="absolute top-0 bottom-0 border-l-2 border-dashed border-rose-500" style={{ left: `${pct(b.at)}%` }} />
        ))}
      </div>
      <figcaption className="mt-1 text-[11px] text-muted-foreground">
        Bytes {hex(inputLo)} to {hex(inputHi)}. Numbered boxes are the output bursts.{" "}
        {boundaries.length ? `Dashed lines: ${boundaries.map((b) => `${b.kind} boundary ${hex(b.at)}`).join(", ")}.` : "No 1KB boundary inside this range."}
      </figcaption>
    </figure>
  );
}

const inputRange = (p: BridgePreset): [number, number] => {
  if (p.direction === "ahb-to-axi" && p.ahb) {
    const nb = 2 ** p.ahb.hsize;
    const total = nb * p.ahb.beats;
    const wrap = p.ahb.hburst.startsWith("WRAP");
    const lo = wrap ? Math.floor(p.ahb.haddr / total) * total : p.ahb.haddr;
    return [lo, lo + total - 1];
  }
  const a = p.axi as BurstRequest;
  const nb = 2 ** a.axsize;
  const total = nb * (a.axlen + 1);
  if (a.burst === "WRAP") {
    const lo = Math.floor(a.startAddress / total) * total;
    return [lo, lo + total - 1];
  }
  if (a.burst === "FIXED") return [a.startAddress, Math.floor(a.startAddress / nb) * nb + nb - 1];
  return [a.startAddress, Math.floor(a.startAddress / nb) * nb + total - 1];
};

export function BridgeTranslationExplorer() {
  const fid = useId();
  const [presetIndex, setPresetIndex] = useState(0);
  const [custom, setCustom] = useState<BridgePreset | null>(null);
  const preset = custom ?? BRIDGE_PRESETS[presetIndex];
  const result = useMemo(() => translatePreset(preset), [preset]);
  const [lo, hi] = inputRange(preset);
  const key = JSON.stringify(preset);
  const [addrText, setAddrText] = useState(hex(BRIDGE_PRESETS[0].ahb?.haddr ?? 0));

  const options: PredictionOption[] = ANSWERS.map((a) => ({ id: a.id, label: a.label, correct: a.id === countAnswer(result), feedback: feedbackFor(a.id, result) }));

  const choose = (i: number) => {
    setPresetIndex(i);
    setCustom(null);
    const p = BRIDGE_PRESETS[i];
    setAddrText(hex(p.direction === "ahb-to-axi" ? (p.ahb as AhbBurst).haddr : (p.axi as BurstRequest).startAddress));
  };
  const edit = (patch: Partial<AhbBurst> | Partial<BurstRequest>, other?: number) => {
    const base = preset;
    const next: BridgePreset =
      base.direction === "ahb-to-axi"
        ? { ...base, id: "custom", label: "Custom", ahb: { ...(base.ahb as AhbBurst), ...(patch as Partial<AhbBurst>) }, otherBusBytes: other ?? base.otherBusBytes }
        : { ...base, id: "custom", label: "Custom", axi: { ...(base.axi as BurstRequest), ...(patch as Partial<BurstRequest>) }, otherBusBytes: other ?? base.otherBusBytes };
    if (next.ahb) {
      const fixed = ahbFixedBeats(next.ahb.hburst);
      if (fixed !== undefined) next.ahb = { ...next.ahb, beats: fixed };
    }
    setCustom(next);
  };

  const selectClass = "h-10 w-full rounded-md border border-border/70 bg-background px-2 font-mono text-sm";
  const ahb = preset.ahb;
  const axi = preset.axi;

  return (
    <div data-testid="bridge-translation-explorer">
      <VisualFrame
        label="AHB and AXI bridge burst translator"
        eyebrow="Predict, then translate"
        title="How many bursts come out of the bridge?"
        summary="A legal AHB incrementing burst never crosses 1KB, so it can never cross 4KB. Bridges split for other reasons. Predict the count, then see the rule that decides it."
        fidelity="model"
        assumptions={BRIDGE_ASSUMPTIONS}
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Bridge scenarios">
          {BRIDGE_PRESETS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              data-testid={`scenario-btn-${i}`}
              aria-pressed={!custom && i === presetIndex}
              onClick={() => choose(i)}
              className={cn(
                "min-h-9 rounded-full border px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !custom && i === presetIndex ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
            >
              <span aria-hidden>{p.direction === "ahb-to-axi" ? "AHB→AXI · " : "AXI→AHB · "}</span>
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-foreground">
          <strong>{preset.direction === "ahb-to-axi" ? "AHB → AXI" : "AXI → AHB"}.</strong> {custom ? "Custom input." : preset.desc}
        </p>

        <fieldset className="grid gap-3 rounded-xl border border-border/60 p-3 grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))]">
          <legend className="px-1 text-xs font-semibold text-foreground">Input burst ({preset.direction === "ahb-to-axi" ? "AHB master" : "AXI master"}), editable</legend>
          <label className="space-y-1 text-xs text-muted-foreground" htmlFor={`${fid}-addr`}>
            {ahb ? "HADDR" : "AxADDR"} (hex)
            <input
              id={`${fid}-addr`}
              value={addrText}
              spellCheck={false}
              onChange={(e) => {
                setAddrText(e.target.value);
                const v = Number.parseInt(e.target.value.replace(/^0x/i, ""), 16);
                if (Number.isFinite(v) && v >= 0 && v <= 0xffffffff) edit(ahb ? { haddr: v } : { startAddress: v });
              }}
              className={cn(selectClass, "px-3 [font-variant-ligatures:none]")}
            />
          </label>
          {ahb ? (
            <>
              <label className="space-y-1 text-xs text-muted-foreground" htmlFor={`${fid}-hburst`}>
                HBURST
                <select id={`${fid}-hburst`} className={selectClass} value={ahb.hburst} onChange={(e) => edit({ hburst: e.target.value as AhbHburst })}>
                  {AHB_HBURSTS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground" htmlFor={`${fid}-beats`}>
                Transfers
                <input
                  id={`${fid}-beats`}
                  type="number"
                  min={1}
                  max={2048}
                  disabled={ahb.hburst !== "INCR"}
                  value={ahb.beats}
                  onChange={(e) => edit({ beats: Math.max(1, Math.min(2048, Math.floor(Number(e.target.value) || 1))) })}
                  className={cn(selectClass, "px-3 disabled:opacity-60")}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground" htmlFor={`${fid}-hsize`}>
                HSIZE
                <select id={`${fid}-hsize`} className={selectClass} value={ahb.hsize} onChange={(e) => edit({ hsize: Number(e.target.value) })}>
                  {[0, 1, 2, 3].map((s) => (
                    <option key={s} value={s}>
                      {2 ** s} B
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : axi ? (
            <>
              <label className="space-y-1 text-xs text-muted-foreground" htmlFor={`${fid}-axburst`}>
                AxBURST
                <select id={`${fid}-axburst`} className={selectClass} value={axi.burst} onChange={(e) => edit({ burst: e.target.value as AxiBurstType })}>
                  {AXI_BURST_TYPES.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground" htmlFor={`${fid}-axlen`}>
                AxLEN
                <input
                  id={`${fid}-axlen`}
                  type="number"
                  min={0}
                  max={255}
                  value={axi.axlen}
                  onChange={(e) => edit({ axlen: Math.max(0, Math.min(255, Math.floor(Number(e.target.value) || 0))) })}
                  className={cn(selectClass, "px-3")}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground" htmlFor={`${fid}-axsize`}>
                AxSIZE
                <select id={`${fid}-axsize`} className={selectClass} value={axi.axsize} onChange={(e) => edit({ axsize: Number(e.target.value) })}>
                  {[0, 1, 2].map((s) => (
                    <option key={s} value={s}>
                      {2 ** s} B
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{preset.direction === "ahb-to-axi" ? "AXI" : "AHB"} bus</p>
            <SegmentedControl
              label="Output bus width"
              options={[4, 8].map((b) => ({ value: String(b), label: `${b * 8}-bit` }))}
              value={String(preset.otherBusBytes)}
              onChange={(v) => edit({}, Number(v))}
            />
          </div>
        </fieldset>

        <PredictionPrompt question="How many bursts does the bridge issue on the other side?" options={options} resetKey={key}>
          <div className="space-y-3">
            <ul className="space-y-1 text-sm" aria-label="Why the bridge does this">
              {result.reasons.map((r, i) => (
                <li key={i} className={cn("rounded-lg border px-3 py-2", r.kind === "illegal-input" ? "border-rose-500/50 bg-rose-500/10" : "border-border/60")}>
                  <span className={cn("mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", r.basis === "protocol" ? "bg-cyan-500/15 text-cyan-900 dark:text-cyan-100" : "bg-amber-500/15 text-amber-900 dark:text-amber-100")}>
                    {r.basis === "protocol" ? `Protocol ${r.clause}` : "Bridge policy"}
                  </span>
                  {r.kind === "illegal-input" ? "✕ " : ""}
                  {r.text}
                </li>
              ))}
            </ul>
            <div data-testid="axi-bursts-container" className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
              {result.outputs.map((o, i) => (
                <OutputCard key={i} out={o} index={i} />
              ))}
              {result.outputs.length === 0 ? <p className="text-sm text-muted-foreground">No output: the bridge never sees a legal version of this input.</p> : null}
            </div>
            {result.outputs.length > 0 ? <ByteMap result={result} inputLo={lo} inputHi={hi} /> : null}
            <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground/90" aria-label="Translation steps">
              {result.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {result.direction === "ahb-to-axi" ? <CodeTrace label="AHB-side checker for the 1KB rule" lines={AHB_1KB_SVA.map((text) => ({ text, owner: "testbench" as const }))} /> : null}
          </div>
        </PredictionPrompt>
      </VisualFrame>
    </div>
  );
}

export default BridgeTranslationExplorer;
