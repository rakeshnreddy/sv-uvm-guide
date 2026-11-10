import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SITE_MONACO_THEME } from "@/lib/monaco-themes";

const seen = vi.hoisted(() => ({ themes: [] as (string | undefined)[] }));

// Capture the props InteractiveCode hands the editor; Monaco itself is not needed here.
vi.mock("@/components/ui/CodeEditor", () => ({
  CodeEditor: ({ theme, ariaLabel }: { theme?: string; ariaLabel?: string }) => {
    seen.themes.push(theme);
    return <pre data-testid="editor" aria-label={ariaLabel} />;
  },
}));

import { InteractiveCode } from "@/components/ui/InteractiveCode";

describe("InteractiveCode editor theme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    seen.themes = [];
  });

  it.each(["light", "dark"])("passes the one dark Monaco theme in %s mode", (mode) => {
    document.documentElement.setAttribute("data-theme", mode);
    render(<InteractiveCode code="module a; endmodule" fileName="a.sv" />);
    expect(seen.themes.length).toBeGreaterThan(0);
    expect(new Set(seen.themes)).toEqual(new Set([SITE_MONACO_THEME.dark]));
  });

  it("frames the example on the card surface and the editor on the code surface, with no glass panel", () => {
    render(<InteractiveCode code="module a; endmodule" fileName="a.sv" />);
    const root = screen.getByTestId("interactive-code");
    expect(root).toHaveClass("bg-card", "text-card-foreground", "shadow-card");
    expect(root.className).not.toMatch(/backdrop-blur|bg-white|border-white|slate-|shadow-md/);
    expect(root.querySelector(".code-section")).toHaveClass("bg-code-surface", "border-code-border");
    expect(screen.getByText("a.sv")).toHaveClass("text-code-muted", "text-label");
  });
});
