import React from "react";

import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { cn } from "@/lib/utils";

import {
  HISTORY_ERAS,
  KIND_LABELS,
  LANE_LABELS,
  historyEventById,
  sourceNumber,
  type HistoryEvent,
  type HistoryKind,
  type HistoryLane,
} from "./history-timeline";

/*
 * The /history timeline: a static, server-rendered ordered list. Each event
 * carries its lane (Language or Methodology) and its publisher (IEEE standard,
 * Accellera, vendor) as text, with a marker shape as a second cue, so nothing
 * depends on colour or hover. One column at every width, readable at 390 px.
 */

const laneChip: Record<HistoryLane, string> = {
  language: "border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200",
  methodology: "border-violet-500/50 bg-violet-500/10 text-violet-800 dark:text-violet-200",
};

/** Marker on the rail: square = IEEE standard, filled circle = Accellera, hollow circle = vendor. */
function Marker({ kind, point = false }: { kind: HistoryKind; point?: boolean }) {
  const role = point ? { "data-role": "timeline-point" } : {};
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="shrink-0 text-foreground" focusable="false">
      {kind === "ieee" ? (
        <rect x="1" y="1" width="10" height="10" rx="1" fill="currentColor" stroke="currentColor" strokeWidth="2" {...role} />
      ) : (
        <circle
          cx="6"
          cy="6"
          r="5"
          fill={kind === "accellera" ? "currentColor" : "hsl(var(--background))"}
          stroke="currentColor"
          strokeWidth="2"
          {...role}
        />
      )}
    </svg>
  );
}

function TimelineEvent({ event }: { event: HistoryEvent }) {
  const titleId = `history-event-${event.id}`;
  return (
    <li className="relative pl-7" data-testid="history-event" data-lane={event.lane} data-kind={event.kind} aria-labelledby={titleId}>
      <span className="absolute left-[-7px] top-1.5 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-background">
        <Marker kind={event.kind} point />
      </span>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <time dateTime={event.date} className="font-mono font-semibold text-foreground">
          {event.dateLabel}
        </time>
        <span className={cn("rounded border px-2 py-0.5 font-medium", laneChip[event.lane])}>{LANE_LABELS[event.lane]}</span>
        <span className="rounded border border-border px-2 py-0.5 text-muted-foreground">{KIND_LABELS[event.kind]}</span>
      </div>
      <h4 id={titleId} className="mt-1.5 text-h4 text-foreground">
        {event.title}
      </h4>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{event.what}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">
        <span className="font-semibold">Why: </span>
        {event.why}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Sources:{" "}
        {event.sources.map((id, index) => (
          <React.Fragment key={id}>
            {index > 0 ? ", " : null}
            <a
              href={`#source-${id}`}
              className="rounded-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              [{sourceNumber(id)}]
            </a>
          </React.Fragment>
        ))}
      </p>
    </li>
  );
}

function Legend() {
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Timeline key">
      {(Object.keys(KIND_LABELS) as HistoryKind[]).map((kind) => (
        <div key={kind} className="flex items-center gap-1.5">
          <dt>
            <Marker kind={kind} />
          </dt>
          <dd>{KIND_LABELS[kind]}</dd>
        </div>
      ))}
      {(Object.keys(LANE_LABELS) as HistoryLane[]).map((lane) => (
        <div key={lane} className="flex items-center gap-1.5">
          <dt>
            <span className={cn("rounded border px-2 py-0.5 font-medium", laneChip[lane])}>{LANE_LABELS[lane]}</span>
          </dt>
          <dd>{lane === "language" ? "Verilog, SystemVerilog, e" : "VMM, AVM, OVM, UVM"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HistoryTimeline() {
  return (
    <VisualFrame
      label="Timeline of verification languages and methodologies, 1995 to 2024"
      eyebrow="Timeline"
      title="From IEEE 1364 to IEEE 1800-2023 and IEEE 1800.2-2020"
      summary="Each entry says what happened and why. Dates are board approval or announcement dates for IEEE standards, and announcement or release dates otherwise."
      fidelity="illustration"
      assumptions={[
        "Dates for IEEE standards are IEEE SA Standards Board approval dates, except IEEE 1647, which is dated by the IEEE news release that announced it; publication usually followed a few months later.",
        "Only milestones that could be checked against an official page, the standard's own text or the original announcement are shown.",
        "Accellera library dates are the dates its UVM downloads page lists; the uvm-core GitHub release dates sometimes differ.",
      ]}
    >
      <Legend />
      <div data-testid="history-timeline-chart">
        <ol className="mt-5 space-y-8" aria-label="Eras">
          {HISTORY_ERAS.map((era) => (
            <li key={era.id} aria-labelledby={`history-era-${era.id}`}>
              <h3 id={`history-era-${era.id}`} className="text-sm font-semibold text-foreground">
                <span className="mr-2 text-xs font-medium text-subtle">{era.years}</span>
                {era.label}
              </h3>
              <ol className="ml-[7px] mt-3 space-y-5 border-l-2 border-border">
                {era.events.map((id) => {
                  const event = historyEventById(id);
                  return event ? <TimelineEvent key={id} event={event} /> : null;
                })}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    </VisualFrame>
  );
}

/** Lineage picture: what flowed into SystemVerilog and into UVM. Labelled arrows, no hover. */
interface LineageStep {
  label: string;
  detail: string;
  /** Verb on the arrow leading to the next step. */
  arrow?: string;
}

const SV_LINEAGE: LineageStep[] = [
  { label: "Verilog (IEEE 1364)", detail: "1995, 2001 and 2005 editions: the base language", arrow: "extended with" },
  {
    label: "Donations to Accellera",
    detail: "Superlog ESS and DAS (Co-Design, Real Intent); OpenVera testbench and assertions, C/C++ interface, coverage API (Synopsys)",
    arrow: "became",
  },
  { label: "Accellera SystemVerilog 3.0, 3.1, 3.1a", detail: "2002 to 2004", arrow: "standardized as" },
  { label: "IEEE 1800-2005", detail: "extensions only, relying on IEEE 1364-2005", arrow: "merged with 1364-2005 into" },
  { label: "IEEE 1800-2009, 2012, 2017, 2023", detail: "one self-contained SystemVerilog standard" },
];

const UVM_LINEAGE: LineageStep[] = [
  { label: "AVM (Mentor) and URM (Cadence)", detail: "with concepts from e's eRM", arrow: "combined into" },
  { label: "OVM", detail: "2008, Cadence and Mentor, Apache 2.0", arrow: "plus VMM concepts and code, became" },
  { label: "Accellera UVM 1.0, 1.1, 1.2", detail: "2011 to 2014", arrow: "standardized as" },
  { label: "IEEE 1800.2-2017, 1800.2-2020", detail: "the UVM Language Reference Manual", arrow: "implemented by" },
  { label: "Accellera uvm-core 2020.x", detail: "the open-source library for IEEE 1800.2" },
];

function LineageColumn({ title, steps, tone }: { title: string; steps: LineageStep[]; tone: HistoryLane }) {
  return (
    <div className="min-w-0">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <ol className="mt-2 space-y-0">
        {steps.map((step) => (
          <li key={step.label}>
            <div className={cn("rounded-lg border px-3 py-2", laneChip[tone])}>
              <p className="text-sm font-semibold">{step.label}</p>
              <p className="text-xs opacity-90">{step.detail}</p>
            </div>
            {step.arrow ? (
              <p className="flex items-center gap-1.5 py-1.5 pl-4 text-xs text-muted-foreground">
                <span aria-hidden className="text-base leading-none">
                  ↓
                </span>
                <span>{step.arrow}</span>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function HistoryLineage() {
  return (
    <VisualFrame
      label="Where SystemVerilog and UVM came from"
      eyebrow="Mental picture"
      title="Two family trees"
      summary="SystemVerilog grew out of Verilog plus donated languages; UVM grew out of vendor methodologies. Read each column top to bottom."
      fidelity="illustration"
      assumptions={[
        "The UVM column follows the genealogy in the IEEE 1800.2-2020 introduction: OVM combined AVM with URM and eRM concepts, and UVM added VMM concepts and code.",
        "The SystemVerilog column follows the donations named in the Accellera and Synopsys announcements and the IEEE 1800-2023 introduction.",
      ]}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-6" data-testid="history-lineage">
        <LineageColumn title="The language: SystemVerilog" steps={SV_LINEAGE} tone="language" />
        <LineageColumn title="The methodology: UVM" steps={UVM_LINEAGE} tone="methodology" />
      </div>
    </VisualFrame>
  );
}

export default HistoryTimeline;
