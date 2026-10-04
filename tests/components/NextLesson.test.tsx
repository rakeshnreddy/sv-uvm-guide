import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NextLesson } from "@/components/mdx/NextLesson";
import { getMdxComponents, mdxComponents } from "@/generated/mdx-component-registry";
import { curriculumData, findPrevNextTopics } from "@/lib/curriculum-data";

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<"a">, "href"> & { href: string }>;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const allLessons = curriculumData.flatMap((tier) =>
  tier.sections.flatMap((section) => section.topics.map((topic) => [tier.slug, section.slug, topic.slug] as const)),
);

describe("<NextLesson />", () => {
  it("is registered for lessons", () => {
    expect(mdxComponents).toHaveProperty("NextLesson");
  });

  it("links the generated next lesson (core path) from every lesson, or ends the path", () => {
    for (const slug of allLessons) {
      render(<NextLesson lesson={slug} />);
      const line = screen.getByTestId("next-lesson");
      expect(line).toHaveTextContent(/^Next:/);
      const { next } = findPrevNextTopics([...slug]);
      if (next) {
        expect(within(line).getByRole("link"), slug.join("/")).toHaveAttribute("href", `/curriculum/${next.slug}`);
      } else {
        expect(line, slug.join("/")).toHaveTextContent(/this is the last lesson/);
        expect(within(line).getByRole("link", { name: "curriculum overview" })).toHaveAttribute("href", "/curriculum");
      }
      cleanup();
    }
  });

  it("describes the step: inside the module, to the next module, into the next tier", () => {
    render(<NextLesson lesson="/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration" />);
    expect(screen.getByTestId("next-lesson")).toHaveTextContent(/\(lesson 4 of 9 in this module\)\.$/);
    expect(within(screen.getByTestId("next-lesson")).getByRole("link")).toHaveAttribute(
      "href",
      "/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-libraries",
    );
    cleanup();

    render(<NextLesson lesson="T1_Foundational/F2C_Procedural_Code_and_Flow_Control/flow-control" />);
    expect(screen.getByTestId("next-lesson")).toHaveTextContent(/^Next: F2D: .*\(next module\)\.$/);
    cleanup();

    render(<NextLesson lesson="T2_Intermediate/I-UVM-6_UVM_Recording_Classes/index" />);
    expect(screen.getByTestId("next-lesson")).toHaveTextContent("(starts Tier 3: Advanced)");
    cleanup();

    render(<NextLesson lesson="T2_Intermediate/I-SV-8_Power_Intent_and_UPF/index" />);
    expect(screen.getByTestId("next-lesson")).toHaveTextContent("(starts Tier 3: Advanced)");
  });

  it("renders with no props in a lesson: the page supplies the current lesson", () => {
    const { NextLesson: Bound } = getMdxComponents([], {
      lessonSlug: ["T4_Expert", "E-PSS-1_Portable_Stimulus_Standard", "index"],
    }) as typeof mdxComponents;
    render(<Bound />);
    expect(within(screen.getByTestId("next-lesson")).getByRole("link")).toHaveAttribute(
      "href",
      "/curriculum/T4_Expert/E-PWR-1_Power_Aware_Verification/index",
    );
  });

  it("renders nothing without a lesson", () => {
    const { container } = render(<NextLesson />);
    expect(container).toBeEmptyDOMElement();
  });
});
