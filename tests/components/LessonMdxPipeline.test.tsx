import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LessonPractice } from "@/components/curriculum/LessonPractice";
import { getMdxComponents } from "@/generated/mdx-component-registry";
import { LESSON_PRACTICE_SLOT, lessonRemarkPlugins } from "@/lib/curriculum/lesson-mdx";
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";
import { getAllLabs } from "@/lib/lab-registry";
import { getPracticeForModule, type LessonPracticeEntry } from "@/lib/practice-links";

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<"a">, "href"> & { href: string }>;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Compiles and renders a lesson body exactly as the lesson page does. */
async function renderLesson(source: string, lessonSlug: string[], deckId?: string, practice: LessonPracticeEntry[] = []) {
  const toc: TocEntry[] = [];
  const components = {
    ...getMdxComponents([], { lessonSlug }),
    [LESSON_PRACTICE_SLOT]: (props: { level?: string }) => (
      <LessonPractice level={props.level} deckId={deckId} conceptTitle="Lesson" practice={practice} moduleCode="X" />
    ),
  };
  const { content } = await compileMDX({
    source,
    components,
    options: {
      mdxOptions: {
        remarkPlugins: lessonRemarkPlugins({ toc, hasFlashcards: Boolean(deckId), hasHandsOn: practice.length > 0 }),
      },
    },
  });
  return { html: renderToStaticMarkup(content), toc };
}

const IUVM3B = ["T2_Intermediate", "I-UVM-3B_Advanced_Sequencing_and_Layering", "virtual-sequences"];

describe("the lesson page's MDX pipeline", () => {
  it("renders <BeforeYouStart /> and <NextLesson /> without props, from the lesson being rendered", async () => {
    const { html } = await renderLesson(
      "## Quick Take\n\nIntro.\n\n<BeforeYouStart />\n\n## References & Next Topics\n\n<NextLesson />\n",
      IUVM3B,
    );
    expect(html).toMatch(/<span[^>]*data-testid="before-you-start"[^>]*><strong>Before you start:<\/strong>/);
    expect(html).toContain('href="/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index"');
    expect(html).toMatch(/data-testid="next-lesson"[^>]*><strong>Next:<\/strong> <a href="\/curriculum\/T2_Intermediate\/I-UVM-3B_Advanced_Sequencing_and_Layering\/uvm-virtual-sequencer"/);
  });

  it("gives headings ids and places the practice block, with its entries, before References", async () => {
    const { html, toc } = await renderLesson(
      "## Quick Take\n\n## Push Further\n\n### Expert: scale\n\n## Practice & Reinforce\n\nQuiz.\n\n## References & Next Topics\n",
      IUVM3B,
      "I-UVM-3B_Advanced_Sequencing_and_Layering",
    );
    expect(html).toContain('<h2 id="quick-take">Quick Take</h2>');
    expect(html).toContain('<h3 id="expert-scale">Expert: scale</h3>');
    expect(html.indexOf('id="reinforce-the-essentials"')).toBeGreaterThan(html.indexOf('id="practice--reinforce"'));
    expect(html.indexOf('id="teach-it-back"')).toBeLessThan(html.indexOf('id="references--next-topics"'));
    expect(html.match(/<section/g)).toHaveLength(2);
    expect(toc.map((entry) => entry.id)).toEqual([
      "quick-take",
      "push-further",
      "expert-scale",
      "practice--reinforce",
      "reinforce-the-essentials",
      "teach-it-back",
      "references--next-topics",
    ]);
    expect(toc.filter((entry) => entry.expert).map((entry) => entry.id)).toEqual(["push-further", "expert-scale"]);
  });

  it("offers the module's labs, exercises and models in the practice block (G30-PAGE-13)", async () => {
    const practice = getPracticeForModule("E-PSS-1_Portable_Stimulus_Standard", "E-PSS-1_Portable_Stimulus_Standard/index", getAllLabs());
    expect(practice.some((entry) => entry.item.kind === "lab")).toBe(true);
    const { html, toc } = await renderLesson(
      "## Knowledge Check\n\nQuiz.\n\n## References & Next Topics\n",
      ["T4_Expert", "E-PSS-1_Portable_Stimulus_Standard", "index"],
      undefined,
      practice,
    );
    expect(toc.map((entry) => entry.id)).toEqual(["knowledge-check", "hands-on-practice", "teach-it-back", "references--next-topics"]);
    expect(html).toContain('<h2 id="hands-on-practice"');
    expect(html).toContain('href="/practice/lab/pss-portable-intent"');
    expect(html).toContain("Sign in to run labs.");
    expect(html.indexOf('id="hands-on-practice"')).toBeLessThan(html.indexOf('id="references--next-topics"'));
  });

  it("does not add concept links unless a lesson opts in", async () => {
    const { html } = await renderLesson("## Quick Take\n\nUVM Phasing and the factory.\n", IUVM3B);
    expect(html).not.toContain("ConceptLink");
    expect(html).not.toMatch(/data-concept/);
  });

  it("renders a real sub-lesson", async () => {
    const file = path.join(process.cwd(), "content/curriculum/T4_Expert/E-SOC-1_SoC-Level_Verification_Strategies/pss.mdx");
    const { html, toc } = await renderLesson(matter(fs.readFileSync(file, "utf8")).content, [
      "T4_Expert",
      "E-SOC-1_SoC-Level_Verification_Strategies",
      "pss",
    ]);
    expect(toc[0]?.id).toBe("quick-take");
    for (const entry of toc) expect(html, entry.id).toContain(`id="${entry.id}"`);
  });
});
