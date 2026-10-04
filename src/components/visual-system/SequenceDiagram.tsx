"use client";

import React, { useId } from "react";

import { cn } from "@/lib/utils";

import { nodeKindTags } from "./BlockDiagram";
import { layoutSequence, type SequenceMessage, type SequenceParticipant } from "./diagram-layout";

interface SequenceDiagramProps {
  title: string;
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
  /** Number calls, async sends and returns (default true). */
  numbered?: boolean;
  columnWidth?: number;
  className?: string;
}

const toneStroke = {
  normal: "stroke-foreground/70",
  active: "stroke-cyan-600 dark:stroke-cyan-400",
  error: "stroke-rose-600 dark:stroke-rose-400",
} as const;

const toneFill = {
  normal: "fill-foreground/70",
  active: "fill-cyan-600 dark:fill-cyan-400",
  error: "fill-rose-600 dark:fill-rose-400",
} as const;

/**
 * Message-sequence diagram: who calls whom, in what order. Calls are solid
 * with a filled head, returns are dashed, asynchronous sends (no wait) use an
 * open head, and self-calls loop back. A numbered text version of every step
 * sits under the drawing for screen readers and for anyone who prefers text.
 */
export function SequenceDiagram({ title, participants, messages, numbered = true, columnWidth, className }: SequenceDiagramProps) {
  const id = useId();
  const layout = layoutSequence({ participants, messages, columnWidth });
  const { width, height, headerHeight, lifelineX } = layout;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/40 p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: Math.min(width, Math.max(320, participants.length * 120)) }}
          className="block h-auto w-full"
          role="img"
          aria-labelledby={`${id}-title`}
        >
          <title id={`${id}-title`}>{title}</title>
          <defs>
            <marker id={`${id}-filled`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" className="fill-foreground/70" />
            </marker>
            <marker id={`${id}-open`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1,1 L9,5 L1,9" fill="none" className="stroke-foreground/70" strokeWidth="1.6" />
            </marker>
          </defs>

          {participants.map((p) => {
            const x = lifelineX[p.id];
            const tag = p.kind ? nodeKindTags[p.kind] : "";
            return (
              <g key={p.id}>
                <line x1={x} x2={x} y1={headerHeight} y2={height - 8} className="stroke-border" strokeDasharray="4 4" strokeWidth={1.2} />
                <rect x={x - 65} y={6} width={130} height={headerHeight - 10} rx={8} className="fill-card stroke-border" strokeWidth={1.2} />
                {tag ? (
                  <text x={x - 58} y={18} className="fill-muted-foreground text-[8.5px] font-bold tracking-wider">
                    {tag}
                  </text>
                ) : null}
                <text x={x} y={p.sublabel ? 27 : 31} textAnchor="middle" className="fill-foreground font-mono text-[11px] font-semibold [font-variant-ligatures:none]">
                  {p.label}
                </text>
                {p.sublabel ? (
                  <text x={x} y={39} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                    {p.sublabel}
                  </text>
                ) : null}
              </g>
            );
          })}

          {layout.messages.map((m) => {
            if (m.kind === "divider") {
              const w = Math.max(80, m.label.length * 6 + 20);
              return (
                <g key={m.index}>
                  <line x1={8} x2={width - 8} y1={m.y + 9} y2={m.y + 9} className="stroke-border" strokeDasharray="2 4" strokeWidth={1.2} />
                  <rect x={width / 2 - w / 2} y={m.y} width={w} height={18} rx={9} className="fill-muted stroke-border" strokeWidth={1} />
                  <text x={width / 2} y={m.y + 13} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px] [font-variant-ligatures:none]">
                    {m.label}
                  </text>
                </g>
              );
            }
            if (m.kind === "note") {
              return (
                <g key={m.index}>
                  <rect x={m.x1} y={m.y} width={m.x2 - m.x1} height={m.height} rx={4} className="fill-amber-500/10 stroke-amber-600/60 dark:stroke-amber-400/60" strokeWidth={1} />
                  {m.lines.map((line, k) => (
                    <text key={k} x={m.x1 + 8} y={m.y + 16 + k * 14} className="fill-foreground text-[10.5px]">
                      {line}
                    </text>
                  ))}
                </g>
              );
            }
            const stroke = toneStroke[m.tone];
            const prefix = numbered && m.step !== null ? `${m.step}. ` : "";
            if (m.kind === "self") {
              const x = m.x1;
              return (
                <g key={m.index}>
                  <path
                    d={`M${x},${m.y + 4} H${x + 34} V${m.y + 24} H${x + 6}`}
                    fill="none"
                    className={stroke}
                    strokeWidth={1.6}
                    markerEnd={`url(#${id}-filled)`}
                  />
                  {m.lines.map((line, k) => (
                    <text key={k} x={x + 42} y={m.y + 12 + k * 14} className={cn("font-mono text-[10.5px] [font-variant-ligatures:none]", m.tone === "normal" ? "fill-foreground" : toneFill[m.tone])}>
                      {k === 0 ? prefix : ""}
                      {line}
                    </text>
                  ))}
                </g>
              );
            }
            const dir = m.x2 >= m.x1 ? 1 : -1;
            const isReturn = m.kind === "return";
            const marker = m.kind === "call" ? "filled" : "open";
            const mid = (m.x1 + m.x2) / 2;
            return (
              <g key={m.index}>
                <line
                  x1={m.x1}
                  x2={m.x2 - dir * 2}
                  y1={m.y}
                  y2={m.y}
                  className={stroke}
                  strokeWidth={1.6}
                  strokeDasharray={isReturn ? "5 4" : undefined}
                  markerEnd={`url(#${id}-${marker})`}
                />
                {m.lines.map((line, k) => (
                  <text
                    key={k}
                    x={mid}
                    y={m.y - 8 - (m.lines.length - 1 - k) * 14}
                    textAnchor="middle"
                    className={cn("font-mono text-[10.5px] [font-variant-ligatures:none]", m.tone === "normal" ? "fill-foreground" : toneFill[m.tone])}
                  >
                    {k === 0 ? prefix : ""}
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <details className="rounded-lg border border-border/70 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">Steps as text</summary>
        <ol className="mt-2 list-none space-y-1 font-mono text-xs text-foreground [font-variant-ligatures:none]">
          {layout.messages.map((m) => (
            <li key={m.index} className={m.kind === "note" || m.kind === "divider" ? "text-muted-foreground" : undefined}>
              {m.text}
            </li>
          ))}
        </ol>
      </details>
      {layout.problems.length ? <DiagramProblems problems={layout.problems} /> : null}
    </div>
  );
}

/** Visible notice for diagram data errors, so a wrong diagram is never shown silently. */
export function DiagramProblems({ problems }: { problems: string[] }) {
  return (
    <div role="alert" data-testid="diagram-data-error" className="rounded-md border border-amber-500/60 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-100">
      <p className="font-semibold">Diagram data error</p>
      <ul className="list-disc pl-5">
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
