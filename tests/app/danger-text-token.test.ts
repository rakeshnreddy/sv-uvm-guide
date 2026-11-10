import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Error text uses --danger-text, not --destructive: the dark themes' destructive
 * fill is 1.46:1 on the lab console. Every theme block must define a danger text
 * colour that reads at WCAG AA (4.5:1) on the surfaces error text sits on, and the
 * light destructive fill must carry white text at 4.5:1.
 */

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

function themeBlocks(): Array<{ name: string; vars: Record<string, string> }> {
  const blocks: Array<{ name: string; vars: Record<string, string> }> = [];
  const re = /(:root\s*|html\[data-theme="[^"]+"\][^{]*)\{([^}]*)\}/g;
  for (const match of css.matchAll(re)) {
    const vars: Record<string, string> = {};
    for (const [, key, value] of match[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) {
      vars[key] = value.replace(/\/\*.*$/, "").trim();
    }
    if ("background" in vars) blocks.push({ name: match[1].trim().split("\n")[0], vars });
  }
  return blocks;
}

function hslToRgb(value: string): [number, number, number] {
  const [h, s, l] = value.split(/\s+/).map((part) => parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

function luminance(value: string): number {
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hslToRgb(value).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("--danger-text token", () => {
  const blocks = themeBlocks();

  it("finds every theme block", () => {
    // :root plus five light and five dark themes.
    expect(blocks.length).toBe(11);
  });

  it.each(blocks.map((block) => [block.name, block.vars] as const))("%s reads at 4.5:1", (_name, vars) => {
    expect(vars["danger-text"]).toBeTruthy();
    for (const surface of ["background", "card", "muted", "secondary"]) {
      expect(contrast(vars["danger-text"], vars[surface]), surface).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(vars["destructive-foreground"], vars.destructive), "text on destructive fill").toBeGreaterThanOrEqual(4.5);
  });
});
