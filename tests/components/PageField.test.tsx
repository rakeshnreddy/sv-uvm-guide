import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/curriculum" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

import PageFieldDefault, { PageField, RoutePageField, pageFieldForPath } from "@/components/layout/PageField";

const field = (container: HTMLElement) => container.querySelector("[data-page-field]") as HTMLElement;

/*
 * The colour field (DESIGN.md section 11): one empty decorative element; the
 * look is static CSS in globals.css.
 */
describe("PageField", () => {
  it("renders one empty, hidden, decorative element with the four-tier field by default", () => {
    const { container } = render(<PageField />);
    const el = field(container);
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("data-page-field", "all");
    expect(el).not.toHaveAttribute("data-tier");
    expect(el).not.toHaveAttribute("data-field-size");
    expect(el).toBeEmptyDOMElement();
    expect(container.children).toHaveLength(1);
    expect(PageFieldDefault).toBe(PageField);
  });

  it("leads with one tier's colour for variant tier, at header size when asked", () => {
    const { container } = render(<PageField variant="tier" tier={3} size="header" />);
    const el = field(container);
    expect(el).toHaveAttribute("data-page-field", "tier");
    expect(el).toHaveAttribute("data-tier", "3");
    expect(el).toHaveAttribute("data-field-size", "header");
  });

  it("falls back to the four-tier field when variant tier has no tier", () => {
    const { container } = render(<PageField variant="tier" />);
    expect(field(container)).toHaveAttribute("data-page-field", "all");
    expect(field(container)).not.toHaveAttribute("data-tier");
  });
});

describe("pageFieldForPath and RoutePageField", () => {
  it("gives lesson pages their tier's field at header size and every other page the full field", () => {
    expect(pageFieldForPath("/curriculum/T2_Intermediate/I-SV-1_OOP/index")).toEqual({ variant: "tier", tier: 2, size: "header" });
    expect(pageFieldForPath("/curriculum/t4-expert/e-dbg-1-advanced-uvm-debug-methodologies/hang-lab")).toEqual({
      variant: "tier",
      tier: 4,
      size: "header",
    });
    for (const path of ["/curriculum", "/curriculum/expert-index", "/practice", "/dashboard", "/", null]) {
      expect(pageFieldForPath(path), String(path)).toEqual({ variant: "all", size: "hub" });
    }
  });

  it("reads the route", () => {
    pathname.value = "/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index";
    const { container, rerender } = render(<RoutePageField />);
    expect(field(container)).toHaveAttribute("data-tier", "1");
    expect(field(container)).toHaveAttribute("data-field-size", "header");
    pathname.value = "/practice";
    rerender(<RoutePageField />);
    expect(field(container)).toHaveAttribute("data-page-field", "all");
  });
});

describe("the lesson field geometry in globals.css", () => {
  const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  const rule = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf("}", start));
  };

  it("keeps the header-size field within 24rem, so it has faded before the article's first paragraph", () => {
    const header = rule('[data-page-field][data-field-size="header"]');
    const rem = parseFloat(/height:\s*([\d.]+)rem/.exec(header)?.[1] ?? "NaN");
    expect(rem).toBeLessThanOrEqual(24);
    expect(header).toMatch(/mask-image:\s*linear-gradient\(to bottom, #000 \d+%, transparent\)/);
  });

  it("centres the tier's colour below the header bar and on the left, with the neighbour on the right", () => {
    const tier = rule('[data-page-field="tier"]');
    const centres = [...tier.matchAll(/at (\d+)% (\d+)%/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(centres).toHaveLength(2);
    const [[curX, curY], [nearX]] = centres;
    expect(curX).toBeLessThan(50);
    expect(curY).toBeGreaterThanOrEqual(40);
    expect(nearX).toBeGreaterThan(70);
    // No stop is stronger than the field token, so the contrast test's worst case still holds.
    expect(tier).not.toMatch(/alpha\)\s*\*\s*(1\.[0-9]|[2-9])/);
  });
});
