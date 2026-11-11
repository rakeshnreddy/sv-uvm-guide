import type { Metadata } from "next";
import { compileMDX } from "next-mdx-remote/rsc";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import React from "react";

import LessonNextBlock, { lessonLab } from "@/components/curriculum/LessonNextBlock";
import LessonOrientation from "@/components/curriculum/LessonOrientation";
import { LessonPractice, type LessonPracticeProps } from "@/components/curriculum/LessonPractice";
import LessonToc from "@/components/curriculum/LessonToc";
import LessonTrail from "@/components/curriculum/LessonTrail";
import LessonVisitTracker from "@/components/curriculum/LessonVisitTracker";
import { HeaderReadingProgress, LESSON_ARTICLE_ID } from "@/components/curriculum/ReadingProgress";
import { lessonScrollRegionComponents } from "@/components/curriculum/ScrollRegion";
import { PageShell } from "@/components/layout/PageShell";
import { BeforeYouStart, type BeforeYouStartProps } from "@/components/mdx/BeforeYouStart";
import { PROSE_CLASS } from "@/components/ui/Prose";
import { getMdxComponents } from "@/generated/mdx-component-registry";
import { lessonHref } from "@/lib/curriculum-overview";
import { getLessonContext } from "@/lib/curriculum/lesson-context";
import {
  generateCurriculumStaticParams,
  generateLessonMetadata,
  loadCurriculumLesson,
} from "@/lib/curriculum/lesson-loader";
import { LESSON_PRACTICE_SLOT, lessonRemarkPlugins } from "@/lib/curriculum/lesson-mdx";
import { resolveCurriculumRequest } from "@/lib/curriculum/lesson-urls";
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";
import { getDeckCards } from "@/lib/flashcard-decks";
import { getLinkableConcepts } from "@/lib/knowledge-graph-engine";
import { getAllLabs } from "@/lib/lab-registry";
import { getPracticeForModule } from "@/lib/practice-links";
import { tierDataAttribute, tierOfTierSlug } from "@/lib/tier-colors";
import { cn } from "@/lib/utils";

import { tierRedirectHref } from "./tier-redirect";

type CurriculumTopicPageProps = {
  params: { slug: string[] };
};

export function generateStaticParams() {
  return generateCurriculumStaticParams();
}

export async function generateMetadata({ params }: CurriculumTopicPageProps): Promise<Metadata> {
  if (tierRedirectHref(params.slug)) return {};
  const request = resolveCurriculumRequest(params.slug);
  if (request.kind === "not-found") return {};
  const lesson = await loadCurriculumLesson(request.slug);
  return lesson ? generateLessonMetadata(lesson) : {};
}

export default async function CurriculumTopicPage({ params }: CurriculumTopicPageProps) {
  // One URL per lesson (G30-PAGE-03, G30-LINK-V03, G30-LINK-V11): pretty slugs,
  // two-segment module URLs and extra trailing segments all redirect
  // permanently to /curriculum/<Tier>/<Module>/<lesson>. A one-segment tier URL
  // goes to the tier's section of /curriculum (SPEC-phases-2-4.md, "URLs"); this
  // page never renders a tier (307, so the tier URL can come back later).
  // src/middleware.ts sends the same redirects with a Location header before
  // the ISR cache (which drops Location on a cache hit); this is the fallback.
  const tierHref = tierRedirectHref(params.slug);
  if (tierHref) redirect(tierHref);
  const request = resolveCurriculumRequest(params.slug);
  if (request.kind === "not-found") notFound();
  if (request.kind === "redirect") permanentRedirect(request.location);

  const lesson = await loadCurriculumLesson(request.slug);
  const context = getLessonContext(request.slug);
  if (!lesson || !context) notFound();

  const { content: mdxContent, frontmatter, normalizedSlug, topic } = lesson;
  const [tierSlug, sectionSlug, topicSlug] = normalizedSlug;
  // The canonical lesson path (GD15): what usePathname() returns on this page.
  const lessonPath = lessonHref(tierSlug, sectionSlug, topicSlug);
  const summary = typeof frontmatter.description === "string" && frontmatter.description.trim().length > 0
    ? frontmatter.description
    : topic.description;
  const wordCount = mdxContent ? mdxContent.trim().split(/\s+/).filter(Boolean).length : 0;
  const readingMinutes = wordCount ? Math.max(1, Math.round(wordCount / 180)) : 0;
  const flashcardDeckId = frontmatter.flashcards ?? frontmatter.flashcardId;
  const flashcardDeck = flashcardDeckId ? getDeckCards(flashcardDeckId) : null;
  // Automatic concept links are opt-in per lesson (`conceptLinking: true`) and
  // cover the key terms only; each term is linked at its first occurrence.
  const concepts = frontmatter.conceptLinking ? getLinkableConcepts() : [];

  // The module's labs, exercises and interactive models (G30-PAGE-13), from the practice map.
  const practice = getPracticeForModule(sectionSlug, `${sectionSlug}/${topicSlug}`, getAllLabs());

  const toc: TocEntry[] = [];
  const components = {
    ...getMdxComponents(frontmatter.components, { lessonSlug: normalizedSlug }),
    // Wide code blocks and tables scroll in a focusable, labelled box (WCAG 2.1.1, 1.3.1).
    ...lessonScrollRegionComponents,
    // The header's "Before you start" row carries the same manifest data, so a
    // bare <BeforeYouStart /> (this lesson) would repeat it a screen later. One
    // that names another lesson still renders.
    BeforeYouStart: (props: BeforeYouStartProps) => (props.lesson ? <BeforeYouStart {...props} /> : null),
    [LESSON_PRACTICE_SLOT]: (props: Pick<LessonPracticeProps, "level">) => (
      <LessonPractice
        level={props.level}
        deckId={flashcardDeckId}
        deck={flashcardDeck}
        conceptTitle={topic.title}
        lessonPath={lessonPath}
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

  const hasToc = toc.length > 0;
  // The lesson's tier colour (DESIGN.md section 11): on the shell, so the
  // header's tags and the reading progress line follow it, and on the article,
  // where it draws the first 48 px of each layer band's rule.
  const tierAttribute = tierDataAttribute(tierOfTierSlug(tierSlug));

  return (
    <PageShell width="content" innerClassName="pb-16" data-testid="lesson-page" data-tier={tierAttribute}>
      <LessonVisitTracker moduleId={sectionSlug} lessonSlug={topicSlug} lessonPath={lessonPath} />
      {hasToc ? <HeaderReadingProgress /> : null}
      <LessonTrail slug={normalizedSlug} className="mb-4" />
      {/*
        Below 1280 px one column: the header, the 44 px "On this page" bar
        (sticky under the site header, display: contents on its wrapper so it
        sticks for the whole lesson), the article and the Next block. From 1280
        px "On this page" is a sticky column on the right. The module's lessons
        are in "Jump to" and in the course outline.
      */}
      <div className={cn(hasToc && "xl:grid xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-x-12")}>
        <LessonOrientation
          className={cn(hasToc && "mb-0 xl:mb-8", "xl:col-start-1 xl:row-start-1")}
          context={context}
          title={topic.title}
          summary={summary}
          readingMinutes={readingMinutes}
        />
        {hasToc ? (
          <div className="contents xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:block">
            <LessonToc entries={toc} />
          </div>
        ) : null}
        <article
          id={LESSON_ARTICLE_ID}
          data-testid="lesson-content"
          data-lesson-article=""
          data-tier={tierAttribute}
          className={cn(PROSE_CLASS, "break-words prose-headings:scroll-mt-28", hasToc && "mt-8 xl:mt-0", "xl:col-start-1 xl:row-start-2")}
        >
          {content}
        </article>
        <LessonNextBlock
          className="xl:col-start-1 xl:row-start-3"
          context={context}
          moduleId={sectionSlug}
          lessonSlug={topicSlug}
          lab={lessonLab(practice)}
          hasFlashcards={Boolean(flashcardDeck && flashcardDeck.cards.length > 0)}
        />
      </div>
    </PageShell>
  );
}
