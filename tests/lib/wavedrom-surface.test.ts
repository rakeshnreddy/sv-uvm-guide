import { describe, expect, it } from "vitest";

import { parseWaveDromSource, renderWaveDromToElement } from "@/lib/wavedrom";
import { WAVEDROM_PALETTE, WAVEDROM_PRINT_PALETTE, WAVEDROM_SURFACE_ATTR, wavedromSurfaceCss } from "@/lib/wavedrom-surface";

const fromHex = (hex: string) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = (hex: string) => {
  const [r, g, b] = fromHex(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("WaveDrom code-surface skin", () => {
  const p = WAVEDROM_PALETTE;

  it("keeps text at 4.5:1 and strokes at 3:1 on the surfaces they sit on", () => {
    const failures: string[] = [];
    const check = (name: string, fg: string, bg: string, min: number) => {
      const ratio = contrast(fg, bg);
      if (ratio < min) failures.push(`${name} ${fg} on ${bg}: ${ratio.toFixed(2)}`);
    };
    for (const [name, fg] of Object.entries({ text: p.text, muted: p.muted, warning: p.warning, error: p.error, success: p.success, edge: p.edge })) {
      check(name, fg, p.surface, 4.5);
    }
    // Data values are drawn on the lane fills.
    for (const [lane, fill] of Object.entries(p.lanes)) check(`text on ${lane}`, p.text, fill, 4.5);
    for (const [name, fg] of Object.entries({ stroke: p.stroke, hatch: p.hatch, grid: p.grid, edge: p.edge })) {
      check(name, fg, p.surface, 3);
    }
    for (const [lane, fill] of Object.entries(p.lanes)) check(`stroke on ${lane}`, p.stroke, fill, 3);
    expect(failures).toEqual([]);
  });

  it("styles every class and inline colour the default skin draws, scoped to the wrapper", () => {
    const host = document.createElement("div");
    host.setAttribute(WAVEDROM_SURFACE_ATTR, "");
    document.body.appendChild(host);
    renderWaveDromToElement({
      index: 0,
      outputElement: host,
      source: parseWaveDromSource({
        signal: [
          { name: "ACLK", wave: "p....." },
          { name: "VALID", wave: "01..0x", node: ".a.b.." },
          { name: "DATA", wave: "x=3456", data: ["A", "B", "C", "D", "E"] },
          { name: "MORE", wave: "x789z.", data: ["F", "G", "H"] },
        ],
        edge: ["a~>b handshake"],
      }),
    });
    const svg = host.querySelector("svg");
    expect(svg).not.toBeNull();
    const css = wavedromSurfaceCss();
    const classes = new Set<string>();
    svg!.querySelectorAll("[class]").forEach((el) => {
      for (const cls of (el.getAttribute("class") ?? "").split(/\s+/)) if (cls) classes.add(cls);
    });
    classes.delete("WaveDrom");
    // Shapes drawn through <use> are reached by two-class rules that read the wrapper's --wd-* variables;
    // text and other real children by rules scoped to the wrapper.
    const unstyled = [...classes].filter(
      (cls) =>
        !/^h\d$/.test(cls) &&
        !new RegExp(`path\\.${cls}\\.${cls}[{,]`).test(css) &&
        !css.includes(`[${WAVEDROM_SURFACE_ATTR}] svg .${cls}`) &&
        !css.includes(`svg text.${cls}`),
    );
    expect(unstyled).toEqual([]);
    // Outside the wrapper the variables are unset, so every shadow-tree rule falls back to WaveDrom's own colour.
    expect(css).toContain("path.s1.s1,path.s3.s3,path.s4.s4{stroke:var(--wd-stroke,#000)}");
    expect(css).toContain("path.s7.s7{fill:var(--wd-s7,#fff)}");
    expect(css).toContain(`[${WAVEDROM_SURFACE_ATTR}]{--wd-stroke:${p.stroke};`);
    // Inline colours that the class rules cannot reach are overridden with !important.
    expect(css).toContain(`marker{fill:${p.edge} !important}`);
    expect(css).toMatch(/rect\[style\*=fill\\:white\]\{fill:#080a12 !important\}/);
    expect(css).not.toMatch(/[>"']/);
    host.remove();
  });

  it("prints the diagram dark on a light background", () => {
    const css = wavedromSurfaceCss();
    const print = css.slice(css.indexOf("@media print{"));
    expect(print.length).toBeGreaterThan(20);
    expect(print).toMatch(/--wd-surface:#fff;/);
    expect(print).toMatch(/--wd-stroke:#000;/);
    expect(print).toMatch(/rect\[style\*=fill\\:white\]\{fill:#fff !important\}/);
    expect(print).toMatch(/text\.info,\[data-wavedrom-surface\] svg \.info\{fill:#000000\}/);
    const pp = WAVEDROM_PRINT_PALETTE;
    for (const [name, fg] of Object.entries({ text: pp.text, muted: pp.muted, warning: pp.warning, error: pp.error, success: pp.success })) {
      expect(contrast(fg, "#ffffff"), name).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(pp.grid, "#ffffff")).toBeGreaterThanOrEqual(3);
  });
});
