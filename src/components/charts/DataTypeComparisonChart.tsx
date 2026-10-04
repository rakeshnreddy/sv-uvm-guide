"use client";

import React, { useId, useMemo, useState } from "react";

import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { DATA_TYPE_ROWS, buildValueDrills, writerRule, type DataTypeRow } from "@/lib/sv-data-type-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Facts from IEEE 1800-2023: Table 6-8 and §6.11 (widths, 2/4-state, signedness), Table 6-7 (default values), §6.5–§6.7 (nets vs variables).",
  "Defaults are for variables declared without an initializer. Nets have no initializer: an undriven wire reads z.",
  "Drill answers are computed by the four-state model (src/lib/sv-four-state-model.ts), not typed in.",
];

const widthText = (r: DataTypeRow) => (r.width === null ? (r.id === "string" ? "varies" : "you choose (1 if no range)") : String(r.width));
const signedText = (r: DataTypeRow) => (r.signed === null ? "—" : r.signed ? "signed" : "unsigned");
const statesText = (r: DataTypeRow) => (r.states === null ? "—" : `${r.states}-state`);

/** Bits per value for the fixed-width types, drawn to scale. 4-state bars are hatched. */
function WidthChart() {
  const patternId = useId().replace(/:/g, "");
  const rows = DATA_TYPE_ROWS.filter((r) => r.width !== null);
  const W = 360;
  const labelW = 70;
  const barMax = W - labelW - 44;
  const rowH = 22;
  const H = rows.length * rowH + 22;
  return (
    <figure className="min-w-0">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[300px] max-w-[520px]"
          role="img"
          aria-label={`Bits per value: ${rows.map((r) => `${r.id} ${r.width}${r.states === 4 ? ", 4-state" : r.states === 2 ? ", 2-state" : ""}`).join("; ")}.`}
        >
          <defs>
            <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" className="fill-rose-500/20" />
              <line x1="0" y1="0" x2="0" y2="6" className="stroke-rose-500/70" strokeWidth="2" />
            </pattern>
          </defs>
          {rows.map((r, i) => {
            const y = i * rowH + 4;
            const w = ((r.width as number) / 64) * barMax;
            return (
              <g key={r.id}>
                <text x={labelW - 6} y={y + 13} textAnchor="end" className="fill-foreground font-mono text-[11px]">
                  {r.id}
                </text>
                <rect
                  x={labelW}
                  y={y}
                  width={w}
                  height={rowH - 6}
                  rx={3}
                  fill={r.states === 4 ? `url(#${patternId})` : undefined}
                  className={r.states === 4 ? "stroke-rose-500/70" : "fill-indigo-500/25 stroke-indigo-500/70"}
                  strokeWidth={1}
                />
                <text x={labelW + w + 6} y={y + 13} className="fill-muted-foreground text-[10.5px]">
                  {r.width}
                  {r.states === 4 ? " · 4-state" : r.states === 2 ? " · 2-state" : " · float"}
                </text>
              </g>
            );
          })}
          <text x={labelW} y={H - 4} className="fill-muted-foreground text-[10px]">
            Bar length = bits per value (64 = full bar). Hatched = 4-state.
          </text>
        </svg>
      </div>
    </figure>
  );
}

function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full border-collapse text-left text-xs">
        <caption className="px-3 pt-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Common data types (IEEE 1800-2023 Table 6-7, Table 6-8)
        </caption>
        <thead>
          <tr className="border-b border-border/70 bg-muted/30">
            {["Declaration", "Kind", "States", "Bits", "Default sign", "Value with no initializer", "Note"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DATA_TYPE_ROWS.map((r) => (
            <tr key={r.id} className="border-b border-border/40 align-top">
              <th scope="row" className="px-3 py-2 font-mono font-semibold text-foreground [font-variant-ligatures:none]">
                {r.example}
              </th>
              <td className="px-3 py-2">{r.kind === "net" ? "net" : "variable"}</td>
              <td className="px-3 py-2">
                <span className={cn("rounded border px-1.5 py-0.5", r.states === 4 ? "border-dashed border-rose-500/60" : r.states === 2 ? "border-indigo-500/60" : "border-transparent")}>
                  {statesText(r)}
                </span>
              </td>
              <td className="px-3 py-2">{widthText(r)}</td>
              <td className="px-3 py-2">{signedText(r)}</td>
              <td className="px-3 py-2 font-mono [font-variant-ligatures:none]">
                {r.defaultText} <span className="font-sans text-[10px] text-muted-foreground">({r.clause})</span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DataTypeComparisonChart: React.FC = () => {
  const drills = useMemo(() => buildValueDrills(), []);
  const [drillId, setDrillId] = useState(drills[0].id);
  const drill = drills.find((d) => d.id === drillId) ?? drills[0];

  return (
    <div data-testid="data-type-chart" className="w-full">
      <VisualFrame
        label="Data type comparison"
        eyebrow="Reference · predict"
        title="2-state or 4-state, signed or not, and what it holds before you assign it"
        summary="Read the table, then test yourself: predict the value before revealing it."
        fidelity="model"
        assumptions={ASSUMPTIONS}
      >
        <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          <WidthChart />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">Who may write it</p>
            <p>
              <strong>Variable:</strong> {writerRule.variable}
            </p>
            <p>
              <strong>Net:</strong> {writerRule.net}
            </p>
            <p className="text-xs text-muted-foreground">
              Assigning a 4-state value to a 2-state variable turns every x and z bit into 0 (§6.11.2), silently.
            </p>
          </div>
        </div>

        <ComparisonTable />

        <section aria-label="Predict the value" className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Predict the value</p>
          <SegmentedControl label="Declaration to test" mono options={drills.map((d) => ({ value: d.id, label: d.code.split("\n")[0] }))} value={drill.id} onChange={setDrillId} />
          <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12.5px] leading-5 text-slate-100 [font-variant-ligatures:none]">
            <code>{drill.code}</code>
          </pre>
          <PredictionPrompt
            resetKey={drill.id}
            question={drill.question}
            options={drill.options.map((o) => ({ id: o.id, label: <span className="font-mono [font-variant-ligatures:none]">{o.label}</span>, correct: o.correct, feedback: o.feedback }))}
          >
            <p aria-live="polite" className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-foreground">
              <strong>Value: </strong>
              <code className="font-mono [font-variant-ligatures:none]">{drill.answer}</code>. {drill.why} <span className="text-xs opacity-80">({drill.clause})</span>
            </p>
          </PredictionPrompt>
        </section>
      </VisualFrame>
    </div>
  );
};

export default DataTypeComparisonChart;
