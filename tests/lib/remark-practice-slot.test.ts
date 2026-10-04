import fs from "node:fs";
import path from "node:path";

import { compileSync } from "@mdx-js/mdx";
import matter from "gray-matter";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";

import { LESSON_PRACTICE_SLOT, lessonPracticeSections } from "@/lib/curriculum/lesson-mdx";
import { curriculumData } from "@/lib/curriculum-data";
import { remarkHeadingIds, type TocEntry } from "@/lib/curriculum/remark-heading-ids";
import { remarkPracticeSlot } from "@/lib/curriculum/remark-practice-slot";

function compileLesson(source: string, hasFlashcards = true) {
  const toc: TocEntry[] = [];
  const code = String(
    compileSync(source, {
      remarkPlugins: [
        remarkGfm,
        [remarkPracticeSlot, { name: LESSON_PRACTICE_SLOT, sections: lessonPracticeSections(hasFlashcards) }],
        [remarkHeadingIds, { toc }],
      ] as never,
      development: false,
    }),
  );
  return { code, toc };
}

/** Order of headings and the slot in the compiled output. */
function outline(code: string): string[] {
  return [...code.matchAll(/_components\.(h[1-6]), \{\s*id: "([^"]*)"|_jsx\(LessonPractice, \{\s*level: "(\d)"/g)].map(
    (match) => (match[1] ? `${match[1]}#${match[2]}` : `slot:h${match[3]}`),
  );
}

describe("remarkPracticeSlot", () => {
  it("ends the Practice & Reinforce section, before References, with H3 headings", () => {
    const { code, toc } = compileLesson(
      "## Push Further\n\n## Practice & Reinforce\n\n### Quiz\n\n## Interview Questions\n\n## References & Next Topics\n",
    );
    expect(outline(code)).toEqual([
      "h2#push-further",
      "h2#practice--reinforce",
      "h3#quiz",
      "slot:h3",
      "h2#interview-questions",
      "h2#references--next-topics",
    ]);
    expect(toc.map((entry) => [entry.id, entry.depth])).toEqual([
      ["push-further", 2],
      ["practice--reinforce", 2],
      ["quiz", 3],
      ["reinforce-the-essentials", 3],
      ["teach-it-back", 3],
      ["interview-questions", 2],
      ["references--next-topics", 2],
    ]);
  });

  it("goes just before References when the lesson has no practice section", () => {
    const { code } = compileLesson("## Quick Take\n\n## Make It Work\n\n## References\n\nText.\n");
    expect(outline(code)).toEqual(["h2#quick-take", "h2#make-it-work", "slot:h2", "h2#references"]);
  });

  it("goes at the end of a lesson that has neither section", () => {
    const { code, toc } = compileLesson("## Quick Take\n\nText.\n", false);
    expect(outline(code)).toEqual(["h2#quick-take", "slot:h2"]);
    expect(toc.map((entry) => entry.id)).toEqual(["quick-take", "teach-it-back"]);
  });

  it("stays inside the JSX wrapper that holds the practice section", () => {
    const { code } = compileLesson(
      '<InfoPage title="Sub-lesson">\n\n## Practice & Reinforce\n\nQuiz here.\n\n## References & Next Topics\n\n</InfoPage>\n\nAfter the wrapper.\n',
    );
    const slot = code.indexOf("_jsx(LessonPractice");
    expect(slot).toBeGreaterThan(code.indexOf('id: "practice--reinforce"'));
    expect(slot).toBeLessThan(code.indexOf('id: "references--next-topics"'));
    expect(slot).toBeLessThan(code.indexOf("After the wrapper."));
  });

  it("puts practice before References & Next Topics in every lesson that has that section", () => {
    for (const tier of curriculumData) {
      for (const section of tier.sections) {
        for (const topic of section.topics) {
          const file = path.join(process.cwd(), "content", "curriculum", tier.slug, section.slug, `${topic.slug}.mdx`);
          const { code } = compileLesson(matter(fs.readFileSync(file, "utf8")).content);
          const order = outline(code);
          const slot = order.findIndex((entry) => entry.startsWith("slot:"));
          expect(slot, `${file} has one practice block`).toBeGreaterThanOrEqual(0);
          expect(order.filter((entry) => entry.startsWith("slot:")), file).toHaveLength(1);
          const references = order.findIndex((entry) => /^h2#references/.test(entry));
          if (references >= 0) expect(slot, `${file}: practice before References`).toBeLessThan(references);
        }
      }
    }
  }, 120_000);
});
