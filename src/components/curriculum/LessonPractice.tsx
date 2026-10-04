import Link from "next/link";
import React from "react";

import FeynmanPromptWidget from "@/components/widgets/FeynmanPromptWidget";
import FlashcardWidget from "@/components/widgets/FlashcardWidget";
import { FLASHCARDS_SECTION, HANDS_ON_SECTION, TEACH_BACK_SECTION } from "@/lib/curriculum/lesson-mdx";
import { PRACTICE_KIND_LABELS, type LessonPracticeEntry } from "@/lib/practice-links";

export interface LessonPracticeProps {
  /** "3" inside the lesson's Practice & Reinforce section, "2" elsewhere (set by remarkPracticeSlot). */
  level?: string | number;
  /** Flashcard deck id from the lesson frontmatter; no deck, no flashcards. */
  deckId?: string;
  /** Lesson title for the teach-back prompt. */
  conceptTitle: string;
  /** The module's labs, exercises and interactive models (src/lib/practice-links.ts), in manifest order. */
  practice?: readonly LessonPracticeEntry[];
  /** Module code, for example "I-UVM-3B". */
  moduleCode?: string;
}

const sectionClass = "rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm sm:p-6";
const headingClass = "scroll-mt-28 text-lg font-semibold text-foreground";

function HandsOnItem({ entry }: { entry: LessonPracticeEntry }) {
  const { item, after } = entry;
  const planned = item.status === "coming_soon";
  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-border/60 bg-background/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {PRACTICE_KIND_LABELS[item.kind]}
        {planned ? " · planned" : null}
      </p>
      {item.href && !planned ? (
        <Link
          href={item.href}
          className="mt-1 break-words font-semibold text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.title}
        </Link>
      ) : (
        <p className="mt-1 break-words font-semibold text-foreground">{item.title}</p>
      )}
      {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
      {after ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Do this after{" "}
          <Link href={after.href} className="font-semibold text-foreground underline underline-offset-2 hover:text-primary">
            {after.isModuleIndex ? `${after.code}: ${after.moduleTitle}` : after.title}
          </Link>
          .
        </p>
      ) : null}
      {item.kind === "lab" && !planned ? <p className="mt-2 text-xs text-muted-foreground">Sign in to run labs.</p> : null}
    </li>
  );
}

/**
 * The page's own practice, rendered inside the lesson where remarkPracticeSlot
 * puts it, so it comes before References & Next Topics and the in-content Next
 * link (G30-PAGE-V02):
 * - the lesson's flashcards, "Reinforce the essentials" (an e2e-pinned heading);
 * - the module's labs, exercises and interactive models from the practice map
 *   (G30-PAGE-13, G30-PRAC-01, G30-PRAC-V05), with "Do this after …" for items
 *   taught later;
 * - the "Teach it back" prompt.
 */
export function LessonPractice({ level, deckId, conceptTitle, practice = [], moduleCode }: LessonPracticeProps) {
  const Heading = Number(level) === 3 ? "h3" : "h2";
  return (
    <div className="not-prose my-10 flex flex-col gap-6" data-testid="lesson-practice">
      {deckId ? (
        <section className={sectionClass}>
          <Heading id={FLASHCARDS_SECTION.id} className={headingClass}>
            {FLASHCARDS_SECTION.text}
          </Heading>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the flashcards to keep terminology and heuristics sharp before you move on.
          </p>
          <div className="mt-4">
            <FlashcardWidget deckId={deckId} />
          </div>
        </section>
      ) : null}
      {practice.length > 0 ? (
        <section className={sectionClass}>
          <Heading id={HANDS_ON_SECTION.id} className={headingClass}>
            {HANDS_ON_SECTION.text}
          </Heading>
          <p className="mt-2 text-sm text-muted-foreground">
            {moduleCode ? `Labs, exercises and interactive models for ${moduleCode}.` : "Labs, exercises and interactive models for this module."}
          </p>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3">
            {practice.map((entry) => (
              <HandsOnItem key={entry.item.id} entry={entry} />
            ))}
          </ul>
        </section>
      ) : null}
      <section className={sectionClass}>
        <Heading id={TEACH_BACK_SECTION.id} className={headingClass}>
          {TEACH_BACK_SECTION.text}
        </Heading>
        <p className="mt-2 text-sm text-muted-foreground">
          Explain the concept in your own words to expose any gaps before tackling the next lesson.
        </p>
        <div className="mt-4">
          <FeynmanPromptWidget conceptTitle={conceptTitle} />
        </div>
      </section>
    </div>
  );
}

export default LessonPractice;
