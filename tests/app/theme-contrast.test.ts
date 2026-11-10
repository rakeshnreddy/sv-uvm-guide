import { describe, expect, it } from "vitest";

import { contrast, css, modes, themeBlocks } from "./theme-tokens";

/*
 * The colour roles in src/app/globals.css (DESIGN.md sections 2 and 7): two
 * modes, every text pair at WCAG AA, control boundaries at 3:1, and the copies
 * of the light values (device preference without JavaScript, print) identical
 * to the light mode.
 */

const ROLES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "muted",
  "muted-foreground",
  "subtle-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "primary",
  "primary-foreground",
  "ring",
  "success",
  "warning",
  "info",
  "danger-text",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "code-surface",
  "code-foreground",
  "code-muted",
  "code-border",
];

const CODE_CHROME = ["code-surface", "code-foreground", "code-muted", "code-border"];

const TEXT_ROLES = ["foreground", "muted-foreground", "subtle-foreground", "primary", "success", "warning", "danger-text"];
const SURFACES = ["background", "card", "muted"];

const { dark, light } = modes();
const MODES = [
  ["dark", dark],
  ["light", light],
] as const;

describe("theme blocks", () => {
  const blocks = themeBlocks();

  it("has exactly two modes, plus the no-JavaScript light copy and the print copy", () => {
    expect(blocks.map((b) => [b.media, b.selector])).toEqual([
      ["", ':root, html[data-theme="dark"]'],
      ["", 'html[data-theme="light"]'],
      ["@media (prefers-color-scheme: light)", ":root:not([data-theme])"],
      ["@media print", ":root, html[data-theme]"],
    ]);
  });

  it("keeps none of the old theme names, blueprint variables or gradient tokens", () => {
    expect(css).not.toMatch(/data-theme="[a-z]+-(light|dark)"/);
    expect(css).not.toMatch(/html\.dark/);
    expect(css).not.toMatch(/--blueprint-|--gradient-end/);
    expect(css).not.toMatch(/\.(btn-gradient|glass-card|hero-gradient|glow-border|neon-divider|animated-gradient)\b/);
  });

  it.each(MODES)("%s mode defines every role", (_name, block) => {
    for (const role of ROLES) expect(block.vars[role], role).toMatch(/^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/);
  });

  it("sets color-scheme per mode", () => {
    expect(dark.colorScheme).toBe("dark");
    expect(light.colorScheme).toBe("light");
    for (const block of blocks.filter((b) => b.media)) expect(block.colorScheme, block.media).toBe("light");
  });

  it("copies the light values exactly into the device-preference and print blocks", () => {
    for (const block of blocks.filter((b) => b.media)) {
      for (const role of ROLES) expect(block.vars[role], `${block.media} ${role}`).toBe(light.vars[role]);
    }
  });

  it("keeps the code surface dark in both modes, and the accent shared by ring and info", () => {
    expect(dark.vars["code-surface"]).toBe(light.vars["code-surface"]);
    for (const [, block] of MODES) {
      expect(block.vars.ring).toBe(block.vars.primary);
      expect(block.vars.info).toBe(block.vars.primary);
      expect(contrast(block.vars["code-surface"], dark.vars.foreground)).toBeGreaterThanOrEqual(12);
    }
  });

  it("keeps the code-surface chrome identical in both modes, with text at 4.5:1 on the code surface", () => {
    for (const role of CODE_CHROME) expect(light.vars[role], role).toBe(dark.vars[role]);
    for (const [, block] of MODES) {
      for (const role of ["code-foreground", "code-muted"]) {
        expect(contrast(block.vars[role], block.vars["code-surface"]), role).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("gives dark mode a transparent zero card shadow, so shadow-card composes with rings", () => {
    const shadow = (selector: string) => {
      const start = css.indexOf(selector);
      return /--shadow-card:\s*([^;]+);/.exec(css.slice(start))?.[1].trim();
    };
    expect(shadow(':root,\n  html[data-theme="dark"]')).toBe("0 0 #0000");
    expect(shadow('html[data-theme="light"] {')).toBe("0 1px 2px rgb(16 24 40 / 0.05)");
    expect(css).not.toMatch(/--shadow-card:\s*none/);
  });

  it("draws a bare border class as the --border hairline", () => {
    expect(css).toMatch(/\*,\s*::before,\s*::after\s*\{\s*border-color: hsl\(var\(--border\)\);/);
  });

  it("marks Monaco step lines with the dark-mode primary, which reads on the always-dark editor", () => {
    const rule = /\.monaco-highlighted-line\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toContain(`hsl(${dark.vars.primary})`);
    expect(rule).not.toContain("var(--primary)");
    expect(contrast(dark.vars.primary, dark.vars["code-surface"])).toBeGreaterThanOrEqual(4.5);
  });

  it("puts cards one step above the page in dark mode", () => {
    const l = (v: string) => parseFloat(v.split(/\s+/)[2]);
    expect(l(dark.vars.card)).toBeGreaterThan(l(dark.vars.background));
    expect(l(dark.vars.muted)).toBeGreaterThan(l(dark.vars.card));
  });
});

describe.each(MODES)("%s mode contrast", (_name, { vars }) => {
  it.each(TEXT_ROLES)("%s reads at 4.5:1 on the page, cards and raised surfaces", (role) => {
    for (const surface of SURFACES) {
      expect(contrast(vars[role], vars[surface]), `${role} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("text on the accent fill reads at 4.5:1", () => {
    expect(contrast(vars["primary-foreground"], vars.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("text on the destructive fill reads at 4.5:1", () => {
    expect(contrast(vars["destructive-foreground"], vars.destructive)).toBeGreaterThanOrEqual(4.5);
  });

  it("control boundaries reach 3:1 on the page and on cards", () => {
    for (const surface of ["background", "card"]) {
      expect(contrast(vars.input, vars[surface]), `input on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("the -foreground aliases match the primary text colour", () => {
    for (const role of ["card-foreground", "popover-foreground", "secondary-foreground", "accent-foreground"]) {
      expect(vars[role], role).toBe(vars.foreground);
    }
  });
});
