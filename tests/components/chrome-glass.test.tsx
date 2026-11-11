import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LessonToc, { CONTENTS_SHEET_PANEL_CLASS, contentsBarClass } from "@/components/curriculum/LessonToc";
import ModuleJumpMenu from "@/components/curriculum/ModuleJumpMenu";
import {
  HeaderReadingProgress,
  ReadingProgressLine,
  headerProgressFrameClass,
  readingProgressFill,
} from "@/components/curriculum/ReadingProgress";
import {
  CHROME_GLASS_CLASS,
  CHROME_GLASS_LIGHT_ALPHA,
  DIALOG_BACKDROP_CLASS,
  MENU_SURFACE_CLASS,
  headerBarFrameClass,
} from "@/components/layout/nav-styles";
import SearchDialog from "@/components/search/SearchDialog";
import ShortcutsHelpDialog from "@/components/search/ShortcutsHelpDialog";
import { shellStore } from "@/components/search/shell-store";
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";

import { css, modes } from "../app/theme-tokens";

/*
 * Glass on the layers that float (DESIGN.md section 11): the header bar,
 * menus, popovers, dialogs, sheets and the contents bar. These tests pin the
 * shared classes, the fallbacks they rely on, and the contrast of text on the
 * chrome's glass against its worst case in both modes.
 */

let mockPathname: string | null = "/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  mockPathname = "/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes";
});

afterEach(() => {
  cleanup();
  act(() => shellStore.reset());
});

// ---------------------------------------------------------------------------
// Contrast of text on the chrome's glass
// ---------------------------------------------------------------------------

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

function hsla(value: string): { triplet: string; alpha: number } {
  const [triplet, alpha] = value.split("/").map((part) => part.trim());
  return { triplet, alpha: alpha === undefined ? 1 : parseFloat(alpha) };
}

function over(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((channel, i) => channel * alpha + bottom[i] * (1 - alpha)) as Rgb;
}

function luminance(rgb: Rgb): number {
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [1, 1, 1];
/** DIALOG_BACKDROP_CLASS: black at 40% (light), 55% (dark). */
const BACKDROP_ALPHA = { light: 0.4, dark: 0.55 } as const;
/** The text roles the chrome sets on glass. The subtle role never sits on it. */
const GLASS_TEXT = ["foreground", "muted-foreground"] as const;

/**
 * What can sit under a floating layer, as solid colours: the page and its
 * surfaces, each field colour's strongest stop over the page, and the code
 * surface (always dark, the largest dark block a lesson draws), each also
 * dimmed by the dialog backdrop.
 */
function backdrops(vars: Record<string, string>, mode: "light" | "dark"): Array<[string, Rgb]> {
  const page = rgbOf(vars.background);
  const solid: Array<[string, Rgb]> = [
    ["page", page],
    ["card", rgbOf(vars.card)],
    ["raised", rgbOf(vars.muted)],
    ["code surface", rgbOf(vars["code-surface"])],
    ...[1, 2, 3, 4].map((n): [string, Rgb] => [`field ${n}`, over(rgbOf(vars[`field-${n}`]), parseFloat(vars[`field-${n}-alpha`]), page)]),
  ];
  return [...solid, ...solid.map(([name, rgb]): [string, Rgb] => [`${name}, dimmed`, over(BLACK, BACKDROP_ALPHA[mode], rgb)])];
}

describe("text on the chrome's glass", () => {
  const { dark, light } = modes();

  it("sets the light fill through --glass-bg only, at CHROME_GLASS_LIGHT_ALPHA", () => {
    expect(CHROME_GLASS_CLASS.split(" ")).toContain("glass");
    expect(CHROME_GLASS_CLASS).toContain(`[[data-theme=light]_&]:[--glass-bg:0_0%_100%_/_${CHROME_GLASS_LIGHT_ALPHA}]`);
    expect(light.vars["glass-bg"]).toBe("0 0% 100% / 0.62");
    expect(CHROME_GLASS_LIGHT_ALPHA).toBeGreaterThan(hsla(light.vars["glass-bg"]).alpha);
  });

  it.each([
    ["light", light.vars, CHROME_GLASS_LIGHT_ALPHA],
    ["dark", dark.vars, hsla(dark.vars["glass-bg"]).alpha],
  ] as const)("holds 4.5:1 for primary and secondary text in %s mode over every backdrop", (mode, vars, alpha) => {
    const fill = mode === "light" ? WHITE : rgbOf(hsla(vars["glass-bg"]).triplet);
    const failures: string[] = [];
    for (const [name, under] of backdrops(vars, mode)) {
      const glass = over(fill, alpha, under);
      for (const role of GLASS_TEXT) {
        const value = ratio(rgbOf(vars[role]), glass);
        if (value < 4.5) failures.push(`${role} over ${name}: ${value.toFixed(2)}`);
      }
      // The raised row (hover, current item) is opaque: the same check as any surface.
      expect(ratio(rgbOf(vars.foreground), rgbOf(vars.muted))).toBeGreaterThanOrEqual(4.5);
    }
    expect(failures).toEqual([]);
  });

  it("keeps the accent marker and focus ring visible on glass (3:1 over the page's surfaces)", () => {
    for (const [mode, vars, alpha] of [
      ["light", light.vars, CHROME_GLASS_LIGHT_ALPHA],
      ["dark", dark.vars, hsla(dark.vars["glass-bg"]).alpha],
    ] as const) {
      const fill = mode === "light" ? WHITE : rgbOf(hsla(vars["glass-bg"]).triplet);
      for (const surface of ["background", "card", "muted"]) {
        const glass = over(fill, alpha, rgbOf(vars[surface]));
        expect(ratio(rgbOf(vars.primary), glass), `${mode} accent over ${surface}`).toBeGreaterThanOrEqual(3);
        expect(ratio(rgbOf(vars.primary), rgbOf(vars.muted)), `${mode} marker on the raised row`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The fallbacks the chrome relies on (globals.css, the `glass` utility)
// ---------------------------------------------------------------------------

/** The body of the first rule for `.glass` inside the at-rule that starts with `prelude`. */
function glassRuleIn(prelude: string): string {
  const start = css.indexOf(prelude);
  expect(start, prelude).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf("}\n  }", start) + 1);
  return block;
}

describe("glass fallbacks", () => {
  it("paints the solid card surface, never --glass-bg, without backdrop-filter support", () => {
    const rule = glassRuleIn("@supports not ((backdrop-filter");
    expect(rule).toMatch(/background-color:\s*hsl\(var\(--card\)\)/);
    expect(rule).toMatch(/border-color:\s*hsl\(var\(--border\)\)/);
    expect(rule).not.toContain("--glass-bg");
  });

  it("drops the blur and paints the card surface with reduced transparency", () => {
    const rule = glassRuleIn("@media (prefers-reduced-transparency: reduce)");
    expect(rule).toMatch(/backdrop-filter:\s*none/);
    expect(rule).toMatch(/background-color:\s*hsl\(var\(--card\)\)/);
    expect(rule).not.toContain("--glass-bg");
  });

  it("paints Canvas in forced colours", () => {
    const start = css.indexOf("@media (forced-colors: active) {\n    .glass");
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf("}\n  }", start));
    expect(rule).toMatch(/backdrop-filter:\s*none/);
    expect(rule).toMatch(/background-color:\s*Canvas/);
  });

  it("overrides only the --glass-bg variable, so every fallback still wins", () => {
    // Every class in the chrome glass is `glass` or a custom-property assignment: no background utility that would beat the fallbacks.
    for (const name of CHROME_GLASS_CLASS.split(" ")) expect(name === "glass" || /:\[--glass-bg:/.test(name)).toBe(true);
    expect(MENU_SURFACE_CLASS).not.toMatch(/\bbg-(popover|card|background)\b/);
    expect(CONTENTS_SHEET_PANEL_CLASS).not.toMatch(/\bbg-(popover|card|background)\b/);
    expect(contentsBarClass(false)).not.toMatch(/\bbg-(popover|card|background)\b/);
  });
});

// ---------------------------------------------------------------------------
// Header bar geometry and dialog backdrop
// ---------------------------------------------------------------------------

describe("header bar and dialog backdrop", () => {
  it("places the bar 8 px in from the top and bottom, as a background layer", () => {
    expect(headerBarFrameClass("docked")).toBe("absolute inset-x-2 inset-y-2");
    expect(headerBarFrameClass("frame")).toContain("max-w-7xl");
    expect(headerBarFrameClass("frame")).toContain("px-2 lg:px-4");
    expect(headerBarFrameClass("public")).toContain("max-w-6xl");
    expect(headerBarFrameClass("public")).toContain("inset-y-1 mx-auto max-w-6xl px-2 sm:inset-y-2");
  });

  it("dims the page behind dialogs without blur", () => {
    expect(DIALOG_BACKDROP_CLASS).toMatch(/bg-black\/40/);
    expect(DIALOG_BACKDROP_CLASS).not.toMatch(/blur|glass/);
  });
});

// ---------------------------------------------------------------------------
// Dialogs, sheets, menus
// ---------------------------------------------------------------------------

describe("glass dialogs and menus", () => {
  it("makes the search dialog a glass panel over a dimming backdrop", () => {
    act(() => shellStore.openSearch());
    render(<SearchDialog />);
    const dialog = screen.getByTestId("search-dialog");
    expect(dialog).toHaveClass("glass", "rounded-2xl");
    expect(dialog.className).not.toMatch(/\bbg-card\b|shadow-(lg|xl|2xl)/);
    const backdrop = screen.getByTestId("search-dialog-backdrop");
    for (const name of DIALOG_BACKDROP_CLASS.split(" ")) expect(backdrop).toHaveClass(name);
    // The field inside stays a solid surface.
    expect(within(dialog).getByRole("combobox")).toHaveClass("bg-background");
  });

  it("makes the shortcuts help a glass panel, with its captions in secondary text", () => {
    act(() => shellStore.openHelp());
    render(<ShortcutsHelpDialog />);
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog).toHaveClass("glass", "rounded-2xl");
    expect(screen.getByTestId("shortcuts-help-backdrop")).toHaveClass("bg-black/40");
    for (const caption of Array.from(dialog.querySelectorAll("caption"))) {
      expect(caption).toHaveClass("text-muted-foreground");
      expect(caption).not.toHaveClass("text-subtle");
    }
    fireEvent.keyDown(dialog, { key: "Escape" });
  });

  it("opens Jump to as a glass menu, keeping the current row raised with the accent marker", () => {
    render(
      <ModuleJumpMenu
        moduleLabel="I-SV-5: Synchronization and IPC"
        lessons={[
          { href: "/a", title: "Events", current: false },
          { href: "/b", title: "Mailboxes", current: true },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Jump to/ }));
    const panel = screen.getByTestId("module-jump-panel");
    expect(panel).toHaveClass("glass", "rounded-xl");
    expect(panel.className).not.toMatch(/\bbg-popover\b/);
    expect(within(panel).getByText(/Lessons in/)).toHaveClass("text-muted-foreground");
    expect(within(panel).getByRole("link", { name: /Mailboxes/ })).toHaveClass("bg-muted", "border-primary");
  });
});

// ---------------------------------------------------------------------------
// Contents bar, sheet and reading progress
// ---------------------------------------------------------------------------

const entries: TocEntry[] = [
  { id: "quick-take", text: "Quick Take", depth: 2, expert: false },
  { id: "make-it-work", text: "Make It Work", depth: 2, expert: false },
];

describe("contents bar and sheet", () => {
  it("makes the bar below 1280 px a rounded glass bar 8 px in from the main column; the column stays plain", () => {
    render(<LessonToc entries={entries} />);
    const bar = screen.getByTestId("lesson-contents-bar");
    expect(bar).toHaveClass("glass", "rounded-xl", "mx-2", "h-11", "xl:hidden");
    expect(bar).not.toHaveClass("lg:mx-4");
    const column = screen.getByTestId("lesson-toc-column");
    expect(column.className).not.toMatch(/glass/);
    expect(column.querySelector(".glass, .glass-quiet")).toBeNull();
  });

  it("lines the bar up with the header's bar when the outline is hidden at lg", () => {
    act(() => shellStore.setOutlineCollapsed(true));
    render(<LessonToc entries={entries} />);
    expect(screen.getByTestId("lesson-contents-bar")).toHaveClass("lg:mx-4");
  });

  it("opens the sheet as a floating glass panel over a dimming backdrop", () => {
    render(<LessonToc entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /^On this page/ }));
    const sheet = screen.getByRole("dialog", { name: "On this page" });
    expect(sheet).toHaveClass("glass", "rounded-2xl", "inset-x-2", "bottom-2");
    expect(screen.getByTestId("lesson-contents-backdrop")).toHaveClass("bg-black/40");
  });
});

describe("reading progress line", () => {
  it("runs from the lesson's tier colour into the accent, and is the plain accent outside a tier", () => {
    expect(readingProgressFill(2)).toBe("bg-gradient-to-r from-tier-current to-primary");
    expect(readingProgressFill(undefined)).toBe("bg-primary");
  });

  it("takes the tier from the lesson URL and carries it on the line", () => {
    const { container, unmount } = render(<ReadingProgressLine />);
    const line = container.querySelector("[data-reading-progress]");
    expect(line).toHaveAttribute("data-tier", "2");
    expect(line).toHaveClass("from-tier-current", "to-primary", "h-0.5", "scale-x-0");
    expect(line).toHaveAttribute("aria-hidden", "true");
    unmount();

    mockPathname = "/practice";
    const plain = render(<ReadingProgressLine />).container.querySelector("[data-reading-progress]");
    expect(plain).not.toHaveAttribute("data-tier");
    expect(plain).toHaveClass("bg-primary");
  });

  it("sits on the glass bar's bottom edge from 1280 px, inset past its corners", () => {
    expect(headerProgressFrameClass(false)).toContain("top-[3.375rem]");
    expect(headerProgressFrameClass(false)).toContain("px-8");
    expect(headerProgressFrameClass(true)).toContain("max-w-7xl px-10");
    const { container } = render(<HeaderReadingProgress />);
    const frame = container.querySelector("[data-header-progress]");
    expect(frame).toHaveClass("fixed", "hidden", "xl:block", "print:hidden");
    expect(frame?.querySelector("[data-reading-progress]")).not.toBeNull();
  });
});
