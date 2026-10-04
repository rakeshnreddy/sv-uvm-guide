import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: { src: string; alt: string } & Record<string, unknown>) => {
    const { src, alt, fill: _fill, priority: _priority, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    return <img src={src} alt={alt} {...rest} />;
  },
}));

import HallOfShameCarousel, { HALL_OF_SHAME_INCIDENTS } from "@/components/curriculum/f1/HallOfShameCarousel";

afterEach(() => {
  vi.useRealTimers();
});

const slide = () => screen.getByRole("article");

describe("HallOfShameCarousel: verified content", () => {
  it("every default card cites at least one https source", () => {
    for (const item of HALL_OF_SHAME_INCIDENTS) {
      expect(item.sources?.length, item.title).toBeGreaterThan(0);
      item.sources?.forEach((s) => expect(s.url, item.title).toMatch(/^https:\/\//));
    }
  });

  it("keeps the verified numbers and drops the unverifiable ones", () => {
    const [fdiv, ariane, spectre] = HALL_OF_SHAME_INCIDENTS;
    expect(fdiv.impact).toContain("$475 million");
    expect(fdiv.impact).toContain("fourth quarter of 1994");
    expect(fdiv.story).toContain("1 in 9 billion");
    expect(fdiv.impact).not.toMatch(/\$1B|~\$1B|today/);
    // The Ariane inquiry report states no cost, so the card must not invent one.
    expect(`${ariane.story} ${ariane.impact}`).not.toMatch(/\$\s?\d/);
    expect(ariane.story).toContain("64-bit floating-point");
    expect(ariane.story).toContain("16-bit signed integer");
    expect(ariane.impact).toContain("Cluster");
    expect(spectre.story).toContain("3 January 2018");
    expect(spectre.impact).not.toMatch(/fundamental rethink/i);
  });

  it("renders source links that open safely in a new tab", () => {
    render(<HallOfShameCarousel />);
    const links = within(slide()).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", expect.stringContaining("noopener"));
    });
  });
});

describe("HallOfShameCarousel: interaction and accessibility", () => {
  it("never advances on its own", () => {
    vi.useFakeTimers();
    render(<HallOfShameCarousel />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/\(1 of 3\)$/));
  });

  it("moves with the buttons, the dots and the arrow keys, and wraps around", () => {
    render(<HallOfShameCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "Next incident" }));
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Ariane 5/));
    expect(screen.getByRole("button", { name: /Go to incident 2:/ })).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(screen.getByRole("button", { name: "Next incident" }), { key: "ArrowRight" });
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Spectre/));
    fireEvent.keyDown(slide(), { key: "ArrowRight" });
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Intel Pentium/));
    fireEvent.click(screen.getByRole("button", { name: "Previous incident" }));
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Spectre/));

    fireEvent.click(screen.getByRole("button", { name: /Go to incident 1:/ }));
    expect(screen.getByText(/Incident 1 of 3: Intel Pentium/)).toBeInTheDocument();
  });

  it("hides the lesson until the learner asks for it, and resets it on the next card", () => {
    render(<HallOfShameCarousel />);
    const reveal = screen.getByRole("button", { name: /What check would have caught it/ });
    expect(reveal).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/equivalence check of the table/)).not.toBeVisible();
    fireEvent.click(reveal);
    expect(screen.getByRole("button", { name: "Hide the lesson" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/equivalence check of the table/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next incident" }));
    expect(screen.getByRole("button", { name: /What check would have caught it/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("still accepts items from a lesson and says when a card has no source", () => {
    render(<HallOfShameCarousel items={[{ title: "Example Bug", story: "Story.", impact: "Delay." }]} />);
    expect(screen.getByText("Example Bug")).toBeInTheDocument();
    expect(screen.getByText("No source given for this card.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next incident" })).toBeDisabled();
  });
});
