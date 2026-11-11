import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LessonPractice } from "@/components/curriculum/LessonPractice";
import { getMdxComponents } from "@/generated/mdx-component-registry";
import { getDeckCards } from "@/lib/flashcard-decks";
import { LESSON_PRACTICE_SLOT, lessonRehypePlugins, lessonRemarkPlugins } from "@/lib/curriculum/lesson-mdx";
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
      <LessonPractice
        level={props.level}
        deckId={deckId}
        deck={deckId ? getDeckCards(deckId) : null}
        conceptTitle="Lesson"
        practice={practice}
        moduleCode="X"
      />
    ),
  };
  const { content } = await compileMDX({
    source,
    components,
    options: {
      mdxOptions: {
        remarkPlugins: lessonRemarkPlugins({ toc, hasFlashcards: Boolean(deckId), hasHandsOn: practice.length > 0 }),
        rehypePlugins: lessonRehypePlugins(),
      },
    },
  });
  return { html: renderToStaticMarkup(content), toc };
}

const IUVM3B = ["T2_Intermediate", "I-UVM-3B_Advanced_Sequencing_and_Layering", "virtual-sequences"];
const IUVM3B_DECK = "I-UVM-3B_Advanced_Sequencing";

/** Text as renderToStaticMarkup escapes it. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

/** The flashcards <section>, from its heading to its closing tag. */
function flashcardsSection(html: string): string {
  const start = html.lastIndexOf("<section", html.indexOf('id="reinforce-the-essentials"'));
  return html.slice(start, html.indexOf("</section>", start));
}

describe("the lesson page's MDX pipeline", () => {
  beforeEach(() => {
    // framer-motion (the flashcard widget) uses layout effects under jsdom; React warns about them while rendering to a string.
    const originalError = console.error;
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("useLayoutEffect does nothing on the server")) return;
      originalError(...args);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      IUVM3B_DECK,
    );
    expect(html).toContain('<h2 id="quick-take">Quick Take</h2>');
    // The "Expert:" prefix becomes the outlined tag; the heading's text is unchanged (DESIGN.md section 12).
    expect(html).toContain('<h3 id="expert-scale"><span data-expert-tag="">Expert<span data-expert-colon="">:</span></span> scale</h3>');
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

  it("server-renders the lesson's first flashcard inside the flashcards section", async () => {
    const deck = getDeckCards(IUVM3B_DECK);
    expect(deck?.cards.length).toBeGreaterThan(1);
    const { html } = await renderLesson("## Practice & Reinforce\n\n## References & Next Topics\n", IUVM3B, IUVM3B_DECK);
    const section = flashcardsSection(html);
    expect(section).toContain(escapeHtml(deck!.cards[0].front));
    expect(section).toMatch(/Card (?:<!-- -->)?1(?:<!-- -->)? of (?:<!-- -->)?\d+/);
    expect(section).not.toContain(escapeHtml(deck!.cards[1].front));
    expect(section).not.toContain("No flashcards available");
    // The card is the first element with an explicit role="button" in the section, and the widget adds no <section>.
    expect(section.match(/role="button"/g)).toHaveLength(1);
    expect(section.indexOf('role="button"')).toBeLessThan(section.indexOf('aria-label="Next card"'));
    expect(section).toContain('aria-pressed="false"');
    expect(html.match(/<section/g)).toHaveLength(2);
  });

  it("resolves an aliased deck and says so when a deck has no cards", async () => {
    const alias = await renderLesson("## Practice & Reinforce\n", IUVM3B, "I-UVM-1A_Components");
    expect(flashcardsSection(alias.html)).toContain(escapeHtml(getDeckCards("I-UVM-1_UVM_Intro")!.cards[0].front));

    const missing = await renderLesson("## Practice & Reinforce\n", IUVM3B, "No_Such_Deck");
    expect(missing.html).toContain('id="reinforce-the-essentials"');
    expect(flashcardsSection(missing.html)).toContain("This lesson has no flashcards yet.");
    expect(missing.html).not.toContain('role="button"');
    expect(missing.html.match(/<section/g)).toHaveLength(2);
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
    expect(html).not.toContain("Sign in");
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

  it("tags lead-in labels, callout roles and the Expert tag as the page does (DESIGN.md section 12)", async () => {
    // Passages from F1A, F1B and B-AXI-2, as written.
    const source = [
      "## Quick Take",
      "",
      "- **What it is:** The economic case for verification. A **bug** is any difference between what the chip does and what it should do.",
      "- **Why it matters:** A logic bug found after tape-out can force a respin.",
      "",
      "> [!IMPORTANT]",
      "> **NRE versus recurring cost:** the mask set is paid once per design revision (NRE).",
      "",
      "> [!TIP]",
      "> **In interviews:** when asked \"How would you verify X?\", walk through these six questions.",
      "",
      "| Burst | Rule |",
      "|---|---|",
      "| **WRAP:** | must start aligned |",
      "",
      "## Push Further",
      "",
      "### Expert: what an interconnect may legally change",
      "",
      "**X-masking.** A DUT register that reset never assigned still holds `'x`.",
    ].join("\n");
    const { html } = await renderLesson(source, IUVM3B);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(Array.from(doc.querySelectorAll("strong[data-lead-in]")).map((node) => node.textContent)).toEqual([
      "What it is:",
      "Why it matters:",
      "NRE versus recurring cost:",
      "In interviews:",
    ]);
    expect(doc.querySelectorAll("td strong")).toHaveLength(1);
    expect(doc.querySelector("td strong[data-lead-in]")).toBeNull();
    const callouts = Array.from(doc.querySelectorAll("aside.callout"));
    expect(callouts.map((node) => node.getAttribute("data-callout-role"))).toEqual(["reference", "tip"]);
    for (const aside of callouts) expect(aside.classList.contains("glass-liquid")).toBe(true);
    const expert = doc.querySelector("h3[id] [data-expert-tag]");
    expect(expert?.closest("h3")?.textContent).toBe("Expert: what an interconnect may legally change");
  });
});
