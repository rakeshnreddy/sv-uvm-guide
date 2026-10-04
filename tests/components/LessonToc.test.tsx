import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LessonToc from "@/components/curriculum/LessonToc";
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";

const entries: TocEntry[] = [
  { id: "quick-take", text: "Quick Take", depth: 2, expert: false },
  { id: "build-your-mental-model", text: "Build Your Mental Model", depth: 2, expert: false },
  { id: "expert-clause-1614-corner-cases", text: "Expert: clause 16.14 corner cases", depth: 3, expert: true },
  { id: "push-further", text: "Push Further", depth: 2, expert: true },
  { id: "scale", text: "Scale", depth: 3, expert: true },
  { id: "reinforce-the-essentials", text: "Reinforce the essentials", depth: 2, expert: false },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<LessonToc />", () => {
  it("is a named navigation landmark with nested lists of anchor links", () => {
    render(<LessonToc entries={entries} />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    const topLevel = within(nav).getAllByRole("list")[0];
    expect(within(topLevel).getAllByRole("listitem", { hidden: true }).length).toBeGreaterThanOrEqual(4);
    const hrefs = within(nav).getAllByRole("link", { hidden: true }).map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(entries.map((entry) => `#${entry.id}`));
  });

  it("marks the expert layer with a text badge, not colour alone", () => {
    render(<LessonToc entries={entries} />);
    const expert = screen.getByRole("link", { name: "Expert: clause 16.14 corner cases", hidden: true });
    // The badge is visible text ("Expert"), so the marking survives without colour.
    expect(expert).toHaveTextContent(/^Expert\s+clause 16\.14 corner cases$/);
    expect(screen.getByRole("link", { name: "Expert: Push Further", hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quick Take", hidden: true })).not.toHaveTextContent("Expert");
  });

  it("works as a disclosure below xl: the button toggles aria-expanded, Escape closes and refocuses it", () => {
    render(<LessonToc entries={entries} />);
    const button = screen.getByRole("button", { name: /On this page/ });
    const list = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(list.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(list.className).toContain("xl:block");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(list.className).not.toMatch(/(^|\s)hidden(\s|$)/);

    const link = within(list).getByRole("link", { name: "Quick Take" });
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();

    fireEvent.click(button);
    fireEvent.click(within(list).getByRole("link", { name: "Quick Take" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the section being read with aria-current", () => {
    let callback: IntersectionObserverCallback = () => undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const heading = document.createElement("h2");
    heading.id = "push-further";
    document.body.appendChild(heading);

    render(<LessonToc entries={entries} />);
    act(() => {
      callback([{ target: heading, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(screen.getByRole("link", { name: "Expert: Push Further", hidden: true })).toHaveAttribute("aria-current", "location");
    heading.remove();
  });

  it("renders nothing without entries", () => {
    const { container } = render(<LessonToc entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
