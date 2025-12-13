import React from 'react';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { curriculumData, findTopicBySlug, findPrevNextTopics, normalizeSlug } from '@/lib';
import { getFullKnowledgeGraph, wrapConceptsInText } from '@/lib/knowledge-graph-engine';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import FeynmanPromptWidget from '@/components/widgets/FeynmanPromptWidget';
import Quiz from '@/components/ui/Quiz';
import Panel from '@/components/ui/Panel';
import { InfoPage } from '@/components/templates/InfoPage';
import LessonVisitTracker from '@/components/curriculum/LessonVisitTracker';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/Accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Alert } from '@/components/ui/Alert';
import dynamic from 'next/dynamic';
import ConceptLink from '@/components/knowledge/ConceptLink';
import matter from 'gray-matter';
import FlashcardWidget from '@/components/widgets/FlashcardWidget';
import { ArrowLeft, ArrowRight, BookOpen, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import MdxImage from '@/components/mdx/Image';

const VisualizationFallback = () => (
  <div className="flex h-48 items-center justify-center">Loading visualization...</div>
);

const AnimatedUvmSequenceDriverHandshakeDiagram = dynamic(() => import('@/components/diagrams/AnimatedUvmSequenceDriverHandshakeDiagram').then(mod => mod.AnimatedUvmSequenceDriverHandshakeDiagram));
const DataTypeComparisonChart = dynamic(
  () => import('@/components/charts/DataTypeComparisonChart'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const UvmHierarchySunburstChart = dynamic(
  () => import('@/components/charts/UvmHierarchySunburstChart'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const UvmPhasingDiagram = dynamic(() => import('@/components/diagrams/UvmPhasingDiagram'));
const AnimatedUvmTestbenchDiagram = dynamic(() => import('@/components/diagrams/AnimatedUvmTestbenchDiagram'));
const UvmVirtualSequencerDiagram = dynamic(() => import('@/components/diagrams/UvmVirtualSequencerDiagram'));
const UvmTestbenchVisualizer = dynamic(
  () => import('@/components/diagrams/UvmTestbenchVisualizer'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const InteractiveUvmArchitectureDiagram = dynamic(
  () => import('@/components/diagrams/InteractiveUvmArchitectureDiagram'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const UvmComponentRelationshipVisualizer = dynamic(
  () => import('@/components/diagrams/UvmComponentRelationshipVisualizer'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const UvmPhasingInteractiveTimeline = dynamic(() => import('@/components/diagrams/UvmPhasingInteractiveTimeline'));
const UvmFactoryWorkflowVisualizer = dynamic(() => import('@/components/diagrams/UvmFactoryWorkflowVisualizer'));
const SystemVerilogDataTypesAnimation = dynamic(
  () => import('@/components/animations/SystemVerilogDataTypesAnimation'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const CoverageAnalyzer = dynamic(() => import('@/components/animations/CoverageAnalyzer'));
const RandomizationExplorer = dynamic(
  () => import('@/components/animations/RandomizationExplorer'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const InterfaceSignalFlow = dynamic(() => import('@/components/animations/InterfaceSignalFlow'));
const ProceduralBlocksSimulator = dynamic(() => import('@/components/animations/ProceduralBlocksSimulator'));
const AssertionBuilder = dynamic(
  () => import('@/components/animations/AssertionBuilder'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const DebuggingSimulator = dynamic(() => import('@/components/ui/DebuggingSimulator'));
const InteractiveCode = dynamic(() => import('@/components/ui/InteractiveCode').then(mod => mod.InteractiveCode), { ssr: false });
const DataTypeExplorer = dynamic(
  () => import('@/components/animations/DataTypeExplorer'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const CurriculumDataTypeExplorer = dynamic(
  () => import('@/components/curriculum/f2/DataTypeExplorer'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const BlockingSimulator = dynamic(
  () => import('@/components/animations/BlockingSimulator'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const InteractiveCostOfBugGraph = dynamic(
  () => import('@/components/curriculum/f1/InteractiveCostOfBugGraph'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const HallOfShameCarousel = dynamic(
  () => import('@/components/curriculum/f1/HallOfShameCarousel'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const VerificationMethodologiesDiagram = dynamic(
  () => import('@/components/curriculum/f1/VerificationMethodologiesDiagram'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const FirstBugHuntGame = dynamic(
  () => import('@/components/curriculum/f1/FirstBugHuntGame'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const CurriculumDataTypeQuiz = dynamic(
  () => import('@/components/curriculum/f2/CurriculumDataTypeQuiz'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const DynamicStructureVisualizer = dynamic(
  () => import('@/components/curriculum/f2/DynamicStructureVisualizer'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const QueueOperationLab = dynamic(
  () => import('@/components/curriculum/f2/QueueOperationLab'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const PackedUnpackedPlayground = dynamic(
  () => import('@/components/curriculum/f2/PackedUnpackedPlayground'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const OperatorDrill = dynamic(
  () => import('@/components/curriculum/f2/OperatorDrill'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const PacketSorterGame = dynamic(
  () => import('@/components/curriculum/f2/PacketSorterGame'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);
const SystemVerilog3DVisualizer = dynamic(
  () => import('@/components/curriculum/f2/SystemVerilog3DVisualizer'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);

type CurriculumTopicPageProps = {
  params: Promise<{ slug: string[] }>;
};

const components = {
  InteractiveCode,
  Quiz,
  Panel,
  InfoPage,
  Accordion,
  AccordionItem,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CodeBlock,
  AnimatedUvmSequenceDriverHandshakeDiagram,
  DataTypeComparisonChart,
  UvmHierarchySunburstChart,
  UvmPhasingDiagram,
  Link,
  AnimatedUvmTestbenchDiagram,
  Alert,
  UvmVirtualSequencerDiagram,
  UvmTestbenchVisualizer,
  InteractiveUvmArchitectureDiagram,
  UvmFactoryWorkflowVisualizer,
  CoverageAnalyzer,
  RandomizationExplorer,
  InterfaceSignalFlow,
  ProceduralBlocksSimulator,
  AssertionBuilder,
  DebuggingSimulator,
  DataTypeExplorer,
  CurriculumDataTypeExplorer,
  CurriculumDataTypeQuiz,
  BlockingSimulator,
  ConceptLink,
  InteractiveCostOfBugGraph,
  HallOfShameCarousel,
  VerificationMethodologiesDiagram,
  FirstBugHuntGame,
  DynamicStructureVisualizer,
  QueueOperationLab,
  PackedUnpackedPlayground,
  OperatorDrill,
  PacketSorterGame,
  SystemVerilog3DVisualizer,
  Image: MdxImage,
  ModportExplorer: dynamic(() => import('@/components/visuals/ModportExplorer').then(mod => mod.ModportExplorer), { ssr: false }),
  EventRegionGame: dynamic(() => import('@/components/visuals/EventRegionGame'), { ssr: false }),
  SignednessVisualizer: dynamic(() => import('@/components/visuals/SignednessVisualizer'), { ssr: false }),
  DesignGapChart: dynamic(() => import('@/components/visuals/DesignGapChart'), { ssr: false }),
  LogicStateDiagram: dynamic(() => import('@/components/visuals/LogicStateDiagram'), { ssr: false }),
  StringMethodExplorer: dynamic(() => import('@/components/visuals/StringMethodExplorer'), { ssr: false }),
  EnumMethodVisualizer: dynamic(() => import('@/components/visuals/EnumMethodVisualizer'), { ssr: false }),
  OperatorVisualizer: dynamic(() => import('@/components/visuals/OperatorVisualizer'), { ssr: false }),
  ArrayMethodExplorer: dynamic(() => import('@/components/visuals/ArrayMethodExplorer'), { ssr: false }),
  MailboxSemaphoreGame: dynamic(() => import('@/components/visuals/MailboxSemaphoreGame'), { ssr: false }),
  VerilogVsSystemVerilog: dynamic(() => import('@/components/visuals/VerilogVsSystemVerilog'), { ssr: false }),
};

export default async function CurriculumTopicPage({ params }: CurriculumTopicPageProps) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    notFound();
  }

  const normalizedSlug = normalizeSlug(slug);

  if (normalizedSlug.length !== 3) {
    notFound();
  }

  const topic = findTopicBySlug(normalizedSlug);

  if (!topic) {
    notFound();
  }

  const navigation = findPrevNextTopics(normalizedSlug);

  const mdxPath = path.join(
    process.cwd(),
    'content',
    'curriculum',
    ...normalizedSlug
  ) + '.mdx';
  let mdxContent;
  let frontmatter: Record<string, any> = {};
  try {
    const file = await fs.readFile(mdxPath, 'utf8');
    const parsed = matter(file);
    mdxContent = parsed.content;
    frontmatter = parsed.data;
  } catch (error) {
    notFound();
  }

  // Fetch knowledge graph data and process content for concept linking
  const { nodes } = await getFullKnowledgeGraph();
  const shouldLinkConcepts = frontmatter.conceptLinking !== false;
  let processedContent = mdxContent;
  if (shouldLinkConcepts) {
    try {
      const firstBodyIndex = mdxContent.search(/\n##\s/);
      const mdxPreamble = firstBodyIndex >= 0 ? mdxContent.slice(0, firstBodyIndex) : mdxContent;
      const mdxBody = firstBodyIndex >= 0 ? mdxContent.slice(firstBodyIndex) : '';
      const linkedBody = mdxBody ? wrapConceptsInText(mdxBody, nodes) : '';
      processedContent = `${mdxPreamble}${linkedBody}`;
    } catch (error) {
      console.error('Failed to apply concept linking – serving raw MDX instead', error);
      processedContent = mdxContent;
    }
  }

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
                <MDXRemote source={processedContent} components={components} />
              </article>
            </section>

            {frontmatter.flashcards && (
              <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground">Reinforce the essentials</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use the flashcards to keep terminology and heuristics sharp before you move on.
                </p>
                <div className="mt-4">
                  <FlashcardWidget deckId={frontmatter.flashcards} />
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
