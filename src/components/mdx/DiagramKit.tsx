"use client";

import React from "react";

import { BlockDiagram } from "@/components/visual-system/BlockDiagram";
import { CycleWaveform, type CycleHighlight, type CycleMarker, type CycleSignal } from "@/components/visual-system/CycleWaveform";
import {
  layoutGridDiagram,
  nodeKindTags,
  readableMinWidth,
  type GridEdge,
  type GridNode,
  type GridPort,
  type SequenceMessage,
  type SequenceParticipant,
} from "@/components/visual-system/diagram-layout";
import { DiagramProblems, SequenceDiagram as SequenceDiagramView, SHOW_LAYOUT_WARNINGS } from "@/components/visual-system/SequenceDiagram";
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
 * never drawn silently; geometry warnings (labels that hide lines or collide)
 * are shown outside production and checked per lesson by
 * tests/lib/diagram-kit-content.test.ts.
 *
 * On a phone, a wide ArchitectureDiagram keeps at least MIN_RENDER_SCALE and
 * scrolls sideways inside its own (keyboard-focusable) frame instead of
 * shrinking its text to a few pixels.
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
  /**
   * Show the legend of port symbols and line styles (default true when ports or
   * edges exist). It lists only the symbols and styles this diagram draws.
   */
  legend?: boolean;
  /** Spread edges that meet the same side of a node along that side instead of one centre point. */
  spreadAnchors?: boolean;
  className?: string;
}

/** Text equivalent of an architecture diagram, used as the SVG's <desc>. */
function describeArchitecture(nodes: GridNode[], ports: GridPort[] = [], edges: GridEdge[] = []): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const portById = new Map(ports.map((p) => [p.id, p]));
  const tagged = (n: GridNode) => {
    const tag = nodeKindTags[n.kind ?? "generic"];
    return `${tag ? `${tag} ` : ""}${n.label}${n.sublabel ? ` (${n.sublabel})` : ""}`;
  };
  const end = (ref: string) => {
    const port = portById.get(ref);
    if (port) return `${byId.get(port.node)?.label ?? port.node} ${port.label ?? port.id}`;
    return byId.get(ref)?.label ?? ref;
  };
  const within = (n: GridNode, c: GridNode) =>
    n.col >= c.col && n.row >= c.row && n.col + (n.colSpan ?? 1) <= c.col + (c.colSpan ?? 1) && n.row + (n.rowSpan ?? 1) <= c.row + (c.rowSpan ?? 1);
  const leaves = nodes.filter((n) => !n.container);
  const parts = [`Components: ${leaves.map(tagged).join(", ")}.`];
  for (const c of nodes.filter((n) => n.container)) {
    const members = leaves.filter((n) => within(n, c)).map((n) => n.label);
    if (members.length) parts.push(`${c.label} contains ${members.join(", ")}.`);
  }
  if (edges.length) {
    const lines = edges.map((e) => `${end(e.from)} ${e.style === "structural" ? "connects to" : "to"} ${end(e.to)}${e.label ? ` (${e.label})` : ""}`);
    parts.push(`Connections: ${lines.join("; ")}.`);
  }
  return parts.join(" ");
}

export function ArchitectureDiagram({ title, caption, nodes, ports, edges, cellWidth, cellHeight, gapX, gapY, legend, spreadAnchors, className }: ArchitectureDiagramProps) {
  const layout = layoutGridDiagram({ nodes, ports, edges, cellWidth, cellHeight, gapX, gapY, spreadAnchors });
  const showLegend = legend ?? Boolean((ports && ports.length) || (edges && edges.length));
  return (
    <figure className={cn("not-prose my-6", className)} data-diagram="architecture">
      <BlockDiagram
        title={title}
        role="img"
        description={describeArchitecture(nodes, ports, edges)}
        width={layout.width}
        height={layout.height}
        nodes={layout.nodes}
        ports={layout.ports}
        edges={layout.edges}
        spreadAnchors={spreadAnchors}
        minWidth={readableMinWidth(layout.width)}
        showLegend={showLegend}
      />
      {layout.problems.length ? <DiagramProblems problems={layout.problems} /> : null}
      {SHOW_LAYOUT_WARNINGS && layout.warnings.length ? <DiagramProblems variant="layout" problems={layout.warnings.map((w) => w.message)} /> : null}
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
