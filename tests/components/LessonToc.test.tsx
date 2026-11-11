import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LessonToc, { tocSummary } from "@/components/curriculum/LessonToc";
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";

const entries: TocEntry[] = [
  { id: "quick-take", text: "Quick Take", depth: 2, expert: false },
  { id: "build-your-mental-model", text: "Build Your Mental Model", depth: 2, expert: false },
  { id: "the-problem", text: "The problem", depth: 3, expert: false },
  { id: "expert-clause-1614-corner-cases", text: "Expert: clause 16.14 corner cases", depth: 3, expert: true },
  { id: "push-further", text: "Push Further", depth: 2, expert: true },
  { id: "scale", text: "Scale", depth: 3, expert: true },
  { id: "reinforce-the-essentials", text: "Reinforce the essentials", depth: 2, expert: false },
];

const placed: HTMLElement[] = [];

/**
 * Puts a heading for every entry in the page, at the given distances from the
 * top of the viewport (far below it by default). jsdom's page has no height,
 * so it always counts as scrolled to the bottom: keep unread headings below
 * the viewport (768 px).
 */
function placeHeadings(tops: Record<string, number>) {
  const made = placed;
  for (const entry of entries) {
    const heading = document.createElement(entry.depth === 2 ? "h2" : "h3");
    heading.id = entry.id;
    const top = tops[entry.id] ?? 5000;
    heading.getBoundingClientRect = () => ({ top, bottom: top + 30, left: 0, right: 0, width: 0, height: 30, x: 0, y: top, toJSON: () => ({}) });
    document.body.appendChild(heading);
    made.push(heading);
  }
}

afterEach(() => {
  placed.splice(0).forEach((heading) => heading.remove());
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("<LessonToc />", () => {
  it("is a named navigation landmark with nested lists of anchor links", () => {
    render(<LessonToc entries={entries} />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    const hrefs = within(nav).getAllByRole("link", { hidden: true }).map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(entries.map((entry) => `#${entry.id}`));
    const column = screen.getByTestId("lesson-toc-column");
    expect(column).toHaveClass("hidden", "xl:block");
  });

  it("marks the expert layer with a quiet text tag, not colour alone", () => {
    render(<LessonToc entries={entries} />);
    const expert = screen.getByRole("link", { name: "Expert: clause 16.14 corner cases", hidden: true });
    expect(expert).toHaveTextContent(/^Expert\s+clause 16\.14 corner cases$/);
    expect(screen.getByRole("link", { name: "Expert: Push Further", hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quick Take", hidden: true })).not.toHaveTextContent("Expert");
  });

  it("keeps every layer open in the column, so following the reader never reflows it; the reader can still close one", () => {
    placeHeadings({ "quick-take": -900, "build-your-mental-model": -400, "the-problem": 60 });
    render(<LessonToc entries={entries} />);
    const column = screen.getByTestId("lesson-toc-column");
    for (const name of ["Sections in Build Your Mental Model", "Sections in Push Further"]) {
      expect(within(column).getByRole("button", { name }), name).toHaveAttribute("aria-expanded", "true");
    }
    const toggle = within(column).getByRole("button", { name: "Sections in Build Your Mental Model" });
    const children = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(children).not.toHaveAttribute("hidden");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(children).toHaveAttribute("hidden");
    fireEvent.click(toggle);
    expect(children).not.toHaveAttribute("hidden");
  });

  it("opens only the layer holding the current section in the sheet, until the reader opens another", () => {
    placeHeadings({ "quick-take": -900, "build-your-mental-model": -400, "the-problem": 60, "expert-clause-1614-corner-cases": 1200 });
    render(<LessonToc entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /^On this page/ }));
    const sheet = screen.getByRole("dialog", { name: "On this page" });
    expect(within(sheet).getByRole("button", { name: "Sections in Build Your Mental Model" })).toHaveAttribute("aria-expanded", "true");
    const other = within(sheet).getByRole("button", { name: "Sections in Push Further" });
    expect(other).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(other.getAttribute("aria-controls")!)).toHaveAttribute("hidden");
    fireEvent.click(other);
    expect(other).toHaveAttribute("aria-expanded", "true");
  });

  it("follows the reader: the section past the reading line is current", () => {
    placeHeadings({ "quick-take": -900, "build-your-mental-model": -400, "the-problem": 60, "expert-clause-1614-corner-cases": 1200 });
    render(<LessonToc entries={entries} />);
    const current = screen.getByRole("link", { name: "The problem", hidden: true });
    expect(current).toHaveAttribute("aria-current", "location");
    // The current entry is a raised row with a 2 px accent edge, not an accent fill, and
    // keeps the weight of the other rows, so its label never rewraps and moves the rows under it.
    expect(current).toHaveClass("bg-muted", "border-l-2", "border-primary", "text-foreground");
    expect(current).not.toHaveClass("font-medium");
    expect(current.className).not.toMatch(/bg-primary/);
    // The bar names the section being read.
    expect(screen.getByRole("button", { name: /^On this page/ })).toHaveAccessibleName("On this page: The problem");
  });

  it("draws the Expert tag as an outlined tag in the tier 4 colour, beside the word", () => {
    render(<LessonToc entries={entries} />);
    const tag = within(screen.getByRole("link", { name: "Expert: Push Further", hidden: true })).getByText("Expert");
    expect(tag).toHaveClass("border", "border-tier-4-border", "text-tier-4", "rounded");
  });

  it("names the section count in the bar before the first heading is reached", () => {
    render(<LessonToc entries={entries} />);
    const bar = screen.getByRole("button", { name: /^On this page/ });
    expect(bar).toHaveAccessibleName(`On this page ${tocSummary(entries)}`);
    expect(tocSummary(entries)).toBe("7 sections, 3 expert");
    expect(bar).toHaveAttribute("aria-haspopup", "dialog");
    expect(bar.parentElement).toHaveClass("h-11", "xl:hidden");
  });

  it("opens the contents as a modal sheet; Escape closes it and focus returns to the bar", () => {
    render(<LessonToc entries={entries} />);
    const bar = screen.getByRole("button", { name: /^On this page/ });
    expect(bar).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(bar);

    const dialog = screen.getByRole("dialog", { name: "On this page" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(bar).toHaveAttribute("aria-expanded", "true");
    expect(bar).toHaveAttribute("aria-controls", dialog.id);
    // The sheet is inside the nav, so the "t" shortcut and the landmark find its links.
    expect(screen.getByRole("navigation", { name: "On this page" })).toContainElement(dialog);
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(bar).toHaveAttribute("aria-expanded", "false");
    expect(bar).toHaveFocus();
  });

  it("closes the sheet from its close button", () => {
    render(<LessonToc entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /^On this page/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the sheet, then moves to and focuses the heading when an entry is chosen", () => {
    placeHeadings({});
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    const scrollIntoView = vi.fn();
    const heading = document.getElementById("push-further")!;
    heading.scrollIntoView = scrollIntoView;

    render(<LessonToc entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /^On this page/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Expert: Push Further" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => frames.forEach((frame) => frame(0)));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(heading).toHaveFocus();
    expect(window.location.hash).toBe("#push-further");
  });

  it("renders nothing without entries", () => {
    const { container } = render(<LessonToc entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
