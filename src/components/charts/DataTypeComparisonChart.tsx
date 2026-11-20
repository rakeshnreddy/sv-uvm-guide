"use client";

import React, { useMemo, useState } from "react";

import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { DATA_TYPE_ROWS, buildValueDrills, writerRule, type DataTypeRow, type ValueDrill } from "@/lib/sv-data-type-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Facts from IEEE 1800-2023: Table 6-8 and §6.11 (widths, 2/4-state, signedness), Table 6-7 (default values), §6.5–§6.7 (nets vs variables).",
  "Defaults are for variables declared without an initializer. A net has no starting value of its own: `wire w = a;` is a continuous assignment (§10.3.1), not an initializer, and an undriven wire reads z.",
  "Drill answers are computed by the four-state model (src/lib/sv-four-state-model.ts), not typed in.",
];

const widthText = (r: DataTypeRow) => (r.width === null ? (r.id === "string" ? "varies" : "you choose (1 if no range)") : String(r.width));
const signedText = (r: DataTypeRow) => (r.signed === null ? "—" : r.signed ? "signed" : "unsigned");
const statesText = (r: DataTypeRow) => (r.states === null ? "—" : `${r.states}-state`);

/**
 * WidthChart geometry in viewBox units. Text is set at `fontSize` units and the
 * SVG never renders narrower than `minRenderWidth` px, so no text drops below
 * 12 px (fontSize * minRenderWidth / W >= 12). The value label after a full
 * 64-bit bar ("64 · 4-state") needs labelRoom to the right edge, so no label is
 * clipped at any rendered width.
 */
export const WIDTH_CHART_LAYOUT = (() => {
  const W = 360;
  const fontSize = 13.5;
  const minRenderWidth = 320;
  const labelW = 74;
  const labelGap = 6;
  const labelRoom = 104;
  return { W, fontSize, minRenderWidth, labelW, labelGap, labelRoom, barMax: W - labelW - labelRoom };
})();

/** The types drawn to scale: every row with a fixed width (bit, logic and reg take the declared range). */
export const WIDTH_CHART_ROWS = DATA_TYPE_ROWS.filter((r) => r.width !== null);

const stateTag = (r: DataTypeRow) => (r.states === 4 ? "4-state" : r.states === 2 ? "2-state" : "float");

/**
 * Bar encoding, all neutral (indigo is the multi-bit value colour and emerald is
 * match, so neither is used here): 4-state = double dark outline, 2-state =
 * single dark outline, real (no 2-state/4-state split, §6.12) = faint outline.
 */
export const BAR_CLASS = {
  four: "fill-muted stroke-foreground",
  two: "fill-card stroke-foreground",
  other: "fill-muted stroke-fig-generic",
} as const;

export const barClassFor = (r: DataTypeRow) => (r.states === 4 ? BAR_CLASS.four : r.states === 2 ? BAR_CLASS.two : BAR_CLASS.other);

/** Inset of the inner 4-state outline, in viewBox units (about 2.2 px between the lines at 320 px). */
export const INNER_OUTLINE_INSET = 3.5;

/**
 * Integer types signed and unsigned by default (IEEE 1800-2023 §6.11.3, Table 6-8),
 * read from the model so the caption cannot disagree with the table.
 */
export const SIGNED_BY_DEFAULT = DATA_TYPE_ROWS.filter((r) => r.states !== null && r.kind === "variable" && r.signed === true).map((r) => r.id);
export const UNSIGNED_BY_DEFAULT = DATA_TYPE_ROWS.filter((r) => r.states !== null && r.kind === "variable" && r.signed === false).map((r) => r.id);

const listText = (ids: readonly string[]) => (ids.length <= 1 ? ids.join("") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`);

/**
 * Bits per value for the fixed-width types, drawn to scale. 4-state bars carry a
 * double outline and a "4-state" tag; rose hatching is reserved for x (unknown).
 * With `showSign`, a signed type's most significant bit is drawn as a solid
 * sign-bit cell, one bit wide at the same scale.
 */
function WidthChart({ showSign = false }: { showSign?: boolean }) {
  const rows = WIDTH_CHART_ROWS;
  const { W, fontSize, minRenderWidth, labelW, barMax, labelGap } = WIDTH_CHART_LAYOUT;
  const rowH = 28;
  const barH = rowH - 8;
  const H = rows.length * rowH + 4;
  const bitW = barMax / 64;
  const signWord = (r: DataTypeRow) => (r.signed === true ? ", signed" : r.signed === false ? ", unsigned" : "");
  return (
    <figure className="fig-stage !p-0 min-w-0 space-y-2 rounded-lg bg-[hsl(var(--fig-well))]">
      <div className="fig-stage !p-0 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: minRenderWidth }}
          className="block h-auto w-full max-w-[420px]"
          role="img"
          aria-label={`Bits per value: ${rows
            .map((r) => `${r.id} ${r.width}${r.states === 4 ? ", 4-state" : r.states === 2 ? ", 2-state" : ""}${showSign ? signWord(r) : ""}`)
            .join("; ")}.`}
        >
          {rows.map((r, i) => {
            const y = i * rowH + 4;
            const w = ((r.width as number) / 64) * barMax;
            const four = r.states === 4;
            const signCell = showSign && r.signed === true;
            // The inner outline starts after the sign cell so the solid cell never hides it.
            const innerX = labelW + INNER_OUTLINE_INSET + (signCell ? bitW : 0);
            return (
              <g key={r.id} data-testid={`width-bar-${r.id}`} data-states={r.states ?? "none"}>
                <text x={labelW - 6} y={y + barH / 2 + fontSize * 0.35} textAnchor="end" fontSize={fontSize} className="fill-foreground font-mono">
                  {r.id}
                </text>
                <rect
                  x={labelW}
                  y={y}
                  width={w}
                  height={barH}
                  rx={3}
                  className={barClassFor(r)}
                  strokeWidth={1}
                />
                {four ? (
                  <rect
                    data-testid="width-bar-inner-outline"
                    x={innerX}
                    y={y + INNER_OUTLINE_INSET}
                    width={Math.max(0, labelW + w - INNER_OUTLINE_INSET - innerX)}
                    height={barH - 2 * INNER_OUTLINE_INSET}
                    rx={1.5}
                    className="fill-none stroke-foreground"
                    strokeWidth={1}
                  />
                ) : null}
                {signCell ? (
                  <rect data-testid="width-bar-sign-bit" x={labelW} y={y} width={bitW} height={barH} className="fill-foreground" />
                ) : null}
                <text x={labelW + w + labelGap} y={y + barH / 2 + fontSize * 0.35} fontSize={fontSize} data-testid="width-chart-value" className="fill-foreground">
                  {r.width}
                  {` · ${stateTag(r)}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Bar length = bits per value (64 = full bar). Double outline = 4-state; single dark outline = 2-state; faint outline = real (tagged float), which is neither. The tag after each bar names it. bit, logic and reg take their width from the declared range, so they have no bar.
        {showSign ? (
          <>
            {" "}
            A solid first cell is the sign bit, one bit wide at the same scale: {listText(SIGNED_BY_DEFAULT)} are signed by default; {listText(UNSIGNED_BY_DEFAULT)} are unsigned (§6.11.3, Table 6-8).
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}

function ComparisonTable() {
  return (
    <div className="fig-stage !p-0 rounded-xl border border-fig-generic bg-[hsl(var(--fig-well))]">
      <div className="fig-stage !p-0 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="px-3 pt-3 text-left text-label text-muted-foreground">
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
                  <span className={cn("inline-block whitespace-nowrap rounded px-1.5 text-foreground leading-3", r.states === 4 ? "border-[3px] border-double border-foreground/70" : r.states === 2 ? "border border-foreground/70" : "border border-transparent")}>
                    {statesText(r)}
                  </span>
                </td>
                <td className="px-3 py-2">{widthText(r)}</td>
                <td className="px-3 py-2">{signedText(r)}</td>
                <td className="px-3 py-2 font-mono [font-variant-ligatures:none]">
                  {r.defaultText} <span className="font-sans text-xs text-muted-foreground">({r.clause})</span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type DataTypeChartSection = "all" | "defaults" | "widths";

export interface DataTypeComparisonChartProps {
  /**
   * Which part to show. "all" (default) is the full reference page; "defaults"
   * shows only the predict-the-value drills for starting values and signedness;
   * "widths" shows only the to-scale bars and the width and sign table.
   */
  section?: DataTypeChartSection;
}

/**
 * Drills shown by section="defaults": the starting value of int, logic [3:0] and
 * integer (Table 6-7), and 8'hFF printed with %0d as byte vs bit [7:0] (§6.11.3).
 * The undriven-wire and 4-state to 2-state drills are left out there because the
 * lesson's data type explorer asks the same questions.
 */
export const DEFAULTS_DRILL_IDS = ["int-default", "logic-default", "integer-default", "byte-signed", "bit-unsigned"] as const;

export function drillsForSection(section: DataTypeChartSection): ValueDrill[] {
  const drills = buildValueDrills();
  if (section !== "defaults") return drills;
  const keep: readonly string[] = DEFAULTS_DRILL_IDS;
  return drills.filter((d) => keep.includes(d.id));
}

const FRAME_COPY: Record<DataTypeChartSection, { label: string; eyebrow: string; title: string; summary: string; assumptions: string[] }> = {
  all: {
    label: "Data type comparison",
    eyebrow: "Reference · predict",
    title: "2-state or 4-state, signed or not, and what it holds before you assign it",
    summary: "Read the table, then test yourself: predict the value before revealing it.",
    assumptions: ASSUMPTIONS,
  },
  defaults: {
    label: "Starting values and signedness",
    eyebrow: "Predict",
    title: "What a variable holds before you assign it, and how %0d reads its bits",
    summary: "Pick a declaration, commit to a value, then reveal it.",
    assumptions: [
      "Facts from IEEE 1800-2023: Table 6-7 (default values for variables with no initializer), Table 6-8 and §6.11.2 (2-state and 4-state types), §6.11.3 (default signedness).",
      "Table 21-1 defines %d only as display in decimal format. Printing a negative signed value with a leading minus sign is what simulators do; the standard does not state it.",
      ASSUMPTIONS[2],
    ],
  },
  widths: {
    label: "Data type widths and signedness",
    eyebrow: "Reference",
    title: "How many bits each type holds, and whether it is signed by default",
    summary: "Bars are drawn to scale against a 64-bit value.",
    assumptions: [
      "Facts from IEEE 1800-2023: Table 6-8 and §6.11 (widths, 2/4-state), §6.11.3 (default signedness), Table 6-7 (default values).",
      "bit, logic and reg have no fixed width: the declared range sets it, so they appear in the table but not as bars.",
      "real is not an integral type. It is the same as a C double (§6.12), and its 64 bits are the [63:0] vector that $realtobits returns (§20.5).",
    ],
  },
};

function PredictValues({ drills }: { drills: ValueDrill[] }) {
  const [drillId, setDrillId] = useState(drills[0].id);
  const drill = drills.find((d) => d.id === drillId) ?? drills[0];
  return (
    <section aria-label="Predict the value" className="fig-stage !p-0 space-y-3 rounded-lg bg-[hsl(var(--fig-well))]">
      <p className="text-sm font-semibold text-foreground">Predict the value</p>
      <SegmentedControl label="Declaration to test" mono options={drills.map((d) => ({ value: d.id, label: d.code.split("\n")[0] }))} value={drill.id} onChange={setDrillId} />
      <pre className="overflow-x-auto rounded-lg bg-code-surface p-3 font-mono text-[12.5px] leading-5 text-code-foreground [font-variant-ligatures:none]">
        <code>{drill.code}</code>
      </pre>
      <PredictionPrompt
        resetKey={drill.id}
        question={drill.question}
        options={drill.options.map((o) => ({ id: o.id, label: <span className="font-mono [font-variant-ligatures:none]">{o.label}</span>, correct: o.correct, feedback: o.feedback }))}
      >
        <p data-testid="drill-reveal" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          <span className="font-semibold">Value: </span>
          <code className="font-mono [font-variant-ligatures:none]">{drill.answer}</code>. {drill.why} <span className="text-xs opacity-80">({drill.clause})</span>
        </p>
      </PredictionPrompt>
    </section>
  );
}

const DataTypeComparisonChart: React.FC<DataTypeComparisonChartProps> = ({ section = "all" }) => {
  const drills = useMemo(() => drillsForSection(section), [section]);
  const copy = FRAME_COPY[section] ?? FRAME_COPY.all;
  const showWidths = section !== "defaults";
  const showDrills = section !== "widths";

  return (
    <div data-testid="data-type-chart" data-section={section} className="fig-panel !overflow-visible w-full">
      <VisualFrame label={copy.label} eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} fidelity="model" assumptions={copy.assumptions}>
        {section === "all" ? (
          <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            <WidthChart />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">Who may write it</p>
              <p>
                <span className="font-semibold">Variable:</span> {writerRule.variable}
              </p>
              <p>
                <span className="font-semibold">Net:</span> {writerRule.net}
              </p>
              <p className="text-xs text-muted-foreground">
                Assigning a 4-state value to a 2-state variable turns every x and z bit into 0 (§6.11.2), silently.
              </p>
            </div>
          </div>
        ) : null}
        {section === "widths" ? <WidthChart showSign /> : null}

        {showWidths ? <ComparisonTable /> : null}

        {showDrills ? <PredictValues key={section} drills={drills} /> : null}
      </VisualFrame>
    </div>
  );
};

export default DataTypeComparisonChart;
