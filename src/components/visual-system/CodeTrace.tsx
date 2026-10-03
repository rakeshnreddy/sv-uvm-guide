"use client";

import React from "react";

import { cn } from "@/lib/utils";

import { ownerStyles, type OwnerKind } from "./visual-language";

export interface CodeTraceLine {
  text: string;
  /** Owner tag shown in the gutter (DUT / TB). */
  owner?: OwnerKind;
  /** Stable key used for highlighting and line controls. */
  key?: string;
}

interface CodeTraceProps {
  lines: CodeTraceLine[];
  /** Key of the line executing at the current step. */
  activeKey?: string;
  /** Keys of lines belonging to the currently running process. */
  contextKeys?: string[];
  /** Optional per-line control rendered at the end of the line (e.g. an operator toggle). */
  renderLineControl?: (line: CodeTraceLine) => React.ReactNode;
  label: string;
  className?: string;
}

/**
 * Code panel synchronised with a model trace. Ligatures are disabled so
 * `<=`, `==` and `!==` read exactly as typed.
 */
export function CodeTrace({ lines, activeKey, contextKeys = [], renderLineControl, label, className }: CodeTraceProps) {
  return (
    <figure className={cn("overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100", className)}>
      <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </figcaption>
      <ol className="overflow-x-auto py-2 font-mono text-[12px] leading-6 [font-variant-ligatures:none] sm:text-[13px]" aria-label={label}>
        {lines.map((line, i) => {
          const isActive = Boolean(activeKey) && line.key === activeKey;
          const inContext = Boolean(line.key) && contextKeys.includes(line.key as string);
          const owner = line.owner ? ownerStyles[line.owner] : undefined;
          return (
            <li
              key={`${i}-${line.key ?? "blank"}`}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex min-h-6 flex-wrap items-center gap-x-2 border-l-2 pr-2 transition-colors duration-200 motion-reduce:transition-none",
                isActive
                  ? "border-cyan-400 bg-cyan-400/15"
                  : inContext
                    ? "border-cyan-400/30 bg-white/[0.03]"
                    : "border-transparent",
              )}
            >
              <span className="w-7 shrink-0 select-none text-right text-[11px] text-slate-500" aria-hidden>
                {i + 1}
              </span>
              <span className="w-8 shrink-0" aria-hidden>
                {owner && line.text ? (
                  <span className={cn("inline-block border px-1 text-[9px] font-bold leading-4", owner.className)}>{owner.tag}</span>
                ) : null}
              </span>
              <code className="min-w-0 whitespace-pre-wrap break-words sm:whitespace-pre">
                {isActive ? <span className="sr-only">Executing: </span> : null}
                {line.text || " "}
              </code>
              {renderLineControl ? <span className="ml-auto pl-3 py-0.5">{renderLineControl(line)}</span> : null}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
