"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  compareObjects,
  comparePredictionOptions,
  compareScenarios,
  COPY_TEST_LINES,
  copyImplLines,
  defaultFields,
  fieldMacroLine,
  flagText,
  hex,
  INT_FIELDS,
  noFlagWarning,
  printerDefaultCall,
  printObject,
  runCopy,
  type CompareSetup,
  type CompareStatus,
  type CopyImpl,
  type FieldFlags,
  type FieldSpec,
  type PrinterKind,
} from "@/lib/uvm-policy-model";
import { cn } from "@/lib/utils";

export const POLICY_MODEL_ASSUMPTIONS = [
  "Field-macro semantics follow uvm-core 2020.3.1 (IEEE 1800.2-2020 Annex B): an operation runs only when the flag includes it (UVM_ALL_ON) and not its UVM_NO* bit. A UVM_NO* flag without UVM_ALL_ON enables nothing and warns UVM/FIELDS/NO_FLAG.",
  "compare() (uvm_comparer, 16.3): field macros run first, then do_compare(); default threshold 1 and show_max 1; MISCMP messages are UVM_INFO at UVM_LOW.",
  "copy() (16.6): UVM_REFERENCE copies the handle; otherwise the nested object is created and copied. A hand-written do_copy copies only what it says.",
  "print() (16.2): uvm_printer::set_default() picks the printer. Column widths are simplified.",
  "Object ids such as @12 are invented; simulators number objects differently.",
];

type Mode = "compare" | "copy" | "print";

const statusCue: Record<CompareStatus, { glyph: string; label: string; className: string }> = {
  equal: { glyph: "✓", label: "equal", className: "text-emerald-700 dark:text-emerald-300" },
  miscompare: { glyph: "✕", label: "miscompare", className: "text-rose-700 dark:text-rose-300" },
  "skipped-flag": { glyph: "⊘", label: "not compared (flag)", className: "text-muted-foreground" },
  "skipped-threshold": { glyph: "⏹", label: "not compared (threshold)", className: "text-amber-700 dark:text-amber-300" },
  "same-handle": { glyph: "≡", label: "same handle", className: "text-emerald-700 dark:text-emerald-300" },
};

const INT_FLAG_CHOICES: { id: string; flags: FieldFlags }[] = [
  { id: "on", flags: { allOn: true } },
  { id: "nocompare", flags: { allOn: true, noCompare: true } },
  { id: "nocompare-only", flags: { allOn: false, noCompare: true } },
];
const OBJ_FLAG_CHOICES: { id: string; flags: FieldFlags }[] = [
  { id: "on", flags: { allOn: true } },
  { id: "reference", flags: { allOn: true, reference: true } },
];
const PRINT_TAG_CHOICES: { id: string; flags: FieldFlags }[] = [
  { id: "on", flags: { allOn: true } },
  { id: "noprint", flags: { allOn: true, noPrint: true } },
  { id: "nocompare-only", flags: { allOn: false, noCompare: true } },
];

function choiceId(choices: { id: string; flags: FieldFlags }[], flags: FieldFlags): string {
  return choices.find((c) => flagText(c.flags) === flagText(flags))?.id ?? choices[0].id;
}

function FlagSelect({
  field,
  choices,
  onChange,
}: {
  field: FieldSpec;
  choices: { id: string; flags: FieldFlags }[];
  onChange: (flags: FieldFlags) => void;
}) {
  return (
    <select
      aria-label={`Flag for ${field.name}`}
      value={choiceId(choices, field.flags)}
      onChange={(e) => onChange((choices.find((c) => c.id === e.target.value) ?? choices[0]).flags)}
      className="h-10 max-w-[11rem] rounded border border-slate-600 bg-slate-900 px-1 font-mono text-[11px] text-slate-100"
    >
      {choices.map((c) => (
        <option key={c.id} value={c.id}>
          {flagText(c.flags)}
        </option>
      ))}
    </select>
  );
}

function classLines(fields: FieldSpec[], userDoCompare?: string[]): CodeTraceLine[] {
  const lines: CodeTraceLine[] = [
    { text: "class packet extends uvm_sequence_item;", owner: "testbench" },
    { text: "  `uvm_object_utils_begin(packet)", owner: "testbench" },
    ...fields.map((f) => ({ text: `    ${fieldMacroLine(f)}`, owner: "testbench" as const, key: `field:${f.name}` })),
    { text: "  `uvm_object_utils_end", owner: "testbench" },
  ];
  if (userDoCompare) {
    lines.push(
      { text: "  virtual function bit do_compare(uvm_object rhs, uvm_comparer comparer);", owner: "testbench" },
      { text: "    packet rhs_;", owner: "testbench" },
      { text: "    if (!$cast(rhs_, rhs)) return 0;", owner: "testbench" },
      { text: `    return ${userDoCompare.map((f) => `(${f} == rhs_.${f})`).join(" && ")};`, owner: "testbench" },
      { text: "  endfunction", owner: "testbench" },
    );
  }
  lines.push({ text: "endclass", owner: "testbench" });
  return lines;
}

function CodePanel({ label, lines }: { label: string; lines: string[] }) {
  return (
    <figure aria-label={label} className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
      <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</figcaption>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-5 [font-variant-ligatures:none]">{lines.join("\n")}</pre>
    </figure>
  );
}

function CompareMode() {
  const [scenarioId, setScenarioId] = useState(compareScenarios[0].id);
  const base = compareScenarios.find((s) => s.id === scenarioId) ?? compareScenarios[0];
  const [fields, setFields] = useState<FieldSpec[]>(base.setup.fields);
  const [threshold, setThreshold] = useState(1);
  const [showMax, setShowMax] = useState(1);

  const pick = (id: string) => {
    const s = compareScenarios.find((x) => x.id === id) ?? compareScenarios[0];
    setScenarioId(id);
    setFields(s.setup.fields);
    setThreshold(s.setup.threshold);
    setShowMax(s.setup.showMax);
  };

  const setup: CompareSetup = useMemo(() => ({ ...base.setup, fields, threshold, showMax }), [base, fields, threshold, showMax]);
  const result = useMemo(() => compareObjects(setup), [setup]);
  const options = useMemo(() => comparePredictionOptions(setup), [setup]);
  const resetKey = JSON.stringify({ scenarioId, f: fields.map((f) => flagText(f.flags)), threshold, showMax });
  const { lhs, rhs, heap } = setup;
  const warnings = fields.map(noFlagWarning).filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <SegmentedControl label="Compare scenario" options={compareScenarios.map((s) => ({ value: s.id, label: s.title }))} value={scenarioId} onChange={pick} />
      <p className="text-sm text-muted-foreground">{base.summary} Change a flag or a comparer knob to predict again.</p>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <CodeTrace
          label="packet: field macros (flags are editable)"
          lines={classLines(fields, setup.userDoCompare)}
          renderLineControl={(line) => {
            if (!line.key?.startsWith("field:")) return null;
            const name = line.key.slice(6);
            const field = fields.find((f) => f.name === name);
            if (!field) return null;
            return (
              <FlagSelect
                field={field}
                choices={field.kind === "int" ? INT_FLAG_CHOICES : OBJ_FLAG_CHOICES}
                onChange={(flags) => setFields((cur) => cur.map((f) => (f.name === name ? { ...f, flags } : f)))}
              />
            );
          }}
        />
        <div className="min-w-0 space-y-3">
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[260px] text-left font-mono text-xs [font-variant-ligatures:none]">
              <caption className="sr-only">Expected and actual packet values</caption>
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-1.5">field</th>
                  <th scope="col" className="px-2 py-1.5">EXP (lhs)</th>
                  <th scope="col" className="px-2 py-1.5">ACT (rhs)</th>
                </tr>
              </thead>
              <tbody>
                {INT_FIELDS.map((f) => (
                  <tr key={f} className="border-t border-border/50">
                    <td className="px-2 py-1">{f}</td>
                    <td className="px-2 py-1">{hex(lhs[f])}</td>
                    <td className="px-2 py-1">
                      {hex(rhs[f])}
                      {lhs[f] !== rhs[f] ? <span className="ml-1 text-rose-700 dark:text-rose-300">≠</span> : null}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border/50">
                  <td className="px-2 py-1">cfg</td>
                  <td className="px-2 py-1">@{lhs.cfg} {"{"}burst_len {heap[lhs.cfg as number].burst_len}{"}"}</td>
                  <td className="px-2 py-1">
                    @{rhs.cfg} {"{"}burst_len {heap[rhs.cfg as number].burst_len}{"}"}
                    {lhs.cfg !== rhs.cfg ? <span className="ml-1 text-muted-foreground">(other object)</span> : null}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
            <div>
              <p className="mb-1 font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">set_threshold()</p>
              <SegmentedControl
                label="Comparer threshold"
                mono
                value={String(threshold)}
                onChange={(v) => setThreshold(Number(v))}
                options={[
                  { value: "1", label: "1 (default)" },
                  { value: "0", label: "0 (no limit)" },
                ]}
              />
            </div>
            <div>
              <p className="mb-1 font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">set_show_max()</p>
              <SegmentedControl
                label="Comparer show_max"
                mono
                value={String(showMax)}
                onChange={(v) => setShowMax(Number(v))}
                options={[
                  { value: "1", label: "1 (default)" },
                  { value: "10", label: "10" },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      <PredictionPrompt
        question={<>What does <code className="font-mono [font-variant-ligatures:none]">exp.compare(act, cmp)</code> return, and what does <code className="font-mono [font-variant-ligatures:none]">cmp.get_result()</code> count?</>}
        resetKey={resetKey}
        options={options.map((o) => ({ id: o.id, label: `returns ${o.returned}, get_result() = ${o.result}`, correct: o.correct, feedback: o.feedback }))}
      >
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[300px] text-left text-xs">
              <caption className="sr-only">How the comparer walked the fields</caption>
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-1.5">Field (declaration order)</th>
                  <th scope="col" className="px-2 py-1.5">Outcome</th>
                  <th scope="col" className="px-2 py-1.5">Why</th>
                </tr>
              </thead>
              <tbody>
                {result.steps.map((s) => (
                  <tr key={s.field} className="border-t border-border/50 align-top">
                    <td className="px-2 py-1.5 font-mono [font-variant-ligatures:none]">{s.field}</td>
                    <td className={cn("whitespace-nowrap px-2 py-1.5 font-semibold", statusCue[s.status].className)}>
                      <span aria-hidden>{statusCue[s.status].glyph} </span>
                      {statusCue[s.status].label}
                    </td>
                    <td className="px-2 py-1.5">{s.why}</td>
                  </tr>
                ))}
                {result.doCompareReturned !== undefined ? (
                  <tr className="border-t border-border/50">
                    <td className="px-2 py-1.5 font-mono">do_compare()</td>
                    <td className="px-2 py-1.5 font-semibold">returns {result.doCompareReturned}</td>
                    <td className="px-2 py-1.5">Runs after the field macros; both results count.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <CodePanel label="Log" lines={[...warnings, ...result.printed].length ? [...warnings, ...result.printed] : ["(no MISCMP messages)"]} />
          <p aria-live="polite" className="rounded-xl border border-border/70 bg-background/50 p-3 text-sm">
            <strong>compare() returned {result.returned}</strong>, get_result() = {result.result}
            {result.miscompares.length > result.printed.filter((p) => p.includes("Miscompare for")).length
              ? `; get_miscompares() holds all ${result.miscompares.length}, but show_max limits what is printed.`
              : "."}{" "}
            MISCMP messages are <strong>UVM_INFO</strong> at UVM_LOW, so a scoreboard must check the return value and raise its own `uvm_error.
          </p>
          <CodePanel
            label="In the scoreboard"
            lines={[
              'uvm_comparer cmp = new("cmp");',
              ...(threshold !== 1 ? [`cmp.set_threshold(${threshold});`] : []),
              ...(showMax !== 1 ? [`cmp.set_show_max(${showMax});`] : []),
              "if (!exp.compare(act, cmp))",
              '  `uvm_error("SCB", $sformatf("mismatch:\\n%s", cmp.get_miscompares()))',
            ]}
          />
        </div>
      </PredictionPrompt>
    </div>
  );
}

const copyChoices: { value: CopyImpl; label: string }[] = [
  { value: "macro-deep", label: "macro, UVM_ALL_ON" },
  { value: "macro-reference", label: "macro, UVM_REFERENCE" },
  { value: "manual-alias", label: "do_copy: cfg = rhs_.cfg" },
  { value: "manual-clone", label: "do_copy: clone()" },
];

function HeapPicture({ impl }: { impl: CopyImpl }) {
  const r = runCopy(impl);
  const row = (name: string, packetId: number, cfg: number | null) => (
    <li className="flex flex-wrap items-center gap-1.5 font-mono text-xs [font-variant-ligatures:none]">
      <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-0.5">{name}</span>
      <span aria-hidden>─▶</span>
      <span className="rounded border border-border/80 px-2 py-0.5">packet@{packetId}</span>
      <span aria-hidden>─cfg▶</span>
      <span className={cn("rounded border px-2 py-0.5", r.shared ? "border-rose-500/70 bg-rose-500/10" : "border-border/80")}>
        pkt_cfg@{cfg} {"{"}burst_len = {cfg !== null ? r.heap[cfg].burst_len : "—"}
        {"}"}
      </span>
    </li>
  );
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Heap after the last line</p>
      <ul className="space-y-1.5" aria-label="Handles and objects after p2.cfg.burst_len = 8">
        {row("p1", r.p1.id, r.p1.cfg)}
        {row("p2", r.p2.id, r.p2.cfg)}
      </ul>
      <p className={cn("text-sm", r.shared ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>
        <span aria-hidden>{r.shared ? "⚠ " : "✓ "}</span>
        {r.shared ? "One pkt_cfg is shared by both packets." : "Each packet owns its pkt_cfg."} {r.why}
      </p>
    </div>
  );
}

function CopyMode() {
  const [impl, setImpl] = useState<CopyImpl>("manual-alias");
  const r = runCopy(impl);
  return (
    <div className="space-y-4">
      <SegmentedControl label="How packet copies cfg" mono options={copyChoices} value={impl} onChange={setImpl} />
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <CodePanel label="packet (copy implementation)" lines={copyImplLines(impl)} />
        <CodePanel label="Test code" lines={COPY_TEST_LINES} />
      </div>
      <PredictionPrompt
        question="What does the last line print?"
        resetKey={impl}
        options={[
          {
            id: "4",
            label: "p1 burst_len = 4",
            correct: r.p1BurstAfter === 4,
            feedback: r.p1BurstAfter === 4 ? r.why : "That assumes copy() always duplicates nested objects. Here the copy shares the handle, so the write through p2 is visible through p1.",
          },
          {
            id: "8",
            label: "p1 burst_len = 8",
            correct: r.p1BurstAfter === 8,
            feedback: r.p1BurstAfter === 8 ? r.why : "That assumes the nested object is shared. This implementation gives p2 its own pkt_cfg, so p1 keeps 4.",
          },
          {
            id: "null",
            label: "A null-handle error: p2.cfg was never created",
            correct: false,
            feedback: "Every implementation here assigns p2.cfg — either a new object or p1's handle — so p2.cfg is not null.",
          },
        ]}
      >
        <HeapPicture impl={impl} />
      </PredictionPrompt>
    </div>
  );
}

function PrintMode() {
  const [printer, setPrinter] = useState<PrinterKind>("table");
  const [fields, setFields] = useState<FieldSpec[]>(() => defaultFields().map((f) => (f.name === "tag" ? { ...f, flags: { allOn: false, noCompare: true } } : f)));
  const sample = compareScenarios[0].setup;
  const p1 = { ...sample.lhs, name: "p1" };
  const output = printObject(printer, fields, p1, sample.heap);
  const warnings = fields.map(noFlagWarning).filter(Boolean) as string[];
  const update = (name: string, flags: FieldFlags) => setFields((cur) => cur.map((f) => (f.name === name ? { ...f, flags } : f)));
  const tag = fields.find((f) => f.name === "tag") as FieldSpec;
  const cfg = fields.find((f) => f.name === "cfg") as FieldSpec;

  return (
    <div className="space-y-4">
      <PredictionPrompt
        question={<>The class declares <code className="font-mono [font-variant-ligatures:none]">`uvm_field_int(tag, UVM_NOCOMPARE)</code> — no UVM_ALL_ON. Which is true?</>}
        options={[
          {
            id: "gone",
            label: "tag is missing from print(), copy() and compare(), and a UVM/FIELDS/NO_FLAG warning appears",
            correct: true,
            feedback: "In IEEE 1800.2-2020 a flag enables an operation only if it includes it. UVM_NOCOMPARE alone enables nothing, so the macro is a no-op (UVM 1.2 treated it as UVM_ALL_ON | UVM_NOCOMPARE). Write UVM_ALL_ON | UVM_NOCOMPARE.",
          },
          {
            id: "printed",
            label: "tag is printed and copied; only compare skips it",
            correct: false,
            feedback: "That was UVM 1.2 behaviour. Under 1800.2 the macro needs an explicit positive operation such as UVM_ALL_ON.",
          },
          {
            id: "compile",
            label: "A compile error: UVM_NOCOMPARE needs UVM_ALL_ON",
            correct: false,
            feedback: "It compiles; the library warns at run time and ignores the field.",
          },
        ]}
      >
        <div className="space-y-3">
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">Default printer</p>
              <SegmentedControl
                label="Default printer"
                mono
                value={printer}
                onChange={setPrinter}
                options={[
                  { value: "table", label: "table" },
                  { value: "tree", label: "tree" },
                  { value: "line", label: "line" },
                ]}
              />
            </div>
            <label className="text-[11px] text-muted-foreground">
              tag flag
              <span className="mt-1 block">
                <FlagSelect field={tag} choices={PRINT_TAG_CHOICES} onChange={(f) => update("tag", f)} />
              </span>
            </label>
            <label className="text-[11px] text-muted-foreground">
              cfg flag
              <span className="mt-1 block">
                <FlagSelect field={cfg} choices={OBJ_FLAG_CHOICES} onChange={(f) => update("cfg", f)} />
              </span>
            </label>
          </div>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
            <CodePanel
              label="Test code (IEEE 1800.2)"
              lines={[printerDefaultCall[printer], "p1.print();   // printer == null → uvm_printer::get_default()", "", "// UVM 1.2 only, not in 1800.2:", "// uvm_default_printer = uvm_default_tree_printer;"]}
            />
            <CodePanel label="Output" lines={[...warnings, ...output]} />
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {cfg.flags.reference ? "UVM_REFERENCE prints only cfg's handle, not its fields. " : "cfg is printed recursively. "}
            {opEnabledText(tag)}
          </p>
        </div>
      </PredictionPrompt>
    </div>
  );
}

function opEnabledText(tag: FieldSpec): string {
  if (!tag.flags.allOn) return "tag has no positive operation, so it is skipped everywhere.";
  if (tag.flags.noPrint) return "UVM_NOPRINT hides tag from print() only.";
  return "tag is printed.";
}

/** Policy-class explorer: compare(), copy() and print() driven by field flags and policy knobs. */
export default function UvmPolicyVisualizer() {
  const [mode, setMode] = useState<Mode>("compare");
  return (
    <VisualFrame
      label="UVM policy explorer"
      eyebrow="Experiment"
      title="What do compare(), copy() and print() really do?"
      summary="The same packet class, three policy operations. Change the field flags and the policy knobs, predict, then check how UVM walked the fields."
      fidelity="model"
      assumptions={POLICY_MODEL_ASSUMPTIONS}
    >
      <SegmentedControl
        label="Policy operation"
        mono
        value={mode}
        onChange={setMode}
        options={[
          { value: "compare", label: "compare()" },
          { value: "copy", label: "copy()" },
          { value: "print", label: "print()" },
        ]}
      />
      {mode === "compare" ? <CompareMode /> : mode === "copy" ? <CopyMode /> : <PrintMode />}
    </VisualFrame>
  );
}
