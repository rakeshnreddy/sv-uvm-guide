/**
 * WaveDrom skin for the code surface.
 *
 * WaveDrom's default skin draws black strokes, blue (#0041c4) signal names
 * and pastel data lanes for a white page. Timing diagrams sit on the code
 * surface (--code-surface, 226 40% 5%), which is dark in both site modes
 * (DESIGN.md section 3), so the skin is restyled for that surface through CSS
 * scoped to the wrapper that carries WAVEDROM_SURFACE_ATTR. Every text colour
 * is at least 4.5:1 and every stroke at least 3:1 against the surface it sits
 * on (tests/lib/wavedrom-surface.test.ts measures them).
 *
 * Signal strokes, hatching and data-lane fills are drawn through <use>
 * references to the skin's <defs>. Elements in a <use> shadow tree do not match
 * selectors that name their ancestors, so a scoped rule cannot reach them.
 * Custom properties do inherit into the shadow tree from the <use> element, so
 * the wrapper sets --wd-* variables and unscoped two-class rules read them, with
 * WaveDrom's own colour as the fallback: outside the wrapper nothing changes.
 *
 * Text, the tick grid, edge arrows and edge-label backgrounds are real children
 * of the SVG, so those rules are scoped to the wrapper; the last three carry
 * inline styles and use !important.
 */

export const WAVEDROM_SURFACE_ATTR = 'data-wavedrom-surface';

export const WAVEDROM_PALETTE = {
  /** hsl(226 40% 5%), the --code-surface role. */
  surface: '#080a12',
  /** Signal names, data values and headings: the pre-code text colour. */
  text: '#e6e9ef',
  /** Tick numbers and other muted text. */
  muted: '#9aa3b5',
  /** Signal strokes (0, 1, clocks, lane outlines). */
  stroke: '#cbd5e1',
  /** The 0.5 px hatching of x and the thin strokes. */
  hatch: '#8b95a8',
  /** The dashed tick grid. */
  grid: '#5f6b80',
  /** Edges and arrows: the dark-mode accent, hsl(197 85% 59%). */
  edge: '#3ebdef',
  warning: '#f6b900',
  error: '#ff6b6b',
  success: '#4ade80',
  /** Data lanes by WaveDrom class: '=' and '2' are s7, '3' to '9' are s8 to s14. */
  lanes: {
    s7: '#222835',
    s8: '#433714',
    s9: '#472a15',
    s10: '#17314f',
    s11: '#123b3f',
    s12: '#183923',
    s13: '#42244c',
    s14: '#511f23',
  },
} as const;

const scope = `[${WAVEDROM_SURFACE_ATTR}] svg`;

/** WaveDrom's default skin colours, used as the fallbacks outside the wrapper. */
const DEFAULT_SKIN = {
  stroke: '#000',
  surface: '#fff',
  edge: '#0041c4',
  lanes: {
    s7: '#fff',
    s8: '#ffffb4',
    s9: '#ffe0b9',
    s10: '#b9e0ff',
    s11: '#ccfdfe',
    s12: '#cdfdc5',
    s13: '#f0c1fb',
    s14: '#f5c2c0',
  },
} as const;

/** The stylesheet. Kept free of '>' and quotes so it can be inlined as-is. */
export function wavedromSurfaceCss(palette = WAVEDROM_PALETTE): string {
  const laneVars = Object.entries(palette.lanes)
    .map(([cls, fill]) => `--wd-${cls}:${fill};`)
    .join('');
  const laneRules = Object.keys(palette.lanes)
    .map((cls) => `path.${cls}.${cls}{fill:var(--wd-${cls},${DEFAULT_SKIN.lanes[cls as keyof typeof DEFAULT_SKIN.lanes]})}`)
    .join('');
  return [
    // Variables on the wrapper, inherited by every <use> instance inside it.
    `[${WAVEDROM_SURFACE_ATTR}]{--wd-stroke:${palette.stroke};--wd-hatch:${palette.hatch};--wd-surface:${palette.surface};--wd-edge:${palette.edge};${laneVars}}`,
    // Shadow-tree shapes: two-class selectors beat the skin's single-class rules.
    `path.s1.s1,path.s3.s3,path.s4.s4{stroke:var(--wd-stroke,${DEFAULT_SKIN.stroke})}`,
    `path.s2.s2{stroke:var(--wd-hatch,${DEFAULT_SKIN.stroke})}`,
    `path.s5.s5{fill:var(--wd-surface,${DEFAULT_SKIN.surface})}`,
    `path.s6.s6{fill:var(--wd-stroke,${DEFAULT_SKIN.stroke})}`,
    laneRules,
    `path.s15.s15{fill:var(--wd-edge,${DEFAULT_SKIN.edge})}`,
    `path.s16.s16{stroke:var(--wd-edge,${DEFAULT_SKIN.edge})}`,
    // Real children of the SVG, scoped to the wrapper.
    `${scope} text{fill:${palette.text}}`,
    `${scope} text.info,${scope} .info{fill:${palette.text}}`,
    `${scope} .muted,${scope} .muted text{fill:${palette.muted}}`,
    `${scope} .warning{fill:${palette.warning}}`,
    `${scope} .error{fill:${palette.error}}`,
    `${scope} .success{fill:${palette.success}}`,
    `${scope} marker{fill:${palette.edge} !important}`,
    `${scope} path[style*=stroke\\:\\#0041c4]{stroke:${palette.edge} !important}`,
    `${scope} rect[style*=fill\\:white]{fill:${palette.surface} !important}`,
    `${scope} g[style*=stroke\\:\\#888]{stroke:${palette.grid} !important}`,
    printCss(),
  ].join('');
}

/** Light skin for print, where globals.css turns the code surface light. */
export const WAVEDROM_PRINT_PALETTE = {
  text: '#000000',
  muted: '#444444',
  grid: '#888888',
  warning: '#7a5900',
  error: '#b3261e',
  success: '#1a7f37',
} as const;

/**
 * Print resets the wrapper's variables to WaveDrom's own light skin and puts
 * text, the background rect, the grid and the edge markers back to dark on
 * white, so a printed lesson shows the diagram on a light background.
 */
function printCss(): string {
  const laneVars = Object.entries(DEFAULT_SKIN.lanes)
    .map(([cls, fill]) => `--wd-${cls}:${fill};`)
    .join('');
  const p = WAVEDROM_PRINT_PALETTE;
  return [
    '@media print{',
    `[${WAVEDROM_SURFACE_ATTR}]{--wd-stroke:${DEFAULT_SKIN.stroke};--wd-hatch:${DEFAULT_SKIN.stroke};--wd-surface:${DEFAULT_SKIN.surface};--wd-edge:${DEFAULT_SKIN.edge};${laneVars}}`,
    `${scope} text,${scope} text.info,${scope} .info{fill:${p.text}}`,
    `${scope} .muted,${scope} .muted text{fill:${p.muted}}`,
    `${scope} .warning{fill:${p.warning}}`,
    `${scope} .error{fill:${p.error}}`,
    `${scope} .success{fill:${p.success}}`,
    `${scope} marker{fill:${DEFAULT_SKIN.edge} !important}`,
    `${scope} path[style*=stroke\\:\\#0041c4]{stroke:${DEFAULT_SKIN.edge} !important}`,
    `${scope} rect[style*=fill\\:white]{fill:${DEFAULT_SKIN.surface} !important}`,
    `${scope} g[style*=stroke\\:\\#888]{stroke:${p.grid} !important}`,
    '}',
  ].join('');
}
