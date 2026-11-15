"use client";

import React, { useId } from "react";

import { cn } from "@/lib/utils";

import { DiagramLegend, DiagramScrollFrame, nodeKindTags, roleKeyEntries } from "./BlockDiagram";
import { layoutSequence, PHONE_FIT_WIDTH, SEQ_CHAR_W, SEQ_SELF_TEXT_DX, type SequenceMessage, type SequenceParticipant } from "./diagram-layout";
import { assignedRoleWords, effectiveRole, roleStyles, tagChipWidth } from "./figure-colours";

interface SequenceDiagramProps {
  title: string;
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
  /** Number calls, async sends and returns (default true). */
  numbered?: boolean;
  columnWidth?: number;
  /**
   * Draw the role terms under the drawing when some participant takes its
   * colour from a `role` (no tag says it), so that colour can be looked up
   * (roleKeyEntries). The MDX kit sets it.
   */
  showRoleKey?: boolean;
  className?: string;
}

type Tone = "normal" | "active" | "error";

const toneStroke: Record<Tone, string> = {
  normal: "stroke-foreground/75",
  active: "stroke-fig-cyan",
  error: "stroke-fig-rose",
};

const toneMarker: Record<Tone, string> = {
  normal: "fill-foreground/75",
  active: "fill-fig-cyan",
  error: "fill-fig-rose",
};

const toneText: Record<Tone, string> = {
  normal: "fill-foreground",
  active: "fill-fig-cyan-text",
  error: "fill-fig-rose-text",
};

/** Step badge: a filled pill behind the step number; the digits take the page colour. */
const toneBadge: Record<Tone, string> = {
  normal: "fill-foreground/80",
  active: "fill-fig-cyan-text",
  error: "fill-fig-rose-text",
};

/** Notes: a neutral raised surface with a 3 px accent edge; an error or active note takes rose or cyan. */
const noteStyle: Record<Tone, { box: string; edge: string }> = {
  normal: { box: "fill-muted stroke-border", edge: "fill-tier-current" },
  active: { box: "fill-fig-cyan-fill stroke-fig-cyan/50", edge: "fill-fig-cyan" },
  error: { box: "fill-fig-rose-fill stroke-fig-rose/50", edge: "fill-fig-rose" },
};

/**
 * The first line of a numbered message, with its "N. " prefix kept in the text
 * (so the text reads exactly as before) and the number drawn on a filled badge:
 * the digits take the page colour and the ". " is transparent. Message text is
 * 10.5 px mono, SEQ_CHAR_W per character, which places the badge.
 */
function StepBadge({ step, startX, baseline, tone }: { step: number; startX: number; baseline: number; tone: Tone }) {
  const digits = String(step).length;
  const w = Math.max(14, digits * SEQ_CHAR_W + 7);
  const cx = startX + (digits * SEQ_CHAR_W) / 2;
  return <rect x={cx - w / 2} y={baseline - 11} width={w} height={14} rx={7} className={toneBadge[tone]} />;
}

function PrefixedLine({ prefix, line }: { prefix: string; line: string }) {
  if (!prefix) return <>{line}</>;
  const number = prefix.replace(/\. $/, "");
  return (
    <>
      <tspan className="fill-background font-semibold">{number}</tspan>
      <tspan fillOpacity={0}>{prefix.slice(number.length)}</tspan>
      {line}
    </>
  );
}

/**
 * Message-sequence diagram: who calls whom, in what order. Calls are solid
 * with a filled head, returns are dashed, asynchronous sends (no wait) use an
 * open head, and self-calls loop back. A numbered text version of every step
 * sits under the drawing for screen readers and for anyone who prefers text.
 */
export function SequenceDiagram({ title, participants, messages, numbered = true, columnWidth, showRoleKey = false, className }: SequenceDiagramProps) {
  const id = useId();
  const layout = layoutSequence({ participants, messages, columnWidth, numbered });
  const { width, height, headerHeight, lifelineX } = layout;
  // Phone floor for the lifeline columns; extra width for self-message text keeps the same scale and scrolls.
  const minWidth = Math.round((Math.min(layout.columnsWidth, Math.max(320, participants.length * 120)) * width) / layout.columnsWidth);
  // Roles given without a tag are said in words in the description, so colour is never the only cue.
  const saidRoles = participants
    .map((p) => {
      const words = assignedRoleWords(p.kind, p.role);
      return words ? `${p.label} (${words})` : null;
    })
    .filter((x): x is string => x !== null);
  const roleDescription = saidRoles.length ? `Roles: ${saidRoles.join("; ")}.` : null;
  const roleKey = showRoleKey ? roleKeyEntries(participants.map((p) => ({ kind: p.kind ?? "generic", role: p.role }))) : [];

  return (
    <div className={cn("space-y-2", className)} data-figure-kit="sequence">
      <DiagramScrollFrame label={title} initiallyScrolls={minWidth > PHONE_FIT_WIDTH} className="glass-liquid p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth }}
          className="block h-auto w-full"
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={roleDescription ? `${id}-desc` : undefined}
        >
          <title id={`${id}-title`}>{title}</title>
          {roleDescription ? <desc id={`${id}-desc`}>{roleDescription}</desc> : null}
          <defs>
            {(["normal", "active", "error"] as const).map((tone) => (
              <React.Fragment key={tone}>
                <marker id={`${id}-filled-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 Z" className={cn("fig-solid", toneMarker[tone])} />
                </marker>
                <marker id={`${id}-open-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M1,1 L9,5 L1,9" fill="none" className={toneStroke[tone]} strokeWidth="1.6" />
                </marker>
              </React.Fragment>
            ))}
          </defs>

          {participants.map((p) => {
            const x = lifelineX[p.id];
            const tag = p.kind ? nodeKindTags[p.kind] : "";
            const participantRole = effectiveRole(p.kind, p.role);
            const look = roleStyles[participantRole];
            return (
              <g key={p.id} data-fig-role={participantRole}>
                <line x1={x} x2={x} y1={headerHeight} y2={height - 8} className={look.lifeline} strokeDasharray="4 4" strokeWidth={1.5} />
                <rect x={x - 65} y={6} width={130} height={headerHeight - 10} rx={Math.min(look.radius, 12)} className={cn("fill-card", "stroke-none")} />
                <rect x={x - 65} y={6} width={130} height={headerHeight - 10} rx={Math.min(look.radius, 12)} className={look.box} strokeWidth={1.5} />
                {tag ? (
                  <>
                    <rect x={x - 61} y={9} width={tagChipWidth(tag, 8.5)} height={12} rx={3} className={look.chip} />
                    <text x={x - 58} y={18} className={cn("font-mono text-[8.5px] font-semibold [font-variant-ligatures:none]", look.tagText)}>
                      {tag}
                    </text>
                  </>
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
              const note = noteStyle[m.tone];
              return (
                <g key={m.index}>
                  <rect x={m.x1} y={m.y} width={m.x2 - m.x1} height={m.height} rx={4} className="fill-card" />
                  <rect x={m.x1} y={m.y} width={m.x2 - m.x1} height={m.height} rx={4} className={note.box} strokeWidth={1} />
                  <rect x={m.x1} y={m.y} width={3} height={m.height} rx={1.5} className={note.edge} />
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
            const textClass = cn("font-mono text-[10.5px] [font-variant-ligatures:none]", toneText[m.tone]);
            if (m.kind === "self") {
              const x = m.x1;
              return (
                <g key={m.index}>
                  <path
                    d={`M${x},${m.y + 4} H${x + 34} V${m.y + 24} H${x + 6}`}
                    fill="none"
                    className={stroke}
                    strokeWidth={1.6}
                    markerEnd={`url(#${id}-filled-${m.tone})`}
                  />
                  {prefix && m.step !== null ? <StepBadge step={m.step} startX={x + SEQ_SELF_TEXT_DX} baseline={m.y + 12} tone={m.tone} /> : null}
                  {m.lines.map((line, k) => (
                    <text key={k} x={x + SEQ_SELF_TEXT_DX} y={m.y + 12 + k * 14} className={textClass}>
                      <PrefixedLine prefix={k === 0 ? prefix : ""} line={line} />
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
                  markerEnd={`url(#${id}-${marker}-${m.tone})`}
                />
                {prefix && m.step !== null ? (
                  <StepBadge
                    step={m.step}
                    startX={mid - ((prefix.length + m.lines[0].length) * SEQ_CHAR_W) / 2}
                    baseline={m.y - 8 - (m.lines.length - 1) * 14}
                    tone={m.tone}
                  />
                ) : null}
                {m.lines.map((line, k) => (
                  <text key={k} x={mid} y={m.y - 8 - (m.lines.length - 1 - k) * 14} textAnchor="middle" className={textClass}>
                    <PrefixedLine prefix={k === 0 ? prefix : ""} line={line} />
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </DiagramScrollFrame>
      <DiagramLegend entries={roleKey} as="div" />
      <details className="rounded-lg border border-border px-3 text-sm [&[open]]:pb-2">
        <summary className="min-h-10 cursor-pointer py-2.5 font-medium text-foreground">Steps as text</summary>
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

/**
 * Whether geometry warnings are drawn on the page. They are for authors, so
 * they show in development and tests but not in production builds (where data
 * errors still show).
 */
export const SHOW_LAYOUT_WARNINGS = process.env.NODE_ENV !== "production";

/**
 * Visible notice for diagram problems, so a wrong diagram is never shown
 * silently. `variant="layout"` is the author-facing geometry warning
 * (label collisions); the default is the data-error alert.
 */
export function DiagramProblems({ problems, variant = "error" }: { problems: string[]; variant?: "error" | "layout" }) {
  if (variant === "layout") {
    return (
      <div role="note" data-testid="diagram-layout-warning" className="mt-2 rounded-md border border-dashed border-amber-500/60 bg-amber-500/5 p-2 text-xs text-amber-900 dark:text-amber-100">
        <p className="font-semibold">Diagram layout warning (shown outside production)</p>
        <ul className="list-disc pl-5">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    );
  }
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
