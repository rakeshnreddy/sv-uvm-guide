import { readFileSync } from "node:fs";
import path from "node:path";

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
  // Lesson text (DESIGN.md section 12).
  "reference",
  "prose-body",
  // Figures (DESIGN.md section 13): a stroke and a text value per meaning.
  ...["slate", "cyan", "rose", "amber", "violet", "indigo", "teal", "emerald"].flatMap((hue) => [`fig-${hue}`, `fig-${hue}-text`]),
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
  "glass-sheen",
  // Figure soft fills (DESIGN.md section 13): a triplet with its alpha.
  ...["slate", "cyan", "rose", "amber", "violet", "indigo", "teal", "emerald"].map((hue) => `fig-${hue}-fill`),
];

const CODE_CHROME = ["code-surface", "code-foreground", "code-muted", "code-border"];

const TEXT_ROLES = ["foreground", "muted-foreground", "subtle-foreground", "primary", "success", "warning", "danger-text", "reference"];
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

  it("link text over the field: the accent holds 4.5:1 in dark mode; in light mode header actions use primary text, and their accent underline reaches 3:1", () => {
    for (const [field, blend] of fieldBlends(vars)) {
      const accent = rgbContrast(rgbOf(vars.primary), blend);
      if (_name === "dark") expect(accent, `primary over ${field}`).toBeGreaterThanOrEqual(4.5);
      // PAGE_HEADER_ACTION_LINK_CLASS: text-foreground with a decoration-primary underline (a non-text cue).
      expect(accent, `primary underline over ${field}`).toBeGreaterThanOrEqual(3);
      expect(rgbContrast(rgbOf(vars.foreground), blend), `foreground link text over ${field}`).toBeGreaterThanOrEqual(4.5);
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

/*
 * Lesson text and glass panels (DESIGN.md section 12). Every text colour of the
 * lesson hierarchy on every surface it sits on, in both modes and all four
 * tiers: the page, the quiet liquid glass fill (with its sheen, and over the
 * strongest field colour where a panel can overlap the field), a callout's
 * 10% role tint on that fill, and a table header's 10% tier fill. Body text
 * holds 10:1, everything else 4.5:1. The mixes are sRGB, as globals.css
 * writes them (color-mix(in srgb, …)).
 */
const MIX_HEADING = 0.55;
const MIX_LABEL = 0.78;
const CALLOUT_ROLES = ["info", "success", "warning", "danger-text", "reference"];

function mixOf(vars: Record<string, string>, a: string, share: number, b: string): Rgb {
  return over(rgbOf(vars[a]), share, rgbOf(vars[b]));
}

/** The quiet liquid fill over a base: the glass fill, then (at the top edge, the worst case) the sheen. */
function liquidFills(vars: Record<string, string>, base: Rgb): Rgb[] {
  const glass = hsla(vars["glass-bg"]);
  const sheen = hsla(vars["glass-sheen"]);
  const fill = over(rgbOf(glass.triplet), glass.alpha, base);
  return [fill, over(rgbOf(sheen.triplet), sheen.alpha, fill)];
}

/** Every surface lesson text can sit on outside callouts and tables: the page and the liquid fill over it. */
function lessonSurfaces(vars: Record<string, string>): Array<[string, Rgb]> {
  const page = rgbOf(vars.background);
  const [fill, sheen] = liquidFills(vars, page);
  return [
    ["page", page],
    ["liquid", fill],
    ["liquid sheen", sheen],
  ];
}

/** A callout's surfaces: its role at 10% over the liquid fill (with and without the sheen) and over the page. */
function calloutSurfaces(vars: Record<string, string>): Array<[string, Rgb]> {
  return CALLOUT_ROLES.flatMap((role) =>
    lessonSurfaces(vars).map(([name, base]) => [`${role} callout on ${name}`, over(rgbOf(vars[role]), 0.1, base)] as [string, Rgb]),
  );
}

describe("lesson text tokens (DESIGN.md section 12)", () => {
  it("adds the --reference role with the section 12 values", () => {
    expect(dark.vars.reference).toBe("268 85% 78%");
    expect(light.vars.reference).toBe("262 55% 46%");
  });

  it.each(MODES)("%s --prose-body is the foreground mixed 88% with the secondary colour", (_name, { vars }) => {
    const expected = mixOf(vars, "foreground", 0.88, "muted-foreground");
    const actual = rgbOf(vars["prose-body"]);
    actual.forEach((channel, i) => expect(Math.abs(channel - expected[i]), `channel ${i}`).toBeLessThanOrEqual(0.01));
  });

  it("writes the mixes in globals.css as the test computes them", () => {
    expect(css).toContain("--lesson-heading: color-mix(in srgb, hsl(var(--tier-current)) 55%, hsl(var(--foreground)));");
    expect(css).toContain("--lesson-label: color-mix(in srgb, hsl(var(--tier-current)) 78%, hsl(var(--foreground)));");
    expect(css).toContain("--tw-prose-body: hsl(var(--prose-body));");
    expect(css).toMatch(/\.prose aside\.callout \{[^}]*--liquid-tint: hsl\(var\(--callout\) \/ 0\.1\);/);
    expect(css).toMatch(/thead th \{\s*background-color: hsl\(var\(--tier-current\) \/ 0\.1\);/);
  });

  it("draws a callout's leading edge as a straight inset bar, not a left border that bends round the radius", () => {
    const rule = /\.prose aside\.callout \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toContain("box-shadow: inset 2px 0 0 hsl(var(--callout)), inset 0 1px 0 hsl(var(--glass-highlight))");
    expect(rule).not.toMatch(/border-left/);
    // Forced colours drop shadows, so the edge comes back as a border there.
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{[^@]*\.prose aside\.callout \{\s*border-left: 3px solid CanvasText;/);
  });

  it("gives glass-liquid the fill, hairline, top edge and sheen, radius 16, no blur, and the fallbacks", () => {
    const rule = /\.glass-liquid \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toContain("background-color: hsl(var(--glass-bg));");
    expect(rule).toContain("border: 1px solid hsl(var(--glass-border));");
    expect(rule).toContain("inset 0 1px 0 hsl(var(--glass-highlight))");
    expect(rule).toContain("hsl(var(--glass-sheen))");
    expect(rule).toContain("border-radius: 1rem;");
    expect(rule).not.toMatch(/backdrop-filter/);
    expect(css).toMatch(/@media \(prefers-reduced-transparency: reduce\)\s*\{\s*\.glass-liquid\s*\{[^}]*background-color:\s*hsl\(var\(--card\)\)/);
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{\s*\.glass-liquid\s*\{[^}]*background-color:\s*Canvas/);
    // Glass never sits on glass: a liquid panel inside another loses its fill.
    expect(css).toMatch(/\.glass-liquid \.glass-liquid \{[^}]*background-color: transparent;/);
  });

  it("blurs the lesson header block only from 1280 px, with the fallbacks", () => {
    expect(css).toMatch(/@media \(min-width: 1280px\)\s*\{\s*\.glass-liquid\[data-lesson-header-glass\]\s*\{[^}]*backdrop-filter: var\(--glass-blur\)/);
    expect(css).toMatch(/@supports not [^{]*\{\s*\.glass-liquid\[data-lesson-header-glass\]\s*\{[^}]*background-color: hsl\(var\(--card\)\)/);
    expect(css).toMatch(/@media \(prefers-reduced-transparency: reduce\)\s*\{\s*\.glass-liquid\[data-lesson-header-glass\]\s*\{[^}]*backdrop-filter: none/);
  });
});

describe.each(MODES)("%s mode lesson text contrast", (_name, { vars }) => {
  it("body text holds 10:1 on the page, the liquid fill and every callout", () => {
    const body = rgbOf(vars["prose-body"]);
    for (const [surface, rgb] of [...lessonSurfaces(vars), ...calloutSurfaces(vars), ["card", rgbOf(vars.card)] as [string, Rgb]]) {
      expect(rgbContrast(body, rgb), `body on ${surface}`).toBeGreaterThanOrEqual(10);
    }
  });

  it("bold terms, inline code chips, links and secondary text hold 4.5:1 on the page, the liquid fill and every callout", () => {
    const chipOn = (base: Rgb) => over(rgbOf(vars.foreground), 0.06, base);
    for (const [surface, rgb] of [...lessonSurfaces(vars), ...calloutSurfaces(vars)]) {
      expect(rgbContrast(rgbOf(vars.foreground), rgb), `bold on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(rgbOf(vars.foreground), chipOn(rgb)), `code chip on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(rgbOf(vars.primary), rgb), `link on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(rgbOf(vars["muted-foreground"]), rgb), `secondary on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("each callout's label holds 4.5:1 on its own tint", () => {
    for (const role of CALLOUT_ROLES) {
      for (const [surface, base] of lessonSurfaces(vars)) {
        const label = rgbOf(vars[role]);
        expect(rgbContrast(label, over(label, 0.1, base)), `${role} label on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("captions (the subtle role) hold 4.5:1 on the page and the liquid fill", () => {
    for (const [surface, rgb] of lessonSurfaces(vars)) {
      expect(rgbContrast(rgbOf(vars["subtle-foreground"]), rgb), `caption on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("primary and secondary text on a liquid panel over the strongest field colour hold 4.5:1 (contents panel, outline, header block)", () => {
    for (const [field, blend] of fieldBlends(vars)) {
      for (const fill of liquidFills(vars, blend)) {
        for (const role of ["foreground", "muted-foreground"]) {
          expect(rgbContrast(rgbOf(vars[role]), fill), `${role} on liquid over ${field}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(rgbContrast(rgbOf(vars["tier-4"]), fill), `Expert tag on liquid over ${field}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(TIERS)("%s: layer and section headings, lead-in labels, list markers and table headers hold 4.5:1 wherever they sit", (tier) => {
    const tierRgb = rgbOf(vars[tier]);
    const heading = mixOf(vars, tier, MIX_HEADING, "foreground");
    const label = mixOf(vars, tier, MIX_LABEL, "foreground");
    for (const [surface, rgb] of lessonSurfaces(vars)) {
      expect(rgbContrast(tierRgb, rgb), `${tier} layer heading or marker on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(heading, rgb), `${tier} section heading on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(label, rgb), `${tier} lead-in on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(label, over(tierRgb, 0.1, rgb)), `${tier} table header on its fill over ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const [surface, rgb] of calloutSurfaces(vars)) {
      expect(rgbContrast(heading, rgb), `${tier} section heading in ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(label, rgb), `${tier} lead-in in ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(tierRgb, rgb), `${tier} list marker in ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the Expert tag (tier 4) holds 4.5:1 on the page, the liquid fill and a raised row", () => {
    for (const [surface, rgb] of [...lessonSurfaces(vars), ["raised row", rgbOf(vars.muted)] as [string, Rgb]]) {
      expect(rgbContrast(rgbOf(vars["tier-4"]), rgb), `Expert tag on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});


/*
 * Figures (DESIGN.md section 13). One colour role per meaning of the visual
 * language, each with a stroke, a text value and a soft fill. Strokes and filled
 * marks hold 3:1 and text 4.5:1 wherever a figure is drawn: on the page, on a
 * card, and on the quiet glass frame (its fill and its top sheen) over the page.
 * Text also holds 4.5:1 on its own soft fill, and a role tag on its chip (the
 * fill laid over the node's fill). The hues stay in their families, so the
 * meanings do not move.
 */
const FIG_HUES = {
  slate: [200, 225],
  cyan: [180, 196],
  rose: [340, 360],
  amber: [24, 46],
  violet: [250, 270],
  indigo: [225, 245],
  teal: [165, 180],
  emerald: [150, 166],
} as const;

/** Every surface a figure is drawn on: the page, a card, and the liquid frame (fill and sheen) over the page and over a card. */
function figureSurfaces(vars: Record<string, string>): Array<[string, Rgb]> {
  const page = rgbOf(vars.background);
  const card = rgbOf(vars.card);
  const [onPage, onPageSheen] = liquidFills(vars, page);
  const [onCard, onCardSheen] = liquidFills(vars, card);
  return [
    ["page", page],
    ["card", card],
    ["frame", onPage],
    ["frame sheen", onPageSheen],
    ["frame on card", onCard],
    ["frame sheen on card", onCardSheen],
  ];
}

describe("figure tokens (DESIGN.md section 13)", () => {
  it.each(MODES)("%s mode keeps every figure hue in its family, with a translucent soft fill", (_name, { vars }) => {
    for (const [hue, [lo, hi]] of Object.entries(FIG_HUES)) {
      for (const key of [`fig-${hue}`, `fig-${hue}-text`, `fig-${hue}-fill`]) {
        const h = parseFloat(vars[key]);
        expect(h, key).toBeGreaterThanOrEqual(lo);
        expect(h, key).toBeLessThanOrEqual(hi);
      }
      const fill = hsla(vars[`fig-${hue}-fill`]);
      expect(fill.alpha, `fig-${hue}-fill alpha`).toBeGreaterThanOrEqual(0.08);
      expect(fill.alpha, `fig-${hue}-fill alpha`).toBeLessThanOrEqual(0.2);
    }
  });

  it("exposes the tokens to Tailwind and draws the kit with them", () => {
    const config = readFileSync(path.join(process.cwd(), "tailwind.config.ts"), "utf8");
    expect(config).toContain("role(`fig-${hue}`)");
    expect(config).toContain("role(`fig-${hue}-text`)");
    expect(config).toContain("`hsl(var(--fig-${hue}-fill))`");
  });

  it("prints dark: variants with the light values: the dark variant applies on screen only", () => {
    const config = readFileSync(path.join(process.cwd(), "tailwind.config.ts"), "utf8");
    expect(config).toMatch(/darkMode: \["variant", '@media screen \{ &:where\(\[data-theme="dark"\], \[data-theme="dark"\] \*\) \}'\]/);
  });

  it("remaps the hand-drawn figures' literal colours to the figure tokens, and gives figures forced-colours rules", () => {
    expect(css).toContain('[data-lesson-article] svg [stroke="rgb(6,182,212)"] { stroke: hsl(var(--fig-cyan)); }');
    expect(css).toContain('[data-lesson-article] svg :is(text, tspan)[fill="rgb(225,29,72)"] { fill: hsl(var(--fig-rose-text)); }');
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{\s*:is\(\[data-figure-kit\], \[data-lesson-article\]\) svg :is\(text, tspan\) \{\s*fill: CanvasText;/);
  });

  it("keeps solid marks in hand-drawn figures solid in forced colours, after the soft-fill Canvas rule", () => {
    const block = css.slice(css.indexOf("Forced colours: figures draw in the system colours"));
    const canvas = block.indexOf("fill: Canvas;");
    const solid = block.indexOf('[data-lesson-article] svg :is(rect, path, circle, ellipse, polygon):is([fill="currentColor"], [fill^="rgb("]):not([fill-opacity], [opacity], [data-figure-kit] *)');
    expect(canvas).toBeGreaterThan(-1);
    expect(solid).toBeGreaterThan(canvas);
    expect(block.slice(solid)).toMatch(/^[^{]*\[data-lesson-article\] svg marker \[fill="currentColor"\] \{\s*fill: CanvasText;/);
  });

  it("maps the low-contrast Tailwind 500 strokes in hand-drawn figures to the figure tokens", () => {
    for (const hue of ["amber", "cyan", "rose", "violet", "emerald", "indigo"]) {
      expect(css).toContain(`[data-lesson-article] svg .stroke-${hue}-500 { stroke: hsl(var(--fig-${hue})); }`);
    }
  });
});

describe.each(MODES)("%s mode figure contrast", (_name, { vars }) => {
  it.each(Object.keys(FIG_HUES))("fig-%s: the stroke holds 3:1 and the text 4.5:1 on every figure surface", (hue) => {
    const stroke = rgbOf(vars[`fig-${hue}`]);
    const text = rgbOf(vars[`fig-${hue}-text`]);
    for (const [surface, base] of figureSurfaces(vars)) {
      expect(rgbContrast(stroke, base), `fig-${hue} stroke on ${surface}`).toBeGreaterThanOrEqual(3);
      expect(rgbContrast(text, base), `fig-${hue}-text on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(Object.keys(FIG_HUES))("fig-%s: text holds 4.5:1 on its own soft fill, and a tag on its chip over the node fill; the stroke holds 3:1 on the fill", (hue) => {
    const stroke = rgbOf(vars[`fig-${hue}`]);
    const text = rgbOf(vars[`fig-${hue}-text`]);
    const fill = hsla(vars[`fig-${hue}-fill`]);
    for (const [surface, base] of figureSurfaces(vars)) {
      const node = over(rgbOf(fill.triplet), fill.alpha, base);
      const chip = over(rgbOf(fill.triplet), fill.alpha, node);
      expect(rgbContrast(text, node), `fig-${hue}-text on its fill over ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(text, chip), `fig-${hue}-text on its chip over ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(stroke, node), `fig-${hue} stroke on its fill over ${surface}`).toBeGreaterThanOrEqual(3);
      // Primary text (node labels) on the soft fill.
      expect(rgbContrast(rgbOf(vars.foreground), node), `foreground on fig-${hue}-fill over ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(rgbContrast(rgbOf(vars["muted-foreground"]), node), `secondary on fig-${hue}-fill over ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("sequence step badges: the digits (page colour) hold 4.5:1 on the neutral, cyan and rose badges", () => {
    const digits = rgbOf(vars.background);
    for (const [surface, base] of figureSurfaces(vars)) {
      expect(rgbContrast(digits, over(rgbOf(vars.foreground), 0.8, base)), `neutral badge over ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const hue of ["cyan", "rose"]) expect(rgbContrast(digits, rgbOf(vars[`fig-${hue}-text`])), `${hue} badge`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TIERS)("%s: the neutral tint for nodes with no role (20% tier in the secondary colour) holds 3:1 as a stroke", (tier) => {
    const stroke = over(rgbOf(vars[tier]), 0.2, rgbOf(vars["muted-foreground"]));
    for (const [surface, base] of figureSurfaces(vars)) {
      expect(rgbContrast(stroke, over(rgbOf(vars[tier]), 0.045, base)), `${tier} generic stroke on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });
});

/*
 * "solid" on a hand-drawn figure's filled mark (DESIGN.md section 13, "Role only,
 * tint or solid"): data-fig="<role> solid" fills the mark with the
 * role's stroke colour at full opacity, and only on a shape filled in
 * currentColor with no dash. Every role rule must use the stroke
 * token of its hue and override fill-opacity, there must be no rule for "solid"
 * alone, and the fill must hold 3:1 on every figure surface in every theme
 * block (dark, light, the no-JavaScript light copy and print).
 */
const SOLID_ROLES: Record<string, keyof typeof FIG_HUES> = {
  "bit-low": "slate",
  "bit-high": "cyan",
  active: "cyan",
  x: "rose",
  mismatch: "rose",
  error: "rose",
  z: "amber",
  testbench: "amber",
  design: "violet",
  bus: "indigo",
  data: "indigo",
  interface: "indigo",
  expected: "teal",
  register: "teal",
  match: "emerald",
  ok: "emerald",
};

describe("solid figure marks (DESIGN.md section 13)", () => {
  const solidRules = [...css.matchAll(/\[data-lesson-article\] svg \[data-fig~="([\w-]+)"\]\[data-fig~="solid"\]\[fill="currentColor"\]:not\(\[stroke-dasharray\]\):not\(\[fill-opacity="0"\], \[fill-opacity="0\.0"\], \[fill-opacity="0\.00"\], \[opacity="0"\], \[opacity="0\.0"\], \[opacity="0\.00"\]\):not\(text, tspan, g, marker\) \{([^}]*)\}/g)];

  it("gives every role a solid rule that fills with its stroke token at full opacity", () => {
    const seen = Object.fromEntries(solidRules.map(([, role, body]) => [role, body.trim()]));
    expect(Object.keys(seen).sort()).toEqual(Object.keys(SOLID_ROLES).sort());
    for (const [role, hue] of Object.entries(SOLID_ROLES)) {
      expect(seen[role], role).toBe(`fill: hsl(var(--fig-${hue})); fill-opacity: 1;`);
    }
  });

  it("does nothing for solid without a role, and draws a solid mark in CanvasText in forced colours", () => {
    expect(css).not.toMatch(/\[data-fig="solid"\]/);
    expect(css).not.toMatch(/svg \[data-fig~="solid"\](?!:is\()/);
    // Only a shape filled in currentColor with no dash goes solid: never an outline (fill="none") or a dashed shape.
    expect(css.match(/\[data-fig~="solid"\][^{]*\{/g)?.every((sel) => sel.includes('[fill="currentColor"]:not([stroke-dasharray])'))).toBe(true);
    // An empty cell (fill-opacity 0) stays empty: solid never fills it.
    expect(css.match(/\[data-fig~="solid"\][^{]*\{/g)?.every((sel) => sel.includes(':not([fill-opacity="0"], [fill-opacity="0.0"], [fill-opacity="0.00"], [opacity="0"], [opacity="0.0"], [opacity="0.00"])'))).toBe(true);
    const forced = /@media \(forced-colors: active\) \{[^@]*\[data-fig~="solid"\]:is\(([^)]*)\)\[fill="currentColor"\]:not\(\[stroke-dasharray\]\):not\(\[fill-opacity="0"\], \[fill-opacity="0\.0"\], \[fill-opacity="0\.00"\], \[opacity="0"\], \[opacity="0\.0"\], \[opacity="0\.00"\]\):not\(text, tspan, g, marker\) \{ fill: CanvasText !important; fill-opacity: 1 !important; \}/.exec(css);
    expect(forced, "forced-colours solid rule").not.toBeNull();
    const roles = [...(forced?.[1] ?? "").matchAll(/\[data-fig~="([\w-]+)"\]/g)].map((m) => m[1]);
    expect(roles.sort()).toEqual(Object.keys(SOLID_ROLES).sort());
  });

  it("fills a tint only on a closed box that is not dashed and not in a marker", () => {
    // An open path, a polyline or a marker's arrowhead never takes a tint fill, and a dashed outline stays hollow.
    const tintRules = css.match(/^\s*\[data-lesson-article\][^\n{]*\[data-fig~?="tint"\][^\n{]*\{/gm) ?? [];
    expect(tintRules.length).toBe(18);
    for (const sel of tintRules) {
      expect(sel, sel).toContain("svg :is(rect, circle, ellipse, polygon)[data-fig");
      expect(sel, sel).toContain(":not([stroke-dasharray], marker *)");
    }
  });

  describe.each(themeBlocks().map((block) => [`${block.media || "screen"} ${block.selector}`, block] as const))("%s", (_name, block) => {
    it.each(Object.entries(SOLID_ROLES))("%s solid (fig-%s at full opacity) holds 3:1 on every figure surface", (role, hue) => {
      const fill = rgbOf(block.vars[`fig-${hue}`]);
      for (const [surface, base] of figureSurfaces(block.vars)) {
        expect(rgbContrast(fill, base), `${role} solid on ${surface}`).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
