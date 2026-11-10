import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  MONACO_SURFACE,
  SITE_MONACO_COLORS,
  SITE_MONACO_RULES,
  SITE_MONACO_THEME,
  defineSiteMonacoThemes,
} from "@/lib/monaco-themes";
import { modes } from "../app/theme-tokens";

type Rgb = [number, number, number];

const fromHex = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
};

const fromHsl = (value: string): Rgb => {
  const [h, s, l] = value.split(/\s+/).map((part) => parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((c) => Math.round(c * 255)) as Rgb;
};

const toHex = (rgb: Rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

const luminance = (rgb: Rgb) => {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const mix = (base: Rgb, over: Rgb, alpha: number): Rgb =>
  base.map((c, i) => Math.round(c * (1 - alpha) + over[i] * alpha)) as Rgb;

/** Monaco's stock vs-dark token rules, read from the installed package (the base our themes inherit). */
function vsDarkRules(): Map<string, string> {
  const source = readFileSync(
    path.join(process.cwd(), "node_modules/monaco-editor/esm/vs/editor/standalone/common/themes.js"),
    "utf8",
  );
  const block = source.slice(source.indexOf("const vs_dark"), source.indexOf("colors:", source.indexOf("const vs_dark")));
  const rules = new Map<string, string>();
  for (const [, token, fg] of block.matchAll(/token: '([^']*)', foreground: '([0-9A-Fa-f]{6})'/g)) rules.set(token, fg);
  return rules;
}

describe("site Monaco themes", () => {
  const { dark, light } = modes();

  it("puts the editor on the code surface from globals.css in both modes", () => {
    expect(dark.vars["code-surface"]).toBe(light.vars["code-surface"]);
    expect(toHex(fromHsl(dark.vars["code-surface"]))).toBe(MONACO_SURFACE.background);
    for (const key of ["editor.background", "editorGutter.background", "minimap.background"]) {
      expect(SITE_MONACO_COLORS[key]).toBe(MONACO_SURFACE.background);
    }
    expect(SITE_MONACO_COLORS["editor.lineHighlightBackground"]).toBe(MONACO_SURFACE.raised);
    expect(SITE_MONACO_COLORS["editorWidget.background"]).toBe(MONACO_SURFACE.raised);
    expect(SITE_MONACO_COLORS["editorSuggestWidget.background"]).toBe(MONACO_SURFACE.raised);
    expect(SITE_MONACO_COLORS["editorHoverWidget.background"]).toBe(MONACO_SURFACE.raised);
  });

  it("keeps every effective token colour at 4.5:1 on the surface, the current line and the step tint", () => {
    const surface = fromHex(MONACO_SURFACE.background);
    const backgrounds: Record<string, Rgb> = {
      surface,
      currentLine: fromHex(MONACO_SURFACE.raised),
      // globals.css .monaco-highlighted-line: hsl(var(--primary) / 0.1), measured with each mode's primary.
      stepTintDark: mix(surface, fromHsl(dark.vars.primary), 0.1),
      stepTintLight: mix(surface, fromHsl(light.vars.primary), 0.1),
    };
    const effective = vsDarkRules();
    expect(effective.size).toBeGreaterThan(20);
    for (const rule of SITE_MONACO_RULES) effective.set(rule.token, rule.foreground);
    const failures: string[] = [];
    for (const [token, fg] of effective) {
      for (const [name, bg] of Object.entries(backgrounds)) {
        const ratio = contrast(fromHex(fg), bg);
        if (ratio < 4.5) failures.push(`${token || "(default)"} #${fg} on ${name}: ${ratio.toFixed(2)}`);
      }
    }
    for (const key of ["editorLineNumber.foreground", "editorLineNumber.activeForeground", "editorBracketHighlight.foreground1"]) {
      for (const [name, bg] of Object.entries(backgrounds)) {
        const ratio = contrast(fromHex(SITE_MONACO_COLORS[key]), bg);
        if (ratio < 4.5) failures.push(`${key} on ${name}: ${ratio.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("defines both theme names on the dark base, once", () => {
    const defineTheme = vi.fn();
    defineSiteMonacoThemes({ editor: { defineTheme } });
    defineSiteMonacoThemes({ editor: { defineTheme } });
    expect(defineTheme.mock.calls.map(([name]) => name).sort()).toEqual(
      [SITE_MONACO_THEME.dark, SITE_MONACO_THEME.light].sort(),
    );
    for (const [, data] of defineTheme.mock.calls) {
      expect(data.base).toBe("vs-dark");
      expect(data.colors["editor.background"]).toBe(MONACO_SURFACE.background);
    }
  });
});
