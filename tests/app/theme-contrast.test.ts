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
  // Colour and glass (DESIGN.md section 11).
  "tier-1",
  "tier-2",
  "tier-3",
  "tier-4",
  "field-1",
  "field-2",
  "field-3",
  "field-4",
  "primary-sheen-top",
  "primary-sheen-bottom",
];

/** Section 11 tokens that are not plain HSL triplets; copied like the roles. */
const GLASS_TOKENS = [
  "field-1-alpha",
  "field-2-alpha",
  "field-3-alpha",
  "field-4-alpha",
  "glass-bg",
  "glass-border",
  "glass-highlight",
  "glass-shadow",
  "glass-blur",
  "primary-sheen-highlight",
  "primary-sheen-hover",
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
      for (const role of [...ROLES, ...GLASS_TOKENS]) expect(block.vars[role], `${block.media} ${role}`).toBe(light.vars[role]);
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

/*
 * Colour and glass (DESIGN.md section 11). Translucent colours are composited
 * over their surface in sRGB, as the browser paints them, and the ratios are
 * read from the result.
 */
type Rgb = [number, number, number];

function rgbOf(triplet: string): Rgb {
  const [h, s, l] = triplet.split(/\s+/).map((part) => parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/** "222 22% 12% / 0.42" → the triplet and its alpha. */
function hsla(value: string): { triplet: string; alpha: number } {
  const [triplet, alpha] = value.split("/").map((part) => part.trim());
  return { triplet, alpha: alpha === undefined ? 1 : parseFloat(alpha) };
}

function over(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((channel, i) => channel * alpha + bottom[i] * (1 - alpha)) as Rgb;
}

function rgbLuminance(rgb: Rgb): number {
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbContrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [rgbLuminance(a), rgbLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TIERS = ["tier-1", "tier-2", "tier-3", "tier-4"];
const FIELD_TEXT = ["foreground", "muted-foreground", "subtle-foreground"];

/** Each field colour's strongest stop composited over the page. */
function fieldBlends(vars: Record<string, string>): Array<[string, Rgb]> {
  return [1, 2, 3, 4].map((n) => {
    const alpha = parseFloat(vars[`field-${n}-alpha`]);
    return [`field-${n}`, over(rgbOf(vars[`field-${n}`]), alpha, rgbOf(vars.background))];
  });
}

describe("colour and glass tokens", () => {
  it("keeps the tier hues of section 11, with lightness within 4 points of the table", () => {
    const table = {
      dark: { "tier-1": "172 66% 50%", "tier-2": "222 100% 74%", "tier-3": "260 100% 79%", "tier-4": "36 90% 63%" },
      light: { "tier-1": "172 80% 24%", "tier-2": "222 75% 42%", "tier-3": "262 60% 46%", "tier-4": "30 92% 32%" },
    } as const;
    for (const [name, block] of MODES) {
      for (const tier of TIERS) {
        const [h, s, l] = block.vars[tier].split(/\s+/).map((part) => parseFloat(part));
        const [th, ts, tl] = table[name][tier as keyof (typeof table)["dark"]].split(/\s+/).map((part) => parseFloat(part));
        expect([h, s], `${name} ${tier}`).toEqual([th, ts]);
        expect(Math.abs(l - tl), `${name} ${tier} lightness`).toBeLessThanOrEqual(4);
      }
    }
  });

  it("keeps the field alphas in the section 11 ranges: 0.34 to 0.55 dark, 0.14 to 0.24 light", () => {
    for (const n of [1, 2, 3, 4]) {
      const darkAlpha = parseFloat(dark.vars[`field-${n}-alpha`]);
      const lightAlpha = parseFloat(light.vars[`field-${n}-alpha`]);
      expect(darkAlpha, `dark field-${n}`).toBeGreaterThanOrEqual(0.34);
      expect(darkAlpha, `dark field-${n}`).toBeLessThanOrEqual(0.55);
      expect(lightAlpha, `light field-${n}`).toBeGreaterThanOrEqual(0.14);
      expect(lightAlpha, `light field-${n}`).toBeLessThanOrEqual(0.24);
    }
  });

  it("uses the glass values of section 11", () => {
    expect(dark.vars["glass-bg"]).toBe("222 22% 12% / 0.42");
    expect(light.vars["glass-bg"]).toBe("0 0% 100% / 0.62");
    expect(dark.vars["glass-border"]).toBe("0 0% 100% / 0.12");
    expect(light.vars["glass-border"]).toBe("220 14% 70% / 0.35");
    expect(dark.vars["glass-highlight"]).toBe("0 0% 100% / 0.14");
    expect(light.vars["glass-highlight"]).toBe("0 0% 100% / 0.7");
    expect(dark.vars["glass-shadow"]).toBe("0 12px 40px rgb(0 0 0 / 0.28)");
    expect(light.vars["glass-shadow"]).toBe("0 8px 30px rgb(16 24 40 / 0.08)");
    expect(dark.vars["glass-blur"]).toBe("blur(22px) saturate(170%)");
    expect(light.vars["glass-blur"]).toBe("blur(22px) saturate(150%)");
  });

  it("scopes the current tier to data-tier 1 to 4, neutral outside", () => {
    for (const n of [1, 2, 3, 4]) {
      const rule = new RegExp(`\\[data-tier="${n}"\\]\\s*\\{[^}]*--tier-current:\\s*var\\(--tier-${n}\\);`);
      expect(css, `data-tier ${n}`).toMatch(rule);
    }
    expect(css).toMatch(/--tier-current-subtle:\s*hsl\(var\(--tier-current\) \/ 0\.14\);/);
    expect(css).toMatch(/--tier-current-border:\s*hsl\(var\(--tier-current\) \/ 0\.38\);/);
    for (const n of [1, 2, 3, 4]) {
      expect(css).toContain(`--tier-${n}-subtle: hsl(var(--tier-${n}) / 0.14);`);
      expect(css).toContain(`--tier-${n}-border: hsl(var(--tier-${n}) / 0.38);`);
    }
  });

  it("gives glass, glass-quiet and the colour field their fallbacks, and no banned effects", () => {
    expect(css).toMatch(/\.glass\s*\{[^}]*backdrop-filter:\s*var\(--glass-blur\)/);
    const quiet = /\.glass,\s*\.glass-quiet\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(quiet).not.toMatch(/backdrop-filter/);
    expect(css).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)\s*\{\s*\.glass\s*\{[^}]*background-color:\s*hsl\(var\(--card\)\)/);
    expect(css).toMatch(/@media \(prefers-reduced-transparency: reduce\)\s*\{\s*\.glass,\s*\.glass-quiet\s*\{[^}]*background-color:\s*hsl\(var\(--card\)\)/);
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{\s*\.glass,\s*\.glass-quiet\s*\{[^}]*backdrop-filter:\s*none/);
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{\s*\[data-page-field\]\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\[data-page-field\]\s*\{[^}]*pointer-events:\s*none[^}]*\}/);
    expect(css).not.toMatch(/will-change|background-clip:\s*text|@keyframes/);
  });
});

describe.each(MODES)("%s mode colour and glass contrast", (_name, { vars }) => {
  it.each(TIERS)("%s reads at 4.5:1 as text on the page, cards, the raised surface and its own subtle fill over each", (tier) => {
    for (const surface of SURFACES) {
      const base = rgbOf(vars[surface]);
      const text = rgbOf(vars[tier]);
      expect(rgbContrast(text, base), `${tier} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(text, over(text, 0.14, base)), `${tier} on its subtle fill over ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the tier's 38% border reaches 1.5:1 on the card, so the tag edge stays visible", () => {
    for (const tier of TIERS) {
      const card = rgbOf(vars.card);
      expect(rgbContrast(over(rgbOf(vars[tier]), 0.38, card), card), tier).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("primary, secondary and subtle text hold 4.5:1 over the strongest stop of every field colour", () => {
    for (const [field, blend] of fieldBlends(vars)) {
      for (const role of FIELD_TEXT) {
        expect(rgbContrast(rgbOf(vars[role]), blend), `${role} over ${field}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("text on the glass fill holds 4.5:1 over the strongest field colour", () => {
    const glass = hsla(vars["glass-bg"]);
    for (const [field, blend] of fieldBlends(vars)) {
      const fill = over(rgbOf(glass.triplet), glass.alpha, blend);
      for (const role of FIELD_TEXT) {
        expect(rgbContrast(rgbOf(vars[role]), fill), `${role} on glass over ${field}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("a signal tag's tier text holds 4.5:1 on its fill over the glass fill on the strongest field colour", () => {
    const glass = hsla(vars["glass-bg"]);
    for (const [field, blend] of fieldBlends(vars)) {
      const fill = over(rgbOf(glass.triplet), glass.alpha, blend);
      for (const tier of TIERS) {
        const text = rgbOf(vars[tier]);
        expect(rgbContrast(text, over(text, 0.14, fill)), `${tier} tag on glass over ${field}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("the primary sheen stays 6 points either side of the accent at most, with the button text at 4.5:1 on every stop and on hover", () => {
    const l = (v: string) => parseFloat(v.split(/\s+/)[2]);
    const hue = (v: string) => v.split(/\s+/).slice(0, 2).join(" ");
    expect(hue(vars["primary-sheen-top"])).toBe(hue(vars.primary));
    expect(hue(vars["primary-sheen-bottom"])).toBe(hue(vars.primary));
    expect(l(vars["primary-sheen-top"]) - l(vars.primary)).toBeGreaterThan(0);
    expect(l(vars["primary-sheen-top"]) - l(vars.primary)).toBeLessThanOrEqual(6);
    expect(l(vars.primary) - l(vars["primary-sheen-bottom"])).toBe(6);
    const text = rgbOf(vars["primary-foreground"]);
    const veil = hsla(vars["primary-sheen-hover"]);
    for (const stop of ["primary-sheen-top", "primary-sheen-bottom"]) {
      const fill = rgbOf(vars[stop]);
      expect(rgbContrast(text, fill), stop).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(text, over(rgbOf(veil.triplet), veil.alpha, fill)), `${stop} on hover`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
