import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CodeBlock } from "@/components/ui/CodeBlock";
import { CODE_SURFACE_TEXT, codeSurfaceHljsStyle } from "@/lib/code-surface-hljs";
import { MONACO_SURFACE } from "@/lib/monaco-themes";

const fromHex = (hex: string) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = (hex: string) => {
  const [r, g, b] = fromHex(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("CodeBlock", () => {
  it("renders on the always-dark code surface with no white-alpha glass panel", () => {
    render(<CodeBlock code={"module a;\nendmodule"} fileName="a.sv" />);
    const block = screen.getByTestId("code-block");
    expect(block).toHaveClass("bg-code-surface", "rounded-xl");
    expect(block.className).not.toMatch(/bg-white|border-white|backdrop-blur|shadow-lg/);
    expect(block.querySelector(".border-b")?.className ?? "").not.toMatch(/white\//);
    // The chrome uses the code-surface roles, not slate classes or arbitrary hsl() values.
    expect(block).toHaveClass("border-code-border", "text-code-foreground");
    expect(block.querySelector(".border-b")).toHaveClass("border-code-border");
    expect(screen.getByText("a.sv")).toHaveClass("text-code-muted");
    expect(block.innerHTML).not.toMatch(/\[hsl\(|slate-/);
    expect(screen.getByText("a.sv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code to clipboard" })).toBeInTheDocument();
  });

  it("uses one fixed highlight style, whatever the site mode", () => {
    for (const mode of ["light", "dark"]) {
      document.documentElement.setAttribute("data-theme", mode);
      const { unmount } = render(<CodeBlock code="module a; endmodule" />);
      const pre = screen.getByTestId("code-block").querySelector("pre") as HTMLElement;
      expect(pre.style.color).toBe("rgb(212, 212, 212)");
      unmount();
    }
    document.documentElement.removeAttribute("data-theme");
  });

  it("keeps every highlight colour at 4.5:1 on the code surface", () => {
    const failures: string[] = [];
    for (const [key, hex] of Object.entries(CODE_SURFACE_TEXT)) {
      const ratio = contrast(hex, MONACO_SURFACE.background);
      if (ratio < 4.5) failures.push(`${key} ${hex}: ${ratio.toFixed(2)}`);
    }
    for (const [key, rule] of Object.entries(codeSurfaceHljsStyle)) {
      if (rule.color && !Object.values(CODE_SURFACE_TEXT).includes(rule.color as never)) failures.push(`${key} uses an unmeasured colour`);
    }
    expect(failures).toEqual([]);
  });
});
