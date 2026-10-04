import type { Metadata } from "next";
import { compileMDX } from "next-mdx-remote/rsc";
import { notFound, permanentRedirect } from "next/navigation";
import React from "react";

import LessonOrientation from "@/components/curriculum/LessonOrientation";
import LessonPager from "@/components/curriculum/LessonPager";
import { LessonPractice, type LessonPracticeProps } from "@/components/curriculum/LessonPractice";
import LessonToc from "@/components/curriculum/LessonToc";
import LessonVisitTracker from "@/components/curriculum/LessonVisitTracker";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { getMdxComponents } from "@/generated/mdx-component-registry";
import { getLessonContext } from "@/lib/curriculum/lesson-context";
import {
  generateCurriculumStaticParams,
  generateLessonMetadata,
  loadCurriculumLesson,
} from "@/lib/curriculum/lesson-loader";
import { LESSON_PRACTICE_SLOT, lessonRemarkPlugins } from "@/lib/curriculum/lesson-mdx";
import { resolveCurriculumRequest } from "@/lib/curriculum/lesson-urls";
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";
import { getFullKnowledgeGraph } from "@/lib/knowledge-graph-engine";
import { getAllLabs } from "@/lib/lab-registry";
import { getPracticeForModule } from "@/lib/practice-links";
import { cn } from "@/lib/utils";

type CurriculumTopicPageProps = {
  params: { slug: string[] };
};

export function generateStaticParams() {
  return generateCurriculumStaticParams();
}

export async function generateMetadata({ params }: CurriculumTopicPageProps): Promise<Metadata> {
  const request = resolveCurriculumRequest(params.slug);
  if (request.kind === "not-found") return {};
  const lesson = await loadCurriculumLesson(request.slug);
  return lesson ? generateLessonMetadata(lesson) : {};
}

export default async function CurriculumTopicPage({ params }: CurriculumTopicPageProps) {
  // One URL per lesson (G30-PAGE-03, G30-LINK-V03, G30-LINK-V11): pretty slugs,
  // two-segment module URLs, one-segment tier URLs and extra trailing segments
  // all redirect permanently to /curriculum/<Tier>/<Module>/<lesson>.
  const request = resolveCurriculumRequest(params.slug);
  if (request.kind === "not-found") notFound();
  if (request.kind === "redirect") permanentRedirect(request.location);

  const lesson = await loadCurriculumLesson(request.slug);
  const context = getLessonContext(request.slug);
  if (!lesson || !context) notFound();

  const { content: mdxContent, frontmatter, normalizedSlug, topic } = lesson;
  const [, sectionSlug, topicSlug] = normalizedSlug;
  const summary = typeof frontmatter.description === "string" && frontmatter.description.trim().length > 0
    ? frontmatter.description
    : topic.description;
  const wordCount = mdxContent ? mdxContent.trim().split(/\s+/).filter(Boolean).length : 0;
  const readingMinutes = wordCount ? Math.max(1, Math.round(wordCount / 180)) : 0;
  const flashcardDeckId = frontmatter.flashcards ?? frontmatter.flashcardId;
  // Automatic concept links are opt-in per lesson (`conceptLinking: true`): the
  // knowledge graph behind them is still a placeholder (G30 request 10).
  const concepts = frontmatter.conceptLinking ? (await getFullKnowledgeGraph()).nodes : [];

  // The module's labs, exercises and interactive models (G30-PAGE-13), from the practice map.
  const practice = getPracticeForModule(sectionSlug, `${sectionSlug}/${topicSlug}`, getAllLabs());

  const toc: TocEntry[] = [];
  const components = {
    ...getMdxComponents(frontmatter.components, { lessonSlug: normalizedSlug }),
    [LESSON_PRACTICE_SLOT]: (props: Pick<LessonPracticeProps, "level">) => (
      <LessonPractice
        level={props.level}
        deckId={flashcardDeckId}
        conceptTitle={topic.title}
        practice={practice}
        moduleCode={context.module.code}
      />
    ),
  };
  // Practice before References (G30-PAGE-V02), heading ids and "On this page" (G30-PAGE-02).
  const remarkPlugins = lessonRemarkPlugins({
    toc,
    hasFlashcards: Boolean(flashcardDeckId),
    hasHandsOn: practice.length > 0,
    concepts,
  });
  const { content } = await compileMDX({
    source: mdxContent,
    components,
    options: { mdxOptions: { remarkPlugins } },
  });

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <LessonVisitTracker moduleId={sectionSlug} lessonSlug={topicSlug} />
      <Breadcrumbs slug={normalizedSlug} />
      {/*
        One column below xl, with "On this page" as a disclosure above the lesson
        (the course outline docks beside lessons from lg). From xl, "On this
        page" is a sticky column on the right. The module's lessons are in
        "Jump to" and in the course outline.
      */}
      <div className={cn("mt-6 grid grid-cols-1 gap-6", toc.length > 0 && "xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-x-8")}>
        <LessonOrientation
          className="xl:col-start-1 xl:row-start-1"
          context={context}
          title={topic.title}
          summary={summary}
          readingMinutes={readingMinutes}
        />
        {toc.length > 0 ? (
          <div className="min-w-0 xl:col-start-2 xl:row-span-3 xl:row-start-1">
            <div className="xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pb-4">
              <LessonToc entries={toc} />
            </div>
          </div>
        ) : null}
        <div className="min-w-0 xl:col-start-1 xl:row-start-2">
          <article
            id="lesson-content"
            data-testid="lesson-content"
            className="prose prose-base max-w-none break-words rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm dark:prose-invert prose-headings:scroll-mt-28 prose-code:before:content-none prose-code:after:content-none sm:p-6"
          >
            {content}
          </article>
        </div>
        <LessonPager className="xl:col-start-1 xl:row-start-3" context={context} />
      </div>
    </div>
  );
}
