import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BeforeYouStart } from "@/components/mdx/BeforeYouStart";
import { getMdxComponents, mdxComponents } from "@/generated/mdx-component-registry";
import { curriculumData } from "@/lib/curriculum-data";

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<"a">, "href"> & { href: string }>;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const section = (moduleId: string) => curriculumData.flatMap((tier) => tier.sections).find((entry) => entry.slug === moduleId)!;
const indexHref = (moduleId: string) => {
  const tier = curriculumData.find((entry) => entry.sections.some((candidate) => candidate.slug === moduleId))!;
  return `/curriculum/${tier.slug}/${moduleId}/index`;
};

describe("<BeforeYouStart />", () => {
  it("is registered for lessons", () => {
    expect(mdxComponents).toHaveProperty("BeforeYouStart");
  });

  it("links a module page's manifest prerequisites with canonical URLs", () => {
    render(<BeforeYouStart lesson="/curriculum/T2_Intermediate/I-SV-1_OOP/index" />);
    const line = screen.getByTestId("before-you-start");
    expect(line).toHaveTextContent(/^Before you start:/);
    const prerequisites = section("I-SV-1_OOP").prerequisites ?? [];
    expect(prerequisites.length).toBeGreaterThan(0);
    expect(within(line).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(prerequisites.map(indexHref));
  });

  it("names the previous page first on a later page of a module", () => {
    render(<BeforeYouStart lesson={["T2_Intermediate", "I-UVM-3B_Advanced_Sequencing_and_Layering", "virtual-sequences"]} />);
    const links = within(screen.getByTestId("before-you-start")).getAllByRole("link");
    const lessons = section("I-UVM-3B_Advanced_Sequencing_and_Layering").topics.map((topic) => topic.slug);
    const previous = lessons[lessons.indexOf("virtual-sequences") - 1];
    expect(links[0]).toHaveAttribute("href", `/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/${previous}`);
    expect(screen.getByTestId("before-you-start")).toHaveTextContent("(the previous lesson in this module)");
    expect(links[1]).toHaveAttribute("href", "/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index");
  });

  it("says when a lesson has no prerequisites", () => {
    render(<BeforeYouStart lesson="T1_Foundational/F1A_The_Cost_of_Bugs/index" />);
    expect(screen.getByTestId("before-you-start")).toHaveTextContent("Before you start: no prerequisites. This lesson is a starting point.");
    expect(within(screen.getByTestId("before-you-start")).queryAllByRole("link")).toHaveLength(0);
  });

  it("renders with no props in a lesson: the page supplies the current lesson", () => {
    const { BeforeYouStart: Bound } = getMdxComponents([], {
      lessonSlug: ["T4_Expert", "E-PWR-1_Power_Aware_Verification", "index"],
    }) as typeof mdxComponents;
    render(<Bound />);
    expect(within(screen.getByTestId("before-you-start")).getAllByRole("link")[0]).toHaveAttribute(
      "href",
      "/curriculum/T2_Intermediate/I-SV-8_Power_Intent_and_UPF/index",
    );
  });

  it("lets an explicit lesson prop override the page's lesson", () => {
    const { BeforeYouStart: Bound } = getMdxComponents([], {
      lessonSlug: ["T4_Expert", "E-PWR-1_Power_Aware_Verification", "index"],
    }) as typeof mdxComponents;
    render(<Bound lesson="/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index" />);
    expect(screen.getByTestId("before-you-start")).toHaveTextContent("no prerequisites");
  });

  it("renders nothing without a lesson, or for a path that is not a lesson", () => {
    const { container, rerender } = render(<BeforeYouStart />);
    expect(container).toBeEmptyDOMElement();
    rerender(<BeforeYouStart lesson="/curriculum/does-not-exist" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is valid inside a paragraph (a block-level span, not a <p>)", () => {
    render(
      <p>
        <BeforeYouStart lesson="T1_Foundational/F1B_The_Verification_Mindset/index" />
      </p>,
    );
    expect(screen.getByTestId("before-you-start").tagName).toBe("SPAN");
  });
});
