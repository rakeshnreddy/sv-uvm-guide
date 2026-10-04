"use client";

import React, { useMemo, useState } from "react";

import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  catcherSource,
  crcInjectMessages,
  CRC_DEMOTER,
  DEFAULT_KNOBS,
  ERROR_SWALLOWER,
  errorCountOptions,
  formatAction,
  knobsToConfig,
  reportPresets,
  runReports,
  settingPlusarg,
  settingSource,
  type MessageFate,
  type MessageOutcome,
  type ReportKnobs,
  type ReportMessage,
  REAL_BUG_INDEX,
} from "@/lib/uvm-report-model";
import { cn } from "@/lib/utils";

export const REPORT_MODEL_ASSUMPTIONS = [
  "Follows uvm-core 2020.3.1 (IEEE 1800.2-2020 Clause 6): uvm_report_object filters only UVM_INFO by verbosity; the handler applies severity overrides and looks up the action ((severity,id) > id > severity); the server runs catchers, drops CAUGHT and UVM_NO_ACTION messages, then counts every message it executes.",
  "Default actions: INFO and WARNING display; ERROR display + count; FATAL display + exit. Default verbosity UVM_MEDIUM; default max quit count 0 (never quit on count).",
  "A catcher that changes the severity without set_action() switches to the new severity's default action.",
  "$error is a SystemVerilog severity task (IEEE 1800-2023 §20.10): the simulator prints it, UVM never sees it.",
  "Pass/fail here uses the common convention UVM_ERROR + UVM_FATAL = 0. Your regression script decides what counts.",
  "Message text, file names and line numbers are invented; the line layout follows uvm_report_server::compose_report_message.",
];

const fateCue: Record<MessageFate, { glyph: string; label: string; className: string }> = {
  displayed: { glyph: "✓", label: "shown + counted", className: "text-emerald-700 dark:text-emerald-300" },
  "executed-silently": { glyph: "●", label: "counted, not shown", className: "text-sky-700 dark:text-sky-300" },
  filtered: { glyph: "⊘", label: "filtered by verbosity", className: "text-muted-foreground" },
  caught: { glyph: "✕", label: "caught by a catcher", className: "text-rose-700 dark:text-rose-300" },
  "no-action": { glyph: "∅", label: "UVM_NO_ACTION: dropped", className: "text-rose-700 dark:text-rose-300" },
  "sv-task": { glyph: "⚠", label: "$error: invisible to UVM", className: "text-amber-700 dark:text-amber-300" },
  "not-reached": { glyph: "—", label: "never issued (run ended)", className: "text-muted-foreground" },
};

function messageSource(m: ReportMessage): string {
  if (m.origin === "sv") return `$error("${m.text}");`;
  if (m.severity === "UVM_INFO") return `\`uvm_info("${m.id}", "${m.text}", ${m.verbosity ?? "UVM_MEDIUM"})`;
  const macro = m.severity === "UVM_WARNING" ? "uvm_warning" : m.severity === "UVM_ERROR" ? "uvm_error" : "uvm_fatal";
  return `\`${macro}("${m.id}", "${m.text}")`;
}

const shortSource = (s: string) => s.replace(/^uvm_test_top\./, "");

function knobsEqual(a: ReportKnobs, b: ReportKnobs) {
  return a.verbosity === b.verbosity && a.catcher === b.catcher && a.errorAction === b.errorAction && a.maxQuitCount === b.maxQuitCount;
}

function FateBadge({ outcome }: { outcome: MessageOutcome }) {
  const cue = fateCue[outcome.fate];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold", cue.className)}>
      <span aria-hidden>{cue.glyph}</span>
      {cue.label}
      {outcome.demoted ? (
        <span className="ml-1 rounded border border-amber-500/60 px-1 text-[10px] text-amber-800 dark:text-amber-200">↓ demoted to {outcome.finalSeverity}</span>
      ) : null}
    </span>
  );
}

function Verdict({ outcomes, passed, reason }: { outcomes: MessageOutcome[]; passed: boolean; reason: string }) {
  const realBug = outcomes[REAL_BUG_INDEX];
  const injectedCounted = outcomes.filter((o) => o.message.id === "CRC" && o.counted && o.finalSeverity === "UVM_ERROR").length;
  let tone: "good" | "warn" | "bad";
  let headline: string;
  let detail: string;
  if (passed) {
    tone = "bad";
    headline = "▲ Test PASSES — the DUT bug escapes";
    detail = `The real mismatch on pkt 5 was ${realBug.fate === "not-reached" ? "never issued" : "removed from the count"}.`;
  } else if (realBug.fate !== "displayed") {
    tone = "warn";
    headline = "✕ Test FAILS, but not because of the real bug";
    detail = "The run ended before the scoreboard reported pkt 5. Only the expected CRC errors were counted.";
  } else if (injectedCounted > 0) {
    tone = "warn";
    headline = "✕ Test FAILS for the wrong reasons too";
    detail = `The ${injectedCounted} expected CRC error${injectedCounted > 1 ? "s are" : " is"} counted as failures, so this test would fail even on a correct DUT.`;
  } else {
    tone = "good";
    headline = "✓ Test FAILS for exactly the right reason";
    detail = "Only the real scoreboard mismatch is counted as an error.";
  }
  return (
    <p
      aria-live="polite"
      className={cn(
        "rounded-xl border p-3 text-sm",
        tone === "good" && "border-emerald-500/50 bg-emerald-500/10",
        tone === "warn" && "border-amber-500/50 bg-amber-500/10",
        tone === "bad" && "border-rose-500/50 bg-rose-500/10",
      )}
    >
      <strong>{headline}. </strong>
      {detail} <span className="text-muted-foreground">({reason})</span>
    </p>
  );
}

function generatedCode(knobs: ReportKnobs): { classes: string[]; test: string[]; plusargs: string[] } {
  const config = knobsToConfig(knobs);
  const catcher = knobs.catcher === "demote-crc" ? CRC_DEMOTER : knobs.catcher === "catch-all-errors" ? ERROR_SWALLOWER : null;
  const classes = catcher ? catcherSource(catcher) : [];
  const test: string[] = ["class crc_inject_test extends base_test;"];
  if (catcher) {
    test.push(`  ${catcher.name} catcher;`);
    test.push("  function void build_phase(uvm_phase phase);");
    test.push("    super.build_phase(phase);");
    test.push(`    catcher = ${catcher.name}::type_id::create("catcher");`);
    test.push("    uvm_report_cb::add(null, catcher);   // null: every report object");
    test.push("  endfunction");
  }
  const procedural = config.settings.filter((s) => s.comp !== "*");
  if (procedural.length) {
    test.push("  function void end_of_elaboration_phase(uvm_phase phase);");
    procedural.forEach((s) => test.push(`    ${settingSource(s)}`));
    test.push("  endfunction");
  }
  if (test.length === 1) test.push("  // no report configuration");
  test.push("endclass");
  const plusargs = config.settings.filter((s) => s.comp === "*").map(settingPlusarg);
  procedural.forEach((s) => plusargs.push(`${settingPlusarg(s)}   // same effect, no recompile`));
  if (knobs.maxQuitCount) plusargs.push(`+UVM_MAX_QUIT_COUNT=${knobs.maxQuitCount}`);
  return { classes, test, plusargs };
}

/**
 * Report pipeline explorer (kept under its historical name so lessons keep working):
 * an error-injection test's messages flow through verbosity filtering, severity
 * overrides, actions, report catchers and the report server.
 */
export default function TelemetryEventBusVisualizer() {
  const [knobs, setKnobs] = useState<ReportKnobs>(DEFAULT_KNOBS);
  const run = useMemo(() => runReports(crcInjectMessages, knobsToConfig(knobs)), [knobs]);
  const options = useMemo(() => errorCountOptions(knobs), [knobs]);
  const code = useMemo(() => generatedCode(knobs), [knobs]);
  const preset = reportPresets.find((p) => knobsEqual(p.knobs, knobs));
  const resetKey = JSON.stringify(knobs);
  const set = <K extends keyof ReportKnobs>(key: K, value: ReportKnobs[K]) => setKnobs((k) => ({ ...k, [key]: value }));

  return (
    <VisualFrame
      label="UVM report pipeline explorer"
      eyebrow="Experiment"
      title="Where does a `uvm_error go?"
      summary={
        <>
          <span className="font-mono [font-variant-ligatures:none]">crc_inject_test</span> corrupts the CRC of packets 2 and 4 on purpose, so the monitor
          reports two <em>expected</em> errors. Packet 5 exposes a <em>real</em> DUT bug. Configure reporting, predict the error count, then follow each message.
        </>
      }
      fidelity="model"
      assumptions={REPORT_MODEL_ASSUMPTIONS}
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Start from a preset</p>
          <SegmentedControl
            label="Report configuration preset"
            options={reportPresets.map((p) => ({ value: p.id, label: p.title }))}
            value={preset?.id ?? "custom"}
            onChange={(id) => {
              const p = reportPresets.find((x) => x.id === id);
              if (p) setKnobs(p.knobs);
            }}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">{preset ? preset.summary : "Custom combination."}</p>
        </div>

        <fieldset className="grid gap-3 rounded-xl border border-border/70 bg-background/40 p-3 grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))]">
          <legend className="px-1 text-xs font-semibold text-foreground">Knobs</legend>
          <div>
            <p className="mb-1 font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">+UVM_VERBOSITY</p>
            <SegmentedControl
              label="Global verbosity"
              mono
              value={knobs.verbosity}
              onChange={(v) => set("verbosity", v)}
              options={[
                { value: "UVM_LOW", label: "LOW" },
                { value: "UVM_MEDIUM", label: "MEDIUM" },
                { value: "UVM_HIGH", label: "HIGH" },
              ]}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Report catcher</p>
            <SegmentedControl
              label="Report catcher"
              mono
              value={knobs.catcher}
              onChange={(v) => set("catcher", v)}
              options={[
                { value: "none", label: "none" },
                { value: "demote-crc", label: "crc_demoter" },
                { value: "catch-all-errors", label: "error_swallower" },
              ]}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">UVM_ERROR action under env</p>
            <SegmentedControl
              label="UVM_ERROR action"
              mono
              value={knobs.errorAction}
              onChange={(v) => set("errorAction", v)}
              options={[
                { value: "default", label: "default" },
                { value: "display-only", label: "UVM_DISPLAY" },
                { value: "no-action", label: "UVM_NO_ACTION" },
              ]}
            />
          </div>
          <div>
            <p className="mb-1 font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">+UVM_MAX_QUIT_COUNT</p>
            <SegmentedControl
              label="Max quit count"
              mono
              value={String(knobs.maxQuitCount) as "0" | "2"}
              onChange={(v) => set("maxQuitCount", Number(v) as 0 | 2)}
              options={[
                { value: "0", label: "0 (default)" },
                { value: "2", label: "2" },
              ]}
            />
          </div>
        </fieldset>

        <figure className="overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
          <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Reports issued, in time order (t in ns)
          </figcaption>
          <ol className="overflow-x-auto py-2 font-mono text-[12px] leading-6 [font-variant-ligatures:none]">
            {crcInjectMessages.map((m, i) => (
              <li key={i} className="flex gap-3 px-3">
                <span className="w-10 shrink-0 text-right text-slate-400">{m.time}</span>
                <span className="w-24 shrink-0 truncate text-slate-400">{m.origin === "sv" ? "bus_if" : shortSource(m.source) || "test"}</span>
                <code className="whitespace-pre">{messageSource(m)}</code>
              </li>
            ))}
          </ol>
        </figure>
      </div>

      <PredictionPrompt
        question="How many UVM_ERRORs will the report summary count?"
        resetKey={resetKey}
        options={options.map((o) => ({ id: String(o.value), label: `${o.value} UVM_ERROR${o.value === 1 ? "" : "s"}`, correct: o.correct, feedback: o.feedback }))}
      >
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[300px] text-left text-sm">
              <caption className="sr-only">What happened to each report</caption>
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">t</th>
                  <th scope="col" className="px-3 py-2">Report</th>
                  <th scope="col" className="px-3 py-2">Fate and why</th>
                </tr>
              </thead>
              <tbody>
                {run.outcomes.map((o, i) => (
                  <tr key={i} className={cn("border-t border-border/60 align-top", i === REAL_BUG_INDEX && "bg-rose-500/[0.04]")}>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums">{o.message.time}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs [font-variant-ligatures:none]">
                        {o.message.origin === "sv" ? "$error" : o.originalSeverity} [{o.message.id}]
                      </span>
                      <span className="block text-xs text-muted-foreground">{o.message.text}</span>
                      {i === REAL_BUG_INDEX ? <span className="mt-0.5 inline-block rounded bg-rose-500/15 px-1 text-[10px] font-bold uppercase text-rose-800 dark:text-rose-200">real bug</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <FateBadge outcome={o} />
                      <p className="mt-1 text-xs text-foreground/90">{o.why}</p>
                      {o.stages.length > 1 ? (
                        <details className="mt-1 text-xs text-muted-foreground">
                          <summary className="cursor-pointer">Pipeline steps</summary>
                          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                            {o.stages.map((s, j) => (
                              <li key={j}>
                                <span aria-hidden>{s.ok ? "→ " : "■ "}</span>
                                {s.text}
                              </li>
                            ))}
                          </ol>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
            <figure className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
              <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Simulator log</figcaption>
              <pre className="overflow-x-auto p-3 font-mono text-[11.5px] leading-5 [font-variant-ligatures:none]">
                {run.outcomes
                  .filter((o) => o.line && (o.fate === "displayed" || o.fate === "sv-task"))
                  .map((o) => o.line)
                  .join("\n") || "(nothing displayed)"}
                {run.exitedAt ? "\n-- UVM_EXIT: uvm_root::die() prints the summary and ends the run --" : ""}
              </pre>
            </figure>
            <figure className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
              <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Report summary</figcaption>
              <pre className="overflow-x-auto p-3 font-mono text-[11.5px] leading-5 [font-variant-ligatures:none]">{run.summaryLines.join("\n")}</pre>
            </figure>
          </div>

          <Verdict outcomes={run.outcomes} passed={run.verdict.passed} reason={run.verdict.reason} />

          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
            {code.classes.length ? (
              <figure className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
                <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">The catcher</figcaption>
                <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-5 [font-variant-ligatures:none]">{code.classes.join("\n")}</pre>
              </figure>
            ) : null}
            <figure className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
              <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">The test and command line</figcaption>
              <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-5 [font-variant-ligatures:none]">
                {code.test.join("\n")}
                {code.plusargs.length ? `\n\n// simulator command line\n${code.plusargs.join("\n")}` : ""}
              </pre>
            </figure>
          </div>
          <p className="text-xs text-muted-foreground">
            Current UVM_ERROR action under env: <span className="font-mono [font-variant-ligatures:none]">{formatAction(knobsToConfig(knobs).settings.find((s) => s.kind === "severity_action")?.action ?? ["UVM_DISPLAY", "UVM_COUNT"])}</span>.
            Change a knob to predict again.
          </p>
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
