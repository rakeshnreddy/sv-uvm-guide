"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { elaborateGenerate, generateBlockNames, type GenerateConstruct } from "@/lib/sv-elaboration-model";

type ViewMode = "generate" | "runtime";

const MIN_CH = 1;
const MAX_CH = 4;

function constructsFor(numCh: number, labelled: boolean, covFirst: boolean): GenerateConstruct[] {
  const loop: GenerateConstruct = { kind: "loop", label: labelled ? "gen_chk" : undefined, iterations: numCh, items: ["chk_inst"] };
  return covFirst ? [{ kind: "if", label: "gen_cov", condition: true, items: ["u_cov"] }, loop] : [loop];
}

function generateSource(numCh: number, labelled: boolean, covFirst: boolean, loopName: string): CodeTraceLine[] {
  const lines: CodeTraceLine[] = [
    { text: "module tb_top;", owner: "testbench" },
    { text: `  parameter int NUM_CH = ${numCh};`, owner: "testbench", key: "param" },
  ];
  if (covFirst) lines.push({ text: "  parameter bit EN_COV = 1;", owner: "testbench" });
  lines.push(
    { text: "  logic clk;", owner: "testbench" },
    { text: "  logic [7:0] data_bus [NUM_CH];", owner: "testbench" },
    { text: "" },
  );
  if (covFirst) {
    lines.push(
      { text: "  if (EN_COV) begin : gen_cov        // generate construct 1", owner: "testbench", key: "cov" },
      { text: "    bus_cov u_cov (.clk(clk));", owner: "testbench", key: "cov" },
      { text: "  end", owner: "testbench", key: "cov" },
      { text: "" },
    );
  }
  const n = covFirst ? 2 : 1;
  lines.push(
    {
      text: `  for (genvar i = 0; i < NUM_CH; i++) begin${labelled ? " : gen_chk" : ""}   // construct ${n}${labelled ? "" : ` -> ${loopName}`}`,
      owner: "testbench",
      key: "loop",
    },
    { text: "    protocol_checker chk_inst (.clk(clk), .data(data_bus[i]));", owner: "testbench", key: "loop" },
    { text: "  end", owner: "testbench", key: "loop" },
    { text: "endmodule", owner: "testbench" },
  );
  return lines;
}

const RUNTIME_SOURCE: CodeTraceLine[] = [
  { text: "module tb_top;", owner: "testbench" },
  { text: "  always_ff @(posedge clk) begin", owner: "testbench", key: "loop" },
  { text: "    for (int i = 0; i < NUM_CH; i++)   // one process, runs every edge", owner: "testbench", key: "loop" },
  { text: "      if (data_bus[i] !== expected[i])", owner: "testbench", key: "loop" },
  { text: '        $error("Mismatch on ch %0d", i);', owner: "testbench", key: "loop" },
  { text: "  end", owner: "testbench", key: "loop" },
  { text: "endmodule", owner: "testbench" },
];

export default function GenerateElaborationVisualizer() {
  const [mode, setMode] = useState<ViewMode>("generate");
  const [numCh, setNumCh] = useState(2);
  const [labelled, setLabelled] = useState(true);
  const [covFirst, setCovFirst] = useState(false);

  const constructs = useMemo(() => constructsFor(numCh, labelled, covFirst), [numCh, labelled, covFirst]);
  const names = useMemo(() => generateBlockNames(["NUM_CH", "EN_COV", "clk", "data_bus"], constructs), [constructs]);
  const loopName = names[names.length - 1];
  const paths = useMemo(() => elaborateGenerate({ path: "tb_top", declared: ["NUM_CH", "EN_COV", "clk", "data_bus"], constructs }), [constructs]);
  const checkerPaths = paths.filter((p) => p.endsWith(".chk_inst"));
  const last = numCh - 1;
  const correctPath = `tb_top.${loopName}[${last}].chk_inst`;

  const candidates = [`tb_top.gen_chk[${last}].chk_inst`, `tb_top.chk_inst[${last}]`, `tb_top.genblk1[${last}].chk_inst`, `tb_top.genblk2[${last}].chk_inst`];
  const feedbackFor = (path: string): string => {
    if (path === correctPath) {
      return labelled
        ? "The loop's label names each generated block, and the block index comes from the genvar: gen_chk[i].chk_inst (§27.4)."
        : `An unnamed generate block is named genblk<n>, where n is the loop's position among all generate constructs in tb_top (§27.6). Here it is construct ${covFirst ? 2 : 1}.`;
    }
    if (path.includes("chk_inst[")) return "The loop makes an array of generate blocks, each holding one instance named chk_inst. The index belongs to the block, not to the instance (§27.4).";
    if (path.includes("gen_chk")) return "The loop has no label in this code, so it has no gen_chk name. The tool assigns genblk<n> (§27.6).";
    if (labelled) return "The block has a label, and a label is its name. genblk<n> is only for unnamed blocks (§27.6).";
    return covFirst
      ? "The numbering counts every generate construct in the scope, named or not. The labelled if (EN_COV) block is construct 1, so the loop is construct 2 (§27.6)."
      : "No generate construct comes before the loop, so it is construct 1 (§27.6).";
  };
  const options: PredictionOption[] = candidates.map((p) => ({
    id: p,
    label: <code className="font-mono text-xs [font-variant-ligatures:none]">{p}</code>,
    correct: p === correctPath,
    feedback: feedbackFor(p),
  }));

  const source = mode === "generate" ? generateSource(numCh, labelled, covFirst, loopName) : RUNTIME_SOURCE;

  return (
    <VisualFrame
      label="Generate versus runtime loop"
      eyebrow="Experiment"
      title="Generate vs Runtime"
      summary={
        <>
          A <code className="font-mono">for (genvar …)</code> loop is unrolled at elaboration, before time 0, into separate named scopes. A runtime{" "}
          <code className="font-mono">for (int …)</code> loop is one process that iterates while the simulation runs. Change the code, then predict the hierarchical
          path you would use in <code className="font-mono">bind</code>, <code className="font-mono">config_db</code> or a waveform.
        </>
      }
      fidelity="model"
      assumptions={[
        "Block names follow §27.4 (loop index) and §27.6 (genblk<n> numbering, leading zeros on clashes).",
        "generate/endgenerate keywords are optional and do not change any name.",
        "Instance paths are shown from tb_top.",
      ]}
    >
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="View"
          options={[
            { value: "generate", label: "Generate (Elaboration)" },
            { value: "runtime", label: "Runtime Loop" },
          ]}
          value={mode}
          onChange={setMode}
        />
        <div className="flex items-center gap-1 rounded-full border border-border/70 px-1 py-0.5 text-xs">
          <button
            type="button"
            onClick={() => setNumCh((n) => Math.max(MIN_CH, n - 1))}
            disabled={numCh <= MIN_CH}
            aria-label="Decrease channels"
            className="h-9 w-9 rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[6.5rem] text-center font-mono" aria-live="polite">
            NUM_CH = <strong>{numCh}</strong>
          </span>
          <button
            type="button"
            onClick={() => setNumCh((n) => Math.min(MAX_CH, n + 1))}
            disabled={numCh >= MAX_CH}
            aria-label="Increase channels"
            className="h-9 w-9 rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {mode === "generate" ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-amber-500" checked={labelled} onChange={(e) => setLabelled(e.target.checked)} />
            Label the loop block <code className="font-mono">: gen_chk</code>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-amber-500" checked={covFirst} onChange={(e) => setCovFirst(e.target.checked)} />
            Put an <code className="font-mono">if (EN_COV)</code> generate block first
          </label>
        </div>
      ) : null}

      <CodeTrace label={mode === "generate" ? "SystemVerilog source (generate)" : "SystemVerilog source (runtime loop)"} lines={source} contextKeys={["loop"]} />

      {mode === "generate" ? (
        <PredictionPrompt
          resetKey={`${numCh}:${labelled}:${covFirst}`}
          question={
            <>
              What is the full hierarchical path of the checker for channel {last}?
            </>
          }
          options={options}
        >
          <div className="space-y-2" aria-live="polite">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Elaborated hierarchy (built before time 0)</p>
            <ul aria-label="Elaborated instances" className="space-y-1.5">
              {paths.map((p) => (
                <li key={p} className="w-fit max-w-full break-all rounded-sm border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 font-mono text-xs text-foreground">
                  {p}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {checkerPaths.length} separate <code className="font-mono">protocol_checker</code> instance{checkerPaths.length > 1 ? "s" : ""}, each in its own
              scope, all running concurrently. Inside each block, <code className="font-mono">i</code> is a constant (an implicit localparam, §27.4), so
              procedural code in the block such as <code className="font-mono">always_ff @(posedge clk) q[i] &lt;= d[i];</code> is legal.
            </p>
          </div>
        </PredictionPrompt>
      ) : (
        <div className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-3 text-sm" aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Runtime execution (simulation time)</p>
          <ol className="list-decimal space-y-1 pl-5 font-mono text-xs">
            {Array.from({ length: numCh }, (_, i) => (
              <li key={i}>
                i = {i}: check data_bus[{i}] against expected[{i}]
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground">
            One process repeats these {numCh} steps in order at every clock edge. Nothing new appears in the hierarchy, and a runtime loop cannot instantiate
            modules, interfaces or checkers.
          </p>
        </div>
      )}
    </VisualFrame>
  );
}
