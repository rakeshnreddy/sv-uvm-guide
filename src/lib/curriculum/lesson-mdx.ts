/**
 * The lesson page's MDX pipeline in one place, so the page and the tests run
 * the same plugins in the same order.
 */
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

import type { ConceptNode } from "@/lib/knowledge-graph-engine";

import { remarkCallouts } from "./remark-callouts";
import { remarkConceptLinks } from "./remark-concept-links";
import { remarkHeadingIds, type TocEntry } from "./remark-heading-ids";
import { remarkJsxParagraphs } from "./remark-jsx-paragraphs";
import { remarkPracticeSlot, type PracticeSlotSection } from "./remark-practice-slot";

/** Name of the JSX element remarkPracticeSlot inserts; the lesson page provides the component. */
export const LESSON_PRACTICE_SLOT = "LessonPractice";

/** The flashcards heading. Its text is e2e-pinned ("Reinforce the essentials"). */
export const FLASHCARDS_SECTION: PracticeSlotSection = { id: "reinforce-the-essentials", text: "Reinforce the essentials" };
export const HANDS_ON_SECTION: PracticeSlotSection = { id: "hands-on-practice", text: "Hands-on practice" };
export const TEACH_BACK_SECTION: PracticeSlotSection = { id: "teach-it-back", text: "Teach it back" };

/** The headings the practice block renders, in order, for the "On this page" list. */
export function lessonPracticeSections(hasFlashcards: boolean, hasHandsOn = false): PracticeSlotSection[] {
  return [
    ...(hasFlashcards ? [FLASHCARDS_SECTION] : []),
    ...(hasHandsOn ? [HANDS_ON_SECTION] : []),
    TEACH_BACK_SECTION,
  ];
}

export interface LessonRemarkPluginOptions {
  /** Receives the "On this page" entries during compilation. */
  toc: TocEntry[];
  /** Whether the lesson has a flashcard deck (adds "Reinforce the essentials"). */
  hasFlashcards: boolean;
  /** Whether the module has labs, exercises or interactive models (adds "Hands-on practice"). */
  hasHandsOn?: boolean;
  /** Concepts for automatic concept links; only lessons with `conceptLinking: true` pass any. */
  concepts?: readonly ConceptNode[];
}

/**
 * remark-gfm, then the practice block before References (G30-PAGE-V02), then
 * heading ids and the table of contents (G30-PAGE-02) before anything that
 * rewrites text, then callouts, JSX paragraph repair and, when enabled,
 * concept links.
 */
export function lessonRemarkPlugins({ toc, hasFlashcards, hasHandsOn = false, concepts = [] }: LessonRemarkPluginOptions): PluggableList {
  const plugins: PluggableList = [
    remarkGfm,
    [remarkPracticeSlot, { name: LESSON_PRACTICE_SLOT, sections: lessonPracticeSections(hasFlashcards, hasHandsOn) }],
    [remarkHeadingIds, { toc }],
    remarkCallouts,
    remarkJsxParagraphs,
  ];
  if (concepts.length > 0) plugins.push([remarkConceptLinks, { concepts }]);
  return plugins;
}
