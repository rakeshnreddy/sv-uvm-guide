"use client";

import React, { useId, useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  burstToSv,
  checkWriteStrobe,
  computeBurst,
  formatStrobe,
  hex,
  maxBurstLength,
  type AxiBurstType,
  type AxiVersion,
  type BurstRequest,
  type BurstResult,
  type BurstRuleId,
} from "@/lib/axi-burst-model";
import { cn } from "@/lib/utils";

export const AXI_BURST_ASSUMPTIONS = [
  "Equations and limits from IHI0022E A3.4.1; FIXED lanes follow the A3.4.2 pseudocode; WSTRB rule from A3.4.3.",
  "Transfer numbers start at N = 1, as in the spec equations.",
  "Addresses are byte addresses below 4 GB. The 4KB check uses the bytes the burst actually carries.",
  "WSTRB shown is the full active-lane mask; a master may legally drive a subset.",
];

interface Preset {
  id: string;
  label: string;
  request: BurstRequest;
}

const PRESETS: Preset[] = [
  { id: "aligned", label: "INCR4 aligned", request: { startAddress: 0x1000, axlen: 3, axsize: 2, burst: "INCR", dataBusBytes: 4 } },
  { id: "unaligned", label: "INCR from 0x1003", request: { startAddress: 0x1003, axlen: 3, axsize: 2, burst: "INCR", dataBusBytes: 4 } },
  { id: "narrow", label: "Narrow on 64-bit", request: { startAddress: 0x1004, axlen: 3, axsize: 2, burst: "INCR", dataBusBytes: 8 } },
  { id: "wrap", label: "WRAP4 at 0x1008", request: { startAddress: 0x1008, axlen: 3, axsize: 2, burst: "WRAP", dataBusBytes: 4 } },
  { id: "fixed", label: "FIXED unaligned", request: { startAddress: 0x2001, axlen: 3, axsize: 2, burst: "FIXED", dataBusBytes: 4 } },
  { id: "page-edge", label: "Ends at 0x0FFF", request: { startAddress: 0x0ff0, axlen: 3, axsize: 2, burst: "INCR", dataBusBytes: 4 } },
  { id: "cross", label: "Crosses 4KB", request: { startAddress: 0x0ff4, axlen: 3, axsize: 2, burst: "INCR", dataBusBytes: 4 } },
  { id: "bad-wrap", label: "WRAP of 3", request: { startAddress: 0x1000, axlen: 2, axsize: 2, burst: "WRAP", dataBusBytes: 4 } },
];

const RULE_TEXT: Record<BurstRuleId | "legal", { label: string; ifTrue: string; ifFalse: string }> = {
  legal: {
    label: "Legal",
    ifTrue: "Every A3.4.1 rule holds: size fits the bus, length is in range, and the bytes stay in one 4KB page.",
    ifFalse: "One rule fails, so a protocol checker must flag this burst.",
  },
  "cross-4kb": {
    label: "Illegal: crosses a 4KB boundary",
    ifTrue: "The bytes it carries straddle a 4KB boundary, which A3.4.1 forbids for every burst.",
    ifFalse: "The first and last byte sit in the same 4KB page. Check the last byte, not the next address after it.",
  },
  "wrap-length": {
    label: "Illegal: WRAP length",
    ifTrue: "A wrapping burst must have 2, 4, 8 or 16 transfers.",
    ifFalse: "The length is one of the allowed values for this burst type.",
  },
  "wrap-unaligned": {
    label: "Illegal: unaligned WRAP start",
    ifTrue: "A wrapping burst must start at an address aligned to the transfer size.",
    ifFalse: "Only WRAP bursts must start aligned; INCR and FIXED may start anywhere.",
  },
  "size-exceeds-bus": {
    label: "Illegal: AxSIZE wider than the bus",
    ifTrue: "A transfer may not be wider than the data bus.",
    ifFalse: "The transfer fits the bus.",
  },
  "length-range": {
    label: "Illegal: too many transfers",
    ifTrue: "AXI4 allows up to 256 transfers for INCR and 16 for FIXED and WRAP (AXI3: 16 for all).",
    ifFalse: "The length is inside the limit for this burst type.",
  },
};

/** Model-derived prediction for the current configuration. */
function buildQuestion(r: BurstResult): { question: string; options: PredictionOption[] } | null {
  const { request, numberBytes: nb, burstLength: L, alignedAddress } = r;
  if (!r.legal) {
    const actual = r.violations[0].rule;
    const distractor: BurstRuleId = actual === "cross-4kb" ? "wrap-unaligned" : "cross-4kb";
    const ids: (BurstRuleId | "legal")[] = ["legal", actual, distractor];
    return {
      question: "Is this burst legal?",
      options: ids.map((id) => ({
        id,
        label: RULE_TEXT[id].label,
        correct: id === actual,
        feedback: id === "legal" ? RULE_TEXT.legal.ifFalse : id === actual ? `${RULE_TEXT[id].ifTrue} ${r.violations[0].message}` : RULE_TEXT[id].ifFalse,
      })),
    };
  }
  if (L < 2) return null;
  const last = r.beats[L - 1];
  const offByOne = { id: "off-by-one", addr: alignedAddress + L * nb, feedback: "Off by one transfer. AxLEN = transfers - 1, so the last transfer is N = AxLEN + 1, which is AxLEN steps after the first." };
  const startOnly = { id: "start", addr: request.startAddress, feedback: "Only a FIXED burst repeats Start_Address. INCR and WRAP step by Number_Bytes." };
  const byType: Record<AxiBurstType, { id: string; addr: number; feedback: string }[]> = {
    INCR: [
      {
        id: "naive",
        addr: request.startAddress + (L - 1) * nb,
        feedback: "That carries the start offset into every transfer. Only the first transfer may be unaligned; after it, Address_N = Aligned_Address + (N-1) x Number_Bytes.",
      },
      startOnly,
      offByOne,
    ],
    WRAP: [
      { id: "nowrap", addr: alignedAddress + (L - 1) * nb, feedback: "That ignores the wrap. Once the address reaches Wrap_Boundary + total bytes it returns to Wrap_Boundary." },
      startOnly,
      offByOne,
    ],
    FIXED: [
      { id: "naive", addr: request.startAddress + (L - 1) * nb, feedback: "That is INCR behaviour. A FIXED burst re-uses Start_Address for every transfer." },
      { id: "aligned", addr: alignedAddress, feedback: "FIXED does not realign. Every transfer re-uses Start_Address exactly, with the first transfer's byte lanes." },
    ],
  };
  const candidates = [{ id: "model", addr: last.address, feedback: last.why }, ...byType[request.burst]];
  const seen = new Set<number>();
  const kept = candidates.filter((c) => (seen.has(c.addr) ? false : (seen.add(c.addr), true)));
  if (kept.length < 2) return null;
  kept.sort((a, b) => a.addr - b.addr);
  const options: PredictionOption[] = kept.map((c) => ({ id: c.id, label: <span className="font-mono">{hex(c.addr)}</span>, correct: c.id === "model", feedback: c.feedback }));
  return { question: `What is the address of the last transfer (N = ${L})?`, options };
}

function LaneCells({ lanes, dataBusBytes, strobe }: { lanes: number[]; dataBusBytes: number; strobe?: number[] }) {
  const on = new Set(lanes);
  return (
    <span className="inline-flex gap-0.5" aria-label={`Active byte lanes ${lanes.join(", ")}`}>
      {Array.from({ length: dataBusBytes }, (_, i) => dataBusBytes - 1 - i).map((lane) => (
        <span
          key={lane}
          aria-hidden
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-sm border font-mono text-[10px]",
            on.has(lane) ? "border-cyan-500/70 bg-cyan-500/20 text-cyan-900 dark:text-cyan-100" : "border-border/60 text-muted-foreground",
            strobe && strobe.includes(lane) && !on.has(lane) && "border-rose-500 bg-rose-500/20 text-rose-800 dark:text-rose-200",
          )}
        >
          {on.has(lane) ? "■" : "·"}
        </span>
      ))}
    </span>
  );
}

const ROW_LIMIT = 16;

export default function AxiMemoryMathVisualizer() {
  const fieldId = useId();
  const [request, setRequest] = useState<BurstRequest>(PRESETS[1].request);
  const [presetId, setPresetId] = useState<string>(PRESETS[1].id);
  const [version, setVersion] = useState<AxiVersion>("AXI4");
  const [addrText, setAddrText] = useState(hex(PRESETS[1].request.startAddress));
  const [showAll, setShowAll] = useState(false);
  const [strobeBeat, setStrobeBeat] = useState(1);
  const [strobe, setStrobe] = useState<number[] | null>(null);

  const result = useMemo(() => computeBurst({ ...request, version }), [request, version]);
  const question = useMemo(() => buildQuestion(result), [result]);
  const key = JSON.stringify({ ...request, version });

  const update = (patch: Partial<BurstRequest>) => {
    setRequest((r) => ({ ...r, ...patch }));
    setPresetId("custom");
    setStrobe(null);
    setStrobeBeat(1);
    setShowAll(false);
  };
  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setRequest(p.request);
    setPresetId(id);
    setAddrText(hex(p.request.startAddress));
    setStrobe(null);
    setStrobeBeat(1);
    setShowAll(false);
  };

  const beat = result.beats[strobeBeat - 1];
  const strobeLanes = strobe ?? beat?.lanes ?? [];
  const strobeCheck = beat ? checkWriteStrobe(beat, strobeLanes) : null;
  const rows = showAll ? result.beats : result.beats.slice(0, ROW_LIMIT);

  const codeLines = useMemo(() => {
    const lines = burstToSv(request).split("\n").map((text) => ({ text, owner: "testbench" as const }));
    lines.push({ text: "// Full-lane WSTRB for each transfer (a subset is also legal):", owner: "testbench" });
    result.beats.slice(0, 8).forEach((b) => lines.push({ text: `// N=${b.n}: WSTRB = ${formatStrobe(b.lanes, request.dataBusBytes)}`, owner: "testbench" }));
    if (result.beats.length > 8) lines.push({ text: `// ... ${result.beats.length - 8} more`, owner: "testbench" });
    return lines;
  }, [request, result]);

  const results = (
    <div className="space-y-4">
      <dl className="grid gap-2 text-sm grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        {[
          ["Number_Bytes", `${result.numberBytes}`],
          ["Burst_Length", `${result.burstLength}`],
          ["Aligned_Address", hex(result.alignedAddress)],
          ["Wrap_Boundary", result.wrapBoundary === null ? "n/a (not WRAP)" : hex(result.wrapBoundary)],
          ["Bytes carried", result.lowestByte === null ? "undefined" : `${hex(result.lowestByte)} to ${hex(result.highestByte as number)}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
            <dt className="font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{k}</dt>
            <dd className="font-mono font-semibold text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <div aria-live="polite" className={cn("rounded-lg border px-3 py-2 text-sm", result.legal ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10")}>
        {result.legal ? (
          <p className="text-emerald-800 dark:text-emerald-200">✓ Legal burst. {result.crossedBoundary === null ? "All bytes stay inside one 4KB page." : ""}</p>
        ) : (
          <ul className="space-y-1 text-rose-800 dark:text-rose-200">
            {result.violations.map((v) => (
              <li key={v.rule}>
                ✕ {v.message} <span className="text-xs opacity-80">({v.clause})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {result.beats.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[300px] text-left text-sm">
            <caption className="sr-only">Address and byte lanes of each transfer</caption>
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5">N</th>
                <th scope="col" className="px-2 py-1.5">Address_N</th>
                <th scope="col" className="px-2 py-1.5">Lanes (high … 0)</th>
                <th scope="col" className="px-2 py-1.5">WSTRB</th>
                <th scope="col" className="px-2 py-1.5">Why</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.n} className={cn("border-t border-border/50", result.crossedBoundary !== null && b.page !== result.beats[0].page && "bg-rose-500/10")}>
                  <td className="px-2 py-1 font-mono">{b.n}</td>
                  <td className="px-2 py-1 font-mono">
                    {hex(b.address)}
                    {b.wrapped ? <span className="ml-1 text-xs text-amber-700 dark:text-amber-300">↺ wrapped</span> : null}
                    {result.crossedBoundary !== null && b.page !== result.beats[0].page ? <span className="ml-1 text-xs text-rose-700 dark:text-rose-300">✕ next page</span> : null}
                  </td>
                  <td className="px-2 py-1">
                    <LaneCells lanes={b.lanes} dataBusBytes={request.dataBusBytes} />
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {b.lowerByteLane === b.upperByteLane ? b.lowerByteLane : `${b.lowerByteLane}–${b.upperByteLane}`}
                    </span>
                  </td>
                  <td className="px-2 py-1 font-mono text-xs [font-variant-ligatures:none]">{formatStrobe(b.lanes, request.dataBusBytes)}</td>
                  <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{b.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.beats.length > ROW_LIMIT ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="m-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showAll ? "Show first 16 transfers" : `Show all ${result.beats.length} transfers`}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No defined address sequence: the spec equations only apply to legal bursts of this kind.</p>
      )}

      {beat ? (
        <fieldset className="rounded-xl border border-border/60 p-3">
          <legend className="px-1 text-sm font-semibold text-foreground">Debug a WSTRB: toggle the strobe lanes of transfer {strobeBeat}</legend>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor={`${fieldId}-beat`} className="text-muted-foreground">
              Transfer N
            </label>
            <input
              id={`${fieldId}-beat`}
              type="number"
              min={1}
              max={result.beats.length}
              value={strobeBeat}
              onChange={(e) => {
                const n = Math.max(1, Math.min(result.beats.length, Number(e.target.value) || 1));
                setStrobeBeat(n);
                setStrobe(null);
              }}
              className="h-9 w-20 rounded-md border border-border/70 bg-background px-2 font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="WSTRB lanes">
            {Array.from({ length: request.dataBusBytes }, (_, i) => request.dataBusBytes - 1 - i).map((lane) => {
              const on = strobeLanes.includes(lane);
              const active = beat.lanes.includes(lane);
              return (
                <button
                  key={lane}
                  type="button"
                  aria-pressed={on}
                  aria-label={`WSTRB[${lane}] ${on ? "1" : "0"}${active ? ", active lane" : ", inactive lane"}`}
                  onClick={() => setStrobe(on ? strobeLanes.filter((l) => l !== lane) : [...strobeLanes, lane])}
                  className={cn(
                    "h-10 min-w-10 rounded-md border px-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? (active ? "border-cyan-500 bg-cyan-500/20" : "border-rose-500 bg-rose-500/20") : "border-border/70",
                    !active && "border-dashed",
                  )}
                >
                  [{lane}] {on ? "1" : "0"}
                </button>
              );
            })}
          </div>
          {strobeCheck ? (
            <p aria-live="polite" className={cn("mt-2 text-sm", strobeCheck.legal ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
              <span className="font-mono">{formatStrobe(strobeLanes, request.dataBusBytes)}</span>{" "}
              {strobeCheck.legal
                ? strobeCheck.skippedLanes.length
                  ? `✓ Legal sparse write: lanes ${strobeCheck.skippedLanes.join(", ")} are active but not written. WSTRB may be any subset of the active lanes.`
                  : "✓ Legal: every active lane is written."
                : `✕ Illegal: lane${strobeCheck.extraLanes.length > 1 ? "s" : ""} ${strobeCheck.extraLanes.join(", ")} carr${strobeCheck.extraLanes.length > 1 ? "y" : "ies"} no valid data for this transfer. "A master must ensure that the write strobes are HIGH only for byte lanes that contain valid data" (A3.4.3).`}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <CodeTrace label="Driver view, generated from the burst" lines={codeLines} />
    </div>
  );

  return (
    <div data-testid="axi-memory-math-visualizer">
      <VisualFrame
        label="AXI burst address and byte-lane calculator"
        eyebrow="Experiment"
        title="Where does each transfer of a burst land?"
        summary="Pick a preset or edit the address channel. Predict first; then the spec equations fill in every transfer's address, byte lanes and strobes."
        fidelity="model"
        assumptions={AXI_BURST_ASSUMPTIONS}
      >
        <SegmentedControl
          label="Burst presets"
          options={[...PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Custom", disabled: presetId !== "custom" }]}
          value={presetId}
          onChange={applyPreset}
        />

        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          <div className="space-y-1">
            <label htmlFor={`${fieldId}-addr`} className="text-xs font-semibold text-foreground">
              AxADDR (hex)
            </label>
            <input
              id={`${fieldId}-addr`}
              value={addrText}
              onChange={(e) => {
                setAddrText(e.target.value);
                const v = Number.parseInt(e.target.value.replace(/^0x/i, ""), 16);
                if (Number.isFinite(v) && v >= 0 && v <= 0xffffffff) update({ startAddress: v });
              }}
              className="h-10 w-full rounded-md border border-border/70 bg-background px-3 font-mono text-sm [font-variant-ligatures:none]"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${fieldId}-len`} className="text-xs font-semibold text-foreground">
              AxLEN (transfers − 1), max {maxBurstLength(request.burst, version) - 1}
            </label>
            <input
              id={`${fieldId}-len`}
              type="number"
              min={0}
              max={255}
              value={request.axlen}
              onChange={(e) => update({ axlen: Math.max(0, Math.min(255, Math.floor(Number(e.target.value) || 0))) })}
              className="h-10 w-full rounded-md border border-border/70 bg-background px-3 font-mono text-sm"
            />
          </div>
        </div>
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">AxSIZE (bytes per transfer)</p>
            <SegmentedControl
              label="AxSIZE"
              mono
              options={[0, 1, 2, 3, 4].map((s) => ({ value: String(s), label: `${2 ** s}B`, ariaLabel: `AxSIZE ${s}, ${2 ** s} bytes` }))}
              value={String(request.axsize)}
              onChange={(v) => update({ axsize: Number(v) })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">AxBURST</p>
            <SegmentedControl
              label="AxBURST"
              mono
              options={(["FIXED", "INCR", "WRAP"] as AxiBurstType[]).map((b) => ({ value: b, label: b }))}
              value={request.burst}
              onChange={(v) => update({ burst: v })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Data bus</p>
            <SegmentedControl
              label="Data bus width"
              options={[4, 8, 16].map((b) => ({ value: String(b), label: `${b * 8}-bit` }))}
              value={String(request.dataBusBytes)}
              onChange={(v) => update({ dataBusBytes: Number(v) })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Protocol</p>
            <SegmentedControl label="Protocol version" options={[{ value: "AXI4", label: "AXI4" }, { value: "AXI3", label: "AXI3" }]} value={version} onChange={(v) => setVersion(v as AxiVersion)} />
          </div>
        </div>

        {question ? (
          <PredictionPrompt question={question.question} options={question.options} resetKey={key}>
            {results}
          </PredictionPrompt>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">With a single legal transfer there is nothing to predict; inspect the lanes below.</p>
            {results}
          </div>
        )}
      </VisualFrame>
    </div>
  );
}
