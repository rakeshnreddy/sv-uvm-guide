import type { Metadata } from "next";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Clock } from "lucide-react";

import Breadcrumbs from "@/components/layout/Breadcrumbs";
import LessonVisitTracker from "@/components/curriculum/LessonVisitTracker";
import FlashcardWidget from "@/components/widgets/FlashcardWidget";
import FeynmanPromptWidget from "@/components/widgets/FeynmanPromptWidget";
import { getMdxComponents } from "@/generated/mdx-component-registry";
import { curriculumData } from "@/lib/curriculum-data";
import {
  generateCurriculumStaticParams,
  generateLessonMetadata,
  loadCurriculumLesson,
} from "@/lib/curriculum/lesson-loader";
import { remarkConceptLinks } from "@/lib/curriculum/remark-concept-links";
import { getFullKnowledgeGraph } from "@/lib/knowledge-graph-engine";
import { cn } from "@/lib/utils";

type CurriculumTopicPageProps = {
  params: { slug: string[] };
};

export function generateStaticParams() {
  return generateCurriculumStaticParams();
}
export async function generateMetadata({ params }: CurriculumTopicPageProps): Promise<Metadata> {
  const lesson = await loadCurriculumLesson(params.slug);
  return lesson ? generateLessonMetadata(lesson) : {};
}

export default async function CurriculumTopicPage({ params }: CurriculumTopicPageProps) {
  const lesson = await loadCurriculumLesson(params.slug);
  if (!lesson) notFound();

  const { content: mdxContent, frontmatter, navigation, normalizedSlug, topic } = lesson;
  const [tierSlug, sectionSlug, topicSlug] = normalizedSlug;
  const tierEntry = curriculumData.find(module => module.slug === tierSlug);
  const sectionEntry = tierEntry?.sections.find(section => section.slug === sectionSlug);
  const siblingTopics = sectionEntry?.topics ?? [];
  const currentTopicIndex = siblingTopics.findIndex(item => item.slug === topicSlug);
  const lessonPosition = currentTopicIndex >= 0 ? currentTopicIndex + 1 : undefined;
  const summary = typeof frontmatter.description === 'string' && frontmatter.description.trim().length > 0
    ? frontmatter.description
    : topic.description;
  const wordCount = mdxContent ? mdxContent.trim().split(/\s+/).filter(Boolean).length : 0;
  const readingMinutes = wordCount ? Math.max(1, Math.round(wordCount / 180)) : 0;
  const flashcardDeckId = frontmatter.flashcards ?? frontmatter.flashcardId;
  const concepts = frontmatter.conceptLinking ? (await getFullKnowledgeGraph()).nodes : [];

  return (
    <div className="pb-16">
      <LessonVisitTracker moduleId={sectionSlug} lessonSlug={topicSlug} />
      <Breadcrumbs slug={normalizedSlug} />
      <div className="mx-auto max-w-6xl px-4 pt-8 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.35fr)]">
          <main className="flex flex-col gap-8">
            <header className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tierEntry?.title && <span>{tierEntry.title}</span>}
                {tierEntry?.title && sectionEntry?.title && <span>•</span>}
                {sectionEntry?.title && <span>{sectionEntry.title}</span>}
              </div>
              <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">{topic.title}</h1>
              {summary && (
                <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                  {summary}
                </p>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {lessonPosition && siblingTopics.length > 0 && (
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Lesson {lessonPosition} of {siblingTopics.length}
                  </span>
                )}
                {readingMinutes > 0 && (
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" /> {readingMinutes}-minute read
                  </span>
                )}
                {wordCount > 0 && (
                  <span>~{wordCount.toLocaleString()} words</span>
                )}
              </div>
            </header>

            <section className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm">
              <article className="prose prose-base max-w-none dark:prose-invert">
                <MDXRemote
                  source={mdxContent}
                  components={getMdxComponents(frontmatter.components)}
                  options={{
                    mdxOptions: {
                      remarkPlugins: concepts.length > 0
                        ? [[remarkConceptLinks, { concepts }]]
                        : [],
                    },
                  }}
                />
              </article>
            </section>

            {flashcardDeckId && (
              <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground">Reinforce the essentials</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use the flashcards to keep terminology and heuristics sharp before you move on.
                </p>
                <div className="mt-4">
                  <FlashcardWidget deckId={flashcardDeckId} />
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Teach it back</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Explain the concept in your own words to expose any gaps before tackling the next lesson.
              </p>
              <div className="mt-4">
                <FeynmanPromptWidget conceptTitle={topic.title} />
              </div>
            </section>

            <nav className="mt-4 grid gap-4 sm:grid-cols-2">
              {navigation.prev && (
                <Link
                  href={`/curriculum/${navigation.prev.slug}`}
                  className="group rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" /> Previous lesson
                  </span>
                  <p className="mt-2 text-sm font-semibold text-foreground group-hover:text-primary">
                    {navigation.prev.title}
                  </p>
                </Link>
              )}
              {navigation.next && (
                <Link
                  href={`/curriculum/${navigation.next.slug}`}
                  className="group rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md sm:justify-self-end"
                >
                  <span className="flex items-center justify-end gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Next lesson <ArrowRight className="h-4 w-4" />
                  </span>
                  <p className="mt-2 text-right text-sm font-semibold text-foreground group-hover:text-primary">
                    {navigation.next.title}
                  </p>
                </Link>
              )}
            </nav>
          </main>

          <aside className="lg:pl-2">
            <div className="sticky top-28 flex flex-col gap-6">
              <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Module quick facts</h2>
                <dl className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {tierEntry?.title && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground/70">Tier</dt>
                      <dd className="font-medium text-foreground">{tierEntry.title}</dd>
                    </div>
                  )}
                  {sectionEntry?.title && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground/70">Module</dt>
                      <dd className="font-medium text-foreground">{sectionEntry.title}</dd>
                    </div>
                  )}
                  {readingMinutes > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-foreground/70">
                        <Clock className="h-4 w-4" /> Read time
                      </dt>
                      <dd className="font-medium text-foreground">{readingMinutes} min</dd>
                    </div>
                  )}
                  {lessonPosition && siblingTopics.length > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-foreground/70">
                        <BookOpen className="h-4 w-4" /> Lesson
                      </dt>
                      <dd className="font-medium text-foreground">
                        {lessonPosition}/{siblingTopics.length}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {siblingTopics.length > 1 && (
                <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lessons in this module</h2>
                  <ul className="mt-4 space-y-2">
                    {siblingTopics.map(sibling => {
                      const lessonHref = `/curriculum/${tierSlug}/${sectionSlug}/${sibling.slug}`;
                      const isCurrent = sibling.slug === topicSlug;
                      return (
                        <li key={sibling.slug}>
                          <Link
                            href={lessonHref}
                            aria-current={isCurrent ? 'page' : undefined}
                            className={cn(
                              'flex items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2 text-sm transition',
                              isCurrent
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'hover:border-border/60 hover:bg-muted/40'
                            )}
                          >
                            <span className="line-clamp-2 text-left">{sibling.title}</span>
                            {isCurrent ? (
                              <span className="text-xs font-semibold uppercase">Current</span>
                            ) : (
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
