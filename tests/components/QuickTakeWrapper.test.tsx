import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => null, useRouter: () => ({ push: vi.fn() }) }));

import { mdxComponents } from "@/generated/mdx-component-registry";

describe("QuickTake MDX wrapper", () => {
  it("is a token callout with a 2 px accent leading edge and a foreground label", () => {
    const QuickTake = mdxComponents.QuickTake as React.ComponentType<{ children?: React.ReactNode }>;
    render(
      <QuickTake>
        <p>Body</p>
      </QuickTake>,
    );
    const box = screen.getByTestId("quick-take");
    expect(box).toHaveClass("rounded-xl", "border-l-2", "border-l-primary", "bg-muted");
    expect(box.className).not.toMatch(/blue-/);
    const label = screen.getByText("Quick Take");
    expect(label).toHaveClass("text-label", "text-foreground");
    expect(label.className).not.toMatch(/uppercase|tracking-/);
  });
});
