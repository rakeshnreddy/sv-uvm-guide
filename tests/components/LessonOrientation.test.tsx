import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonOrientation from "@/components/curriculum/LessonOrientation";
import LessonNextBlock, { lessonLab } from "@/components/curriculum/LessonNextBlock";
import LessonPager, { nextLessonBoundary } from "@/components/curriculum/LessonPager";
import type { LessonPracticeEntry } from "@/lib/practice-links";
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
  it('shows "Lesson k of N" in the meta row, naming the module for screen readers (G30-PAGE-V01)', () => {
    const context = renderHeader(["T2_Intermediate", IUVM3B, "sequencer-driver-handshake"]);
    const position = screen.getByTestId("lesson-position");
    expect(position).toHaveTextContent(`Lesson 2 of 9 in ${context.module.label}`);
    expect(position.querySelector(".sr-only")).toHaveTextContent(`in ${context.module.label}`);
    expect(position.closest("[data-page-header-meta]")).toHaveTextContent("7 min read");
  });

  it("sits in one liquid glass block with the trail, instead of PageHeader's hairline (DESIGN.md section 12)", () => {
    const context = getLessonContext(["T2_Intermediate", IUVM3B, "sequencer-driver-handshake"])!;
    render(
      <LessonOrientation context={context} title="Lesson title" readingMinutes={7} trail={<nav aria-label="Breadcrumb">trail</nav>} />,
    );
    const block = screen.getByTestId("lesson-header-block");
    expect(block).toHaveClass("glass-liquid");
    expect(block).toHaveAttribute("data-lesson-header-glass");
    // The trail comes first, inside the block.
    expect(block.firstElementChild).toBe(screen.getByRole("navigation", { name: "Breadcrumb" }));
    const header = screen.getByTestId("lesson-header");
    expect(block).toContainElement(header);
    expect(header).toHaveClass("border-b-0", "pb-0", "mb-0");
    expect(header).not.toHaveClass("border-b", "pb-6", "mb-8");
    expect(header.querySelector("h1")).toHaveClass("text-h1", "text-foreground");
    // Text on glass is primary or secondary, never the subtle role: the meta row steps up.
    expect(block.className).toContain("[&_[data-page-header-meta]]:text-muted-foreground");
    // It bleeds by exactly its side padding at every width, so its text sits on the article's left edge.
    expect(block).toHaveClass("-mx-2", "px-2", "sm:-mx-6", "sm:p-6");
    expect(block).not.toHaveClass("p-4");
  });

  it("puts the tier and module codes in the eyebrow without repeating the trail's titles", () => {
    const context = renderHeader(["T2_Intermediate", IUVM3B, "sequencer-driver-handshake"]);
    const eyebrow = document.querySelector("[data-page-header-eyebrow]")!;
    const tags = Array.from(eyebrow.querySelectorAll("[data-signal-tag]")).map((tag) => tag.textContent);
    expect(tags).toEqual(["T2", context.module.code]);
    // The titles are for assistive technology only (sr-only); the trail shows them.
    expect(eyebrow.querySelector(".sr-only")).toHaveTextContent(context.tier.title);
    expect(Array.from(eyebrow.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE)).toHaveLength(0);
    // From sm up the trail's last crumb shows the module code, so the eyebrow's tag is for phones only.
    expect(screen.getByTestId("lesson-eyebrow-module")).toHaveClass("contents", "sm:hidden");
  });

  it("leaves the module tag out when the title already starts with the code", () => {
    const context = getLessonContext(["T2_Intermediate", "I-UVM-1B_The_UVM_Factory", "index"])!;
    render(<LessonOrientation context={context} title="I-UVM-1B: The UVM Factory" readingMinutes={0} />);
    const tags = Array.from(document.querySelectorAll("[data-page-header-eyebrow] [data-signal-tag]")).map((tag) => tag.textContent);
    expect(tags).toEqual(["T2"]);
  });

  it("marks an elective as quiet text, and lists the milestones the module builds as tags", () => {
    renderHeader(["T2_Intermediate", "I-SV-8_Power_Intent_and_UPF", "index"]);
    expect(screen.getByText("Elective, optional")).toHaveAttribute("data-level", "elective");
    const milestones = screen.getByTestId("lesson-milestones");
    expect(milestones).toHaveTextContent(/^Builds toward/);
    expect(milestones.querySelector("[data-signal-tag]")).toHaveTextContent("M8");
  });

  it('links "Before you start" to the manifest prerequisites with canonical URLs', () => {
    const context = renderHeader(["T4_Expert", "E-PWR-1_Power_Aware_Verification", "index"]);
    const list = screen.getByRole("list", { name: "Before you start" });
    expect(within(list).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(context.prerequisites.map((item) => item.href));
    expect(within(list).getAllByRole("link")[0]).toHaveAttribute("href", "/curriculum/T2_Intermediate/I-SV-8_Power_Intent_and_UPF/index");
  });

  it("renders the module code, the milestones and the prerequisite codes as signal tags", () => {
    const context = renderHeader(["T4_Expert", "E-PWR-1_Power_Aware_Verification", "index"]);
    const header = document.querySelector("header")!;
    const eyebrow = header.querySelector("[data-page-header-eyebrow]")!;
    expect(Array.from(eyebrow.querySelectorAll("[data-signal-tag]")).map((tag) => tag.textContent)).toContain(context.module.code);

    const prerequisite = within(screen.getByRole("list", { name: "Before you start" })).getAllByRole("link")[0];
    expect(prerequisite.querySelector("[data-signal-tag]")).toHaveTextContent("I-SV-8");
    expect(prerequisite).toHaveAccessibleName(/^I-SV-8 ?: /);
    // The linked-tag style ModuleCard uses: the tag takes the accent on hover and keyboard focus.
    expect(prerequisite).toHaveClass("group");
    expect(prerequisite.querySelector("[data-signal-tag]")).toHaveClass("group-hover:text-primary", "group-focus-visible:border-primary");

    for (const milestone of context.milestones) {
      const tag = Array.from(header.querySelectorAll("[data-signal-tag]")).find((el) => el.textContent === milestone.id);
      expect(tag, milestone.id).toBeDefined();
    }
  });

  it("says when there is nothing to read first, on one row", () => {
    renderHeader(["T1_Foundational", "F1A_The_Cost_of_Bugs", "index"]);
    const row = screen.getByTestId("before-you-start-chips");
    expect(row.tagName).toBe("P");
    expect(row).toHaveTextContent("Before you start No prerequisites: this lesson is a starting point.");
    expect(within(row).queryAllByRole("link")).toHaveLength(0);
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
    // The next lesson is the filled accent action; the previous one is a quiet text link.
    expect(nextLink).toHaveClass("bg-primary", "text-primary-foreground");
    expect(within(nav).getByRole("link", { name: /^Previous lesson/ }).className).not.toMatch(/bg-primary/);
  });

  it("does not repeat the module code when the next lesson's title already starts with it", () => {
    const context = getLessonContext(["T2_Intermediate", "I-UVM-1B_The_UVM_Factory", "index"])!;
    const lessons = context.lessons;
    const last = lessons[lessons.length - 1];
    const lastContext = getLessonContext(last.href.replace(/^\/curriculum\//, "").split("/"))!;
    const next = lastContext.next!;
    expect(next.step).toBe("module");
    expect(next.label.startsWith(`${next.moduleCode}:`)).toBe(true);
    render(<LessonPager context={lastContext} />);
    const link = screen.getByRole("link", { name: /^Next lesson/ });
    expect(link).toHaveTextContent(next.label);
    expect(link.textContent!.split(next.moduleCode)).toHaveLength(2);
    expect(link).toHaveTextContent(/Next module$/);
  });

  it("keeps the step words when the label lacks the code", () => {
    const base = { label: "I-UVM-1C: UVM Phasing", moduleCode: "I-UVM-1C" };
    expect(nextLessonBoundary({ ...base, step: "module", boundary: "Next module: I-UVM-1C" })).toBe("Next module");
    expect(nextLessonBoundary({ ...base, step: "module", boundary: "Next module: I-UVM-1C, elective" })).toBe("Next module, elective");
    expect(nextLessonBoundary({ ...base, label: "Phasing", step: "module", boundary: "Next module: I-UVM-1C" })).toBe("Next module: I-UVM-1C");
    expect(nextLessonBoundary({ ...base, step: "tier", boundary: "Starts Tier 3: Advanced" })).toBe("Starts Tier 3: Advanced");
    expect(nextLessonBoundary({ ...base, step: "lesson", boundary: "Lesson 3 of 9 in I-UVM-1C" })).toBe("Lesson 3 of 9 in I-UVM-1C");
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

const labEntry = (overrides: Partial<LessonPracticeEntry["item"]> = {}, after?: LessonPracticeEntry["after"]): LessonPracticeEntry => ({
  item: { id: "lab:x", kind: "lab", title: "Factory overrides", description: "", href: "/practice/lab/x", status: "available", lessons: [], order: 0, ...overrides },
  teaches: true,
  after,
});

describe("lessonLab", () => {
  it("picks the module's first lab that can be opened now", () => {
    expect(lessonLab([labEntry({ kind: "exercise", href: "/exercises/y" }), labEntry()])).toEqual({ href: "/practice/lab/x", title: "Factory overrides" });
  });

  it("skips planned labs, labs without a page, and labs a later lesson teaches", () => {
    const later = { href: "/curriculum/a/b/c" } as LessonPracticeEntry["after"];
    expect(lessonLab([labEntry({ status: "coming_soon" }), labEntry({ href: undefined }), labEntry({}, later)])).toBeNull();
    expect(lessonLab([])).toBeNull();
  });
});

describe("<LessonNextBlock />", () => {
  const slug = ["T2_Intermediate", IUVM3B, "sequence-arbitration"];

  it("is a glass panel with Lesson done, the next lesson as the one accent action, and the quieter lab and flashcards", () => {
    render(
      <LessonNextBlock
        context={getLessonContext(slug)!}
        moduleId={IUVM3B}
        lessonSlug="sequence-arbitration"
        lab={{ href: "/practice/lab/x", title: "Factory overrides" }}
        hasFlashcards
      />,
    );
    const block = screen.getByRole("region", { name: "Next" });
    // A liquid glass panel (DESIGN.md section 12), not a band under a hairline.
    expect(block).toHaveClass("glass-liquid", "mt-16");
    expect(block).not.toHaveClass("border-t");
    expect(within(block).getByRole("button", { name: "Lesson done" })).toHaveAttribute("aria-pressed", "false");
    const filled = Array.from(block.querySelectorAll("a")).filter((link) => link.className.includes("bg-primary"));
    expect(filled).toHaveLength(1);
    expect(filled[0]).toHaveAccessibleName(/^Next lesson/);
    const practise = within(block).getByRole("list", { name: "Practise this lesson" });
    expect(within(practise).getByRole("link", { name: "Lab: Factory overrides" })).toHaveAttribute("href", "/practice/lab/x");
    expect(within(practise).getByRole("link", { name: "Review flashcards" })).toHaveAttribute("href", "#reinforce-the-essentials");
  });

  it("leaves the practise list out when the module has neither", () => {
    render(<LessonNextBlock context={getLessonContext(slug)!} moduleId={IUVM3B} lessonSlug="sequence-arbitration" />);
    expect(screen.queryByTestId("lesson-reinforce")).toBeNull();
  });
});
