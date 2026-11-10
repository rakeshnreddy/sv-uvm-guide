import fs from "node:fs";
import path from "node:path";
import React from "react";
import { compileMDX } from "next-mdx-remote/rsc";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import CurriculumNotFound, { BLOCK_LINK_CLASS } from "@/components/curriculum/CurriculumNotFound";
import { lessonScrollRegionComponents, ScrollRegion } from "@/components/curriculum/ScrollRegion";
import { Input } from "@/components/ui/Input";
import { SelectTrigger, Select, SelectValue } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { LESSON_PRACTICE_SLOT, lessonRemarkPlugins } from "@/lib/curriculum/lesson-mdx";
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";

vi.mock("next/navigation", () => ({
  usePathname: () => "/no-such-page",
}));

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<"a">, "href"> & { href: string }>;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The root not-found page wraps itself in the learning layout; only its metadata is under test here.
vi.mock("@/app/(learning)/layout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("form fields use 16 px text on phones (no iOS zoom on focus) and 14 px from md", () => {
  it("Input", () => {
    render(<Input aria-label="Name" />);
    const field = screen.getByRole("textbox", { name: "Name" });
    expect(field).toHaveClass("text-base", "md:text-sm");
    expect(field).not.toHaveClass("text-sm");
  });

  it("Textarea", () => {
    render(<Textarea aria-label="Notes" />);
    const field = screen.getByRole("textbox", { name: "Notes" });
    expect(field).toHaveClass("text-base", "md:text-sm");
    expect(field).not.toHaveClass("text-sm");
  });

  it("SelectTrigger", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Theme">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Theme" });
    expect(trigger).toHaveClass("text-base", "md:text-sm");
    expect(trigger).not.toHaveClass("text-sm");
  });
});

describe("small reveal and hint buttons are at least 40 px tall", () => {
  it("PredictionPrompt's reveal button", () => {
    render(
      <PredictionPrompt
        question="Which?"
        options={[
          { id: "a", label: "A", correct: true, feedback: "Because." },
          { id: "b", label: "B", correct: false, feedback: "No." },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Reveal without predicting" })).toHaveClass("inline-flex", "min-h-10", "items-center");
  });

  it("HintLadder's hint button", () => {
    render(<HintLadder hints={["one"]} />);
    expect(screen.getByRole("button", { name: /Need a hint/ })).toHaveClass("inline-flex", "min-h-10", "items-center");
  });

  it("every 'Reveal without predicting' button in src has a 40 px minimum height", () => {
    const srcDir = path.resolve(__dirname, "../../src");
    const files = fs
      .readdirSync(srcDir, { recursive: true, encoding: "utf8" })
      .filter((rel) => rel.endsWith(".tsx"))
      .map((rel) => path.join(srcDir, rel));

    const found: string[] = [];
    const unsized: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      // A <button ...> opening tag (arrow functions in its props included) followed by the label text.
      const buttons = source.matchAll(/<button\b((?:=>|[^>])*)>\s*Reveal without predicting\s*</g);
      for (const match of buttons) {
        const attrs = match[1];
        let classes = attrs.match(/className="([^"]*)"/)?.[1];
        const constName = attrs.match(/className=\{(\w+)\}/)?.[1];
        if (classes === undefined && constName) {
          classes = source.match(new RegExp(`const ${constName}\\s*=\\s*"([^"]*)"`))?.[1];
        }
        const where = path.relative(srcDir, file);
        found.push(where);
        if (!classes || !/(^|\s)min-h-10(\s|$)/.test(classes)) unsized.push(where);
      }
    }

    expect(found.length).toBeGreaterThanOrEqual(10);
    expect(unsized).toEqual([]);
  });
});

describe("404 page", () => {
  it("has its own title", async () => {
    const { metadata } = await import("@/app/not-found");
    expect(metadata.title).toBe("Page not found");
  });

  it("gives every link a 40 px minimum height", () => {
    render(<CurriculumNotFound />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    // Block links: 20 px line height plus py-2.5 (10 px top and bottom) gives a 40 px target.
    for (const link of links) {
      expect(link).toHaveClass(...BLOCK_LINK_CLASS.split(/\s+/).filter(Boolean));
      expect(link).toHaveClass("block", "py-2.5", "leading-5");
      expect(link).not.toHaveClass("inline-flex");
    }
  });
});

describe("lesson code blocks and tables scroll in a focusable, labelled region", () => {
  async function renderMdx(source: string) {
    const toc: TocEntry[] = [];
    const { content } = await compileMDX({
      source,
      components: { ...lessonScrollRegionComponents, [LESSON_PRACTICE_SLOT]: () => null },
      // The lesson page's own Markdown plugins (GitHub tables among them).
      options: { mdxOptions: { remarkPlugins: lessonRemarkPlugins({ toc, hasFlashcards: false, hasHandsOn: false }) } },
    });
    const html = renderToStaticMarkup(content);
    const host = document.createElement("div");
    host.innerHTML = html;
    return host;
  }

  it("wraps a fenced code block", async () => {
    const host = await renderMdx("```systemverilog\nclass a_very_long_name extends uvm_component; endclass\n```\n");
    const region = host.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveAttribute("aria-label", "Code sample");
    expect(region?.className).toContain("overflow-x-auto");
    expect(region?.className).toContain("focus-visible:ring-2");
    const pre = region?.querySelector("pre");
    expect(pre?.querySelector("code")?.textContent).toContain("a_very_long_name");
    expect(pre?.className).toContain("w-max");
  });

  it("wraps a table and keeps table semantics", async () => {
    const host = await renderMdx("| Phase | Purpose |\n| --- | --- |\n| build | create components |\n");
    const region = host.querySelector('[role="region"]');
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveAttribute("aria-label", "Table");
    const table = region?.querySelector("table");
    expect(table).not.toBeNull();
    // Nothing turns the table into a block box (no override class and no
    // `.prose table { display: block }` rule), so it keeps table semantics.
    expect(table?.className).not.toMatch(/(^|\s)!?(block|table)(\s|$)/);
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).not.toMatch(/\.prose\s+table\s*\{[^}]*display\s*:\s*block/);
    expect(table?.querySelectorAll("th")).toHaveLength(2);
    expect(table?.querySelectorAll("tbody td")).toHaveLength(2);
  });

  it("is a Tab stop only while its content overflows", () => {
    const widths = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get");
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    try {
      widths.mockReturnValue(300);
      const fits = render(<ScrollRegion label="Code sample">short</ScrollRegion>);
      expect(fits.queryByRole("region")).toBeNull();
      const plain = fits.container.querySelector("[data-scroll-region]");
      expect(plain).toHaveAttribute("data-scroll-region", "fits");
      expect(plain).not.toHaveAttribute("tabindex");
      fits.unmount();

      widths.mockReturnValue(900);
      const wide = render(<ScrollRegion label="Code sample">a very long line</ScrollRegion>);
      const region = wide.getByRole("region", { name: "Code sample" });
      expect(region).toHaveAttribute("tabindex", "0");
      wide.unmount();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
