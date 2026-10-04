"use client";

import React from "react";

import { BlockDiagram } from "@/components/visual-system/BlockDiagram";
import { CycleWaveform, type CycleHighlight, type CycleMarker, type CycleSignal } from "@/components/visual-system/CycleWaveform";
import { layoutGridDiagram, type GridEdge, type GridNode, type GridPort, type SequenceMessage, type SequenceParticipant } from "@/components/visual-system/diagram-layout";
import { DiagramProblems, SequenceDiagram as SequenceDiagramView } from "@/components/visual-system/SequenceDiagram";
import { cn } from "@/lib/utils";

/**
 * MDX diagram kit. Lesson authors describe a diagram as data and the kit draws
 * it consistently (theme-safe, accessible, readable at 390 px):
 *
 * - <ArchitectureDiagram>: components, containers, TLM ports and connections on a grid.
 * - <TimingDiagram>: cycle-based waveforms; values[k] is the value sampled at rising edge k.
 * - <SequenceDiagram>: who calls whom, in order (calls, returns, async sends, notes).
 *
 * Every diagram needs a `title` (its accessible name) and a visible `caption`
 * that tells the learner what to look at. Data errors are shown on the page,
 * never drawn silently.
 */

function Caption({ children }: { children: React.ReactNode }) {
  return <figcaption className="mt-2 text-sm text-muted-foreground">{children}</figcaption>;
}

interface ArchitectureDiagramProps {
  title: string;
  caption: React.ReactNode;
  nodes: GridNode[];
  ports?: GridPort[];
  edges?: GridEdge[];
  cellWidth?: number;
  cellHeight?: number;
  gapX?: number;
  gapY?: number;
  /** Show the port and line legend (default true when ports or edges exist). */
  legend?: boolean;
  className?: string;
}

export function ArchitectureDiagram({ title, caption, nodes, ports, edges, cellWidth, cellHeight, gapX, gapY, legend, className }: ArchitectureDiagramProps) {
  const layout = layoutGridDiagram({ nodes, ports, edges, cellWidth, cellHeight, gapX, gapY });
  const showLegend = legend ?? Boolean((ports && ports.length) || (edges && edges.length));
  return (
    <figure className={cn("not-prose my-6", className)} data-diagram="architecture">
      <BlockDiagram
        title={title}
        width={layout.width}
        height={layout.height}
        nodes={layout.nodes}
        ports={layout.ports}
        edges={layout.edges}
        minWidth={Math.min(layout.width, 360)}
        showLegend={showLegend}
      />
      {layout.problems.length ? <DiagramProblems problems={layout.problems} /> : null}
      <Caption>{caption}</Caption>
    </figure>
  );
}

interface TimingDiagramProps {
  title: string;
  caption: React.ReactNode;
  /** Number of rising clock edges drawn (columns). */
  edges: number;
  signals: CycleSignal[];
  markers?: CycleMarker[];
  highlights?: CycleHighlight[];
  cycleWidth?: number;
  className?: string;
}

export function TimingDiagram({ title, caption, edges, signals, markers, highlights, cycleWidth, className }: TimingDiagramProps) {
  const problems: string[] = [];
  for (const s of signals) {
    if (s.kind !== "clock" && s.values && s.values.length > edges) {
      problems.push(`Signal "${s.name}" has ${s.values.length} values but the diagram has ${edges} edges.`);
    }
  }
  for (const m of markers ?? []) {
    if (m.edge < 0 || m.edge >= edges) problems.push(`Marker "${m.label}" is at edge ${m.edge}, outside 0..${edges - 1}.`);
  }
  const captionText = typeof caption === "string" ? caption : title;
  return (
    <figure className={cn("not-prose my-6", className)} data-diagram="timing">
      <CycleWaveform
        title={title}
        caption={captionText}
        edges={edges}
        signals={signals.map((s) => ({ ...s, editable: false }))}
        markers={markers}
        highlights={highlights}
        cycleWidth={cycleWidth}
      />
      {problems.length ? <DiagramProblems problems={problems} /> : null}
      {typeof caption === "string" ? null : <Caption>{caption}</Caption>}
    </figure>
  );
}

interface SequenceDiagramProps {
  title: string;
  caption: React.ReactNode;
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
  numbered?: boolean;
  columnWidth?: number;
  className?: string;
}

export function SequenceDiagram({ title, caption, participants, messages, numbered, columnWidth, className }: SequenceDiagramProps) {
  return (
    <figure className={cn("not-prose my-6", className)} data-diagram="sequence">
      <SequenceDiagramView title={title} participants={participants} messages={messages} numbered={numbered} columnWidth={columnWidth} />
      <Caption>{caption}</Caption>
    </figure>
  );
}
