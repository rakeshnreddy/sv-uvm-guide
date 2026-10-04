import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonOrientation from "@/components/curriculum/LessonOrientation";
import LessonPager from "@/components/curriculum/LessonPager";
import { curriculumData, findPrevNextTopics } from "@/lib/curriculum-data";
import { getLessonContext } from "@/lib/curriculum/lesson-context";

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<"a">, "href"> & { href: string }>;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const IUVM3B = "I-UVM-3B_Advanced_Sequencing_and_Layering";

function renderHeader(slug: string[]) {
  const context = getLessonContext(slug)!;
  render(<LessonOrientation context={context} title="Lesson title" summary="What you can do afterwards." readingMinutes={7} />);
  return context;
}

describe("<LessonOrientation />", () => {
  it('shows "Lesson k of N in <module>" from the manifest order (G30-PAGE-V01)', () => {
    const context = renderHeader(["T2_Intermediate", IUVM3B, "sequencer-driver-handshake"]);
    expect(screen.getByTestId("lesson-position")).toHaveTextContent(
      new RegExp(`^Lesson 2 of 9 in ${context.module.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    expect(screen.getByTestId("lesson-position")).toHaveTextContent(`module ${context.module.position} of ${context.module.count} in Tier 2: Intermediate`);
  });

  it("badges the track and tier as text, and lists the milestones the module builds", () => {
    renderHeader(["T2_Intermediate", "I-SV-8_Power_Intent_and_UPF", "index"]);
    const facts = screen.getByRole("list", { name: "About this lesson" });
    expect(within(facts).getByText("Elective (optional)")).toBeInTheDocument();
    expect(facts).toHaveTextContent("T2");
    expect(facts).toHaveTextContent("7-minute read");
    expect(screen.getByText("Builds toward:").parentElement).toHaveTextContent("M8");
  });

  it('links "Before you start" to the manifest prerequisites with canonical URLs', () => {
    const context = renderHeader(["T4_Expert", "E-PWR-1_Power_Aware_Verification", "index"]);
    const list = screen.getByRole("list", { name: "Before you start" });
    expect(within(list).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(context.prerequisites.map((item) => item.href));
    expect(within(list).getAllByRole("link")[0]).toHaveAttribute("href", "/curriculum/T2_Intermediate/I-SV-8_Power_Intent_and_UPF/index");
  });

  it("says when there is nothing to read first", () => {
    renderHeader(["T1_Foundational", "F1A_The_Cost_of_Bugs", "index"]);
    expect(screen.getByText("No prerequisites: this lesson is a starting point.")).toBeInTheDocument();
  });

  it("keeps the H1 inside the header (regression-gates selects `header h1`)", () => {
    renderHeader(["T1_Foundational", "F1A_The_Cost_of_Bugs", "index"]);
    expect(screen.getByRole("heading", { level: 1 }).closest("header")).not.toBeNull();
  });
});

describe("<LessonPager />", () => {
  it("names the landmark and links the generated previous and next lessons with boundary labels", () => {
    const slug = ["T2_Intermediate", IUVM3B, "sequence-arbitration"];
    render(<LessonPager context={getLessonContext(slug)!} />);
    const nav = screen.getByRole("navigation", { name: "Previous and next lesson" });
    const { prev, next } = findPrevNextTopics(slug);
    expect(within(nav).getByRole("link", { name: /^Previous lesson/ })).toHaveAttribute("href", `/curriculum/${prev!.slug}`);
    const nextLink = within(nav).getByRole("link", { name: /^Next lesson Sequence Libraries & Arbitration Control/ });
    expect(nextLink).toHaveAttribute("href", `/curriculum/${next!.slug}`);
    expect(nextLink).toHaveAttribute("rel", "next");
    expect(nextLink).toHaveTextContent("Lesson 4 of 9 in I-UVM-3B");
  });

  it("labels a tier boundary", () => {
    render(<LessonPager context={getLessonContext(["T2_Intermediate", "I-UVM-6_UVM_Recording_Classes", "index"])!} />);
    expect(screen.getByRole("link", { name: /^Next lesson/ })).toHaveTextContent("Starts Tier 3: Advanced");
  });

  it("is not a dead end after the last lesson", () => {
    const tier = curriculumData[curriculumData.length - 1];
    const section = tier.sections[tier.sections.length - 1];
    const topic = section.topics[section.topics.length - 1];
    render(<LessonPager context={getLessonContext([tier.slug, section.slug, topic.slug])!} />);
    const end = screen.getByTestId("end-of-path");
    expect(within(end).getByRole("link", { name: "curriculum overview" })).toHaveAttribute("href", "/curriculum");
    expect(screen.queryByRole("link", { name: /^Next lesson/ })).toBeNull();
  });
});
