import React from 'react';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { findTopicBySlug, getBreadcrumbs, findPrevNextTopics } from '@/lib';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import FeynmanPromptWidget from '@/components/widgets/FeynmanPromptWidget';
import { InteractiveCode } from '@/components/ui/InteractiveCode';
import Quiz from '@/components/ui/Quiz';
import Panel from '@/components/ui/Panel';
import { InfoPage } from '@/components/templates/InfoPage';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/Accordion';
import { Card } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { DiagramPlaceholder, InteractiveChartPlaceholder } from '@/components/templates/InfoPage';
import { Alert } from '@/components/ui/Alert';
import dynamic from 'next/dynamic';

const AnimatedUvmSequenceDriverHandshakeDiagram = dynamic(() => import('@/components/diagrams/AnimatedUvmSequenceDriverHandshakeDiagram').then(mod => mod.AnimatedUvmSequenceDriverHandshakeDiagram));
const DataTypeComparisonChart = dynamic(() => import('@/components/charts/DataTypeComparisonChart'));
const UvmHierarchySunburstChart = dynamic(() => import('@/components/charts/UvmHierarchySunburstChart'));
const UvmPhasingDiagram = dynamic(() => import('@/components/diagrams/UvmPhasingDiagram'));
const AnimatedUvmTestbenchDiagram = dynamic(() => import('@/components/diagrams/AnimatedUvmTestbenchDiagram'));
const UvmVirtualSequencerDiagram = dynamic(() => import('@/components/diagrams/UvmVirtualSequencerDiagram'));
const UvmTestbenchVisualizer = dynamic(() => import('@/components/diagrams/UvmTestbenchVisualizer'));
const InteractiveUvmArchitectureDiagram = dynamic(() => import('@/components/diagrams/InteractiveUvmArchitectureDiagram'));
const UvmComponentRelationshipVisualizer = dynamic(() => import('@/components/diagrams/UvmComponentRelationshipVisualizer'));
const UvmPhasingInteractiveTimeline = dynamic(() => import('@/components/diagrams/UvmPhasingInteractiveTimeline'));
const SystemVerilogDataTypesAnimation = dynamic(() => import('@/components/animations/SystemVerilogDataTypesAnimation'));

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
  CodeBlock,
  AnimatedUvmSequenceDriverHandshakeDiagram,
  DataTypeComparisonChart,
  UvmHierarchySunburstChart,
  UvmPhasingDiagram,
  Link,
  DiagramPlaceholder,
  AnimatedUvmTestbenchDiagram,
  Alert,
  UvmVirtualSequencerDiagram,
  InteractiveChartPlaceholder,
  UvmTestbenchVisualizer,
  InteractiveUvmArchitectureDiagram,
};

export default async function CurriculumTopicPage({ params }: CurriculumTopicPageProps) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    notFound();
  }

  const topic = findTopicBySlug(slug);

  if (!topic) {
    notFound();
  }

  const mdxPath = path.join(
    process.cwd(),
    'content',
    'curriculum',
    ...slug
  ) + '.mdx';
  let mdxContent;
  try {
    mdxContent = await fs.readFile(mdxPath, 'utf8');
  } catch (error) {
    notFound();
  }

  return (
    <div className="p-4 md:p-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
      <Breadcrumbs slug={slug} />
      <h1 className="text-3xl sm:text-4xl font-bold text-primary font-sans mb-6 pb-2 border-b border-white/20">
        {topic.title}
      </h1>
      <article className="prose prose-invert max-w-none">
        <MDXRemote source={mdxContent} components={components} />
      </article>
      <FeynmanPromptWidget conceptTitle={topic.title} />

      {/* Navigation Footer */}
      <div className="mt-8 pt-4 border-t border-white/20 flex justify-between items-center">
        {findPrevNextTopics(slug).prev ? (
          <Link href={`/curriculum/${findPrevNextTopics(slug).prev?.slug}`} className="text-primary hover:underline">
            &larr; Previous: {findPrevNextTopics(slug).prev?.title}
          </Link>
        ) : (
          <div />
        )}
        {findPrevNextTopics(slug).next ? (
          <Link href={`/curriculum/${findPrevNextTopics(slug).next?.slug}`} className="text-primary hover:underline">
            Next: {findPrevNextTopics(slug).next?.title} &rarr;
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
