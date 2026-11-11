import React from "react";
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CurriculumNotFound, { BLOCK_LINK_CLASS, FindYourWayBack } from "@/components/curriculum/CurriculumNotFound";

let mockPathname = "/curriculum/does-not-exist";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
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

/** The component reads the address the browser requested once it has mounted. */
function visit(pathname: string) {
  mockPathname = pathname;
  window.history.pushState({}, "", pathname);
}

beforeEach(() => {
  visit("/curriculum/does-not-exist");
});

describe("<CurriculumNotFound />", () => {
  it("reserves the requested-address line in the server HTML, so nothing below it moves after hydration", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<CurriculumNotFound />);
    const line = host.querySelector('[data-testid="not-found-address"]');
    expect(line).not.toBeNull();
    expect(line).toHaveClass("invisible");
    expect(line).toHaveAttribute("aria-hidden", "true");
  });


  it("explains the 404 and offers the ways back into the curriculum, with search tips", async () => {
    render(<CurriculumNotFound />);
    expect(await screen.findByText("/curriculum/does-not-exist")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    // feature-flags.spec.ts checks this sentence on 404 pages.
    expect(screen.getByText("This page could not be found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Curriculum overview" })).toHaveAttribute("href", "/curriculum");
    expect(screen.getByRole("link", { name: "Start at the first lesson" })).toHaveAttribute(
      "href",
      "/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index",
    );
    expect(screen.getByRole("heading", { name: "Search tips" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Did you mean" })).toBeNull();
  });

  it('suggests the lesson a broken link meant ("did you mean")', async () => {
    visit("/T2_Intermediate/I-SV-1_OOP");
    render(<CurriculumNotFound />);
    const heading = await screen.findByRole("heading", { name: "Did you mean" });
    const suggestions = within(heading.closest("[data-section]") as HTMLElement).getAllByRole("link");
    expect(suggestions[0]).toHaveAttribute("href", "/curriculum/T2_Intermediate/I-SV-1_OOP/index");
    expect(suggestions[0].textContent).toMatch(/^I-SV-1: /);
  });

  it("sits on the page frame: a reading-width PageShell with PageHeader and Sections, and no card", async () => {
    render(<CurriculumNotFound />);
    const heading = await screen.findByRole("heading", { level: 1, name: "Page not found" });
    expect(heading).toHaveClass("text-h1", "text-foreground");
    const shell = screen.getByTestId("not-found");
    expect(shell.tagName).toBe("SECTION");
    expect(shell).toHaveAttribute("data-page-shell");
    expect(shell).toHaveAttribute("data-width", "reading");
    expect(shell).toHaveAttribute("aria-labelledby", "not-found-title");
    expect(heading).toHaveAttribute("id", "not-found-title");
    expect(heading.closest("[data-page-header]")).not.toBeNull();
    // No whole-page card and no second centred container inside the frame.
    expect(shell.querySelector(".bg-card, .rounded-2xl, .mx-auto")).toBeNull();
    for (const name of ["Find your way back", "Search tips"]) {
      const sectionHeading = screen.getByRole("heading", { level: 2, name });
      expect(sectionHeading.closest("[data-section]")).not.toBeNull();
    }
    const eyebrow = screen.getByTestId("not-found-eyebrow");
    expect(eyebrow).toHaveTextContent("Error 404");
    expect(eyebrow.closest("[data-page-header-eyebrow]")).not.toBeNull();
    expect(eyebrow).not.toHaveClass("uppercase", "tracking-wide", "tracking-wider");
  });

  it("shows the requested address in the header's meta row", async () => {
    render(<CurriculumNotFound />);
    const code = await screen.findByText("/curriculum/does-not-exist");
    expect(code.closest("[data-page-header-meta]")).not.toBeNull();
  });

  it("gives each way back a block-level accent link, 40 px tall from padding, never inline-flex in running text", () => {
    render(<FindYourWayBack />);
    for (const name of ["Curriculum overview", "Start at the first lesson", "Practice hub"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveClass("block", "py-2.5", "leading-5", "text-primary", "hover:underline");
      expect(link).not.toHaveClass("inline-flex", "min-h-10");
      // The description is its own paragraph, so it wraps on its own line height.
      expect(link.nextElementSibling?.tagName).toBe("P");
    }
    expect(BLOCK_LINK_CLASS).not.toMatch(/inline-flex|min-h-10/);
  });
});
