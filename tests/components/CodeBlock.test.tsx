import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MdxCodeBlock, fenceLanguage, fenceSource } from "@/components/mdx/MdxCodeBlock";
import { CODE_BLOCK_LINE_NUMBER_CLASS, CodeBlock } from "@/components/ui/CodeBlock";
import { COPY_RESET_MS } from "@/components/ui/CodeBlockFrame";
import { ANNOUNCE_DELAY_MS, LIVE_ANNOUNCER_ATTRIBUTE } from "@/components/ui/live-announcer";
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

const longListing = (lines: number) => Array.from({ length: lines }, (_, i) => `logic l${i};`).join("\n");

describe("CodeBlock chrome", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("is highlighted in the server HTML, with no loading state", () => {
    const html = renderToStaticMarkup(<CodeBlock code={"class a; endclass"} language="systemverilog" />);
    expect(html).not.toMatch(/Loading code/);
    expect(html).toContain(`<span style="color:${CODE_SURFACE_TEXT.keyword}">class</span>`);
    expect(html).toContain("SystemVerilog");
  });

  it("labels the language and keeps the code text exact", () => {
    render(<CodeBlock code={"  module m;\n    wire w;\n  endmodule\n"} language="systemverilog" />);
    const block = screen.getByTestId("code-block");
    expect(block).toHaveAttribute("data-language", "systemverilog");
    expect(block.querySelector("[data-code-language-label]")).toHaveTextContent("SystemVerilog");
    expect(block.querySelector("code")?.textContent).toBe("  module m;\n    wire w;\n  endmodule");
    expect(block).toHaveClass("not-prose", "bg-code-surface", "border-code-border");
  });

  it("copies the listing and shows a copied state with its accessible name", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.useFakeTimers();
    document.querySelector(`[${LIVE_ANNOUNCER_ATTRIBUTE}]`)?.remove();
    render(<CodeBlock code={"logic a;\nlogic b;"} language="systemverilog" showLineNumbers />);
    // An idle code block carries no live region of its own.
    expect(screen.queryByRole("status")).toBeNull();
    const button = screen.getByRole("button", { name: "Copy code to clipboard" });
    await act(async () => {
      fireEvent.click(button);
    });
    // Line numbers are CSS counters, so they never reach the clipboard.
    expect(writeText).toHaveBeenCalledWith("logic a;\nlogic b;");
    expect(screen.getByRole("button", { name: "Copied to clipboard" })).toHaveAttribute("data-copy-state", "copied");
    // One shared live region for the page, not one per code block.
    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    });
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Code copied to clipboard");
    act(() => {
      vi.advanceTimersByTime(COPY_RESET_MS);
    });
    expect(screen.getByRole("button", { name: "Copy code to clipboard" })).toBeInTheDocument();
  });

  it("says so when the clipboard refuses", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    render(<CodeBlock code="logic a;" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy code to clipboard" }));
    });
    expect(screen.getByRole("button", { name: /Copy failed/ })).toHaveAttribute("data-copy-state", "failed");
  });

  it("opens a listing over 40 lines in a 28 rem window with a real toggle", () => {
    render(<CodeBlock code={longListing(41)} language="systemverilog" />);
    const block = screen.getByTestId("code-block");
    const toggle = screen.getByRole("button", { name: "Show all 41 lines" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const body = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(body).not.toBeNull();
    expect(body).toHaveClass("max-h-[28rem]", "overflow-auto");
    // Collapsed, the window scrolls, so it stays a keyboard-focusable, labelled region.
    expect(body).toHaveAttribute("tabindex", "0");
    expect(body).toHaveAttribute("role", "region");
    expect(body).toHaveAttribute("aria-label", "SystemVerilog code");
    expect(block).toHaveAttribute("data-collapsed", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("Show fewer lines");
    expect(body).not.toHaveClass("max-h-[28rem]");
    expect(block).toHaveAttribute("data-collapsed", "false");
  });

  it("has no toggle at 40 lines or fewer", () => {
    render(<CodeBlock code={longListing(40)} />);
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
    expect(screen.getByTestId("code-block")).not.toHaveAttribute("data-collapsed");
  });

  it("is a Tab stop only while the listing scrolls", () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    render(<CodeBlock code="logic a;" />);
    const body = screen.getByTestId("code-block").querySelector("[data-scroll-region]");
    expect(body).toHaveAttribute("data-scroll-region", "fits");
    expect(body).not.toHaveAttribute("tabindex");
  });

  it("numbers lines with a CSS counter only when asked", () => {
    const { container, rerender } = render(<CodeBlock code={"a\nb"} language="text" />);
    expect(container.querySelector("[data-line]")?.className ?? "").not.toContain("counter-increment");
    rerender(<CodeBlock code={"a\nb"} language="text" showLineNumbers />);
    expect(container.querySelector("[data-line]")).toHaveClass(...CODE_BLOCK_LINE_NUMBER_CLASS.split(" "));
    expect(container.querySelector("pre")?.style.counterReset).toBe("line");
  });

  it("passes lineProps to each line", () => {
    render(<CodeBlock code={"a\nb"} language="text" lineProps={(n) => (n === 2 ? { "aria-current": "true" } as React.HTMLAttributes<HTMLElement> : {})} />);
    const lines = screen.getByTestId("code-block").querySelectorAll("[data-line]");
    expect(lines[1]).toHaveAttribute("aria-current", "true");
    expect(lines[0]).toHaveClass("block");
  });
});

describe("MdxCodeBlock (fenced code in lessons)", () => {
  const fence = (language: string | undefined, code: string) => (
    <MdxCodeBlock>
      <code className={language ? `language-${language}` : undefined}>{code}</code>
    </MdxCodeBlock>
  );

  it("reads the fence's language and text", () => {
    expect(fenceLanguage("language-systemverilog")).toBe("systemverilog");
    expect(fenceLanguage("hljs language-bash")).toBe("bash");
    expect(fenceLanguage(undefined)).toBe("");
    expect(fenceSource(<code className="language-tcl">{"puts hi\n"}</code>)).toEqual({ code: "puts hi\n", language: "tcl" });
    expect(fenceSource(<code><span>x</span></code>)).toBeNull();
  });

  it("renders a fenced block as a highlighted code block", () => {
    render(fence("systemverilog", "module m; endmodule\n"));
    const block = screen.getByTestId("code-block");
    expect(block).toHaveAttribute("data-language", "systemverilog");
    expect(block.querySelector("code span[style]")).toHaveTextContent("module");
  });

  it("labels a fence with no language as text", () => {
    render(fence(undefined, "plain\n"));
    expect(screen.getByTestId("code-block").querySelector("[data-code-language-label]")).toHaveTextContent("Text");
  });

  it("leaves a hand-written pre with markup alone", () => {
    const { container } = render(
      <MdxCodeBlock className="custom">
        <code>
          <b>bold</b>
        </code>
      </MdxCodeBlock>,
    );
    expect(container.querySelector("pre.custom b")).toHaveTextContent("bold");
    expect(screen.queryByTestId("code-block")).toBeNull();
  });
});
