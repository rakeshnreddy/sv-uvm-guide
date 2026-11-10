import { readFileSync } from "node:fs";
import path from "node:path";

/*
 * Reads the colour roles from src/app/globals.css for the token tests
 * (theme-contrast.test.ts, danger-text-token.test.ts). Values are HSL triplets
 * ("220 20% 93%") as the `hsl(var(--x))` pattern uses them.
 */

export type Vars = Record<string, string>;

export interface ThemeBlock {
  /** The selector text, whitespace collapsed. */
  selector: string;
  /** The at-rule the block sits in ("" at the top level or inside @layer). */
  media: string;
  vars: Vars;
  colorScheme?: string;
}

export const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

/** Every rule that defines --background, with the media query around it. */
export function themeBlocks(source: string = css): ThemeBlock[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: ThemeBlock[] = [];
  const stack: string[] = [];
  let buffer = "";
  for (const ch of text) {
    if (ch === "{") {
      stack.push(buffer.trim());
      buffer = "";
    } else if (ch === "}") {
      const selector = stack.pop() ?? "";
      const vars: Vars = {};
      for (const [, key, value] of buffer.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[key] = value.trim();
      if ("background" in vars) {
        const media = [...stack].reverse().find((s) => s.startsWith("@media")) ?? "";
        const scheme = /color-scheme\s*:\s*([^;]+);/.exec(buffer)?.[1].trim();
        blocks.push({ selector: selector.replace(/\s+/g, " "), media: media.replace(/\s+/g, " "), vars, colorScheme: scheme });
      }
      buffer = "";
    } else {
      buffer += ch;
    }
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

/** WCAG 2 contrast ratio between two HSL triplets. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The dark and light role sets: the blocks keyed on html[data-theme="dark"] and html[data-theme="light"]. */
export function modes(): { dark: ThemeBlock; light: ThemeBlock } {
  const blocks = themeBlocks();
  const dark = blocks.find((b) => !b.media && b.selector.includes('html[data-theme="dark"]'));
  const light = blocks.find((b) => !b.media && b.selector.includes('html[data-theme="light"]'));
  if (!dark || !light) throw new Error("globals.css must define html[data-theme=\"dark\"] and html[data-theme=\"light\"]");
  return { dark, light };
}
