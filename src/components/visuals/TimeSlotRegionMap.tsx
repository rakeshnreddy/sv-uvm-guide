"use client";

import React, { useState } from "react";

import { REGION_LABELS, type RegionId } from "@/lib/sv-scheduler-model";
import { FidelityBadge } from "@/components/visual-system/FidelityBadge";

import { RegionLadder } from "./scheduler/RegionLadder";
import { regionGuideById } from "./scheduler/region-guide";

/**
 * The mental picture for scheduling: a ladder of regions inside one
 * simulation time. Select a rung to see what lives there and where it
 * matters in a testbench.
 */
export default function TimeSlotRegionMap() {
  const [selected, setSelected] = useState<RegionId>("active");
  const guide = regionGuideById[selected];

  return (
    <section aria-label="Time slot region map" className="not-prose my-8 rounded-2xl border border-border/70 bg-card/40 p-3 sm:p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mental picture</p>
          <h3 className="text-lg font-semibold text-foreground">A time slot is a ladder, not an instant</h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Simulation time stands still while the scheduler climbs down these regions — looping back up whenever new events appear. Select a rung.
          </p>
        </div>
        <FidelityBadge
          fidelity="illustration"
          assumptions={[
            "Shows the IEEE 1800 Clause 4 regions that user code can reach. PLI-only regions (Pre-Active, Pre-NBA, Post-NBA, Pre-Observed, Post-Observed, Pre-Re-NBA, Post-Re-NBA, Pre-Postponed) are omitted.",
            "Region order is normative; which process runs first inside one region is not.",
          ]}
        />
      </div>
      <div className="grid items-start gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <div className="overflow-x-auto">
          <RegionLadder selectedRegion={selected} onSelectRegion={setSelected} className="mx-auto" />
        </div>
        <div aria-live="polite" className="rounded-xl border border-border/70 bg-background/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {guide.family === "readOnly" ? "Read-only region" : guide.family === "activeSet" ? "Active region set" : guide.family === "observed" ? "Iterative region · drained with the active set (§4.5)" : "Reactive region set"}
          </p>
          <h4 className="mt-1 text-xl font-semibold text-foreground">{REGION_LABELS[selected]}</h4>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{guide.holds}</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12.5px] text-slate-100 [font-variant-ligatures:none]">
            <code>{guide.example}</code>
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">
            <strong className="text-foreground">In a testbench: </strong>
            {guide.inTestbench}
          </p>
        </div>
      </div>
    </section>
  );
}
