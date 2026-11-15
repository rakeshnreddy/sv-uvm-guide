import React from "react";

import { cn } from "@/lib/utils";

/**
 * Depth for the diagram kit (DESIGN.md section 14): parts drawn as lit objects
 * on a glass panel. Everything this file draws is decoration. It carries the
 * class `fig-fx`, so forced colours drop it and the part's own outline, fill
 * class, label and tag (section 13) carry the meaning alone; print drops the
 * blurred layers (`fig-fx-blur`). The strength of each layer comes from the
 * tokens in globals.css, scaled by the calm or rich setting on the page root
 * (`data-fig-style`). Class names are written out in full so Tailwind finds
 * them.
 */

/** A hue an object can be filled with: a figure hue, or "tier" for a part with no role. */
export type DepthHue = "slate" | "cyan" | "rose" | "amber" | "violet" | "indigo" | "teal" | "emerald" | "tier";

/** Sets `color` to the hue's deep body colour; the gradient stops read it as currentColor. */
const bodyInk: Record<DepthHue, string> = {
  slate: "text-fig-slate-body",
  cyan: "text-fig-cyan-body",
  rose: "text-fig-rose-body",
  amber: "text-fig-amber-body",
  violet: "text-fig-violet-body",
  indigo: "text-fig-indigo-body",
  teal: "text-fig-teal-body",
  emerald: "text-fig-emerald-body",
  // Clear glass with a little of the tier in it (fig-grad-quiet sets the colour and the lower strength).
  tier: "fig-grad-quiet",
};

/** The hue's line colour as a fill, for a glow under the focal or active part. */
export const glowFill: Record<DepthHue, string> = {
  slate: "fill-fig-slate",
  cyan: "fill-fig-cyan",
  rose: "fill-fig-rose",
  amber: "fill-fig-amber",
  violet: "fill-fig-violet",
  indigo: "fill-fig-indigo",
  teal: "fill-fig-teal",
  emerald: "fill-fig-emerald",
  tier: "fill-fig-generic",
};

/** The hue's line colour as `color`, for a lifeline rail (`fig-rail` fills with currentColor). */
export const railInk: Record<DepthHue, string> = {
  slate: "text-fig-slate",
  cyan: "text-fig-cyan",
  rose: "text-fig-rose",
  amber: "text-fig-amber",
  violet: "text-fig-violet",
  indigo: "text-fig-indigo",
  teal: "text-fig-teal",
  emerald: "text-fig-emerald",
  tier: "text-fig-generic",
};

/** Paint references into the defs that <FigureDepthDefs id> draws. */
export const depthFill = (id: string, hue: DepthHue) => `url(#${id}-obj-${hue})`;
export const rimStroke = (id: string) => `url(#${id}-rim)`;
export const levelFill = (id: string) => `url(#${id}-level)`;
export const shadowFilter = (id: string) => `url(#${id}-shadow)`;
export const glowFilter = (id: string) => `url(#${id}-glow)`;

/**
 * The gradients and filters one drawing needs: an object gradient per hue in
 * use (lighter at the top), the lit top rim, the fill under a high one-bit
 * level, and the two blurs (one pass each for all shadows and all glows, so a
 * figure costs two filter passes however many parts it has).
 */
export function FigureDepthDefs({ id, hues, width, height, level = false }: { id: string; hues: DepthHue[]; width: number; height: number; level?: boolean }) {
  const region = { filterUnits: "userSpaceOnUse" as const, x: -32, y: -32, width: width + 64, height: height + 64 };
  return (
    <>
      {[...new Set(hues)].map((hue) => (
        <linearGradient key={hue} id={`${id}-obj-${hue}`} x1="0" y1="0" x2="0" y2="1" className={bodyInk[hue]}>
          <stop offset="0" className="fig-stop-top" />
          <stop offset="1" className="fig-stop-bottom" />
        </linearGradient>
      ))}
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" className="fig-rim-top" />
        <stop offset="0.6" className="fig-rim-end" />
      </linearGradient>
      {level ? (
        <linearGradient id={`${id}-level`} x1="0" y1="0" x2="0" y2="1" className="text-fig-cyan">
          <stop offset="0" className="fig-stop-level" />
          <stop offset="1" className="fig-stop-none" />
        </linearGradient>
      ) : null}
      <filter id={`${id}-shadow`} {...region}>
        <feGaussianBlur stdDeviation="3.5" />
      </filter>
      <filter id={`${id}-glow`} {...region}>
        <feGaussianBlur stdDeviation="7" />
      </filter>
    </>
  );
}

/**
 * The object under a part: an opaque card base (so the shadow never shows
 * through a translucent fill) and the gradient in the part's hue. Drawn before
 * the part's own group, whose soft fill and outline go on top.
 */
export function ObjectBody({ id, hue, x, y, w, h, rx }: { id: string; hue: DepthHue; x: number; y: number; w: number; h: number; rx: number }) {
  return (
    <g aria-hidden className="fig-fx">
      <rect x={x} y={y} width={w} height={h} rx={rx} className="fill-card" stroke="none" />
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={depthFill(id, hue)} stroke="none" />
    </g>
  );
}

/** The lit top rim of an object: a 1 px line just inside its outline, bright at the top edge and gone by the middle. */
export function ObjectRim({ id, x, y, w, h, rx }: { id: string; x: number; y: number; w: number; h: number; rx: number }) {
  return (
    <rect
      aria-hidden
      x={x + 1.25}
      y={y + 1.25}
      width={w - 2.5}
      height={h - 2.5}
      rx={Math.max(0, rx - 1.25)}
      fill="none"
      stroke={rimStroke(id)}
      strokeWidth={1}
      className="fig-fx pointer-events-none"
    />
  );
}

/** One shape in the blurred shadow layer: `rise` is how far the part sits above the panel (3 at rest, 7 when raised). */
export function ObjectShadow({ x, y, w, h, rx, rise = 3 }: { x: number; y: number; w: number; h: number; rx: number; rise?: number }) {
  return <rect x={x + 1} y={y + rise} width={w - 2} height={h} rx={rx} className="fig-shadow" stroke="none" />;
}

/** One shape in the blurred glow layer, in the hue's line colour. */
export function ObjectGlow({ hue, x, y, w, h, rx, soft = false }: { hue: DepthHue; x: number; y: number; w: number; h: number; rx: number; soft?: boolean }) {
  return <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} rx={rx + 2} className={cn(soft ? "fig-glow-soft" : "fig-glow", glowFill[hue])} stroke="none" />;
}

/** The title strip of a figure panel. Hidden from assistive technology: the drawing already carries the title as its name. */
export function FigureTitleBar({ title }: { title: string }) {
  return (
    <div className="fig-titlebar" aria-hidden="true" data-fig-title>
      <span>{title}</span>
    </div>
  );
}
