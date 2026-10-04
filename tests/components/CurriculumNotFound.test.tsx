import React from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CurriculumNotFound from "@/components/curriculum/CurriculumNotFound";

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
    const suggestions = within(heading.parentElement as HTMLElement).getAllByRole("link");
    expect(suggestions[0]).toHaveAttribute("href", "/curriculum/T2_Intermediate/I-SV-1_OOP/index");
    expect(suggestions[0].textContent).toMatch(/^I-SV-1: /);
  });
});
