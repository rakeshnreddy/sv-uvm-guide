"use client";

import React, { useState } from "react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  AMBA_PROTOCOLS,
  CAPABILITY_LABELS,
  FACT_KEYS,
  FACT_LABELS,
  FIT_SCENARIOS,
  SUPPORT_CUES,
  assessFit,
  bestFit,
  getFitScenario,
  getProtocol,
  type AmbaProtocol,
  type AmbaProtocolId,
  type Capability,
  type FitScenario,
  type Support,
} from "@/lib/amba-family-model";
import { cn } from "@/lib/utils";

export const AMBA_FAMILY_ASSUMPTIONS = [
  "Facts are checked against Arm IHI0024D (APB), IHI0033B.b (AHB-Lite and AHB5), IHI0022E (AXI3, AXI4, AXI4-Lite, ACE, ACE-Lite), IHI0051A (AXI4-Stream) and IHI0050E.b (CHI). Each row cites its section.",
  "Later issues add features not covered here (for example AXI5 atomics and newer CHI revisions).",
  "The fit check compares what a block needs with what each protocol offers. Real choices also weigh existing IP, the interconnect, clocking and verification effort.",
  "'Typical use' lines are engineering practice, not specification text. Older issues say master/slave; newer Arm issues say manager/subordinate or requester/completer.",
];

const supportTone: Record<Support, string> = {
  yes: "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  no: "border-slate-400/60 bg-slate-500/10 text-slate-700 dark:text-slate-200",
  optional: "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  limited: "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  "n/a": "border-dashed border-slate-400/60 text-muted-foreground",
};

function SupportBadge({ support, compact = false }: { support: Support; compact?: boolean }) {
  const cue = SUPPORT_CUES[support];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", supportTone[support])}>
      <span aria-hidden>{cue.glyph}</span>
      {compact ? <span>{support === "n/a" ? "n/a" : cue.word.toLowerCase()}</span> : cue.word}
    </span>
  );
}

function LaneStrip({ protocol }: { protocol: AmbaProtocol }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Channels and phases, initiator view</p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label={`${protocol.name} channels and phases`}>
        {protocol.lanes.map((lane) => (
          <li
            key={lane.name}
            className={cn(
              "min-w-0 rounded-lg border px-2.5 py-1.5 text-xs",
              lane.dir === "out"
                ? "border-sky-500/60 bg-sky-500/10 text-sky-900 dark:text-sky-100"
                : "border-dashed border-violet-500/60 bg-violet-500/10 text-violet-900 dark:text-violet-100",
            )}
          >
            <span className="font-mono font-semibold [font-variant-ligatures:none]">
              {lane.dir === "out" ? `${lane.name} →` : `← ${lane.name}`}
            </span>
            <span className="sr-only">{lane.dir === "out" ? ", initiator to completer: " : ", towards the initiator: "}</span>
            <span className="ml-1.5 text-muted-foreground">{lane.carries}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProtocolCard({ protocol }: { protocol: AmbaProtocol }) {
  return (
    <article className="space-y-4 rounded-xl border border-border/70 bg-background/60 p-3 sm:p-4" aria-label={`${protocol.name} profile`}>
      <header>
        <h4 className="text-base font-semibold text-foreground">
          {protocol.name} <span className="font-normal text-muted-foreground">· {protocol.fullName}</span>
        </h4>
        <p className="font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{protocol.spec}</p>
        <p className="mt-2 text-sm text-foreground">{protocol.summary}</p>
      </header>

      <LaneStrip protocol={protocol} />

      <dl className="divide-y divide-border/60 rounded-lg border border-border/60">
        {FACT_KEYS.map((key) => {
          const fact = protocol.facts[key];
          return (
            <div key={key} className="flex flex-wrap gap-x-4 gap-y-1 p-3">
              <dt className="w-44 shrink-0 text-xs font-semibold text-foreground">{FACT_LABELS[key]}</dt>
              <dd className="min-w-0 flex-1 basis-56 text-sm text-foreground">
                <div className="flex flex-wrap items-start gap-2">
                  {fact.support ? <SupportBadge support={fact.support} /> : null}
                  <span className="min-w-0 flex-1">{fact.text}</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{fact.source}</p>
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="text-sm text-foreground">
        <span className="font-semibold">Typical use</span> <span className="text-xs text-muted-foreground">(engineering practice, not spec text)</span>: {protocol.typicalUse}
      </p>
      {protocol.caveat ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-3 text-sm text-foreground">
          <span className="font-semibold">Note: </span>
          {protocol.caveat}
        </p>
      ) : null}
    </article>
  );
}

function CompareTable() {
  const keys = FACT_KEYS.filter((k) => k !== "channels");
  return (
    <details className="rounded-xl border border-border/70 bg-background/40 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">Compare all {AMBA_PROTOCOLS.length} protocols side by side</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-xs">
          <caption className="sr-only">Capability comparison of AMBA protocols</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2 text-left font-semibold text-muted-foreground">
                Capability
              </th>
              {AMBA_PROTOCOLS.map((p) => (
                <th key={p.id} scope="col" className="p-2 text-left font-semibold text-foreground">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key} className="border-t border-border/60">
                <th scope="row" className="p-2 text-left font-medium text-foreground">
                  {FACT_LABELS[key]}
                </th>
                {AMBA_PROTOCOLS.map((p) => {
                  const support = p.facts[key].support;
                  return <td key={p.id} className="p-2">{support ? <SupportBadge support={support} compact /> : null}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function capabilityList(items: Capability[]): string {
  return items.map((c) => CAPABILITY_LABELS[c]).join("; ");
}

function FitResults({ scenario, onOpen }: { scenario: FitScenario; onOpen: (id: AmbaProtocolId) => void }) {
  const best = bestFit(scenario);
  return (
    <div className="space-y-3" aria-live="polite">
      <p className="text-sm text-foreground">
        <span className="font-semibold">Why: </span>
        {scenario.why}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">The block needs: </span>
        {capabilityList(scenario.needs)}.
      </p>
      <ul className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]" aria-label="Fit check for each option">
        {scenario.options.map((option) => {
          const protocol = getProtocol(option.protocol);
          const fit = assessFit(option.protocol, scenario);
          const isBest = option.protocol === best;
          return (
            <li
              key={option.protocol}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-lg border p-3 text-sm",
                isBest ? "border-emerald-500/60 bg-emerald-500/10" : fit.missing.length > 0 ? "border-rose-500/50 bg-rose-500/[0.06]" : "border-amber-500/50 bg-amber-500/[0.06]",
              )}
            >
              <p className="font-semibold text-foreground">{protocol.name}</p>
              {isBest ? (
                <p className="text-emerald-800 dark:text-emerald-200">
                  <span aria-hidden>✓ </span>Best fit: has everything the block needs and nothing it would waste.
                </p>
              ) : null}
              {fit.missing.length > 0 ? (
                <p className="text-rose-800 dark:text-rose-200">
                  <span aria-hidden>✕ </span>Lacks: {capabilityList(fit.missing)}.
                </p>
              ) : null}
              {!isBest && fit.missing.length === 0 ? (
                <p className="text-amber-900 dark:text-amber-100">
                  <span aria-hidden>◐ </span>Works, but pays for: {capabilityList(fit.extras)}.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => onOpen(option.protocol)}
                className="mt-auto inline-flex min-h-10 items-center self-start rounded-lg border border-border/70 px-3 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Show the {protocol.name} profile
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AmbaFamilyExplorer() {
  const [protocolId, setProtocolId] = useState<AmbaProtocolId>("axi4");
  const [scenarioId, setScenarioId] = useState(FIT_SCENARIOS[0].id);
  const protocol = getProtocol(protocolId);
  const scenario = getFitScenario(scenarioId);
  const best = bestFit(scenario);

  const predictionOptions: PredictionOption[] = scenario.options.map((option) => {
    const p = getProtocol(option.protocol);
    return {
      id: option.protocol,
      label: (
        <span>
          <strong>{p.name}</strong>: {p.tagline}
        </span>
      ),
      correct: option.protocol === best,
      feedback: option.feedback,
    };
  });

  return (
    <div data-testid="amba-family-explorer">
      <VisualFrame
        label="AMBA protocol family explorer"
        eyebrow="Mental picture + prediction"
        title="The AMBA family: what each protocol can and cannot do"
        summary="Pick a protocol to see its channels and capabilities, each with the spec section it comes from. Then predict which protocol fits a real block."
        fidelity="model"
        assumptions={AMBA_FAMILY_ASSUMPTIONS}
      >
        <div className="space-y-3">
          <SegmentedControl
            label="Protocol"
            options={AMBA_PROTOCOLS.map((p) => ({ value: p.id, label: p.name }))}
            value={protocolId}
            onChange={setProtocolId}
          />
          <ProtocolCard protocol={protocol} />
          <CompareTable />
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Transfer</p>
            <h4 className="text-base font-semibold text-foreground">Which protocol fits this block?</h4>
          </div>
          <SegmentedControl
            label="Block"
            options={FIT_SCENARIOS.map((s) => ({ value: s.id, label: s.label }))}
            value={scenarioId}
            onChange={setScenarioId}
          />
          <p className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-foreground">{scenario.block}</p>
          <PredictionPrompt question="Which protocol fits this block best?" options={predictionOptions} resetKey={scenario.id}>
            <FitResults scenario={scenario} onOpen={setProtocolId} />
          </PredictionPrompt>
        </div>
      </VisualFrame>
    </div>
  );
}
